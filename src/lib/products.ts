import "server-only";
import { demoProducts, CATEGORIES, type Product } from "./catalog";
import { integrations } from "./env";
import { supabase } from "./supabase";

/**
 * Reading products.
 *
 * All queries live here rather than in page components, so the pages stay about
 * presentation and there is one obvious place to look when data looks wrong.
 *
 * Note the fallback: if Supabase is not configured (or is misconfigured) we
 * serve the in-memory demo catalogue. That keeps the storefront rendering on a
 * fresh clone, and the console warning tells you what actually went wrong.
 */

/** Using the demo catalogue means checkout will not persist orders. */
let lastWarning = "";

export function usingDemoCatalogue(): boolean {
  return lastWarning.length > 0;
}

async function queryOrFallback<T>(
  run: () => Promise<T>,
  fallback: () => T,
  context: string,
): Promise<T> {
  if (!integrations.database) {
    lastWarning = "Supabase is not configured, serving the in-memory demo catalogue.";
    return fallback();
  }

  try {
    const result = await run();
    lastWarning = "";
    return result;
  } catch (error) {
    lastWarning =
      `${context} failed, serving the in-memory demo catalogue instead. ` +
      `Underlying error: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[products] ${context}:`, error);
    return fallback();
  }
}

/** Newest first, featured items surfaced at the top. */
export async function listProducts(): Promise<Product[]> {
  return queryOrFallback<Product[]>(
    async () => {
      const { data, error } = await supabase()
        .from("products")
        .select("*")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return normaliseAll(data as Record<string, unknown>[] | null);
    },
    () => [...demoProducts].sort((a, b) => Number(b.featured) - Number(a.featured)),
    "listProducts",
  );
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return queryOrFallback<Product | null>(
    async () => {
      const { data, error } = await supabase()
        .from("products")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return normalise(data as Record<string, unknown> | null);
    },
    () => demoProducts.find((p) => p.slug === slug) ?? null,
    "getProductBySlug",
  );
}

/**
 * Fill in the fields a database row might not have.
 *
 * WHY THIS IS NEEDED
 * `select *` returns whatever columns the table happens to have. A row written
 * before a column was added has no value for it - absent, not null - and
 * `row.specs.length` then throws "Cannot read properties of undefined". That is
 * not hypothetical: adding brand/spec/specs to the catalogue crashed every
 * product page until the migration was applied, because the query succeeded and
 * returned rows that simply lacked the new keys.
 *
 * Normalising at the boundary rather than guarding at each use is the point.
 * There are six places a product is rendered, and six `?? []` defaults is six
 * chances to forget one. The Product type says the field exists; this is what
 * makes that true.
 */
function normalise(row: Record<string, unknown> | null): Product | null {
  if (!row) return null;

  return {
    ...(row as unknown as Product),
    brand: typeof row.brand === "string" ? row.brand : "",
    spec: typeof row.spec === "string" ? row.spec : "",
    // Postgres text[] arrives as an array, but a row from before the column
    // existed gives undefined and a hand-edited row could give a JSON string.
    specs: Array.isArray(row.specs) ? row.specs.filter((s) => typeof s === "string") : [],
    category: typeof row.category === "string" ? row.category : null,

    // compare_at_price arrives as a number, or absent on a row written before the
    // column existed. Anything that is not a positive integer is treated as "not
    // on offer", because a malformed was-price must never render a badge.
    compare_at_price:
      typeof row.compare_at_price === "number" && Number.isInteger(row.compare_at_price)
        ? row.compare_at_price
        : null,
    deal: row.deal === true,
  };
}

function normaliseAll(rows: Record<string, unknown>[] | null): Product[] {
  return (rows ?? []).map((row) => normalise(row) as Product);
}

/**
 * Every product in one category, cheapest first.
 *
 * The slug is checked against CATEGORIES before querying, so a typo in a URL
 * produces the same notFound() as an unknown product does. Passing an
 * arbitrary string straight to .eq() would return an empty array instead, which
 * renders a plausible-looking empty category page rather than a 404.
 */
export async function listProductsByCategory(categorySlug: string): Promise<Product[]> {
  if (!CATEGORIES.some((c) => c.slug === categorySlug)) {
    return [];
  }

  return queryOrFallback<Product[]>(
    async () => {
      const { data, error } = await supabase()
        .from("products")
        .select("*")
        .eq("category", categorySlug)
        .order("featured", { ascending: false })
        .order("price", { ascending: true });

      if (error) throw new Error(error.message);
      return normaliseAll(data as Record<string, unknown>[] | null);
    },
    () =>
      demoProducts
        .filter((p) => p.category === categorySlug)
        .sort((a, b) => Number(b.featured) - Number(a.featured) || a.price - b.price),
    `listProductsByCategory(${categorySlug})`,
  );
}

/**
 * How many products sit in each category, for the storefront nav.
 *
 * Counted from the catalogue rather than with a SQL group-by. The nav is on
 * every page view and the products are already in memory, so a second round
 * trip to the database to count thirty rows would be slower and no more
 * accurate.
 */
export function categoryCounts(products: Product[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of products) {
    if (!product.category) continue;
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  return counts;
}

/**
 * Look products up by id, preserving the caller's order.
 *
 * The order matters: the cart decides the line-item order, and re-sorting here
 * would make the basket jump around when you change the quantity.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const wanted = new Set(ids);
  return queryOrFallback<Product[]>(
    async () => {
      const { data, error } = await supabase().from("products").select("*").in("id", [...wanted]);
      if (error) throw new Error(error.message);

      const found = normaliseAll(data as Record<string, unknown>[] | null);
      return ids.flatMap((id) => found.filter((p) => p.id === id));
    },
    () => demoProducts.filter((p) => wanted.has(p.id)),
    "getProductsByIds",
  );
}

/**
 * Take stock off the shelf for each purchased line.
 *
 * This calls the `decrement_stock` Postgres function defined in schema.sql
 * rather than reading `stock`, subtracting in JavaScript, and writing it back.
 * That read-modify-write has a race: two people buying the last unit at the
 * same moment both read stock = 1, both write stock = 0, and you sell one more
 * than you have. Doing the subtraction inside the database makes the read and
 * the write a single atomic step.
 *
 * Returns the ids that could not be decremented (gone, or not enough left).
 */
export async function decrementStock(
  lines: { productId: string; quantity: number }[],
): Promise<string[]> {
  const outOfStock: string[] = [];
  const db = supabase();

  for (const line of lines) {
    const { data, error } = await db.rpc("decrement_stock", {
      p_product_id: line.productId,
      p_quantity: line.quantity,
    });

    if (error) {
      console.error(`[products] decrement_stock(${line.productId}) failed:`, error.message);
      outOfStock.push(line.productId);
      continue;
    }

    // The function returns boolean; false means not enough stock.
    if (data !== true) {
      outOfStock.push(line.productId);
    }
  }

  return outOfStock;
}
