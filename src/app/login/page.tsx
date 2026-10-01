import Link from "next/link";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { authIsConfigured } from "@/lib/auth";

/**
 * The sign-in page.
 *
 * Auth.js is configured with pages.signIn = "/login", so any error during the
 * OAuth handshake sends the visitor here rather than to a bare error string.
 * Without this route, an auth failure produced a 404 - which tells the user
 * nothing about what went wrong.
 *
 * Next.js passes the reason as ?error=<code>. Each one gets plain wording,
 * because "Configuration" or "OAuthAccountNotLinked" means nothing to a
 * customer.
 */

const ERRORS: Record<string, string> = {
  Configuration:
    "Sign-in is not set up correctly on the server. Check that the Google keys are in .env.local and the dev server was restarted.",
  AccessDenied:
    "That Google account is not allowed to use this app. Ask to be added as a test user in the Google Cloud console.",
  OAuthAccountNotLinked:
    "That Google account already exists without a password. Try signing in with a different account, or contact support.",
  OAuthCallback:
    "Google sent us back something we could not read. This is usually a redirect URI mismatch in the Google Cloud console.",
  EmailSignIn:
    "That email address is not verified on that Google account.",
  SessionRequired:
    "Please sign in to view that page.",
  AccessDenied_: "Sign-in was cancelled.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const code = typeof params.error === "string" ? params.error : undefined;
  const message = code ? (ERRORS[code] ?? "Something went wrong signing in. Please try again.") : null;

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="rounded-2xl border border-ink-200 bg-white p-8 text-center dark:border-ink-700 dark:bg-ink-800">
        <p className="text-4xl" aria-hidden="true">
          🇳🇬
        </p>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Sign in to Naija Gadgets</h1>

        {message ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            {message}
          </p>
        ) : (
          <p className="mt-2 text-ink-500">
            Your orders are kept against your Google account.
          </p>
        )}

        <div className="mt-6">
          {authIsConfigured() ? (
            <GoogleSignInButton
              label="Continue with Google"
              className="w-full rounded-lg border border-ink-300 px-5 py-2.5 font-semibold hover:bg-ink-100 dark:border-ink-600 dark:hover:bg-ink-800"
            />
          ) : (
            <p className="rounded-lg border border-dashed border-ink-300 p-3 text-sm text-ink-400 dark:border-ink-600">
              Google sign in is not configured yet.
            </p>
          )}
        </div>

        <p className="mt-6 text-sm">
          <Link href="/" className="text-ink-500 underline hover:text-ink-800">
            ← Back to the shop
          </Link>
        </p>
      </div>
    </div>
  );
}
