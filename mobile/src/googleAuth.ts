import { API_URL } from "./config";

/**
 * Trading a Google id_token for one of ours.
 *
 * THE NATIVE PATH
 * The app runs Google OAuth itself, with the Android client id from the Google
 * Cloud project, and posts the id_token here. The account chooser appears inside
 * the app and there is no browser at all.
 *
 * It needs a second OAuth client because the website's is a *Web application*
 * type, and Google will not accept a custom-scheme redirect URI on a Web client.
 * The Android client is registered against com.naijagadgets.store and the signing
 * key's SHA-1 - both of which are properties of the built app, which is exactly
 * why this could not work until there was an APK rather than an Expo Go session.
 *
 * The server accepts either client's token: they are the same application in the
 * same project and end up doing the identical thing here, so accepting both widens
 * which client may ask without widening who can. See verifyGoogleIdToken in
 * src/lib/mobileAuth.ts.
 *
 * THE FALLBACK, AND WHY IT IS NOT DEAD CODE
 * If native sign-in is unavailable or fails, the app falls back to pairing through
 * a browser. That is not a leftover: the phone cannot be assumed to be able to run
 * a Google sign-in, and a sign-in button with no way back is a dead end rather
 * than a graceful degradation. Two paths, one destination, and the same users row
 * either way.
 */

/** The Android client id, sent by the app from its own build. */
const GOOGLE_ANDROID_CLIENT_ID =
  "844288978655-le00ebd16bkg191p6rl3jgar36o3sbhc.apps.googleusercontent.com";

export function androidClientId(): string {
  return GOOGLE_ANDROID_CLIENT_ID;
}

export interface MobileSessionResponse {
  ok: true;
  token: string;
  user: { id: string; email: string | null; name: string | null };
}

/**
 * Pull the id_token out of the URL Google redirected back to.
 *
 * WHY THIS IS PARSED BY HAND
 * expo-web-browser hands back the whole redirect URL, not parsed parameters. Two
 * shapes have to be handled, and mixing them up is the classic OAuth mistake:
 *
 *   naija://callback#id_token=xxx&...   implicit flow - the FRAGMENT
 *   naija://callback?id_token=xxx&...   the query string
 *
 * The fragment is checked first because that is where the implicit flow puts it,
 * and a token in a query string is the one that leaks into server logs. Taking the
 * query first would "work" for PKCE and quietly send an id_token through every
 * access log on the way - which is why the order here is the other way round.
 *
 * Returns null rather than throwing: a missing token is a failed sign-in, and the
 * caller already has a fallback for that.
 */
export function idTokenFromRedirect(url: string): string | null {
  const fragmentAt = url.indexOf("#");
  const queryAt = url.indexOf("?");

  // The fragment wins if it is present, even when a query string is there too.
  let source: string | null = null;

  if (fragmentAt !== -1) {
    source = url.slice(fragmentAt + 1);
  } else if (queryAt !== -1) {
    const end = url.indexOf("#", queryAt);
    source = end === -1 ? url.slice(queryAt + 1) : url.slice(queryAt + 1, end);
  }

  if (!source) return null;

  for (const pair of source.split("&")) {
    const [key, value] = pair.split("=");
    if (key !== "id_token") continue;
    try {
      // Google percent-encodes the token, which contains characters that are
      // meaningful in a URL.
      return decodeURIComponent(value ?? "");
    } catch {
      return value ?? null;
    }
  }

  return null;
}

/**
 * Exchange a Google id_token for a bearer token for this shop.
 *
 * The id_token is verified with Google's public keys, its audience is checked
 * against our own client ids, and the email must be a verified one. Only then is it
 * resolved to a users row and a token minted - so the app never decides who it is.
 */
export async function exchangeGoogleToken(idToken: string): Promise<MobileSessionResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/mobile/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    throw new Error("Cannot reach the shop. Check your connection.");
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `The shop returned an error (${response.status}).`;

    throw new Error(message);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("token" in payload) ||
    typeof (payload as { token: unknown }).token !== "string"
  ) {
    throw new Error("The shop sent back something unexpected.");
  }

  return payload as MobileSessionResponse;
}
