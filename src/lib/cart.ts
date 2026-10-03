import "server-only";
import { supabase } from "./supabase";
import type { CartItem } from "@/components/cart/types";

/**
 * The cart, in the database.
 *
 * WHY THIS EXISTS
 * localStorage is scoped to one browser profile on one device. A phone and a
 * laptop have two separate stores with no relationship between them, so an item
 * added on the website could never appear on the phone - the two have never
 * heard of each other. Putting the cart here is what makes "the same basket on
 * both" true rather than aspirational.
 *
 * WHO USES THIS
 * Signed-in shoppers. A guest basket stays in localStorage exactly as it was,
 * because a basket belongs to someone who may never sign in, and an abandoned
 * basket is not an order. See CartProvider for how the two are chosen between.
 *
 * MONEY
 * Nothing here is trusted. readCart() joins products to get the current name,
 * price and stock, so a basket written last week shows today's price. The
 * quantity is the only thing stored, and it is capped at the stock on hand by
 * set_cart_quantity() in the database. The same reasoning as /api/checkout,
 * which recalculates every price rather than trusting the browser.
 */

/** The exact shape stored in cart_items, before the join. */
interface CartRow {
  product_id: string;
  quantity: number;
}

/**
 * Read somebody's cart, newest addition first.
 *
 * The join is done in the database rather than by fetching cart_items and then
 * fetching 20 products separately: one round trip instead of N+1, and it cannot
 * produce a basket line whose product no longer exists.
 */
export async function readCart(userId: string): Promise<CartItem[]> {
  const { data, error } = await supabase()
    .from("cart_items")
    .select(
      `
        quantity,
        created_at,
        products (
          id, slug, name, price, emoji, stock
        )
      `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`readCart failed: ${error.message}`);
  }

  return (data ?? []).flatMap((row) => {
    // PostgREST returns an embedded to-one relationship as an OBJECT, but it
    // widens that to a single-element ARRAY in some cases - a row inserted before
    // the FK constraint existed, or a differently-shaped response from a future
    // PostgREST version. Normalising both is cheaper than discovering which one
    // you got from a customer whose basket is silently empty.
    const embedded = row.products as unknown;
    const product = (
      Array.isArray(embedded) ? embedded[0] : embedded
    ) as
      | {
          id: string;
          slug: string;
          name: string;
          price: number;
          emoji: string;
          stock: number;
        }
      | null
      | undefined;

    // Missing entirely means the product was deleted between the cart write and
    // this read. Skipping it is right: a line for something that no longer exists
    // would fail at checkout, which is the worst moment to find out.
    if (!product || typeof product.id !== "string") return [];

    return [
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        quantity: Number(row.quantity) || 1,
        emoji: product.emoji,
        maxStock: product.stock,
      },
    ];
  });
}

export interface CartUpdate {
  productId: string;
  quantity: number;
  /** True to set the quantity, false to add to it. */
  absolute: boolean;
}

export interface CartUpdateResult {
  /** The quantity now stored. 0 means the line was removed. */
  quantity: number;
  /**
   * True when the request was refused because it named a product that does not
   * exist. Distinguishable from "capped at stock", which is a success.
   */
  unknownProduct: boolean;
}

/**
 * Add to, or set, one line.
 *
 * The arithmetic happens inside the set_cart_quantity Postgres function so the
 * read and the write are one atomic step. Doing it here would reintroduce the
 * lost-update race that function exists to prevent: two devices pressing "add"
 * at the same moment would both read quantity = 1, both write 2, and one
 * addition would vanish.
 */
export async function updateCartLine(
  userId: string,
  update: CartUpdate,
): Promise<CartUpdateResult> {
  const { data, error } = await supabase().rpc("set_cart_quantity", {
    p_user_id: userId,
    p_product_id: update.productId,
    p_quantity: update.quantity,
    p_absolute: update.absolute,
  });

  if (error) {
    // The function raises no_data_found for a product that does not exist.
    // That is a client mistake worth reporting precisely, not a server fault to
    // log and swallow.
    if (error.code === "no_data_found" || /does not exist/i.test(error.message)) {
      return { quantity: 0, unknownProduct: true };
    }

    throw new Error(`updateCartLine failed: ${error.message}`);
  }

  return { quantity: Number(data) || 0, unknownProduct: false };
}

/** Empty the cart. Called after an order is placed so the next one starts clean. */
export async function clearCart(userId: string): Promise<void> {
  const { error } = await supabase().from("cart_items").delete().eq("user_id", userId);

  if (error) {
    throw new Error(`clearCart failed: ${error.message}`);
  }
}

/**
 * Fold a guest basket into a signed-in shopper's server cart.
 *
 * THE SITUATION THIS HANDLES
 * You fill a basket, then decide to sign in. That basket is in localStorage and
 * belongs to the account you are about to have. Throwing it away would lose the
 * items; uploading it blindly would double anything already on the server.
 *
 * So quantities are SUMMED. The result is capped at stock by the same database
 * function that caps a normal add, so merging cannot create a line that exceeds
 * what is on the shelf.
 *
 * Called once, at sign-in. Not called on every load - that would re-add the same
 * guest items forever, since localStorage is not cleared until the merge
 * succeeds.
 */
export async function mergeCart(
  userId: string,
  lines: { productId: string; quantity: number }[],
): Promise<CartItem[]> {
  for (const line of lines) {
    // absolute: false, so this adds to what is already there rather than
    // replacing it. The cap against stock happens inside the function.
    await updateCartLine(userId, {
      productId: line.productId,
      quantity: line.quantity,
      absolute: false,
    });
  }

  return readCart(userId);
}

/**
 * How many units are in somebody's cart.
 *
 * The header badge renders on every page, so this is worth not over-thinking:
 * it is a count from the database, not a sum of prices, and the badge has no
 * need for the joined product data that readCart() fetches.
 */
export async function cartCount(userId: string): Promise<number> {
  const { data, error } = await supabase()
    .from("cart_items")
    .select("quantity")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`cartCount failed: ${error.message}`);
  }

  return (data as CartRow[] | null ?? []).reduce(
    (total, row) => total + (Number(row.quantity) || 0),
    0,
  );
}
