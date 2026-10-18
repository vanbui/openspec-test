# Phase 15 — UI Review

**Audited:** 2026-10-13  
**Baseline:** Approved `15-UI-SPEC.md` and `docs/design/csrm-design-direction.md`  
**Screenshots:** Not captured; no dev server responded on ports 3000, 5173 or 8080.  
**Interaction captures:** off (`workflow.ui_interaction_capture=false`)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Actions and state copy follow the contract's “Confirm”, “Reject” and “Undo” vocabulary. |
| 2. Visuals | 3/4 | Composition and responsive branches are present in code; no rendered screenshots were available to judge hierarchy or clipping. |
| 3. Color | 4/4 | Feature color use is semantic and status is paired with text/icons; no raw color values were found in audited feature files. |
| 4. Typography | 4/4 | UI text uses the direction's utility scales and weights, including semantic heading and micro-label styles. |
| 5. Spacing | 4/4 | Card density, comparison padding and responsive spacing map to the specified 12px/16px and 4px scale. |
| 6. Experience Design | 3/4 | Automated states and journeys are broad; the contract's NVDA and keyboard-only operator checks remain unverified here. |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Capture the questionnaire panel at 1440px, 768px and 375px** — confirms the two-column comparison breakpoint, phone stacking and card hierarchy as actually rendered — start the app and retain git-ignored review captures.
2. **Complete the three UI-SPEC browser backstops** — compact card actions, a long section-name toast with reachable Undo, and the rewrite popover near the viewport edge can still impair review — record the manual results and adjust the relevant layout if any fail.
3. **Run the specified NVDA and keyboard-only review** — automated axe checks do not establish announcement cadence or the full review path — verify job status announcements, comparison table headers, toast Undo, and confirm/edit/reject/undo without a mouse.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

- **PASS:** The start action changes between `Suggest more questions`, `Suggest follow-up questions` and `Ask the AI` according to state, while pending work reads `Asking the AI…` ([questionnaire-ai-domain.ts](../../../../../apps/csrm/src/features/questionnaire-ai/questionnaire-ai-domain.ts:191), [ai-proposals-panel-client.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx:482)). This matches UI-D3 and the pending-state contract.
- **PASS:** Proposal actions use the required visible verbs, and errors have recovery copy such as “Try again” and “Refresh page”; no generic `OK` or `Click Here` action was found in the reviewed proposal surfaces.
- **PASS:** Empty, failed, stale and permission states have explicit user-facing sentences rather than internal state names. Relevant examples are in [questionnaire-ai-domain.ts](../../../../../apps/csrm/src/features/questionnaire-ai/questionnaire-ai-domain.ts:437) and [questionnaire-ai-refusal-copy.ts](../../../../../apps/csrm/src/features/questionnaire-ai/questionnaire-ai-refusal-copy.ts:54).

### Pillar 2: Visuals (3/4)

- **WARNING:** No screenshot was captured because no configured local server responded. Code inspection confirms the panel sits in a card frame, groups proposals into bordered cards and switches the comparison from table to stacked rows at the `md` breakpoint ([ai-proposals-panel.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/ai-proposals-panel.tsx:27), [proposal-item-card.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/proposal-item-card.tsx:186), [field-comparison.tsx](../../../../../apps/csrm/src/features/ai-assistance/field-comparison.tsx:38)); the rendered focal hierarchy, clipping and alignment are therefore unverified.
- **PASS:** The proposal card places kind/status first, then subject, content, rationale/source and actions; the comparison preserves named `Current` and `Proposed` columns on desktop and stacks them on mobile.
- **WARNING:** The design contract explicitly lists three visual backstops (long section-title toast, compact action row and edge-positioned rewrite popover). These remain a manual visual check rather than demonstrated captures in this audit.

### Pillar 3: Color (4/4)

