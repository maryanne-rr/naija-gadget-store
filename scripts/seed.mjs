/**
 * `npm run seed` - loads the demo products into Supabase.
 *
 * Why this exists instead of just telling people to paste seed.sql:
 *
 *  1. It reads from src/lib/catalog.ts, the same file the app falls back to
 *     when the database is empty. So the database and the demo catalogue
 *     cannot drift apart - one source, not two copies to keep in sync.
 *
 *  2. The service_role key can write through PostgREST, so seeding needs no
 *     SQL editor and no psql install. Works the same on Windows, Mac or CI.
 *
 *  3. It is idempotent. Running it twice updates the same ten rows rather than
 *     duplicating them, so it doubles as "reset the demo data".
 *
 * Use seed.sql instead if you would rather see SQL - the two write identical
 * data.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const dim = (s) => `\u001b[2m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const red = (s) => `\u001b[31m${s}\u001b[0m`;

// ---------------------------------------------------------------------------
// Read .env.local
// ---------------------------------------------------------------------------
// Deliberately hand-rolled: the project has no dotenv dependency, and this file
// only ever needs two keys.

function loadEnvFile() {
  const values = {};
  let contents = "";
  try {
    contents = readFileSync(join(projectRoot, ".env.local"), "utf8");
  } catch {
    console.error(red(".env.local not found."));
    console.error(dim("Run `npm run setup` to create it, then add your Supabase keys."));
    process.exit(1);
  }

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    // Strip a single layer of matching quotes, so MAIL_FROM="a <b@c>" works.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }
  return values;
}

const env = loadEnvFile();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(red("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"));
  console.error(dim("Run `npm run setup` and paste them in."));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load the catalogue (TypeScript, read natively by Node 24)
// ---------------------------------------------------------------------------

// Node reads the TypeScript directly (type stripping). The path has to be a
// file:// URL - a bare Windows absolute path like C:\... is rejected by the
// ESM loader.
const { demoProducts } = await import(
  pathToFileURL(join(projectRoot, "src", "lib", "catalog.ts")).href
);

// Only send the columns the products table has. `id` is deliberately excluded:
// letting Postgres assign it means re-running this updates the existing row via
// the slug upsert instead of trying to insert a duplicate primary key.
const rows = demoProducts.map((product) => ({
  slug: product.slug,
  name: product.name,
  tagline: product.tagline,
  description: product.description,
  price: product.price,
  currency: product.currency,
  image_url: product.image_url,
  emoji: product.emoji,
  stock: product.stock,
  featured: product.featured,
}));

console.log(`\nSeeding ${rows.length} products into ${dim(SUPABASE_URL)}\n`);

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

const response = await fetch(`${SUPABASE_URL}/rest/v1/products?on_conflict=slug`, {
  method: "POST",
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    // Turn the INSERT into an upsert keyed on the unique slug column.
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify(rows),
});

const text = await response.text();

if (!response.ok) {
  console.error(red(`Seed failed: HTTP ${response.status}`));
  console.error(text);
  console.error(
    dim(
      "\nIf this says 'permission denied for table products', run the grants in\n" +
        "supabase/schema.sql from the Supabase SQL editor.",
    ),
  );
  process.exit(1);
}

const inserted = JSON.parse(text);

// ---------------------------------------------------------------------------
// Verify by reading back - never trust a write by assuming it worked
// ---------------------------------------------------------------------------

const check = await fetch(`${SUPABASE_URL}/rest/v1/products?select=slug,name,price,stock&order=slug`, {
  headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
});
const after = await check.json();

console.log(`${green("OK")}  ${inserted.length} product(s) written, ${after.length} now in the table\n`);

for (const product of after) {
  const naira = (product.price / 100).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  console.log(`  ${String(product.stock).padStart(3)} in stock   \u20a6${naira.padStart(11)}   ${product.name}`);
}

console.log(dim("\nNow run `npm run dev` and open http://localhost:3000\n"));
