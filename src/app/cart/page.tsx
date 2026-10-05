"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { formatNaira } from "@/lib/money";

/**
 * The cart page.
 *
 * Everything here reads from localStorage via CartProvider, so it has to be a
 * Client Component. The totals it shows are for display only - the server
 * recalculates them in /api/checkout before anything is charged.
 */
export default function CartPage() {
  const { items, subtotal, hydrated, setQuantity, remove, clear } = useCart();

  if (!hydrated) {
    return (
      <div className="py-20 text-center text-ink-400">
        <p>Loading your cart…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-5xl" aria-hidden="true">
          🛒
        </p>
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-ink-500">Add something and it will show up here.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-ink-900 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your cart</h1>
        <button
          type="button"
          onClick={clear}
          className="text-sm text-ink-500 underline hover:text-red-600"
        >
          Empty cart
        </button>
      </div>

      <ul className="divide-y divide-ink-200 rounded-xl border border-ink-200 bg-white dark:divide-ink-700 dark:border-ink-700 dark:bg-ink-800">
        {items.map((item) => (
          /* TWO TIERS BELOW sm, ONE LINE ABOVE IT.

             This was a single flex row holding five things: a 56px thumbnail, the
             name, the stepper, a fixed 112px line total and Remove. That is about
             380px of fixed content before the name gets a single pixel, so on a
             360px phone the name block - the only child allowed to shrink, via
             min-w-0 - collapsed to nothing and the stepper painted straight over
             the price.

             min-w-0 was doing its job. The bug was the layout it was defending:
             nothing on that line was allowed to wrap, so shrinking the name to
             zero was the only thing flex had left to do.

             The fix is the one the mobile app already uses for the same screen on
             the same phone. The name and price go on the top tier where the name
             has the full width; the controls go underneath, where they are
             reachable and cannot push anything off screen. sm and up keeps the
             one-line version, which is what a desktop has room for. */
          <li
            key={item.productId}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4"
          >
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-2xl dark:bg-ink-700"
              aria-hidden="true"
            >
              {/* The photograph where there is one. Half this catalogue's emoji
                  render as a tofu box on iOS, and a cart is the screen most likely
                  to be looked at rather than shopped - a row of meaningless glyphs
                  is what you see instead. */}
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                item.emoji
              )}
            </span>

            {/* grow + basis-full below sm: taking the whole line is what pushes the
                controls onto the second tier. min-w-0 stays, so a long product
                name truncates instead of forcing the row wider than the screen. */}
            <div className="min-w-0 flex-1 basis-full sm:basis-auto">
              <Link
                href={`/products/${item.slug}`}
                className="block truncate font-medium hover:text-brand-700"
              >
                {item.name}
              </Link>
              <p className="text-sm text-ink-500">
                {formatNaira(item.price)} each
                {item.quantity > 1 ? (
                  <span className="sm:hidden"> · {formatNaira(item.price * item.quantity)}</span>
                ) : null}
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-ink-300 dark:border-ink-600">
              <button
                type="button"
                onClick={() => setQuantity(item.productId, item.quantity - 1)}
                className="px-3 py-2.5 hover:bg-ink-100 dark:hover:bg-ink-700"
                aria-label={`Decrease quantity of ${item.name}`}
              >
                −
              </button>
              <span className="w-9 text-center text-sm font-semibold tabular-nums">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(item.productId, item.quantity + 1)}
                disabled={item.quantity >= item.maxStock}
                className="px-3 py-2.5 hover:bg-ink-100 disabled:opacity-40 dark:hover:bg-ink-700"
                aria-label={`Increase quantity of ${item.name}`}
              >
                +
              </button>
            </div>

            {/* Hidden below sm because it is repeated at the end of the unit-price
                line above. Showing it twice on a phone would be two different
                numbers on one row. */}
            <p className="hidden w-28 text-right font-semibold tabular-nums sm:block">
              {formatNaira(item.price * item.quantity)}
            </p>

            <button
              type="button"
              onClick={() => remove(item.productId)}
              className="min-h-[44px] px-2 text-sm text-ink-400 underline hover:text-red-600"
              aria-label={`Remove ${item.name} from cart`}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="ml-auto max-w-sm rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-800">
        <div className="flex justify-between text-lg">
          <span>Subtotal</span>
          <span className="font-bold tabular-nums">{formatNaira(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-500">Delivery is calculated at checkout.</p>

        <Link
          href="/checkout"
          className="mt-5 block rounded-lg bg-brand-600 px-5 py-3 text-center font-semibold text-white hover:bg-brand-700"
        >
          Proceed to checkout
        </Link>

        <Link
          href="/"
          className="mt-2 block rounded-lg border border-ink-300 px-5 py-3 text-center text-sm font-medium hover:bg-ink-100 dark:border-ink-600 dark:hover:bg-ink-800"
        >
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
