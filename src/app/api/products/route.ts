import { NextResponse } from "next/server";
import { listProducts } from "@/lib/products";
import { CATEGORIES } from "@/lib/catalog";
import { originFromRequest } from "@/lib/origin";
import { env } from "@/lib/env";

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

export async function GET(request: Request) {
  const products = await listProducts();

  // Product photos are stored as root-relative paths ("/products/x.jpg").
  //
  // That is the right thing for next/image, which resolves them against the site
  // itself. It is useless to anything else: a React Native <Image> given
  // "/products/x.jpg" has no idea which host to ask for, so every product photo
  // silently failed to load and the app showed an empty grey box.
  //
  // So the origin is attached here, derived from the request rather than
  // configured - the same reasoning as originFromRequest in lib/origin.ts. The
  // result is correct on localhost, on the Vercel domain and on previews, and
  // the phone resolves the image itself.
  const origin = originFromRequest(request, env.authUrl);

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
      imageUrl: product.image_url ? `${origin}${product.image_url}` : null,
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
