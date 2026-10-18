# Phase 12 — UI Review

**Audited:** 2026-10-08 (HEAD of `csrm`, after the stage B review-fix commits that follow `01d2034`)
**Baseline:** 12-UI-SPEC.md (with its 2026-10-08 stage B amendments), `docs/design/csrm-design-direction.md` (ADR 0001), AGENTS.md
**Screenshots:** none taken. This was a code-only audit, as the constraints required. The pilot's walk screenshots in `scratchpad/walk12/*.png` (375 and 1440, taken 2026-10-08 before stage B) are historical evidence only. Defects they show (D1 to D13) were checked against the code at HEAD and against the dispositions in 12-REVIEW-DISPOSITION.md.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false). Every interaction finding below comes from the code or from the pilot's walk.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | The D11 and D12 copy defects are fixed (singulars, no zero count, Description, provider punctuation). The remaining copy matches the contract. One plural is still built inline in JSX (UI-07) |
| 2. Visuals | 3/4 | The provenance header, field markers, review bar and sheet follow the contract. At 375 the phone editing layout leaves a form column of about 229 px (UI-02, deferred to Phase 18) |
| 3. Color | 4/4 | Feature files contain no hex, rgb or oklch values. The status colours are semantic tokens (`text-success`). The Undo-toast contrast (D1) and the danger toast edge (D9) are fixed in the shared Toaster with tokens |
| 4. Typography | 3/4 | Sizes in use: `text-xs`, `text-sm` and `text-heading-sm`. Weights in use: medium plus one `font-normal` override (UI-05). The source title is `text-sm` at 500 (UI-04) |
| 5. Spacing | 3/4 | Spacing stays on the 4 px scale (gap-0.5 to gap-6, p-4, px-6). There are two arbitrary width caps (UI-06) and the deferred phone column (UI-02) |
| 6. Experience Design | 3/4 | Loading, error, pending and rollback states are all covered (WR-307, D13(d), S1). The editor is 18,376 px tall with 457 Tab stops at 1440 (UI-03, deferred). D8, Tab moving through a live toast, was accepted (UI-08) |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **UI-02: the phone Risk form column is about 229 of 360 px at 375** — analysts editing on a phone get cramped, wrapping fields. The fix is the Phase 18 (ASSESS-15 criterion 3) stacked card list with a detail sheet below 768 px. Keep the deferral tracked.
2. **UI-03: the editor is 18,376 px long with 457 Tab stops at 1440** — keyboard users and long reviews pay a heavy navigation cost. The fix is Phase 18's risk table and density work. Until then, consider a "Next field to review" skip link in the review bar.
3. **UI-01: the shared `DialogContent` and `AlertDialogContent` default to 512 px (`sm:max-w-lg`)**, while the direction's confirm size is 480 px — every future consumer that forgets to override inherits the wrong width. Change the default in the shared primitives in a shared-UI phase (see UI-01). Phase 12's own surfaces are already correct.

---

## Detailed Findings

Each finding has a stable ID for a disposition file. BLOCKER = breaks task completion; WARNING = degrades quality. **No BLOCKERs were found.**

### UI-01: the shared dialogs are 512 px wide (open item S3)
- **Pillar:** Visuals / Spacing. **Severity:** WARNING (latent). **needs_human_review:** true (which phase owns it)
- **Where:** `apps/csrm/src/components/ui/dialog.tsx:64` and `apps/csrm/src/components/ui/alert-dialog.tsx:61` (`sm:max-w-lg`, which is 32 rem = 512 px).
- **Requirement:** direction §4 Dialogs sets 480 px for confirm dialogs, 640 px for form dialogs and 800 px for complex dialogs.
- **Are Phase 12's dialogs confirm dialogs?** Yes:
  - Its modal confirmations are "Return this questionnaire to draft?" (`questionnaire-review.tsx:166`) and the assessment editor's confirmations (`assessment-editor.tsx:366`). Both go through `components/csrm/ConfirmDialog`, which overrides the width to `w-[min(480px,calc(100vw-32px))] max-w-none` (`confirm-dialog.tsx:107`). They render at 480 px.
  - The source popover was fixed to 480 px under D7.
  - The run sheet is a side sheet at 640 px (`ai-run-sheet-frame.tsx:36`), which matches the direction's Side sheet entry.
  - No Phase 12 surface renders the raw 512 px default. `ConfirmDialog` is the only consumer of `AlertDialogContent`. `DialogContent`'s only consumer is quick find, which sets its own `quick-find-content` class.
