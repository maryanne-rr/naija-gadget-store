"use client";

import Link from "next/link";
import { useCart } from "./cart/CartProvider";
import { signOutAction } from "@/app/actions";

/**
 * Site header: navigation, cart badge and the account menu.
 *
 * This is a Client Component because the cart badge changes without a page
 * load. The signed-in user is read on the server and passed in as a prop, so
 * the account menu does not wait on a client-side session fetch.
 */

interface HeaderUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

export function SiteHeader({ user, authReady }: { user: HeaderUser | null; authReady: boolean }) {
  const { count, hydrated } = useCart();

  // Before localStorage is read we do not know the count. Showing 0 is honest;
  // showing a stale number from a previous visit would not be.
  const badge = hydrated ? count : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/85 backdrop-blur dark:border-ink-700 dark:bg-ink-900/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span aria-hidden="true">🇳🇬</span>
          <span>Naija Gadgets</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
          >
            Shop
          </Link>

          <Link
            href="/orders"
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
          >
            Orders
          </Link>

          {/* ---- Account ---- */}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden max-w-40 truncate text-sm text-ink-600 sm:inline dark:text-ink-300">
                {user.name ?? user.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-ink-300 px-3 py-2 text-sm font-medium hover:bg-ink-100 dark:border-ink-600 dark:hover:bg-ink-800"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : authReady ? (
            /* eslint-disable-next-line @next/next/no-html-link-for-pages --
               Not a page navigation: this hands off to Google via a redirect,
               and client-side routing would break the OAuth handshake. */
            <a
              href="/api/auth/signin/google"
              className="flex items-center gap-2 rounded-lg border border-ink-300 px-3 py-2 text-sm font-semibold hover:bg-ink-100 dark:border-ink-600 dark:hover:bg-ink-800"
            >
              <GoogleMark />
              Sign in
            </a>
          ) : (
            <span
              className="rounded-lg border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-400 dark:border-ink-600"
              title="Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in .env.local"
            >
              Sign in
            </span>
          )}

          {/* ---- Cart ---- */}
          <Link
            href="/cart"
            className="relative rounded-lg bg-ink-900 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <span className="flex items-center gap-2">
              <span aria-hidden="true">🛒</span>
              <span className="hidden sm:inline">Cart</span>
            </span>
            {badge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-xs font-bold text-ink-900">
                {badge}
              </span>
            )}
            <span className="sr-only">
              {badge === 0 ? "Cart is empty" : `${badge} item${badge === 1 ? "" : "s"} in cart`}
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
