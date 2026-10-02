"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Error boundary.
 *
 * Next.js renders this instead of a blank page when a server component throws.
 * `error.digest` is an id Next.js logs on the server - showing it lets someone
 * match the browser to the terminal output. Never show the raw error message:
 * stack traces leak file paths and sometimes secrets.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="py-20 text-center">
      <p className="text-5xl" aria-hidden="true">
        😵
      </p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Something broke</h1>
      <p className="mt-2 text-ink-500">
        This is a bug, not something you did. Try again, and check the terminal for the full
        error.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-xs text-ink-400">Reference: {error.digest}</p>
      )}

      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-card bg-ink-900 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-card border border-ink-300 px-5 py-2.5 font-semibold hover:bg-ink-100 dark:border-ink-600 dark:hover:bg-ink-800"
        >
          Back to the shop
        </Link>
      </div>
    </div>
  );
}
