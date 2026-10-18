---
phase: quick-261002-drq
verified: 2026-10-02T10:45:00Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - .planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/261002-drq-PLAN.md
  - .planning/quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/261002-drq-SUMMARY.md
  - apps/csrm/app/fonts.ts
  - apps/csrm/app/fonts/README.md
  - apps/csrm/app/fonts/ibm-plex-mono-vietnamese-400-normal.woff2
  - apps/csrm/app/fonts/ibm-plex-mono-vietnamese-500-normal.woff2
  - apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-400-normal.woff2
  - apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-500-normal.woff2
  - apps/csrm/app/fonts/plus-jakarta-sans-vietnamese-600-normal.woff2
  - apps/csrm/app/globals.css
  - apps/csrm/e2e/design-system-conformance.spec.ts
  - apps/csrm/src/components/ui/button.test.tsx
  - apps/csrm/src/components/ui/button.tsx
  - apps/csrm/src/components/ui/input.tsx
  - apps/csrm/src/components/ui/textarea.tsx
  - apps/csrm/src/lib/security/root-fallbacks.test.tsx
  - apps/csrm/src/lib/security/self-hosted-fonts.test.ts
  - docs/adr/0001-adopt-bproton-design-system.md
covered_digest: "v2:sha256:d302b4f3e5535495a88d831091778a8398fe22ed4de73329b4a55bd716de79ce"
behavior_unverified: 0
overrides_applied: 0
---

# Quick 261002-drq: Vietnamese glyphs and the 500 Button weight, verification report

**Goal:** Restore Vietnamese glyphs (Plus Jakarta Sans 400/500/600, IBM Plex Mono 400/500) on demand without preloading, record Instrument Serif's fallback, make every Button render the direction's 500 `--text-button` by layering the form-control reset, and update the records.
**Verified:** 2026-10-02
**Status:** passed
**Re-verification:** No (initial verification)

## Goal achievement

### Observable truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On the production build, 'Nguyễn Văn Đức, Trần Thị Hồng' renders in exactly one face per probe (PlusJakartaSans-Regular for sans 400, IBMPlexMono-Regular for uppercase mono). Both vietnamese 400 files load only after it renders, and no vietnamese 500/600 file loads. | VERIFIED | Spec lines 466-485 assert `expectFace` (exact single custom face via CDP `getPlatformFonts`), poll for `vietnamese400`, and assert no `vietnameseHeavier` or `latinExtHeavier`. My own Playwright run passed this test (production `next build` + `next start` in an isolated dist dir). |
| 2 | /sign-in preloads exactly the six latin files. Latin-ext text, including 'Đorđević Bălan', renders in family, loads the latin-ext 400 files and no vietnamese file. | VERIFIED | Spec: preload hashes equal `fonts.latin`; "only latin files load before latin-ext text"; `sans-shared-latin-ext` asserted PlusJakartaSans-Regular only; after `document.fonts.ready`, no vietnamese file fetched. Passed in my run. |
| 3 | Vietnamese display text renders InstrumentSerif-Regular plus a platform font and no other custom face. | VERIFIED | `displayFaces` poll equals `{ custom: ['InstrumentSerif-Regular'], platform: true }`; passed. The tarball `x-instrument-serif/package/files` holds no vietnamese file, and its `unicode.json` has only latin and latin-ext keys. |
| 4 | app/fonts holds 17 woff2 and 3 licence files that hash to the README rows. The five vietnamese files are byte-identical to the @fontsource 5.3.0 tarballs in the tree and the index. No package, lockfile or .gitattributes change. | VERIFIED | `cmp` against `scratchpad/typo/tarballs/x-*/package/files/` succeeded for all five. `git rev-parse HEAD:<f>` equals `git hash-object <f>` for all five. `git ls-files --eol` shows `-text`. SHA-256s and sizes match RESEARCH §1 and the README rows. Tarball sha512s I recomputed equal the README Source rows. 17 woff2 + 3 txt counted. `git diff --quiet 72e53a6` on package.json, pnpm-lock.yaml, apps/csrm/package.json and .gitattributes passes. |
| 5 | fonts.ts makes eight next/font/local calls and exports exactly jakarta, instrument, plexMono and fontVariableClassName. The html element carries eight classes in D-3 order, and layout.tsx and global-error.tsx are unchanged. | VERIFIED | fonts.ts diff: `jakartaVietnamese` and `plexMonoVietnamese` are literal calls with `preload: false`, `adjustFontFallback: false`, swap display and the inline vietnamese range, which equals both tarballs' `unicode.json`. self-hosted-fonts.test.ts cases 1 and 2 and root-fallbacks.test.tsx pass. layout.tsx and global-error.tsx are unchanged against 72e53a6. |
| 6 | Every visible Button on /app/risks?state=open (Security Analyst) and /app/requests/new (Requestor) at 375px and 1440px, Continue as Requestor, and the destructive Delete question with its Cancel, computes 14px/20px/500/-0.35px in the sans family. Continue as Requestor renders PlusJakartaSans-Medium. | VERIFIED | globals.css: the unlayered reset is gone, and `font: inherit` appears once, inside `@layer base`. button.tsx: destructive, secondary and link inks are now `!text-*`, so `cn()` keeps `text-button`. The unit test over 6 variants × 8 sizes passes. The e2e test 'draws every Button label at the button token…' passed in my run, as did the Requestor `toHaveCSS` and `expectFace(…, 'PlusJakartaSans-Medium')`. A grep found no `<Button className="text-…">` consumer that would drop `text-button` through tailwind-merge. |
| 7 | Every visible input, textarea and select in main on those pages, except Rows per page, computes 14px/400 in the sans family. Inputs and textareas compute a 20px line height, and no Vietnamese FontFace loads on those pages. | VERIFIED | `@layer base { select, input, textarea { font-weight: 400 } }`. input.tsx and textarea.tsx change one line each (`text-base … md:text-sm` → `text-sm`). `expectTypeTokens` asserts the fields and that all five vietnamese FontFaces are declared and `unloaded`; passed at both widths on both pages. |
| 8 | ADR 0001's Amended, What changed and Coverage lines name the vietnamese companions, the token order, Instrument Serif's fallback and 261002-drq. G-10's follow-up is marked done, 261002-2y8's D-1 is marked resolved, and the direction is unchanged. | VERIFIED | ADR numstat against 72e53a6 is `3 3`, and the three lines carry the required content. NEXT-WAVE-DECISIONS line 256 reads "done 2026-10-02 … (`ff61dbf`, `1896015`)". 261002-2y8 deferred-items has D-1 "(resolved by quick task 261002-drq)" plus a Resolved bullet citing `1896015`. `docs/design/csrm-design-direction.md` is unchanged against 72e53a6. |

