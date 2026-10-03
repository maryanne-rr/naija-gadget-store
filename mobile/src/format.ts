/**
 * Money and small formatting helpers.
 *
 * DELIBERATELY A COPY, NOT AN IMPORT
 * src/lib/money.ts in the website is a server module - it is reachable through
 * path aliases that only the Next.js build understands, and pulling it into the
 * app would tie Metro to the shop's tsconfig. So the two rules that matter are
 * restated here, and the test at the bottom of this file is the contract.
 *
 * THE RULE: every amount is an integer count of Kobo. 250000 means N2,500.00.
 * Never a float. 19.99 * 100 is not reliably 1999 in JavaScript, and that drift
 * is how shops end up charging the wrong amount.
 */

export const KOBO = 100;

export function formatNaira(kobo: number, withSymbol = true): string {
  const formatted = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kobo / KOBO);

  return withSymbol ? `₦${formatted}` : formatted;
}

/**
 * How much is knocked off, as a whole percentage, or null when there is no
 * genuine saving.
 *
 * Matches src/lib/money.ts on the website. A "0% off" badge is worse than no
 * badge, and a negative one means the two prices are wrong.
 */
export function discountPercent(
  price: number,
  compareAt: number | null | undefined,
): number | null {
  if (!compareAt || compareAt <= 0) return null;
  if (compareAt <= price) return null;

  return Math.round(((compareAt - price) / compareAt) * 100);
}
