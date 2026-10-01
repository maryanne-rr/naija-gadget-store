import Link from "next/link";
import { connection } from "next/server";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { getSession } from "@/lib/auth";
import { integrations } from "@/lib/env";
import { listOrdersForUser, listItemsForOrders } from "@/lib/orders";
import { formatNaira } from "@/lib/money";

/**
 * Order history for the signed-in customer.
 *
 * The query is scoped by `user_id` from the session, never by anything the URL
 * or the browser supplies. Passing an id in the query string and filtering on
 * it would let anyone read everybody's orders - that mistake (IDOR) is one of
 * the most common in real applications.
 */

export const metadata = { title: "Your orders" };

export default async function OrdersPage() {
  // Stop prerendering here. This page shows one specific person's orders, so it
  // must never be baked into a static file at build time and served to whoever
  // asks for it next.
  //
  // This is needed explicitly because getSession() short-circuits when Google is
  // not configured yet, so Next.js never sees a cookies() read and wrongly
  // marks the page static. connection() is the supported way to say "this is
  // per-request" in Next.js 16.
  await connection();

  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-bold">Sign in to see your orders</h1>
        <p className="mt-2 text-ink-500">
          Your order history is tied to your Google account.
        </p>
        <div className="mt-6">
          <GoogleSignInButton
            label="Sign in with Google"
            className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
          />
        </div>
      </div>
    );
  }

  if (!integrations.database) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <p className="font-semibold">Orders need the database</p>
        <p className="mt-1">
          Set the Supabase keys in <code>.env.local</code> and run{" "}
          <code>supabase/schema.sql</code>. See README.md &rsaquo; 1. Supabase.
        </p>
      </div>
    );
  }

  const orders = await listOrdersForUser(userId);
  const items = await listItemsForOrders(orders.map((order) => order.id));

  // Group line items under their order in one pass.
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const bucket = itemsByOrder.get(item.order_id);
    if (bucket) bucket.push(item);
    else itemsByOrder.set(item.order_id, [item]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Your orders</h1>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-ink-200 bg-white p-10 text-center dark:border-ink-700 dark:bg-ink-800">
          <p className="font-medium">No orders yet</p>
          <p className="mt-1 text-sm text-ink-500">
            Anything you buy while signed in shows up here.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-lg bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-800"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-200 pb-3 dark:border-ink-700">
                <div>
                  <p className="font-mono font-semibold">{order.reference}</p>
                  <p className="text-xs text-ink-500">
                    {new Date(order.created_at).toLocaleDateString("en-NG", {
                      dateStyle: "long",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                      order.status === "paid"
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200"
                        : order.status === "pending"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                    }`}
                  >
                    {order.status}
                  </span>
                  <span className="font-bold tabular-nums">{formatNaira(order.amount)}</span>
                </div>
              </div>

              <ul className="mt-3 space-y-1 text-sm">
                {(itemsByOrder.get(order.id) ?? []).map((item) => (
                  <li key={item.id} className="flex justify-between gap-4 text-ink-600 dark:text-ink-300">
                    <span>
                      {item.name} <span className="text-ink-400">&times; {item.quantity}</span>
                    </span>
                    <span className="tabular-nums">
                      {formatNaira(item.unit_price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-xs text-ink-400">
                <Link
                  href={`/checkout/success?reference=${encodeURIComponent(order.reference)}`}
                  className="underline"
                >
                  View full receipt
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
