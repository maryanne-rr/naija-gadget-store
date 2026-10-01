/**
 * Smoke test - checks that the running app answers sensibly.
 *
 *   npm run dev          (in one terminal)
 *   npm run smoke        (in another)
 *
 * This is not a replacement for real tests. It is a 20-second sanity check that
 * every route responds and that the API rejects bad input instead of crashing,
 * which is exactly what goes wrong while you are wiring things up.
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Find a product id to test checkout against.
//
// Do NOT hardcode one. The in-memory demo catalogue uses predictable UUIDs
// (00000000-0000-4000-8000-000000000006), but once Supabase is connected the
// products in the table have real random ids, and a hardcoded fixture id fails
// with a confusing "item no longer exists".
//
// So: ask the database for a real id when there is one, and fall back to the
// demo id only when Supabase is not configured.

async function findProductId() {
  const DEMO_ID = "00000000-0000-4000-8000-000000000006";

  let env = {};
  try {
    const { readFileSync } = await import("node:fs");
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    return DEMO_ID;
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return DEMO_ID;

  try {
    const response = await fetch(`${url}/rest/v1/products?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!response.ok) return DEMO_ID;

    const rows = await response.json();
    return rows[0]?.id ?? DEMO_ID;
  } catch {
    return DEMO_ID;
  }
}

let passed = 0;
let failed = 0;

const green = (s) => `\u001b[32m${s}\u001b[0m`;
const red = (s) => `\u001b[31m${s}\u001b[0m`;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;

function check(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ${green("PASS")}  ${label}${detail ? dim(`  (${detail})`) : ""}`);
  } else {
    failed++;
    console.log(`  ${red("FAIL")}  ${label}${detail ? `  ${detail}` : ""}`);
  }
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const text = await response.text();
  return { status: response.status, text };
}

async function postJson(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // left as null - handled by the caller
  }
  return { status: response.status, json, text };
}

console.log(`\nSmoke testing ${BASE}\n`);

// ---------------------------------------------------------------------------
console.log("Pages");
const home = await get("/");
check("GET / renders", home.status === 200, `status ${home.status}`);
check(
  "GET / lists products",
  home.text.includes("Naija Gadgets") && home.text.includes("Add to cart"),
  "found the catalogue",
);

const product = await get("/products/jbl-tune-510bt");
check("GET /products/[slug] renders", product.status === 200, `status ${product.status}`);
check("  ...with the right title", product.text.includes("JBL Tune 510BT"));

const missing = await get("/products/definitely-not-a-real-product");
check("GET unknown product 404s", missing.status === 404, `status ${missing.status}`);

const cart = await get("/cart");
check("GET /cart renders", cart.status === 200, `status ${cart.status}`);

const checkout = await get("/checkout");
check("GET /checkout renders", checkout.status === 200, `status ${checkout.status}`);

const pay = await get("/checkout/pay?reference=NAI-SMOKETEST");
check("GET /checkout/pay renders", pay.status === 200, `status ${pay.status}`);

const orders = await get("/orders");
check("GET /orders renders", orders.status === 200, `status ${orders.status}`);

const success = await get("/checkout/success?reference=NAI-SMOKETEST");
check("GET /checkout/success renders", success.status === 200, `status ${success.status}`);
// With a database connected, an unknown reference says so. Without one, the
// page says the database is missing. Both are correct; neither should 500.
check(
  "  ...handles an unknown reference gracefully",
  success.text.includes("Order not found") || success.text.includes("Order details unavailable"),
);

// ---------------------------------------------------------------------------
console.log("\nCheckout API");
const bad = await postJson("/api/checkout", { email: "not-an-email", lines: [] });
check("rejects a malformed email", bad.status === 400, `status ${bad.status}`);
check(
  "  ...with field-level messages",
  Boolean(bad.json?.fieldErrors?.email || bad.json?.error),
  JSON.stringify(bad.json?.fieldErrors?.email ?? bad.json?.error ?? "").slice(0, 70),
);

const negative = await postJson("/api/checkout", {
  email: "you@example.com",
  shippingName: "Ada Lovelace",
  shippingAddress: "12B Admiralty Way, Lekki",
  lines: [{ productId: "00000000-0000-4000-8000-000000000006", quantity: -5 }],
});
check("rejects a negative quantity", negative.status === 400, `status ${negative.status}`);

const badUuid = await postJson("/api/checkout", {
  email: "you@example.com",
  shippingName: "Ada Lovelace",
  shippingAddress: "12B Admiralty Way, Lekki",
  lines: [{ productId: "not-a-uuid", quantity: 1 }],
});
check("rejects a non-uuid product id", badUuid.status === 400, `status ${badUuid.status}`);

const realId = await findProductId();
const good = await postJson("/api/checkout", {
  email: "you@example.com",
  shippingName: "Ada Lovelace",
  shippingAddress: "12B Admiralty Way, Lekki",
  shippingCity: "Lagos",
  shippingState: "Lagos",
  lines: [{ productId: realId, quantity: 1 }],
});
if (good.status === 200) {
  check("accepts a valid order", true, `mode: ${good.json?.mode}`);
} else if (good.status === 400 && String(good.json?.error).includes("database")) {
  check(
    "valid order -> needs Supabase",
    true,
    "set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to enable",
  );
} else {
  check("accepts a valid order", false, `status ${good.status} ${good.text.slice(0, 90)}`);
}

// ---------------------------------------------------------------------------
console.log("\nAuth");
const signin = await get("/api/auth/signin/google");
check(
  "GET /api/auth/signin/google responds",
  signin.status === 200 || signin.status === 302 || signin.status === 503,
  signin.status === 503
    ? "503 with setup instructions (Google not configured)"
    : `status ${signin.status}`,
);

// ---------------------------------------------------------------------------
// A GET on /api/checkout/verify must not settle anything: settling is a POST.
const verifyGet = await get("/api/checkout/verify?reference=NAI-SMOKETEST");
check(
  "GET /api/checkout/verify is rejected",
  verifyGet.status === 405 || verifyGet.status === 404,
  `status ${verifyGet.status}`,
);

const verifyMissing = await postJson("/api/checkout/verify", {});
check(
  "POST verify without a reference is rejected",
  verifyMissing.status === 400,
  `status ${verifyMissing.status}`,
);

// ---------------------------------------------------------------------------
console.log(`\n${failed === 0 ? green("All good") : red("Problems found")}: ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
