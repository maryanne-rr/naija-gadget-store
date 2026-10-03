/**
 * Colours, copied from the website's design tokens.
 *
 * WHY A COPY RATHER THAN AN IMPORT
 * src/app/globals.css is CSS custom properties - a browser concept with no
 * meaning in React Native, which does its own styling. These values are lifted
 * from that file so the two look like one product rather than a website and an
 * app that happen to share a name.
 *
 * The indigo is deliberate and not decoration: it is the same brand-600 the
 * website uses for its buttons, so a screenshot of either is recognisably the
 * same shop.
 */
export const theme = {
  /** --color-ink-900. Body text and the header background. */
  ink: "#14163a",
  /** --color-ink-500. Secondary text. */
  inkMuted: "#6b6f92",
  /** --color-ink-200. Hairlines and card borders. */
  line: "#e3e5ef",
  /** Page background. */
  canvas: "#f7f8fc",
  white: "#ffffff",

  /** --color-brand-600. Buttons and the active tab. */
  brand: "#2e33a6",
  /** --color-brand-500. Pressed states. */
  brandBright: "#5b61d6",
  /** --color-brand-100. Tinted fills. */
  brandTint: "#e3e6ff",

  /** --color-signal-500. The deal badge. Amber, used sparingly. */
  signal: "#d18f00",
  signalTint: "#fff8ec",

  green: "#0f7a4d",
  red: "#b3261e",

  /**
   * --radius-card. The website uses 6px, which is quite square. Kept here so the
   * app does not look rounder and softer than the site it is supposed to be the
   * same shop as.
   */
  radius: 6,
  radiusPanel: 14,
} as const;
