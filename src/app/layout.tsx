import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { CartProvider } from "@/components/cart/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSession, authIsConfigured } from "@/lib/auth";

/**
 * Two typefaces, deliberately.
 *
 * Geist handles everything: it is a workhorse, very legible at small sizes, and
 * right for prices, forms and body copy. It is also *invisible* - which is the
 * problem. Nothing about a shop front should be invisible.
 *
 * Bricolage Grotesque is the display face. Its tight, slightly irregular letter
 * spacing gives the headings some character, and pairing a characterful
 * display font with a neutral body font is the cheapest way to make a storefront
 * look designed rather than defaulted.
 *
 * Both are self-hosted by next/font at build time, so there is no request to
 * Google from a visitor's browser and no layout shift when they load.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  // Only the weights actually used, so we do not ship four unused files.
  weight: ["600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Naija Gadget Store",
    template: "%s | Naija Gadget Store",
  },
  description:
    "Chargers, power banks, audio and accessories. A bootcamp shop built with Next.js, Supabase, Mailgun and Google sign-in.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read the session on the server and hand it to the header as a prop.
  // Doing it here means the account menu is correct in the very first HTML
  // response, instead of popping in after a client-side fetch.
  const session = await getSession();

  const user = session?.user
    ? {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }
    : null;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${display.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <CartProvider>
          <SiteHeader user={user} authReady={authIsConfigured()} />

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  );
}
