"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  cartIsSynced,
  clearCart as clearGuestCart,
  getHydratedSnapshot,
  getServerHydratedSnapshot,
  getServerSnapshot,
  getSnapshot,
  localSnapshot,
  serverAdd,
  serverClear,
  serverSetQuantity,
  subscribe,
  subscribeHydration,
  syncToServerCart,
  writeCart,
} from "./cartStore";
import { MAX_QUANTITY, type CartItem } from "./types";

/**
 * Cart state for the whole app.
 *
 * TWO STORES, ONE INTERFACE
 *   - A signed-in shopper's cart lives in the database, so the same basket
 *     follows them from the website to the phone.
 *   - A guest's cart lives in localStorage, exactly as it always did. A basket
 *     belongs to someone who has not signed in yet, and an abandoned cart is not
 *     an order.
 *
 * Every consumer calls useCart() and cannot tell which one it has, which is the
 * point: the swap is contained here and in cartStore.ts rather than reaching into
 * the cart page, the header badge and the checkout form.
 *
 * WHY THE EXTERNAL STORE IS STILL HERE
 * The data lives outside React in both modes, so useSyncExternalStore is still the
 * right tool and hydration still behaves. What changed is what getSnapshot()
 * returns and where writes go.
 */

interface CartContextValue {
  items: CartItem[];
  /** Total number of individual units, for the header badge. */
  count: number;
  /** Integer Kobo. Display only. */
  subtotal: number;
  /**
   * False during server rendering and the hydration render, true afterwards.
   * Use it to avoid showing an "empty" state that is merely not loaded yet.
   */
  hydrated: boolean;
  /** True when this cart is the database one, shared with the mobile app. */
  synced: boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  signedIn = false,
}: {
  children: ReactNode;
  /**
   * Whether anybody is signed in. Passed in from the server layout, which is the
   * only place that knows, so the client never has to guess - and never renders a
   * "signed in, empty cart" state that is really "not loaded yet".
   */
  signedIn?: boolean;
}) {
  // React re-reads this on every render and re-renders when it changes. During
  // hydration it uses the server snapshot (empty), so the first paint matches
  // the HTML Next.js sent - no mismatch warning.
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );

  // Only for a signed-in shopper, and only once per page load. The store guards
  // against doing it twice, and this effect returns a cleanup so React Strict
  // Mode's double-invoke in development does not fire two merges.
  useEffect(() => {
    if (!signedIn) return;
    void syncToServerCart();
  }, [signedIn]);

  const add = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      if (cartIsSynced()) {
        // The database decides the final number - it caps at the stock on hand.
        void serverAdd(item.productId, quantity);
        return;
      }

      const next = [...localSnapshot()];
      const index = next.findIndex((entry) => entry.productId === item.productId);
      const cap = item.maxStock > 0 ? Math.min(item.maxStock, MAX_QUANTITY) : MAX_QUANTITY;

      if (index === -1) {
        next.push({ ...item, quantity: Math.min(Math.max(quantity, 1), cap) });
      } else {
        next[index] = {
          ...next[index],
          quantity: Math.min(next[index].quantity + quantity, cap),
        };
      }

      writeCart(next);
    },
    [],
  );

  const setQuantity = useCallback((productId: string, quantity: number) => {
    if (cartIsSynced()) {
      // A quantity of zero removes the line, on both sides of the wire.
      void serverSetQuantity(productId, quantity);
      return;
    }

    const next = localSnapshot()
      .map((entry) => {
        if (entry.productId !== productId) return entry;
        const cap = entry.maxStock > 0 ? Math.min(entry.maxStock, MAX_QUANTITY) : MAX_QUANTITY;
        return { ...entry, quantity: Math.max(0, Math.min(Math.trunc(quantity), cap)) };
      })
      // A quantity of zero means "remove", not "a free item".
      .filter((entry) => entry.quantity > 0);

    writeCart(next);
  }, []);

  const remove = useCallback((productId: string) => {
    if (cartIsSynced()) {
      void serverSetQuantity(productId, 0);
      return;
    }
    writeCart(localSnapshot().filter((entry) => entry.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    if (cartIsSynced()) {
      void serverClear();
      return;
    }
    clearGuestCart();
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

    return {
      items,
      count,
      subtotal,
      hydrated,
      synced: cartIsSynced(),
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [items, hydrated, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>.");
  }
  return context;
}

export type { CartItem };
