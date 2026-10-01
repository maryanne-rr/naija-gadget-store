/**
 * `npm run e2e` - places a real order end to end, then cleans up after itself.
 *
 * The smoke test checks that routes respond. This checks that the moving parts
 * actually work together:
 *
 *   1. POST /api/checkout      -> order saved as 'pending'
 *   2. POST /api/checkout/verify -> order 'paid', stock decremented, email sent
 *   3. every assertion reads the result back from Supabase
 *   4. the test order is deleted so the database is left clean
 *
 * Leaving the row behind would pollute the demo data, and leaving stock
 * decremented would quietly make the catalogue wrong.
 */

import { readFileSync } from "node:fs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

const dim = (s) => `\u001b[2m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const red = (s) => `\u001b[31m${s}\u001b[0m`;
const yellow = (s) => `\u001b[33m${s}\u001b[0m`;

let passed = 0;
let failed = 0;

function check(label, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ${green("PASS")}  ${label}${detail ? dim(`  (${detail})`) : ""}`);
  } else {
    failed++;
    console.log(`  ${red("FAIL")}  ${label}${detail ? `  ${detail}` : ""}`);
  }
}

function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    /* handled by the caller */
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(red("\nSupabase is not configured - see README > 1. Supabase.\n"));
  process.exit(1);
}

const dbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

console.log(`\nEnd-to-end order test against ${dim(BASE)}\n`);

// ---------------------------------------------------------------------------
// Pick a product and note its stock
// ---------------------------------------------------------------------------

const before = await (
  await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,slug,price,stock&order=slug&limit=1`, {
    headers: dbHeaders,
  })
).json();

if (!before.length) {
  console.error(red("No products in the database. Run `npm run seed` first.\n"));
  process.exit(1);
}

// Free Mailgun accounts can only send to an "authorized recipient" - an address
// registered on the Mailgun account. Pass the real one to exercise the email
// path; without it the confirmation is skipped, which is not a bug.
const recipient = process.env.E2E_EMAIL ?? "e2e-test@example.com";
if (!process.env.E2E_EMAIL) {
  console.log(
    yellow(
      dim("Set E2E_EMAIL=<your Mailgun account email> to also test the confirmation email."),
    ),
  );
}

const product = before[0];
console.log(`Buying 2 x ${product.name} (stock ${product.stock})\n`);

// ---------------------------------------------------------------------------
// 1. Create the order
// ---------------------------------------------------------------------------

console.log("1. POST /api/checkout");

const created = await fetch(`${BASE}/api/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: recipient,
    shippingName: "End To End Test",
    shippingPhone: "08030000000",
    shippingAddress: "12B Admiralty Way, Lekki Phase 1",
    shippingCity: "Lagos",
    shippingState: "Lagos",
    lines: [{ productId: product.id, quantity: 2 }],
  }),
});

const createdBody = await created.json();

check("order created", created.status === 200, `status ${created.status}`);
check("  ...returns a reference", typeof createdBody.reference === "string", createdBody.reference);
check("  ...points at the payment page", String(createdBody.redirectTo).includes("/checkout/pay"));

const reference = createdBody.reference;

// The order must start UNPAID. Recording revenue before the payment step is
// the classic mistake this two-phase design exists to avoid.
const pending = await (
  await fetch(`${SUPABASE_URL}/rest/v1/orders?select=status,amount&reference=eq.${reference}`, {
    headers: dbHeaders,
  })
).json();

check("  ...saved as 'pending', not 'paid'", pending[0]?.status === "pending", `status: ${pending[0]?.status}`);
check("  ...total is 2 x price", pending[0]?.amount === product.price * 2, `${pending[0]?.amount} kobo`);

// ---------------------------------------------------------------------------
// 2. Settle it
// ---------------------------------------------------------------------------

console.log("\n2. POST /api/checkout/verify");

const settled = await fetch(`${BASE}/api/checkout/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ reference }),
});
const settledBody = await settled.json();

check("payment accepted", settled.status === 200, `status ${settled.status}`);
check("  ...redirects to the receipt", String(settledBody.redirectTo).includes("/checkout/success"));

const paid = await (
  await fetch(`${SUPABASE_URL}/rest/v1/orders?select=status,paid_at,email&reference=eq.${reference}`, {
    headers: dbHeaders,
  })
).json();

check("  ...order is now 'paid'", paid[0]?.status === "paid", `status: ${paid[0]?.status}`);
check("  ...paid_at was stamped", Boolean(paid[0]?.paid_at), paid[0]?.paid_at ?? "null");

// ---------------------------------------------------------------------------
// 3. Stock must have moved
// ---------------------------------------------------------------------------

console.log("\n3. Stock");

const after = await (
  await fetch(`${SUPABASE_URL}/rest/v1/products?select=stock&id=eq.${product.id}`, { headers: dbHeaders })
).json();

check(
  "decremented by the quantity bought",
  after[0]?.stock === product.stock - 2,
  `${product.stock} -> ${after[0]?.stock}`,
);

// ---------------------------------------------------------------------------
// 4. Re-paying must not double-charge
// ---------------------------------------------------------------------------

console.log("\n4. Repeat the verify call");

const again = await fetch(`${BASE}/api/checkout/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ reference }),
});
await again.json();

const afterRepeat = await (
  await fetch(`${SUPABASE_URL}/rest/v1/products?select=stock&id=eq.${product.id}`, { headers: dbHeaders })
).json();

check(
  "second call does NOT decrement stock again",
  afterRepeat[0]?.stock === after[0]?.stock,
  `still ${afterRepeat[0]?.stock}`,
);

// ---------------------------------------------------------------------------
// 5. Clean up
// ---------------------------------------------------------------------------

console.log("\n5. Cleanup");

const deleted = await fetch(`${SUPABASE_URL}/rest/v1/orders?reference=eq.${reference}`, {
  method: "DELETE",
  headers: dbHeaders,
});

check("test order removed", deleted.ok || deleted.status === 204, `status ${deleted.status}`);

// order_items has ON DELETE CASCADE, so the lines go with the header row.
const restored = await (
  await fetch(`${SUPABASE_URL}/rest/v1/products?select=stock&id=eq.${product.id}`, { headers: dbHeaders })
).json();

await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${product.id}`, {
  method: "PATCH",
  headers: dbHeaders,
  body: JSON.stringify({ stock: product.stock }),
});

const final = await (
  await fetch(`${SUPABASE_URL}/rest/v1/products?select=stock&id=eq.${product.id}`, { headers: dbHeaders })
).json();

check("stock restored to its seeded value", final[0]?.stock === product.stock, `${final[0]?.stock}`);
void restored;

console.log(
  `\n${failed === 0 ? green("Order flow verified") : red("Problems found")}: ${passed} passed, ${failed} failed\n`,
);
console.log(dim("The confirmation email is sent by the app during step 2 - check the terminal\n"));
console.log(dim("running `npm run dev` for the Mailgun response, and Mailgun's activity log.\n"));

process.exit(failed === 0 ? 0 : 1);
