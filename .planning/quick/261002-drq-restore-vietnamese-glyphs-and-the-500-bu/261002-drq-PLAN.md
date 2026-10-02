---
phase: quick-261002-drq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-400-normal.woff2
  - apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-500-normal.woff2
  - apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-600-normal.woff2
  - apps/csrm/app/fonts/ibm-plex-mono-vietnamese-400-normal.woff2
  - apps/csrm/app/fonts/ibm-plex-mono-vietnamese-500-normal.woff2
  - apps/csrm/app/fonts/README.md
  - apps/csrm/app/fonts.ts
  - apps/csrm/app/globals.css
  - apps/csrm/src/lib/security/self-hosted-fonts.test.ts
  - apps/csrm/src/lib/security/root-fallbacks.test.tsx
  - apps/csrm/src/components/ui/button.tsx
  - apps/csrm/src/components/ui/button.test.tsx
  - apps/csrm/src/components/ui/input.tsx
  - apps/csrm/src/components/ui/textarea.tsx
  - apps/csrm/e2e/design-system-conformance.spec.ts
  - docs/adr/0001-adopt-bproton-design-system.md
  - .planning/NEXT-WAVE-DECISIONS.md
  - .planning/quick/261002-2y8-self-host-the-three-bproton-font-familie/deferred-items.md
  - .planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/261002-drq-deferred-items.md
autonomous: true
requirements: [G-10]

estimate:
  tokens: 92000
  raw_tokens: 92000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "On the production build, the Vietnamese name 'Nguyễn Văn Đức, Trần Thị Hồng' renders in exactly one face per probe: PlusJakartaSans-Regular for sans 400 and IBMPlexMono-Regular for uppercase mono (no mixed face); both vietnamese 400 files load only after it renders, and no vietnamese 500 or 600 file loads (D-2, D-3, D-4, D-11)"
    - "/sign-in still preloads exactly the six latin files; latin-ext text, including 'Đorđević Bălan' whose letters both subsets cover, renders in family, loads the latin-ext 400 files and loads no vietnamese file (D-4, D-11)"
    - "Display text with the Vietnamese name renders InstrumentSerif-Regular plus at least one platform (non-custom) font and no other custom face: Instrument Serif has no vietnamese subset and falls back, as recorded (D-5, D-11)"
    - "apps/csrm/app/fonts holds 17 woff2 files and 3 licence files that hash to their README rows; the five vietnamese files are byte-identical to the @fontsource 5.3.0 tarball files (RESEARCH section 1) in the working tree and the index; no package.json, lockfile or .gitattributes change (D-2, D-6, D-7)"
    - "fonts.ts makes eight next/font/local calls, exports exactly jakarta, instrument, plexMono and fontVariableClassName, and the html element carries the eight variable classes in D-3 order; layout.tsx and global-error.tsx are unchanged (D-3, D-7)"
    - "Every visible Button on /app/risks?state=open (Security Analyst) and /app/requests/new (Requestor) at 375px and 1440px, the 'Continue as Requestor' button and the destructive 'Delete question' and its 'Cancel', computes 14px, line height 20px, weight 500 and letter-spacing -0.35px in the sans family; 'Continue as Requestor' renders PlusJakartaSans-Medium (D-8, D-10, D-12)"
    - "Every visible input, textarea and select in main on those pages, except the DataTable 'Rows per page' select, computes 14px and weight 400 in the sans family at 375px and 1440px; inputs and textareas compute line height 20px; no Vietnamese FontFace loads on those pages (D-8, D-9, D-12)"
    - "ADR 0001's Amended line, What changed and Coverage bullets name the vietnamese companions, the token order, Instrument Serif's fallback and 261002-drq; G-10's follow-up is marked done; 261002-2y8's D-1 is marked resolved; the design direction is unchanged (D-1, D-13)"
  artifacts:
    - path: apps/csrm/app/fonts.ts
      provides: "Eight next/font/local calls: three preloaded latin faces (exported), three latin-ext companions and two vietnamese companions (jakartaVietnamese, plexMonoVietnamese), all companions on demand by unicode-range; fontVariableClassName joins eight variables"
      contains: "--font-jakarta-vietnamese"
    - path: apps/csrm/app/fonts/README.md
      provides: "17 woff2 rows plus 3 licence rows with bytes and SHA-256; Coverage: latin preloaded, latin-ext and vietnamese on demand, the order and why, Instrument Serif falls back, cyrillic not shipped"
      contains: "plus-jakarta-sans-vietnamese-400-normal.woff2"
    - path: apps/csrm/app/globals.css
      provides: "--font-sans and --font-mono list latin-ext, then vietnamese, then the latin face; the form-control font reset in @layer base with fields at weight 400"
      contains: "var(--font-jakarta-vietnamese)"
    - path: apps/csrm/src/components/ui/button.tsx
      provides: "Every variant's text colour is important, so tailwind-merge keeps text-button"
      contains: "!text-destructive-foreground"
    - path: apps/csrm/src/components/ui/button.test.tsx
      provides: "Guard: every variant at every size keeps text-button"
      contains: "destructive"
    - path: apps/csrm/src/lib/security/self-hosted-fonts.test.ts
      provides: "Unit guard: eight loader calls with their ranges, 17 woff2 + 3 txt against the README, subset partner rule, vietnamese set, token order, eight-class export"
      contains: "vietnameseRange"
    - path: apps/csrm/e2e/design-system-conformance.spec.ts
      provides: "Browser proof: Vietnamese renders in family and loads on demand; display falls back; Buttons at the button token, fields at the body token, no vietnamese file on Vietnamese-free pages"
      contains: "jakartaVietnamese"
    - path: docs/adr/0001-adopt-bproton-design-system.md
      provides: "The 2026-10-02 amendment updated for the vietnamese companions"
      contains: "261002-drq"
  key_links:
    - from: apps/csrm/app/fonts.ts
      to: apps/csrm/app/fonts/
      via: "Each companion src entry's path is './fonts/<family>-vietnamese-<weight>-normal.woff2', resolved relative to app/"
      pattern: "./fonts/plus-jakarta-sans-vietnamese-400-normal.woff2"
    - from: apps/csrm/app/globals.css
      to: apps/csrm/app/fonts.ts
      via: "--font-sans and --font-mono read the latin-ext companion, then the vietnamese companion, then the latin face"
      pattern: "var(--font-jakarta-latin-ext), var(--font-jakarta-vietnamese)"
    - from: apps/csrm/app/globals.css
      to: apps/csrm/src/components/ui/button.tsx
      via: "The layered reset no longer beats the text-button utility, so its 500 weight and tracking apply"
      pattern: "@layer base"
    - from: apps/csrm/src/components/ui/button.tsx
      to: apps/csrm/src/lib/utils.ts
      via: "cn() (tailwind-merge) keeps text-button only beside an important text colour"
      pattern: "!text-"
    - from: apps/csrm/src/lib/security/self-hosted-fonts.test.ts
      to: apps/csrm/app/fonts/README.md
      via: "Parses the README rows and requires every committed file to hash to its row"
      pattern: "README.md"
---

<objective>
Make the app conform to the direction's typography (`docs/design/csrm-design-direction.md` §3.10 and §4), with no design value changed (D-1):
1. Restore Vietnamese glyphs in family for Plus Jakarta Sans (400/500/600) and IBM Plex Mono (400/500) by serving their vietnamese subsets on demand through unicode-range companion faces. This adds 24,484 B, never preloaded (D-2 to D-7, D-11).
2. Let every Button render its `--text-button` token (500, −0.025em) and every form field its `--text-body` token, by moving the form-control font reset into `@layer base` (D-8 to D-10, D-12).
3. Record both (D-13, D-14).

Purpose: names such as "Nguyễn" now mix faces (G-10 follow-up), and every Button renders at weight 400 rather than 500 (261002-2y8 deferred item D-1).

Output: five woff2 files, `fonts.ts` with eight calls, the token order, the README, two unit guards, the layered reset, the Button variant fix, the field primitives, two browser proofs on the production build, and the records.

All decisions D-1 to D-14 are locked (orchestrator brief, from `261002-drq-RESEARCH.md`). Do not re-decide them, and do not re-probe what RESEARCH measured.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@apps/csrm/AGENTS.md
@.planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/261002-drq-RESEARCH.md

