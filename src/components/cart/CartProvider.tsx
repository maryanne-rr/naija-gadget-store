"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  clearCart,
  getHydratedSnapshot,
  getServerHydratedSnapshot,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  subscribeHydration,
  writeCart,
} from "./cartStore";
import { MAX_QUANTITY, type CartItem } from "./types";

/**
 * Cart state for the whole app.
 *
 * The actual data lives in localStorage and is managed by cartStore.ts; this
 * component wires that into React and exposes the actions the UI needs.
 *
 * Why the cart is client-side rather than a database table:
 * a basket belongs to someone who has not signed in yet, and an abandoned cart
 * is not an order. Keeping it on the device also means the basket survives a
 * page refresh and a closed tab.
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
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // React re-reads this on every render and re-renders when it changes. During
  // hydration it uses the server snapshot (empty), so the first paint matches
  // the HTML Next.js sent - no mismatch warning.
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );

  const add = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    const next = [...getSnapshot()];
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
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const next = getSnapshot()
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
    writeCart(getSnapshot().filter((entry) => entry.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    clearCart();
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

    return { items, count, subtotal, hydrated, add, setQuantity, remove, clear };
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
