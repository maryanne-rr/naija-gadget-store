import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { createPairing, pollPairing, type PollResult } from "../api";
import { PAIR_POLL_MS } from "../config";
import { readOrCreateClaimSecret, saveSession } from "../storage";
import { theme } from "../theme";

/**
 * Signing in on the phone.
 *
 * THE FLOW
 *   1. The app asks the server for a short code.
 *   2. It shows the code, and a link to open on any browser.
 *   3. The person opens that link - on the phone, or on a laptop - and signs in
 *      with the same Google account they use on the website.
 *   4. They press "Connect this device".
 *   5. This screen notices within a couple of seconds and signs in.
 *
 * WHY NOT A GOOGLE BUTTON ON THIS SCREEN
 * A native app would normally run Google OAuth itself, using a redirect URI of
 * its own. Inside Expo Go that is not available: Expo Go can only be opened
 * through Expo's proxy URL, so the redirect URI Google would need to be told
 * about is one that does not exist until `npx expo start` has run and is not
 * stable if the Expo account or project slug changes. Registering it is possible
 * but the failure mode is "the button does nothing".
 *
 * Pairing avoids all of that and has a genuine advantage: the approval happens
 * through the WEBSITE's own session, so the phone gets a token for the same
 * account by construction rather than by matching on email. It is also the
 * pattern real products use - GitHub CLI, `gh`, and smart-TV sign-in all pair a
 * device through a browser.
 *
 * WHY THE CODE IS NOT A LOGIN ON ITS OWN
 * The code is shown on screen and typed into a browser, so anyone nearby can read
 * it. It only names the pairing. The right to collect the session belongs to the
 * secret this device generated and never sent - see src/storage.ts.
 */
/**
 * Hands the new token back so the app can switch to the shop without a restart.
 *
 * It has to be handed over rather than left in SecureStore. Reading the token back
 * only happens once, at launch, so relying on that would mean the person has to
 * kill and reopen the app after every sign-in - which looks exactly like the
 * pairing failed.
 */
