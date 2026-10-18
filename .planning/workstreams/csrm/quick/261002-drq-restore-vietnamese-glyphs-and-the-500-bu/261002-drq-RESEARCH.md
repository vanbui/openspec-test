---
quick_id: 261002-drq
task: Typography follow-ups to 261002-2y8 (G-10): Vietnamese glyphs, the Button weight, form-field type
researched: 2026-10-02
researcher: csrm-worker (orchestrator spike before planning)
base: 72e53a6 on post-demo
---

# Research: Vietnamese companions and the layered form-control reset

Evidence gathered before planning. Every browser measurement ran on the production build through the Playwright harness (`pnpm --dir apps/csrm test:e2e <spec> --project=desktop`), with a temporary spike spec copied into `apps/csrm/e2e/` for the run and deleted straight after. Run A measured HEAD; run C measured a candidate of the changes below. The candidate was then reverted byte for byte from backups: `git status --short` showed only the three operator items afterwards. Raw output: `<scratchpad>/typo/out/` (`A-*.json`, `C-*.json`, `AC-crossrun.txt`), where `<scratchpad>` is `/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad`.

## 1. Source files

`npm pack` of the three @fontsource 5.3.0 packages from `https://registry.npmjs.org/` into `<scratchpad>/typo/tarballs/`. Each tarball's recomputed sha512 equals the registry's `dist.integrity`, which equals the Source table in `apps/csrm/app/fonts/README.md`:

| Package | sha512 (= registry dist.integrity = README) | shasum |
|---|---|---|
| `@fontsource/plus-jakarta-sans@5.3.0` | `sha512-9WRw3G74Ve4cyPApAZSXLPY5DiLOZXDn7Q7dIBjFBpA0Pj56ljDItEdy2UUajjJxRuTg2HkMLO5C3K2nAQORWg==` | `a1c37aec60423dd44476d9da00bd34ce546ee859` |
| `@fontsource/ibm-plex-mono@5.3.0` | `sha512-eTgnZjZEGk1QtD3ZstF+Vclo2HLAni8YMy34/DxllwZvyz1lR/1RF/xTiAquOBO7MvqBx8D2Ig2WCPMVfdZu7Q==` | `1879699d104602d5331e28e103f33c3b1b766b17` |
| `@fontsource/instrument-serif@5.3.0` | `sha512-mDiaIg0u67sYV59fie92Wz4sM8UiVlbL7fLxnFPCKkX15DMASEnQTREbaP5S5/3DCcsoAOcQ0sV9E4AeY4QqYQ==` | `57d45e62debe978653a14b7152299c6d76762fe2` |

The 12 committed woff2 files are byte-identical (`cmp`) to their `package/files/` originals in these tarballs.

The tarballs are extracted under `<scratchpad>/typo/tarballs/x-<package>/package/`. Files to ship, unmodified, from `package/files/`:

| File | Bytes | SHA-256 |
|---|---:|---|
| `plus-jakarta-sans-vietnamese-400-normal.woff2` | 4,096 | `89bca04c713c80fb9ec1c757c21b3ea1bcb46fe1612e11c21ca78db121003280` |
| `plus-jakarta-sans-vietnamese-500-normal.woff2` | 4,284 | `71b1934f88d0de7be49026dbd4dcea3347267b896255b3d6f68ab91ce336a939` |
| `plus-jakarta-sans-vietnamese-600-normal.woff2` | 4,196 | `a8443c4814ae569fb8170ed2d6175c077d3742e821d4986b0c2f6f1f452b1b09` |
| `ibm-plex-mono-vietnamese-400-normal.woff2` | 5,868 | `62632b6375305e70ddcafdd895218e6ae41a184fcd280a69c739460604ca00a9` |
| `ibm-plex-mono-vietnamese-500-normal.woff2` | 6,040 | `781633d95de88040fb77141d1e65d928c87c0144691fbc74da5a64d137a7e910` |

