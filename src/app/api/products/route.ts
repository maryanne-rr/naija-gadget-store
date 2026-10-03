import { NextResponse } from "next/server";
import { listProducts } from "@/lib/products";
import { CATEGORIES } from "@/lib/catalog";

/**
 * GET /api/products - the catalogue, as JSON.
 *
 * The storefront is server-rendered, so before this the only way to get the
 * catalogue into a program was to scrape the HTML. The mobile app needs the
 * actual data - real ids to add to the cart with, real stock levels, real prices -
 * and parsing rendered markup for those is fragile in a way that fails quietly.
 *
 * PUBLIC, DELIBERATELY
 * No session required. Browsing does not need an account, and the mobile app
 * should show the shop before it asks anybody to sign in - asking for a login
 * before showing a shop is a good way to lose the person.
 *
 * Nothing secret is in here: it is the same data rendered on every product page.
 * Prices are included so the app can show a running total, and /api/checkout
 * recalculates every one of them from the database before anything is charged.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await listProducts();

  return NextResponse.json({
    products: products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      tagline: product.tagline,
      spec: product.spec,
      price: product.price,
      compareAtPrice: product.compare_at_price,
      imageUrl: product.image_url,
      emoji: product.emoji,
      stock: product.stock,
      category: product.category,
      deal: product.deal,
    })),
    categories: CATEGORIES.map((category) => ({
      slug: category.slug,
      name: category.name,
    })),
  });
}
