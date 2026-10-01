import { NextResponse, type NextRequest } from "next/server";
import { authIsConfigured, handlers } from "@/lib/auth";
/**
 * Auth.js owns this catch-all route.
 *
 * GET  /api/auth/signin/google   - start the Google redirect
 * GET  /api/auth/callback/google - Google sends the customer back here
 * GET  /api/auth/session         - who is signed in
 * POST /api/auth/signout         - sign out
 *
 * The callback URL you must register in Google Cloud Console is
 *     http://localhost:3000/api/auth/callback/google
 * It is the callback route that matters; the others are internal plumbing.
 */

const NOT_CONFIGURED =
  "Google sign in is not set up yet.\n\n" +
  "Add these to .env.local and restart the dev server:\n" +
  "  AUTH_GOOGLE_ID\n  AUTH_GOOGLE_SECRET\n  AUTH_SECRET\n\n" +
  "See README.md > 3. Google Cloud for the click-by-click steps.";

/**
 * Before Google is configured, Auth.js would redirect to its own error page
 * with something unhelpful. Intercept and explain instead, so the demo can be
 * walked through without half the features looking broken.
 */
function guard(): NextResponse | null {
  if (authIsConfigured()) return null;

  return new NextResponse(NOT_CONFIGURED, {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const blocked = guard();
  if (blocked) return blocked;
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const blocked = guard();
  if (blocked) return blocked;
  return handlers.POST(request);
}
