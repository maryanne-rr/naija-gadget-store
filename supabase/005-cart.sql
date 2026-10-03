-- ============================================================================
--  Server-side cart
--
--  Run this ONCE in the Supabase SQL Editor.
--
--  Dashboard -> SQL Editor -> New query -> paste -> Run.
--
--  WHY THIS TABLE EXISTS
--  The cart used to live in the browser's localStorage. That is a fine place for
--  a basket and a terrible place for one, because localStorage is scoped to one
--  browser profile on one device. A phone and a laptop have two separate, wholly
--  unrelated localStorage stores. There is no mechanism by which an item added on
--  the website could ever appear on the phone - the two have never heard of each
--  other.
--
--  So "the same cart on the website and the phone" is not a feature that can be
--  added on top of localStorage. It requires the cart to exist somewhere both
--  devices can reach, and the only somewhere they share is the database.
--
--  WHAT CHANGES FOR CUSTOMERS
--  Signed-in shoppers get a server cart that follows them between devices. Guest
--  shoppers keep exactly the localStorage basket they had, because a basket
--  belongs to someone who may never sign in, and an abandoned basket is not an
--  order. Nothing about guest checkout changes.
--
--  WHY (user_id, product_id) IS THE PRIMARY KEY
--  It makes "add this product" idempotent in the only way that matters: one row
--  per product per person. Adding the same item twice must increase the quantity
--  of one row, never create a second row, or the cart would grow duplicates
--  every time somebody tapped the button twice.
-- ============================================================================

create table if not exists cart_items (
  -- The shopper. on delete cascade: when an account row goes, so does its cart,
  -- and there is nothing worth keeping about a basket that belongs to nobody.
  user_id    uuid not null references users (id)   on delete cascade,
  product_id uuid not null references products (id) on delete cascade,

  quantity   integer not null default 1,

  created_at timestamptz not null default now(),
  -- Kept so "recently added" ordering survives, and so a sync can tell an
  -- update from a no-op.
  updated_at timestamptz not null default now(),

  primary key (user_id, product_id),

  -- The same bound the checkout route enforces in Zod and the +/- stepper
  -- enforces in the UI. Stated here as well so a hand-written INSERT cannot
  -- create a ten-thousand-unit line that checkout would then have to reject.
  check (quantity >= 1 and quantity <= 99)
);

-- A cart of twenty items is read on every page the header badge renders on.
create index if not exists cart_items_user_id_idx on cart_items (user_id);

-- ============================================================================
--  set_cart_quantity
--
--  Add to (or set) the quantity of one line, atomically.
--
--  WHY A FUNCTION RATHER THAN READ-MODIFY-WRITE IN JAVASCRIPT
--  "Add one more" is read quantity, add 1, write quantity. Two phones pressing
--  add at the same instant both read quantity = 1, both write 2, and one of the
--  two additions silently vanishes. The same read-modify-write race that
--  decrement_stock exists to prevent, applied to the basket.
--
--  Doing it inside Postgres makes the read and the write one indivisible step,
--  and least() caps the result at the stock on hand so the basket can never hold
--  more of something than the shop has.
--
--  p_absolute distinguishes "add this many" from "set it to exactly this many",
--  because the website's +/ - stepper wants the first and the stepper's text box
--  wants the second.
-- ============================================================================
create or replace function set_cart_quantity(
  p_user_id    uuid,
  p_product_id uuid,
  p_quantity   integer,
  p_absolute   boolean default false
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock    integer;
  v_existing integer;
  v_wanted   integer;
  v_final    integer;
begin
  -- Refuse rather than silently doing nothing on a product that does not exist.
  -- A zero-row return would leave the caller thinking the add succeeded.
  select stock into v_stock
    from products
   where id = p_product_id;

  if not found then
    raise exception 'product % does not exist', p_product_id
      using errcode = 'no_data_found';
  end if;

  if p_quantity < 1 then
    -- Setting a quantity below 1 means "remove it", which is how the stepper's
    -- minus button reaches zero. Deleting is the honest interpretation.
    delete from cart_items
     where user_id = p_user_id and product_id = p_product_id;
    return 0;
  end if;

  select quantity into v_existing
    from cart_items
   where user_id = p_user_id and product_id = p_product_id
     for update;

  if p_absolute then
    v_wanted := p_quantity;
  else
    v_wanted := coalesce(v_existing, 0) + p_quantity;
  end if;

  -- Never more than is on the shelf. A basket full of things that do not exist
  -- is worse than a small basket: it fails at checkout, which is the worst
  -- possible moment to discover it.
  v_final := least(v_wanted, greatest(v_stock, 0), 99);

  if v_final < 1 then
    delete from cart_items
     where user_id = p_user_id and product_id = p_product_id;
    return 0;
  end if;

  insert into cart_items (user_id, product_id, quantity, updated_at)
  values (p_user_id, p_product_id, v_final, now())
  on conflict (user_id, product_id) do update
     set quantity   = excluded.quantity,
         updated_at = excluded.updated_at;

  return v_final;
end;
$$;

-- The mobile app and the website both call this through PostgREST as the
-- service-role role, which bypasses RLS. Marked security definer so it keeps
-- working identically if the caller is ever an anon client instead.
revoke all on function set_cart_quantity(uuid, uuid, integer, boolean) from public;
grant execute on function set_cart_quantity(uuid, uuid, integer, boolean) to service_role;

-- ============================================================================
--  Row Level Security
--
--  Enabled and empty, which means DENY BY DEFAULT.
--
--  Every read and write in this project goes through the server using the
--  service-role key, which bypasses RLS entirely - so this costs the app
--  nothing. It is here so that if anyone later points the anon key at this
--  table from a browser, or from the mobile app, they get zero rows rather than
--  every customer's basket.
-- ============================================================================
alter table cart_items enable row level security;

-- No policies on purpose. See above.
