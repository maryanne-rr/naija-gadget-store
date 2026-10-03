import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { updateCart, type Cart, type CartItem } from "../api";
import { formatNaira } from "../format";
import { theme } from "../theme";

/**
 * The cart.
 *
 * Reads and writes the SAME rows as the website, through the same endpoint. Two
 * devices open this screen side by side and the numbers move together, because
 * there is only one set of numbers.
 *
 * NO LOCAL STATE
 * Every stepper tap sends the new quantity and redraws from the answer. An
 * optimistic local update would look faster and would also be a lie the moment
 * the server capped the quantity at the stock on hand - which is the one case
 * where the two would visibly disagree.
 *
 * WHY THE ROW IS BUILT IN TWO TIERS
 * One line with name, stepper and total competes for a narrow phone, and the
 * name gets truncated to make room for the controls. Name and price go on the top
 * line where the name has the whole width; the controls go underneath, where they
 * are reachable and cannot push anything off screen.
 */
export function CartScreen({
  cart,
  token,
  loading,
  onChanged,
}: {
  cart: Cart;
  token: string;
  loading: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const change = useCallback(
    async (productId: string, quantity: number) => {
      setBusy(productId);

      try {
        // mode "set": the stepper means exactly this many, not this many more.
        await updateCart(token, productId, quantity, "set");
        onChanged();
      } catch {
        // The poll in App.tsx will redraw from the server shortly, which is
        // enough to recover without a second error path for the user to read.
        onChanged();
      } finally {
        setBusy(null);
      }
    },
    [token, onChanged],
  );

  if (loading && cart.items.length === 0) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  if (cart.items.length === 0) {
    return (
      <View style={styles.centre}>
        <View style={styles.emptyBadge}>
          <Text style={styles.emptyEmoji}>🛒</Text>
        </View>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.body}>
          Add something here and it appears on the website straight away — and the
          other way round. Both devices read the same rows.
        </Text>
      </View>
    );
  }

  const savings = cart.items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);

  return (
    <View style={styles.screen}>
      <View style={styles.intro}>
        <Text style={styles.introText}>
          {cart.count === 1 ? "1 item" : `${cart.count} items`} · shared with your
          website cart
        </Text>
      </View>

      <SectionList
        contentContainerStyle={styles.list}
        sections={[{ title: "items", data: cart.items }]}
        keyExtractor={(item) => item.productId}
        stickySectionHeadersEnabled={false}
        renderItem={({ item }) => (
          <Line
            item={item}
            busy={busy === item.productId}
            onChange={(quantity) => void change(item.productId, quantity)}
          />
        )}
      />

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatNaira(savings)}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.mutedLabel}>Delivery</Text>
          <Text style={styles.mutedValue}>Lagos 1–2 days · outside Lagos 2–5</Text>
        </View>

        <View style={styles.cta}>
          <Text style={styles.ctaText}>Pay on the website</Text>
        </View>

        <Text style={styles.note}>
          This app shares your cart, not your card — payment happens on the website.
        </Text>
      </View>
    </View>
  );
}

function Line({
  item,
  busy,
  onChange,
}: {
  item: CartItem;
  busy: boolean;
  onChange: (quantity: number) => void;
}) {
  // Capped at the stock the server reported. Showing a + on a row where there is
  // nothing left to add is a small lie that produces a confusing failure at
  // checkout, which is the worst moment to find out.
  const canIncrease = item.quantity < item.maxStock;
  const onlyOne = item.quantity <= 1;

  return (
    <View style={styles.line}>
      <View style={styles.lineTop}>
        <View style={styles.lineThumb}>
          <Text style={styles.thumbEmoji}>{item.emoji}</Text>
        </View>

        <View style={styles.lineBody}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.unit}>
            {formatNaira(item.price)} each
            {item.maxStock > 0 ? ` · ${item.maxStock} in stock` : ""}
          </Text>
        </View>

        <Text style={styles.lineTotal}>{formatNaira(item.price * item.quantity)}</Text>
      </View>

      <View style={styles.lineBottom}>
        {/* At one, the minus button becomes Remove rather than doing nothing -
            otherwise there is no way to empty a one-item basket without first
            stepping up and back down again. */}
        <Pressable
          onPress={() => onChange(item.quantity - 1)}
          disabled={busy}
          style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name} from cart`}
        >
          <Text style={styles.removeText}>{onlyOne ? "Remove" : "Remove"}</Text>
        </Pressable>

        <View style={styles.stepper}>
          <Pressable
            onPress={() => onChange(item.quantity - 1)}
            disabled={busy}
            style={({ pressed }) => [styles.stepButton, pressed && styles.stepPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Reduce quantity of ${item.name}`}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>

          <Text style={styles.quantity}>{busy ? "·" : item.quantity}</Text>

          <Pressable
            onPress={() => onChange(item.quantity + 1)}
            disabled={busy || !canIncrease}
            style={({ pressed }) => [
              styles.stepButton,
              !canIncrease && styles.stepDisabled,
              pressed && styles.stepPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Increase quantity of ${item.name}`}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.canvas },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
    backgroundColor: theme.canvas,
  },
  list: { padding: 14, paddingBottom: 12 },

  intro: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 4 },
  introText: { fontSize: 12.5, color: theme.inkMuted, fontWeight: "600" },

  line: {
    backgroundColor: theme.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#14163a",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  lineTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  lineThumb: {
    width: 52,
    height: 52,
    borderRadius: theme.radius,
    backgroundColor: theme.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbEmoji: { fontSize: 24 },
  lineBody: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "700", color: theme.ink, lineHeight: 19 },
  unit: { fontSize: 12, color: theme.inkMuted, marginTop: 2 },
  lineTotal: { fontSize: 15, fontWeight: "800", color: theme.ink },

  lineBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: theme.line,
  },
  remove: { paddingVertical: 6, paddingHorizontal: 4 },
  pressed: { opacity: 0.5 },
  removeText: { fontSize: 13, fontWeight: "600", color: theme.red },

  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  stepPressed: { backgroundColor: theme.brandTint },
  stepDisabled: { opacity: 0.35 },
  stepText: { fontSize: 19, fontWeight: "700", color: theme.brand, lineHeight: 23 },
  quantity: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    color: theme.ink,
  },

  footer: {
    backgroundColor: theme.white,
    borderTopWidth: 1,
    borderColor: theme.line,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 12,
  },
  totalLabel: { fontSize: 14, fontWeight: "600", color: theme.inkMuted },
  totalValue: { fontSize: 20, fontWeight: "800", color: theme.ink },
  mutedLabel: { fontSize: 13, color: theme.inkMuted },
  mutedValue: { fontSize: 12.5, color: theme.inkMuted, flexShrink: 1, textAlign: "right" },

  cta: {
    backgroundColor: theme.brand,
    borderRadius: theme.radius,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  ctaText: { color: theme.white, fontWeight: "800", fontSize: 15 },

  note: { fontSize: 11.5, color: theme.inkMuted, textAlign: "center", marginTop: 10 },

  emptyBadge: {
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: theme.brandTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyEmoji: { fontSize: 30 },
  emptyTitle: { fontSize: 19, fontWeight: "800", color: theme.ink, marginBottom: 8 },
  body: { fontSize: 14.5, color: theme.inkMuted, textAlign: "center", lineHeight: 21 },
});
