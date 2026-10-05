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
   * The product photo, absolute.
   *
   * This used to be populated only when a line came out of the database, and the
   * comment above it claimed the website "renders its own images from the slug and
   * ignores this". Both halves were wrong: ProductCard renders
   * `product.image_url`, not anything derived from the slug, and AddToCartButton
   * never passed the field along at all - so the guest cart page fell back to the
   * emoji for every line while the product grid three centimetres away showed the
   * real photograph.
   *
   * Optional rather than required because a hand-edited or pre-existing basket in
   * localStorage will not have it. The cart falls back to the emoji, which renders
   * as a tofu box on iOS for several of the catalogue.
   */
  imageUrl?: string | null;
}

/** The maximum the +/- stepper allows. Also enforced again on the server. */
export const MAX_QUANTITY = 99;
