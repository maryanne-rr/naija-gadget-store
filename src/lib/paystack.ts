import "server-only";
import { env, paymentMode, type PaymentMode } from "./env";

/**
 * Payment gateway.
 *
 * Your brief said "Paystack or Flutterwave". This file is the only place that
 * knows which one we picked, so swapping the other in means editing this file
 * and nothing else - the checkout route deals in the neutral types below.
 *
 * Currently implemented: Paystack (test mode).
 *
 * Everything here is server-side on purpose. The Paystack secret key must
 * never reach the browser, otherwise anyone can issue refunds.
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

export type StartPaymentResult =
  | {
      /** Where to send the customer to pay. */
      mode: "redirect";
      authorizationUrl: string;
      reference: string;
      provider: string;
    }
  | {
      /**
       * No real gateway involved: the order is settled immediately and the
       * caller should treat it as paid.
       */
      mode: "simulated";
      reference: string;
      provider: string;
    };

export interface VerifyResult {
  paid: boolean;
  amount?: number;
  email?: string;
  provider: string;
  reference: string;
}

// ---------------------------------------------------------------------------
//  Order references
// ---------------------------------------------------------------------------

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1

/**
 * Build an order reference like `NAI-7QK4M2X9`.
 *
 * The alphabet above omits I, O, 0 and 1 on purpose - people read these
 * numbers off a screen and retype them into a search box, so anything that can
 * be mistaken for another character is a support ticket waiting to happen.
 */
export function generateOrderReference(prefix = "NAI"): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);

  const chars = Array.from(bytes, (b) => REFERENCE_ALPHABET[b % REFERENCE_ALPHABET.length]);
  return `${prefix}-${chars.join("")}`;
}

// ---------------------------------------------------------------------------
//  Paystack
// ---------------------------------------------------------------------------

const PAYSTACK_API = "https://api.paystack.co";

interface PaystackApiEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

interface PaystackInitializeData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface PaystackVerifyData {
  reference: string;
  status: "success" | "failed" | "abandoned" | "pending";
  amount: number;
  currency: string;
  email: string | null;
  paid_at: string | null;
}

async function paystackHeaders(): Promise<HeadersInit> {
  if (!env.paystackSecretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not set.");
  }
  return {
    Authorization: `Bearer ${env.paystackSecretKey}`,
    "Content-Type": "application/json",
  };
}

async function initializePaystack(input: StartPaymentInput): Promise<StartPaymentResult> {
  const callbackUrl = `${env.appUrl}/api/checkout/verify?reference=${encodeURIComponent(input.reference)}`;

  const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: await paystackHeaders(),
    body: JSON.stringify({
      email: input.email,
      amount: input.amount, // Kobo, as an integer
      currency: "NGN",
      reference: input.reference,
      callback_url: callbackUrl,
      metadata: {
        // Sent back to us on verify. Handy for reconciling in the dashboard.
        custom_fields: [
          { display_name: "Order reference", variable_name: "order_reference", value: input.reference },
          { display_name: "Customer email", variable_name: "customer_email", value: input.email },
        ],
        line_items: input.lines.map((line) => ({
          name: line.name,
          quantity: line.quantity,
          // Paystack's line_items.price is in the major unit (Naira).
          price: line.unitPrice / 100,
        })),
        user_id: input.userId ?? null,
      },
    }),
  });

  const payload = (await response.json()) as PaystackApiEnvelope<PaystackInitializeData>;

  if (!response.ok || !payload.status || !payload.data?.authorization_url) {
    throw new Error(`Paystack could not start the payment: ${payload.message ?? response.status}`);
  }

  return {
    mode: "redirect",
    authorizationUrl: payload.data.authorization_url,
    reference: payload.data.reference,
    provider: "paystack",
  };
}

async function verifyPaystack(reference: string): Promise<VerifyResult> {
  const response = await fetch(
    `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: await paystackHeaders(), cache: "no-store" },
  );

  const payload = (await response.json()) as PaystackApiEnvelope<PaystackVerifyData>;

  if (!response.ok || !payload.status || !payload.data) {
    throw new Error(`Paystack could not verify the transaction: ${payload.message ?? response.status}`);
  }

  return {
    paid: payload.data.status === "success",
    amount: payload.data.amount,
    email: payload.data.email ?? undefined,
    provider: "paystack",
    reference: payload.data.reference,
  };
}

// ---------------------------------------------------------------------------
//  Public API - routes call only these two functions
// ---------------------------------------------------------------------------

export function currentPaymentMode(): PaymentMode {
  return paymentMode;
}

/**
 * Begin a payment.
 *
 * Without a Paystack key this returns the simulated branch instead of throwing,
 * so the checkout flow stays fully demoable on an unconfigured machine.
 */
export async function startPayment(input: StartPaymentInput): Promise<StartPaymentResult> {
  if (paymentMode === "simulated") {
    return { mode: "simulated", reference: input.reference, provider: "simulated" };
  }
  return initializePaystack(input);
}

/** Confirm with the gateway that money actually changed hands. */
export async function verifyPayment(reference: string): Promise<VerifyResult> {
  if (paymentMode === "simulated") {
    return { paid: true, provider: "simulated", reference };
  }
  return verifyPaystack(reference);
}

// ---------------------------------------------------------------------------
//  Swapping in Flutterwave
// ---------------------------------------------------------------------------
//
//  If your brief ends up saying Flutterwave instead, only these three functions
//  need to change. The two API shapes to work from:
//
//    Initialise  POST https://api.flutterwave.com/v3/payments
//      Authorization: Bearer FLWSECK_TEST-<key>
//      { tx_ref, amount, currency: "NGN", redirect_url, customer:
//        { email_address, name }, customizations:
//        { redirect_url } }
//      -> { status, data: { link } }        <- `link` is where you redirect
//
//    Verify     GET https://api.flutterwave.com/v3/transactions/{tx_ref}
//      Authorization: Bearer FLWSECK_TEST-<key>
//      -> { status, data: { status: "successful", amount, tx_ref,
//                           customer: { email_address } } }
//
//  Amounts on Flutterwave are in the MAJOR unit (Naira), not Kobo - so divide
//  by 100 on the way out and multiply by 100 on the way in. Easy thing to get
//  backwards and very hard to spot, because N2,500.00 looks plausible as 2500.
