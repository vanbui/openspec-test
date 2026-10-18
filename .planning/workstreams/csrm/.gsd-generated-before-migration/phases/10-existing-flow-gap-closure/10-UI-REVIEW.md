# Phase 10 — UI Review

**Audited:** 2026-10-03
**Baseline:** 10-UI-SPEC.md, with docs/design/csrm-design-direction.md (X-1 to X-5) as the only value source
**Screenshots:** not captured (static code audit by constraint; no dev server started). Rendered evidence comes from the pilot's walkthrough of record, `10-23-SUMMARY.md` `## Browser checks` (B1-B8 at 375 and 1440, W1-W18, 51 rows, all pass)
**Interaction captures:** off (workflow.ui_interaction_capture is false)

Scope: `git diff 5ea2b77..HEAD -- apps/csrm` (151 files, +15,222/-1,084). The token, type and spacing sweeps ran over the 5,166 added non-test, non-generated lines under `apps/csrm/src`.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Spec copy, X-4 separators and typographic apostrophes are in place. Title Case `Applicable Controls` / `Search Controls` survives on lines Phase 10 rewrote (pre-existing) |
| 2. Visuals | 3/4 | The inline wells (X-5), record picker (X-2) and save status (X-1) follow the contract. The question form caps the whole well at 640px rather than its fields |
| 3. Color | 4/4 | 0 hex/rgb/hsl and 0 raw palette utilities in added code. Status colour always paired with words and an icon |
| 4. Typography | 4/4 | Only `text-sm` (67), `text-xs` (10), `text-heading-sm` (8), `text-heading-md` (1) and `font-medium` (23) were added. That is the declared scale |
| 5. Spacing | 3/4 | Spacing stays on the 4px scale. There are two arbitrary `max-w-[640px]` values and five `mt-0.5` icon nudges |
| 6. Experience Design | 3/4 | Loading, saved, failed, blocked and leave states are all covered. Known limits remain: Back/Forward is not guarded, a waiting save on unload is not guaranteed, and two fixtures show a misleading stepper step |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **WARNING: an autosave waiting at unload is not guaranteed, and browser Back/Forward is not guarded (UI-D11, IN-304 deferred).** User impact: a Requestor who presses Back within about 1.5s of typing can lose the last answer with no prompt. Concrete fix: add a Strapi keepalive or beacon-capable answer endpoint (an API change, so it cannot be a web facade), then send the waiting save with `keepalive: true` from `use-answer-autosave.ts` on `pagehide`. Until then, keep UI-D11 visible in the release notes.
2. **WARNING: Title Case field labels on Phase 10-touched lines.** `apps/csrm/src/features/administration/administration-form.tsx:280-281`: `FormSection title="Applicable Controls"`, `FormLabel>Applicable Controls`, `aria-label="Applicable Controls"`, and the `Search Controls` label. This breaks the Voice rule (sentence case; "control" is not a capitalised record term). User impact: inconsistent labels, and the field's accessible name differs from the rest of the product. Concrete fix: use `Applicable controls` / `Search controls` and update the matching test and e2e locators. Pre-existing (3 occurrences at `5ea2b77`), but Phase 10 rewrote these lines and kept the casing.
3. **WARNING: the question-form well is width-capped as a whole, with an arbitrary value.** `apps/csrm/src/features/questionnaires/questionnaire-governance.tsx:389` (`max-w-[640px]` on the bordered `p-4` form) and `apps/csrm/src/features/risks/risk-detail-editor.tsx:226`. UI-SPEC §1.1 says the *fields* stop at the direction's 640px maximum field width (direction §4 Forms, line 370). Here the well stops at 640, so the fields are about 606px, and the value is a magic number repeated in two files. Concrete fix: add a `--spacing-field-max: 40rem` token beside `--spacing-container-max` (a direction amendment, noted as in X-1 to X-5). Use `max-w-field-max` on the field column, not on the well.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- PASS: every new spec string sampled matches §1.7, §6.1, §6.3 and §10.2, including `Saving…`, `Your latest answers weren’t saved.`, `Retry save`, `Refresh page` (`components/csrm/save-status.tsx:39-50`), `Leave this questionnaire?`, `Keep answering` and `Leave questionnaire`.
- PASS: no em dash in new copy. The only `—` in added code is the prefix-stripping regex in `control-label.ts`, which accepts stored data as the X-4 rule requires.
- PASS: there are no straight-apostrophe contractions in rendered strings. The one hit (`can't`) is a code comment in `refusal-copy.ts`.
- PASS: no ASCII `...` ellipses. Pending labels use `…`.
- WARNING: `Applicable Controls` / `Search Controls` (`administration-form.tsx:280-281`). See Fix 2. Pre-existing.
- INFO: copy decisions made outside the UI-SPEC, recorded in `10-REVIEW-DISPOSITION.md`, should be folded back into the contract: `Press Enter to retry` (WR-302), `A questionnaire already exists for this request.` (IN-201), and `Questionnaire generation couldn’t start` / `Draft generation couldn’t start` (deferred-items, 10-14).
- `Add Risk` (`assessment-editor`) is correct, because `Risk` is a capitalised record term.

