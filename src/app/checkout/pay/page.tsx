import Link from "next/link";
import { getOrderByReference, getOrderItems } from "@/lib/orders";
import { integrations } from "@/lib/env";
import { formatNaira } from "@/lib/money";
import { PayButton } from "./PayButton";

/**
 * The payment page.
 *
 * This stands in for a bank's hosted checkout. With a real gateway the customer
 * would be redirected off-site to Paystack or Flutterwave and would come back to
 * /api/checkout/verify. Here the page is ours, so it renders the order summary
 * and a Pay button instead of collecting card details.
 *
 * It is deliberately styled to look like a payment screen rather than part of
 * the shop, so the demo reads as "the customer left the site to pay" - which is
 * what actually happens in production.
 */

export const metadata = { title: "Payment" };

export default async function PayPage({ searchParams }: PageProps<"/checkout/pay">) {
  const params = await searchParams;
  const reference = typeof params.reference === "string" ? params.reference : null;

  if (!integrations.database) {
    return (
      <Card>
        <h1 className="text-xl font-bold">Payment unavailable</h1>
        <p className="mt-2 text-sm text-ink-600">
          Supabase is not connected, so orders cannot be saved. Set the keys in{" "}
          <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">.env.local</code> and run{" "}
          <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">supabase/schema.sql</code>.
        </p>
        <Link href="/" className="mt-5 inline-block text-sm underline">
          Back to the shop
        </Link>
      </Card>
    );
  }

  if (!reference) {
    return (
      <Card>
        <h1 className="text-xl font-bold">No order reference</h1>
        <Link href="/cart" className="mt-4 inline-block text-sm underline">
          Back to your cart
        </Link>
      </Card>
    );
  }

  const order = await getOrderByReference(reference);

  if (!order) {
    return (
      <Card>
        <h1 className="text-xl font-bold">Order not found</h1>
        <p className="mt-2 text-sm text-ink-600">
          We have no record of{" "}
          <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">{reference}</code>.
        </p>
        <Link href="/cart" className="mt-4 inline-block text-sm underline">
          Back to your cart
        </Link>
      </Card>
    );
  }

  // Already paid - do not let anyone "pay" twice and double-charge.
  if (order.status === "paid") {
    return (
      <Card>
        <div className="text-center">
          <p className="text-4xl" aria-hidden="true">
            ✅
          </p>
          <h1 className="mt-3 text-xl font-bold">Already paid</h1>
          <p className="mt-2 text-sm text-ink-600">This order has already been settled.</p>
          <Link
            href={`/checkout/success?reference=${encodeURIComponent(order.reference)}`}
            className="mt-5 inline-block rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
          >
            View receipt
          </Link>
        </div>
      </Card>
    );
  }

  const items = await getOrderItems(order.id);

  return (
    <Card>
      <h1 className="text-xl font-bold">Pay {formatNaira(order.amount)}</h1>
      <p className="mt-1 text-sm text-ink-500">
        Order <span className="font-mono">{order.reference}</span> for {order.email}
      </p>

      <ul className="mt-6 divide-y divide-ink-200 border-y border-ink-200 dark:divide-ink-700 dark:border-ink-700">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
            <span>
              {item.name} <span className="text-ink-400">&times; {item.quantity}</span>
            </span>
            <span className="tabular-nums">{formatNaira(item.unit_price * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-baseline justify-between text-lg">
        <span className="font-semibold">Total</span>
        <span className="font-bold tabular-nums">{formatNaira(order.amount)}</span>
      </div>

      <PayButton reference={order.reference} amount={order.amount} />

      <p className="mt-3 text-center text-xs">
        <Link href="/cart" className="text-ink-500 underline">
          Cancel and go back
        </Link>
      </p>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm dark:border-ink-700 dark:bg-ink-800">
        {children}
      </div>
    </div>
  );
}
