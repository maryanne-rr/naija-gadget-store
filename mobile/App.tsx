import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchCart, mergeGuestCart, updateCart, type Cart, type CartItem } from "./src/api";
import { CART_POLL_MS } from "./src/config";
import {
  forgetGuestCart,
  guestAdd,
  guestCartLines,
  guestClear,
  guestSetQuantity,
  loadGuestCart,
} from "./src/guestCart";
import { clearSession, readEmail, readToken } from "./src/storage";
import { theme } from "./src/theme";
import { ShopScreen } from "./src/screens/ShopScreen";
import { CartScreen } from "./src/screens/CartScreen";
import { AccountScreen } from "./src/screens/AccountScreen";

/**
 * Naija Gadgets - the mobile app.
 *
 * IT IS THE SAME SHOP
 * There is no local database, no second login and no separate login. Every read
 * and write goes to the website's own API:
 *
 *   GET    /api/products              the catalogue - public, no sign-in needed
 *   GET    /api/cart                  the basket
 *   POST   /api/cart                  add, or set a quantity
 *   PUT    /api/cart                  fold a guest basket into the signed-in one
 *   POST   /api/mobile/pair           start sign-in
 *   GET    /api/mobile/pair/<code>    collect the token once approved
 *
 * SIGNING IN HAPPENS THROUGH A BROWSER, ONCE, AND IS NOT A GATE
 * See SignInScreen for why. The important part here is that it is not a gate: the
 * shop, the prices and the photos are all reachable with no account at all, and a
 * signed-out visitor gets a real basket on the device.
 *
 * That mirrors the website exactly. CartProvider keeps a guest basket in
 * localStorage and switches to the database on sign-in; this app keeps one in
 * AsyncStorage and does the same. Same rule, two clients - which is most of why
 * they feel like one shop rather than an app that bolted onto a website.
 *
 * THE MERGE AT SIGN-IN IS THE INTERESTING PART
 * Somebody fills a basket signed out, then signs in. Those items belong to the
 * account they are about to have. Uploading them blindly would double anything
 * already on the server, so PUT /api/cart sums quantities and caps them at the
 * stock on hand - in the database, atomically. Then the device basket is deleted,
 * or the next sign-in would merge it a second time.
 *
 * WHY THE CART POLLS
 * "Instantly appear" has to mean instant. Polling every five seconds is the
 * honest version of that without standing up a websocket or a Supabase Realtime
 * subscription: it is well inside what a person perceives as immediate, and it
 * costs one small GET. The alternative - Realtime - would put a database
 * credential in the app, which this design refuses to do.
 *
 * The poll pauses while the app is backgrounded, so a phone in a pocket is not
 * waking the radio every five seconds.
 */
export default function App() {
  // The provider has to sit above the component that measures. SafeAreaProvider
  // is what turns the notch, the status bar and the home indicator into numbers
  // the layout can use - without it there is nothing to measure, and hard-coded
  // padding is wrong on every phone except the one it was guessed on.
  return (
    <SafeAreaProvider>
      <Shop />
    </SafeAreaProvider>
  );
}

type Tab = "shop" | "cart" | "account";

