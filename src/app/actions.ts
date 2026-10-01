"use server";

import { signOut } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Server Actions.
 *
 * These run on the server, which is why signing out is a form that posts here
 * rather than a fetch from the browser. The Auth.js secret is never exposed,
 * and the browser cannot be trusted to send the right redirect URL.
 */

export async function signOutAction() {
  // Where to land afterwards. Deliberately a hard-coded path rather than
  // anything the browser sends - a crafted value could otherwise bounce someone
  // to an attacker's site after they sign out.
  const redirectTo = "/";

  await signOut({ redirectTo });

  revalidatePath("/", "layout");
}
