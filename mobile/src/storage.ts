import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

/**
 * Keeping the session on the device.
 *
 * WHY SECURE STORE AND NOT AsyncStorage
 * The bearer token in here is a live credential: anyone holding it can read and
 * change the signed-in person's cart. AsyncStorage is a plain unencrypted file in
 * the app's private directory, which on a rooted or backed-up device is readable.
 * SecureStore puts it in the iOS keychain and the Android Keystore-backed
 * encrypted shared preferences.
 *
 * Nothing here is ever logged. A console.log of a token is a token in someone's
 * screenshot.
 */

const TOKEN_KEY = "naija.session.token";
const EMAIL_KEY = "naija.session.email";
const CLAIM_KEY = "naija.pair.claim";

export async function saveSession(token: string, email: string | null): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (email) {
    await SecureStore.setItemAsync(EMAIL_KEY, email);
  }
}

export async function readToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    // A corrupt keychain entry should sign the person out, not crash the app on
    // launch.
    return null;
  }
}

export async function readEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(EMAIL_KEY);
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
}

/**
 * The secret that proves this device is the one that asked to be paired.
 *
 * It has to survive the app being closed, because pairing takes two steps that
 * usually involve putting the phone down and opening a laptop. Generating a fresh
 * one on every launch would orphan any code still showing on screen.
 *
 * The plaintext never leaves the phone. Only its SHA-256 goes to the server, so
 * neither the database nor the pairing endpoint holds anything that could be used
 * to impersonate this device later. See supabase/006-device-pairing.sql.
 */
export async function readOrCreateClaimSecret(): Promise<string> {
  const existing = await SecureStore.getItemAsync(CLAIM_KEY);
  if (existing) return existing;

  const bytes = await Crypto.getRandomBytesAsync(32);
  // base64url: safe in a header, and no "+" or "/" to mangle.
  const secret = bytesToBase64Url(bytes);

  await SecureStore.setItemAsync(CLAIM_KEY, secret);
  return secret;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * base64url, by hand.
 *
 * React Native has no Buffer, and atob/btoa are not available everywhere, so
 * this is a few lines of arithmetic rather than a dependency. It only has to
 * handle bytes from Crypto.getRandomBytesAsync, which is exactly 0-255.
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  let out = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];

    out += BASE64[b0 >> 2];
    out += BASE64[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : BASE64[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : BASE64[b2 & 0x3f];
  }

  // The server hashes the string it is given, so it only has to be a faithful
  // encoding - not reversible. Padding is dropped for the same reason.
  return out.replace(/=+$/, "");
}
