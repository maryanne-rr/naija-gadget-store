import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createOrder, CheckoutError } from "@/lib/orders";
import { startPayment } from "@/lib/paystack";
import { settleOrder } from "@/lib/orders";
import { sendOrderConfirmation } from "@/lib/mail";

/**
 * POST /api/checkout
 *
 * Creates the order, then hands the customer to the payment gateway.
 *
 * Two things to notice:
 *
 *  1. The request body carries product ids and quantities ONLY. Prices are
 *     recalculated from the database inside createOrder(). If this route
 *     believed a price sent by the browser, anyone could set the total to 1.
 *
 *  2. With no Paystack key configured, startPayment() returns the simulated
 *     branch and we settle the order immediately. The rest of the flow -
 *     database write, stock decrement, confirmation email - is identical, so
 *     the demo works before you have any API keys.
 */

const lineSchema = z.object({
  productId: z.string().uuid("Each cart line needs a valid product id."),
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "Quantity must be at least 1.")
    .max(99, "You cannot order more than 99 of one item."),
});

const checkoutSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  shippingName: z.string().trim().min(2, "Enter the recipient's name.").max(120),
  shippingPhone: z.string().trim().max(24).optional().or(z.literal("")),
  shippingAddress: z.string().trim().min(5, "Enter a delivery address.").max(400),
  shippingCity: z.string().trim().max(80).optional().or(z.literal("")),
  shippingState: z.string().trim().max(80).optional().or(z.literal("")),
  lines: z.array(lineSchema).min(1, "Your cart is empty.").max(50),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please check the highlighted fields.",
        // Field-level messages, so the form can show them next to each input.
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  // Attach the order to the signed-in user when there is one, so "my orders"
  // works. A signed-out visitor is allowed to check out as a guest.
  const session = await getSession();
  const userId = session?.user?.id;

  try {
    const order = await createOrder({
      lines: input.lines,
      email: input.email,
      shippingName: input.shippingName,
      shippingPhone: input.shippingPhone || undefined,
      shippingAddress: input.shippingAddress,
      shippingCity: input.shippingCity || undefined,
      shippingState: input.shippingState || undefined,
      userId,
    });

    const payment = await startPayment({
      reference: order.reference,
      email: order.email,
      amount: order.amount,
      // order.lines is priced by the database - this is what goes in the
      // gateway metadata, so it agrees with what the customer was charged.
      lines: order.lines,
      userId,
    });

    // ---- Simulated mode: no gateway, so settle it right here. ----
    if (payment.mode === "simulated") {
      const { order: paid, items } = await settleOrder(order.reference, null);

      await sendOrderConfirmation({
        to: paid.email,
        reference: paid.reference,
        customerName: paid.shipping_name,
        total: paid.amount,
        lines: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        })),
        shippingAddress: [paid.shipping_address, paid.shipping_city, paid.shipping_state]
          .filter(Boolean)
          .join("\n"),
        paidVia: "Simulated gateway (no PAYSTACK_SECRET_KEY set)",
      });

      return NextResponse.json({
        ok: true,
        mode: "simulated",
        reference: paid.reference,
        redirectTo: `/checkout/success?reference=${encodeURIComponent(paid.reference)}`,
      });
    }

    // ---- Real mode: send the customer to Paystack. ----
    return NextResponse.json({
      ok: true,
      mode: "redirect",
      reference: payment.reference,
      redirectTo: payment.authorizationUrl,
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[checkout] unexpected failure:", error);
    return NextResponse.json(
      { error: "Something went wrong starting your payment. Please try again." },
      { status: 500 },
    );
  }
}
