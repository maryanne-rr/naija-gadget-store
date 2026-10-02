import Link from "next/link";
import { connection } from "next/server";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { getSession } from "@/lib/auth";
import { integrations } from "@/lib/env";
import {
  listOrdersForUser,
  listItemsForOrders,
  findOrderForGuest,
  findOrderByReference,
  getOrderItems,
} from "@/lib/orders";
import { formatNaira } from "@/lib/money";
import { trackOrder } from "@/app/actions";
import { TRACKED_ORDER_COOKIE } from "@/lib/orders";
import { cookies } from "next/headers";

/**
 * Order history and order tracking.
 *
 * SERVES TWO DIFFERENT PEOPLE, WHICH IS WHY IT LOOKS LIKE TWO PAGES
 *
 * A signed-in customer sees every order they have placed, scoped by user_id
 * from the session and by nothing the URL or the browser supplies. Passing an id
 * in the query string and filtering on it would let anyone read anybody's
 * orders - that mistake (IDOR) is one of the most common in real applications.
 *
 * A guest sees one order, looked up by its reference AND the email it was placed
 * with. Checkout never requires an account, so most orders have no user_id at
 * all and the signed-in list is empty for them - which would make "track your
 * order" untrue for exactly the customers most likely to want it. See
 * findOrderForGuest for why both values are required.
 */

export const metadata = { title: "Your orders" };

/** The status pill. One place, so a pending order looks the same everywhere. */
function StatusPill({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200"
      : status === "pending"
        ? "bg-signal-100 text-signal-700 dark:bg-ink-800 dark:text-signal-300"
        : "bg-alert-50 text-alert-500 dark:bg-ink-800 dark:text-alert-500";

  return (
    <span className={`rounded-card px-3 py-1 text-xs font-semibold uppercase ${tone}`}>
      {status}
    </span>
  );
}

function OrderCard({
  order,
  items,
}: {
  // Nullable rather than optional, because Postgres returns null for a column
  // that was never filled in - which is not the same thing as "the key is
  // missing", and treating it as such hides the difference.
  order: {
    id: string;
    reference: string;
    status: string;
    amount: number;
    created_at: string;
    shipping_name?: string | null;
    shipping_city?: string | null;
    shipping_phone?: string | null;
  };
  items: { id: string; name: string; quantity: number; unit_price: number }[];
}) {
  return (
    <li className="rounded-card border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-200 pb-3 dark:border-ink-700">
        <div>
          <p className="font-mono font-semibold">{order.reference}</p>
          <p className="text-xs text-ink-500">
            {new Date(order.created_at).toLocaleDateString("en-NG", { dateStyle: "long" })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusPill status={order.status} />
          <span className="font-bold tabular-nums">{formatNaira(order.amount)}</span>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex justify-between gap-4 text-ink-600 dark:text-ink-300"
          >
            <span>
              {item.name} <span className="text-ink-400">&times; {item.quantity}</span>
            </span>
            <span className="tabular-nums">{formatNaira(item.unit_price * item.quantity)}</span>
          </li>
        ))}
      </ul>

      {order.shipping_name && (
        <p className="mt-3 text-xs text-ink-500">
          Delivering to {order.shipping_name}
          {order.shipping_city ? `, ${order.shipping_city}` : ""}
          {order.shipping_phone ? ` · ${order.shipping_phone}` : ""}
        </p>
      )}

      <p className="mt-3 text-xs text-ink-400">
        <Link
          href={`/checkout/success?reference=${encodeURIComponent(order.reference)}`}
          className="underline"
        >
          View full receipt
        </Link>
      </p>
    </li>
  );
}

