"use client";

import { signInWithGoogle } from "@/app/actions";

/**
 * The "Sign in with Google" button.
 *
 * It is a <form> posting to a server action rather than a link. See the comment
 * on signInWithGoogle for why an href does not work here.
 *
 * Google requires the button to carry their branding, so the mark is included
 * rather than left to a favicon.
 */

export function GoogleSignInButton({
  label = "Sign in",
  className = "",
  redirectTo,
}: {
  label?: string;
  className?: string;
  /**
   * Where to land after signing in, as a same-site path such as "/pair/KX7M-92QB".
   *
   * Omitted everywhere except the device-pairing page, which has to return the
   * visitor to the approval screen. The action validates this - see safeRedirect
   * in src/app/actions.ts - so an attacker-supplied value cannot turn the sign-in
   * into an open redirect.
   */
  redirectTo?: string;
}) {
  return (
    <form action={signInWithGoogle}>
      {redirectTo ? <input type="hidden" name="next" value={redirectTo} /> : null}
      <button
        type="submit"
        className={`flex items-center justify-center gap-2 ${className}`}
      >
        <GoogleMark />
        {label}
      </button>
    </form>
  );
}

export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z"
      />
    </svg>
  );
}
