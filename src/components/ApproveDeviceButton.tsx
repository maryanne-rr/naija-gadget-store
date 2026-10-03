"use client";

import { useState } from "react";

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
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
          You can close this tab. The phone is signed in and sharing your cart.
        </p>
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
