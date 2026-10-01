import "server-only";
import { integrations } from "./env";
import { decrementStock, getProductsByIds } from "./products";
import { generateOrderReference } from "./paystack";
import { supabase } from "./supabase";

/**
 * Orders.
 *
 * THE MOST IMPORTANT RULE IN THIS FILE
 * -----------------------------------
 * The total is recalculated here, from product prices in the database. The
 * amounts sent by the browser are ignored completely.
 *
 * That is not paranoia. Any value a client sends is chosen by the client, so a
 * cart that posts `{ price: 1 }` will be believed by a server that trusts it.
 * The browser is only ever allowed to say *what* it wants (product ids and
 * quantities) and *where* to ship it - never *how much it costs*.
 */

export interface CartLineInput {
  productId: string;
  quantity: number;
}

export interface CheckoutInput {
  lines: CartLineInput[];
  email: string;
  shippingName: string;
  shippingPhone?: string;
  shippingAddress: string;
  shippingCity?: string;
  shippingState?: string;
  userId?: string;
}

export interface CreatedOrder {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  email: string;
  /**
   * The line items as priced by the database, not as claimed by the browser.
   * Returned so the caller can hand an accurate receipt to the payment
   * gateway's metadata.
   */
  lines: {
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
  }[];
}

export interface OrderRecord {
  id: string;
  reference: string;
  user_id: string | null;
  email: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  amount: number;
  currency: string;
  payment_provider: string;
  payment_reference: string | null;
  shipping_name: string;
  shipping_phone: string | null;
  shipping_address: string;
  shipping_city: string | null;
  shipping_state: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface OrderLineRecord {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
}

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

function requireDatabase(): void {
  if (!integrations.database) {
    throw new CheckoutError(
      "Checkout needs the database. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "to .env.local and run supabase/schema.sql. See README > 1. Supabase.",
    );
  }
}

/**
 * Create a pending order.
 *
 * Line items snapshot the product name and price, so renaming or repricing a
 * product later never rewrites what a customer was actually charged.
 */
export async function createOrder(input: CheckoutInput): Promise<CreatedOrder> {
  requireDatabase();

  // Collapse duplicate product ids and clamp quantities to sane values.
  const wanted = new Map<string, number>();
  for (const line of input.lines) {
    const quantity = Math.min(Math.max(Math.trunc(line.quantity), 1), 99);
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + quantity);
  }

  if (wanted.size === 0) {
    throw new CheckoutError("Your cart is empty.", "lines");
  }

  const products = await getProductsByIds([...wanted.keys()]);
  if (products.length !== wanted.size) {
    throw new CheckoutError("One of the items in your cart no longer exists.");
  }

  // Recalculate everything from the database.
  const lines = products.map((product) => ({
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity: wanted.get(product.id)!,
  }));

  const amount = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  const unavailable = products.filter((p) => p.stock < (wanted.get(p.id) ?? 0));
  if (unavailable.length > 0) {
    throw new CheckoutError(
      `Not enough stock for ${unavailable.map((p) => p.name).join(", ")}.`,
      unavailable[0].slug,
    );
  }

  const reference = generateOrderReference();

  const { data: order, error } = await supabase()
    .from("orders")
    .insert({
      reference,
      user_id: input.userId ?? null,
      email: input.email.toLowerCase(),
      status: "pending",
      amount,
      currency: "NGN",
      shipping_name: input.shippingName,
      shipping_phone: input.shippingPhone ?? null,
      shipping_address: input.shippingAddress,
      shipping_city: input.shippingCity ?? null,
      shipping_state: input.shippingState ?? null,
    })
    .select("id, reference, amount, currency, email")
    .single();

  if (error || !order) {
    throw new CheckoutError(`Could not save the order: ${error?.message ?? "unknown error"}`);
  }

  const { error: itemsError } = await supabase().from("order_items").insert(
    lines.map((line) => ({
      order_id: order.id,
      product_id: line.productId,
      name: line.name,
      unit_price: line.unitPrice,
      quantity: line.quantity,
    })),
  );

  if (itemsError) {
    // Do not leave a header row with no items behind.
    await supabase().from("orders").delete().eq("id", order.id);
    throw new CheckoutError(`Could not save the order items: ${itemsError.message}`);
  }

  return { ...(order as Omit<CreatedOrder, "lines">), lines };
}

export async function getOrderByReference(reference: string): Promise<OrderRecord | null> {
  requireDatabase();

  const { data, error } = await supabase()
    .from("orders")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as OrderRecord | null) ?? null;
}

export async function getOrderItems(orderId: string): Promise<OrderLineRecord[]> {
  const { data, error } = await supabase()
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .order("id");

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderLineRecord[];
}

/**
 * Flip a pending order to paid, take the stock off the shelf, and return the
 * order with its lines so we can email a receipt.
 *
 * Safe to call twice. If the order is already paid we short-circuit, which
 * matters because the payment provider may call our webhook more than once and
 * stock must not be decremented twice.
 */
export async function settleOrder(
  reference: string,
  paymentReference: string | null,
): Promise<{ order: OrderRecord; items: OrderLineRecord[]; alreadySettled: boolean }> {
  requireDatabase();

  const order = await getOrderByReference(reference);
  if (!order) {
    throw new CheckoutError("We could not find that order.");
  }

  const items = await getOrderItems(order.id);

  if (order.status === "paid") {
    return { order, items, alreadySettled: true };
  }

  const { data: updated, error } = await supabase()
    .from("orders")
    .update({ status: "paid", payment_reference: paymentReference })
    .eq("id", order.id)
    .eq("status", "pending") // guard: only a pending order can become paid
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not mark the order paid: ${error.message}`);
  }

  if (!updated) {
    // The guard matched nothing, so something else settled it first.
    const current = await getOrderByReference(reference);
    return { order: current!, items, alreadySettled: true };
  }

  // Best-effort stock reduction. If it fails the order is still paid and the
  // customer still gets their goods - do not lose the sale over a stock count.
  const withStock = items
    .filter((item): item is OrderLineRecord & { product_id: string } => item.product_id !== null)
    .map((item) => ({ productId: item.product_id, quantity: item.quantity }));

  if (withStock.length > 0) {
    try {
      await decrementStock(withStock);
    } catch (error) {
      console.error(`[orders] stock decrement failed for ${reference}:`, error);
    }
  }

  return { order: updated as OrderRecord, items, alreadySettled: false };
}

export async function listOrdersForUser(userId: string): Promise<OrderRecord[]> {
  requireDatabase();

  const { data, error } = await supabase()
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderRecord[];
}

export async function listItemsForOrders(orderIds: string[]): Promise<OrderLineRecord[]> {
  if (orderIds.length === 0) return [];

  const { data, error } = await supabase()
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as OrderLineRecord[];
}