- **PASS:** No hard-coded hex or `rgb()` values were found in the audited questionnaire-AI and comparison feature files. Feature classes use semantic tokens such as `text-foreground-secondary`, `border-border`, `bg-surface`, `text-destructive` and the shared warning status treatment.
- **PASS:** “Changed” is accompanied by a `PenLine` icon and text, and stale state uses a shared status badge with an explanatory line; meaning is not carried by color alone ([field-comparison.tsx](../../../../../apps/csrm/src/features/ai-assistance/field-comparison.tsx:25), [proposal-item-card.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/proposal-item-card.tsx:187)).
- **Evidence limit:** Screenshots were unavailable, so the visual color distribution could not be measured. The source-level audit shows no feature-owned palette and follows the BProton no-accent direction.

### Pillar 4: Typography (4/4)

- **PASS:** The feature uses body/caption/micro-label and heading utilities with the project's medium weight, instead of introducing a new font or ad hoc CSS typography ([ai-proposals-panel.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/ai-proposals-panel.tsx:31), [proposal-item-card.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/proposal-item-card.tsx:188)).
- **PASS:** Text sizes in the audited feature are primarily the established `text-xs`/`text-sm` pair, with the panel heading using `text-heading-sm`; weights are regular/medium, with no unusually dense font-size or weight set.
- **Evidence limit:** Actual font rendering and line-wrap at the three target widths were not captured.

### Pillar 5: Spacing (4/4)

- **PASS:** Proposal cards use `p-4` comfortable and `p-3` compact, matching the direction's 16px and 12px card padding; field comparison uses `px-4 py-3` and `px-3 py-2` for its two densities ([proposal-item-card.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/proposal-item-card.tsx:186), [field-comparison.tsx](../../../../../apps/csrm/src/features/ai-assistance/field-comparison.tsx:35)).
- **PASS:** The other fixed dimensions are contract-driven: the field's 640px maximum and three-to-eight-row textarea, and the desktop/mobile switch at 768px ([instruction-field.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/instruction-field.tsx:69), [field-comparison.tsx](../../../../../apps/csrm/src/features/ai-assistance/field-comparison.tsx:38)). No arbitrary spacing declarations outside these documented control dimensions were found.
- **WARNING:** At narrow widths, source classes set action touch targets to at least 44px; visual confirmation that long labels wrap without pushing adjacent controls off-screen is still part of the screenshot/backstop pass.

### Pillar 6: Experience Design (3/4)

- **PASS:** Loading has a delayed skeleton, proposal reads have an in-place retry, and start/job failures retain recovery actions and field text ([ai-proposals-panel-loader.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-loader.tsx:16), [ai-proposals-panel.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/ai-proposals-panel.tsx:40)).
- **PASS:** The panel covers empty, populated, decided, stale, job-running, job-failed, read-only and requesting-analyst states. The panel status and job result use a polite live region; keyboard focus is deliberately handed to the next open proposal or status line ([ai-proposals-panel-client.tsx](../../../../../apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx:681)). The phase's desktop and mobile Playwright journey exercises the core confirm/edit/reject/undo and Requestor visibility flow.
- **WARNING:** The UI-SPEC's manual NVDA cadence and keyboard-only path are not established by source inspection or axe. Complete them before treating assistive-technology interaction as fully verified.

---

## Registry Safety

`components.json` confirms the source-owned shadcn/ui setup. The UI-SPEC lists only official local shadcn components and no third-party registry blocks; no third-party block was checked and no registry flag was found.

## Files Audited

- `AGENTS.md`
- Phase 15 plans and summaries (`15-01` through `15-14`), `15-CONTEXT.md`, `15-UI-SPEC.md`, and `15-VALIDATION.md`
- `apps/csrm/src/features/questionnaire-ai/` UI, domain and refusal-copy modules
- `apps/csrm/src/features/ai-assistance/field-comparison.tsx`
- `apps/csrm/src/features/ai-assistance/ai-provenance-header.tsx` and `ai-inputs-changed.tsx`
- `apps/csrm/src/features/questionnaires/ai-instruction-text.tsx` and `questionnaire-review.tsx`
- `apps/csrm/src/features/assessments/questionnaire-generation-job.tsx`
- `apps/csrm/src/components/ui/button.tsx`, `card.tsx`, `textarea.tsx`, and `apps/csrm/components.json`
- `docs/design/csrm-design-direction.md`
