import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { getProductBySlug } from "@/lib/products";
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

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/" className="hover:text-brand-700">
          Shop
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-ink-700 dark:text-ink-200">{product.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-200 text-8xl">
          <span role="img" aria-label={product.name}>
            {product.emoji}
          </span>
        </div>

        <div className="space-y-6">
          <div>
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
    </div>
  );
}
