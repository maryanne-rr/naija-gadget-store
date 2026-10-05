import { Pressable, StyleSheet, Text, View } from "react-native";
import { SignInScreen } from "./SignInScreen";
import { LockIcon, SyncIcon } from "../icons";
import { theme } from "../theme";

/**
 * The Account tab.
 *
 * EXISTS SO THAT SIGN-IN IS NOT A GATE
 * The first version of this app made sign-in the entry point: no token, no shop.
 * That is wrong. Browsing is what a shop is for, and asking for a Google login
 * before showing a single product loses the person who was only looking.
 *
 * So the shop, the cart and everything else are reachable signed out. Sign-in
 * lives here, on a tab, where it belongs - and the header shows the account state
 * at all times so it is never hidden.
 *
 * THIS IS THE SAME STRUCTURE AS THE OTHER SUBMISSION
 * Collection / Bag / Orders / Account, with a sign-in prompt on the Account tab.
 * It is also what the website does: the header offers Sign in, and the storefront
 * is fully browsable without it.
 */
export function AccountScreen({
  email,
  cartCount,
  onSignIn,
  onSignOut,
}: {
  email: string | null;
  cartCount: number;
  /**
   * Hands the token and email back so the app can start polling the server cart.
   *
   * Both are needed. The email is what AccountScreen and the header decide
   * signed-in from, so passing only the token leaves this component rendering the
   * sign-in branch forever - which is precisely the bug where the app said
   * "Signed in. Opening the shop..." and never opened it.
   */
  onSignIn: (token: string, email: string | null) => void;
  onSignOut: () => void;
}) {
  if (!email) {
    return (
      <View style={styles.screen}>
        <View style={styles.hero}>
          <Text style={styles.brand}>Naija Gadgets</Text>
          <Text style={styles.tagline}>a home for quality gadgets</Text>
        </View>

        {/* What this screen is, before the sign-in card asks for anything.

            An account screen that opens with a login form and no explanation
            reads as an app that requires one. Saying plainly that browsing needs
            no account - and that a basket works without one - is the accurate
            version, and it is the same thing the website does. */}
        <View style={styles.openNotice}>
          <SyncIcon color={theme.brand} />
          <Text style={styles.openNoticeText}>
            No account needed to browse. Your basket is kept on this phone, and moves
            across when you sign in.
          </Text>
        </View>

        <View style={styles.card}>
          <SignInScreen onSignedIn={onSignIn} />
        </View>

        <View style={styles.notes}>
          <Note title="Your cart is saved on this phone">
            Add things now and sign in later — we’ll move your basket across and
            nothing gets lost.
          </Note>
          <Note title="One account, two devices">
            Signed in, your cart is shared with the website and updates on both.
          </Note>
          <Note title="The same shop, not a second one">
            Every product, price and photo comes from this website’s own API. There
            is no separate catalogue to fall out of date.
          </Note>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {/* A tick-shaped label rather than the word "account" alone. It is a small
            thing, but a screen that says only "Signed in as ..." reads as a debug
            view, and this is the one screen somebody will screenshot. */}
        <View style={styles.signedRow}>
          <View style={styles.signedBadge}>
            <LockIcon color={theme.white} size={13} />
          </View>
          <Text style={styles.label}>Signed in</Text>
        </View>

        <Text style={styles.email}>{email}</Text>

        <View style={styles.stat}>
          <Text style={styles.statValue}>{cartCount}</Text>
          <Text style={styles.statLabel}>
            {cartCount === 1 ? "item" : "items"} in your cart, shared with the website
          </Text>
        </View>

        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.notes}>
        <Note title="Your cart follows you">
          Add something on the website and it appears here within a few seconds,
          and the other way round.
        </Note>
        <Note title="Pay on the website">
          This app shares your cart, not your card. Payment happens on the site.
        </Note>
      </View>
    </View>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteTitle}>{title}</Text>
      <Text style={styles.noteBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.canvas },

  hero: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  brand: { fontSize: 26, fontWeight: "800", color: theme.ink, letterSpacing: -0.5 },
  tagline: { fontSize: 14, fontStyle: "italic", color: theme.inkMuted, marginTop: 2 },

  openNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 13,
    borderRadius: theme.radius,
    backgroundColor: theme.brandTint,
  },
  // The icon sits on its own line with the first line of text, so flex-start on
  // the row rather than centre - centring it leaves it floating beside the
  // second line of a two-line paragraph.
  openNoticeText: {
    flex: 1,
    fontSize: 13,
    color: theme.brand,
    lineHeight: 19,
    fontWeight: "600",
  },

  card: {
    margin: 16,
    marginTop: 14,
    padding: 18,
    backgroundColor: theme.white,
    borderRadius: theme.radiusPanel,
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#14163a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  signedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  signedBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: theme.green,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.inkMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  email: { fontSize: 18, fontWeight: "700", color: theme.ink, marginTop: 4 },

  stat: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 18 },
  statValue: { fontSize: 26, fontWeight: "800", color: theme.brand },
  statLabel: { fontSize: 14, color: theme.inkMuted },

  signOut: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: theme.radius,
    paddingVertical: 12,
    alignItems: "center",
  },
  pressed: { opacity: 0.6 },
  signOutText: { fontSize: 15, fontWeight: "700", color: theme.ink },

  notes: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  note: {
    backgroundColor: theme.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 14,
  },
  noteTitle: { fontSize: 14, fontWeight: "700", color: theme.ink },
  noteBody: { fontSize: 13, color: theme.inkMuted, marginTop: 4, lineHeight: 19 },
});
