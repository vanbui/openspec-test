---
phase: "10"
slug: "existing-flow-gap-closure"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-09-27"
reviewed_at: "2026-09-27"
---

# Phase 10 — UI Design Contract

> Visual and interaction contract for the fixes Phase 10 makes to today's request, questionnaire, assessment and administration screens: the question editor's in-place forms and section chooser (D-04 to D-06), the analyst's view of a released questionnaire (D-07), replacing a questionnaire (D-08 to D-10), the Requestor's first screen, autosave and leave warning (D-11 to D-13), arrow-key radios (D-14), truthful submission copy (D-15), local time and question text in timelines (D-17 to D-19), the shared request context and server-state actions (D-20, D-21), refusal reasons (D-22), the analyst route gate and plain permission copy (D-23, D-24), generation status on return (D-25, D-26), the shared record picker, owner search, date input and save confirmations (D-28 to D-33), the released assessment (D-34), the readiness summary (D-35), reference data (D-36, D-37) and the copy sweep (D-38). It introduces no colour, type size, weight, family, radius, shadow, spacing step or duration of its own. Five patterns the direction does not yet name are proposed as CSRM extensions (X-1 to X-5).

---

## Binding inputs and value authority

- **Locked decisions.** D-01 to D-40 in `10-CONTEXT.md` govern this contract. It fixes the exact copy the research asks for (D-08, D-13, D-15, D-24, D-33, D-35, D-38) and the layout and behaviour of every interface decision (D-04 to D-38). Where a decision leaves a choice open, this contract makes it and records the reason under "Decisions recorded" (UI-D1 to UI-D31).
- **Value authority.** `docs/design/csrm-design-direction.md`, adopted by `docs/adr/0001-adopt-bproton-design-system.md`, is the only value-bearing authority. This file names semantic tokens and cites the direction by section (§). It restates no colour, size, spacing, radius, shadow or duration.
- **Extensions.** Patterns the direction does not define are listed under "Proposed CSRM extensions" (X-1 to X-5) with the exact wording to record. A plan task records each accepted extension in the direction before the implementing task runs. Executors take values from the direction, not from this file.
- **Requirements.** REQ-07, QUES-08, QUES-09, ASSESS-06, ASSESS-07, ADMIN-05 and UX-06. Acceptance bar: ROADMAP Phase 10 success criteria 1 to 6.
- **Findings closed.** UAT-005, 006, 007, 009, 010, 011, 015, 016, 019, 020, 021, 022, 023, 024, 033, 034, 036, 037, 041, 053, 054, 062 and 064.
- **Operator defaults adopted** (`10-CONTEXT.md` operator decisions): the analyst sees the Requestor's answered count and never answer content before submission (D-07); licensed or descriptive control titles wait for decision 15, so Phase 10 fixes the display rule and the public APP titles only (D-36); "Released" is the display label (decision 16, used in §15). **Superseded 2026-09-28 by `10-CONTEXT.md` D-46:** control titles now load in this phase (plan 10-22), the framework's own names where it has them and short descriptive titles otherwise; the untitled label remains only as the fallback (D-42).
- **Domain vocabulary** is the JDL's: Assessment Request, Questionnaire, Question, Risk Assessment, Risk, Risk Type, Control, Control Implementation (shown as "mitigation control"), Information System, Information Asset, Security Analyst, Requestor. "Control" in copy means a library record (`CsrmControl`); "mitigation control" means its use on a Risk (`CsrmControlImplementation`). No competing entity is introduced.
- **Corrections to the research made while writing this contract.** The shell header is sticky (`globals.css` `.header`, `position: sticky`), not absent as research §UAT-005 says; the existing `html` `scroll-padding-top` already keeps a focused field clear of it (WCAG 2.4.11), so focus management needs no extra offset. Three E2E breakages the research table does not list are in §19.1 (rows E3, E9 and E14).

---

## Design system

| Property | Value |
|----------|-------|
| Tool | shadcn/ui, source-owned local components (`apps/csrm/components.json`: style `new-york`, RSC, CSS variables, neutral base, `iconLibrary: lucide`) |
| Preset | new-york; neutral base; CSS variables; RSC; Lucide icons |
| Component library | Radix primitives through the installed `radix-ui` package (1.6.7), composed by the local shadcn/ui components |
| Icon library | `lucide-react` 1.30.0, per §4 Iconography |
| Font | Plus Jakarta Sans for UI text, data and numbers; Instrument Serif for page titles only; IBM Plex Mono for micro-labels and machine identifiers (§3.10, ADR 0001 gap 8) |
| Tokens | Semantic tokens in `apps/csrm/app/globals.css`, whose values are the direction's; feature code consumes the mapped utilities only |
| New dependencies | None. The picker composes the installed `Popover`; the leave warning composes the installed `AlertDialog`; time zone detection uses the platform `Intl` API |

---

## Component inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-09-27.

