# Phase 4 — UI Review

**Audited:** 2026-09-10
**Baseline:** No phase-specific UI-SPEC.md exists for Phase 4. Audited against the app-wide token/spacing/typography contract in `.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md`, plus abstract 6-pillar standards, applied to the reviewer workflow (review queue, draft-job observation, Risk/ControlImplementation editing, release gating, Requestor read-only view).
**Screenshots:** Not captured — no dev server was started (code-only audit per instructions).
**Prior context:** This phase already carries a 45-finding adversarial review dossier (`04-REVIEW-FINDINGS.md`) and a passed re-verification (`04-VERIFICATION.md`, 2026-08-31) claiming full remediation. This audit independently re-read the current source for the highest-severity claims rather than trusting the dossier's closure notes; the sampled findings below reflect what the code actually contains today, not what the dossier asserts.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Status/severity labels are sentence-case with real copy, but the status filter `<select>` still lists raw machine enum values (`questionnaire-in-progress`, `in-review`) as visible option text. |
| 2. Visuals | 3/4 | Severity ladder now uses dedicated `--risk-*` tokens with distinct icon shapes per rung and orderable aria-labels; icon-only affordances all carry visible text or aria-label. No screenshot verification was possible, so layout/overlap claims are unconfirmed. |
| 3. Color | 4/4 | Accent (`primary`) usage is restrained (4 hits across the reviewed surface); no hardcoded hex/rgb in feature TSX; severity badge now consumes the dedicated risk token ladder instead of reusing info/warning tokens. |
| 4. Typography | 3/4 | Font-weight ramp includes `font-medium` (Tailwind 500) alongside `font-semibold` (600) throughout, deviating from the declared 400/600-only contract; `text-lg` (18px, not in the 14/16/20/28 ramp) appears 7 times in the assessments feature. |
| 5. Spacing | 4/4 | No arbitrary pixel/rem spacing values found; the one prior skeleton/loaded-layout column-width mismatch (`lg:` vs `xl:` breakpoint) is now consistent (`xl:grid-cols-[minmax(0,1fr)_22rem]` in both states). |
| 6. Experience Design | 4/4 | Loading/error/empty states, field-level validation wiring (aria-invalid/aria-describedby/icon+text errors), polite-only live announcements, a "Check again" recovery affordance for timed-out polling, and route-level loading.tsx/error.tsx all verified present in current source. |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **Status filter `<select>` exposes raw workflow enum strings as visible option text** — `apps/web/src/features/assessments/assessment-list.tsx:99` renders `{statuses.map((status) => <option key={status} value={status}>{status}</option>)}` for both the request queue (`submitted`, `questionnaire-in-progress`, `risk-assessment-drafted`, `under-review`) and assessment queue (`draft`, `in-review`, `approved`) filters — a reviewer scanning the filter dropdown sees hyphenated machine casing even though the badges elsewhere on the same page now show humanized labels. Fix: map each status through the same `assessmentStatusPresentation`/`requestStatusPresentation` label lookup used for the badges before rendering `<option>` text, keeping the raw token only as the `value`.

2. **Font-weight ramp exceeds the declared two-weight contract** — `font-medium` (500) is used across `risk-editor.tsx`, `assessment-editor.tsx`, `control-implementation-editor.tsx`, `assessment-list.tsx`, and `assessment-draft-job.tsx` (~30+ call sites) alongside `font-semibold` (600), against the app-wide contract of exactly 400/600. Fix: normalize all `font-medium` occurrences intended as "emphasized label" to `font-semibold` (or introduce `font-normal` for body text) so the shipped ramp matches the declared two-weight system; a one-line search-and-replace per file plus a visual regression pass is sufficient.

