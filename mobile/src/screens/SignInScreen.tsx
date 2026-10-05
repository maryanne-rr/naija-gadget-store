import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { AuthRequest, exchangeCodeAsync } from "expo-auth-session";
import { discovery } from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { createPairing, pollPairing, type PollResult } from "../api";
import { PAIR_POLL_MS, APP_SCHEME, GOOGLE_REDIRECT_PATH } from "../config";
import { androidClientId, codeFromRedirect, exchangeGoogleToken } from "../googleAuth";
import { readOrCreateClaimSecret, saveSession } from "../storage";
import { theme } from "../theme";

/**
 * Signing in on the phone.
 *
 * ONE BUTTON. The CODE IS NOT SHOWN.
 *
 * This used to display a pairing code and ask the person to open a browser and
 * type it in. That was honest about the mechanism and terrible as an experience:
 * eight characters, read off one screen and entered into another, with a spinner
 * in between telling you to wait for yourself.
 *
 * The pairing is still the mechanism - the phone cannot prove who it is on its
 * own, and it never sees a Google password - but it is invisible. Tapping the
 * button opens the browser at the right address with the code already in it. The
 * person picks an account, the page approves itself, and the browser hands them
 * back to the app. Nobody ever reads the code; the server uses it to know which
 * device asked.
 *
 * WHY A BROWSER, WHICH LOOKS LIKE THE LESSER OPTION
 * It is not one. A native app would normally run OAuth itself with a redirect the
 * OS can route back, and that code is here and working - but Google will not render
 * an account chooser for an Android OAuth client until that client has been through
 * app verification, which takes days and is not something this project can rush.
 * Until then the native path produces an "Access blocked" page from Google, so it
 * is a secondary control rather than the main button.
 *
 * The pairing also guarantees something native OAuth would not: the account comes
 * from the WEBSITE's own Auth.js session, so the phone is bound to the same
 * users.id by construction rather than by matching an email address.
 *
 * See supabase/006-device-pairing.sql for why the code is a credential-adjacent
 * secret and why the claim secret exists.
 */
/**
 * Hands the token AND the email back.
 *
 * The email is not decoration. AccountScreen decides signed-in versus signed-out
 * from it, and it is what the header shows. Passing only the token left the email
 * null after pairing, so the screen never left the sign-in branch - which is
 * exactly what happened: the app said "Signed in. Opening the shop..." and sat
 * there for eight minutes because something above it still believed nobody was
 * signed in.
 */
