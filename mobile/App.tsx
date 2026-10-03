import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchCart, type Cart } from "./src/api";
import { CART_POLL_MS } from "./src/config";
import { clearSession, readEmail, readToken } from "./src/storage";
import { theme } from "./src/theme";
import { SignInScreen } from "./src/screens/SignInScreen";
import { ShopScreen } from "./src/screens/ShopScreen";
import { CartScreen } from "./src/screens/CartScreen";

/**
 * Naija Gadgets - the mobile app.
 *
 * IT IS THE SAME SHOP
 * There is no local database, no second cart and no separate login. Every read
 * and write goes to the website's own API:
 *
 *   GET    /api/products              the catalogue
 *   GET    /api/cart                  the basket
 *   POST   /api/cart                  add, or set a quantity
 *   POST   /api/mobile/pair           start sign-in
 *   GET    /api/mobile/pair/<code>    collect the token once approved
 *
 * Signing in happens through the website's own Auth.js session (see
 * SignInScreen), so the phone ends up holding a bearer token for the same
 * users.id the browser has - and cart_items.user_id is that id. That is why the
 * cart follows you across rather than merely looking similar on both.
 *
 * WHY THE CART POLLS
 * "Instantly appear" has to mean instant. Polling every five seconds is the
 * honest version of that without standing up a websocket or a Supabase Realtime
 * subscription: it is well inside what a person perceives as immediate, and it
 * costs one small GET. The alternative - Supabase Realtime - would put a database
 * credential in the app, which is the one thing this design refuses to do.
 *
 * The poll pauses while the app is backgrounded, so a phone in a pocket is not
 * waking the radio every five seconds.
 */
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<"shop" | "cart">("shop");
  const [cart, setCart] = useState<Cart>({ items: [], count: 0, subtotal: 0 });
  const [cartLoading, setCartLoading] = useState(true);

  // Same reason as in SignInScreen: the polling effect reads this, and putting it
  // in state would restart the interval on every render.
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Restore an existing session on launch, so the app does not ask for pairing
  // every time it is opened.
  useEffect(() => {
    (async () => {
      const [storedToken, storedEmail] = await Promise.all([readToken(), readEmail()]);

      if (storedToken) {
        setToken(storedToken);
        setEmail(storedEmail);
      }

      setBooting(false);
    })();
  }, []);

  const refreshCart = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) return;

    try {
      setCart(await fetchCart(current));
    } catch {
      // A failed refresh is not worth an error screen: the next tick will get it,
      // and the last known cart is better than nothing.
    } finally {
      setCartLoading(false);
    }
  }, []);

  // Poll the cart while the app is in the foreground.
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

  const signOut = useCallback(async () => {
    await clearSession();
    setToken(null);
    setEmail(null);
    setCart({ items: [], count: 0, subtotal: 0 });
    setTab("shop");
  }, []);

  if (booting) {
    return (
      <View style={styles.booting}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  if (!token) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={theme.canvas} />
        <SafeAreaView style={styles.fill}>
          {/* The token comes back from pairing rather than being read out of
              SecureStore again. Reading it happens once, at launch, so wiring
              this to a refresh left a freshly approved phone sitting on the
              sign-in screen until it was force-closed and reopened. */}
          <SignInScreen
            onSignedIn={(fresh) => {
              setToken(fresh);
              void refreshCart();
            }}
          />
        </SafeAreaView>
      </>
    );
  }

  // productId -> quantity, so each row in the shop can show what is already in the
  // basket. Derived rather than stored, because it has no state of its own worth
  // keeping in step with anything.
  const cartCount = new Map(cart.items.map((item) => [item.productId, item.quantity]));

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={theme.ink} />
      <SafeAreaView style={styles.fill}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.wordmark}>Naija Gadgets</Text>
            {email ? (
              <Text style={styles.email} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>

          <Pressable onPress={() => void signOut()} accessibilityRole="button">
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.fill}>
          {tab === "shop" ? (
            <ShopScreen token={token} cartCount={cartCount} onCartChanged={() => void refreshCart()} />
          ) : (
            <CartScreen
              cart={cart}
              token={token}
              loading={cartLoading}
              onChanged={() => void refreshCart()}
            />
          )}
        </View>

        <View style={styles.tabBar}>
          <Tab label="Shop" active={tab === "shop"} onPress={() => setTab("shop")} />
          <Tab
            label={cart.count > 0 ? `Cart (${cart.count})` : "Cart"}
            active={tab === "cart"}
            onPress={() => setTab("cart")}
          />
        </View>
      </SafeAreaView>
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
  booting: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.canvas },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.ink,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  headerText: { flex: 1 },
  wordmark: { fontSize: 20, fontWeight: "800", color: theme.white, letterSpacing: -0.3 },
  email: { fontSize: 12, color: "#a9adc8", marginTop: 1 },
  signOut: { color: "#c9cdf0", fontSize: 13, textDecorationLine: "underline" },

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
