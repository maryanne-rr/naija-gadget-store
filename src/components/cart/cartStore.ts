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

/**
 * The localStorage basket, parsed.
 *
 * Called during render by useSyncExternalStore, so it must be pure and return a
 * referentially stable value while nothing has changed - hence the parse cache.
 */
export function localSnapshot(): CartItem[] {
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

// ============================================================================
//  Server-backed cart
//
//  localStorage is scoped to one browser profile on one device. A phone and a
//  laptop have two unrelated stores, so an item added on the website could never
//  appear on the phone. For a signed-in shopper the cart therefore lives in the
//  database instead - see src/lib/cart.ts - and this half of the file drives it.
//
//  WHY THE EXTERNAL STORE STILL EXISTS
//  useSyncExternalStore still does the React wiring, so CartProvider and every
//  component that calls useCart() are unchanged. The difference is only in what
//  getSnapshot() returns and where writes go. Swapping the storage backend should
//  not mean rewriting every consumer of it, and this way it did not.
// ============================================================================

type CartMode = "guest" | "server";

let mode: CartMode = "guest";
let serverItems: CartItem[] = [];

/** True once a server fetch has succeeded and serverItems is authoritative. */
let serverReady = false;

/** Why the last server call failed, for the banner the cart page can show. */
let serverError = "";

export function cartIsSynced(): boolean {
  return mode === "server" && serverReady;
}

export function cartSyncError(): string {
  return serverError;
}

/**
 * What React reads.
 *
 * Flipped only after a successful fetch, never optimistically. Reading an empty
 * serverItems during the fetch would flash "your cart is empty" at somebody whose
 * basket is merely still loading, which is the exact failure the `hydrated` flag
 * in CartProvider exists to prevent.
 */
function currentSnapshot(): CartItem[] {
  return mode === "server" ? serverItems : localSnapshot();
}

/** getSnapshot as a function reference, so useSyncExternalStore keeps working. */
export const getSnapshot = currentSnapshot;

function applyServerItems(items: CartItem[]) {
  serverItems = items;
  serverReady = true;
  serverError = "";
  mode = "server";
  notify();
}

async function callCartApi(method: "POST" | "PUT" | "DELETE", body?: unknown) {
  const response = await fetch("/api/cart", {
    method,
    headers: { "Content-Type": "application/json" },
    // The session cookie has to ride along, or the server sees an anonymous
    // request and answers 401. Same-origin fetch sends it by default, but saying
    // so explicitly keeps this working if the app is ever served from a
    // different origin.
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    // 401 is the interesting one: it means the session is gone, not that the
    // cart is broken. Falling back to the guest basket keeps the shop usable.
    throw new Error(response.status === 401 ? "not-signed-in" : `cart api ${response.status}`);
  }

  const payload = (await response.json()) as { items?: CartItem[] };
  if (!Array.isArray(payload.items)) {
    throw new Error("cart api returned no items");
  }

  applyServerItems(payload.items);
}

/**
 * Switch this browser over to the database cart.
 *
 * Called once, when a signed-in shopper's page loads. It does three things:
 * fetches the server cart, folds in anything already sitting in localStorage, and
 * clears localStorage so the merge cannot happen twice.
 *
 * THE MERGE MATTERS MORE THAN IT LOOKS
 * Somebody fills a basket, then signs in. Those items are in localStorage and
 * belong to the account they are about to have. Uploading them blind would
 * double anything already on the server, so quantities are summed server-side and
 * capped at stock.
 *
 * FAILURE IS NOT FATAL
 * If the fetch fails the cart stays in guest mode and the page keeps working.
 * A shopper with a working basket should not lose it because a network request
 * timed out.
 */
export async function syncToServerCart(): Promise<void> {
  if (mode === "server") return;

  try {
    const guestItems = localSnapshot();

    const response = await fetch("/api/cart", {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (response.status === 401) {
      // Not signed in after all, or the session expired mid-page. Guest mode is
      // the correct answer, and it needs no explanation to the shopper.
      return;
    }
    if (!response.ok) {
      throw new Error(`cart api ${response.status}`);
    }

    const payload = (await response.json()) as { items?: CartItem[] };
    if (!Array.isArray(payload.items)) {
      throw new Error("cart api returned no items");
    }

    if (guestItems.length > 0) {
      // PUT sums rather than replaces - see /api/cart.
      await callCartApi("PUT", {
        lines: guestItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      });

      // Only now that the merge has landed. Clearing first would lose the basket
      // if the PUT failed.
      writeCart([]);
      return;
    }

    applyServerItems(payload.items);
  } catch (error) {
    serverError = error instanceof Error ? error.message : String(error);
    console.error("[cart] could not sync to the server cart:", serverError);
  }
}

/** Add to the database cart. */
export async function serverAdd(productId: string, quantity = 1) {
  await callCartApi("POST", { productId, quantity, mode: "add" });
}

/**
 * Set an exact quantity. Zero removes the line - the same rule the guest cart
 * uses, and the same thing set_cart_quantity() does in the database.
 */
export async function serverSetQuantity(productId: string, quantity: number) {
  await callCartApi("POST", {
    productId,
    quantity: Math.max(0, Math.trunc(quantity)),
    mode: "set",
  });
}

export async function serverClear() {
  await callCartApi("DELETE");
}