export function SignInScreen({
  onSignedIn,
}: {
  onSignedIn: (token: string, email: string | null) => void;
}) {
  const [phase, setPhase] = useState<
    "starting" | "native" | "waiting" | "connected" | "error"
  >("starting");
  const [error, setError] = useState("");

  /**
   * In a ref rather than state: the polling loop and the button both read it, and
   * a state change would tear the interval down and rebuild it on every render.
   */
  const pairRef = useRef<{ code: string; pairUrl: string } | null>(null);
  const claimRef = useRef<string | null>(null);

  /**
   * Whether the browser has been sent to yet.
   *
   * State, not a ref, because it decides what the button says - a ref read during
   * render is exactly the thing React warns about. It is also the polling effect's
   * trigger, which is the correct dependency: asking every two seconds at nobody,
   * before anyone has been sent anywhere, is pointless.
   */
  const [opened, setOpened] = useState(false);

  /**
   * Ask the server for a pairing. Touches no state before its first await.
   *
   * This one runs from an effect, and a synchronous setState in an effect body
   * cascades. The retry path resets the screen from a click handler instead, which
   * is a place where a reset is both allowed and needed.
   */
  const requestPairing = useCallback(async () => {
    try {
      if (!claimRef.current) {
        claimRef.current = await readOrCreateClaimSecret();
      }

      pairRef.current = await createPairing(claimRef.current);
      setPhase("waiting");
    } catch (cause) {
      setPhase("error");
      setError(cause instanceof Error ? cause.message : "Could not start sign-in.");
    }
  }, []);


  useEffect(() => {
    let cancelled = false;

    (async () => {
      // The claim secret is fetched here rather than inside requestPairing so the
      // await is visible in the effect body. requestPairing does await before it
      // touches state, but the lint rule cannot see through an async function call
      // to know that, and "trust me, it awaits" is exactly the kind of claim that
      // stops being true the moment somebody edits it.
      if (!claimRef.current) {
        claimRef.current = await readOrCreateClaimSecret();
      }

      if (!cancelled) void requestPairing();
    })();

    return () => {
      cancelled = true;
    };
  }, [requestPairing]);

  /**
   * Sign in with Google, inside the app.
   *
   * THE PRIMARY PATH. The account chooser appears here, with no browser and no
   * code. Google returns an id_token which the shop verifies and exchanges for a
   * bearer token, so the app never decides who it is.
   *
   * Any failure at all falls through to the browser pairing rather than showing an
   * error. That is deliberate: a sign-in button that can fail with nothing behind
   * it is a dead end, and the fallback is a working, already-tested path to the
   * same account. Someone who sees the browser instead learns nothing was lost.
   */
  const signInNatively = useCallback(async () => {
    try {
      setPhase("native");

      const request = new AuthRequest({
        clientId: androidClientId(),
        scopes: ["openid", "email", "profile"],
        // Must match a redirect URI registered against the Android client, and
        // must be the scheme Android can route back into this app. app.json
        // declares "scheme": "naija", and that declaration is what builds the
        // intent filter - so this string and app.json have to agree.
        redirectUri: `${APP_SCHEME}://${GOOGLE_REDIRECT_PATH}`,
        // THE AUTHORIZATION CODE FLOW, WITH PKCE
        //
        // The previous attempt asked for an id_token with usePKCE on, and Google
        // refused it precisely:
        //
        //   Parameter not allowed for this message type: code_challenge_method
        //
        // PKCE belongs to the code flow. An implicit-flow token is returned
        // directly by the authorisation endpoint, so there is nothing for a
        // verifier to bind to - and sending one anyway is a protocol error rather
        // than a harmless extra.
        //
        // So the code flow it is: Google returns a code, which is worthless on its
        // own, and the app redeems it with the verifier that generated it. The
        // token then comes from Google's token endpoint rather than the URL, which
        // is both the flow Google expects from a new public client and the one
        // where no credential ever passes through a browser address bar.
        responseType: "code",
        usePKCE: true,
      });

      // A browser tab that closes itself when it is done. Google renders the
      // account chooser here, so this IS the native sign-in - no web page of ours
      // in between, and no code.
      //
      // makeAuthUrlAsync rather than request.url, because the URL is not built
      // until the authorisation server's endpoints are known, and that is what
      // the discovery document is for. Reading .url would be null.
      const authUrl = await request.makeAuthUrlAsync(discovery);

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        `${APP_SCHEME}://${GOOGLE_REDIRECT_PATH}`,
      );

      // The result is a full URL rather than parsed parameters, and the code
      // arrives in the query string.
      if (result.type !== "success") {
        // dismissed or cancelled: the person changed their mind, which is not a
        // failure worth shouting about. The pairing is offered instead.
        setPhase("waiting");
        return;
      }

      const code = codeFromRedirect(result.url);

      if (!code) {
        setPhase("waiting");
        return;
      }

      // Redeem the code for tokens. The verifier is what proves this app is the
      // one that asked, so the code cannot be replayed by anything that merely
      // saw the redirect - and no client secret is needed, because Google treats
      // an Android client with PKCE as a public client.
      const tokens = await exchangeCodeAsync(
        {
          clientId: androidClientId(),
          code,
          redirectUri: `${APP_SCHEME}://${GOOGLE_REDIRECT_PATH}`,
          extraParams: { code_verifier: request.codeVerifier ?? "" },
        },
        discovery,
      );

      const idToken = tokens.idToken;

      if (!idToken) {
        // openid was requested, so there should always be one. A missing id_token
        // means the scope did not take, and guessing at which of the other token
        // fields to use instead would be worse than falling back.
        setPhase("waiting");
        return;
      }

      const session = await exchangeGoogleToken(idToken);

      await saveSession(session.token, session.user.email);
      setPhase("connected");
      onSignedIn(session.token, session.user.email);
    } catch {
      // Anything at all - no Google Play Services, no network, a token the shop
      // refused. The browser pairing is right there and is known to work.
      setPhase("waiting");
    }
  }, [onSignedIn]);

  /**
   * Open the browser at the pairing page.
   *
   * A pairing is fetched up front rather than on tap, so the button opens
   * something immediately instead of showing a spinner while a round trip happens.
   * If that first request failed, this retries once rather than opening a URL
   * that does not exist.
   */
  const openBrowser = useCallback(async () => {
    // A pairing is fetched up front rather than on tap, so the button opens
    // something immediately instead of showing a spinner while a round trip
    // happens. If the first request failed, or the code has been spent, this asks
    // for a new one rather than reopening a URL that cannot work.
    if (!pairRef.current || !claimRef.current) {
      await requestPairing();
    }

    const url = pairRef.current?.pairUrl;
    if (!url) return;

    try {
      await Linking.openURL(url);
      setOpened(true);
      // Leaving the error screen on success is done here rather than left to
      // requestPairing, which only runs when a new pairing was needed - so
      // retrying with the existing one used to keep showing "Could not sign in"
      // underneath the browser that had just opened.
      setPhase("waiting");
    } catch {
      setPhase("error");
      setError("Could not open a browser. Open the link on any other device instead.");
    }
  }, [requestPairing]);

  /**
   * Wait for the approval.
   *
   * Only runs once the browser has actually been opened. Polling before that would
   * be asking the same question every two seconds at nobody.
   *
   * Checks immediately when the app comes back to the foreground: the person has
   * been away signing in, and the phone has usually suspended this timer
   * entirely. Coming back to "waiting for you to approve it" for another two
   * seconds, straight after approving it, is what made this feel broken.
   *
   * The same check on a timer is the safety net for the case where the deep link
   * back does not fire - a desktop browser, or a platform where nothing handles
   * the scheme.
   */
  useEffect(() => {
    if (phase !== "waiting" || !opened) return;
    if (!pairRef.current || !claimRef.current) return;

    const { code } = pairRef.current;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      try {
        const result: PollResult = await pollPairing(code, claimRef.current!);

        if (cancelled) return;

        if (result.status === "ready") {
          // Persist first, then tell the app. If the process dies between the two,
          // the token is still on disk and the next launch signs in - the other
          // order leaves a device that forgets on restart.
          await saveSession(result.token, result.user.email);
          setPhase("connected");
          onSignedIn(result.token, result.user.email);
          return;
        }

        if (result.status === "denied") {
          // Somebody pressed decline. Offer a fresh pairing rather than sitting on
          // a dead one.
          pairRef.current = null;
          setPhase("error");
          setError("That device was not approved.");
          return;
        }

        if (result.status === "expired") {
          pairRef.current = null;
          setPhase("error");
          setError("That took too long. Try again.");
          return;
        }
      } catch {
        // A dropped request must not end the attempt - mobile data blips. Keep
        // polling and let the server be the one to say it has expired.
      }

      if (!cancelled) {
        timer = setTimeout(check, PAIR_POLL_MS);
      }
    }

    void check();

    const checkRef = { current: check };

    const onForeground = (next: string) => {
      if (next !== "active") return;
      if (timer) clearTimeout(timer);
      void checkRef.current();
    };

    const subscription = AppState.addEventListener("change", onForeground);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [phase, opened, onSignedIn]);

  if (phase === "connected") {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={theme.brand} />
        <Text style={styles.body}>Signed in. Opening the shop…</Text>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Could not sign in</Text>
        <Text style={styles.body}>{error}</Text>

        {/* The retry is the same path as the main button, and it asks for a fresh
            pairing first.

            That last part matters: the common way to land here is an expired or
            spent code, and reopening the old URL would just be another failure. The
            two buttons also do not sit in the same order as the sign-in screen,
            which used to lead with native here and put the working path underneath
            as if it were a lesser option. */}
        <Pressable
          onPress={() => {
            pairRef.current = null;
            void openBrowser();
          }}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
        >
          <GoogleMark />
          <Text style={styles.buttonText}>Continue with Google</Text>
        </Pressable>

        <Pressable
          onPress={() => void signInNatively()}
          style={styles.linkButton}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>Sign in here instead, without leaving the app</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.body}>
        Your cart follows you between this app and the website.
      </Text>

      <Pressable
        onPress={() => void openBrowser()}
        disabled={phase === "starting"}
        style={({ pressed }) => [
          styles.button,
          phase === "starting" && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
      >
        {phase === "starting" ? (
          <ActivityIndicator size="small" color={theme.white} />
        ) : (
          <>
            <GoogleMark />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </>
        )}
      </Pressable>

      {/* Native sign-in, demoted.

        It used to be the primary button and it still is not usable: Google refuses
        to show an account chooser for this Android OAuth client until the client has
        been through app verification, which is a queue measured in days, not a bug.

        Leaving it as the primary meant that somebody tapping "Continue with Google"
        was shown "Access blocked: Authorization Error" by Google before the working
        path ever ran. An error page is a worse first impression than a browser tab,
        and it made a working flow look broken.

        It is kept because it is the better experience the day verification lands, and
        because it is the only path that works when Google Play Services is missing or
        the network is captive-portal wifi. One line, plainly labelled, rather than a
        fallback that only appears after something has visibly failed - a control you
        have to go looking for reads as the real button, and the one above reads as the
        safety net. */}
      <Pressable
        onPress={() => void signInNatively()}
        disabled={phase === "starting" || phase === "native"}
        style={styles.linkButton}
        accessibilityRole="button"
      >
        {phase === "native" ? (
          <ActivityIndicator size="small" color={theme.brand} />
        ) : (
          <Text style={styles.linkText}>Sign in here instead, without leaving the app</Text>
        )}
      </Pressable>

      {phase === "waiting" ? (
        <View style={styles.waitingRow}>
          <ActivityIndicator size="small" color={theme.brand} />
          <Text style={styles.waitingText}>
            {opened ? "Waiting for you to finish in the browser…" : "Ready"}
          </Text>
        </View>
      ) : null}

      <Text style={styles.footnote}>
        This app never sees your Google password.
      </Text>
    </View>
  );
}

