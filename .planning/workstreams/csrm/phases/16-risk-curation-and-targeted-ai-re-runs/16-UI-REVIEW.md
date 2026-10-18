# Phase 16 — UI Review

**Audited:** 2026-10-16  
**Baseline:** Approved `16-UI-SPEC.md` (with its R1 and R4 amendments) and `docs/design/csrm-design-direction.md` (X-27 to X-29)  
**Screenshots:** Not captured. This was a code-only audit: no dev server or Playwright was started, so ports 1337 and 3000 stayed free for parallel audits.  
**Interaction captures:** off (`workflow.ui_interaction_capture=false`; code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every contract string checked (forms, toasts, empty states, history states, register notice, readiness caption) is in source word for word. |
| 2. Visuals | 3/4 | The hierarchy and the phone/desktop branches are in code, but nothing was rendered. The history sheet uses a hand-built Radix frame instead of the shadcn `Sheet`. |
| 3. Color | 4/4 | No raw colours or palette utilities. Withdrawal is neutral, and every status pairs an icon with words. |
| 4. Typography | 4/4 | Only `text-xs`/`text-sm`/`text-heading-sm` and weights 400/500/600, as §Typography specifies. |
| 5. Spacing | 3/4 | Off-scale `gap-5` (20px) and `gap-1.5` (6px) appear in new code, and the withdrawn card's blocks sit 12px apart where the contract says 16px. |
| 6. Experience Design | 3/4 | State coverage is broad (300ms skeletons, empty, error, 403, 404, Undo, focus return). Four toggles are missing the required `aria-controls`. |

**Overall: 21/24**

---

## Top 3 Priority Fixes

1. **UI-01: four toggles have no `aria-controls`.** Assistive technology can't tell which region `Withdraw risk`, `Reinstate risk`, `Reject remaining` and the rewrite toggle expand. Add `aria-controls={formId}` that points at the well, sheet or list each one reveals.
2. **UI-02/UI-03: Phase 16 spacing is off the scale.** The rhythm between Risk cards and inside the withdrawn card differs from the active card and from the §3.9 scale. Change `gap-5` to `gap-4` (or `gap-6`) on both `Show` lists, and change the withdrawn card's `gap-3` to `gap-4`.
3. **UI-07: run the browser checks for 375/768/1440 and keyboard/NVDA.** Reflow of the 640px history sheet, the `12rem` compare grid and the 70vh bottom sheets has not been seen rendered. Capture the git-ignored screenshots and record the screen-reader pass.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **PASS:** §6.1/§6.2 forms (`Reason for withdrawing`, `Reason for reinstating`, `{n} of 500 characters`, `Keep risk`, `Keep withdrawn`, the unsaved-changes line) are in `withdraw-risk-form.tsx` and `risk-curation-domain.ts`. The toasts `{risk number} withdrawn.` and `reinstated.` are at `risk-curation-domain.ts:731,736`, and `Withdrawal undone…` and `Reinstatement undone…` are also present.
- **PASS:** §6.3 empty states: `assessment-editor.tsx:920,928`. The heading comes from `EmptyState noun`.
- **PASS:** §8 history copy (`newest first`, `Show older changes`, `History recorded from`, `No changes recorded yet`, the error, 403 and 404 lines, `Close history`) and the §11 register and detail copy (`Open and closed`, the `Only Security Analysts see them` notice, `Withdrawn risk - read only`, `Open {assessment number}`).
- **PASS:** §9.1 caption for the analyst who raised the request: `release-readiness-summary.ts:38`.
- **PASS:** Withdrawal is never styled destructive (Copywriting contract, "Destructive confirmation").

### Pillar 2: Visuals (3/4)

- **PASS:** The phone actions icon button is named `Actions for {risk number}` and is `size-11` (`risk-card-actions.tsx:69`). Every menu item is `min-h-11`.
- **UI-06 WARNING:** `risk-history-frame.tsx:52-60` builds the X-13 sheet from `SheetPrimitive` with its own overlay and animation classes, not the source-owned shadcn `Sheet` that `withdraw-risk-form.tsx:216` uses. This goes against the AGENTS.md rule "shadcn/ui before custom primitives" (§8.1 "the X-13 side sheet"). Either extend `components/ui/sheet.tsx` with a full-screen-below-md variant and use it, or record the exception in the UI-SPEC.
- **UI-07 WARNING:** Nothing was rendered, so these remain unverified: the §Accessibility 1.4.10 reflow from 320 to 1440 (`w-[min(640px,100vw)]` history sheet, `md:grid-cols-[12rem_1fr]` at `proposed-risk-card.tsx:191`, the `max-h-[70vh]` bottom sheets at `withdraw-risk-form.tsx:229` and `rewrite-form.tsx:105`), and the two-line clamp on withdrawn statements (`withdrawn-risk-card.tsx:76`).

### Pillar 3: Color (4/4)

- **PASS:** Phase 16 feature files contain zero hex, `rgb(` or `oklch(` values and zero `red-`/`amber-`/`slate-` style palette utilities.
- **PASS:** The withdrawn card uses `bg-surface` and `border-border` (§6.4), and the withdraw well uses `bg-surface-muted` (X-5). The `Withdrawn` badge is `StatusBadge family="risk"` (neutral plus `Archive`). Destructive colour appears only on error lines (10 `text-destructive`/link usages in `risk-curation`), as §Color allows.

### Pillar 4: Typography (4/4)

- **PASS:** Distribution in scope: `text-sm` ×75, `text-xs` ×41, `text-heading-sm` on form and sheet titles. Weights: `font-medium` ×40, `font-normal` ×3, `font-semibold` ×1. These are the 400/500/600 set from §Typography.
- **PASS:** `tabular-nums` is on the `Show` counts (`assessment-editor.tsx:914`) and the reason count (`withdraw-risk-form.tsx:199`).

### Pillar 5: Spacing (3/4)

- **UI-02 WARNING:** Phase 16 added `grid min-w-0 gap-5` (20px) to both `Show` lists (`assessment-editor.tsx:918` and `:925`, new in this phase's diff). §Spacing says "this phase adds no spacing value", and the steps run 16/24. Use `gap-4` (between blocks) or `gap-6` (between groups).
- **UI-03 WARNING:** The withdrawn card is `grid gap-3` (`withdrawn-risk-card.tsx:63`), but §Spacing says 16px "between a card's blocks", and its padding is already `p-4`. Change it to `gap-4`.
- **UI-04 WARNING:** Icon-to-text error lines use `gap-1.5` (6px) where §Spacing sets 4px for icon-to-text gaps: `ai-proposals-section-client.tsx:136`, `proposed-risk-card.tsx:148`, `rewrite-form-body.tsx:105,108`, `withdraw-risk-form.tsx:201`, `risk-proposal-job.tsx:171`, `suggest-more-risks-button.tsx:73`. Use `gap-1`, or record `gap-1.5` as the shared error-line exception in the direction.
- **PASS:** History entries use `p-3` compact and `p-4` comfortable (§Spacing 12/16). Actions are `gap-2` (8px).

### Pillar 6: Experience Design (3/4)

- **UI-01 BLOCKER:** The Accessibility contract 4.1.2 requires "`aria-expanded` and `aria-controls` on every toggle". These toggles have `aria-expanded` but no `aria-controls`:
  - `risk-card-actions.tsx:58` (`Withdraw risk` pill opening the §6.1 well)
  - `withdrawn-risk-card.tsx:83` (`Reinstate risk`)
  - `proposed-risk-card.tsx:404` (`Reject remaining`)
  - `risk-rewrite.tsx:299` (rewrite changes toggle)

  Give each revealed region an `id` and reference it. The pattern is already used at `withdrawn-risk-card.tsx:90` and `risk-history-sheet.tsx:123`.
- **UI-05 WARNING:** The §Accessibility 4.1.3 and 2.2.1 behaviours (one job announcement per state, Undo toasts pausing on hover and focus, the readiness count line) and the §15 keyboard-only path can't be confirmed from code. Run the NVDA and keyboard-only pass and record the results.
- **PASS:** The history sheet waits 300ms before showing its skeleton (`risk-history-frame.tsx:93-131`, §8.5). It covers empty, error, 403 and 404. Focus goes to the title on open and back to the opener on close (`risk-history-frame.tsx:62-68`). Show-older focuses the first new entry. The withdraw form keeps its reason in the session draft, focuses the field and re-blocks on unsaved changes (§6.1). The withdrawn card is read-only and offers `Reinstate risk` only when editable (§6.4/§6.5). `risk-details.tsx:143,174-187` shows the §11.3 alert and offers no editing.
- Stage A's FE3-* and FE4-* fixes (`16-REVIEW-DISPOSITION.md`) were not re-raised. The code reviewed matches their dispositions.

---

## Registry Safety

`components.json` confirms the source-owned shadcn/ui setup. `16-UI-SPEC.md` lists only official shadcn components and no third-party registry blocks. Registry audit: 0 third-party blocks checked, no flags.

## Files Audited

- `AGENTS.md`; `16-UI-SPEC.md` (§6, §8, §9, §11, Copywriting, Accessibility, Spacing, Typography, Color, Motion); `16-REVIEW-DISPOSITION.md`
- `apps/csrm/src/features/risk-curation/*.tsx` (withdraw-risk-form, withdrawn-risk-card, risk-card-actions, risk-history-sheet, risk-history-frame, risk-history-trigger, ai-proposals-section*, proposed-risk-card, rewrite-form*, risk-rewrite, risk-proposal-job, suggest-more-risks-button) and `risk-curation-domain.ts`
- `apps/csrm/src/features/assessments/assessment-editor.tsx`, `release-readiness-summary.ts`
- `apps/csrm/src/features/risks/risk-details.tsx`, `risk-register.tsx`, `risk-register-filters.tsx`
