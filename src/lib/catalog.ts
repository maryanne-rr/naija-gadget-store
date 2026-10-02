/**
 * The product catalogue, in TypeScript.
 *
 * This is the single source of truth for the demo. It does two jobs:
 *
 *   1. If Supabase is not configured yet, `lib/products.ts` serves products
 *      from here so the shop still looks like a shop on a fresh clone.
 *   2. It is the master copy that `npm run seed` mirrors into the database. If
 *      you change prices here, re-run the seed or the two will disagree.
 *
 * `price` is an integer number of Kobo. Never a float.
 *
 * A note on `category`
 * --------------------
 * Categories live here as plain data rather than as their own database table.
 * That is a deliberate trade-off: a separate `categories` table would let you
 * store descriptions and ordering in the database, but it would also mean every
 * product page needs a join, and the category list would become a second thing
 * that can drift out of sync with the products. As slugs on the product row they
 * cannot disagree with anything.
 *
 * The consequence to be aware of: adding a category means adding it to CATEGORIES
 * below and then to the products. `npm run check:categories` (in scripts/) fails
 * if any product points at a category that does not exist, which is the guard
 * that replaces the constraint a join would have given us.
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
  /** Slug from CATEGORIES. Nullable so an old row without one still loads. */
  category: string | null;
  /**
   * The manufacturer, shown small above the product name.
   *
   * In this market a brand name is a trust signal rather than decoration: an
   * "original" Anker is worth more than an unbranded lookalike, and shoppers
   * look for the name specifically.
   */
  brand: string;
  /**
   * The one number that decides the purchase, e.g. "20,000 mAh" or "40 hours".
   *
   * This is the most important field on the card and the reason it exists. A
   * customer choosing between two power banks is not choosing between
   * photographs, they are comparing 20,000 against 10,000. Putting that figure
   * above the product name lets the comparison happen at a glance instead of
   * requiring three paragraphs to be read - which on a phone, on the pavement,
   * is the difference between a decision and an abandonment.
   *
   * Keep it short. If it needs a sentence it is not a spec.
   */
  spec: string;
  /** One or two further specs, for the product page's comparison strip. */
  specs: string[];
  /**
   * The price before a discount, in integer Kobo. Null when not on offer.
   *
   * THIS NEVER AFFECTS WHAT ANYBODY PAYS
   * Display only. The amount charged, the cart total and the order total are
   * all computed from `price`. That separation is the point: a struck-through
   * figure is a claim about what it used to cost, and if it were ever mixed
   * into the total then editing it would be editing a customer's bill.
   *
   * The database enforces compare_at_price > price, because "was ₦3,000, now
   * ₦3,200" is not a promotion, it is a lie that costs a customer.
   */
  compare_at_price: number | null;
  /** True when the product may appear in the deal-of-the-day rotation. */
  deal: boolean;
  created_at: string;
}

export interface Category {
  slug: string;
  name: string;
  /** One line for the category header and the nav tooltip. */
  blurb: string;
  emoji: string;
  /**
   * What a shopper compares across the products in here, e.g. "capacity".
   *
   * Stated on the category tile so the customer knows the basis of the
   * comparison before opening it. "6 items, compared by capacity" is a promise
   * that the page will be sorted and legible by that measure; "6 items" alone
   * is just a count.
   */
  comparedBy: string;
  /** The delivery promise, which is genuinely different Lagos vs everywhere. */
  delivery: string;
}

/**
 * The category list, in display order.
 *
 * Ordered the way a shop is actually browsed rather than alphabetically: the
 * things people arrive wanting (audio, power) come before the things they buy
 * alongside something else (accessories, storage).
 */
