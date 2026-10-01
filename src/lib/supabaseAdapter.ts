import "server-only";
import type { Adapter, AdapterSession, AdapterUser } from "next-auth/adapters";
import { supabase } from "./supabase";

/**
 * Auth.js adapter backed by Supabase Postgres.
 *
 * WHY NOT @auth/supabase-adapter
 * The official adapter makes two assumptions this project does not share:
 *
 *   1. It hardcodes  db: { schema: "next_auth" }  - every table must live in a
 *      schema called next_auth. Our tables are in public, alongside products and
 *      orders, where they belong.
 *   2. It uses camelCase column names - emailVerified, sessionToken, userId.
 *      Ours are snake_case, per schema.sql.
 *
 * Rewriting the schema to satisfy the adapter would mean moving the shop tables
 * and renaming columns for no benefit. About a hundred lines of adapter is
 * cheaper, and it lets the auth tables live with the rest of the database.
 *
 * It also removes a dependency.
 *
 * Every method is a thin mapping between Auth.js's camelCase names and the
 * snake_case columns. Nothing here is clever; it is a translation layer.
 */

type Db = ReturnType<typeof supabase>;

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

/** Convert a database row into the shape Auth.js expects. */
function toUser(row: Record<string, unknown>): AdapterUser {
  // PostgREST returns timestamps as strings, but Auth.js types emailVerified as
  // a Date, so hand it one rather than letting the type lie.
  const verified = row.email_verified;

  return {
    id: row.id as string,
    name: (row.name as string) ?? null,
    email: (row.email as string) ?? null,
    emailVerified: verified ? new Date(verified as string | Date) : null,
    image: (row.image as string) ?? null,
  };
}

export function SupabaseAdapter(db: Db): Adapter {
  /**
   * Fetch one user. Defined outside the adapter object so getUserByAccount can
   * call it without relying on `this` - these methods are invoked as plain
   * functions by Auth.js, where `this` is not guaranteed to be the adapter.
   */
  async function findUserById(id: string): Promise<AdapterUser | null> {
    const { data, error } = await db.from("users").select().eq("id", id).maybeSingle();
    throwOnError(error, "getUser");
    return data ? toUser(data) : null;
  }

  return {
    async createUser(user) {
      const { data, error } = await db
        .from("users")
        .insert({
          id: user.id,
          name: user.name,
          email: user.email,
          email_verified: user.emailVerified ?? null,
          image: user.image,
        })
        .select()
        .single();

      throwOnError(error, "createUser");
      return toUser(data);
    },

    getUser: findUserById,

    async getUserByEmail(email) {
      const { data, error } = await db
        .from("users")
        .select()
        .eq("email", email)
        .maybeSingle();

      throwOnError(error, "getUserByEmail");
      return data ? toUser(data) : null;
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const { data, error } = await db
        .from("accounts")
        .select("user_id")
        .eq("provider", provider)
        .eq("provider_account_id", providerAccountId)
        .maybeSingle();

      throwOnError(error, "getUserByAccount");
      if (!data) return null;

      // Explicit second query rather than a PostgREST embed, so the
      // relationship is obvious and cannot break on a schema detail.
      return findUserById(data.user_id as string);
    },

    async updateUser(user) {
      const { data, error } = await db
        .from("users")
        .update({
          name: user.name,
          email: user.email,
          email_verified: user.emailVerified ?? null,
          image: user.image,
        })
        .eq("id", user.id)
        .select()
        .single();

      throwOnError(error, "updateUser");
      return toUser(data);
    },

    async deleteUser(userId) {
      // accounts and sessions cascade via the foreign keys in schema.sql.
      const { error } = await db.from("users").delete().eq("id", userId);
      throwOnError(error, "deleteUser");
    },

    async linkAccount(account) {
      const { error } = await db.from("accounts").insert({
        user_id: account.userId,
        type: account.type,
        provider: account.provider,
        provider_account_id: account.providerAccountId,
        refresh_token: account.refresh_token,
        access_token: account.access_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
        session_state: account.session_state,
      });

      throwOnError(error, "linkAccount");
    },

    async unlinkAccount({ providerAccountId, provider }) {
      const { error } = await db
        .from("accounts")
        .delete()
        .eq("provider", provider)
        .eq("provider_account_id", providerAccountId);

      throwOnError(error, "unlinkAccount");
    },

    async createSession(session: AdapterSession) {
      const { data, error } = await db
        .from("sessions")
        .insert({
          session_token: session.sessionToken,
          user_id: session.userId,
          expires: session.expires,
        })
        .select()
        .single();

      throwOnError(error, "createSession");

      return {
        sessionToken: data.session_token as string,
        userId: data.user_id as string,
        expires: new Date(data.expires as string),
      };
    },

    async getSessionAndUser(sessionToken) {
      const { data: session, error: sessionError } = await db
        .from("sessions")
        .select()
        .eq("session_token", sessionToken)
        .maybeSingle();

      throwOnError(sessionError, "getSessionAndUser");

      if (!session) return null;

      const { data: user, error: userError } = await db
        .from("users")
        .select()
        .eq("id", session.user_id)
        .maybeSingle();

      throwOnError(userError, "getSessionAndUser");
      if (!user) return null;

      return {
        session: {
          sessionToken: session.session_token as string,
          userId: session.user_id as string,
          expires: new Date(session.expires as string),
        },
        user: toUser(user),
      };
    },

    async updateSession(session: AdapterSession) {
      const { data, error } = await db
        .from("sessions")
        .update({ expires: session.expires })
        .eq("session_token", session.sessionToken)
        .select()
        .single();

      throwOnError(error, "updateSession");

      return {
        sessionToken: data.session_token as string,
        userId: data.user_id as string,
        expires: new Date(data.expires as string),
      };
    },

    async deleteSession(sessionToken) {
      const { error } = await db.from("sessions").delete().eq("session_token", sessionToken);
      throwOnError(error, "deleteSession");
    },
  };
}
