import "next-auth";

/**
 * Tell TypeScript that `session.user` has an `id`.
 *
 * By default Auth.js types the session user as name/email/image only, because
 * the shape depends on the session strategy. Since we always know the id, we
 * declare it here rather than casting every time we use it.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
