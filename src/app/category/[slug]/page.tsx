import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES, getCategory } from "@/lib/catalog";
import { listProductsByCategory } from "@/lib/products";

/**
 * One category page: /category/audio, /category/power, and so on.
 *
 * A Server Component. Products are fetched on the server, so the HTML already
 * contains them.
 */

/**
 * Render per request rather than prerendering.
 *
 * Stock changes with every sale, and a category page that keeps advertising
 * "in stock" for something you just sold out of looks broken. This is also what
 * stops the build from needing to reach the database.
 */
export const dynamic = "force-dynamic";

/** The slugs that exist. Anything else is a 404 rather than an empty page. */
export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ slug: category.slug }));
}

/**
 * Pre-render a nice title and description per category.
 *
 * Without this every category page shares the homepage's metadata, so a shared
 * link shows "Naija Gadget Store" and nothing about what was clicked.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);

  if (!category) {
    return { title: "Category not found" };
  }

  // title.template in the root layout appends the site name, so the template
  // here must be a bare "%s". Writing the full name produced
  // "Audio — Naija Gadget Store | Naija Gadget Store".
  return {
    title: category.name,
    description: category.blurb,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();

  const { slug } = await params;
  const category = getCategory(slug);

  // An unknown slug is a 404. Not an empty grid: a page titled "Audio" with
  // nothing in it reads as a broken shop rather than a broken link.
  if (!category) {
    notFound();
  }

  const products = await listProductsByCategory(slug);

  // The category exists but has no products. Still a 404 - the nav should never
  // link here, and check:categories fails if one ever does.
  if (products.length === 0) {
    notFound();
  }

  const cheapest = Math.min(...products.map((p) => p.price));
  const naira = (cheapest / 100).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  });

  // Sibling categories, for the "elsewhere in the shop" strip at the bottom.
  const others = CATEGORIES.filter((c) => c.slug !== slug);

  return (
    <div className="space-y-10">
      <div>
        {/* Breadcrumb. Also the one place a visitor can get back to the full
            catalogue without using the browser's back button. */}
        <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-brand-700">
                Shop
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-medium text-ink-900 dark:text-ink-100">{category.name}</li>
          </ol>
        </nav>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
              <span aria-hidden="true">{category.emoji}</span>
              {category.name}
            </h1>
            <p className="mt-2 max-w-xl text-ink-600 dark:text-ink-300">{category.blurb}</p>
          </div>

          <p className="text-sm text-ink-500">
            {products.length} {products.length === 1 ? "item" : "items"}, from{" "}
            <span className="font-semibold text-ink-900 dark:text-ink-100">{naira}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <section className="border-t border-ink-200 pt-6 dark:border-ink-700">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          Elsewhere in the shop
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {others.map((other) => (
            <li key={other.slug}>
              <Link
                href={`/category/${other.slug}`}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-3 py-1.5 text-sm hover:border-brand-400 hover:text-brand-700 dark:border-ink-700 dark:hover:border-brand-500"
              >
                <span aria-hidden="true">{other.emoji}</span>
                {other.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}