function Shop() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<Tab>("shop");
  const [cart, setCart] = useState<Cart>({ items: [], count: 0, subtotal: 0 });
  const [cartLoading, setCartLoading] = useState(true);
  /** Bumped to re-render after a guest-basket write, which lives outside React. */

  // Same reason as elsewhere: the polling effect reads this, and putting it in
  // state would restart the interval on every render.
  const tokenRef = useRef<string | null>(null);

  // Measured, not hard-coded. A phone with a notch and a phone without one need
  // different top padding, and a fixed number is wrong on both - which is what
  // put the wordmark under the clock in the first screenshot.
  //
  // Above the early return below, deliberately: a hook called after one is a
  // conditional hook, React notices when the boot flag flips from true to false,
  // and the count of hooks has changed between renders.
  const insets = useSafeAreaInsets();

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  /** Re-read whichever cart applies: the server's, or this device's. */
  const refreshCart = useCallback(async () => {
    const current = tokenRef.current;

    if (!current) {
      const items = await loadGuestCart();
      setCart({
        items,
        count: items.reduce((total, item) => total + item.quantity, 0),
        subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
      });
      return;
    }

    try {
      setCart(await fetchCart(current));
    } catch {
      // A failed refresh is not worth an error screen: the next tick will get it,
      // and the last known cart is better than nothing.
    } finally {
      setCartLoading(false);
    }
  }, []);

  /**
   * Restore an existing session and load whichever basket applies.
   *
   * Declared AFTER refreshCart rather than before, so it can call it. Loading the
   * guest basket here matters more than it looks: the polling effect below returns
   * early for a signed-out visitor, so this is the only thing that reads the
   * device basket at launch. Without it, somebody who added three things
   * yesterday force-closes the app, reopens it, and is shown an empty basket with
   * no way to tell that apart from having lost their shopping.
   *
   * It calls refreshCart rather than loadGuestCart directly, because only
   * refreshCart puts the result into `cart` state - loadGuestCart fills a module
   * variable that nothing renders from.
   */
  useEffect(() => {
    (async () => {
      const [storedToken, storedEmail] = await Promise.all([readToken(), readEmail()]);

      if (storedToken) {
        tokenRef.current = storedToken;
        setToken(storedToken);
        setEmail(storedEmail);
      }

      await refreshCart();

      setCartLoading(false);
      setBooting(false);
    })();
  }, [refreshCart]);

  // Poll the server cart while the app is in the foreground. A signed-out visitor
  // has nothing to poll - their basket is on the device and cannot change until
  // they touch it.
  useEffect(() => {
    if (!token) return;

    void refreshCart();

    const timer = setInterval(() => {
      // Skip the turn when the app is backgrounded - a phone in a pocket should
      // not be waking the radio every five seconds. currentState is null on web,
      // where the concept does not exist, and that should mean "carry on".
      const state = AppState.currentState;
      if (state === null || state === "active") {
        void refreshCart();
      }
    }, CART_POLL_MS);

    return () => clearInterval(timer);
  }, [token, refreshCart]);

  /**
   * Add to whichever cart applies.
   *
   * THE POINT OF THE WHOLE SPLIT
   * Signed in, this is a server round trip and the answer redraws the row.
   * Signed out, it writes the device basket and re-renders. Either way the Add
   * button works - which it did not before, when it was only reachable behind a
   * login.
   */
  const addToCart = useCallback(
    async (line: Omit<CartItem, "quantity">, quantity = 1) => {
      const current = tokenRef.current;

      if (current) {
        await updateCart(current, line.productId, quantity, "add");
      } else {
        await guestAdd(line, quantity);
      }

      await refreshCart();
    },
    [refreshCart],
  );

  const setQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const current = tokenRef.current;

      if (current) {
        await updateCart(current, productId, quantity, "set");
      } else {
        await guestSetQuantity(productId, quantity);
      }

      await refreshCart();
    },
    [refreshCart],
  );

  const clearCart = useCallback(async () => {
    const current = tokenRef.current;

    if (current) {
      // Zeroing each line is clearer than DELETE, which empties the whole basket
      // and would discard anything added in the last few seconds by another
      // device.
      for (const item of cart.items) {
        await updateCart(current, item.productId, 0, "set");
      }
    } else {
      await guestClear();
    }

    await refreshCart();
  }, [cart.items, refreshCart]);

  /**
   * Signed in. Move the device basket across, then adopt the token.
   *
   * The email comes up from SignInScreen rather than being read back out of
   * SecureStore afterwards, because AccountScreen and the header both decide
   * signed-in from it. Setting only the token left email null, and the app sat on
   * "Signed in. Opening the shop..." indefinitely - the session was perfectly
   * valid and nothing above it could see it.
   *
   * The merge runs BEFORE setToken, deliberately: guestCartLines() reads the
   * device basket, and switching modes first would leave nothing to merge. If the
   * merge fails the session is still adopted - a signed-in person with an empty
   * cart is a far better outcome than staying signed out with no way forward.
   */
  const handleSignedIn = useCallback(
    async (freshToken: string, freshEmail: string | null) => {
      const lines = guestCartLines();

      tokenRef.current = freshToken;
      setToken(freshToken);
      setEmail(freshEmail);

      if (lines.length > 0) {
        try {
          await mergeGuestCart(freshToken, lines);
          await forgetGuestCart();
        } catch {
          // Leave the device basket in place. It is not lost, and the next
          // sign-in will try again.
        }
      }

      await refreshCart();

      // The screen said "Opening the shop...", so it had better actually open it.
      // Sitting on the Account tab after signing in reads as though nothing
      // happened, even though everything did.
      setTab("shop");
    },
    [refreshCart],
  );

  const signOut = useCallback(async () => {
    await clearSession();
    setToken(null);
    setEmail(null);
    // A fresh device basket rather than the server one: signing out must not leave
    // the previous account's items on the phone, and must not show the next person
    // somebody else's basket.
    await guestClear();
    await refreshCart();
    setTab("shop");
  }, [refreshCart]);

  if (booting) {
    return (
      <View style={styles.booting}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  // productId -> quantity, so each row can show "N in cart". Derived rather than
  // stored: it has no state of its own worth keeping in step with anything.
  const cartCount = new Map(
    cart.items.map((item) => [item.productId, item.quantity] as const),
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.ink} />
      <View style={styles.fill}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.headerText}>
            <Text style={styles.wordmark}>Naija Gadgets</Text>
            <Text style={styles.email} numberOfLines={1}>
              {email ?? "Browsing — sign in to sync your cart"}
            </Text>
          </View>

          {/* The extra right padding is not decoration. Expo Go floats a
              development button in the top-right corner, and it sits directly on
              top of anything placed there - so in a demo the control you need is
              under the one you do not. Leaving room costs nothing in a build. */}
          <Pressable
            onPress={() => setTab("account")}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={email ? "Account" : "Sign in"}
          >
            <Text style={styles.headerButtonText}>{email ? "Account" : "Sign in"}</Text>
          </Pressable>
        </View>

        <View style={styles.fill}>
          {tab === "shop" ? (
            <ShopScreen cartCount={cartCount} onAdd={addToCart} />
          ) : tab === "cart" ? (
            <CartScreen
              cart={cart}
              loading={cartLoading}
              signedIn={Boolean(token)}
              onChangeQuantity={setQuantity}
              onClear={() => void clearCart()}
            />
          ) : (
            <AccountScreen
              email={email}
              cartCount={cart.count}
              onSignIn={(freshToken, freshEmail) => void handleSignedIn(freshToken, freshEmail)}
              onSignOut={() => void signOut()}
            />
          )}
        </View>

        {/* Bottom inset so the tab bar clears the home indicator. */}
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Tab label="Shop" active={tab === "shop"} onPress={() => setTab("shop")} />
          <Tab
            label={cart.count > 0 ? `Cart (${cart.count})` : "Cart"}
            active={tab === "cart"}
            onPress={() => setTab("cart")}
          />
          <Tab
            label="Account"
            active={tab === "account"}
            onPress={() => setTab("account")}
          />
        </View>
      </View>
    </>
  );
}

