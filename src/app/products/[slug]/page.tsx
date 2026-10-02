import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductCard } from "@/components/ProductCard";
import { getProductBySlug, listProductsByCategory } from "@/lib/products";
import { getCategory } from "@/lib/catalog";
import { formatNaira, discountPercent, amountSaved } from "@/lib/money";

/**
 * A single product.
 *
 * Note the `params` type. In Next.js 16 `params` is a Promise and must be
 * awaited - the synchronous form was removed. `PageProps` is generated from
 * the route literal, so `slug` is typed without writing the shape by hand.
 * Run `npx next typegen` if the editor does not offer it.
 */
export async function generateMetadata({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Product not found" };
  }

  return {
    title: product.name,
    description: product.tagline || product.description.slice(0, 155),
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const soldOut = product.stock <= 0;

  // Null unless there is a genuine saving, so nothing ever renders "Save 0%".
  const percent = discountPercent(product.price, product.compare_at_price);

  // Audio has no headline figure - battery hours are not what decides a pair of
  // headphones - so the specification block is skipped rather than left blank.
  const hasSpec = product.spec.trim().length > 0;

  // The category this product sits in, if it has one. Products seeded before
  // categories existed have null, so this has to cope with that.
  const category = product.category ? getCategory(product.category) : undefined;

  // Up to four others from the same category, cheapest last. Not fetched when
  // this is the only product in its category, which is the common case for the
  // smaller ones.
  const siblings = category ? await listProductsByCategory(category.slug) : [];
  const related = siblings
    .filter((item) => item.id !== product.id)
    .sort((a, b) => a.price - b.price)
    .slice(0, 4);

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/" className="hover:text-brand-700">
          Shop
        </Link>
        {category && (
          <>
            <span aria-hidden="true"> / </span>
            <Link href={`/category/${category.slug}`} className="hover:text-brand-700">
              {category.name}
            </Link>
          </>
        )}
        <span aria-hidden="true"> / </span>
        <span className="text-ink-700 dark:text-ink-200">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-card bg-ink-100 dark:bg-ink-800">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <span
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 text-8xl"
              role="img"
              aria-label={product.name}
            >
              {product.emoji}
            </span>
          )}

          {soldOut && (
            <span className="absolute inset-0 flex items-center justify-center bg-ink-900/55">
              <span className="bg-white px-5 py-2 text-sm font-bold uppercase tracking-widest text-ink-900">
                Sold out
              </span>
            </span>
          )}
        </div>

        <div className="space-y-6">
          <div>
            {category && (
              <Link
                href={`/category/${category.slug}`}
                className="mb-3 inline-flex items-center gap-1.5 rounded-card border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition-colors hover:border-brand-400 hover:text-brand-700 dark:border-ink-700 dark:text-ink-300"
              >
                <span aria-hidden="true">{category.emoji}</span>
                {category.name}
                {/* Naming the basis of comparison on the product page too, so
                    the promise made on the category tile is kept here. */}
                <span className="text-ink-400 dark:text-ink-500">
                  &middot; compared by {category.comparedBy}
                </span>
              </Link>
            )}

            <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
              {product.brand}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{product.name}</h1>
            {product.tagline && <p className="mt-2 text-lg text-ink-600 dark:text-ink-400">{product.tagline}</p>}
          </div>

          {/* The deciding number, at the size it deserves on its own page.
              Omitted when the product has none - all of audio does, because
              there is no single figure that tells you whether to buy a pair of
              headphones. The chips below carry the detail instead. */}
          {(hasSpec || product.specs.length > 0) && (
            <div className="rounded-card border border-ink-200 bg-ink-50 p-5 dark:border-ink-700 dark:bg-ink-800">
              {hasSpec && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    {category ? `Compared by ${category.comparedBy}` : "Key specification"}
                  </p>
                  <p className="spec-figure mt-1 text-4xl">{product.spec}</p>
                </>
              )}

              {product.specs.length > 0 && (
                <ul className={hasSpec ? "mt-3 flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
                  {product.specs.map((spec) => (
                    <li
                      key={spec}
                      className="rounded-card border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
                    >
                      {spec}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Price. The struck-through figure is display only and never reaches
              the cart or the order - the amount charged is always `price`. */}
          <p className="leading-tight">
            {percent !== null && (
              <span className="mb-2 block w-fit rounded-card bg-signal-300 px-2.5 py-1 text-sm font-bold text-ink-950">
                Save {percent}% &mdash; {formatNaira(amountSaved(product.price, product.compare_at_price)!)}
              </span>
            )}
            <span className="tabular-nums block text-3xl font-bold">
              {formatNaira(product.price)}
            </span>
            {product.compare_at_price !== null && percent !== null && (
              <s className="tabular-nums mt-1 block text-lg text-ink-400 line-through decoration-2">
                {formatNaira(product.compare_at_price)}
              </s>
            )}
          </p>

          <p className="text-sm">
            {soldOut ? (
              <span className="font-semibold text-alert-500">Out of stock</span>
            ) : product.stock <= 5 ? (
              <span className="font-semibold text-signal-700 dark:text-signal-300">
                Only {product.stock} left in stock
              </span>
            ) : (
              <span className="font-semibold text-good-700 dark:text-good-300">In stock</span>
            )}
          </p>

          <div className="flex items-center gap-3">
            <AddToCartButton
              productId={product.id}
              name={product.name}
              slug={product.slug}
              price={product.price}
              emoji={product.emoji}
              maxStock={product.stock}
            />
            <Link
              href="/cart"
              className="rounded-card border border-ink-300 px-4 py-2 text-sm font-semibold transition-colors hover:border-brand-400 dark:border-ink-600"
            >
              View cart
            </Link>
          </div>

          <div className="border-t border-ink-200 pt-6 dark:border-ink-700">
            <h2 className="font-semibold">About this product</h2>
            <p className="mt-2 leading-relaxed text-ink-600 dark:text-ink-300">
              {product.description}
            </p>
          </div>

          <div className="border-t border-ink-200 pt-6 text-sm text-ink-500 dark:border-ink-700">
            <h2 className="font-semibold text-ink-800 dark:text-ink-200">Delivery &amp; returns</h2>
            <ul className="mt-2 space-y-1.5">
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-brand-500">✓</span>
                Lagos 1&ndash;2 working days, everywhere else 2&ndash;5
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-brand-500">✓</span>
                Pay by card, bank transfer or USSD
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-brand-500">✓</span>
                7-day returns on unopened items
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true" className="text-brand-500">✓</span>
                Original {product.brand} stock, not a lookalike
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* More from the same shelf. Only shown when there is somewhere to go -
          a "related products" strip with one item in it is worse than none. */}
      {related.length > 0 && (
        <section className="border-t border-ink-200 pt-8 dark:border-ink-700">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              More {category ? `in ${category.name}` : "like this"}
            </h2>
            {category && (
              // The reason these are the ones shown: they are the ones being
              // compared. Saying so is more use than a generic "you may also
              // like", which is what a recommender nobody configured produces.
              <p className="text-sm text-ink-500">
                Cheapest first, all compared by {category.comparedBy}
              </p>
            )}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
