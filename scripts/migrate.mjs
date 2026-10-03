/**
 * Run a SQL migration against Supabase.
 *
 *   npm run migrate -- supabase/005-cart.sql
 *   npm run migrate -- supabase/005-cart.sql supabase/006-device-pairing.sql
 *
 * WHY THIS EXISTS
 * Migrations used to mean: open the dashboard, find the SQL Editor, select all,
 * paste, Run, repeat. That is five steps repeated for every migration, and it has
 * two failure modes that both waste an afternoon.
 *
 *   1. Pasting the FILENAME instead of the file's contents. The editor then says
 *           ERROR: 42601: syntax error at or near "supabase"
 *      which looks like broken SQL and is not.
 *   2. Pasting half a file. The create table succeeds and the function does not,
 *      and the missing function only shows up later as a failed request.
 *
 * So this reads the file off disk, sends exactly its bytes, and reports what came
 * back. It cannot do either of those mistakes.
 *
 * WHY A PAT AND NOT THE DATABASE PASSWORD
 * The Management API takes a Personal Access Token, which is revocable from the
 * dashboard and is not the password on the database itself. The password never
 * leaves the machine that needs it, and losing this token costs nothing but a
 * click to mint another.
 *
 * The service-role key will NOT work here, and it is worth being explicit about
 * why: that key speaks PostgREST, which does data operations - rows in, rows out.
 * It has no way to create a table. Schema changes need the Management API.
 *
 * CREATE ONE AT  supabase.com/dashboard/account/tokens
 * Name it "shop migrations", generate, copy it.
 *
 * Then, in your own terminal so it never reaches chat or a shell history file
 * that gets committed:
 *
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
 *   npm run migrate -- supabase/005-cart.sql
 *
 * The token is read from the environment only. It is never written to a file,
 * never echoed, and never passed on the command line where it would land in
 * PowerShell's history.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const API_ROOT = "https://api.supabase.com/v1";

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function fail(message) {
  console.error(red(message));
  process.exitCode = 1;
}

/**
 * The project ref, read out of the Supabase URL already in .env.local.
 *
 * Derived rather than configured so there is one place to get the project right.
 * A migration pointed at the wrong project is one of the few genuinely
 * unrecoverable mistakes here, and making the user copy a 20-character id by hand
 * is a good way to cause it.
 */
async function readProjectRef() {
  if (!existsSync(".env.local")) {
    fail("No .env.local found. Run this from the project root.");
    return null;
  }

  const contents = await readFile(".env.local", "utf8");
  const match = contents.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*"?https:\/\/([a-z0-9]+)\./m);

  if (!match) {
    fail("Could not find NEXT_PUBLIC_SUPABASE_URL in .env.local.");
    return null;
  }

  return match[1];
}

async function main() {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.error(`
${bold("Usage")}
  npm run migrate -- <file.sql> [more.sql ...]

${bold("First time")}
  1. Mint a token:  ${dim("supabase.com/dashboard/account/tokens")}  -> Generate new token
  2. In your own terminal:
       $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
  3. Then:
       npm run migrate -- supabase/005-cart.sql supabase/006-device-pairing.sql

${bold("No filename gets run by accident")}
  This reads each file's contents. Pasting a path into the dashboard's SQL Editor
  is what produces "syntax error at or near supabase".
`);
    process.exitCode = 1;
    return;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    fail("SUPABASE_ACCESS_TOKEN is not set. See the instructions above.");
    return;
  }

  const ref = await readProjectRef();
  if (!ref) return;

  console.log(bold(`\nProject: ${ref}\n`));

  for (const file of files) {
    const path = resolve(file);

    if (!existsSync(path)) {
      fail(`  ${file} - no such file`);
      continue;
    }

    const sql = await readFile(path, "utf8");

    // Cheap guard against the exact mistake this script exists to prevent. A .sql
    // file containing nothing but its own path is a path that got pasted into the
    // dashboard instead of the contents.
    if (sql.trim().split(/\r?\n/).length <= 2 && /^\s*[\w./\\-]+\.sql\s*$/i.test(sql)) {
      fail(`  ${file} - that is a path, not SQL. It should start with "--" or "create".`);
      continue;
    }

    console.log(`  ${file} ${dim(`(${(sql.length / 1024).toFixed(1)} kB)`)}`);

    let response;
    try {
      response = await fetch(`${API_ROOT}/projects/${ref}/database/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });
    } catch (error) {
      fail(`    could not reach the Supabase API: ${error.message}`);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      fail(`    token rejected (HTTP ${response.status}). It may be wrong or revoked.`);
      fail(`    Mint a new one: ${dim("supabase.com/dashboard/account/tokens")}`);
      continue;
    }

    const body = await response.text();

    if (!response.ok) {
      // Postgres errors name a LINE number, which is worth keeping intact - it is
      // the difference between a five-second fix and a hunt.
      fail(`    HTTP ${response.status}`);
      console.error(dim(body.split("\n").slice(0, 12).map((l) => `      ${l}`).join("\n")));
      continue;
    }

    console.log(green(`    applied`));
  }

  console.log(
    dim("\n  Nothing is cached anywhere. If a file already applied cleanly, running it"),
  );
  console.log(dim("  again is safe: every statement in it is written to be idempotent.\n"));
}

await main();
