import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { ProductCard } from "@/components/ProductCard";
import { CategoryNav } from "@/components/CategoryNav";
import { listProducts, categoryCounts, usingDemoCatalogue } from "@/lib/products";
import { CATEGORIES } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";
import { integrations } from "@/lib/env";

/**
 * The storefront.
 *
 * A Server Component. The products are fetched on the server, so the HTML that
 * arrives already contains them - no loading spinner, no fetch from the
 * browser, and the product names are visible to search engines.
 */

/** What the hero is about, in one line, without the word "gadgets". */
const HERO = {
  headline: "Full battery through the go-slow.",
  body: "Power banks, chargers and earbuds in naira, with the number that matters printed on the card. Every listing shows capacity, wattage or hours, so you can compare two in seconds.",
  primary: { href: "/category/power", label: "Shop power banks" },
  secondary: { href: "/orders", label: "Track my order" },
};

export default async function HomePage() {
  // Render per request rather than prerendering at build time. Stock levels
  // change with every sale, and a storefront that keeps advertising "In stock"
  // for something you just sold out of looks broken.
  await connection();

  const products = await listProducts();
  const counts = categoryCounts(products);

  // The hero sells a real product rather than a gradient. A banner that says
  // "Shop now" with nothing to look at is the single most template thing a
  // storefront can do; putting an actual product with its actual specification
  // in the hero means the first screen is already merchandise.
  const heroProduct = products.find((p) => p.slug === "oraimo-power-bank-20000") ?? products[0];

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

      {/* ---- Hero ----
          Two columns on desktop: the argument on the left, an actual product on
          the right. On a phone the product comes first, because on a phone the
          product is what the shopper came for and the argument is what they
          tolerate. */}
      <section className="grid items-center gap-8 rounded-panel border border-ink-200 bg-white p-6 dark:border-ink-700 dark:bg-ink-900 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:p-10">
        <div>
          <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl">
            {HERO.headline}
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-600 dark:text-ink-300">
            {HERO.body}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={HERO.primary.href}
              className="rounded-card bg-brand-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-brand-700"
            >
              {HERO.primary.label}
            </Link>
            <Link
              href={HERO.secondary.href}
              className="rounded-card border border-ink-300 px-5 py-3 font-semibold text-ink-800 transition-colors hover:border-brand-400 hover:text-brand-700 dark:border-ink-600 dark:text-ink-100"
            >
              {HERO.secondary.label}
            </Link>
          </div>

          {/* The three promises, as facts rather than adjectives. A gadget shop
              competing on trust has to be specific: 36 states and the FCT is
              checkable, "quality guaranteed" is not. */}
          <dl className="mt-9 grid grid-cols-1 gap-4 border-t border-ink-200 pt-6 sm:grid-cols-3 dark:border-ink-700">
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
        </div>

        {heroProduct && (
          <Link
            href={`/products/${heroProduct.slug}`}
            className="group relative block overflow-hidden rounded-panel border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-800"
          >
            <div className="relative aspect-[4/3]">
              {heroProduct.image_url ? (
                <Image
                  src={heroProduct.image_url}
                  alt={heroProduct.name}
                  fill
                  // This is the largest image on the page, so it is allowed to
                  // be the priority one rather than the first card in the grid.
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-7xl">
                  {heroProduct.emoji}
                </span>
              )}
            </div>

            <div className="flex items-end justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                  {heroProduct.brand}
                </p>
                <p className="spec-figure mt-1 text-2xl">{heroProduct.spec}</p>
                <p className="mt-1 truncate text-sm text-ink-600 dark:text-ink-300">
                  {heroProduct.name}
                </p>
              </div>
              <p className="shrink-0 text-right">
                <span className="block text-xs text-ink-500">Pick of the week</span>
                <span className="tabular-nums block text-xl font-bold text-ink-900 dark:text-ink-50">
                  {formatNaira(heroProduct.price)}
                </span>
              </p>
            </div>
          </Link>
        )}
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