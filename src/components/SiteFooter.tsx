import { integrationStatuses } from "@/lib/env";

/**
 * Footer with a live integration status panel.
 *
 * Handy while you are wiring the project up: instead of guessing whether an
 * env var took effect, reload the page and look. It also makes a decent slide
 * in a demo - the teacher can see Supabase, Mailgun, Google and Paystack light
 * up one by one as you paste each key in.
 */
export function SiteFooter() {
  const statuses = integrationStatuses();

  return (
    <footer className="mt-16 border-t border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="flex items-center gap-2 font-bold">
              <span aria-hidden="true">🇳🇬</span> Naija Gadget Store
            </p>
            <p className="mt-2 max-w-sm text-sm text-ink-500">
              A bootcamp project: Next.js, Supabase Postgres, Mailgun and Google
              sign-in, with a test payment page.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Integrations</h2>
            <ul className="mt-3 space-y-2">
              {statuses.map((status) => (
                <li key={status.name} className="flex items-start gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      status.ready ? "bg-brand-500" : "bg-ink-300"
                    }`}
                  >
                    {status.ready ? "✓" : "!"}
                  </span>
                  <span className={status.ready ? "text-ink-700 dark:text-ink-200" : "text-ink-400"}>
                    {status.label}
                    {!status.ready && (
                      <>
                        {" — set "}
                        <code className="rounded bg-ink-100 px-1 py-0.5 text-xs dark:bg-ink-800">
                          {status.vars.join(", ")}
                        </code>
                      </>
                    )}
                    <span className="sr-only">
                      {status.ready ? "configured" : "not configured, see " + status.docs}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-8 border-t border-ink-200 pt-6 text-xs text-ink-400 dark:border-ink-700">
          Built for a bootcamp project. Test mode only - no real money moves.
        </p>
      </div>
    </footer>
  );
}
