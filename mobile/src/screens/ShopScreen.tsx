import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SectionList,
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
 *
 * WHY SECTIONS RATHER THAN ONE LONG LIST
 * Twenty-eight products in a single column is a scroll with no landmarks: you
 * cannot tell whether you have seen half of it, and there is nothing to jump to.
 * Grouping by category gives the same information the website's nav does, and
 * makes the catalogue legible on a small screen without adding a filter control
 * nobody would use for 28 items.
 *
 * THE ORDER IS THE CATALOGUE'S, NOT THE API'S
 * The server sorts by featured then newest. That is the right order for "what is
 * new", which is not the same as "what would I like to look at", so what is
 * reduced leads and the rest follow the category order in catalog.ts.
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

  const sections = useMemo(() => groupIntoSections(products), [products]);

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
        <Text style={styles.loadingText}>Loading the shop…</Text>
      </View>
    );
  }

  if (error && products.length === 0) {
    return (
      <View style={styles.centre}>
        <Text style={styles.emptyTitle}>Could not load the shop</Text>
        <Text style={styles.body}>{error}</Text>
      </View>
    );
  }

  return (
    <SectionList
      style={styles.screen}
      contentContainerStyle={styles.list}
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionCount}>{section.data.length}</Text>
        </View>
      )}
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

/**
 * Split the catalogue into sections: featured first, then one per category.
 *
 * Featured products are pulled out of their category rather than duplicated, so
 * nothing appears twice - a list that shows the same keyboard under "Featured"
 * and again under "Computer accessories" reads as two products.
 */
function groupIntoSections(products: Product[]) {
  const featured = products.filter((product) => isFeatured(product));
  const rest = products.filter((product) => !isFeatured(product));

  const sections: { title: string; data: Product[] }[] = [];

  if (featured.length > 0) {
    sections.push({ title: "Deals", data: featured });
  }

  for (const category of CATEGORY_ORDER) {
    const items = rest.filter((product) => product.category === category.slug);
    if (items.length > 0) {
      sections.push({ title: category.name, data: items });
    }
  }

  // Anything whose category is not in the list, rather than dropping it silently.
  // Typed as Set<string> rather than inferred: CATEGORY_ORDER is `as const`, so an
  // inferred Set only accepts those six literals, and a product whose category is
  // anything else - which is exactly the case being handled - would not typecheck.
  const known = new Set<string>(CATEGORY_ORDER.map((c) => c.slug));
  const orphans = rest.filter((product) => !known.has(product.category ?? ""));
  if (orphans.length > 0) {
    sections.push({ title: "More", data: orphans });
  }

  return sections;
}

/**
 * Which products lead, and why the section is called "Deals".
 *
 * /api/products does not send the `featured` column, because nothing needs it on
 * the phone. Rather than widen the payload for one flag, a product that is
 * genuinely reduced stands in as the one worth surfacing first - a real discount
 * is a reason to look at something, whereas "featured" means only whatever the
 * seeder said.
 *
 * So the heading has to describe what is actually in it: eight of the
 * twenty-eight products carry a discount, each showing a struck was-price and a
 * "Save N%" badge. "Deals" says that in a word a shopper already understands.
 *
 * It is deliberately NOT "Deal of the day", which is a near-miss. That is a
 * different claim - one product, chosen by the date - and it belongs to the
 * website's carousel. Calling eight products the deal of the day makes seven of
 * them a false promise, which is the same reason products.deal is a column
 * separate from compare_at_price in the first place.
 */
function isFeatured(product: Product): boolean {
  return product.deal;
}

/**
 * Category order, copied from CATEGORIES in src/lib/catalog.ts.
 *
 * Copied rather than fetched so the app has a deliberate order. The API does send
 * categories, but a list ordered by however the database happens to return them is
 * worse than no sections at all. Keeping one place that decides the order - the
 * catalogue - is the point; the comment here says where to change it.
 */
const CATEGORY_ORDER = [
  { slug: "audio", name: "Audio" },
  { slug: "power", name: "Power banks" },
  { slug: "chargers", name: "Chargers & cables" },
  { slug: "phone-accessories", name: "Phone accessories" },
  { slug: "computer-accessories", name: "Computer accessories" },
  { slug: "storage", name: "Storage" },
] as const;

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

        {/* Deal badge on the photo, where it reads as a sticker rather than as
            another line of text competing with the price. */}
        {off !== null && !outOfStock ? (
          <View style={styles.dealFlag}>
            <Text style={styles.dealFlagText}>−{off}%</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.rowBody}>
        {product.brand ? <Text style={styles.brand}>{product.brand}</Text> : null}

        {/* Name leads, spec supports - the same rule as the product card on the
            website, so the two do not look like different products. */}
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        {product.spec ? <Text style={styles.spec}>{product.spec}</Text> : null}

        {/* Price and was-price on one baseline, so the saving reads as a
            relationship rather than as a fact sitting underneath. */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatNaira(product.price)}</Text>
          {off !== null ? (
            <Text style={styles.wasPrice}>{formatNaira(product.compareAtPrice!)}</Text>
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
        {inCart > 0 ? (
          <View style={styles.inCartPill}>
            <Text style={styles.inCartText}>{inCart} in cart</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.canvas },
  list: { padding: 14, paddingBottom: 24 },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: theme.canvas,
    gap: 10,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.ink,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  sectionCount: { fontSize: 12, fontWeight: "600", color: theme.inkMuted },

  row: {
    flexDirection: "row",
    backgroundColor: theme.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 10,
    marginBottom: 8,
    gap: 12,
    // A hairline shadow rather than a heavier border, so a row looks raised
    // without the list turning into a stack of grey boxes.
    shadowColor: "#14163a",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: theme.radius,
    backgroundColor: theme.canvas,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  thumbEmoji: { fontSize: 32 },

  dealFlag: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: theme.signal,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  dealFlagText: { color: theme.white, fontSize: 10, fontWeight: "800" },

  rowBody: { flex: 1, justifyContent: "center", minWidth: 0 },
  brand: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.inkMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.ink,
    marginTop: 2,
    lineHeight: 19,
  },
  spec: { fontSize: 12.5, color: theme.inkMuted, marginTop: 1 },

  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 5,
    flexWrap: "wrap",
  },
  price: { fontSize: 16, fontWeight: "800", color: theme.ink },
  wasPrice: { fontSize: 12.5, color: theme.inkMuted, textDecorationLine: "line-through" },

  rowAction: { justifyContent: "center", alignItems: "center", gap: 5 },
  addButton: {
    backgroundColor: theme.brand,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 62,
    alignItems: "center",
  },
  addButtonPressed: { backgroundColor: theme.brandBright },
  addButtonDisabled: { backgroundColor: "#c3c6d2" },
  addButtonText: { color: theme.white, fontWeight: "800", fontSize: 13 },

  inCartPill: {
    backgroundColor: theme.brandTint,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  inCartText: { fontSize: 10.5, fontWeight: "700", color: theme.brand },

  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.ink, marginBottom: 6 },
  body: { fontSize: 15, color: theme.inkMuted, textAlign: "center", lineHeight: 22 },
  loadingText: { fontSize: 14, color: theme.inkMuted },
});
