---
phase: "12"
slug: "ai-context-suggestions-and-provenance"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 12 — UI Design Contract

> Visual and interaction contract for AI provenance and review. It covers:
> - the analyst's provenance header and the "What the AI used" side sheet (D-07, D-23, D-25);
> - per-field markers and review in the assessment editor (D-13, D-21);
> - source citations and uncited claims (D-14);
> - suggested controls (D-12);
> - review decisions with optimistic feedback and Undo (D-24, D-36);
> - the new release readiness requirement (D-21);
> - question origin markers and help text (D-17, D-22);
> - the Requestor's AI disclosures and the "Not sure" guidance (D-16, D-23);
> - the request hub's AI data policy status (D-26 to D-29).
>
> It introduces no colour, type size, weight, family, radius, shadow, spacing step or duration of its own. Four patterns the direction does not yet name are proposed as CSRM extensions X-11 to X-14.

---

## Binding inputs and value authority

- **Locked decisions.** D-01 to D-39 in `12-CONTEXT.md` and its Orchestrator Confirmations govern this contract. It fixes the copy, layout and marker visuals the context leaves to the UI-SPEC (Planner's Discretion, D-35). Where a decision leaves a choice open, this contract makes it and records the reason under "Decisions recorded" (UI-D1 to UI-D31).
- **Value authority.** `docs/design/csrm-design-direction.md` (ADR 0001) is the only value-bearing authority. This file names semantic tokens and cites the direction by section (§). It restates no colour, size, radius, shadow or duration. Spacing steps are named only where a new layout needs one, and each one is a §3.9 step.
- **Extensions.** These are recorded in the direction before any Phase 12 plan runs:
  - Phase 10's X-1 to X-5, by plan 10-01;
  - Phase 11's X-6 to X-10, by Phase 11's first plan.

  This contract reuses X-1 (save status), X-2 (record picker), X-3 (dates and times), X-4 (separators), X-8 (quick find's phone sheet, as the model for X-13) and X-10 (figure links). New patterns are proposed as X-11 to X-14 under "Proposed CSRM extensions", each with its exact wording. Plan 12-13 records them before any implementing task runs.
- **Requirements.** INT-05, INT-06, ASSESS-08 and QUES-10. Acceptance bar: ROADMAP Phase 12 success criteria 1 to 5.
- **Findings closed.** UAT-029, UAT-030, UAT-031, UAT-032, UAT-042, UAT-043 and UAT-044.
- **Delegated decisions.** #5, #6, #8 and #14, plus G-1, G-3, G-4 (§13 of this contract), G-6 and G-7. The glossary entry "Accept, Treat (risk decisions)" (root `CONTEXT.md`, from G-14 on 2026-10-01) postdates `12-CONTEXT.md`. It is the reason for UI-D1.
- **Builds on Phases 10 and 11.** The surfaces are the ones Phase 10 rewrites:
  - the editor's readiness summary (10 §14) and its save confirmations (10 §13.4);
  - the released view (10 §15);
  - the governance editor's in-place form (10 §1);
  - the Requestor's introduction (10 §5.2);
  - the hub's job cards (10 §12);
  - the refusal copy (10 §10.2).

  Phase 11's page names and its `Go to Home` recovery copy apply unchanged. Every plan re-reads those files after Phases 10 and 11 execute (research Pitfall 14).
- **Domain vocabulary** comes from the JDL and the glossary.
  - **Terms used:** Risk, Risk Type, Control, mitigation control (a Control Implementation), Information System, Information Asset, Security Analyst and Requestor.
  - **New presentations:** "AI proposal", "AI run" and "information classification". These present the planned `aiProvenance`, `CsrmAiRun` and the request's derived classification (D-19, D-21, D-26); they are not competing entities.
  - **Accept and Treat:** these are the risk owner's decisions (glossary). This contract never uses either word for the analyst's review act (UI-D1).

### Decision coverage

| Decisions | Where this contract honours them |
|---|---|
| D-01 to D-03, D-15, D-18 (contract, wire shapes, keys) | No UI of their own. The UI reads only the planned fields: §1 to §11 |
| D-04 to D-06, D-08 (the context, its slots and bounds, its extension points) | §2 shows what the context held; the sheet's groups are a list that Phases 13 and 14 extend (UI-D17) |
| D-07, D-25 | §1 trigger, §2 |
| D-09, D-10, D-13 | §3.4 pre-fill notes; derived ratings are marked like any AI value (§3.1) |
| D-11 | §3.5 |
| D-12 | §5 |
| D-14 | §4 |
| D-16, D-17 | §8.3, §8.4, §9 |
| D-19, D-20 | §2 `Run` group |
| D-21 | §3, §6, §7 |
| D-22 | §8.2 |
| D-23 | §1, §9.3, §10 |
| D-24 | §6 |
| D-26 to D-29 | §11; §2 `Data policy` group |
| D-30, D-31 | No UI; Verification contract |
| D-32 to D-34 | §6.3 and §2.2 permission copy; no control is offered to an actor who lacks the grant |
| D-35 | §3 (X-11), §4 (X-12), §5, §6; exact copy throughout |
| D-36 | §6 (optimistic, Undo), §2 and §4 (skeletons), phone layouts in each section, the Motion section; §13 (G-4); Notes carried (route budget) |
| D-37 | §1 to §11 cover every listed surface; the Risk register gains no marker |
| D-38, D-39 | §14, Verification contract; the plan column follows the research's grouping |
| #5, #6, #8, #14, G-1, G-3, G-6, G-7 | via D-05, D-12/D-24, D-10/D-11, D-09, D-32 to D-34, D-26 to D-29, D-01 and D-27/D-30 as mapped above |
| G-4 | §13 |
| Glossary (Accept, Treat) | UI-D1 |

---

## Design system

| Property | Value |
|----------|-------|
| Tool | shadcn/ui, source-owned local components (`apps/csrm/components.json`: style `new-york`, RSC, CSS variables, neutral base, `iconLibrary: lucide`) |
| Preset | new-york; neutral base; CSS variables; RSC; Lucide icons |
| Component library | Radix primitives through the installed `radix-ui` package (1.6.7), composed by the local shadcn/ui components; `sonner` 2.0.8 under the source-owned `Toaster` |
| Icon library | `lucide-react` 1.30.0, per §4 Iconography |
| Font | Plus Jakarta Sans for UI text, data and numbers; Instrument Serif for page titles only; IBM Plex Mono for micro-labels and machine identifiers (§3.10, ADR 0001 gap 8) |
| Tokens | Semantic tokens in `apps/csrm/app/globals.css`, whose values are the direction's; feature code consumes the mapped utilities only |
| New dependencies | None. The side sheet composes the installed `Sheet`; source popovers compose `Popover` and `Sheet`; Undo toasts use the installed `sonner` action |

---

## Component inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

A non-exhaustive list of the known-good components this phase uses, never a closed allowlist. The full set is the 30 Phase 11 lists (`alert-dialog` to `tooltip`).

| Component | Import path | Phase 12 use |
|---|---|---|
| `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription` | `@/components/ui/sheet` | The "What the AI used" side sheet (§2, X-13); the source sheet below 768px (§4.2) |
| `Popover`, `PopoverTrigger`, `PopoverContent` | `@/components/ui/popover` | The source popover from 768px (§4.2, X-12) |
| `Toaster` (sonner `toast` with `action`) | `@/components/ui/sonner` | Undo toasts and rollback toasts (§6, X-14) |
| `Badge` (through `StatusBadge`) | `@/components/ui/badge` | `AI proposed` and `No source cited` (§3.1, X-11) |
| `Skeleton` | `@/components/ui/skeleton` | The sheet and the source popover (§2.4, §4.2) |
| `Button`, `Card`, `Alert`, `Textarea`, `Label`, `Separator` | `@/components/ui/*` | Unchanged uses |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

A non-exhaustive list; the executor may use any exported primitive.

| Primitive | Path | Phase 12 change |
|---|---|---|
| `StatusBadge`, `statusPresentation` | `components/csrm/status-badge.tsx` | Gains an `aiReview` family in the one shared mapping (§4 Tone vocabulary): `proposed` → `AI proposed`, warning, `Sparkles`; `uncited` → `No source cited`, warning, `Unlink` |
| `RecordLink` | `components/csrm/record-link.tsx` | Header review link, source popover links; unchanged treatment |
| `ConfirmDialog` | `components/csrm/confirm-dialog.tsx` | The questionnaire release dialog's description variant (§8.5); no new confirmation |
| `DetailSection`, `PageHeader` | `components/csrm/*` | Unchanged |
| Phase 10 `LocalInstant`, `formatInstant`, save status (X-1), control label rule (10 §16.1), `refusal-copy.ts`, `release-readiness-summary.ts`, `questionnaire-introduction.tsx`, `released-risk-details.tsx` | as Phase 10 plans them | Reused; §6.3, §7, §9.3 and §10 add their Phase 12 rows |
| **New:** AI assistance feature | recommended `features/ai-assistance/` (as research proposes): `ai-assistance-domain.ts` (zod-free states, labels and presentation), `ai-provenance-header.tsx` (server), `ai-field-marker.tsx`, `ai-review-bar.tsx`, `ai-citations.tsx`, `ai-source-popover.tsx` (lazy), `ai-run-sheet.tsx` (lazy), `ai-control-suggestions.tsx`, `ai-uncited-claims.tsx`, `ai-assistance-notice.tsx` (server) | §1 to §10 |

Names and paths of new modules are the planner's (CONTEXT, Planner's Discretion). Zod stays out of every new client module (`zod-client-boundary.test.ts`).

---

## Token names used in this contract

As the Phase 11 contract's table ("Token names used in this contract"), which this contract does not repeat. This phase uses these additionally or more heavily:

| Direction token | Utility or class in the shipped code | Phase 12 use |
|---|---|---|
| `--color-warning-bg` / `-fg` / `-border` | `bg-warning-subtle text-warning border-warning-border` | `AI proposed` and `No source cited` badges; the `Claims to check` region |
| `--color-success-fg` | `text-success` | The `CheckCircle2` beside `All AI proposals reviewed` |
| `--color-bg-scrim`, `--shadow-overlay`, `--radius-2xl`, `--radius-lg` | `SheetOverlay`, `shadow-overlay`, `PopoverContent` | Side sheet and source popover |
| `--font-mono` | `font-mono` | The context digest (§3.10 machine identifiers) |

---

## Voice, formats and shared copy rules

The Phase 11 contract's "Voice, formats and shared copy rules" section applies unchanged:
- Australian English and sentence case;
- the spaced hyphen in prose, and the middle dot as the X-4 separator;
- the typographic apostrophe (’), with typographic quotes (“ ”) around quoted text;
- written-out singular and plural forms, with `tabular-nums` on counts;
- X-3 times.

In addition:

- **The review act is "Confirm"** (UI-D1). The analyst confirms, edits, dismisses or restores an AI proposal. Copy never says the analyst or the AI "accepts" or "approves" a proposal. `Accept` and `Treat` appear only as `CsrmTreatmentAction` values, verbatim. The API's `accept` decision name is never shown.
- **AI terms in copy.** Copy uses "AI", "AI proposed", "AI proposal" (an AI-written field value or suggestion) and "the AI". Generated content is "proposed" or "suggested", never "final", "approved" or "released". Nothing in this phase releases anything automatically.
- **No internal terms.** New copy avoids "provenance", "run record", "context summary", "proposal key", "deterministic", "ceiling" (the copy says "approved limit" instead) and "aiProvenance". Data is shown verbatim: provider labels and model names are the operator's own values (UI-D15).
- **Field labels** in markers, toasts and accessible names are the editor's visible labels (`Issue statement`, `Residual rating`, `Treatment plan`). A request field's label follows Phase 10 §9.1 (`Regulatory requirements`, `Business purpose`).

---

## 1. Provenance header (X-11; D-23; UAT-032)

**Surfaces:** the analyst's assessment editor `/app/review/assessments/{id}`, in every state including after release. The analyst's questionnaire review page `/app/review/questionnaires/{id}`, in analyst review, awaiting submission and submitted.
**Focal point:** line 1 says who asked for the generation. While the assessment is unreleased, line 3 tells the analyst how much review remains.

Placement: directly below `AssessmentRequestLink` and the lifecycle stepper, above every alert, governance panel and section. It is rendered on the server. It does not render when the served `generation` block is absent.

| Part | Contract |
|---|---|
| Region | A `section` named `AI generation` (`aria-label`; no heading). A card: `--color-bg-surface`, a `--color-border-default` hairline, `--radius-lg`, 16px padding |
| Icon | `Sparkles` 16px in `--color-text-secondary`, `aria-hidden` |
| Line 1 (`--text-body` at 500) | `Generated with AI at the request of {analyst}`. With no served analyst: `Generated with AI` |
| Line 2 (`--text-caption`, `--color-text-secondary`) | `{instant with time of day, X-3} · Provider: {providerName} · Model: {providerVersion}` |
| Line 3, assessment, unreleased, proposals outstanding | A figure link (X-10) in `--text-body`: `{n} AI-proposed {field|fields} to review`. It goes to `#assessment-details` when the details hold a proposed field, else to the first Risk in editor order that holds one (`#risk-{id}`) |
| Line 3, assessment, unreleased, none outstanding | `All AI proposals reviewed`, with `CheckCircle2` at the inline-message size in `--color-success-fg` |
| Line 3, questionnaire in analyst review | `--text-caption`: `{a} AI proposed · {e} edited · {d} added by analysts`, omitting any part that is zero |
| Line 3, generated before Phase 12 (no run, no per-field facts) | Assessment: `This draft was generated before CSRM recorded what the AI used, so its fields aren’t marked.` Questionnaire: `This questionnaire was generated before CSRM recorded what the AI used, so its questions aren’t marked.` |
| Line 3, released assessment or released questionnaire | Omitted |
| Action | `Show what the AI used`: outline, small, `FileSearch` icon, opening §2. Present whenever the served `runId` is set, released records included. `data-print="hidden"` |

| Viewport | Contract |
|---|---|
| 1440 | Icon and lines on the left; the action is right-aligned on the line 1 row |
| 375 | Icon and lines stack; the action goes below them at full width and the touch-target height |

Printing: the header prints, without its action, so a printed assessment still says it was AI-assisted.

---

## 2. "What the AI used" side sheet (X-13; D-07, D-25)

**Trigger:** `Show what the AI used` (§1). The sheet reads `GET /api/v1/ai_runs/{runId}` through the typed service from a Server Action when it opens. It is code-split with `next/dynamic` from the header's client trigger (D-36; research Pitfall 7).
**Focal point:** the `Data policy` group, then what was sent.

### 2.1 Frame

| Part | Copy |
|---|---|
| Title (h2, `--text-heading-sm`) | `What the AI used` |
| Description (`--text-body`, `--color-text-secondary`) | Assessment: `What CSRM sent to the AI for this draft. Requestor text was marked as information to analyse, never as instructions, and isn’t stored with this record.` Questionnaire: the same, with `for this questionnaire` |
| Close | Phone sheet: the visible `Close`, named `Close what the AI used` (the X-8 pattern). From 768px: the shipped `Sheet` close button with the same name. `Escape` closes |

### 2.2 Groups

Each group is an h3 `.micro-label` heading over a definition list. Labels are `.micro-label`; values are `--text-body`, with `[overflow-wrap:anywhere]`. Groups are separated by 24px. A group that does not apply to the operation does not render.

| Group | Rows (label: value) |
|---|---|
| `Run` | `Started by`: name · `Started`: instant (X-3) · `Finished`: instant, else `Not finished` · `Provider` · `Model` · `Outcome`: `Completed`, `Failed: {failureMessage}`, `Interrupted by a restart` or `Running` |
| `Data policy` | `Information classification`: `{level}`, with a caption of either `From the request’s information assets` or `No information asset on this request is classified, so Internal applies` · `Approved limit`: `{ceiling}`, else `No limit set in development` · `Decision`: `Allowed` |
| `Request` | `Fields sent`: the field labels, one per line |
| `Questions and answers` (draft only) | `{answered} of {included} {question|questions} answered`, then an ordered list of the question texts. Each is clamped to two lines with the full text kept in the DOM, and its section title follows in `--text-caption` |
| `Information systems` | One name per line, else `None selected` |
| `Information assets` | `{name} · {classification}` (`Not classified` when absent), one per line, else `None selected` |
| `Risk Types` | `{offered} of {total} offered`, then the names. When some were left out: `{k} less relevant Risk {Type was|Types were} left out.` |
| `Control candidates` (draft only) | `{offered} of {total} library controls offered` |
| `Context digest` | The digest in `--font-mono` at `--text-caption`, wrapping, with the caption `A SHA-256 fingerprint of the exact text sent to the AI.` |

The Requestor's text is never shown here, because the run does not keep it (G-3). The figures are facts about one run, and their items are listed beside them, so no figure links elsewhere (UI-D18).

### 2.3 Viewports

| Viewport | Contract |
|---|---|
| 1440 and from 768 | The X-13 side sheet at the form dialog width, at full height; its body scrolls |
| 375 | The X-13 full-screen sheet with the title row and `Close` |

### 2.4 States

| State | Contract |
|---|---|
| Loading | Nothing for 300ms, then a skeleton of the title, the description and four groups of label and value rows (§4 Skeletons) |
| Populated | §2.2 |
| Empty (404, or a run without a summary) | `No AI run record` · `CSRM holds no record of what this generation used.` |
| Error | `We couldn’t load what the AI used` · `Please try again. If the problem continues, contact your administrator.` · `Try again` |
| Permission (403) | `You don’t have access to this AI run` · `Only Security Analysts can see what an AI run used.` |

Focus: when the sheet opens, focus goes to the title (`tabIndex={-1}`); `Try again` keeps focus on the title. On close, focus returns to `Show what the AI used`.

---

## 3. Field markers and review in the assessment editor (X-11; D-13, D-21, D-35)

**Surface:** `/app/review/assessments/{id}` while the assessment can be changed. This covers each Risk card's form (`risk-editor.tsx`) and the `Assessment details` form.
**Focal point:** each record's review bar (§3.2), then the first `AI proposed` field.

These do not show after release, or on records without per-field facts: there, the header alone shows (D-23).

### 3.1 Marker on each AI-written field

The 20 risk fields and the four assessment fields that D-21 lists carry a marker on the field's label row, after the label. AI-derived values (ratings, data classification) count as AI-written.

| Field state | Marker | Control beside it |
|---|---|---|
| `proposed` | The `AI proposed` badge (`StatusBadge` family `aiReview`) | `Confirm`: ghost, small, `Check` icon, named `Confirm {field label}` |
| `proposed`, and the analyst has changed it in the form without saving (client-side, compared with the loaded value) | The note `Edited, not saved` (`PenLine`) | none |
| `accepted` | The note `Confirmed` (`Check`) | none |
| `edited` | The note `Edited` (`PenLine`) | none |
| A field with no AI fact | nothing | none |

- A **note** is a 12px icon plus `--text-caption` text in `--color-text-secondary`, with no fill or border (X-11). A note is not a status badge (UI-D2, UI-D4).
- The label row is a flex row that holds a `label` with `htmlFor`, the marker and the `Confirm` button. `Confirm` never sits inside the field's `label` element.
- The field's control adds the marker's text to its `aria-describedby`, so focusing the field announces "AI proposed" (UI-D3).
- When a field's value is changed back to the loaded value, its marker returns to `AI proposed`.

### 3.2 Review bar (per Risk and for the assessment details)

This is the first element of each record's form, above the `Claims to check` region (§4.4) and the fields. It is a `div` with `role="group"`, named `AI review for {risk number}` or `AI review for the assessment details`.

| Condition | Content |
|---|---|
| `n` proposed fields, none changed in the form | `{n} AI-proposed {field|fields} to review` (`--text-body` at 500, `tabular-nums`). When `k` statement fields have no source, the caption `· {k} without a source` follows. Action: `Confirm remaining ({n})` (outline, small, `ListChecks`), named `Confirm remaining ({n}) on {risk number}` or `Confirm remaining ({n}) in the assessment details` |
| Some proposed fields changed in the form (`d`) | The same line counts only unchanged proposals. Below it, `--text-caption`: `Confirm remaining skips the {d} {field|fields} you’ve changed. Save to record your {edit|edits}.` |
| All `d` proposals are changed | No action; the caption above |
| No proposed field left | `All AI proposals reviewed`, with `CheckCircle2` in `--color-success-fg`. The line is focusable (`tabIndex={-1}`) for §6.2 |
| The record has no AI facts | The bar does not render |

| Viewport | Contract |
|---|---|
| 1440 | The count on the left and the action on the right of one row; the caption below |
| 375 | Stacked; the action goes full width at the touch-target height; each field's `Confirm` meets the touch-target height |

There is no assessment-wide "confirm everything" control (UI-D6).

### 3.3 Risk card header

Beside the Risk number and its residual `RiskRatingBadge`, a Risk with proposed fields shows the `AI proposed` badge. Its accessible name is extended to `AI proposed: {n} {field|fields} to review` through visually hidden text after the visible label. It wraps with the other header items at 375.

### 3.4 Pre-filled values (D-09, D-13)

Each note below is a `--text-caption` hint in `--color-text-secondary`, under the field, shown only while the field is `proposed`.

| Field | Note |
|---|---|
| `Data classification` | `Taken from {asset name}.` |
| `Risk type`, proposed as none | `The AI found no Risk Type that fits this Risk. Choose one, or confirm to leave it unset.` |
| `Information system impacted`, `Information asset impacted` | none: the X-2 picker's selected line and the marker say enough |
| Ratings | none (UI-D28) |

### 3.5 Treatment action (D-11)

Each note is a `--text-caption` hint under `Treatment action`, shown while the field is `proposed`.

| Case | Note |
|---|---|
| The AI proposed `Accept` (residual rating Low or Moderate) | `Proposed because the residual rating is {Low|Moderate}. The treatment plan holds the AI’s reason.` |
| The adapter changed an `Accept` to `Treat` (adjustment `accept-not-permitted`) | `The AI proposed Accept, which it may suggest only for a Low or Moderate residual rating, so Treat is proposed instead.` |

The analyst confirms or changes the value like any other. The risk owner's decision (Phase 17.1, G-14) is not part of this phase.

---

## 4. Source citations and uncited claims (X-12; D-14; UAT-042)

### 4.1 Citations

These are shown under each statement field while the record is unreleased, after the field's hint and error. The statement fields are:
- Risk: `Issue statement`, `Risk statement`, `Risk cause`, `Potential impact`, `Inherent rating rationale`, `Residual rating rationale` and `Treatment plan`;
- assessment: `Summary`, `Overall risk rationale` and `Recommendations`.

| Part | Contract |
|---|---|
| Label | `Sources` in `.micro-label`, `--color-text-secondary` |
| List | A `ul` named `Sources for {field label}`, wrapping, in the served order, with 8px between items |
| Answer citation | `Answer: {question text}`: a button with the X-12 citation treatment that opens §4.2 |
| Request citation | `Request: {field label}`: a button that opens §4.2 |
| System citation | `System: {name}`: plain `--text-caption` text, not interactive (UI-D9) |
| Asset citation | `Asset: {name} · {classification}`: plain text, not interactive |
| No source | The `No source cited` badge in place of the list, with the caption `Check this statement against the request and answers.` |

A citation's accessible name is its full visible text, kept in the DOM even when the X-12 single-line clamp hides part of it. Each citation button carries `aria-haspopup="dialog"` and `aria-expanded`.

### 4.2 The source (popover from 768px, bottom sheet below)

The source content is read when it opens, through the existing analyst reads: the submitted questionnaire's questions and answers, and the request read. No new operation is added (D-03).

| Source | Content |
|---|---|
| Answer | A title (`--text-body` at 500, the popover's or sheet's heading): `{question text}`. A caption: `{section title}`. The help text, when present, in `--text-caption`. `.micro-label` `Requestor’s answer`, then the answer as rendered for the analyst (choice labels; `Not answered`). A record link: `Open the questionnaire` → `/app/review/questionnaires/{id}` |
| Request field | Title: `{field label}`. The value with `whitespace-pre-wrap`, else `Not provided`. A record link: `Open request {request number}` → `/app/review/requests/{id}` |

| State | Contract |
|---|---|
| Loading | Nothing for 300ms, then a skeleton of a title line and three text lines |
| Error | `We couldn’t load this source.` with `Try again` (outline, small) |
| Empty | `This source is no longer available.` |
| Permission | `You can’t open this source.` |

Focus moves to the title on open. `Escape`, or a click outside, closes the popover and returns focus to the citation.

| Viewport | Contract |
|---|---|
| from 768 | A `Popover` anchored to the citation, no wider than the §4 Dialogs confirm size, bounded by the viewport |
| below 768 | A bottom `Sheet` with the title row and a visible `Close` named `Close source` |

### 4.3 Uncited claims (per Risk)

`Claims to check` is a `section` named by its h4, placed after the review bar.

| Condition | Treatment |
|---|---|
| The Risk has claims and a proposed field remains | Phase 10 §5.3's warning region treatment. h4 `Claims to check`. Intro: `The AI made these claims without a source in the request or answers. Check each one before you confirm the fields that rely on it.` A `ul` of `“{claim}”`, each item `--text-body` |
| The Risk has claims and no proposed field remains | The same content on `--color-bg-surface` with a `--color-border-default` hairline, no tint. h4 `Claims the AI couldn’t support`. Intro: `Kept for reference until release.` |
| No claims, or after release | Not rendered |

---

## 5. Suggested controls (D-12; UAT-031)

**Surface:** each Risk card's `Mitigation controls` section, after the existing mitigation controls and before `Add mitigation control`. The section is unreleased only; suggestions never block release.
**Focal point:** the first suggestion still to review.

| Part | Contract |
|---|---|
| Heading | h4 `Suggested by AI` (`--text-heading-sm`), `tabIndex={-1}` for §6.2 |
| List | A `ul` named by the heading; each suggestion is an `li` card with a `--color-border-default` hairline, `--radius-lg` and 16px padding |
| Row, line 1 | The control label (Phase 10 §16.1), `--text-body` at 500 |
| Row, line 2 | The AI's rationale, `--text-caption` in `--color-text-secondary`, with `whitespace-pre-wrap` |
| Proposed | Actions: `Add as planned control` (outline, small, `Plus`), named `Add as planned control: {control label}`; `Dismiss` (ghost, small, `X`), named `Dismiss suggestion: {control label}` |
| Added | The note `Added as a planned control` (`Check`); no actions. The new mitigation control appears in the list above with status `Planned` |
| Already present (the control is already a mitigation control on this Risk) | The note `Already a mitigation control` (`Check`); no actions |
| Dismissed | Hidden while the dismissed list is collapsed. When shown: the note `Dismissed` (`X`) and `Restore` (ghost, small, `Undo2`), named `Restore suggestion: {control label}` |
| Dismissed toggle | Shown when one or more are dismissed: `Show dismissed suggestions ({n})` / `Hide dismissed suggestions`. Outline, small, with `aria-expanded` and `aria-controls`; `ChevronDown` and `ChevronUp` swap with no transition (the Phase 10 §14 met-toggle pattern). `data-print="hidden"` |
| None suggested | `--text-body` in `--color-text-secondary`: `The AI suggested no controls for this Risk. Use Add mitigation control to choose one from the library.` |
| All dismissed | `You dismissed every suggestion for this Risk.`, then the toggle |

| Viewport | Contract |
|---|---|
| 1440 | Text on the left; the actions or the state note on the right, top-aligned |
| 375 | Stacked cards; actions full width at the touch-target height, `Add as planned control` first |

Printing: suggestions do not print (`data-print="hidden"` on the block). The printed page shows the mitigation controls only.

---

## 6. Review decisions: optimistic feedback, Undo and refusals (X-14; D-24, D-36)

Every decision goes through one batch Server Action on `POST /api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions` (research Pattern 5). It never resets a form's unsaved values: the editor merges the returned facts without remounting any form (no lost input).

### 6.1 Actions

| Action | Applies | Success toast (X-14) | `Undo` sends | After `Undo` | Failure toast title |
|---|---|---|---|---|---|
| `Confirm` (one field) | At once: the marker turns to `Confirmed` at the §5 Optimistic UI pending opacity until the server answers | `{Field label} confirmed on {risk number}.` or `{Field label} confirmed in the assessment details.` | `restore` for that field | `Confirmation undone.` | `Proposal not confirmed` |
| `Confirm remaining ({n})` | At once, for the `n` unchanged proposed fields | `{n} AI-proposed {field|fields} confirmed on {risk number}.` or `… confirmed in the assessment details.` | `restore` for those `n` fields | `Confirmations undone.` | `Proposals not confirmed` |
| `Add as planned control` | Waits for the server, because it creates a record. The button shows `Adding…` with its inline 16px spinner (§4 Skeletons), and the row's other action is disabled | `{control label} added as a planned control on {risk number}.` | `restore` for that suggestion (UI-D12) | `Planned control removed. The suggestion is back.` | `Control not added` |
| `Dismiss` | At once: the row leaves the list at the pending opacity | `Suggestion dismissed: {control label}.` | `restore` | `Suggestion restored.` | `Suggestion not dismissed` |
| `Restore` (from the dismissed list) | At once | `Suggestion restored: {control label}.` (no Undo: dismissing again is the reverse) | — | — | `Suggestion not restored` |
| `Undo` itself fails | — | — | — | — | `Couldn’t undo` |

- **Rollback.** On any failure, the changed markers or rows return to their previous state with an opacity transition at `--duration-base` (§5 Optimistic UI). A danger toast then shows the failure title and the §6.3 copy, with `Try again` for a retryable failure or `Refresh page` for a blocked one. Danger toasts persist until they are dismissed (§4 Toasts).
- **Release readiness** updates from the server's revalidated response, never optimistically. A decision on a release-ready assessment in review returns it to draft, as any accepted edit does (research Pitfall 9; Phase 06.8's superseded-review notice shows unchanged).

