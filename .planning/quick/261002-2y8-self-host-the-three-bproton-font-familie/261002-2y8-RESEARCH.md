---
quick_id: 261002-2y8
task: G-10 self-hosted fonts (R-08-24)
researched: 2026-10-02
researcher: csrm-worker (orchestrator spike before planning)
---

# Research: self-hosting the three families through `next/font/local`

Evidence gathered before planning, on branch `post-demo` at `25bfc73`. Every probe ran in a gitignored dist directory (`apps/csrm/.tmp/…`) and the working tree was restored byte for byte afterwards.

## 1. What `next/font/local` can express in this Next (16.3.6, Turbopack)

Read from `node_modules/next/dist/compiled/@next/font/dist/local/` and the Next docs in `node_modules/next/dist/docs/` (`01-app/03-api-reference/02-components/font.md`), then confirmed by a Turbopack production build:

| Fact | Consequence |
|---|---|
| `src` entries carry only `path`, `weight` and `style`. | There is no per-file `unicode-range`. |
| `declarations` (any descriptor except `src`, `font-display`, `font-weight` and `font-style`) apply to **every** `@font-face` of the call. Turbopack emits them (observed: `unicode-range` appears on each face). | A subset needs its own call to get its own `unicode-range`. |
| `preload` applies to the whole call. Preloaded files are emitted as `*-s.p.*.woff2` and get a `<link rel="preload" as="font">`. A `preload: false` call emits files without `.p`. | latin can be preloaded while latin-ext is not, only if they are separate calls. |
| `adjustFontFallback`: `'Arial'` (default), `'Times New Roman'` or `false`. Metrics are computed from the font file. | The Google-era choice per family can be kept explicitly. |
| Turbopack names a local face family after its JavaScript binding (`jakarta`, `jakarta Fallback`), unhashed; Google-era faces were named after the family (`Plus Jakarta Sans`). | Family names in computed styles change. No design value changes, and nothing in the app references those names (only the three stacks in `globals.css` reference the variables). |
| Font loader arguments must be literals (SWC transform). | The unicode ranges are written inline in each call. |
| `app/fonts.ts` and a sibling `app/fonts/` directory coexist: `./fonts` resolves to the file in Turbopack, TypeScript and Vite. | The files can live in `app/fonts/`, the Next docs' own example location. |

## 2. Google-era baseline (observed in the operator's `apps/csrm/.next/dev` build)

- `next/font/google` self-hosted every subset Google serves, each face with its own `unicode-range`. It preloaded only `latin`.
- 16 files, 147,352 B in total: Plus Jakarta Sans 4 subsets × 1 variable file, Instrument Serif 2, IBM Plex Mono 5 subsets × 2 weights. 4 preloaded files, 62,424 B.
- Family names: `Plus Jakarta Sans`, `Instrument Serif`, `IBM Plex Mono`.
- Adjusted fallbacks (local font; ascent / descent / line gap / size-adjust):
  - Plus Jakarta Sans: Arial; 98.88% / 21.15% / 0% / 104.98%.
  - Instrument Serif: Times New Roman; 117.94% / 36.93% / 0% / 83.94%.
  - IBM Plex Mono: Arial; 76.16% / 20.43% / 0% / 134.59%.
- The browser never contacted Google (`font-src 'self'`). The build did, on every `next build` and `next dev` compile: that is R-08-24.

## 3. Source files (official npm registry, `npm pack` into the scratchpad)

| Package | Tarball integrity (registry `dist.integrity`, re-computed locally) | shasum | Font version (name table) |
|---|---|---|---|
| `@fontsource/plus-jakarta-sans@5.3.0` | `sha512-9WRw3G74Ve4cyPApAZSXLPY5DiLOZXDn7Q7dIBjFBpA0Pj56ljDItEdy2UUajjJxRuTg2HkMLO5C3K2nAQORWg==` | `a1c37aec60423dd44476d9da00bd34ce546ee859` | 2.071 |
| `@fontsource/instrument-serif@5.3.0` | `sha512-mDiaIg0u67sYV59fie92Wz4sM8UiVlbL7fLxnFPCKkX15DMASEnQTREbaP5S5/3DCcsoAOcQ0sV9E4AeY4QqYQ==` | `57d45e62debe978653a14b7152299c6d76762fe2` | 1.000 |
| `@fontsource/ibm-plex-mono@5.3.0` | `sha512-eTgnZjZEGk1QtD3ZstF+Vclo2HLAni8YMy34/DxllwZvyz1lR/1RF/xTiAquOBO7MvqBx8D2Ig2WCPMVfdZu7Q==` | `1879699d104602d5331e28e103f33c3b1b766b17` | 2.3 |

