'use client';

import { useLayoutEffect, useRef, useState, type DependencyList, type ReactNode, type RefObject } from 'react';

import { cn } from '@/lib/utils';

/*
 * Horizontal scroll regions (direction §4 DataTable, X-1 and X-2). A table's scroller becomes a
 * keyboard-focusable region named after the table while, and only while, the table is wider than
 * the scroller, so a table that fits never gains a purposeless tab stop. Overflow is measured in
 * the browser; server markup always starts as a table that fits.
 *
 * Every scroller that uses this renders `data-overflow` and `data-overflow-end`. `globals.css` keys
 * the end-edge fade on them and lays the scroller out as a one-cell grid, which is why callers give
 * it a grid display: the fade shares the table's cell and sticks to the visible end edge.
 */

export type HorizontalOverflow = {
  /** The content is wider than the scroller. */
  overflowing: boolean;
  /** Nothing is hidden beyond the end edge: the table fits, or it is scrolled to its end. */
  atEnd: boolean;
};

const fits: HorizontalOverflow = { overflowing: false, atEnd: true };

function readOverflow(element: HTMLElement): HorizontalOverflow {
  const overflowing = element.scrollWidth > element.clientWidth;
  // A fractional scroll offset can stop short of the last pixel, which still counts as the end.
  const atEnd = !overflowing || element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
  return { overflowing, atEnd };
}

/** The scroller, the table primitive's container and the table: a wider table resizes the last. */
function observedTargets(element: HTMLElement) {
  const targets = [element, element.firstElementChild, element.querySelector('table')];
  return targets.filter((target, index): target is Element => target !== null && targets.indexOf(target) === index);
}

/**
 * Scroll padding at the start equals a sticky first column's width, so a cell that receives focus
 * is scrolled clear of the column that stays over it (WCAG 2.4.11). No sticky column, no padding.
 */
function writeStickyInlineStart(element: HTMLElement) {
  const firstCell = element.querySelector('tr > :first-child');
  const width = firstCell && getComputedStyle(firstCell).position === 'sticky' ? firstCell.getBoundingClientRect().width : 0;
  element.style.setProperty('--table-sticky-inline-start', `${width}px`);
}

/**
 * Measures whether the scroller in `ref` overflows horizontally and whether it is scrolled to its
 * end: after mount, whenever the scroller, its first child or its table resizes (so new rows,
 * columns or a density change are followed without re-rendering), on every scroll, and whenever
 * `deps` change. `deps` must change whenever the scroller element itself may have been mounted,
 * replaced or removed (for example a list moving between its loading, empty and populated states).
 */
export function useHorizontalOverflow(ref: RefObject<HTMLElement | null>, deps: DependencyList): HorizontalOverflow {
  const [overflow, setOverflow] = useState<HorizontalOverflow>(fits);

  useLayoutEffect(() => {
    const element = ref.current;
    const commit = (next: HorizontalOverflow) => {
      setOverflow((current) => (current.overflowing === next.overflowing && current.atEnd === next.atEnd ? current : next));
    };
    if (!element) {
      commit(fits);
      return undefined;
    }

    const onScroll = () => commit(readOverflow(element));
    const onResize = () => {
      commit(readOverflow(element));
      writeStickyInlineStart(element);
    };

    onResize();
    element.addEventListener('scroll', onScroll, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(onResize);
    if (observer) for (const target of observedTargets(element)) observer.observe(target);

    return () => {
      element.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
    // The caller's deps decide when to re-subscribe; `ref` is a stable object.
  }, deps);

  // The sticky column appears with the overflow, so its width is read again once it has rendered.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) writeStickyInlineStart(element);
  }, [overflow.overflowing, ref]);

  return overflow;
}

/** The region semantics for a scroller: a named, focusable region while it overflows, nothing otherwise. */
export function horizontalScrollRegionProps(label: string, overflowing: boolean) {
  return overflowing
    ? ({ role: 'region', 'aria-label': `${label}, scrolls horizontally`, tabIndex: 0 } as const)
    : {};
}

/** The data attributes the scroll cue and the browser proofs read. */
export function horizontalOverflowAttributes({ atEnd, overflowing }: HorizontalOverflow) {
  return {
    'data-overflow': overflowing ? 'true' : 'false',
    'data-overflow-end': atEnd ? 'true' : 'false',
  } as const;
}

/** The focus ring on the region's frame, drawn only while the region exists. */
export const horizontalScrollRegionFocusClassName = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export type HorizontalScrollRegionProps = {
  /** The table's own accessible name; the region is named `{label}, scrolls horizontally`. */
  label: string;
  /** Frame and display classes. The scroller is a one-cell grid, so a display class uses `grid`. */
  className?: string;
  children: ReactNode;
};

/**
 * A scroller for a plain `Table`, which is the only element that scrolls: the table primitive's own
 * overflow container inside it is made visible, so no unlabelled inner scroller remains.
 */
export function HorizontalScrollRegion({ children, className, label }: HorizontalScrollRegionProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // This element is never replaced, and the observer on its table follows the table's size.
  const overflow = useHorizontalOverflow(scrollerRef, []);

  return (
    <div
      ref={scrollerRef}
      {...horizontalScrollRegionProps(label, overflow.overflowing)}
      {...horizontalOverflowAttributes(overflow)}
      className={cn(
        'grid [&>[data-slot=table-container]]:overflow-visible',
        overflow.overflowing && horizontalScrollRegionFocusClassName,
        className,
      )}
    >
      {children}
    </div>
  );
}
