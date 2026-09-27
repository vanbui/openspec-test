import Image from 'next/image';
import Link from 'next/link';

/*
 * BProton header lockup: the mark on a foreground tile, then the wordmark.
 * The mark is decorative because the visible word and the link name carry it.
 * It is above the fold on every page, so it is preloaded (Next 16's replacement
 * for the deprecated prop that did the same).
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

/*
 * The name begins with the visible word (WCAG 2.5.3 Label in Name), so a speech-input user who says
 * "BProton" reaches the link, and a screen reader still hears where it goes.
 */
export function Wordmark() {
  return <Link aria-label="BProton, IdamBox CSRM home" className="wordmark" href="/app"><BrandLockup /></Link>;
}
