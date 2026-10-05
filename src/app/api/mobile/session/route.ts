import { NextResponse } from "next/server";
import { withCors } from "@/lib/cors";
import { z } from "zod";
import {
  findOrCreateUser,
  issueMobileToken,
  MobileAuthError,
  verifyGoogleIdToken,
} from "@/lib/mobileAuth";

/**
 * POST /api/mobile/session
 *
 * Trades a Google id_token for a token this shop issues.
 *
 * The app signs in with Google using the same client id as the website, then
 * sends the resulting id_token here. The server verifies it with Google and
 * replies with a bearer token to send on subsequent requests.
 *
 * WHY NOT HAVE THE APP USE THE WEBSITE'S COOKIE
 * Because it cannot. The website's session cookie is httpOnly and scoped to the
 * shop's domain; a native app has no cookie jar for a domain it does not own,
 * and could not read the cookie even if it did. See src/lib/mobileAuth.ts for
 * the full reasoning.
 *
 * WHY THE SAME GOOGLE CLIENT ID MATTERS
 * verifyGoogleIdToken() checks the token's audience against AUTH_GOOGLE_ID. A
 * second OAuth client for the app would produce tokens with a different
 * audience, which would be rejected - correctly, since a token minted for some
 * other application is not proof of anything about this one.
 */

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  idToken: z.string().min(20, "Sign in with Google first."),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return withCors(
      NextResponse.json({ error: "Could not read the request body." }, { status: 400 }),
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return withCors(
      NextResponse.json(
        { error: "That sign-in could not be read. Please try again." },
        { status: 400 },
      ),
    );
  }

  try {
    const identity = await verifyGoogleIdToken(parsed.data.idToken);
    const userId = await findOrCreateUser(identity);
    const token = await issueMobileToken(userId, identity.email);

    return withCors(
      NextResponse.json({
        ok: true,
        token,
        user: { id: userId, email: identity.email, name: identity.name },
      }),
    );
  } catch (error) {
    // A bad token is the caller's problem and gets a specific code so the app
    // can tell "try again" apart from "this account cannot be used".
    if (error instanceof MobileAuthError) {
      const status = error.code === "no-auth-secret" || error.code === "google-not-configured" ? 503 : 401;
      return withCors(
        NextResponse.json({ error: error.message, code: error.code }, { status }),
      );
    }

    console.error("[mobile/session] unexpected failure:", error);
    return withCors(
      NextResponse.json(
        { error: "Something went wrong signing you in. Please try again." },
        { status: 500 },
      ),
    );
  }
}

export const OPTIONS = () =>
  withCors(new NextResponse(null, { status: 204 }) as unknown as NextResponse);