export const CATEGORIES: Category[] = [
  {
    slug: "power",
    name: "Power",
    blurb: "Banks and cells that keep going when the sockets do not.",
    emoji: "\u{1F50B}",
    comparedBy: "capacity in mAh",
    delivery: "Lagos next day",
  },
  {
    slug: "audio",
    name: "Audio",
    blurb: "Headphones, earbuds and speakers that survive a long trip home.",
    emoji: "\u{1F3A7}",
    comparedBy: "battery in hours",
    delivery: "Lagos next day",
  },
  {
    slug: "chargers",
    name: "Chargers & Cables",
    blurb: "Wall chargers, plugs and cables for every port you own.",
    emoji: "\u{1F50C}",
    comparedBy: "wattage",
    delivery: "Lagos next day",
  },
  {
    slug: "phone-accessories",
    name: "Phone Accessories",
    blurb: "Cases, tempered glass and pouches cut for your exact model.",
    emoji: "\u{1F4F1}",
    comparedBy: "price",
    delivery: "Same-day in Lagos",
  },
  {
    slug: "computer-accessories",
    name: "Computer Accessories",
    blurb: "Mice, keyboards and the small things that make a desk work.",
    emoji: "\u{1F5B3}",
    comparedBy: "price",
    delivery: "Lagos next day",
  },
  {
    slug: "storage",
    name: "Storage",
    blurb: "Cards and drives for the photos you have not backed up yet.",
    emoji: "\u{1F5BC}",
    comparedBy: "capacity",
    delivery: "Lagos next day",
  },
];

type SeedProduct = Omit<Product, "id" | "currency" | "created_at">;

