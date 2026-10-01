import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { CartProvider } from "@/components/cart/CartProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSession, authIsConfigured } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
