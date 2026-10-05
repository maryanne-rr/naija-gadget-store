import "server-only";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { env } from "./env";
import { supabase } from "./supabase";
import { getSession } from "./auth";

/**
 * Signing in from the mobile app.
 *
 * THE PROBLEM THIS SOLVES
 * The website authenticates with Auth.js, which stores the session in an httpOnly
 * cookie scoped to the shop's own domain. A native app cannot use that cookie:
 * it has no cookie jar for someone else's domain, and it could not read the
 * cookie if it did. So "log in with the same account" is not a matter of sharing
 * a login screen - the two clients need different ways of proving who they are.
 *
 * So the app proves it with a bearer token instead:
 *
 *   1. The app signs in with Google itself, using the SAME client id as the
 *      website, and gets back Google's id_token.
 *   2. It POSTs that token to /api/mobile/session.
 *   3. The server verifies it with Google - signature, issuer, audience, expiry -
 *      and looks up the user BY EMAIL in the users table the website already uses.
 *      That lookup is the whole trick: same Google account means same email means
 *      same row means same id, so the app and the website are literally the same
 *      account and read the same cart.
 *   4. The server signs its own short token with AUTH_SECRET and hands that back.
 *
 * FROM THEN ON
 * The app sends Authorization: Bearer <token> on every request. resolveUserId()
 * below accepts that token OR the website's cookie, which is why /api/cart is
 * one route serving both clients rather than two near-identical ones.
 */

const ISSUER = "naija-gadget-store-mobile";
const AUDIENCE = "naija-gadget-store-mobile";
const TOKEN_TTL = "30d";

/**
 * Google's public signing keys, fetched once and cached.
 *
 * createRemoteJWKSet does the right thing on rotation: it refetches when it sees
 * a key id it does not recognise, which is what happens the day Google rotates
 * its keys and would otherwise log every user out.
 */
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

/**
 * Google reports its issuer in two forms depending on which endpoint minted the
 * token, and both are legitimate.
 */
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GoogleIdentity {
  email: string;
  name: string;
  picture: string | null;
}

/**
 * Verify a Google id_token and return who it belongs to.
 *
 * EVERY claim here is checked, and the checks are the point. Verifying only the
 * signature would accept a token minted for a completely different application -
 * any token Google ever issued to anyone, replayed at this endpoint. The audience
 * check is what binds the token to THIS shop.
 *
 * WHICH AUDIENCES COUNT
 * The website's client, and the Android client the app signs in with. Both belong
 * to this application in this Google Cloud project, and both end up here doing the
 * identical thing, so accepting either does not widen who can sign in - only which
 * client may ask. Anything else is refused, which is what stops a token minted for
 * some unrelated app being replayed at this endpoint.
 *
 * jose takes an array here, which is a far better fit than a hand-built pattern -
 * no escaping to get wrong, and the comparison is exact by construction.
 *
 * `email_verified` is required. Without it a token for an unverified address
 * would create a users row and a cart that the real owner of that address could
 * never see or claim.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const audiences = [env.googleClientId, env.googleAndroidClientId].filter(
    (value): value is string => Boolean(value),
  );

  if (audiences.length === 0) {
    throw new MobileAuthError(
      "Google sign-in is not configured on the server.",
      "google-not-configured",
    );
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, googleKeys, {
      issuer: GOOGLE_ISSUERS,
      audience: audiences,
    }));
  } catch (error) {
    // Deliberately does not include the error's message in the client-facing
    // text: jose's failures mention key ids and expected audiences, which is
    // more detail than a caller needs and more than a stranger should be told.
    throw new MobileAuthError(
      "That Google sign-in could not be verified. Please try again.",
      "invalid-google-token",
      error,
    );
  }

  if (typeof payload.email !== "string" || payload.email.length === 0) {
    throw new MobileAuthError(
      "Google did not return an email address for that account.",
      "no-email",
    );
  }

  if (payload.email_verified !== true && payload.email_verified !== "true") {
    throw new MobileAuthError(
      "That Google account's email address is not verified.",
      "email-unverified",
    );
  }

  return {
    // Lowercased because users.email is compared exactly. Google already returns
    // lowercase in practice, but a mixed-case token must not silently create a
    // second account for the same person.
    email: payload.email.toLowerCase(),
    name: typeof payload.name === "string" ? payload.name : "",
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

export class MobileAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "MobileAuthError";
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * Find the account for a Google identity, creating it if this is a first sign-in.
 *
 * THIS IS WHERE "SAME ACCOUNT ON BOTH" IS ACTUALLY ENFORCED.
 * The key is the email, not anything the app sends. Whoever signs in with
 * maryanneomage@gmail.com on the website and whoever signs in with the same
 * address on the phone both land on the same users.id, and cart_items.user_id
 * is that id - so they are looking at one basket, not two that resemble each
 * other.
 *
 * Note what this does NOT do: it does not create a second OAuth account row. The
 * accounts table is written by Auth.js when the *website* signs in. A user who
 * only ever uses the app has a users row but no accounts row, which is fine -
 * accounts is only needed to make Auth.js's own session machinery work.
 */
