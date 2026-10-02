/**
 * Sourcing product photos from Wikimedia Commons.
 *
 * WHY COMMONS RATHER THAN UNSPLASH
 * Unsplash looks like the obvious choice and does not work from a terminal:
 *
 *   - the search API needs an access token you apply for;
 *   - unsplash.com/napi, which their own site calls, answers 401;
 *   - source.unsplash.com, the old random-photo-per-word URL, answers 503.
 *
 * Their image CDN does serve any photo by id, but you need to already know the
 * id, and scraping ids off a search results page does not work either - the ids
 * on the page are unrelated to the query. Tested: "wireless over-ear headphones"
 * returned a photo of a hedgehog.
 *
 * Commons has an open API that needs no key, honours the query, and every file
 * carries an explicit free licence. That last part matters more than the
 * pictures do: the shop is public and someone else might reuse it, so the
 * images have to be verifiably reusable rather than merely downloadable.
 *
 * WHAT THIS DOES NOT DO
 * It does not choose the photo. Search relevance is a starting point, not a
 * decision - "phone case" turns up a street market and a cage in a school. Each
 * candidate is staged for review and only the right ones get promoted into
 * public/products.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UA = "NaijaGadgetStore/1.0 (bootcamp project; contact: local)";

/** Read the plan from a file: quoting JSON through a Windows shell strips quotes. */
const PLAN = JSON.parse(readFileSync(process.argv[2], "utf8"));

const STAGING = join(process.cwd(), ".photo-staging");
mkdirSync(STAGING, { recursive: true });

/** Commons renders at any width, so ask for the size the shop actually uses. */
const API =
  "https://commons.wikimedia.org/w/api.php" +
  "?action=query&generator=search" +
  "&gsrnamespace=6&gsrlimit=8&prop=imageinfo" +
  "&iiprop=url|size|extmetadata&iiurlwidth=900&format=json";

/** Commons rate-limits hard: unauthenticated bursts get 429 after ~10 searches. */
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

for (const { label, query, avoid = [] } of PLAN) {
  console.log(`\n${label}`);
  console.log(`  searching: "${query}"`);

  const url = `${API}&gsrsearch=${encodeURIComponent(`filetype:bitmap ${query}`)}`;

  let response = await fetch(url, { headers: { "user-agent": UA } });

  // Back off and retry once. A 429 here is routine pacing, not a real failure,
  // and giving up would silently leave categories without photos.
  if (response.status === 429) {
    console.log("  rate limited, waiting...");
    await pause(12_000);
    response = await fetch(url, { headers: { "user-agent": UA } });
  }

  if (!response.ok) {
    console.log(`  search failed: HTTP ${response.status}`);
    await pause(8_000);
    continue;
  }

  const json = await response.json();
  const pages = Object.values(json?.query?.pages ?? {}).filter((p) => p.imageinfo?.length);
  console.log(`  ${pages.length} candidate(s)`);

  let n = 0;
  for (const page of pages) {
    const title = page.title.replace(/^File:/, "");

    // Junk the search reliably turns up: diagrams, packaging, logos, screenshots,
    // and anything matching a caller's do-not-use list.
    if (/\.(svg|pdf|tif|ogv|webm)$/i.test(title)) continue;
    if (/logo|icon|diagram|chart|screenshot|box|package|map|graph/i.test(title)) continue;
    if (avoid.some((bad) => title.toLowerCase().includes(bad.toLowerCase()))) continue;

    const info = page.imageinfo[0];

    // Commons hands back a thumbnail URL when iiurlwidth is set. That is what we
    // want: already resized, and far smaller than the 4000px original.
    const imageUrl = info.thumburl ?? info.url;
    if (!imageUrl) continue;

    const bytes = Buffer.from(
      await (await fetch(imageUrl, { headers: { "user-agent": UA } })).arrayBuffer(),
    );

    // Reject error pages and stubs. Anything under 8KB is not a usable photo.
    if (bytes.length < 8_000) continue;

    const slug = `${label}-${n}`;
    writeFileSync(join(STAGING, `${slug}.jpg`), bytes);

    // Attribution travels with the file. Commons files are mostly CC BY-SA,
    // which legally requires crediting the photographer.
    const meta = info.extmetadata ?? {};
    const author = (meta.Artist?.value ?? "").replace(/<[^>]*>/g, "").trim();
    const licence = (meta.LicenseShortName?.value ?? "unknown").trim();
    writeFileSync(
      join(STAGING, `${slug}.txt`),
      `title:    ${title}\n` +
        `author:   ${author || "see file page"}\n` +
        `licence:  ${licence}\n` +
        `source:   ${info.descriptionurl}\n` +
        `original: ${info.width}x${info.height}\n`,
    );

    console.log(`  [${n}] ${Math.round(bytes.length / 1024)}KB  ${title}`);
    n++;
  }

  if (n === 0) console.log("  nothing usable");

  // Pace every search, not just the throttled ones. Staying under the limit is
  // cheaper than retrying against it.
  await pause(4_000);
}

console.log(`\nCandidates in ${STAGING} - review them before promoting any.`);
console.log(dimless());
function dimless() {
  return "Attribution is written alongside each candidate as <name>.txt";
}