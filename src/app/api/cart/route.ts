import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveUserId } from "@/lib/mobileAuth";
import { originFromRequest } from "@/lib/origin";
import { env } from "@/lib/env";
import { readCart, updateCartLine, clearCart, mergeCart } from "@/lib/cart";

/**
 * /api/cart - the cart, in the database, for BOTH the website and the mobile app.
 *
 * ONE ROUTE, TWO CLIENTS
 * The website calls this with its Auth.js cookie. The app calls it with
 * Authorization: Bearer <token>. resolveUserId() accepts either, so there is one
 * implementation of "what is in this person's basket" rather than two that can
 * drift apart - which is exactly the bug this task is about, so it is worth
 * avoiding by construction.
 *
 * NO CACHING, EVER
 * This response is different for every user and changes the moment anything is
 * added. Next.js is very good at caching GET routes and very willing to serve a
 * stale one; `force-dynamic` plus `revalidate = 0` makes that impossible rather
 * than merely unlikely. A cart that lags behind is not a cart.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_QUANTITY = 99;

const updateSchema = z.object({
  productId: z.string().uuid("Each cart line needs a valid product id."),
  quantity: z.number().int().min(0).max(MAX_QUANTITY),
  /**
   * "add" for the product page button, "set" for the stepper.
   *
   * Two modes because they are genuinely different operations. Tapping "add to
   * cart" on the same product twice should give you two; dragging the stepper to
   * 3 should give you three, not five. Making the caller state which one it means
   * keeps the ambiguity out of the server.
   */
  mode: z.enum(["add", "set"]).default("add"),
});

const mergeSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(MAX_QUANTITY),
      }),
    )
    .max(50),
});

/**
 * The header badge wants a count and the basket wants a total; send both.
 *
 * Image paths are made absolute here for the same reason /api/products does it:
 * they are stored root-relative, which next/image resolves against the site, and
 * which a React Native <Image> cannot resolve at all. Without the origin the
 * mobile app's cart falls back to the emoji column, and several of those render
 * as tofu boxes on iOS.
 */
function summarise(items: Awaited<ReturnType<typeof readCart>>, origin: string) {
  return {
    items: items.map((item) => ({
      ...item,
      imageUrl: item.imageUrl ? `${origin}${item.imageUrl}` : null,
    })),
    count: items.reduce((total, item) => total + item.quantity, 0),
    // Integer Kobo, display only. /api/checkout recalculates every price from
    // the database and ignores this number, exactly as it ignores the prices the
    // browser sends.
    subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
  };
}

/** Derived from the request, so this is right on localhost and on previews too. */
function originFor(request: Request): string {
  return originFromRequest(request, env.authUrl);
}

function unauthorized() {
  return NextResponse.json(
    { error: "Sign in to sync your cart." },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return unauthorized();

  return NextResponse.json(summarise(await readCart(userId), originFor(request)));
}

export async function POST(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That cart update is not valid." },
      { status: 400 },
    );
  }

  const { productId, quantity, mode } = parsed.data;
  const result = await updateCartLine(userId, {
    productId,
    quantity,
    absolute: mode === "set",
  });

  if (result.unknownProduct) {
    return NextResponse.json({ error: "That product does not exist." }, { status: 404 });
  }

  return NextResponse.json(summarise(await readCart(userId), originFor(request)));
}

/**
 * Fold a guest basket into the signed-in one.
 *
 * Called once, when somebody signs in while already holding a localStorage
 * basket. Quantities are summed, capped at stock by the database, so merging
 * cannot lose an item or create an unbuyable line.
 */
export async function PUT(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "That cart is not valid." }, { status: 400 });
  }

  return NextResponse.json(summarise(await mergeCart(userId, parsed.data.lines), originFor(request)));
}

export async function DELETE(request: Request) {
  const userId = await resolveUserId(request);
  if (!userId) return unauthorized();

  await clearCart(userId);
  return NextResponse.json(summarise([], originFor(request)));
}
