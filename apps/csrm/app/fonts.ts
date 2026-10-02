import localFont from 'next/font/local';

/*
 * The three families (direction section 3.10), declared once. The root layout and the global
 * error UI both apply them: a global error replaces the root layout, so it must load its own fonts.
 *
 * They are self-hosted (G-10): the files in ./fonts are byte-identical copies of the @fontsource
 * packages, with their provenance in ./fonts/README.md, so no build or page makes a third-party
 * font request (R-08-24).
 *
 * Each subset is its own call because next/font/local sets preload and the @font-face descriptors
 * per call, not per file. Plus Jakarta Sans and IBM Plex Mono have three calls each: the latin face
 * is preloaded, and the latin-ext and vietnamese companions are downloaded only when a page renders
 * one of their characters (quick task 261002-drq added vietnamese). Instrument Serif has two, because
 * @fontsource ships no vietnamese subset for it. The companions' unicode-ranges exclude the space, so
 * neither companion is ever the first available font and neither needs fallback metrics. globals.css
 * lists them first in each font token, latin-ext then vietnamese. Loader arguments must be literals,
 * so each range is written inline.
 */
export const jakarta = localFont({
  src: [
    { path: './fonts/plus-jakarta-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-jakarta',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

const jakartaLatinExt = localFont({
  src: [
    { path: './fonts/plus-jakarta-sans-latin-ext-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-latin-ext-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-latin-ext-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-jakarta-latin-ext',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
    },
  ],
});

const jakartaVietnamese = localFont({
  src: [
    { path: './fonts/plus-jakarta-sans-vietnamese-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-vietnamese-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/plus-jakarta-sans-vietnamese-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-jakarta-vietnamese',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
    },
  ],
});

export const instrument = localFont({
  src: [{ path: './fonts/instrument-serif-latin-400-normal.woff2', weight: '400', style: 'normal' }],
  variable: '--font-instrument',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Times New Roman',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

const instrumentLatinExt = localFont({
  src: [{ path: './fonts/instrument-serif-latin-ext-400-normal.woff2', weight: '400', style: 'normal' }],
  variable: '--font-instrument-latin-ext',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
    },
  ],
});

export const plexMono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
});

const plexMonoLatinExt = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-latin-ext-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-latin-ext-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-mono-latin-ext',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
    },
  ],
});

const plexMonoVietnamese = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-vietnamese-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-vietnamese-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-mono-vietnamese',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
    },
  ],
});

/**
 * The classes that define the eight font variables (each family, its latin-ext companion and, for
 * Plus Jakarta Sans and IBM Plex Mono, its vietnamese companion) on the html element.
 */
export const fontVariableClassName = [
  jakarta.variable,
  jakartaLatinExt.variable,
  jakartaVietnamese.variable,
  instrument.variable,
  instrumentLatinExt.variable,
  plexMono.variable,
  plexMonoLatinExt.variable,
  plexMonoVietnamese.variable,
].join(' ');