Context budget (estimate 92k tokens, smart zone 100k):
- **One read per file.** Each task's `<read_first>` names only that task's files, by line range or by anchor. RESEARCH.md above is the only copy: no task re-reads it, and the tasks cite its sections. 261002-2y8's PLAN is not needed: RESEARCH carries its facts.
- **Short tool output.** The red checks print only their tail. Both Playwright verifies write the full log to the scratchpad and print its last 25 lines. On a failure, grep that log for the failing message; never print it whole.
- **Resume point.** Task 1 step 9 is a context checkpoint. Tasks 2 and 3 need only this plan and git, so a fresh executor can resume at Task 2.

Next.js in this repo (16.3.6, Turbopack) differs from training data. The `next/font/local` guide is at `apps/csrm/node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`.

Facts established in RESEARCH.md (do not re-probe):
- **Loader.** `next/font/local` sets `preload` and `declarations` per call, so each companion is its own call. Loader arguments must be literals, so each range is written inline. Turbopack names each face after its JavaScript binding, so the companions must be named exactly `jakartaVietnamese` and `plexMonoVietnamese`. The build accepts these calls (RESEARCH §4, run C).
- **Vietnamese range.** Both packages give: `U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB`.
- **Names.** In the browser the vietnamese files report the family's existing PostScript names (`PlusJakartaSans-Regular`, `-Medium`, `-SemiBold`, `IBMPlexMono-Regular`, `-Medium`), and CDP reports one entry per face.
- **Computed family.** On a Button after the change it is `jakartaLatinExt, jakartaVietnamese, jakarta, "jakarta Fallback", "Plus Jakarta Sans", system-ui, sans-serif`.
- **Display fallback.** The Vietnamese name in display text gives `InstrumentSerif-Regular` (custom) and `TimesNewRomanPSMT` with `isCustomFont: false`.
- **Run C.**
  - All 242 rendered Buttons compute 14px / 20px / 500 / −0.35px. This includes the `icon-xs` and `sm` toolbar Buttons, "Clear filters" (link) at 375px and 1440px, and "Release assessment" (destructive).
  - Every Input and Textarea computes 14px/20px/400 at both widths.
  - Label-wrapped fields go from 500 to 400.
  - No page overflows horizontally.
  - No vietnamese file is requested on any of the 70 visits.
- **Typecheck.** `apps/csrm/tsconfig.json` includes `**/*.ts`, so the harness's `next build` type-checks `e2e/`. A type error in the spec fails the Playwright run.
- **Optional reference.** The orchestrator's spike spec shows the shape of the evaluate calls: `/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/typo/zz-g10-spike.spec.ts`. The spec's own `platformFonts` and `probe` helpers already show that shape, so read the spike only if an evaluate call fails on its shape. Never copy it into the repository.

Planning base: `72e53a6` on `post-demo`. The verify commands diff against it, so they hold before and after each task's commit.

Host rules (orchestrator brief):
- **Node.** Every Bash command that runs node, npm or pnpm starts with `source "/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/node24.sh"`. Never run `nvm use`.
- **Playwright arguments.** Filtered Playwright runs pass their arguments straight after the script name. Never use `-- --grep`, because pnpm 11 forwards the literal `--`.
- **Line endings.** `core.autocrlf` is true.
  - LF in the working tree: `app/fonts.ts`, `app/fonts/README.md`, `src/lib/security/self-hosted-fonts.test.ts`, `.planning/NEXT-WAVE-DECISIONS.md`, 261002-2y8's `deferred-items.md`.
  - CRLF: `app/globals.css`, `src/components/ui/button.tsx`, `button.test.tsx`, `input.tsx`, `textarea.tsx`, `src/lib/security/root-fallbacks.test.tsx`, `e2e/design-system-conformance.spec.ts`, `docs/adr/0001-adopt-bproton-design-system.md`.
  - Edit every existing file with the Edit tool, so line endings stay as they are. Never use `sed -i`.
- **Staging.** Stage by explicit path only, never `git add -A` or `git add .`.
  - Never stage `apps/backend/types/generated/*.d.ts`, `example-risk-assessment-questions/` or `apps/csrm/src/lib/api/generated/schema.d.ts`.
  - Never push, merge, rebase, reset, stash, clean, switch branches or run any destructive git command.
- **Secrets.** Never read or print a `.env*` file.
- **Dev mode.** Keep `CSRM_AUTH_OIDC_ENABLED=false` and `CSRM_DEV_IDENTITY=true`. Never start Keycloak, and never start a dev server.
- **Before a Playwright run.** Make sure no Strapi or Next dev server is running, because `strapi develop` shares `apps/backend/dist` with the harness. A run must leave the tree clean. If a failed run keeps a database or build, remove what the harness lists once you have debugged it.
- **Planning files.**
  - Do not edit `.planning/STATE.md` or `ROADMAP.md`.
  - Do not commit this task's PLAN, SUMMARY, VERIFICATION, RESEARCH or `261002-drq-deferred-items.md`; the orchestrator's docs commit does that.
