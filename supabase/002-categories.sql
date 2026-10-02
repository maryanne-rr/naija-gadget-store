-- ============================================================================
--  Add the product category column
--
--  Run this ONCE in the Supabase SQL Editor, then run `npm run seed`.
--
--  Dashboard -> SQL Editor -> New query -> paste -> Run.
--
--  WHY THERE IS NO categories TABLE
--  The obvious design is a categories table with a foreign key. It is the wrong
--  one here. The category of a product is a property of that product: if it
--  lives elsewhere then every product read needs a join to turn a slug into a
--  name, and there is a second thing that can drift out of sync with the
--  products. That is the whole class of bug this schema is built to avoid -
--  see the money column (integer Kobo, never a float) and the order_items
--  snapshot, which are the same idea applied twice already.
--
--  So the category is a slug on the product row, and the list of categories -
--  names, blurbs, display order - lives in src/lib/catalog.ts beside the code
--  that renders it.
--
--  The thing a foreign key would have guaranteed is that no product can name a
--  category that does not exist. scripts/check-categories.mjs is the substitute:
--  it fails if that happens, and it also compares the live database against the
--  catalogue so an un-re-seeded database is caught too. Run it with:
--
--      npm run check:categories
--
--  All three statements are idempotent, so running this twice is harmless.
-- ============================================================================

-- 1. The column. "if not exists" so re-running does not error. Products that
--    already exist get null, which the app treats as uncategorised rather than
--    as an error - it would otherwise break the live shop mid-migration.
alter table products add column if not exists category text;

-- 2. The index. /category/[slug] filters on exactly this column.
create index if not exists products_category_idx on products (category);

-- 3. The grant. A column added by ALTER does not inherit the table-level grant on
--    every existing project, and PostgREST then answers:
--        42703  column products.category does not exist
--    which reads like the column is missing when it is actually a permissions
--    problem. Re-granting makes the fix work either way.
grant select, insert, update, delete on products to service_role;