# Naija Gadget Store

A complete shop, built for a bootcamp brief:

| Requirement | How it is done |
|---|---|
| Website for a shop | Next.js 16 (App Router) + TypeScript + Tailwind |
| Checkout page | Cart, address form, and a test payment page |
| Database | Supabase Postgres - products, orders, order items, users |
| Confirmation emails | Mailgun, via Nodemailer over SMTP |
| Google auth | Auth.js with the Google provider, sessions in Supabase |

Payment is a **dummy gateway**: a page of our own that looks like a bank's
checkout and marks the order paid. No card details, no keys, no real money.
Swapping in Paystack or Flutterwave later touches one file - see
[Payments](#payments).

---

## Contents

1. [Run it right now (no accounts needed)](#1-run-it-right-now-no-accounts-needed)
2. [Get your keys](#2-get-your-keys) - the part you need to do yourself
3. [How a checkout actually flows](#3-how-a-checkout-actually-flows)
4. [Project layout](#4-project-layout)
5. [Commands](#5-commands)
6. [Things worth knowing](#6-things-worth-knowing)
7. [Payments](#7-payments)
8. [Troubleshooting](#8-troubleshooting)
9. [Deploying](#9-deploying)

---

## 1. Run it right now (no accounts needed)

The app boots without any API keys. Products come from `src/lib/catalog.ts`,
and orders are saved only if Supabase is connected - but you can still click all
the way through the payment page. This is on purpose: you can see the whole site
working before you spend 40 minutes on three signup forms.

```bash
cd shop
npm install
npm run dev
```

Open <http://localhost:3000>.

The footer shows which integrations are live. Right now all three will be greyed
out - they tick green as you paste each key in.

---

## 2. Get your keys

Copy the example file first:

```bash
cp .env.example .env.local     # Windows PowerShell:  Copy-Item .env.example .env.local
```

Then fill in the blanks below. **Restart `npm run dev` after every edit** -
Next.js only reads env vars at startup.

You only need **three**. Payment needs nothing.

### 1. Supabase (the database)

1. Go to <https://supabase.com/dashboard> and create an account.
2. **New project.** Pick a name, invent a strong database password and keep it
   somewhere safe, choose the region nearest you.
3. Wait about two minutes while it provisions.
4. **Project Settings > Data API.** Copy:
   - **Project URL** -> `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role** key -> `SUPABASE_SERVICE_ROLE_KEY`
5. Create the tables: **SQL Editor > New query**. Open `supabase/schema.sql`,
   paste the whole file, press **Run**.
6. Repeat with `supabase/seed.sql` to load the ten demo products.

You can check your work by visiting your project -> **Table Editor**. You should
see `products` with ten rows.

> **The `service_role` key is a master key.** It bypasses Row Level Security and
> can read and delete anything. It is only ever used on the server, never
> shipped to a browser. Never paste it into a file that gets committed.
> `.env.local` is already in `.gitignore`.

### 2. Mailgun (the emails)

1. Go to <https://signup.mailgun.com> and sign up with an email you can open.
2. Verify your email address using the link they send.
3. **Sending > API keys.** Click **Create key**, choose a name, copy the key
   (`key-...`) -> `MAILGUN_API_KEY`.
4. Your sending domain is on the same page. On a brand-new account it is
   `sandbox.mailgun.org` -> `MAILGUN_DOMAIN`.

**Important:** the sandbox domain can only send to the one email address you
registered with. If you want to send to any address, add a real domain:
**Sending > Domains > Add Domain**, then add the DNS records Mailgun gives you
at your DNS provider. That can take up to an hour to verify.

`MAIL_FROM` must use your sending domain:

```
MAIL_FROM="Naija Gadget Store <no-reply@sandbox.mailgun.org>"
```

### 3. Google Cloud (sign in with Google)

1. Go to <https://console.cloud.google.com>.
2. **Create a project** at the top. Name it anything. Note the project ID.
3. With the project selected, open the menu (hamburger) ->
   **APIs & Services -> OAuth consent screen**.
4. Choose **External**. Fill in app name and support email, and enter your own
   email under **Developer contact information**. Save.
5. While it is in "Testing" mode, add your Google account under **Test users**.
   Until you do this, sign-in fails with `access_denied`.
6. **APIs & Services -> Credentials -> Create Credentials -> OAuth client ID**.
7. Choose **Web application** and fill in:
   - **Name**: anything
   - **Authorized JavaScript origins**: `http://localhost:3000`
   - **Authorized redirect URIs**: `http://localhost:3000/api/auth/callback/google`
8. Copy **Client ID** -> `AUTH_GOOGLE_ID` and **Client secret** ->
   `AUTH_GOOGLE_SECRET`.
9. Generate a signing secret:

   ```bash
   npx auth secret
   ```

   Paste the output into `AUTH_SECRET`.

> The redirect URI has to match **exactly** - `http`, not `https`; trailing
> slash or not; the port included. A mismatch here is the single most common
> reason Google sign-in returns `redirect_uri_mismatch`.

---

## 3. How a checkout actually flows

Worth understanding, because it is where most of the real work is.

```
 1. Customer adds to cart
        |
        |  written to localStorage, not the database
        v
 2. POST /api/checkout
        |
        |  - validates the input (Zod)
        |  - RE-CALCULATES every price from the database
        |  - inserts an order with status = 'pending'
        v
 3. Browser is redirected to /checkout/pay
        |
        |  the test payment page: shows the total and a Pay button
        v
 4. POST /api/checkout/verify
        |
        |  - confirms the payment with the gateway
        |  - flips the order to 'paid', stamps paid_at
        |  - decrements stock
        |  - sends the confirmation email via Mailgun
        v
 5. Browser lands on /checkout/success?reference=NAI-XXXX
```

**Why the order is saved as 'pending' first.** Creating an order and taking
money for it are different events. Keeping them apart means an order abandoned
at the payment page sits as 'pending' and can be cleaned up later, instead of
looking like a sale that never got paid.

**Why the server recalculates prices.** The browser sends only product ids and
quantities. It never sends an amount. If the server believed an amount from the
client, anyone could edit a request in devtools and pay ₦1 for a ₦50,000 order.
`src/lib/orders.ts` says so at the top.

**Why step 4 confirms with the gateway.** Because the payment page is just a URL
- anyone can call `/api/checkout/verify` by hand. With a real gateway the only
trustworthy source is that gateway's own API. See [Payments](#7-payments).

---

## 4. Project layout

```
shop/
├─ .env.example              every key, documented
├─ supabase/
│  ├─ schema.sql             tables, indexes, RLS, decrement_stock()
│  └─ seed.sql               the 10 demo products
├─ scripts/
│  └─ smoke.mjs              16 checks against a running server
└─ src/
   ├─ lib/
   │  ├─ env.ts              reads config; decides what is switched on
   │  ├─ supabase.ts         server-side database client
   │  ├─ catalog.ts          demo products (fallback + seed source)
   │  ├─ products.ts         product queries
   │  ├─ orders.ts           create / settle / list orders
   │  ├─ payment.ts          the gateway - the only payment-aware file
   │  ├─ mail.ts             Mailgun + the HTML receipt
   │  ├─ money.ts            Kobo <-> Naira
   │  └─ auth.ts             Auth.js / Google
   ├─ components/
   │  ├─ cart/
   │  │  ├─ cartStore.ts     localStorage as an external store
   │  │  ├─ CartProvider.tsx React context over that store
   │  │  └─ types.ts
   │  ├─ ProductCard.tsx     server component
   │  ├─ AddToCartButton.tsx client component
   │  ├─ SiteHeader.tsx      cart badge + account menu
   │  └─ SiteFooter.tsx      integration status panel
   └─ app/
      ├─ page.tsx                  the shop
      ├─ products/[slug]/page.tsx  one product
      ├─ cart/page.tsx
      ├─ checkout/page.tsx         + CheckoutForm.tsx
      ├─ checkout/pay/             the test payment page + PayButton.tsx
      ├─ checkout/success/page.tsx receipt
      ├─ orders/page.tsx           history, scoped to the signed-in user
      ├─ actions.ts                server action for sign-out
      └─ api/
         ├─ checkout/route.ts          create order as 'pending'
         ├─ checkout/verify/route.ts   confirm payment, settle, email
         └─ auth/[...nextauth]/route.ts  Auth.js
```

---

## 5. Commands

```bash
npm run dev        # start the dev server
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run smoke      # 16 checks against a running server (needs `npm run dev`)
```

`npm run smoke` is the quickest way to check nothing is broken after a change:

```
Pages
  PASS  GET / renders  (status 200)
  PASS  GET / lists products  (found the catalogue)
  ...
All good: 19 passed, 0 failed
```

---

## 6. Things worth knowing

**Money is stored as an integer number of Kobo.** ₦2,850.00 is `2850000`.
Never store money as a float - `19.99 * 100` is not reliably `1999` in
JavaScript, and that drift becomes a customer complaint.

**Stock cannot go negative.** `decrement_stock()` in `schema.sql` subtracts
inside the database, so two people buying the last unit cannot both succeed.
Doing that subtraction in JavaScript instead would be a read-modify-write race.

**Line items snapshot the product name and price.** Repricing a product later
does not rewrite what someone was already charged.

**Secrets stay on the server.** Every database call goes through
`src/lib/supabase.ts`, which imports `server-only`. If a client component ever
imports it, the build fails rather than leaking your service-role key.

**Row Level Security is on with no public policies.** All access uses the
service-role key, which bypasses RLS. If you ever add a browser-side client
with the anon key, the default is deny - which is the right default.

**Next.js 16 specifics.** `params` and `searchParams` are Promises and must be
awaited. Pages that must vary per request call `await connection()` to opt out
of prerendering (`/` and `/orders` both do, because stock changes and orders
are per-user). `middleware.ts` is now `proxy.ts`.

**The payment page refuses to charge twice.** `/checkout/pay` shows an "Already
paid" receipt if the order is settled, so a refresh cannot double-charge.

---

## 7. Payments

There is no payment provider. `/checkout/pay` is our own page and its Pay button
posts to `/api/checkout/verify`, which marks the order paid.

All gateway knowledge lives in **`src/lib/payment.ts`**, which exposes just two
functions:

```ts
startPayment(input)   // -> { redirectTo, reference, provider }
verifyPayment(ref)    // -> { paid, amount?, provider, reference }
```

To add a real gateway, rewrite those two. Nothing else changes.

**Paystack**

```ts
// start
POST https://api.paystack.co/transaction/initialize
Authorization: Bearer <SECRET_KEY>
{ email, amount, currency: "NGN", reference, callback_url: "<your site>/api/checkout/verify?reference=..." }
-> { data: { authorization_url } }     redirect the customer there

// verify
GET https://api.paystack.co/transaction/verify/<reference>
Authorization: Bearer <SECRET_KEY>
-> { data: { status: "success", amount } }
```

Test card: `4084 0840 8408 4081`, any future expiry, any CVV, PIN `0000`,
OTP `000000`. Use the `sk_test_` secret key.

**Flutterwave**

```ts
POST https://api.flutterwave.com/v3/payments
Authorization: Bearer FLWSECK_TEST-<key>
{ tx_ref, amount, currency: "NGN", redirect_url, customer: { email_address, name } }
-> { data: { link } }

GET https://api.flutterwave.com/v3/transactions/<tx_ref>
-> { data: { status: "successful", amount } }
```

> **The trap:** Paystack quotes amounts in **Kobo**, Flutterwave quotes them in
> **Naira**. Send the wrong one and ₦2,500.00 becomes ₦250 or ₦250,000 - and
> ₦2,500.00 looks perfectly plausible as `2500`, so it will not look obviously
> broken.

**The two things a real `verifyPayment` must do that the dummy one skips:**

1. **Ask the gateway, do not trust the redirect.** Anyone can POST to
   `/api/checkout/verify` with any reference.
2. **Compare the amount.** Without this, someone starts a ₦50,000 order, pays
   ₦1, and then calls the verify endpoint to collect the goods.

Both are marked with comments in `src/lib/payment.ts` and in
`src/app/api/checkout/verify/route.ts`.

---

## 8. Troubleshooting

**`node` is not recognised as a command**
Node is installed through *fnm* but is not on your PATH. Open PowerShell and
check that `~/Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1`
calls `fnm env`. Then close and reopen the terminal.

**Edits are not showing up / the dev server throws about `package.json`**
Do not keep a Next.js project inside OneDrive. OneDrive's file-watching and
partial-file behaviour reliably breaks Turbopack. Move the `shop` folder to
something like `C:\dev\shop`.

Related trap: in **Windows PowerShell 5.1**, `Set-Content -Encoding UTF8` and
`Out-File -Encoding UTF8` write a byte-order mark, which makes JSON files
unparseable. If a config file suddenly "is not valid JSON", check for a BOM.
`node -e "console.log(require('fs').readFileSync('package.json')[0])"` should
print `123` (`{`), not `239`.

**Google sign-in returns `redirect_uri_mismatch`**
The URI in Google Cloud Console must be
`http://localhost:3000/api/auth/callback/google`, character for character.

**Google sign-in returns `access_denied`**
Add your Google account under **OAuth consent screen > Test users**.

**Mailgun says the recipient is not allowed**
That is the sandbox domain restricting you to your own email. Add a verified
domain, or just send to the address you signed up with.

**The payment page says "Order not found"**
The `reference` in the URL does not match an order. Start again from the cart.

**The footer shows an integration as not configured**
Env vars are read at startup. Stop and restart `npm run dev` after editing
`.env.local`.

---

## 9. Deploying

Any host that runs Next.js works. The only environment-specific change is the
Google redirect URI, which must use your real domain:

```
https://your-domain.com/api/auth/callback/google
```

and the matching JS origin `https://your-domain.com`. Also set `AUTH_URL` to
your deployed origin, so links built at runtime point at the right place.

Remember: `.env.local` is ignored by git, so deploys need the keys pasted into
your host's environment variable settings rather than a file.

---

## Licence

Bootcamp project. The payment page is a test gateway - no card details are
collected and no money moves.
