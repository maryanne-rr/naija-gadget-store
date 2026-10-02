import Link from "next/link";

/**
 * The category strip on the storefront.
 *
 * A Server Component: the category list and its product counts come from the
 * catalogue, so they are known at render time and this ships no JavaScript.
 *
 * The counts are computed here rather than passed in because the only thing
 * that knows them is the product list, and threading a count per category
 * through three components to render "6 items" is more plumbing than the
 * number is worth.
 */

interface CategoryLink {
  slug: string;
  name: string;
  emoji: string;
  count: number;
}

export function CategoryNav({ categories }: { categories: CategoryLink[] }) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Product categories">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/category/${category.slug}`}
              className="group flex h-full flex-col items-start gap-1 rounded-card border border-ink-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-lg hover:shadow-brand-600/10 dark:border-ink-700 dark:bg-ink-800"
            >
              <span aria-hidden="true" className="text-2xl">
                {category.emoji}
              </span>
              <span className="text-sm font-semibold text-ink-900 group-hover:text-brand-700 dark:text-ink-50">
                {category.name}
              </span>
              <span className="text-xs text-ink-500">
                {category.count} {category.count === 1 ? "item" : "items"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}