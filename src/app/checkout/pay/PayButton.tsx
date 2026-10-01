"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/money";

/**
 * The Pay button on the dummy payment page.
 *
 * It posts to /api/checkout/verify, which is the same endpoint a real gateway
 * would send the customer back to. Swapping this component for a redirect to a
 * bank's page is the only change a real gateway needs here.
 */
export function PayButton({ reference, amount }: { reference: string; amount: number }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setPaying(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "We could not complete the payment. Please try again.");
        setPaying(false);
        return;
      }

      const { redirectTo } = (await response.json()) as { redirectTo: string };

      // Server-side render would be nicer, but a redirect after an action that
      // was triggered by a click is a normal full page load.
      window.location.href = redirectTo;
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setPaying(false);
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={paying}
        className="w-full rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {paying ? "Processing…" : `Pay ${formatNaira(amount)}`}
      </button>
    </div>
  );
}
