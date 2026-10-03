import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.body}>
          Add something here and it appears on the website straight away — and the
          other way round.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.list}
        data={cart.items}
        keyExtractor={(item) => item.productId}
        renderItem={({ item }) => (
          <Line
            item={item}
            busy={busy === item.productId}
            onChange={(quantity) => void change(item.productId, quantity)}
          />
        )}
      />

      <View style={styles.total}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatNaira(cart.subtotal)}</Text>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Pay on the website — this app shares your cart, not your card.
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

  return (
    <View style={styles.line}>
      <View style={styles.lineBody}>
        <Text style={styles.name} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.unit}>{formatNaira(item.price)} each</Text>
      </View>

      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(item.quantity - 1)}
          disabled={busy}
          style={styles.stepButton}
          accessibilityRole="button"
          accessibilityLabel={`Reduce quantity of ${item.name}`}
        >
          <Text style={styles.stepText}>−</Text>
        </Pressable>

        <Text style={styles.quantity}>{busy ? "·" : item.quantity}</Text>

        <Pressable
          onPress={() => onChange(item.quantity + 1)}
          disabled={busy || !canIncrease}
          style={[styles.stepButton, !canIncrease && styles.stepDisabled]}
          accessibilityRole="button"
          accessibilityLabel={`Increase quantity of ${item.name}`}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.lineTotal}>{formatNaira(item.price * item.quantity)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.canvas },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: theme.canvas,
  },
  list: { padding: 16, gap: 10, paddingBottom: 8 },

  line: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
    gap: 10,
  },
  lineBody: { flex: 1 },
  name: { fontSize: 14, fontWeight: "700", color: theme.ink, lineHeight: 19 },
  unit: { fontSize: 12, color: theme.inkMuted, marginTop: 2 },

  stepper: { flexDirection: "row", alignItems: "center", gap: 2 },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDisabled: { opacity: 0.35 },
  stepText: { fontSize: 18, fontWeight: "700", color: theme.brand, lineHeight: 22 },
  quantity: {
    minWidth: 26,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: theme.ink,
  },
  lineTotal: { fontSize: 14, fontWeight: "700", color: theme.ink, minWidth: 74, textAlign: "right" },

  total: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.white,
    borderTopWidth: 1,
    borderColor: theme.line,
  },
  totalLabel: { fontSize: 15, fontWeight: "600", color: theme.inkMuted },
  totalValue: { fontSize: 20, fontWeight: "800", color: theme.ink },

  note: { padding: 14, backgroundColor: theme.white },
  noteText: { fontSize: 12, color: theme.inkMuted, textAlign: "center" },

  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.ink, marginBottom: 6 },
  body: { fontSize: 15, color: theme.inkMuted, textAlign: "center", lineHeight: 22 },
});
