-- ============================================================================
--  Discounts
--
--  Run this ONCE in the Supabase SQL Editor, then `npm run seed`.
--
--  Dashboard -> SQL Editor -> New query -> paste -> Run.
--
--  WHAT THESE COLUMNS DO NOT DO
--  They are display only. compare_at_price is what the customer sees struck
--  through, next to the price they actually pay. It is never added to a total,
--  never sent to a payment gateway, and never read by createOrder(). The amount
--  charged is always products.price, computed server-side.
--
--  That separation is the whole point of putting them in their own columns
--  rather than deriving a "sale price" from one number. If a discount were
--  stored as `price` plus a `discount_percent`, then the two could disagree,
--  and the arithmetic would decide what a customer is billed. Here there is only
--  one authoritative number and one decorative one.
-- ============================================================================

-- The price before the discount. Nullable: null means "not on offer".
alter table products add column if not exists compare_at_price integer;

-- Eligible for the deal-of-the-day rotation. A separate flag from
-- compare_at_price because a product can be permanently reduced and still not
-- be today's headline - "reduced" and "deal of the day" are different claims.
alter table products add column if not exists deal boolean not null default false;

-- The constraint is the important line in this file.
--
-- A was-price that is not above the current price produces a badge reading
-- "Save 0%", or worse a struck-through figure lower than the price beside it.
-- Either one teaches shoppers that the badge means nothing, and then the real
-- discounts stop working. The database refuses to store it, so the mistake
-- cannot be made by hand-editing a row either.
--
-- Written as a table constraint rather than a CHECK in the column definition so
-- it also applies to UPDATE: promoting a product back to full price without
-- clearing its was-price would otherwise be allowed.
--
-- Postgres treats a CHECK as passing when it evaluates to NULL, and NULL
-- compare_at_price means "not on offer", so the IS NOT NULL guard is required.
-- Without it the constraint would be silently inert for every product that is
-- not discounted.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_compare_at_above_price'
  ) then
    alter table products
      add constraint products_compare_at_above_price
      check (compare_at_price is null or compare_at_price > price);
  end if;
end $$;

create index if not exists products_deal_idx on products (deal) where deal;

-- Re-grant: a column added by ALTER does not inherit the table grant on every
-- existing project, and PostgREST then answers
--     42703  column products.compare_at_price does not exist
-- which reads like the column is missing when it is a permissions problem.
grant select, insert, update, delete on products to service_role;