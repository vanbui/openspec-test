---
phase: "16"
slug: "risk-curation-and-targeted-ai-re-runs"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 16 — UI Design Contract

> Visual and interaction contract for risk curation and targeted AI re-runs. It covers:
> - the `AI proposals` section of the assessment editor: `Suggest more risks`, proposed risks and the open-rewrite index (D-30 to D-33, D-41, D-45);
> - `Rewrite this risk` and the per-field comparison in each Risk card (D-34 to D-38);
> - decisions, Undo and staleness (D-39, D-40);
> - withdrawing and reinstating a Risk, the `Active` / `Withdrawn` filter and the withdrawn card (D-05 to D-12);
> - discarding an unsaved new Risk (D-17);
> - the Risk's history sheet (D-18 to D-21);
> - release readiness, the overall-rating hint and the "AI inputs changed" signal (D-15, D-28, D-42);
> - the Risk Register's `Withdrawn` filter and read-only withdrawn detail (D-08, D-45);
> - what stays unchanged for the released view and the Requestor (D-08, D-29);
> - the Security Analyst who raised the request, who takes no targeted AI action on it (§12.3).
>
> It introduces no colour, type size, weight, family, radius, shadow, spacing step or duration of its own. Three patterns the direction does not yet name are proposed as CSRM extensions X-27 to X-29.

---

## Binding inputs and value authority

