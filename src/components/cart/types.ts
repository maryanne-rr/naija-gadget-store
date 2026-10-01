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
}

/** The maximum the +/- stepper allows. Also enforced again on the server. */
export const MAX_QUANTITY = 99;
