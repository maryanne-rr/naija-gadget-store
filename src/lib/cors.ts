import { NextResponse } from "next/server";

/**
 * CORS for the shop's JSON API, so the mobile app can be developed and reviewed
 * in a browser.
 *
 * WHY THIS IS SAFE FOR THE WEBSITE'S OWN AUTH
 * The website authenticates /api/cart with an httpOnly Auth.js cookie, and this is
 * the part that could have made the header dangerous. It does not:
 *
 *   Access-Control-Allow-Credentials is NOT set.
 *
 * A browser will not attach a cookie to a cross-origin request unless the server
 * opts in with that header, so no other site can ride somebody's session. The
 * only thing this enables is a request with no credentials at all, which the
 * endpoints already reject with a 401.
 *
 * WHY IT IS SAFE FOR THE APP'S AUTH
 * The app authenticates with an Authorization: Bearer header, never a cookie. A
 * token has to be stolen before it can be used, and a cross-origin header does not
 * leak it: the browser only exposes a response to the page that made the request,
 * which is the app's own code.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * It does not open /api/checkout to other origins. Checkout creates orders and
 * takes a shipping address, and there is no reason for a third party to be able to
 * call it. That route is left exactly as it was.
 */

/** Any origin, because nothing here is cookie-authenticated across origins. */
const ALLOW_ORIGIN = "*";

/**
 * Headers the app's fetch calls actually send. Without listing these, the browser
 * refuses the preflight and the request never leaves - which looks exactly like the
 * network being down.
 */
const ALLOW_HEADERS = "Content-Type, Authorization, x-claim-secret";

const ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS";

/** Answer the browser's preflight, and add the headers to the real response. */
export function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  response.headers.set("Access-Control-Allow-Methods", ALLOW_METHODS);
  response.headers.set("Access-Control-Allow-Headers", ALLOW_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

/**
 * Wrap a route handler so both the preflight and the response are handled.
 *
 * OPTIONS returning 204 with no body is what the browser expects; replying with
 * the normal JSON body instead is a 200 the caller then tries to parse, which
 * produces a confusing "unexpected token < in JSON" rather than a CORS error.
 */
export function corsRoute(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return withCors(
        new NextResponse(null, { status: 204 }) as unknown as NextResponse,
      );
    }

    const response = await handler(request);
    return withCors(response as NextResponse);
  };
}
