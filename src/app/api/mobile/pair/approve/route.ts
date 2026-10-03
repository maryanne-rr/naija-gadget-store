import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { approvePairing, PairingError } from "@/lib/devicePairing";

/**
 * POST /api/mobile/pair/approve
 *
 * Binds a pending pairing to whoever is signed in HERE, in the browser.
 *
 * This is the step that makes "the same account on both" true rather than
 * assumed: the account comes from the website's own Auth.js session, so it is the
 * same `users.id` a normal website sign-in would produce, and therefore the same
 * rows in cart_items.
 *
 * Unauthenticated callers get 401 rather than being treated as guests. A pairing
 * has to belong to a real account - the whole point is that the phone ends up
 * holding a token for somebody - so there is no guest version of this.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().trim().min(4).max(16),
});

export async function POST(request: Request) {
  const session = await getSession();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in before approving a device." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "That code is not valid." }, { status: 400 });
  }

  try {
    await approvePairing(parsed.data.code, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PairingError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    console.error("[mobile/pair/approve] failed:", error);
    return NextResponse.json(
      { error: "Could not approve that device. Please try again." },
      { status: 500 },
    );
  }
}