**Score:** 8/8 truths verified (0 present, behavior-unverified)

### Required artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/csrm/app/fonts.ts` | eight calls, `--font-jakarta-vietnamese` | VERIFIED | Substantive and wired: layout.tsx and global-error.tsx consume `fontVariableClassName`, and the root-fallbacks test shows the eight classes. |
| `apps/csrm/app/fonts/README.md` | 17 woff2 + 3 licence rows; Coverage rewritten | VERIFIED | The unit test parses the rows, and every file hashes to its row. |
| `apps/csrm/app/globals.css` | token order; reset in `@layer base`; fields 400 | VERIFIED | Contains `var(--font-jakarta-vietnamese)`. Exactly one `font: inherit`, layered. |
| `apps/csrm/src/components/ui/button.tsx` | `!text-destructive-foreground` etc. | VERIFIED | All three variants changed. Default and outline were already important; ghost has no ink. |
| `apps/csrm/src/components/ui/button.test.tsx` | variant × size guard | VERIFIED | Passes; collects offenders per variant and size. |
| `apps/csrm/src/lib/security/self-hosted-fonts.test.ts` | `vietnameseRange`, 8 calls, 17+3 files, partner rule, token order | VERIFIED | Passes. |
| `apps/csrm/e2e/design-system-conformance.spec.ts` | Vietnamese, display and Button/field proofs | VERIFIED | Passes on the production build (my run, 4/4). |
| `docs/adr/0001-adopt-bproton-design-system.md` | amendment mentions 261002-drq | VERIFIED | Exactly three lines changed. |
| five `*-vietnamese-*-normal.woff2` | byte-identical @fontsource 5.3.0 | VERIFIED | `cmp`, SHA-256, index blob and `-text` checks all pass. |

### Key link verification

