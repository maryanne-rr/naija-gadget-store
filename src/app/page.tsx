import Link from "next/link";
import { connection } from "next/server";
import { ProductCard } from "@/components/ProductCard";
import { CategoryNav } from "@/components/CategoryNav";
import { DealCarousel } from "@/components/DealCarousel";
import { listProducts, categoryCounts, usingDemoCatalogue } from "@/lib/products";
import { dealsForToday } from "@/lib/deals";
import { CATEGORIES, getCategory } from "@/lib/catalog";
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
 * The argument the banner makes. It is about the shop, not about one product,
 * which is the correction to a hero that led with a power bank and made the
 * whole storefront read as a power bank shop.
 */
const HERO = {
  headline: "Full battery through the go-slow.",
  body: "Power banks, chargers, earbuds, mice and keyboards in naira. Every listing shows the number that matters - capacity, wattage, hours - so you can compare two before you commit.",
};

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

      {/* ---- The argument, as three checkable promises ----
          "Lagos 1-2 days" and "original brands" are both verifiable, which is
          why they are here rather than "fast shipping" and "quality you can
          trust". A gadget shop competing on trust has to be specific. */}
      <section className="grid gap-6 rounded-panel border border-ink-200 bg-white p-6 lg:grid-cols-2 lg:p-8 dark:border-ink-700 dark:bg-ink-900">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{HERO.headline}</h2>
          <p className="mt-3 leading-relaxed text-ink-600 dark:text-ink-300">{HERO.body}</p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3 lg:border-l lg:border-ink-200 lg:pl-6 dark:lg:border-ink-700">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              All 36 states + FCT
            </dt>
            <dd className="mt-1 text-sm text-ink-700 dark:text-ink-300">
              Lagos 1&ndash;2 days, elsewhere 2&ndash;5
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Original brands
            </dt>
            <dd className="mt-1 text-sm text-ink-700 dark:text-ink-300">
              JBL, Anker, Oraimo, Logitech
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Pay how you like
            </dt>
            <dd className="mt-1 text-sm text-ink-700 dark:text-ink-300">
              Card, bank transfer or USSD
            </dd>
          </div>
        </dl>
      </section>

      {/* ---- Categories ---- */}
      {categories.length > 0 && (
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="text-2xl font-bold tracking-tight">
            Shop by category
          </h2>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-400">
            Every category is sorted by the measure that decides it, so you are comparing
            like with like.
          </p>
          <div className="mt-5">
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