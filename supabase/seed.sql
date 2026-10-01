-- ============================================================================
--  Seed data - 10 demo products
--
--  Run this in Supabase > SQL Editor AFTER schema.sql.
--  Re-runnable: it upserts on slug, so you can run it again after editing.
--
--  Prices are integers in Kobo: 2850000 = N2,850.00
-- ============================================================================

insert into products (slug, name, tagline, description, price, image_url, emoji, stock, featured)
values
(
  'anker-powercore-20000',
  'Anker PowerCore 20000mAh',
  'The one battery that always fits',
  '20,000mAh of Anker PowerBank power in a slim slab that charges an iPhone four times over, or top up a 13" laptop once. Has two USB-A ports and one USB-C with 18W fast charging, plus a digital display so you always know how much juice is left. Charges fully in about six hours.',
  2850000,
  null,
  '\u{1F50B}',
  24,
  true
),
(
  'oraimo-65w-gan-charger',
  'Oraimo 65W GaN Charger',
  'One brick for laptop, phone and watch',
  'Gallium nitride means this 65W charger is roughly half the size of the brick it replaces, with enough power to charge a 13" ultrabook over USB-C. Two USB-C ports and one USB-A. Works with Nigerian outlets and international plugs, so it survives a trip.',
  1290000,
  null,
  '\u{1F50C}',
  41,
  true
),
(
  'jbl-tune-510bt',
  'JBL Tune 510BT',
  'Punchy bass, 40-hour battery',
  'On-ear wireless headphones with JBL Pure Bass sound, 40 hours of playback and a five-minute charge that buys you another three hours. Multipoint pairing means you can stay connected to your laptop and phone at the same time and switch without fussing.',
  3400000,
  null,
  '\u{1F3A7}',
  17,
  true
),
(
  'mpow-6in1-cable',
  'MPOW 6-in-1 USB-C Cable',
  'Because the charger has one port',
  'A 1.2m braided cable that splits into USB-C, Lightning, Micro-USB, USB-A and two standard USB-A ports. Genuinely the cable to keep in a draw bag when half your devices need different connectors.',
  450000,
  null,
  '\u{1F50E}',
  63,
  false
),
(
  'samsung-galaxy-buds-fe',
  'Samsung Galaxy Buds FE',
  'Noise cancelling in a pocket',
  'Active noise cancellation, 30 hours total with the case, and a build light enough to forget you are wearing them. The case is genuinely pocket-sized, which is the thing most rivals get wrong.',
  4100000,
  null,
  '\u{1F3E3}',
  12,
  false
),
(
  'xiaomi-power-bank-3',
  'Xiaomi Mi Power Bank 3',
  '18W two-way fast charge',
  'A no-nonsense 20,000mAh bank with USB-C in and out, so one cable charges the bank and your phone. The plain black finish and matte buttons feel a step above the usual budget options.',
  2100000,
  null,
  '\u{26F1}',
  38,
  false
),
(
  'logitech-b100-mouse',
  'Logitech B100 Wireless Mouse',
  'Quiet, cheap, genuinely lasts',
  'A 2.4GHz wireless mouse with an optical sensor, symmetric shape and a battery that runs about a year on one AA. There is nothing clever about it, which is exactly why it is the shop default.',
  950000,
  null,
  '\u{1F5B1}',
  55,
  false
),
(
  'tecno-spark-20-combo',
  'Spark 20 Case + Tempered Glass',
  'Two layers of not-scratching-your-phone',
  'A soft-touch TPU case with raised edges around the camera, bundled with a 9H tempered glass screen protector. Cut precisely for the Spark 20, and the case stays on without the buttons feeling mushy.',
  320000,
  null,
  '\u{1F6F0}',
  89,
  false
),
(
  'kingston-128gb-microsd',
  'Kingston 128GB microSDXC',
  'Class 10, the one that actually works',
  'A 128GB Class 10 card rated for up to 100MB/s read. Plenty for a dashcam, a Nintendo Switch, or a phone that has run out of internal storage. Comes with a plastic SD adapter.',
  875000,
  null,
  '\u{1F5BC}',
  74,
  false
),
(
  'led-desk-lamp',
  'LED Desk Lamp with USB Port',
  'Five warmths, and a phone charger',
  'A desk lamp with five colour temperatures and three brightness levels, and a 5V USB port in the base so your phone charges from the lamp. The arm holds position properly instead of slowly folding under its own weight.',
  799900,
  null,
  '\u{1FA91}',
  30,
  false
)
on conflict (slug) do update
set name        = excluded.name,
    tagline     = excluded.tagline,
    description = excluded.description,
    price       = excluded.price,
    emoji       = excluded.emoji,
    stock       = excluded.stock,
    featured    = excluded.featured;
