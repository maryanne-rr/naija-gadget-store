import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductCard } from "@/components/ProductCard";
import { getProductBySlug, listProductsByCategory } from "@/lib/products";
import { getCategory } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";

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
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-ink-100 dark:bg-ink-700">
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
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-200 text-8xl"
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
                className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-ink-200 px-2.5 py-1 text-xs font-medium text-ink-600 hover:border-brand-400 hover:text-brand-700 dark:border-ink-700 dark:text-ink-300"
              >
                <span aria-hidden="true">{category.emoji}</span>
                {category.name}
              </Link>
            )}
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            {product.tagline && <p className="mt-1 text-lg text-ink-500">{product.tagline}</p>}
          </div>

          <p className="text-3xl font-bold">{formatNaira(product.price)}</p>

          <p className="text-sm">
            {soldOut ? (
              <span className="font-semibold text-red-600">Out of stock</span>
            ) : product.stock <= 5 ? (
              <span className="font-semibold text-amber-600">
                Only {product.stock} left in stock
              </span>
            ) : (
              <span className="font-semibold text-brand-700">In stock</span>
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
              className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-semibold hover:bg-ink-100 dark:border-ink-600 dark:hover:bg-ink-800"
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
            <h2 className="font-semibold text-ink-700 dark:text-ink-200">Delivery &amp; returns</h2>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Delivered nationwide within 2-4 working days</li>
              <li>Pay by card, bank transfer or USSD</li>
              <li>7-day returns on unopened items</li>
            </ul>
          </div>
        </div>
      </div>

      {/* More from the same shelf. Only shown when there is somewhere to go -
          a "related products" strip with one item in it is worse than none. */}
      {related.length > 0 && (
        <section className="border-t border-ink-200 pt-8 dark:border-ink-700">
          <h2 className="text-xl font-bold tracking-tight">
            More {category ? `in ${category.name}` : "like this"}
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