- **Commits.** Each commit has the subject given, a short bullet body in the repo's style, a blank line, then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Stop.** Stop and report, rather than work around it, if a step would break an AGENTS.md non-negotiable or needs a destructive git operation.
- **Writing.** Australian English, sentence case, terse.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (tracer): serve the vietnamese companions of Plus Jakarta Sans and IBM Plex Mono on demand, from the committed files to a rendered Vietnamese name (D-2 to D-7, D-11)</name>
  <files>apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-400-normal.woff2, apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-500-normal.woff2, apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-600-normal.woff2, apps/csrm/app/fonts/ibm-plex-mono-vietnamese-400-normal.woff2, apps/csrm/app/fonts/ibm-plex-mono-vietnamese-500-normal.woff2, apps/csrm/app/fonts/README.md, apps/csrm/app/fonts.ts, apps/csrm/app/globals.css, apps/csrm/src/lib/security/self-hosted-fonts.test.ts, apps/csrm/src/lib/security/root-fallbacks.test.tsx, apps/csrm/e2e/design-system-conformance.spec.ts</files>
  <precondition>The five source files exist under /c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/typo/tarballs/x-{plus-jakarta-sans,ibm-plex-mono}/package/files/ (or D-2's npm pack fallback applies). git status --short shows only the three operator items and this quick directory, and no Strapi or Next dev server is running.</precondition>
  <read_first>
    - apps/csrm/app/fonts.ts (the latin-ext companion pattern to follow), apps/csrm/app/fonts/README.md, apps/csrm/app/globals.css lines 186-197
    - apps/csrm/src/lib/security/self-hosted-fonts.test.ts (all five cases), apps/csrm/src/lib/security/root-fallbacks.test.tsx lines 1-20 and 85-95
    - RESEARCH §1, §2 and §4 are already in `<context>`; do not re-read the file. Step 7 reads the e2e spec itself, when it starts.
  </read_first>
  <behavior>
    - root-fallbacks: the global error document's html element carries `jakarta-variable jakarta-latin-ext-variable jakarta-vietnamese-variable instrument-variable instrument-latin-ext-variable plex-mono-variable plex-mono-latin-ext-variable plex-mono-vietnamese-variable`.
    - self-hosted-fonts case 1: exactly eight loader calls, one per variable. `--font-jakarta-vietnamese` takes the three plus-jakarta-sans vietnamese files and `--font-plex-mono-vietnamese` the two ibm-plex-mono ones. Both have preload false, adjustFontFallback false, swap display and the single vietnamese unicode-range declaration. The six existing calls are unchanged.
    - case 2: the exports are still exactly fontVariableClassName, instrument, jakarta and plexMono, and fontVariableClassName is the eight classes in D-3 order.
    - case 3:
      - app/fonts holds exactly 17 woff2 and 3 txt files, equal to the README rows and, for the woff2 files, to the loaded files, each hashing to its row.
      - Every latin-ext or vietnamese file has its latin partner of the same family and weight, and every latin file still has its latin-ext partner.
      - The vietnamese files are exactly plus-jakarta-sans 400/500/600 and ibm-plex-mono 400/500, and instrument-serif has none.
    - case 5: --font-sans and --font-mono equal the D-4 strings, and --font-display is unchanged.
    - Browser:
      - The Vietnamese name renders in one face per probe (sans 400 PlusJakartaSans-Regular, uppercase mono IBMPlexMono-Regular), and only then do the two vietnamese 400 files load.
      - Latin-ext text, including 'Đorđević Bălan', loads no vietnamese file.
      - Display shows InstrumentSerif-Regular plus a platform fallback.
  </behavior>
  <action>
Work in this order. Paths are repo-root-relative. SCRATCH means /c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/typo/tarballs. It is the only external path read; verify 4's log in the same scratchpad is the only external path written.

1. **Copy the files (D-2).**
   - `cp` (a byte copy, nothing else) these five files into `apps/csrm/app/fonts/`, keeping each name:
     - SCRATCH/x-plus-jakarta-sans/package/files/plus-jakarta-sans-vietnamese-{400,500,600}-normal.woff2;
     - SCRATCH/x-ibm-plex-mono/package/files/ibm-plex-mono-vietnamese-{400,500}-normal.woff2.
   - Run `sha256sum` on the five copies and compare each with RESEARCH §1:
     - plus-jakarta-sans-vietnamese-400: 89bca04c…003280;
     - -500: 71b1934f…36a939;
     - -600: a8443c48…1b1b09;
     - ibm-plex-mono-vietnamese-400: 62632b63…ca00a9;
     - -500: 781633d9…37e910.

     The full values are in RESEARCH §1. On any mismatch, stop and report.
   - If SCRATCH is missing, D-2 approves `npm pack @fontsource/<package>@5.3.0` into a new scratch directory under the same scratchpad. Recompute the tarball's sha512 (base64) and require it to equal the README Source row before extracting. Download nothing else.
   - Do not touch `.gitattributes`: `apps/csrm/app/fonts/*.woff2 binary` already covers the new files.

2. **README (D-6), `apps/csrm/app/fonts/README.md` (LF).**
   - **Files table.** Add five rows with the same columns (File, Family, Subset `vietnamese`, Weight, Bytes, SHA-256, the full 64-hex value backticked):
     - plus-jakarta-sans-vietnamese-400/500/600 (4,096 / 4,284 / 4,196) directly after the plus-jakarta-sans latin-ext 600 row;
     - ibm-plex-mono-vietnamese-400/500 (5,868 / 6,040) directly after the ibm-plex-mono latin-ext 500 row.
   - **Coverage.** Rewrite it:
     - Latin is preloaded.
     - Latin-ext and, for Plus Jakarta Sans and IBM Plex Mono, vietnamese are downloaded only when a page renders one of their characters (`unicode-range`); they are never preloaded.
     - Each font token lists the latin-ext companion first, then the vietnamese companion, then the latin face. The two subsets share 24 code points (Ă ă Đ đ Ĩ ĩ Ũ ũ Ơ ơ Ư ư, U+0304, U+0308, U+0329, U+1EF2-1EF9 and U+20AB), so latin-ext serves those, and the vietnamese file loads only for the Vietnamese tone letters and combining marks no other subset covers.
     - Instrument Serif has no vietnamese subset (@fontsource ships only latin and latin-ext), so Vietnamese tone letters in display text fall back to Times New Roman.
     - Cyrillic is not shipped.
   - **Unchanged.** The title line, the Source table, the Licence table and "Verify and update" do not change.
   - **Rows the test parses.** Every table row that names a file keeps exactly one backticked file name and one backticked SHA-256. Outside the tables, never write a backticked file name ending in .woff2 or .txt.

3. **Tests first, red (D-7).** Write both test changes, run them, and see them fail against the current fonts.ts.
   a) `apps/csrm/src/lib/security/root-fallbacks.test.tsx` (CRLF). Change only the expected html class string in 'renders its own document with the stylesheet fonts…' to the eight classes in the behaviour list.
   b) `apps/csrm/src/lib/security/self-hosted-fonts.test.ts` (LF):
      - **Header comment.** Eight calls: a preloaded latin face per family, a latin-ext companion per family, and a vietnamese companion for Plus Jakarta Sans and IBM Plex Mono, both on demand. Name 261002-drq beside G-10.
      - **Range constant.** Add `vietnameseRange` holding the vietnamese range from the context above, verbatim, with a one-line comment citing RESEARCH §1 of 261002-drq.
      - **Expected calls.** Add `expectedCalls` entries `--font-jakarta-vietnamese` (three `plus-jakarta-sans-vietnamese-<w>-normal.woff2` faces) and `--font-plex-mono-vietnamese` (two `ibm-plex-mono-vietnamese-<w>-normal.woff2` faces). Both have preload false, adjustFontFallback false and range vietnameseRange. Place each after its family's latin-ext entry.
      - **Case 1.** Expect 8 calls, and make the test name mention vietnamese on demand.
      - **Case 2.** Expect the eight-class string, and make the test name say eight.
      - **Case 3.**
        - Assert `filesIn('.woff2')` has 17 entries and `filesIn('.txt')` 3.
        - Generalise the subset regex to `-(latin|latin-ext|vietnamese)-(\d{3})-normal\.woff2`.
        - Require every latin-ext or vietnamese file to have its `<family>-latin-<weight>-normal.woff2` partner, and every latin file its latin-ext partner, as today.
        - Assert the files containing `-vietnamese-` equal exactly the five names, sorted. That set has no instrument-serif entry.
      - **Case 5.** Expect `--font-sans` to equal `var(--font-jakarta-latin-ext), var(--font-jakarta-vietnamese), var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif` and `--font-mono` to equal `var(--font-plex-mono-latin-ext), var(--font-plex-mono-vietnamese), var(--font-plex-mono), "IBM Plex Mono", ui-monospace, monospace`. `--font-display` is unchanged. Rename the test to say the companions (latin-ext, then vietnamese) come ahead of each family.
      - **Unchanged.** Case 4 and both Google patterns. Name no Google font host anywhere in this file.
   - Run `pnpm --dir apps/csrm exec vitest run src/lib/security/self-hosted-fonts.test.ts src/lib/security/root-fallbacks.test.tsx 2>&1 | tail -n 20` and confirm the summary reports failed tests (red). The diffs are not needed.

4. **Loader (D-3), `apps/csrm/app/fonts.ts` (LF).**
   - **New calls.** Add two module-private calls, each a literal options object:
     - `const jakartaVietnamese = localFont({...})`, directly after `jakartaLatinExt`: src `{ path: './fonts/plus-jakarta-sans-vietnamese-<w>-normal.woff2', weight: '<w>', style: 'normal' }` for 400, 500 and 600; variable `--font-jakarta-vietnamese`.
     - `const plexMonoVietnamese = localFont({...})`, directly after `plexMonoLatinExt`: src the ibm-plex-mono vietnamese 400 and 500 files; variable `--font-plex-mono-vietnamese`.
   - **Options.** Both take `display: 'swap'`, `preload: false`, `adjustFontFallback: false` and `declarations: [{ prop: 'unicode-range', value: '<the vietnamese range, written inline>' }]`. The range is a literal, not a const.
   - **fontVariableClassName.** Join the eight `.variable` values in this order: jakarta, jakartaLatinExt, jakartaVietnamese, instrument, instrumentLatinExt, plexMono, plexMonoLatinExt, plexMonoVietnamese. Its doc comment says it defines the eight font variables on the html element.
   - **Header comment.** Keep its points, and say:
     - Plus Jakarta Sans and IBM Plex Mono have three calls each (latin preloaded, then latin-ext and vietnamese companions on demand).
     - Instrument Serif has two, because @fontsource ships no vietnamese subset for it.
     - The companions' unicode-ranges exclude the space, so neither companion is ever the first available font and neither needs fallback metrics.
   - **Unchanged.** Exports stay exactly jakarta, instrument, plexMono and fontVariableClassName. `layout.tsx` and `global-error.tsx` do not change.

