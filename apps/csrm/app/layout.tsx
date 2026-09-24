import './globals.css';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google';

import { Toaster } from '@/components/ui/sonner';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-jakarta', display: 'swap' });
const instrument = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-instrument', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = { title: 'IdamBox CSRM', description: 'IdamBox Cyber Risk Manager' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${instrument.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
