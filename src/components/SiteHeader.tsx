"use client";

import Link from "next/link";
import { useCart } from "./cart/CartProvider";
import { signOutAction } from "@/app/actions";
import { GoogleSignInButton } from "./GoogleSignInButton";

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
        {/* No flag emoji. U+1F1F3 U+1F1EC is two regional indicators rather than
            a character, so it draws a flag on macOS and Android and "NG" in a
            box on Windows - a broken-looking letter in the shop's own wordmark.
            A plain wordmark renders identically everywhere. */}
        <Link href="/" className="font-display text-lg font-bold tracking-tight">
          Naija Gadgets
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
            <GoogleSignInButton
              className="rounded-lg border border-ink-300 px-3 py-2 text-sm font-semibold hover:bg-ink-100 dark:border-ink-600 dark:hover:bg-ink-800"
            />
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
