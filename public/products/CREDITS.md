# Product photo credits

Every photo in `public/products/` was downloaded from a source that permits
reuse, and the licence is recorded below. **This file is not optional** — CC
BY-SA and CC BY both legally require crediting the photographer, and the shop
is public.

Two sources are used:

- **Wikimedia Commons** — an open API, no access key, and the licence travels
  with the file. Most Commons photographs here are CC BY-SA, which requires
  credit and share-alike. `public/products/credits.json` is the machine-readable
  copy, written by `scripts/promote-photos.mjs` and `scripts/replace-photos.mjs`.
- **Unsplash** — the three still standing from the original batch, downloaded
  directly rather than through the API, so no token was involved. The Unsplash
  Licence permits commercial use and requires no attribution.

`npm run photos:credits` regenerates the Commons table below from
`credits.json`, so it cannot drift from what is actually on disk.

## Every photograph was checked before use

The first ten were downloaded and committed without being opened afterwards.
Seven turned out not to show the product at all: a power bank listing
illustrated with an Apple wall adapter, a 128GB memory card illustrated with a
mechanic under a car bonnet, a GaN charger illustrated with headphones. Two
were worse than merely generic — the Anker PowerCore showed a power bank with
the Xiaomi logo on it, and the Samsung earbuds showed three sets of earbuds that
were not Samsung's.

That is the lesson worth keeping: **a photo chosen on the strength of a search
result has not been verified.** Search relevance is a starting point, not a
decision. Every image below was opened and looked at. `scripts/
source-photos.mjs` stages candidates into `.photo-staging/` and the promote and
replace scripts copy only the reviewed ones, so the rejection is recorded
rather than silent.

## Two listings were renamed rather than photographed

Commons has no photograph of an MPOW 6-in-1 multi-connector cable, and selling
a generic braided cable under that name is a small lie — the photo shows
something the product does not do. So the listing became the product its
photograph actually shows, and the same for the Samsung earbuds, which became
Nothing Ear (2). The catalogue is demonstration data, so matching the listing to
the photograph is honest; inventing a product name to match a borrowed photo is
not.

## Wikimedia Commons

| File | Author | Licence |
| --- | --- | --- |
| anker-m80-cable.jpg | Chenspec | CC BY-SA 4.0 |
| anker-powerbank-10000.jpg | Saucy | CC BY 4.0 |
| anker-powercore-20000.jpg | Saucy | CC BY 4.0 |
| anker-powercore-5000.jpg | KKPCW | CC BY-SA 4.0 |
| anker-powerport-40w.jpg | HereToHelp | CC BY-SA 3.0 |
| bose-qc25.jpg | Florian Fuchs | CC BY-SA 3.0 |
| braided-usbc-cable.jpg | Pittigrilli | CC BY-SA 4.0 |
| corsair-raptor-keyboard.jpg | Thanasis Termitzoglou | CC BY-SA 4.0 |
| folio-case-universal.jpg | Tiia Monto | CC BY-SA 4.0 |
| generic-usbc-hub.jpg | Thefreeencyclopedia1 | CC BY-SA 4.0 |
| jbl-flip-4.jpg | Freekhou5 | CC BY-SA 4.0 |
| kingston-128gb-microsd.jpg | Gwarp | Public domain |
| lazos-gan-30w.jpg | Qurren | CC BY-SA 4.0 |
| logitech-c920-webcam.jpg | Zsinytwiki | CC0 |
| logitech-k120-keyboard.jpg | Colin | CC BY-SA 4.0 |
| logitech-m310-mouse.jpg | MiNe | CC BY 2.0 |
| logitech-m317-mouse.jpg | TaurusEmerald | CC BY-SA 4.0 |
| nothing-ear-2-earbuds.jpg | Premeditated | CC BY-SA 4.0 |
| oraimo-65w-gan-charger.jpg | Evan-Amos | Public domain |
| romoss-20000-powerbank.jpg | Ilya Plekhanov | CC BY-SA 3.0 |
| samsung-t5-ssd-1tb.jpg | Tony Webster | CC BY 2.0 |
| sandisk-extreme-ssd-1tb.jpg | Tony Webster | CC BY 2.0 |
| tecno-spark-20-combo.jpg | Gannu03 | CC BY-SA 4.0 |
| wallet-case-blackview.jpg | Acabashi | CC BY-SA 4.0 |
| xiaomi-power-bank-3.jpg | Reladex | CC BY-SA 4.0 |
| yamaha-tw-e3a-earbuds.jpg | MIKI Yoshihito | CC BY 2.0 |

## Unsplash — no attribution required

| File | Source |
| --- | --- |
| jbl-tune-510bt.jpg | Unsplash, Unsplash Licence |
| led-desk-lamp.jpg | Unsplash, Unsplash Licence |
| logitech-b100-mouse.jpg | Unsplash, Unsplash Licence |