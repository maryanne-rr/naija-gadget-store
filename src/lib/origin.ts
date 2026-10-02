import "server-only";

/**
 * Work out the site's own origin for the payment redirect.
 *
 * WHY THIS IS FASTER TO GET WRONG THAN IT LOOKS
 * The obvious implementation reads the Host header. That value is supplied by
 * whoever sent the request, so anyone can craft a link like
 *
 *     https://your-shop.com/api/checkout      Host: evil.example.com
 *
 * and our response will happily say "redirect to
 * https://evil.example.com/checkout/pay". Nothing in between notices, because to
 * the code the customer simply asked for a different domain.
 *
 * Verified this actually happens - with no AUTH_URL configured, POSTing with
 * `X-Forwarded-Host: evil.example.com` produced
 * `redirectTo: "https://evil.example.com/checkout/pay?..."`.
 *
 * SO: in production we refuse to guess. Set AUTH_URL and it is authoritative.
 * Deriving from headers is only allowed in development, where there is no
 * untrusted audience and the convenience is worth it.
 */
export function originFromRequest(request: Request, configured?: string): string {
  if (configured) {
    // Trailing slashes removed so joining a path never yields "//checkout".
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    // Fail closed. Guessing here is what produces an open redirect, and a
    // payment redirect is about the worst place to have one.
    throw new Error(
      "AUTH_URL is required in production. Set it to the public origin, e.g. " +
        "https://your-domain.com, so the payment redirect cannot be pointed " +
        "elsewhere by a spoofed Host header.",
    );
  }

  const headers = request.headers;
  const hostname =
    headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? headers.get("host");

  if (!hostname) {
    return "http://localhost:3000";
  }

  const protocol =
    headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (hostname.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${hostname}`;
}