5. **Tokens (D-4), `apps/csrm/app/globals.css` (CRLF, Edit tool).**
   - In `@theme inline`, replace only `--font-sans`, `--font-mono` and the comment above the three tokens.
   - Wrap as today: the name on its own line, values indented four spaces, about 80 columns:
     - `--font-sans:` / `var(--font-jakarta-latin-ext), var(--font-jakarta-vietnamese),` / `var(--font-jakarta), "Plus Jakarta Sans", system-ui, sans-serif;`
     - `--font-mono:` / `var(--font-plex-mono-latin-ext), var(--font-plex-mono-vietnamese),` / `var(--font-plex-mono), "IBM Plex Mono", ui-monospace, monospace;`
   - `--font-display` does not change.
   - The comment says:
     - each family's companions come first, latin-ext then vietnamese (Plus Jakarta Sans and IBM Plex Mono), then the latin face;
     - each companion's unicode-range claims only its own characters, so its file downloads only when a page renders one (G-10);
     - latin-ext comes before vietnamese because the two share letters such as Ă, Đ, Ơ and Ư, so the vietnamese file then loads only for the Vietnamese tone letters and combining marks no other subset covers.
   - Do not write any token name followed by a colon inside the comment, because the unit test requires each token to be declared once.

6. **Green.** Run the three unit files (verify 1), then `pnpm --dir apps/csrm typecheck`. route-boundaries.test.ts must pass unchanged.

7. **Browser proof (D-11), `apps/csrm/e2e/design-system-conformance.spec.ts` (CRLF, Edit tool).** Edit only the self-hosted section (the header comment above it, its helpers and its one test). This step is self-contained.
   - **Read now, not earlier.** Read the spec's lines 1-11 (imports) and 302-482: the header comment, the `committedFonts`, `platformFonts` and `probe` helpers, and the 'self-hosted type families (G-10, R-08-24)' describe. Steps 1-6 did not touch the spec, so these line numbers still hold.
   - **Do not re-read.** Do not re-read anything from steps 1-6. Every value this step asserts is written below or in RESEARCH §2-§4 in `<context>`.
   - **Constants.**
     - Keep `latinExtSample`.
     - Add `sharedLatinExtSample = 'Đorđević Bălan'`: letters both latin-ext and vietnamese cover.
     - Add `vietnameseSample = 'Nguyễn Văn Đức, Trần Thị Hồng'`.
   - **committedFonts().** Add `vietnamese400` (names ending `-vietnamese-400-normal.woff2`) and `vietnameseHeavier` (`/-vietnamese-(?:500|600)-normal\.woff2$/`). The existing `latin` regex already excludes the vietnamese files.
   - **Test opening.** Expect 17 files: latin 6, latinExt400 3, latinExtHeavier 3, vietnamese400 2, vietnameseHeavier 3. Update the 12-file message.
   - **Unchanged.** The preload check (exactly the six latin files), the rendered-face checks, the computed-weight Requestor button check, the sans-500, sans-600 and mono-500 probes, and the "only latin files before latin-ext text" check all stay. The reset is still unlayered in this task; Task 2 changes the button check.
   - **latin-ext step.**
     - Keep the three probes on `latinExtSample`.
     - Add a fourth sans probe `sans-shared-latin-ext` (`font-family: var(--font-sans); font-weight: 400`) on `sharedLatinExtSample`. It must render exactly `[{ isCustomFont: true, postScriptName: 'PlusJakartaSans-Regular' }]`.
     - After polling until the latin-ext 400 files are fetched, await `document.fonts.ready`. Then the fetched files must include no latin-ext 500/600 file and no file from vietnamese400 or vietnameseHeavier (message: latin-ext text, including letters vietnamese also covers, loads no vietnamese file).
   - **Vietnamese step** (new, after the latin-ext step):
     - Add three probes on `vietnameseSample`:
       - `sans-vietnamese` (`font-family: var(--font-sans); font-weight: 400`);
       - `mono-vietnamese` (`font-family: var(--font-mono); text-transform: uppercase`);
       - `display-vietnamese` (`font-family: var(--font-display); font-size: 28px`).
     - Poll sans to exactly PlusJakartaSans-Regular and mono to exactly IBMPlexMono-Regular, each a single custom face (no mixed face).
     - Poll display with a small mapper over `platformFonts` returning `{ custom: <sorted postScriptNames with isCustomFont true>, platform: <true if any isCustomFont false> }`. It must equal `{ custom: ['InstrumentSerif-Regular'], platform: true }`: Instrument Serif has no vietnamese subset (D-5).
     - Poll until the fetched files include both vietnamese400 files.
     - Then require that none of vietnameseHeavier and none of latinExtHeavier was fetched, and that every font response is a committed file.
   - **Rest unchanged.** The origin, host, HTML, stylesheet and build-output checks stay as they are.
   - **Comments and messages.** Update the header comment: the preloads are the six latin files; latin-ext and, for Plus Jakarta Sans and IBM Plex Mono, vietnamese render in family and load only on demand; display text falls back for Vietnamese tone letters. Keep assertion messages in the spec's style. Never write a Google font host as a plain string.
   - **Run.** Run verify 4. It writes the full log to `drq-e2e-task1.log` in the scratchpad and prints the last 25 lines.
     - On a failure, `grep -n` the log for the assertion message or `Error:` and read only those lines.
     - Then fix the spec, or stop and report a real product defect.
     - Leave the tree clean.

8. **Commit.**
   - `git status --short` must show only this task's paths, the three operator items and the quick directory.
   - Stage with `git add --` and the 11 paths in `<files>`. `git diff --cached --name-only` must list exactly 11 paths.
   - Verify 3 checks the five woff2 files in the index: each index blob id must equal `git hash-object` of the hash-checked working-tree file. `git ls-files --eol apps/csrm/app/fonts` must also show `-text` for them.
   - Commit with subject `feat(quick-261002-drq): serve the Vietnamese subsets of Plus Jakarta Sans and IBM Plex Mono on demand` and bullets such as:
     - vendor the five vietnamese woff2 files from @fontsource 5.3.0, byte-identical, with README rows;
     - add a vietnamese companion per family, on demand by unicode-range and never preloaded;
     - order the tokens latin-ext, then vietnamese, then latin;
     - guard the eight calls, the hashes and the subsets in the unit test;
     - prove in the browser that a Vietnamese name renders in family and that Instrument Serif falls back.

