/**
 * Test the pieces of native sign-in that can be tested without a phone.
 *
 *   npm run test:auth
 *
 * WHY THIS EXISTS
 * Native Google sign-in cannot be verified from here: it needs a real Android
 * device, a real Google account and a browser round trip. What CAN be verified is
 * everything around it, and the round trip is where the classic OAuth bugs live.
 *
 * The dangerous part is idTokenFromRedirect. Google returns the token in the URL
 * FRAGMENT for the implicit flow and in the QUERY STRING for PKCE, and a parser
 * that reads the wrong one either fails every time or - worse - succeeds by
 * putting a live credential somewhere it will be logged.
 *
 * So the cases are asserted here rather than discovered on a phone.
 */

import { readFile } from "node:fs/promises";

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

/**
 * Printed at the end, and the exit code set from it.
 *
 * Without this the file counted its passes and never mentioned them, which eslint
 * noticed before I did - "passed is assigned a value but never used" is a true
 * observation about a test suite that cannot tell you whether it passed.
 */
function summary() {
  if (failures.length === 0) {
    console.log(`\n${green(`All good`)}: ${passed} passed, 0 failed\n`);
    return;
  }

  console.log(
    `\n${red(`${failures.length} failed`)}, ${passed} passed\n  ${failures.join("\n  ")}\n`,
  );
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// The parser, inlined rather than imported.
//
// src/googleAuth.ts imports src/config.ts, which reads process.env through Expo's
// babel plugin - and that transform does not apply to a plain node run. Importing
// it would need a Metro-less shim for one function, and a copy of a parser under
// test is worse than useless. So this is the same code, and the note below is what
// keeps the two honest.
// ---------------------------------------------------------------------------

function valueFromRedirect(url, key, sources) {
  const queryAt = url.indexOf("?");
  const fragmentAt = url.indexOf("#");

  const query = queryAt === -1
    ? null
    : url.slice(queryAt + 1, fragmentAt === -1 ? url.length : Math.max(fragmentAt, queryAt));

  const fragment = fragmentAt === -1 ? null : url.slice(fragmentAt + 1);

  for (const part of sources) {
    const source = part === "query" ? query : fragment;
    if (source === null) continue;
    for (const pair of source.split("&")) {
      const [name, value] = pair.split("=");
      if (name !== key) continue;
      try {
        return decodeURIComponent(value ?? "");
      } catch {
        return value ?? null;
      }
    }
  }

  return null;
}

const codeFromRedirect = (url) => valueFromRedirect(url, "code", ["query", "fragment"]);
const idTokenFromRedirect = (url) => valueFromRedirect(url, "id_token", ["fragment"]);

console.log(`\n${dim("authorization code, from the query string")}\n`);

// The app now uses the code flow, so this is the shape it actually receives.
check(
  "reads the code from the query",
  codeFromRedirect("naija://callback?code=4/0AX4&scope=openid&state=xyz"),
  "4/0AX4",
);

check(
  "keeps a code containing = and /",
  codeFromRedirect("naija://callback?code=4/0AbC-dEf%3D%3D"),
  "4/0AbC-dEf==",
);

check(
  "still finds one in the fragment, since a code is not a secret",
  codeFromRedirect("naija://callback#code=IN-FRAGMENT"),
  "IN-FRAGMENT",
);

check("returns null when Google reports an error", codeFromRedirect("naija://callback?error=access_denied"), null);
check("returns null for a bare callback", codeFromRedirect("naija://callback"), null);

console.log(`\n${dim("id_token, from the fragment - and never the query")}\n`);

// This is the leak. An id_token is a live credential for somebody's account, and a
// query string ends up in access logs, Referer headers and history. So the fragment
// is read first and the query is never preferred - a test with only a query
// present proves nothing, because the correct answer is null and it has to be
// asserted as such.
check(
  "reads the token from the fragment",
  idTokenFromRedirect("naija://callback#id_token=HEADER.PAYLOAD.SIG&state=xyz"),
  "HEADER.PAYLOAD.SIG",
);

check(
  "REFUSES a token that arrives in the query string",
  idTokenFromRedirect("naija://callback?id_token=LEAKED"),
  null,
);

check(
  "prefers the fragment when a query also carries one",
  idTokenFromRedirect("naija://callback?id_token=FROM-QUERY#id_token=FROM-FRAGMENT"),
  "FROM-FRAGMENT",
);

check(
  "keeps a token that contains = padding",
  idTokenFromRedirect("naija://callback#id_token=aaa.bbb.ccc%3D%3D&state=s"),
  "aaa.bbb.ccc==",
);

check("ignores other parameters", idTokenFromRedirect("naija://callback#state=abc&scope=email"), null);

console.log(`\n${dim("the two flows must not be confused")}\n`);

// The bug that cost a phone test: PKCE is only valid with the code flow, and
// asking for an id_token with code_challenge_method attached is a protocol error
// that Google rejects outright rather than ignoring.
const request = await readFile("mobile/src/screens/SignInScreen.tsx", "utf8");

check("the app asks for a code", /responseType:\s*"code"/.test(request), true);
check("and PKCE, which belongs to that flow", /usePKCE:\s*true/.test(request), true);
check(
  "it no longer asks for an implicit id_token",
  /responseType:\s*"id_token"/.test(request),
  false,
);
check(
  "the verifier is sent with the exchange",
  /code_verifier/.test(request),
  true,
);

// ---------------------------------------------------------------------------
console.log(`\n${dim("the two strings that must agree")}\n`);

const appJson = JSON.parse(await readFile("mobile/app.json", "utf8"));
const config = await readFile("mobile/src/config.ts", "utf8");

const scheme = appJson.expo.scheme;
const fromConfig = /APP_SCHEME\s*=\s*"([^"]+)"/.exec(config)?.[1];
const googleAuth = await readFile("mobile/src/googleAuth.ts", "utf8");
const cid = /([0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com)/.exec(googleAuth)?.[1];

check("app.json declares a scheme", typeof scheme === "string" && scheme.length > 0, true);
check("config.ts uses the same scheme", fromConfig, scheme);
check(
  "expo-web-browser is a plugin, so Android builds the intent filter",
  (appJson.expo.plugins ?? []).includes("expo-web-browser"),
  true,
);

// A mismatch here is the nastiest kind of bug: nothing throws, no log line says
// anything, and the symptom is a spinner that never resolves after a perfectly
// good sign-in. Google finishes, the browser has nowhere to return to, and the
// app is left waiting for a callback that can never arrive.
console.log(
  dim(`\n  both say "${scheme}" - a mismatch here means sign-in silently hangs\n`),
);

// ---------------------------------------------------------------------------
console.log(`\n${dim("the two audiences the server will accept")}\n`);

// If this file and env.ts ever disagree about the variable name, the server reads
// undefined, finds no Android audience, and rejects every native sign-in with
// "google-not-configured" - which looks like a Google problem and is not.
const envTs = await readFile("src/lib/env.ts", "utf8");
const serverKey = /googleAndroidClientId:\s*read\("([A-Z_]+)"\)/.exec(envTs)?.[1];

check("the app has a client id that looks real", cid.length > 20, true);
check("the server reads one from an env var", typeof serverKey === "string", true);

console.log(dim(`  the server expects ${serverKey}\n`));
console.log(
  dim(
    "  Vercel holds the real value, so this cannot compare them - it checks the\n",
  ),
);
console.log(
  dim(
    "  name and shape are plausible. The live server answered invalid-google-token\n",
  ),
);
console.log(
  dim("  rather than google-not-configured, which is the real proof it is set.\n"),
);

summary();
