import Link from "next/link";
import { getOrderByReference, getOrderItems } from "@/lib/orders";
import { integrations } from "@/lib/env";
import { formatNaira } from "@/lib/money";

/**
 * Order confirmation.
 *
 * Reached either by the /api/checkout/verify callback (real Paystack) or
 * straight from /api/checkout when running in simulated mode.
 *
 * A note on privacy: this page looks the order up by its reference alone, with
 * no session check. That is acceptable here because the reference is eight
 * random characters from a 32-character alphabet - about a trillion
 * combinations, so it cannot realistically be guessed. For a production shop,
 * require a signed-in user whose id matches the order's user_id instead.
 */

export const metadata = { title: "Order confirmed" };

export default async function SuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  const params = await searchParams;
  const reference = typeof params.reference === "string" ? params.reference : null;

  // Without the database there is no order to look up, and the query helper
  // would throw. Say so plainly instead of showing a 500.
  if (!integrations.database) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Order details unavailable</h1>
        <p className="mt-2 text-ink-500">
          Supabase is not connected, so orders are not being stored. Set the keys in{" "}
          <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">.env.local</code> and run{" "}
          <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">supabase/schema.sql</code>.
        </p>
      </Shell>
    );
  }

  if (!reference) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">No order reference</h1>
        <p className="mt-2 text-ink-500">
          This page needs an order reference. If you have just paid, check your email for the
          confirmation.
        </p>
      </Shell>
    );
  }

  const order = await getOrderByReference(reference);

  if (!order) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Order not found</h1>
        <p className="mt-2 text-ink-500">
          We have no record of <code className="rounded bg-ink-100 px-1 dark:bg-ink-800">{reference}</code>.
        </p>
      </Shell>
    );
  }

  const items = await getOrderItems(order.id);

  return (
    <Shell>
      <div className="text-center">
        <p className="text-5xl" aria-hidden="true">
          {order.status === "paid" ? "✅" : "⏳"}
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          {order.status === "paid" ? "Payment confirmed" : "Order received"}
        </h1>
        <p className="mt-2 text-ink-500">
          {order.status === "paid"
            ? "Thanks! A confirmation is on its way to your email."
            : "We are waiting for the payment to clear."}
        </p>
      </div>

      <div className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-800">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-200 pb-4 dark:border-ink-700">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-500">Order reference</p>
            <p className="font-mono text-lg font-semibold">{order.reference}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
              order.status === "paid"
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200"
            }`}
          >
            {order.status}
          </span>
        </div>

        <ul className="divide-y divide-ink-200 dark:divide-ink-700">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
              <span>
                {item.name} <span className="text-ink-400">&times; {item.quantity}</span>
              </span>
              <span className="tabular-nums">{formatNaira(item.unit_price * item.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-between border-t border-ink-200 pt-4 text-lg font-bold dark:border-ink-700">
          <span>Total</span>
          <span className="tabular-nums">{formatNaira(order.amount)}</span>
        </div>

        <div className="mt-4 text-sm text-ink-500">
          <p className="font-medium text-ink-700 dark:text-ink-200">Delivering to</p>
          <p className="whitespace-pre-line">
            {order.shipping_name}
            {"\n"}
            {order.shipping_address}
            {order.shipping_city ? `, ${order.shipping_city}` : ""}
            {order.shipping_state ? `, ${order.shipping_state}` : ""}
          </p>
          {order.payment_reference && (
            <p className="mt-2 text-xs">
              Payment reference:{" "}
              <code className="font-mono">{order.payment_reference}</code>
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-ink-900 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Keep shopping
        </Link>
        <Link
          href="/orders"
          className="rounded-lg border border-ink-300 px-5 py-2.5 font-semibold hover:bg-ink-100 dark:border-ink-600 dark:hover:bg-ink-800"
        >
          All orders
        </Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {children}
    </div>
  );
}
