---
phase: "15"
slug: "steerable-questionnaire-ai"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 15 — UI Design Contract

> Visual and interaction contract for the steerable questionnaire AI. It covers:
> - the `AI proposals` panel on the analyst questionnaire page, in every state before the draft (D-06, D-33);
> - the instruction field, on the panel, the rewrite control, Generate and Replace (D-12, D-17 to D-19);
> - proposal items with the before-and-after comparison, their decisions, Undo, staleness and what CSRM left out (D-13, D-15, D-20 to D-24);
> - "Rewrite in plain language" on each unanswered question (D-11);
> - the answered (fixed) questions (D-05, D-30);
> - the gates on release, draft generation and replacement, and the hub's entry points (D-08, D-09, D-29);
> - provenance: the header, question origin, "What the AI used" and the revision timeline (D-19, D-26 to D-28);
> - the Requestor's refused save after a return to analyst review (D-25), and the requesting analyst (D-32).
>
> It introduces no colour, type size, weight, family, radius, shadow, spacing step or duration of its own. Three patterns the direction does not yet name are proposed as CSRM extensions X-24 to X-26.

---

## Binding inputs and value authority

- **Locked decisions.** D-01 to D-37 in `15-CONTEXT.md` and its Orchestrator Confirmations govern this contract. It fixes the copy, layout and visuals the context leaves to the UI-SPEC (Planner's Discretion: "Copy, layout and visuals"). Where a decision leaves a choice open, this contract makes it and records the reason under "Decisions recorded" (UI-D1 to UI-D34).
- **Value authority.** `docs/design/csrm-design-direction.md` (ADR 0001) is the only value-bearing authority. This file names semantic tokens and cites the direction by section (§). It restates no colour, size, radius, shadow or duration. Spacing steps are named only where a new layout needs one, and each is a §3.9 step.
- **Extensions.** Recorded before any Phase 15 plan runs: X-1 to X-5 (plan 10-01), X-6 to X-10 (Phase 11), X-11 to X-14 (plan 12-13), X-15 to X-18 (Phase 13), X-19 to X-23 (Phase 14). This contract reuses:
  - X-1 (save status) for the Requestor's refused save;
  - X-3 (dates and times) and X-4 (separators) everywhere;
  - X-5 (in-place edit form) for "Edit, then confirm";
  - X-7 (keyboard shortcut hint) on the instruction field's action;
  - X-10 (figure links) for every new count;
  - X-11 (AI provenance badge and notes), X-12 (source citations), X-13 (side sheet) and X-14 (Undo toast), Phase 12's decision pattern (12 §6);
  - X-15's rule that a viewer who may not act sees why in words;
  - X-18 (the "AI inputs changed" signal), which gains this phase's action (13 §10.2).

  New patterns are X-24 to X-26 under "Proposed CSRM extensions", each with its exact wording. A plan task records them before any implementing task runs. X-24 is the before-and-after comparison shared with Phase 16 (its D-46) and Phases 17 and 17.2: it is written for any record's fields, not only a question's.
- **Requirements.** QUES-11 and QUES-12. Acceptance bar: ROADMAP Phase 15 success criteria 1 to 4.
- **Findings closed.** UAT-017 and UAT-018 (intent F4, A2).
- **Delegated decisions.** #4, #5, #6, #10, G-1, G-3, G-4 (§15 of this contract), G-6, G-7, G-12 and G-14 (the glossary's "Confirm (AI proposal)").
- **Builds on Phases 10 to 14,** whose plans are written but not yet executed: Phase 10's governance editor (10 §1), released view (10 §2), Replace (10 §3), timelines (10 §4), refusal families A to I (10 §10.2) and job cards (10 §12); Phase 11's voice and token tables; Phase 12's provenance header (12 §1), "What the AI used" (12 §2), citations (12 §4), decisions (12 §6), question origin (12 §8.2) and family J; Phase 13's signal (13 §10.2), its families K to M and its session-kept drafts (13 §9.3); Phase 14's families N to P. Every plan re-reads those files once the earlier phases have executed.
- **Domain vocabulary.** Questionnaire, question, section, Security Analyst, Requestor and Assessment Request, as the JDL and the glossary use them. "AI proposal" presents an item of a `CsrmAiRun` proposal (Phase 12 D-19); it is not a competing entity.
- **Reserved words.** The analyst's review act is `Confirm` (glossary "Confirm (AI proposal)"; Phase 12 UI-D1). Its negative here is `Reject`, because every item is a proposed change; `Dismiss` belongs to Phase 12's suggested controls. `Accept` and `Approve` never appear in a Phase 15 string. `Release` names the questionnaire's release, unchanged.

### Decision coverage

| Decisions | Where this contract honours them |
|---|---|
| D-01 to D-03, D-15 (contract, operations, reasons) | No UI of their own. The UI reads the planned fields only; reasons map to §13's copy |
| D-04, D-05 | §4 (nothing changes until `Confirm`), §7 (fixed questions) |
| D-06 | §2.4 state table; §6.1 where the rewrite control shows; §7 |
| D-07 | §2.4 (Confirm only in analyst review), §11 (nothing new for the Requestor) |
| D-08 | §8.1, §8.2 (gates as lines linking to the panel); `Reject remaining` (§4.1) |
| D-09 | §8.3 |
| D-10 | §2.2 (start form, default labels), §4 |
| D-11 | §6 |
| D-12 | §3.3, §8.3 |
| D-13, D-14 | §4.3 (kinds, placement, visibility, sources) |
| D-16 | §2.3 (job state), §8.4 (hub job) |
| D-17 to D-19 | §3 (X-25), §4.1 run header, §9.3, §10 |
| D-20 | §4.4 (stale), §4.6 (decided states) |
| D-21 to D-23 | §5 |
| D-24 | §4.6 (`Replaced by a newer proposal`, `Closed without a decision`) |
| D-25 | §4.4 (stale), §11.2 (the Requestor's refused save) |
| D-26 to D-28 | §9, §10 |
| D-29 | §9.1 (signal action), §8.4 (hub) |
| D-30 | §7 (answered, never the answer); §4.3 citations (UI-D15) |
| D-31, D-32 | §12; no control without the grant |
| D-33 | §1 to §8 |
| D-34 | The whole contract; X-24 to X-26 |
| D-35 | §15 (G-4); Notes carried (route) |
| D-36, D-37 | §16, Verification contract |

---

## Design system

| Property | Value |
|----------|-------|
| Tool | shadcn/ui, source-owned local components (`apps/csrm/components.json`: style `new-york`, RSC, CSS variables, neutral base, `iconLibrary: lucide`) |
| Preset | new-york; neutral base; CSS variables; RSC; Lucide icons |
| Component library | Radix primitives through the installed `radix-ui` package (1.6.7), composed by the local shadcn/ui components; `sonner` under the source-owned `Toaster` |
| Icon library | `lucide-react` 1.30.0, per §4 Iconography. Every icon named here was confirmed in the installed package on 2026-10-01 |
| Font | Plus Jakarta Sans for UI text, data and numbers; Instrument Serif for page titles only; IBM Plex Mono for micro-labels and identifiers (§3.10, ADR 0001 gap 8) |
| Tokens | Semantic tokens in `apps/csrm/app/globals.css`, whose values are the direction's; feature code consumes the mapped utilities only |
| New dependencies | None. The panel composes `Textarea`, `Input`, `Button`, `Popover`, `Sheet`, `Table`, `Skeleton` and the `sonner` action; no diff library (research §Q) |

---

## Component inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

A non-exhaustive list of the known-good components this phase uses, never a closed allowlist. The full set is `alert-dialog` to `tooltip`.

| Component | Import path | Phase 15 use |
|---|---|---|
| `Textarea`, `Input`, `Label` | `@/components/ui/*` | The instruction field (X-25); the reject reason (§5.3); the "Edit, then confirm" form (X-5) |
| `Table` | `@/components/ui/table` | The comparison from 768px (X-24) |
| `Popover`, `Sheet` | `@/components/ui/popover`, `@/components/ui/sheet` | The rewrite form (popover from 768px, bottom sheet below); "What the AI used" (X-13) |
| `Toaster` (sonner `toast` with `action`) | `@/components/ui/sonner` | Undo and rollback toasts (X-14) |
| `Skeleton` | `@/components/ui/skeleton` | The panel's on-demand parts |
| `Alert`, `Button`, `Separator` | `@/components/ui/*` | Job failure, actions, run dividers |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

A non-exhaustive list; the executor may use any exported primitive.

| Primitive | Path | Phase 15 change |
|---|---|---|
| `StatusBadge`, `statusPresentation` | `components/csrm/status-badge.tsx` | The `aiReview` family (X-11) gains `stale` → `Changed since proposed`, warning, `History` |
| `RecordLink` | `components/csrm/record-link.tsx` | Figure links, note citations, timeline links |
| `ConfirmDialog` | `components/csrm/confirm-dialog.tsx` | Phase 10's Replace dialog gains the instruction field (§8.3); release and return dialogs unchanged |
| `DetailSection` | `components/csrm/detail-section.tsx` | The panel's section frame |
| Phase 10 `LocalInstant`, navigation guard, `refusal-copy.ts`, question form, `questionnaire-revision-timeline.tsx` | as Phase 10 plans them | §5.2 form, §10 timeline, §13 families |
| Phase 12 `ai-assistance` (provenance header, run sheet, citations, domain) | as Phase 12 plans them | §4.3, §9 |
| Phase 13 signal, session draft store | as Phase 13 plans them | §9.1, §3.2 |
| **New:** questionnaire AI feature | recommended `features/questionnaire-ai/` (research §A): `questionnaire-ai-domain.ts` (zod-free), `ai-proposals-panel.tsx` (lazy parts), `proposal-run-group.tsx`, `proposal-item-card.tsx`, `instruction-field.tsx`, `question-rewrite-control.tsx`, `answered-question-note.tsx`, `questionnaire-ai-actions.ts` (`'use server'`) | §2 to §8 |
| **New:** shared comparison | `features/ai-assistance/field-comparison.tsx` and `field-comparison-domain.ts` (zod-free), for Phases 16, 17 and 17.2 | X-24 |

Names and paths of new modules are the planner's. Zod stays out of every new client module (`zod-client-boundary.test.ts`).

---

## Token names used in this contract

As the Phase 11 contract's table, which this contract does not repeat. This phase uses these additionally or more heavily:

| Direction token | Utility or class in the shipped code | Phase 15 use |
|---|---|---|
| `--color-warning-bg` / `-fg` / `-border` | `bg-warning-subtle text-warning border-warning-border` | `Changed since proposed` (X-24) |
| `--color-bg-inset` | `bg-surface-muted` | The X-5 well for "Edit, then confirm" and the reject reason; inserted-word emphasis (X-24, unused here) |
| `--color-border-default` | `border-border` | Item cards, run dividers, comparison row rules |
| `--font-mono` with `--text-micro` | `.micro-label` | Kind eyebrows, `Current` / `Proposed` column labels, `Reason`, `Sources` |

---

## Voice, formats and shared copy rules

The Phase 11 contract's "Voice, formats and shared copy rules" applies unchanged (Australian English, sentence case, spaced hyphen, X-4 middle dot, typographic apostrophes and quotes, written-out plurals with `tabular-nums`, X-3 times), with Phase 12's "AI terms in copy" and "No internal terms" and Phase 13's "People are names". In addition:

- **Verbs.** `Confirm`, `Confirmed`, `Edit, then confirm`, `Reject`, `Rejected`, `Reject remaining`, `Undo` (UI-D1). Never `Accept`, `Approve` or `Dismiss` for a proposal.
- **Nouns.** An item is a "proposal"; a request to the AI is "asking the AI". Copy never says "run", "item", "stale", "superseded", "lapsed", "adjustment", "fingerprint", "base", "fold" or "preset".
- **Instructions** are quoted with typographic quotes, shown as plain text with line breaks kept, never as HTML.
- **Question texts** are shown verbatim with `[overflow-wrap:anywhere]`; where one line is required, they end in an ellipsis beyond 28rem with the full text in the DOM and in accessible names.

---

## 1. The questionnaire page (D-33)

**Surface:** `/app/review/questionnaires/{id}`, in the `analyst-review`, `awaiting-submission` and `submitted` states, and read-only once an assessment exists.
**Focal point:** in analyst review, the first open proposal's `Confirm`; otherwise unchanged from Phase 10.

Page order, additions in bold:
1. Page header, `AssessmentRequestLink` with Phase 13's lines (13 §11).
2. Phase 12's provenance header (12 §1), with **the open-proposal line** and the signal's **action** (§9.1).
3. **The `AI proposals` panel (§2)**, a `DetailSection` with h2 `AI proposals` and region id `ai-proposals` (`tabIndex={-1}`, the target of every link to it). In every state before the draft (UI-D2).
4. The governance panel and question list as Phase 10 defines them per state, with **the answered note** (§7), **the rewrite control** (§6), **the open-proposal link** per row (§4.7), **the confirmed-origin notes** (§9.2) and **the release line** in place of `Release questionnaire` while proposals are open (§8.1).
5. Revert summary and revision timeline, with **the new entries** (§10).

| Viewport | Contract |
|---|---|
| 1440 | One column at `--spacing-container-max`. The comparison uses the panel's full width |
| 375 | Every block stacks; item cards are full width; no horizontal page scroll from 320 |

---

## 2. The `AI proposals` panel (D-06, D-10, D-16, D-33)

### 2.1 Frame

| Part | Contract |
|---|---|
| Heading | h2 `AI proposals` (`--text-heading-sm`) |
| Description (`--text-body`, `--color-text-secondary`) | `Ask the AI to suggest questions, or to change or remove unanswered ones. Nothing changes until you confirm it, and the Requestor sees changes only when you release the questionnaire.` |
| Status line (`--text-body` at 500, `tabular-nums`, `tabIndex={-1}`) | `{n} open {proposal|proposals}`, or `No open AI proposals` |
| Density | A segmented control (§4 Forms) labelled `Density`: `Comfortable`, `Compact`, shown when one or more proposals are listed. Persisted per person in the browser, as the DataTable's density is (UI-D27). From 768px it sits right of the status line; below 768px it is not shown and comfortable applies |

Order inside the panel: frame, the state guidance (§2.4), the start form (§2.2) or the job state (§2.3), the answered questions (§7.2), open proposals grouped by request (§4.1), then `Decided proposals` (§4.6).

### 2.2 Start form

| Part | Contract |
|---|---|
| Instruction | The X-25 field (§3), id `ai-proposals-instruction` |
| Action (primary, `Sparkles`) | Field empty: `Suggest more questions` when no question is answered, `Suggest follow-up questions` when one is. Field holding text: `Ask the AI` (UI-D3). Pending: `Asking the AI…` with the inline 16px spinner. X-7 hint `Ctrl` `Enter` or `⌘` `Enter` from 768px; `aria-keyshortcuts` on the textarea |
| Refusal at start | §13 family Q1 under the field (an instruction reason) or as the form's error line (any other), `role="alert"`; the text stays |

| Viewport | Contract |
|---|---|
| 1440 | The field at the §4 Forms maximum field width; the action left-aligned under it |
| 375 | Full width; the action at full width and the touch-target height |

### 2.3 Job state (Phase 10's job-panel pattern, 10 §12.1; Phase 13 §13)

The job state takes the start form's place while a questionnaire-wide job is queued or running. A rewrite job shows on its row (§6.2) and, here, as one more line.

| State | Contract |
|---|---|
| Queued or running | Status (`--text-body` at 500, polite live region): `The AI is preparing proposals` (questionnaire) or `The AI is rewriting “{question text}”` (rewrite). Caption: `You can leave this page. The proposals show here when you come back.` When another analyst started it: `Started by {name}.` The `Attempt {n}` tag as Phase 10. Polls as Phase 10, then `Check again` (outline, small) after 30 seconds with `Automatic checks stopped after 30 seconds. The AI may still be working.` |
| Completed with proposals | The panel refreshes; the live region says `{n} AI {proposal is|proposals are} ready to review.` Focus is not moved |
| Completed, nothing proposed | `The AI proposed nothing new for this questionnaire.` (questionnaire) or §6.3's line (rewrite), polite, until the next page view, followed by §4.1's `{a} left out` figure link and list when CSRM dropped anything; the start form returns |
| Failed | A danger-treatment `Alert`, title `The AI request didn’t finish`, body §13 family Q3, action `Retry AI proposals` (outline) for any analyst on the request (Phase 13 D-18); the start form returns below it with its text kept |
| Status check failed | Phase 10's `Status unavailable` alert, unchanged |

### 2.4 By questionnaire state (D-06, D-07)

| State | Guidance line (`--text-body`, `--color-text-secondary`, 16px icon `aria-hidden`) | Start form and rewrite | Open proposals |
|---|---|---|---|
| Analyst review | none | Offered | `Confirm`, `Edit, then confirm`, `Reject`; staleness shown |
| Released, Requestor not submitted | `Clock`: `The Requestor is answering this questionnaire. You can ask the AI once they submit it, or after you return it to analyst review.` then `Return to analyst review` (outline; Phase 10's dialog, unchanged) | Not offered | Read-only; `Reject` only; no staleness, no answered list (UI-D12) |
| Released and submitted | `Lock`: `To confirm proposals, return the questionnaire to analyst review. You can ask the AI and reject proposals now.` then `Return to analyst review` (outline) | Offered | `Reject` only, once per panel the line above explains why (UI-D13); staleness shown |
| Assessment draft queued or running | `Lock`: `An assessment draft is being generated, so this questionnaire can’t change.` | Not offered | Read-only, no actions |
| Assessment exists | `Lock`: `An assessment has been drafted from this questionnaire, so its questions can no longer change.` | Not offered | None open (lapsed or decided, §4.6) |
| A question form is open (editor or §5.2) | `Save or discard the open question before you confirm proposals or ask the AI.` (`--text-caption`) | Action disabled | `Confirm` and `Edit, then confirm` disabled; `Reject` stays (UI-D10) |

### 2.5 Empty and loading

| Case | Copy (§4 Empty states) |
|---|---|
| No proposal ever, start offered | `No AI proposals yet` · `Ask the AI for follow-up questions, or give it an instruction such as “Add questions about the offshore support team”.` The start form is the call to action, so the empty state has no button |
| No proposal ever, start not offered | No empty state: the guidance line alone |
| All decided | `No open AI proposals` (cleared type) · `Every proposal has been decided. They’re listed under Decided proposals.` |
| Loading | The frame renders with the page. The start form and lists load on demand: nothing for 300ms, then a skeleton of a field (label line, three-row block, button block) and two item cards (eyebrow, title, four comparison rows, action row) |
| Error (the proposals read failed) | Compact `We couldn’t load the AI proposals` with `Try again`. The release control shows normally; Strapi still refuses a release while proposals are open (§8.1) |

---

## 3. The instruction field (X-25; D-12, D-17 to D-19)

### 3.1 Anatomy

| Part | Contract |
|---|---|
| Label (`--text-body` at 500) | `Instruction for the AI (optional)` |
| Hint (`--text-caption`, `--color-text-secondary`), by `aria-describedby` | Panel: `Say what to focus on, add, change or remove. The AI already reads the request, the marked notes and files, and which questions are answered, and it never changes an answered question.` Rewrite: §6.1. Generate and Replace: `Say what the questionnaire should focus on, for example “Cover the offshore support team and payroll data”. The AI already reads the request and the marked notes and files.` |
| Textarea | Three rows, growing to eight, then scrolling. No `maxLength`, so a paste is never cut |
| Count (`--text-caption`, `tabular-nums`, not announced) | `{n} of 500 characters`, shown once the field holds text |
| Validation, on the action | Over 500: `Keep the instruction to 500 characters or fewer. It has {n}.` Server refusals: §13 Q1. The §4 Forms error treatment; focus moves to the field |

### 3.2 No lost input

- **Kept for the browser session** per person and record (questionnaire for the panel, question for a rewrite, request for Generate and Replace), in Phase 13's session draft store (13 §9.3), restored with the caption `Restored from earlier in this session.`
- **Guarded:** while the field holds unsent text, reload and close meet `beforeunload` (Phase 10's navigation guard). In-app navigation keeps the text, so no dialog.
- **Cleared** when the AI is asked successfully (the run then shows the instruction, §4.1). A refusal never clears it.

### 3.3 Where it appears

| Surface | Contract |
|---|---|
| Panel start form | §2.2 |
| Rewrite control | §6.1 |
| Hub, `Generate questionnaire` (10 §12.1, idle) | Inline in the card above the action, always visible (UI-D22) |
| Hub, the Replace dialog (10 §3.2) | After the description, inside the dialog (form size, §4 Dialogs) |
| A requesting analyst (D-32) | Not shown. §12's line instead |
| The Requestor | Never |

---

## 4. Proposal items (X-24; D-13, D-15, D-20, D-24)

### 4.1 Groups by request

Open proposals are grouped by the request that produced them, newest first. Each group is an `article` with `id="ai-run-{runId}"`, separated by a `--color-border-default` hairline and 24px.

| Part | Contract |
|---|---|
| h3 (`--text-body` at 500) | Questionnaire, with an instruction: `{name} asked the AI: “{instruction}”` (X-25 clamp). Default task: `{name} asked the AI for follow-up questions` (or `for more questions` when none was answered). Rewrite: `{name} asked the AI to rewrite a question in plain language`, or `{name} asked the AI to rewrite a question: “{instruction}”` |
| Facts (`--text-caption`, `--color-text-secondary`) | `{instant} · Provider: {providerName} · Model: {providerVersion} · {k} of {n} open` |
| Left out (X-10 figure link) | When the adjustments hold dropped proposals: `{a} left out` → toggles the list below (`aria-expanded`, `aria-controls`) |
| Unmatched sources | When sources were dropped: caption `{s} {source|sources} the AI cited couldn’t be matched, so {it isn’t|they aren’t} shown.` |
| Actions | `Show what the AI used` (ghost, small, `FileSearch`; X-13, §9.3); `Reject remaining ({k})` (outline, small, `ListX`; §5.4). Named `Show what the AI used for the request at {time}` and `Reject remaining ({k}) from the request at {time}` |
| Items | An `ol` of §4.2 cards |

**Left-out list** (`ul`, `--text-caption`, one line per adjustment, `{count} ×` prefix when aggregated):

| Code | Line |
|---|---|
| `answered-target` | `A change to an answered question. Answered questions stay as they are.` |
| `removed-target` | `A change to a question that has been removed.` |
| `unknown-target` | `A change to a question CSRM couldn’t find.` |
| `duplicate-target` | `A second proposal for the same question.` |
| `invalid-item` | `A proposal that was incomplete or too long.` |
| `near-duplicate` | `A question too close to one already asked, proposed, rejected or removed.` |
| `no-change` | `A change that left the question as it was.` |
| `definition-invalid` | `A proposal that would have made the questionnaire inconsistent.` |
| `answers-affected` | `A proposal that would have changed or hidden an answered question.` |
| `rewrite-out-of-scope` | `A rewrite that changed more than the wording.` |
| `over-limit` | `{n} more {proposal|proposals} beyond the limit of 30, or 15 new questions, per request.` |
| any other | `A proposal CSRM couldn’t use.` |

`ignored-field` is not shown (UI-D14).

### 4.2 The item card

An `li` card (X-24): `--color-bg-surface`, `--color-border-default` hairline, `--radius-lg`, 16px padding (12px compact), `id="ai-proposal-{runId}-{itemKey}"`, `tabIndex={-1}`.

| Part | Contract |
|---|---|
| Eyebrow (`.micro-label`, 12px icon) | `New question` (`Plus`), `Question change` (`PenLine`), `Plain-language rewrite` (`PenLine`; a rewrite run with no instruction), `Question removal` (`CircleMinus`) |
| Subject (`--text-body` at 500) | New: the proposed question text. Change or removal: the current question text |
| Stale badge | §4.4 |
| Content | §4.3 |
| Reason | `.micro-label` `Reason`, then the AI's rationale in `--text-body` with `whitespace-pre-wrap` |
| Sources | X-12 citations (§4.3) |
| Actions | §5 |

| Viewport | Contract |
|---|---|
| 1440 | Eyebrow and badge on one row; actions left-aligned in one row after the sources |
| 375 | Stacked; actions full width at the touch-target height, `Confirm` first |

### 4.3 Content by kind (D-13)

| Kind | Content |
|---|---|
| Change | The X-24 comparison. Rows, in order: `Question`, `Help text`, `Answer type`, `Choices`, `Required`. Values: help text with `whitespace-pre-wrap` or `None`; choices one per line in order; `Required` `Yes` or `No`. Changed rows carry the `Changed` note; unchanged rows collapse behind `Show {n} unchanged {field|fields}` |
| New | A definition list of the proposed `Question`, `Help text`, `Answer type`, `Choices`, `Required`, then `Where it goes`: `At the end of {section title}`, or `In a new section, {title}, after the last section`. With a visibility rule: `Shown when`: `“{controller text}” is “{value}”` (equals), `is not “{value}”`, `includes “{value}”` or `doesn’t include “{value}”` |
| Removal | The current values as a definition list, then `--text-body`: `Confirming removes this question from the questionnaire. Its history is kept, and Undo puts it back.` |

**Citations (X-12; UI-D15):**

| Source | Citation |
|---|---|
| A request field | `Request: {field label}`, a button opening 12 §4.2's source popover |
| A marked note | `Note: {Requestor|Security Analyst} note · {instant}`, a record link to `/app/review/requests/{id}#note-{noteId}` |
| An opted-in file | `File: {name}`, plain text (X-23 name rules) |
| An answered question | `Answered question: {question text}`, plain text; the answer is never shown here |
| The instruction | `Instruction`, plain text |
| None left after filtering | No `Sources` block; no `No source cited` badge (a question needs no citation to be valid) |

### 4.4 Changed since proposed (D-20, D-25)

Derived on every read; shown only where D-06 shows staleness (§2.4).

| Part | Contract |
|---|---|
| Badge | `Changed since proposed` (`aiReview` family `stale`: warning recipe, `History`), after the eyebrow |
| Line (`--text-caption`) | Change or removal: `This question has changed, been answered or been removed since the AI proposed this, so it can’t be confirmed. Reject it, or ask the AI again.` New: `The questionnaire has changed since the AI proposed this, so it can’t be added as proposed. Reject it, or add the question yourself.` |
| Actions | `Reject` only |

### 4.5 Comfortable and compact

| Density | Difference |
|---|---|
| Comfortable (default) | §4.2 as written |
| Compact | 12px card padding; reason and sources behind `Show reason and sources` (ghost, small, `aria-expanded`); the comparison shows changed rows only, with the unchanged toggle |

### 4.6 Decided proposals

A collapsed group after the open groups: `Show decided proposals ({n})` / `Hide decided proposals` (outline, small, `aria-expanded`, `aria-controls`; `ChevronDown` / `ChevronUp`, no transition). Up to the 50 most recent, newest first (the read's bound). Each is a compact card: eyebrow, subject, a caption `Proposed {instant} at {name}’s request`, and a decision note (X-11 note style):

| State | Note |
|---|---|
| Accepted, no edits | `Confirmed` (`Check`) `· {name} · {instant}` |
| Accepted with edits | `Edited, then confirmed` (`PenLine`) `· {name} · {instant}` |
| Rejected | `Rejected` (`X`) `· {name} · {instant}`, then `Reason: “{reason}”` when given |
| Superseded | `Replaced by a newer proposal` (`ListRestart`) `· {name} · {instant}` |
| Lapsed | `Closed without a decision: an assessment draft froze the questionnaire.` (`Lock`) |

`Undo` (ghost, small, `Undo2`), named `Undo: {subject}`, shows on confirmed items in analyst review and on rejected items until the draft (D-23). A refused `Undo` shows §13 Q2's copy.

### 4.7 The open-proposal link on question rows

In analyst review and the submitted view, a question with an open proposal shows, after its caption line, a record link `Open AI proposal` (or `{n} open AI proposals`, X-10) to its first item's anchor. The link moves focus to the card.

---

## 5. Decisions (X-14; D-21 to D-23; 12 §6)

Every decision goes through one batch Server Action on the decisions operation. It never resets an open form. The question list updates from the server's revalidated response, never optimistically (UI-D9).

### 5.1 Actions and toasts

| Action | Applies | Success toast | `Undo` sends | After `Undo` | Failure title |
|---|---|---|---|---|---|
| `Confirm` (new) | At once: the card moves to decided at the §5 pending opacity | `New question confirmed and added to {section title}.` | `restore` | `Confirmation undone. The question was taken out again.` | `Proposal not confirmed` |
| `Confirm` (change) | At once | `Question change confirmed.` | `restore` | `Confirmation undone. The question is back as it was.` | `Proposal not confirmed` |
| `Confirm` (removal) | At once | `Question removed.` | `restore` | `Confirmation undone. The question is back.` | `Proposal not confirmed` |
| `Confirm with edits` (§5.2) | Waits for the server; `Confirming…` with the inline spinner | as the kind's toast, ending `with your edits.` | `restore` | as the kind's | `Proposal not confirmed` |
| `Reject proposal` (§5.3) | At once | `Proposal rejected.` | `restore` | `Rejection undone. The proposal is open again.` | `Proposal not rejected` |
| `Reject {k} {proposal|proposals}` (§5.4) | At once | `{k} {proposal|proposals} rejected.` | `restore` for each | `Rejections undone.` | `Proposals not rejected` |
| `Undo` (decided list or toast) | At once | as "After `Undo`" | — | — | `Couldn’t undo` |

- **Rollback.** On failure, the cards return with the opacity transition at `--duration-base` (§5 Optimistic UI), then a danger toast with §13 Q2's copy and `Try again` (retryable) or `Refresh page` (blocked). `AI_PROPOSAL_STALE` and `AI_PROPOSAL_ALREADY_DECIDED` refresh the panel, so the item shows its real state.
- **Names.** Every repeated control begins with its visible label and names its subject: `Confirm: {subject}`, `Edit, then confirm: {subject}`, `Reject: {subject}`.

### 5.2 Edit, then confirm (X-5)

The card's content gives way to Phase 10's question form (10 §1.2) inside the card, prefilled with the proposal: `Question text`, `Help text` (12 §8.4), `Answer type`, `Choices`, `Section` and `New section title` (new questions only), `Required`.

| Part | Contract |
|---|---|
| Title | `Edit, then confirm` (heading one level below the card) |
| Actions | `Confirm with edits` (primary; pending `Confirming…`), `Discard edits` (outline) |
| Errors | Phase 10 §1.2's field errors and error line; server reasons §13 Q2 |
| No lost input | The form's values are kept in the session draft store per person and proposal, restored with `Restored from earlier in this session.`; `beforeunload` while it holds changes |
| One form | Phase 10's one-open-form rule applies across the editor and the panel (§2.4) |

### 5.3 Reject, with an optional reason

`Reject` opens an inline row in the card (X-5 well), focus in its field (UI-D5):

| Part | Contract |
|---|---|
| Field | `Input`, label `Reason (optional)`, hint `The AI reads this next time, so it doesn’t propose the same again.` Over 500 characters: `Keep the reason to 500 characters or fewer.` |
| Actions | `Reject proposal` (outline, small; `Enter` in the field submits), `Keep proposal` (ghost, small; `Escape` too) |

### 5.4 Reject remaining

`Reject remaining ({k})` opens the same row under the group's header: the field, then `Reject {k} {proposal|proposals}` and `Keep proposals`. One reason applies to each. Stale items are included; decided ones are not. There is no confirm-all control (UI-D6).

### 5.5 Focus

| Event | Focus |
|---|---|
| `Confirm` or a reject applies | The next open item's `Confirm` (or `Reject` when stale) in panel order; when none remains, the panel's status line |
| `Discard edits`, `Keep proposal`, `Keep proposals` | The control that opened the form or row |
| `Undo` succeeds | The reopened item's `Confirm`, or the restored question's row for an undone removal's toast |
| Rollback | Stays; the toast announces itself |

---

## 6. Rewrite in plain language (D-11)

### 6.1 The control

On each active, unanswered question row in analyst review and in the submitted view (never on an answered or removed question, never while the Requestor is answering, never for a requesting analyst): `Rewrite in plain language` (ghost, small, `SpellCheck`), named `Rewrite in plain language: {question text}`, after `Edit` and `Delete`. `data-print="hidden"`.

It opens a form (UI-D16): from 768px a `Popover` anchored to the control at the confirm dialog width; below 768px a bottom `Sheet` with a title row and `Close`.

| Part | Contract |
|---|---|
| Title | `Rewrite in plain language` |
| Field | X-25, hint `Leave it empty for plain words, one thing per question and help text for specialist terms. The answer type and choices stay the same.` Focus goes here on open |
| Actions | `Rewrite question` (primary, small; `Ctrl`/`⌘` `Enter`), `Keep as is` (ghost, small; `Escape`) |

### 6.2 On the row

| State | Row line (`--text-caption`, polite) |
|---|---|
| Queued or running | `Rewriting…` with the inline 16px spinner, in place of the control; focus moves to it (`tabIndex={-1}`) |
| Proposal ready | §4.7's link, `Open AI proposal` |
| Failed | `The rewrite didn’t finish.` and `Retry` (ghost, small), named `Retry rewrite: {question text}` |

### 6.3 Nothing to simplify

`The AI found nothing to simplify in this question.` on the row, until the next page view (UI-D17). No proposal is listed.

---

## 7. Answered questions (X-26; D-05, D-30)

### 7.1 On rows

In analyst review and in the submitted view, an answered question's caption line gains the note `Answered` (`LockKeyhole`), with the visually hidden suffix ` - the AI can’t change or remove it`. It never shows while the Requestor is answering a released questionnaire (Phase 10 D-07; the count only). The answer itself is shown only where Phase 10 already shows it (the submitted view).

### 7.2 In the panel

In the states that show them (§2.4): `{n} answered {question|questions} stay as they are` (X-10 figure link) toggles an `ul` of their texts, collapsed by default. Zero answered: not rendered.

---

## 8. Gates and the hub (D-08, D-09, D-29)

### 8.1 Release

While any proposal is open or a proposal job is active, `Release questionnaire` (10 §1.1 item 4) is not offered (UI-D19). In its place, `--text-body` / `--color-text-secondary` with `Lock`:

| Case | Line |
|---|---|
| Open proposals | `Decide the {n} open AI {proposal|proposals} before you release this questionnaire.` with `{n} open AI {proposal|proposals}` as a figure link to `#ai-proposals` |
| A job active | `The AI is preparing proposals. Decide them before you release this questionnaire.` with `Go to AI proposals` |
| Count not served (requesting analyst, D-32) | `This questionnaire has open AI proposals. Another Security Analyst decides them before release.` |

A refused release (a race) shows §13's family E addition inside the dialog.

### 8.2 Assessment draft (hub draft card, 10 §12.2)

The idle `Generate assessment draft` is replaced by the same line pattern: `Decide the {n} open AI {proposal|proposals} on the questionnaire before you generate the draft.`, the figure link going to `/app/review/questionnaires/{id}#ai-proposals`.

### 8.3 Replace questionnaire (D-09, D-12; narrows 10 §3)

| Condition | The card offers |
|---|---|
| Analyst review, unreleased, no answer, no analyst change since generation, no open proposal, no active job | `Replace questionnaire` (outline, `Sparkles`), opening Phase 10's dialog |
| Any answer | Line: `The Requestor has answered this questionnaire, so it can’t be replaced. Ask the AI for follow-up questions instead.` with `Open AI proposals` |
| An analyst change since generation | Line: `Analysts have changed this questionnaire since it was generated, so replacing it would discard their work. Use AI proposals to change it instead.` with `Open AI proposals` |
| Open proposals or an active job | Line: `This questionnaire has open AI proposals. Decide them before replacing it.` with the figure link |
| Released | Phase 10 §3.3, unchanged |

The dialog keeps its title, confirm (`Replace questionnaire`, destructive) and dismiss (`Keep this questionnaire`). Its description is always: `This generates a new questionnaire from the request and replaces this one. No analyst has changed its questions and the Requestor hasn’t answered it, so nothing is lost. The new questionnaire stays in analyst review until you release it.` Then the X-25 field. Phase 10's 1-change, n-change and unavailable-count variants are retired.

### 8.4 The hub's questionnaire card

| Part | Contract |
|---|---|
| AI proposals line (`--text-caption`), analysts other than a requesting analyst | `AI proposals: {n} open` as a figure link to the panel; `AI proposals: none open` plain |
| The signal (13 §10.2) | Gains `Suggest follow-up questions` (outline, small, `Sparkles`) when a start is allowed (D-06). It starts the default task from the hub. Otherwise a caption says why, from §2.4's guidance |
| After a start from the hub | The card shows `The AI is preparing follow-up questions.`, `Started by {name}.` when not the viewer, and `Open AI proposals`; polling and `Check again` as §2.3. Completed: `{n} AI {proposal is|proposals are} ready to review.` with `Review AI proposals`, or `The AI proposed nothing new for this questionnaire.` Failed: Q3 copy and `Retry AI proposals` |
| Generate (idle) | The X-25 field above `Generate questionnaire` (§3.3) |

---

## 9. Provenance (D-19, D-27, D-28)

### 9.1 The provenance header (12 §1)

| Addition | Contract |
|---|---|
| Line 3, questionnaire in analyst review | `{a} AI proposed · {e} edited · {c} from AI proposals · {d} added by analysts`, omitting any zero part. `c` counts `proposal-confirmed` and `proposal-edited` |
| Open-proposal line (`--text-body`), before the draft, when served and above zero | `{n} open AI {proposal|proposals}`, a figure link to `#ai-proposals` |
| The signal's action (13 §10.2) | `Suggest follow-up questions` (outline, small, `Sparkles`) when a start is allowed. It starts the default task and moves focus to the panel's job status line |

### 9.2 Question origin (12 §8.2)

| Served `aiOrigin` | Note |
|---|---|
| `proposal-confirmed` | `Confirmed AI proposal` (`Check`) |
| `proposal-edited` | `Edited AI proposal` (`PenLine`) |

The release dialog's `{n} AI-proposed` count (12 §8.5) counts generated questions only (D-27).

### 9.3 "What the AI used" (12 §2)

Opened per group from `Show what the AI used`. Description: `What CSRM sent to the AI for these proposals. Requestor text was marked as information to analyse, never as instructions, and isn’t stored with this record.` Two groups after `Run`:

| Group | Rows |
|---|---|
| `Instruction` | `Given by`: `{name}`, `Plain-language rewrite (standard wording)` or `None: the AI suggested the questions it judged still needed`. `Instruction`: the text (X-25), when given |
| `Questionnaire` | `Scope`: `Whole questionnaire` or `One question: {question text}` · `Questions offered`: `{n}` · `Answered`: `{a} (the AI couldn’t change them)` · `Answers`: `Included, because the Requestor had submitted them` or `Not included, because the Requestor hadn’t submitted them` · `Open proposals listed`: `{o}` · `Rejected proposals listed`: `{r} of {t}` · `Removed questions listed`: `{m}` |

`Notes` and `Files` (13 §10.3, 14 §7.1) apply unchanged.

---

## 10. Revision timeline (D-26, D-28; 10 §4.2)

Analyst timeline (detail depth). Each entry keeps Phase 10's label, icon, `{date}, {time} by {name}` and question line.

| Event | Label | Icon | Added lines |
|---|---|---|---|
| `ai-proposal`, questionnaire | `Proposals requested from the AI` | `Sparkles` | `Instruction: “{instruction}”`, or `Instruction: none - the AI suggested the questions it judged still needed`; `Provider: {name} · Model: {version}`; `Result: {n} {proposal|proposals}` or `Result: nothing proposed`; `Show in AI proposals` (record link to `#ai-run-{runId}`) while the panel lists that group |
| `ai-proposal`, question | `Plain-language rewrite requested from the AI` | `Sparkles` | `Question: {text}`; `Instruction:` as above, or `Instruction: Rewrite in plain language (standard wording)`; provider, result and link as above |
| `question-added`, `-edited`, `-deleted` from a confirmation | unchanged | unchanged | `Source: AI proposal, confirmed` or `Source: AI proposal, edited before confirming`; `Show proposal` (record link to the item) while listed |
| The same kinds from an `Undo` | unchanged | unchanged | `Source: undo of a confirmed AI proposal` |
| `question-restored` | `Question restored` | `ArchiveRestore` | Question line; `Source: undo of a confirmed AI proposal` |
| `regenerated` with an instruction | unchanged (10 §3.4) | unchanged | `Instruction: “{instruction}”` |

Instruction lines use the X-25 display rule. The Requestor's history (10 §4.3) is unchanged: the server projection drops every AI kind and key (D-26).

---

## 11. The Requestor (D-07, D-25)

### 11.1 Unchanged surfaces

No proposal, instruction, run, AI event, `Answered` note or rewrite appears anywhere in the Requestor's tree. New questions appear after release with Phase 10's per-round summary and Phase 12's disclosure.

### 11.2 A save or submit after a return to analyst review

Families C and D's `QUESTIONNAIRE_NOT_ANSWERABLE` copy becomes (UI-D25):

| Where | Copy |
|---|---|
| Save status (X-1, blocked) | `A Security Analyst has taken this questionnaire back to update it, so your latest answers weren’t saved. They’re kept on this page, and you can carry on when it’s sent back to you.` |
| Submit dialog | `A Security Analyst has taken this questionnaire back to update it, so it can’t be submitted now. Your answers are kept, and you can submit when it’s sent back to you.` |

- Autosave stops; the form stays as typed. Unsaved answers are kept in the session draft store per person and questionnaire, and `beforeunload` guards reload and close.
- When the questionnaire is next released, a kept answer is restored only into a question with the same key that is still active, has the same answer type and choices, and holds no saved answer. A caption above the questions says `{n} unsaved {answer was|answers were} restored from earlier in this session. Check {it|them} before you carry on.` Anything else is discarded silently, because the question changed.

---

## 12. The requesting analyst (G-1, D-32)

On a request they raised, a Security Analyst sees:

| Surface | Contract |
|---|---|
| Panel | Heading, then one line with `Lock`: `You raised this request, so another Security Analyst handles the AI for it.` No start form, items, answered list or job |
| Rows | No `Rewrite in plain language`; no open-proposal link |
| Header and hub | No open-proposal line or AI proposals line; no `Suggest follow-up questions` |
| Generate and Replace | No instruction field. Caption under the action: `You raised this request, so you can generate without an instruction. Another Security Analyst can give the AI one.` |
| Release | §8.1's third line |

---

## 13. Refusal copy (new family Q; additions to C, D, E, I, J and 10 §12.4)

### Q1. Ask the AI (start, rewrite, Generate or Replace with an instruction)

| Reason | Copy | Kind |
|---|---|---|
| `INSTRUCTION_TOO_LONG` | `Keep the instruction to 500 characters or fewer. It has {n}.` | field |
| `INSTRUCTION_CHARACTERS_NOT_ALLOWED` | `The instruction contains hidden formatting characters CSRM can’t send. Type it again, or paste it as plain text.` | field |
| `INSTRUCTION_REPEATS_REQUESTOR_TEXT` | `The instruction repeats a long passage of the Requestor’s own words. The AI already reads the request and the marked notes and files, so say what to focus on in your own words.` | field |
| `QUESTIONNAIRE_NOT_SUBMITTED` | `The Requestor is still answering this questionnaire. Wait for them to submit it, or return it to analyst review.` | blocked |
| `ASSESSMENT_STARTED` | `An assessment has been drafted from this questionnaire, so its questions can no longer change.` | blocked |
| `ASSESSMENT_DRAFT_IN_PROGRESS` | `An assessment draft is being generated, so this questionnaire can’t change.` | blocked |
| `QUESTION_ANSWERED` | `This question has been answered, so the AI can’t rewrite it. Refresh the page to see it.` | blocked |
| `QUESTION_REMOVED` | `This question has been removed. Refresh the page to see the current list.` | blocked |
| `AI_PROPOSAL_RUN_LIMIT` | `This questionnaire has reached the most AI requests it can keep, so the AI can’t be asked again. Contact your administrator.` | blocked |
| `AI_CLASSIFICATION_ABOVE_CEILING`, `AI_POLICY_NOT_CONFIGURED` | 12 §11.1's descriptions | blocked |
| `CONTEXT_TOO_LARGE` | `This questionnaire and its request hold more than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.` | blocked |
| `HISTORY_UNAVAILABLE` | `This questionnaire’s change history can’t record more changes, so the AI can’t be asked. Contact your administrator.` | blocked |
| `OWN_REQUEST` (403) | `A Security Analyst can’t steer the AI on a request they raised. Another Security Analyst handles it.` | blocked |
| 403 | `You can’t ask the AI for proposals on this questionnaire.` | blocked |
| 404 | Phase 10's locked questionnaire refusal | blocked |
| 409, none or unknown | `The AI can’t be asked in this questionnaire’s current state.` | blocked |
| Network, timeout or 5xx | `We couldn’t ask the AI. Try again.` | retryable |

### Q2. Decide (confirm, reject, undo)

| Reason | Copy | Kind |
|---|---|---|
| `QUESTIONNAIRE_RELEASED` | `This questionnaire has been released. Return it to analyst review before you confirm proposals.` | blocked |
| `AI_PROPOSAL_STALE` | `This question has changed since the AI proposed this, so it can’t be confirmed. Reject it, or ask the AI again.` | blocked |
| `AI_PROPOSAL_ALREADY_DECIDED` | `This proposal is no longer open. Refresh the page to see where it stands.` (UI-D29; replaces family J's copy too) | blocked |
| `AI_PROPOSAL_UNDO_UNAVAILABLE`, confirmation | `This question has changed since the proposal was confirmed, so it can’t be undone here. Change it in the question editor instead.` | blocked |
| `AI_PROPOSAL_UNDO_UNAVAILABLE`, rejection | `This proposal can no longer be reopened, because the questionnaire has moved on.` | blocked |
| `ANSWERED_QUESTION_AFFECTED` | `Confirming this would change or hide an answered question, so it wasn’t applied. Reject it, or edit it so answered questions stay as they are.` | blocked |
| `DEFINITION_INVALID` | `Confirming this would make the questionnaire inconsistent, so it wasn’t applied. Edit it before confirming, or reject it.` | blocked |
| `QUESTION_HAS_DEPENDENTS`, `LAST_ACTIVE_QUESTION` | Family H's copy | blocked |
| `ASSESSMENT_STARTED`, `ASSESSMENT_DRAFT_IN_PROGRESS`, `OWN_REQUEST` | Q1's copy | blocked |
| `HISTORY_UNAVAILABLE` | `This questionnaire’s change history can’t record more changes, so your decision wasn’t recorded. Contact your administrator.` | blocked |
| 400, edits invalid | Phase 10 §1.2's field errors in the form | field |
| 400, unknown proposal | `This proposal is no longer on the questionnaire. Refresh the page to see the current proposals.` | blocked |
| 403 | `You can’t decide AI proposals on this questionnaire.` | blocked |
| 404 | `These proposals couldn’t be found. Refresh the page.` | blocked |
| 409, none or unknown | `Your decision can’t be recorded in this questionnaire’s current state.` | blocked |
| Network, timeout or 5xx | `We couldn’t record your decision. Try again.` | retryable |

### Q3. Job failure codes (panel, row and hub)

| `failureCode` | Copy |
|---|---|
| `PROVIDER_OUTPUT_INVALID` | `The AI’s reply couldn’t be read, so nothing was proposed. Try again.` |
| Interrupted by a restart | `The AI request stopped when CSRM restarted, so nothing was proposed. Try again.` |
| `QUESTIONNAIRE_NOT_SUBMITTED`, `QUESTIONNAIRE_RELEASED` | `The questionnaire changed before the AI started, so nothing was sent. Refresh the page to see where it stands.` |
| `ASSESSMENT_STARTED`, `ASSESSMENT_DRAFT_IN_PROGRESS` | `An assessment draft was started, so the questionnaire can no longer change and nothing was sent.` |
| `QUESTION_ANSWERED`, `QUESTION_REMOVED` | `The question was answered or removed before the AI started, so nothing was sent.` |
| `AI_PROPOSAL_RUN_LIMIT`, `HISTORY_UNAVAILABLE` | Q1's copy |
| `CONTEXT_TOO_LARGE` | The rule of the amendment of 2026-10-11 below (§13, "CONTEXT_TOO_LARGE on job surfaces"); its case (c) is Q1's copy |
| `AI_CLASSIFICATION_ABOVE_CEILING`, `AI_POLICY_NOT_CONFIGURED` | 12 §11.2 |
| any other | the server's `failureMessage` |

### Additions to existing families

| Family | Reason | Copy |
|---|---|---|
| C, D (Requestor) | `QUESTIONNAIRE_NOT_ANSWERABLE` | §11.2 |
| E (release) | `AI_PROPOSALS_OPEN` | `This questionnaire has open AI proposals. Decide them before you release it.` with `Go to AI proposals` |
| I (generate or replace) | `AI_PROPOSALS_OPEN` | `This questionnaire has open AI proposals, so it can’t be replaced. Decide them first.` |
| I | `QUESTIONNAIRE_HAS_ANALYST_CHANGES` | §8.3's analyst-change line |
| I | `QUESTIONNAIRE_ANSWERED` | §8.3's answered line |
| I | the instruction reasons, `OWN_REQUEST` with an instruction | Q1; `OWN_REQUEST`: `A Security Analyst can’t give the AI an instruction on a request they raised. Generate without one, or ask another Security Analyst.` |
| J | `AI_PROPOSAL_ALREADY_DECIDED` | Q2's neutral copy (UI-D29) |
| Draft card refusal | `AI_PROPOSALS_OPEN` | `The questionnaire has open AI proposals. Decide them before you generate the draft.` with the link |
| 10 §12.4 (questionnaire job) | `AI_PROPOSALS_OPEN` | `AI proposals were opened before the replacement finished, so the questionnaire wasn’t replaced.` |
| 10 §12.4 | `QUESTIONNAIRE_HAS_ANALYST_CHANGES` | `An analyst changed the questionnaire before the replacement finished, so it wasn’t replaced.` |
| Draft job failure | `AI_PROPOSALS_OPEN` | `AI proposals were opened on the questionnaire before the draft finished, so no draft was made. Decide them, then generate the draft again.` |

### Amendment (2026-10-11, fresh plan check): CONTEXT_TOO_LARGE on job surfaces (D-29, carried from Phase 13; Phase 14 D-33)

*Amended on 2026-10-11 in the fresh plan check (`15-PLAN-CHECK.md` iteration 2, findings D-29 and S-3), before any Phase 15 task implements it.* No contract change: the job reads already serve `failureCode`, `failureMessage` and, since Phase 14, `failureAttachments`.

**The served sentence is CSRM-built.** For `CONTEXT_TOO_LARGE`, Strapi's `failureMessage` comes from `contextTooLargeMessage` (`apps/backend/src/csrm/ai/assessment-context.ts`): CSRM's own words built from counts and note sequence numbers only, never provider text and never a note's author or text, at most 255 characters, for example `The AI context is too large. 2 notes are marked as changing the AI inputs (notes 2 and 5) and 1 file is included in them; unmark or exclude some and try again.` Only its forms that name marked notes contain the phrase `marked as changing the AI inputs`; its files-only forms and its plain form (`The request is too large for this operation.`) do not.

**One rule on every job surface.** A failed job with `failureCode` `CONTEXT_TOO_LARGE` reads by this rule on the hub's questionnaire generation card, the hub's assessment draft card, the AI proposals panel's job state (§2.3, including a failed rewrite listed there) and the hub card's proposal job (§8.4). The row's own rewrite line (§6.2) is unchanged.

| Case | The failed job's body |
|---|---|
| (a) The served `failureMessage` contains `marked as changing the AI inputs` | The served message as the sentence, as plain text. Then, when `failureAttachments` names files, 14 §7.2's list (`Files included in the AI inputs`, each file a record link) without 14 §7.2's own sentence |
| (b) No notes named, and `failureAttachments` names files | 14 §7.2 unchanged: its sentence, then its list |
| (c) Otherwise | The existing administrator sentence: 12 §11.2's on the hub's two cards, and Q1's `CONTEXT_TOO_LARGE` sentence on Phase 15's surfaces |

A served message that names no marked note is never shown for this code. The phrase test is one exported, zod-free and server-safe predicate beside 14-16's files list (`context-too-large-files.tsx`), and one rendering serves all four surfaces. Q3's `CONTEXT_TOO_LARGE` row points here. Owners: 15-04 (the Strapi assertion that only the notes forms carry the phrase), 15-10 (the predicate and the rendering), 15-11 (the panel's job state) and 15-13 (the hub's two cards and its proposal job).

---

## 14. Five-state contract

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| Panel | Frame with the page; skeleton after 300ms for the form and lists | §2.5 first-use and cleared | `We couldn’t load the AI proposals` · `Try again` | §12's line; nothing for the Requestor | Five questionnaire states, form-open state, density |
| Start form and job | `Asking the AI…`; job states | — | Q1 under the field; Q3 alert with `Retry AI proposals` | not rendered without a start | Queued, running, timed out, completed, nothing proposed, failed |
| Items | With the panel | — | Rollback and Q2 toast | Actions per state (§2.4) | New, change, rewrite, removal, stale, compact, decided states, left-out list |
| Edit, then confirm | — | — | Field errors, Q2 line | — | Prefilled, restored |
| Rewrite control | `Rewriting…` | Nothing to simplify (§6.3) | `The rewrite didn’t finish.` · `Retry` | Not on answered, removed or requesting-analyst rows | Ready link |
| Answered note and list | With the page | List absent at zero | — | Not while the Requestor answers | Note, list |
| Gates and hub | With the page | `AI proposals: none open` | Release shows normally when the read fails | Requesting analyst lines | Release line, draft line, Replace lines, hub job |
| Timeline | Phase 10 unchanged | unchanged | unchanged | Requestor projection | Five new entry variants |
| Requestor refused save | — | — | §11.2 | — | Kept, restored caption |

---

## 15. The premium experience bar (G-4), item by item

| G-4 item | Phase 15 contract |
|---|---|
| A keyboard path for every primary action | Every action is a button or link in DOM order; `Ctrl`/`⌘` `Enter` asks the AI and submits the rewrite; `Enter` submits a reject reason and `Escape` keeps the proposal; focus moves to the next `Confirm` (§5.5); `Undo` by `Alt+T` (X-14) |
| Optimistic feedback that rolls back on error | `Confirm`, `Reject`, `Reject remaining` and `Undo` apply at once and roll back (§5.1). `Confirm with edits` waits, because it validates a form. The question list follows the server (UI-D9) |
| Skeletons while loading | The panel's on-demand parts; spinners only inline (`Asking the AI…`, `Rewriting…`, `Confirming…`) |
| Undo for reversible acts; confirmation for governance steps | Every decision carries `Undo` and no dialog (D-35). Release keeps its confirmation; Replace keeps its destructive confirmation |
| Empty states that say what to do next | `No AI proposals yet` with an example instruction; guidance lines name the next step (return to analyst review, wait for submission); gate lines link to the panel |
| No lost input | Instruction, reject reason and "Edit, then confirm" values kept for the session and guarded (§3.2, §5.2); refusals never clear a field; the Requestor's unsaved answers kept and safely restored (§11.2) |
| Comfortable and compact density | The panel's density control, persisted per person (§4.5) |
| Motion from the direction | Motion section; reduced motion honoured |
| Purpose-built phone layouts | Stacked comparison (current above proposed), full-width card actions with `Confirm` first, bottom-sheet rewrite form, full-screen "What the AI used" |
| Every figure opens its records | Header and hub open counts, release and draft gate counts, the answered count, `{a} left out`, the per-row open-proposal link, timeline `Show in AI proposals` and `Show proposal` |

---

## 16. Test assertions this contract changes

Each plan greps its strings before editing and changes assertions deliberately, in the same plan as the behaviour. Phases 10 to 14 edit several of these files first.

| # | File | Asserts today (or after Phases 10 to 14) | Change |
|---|---|---|---|
| E1 | New `e2e/questionnaire-ai-proposals.spec.ts` | — | D-36's journey at 375 and 1440 with axe, using this contract's strings: `Suggest follow-up questions`, the offshore group, `{a} left out` with the answered-target line, `Return to analyst review`, `Confirm`, `Edit, then confirm` → `Confirm with edits`, `Reject` with a reason and `Undo`, `Rewrite in plain language`, the release line then `Release questionnaire`, the timeline's `Proposals requested from the AI` with instruction, time, analyst and provider; the Secondary Requestor's refusal; the requesting analyst's §12 lines |
| E2 | `e2e/questionnaire-generation-workflow.spec.ts` | Phase 10's Replace dialog variants | The narrowed Replace (§8.3) and its lines; the instruction field on Generate and in the dialog |
| U1 | `features/questionnaires/questionnaire-governance.test.tsx` | Release button; 12 §8.2 markers | §8.1 lines; `Answered` note; rewrite control presence rules; confirmed-origin notes; the open-proposal link |
| U2 | `features/questionnaires/questionnaire-revision-timeline.test.tsx` | Six (seven with `regenerated`) kinds | §10's entries; nothing AI in the Requestor variant |
| U3 | `features/assessments/questionnaire-generation-job.test.tsx` | Generate and Replace per 10 §3, §12 | Instruction field; narrowed Replace; AI proposals line; signal action and hub job |
| U4 | `features/questionnaires/questionnaire-workflow.test.tsx` | Family C and D copy | §11.2 copy, kept and restored answers |
| U5 | Refusal copy tests (`refusal-copy.ts`) | Families A to P | Family Q; the additions; family J's reworded `AI_PROPOSAL_ALREADY_DECIDED` |
| U6 | Phase 12's run sheet tests | Groups to `Files` | `Instruction` and `Questionnaire` groups |
| U7 | `components/csrm/status-badge.test.tsx` | `aiReview` with two values | `stale` |
| New | `features/questionnaire-ai/*.test.ts(x)`, `features/ai-assistance/field-comparison*.test.ts(x)` | — | Verification contract |

`accessibility.spec.ts`, `performance.spec.ts` and `design-contract.spec.ts` stay green. Phase 10's copy guard gains `features/questionnaire-ai`, and a unit test asserts no visible string in it contains `Accept`, `Approve` or `Dismiss`.

---

## Copywriting contract

| Element | Copy |
|---|---|
| Primary CTA | `Suggest follow-up questions` (`Suggest more questions` before any answer; `Ask the AI` while the field holds text); `Rewrite question`; `Confirm with edits` |
| Other calls to action | `Confirm`, `Edit, then confirm`, `Reject`, `Reject proposal`, `Keep proposal`, `Reject remaining ({k})`, `Reject {k} {proposal|proposals}`, `Keep proposals`, `Discard edits`, `Undo`, `Rewrite in plain language`, `Keep as is`, `Retry AI proposals`, `Retry`, `Check again`, `Show what the AI used`, `Show decided proposals ({n})` / `Hide decided proposals`, `Show {n} unchanged {field|fields}`, `Show reason and sources`, `Open AI proposals`, `Review AI proposals`, `Go to AI proposals`, `Show in AI proposals`, `Show proposal`, `Return to analyst review` |
| Headings and labels | `AI proposals`; `Instruction for the AI (optional)`; `Reason (optional)`; `Current`, `Proposed`; `Reason`, `Sources`; eyebrows `New question`, `Question change`, `Plain-language rewrite`, `Question removal`; `Decided proposals`; `Changed since proposed`; notes `Answered`, `Changed`, `Confirmed`, `Edited, then confirmed`, `Rejected`, `Replaced by a newer proposal`, `Confirmed AI proposal`, `Edited AI proposal` |
| Empty state heading | `No AI proposals yet`; `No open AI proposals` (cleared) |
| Empty state body | `Ask the AI for follow-up questions, or give it an instruction such as “Add questions about the offshore support team”.`; `Every proposal has been decided. They’re listed under Decided proposals.` |
| Error states | `We couldn’t load the AI proposals` · `Try again`; `The AI request didn’t finish` with Q3; `The rewrite didn’t finish.` · `Retry`; families Q1 to Q3 and the additions, each saying what happened and what to do |
| Permission states | §12's lines; Q1 and Q2's 403 copy |
| Toasts | §5.1, word for word |
| Destructive confirmation | None added. Decisions are reversible with `Undo`. Phase 10's Replace dialog (`Replace questionnaire`, destructive) keeps its confirmation with §8.3's single description |
| AI output | Proposals are "proposed" and "suggested". The analyst confirms, edits or rejects them; nothing reaches the Requestor until a Security Analyst releases the questionnaire |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 Info and relationships | The panel is a headed region; groups are `article`s headed by h3; items are an `ol`; the comparison is a `table` with a visually hidden caption `Proposed change to {question text}`, column headers and row headers (from 768px), and labelled pairs below; definition lists for new and removed questions |
| 1.4.1 Use of colour | `Changed since proposed` is icon plus words; `Changed` is a word note; inserted and removed words (X-24, unused here) carry `ins`/`del` and weight or line-through |
| 2.1.1 Keyboard | §15 first row |
| 2.2.1 Timing adjustable | Undo toasts pause on hover and focus; `Undo` stays on decided items while the server allows it (§4.6) |
| 2.4.3 Focus order | §5.5, §6.2, §9.1; focus returns to the opener on every dismiss |
| 2.4.6 Headings | h1 page, h2 `AI proposals`, h3 per group, the "Edit, then confirm" title one level below |
| 2.5.3 Label in name | `Confirm: {subject}`, `Edit, then confirm: {subject}`, `Reject: {subject}`, `Undo: {subject}`, `Rewrite in plain language: {question text}`, `Retry rewrite: {question text}`, the group action names, each beginning with its visible label |
| 2.5.8 Target size | Card actions meet 24px in compact density and the touch-target height below 768px |
| 3.3.1, 3.3.3 Errors | Every refusal says what is wrong and how to fix it, beside its field or in the toast |
| 4.1.2 Name, role, value | `aria-expanded` and `aria-controls` on every toggle; the rewrite trigger `aria-haspopup="dialog"`; the density control is a named radio group |
| 4.1.3 Status messages | The job status live region (one announcement per state); toasts (polite; danger once); the rewrite row line |
| 1.4.10 Reflow | No horizontal page scroll from 320 to 1440; the comparison stacks below 768px |
| Automated | Zero serious or critical axe violations at 375 and 1440 on the panel in each §2.4 state, an item in "Edit, then confirm", the reject row, the rewrite popover and sheet, the decided group open, the hub card with a job, the timeline, and the Requestor's refused save |

---

## Spacing

The §3.9 scale applies unchanged; this phase adds no spacing value.

| §3.9 step | Use in this phase |
|---|---|
| 4px | Icon-to-text gaps in eyebrows, notes and badges |
| 8px | Between a card's actions; between the label, its field and its count |
| 12px | Card padding in compact density |
| 16px | Card padding; comparison cell padding (DataTable cell padding); between a card's blocks |
| 24px | Between groups; between the panel's blocks |
| 32px | Between the panel and the governance card (§3.9 section rhythm) |

Existing primitives keep their shipped spacing (`Popover`, `Sheet`, toasts, `DetailSection`, the X-5 well). Exceptions: none.

---

## Typography

The §3.10 scale applies unchanged; this phase adds no size, weight or family.

| Emphasis level | Token | Weight | Phase 15 use |
|---|---|---|---|
| 1. Panel title | `--text-heading-sm` | its own heading weight | `AI proposals`; empty-state headlines; the rewrite popover's title |
| 2. Body | `--text-body` | 400; 500 for group headings, subjects, status lines and field labels | Descriptions, comparison values, reasons, guidance lines |
| 3. Caption | `--text-caption` | 400; 500 for badges | Facts lines, hints, counts, notes, left-out lines, row lines |
| 4. Micro-label | `--text-micro` | 400 | Eyebrows, `Current`, `Proposed`, `Reason`, `Sources` |

Buttons keep `--text-button`. The checker's two-weight heuristic is superseded by the adopted scale (ADR 0001 gap 8), as in Phases 06.5 to 14. `tabular-nums` on every count.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas, panel, item cards, popover, sheets |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-border-strong`, `--color-text-secondary` | X-5 wells, hairlines, field boundaries, captions and notes |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--focus-ring` | Only as listed below |
| Status (§3.5) | warning (`Changed since proposed`); danger (job failure alert, rollback toasts, field errors) | Always with an icon and words |
| Destructive | `--color-danger-solid` | Phase 10's `Replace questionnaire` confirm only (unchanged) |

Ink is reserved for: the primary buttons `Suggest follow-up questions` / `Suggest more questions` / `Ask the AI`, `Rewrite question` and `Confirm with edits`; record and figure links (open counts, citations to notes, timeline links, `Open AI proposal`); the density control's checked segment; focus rings. `Confirm`, `Reject remaining`, `Reject proposal`, `Retry AI proposals`, `Check again`, `Return to analyst review` and toggles are outline; `Edit, then confirm`, `Reject`, `Keep proposal`, `Keep as is`, `Undo`, `Rewrite in plain language` and `Show what the AI used` are ghost. No new hue; AI has no colour of its own.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Optimistic pending (decisions, Undo) | The §5 Optimistic UI pending opacity, applied without a transition |
| Rollback | Opacity at `--duration-base`, `--ease-standard` |
| Cards leaving the open list, new cards arriving | None: rendered in place (§6 do-not 8) |
| Toggles (decided, unchanged fields, left out, answered, reason and sources) | None: in place |
| Rewrite popover; bottom sheet; "What the AI used" | §5 "Dropdown / popover / menu"; §5 "Drawer / side panel", fade only under reduced motion |
| Toasts | §5 "Dialog / toast" |
| Inline spinners; skeleton shimmer | Static under reduced motion |

Jobs poll as Phase 10's do, with a visible `Check again` after the timeout; nothing else refreshes on its own. Reduced motion needs no rule beyond the global one.

---

## Proposed CSRM extensions

For the orchestrator to accept, and a Phase 15 plan task (research: 15-12) to record in `docs/design/csrm-design-direction.md` before the implementing tasks run. None introduces a value; each names a pattern over existing tokens. Numbering continues after Phase 14's X-23 (UI-D30).

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-24 | §4, new "AI proposal items" entry, after "AI provenance" | Proposal cards, groups, decisions and the before-and-after comparison | "**AI proposal items (CSRM extension, 2026-10-01).** Changes the AI proposes to a record's content, one item per addition, change or removal, are reviewed in a section headed `AI proposals`, grouped by the request that produced them, newest first. A group opens with an h3 naming who asked the AI and the instruction in typographic quotes (AI instruction field), a `--text-caption` facts line with when (Dates and times), the provider and model and how many remain open, a `{n} left out` figure link that opens a plain-language list of what CSRM did not keep and why, `Show what the AI used` as a ghost small pill opening the Side sheet, and `Reject remaining ({n})` as an outline small pill; there is no confirm-all control. Each item is a card on `--color-bg-surface` with a 1px `--color-border-default` boundary, `--radius-lg` and 16px padding: a `--text-micro` eyebrow with a 12px icon naming the kind (`Plus` for an addition, `PenLine` for a change, `CircleMinus` for a removal), the item's subject in `--text-body` at 500, its content, the AI's reason under a `Reason` micro-label, and its Source citations. A change shows a before-and-after comparison: from 768px a table with row headers naming the fields and two columns, `Current` and `Proposed`, with the DataTable's cell padding and hairlines; below 768px each field stacks its current value above its proposed value under `Current` and `Proposed` micro-labels. A changed field carries the provenance note `Changed` (`PenLine`) in its row header, never colour alone; unchanged fields collapse behind an outline small `Show {n} unchanged {field|fields}` toggle. Values render as they do elsewhere, so a rating stays its badge; where changed words are emphasised, inserted words are an `ins` at weight 500 on `--color-bg-inset` and removed words a `del` with a line-through in `--color-text-secondary`. An addition shows its proposed values and where it will go; a removal shows the current values and what confirming does. An open item offers `Confirm` (outline small, `Check`), `Edit, then confirm` (ghost small, `PenLine`), which opens the In-place edit form inside the card prefilled with the proposal and waits for the server, and `Reject` (ghost small, `X`), which opens an inline optional reason that `Enter` submits and `Escape` dismisses; the visible word is never `Accept`. `Confirm` and `Reject` apply at once, confirm with an Undo toast and move focus to the next item's `Confirm`; on phones the actions stack at full width and the touch-target height, `Confirm` first. An item whose basis has changed carries the status badge `Changed since proposed` (warning recipe, `History`) with a line saying what to do, and offers only `Reject`. Decided items leave the open list for a collapsed `Decided proposals` group behind an outline toggle with its count, each with a provenance note naming the decision, who and when (`Confirmed`, `Edited, then confirmed`, `Rejected` with its quoted reason, `Replaced by a newer proposal`, `Closed without a decision`) and `Undo` while the server allows it. The section offers comfortable and compact densities, persisted per person as the DataTable's is; compact uses 12px card padding and collapses each card's reason and sources behind `Show reason and sources`. Where a record cannot take a decision now, one line says why once for the section, never a disabled control per item." | D-33 and D-34 ask for one item card and comparison shared with Phase 16's field comparison (D-46) and reused by Phases 17 and 17.2; the direction has no proposal review pattern beyond Phase 12's per-field markers. |
| X-25 | §4 Forms, new "AI instruction field" entry | The optional instruction and how it is shown | "**AI instruction field (CSRM extension, 2026-10-01).** An instruction a Security Analyst gives the AI is an optional labelled textarea, `Instruction for the AI (optional)`, three rows growing to eight and then scrolling, with a hint that says what the AI already reads and gives an example in typographic quotes, and, once it holds text, a `--text-caption` / `--color-text-secondary` count `{n} of 500 characters` with `tabular-nums` that is not announced. It is checked when its action is pressed; an error shows under the field (Forms) and the text is never cleared by a refusal. Its action is the button that asks the AI, with the keyboard shortcut hint `Ctrl` or `⌘` with `Enter` from 768px. Unsent text is kept for the browser session per person and record, restored with `Restored from earlier in this session.`, guards reload and close, and clears once the AI has been asked. Wherever an instruction is shown afterwards, it is plain text in typographic quotes with line breaks kept, labelled `Instruction`, clamped to three lines with a `Show full instruction` toggle; with none, the line says what the AI did instead. A Requestor never sees an instruction, and a Security Analyst who may not give one sees a line saying why in place of the field." | D-17 to D-19 and D-34 ask for one instruction field across Phases 15, 16 and 17; the direction has textareas but no bounded, session-kept, displayed-afterwards instruction. |
| X-26 | §4 Status & risk badges, after "AI proposal items" | The answered (fixed) question note | "**Answered question note (CSRM extension, 2026-10-01).** Where a Security Analyst may know that a question is answered but the AI may not change it, the question carries the provenance note `Answered` (`LockKeyhole`), with a visually hidden ` - the AI can’t change or remove it`; it reveals that an answer exists, never the answer or whether it is a draft. It is shown only where answered questions are fixed and the analyst may know of them, and never while the Requestor is still answering a released questionnaire, where only the count of answered questions is shown. A section reviewing AI proposals lists the answered questions behind a `{n} answered {question|questions} stay as they are` figure link, collapsed by default, and offers no AI rewrite on them." | D-05 and D-30 widen Phase 10 D-07 only to this marker; it needs a recorded form that cannot be confused with an answer or a status. |

---

## Decisions recorded

Made without asking, as this phase's discussion and UI contract run in auto mode. Each follows the locked context, `AGENTS.md`, the glossary and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | Visible verbs are `Confirm`, `Edit, then confirm`, `Reject` and `Undo`; states `Confirmed`, `Edited, then confirmed`, `Rejected`. Never `Accept`, `Approve` or `Dismiss`. | The glossary's "Confirm (AI proposal)": Accept is the risk owner's; a proposed change is rejected, a suggestion dismissed. |
| UI-D2 | The panel sits directly after the provenance header in every state before the draft, as h2 `AI proposals` with the anchor `#ai-proposals`. | Open proposals gate release, so they come before the editor and its release control; one stable place for every link. |
| UI-D3 | The start action reads `Suggest more questions` before any answer, `Suggest follow-up questions` after, and `Ask the AI` while the field holds text. | D-10 offers the two default labels; with an instruction such as "drop the logging question", "suggest" would misdescribe the request. |
| UI-D4 | The instruction is always visible and optional, cleared after a successful start, kept otherwise. | UAT-017 complained of no input; the run, timeline and sheet show it afterwards, so leaving it would invite repeats. |
| UI-D5 | `Reject` opens an inline optional reason that `Enter` submits. | Reasons feed the next run (D-14) and the yardstick rejects with a reason; one keystroke keeps a reasonless reject fast, and no dialog is used (D-35). |
| UI-D6 | No confirm-all; `Reject remaining` only. | D-33 and the deferred idea: each question is reviewed on its own (QUES-11 criterion 2). |
| UI-D7 | `Confirm` and `Reject` are optimistic; `Confirm with edits` waits. | Known-result toggles are optimistic (§5); an edited proposal validates like a form. |
| UI-D8 | Focus moves to the next open item's `Confirm`, else the status line. | Phase 12 UI-D7's keyboard review path. |
| UI-D9 | The question list follows the server's response, never an optimistic copy. | Placement and keys are computed at confirmation (D-13, D-22); a guessed position would jump. |
| UI-D10 | While a question form is open, `Confirm`, `Edit, then confirm` and the AI's start are disabled with one line; `Reject` stays. | Phase 10's one-open-form rule (10 §1.1, UI-D3 there) avoids conflicting changes; rejecting changes no question. |
| UI-D11 | Staleness is a warning badge with one line per kind and `Reject` only. | Tone vocabulary: work waiting on a Security Analyst. The read serves a boolean, so copy names the possible causes. |
| UI-D12 | While the Requestor is answering, items are read-only with `Reject` only, without staleness or the answered list. | D-06: staleness would reveal draft answers (Phase 10 D-07). |
| UI-D13 | On a submitted questionnaire one line explains that confirming needs a return to analyst review, beside the return action. | X-15's "why in words, never a disabled control", said once, not per item (14 UI-D21's posture). |
| UI-D14 | `{a} left out` lists dropped proposals in plain words; unmatched sources are a caption; ignored fields are not shown. | D-15 shows adjustments; X-10 needs the list to equal its figure; an ignored field changes nothing the analyst decides. |
| UI-D15 | Request-field citations open 12 §4.2's source; note citations link to the note; answered questions, files and the instruction are plain. | An answer cited at submission may since be a private draft (D-30); notes have their own place. |
| UI-D16 | `Rewrite in plain language` opens a small form with an optional instruction, focus in the field. | D-11 allows an instruction; one control on a crowded row; `Ctrl`/`⌘` `Enter` keeps the common path quick. |
| UI-D17 | A no-change rewrite says so on the row until the next view and lists nothing. | D-11's "the panel says the AI found nothing to simplify", placed where the analyst asked. |
| UI-D18 | `Answered` shows in analyst review and the submitted view; the panel lists answered questions behind a count. | D-06 and D-30: the analyst must see what the AI may not change. |
| UI-D19 | Release and draft generation are replaced by a line linking to the panel while proposals are open or a job runs. | UX-06 and X-15: offer nothing the server will refuse; the line names the remedy. |
| UI-D20 | The hub shows the open count, and the signal's `Suggest follow-up questions` starts the default task from the hub with its job in the card. | D-29 attaches the action wherever the signal shows. |
| UI-D21 | Replace shows only when allowed; otherwise one line with the reason and a link to the proposals. | D-09; its dialog always says nothing is lost, so the count variants retire. |
| UI-D22 | The instruction field is inline on Generate and inside the Replace dialog. | D-12 and UAT-017; inline keeps it discoverable on the first generation. |
| UI-D23 | Timeline labels are `Proposals requested from the AI` and `Plain-language rewrite requested from the AI`, with instruction, provider and result lines; confirmed changes carry a `Source` line. | Success criterion 3; D-28 links each entry to its proposal. |
| UI-D24 | Question origin notes read `Confirmed AI proposal` and `Edited AI proposal`. | D-27's new origins, distinct from Phase 12's `AI proposed` and `Edited`. |
| UI-D25 | The Requestor's refused save keeps typed answers on the page and for the session, restored only into unchanged, empty questions. | D-25's "keeps the typed answers" and G-4; restoring into a changed question could misstate an answer. |
| UI-D26 | A requesting analyst sees one line in place of every AI-steering control, and can generate without an instruction. | D-32; X-15's rule. |
| UI-D27 | Comfortable and compact densities, persisted per person in the browser like the DataTable's. | G-4 density on a list that can hold 30 items per request. |
| UI-D28 | Decided proposals are one collapsed group, newest first, up to 50, with `Undo` where allowed. | The read's bound (research §D); a durable path for 2.2.1 after the toast closes. |
| UI-D29 | `AI_PROPOSAL_ALREADY_DECIDED` reads `This proposal is no longer open. Refresh the page to see where it stands.`, replacing family J's copy. | Research Pitfall 14: the code now covers superseded and lapsed items. |
| UI-D30 | Extensions are numbered X-24 to X-26. | They continue Phase 14's X-23 (the spawn prompt). |
| UI-D31 | X-24 defines word emphasis, but Phase 15 does not use it. | Research §Q: no word diff here; Phase 16 adds its bounded diff without forking the extension. |
| UI-D32 | Job completion is announced, never moves focus; jobs show `Check again` after 30 seconds. | Phase 10's job pattern; moving focus mid-review would lose the analyst's place. |
| UI-D33 | Group headings say who asked and what, in a sentence. | Success criterion 3's facts read at a glance in the panel as in the timeline. |
| UI-D34 | A questionnaire-wide run with nothing kept says `The AI proposed nothing new for this questionnaire.`, with its `{a} left out` list beside it until the next view; the timeline keeps `Result: nothing proposed`. | An empty result is a real outcome, and its left-out list explains it (the yardstick's dropped change must be visible). |

---

## Notes carried

- **For the orchestrator to settle.**
  - **Phase 16's verbs.** 16-CONTEXT D-47 and D-49 write "Accept" for the analyst's per-unit decision. The glossary and X-24 say `Confirm`; the Phase 16 UI-SPEC should reuse X-24 and its verbs.
  - **Family J's copy** (Phase 12's planned `refusal-copy.ts`) is reworded by a Phase 15 plan (UI-D29), in the same plan as family Q.
  - **The Requestor's kept answers** (UI-D25) put unsaved answer text in session storage, as Phase 13 does for note drafts; confirm this posture for answers.
  - **Release replaced by a line** (UI-D19) changes Phase 10 §1.1 item 4's behaviour while proposals are open; the Phase 15 plan changes 10's assertions deliberately.
- **Shared-file changes needed.** `docs/design/csrm-design-direction.md` records X-24 to X-26 (a Phase 15 plan task). The root `CONTEXT.md` entry "Confirm (AI proposal)" already covers questions and "Reject", so D-34's glossary task needs no change unless the orchestrator wants "Edit, then confirm" named there.
- **Research to verify.** Where the hub reads the open count and active proposal jobs (the questionnaire's `generation.openProposals` and the proposals read's `jobs`); the session draft store keyed per proposal for "Edit, then confirm".
- **Route budget.** The panel's frame renders on the server; the form, item list, comparison and rewrite form load with `next/dynamic` from a Client Component; client pieces stay zod-free (D-35). `performance.spec.ts` stays green, or a recorded exception gives its reason.

---

## UI Considerations

These rows are written inline from the contract. The ui-phase consideration probe (Step 9.5) replaces them when it runs.

Applicable state considerations resolved: 27 covered, 3 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| empty | Panel | covered | First-use and cleared copy (§2.5) |
| empty | Answered list; left-out list; decided group | covered | Absent at zero |
| empty | Nothing proposed; nothing to simplify | covered | §2.3, §6.3 lines |
| loading | Panel parts | covered | Skeleton after 300ms mirroring the form and two cards (§2.5) |
| loading | Start, rewrite, edited confirm | covered | Inline spinners `Asking the AI…`, `Rewriting…`, `Confirming…` |
| loading | Jobs | covered | Status line, polling, `Check again` (§2.3) |
| error | Proposals read | covered | Compact error with `Try again`; release still server-gated (§2.5) |
| error | Start and rewrite | covered | Q1 under the field, text kept (§3.1) |
| error | Jobs | covered | Q3 alert with `Retry AI proposals`; row `Retry` (§2.3, §6.2) |
| error | Decisions and Undo | covered | Rollback and Q2 toasts (§5.1) |
| error | Requestor save after a return | covered | §11.2, answers kept |
| permission | Requestor; Secondary Requestor; participants | covered | Nothing of the AI anywhere (§11.1); existing permission states |
| permission | Requesting analyst | covered | §12's lines |
| permission | States that forbid an action | covered | Guidance lines, no per-item disabled controls (§2.4) |
| populated | Every surface | covered | §2 to §10 |
| partial | Items | covered | Open, stale, decided states side by side (§4) |
| partial | Comparison | covered | Changed rows shown, unchanged behind a count (§4.3) |
| partial | Requestor restore | covered | Only unchanged, empty questions restored; the caption counts them (§11.2) |
| overflow | 30 items in one group | covered | Compact density; one `ol`; no stagger |
| overflow | Comparison on phones | covered | Stacked, current above proposed (§4.3) |
| overflow | Long instruction | covered | Clamped to three lines with `Show full instruction` (X-25) |
| long-text | Question texts, choices, help text | covered | Wrap anywhere; `whitespace-pre-wrap` for help text and reasons |
| long-text | Toasts naming sections | backstop | `{ statement: "A confirm toast naming a 255-character section title wraps at 375px and its Undo stays visible and reachable", verification: backstop }` |
| overflow | Card actions in compact density at 1440 | backstop | `{ statement: "In compact density at 1440px a card's Confirm, Edit, then confirm and Reject keep 24px targets on one row without overlapping the comparison", verification: backstop }` |
| overflow | Rewrite popover near the viewport edge | backstop | `{ statement: "At 1440px the rewrite popover opened from the last question row stays within the viewport and its field and actions are fully visible", verification: backstop }` |
| zero-one-many | Counts | covered | `{proposal|proposals}`, `{question|questions}`, `{field|fields}`, `{source|sources}` written out |
| zero-one-many | Groups | covered | One or many groups render alike; zero uses the empty copy |
| zero-one-many | Rewrite outcomes | covered | Zero items (nothing to simplify) or exactly one (§6) |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | None new. The existing `Textarea`, `Input`, `Label`, `Table`, `Popover`, `Sheet`, `Skeleton`, `Alert`, `Button`, `Separator` and `sonner` `Toaster` | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

No new dependency.

---

## Verification contract

- **Unit and component (Vitest):**
  - the zod-free domain: default action labels (UI-D3), panel state by D-06, group headings, left-out lines, decided notes, the restore rule of §11.2;
  - `field-comparison`: changed and unchanged rows, the unchanged toggle, table from 768px and stacked pairs below, `ins`/`del` emphasis rendering when supplied (unused by Phase 15);
  - the instruction field: count, over-limit error, Q1 refusals keeping text, session restore, `beforeunload`, cleared after a start;
  - the panel's five states and every §2.4 state, including the form-open state and the requesting analyst;
  - items: each kind's content, placement and visibility lines, citations (X-12 button, note link, plain kinds), stale badge and `Reject` only, compact density;
  - decisions: optimistic `Confirm` and `Reject`, waiting `Confirm with edits`, rollback with Q2 copy, Undo toasts and their results, focus after each event, batch size for `Reject remaining`, inline reason with `Enter` and `Escape`;
  - rewrite: control presence rules, the popover form, `Rewriting…`, nothing to simplify, failure and `Retry`;
  - gates: §8.1 lines replacing `Release questionnaire`, §8.2, §8.3's narrowed Replace and single dialog description, §8.4 hub line, signal action and job;
  - provenance: header line 3 and the open-proposal link, origin notes, the sheet's two groups;
  - timeline: §10's entries; no AI entry or key in the Requestor variant;
  - the Requestor: §11.2 copy, kept and restored answers; no AI data anywhere in the Requestor's tree;
  - copy: families Q1 to Q3 and the additions; family J's rewording; no `Accept`, `Approve` or `Dismiss` in `features/questionnaire-ai`.
- **Contract parity:** every new or widened parser joins `contract-response-parity.test.ts` (D-02).
- **E2E** (dev servers stopped): §16 E1 and E2, with zero serious axe violations at 375 and 1440 on each state the Accessibility contract lists. The run leaves the tree clean.
- **Browser backstops** (orchestrator): the three UI Considerations backstops; NVDA reading the job status once per state, the comparison table's row and column headers, and a toast's `Undo` by `Alt+T`; keyboard-only review of the offshore group (confirm, edit then confirm, reject with a reason, Undo) without a mouse; the live-model check (D-36) judged against §4.

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
