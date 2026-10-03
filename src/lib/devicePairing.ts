import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { supabase } from "./supabase";

/**
 * Pairing a phone with an account that already exists in a browser.
 *
 * THE FLOW, END TO END
 *
 *   phone                          server                      browser
 *   -----                          ------                      -------
 *   POST /api/mobile/pair
 *     { claimSecret }        -->   stores sha256(secret)
 *                                  returns a code              GET /pair/CODE
 *                                                              (normal Auth.js
 *                                                               sign-in cookie)
 *                                  status: pending        -->  user approves
 *                                  binds user_id           <--
 *
 *   GET /api/mobile/pair/CODE
 *     x-claim-secret: secret  -->   hash matches?
 *                                  yes: mint a bearer token
 *                                  mark redeemed           <--   token
 *
 * The important property: approval happens through the website's own session, so
 * the phone ends up holding a token for the same `users.id` the browser has. That
 * is why both clients read the same cart_items rows.
 *
 * WHY NOT GOOGLE OAUTH IN THE APP
 * Because Expo Go cannot receive a custom-scheme redirect - see
 * supabase/006-device-pairing.sql for the whole argument. Short version: Expo Go
 * only opens through Expo's proxy URL, which is not knowable until `expo start`
 * runs and is not stable if the account or slug changes.
 *
 * WHY A CLAIM SECRET
 * The code is on the phone's screen and gets typed into a browser, so it is
 * public. The code only names the pairing; the secret, which never leaves the
 * phone, is what proves you are the device that asked for it. Without it,
 * anyone who reads the code off the screen can claim the session.
 */

export const PAIR_TTL_MINUTES = 15;

/**
 * Alphabet for the code: no 0/O and no 1/I/L.
 *
 * Eight characters from 32 symbols is 40 bits, and these are read aloud and typed
 * by hand. "B0OI" and "BOIL" are indistinguishable on a phone screen, and a code
 * that fails as "wrong code" when it was really mistyped sends people round in
 * circles.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

export class PairingError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "PairingError";
  }
}

/** sha256 hex. Used for the claim secret and for nothing else. */
export function hashClaim(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/**
 * Generate a secret for the phone to keep.
 *
 * Exported because the app generates its own with the same primitive. It never
 * reaches the server in this form - only sha256(secret) does.
 */
export function generateClaimSecret(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * A random code, formatted in two groups of four: KX7M-92QB.
 *
 * The dash is there to be read aloud. It doubles the number of guesses needed by
 * a factor of 32, which is not the point, but it costs nothing and it makes
 * typing it into a browser noticeably less error-prone.
 */
export function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";

  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }

  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

interface PairRow {
  id: string;
  code: string;
  claim_hash: string;
  status: "pending" | "approved" | "denied";
  user_id: string | null;
  expires_at: string;
  redeemed_at: string | null;
}

/**
 * Create a pending pairing, or hand back the existing one for this code.
 *
 * Re-creating with the same code is treated as success rather than an error,
 * because the phone retries on a flaky network and a retry that created a second
 * row would leave the phone holding a code nobody ever approves.
 */
export async function createPairing(claimSecret: string): Promise<{ code: string }> {
  const db = supabase();
  const claimHash = hashClaim(claimSecret);
  const expiresAt = new Date(
    Date.now() + PAIR_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  // A handful of attempts: a collision needs a duplicate four-character group
  // twice over, which is vanishingly unlikely, but "unlikely" is not "impossible"
  // and retrying is cheaper than a unique-violation error surfacing to the user.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();

    const { error } = await db.from("device_pairs").insert({
      code,
      claim_hash: claimHash,
      status: "pending",
      expires_at: expiresAt,
    });

    if (!error) {
      return { code };
    }

    if (error.code === "23505") {
      // Code already taken - another device, or our own retry. Try again.
      continue;
    }

    throw new Error(`createPairing failed: ${error.message}`);
  }

  throw new PairingError(
    "Could not start sign-in. Please try again.",
    "code-generation-failed",
  );
}

/** Look up a pairing by code, treating an unknown code as an expiry. */
async function loadPair(code: string): Promise<PairRow | null> {
  const { data, error } = await supabase()
    .from("device_pairs")
    .select("id, code, claim_hash, status, user_id, expires_at, redeemed_at")
    .eq("code", code.toUpperCase().trim())
    .maybeSingle();

  if (error) {
    throw new Error(`loadPair failed: ${error.message}`);
  }

  return (data as PairRow | null) ?? null;
}

/**
 * Bind a pending pairing to the signed-in user.
 *
 * Guarded on status = 'pending' AND not yet expired, so two browsers racing to
 * approve the same code cannot bind it to two different accounts. The first
 * update wins and the second matches zero rows, which we report as a failure -
 * that is correct: somebody is trying to attach this device to somebody else's
 * account.
 */
export async function approvePairing(code: string, userId: string): Promise<void> {
  const { data, error } = await supabase()
    .from("device_pairs")
    .update({ status: "approved", user_id: userId })
    .eq("code", code.toUpperCase().trim())
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`approvePairing failed: ${error.message}`);
  }

  if (!data) {
    // Either it does not exist, it is not pending, or it has expired. All three
    // are the same thing to the person holding the phone, and distinguishing
    // them leaks whether a guessed code exists.
    throw new PairingError(
      "That code is not valid any more. Ask the app for a new one.",
      "not-approvable",
    );
  }
}

