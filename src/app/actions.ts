"use server";

import { signIn, signOut } from "@/lib/auth";
import { findOrderForGuest, TRACKED_ORDER_COOKIE } from "@/lib/orders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

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

/**
 * Look up a guest order from its reference and the email it was placed with.
 *
 * WHY A SERVER ACTION AND NOT A LINK WITH QUERY STRINGS
 * A form that GETs to /orders?reference=...&email=... would put the customer's
 * email address in the URL, where it lands in the browser history, in any
 * Referer header on the next outbound link, and in the access log. Posting keeps
 * it in the request body.
 *
 * WHY A REDIRECT AND A COOKIE RATHER THAN RETURNING THE ORDER
 * Two reasons.
 *
 * A server action that returns data has to send it to the browser, and the order
 * record holds a shipping address and a phone number. Redirecting means the page
 * re-fetches it server-side and nothing sensitive crosses into a payload that
 * could be logged.
 *
 * And the redirect cannot carry the email - which is the problem, because the
 * page then has only the reference and a reference alone must not be enough. So
 * the successful lookup leaves a single-use, httpOnly cookie holding just the
 * reference. That cookie is the proof: the only way to obtain one is to already
 * have supplied a matching reference AND email. The page deletes it as it reads
 * it, so it cannot be replayed.
 */
export async function trackOrder(formData: FormData) {
  const reference = String(formData.get("reference") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!reference || !email) {
    redirect("/orders?error=missing");
  }

  let order: Awaited<ReturnType<typeof findOrderForGuest>> = null;

  try {
    order = await findOrderForGuest(reference, email);
  } catch {
    // Deliberately vague. Whether the order exists is not something to confirm
    // for someone who may not be the person who placed it.
    redirect("/orders?error=not-found");
  }

  if (!order) {
    redirect("/orders?error=not-found");
  }

  const jar = await cookies();
  jar.set(TRACKED_ORDER_COOKIE, order.reference, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/orders",
    // Ten minutes is long enough to read a receipt and short enough that a
    // shared machine does not leave it lying around.
    maxAge: 600,
  });

  // The email is dropped here rather than carried on the redirect. It is not
  // needed again, and a GET link carrying it would put the customer's address in
  // the URL, the browser history and any Referer header that follows.
  jar.delete("tracked_email");

  redirect("/orders?tracked=1");
}
