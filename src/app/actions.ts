"use server";

import { signIn, signOut } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Server Actions.
 *
 * These run on the server, which is why signing out is a form that posts here
 * rather than a fetch from the browser. The Auth.js secret is never exposed,
 * and the browser cannot be trusted to send the right redirect URL.
 */

/**
 * Start Google sign-in.
 *
 * WHY THIS IS NOT A PLAIN LINK
 * The obvious version is `<a href="/api/auth/signin/google">`. That does not
 * work with Auth.js v5 - it answers
 *
 *     302 -> /login?error=Configuration      "Unsupported action"
 *
 * because Auth.js protects its own endpoints with CSRF. The real flow is
 *
 *     GET  /api/auth/csrf             -> { csrfToken }
 *     POST /api/auth/signin/google    with that token
 *
 * Doing that in a server action means the token is never handled in client code
 * at all, which is both simpler and safer than wiring it up by hand.
 *
 * The post-login destination is hard-coded, never taken from the browser.
 */
export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });

  revalidatePath("/", "layout");
}
