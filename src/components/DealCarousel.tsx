"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatNaira, discountPercent } from "@/lib/money";

/**
 * The rotating deal-of-the-day banner.
 *
 * WHY A CAROUSEL AND NOT ONE HERO PRODUCT
 * The first version of this hero was a single power bank, which made the whole
 * shop read as a power bank shop. A carousel fixes that properly rather than
 * cosmetically: if the rotation draws from different categories, then the first
 * screen is a sample of the catalogue rather than a statement about one corner
 * of it, and a visitor who waits five seconds sees a keyboard and a pair of
 * earbuds. One product can never say "this is a gadget shop" on its own.
 *
 * WHY THE ORDER IS THE SAME ON EVERY VISIT
 * The rotation is picked by the server from the date, not at random in the
 * browser. Two consequences: the slide does not reshuffle every time React
 * re-renders, and everyone opening the site on the same day sees the same deal,
 * which is what a real shop's window display does.
 *
 * THE STRIKETHROUGH PRICE IS DISPLAY ONLY
 * `compare_at_price` never reaches the cart or the order. The amount charged is
 * `price`, computed server-side. If that separation were ever lost, editing a
 * "was" figure would be editing a customer's bill.
 */

interface Slide {
  id: string;
  slug: string;
  name: string;
  brand: string;
  spec: string;
  categoryName: string;
  imageUrl: string | null;
  emoji: string;
  price: number;
  compareAt: number | null;
}

const ROTATE_MS = 6500;

export function DealCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // A ref rather than state, because the timer must read the current index
  // without restarting on every change - a timer in state would be cleared and
  // recreated each tick and the carousel would never advance.
  const indexRef = useRef(0);

  const go = useCallback((next: number) => {
    indexRef.current = next;
    setIndex(next);
  }, []);

  const step = useCallback(() => {
    if (slides.length < 2) return;
    go((indexRef.current + 1) % slides.length);
  }, [go, slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2) return;

    const timer = setInterval(step, ROTATE_MS);
    return () => clearInterval(timer);
  }, [paused, step, slides.length]);

  // A visitor who has tabbed away should not come back to a slide that advanced
  // while they were not looking.
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) setPaused(true);
    };
    const onHidden = () => setPaused(false);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("blur", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("blur", onHidden);
    };
  }, []);

  if (slides.length === 0) return null;

  const slide = slides[index];
  const percent = discountPercent(slide.price, slide.compareAt);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Deal of the day"
      // Hovering, focusing or tapping pauses. Auto-advancing content that moves
      // while you are reading it is an accessibility problem, not a feature.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="overflow-hidden rounded-panel border border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900"
    >
      <div className="grid items-stretch lg:grid-cols-[1fr_0.85fr]">
        {/* ---- Slide copy ---- */}
        <div className="order-2 flex flex-col justify-center p-6 lg:order-1 lg:p-10">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-300">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full bg-signal-300"
            />
            Deal of the day
          </p>

          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-ink-500">
            {slide.brand} &middot; {slide.categoryName}
          </p>

          {/* The name takes the headline position, matching the product card.
              The specification drops to supporting size underneath, where it
              answers the question for anyone comparing rather than leading.

              Audio has no headline figure at all - battery hours are not what
              decides a pair of headphones - so the line is skipped rather than
              left with a gap. */}
          <h2 className="mt-1 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {slide.name}
          </h2>

          {slide.spec.trim().length > 0 && (
            <p className="mt-1 text-base font-medium text-ink-600 dark:text-ink-400">
              {slide.spec}
            </p>
          )}

          <p className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="tabular-nums text-3xl font-bold">
              {formatNaira(slide.price)}
            </span>
            {slide.compareAt !== null && percent !== null && (
              <>
                <s className="tabular-nums text-lg text-ink-400 line-through decoration-2">
                  {formatNaira(slide.compareAt)}
                </s>
                <span className="rounded-card bg-signal-300 px-2 py-1 text-sm font-bold text-ink-950">
                  Save {percent}%
                </span>
              </>
            )}
          </p>

          {/* One action only.
              Three buttons on a rotating slide is a choice-shopping interface
              that undercuts the one thing it is for. The carousel is an
              advert: it should offer the product in front of you and get out of
              the way. Category browsing belongs to the category tiles, and
              tracking an existing order belongs in the header, where somebody
              looking for it expects to find it. */}
          <div className="mt-6">
            <Link
              href={`/products/${slide.slug}`}
              className="inline-block rounded-card bg-brand-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Get deal
            </Link>
          </div>

          {/* ---- Controls ---- */}
          {slides.length > 1 && (
            <div className="mt-7 flex items-center gap-2">
              {slides.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show deal: ${item.name}`}
                  aria-current={i === index}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-7 bg-brand-600" : "w-3 bg-ink-300 hover:bg-ink-400"
                  }`}
                />
              ))}

              <span className="ml-auto flex gap-1">
                <button
                  type="button"
                  onClick={() => go((indexRef.current - 1 + slides.length) % slides.length)}
                  aria-label="Previous deal"
                  className="flex h-8 w-8 items-center justify-center rounded-card border border-ink-200 text-ink-600 transition-colors hover:border-brand-400 dark:border-ink-700 dark:text-ink-300"
                >
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  type="button"
                  onClick={step}
                  aria-label="Next deal"
                  className="flex h-8 w-8 items-center justify-center rounded-card border border-ink-200 text-ink-600 transition-colors hover:border-brand-400 dark:border-ink-700 dark:text-ink-300"
                >
                  <span aria-hidden="true">→</span>
                </button>
              </span>
            </div>
          )}
        </div>

        {/* ---- Slide image ----
            Every slide is rendered and stacked rather than swapped, so advancing
            is a cross-fade with no image flash and no layout shift. */}
        <div className="relative order-1 aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[22rem]">
          {slides.map((item, i) => (
            <Link
              key={item.id}
              href={`/products/${item.slug}`}
              aria-hidden={i !== index}
              tabIndex={i === index ? 0 : -1}
              className={`absolute inset-0 block bg-ink-100 transition-opacity duration-500 dark:bg-ink-800 ${
                i === index ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  // Only the first slide is eager. Loading every slide's image
                  // at once would fetch eight photographs before the second
                  // slide is even on screen.
                  priority={i === 0}
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-7xl">
                  {item.emoji}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Announced to screen readers as the slide changes, without moving focus. */}
      <p className="sr-only" aria-live="polite">
        Deal {index + 1} of {slides.length}: {slide.name}, {formatNaira(slide.price)}
      </p>
    </section>
  );
}