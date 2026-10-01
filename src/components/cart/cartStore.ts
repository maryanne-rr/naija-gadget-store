"use client";

import type { CartItem } from "./types";

/**
 * The cart as an external store.
 *
 * WHY NOT JUST useState + useEffect?
 * The obvious version reads localStorage in an effect and calls setState, which
 * causes a second render pass on every page load - and React's lint rules
 * rightly complain about it. The correct tool for "state that lives outside
 * React, in localStorage" is useSyncExternalStore, which handles hydration
 * correctly for us.
 *
 * HOW HYDRATION STAYS SAFE
 * On the server, getServerSnapshot() returns an empty cart, so the HTML Next.js
 * sends contains "Cart is empty". The browser then checks getSnapshot() and
 * re-renders with the real cart if there is one. Because those two values are
 * allowed to differ, React does not report a hydration mismatch.
 *
 * This module deliberately contains no React. Keeping the storage logic plain
 * means it could be reused outside a component if the shop grows.
 */

const STORAGE_KEY = "naija-gadget-store:cart:v1";

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Cached parse result.
 *
 * useSyncExternalStore calls getSnapshot on every render and expects a
 * referentially stable answer while nothing has changed. Re-parsing JSON each
 * time would return a new array every call and put React into an infinite
 * render loop, so we remember the raw string we last parsed.
 */
let cachedRaw: string | null = null;
let cachedItems: CartItem[] = [];

/** Stable reference for the server snapshot. */
const EMPTY_CART: CartItem[] = [];

/**
 * localStorage is user-writable, so validate rather than trust. A hand-edited
 * or corrupted value must not crash the shop.
 */
function parseCart(raw: string): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is CartItem => {
      if (typeof entry !== "object" || entry === null) return false;
      const candidate = entry as Partial<CartItem>;
      return (
        typeof candidate.productId === "string" &&
        typeof candidate.name === "string" &&
        typeof candidate.price === "number" &&
        Number.isFinite(candidate.price) &&
        typeof candidate.quantity === "number" &&
        Number.isFinite(candidate.quantity)
      );
    });
  } catch {
    return [];
  }
}

function readStorage(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    // Private browsing, or storage disabled.
    return "[]";
  }
}

/** Called by useSyncExternalStore during render. Must be pure and stable. */
export function getSnapshot(): CartItem[] {
  const raw = readStorage();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = parseCart(raw);
  }
  return cachedItems;
}

/** Called by useSyncExternalStore on the server. Must be stable. */
export function getServerSnapshot(): CartItem[] {
  return EMPTY_CART;
}

function notify() {
  for (const listener of listeners) listener();
}

/**
 * Subscribe to changes. Two sources matter:
 *   1. our own writes, via notify()
 *   2. the `storage` event, which fires in OTHER tabs - so a cart opened in two
 *      tabs stays in sync
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      cachedRaw = null; // force a re-parse
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/**
 * Persist a new cart and tell React.
 *
 * This is the only way the cart changes. There is deliberately no separate
 * React state to keep in sync, so there is no window where the UI and storage
 * disagree.
 */
export function writeCart(items: CartItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota exceeded or storage disabled. The cart still works for this visit.
  }
  cachedRaw = null; // force getSnapshot to re-read
  notify();
}

export function clearCart(): void {
  writeCart([]);
}

/**
 * "Have we finished hydrating yet?"
 *
 * The cart page needs to know whether an empty basket is genuinely empty or
 * just not loaded yet, otherwise it flashes "Your cart is empty" before
 * revealing the real contents.
 *
 * This is a subscription rather than setState-in-an-effect, so it does not
 * trigger a cascading render. setTimeout(0) resolves after hydration has
 * committed, which is the moment the two diverge and it becomes safe to show
 * the real value.
 */
export function subscribeHydration(callback: () => void): () => void {
  const id = setTimeout(callback, 0);
  return () => clearTimeout(id);
}

/** On the client, once hydration has run. */
export function getHydratedSnapshot(): boolean {
  return true;
}

/** On the server, nothing has hydrated yet. */
export function getServerHydratedSnapshot(): boolean {
  return false;
}
