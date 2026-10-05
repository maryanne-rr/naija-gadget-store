"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Approves the device as soon as somebody arrives here signed in.
 *
 * WHY THERE IS NO BUTTON ANY MORE
 * This used to ask the person to press "Connect this device" after signing in. It
 * was defensible - approving a device should be deliberate - and it was also an
 * extra tap on a flow somebody had already committed to by following a link from
 * their own phone.
 *
 * What made it safe was never the button. It was that the CODE is useless to
 * anyone who did not open that link: pollPairing compares sha256 of a secret the
 * phone generated and never sent, so a code read over a shoulder cannot be redeemed
 * even if somebody then approves it from their own account. The phone would collect
 * the attacker's token, show the attacker's email, and the person would notice.
 *
 * With that guarantee in place the button adds friction and removes nothing, so it
 * is gone. The code is still displayed, which is what it is actually for: letting
 * the person confirm they are approving the device they meant to.
 *
 * THE TIMEOUT IS NOT PARANOIA
 * Approving on load means a page left open in a shared browser would grant a device
 * to whoever signs in next. Eight seconds is long enough to read the account name
 * and abort, and short enough that nobody waits for it.
 */
export function ApproveDeviceButton({ code, account }: { code: string; account: string }) {
  const [state, setState] = useState<"approving" | "done" | "failed">("approving");
  const [message, setMessage] = useState("");
  const done = useRef(false);

  useEffect(() => {
    // React runs effects twice in development's StrictMode. Approving twice would
    // burn the single-use pairing on the first call and leave the phone polling a
    // code that has already been redeemed.
    if (done.current) return;
    done.current = true;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/mobile/pair/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setState("failed");
          setMessage(payload?.error ?? "Could not connect that device.");
          return;
        }

        setState("done");

        // Hand the person back to the app. The scheme is registered by the
        // installed app; in a desktop browser nothing handles it and the line
        // below does nothing at all, which is why the fallback text is shown.
        try {
          window.location.href = `naija://pair-complete?code=${encodeURIComponent(code)}`;
        } catch {
          // Some browsers refuse an unhandled scheme. The person is already
          // approved; they just have to switch back to the app by hand.
        }
      } catch {
        setState("failed");
        setMessage("Could not reach the shop. Check your connection and try again.");
      }
    }, 8000);

    return () => clearTimeout(timer);
  }, [code]);

  if (state === "failed") {
    return (
      <div
        role="alert"
        className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-left dark:border-amber-700 dark:bg-amber-950"
      >
        <p className="font-semibold text-amber-900 dark:text-amber-100">
          That did not work
        </p>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{message}</p>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
          Open the app again and it will give you a new code.
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-left dark:border-emerald-700 dark:bg-emerald-950"
    >
      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
        {state === "done" ? "Connected — opening your app" : `Connecting ${account}…`}
      </p>
      <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
        {state === "done"
          ? "If nothing happens, close this tab and reopen Naija Gadgets."
          : "Check that this is the account you meant."}
      </p>
    </div>
  );
}
