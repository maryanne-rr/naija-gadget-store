-- ============================================================================
--  Naija Gadget Store - database schema
--  PostgreSQL (Supabase)
--
--  HOW TO RUN
--  1. Open https://supabase.com/dashboard and pick your project
--  2. Left sidebar -> "SQL Editor" -> "New query"
--  3. Paste this whole file in, press Run
--  4. Then do the same with seed.sql
--
--  Safe to run more than once: every statement is idempotent.
-- ============================================================================

-- ============================================================================
--  Auth.js tables
--  @auth/supabase-adapter stores Google accounts in these tables. They are
--  deliberately separate from Supabase's own auth schema, which we do not use.
-- ============================================================================

create table if not exists users (
  id             uuid primary key default gen_random_uuid(),
  name           text,
  email          text unique,
  email_verified boolean,
  image          text
);

create table if not exists accounts (
  user_id            uuid not null references users (id) on delete cascade,
  type               text not null,
  provider           text not null,
  provider_account_id text not null,
  refresh_token      text,
  access_token       text,
  expires_at         bigint,
  token_type         text,
  scope              text,
  id_token           text,
  session_state      text,
  primary key (provider_account_id)
);

create table if not exists sessions (
  session_token text primary key,
  user_id       uuid not null references users (id) on delete cascade,
  expires       timestamptz not null
);

create table if not exists verification_token (
  identifier text not null,
  token      text not null,
  expires    timestamptz not null,
  primary key (identifier, token)
);

-- ============================================================================
--  Shop tables
-- ============================================================================

create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  tagline     text not null default '',
  description text not null default '',
  -- Money is always an integer count of Kobo. 250000 means N2,500.00
  price       integer not null check (price >= 0),
  currency    text not null default 'NGN',
  image_url   text,
  emoji       text not null default '\u{1F4E6}',
  stock       integer not null default 0 check (stock >= 0),
  featured    boolean not null default false,
  -- Slug into CATEGORIES in src/lib/catalog.ts, not a foreign key.
  -- See supabase/002-categories.sql for why there is no categories table.
  category    text,
  -- Manufacturer. In this market a brand name is a trust signal, not decoration.
  brand       text not null default '',
  -- The one figure that decides the purchase: "20,000 mAh", "40 hours", "60W".
  -- A string, not a number, because 20,000mAh and 40 hours are not comparable
  -- to each other and any single numeric unit would be misleading.
  spec        text not null default '',
  -- Secondary figures, shown as chips on the product page.
  specs       text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  -- Human-friendly order number, e.g. NAI-7QK4M2X9
  reference        text unique not null,
  -- Nullable: guests can check out. Set for Google sign-in users.
  user_id          uuid references users (id) on delete set null,

  email            text not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'paid', 'failed', 'cancelled')),
  amount           integer not null check (amount >= 0),
  currency         text not null default 'NGN',

  -- Which gateway settled this order. 'dummy' is the test payment page; a real
  -- integration would write 'paystack' or 'flutterwave' here instead.
  payment_provider text not null default 'dummy',
  -- The gateway's own transaction id, once one exists.
  payment_reference text,

  shipping_name    text not null,
  shipping_phone   text,
  shipping_address text not null,
  shipping_city    text,
  shipping_state   text,

  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders (id) on delete cascade,
  -- Nullable + no cascade delete: deleting a product must not erase history.
  product_id uuid references products (id) on delete set null,
  -- Snapshot of name/price at purchase time, so old invoices stay correct even
  -- if the product is later renamed or repriced.
  name       text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity   integer not null check (quantity > 0)
);

-- ============================================================================
--  Indexes - these are the queries the app actually makes.
-- ============================================================================

create index if not exists products_featured_idx    on products (featured) where featured;
create index if not exists products_created_at_idx  on products (created_at desc);
create index if not exists products_category_idx    on products (category);
create index if not exists orders_user_id_idx       on orders (user_id, created_at desc);
create index if not exists orders_reference_idx     on orders (reference);
create index if not exists orders_status_idx        on orders (status) where status = 'pending';
create index if not exists order_items_order_id_idx on order_items (order_id);

-- ============================================================================
--  Row Level Security
--
--  Every table above has RLS switched on with no public policies. Since all
--  access goes through the server using the service-role key (which bypasses
--  RLS), the app works fine - but if you ever expose a browser client with the
--  anon key, the default is deny, not allow. Keep it that way unless you write
--  a policy on purpose.
-- ============================================================================

alter table users              enable row level security;
alter table accounts           enable row level security;
alter table sessions           enable row level security;
alter table verification_token enable row level security;
alter table products           enable row level security;
alter table orders             enable row level security;
alter table order_items        enable row level security;

-- ============================================================================
--  Grants
--
--  Tables created through the SQL Editor are NOT automatically granted to the
--  service_role. Without these, the API replies to every request with
--      42501  permission denied for table products
--  even though the table plainly exists - which reads like "my tables are
--  broken" when they are actually fine.
--
--  service_role is what the app connects with (it bypasses RLS), so it needs
--  table and function privileges.
-- ============================================================================

grant usage on schema public to service_role;

grant all on all tables  in schema public to service_role;
grant all on all routines in schema public to service_role;

-- ...and keep granting them to anything created later, so a future migration
-- does not silently break the app the same way.
alter default privileges in schema public grant all on tables  to service_role;
alter default privileges in schema public grant all on routines to service_role;

-- Keep orders.paid_at honest: flipping to 'paid' always stamps a time.
create or replace function public.mark_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.status = 'paid';
  if new.paid_at is null then
    new.paid_at = now();
  end if;
  return new;
end;
$$;

-- ============================================================================
--  decrement_stock
--
--  Called by the app when an order is paid. The subtraction happens inside the
--  database so the read and the write are one atomic step - otherwise two
--  people buying the last unit at the same moment could both succeed and you
--  would sell one more than you had.
--
--  Returns true if stock was taken, false if there was not enough left.
-- ============================================================================

create or replace function public.decrement_stock(
  p_product_id uuid,
  p_quantity   integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  if p_quantity <= 0 then
    return false;
  end if;

  -- Lock the row for the rest of the transaction, then check and write.
  update products
     set stock = stock - p_quantity
   where id = p_product_id
     and stock >= p_quantity
  returning stock into remaining;

  return found;
end;
$$;

-- Trigger: any write that lands an order in 'paid' gets a paid_at timestamp.
drop trigger if exists orders_mark_paid on orders;
create trigger orders_mark_paid
  before update on orders
  for each row
  when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.mark_order_paid();
