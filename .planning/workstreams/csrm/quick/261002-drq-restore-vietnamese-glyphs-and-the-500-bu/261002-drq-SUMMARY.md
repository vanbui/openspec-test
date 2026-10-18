---
phase: quick-261002-drq
plan: 01
status: complete
subsystem: web typography (apps/csrm)
tags: [fonts, G-10, typography, design-system, next-font-local, tailwind-merge]
requires: [261002-2y8 self-hosted families]
provides:
  - vietnamese companions for Plus Jakarta Sans and IBM Plex Mono, on demand by unicode-range
  - form-control font reset in @layer base; every Button at --text-button, every field at --text-body
affects: [apps/csrm/app/fonts.ts, apps/csrm/app/globals.css, apps/csrm/src/components/ui/button.tsx, input.tsx, textarea.tsx]
tech-stack:
  added: []
  patterns: ["one next/font/local call per subset, companions ahead of the latin face in each token", "important ink on every Button variant so tailwind-merge keeps text-button"]
key-files:
  created:
    - apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-400-normal.woff2
    - apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-500-normal.woff2
    - apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-600-normal.woff2
    - apps/csrm/app/fonts/ibm-plex-mono-vietnamese-400-normal.woff2
    - apps/csrm/app/fonts/ibm-plex-mono-vietnamese-500-normal.woff2
  modified:
    - apps/csrm/app/fonts.ts
    - apps/csrm/app/fonts/README.md
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
decisions:
  - "Vietnamese companions sit after latin-ext and before latin in --font-sans and --font-mono, so shared letters (Ă, Đ, Ơ, Ư) keep using latin-ext and the vietnamese file loads only for tone letters and combining marks"
  - "The form-control font reset moved into @layer base with fields at weight 400; destructive, secondary and link Button inks became important so text-button survives tailwind-merge"
  - "Input and Textarea stay at 14px at every width (text-sm); shadcn's 16px mobile size is left to the direction (deferred observation)"
metrics:
  duration: ~12 min
  completed: 2026-10-02
actuals:
  tokens: 13648
  tasks: 3
  commits: 3
plan_head_before: 72e53a67db1797b49d50e3486a6b682f28c00832
plan_head_after: c8d164d7dd044772778b86db9ad76f11b9e146ef
---

# Quick 261002-drq: Vietnamese glyphs and the 500 Button weight Summary

The vietnamese subsets of Plus Jakarta Sans (400/500/600) and IBM Plex Mono (400/500) now load on demand (24,484 B, never preloaded) through two literal `next/font/local` companion calls, ordered latin-ext, then vietnamese, then latin. Moving the form-control font reset into `@layer base`, and making every Button variant's ink important, puts every Button at `--text-button` (14px/20px/500/−0.35px) and every field at `--text-body` (14px/400). The production build proves both.

## Commits

| Task | Commit | Subject | Files |
|---|---|---|---|
| 1 (tracer) | `ff61dbf` | feat(quick-261002-drq): serve the Vietnamese subsets of Plus Jakarta Sans and IBM Plex Mono on demand | 11 |
| 2 | `1896015` | fix(quick-261002-drq): let Buttons and form fields take their type tokens | 6 |
| 3 | `c8d164d` | docs(quick-261002-drq): record the Vietnamese subsets and the Button weight | 3 |

## Task 1: vietnamese companions (D-2 to D-7, D-11)

- **Files (D-2).** The five files were byte-copied from the scratch tarball extracts (`typo/tarballs/x-*/package/files/`). Nothing was downloaded: the scratch copies were present, so the `npm pack` fallback was not used. Each SHA-256 matched RESEARCH §1 before staging. After staging, every index blob equalled `git hash-object` of its working-tree file, and `git ls-files --eol` shows `-text` for all five. Sizes: 4,096 / 4,284 / 4,196 / 5,868 / 6,040 B, 24,484 B in all.
- **README (D-6).** Five rows were added after their family's latin-ext rows, and the Coverage section was rewritten (latin preloaded; latin-ext and vietnamese on demand; the token order and the 24 shared code points; Instrument Serif falls back; cyrillic not shipped). `app/fonts` now holds 17 woff2 files and 3 licences.
- **Loader (D-3).** `fonts.ts` now makes eight calls. The new ones are `jakartaVietnamese` and `plexMonoVietnamese`: preload false, `adjustFontFallback: false`, swap display, and the vietnamese range written inline. The exports are unchanged, and `fontVariableClassName` joins the eight variables in D-3 order.
- **Tokens (D-4).** `--font-sans` and `--font-mono` list latin-ext, then vietnamese, then latin. `--font-display` is unchanged.
- **Unit guards (D-7).** Red first: 5 tests failed against the old `fonts.ts`. Then green: the three files pass 92/92 (route-boundaries is unchanged), and typecheck is clean.
- **Browser proof (D-11), run on the production build (desktop project, 1 passed).** Faces measured, all as exact single-face assertions:
  - `sans-shared-latin-ext` ('Đorđević Bălan', sans 400) renders `PlusJakartaSans-Regular` only;
  - `sans-vietnamese` ('Nguyễn Văn Đức, Trần Thị Hồng', sans 400) renders `PlusJakartaSans-Regular` only;
  - `mono-vietnamese` (uppercase) renders `IBMPlexMono-Regular` only;
  - `display-vietnamese` renders custom `['InstrumentSerif-Regular']` plus a platform (non-custom) font.