### 6.2 Focus

| Event | Focus |
|---|---|
| `Confirm` (one field) succeeds optimistically | The next `Confirm` in the same form, in field order. When none remains, the review bar's `All AI proposals reviewed` line |
| `Confirm remaining` | The review bar's status line |
| `Dismiss` or `Add as planned control` | The next suggestion's first action, else the previous suggestion's, else the `Suggested by AI` heading |
| `Restore` | The restored row's `Add as planned control` |
| `Undo` succeeds | The restored field's `Confirm`, or the restored suggestion's `Add as planned control` |
| A rollback | Stays where it is; the danger toast announces itself |

Toasts are announced politely by the `Toaster`, so nothing else announces a decision (no double announcement).

### 6.3 Refusal copy (new family J, added to Phase 10 §10.2 and `refusal-copy.ts`)

| Reason | Copy | Kind |
|---|---|---|
| `ASSESSMENT_NOT_MUTABLE` | `This assessment can no longer be changed, so your review wasn’t recorded. Refresh the page to see its current state.` | blocked |
| `AI_PROPOSAL_ALREADY_DECIDED` | `Someone has already reviewed this proposal. Refresh the page to see where it stands.` | blocked |
| 400 (unknown item) | `This proposal is no longer on the assessment. Refresh the page to see the current proposals.` | blocked |
| 403 | `You can’t review AI proposals on this assessment.` | blocked |
| 404 | Phase 10's locked assessment refusal | blocked |
| 409 with none or unknown | `Your review can’t be recorded in this assessment’s current state.` | blocked |
| Network, timeout or 5xx | `We couldn’t record your review. Try again.` | retryable |

