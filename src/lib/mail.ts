import "server-only";
import { env, integrations } from "./env";
import { formatNaira } from "./money";

/**
 * Order confirmation email via Mailgun.
 *
 * WHY THE HTTP API AND NOT SMTP
 * Mailgun still offers SMTP, but authenticating it with an HTTP API key is
 * fussy and fails with a bare "535 Authentication failed" that gives you
 * nothing to act on. Their HTTPS API is the documented primary path, needs no
 * extra dependency, and returns a real error message.
 *
 * If Mailgun keys are missing, sendOrderConfirmation logs and returns instead of
 * throwing: a failed email must never take down a successful order.
 */

const API_ROOT = "https://api.mailgun.net/v3";

export interface ConfirmationLine {
  name: string;
  quantity: number;
  /** Integer Kobo. */
  unitPrice: number;
}

export interface OrderConfirmation {
  to: string;
  reference: string;
  customerName: string;
  /** Integer Kobo. */
  total: number;
  lines: ConfirmationLine[];
  shippingAddress: string;
  paidVia: string;
}

export interface SendResult {
  sent: boolean;
  messageId?: string;
  /** Set when the email could not be sent. */
  error?: string;
  /**
   * A human-readable explanation, when there is one worth showing a human.
   *
   * `error` is a short machine-readable token - "sandbox-domain-restriction" -
   * so a caller can branch on it, and this carries the sentence that says what
   * to actually do about it. Kept separate so nothing accidentally surfaces a
   * raw provider response to a customer.
   */
  detail?: string;
}

/** Escape anything customer-supplied before putting it in HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(order: OrderConfirmation): string {
  const rows = order.lines
    .map(
      (line) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
            ${escapeHtml(line.name)}
            <span style="color:#6b7280;">&times; ${line.quantity}</span>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">
            ${formatNaira(line.unitPrice * line.quantity)}
          </td>
        </tr>`,
    )
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
      <h1 style="font-size:22px;margin:0 0 4px;">Thanks, ${escapeHtml(order.customerName)}!</h1>
      <p style="color:#6b7280;margin:0 0 24px;">
        We have your order and payment. Here is what you bought.
      </p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Order reference</p>
        <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;font-weight:600;">
          ${escapeHtml(order.reference)}
        </p>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:15px;">
        ${rows}
        <tr>
          <td style="padding:14px 0;font-weight:600;">Total paid</td>
          <td style="padding:14px 0;text-align:right;font-weight:600;white-space:nowrap;">
            ${formatNaira(order.total)}
          </td>
        </tr>
      </table>

      <div style="margin-top:24px;font-size:14px;color:#374151;">
        <p style="margin:0 0 4px;font-weight:600;">Delivering to</p>
        <p style="margin:0 0 16px;white-space:pre-line;">${escapeHtml(order.shippingAddress)}</p>
        <p style="margin:0;color:#6b7280;font-size:13px;">Paid via ${escapeHtml(order.paidVia)}</p>
      </div>

      <p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">
        Naija Gadget Store &middot; Lagos, Nigeria
      </p>
    </div>
  `;
}

function renderText(order: OrderConfirmation): string {
  const lines = order.lines
    .map((l) => `  ${l.quantity} x ${l.name}  ${formatNaira(l.unitPrice * l.quantity)}`)
    .join("\n");

  return [
    `Thanks, ${order.customerName}!`,
    "",
    `We have your order and payment.`,
    "",
    `Order reference: ${order.reference}`,
    "",
    lines,
    `  Total paid: ${formatNaira(order.total)}`,
    "",
    "Delivering to:",
    order.shippingAddress,
    "",
    `Paid via ${order.paidVia}`,
    "",
    "Naija Gadget Store, Lagos, Nigeria",
  ].join("\n");
}

export async function sendOrderConfirmation(order: OrderConfirmation): Promise<SendResult> {
  const subject = `Your Naija Gadget Store order ${order.reference} is confirmed`;

  if (!integrations.mailgun) {
    console.warn(
      `[mail] Mailgun not configured, skipping email to ${order.to}. Subject: ${subject}`,
    );
    return {
      sent: false,
      error: "Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN in .env.local.",
    };
  }

  try {
    const response = await fetch(`${API_ROOT}/${env.mailgunDomain}/messages`, {
      method: "POST",
      headers: {
        // Mailgun HTTP API: HTTP Basic, username "api", password is the key.
        Authorization: `Basic ${Buffer.from(`api:${env.mailgunApiKey}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        from: env.mailFrom,
        to: order.to,
        subject,
        html: renderHtml(order),
        text: renderText(order),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mailgun HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    const result = (await response.json()) as { id?: string; message?: string };
    console.log(`[mail] Confirmation for ${order.reference} accepted by Mailgun -> ${order.to}`);
    return { sent: true, messageId: result.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Mailgun's free tier hands you a *sandbox* domain, and a sandbox domain may
    // only send to the account owner's own verified address plus whatever has
    // been added as an authorised recipient. Anything else is refused with a 403
    // and a message that reads like a support article.
    //
    // That refusal looks exactly like a bug in the shop - "why did my colleague
    // not get the email?" - so it is worth naming here rather than leaving it as
    // "Mailgun HTTP 403" in the log. Verified against the live domain:
    //
    //   to the owner address              -> 200 {"message":"Queued. Thank you."}
    //   to any other address               -> 403 "Domain sandbox... is not allowed
    //                                          to send: Free accounts are for test
    //                                          purposes only."
    //
    // Fix is in the Mailgun dashboard, not here: Sending -> Domains -> the sandbox
    // domain -> Authorised recipients, and add the address. Or attach a real
    // domain, which lifts the restriction entirely.
    if (/\bis not allowed to send\b|\btest purposes only\b/.test(message)) {
      const hint =
        `[mail] Mailgun refused ${order.to} for order ${order.reference}: this is a ` +
        `SANDBOX domain, which may only send to the account owner's address and to ` +
        `addresses added under Sending -> Domains -> ${env.mailgunDomain} -> ` +
        `Authorised recipients. Add the recipient there, or attach a real domain.`;

      console.error(hint);
      return { sent: false, error: "sandbox-domain-restriction", detail: hint };
    }

    console.error(`[mail] Failed to send confirmation for ${order.reference}: ${message}`);
    return { sent: false, error: message };
  }
}