- **Files fetched.**
  - Before any latin-ext text: only the six latin files, which are exactly the preloads.
  - After the latin-ext and shared-letter probes (and `document.fonts.ready`): the three latin-ext 400 files are added, and no latin-ext 500/600 or vietnamese file.
  - After the Vietnamese probes: both vietnamese 400 files (`plus-jakarta-sans-vietnamese-400`, `ibm-plex-mono-vietnamese-400`) are added, and no vietnamese 500/600 or latin-ext 500/600 file.
  - Every font response is a committed file under same-origin `/_next/static/media/`, and nothing names a Google font host.

## Task 2: Buttons and fields at their tokens (D-8 to D-10, D-12)

- **Unit guard (D-10).** Red first: the every-variant × every-size test listed exactly 24 offenders (destructive, secondary and link at all eight sizes), and the named destructive/link case failed. After the `button.tsx` change, `src/components/ui` plus self-hosted-fonts pass 10/10.
- **Variants.** Destructive, secondary and link now use `!text-destructive-foreground`, `!text-secondary-foreground` and `!text-foreground`. The comment above the variants explains why all of them are important.
- **Reset (D-8).** The unlayered rule was deleted. A second `@layer base` block after the anchor reset now holds `button, select, input, textarea { font: inherit; }` and `select, input, textarea { font-weight: 400; }`. The layered-reset node check passes, with exactly one `font: inherit`.
- **Primitives (D-9).** Input and Textarea each change one line: `text-base … md:text-sm` becomes `text-sm`.
- **Browser proof (D-12), production build, desktop project: 4 passed** ('self-hosted type families' plus the three 'components at the direction values' tests).
  - **Button weight and face.** "Continue as Requestor" computes font-weight `500`, font-size `14px`, line-height `20px` and letter-spacing `-0.35px`, and renders `PlusJakartaSans-Medium` only.
  - **Pages and widths.** /app/risks?state=open (Security Analyst) and /app/requests/new (Requestor), each at 375px and 1440px:
    - every visible `:is(button, a)[data-variant][data-size]` computes 14px / 20px / 500 / -0.35px, and its family starts `jakartaLatinExt, jakartaVietnamese, jakarta`;
    - the link-variant "Clear filters" is among them at both widths;
    - every visible field in main (except 'Rows per page') computes 14px / 400 in the same family, and inputs and textareas also compute 20px;
    - the risk register shows a select and an input at 1440px, and the request form shows an input, a textarea and a select at both widths;
    - all five Vietnamese FontFaces are declared and stay `unloaded`.
  - **Destructive dialog.** "Delete question" has `data-variant="destructive"`, and it and "Cancel" both compute 14px / 20px / 500 / -0.35px. Cancel closes the dialog, and the enabled trigger count is unchanged.

## Task 3: records (D-13, D-14)

- **ADR 0001.** Exactly three lines changed against `72e53a6` (numstat "3 3"): Amended, What changed and Coverage.
- **NEXT-WAVE-DECISIONS.** G-10's follow-up is marked done, citing `ff61dbf` and `1896015`.
- **261002-2y8 deferred items.** D-1 is marked resolved, with a final Resolved bullet citing `1896015`.
- **This task's deferred items (uncommitted).** `261002-drq-deferred-items.md` records three items: tailwind-merge with no theme text-size config (`extendTailwindMerge` needs its own audit), the dead `.button-primary` and `.button-secondary` CSS, and the iOS 16px input observation.
- **Direction.** `docs/design/csrm-design-direction.md` is unchanged.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1: test diagnostics] The every-variant guard collects offenders instead of failing on the first**
- **Found during:** Task 2, step 1 (red run).
- **Issue:** the first draft asserted inside the variant × size loop, so the red run stopped at "destructive at size default". It could not show that secondary and link also fail, which the plan asks the red run to confirm.
- **Fix:** collect every offender (`<variant> at size <size>`) and assert the list equals `[]`. Each offender is still named by variant and size. The red run then listed exactly the 24 expected offenders.
- **Files:** `apps/csrm/src/components/ui/button.test.tsx`.
- **Commit:** `1896015`.

### Decisions within plan latitude

- **Field selector.** `fieldTypography` chains `:not([type=…])` selectors instead of a `:not()` selector list, to keep to the selector syntax Playwright's engine certainly supports. Coverage is the same.
- **Enabled triggers.** The destructive check takes enabled Delete triggers with `locator.and(page.locator(':enabled'))` and asserts the count is unchanged after Cancel with `toHaveCount`.
- **Context checkpoint.** The Task 1 step 9 checkpoint was not taken: context use stayed well under half, so execution went straight on to Task 2.