9. **Context checkpoint.** After verify 6 passes on the commit, Task 1 is durable, and Tasks 2 and 3 need nothing from this session that is not in this plan or in git:
   - their preconditions are checked with `git log`;
   - their `<read_first>` lists find the spec and globals.css sections by anchor, because this task moved those line numbers;
   - RESEARCH is in `<context>`.

   If more than about half the context window is now used, stop here and return the executor's `## CHECKPOINT REACHED` format:
   - **Type** human-verify.
   - **Completed Tasks** Task 1 and its hash.
   - **Current Task** Task 2, status blocked; **Blocked by** the context checkpoint after the tracer.
   - **Awaiting** a continuation executor at Task 2. There is nothing to check by hand.

   A fresh executor then resumes at Task 2 from this plan and the commit alone. Otherwise go straight on to Task 2.
  </action>
  <verify>
    <automated>source "/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/node24.sh" && pnpm --dir apps/csrm exec vitest run src/lib/security/self-hosted-fonts.test.ts src/lib/security/root-fallbacks.test.tsx src/lib/security/route-boundaries.test.ts</automated>
    <fails_when>non-zero exit, or the vitest summary shows "failed" or "No test files found"</fails_when>
    <automated>source "/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/node24.sh" && pnpm --dir apps/csrm typecheck</automated>
    <fails_when>non-zero exit, or tsc prints an "error TS" line</fails_when>
    <automated>printf '%s *%s\n' 89bca04c713c80fb9ec1c757c21b3ea1bcb46fe1612e11c21ca78db121003280 apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-400-normal.woff2 71b1934f88d0de7be49026dbd4dcea3347267b896255b3d6f68ab91ce336a939 apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-500-normal.woff2 a8443c4814ae569fb8170ed2d6175c077d3742e821d4986b0c2f6f1f452b1b09 apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-600-normal.woff2 62632b6375305e70ddcafdd895218e6ae41a184fcd280a69c739460604ca00a9 apps/csrm/app/fonts/ibm-plex-mono-vietnamese-400-normal.woff2 781633d95de88040fb77141d1e65d928c87c0144691fbc74da5a64d137a7e910 apps/csrm/app/fonts/ibm-plex-mono-vietnamese-500-normal.woff2 | sha256sum -c --quiet - && test "$(ls apps/csrm/app/fonts/*.woff2 | wc -l)" -eq 17 && test -z "$(for f in plus-jakarta-sans-vietnamese-400-normal.woff2 plus-jakarta-sans-vietnamese-500-normal.woff2 plus-jakarta-sans-vietnamese-600-normal.woff2 ibm-plex-mono-vietnamese-400-normal.woff2 ibm-plex-mono-vietnamese-500-normal.woff2; do I="$(git rev-parse --verify --quiet ":apps/csrm/app/fonts/$f")" && W="$(git hash-object "apps/csrm/app/fonts/$f")" && [ -n "$I" ] && [ "$I" = "$W" ] || echo "$f"; done)"</automated>
    <fails_when>non-zero exit, or sha256sum prints "FAILED" for a copy (a woff2 count other than 17, or an index blob that differs from its working-tree file, exits non-zero silently)</fails_when>
    <automated>source "/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/node24.sh" && L="/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/drq-e2e-task1.log" && (pnpm --dir apps/csrm test:e2e e2e/design-system-conformance.spec.ts --project=desktop --grep "self-hosted type families" > "$L" 2>&1; R=$?; tail -n 25 "$L"; exit $R)</automated>
    <fails_when>non-zero exit, or the printed tail shows "failed" or "No tests found", or has no "passed" summary line</fails_when>
    <automated>git diff --quiet 72e53a6 -- package.json pnpm-lock.yaml apps/csrm/package.json .gitattributes apps/csrm/app/layout.tsx apps/csrm/app/global-error.tsx apps/csrm/src/lib/security/route-boundaries.test.ts docs/design/csrm-design-direction.md</automated>
    <fails_when>non-zero exit: a listed file differs from 72e53a6</fails_when>
    <automated>S="$(git status --short)" && test -z "$(printf '%s\n' "$S" | grep -vE '^( M apps/backend/types/generated/(components|contentTypes)\.d\.ts|\?\? example-risk-assessment-questions/|.. \.planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/.*)$')"</automated>
    <fails_when>non-zero exit: git status lists a path other than the three operator items and the quick directory (run after the commit)</fails_when>
  </verify>
  <done>
    - The five vietnamese woff2 files hash exactly to RESEARCH §1 in the working tree, and their index blobs are byte-identical to them. app/fonts holds 17 woff2 files, and the README lists all 17 plus the 3 licences, with the rewritten Coverage section (D-2, D-6).
    - fonts.ts makes eight literal next/font/local calls, the two new ones named jakartaVietnamese and plexMonoVietnamese. The exports are unchanged, and fontVariableClassName joins the eight variables in D-3 order.
    - --font-sans and --font-mono list latin-ext, then vietnamese, then the latin face, and --font-display is unchanged (D-4).
    - self-hosted-fonts.test.ts, root-fallbacks.test.tsx and the unchanged route-boundaries.test.ts pass; they failed red first. typecheck passes (D-7).
    - The 'self-hosted type families' Playwright test passes in the desktop project, with the latin-ext, shared-letter, Vietnamese and display assertions (D-11).
    - One commit with the given subject and trailer, 11 staged paths. package.json, the lockfile, .gitattributes, layout.tsx, global-error.tsx and the direction are unchanged, and the tree is clean apart from the operator items and the quick directory.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: let Buttons and form fields take their type tokens, and prove it on the production build (D-8 to D-10, D-12)</name>
  <files>apps/csrm/app/globals.css, apps/csrm/src/components/ui/button.tsx, apps/csrm/src/components/ui/button.test.tsx, apps/csrm/src/components/ui/input.tsx, apps/csrm/src/components/ui/textarea.tsx, apps/csrm/e2e/design-system-conformance.spec.ts</files>
  <precondition>`git log --format=%s 72e53a6..HEAD` lists Task 1's subject `feat(quick-261002-drq): serve the Vietnamese subsets of Plus Jakarta Sans and IBM Plex Mono on demand`, and no Strapi or Next dev server is running. If Task 1's commit is absent, stop: this task builds on it.</precondition>
  <read_first>
    - docs/design/csrm-design-direction.md lines 222-228 (the --text-body and --text-button rows) and 319-330, 367-371 (section 4 Buttons and Forms)
    - apps/csrm/app/globals.css: Task 1 moved its line numbers, so find the rule with `grep -n 'font: inherit' apps/csrm/app/globals.css`. Read from about 18 lines above that match (the comment that opens the layered anchor reset) to 3 lines below it.
    - apps/csrm/src/components/ui/button.tsx, button.test.tsx, input.tsx, textarea.tsx
    - apps/csrm/src/components/ui/alert-dialog.tsx lines 145-180 and apps/csrm/src/components/csrm/confirm-dialog.tsx lines 80-100 (Cancel and the confirm Button keep data-variant and data-size)
    - apps/csrm/src/components/csrm/data-table.tsx lines 279-283 ('Clear filters', link variant) and 409-416 (the 'Rows per page' select)
    - apps/csrm/e2e/design-system-conformance.spec.ts. Lines 63-84 (signIn, signInAsRequestor) are above Task 1's edits. Task 1 moved everything after line 302, so find the rest with `grep -n "// Rendered faces\|// Before any latin-ext text\|// In-page workflow actions\|^test.describe('components at the direction values'" apps/csrm/e2e/design-system-conformance.spec.ts`, then read:
      - the 'self-hosted type families' block from `// Rendered faces` to `// Before any latin-ext text`;
      - the print test from `// In-page workflow actions` for 9 lines (how it opens the questionnaire);
      - from 4 lines above the 'components at the direction values' describe (its header comment) to the end of the file.
  </read_first>
  <behavior>
    - button.test.tsx: for every variant (default, destructive, outline, secondary, ghost, link) at every size (default, xs, sm, lg, icon, icon-xs, icon-sm, icon-lg), the rendered Button has the class `text-button`. A named case checks destructive (`!text-destructive-foreground` and `text-button`) and link (`!text-foreground` and `text-button`). Destructive, secondary and link fail before the button.tsx change.
    - Browser, self-hosted test: "Continue as Requestor" computes font-weight 500, font-size 14px, line-height 20px and letter-spacing -0.35px, and renders exactly PlusJakartaSans-Medium.
    - Browser, new test, Security Analyst on /app/risks?state=open at 375px and 1440px:
      - every visible `:is(button, a)[data-variant][data-size]` computes 14px / 20px / 500 / -0.35px, and its computed family starts jakartaLatinExt, jakartaVietnamese, jakarta;
      - the link-variant "Clear filters" is among them;
      - every visible field in main computes 14px / 400 in that family.
    - Browser, new test, Requestor on /app/requests/new at both widths: the same Button and field checks, with at least one input, one textarea and one select.
    - Browser, new test, every page above: all five Vietnamese FontFaces stay `unloaded`.
    - Browser, new test, destructive dialog: "Delete question" (data-variant destructive) and "Cancel" compute the button token. Cancel closes the dialog with nothing deleted.
  </behavior>
  <action>
1. **Unit guard first, red (D-10).** In `apps/csrm/src/components/ui/button.test.tsx` (CRLF, Edit tool):
   - Add a test such as 'keeps the text-button type scale on every variant at every size'. It renders a Button for every variant × size pair: the six variants and eight sizes from `buttonVariants`, written out as arrays in the test. Each must have the class `text-button`, with a message naming the variant and size.
   - Add a test for destructive and link by name: each has `text-button` and its important ink (`!text-destructive-foreground`, `!text-foreground`).
   - Keep the comment style of the existing cases: tailwind-merge reads `text-button` as a text colour, so it drops it beside a plain text-colour utility. Direction §3.10 sets every pill label at `--text-button`.
   - Run `pnpm --dir apps/csrm exec vitest run src/components/ui/button.test.tsx 2>&1 | tail -n 30` and confirm destructive, secondary and link fail (red).

2. **Variants (D-10).** In `apps/csrm/src/components/ui/button.tsx` (CRLF):
   - Change only the text colour token of three variants: destructive to `!text-destructive-foreground`, secondary to `!text-secondary-foreground`, link to `!text-foreground`.
   - Rewrite the comment above the variants so it explains the reason for all of them: every variant's ink is important because tailwind-merge reads `text-button` as a text colour and would drop it beside a plain one. Keep the outline note about inherited sidebar text.
   - Re-run the unit test: it must pass (green).

