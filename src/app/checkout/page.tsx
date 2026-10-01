import Link from "next/link";
import { getSession, authIsConfigured } from "@/lib/auth";
import { integrations } from "@/lib/env";
import { CheckoutForm } from "./CheckoutForm";

/**
 * The checkout page.
 *
 * This wrapper is a Server Component so it can read the signed-in user and pass
 * the name/email down to the form. The form itself is a Client Component.
 */

/** Human wording for each `?error=` value the checkout can be returned with. */
const ERRORS: Record<string, string> = {
  cancelled: "You cancelled the payment. Your order is saved if you want to try again.",
  failed: "That payment did not complete. No money has left your account.",
};

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const errorMessage = errorCode ? ERRORS[errorCode] : undefined;

  const session = await getSession();
  const user = session?.user
    ? { name: session.user.name ?? "", email: session.user.email ?? "" }
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>
        <p className="mt-1 text-ink-500">
          Next step is the payment page. No card details are collected and no
          money moves.
        </p>
      </div>

      {!integrations.database && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Checkout needs the database</p>
          <p className="mt-1">
            Add the Supabase keys to <code className="rounded bg-red-100 px-1 dark:bg-red-900">.env.local</code>{" "}
            and run <code className="rounded bg-red-100 px-1 dark:bg-red-900">supabase/schema.sql</code>.
            See README.md &rsaquo; 1. Supabase.
          </p>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {errorMessage}
        </div>
      )}

      {user ? (
        <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100">
          <span>
            Signed in as <strong>{user.email}</strong>
          </span>
          <Link href="/orders" className="font-medium underline">
            Your orders
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-ink-200 bg-white p-4 text-sm dark:border-ink-700 dark:bg-ink-800">
          <p className="font-medium">Checking out as a guest</p>
          <p className="mt-1 text-ink-500">
            {authIsConfigured() ? (
              <>
                You can{" "}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                    Redirect into Google's OAuth flow, not a page navigation. */}
                <a href="/api/auth/signin/google" className="underline">
                  sign in with Google
                </a>{" "}
                to keep this order in your history.
              </>
            ) : (
              "Google sign in is not configured yet, so orders will not appear in a history."
            )}
          </p>
        </div>
      )}

      <CheckoutForm user={user} />

      <Link href="/cart" className="inline-block text-sm text-ink-500 underline hover:text-ink-800">
        ← Back to cart
      </Link>
    </div>
  );
}