export function SignInScreen({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [pairUrl, setPairUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "starting" | "waiting" | "connected" | "denied" | "expired" | "error"
  >("starting");
  const [error, setError] = useState("");

  // Held in a ref rather than state because the polling loop reads it but must not
  // restart when it changes - a changing dependency here would tear down and
  // recreate the interval on every render.
  const claimRef = useRef<string | null>(null);

  const begin = useCallback(async () => {
    setStatus("starting");
    setError("");

    try {
      if (!claimRef.current) {
        claimRef.current = await readOrCreateClaimSecret();
      }

      const pairing = await createPairing(claimRef.current);
      setCode(pairing.code);
      setPairUrl(pairing.pairUrl);
      setStatus("waiting");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Could not start sign-in.");
    }
  }, []);

  useEffect(() => {
    void begin();
  }, [begin]);

  /**
   * Poll until approved.
   *
   * The interval is cleared on every path out of the loop - approved, expired,
   * denied, or unmounted - because a phone that keeps asking every two seconds
   * after the answer is not a phone that has finished signing in.
   */
  useEffect(() => {
    if (status !== "waiting" || !code || !claimRef.current) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      try {
        const result: PollResult = await pollPairing(code!, claimRef.current!);

        if (cancelled) return;

        if (result.status === "ready") {
          // Persist first, then tell the app. If the process dies between the two,
          // the token is still on disk and the next launch signs in - the reverse
          // order would leave a signed-in device that forgets on restart.
          await saveSession(result.token, result.user.email);

          // "connected" rather than "expired", which is what this used to set.
          // Reusing an existing status to halt the loop also renders that status,
          // so approving a device told the person it had expired - while the
          // browser they approved it in said it had worked.
          setStatus("connected");
          onSignedIn(result.token);
          return;
        }

        if (result.status === "denied") {
          setStatus("denied");
          return;
        }

        if (result.status === "expired") {
          setStatus("expired");
          return;
        }
      } catch (cause) {
        if (cancelled) return;

        // A single dropped request should not end the attempt - the phone may be
        // on mobile data and blipping. Only a clear rejection stops the loop.
        if (cause instanceof Error && "status" in cause && (cause as { status: number }).status === 401) {
          setStatus("error");
          setError(cause.message);
          return;
        }
      }

      if (!cancelled) {
        timer = setTimeout(check, PAIR_POLL_MS);
      }
    }

    void check();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [status, code, onSignedIn]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.wordmark}>Naija Gadgets</Text>
      <Text style={styles.tagline}>a home for quality gadgets</Text>

      <View style={styles.card}>
        {status === "starting" ? (
          <>
            <ActivityIndicator color={theme.brand} />
            <Text style={styles.body}>Getting a sign-in code…</Text>
          </>
        ) : null}

        {status === "waiting" && code ? (
          <>
            <Text style={styles.cardTitle}>Open this on any browser</Text>
            <Text style={styles.body}>
              Sign in with the same Google account you use on the website, then press
              “Connect this device”.
            </Text>

            <Pressable
              onPress={() => {
                if (pairUrl) void Linking.openURL(pairUrl);
              }}
              style={({ pressed }) => [
                styles.codeBox,
                pressed && styles.codeBoxPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Sign-in code ${code.replace("-", " ")}. Tap to open in a browser.`}
            >
              <Text style={styles.code}>{code.replace("-", " ")}</Text>
              <Text style={styles.codeHint}>Tap to open</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (code) void Clipboard.setStringAsync(code);
              }}
              style={styles.secondary}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Copy the code instead</Text>
            </Pressable>

            <View style={styles.waitingRow}>
              <ActivityIndicator size="small" color={theme.brand} />
              <Text style={styles.waitingText}>Waiting for you to approve it…</Text>
            </View>
          </>
        ) : null}

        {status === "connected" ? (
          <>
            <ActivityIndicator color={theme.brand} />
            <Text style={styles.body}>Connected. Opening the shop…</Text>
          </>
        ) : null}

        {status === "denied" ? (
          <Retry
            heading="That device was not approved."
            body="Nothing has been connected. Start again if that was a mistake."
            onRetry={begin}
          />
        ) : null}

        {status === "expired" ? (
          <Retry
            heading="That code has expired."
            body="Codes last 15 minutes. Here is a new one."
            onRetry={begin}
          />
        ) : null}

        {status === "error" ? (
          <Retry heading="Could not sign in" body={error} onRetry={begin} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function Retry({
  heading,
  body,
  onRetry,
}: {
  heading: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <>
      <Text style={styles.cardTitle}>{heading}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable onPress={onRetry} style={styles.primary} accessibilityRole="button">
        <Text style={styles.primaryText}>Try again</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.canvas },
  content: { padding: 24, paddingTop: 72, alignItems: "stretch" },

  wordmark: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.ink,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    fontStyle: "italic",
    color: theme.inkMuted,
    marginTop: 2,
    marginBottom: 32,
  },

  card: {
    backgroundColor: theme.white,
    borderRadius: theme.radiusPanel,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 24,
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: theme.ink,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    color: theme.inkMuted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },

  codeBox: {
    marginTop: 24,
    backgroundColor: theme.brandTint,
    borderRadius: theme.radius,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    alignSelf: "stretch",
  },
  codeBoxPressed: { backgroundColor: "#d2d5ff" },
  code: {
    fontSize: 38,
    fontWeight: "800",
    color: theme.brand,
    // Wide tracking so the characters cannot be read as a different code.
    letterSpacing: 6,
  },
  codeHint: { fontSize: 13, color: theme.brand, marginTop: 6 },

  secondary: { marginTop: 14, padding: 8 },
  secondaryText: { color: theme.inkMuted, fontSize: 14, textDecorationLine: "underline" },

  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  waitingText: { color: theme.inkMuted, fontSize: 14 },

  primary: {
    marginTop: 20,
    backgroundColor: theme.brand,
    borderRadius: theme.radius,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  primaryText: { color: theme.white, fontWeight: "700", fontSize: 15 },
});