A non-exhaustive list of the known-good components this phase uses, never a closed allowlist. The full set is `alert-dialog`, `alert`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `checkbox`, `command`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `pagination`, `popover`, `progress`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea` and `tooltip`.

| Component | Import path | Phase 10 use |
|---|---|---|
| `AlertDialog` (through `ConfirmDialog`) | `@/components/ui/alert-dialog` | Replace confirmation (§3), leave warning (§6.3), submission dialogs (§8) |
| `Popover`, `PopoverAnchor`, `PopoverContent` | `@/components/ui/popover` | The record picker's listbox (§13.1), as the shipped `OwnerCombobox` does |
| `Input` (`type="date"`) | `@/components/ui/input` | The exemption review date (§13.3), as every other date field |
| `RadioGroup`, `RadioGroupItem` | `@/components/ui/radio-group` | Arrow keys select (§7); the fix lives in this wrapper |
| `Progress` | `@/components/ui/progress` | The analyst's released-questionnaire progress (§2) |
| `Button`, `Textarea`, `Checkbox`, `Label`, `Alert`, `Card`, `Badge`, `Separator`, `Skeleton`, `Table` | `@/components/ui/*` | Unchanged uses |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-09-27.

A non-exhaustive list; the executor may use any exported primitive.

| Primitive | Path | Phase 10 change |
|---|---|---|
| `ConfirmDialog` | `components/csrm/confirm-dialog.tsx` | Reused for every confirmation. Gains a controlled mode (no trigger) for the leave warning (§6.3); anatomy unchanged |
| `StatusBadge`, `statusPresentation` | `components/csrm/status-badge.tsx` | Reused unchanged: treatment status on the released view (§15), request and questionnaire badges |
| `RiskRatingBadge` | `components/csrm/risk-rating-badge.tsx` | Reused on the released view (§15) |
| `PageHeader` | `components/csrm/page-header.tsx` | Unchanged; permission states keep their route headings (§11) |
| `DetailSection`, `FormSection` | `components/csrm/*` | Request context groups (§9.1), released view groups (§15) |
| `RecordLink` | `components/csrm/record-link.tsx` | Unchanged treatment; guarded by the navigation guard on the Requestor questionnaire (§6.3) |
| `SegmentedControl` | `components/csrm/segmented-control.tsx` | Arrow keys select (§7) |
| `RevertAuditSummary` | `components/csrm/revert-audit-summary.tsx` | Local time and no id as a name (§4.4) |
| `PermissionDeniedState`, `ErrorState`, `EmptyState` | `components/states/states.tsx` | Permission description rewritten (§11.2); headings stay locked |
| `OwnerCombobox`, `RelationMultiSelect` | `features/assessments/owner-combobox.tsx` | `OwnerCombobox` now serves the control owner (§13.2) and the Information System owner shows a name (§16.4) |
| **New:** record picker | recommended `components/csrm/relation-picker.tsx` | The single-record, server-backed picker of §13.1 (X-2) |
| **New:** save status | recommended `components/csrm/save-status.tsx` | The inline save state of §6.1 and §13.4 (X-1) |
| **New:** navigation guard | recommended `components/csrm/navigation-guard.tsx` | Context, provider and guarded link for §6.3 |
| **New:** request context | recommended `features/requests/request-context-details.tsx` | The shared read-only request fields of §9.1 |
| **New:** released risk facts | recommended `features/assessments/released-risk-details.tsx` | One read-only risk and control rendering for both actors (§15) |

Names and paths of new modules are the planner's (CONTEXT, Planner's Discretion). Zod stays out of every new client module (`zod-client-boundary.test.ts`).

---

## Token names used in this contract

Naming only; every value lives in the direction.

| Direction token | Utility or class in the shipped code |
|---|---|
| `--color-bg-surface` / `--color-bg-inset` / `--color-bg-hover` | `bg-surface` (`bg-card`) / `bg-surface-muted` (`bg-muted`) / `bg-surface-hover` |
| `--color-text-primary` / `--color-text-secondary` / `--color-text-muted` | `text-foreground` / `text-foreground-secondary` / `text-muted-foreground` |
| `--color-border-default` / `--color-border-strong` | `border-border` / `border-border-strong`, `border-input` |
| `--color-success-fg`, `--color-warning-*`, `--color-danger-fg`, `--color-danger-solid` | `text-success`; `border-warning-border bg-warning-subtle text-warning`; `text-destructive`; `Button variant="destructive"` |
| `--color-primary` / `--color-on-primary` | `Button` default variant; checked radio and segment |
| `--focus-ring` | global `:focus-visible` outline; `ring-ring` |
| `--radius-md` / `--radius-lg` / `--radius-2xl` / `--radius-full` | fields / cards, popovers, inline forms / dialogs / buttons |
| `--text-heading-sm` / `--text-body` / `--text-caption` / `--text-micro` | `text-heading-sm` / `text-sm` / `text-xs` / `.micro-label` |
| `--shadow-overlay` | `PopoverContent`, `AlertDialogContent` |
| `--spacing-header-h-sm` / `-md` | `html` `scroll-padding-top` (existing) |

---

## Voice, formats and shared copy rules

These apply to every string in this contract.

- **Voice** (§2 BProton "Voice"): Australian English, sentence case for headings, labels, buttons and links, a spaced hyphen ( - ) instead of an em dash in prose, and verb-first calls to action of two to three words. Contractions use the typographic apostrophe (’), as the shipped state primitives do (`couldn’t`, `don’t`).
- **Separators** (X-4): a spaced middle dot ( · ) joins an identifier to a name or to a second fact (`RAR-2026-5WWFVQ · Brightwage People`, `APP-11 · Security of personal information`), because identifiers themselves contain hyphens. A spaced hyphen replaces an em dash in prose. No new copy contains an em dash. Data is shown verbatim, so a stored framework name that contains an em dash keeps it.
- **Record terms.** `Security Analyst`, `Requestor`, `Risk`, `Risk Type` and `Assessment Request` keep their capitals in new copy; "control" means a library control and "mitigation control" its use on a Risk; stored enum values display verbatim (`Not Started`, `Partially Effective`).
- **Dates and times** (X-3, D-19):

  | Value | Format (en-AU) | Zone | Example |
  |---|---|---|---|
  | Calendar date (Strapi `date`, JDL `LocalDate`) | as each surface formats it today | none | `30 Oct 2026`, `30 October 2026` |
  | Instant shown as a date | as the surface formats it today | viewer's zone; never a suffix | `27 Sept 2026` |
  | Instant shown with a time of day | `{d MMM yyyy}, {h:mm am}` | viewer's zone | `27 Sept 2026, 3:47 pm` |
  | Time of a save | `{h:mm am}` | viewer's zone | `3:47 pm` |
  | Any time of day while the zone is unknown | as above, then ` UTC` | UTC | `27 Sept 2026, 5:47 am UTC`, `5:47 am UTC` |

  The zone is unknown only before the shell's first zone sync sets its cookie (§4.5).
- **Dismiss labels.** A new dialog or inline form in this phase names its dismiss action (`Keep this questionnaire`, `Keep answering`, `Discard changes`), following the shipped `Keep editing`, `Keep mitigation control` and `Discard mitigation changes`. Existing dialogs whose descriptions this phase rewrites keep `ConfirmDialog`'s locked default dismiss label, `Cancel`. That label dismisses; it is never a call to action (UI-D4).
- **No back-end or internal terms** (D-38): §17.2 lists the terms and the files the copy guard scans.

---

## 1. Questionnaire governance editor (D-04, D-05, D-06; UAT-005, UAT-016)

**Surface:** `/app/review/questionnaires/{id}` in the `analyst-review` state; `features/questionnaires/questionnaire-governance.tsx`.
**Focal point:** the question list with the one open form; the primary action is `Release questionnaire`.

### 1.1 Layout

The governance card keeps its order and adds three things: a per-section add control, forms that open where they are invoked, and one polite announcement region.

1. Heading block (unchanged): `ClipboardPenLine` icon, h2 `Analyst review`, `This questionnaire is visible to Analysts only until it is released.`
2. Editor-level error line, `role="alert"`, for release and return only (D-06).
3. Cleared-answers notice (§1.6), when present.
4. `Release questionnaire` (primary, unchanged). While a question form is open it is disabled, and a caption below it reads `Save or discard the open question before you release the questionnaire.` in `--text-caption` / `--color-text-secondary`.
5. h3 `Question editor` with the editor-level `Add question` (primary, small, `Plus` icon) on the same row (unchanged).
6. **Editor-level form slot:** the editor-level form opens here, directly under the h3 row and above the first section.
7. For each section in section order:
   - h4 `.micro-label` section title (unchanged);
   - the question list (unchanged rows: text, caption `{Answer type} · Required|Optional`, choices caption, `Edit` and `Delete`). **Edit replaces its own row** with the form, inside the same list item;
   - **the section's form slot**, where that section's add form opens, after its last question;
   - **per-section add control**: outline small pill with a `Plus` icon, visible text `Add question`, accessible name `Add question to {section title}` (visible text first, qualifier visually hidden, as the W-9 `Edit question: {text}` names are). `data-print="hidden"`.
8. A visually hidden `aria-live="polite"` region for the save announcements (§1.4).

One question form is open at a time. While it is open, every other `Add question`, `Edit` and `Delete` in the editor is disabled, and so is `Release questionnaire` (UI-D3). `Discard changes` or a successful save re-enables them.

| Viewport | Contract |
|---|---|
| 1440 | Rows keep text left and actions right. The form's fields stop at the §4 Forms maximum field width; its action row is left-aligned; the per-section add control is left-aligned under its list. |
| 375 | Rows wrap with actions below the text (unchanged). The form spans the card; fields are full width; `Save question` and `Discard changes` stack full width at the §4 Buttons touch-target height. No horizontal page overflow at any width from 320. |

### 1.2 The question form

An inline editing well (X-5): `--color-bg-inset` fill, a `--color-border-default` hairline, `--radius-lg` and the §4 Cards padding (lower bound), the treatment the shipped mitigation control editor uses. It is a `<form>` element named by its visible title, so assistive technology lists it as a form region.

| Part | Contract |
|---|---|
| Title | Editor-level add: `Add question`. Section add: `Add question to {section title}`. Edit: `Edit question`. A heading one level below its context (h4 under `Question editor`; h5 inside a section), styled `--text-body` at 500 |
| 1. `Question text` | `Textarea`, required. Receives focus when the form opens. Error: `Enter the question text.` |
| 2. `Answer type` | Native select; options unchanged (`Text`, `Long text`, `Boolean`, `Single select`, `Multi select`, `Date`) |
| 3. `Choices` | Only for `Single select` and `Multi select`. `Textarea`; hint `One choice per line.` (unchanged). Error: `Add at least one choice, one per line.` |
| 4. `Section` | Native select. Options: each section that has an active question, labelled by its title in section order, then `New section`. When two sections share a title, each such option reads `{title} (section {n})`, with `n` its position. Hint: `A question you add or move goes at the end of its section.` Preselected: the invoking section for a section add; the question's section for an edit; the **last** section for the editor-level add (UI-D2) |
| 5. `New section title` | Only when `New section` is chosen, directly under `Section`. `Input`, required, bounded as the section title field is today. Hint: `Shown to the Requestor as a heading.` Error: `Enter a title for the new section.` |
| 6. `Required` | Checkbox (unchanged) |
| Error line | `role="alert"`, directly above the action row, `--text-body` in `--color-danger-fg` with an `AlertCircle` at the §4 Forms error-icon size; the server reason copy is §10.2 G and H |
| Actions | `Save question` (primary; pending `Saving question…`), `Discard changes` (outline). After a `DEFINITION_CONFLICT` refusal a third control, `Reload questions` (outline, small), sits beside the error |

Field errors show directly under their field (§4 Forms: danger-fg `--text-caption` with its error icon), are checked when `Save question` is pressed, and move focus to the first invalid field. `Save question` is never disabled for missing input; the errors say what to fix.

`Reload questions` refreshes the page's data and keeps the form open with what the analyst typed; placement is recomputed from the reloaded questions on the next save.

The form never offers a section rename (D-05).

### 1.3 Placement the form applies (behaviour, no copy)

Placement is computed from the complete question set, removed questions included (D-05; research Pitfalls 2 and 3):
- an existing section sends its stored `{ key, title, description?, order }` unchanged;
- a new section gets a key unique across every question and the next free section order;
- the question gets the next free order within its section;
- an edit sends `section` and `order` only when the section changed.

### 1.4 Focus and announcements (WCAG 2.4.3)

| Event | Focus | Polite announcement |
|---|---|---|
| Any form opens | `Question text`, scrolled into view by `focus()`; the existing `scroll-padding-top` keeps it clear of the sticky header | none (the focus move is the cue) |
| `Save question` succeeds (add) | The new question's row (its text container, `tabIndex={-1}`) in its section | `Question added to {section title}.` |
| `Save question` succeeds (edit) | The saved question's row | `Question saved.` |
| `Save question` fails validation | The first invalid field | none (its error is read with it) |
| `Save question` refused by the server | Stays on `Save question` | the error line (`role="alert"`) |
| `Discard changes` | The control that opened the form: the `Add question` button used, or the question's `Edit` button | none |
| `Delete question` succeeds | The next question row in the section, else the previous one, else the section's `Add question` control | `Question removed.` |

### 1.5 Printing

Every per-section `Add question`, the forms and `Reload questions` carry `data-print="hidden"` (§4 Print refinements). The printed page shows the questions, their captions and their sections only.

### 1.6 Cleared-answers notice (D-17, web half)

| Part | Copy |
|---|---|
| Title | `Answers cleared by this revision` (unchanged) |
| Item | `{question text}` in 500 weight, then `: {explanation}`. The question is resolved by key against the full question set the editor holds, removed questions included. Unresolvable: `A question no longer in this questionnaire` |
| Dismiss | `Dismiss notice` (was `Dismiss`) |

### 1.7 Strings that change

| Location (today) | Current | New |
|---|---|---|
| `questionnaire-governance.tsx:70` | `A select question needs at least one choice.` (editor-level) | `Add at least one choice, one per line.` (under `Choices`, in the form) |
| `:80` | `<strong>{questionKey}</strong>` | `{question text}` (§1.6) |
| `:80` | `Dismiss` | `Dismiss notice` |
| `:100` | `Question details` | `Add question`, `Add question to {section title}` or `Edit question` |
| `:104` | `Section title` (free text) | `Section` (select) and `New section title` |
| `:106` | `Cancel` | `Discard changes` |
| new | — | per-section `Add question` (`Add question to {section title}`); `Reload questions`; `Saving question…`; the release caption; the three announcements |

---

## 2. The released questionnaire for the analyst (D-07; UAT-020)

**Surface:** `/app/review/questionnaires/{id}` in the `awaiting-submission` state (released, not submitted); `questionnaire-review.tsx` (`SafeReviewState`).
**Focal point:** the Requestor's progress, then the released questions.

### 2.1 Layout

Order (additions in bold):
1. Page header: questionnaire title, `{questionnaire number} · {request number}`, status badge (served state) — unchanged.
2. Assessment request link — unchanged.
3. Governance panel: h2 `Released to Requestor`, `Return it to analyst review before changing its questions.`, `Return to analyst review` — unchanged.
4. Awaiting alert: title `Awaiting questionnaire submission` (unchanged, asserted by three suites), new description (§2.2).
5. **Section `Released questions`** (`section aria-labelledby`, h2 `--text-heading-sm`):
   - progress line `{answered} of {total} answered` (`--text-body` at 500, `tabular-nums`), from the summary's served `progress`;
   - the shared `Progress` bar, accessible name `{answered} of {total} questions answered by the Requestor`;
   - the questions grouped by section exactly as the governance rows render them (h3 `.micro-label` section title; per question the text, `{Answer type} · Required|Optional` and `Choices: …`), **without** `Edit`, `Delete` or any answer. Conditional questions are listed like the others.
6. Revert audit summary, revision timeline, `Back to questionnaire reviews` — unchanged.

No answer value, checked state or answer count per question appears. Only the aggregate count crosses before submission (D-07).

| Viewport | Contract |
|---|---|
| 1440 | One column at the page's content width; the progress bar spans the section |
| 375 | Stacked; question text wraps; no horizontal overflow |

### 2.2 Copy

| Element | Copy |
|---|---|
| Awaiting alert description (was `Draft answers remain private until the Requestor submits one complete answer batch.`) | `The Requestor’s answers stay private until they submit the questionnaire. Their progress is shown below.` |
| Section heading | `Released questions` |
| Progress line | `{answered} of {total} answered` |
| Progress bar name | `{answered} of {total} questions answered by the Requestor` |

### 2.3 Governance panel once the questionnaire is submitted (D-22)

In the `submitted` state the panel keeps its heading `Released to Requestor`. Its description and control follow the §10.1 rule for returning to analyst review:

| Condition | Description | Control |
|---|---|---|
| No assessment yet (request `submitted` or `questionnaire-in-progress`) | `Return it to analyst review before changing its questions.` (unchanged) | `Return to analyst review` (unchanged) |
| An assessment exists | `An assessment has been drafted from the Requestor’s answers, so these questions can no longer change.` | none |

---

## 3. Replacing a questionnaire (D-08, D-09, D-10, D-16; UAT-019)

**Surface:** the analyst request hub's `Questionnaire generation` card (`questionnaire-generation-job.tsx`), rendered while the request is `submitted`.

### 3.1 When the action shows

| Questionnaire relation | Active job for the request | The card offers |
|---|---|---|
| absent | none | `Generate questionnaire` (primary, `Sparkles`; unchanged) |
| available, `analyst-review` | none | `Replace questionnaire` (**outline**, `Sparkles`), opening §3.2 |
| available, `released` (not yet answered, so the request is still `submitted`) | none | No action. The hint of §3.3 |
| any | queued or running | The job's status only (§12.1); no Generate or Replace |

### 3.2 Confirmation

| Part | Copy |
|---|---|
| Title | `Replace this questionnaire?` |
| Description, 0 changes | `This generates a new questionnaire from the request and replaces this one. No analyst has changed its questions since it was generated. Requestor answers are never replaced. The new questionnaire stays in analyst review until you release it.` |
| Description, 1 change | `This generates a new questionnaire from the request and replaces this one, discarding the 1 change an analyst made to its questions since it was generated. Requestor answers are never replaced. The new questionnaire stays in analyst review until you release it.` |
| Description, n changes | `This generates a new questionnaire from the request and replaces this one, discarding the {n} changes analysts made to its questions since it was generated. Requestor answers are never replaced. The new questionnaire stays in analyst review until you release it.` |
| Description, count unavailable (the summary read failed or served no count) | `This generates a new questionnaire from the request and replaces this one, discarding any changes analysts made to its questions since it was generated. Requestor answers are never replaced. The new questionnaire stays in analyst review until you release it.` |
| Confirm | `Replace questionnaire` (destructive variant); pending `Replacing questionnaire…` |
| Dismiss | `Keep this questionnaire` |
| Refusal inside the dialog | §10.2 I |

`n` is the served `analystChangesSinceGeneration` (D-16), `tabular-nums`. The same dialog serves the failed-job route of §12.4, replacing today's `Replace and generate again` confirmation.

### 3.3 Released questionnaire hint (D-09)

In place of an action, one line in `--text-body` / `--color-text-secondary`:

`This questionnaire has been released to the Requestor. To replace it, return {questionnaire number} to analyst review first.`

`{questionnaire number}` is a `RecordLink` to `/app/review/questionnaires/{id}`.

### 3.4 The `regenerated` event (D-10)

| Where | Label | Icon | Detail |
|---|---|---|---|
| Analyst timeline (detail) | `Questionnaire replaced` | `Sparkles` (decorative) | `Detail: {explanation}` |
| Requestor history (summary) | `Questionnaire replaced` | `Sparkles` | none; only for an event after the first release (§4.3) |

The server writes the explanation (user-facing, so fixed here):
- `A newly generated questionnaire replaced {n} {question|questions}. {m} analyst {change was|changes were} discarded.`
- When `m` is 0: `A newly generated questionnaire replaced {n} {question|questions}. No analyst changes were discarded.`

---

## 4. Timelines, question names and local time (D-17, D-18, D-19; UAT-024)

### 4.1 Instants and calendar dates on Phase 10 surfaces

| Surface | Value | Kind | Rendering (Voice §) |
|---|---|---|---|
| Revision timeline (both depths) | event `at` | instant, time of day | `27 Sept 2026, 3:47 pm` |
| Revert audit summary `When` | `revertedAt` | instant, time of day | as above |
| Request context and hub | `submittedDate`, `updatedAt` | instant, date only | `27 Sept 2026` (never a suffix; keeps `requestor-request-workflow.spec.ts:225` green) |
| Released assessment | `assessmentDate`, `approvalDate` | instant, date only | `27 September 2026` |
| Released assessment | `nextReviewDate` and every Risk and control date | calendar date | unchanged |
| Autosave and save confirmations | save time | instant, time only | `3:47 pm` |

Other instants (lists, dashboards, alerts, reports) keep UTC until Phase 11 (D-19).

### 4.2 Analyst timeline entries (detail depth)

Each entry keeps its label, icon, `{date}, {time} by {name}`, `Reason:` and `Detail:` lines. The question line changes:

| Case | Line |
|---|---|
| The event carries a text snapshot, or the key resolves under D-17's rule | `Question: {question text}` (wraps with `[overflow-wrap:anywhere]`; the server bounds a snapshot at 500 characters with an ellipsis) |
| The event is older than the latest generation and has no snapshot | `Question: A question from an earlier version`, the value in `--color-text-secondary` |

No entry ever shows a question key.

### 4.3 Requestor history (summary depth)

History moves below the questions (§5.1). It is one dated list, newest first:

| Entry | Label | Icon |
|---|---|---|
| each `released` | `Questionnaire made available to you` (unchanged) | `CircleCheck` |
| each `returned-to-review` | `Questionnaire taken back for analyst review` (unchanged) | `RotateCcw` |
| each release round after the first: the question changes made between a return to analyst review and the next release, after that round's last replacement (no entry when there are none) | `{n} {change|changes} to the questions`, dated by the round's latest change | `FilePenLine` (a neutral change icon, never the bin) |
| each `regenerated` after the first release | `Questionnaire replaced` | `Sparkles` |
| each `answer-cleared` | `An answer was cleared because its question changed` (unchanged) plus its explanation | `UndoDot` |

Changes made before the first release are not listed: the Requestor never saw that earlier version (UI-D9). The notice `Some answers need completing again before you re-submit.` and the empty state `No revisions have been recorded.` are unchanged. The summary never shows a key or an analyst's name.

### 4.4 Revert audit summary

`When` renders per §4.1. `By` is the display name, else `Not recorded`; a document id is never shown as a name (`revert-audit-summary.tsx:32`).

### 4.5 Time zone sync (no visible UI)

A client component in the shell sends the browser's zone once per app load when it differs from the cookie, then refreshes the route. There is no indicator, no focus move and no layout change beyond the times' text losing its ` UTC` suffix.

---

## 5. The Requestor's questionnaire (D-13; UAT-023)

**Surface:** `/app/questionnaires/{id}`; `questionnaire-detail.tsx` and `questionnaire-renderer.tsx`.
**Focal point:** the first question after the introduction; the primary action is `Submit questionnaire` at the end of the form.

### 5.1 Page order

| # | While answering (`not-started`, `draft`) | Once submitted |
|---|---|---|
| 1 | Page header (title, number, status badge) | same |
| 2 | Assessment request link | same |
| 3 | — | `Return to draft`, when §10.1 allows |
| 4 | **Introduction** (§5.2) | The questionnaire description, when present (unchanged) |
| 5 | `Last returned to draft` summary, when present (unchanged) | same |
| 6 | Renderer: attention region (§5.3, only after a submit attempt), the `Questionnaire completion` card with the save status (§6.1), the sections, the action row | Renderer: the submitted notice (§8.2) and read-only answers |
| 7 | **History** (`Revision timeline`, §4.3) | same |

At 375 everything is one column (unchanged). At 1440 the introduction aligns to the renderer's existing column width.

### 5.2 Introduction

A card (`--color-bg-surface`, a `--color-border-default` hairline, `--radius-lg`), `section` named by its heading. No icon.

| Part | Copy |
|---|---|
| h2 (`--text-heading-sm`) | `About this questionnaire` |
| Paragraph 0 | The questionnaire's own description, when present (moved here from above the timeline) |
| Paragraph 1 | `A Security Analyst has sent you {n} {question|questions} about this request so they can assess its cyber risk.` When any question is conditional, append ` Depending on your answers, a few more may appear.` |
| Paragraph 2 | `Your answers save automatically, so you can stop and finish later. Answer every question marked (required) before you submit. The Security Analyst sees your answers only after you submit.` |
| Paragraph 3 | `Not sure of an answer? Give your best answer, and where a question asks for text, say what you don’t know. The Security Analyst can send the questionnaire back to you if they need more detail.` |

`{n}` is the number of questions shown when the page loads, the same count the completion card starts from. Paragraphs use `--text-body`. Nothing here promises a "Not sure" choice (D-13; generated "Not sure" choices are Phase 12).

### 5.3 Questions requiring attention

| Aspect | Contract |
|---|---|
| When | Only after a submit attempt that found unanswered required questions, or after the server returns field errors. Items leave as they are answered; the region disappears when none remain |
| Name and heading | `aria-label="Questionnaire validation guidance"` and h2 `Questions requiring attention` (both unchanged) |
| Intro line | `Answer or correct these questions, then submit again.` |
| Items | Links to each question in **form order** (section order, then question order), text = the question. An unavailable file question reads `{question text} - required but unavailable` (spaced hyphen; was an em dash) |
| Tone | Unchanged warning treatment (§3.5 warning set on the region, heading in warning fg); the words carry the meaning |
| Focus | Unchanged: after a failed attempt focus moves to the first unanswered question, whose own error is read with it |

### 5.4 Where errors show (UI-D29)

| Failure | Shown in |
|---|---|
| A save fails (autosave or `Save draft`) | The save status (§6.1) |
| A submit is refused | Inside the submit dialog, which stays open (unchanged mechanism), with §10.2 D copy |
| Required answers missing, or server field errors | The attention region and each question's own error |

The form-level `Questionnaire not saved` alert retires; nothing it said is lost.

---

## 6. Autosave and the leave warning (D-11, D-12; UAT-021)

### 6.1 Save status (X-1)

The status is the last line of the `Questionnaire completion` card. After an explicit `Save draft`, the same text also shows beside that button as a visual echo marked `aria-hidden="true"`, so it is announced once.

| State | Visible (`--text-body`, `--color-text-secondary`) | Icon | Announced |
|---|---|---|---|
| Idle (no change since load) | empty (height reserved) | — | nothing |
| Saving (a change is waiting or a save is in flight) | `Saving…` | none | not announced |
| Saved | `Saved at {time}` | `CheckCircle2` at the §4 Iconography inline-message size, `--color-success-fg` | politely, whenever the text changes (`role="status"`) |
| Not saved, retryable (network, timeout, 5xx) | `Your latest answers weren’t saved.` with `Retry save` (outline, small) | `AlertCircle` at the inline-message size, `--color-danger-fg` | once (`role="alert"`) |
| Not saved, blocked (403, or a 409 reason in §10.2 C) | the §10.2 C message with `Refresh page` (outline, small; a soft refresh) | `AlertCircle` at the inline-message size, `--color-danger-fg` | once (`role="alert"`) |

`{time}` follows the Voice § time rule. The old sentence `Draft saved. Your answers remain editable.` retires (UI-D10). `Save draft` keeps its label and its pending label `Saving draft…`.

### 6.2 Timing (behaviour)

- A save starts about 1.5 seconds after the last change (planner's discretion within 1 to 2 seconds), and immediately when a field loses focus.
- One save is in flight at a time; changes made during it queue one follow-up save.
- `Save draft` sends a save at once and cancels the pending one.
- A blocked failure stops autosave until the page is refreshed. A retryable failure retries on the next change or on `Retry save`.
- Submitting saves first (unchanged), then submits; autosave pauses while the submit dialog is confirming.
- On `pagehide`, on `visibilitychange` to hidden and when the renderer unmounts, a waiting save is sent at once, with no prompt.

### 6.3 Leave warning

**Armed** while a change is waiting, a save is in flight, or the last save failed (retryable or blocked). **Disarmed** after a successful save and after submission.

| Navigation | Mechanism | What the Requestor sees |
|---|---|---|
| An in-app link: sidebar, mobile navigation sheet, wordmark, the page's `Assessment request {number}` link | `Link onNavigate` consulting the shell's guard context; `preventDefault()`, then the dialog below | The product dialog |
| Reload, close, typing a URL, an external link | `beforeunload` | The browser's own prompt; its text cannot be set |
| Ctrl or Cmd click, middle click | none: a new tab opens and this page stays | nothing |
| Browser Back or Forward | not interceptable in the App Router; the waiting save is sent at once (§6.2) | nothing (a recorded limit, UI-D11) |

Dialog (`ConfirmDialog` in controlled mode, at the §4 Dialogs confirm size):

| Part | Copy |
|---|---|
| Title | `Leave this questionnaire?` |
| Description, waiting or in flight | `Your latest answers are still being saved. If you leave now, they may not be saved.` |
| Description, failed | `Your latest answers weren’t saved. If you leave now, they’ll be lost.` |
| Confirm | `Leave questionnaire` (destructive variant); then the navigation proceeds to the chosen link |
| Dismiss | `Keep answering`; receives initial focus; `Escape` also dismisses |

After `Keep answering`, focus returns to the link that was activated when it is still in the document (in the mobile sheet, the sheet stays open), else to the page's main heading.

---

## 7. Radio groups and the segmented control (D-14; UAT-064)

Behaviour only; no copy or visual change.

| Key | Result |
|---|---|
| ArrowDown, ArrowRight | Moves focus to the next enabled option in the group, wrapping, and checks it |
| ArrowUp, ArrowLeft | Moves focus to the previous enabled option, wrapping, and checks it |
| An arrow with Ctrl, Alt, Meta or Shift | Unchanged (ignored by the group) |
| Home, End | Unchanged |
| Tab, Shift+Tab | One tab stop per group, on the checked option or the first option (unchanged) |
| Space | Checks the focused option (unchanged) |

Each arrow press checks exactly one option and reports exactly one value change, whether the key is released at once or held (research Pitfall 4). The same rule holds for `SegmentedControl` (§4 Forms, segmented control: "Arrow keys move and check").

---

## 8. Submission dialogs and notices (D-15; UAT-022)

No copy calls a reversible step irreversible. Each promise matches the action the page then offers (§10.1).

### 8.1 Assessment Request

| Element | Copy |
|---|---|
| Submit dialog title (detail page and edit form) | `Submit this assessment request?` (unchanged) |
| Submit dialog description (was `Submission is irreversible. This request cannot be edited after submission.`; `request-workflow-actions.tsx:58`, `request-form.tsx:241`) | `A Security Analyst will review your request and send you a questionnaire to answer. Until they start work on it, you can return the request to draft to make changes.` |
| Confirm, pending, dismiss | `Submit request`, `Submitting request…`, `Cancel` (unchanged) |
| Request actions after submission | `Return to draft` (when allowed), the status badge, then `Submitted {date}` as its own paragraph, exactly as today |
| Hint, own paragraph, when return to draft is allowed | `You can return this request to draft to make changes until a Security Analyst starts work on it.` |
| Hint, own paragraph, when the request is `submitted` but work has started | `A Security Analyst has started work on this request, so it can no longer return to draft.` |
| Edit form notice after submitting (was `Submitted {date}. This request can no longer be edited.`; `request-form.tsx:200`) | `Submitted {date}. You can return it to draft from the request page until a Security Analyst starts work on it.` |
| Toasts | `Request submitted.`, `Request returned to draft.` (unchanged) |

### 8.2 Questionnaire

| Element | Copy |
|---|---|
| Submit dialog title | `Submit this questionnaire?` (unchanged) |
| Submit dialog description (was `Submission is irreversible. This questionnaire cannot be edited after submission.`; `questionnaire-renderer.tsx:387`) | `The Security Analyst will review your answers and use them to assess the request’s risk. Until they start the assessment, you can return the questionnaire to draft to change your answers.` |
| Confirm, pending, dismiss | `Submit questionnaire`, `Submitting questionnaire…`, `Cancel` (unchanged) |
| Submitted notice title | `Submitted` (unchanged) |
| Notice, Requestor, return to draft allowed | `Questionnaire submitted. The Security Analyst is reviewing your answers. Until they start the assessment, you can return the questionnaire to draft to change them.` |
| Notice, Requestor, assessment started | `Questionnaire submitted. The Security Analyst has started the assessment, so your answers can no longer change.` |
| Notice, Security Analyst's read-only review | `Questionnaire submitted. These are the Requestor’s submitted answers.` |
| Return to draft description, Requestor (was `This returns the submitted answer batch to draft while preserving its values.`; `questionnaire-detail.tsx:77`) | `Your answers go back to draft so you can change them. Submit the questionnaire again when you’re ready.` |
| Return to draft description, Security Analyst (same old text; `questionnaire-review.tsx:127`) | `The Requestor’s answers go back to draft so they can change them and submit again. Their answers are kept.` |

Every notice variant begins with `Questionnaire submitted.` so four journey assertions stay green (UI-D12). The page passes the variant to the renderer from the §10.1 predicate.

---

## 9. Request pages (D-20, D-21; UAT-015, UAT-037)

**Focal point:** the hub's `Next action` line under the lifecycle stepper, then the request context. On the Requestor's page the `Request actions` region is the primary action area.

### 9.1 Shared request context

One read-only component on both pages: the Requestor's `/app/requests/{id}` and the analyst's `/app/review/requests/{id}`. It spans the full content width on both (it no longer sits in a one-item grid on the analyst page).

- `DetailSection` title `Request context` (unchanged; asserted by two suites). Description on both pages: `The details submitted with this request.` It replaces `The business context submitted with this request.` and `Submitted business context for analyst review.`
- Three groups in the request form's order, each an h3 in `--text-heading-sm` with a definition list:

| Group (h3) | Rows (label: value) |
|---|---|
| `Request overview` | `Description` (wide) · `Assessment type` · `Division` · `Business unit` |
| `Business context` | `Business purpose` (wide) · `Business criticality` · `Third-party involvement` (`Yes` or `No`) · `Third-party details` (wide) · `Regulatory requirements` (wide) |
| `Scope and timing` | `Due date` (calendar date) · `Submitted` (instant, date only; only once submitted) · `Last updated` (instant, date only) · `Information systems` · `Information assets` |

- Labels: `.micro-label` in `--color-text-secondary`. Values: `--text-body` in `--color-text-primary`, `whitespace-pre-wrap` and `[overflow-wrap:anywhere]` for long text.
- Empty value: `Not provided`. An empty system or asset list: `None selected`. Lists render one name per line.
- Layout: one column below 640px; from 640px two columns, with wide rows spanning both. 24px between groups (§3.9 section rhythm), 16px between a group heading and its list.
- `RevertAuditSummary` stays at the end of the section (unchanged).

The group headings never repeat the hub's six h3 names (`Questionnaire`, `Assessment`, `Risks`, `Controls`, `Information systems`, `Information assets`), which `request-relationship-states.spec.ts` filters by exact text.

### 9.2 Actions from server state (D-21)

- The Requestor's request actions derive only from the refreshed request; an in-page submit result never overrides it. Every transition refreshes the route.
- After a successful submit or return to draft, focus moves to the first control of the new action set (`Return to draft`, or `Edit request`), else to the `Request actions` region (`tabIndex={-1}`). The live status badge still announces the new status (unchanged).

### 9.3 Hub copy (D-38)

| Location | Current | New |
|---|---|---|
| `request-hub.tsx:73` (Request summary description) | `Current request context and the next server-directed action.` | `Where this request stands and what happens next.` |
| `:75` | `{requestNumber} — {title}` | `{requestNumber} · {title}` |
| `:91` (Risks card) | `Contextual Risks by residual rating.` | `Risks by residual rating.` |
| `:91` (row names) | `{rating} residual contextual risks: {n}` | `{rating} residual Risks: {n}` |
| `request-form.tsx:270, 288` (unused `AssessmentRelationshipTile`) | the same two strings | the same two replacements |
| `request-form.tsx:232` | `Sponsor selection is unavailable until a least-privilege directory contract exists.` | `Sponsor selection is not available in CSRM.` |

---

## 10. Offered actions and refusal reasons (D-22; UAT-036, UAT-016)

### 10.1 When a backward action is offered

Both actors read the same zod-free predicates over served facts (`relationships` and statuses, never the legacy nullable fields). Strapi still decides.

| Action | Offered only while | Where |
|---|---|---|
| Return request to draft | the request is `submitted` and both the questionnaire and assessment relations are `absent` | Requestor request actions; analyst hub |
| Return questionnaire to draft | the questionnaire is `submitted` and the request is `questionnaire-in-progress` | Requestor questionnaire; analyst submitted review |
| Return to analyst review | the questionnaire is released and no assessment exists (request `submitted` or `questionnaire-in-progress`) | analyst awaiting and submitted views |
| Replace questionnaire | §3.1 | analyst hub |

A hidden action is explained where the page would otherwise mislead: §8.1 hints, §8.2 notice variants and §2.3.

### 10.2 Refusal copy by action and reason

Each Server Action maps the served reason (`error.details.reason`, closed set, names at the planner's discretion within the research families) to the line below. The copy says no more than the relation state the actor is already served (research Pitfall 11).

**A. Return request to draft** (both actors; inside the dialog)

| Reason | Copy |
|---|---|
| `REQUEST_NOT_SUBMITTED` | `Only a submitted request can return to draft, and this one is no longer submitted. Refresh the page to see where it is.` |
| `REQUEST_WORK_STARTED` | `Work on this request has started, so it can no longer return to draft.` |
| none or unknown | `This request can’t return to draft in its current state.` |

**B. Return questionnaire to draft** (both actors; inside the dialog)

| Reason | Copy |
|---|---|
| `ASSESSMENT_STARTED` | `Assessment work has started, so this questionnaire can no longer return to draft.` |
| `REQUEST_NOT_ELIGIBLE` | `The request has moved on, so this questionnaire can no longer return to draft.` |
| `QUESTIONNAIRE_NOT_SUBMITTED` | `Only a submitted questionnaire can return to draft, and this one isn’t submitted. Refresh the page to see where it is.` |
| none or unknown | `This questionnaire can’t return to draft in its current state.` |

**C. Save answers** (Requestor; the save status, §6.1)

| Reason | Copy | Kind |
|---|---|---|
| `QUESTIONNAIRE_NOT_ANSWERABLE` | `This questionnaire is no longer open for answers, so your latest answers weren’t saved.` | blocked |
| `QUESTIONNAIRE_ALREADY_SUBMITTED` | `This questionnaire has already been submitted, so your latest answers weren’t saved. Refresh the page to see the submitted answers.` | blocked |
| `QUESTIONNAIRE_HAS_NO_QUESTIONS` | `This questionnaire has no questions to answer.` | blocked |
| 403 | `You can’t save answers to this questionnaire right now. Refresh the page to see its current state.` | blocked |
| 409 with none or unknown | `Your answers can’t be saved in this questionnaire’s current state.` | blocked |
| 400 with field errors | `Some answers need attention before they can be saved.` (and the §5.3 region lists them) | retryable |

**D. Submit questionnaire** (Requestor; inside the submit dialog)

| Reason | Copy |
|---|---|
| `QUESTIONNAIRE_INCOMPLETE` | `Some required questions are unanswered. Answer them, then submit again.` |
| `QUESTIONNAIRE_ALREADY_SUBMITTED` | `This questionnaire has already been submitted.` |
| `QUESTIONNAIRE_NOT_ANSWERABLE` | `This questionnaire is no longer open for answers, so it can’t be submitted.` |
| `QUESTIONNAIRE_HAS_NO_QUESTIONS` | `This questionnaire has no questions to answer.` |
| none or unknown | `This questionnaire can’t be submitted in its current state.` |

**E. Release questionnaire** (Security Analyst; inside the dialog)

| Reason | Copy |
|---|---|
| `QUESTIONNAIRE_RELEASED` | `This questionnaire has already been released.` |
| `REQUEST_NOT_ELIGIBLE` | `The request has moved on, so this questionnaire can’t be released.` |
| `ASSESSMENT_STARTED` | `An assessment already exists for this request, so the questionnaire can’t be released.` |
| `QUESTIONNAIRE_HAS_NO_QUESTIONS` | `Add at least one question before you release this questionnaire.` |
| `DEFINITION_INVALID` | `Some questions in this questionnaire are inconsistent, so it can’t be released. Contact your administrator.` |
| `HISTORY_UNAVAILABLE` | `This questionnaire’s change history can’t record more changes, so it can’t be released. Contact your administrator.` |
| none or unknown | `This questionnaire can’t be released in its current state.` |

**F. Return to analyst review** (Security Analyst; inside the dialog)

| Reason | Copy |
|---|---|
| `ALREADY_IN_ANALYST_REVIEW` | `This questionnaire is already in analyst review. Refresh the page to see it.` |
| `ASSESSMENT_STARTED` | `An assessment already exists for this request, so the questionnaire can no longer return to analyst review.` |
| `REQUEST_NOT_ELIGIBLE` | `The request has moved on, so this questionnaire can no longer return to analyst review.` |
| `HISTORY_UNAVAILABLE` | `This questionnaire’s change history can’t record more changes, so it can’t return to analyst review. Contact your administrator.` |
| none or unknown | `This questionnaire can’t return to analyst review in its current state.` |

**G. Add or edit a question** (Security Analyst; the form's error line, §1.2)

| Reason | Copy |
|---|---|
| `DEFINITION_CONFLICT` | `Another change reached this questionnaire first, so this question couldn’t be saved where you placed it. Reload the questions, then save again.` (with `Reload questions`) |
| `QUESTIONNAIRE_RELEASED` | `This questionnaire has been released. Return it to analyst review before changing its questions.` |
| `ASSESSMENT_STARTED` | `An assessment already exists for this request, so its questions can no longer change.` |
| `REQUEST_NOT_ELIGIBLE` | `The request has moved on, so this questionnaire’s questions can no longer change.` |
| `QUESTION_REMOVED` (edit) | `This question has been removed. Reload the questions to see the current list.` (with `Reload questions`) |
| `HISTORY_UNAVAILABLE` | `This questionnaire’s change history can’t record more changes. Contact your administrator.` |
| `ANSWER_DATA_INVALID` | `A stored answer to this question is invalid, so the change can’t be saved. Contact your administrator.` |
| none or unknown | `This question can’t be saved in the questionnaire’s current state.` |

**H. Delete a question** (Security Analyst; inside the delete dialog)

| Reason | Copy |
|---|---|
| `QUESTION_HAS_DEPENDENTS` | `Another question is shown only after this one is answered. Change or remove that question first.` |
| `LAST_ACTIVE_QUESTION` | `A questionnaire needs at least one question, so its last question can’t be removed.` |
| `QUESTION_REMOVED` | `This question has already been removed. Reload the page to see the current list.` |
| `QUESTIONNAIRE_RELEASED`, `ASSESSMENT_STARTED`, `REQUEST_NOT_ELIGIBLE`, `HISTORY_UNAVAILABLE`, `ANSWER_DATA_INVALID` | as in G |
| none or unknown | `This question can’t be removed in the questionnaire’s current state.` |

**I. Generate or replace a questionnaire** (Security Analyst; the card's error alert or the replace dialog)

| Reason | Copy |
|---|---|
| `REQUEST_NOT_ELIGIBLE` | `A questionnaire can be generated only while the request is submitted, and this request has moved on.` |
| `QUESTIONNAIRE_RELEASED` | `This questionnaire has been released to the Requestor, so it can’t be replaced. Return it to analyst review first.` |
| none or unknown | `A questionnaire can’t be generated for this request in its current state.` |

### 10.3 Other statuses

The existing 400, 403, 404 and service-unavailable messages of `request-actions.ts` and `questionnaire-actions.ts` are unchanged, except that a 409 now uses the fallbacks above. `Reload and try again` appears only where the reason is a real change by someone else (A `REQUEST_NOT_SUBMITTED`, B `QUESTIONNAIRE_NOT_SUBMITTED`, F `ALREADY_IN_ANALYST_REVIEW`, G `DEFINITION_CONFLICT` and `QUESTION_REMOVED`), worded as `Refresh the page` or `Reload the questions`. The request edit form's own 409 (`updateRequestAction`, not a D-22 family) reads `This request can’t be saved in its current state.`

---

## 11. Analyst routes opened by a Requestor, and permission descriptions (D-23, D-24; UAT-062)

### 11.1 The gate

On `/app/review/requests/{id}`, `/app/review/questionnaires/{id}` and `/app/review/assessments/{id}`, a viewer without `assessment:review` gets the route's existing permission state before any record read. Metadata returns the static title (`Assessment Request Review | IdamBox CSRM`, `Questionnaire Review | IdamBox CSRM`, `Risk Assessment Review | IdamBox CSRM`). The page shows no record fact, no analyst action and no link into `/app/review/`.

| Route | h1 (unchanged) | Alert title (unchanged) | Requestor description | Requestor action |
|---|---|---|---|---|
| Request hub | `Assessment request review` | `You don’t have permission to review this request` | `Reviewing requests is for Security Analysts. Your own requests are in My Requests.` | `Go to My Requests` → `/app/requests` |
| Questionnaire review | `Questionnaire review` | `You don’t have permission to review this questionnaire` | `Reviewing questionnaires is for Security Analysts. To answer a questionnaire sent to you, open it from My Questionnaires.` | `Go to My Questionnaires` → `/app/questionnaires` |
| Assessment editor | `Risk assessment review` | `You don’t have permission to review this assessment` | `Reviewing assessments is for Security Analysts. Assessments released to you are in My Risk Assessments.` | `Go to My Risk Assessments` → `/app/assessments` |

The action is an outline link button, as the existing `Back to …` links are. When an analyst meets the same state through a record refusal, the description and link are the analyst variants of §11.2 (UI-D15). The assessment editor gains a link it lacks today.

Because the gate runs before any read, a Requestor sees the same permission state for any id, existing or not, so it confirms nothing about a record.

### 11.2 Permission descriptions (D-24)

Headings stay locked. Each description says what the person can do instead.

| Surface (file:line) | Current description | New description | Action |
|---|---|---|---|
| Shared `PermissionDeniedState` (`states.tsx:129`) | `Access is determined by your effective CSRM capabilities. Navigation visibility is not an authorization control.` | `Your workspace shows the work you can open. If you think you should have access, contact your administrator.` | `Return to workspace` (unchanged) |
| Questionnaire review, analyst variant (`questionnaire-review.tsx:35`) | `Access is enforced by your effective CSRM capabilities.` | `You can’t review this questionnaire with your current access. Choose another from the questionnaire reviews.` | `Back to questionnaire reviews` (unchanged) |
| Request hub, analyst variant (`assessment-detail.tsx:47`) | same | `You can’t review this request with your current access. Choose another from the assessment requests.` | `Back to assessment requests` (unchanged) |
| Assessment editor, analyst variant (`assessment-editor.tsx:99`) | `Assessment access is enforced by your effective CSRM capabilities.` | `You can’t review this assessment with your current access. Choose another from the risk assessments.` | `Back to risk assessments` → `/app/review/assessments` (new) |
| Requestor questionnaire (`questionnaire-detail.tsx:33`) | `Access is enforced by your effective CSRM capabilities and record scope.` | `You can open questionnaires sent to you about your own requests. Yours are listed in My Questionnaires.` | `Back to questionnaires` (unchanged) |
| Released assessment (`released-assessment.tsx:109`) | `Access is enforced by your effective CSRM capabilities and owner record scope.` | `You can open released assessments for your own requests. Yours are listed in My Risk Assessments.` | `Back to released assessments` (unchanged) |
| Risk Register detail (`risk-details.tsx:157`) | `Access is enforced by your effective CSRM capabilities and record scope.` | `The Risk Register is for Security Analysts. Your workspace shows the work you can open.` | `Return to workspace` (unchanged) |
| Administration refusal header (`administration-workspace.tsx:100`) | `Access to Administration records is determined by your capabilities.` | `Administration records are managed by Security Analysts.` | — |

---

## 12. Generation status on return (D-25, D-26, D-27; UAT-041)

**Surface:** the analyst request hub's two cards. The hub seeds each card from the jobs read on load; completed jobs are not seeded (D-26).
**Focal point:** a running or failed job's status line takes the place of the card's action, so the card's first line always says what is happening.

### 12.1 Questionnaire generation card

| State | Body | Actions |
|---|---|---|
| Idle, no questionnaire | description `Generate a questionnaire from this request for Security Analyst review.` (was `Generate a contextual questionnaire for analyst review.`) | `Generate questionnaire` |
| Idle, questionnaire in analyst review | same description | `Replace questionnaire` (§3) |
| Idle, questionnaire released | same description, then §3.3 | none |
| Queued or running | status `Questionnaire generation is queued` or `…is running` (unchanged), then `You can leave this page. The status shows here when you come back.` (was `This page remains available while the server-owned job is checked.`) | none |
| Queued or running, started by someone else (`canRetry: false`) | as above, plus `Started by another Security Analyst.` | none |
| Completed (started in this session) | unchanged: `Questionnaire generation is ready for review`, `Provider: {name} ({version}). Review the generated questionnaire before use.` | `Review generated questionnaire` (unchanged) |
| Failed, `canRetry: true` | alert `Questionnaire generation failed` (unchanged) with §12.4 copy | `Retry questionnaire generation` (unchanged), or `Replace questionnaire` for `QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED` (replaces `Replace and generate again`) |
| Failed, `canRetry: false` | the same alert, plus `Only the Security Analyst who started it can retry it.` | `Generate questionnaire` or `Replace questionnaire`, per §3.1 |
| Timed out | `Taking longer than expected` (unchanged), then `Automatic checks stopped after 30 seconds. Generation may still be running.` (was `… The server-owned job remains authoritative.`) | `Check again` (unchanged) |
| Status check failed | alert `Status unavailable` (unchanged) with the action's message | unchanged |

The `Attempt {n}` tag, `aria-live` announcements and polling are unchanged; jobs another analyst started are polled by request.

### 12.2 Assessment draft generation card

The Phase 8 copy stands (08-UI-SPEC §1), with these changes:

| State | Change |
|---|---|
| Queued body (was `The job is waiting to begin. This page will remain available while its status is checked.`) | `Generation is waiting to start. You can leave this page; the status shows here when you come back.` |
| Queued or running, started by someone else | add `Started by another Security Analyst.` |
| Failed, `canRetry: false` | add `Only the Security Analyst who started it can retry it.`; offer `Generate assessment draft` instead of `Retry draft generation` |
| Timed out body | `Automatic checks stopped after 30 seconds. Generation may still be running.` |

`Draft generation can begin only after the linked questionnaire is submitted.` is unchanged (asserted at `questionnaire-generation-workflow.spec.ts:130`).

### 12.3 `Next action` while a job runs

While a seeded or started job is queued or running, the hub's `Next action:` line (the prefix unchanged) reads, as plain text with no link:

| Job | Line |
|---|---|
| Questionnaire generation | `Questionnaire generation is in progress. Review the questionnaire when it’s ready.` |
| Assessment draft generation | `Assessment draft generation is in progress. Open the draft when it’s ready.` |

When the job completes or fails, the server's own next action returns.

### 12.4 Failure copy by code

| `failureCode` | Copy |
|---|---|
| `REQUEST_NOT_ELIGIBLE` | `The request is no longer submitted, so a questionnaire can’t be generated for it.` |
| `QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED` | `A questionnaire already exists for this request. Replace it to generate a new one.` |
| `QUESTIONNAIRE_ANSWERED` | `The Requestor has started answering this questionnaire, so it can’t be replaced.` |
| `QUESTIONNAIRE_RELEASED` (new) | `The questionnaire was released before generation finished, so it wasn’t replaced. Return it to analyst review to replace it.` |
| any other | the server's `failureMessage`, unchanged |

### 12.5 When the jobs read fails

Both cards render their idle actions, and each shows one line above them in `--text-body` / `--color-text-secondary`: `We couldn’t check whether a generation is already running. If one is, starting generation shows its progress instead of starting another.` That promise holds because each registry returns the active job instead of enqueuing a second.

---

## 13. Assessment editing (D-28 to D-33; UAT-006, UAT-009, UAT-010, UAT-034)

**Surfaces:** the assessment editor (`/app/review/assessments/{id}`: `risk-editor.tsx`, `control-implementation-editor.tsx`, `assessment-editor.tsx`) and the Risk Register's Risk detail (`risk-detail-editor.tsx`, `mitigation-control-list.tsx`).
**Focal point:** within each form, the field being edited and its Save control; the save confirmation sits beside that control so the result appears where the eye already is.

### 13.1 The record picker (X-2)

One single-record, server-backed picker generalises `OwnerCombobox` (D-28). It serves `Information system impacted`, `Information asset impacted` and `Control` in both editors.

**Anatomy**

| Part | Contract |
|---|---|
| Label | Visible, `--text-body` at 500 (§4 Forms) |
| Hint | Below the label, `--text-caption` / `--color-text-secondary` |
| Input | A §4 Forms field (height, `--radius-md`, `--color-border-strong`, `--focus-ring`) with `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls` and `aria-activedescendant`; `aria-describedby` names the hint and, when invalid, the error |
| Listbox | A `Popover` (surface, hairline border, `--radius-lg`, `--shadow-overlay`) at the input's width, bounded by the viewport exactly as the shipped `OwnerCombobox` listbox is |
| Group labels | `.micro-label` in `--color-text-secondary`; each group is `role="group"` named by its label |
| Option | `--text-body`; for a control, a second line with the framework in `--text-caption` / `--color-text-secondary` when the title line does not already show it. Active option: `--color-bg-inset`. Minimum height: the §4 DataTable in-row target from 768px, the §4 Buttons touch height below it |
| Selected line | Below the input: `Selected {noun}: {label}` and a `Clear` button named `Clear {field label}` (the `OwnerCombobox` pattern) |

**Behaviour**

- The list opens on typing (after the shipped combobox debounce), on ArrowDown or Alt+ArrowDown, or on a pointer press in the input. Tab alone never opens it (UI-D17).
- With an empty query it lists the suggested group only. With no suggestions it shows `Type to search {nouns}.` as a status line.
- With a query it lists the suggested items that match, filtered in the browser, then the server results under the second group label. An item appears once.
- Keyboard: ArrowDown and ArrowUp move the active option; Enter chooses it (or the first option); Escape closes and clears the query; Tab closes and moves on. Enter never submits the surrounding form.
- Choosing sets the value, clears the query, closes the list and keeps focus in the input. `Clear` empties the value and moves focus to the input.
- Searches are bounded pages. When a page is full: `Showing the first {n} matches. Keep typing to narrow the list.`
- A selected value keeps its label when it is not on the current page: it comes from the served relation or the selector's hydrate operation (D-30).

**Copy per field**

| Field | Label | Hint | Selected line | Suggested group | Second group | Searching | No match |
|---|---|---|---|---|---|---|---|
| System | `Information system impacted` (unchanged) | `Search by name. Systems selected on the request come first.` | `Selected system: {name}` | `On this request` | `Other information systems` | `Searching information systems…` | `No matching information systems. Try another name.` |
| Asset | `Information asset impacted` (unchanged) | `Search by name. Assets selected on the request come first.` | `Selected asset: {name}` | `On this request` | `Other information assets` | `Searching information assets…` | `No matching information assets. Try another name.` |
| Control | `Control` (was `Reusable control`) | `Search by control number, name or framework. Controls that apply to the Risk Type come first.` | `Selected control: {control label}` | `Applicable to {Risk Type name}` | `Other controls` | `Searching controls…` | `No matching controls. Try a control number, name or framework.` |

- Without a suggested group the second group has no label.
- A search error shows its message with `Retry search` (the `RelationMultiSelect` wording).
- The control's required error, in both editors, is `Choose a control.` (was `Select a reusable Control.`).
- Suggested items come from the originating request's selections (D-30) and the Risk Type's applicable controls (D-31). The Risk Register editor shows the request group too; how it reads the request is the planner's call (research Open Question 2).
- When `Add mitigation control` opens a form, focus moves to its `Control` input (it moved to `Search reusable Controls` before).

| Viewport | Contract |
|---|---|
| 1440 | The picker sits in the editors' existing two-column field grid |
| 375 | Full width; options wrap; the list never overflows the viewport |

### 13.2 Control owner (D-28)

`OwnerCombobox` with label `Control owner` replaces the select over names already on the Risk, in both editors. Its shipped copy is unchanged: `Selected owner: {name}`, `Clear`, `Searching owners…`, `No matching active owners.`, `Retry owner search`.

### 13.3 Exemption review date (D-32)

`Input type="date"` with the label `Exemption review date`, like every other date on the form, in both editors. The hint `Use UTC format YYYY-MM-DDTHH:mm:ssZ.` is removed. The invalid-value error is `Enter a valid exemption review date.` (was `Enter the date and time as YYYY-MM-DDTHH:mm:ssZ.`). Storage and round-trip rules are D-32's.

### 13.4 Save confirmations (D-33, X-1)

In the assessment editor, a confirmation sits in the action row beside its Save button (below it at 375), in a polite live region. It clears on the next change to that form.

| Form | After a successful save | After a successful create |
|---|---|---|
| Risk | `Risk saved at {time}` | the new Risk's card shows `Risk added at {time}`; focus returns to `Add Risk` |
| Mitigation control | `Mitigation control saved at {time}` | the new control's form shows `Mitigation control added at {time}`; focus returns to that Risk's `Add mitigation control` |
| Assessment details | `Assessment details saved at {time}` | — |
| Any, with nothing changed | `No changes to save.` (unchanged) | — |

- Visual: `CheckCircle2` at the §4 Iconography inline-message size in `--color-success-fg`; text `--text-body` / `--color-text-secondary`.
- Failures keep the existing alerts (`Risk not saved`, `Mitigation control not changed`, `Assessment not saved`) and clear the confirmation.
- The Risk Register keeps its own messages: `Risk changes saved.`, `Mitigation control changes saved.`, `Mitigation control added.`, `Mitigation control removed.` (D-33).

### 13.5 Strings that change

| Location | Current | New |
|---|---|---|
| `control-implementation-editor.tsx:121`, `mitigation-control-list.tsx:192` | `Reusable control` select, `Select a control` | the `Control` picker (§13.1) |
| `mitigation-control-list.tsx:191` | `Search reusable Controls` input | removed (the picker searches) |
| `control-implementation-editor.tsx:122`, `mitigation-control-list.tsx:193` | `Control owner` select | `OwnerCombobox` (§13.2) |
| `control-implementation-editor.tsx:132` | `This removes the contextual use of the reusable control from this Risk.` | `This removes the control from this Risk. The control stays in the library.` |
| `mitigation-control-list.tsx:135` | `This removes the contextual implementation from this Risk. The reusable Control remains in the library.` | `This removes the control from this Risk. The control stays in the library.` |
| `mitigation-control-list.tsx:115` | `Add a reusable Control implementation to record how this Risk is mitigated.` | `Add a control from the library to record how this Risk is mitigated.` |
| `mitigation-control-list.tsx:66` | `The selected reusable Control is unavailable.` | `The selected control is no longer available. Choose another control.` |
| `mitigation-control-list.tsx:124, 126`; `assessment-editor.tsx:340` | `{number} — {name}`; label `Reusable control` | the control label (§16.1); label `Control` |
| `risk-editor.tsx:198`, `risk-detail-editor.tsx:190` | text input with the UTC hint | date input (§13.3) |
| `risk-editor.tsx:192-193`, `risk-detail-editor.tsx:186-187` | native selects of 25 records | the picker (§13.1) |

---

## 14. Release readiness summary (D-35; UAT-011)

**Surface:** the `Release readiness` card of the assessment editor (`assessment-editor.tsx:184-225`).
**Focal point:** the met count, then the per-Risk rows.

### 14.1 Anatomy

| Part | Contract |
|---|---|
| Heading | h2 `Release readiness` (unchanged) |
| Description (was `Strapi rechecks every item when release is requested.`) | `Every requirement must be met before release. We check them all again when you release.` |
| Count line (`aria-live="polite"`, `aria-atomic`) | `{met} of {total} release requirements met`, or `All release requirements are met` (both unchanged) |
| Outstanding list | `ul aria-label="Release requirements"` (the name is unchanged). Assessment-level outstanding items first (label link + `Outstanding` with its icon), then one row per Risk that has outstanding items, in Risk order |
| Risk row | A link to `#risk-{id}` whose text is `{risk number}`, a visually hidden `: `, then `{n} outstanding` (`--text-caption` at 500, `tabular-nums`, with the `AlertCircle` warning icon). Under it, `--text-caption` / `--color-text-secondary`, the outstanding labels in served order as an English list: `Missing: Risk owner`, `Missing: Risk owner and Target date`, `Missing: Risk owner, Target date and Treatment plan`, up to four labels; with more than four, `Missing: {label 1}, {label 2}, {label 3}, {label 4} and {k} more` |
| When all are met | No outstanding list; the count line reads `All release requirements are met` |
| Met toggle | Outline small button `Show met requirements ({n})` / `Hide met requirements`, `aria-expanded`, `aria-controls`, `ChevronDown` / `ChevronUp` swapped with no transition. Hidden while nothing is met. `data-print="hidden"` |
| Met list | `ul aria-label="Met release requirements"`: assessment-level met items (label link + `Met` with its icon), then one row per Risk with met items: link `{risk number}`, visually hidden `: `, `{n} met` |
| Release control | `Release assessment` (destructive; disabled until ready) and its dialog (§17.1), unchanged in behaviour |

- The toggle and list labels avoid the words `save`, `add`, `edit`, `remove` and `release` in any control name (`assessment-release-workflow.spec.ts:278` asserts that the released editor has none).
- Every link destination (`#assessment-details`, `#identified-risks`, `#risk-{id}`) is focusable (`tabIndex={-1}`), so following a link moves focus to it and the sticky header's `scroll-padding-top` keeps it visible (UI-D27).

| Viewport | Contract |
|---|---|
| 1440 (xl) | The card keeps its right column beside `Assessment details` |
| 1024 and 768 | The card stacks under `Assessment details`, full width (unchanged grid) |
| 375 | Stacked; rows wrap; the toggle meets the touch-target height |

A ten-Risk assessment that is all outstanding shows at most five assessment rows and ten Risk rows: fifteen readiness links instead of 146 (UAT-011, and most of UAT-063).

---

## 15. Released assessment (D-34; UAT-033)

**Surfaces:** the Requestor's `/app/assessments/{id}` (`released-assessment.tsx`) and the analyst's read-only editor after release (`RiskReadOnly`, `ControlReadOnly` in `assessment-editor.tsx`). Both render one shared read-only Risk (UI-D20).
**Focal point:** the identified Risks list.

### 15.1 Assessment overview

| Label (current) | Label (new) |
|---|---|
| `Approval date` | `Release date` |
| `Approved by` | `Released by` |
| every other label | unchanged (`Generated by` waits for Phase 12, UAT-032) |

`Assessment date` and `Release date` render per §4.1.

### 15.2 Each Risk

A card per Risk, as today: the Risk number, the decorative released check named `Released risk` (unchanged), and the statement. The Risk number becomes an h3 (today it is a non-heading `CardTitle`), so a screen reader can move between Risks by heading. Then, in reading order:

| Group | Rows (label: value) |
|---|---|
| (no heading) | `Information system impacted`: name · `Information asset impacted`: name |
| h4 `Ratings` | `Inherent likelihood` · `Highest inherent consequence` · `Inherent risk rating` (`RiskRatingBadge`) · `Residual likelihood` · `Highest residual consequence` · `Residual risk rating` (`RiskRatingBadge`) |
| h4 `Ownership and treatment` | `Risk owner` · `Treatment owner` · `Treatment action` · `Treatment status` (`StatusBadge` treatment family) · `Target date` (calendar date) · `Treatment plan` (wide) |
| h4 `Mitigation control implementations` (text and region name unchanged; it moves from h3 to h4) | per implementation: `Control`: the §16.1 label (was `Control reference`, an internal id) · `Control owner` · `Status` · `Effectiveness` · `Implementation due` · `Implemented` · `Review date` · `Evidence` (wide) |

- An absent value reads `Not recorded`, as the released view does today. An absent rating is plain text, never a badge.
- Labels are `.micro-label`; values are `--text-body`.
- Layout: one column below 640px, two from 640px and three from 1024px; wide rows span the row.
- Heading levels on this view: h2 `Identified risks`, h3 per Risk, h4 per group.
- The shared read-only component takes its group heading level from its page. On this view it is h4. In the analyst's read-only editor it is h3, beside that page's existing h3 `Mitigation controls`, whose card title stays as it is, so neither page skips a level.

### 15.3 Copy

| Location | Current | New |
|---|---|---|
| `released-assessment.tsx:214` | `Authoritative risks and mitigation controls included in this released assessment.` | `Each Risk with its ratings, treatment and the controls that mitigate it.` |
| `:132` | `Control reference` | `Control` |
| `:121` | `Response contract mismatch: {operation}` shown on the page | removed from the page; the state reads as the error state (`We couldn’t load this risk assessment`) and the operation stays in the server log |
| `:163` | `No mitigation control implementations are recorded.` | unchanged |

No text on this view contains `edit`, `delete` or `release assessment` (`released-assessment.test.tsx:220`), and it has no form, field or button (`assessment-release-workflow.spec.ts:317-320`).

---

## 16. Reference data (D-36, D-37; UAT-007, UAT-053)

### 16.1 The control label rule

One zod-free function names a control everywhere (D-36):

1. `number` is the control number, trimmed.
2. `title` is the stored name, trimmed. When it begins with the number followed by a spaced em dash, en dash or hyphen, a spaced middle dot or a colon, that prefix is removed.
3. When `title` is non-empty and differs from the number, the label is `{number} · {title}`.
4. Otherwise the label is `{number} · {framework}`. When a later projection serves the catalogue theme, it follows: `{number} · {framework} · {theme}`. No Phase 10 projection serves it (research Open Question 3).

| Stored | Label |
|---|---|
| `5.1` / `5.1`, framework `ISO/IEC 27001 Information security management systems — Annex A` | `5.1 · ISO/IEC 27001 Information security management systems — Annex A` |
| `ACCESS-1a` / `ACCESS-1a — Establish Identities and Manage Authentication` | `ACCESS-1a · Establish Identities and Manage Authentication` |
| `APP-11` / `APP-11 — Security of personal information` (after §16.3) | `APP-11 · Security of personal information` |

### 16.2 Where the rule applies

| Surface | Use |
|---|---|
| Record picker options and selected line (§13.1) | the label; for a titled control, the framework on a second line |
| Risk Register mitigation card heading and `Control` row | the label |
| Analyst read-only control and the released view (§15) | the label |
| Administration controls list, `Name` column | the title part only (rule steps 1 and 2); an untitled control reads `Not provided`. The `Control number` and `Framework` columns are unchanged, so the number shows once |
| Administration controls mobile card link | the label |
| Control edit page title (`administration-form.tsx:190`, was `{number} · {name}`) | the label |
| Risk Type form: applicable-control options and selected list (`administration-actions.ts:105`) | the label. A selected control whose label is unknown reads `Control not found`, never an id |
| Control edit form `Name` field | the stored value, unchanged (it is data being edited) |

### 16.3 Content corrections

**Australian Privacy Principle titles** (`bootstrap/controls/privacy-act-app-ndb-2026-06-04.json`). The nine titles cut at a PDF line break are completed, and all thirteen take sentence case, matching the NDB titles beside them (UI-D22):

| Control | Title |
|---|---|
| APP-1 | `Open and transparent management of personal information` |
| APP-2 | `Anonymity and pseudonymity` |
| APP-3 | `Collection of solicited personal information` |
| APP-4 | `Dealing with unsolicited personal information` |
| APP-5 | `Notification of the collection of personal information` |
| APP-6 | `Use or disclosure of personal information` |
| APP-7 | `Direct marketing` |
| APP-8 | `Cross-border disclosure of personal information` |
| APP-9 | `Adoption, use or disclosure of government related identifiers` |
| APP-10 | `Quality of personal information` |
| APP-11 | `Security of personal information` |
| APP-12 | `Access to personal information` |
| APP-13 | `Correction of personal information` |

Each of the nine corrected entries' `legalText` drops the leading fragment that belonged to its title (for example APP-11's begins `11.1 If an APP entity holds…`). The manual check against Schedule 1 of the Privacy Act 1988 (Cth) stays in `10-VALIDATION.md`.

**Risk Type descriptions** (`bootstrap/seed-assessment-workflow.ts:16, 20, 24`):

| Risk Type | Description |
|---|---|
| Internet Exposure | `Risks from services that can be reached from the internet or are hosted by an external provider, such as exposed interfaces, unpatched software and weak authentication.` |
| Personal Information Handling | `Risks from collecting, storing, using or sharing personal information, including privacy obligations, who can access the information and how long it is kept.` |
| Third-Party Dependency | `Risks from relying on an external provider for a service, such as the provider’s own security, its staff’s access to your systems and data, and the continuity of its service.` |

Both corrections reach the development database through the seed reconciliation on the next seeded Strapi start (D-36).

### 16.4 Information System owner and list columns (D-37)

**Focal point:** the systems table, whose first three columns (`Name`, `Owner`, `Business criticality`) answer the oversight question without scrolling at 1440.

| Surface | Contract |
|---|---|
| Form `Owner` (`OwnerCombobox`) | Seeded with the served name: `Selected owner: {name}`. When an owner is set but has no served name: `Selected owner: Name not available`. Never an id (was `administration-form.tsx:87`) |
| Systems list columns | `Name`, `Owner`, `Business criticality`, `Type`, `Environment`, `Deployment model`, `Lifecycle`, `Internet-facing`. The two new columns are plain text and not sortable; an empty value reads `Not provided`, an owner without a name `Name not available` |
| Systems mobile card | adds one line: `Owner: {name} · Business criticality: {value}`, with the same fallbacks |
| Assets | unchanged; an asset owner needs a content-type change and is deferred (D-01, D-37) |

The DataTable's overflow region and sticky first column (08-UI-SPEC §5) carry the wider table. No column choice is added.

---

## 17. Interface copy sweep (D-38; UAT-054)

### 17.1 Strings not already listed in §1 to §16

| Surface (file:line) | Current | New |
|---|---|---|
| Assessment editor, released alert (`assessment-editor.tsx:175`) | `Release is complete. Analyst mutation controls have been removed.` | `The Requestor can now read this assessment. It can no longer be changed.` (title `Assessment released` unchanged) |
| Assessment editor, read-only alert (`:175`) | `A release fact exists or this workflow state cannot be changed.` | closed: `This assessment is closed, so it can no longer be changed.` Otherwise: `This assessment can no longer be changed in its current state.` |
| Release dialog (`:216`) | `Release is irreversible. Requestors will receive the assessment as read-only, and all analyst mutation controls will be removed.` | `Release can’t be undone. The Requestor will receive this assessment read-only, and no one can change it afterwards.` (title, `Confirm release` and `Releasing assessment…` unchanged; still matches `/read-only/`) |
| Identified Risks description (`:228`) | `Contextual Risks identified for this assessment. Risk Types remain reusable non-editable references.` | `Risks identified in this assessment, with their ratings, treatment and mitigation controls.` |
| Assessment details description (`:302`) | `Edit the analyst-owned assessment conclusion. Workflow and release facts are server-owned.` | `Record the assessment’s summary, overall rating and recommendations.` |
| Risk detail description (`risk-details.tsx:97`) | `Contextual Risk — {statement excerpt}` | `{statement excerpt}` (an empty statement reads `No risk statement recorded`) |
| Risk detail edit description (`:115`) | `Edit the Risk using the server-authorised field set.` | `Edit this Risk’s details.` |
| Risk detail mitigation description (`:129`) | `Contextual Control implementations linked to reusable Controls.` | `Controls that mitigate this Risk, from the control library.` |
| CSV guidance (`csv-import-flow.tsx:162`) | `Natural-key matches update existing {plural}. Unmatched valid rows create records. Unchanged, rejected, and ambiguous rows are never written.` | `A row whose {key label, lowercase} matches an existing {singular} updates it. Other valid rows create new {plural}. Unchanged, rejected and ambiguous rows are never written.` (`{key label}` is `Control number` for Controls, else `Name`) |
| CSV confirm (`:186`) | `Imports never delete records. Strapi will validate and classify the same file again before writing.` | `Imports never delete records. We check the file again before anything is written.` |
| CSV result alert (`:195`) | `Server validation changed the result` / `Server validation changed the result for {n} {row\|rows}. Review the details below.` | `The final check changed some results` / `The final check before import changed the result for {n} {row\|rows}. Review the details below.` |
| CSV preview and result tables (`:177`, `:196`) | column `Natural key` | column `{key label}` |
| CSV preview load failure (`:108`) | `The authoritative preview is unavailable.` | `The preview couldn’t be loaded. Choose the file again to retry.` |
| CSV result load failure (`:128`) | `The authoritative import result is unavailable.` | `The import result couldn’t be loaded. Check the {plural} list before importing again.` |
| CSV parse error prefix (`csv-client-parser.ts:27`; Strapi `csv-import.ts:95`) | `Invalid Administration CSV: {message}` | `This file can’t be imported: {message}` |
| CSV duplicate row issue (`csv-client-parser.ts:164`; Strapi `csv-import.ts:229`) | `This natural key occurs more than once in the CSV.` | `This {key label, lowercase} appears more than once in the file.` |
| CSV multiple-match issue (`csv-client-parser.ts:165`; Strapi `csv-import.ts:232`) | `Multiple existing records match this natural key.` | `More than one existing record has this {key label, lowercase}.` |
| Admin collection description, Risk Types (`administration-workspace.tsx:85`) | `Manage reusable Risk Type definitions used to identify contextual Risks in assessments.` | `Manage the Risk Types used to identify Risks in assessments.` |
| Admin collection description, Controls (`:86`) | `Manage reusable Control definitions; implementations remain attached to contextual Risks.` | `Manage the control library used for mitigation controls on Risks.` |
| Admin form header, Controls (`administration-form.tsx:189`; today one string for create and edit) | `Manage the reusable Control definition without changing contextual Control Implementations.` | create: `Add a control to the library.` Edit: `Edit this control. Mitigation controls on Risks keep their own status and evidence.` |
| Admin form header, Risk Types, create and edit (`:189`) | `Create a reusable definition for use in future assessments.` / `Edit this reusable definition without changing existing contextual Risks.` | `Create a Risk Type for use in future assessments.` / `Edit this Risk Type. Risks already identified keep their own details.` |
| Admin form sections (`:197`, `:199`, `:203`) | `Identify this reusable Control and its governing framework.` / `Enter the reusable Control name.` / `Describe the reusable Control, not a contextual implementation.` | `Identify this control and the framework it comes from.` / `Enter the control’s title without its number.` / `Describe what this control requires.` |
| Admin Risk Type form (`:242`, `:244`, `:246`, `:247`) | `Define the canonical Risk Type used by assessment workflows.` / `Explain when this reusable definition applies.` / `Map reusable Controls, not contextual Control Implementations.` / `Search by Control number or name. These are reusable Controls, not implementations.` | `Name and describe this Risk Type.` / `Explain which risks this Risk Type covers.` / `Choose the controls that usually mitigate this Risk Type.` / `Search by control number, name or framework.` |
| Admin `Downstream use` (`:256`; heading unchanged; the panel is replaced in Phase 20) | the `contextual` descriptions and bodies | Controls: `Mitigation controls on Risks keep their own assessment history.` / `This control may be used by Risk Types and by mitigation controls on Risks. Nothing is deleted or changed automatically.` Risk Types: `Risks already identified keep their own assessment history.` / `Applicable controls suggest controls for this Risk Type only. Nothing is deleted or changed automatically.` Systems and assets: `Assessments and Risks keep their own history.` / `This {label} may be used in assessments. Nothing is deleted or changed automatically.` |

### 17.2 The copy guard

A web unit test beside `src/lib/performance/zod-client-boundary.test.ts` scans the **user-visible strings** (JSX text and string literals, not comments or identifiers) of the Phase 10 files for these terms, case-insensitive:

`Strapi`, `server-owned`, `server-directed`, `server-authorised`, `release fact`, `mutation control`, `natural key`, `natural-key`, `Invalid Administration CSV`, `non-editable`, `contextual`, `effective CSRM capabilities`, `record scope`, `Navigation visibility`, `authoritative`, `answer batch`, `least-privilege`, `Server validation`.

**Files scanned:** every file this contract changes under `apps/csrm/src/features/{questionnaires,requests,assessments,risks,administration}` and `apps/csrm/src/components/{states,csrm}`, as the plans list them.

**Excluded, with their phase:**
- the analyst dashboard and reports (`features/analyst-dashboard/**`, `features/reports/**`): Phase 11, DASH-03;
- the Risk Register list description (`features/risks/risk-register.tsx`, asserted at `risk-register-workflow.spec.ts:376`): Phase 11, UX-09;
- the development-only role switcher (`components/shell/role-switcher.tsx`): not shipped to production;
- service modules' type and client names (`createStrapiClient`, `StrapiClient`): identifiers, not copy.

Plans after 10-02 add their files to the list as they land.

---

## 18. Five-state contract

Every Phase 10 surface keeps the Phase 06.6, 07 and 08 five-state contract. Additions and changes:

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| Analyst questionnaire review | route `loading.tsx` (unchanged) | `No submitted answers are available` (unchanged) | unchanged | the gate (§11.1) plus the record refusal (§11.2) | form open, form error, form conflict (§1); released questions (§2) |
| Requestor questionnaire | unchanged | unchanged | unchanged | description §11.2 | introduction; attention after attempt; save status (six states, §6.1); submitted notice (three variants, §8.2) |
| Analyst request hub | skeleton (unchanged) | draft precondition (unchanged) | unchanged | the gate (§11.1) | job cards: idle, queued, running, running by another analyst, completed, failed with and without retry, timed out, status unavailable, jobs read failed (§12) |
| Requestor request | unchanged | — | unchanged | shared state, description §11.2 | submitted hints (§8.1) |
| Record picker | `Searching {nouns}…` | `Type to search {nouns}.`; `No matching {nouns}. …` | message and `Retry search` | the action's permission message (unchanged wording) | suggestions; results; results page full (§13.1) |
| Assessment editor | skeleton (unchanged) | unchanged | unchanged | the gate (§11.1) | readiness: outstanding, all met, met shown (§14); save confirmations (§13.4) |
| Released assessment | skeleton (unchanged) | `No released risks are available.` (unchanged) | unchanged; the contract-mismatch state renders as the error state (§15.3) | description §11.2 | the full Risk (§15.2) |
| Administration systems list | unchanged | unchanged | unchanged | description §11.2 | owner and criticality (§16.4) |

The `design-contract.spec.ts` state matrix and the `design-system-conformance.spec.ts` type scan stay green: every new text element uses a §3.10 pair (see Typography).

---

## 19. Test assertions this contract changes

Each plan greps its strings before editing and changes these assertions deliberately, in the same plan as the behaviour. No assertion is loosened to pass.

### 19.1 End-to-end

| # | Spec:line | Asserts today | Change | Plan |
|---|---|---|---|---|
| E1 | `questionnaire-workflow.spec.ts:181-190` | A Requestor on the analyst questionnaire URL sees `Awaiting questionnaire submission` | Expect the permission state (h1 `Questionnaire review`, the alert title, `Go to My Questionnaires`); `:187-196` still hold | 10-02 |
| E2 | `questionnaire-workflow.spec.ts:228-230` | `getByText('Draft saved.')`, then reload | Wait for `Saved at` (§6.1) so no save is waiting, then reload | 10-07 |
| E3 | `questionnaire-workflow.spec.ts:308` | After the analyst's revert, `getByText('Contact details')` has count 0 | **New (research missed it):** `Contact details` is a choice label that the D-07 list now shows. Assert instead that the `Released questions` section shows no answer (for example no checked control and no answer text) | 10-08 |
| E4 | `questionnaire-workflow.spec.ts:254` | Submit dialog `/cannot be undone\|irreversible/i` | The §8.2 description | 10-05 |
| E5 | `performance.spec.ts:116-117` | The populated guard's full read-only sentence | The §8.2 revertible notice (the journey leaves the request `questionnaire-in-progress`) | 10-05 |
| E6 | `requestor-request-workflow.spec.ts:219` | Submit dialog `/cannot be undone\|irreversible/i` | The §8.1 description; add the in-page submit-then-revert step (D-21) | 10-04 |
| E7 | `questionnaire-generation-workflow.spec.ts:39, 133-138` | `Generate questionnaire` reopens as replace; dialog `Replace the unanswered questionnaire?`; confirm `Replace unanswered questionnaire` | `Replace questionnaire`; `Replace this questionnaire?`; `Replace questionnaire` (scoped to the dialog). `:94` keeps `Generate questionnaire` | 10-09 |
| E8 | `questionnaire-governance-workflow.spec.ts:179-180` | `/hosting-model/` visible | The question text `Where will the service be hosted?` (`.first()`) | 10-09 |
| E9 | `questionnaire-governance-workflow.spec.ts:117` | `getByRole('button', { name: 'Add question' })` | **New (research missed it):** Playwright matches names as substrings, so the per-section `Add question to {section}` buttons make this a strict-mode violation. Add `exact: true` | 10-08 |
| E10 | `assessment-release-workflow.spec.ts:182, 227-229` | Flat readiness links `/^Risk .+ — /`; `Met` rows visible once all are met | Per-Risk links `/^RSK-\S+: \d+ outstanding$/`; once all are met, open `Show met requirements` and assert the met list. `:81` and `:260` stay green | 10-14 |
| E11 | `assessment-release-workflow.spec.ts:205-212, 224-225` | Native `Reusable control` select, `option.nth(1)`, `selectOption({ label: 'Jane Doe' })` | Type in the `Control` picker (`exact: true`, because `Control owner` and `Control status` share the prefix) and choose an option; search `Control owner` and choose `Jane Doe`; assert the selected control line after reload | 10-13 |
| E12 | `assessment-release-workflow.spec.ts:315` | The Requestor sees the control's document id | The control label (number and title), and no id | 10-11 |
| E13 | `assessment-release-workflow.spec.ts:270` | `/read-only\|cannot be undone\|irreversible/i` | Stays green: the §17.1 description contains `read-only` | 10-14 (check only) |
| E14 | `assessment-release-workflow.spec.ts:241-243` | A Requestor on the analyst assessment URL sees `Page not found` | **New (research missed it):** the gate runs before the read, so the Requestor sees the permission state (h1 `Risk assessment review`, `You don’t have permission to review this assessment`); `:243` (no risk statement) stays | 10-02 |
| E15 | `request-relationship-states.spec.ts:24, 97, 114, 120` | `Contextual Risks by residual rating`; names `^{rating} residual contextual risks: \d+$` | `Risks by residual rating`; `^{rating} residual Risks: \d+$` | 10-04 |
| E16 | `risk-register-workflow.spec.ts:599-603` | Focus lands on `Search reusable Controls` | Focus lands on the `Control` picker input | 10-13 |

### 19.2 Unit

| File:line | Change | Plan |
|---|---|---|
| `src/components/states/states.test.tsx:36` | Permission description (§11.2) | 10-02 |
| `src/features/questionnaires/questionnaire-workflow.test.tsx` (the permission, awaiting-submission and submitted cases, `:504`, `:519-521`) | Gate and variant links; `:504` and `:521` stay green through the default analyst variant | 10-02, 10-08 |
| `src/features/requests/request-hub.test.tsx:47, 51` | Hub text and row names (§9.3) | 10-04 |
| `src/features/requests/request-form.test.tsx:230` | `/cannot be edited after submission/i` becomes the §8.1 description | 10-04 |
| `src/features/requests/request-actions.test.ts:119` | Update 409 fallback (§10.3) | 10-06 |
| `src/features/questionnaires/questionnaire-actions.test.ts:78` | Submit 409 fallback (§10.2 D) | 10-06 |
| `src/features/questionnaires/questionnaire-renderer.test.tsx:218` (and `:142` must still find one empty status region at load) | `/Draft saved/i` becomes `/Saved at/` | 10-05, 10-07 |
| `src/features/questionnaires/questionnaire-revision-timeline.test.tsx:50` | `1 question added or changed` becomes `1 change to the questions` | 10-05 |
| `src/features/questionnaires/questionnaire-governance.test.tsx` | Form title, `Section` chooser, `Discard changes`, per-section add, focus and in-form errors. `getByRole('button', { name: 'Add question' })` stays unique because Testing Library matches whole names | 10-08 |
| `src/features/assessments/questionnaire-generation-job.test.tsx:157-158` | `Generate questionnaire` / `Replace unanswered questionnaire` become `Replace questionnaire` twice (trigger, then the dialog's confirm) | 10-09 |
| `src/features/assessments/assessment-editor.test.tsx:163, 237, 260, 358, 458-474, 531` | Field inventory `Control`; exemption review date value `2026-11-11`; picker interaction; readiness summary | 10-13, 10-14 |
| `src/features/assessments/released-assessment.test.tsx:173` and the detail cases | `Mitigation control implementations` is now a level 4 heading under a level 3 Risk number; new labels and fields; `:220` (no `edit`, `delete` or `release assessment` text) must stay green | 10-11 |
| `src/features/risks/risk-details.test.tsx:104, 125, 145, 223-226, 243` | Description, field inventory, mitigation description, empty copy, picker, remove dialog | 10-13 |
| `src/features/administration/administration-workflow.test.tsx:612` | `Server validation changed the result for 1 row` becomes `The final check before import changed the result for 1 row` | 10-12 |
| `src/components/csrm/segmented-control.test.tsx` | Unchanged and green (§7) | 10-03 |

### 19.3 Conformance and design-contract suites

- `design-system-conformance.spec.ts:455-461`: the per-section `Add question to …` buttons match `/^(…|Add question|…)\b/` and are counted; they must carry `data-print="hidden"` so none prints. No edit needed.
- `design-system-conformance.spec.ts` type scan on `/app/admin/controls`: the `Name` column still renders at `--text-table`. No edit needed.
- `design-contract.spec.ts`: the information-systems administration surface keeps `RecordLink` parity and responsive DataTable behaviour with the two new columns. No edit needed.

### 19.4 Assertions that must stay green

`Awaiting questionnaire submission` (`accessibility.spec.ts:270`, `questionnaire-workflow.spec.ts:305`); `Request context` (`accessibility.spec.ts:336`, `request-relationship-states.spec.ts:160`); `You don’t have permission to review this request` (`assessment-release-workflow.spec.ts:245`); the released view's no-mutation checks (`:317-320`); `/^Submitted \d{1,2} \w{3,4} \d{4}$/` (`requestor-request-workflow.spec.ts:225`); the analyst's return to draft before a questionnaire exists (`:244-249`); the draft precondition sentence (`questionnaire-generation-workflow.spec.ts:130`); `Questionnaire submitted.` (`questionnaire-workflow.spec.ts:258, 322`, `questionnaire-governance-workflow.spec.ts:154, 194`); `Answers cleared by this revision` (`:178`); `Question added`, `Question edited`, `Question removed` (`:121, 127, 133`); `Questionnaire completion` and `Questionnaire validation guidance` region names; `Back to questionnaires` (`assessment-navigation-lifecycle.spec.ts`); `Risk changes saved.` and `Mitigation control changes saved.` (`risk-register-workflow.spec.ts:572, 585`); `Assessment released` (`assessment-release-workflow.spec.ts:273`).

---

## Copywriting contract

| Element | Copy |
|---|---|
| Primary CTAs (primary variant, new) | `Save question` |
| Other calls to action (new or renamed) | `Replace questionnaire`; per-section `Add question` (`Add question to {section}`); `Retry save`; `Refresh page`; `Reload questions`; `Leave questionnaire` (destructive); `Go to My Requests`, `Go to My Questionnaires`, `Go to My Risk Assessments`, `Back to risk assessments`; `Show met requirements ({n})` |
| Primary CTAs (unchanged) | `Generate questionnaire`, `Release questionnaire`, editor-level `Add question`, `Submit request`, `Submit questionnaire`, `Save draft`, `Save risk`, `Save mitigation control`, `Save assessment`, `Release assessment` (destructive) |
| Dismiss labels (new) | `Keep this questionnaire`, `Keep answering`, `Discard changes`, `Dismiss notice`, `Hide met requirements` |
| Empty states | Unchanged locked patterns (`No {noun} yet`, `No {noun} match these filters` with `Clear filters`, cleared `No {noun}`). New inline empties: `Type to search {nouns}.`, `No matching {nouns}. Try …` (§13.1); `None selected` (§9.1) |
| Error states | Unchanged locked pattern (`We couldn’t load {noun}`, `Please try again. If the problem continues, contact your administrator.`, `Try again`). Every refusal states its real reason, and a next step wherever one exists (§10.2); save failures name their recovery (`Retry save`, `Refresh page`) |
| Permission states | Headings locked; descriptions say what to do instead (§11.2) |
| Destructive confirmations | `Replace this questionnaire?` → `Replace questionnaire` (§3.2); `Leave this questionnaire?` → `Leave questionnaire` (§6.3); `Release this risk assessment?` → `Confirm release` (§17.1); `Remove this mitigation control?` → `Remove mitigation control` (§13.5); `Delete this question?` → `Delete question` (unchanged). Each uses the destructive variant (§4 Buttons) |
| Terminology | Voice § |
| AI output | The replace dialog and the timeline say "generated" and never "approved", "final" or "released" of generated content; nothing in this phase releases anything automatically |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 Info and relationships | Question form is a named `form`; picker groups are `role="group"` with names; request context and released Risk groups have real headings; lists stay `ul`/`li` |
| 2.1.1 Keyboard | Radio arrows (§7); picker keys (§13.1); readiness toggle; no hover-only control |
| 2.4.3 Focus order | §1.4, §6.3, §9.2, §13.4 and §14.1 fix where focus goes when a form or dialog opens, saves, fails or closes, and after in-page links |
| 2.4.6 Headings | Heading levels: questionnaire review h1 > h2 panels > h3 `Question editor` > h4 sections > h5 in-section form titles; request pages h1 > h2 `Request context` > h3 groups; released view h1 > h2 `Identified risks` > h3 Risk > h4 groups; the analyst's read-only editor keeps h2 `Identified Risks` > h3 groups and `Mitigation controls` |
| 2.4.11 Focus not obscured | The sticky header is offset by the existing `html` `scroll-padding-top`; focusable anchor targets (§14.1) |
| 2.5.3 Label in name | `Add question to {section}` starts with its visible text; the readiness Risk links' names start with the visible Risk number; picker `Clear` buttons are named `Clear {field label}` |
| 3.3.1 and 3.3.3 Error identification and suggestion | Every error names the problem and the fix (§1.2, §10.2, §13.1) |
| 4.1.3 Status messages | Save status: `Saved at` polite, failures once (`role="alert"`), `Saving…` not announced; governance announcements; save confirmations; the readiness count line |
| 1.4.1 Use of colour | Save status, readiness rows and the attention region carry icons and words; ratings and treatment status use their badges |
| 1.4.10 Reflow | No horizontal page scroll from 320 to 1440 on every Phase 10 surface; the systems table scrolls only inside its labelled region |
| 2.5.8 Target size | Picker options and all new buttons meet the §4 DataTable and §4 Buttons minimums |
| Automated | Zero serious or critical axe violations at 375 and 1440 on every Phase 10 surface, in the existing sweeps plus the new steps |

---

## Spacing

The §3.9 scale and layout tokens apply unchanged. This phase adds no spacing value. New layout in this phase uses only these §3.9 steps, all multiples of four and all in the 4-8-16-24-32 set:

| §3.9 step | Use in this phase |
|---|---|
| 4px | Icon-to-text gaps in the save status and readiness rows |
| 8px | Between a field's label, hint, control and error; between a picker option's two lines |
| 16px | Inline form padding (X-5, the §4 Cards padding lower bound); between form fields; between a request context group heading and its list |
| 24px | Between request context groups and released Risk groups (§3.9 section rhythm, lower bound) |
| 32px | Between the introduction, the renderer and the history on the Requestor questionnaire (§3.9 section rhythm, upper bound) |

Existing primitives keep their shipped internal spacing, including the 12px list-row padding and gaps that §3.9 defines; this phase declares none of it. Exceptions: none.

---

## Typography

The §3.10 scale applies unchanged: families, sizes, line heights, tracking, and weights 400, 500 and 600. This phase adds no size, weight or family.

| Emphasis level | Token | Weight | Phase 10 use |
|---|---|---|---|
| 1. Panel title | `--text-heading-sm` | the token's own heading weight | `About this questionnaire`, `Released questions`, request context groups, released Risk groups |
| 2. Body and labels | `--text-body` | 400; 500 for form titles, field labels, question text and the progress line | introduction, save status, refusal lines, picker options, the released hint |
| 3. Caption | `--text-caption` | 400; 500 for the readiness `{n} outstanding` count (the §3.10 badge pair) | hints, field errors, `Missing:` captions, the release caption, the picker's framework line |
| 4. Micro-label | `--text-micro` (IBM Plex Mono, uppercase by CSS) | 400 | definition-list labels, section captions, picker group labels |

Four text sizes carry every new element; new buttons keep the shipped `--text-button`, which is the body size; line heights are each token's own (§3.10). The page title (`--text-heading-lg`) and section heading (`--text-heading-md`) belong to the shipped `PageHeader` and `DetailSection` and are unchanged. The GSD checker's "at most four sizes and two weights" heuristic holds for sizes. For weights it is superseded by the adopted scale (ADR 0001 gap 8; §3.10 gives headings their own weight), as in Phases 06.5, 07 and 08; this phase adds no weight. No uppercase outside `--text-micro`; the serif never below the page-title size; `tabular-nums` on every count.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | canvas, cards, the introduction, dialogs, the picker listbox |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-border-strong`, `--color-text-secondary` / `--color-text-muted`, `--color-bg-sidebar` | inline form wells, the active picker option, hairlines, field boundaries, captions, navigation |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--focus-ring` | only as listed below |
| Status (§3.5) | success fg (save confirmations), danger fg (save failure, form and field errors), warning (attention region, outstanding readiness) | always with an icon and words; never a fill for a control |
| Severity (§3.6) | `--color-risk-*` | `RiskRatingBadge` on the released view, unchanged |
| Destructive | `--color-danger-solid` | the five destructive confirms in the Copywriting contract |

Ink is reserved for: primary buttons (`Generate questionnaire`, `Release questionnaire`, the editor-level `Add question`, `Save question`, `Submit request`, `Submit questionnaire`, `Save draft`, `Save risk`, `Save assessment`), record and text links with their underline (including readiness rows and the §3.3 questionnaire link), focus rings, checked radios and segments, and the sidebar active bar. The per-section `Add question`, `Replace questionnaire`, `Retry save`, `Refresh page`, `Reload questions` and the met toggle are outline buttons. No new hue.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Picker listbox open and close | the shipped `Popover`, per the §5 "Dropdown / popover / menu" row |
| Leave warning and replace dialogs | the shipped `AlertDialog`, per the §5 "Dialog / toast" row |
| Inline form open and close | none: it replaces or follows its row with no transition |
| Save status and confirmations | none: text changes in place |
| Met requirements toggle | none: icons swap, the list appears |
| Radio and segment check | `--duration-micro`, `--ease-standard` (unchanged) |

Nothing auto-advances. Reduced motion needs no new rule beyond the global one.

---

## Proposed CSRM extensions

For the orchestrator to accept and record in `docs/design/csrm-design-direction.md` before implementation. A plan task records each accepted extension. None introduces a value; each names a pattern over existing tokens.

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-1 | §4 Forms | Save status | "**Save status (CSRM extension, 2026-09-27).** A form that saves in place confirms beside its Save control, or in its progress card for autosave, in `--text-body` / `--color-text-secondary` with a `CheckCircle2` at the inline-message icon size in `--color-success-fg`: `{Record} saved at {time}`, or `Saved at {time}` for autosave. The confirmation is a polite live region and clears on the next change. A save in progress shows `Saving…`, visibly but not announced. A failed save shows its message with an `AlertCircle` at the same size in `--color-danger-fg` and a recovery control, announced once. Colour is never the only signal." | D-11 and D-33 need one visible, consistently announced save state; the only precedent was a visually hidden region. |
| X-2 | §4 Forms | Record picker | "**Record picker (CSRM extension, 2026-09-27).** A single record chosen from a large or growing list uses a searchable combobox, never a native select: a labelled field with a hint, a `Popover` listbox at the field's width with `.micro-label` group labels, a suggested group first when the context has one, server-side search on typing, the active option on `--color-bg-inset`, and the chosen record shown below the field as `Selected {noun}: {label}` with a `Clear` control. Enter never submits the surrounding form." | D-28 generalises the shipped `OwnerCombobox`; the direction names selects and inputs only. |
| X-3 | §2 Voice, new "Dates and times" paragraph | Instants and calendar dates | "**Dates and times (CSRM extension, 2026-09-27).** A calendar date is shown without a zone. An instant is shown in the viewer's time zone; when only its date is shown, no zone label is added. When a time of day is shown and the viewer's zone is not yet known, the time is followed by ` UTC`. Formats are en-AU: `27 Sept 2026, 3:47 pm`." | D-19; keeps date-only renders unlabelled (research Pitfall 13). |
| X-4 | §2 Voice | Separators | Append to the Voice bullet: "A spaced middle dot ( · ) joins an identifier to a name or a second fact, because identifiers contain hyphens; a spaced hyphen replaces the em dash in prose." | Shipped copy already joins identifiers with a middle dot; D-36 and D-38 need the rule written down. |
| X-5 | §4 Forms | In-place edit form | "**In-place edit form (CSRM extension, 2026-09-27).** A form that edits or adds one item in a list opens where it was invoked, in place of the item it edits or at the end of its group, as a well on `--color-bg-inset` with a `--color-border-default` hairline, `--radius-lg` and the Cards padding (lower bound). Focus moves to its first field; saving moves focus to the saved item and discarding returns it to the control that opened the form. One such form is open at a time." | D-04; the shipped mitigation control editor already looks like this. |

---

## Decisions recorded

Made without asking, as this phase's discussion and UI contract run in auto mode. Each follows the locked context, `AGENTS.md` and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | The question form's field order is `Question text`, `Answer type`, `Choices`, `Section` (with `New section title`), `Required`; focus lands in `Question text`. | The analyst's task starts with the question; it is the shipped order; D-04 puts focus in the first field. |
| UI-D2 | Every form shows `Section`, preselected; the editor-level add preselects the last section. | Edit can move a question between sections within D-05's rules, and the governance journey's default add (`:117-121`) keeps working. |
| UI-D3 | One question form at a time; the editor's other actions and `Release questionnaire` are disabled while it is open, with a caption. | Stops a release over a half-edited question and never discards a draft silently. |
| UI-D4 | New dialogs and forms name their dismiss action; rewritten existing dialogs keep `Cancel`. | House precedents (`Keep editing`, `Discard mitigation changes`); changing every existing dismiss would churn tests for no user gain. `Cancel` dismisses and is not a call to action. |
| UI-D5 | The per-section add shows `Add question` and is named `Add question to {section}`. | The W-9 naming pattern; Label in Name holds; the E9 test change follows. |
| UI-D6 | D-07's list is its own `Released questions` section under the awaiting alert, reusing the governance rows without actions. | One row presentation for one question; the alert keeps its locked title. |
| UI-D7 | `Replace questionnaire` is an outline button; its confirm is destructive; the dialog states the count, with a fallback when the count is missing. | Review and release is the next action once a questionnaire exists; replacing discards work. |
| UI-D8 | The `regenerated` event reads `Questionnaire replaced`, with a fixed explanation template. | It matches the action's name; the explanation is user-facing, so it is fixed here. |
| UI-D9 | The Requestor's history omits changes made before the first release and counts each later round as `{n} changes to the questions`. | The Requestor never saw the earlier version; the Requestor projection carries no question key, so counting changes (not questions) is the honest unit. |
| UI-D10 | One save status serves autosave and `Save draft`; `Saved at {time}` replaces `Draft saved. Your answers remain editable.` | Two indicators for one fact would disagree; the E2 test change follows. |
| UI-D11 | The leave warning covers links and hard navigation; browser Back is not intercepted, and the waiting save is sent at once instead. | The App Router documents no Back interception; D-12 names `onNavigate` and `beforeunload` only. |
| UI-D12 | Every submitted-notice variant begins `Questionnaire submitted.` | Keeps four journey assertions green while the rest of the sentence becomes truthful. |
| UI-D13 | The request's return-to-draft hint is its own paragraph. | `Submitted {date}` must stay exact for `requestor-request-workflow.spec.ts:225`. |
| UI-D14 | The request context lists every submitted field, including those the hub summarises. | The hub is a summary; the context is the record (the Requestor page's own comment says so). |
| UI-D15 | A Requestor refused by the analyst route gate is sent to their own list; analysts keep the existing links. | D-24: say what the person can do instead. |
| UI-D16 | `Control` replaces `Reusable control` on every surface, and `Control reference` on the released view. | The JDL name; "reusable" is modelling language; the interactions change anyway. |
| UI-D17 | The picker opens on typing, ArrowDown or Alt+ArrowDown, or a pointer press; never on Tab. | A 34-field form must stay quiet for keyboard users tabbing through it. |
| UI-D18 | Save confirmations name the record; after a create, focus returns to the add control. | Several forms share a page; the created form unmounts, so its own button no longer exists. |
| UI-D19 | The outstanding list keeps the name `Release requirements`; Risk rows add a `Missing:` caption of up to four labels; met items show on demand; control names avoid the words the released-editor check forbids. | Keeps `:81` green, tells the analyst what to fix without extra tab stops, and keeps `:278` green. |
| UI-D20 | The released Risk uses the Risk Register's group names; `Approval date` and `Approved by` become `Release date` and `Released by`; the analyst's read-only Risk uses the same component. | One vocabulary across surfaces; the glossary's "Released" (decision 16); D-34 "for both actors". |
| UI-D21 | The control label joins with a middle dot; untitled controls use the framework; the Administration `Name` column shows `Not provided` for them. | Control numbers contain hyphens; the list already has number and framework columns. |
| UI-D22 | All thirteen APP titles take sentence case, not only the nine truncated ones; the corrected entries' `legalText` drops the leaked fragment. | One catalogue, one style, matching its NDB titles; the fragment is the same defect. |
| UI-D23 | Systems list order puts `Owner` and `Business criticality` after `Name`, unsortable; `Name not available` for an owner without a name. | Oversight columns stay visible without scrolling; sorting would need an API change. |
| UI-D24 | The copy sweep covers the Administration form and the Risk detail strings with internal terms, and the guard scans an explicit file list with Phase 11 exclusions. | Those files change in this phase anyway; a whole-tree scan would fail on Phase 11 surfaces. |
| UI-D25 | A failed jobs read shows the idle actions with one truthful line. | Both registries return the active job instead of enqueuing a second. |
| UI-D26 | `Next action` is overridden only while a job is queued or running, as plain text. | D-26; the job card is on the same page. |
| UI-D27 | Readiness and request anchors are focusable so in-page links move focus. | WCAG 2.4.3; the sticky header offset already exists. |
| UI-D28 | Answer type labels (`Boolean`, `Single select`) are unchanged. | Analyst-only vocabulary, not requested by any finding; renaming would churn the governance tests. |
| UI-D29 | The attention region keeps its warning tone; the form-level `Questionnaire not saved` alert retires. | The save status and the dialog now carry what it said; one list of questions, not two. |
| UI-D30 | The hub's `Owner` label (the Requestor's name) is unchanged. | Phase 13 introduces the assignee and settles naming. |
| UI-D31 | `Dismiss` becomes `Dismiss notice`. | Verb and noun (checker Dimension 1). |

---

## Notes carried

- The E2E and unit changes in §19 are deliberate; each plan names its rows. E3, E9 and E14 are not in the research table.
- `request-form.tsx`'s `RequestRelationships` and `AssessmentRelationshipTile` are not rendered by any route. Their copy changes (§9.3) keep the guard clean; removing the dead code is outside this phase.
- The questionnaire detail route has a 500,000-byte delivered-JavaScript budget (`performance.spec.ts:76`). The autosave, guard and introduction must keep zod out of the client bundle; the picker adds code to the assessment editor route and to the Risk detail.
- The Risk Register list description `Search and manage contextual Risks across authorised assessments.` stays until Phase 11 (asserted at `risk-register-workflow.spec.ts:376`).
- Seeded questionnaire sections start at order 1 and generated ones at 0; the §1.3 placement rules hold for both (research Specifics).
- New copy uses the typographic apostrophe (’). Tests that assert it must use the same character, as the existing `don’t` assertions do.
- D-36 names the catalogue theme for untitled controls, but no Phase 10 projection serves it and D-03 caps the API changes; §16.1 therefore labels untitled controls by number and framework, and adds the theme when a later projection serves it (research Open Question 3). The orchestrator should confirm this reading.
- D-38 asks for a spaced hyphen instead of an em dash. This contract applies that to prose and joins identifiers to names with a spaced middle dot (X-4), as shipped copy and the Phase 7 contract already do, because identifiers such as `ACCESS-1a` and `RAR-2026-5WWFVQ` contain hyphens. The orchestrator should confirm this reading.
- D-36 corrects the nine truncated APP titles; this contract also sentence-cases the four complete ones and trims the leaked title fragments from the nine `legalText` values (UI-D22). Both are content fixes to the same vendored file.

---

## UI Considerations

Produced by the ui-phase consideration probe (`ui-consideration-probe.cjs`, GSD Core 1.15.0) over the 27 surfaces this contract describes. Element kinds were confirmed in auto mode as the union of the detected kinds and the kinds the heuristic missed (for example the list kind on the pickers, which it had read as forms only). The probe found no unclassified surface. Empty-state and error-state copy lives in the sections cited; this table covers state coverage only.

Applicable state considerations resolved: 153 applicable, 150 covered (explicit), 3 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| empty | Question form | covered | Saving an empty form shows `Enter the question text.` under the field and moves focus there; `Save question` is never disabled (§1.2) |
| empty | Governance list; released questions | covered | A questionnaire with no active question renders the existing empty state; the released-questions section renders only when there are questions (§2.1); the last question's `Delete` stays disabled |
| empty | Revision timeline; attention list | covered | `No revisions have been recorded.` (unchanged); the attention region is absent until an attempt and disappears when nothing is outstanding (§5.3) |
| empty | Radio groups; date inputs | covered | An unanswered group or date submits nothing and shows its error only after a submit attempt; an empty exemption date saves as null (§13.3) |
| empty | Request context | covered | A missing value reads `Not provided`; an empty system or asset list reads `None selected` (§9.1) |
| empty | Record picker; owner comboboxes | covered | Empty query shows the suggested group or `Type to search {nouns}.`; no match shows `No matching {nouns}. …`; owners keep `No matching active owners.` (§13.1, §13.2) |
| empty | Readiness summary | covered | All met: no outstanding list and `All release requirements are met`; nothing met: the met toggle is hidden (§14.1) |
| empty | Released Risks; admin lists; CSV import | covered | `No released risks are available.` and `No mitigation control implementations are recorded.` (unchanged); the admin lists and the CSV flow keep their locked and shipped empty states |
| loading | Question form; replace dialog; submission dialogs; request actions | covered | Pending labels `Saving question…`, `Replacing questionnaire…`, `Submitting request…`, `Submitting questionnaire…`; controls are disabled while pending |
| loading | Governance list, released questions, timeline, request context, released Risks, readiness, admin lists | covered | Loaded with their page: the route `loading.tsx` or skeleton is unchanged; no surface adds its own spinner (§4 Skeletons) |
| loading | Save status | covered | `Saving…` shows visibly and is never announced (§6.1) |
| loading | Job cards | covered | Queued and running states with the existing polling and pending labels; seeded on return (§12.1) |
| loading | Record picker; owner comboboxes | covered | `Searching {nouns}…` and `Searching owners…` status lines (§13.1) |
| loading | CSV import | covered | The shipped `Validating…` and `Import in progress. Keep this page open.` lines, unchanged |
| loading | Attention list; leave dialog; radio groups; date input; permission state | covered | None has a load of its own: the attention list is computed from the form's state, the leave dialog opens synchronously on the guarded click, radios and dates are part of the rendered form, and the permission state renders before any read (§5.3, §6.3, §11.1) |
| error | Question form; delete dialog | covered | The in-form error line (`role="alert"`) with §10.2 G copy and `Reload questions` on a placement clash; delete refusals inside the dialog (§10.2 H) |
| error | Replace dialog; submission dialogs; request actions | covered | §10.2 I, A, B and D copy inside the dialog, which stays open |
| error | Save status | covered | Retryable `Your latest answers weren’t saved.` with `Retry save`; blocked §10.2 C copy with `Refresh page`; announced once (§6.1) |
| error | Job cards | covered | Failure copy by code (§12.4); `Status unavailable`; the jobs-read failure line (§12.5) |
| error | Record picker; owner comboboxes; date input | covered | Search failure with `Retry search` or `Retry owner search`; `Choose a control.`; `Enter a valid exemption review date.` (§13.1, §13.3) |
| error | Governance list, released questions, timeline, request context, released Risks, admin lists | covered | Their page's locked error state (`We couldn’t load …`); the released view's contract-mismatch diagnostic is no longer shown (§15.3) |
| error | CSV import | covered | `This file can’t be imported: {message}`, the row issue messages and the preview and result load failures (§17.1) |
| error | Radio groups | covered | A required group left unanswered shows `Enter an answer for {question}.` after a submit attempt (unchanged) |
| error | Attention list; leave dialog; permission state | covered | No failure of their own: the attention list is client state, the leave dialog only hands navigation back to the router, and the permission state is itself the refusal |
| populated | Governance list; released questions; timeline; attention list; request context; picker; owner comboboxes; readiness; released Risks; admin lists; system owner; CSV | covered | §1.1, §2.1, §4.2 and §4.3, §5.3, §9.1, §13.1 and §13.2, §14.1, §15.2, §16.2, §16.4 and §17.1 fix the populated layout and copy |
| partial | Question form | covered | `New section title` shows only for `New section`; `Choices` only for select types (§1.2) |
| partial | Governance list; released questions | covered | Removed questions never render but count for placement (§1.3); conditional questions are listed; no answer content is shown, only the aggregate count (§2.1) |
| partial | Revision timeline | covered | An event without a snapshot resolves its text or reads `A question from an earlier version`; the Requestor summary omits changes before the first release (§4.2, §4.3) |
| partial | Attention list; radio groups | covered | An unavailable file question reads `{question} - required but unavailable`; an unchecked group shows no selection until answered (§5.3) |
| partial | Request context; released Risks | covered | `Not provided` or `Not recorded` per missing value; `Submitted` only once submitted; an absent rating is plain text (§9.1, §15.2) |
| partial | Record picker; owner comboboxes | covered | A selected record off the current page keeps its label from the served relation or the hydrate read; an owner without a served name reads `Name not available` (§13.1, §16.4) |
| partial | Date input | covered | A legacy exemption value with a time shows its UTC date and is rewritten only when changed (§13.3, D-32) |
| partial | Readiness summary | covered | Risks with nothing outstanding leave the outstanding list; the `Missing:` caption caps at four labels and `{k} more` (§14.1) |
| partial | Admin controls list; CSV import | covered | An untitled control's `Name` reads `Not provided` and its label uses the framework (§16.1, §16.2); rows with issues list them (unchanged) |
| overflow | Question form; governance list; released questions; attention list; request actions; intro; save status; next action | covered | Everything wraps within the content column; at 375 form fields are full width and actions stack; no horizontal page overflow from 320 (§1.1, §2.1, §5.1) |
| overflow | Replace, leave and submission dialogs | covered | Each sits at the §4 Dialogs confirm size, bounded by the viewport, with wrapping copy |
| overflow | Revision timeline; request context; released Risks; refusal lines | covered | Long values use `[overflow-wrap:anywhere]` (and `whitespace-pre-wrap` for request text); released groups drop to one column below 640px (§4.2, §9.1, §15.2) |
| overflow | Record picker; owner comboboxes | covered | The listbox takes the input's width and is bounded by the viewport as `OwnerCombobox` is; options wrap (§13.1) |
| overflow | Readiness summary; job cards; save confirmations; permission state; CSV import | covered | Rows and captions wrap; confirmations move below their button at 375; CSV tables keep the Phase 8 scroll regions |
| overflow | Administration controls list | backstop | `{ statement: "Long control titles in the Controls list and its mobile cards wrap without horizontal page overflow at 375 and 1440", verification: backstop }` |
| overflow | Information systems list | backstop | `{ statement: "With the Owner and Business criticality columns, Name, Owner and Business criticality are visible without scrolling at 1440, and any overflow scrolls only inside the labelled table region", verification: backstop }` |
| long-text | Question form; governance list; released questions; request context; released Risks; CSV import | covered | Question text, long request fields, treatment plans, evidence and issue messages wrap; wide rows span the grid (§1.2, §9.1, §15.2) |
| long-text | Revision timeline | covered | The server bounds a question snapshot at 500 characters with an ellipsis; lines wrap (§4.2) |
| long-text | Record picker; owner comboboxes; radio groups | covered | Option labels, the framework line and choice labels wrap; the selected line wraps (§13.1) |
| long-text | Readiness summary | covered | The `Missing:` caption is capped (§14.1) |
| long-text | Dialogs; save status; save confirmations; job cards; refusal lines; permission state; next action | covered | Fixed sentences of this contract, or server failure messages inside a wrapping alert (§12.4) |
| long-text | Date input | covered | A date input holds no free text |
| long-text | Introduction | backstop | `{ statement: "With a long questionnaire description at 375, the introduction wraps and the first question stays reachable within a normal scroll", verification: backstop }` |
| zero-one-many | Governance list; released questions; attention list; released Risks | covered | One question keeps `Delete` disabled; counts read `{answered} of {total} answered`; one or many links and cards render the same way |
| zero-one-many | Revision timeline; readiness summary; introduction | covered | `{n} {change|changes} to the questions`; `{n} outstanding` and the `Missing:` list grammar; `{n} {question|questions}` (§4.3, §14.1, §5.2) |
| zero-one-many | Request context; record picker; owner comboboxes | covered | One name per line or `None selected`; a full results page adds `Showing the first {n} matches. …` (§9.1, §13.1) |
| zero-one-many | Admin lists; CSV import | covered | The shipped counts and pagination; `The final check before import changed the result for {n} {row|rows}.` (§17.1) |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | none new. Existing `AlertDialog`, `Popover`, `Input`, `RadioGroup`, `Progress`, `Button`, `Textarea`, `Checkbox`, `Label`, `Alert`, `Card`, `Badge`, `Separator`, `Skeleton`, `Table` | not required: no block added and no registry fetched (2026-09-27) |
| Third-party | none | not applicable |

No new dependency: the picker composes the installed `Popover`, the leave warning the installed `AlertDialog`, and time zone detection uses `Intl`.

---

## Verification contract

- **Unit and component (vitest):**
  - Question form: open in place for each of the three invocations; focus in `Question text`; field errors and focus to the first invalid field; `Section` options with duplicate titles; `New section title` appears and is required; `Discard changes` returns focus; save focus and announcements; one form at a time with the release caption; the conflict error with `Reload questions`.
  - Placement: the three real section shapes and removed questions (research Wave 0).
  - Released questions: listed read-only with the count and no answer.
  - Replace: the four description variants, the destructive confirm, `Keep this questionnaire`, the released hint and its link.
  - Timeline: local hour with an explicit zone; the ` UTC` suffix without one and never on a date; question text or `A question from an earlier version`; no key anywhere; Requestor rounds and the neutral icon; `Questionnaire replaced`.
  - Introduction and attention region: introduction first; the region only after an attempt, in form order.
  - Save status: all six states with their roles; `Saving…` never in a live region; `Retry save` and `Refresh page`.
  - Leave warning: armed and disarmed conditions; dialog copy per state; focus on `Keep answering`; focus return.
  - Radio and segmented control: a quick arrow press checks once; wrap; modifiers, Home, End and Tab unchanged.
  - Submission copy: every §8 string and variant.
  - Request context: three groups, the third-party and regulatory rows, date-only instants.
  - Refusals: every §10.2 row per action; unknown and absent codes use the fallback.
  - Gate and permission copy: no service call for a Requestor; the variant descriptions and links.
  - Job cards: every §12 state, the next-action override, failure copy by code, the read-failure line.
  - Picker: open rules, groups, deduplication, keyboard, `Clear`, full-page hint, off-page selected label, required error.
  - Control owner search; exemption date round trip; save confirmations clearing on change.
  - Readiness grouping for three Risks with fourteen requirements each; the `Missing:` caption cap; the met toggle.
  - Released Risk fields for both actors, with no id; control label rule over the three shapes.
  - System owner name and columns; CSV strings; the copy guard.
- **Contract parity:** every new or widened parser joins `contract-response-parity.test.ts` (D-02).
- **E2E** (dev servers stopped; sign-in helpers assert the Dashboard heading and the role in the banner): the §19.1 rows, plus the research journeys:
  - add to an existing and a new section after deterministic generation, with the form in the viewport at 1440 and 375;
  - after release, the analyst sees `0 of N answered` and the questions;
  - type, click a sidebar link, see the dialog, keep answering, the text remains; after `Saved at`, navigate away and back, the answer is present;
  - `press('ArrowDown')` checks `No`;
  - return to the hub mid-job and see no second Generate;
  - pick a system by typing a record past the first page;
  - `Risk saved at {time}` after `Save risk`;
  - Jane sees control numbers, titles, treatment and owners;
  - the controls list shows `5.1` once;
  - the system owner name and columns;
  - a Brisbane-zone context shows a local hour.
  Zero serious axe violations at 375 and 1440 on each.
- **Browser backstops** (orchestrator): the UI Considerations backstop rows below, the leave prompt on reload, screen-reader cadence of the save status, the APP titles against Schedule 1, and copy voice on every Phase 10 surface (`10-VALIDATION.md` Manual-Only).

---

## Checker sign-off

- [x] Dimension 1 Copywriting: PASS. Every call to action is a verb and a noun, and none is generic. `Cancel` survives only as `ConfirmDialog`'s locked dismiss label on three dialogs whose descriptions this phase rewrites; it dismisses and is never a call to action (UI-D4). Empty, error, permission and destructive copy is declared, with a confirmation for each destructive action. First-pass flags, all fixed: `Dismiss` became `Dismiss notice`; "changes" and "answers" were made consistent in the save refusals; an overstated "every refusal has a next step" claim was corrected; the Controls form header was split for create and edit.
- [x] Dimension 2 Visuals: PASS. A focal point is declared for every primary surface (the first pass added the request pages, job cards, editors and systems list). No icon-only action lacks a label. The heading hierarchy is fixed per page, including the released view's move to an h3 per Risk.
- [x] Dimension 3 Color: PASS. The 60/30/10 split is declared by token. Ink is reserved for an enumerated list. One destructive token covers five enumerated confirmations. No new hue.
- [x] Dimension 4 Typography: PASS, by deferral to §3.10 as in Phases 06.5, 07 and 08. New elements use four text sizes and the direction's own weights; this phase adds no size or weight. The first pass removed restated pixel values.
- [x] Dimension 5 Spacing: PASS. Only the §3.9 steps 4, 8, 16, 24 and 32 are declared, all multiples of four in the standard set, with no exceptions. Shipped internal spacing is cited, not declared.
- [x] Dimension 6 Registry Safety: PASS. shadcn official, source-owned components only; no block added; no third-party registry.
- [x] Dimension 7 Inventory Provenance: PASS. Both inventories carry a command, a count, `package@version` and a date, placed before their tables.

**Checked:** 2026-09-27, gsd-ui-checker role, applied inline in two passes. Status: APPROVED. The first pass found no BLOCK. It raised FLAGs under Dimensions 1, 2 and 4, plus consistency defects: restated values, the released view's heading levels, a create and edit header, and list grammar. All were fixed and the second pass was clean. The UI-consideration probe ran afterwards (UI Considerations above).

**Approval:** approved 2026-09-27. The orchestrator accepted X-1 to X-5 and settled the readings flagged in Notes carried on 2026-09-27 (`10-CONTEXT.md` D-41 to D-45): no theme for untitled controls (D-42), and the middle dot beside D-38's spaced hyphen (D-43).

---

## Addendum (2026-10-03): copy settled during execution

**Accepted by the pilot, 2026-10-03.**

The plans, the code review fixes (`10-REVIEW-DISPOSITION.md`) and the UI review fixes (`10-UI-REVIEW.md`, Disposition) added user-visible strings that the sections above do not list. They are recorded here verbatim so that this contract matches the code. Each string was found in `apps/csrm/src` (outside tests) on 2026-10-03. The other walkthrough fixes in `10-23-SUMMARY.md` (fixes 1 and 4 to 8) applied strings and rules this contract already holds (`No changes to save.`, the X-4 separators, the §13.1 labels, the §17.1 templates), so they add nothing here. The values in this addendum follow the Voice rules above. A string marked "existing sentence" was already in the product at `5ea2b77`; only its use on the named surface is new.

### A.1 Record picker (§13.1)

| String | Surface | Introduced by |
|---|---|---|
| `The selection service is unavailable. Please try again later.` | The picker's search error when a search is rejected or throws, with `Retry search` (existing sentence) | WR-301 (`5550fa5`) |
| `Press Enter to retry.` | The second line of the picker's search error alert, between the error and `Retry search`. Enter in the input retries while no option is active, because focus never enters the popup | WR-302 (`4d964a4`) |

### A.2 Leave warning (§6.3)

| String | Surface | Introduced by |
|---|---|---|
| `Leaving questionnaire…` | Pending label of `Leave questionnaire` in the `Leave this questionnaire?` dialog | Plan 10-08 (`fae371d`) |

### A.3 Questionnaire generation card (§3, §12.1, §12.4)

| String | Surface | Introduced by |
|---|---|---|
| `A questionnaire already exists for this request.` | Hint in place of an action when the request holds a questionnaire that is not served as in analyst review or released (submitted, state-less or unopenable). No replacement is offered | IN-201 (`6e56c85`) |
| `Questionnaire generation couldn’t start` | Alert title for a refused or failed start or retry. Its description is the §10.2 I sentence or an A.5 sentence. `Status unavailable` stays for a failed status check only | Plan 10-14 (`f865b2d`), resolving the 10-12 deferred item |
| `This questionnaire’s change history can’t record more changes. Contact your administrator.` | Failed-job copy for `failureCode` `HISTORY_UNAVAILABLE`, a new §12.4 row. This is §10.2 G's sentence | WR-102 (`ee93a02`) |

### A.4 Assessment draft card (§12.2)

| String | Surface | Introduced by |
|---|---|---|
| `Draft generation couldn’t start` | Alert title for a refused or failed draft start or retry. `Status unavailable` stays for a failed status check only | Plan 10-14 (`f865b2d`) |
| `Draft generation can begin only after the linked questionnaire is submitted.` | Draft refusal, reason `QUESTIONNAIRE_NOT_SUBMITTED` (the §12.2 precondition sentence, reused) | WR-205 (`aac23e7`) |
| `An assessment already exists for this request, so a draft can’t be generated.` | Draft refusal, reason `ASSESSMENT_STARTED` (§10.2 E and F wording) | WR-205 (`aac23e7`) |
| `An assessment draft can’t be generated for this questionnaire in its current state.` | Draft refusal fallback (none or unknown reason). Strapi serves no reason on a draft 409 today, so this is the sentence an analyst reads. It replaces `This assessment changed. Reload and try again.` | WR-205 (`aac23e7`) |

These three form a draft refusal family (`assessmentDraft` in `refusal-copy.ts`) beside §10.2 A to I.

### A.5 Generation failures other than a refusal (§12)

These are shown in the card's start alert (A.3, A.4) or its `Status unavailable` alert. Each one names the record the operation acts on, never an assessment that may not exist (`generation-failure-copy.ts`, WR-205, `aac23e7`).

| Operation | 403 | 404, the record | 404, the job | Other failure, or the Server Action throws |
|---|---|---|---|---|
| Questionnaire generation (start, retry, job read) | `You do not have permission to generate a questionnaire for this request.` | `This request is no longer available.` (existing sentence) | `This questionnaire generation is no longer available.` | `The questionnaire generation service is unavailable. Please try again later.` |
| Assessment draft (start, retry, job read) | `You do not have permission to generate an assessment draft for this questionnaire.` | `This questionnaire is no longer available.` (existing sentence) | `This draft generation is no longer available.` | `The assessment service is unavailable. Please try again later.` (existing sentence) |
| The request's generation jobs read | `You do not have permission to check generation for this request.` | `This request is no longer available.` (existing sentence) | `This request is no longer available.` (existing sentence) | `The request service is unavailable. Please try again later.` (existing sentence) |

### A.6 Risk detail (§11.2, §17.1)

| String | Surface | Introduced by |
|---|---|---|
| `View a Risk and the controls that mitigate it.` | `Risk details` page header description in the loading, not-available, error and permission states (it was `View a contextual Risk and its mitigation-control information.`) | Plan 10-21 (`1c037be`). `10-CONTEXT.md` D-45 accepted it |

### A.7 Risk Type form, applicable controls field (§16.2, §17.1)

These strings were written in Title Case and are now in sentence case, because "control" is not a capitalised record term (Voice).

| String | Surface | Introduced by |
|---|---|---|
| `Applicable controls` | Section heading, field label and the combobox's accessible name (they were `Applicable Controls`) | UI review fix 2 (`76a8e7b`) |
| `Search controls` | The field's search button (it was `Search Controls`) | UI review fix 2 (`76a8e7b`) |
| `Selected applicable controls` | The selected-controls group's legend | UI review fix 2 (`76a8e7b`) |
| `No applicable controls selected.` | The group's empty line | UI review fix 2 (`76a8e7b`) |
| `{n} control options available.` | The visually hidden options count (`role="status"`) | UI review fix 2 (`76a8e7b`) |
| `Select 1,000 applicable controls or fewer.` | The field's upper-bound error | UI review fix 2 (`76a8e7b`) |
| `Applicable controls must be distinct.` | The field's duplicate error | UI review fix 2 (`76a8e7b`) |

The Administration list's `Search {collection}` box (`Search Controls`) keeps the collection name, as walkthrough fix 5 decided for titles, buttons and links. It is not part of this field.

**Count:** 28 strings (A.1 2, A.2 1, A.3 3, A.4 4, A.5 10, A.6 1, A.7 7). A.5 counts `This request is no longer available.` once, although it fills three cells.
