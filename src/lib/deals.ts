import type { Product } from "./catalog";

/**
 * Choosing which products are today's deals.
 *
 * This is a separate module rather than part of products.ts because it is pure
 * logic with no server dependency: no database, no "server-only" import. That
 * makes it directly testable, which matters more here than usual - the bug this
 * logic exists to avoid is subtle, and a test is the only thing that catches it.
 *
 * It also keeps the policy in one place. "Which products may be featured as a
 * deal, and in what order" is a decision; the query layer should not be where
 * that decision lives.
 */

/**
 * Pick the deals for today's carousel.
 *
 * WHY THIS RUNS ON THE SERVER
 * Two reasons, and the second is the important one.
 *
 * First, `Math.random()` in a Client Component would reshuffle the rotation on
 * every re-render, so the slide would change while you were reading it.
 *
 * Second, and more importantly: everyone opening the site on the same day sees
 * the same deal. That is what a shop window does - the display changes on
 * Tuesday morning, not every time somebody walks past. Deriving the order from
 * the date makes a server render and a client render of the same day agree, and
 * means there is no hydration mismatch on the first screen.
 *
 * WHY ONE PER CATEGORY
 * The first version of this hero led with a single power bank, which made the
 * whole shop read as a power bank shop. Drawing the rotation from different
 * categories means the first screen is a sample of the catalogue: whatever slide
 * you land on is evidence that this shop sells more than batteries. Which
 * category leads changes by the day, so the banner does not always open on the
 * same thing.
 *
 * WHY PRODUCTS WITH NO REAL SAVING ARE EXCLUDED
 * A carousel that features a "deal" which is not actually cheaper teaches people
 * to distrust the badge, which costs more than the sale ever earned. A sold-out
 * deal is worse: it is an advert for something you cannot buy.
 */
export function dealsForToday(products: Product[], date: Date): Product[] {
  const onOffer = products.filter(
    (p) => p.deal && p.compare_at_price !== null && p.compare_at_price > p.price && p.stock > 0,
  );

  if (onOffer.length === 0) return [];

  // Day number since the epoch. Stable for the whole day, different tomorrow.
  const dayNumber = Math.floor(date.getTime() / 86_400_000);

  // Group by category so each category is represented once.
  const byCategory = new Map<string, Product[]>();
  for (const product of onOffer) {
    const key = product.category ?? "uncategorised";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(product);
  }

  // Sorted before rotating, so the rotation is deterministic rather than
  // dependent on Map insertion order, which follows whatever order the database
  // returned the rows in.
  const groups = [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));

  // Rotate the category order by the day, then take one from each. Every
  // category still appears; only the lead changes.
  const offset = dayNumber % groups.length;
  const ordered = [...groups.slice(offset), ...groups.slice(0, offset)];

  return ordered.map(([, items]) => items[dayNumber % items.length]);
}