The 403 copy covers an actor without the human-analyst grant (D-32). The UI offers no decision control to such an actor, but the server refusal stays the authority.

---

## 7. Release readiness requirement (D-21)

The requirement's served label is `Review of AI proposals`, at both scopes:
- risk scope, with destination `#risk-{id}`;
- assessment scope, with destination `#assessment-details`.

The label slots into Phase 10 §14's anatomy unchanged. For example, `Missing: Risk owner and Review of AI proposals` in a Risk row's caption, and `Review of AI proposals` with `Outstanding` or `Met` at assessment level. Records without per-field facts carry no such requirement (D-23).

---

## 8. Questionnaire governance (D-17, D-22, D-23)

**Surface:** `/app/review/questionnaires/{id}`.
**Focal point:** unchanged from Phase 10 §1: the question list.

### 8.1 Header

§1, placed below the request link and above the governance panel.

### 8.2 Question origin markers (analyst review only)

Each row's caption line (`{Answer type} · Required|Optional`) is followed, on the same line, by:

| Served `aiOrigin` | Marker |
|---|---|
| `generated` | The `AI proposed` badge |
| `generated-edited` | The note `Edited` (`PenLine`) |
| `analyst-added` | The note `Added by analyst` (`UserRoundPen`) |
| absent, or a malformed log projected as null | nothing |