- **Verdict:** this is a shared-primitive matter, not a Phase 12 defect.
- **Fix:** make the default `sm:max-w-[30rem]` (480 px) in both primitives, or add a `size` prop (`confirm` 480 / `form` 640 / `complex` 800). Then drop the override from `ConfirmDialog`. Assign it to the next shared-UI or design-system phase, and record it in `deferred-items.md`.

### Pillar 1: Copywriting (3/4)
- Stage B fixed the walk's copy defects in code. Under D11: "1 field to review" uses the singular, the bar shows no zero count (the caption becomes the status line), "Description" follows Phase 10 §9.1, and answers keep questionnaire order. Under D12, the deterministic provider's punctuation and neutral summary are fixed.
- The review bar copy matches §3.3 (`ai-review-bar.tsx:32`, `:35`). The field states read "Confirmed", "Edited, not saved" and "Edited" (`ai-field-marker.tsx:31`). The source error reads "We couldn't load this source." with "Try again".
- **UI-07 (WARNING, Copywriting):** pluralisation is done inline in JSX (`ai-review-bar.tsx:32`: `state.count === 1 ? 'field' : 'fields'`). The "without a source" count, `{state.uncited}`, takes no plural, which is correct, but the pattern is repeated across surfaces. AGENTS.md says logic stays out of JSX. **Fix:** move the plural into `ai-provenance-domain` and test it, as the other D11 strings are.

### Pillar 2: Visuals (3/4)
- The icons are `aria-hidden` and sit beside text. The icon buttons carry names ("Close source", `Confirm {label}`). Since stage B, the Risk badge count is `sr-only` text (D5).
- **UI-02 (WARNING, Visuals/Spacing):** at 375 the Risk card sits nested inside a card, leaving a form column of about 229 px (from the walk, before the fixes; the layout is unchanged). Deferred to Phase 18 (ASSESS-15 criterion 3). **Fix:** Phase 18's stacked card list with a detail sheet below 768 px.

### Pillar 3: Color (4/4)
- A search of `features/ai-assistance`, `assessment-editor.tsx` and `features/questionnaires` found no `#hex`, `rgb(` or `oklch(` values.
- The secondary text uses `text-foreground-secondary` throughout. Success uses `text-success` (two uses). There is one accent-class use in the feature folder. The AI marker uses `StatusBadge family="aiReview"` rather than a feature colour.
- D1 (the Undo label was rgb(20,20,19) on rgb(20,20,19)) is fixed in the shared Toaster as the outline pill with semantic tokens. A browser test proves 18.43:1. D9's 4 px status edge uses the status token.
- No issues remain. The evidence for the score is the clean grep and the token-based fixes.

### Pillar 4: Typography (3/4)
- **Distribution in `features/ai-assistance`:**

  | Class | Uses | Role |
  |-------|------|------|
  | `text-sm` | 21 | body |
  | `text-xs` | 16 | caption |
  | `text-heading-sm` | 6 | sheet headings (amended X-13) |
  | `font-medium` | 6 | |
  | `font-normal` | 1 | |

  That is three sizes and effectively two weights, within the standard. Digests use `font-mono text-xs`, as §2 requires.