3. **Reset (D-8).** In `apps/csrm/app/globals.css` (CRLF, Edit tool):
   - Delete the unlayered rule that applies `font: inherit` to `button, select, input, textarea`.
   - Directly after the anchor reset's `@layer base { a { … } }` block, add a comment in the anchor comment's style, then a second `@layer base` block holding the rule `button, select, input, textarea { font: inherit; }` followed by `select, input, textarea { font-weight: 400; }`.
   - The comment says:
     - Unlayered, the reset beat every utility, so no Button showed its `text-button` token (direction §3.10, 500), and the Input and Textarea primitives never had their own size utilities.
     - In `@layer base` it is the default that utilities build on.
     - Fields take the body weight even inside a `font-medium` label (§3.10 `--text-body` 400, §4 Forms).
   - No other rule changes, and no `:root` or `@theme` value changes (D-1).

4. **Field primitives (D-9).** In `apps/csrm/src/components/ui/input.tsx` and `textarea.tsx` (CRLF), replace `text-base` with `text-sm` and remove the `md:text-sm` token (one space between neighbours). Change nothing else: `file:text-sm` in input.tsx stays. Inputs and textareas then stay at 14px/20px at every width, as they render today; without this, the move would make them 16px/24px below 768px.

5. **Requestor button (D-12)** in the 'self-hosted type families' test:
   - Replace the computed-weight lookup (the `jakartaFaces` record and its `toContain` check) with direct checks on `button[name="role"][value="Requestor"]`: `toHaveCSS` font-weight '500', font-size '14px', line-height '20px', letter-spacing '-0.35px'. Then `expectFace(requestorButton, 'PlusJakartaSans-Medium')`.
   - Remove the `sans-500` probe and its face check. Keep the `sans-600` and `mono-500` probes.
   - Replace the reset comment with one saying the button proves the Medium face at the `--text-button` token.

6. **New test (D-12).**
   - **Header comment.** Extend the 'components at the direction values' describe's header comment: every Button label is drawn at `--text-button` and every form field at `--text-body` (§3.10, §4 Buttons and Forms).
   - **Placement.** Add one test to that describe, for example 'draws every Button label at the button token and every form field at the body token', with `test.setTimeout(180_000)`.
   - **Helpers.** Add small module-level helpers near the describe:
     - **`sansFamily(fontFamily)`.** Split on commas, trim, strip surrounding quotes, and return the first three names.
     - **`buttonTypography(page)`.** Uses `page.locator(':is(button, a)[data-variant][data-size]').evaluateAll(…)`. Button sets both attributes, and Radix triggers override only its data-slot. It keeps elements with `getClientRects().length > 0` and computed visibility not 'hidden'. It returns `{ label (aria-label or trimmed text, first 40 chars), variant, size, fontSize, lineHeight, fontWeight, letterSpacing, fontFamily }`.
     - **`fieldTypography(page)`.** Covers the same visible elements matching:
       - `main input` with a type other than checkbox, radio, hidden and file;
       - `main textarea`;
       - `main select` other than `select[aria-label="Rows per page"]`, which takes 12px from its pagination row.

       It returns `{ label, tag, type, fontSize, lineHeight, fontWeight, fontFamily }`.
     - **`vietnameseFaces(page)`.** Awaits `document.fonts.ready`, then collects `{ family, weight, status }` with `document.fonts.forEach`, which is typed without casts. It strips quotes from `family` and keeps faces whose family ends in `Vietnamese`.
   - **`expectTypeTokens(page, label)`.** A helper the test calls per page:
     - Every Button has fontSize '14px', lineHeight '20px', fontWeight '500', letterSpacing '-0.35px' and `sansFamily` equal to `['jakartaLatinExt', 'jakartaVietnamese', 'jakarta']`. Report offenders by label, variant and size; the list must equal [].
     - At least one Button exists.
     - Every field has fontSize '14px', fontWeight '400' and the same family. Inputs and textareas also have lineHeight '20px'. Do not assert a select's line height: Chromium keeps it `normal`.
     - `vietnameseFaces` has length 5 (three Plus Jakarta Sans weights, two IBM Plex Mono), and the faces whose status is not 'unloaded' equal []. These pages render no Vietnamese character.
   - **Security Analyst.** `signIn(page)`, then for 375 and 1440: `setViewportSize({ width, height: 900 })` and `goto('/app/risks?state=open')`.
     - Wait for the 'Clear filters' Button to be visible (`getByRole('button', { name: 'Clear filters', exact: true })`).
     - Require that the Buttons from `buttonTypography` include one with variant 'link' labelled 'Clear filters'.
     - Run `expectTypeTokens`.
     - At 1440 also require at least one select and one input among the fields; at 375 the filters sit in a closed sheet.
   - **Destructive Button, at 1440.**
     1. `goto('/app/review/questionnaires')`, then click the 'Customer portal questionnaire awaiting release' link as the print test does (`getByRole('main').getByRole('link', …).filter({ visible: true }).first()`). Wait for its h1.
     2. Count the enabled `getByRole('main').getByRole('button', { name: /^Delete question:/ })` triggers (must be > 0), then click the first visible enabled one.
     3. In `page.getByRole('alertdialog', { name: 'Delete this question?' })`, the 'Delete question' button (exact) must have `data-variant="destructive"`. It and the 'Cancel' button must each compute 14px / 20px / 500 / -0.35px.
     4. Click Cancel, expect the dialog hidden, and require the same trigger count. Nothing is deleted: later tests and specs share this seeded questionnaire.
   - **Requestor.** `signInAsRequestor(page)`, then for 375 and 1440: `goto('/app/requests/new')` and wait for the 'New assessment request' h1.
     - Require at least one input, one textarea and one select among the fields.
     - Run `expectTypeTokens`.
   - **Messages.** Follow the spec's style, for example 'every Button on /app/risks?state=open at 375px is drawn at --text-button'.

7. **Run.** Run verifies 1 to 4. Verify 4 writes the full log to `drq-e2e-task2.log` in the scratchpad and prints the last 25 lines; on a failure, `grep -n` the log for the assertion message or `Error:` and read only those lines. If a Button or field fails, compare the failure with RESEARCH §4 (run C) in `<context>`. A real product defect gets reported, never hidden by relaxing an assertion. Leave the tree clean after every Playwright run.

