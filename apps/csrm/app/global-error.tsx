'use client';

import './globals.css';

import { ShieldCheckIcon } from 'lucide-react';

import { BrandLockup } from '@/components/shell/wordmark';
import { Button } from '@/components/ui/button';
import { fontVariableClassName } from './fonts';

type GlobalErrorProps = { error: Error & { digest?: string }; retry: () => void };

/** The fallback card, exported so it can be rendered on its own, without a second document. */
export function GlobalErrorCard({ retry }: Pick<GlobalErrorProps, 'retry'>) {
  return (
    <main className="sign-in">
      <section className="sign-in-card">
        <p className="wordmark"><BrandLockup /></p>
        <p className="micro-label sign-in-eyebrow">
          <ShieldCheckIcon aria-hidden="true" />
          IdamBox CSRM
        </p>
        <h1>Something went wrong</h1>
        <p className="sign-in-lead">
          The application hit an unexpected error. Please try again. If the problem continues, contact your administrator.
        </p>
        <Button className="h-control-h" type="button" onClick={() => retry()}>Try again</Button>
      </section>
    </main>
  );
}

/*
 * A global error replaces the root layout, so it renders its own document, loads the stylesheet
 * and the fonts itself, and titles the page with a React title element (a global error cannot
 * export metadata). It never renders the error it receives: a production server error arrives as
 * a generic message with a digest, and neither reaches the page (UI-SPEC section 9.3, D-21).
 * retry re-fetches and re-renders the failed tree (Next.js 16.3).
 */
export default function GlobalError({ retry }: GlobalErrorProps) {
  return (
    <html lang="en" className={fontVariableClassName}>
      <head>
        <title>Something went wrong | IdamBox CSRM</title>
      </head>
      <body>
        <GlobalErrorCard retry={retry} />
      </body>
    </html>
  );
}
