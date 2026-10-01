import Image from "next/image";
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
 *
 * Photos come from /public/products and go through next/image, which resizes
 * them and serves modern formats. The emoji is kept as the alt text and as the
 * fallback if a product somehow has no photo.
 */

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= 5;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card border border-ink-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-600/10 dark:border-ink-700 dark:bg-ink-800">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-[4/3] overflow-hidden bg-ink-100 dark:bg-ink-700"
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            // Match the container's 4:3 so the grid stays even.
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-200 text-6xl"
            role="img"
            aria-label={product.name}
          >
            {product.emoji}
          </span>
        )}

        {/* Badges sit on a scrim so they stay legible over any photo. */}
        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink-900/60">
            <span className="bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-ink-900">
              Sold out
            </span>
          </span>
        )}
        {!soldOut && lowStock && (
          <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            Only {product.stock} left
          </span>
        )}
        {product.featured && !soldOut && (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm">
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
          {/* tabular-nums keeps a column of prices aligned and stops the digits
              jittering when the quantity changes. */}
          <p className="tabular-nums text-lg font-bold text-ink-900 dark:text-ink-50">
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