/**
 * Google's mark, required by their brand guidelines on anything that says
 * "Continue with Google".
 *
 * react-native-svg rather than an <svg> element, which does not exist in React
 * Native - and rather than a PNG, which would have to be scaled and would go soft
 * on a high-density screen. Same paths as src/components/GoogleSignInButton.tsx on
 * the website, so the two buttons are visibly the same button.
 */
function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <Path
        fill="#FBBC05"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "stretch" },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.ink,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14.5,
    color: theme.inkMuted,
    marginTop: 6,
    lineHeight: 21,
  },

  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.brand,
    borderRadius: theme.radius,
    paddingVertical: 15,
    marginTop: 18,
    minHeight: 52,
  },
  buttonPressed: { backgroundColor: theme.brandBright },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: theme.white, fontWeight: "800", fontSize: 15 },
  mark: { width: 18, height: 18 },

  // minHeight 44 and centred, rather than padding around 13px text.
  //
  // Measured in the rendered app: this came out 29px tall, because padding: 6
  // around a line of text is not a touch target. It is the secondary path now
  // rather than the fallback - so it is not what somebody reaches for first - but
  // a 29px control is still a control somebody tries to hit and misses, and a
  // missed sign-in tap is the one failure this screen cannot afford.
  linkButton: { marginTop: 10, minHeight: 44, paddingHorizontal: 8, justifyContent: "center" },
  linkText: {
    color: theme.inkMuted,
    fontSize: 13,
    textAlign: "center",
    textDecorationLine: "underline",
  },

  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    justifyContent: "center",
  },
  waitingText: { color: theme.inkMuted, fontSize: 13.5 },

  footnote: {
    fontSize: 11.5,
    color: theme.inkMuted,
    marginTop: 20,
    textAlign: "center",
    lineHeight: 17,
  },
});
