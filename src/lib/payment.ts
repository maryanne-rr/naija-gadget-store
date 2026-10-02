import "server-only";

/**
 * Dummy payment gateway.
 *
 * There is no real payment provider here and no keys to configure. Checkout
 * still runs the full shape of a real payment flow - create the order, send the
 * customer to a payment page, get them back to a verification endpoint - so the
 * surrounding code is the same code you would ship with a real gateway.
 *
 * WHERE A REAL GATEWAY WOULD SLOT IN
 * -----------------------------------
 * Paystack:
 *   initialize -> POST api.paystack.co/transaction/initialize  -> authorization_url
 *   verify     -> GET  api.paystack.co/transaction/verify/{ref} -> data.status
 *
 * Flutterwave:
 *   initialize -> POST api.flutterwave.com/v3/payments          -> data.link
 *   verify     -> GET  api.flutterwave.com/v3/transactions/{ref}
 *
 * Swap the two functions below and the rest of the app does not change. Note
 * that Flutterwave quotes amounts in Naira while Paystack quotes Kobo; getting
 * that backwards is easy and produces prices that look almost plausible.
 */

export interface CheckoutLine {
  productId: string;
  name: string;
  /** Integer Kobo. */
  unitPrice: number;
  quantity: number;
}

export interface StartPaymentInput {
  reference: string;
  email: string;
  /** Integer Kobo. */
  amount: number;
  lines: CheckoutLine[];
  userId?: string;
}

export interface StartPaymentResult {
  /** Where to send the customer to pay. */
  redirectTo: string;
  reference: string;
  provider: string;
}

export interface VerifyResult {
  paid: boolean;
  /** Integer Kobo. */
  amount?: number;
  provider: string;
  reference: string;
}

export const PAYMENT_PROVIDER = "dummy";

// ---------------------------------------------------------------------------
//  Order references
// ---------------------------------------------------------------------------

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1

/**
 * Build an order reference like `NAI-7QK4M2X9`.
 *
 * The alphabet omits I, O, 0 and 1 on purpose. People read these off a screen
 * and retype them into a search box, so any character that can be mistaken for
 * another one is a support ticket waiting to happen.
 */
export function generateOrderReference(prefix = "NAI"): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  const chars = Array.from(bytes, (b) => REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length]);
  return `${prefix}-${chars.join("")}`;
}

// ---------------------------------------------------------------------------
//  The two functions a gateway has to provide
// ---------------------------------------------------------------------------

/** Create the transaction and return where the customer should go to pay. */
export function startPayment(input: StartPaymentInput, origin: string): StartPaymentResult {
  void input;

  // With a real gateway this would be an HTTP call, and the customer would be
  // redirected off-site to the bank's page.
  return {
    redirectTo: `${origin}/checkout/pay?reference=${encodeURIComponent(input.reference)}`,
    reference: input.reference,
    provider: PAYMENT_PROVIDER,
  };
}

/**
 * Confirm that the money actually changed hands.
 *
 * With a dummy gateway this always succeeds, which is the one thing a real
 * implementation must never do: the caller would be trusting the redirect URL,
 * and anyone can type that URL by hand.
 *
 * A real version asks the provider's API and reads its verdict:
 *
 *   const res = await fetch(`${PAYSTACK_API}/transaction/verify/${reference}`, {
 *     headers: { Authorization: `Bearer ${env.paystackSecretKey}` },
 *     cache: "no-store",
 *   });
 *   const body = await res.json();
 *   return { paid: body.data?.status === "success", amount: body.data?.amount, ... };
 *
 * ...and then compares that amount against the order total before settling.
 */
export function verifyPayment(reference: string): VerifyResult {
  return { paid: true, provider: PAYMENT_PROVIDER, reference };
}
