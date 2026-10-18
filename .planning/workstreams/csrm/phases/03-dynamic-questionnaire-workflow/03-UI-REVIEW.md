# Phase 3 — UI Review

**Audited:** 2026-09-10
**Baseline:** No phase-specific UI-SPEC.md. Audited against the app-wide `01-UI-SPEC.md` (spacing scale, typography ramp, color tokens, state-copy contract) and abstract 6-pillar standards where the shell spec is silent.
**Screenshots:** Not captured — no dev server running at localhost:3000/5173/8080; code-only audit performed against `apps/web/src/features/questionnaires/**` and its E2E/unit tests.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Purposeful, specific state/error copy, but drifts from Phase 1's canonical error string and duplicates four near-identical state blocks instead of one shared source of truth. |
| 2. Visuals | 3/4 | Clear card hierarchy and icon+label status badges, but empty/error/permission/loading UI is hand-rolled four times instead of using (or creating) shared shell primitives. |
| 3. Color | 4/4 | Semantic tokens only, no hardcoded hex/rgb, accent reserved to one primary CTA per view, status colour always paired with icon+text. |
| 4. Typography | 2/4 | Uses `text-lg` (18px) and `text-xs` (12px) throughout, neither of which is in the declared four-size ramp (14/16/20/28px). |
| 5. Spacing | 2/4 | Long unbroken question text or free-text answers (up to 65,535 chars, no max-length guard in the renderer) can force full-page horizontal scroll — the exact bug class the phase already fixed in `RevertAuditSummary` but never applied to the renderer itself. |
| 6. Experience Design | 4/4 | Loading/empty/error/permission/populated states covered on every screen; draft save/resume, submit confirmation, conditional-field focus management, and required-file-unsupported handling are all deliberate and recoverable. |

**Overall: 18/24**

---

## Top 3 Priority Fixes

1. **Unbounded question/answer text can scroll the whole page sideways** — `apps/web/src/features/questionnaires/questionnaire-renderer.tsx:164-211` (question legends/labels) and `:216-224` (`ReadOnlyQuestion` answer display) render `question.questionText` (`questionnaire-schema.ts:98`, `max(65_535)`) and free-text answers inside plain `grid gap-N` divs with no `min-w-0`/`[overflow-wrap:anywhere]`. A single long unbroken token (a pasted URL, hash, or ID) breaks the "no horizontal page scrolling" contract for every Requestor and Analyst who opens that question. **Fix:** apply the same `min-w-0` + `[overflow-wrap:anywhere]` pattern already proven in `apps/web/src/components/csrm/revert-audit-summary.tsx:44-51` to the question legend/label wrapper and to `ReadOnlyQuestion`'s answer `<p>`.

2. **Font sizes fall outside the declared four-size typography ramp** — `text-lg` (18px, e.g. `questionnaire-list.tsx:131,143,153,186`; `questionnaire-review-list.tsx:101,110,120,137`) and `text-xs` (12px, e.g. `questionnaire-list.tsx:68,86`; `questionnaire-review-list.tsx:58,75`; `questionnaire-renderer.tsx:135`) are used across every state/empty/error heading and every metadata label in the feature, but the app-wide ramp is exactly 14/16/20/28px. This is systemic — not a one-off — across all six questionnaire components. **Fix:** replace `text-lg` state headings with `text-xl` (20px, the declared Heading size) and replace `text-xs` metadata/error text with `text-sm` (14px, the declared Label size), or extend/document a deliberate ramp exception if 18/12px is intentional.