3. **`text-lg` (18px) is off the declared 14/16/20/28 type ramp** — 7 occurrences in `features/assessments/*.tsx` introduce a fifth font size not in the app-wide four-size contract, most visibly on card/section titles that should map to the 20px Heading role. Fix: replace `text-lg` with `text-xl` (Tailwind default 20px, matching the declared Heading token) or the project's semantic heading utility class, and add a lint/grep gate to catch future `text-lg`/`text-2xl`+ drift in this feature directory.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- `assessment-list.tsx:99` — filter `<select>` renders raw enum values (`questionnaire-in-progress`, `in-review`) as both value and label; every other status surface on the same page (`AssessmentStatusBadge`, `StatusBadge`) uses humanized presentation labels, so the filter is now the sole remaining raw-token surface.
- Positive: `assessment-list.tsx:30-33` (`AssessmentStatusBadge`) and the imported `StatusBadge` both resolve through presentation maps rather than printing the enum directly — this closes the previously-flagged "in-review" raw-badge finding (dossier #15/#35).
- Positive: state copy is specific and actionable, not generic — e.g. `assessment-draft-job.tsx` distinguishes `'Draft assistance is queued'` / `'...is running'` / `'...is ready for analyst review'` / `'...failed'`, and the timed-out state explains *why* polling stopped ("Automatic checks stopped after 30 seconds. The server-owned job remains authoritative.") rather than a generic "Something went wrong."
- Positive: `risk-editor.tsx:198` now pairs the exemption-review-date input with persistent help text (`Use UTC format YYYY-MM-DDTHH:mm:ssZ.`) instead of a vanishing placeholder, closing dossier findings #14/#27/#40.

### Pillar 2: Visuals (3/4)

- `risk-rating-badge.tsx:18-39` now maps every severity tier to its own `--risk-*` token pair (`border-risk-low`/`bg-risk-low-subtle`/`text-risk-low`, etc.) and a distinct icon per rung (`CircleCheckIcon`, `CircleGaugeIcon`, `TriangleAlertIcon`, `OctagonAlertIcon`), plus an orderable `aria-label` (`Severity: high (3 of 4)`) — this closes the dossier's most serious color/visuals finding (#5/#24/#29/#36), which previously had Moderate rendering in the interactive-blue family and High in the amber reserved for Moderate.
- No icon-only interactive control was found without a visible label or `aria-label`: `Add Risk` / `Add mitigation control` buttons carry visible text plus a decorative icon (`assessment-editor.tsx:215,221`); the combobox `Clear`/`Remove` buttons carry `aria-label` (`owner-combobox.tsx`).
- Cannot verify actual rendered hierarchy, spacing rhythm, or focal point at real viewport sizes without a browser — this is a code-structure read, not a pixel audit, so the score is capped at 3/4 pending an actual screenshot pass.

### Pillar 3: Color (4/4)

- `text-primary`/`bg-primary`/`border-primary` usage across the reviewed feature surface totals 4 hits — consistent with the "accent reserved for one CTA/link/focus, not decoration" rule.
- No hardcoded hex or `rgb()` literals found in `features/assessments/*.tsx`.
- Severity badge color mapping now sources exclusively from the dedicated risk-severity token ladder rather than reusing `info`/`warning`/`destructive` tokens for severity, resolving the ladder-monotonicity defect the dossier flagged three separate times (#5, #24, #29).

### Pillar 4: Typography (3/4)

- Font sizes observed in `features/assessments/*.tsx`: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl` — five distinct size classes against the app-wide four-size contract (14/16/20/28px only). `text-lg` (Tailwind default 18px) is the outlier, appearing 7 times, generally on card/section headings that should be the declared 20px Heading role (`text-xl`).
- Font weights observed: `font-medium` and `font-semibold` — two distinct Tailwind weight names, but `font-medium` resolves to 500, not the contract's declared 400 ("Body") or 600 ("Label"/"Heading"). `font-medium` is used far more frequently (~30+ sites) than `font-semibold`, meaning the majority of "emphasized" text in this phase is off-contract by one weight step.
- `font-variant-numeric: tabular-nums` usage was not spot-checked in this pass beyond the one `tabular-nums` class already observed in `assessment-list.tsx` pagination text — acceptable given the ID/date-heavy list surfaces.

### Pillar 5: Spacing (4/4)

- `grep` for arbitrary `[...px]`/`[...rem]` values in `features/assessments/` returns only the two `xl:grid-cols-[minmax(0,1fr)_22rem]` grid-template arbitrary values, and both the loading skeleton (`assessment-editor.tsx:78`) and the populated layout (`assessment-editor.tsx:147`) now use the identical breakpoint and column width — this closes the previously-flagged skeleton/loaded-layout mismatch (dossier #12), which would have caused a visible content jump at 1024–1280px viewports.
- No other arbitrary spacing values found; standard Tailwind spacing scale classes (`gap-2`, `gap-3`, `gap-6`, `p-4`, `px-2 py-3`, etc.) are used consistently and map cleanly onto the declared 4px-multiple scale.

### Pillar 6: Experience Design (4/4)

- Field-level validation is now wired end-to-end in all three editors (`risk-editor.tsx`, `assessment-editor.tsx`, `control-implementation-editor.tsx`): `setError`/`form.setError` iterate `result.fieldErrors` and populate `formState.errors`, every input/select carries `aria-invalid`/`aria-describedby`, and a shared `FieldError` component renders an `AlertCircleIcon` alongside the destructive-colored text (`risk-editor.tsx:230`, `control-implementation-editor.tsx:148`) — this closes dossier findings #8, #9, #25, #26, #33 (previously color-only, unassociated error text with no field attribution).
- `assessment-draft-job.tsx`: queued/running/completed transitions render as plain `div`s, not `Alert` components, so only a single `role="status"`/`aria-live="polite"` `sr-only` announcer (line 207) speaks each transition — the previous triple-assertive-alert spam (dossier #10) is gone. The 30-second timeout state now offers a `Check again` button (line 213) that re-triggers polling in place, closing the dead-end recovery gap (dossier #11).
- Route-level `loading.tsx`/`error.tsx` now exist for all four analyst/requestor review route segments (`app/(app)/app/assessments/{,[documentId]/}{loading,error}.tsx`, `app/(app)/app/requests/{,[documentId]/}{loading,error}.tsx`) — closes dossier #16/#37.
- Both the analyst review queue (`/app/review/assessments`) and the Requestor assessment inventory (`/app/assessments`) now have navigation entries in `config/navigation/navigation.ts:25,29` — closes dossier #44's unreachable-page finding.
- Not independently re-verified in this pass: the `owner-combobox.tsx` aria-activedescendant/visible-highlight synchronization fix (dossier #7/#22/#30/#31/#32) — direct source read shows the component was rewritten to a manual `role="combobox"`/`role="listbox"` implementation (no `cmdk`) where the same `activeIndex` state drives both the `bg-accent` highlight class and `aria-activedescendant`/`aria-selected`, and the popover now uses `onOpenChange` (dismissing on outside click/blur) — this reads as a genuine fix, not a partial patch, but was not exercised in a live browser.

---

## Files Audited

- `apps/web/src/components/csrm/risk-rating-badge.tsx`
- `apps/web/src/features/assessments/owner-combobox.tsx`
- `apps/web/src/features/assessments/assessment-editor.tsx`
- `apps/web/src/features/assessments/risk-editor.tsx`
- `apps/web/src/features/assessments/control-implementation-editor.tsx`
- `apps/web/src/features/assessments/assessment-list.tsx`
- `apps/web/src/features/assessments/assessment-draft-job.tsx`
- `apps/web/src/components/ui/alert.tsx`
- `apps/web/src/config/navigation/navigation.ts`
- `apps/web/app/(app)/app/review/assessments/`, `apps/web/app/(app)/app/review/requests/`, `apps/web/app/(app)/app/assessments/`, `apps/web/app/(app)/app/requests/` (route directory listings for loading/error boundaries)
- `.planning/phases/04-assessment-review-risk-editing-and-release/04-REVIEW-FINDINGS.md` (prior 45-finding adversarial dossier, used as a hypothesis source, independently re-verified against current source rather than trusted)
- `.planning/phases/04-assessment-review-risk-editing-and-release/04-REVIEW.md` (code review report)
- `.planning/phases/04-assessment-review-risk-editing-and-release/04-VERIFICATION.md` (phase verification report)
- `.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md` (app-wide baseline contract)
- All 23 `04-*-SUMMARY.md` and `04-*-PLAN.md` files (surveyed for scope; not individually cited above)
