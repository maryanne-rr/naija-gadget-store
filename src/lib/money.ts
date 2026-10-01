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