/** The guest lookup form. Posts, so the email never reaches the URL. */
function TrackForm({ error }: { error: string | null }) {
  return (
    <form
      id="track"
      action={trackOrder}
      className="scroll-mt-28 rounded-card border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900"
    >
      <h2 className="font-semibold">Track an order</h2>
      <p className="mt-1 text-sm text-ink-500">
        Enter the reference from your receipt and the email you used.
      </p>

      {error && (
        <p className="mt-3 rounded-card border border-alert-500/40 bg-alert-50 px-3 py-2 text-sm text-alert-500 dark:bg-ink-800 dark:text-alert-500">
          {error === "missing"
            ? "Enter both the order reference and your email address."
            : "No order matches that reference and email. Check both and try again."}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Order reference</span>
          <input
            name="reference"
            required
            placeholder="NAI-XXXXXXXX"
            autoComplete="off"
            className="mt-1 w-full rounded-card border border-ink-300 bg-white px-3 py-2 font-mono text-sm uppercase dark:border-ink-600 dark:bg-ink-800"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Email used at checkout</span>
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            className="mt-1 w-full rounded-card border border-ink-300 bg-white px-3 py-2 text-sm dark:border-ink-600 dark:bg-ink-800"
          />
        </label>
      </div>

      <button
        type="submit"
        className="mt-4 rounded-card bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Find my order
      </button>
    </form>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Stop prerendering here. This page shows one specific person's orders, so it
  // must never be baked into a static file at build time and served to whoever
  // asks for it next.
  //
  // This is needed explicitly because getSession() short-circuits when Google is
  // not configured yet, so Next.js never sees a cookies() read and wrongly
  // marks the page static. connection() is the supported way to say "this is
  // per-request" in Next.js 16.
  await connection();

  const params = await searchParams;
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const error = first("error") ?? null;

  const session = await getSession();
  const userId = session?.user?.id;

  if (!integrations.database) {
    return (
      <div className="mx-auto max-w-2xl rounded-card border border-signal-300 bg-signal-50 p-6 text-sm text-signal-700 dark:bg-ink-900 dark:text-signal-300">
        <p className="font-semibold">Orders need the database</p>
        <p className="mt-1">
          Set the Supabase keys in <code>.env.local</code> and run{" "}
          <code>supabase/schema.sql</code>. See README.md &rsaquo; 1. Supabase.
        </p>
      </div>
    );
  }

  // ---- A guest has just looked one up ----
  //
  // The cookie is the authorisation. It can only exist because trackOrder has
  // already checked the reference against the email it was placed with, and it
  // is deleted here as it is read, so it cannot be replayed for a second order
  // or left behind on a shared machine.
  let tracked:
    | { order: NonNullable<Awaited<ReturnType<typeof findOrderForGuest>>>; items: Awaited<ReturnType<typeof getOrderItems>> }
    | null = null;

  const proof = (await cookies()).get(TRACKED_ORDER_COOKIE)?.value;

  // Read-only here. The cookie is cleared inside trackOrder instead, because a
  // page render may not modify cookies - Next.js throws
  // "Cookies can only be modified in a Server Action or Route Handler" - and an
  // attempted jar.delete() takes the whole page down with a 500. It used to.
  if (proof) {
    const order = await findOrderByReference(proof);
    if (order) tracked = { order, items: await getOrderItems(order.id) };
  }

  // ---- Signed-in customer ----
  const orders = userId ? await listOrdersForUser(userId) : [];
  const items = orders.length > 0 ? await listItemsForOrders(orders.map((o) => o.id)) : [];

  // Group line items under their order in one pass.
  const itemsByOrder = new Map<string, typeof items>();
  for (const item of items) {
    const bucket = itemsByOrder.get(item.order_id);
    if (bucket) bucket.push(item);
    else itemsByOrder.set(item.order_id, [item]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>

        {/* The tracking action lives here rather than in the header, which just
            names the destination. Somebody who has just paid arrives on this
            page wanting to check on one order, and this is where that button
            belongs - it is also the only entry point a guest needs, since they
            have no session and would otherwise see nothing but the form. */}
        <a
          href="#track"
          className="rounded-card border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-800 transition-colors hover:border-brand-400 hover:text-brand-700 dark:border-ink-600 dark:text-ink-100"
        >
          Track order
        </a>
      </div>

      {/* ---- A tracked guest order ---- */}
      {tracked && (
        <section aria-labelledby="tracked-heading">
          <h2 id="tracked-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            Order found
          </h2>
          <ul className="mt-3">
            <OrderCard order={tracked.order} items={tracked.items} />
          </ul>
        </section>
      )}

      {/* ---- Lookup, shown to everyone ----
          Not just guests. A signed-in customer may have placed an order as a
          guest before ever creating an account, and the only record of it is
          the reference in their inbox - so hiding the form from them would hide
          their own order. It also means the "Track order" button above always
          has a target. */}
      <TrackForm error={error} />

      {/* ---- Signed-in history ---- */}
      {userId && (
        <section aria-labelledby="history-heading" className="space-y-4">
          <h2 id="history-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            {orders.length > 0 ? `${orders.length} order${orders.length === 1 ? "" : "s"}` : "Nothing yet"}
          </h2>

          {orders.length === 0 ? (
            <div className="rounded-card border border-ink-200 bg-white p-10 text-center dark:border-ink-700 dark:bg-ink-900">
              <p className="font-medium">No orders yet</p>
              <p className="mt-1 text-sm text-ink-500">
                Anything you buy while signed in shows up here.
              </p>
              <Link
                href="/"
                className="mt-5 inline-block rounded-card bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  items={itemsByOrder.get(order.id) ?? []}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ---- Signed out ---- */}
      {!userId && (
        <div className="text-center">
          <p className="text-sm text-ink-500">Or sign in to see every order at once.</p>
          <div className="mt-3 flex justify-center">
            <GoogleSignInButton
              label="Sign in with Google"
              className="rounded-card border border-ink-300 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-50 dark:border-ink-600"
            />
          </div>
        </div>
      )}
    </div>
  );
}