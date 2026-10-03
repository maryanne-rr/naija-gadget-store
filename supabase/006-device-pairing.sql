-- ============================================================================
--  Device pairing
--
--  Run this ONCE in the Supabase SQL Editor.
--
--  Dashboard -> SQL Editor -> New query -> paste -> Run.
--
--  WHY A CODE INSTEAD OF GOOGLE SIGN-IN INSIDE THE APP
--  The obvious design is for the app to run Google OAuth itself. In a real
--  native app that is correct and takes one redirect URI.
--
--  Inside Expo Go it is not available. Expo Go can only be opened through
--  Expo's own proxy (https://auth.expo.io/@you/your-slug), because the custom
--  scheme a standalone build would register - naija://callback - is not the
--  scheme Expo Go listens on. So the redirect URI Google would have to be told
--  about depends on the Expo account name and the project slug, which are not
--  known until somebody runs `npx expo start`, and which change if either does.
--  Registering that URL is possible but fragile, and a mismatch presents as
--  "sign in silently does nothing" on a phone.
--
--  Device pairing sidesteps it completely and is what real products do when a
--  second device has to join an existing web account: the user approves the
--  device in a browser they are already signed in to. GitHub CLI, `gh`, and
--  every smart-TV sign-in flow work this way.
--
--  The property that matters for this project: the approval happens through the
--  WEBSITE's own Auth.js session, so the account is identified by the same
--  session, in the same users table, as a normal website sign-in. "Same account
--  on both" is therefore structural rather than something we hope matches.
--
--  WHY THERE IS A claim_hash AND NOT JUST A CODE
--  The code is displayed on the phone and typed into a browser. It is therefore
--  public - anyone standing behind the person can read it off the screen, and
--  eight characters is a small space to guess.
--
--  So the code only names the pairing. The right to claim it belongs to whoever
--  generated a random secret that never leaves the phone: the app sends
--  sha256(secret) when it creates the pairing, and sends the plaintext secret
--  when it polls. The server hashes and compares. Reading this table - or
--  guessing the code - is not enough to steal the session.
-- ============================================================================

create table if not exists device_pairs (
  id          uuid primary key default gen_random_uuid(),

  -- Short, human-typed, and drawn from an alphabet with no 0/O/1/I in it.
  -- "B0OI" read aloud is genuinely ambiguous, and a mistyped code that the
  -- server rejects as "wrong code" instead of "expired" wastes the user's time.
  code        text not null unique,

  -- sha256 hex of the secret the phone generated and kept to itself.
  -- See the note above for why the code alone is not enough.
  claim_hash  text not null,

  -- pending  -> waiting for somebody to approve it in a browser
  -- approved -> a user is bound; the phone can redeem it once
  -- denied   -> somebody refused it
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'denied')),

  -- Set when approved. The device's bearer token is minted from this, so this
  -- column is what makes the two clients the same account.
  user_id     uuid references users (id) on delete cascade,

  created_at  timestamptz not null default now(),

  -- Fifteen minutes. Long enough to read a code off a phone and type it into a
  -- laptop, short enough that an abandoned pairing is not sitting in the table
  -- for a marker to find later.
  expires_at  timestamptz not null default (now() + interval '15 minutes'),

  -- When the phone collected its token. A pairing is good for exactly one
  -- redemption, so a code captured in a screenshot stops being useful the moment
  -- the legitimate device claims it.
  redeemed_at timestamptz
);

-- The app polls by code, so that lookup is on the hot path.
create index if not exists device_pairs_code_idx on device_pairs (code);

-- ============================================================================
--  Row Level Security
--
--  Enabled with no policies, so DENY BY DEFAULT. All access goes through the
--  server with the service-role key, which bypasses RLS. This table holds
--  pending sessions, so the default posture should be closed.
-- ============================================================================
alter table device_pairs enable row level security;