### Pillar 2: Visuals (3/4)

- PASS: the question form, mitigation-control and Risk forms are `<form>` elements named by a visible heading or `aria-label`, and use the X-5 well (`bg-surface-muted border-border rounded-lg p-4`).
- PASS: the record picker (`relation-picker.tsx:282`) matches the trigger width and is viewport-bounded (`max-w-[calc(100vw-2rem)]`, the same pattern as the shipped `OwnerCombobox`). Walkthrough B4/B5 confirm this at both widths, as does the Fix 8 addendum for the overflowing list.
- PASS: no icon-only buttons were added (0 `size="icon"`). Every icon in the sweep is `aria-hidden="true"` beside text.
- PASS (rendered evidence): long text wraps with no page overflow at 375. B1 (scrollWidth 360/375), B3 (15 of 25 control names wrap at 1440, no sideways scroll), B6 (long save message wraps inside the card).
- WARNING: the 640px cap is on the well, not the fields (Fix 3).
- MINOR: the question form title is `text-sm font-medium` (`questionnaire-governance.tsx:390`). That matches §1.2 (`--text-body` at 500), but a form title at body size leaves the well with a weak focal point at 1440. This is acceptable under the contract and noted only.

### Pillar 3: Color (4/4)

- 0 hex, `rgb(` or `hsl(` literals and 0 raw palette utilities (`text-red-*`, `bg-gray-*`, ...) in added code.
- The status colours follow the token map exactly: `text-success` on `CheckCircle2` and `text-destructive` on `AlertCircle` (`save-status.tsx:44,58`), and `border-warning-border bg-warning-subtle text-warning` for notices.
- Colour is never the only signal: every save state carries words, and the icons are decorative (`save-status.tsx:12-15`).
- Accent use is limited to the `Button` default variant and the checked radio/segment, per the token table.

### Pillar 4: Typography (4/4)

- Distribution in added code: `text-sm` 67, `text-xs` 10, `text-heading-sm` 8, `text-heading-md` 1. Weights: `font-medium` 23 only.
- All of these map to the direction tokens (`--text-body`, `--text-caption`, `--text-heading-sm`). There are no ad hoc sizes and no `font-bold` or `font-semibold`.
- Finding (informational): `text-heading-md` is used once, while the UI-SPEC token table lists only `text-heading-sm` for Phase 10 surfaces. Confirm it is the existing page title in a route shell and not a new heading level.

### Pillar 5: Spacing (3/4)

- Top spacing utilities: `gap-2` 38, `gap-3` 22, `p-4` 11, `gap-4` 9, `gap-1` 7, `p-3` 6, `gap-x-3` 6, `gap-6` 2, `gap-8` 2, `mt-6`/`mb-6`/`pt-6` 1 each. These sit on the 4px scale, and the 24-32px section rhythm is respected.
- WARNING: `max-w-[640px]` appears twice (`questionnaire-governance.tsx:389`, `risk-detail-editor.tsx:226`). See Fix 3.
- MINOR: `mt-0.5` ×5 nudges icons to align with the first text line (for example `save-status.tsx:58`). This is a common pattern, but `items-baseline` or line-height-matched icon sizing would remove the magic offsets.
- The other arbitrary values are layout functions, not spacing: `grid-cols-[auto_1fr]` ×3 and `max-w-[calc(100vw-2rem)]` ×3, the shadcn and OwnerCombobox convention.

### Pillar 6: Experience Design (3/4)

