import { NextResponse } from "next/server";
import { z } from "zod";
import { createPairing, generateClaimSecret, PAIR_TTL_MINUTES } from "@/lib/devicePairing";
import { originFromRequest } from "@/lib/origin";
import { env } from "@/lib/env";

/**
 * POST /api/mobile/pair
 *
 * The phone's half of starting a sign-in: ask for a code, then show it.
 *
 * The phone generates its own `claimSecret` and keeps it. Only its SHA-256 goes
 * over the wire, so this endpoint learns nothing that would let it - or anyone
 * reading the database - impersonate the device later.
 *
 * The response includes a `pairUrl` so the app can show a QR code as well as the
 * typed code. Scanning is far less error-prone than typing eight characters off a
 * screen, and on Android the phone can open the URL on itself.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  claimSecret: z.string().min(16).max(200),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Could not start sign-in." }, { status: 400 });
  }

  try {
    const { code } = await createPairing(parsed.data.claimSecret);
    const origin = originFromRequest(request, env.authUrl);

    return NextResponse.json({
      ok: true,
      code,
      // Derived from the request, not configured, so the same build gives the
      // right URL on localhost, on the Vercel domain, and on previews.
      pairUrl: `${origin}/pair/${code}`,
      expiresInSeconds: PAIR_TTL_MINUTES * 60,
    });
  } catch (error) {
    console.error("[mobile/pair] could not create a pairing:", error);
    return NextResponse.json(
      { error: "Could not start sign-in. Please try again." },
      { status: 500 },
    );
  }
}

/**
 * GET /api/mobile/pair/claim-secret
 *
 * Hands the phone a claim secret to use.
 *
 * It is deliberately NOT what the app uses: a secret from this endpoint is a
 * secret the server issued, and a server-issued secret is only as private as the
 * endpoint. The app generates its own with the same construction
 * (crypto.randomBytes(32) -> base64url) so the plaintext never exists anywhere
 * but on the phone. This exists only so the pairing can be exercised from a
 * script or curl during testing, which is genuinely useful and does not weaken
 * the design - real clients are not expected to call it.
 */
export async function GET() {
  return NextResponse.json({ claimSecret: generateClaimSecret() });
}
