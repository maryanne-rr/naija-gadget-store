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
 * The reassurance block.
 *
 * WHAT THE PREVIOUS COPY GOT WRONG
 * It read: "Every listing shows the number that matters - capacity, wattage,
 * hours - so you can compare two before you commit." That is the shop
 * explaining its own design decisions to the customer. Nobody buys a power bank
 * because a stranger on the internet told them they had good typography, and a
 * page that argues for itself reads as a template.
 *
 * It also answered the wrong question. Asked whether a stranger's gadget shop is
 * worth the risk of a card payment and a three-day wait, a shopper wants to know
 * three things, in this order:
 *
 *   1. is this the real thing, or a lookalike with a similar logo
 *   2. will it actually arrive, and when
 *   3. and if it is wrong, can I send it back
 *
 * Counterfeit chargers and earbuds are endemic in this market, so (1) is not a
 * nicety - it is the whole reason to buy from a named shop rather than a
 * marketplace listing. And (3) was missing from the old block altogether, which
 * is the one people are most anxious about.
 *
 * So the headline states the guarantee, the body gives the specifics, and the
 * three columns are the proof. The specification figures do not need defending:
 * they are on every card, and a visitor can see for themselves.
 */
const REASSURANCE = {
  headline: "Buy the real thing.",
  body: "Counterfeit chargers and earbuds are everywhere, and a cheap one that arrives is worse than an expensive one that does not. Everything here is original stock, and the price on the card is the price on your bill.",
};

/**
 * The three answers, in the order a nervous shopper asks them.
 *
 * Payment method is deliberately absent: it is already in the announcement bar
 * and the footer, and it is a smaller concern than whether the goods are real.
 */
const PROMISES = [
  {
    heading: "Original stock",
    body: "JBL, Anker, Oraimo, Logitech. Not lookalikes.",
  },
  {
    heading: "Lagos 1–2 days",
    body: "All 36 states and the FCT, 2–5 working days elsewhere.",
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
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr] lg:gap-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {REASSURANCE.headline}
            </h2>
            <p className="mt-3 leading-relaxed text-ink-600 dark:text-ink-300">
              {REASSURANCE.body}
            </p>
          </div>

          <dl className="grid gap-5 sm:grid-cols-3 lg:border-l lg:border-ink-200 lg:pl-8 dark:lg:border-ink-700">
            {PROMISES.map((promise) => (
              <div key={promise.heading}>
                <dt className="flex items-start gap-1.5 font-bold">
                  <span aria-hidden="true" className="text-good-700 dark:text-good-300">
                    ✓
                  </span>
                  {promise.heading}
                </dt>
                <dd className="mt-1 pl-4 text-sm text-ink-600 dark:text-ink-400">
                  {promise.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
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