import Image from 'next/image';

/*
 * BProton header lockup: the mark on a foreground tile, then the wordmark.
 * The mark is decorative because the visible word and the link name carry it.
 * It is above the fold on every page, so it is preloaded (Next 16's replacement
 * for the deprecated prop that did the same).
 *
 * It lives apart from the shell's wordmark link, so the root fallbacks that show it (the global error, not-found and
 * sign-in pages) never bring the navigation guard into a route's first load: the global error boundary's client chunk
 * is delivered on every route.
 */
export function BrandLockup() {
  return (
    <>
      <span className="wordmark-tile">
        <Image alt="" className="wordmark-mark" height={20} preload src="/bproton-logo.png" width={20} />
      </span>
      BProton
    </>
  );
}
