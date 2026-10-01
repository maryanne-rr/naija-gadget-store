"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "./cart/CartProvider";

/**
 * The only part of a product card that needs JavaScript.
 *
 * Keeping "use client" here rather than on the card means the product grid still
 * renders as static HTML on the server.
 */

interface Props {
  productId: string;
  name: string;
  slug: string;
  price: number;
  emoji: string;
  maxStock: number;
}

export function AddToCartButton({ productId, name, slug, price, emoji, maxStock }: Props) {
  const { add, hydrated } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If the component unmounts before the timer fires, clear it - otherwise
  // React warns about updating state on an unmounted component.
  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  if (maxStock <= 0) {
    return (
      <span className="rounded-lg bg-ink-100 px-3 py-2 text-sm font-medium text-ink-400 dark:bg-ink-700">
        Sold out
      </span>
    );
  }

  function handleClick() {
    add({ productId, name, slug, price, emoji, maxStock });

    setJustAdded(true);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setJustAdded(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      // Disabled until localStorage has loaded, so the very first click cannot
      // be lost against the empty initial state.
      disabled={!hydrated}
      aria-live="polite"
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
        justAdded
          ? "bg-brand-600 text-white"
          : "bg-ink-900 text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {justAdded ? "Added ✓" : "Add to cart"}
      <span className="sr-only"> {name}</span>
    </button>
  );
}
