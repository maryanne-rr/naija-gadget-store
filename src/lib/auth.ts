import "server-only";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { env, integrations } from "./env";

/**
 * Google sign-in, via Auth.js (the library formerly called NextAuth).
 *
 * WHY A LIBRARY RATHER THAN HAND-ROLLED OAUTH
 * Google sign-in is a browser redirect to accounts.google.com and back, with a
 * `code` that must be exchanged for tokens. Hand-rolling it means handling the
 * `state` parameter (CSRF), the exchange, cookie flags, session expiry and
 * refresh. Auth.js does all of that, and is well audited. Use it.
 *
 * HOW IT FITS TOGETHER
 *   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` come from Google Cloud Console.
 *   - The callback URL you register with Google is
 *         http://localhost:3000/api/auth/callback/google
 *     Auth.js owns that route; you do not write it.
 *   - Where the signed-in user is stored depends on whether Supabase is
 *     configured. See the note below.
 */

// Sessions live in the database only if we have one to put them in.
const useDatabase = integrations.database;

const config: NextAuthConfig = {
  // "database" keeps sessions in Supabase and survives a restart.
  // "jwt" keeps the session in a signed cookie, which is the fallback when
  // Supabase is not configured yet so Google sign-in still works standalone.
  session: { strategy: useDatabase ? "database" : "jwt" },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  providers: [],

  callbacks: {
    // Copy the user id onto session.user so server components can use it to
    // scope database queries ("only show me MY orders").
    session({ session, user, token }) {
      if (session.user) {
        if (user?.id) {
          session.user.id = user.id;
        } else if (token?.userId) {
          // jwt strategy: the id rode along in the token.
          session.user.id = token.userId as string;
        }
      }
      return session;
    },

    // jwt strategy only. Harmless when using database sessions.
    jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }
      return token;
    },
  },

  // Auth.js swallows its own errors unless you log them here. Without this a
  // misconfigured OAuth client fails silently and just looks like "sign in
  // does nothing".
  logger: {
    error(error) {
      console.error("[auth]", error?.message ?? error);
    },
    warn(code) {
      console.warn(`[auth] ${code}`);
    },
    debug() {
      // Left quiet on purpose - Auth.js is extremely chatty at debug level.
    },
  },
};

if (integrations.googleAuth) {
  config.providers = [
    Google({
      clientId: env.googleClientId!,
      clientSecret: env.googleClientSecret!,

      // Requested scopes are spelled out rather than left to Google's defaults.
      //
      // This matters. Google treats these three as the "basic" set: anyone can
      // sign in with any Google account, no test-user list, no 7-day expiry,
      // and no "this app is not verified" warning screen. Add a single
      // sensitive scope (Drive, Gmail, Calendar...) and all of that changes -
      // sign-in starts showing a warning and is capped, and Google may require
      // a verification process that takes weeks.
      //
      // So: keep this list short. The shop only needs to know who you are.
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },

      // Without this, signing in with an existing Google account that has never
      // used this app throws an OAuthAccountNotLinked error.
      allowDangerousEmailAccountLinking: true,
    }),
  ];

  if (useDatabase) {
    // @auth/supabase-adapter takes { url, secret } - `secret` is the
    // service-role key. It writes to the users / accounts / sessions tables
    // created by supabase/schema.sql.
    config.adapter = SupabaseAdapter({
      url: env.supabaseUrl!,
      secret: env.supabaseServiceRoleKey!,
    });
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(config);

/** Next.js uses this marker to decide a route must be rendered per request. */
const DYNAMIC_SERVER_USAGE = "DYNAMIC_SERVER_USAGE";

function isDynamicUsageProbe(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: unknown }).digest === DYNAMIC_SERVER_USAGE
  );
}

/**
 * Read the current session without ever throwing.
 *
 * `auth()` raises if the auth secret is missing, which would take down every
 * page that merely asks "is anyone signed in?". Returning null keeps the shop
 * browsable before Google is configured.
 *
 * The one error we do NOT swallow is Next.js's DYNAMIC_SERVER_USAGE probe.
 * Reading cookies is exactly how Next.js detects that a route must be rendered
 * per request, so this "error" is expected during prerendering and rethrowing
 * it is how the route correctly becomes dynamic. Catching it instead leaves
 * those routes stuck as static with a stale session, and fills the build log
 * with alarming-looking stack traces.
 */
export async function getSession() {
  if (!integrations.googleAuth) {
    return null;
  }

  try {
    return await auth();
  } catch (error) {
    if (isDynamicUsageProbe(error)) {
      throw error;
    }

    console.error("[auth] could not read session:", error);
    return null;
  }
}

export function authIsConfigured(): boolean {
  return integrations.googleAuth;
}