Totals: Plus Jakarta Sans 12,576 B, IBM Plex Mono 11,908 B, 24,484 B in all (as 261002-2y8's summary predicted). Shipped after this task: 17 files, 182,164 B (157,680 + 24,484). Preloaded: unchanged, the 6 latin files, 86,944 B.

- **Range.** Both packages' `unicode.json` give the same vietnamese range: `U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB`.
- **Instrument Serif.** `@fontsource/instrument-serif@5.3.0` ships only latin and latin-ext files (`package/files/` lists nothing else; `unicode.json` has two keys). There is no vietnamese face to add.
- **Names.** In the browser the vietnamese files report the same PostScript names as the family's other subsets: `PlusJakartaSans-Regular`, `-Medium`, `-SemiBold`; `IBMPlexMono-Regular`, `-Medium`.
- **Bytes.** `.gitattributes` already has `apps/csrm/app/fonts/*.woff2 binary`, so the new files need no attribute change.

## 2. Where the vietnamese companion sits in each token

The vietnamese range covers 111 code points:
- 87 are covered by no other shipped subset: `U+0300-0301, U+0303, U+0309, U+0323, U+1EA0-1EF1`. These are the Vietnamese tone letters and five combining marks.
- 24 are also in latin-ext: `Ă ă Đ đ Ĩ ĩ Ũ ũ Ơ ơ Ư ư`, `U+0304, U+0308, U+0329, U+1EF2-1EF9, U+20AB`. Three of those (`U+0304, U+0308, U+0329`) are also in latin.

Google and fontsource declare a family's faces as vietnamese, then latin-ext, then latin. Since the last declared face is checked first, latin wins over latin-ext, which wins over vietnamese. In the companion pattern, list order decides instead.

**Order chosen: latin-ext companion, then vietnamese companion, then the latin face.**
- The vietnamese file then loads only for the 87 code points nothing else covers.
- Text with `ă`, `Đ`, `Ơ`, `Ư` (Romanian and Croatian names, or `Đặng` and `Dương` in Vietnamese) keeps using latin-ext, as it does today. This matches the Google-era precedence for every code point the two subsets share.
- With the vietnamese companion first instead, a Romanian `Bălan` or a Croatian `Đorđević` would fetch the vietnamese file.
- The latin face stays last, because its variable expands to `'jakarta', 'jakarta Fallback'` and the fallback face has no unicode-range.
- Like latin-ext, the vietnamese range excludes U+0020. It is never the first available font and needs `adjustFontFallback: false`.

## 3. Run A: HEAD

- **Vietnamese name.** The probe text was `Nguyễn Văn Đức, Trần Thị Hồng, Phạm Đỗ Huỳnh`. Sans at 400, 500 and 600, and mono at 400, 500 and uppercase, each rendered 37 glyphs in the family face and 7 in `ArialMT` (ễ ứ ầ ị ồ ạ ỗ). Display rendered 37 glyphs in `InstrumentSerif-Regular` and 7 in `TimesNewRomanPSMT`. `ă`, `Đ` and `ỳ` already render in family through latin-ext.
- **Button.** "Continue as Requestor" computes 14px / 20px / weight 400 / letter-spacing −0.35px and renders `PlusJakartaSans-Regular`, 21 glyphs.
- **The reset, emulated.** The spike moved the unlayered `button, select, input, textarea { font: inherit; }` into `@layer base` in the live CSSOM and recomputed every control. It found exactly one such rule on each page. 35 route states were visited at 375px and 1440px each, 70 visits in all:
  - sign-in;
  - 27 Security Analyst states: dashboards, the request, risk, assessment and questionnaire lists and details, alerts, reports, and the admin lists, new forms, a Control detail and the CSV import;
  - 7 Requestor states: dashboard, requests, the new request form, a request detail, assessments, questionnaires, and a questionnaire answering form.

  Of 1,098 rendered controls, 389 changed:
  - Every `Button` that carries `text-button` went from 400 to 500. The DataTable toolbar density toggles and the pagination icon buttons also went from 12px/16px to 14px/20px: they sit in a `text-xs` row and had inherited it.
  - Every `Input` and `Textarea` at 375px went from 14px/20px to 16px/24px. This is their own shadcn `text-base … md:text-sm`, which had never applied.
  - Nothing else changed. Native selects, the raw sort-header and listbox-option buttons, and the Radix checkbox and radio controls keep their computed type.

Two defects the move does not fix:
1. **Buttons that lose `text-button`.**
   - **Cause.** tailwind-merge reads `text-button` as a text colour, so `cn()` drops it beside a variant's colour utility. The default and outline variants already use `!text-…` for this reason, as the comment in `button.tsx` explains. The destructive (`text-destructive-foreground`), secondary (`text-secondary-foreground`) and link (`text-foreground`) variants do not.
   - **Effect.** "Release assessment" (destructive) and "Clear filters" (link) carry no `text-button` class, so they stay at 14px / 400 / no tracking after the move.
   - **Elsewhere.** `segmented-control.tsx` and the two footer-link classes (`analyst-dashboard.tsx`, `treatment-performance-report.tsx`) document the same pitfall.
2. **Fields inside a `font-medium` label.**
   - **Effect.** Search inputs and filter selects wrapped in a label with `text-sm font-medium` inherit weight 500, before and after the move. Direction §3.10 sets inputs at `--text-body` 400, with 500 for form labels only, and §4 Forms agrees.
   - **Where.** Requests, review requests, review assessments, questionnaires, review questionnaires, released assessments, the risk register, alerts, and the admin list filters.

## 4. Run C: the candidate

The candidate:
- **Fonts.** The two vietnamese companions, and the token order of §2.
- **Reset.** The reset moved into `@layer base`, plus `select, input, textarea { font-weight: 400; }` in the same layer.
- **Primitives.** `text-sm` in place of `text-base … md:text-sm` in the Input and Textarea primitives.
- **Variants.** `!text-destructive-foreground`, `!text-secondary-foreground` and `!text-foreground` (link) in `button.tsx`.

The production build compiled. Turbopack accepts the new literal loader calls.

**Fonts on /sign-in:**
- **Faces.** The Vietnamese name renders in one face per probe, 44 glyphs each: `PlusJakartaSans-Regular`, `-Medium` and `-SemiBold`, and `IBMPlexMono-Regular` and `-Medium`, including uppercase mono. Display renders 37 glyphs in `InstrumentSerif-Regular` and 7 in `TimesNewRomanPSMT`: the known gap, since Instrument Serif has no vietnamese subset.
- **Before any probe.** Only the six latin files load, as preloads.
- **After latin-ext text.** `Łukasz Dvořák Māori Ştefan Đorđević Bălan` includes `Đ`, `đ` and `ă`, which the vietnamese range also covers. Only `plus-jakarta-sans-latin-ext-400-normal.woff2` is added, and no vietnamese file.
- **After the Vietnamese name.** The vietnamese files of the weights the probes used load. The spike probed every weight, so all five loaded. FontFace names: `jakartaVietnamese`, `plexMonoVietnamese`.

**The 70 visits again, compared element by element with run A** (`AC-crossrun.txt`):
- **Buttons.** All 242 rendered Buttons now compute 14px / 20px / 500 / −0.35px, including "Release assessment" (destructive) and "Clear filters" (link). No visible Button is below 500.
- **Fields.**
  - The 72 label-wrapped inputs, selects and checkboxes go from 500 to 400.
  - Every Input and Textarea keeps 14px/20px/400 at both widths, identical to HEAD.
  - The only visible fields that are not 14px are pre-existing and deliberate:
    - the DataTable "Rows per page" select (12px, from its `text-xs` pagination row);
    - the development-only role switcher select (13px, from its unlayered `.role-switcher select` rule).
- **Raw buttons.** All 270 rendered raw buttons are unchanged: sort headers, listbox options, the Radix checkbox and radio items, and the text-style "Clear" and "Retry" buttons.
- **Overflow.** No page overflows horizontally at 375px or 1440px.
- **No vietnamese file.** None was requested on any of the 70 visits. No seeded page renders a Vietnamese-range character: a scan of `apps/backend/src`, `apps/backend/database`, `apps/backend/config`, `apps/csrm/src`, `apps/csrm/app` and `apps/csrm/e2e` found none.

## 5. Facts for the plan

- `next/font/local` sets preload and declarations per call, and loader arguments must be literals (261002-2y8 RESEARCH §1). Each companion is its own call with the range written inline. Turbopack names the face after the binding, so the companions must be named exactly `jakartaVietnamese` and `plexMonoVietnamese`.
- `apps/csrm/tsconfig.json` includes `**/*.ts`, so `next build` type-checks `e2e/` too. A type error in a spec fails the harness build.
- Line endings in the working tree:
  - LF: `app/fonts.ts`, `app/fonts/README.md`, `src/lib/security/self-hosted-fonts.test.ts`.
  - CRLF: `app/globals.css`, `src/components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `e2e/design-system-conformance.spec.ts`.

  Edit with the Edit tool. `sed -i` from Git Bash rewrote CRLF files as LF in the spike.
- **Unit tests.** No unit test asserts the classes this changes (`text-base`, `md:text-sm`, `text-destructive-foreground`, `text-secondary-foreground`). `src/components/ui/button.test.tsx` already asserts that `text-button` survives on the outline variant, and is the place for a guard over every variant.
- **The e2e audit.** The type-contract scan in the conformance spec skips inputs, because `''` passes `??` and an input's empty textContent is used. It accepts 14px/500 and 16px/400 against the body (500) and prose tokens, so it would not have caught either the 16px fields or the 500 fields. A direct assertion is needed.
- **iOS.** shadcn's 16px input size below md exists to stop iOS Safari zooming on focus. The app has rendered 14px inputs at every width so far, and the direction sets inputs at `--text-body` 14px. Changing that is a design decision for the direction, not this task.
