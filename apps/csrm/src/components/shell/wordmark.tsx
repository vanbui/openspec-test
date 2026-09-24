import Image from 'next/image';
import Link from 'next/link';

/*
 * BProton header lockup: the mark on a foreground tile, then the wordmark.
 * The mark is decorative because the visible word and the link name carry it.
 */
export function BrandLockup() {
  return (
    <>
      <span className="wordmark-tile">
        <Image alt="" className="wordmark-mark" height={20} priority src="/bproton-logo.png" width={20} />
      </span>
      BProton
    </>
  );
}

export function Wordmark() {
  return <Link aria-label="IdamBox CSRM home" className="wordmark" href="/app"><BrandLockup /></Link>;
}
