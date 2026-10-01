import Link from "next/link";
import { connection } from "next/server";
import { ProductCard } from "@/components/ProductCard";
import { listProducts, usingDemoCatalogue } from "@/lib/products";
import { integrations } from "@/lib/env";

/**
 * The storefront.
 *
 * A Server Component. The products are fetched on the server, so the HTML that
 * arrives already contains them - no loading spinner, no fetch from the
 * browser, and the product names are visible to search engines.
 */
export default async function HomePage() {
  // Render per request rather than prerendering at build time. Stock levels
  // change with every sale, and a storefront that keeps advertising "In stock"
  // for something you just sold out of looks broken.
  await connection();

  const products = await listProducts();
  const featured = products.filter((product) => product.featured);
  const rest = products.filter((product) => !product.featured);

  return (
    <div className="space-y-12">
      {!integrations.database && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">Showing demo products</p>
          <p className="mt-1">
            Supabase is not connected yet, so these come from{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">src/lib/catalog.ts</code> and
            checkout will not save orders. Follow{" "}
            <span className="font-medium">README.md &rsaquo; 1. Supabase</span> to switch to the real
            database.
          </p>
        </div>
      )}

      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-12 text-white sm:px-10">
        <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
          Gadgets that arrive before the weekend.
        </h1>
        <p className="mt-3 max-w-lg text-brand-50">
          Chargers, power banks, audio and phone accessories. Pay by card or bank transfer,
          delivered across Nigeria.
        </p>
        <Link
          href="#catalogue"
          className="mt-6 inline-block rounded-lg bg-white px-5 py-2.5 font-semibold text-brand-800 hover:bg-brand-50"
        >
          Browse the catalogue
        </Link>
      </section>

      {featured.length > 0 && (
        <section>
          <h2 className="text-xl font-bold tracking-tight">Featured</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section id="catalogue">
        <h2 className="text-xl font-bold tracking-tight">
          {featured.length > 0 ? "Everything else" : "All products"}
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
