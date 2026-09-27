import { ShieldCheckIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BrandLockup } from '@/components/shell/wordmark';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Page not found | IdamBox CSRM' };

/*
 * The root not-found renders for a URL no route matches (and for a notFound() outside the signed-in
 * shell). It sits in the root layout, outside the shell, in the sign-in card frame. It names no
 * path, record, status code or environment detail (UI-SPEC section 9.3, D-21). Inside the shell,
 * app/(app)/not-found.tsx renders the same copy.
 */
export default function NotFound() {
  return (
    <main className="sign-in">
      <section className="sign-in-card">
        <p className="wordmark"><BrandLockup /></p>
        <p className="micro-label sign-in-eyebrow">
          <ShieldCheckIcon aria-hidden="true" />
          IdamBox CSRM
        </p>
        <h1>Page not found</h1>
        <p className="sign-in-lead">The page you asked for doesn’t exist or has moved.</p>
        <Link className={buttonVariants({ className: 'h-control-h' })} href="/app">Return to workspace</Link>
      </section>
    </main>
  );
}
