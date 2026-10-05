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
 * WHAT LEADS THE CARD
 *
 * The product name, in the display face at headline weight, with the
 * specification underneath in the smaller supporting style.
 *
 * This was the other way round, and the spec-led version was argued for on the
 * grounds that people compare numbers rather than names. The argument was not
 * wrong so much as misplaced: the specification is what decides between two
 * similar products, but the name is what tells you whether you are looking at the
 * right product at all. Leading with "20,000 mAh" over a grid of otherwise
 * identical figures made the cards hard to tell apart, and it made the audio
 * category worse rather than better - four products all reading "40 hours",
 * "12 hours", "6 hours", as though battery life were the only thing there is to
 * know about a pair of headphones.
 *
 * So the figure is support, not the headline. Audio has none, which is honest:
 * there is no single number that tells you whether to buy headphones, and the
 * detail belongs on the product page where there is room for it.
 */

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= 5;

  // Null when there is no genuine saving, so the struck-through price and the
  // badge are never rendered as "0% off" - a badge that reads zero teaches
  // shoppers to ignore badges.
  const percent = discountPercent(product.price, product.compare_at_price);

  // Products with no headline figure (all of audio) skip the line rather than
  // leaving a gap above the price.
  const hasSpec = product.spec.trim().length > 0;

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

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* 1. The name. The headline: biggest type on the card, and the only
            thing that tells you whether you are looking at the right product. */}
        <h3 className="font-display text-lg font-bold leading-tight tracking-tight text-ink-900 dark:text-ink-50">
          <Link href={`/products/${product.slug}`} className="hover:text-brand-600">
            {product.name}
          </Link>
        </h3>

        {/* 2. The brand, small and quiet. A trust signal, not a headline. */}
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
          {product.brand}
        </p>

        {/* 3. The specification, as support. Omitted where there is no single
            figure worth leading with, which is currently all of audio. */}
        {hasSpec && (
          <p className="text-sm font-medium text-ink-600 dark:text-ink-400">
            {product.spec}
          </p>
        )}

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
            imageUrl={product.image_url}
          />
        </div>
      </div>
    </article>
  );
}