| From | To | Via | Status |
|------|----|-----|--------|
| fonts.ts | app/fonts/ | `./fonts/plus-jakarta-sans-vietnamese-400-normal.woff2` and the other paths | WIRED: the build resolves them, and the browser fetched the 400 files by hash. |
| globals.css | fonts.ts | `var(--font-jakarta-latin-ext), var(--font-jakarta-vietnamese)` | WIRED: the computed Button family starts `jakartaLatinExt, jakartaVietnamese, jakarta` (asserted in e2e). |
| globals.css | button.tsx | the layered reset lets the `text-button` utility win | WIRED: computed weight 500 in the browser. |
| button.tsx | lib/utils.ts `cn()` | `!text-*` keeps `text-button` | WIRED: the unit test passes for every variant and size. |
| self-hosted-fonts.test.ts | fonts/README.md | parses rows and hashes the files | WIRED: passes. |

### Behavioral spot-checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit guards | `vitest run self-hosted-fonts.test.ts root-fallbacks.test.tsx route-boundaries.test.ts src/components/ui` | 5 files, 97 tests passed | PASS |
| Typecheck | `pnpm --dir apps/csrm typecheck` | exit 0 | PASS |
| Browser proof (production build) | `test:e2e e2e/design-system-conformance.spec.ts --project=desktop --grep "self-hosted type families\|components at the direction values"` | 4 passed (53.3 s); log at `scratchpad/drq-verify-e2e.log` | PASS |
| Tree clean after run | `git status --short` | only the two operator `.d.ts` files, `example-risk-assessment-questions/` and the quick directory | PASS |
| Vendored bytes | `cmp` + `sha256sum` + `git hash-object` vs `HEAD:` blob | all five identical | PASS |
| Tarball integrity | `openssl dgst -sha512` of the three tgz | equal to the README Source rows | PASS |
| Unchanged files | `git diff --quiet 72e53a6 -- package.json pnpm-lock.yaml apps/csrm/package.json .gitattributes layout.tsx global-error.tsx route-boundaries.test.ts csrm-design-direction.md` | exit 0 | PASS |
| Commits | `git log 72e53a6..HEAD` | `ff61dbf`, `1896015`, `c8d164d`, each with the Co-Authored-By trailer | PASS |

### Probe execution

Not applicable. The phase declares no `scripts/*/tests/probe-*.sh`. The "probes" in this phase are in-page DOM probes inside the Playwright spec, which I ran first-hand (above).

### Requirements coverage

| Requirement | Source plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| G-10 (follow-up) | 261002-drq-PLAN | Restore Vietnamese coverage in family before Phase 10 | SATISFIED | Truths 1-5 and 8 |
| 261002-2y8 D-1 | 261002-drq-PLAN | Buttons at the 500 button token; layered reset | SATISFIED | Truths 6-7 and 8 |

### Anti-patterns found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| input.tsx, textarea.tsx | class strings | `placeholder:` match | Info | False positive: a Tailwind variant, not a stub |
| e2e/design-system-conformance.spec.ts | after the new test (~839) | double blank line | Info | Cosmetic only |

No TBD, FIXME or XXX markers in the added lines. `git diff --check` is clean.

### Notes (informational, non-blocking)

- The committed browser proof shows Vietnamese in family only at sans 400 and mono 400 (uppercase). The 500 and 600 vietnamese faces are declared (FontFace count 5) and hash-guarded, but no committed test renders them. RESEARCH run C measured all five weights rendering single-face. This matches the plan's D-11 scope.
- "Falls back to Times New Roman" names the `instrument Fallback` local face on this Windows host. The e2e test asserts only "a platform font", so it holds on other hosts.
- The fields' `font-weight: 400` in `@layer base` is overridable by any utility, as intended. RESEARCH run C found the only visible change on 70 visits to be label-wrapped fields going from 500 to 400, which conforms to direction §3.10.
- The uncommitted `261002-drq-deferred-items.md` records the tailwind-merge config follow-up, the dead `.button-primary`/`.button-secondary` CSS and the iOS 16px input observation, as the plan requires.

### Human verification required

None. Every truth is backed by a passing automated test that I ran.

### Gaps summary

None. The code delivers all three parts of the brief, and none of it is a stub. (1) The five vietnamese files are vendored byte-identical, loaded on demand and never preloaded, ordered after latin-ext, and proven in family on the production build. Instrument Serif's fallback is recorded and pinned. (2) The form-control reset is layered, Button inks are important so `text-button` survives, and fields hold `--text-body`. All of this is proven at 375px and 1440px, with the workaround `sans-500` probe retired. (3) The ADR, NEXT-WAVE-DECISIONS and 261002-2y8 records are updated, and the design direction is unchanged.

---

_Verified: 2026-10-02_
_Verifier: Claude (gsd-verifier)_