export async function findOrCreateUser(identity: GoogleIdentity): Promise<string> {
  const db = supabase();

  const { data: existing, error: lookupError } = await db
    .from("users")
    .select("id")
    .eq("email", identity.email)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`findOrCreateUser lookup failed: ${lookupError.message}`);
  }

  if (existing) {
    return existing.id as string;
  }

  const { data: created, error: createError } = await db
    .from("users")
    .insert({
      email: identity.email,
      name: identity.name || null,
      image: identity.picture,
      email_verified: new Date(),
    })
    .select("id")
    .single();

  if (createError) {
    // Two devices can complete a first sign-in at the same instant. Both miss
    // the lookup, both insert, and the unique constraint on users.email rejects
    // the loser. That is the constraint doing its job, so re-read and carry on
    // rather than surfacing an error the user cannot act on.
    if (createError.code === "23505") {
      const { data: raced, error: retryError } = await db
        .from("users")
        .select("id")
        .eq("email", identity.email)
        .maybeSingle();

      if (retryError) {
        throw new Error(`findOrCreateUser retry failed: ${retryError.message}`);
      }
      if (raced) return raced.id as string;
    }

    throw new Error(`findOrCreateUser insert failed: ${createError.message}`);
  }

  return created.id as string;
}

/** HMAC key for our own tokens. The same AUTH_SECRET the website uses. */
function signingKey(): Uint8Array {
  if (!env.authSecret) {
    throw new MobileAuthError(
      "AUTH_SECRET is not set, so mobile tokens cannot be signed.",
      "no-auth-secret",
    );
  }
  return new TextEncoder().encode(env.authSecret);
}

/** Mint a bearer token for the app. */
export async function issueMobileToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(signingKey());
}

/**
 * Check a bearer token, returning the user id or null.
 *
 * Null covers every failure - bad signature, expired, wrong audience, malformed -
 * because the caller cannot act on the difference and must not reveal it.
 */
export async function verifyMobileToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * Work out who is making this request, from either client.
 *
 * Order matters, and the Bearer case deliberately does NOT fall through to the
 * cookie. If a request presents a token we cannot verify, the answer is "no" -
 * not "let me check the cookie jar instead". Falling through would mean a broken
 * or forged token silently succeeded whenever a cookie happened to be present,
 * which is the shape of an authentication bypass.
 *
 * A token that verifies but names an account which no longer exists is also
 * rejected. Tokens outlive the rows they point at when somebody deletes their
 * account, and the sign-out path on the website has no way to revoke a token it
 * never issued.
 */
export async function resolveUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");

  if (header) {
    if (!header.startsWith("Bearer ")) {
      return null;
    }

    const userId = await verifyMobileToken(header.slice("Bearer ".length).trim());
    if (!userId) return null;

    const { data: stillThere, error } = await supabase()
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[mobile-auth] could not confirm the account still exists:", error.message);
      return null;
    }

    return stillThere ? (stillThere.id as string) : null;
  }

  // No Authorization header: this is the website, carrying its Auth.js cookie.
  const session = await getSession();
  return session?.user?.id ?? null;
}
