"use client";

import { useState } from "react";

/**
 * Matches the scheme in mobile/app.json.
 *
 * Duplicated rather than imported because this is website code and app.json is
 * app code - nothing here can read that file at runtime, and a deep link whose
 * scheme has silently drifted out of sync is worse than a duplicated string with a
 * comment saying where the other copy is.
 */
const APP_SCHEME = "naija";

/**
 * The "Approve this device" button on /pair/CODE.
 *
 * A client component because it calls an API route and shows the result. The
 * request is a POST rather than a link so that approving cannot be triggered by a
 * crawler following a href, or by an image tag in somebody else's page.
 *
 * It says what is about to happen before it happens, which is the whole point of
 * the screen: somebody is being asked to let a second device into their account,
 * and "Allow" on its own would be a strange thing to press.
 */
export function ApproveDeviceButton({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">("idle");
  const [message, setMessage] = useState("");
  /** Whether we managed to hand the person back to the phone. */
  const [opened, setOpened] = useState(false);

  async function approve() {
    setState("working");

    try {
      const response = await fetch("/api/mobile/pair/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setState("failed");
        setMessage(payload.error ?? "Could not approve that device.");
        return;
      }

      setState("done");

      // Hand the person back to the phone.
      //
      // THE SCHEME IS REGISTERED BY THE INSTALLED APP ONLY
      // app.json declares "scheme": "naija", which is what Android uses to build
      // the intent filter. Expo Go's scheme is exp://, so in a development build
      // this URL goes nowhere and silently does nothing. Which is fine, because
      // the app also checks the moment it returns to the foreground - so the
      // worst case is "no shortcut", not "stuck".
      //
      // The catch is real, not theoretical: window.location pointing at an
      // unhandled scheme throws or logs depending on the browser, and some mobile
      // browsers leave the page blank. So the fallback text is rendered alongside.
      try {
        // Not an internal navigation, which is what the rule below is about: this
        // hands control to another application via a custom scheme. Suppressed
        // explicitly so it is a decision on the record rather than a warning
        // somebody silences by turning the rule off.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `${APP_SCHEME}://pair-complete?code=${encodeURIComponent(code)}`;
        setOpened(true);
      } catch {
        setOpened(false);
      }
    } catch {
      setState("failed");
      setMessage("Could not reach the shop. Check your connection and try again.");
    }
  }

  if (state === "done") {
    return (
      <div
        role="status"
        className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-left dark:border-emerald-700 dark:bg-emerald-950"
      >
        <p className="font-semibold text-emerald-900 dark:text-emerald-100">
          That device is connected.
        </p>

        {opened ? (
          <>
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
              Your app is opening now.
            </p>
            {/* Not a fallback so much as the truth: the redirect works in the
                installed app, and goes nowhere in a desktop browser. Saying so is
                better than leaving someone staring at a blank page wondering
                whether it worked. */}
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
              If nothing happens, close this tab and reopen Naija Gadgets — it is
              signed in and sharing your cart.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
            You can close this tab. The phone is signed in and sharing your cart.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={approve}
        disabled={state === "working"}
        className="w-full rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-400"
      >
        {state === "working" ? "Connecting…" : "Connect this device"}
      </button>

      {state === "failed" ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
