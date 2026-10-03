# Naija Gadgets — mobile app

The phone app for the shop in the parent directory. Same API, same account, same
cart.

## What it uses

Every read and write goes to the website's own API. There is no second database
and no Supabase key in this app.

| Call | Endpoint |
|---|---|
| Catalogue | `GET /api/products` |
| The basket | `GET /api/cart` |
| Add / set quantity | `POST /api/cart` |
| Start sign-in | `POST /api/mobile/pair` |
| Collect the token | `GET /api/mobile/pair/<code>` |

The cart is the same `cart_items` rows the website reads. Two devices showing the
cart move together because there is only one set of numbers.

## Running it

```bash
cd mobile
npm install
npx expo start
```

Then scan the QR code with **Expo Go** on your phone. Expo Go has to be installed
first — it is on the App Store and Google Play.

The app points at `https://naija-gadget-store.vercel.app` by default. To use a
local server instead:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.5:3000 npx expo start
```

`localhost` will not work — on a phone that means the phone, not your laptop. Use
the machine's LAN address, which `expo start` prints.

## Signing in

The app does not run Google OAuth itself. Expo Go can only be opened through
Expo's proxy URL, so the redirect URI Google would need is one that does not exist
until `expo start` has run, and changes if the Expo account or slug changes.

Instead it pairs:

1. The app asks for a code and shows it — e.g. `KX7M 92QB`.
2. Open <https://naija-gadget-store.vercel.app/pair/KX7M-92QB> on any browser.
3. Sign in with the **same Google account as the website**.
4. Press **Connect this device**.
5. The app notices within about two seconds.

The approval runs through the website's own Auth.js session, so the phone gets a
token for the same `users.id` — which is the same cart. Codes last 15 minutes and
work once.

You can also tap the code on the phone to open the link directly, or press "Copy
the code instead" and paste it on a laptop.

## Testing the sync

The requirement is that an item added on the website appears in the app.

1. Sign in on **both**, with the same Google account.
2. On the website, add something to the cart.
3. In the app, open the **Cart** tab.

It is there within five seconds. The reverse works identically: add in the app and
the website's cart updates on its next refresh.

Each product row in the app shows `In cart: n`, which is the quickest way to see
the two agree without opening the cart.

## Where the token lives

`expo-secure-store`, which is the iOS keychain and Android's encrypted shared
preferences. Not `AsyncStorage`, which is a plain unencrypted file — the token is
a live credential for the cart.

## Layout

```
App.tsx                 session, cart polling, the two tabs
src/api.ts              every call to the shop
src/storage.ts          the token, and the pairing secret
src/config.ts           which server to talk to, poll intervals
src/format.ts           naira, as integer Kobo (copied, not imported)
src/theme.ts            colours from the website's tokens
src/screens/            SignIn, Shop, Cart
```
