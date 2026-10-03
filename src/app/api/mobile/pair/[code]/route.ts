import { NextResponse } from "next/server";
import { pollPairing } from "@/lib/devicePairing";
import { issueMobileToken } from "@/lib/mobileAuth";

/**
 * GET /api/mobile/pair/[code]
 *
 * The phone polls this until the code is approved.
 *
 * The claim secret travels in a header rather than the query string so it does not
 * end up in server access logs, in a Referer header, or in a screenshot of the
 * URL. That matters more than usual here: this endpoint's whole security argument
 * rests on the secret staying private, and query strings are the first place
 * secrets leak.
 */

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const claimSecret = request.headers.get("x-claim-secret");

  if (!claimSecret) {
    return NextResponse.json({ error: "Missing claim secret." }, { status: 400 });
  }

  const result = await pollPairing(code, claimSecret);

  if (result.status === "ready") {
    // Minted here rather than stored, so there is never a live token sitting in
    // the database waiting to be read. The bearer token is derived from the
    // approved user_id at the moment the phone collects it.
    return NextResponse.json({
      status: "ready",
      token: await issueMobileToken(result.userId, result.email ?? ""),
      user: { id: result.userId, email: result.email },
    });
  }

  return NextResponse.json({ status: result.status });
}
