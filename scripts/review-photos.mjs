/**
 * Print every product with its photo path, one per line, as a review sheet.
 *
 * The point is that a photo is only verified once someone has looked at it.
 * Reading this list, opening each file, and checking the image shows the
 * product is the check - a script cannot do it, because deciding whether a
 * photograph of a black slab is a power bank or a wall charger needs a human.
 *
 * Run:  node scripts/review-photos.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { demoProducts } = await import(
  pathToFileURL(join(root, "src", "lib", "catalog.ts")).href
);

const width = Math.max(...demoProducts.map((p) => p.name.length));

console.log("\n  product".padEnd(width + 2) + "photo");
console.log(`  ${"-".repeat(width + 2)}${"-".repeat(34)}`);

for (const product of demoProducts) {
  const image = product.image_url ?? "(none - emoji fallback)";
  const exists = product.image_url
    ? (() => {
        try {
          readFileSync(join(root, "public", product.image_url.replace(/^\//, "")));
          return "";
        } catch {
          return "  <<< MISSING FILE";
        }
      })()
    : "";
  console.log(`  ${product.name.padEnd(width)}  ${image}${exists}`);
}

console.log(`\n${demoProducts.length} products. Open each photo and confirm it shows that product.\n`);