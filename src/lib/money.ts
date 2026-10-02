/**
 * Money handling.
 *
 * Rule for the whole app: amounts are stored and passed around as an integer
 * number of Kobo (1 Naira = 100 Kobo). Never as a float. `19.99 * 100` is not
 * reliably `1999` in JavaScript, and that drift is how shops end up charging
 * customers the wrong amount.
 */

export const CURRENCY = "NGN";

/** 1 Naira = 100 Kobo. Every amount in this app is an integer count of them. */
export const KOBO = 100;

export function formatNaira(kobo: number, options: { withSymbol?: boolean } = {}): string {
  const { withSymbol = true } = options;
  const naira = kobo / KOBO;

  const formatted = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(naira);

  return withSymbol ? `\u20a6${formatted}` : formatted;
}

export function toKobo(naira: number): number {
  return Math.round(naira * KOBO);
}

/**
 * How much is knocked off, as a whole percentage.
 *
 * WHY THIS IS SAFE WITH FLOATS WHILE EVERYTHING ELSE IS NOT
 * The two prices are integers of Kobo, which is the part that has to be exact.
 * This is only ever rendered as text next to the price ("Save 23%"), so a
 * rounding difference of one part in ten million cannot change what anybody is
 * charged. The arithmetic is done in integers anyway - the subtraction happens
 * before the division - so the only float is the ratio itself, and it is
 * rounded once on the way out.
 *
 * Returns null when there is no genuine saving. A "0% off" badge is worse than
 * no badge, and a negative one means the prices are wrong.
 */
export function discountPercent(price: number, compareAt: number | null): number | null {
  if (compareAt === null || compareAt <= 0) return null;
  if (compareAt <= price) return null;

  // Subtract in integers first: this is the only part that must be exact.
  const saved = compareAt - price;

  return Math.round((saved / compareAt) * 100);
}

/** The amount saved, in Kobo, for "Save ₦3,000" style copy. */
export function amountSaved(price: number, compareAt: number | null): number | null {
  if (compareAt === null || compareAt <= price) return null;
  return compareAt - price;
}
