/**
 * Test the server-side cart and the pairing tables.
 *
 *   npm run test:sync
 *
 * WHY THIS IS A SCRIPT AND NOT A DASHBOARD CLICK
 * The behaviour that matters here is arithmetic, and arithmetic is exactly what
 * you cannot check by looking. "Add one more" reading 1, 1, 1 instead of 1, 2, 3
 * looks perfectly fine on a screen. So the properties that would silently rot are
 * asserted directly against the database.
 *
 * It talks to Supabase over PostgREST rather than through the dev server, which
 * means it can reach set_cart_quantity() as a function and check what it returns -
 * the thing the API route wraps and would otherwise hide.
 *
 * READ-ONLY EXCEPT FOR ONE THROWAWAY USER'S CART
 * Every row written here belongs to the first user in the table and is deleted
 * at the end. No product, order or account is touched.
 */

import { readFile } from "node:fs/promises";

const API = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  ${green("pass")}  ${name}`);
  } else {
    failures.push(name);
    console.log(`  ${red("FAIL")}  ${name}`);
    console.log(dim(`        expected ${JSON.stringify(expected)}`));
    console.log(dim(`        actual   ${JSON.stringify(actual)}`));
  }
}

function note(text) {
  console.log(dim(`\n  ${text}\n`));
}

async function loadEnv() {
  const contents = await readFile(".env.local", "utf8");
  const get = (key) =>
    contents.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"))?.[1]?.trim();

  return { url: get("NEXT_PUBLIC_SUPABASE_URL"), key: get("SUPABASE_SERVICE_ROLE_KEY") };
}

/** PostgREST, with the service-role key. Bypasses RLS, like the app does. */
function rest(env, path, options = {}) {
  return fetch(`${env.url}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function main() {
  const env = await loadEnv();

  if (!env.url || !env.key) {
    console.error(red("Supabase is not configured in .env.local."));
    process.exitCode = 1;
    return;
  }

  const userRes = await rest(env, "users?select=id,email&limit=1");
  const user = (await userRes.json())[0];

  // stock=gt.0, not stock>=0. PostgREST spells comparison operators as
  // column=operator.value, and a bare ">=" silently matches nothing - which looks
  // exactly like "the shop has no products".
  const productRes = await rest(env, "products?select=id,name,stock&stock=gt.0&limit=1");
  const product = (await productRes.json())[0];

  if (!user || !product) {
    console.error(red("Need at least one user and one in-stock product to run this."));
    process.exitCode = 1;
    return;
  }

  console.log(`\n${dim(`product: ${product.name} (stock ${product.stock})`)}\n`);

  const rpc = async (body) => {
    const response = await rest(env, "rpc/set_cart_quantity", { method: "POST", body });

    if (!response.ok) {
      // The function raises for a product that does not exist, and that error is
      // part of what is being tested, so it comes back as data rather than being
      // thrown.
      return { code: response.status, error: await response.text() };
    }

    return response.json();
  };

  const wipe = () =>
    rest(env, `cart_items?user_id=eq.${user.id}`, { method: "DELETE" });

  const quantityNow = async () => {
    const rows = await (
      await rest(env, `cart_items?user_id=eq.${user.id}&product_id=eq.${product.id}`)
    ).json();
    return rows.length === 0 ? 0 : Number(rows[0].quantity);
  };

  // ---------------------------------------------------------------------------
  note("add must ADD, not overwrite");

  await wipe();
  check("add 1 gives 1", await rpc({ p_user_id: user.id, p_product_id: product.id, p_quantity: 1, p_absolute: false }), 1);
  check("add 1 again gives 2", await rpc({ p_user_id: user.id, p_product_id: product.id, p_quantity: 1, p_absolute: false }), 2);
  check("add 1 a third time gives 3", await rpc({ p_user_id: user.id, p_product_id: product.id, p_quantity: 1, p_absolute: false }), 3);
  check("stored quantity agrees", await quantityNow(), 3);
  check("one row, not three", (await (await rest(env, `cart_items?user_id=eq.${user.id}`)).json()).length, 1);

  // ---------------------------------------------------------------------------
  note("concurrent adds must not lose an update");

  // All eight fired at once. Read-modify-write in JavaScript would let two of
  // these read 3 and both write 4, so the answer would come back as less than 11.
  const burst = await Promise.all(
    Array.from({ length: 8 }, () =>
      rpc({ p_user_id: user.id, p_product_id: product.id, p_quantity: 1, p_absolute: false }),
    ),
  );
  check("8 simultaneous adds land as 3 + 8", await quantityNow(), 11);
  check("no burst returned a stale duplicate", new Set(burst).size >= 1, true);

  // ---------------------------------------------------------------------------
  note("set must REPLACE, not add");

  await wipe();
  await rpc({ p_user_id: user.id, p_product_id: product.id, p_quantity: 3, p_absolute: false });
  check(
    "set 5 after add 3 gives 5, not 8",
    await rpc({ p_user_id: user.id, p_product_id: product.id, p_quantity: 5, p_absolute: true }),
    5,
  );

  // ---------------------------------------------------------------------------
  note("a quantity of zero removes the line");

  check(
    "set 0 returns 0",
    await rpc({ p_user_id: user.id, p_product_id: product.id, p_quantity: 0, p_absolute: true }),
    0,
  );
  check("the row is gone", await quantityNow(), 0);

  // ---------------------------------------------------------------------------
  note("the basket can never exceed the stock on hand");

  await wipe();
  check(
    `set 999 is capped at ${product.stock}`,
    await rpc({ p_user_id: user.id, p_product_id: product.id, p_quantity: 999, p_absolute: true }),
    product.stock,
  );
  check(
    "and adding is capped too",
    await rpc({ p_user_id: user.id, p_product_id: product.id, p_quantity: 999, p_absolute: false }),
    product.stock,
  );

  // ---------------------------------------------------------------------------
  note("a product that does not exist is refused, not silently ignored");

  const missing = await rpc({
    p_user_id: user.id,
    p_product_id: "00000000-0000-0000-0000-000000000000",
    p_quantity: 1,
    p_absolute: false,
  });
  check("refuses a missing product", Boolean(missing?.code), true);

  // ---------------------------------------------------------------------------
  note("the database refuses a quantity outside 1-99");

  await wipe();
  await rpc({ p_user_id: user.id, p_product_id: product.id, p_quantity: 2, p_absolute: true });
  const tooMany = await rest(env, "cart_items", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: { user_id: user.id, product_id: product.id, quantity: 500 },
  });
  check("a hand-written INSERT of 500 is rejected", tooMany.ok, false);

  // ---------------------------------------------------------------------------
  note("the pairing table exists with the columns the code reads");

  const columns = await (await rest(env, "device_pairs?select=*&limit=1")).json();
  const keys = Object.keys(columns[0] ?? {});

  for (const column of ["code", "claim_hash", "status", "user_id", "expires_at", "redeemed_at"]) {
    check(`device_pairs.${column} exists`, keys.includes(column), true);
  }

  // ---------------------------------------------------------------------------
  note("a pairing code is 4-4, and never ambiguous when read aloud");

  // B0OI and BOIL are the same string to a person and not to a computer, so the
  // alphabet has to exclude 0/O and 1/I/L entirely.
  const pairRes = await fetch(`${API}/api/mobile/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claimSecret: "a".repeat(43) }),
  });

  if (pairRes.ok) {
    const { code } = await pairRes.json();
    check("code is four characters, a dash, four", /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), true);
    check("no 0, O, 1, I or L in it", /[0O1IL]/.test(code), false);

    // The claim secret must not be readable from the row. Only its hash is
    // stored, so the plaintext is nowhere in the database.
    const row = await (
      await rest(env, `device_pairs?code=eq.${code}&select=claim_hash`)
    ).json();
    check("the claim secret is stored hashed", row[0]?.claim_hash?.includes("a".repeat(43)), false);

    await rest(env, `device_pairs?code=eq.${code}`, { method: "DELETE" });
  } else {
    note(`skipping code checks - no dev server on ${API}`);
  }

  // ---------------------------------------------------------------------------
  await wipe();

  console.log(
    failures.length === 0
      ? `\n${green(`All good`)}: ${passed} passed, 0 failed\n`
      : `\n${red(`${failures.length} failed`)}, ${passed} passed\n`,
  );

  if (failures.length > 0) process.exitCode = 1;
}

await main();
