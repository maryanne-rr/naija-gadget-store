import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchProducts, updateCart, type Product } from "../api";
import { discountPercent, formatNaira } from "../format";
import { theme } from "../theme";

/**
 * The shop.
 *
 * Product rows with an add button, which is all that is needed to demonstrate the
 * thing this task is about: add here, and it is on the website immediately.
 *
 * NOTHING IS ADDED LOCALLY
 * Every tap goes to POST /api/cart and the row redraws from the server's answer.
 * There is no optimistic update and no local cart array, and that is the whole
 * design: a phone-held basket would be a second basket, and two baskets is
 * exactly the bug being fixed here. The database is the only basket.
 */
export function ShopScreen({
  token,
  cartCount,
  onCartChanged,
}: {
  token: string;
  /** Lines already in the cart, so each row can show "In cart: 2". */
  cartCount: Map<string, number>;
  onCartChanged: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchProducts()
      .then((list) => {
        if (!cancelled) setProducts(list);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load the shop.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback(
    async (product: Product) => {
      setBusy(product.id);

      try {
        // The server decides the final quantity and caps it at the stock on hand.
        // The button's own arithmetic is only there to stop pointless taps.
        await updateCart(token, product.id, 1, "add");
        onCartChanged();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not add that.");
      } finally {
        setBusy(null);
      }
    },
    [token, onCartChanged],
  );

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  if (error && products.length === 0) {
    return (
      <View style={styles.centre}>
        <Text style={styles.errorTitle}>Could not load the shop</Text>
        <Text style={styles.body}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={products}
      keyExtractor={(product) => product.id}
      renderItem={({ item }) => (
        <Row
          product={item}
          inCart={cartCount.get(item.id) ?? 0}
          busy={busy === item.id}
          onAdd={() => void add(item)}
        />
      )}
    />
  );
}

function Row({
  product,
  inCart,
  busy,
  onAdd,
}: {
  product: Product;
  inCart: number;
  busy: boolean;
  onAdd: () => void;
}) {
  const off = discountPercent(product.price, product.compareAtPrice);
  const outOfStock = product.stock <= 0;
  const atStockLimit = !outOfStock && inCart >= product.stock;

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.image} />
        ) : (
          <Text style={styles.thumbEmoji}>{product.emoji}</Text>
        )}
      </View>

      <View style={styles.rowBody}>
        {product.brand ? (
          <Text style={styles.brand}>{product.brand.toUpperCase()}</Text>
        ) : null}

        {/* Name leads, spec supports - the same rule as the product card on the
            website, so the two do not look like different products. */}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        {product.spec ? <Text style={styles.spec}>{product.spec}</Text> : null}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatNaira(product.price)}</Text>
          {off !== null ? (
            <>
              <Text style={styles.wasPrice}>{formatNaira(product.compareAtPrice!)}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Save {off}%</Text>
              </View>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.rowAction}>
        <Pressable
          onPress={onAdd}
          disabled={busy || outOfStock || atStockLimit}
          style={({ pressed }) => [
            styles.addButton,
            (outOfStock || atStockLimit) && styles.addButtonDisabled,
            pressed && styles.addButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Add ${product.name} to cart`}
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.white} />
          ) : (
            <Text style={styles.addButtonText}>
              {outOfStock ? "Sold out" : atStockLimit ? "Max" : "Add"}
            </Text>
          )}
        </Pressable>

        {/* Showing what is already in the basket is what makes the sync visible.
            Add something on the website and this number changes within seconds. */}
        {inCart > 0 ? <Text style={styles.inCart}>In cart: {inCart}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.canvas },
  list: { padding: 16, gap: 12 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: theme.canvas },

  row: {
    flexDirection: "row",
    backgroundColor: theme.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 12,
    gap: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: theme.radius,
    backgroundColor: theme.canvas,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  thumbEmoji: { fontSize: 28 },

  rowBody: { flex: 1, justifyContent: "center" },
  brand: { fontSize: 10, fontWeight: "700", color: theme.inkMuted, letterSpacing: 1 },
  name: { fontSize: 15, fontWeight: "700", color: theme.ink, marginTop: 2, lineHeight: 20 },
  spec: { fontSize: 13, color: theme.inkMuted, marginTop: 1 },

  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 6, flexWrap: "wrap" },
  price: { fontSize: 16, fontWeight: "700", color: theme.ink },
  wasPrice: {
    fontSize: 13,
    color: theme.inkMuted,
    textDecorationLine: "line-through",
  },
  badge: {
    backgroundColor: theme.signalTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: theme.signal },

  rowAction: { justifyContent: "center", alignItems: "center", gap: 4, minWidth: 64 },
  addButton: {
    backgroundColor: theme.brand,
    borderRadius: theme.radius,
    paddingVertical: 9,
    paddingHorizontal: 14,
    minWidth: 58,
    alignItems: "center",
  },
  addButtonPressed: { backgroundColor: theme.brandBright },
  addButtonDisabled: { backgroundColor: "#b9bcc9" },
  addButtonText: { color: theme.white, fontWeight: "700", fontSize: 13 },
  inCart: { fontSize: 11, color: theme.inkMuted },

  errorTitle: { fontSize: 17, fontWeight: "700", color: theme.ink, marginBottom: 6 },
  body: { fontSize: 15, color: theme.inkMuted, textAlign: "center", lineHeight: 22 },
});
