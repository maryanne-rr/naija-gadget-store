/**
 * Promote reviewed photo candidates into public/products.
 *
 * The candidates in .photo-staging come from scripts/source-photos.mjs, which
 * searches Wikimedia Commons and downloads whatever looks plausible. Search
 * relevance is only a starting point - "phone case smartphone" returns two men
 * holding circuit boards, "wireless earbuds" returns a trade-show booth. So every
 * candidate below was opened and looked at, and only the ones that genuinely
 * show the product appear in PICKS.
 *
 * The rejection is the point. Commons photographs real objects, so a search for
 * a phone case finds people repairing phones, and a search for earbuds finds
 * packaging on a table. Passing those off as products would be the kind of thing
 * that looks fine in a demo and falls apart when a marker looks closely.
 *
 * This script copies the chosen files to their final slugs and records the
 * attribution Commons requires.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STAGING = join(process.cwd(), ".photo-staging");
const FINAL = join(process.cwd(), "public", "products");

/**
 * Every `from` was opened and confirmed to show the stated object.
 * Slugs are the product slugs they will be used for.
 */
const PICKS = [
  // Audio
  { slug: "bose-qc25", from: "audio-overear-0" },   // over-ear headphones + case
  { slug: "yamaha-tw-e3a-earbuds", from: "audio-earbuds-6" }, // earbuds in open case
  { slug: "jbl-flip-4", from: "audio-speaker-2" },  // JBL cylinder speaker

  // Power
  { slug: "anker-powerbank-10000", from: "power-bank-a-0" }, // Anker bank + cable
  { slug: "romoss-20000-powerbank", from: "power-bank-b-1" }, // Romoss bank charging phone
  { slug: "anker-powercore-5000", from: "power-bank-a-2" }, // Anker PowerCore

  // Chargers
  { slug: "lazos-gan-30w", from: "charger-gan-0" }, // GaN wall charger
  { slug: "anker-powerport-40w", from: "charger-multi-0" }, // multi-port wall charger
  { slug: "anker-m80-cable", from: "cable-usbc-0" }, // USB-C cable

  // Computer accessories
  { slug: "logitech-m310-mouse", from: "mouse-wireless-1" }, // Logitech wireless mouse
  { slug: "logitech-m317-mouse", from: "mouse-wireless-6" }, // Logitech M317
  { slug: "corsair-raptor-keyboard", from: "keyboard-mech-0" }, // full-size mechanical
  { slug: "logitech-k120-keyboard", from: "keyboard-compact-2" }, // backlit compact
  { slug: "logitech-c920-webcam", from: "webcam-3" }, // webcam on monitor
  { slug: "generic-usbc-hub", from: "hub-usbc-0" }, // USB-C AV adapter

  // Phone accessories
  { slug: "folio-case-universal", from: "phone-case-1" }, // folio case, open
  { slug: "wallet-case-blackview", from: "phone-case-2" }, // wallet case on phone

  // Storage
  { slug: "sandisk-extreme-ssd-1tb", from: "storage-ssd-0" }, // rugged SSD
  { slug: "samsung-t5-ssd-1tb", from: "storage-ssd-1" }, // Samsung T5
];

mkdirSync(FINAL, { recursive: true });

const credits = [];

for (const { slug, from } of PICKS) {
  const source = join(STAGING, `${from}.jpg`);
  const target = join(FINAL, `${slug}.jpg`);

  let meta = {};
  try {
    meta = Object.fromEntries(
      readFileSync(join(STAGING, `${from}.txt`), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const i = line.indexOf(":");
          return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
        }),
    );
  } catch {
    meta = { title: "unknown", author: "unknown", licence: "unknown" };
  }

  try {
    copyFileSync(source, target);
  } catch (error) {
    console.error(`  MISSING ${from}.jpg  (${error.code}) - ${slug}`);
    continue;
  }

  credits.push({ file: `${slug}.jpg`, ...meta });
  console.log(`  ${slug}.jpg  <- ${from}  [${meta.licence ?? "?"}]`);
}

writeFileSync(join(FINAL, "credits.json"), JSON.stringify(credits, null, 2) + "\n");

console.log(`\n${credits.length} photo(s) promoted, ${PICKS.length - credits.length} missing`);
console.log("attribution written to public/products/credits.json");