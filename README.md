# Naija Gadget Store

A complete shop, built for a bootcamp brief:

| Requirement | How it is done |
|---|---|
| Website for a shop | Next.js 16 (App Router) + TypeScript + Tailwind |
| Checkout page | Cart, address form, and a payment step |
| Database | Supabase Postgres - products, orders, order items, users |
| Confirmation emails | Mailgun, via Nodemailer over SMTP |
| Google auth | Auth.js with the Google provider, sessions in Supabase |

Payments go through **Paystack in test mode**. No real money moves.

---

## Contents

1. [Run it right now (no accounts needed)](#1-run-it-right-now-no-accounts-needed)
2. [Get your keys](#2-get-your-keys) - the part you need to do yourself
3. [How a checkout actually flows](#3-how-a-checkout-actually-flows)
4. [Project layout](#4-project-layout)
5. [Commands](#5-commands)
6. [Things worth knowing](#6-things-worth-knowing)
7. [Troubleshooting](#7-troubleshooting)
8. [Deploying](#8-deploying)

---

## 1. Run it right now (no accounts needed)

The app boots without any API keys. Products come from `src/lib/catalog.ts`,
and the checkout settles orders through a simulated gateway. This is on purpose:
you can see the whole site working before you spend 40 minutes on four signup
forms.

```bash
cd shop
npm install
npm run dev
```

Open <http://localhost:3000>.

The footer shows which integrations are live. Right now all four will be greyed
out - they tick green as you paste each key in.

---

## 2. Get your keys

Copy the example file first:

```bash
cp .env.example .env.local     # Windows PowerShell:  Copy-Item .env.example .env.local
```

Then fill in the blanks below. **Restart `npm run dev` after every edit** -
Next.js only reads env vars at startup.

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

### 4. Paystack (payments, test mode)

1. Go to <https://dashboard.paystack.com> and register.
2. Once in, open **Settings -> API Keys & Settings**.
3. Click **Reveal** next to the **Secret key** in the TEST section. Copy the
   `sk_test_...` value -> `PAYSTACK_SECRET_KEY`.

Test card to use when paying:

| Field | Value |
|---|---|
| Card number | `4084 0840 8408 4081` |
| Expiry | any future date |
| CVV | any 3 digits |
| PIN | `0000` |
| OTP | `000000` |

A real Paystack account is not needed if you leave this key out - checkout just
runs in simulated mode instead.

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
        |  - asks Paystack to create a transaction
        v
 3. Browser is redirected to Paystack's hosted page
        |
        |  the customer pays with a test card
        v
 4. Paystack redirects back to /api/checkout/verify?reference=NAI-XXXX
        |
        |  - asks Paystack what actually happened
        |  - checks the amount matches the order total   <-- important
        |  - flips the order to 'paid', stamps paid_at
        |  - decrements stock
        |  - sends the confirmation email via Mailgun
        v
 5. Browser lands on /checkout/success?reference=NAI-XXXX
```

**Why the server recalculates prices.** The browser sends only product ids and
quantities. It never sends an amount. If the server believed an amount from the
client, anyone could edit a request in devtools and pay ₦1 for a ₦50,000 order.
`src/lib/orders.ts` says so at the top.

**Why step 4 re-checks with Paystack.** Because the redirect URL is just a link -
anyone can type `/api/checkout/verify?reference=whatever` by hand. The only
trustworthy source is Paystack's own API.

**Why the amount is compared.** A customer could start an expensive order, pay
one nara, then hit the verify URL by hand. Comparing what Paystack actually
received against our order total is what stops that.

Without `PAYSTACK_SECRET_KEY`, steps 3 and 4 collapse into the simulated branch,
which settles the order immediately. Everything else - the database write, the
stock decrement, the email - is identical.

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
   │  ├─ paystack.ts         payment gateway - the only Paystack-aware file
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
      ├─ checkout/success/page.tsx receipt
      ├─ orders/page.tsx           history, scoped to the signed-in user
      ├─ actions.ts                server action for sign-out
      └─ api/
         ├─ checkout/route.ts       create order, start payment
         ├─ checkout/verify/route.ts  confirm payment
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
All good: 16 passed, 0 failed
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

---

## 7. Troubleshooting

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

**Paystack says the amount is wrong**
It expects Kobo as an integer. `PAYSTACK_SECRET_KEY` from the TEST section is
required; the live key is refused by test transactions.

**Mailgun says the recipient is not allowed**
That is the sandbox domain restricting you to your own email. Add a verified
domain, or just send to the address you signed up with.

**The footer shows an integration as not configured**
Env vars are read at startup. Stop and restart `npm run dev` after editing
`.env.local`.

---

## 8. Deploying

Any host that runs Next.js works. The only environment-specific change is the
Google redirect URI, which must use your real domain:

```
https://your-domain.com/api/auth/callback/google
```

and the matching JS origin `https://your-domain.com`. Also set `AUTH_URL` to
your deployed origin so Paystack sends people to the right place.

Remember: `.env.local` is ignored by git, so deploys need the keys pasted into
your host's environment variable settings rather than a file.

---

## Licence

Bootcamp project. Test mode only.
