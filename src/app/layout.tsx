import type { Metadata } from "next";
import { Familjen_Grotesk, Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";

import { CartProvider } from "@/components/cart/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSession, authIsConfigured } from "@/lib/auth";

/**
 * Two typefaces, chosen for a shop that sells objects people compare.
 *
 * Figtree carries the body. It is a rounded, open grotesque - friendly without
 * being childish, which is the register for a shop that has to look trustworthy
 * while selling a ₦4,500 cable.
 *
 * Familjen Grotesk is the display face, and it is doing a specific job. It was
 * drawn for a Swedish maker of measuring equipment, so its letterforms have the
 * slightly mechanical, confident feel of a spec sheet rather than of a lifestyle
 * brand. That is right for this catalogue: the customer is comparing numbers -
 * 20,000mAh against 10,000mAh, 40 hours against 12 - and the typeface says
 * "these are specifications". Bricolage Grotesque, the previous choice, was
 * warmer and more editorial, which suits a shop selling a lifestyle and not a
 * list of specs.
 *
 * Both are self-hosted by next/font at build time, so there is no request to
 * Google from a visitor's browser and no layout shift when they load.
 */
const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Familjen_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  // Only the weights actually used, so we do not ship four unused files.
  weight: ["600", "700"],
});

const mono = Geist_Mono({
  variable: "--font-mono",
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
      className={`${body.variable} ${display.variable} ${mono.variable} h-full antialiased`}
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