- PASS: X-1 save status covers idle (height reserved via `min-h-5`), saving (not announced), saved (`role="status"`, present from first render), retryable and blocked (`role="alert"` with recovery control), and the `No changes to save.` note (§13.4). The echo beside `Save draft` is `aria-hidden` and has no controls, so it is announced once.
- PASS: the leave warning (`navigation-guard.tsx`) covers in-app links and the mobile sheet (one Radix layer after 10-08) and uses `beforeunload`. Dismiss focus return is per §6.3.
- PASS: one question form open at a time disables the other actions and `Release questionnaire`, with an explanatory caption. Validation focuses the first invalid field, and `Save question` is never disabled for missing input (`questionnaire-governance.tsx:376-387`).
- PASS: unchanged saves send nothing (CR-201, B6), and arrow keys in radio groups and segmented controls check exactly one option (§7).
- WARNING: Fix 1. Back/Forward is not interceptable (UI-D11), and a waiting save on unload is best-effort (IN-304, deferred with no owning phase).
- WARNING: RAR-E2E-P7-OVERDUE-001 and RAR-E2E-P7-DUESOON-001 show the `Submitted` stepper step beside `Under review` / `Questionnaire in progress` badges (deferred-items, pilot-deferred to Phase 11). The cause is fixture data, not Phase 10 code, but an analyst sees contradictory state on those records.
- INFO: `@radix-ui/react-dialog` is still a direct dependency with no imports (deferred-items). It has no UX effect, but it adds a second Radix copy.
- Registry audit: not applicable. The UI-SPEC lists no third-party registries.

---

## Files Audited

- Phase diff: `git diff 5ea2b77..HEAD -- apps/csrm` (151 files). The automated sweeps covered all added lines under `apps/csrm/src`, excluding tests and `lib/api/generated`.
- Read directly: `apps/csrm/src/components/csrm/save-status.tsx`, `apps/csrm/src/features/questionnaires/questionnaire-governance.tsx` (form, ~370-395), `apps/csrm/src/features/administration/administration-form.tsx` (280-281), `apps/csrm/src/features/risks/risk-detail-editor.tsx` (226), `apps/csrm/src/components/csrm/relation-picker.tsx` (282), `apps/csrm/src/features/assessments/owner-combobox.tsx` (110, 236)
- Contracts: `10-UI-SPEC.md` (§Tokens, §Voice, §1, §6, §7), `docs/design/csrm-design-direction.md` (spacing tokens, §4 Forms), `10-23-SUMMARY.md` (Browser checks), `10-REVIEW-DISPOSITION.md`, `deferred-items.md`

---

## Disposition (2026-10-03)

Each finding was checked against the live code first. Fixes were made test-first: a failing test was committed, then the fix. Copy follows `10-UI-SPEC.md` and values follow `docs/design/csrm-design-direction.md`. No new token was invented.