In awaiting-submission and submitted states (Phase 10 §2), no marker shows; the header alone does.

### 8.3 Help text in rows

Under the question text: `Help text: {help text}` in `--text-caption`, `--color-text-secondary`, with `whitespace-pre-wrap`. This applies to the governance rows and to Phase 10 §2's released questions. A null help text adds no line.

### 8.4 Help text in the question form (X-5)

The field goes directly after `Question text` (UI-D20):

| Part | Copy |
|---|---|
| Label | `Help text` |
| Hint | `Shown to the Requestor under the question. Keep it to one or two sentences.` |
| Control | `Textarea`, optional |
| Error (more than 2,000 characters, checked on `Save question`) | `Keep the help text to 2,000 characters or fewer.` |

### 8.5 Release dialog

When any active question is `generated`, the description of Phase 10's release dialog becomes:

`The Requestor can view this questionnaire after release. Releasing also records that you reviewed its {n} AI-proposed {question|questions}.`

The title, confirm label and pending label are unchanged. Release accepts the set (D-22): it is a governance step that keeps its confirmation.

---

## 9. The Requestor's questionnaire (D-16, D-17, D-23; UAT-043)

**Surface:** `/app/questionnaires/{id}`.
**Focal point:** unchanged from Phase 10 §5.

### 9.1 Help text as the field hint

The help text sits under the question's label or legend, before its control or choices, in `--text-caption` and `--color-text-secondary` (§4 Forms hint), with `whitespace-pre-wrap` and the id `{field id}-hint`. The control or fieldset's `aria-describedby` names the hint, then the error. The read-only submitted view shows the hint too.

### 9.2 "Not sure"

The choice renders like any other, in its served position (last). It gets no special style or icon.

### 9.3 Introduction (Phase 10 §5.2)

| Paragraph | Copy |
|---|---|
| 1b, after paragraph 1, only when `aiAssisted` | `A Security Analyst used AI to help write these questions and reviewed them before sending them to you.` |
| 3, when any question offers a `not-sure` choice | `Not sure of an answer? Choose “Not sure” where it’s offered. Elsewhere, give your best answer, and where a question asks for text, say what you don’t know. The Security Analyst can send the questionnaire back to you if they need more detail.` |
| 3, otherwise | Phase 10's paragraph 3, unchanged |

The Requestor sees no marker, provider, model, run or analyst name for the AI (D-23).

---