- **UI-04 (WARNING, Typography; needs_human_review: true):** the source popover/sheet title is an `h2` in `text-sm font-medium` (`ai-source-frame.tsx:42`). The run sheet title and group headings use `--text-heading-sm`. Two overlay titles at two scales read inconsistently. **Fix:** confirm what 12-UI-SPEC §4 intends for the source title. If it should match the side sheet, use `text-heading-sm`. If the smaller title is deliberate, add a dated note to the spec.
- **UI-05 (WARNING, Typography):** the `font-normal` override inside a `font-medium` line (`ai-review-bar.tsx:32`) carries the "· k without a source" caption. Nesting a caption span in a 500-weight line is fragile. **Fix:** make it a sibling caption element, as §3.3 lays it out.

### Pillar 5: Spacing (3/4)
- **Top values:**

  | Class | Uses |
  |-------|------|
  | `gap-2` | 16 |
  | `gap-3` | 11 |
  | `p-4` | 9 |
  | `gap-1` | 8 |
  | `gap-6` | 2 |
  | `px-6` | 2 |

  All of these are on the 4 px scale. D6, the missing gap under the questionnaire provenance header, is fixed with `mb-6` at three call sites.
- **UI-06 (WARNING, Spacing):** `max-w-[min(28rem,100%)]` is an arbitrary value in `ai-citations.tsx:87` and `:99`. 448 px is not a direction width. **Fix:** use a container token or `max-w-md` and keep `min-w-0`/`truncate`, or document the cap in §4 of the spec.
- `max-h-[85vh]` (`ai-source-frame.tsx:51`) and `w-[min(640px,100vw)]` (`ai-run-sheet-frame.tsx:36`) map to the direction's phone sheet and form width. They are acceptable.

### Pillar 6: Experience Design (3/4)
- **States are covered:**
  - Lazy sheet and source: a skeleton after 300 ms, then an error with Try again (WR-307).
  - Optimistic decisions: rollback with a danger toast (walk backstop 7).
  - Pending opacity without a transition (D13(d), `ai-field-marker.tsx:25`).
  - The Undo toast holds while focused (S1).
  - Focus returns after Confirm and after Undo (WR-301, D3).
  - The phone touch targets are `max-md:min-h-11` (D4, `ai-field-marker.tsx:37`).
  - A released record presents no unmet requirements (D13(a)).
  - Destructive revert goes through ConfirmDialog with a required reason.
- **UI-03 (WARNING, Experience):** the editor is 18,376 px tall with 457 Tab stops at 1440. Deferred to Phase 18. **Fix:** Phase 18's risk table. In the meantime, a "Next to review" jump from the review bar would shorten the review loop.
- **UI-08 (WARNING, Experience; needs_human_review: true):** with a toast up, Tab from the last control cycles through the toast's Undo and back (D8, accepted as DOM order because Shift+Tab escapes). Confirm the acceptance against WCAG 2.1.2 on a real screen reader before the milestone UAT.
- **UI-09 (info):** the walk screenshots predate stage B. D1 to D4 were re-verified only by browser tests in the gate, which the pilot accepted. No post-fix visual capture exists for this review. **Fix:** take one 375/1440 capture of the Risk form and a live toast in the milestone UAT.

---

## Files Audited
- apps/csrm/src/features/ai-assistance/*.tsx (ai-assistance-notice, ai-citations, ai-control-suggestions, ai-field-marker, ai-policy-gate, ai-provenance-header, ai-review-bar, ai-run-sheet, ai-run-sheet-frame, ai-run-sheet-trigger, ai-source-frame, ai-source-popover, ai-uncited-claims)
- apps/csrm/src/features/assessments/assessment-editor.tsx, apps/csrm/src/features/questionnaires/questionnaire-review.tsx
- apps/csrm/src/components/ui/dialog.tsx, alert-dialog.tsx, sheet.tsx; apps/csrm/src/components/csrm/confirm-dialog.tsx; apps/csrm/src/features/quick-find/quick-find-dialog.tsx
- 12-UI-SPEC.md, 12-REVIEW-DISPOSITION.md, scratchpad/phase12-stageB.md, docs/design/csrm-design-direction.md (§4 Dialogs, Side sheet)
