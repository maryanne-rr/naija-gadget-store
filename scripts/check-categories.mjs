/**
 * Guard against a product pointing at a category that does not exist.
 *
 * WHY THIS IS NEEDED
 * The category is a plain slug column on the products row, not a foreign key
 * into a categories table - see supabase/002-categories.sql for why. The usual
 * argument against that is that nothing stops a product naming a category that
 * was renamed or deleted, and the category page then renders empty with no
 * error anywhere. A foreign key would prevent that at the database.
 *
 * This check is the substitute: it reads the catalogue and fails if any product
 * references a missing category. Run it in CI or before a deploy, and a typo
 * becomes a failing command rather than an empty page nobody notices until a
 * marker clicks the link.
 *
 * Run with:  npm run check:categories
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const red = (s) => `\u001b[31m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;

// Load .env.local by hand rather than adding a dotenv dependency for two keys.
const env = {};
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
} catch {
  // No .env.local: check the catalogue only.
}

const { demoProducts, CATEGORIES } = await import(
  pathToFileURL(join(root, "src", "lib", "catalog.ts")).href
);

const problems = [];

console.log(`\nChecking ${demoProducts.length} products against ${CATEGORIES.length} categories\n`);

// ---------------------------------------------------------------------------
// 1. Every product's category exists.
// ---------------------------------------------------------------------------
const known = new Set(CATEGORIES.map((c) => c.slug));

for (const product of demoProducts) {
  if (product.category === null) {
    problems.push(`${product.slug} has no category (null)`);
  } else if (!known.has(product.category)) {
    problems.push(`${product.slug} names unknown category "${product.category}"`);
  }
}

// ---------------------------------------------------------------------------
// 2. No category slug is defined twice. A duplicate would make the first match
//    win in getCategory() and quietly shadow the second.
// ---------------------------------------------------------------------------
const seen = new Set();
for (const category of CATEGORIES) {
  if (seen.has(category.slug)) problems.push(`duplicate category slug "${category.slug}"`);
  seen.add(category.slug);
}

// ---------------------------------------------------------------------------
// 3. No product slug is defined twice. Postgres would reject the seed with a
//    unique violation, but only after we have already told the user it started.
// ---------------------------------------------------------------------------
const slugs = new Set();
for (const product of demoProducts) {
  if (slugs.has(product.slug)) problems.push(`duplicate product slug "${product.slug}"`);
  slugs.add(product.slug);
}

// ---------------------------------------------------------------------------
// 4. Every category has at least one product, or it is a dead link in the nav.
// ---------------------------------------------------------------------------
const inUse = new Set(demoProducts.map((p) => p.category));
for (const category of CATEGORIES) {
  if (!inUse.has(category.slug)) {
    problems.push(`category "${category.slug}" has no products - the nav will link to an empty page`);
  }
}

// ---------------------------------------------------------------------------
// 5. Every image_url points at a file that exists.
// ---------------------------------------------------------------------------
for (const product of demoProducts) {
  if (!product.image_url) continue;
  const file = join(root, "public", product.image_url.replace(/^\//, ""));
  try {
    readFileSync(file);
  } catch {
    problems.push(`${product.slug} references missing image ${product.image_url}`);
  }
}

// ---------------------------------------------------------------------------
// 5b. The specification fields are filled in.
//
// These three are not decoration: the product card leads with `spec`, so an
// empty one renders a blank line at the top of the tile where the deciding
// number should be, and a card whose number is missing looks broken rather than
// sparse. Checking here means the failure is a command that exits non-zero
// instead of a shop front nobody notices is wrong.
// ---------------------------------------------------------------------------
for (const product of demoProducts) {
  if (!product.brand) problems.push(`${product.slug} has no brand`);
  if (!product.spec) problems.push(`${product.slug} has no spec - the card would lead with a blank line`);
  if (!Array.isArray(product.specs) || product.specs.length === 0) {
    problems.push(`${product.slug} has no secondary specs`);
  }
}

// The spec must be short. It is set at 24px on a card that is about 300px wide;
// anything longer wraps to three lines and pushes the price off the bottom.
for (const product of demoProducts) {
  if (product.spec && product.spec.length > 16) {
    problems.push(
      `${product.slug} spec "${product.spec}" is ${product.spec.length} characters - keep it under 16 so it stays on one line`,
    );
  }
}

// Every category must declare what it is compared by, and that basis is shown on
// the tile. An empty string would render as "compared by" with nothing after it.
for (const category of CATEGORIES) {
  if (!category.comparedBy) problems.push(`category "${category.slug}" has no comparedBy`);
  if (!category.delivery) problems.push(`category "${category.slug}" has no delivery note`);
}

// ---------------------------------------------------------------------------
// 6. Prices are whole Kobo and non-negative. A float here would be a silent
//    rounding bug that only shows up when an order total is off by one kobo.
// ---------------------------------------------------------------------------
for (const product of demoProducts) {
  if (!Number.isInteger(product.price)) {
    problems.push(`${product.slug} price ${product.price} is not an integer number of Kobo`);
  }
  if (product.price < 0) problems.push(`${product.slug} has a negative price`);
}

// ---------------------------------------------------------------------------
// 7. Stock is a non-negative integer.
// ---------------------------------------------------------------------------
for (const product of demoProducts) {
  if (!Number.isInteger(product.stock) || product.stock < 0) {
    problems.push(`${product.slug} has invalid stock ${product.stock}`);
  }
}

// ---------------------------------------------------------------------------
// 8. The live database agrees. The catalogue and the table can drift apart -
//    someone edits catalog.ts and forgets to re-seed - and that is the failure
//    that only shows up on the deployed site.
// ---------------------------------------------------------------------------
if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const res = await fetch(`${url}/rest/v1/products?select=slug,category,spec`, { headers });

  if (!res.ok) {
    // PostgREST reports a missing column as 42703 "column products.x does not
    // exist", which is indistinguishable from a permissions problem unless the
    // message names the column. Say which migration is outstanding rather than
    // sending the reader to the wrong file.
    const body = await res.json().catch(() => null);
    const message = String(body?.message ?? "");

    const missingColumn = message.match(/column products\.(\w+) does not exist/)?.[1];

    if (missingColumn === "category") {
      problems.push(
        `database column 'category' does not exist. Run supabase/002-categories.sql in the Supabase SQL editor, then npm run seed.`,
      );
    } else if (missingColumn) {
      problems.push(
        `database column '${missingColumn}' does not exist. ` +
          (missingColumn === "brand" || missingColumn === "spec" || missingColumn === "specs"
            ? "Run supabase/003-specs.sql in the Supabase SQL editor, then npm run seed."
            : "Check the schema in supabase/schema.sql against the live database."),
      );
    } else if (res.status === 42501) {
      problems.push(
        `permission denied reading products. Run supabase/schema.sql in the Supabase SQL editor to apply the grants.`,
      );
    } else {
      problems.push(`could not read products from the database: HTTP ${res.status} ${message}`);
    }
  } else {
    const rows = await res.json();

    if (rows.length === 0) {
      problems.push("the products table is empty - run `npm run seed`");
    }

    for (const row of rows) {
      if (row.category === undefined) {
        problems.push(
          `database column 'category' does not exist. Run supabase/002-categories.sql in the Supabase SQL editor, then npm run seed.`,
        );
        break;
      }
      if (row.category !== null && !known.has(row.category)) {
        problems.push(`database row "${row.slug}" has unknown category "${row.category}"`);
      }
      if (row.spec === undefined) {
        problems.push(
          `database columns 'brand'/'spec' do not exist. Run supabase/003-specs.sql in the Supabase SQL editor, then npm run seed.`,
        );
        break;
      }
    }

    // Count per category, so the summary is useful rather than just a verdict.
    console.log(dim("  category        in catalogue   in database"));
    for (const category of CATEGORIES) {
      const inCatalogue = demoProducts.filter((p) => p.category === category.slug).length;
      const inDatabase = rows.filter((r) => r.category === category.slug).length;
      const marker = inCatalogue === inDatabase ? "" : "  <- differs";
      console.log(
        `  ${category.slug.padEnd(16)}${String(inCatalogue).padStart(6)}${String(inDatabase).padStart(14)}${marker}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
if (problems.length > 0) {
  console.log(red(`\n${problems.length} problem(s):\n`));
  for (const p of problems) console.log(red(`  - ${p}`));
  console.log("");
  process.exit(1);
}

console.log(green("\nAll good") + ": catalogue and categories agree\n");