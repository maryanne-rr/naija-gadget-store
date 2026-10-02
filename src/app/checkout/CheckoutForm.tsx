"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { formatNaira } from "@/lib/money";

/**
 * The checkout form.
 *
 * Walks the shopper through:
 *   1. POST /api/checkout - server validates, recalculates every price from the
 *      database, saves the order as 'pending', and returns the payment page URL
 *   2. window.location = redirectTo
 *      - the payment page, where the order is marked paid
 *
 * Note what is sent: product ids and quantities only. Prices in this file are
 * for showing a total before the customer commits; the server uses its own.
 */

interface CheckoutFormProps {
  user: { name: string; email: string } | null;
}

const NIGERIAN_STATES = [
  "Lagos",
  "Abuja (FCT)",
  "Rivers",
  "Kano",
  "Oyo",
  "Enugu",
  "Kaduna",
  "Cross River",
  "Port Harcourt",
  "Ibadan",
  "Benin City",
  "Abeokuta",
  "Onitsha",
  "Warri",
];

export function CheckoutForm({ user }: CheckoutFormProps) {
  const { items, subtotal, clear, hydrated } = useCart();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (items.length === 0) return;

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);

    // Only ids and quantities leave the browser. The server recomputes money.
    const body = {
      email: String(form.get("email") ?? ""),
      shippingName: String(form.get("shippingName") ?? ""),
      shippingPhone: String(form.get("shippingPhone") ?? ""),
      shippingAddress: String(form.get("shippingAddress") ?? ""),
      shippingCity: String(form.get("shippingCity") ?? ""),
      shippingState: String(form.get("shippingState") ?? ""),
      lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    };

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        redirectTo?: string;
        error?: string;
        fieldErrors?: Record<string, string[]>;
      };

      if (!response.ok || !payload.ok || !payload.redirectTo) {
        setError(payload.error ?? "Something went wrong. Please try again.");
        setFieldErrors(payload.fieldErrors ?? {});
        setSubmitting(false);
        return;
      }

      // Empty the basket before navigating. The order is already saved, so
      // losing the cart on a back-navigation is correct.
      clear();

      // A full page load, not a router push: this leaves the checkout flow and
      // lands on the payment step.
      window.location.href = payload.redirectTo;
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (hydrated && items.length === 0) {
    return (
      <div className="rounded-xl border border-ink-200 bg-white p-8 text-center dark:border-ink-700 dark:bg-ink-800">
        <p className="font-medium">Your cart is empty.</p>
        <Link href="/" className="mt-3 inline-block text-sm underline">
          Add something to it
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm dark:border-ink-600 dark:bg-ink-900";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </div>
      )}

      <section className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-800">
        <h2 className="font-semibold">Contact</h2>

        <div className="mt-4 space-y-4">
          <Field label="Email address" error={fieldErrors.email} htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={user?.email ?? ""}
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
          <p className="-mt-2 text-xs text-ink-500">
            Your order confirmation and receipt go here.
          </p>

          <Field label="Phone number" error={fieldErrors.shippingPhone} htmlFor="shippingPhone">
            <input
              id="shippingPhone"
              name="shippingPhone"
              type="tel"
              autoComplete="tel"
              placeholder="0803 000 0000"
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-800">
        <h2 className="font-semibold">Delivery address</h2>

        <div className="mt-4 space-y-4">
          <Field label="Full name" error={fieldErrors.shippingName} htmlFor="shippingName">
            <input
              id="shippingName"
              name="shippingName"
              required
              autoComplete="name"
              defaultValue={user?.name ?? ""}
              className={inputClass}
            />
          </Field>

          <Field label="Street address" error={fieldErrors.shippingAddress} htmlFor="shippingAddress">
            <input
              id="shippingAddress"
              name="shippingAddress"
              required
              autoComplete="street-address"
              placeholder="12B Admiralty Way, Lekki Phase 1"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" error={fieldErrors.shippingCity} htmlFor="shippingCity">
              <input
                id="shippingCity"
                name="shippingCity"
                autoComplete="address-level2"
                placeholder="Lagos"
                className={inputClass}
              />
            </Field>

            <Field label="State" error={fieldErrors.shippingState} htmlFor="shippingState">
              <select id="shippingState" name="shippingState" className={inputClass} defaultValue="">
                <option value="">Select a state</option>
                {NIGERIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-800">
        <h2 className="font-semibold">Order summary</h2>

        <ul className="mt-4 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-4">
              <span className="truncate text-ink-600 dark:text-ink-300">
                {item.name} <span className="text-ink-400">&times; {item.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatNaira(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between border-t border-ink-200 pt-4 text-lg dark:border-ink-700">
          <span>Total</span>
          <span className="font-bold tabular-nums">{formatNaira(subtotal)}</span>
        </div>

        <button
          type="submit"
          disabled={submitting || !items.length}
          className="mt-5 w-full rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Starting payment…" : "Pay now"}
        </button>
      </section>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && error.length > 0 && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error[0]}</p>
      )}
    </div>
  );
}
