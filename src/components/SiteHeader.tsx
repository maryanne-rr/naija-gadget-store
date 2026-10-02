"use client";

import Link from "next/link";
import { useCart } from "./cart/CartProvider";
import { signOutAction } from "@/app/actions";
import { GoogleSignInButton } from "./GoogleSignInButton";

/**
 * Site header: announcement bar, navigation, cart badge and the account menu.
 *
 * This is a Client Component because the cart badge changes without a page
 * load. The signed-in user is read on the server and passed in as a prop, so the
 * account menu does not wait on a client-side session fetch.
 *
 * THE ANNOUNCEMENT BAR
 * "Lagos 1-2 days, elsewhere 2-5" sits above everything on every page. That is
 * a delivery promise, which is the single fact a Nigerian shopper most wants
 * before anything else and which no amount of page scrolling can put in front of
 * them. It is also checkable, unlike "fast shipping".
 */

interface HeaderUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

/** The categories worth linking from the bar. Storage is reachable from the home page. */
const NAV_LINKS = [
  { href: "/category/power", label: "Power" },
  { href: "/category/audio", label: "Audio" },
  { href: "/category/chargers", label: "Cables" },
  { href: "/category/phone-accessories", label: "Accessories" },
];

export function SiteHeader({ user, authReady }: { user: HeaderUser | null; authReady: boolean }) {
  const { count, hydrated } = useCart();

  // Before localStorage is read we do not know the count. Showing 0 is honest;
  // showing a stale number from a previous visit would not be.
  const badge = hydrated ? count : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/90 backdrop-blur dark:border-ink-700 dark:bg-ink-950/90">
      {/* ---- Announcement bar ---- */}
      <div className="bg-brand-600 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-1 px-4 py-1.5 text-xs sm:justify-between">
          <p>
            <span className="font-semibold">All 36 states + FCT</span>
            <span className="hidden sm:inline">
              {" "}
              &middot; Lagos 1&ndash;2 working days, elsewhere 2&ndash;5
            </span>
          </p>
          <p className="hidden sm:block">Original brands &middot; card, transfer or USSD</p>
        </div>
      </div>

      {/* h-20 rather than h-16: the wordmark is now two lines, name over
          tagline, and a 64px bar clips the second one. The bar is a fixed height
          rather than py-* so the sticky header does not change height when the
          session loads and the sign-in button becomes a sign-out button. */}
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4">
        {/* No flag emoji. U+1F1F3 U+1F1EC is two regional indicators rather than
            a character, so it draws a flag on macOS and Android and "NG" in a
            box on Windows - a broken-looking letter in the shop's own wordmark.
            Plain text renders identically everywhere.

            The tagline sits under the name rather than beside it: a header is
            one row tall, so name-plus-tagline has to stack, and the name is set
            at display size so it reads as a shop's name rather than a menu
            item - which is what it is. */}
        <Link href="/" className="group leading-none">
          <span className="block font-display text-2xl font-bold tracking-tight">
            Naija Gadgets
          </span>
          <span className="mt-1 block text-[11px] italic text-ink-500 transition-colors group-hover:text-brand-600 dark:text-ink-400 dark:group-hover:text-brand-300">
            …a home for quality gadgets
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Category links, hidden on the narrowest screens where they would
              push the cart off-screen. They are still reachable from the home
              page tiles, so nothing becomes unreachable. */}
          <ul className="mr-1 hidden items-center md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-card px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/orders"
            className="hidden rounded-card px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700 lg:block dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
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
                  className="rounded-card border border-ink-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-brand-50 dark:border-ink-600 dark:hover:bg-ink-800"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : authReady ? (
            <GoogleSignInButton
              className="rounded-card border border-ink-300 px-3 py-2 text-sm font-semibold transition-colors hover:bg-brand-50 dark:border-ink-600 dark:hover:bg-ink-800"
            />
          ) : (
            <span
              className="rounded-card border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-400 dark:border-ink-600"
              title="Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in .env.local"
            >
              Sign in
            </span>
          )}

          {/* ---- Cart ---- */}
          <Link
            href="/cart"
            className="relative rounded-card bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <span className="flex items-center gap-2">
              <span className="hidden sm:inline">Cart</span>
            </span>
            {badge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-signal-300 px-1 text-xs font-bold text-ink-950">
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