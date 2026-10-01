import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, integrations } from "./env";
import { formatNaira } from "./money";

/**
 * Order confirmation email via Mailgun.
 *
 * Mailgun talks SMTP on smtp.mailgun.org:587. The username is always
 * postmaster@<your domain> and the password is the API key - not a password you
 * set yourself.
 *
 * If the keys are missing, `sendOrderConfirmation` logs a preview instead of
 * throwing. A failed email must never take down a successful order.
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!env.mailgunApiKey || !env.mailgunDomain) {
    throw new Error("Mailgun is not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN missing).");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.mailgun.org",
      port: 587,
      // 587 is STARTTLS, not implicit TLS, so `secure` is false and TLS is
      // negotiated by nodemailer after the connection opens.
      secure: false,
      requireTLS: true,
      auth: {
        user: `postmaster@${env.mailgunDomain}`,
        pass: env.mailgunApiKey,
      },
    });
  }

  return transporter;
}

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
  /** Set when the email could not be sent; the preview is logged instead. */
  error?: string;
}

/** Escape anything that came from a customer before putting it in HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSubject(order: OrderConfirmation): string {
  return `Your Naija Gadget Store order ${order.reference} is confirmed`;
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

  // .replace with a function, so a literal "$&" in a product name cannot
  // resurrect itself as a substitution pattern.
  const body = `
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

  return body.replace(/\$&/g, "$$&&");
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
  const subject = renderSubject(order);
  const html = renderHtml(order);
  const text = renderText(order);

  if (!integrations.mailgun) {
    console.warn(
      `[mail] Mailgun not configured, skipping email to ${order.to}.\n` +
        `       Subject: ${subject}`,
    );
    return {
      sent: false,
      error:
        "Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN in .env.local to send real emails.",
    };
  }

  try {
    const info = await getTransporter().sendMail({
      from: env.mailFrom,
      to: order.to,
      subject,
      html,
      text,
    });

    console.log(`[mail] Order confirmation ${order.reference} sent to ${order.to}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mail] Failed to send confirmation for ${order.reference}:`, message);
    return { sent: false, error: message };
  }
}
