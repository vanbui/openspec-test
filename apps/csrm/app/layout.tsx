import './globals.css';
import type { Metadata } from 'next';

import { Toaster } from '@/components/ui/sonner';
import { fontVariableClassName } from './fonts';

export const metadata: Metadata = { title: 'IdamBox CSRM', description: 'IdamBox Cyber Risk Manager' };
/*
 * Every page renders per request. proxy.ts issues a fresh Content-Security-Policy nonce for each
 * request and Next applies it while rendering, so a page prerendered at build time would ship its
 * scripts without the nonce and the policy would block them (docs/security/web-headers.md).
 */
export const dynamic = 'force-dynamic';
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVariableClassName}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
