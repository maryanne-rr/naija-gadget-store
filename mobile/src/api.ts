import { API_URL } from "./config";

/**
 * Every call the app makes to the shop.
 *
 * ONE CLIENT, THE SAME ENDPOINTS AS THE WEBSITE
 * Nothing here talks to Supabase. The app has no database credentials and no
 * service-role key - it goes through the shop's own /api routes, which is both
 * what the task asks for and the only arrangement that keeps the service-role key
 * on the server. The cart, in particular, is the same /api/cart the website
 * calls; the only difference is the Authorization header instead of a cookie.
 */

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  tagline: string;
  spec: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  emoji: string;
  stock: number;
  category: string | null;
  deal: boolean;
}

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
  maxStock: number;
  /**
   * The product photo, already made absolute by /api/cart.
   *
   * The emoji is a fallback, and a poor one: several of the catalogue's emoji
   * render as a tofu box on iOS, which is what the cart looked like before this
   * existed - three rows of meaningless glyphs for products that all have a
   * photograph. Null only when the product genuinely has no image_url.
   */
  imageUrl?: string | null;
}

export interface Cart {
  items: CartItem[];
  count: number;
  subtotal: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  /** Sent as a header rather than a query string. See note below. */
  claimSecret?: string;
};

/**
 * Every request goes through here.
 *
 * WHY ERRORS BECOME MESSAGES RATHER THAN STACK TRACES
 * A dropped connection and a 401 need different things from the person holding
 * the phone, and neither of them is a stack trace. Each failure below turns into
 * something that can be shown on screen.
 *
 * WHY THE CLAIM SECRET IS A HEADER
 * The pairing endpoint's whole security argument rests on the secret staying
 * private. In a query string it would land in access logs and in any Referer
 * header that followed.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, claimSecret } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (claimSecret) headers["x-claim-secret"] = claimSecret;

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the shop. Check your connection.", 0);
  }

  const payload = (await response.json().catch(() => null)) as
    | (Record<string, unknown> & { error?: string })
    | null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error ?? `The shop returned an error (${response.status}).`,
      response.status,
    );
  }

  return payload as T;
}

/** The catalogue. Public, so it works before anybody signs in. */
export async function fetchProducts(): Promise<Product[]> {
  const payload = await request<{ products: Product[] }>("/api/products");
  return payload.products ?? [];
}

export async function fetchCart(token: string): Promise<Cart> {
  return request<Cart>("/api/cart", { token });
}

/**
 * Add one, or set an exact quantity.
 *
 * mode "add" is the product page button and mode "set" is the cart stepper.
 * Sending which one is meant keeps the ambiguity out of the server, matching what
 * the website does.
 */
export async function updateCart(
  token: string,
  productId: string,
  quantity: number,
  mode: "add" | "set",
): Promise<Cart> {
  return request<Cart>("/api/cart", {
    method: "POST",
    token,
    body: { productId, quantity, mode },
  });
}

/**
 * Fold a guest basket into the signed-in one.
 *
 * Called once, at sign-in. Quantities are summed and capped at stock by the
 * database, so merging cannot lose an item or create a line that cannot be
 * bought - see /api/cart.
 *
 * Only ids and quantities go up. Names, prices and stock are re-read from the
 * database, so a basket assembled days ago cannot carry its own idea of what
 * things cost.
 */
export async function mergeGuestCart(
  token: string,
  lines: { productId: string; quantity: number }[],
): Promise<Cart> {
  if (lines.length === 0) {
    return request<Cart>("/api/cart", { token });
  }

  return request<Cart>("/api/cart", { method: "PUT", token, body: { lines } });
}

/** Ask for a pairing code. Returns the code and the URL to open. */
export async function createPairing(claimSecret: string): Promise<{
  code: string;
  pairUrl: string;
  expiresInSeconds: number;
}> {
  return request("/api/mobile/pair", {
    method: "POST",
    body: { claimSecret },
  });
}

export type PollResult =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "expired" }
  | { status: "ready"; token: string; user: { id: string; email: string | null } };

/**
 * Ask whether the code has been approved.
 *
 * The phone calls this every couple of seconds until it is. Each call burns the
 * pairing on success - see pollPairing in src/lib/devicePairing.ts - so a code
 * works exactly once.
 */
export async function pollPairing(
  code: string,
  claimSecret: string,
): Promise<PollResult> {
  return request<PollResult>(`/api/mobile/pair/${encodeURIComponent(code)}`, {
    claimSecret,
  });
}
