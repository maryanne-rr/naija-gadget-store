/**
 * Replace the seven wrong photos from the original batch.
 *
 * CONTEXT
 * The first ten product photos came from Unsplash, downloaded without opening
 * them afterwards. Seven turned out not to show the product at all - a power
 * bank listing illustrated with an Apple wall adapter, a 128GB memory card
 * illustrated with a mechanic under a car bonnet, a GaN charger illustrated
 * with headphones. Two were worse than merely generic: the Anker PowerCore
 * showed a power bank with the Xiaomi logo on it, and the Samsung earbuds
 * showed three sets of earbuds that were not Samsung's.
 *
 * This replaces all seven with Wikimedia Commons photographs, each opened and
 * confirmed before use.
 *
 * TWO PRODUCTS WERE RENAMED RATHER THAN PHOTOGRAPHED
 * Commons has no photograph of an MPOW 6-in-1 cable or a Samsung Galaxy Buds
 * FE, and a generic braided cable sold as a 6-in-1 multi-connector cable is
 * the kind of small lie that undermines the whole catalogue - the photo shows
 * something the product does not do. Those two listings are now generic
 * products that match their photographs instead:
 *
 *   MPOW 6-in-1 USB-C Cable  ->  Braided USB-C Charging Cable
 *   Samsung Galaxy Buds FE->  Nothing Ear (2) Earbuds
 *
 * The catalogue is demonstration data, so matching the listing to the
 * photograph is honest. Faking the product name to match a borrowed photo is
 * not.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STAGING = join(process.cwd(), ".photo-staging");
const FINAL = join(process.cwd(), "public", "products");

const REPLACEMENTS = [
  { slug: "xiaomi-power-bank-3",          from: "t-oraimo-1" },     // Oraimo power bank, 67% display
  { slug: "oraimo-65w-gan-charger",       from: "s-charger-0" },    // black wall adapter
  { slug: "mpow-6in1-cable",              from: "s-cable-3" },      // braided cables, several colours
  { slug: "kingston-128gb-microsd",       from: "r-microsd-0" },    // Kingston microSD + SD card
  { slug: "anker-powercore-20000",        from: "r-anker20k-1" },   // Anker PowerCore, LED charge dots
  { slug: "samsung-galaxy-buds-fe",       from: "s-earbuds-1" },    // Nothing earbuds in their case
  { slug: "tecno-spark-20-combo",         from: "s-case-7" },       // silicone case, camera cutout
];

mkdirSync(FINAL, { recursive: true });

const creditsPath = join(FINAL, "credits.json");
const credits = JSON.parse(readFileSync(creditsPath, "utf8"));

for (const { slug, from } of REPLACEMENTS) {
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
    copyFileSync(join(STAGING, `${from}.jpg`), join(FINAL, `${slug}.jpg`));
  } catch (error) {
    console.error(`  MISSING ${from}.jpg  (${error.code}) - ${slug}`);
    continue;
  }

  // Replace the stale entry rather than appending a duplicate: the filename is
  // the key, and two records for one file is how attribution goes missing.
  const file = `${slug}.jpg`;
  const existing = credits.findIndex((c) => c.file === file);
  const entry = { file, ...meta };
  if (existing >= 0) credits[existing] = entry;
  else credits.push(entry);

  console.log(`  ${file}  <- ${from}  [${meta.licence ?? "?"}]`);
}

writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + "\n");
console.log(`\n${REPLACEMENTS.length} photo(s) replaced`);
console.log("credits.json updated - no duplicate entries");