## 10. Released assessment (D-23; UAT-032)

### 10.1 The Requestor (`/app/assessments/{id}`)

| Element | Contract |
|---|---|
| AI notice, only when `aiAssisted` | The first element under h2 `Assessment overview`, above its card: `Sparkles` 16px `aria-hidden`, then `--text-body` in `--color-text-secondary`: `AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before releasing it to you.` It is not a live region, and it prints |
| `Generated by` row | Removed (`released-assessment.tsx:204`). `Reviewed by` and `Released by` (Phase 10 §15.1) stay |

### 10.2 The analyst's read-only editor after release

This shows the §1 header without line 3, with `Show what the AI used`. It has no markers, review bars, citations, claims or suggestions.

---

## 11. The request hub: AI data policy and job copy (D-26 to D-29; UX-06)

**Surface:** the hub's two job cards (Phase 10 §12).
**Focal point:** the card's first line, as in Phase 10.

### 11.1 Policy status, from the served `aiPolicy`

The policy status shows only in the idle states, where `Generate questionnaire`, `Replace questionnaire` or `Generate assessment draft` would show.

| `aiPolicy` | Card body |
|---|---|
| `allowed` | The action, unchanged. Under it, a `--text-caption` line in `--color-text-secondary`: `This request’s information is classified {level}.` When the default applied, it adds ` No information asset on it is classified, so Internal applies.` |
| `refused`, `AI_CLASSIFICATION_ABOVE_CEILING` | No action. A warning-treatment `Alert` with a `ShieldBan` icon. Title: `AI generation isn’t available for this request`. Description: `This request’s information is classified {level}, above the {ceiling} limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.` |
| `refused`, `AI_POLICY_NOT_CONFIGURED` | The same alert. Description: `The AI provider hasn’t been approved for any information classification yet, so nothing can be sent to it. Contact your administrator.` |
| `aiPolicy` absent (jobs read failed) | Phase 10 §12.5 unchanged. A refused enqueue then shows §11.3 |

The refusal never promises another way to produce a questionnaire or draft, because none exists (UI-D24; Notes carried). It never names the environment beyond `in development` in §2.

### 11.2 Job failure codes (additions to Phase 10 §12.4)

| `failureCode` | Copy |
|---|---|
| `AI_CLASSIFICATION_ABOVE_CEILING` | `This request’s information is now classified above the limit the AI provider is approved for, so nothing was sent to the AI. Contact your administrator.` |
| `AI_POLICY_NOT_CONFIGURED` | `The AI provider isn’t approved for any information classification yet, so nothing was sent to the AI. Contact your administrator.` |
| `CONTEXT_TOO_LARGE` | `This request holds more information than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.` |

### 11.3 Refusals at enqueue (additions to Phase 10 §10.2 I, both cards)

| Reason | Copy |
|---|---|
| `AI_CLASSIFICATION_ABOVE_CEILING` | §11.1's description for that reason |
| `AI_POLICY_NOT_CONFIGURED` | §11.1's description for that reason |

### 11.4 Draft card running copy

