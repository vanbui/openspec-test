---
phase: "17"
slug: "mitigation-response-and-residual-reassessment"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 17 — UI Design Contract

> Visual and interaction contract for the response stage (ASSESS-11, 12, 13, 21, 22, 23). It covers:
> - the stage, response and decision values in the one status mapping (D-05, D-06);
> - risk owner nomination, one step for all and by risk, with the people picker (D-16 to D-21, D-55);
> - release-for-response readiness, its confirmation, the round panel and the editing pause (D-09 to D-15, D-43 to D-45);
> - the participant page at every stage, with the response form and everyone's submitted responses (D-22 to D-27, D-31 to D-37);
> - the analyst's decisions on responses, and "Reassess residual risk" confirmed per field (D-38 to D-42, D-46 to D-51);
> - "My risk assessments", the Requestor Home, the lifecycle step and the queues (D-07, D-08, D-28);
> - this phase's two notification kinds on Phase 19.1's centre (D-57), and the refusals (family U).
>
> It adds no colour, type size, weight, family, radius, shadow or duration. Six patterns the direction does not name yet are proposed as CSRM extensions X-36 to X-41.

---

## Binding inputs and value authority

- **Locked decisions:** D-01 to D-78 and the Orchestrator Confirmations in `17-CONTEXT.md` (the notification centre is Phase 19.1's; this phase adds only `response-requested` and `response-submitted`). Research: `17-RESEARCH.md` §A (names and vocabularies), §B (bounds), §C (stage, step, holder, queue), §D (participant routes and the `beingPrepared` mask), §F (rounds, drafts, decisions). Open points are settled under "Decisions recorded" (UI-D1 to UI-D26).
- **Value authority:** `docs/design/csrm-design-direction.md` (ADR 0001) only, cited by section (§). This contract restates no value.
- **Extensions reused** (recorded by Phases 10 to 19.1 before this phase executes): X-1 (save status), X-2 (record picker), X-3 (dates and times), X-4 (separators), X-5 (in-place edit form), X-9 (compact stepper), X-10 (figure links), X-11 (AI provenance), X-12 (source citations), X-13 (side sheet), X-14 (Undo toast), X-15 (assignee control, for the "who may act" line), X-24 and X-28 (proposal items and field decisions), X-25 (AI instruction field), X-27 (withdrawn records), X-30 and X-31 (export and print report), X-34 (notification item). New: X-36 to X-41, recorded in the direction by a Phase 17 plan task before any implementing task.
- **Earlier contracts, cited by section and never restated:**
  - **Phase 10:** §10.2 (refusal format and kinds), §13.1 and §13.2 (record picker, control owner), §13.4 (save confirmations), §14 (readiness anatomy), §15 (released view, shared read-only Risk, `Not recorded`), the navigation guard.
  - **Phase 11:** "Voice, formats and shared copy rules"; §1.3 (counts); §2.4 (recovery copy and the in-shell not-found); §5.2 (Requestor Home); §5.3 (`Your own requests`); §6 (next action, compact stepper); §7 (lists); §12 (five-state format).
  - **Phase 12:** §1 (provenance header), §6 (decisions, family J), §10.1 (the Requestor's AI notice), UI-D1 (visible `Confirm`).
  - **Phase 13:** "Voice" (people are names, parts), §5.2 and §6 (assignment block, picker frame), §7.4 (family K), §12 (Requestor holder sentences).
  - **Phase 16:** §1 (editor order), §2 (`AI proposals` section), §4 and §5 (rewrite, comparison, decisions, toasts, focus), §9 (readiness, overall-rating hint), §12.3 (the line that replaces withheld analyst controls), §13 (family R).
  - **Phase 19:** §1 (Export placement), §4 (print report). **Phase 19.1:** §3 (notification item and sentences).

### Decision coverage

| Decisions | Where |
|---|---|
| D-05, D-06 | §1 (stage values, X-39), §14.3 (analyst lists) |
| D-07, D-08 | §14.4 (holder), §14.5 (stepper, X-41), §14.6 (queue) |
| D-09 to D-15 | §3 (readiness and confirmation), §4 (round panel, close, X-36), §5 (editing pause) |
| D-16 to D-21 | §2 (nomination), §11 (people picker, X-40), §5.2 (owner who is an analyst) |
| D-22 to D-27, D-29 | §6 (participant page), §6.6 (print and export), §5.2 (analyst participants) |
| D-28 | §14.1 to §14.3 |
| D-31 to D-37 | §7 (response form, X-37), §8 (submitted responses, X-38) |
| D-38 to D-42 | §9 (decisions, X-38) |
| D-46 to D-51 | §10 |
| D-52 to D-55 | §11 |
| D-57 (two kinds) | §12 |
| D-70 to D-73 | §16 (G-4), Copywriting, extensions |

---

## Design system

As Phase 19 "Design system". Every icon named here was confirmed in the installed `lucide-react` 1.30.0 on 2026-10-01: `MessageSquareReply`, `Hourglass`, `EyeOff`, `CircleCheck`, `CircleDashed`, `FilePenLine`, `CircleSlash`, `Scale`, `Check`, `X`, `UserRoundCheck`, `UserRoundPen`, `UsersRound`, `CirclePause`, `CircleMinus`, `Plus`, `MessageSquareText`, `Sparkles`, `Lock`, `Inbox`, `SkipForward`, `ListX`, `Undo2`, `Printer`, `Download`, `EyeOff`, `Unlink` (`Unlink` is Phase 12's `No source cited` icon).

**New dependencies:** none.

---

## Component inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

This list is non-exhaustive: it names the known-good components this phase uses and is never a closed allowlist.

| Component | Import path | Phase 17 use |
|---|---|---|
| `Sheet` | `@/components/ui/sheet` | Nomination sheet (X-13), the phone response sheet (X-37), phone decision forms |
| `Popover`, `Command` | `@/components/ui/popover`, `@/components/ui/command` | The people picker's listbox (X-40), the reassessment form from 768px |
| `Dialog` (through `ConfirmDialog`) | `@/components/ui/dialog` | Release for response, close round, submit response |
| `Checkbox`, `Input`, `Textarea`, `Label` | `@/components/ui/*` | Response fields, `Nothing to add`, risk choice, reasons, message |
| `Select` | `@/components/ui/select` | Effectiveness in the add form; list filters |
| `Alert` | `@/components/ui/alert` | Stage notice, error summary, refusals inside forms |
| `Button`, `Card`, `Badge`, `Skeleton`, `Separator` | `@/components/ui/*` | Actions, cards, tags, skeletons |
| `sonner` `Toaster` | `@/components/ui/sonner` | Undo and failure toasts (X-14) |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

This list is non-exhaustive.

| Primitive | Path | Phase 17 use |
|---|---|---|
| `StatusBadge` (`statusPresentation`) | `components/csrm/status-badge.tsx` | Three new families (§1) |
| `DataTable` | `components/csrm/data-table.tsx` | Participants (§2.1), My risk assessments (§14.1) |
| `SegmentedControl` | `components/csrm/segmented-control.tsx` | `Apply to`, `Status`, `Show`, `Density` |
| `ConfirmDialog`, `DetailSection`, `PageHeader`, `RecordLink`, `RiskRatingBadge` | `components/csrm/*` | Confirmations, sections, headers, links, ratings |
| Phase 10 `OwnerCombobox` successor (record picker), `LocalInstant`, navigation guard, `refusal-copy.ts` | as Phase 10 plans them | X-40, X-3, unsaved input, family U |
| Phase 16 comparison, decision toasts, density store; Phase 19 export and report; Phase 19.1 wording module | as those phases plan them | §10, §6.6, §12 |
| **New:** responses feature | recommended `features/responses/` (`response-domain.ts` zod-free; `round-panel.tsx`; `response-form.tsx`, loaded on demand; `response-items.tsx`; `decision-form.tsx`, loaded on demand; `participants-section.tsx`; `nomination-sheet.tsx`, loaded on demand; `response-actions.ts` `'use server'`) | §2 to §9 |

Names and paths belong to the planner. Client modules stay zod-free (`zod-client-boundary.test.ts`).

---

## Voice, formats and shared copy rules

Phase 11's and Phase 13's rules apply unchanged. In addition:

- **Terms (D-73):** `Release for response`, `Released for response`, `Round {n}`, `Close round {n}`, `Your response`, `Submit response`, `Nothing to add`, `Proposed mitigation control`, `Risk owner`, `Set one owner for every risk`, `Reassess residual risk`, `Confirm`, `Reject`, `Participant`, `Your part`, `Your risk`. The analyst's decision on a proposed control is `Add to {risk number}` and on a proposed owner `Make {name} risk owner`. The visible word `Accept` is never used for an analyst's act (12 UI-D1), and copy never says "approve", "sign off" or "share".
- **Parts** read `Requestor`, `Risk owner`, or both joined by the middle dot (`Requestor · Risk owner`). A risk owner's part on a list adds their count: `Risk owner · 2 risks`.
- **Stage words** come only from the mapping (§1). "Final" is never said of anything before release.
- **Plain text:** every participant-written value is shown as typed, wrapping anywhere, never rendered as HTML or Markdown (D-33).

---

## 1. Values in the one status mapping (D-05, D-06; X-39)

Three new families in `statusPresentation`. Feature code never chooses a label, tone or icon.

| Family | Value | Label | Tone (§4 tone vocabulary) | Icon |
|---|---|---|---|---|
| Stage | `not-shared` | `Not shared` | neutral | `EyeOff` |
| Stage | `released-for-response` | `Released for response` | info (waiting on the Requestor and the risk owners) | `MessageSquareReply` |
| Stage | `with-security-analyst` | `With the Security Analyst` | warning | `Hourglass` |
| Stage | `released` | `Released` | success | `CircleCheck` |
| Response | `requested` | `Not started` | neutral | `CircleDashed` |
| Response | `draft` | `Draft` | info | `FilePenLine` |
| Response | `submitted` | `Submitted` | success | `CircleCheck` |
| Response | `not-submitted` | `Not submitted` | neutral | `CircleSlash` |
| Proposal | undecided | `Awaiting decision` | warning | `Scale` |
| AI citation | uncited residual rationale | `No control cited` | warning | `Unlink` |

- `not-shared` renders only on analyst surfaces. Phase 17.1 adds `awaiting-acceptance` as a row (the G-13 seam), and Phase 19's label vocabulary holds the same labels (its parity test).
- A decided proposal shows a provenance note, never a badge (§8.2).

---

## 2. Risk owner nomination (D-16 to D-21)

### 2.1 The `Participants` section (analyst editor)

A `DetailSection`, h2 `Participants`, id `participants` (`tabIndex={-1}`), placed after the details and readiness grid (16 §1 item 3).

| Part | Contract |
|---|---|
| Description | `The Requestor and the risk owners read this assessment from its first release for response, and respond on their risks.` |
| Before the first release (stage `not-shared`) | One line, `EyeOff` 16px, `--text-body` / `--color-text-secondary`: `Not shared yet. They can read it once you release it for response.` |
| Owner coverage | `{o} of {n} risks have a risk owner` (`--text-body` at 500, `tabular-nums`, active risks only). When some have none, a figure link `{u} without an owner` (X-10) opens §2.2 with those risks chosen |
| Actions (when nomination is allowed: editable, no round open, viewer not a named owner) | `Set one owner for every risk` (outline small, `UsersRound`) and `Set owners by risk` (ghost small) |
| Table (from 768px) | `DataTable`, both densities: `Name`, `Part`, `Risks owned` (magnitude numeric), and once the gate is open `Round {n} response` (§1 response badge) and `Submitted` (X-3 instant, else `Not submitted`). The Requestor first, then owners by name. A former participant does not appear here (their responses keep their attribution, §8.1) |
| Cards (below 768px) | One per person: name (`--text-body` 500), part, `{k} risks owned`, the response badge and time |

When nomination is not allowed, the actions are absent and one line says why (X-15's rule): during a round, `Risk owners can change once round {n} is closed.`; for a named owner, §5.2's line; after release, nothing.

### 2.2 The nomination sheet (X-13)

Title `Set risk owners`. From 768px the side sheet; below it the full-screen sheet with `Close` named `Close risk owners`.

| Part | Contract |
|---|---|
| `Apply to` | `SegmentedControl`: `Every risk ({n})` (default from `Set one owner for every risk`) and `Selected risks` (default from `Set owners by risk` and the figure link) |
| Risks (shown for `Selected risks`) | A fieldset, legend `Risks`, one checkbox per active risk: `{risk number} · {risk statement}` (clamped to two lines, full text in the DOM) with `Owner: {name}` or `No owner` in `--text-caption` / `--color-text-secondary`. `Select all` (ghost small) while any is unchecked. Withdrawn risks are absent |
| Person | X-40 picker, label `Risk owner`, hint `Type at least 2 letters of a name. People on this request are listed first.` Suggested group `On this request`: the Requestor (`{name} · Requestor`) and current owners. The request's assigned Security Analyst shows, when matched, as not eligible (X-40) |
| Action | `Set risk owner` (primary), accessible name `Set {name} as risk owner of {k} {risk\|risks}`. Never disabled: missing input shows `Choose a risk owner.` or `Choose at least one risk.` as field errors |
| No lost input | The choice and the checked risks are kept in the session store (13 UI-D31's pattern) until the change applies |

**Apply.** The sheet closes at once, the owners change in the page at the pending opacity (§5 Optimistic UI), and focus moves to the `Participants` heading. Toast (X-14): `{name} is now the risk owner of {k} {risk|risks}.` with `Undo`, which sends the previous owners back as pairs and confirms `Risk owners restored.` When every pair was unchanged: info toast `{name} already owns {that risk|those risks}.`, no Undo. Failure: rollback, title `Risk owners not set`, family U1.

### 2.3 One risk, from its card

The Risk form's `Risk owner` field becomes the X-40 picker (hint as §2.2, selected line `Selected risk owner: {name}`), saved with the form (10 §13.4, `Risk saved at {time}`). No dialog, no toast.

---

## 3. Release for response (D-09, D-10, D-13)

### 3.1 The readiness card

A card in the details and readiness grid, before `Release readiness`, shown while the assessment is editable, unreleased and no round is open. 10 §14's anatomy, with:

| Part | Contract |
|---|---|
| Heading | h2 `Release for response` |
| Description | `The Requestor and the risk owners read the whole assessment and respond on their risks. Nothing is final. We check every requirement again when you release.` |
| Count line | `{met} of {total} requirements met`, or `Ready to release for response` |
| Requirement labels (served; per Risk where marked) | `At least one Risk` · `Risk statement`* · `Inherent risk rating`* · `Residual risk rating`* · `Eligible risk owner`* · `Review of AI proposals` (12) · `Decisions on AI proposals` (16) · `No AI request running` · `No response round open` · `Assessment can be changed` · `Request assigned to a Security Analyst` |
| Earlier rounds | When rounds ran: caption `Round {n} closed {date}. Releasing again opens round {n+1}.` |
| Action (the assigned analyst only) | `Release for response` (primary, `MessageSquareReply`). Not offered until ready; the count line and list say what is outstanding |
| Other analysts | X-15's line: `{name}, the assigned Security Analyst, releases this assessment for response.` or, when not picked up, `Pick up this request to release it for response.` |

`Release readiness` (10 §14) gains `No response round open` (destination `#response-round`) and `Responses decided`, outstanding with the caption `{u} awaiting decision` (`tabular-nums`) linking to the first risk's `#risk-{id}-responses`.

### 3.2 The confirmation (governance step)

`ConfirmDialog` at the form width (640px; full-screen sheet below 768px).

| Part | Contract |
|---|---|
| Title | `Release {assessment number} for response?` |
| Body | `They will read the whole assessment and can respond on their risks:` then a list of each person, `{name} · Requestor` or `{name} · Risk owner of {k} {risk\|risks}`. Then `Nothing is final. Editing pauses until you close round {n}, and you decide each response after that.` |
| Earlier undecided | When earlier rounds left items undecided: `{u} {proposal\|proposals} from earlier rounds {is\|are} still awaiting your decision. You can decide them after this round closes.` |
| Message | `Textarea` labelled `Message to participants (optional)`, hint `Shown with round {n}. Plain text, up to 2,000 characters. It isn’t sent to the AI.` Over the limit: `Keep the message to 2,000 characters or fewer.` Kept in the session store until the release succeeds |
| Actions | `Release for response` (primary; pending `Releasing…` with the inline spinner) and `Keep editing` (outline; `Escape`) |
| Refusal | Family U2 inside the dialog above its actions; the message stays |

Success: the dialog closes, the page refreshes into the open-round state, focus moves to the round panel's h2, and a success toast reads `{assessment number} released for response. Round {n} is open.` No Undo (a governance step, X-14).

---

## 4. The round panel (D-09, D-12; X-36)

A `section`, id `response-round` (`tabIndex={-1}`), the first content after the page header and provenance header on the analyst page, and after the stage notice on the participant page (§6.1). It renders once any round has opened.

### 4.1 Analyst form

| State | Contract |
|---|---|
| Round open | h2 `Round {n} is open for responses`. Line (`CirclePause` 16px, `--text-body` at 500): `Editing is paused until you close round {n}.` Facts (`--text-caption`): `Released {instant} by {name}`. The message, when given, under the micro-label `Message to participants`, quoted. Figure link `{s} of {p} responses submitted` to `#participants`. Action: `Close round {n}` (outline, the assigned analyst only); others read `{name}, the assigned Security Analyst, closes this round.` |
| Round closed, items undecided | h2 `Round {n} closed`. Facts `Closed {instant} by {name}`. Figure link `{u} {proposal\|proposals} awaiting your decision` to the first `#risk-{id}-responses` |
| Round closed, all decided | h2 `Round {n} closed`, facts, and `Every proposal from round {n} is decided.` |
| Earlier rounds | An outline small toggle `Earlier rounds ({k})`, revealing one line each: `Round {m} · {opened date} to {closed date} · {s} of {p} responses submitted` |

### 4.2 Close round

- **All submitted:** closes at once (pending opacity on the button), then success toast `Round {n} closed. {u} {proposal awaits|proposals await} your decision.` (or `Round {n} closed.`) and focus to the panel h2. No Undo.
- **Someone outstanding:** `ConfirmDialog` (480px), title `Close round {n}?`, body `{names} {hasn’t|haven’t} submitted a response. Closing ends their turn in this round. Their drafts are kept and come back if you open another round.`, actions `Close round {n}` (primary) and `Keep round open` (outline). Refusal: family U2 in the dialog.

---

## 5. While a round is open, and analysts who take part (D-18, D-37, D-43 to D-45)

### 5.1 The editing pause

The analyst editor renders its read-only form (as after release, 16 §12.1) with these differences:
- `Identified Risks` opens with one line (`CirclePause`): `Editing is paused while round {n} is open. Close the round to edit, decide responses or ask the AI.`
- The `AI proposals` section takes 16 §2.4's not-editable row with this line: `Round {n} is open for responses, so the AI can’t be asked and proposals can’t be decided until you close it.`
- Notes and reassignment stay available. The `Release assessment` control is not offered, and readiness shows `No response round open` outstanding.
- Submitted responses are readable (§8) but carry no decision controls until the round closes.

### 5.2 An analyst who is a named risk owner (D-18, D-20)

Following 16 §12.3, one line with `Lock` replaces every withheld control, under the page header: `You’re a risk owner on this assessment, so another Security Analyst edits it, sets its risk owners, decides its responses and asks the AI about it. You can still read it, and respond on your risks.` Nothing is shown disabled. Their analyst reads stay.

### 5.3 An analyst who is a participant (D-37)

The analyst page adds a `Your response` panel (X-36 participant form, §6.3) after the round panel, and each risk they may respond on gains §7's area. An analyst who is not a participant sees no `Your response` panel or response area at any stage.

---

## 6. The participant page (`/app/assessments/{documentId}`; D-22 to D-27)

### 6.1 Order and frame

1. **Page header:** eyebrow `{assessment number}`; title `Risk assessment` (was `Released risk assessment`); description `{request title}`. A meta row below it: the stage badge (§1), then `Your part: {part}` (`--text-body`, `--color-text-secondary`). Actions once released: `Print report`, then `Export` (19 §1). None before release.
2. **Stage notice** (`--text-body`, `--color-text-secondary`, the stage's icon 16px `aria-hidden`):
   - released for response, Requestor: `Round {n} is open. Read the whole assessment, then tell the Security Analyst which controls you have or plan on any risk. Nothing here is final.`
   - released for response, risk owner: `Round {n} is open. Read the whole assessment, then tell the Security Analyst which controls you have or plan on your {k} {risk|risks}. Nothing here is final.`
   - with the Security Analyst: `The Security Analyst is deciding the responses and may still change this assessment. You’ll be told when there’s more to do.`
   - released: `This is the released risk assessment.`
3. **Round panel** (X-36 participant form, §6.3), id `your-response`.
4. **h2 `Request summary`:** a definition list (labels `.micro-label`, 10 §15.2 layout): `Request`, `Title`, `Description` (wide, prose), `Assessment type`, `Division`, `Business unit`, `Business criticality` (plain text, 11 UI-D27), `Information systems in scope`, `Information assets in scope` (names, comma-joined). `Request` is a `RecordLink` to the request page for the Requestor and plain text for anyone else.
5. **h2 `Assessment overview`** (10 §15.1). The AI notice (12 §10.1) reads, before release, `AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before sharing it with you.` and after release 12 §10.1's sentence unchanged. `Release date` and `Released by` show once released.
6. **h2 `Identified risks`** with the `Show` filter (§6.2) and one card per active Risk (10 §15.2), each adding: the `Your risk` tag (X-39) beside its number when the viewer owns it; §7's `Your response` area while they may respond on it; §8's `Responses`.

Withdrawn risks never appear (16 §12.2). A risk masked as `beingPrepared` (D-26) is a card with its h3 number and one line, `Hourglass` 16px: `The Security Analyst is still preparing this risk. It shows here once it’s ready.` It has no response area. A legacy released assessment (no gate) renders items 1, 2, 4 to 6 with no round panel or responses.

| Viewport | Contract |
|---|---|
| 1440 | `--spacing-container-max`; the round panel full width; each risk's response area inside its card |
| 375 | Single column; risk cards hold a summary and open the response sheet (§7.3); no horizontal scroll from 320px |

### 6.2 `Show` filter

A `SegmentedControl` labelled `Show`, `All risks ({n})` and `Your risks ({k})`, rendered only when the viewer owns some but not all active risks. Kept in the address (`?risks=mine`).

### 6.3 Participant form of the round panel (X-36)

| State | Contract |
|---|---|
| Round open, not submitted | h2 `Round {n}: your response`. Facts `Released {instant} by {name}`. The message under `Message from {name}`, quoted. Progress `{r} of {k} {risk has|risks have} a response` (`tabular-nums`, risks they may respond on). X-1 save status (`Saving…`, `Saved at {time}`). While the draft holds no item: the checkbox `Nothing to add`, described `I’ve read the assessment and have no controls, owner changes or comments to propose.` Then `Submit response` (primary, `Ctrl`/`⌘` `Enter` from any response field, X-7 hint from 768px) |
| Submitted | The `Submitted` badge, `Submitted {instant}`, and `You can’t change your response in this round. The Security Analyst decides each proposal after the round closes.` |
| Round closed before submitting | The `Not submitted` badge and `Round {n} closed before you submitted. Your draft is kept and comes back if the Security Analyst opens another round.` |
| No round open, rounds ran | h2 `Response rounds`, one line per round: `Round {m} · {opened date} to {closed date} · Your response: {status label}` |
| Carried forward (round n+1 opened over an earlier draft) | Caption: `Your unsubmitted response from round {m} is carried into this round.` |

### 6.4 Submitting (governance step)

`Submit response` first checks completeness in the browser (the domain module) and then on the server:
- **Incomplete or empty:** no dialog. An error `Alert` in the panel, focused, titled `{e} {item needs|items need} attention before you submit`, with one link per problem (`{risk number}: {field error}`) moving focus to its field (10 §5.3's pattern). An empty draft without `Nothing to add` reads `Add a response to at least one risk, or choose Nothing to add.`
- **Complete:** `ConfirmDialog` (480px), title `Submit your response to round {n}?`, body `You can’t change it in this round once it’s submitted. The Security Analyst and the other participants ({names}) will see it.`, then a summary line `{c} proposed {control|controls}, {o} proposed {owner|owners} and {m} {comment|comments} on {r} {risk|risks}` or `Nothing to add`. Actions `Submit response` (primary; `Submitting…`) and `Keep editing` (outline).

Success: success toast `Response submitted for round {n}.`, the panel shows the submitted state, focus moves to its h2. Refusal: family U3 in the dialog.

### 6.5 Refused readers (D-24)

Anyone who may not read gets the in-shell not-found page (11 §2.4), unchanged, at every stage and on every assessment route, including the print report. The page never uses a different message for an unrelated Requestor, a nominated owner before release for response, or a former owner.

### 6.6 Print and export (D-29)

After release, 19 §1 and §4 apply to every participant unchanged. Before release no `Print report` or `Export` renders. A participant who opens the report address before release sees, in the report route, the shared state `This report isn’t available yet` · `You can print it once the risk assessment is released.` · outline `Back to the risk assessment` (family U7), never the not-found page (UI-D20). The report prints the rounds' submitted responses nowhere: the released report is unchanged (19 §4.3).

---

## 7. Your response on a risk (D-31 to D-35; X-37)

### 7.1 The area

From 768px, a `section` inside the risk card after its read-only content: h4 `Your response`, id `risk-{id}-your-response`, an X-5 well that stays open while the round is open. It holds, in order:

1. **Proposed mitigation controls:** each a fieldset (legend `Proposed mitigation control {i}`), §7.2's fields, and `Remove control` (ghost small, named `Remove proposed mitigation control {i} on {risk number}`). Then `Add a mitigation control` (outline small, `Plus`); at 10 it gives way to `You’ve added the most controls a response can hold on this risk.`
2. **Proposed risk owner:** `Propose a different risk owner` (ghost small, `UserRoundPen`) reveals the X-40 picker `Proposed risk owner` and `Reason` (`Textarea`, required, hint `Why they should own this risk. The Security Analyst decides.`), with `Remove proposal` (ghost small).
3. **Comment:** `Comment for the Security Analyst (optional)`, hint `Plain text, up to 2,000 characters. Everyone taking part sees it once you submit.`

Empty (nothing added on this risk): `No response on {risk number} yet` · `Add the controls you have or plan for this risk, propose a different risk owner, or leave a comment.`, with `Add a mitigation control` (outline small) as its action (UI-D11). Adding moves focus to the new control's title. Removing applies at once with an Undo toast `Control removed from your response.` (`Undo` confirms `Control restored.`) and moves focus to the next control or `Add a mitigation control`.

### 7.2 Control fields

| Field | Contract |
|---|---|
| `Control title` | Required, up to 200 characters. Errors: `Give the control a title.`, `Keep the title to 200 characters or fewer.` |
| `Description (optional)` | `Textarea`, up to 2,000 |
| `Status` | `SegmentedControl`: `Existing`, `Planned`. Hint for the checked value: `In place now. Say what shows it works.` or `Not in place yet. Give the date it will be.` |
| `Control owner` | X-40, required. Error `Choose a control owner.` |
| `Due date` (Planned only) | Date input, required. Hint `When the control will be in place.` Errors `Enter the date the control will be in place.`, `Enter a date from today onwards.`, `Enter a date within five years.` |
| `Evidence` (Existing) / `Evidence (optional)` (Planned) | `Textarea`, up to 2,000; required when Existing. Hint `What shows this control works, such as a report, a log or a review.` Error `Say what shows this control works.` |

Validation is on blur for format and length; completeness is checked at submit (§6.4). A save never fails for incompleteness (D-31, research Pitfall 7).

### 7.3 Phones

Below 768px the risk card shows `Your response` as a summary (`{c} proposed {control|controls} · Proposed risk owner: {name} · Comment`, or `No response yet`) and `Respond on {risk number}` (outline, full width, touch-target height). It opens a full-screen sheet titled `Your response: {risk number}` with `Close` named `Close your response`, holding §7.1, and a pinned footer with the X-1 save status and `Done` (outline, full width). Closing keeps every value; focus returns to the opener.

### 7.4 Autosave and no lost input

Saves are debounced as Phase 10's questionnaire autosave (10 §6.2), one draft per person and round, with the X-1 status in the round panel (and the phone sheet's footer). A failed save keeps every value on screen with X-1's failed state and `Try again`. The navigation guard (10 §6.3) covers unsaved changes; its dialog reads `Leave without saving your response?` · `Your last changes haven’t saved yet.` · `Keep editing` / `Leave page`. After the round closes, the fields render read-only with family U3's line.

---

## 8. Submitted responses (D-36; X-38)

### 8.1 Where they show

Each risk card, on both pages, gains `Responses` (h4 on the participant page, h3 in the editor; id `risk-{id}-responses`, `tabIndex={-1}`) once any response on it is submitted, newest round first, then by submission time. Each item is a card (X-24's item card frame):

| Part | Contract |
|---|---|
| Eyebrow (`--text-micro`, 12px icon) | `Proposed mitigation control` (`Plus`), `Proposed risk owner` (`UserRoundPen`), `Comment` (`MessageSquareText`) |
| Subject (`--text-body` 500) | The control title; the proposed person's name; none for a comment |
| Content | Control: `Existing` or `Planned` · `Owner: {name}` · `Due {date}` (Planned), then description and `Evidence` under micro-labels. Owner: `Reason: “{reason}”`. Comment: the text |
| Attribution (`--text-caption`, `--color-text-secondary`) | `{name} · {part} · Round {n} · {instant}`. A former participant's part reads `Former risk owner` |
| Decision | The `Awaiting decision` badge (§1), or a provenance note (§8.2) |

Drafts are never shown to anyone but their author. Comments carry no decision.

### 8.2 Decision notes (X-11 note style)

| Decision | Note |
|---|---|
| Control added | `Added as {control label}` (`Check`) `· {name} · {instant}`; when the analyst changed it, a second line `Changed: {fields}. Reason: “{reason}”` |
| Owner changed | `{name} made risk owner` (`UserRoundCheck`) `· {analyst} · {instant}` |
| Rejected | `Rejected` (`X`) `· {name} · {instant}`, then `Reason: “{reason}”` |
| Lapsed (analysts only) | `Closed without a decision` (`CircleMinus`): `{risk number} was withdrawn.` Participants never see items on withdrawn risks (D-26) |

### 8.3 Density

On the analyst page `Responses` follows 16 §2.1's `Density` setting (one per person); compact uses 12px card padding and collapses description and evidence behind `Show details`. The participant page is comfortable only.

---

## 9. Deciding responses (analyst; D-38 to D-42; X-38)

Offered on each undecided item once its round is closed, on an editable assessment, to a human Security Analyst who is not a named owner. Every decision goes through one batch Server Action.

| Item | Actions |
|---|---|
| Proposed control | `Add to {risk number}` (outline small, `Plus`) and `Reject` (ghost small, `X`) |
| Proposed owner | `Make {name} risk owner` (outline small, `UserRoundCheck`), applied at once, and `Reject` |
| Group (per risk, two or more undecided) | `Reject remaining ({k})` (outline small, `ListX`), as 16 §5.4 with a required reason. There is no add-all control (X-28's rule for creating decisions) |

### 9.1 The add form

`Add to {risk number}` opens an X-5 well inside the item card (a bottom sheet below 768px, title `Add to {risk number}`), prefilled with the proposal, focus on `Control`:

| Field | Contract |
|---|---|
| `Control` | 10 §13.1's picker, required, suggested group `Applicable to {Risk Type name}`. Error `Choose a control.` |
| `Status` | `SegmentedControl` `Existing`, `Planned`, from the proposal |
| `Control owner`, `Due date`, `Evidence` | As proposed, editable (X-40; date; textarea) |
| `Effectiveness` | Select: `Not assessed` (default), `Effective`, `Partially effective`, `Ineffective` |
| `Reason for changes` | Appears, required, once any proposed value differs: hint `Shown to the participants with the decision.` Error `Say why you changed the proposal.` Up to 500 |
| Already on the risk | Field error under `Control`: `{control label} is already on {risk number}.`, with `Reject as already recorded` (ghost small), which rejects at once with the reason `Already recorded as {control label}.` |
| Actions | `Add to {risk number}` (primary small; waits for the server, `Adding…`) and `Keep undecided` (ghost small; `Escape`) |

### 9.2 Reject

`Reject` opens 16 §5.3's inline row with the field `Reason` (required, hint `Shown to the participants with the decision.`, error `Give a reason for rejecting this proposal.`, limit 500), actions `Reject proposal` (`Enter`) and `Keep proposal` (`Escape`).

### 9.3 Toasts, Undo and focus

| Action | Success toast (X-14) | After `Undo` | Failure title |
|---|---|---|---|
| `Add to {risk number}` | `{control label} added to {risk number}.` | `Undone. The proposal is awaiting your decision again.` | `Control not added` |
| `Make {name} risk owner` | `{name} is now the risk owner of {risk number}.` | `Undone. {previous} owns {risk number} again.` | `Risk owner not changed` |
| `Reject proposal`, `Reject as already recorded` | `Proposal rejected.` | `Rejection undone. The proposal is awaiting your decision again.` | `Proposal not rejected` |
| `Reject remaining ({k})` | `{k} proposals rejected.` | `Rejections undone.` | `Proposals not rejected` |

`Undo` stays on the decision note while the server allows it (D-39); a refusal shows family U4. Focus follows 16 §5.5 (the next undecided item's first action, else the `Responses` heading). An added control appears in the Risk's mitigation controls with the source note `From {name}’s response, round {n}` (`--text-caption`), and readiness follows the server.

---

## 10. Reassess residual risk (D-46 to D-51)

### 10.1 Controls

| Where | Contract |
|---|---|
| Risk card, beside `Rewrite this risk` | `Reassess residual risk` (outline small, `Sparkles`), named `Reassess residual risk: {risk number}`, `data-print="hidden"` |
| `AI proposals` section, under the start form (16 §2.2) | `Reassess residual risk` (outline, `Sparkles`), named `Reassess residual risk for {e} risks`, with the caption `For every risk with inherent ratings and a mitigation control ({e}).` |
| Not offered | On an ineligible risk, one caption replaces it: `Add inherent ratings and a mitigation control to reassess this risk’s residual risk.` Never shown during a round, after release, on withdrawn risks, to the analyst who raised the request (16 §12.3) or to a named owner (§5.2) |

Either opens 16 §4.1's form frame: title `Reassess residual risk: {risk number}` or `Reassess residual risk for {e} risks`; the X-25 instruction with the hint `Say what to weigh, for example “The file-signing control is planned for March”. The AI reads each risk, its ratings, its mitigation controls and the responses on it. It never changes the inherent rating.`; actions `Reassess` (primary small; `Asking the AI…`) and `Keep as is`.

### 10.2 Proposals

Each target risk shows 16 §4.2's section with h3 `Residual reassessment`, id `risk-{id}-residual`, its job states worded `The AI is reassessing residual risk for {risk number}` (whole run: the section's job line `The AI is reassessing residual risk for {e} risks`), group header h4 `{name} asked the AI to reassess residual risk on {risk number}` (with the instruction when given), and 16 §4.3's comparison with exactly two changes:

| Change | Rows | Under the proposed value |
|---|---|---|
| `Residual rating` | `Residual likelihood`, `Highest residual consequence`, `Residual rating` | — |
| `Residual rating rationale` | `Residual rating rationale` | X-12 `Sources` listing the control labels cited, or the `No control cited` badge (§1). When planned controls count: `Counts these planned controls as in place: {control labels}.` (`--text-caption`) |

`{a} left out` (X-24) adds the line `A residual rating above the inherent rating, which CSRM never proposes.` Decisions, toasts, Undo, `Confirm all ({c})`, `Reject remaining`, staleness and focus are 16 §4.4 and §5 verbatim, with these labels. A newer reassessment or rewrite closes the older change as `Replaced by a newer proposal`. 16 §2.5's list heading becomes `Open AI changes` and lists reassessments as `{risk number} · {k} AI {change|changes} to review` linking to `#risk-{id}-residual` (UI-D18). The overall-rating hint (16 §9.2) applies.

---

## 11. The people picker (D-52 to D-55; X-40)

One picker for every person field in this phase (risk owner, control owner, proposed owner) and for Phase 17.1's. It is X-2 with these rules:

| Case | Contract |
|---|---|
| Fewer than 2 characters | Nothing is sent. Status line `Type at least 2 letters of a name.` |
| Searching | `Searching people…` |
| Results | Display names only, at most 20, the suggested group first when the field has one. A full page: `Showing the first 20 matches. Keep typing to narrow the list.` |
| No match | `No one matches “{term}”. Check the spelling, or try part of their name.` |
| Not eligible (owner fields: the assigned Security Analyst) | Listed with `aria-disabled` and the caption `Assigned Security Analyst - can’t own a risk`; choosing it does nothing |
| Error | `We couldn’t search people.` with `Retry search` |
| Selected line | `Selected {field noun}: {name}` with `Clear {field label}` |

The picker never shows an email, username or role, because the server sends none.

---

## 12. Notifications for this phase (D-57; 19.1 §3)

Rows added to 19.1 §3.2 and §3.3 (the server's wording module):

| Kind | Recipient part | Named | Part-named | Record-level | Icon | Destination |
|---|---|---|---|---|---|---|
| `response-requested` | `requestor` | Never named (19.1 UI-D6) | `A Security Analyst released a risk assessment for your response: {assessment number} · {request title}` | `Response requested: …` | `MessageSquareReply` | The participant page `#your-response` (the analyst page for an analyst-participant) |
| `response-requested` | `risk-owner` | Never named | `A Security Analyst asked for your response as a risk owner: …` | `Response requested: …` | `MessageSquareReply` | as above |
| `response-submitted` | `security-analyst` | `{Responder} submitted a response to round {n}: …` | `A participant submitted a response to round {n}: …` | `Response submitted: …` | `Inbox` | The analyst page `#participants` |

---

## 13. Refusal copy (new family U, added to Phase 10 §10.2 and `refusal-copy.ts`)

Kinds as 10 §10.2: field, blocked (with `Refresh page` where stated) and retryable (with `Try again`).

### U1. Risk owners (sheet, risk form, `Make {name} risk owner`)

| Reason | Copy | Kind |
|---|---|---|
| `OWNER_NOT_ELIGIBLE` | `{name} can’t be named here. Choose someone else.` | field |
| `OWNER_IS_ASSIGNED_ANALYST` | `{name} is the Security Analyst assigned to this request, so they can’t own its risks. Choose someone else.` | field |
| `RESPONSE_ROUND_OPEN` | `Round {n} is open for responses, so risk owners can’t change until it’s closed.` | blocked |
| `ACTOR_IS_RISK_OWNER` | `You’re a risk owner on this assessment, so another Security Analyst makes this change.` | blocked |
| `ASSESSMENT_NOT_MUTABLE` | `This assessment can no longer be changed, so its risk owners stay as they are.` | blocked |
| `RISK_WITHDRAWN` | R1's copy | blocked |
| 403 | `You can’t set risk owners on this assessment.` | blocked |
| 404 | `These risks are no longer on this assessment. Refresh the page.` | blocked |
| 409, none or unknown | `Risk owners can’t change in this assessment’s current state.` | blocked |
| Network, timeout or 5xx | `We couldn’t set the risk owner. Try again.` | retryable |

### U2. Release for response and close round

| Reason | Copy | Kind |
|---|---|---|
| `RELEASE_FOR_RESPONSE_NOT_READY` | `This assessment isn’t ready to release for response: {outstanding labels}. The checklist shows what’s outstanding.` (the card refreshes) | blocked |
| `RESPONSE_ROUND_OPEN` (release) | `Round {n} is already open. Refresh the page to see it.` | blocked |
| `RESPONSE_ROUND_NOT_OPEN` (close) | `Round {n} is already closed. Refresh the page to see where it stands.` | blocked |
| `NOT_ASSIGNED_ANALYST` (403) | `Only {name}, the Security Analyst assigned to this request, can {release it for response|close the round}.` | blocked |
| `REQUEST_UNASSIGNED` | `This request isn’t picked up. Pick it up, then release it for response.` | blocked |
| `RESPONSE_ROUND_LIMIT` | `This assessment has had as many response rounds as it can hold. Contact your administrator.` | blocked |
| `ACTOR_IS_RISK_OWNER`, `ASSESSMENT_NOT_MUTABLE` | U1's copy, with “this change” | blocked |
| 400, message | `Keep the message to 2,000 characters or fewer.` | field |
| 403 | `You can’t release this assessment for response.` | blocked |
| 404 | Phase 10's locked assessment refusal | blocked |
| 409, none or unknown | `This can’t be done in the assessment’s current state.` | blocked |
| Network, timeout or 5xx | `We couldn’t {release it for response|close the round}. Try again.` | retryable |

### U3. Your response (save, submit)

| Reason | Copy | Kind |
|---|---|---|
| `RESPONSE_ROUND_NOT_OPEN` | `Round {n} has closed, so your response can’t be {saved|submitted}. Your draft is kept and comes back if another round opens.` | blocked |
| `RESPONSE_ALREADY_SUBMITTED` | `You’ve already submitted your response to round {n}. Refresh the page to see it.` | blocked |
| `RESPONSE_CHANGED` | `Your response changed in another tab, so this change wasn’t saved. Refresh the page to continue from the latest version.` | blocked |
| `RESPONSE_INCOMPLETE` | §6.4's error summary | field |
| `RESPONSE_NOT_PERMITTED` (403) | `You can respond only on the risks you own. Refresh the page to see them.` | blocked |
| `OWNER_NOT_ELIGIBLE` | U1's copy | field |
| `NOT_A_PARTICIPANT` (403) | `Only the Requestor and the risk owners respond to this assessment.` | blocked |
| 400 | §7.2's field errors | field |
| 404 | `This risk assessment is no longer available to you.` with `Go to My risk assessments` | blocked |
| Network, timeout or 5xx | `We couldn’t save your response. Your changes are kept here. Try again.` (X-1 failed state; submit: `We couldn’t submit your response. Try again.`) | retryable |

### U4. Decisions on responses

| Reason | Copy | Kind |
|---|---|---|
| `RESPONSE_ROUND_OPEN` | `Round {n} is still open. Close it to decide the responses.` | blocked |
| `CONTROL_ALREADY_ON_RISK` | §9.1's field error with `Reject as already recorded` | field |
| `RESPONSE_ITEM_DECIDED` | `This proposal has already been decided. Refresh the page to see the decision.` | blocked |
| `RESPONSE_DECISION_UNDO_UNAVAILABLE` | Control: `{control label} has changed since it was added, so this can’t be undone here. Change it on the risk instead.` Owner: `{risk number}’s risk owner has changed since, so this can’t be undone here.` Otherwise: `This decision can no longer be undone, because the assessment has moved on.` | blocked |
| `RISK_WITHDRAWN` | `{risk number} has been withdrawn, so its proposals closed without a decision.` | blocked |
| `OWNER_NOT_ELIGIBLE`, `OWNER_IS_ASSIGNED_ANALYST`, `ACTOR_IS_RISK_OWNER` | U1's copy | field / blocked |
| `ASSESSMENT_NOT_MUTABLE` | Family J's copy | blocked |
| 400, reason | §9.1 and §9.2's field errors | field |
| 403 | `You can’t decide responses on this assessment.` | blocked |
| 404 | `These proposals couldn’t be found. Refresh the page.` | blocked |
| 409, none or unknown | `Your decision can’t be recorded in this assessment’s current state.` | blocked |
| Network, timeout or 5xx | `We couldn’t record your decision. Try again.` | retryable |

### U5. Reassess residual risk (additions to R2 and R4)

| Reason | Copy | Kind |
|---|---|---|
| `RESPONSE_ROUND_OPEN` | `Round {n} is open for responses, so the AI can’t be asked until it’s closed.` | blocked |
| Not eligible (400) | `{risk number} needs inherent ratings and a mitigation control before its residual risk can be reassessed.` | blocked |
| `ACTOR_IS_RISK_OWNER` | U1's copy | blocked |
| Job failure, round opened before it ran | `A response round opened before the AI started, so nothing was sent.` | — |

### U6. Assignment additions (family K)

| Reason | Copy | Kind |
|---|---|---|
| `ASSIGNMENT_REQUIRED` (after the first release for response) | `Participants are reading this assessment, so the request keeps an assigned Security Analyst. Reassign it instead.` | blocked |
| `ASSIGNEE_NOT_ELIGIBLE` (a named owner) | `{name} owns a risk on this assessment, so they can’t be assigned this request. Choose another Security Analyst.` | blocked |
| `ACTOR_IS_RISK_OWNER` (assign, note AI mark) | U1's copy | blocked |

13 §6's "no one eligible" line becomes `Only active Security Analysts who didn’t raise this request and own none of its risks can be assigned.`

### U7. Print and export before release

`ASSESSMENT_NOT_RELEASED` (409): in the export dialog `This risk assessment isn’t released yet, so it can’t be exported. You can once it’s released.` (blocked); on the report route §6.6's state.

---

## 14. Lists, Home, lifecycle and queues

### 14.1 My risk assessments (`/app/assessments`; D-28)

| Part | Contract |
|---|---|
| Heading, route title | `My risk assessments` (was `My Risk Assessments` in code; 11 §2.1) |
| Description | `Risk assessments you take part in, as the Requestor or a risk owner. Open one to read it, and respond while it’s released for response.` |
| Columns | `Assessment` (number, `RecordLink`), `Request title` (long-text), `Stage` (stage badge; under it, while the viewer's response is awaited, `Respond to round {n}` as a `RecordLink` to `#your-response`, `--text-table` at 500), `Your part` (`Requestor`, `Risk owner · {k} {risk|risks}`, or both), `Overall rating` (`RiskRatingBadge` once released, else `Not released`), `Released` (11 §7.2 form, else `Not released`) |
| Filters | Selects `Part` (`All parts`, `Requestor`, `Risk owner`), `Stage` (`All stages`, `Released for response`, `With the Security Analyst`, `Released`), `Response` (`All`, `Awaiting your response`); chips `Part: Risk owner`, `Stage: Released for response`, `Awaiting your response`. The existing overall-rating filter stays |
| Mobile card | The number with the stage badge; the request title; `Your part: {part}`; the `Respond to round {n}` link when awaited; `Released {date}` and the rating badge when released |
| Empty, first use | `No risk assessments yet` · `Risk assessments appear here when a Security Analyst releases one for your response, or releases one you requested.` (no action) |
| Filtered empty | The shared `No risk assessments match these filters` · `Clear filters` |

### 14.2 Sidebar count and Home (D-28)

- **Sidebar:** `My risk assessments` carries the count of awaited responses (11 §1.3), accessible name `My risk assessments, {n} {needs|need} your response`, opening `/app/assessments?awaiting=me` (X-10: equal totals). Absent at zero.
- **Requestor Home `Needs your action`** (11 §5.2): description `Requests, questionnaires and risk assessments waiting for you.` Awaited responses list first, each: line 1 `{assessment number} · {request title}` (`RecordLink` to `#your-response`); line 2 (caption) `Round {n} · Released for response {date}` plus ` · Draft saved` when a draft exists; line 3 `Respond to round {n}.` Footer adds `View all {a} in My risk assessments` → `/app/assessments?awaiting=me`. Cleared: `No work waiting for you` · `When a request, questionnaire or risk assessment needs you, it appears here.` A person with no request but a participation never sees `No requests yet` (UI-D13).
- **`With the Security Analyst` becomes `With others`** (`Hourglass`): description `Requests a Security Analyst or another participant is working on.` It lists holder `participants` first, then `analyst`, up to five; line 3 is the server sentence (§14.4). Footer links, each shown when its count is above zero: `View {a} with the Security Analyst` → `/app/requests?holder=analyst` and `View {p} with other participants` → `/app/requests?holder=participants`. Cleared: `No requests with others` · `Requests appear here while a Security Analyst or another participant works on them.` The partial fixture keeps its selector.
- **Analyst `Your own requests`** (11 §5.3) gains the row `With other participants` {n} → `/app/requests?holder=participants`.
- **Released assessments** (11 §5.2) reads the participant predicate; its copy is unchanged.

### 14.3 Analyst assessment lists

On `/app/review/assessments` and its mobile cards, the `Status` cell adds the stage badge on a second line when the stage is `released-for-response` or `with-security-analyst`. No new column or filter.

### 14.4 Holder vocabulary and sentences (D-08; 11 §6.1, 13 §12.1)

My requests' holder line and `Show` select gain `With other participants` (`holder=participants`), between `Needs your action` and `With the Security Analyst`. Sentences in `request-lifecycle.ts` (Phase 13's naming rule for the analyst):

| Facts | `holder` | The Requestor reads | The Security Analyst reads |
|---|---|---|---|
| Round open, Requestor's response not submitted | `requestor` | `Respond to round {n}.` (link `#your-response`) | `Waiting for {names} to respond to round {n}.` |
| Round open, Requestor submitted, others not | `participants` | `Waiting for {names} to respond to round {n}.` | as above |
| Round open, all submitted | `analyst` | `{name} is reviewing the responses to round {n}.` | `Close round {n} and decide the responses.` (link `#response-round`) |
| Round closed, items undecided | `analyst` | `{name} is deciding the responses and updating your risk assessment.` | `Decide {u} {proposal|proposals} from round {n}.` (link to the first `#risk-{id}-responses`) |

`{names}` lists up to two names (`Ana Li and Sam Roe`), then `{k} participants`. Unpicked requests use `A Security Analyst` as 13 §12.1.

### 14.5 Lifecycle step (D-07; X-41)

The stepper gains `Released for response` after `Assessment drafted`, so `m` is 9 (11 §6.3). Its states: current while a round is open; completed once one closed; `Not used` (X-41) when no round ran and the request moved past it; future otherwise. The heading reads `Current lifecycle state: Released for response` while current.

### 14.6 Review queue (D-08)

The `Awaiting Requestor` queue becomes `Awaiting the business` (option, `Queue:` line, and Phase 13's queue controls), because it now holds requests waiting on risk owners too.

---

## 15. Five-state contract

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| Participant page | Route skeleton: header, notice line, panel card, a definition-list card, two risk cards | Legacy and `beingPrepared` cards (§6.1) | `We couldn’t load this risk assessment` · `Try again` | In-shell not-found (§6.5) | Four stages, parts, `Show`, rounds |
| Round panel | With the page | Absent before any round | Family U2, U3 | Assignee-only actions; others read who acts | §4.1 and §6.3 states |
| Response area and sheet | Form code on demand; skeleton fields after 300ms | §7.1 empty | X-1 failed save; U3 | No area where not allowed | Items, owner proposal, comment, read-only after close |
| Responses and decisions | With the page | Not rendered until one is submitted | Rollback and U4 | No decision controls for participants, owners or during a round | Awaiting, added, owner changed, rejected, lapsed, compact |
| Participants and nomination | Sheet list skeleton after 300ms | Requestor only; `Not shared yet` | U1; picker error | §2.1 lines | Coverage, statuses, cards |
| Readiness card | With the page | — | Server-authoritative | Assignee line | Outstanding, met, ready |
| Reassessment | 16 §4.2 job states | 16's no-change line | 16 R4 and U5 | Not offered (§10.1) | Two changes, citations, planned line |
| My risk assessments | Six-column skeleton | §14.1 first use and filtered | `We couldn’t load risk assessments` · `Try again` | Shared permission state | Stage, part, awaited link, filters |
| Home and sidebar | 11 §5.4 | §14.2 cleared copy | 11 §5.4 | 11 §5.4 | Awaited responses, `With others`, the count |

---

## 16. The premium experience bar (G-4), item by item

| G-4 item | Phase 17 contract |
|---|---|
| A keyboard path for every primary action | Every action is a button or link in DOM order; `Ctrl`/`⌘` `Enter` submits a response from its fields; `Enter` in a reason field rejects; `Escape` closes sheets, wells and dialogs; `Alt+T` reaches Undo (X-14) |
| Optimistic feedback with rollback | Nomination, `Make {name} risk owner`, `Reject`, removing a draft control, and unit confirmations apply at once and roll back with family U toasts. `Add to {risk number}` waits, because it creates a record |
| Skeletons while loading | Page, sheet, picker, response form and reassessment, after 300ms |
| Undo and confirmations | Undo: nominations, decisions, draft control removal, unit confirmations. Confirmations: release for response, submit response, close round with someone outstanding, and nothing else (D-70) |
| Empty states that say what to do next | §7.1, §14.1, §14.2, the `Participants` lines |
| No lost input | Autosaved drafts with carry-forward (§7.4, D-34), the navigation guard, kept message and nomination choice, values kept on every refusal |
| Comfortable and compact density | `Participants` (DataTable) and `Responses` (§8.3) |
| Motion | The Motion section; reduced motion honoured |
| Purpose-built phone layouts | Response sheet, decision sheets, nomination sheet, participant cards, stacked full-width actions |
| Every figure opens its records | `{s} of {p} responses submitted`, `{u} awaiting decision`, `{u} without an owner`, the sidebar count and Home's footers each open lists or anchors whose totals equal them |

---

## 17. Test assertions this contract changes

- **E2E, `risk-owner-journey.spec.ts` first slice** (1440 and 375): the strings `Set one owner for every risk`, `Set risk owner`, `Release for response`, `Release {assessment number} for response?`, `Released for response`, `Your part: Risk owner`, `Your risk`, `Respond to round 1`, `Add a mitigation control`, `Submit response`, `Round 1 closed`, `Add to {risk number}`, `Reject proposal`, `Reassess residual risk`, `Confirm`; Maya's in-shell not-found; no `Your response` area on another owner's risk; no `Your response` panel for Bob; axe on the participant page in each stage, the response sheet at 375 and the nomination sheet.
- **The second phase spec:** §3.1's outstanding `Eligible risk owner`, the picker's not-eligible option, `Type at least 2 letters of a name.`, carry-forward caption, the editing pause line, `Print report` and `Export` for the persona after release, the two notification sentences.
- **Existing specs changed deliberately:** `assessment-release-workflow.spec.ts` and `released-assessment.test.tsx` (10 §15.3's "no form or button" holds only once released; the title is `Risk assessment`); the My risk assessments heading and description; the lifecycle stepper (`m` is 9, `Not used`); release readiness's two new items; the Requestor Home's `With others`; the review queue's `Awaiting the business`; Phase 13's assign picker empty line.
- **Unit (Vitest):** the three mapping families; every §6.3 state; completeness and the error summary; carry-forward; the picker's two-character rule and not-eligible option; decision forms with the reason rule; Undo and rollback; family U; the holder sentences' name list.

---

## Copywriting contract

| Element | Copy |
|---|---|
| Primary CTAs | `Release for response`, `Submit response`, `Set risk owner`, `Add to {risk number}` (in its form), `Reassess` |
| Other calls to action | `Set one owner for every risk`, `Set owners by risk`, `Close round {n}`, `Keep round open`, `Keep editing`, `Add a mitigation control`, `Remove control`, `Propose a different risk owner`, `Remove proposal`, `Respond on {risk number}`, `Done`, `Make {name} risk owner`, `Reject`, `Reject proposal`, `Keep proposal`, `Reject as already recorded`, `Keep undecided`, `Reject remaining ({k})`, `Reassess residual risk`, `Confirm`, `Confirm all ({c})`, `Undo`, `Retry search`, `Back to the risk assessment` |
| Headings and labels | §1 labels; `Participants`, `Set risk owners`, `Apply to`, `Release for response`, `Round {n} is open for responses`, `Round {n}: your response`, `Your response`, `Responses`, `Request summary`, `Residual reassessment`, `Your part`, `Your risk`, `Nothing to add` |
| Empty states | `No response on {risk number} yet`; `No risk assessments yet`; `No work waiting for you`; `No requests with others`; `This report isn’t available yet` |
| Error states | Family U (§13), each saying what happened and what to do; X-1's failed save |
| Destructive confirmation | None. Release for response, submit response and close round are governance confirmations with primary pills; nothing deletes |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 Info and relationships | Each control proposal is a fieldset with a legend; `Status` and `Apply to` are named radio groups; responses are lists of articles; the participants table has row headers on names |
| 1.4.1 Use of colour | Stages, responses and decisions carry icon and words; `Your risk` is a word |
| 2.1.1 Keyboard; 2.1.2 No trap | §16; sheets trap focus only below 768px or as modal side sheets, and `Escape` and `Close` leave them |
| 2.4.3 Focus order | Focus moves as §2.2, §3.2, §4.2, §6.4, §7.1 and §9.3 state; the error summary takes focus and links to fields |
| 2.4.6 Labels | Repeated controls carry the risk number in their names (`Remove proposed mitigation control 2 on RSK-…`) |
| 2.5.8 Target size | In-row targets at least 24px from 768px; the touch-target height below |
| 3.3.1 and 3.3.3 Errors | Every field error names what is wrong and how to fix it; the summary repeats them as links |
| 4.1.3 Status messages | X-1 save status polite; toasts polite; the count line polite (10 §14) |
| 1.4.10 Reflow | No horizontal scroll from 320 to 1440 |
| Automated | Zero serious or critical axe violations in §17's scope |

---

## Spacing

The §3.9 scale, unchanged.

| §3.9 step | Use |
|---|---|
| 4px | Badge to its caption line; attribution under a subject |
| 8px | Between stacked phone actions; between an item's lines; between a meta row's badge and part line |
| 12px | Between response item cards; compact card padding |
| 16px | Card and well padding; between control fieldsets; panel internal rows |
| 24px | Between a risk card's read-only content and its `Your response` and `Responses` sections; sheet groups (X-13) |
| 32px | Between page sections (§3.9 section rhythm) and form sections (§4 Forms) |

Exceptions: none. Dialog widths are §4 Dialogs' 480px and 640px.

---

## Typography

The §3.10 scale, unchanged.

| Level | Token | Weight | Use |
|---|---|---|---|
| Page title | `--text-heading-lg` | 400 | `Risk assessment`, `My risk assessments` |
| Section | `--text-heading-md` | 600 | Page section h2s: `Request summary`, `Identified risks`, `Participants` |
| Panel, card and empty heading | `--text-heading-sm` | 600 | Round panel h2, sheet titles, empty headlines |
| Body and labels | `--text-body` | 400; 500 for labels, subjects, status lines, coverage and `Respond to round {n}` | Notices, fields, sentences |
| Table | `--text-table` | 400 | Participants and My risk assessments rows |
| Caption | `--text-caption` | 400; 500 for badges and figure links | Facts, attribution, hints, notes |
| Micro-label | `--text-micro` | 400 | Eyebrows, definition labels, `Your risk` tag |

Weights 400, 500 and 600 only. `tabular-nums` on every count, progress and round number in a figure.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas; cards, sheets, dialogs, item cards |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-border-strong`, `--color-text-secondary`, `--color-bg-hover` | Response and decision wells (X-5), hairlines, field boundaries, notices, facts and attribution |
| Accent (10%): ink | `--color-primary`, `--color-on-primary`, `--color-text-link`, `--focus-ring` | Reserved for the uses listed below |
| Status (§3.5) | info (`Released for response`, `Draft`), warning (`With the Security Analyst`, `Awaiting decision`, `No control cited`), success (`Released`, `Submitted`, success toasts), danger (failure toasts, field errors), neutral (`Not shared`, `Not started`, `Not submitted`) | Always with an icon and words |
| Destructive | `--color-danger-solid` | None used |

Ink is reserved for: the primary pills `Release for response`, `Submit response`, `Set risk owner`, `Add to {risk number}`, `Reassess` and the confirm dialogs' primary actions; checked segments and checkboxes; record and figure links; focus rings. Every other control is outline or ghost. No new hue.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Side and phone sheets | §5 "Drawer / side panel"; fade only under reduced motion |
| Dialogs, toasts | §5 "Dialog / toast" |
| Picker listbox, reassessment popover | §5 "Dropdown / popover / menu" |
| Optimistic apply and rollback | §5 Optimistic UI (pending opacity; rollback at `--duration-base`, opacity only) |
| Wells opening, items added or removed, stage changes | None: instant |
| Skeleton shimmer | Static under reduced motion |

---

## Proposed CSRM extensions

For the orchestrator to accept. A Phase 17 plan task records them in `docs/design/csrm-design-direction.md` before the implementing tasks run. Numbering continues after Phase 19.1's X-35. None introduces a new value.

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-36 | §4, new "Round panel" entry, after "Notification panel" | The panel for a numbered round of input on a record | "**Round panel (CSRM extension, 2026-10-01).** When a record is opened to other people for a numbered round of input, such as a risk assessment released for response, its page carries a round panel: a section near the top, after the page header and any provenance header, with an h2 in `--text-heading-sm` naming the round and its state, a `--text-caption` facts line (when it opened or closed, and by whom, in Dates and times), and the opener's optional message under a micro-label in typographic quotes. For the person who runs the round, it adds what the round pauses, as one `--text-body` line at 500 with a 16px `CirclePause`; a figure link to the people asked, `{s} of {p} responses submitted`; and the closing action as an outline pill, shown only to the person who may act, every other viewer reading who may in words. For a person asked to take part, it adds their own state as a status badge, their progress with `tabular-nums`, the Save status for an autosaved draft, and the submit action as the page's primary pill; once submitted or closed, one line says what happens next. Earlier rounds collapse behind an outline small `Earlier rounds ({k})` toggle, one line each. Opening a round and submitting in it are governance steps and ask for confirmation in a dialog that names who will see the result; closing asks only when someone has not yet taken their turn, naming them. Below 768px the panel spans the width and its actions stack at full width and the touch-target height." | D-09, D-12, D-31 and D-69 need one panel for both actors; Phase 17.1's acceptance rounds reuse it (17.1-CONTEXT D-64) |
| X-37 | §4 Forms, new "Response form" entry | A participant's per-item response with proposals, autosaved | "**Response form (CSRM extension, 2026-10-01).** A person who responds item by item, such as on each Risk, answers inside that item: from 768px an h4 `Your response` section after the item's read-only content, as an In-place edit form well that stays open while responses are open; below 768px a summary line and an outline full-width `Respond on {identifier}` that opens a full-screen sheet with a visible title row, `Close`, and a pinned footer holding the Save status and `Done`. Each proposal is a fieldset with a numbered legend and a ghost small remove control whose name carries the item's identifier; adding moves focus to its first field, and removing applies at once with an Undo toast. Fields that depend on a choice, such as a due date for a planned control or evidence for an existing one, follow a segmented control and show only when they apply. A response autosaves after typing pauses, never fails a save for being incomplete, and checks completeness only when submitted: an incomplete submit opens no dialog and shows a focused error summary with one link per problem. An empty response is never submitted by accident: it needs an explicit `Nothing to add` choice. An item with nothing yet uses the first-use empty state with an outline small action, so a long page does not show a wall of primary pills. After submission or closing, the fields render as read-only text with one line saying why." | D-31 to D-35 and D-70's phone sheet; the direction has single-column forms and autosave status but no per-item response pattern |
| X-38 | §4, after "Field decisions and similar records" | Proposals people make, and the decisions on them | "**Response items (CSRM extension, 2026-10-01; extends AI proposal items).** Proposals that people, not the AI, make about a record are listed under their item, newest round first, as AI proposal item cards whose eyebrow names the kind and whose attribution line reads `{name} · {part} · Round {n} · {instant}` in `--text-caption` / `--color-text-secondary`; a former participant's part is prefixed `Former`. An undecided item carries the status badge `Awaiting decision` (warning, `Scale`); a decided one gives way to a provenance note naming the decision, who and when, with any changed fields and the quoted reason on a second line. A comment takes no decision. A decision that creates a record, such as `Add to {identifier}`, opens an In-place edit form prefilled with the proposal and waits for the server; a decision that changes one value, such as `Make {name} risk owner`, applies at once. Rejecting needs a reason, because the people who proposed it read it, in an inline row where `Enter` submits and `Escape` keeps the proposal; changing a proposal before adding it needs a reason for the same cause. Every decision confirms with an Undo toast while the server can reverse it. A group may offer `Reject remaining ({k})` with one reason, and never an add-all control. Decisions are offered only once the round is closed and only to the people who may decide; everyone else reads the items and their decisions." | D-36 and D-38 to D-41; X-24 has optional reject reasons and no human authorship |
| X-39 | §4 Status & risk badges, after "Response items" | Participation marks and the stage values | "**Participation (CSRM extension, 2026-10-01).** A record that several people take part in names, in its page header's meta row, its stage as a status badge and the viewer's part as `Your part: {part}` in `--text-body` / `--color-text-secondary`; an item the viewer owns carries the neutral tag `Your risk` beside its identifier, and a `Show` segmented control offers `All` and `Your` items when the viewer owns some but not all. Stage values follow the tone vocabulary: `Not shared` (neutral, `EyeOff`, analysts only), `Released for response` (info, `MessageSquareReply`), `With the Security Analyst` (warning, `Hourglass`) and `Released` (success, `CircleCheck`). Response states are `Not started` (neutral, `CircleDashed`), `Draft` (info, `FilePenLine`), `Submitted` (success, `CircleCheck`) and `Not submitted` (neutral, `CircleSlash`). An item that is not ready for participants shows only its identifier and one line with a 16px `Hourglass` saying who is preparing it. An AI rationale that cites none of the controls it relies on carries `No control cited` (warning, `Unlink`). All are values in the one shared mapping." | D-06, D-25, D-26 and D-49 need recorded values and marks; the tone vocabulary covers them without a new hue |
| X-40 | §4 Forms, after "Record picker" | The person picker | "**Person picker (CSRM extension, 2026-10-01; extends Record picker).** A field that names a person is a Record picker over people. It sends nothing until two letters are typed and says `Type at least 2 letters of a name.`; it shows display names only, never an email, username or role, at most twenty, with a line asking for more letters when the page is full; and it lists people the context suggests first, such as those on the request. A person the server returns who may not fill this field here is listed with `aria-disabled` and a `--text-caption` reason after the name, and choosing them does nothing." | D-52, D-55 and the authorisation table's picker row; X-2 has no minimum or not-eligible state |
| X-41 | §4 "Lifecycle stepper", after the compact stepper | A step a record did not use | "**Not used step (CSRM extension, 2026-10-01).** A lifecycle step a record passed without using, such as a response round that never ran, stays in the stepper in its place, drawn as a future step with its label and the caption `Not used` in `--text-caption` / `--color-text-secondary` and a 12px `SkipForward`, so `Step {n} of {m}` keeps one count for every record and a step is never shown as done when it did not happen." | D-07 and research §C's `skipped` state |

---

## Decisions recorded

Made without asking (auto mode), from the locked context, `AGENTS.md`, the glossary and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | The analyst's decisions read `Add to {risk number}` and `Make {name} risk owner`, never `Accept`. | D-73 and 12 UI-D1; X-28's creating decision already says `Add to assessment`. |
| UI-D2 | Rejecting a participant's proposal, and changing one before adding it, need a reason. | D-38; participants read the decision (D-36). |
| UI-D3 | No add-all for proposed controls; `Reject remaining` stays. | Each needs its own library control; X-28 has no add-all for creating decisions. |
| UI-D4 | Nomination for many risks is one side sheet with `Every risk` and `Selected risks`; one risk keeps its form field. | D-17's two paths; one picker, one validation. |
| UI-D5 | The assigned analyst shows in owner pickers as not eligible rather than hidden. | The authorisation table; a hidden person confuses whoever searches for them. |
| UI-D6 | The participant page title is `Risk assessment` with the stage badge; it is no longer `Released risk assessment`. | Participants read before release (D-27). |
| UI-D7 | The response edits in place from 768px and in a full-screen sheet below. | D-70; one risk's response is long-form input. |
| UI-D8 | Completeness is checked at submit with a focused error summary, never at save. | D-31 no lost input; research Pitfall 7. |
| UI-D9 | `Nothing to add` is a checkbox in the round panel shown only while the draft is empty. | D-35: explicit and never accidental. |
| UI-D10 | Close round confirms only with someone outstanding, naming them, and its primary is not destructive. | D-12; it ends a turn but deletes nothing. |
| UI-D11 | Per-risk empty states use an outline small action. | §4 Empty states: no wall of competing primary pills on one page. |
| UI-D12 | The round panel is the X-1 "progress card" for autosave. | One visible save status per response (X-1). |
| UI-D13 | A participant with no request never sees `No requests yet`; the cleared copy is `No work waiting for you`. | The locked "No {noun}" pattern; D-70's "Nothing waits for you" in that form. |
| UI-D14 | Phase 11's `With the Security Analyst` Home section becomes `With others`, and the holder line gains `With other participants`. | Orchestrator Confirmation; UAT-003's lesson; 17.1's approvers reuse "participants". |
| UI-D15 | The `Awaiting Requestor` queue becomes `Awaiting the business`. | D-08 asks for wording that covers risk owners. |
| UI-D16 | The lifecycle keeps the step as `Not used` and `m` is 9. | Research §C; one count for every request (X-41). |
| UI-D17 | The analyst lists show the stage as a second badge line in `Status`, not a new column. | D-06 publishes it there; no column chooser before Phase 18. |
| UI-D18 | 16 §2.5's list becomes `Open AI changes` and indexes reassessments too. | The section must index every open proposal (X-10). |
| UI-D19 | An ineligible risk shows a reason line in place of `Reassess residual risk`, not a disabled button. | X-15 and 16 §12.3: words, never a disabled control; D-46's reason is kept. |
| UI-D20 | Before release a participant's report route shows "isn't available yet", not the not-found page. | D-29: a 404 would be untrue for someone who can read the assessment (19 D-15). |
| UI-D21 | Notification sentences for `response-requested` name the part, never the releaser. | 19.1 UI-D6's rule for release kinds. |
| UI-D22 | `{names}` in holder sentences lists two names, then a count. | Sentences stay short at 375px; the panel lists everyone. |
| UI-D23 | Lapsed items show only to analysts. | Participants never read withdrawn risks (D-26). |
| UI-D24 | An added control carries the source note `From {name}’s response, round {n}`. | The record says where it came from (D-38). |
| UI-D25 | Refusal copy is family U. | The next letter after Phase 19.1's T. |
| UI-D26 | No new shortcut; `Ctrl`/`⌘` `Enter` submits from response fields, as X-7 hints elsewhere. | One keyboard path to the primary action without a global key. |

---

## Notes carried

- **For the orchestrator to settle:**
  - **UI-D14, UI-D15:** these change Phase 11 §5.2, §5.3, §7.1 and §7.3, and Phase 13 §2.2 and §6 (the assign picker's line), whose plans have not executed. The Orchestrator Confirmation lets the Phase 17 holder plan change Home; confirm that the same plan may change the queue label and Phase 13's line, or amend those contracts.
  - **UI-D20** narrows 19 §4.4's "Not found or unreleased" for participants before release.
  - **UI-D18** renames 16 §2.5's heading.
  - **UI-D25:** confirm letter U does not collide with Phase 17.1's or 17.2's families (17.1 should take V).
- **For the planner:** the response form, nomination sheet, decision forms and reassessment form load with `next/dynamic` (D-72); `performance.spec.ts` stays green. The control item keys are client-chosen (research §F).
- **Shared-file changes needed:**
  - **The direction:** records X-36 to X-41, through a Phase 17 plan task.
  - **The root `CONTEXT.md` glossary (D-73), proposed:** "**Response round**: A numbered period, opened and closed by the assigned Security Analyst, in which the Requestor and the risk owners read the whole assessment and each submit one response per round with the controls they have or plan; nothing is final in it, and the analyst decides each proposal after it closes. _Avoid_: Review, Consultation." and "**Participant**: A person who takes part in an assessment and so may read it: its request's Requestor and the current owners of its active risks, and from Phase 17.1 its named executive approvers. _Avoid_: Stakeholder, Member."

---

## UI Considerations

Written inline from the contract. The ui-phase probe replaces them when it runs.

State considerations: 18 covered, 3 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| empty | Risk with no response | covered | §7.1 |
| empty | My risk assessments, Home | covered | §14.1, §14.2 |
| empty | Participants before any owner | covered | Requestor row and `Not shared yet` |
| loading | Page, sheets, forms, picker | covered | §15 skeletons after 300ms |
| error | Autosave | covered | X-1 failed state, values kept, U3 |
| error | Decisions, nomination | covered | Rollback with U1, U4 |
| permission | Unrelated reader, former owner, owner before the gate | covered | In-shell not-found (§6.5) |
| permission | Owner on another owner's risk; non-participant analyst | covered | No response area or panel (§5.3, §6.1) |
| permission | Named owner who is an analyst | covered | §5.2 line |
| partial | Risk being prepared | covered | §6.1 placeholder |
| partial | Round closed before submit | covered | §6.3, carry-forward |
| partial | Legacy released assessment | covered | §6.1 |
| zero-one-many | Counts, names, plurals | covered | Written-out forms; UI-D22 |
| overflow | 10 controls on a risk | covered | §7.1 limit line |
| overflow | 20 people matches | covered | X-40 line |
| interaction | Two tabs on one response | covered | U3 `RESPONSE_CHANGED` |
| interaction | Leaving with unsaved changes | covered | §7.4 guard |
| interaction | Control already on the risk | covered | §9.1 |
| long-text | 2,000-character evidence in a compact response card at 375px | backstop | `{ statement: "At 375px a response item with 2,000 characters of evidence wraps with no horizontal scroll, and compact density collapses it behind Show details", verification: backstop }` |
| long-text | Six participants in the release confirmation at 375px | backstop | `{ statement: "At 375px the release-for-response sheet lists six named participants and the message field, and the actions stay reachable by keyboard", verification: backstop }` |
| overflow | Twenty risks in the nomination sheet at 768px | backstop | `{ statement: "At 768 by 600px the Selected risks fieldset scrolls inside the sheet and Set risk owner stays reachable", verification: backstop }` |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | None new: `Sheet`, `Popover`, `Command`, `Dialog`, `Checkbox`, `Input`, `Textarea`, `Select`, `Alert`, `Button`, `Card`, `Badge`, `Skeleton`, `sonner` | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

No new web dependency.

---

## Verification contract

- **Unit and component (Vitest):** §17's unit list, the parity and chain guards, and the closed parsers for the new reads.
- **E2E** (dev servers stopped; 1440 and 375): D-76's two specs with §17's strings and axe scope; each run leaves the tree clean.
- **Browser backstops** (orchestrator): the three UI Considerations rows; NVDA reading the round panel's state, the save status and an Undo toast; a keyboard-only nomination, response and decision at both widths.

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

---

## Orchestrator amendments (2026-10-01, after the UI check)

The UI checker approved this contract with four flags. These amendments bind the plans:

1. **No lost input on Escape:** pressing Escape in the analyst's add form or reject row never discards typed text. The text is kept as a session-held draft (Phase 13 UI-D17 and UI-D31), the row closes, and reopening restores it. Discarding is an explicit `Discard text` with an Undo toast (Phase 13 §9.4).
2. **Phone layouts:** below 768px, the close-round and submit dialogs (480px from 768px) and the reassessment form open as full-screen sheets with a visible title row and Close control (Phase 11 X-8's sheet pattern). Their primary action stays at the foot of the sheet, at the touch-target height.
3. **Settled items:** every item in "Notes carried" that the orchestrator resolved before the check is settled: the holder wording ("With others", "Awaiting the business") and Phase 13's picker line; "isn't available yet" for a participant's report before release; Phase 16's "Open AI changes"; and refusal family V for Phase 17.1. The Phase 17 plans make those changes in the earlier phases' surfaces, with their tests.
4. **One-word buttons** (`Reassess`, `Done`) stay. Their accessible names carry the record they act on.
