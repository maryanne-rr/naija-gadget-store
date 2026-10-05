import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveDeviceButton } from "@/components/ApproveDeviceButton";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { getSession } from "@/lib/auth";

/**
 * /pair/[code] - approve a phone, in the browser.
 *
 * This is the step that makes "log in to the website and the app with the same
 * account" true rather than hoped for. The phone cannot complete sign-in on its
 * own - see mobile/src/screens/SignInScreen.tsx - so it opens this page in a
 * browser and waits. This page is opened at an address that already contains the
 * pairing code, nobody types anything, and once the visitor is signed in the
 * device is approved and the browser hands them back to the app.
 *
 * The account comes from the website's own Auth.js session, so the phone ends up
 * with a token for the same users.id - and therefore the same cart_items rows.
 * Nothing here trusts anything the phone sent except the code.
 *
 * WHY SIGNING IN IS OFFERED HERE RATHER THAN SENT AWAY
 * If the visitor is not signed in they are sent to /login and then brought back
 * to this exact page. Without that, somebody who opened the link on a laptop they
 * were not signed in to would land on the homepage after authenticating, holding
 * a code for a phone that is still waiting and no idea what they approved.
 */

/** Codes are 4-4 with a dash. Anything else is not one of ours. */
const CODE_PATTERN = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export default async function PairPage({ params }: PageProps<"/pair/[code]">) {
  const { code } = await params;
  const normalised = code.toUpperCase().trim();

  // A 404 rather than an error message. It tells a scanner nothing about whether
  // the code exists, and it is the honest response to a URL that was never one of
  // ours.
  if (!CODE_PATTERN.test(normalised)) {
    notFound();
  }

  const session = await getSession();
  const userId = session?.user?.id;
  const account = session?.user?.email ?? session?.user?.name ?? null;

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="rounded-2xl border border-ink-200 bg-white p-8 text-center dark:border-ink-700 dark:bg-ink-800">
        <p className="text-4xl" aria-hidden="true">
          📱
        </p>

        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          {userId && account ? "Connect a device" : "Sign in to connect"}
        </h1>

        {userId && account ? (
          <>
            {/* The account is stated first and in full, because approval happens
                automatically now (see ApproveDeviceButton). This line is the last
                chance to notice the wrong account and close the tab.

                The code is still on the page, and still only once somebody is signed
                in, so the phone's code can be matched against what the browser is
                about to grant. It used to be the first thing on the page, signed out
                or not, which read as though the app were asking someone to type what
                the app had already done for them. */}
            <p className="mt-4 text-sm text-ink-600 dark:text-ink-300">
              Connecting your phone as
            </p>
            <p className="mt-1 font-semibold">{account}</p>
            <p className="mt-1 font-mono text-xs tracking-widest text-ink-400">
              {normalised}
            </p>

            <ApproveDeviceButton code={normalised} account={account} />
          </>
        ) : (
          <>
            <p className="mt-3 text-ink-500">
              Choose the same Google account you use on the website. Your phone is
              waiting — there is nothing to type.
            </p>

            <div className="mt-6">
              <GoogleSignInButton
                label="Continue with Google"
                // Comes back to THIS page after sign-in, so the approval
                // happens without another tap. The code never leaves the URL.
                redirectTo={`/pair/${normalised}`}
                className="w-full rounded-lg border border-ink-300 px-5 py-2.5 font-semibold hover:bg-ink-100 dark:border-ink-600 dark:hover:bg-ink-700"
              />
            </div>
          </>
        )}

        <p className="mt-8 text-sm">
          <Link href="/" className="text-ink-500 underline hover:text-ink-800 dark:hover:text-ink-200">
            ← Back to the shop
          </Link>
        </p>
      </div>
    </div>
  );
}