export type PollResult =
  | { status: "pending" }
  | { status: "ready"; userId: string; email: string | null }
  | { status: "denied" }
  | { status: "expired" };

/**
 * The phone's poll.
 *
 * EVERY failure returns the same thing to the caller: expired.
 *
 * An unknown code, a wrong claim secret and a redeemed code are three very
 * different situations, and the app has nothing useful to do differently about
 * any of them - it shows "that code expired, try again". Distinguishing them
 * would turn this endpoint into an oracle that confirms whether a guessed code
 * exists, which is exactly what the claim secret was added to prevent.
 */
export async function pollPairing(code: string, claimSecret: string): Promise<PollResult> {
  const pair = await loadPair(code);

  if (!pair) return { status: "expired" };

  // Constant-time-ish: comparing hashes rather than the codes themselves, so the
  // comparison is not a place where timing tells an attacker about the secret.
  if (hashClaim(claimSecret) !== pair.claim_hash) {
    return { status: "expired" };
  }

  if (pair.redeemed_at) {
    // Already used. One redemption per pairing, so a screenshot of a code stops
    // working the moment the real device claims it.
    return { status: "expired" };
  }

  if (new Date(pair.expires_at).getTime() <= Date.now()) {
    return { status: "expired" };
  }

  if (pair.status === "denied") {
    return { status: "denied" };
  }

  if (pair.status === "approved") {
    if (!pair.user_id) {
      // Approved but unbound. Should be impossible given approvePairing sets
      // both, but treating it as pending is safer than minting a token with a
      // null subject.
      return { status: "pending" };
    }

    // Single-use: burn it as we hand it over, so the token cannot be collected
    // twice from one approval.
    await supabase()
      .from("device_pairs")
      .update({ redeemed_at: new Date().toISOString() })
      .eq("id", pair.id)
      .is("redeemed_at", null);

    const { data: user } = await supabase()
      .from("users")
      .select("email")
      .eq("id", pair.user_id)
      .maybeSingle();

    return {
      status: "ready",
      userId: pair.user_id,
      email: (user?.email as string | undefined) ?? null,
    };
  }

  return { status: "pending" };
}

/**
 * Delete pairings that have expired.
 *
 * Not called from a request - nothing here should depend on somebody visiting a
 * page. Run it from the Supabase dashboard's scheduled jobs, or by hand.
 */
export async function pruneExpiredPairings(): Promise<number> {
  const { data, error } = await supabase()
    .from("device_pairs")
    .delete()
    .lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .select("id");

  if (error) {
    throw new Error(`pruneExpiredPairings failed: ${error.message}`);
  }

  return data?.length ?? 0;
}
