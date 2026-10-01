import localFont from 'next/font/local';

/*
 * The three families (direction section 3.10), declared once. The root layout and the global
 * error UI both apply them: a global error replaces the root layout, so it must load its own fonts.
 *
 * They are self-hosted (G-10): the files in ./fonts are byte-identical copies of the @fontsource
 * packages, with their provenance in ./fonts/README.md, so no build or page makes a third-party
 * font request (R-08-24).
 *
 * Each family has two calls because next/font/local sets preload and the @font-face descriptors per
 * call, not per file. The latin face is preloaded; the latin-ext companion is downloaded only when a
 * page renders one of its characters. The companion's unicode-range excludes the space, so it is
 * never the first available font and needs no fallback metrics. globals.css lists it first in each
 * font token. Loader arguments must be literals, so each range is written inline.
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

/** The classes that define the six font variables (each family and its latin-ext companion) on the html element. */
export const fontVariableClassName = [
  jakarta.variable,
  jakartaLatinExt.variable,
  instrument.variable,
  instrumentLatinExt.variable,
  plexMono.variable,
  plexMonoLatinExt.variable,
].join(' ');
