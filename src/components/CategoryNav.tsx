import Link from "next/link";

/**
 * The category tiles on the storefront.
 *
 * A Server Component: the category list and its counts come from the catalogue,
 * so they are known at render time and this ships no JavaScript.
 *
 * THE TILE STATES THE BASIS OF THE COMPARISON
 * "5 items" is a count and tells you nothing about whether you can tell them
 * apart. "5 items, compared by capacity in mAh" is a promise about the page you
 * are about to open: these are comparable on one measure, so you do not have to
 * read five descriptions to decide. That is the difference between a category
 * browser and a list with headings.
 */

interface CategoryLink {
  slug: string;
  name: string;
  emoji: string;
  comparedBy: string;
  delivery: string;
  count: number;
  /** Cheapest price in the category, as a formatted string. */
  from: string;
}

export function CategoryNav({ categories }: { categories: CategoryLink[] }) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Product categories">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/category/${category.slug}`}
              className="group flex h-full items-start gap-4 rounded-card border border-ink-200 bg-white p-4 transition-colors hover:border-brand-400 dark:border-ink-700 dark:bg-ink-900"
            >
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-50 text-xl dark:bg-ink-800"
              >
                {category.emoji}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink-900 group-hover:text-brand-600 dark:text-ink-50">
                  {category.name}
                </span>

                {/* The comparison basis. This is the line that makes the tile
                    worth clicking rather than just decorative navigation. */}
                <span className="mt-0.5 block text-xs text-ink-600 dark:text-ink-400">
                  {category.count} {category.count === 1 ? "item" : "items"} &middot; compared by{" "}
                  {category.comparedBy}
                </span>

                <span className="mt-1 block text-xs text-ink-500 dark:text-ink-500">
                  From{" "}
                  <span className="font-semibold tabular-nums text-ink-800 dark:text-ink-200">
                    {category.from}
                  </span>{" "}
                  &middot; {category.delivery}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}