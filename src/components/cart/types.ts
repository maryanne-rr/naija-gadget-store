/** Shared cart types, kept in their own file so the store and UI agree. */

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  /**
   * Integer Kobo, kept only so the basket can show a running total without a
   * round trip to the server.
   *
   * THIS IS NEVER TRUSTED FOR PAYMENT. /api/checkout recalculates every price
   * from the database and ignores whatever the browser sends.
   */
  price: number;
  quantity: number;
  emoji: string;
  /** Stock at the time it was added, used to cap the quantity stepper. */
  maxStock: number;
  /**
   * The product photo, root-relative.
   *
   * Optional, and only populated when a line came out of the database rather than
   * out of localStorage. The website renders its own images from the slug and
   * ignores this; it exists so the mobile app's cart can show the product rather
   * than the emoji fallback, which renders as a tofu box for several of the
   * catalogue. /api/cart makes it absolute on the way out.
   */
  imageUrl?: string | null;
}

/** The maximum the +/- stepper allows. Also enforced again on the server. */
export const MAX_QUANTITY = 99;
