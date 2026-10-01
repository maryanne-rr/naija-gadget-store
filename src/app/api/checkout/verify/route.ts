import { NextResponse, type NextRequest } from "next/server";
import { getOrderByReference, settleOrder } from "@/lib/orders";
import { verifyPayment } from "@/lib/paystack";
import { sendOrderConfirmation } from "@/lib/mail";

/**
 * GET /api/checkout/verify?reference=NAI-XXXX
 *
 * Paystack sends the customer back here after they have paid. This route:
 *   1. asks Paystack what actually happened (never trust the redirect alone -
 *      anyone can type this URL with any reference),
 *   2. checks the amount Paystack received matches our order total,
 *   3. marks the order paid and takes stock off the shelf,
 *   4. emails the confirmation,
 *   5. sends the customer to a real page.
 *
 * Step 2 is the one people skip. Without it, someone could start a 50,000
 * naira order, pay 1 nara, and then hit this URL to collect the goods.
 */

function redirect(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference");

  if (!reference) {
    return redirect("/checkout?error=missing-reference", request);
  }

  const order = await getOrderByReference(reference);

  if (!order) {
    console.warn(`[verify] no order found for reference ${reference}`);
    return redirect("/checkout?error=unknown-order", request);
  }

  try {
    const payment = await verifyPayment(reference);

    if (!payment.paid) {
      console.warn(`[verify] payment not completed for ${reference}`);
      return redirect(`/checkout?error=payment-failed&reference=${encodeURIComponent(reference)}`, request);
    }

    // ---- The amount check. Do not remove this. ----
    if (typeof payment.amount === "number" && payment.amount !== order.amount) {
      console.error(
        `[verify] AMOUNT MISMATCH for ${reference}: ` +
          `Paystack received ${payment.amount} kobo but the order total is ${order.amount} kobo. ` +
          `Not settling the order.`,
      );
      return redirect(`/checkout?error=amount-mismatch&reference=${encodeURIComponent(reference)}`, request);
    }

    const { order: paid, items, alreadySettled } = await settleOrder(reference, payment.reference);

    // Only email on the transition, not on every repeated callback.
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
        paidVia: payment.provider === "paystack" ? "Paystack" : "Simulated gateway",
      });

      if (!email.sent) {
        // The order is paid either way, so do not block the customer. Record it
        // so you can resend later.
        console.warn(
          `[verify] order ${reference} is paid but the confirmation email did not send: ${email.error}`,
        );
      }
    }

    return redirect(`/checkout/success?reference=${encodeURIComponent(paid.reference)}`, request);
  } catch (error) {
    console.error(`[verify] failed for ${reference}:`, error);
    return redirect(`/checkout?error=verification-failed&reference=${encodeURIComponent(reference)}`, request);
  }
}