3. **Empty/error/permission/loading UI is copy-pasted four times instead of componentized** — `questionnaire-list.tsx:128-160`, `questionnaire-review-list.tsx:98-125` (and the analogous inline states in `questionnaire-detail.tsx`/`questionnaire-review.tsx`) each hand-roll the same `<section className="space-y-3 rounded-md border border-border bg-card p-6 text-center">` markup with near-duplicate copy ("We couldn't load your questionnaires" vs. "We couldn't load questionnaire reviews" vs. the Phase 1 canonical "We couldn't load this page..."). No shared `EmptyState`/`ErrorState`/`PermissionDeniedState`/`LoadingState` component exists anywhere in `apps/web/src/components/` despite being required shell primitives in Phase 1. **Fix:** extract one shared state-block component (or import Phase 1's, if built later) so wording, spacing, and semantics can't drift screen-to-screen — this phase's four in-feature copies are inconsistent with each other and with the app-wide canonical error copy.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Question-level validation messages are specific and reference the actual question text (`Enter an answer for ${question.questionText}.`, `questionnaire-renderer.tsx:100`), which is well above generic "Invalid input" copy.
- Submit/save/revert flows use precise, consequence-aware copy: "Submission is irreversible. This questionnaire cannot be edited after submission." (`questionnaire-renderer.tsx:387`), "This returns the submitted answer batch to draft while preserving its values." (`questionnaire-detail.tsx:65`).
- Drift from the Phase 1 canonical error copy: spec text is *"We couldn't load this page. Try again. If the problem continues, contact your CSRM administrator."* (`01-UI-SPEC.md:123`); the feature instead ships three different variants — *"We couldn't load your questionnaires. Try again. If the problem continues, contact your administrator."* (`questionnaire-list.tsx:144`), *"We couldn't load questionnaire reviews..."* (`questionnaire-review-list.tsx:111`), and *"We couldn't load this questionnaire..."* (`questionnaire-detail.tsx:32`). Each drops "CSRM" and re-derives its own noun phrase. Acceptable specificity, but three near-identical strings maintained independently is a maintenance and consistency risk, not a deliberate content decision recorded anywhere.
- No generic "Submit"/"Click Here"/"OK" labels found; all CTAs are task-specific ("Save draft", "Submit questionnaire", "Return questionnaire to draft").

### Pillar 2: Visuals (3/4)
- Status badges consistently pair an icon with a text label and a semantic-token background (`statePresentations` in `questionnaire-list.tsx:33-49`, `reviewStatePresentations` in `questionnaire-review-list.tsx:33-44`) — never colour alone.
- Card layout gives each questionnaire a clear focal point: number → title (link) → status badge → linked request → progress.
- Deduction: four separate hand-rolled implementations of the same empty/error/permission block (see Fix #3) is a genuine visual-consistency risk — nothing enforces that a future edit to one doesn't silently diverge from the other three, and Phase 1's own required shell primitives (`EmptyState`, `ErrorState`, `PermissionDeniedState`, `LoadingState`) were never built to be reused (confirmed: no such files exist under `apps/web/src/components/`).
- Icon-only elements (e.g. `AlertCircle`, `CheckCircle2`, `Clock3`, `CircleDashed`, `FilePenLine`) are consistently `aria-hidden` and paired with visible text — correct per the accessibility contract.

### Pillar 3: Color (4/4)
- `grep` across all `.tsx` files in the feature for hex/`rgb(` literals returned zero matches — 100% semantic-token usage.
- Accent (`primary`) is reserved to exactly one CTA per edit-mode view: "Save draft" is the solid primary button; "Submit questionnaire" is deliberately `variant="outline"` (`questionnaire-renderer.tsx:383-393`), consistent with the "one primary CTA per view" rule.
- Status colours (info/success/warning/destructive) are all sourced from the declared semantic classes (`border-success-border bg-success-subtle text-success`, `border-warning-border bg-warning-subtle text-warning`, etc.) with no ad hoc overrides.

### Pillar 4: Typography (2/4)
- Font-weight discipline is correct: only `font-medium` (16 uses) and `font-semibold` (11 uses) appear, matching the declared two-weight contract.
- Font-size discipline fails the declared four-size ramp (14/16/20/28px only). Actual sizes in use: `text-xs` (12px, 5 occurrences), `text-sm` (14px, 42 occurrences), `text-base` (16px, 2 occurrences), `text-lg` (18px, 8 occurrences) — six distinct pixel sizes are effectively in play once `text-xl`/`text-2xl` used elsewhere in the app shell are counted, and neither `text-xs` nor `text-lg` maps to any declared token. Every state-block heading in this phase (empty/error/permission/no-results, in both the Requestor and Analyst list views) uses the off-ramp `text-lg` instead of the declared 20px Heading size.

### Pillar 5: Spacing (2/4)
- The declared 4px scale is otherwise respected cleanly: no arbitrary `[Npx]`/`[Nrem]` spacing values found anywhere in the feature (`grep` for `\[.*px\]|\[.*rem\]` returned nothing), and gap/padding classes consistently map to `gap-1/2/3/4/6/8` and `p-4/5/6`.
- Confirmed structural defect: `questionnaire-renderer.tsx` renders `question.questionText` (validated up to 65,535 characters, `questionnaire-schema.ts:98`) and free-text answer values (also up to 65,535 characters, `questionnaire-renderer.tsx:46`) inside plain `<div className="grid gap-N">`/`<fieldset className="grid gap-3">` wrappers with no `min-w-0` and no `overflow-wrap` protection (lines 151, 164, 176, 188, 206, 218). Tailwind's un-templated `grid` gives a single auto-sized track that measures unbroken content at its intrinsic max-content width — precisely the mechanism the team diagnosed and fixed one file over in `revert-audit-summary.tsx:44-51` (see its inline comment explaining why `overflow-wrap:anywhere` plus `min-w-0` was required after `break-words` alone still let the track push the page wide). That fix was not carried into the questionnaire renderer, so any question with a long unbroken label, or any answered long-text/short-text field containing an unbroken token, will reproduce the same "page scrolls sideways" defect this exact phase already shipped a fix for elsewhere.
- This is a confirmed contract violation of the explicit rule "No horizontal page scrolling; only a deliberate, labelled table scroll container may scroll horizontally" (`01-UI-SPEC.md:58`).

### Pillar 6: Experience Design (4/4)
- All required states are implemented and distinguishable on every screen: loading (skeleton cards matching final layout, `questionnaire-list.tsx:108-126`), empty (with a filtered-vs-unfiltered distinction, `questionnaire-list.tsx:186`), error (recoverable via a "Try again" link), permission-denied, and populated/success.
- Draft save/resume is explicit and gives feedback (`draftMessage` success text, `questionnaire-renderer.tsx:301,360`) without relying on a toast alone for a consequential action.
- Submission uses a proper `ConfirmDialog` with an irreversibility warning, pre-open validation gate (`prepareSubmission`, `questionnaire-renderer.tsx:308-316`) that surfaces a summary error and moves focus to the first invalid/unsupported question — this exceeds the accessibility contract's minimum ("moves focus to the summary or first invalid field").
- Conditional-question visibility is handled deliberately: when a controlling answer hides a dependent question, its value is cleared and, if it held focus, focus is deliberately moved back to the controlling field (`questionnaire-renderer.tsx:270-283`) rather than being silently lost.
- Unsupported `File upload` answer type is handled as a deliberate, visible `Alert` rather than silently rendering a broken control or crashing (`questionnaire-renderer.tsx:149-156, 220-221`), matching the D-04 contract requirement.
- Destructive/consequential revert-to-draft requires a typed reason before the confirm button enables (`confirm-dialog.tsx`), consistent with the reusable `ConfirmDialog` contract.

---

## Registry Safety

Not applicable — `components.json`/shadcn scope was not part of this phase's changes; no new third-party registry blocks were introduced (Phase 3 files import only existing shadcn primitives already in the shell).

---

## Files Audited

- `apps/web/src/features/questionnaires/questionnaire-renderer.tsx`
- `apps/web/src/features/questionnaires/questionnaire-detail.tsx`
- `apps/web/src/features/questionnaires/questionnaire-review.tsx`
- `apps/web/src/features/questionnaires/questionnaire-list.tsx`
- `apps/web/src/features/questionnaires/questionnaire-review-list.tsx`
- `apps/web/src/features/questionnaires/questionnaire-pagination.tsx`
- `apps/web/src/features/questionnaires/questionnaire-domain.ts`
- `apps/web/src/features/questionnaires/questionnaire-schema.ts`
- `apps/web/src/components/csrm/form-section.tsx`
- `apps/web/src/components/csrm/confirm-dialog.tsx`
- `apps/web/src/components/csrm/revert-audit-summary.tsx`
- `.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md` (baseline)
- `.planning/phases/03-dynamic-questionnaire-workflow/03-CONTEXT.md`, `03-01` through `03-12` PLAN/SUMMARY files
