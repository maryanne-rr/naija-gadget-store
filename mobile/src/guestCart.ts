import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CartItem } from "./api";

/**
 * The guest cart - a basket for somebody who has not signed in.
 *
 * WHY THIS EXISTS
 * The first version of this app showed the sign-in screen to anyone without a
 * token, which meant you could not look at a single product until you had an
 * account. That is wrong for a shop. Browsing is the whole point of a shopfront,
 * and asking for a Google login before showing anything is a good way to lose
 * the person.
 *
 * So a signed-out visitor gets everything a signed-in one gets, except that their
 * basket lives on the device instead of in the database.
 *
 * WHY THE DEVICE AND NOT THE SERVER
 * A cart row is keyed by user_id, and there is no user here. Inventing an
 * anonymous account server-side would mean an accounts table for people who may
 * never buy anything, and a basket that outlives the device it belongs to.
 *
 * This is also exactly what the website does. CartProvider keeps a guest basket in
 * localStorage and switches to the database only when somebody signs in, then
 * merges. Two clients, same rule - and the reason it feels like one shop rather
 * than two.
 *
 * WHY ASYNCSTORAGE AND NOT SECURE STORE
 * SecureStore is in this app for the bearer token, which is a live credential.
 * This is a basket of product ids and quantities: no secret, nothing worth
 * encrypting, and AsyncStorage is built for data of this size and shape. Putting
 * it in the keychain would be slower and would risk hitting value-size limits on
 * Android for no benefit.
 */

const KEY = "naija.cart.guest.v1";

/**
 * AsyncStorage is user-writable on a rooted device, so validate rather than
 * trust. A corrupted or hand-edited basket must not crash the shop - the same
 * reasoning as parseCart in the website's cartStore.
 */
function parse(raw: string): CartItem[] {
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

let cached: string | null = null;
let items: CartItem[] = [];

/** Synchronous read, so a render never has to await storage. */
export function guestCartSnapshot(): CartItem[] {
  if (cached === null) {
    // Left empty until load() resolves. A render cannot await, and rendering an
    // empty basket for one frame beats rendering nothing at all.
    cached = "[]";
  }
  return items;
}

export async function loadGuestCart(): Promise<CartItem[]> {
  try {
    const raw = (await AsyncStorage.getItem(KEY)) ?? "[]";
    cached = raw;
    items = parse(raw);
  } catch {
    items = [];
  }

  return items;
}

/**
 * Persist a new basket and hand it back.
 *
 * Returns the items so callers can `return save(next)` rather than saving and then
 * reaching for module state - which is how a write and the value that gets read
 * drift apart.
 */
async function save(next: CartItem[]): Promise<CartItem[]> {
  items = next;
  try {
    const raw = JSON.stringify(next);
    cached = raw;
    await AsyncStorage.setItem(KEY, raw);
  } catch {
    // Quota exceeded or storage unavailable. The basket still works for this
    // session, which is better than losing the whole screen.
  }

  return items;
}

/** Add to a line, or start one. Capped by stock and by 99, as everywhere else. */
export async function guestAdd(
  line: Omit<CartItem, "quantity">,
  quantity = 1,
): Promise<CartItem[]> {
  const current = items.length > 0 ? items : await loadGuestCart();
  const index = current.findIndex((entry) => entry.productId === line.productId);
  const cap = line.maxStock > 0 ? Math.min(line.maxStock, 99) : 99;

  const next = [...current];

  if (index === -1) {
    next.push({ ...line, quantity: Math.min(Math.max(quantity, 1), cap) });
  } else {
    next[index] = {
      ...next[index],
      quantity: Math.min(next[index].quantity + quantity, cap),
    };
  }

  return save(next);
}

/** Set an exact quantity. Zero removes the line, matching every other client. */
export async function guestSetQuantity(productId: string, quantity: number): Promise<CartItem[]> {
  const current = items.length > 0 ? items : await loadGuestCart();

  const next = current
    .map((entry) => {
      if (entry.productId !== productId) return entry;
      const cap = entry.maxStock > 0 ? Math.min(entry.maxStock, 99) : 99;
      return { ...entry, quantity: Math.max(0, Math.min(Math.trunc(quantity), cap)) };
    })
    .filter((entry) => entry.quantity > 0);

  return save(next);
}

export async function guestRemove(productId: string): Promise<CartItem[]> {
  const current = items.length > 0 ? items : await loadGuestCart();
  return save(current.filter((entry) => entry.productId !== productId));
}

export async function guestClear(): Promise<CartItem[]> {
  return save([]);
}

/**
 * The lines to hand the server when somebody signs in.
 *
 * Only ids and quantities. Names, prices and stock all come back from the
 * database, which is the point - a guest basket written three days ago on a
 * different catalogue must not carry its own idea of what things cost.
 */
export function guestCartLines(): { productId: string; quantity: number }[] {
  return items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
}

/** Fold a guest basket into the signed-in server one, then forget it. */
export async function forgetGuestCart(): Promise<void> {
  items = [];
  cached = "[]";
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to do. The next write overwrites it anyway.
  }
}
