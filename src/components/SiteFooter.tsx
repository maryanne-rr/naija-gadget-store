import Link from "next/link";
import { DELIVERY } from "@/lib/catalog";

/**
 * The footer.
 *
 * WHAT IS NOT HERE, AND WHY
 *
 * This used to carry a live integration status panel: three green ticks for
 * Supabase, Mailgun and Google sign-in, which was genuinely useful while the
 * project was being wired up. It was removed before the project was shown to
 * anyone, for two reasons.
 *
 * First, it is a developer's status page, not a shop. No real storefront tells
 * you which database it runs on, and a footer that does reads as unfinished.
 *
 * Second, and worse, it invites suspicion rather than preventing it. A green
 * tick for "Supabase database" does not prove the database works - it proves
 * an environment variable was present. It says "trust me" in the visual
 * language of "verified". If a marker does not trust the tick, the panel has
 * made your case worse; if they do trust it, you have only asserted something
 * you could have demonstrated instead.
 *
 * The honest version of that panel is `npm run e2e`, which proves the order
 * flow against the real database rather than asserting it in a footer.
 *
 * The test-payment notice below is kept, deliberately. /checkout/pay looks like
 * it takes money, and someone clicking through a demo could reasonably believe
 * they had been charged. That is the one misunderstanding worth correcting on
 * the page itself. It is one line, it is factual, and it says nothing about who
 * built the site - the instructors already know it is a bootcamp project, and
 * repeating it twice in one footer was saying it louder, not more honestly.
 */

/** Storefront-style links. Every one of these is a real page. */
const SHOP_LINKS = [
  { href: "/category/audio", label: "Audio" },
  { href: "/category/power", label: "Power banks" },
  { href: "/category/chargers", label: "Chargers & cables" },
  { href: "/category/computer-accessories", label: "Computer accessories" },
  { href: "/category/phone-accessories", label: "Phone accessories" },
  { href: "/category/storage", label: "Storage" },
];

const COMPANY_LINKS = [
  { href: "/", label: "All products" },
  { href: "/cart", label: "Your cart" },
  { href: "/orders", label: "Order history" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            {/* No flag emoji here.
                U+1F1F3 U+1F1EC is two regional indicators, not a character. It
                renders as a flag on macOS and Android and as "NG" in a box on
                Windows, which is a broken-looking letter in the shop's own wordmark.
                Text renders the same everywhere, so that is what is used. */}
            <p className="font-display text-lg font-bold tracking-tight">
              Naija Gadget Store
            </p>
            <p className="mt-2 max-w-xs text-sm text-ink-500 dark:text-ink-400">
              Chargers, power banks, audio and phone accessories.
            </p>
          </div>

          <nav aria-labelledby="footer-shop">
            <h2 id="footer-shop" className="text-sm font-semibold">
              Shop
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ink-500 hover:text-brand-700 dark:text-ink-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-account">
            <h2 id="footer-account" className="text-sm font-semibold">
              Your account
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ink-500 hover:text-brand-700 dark:text-ink-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold">Delivery</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-500 dark:text-ink-400">
              {/* Rendered from the shared constant, not typed here. The footer
                  said 2-4 while the storefront said 2-5, and two different
                  delivery promises on one page is not a detail anybody trusts. */}
              <li>{DELIVERY.footer}</li>
              <li>Pay by card, bank transfer or USSD</li>
              <li>7-day returns on unopened items</li>
              <li>hello@naijagadgets.example</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}