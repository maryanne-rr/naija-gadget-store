import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-6xl" aria-hidden="true">
        🔍
      </p>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-ink-500">
        That page does not exist, or the product may have sold out and been removed.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-ink-900 px-5 py-2.5 font-semibold text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        Back to the shop
      </Link>
    </div>
  );
}
