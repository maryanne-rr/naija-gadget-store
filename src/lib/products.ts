import "server-only";
import { demoProducts, type Product } from "./catalog";
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
      return (data ?? []) as Product[];
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
      return (data as Product | null) ?? null;
    },
    () => demoProducts.find((p) => p.slug === slug) ?? null,
    "getProductBySlug",
  );
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

      const found = (data ?? []) as Product[];
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
