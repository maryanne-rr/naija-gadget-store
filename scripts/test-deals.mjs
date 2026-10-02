/**
 * Prove the deal rotation is correct without a database.
 *
 * The carousel only renders products that are genuinely reduced, and the
 * database has no compare_at_price column until 004-discounts.sql is applied -
 * so on a fresh clone the banner is empty and there is nothing to look at. This
 * exercises dealsForToday against the in-memory catalogue instead, which is
 * what the app falls back to when Supabase is not configured.
 *
 * What it checks:
 *   - every slide is genuinely cheaper than its was-price
 *   - the rotation spans several categories, so the banner does not make the
 *     shop look like it only sells one kind of thing
 *   - the order is identical for two calls on the same day (server render and
 *     client render must agree)
 *   - the order actually changes from one day to the next
 *
 * Run: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/test-deals.mjs
 */

import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Node reads the TypeScript directly via type stripping, so both modules import
// normally. dealsForToday deliberately lives in lib/deals.ts rather than
// products.ts, because products.ts imports "server-only" and Supabase - neither
// of which can be loaded outside a request, and either of which would make this
// test impossible to run.
const { demoProducts, getCategory } = await import(
  pathToFileURL(join(root, "src", "lib", "catalog.ts")).href
);
const { dealsForToday } = await import(
  pathToFileURL(join(root, "src", "lib", "deals.ts")).href
);

const green = (s) => `\u001b[32m${s}\u001b[0m`;
const red = (s) => `\u001b[31m${s}\u001b[0m`;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;

let failed = 0;
function check(label, ok, detail = "") {
  if (ok) console.log(`  ${green("PASS")}  ${label}${detail ? dim(`  (${detail})`) : ""}`);
  else {
    failed++;
    console.log(`  ${red("FAIL")}  ${label}${detail ? `  ${detail}` : ""}`);
  }
}

const today = new Date("2026-10-02T09:00:00Z");
const tomorrow = new Date("2026-10-03T09:00:00Z");

console.log("\nDeal rotation\n");

// ---------------------------------------------------------------------------
const slides = dealsForToday(demoProducts, today);

check("produces slides", slides.length > 0, `${slides.length} slide(s)`);

// Every slide must be a real discount. This is the assertion that matters most:
// a carousel featuring a "deal" which is not cheaper teaches people to distrust
// the badge, which costs more than the sale ever earned.
const allDiscounted = slides.every(
  (p) => p.compare_at_price !== null && p.compare_at_price > p.price,
);
check("every slide is genuinely cheaper than its was-price", allDiscounted);

const noStock = slides.filter((p) => p.stock <= 0);
check("no slide is sold out", noStock.length === 0, `${noStock.length} sold out`);

// The original complaint: a hero leading with a power bank made the whole shop
// read as a power bank shop. So the rotation must span categories.
const categories = [...new Set(slides.map((p) => p.category))];
check(
  "rotation spans several categories",
  categories.length >= 3,
  categories.map((c) => getCategory(c)?.name ?? c).join(", "),
);

// No category appears twice, so one screen cannot be two batteries.
const dupes = categories.length !== slides.length;
check("no category appears twice", !dupes, dupes ? "a category is repeated" : "");

// Same day, same order. A server render and a client render must agree, and
// Math.random() in the browser would break that.
const again = dealsForToday(demoProducts, today).map((p) => p.slug);
const sameOrder = again.join() === slides.map((p) => p.slug).join();
check("order is stable within the same day", sameOrder);

// Different tomorrow, or it is not a daily deal.
//
// Asserted as two separate checks on purpose. Comparing two joined strings
// proves "the order changed" but would also pass if tomorrow's rotation were
// EMPTY - "" differs from anything, so an empty result would look like a pass
// while the banner simply had nothing in it. That is the shape of a test that
// proves nothing, so the non-empty case is checked on its own.
const nextDay = dealsForToday(demoProducts, tomorrow).map((p) => p.slug);

check("tomorrow's rotation is not empty", nextDay.length > 0, `${nextDay.length} slide(s)`);
check(
  "order changes from one day to the next",
  nextDay.length > 0 && nextDay.join() !== slides.map((p) => p.slug).join(),
  `${slides[0]?.slug} -> ${nextDay[0]}`,
);

// Every eligible product appears over a week, so nothing is stranded.
const week = new Set();
for (let d = 0; d < 7; d++) {
  for (const p of dealsForToday(demoProducts, new Date(today.getTime() + d * 86_400_000))) {
    week.add(p.slug);
  }
}
const eligible = demoProducts.filter(
  (p) => p.deal && p.compare_at_price !== null && p.compare_at_price > p.price && p.stock > 0,
);
check(
  "every eligible product appears within a week",
  week.size === eligible.length,
  `${week.size} of ${eligible.length} shown`,
);

// ---------------------------------------------------------------------------
console.log("\nToday's slides\n");
for (const [i, p] of slides.entries()) {
  const was = (p.compare_at_price / 100).toLocaleString("en-NG");
  const now = (p.price / 100).toLocaleString("en-NG");
  const pct = Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100);
  console.log(
    `  ${i + 1}. ${String(pct).padStart(2)}% off   N${now.padStart(8)}   was N${was.padStart(8)}   ` +
      `${(getCategory(p.category)?.name ?? "?").padEnd(20)} ${p.name}`,
  );
}

console.log(
  failed === 0
    ? `\n${green("All good")}: deal rotation is correct\n`
    : `\n${red(`${failed} problem(s)`)}\n`,
);
process.exit(failed === 0 ? 0 : 1);