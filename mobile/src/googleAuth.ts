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
 * Pull a single value out of the URL Google redirected back to.
 *
 * WHY `sources` IS A LIST AND NOT A SEARCH ORDER
 * Which parts of the URL are acceptable depends entirely on what the value is:
 *
 *   an authorization code arrives in the QUERY STRING. It is not a credential - it
 *   is worthless without the verifier only this app holds - so a query is the right
 *   place for it, and both parts are searched for convenience.
 *
 *   an id_token arrives in the FRAGMENT, and it IS a live credential for the
 *   person's account. A query string is what ends up in server access logs, in
 *   Referer headers and in browser history. So the fragment is the ONLY place it
 *   is read from - not "preferred", not "first", only.
 *
 * The distinction matters because the looser version passes every test that only
 * feeds it a well-formed URL: the token is right where Google put it, so the
 * function appears to work. The two only differ when something is WRONG, which is
 * exactly when it must not be trusted.
 */
function valueFromRedirect(
  url: string,
  key: string,
  sources: ("query" | "fragment")[],
): string | null {
  const queryAt = url.indexOf("?");
  const fragmentAt = url.indexOf("#");

  const query =
    queryAt === -1
      ? null
      : url.slice(queryAt + 1, fragmentAt === -1 ? url.length : Math.max(fragmentAt, queryAt));

  const fragment = fragmentAt === -1 ? null : url.slice(fragmentAt + 1);

  for (const part of sources) {
    const source = part === "query" ? query : fragment;
    if (source === null) continue;

    for (const pair of source.split("&")) {
      const [name, value] = pair.split("=");
      if (name !== key) continue;

      try {
        return decodeURIComponent(value ?? "");
      } catch {
        return value ?? null;
      }
    }
  }

  return null;
}

/**
 * The authorization code, which arrives in the query string.
 *
 * The fragment is searched too: Google does not put a code there, so nothing is
 * gained by pretending it cannot appear, and nothing is lost.
 */
export function codeFromRedirect(url: string): string | null {
  return valueFromRedirect(url, "code", ["query", "fragment"]);
}

/**
 * The id_token, which arrives in the fragment.
 *
 * Fragment only. There is no fallback to the query, because there is no legitimate
 * case for one and a token in a query string is a credential in whatever logs the
 * URL.
 */
export function idTokenFromRedirect(url: string): string | null {
  return valueFromRedirect(url, "id_token", ["fragment"]);
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