| ID | Finding | Disposition | Source |
|---|---|---|---|
| UIR-1 | Fix 1 / Pillar 6: a waiting autosave on unload is not guaranteed, and browser Back/Forward is not guarded | deferred | Already deferred, and nothing new was found. The unload save is IN-304 (`10-REVIEW-DISPOSITION.md`, `b7b4b3f`; `deferred-items.md`, open). A save that survives unload needs a Strapi `keepalive` or beacon endpoint. A web route would be a frontend API facade (AGENTS.md), so this is an API change the pilot schedules, and no roadmap phase owns it yet. Back/Forward is UI-D11: the App Router documents no way to intercept it, so the waiting save is sent at once instead (§6.2). The `beforeunload` warning protects reload, close and external navigation. The release notes should state UI-D11 and IN-304 as known limits |
| UIR-2 | Fix 2 / Pillar 1: Title Case `Applicable Controls` / `Search Controls` on the Risk Type form | fixed | `970555a` (test), `76a8e7b` (fix). The section heading, label, accessible name and button now read `Applicable controls` and `Search controls`. The same field's other Title Case strings are fixed too: `Selected applicable controls`, `No applicable controls selected.`, `{n} control options available.`, and the two schema errors. The unit and e2e expectations are exact and case-sensitive. RED was 4 of 58 failing on assertions (RED_EVIDENCE_OK). After the fix, the administration unit files and the copy guard pass 118/118, and `administration-workflow.spec.ts` passes 5/5 (desktop 4, mobile 1, 1.3 min). The list page's `Search Controls` keeps the collection name, as walkthrough fix 5 decided |
| UIR-3a | Fix 3 / Pillars 2 and 5: the question form caps the whole well at 640px, so its fields are about 606px | fixed | `f8391a2` (test), `81d8b5f` (fix). The X-5 well now spans the card. An inner column holds the title, fields, error line and action row, and stops at the direction's §4 Forms maximum field width (640px), as UI-SPEC §1.1 says. RED was 1 of 25 failing (RED_EVIDENCE_OK). After the fix, `src/features/questionnaires` and the copy guard pass 333/333 |
| UIR-3b | Fix 3: `max-w-[640px]` is an arbitrary value with no token | deferred | Phase 11's UI work, which continues the X-n extensions. The direction names the value (§4 Forms: "Max field width 640px") but defines no token or mapped utility, and adding one is a direction amendment, so it is not done in this review. The value stays an arbitrary class with a comment that cites the direction. Proposed extension: "**Field width (CSRM extension).** `--spacing-field-max: 40rem` (640px) beside `--spacing-container-max`, mapped as `max-w-field-max`, is the §4 Forms maximum field width. A form or X-5 well applies it to its field column, never to the well." When it lands, apply it to `questionnaire-governance.tsx` (QuestionForm), `risk-detail-editor.tsx` (Edit Risk form) and `mitigation-control-list.tsx` (the shipped X-5 precedent). The last one still caps its well and dates from `5ea2b77` |
| UIR-3c | Fix 3: `max-w-[640px]` in `risk-detail-editor.tsx` | accepted | The class dates from `5ea2b77`; this phase did not change it. The `Edit Risk` form has no well and no padding, so its fields already stop at 640px, as §1.1 asks. Only the arbitrary value remains, and it moves to the token under UIR-3b |
| UIR-4 | Pillar 1 INFO: copy decided outside the UI-SPEC should be folded back into it | fixed | `4c3f095`. `10-UI-SPEC.md` gains `## Addendum (2026-10-03): copy settled during execution`, with 28 strings. Each is given verbatim, with its surface and the decision that introduced it, and each was found by a grep of `apps/csrm/src`. They include `Press Enter to retry.` (WR-302), `A questionnaire already exists for this request.` (IN-201), `Questionnaire generation couldn’t start` and `Draft generation couldn’t start` (10-14), the draft refusal family and the generation failure sentences (WR-205), the WR-301 search failure, `HISTORY_UNAVAILABLE` (WR-102), `Leaving questionnaire…` (10-08), the Risk detail header (10-21, D-45) and the UIR-2 strings |
| UIR-5 | Pillar 2 MINOR: the question form title is `text-sm font-medium` | accepted | The contract requires this. §1.2 sets the form title as a heading one level below its context (h4 or h5), styled `--text-body` at 500. The UI-SPEC Typography table gives form titles 500 at body size. A larger title would add a heading size inside a well that sits under the h3 `Question editor` |
| UIR-6 | Pillar 4 INFO: `text-heading-md` used once | accepted | The use is correct. The one added line is `DetailSection`'s existing h2 (`detail-section.tsx:29`). Its class is unchanged; Phase 10 added only `tabIndex` for UI-D27. `--text-heading-md` is the direction's section-heading token (§3.10, mapped in `globals.css`). The UI-SPEC Typography section assigns it to the shipped `DetailSection` as unchanged, so this is not a new heading level |
| UIR-7 | Pillar 5 MINOR: five `mt-0.5` icon nudges | accepted | Each is the 2px §3.9 step that aligns an icon with the first line of text that can wrap. A `size-4` icon on a 20px `text-sm` line needs 2px (governance refusal line, two revision timeline rows). A `size-5` icon on the 24px `text-heading-sm` line needs 2px (governance panel heading). The `size-3.5` save failure icon sits within 1px of centre. Neither alternative removes the offset: `items-center` centres the icon on the whole wrapped block, and `items-baseline` puts an SVG's bottom edge on the baseline. The shipped code already uses the same pattern 8 times at `5ea2b77` (`kpi-tile`, `assessment-editor`, `risk-editor`, `control-implementation-editor` and others) |
| UIR-8 | Pillar 6: RAR-E2E-P7-OVERDUE-001 and RAR-E2E-P7-DUESOON-001 show the `Submitted` stepper step beside a later badge | deferred | Already deferred, and the pilot agreed (2026-10-03, walkthrough round 2). See `deferred-items.md` (Phase 7 fixtures, open). The candidate is Phase 11 (UX-06 follow-up): either a fixture change, or a Strapi lifecycle change that reads the request status (an API behaviour change outside D-03). Walkthrough fix 4 (`8c4e2a7`) already keeps the Next action line to the actions the page offers |
| UIR-9 | Pillar 6 INFO: `@radix-ui/react-dialog` is a direct dependency with no imports | deferred | Already deferred. See `deferred-items.md` (open): a dependency-hygiene change that removes it and refreshes the lockfile, with the full gate. It has no UX effect |

**Tests run for this disposition:** the RED and GREEN runs above; `pnpm --dir apps/csrm typecheck` and `lint` (both `next typegen && tsc --noEmit`, exit 0); and the full web unit suite once at the end (134 files, 2,862/2,862 passed, 29.4 s, at `4c3f095`). The full gate was not run. The orchestrator runs it.
