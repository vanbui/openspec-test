import { IBM_Plex_Mono, Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google';

/*
 * The three families (direction section 3.10), declared once. The root layout and the global
 * error UI both apply them: a global error replaces the root layout, so it must load its own fonts.
 */
export const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-jakarta', display: 'swap' });
export const instrument = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-instrument', display: 'swap' });
export const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

/** The classes that define --font-jakarta, --font-instrument and --font-plex-mono on the html element. */
export const fontVariableClassName = [jakarta.variable, instrument.variable, plexMono.variable].join(' ');