8. **Commit.**
   - Check the tree first.
   - Stage the six paths in `<files>` with `git add --`. `git diff --cached --name-only` must list exactly 6 paths.
   - Commit with subject `fix(quick-261002-drq): let Buttons and form fields take their type tokens` and bullets such as:
     - move the form-control font reset into @layer base, so Buttons render the direction's 500 button token (§3.10) and fields the body weight;
     - make every Button variant's ink important, so tailwind-merge keeps text-button;
     - keep Input and Textarea at 14px at every width;
     - prove Buttons, the destructive dialog and fields at their tokens at 375px and 1440px, with no vietnamese file loaded.
  </action>
  <verify>
    <automated>source "/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/node24.sh" && pnpm --dir apps/csrm exec vitest run src/components/ui src/lib/security/self-hosted-fonts.test.ts</automated>
    <fails_when>non-zero exit, or the vitest summary shows "failed" or "No test files found"</fails_when>
    <automated>source "/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/node24.sh" && node -e 'const c=require("fs").readFileSync("apps/csrm/app/globals.css","utf8").replace(/\/\*[\s\S]*?\*\//g,"");const layered=/@layer base\s*\{\s*button,\s*select,\s*input,\s*textarea\s*\{\s*font:\s*inherit;\s*\}\s*select,\s*input,\s*textarea\s*\{\s*font-weight:\s*400;\s*\}\s*\}/.test(c);const count=(c.match(/font:\s*inherit/g)||[]).length;if(!layered||count!==1){console.error("RESET_NOT_LAYERED",layered,count);process.exit(1)}' && grep -q 'px-3 py-1 text-sm transition' apps/csrm/src/components/ui/input.tsx && grep -q 'disabled:opacity-50 dark:bg-input/30' apps/csrm/src/components/ui/input.tsx && grep -q 'px-3 py-2 text-sm transition' apps/csrm/src/components/ui/textarea.tsx && grep -q 'aria-invalid:ring-destructive/20 dark:bg-input/30' apps/csrm/src/components/ui/textarea.tsx && N="$(git diff --numstat 72e53a6 -- apps/csrm/src/components/ui/input.tsx apps/csrm/src/components/ui/textarea.tsx)" && [ "$(printf '%s\n' "$N" | awk '$1==1 && $2==1' | wc -l)" -eq 2 ] && grep -qF '!text-destructive-foreground' apps/csrm/src/components/ui/button.tsx && grep -qF '!text-secondary-foreground' apps/csrm/src/components/ui/button.tsx && grep -qF 'link: "!text-foreground' apps/csrm/src/components/ui/button.tsx</automated>
    <fails_when>non-zero exit, or stderr shows "RESET_NOT_LAYERED" (a missing primitive or variant string, or a numstat other than one line changed per primitive, exits non-zero silently)</fails_when>
    <automated>source "/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/node24.sh" && pnpm --dir apps/csrm typecheck</automated>
    <fails_when>non-zero exit, or tsc prints an "error TS" line</fails_when>
    <automated>source "/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/node24.sh" && L="/c/Users/dylan/AppData/Local/Temp/claude/C--Users-dylan-Developer-idambox/d215652c-3809-4d32-8c0c-7c90b83e0b9b/scratchpad/drq-e2e-task2.log" && (pnpm --dir apps/csrm test:e2e e2e/design-system-conformance.spec.ts --project=desktop --grep "self-hosted type families|components at the direction values" > "$L" 2>&1; R=$?; tail -n 25 "$L"; exit $R)</automated>
    <fails_when>non-zero exit, or the printed tail shows "failed" or "No tests found", or has no "passed" summary line</fails_when>
    <automated>git diff --quiet 72e53a6 -- docs/design/csrm-design-direction.md apps/csrm/app/layout.tsx package.json pnpm-lock.yaml && S="$(git status --short)" && test -z "$(printf '%s\n' "$S" | grep -vE '^( M apps/backend/types/generated/(components|contentTypes)\.d\.ts|\?\? example-risk-assessment-questions/|.. \.planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/.*)$')"</automated>
    <fails_when>non-zero exit: the direction, layout.tsx or a package file differs from 72e53a6, or git status lists a path other than the three operator items and the quick directory (run after the commit)</fails_when>
  </verify>
  <done>
    - The form-control reset exists once, inside `@layer base`, followed by the fields' weight-400 rule. No `:root` or `@theme` value changed (D-1, D-8).
    - The destructive, secondary and link variants carry important ink, and every variant at every size keeps `text-button` in the unit test, which failed red first (D-10).
    - Input and Textarea use `text-sm` at every width, with one line changed in each file (D-9).
    - Both Playwright describes pass in the desktop project (D-12):
      - "Continue as Requestor" computes 500 / 14px / 20px / -0.35px and renders PlusJakartaSans-Medium;
      - every visible Button and field on the four page and width pairs is at its token;
      - the destructive dialog's buttons are at the button token, and Cancel leaves the question in place;
      - no Vietnamese FontFace loads.
    - typecheck and the `src/components/ui` unit tests pass. One commit with the given subject and trailer, 6 staged paths. The tree is clean apart from the operator items and the quick directory.
  </done>
</task>

<task type="auto">
  <name>Task 3: record the Vietnamese subsets and the Button weight (D-13, D-14)</name>
  <files>docs/adr/0001-adopt-bproton-design-system.md, .planning/NEXT-WAVE-DECISIONS.md, .planning/quick/261002-2y8-self-host-the-three-bproton-font-familie/deferred-items.md, .planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/261002-drq-deferred-items.md</files>
  <precondition>Tasks 1 and 2 are committed; `git log --format='%h %s' 72e53a6..HEAD` lists their two commits, whose short SHAs this task cites.</precondition>
  <read_first>
    - docs/adr/0001-adopt-bproton-design-system.md lines 1-8 (header) and 60-68 (the 2026-10-02 amendment)
    - .planning/NEXT-WAVE-DECISIONS.md lines 251-256 (G-10 and its follow-up bullet)
    - .planning/quick/261002-2y8-self-host-the-three-bproton-font-familie/deferred-items.md
    - RESEARCH §1, §3 and §5 (the facts to record) are already in `<context>`; do not re-read the file.
  </read_first>
  <action>
Every statement must be true of the code committed in Tasks 1 and 2. Get the two short SHAs from `git log --format='%h %s' 72e53a6..HEAD`.

1. **ADR 0001** (`docs/adr/0001-adopt-bproton-design-system.md`, CRLF, Edit tool; D-13). Change exactly three lines and nothing else:
   - **Header.** Replace the Amended bullet with `- **Amended:** 2026-10-02 (G-10: the three families are self-hosted, with the vietnamese subsets of Plus Jakarta Sans and IBM Plex Mono added by quick task 261002-drq)`.
   - **"What changed".** Change its first clause so each font token now lists its family's companions first: latin-ext, then vietnamese for Plus Jakarta Sans and IBM Plex Mono (quick task 261002-drq), then the latin face (see Coverage). Keep the sentence about families, weights, normal style, swap display, CSS variables and no design value change, word for word.
   - **"Coverage".** Rewrite it as a single line (one bullet, no sub-bullets, so the ADR still changes by exactly three lines) that says, in this order:
     - latin is preloaded;
     - latin-ext, and since quick task 261002-drq vietnamese for Plus Jakarta Sans and IBM Plex Mono (24,484 B, never preloaded), are downloaded on demand by `unicode-range` through companion faces listed ahead of the latin face in each font token, because `next/font/local` sets preload and descriptors per call, not per file;
     - latin-ext comes before vietnamese, so the vietnamese file loads only for the Vietnamese tone letters and combining marks no other subset covers;
     - Instrument Serif has no vietnamese subset, so Vietnamese tone letters in display text fall back to Times New Roman;
     - cyrillic is not shipped.

2. **NEXT-WAVE-DECISIONS** (`.planning/NEXT-WAVE-DECISIONS.md`, LF; D-13). Replace only the line `    - Follow-up before Phase 10: restore the Vietnamese coverage …` with one line at the same indentation, for example: `    - Follow-up before Phase 10, **done 2026-10-02:** quick task 261002-drq (`<task-1-sha>`, `<task-2-sha>`).` The line goes on to say:
   - The vietnamese subsets of Plus Jakarta Sans (400/500/600) and IBM Plex Mono (400/500) are served, 24,484 B in all, loaded on demand by `unicode-range` and never preloaded, so Vietnamese names render in family.
   - Instrument Serif has no vietnamese subset and falls back to Times New Roman.
   - Every Button now renders the direction's 500 (`--text-button`), because the form-control font reset sits in `@layer base`.

3. **261002-2y8's deferred-items.md** (LF; D-13).
   - Append ` (resolved by quick task 261002-drq)` to the D-1 heading, after its existing parenthesis.
   - Add a final bullet: `- **Resolved:** 2026-10-02 by quick task 261002-drq (`<task-2-sha>`).` It goes on to say:
     - The reset now sits in `@layer base`, with fields at weight 400.
     - The browser proof now asserts that "Continue as Requestor" computes 500 / 14px / 20px / -0.35px and renders `PlusJakartaSans-Medium`.
     - The new conformance test requires every visible Button on the risk register and the new request form, at 375px and 1440px, and the destructive "Delete question" Button at the button token, and every form field at the body token.
   - Keep every earlier bullet as written.

4. **Unchanged.** The design direction does not change: §3.10 always said 500, and the app now matches. Do not edit `.planning/STATE.md` or `ROADMAP.md`.

5. **This task's deferred items (D-14), not committed.** Write `.planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/261002-drq-deferred-items.md` with a title and three items:
   - **D-1: tailwind-merge has no config for the theme's text sizes.** `text-button`, `text-heading-sm`, `text-heading-md`, `text-heading-lg`, `text-wordmark` and `text-display` are read as colours by `cn()`.
     - Workarounds today: the important `!text-…` inks in `button.tsx`, `segmented-control.tsx`, and the two written-out footer-link classes in `analyst-dashboard.tsx` and `treatment-performance-report.tsx`.
     - An `extendTailwindMerge` theme config would remove them, but it changes merge results app-wide, so it needs its own audit.
   - **Observation: dead CSS.** `.button-primary` and `.button-secondary` in globals.css are unused.
   - **Observation: iOS.** shadcn's 16px mobile input size, which stops iOS Safari zooming on focus, is a design decision for the direction. It is not taken here: inputs stay at `--text-body` 14px.

