/**
 * Where the app points.
 *
 * EXPO_PUBLIC_API_URL is inlined by Metro at build time, so the same source can
 * talk to a laptop during development and to the deployed shop in a demo. The
 * fallback is the live site, which means `npx expo start` works with no
 * configuration at all - one fewer thing to get wrong on a phone.
 *
 * WHY THE SHOP'S ADDRESS AND NOT SUPABASE
 * The task is to use the same API endpoints. The app has no Supabase key and no
 * database access of its own; every read and write goes through the shop's own
 * /api routes, which is also what keeps the service-role key on the server where
 * it belongs.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://naija-gadget-store.vercel.app";

/** How often the cart re-reads from the server while the app is in use. */
export const CART_POLL_MS = 5000;

/**
 * How often the sign-in screen checks whether the code has been approved.
 *
 * Faster than the cart poll because this is the one moment the user is watching a
 * spinner and waiting. Five seconds is well under the threshold where a wait
 * starts to feel broken, and it is still far below anything that would look like
 * hammering the server.
 */
export const PAIR_POLL_MS = 2000;

/**
 * The custom scheme, and where Google sends the browser back to.
 *
 * MUST MATCH "scheme" IN app.json. That field is what makes Android build an
 * intent filter, so a mismatch here means the browser finishes signing in and
 * then has nowhere to return to - the symptom being a spinner that never
 * resolves, with nothing in any log.
 *
 * Duplicated rather than imported because app.json is a build-time config file
 * and this is app code. They cannot share a value, so they are written next to
 * each other and checked in one place instead.
 */
export const APP_SCHEME = "naija";
export const GOOGLE_REDIRECT_PATH = "callback";
