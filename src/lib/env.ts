/**
 * Central place to read configuration.
 *
 * Every key is read lazily and defensively: a missing value becomes
 * `undefined` rather than throwing at import time. That way the app still
 * boots (in a reduced demo mode) before you have filled in `.env.local`, which
 * beats staring at a stack trace on your first run.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export const env = {
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),

  mailgunApiKey: read("MAILGUN_API_KEY"),
  mailgunDomain: read("MAILGUN_DOMAIN"),
  mailFrom: read("MAIL_FROM") ?? "Naija Gadget Store <no-reply@sandbox.mailgun.org>",

  googleClientId: read("AUTH_GOOGLE_ID"),
  googleClientSecret: read("AUTH_GOOGLE_SECRET"),
  authSecret: read("AUTH_SECRET"),

  /**
   * Optional. Overrides the origin used for the payment redirect.
   *
   * Usually left unset: lib/origin.ts derives the correct origin from the
   * request, which means one build works on localhost, on the production
   * domain, and on preview deployments. Set this only to pin a known-good
   * origin, since a host header is attacker-controllable.
   */
  authUrl: read("AUTH_URL"),
} as const;

/** Which integrations are switched on. Drives the status badges in the footer. */
export const integrations = {
  database: Boolean(env.supabaseUrl && env.supabaseServiceRoleKey),
  mailgun: Boolean(env.mailgunApiKey && env.mailgunDomain),
  googleAuth: Boolean(env.googleClientId && env.googleClientSecret && env.authSecret),
} as const;

export type IntegrationName = keyof typeof integrations;

export interface IntegrationStatus {
  name: IntegrationName;
  label: string;
  ready: boolean;
  /** The env var(s) that need setting. */
  vars: string[];
  /** Which section of the README explains how to get it. */
  docs: string;
}

export function integrationStatuses(): IntegrationStatus[] {
  return [
    {
      name: "database",
      label: "Supabase database",
      ready: integrations.database,
      vars: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
      docs: "README > 1. Supabase",
    },
    {
      name: "mailgun",
      label: "Mailgun email",
      ready: integrations.mailgun,
      vars: ["MAILGUN_API_KEY", "MAILGUN_DOMAIN"],
      docs: "README > 2. Mailgun",
    },
    {
      name: "googleAuth",
      label: "Google sign in",
      ready: integrations.googleAuth,
      vars: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "AUTH_SECRET"],
      docs: "README > 3. Google Cloud",
    },
  ];
}

/** True when every integration is configured. */
export function allIntegrationsReady(): boolean {
  return Object.values(integrations).every(Boolean);
}
