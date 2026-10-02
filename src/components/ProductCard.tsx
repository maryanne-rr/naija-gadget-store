import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { formatNaira, discountPercent } from "@/lib/money";
import { AddToCartButton } from "./AddToCartButton";

/**
 * A product tile.
 *
 * A Server Component: no "use client", so it renders to HTML on the server and
 * ships zero JavaScript. Only the add-to-cart button needs to run in the
 * browser.
 *
 * THE ORDER ON THIS CARD IS THE DESIGN
 *
 * spec, then brand, then name, then price. The spec comes first because that is
 * the decision. Somebody comparing two power banks is comparing 20,000mAh
 * against 10,000mAh, and the number is short enough to read across a shop
 * counter on a phone. The name is below it because the name is the tiebreaker,
 * not the decider - and a long name above a short number pushes the number out
 * of the first glance entirely.
 *
 * The old card led with the name and hid the specification in a sentence of
 * tagline text, which meant comparing two products meant reading two paragraphs.
 */

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= 5;

  // Null when there is no genuine saving, so the struck-through price and the
  // badge are never rendered as "0% off" - a badge that reads zero teaches
  // shoppers to ignore badges.
  const percent = discountPercent(product.price, product.compare_at_price);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card border border-ink-200 bg-white transition-colors hover:border-brand-400 dark:border-ink-700 dark:bg-ink-900">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/3] overflow-hidden bg-ink-100 dark:bg-ink-800"
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            // Match the container's 4:3 so the grid stays even.
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-6xl"
            role="img"
            aria-label={product.name}
          >
            {product.emoji}
          </span>
        )}

        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink-950/65">
            <span className="bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-ink-900">
              Sold out
            </span>
          </span>
        )}

        {/* The one amber thing on the card. Amber is rare here on purpose, so
            "only N left" is the only reason your eye is pulled to the corner. */}
        {!soldOut && lowStock && (
          <span className="absolute right-0 top-0 rounded-bl-card bg-signal-300 px-2.5 py-1 text-xs font-bold text-ink-950">
            {product.stock} left
          </span>
        )}

        {product.featured && !soldOut && (
          <span className="absolute left-0 top-0 rounded-br-card bg-brand-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Pick of the week
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* 1. The deciding number. Largest type on the card after the price. */}
        <p className="spec-figure text-xl">{product.spec}</p>

        {/* 2. The brand, small and quiet. A trust signal, not a headline. */}
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
          {product.brand}
        </p>

        {/* 3. The name. Long, so it goes last and wraps to two lines at most. */}
        <h3 className="text-sm font-semibold leading-snug text-ink-900 dark:text-ink-100">
          <Link href={`/products/${product.slug}`} className="hover:text-brand-600">
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <p className="leading-tight">
            {/* The saving badge sits above the prices rather than beside them:
                on a card this narrow, a third inline element wraps and pushes
                the Add to cart button out of alignment with its neighbours. */}
            {percent !== null && (
              <span className="mb-1 block w-fit rounded-card bg-signal-300 px-1.5 py-0.5 text-[11px] font-bold text-ink-950">
                Save {percent}%
              </span>
            )}
            <span className="tabular-nums block text-lg font-bold text-ink-900 dark:text-ink-50">
              {formatNaira(product.price)}
            </span>
            {product.compare_at_price !== null && percent !== null && (
              <s className="tabular-nums block text-xs text-ink-400">
                {formatNaira(product.compare_at_price)}
              </s>
            )}
          </p>

          {/* The only client-side part of the card. */}
          <AddToCartButton
            productId={product.id}
            name={product.name}
            slug={product.slug}
            price={product.price}
            emoji={product.emoji}
            maxStock={product.stock}
          />
        </div>
      </div>
    </article>
  );
}