All three are `latest` (5.3.0), licence `OFL-1.1`, built by Fontsource from `github.com/google/fonts`. The files are static instances per weight (normal style), subset by the same unicode ranges Google Fonts serves (each package's `unicode.json`):

- **latin:** `U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`
- **latin-ext:** `U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF`

Files to ship (`package/files/<name>`), SHA-256 of the bytes as published:

| File | Bytes | SHA-256 |
|---|---:|---|
| `plus-jakarta-sans-latin-400-normal.woff2` | 11,816 | `221a4135d06a4b33abbd535e9a0da4e565d19545ddd9267c4e678a916d54d9b6` |
| `plus-jakarta-sans-latin-500-normal.woff2` | 12,312 | `bad081c8dbc15aed6c5e4cde5461914f7b3bdc295b7a7aed177e4beddb79bffa` |
| `plus-jakarta-sans-latin-600-normal.woff2` | 12,188 | `8872bb5c9111df9bd3162c2394aee6354d782b13408a4dd5bbf65c48207206e6` |
| `plus-jakarta-sans-latin-ext-400-normal.woff2` | 10,592 | `65b5680bf2ba9c6c42af74ddd2e8aadde93af7c523454ebb3d4e32fdba3f94db` |
| `plus-jakarta-sans-latin-ext-500-normal.woff2` | 10,864 | `d1584f50c388cae7e570bed35be331fa4a9afd6832ef45a32fa8bf81930e6db9` |
| `plus-jakarta-sans-latin-ext-600-normal.woff2` | 10,896 | `080a1fea8589c2bd4fa08750d0d99b3388be63df8c41a649de05cb2dda1ec007` |
| `instrument-serif-latin-400-normal.woff2` | 21,032 | `5eb09b5ac0e28b67c2f041c8ba6d244604ca0c0980d65912ab2d47fed84ddc31` |
| `instrument-serif-latin-ext-400-normal.woff2` | 11,604 | `290e6267dd833bf5f899eba4c29ad0a9b09dbe53f6075b18af38057159e1ff20` |
| `ibm-plex-mono-latin-400-normal.woff2` | 14,708 | `08949f728dc52d528e69b1667d15c89a5686a4ee9a296ff90983985f99c380f7` |
| `ibm-plex-mono-latin-500-normal.woff2` | 14,888 | `01d285447409c8a588692162439a038b8cbd7871309ee20267b0d2d91c6e8e22` |
| `ibm-plex-mono-latin-ext-400-normal.woff2` | 13,348 | `6bc0f226a5b7884a8170e3f62c63d7675609d4631bdc5931b5cdab81821f00eb` |
| `ibm-plex-mono-latin-ext-500-normal.woff2` | 13,432 | `6bb06407c97584b0867a959e05e8874693bfeb8c317de190811c51598f2d99ea` |

Licence files (`package/LICENSE`: each family's copyright line, then the full SIL Open Font License 1.1 text, LF line endings):

| Package | Bytes | SHA-256 |
|---|---:|---|
| `@fontsource/plus-jakarta-sans@5.3.0` | 4,534 | `e07fd1167c2aaaa6fb965dd66e1e73b13c9c95b76b2d648b6e938780f30b37af` |
| `@fontsource/instrument-serif@5.3.0` | 4,532 | `b6106a757902d2d412e09d94dc4a226fe3da80485208a98003969f1b8b6b1d74` |
| `@fontsource/ibm-plex-mono@5.3.0` | 5,299 | `23b0a9d0c6d3f140a0b77e483c5cfa6bba574325ef5cb189ed9f2fec4884533f` |

The files are redistributed unmodified, as the OFL permits, with the licence text beside them. No Modified Version is created, so IBM Plex's Reserved Font Name does not come into play.

Subsets not shipped (normal style, the weights in use): Plus Jakarta Sans vietnamese 12,576 B (3 files) and cyrillic-ext 3,148 B (3); IBM Plex Mono vietnamese 11,908 B (2), cyrillic-ext 13,884 B (2) and cyrillic 16,816 B (2). Instrument Serif has only latin and latin-ext.

`core.autocrlf` is `true` on the build host, so a committed LF licence file would check out as CRLF and stop matching its recorded hash. A `.gitattributes` rule (`-text`) keeps the licence files byte-identical, and `binary` makes the woff2 handling explicit.

## 4. Coverage options

| Option | Preloaded | Shipped in total | latin-ext text (Ł, ő, ș, ā …) | Change outside the loader |
|---|---|---|---|---|
| A. latin only | 6 files, 86,944 B | 86,944 B | Renders in the adjusted fallback (Arial / Times New Roman): a mixed face inside a word. This regresses on the Google era. | None |
| B. latin + latin-ext in one call per family | 12 files, 157,680 B (every page) | 157,680 B | In family, through composite-face fallthrough. It depends on array order (the last face is checked first, and the fallback-metric file is the last 400 face). | None |
| **C. latin preloaded, plus a non-preloaded latin-ext companion face per family** | **6 files, 86,944 B** | **157,680 B (latin-ext only when a page renders such text)** | **In family**: the same behaviour as the Google era for these two subsets | Three companion CSS variables, listed ahead of each family in the three font tokens in `globals.css` |

**Choice: C.** It is the only option that meets the brief's three constraints together: names render in the family, the preload stays limited to what every page needs (latin), and the total size stays modest (154.0 KiB, against 143.9 KiB shipped in the Google era).
- Why the companion goes ahead of the family: a face whose `unicode-range` excludes a character is skipped without being downloaded. Its `unicode-range` also excludes U+0020, so it is never the "first available font", and line-height and `ch`/`ex` metrics still come from the latin face or its adjusted fallback.
- Why vietnamese and cyrillic are left out:
  - The UI is en-AU.
  - Instrument Serif has no vietnamese subset at all.
  - "Ngô" is already covered by latin (ô is U+00F4).
  - Vietnamese tone letters such as ễ (U+1EC5) are outside latin + latin-ext, so they keep falling back. This is recorded as a known gap, with sizes above, for a later decision.

## 5. Spike results (production build of option C, Chromium via CDP `CSS.getPlatformFontsForNode`)

- **Preloads.** `/sign-in` preloads exactly 6 fonts, all same-origin `/_next/static/media/*.p.woff2`. Their bytes hash to the six latin files.
- **Real elements.** Each renders a single custom face:
  - `.sign-in-card h1` and `.wordmark`: `InstrumentSerif-Regular`.
  - `.sign-in-eyebrow`: `IBMPlexMono-Regular`.
  - `.sign-in-lead`: `PlusJakartaSans-Regular`.
- **Weights.** Probes give `PlusJakartaSans-Medium` (500), `PlusJakartaSans-SemiBold` (600) and `IBMPlexMono-Medium` (mono 500).
- **latin-ext.** "Łukasz Dvořák Māori Ştefan" renders entirely in `PlusJakartaSans-Regular`, `InstrumentSerif-Regular` and `IBMPlexMono-Regular` (one custom face each).
- **On demand.** Before that text, only the six latin files were fetched. Afterwards, exactly the latin-ext 400 file of each family was added. The 500/600 latin-ext faces stayed `unloaded`.
- **Vietnamese.** "Ngô Nguyễn": 9 glyphs in Plus Jakarta Sans, and ễ (1 glyph) in Arial.
- **Third parties.** No request left the origin. The HTML and the linked stylesheet name no Google host.
- **Computed `font-family`.** `jakartaLatinExt, jakarta, "jakarta Fallback", "Plus Jakarta Sans", system-ui, sans-serif`, and the same pattern for display and mono.
- **Adjusted fallbacks, as computed by `next/font/local` from the files.** The fallback fonts are the same as the Google era, and the metrics are within 3%:
  - Plus Jakarta Sans: Arial; 98.16% / 20.99% / 0% / 105.75%.
  - Instrument Serif: Times New Roman; 117.87% / 36.91% / 0% / 83.99%.
  - IBM Plex Mono: Arial; 77.95% / 20.91% / 0% / 131.49%.

## 6. Hermetic build: control and treatment

Both builds sent all outbound HTTP(S) to a dead local proxy (`HTTP_PROXY`, `HTTPS_PROXY` and `ALL_PROXY`, upper and lower case, all `http://127.0.0.1:9`), each into a fresh dist directory:

- **Control** (`next/font/google`, `25bfc73`): `next build` exits 1. `Error: Turbopack build failed with 3 errors … Failed to fetch IBM Plex Mono from Google Fonts. If you are offline or behind a proxy, self-host the font with next/font/local …`, preceded by "There was an issue establishing a connection while requesting https://fonts.googleapis.com/css2?family=…" for each family.
- **Treatment** (option C): `next build` exits 0 with no warning. The whole build output (server and static) contains no `fonts.googleapis.com` or `fonts.gstatic.com`.

The same treatment check is to be repeated on the committed code at verification.