## Verification

- Task 1 verifies 1 to 6 all pass: unit 92/92, typecheck, hashes and index blobs, Playwright 1/1, unchanged files, clean tree.
- Task 2 verifies 1 to 5 all pass: unit 10/10, the reset, primitive and variant checks, typecheck, Playwright 4/4, clean tree.
- Task 3 verifies 1 and 2 pass: the record greps, ADR numstat "3 3", 3 commits since `72e53a6`, clean tree.
- The web `lint` script is `next typegen && tsc --noEmit`, the same as typecheck, and it is clean.
- Both Playwright runs left the tree clean, and neither left a database or build behind. Logs: `<scratchpad>/drq-e2e-task1.log` and `drq-e2e-task2.log`.
- No package.json, lockfile or `.gitattributes` change. `layout.tsx` and `global-error.tsx` are unchanged.
- The orchestrator still runs the six full gates.

## Known Stubs

None.

## Self-Check: PASSED

- The five vietnamese woff2 files exist and hash to RESEARCH §1. `fonts.ts`, the README, `globals.css`, `button.tsx`, the tests and the spec are modified as described.
- Commits `ff61dbf`, `1896015` and `c8d164d` exist on `post-demo`.

## Orchestrator review and verification (2026-10-02)

**Before planning.** The csrm-worker ran the spike in `261002-drq-RESEARCH.md` and locked decisions D-1 to D-14 from it. Run A measured HEAD; run C measured a candidate of these changes. Both crawled 35 route states at 375px and 1440px (70 visits) on the production build, and the candidate was reverted byte for byte afterwards. Three choices came from that evidence; the brief did not name them:
- **Token order.** The vietnamese companion sits after latin-ext, so letters both subsets cover (Ă, Đ, Ơ, Ư) keep loading latin-ext. Romanian and Croatian names therefore never fetch a vietnamese file.
- **Field primitives.** Input and Textarea use `text-sm`. Without it, moving the reset would have made every input and textarea 16px/24px below 768px (shadcn's `text-base md:text-sm`, which had never applied), against the direction's 14px `--text-body`.
- **Button variants and fields.** The destructive, secondary and link Button variants got important ink. tailwind-merge had dropped their `text-button`, so "Release assessment" and "Clear filters" would have stayed at 400 after the move. Fields also get the body weight in `@layer base`, because label-wrapped search inputs and filter selects inherited 500, before and after the move.

**Plan check.**
- Iteration 1 found 0 blockers, 1 warning (the per-plan context budget) and 2 info items (the `tracer` task type, and no `<fails_when>` on the checks).
- The planner revised the plan: narrower reads, bounded Playwright output, a context checkpoint after Task 1, `type="auto"`, and a `<fails_when>` on all 13 checks.
- Iteration 2: **VERIFICATION PASSED**.

**Verification.** `261002-drq-VERIFICATION.md` reports **status: passed**, 8/8 must-haves. The verifier ran its own production-build Playwright run, which passed 4/4, and 97/97 unit tests.

**Review.** The csrm-worker read every diff against the plan and the research.
- It accepted the one deviation: the variant × size guard collects every offender.
- It corrected one sentence in `261002-drq-deferred-items.md`: `segmented-control.tsx` avoids the tailwind-merge pitfall by setting its colour on the group, not by using an important ink.
- A stray double blank line after the new conformance test is cosmetic and was left.

**Gates, dev mode, HEAD `c8d164d`** (POST-DEMO-BRIEF section 5, Node 24.19):

| Gate | Result |
|---|---|
| `pnpm --dir apps/csrm api:check`, then `git update-index --refresh` on `schema.d.ts` | `api:check` exit 0, and `schema.d.ts` is unmodified. `git update-index --refresh` refreshes the whole index whatever the pathspec. It exits 1 only because it reports the two operator `apps/backend/types/generated/*.d.ts` files as needing update; their diff is empty (line endings), and they are left alone. |
| `pnpm --dir apps/csrm typecheck` | exit 0 |
| `pnpm --dir apps/csrm lint` | exit 0 |
| `pnpm --dir apps/csrm test` | `Test Files 110 passed (110)`, `Tests 2055 passed (2055)`: the baseline of 2,053, plus the two new Button guard cases |
| `pnpm --dir apps/backend test` | `tests 578`, `pass 578`, `fail 0` (676.1 s) |
| `pnpm --dir apps/csrm test:e2e` | `Running 86 tests using 1 worker` … `86 passed (10.9m)`: 82 desktop and 4 mobile. That is the baseline of 85 plus "draws every Button label at the button token and every form field at the body token". "self-hosted type families (G-10, R-08-24)" passed in 359 ms, and both type-contract matrices passed. |
| `git status --short` | only the three operator items, plus this quick directory before its docs commit |
