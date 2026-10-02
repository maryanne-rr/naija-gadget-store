import Link from "next/link";
import { connection } from "next/server";
import { ProductCard } from "@/components/ProductCard";
import { CategoryNav } from "@/components/CategoryNav";
import { DealCarousel } from "@/components/DealCarousel";
import { listProducts, categoryCounts, usingDemoCatalogue } from "@/lib/products";
import { dealsForToday } from "@/lib/deals";
import { CATEGORIES, getCategory, DELIVERY } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";
import { integrations } from "@/lib/env";

/**
 * The storefront.
 *
 * A Server Component. The products are fetched on the server, so the HTML that
 * arrives already contains them - no loading spinner, no fetch from the
 * browser, and the product names are visible to search engines.
 */

/**
 * The reassurance block.
 *
 * Three answers to the three things a nervous shopper asks before handing a
 * stranger their card details, in the order they ask them:
 *
 *   1. is this the real thing, or a lookalike with a similar logo
 *   2. will it actually arrive, and when
 *   3. and if it is wrong, can I send it back
 *
 * Counterfeit chargers and earbuds are endemic in this market, so the first is
 * not a nicety - it is the whole reason to buy from a named shop rather than a
 * marketplace listing.
 *
 * There is no headline here. An earlier version carried one ("Buy the real
 * thing") over a paragraph explaining that the shop is careful about fakes, and
 * the carousel directly above it already shows a real discounted product from a
 * named brand - so the block was arguing for something the page had just
 * demonstrated. The three promises do the work on their own.
 */
const PROMISES = [
  {
    heading: "Original stock",
    body: "JBL, Anker, Oraimo, Logitech. Not lookalikes.",
  },
  {
    // Rendered from the shared constant so this cannot disagree with the
    // announcement bar or the footer, which it did - 2-5 here, 2-4 there.
    heading: DELIVERY.lagos,
    body: DELIVERY.elsewhere,
  },
  {
    heading: "7-day returns",
    body: "Unopened and not right? Send it back.",
  },
];

export default async function HomePage() {
  // Render per request rather than prerendering at build time. Stock levels
  // change with every sale, and a storefront that keeps advertising "In stock"
  // for something you just sold out of looks broken. It is also what lets the
  // deal rotation be chosen for today's date rather than frozen at build time.
  await connection();

  const products = await listProducts();
  const counts = categoryCounts(products);

  // Today's rotation, drawn from different categories so the banner never
  // implies the shop only sells batteries. See dealsForToday for why this runs
  // on the server and why the order is the same all day.
  const deals = dealsForToday(products, new Date());

  const slides = deals.map((product) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    spec: product.spec,
    categoryName: product.category ? (getCategory(product.category)?.name ?? "") : "",
    categorySlug: product.category,
    imageUrl: product.image_url,
    emoji: product.emoji,
    price: product.price,
    compareAt: product.compare_at_price,
  }));

  // Cheapest price per category, for the tile.
  const cheapest = new Map<string, number>();
  for (const product of products) {
    if (!product.category) continue;
    const current = cheapest.get(product.category);
    if (current === undefined || product.price < current) {
      cheapest.set(product.category, product.price);
    }
  }

  const categories = CATEGORIES.filter((c) => counts.get(c.slug)).map((c) => ({
    slug: c.slug,
    name: c.name,
    emoji: c.emoji,
    comparedBy: c.comparedBy,
    delivery: c.delivery,
    count: counts.get(c.slug) ?? 0,
    from: formatNaira(cheapest.get(c.slug) ?? 0),
  }));

  // "Picks this week" is a short, edited list. The full catalogue is below it,
  // so this section earns its place by being a recommendation rather than
  // everything again.
  const picks = products.filter((p) => p.featured).slice(0, 4);
  const rest = products.filter((p) => !picks.some((pick) => pick.id === p.id));

  return (
    <div className="space-y-14">
      {!integrations.database && (
        <div className="rounded-card border border-signal-300 bg-signal-50 p-4 text-sm text-signal-700 dark:bg-ink-900 dark:text-signal-300">
          <p className="font-semibold">Showing demo products</p>
          <p className="mt-1">
            Supabase is not connected yet, so these come from{" "}
            <code className="rounded bg-white px-1 dark:bg-ink-800">src/lib/catalog.ts</code> and
            checkout will not save orders. Follow{" "}
            <span className="font-medium">README.md &rsaquo; 1. Supabase</span> to switch to the
            real database.
          </p>
        </div>
      )}

      {/* ---- Deals ----
          Above the argument, not below it. The banner is the merchandise; the
          headline is supporting copy for it. */}
      <DealCarousel slides={slides} />

      {/* ---- Reassurance ----
          Three answers to three fears, in the order they are asked. The
          headings are the answers, not adjectives: "7-day returns" settles a
          question, "quality guaranteed" starts one. */}
      <section className="rounded-panel border border-ink-200 bg-white p-6 lg:p-8 dark:border-ink-700 dark:bg-ink-900">
        <dl className="grid gap-5 sm:grid-cols-3">
          {PROMISES.map((promise) => (
            <div key={promise.heading}>
              <dt className="flex items-start gap-1.5 text-lg font-bold">
                <span aria-hidden="true" className="text-good-700 dark:text-good-300">
                  ✓
                </span>
                {promise.heading}
              </dt>
              <dd className="mt-1 pl-6 text-sm text-ink-600 dark:text-ink-400">
                {promise.body}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---- Categories ---- */}
      {categories.length > 0 && (
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="text-2xl font-bold tracking-tight">
            Shop by category
          </h2>
          <div className="mt-4">
            <CategoryNav categories={categories} />
          </div>
        </section>
      )}

      {picks.length > 0 && (
        <section aria-labelledby="picks-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="picks-heading" className="text-2xl font-bold tracking-tight">
              Picks this week
            </h2>
            <Link href="#catalogue" className="text-sm font-semibold text-brand-600 hover:underline">
              See all {products.length}
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {picks.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section id="catalogue">
        <h2 className="text-2xl font-bold tracking-tight">Everything else</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rest.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {usingDemoCatalogue() && (
        <p className="text-xs text-ink-400">
          Products are being served from the in-memory demo catalogue.
        </p>
      )}
    </div>
  );
}