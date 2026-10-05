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
import { createPairing, pollPairing, type PollResult } from "../api";
import { PAIR_POLL_MS } from "../config";
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
 * own, and it never sees a Google password - but it is now invisible. Tapping the
 * button opens the browser at the right address with the code already in it. The
 * person signs in with Google, presses Connect, and the browser hands them back
 * to the app. Nobody ever reads the code; the server uses it to know which device
 * asked.
 *
 * WHY A BROWSER RATHER THAN GOOGLE OAUTH DIRECTLY
 * A native app would normally run OAuth itself with a redirect the OS can route
 * back. Expo Go could not do that - it only opens through Expo's proxy - and
 * although the app is now a standalone build, doing it properly needs a second,
 * Android-type OAuth client in Google Cloud with the signing key's SHA-1. That is
 * two fiddly steps for a flow that works today.
 *
 * The pairing also guarantees something native OAuth would not: the account comes
 * from the WEBSITE's own Auth.js session, so the phone is bound to the same
 * users.id by construction rather than by matching an email address.
 *
 * See supabase/006-device-pairing.sql for why the code is a credential-adjacent
 * secret and why the claim secret exists.
 */
export function SignInScreen({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [phase, setPhase] = useState<"starting" | "waiting" | "connected" | "error">(
    "starting",
  );
  const [error, setError] = useState("");

  // In a ref rather than state: the polling loop and the button both read it, and
  // a state change would tear the interval down and rebuild it on every render.
  const pairRef = useRef<{ code: string; pairUrl: string } | null>(null);
  const claimRef = useRef<string | null>(null);

  /**
   * Whether the browser has been sent to yet.
   *
   * State, not a ref, because it decides what the button says - a ref read during
   * render is exactly the thing React warns about. It is also the polling
   * effect's trigger, which is the correct dependency: asking every two seconds at
   * nobody, before anyone has been sent anywhere, is pointless.
   */
  const [opened, setOpened] = useState(false);

  /**
   * Ask the server for a pairing. Touches no state before its first await.
   *
   * Split from startPairing() below for that reason: this one runs from an effect,
   * and a synchronous setState in an effect body cascades. The reset is only ever
   * needed for a retry, which is a click handler.
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

  /** Retry path: reset the screen, forget the old pairing, ask again. */
  const startPairing = useCallback(() => {
    pairRef.current = null;
    setPhase("starting");
    setError("");
    setOpened(false);
    void requestPairing();
  }, [requestPairing]);

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
   * Open the browser at the pairing page.
   *
   * A pairing is fetched up front rather than on tap, so the button opens
   * something immediately instead of showing a spinner while a round trip happens.
   * If that first request failed, this retries once rather than opening a URL
   * that does not exist.
   */
  const openBrowser = useCallback(async () => {
    if (!pairRef.current) {
      await requestPairing();
    }

    const url = pairRef.current?.pairUrl;
    if (!url) return;

    try {
      await Linking.openURL(url);
      setOpened(true);
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
          onSignedIn(result.token);
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
        <Pressable
          onPress={() => void startPairing()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Try again</Text>
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

      {phase === "waiting" ? (
        <View style={styles.waitingRow}>
          <ActivityIndicator size="small" color={theme.brand} />
          <Text style={styles.waitingText}>
            {opened ? "Waiting for you to finish in the browser…" : "Ready"}
          </Text>
        </View>
      ) : null}

      <Text style={styles.footnote}>
        Google opens in your browser. This app never sees your password.
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
