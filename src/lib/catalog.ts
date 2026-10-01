/**
 * The product catalogue, in TypeScript.
 *
 * This is the single source of truth for the demo. It does two jobs:
 *
 *   1. If Supabase is not configured yet, `lib/products.ts` serves products
 *      from here so the shop still looks like a shop on a fresh clone.
 *   2. It is the master copy that `supabase/seed.sql` mirrors. If you change
 *      prices here, copy them across (or re-run the SQL) or the database and
 *      the fallback will disagree.
 *
 * `price` is an integer number of Kobo.
 */

export interface Product {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  /** Integer Kobo. Never a float. */
  price: number;
  currency: string;
  image_url: string | null;
  emoji: string;
  stock: number;
  featured: boolean;
  created_at: string;
}

type SeedProduct = Omit<Product, "id" | "currency" | "created_at">;

const SEED: SeedProduct[] = [
  {
    slug: "anker-powercore-20000",
    name: "Anker PowerCore 20000mAh",
    tagline: "The one battery that always fits",
    description:
      "20,000mAh of Anker PowerBank power in a slim slab that charges an iPhone four times over, or top up a 13\" laptop once. Has two USB-A ports and one USB-C with 18W fast charging, plus a digital display so you always know how much juice is left. Charges fully in about six hours.",
    price: 2850000,
    image_url: null,
    emoji: "\u{1F50B}",
    stock: 24,
    featured: true,
  },
  {
    slug: "oraimo-65w-gan-charger",
    name: "Oraimo 65W GaN Charger",
    tagline: "One brick for laptop, phone and watch",
    description:
      "Gallium nitride means this 65W charger is roughly half the size of the brick it replaces, with enough power to charge a 13\" ultrabook over USB-C. Two USB-C ports and one USB-A. Works with Nigerian outlets and international plugs, so it survives a trip.",
    price: 1290000,
    image_url: null,
    emoji: "\u{1F50C}",
    stock: 41,
    featured: true,
  },
  {
    slug: "jbl-tune-510bt",
    name: "JBL Tune 510BT",
    tagline: "Punchy bass, 40-hour battery",
    description:
      "On-ear wireless headphones with JBL Pure Bass sound, 40 hours of playback and a five-minute charge that buys you another three hours. Multipoint pairing means you can stay connected to your laptop and phone at the same time and switch without fussing.",
    price: 3400000,
    image_url: null,
    emoji: "\u{1F3A7}",
    stock: 17,
    featured: true,
  },
  {
    slug: "mpow-6in1-cable",
    name: "MPOW 6-in-1 USB-C Cable",
    tagline: "Because the charger has one port",
    description:
      "A 1.2m braided cable that splits into USB-C, Lightning, Micro-USB, USB-A and two standard USB-A ports. Genuinely the cable to keep in a draw bag when half your devices need different connectors.",
    price: 450000,
    image_url: null,
    emoji: "\u{1F50E}",
    stock: 63,
    featured: false,
  },
  {
    slug: "samsung-galaxy-buds-fe",
    name: "Samsung Galaxy Buds FE",
    tagline: "Noise cancelling in a pocket",
    description:
      "Active noise cancellation, 30 hours total with the case, and a build light enough to forget you are wearing them. The case is genuinely pocket-sized, which is the thing most rivals get wrong.",
    price: 4100000,
    image_url: null,
    emoji: "\u{1F3E3}",
    stock: 12,
    featured: false,
  },
  {
    slug: "xiaomi-power-bank-3",
    name: "Xiaomi Mi Power Bank 3",
    tagline: "18W two-way fast charge",
    description:
      "A no-nonsense 20,000mAh bank with USB-C in and out, so one cable charges the bank and your phone. The plain black finish and matte buttons feel a step above the usual budget options.",
    price: 2100000,
    image_url: null,
    emoji: "\u{26F1}",
    stock: 38,
    featured: false,
  },
  {
    slug: "logitech-b100-mouse",
    name: "Logitech B100 Wireless Mouse",
    tagline: "Quiet, cheap, genuinely lasts",
    description:
      "A 2.4GHz wireless mouse with an optical sensor, symmetric shape and a battery that runs about a year on one AA. There is nothing clever about it, which is exactly why it is the shop default.",
    price: 950000,
    image_url: null,
    emoji: "\u{1F5B1}",
    stock: 55,
    featured: false,
  },
  {
    slug: "tecno-spark-20-combo",
    name: "Spark 20 Case + Tempered Glass",
    tagline: "Two layers of not-scratching-your-phone",
    description:
      "A soft-touch TPU case with raised edges around the camera, bundled with a 9H tempered glass screen protector. Cut precisely for the Spark 20, and the case stays on without the buttons feeling mushy.",
    price: 320000,
    image_url: null,
    emoji: "\u{1F6F0}",
    stock: 89,
    featured: false,
  },
  {
    slug: "kingston-128gb-microsd",
    name: "Kingston 128GB microSDXC",
    tagline: "Class 10, the one that actually works",
    description:
      "A 128GB Class 10 card rated for up to 100MB/s read. Plenty for a dashcam, a Nintendo Switch, or a phone that has run out of internal storage. Comes with a plastic SD adapter.",
    price: 875000,
    image_url: null,
    emoji: "\u{1F5BC}",
    stock: 74,
    featured: false,
  },
  {
    slug: "led-desk-lamp",
    name: "LED Desk Lamp with USB Port",
    tagline: "Five warmths, and a phone charger",
    description:
      "A desk lamp with five colour temperatures and three brightness levels, and a 5V USB port in the base so your phone charges from the lamp. The arm holds position properly instead of slowly folding under its own weight.",
    price: 799900,
    image_url: null,
    emoji: "\u{1FA91}",
    stock: 30,
    featured: false,
  },
];

/** Deterministic ids so the fallback catalogue is stable between renders. */
function seedProduct(seed: SeedProduct, index: number): Product {
  return {
    ...seed,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    currency: "NGN",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

export const demoProducts: Product[] = SEED.map(seedProduct);
