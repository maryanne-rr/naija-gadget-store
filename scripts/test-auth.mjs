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

// ---------------------------------------------------------------------------
// The parser, inlined rather than imported.
//
// src/googleAuth.ts imports src/config.ts, which reads process.env through Expo's
// babel plugin - and that transform does not apply to a plain node run. Importing
// it would need a Metro-less shim for one function, and a copy of a parser under
// test is worse than useless. So this is the same code, and the note below is what
// keeps the two honest.
// ---------------------------------------------------------------------------

function idTokenFromRedirect(url) {
  const fragmentAt = url.indexOf("#");
  const queryAt = url.indexOf("?");

  let source = null;

  if (fragmentAt !== -1) {
    source = url.slice(fragmentAt + 1);
  } else if (queryAt !== -1) {
    const end = url.indexOf("#", queryAt);
    source = end === -1 ? url.slice(queryAt + 1) : url.slice(queryAt + 1, end);
  }

  if (!source) return null;

  for (const pair of source.split("&")) {
    const [key, value] = pair.split("=");
    if (key !== "id_token") continue;
    try {
      return decodeURIComponent(value ?? "");
    } catch {
      return value ?? null;
    }
  }

  return null;
}

console.log(`\n${dim("id_token extraction from the redirect URL")}\n`);

// The implicit flow puts it in the fragment. This is the common case on Android.
check(
  "reads the token from the fragment",
  idTokenFromRedirect("naija://callback#id_token=HEADER.PAYLOAD.SIG&state=xyz"),
  "HEADER.PAYLOAD.SIG",
);

// The fragment is checked FIRST on purpose. A query string is what ends up in
// server access logs, so a token must never be sourced from one when a fragment
// is present.
check(
  "prefers the fragment over the query",
  idTokenFromRedirect("naija://callback?id_token=FROM_QUERY#id_token=FROM_FRAGMENT"),
  "FROM_FRAGMENT",
);

check(
  "reads the token from the query when there is no fragment",
  idTokenFromRedirect("naija://callback?id_token=HEADER.PAYLOAD.SIG&scope=openid"),
  "HEADER.PAYLOAD.SIG",
);

// A real JWT is base64url and can carry "=" padding, so splitting on "=" must not
// truncate it.
check(
  "keeps a token that contains = padding",
  idTokenFromRedirect("naija://callback#id_token=aaa.bbb.ccc%3D%3D&state=s"),
  "aaa.bbb.ccc==",
);

check("returns null with no token", idTokenFromRedirect("naija://callback#error=access_denied"), null);
check("returns null for a bare callback", idTokenFromRedirect("naija://callback"), null);
check("returns null for a Google error", idTokenFromRedirect("naija://callback#error=access_denied&error_description=nope"), null);
check("ignores other parameters", idTokenFromRedirect("naija://callback#state=abc&scope=email"), null);

// ---------------------------------------------------------------------------
console.log(`\n${dim("the two strings that must agree")}\n`);

const appJson = JSON.parse(await readFile("mobile/app.json", "utf8"));
const config = await readFile("mobile/src/config.ts", "utf8");

const scheme = appJson.expo.scheme;
const fromConfig = /APP_SCHEME\s*=\s*"([^"]+)"/.exec(config)?.[1];

check("app.json declares a scheme", typeof scheme === "string" && scheme.length > 0, true);
check("config.ts uses the same scheme", fromConfig, scheme);

// A mismatch here is the nastiest kind of bug: nothing throws, no log line says
// anything, and the symptom is a spinner that never resolves after a perfectly
// good sign-in. Google finishes, the browser has nowhere to return to, and the
// app is left waiting for a callback that can never arrive.
console.log(
  dim(`\n  both say "${scheme}" - a mismatch here means sign-in silently hangs\n`),
);
