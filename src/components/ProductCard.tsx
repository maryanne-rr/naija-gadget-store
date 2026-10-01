import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";
import { AddToCartButton } from "./AddToCartButton";

/**
 * A product tile.
 *
 * This is a Server Component: it has no "use client", so it renders to HTML on
 * the server and ships zero JavaScript. Only the add-to-cart button below it
 * needs to run in the browser.
 */

const TILE_GRADIENTS = [
  "from-emerald-100 to-teal-200",
  "from-amber-100 to-orange-200",
  "from-sky-100 to-indigo-200",
  "from-rose-100 to-pink-200",
  "from-lime-100 to-emerald-200",
  "from-violet-100 to-purple-200",
];

/** Pick a stable colour from the slug, so a product always looks the same. */
function gradientFor(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return TILE_GRADIENTS[hash % TILE_GRADIENTS.length];
}

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= 5;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card border border-ink-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-ink-700 dark:bg-ink-800">
      <Link
        href={`/products/${product.slug}`}
        className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br text-6xl"
      >
        <span className={`bg-gradient-to-br ${gradientFor(product.slug)}`} aria-hidden="true" />
        <span className="absolute text-6xl" role="img" aria-label={product.name}>
          {product.emoji}
        </span>

        {soldOut && (
          <span className="absolute inset-x-0 top-3 bg-ink-900/85 py-1 text-center text-xs font-semibold uppercase tracking-wide text-white">
            Sold out
          </span>
        )}
        {!soldOut && lowStock && (
          <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white">
            Only {product.stock} left
          </span>
        )}
        {product.featured && !soldOut && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand-700">
            Featured
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-semibold leading-tight text-ink-900 dark:text-ink-50">
            <Link href={`/products/${product.slug}`} className="hover:text-brand-700">
              {product.name}
            </Link>
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-ink-500">{product.tagline}</p>
        </div>

        <div className="mt-auto flex items-end justify-between pt-2">
          <p className="text-lg font-bold text-ink-900 dark:text-ink-50">
            {formatNaira(product.price)}
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
