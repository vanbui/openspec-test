'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

/*
 * In-page link destinations on a streamed route (Phase 13, D1 and D3 of the 13-19 walk; Phase 10 UI-D27). A request page
 * streams in behind its route's loading boundary, so a link to `#notes` or `#assignment` arrives before its target
 * exists: the browser's own fragment scroll runs against the skeleton, and the router drops a fragment it cannot find.
 * The component that owns a destination lands on it itself, once it has mounted. A link on the same page moves the URL
 * through the router, which scrolls but neither moves focus nor fires `hashchange`, so a click on such a link lands the
 * same way once the router has moved. Landing scrolls the target into view (the page's `scroll-padding-top` keeps it
 * clear of the sticky header) and moves focus to it, or to the heading that names it, as WCAG 2.4.3 asks.
 */

/** The element id a URL fragment names, or null for none or one that does not decode. */
export function hashTargetId(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

/** Scrolls `target` into view and moves focus to it when it can take focus, or else to the heading that names it. */
export function landOn(target: HTMLElement): void {
  target.scrollIntoView({ block: 'start' });
  const focusable = target.hasAttribute('tabindex') || target.matches('a[href], button, input, select, textarea')
    ? target
    : target.querySelector<HTMLElement>('h1[tabindex], h2[tabindex], h3[tabindex]');
  focusable?.focus({ preventScroll: true });
}

/** The fragment id a plain click on a link to this very page names, or null for any other click. */
function samePageFragment(event: MouseEvent): string | null {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return null;
  const url = new URL(anchor.href, window.location.href);
  const here = window.location;
  if (url.origin !== here.origin || url.pathname !== here.pathname || url.search !== here.search) return null;
  return hashTargetId(url.hash);
}

/**
 * Lands on this component's link destinations: the URL's fragment once the component has mounted, a fragment the page
 * moves to later (`hashchange`), and one a link on the same page names. `land` receives every fragment id and acts only
 * on its own, so two owners on one page never compete.
 */
export function useHashLanding(land: (id: string) => void): void {
  const latest = useRef(land);
  useLayoutEffect(() => {
    latest.current = land;
  });

  useEffect(() => {
    const landOnId = (id: string | null) => {
      if (id) latest.current(id);
    };
    landOnId(hashTargetId(window.location.hash));
    const onHashChange = () => landOnId(hashTargetId(window.location.hash));
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (event: MouseEvent) => {
      const id = samePageFragment(event);
      if (!id) return;
      /* After the router has committed the move and done its own scroll, which a transition does after this click. */
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      frame = requestAnimationFrame(() => {
        timer = setTimeout(() => landOnId(id), 0);
      });
    };
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      document.removeEventListener('click', onClick);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);
}