`A reviewable draft is being prepared from the questionnaire answers.` becomes `A reviewable draft is being prepared from the request, its systems and assets, and the questionnaire answers.` The card stays provider-neutral (the existing test's intent).

---

## 12. Five-state contract

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| Provenance header | Part of the page; the editor and questionnaire skeletons each gain one header-height block | Not rendered without `generation` | Not rendered when the block is unparseable (fail safe, research Pitfall 11) | The route gate (Phase 10 §11) | Current, review outstanding, all reviewed, pre-Phase 12, released |
| What the AI used | Skeleton after 300ms | `No AI run record` | `We couldn’t load what the AI used` · `Try again` | `You don’t have access to this AI run` | Draft and questionnaire group sets |
| Field markers and review bar | With the form | No AI facts: nothing | Rollback and danger toast (§6.1) | No control without the grant | Proposed, changed-unsaved, confirmed, edited; bar counts |
| Citations and source | Source skeleton after 300ms | `No source cited`; `This source is no longer available.` | `We couldn’t load this source.` · `Try again` | `You can’t open this source.` | Answer and request sources; plain system and asset items |
| Claims to check | With the Risk | Not rendered | — | — | Warning and reference treatments |
| Suggested by AI | With the Risk | `The AI suggested no controls for this Risk. …` | Rollback and danger toast | No control without the grant | Proposed, adding, added, already present, dismissed, all dismissed |
| Hub job cards | Phase 10 unchanged | — | Phase 10 §12.5 | Phase 10 unchanged | Allowed caption, two refusal alerts, three failure codes |
| Requestor questionnaire and released view | Unchanged | No notice when not AI-assisted | Unchanged | Unchanged | Hint, intro sentences, AI notice |

The `design-contract.spec.ts` state matrix and the conformance type scan stay green: every new text element uses a §3.10 pair.

---

## 13. The premium experience bar (G-4), item by item

| G-4 item | Phase 12 contract |
|---|---|
| A keyboard path for every primary action | Every `Confirm`, `Confirm remaining`, citation, `Add as planned control`, `Dismiss`, `Restore`, toggle and `Show what the AI used` is a button in DOM order. A toast's `Undo` is reached with the `Toaster` region shortcut, `Alt+T`. No hover-only control (§6 do-not 11) |
| Optimistic feedback that rolls back on error | Confirm, confirm remaining, dismiss and restore apply at once and roll back with a danger toast (§6.1). Add waits, because it creates a record (§5 Optimistic UI: creation is not a high-success toggle) |
| Skeletons while loading | The side sheet and the source popover; the page skeletons gain the header block |
| Undo instead of confirmation for reversible actions | Every decision is reversible and none asks for confirmation; each carries `Undo` (X-14). Release keeps its confirmation, and the questionnaire release dialog says it records the review (§8.5) |
| Empty states that say what to do next | `Use Add mitigation control …`; `Choose one, or confirm to leave it unset`; `Check this statement …`; the hub refusals say whom to contact |
| No lost input | Decisions never reset unsaved form values (§6). Changed fields are excluded from `Confirm remaining` and say so (§3.2). The sheet and popovers are read-only |
| Comfortable and compact density | No dense data table is added. The suggestion and claim lists follow the cards' density |
| Motion from the direction | The Motion section; reduced motion honoured |
| Purpose-built phone layouts | Full-screen sheet (§2), bottom-sheet sources (§4.2), stacked suggestion cards and full-width actions (§3.2, §5) |
| Every figure opens its records | Header line 3 links to the first record with proposals (X-10). Review-bar counts sit in their own record. The sheet's figures list their items beside them (UI-D18) |

---

## 14. Test assertions this contract changes

Each plan greps its strings before editing, and changes these assertions deliberately in the same plan as the behaviour. No assertion is loosened to pass. Line numbers are today's; Phases 10 and 11 edit several of these files first. "Plan" follows the research's grouping.

### 14.1 End-to-end

| # | Spec:line | Asserts today | Change | Plan |
|---|---|---|---|---|
| E1 | `assessment-release-workflow.spec.ts:227, 260` | `All release requirements are met` after the edits | Before `:227`, use `Confirm remaining` on each Risk and on the assessment details (deterministic draft). Assert `Review of AI proposals` is outstanding first. `:260` stays green | 12-14 |
| E2 | `assessment-release-workflow.spec.ts` (the Requestor's released view) | The overview's labels | Assert the §10.1 notice and no `Generated by` | 12-14 |
| E3 | `questionnaire-generation-workflow.spec.ts:40, 102, 141` | `Review generated questionnaire` | Stays. Add: the header on the review page, a help-text line, and a `Not sure` choice | 12-15 |
| E4 | `questionnaire-workflow.spec.ts` (introduction steps) | Phase 10's introduction | Only if the fixture questionnaire is AI-assisted: the paragraph 1b sentence | 12-15 |
| E5 | `accessibility.spec.ts`, `performance.spec.ts` | Axe clean; the editor route within 300,000 bytes | Stay green with the markers, and with the sheet and popover open; any budget override needs a recorded reason (D-36) | 12-14, 12-16 |
| E6 | New `ai-context-provenance.spec.ts` | — | A UAT-A-like journey at 375 and 1440 with axe: generate, help text and `Not sure`, answer, draft, pre-fill and classification note, a citation opens its answer, `No source cited`, `Claims to check`, add a suggestion and `Undo`, dismiss and restore, confirm remaining, `Show what the AI used`, release, the Requestor's notice. A refused-policy hub, by pinning a ceiling below the fixture's asset classification in a dedicated server, is the planner's choice | 12-16 |

### 14.2 Unit

| File:line | Change | Plan |
|---|---|---|
| `src/features/assessments/assessment-review-workflow.test.tsx:513` | Running body copy (§11.4) | 12-12 |
| `src/features/assessments/released-assessment.test.tsx` (overview fields) | `Generated by` removed; the notice when `aiAssisted`; `:220` (no `edit`, `delete` or `release assessment` text) stays green | 12-14 |
| `src/features/assessments/assessment-editor.test.tsx:473, 538` | Stays green: fixtures without AI facts carry no new requirement | 12-14 (check) |
| `src/features/questionnaires/questionnaire-governance.test.tsx` | Help text field and error; origin markers; release description variant | 12-15 |
| `src/features/questionnaires/questionnaire-renderer.test.tsx` | Hint under the label, named by `aria-describedby` before the error | 12-15 |
| `src/features/assessments/questionnaire-generation-job.test.tsx`; draft card cases in `assessment-review-workflow.test.tsx` | Allowed caption; both refusal alerts; the three failure codes | 12-12 |
| New `src/features/ai-assistance/*.test.ts(x)` | Domain presentation; header variants; marker states, including the changed-unsaved state; review bar; citations and the source states; claims treatments; suggestions; decisions (optimistic, rollback, Undo, focus); sheet states; Requestor notice | 12-13, 12-14 |
| Phase 10's copy guard (10 §17.2) | Its file list gains the `ai-assistance` files; its terms gain `provenance`, `run record`, `context summary` and `ceiling` | 12-13 |

### 14.3 Assertions that must stay green

These stay green:
- `Assessment released` and the released view's no-mutation checks (`assessment-release-workflow.spec.ts:273, 317-320`);
- `Review generated questionnaire`;
- `Draft generation can begin only after the linked questionnaire is submitted.` (`questionnaire-generation-workflow.spec.ts:130`);
- the Phase 10 readiness names (`Release requirements`, `{n} of {total} release requirements met`);
- the draft card's provider-neutral copy (`The generated draft is advisory and has not been released.`).

---

## Copywriting contract

| Element | Copy |
|---|---|
| Primary CTAs | No new primary button. `Save risk`, `Save assessment`, `Save question`, `Generate questionnaire` and `Generate assessment draft` are unchanged |
| Other calls to action (new) | `Confirm` (`Confirm {field label}`); `Confirm remaining ({n})`; `Add as planned control`; `Dismiss`; `Restore`; `Undo`; `Show what the AI used`; `Show dismissed suggestions ({n})` / `Hide dismissed suggestions`; `Open the questionnaire`; `Open request {number}`; `Try again`; `Refresh page` |
| Markers | Badges: `AI proposed`, `No source cited`. Notes: `Confirmed`, `Edited`, `Edited, not saved`, `Added by analyst`, `Added as a planned control`, `Already a mitigation control`, `Dismissed` |
| Header | `Generated with AI at the request of {analyst}`; `{n} AI-proposed {field|fields} to review`; `All AI proposals reviewed`; the two pre-Phase 12 sentences (§1) |
| Empty states | `No AI run record`; `The AI suggested no controls for this Risk. Use Add mitigation control to choose one from the library.`; `You dismissed every suggestion for this Risk.`; `This source is no longer available.` |
| Error states | `We couldn’t load what the AI used` with `Try again`; `We couldn’t load this source.` with `Try again`; the §6.3 family J; the §11.2 failure codes; the §11.1 refusals, each naming the classification, the approved limit and whom to contact |
| Permission states | `You don’t have access to this AI run` · `Only Security Analysts can see what an AI run used.`; `You can’t open this source.`; `You can’t review AI proposals on this assessment.` |
| Toasts | §6.1, word for word |
| Destructive confirmations | None added. Every decision is reversible with `Undo` (G-4). Phase 10's `Release this risk assessment?` → `Confirm release` and its questionnaire release confirmation stay; §8.5 extends the latter's description |
| Requestor disclosures | §9.3 paragraph 1b; §10.1 notice. The Requestor never sees a provider, model or marker |
| AI output | Proposals are "proposed" or "suggested". The analyst "confirms" or "edits" them, and only a Security Analyst releases. `Accept` appears only as a treatment action value (UI-D1) |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 Info and relationships | The header is a named `section`; review bars are named groups; `Claims to check` and `Suggested by AI` are headed; citations are a named list; the sheet's groups are headed definition lists |
| 1.4.1 Use of colour | Every badge is an icon plus words; notes are words; the warning tint is never the only signal |
| 2.1.1 Keyboard | §13 G-4 first row; Undo by `Alt+T` |
| 2.2.1 Timing adjustable | Undo toasts pause on hover and focus (X-14), and every reviewed value can still be corrected on the page after the toast closes: edit the field, restore a dismissed suggestion, or remove a mitigation control |
| 2.4.3 Focus order | §2.4, §4.2 and §6.2 |
| 2.4.6 Headings | Editor: h1, then h2 `Identified Risks`, then the Risk, then h3 `Mitigation controls`, then h4 `Suggested by AI` and h4 `Claims to check`. Sheet: h2 title, h3 groups. Questionnaire pages are unchanged |
| 2.5.3 Label in name | `Confirm {field label}`, `Confirm remaining ({n}) on {risk number}`, `Add as planned control: {label}`, `Dismiss suggestion: {label}` and `Restore suggestion: {label}` each begin with the visible text. Citations are named by their full visible text |
| 2.5.8 Target size | Citations have 4px block padding for a target of at least 24px (X-12). New buttons meet the §4 Buttons and DataTable minimums, and the touch-target height below 768px |
| 4.1.2 Name, role, value | Citations carry `aria-haspopup="dialog"` and `aria-expanded`; the dismissed toggle carries `aria-expanded` and `aria-controls`; the sheet and popover are dialogs named by their titles |
| 4.1.3 Status messages | Toasts (polite; danger ones once); field descriptions carry the marker; Phase 10's readiness count line is unchanged |
| 1.4.10 Reflow | No horizontal page scroll from 320 to 1440; citation labels clamp with the full text in the DOM |
| Automated | Zero serious or critical axe violations at 375 and 1440 on the editor with proposals, the editor with the sheet open, a source open, the governance page, the Requestor questionnaire, the released view and the hub with a refusal |

---

## Spacing

The §3.9 scale and layout tokens apply unchanged; this phase adds no spacing value. New layout uses only these steps, all multiples of four:

| §3.9 step | Use in this phase |
|---|---|
| 4px | Icon-to-text gaps in badges and notes; citation block padding (X-12) |
| 8px | Between a label, its marker and `Confirm`; between citations; between a suggestion's two lines |
| 16px | Header and suggestion card padding (§4 Cards lower bound); between the review bar and the first field |
| 24px | Between the sheet's groups (§3.9 section rhythm, lower bound) |

Existing primitives keep their shipped spacing (`Sheet`, `Popover`, toasts, the Risk card). Exceptions: none.

---

## Typography

The §3.10 scale applies unchanged; this phase adds no size, weight or family.

| Emphasis level | Token | Weight | Phase 12 use |
|---|---|---|---|
| 1. Panel title | `--text-heading-sm` | its own heading weight | The sheet title; `Suggested by AI`; `Claims to check` |
| 2. Body | `--text-body` | 400; 500 for header line 1, the review bar count, suggestion titles and source titles | Header, review bar, claims, suggestions, notices, sheet values |
| 3. Caption | `--text-caption` | 400; 500 for badges (the §3.10 badge pair) and citations | Notes, hints, header line 2, citations, rationales, the digest |
| 4. Micro-label | `--text-micro` | 400 | `Sources`, sheet group headings and labels, `Requestor’s answer` |

Four text sizes carry every new element. Button labels keep `--text-button`. The GSD checker's two-weight heuristic is superseded by the adopted scale (ADR 0001 gap 8), as in Phases 06.5 to 11. Throughout:
- no uppercase outside `--text-micro`;
- `--font-mono` only for the digest;
- `tabular-nums` on every count.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas, header card, suggestion cards, sheet, popover |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-text-secondary`, `--color-bg-scrim` | Skeletons, hairlines, notes and captions, the sheet's scrim |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--focus-ring` | Only as listed below |
| Status (§3.5) | warning (`AI proposed`, `No source cited`, `Claims to check`, the hub refusal alert); success fg (`All AI proposals reviewed` icon); danger (rollback toasts) | Always with an icon and words |
| Severity (§3.6) | `--color-risk-*` | `RiskRatingBadge`, unchanged |
| Destructive | `--color-danger-solid` | None added |

Ink is reserved for:
- the unchanged primary buttons (`Save risk`, `Save assessment`, `Save question`, the Generate actions);
- record links and figure links, which are the header review link, the citations and the source links;
- focus rings.

`Confirm remaining`, `Add as planned control`, `Show what the AI used`, `Try again`, the toggle and `Undo` are outline. `Confirm`, `Dismiss` and `Restore` are ghost. No new hue. AI is never given a colour of its own.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Side sheet open and close | §5 "Drawer / side panel" (260ms expo); fade only under reduced motion |
| Source popover | §5 "Dropdown / popover / menu"; bottom sheet as the drawer row |
| Toasts | §5 "Dialog / toast" |
| Marker and row pending state | The §5 Optimistic UI pending opacity, applied without a transition |
| Rollback | Opacity at `--duration-base`, `--ease-standard` (§5 Optimistic UI, 150–250ms) |
| Marker and note swaps; the dismissed toggle | None: in place |
| Skeleton shimmer | §4 Skeletons; static under reduced motion |

Nothing auto-advances or polls. Reduced motion needs no new rule beyond the global one.

---

## Proposed CSRM extensions

For the orchestrator to accept, and plan 12-13 to record in `docs/design/csrm-design-direction.md` before the implementing tasks run. None introduces a value; each names a pattern over existing tokens. Numbering continues after Phase 11's X-10 (UI-D30).

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-11 | §4 Status & risk badges, new "AI provenance" entry | AI markers, notes, header and notice | "**AI provenance (CSRM extension, 2026-10-01).** AI-written content is marked until a Security Analyst reviews it. A field or question still awaiting review carries the status badge `AI proposed` (warning recipe, `Sparkles`), because it is work waiting on a Security Analyst; a statement that cites no source carries `No source cited` (warning recipe, `Unlink`). Both are values in the one shared status mapping. Once reviewed, the badge gives way to a provenance note: a 12px icon and `--text-caption` text in `--color-text-secondary`, with no fill or border, such as `Confirmed` (`Check`), `Edited` (`PenLine`) or `Added by analyst` (`UserRoundPen`); a note is not a status badge. A marker sits on its field's label row after the label, and the field's control names it in its description. A record generated with AI opens with a provenance header: a `--color-bg-surface` card with a `--color-border-default` hairline, `--radius-lg` and the Cards padding, a 16px `Sparkles` in `--color-text-secondary`, who asked for the generation in `--text-body` at 500, when and with which provider and model in `--text-caption`, and how much review remains. A Requestor never sees a marker, provider or model; where AI assisted, their page says so in one `--text-body` sentence in `--color-text-secondary` beside a 16px `Sparkles`. AI has no colour of its own, and AI content is never styled as final." | D-35 asks for a recorded marker; the direction has status badges but no provenance vocabulary, and the tone vocabulary's "waiting on a Security Analyst" is exactly an unreviewed proposal. |
| X-12 | §4 Record links, new "Source citations" entry | Citations and the source popover | "**Source citations (CSRM extension, 2026-10-01).** A statement that cites its sources is followed by a `Sources` micro-label and a wrapping list of citations, each `{kind}: {label}` in `--text-caption` at 500 with the record-link treatment and 4px block padding, so each target is at least 24px tall. A citation keeps one line, ending in an ellipsis beyond 28rem, with its full text in the DOM. A citation that can show its source is a button that opens it: from 768px a `Popover` (`--radius-lg`, `--shadow-overlay`) no wider than the confirm dialog size, below 768px a bottom sheet; the source shows its label, its value as recorded and a record link to where it lives, and loads with a skeleton after 300ms. A citation whose source has nothing more to show is plain text. A statement with no source shows the `No source cited` badge instead of the list." | D-14 needs citations beside every statement field; the direction's record links open records, not sources in place. |
| X-13 | §4 Dialogs, new "Side sheet" entry | Side sheet | "**Side sheet (CSRM extension, 2026-10-01).** Supporting detail read beside the page, such as what an AI run used, opens in a side sheet. From 768px it is a full-height panel at the end edge, at the form dialog width (640px) bounded by the viewport, on `--color-bg-surface` with a 1px `--color-border-default` start edge and `--shadow-overlay`, over `--color-bg-scrim`, entering per the §5 drawer row and fading only under reduced motion. Below 768px it is a full-screen sheet with a visible title row and a `Close` control, as quick find's phone sheet is. Its title is an h2 in `--text-heading-sm`; its groups are h3 `.micro-label` headings over definition lists, 24px apart; its body scrolls inside it. Focus moves to the title on open and returns to the trigger on close; `Escape` closes it." | D-07 and D-36 need a disclosure with a phone sheet; the direction names a row-detail sheet for tables only. Phases 13 and 14 can reuse it. |
| X-14 | §4 Toasts | Undo toast | "**Undo toast (CSRM extension, 2026-10-01).** A reversible action applies at once and confirms with a success toast that names what changed and offers `Undo` as an outline small pill inside the toast. It follows the success timing (5s), pausing while hovered or while focus is inside it, and `Alt+T` moves focus to the toast region. `Undo` reverses exactly that action and confirms with a plain success toast; if the action fails, its change rolls back and a danger toast says why, with `Try again` or `Refresh page`. What an Undo reverses can still be corrected on the page after the toast closes. Reversible actions never ask for confirmation; governance-significant, irreversible steps always do." | G-4 and D-36 make Undo the pattern for reversible actions; the direction's toasts name rollback but not Undo. |

---

## Decisions recorded

Made without asking, as this phase's discussion and UI contract run in auto mode. Each follows the locked context, `AGENTS.md`, the glossary and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | The analyst's review act is `Confirm`, and its state is `Confirmed`. The API keeps `accept`. | The glossary (G-14, 2026-10-01) reserves Accept for the risk owner's decision. `Accept` is also a treatment action value the AI may propose, so an "Accept" button beside a proposed "Accept" would be ambiguous. D-35 leaves exact copy to this contract. For the orchestrator to confirm (Notes carried). |
| UI-D2 | `AI proposed` uses the warning status recipe. Reviewed states are quiet notes, not badges. | The tone vocabulary: work waiting on a Security Analyst is warning. Reviewed is terminal and needs no tint. One shared mapping owns the badge. |
| UI-D3 | Markers sit on the label row; `Confirm` sits outside the `label`; the control's description includes the marker. | Clicking a label must not trigger a button. A screen-reader user meets provenance on the field itself. |
| UI-D4 | `Confirmed` and `Edited` notes stay until release. | This reconciles D-23 (the proposed marker goes when reviewed) with D-35 (the "Edited" and "Accepted" markers), and keeps what was reviewed visible during review. |
| UI-D5 | A changed but unsaved proposed field shows `Edited, not saved`, loses `Confirm`, and is skipped by `Confirm remaining`, with a caption that says so. | No lost input. Confirming would contradict the analyst's unsaved edit; the save marks it `Edited` (D-21). |
| UI-D6 | No assessment-wide "confirm all". | The review per Risk is the point (INT-06, the core value). D-35 names per-Risk and assessment-details actions only. |
| UI-D7 | After `Confirm`, focus moves to the next `Confirm` in the form. | It gives a fast keyboard review path and keeps focus from being lost on a removed button. |
| UI-D8 | Citations are link-styled buttons in a list, not pills. | A dense, footnote-like presentation. Pills would crowd seven fields per Risk. The record-link treatment already means "opens something". |
| UI-D9 | Answer and request citations open the source; system and asset citations are plain text. | The run keeps no Requestor text, so the answer and the request value are read from existing reads (D-03). A system or asset citation's name and classification are already the whole fact. |
| UI-D10 | `Claims to check` is warning while a proposal remains, a neutral reference afterwards, and hidden after release. | Flags push the analyst to check (research A4). After review it is evidence, not an alarm. D-23 hides everything but the header after release. |
| UI-D11 | Suggestions sit under the Risk's mitigation controls; dismissed ones hide behind a toggle with `Restore`. | An added suggestion appears directly above as a Planned control. Decision 6 records dismissals, so they stay reachable. |
| UI-D12 | `Add as planned control` waits for the server. Its `Undo` sends `restore` for the suggestion, which removes the Planned implementation it created, only while that implementation is unchanged and the assessment is editable. A refused Undo shows `The planned control has changed since it was added, so it stays. Remove it from the risk if it should go.` | Creation needs the record's id. G-4 asks for Undo on reversible actions. The orchestrator confirmed this reading of D-24's `restore` on 2026-10-01 (12-CONTEXT, Orchestrator Confirmations). |
| UI-D13 | Undo toasts use the direction's 5s success timing, set explicitly (sonner's default is 4s), pause on hover and focus, and are reachable by `Alt+T`. | No new duration; the direction's toast rule; WCAG 2.2.1 with a durable path on the page. |
| UI-D14 | The readiness label is `Review of AI proposals`. | It reads correctly in Phase 10's `Missing: …` caption and in the met list (research Open Question 3). |
| UI-D15 | The header shows the provider label and model verbatim. | They are the operator's configured values (`providerLabel`, `model`); data is shown verbatim. |
| UI-D16 | The trigger reads `Show what the AI used`; the sheet's title is `What the AI used`. | A verb-first control (checker Dimension 1) with D-07's name for the disclosure. |
| UI-D17 | The disclosure is a side sheet, and its groups are an extensible list. | The editor stays visible beside the sheet. Notes (Phase 13) and attachment text (Phase 14) add groups (D-08) without a new layout. |
| UI-D18 | The header's review count links to the first record with proposals; the sheet's figures do not link. | G-4: a figure opens its records. The sheet's figures describe one run, and their items are listed beside them. |
| UI-D19 | Question markers read `AI proposed`, `Edited` and `Added by analyst`. The release dialog says release records the review. | D-22's three origins. Release accepts the set, so its confirmation says so. |
| UI-D20 | `Help text` follows `Question text` in the X-5 form; rows show `Help text: {text}`. | The help text belongs to the question; the prefix distinguishes it from the question in analyst rows. |
| UI-D21 | The Requestor's introduction adds one AI sentence and a `Not sure` variant of paragraph 3. | D-23 and D-13 (Phase 10), and the paragraph 3 variant keeps the Phase 10 sentence's advice. |
| UI-D22 | The released notice says AI "helped prepare the first draft" and an analyst "reviewed it". | This is true for pre-Phase 12 records too, and it never names a provider (D-23). |
| UI-D23 | The hub shows the request's classification in the allowed state as well. | The analyst sees what kind of information will be sent before choosing to send it (G-3). |
| UI-D24 | Refusals name whom to contact and never suggest another way to produce the record. | No non-AI path exists to create a questionnaire or a draft (Notes carried). |
| UI-D25 | The draft card's running copy names the request, its systems and assets. | INT-05 changes what the draft draws on, and the copy must stay true. |
| UI-D26 | The Treatment action notes explain an AI-proposed Accept and a downgrade. | D-11 records the adjustment, and showing it keeps the analyst informed. |
| UI-D27 | Classification shows `Taken from {asset}`; a missing Risk Type has its own note. | D-13 and D-09; the note tells the analyst that leaving the Risk Type unset is a valid choice. |
| UI-D28 | Ratings carry no derivation caption in Phase 12. | The editor's likelihood and consequence inputs stay free (D-10), so a caption could disagree after an edit. Phase 18 brings the derived rating. |
| UI-D29 | Records generated before Phase 12 show the header with one explanatory sentence and no disclosure. | D-23; no run exists to show. |
| UI-D30 | Extensions are numbered X-11 to X-14. | They continue Phase 11's X-10 (STATE.md Decisions). |
| UI-D31 | The actor and time of each review decision are not shown in Phase 12. | They are kept in the run's decisions log (D-21). A per-field history view is not in scope, and a hover-only display is not allowed. |

---

## Notes carried

- **UI-D1, settled (orchestrator, 2026-10-01).** `Confirm` replaces D-35's quoted "Accept" and "Accepted" in visible copy, because the glossary reserves Accept for the risk owner (G-14). The API vocabulary (`accept`, the `accepted` state) is unchanged. Plan 12-16's glossary entry for "AI proposal" says that an analyst confirms or edits it.
- **UI-D12, settled (orchestrator, 2026-10-01).** D-24's `restore` covers an added suggestion and removes the Planned implementation it created, but only while that implementation is unchanged and the assessment is editable. A refused Undo shows the UI-D12 copy, whose next step is Phase 10's `Remove mitigation control`.
- **No non-AI path, routed (orchestrator, 2026-10-01).** No served operation creates a questionnaire or an assessment draft without generation, so a policy refusal blocks the request's workflow until an administrator acts. The copy says so honestly (UI-D24). A manual start path goes to Phase 22, which owns the AI data policy setting. Development has no ceiling by default.
- **Toaster.** The shipped `Toaster` sets no duration (sonner's default is 4s) and leaves sonner's own action-button style. Undo toasts set 5s and style `Undo` as the outline small pill (X-14) through the toast's class names, without changing other toasts.
- **Route budget.** The editor route is at 89.9% of its budget (R-08-34). The header and the Requestor notice render on the server. Markers, the review bar, citations and suggestions are small zod-free client pieces. The sheet and the source content load with `next/dynamic` from a Client Component (D-36; research Pitfall 7). `performance.spec.ts` stays green.
- **Phase 17.1 (G-14).** An AI-proposed treatment action is the analyst's recommendation once confirmed (glossary). Phase 17.1 decides how a recommendation is labelled beside the owner's decision; this contract adds nothing there.
- **Phases 15 and 16** reuse X-11 for run-scoped proposals, and the decision operation's toasts and focus rules (§6).

---

## UI Considerations

These rows are written inline from the contract. The ui-phase consideration probe (Step 9.5) replaces them when it runs.

Applicable state considerations resolved: 31 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| empty | Provenance header | covered | Not rendered without a served `generation` block (§1) |
| empty | Review bar; markers | covered | Not rendered for records or fields with no AI facts (§3.1, §3.2) |
| empty | Citations | covered | `No source cited` with its caption (§4.1) |
| empty | Suggestions | covered | None suggested and all-dismissed copy (§5) |
| empty | Side sheet groups | covered | `None selected`; an inapplicable group does not render; 404 shows `No AI run record` (§2) |
| loading | Side sheet; source | covered | Nothing for 300ms, then layout-matching skeletons (§2.4, §4.2) |
| loading | Header; markers; suggestions | covered | Rendered with their page; the page skeletons gain the header block (§12) |
| loading | Add as planned control | covered | `Adding…` with the inline button spinner; the row's other action is disabled (§6.1) |
| error | Decisions | covered | Rollback, a danger toast and family J copy with `Try again` or `Refresh page` (§6.1, §6.3) |
| error | Side sheet; source | covered | `We couldn’t load …` with `Try again` (§2.4, §4.2) |
| error | Hub | covered | Refusal alerts, failure codes and enqueue refusals (§11) |
| error | Unparseable AI facts | covered | Fail safe: no header, no markers, the read never fails (§12; research Pitfall 11) |
| permission | Sheet; source; decisions | covered | §2.4, §4.2, §6.3 |
| populated | Every surface | covered | §1 to §11 |
| partial | Markers | covered | Mixed states per field, including changed-unsaved (§3.1) |
| partial | Header | covered | Pre-Phase 12 and released variants (§1) |
| partial | Assets in the sheet | covered | `Not classified` when absent (§2.2) |
| partial | Questions | covered | A null origin shows no marker; a null help text adds no line (§8.2, §8.3) |
| overflow | Citations | covered | Clamped to one line at 28rem, full text in the DOM, the list wraps (§4.1) |
| overflow | Side sheet | covered | The body scrolls inside the sheet; the digest wraps (§2) |
| overflow | Review bar; header; suggestion rows | covered | Stack at 375 with full-width actions (§1, §3.2, §5) |
| overflow | Risk card header with the extra badge | backstop | `{ statement: "At 375px the Risk number, the residual rating badge and the AI proposed badge wrap within the card header without horizontal overflow", verification: backstop }` |
| long-text | Claims; rationales; help text; source values | covered | Wrap, with `whitespace-pre-wrap` where text is free-form (§4.2, §4.3, §5, §8.3, §9.1) |
| long-text | Question list in the sheet | covered | Clamped to two lines with the full text in the DOM (§2.2) |
| long-text | Toasts with long control labels | backstop | `{ statement: "A toast naming a long control label wraps inside the toast at 375px and its Undo stays fully visible and reachable", verification: backstop }` |
| zero-one-many | Counts | covered | Singular and plural written out: `field|fields`, `question|questions`, `Type was|Types were` (§1, §2, §3.2) |
| zero-one-many | Suggestions; claims; citations | covered | One or many render alike; zero uses the empty copy (§4, §5) |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | None new. The existing `Sheet`, `Popover`, `Skeleton`, `Badge`, `Button`, `Card`, `Alert`, `Textarea`, `Label`, `Separator` and `sonner` `Toaster` | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

No new dependency.

---

## Verification contract

- **Unit and component (vitest):**
  - the `aiReview` family in the status mapping;
  - header variants: current, outstanding, all reviewed, questionnaire counts, pre-Phase 12, released; no rendering without `generation`;
  - markers: every state, including changed-unsaved and the return to `AI proposed`; the description wiring; `Confirm` outside the `label`;
  - the review bar: counts, the skipped-changes caption, all reviewed;
  - the pre-fill and treatment-action notes;
  - citations: kinds, plain system and asset items, names, `No source cited`; the source's four states;
  - claims: both treatments, hidden after release;
  - suggestions: every state, the toggle, focus;
  - decisions: optimistic apply, rollback with copy, `Undo` and its result toast, focus after each event, batch size for `Confirm remaining`;
  - the sheet: all five states and both operations' groups;
  - help text in the form, rows and renderer; the release description variant;
  - Requestor: the intro sentences and the notice; no `Generated by`; no provider, model or marker anywhere in the Requestor's tree;
  - the hub: allowed caption, refusals, failure codes;
  - the copy guard.
- **Contract parity:** every widened or new parser joins `contract-response-parity.test.ts` (D-02).
- **E2E** (dev servers stopped): the §14.1 rows. Zero serious axe violations at 375 and 1440 on each state the Accessibility contract lists.
- **Browser backstops** (orchestrator): the two UI Considerations backstops; NVDA reading a field's marker in its description, a toast's `Undo` reached by `Alt+T`, and the sheet's focus return; the live-model UAT-A re-run (D-38) judged against §3 to §5 on the hosted provider.

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