function Tab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {active ? <View style={styles.tabUnderline} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.canvas },
  booting: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.canvas,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.ink,
    paddingLeft: 16,
    // Room on the right for Expo Go's floating development button, which
    // otherwise sits on top of whatever is placed there.
    paddingRight: 78,
    paddingBottom: 14,
    gap: 10,
  },
  // flex: 1 on the text block is what stops the wordmark pushing the button off
  // the edge on a narrow phone. The email is allowed to shrink and ellipsize for
  // the same reason - a long address must not steal the button's space.
  headerText: { flex: 1, minWidth: 0 },
  wordmark: { fontSize: 19, fontWeight: "800", color: theme.white, letterSpacing: -0.3 },
  email: { fontSize: 11, color: "#a9adc8", marginTop: 1 },
  // minHeight 44 for the same reason as every other control. Padding alone left
  // this one at 33px, measured in a browser rather than guessed at.
  headerButton: { paddingVertical: 8, paddingLeft: 10, minHeight: 44, justifyContent: "center" },
  headerButtonText: {
    color: "#c9cdf0",
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  tabBar: {
    flexDirection: "row",
    backgroundColor: theme.white,
    borderTopWidth: 1,
    borderColor: theme.line,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 14, gap: 4 },
  tabText: { fontSize: 14, fontWeight: "600", color: theme.inkMuted },
  tabTextActive: { color: theme.brand },
  tabUnderline: { height: 2, width: 28, backgroundColor: theme.brand, borderRadius: 1 },
});
