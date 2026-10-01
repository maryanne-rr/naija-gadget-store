import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * All database access happens on the server, through the service-role key.
 *
 * That is deliberate:
 *   - the service-role key never reaches the browser bundle, so a curious
 *     visitor cannot read (or write) your tables;
 *   - it bypasses Row Level Security, which keeps the rules simple.
 *
 * Row Level Security is still *enabled* on every table in schema.sql, so if you
 * later add a browser-side client, the default posture is deny-by-default.
 *
 * This module imports `server-only`, so importing it from a client component
 * fails the build instead of silently leaking the key.
 */

let cached: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY to .env.local (see .env.example).",
    );
  }

  if (!cached) {
    cached = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        // We manage sessions through Auth.js, not Supabase Auth.
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: { "x-application-name": "naija-gadget-store" },
      },
    });
  }

  return cached;
}

/** Narrow a Supabase query to exactly one row, or throw. */
export async function fetchOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  context: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${context} failed: ${error.message}`);
  }
  if (data === null) {
    throw new Error(`${context} returned no rows.`);
  }
  return data;
}
