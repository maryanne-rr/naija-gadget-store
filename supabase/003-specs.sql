-- ============================================================================
--  Product specification fields
--
--  Run this ONCE in the Supabase SQL Editor, then `npm run seed`.
--
--  Dashboard -> SQL Editor -> New query -> paste -> Run.
--
--  WHY THESE LIVE ON products RATHER THAN IN A TABLE
--  brand / spec / specs are properties of the product, not of anything shared.
--  Two power banks have two different specs. A "specifications" table would
--  mean a second row per product plus a join on every card render, to store
--  three short strings that will never be shared or normalised.
--
--  WHY THE COLUMN IS CALLED spec AND IS A STRING
--  The whole point is that the customer compares across products that do not
--  share a measurement. 20,000 mAh, 40 hours and 60W are not comparable to each
--  other, so a numeric column with a single unit would be wrong. What is stored
--  is the figure and its unit as one short display string, because that is
--  exactly what is compared - and it is written for humans, never parsed.
-- ============================================================================

alter table products add column if not exists brand text;
alter table products add column if not exists spec  text;

-- specs is an array of the secondary figures, shown as chips on the product
-- page. text[] rather than jsonb because Postgres arrays are the right tool for
-- a flat list of strings, and jsonb would make the shape part of the contract
-- without buying anything.
alter table products add column if not exists specs text[] not null default '{}';

-- Backfill so existing rows are not NULL, which would render as a blank chip.
update products set specs = '{}' where specs is null;

-- Re-grant: a column added by ALTER does not inherit the table grant on every
-- existing project, and PostgREST then answers
--     42703  column products.brand does not exist
-- which reads like the column is missing when it is a permissions problem.
grant select, insert, update, delete on products to service_role;