6. **Commit.**
   - Stage exactly `docs/adr/0001-adopt-bproton-design-system.md`, `.planning/NEXT-WAVE-DECISIONS.md` and `.planning/quick/261002-2y8-self-host-the-three-bproton-font-familie/deferred-items.md`. `git diff --cached --name-only` must list exactly 3 paths.
   - Commit with subject `docs(quick-261002-drq): record the Vietnamese subsets and the Button weight` and bullets such as:
     - update the ADR 0001 amendment with the vietnamese companions, the token order and Instrument Serif's fallback;
     - mark the G-10 follow-up done;
     - mark 261002-2y8's D-1 resolved.
  </action>
  <verify>
    <automated>F=docs/adr/0001-adopt-bproton-design-system.md && grep -qF -- '- **Amended:** 2026-10-02 (G-10: the three families are self-hosted, with the vietnamese subsets of Plus Jakarta Sans and IBM Plex Mono added by quick task 261002-drq)' "$F" && grep -E '^- \*\*Coverage:\*\*' "$F" | grep -F '261002-drq' | grep -F '24,484 B' | grep -qF 'Instrument Serif has no vietnamese subset' && grep -E '^- \*\*What changed:\*\*' "$F" | grep -qF 'vietnamese' && NS="$(git diff --numstat 72e53a6 -- "$F")" && [ "$(printf '%s\n' "$NS" | awk '{print $1" "$2}')" = "3 3" ] && git diff --quiet 72e53a6 -- docs/design/csrm-design-direction.md && grep -E '^    - Follow-up before Phase 10, \*\*done 2026-10-02:\*\* quick task 261002-drq' .planning/NEXT-WAVE-DECISIONS.md | grep -F '24,484 B' | grep -qF -- '--text-button' && D=.planning/quick/261002-2y8-self-host-the-three-bproton-font-familie/deferred-items.md && grep -E '^## D-1:' "$D" | grep -qF '(resolved by quick task 261002-drq)' && grep -E '^- \*\*Resolved:\*\* 2026-10-02 by quick task 261002-drq' "$D" | grep -qF 'PlusJakartaSans-Medium' && N=.planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/261002-drq-deferred-items.md && grep -qF 'extendTailwindMerge' "$N" && grep -qF '.button-primary' "$N" && grep -qF 'iOS' "$N"</automated>
    <fails_when>non-zero exit: a record line or deferred item is missing, ADR 0001's numstat against 72e53a6 is not "3 3", or the direction differs from 72e53a6</fails_when>
    <automated>S="$(git status --short)" && test -z "$(printf '%s\n' "$S" | grep -vE '^( M apps/backend/types/generated/(components|contentTypes)\.d\.ts|\?\? example-risk-assessment-questions/|.. \.planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/.*)$')" && [ "$(git rev-list --count 72e53a6..HEAD)" -eq 3 ]</automated>
    <fails_when>non-zero exit: git status lists a path other than the three operator items and the quick directory, or the commit count since 72e53a6 is not 3</fails_when>
  </verify>
  <done>
    - ADR 0001 changes by exactly three lines: Amended, What changed and Coverage. They name the vietnamese companions, the token order, 24,484 B never preloaded, Instrument Serif's fallback and 261002-drq (D-13).
    - NEXT-WAVE-DECISIONS marks G-10's follow-up done, with the quick ID, the Task 1 and Task 2 SHAs and the facts. 261002-2y8's D-1 is marked resolved, with the Task 2 SHA and what the proof asserts. The direction is unchanged.
    - 261002-drq-deferred-items.md exists with the tailwind-merge item and the two observations, uncommitted (D-14).
    - One commit with the given subject and trailer, 3 staged paths. Three commits since 72e53a6, and the tree is clean apart from the operator items and the quick directory.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| npm registry → repository | Five more third-party woff2 binaries enter the repository as vendored files. |
| browser → web origin | The browser fetches the new subset files on demand under CSP `font-src 'self'`. No other font origin may be contacted. |
| E2E harness → seeded data | The new browser test opens a destructive confirmation on a seeded questionnaire that later tests share. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261002-drq-01 | Tampering | apps/csrm/app/fonts/*-vietnamese-*.woff2 (vendored binaries) | medium | mitigate | Copied unmodified only from the @fontsource 5.3.0 tarballs whose sha512 matched the registry's dist.integrity and the README Source table (RESEARCH §1). Each SHA-256 is checked against RESEARCH §1 before staging (Task 1 step 1). The index blobs are checked byte-identical after staging (Task 1 verify 3). The README records them, self-hosted-fonts.test.ts case 3 checks them on every unit run, and the existing `*.woff2 binary` attribute keeps the bytes stable across checkouts. |
| T-261002-drq-02 | Information disclosure | On-demand font loading | low | mitigate | The new files are same-origin build media; CSP `font-src 'self'` is unchanged. The self-hosted browser test keeps its assertions that no request leaves the web origin, that every font request is under `/_next/static/media/`, and that no HTML, stylesheet or build file names a Google font host. |
| T-261002-drq-03 | Tampering | Seeded questionnaire used by the destructive-dialog check | low | mitigate | The test only opens the "Delete question" confirmation and closes it with Cancel. It asserts the dialog is hidden and the count of Delete triggers is unchanged, so no question is deleted and the serial suite's shared data stays intact (Task 2 step 6). |
| T-261002-drq-04 | Denial of service | App-wide cascade change (form-control reset) | low | mitigate | RESEARCH §4 compared every rendered control on 70 route visits before and after. Only Button weights and tracking and label-wrapped field weights change, nothing overflows, and the D-9 primitive change keeps Inputs and Textareas at 14px. The new browser test pins Buttons and fields at their tokens. The orchestrator's full Playwright gate runs the type-contract matrices afterwards. |
| T-261002-drq-SC | Tampering | npm/pip/cargo installs | low | mitigate | No package-manager install: no package.json, lockfile or .gitattributes change (Task 1 verify 5 runs `git diff --quiet` on them). The packages were only `npm pack`ed for inspection, and the D-2 fallback re-pack must match the recorded sha512 before any file is copied. |
</threat_model>

<verification>
- Task 1: the three unit files pass and failed red first; typecheck passes; the five files hash to RESEARCH §1 in the tree and the index; the 'self-hosted type families' Playwright test passes; the package files, .gitattributes, layout.tsx, global-error.tsx and the direction are unchanged; the tree is clean.
- Task 2: the `src/components/ui` unit tests and self-hosted-fonts.test.ts pass, and the button guard failed red first. The layered-reset check and the primitive and variant greps pass, and typecheck passes. Both Playwright describes pass; the tree is clean.
- Task 3: the record greps pass, ADR 0001 changes by exactly three lines, the direction is unchanged, three commits since 72e53a6, and the tree is clean.
- The orchestrator then runs the six full gates (api:check, typecheck, lint, web tests, Strapi tests, the full Playwright suite) and `git status --short`.
</verification>

<success_criteria>
- A Vietnamese name renders in Plus Jakarta Sans and IBM Plex Mono with no mixed face. The vietnamese files (24,484 B) load only when a page renders a Vietnamese tone letter and are never preloaded; a page without Vietnamese characters requests none. Instrument Serif's fallback is documented and pinned (D-2 to D-7, D-11).
- Every Button renders the direction's `--text-button` (14px/20px, 500, −0.025em), and every form field renders `--text-body` at weight 400 at mobile and desktop widths. The design direction is unchanged (D-1, D-8 to D-10, D-12).
- ADR 0001, NEXT-WAVE-DECISIONS and 261002-2y8's deferred items record what is committed. The tailwind-merge follow-up and the two observations are written down (D-13, D-14).
- Three atomic commits with the given subjects and the trailer, and no package added. The tree is clean apart from the three operator items and the quick directory.
</success_criteria>

<output>
Create `.planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/261002-drq-SUMMARY.md` when done.
</output>
