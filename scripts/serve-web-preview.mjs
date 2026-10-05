/**
 * A static file server for the app's web build, so the design can be reviewed in
 * a browser without a phone or a bundler.
 *
 * WHY THIS EXISTS
 * Reviewing a mobile design by asking somebody to install an APK, screenshot it,
 * and describe what looks wrong is slow and lossy. The same React Native code runs
 * on the web through react-native-web, so the layout, spacing and type can be
 * inspected and fixed here, and the person holding the phone gets one build at the
 * end.
 *
 * It is a static server on purpose. The app is pre-built by `expo export`, so there
 * is nothing to compile and nothing to watch - it serves files and stops.
 *
 * NOT cached, and that is the point.
 *
 * This was max-age=300, and it defeated the entire purpose. The browser served a
 * stale bundle while the file on disk had just been rebuilt, so the review looked
 * at a build that no longer existed - an error page for a CORS problem that had
 * already been fixed, staring back out of a cached response.
 *
 * A preview exists to show what is on disk right now. Caching belongs to
 * production, where the artefact is immutable and named by hash. This one is
 * neither, and 600 kB served from localhost takes no time worth saving.
 *
 *   node scripts/serve-web-preview.mjs [directory] [port]
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "mobile/.expo-web-preview");
const port = Number(process.argv[3] ?? 8099);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

try {
  await stat(join(root, "index.html"));
} catch {
  console.error(`No index.html in ${root}. Run: npx expo export --platform web`);
  process.exit(1);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);
  const requested = decodeURIComponent(url.pathname);

  // Resolve inside root and reject anything that escapes it. A preview server
  // bound to localhost is not a security boundary anyone depends on, but serving
  // an arbitrary path because a request contained ".." is the sort of thing that
  // gets copied into something that is.
  const target = resolve(join(root, normalize(requested)));
  if (target !== root && !target.startsWith(root + sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  const file = extname(target) ? target : join(target, "index.html");

  try {
    const body = await readFile(file);

    response.writeHead(200, {
      "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
      // no-store, not no-cache: no-cache still allows a conditional revalidation
      // round trip, which is a request that can itself be answered from a cache.
      "Cache-Control": "no-store, must-revalidate",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root}`);
  console.log(`  http://127.0.0.1:${port}`);
});