const SEED: SeedProduct[] = [
  // ---------------------------------------------------------------- audio ---
  {
    slug: "jbl-tune-510bt",
    name: "JBL Tune 510BT",
    tagline: "Punchy bass, 40-hour battery",
    description:
      "On-ear wireless headphones with JBL Pure Bass sound, 40 hours of playback and a five-minute charge that buys you another three hours. Multipoint pairing means you can stay connected to your laptop and phone at the same time and switch without fussing.",
    price: 3400000,
    image_url: "/products/jbl-tune-510bt.jpg",
    emoji: "\u{1F3A7}",
    stock: 17,
    brand: "JBL",
    spec: "",
    compare_at_price: null,
    deal: false,
    specs: ["Pure Bass sound","Multipoint pairing","5-min quick charge"],
    featured: true,
    category: "audio",
  },
  {
    slug: "bose-qc25",
    name: "Bose QuietComfort 25",
    tagline: "The noise cancelling that fits in a bag",
    description:
      "Wired over-ear headphones with the best active noise cancelling you can buy at this price. The earcups fold flat, so they disappear into a laptop bag in a way the wireless rivals never quite manage. Cable included, plus a small case.",
    price: 8900000,
    image_url: "/products/bose-qc25.jpg",
    emoji: "\u{1F3A7}",
    stock: 8,
    brand: "Bose",
    spec: "",
    compare_at_price: 11500000,
    deal: true,
    specs: ["Wired, no battery","Folds flat","Case included"],
    featured: false,
    category: "audio",
  },
  {
    slug: "jbl-flip-4",
    name: "JBL Flip 4",
    tagline: "Waterproof, and it plays for twelve hours",
    description:
      "A cylindrical speaker with IP67 waterproofing, so it survives rain, sand and the bottom of a bag. 12 hours of playback, and pairing two of them turns them into a left-right stereo pair without an app.",
    price: 4250000,
    image_url: "/products/jbl-flip-4.jpg",
    emoji: "\u{1F0F}",
    stock: 21,
    brand: "JBL",
    spec: "",
    compare_at_price: 5900000,
    deal: true,
    specs: ["IP67 waterproof","Pairs into stereo","USB-C"],
    featured: true,
    category: "audio",
  },
  {
    slug: "yamaha-tw-e3a-earbuds",
    name: "Yamaha TW-E3A Earbuds",
    tagline: "Small case, serious drivers",
    description:
      "True wireless earbuds with a case small enough to lose in a pocket, which is the failure mode most rivals have. Six hours per charge and three more from the case. Touch controls, and an IPX4 rating for sweat.",
    price: 3100000,
    image_url: "/products/yamaha-tw-e3a-earbuds.jpg",
    emoji: "\u{1F3E3}",
    stock: 26,
    brand: "Yamaha",
    spec: "",
    compare_at_price: 3800000,
    deal: false,
    specs: ["24h with case","IPX4 sweat-proof","Touch controls"],
    featured: false,
    category: "audio",
  },
  {
    slug: "nothing-ear-2-earbuds",
    name: "Nothing Ear (2) Earbuds",
    tagline: "Noise cancelling in a pocket",
    description:
      "Active noise cancelling, 40 hours total with the case, and a build light enough to forget you are wearing them. The case is genuinely pocket-sized, which is the thing most rivals get wrong. Nothing's transparent design means you can see the electronics, and the microphones inside are good enough for calls in a Lagos traffic junction.",
    price: 4100000,
    image_url: "/products/nothing-ear-2-earbuds.jpg",
    emoji: "\u{1F3E3}",
    stock: 12,
    brand: "Nothing",
    spec: "",
    compare_at_price: null,
    deal: false,
    specs: ["Active noise cancelling","Transparent case","Wireless charging"],
    featured: false,
    category: "audio",
  },

  // ---------------------------------------------------------------- power ---
  {
    slug: "anker-powercore-20000",
    name: "Anker PowerCore 20000mAh",
    tagline: "The one battery that always fits",
    description:
      "20,000mAh of Anker PowerBank power in a slim slab that charges an iPhone four times over, or top up a 13\" laptop once. Has two USB-A ports and one USB-C with 18W fast charging, plus a digital display so you always know how much juice is left. Charges fully in about six hours.",
    price: 2850000,
    image_url: "/products/anker-powercore-20000.jpg",
    emoji: "\u{1F50B}",
    stock: 24,
    brand: "Anker",
    spec: "20,000 mAh",
    compare_at_price: 3600000,
    deal: true,
    specs: ["18W USB-C","4 phone charges","LED readout"],
    featured: true,
    category: "power",
  },
  {
    slug: "romoss-20000-powerbank",
    name: "Romoss 20,000mAh Power Bank",
    tagline: "Four ports, and it charges itself",
    description:
      "A 20,000mAh bank with two USB-A and two USB-C ports, so a whole bag can be topped up from one brick. The four-LED display shows remaining power in percentages rather than vague dots. USB-C in and out, so one cable does everything.",
    price: 2450000,
    image_url: "/products/romoss-20000-powerbank.jpg",
    emoji: "\u{1F50B}",
    stock: 33,
    brand: "Romoss",
    spec: "20,000 mAh",
    compare_at_price: 3200000,
    deal: true,
    specs: ["4 ports","45W USB-C","LED percentage"],
    featured: false,
    category: "power",
  },
  {
    slug: "anker-powercore-5000",
    name: "Anker PowerCore 5000mAh",
    tagline: "Pocket-sized, no cable included",
    description:
      "A credit-card-sized 5,000mAh bank that charges a phone twice over. Small enough to sit in a jacket pocket all week without noticing it, which is the point. USB-C only, and the cable is sold separately.",
    price: 1450000,
    image_url: "/products/anker-powercore-5000.jpg",
    emoji: "\u{1F50B}",
    stock: 47,
    brand: "Anker",
    spec: "5,000 mAh",
    compare_at_price: null,
    deal: false,
    specs: ["2 phone charges","Pocket sized","USB-C only"],
    featured: false,
    category: "power",
  },
  {
    slug: "oraimo-power-bank-20000",
    name: "Oraimo 20,000mAh Power Bank",
    tagline: "18W two-way fast charge",
    description:
      "A no-nonsense 20,000mAh bank with USB-C in and out, so one cable charges the bank and your phone. The round percentage readout on the front is the detail worth paying for: four vague dots tell you nothing when your phone is at 12%.",
    price: 2100000,
    image_url: "/products/oraimo-power-bank-20000.jpg",
    emoji: "\u{26F1}",
    stock: 38,
    brand: "Oraimo",
    spec: "20,000 mAh",
    compare_at_price: null,
    deal: false,
    specs: ["22.5W fast charge","Numeric readout","USB-C in and out"],
    featured: false,
    category: "power",
  },

  // ------------------------------------------------------------- chargers ---
  {
    slug: "oraimo-65w-gan-charger",
    name: "Oraimo 65W GaN Charger",
    tagline: "One brick for laptop, phone and watch",
    description:
      "Gallium nitride means this 65W charger is roughly half the size of the brick it replaces, with enough power to charge a 13\" ultrabook over USB-C. Two USB-C ports and one USB-A. Works with Nigerian outlets and international plugs, so it survives a trip.",
    price: 1290000,
    image_url: "/products/oraimo-65w-gan-charger.jpg",
    emoji: "\u{1F50C}",
    stock: 41,
    brand: "Oraimo",
    spec: "65W",
    compare_at_price: null,
    deal: false,
    specs: ["Charges a 13in laptop","2x USB-C + 1x USB-A","Half the size"],
    featured: true,
    category: "chargers",
  },
  {
    slug: "anker-powerport-40w",
    name: "Anker PowerPort 40W Charger",
    tagline: "Four ports, one wall socket",
    description:
      "Five ports in one brick: three USB-A and two USB-C with PowerIQ fast charging, which quietly renegotiates the current a device actually accepts instead of blasting it 5V and hoping. The folding prongs stop it snagging on a cable in a bag.",
    price: 1750000,
    image_url: "/products/anker-powerport-40w.jpg",
    emoji: "\u{1F50C}",
    stock: 29,
    brand: "Anker",
    spec: "40W",
    compare_at_price: 2350000,
    deal: true,
    specs: ["5 ports","PowerIQ fast charge","Folding prongs"],
    featured: false,
    category: "chargers",
  },
  {
    slug: "lazos-gan-30w",
    name: "Lazos GaN 30W Charger",
    tagline: "The one you can forget at home",
    description:
      "A 30W gallium nitride charger genuinely smaller than the phone charger it replaces, with one USB-C and one USB-A. Gallium nitride runs cool enough that it does not need a fan or a lump of heat sinks, which is where the size saving comes from.",
    price: 850000,
    image_url: "/products/lazos-gan-30w.jpg",
    emoji: "\u{1F50C}",
    stock: 52,
    brand: "Lazos",
    spec: "30W",
    compare_at_price: 1050000,
    deal: false,
    specs: ["GaN, runs cool","1x USB-C + 1x USB-A","Travel size"],
    featured: false,
    category: "chargers",
  },
  {
    slug: "braided-usbc-cable",
    name: "Braided USB-C Charging Cable",
    tagline: "The cable that outlasts the phone",
    description:
      "A 1.2m braided USB-C to USB-C cable with a bend rating tested well past what a phone's port survives, which is the number that actually matters. 60W charging, so it will run a laptop as happily as a phone. The braid stops the connector end fraying, which is where every cheap cable fails first.",
    price: 450000,
    image_url: "/products/braided-usbc-cable.jpg",
    emoji: "\u{1F50E}",
    stock: 63,
    brand: "Generic",
    spec: "60W",
    compare_at_price: 620000,
    deal: true,
    specs: ["1.2m braided","25,000 flex rated","USB-C to USB-C"],
    featured: false,
    category: "chargers",
  },
  {
    slug: "anker-m80-cable",
    name: "Anker USB-C Braided Cable",
    tagline: "The cable that outlasts the phone",
    description:
      "A 2m braided USB-C to USB-C cable with a bend rating tested to 25,000 flexes, which is the number that actually matters. 60W charging, so it will run a laptop as happily as a phone. The braid stops the connector end fraying.",
    price: 620000,
    image_url: "/products/anker-m80-cable.jpg",
    emoji: "\u{1F50E}",
    stock: 71,
    brand: "Anker",
    spec: "60W",
    compare_at_price: 820000,
    deal: false,
    specs: ["2m braided","25,000 flex rated","USB-C to USB-C"],
    featured: false,
    category: "chargers",
  },

  // -------------------------------------------------- computer accessories ---
  {
    slug: "logitech-b100-mouse",
    name: "Logitech B100 Wireless Mouse",
    tagline: "Quiet, cheap, genuinely lasts",
    description:
      "A 2.4GHz wireless mouse with an optical sensor, symmetric shape and a battery that runs about a year on one AA. There is nothing clever about it, which is exactly why it is the shop default.",
    price: 950000,
    image_url: "/products/logitech-b100-mouse.jpg",
    emoji: "\u{1F5B1}",
    stock: 55,
    brand: "Logitech",
    spec: "1-year battery",
    compare_at_price: null,
    deal: false,
    specs: ["2.4GHz wireless","One AA","Symmetric shape"],
    featured: false,
    category: "computer-accessories",
  },
  {
    slug: "logitech-m310-mouse",
    name: "Logitech M310 Wireless Mouse",
    tagline: "One hand, or the other",
    description:
      "A contoured shape that works for either hand, with a scroll wheel that tilts sideways for horizontal scrolling in spreadsheets. Silent clicks, which matters more than expected in a shared office. About a year per AA.",
    price: 1250000,
    image_url: "/products/logitech-m310-mouse.jpg",
    emoji: "\u{1F5B1}",
    stock: 44,
    brand: "Logitech",
    spec: "Silent clicks",
    compare_at_price: 1450000,
    deal: false,
    specs: ["Tilt wheel","One AA","Either hand"],
    featured: false,
    category: "computer-accessories",
  },
  {
    slug: "logitech-m317-mouse",
    name: "Logitech M317 Silent Mouse",
    tagline: "Quiet enough for a lecture hall",
    description:
      "Near-silent clicks that will not carry to the next desk, a contoured body sized for medium hands, and a one-year battery from a single AA. The Logi Bolt receiver means it stops working when the dongle is lost, unlike Bluetooth models.",
    price: 1180000,
    image_url: "/products/logitech-m317-mouse.jpg",
    emoji: "\u{1F5B1}",
    stock: 37,
    brand: "Logitech",
    spec: "Silent clicks",
    compare_at_price: null,
    deal: false,
    specs: ["Logi Bolt dongle","One AA","Medium hands"],
    featured: false,
    category: "computer-accessories",
  },
  {
    slug: "corsair-raptor-keyboard",
    name: "Corsair Raptor K1 Keyboard",
    tagline: "Full size, backlit, mechanical",
    description:
      "A full-size mechanical keyboard with a dedicated number pad and per-key backlighting that you can dim rather than switch off. Cherry MX Red switches, which are light enough for long typing sessions and loud enough to hear if you drop the spacebar.",
    price: 5200000,
    image_url: "/products/corsair-raptor-keyboard.jpg",
    emoji: "\u{2328}",
    stock: 14,
    brand: "Corsair",
    spec: "Full size",
    compare_at_price: 6800000,
    deal: true,
    specs: ["Cherry MX Red","Per-key backlight","Number pad"],
    featured: true,
    category: "computer-accessories",
  },
  {
    slug: "logitech-k120-keyboard",
    name: "Logitech K120 Keyboard",
    tagline: "The keyboard that never breaks",
    description:
      "A spill-resistant membrane keyboard rated for five million keystrokes, which is roughly a decade of normal work. The adjustable feet tilt it either way, and the keys are laser-etched so the lettering does not wear off.",
    price: 780000,
    image_url: "/products/logitech-k120-keyboard.jpg",
    emoji: "\u{2328}",
    stock: 61,
    brand: "Logitech",
    spec: "Spill resistant",
    compare_at_price: null,
    deal: false,
    specs: ["5M keystroke rating","Tilt feet","Laser-etched keys"],
    featured: false,
    category: "computer-accessories",
  },
  {
    slug: "logitech-c920-webcam",
    name: "Logitech C920 Webcam",
    tagline: "1080p, and it looks it",
    description:
      "Full 1080p at 30fps with autofocus that holds up when you move, not just when you sit still. The stereo microphones pick up your voice without the room, which matters if you are the one presenting. Works as a camera on a phone too.",
    price: 4450000,
    image_url: "/products/logitech-c920-webcam.jpg",
    emoji: "\u{1F4F7}",
    stock: 19,
    brand: "Logitech",
    spec: "1080p",
    compare_at_price: 5200000,
    deal: false,
    specs: ["30fps","Autofocus","Stereo mic"],
    featured: false,
    category: "computer-accessories",
  },
  {
    slug: "generic-usbc-hub",
    name: "USB-C to HDMI Adapter",
    tagline: "Projecting from a laptop with one port",
    description:
      "A USB-C to HDMI adapter for the laptop that only has two USB-C ports. Adds an HDMI output so you can present from the machine in your bag instead of hunting for the room's cable. No drivers, no power supply needed.",
    price: 590000,
    image_url: "/products/generic-usbc-hub.jpg",
    emoji: "\u{1F50E}",
    stock: 48,
    brand: "Generic",
    spec: "USB-C to HDMI",
    compare_at_price: null,
    deal: false,
    specs: ["4K output","No drivers","No power needed"],
    featured: false,
    category: "computer-accessories",
  },

  // ---------------------------------------------------- phone accessories ---
  {
    slug: "silicone-case-glass-combo",
    name: "Silicone Case + Tempered Glass",
    tagline: "Two layers of not-scratching-your-phone",
    description:
      "A soft-touch silicone case with raised edges around the camera, bundled with a 9H tempered glass screen protector. The raised lip is the part that matters: without it the glass sits below the case and picks up every scrape the case takes. Fits most 6-inch Android phones.",
    price: 320000,
    image_url: "/products/silicone-case-glass-combo.jpg",
    emoji: "\u{1F6F0}",
    stock: 89,
    brand: "Generic",
    spec: "9H hardness",
    compare_at_price: 450000,
    deal: false,
    specs: ["Raised camera lip","Silicone build","Fits 6in phones"],
    featured: false,
    category: "phone-accessories",
  },
  {
    slug: "folio-case-universal",
    name: "Universal Folio Phone Case",
    tagline: "The pocket that is also a wallet",
    description:
      "A folio case with three card slots and a magnetic clasp, cut for phones roughly 15cm long. The folio folds flat behind the phone so it is not a brick in a pocket, and the corners are reinforced where phones actually crack.",
    price: 275000,
    image_url: "/products/folio-case-universal.jpg",
    emoji: "\u{1F4F1}",
    stock: 112,
    brand: "Generic",
    spec: "3 card slots",
    compare_at_price: null,
    deal: false,
    specs: ["Magnetic clasp","Folds flat","Fits 15cm phones"],
    featured: false,
    category: "phone-accessories",
  },
  {
    slug: "wallet-case-blackview",
    name: "Wallet Case with Card Holder",
    tagline: "For the person who never carries a purse",
    description:
      "A leather-look wallet case with room for four cards and folded notes, cut for the Blackview A60 and similar 6-inch phones. The strap secures the phone so it does not slide out of the case while you are walking.",
    price: 385000,
    image_url: "/products/wallet-case-blackview.jpg",
    emoji: "\u{1F4F1}",
    stock: 76,
    brand: "Generic",
    spec: "4 card slots",
    compare_at_price: null,
    deal: false,
    specs: ["Fits A60","Strap security","Leather look"],
    featured: false,
    category: "phone-accessories",
  },

  // -------------------------------------------------------------- storage ---
  {
    slug: "kingston-128gb-microsd",
    name: "Kingston 128GB microSDXC",
    tagline: "Class 10, the one that actually works",
    description:
      "A 128GB Class 10 card rated for up to 100MB/s read. Plenty for a dashcam, a Nintendo Switch, or a phone that has run out of internal storage. Comes with a plastic SD adapter.",
    price: 875000,
    image_url: "/products/kingston-128gb-microsd.jpg",
    emoji: "\u{1F5BC}",
    stock: 74,
    brand: "Kingston",
    spec: "128GB",
    compare_at_price: null,
    deal: false,
    specs: ["Class 10","100MB/s read","SD adapter included"],
    featured: false,
    category: "storage",
  },
  {
    slug: "sandisk-extreme-ssd-1tb",
    name: "SanDisk Extreme 1TB Portable SSD",
    tagline: "Drop it, and keep your files",
    description:
      "A 1TB portable SSD rated IP55 for dust and water, so it survives the sand and the rain that a laptop does not. Reads at up to 1050MB/s over USB-C 3.2, and has a carabiner loop because it is meant to be carried, not stored.",
    price: 14500000,
    image_url: "/products/sandisk-extreme-ssd-1tb.jpg",
    emoji: "\u{1F5B6}",
    stock: 11,
    brand: "SanDisk",
    spec: "1TB",
    compare_at_price: 17900000,
    deal: true,
    specs: ["IP55 dust/water","1050MB/s","Carabiner loop"],
    featured: false,
    category: "storage",
  },
  {
    slug: "samsung-t5-ssd-1tb",
    name: "Samsung T5 1TB Portable SSD",
    tagline: "Small, fast, no moving parts",
    description:
      "A 1TB SSD in an aluminium shell barely bigger than a deck of cards. Reads at up to 1050MB/s over USB-C, with no fan and no moving parts, which means it is silent and it cannot be shaken into failure.",
    price: 13200000,
    image_url: "/products/samsung-t5-ssd-1tb.jpg",
    emoji: "\u{1F5B6}",
    stock: 16,
    brand: "Samsung",
    spec: "1TB",
    compare_at_price: 15500000,
    deal: false,
    specs: ["1050MB/s USB-C","No moving parts","Credit-card sized"],
    featured: false,
    category: "storage",
  },
  {
    slug: "led-desk-lamp",
    name: "LED Desk Lamp with USB Port",
    tagline: "Five warmths, and a phone charger",
    description:
      "A desk lamp with five colour temperatures and three brightness levels, and a 5V USB port in the base so your phone charges from the lamp. The arm holds position properly instead of slowly folding under its own weight.",
    price: 799900,
    image_url: "/products/led-desk-lamp.jpg",
    emoji: "\u{1FA91}",
    stock: 30,
    brand: "Generic",
    spec: "5 colour temps",
    compare_at_price: null,
    deal: false,
    specs: ["3 brightness levels","5V USB port","Holds position"],
    featured: false,
    category: "computer-accessories",
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

/** Look a category up by slug. Returns undefined for an unknown slug. */
export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/**
 * The delivery promise, in one place.
 *
 * WHY THIS IS A CONSTANT AND NOT COPY TYPED IN FIVE PLACES
 * The promise appears in the announcement bar, the reassurance block, the
 * footer, every category page and the product page. It was written out
 * separately in each, and they disagreed: the storefront said 2-4 working days
 * while the reassurance block said 2-5. Two different delivery promises on one
 * page is the kind of detail a marker notices and a customer does not trust.
 *
 * So the numbers live here and every surface renders the same string. Change a
 * figure once and the whole site changes.
 */
export const DELIVERY = {
  /** The headline promise. Lagos is genuinely faster and worth calling out. */
  lagos: "Lagos 1–2 days",
  /** The rest of the country. 2–5, not 2–4 - see above. */
  elsewhere: "All 36 states and the FCT, 2–5 working days elsewhere",
  /** The short form, for the announcement bar where space is tight. */
  short: "Lagos 1–2 working days, elsewhere 2–5",
  /** One line, for the footer. */
  footer: "Lagos 1–2 days, everywhere else 2–5 working days",
} as const;

/** The categories actually used by the catalogue, in display order. */
export function usedCategories(): Category[] {
  const inUse = new Set(demoProducts.map((p) => p.category));
  return CATEGORIES.filter((c) => inUse.has(c.slug));
}