- **Locked decisions.** D-01 to D-52 in `16-CONTEXT.md` and its Orchestrator Confirmations govern this contract, and they take precedence over `16-RESEARCH.md`. These confirmations bear on it directly:
  - visible `Confirm` and `Confirm all` replace D-36, D-47 and D-49's "Accept" and "Accept all", and `Reject` stays;
  - one proposal and decision model, Phase 15's, is used: item states are folded from decisions, and Phase 15's reason codes, instruction validator and similarity scorer are reused;
  - G-14's planned-control condition on an AI "Accept";
  - the "UI-SPEC points settled" confirmation: Undo after a reinstatement is allowed (`undo: true` on the withdrawals operation, §6.2), and an analyst who raised the request takes no targeted AI action on it, with no re-run and no decision (Phase 15 D-32, G-1). This narrows D-44 (§12.3).

  This contract fixes the copy, layout and visuals that the context leaves to the UI-SPEC (Planner's Discretion). Where a decision leaves a choice open, it makes that choice and records why under "Decisions recorded" (UI-D1 to UI-D35).
- **Value authority.** `docs/design/csrm-design-direction.md` (ADR 0001) is the only source of values. This file names semantic tokens and cites the direction by section (§). It restates no colour, size, radius, shadow or duration. A spacing step is named only where a new layout needs one, and each is a §3.9 step.
- **Extensions.** These are recorded before any Phase 16 plan runs: X-1 to X-5 (Phase 10), X-6 to X-10 (Phase 11), X-11 to X-14 (Phase 12), X-15 to X-18 (Phase 13), X-19 to X-23 (Phase 14) and X-24 to X-26 (Phase 15). This contract reuses:
  - X-1 (save status) for the overall-rating hint's unsaved value;
  - X-3 (dates and times) and X-4 (separators) everywhere;
  - X-5 (in-place edit form) for the withdraw and reinstate forms;
  - X-7 (keyboard shortcut hint) on the instruction field's actions;
  - X-10 (figure links) for every new count;
  - Phase 12's X-11 (AI provenance badge and notes), X-12 (source citations), X-13 (side sheet) and X-14 (Undo toast), with Phase 12's decision pattern (12 §6);
  - X-15's rule that a viewer who may not act sees why in words;
  - X-18 (the "AI inputs changed" signal), which gains this phase's action (§10.2);
  - Phase 15's X-24 (AI proposal items and the before-and-after comparison) and X-25 (instruction field).

  The comparison is X-24's and no second one is proposed. The new patterns are listed under "Proposed CSRM extensions" with their exact wording: X-27 (withdrawn records), X-28 (field decisions and similar records, extending X-24) and X-29 (record history).
- **Requirements.** ASSESS-09 and ASSESS-10. The acceptance bar is ROADMAP Phase 16 success criteria 1 to 4.
- **Findings closed.** UAT-027 and UAT-028 (F7).
- **Delegated decisions.** #5, #6, #8, #9, #10, #11, #12, #14 and #17, plus G-1, G-3, G-4 (§15 of this contract), G-6, G-11 to G-15 and the glossary entries "Confirm (AI proposal)" and "Withdrawn (Risk)".
- **Builds on Phases 10 to 15.** Their plans are written but not yet executed. This contract builds on:
  - from Phase 10: the editor (10 §13), readiness (10 §14), the released view (10 §15), timelines (10 §4.2), refusal families A to I (10 §10.2) and the job cards (10 §12);
  - from Phase 11: voice, the token tables and the register filters (11 §9.5);
  - from Phase 12: the header (12 §1), the run sheet (12 §2), markers (12 §3), citations (12 §4), decisions (12 §6) and family J;
  - from Phase 13: the signal (13 §10.2), its session draft store (13 §9.3) and families K to M;
  - from Phase 14: families N to P and `Files` in the run sheet;
  - from Phase 15: X-24, X-25 and the `features/ai-assistance/field-comparison` module (15 §4), family Q, and its panel, job and decided-group patterns (15 §2, §4.6).

  Every plan re-reads those files once the earlier phases have executed.
- **Domain vocabulary.** Risk, Risk Type, mitigation control, Security Analyst, Requestor, Assessment Request and risk assessment, as the JDL and the glossary use them. "Proposed risk", "AI rewrite" and "history" present the planned `CsrmAiRun` items and the history entity. They are not competing entities.
- **Reserved words.**
  - An analyst confirms, rejects or undoes a proposal (glossary "Confirm (AI proposal)"). A proposed risk is added (`Add to assessment`) or rejected.
  - A Risk is withdrawn or reinstated (glossary "Withdrawn (Risk)").
  - `Accept`, `Approve`, `Delete`, `Remove` and `Not applicable` never name these acts. `Accept` and `Treat` appear only as treatment action values, verbatim.
  - `Dismiss` stays with Phase 12's suggested controls.

### Decision coverage

| Decisions | Where this contract honours them |
|---|---|
| D-01 to D-04, D-16 (contract, no delete) | No UI of their own; §6 offers no delete anywhere; §13 R1's request-deletion line |
| D-05 to D-07 | §6.4 (read-only withdrawn card), §13 R1 `RISK_WITHDRAWN` |
| D-08 | §6.3 filter, §11 register, §12 Requestor exclusions |
| D-09, D-10 | §6.1 and §6.2 (one id per action; Phase 18 reuses the form) |
| D-11 | §6.1, §6.2, §6.5 (no dialog, Undo) |
| D-12 | §9.1 (`At least one Risk` outstanding) |
| D-13, D-14 | Server-side. Every count this contract shows is served |
| D-15 | §9.2 |
| D-17 | §7 |
| D-18 to D-21 | §8 (X-29) |
| D-22, D-23, D-29 | §2.4 state lines; §12.1 (no control once released) |
| D-24 to D-27 | §2.2 (X-25), §2.3 jobs, §4.1, §10.3 |
| D-28 | §10.2 |
| D-30 to D-33 | §2, §3 |
| D-34 to D-38 | §4 |
| D-39 to D-41 | §5, §3.6 |
| D-42 | §9.1 |
| D-43, D-44 | No control without the grant; §13's 403 copy. D-44 as narrowed by the confirmation: §12.3 (the requesting analyst) and R2 and R3's `OWN_REQUEST` |
| D-45 | §1 to §12 |
| D-46 | X-24, X-27 to X-29 and the `risk` status family (§6.4) |
| D-47 | §15 |
| D-48 | Notes carried (route budget) |
| D-49 | Voice section, Copywriting contract |
| D-50 | §16, Verification contract |

---

## Design system

| Property | Value |
|----------|-------|
| Tool | shadcn/ui, source-owned local components (`apps/csrm/components.json`: style `new-york`, RSC, CSS variables, neutral base, `iconLibrary: lucide`) |
| Preset | new-york; neutral base; CSS variables; RSC; Lucide icons |
| Component library | Radix primitives through the installed `radix-ui` package (1.6.7), composed by the local shadcn/ui components; `sonner` under the source-owned `Toaster` |
| Icon library | `lucide-react` 1.30.0, per §4 Iconography. Every icon named here was confirmed in the installed package on 2026-10-01 |
| Font | Plus Jakarta Sans for UI text, data and numbers; Instrument Serif for page titles only; IBM Plex Mono for micro-labels and identifiers (§3.10, ADR 0001 gap 8) |
| Tokens | Semantic tokens in `apps/csrm/app/globals.css`, whose values are the direction's; feature code consumes only the mapped utilities |
| New dependencies | None. The word diff is a bounded, hand-written, zod-free function (research, Alternatives Considered); every surface composes installed components |

---

## Component inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

This is a non-exhaustive list of the known-good components this phase uses, never a closed allowlist. The full set runs from `alert-dialog` to `tooltip`.

| Component | Import path | Phase 16 use |
|---|---|---|
| `Input`, `Textarea`, `Label`, `Checkbox` | `@/components/ui/*` | Withdraw and reinstate reasons, reject reasons, the instruction (X-25), the rewrite's `What to rewrite` group |
| `Table` | `@/components/ui/table` | The rewrite comparison and the history comparison from 768px (X-24, X-28, X-29) |
| `Popover`, `Sheet` | `@/components/ui/popover`, `@/components/ui/sheet` | Rewrite form (a popover from 768px, a bottom sheet below); withdraw and reinstate forms below 768px; history and "What the AI used" (X-13); the phone proposals sheet |
| `DropdownMenu` | `@/components/ui/dropdown-menu` | The phone `Actions for {risk number}` menu (UI-D4) |
| `Toaster` (sonner `toast` with `action`) | `@/components/ui/sonner` | Undo, rollback and `Open {risk number}` toasts (X-14) |
| `Skeleton`, `Alert`, `Button`, `Separator` | `@/components/ui/*` | On-demand parts, job failures, actions, group dividers |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

This is a non-exhaustive list; the executor may use any exported primitive.

| Primitive | Path | Phase 16 change |
|---|---|---|
| `StatusBadge`, `statusPresentation` | `components/csrm/status-badge.tsx` | A new `risk` family: `withdrawn` → `Withdrawn`, neutral tone, `Archive` (X-27; S-14) |
| `SegmentedControl` | `components/csrm/segmented-control.tsx` | The `Show` filter (§6.3) and the density controls |
| `RiskRatingBadge` | `components/csrm/risk-rating-badge.tsx` | Unchanged; rating units and proposed risks render it |
| `RecordLink` | `components/csrm/record-link.tsx` | Figure links, `Added as {risk number}`, links to the history and to rewrites |
| `DetailSection` | `components/csrm/detail-section.tsx` | The `AI proposals` section frame |
| Phase 10 `LocalInstant`, navigation guard, `refusal-copy.ts`, `release-readiness-summary.ts`, the shared read-only Risk (10 §15.2) | as Phase 10 plans them | §6.4 details, §9.1, §13 |
| Phase 12 `ai-assistance` (header, run sheet, markers, citations, review bar) | as Phase 12 plans them | §3.4, §4.3, §10 |
| Phase 13 signal and session draft store | as Phase 13 plans them | §10.2; every kept field |
| Phase 15 `field-comparison` (with its `renderEmphasis` slot), instruction field, proposal item card | `features/ai-assistance/`, `features/questionnaire-ai/` as Phase 15 plans them | §3, §4 and §8, extended for X-28 and X-29 without forking |
| **New:** risk curation feature | recommended `features/risk-curation/` (research): `risk-curation-domain.ts` (zod-free: states, labels, unit grouping, the Accept pre-check, the overall-rating hint, the word diff), `ai-proposals-section.tsx`, `proposed-risk-card.tsx`, `risk-rewrite.tsx`, `rewrite-form.tsx`, `withdraw-risk-form.tsx`, `withdrawn-risk-card.tsx`, `risk-history-sheet.tsx`, `risk-proposal-job.tsx`, `risk-curation-actions.ts` (`'use server'`) | §1 to §11 |

The planner names the new modules and their paths. Zod stays out of every new client module (`zod-client-boundary.test.ts`). The proposals section, comparison, history sheet, rewrite form and withdraw form load with `next/dynamic` from a Client Component (D-48).

---

## Token names used in this contract

The Phase 11 contract's table applies, and this contract does not repeat it. This phase uses these tokens additionally or more heavily:

| Direction token | Utility or class in the shipped code | Phase 16 use |
|---|---|---|
| Neutral status tone (§4 Tone vocabulary) | `StatusBadge` neutral | `Withdrawn` |
| `--color-warning-bg` / `-fg` / `-border` | `bg-warning-subtle text-warning border-warning-border` | `Changed since proposed`, `AI proposed` (unchanged) |
| `--color-bg-inset` | `bg-surface-muted` | X-5 wells (withdraw, reinstate, reject reason); inserted-word emphasis (X-24) |
| `--color-border-default` | `border-border` | Cards, unit row groups, history entries |
| `--font-mono` with `--text-micro` | `.micro-label` | Eyebrows, `Current` / `Proposed` / `Before` / `After`, `Reason`, `Sources` |

---

## Voice, formats and shared copy rules

The Phase 11 contract's "Voice, formats and shared copy rules" applies unchanged: Australian English, sentence case, the spaced hyphen, the X-4 middle dot, typographic apostrophes and quotes, written-out plurals with `tabular-nums`, and X-3 times. So do Phase 12's "AI terms in copy" and "No internal terms", Phase 13's "People are names" and Phase 15's verbs and nouns. In addition:

- **Verbs.**
  - Proposals: `Confirm`, `Confirm all`, `Reject`, `Reject remaining`, `Undo`, and for a proposed risk, `Add to assessment`.
  - Risks: `Withdraw risk`, `Reinstate risk`, `Rewrite this risk`, `Suggest more risks`, `History`.
  - The only states are `Confirmed`, `Rejected`, `Added as {risk number}`, `Withdrawn` and `Reinstated`.
- **Never.** `Accept`, `Accept all`, `Approve`, `Delete`, `Remove` or `Not applicable` for any act in this phase. `Accept` appears only as a treatment action value.
- **Nouns.** Copy calls an AI item a "proposed risk" or an "AI change", and an operation "asking the AI". It never says "run", "item", "unit", "stale", "superseded", "lapsed", "base", "fold", "batch", "active-risk rule" or "soft delete".
- **Risk numbers** are shown verbatim and are never reused. A proposed risk has no number until it is added.
- **Reasons** are quoted with typographic quotes and shown as plain text with `[overflow-wrap:anywhere]`.

---

## 1. The assessment editor (D-45)

**Surface:** `/app/review/assessments/{id}` for a Security Analyst.
**Focal point:** while proposals are open, the first open proposal's decision. Otherwise, the first active Risk card, as today.

Page order. Phase 16's additions are in bold:
1. Page header, `AssessmentRequestLink` and stepper (unchanged).
2. Phase 12's provenance header, with **the open-proposal line** and **the signal's action** (§10).
3. Alerts, then the `Assessment details` and `Release readiness` grid. It gains **the overall-rating hint** (§9.2) and **`Decisions on AI proposals`** (§9.1).
4. **The `AI proposals` section (§2)**: a `DetailSection` with h2 `AI proposals` and region id `ai-proposals` (`tabIndex={-1}`), the target of every link to it (UI-D2).
5. `Identified Risks` (h2), containing:
   - **the `Show` filter (§6.3)**;
   - the Risk cards, each with **its actions (§6.1)**, **its `AI rewrite` (§4)** and **its open-change link (§4.6)**;
   - **withdrawn cards (§6.4)** under `Withdrawn`;
   - `Add Risk` with **`Discard new risk` (§7)**.

At rest, no new `form` element renders inside `Identified Risks`. The withdraw, reinstate, reject and rewrite forms render only while open, because `assessment-release-workflow.spec.ts:60` indexes the region's forms.

| Viewport | Contract |
|---|---|
| 1440 | Unchanged grid. The `AI proposals` section spans the content width at `--spacing-container-max`; the comparison uses the Risk card's width |
| 375 | Every block stacks. The `AI proposals` section becomes a summary card that opens the proposals sheet (§2.6). Risk card actions become one menu (UI-D4). No horizontal page scroll from 320px |

---

## 2. The `AI proposals` section (D-30, D-41, D-45)

### 2.1 Frame

| Part | Contract |
|---|---|
| Heading | h2 `AI proposals` (`--text-heading-sm`) |
| Description (`--text-body`, `--color-text-secondary`) | `Ask the AI for risks this assessment is missing. Nothing changes until you add a proposed risk or confirm a change, and every proposal needs your decision before release.` |
| Status line (`--text-body` at 500, `tabular-nums`, `tabIndex={-1}`) | `{n} open {proposal|proposals}`, where `n` counts the open proposed risks plus the open AI changes on Risks, or `No open AI proposals` |
| Density | A segmented control labelled `Density` with `Comfortable` and `Compact`, shown from 768px when one or more proposals are listed. One setting per person, persisted in the browser, applies to this section and to every `AI rewrite` on the page (UI-D29). Below 768px, comfortable applies |

Order inside the section:
1. the frame;
2. the state line (§2.4);
3. the start form (§2.2) or the job state (§2.3);
4. the open proposed-risk groups (§3.1), newest first;
5. `Open AI rewrites` (§2.5);
6. `Decided proposals` (§3.6).

### 2.2 Start form (X-25)

| Part | Contract |
|---|---|
| Instruction | The X-25 field, id `ai-proposals-instruction`. Hint: `Say what to look for, for example “Risks about payment file integrity”. The AI already reads the request, its answers, the marked notes and files, and the risks already in this assessment, withdrawn or rejected, so it doesn’t repeat them.` |
| Action (primary, `Sparkles`) | `Suggest more risks`, whether or not the field holds text (UI-D3). Pending: `Asking the AI…` with the inline 16px spinner. The X-7 hint `Ctrl` `Enter` or `⌘` `Enter` shows from 768px, with `aria-keyshortcuts` on the textarea |
| Refusal at start | §13 R2, under the field (an instruction reason) or as the form's error line (any other), `role="alert"`. The text stays |
| No lost input | X-25: the text is kept in the session draft store per person and assessment, guarded on reload and cleared once the AI is asked |

| Viewport | Contract |
|---|---|
| 1440 | The field at the §4 Forms maximum field width, with the action left-aligned under it |
| 375 | In the proposals sheet (§2.6), full width; the action at full width and the touch-target height |

### 2.3 Job state (Phase 10's job pattern, 10 §12; Phase 13 §13; 15 §2.3)

While a suggestion request is queued or running, the job state takes the start form's place.

| State | Contract |
|---|---|
| Queued or running | Status (`--text-body` at 500, polite live region): `The AI is looking for more risks`. Caption: `You can leave this page. Proposed risks show here when you come back.` When another analyst started it: `Started by {name}.` The `Attempt {n}` tag as Phase 10. Polls as Phase 10, then `Check again` (outline, small) after 30 seconds, with `Automatic checks stopped after 30 seconds. The AI may still be working.` |
| Completed with proposals | The section refreshes. The live region says `{n} proposed {risk is|risks are} ready to review.` Focus does not move |
| Completed, nothing kept | `The AI proposed no new risks for this assessment.` (polite, until the next page view), followed by §3.1's `{a} left out` figure link and its list. The start form returns |
| Completed after the assessment stopped being editable | `The assessment could no longer be changed when the AI finished, so its proposals were closed without a decision.` They are listed under `Decided proposals` |
| Failed | A danger-treatment `Alert`, titled `The AI request didn’t finish`, with §13 R4's copy and `Retry AI proposals` (outline) for any Security Analyst who may read the request except the analyst who raised it (Phase 13 D-18, narrowed by the confirmation; §12.3 shows that analyst no job state). The start form returns below it with its text kept |
| Status check failed | Phase 10's `Status unavailable` alert, unchanged |

### 2.4 By assessment state

| State | Line (`--text-body`, `--color-text-secondary`, 16px icon `aria-hidden`) | Start form | Proposals |
|---|---|---|---|
| Draft or in review | none | Offered | Every decision |
| AI policy refuses the request (12 §11.1) | 12 §11.1's warning `Alert` in place of the start form | Not offered | Every decision (deciding sends nothing to the AI) |
| Released | `Lock`: `This assessment has been released, so the AI can no longer propose changes and its risks can’t be withdrawn or reinstated.` | Not offered | None open; `Decided proposals` stays |
| Any other state the server serves as not editable (Phases 17 and 17.1 add their own lines) | `Lock`: `This assessment can’t be changed now, so the AI can’t be asked and proposals can’t be decided.` | Not offered | Read-only, with no actions |
| The viewer raised the request, unreleased (§12.3) | `Lock`: `You raised this request, so another Security Analyst asks the AI about this assessment and decides its proposals. You can still edit, withdraw and reinstate its risks.` | Not offered | Not shown: no job state, groups, `Open AI rewrites` or `Decided proposals` |

The requesting analyst's row takes precedence over the first two rows. Once released, the `Released` row applies to them too, without `Decided proposals`. A Requestor never reaches this section; their route gate is unchanged (10 §11).

### 2.5 Open AI rewrites

This lists every Risk with open AI changes, so the section indexes every open proposal (X-10: the list's total equals the status line's figure).

| Part | Contract |
|---|---|
| Heading | h3 `Open AI rewrites`. Not rendered when there are none |
| List | A `ul`. Each item is a record link `{risk number} · {k} AI {change|changes} to review` to `#risk-{id}-rewrite`, which moves focus to that Risk's `AI rewrite` heading. Inside the phone sheet, the sheet closes first |

### 2.6 Phones (D-47)

Below 768px, the section shows a summary card at `#ai-proposals`, with:
- the h2;
- the status line;
- the state line or the job status;
- `Review AI proposals` (outline, full width, the touch-target height), shown when proposals are open or decided;
- `Suggest more risks` (primary, full width), shown when a start is allowed.

For the analyst who raised the request, the card holds only the h2 and §2.4's line, with neither button and no sheet (§12.3).

Both buttons open a full-screen sheet (X-13's phone sheet) titled `AI proposals`, with `Close` named `Close AI proposals`. It holds §2.2 to §2.5 and §3.6. `Suggest more risks` opens it with focus in the instruction field; `Review AI proposals` opens it with focus on its title. Closing returns focus to the opener.

### 2.7 Empty and loading

| Case | Copy (§4 Empty states) |
|---|---|
| No proposal ever, start offered | `No AI proposals yet` · `Ask the AI for risks this assessment may be missing, or give it an instruction such as “Risks about payment file integrity”.` The start form is the call to action, so the empty state has no button |
| All decided | `No open AI proposals` (cleared type) · `Every proposal has been decided. They’re listed under Decided proposals.` |
| Loading | The frame renders with the page. The start form and lists load on demand: nothing for 300ms, then a skeleton of a field (a label line, a three-row block and a button block) and two item cards (an eyebrow, a title, a facts line, two badge blocks and an action row) |
| Error (the proposals read failed) | A compact `We couldn’t load the AI proposals` with `Try again`. Release readiness still shows the server's outstanding item |

---

## 3. Proposed risks (X-24, X-28; D-30 to D-33)

### 3.1 Groups

Open proposed risks are grouped by the request that produced them (X-24), newest first. Each group is an `article` with `id="ai-run-{runId}"`, separated by a `--color-border-default` hairline and 24px.

| Part | Contract |
|---|---|
| h3 (`--text-body` at 500) | `{name} asked the AI for more risks`, or `{name} asked the AI for more risks: “{instruction}”` (X-25 clamp) |
| Facts (`--text-caption`, `--color-text-secondary`) | `{instant} · Provider: {providerName} · Model: {providerVersion} · {k} of {n} open` |
| Left out (X-10) | `{a} left out` toggles the list below (`aria-expanded`, `aria-controls`) |
| Unmatched sources | X-24's caption |
| Actions | `Show what the AI used` (ghost, small, `FileSearch`; §10.3), and `Reject remaining ({k})` (outline, small, `ListX`; §5.4). Their names are `Show what the AI used for the request at {time}` and `Reject remaining ({k}) from the request at {time}`. A group of proposed risks has no add-all control (UI-D6) |
| Items | An `ol` of §3.2 cards |

**Left-out list** (`ul`, `--text-caption`, one line per adjustment, with a `{count} ×` prefix when aggregated):

| Adjustment | Line |
|---|---|
| Near-identical to an active Risk | `A risk too close to one already in this assessment.` |
| Near-identical to a withdrawn Risk | `A risk too close to one you withdrew.` |
| Near-identical to a rejected proposal | `A risk too close to one you rejected.` |
| Near-identical to an open proposal or another in the same request | `A risk already proposed.` |
| Invalid | `A proposal that was incomplete or too long.` |
| Over the limit | `{n} more {risk|risks} beyond the limit of 8 per request.` |
| Any other | `A proposal CSRM couldn’t use.` |

An Accept turned into Treat is not left out: it shows on the item (§3.4).

### 3.2 The item card

An `li` card (X-24): `--color-bg-surface`, a `--color-border-default` hairline, `--radius-lg`, 16px padding (12px compact), `id="ai-proposal-{runId}-{itemKey}"` and `tabIndex={-1}`.

| Part | Contract |
|---|---|
| Eyebrow (`.micro-label`, 12px icon) | `Proposed risk` (`Plus`) |
| Subject (`--text-body` at 500) | The proposed `Risk statement`, else the `Issue statement` |
| Facts (`--text-caption`, `--color-text-secondary`) | `{Risk Type name}` or `No Risk Type` · `{information system}` · `{information asset}`, omitting any that is absent |
| Ratings | `Inherent` and `Residual`, each a micro-label and a `RiskRatingBadge`, else `Not rated`; then `Treatment: {Accept|Treat}` in `--text-caption` |
| Similar (X-28) | §3.3, when the item carries a similarity |
| Treatment note | 12 §3.5's notes, when Accept was proposed or turned into Treat |
| Details | `Show proposed details` / `Hide proposed details` (outline, small, `aria-expanded`), revealing §3.4 |
| Actions | §5. `Add to assessment` (outline, small, `Plus`), `Reject` (ghost, small, `X`) and, when similar, `Reject as duplicate` (ghost, small, `Copy`) |

| Viewport | Contract |
|---|---|
| 1440 | The eyebrow and similarity note on one row; the ratings on one row; the actions in one row after the details toggle |
| 375 | Stacked. The actions are full width at the touch-target height, `Add to assessment` first |

### 3.3 Similar risks (X-28; D-32)

| Similarity | Note (X-11 note style, `Copy`) | Compare |
|---|---|---|
| An active Risk | `Similar to {risk number}` | `Compare with {risk number}`. The columns are `{risk number}` and `Proposed` |
| A withdrawn Risk | `Similar to a withdrawn risk, {risk number}` | `Compare with {risk number}`. The columns are `{risk number} (withdrawn)` and `Proposed` |
| A rejected proposal | `Similar to a rejected proposal` | `Compare with the rejected proposal`, when it is listed under `Decided proposals`; else no compare |
| An open proposal | `Similar to an open proposal` | `Compare with the open proposal`, with a link to its card |

`Compare with …` is an outline small toggle (`GitCompareArrows`, `aria-expanded`). It opens the X-24 comparison below the note. Its rows are `Risk type`, `Risk statement`, `Risk cause`, `Potential impact`, `Information system impacted`, `Information asset impacted` and `Residual rating`, and matching rows carry the note `Same` (`Equal`) in place of `Changed`. `Reject as duplicate` rejects at once with the reason `Duplicate of {risk number}` (or `Duplicate of a rejected proposal` or `Duplicate of an open proposal`).

### 3.4 Proposed details

A definition list in the editor's field order and labels (`risk-editor.tsx`), covering only the AI-writable fields, in four groups with h4 `.micro-label` headings: `Statement`, `Classification`, `Ratings` and `Treatment`.
- Statement fields carry their X-12 `Sources`, or the `No source cited` badge.
- `Claims to check` (12 §4.3, warning treatment) follows when the AI made uncited claims.
- `Suggested controls` lists the control labels (10 §16.1), or `None suggested`. They become Phase 12's suggestions once the risk is added.
- Absent values read `Not proposed`. Text keeps `whitespace-pre-wrap`.

### 3.5 Comfortable and compact

| Density | Difference |
|---|---|
| Comfortable (default) | §3.2 as written |
| Compact | 12px card padding. The facts line and the treatment note collapse into the details. Ratings show the badges only |

### 3.6 Decided proposals

This is a collapsed group after the open groups: `Show decided proposals ({n})` / `Hide decided proposals` (outline, small, `aria-expanded`, `aria-controls`; `ChevronDown` / `ChevronUp`, no transition). It shows up to the 50 most recent, newest first (the read's bound). Proposed risks are listed one per entry and rewrites one per request.

| Entry | Note (X-11 note style) `· {name} · {instant}` | `Undo` |
|---|---|---|
| Proposed risk, added | `Added as {risk number}` (`Plus`), with the number a record link to `#risk-{id}` | None; a wrong addition is withdrawn (D-33) |
| Proposed risk, rejected | `Rejected` (`X`), then `Reason: “{reason}”` when given | Shown while the assessment is editable |
| Closed by release or lock | `Closed without a decision: the assessment could no longer be changed.` (`Lock`) | None |
| A rewrite of `{risk number}` | Subject `AI rewrite of {risk number}`. Then `{c} confirmed · {r} rejected · {x} closed`, omitting zero parts, and `Show changes` / `Hide changes` (outline, small, `aria-expanded`), which lists each change with its note | Per change, while §5.1 allows it |
| A rewrite change, replaced | `Replaced by a newer rewrite` (`ListRestart`) | None |
| A rewrite change, closed by withdrawal | `Closed when {risk number} was withdrawn` (`Archive`) | None |

---

## 4. Rewrite this risk (X-28; D-34 to D-38)

### 4.1 The control and its form

`Rewrite this risk` (outline, small, `Sparkles`) is named `Rewrite this risk: {risk number}` and carries `data-print="hidden"`. It is offered on every active Risk of an editable assessment when the AI policy allows the request. It is never offered on a withdrawn Risk, after release, while that Risk's rewrite is queued or running, or to the analyst who raised the request (§12.3).

It opens a form (UI-D20): from 768px a `Popover` anchored to the control, at the confirm dialog width; below 768px a bottom `Sheet` with a title row and `Close`.

| Part | Contract |
|---|---|
| Title | `Rewrite {risk number}` |
| Instruction | X-25, kept per person and Risk. Hint: `Say what to change, for example “Make it specific to unsigned payment files”. The AI reads this risk, its mitigation controls, the other risks and the request. It never changes owners, dates or statuses.` Focus goes here when the form opens |
| What to rewrite | A `fieldset` with the legend `What to rewrite` and three checkboxes, all checked by default: `Statement and cause`, `Ratings`, `Treatment`. With none checked: `Choose at least one part to rewrite.` (§4 Forms error) |
| Open rewrite (D-37) | When this Risk has open AI changes, a caption: `This risk already has {k} open AI {change|changes}. A new rewrite replaces {it|them} when it’s ready.` |
| Actions | `Rewrite risk` (primary, small; `Ctrl`/`⌘` `Enter`; pending `Asking the AI…`) and `Keep as is` (ghost, small; `Escape`) |
| Refusal | §13 R2 under the field or as the form's error line; the form stays open with its values |

### 4.2 The `AI rewrite` section in the Risk card

The section is placed first in the card's content, above Phase 12's review bar and the Risk form. It is a `section` with h3 `AI rewrite` and `id="risk-{id}-rewrite"` (`tabIndex={-1}`). It renders only while a rewrite is queued, running, failed, completed with nothing, or has open changes, and never for the analyst who raised the request (§12.3), so they see no `Retry rewrite`, `Confirm`, `Confirm all`, `Reject` or `Undo`.

| State | Contract |
|---|---|
| Queued or running | `The AI is rewriting {risk number}` (`--text-body` at 500, polite) with `Rewriting…` and the inline 16px spinner; `You can leave this page. The proposed changes show here when you come back.`; `Started by {name}.` when another analyst started it; `Check again` after 30 seconds, as §2.3 |
| Completed with changes | The comparison (§4.3). The live region says `AI changes to {risk number} are ready to review.` |
| Completed with no change | `The AI proposed no changes to {risk number}.` until the next page view, with the `{a} left out` list when any were dropped (`A change outside what you asked to rewrite.`, `A change that left the value as it was.`, plus §3.1's generic lines) |
| Failed | A danger `Alert`, `The AI rewrite didn’t finish`, with §13 R4's copy and `Retry rewrite` (outline, small), named `Retry rewrite: {risk number}` |

The group header follows X-24:
- **h4:** `{name} asked the AI to rewrite {risk number}`, or `… : “{instruction}”`.
- **Facts:** `{instant} · Provider · Model · {k} of {n} open`. When not all three parts were asked for, `Focus: {parts}` is added, for example `Focus: Ratings, Treatment`.
- **Actions:** `Show what the AI used` (ghost, small), `Confirm all ({c})` (outline, small, `ListChecks`) and `Reject remaining ({k})` (outline, small, `ListX`).

### 4.3 The comparison (X-24 with X-28's field decisions)

From 768px, the comparison is a `table` with the visually hidden caption `AI changes proposed for {risk number}` and the columns `Field` (row headers), `Current`, `Proposed` and `Decision` (a visually hidden header). Each change is a `tbody` with one row per field. Its decision cell spans those rows and is top-aligned.

| Change | Fields (editor labels) | Label used in names and toasts |
|---|---|---|
| One field | `Risk type`, `Issue statement`, `Risk statement`, `Risk category`, `Risk sub-category`, `Risk cause`, `Potential impact`, `Information system impacted`, `Inherent rating rationale`, `Residual rating rationale`, `Treatment plan`, `Treatment action` | The field label |
| Asset and its classification | `Information asset impacted`, `Data classification` | `Information asset and data classification` |
| Inherent ratings | `Inherent likelihood`, `Highest inherent consequence`, `Inherent rating` | `Inherent rating` |
| Residual ratings | `Residual likelihood`, `Highest residual consequence`, `Residual rating` | `Residual rating` |
| A change to Accept | `Treatment action`, `Treatment plan` | `Treatment action and plan` |

- **Values** render as the editor shows them. Ratings are `RiskRatingBadge`s, relations show names, and an empty value reads `Not recorded`. Text keeps `whitespace-pre-wrap` and `[overflow-wrap:anywhere]`.
- **Changed words.** In long-text fields (statements, cause, impact, rationales, the plan), X-24's emphasis marks them: `del` in `Current` and `ins` in `Proposed`. When either value is over 2,000 characters, both show whole without marks (UI-D21).
- **Sources.** The X-12 `Sources` list sits under each proposed statement value, or `No source cited`.
- **Treatment.** 12 §3.5's notes sit under a proposed `Treatment action`.
- **Unchanged fields** are not listed. A rewrite proposes only changes (D-35).

Below 768px, each change is a stacked card (D-47):
- an eyebrow with the change's label;
- `Current` (micro-label) and its value;
- `Proposed` (micro-label) and its value, with its sources;
- the actions, full width at the touch-target height, `Confirm` first.

### 4.4 Per-change states

| State | Decision cell |
|---|---|
| Open | `Confirm` (outline, small, `Check`) named `Confirm: {label} on {risk number}`, and `Reject` (ghost, small, `X`) named `Reject: {label} on {risk number}` |
| Changed since proposed (D-37) | `Changed since proposed` (`aiReview` `stale`: warning, `History`). `Current` shows the Risk's value now. Line (`--text-caption`): `{label} has changed since the AI proposed this, so it can’t be confirmed. Reject it, or rewrite the risk again.` Action: `Reject` only |
| Accept not allowed now (D-38, G-14) | Line: `Accept can be confirmed only while the residual rating is Low or Moderate and the risk has no planned mitigation control. Reject it, or change the treatment yourself.` Action: `Reject` only. The domain module pre-checks this from the served values (UI-D19); Strapi stays authoritative |
| Confirmed | Note `Confirmed` (`Check`) `· {name} · {instant}`, and `Undo` (ghost, small, `Undo2`) while §5.1 allows it. The row stays in place |
| Rejected | Note `Rejected` (`X`) `· {name} · {instant}`, with `Reason: “{reason}”` when given, and `Undo` |

When every change is decided, the section closes. The rewrite moves to `Decided proposals` (§3.6), and focus goes to the Risk card's first field.

**While the Risk form holds unsaved changes** (UI-D17), the section shows `Save or discard your changes to this risk before you confirm AI changes.` (`--text-caption`) once under its header. `Confirm` and `Confirm all` are not offered on that Risk, and `Reject` stays.

### 4.5 Comfortable and compact

In compact density, the table's cells use the DataTable compact row rule, sources collapse behind `Show sources` per change, and the treatment notes stay.

### 4.6 The card header

Beside the Risk number, the rating and Phase 12's `AI proposed` badge, a Risk with open AI changes shows a figure link `{k} AI {change|changes} to review` (`--text-caption` at 500) to `#risk-{id}-rewrite`.

---

## 5. Decisions (X-14; D-39, D-40; 12 §6; 15 §5)

Every decision goes through one batch Server Action on Phase 12's decision operation. It never resets an open form. The Risk list and readiness update from the server's revalidated response.

### 5.1 Actions and toasts

| Action | Applies | Success toast | `Undo` sends | After `Undo` | Failure title |
|---|---|---|---|---|---|
| `Add to assessment` | Waits for the server: `Adding…` with the inline spinner, and the card's other actions disabled | `{risk number} added to the assessment. Review its AI-proposed fields.` with the action `Open {risk number}` (no Undo, D-33) | — | — | `Risk not added` |
| `Confirm` (one change) | At once, at the §5 pending opacity | `{label} confirmed on {risk number}.` | `restore` | `Confirmation undone. {label} is back to its earlier value.` | `Change not confirmed` |
| `Confirm all ({c})` | At once, for the `c` confirmable changes | `{c} AI {change|changes} confirmed on {risk number}.` | `restore` for each | `Confirmations undone.` | `Changes not confirmed` |
| `Reject proposal` (§5.3) | At once | `Proposal rejected.` or `{label} change rejected.` | `restore` | `Rejection undone. The proposal is open again.` | `Proposal not rejected` |
| `Reject as duplicate` | At once | `Proposal rejected as a duplicate of {risk number}.` | `restore` | as `Reject` | `Proposal not rejected` |
| `Reject {k} {proposal|proposals|change|changes}` (§5.4) | At once | `{k} {proposals|changes} rejected.` | `restore` for each | `Rejections undone.` | `Proposals not rejected` |
| `Undo` (in a toast or the decided list) | At once | as "After `Undo`" | — | — | `Couldn’t undo` |

- **Rollback.** On failure, the cards or rows return with the opacity transition at `--duration-base`. A danger toast then shows §13 R3's copy with `Try again` (retryable) or `Refresh page` (blocked). `AI_PROPOSAL_STALE` and `AI_PROPOSAL_ALREADY_DECIDED` refresh the section and the Risk, so each shows its real state.
- **Readiness** follows the server. A content change on an in-review assessment returns it to draft, as any accepted edit does (D-12, D-23). A rejection changes no content and withdraws no review.

### 5.2 Confirming changes the form in place

A confirmed change updates the Risk form's values from the server's response without remounting it (12 §6). The confirmed fields show Phase 12's `Confirmed` note.

### 5.3 Reject, with an optional reason

`Reject` opens an inline row (an X-5 well) in the card or under the change, with focus in its field (15 §5.3):

| Part | Contract |
|---|---|
| Field | `Input`, labelled `Reason (optional)`, with the hint `The AI reads this next time, so it doesn’t propose the same again.` Over 500 characters: `Keep the reason to 500 characters or fewer.` |
| Actions | `Reject proposal` (outline, small; `Enter` in the field submits) and `Keep proposal` (ghost, small; `Escape` too) |

### 5.4 Reject remaining

`Reject remaining ({k})` opens the same row under its group's header: the field, then `Reject {k} {proposal|proposals}` (or `{change|changes}` in a rewrite) and `Keep {proposals|changes}`. One reason applies to each. Changes since proposed are included, and decided ones are not.

### 5.5 Focus

| Event | Focus |
|---|---|
| A proposed risk is added, rejected or rejected as a duplicate | The next open item's `Add to assessment` in section order, else the status line |
| A change is confirmed or rejected | The next open change's `Confirm` (or `Reject`) in the same Risk, else the Risk card's first field |
| `Confirm all` or `Reject remaining` | The section's status line, or the Risk's first field |
| `Keep proposal`, `Keep proposals`, `Keep changes` | The control that opened the row |
| `Open {risk number}` (toast action) | The new Risk card (`#risk-{id}`) |
| `Undo` succeeds | The reopened item's first action |
| Rollback | Stays put; the toast announces itself |

---

## 6. Withdraw and reinstate (X-27; D-05 to D-12)

### 6.1 Withdraw a Risk

**Control.** `Withdraw risk` (ghost, small, `Archive`), named `Withdraw risk {risk number}`, carries `data-print="hidden"`. It is offered on every active Risk of an editable assessment.

Card actions sit in the card header in this order: `Rewrite this risk`, `History`, `Withdraw risk`. Below 768px they collapse into one circular icon button (`EllipsisVertical`) named `Actions for {risk number}`. It opens a `DropdownMenu` with the same three items, at the touch-target height (UI-D4). For the analyst who raised the request, the actions are `History` and `Withdraw risk` only, in the header and in the menu (§12.3).

**Form.** The form is an X-5 well directly under the card header. Below 768px it is a bottom `Sheet` with a title row and `Close`.

| Part | Contract |
|---|---|
| Title (`--text-heading-sm`) | `Withdraw {risk number}` |
| Description (`--text-body`, `--color-text-secondary`) | `A withdrawn risk leaves this assessment, its counts and release readiness. It keeps its details and history, and you can reinstate it while the assessment is being edited.` When the Risk has open AI changes, this is added: ` Its {k} open AI {change|changes} will close without a decision.` For the analyst who raised the request, whose view serves no count, it reads ` Any open AI changes on it will close without a decision.` |
| Field | `Input`, labelled `Reason for withdrawing` and required, with the hint `Kept in the risk’s history. The AI reads it, so it doesn’t propose this risk again.` The count `{n} of 500 characters` shows once the field holds text. Focus goes here when the form opens |
| Validation, on submit | Empty: `Give a reason for withdrawing this risk.` Over 500: `Keep the reason to 500 characters or fewer. It has {n}.` (§4 Forms error) |
| Actions | `Withdraw risk` (outline, small; `Enter` in the field submits) and `Keep risk` (ghost, small; `Escape` too) |
| Unsaved Risk changes (UI-D8) | In place of the field and `Withdraw risk`: `This risk has unsaved changes. Save or discard them before you withdraw it.` with `Keep risk` |
| No lost input | The reason is kept in the session draft store per person and Risk, restored with `Restored from earlier in this session.` and guarded by `beforeunload` |

**Applying.** The form closes and the card leaves the `Active` list at once, at the §5 pending opacity. The `Show` counts update. The toast reads `{risk number} withdrawn.` with `Undo`. Focus moves to the next active card (`#risk-{id}`), else the previous one, else the `Show` control.

**Undo** reinstates the Risk with the server's fixed reason (`undo: true`, research Pitfall 5). The card returns and gets focus, and the toast reads `Withdrawal undone. {risk number} is back in the assessment.` Open AI changes that the withdrawal closed stay closed.

**Failure.** The card returns with the rollback transition, and the form reopens with its reason, focus in the field and §13 R1's copy as its error line. A danger toast also shows when the form cannot reopen (the card moved).

### 6.2 Reinstate a Risk

`Reinstate risk` (outline, small, `ArchiveRestore`) on a withdrawn card, named `Reinstate risk {risk number}`, opens the same form:

| Part | Contract |
|---|---|
| Title | `Reinstate {risk number}` |
| Description | `The risk returns to this assessment, its counts and release readiness, and can be edited again.` |
| Field | `Reason for reinstating`, required, with the hint `Kept in the risk’s history.` Its errors read `Give a reason for reinstating this risk.` and the 500-character copy |
| Actions | `Reinstate risk` (outline, small; `Enter`) and `Keep withdrawn` (ghost, small; `Escape`) |

**Applying.** The card leaves the `Withdrawn` list at once. The toast reads `{risk number} reinstated.` with `Undo`. Focus moves to the next withdrawn card, else the `Show` control. **Undo** withdraws the Risk again with the reason it held before the reinstatement (UI-D7), and the toast reads `Reinstatement undone. {risk number} is withdrawn again.`

### 6.3 The `Show` filter

This is a segmented control (§4 Forms) labelled `Show`, at the top of `Identified Risks`, with the options `Active ({n})` and `Withdrawn ({w})`, using `tabular-nums`. The choice is kept in the page address (`?risks=withdrawn`), so a link can open either. `Active` is the default, and the `Add Risk` control shows only under `Active`. Choosing an option moves no focus. Each count equals its list (X-10).

| Case | Copy (§4 Empty states) |
|---|---|
| Active, none, with withdrawn Risks | `No active risks` · `Every risk in this assessment has been withdrawn. Add a risk, ask the AI for more risks, or reinstate one under Withdrawn.` with `Add Risk` as the action |
| Active, none at all | The existing `No Risks have been identified.` (unchanged) |
| Withdrawn, none, editable | `No withdrawn risks` (cleared type) · `Risks you withdraw are kept here with their reasons, and can be reinstated while the assessment is being edited.` |
| Withdrawn, none, released | `No withdrawn risks` · `No risk was withdrawn from this assessment.` |

### 6.4 The withdrawn card (X-27)

| Part | Contract |
|---|---|
| Frame | A card on `--color-bg-surface` with a `--color-border-default` hairline, `--radius-lg` and 16px padding, `id="risk-{id}"` and `tabIndex={-1}`. It is collapsed and read-only |
| Header | The Risk number, the `Withdrawn` badge (`risk` family: neutral tone, `Archive`), and the residual `RiskRatingBadge` when rated |
| Statement | The `Risk statement`, clamped to two lines, with the full text in the DOM |
| Withdrawal | `Reason: “{reason}”` (`--text-body`), then `Withdrawn by {name} · {instant}` (`--text-caption`, `--color-text-secondary`) |
| Actions | `Reinstate risk` (editable assessments only), `History` (ghost, small, `History`), and `Show details` / `Hide details` (outline, small, `aria-expanded`), which reveals the shared read-only Risk (10 §15.2) and its mitigation controls in place |
| Print | Withdrawn cards print only while `Withdrawn` is chosen |

### 6.5 What a withdrawn Risk refuses

The UI offers no edit, control, AI or decision control on a withdrawn Risk. A refused change from a stale page shows §13 R1's `RISK_WITHDRAWN` copy, and the page refreshes the Risk.

---

## 7. Discard a new Risk (D-17)

The `Add Risk` form gains `Discard new risk` (ghost, after `Add risk`).

| Case | Contract |
|---|---|
| The form holds input | The form closes at once. The toast reads `New risk discarded.` with `Undo`, which reopens the form with what was typed and focus in its first field. Focus otherwise returns to `Add Risk` |
| The form is untouched | The form closes with no toast |
| Leaving with input | Phase 10's navigation guard, unchanged |

Nothing is sent, so nothing is recorded. The typed values live in client state until the toast closes.

---

## 8. Risk history (X-29; D-18 to D-21)

### 8.1 Where it opens

`History` (ghost, small, `History`) is named `History of {risk number}`. It appears:
- on every Risk card and withdrawn card, released assessments included;
- as `Show history` (outline, small) in the Risk Register detail's header actions (§11.3).

It opens the X-13 side sheet, code-split, reading `GET /api/v1/risks/{riskId}/history` from a Server Action when it opens.

### 8.2 Frame

| Part | Contract |
|---|---|
| Title (h2) | `History of {risk number}` |
| Description | `Every change to this risk and its mitigation controls, newest first.` |
| Count (`--text-caption`, `tabular-nums`) | `{shown} of {total} {change|changes}` |
| Density | `Density`, `Comfortable` / `Compact`, from 768px, persisted per person (X-29) |

### 8.3 Entries

Each entry follows X-29, built from the questionnaire timeline's presentation (10 §4.2): an icon, a label, `{instant} by {name}`, then lines.

| Kind | Label | Icon | Lines |
|---|---|---|---|
| `created`, by an analyst | `Risk added` | `Plus` | none |
| `created`, by draft generation | `Risk added by the AI draft` | `Sparkles` | `Source: AI draft requested by {name}` |
| `created`, from a proposed risk | `Risk added from an AI proposal` | `Sparkles` | `Source: proposed risk, added by {name}`; `Show in AI proposals` (record link) while it is listed |
| `updated`, by an analyst | `Risk changed` | `FilePenLine` | The comparison |
| `updated`, from a confirmed AI change | `Risk changed by a confirmed AI rewrite` | `Sparkles` | `Source: AI rewrite, confirmed`; the comparison |
| `updated`, by an Undo | `AI change undone` | `Undo2` | The comparison |
| `withdrawn` | `Risk withdrawn` | `Archive` | `Reason: “{reason}”` |
| `withdrawn`, by an Undo | `Reinstatement undone` | `Undo2` | `Reason: “{reason}”` |
| `reinstated` | `Risk reinstated` | `ArchiveRestore` | `Reason: “{reason}”` |
| `reinstated`, by an Undo | `Withdrawal undone` | `Undo2` | none |
| `control-implementation-added` | `Mitigation control added` | `Plus` | `Control: {control label}`; the comparison of the values set, with `Before` reading `Not recorded` |
| `control-implementation-updated` | `Mitigation control changed` | `FilePenLine` | `Control: {control label}`; the comparison |
| `control-implementation-removed` | `Mitigation control taken off this risk` | `CircleMinus` | `Control: {control label}`; `Values when taken off`, as a definition list |
| An unknown kind (from a later phase) | `Change recorded` | `History` | Its comparison when parseable |
| A malformed entry (`changes: null`) | its label | its icon | `The details of this change couldn’t be read.` |

The comparison is X-24's, read-only, with the columns `Field`, `Before` and `After`, the editor's labels and values, and changed words marked as in §4.3. In compact density it collapses behind `Show {n} changed {field|fields}`.

Phase 12's per-field confirmations and dismissals are not listed. They change no value and stay with the AI proposals (UI-D23). A control is named by its §16.1 label as recorded at the time.

### 8.4 Paging and the honest start

- 25 entries load at a time. `Show older changes` (outline, small) loads the next 25, keeps the scroll position and moves focus to the first new entry.
- When the list holds no `Risk added` entry and the last page is shown, it ends with `History recorded from {date}. Earlier changes to this risk weren’t recorded.` (`--text-caption`), where the date comes from the served `recordedFrom`.

### 8.5 States

| State | Contract |
|---|---|
| Loading | Nothing for 300ms, then a skeleton of the title, the description and three entry blocks, each with an icon, two lines and a three-row comparison |
| Empty | `No changes recorded yet` · `Changes to this risk are listed here from now on.` |
| Error | `We couldn’t load the history` · `Please try again. If the problem continues, contact your administrator.` · `Try again` |
| Permission (403) | `You don’t have access to this history` · `Ask a Security Analyst working on this assessment if you need to see how this risk changed.` The copy names no role that may read it, so it stays true when Phases 17 and 17.2 decide participant access (D-21) |
| Not found (404) | `This risk’s history isn’t available.` |

Focus goes to the title when the sheet opens and returns to the trigger when it closes. `Escape` closes it. Below 768px, it is X-13's full-screen sheet with `Close`, named `Close history`.

---

## 9. Release readiness and the overall rating (D-12, D-15, D-42)

### 9.1 Readiness (10 §14 anatomy)

| Item | Contract |
|---|---|
| New assessment-scope requirement | The served label `Decisions on AI proposals`, destination `#ai-proposals`. Outstanding: the label link, `Outstanding`, then the caption `{n} open` (`tabular-nums`). Met: in the met list as `Met` |
| Withdrawn Risks | They contribute no Risk row and no outstanding label (server-side). The count line counts active Risks only |
| The last active Risk withdrawn | `At least one Risk` (the existing requirement) shows as outstanding |

Phase 12's `Review of AI proposals` is unchanged, and a Risk added from a proposed risk carries it until its fields are confirmed.

For the analyst who raised the request, the outstanding item has no link and no count. Its caption reads `This assessment has open AI proposals. Another Security Analyst decides them before release.` (15 §8.1's wording for the same case).

### 9.2 The overall-rating hint (D-15)

The hint shows under `Overall rating` in `Assessment details` while the assessment is editable and the highest residual rating of the active Risks differs from the form's overall rating, or the overall rating is not set while one exists:

| Part | Contract |
|---|---|
| Line (`--text-caption`, `--color-text-secondary`, `Info` 14px `aria-hidden`), named by the select's `aria-describedby` | `The highest residual rating among the active risks is {rating}.` When the overall rating is set, ` The overall rating is {rating}.` follows |
| Action | `Use {rating}` (outline, small). It sets the field's value without saving, so X-1's unsaved state and `Save assessment` apply as for any edit, and focus goes to the field |
| Not shown | When they match, when no active Risk has a residual rating, or after release |

It never blocks release and never writes on its own.

---

## 10. Provenance and the AI inputs signal (D-25, D-28)

### 10.1 The provenance header (12 §1)

| Addition | Contract |
|---|---|
| Open-proposal line (`--text-body`), unreleased, when above zero | `{n} open AI {proposal|proposals}`, a figure link to `#ai-proposals` (on phones, to the summary card). Not shown to the analyst who raised the request (§12.3) |

### 10.2 "AI inputs changed" (13 §10.2; X-18)

The server serves the signal against the latest completed AI request on this assessment, including Phase 16 requests (D-28; Phase 15 research's separate resolver).

| Part | Contract |
|---|---|
| Heading | Before any Phase 16 request: 13 §10.2's `AI inputs changed since this draft was generated`. Afterwards: `AI inputs changed since the AI was last asked about this assessment` (UI-D26) |
| List and caption | 13 §10.2 and 14's files, unchanged |
| Action | `Suggest more risks` (outline, small, `Sparkles`) when a start is allowed. It starts the default request (no instruction) and moves focus to the job status line (§2.3). Then a caption: `To bring this into one risk, use Rewrite this risk on that risk.` For the analyst who raised the request, no action and, in place of both, the caption `You raised this request, so another Security Analyst asks the AI about these changes.` (§12.3) |

### 10.3 "What the AI used" (12 §2)

This opens per group from `Show what the AI used`. Description: `What CSRM sent to the AI for these proposals. Requestor text was marked as information to analyse, never as instructions, and isn’t stored with this record.` After `Run`:

| Group | Rows |
|---|---|
| `Instruction` (15 §9.3) | `Given by`: `{name}`, or `None: the AI looked for the risks it judged missing` (suggestions) or `None: the AI rewrote the parts asked for` (rewrite). `Instruction`: the text (X-25), when given. Rewrite only: `What to rewrite`: the checked parts |
| `Assessment` | `Scope`: `Whole assessment` or `One risk: {risk number}` · `Risks listed`: `{a}` · `Withdrawn risks listed`: `{w}` · `Earlier proposals listed`: `{r} rejected · {o} open` · Rewrite only: `Mitigation controls listed`: `{c}` |

`Request`, `Notes`, `Files`, `Data policy` and the digest apply unchanged (12 §2.2, 13 §10.3, 14 §7.1).

---

## 11. Risk Register (D-08, D-45; 11 §9.5)

### 11.1 Filter

In `More filters` (and the phone `Filters` sheet), the `Risk state` select:
- reads `Open and closed` for its default (was `All`);
- adds `Withdrawn` after `Open` and `Closed` (UI-D9).

The chip reads `Risk state: Withdrawn`. Choosing it shows withdrawn Risks only. No default view, figure link or export includes them.

### 11.2 Withdrawn rows

| Where | Contract |
|---|---|
| Notice above the table, only under `Withdrawn` (`--text-body`, `--color-text-secondary`, `Archive` 16px) | `Withdrawn risks don’t count in any assessment, figure or export. Only Security Analysts see them.` |
| Row | The Risk number cell gains the `Withdrawn` badge on a second line. `Related assessment` reads `Under assessment` as today |
| Mobile card | The badge follows the number |
| Filtered empty | `No Risks match these filters` · `Clear filters` (the shared state) |

### 11.3 Risk detail (`risk-details.tsx`)

| Part | Contract |
|---|---|
| Header status | The `Withdrawn` badge after the ratings, for a withdrawn Risk |
| Header action, every Risk | `Show history` (outline, small, `History`), opening §8 |
| Notice, withdrawn Risk | An `Alert` with `Archive`, titled `Withdrawn risk - read only`. Description: `{name} withdrew this risk on {instant}: “{reason}”. It doesn’t count in {assessment number} or its release readiness. Reinstate it from the assessment to change it.` Then a record link `Open {assessment number}` → `/app/review/assessments/{id}?risks=withdrawn#risk-{riskId}` |
| Editing | No `Edit risk` and no mitigation-control controls, as for a released Risk |

---

## 12. The released view and the Requestor (D-08, D-29)

### 12.1 The analyst after release

- The `Show` filter stays, and so do withdrawn cards (without `Reinstate risk`) and `History` on every card.
- There is no `Withdraw risk`, `Rewrite this risk`, `Suggest more risks`, `AI rewrite`, decision or `Discard new risk` control anywhere.
- The `AI proposals` section shows §2.4's released line and `Decided proposals`.

### 12.2 The Requestor and later participants

No surface changes. Withdrawn Risks are absent from every Requestor read, count and figure (server-side). No withdrawal, history, proposal or AI item appears in the Requestor's tree, and no copy hints that a Risk was withdrawn.

### 12.3 The Security Analyst who raised the request (G-1; Phase 15 D-32; the settled confirmation)

On an assessment of a request they raised, a Security Analyst takes no targeted AI action. The server serves this as Phase 15 §12 reads it, and Strapi refuses every such operation with `OWN_REQUEST` (403; Phase 13 D-07's reason), so the UI state is a courtesy, not the control. Following X-15, one line in Phase 15 §12's voice replaces the controls; nothing is shown disabled.

| Surface | Contract |
|---|---|
| `AI proposals` section | The h2, then §2.4's requesting-analyst line with `Lock`. No status line, density control, start form, job state or retry, proposed-risk groups, `Open AI rewrites`, `Decided proposals` or `Show what the AI used` |
| Phones | §2.6: the summary card holds the h2 and the line only |
| Risk cards | No `Rewrite this risk`, no `AI rewrite` section (so no `Retry rewrite`, `Confirm`, `Confirm all`, `Reject`, `Reject remaining` or `Undo`) and no `{k} AI changes to review` link. Phase 12's `AI proposed` badge stays as it is |
| Header and signal | No open-proposal line (§10.1). The signal shows its list with §10.2's requesting-analyst caption and no `Suggest more risks` |
| Readiness | §9.1's requesting-analyst caption |
| History | Entries render; `Show in AI proposals` is not shown |
| Still offered | Editing, `Withdraw risk`, `Reinstate risk` and their Undo, `History`, `Discard new risk` and the overall-rating hint. The confirmation bars only re-runs and decisions, and D-44 keeps the rest open. Withdrawing a Risk with open AI changes closes them without a decision (§6.1), which is not a decision on them |
| Refusal from a stale page | R2 or R3's `OWN_REQUEST` copy as a toast or the form's error line, then the section refreshes to this state |

---

## 13. Refusal copy (new family R)

### R1. Withdraw, reinstate, history, and edits on a withdrawn Risk

| Reason | Copy | Kind |
|---|---|---|
| `ASSESSMENT_NOT_MUTABLE` | `This assessment can no longer be changed, so the risk wasn’t {withdrawn|reinstated}. Refresh the page to see its current state.` | blocked |
| `RISK_WITHDRAWN` (an edit, a control change, a Phase 12 decision or a rewrite) | `This risk has been withdrawn, so it can’t be changed. Reinstate it to change it.` | blocked |
| `RISK_NOT_WITHDRAWN` | `This risk is already in the assessment. Refresh the page to see it.` | blocked |
| 400, the reason | the §6.1 and §6.2 field errors | field |
| 403 | `You can’t withdraw or reinstate risks on this assessment.` (history: §8.5) | blocked |
| 404 | `This risk is no longer on this assessment. Refresh the page.` | blocked |
| 409, none or unknown | `This change can’t be made in the assessment’s current state.` | blocked |
| Network, timeout or 5xx | `We couldn’t {withdraw|reinstate} the risk. Try again.` | retryable |
| Request deletion refused once an assessment exists (the plan's closed reason) | `This request has a risk assessment, so it can’t be deleted. The assessment and its risks are kept.` | blocked |

### R2. Ask the AI (suggest, rewrite)

| Reason | Copy | Kind |
|---|---|---|
| Instruction reasons (Phase 15) | 15 §13 Q1's copy, word for word | field |
| `ASSESSMENT_NOT_MUTABLE` | `This assessment can no longer be changed, so the AI can’t be asked about it.` | blocked |
| `RISK_WITHDRAWN` | `This risk has been withdrawn, so the AI can’t rewrite it. Reinstate it first.` | blocked |
| `AI_CLASSIFICATION_ABOVE_CEILING`, `AI_POLICY_NOT_CONFIGURED` | 12 §11.1's descriptions | blocked |
| `CONTEXT_TOO_LARGE` | `This assessment holds more risks and earlier proposals than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.` | blocked |
| `AI_PROPOSAL_RUN_LIMIT` (if Phase 15's limit applies) | `This assessment has reached the most AI requests it can keep, so the AI can’t be asked again. Contact your administrator.` | blocked |
| 400, focus | `Choose at least one part to rewrite.` | field |
| `OWN_REQUEST` (403; a start, a rewrite or a retry by the analyst who raised the request) | 15 §13 Q1's copy, word for word: `A Security Analyst can’t steer the AI on a request they raised. Another Security Analyst handles it.` | blocked |
| 403 | `You can’t ask the AI about this assessment.` | blocked |
| 404 | Phase 10's locked assessment refusal | blocked |
| 409, none or unknown | `The AI can’t be asked in this assessment’s current state.` | blocked |
| Network, timeout or 5xx | `We couldn’t ask the AI. Try again.` | retryable |

### R3. Decide (add, confirm, reject, undo)

| Reason | Copy | Kind |
|---|---|---|
| `ASSESSMENT_NOT_MUTABLE` | Family J's copy | blocked |
| `RISK_WITHDRAWN` | `{risk number} has been withdrawn, so its AI changes can’t be confirmed. Reinstate it first.` | blocked |
| `AI_PROPOSAL_STALE` | `{label} has changed since the AI proposed this, so it can’t be confirmed. Reject it, or rewrite the risk again.` | blocked |
| `AI_PROPOSAL_ALREADY_DECIDED` (the one "no longer open" code; it also covers closed proposals) | 15 §13 Q2's `This proposal is no longer open. Refresh the page to see where it stands.` | blocked |
| `AI_ACCEPT_NOT_PERMITTED` | `Accept can be confirmed only while the residual rating is Low or Moderate and the risk has no planned mitigation control, so it wasn’t applied. Reject it, or change the treatment yourself.` | blocked |
| Undo refused (Phase 15's `AI_PROPOSAL_UNDO_UNAVAILABLE`, or `AI_PROPOSAL_STALE` on a restore), confirmation | `{label} has changed since the change was confirmed, so it can’t be undone here. Change it in the risk form instead.` | blocked |
| Undo refused, rejection | `This proposal can no longer be reopened, because the assessment has moved on.` | blocked |
| 400, unknown proposal | `This proposal is no longer on the assessment. Refresh the page to see the current proposals.` | blocked |
| `OWN_REQUEST` (403; any decision or Undo by the analyst who raised the request) | Q1's copy, as 15 §13 Q2 maps it | blocked |
| 403 | `You can’t decide AI proposals on this assessment.` | blocked |
| 404 | `These proposals couldn’t be found. Refresh the page.` | blocked |
| 409, none or unknown | `Your decision can’t be recorded in this assessment’s current state.` | blocked |
| Network, timeout or 5xx | `We couldn’t record your decision. Try again.` | retryable |

### R4. Job failure codes (section, Risk card, signal)

| `failureCode` | Copy |
|---|---|
| `PROVIDER_OUTPUT_INVALID` | `The AI’s reply couldn’t be read, so nothing was proposed. Try again.` |
| Interrupted by a restart | `The AI request stopped when CSRM restarted, so nothing was proposed. Try again.` |
| `ASSESSMENT_NOT_MUTABLE` | `The assessment stopped being editable before the AI started, so nothing was sent.` |
| `RISK_WITHDRAWN` | `{risk number} was withdrawn before the AI started, so nothing was sent.` |
| `CONTEXT_TOO_LARGE`, `AI_PROPOSAL_RUN_LIMIT` | R2's copy |
| `AI_CLASSIFICATION_ABOVE_CEILING`, `AI_POLICY_NOT_CONFIGURED` | 12 §11.2 |
| Any other | The server's `failureMessage` |

---

## 14. Five-state contract

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| `AI proposals` section | The frame with the page; a skeleton after 300ms | §2.7 first-use and cleared | `We couldn’t load the AI proposals` · `Try again` | Analyst route gate; no section for the Requestor; the requesting analyst's line (§12.3) | Five assessment states (§2.4), density, phone summary and sheet |
| Start form and jobs | `Asking the AI…`; job states | — | R2 under the field; R4 alert with `Retry AI proposals` | Not rendered when a start isn’t allowed or for the requesting analyst; R2 `OWN_REQUEST` | Queued, running, timed out, completed, nothing kept, closed, failed |
| Proposed risks | With the section | — | Rollback and R3 toast | Actions per state | Open, similar, compare, details, compact, decided |
| `AI rewrite` | `Rewriting…` | No change (§4.2) | `The AI rewrite didn’t finish` · `Retry rewrite` | Not on withdrawn or released Risks, or for the requesting analyst; R3 `OWN_REQUEST` | Open, confirmed, rejected, changed since proposed, Accept not allowed, unsaved-form line |
| Withdraw and reinstate | Pending opacity | §6.3 filter empties | Rollback, the form reopened, R1 | No control after release | Active, withdrawn, details shown, unsaved-changes line |
| History sheet | Skeleton after 300ms | `No changes recorded yet` | `We couldn’t load the history` · `Try again` | `You don’t have access to this history` (role-independent, §8.5) | Every §8.3 kind, paging, the honest start, compact |
| Readiness and hint | With the page | Met / not shown | Server-authoritative | — | `Decisions on AI proposals`; hint and `Use {rating}` |
| Register | Phase 11 unchanged | Filtered empty | Unchanged | Unchanged | `Withdrawn` option, notice, row badge, read-only detail |

---

## 15. The premium experience bar (G-4), item by item

| G-4 item | Phase 16 contract |
|---|---|
| A keyboard path for every primary action | Every action is a button or link in DOM order, with no hover-only control. `Enter` submits a withdraw, reinstate or reject reason, and `Escape` keeps the record. `Ctrl`/`⌘` `Enter` asks the AI. The `Show` filter and density controls are radio groups with arrow keys. Focus moves to the next decision (§5.5). `Undo` is reached by `Alt+T` (X-14) |
| Optimistic feedback that rolls back on error | Withdraw, reinstate, `Confirm`, `Confirm all`, the rejects and `Undo` apply at once and roll back (§5.1, §6.1). `Add to assessment` waits, because it creates a record (§5 Optimistic UI) |
| Skeletons while loading | The section's on-demand parts and the history sheet. Spinners show only inline (`Asking the AI…`, `Rewriting…`, `Adding…`) |
| Undo for reversible acts; confirmation for governance steps | Withdraw, reinstate, every decision and `Discard new risk` carry `Undo` and no dialog. `Add to assessment` offers `Open {risk number}`, and a wrong addition is withdrawn. Release keeps its confirmation (unchanged) |
| Empty states that say what to do next | `No AI proposals yet` with an example instruction; `No active risks` with `Add Risk`; `No withdrawn risks` explains reinstating; the gate and state lines name the next step |
| No lost input | Instruction, reasons and rewrite instruction are kept for the session and guarded. Refusals never clear a field. A failed withdrawal reopens its form with the reason. A discarded new Risk comes back with `Undo`. Decisions never reset an unsaved Risk form, and confirming waits for it (§4.4) |
| Comfortable and compact density | The proposals and rewrites density (§2.1) and the history density (§8.2), both persisted per person |
| Motion from the direction | The Motion section; reduced motion honoured |
| Purpose-built phone layouts | The proposals summary card and full-screen sheet (§2.6); stacked change cards, current above proposed (§4.3); bottom-sheet withdraw, reinstate and rewrite forms; the actions menu (UI-D4); the full-screen history sheet |
| Every figure opens its records | The `Show` counts select their lists; `{n} open AI proposals` in the header; the readiness item's `{n} open`; the status line's list (§2.5); `{k} AI changes to review` on cards; `{a} left out`; `Added as {risk number}`; history `Show in AI proposals`; the register's withdrawn detail `Open {assessment number}` |

---

## 16. Test assertions this contract changes

Each plan greps its strings before editing and changes assertions deliberately, in the same plan as the behaviour. Phases 10 to 15 edit several of these files first.

| # | File | Asserts today (or after Phases 10 to 15) | Change |
|---|---|---|---|
| E1 | New `e2e/risk-curation.spec.ts` | — | D-50's journey at 375 and 1440 with axe, using this contract's strings: `Withdraw risk` with a reason and `Undo`; `Withdrawn (1)` showing the reason and `History of {risk number}` with `Risk withdrawn`; `Reinstate risk`; `Suggest more risks` proposing the payment-file risk, with no duplicate and `{a} left out`; `Add to assessment` then `Open {risk number}` and Phase 12's `Confirm remaining`; `Rewrite this risk`, then `Confirm` on one change and `Reject` on another; `Decisions on AI proposals` outstanding then met; release; no curation control afterwards; the Requestor's view without the withdrawn Risk; an unrelated Requestor refused. Negative case: a Security Analyst who raised a request sees §2.4's requesting-analyst line, no `Suggest more risks`, `Rewrite this risk`, `Retry …`, `Confirm` or `Reject`, and still sees `Withdraw risk`; Strapi refuses their start, rewrite, retry and decision with `OWN_REQUEST` (proven in the Strapi integration tests) |
| E2 | `e2e/assessment-release-workflow.spec.ts:60` | `Identified Risks` `form` by index | Stays green: no new `form` at rest inside the region (§1); the section sits outside it |
| E3 | `e2e/design-system-conformance.spec.ts:421` | `Risk state: Open` chip | Stays green |
| E4 | `e2e/risk-register-workflow.spec.ts` | Filter option labels | Only if it asserts `All` in `Risk state`: it becomes `Open and closed` |
| U1 | `features/assessments/assessment-editor.test.tsx` | `Add Risk` (`:309`), cards, readiness | The `Show` filter, card actions and menu, withdrawn cards, `Discard new risk`, the hint, the new readiness item; `Add Risk` keeps its name |
| U2 | `features/risks/risk-details.test.tsx` | Released alert | Withdrawn alert, `Show history`, no edit on withdrawn |
| U3 | Risk register filter tests | `All`, `Open`, `Closed` | `Open and closed`, `Withdrawn`, the chip and the notice |
| U4 | `components/csrm/status-badge.test.tsx` | Families to `csvImport` | The `risk` family |
| U5 | Refusal copy tests (`refusal-copy.ts`) | Families A to Q | Family R |
| U6 | Phase 12 run sheet tests | Groups through `Questionnaire` | `Assessment` group; the `Instruction` group's risk variants |
| U7 | Phase 13 signal tests | Heading, no action | §10.2's heading variant and action |
| U8 | `features/ai-assistance/field-comparison*.test.ts(x)` | Phase 15's two-column comparison | Decision column and spanning cells, custom column labels (`Before`/`After`, `{risk number}`/`Proposed`), `Same` rows, emphasis bound |
| New | `features/risk-curation/*.test.ts(x)` | — | Verification contract |

`accessibility.spec.ts`, `performance.spec.ts` and `design-contract.spec.ts` stay green. Phase 10's copy guard gains `features/risk-curation`, and a unit test asserts that no control in it is named `Accept`, `Accept all`, `Approve`, `Delete` or `Remove`.

---

## Copywriting contract

| Element | Copy |
|---|---|
| Primary CTA | `Suggest more risks`; `Rewrite risk` (in the rewrite form); `Add Risk` (unchanged) |
| Other calls to action | `Add to assessment`, `Confirm`, `Confirm all ({c})`, `Reject`, `Reject proposal`, `Keep proposal`, `Reject remaining ({k})`, `Reject {k} {proposals|changes}`, `Keep {proposals|changes}`, `Reject as duplicate`, `Compare with {risk number}`, `Show proposed details`, `Undo`, `Open {risk number}`, `Rewrite this risk`, `Keep as is`, `Retry AI proposals`, `Retry rewrite`, `Check again`, `Show what the AI used`, `Show decided proposals ({n})`, `Show changes`, `Review AI proposals`, `Withdraw risk`, `Keep risk`, `Reinstate risk`, `Keep withdrawn`, `Show details`, `History`, `Show history`, `Show older changes`, `Discard new risk`, `Use {rating}`, `Open {assessment number}` |
| Headings and labels | `AI proposals`; `Open AI rewrites`; `AI rewrite`; `History of {risk number}`; `Withdraw {risk number}`; `Reinstate {risk number}`; `Rewrite {risk number}`; `Show`, `Active ({n})`, `Withdrawn ({w})`; `Reason for withdrawing`; `Reason for reinstating`; `Reason (optional)`; `What to rewrite`; `Current`, `Proposed`, `Before`, `After`; eyebrow `Proposed risk`; badges `Withdrawn`, `Changed since proposed`; notes `Similar to …`, `Same`, `Confirmed`, `Rejected`, `Added as {risk number}`, `Replaced by a newer rewrite`, `Closed when {risk number} was withdrawn`; readiness `Decisions on AI proposals` |
| Empty state heading | `No AI proposals yet`; `No open AI proposals`; `No active risks`; `No withdrawn risks`; `No changes recorded yet` |
| Empty state body | `Ask the AI for risks this assessment may be missing, or give it an instruction such as “Risks about payment file integrity”.`; `Every proposal has been decided. They’re listed under Decided proposals.`; `Every risk in this assessment has been withdrawn. Add a risk, ask the AI for more risks, or reinstate one under Withdrawn.`; `Risks you withdraw are kept here with their reasons, and can be reinstated while the assessment is being edited.`; `Changes to this risk are listed here from now on.` |
| Error states | `We couldn’t load the AI proposals` · `Try again`; `The AI request didn’t finish` with R4 and `Retry AI proposals`; `The AI rewrite didn’t finish` with `Retry rewrite`; `We couldn’t load the history` · `Try again`; families R1 to R4, each saying what happened and what to do |
| Permission states | `You don’t have access to this history` · `Ask a Security Analyst working on this assessment if you need to see how this risk changed.`; R1 to R3's 403 copy and R2 and R3's `OWN_REQUEST` copy; §2.4's state lines, including `You raised this request, so another Security Analyst asks the AI about this assessment and decides its proposals. You can still edit, withdraw and reinstate its risks.`; the requesting analyst's readiness and signal captions (§9.1, §10.2) |
| Toasts | §5.1, §6.1, §6.2 and §7, word for word |
| Destructive confirmation | None. Withdrawal is reversible, never a deletion, and is never styled destructive. Every act here carries `Undo` (G-4). Release keeps its unchanged confirmation |
| AI output | Proposed risks are "proposed" and changes are "AI changes". A Security Analyst adds, confirms or rejects them, and nothing reaches the assessment without that decision |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 Info and relationships | The section is a headed region. Groups are `article`s with h3; items are an `ol`. The rewrite comparison is a `table` with a caption, column headers, row headers and a `tbody` per change; stacked pairs are labelled below 768px. History entries are an `ol` in a dialog. The `Show` filter is a named radio group |
| 1.4.1 Use of colour | `Withdrawn`, `Changed since proposed` and every note are an icon plus words. Changed words carry `ins`/`del` with weight or line-through, never colour alone |
| 2.1.1 Keyboard | §15, first row |
| 2.2.1 Timing adjustable | Undo toasts pause on hover and focus. Every reversed act has a durable path: `Reinstate risk`, the decided list's `Undo`, and the Risk form |
| 2.4.3 Focus order | §5.5, §6.1, §6.2, §7, §8.5; focus returns to the opener on every dismiss |
| 2.4.6 Headings | h2 `AI proposals`; h3 groups and `Open AI rewrites`. In a Risk card, h3 `AI rewrite` beside h3 `Mitigation controls`, with h4 for the rewrite's group; h4 for `Withdraw {risk number}` and the details groups. The history sheet has an h2 title |
| 2.5.3 Label in name | `Withdraw risk {risk number}`, `Reinstate risk {risk number}`, `History of {risk number}`, `Rewrite this risk: {risk number}`, `Confirm: {label} on {risk number}`, `Reject: {label} on {risk number}`, `Actions for {risk number}` (icon button), and the group action names, each beginning with its visible label |
| 2.5.8 Target size | Actions meet 24px in compact density and the touch-target height below 768px |
| 3.3.1, 3.3.3 Errors | Required reasons and the focus group say what is wrong and how to fix it, beside the field |
| 4.1.2 Name, role, value | `aria-expanded` and `aria-controls` on every toggle. The rewrite trigger has `aria-haspopup="dialog"` and the phone actions trigger `aria-haspopup="menu"` |
| 4.1.3 Status messages | One job status announcement per state; toasts (polite; danger once); the readiness count line (unchanged) |
| 1.4.10 Reflow | No horizontal page scroll from 320 to 1440. The comparison stacks below 768px |
| Automated | Zero serious or critical axe violations at 375 and 1440 on: the section in each §2.4 state (with proposals where the state shows them, and the requesting analyst's view), a compare open, an `AI rewrite` with every per-change state, the withdraw form, the `Withdrawn` list with details shown, the history sheet, the register's withdrawn detail, the phone proposals sheet and the actions menu |

---

## Spacing

The §3.9 scale applies unchanged; this phase adds no spacing value.

| §3.9 step | Use in this phase |
|---|---|
| 4px | Icon-to-text gaps in eyebrows, notes and badges |
| 8px | Between a card's actions; between a label, its field and its count; between the `Show` filter and its counts |
| 12px | Card and history-entry padding in compact density |
| 16px | Card padding; comparison cell padding (DataTable); between a card's blocks |
| 24px | Between groups; between the section's blocks; between history entries' groups |
| 32px | Between the `AI proposals` section and `Identified Risks` (§3.9 section rhythm) |

Existing primitives keep their shipped spacing (`Popover`, `Sheet`, toasts, `DetailSection`, the X-5 well, the Risk card). Exceptions: none.

---

## Typography

The §3.10 scale applies unchanged; this phase adds no size, weight or family.

| Emphasis level | Token | Weight | Phase 16 use |
|---|---|---|---|
| 1. Panel title | `--text-heading-sm` | 600 (the direction's `--text-heading-sm` weight, §3.10) | `AI proposals`, `AI rewrite`, form titles, the sheet titles, empty-state headlines |
| 2. Body | `--text-body` | 400; 500 for group headings, subjects, status lines and field labels | Descriptions, comparison values, reasons, state lines |
| 3. Caption | `--text-caption` | 400; 500 for badges and the change link | Facts, hints, counts, notes, left-out lines, `{instant} by {name}` |
| 4. Micro-label | `--text-micro` | 400 | Eyebrows, `Current`, `Proposed`, `Before`, `After`, `Reason`, `Sources`, details group headings |

Buttons keep `--text-button`. The weights used are therefore 400, 500 and 600, all within the direction's 400/500/600 set. The checker's two-weight heuristic is superseded by the adopted scale (ADR 0001 gap 8), as in Phases 06.5 to 15. `tabular-nums` applies to every count.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas, section, cards, withdrawn cards, popover, sheets |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-border-strong`, `--color-text-secondary` | X-5 wells, hairlines, field boundaries, captions and notes |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--focus-ring` | Only as listed below |
| Status (§3.5) | neutral (`Withdrawn`); warning (`Changed since proposed`, `AI proposed`, `Claims to check`, the policy alert); danger (job failure alerts, rollback toasts, field errors) | Always with an icon and words |
| Severity (§3.6) | `--color-risk-*` | `RiskRatingBadge`, unchanged |
| Destructive | `--color-danger-solid` | None added. Withdrawal is not destructive |

Ink is reserved for:
- the primary buttons `Suggest more risks`, `Rewrite risk` and the existing `Add Risk`, `Save risk` and `Save assessment`;
- record and figure links (open counts, `{k} AI changes to review`, `Added as {risk number}`, rewrite index links, `Open {assessment number}`, `Show in AI proposals`);
- the checked segment of the `Show` and density controls;
- focus rings.

These are outline: `Add to assessment`, `Confirm`, `Confirm all`, `Reject remaining`, `Reject proposal`, `Withdraw risk` (form submit), `Reinstate risk`, `Rewrite this risk`, `Use {rating}`, `Show history`, `Retry …`, `Check again`, `Review AI proposals` and the toggles.

These are ghost: `Reject`, `Reject as duplicate`, `Keep …`, `Undo`, `History`, `Withdraw risk` (card action), `Discard new risk` and `Show what the AI used`.

No new hue. AI and withdrawal have no colour of their own.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Optimistic pending (withdraw, reinstate, decisions, Undo) | The §5 Optimistic UI pending opacity, applied without a transition |
| Rollback | Opacity at `--duration-base`, `--ease-standard` |
| Cards leaving or entering a list (`Show` change, withdraw, add) | None: rendered in place (§6 do-not 8) |
| Toggles (details, compare, decided, changes, sources) | None: in place |
| Rewrite popover; actions menu | §5 "Dropdown / popover / menu" |
| Bottom sheets, side sheets and the phone proposals sheet | §5 "Drawer / side panel"; fade only under reduced motion |
| Toasts | §5 "Dialog / toast" |
| Inline spinners; skeleton shimmer | Static under reduced motion |

Jobs poll as Phase 10's do, with a visible `Check again` after the timeout. Nothing else refreshes on its own.

---

## Proposed CSRM extensions

These are for the orchestrator to accept, and for a Phase 16 plan task (research's 16-11) to record in `docs/design/csrm-design-direction.md` before the implementing tasks run. None introduces a value; each names a pattern over existing tokens. Numbering continues after Phase 15's X-26 (UI-D31). The before-and-after comparison is X-24's and is not proposed again.

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-27 | §4, new "Withdrawn records" entry, after "Status & risk badges" | Withdrawn records, their filter, card and reason forms | "**Withdrawn records (CSRM extension, 2026-10-01).** A record that a Security Analyst takes out of its parent without deleting it, such as a withdrawn Risk, is withdrawn, never deleted or removed, and copy never names the act `Delete`, `Remove` or `Not applicable`. It carries the status value `Withdrawn` (neutral tone, `Archive`) from the one shared mapping. It leaves every count, figure, gate, export and default list, and only the people who may reinstate it see it. Its list offers a segmented control labelled `Show` with `Active ({n})` and `Withdrawn ({n})` in `tabular-nums`, kept in the page address so a link can open either. Elsewhere, such as a register, `Withdrawn` is an explicit filter value that no default view includes, and choosing it adds one line saying who sees these records and that they count nowhere. A withdrawn record is a collapsed, read-only card on `--color-bg-surface` with a 1px `--color-border-default` boundary, `--radius-lg` and the Cards padding. The card holds its identifier, the `Withdrawn` badge, its rating where it has one, its title clamped to two lines, `Reason: “{reason}”` in `--text-body` and `Withdrawn by {name} · {instant}` in `--text-caption` / `--color-text-secondary`. Its actions are the small pills the server allows: `Reinstate {record}` (outline, `ArchiveRestore`), `History` (ghost, `History`) and an outline `Show details` toggle that reveals the record's read-only view in place. Withdrawing and reinstating each ask for a required reason of up to 500 characters in the In-place edit form, or a bottom sheet below 768px, with `Enter` to submit and `Escape` to keep the record as it is. Each applies at once, moves the record between the two lists, moves focus to the next record and confirms with an Undo toast. Neither asks for confirmation, uses the destructive button or loses the typed reason on a refusal. Where a record cannot be withdrawn or reinstated now, one line says why, never a disabled control." | D-08, D-11 and D-46 ask for a recorded withdrawn treatment that Phase 18's table and later registers reuse. The direction has status badges and in-place forms but no take-out-without-deleting pattern. |
| X-28 | §4, after "AI proposal items" | Field decisions and similar records (extends X-24) | "**Field decisions and similar records (CSRM extension, 2026-10-01).** This extends AI proposal items to proposals about a record's fields. **Field decisions:** a proposed change to one record whose fields are decided separately, such as an AI rewrite of a Risk, shows one before-and-after comparison inside that record, under its own heading, with the group's who, instruction and facts lines. Its rows are grouped into changes, and fields that derive from one another (a likelihood, a consequence and the rating derived from them) form one change, decided together. From 768px each change is a `tbody` whose final `Decision` cell, with a visually hidden header, spans its rows and holds `Confirm` (outline small, `Check`) and `Reject` (ghost small, `X`). Below 768px each change is a stacked card, current value above proposed, with full-width actions, `Confirm` first. A decided change stays in place with its provenance note (`Confirmed` or `Rejected`, who and when) and `Undo`, and the comparison moves to `Decided proposals` once every change is decided. Beside `Reject remaining ({n})`, such a comparison offers `Confirm all ({n})` (outline small, `ListChecks`), counting only the changes that can be confirmed. It is the only confirm-all control, and it stays within one record's comparison. A change whose basis has moved, or that a rule no longer allows, says why in one line and offers only `Reject`. While the record's own form holds unsaved changes, `Confirm` and `Confirm all` give way to one line asking the analyst to save or discard first. **Proposed records:** a proposed new record is an item whose eyebrow names its kind (`Proposed risk`, `Plus`), whose subject is its title, and which shows a one-line summary of its key facts, its rating badges, and its full proposed values behind an outline `Show proposed details` toggle. Its decision names where it goes, such as `Add to assessment` (outline small, `Plus`). That waits for the server, because it creates the record, and confirms with a toast offering `Open {identifier}` in place of Undo. A group of proposed records has no add-all control. **Similar records:** a proposed record that resembles an existing, withdrawn, rejected or open one carries the provenance note `Similar to {identifier}` (`Copy`), or `Similar to a withdrawn risk, {identifier}`, `Similar to a rejected proposal` or `Similar to an open proposal`. It also carries an outline `Compare with …` toggle that opens the before-and-after comparison with the other record's name and `Proposed` as its column labels and `Same` (`Equal`) in place of `Changed` on matching rows, and a ghost `Reject as duplicate` that rejects at once with the reason `Duplicate of {identifier}`. The decided group, densities, Undo and the visible verbs are as for AI proposal items; the visible word is never `Accept`." | D-32, D-33 and D-36 need per-field decisions, a confirm-all within one record, a creating decision and a similarity flag, which X-24 does not define (it has no confirm-all). Phase 17's residual reassessment and Phase 18's table reuse them (S-11). |
| X-29 | §4 Dialogs, after "Side sheet" | Record history | "**Record history (CSRM extension, 2026-10-01).** A record's change history opens from a small `History` pill (`History`, ghost on a card, outline in a page header) in a Side sheet titled `History of {identifier}`, newest first, with `{shown} of {total} {change|changes}` in `--text-caption` with `tabular-nums`. Each entry is an `li` on `--color-bg-surface` with a 1px `--color-border-default` boundary, `--radius-lg` and 12px padding. It holds a 16px icon in `--color-text-secondary` and the change in `--text-body` at 500, then `{instant} by {name}` in `--text-caption` / `--color-text-secondary` (Dates and times), then the lines that apply: `Reason: “{reason}”`, a `Source:` line naming how the change was made (by hand, from a confirmed AI proposal, by an Undo) with a record link to the proposal while it is listed, and the changed fields as the AI proposal items' before-and-after comparison, read-only, with the column labels `Before` and `After`, no decision column and no unchanged rows. An item taken off the record lists its values at that moment. A value keeps the label it had when recorded, and an entry whose details cannot be read says so in one line rather than failing the list. Entries load 25 at a time. An outline `Show older changes` loads the next 25 and moves focus to the first new entry. Where recording began after the record was created, the list ends with `History recorded from {date}. Earlier changes to this record weren’t recorded.` The sheet offers comfortable and compact densities, persisted per person; compact collapses each comparison behind `Show {n} changed {field|fields}`. Review decisions that change no value are not history entries." | D-18 to D-21 and D-46 ask for a history view that Phases 17, 17.2, 18 and 20 extend (S-7, S-9, S-10). The direction has a side sheet but no change-history presentation; the questionnaire timeline was never recorded. |

---

## Decisions recorded

These were made without asking, because this phase's discussion and UI contract run in auto mode. Each follows the locked context and its confirmations, `AGENTS.md`, the glossary and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | The visible verbs are `Confirm`, `Confirm all`, `Reject`, `Reject remaining` and `Undo`; a proposed risk is added with `Add to assessment`; a Risk is withdrawn or reinstated. `Accept`, `Approve`, `Delete`, `Remove`, `Dismiss` and `Not applicable` are never used. AI items are "proposed risks" and "AI changes", never "suggestions". | The orchestrator's confirmation and the glossary ("Reject" for a proposed change; "Dismiss" stays with Phase 12's suggested controls; "Withdrawn (Risk)" avoids Deleted, Removed and Rejected). |
| UI-D2 | `AI proposals` is its own h2 section directly before `Identified Risks`, anchored `#ai-proposals`. | It mirrors Phase 15 §2; open proposals gate release, so they come before the Risks; readiness and the header link to one stable place; `Identified Risks` keeps its form indexing (§16 E2). |
| UI-D3 | The start action always reads `Suggest more risks`, with no `Ask the AI` variant. | An instruction here can only narrow what to look for, so the label stays true (unlike 15 UI-D3, where an instruction can ask for removals). |
| UI-D4 | From 768px a card's three actions are small pills in its header; below 768px they are one icon-button menu, `Actions for {risk number}`. | Three full-width buttons per card at 375px bury the Risk; a menu keeps one keyboard path (D-47). |
| UI-D5 | The withdraw and reinstate reasons are a required single-line `Input`, with `Enter` to submit and a count once text is typed. | D-06's 1 to 500 bound; D-47's "Enter to submit". |
| UI-D6 | A proposed-risk group has `Reject remaining` and no add-all. | Each risk is an identification decision on its own (ASSESS-10 criterion 1; X-24). |
| UI-D7 | Reinstatement carries `Undo`, which withdraws the Risk again with the reason it held before. | The spawn rule says both acts are reversible with Undo. Settled by the orchestrator's confirmation: the withdrawals operation takes `undo: true`, and the contract-gap record names the flag. |
| UI-D8 | `Withdraw risk` is refused in words while the Risk's form holds unsaved changes. | No lost input: a withdrawn Risk is read-only, so the unsaved edit could not be saved afterwards. |
| UI-D9 | The editor filters with a `Show` segmented control kept in the address. The register adds `Withdrawn` to `Risk state`, whose default becomes `Open and closed`. | D-08 and D-47 (segmented control); withdrawn Risks are always unreleased, so they never mix with `Closed`; `All` would misstate the default. |
| UI-D10 | Withdrawn cards are collapsed, with the reason, who and when visible and the details behind `Show details`. | D-45 "collapsed and read-only"; the reason is the fact a reviewer needs first. |
| UI-D11 | A proposed risk shows its statement, key facts and ratings, with every field behind `Show proposed details`. | A 25-field record per card would make eight proposals unreadable; the summary is enough to add or reject, and the fields are reviewed again after adding. |
| UI-D12 | `Add to assessment` waits, offers `Open {risk number}` and has no Undo. | D-33. |
| UI-D13 | Similarity is a note, a `Compare with …` toggle and `Reject as duplicate`, with the reason written for the analyst. | D-32's side-by-side and one-click reject, with the reason feeding the next request. |
| UI-D14 | A rewrite is reviewed in its Risk card's `AI rewrite` section, and the proposals section indexes open rewrites. | D-45 puts the diff in the card; X-10 needs the open count's list to equal its figure. |
| UI-D15 | Decided changes stay in place until the whole rewrite is decided. | Moving rows while the analyst works down a comparison would lose their place. |
| UI-D16 | `Confirm all ({c})` counts and applies only the changes that can be confirmed. | It never fails on a known-stale or Accept-blocked change; the count says exactly what it does. |
| UI-D17 | While a Risk's form holds unsaved changes, `Confirm` and `Confirm all` are not offered on its rewrite, and `Reject` stays. | Phase 12's "never reset unsaved values" and 15 UI-D10; rejecting changes no field. |
| UI-D18 | Phase 16 offers no `Edit, then confirm`. | D-33 and D-36 name none. A proposed risk is edited after adding, and a change is confirmed and then edited, or rejected and the field edited. |
| UI-D19 | The domain module pre-checks the Accept rule and shows the line with `Reject` only; Strapi decides. | D-38 and the G-14 confirmation; X-15's "why in words". |
| UI-D20 | The rewrite form has the instruction and `What to rewrite` (all checked), and warns when it will replace open changes. | D-34's focus and D-37's "the start dialog says so". A popover keeps the Risk in view. |
| UI-D21 | Changed words are marked in long text and history, and not when either value exceeds 2,000 characters. | X-24's emphasis with a bounded diff (research); whole values stay honest beyond the bound. |
| UI-D22 | The readiness label is `Decisions on AI proposals`, with `{n} open`. | It reads correctly as an outstanding and a met item, and is distinct from Phase 12's `Review of AI proposals`. |
| UI-D23 | History lists value changes only, not Phase 12's confirmations or dismissals. | D-19 leaves it to this contract. Those decisions change no value and stay with the proposals and the run. |
| UI-D24 | History opens in a side sheet from every Risk card, withdrawn card and register detail, released ones included. | D-21; the third line reads it after release. |
| UI-D25 | The overall-rating hint sits under its field, and `Use {rating}` sets the field without saving. | D-15: the analyst's conclusion never changes on its own. |
| UI-D26 | After a Phase 16 request, the signal's heading reads `AI inputs changed since the AI was last asked about this assessment`, and it offers `Suggest more risks`. | D-28's baseline is the latest AI request; X-18's "since this draft was generated" would be untrue. |
| UI-D27 | On phones the section is a summary card that opens a full-screen proposals sheet. | D-47 ("the proposals panel as sheets"). |
| UI-D28 | `Discard new risk` offers Undo, and an untouched form closes silently. | D-17; no toast for nothing. |
| UI-D29 | One density setting covers the section and every rewrite comparison; history has its own. | G-4 density; the two lists are read differently. |
| UI-D30 | Released assessments keep the filter, withdrawn cards, `History` and `Decided proposals`, with no curation control. | D-29 and D-45. |
| UI-D31 | Extensions are numbered X-27 to X-29. | They continue Phase 15's X-26 (the spawn prompt). |
| UI-D32 | Every register detail offers `Show history`; a withdrawn detail is read-only and links to the assessment's `Withdrawn` view. | D-45. |
| UI-D33 | Phase 16's refusals are family R (R1 to R4). | Families A to Q are taken (Phases 10 to 15). |
| UI-D34 | Request deletion gets refusal copy only. | The web offers no request delete control today (searched on 2026-10-01), so "not offered" already holds. |
| UI-D35 | The analyst who raised the request sees one line in place of every targeted AI control and no proposal content, and keeps editing, withdrawing and reinstating (§12.3). | The orchestrator's confirmation (Phase 15 D-32, G-1, narrowing D-44); 15 §12 and UI-D26's pattern; X-15's "why in words". |

---

## Notes carried

- **Settled by the orchestrator (16-CONTEXT, "UI-SPEC points settled").**
  - **Undo of a reinstatement (UI-D7): settled.** The withdrawals operation takes `{ riskIds, undo: true }`. The server restores the withdrawal reason held before the reinstatement and records the event as an undo. The contract-gap record names the flag.
  - **Requesting analyst (UI-D35): settled.** G-1 extends Phase 15 D-32 to this phase: the analyst who raised the request takes no targeted AI action (no start, rewrite, retry or decision), which narrows D-44. Strapi refuses each with `OWN_REQUEST` (403), and §12.3 is the UI state. Phase 15 D-32 also withholds the proposals themselves; this contract renders none for that analyst, and the plan that serves the proposals read applies the same rule server-side.
- **For the planner.**
  - **The register's default label** changes from `All` to `Open and closed` (Phase 11's control). The Phase 16 plan that edits `risk-register-filters.tsx` owns it.
- **Shared-file changes needed.**
  - `docs/design/csrm-design-direction.md` records X-27 to X-29, by a Phase 16 plan task.
  - The root `CONTEXT.md` already holds "Withdrawn (Risk)" (research verified). "Confirm (AI proposal)" could add "Confirm all" and "Add to assessment" as the analyst's verbs for a rewrite and a proposed risk.
- **Research to verify.**
  - The analyst detail's served open-proposal count and per-Risk open-change counts (folded from Phase 15's model, never stored).
  - The served `recordedFrom` on the history read.
  - The signal's resolver for Phase 16 requests.
- **Route budget.** The section's frame and the withdrawn card's static parts render on the server. The section's lists, the comparison, the rewrite form, the withdraw form and the history sheet load with `next/dynamic` from a Client Component, and client pieces stay zod-free (D-48). `performance.spec.ts` stays green, or a recorded exception gives its reason.

---

## UI Considerations

These rows are written inline from the contract. The ui-phase consideration probe (Step 9.5) replaces them when it runs.

Applicable state considerations resolved: 29 covered, 3 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| empty | AI proposals section | covered | First-use and cleared copy (§2.7) |
| empty | `Active` and `Withdrawn` lists | covered | §6.3's four cases |
| empty | History | covered | `No changes recorded yet` (§8.5) |
| empty | Nothing proposed; no rewrite change | covered | §2.3, §4.2 lines with the left-out list |
| loading | Section parts; history | covered | Skeletons after 300ms mirroring the layout (§2.7, §8.5) |
| loading | Start, rewrite, add | covered | Inline spinners `Asking the AI…`, `Rewriting…`, `Adding…` |
| loading | Jobs | covered | Status lines, polling, `Check again` (§2.3, §4.2) |
| error | Proposals read; history read | covered | Compact errors with `Try again` |
| error | Start, rewrite form | covered | R2 under the field, text kept |
| error | Jobs | covered | R4 alerts with retry for any analyst except the one who raised the request |
| error | Decisions; withdraw; reinstate | covered | Rollback, R1/R3 toasts, the withdraw form reopened with its reason |
| permission | Requestor; participants | covered | Nothing of this phase in their tree (§12.2) |
| permission | States that forbid an action | covered | §2.4 lines; no controls after release (§12.1) |
| permission | History 403 | covered | §8.5, worded independently of role |
| permission | The analyst who raised the request | covered | One line in place of every targeted AI control; withdraw and reinstate kept; `OWN_REQUEST` copy (§12.3, R2, R3) |
| populated | Every surface | covered | §1 to §11 |
| partial | Rewrite | covered | Open, confirmed, rejected, changed since proposed and Accept-blocked changes side by side (§4.4) |
| partial | Proposed risk without type, system or rating | covered | `No Risk Type`, omitted facts, `Not rated` (§3.2) |
| partial | Pre-Phase 16 Risks | covered | `History recorded from {date}…` (§8.4) |
| partial | Malformed history entry | covered | One line; the list still loads (§8.3) |
| overflow | Eight proposals in a group | covered | Compact density; one `ol`; no stagger |
| overflow | Comparison on phones | covered | Stacked, current above proposed (§4.3) |
| overflow | Long statements and reasons | covered | Wrap anywhere; clamps keep full text in the DOM |
| overflow | Card header actions at 1440 with every badge | backstop | `{ statement: "At 1440px a Risk card header holding the number, rating, AI proposed badge, the open-change link and the three action pills wraps without overlapping and keeps each target at least 24px", verification: backstop }` |
| overflow | Rewrite popover near the viewport edge | backstop | `{ statement: "At 1440px the rewrite popover opened from the last Risk card stays within the viewport and its field, checkboxes and actions are fully visible", verification: backstop }` |
| long-text | Toasts naming change labels | backstop | `{ statement: "A toast naming 'Information asset and data classification' on a long risk number wraps at 375px and its Undo stays visible and reachable", verification: backstop }` |
| zero-one-many | Counts | covered | `{proposal|proposals}`, `{risk|risks}`, `{change|changes}`, `{field|fields}` written out |
| zero-one-many | Withdraw last active Risk | covered | `No active risks` and `At least one Risk` outstanding (§6.3, §9.1) |
| zero-one-many | Groups and rewrites | covered | One or many render alike; zero uses the empty copy |
| zero-one-many | History pages | covered | Count line and `Show older changes` only when more exist |
| zero-one-many | Similarity targets | covered | Four kinds, compare offered only when the other record is loaded (§3.3) |
| zero-one-many | Readiness item | covered | Outstanding with `{n} open`, or met (§9.1) |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | None new. The existing `Input`, `Textarea`, `Label`, `Checkbox`, `Table`, `Popover`, `Sheet`, `DropdownMenu`, `Skeleton`, `Alert`, `Button`, `Separator` and `sonner` `Toaster` | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

No new dependency.

---

## Verification contract

- **Unit and component (Vitest):**
  - the zod-free domain: change grouping and labels, the Accept pre-check, the overall-rating hint, the bounded word diff, the `Show` counts, left-out lines, decided notes;
  - the `risk` status family;
  - withdraw and reinstate: the forms, required and bounded reasons, `Enter` and `Escape`, the unsaved-changes line, optimistic move, Undo (with `undo: true`), rollback with the reason restored, focus;
  - the withdrawn card: badge, reason, who and when, details toggle, no edit controls, reinstate offered only when editable;
  - `Discard new risk`: Undo restores the typed values; an untouched form closes silently;
  - the section: five states, first-use and cleared copy, job states, phone summary and sheet, density;
  - the requesting analyst (§12.3): the section's line with no status line, start form, job, retry, groups or decided list; no `Rewrite this risk`, `AI rewrite` section or change link on a Risk card; the two-item actions menu; no open-proposal line; the signal and readiness captions; `Withdraw risk` and `Reinstate risk` still offered; R2 and R3's `OWN_REQUEST` copy;
  - proposed risks: summary, details, citations, similarity and compare, `Reject as duplicate`, `Add to assessment` waiting with `Open {risk number}`;
  - rewrite: control presence rules, the form and focus validation, the supersede caption, every per-change state, `Confirm all` counting, the unsaved-form line, decided changes staying in place;
  - `field-comparison` extensions: decision column, spanning cells, custom column labels, `Same` rows, emphasis bound;
  - history: every §8.3 kind, the read-only comparison, paging and focus, the honest start, malformed entries, five states;
  - readiness item, the hint and `Use {rating}`, the signal's heading and action, the run sheet's groups;
  - register: `Risk state` options, chip, notice, row badge, read-only withdrawn detail with `Open {assessment number}`;
  - copy: family R; no control named `Accept`, `Accept all`, `Approve`, `Delete` or `Remove` in `features/risk-curation`; nothing of this phase in the Requestor's tree.
- **Contract parity:** every new or widened parser joins `contract-response-parity.test.ts` (D-02).
- **E2E** (dev servers stopped): §16 E1 to E4, with zero serious axe violations at 375 and 1440 on each state the Accessibility contract lists. The run leaves the tree clean.
- **Browser backstops** (orchestrator):
  - the three UI Considerations backstops;
  - NVDA reading the comparison's row and column headers with a spanning decision cell, the job status once per state, and a toast's `Undo` by `Alt+T`;
  - a keyboard-only withdraw, Undo, reinstate and rewrite review;
  - the live-model UAT-A `Suggest more risks` check (D-50), judged against §3.

---

## Checker sign-off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS
- [ ] Dimension 7 Inventory Provenance: PASS

**Approval:** pending
