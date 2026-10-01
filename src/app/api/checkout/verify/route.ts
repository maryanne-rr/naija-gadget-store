import { NextResponse } from "next/server";
import { getOrderByReference, settleOrder } from "@/lib/orders";
import { verifyPayment } from "@/lib/payment";
import { sendOrderConfirmation } from "@/lib/mail";

/**
 * POST /api/checkout/verify  { reference }
 *
 * The payment step completed, so this is where the order actually becomes real:
 *   1. find the order by reference
 *   2. confirm the payment with the gateway
 *   3. mark it paid and take stock off the shelf
 *   4. email the confirmation
 *   5. send the customer to their receipt
 *
 * WHY THIS IS A SEPARATE STEP FROM /api/checkout
 * Creating an order and taking money for it are different events. Keeping them
 * apart means an abandoned or abandoned-at-the-payment-page order can sit as
 * 'pending' and be cleaned up later, rather than looking like a sale.
 *
 * WHY YOU WOULD NOT TRUST THE REDIRECT WITH A REAL GATEWAY
 * With Paystack, the customer returns here by following a link - and anyone can
 * type that link by hand with any reference. The only trustworthy source is the
 * gateway's own API, so a real implementation calls verify and then compares the
 * amount Paystack received against the order total before settling. Both are
 * marked in lib/payment.ts.
 */

export async function POST(request: Request) {
  let reference: string | null = null;

  try {
    const body = (await request.json()) as { reference?: unknown };
    if (typeof body.reference === "string") {
      reference = body.reference;
    }
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  if (!reference) {
    return NextResponse.json({ error: "Missing order reference." }, { status: 400 });
  }

  const order = await getOrderByReference(reference);

  if (!order) {
    return NextResponse.json({ error: "We could not find that order." }, { status: 404 });
  }

  try {
    const payment = verifyPayment(reference);

    if (!payment.paid) {
      return NextResponse.json(
        { error: "That payment was not completed. No money has left your account." },
        { status: 402 },
      );
    }

    // A real gateway would be asked for the amount it received, and compared
    // here against order.amount before we settle anything.
    if (typeof payment.amount === "number" && payment.amount !== order.amount) {
      console.error(
        `[verify] amount mismatch for ${reference}: gateway reported ${payment.amount} kobo, ` +
          `order total is ${order.amount} kobo. Not settling.`,
      );
      return NextResponse.json(
        { error: "The amount received did not match the order total. Contact support." },
        { status: 409 },
      );
    }

    const { order: paid, items, alreadySettled } = await settleOrder(reference, payment.reference);

    // Only email on the transition, so a refresh cannot send it twice.
    if (!alreadySettled) {
      const email = await sendOrderConfirmation({
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
        paidVia: "Test payment gateway",
      });

      if (!email.sent) {
        // The order is paid either way, so do not block the customer. Log it so
        // the message can be resent later.
        console.warn(
          `[verify] order ${reference} is paid but the confirmation email did not send: ${email.error}`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      reference: paid.reference,
      redirectTo: `/checkout/success?reference=${encodeURIComponent(paid.reference)}`,
    });
  } catch (error) {
    console.error(`[verify] failed for ${reference}:`, error);
    return NextResponse.json(
      { error: "We could not confirm the payment. Please contact support." },
      { status: 500 },
    );
  }
}
