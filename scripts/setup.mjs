/**
 * `npm run setup` - opens .env.local in Notepad.
 *
 * Exists because the keys are the fiddly part of this project and "which file
 * do I paste into again?" is a question nobody should have to ask twice.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(projectRoot, ".env.local");

const banner = (s) => `\u001b[36m${s}\u001b[0m`;
const dim = (s) => `\u001b[2m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const yellow = (s) => `\u001b[33m${s}\u001b[0m`;

console.log(`
${banner("Naija Gadget Store - setup")}

${dim("Keys needed, and where to get each one:")}

  1. SUPABASE   Dashboard > Project Settings > Data API
                ${dim("URL + service_role key")}

  2. MAILGUN    https://signup.mailgun.com  ${dim("(sign up, verify email)")}
                Sending > API keys  ${dim("-> key-... and your domain")}

  3. GOOGLE     https://console.cloud.google.com
                OAuth consent screen > Credentials > Create Credentials
                ${dim("Client ID + Client secret")}

${dim("How to use this file:")}

  Each line is commented out, like this:

      ${dim("# MAILGUN_API_KEY=key-0000")}

  Delete the ${yellow("#")} at the start and paste your value after the ${yellow("=")}.
  Then SAVE and run ${green("npm run dev")} again.

  ${dim("Nothing configured yet? That is fine - the app runs without any of it.")}

`);

if (!existsSync(envFile)) {
  // Create it from the example so there is always something to open.
  const example = join(projectRoot, ".env.example");
  if (existsSync(example)) {
    const { copyFileSync } = await import("node:fs");
    copyFileSync(example, envFile);
    console.log(`${green("Created")} .env.local from .env.example\n`);
  }
}

console.log(dim(`Opening ${envFile}\n`));

// notepad.exe returns immediately, so the dev server can be restarted straight
// after saving.
const child = spawn("notepad.exe", [envFile], { detached: true, stdio: "ignore" });
child.unref();

// Tell them what state they're in right now.
try {
  const contents = readFileSync(envFile, "utf8");
  const active = contents
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#") && line.includes("="));

  const configured = new Set(
    active.map((line) => line.split("=")[0].trim()).filter((name) => name !== "AUTH_TRUST_HOST"),
  );

  console.log(dim("Currently configured:"));
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "MAILGUN_API_KEY",
    "AUTH_GOOGLE_ID",
    "AUTH_SECRET",
  ]) {
    console.log(`  ${configured.has(name) ? green("yes") : dim(" no")}  ${name}`);
  }
  console.log("");
} catch {
  // Never let a status display stop Notepad from opening.
}
