---
phase: "20"
slug: "oversight-registers-and-post-release-tracking"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 20 — UI Design Contract

> Visual and interaction contract for oversight registers and post-release tracking (RISK-03 to RISK-06, ADMIN-06, NOTIFY-02). It covers:
> - "My risks and treatments" and the owner risk page: tracking, progress, completion on evidence, notes, evidence files, date, plan and owner changes, and the decision review (D-08 to D-13, D-17, D-18, D-20, D-21);
> - the analyst's post-release panel on the register risk detail: residual review, close and reopen, control delivery (D-14 to D-16);
> - the register's type, division and business-unit columns and filters, its saved views, and exposure and throughput by type (D-22, D-23);
> - "Used in" panels and usage counts (D-24); request-form suggestions (D-22);
> - Homes, the sidebar, the released view's link, the history kinds, reminders in the app and by email (D-19, D-20, D-25 to D-28).
>
> It adds no colour, type size, weight, family, radius, shadow, duration or width. Six patterns are proposed as CSRM extensions X-62 to X-67. Refusal copy is family Y.

---

## Binding inputs and value authority

- **Locked decisions:** D-01 to D-30 in `20-CONTEXT.md`. No RESEARCH exists yet. Routes, query keys, reason codes and bounds are named as CONTEXT D-03 proposes; research and the planner fix them (Planner's Discretion).
- **Value authority:** `docs/design/csrm-design-direction.md` (ADR 0001) only, cited by section (§). Nothing here restates a value.
- **Extensions reused:** X-2 and X-40 (record and person pickers), X-3 (dates), X-4 (separators), X-5 (in-place edit form), X-6 (sidebar counts), X-9 (segmented control), X-10 (figure links), X-12 (block links), X-13 (side sheet), X-14 (Undo toast), X-16 (notes thread), X-17 (unread), X-19 to X-21 and X-23 (files), X-29 (record history), X-30 (export), X-33 to X-35 (notification centre), X-39 (participation and `Your part`), X-42 and X-45 (decision values and record), X-57 (matrix picker), X-59 and X-61 (saved views, column chooser).
- **Earlier contracts, cited by section and never restated:**
  - **Phase 10:** §6.3 (leave warning), §10.2 (refusal format), §15.2 (shared read-only Risk).
  - **Phase 11:** "Voice, formats and shared copy rules"; §1.1 to §1.3 (profiles, anatomy, counts); §5.2 to §5.4 (Homes); §7 (lists, density, mobile cards); §8 (figure links and inventory); §9 (exposure scope, register markers and filters); §12 (five-state format).
  - **Phase 14:** §1 (file field and queue), §3.2 to §3.5 and §3.7 (file list, actions, states, removal), §4.1 (composer files), §9 (toasts), family O.
  - **Phase 16:** §8 (risk history sheet), §11.3 (register risk detail).
  - **Phase 17:** §6.1 (participant page), §11 (people picker), §14.1 and §14.2 (My risk assessments, Home).
  - **Phase 17.1:** §1 (mapping), §7.1 (authority lines, field errors, horizon hint), §8 (decision trail), §9 (released record), §10 (notification rows), §11.2 (sidebar and Home items).
  - **Phase 18:** §5.1 to §5.3 (sort, filter, views, column chooser), §11 (phone filter sheet), §13 (G-4 table form).
  - **Phase 19:** §1 and §2 (Export action and dialog), §3.1 (file values).
  - **Phase 19.1:** §3.1 to §3.4 (notification item, sentences, icons, times).

### Decision coverage

| Decisions | Where |
|---|---|
| D-05 to D-07 | §8 (released view), §3.1 (not tracked, accepted, closed states) |
| D-08 to D-12 | §1, §3, §4 (tracking panel, progress, completion, reopen, changes) |
| D-13, D-21 | §3.3 (acts per part), §7.5 (withheld analyst acts), §15 (family Y), §16 |
| D-14 to D-16 | §7 (residual review, close, reopen, delivery) |
| D-17 | §5 (decision review) |
| D-18 | §3.5 (evidence) |
| D-19 | §12 (history kinds) |
| D-20 | §2 (list), §3 (owner page), §9 (Homes, sidebar) |
| D-22, D-23 | §6 (register), §9.3 (analyst Home by type), §10 (reports, lists), §11.2 (suggestions) |
| D-24 | §11.1 (Used in, counts) |
| D-25 to D-28 | §13 (notifications), §14 (email) |
| D-29 | everything; §16 (G-4) |
| D-30 | §17 (test assertions) |

---

## Design System

| Property | Value |
|---|---|
| Tool | shadcn (source-owned, unchanged) |
| Preset | new-york / neutral / CSS variables / lucide |
| Component library | radix (`radix-ui`) |
| Icon library | `lucide-react` 1.30.0 |
| Font | §3.10 families, unchanged |

Every icon named here was confirmed in the installed `lucide-react` 1.30.0 on 2026-10-01 (`node -e` over its exports in `apps/csrm`): `ListTodo`, `CalendarClock`, `CalendarX2`, `CalendarSync`, `CalendarCheck2`, `CalendarDays`, `FileCheck2`, `NotebookPen`, `RotateCcw`, `Paperclip`, `ShieldCheck`, `CircleCheckBig`, `CircleCheck`, `CircleDashed`, `Clock3`, `ClockAlert`, `LockKeyhole`, `LockKeyholeOpen`, `UserRoundPen`, `Hourglass`, `BellRing`, `BadgeCheck`, `BadgeX`, `ShieldQuestion`, `Scale`, `FilePenLine`, `History`, `Layers`, `Server`, `Database`, `SlidersHorizontal`, `Table2`, `ListFilter`, `Download`, `Upload`, `ChevronRight`.

**New dependencies:** none from this contract. The email is plain text built by Strapi (D-28); no template or rendering library.

---

## Component Inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

Non-exhaustive: known-good components this phase uses, never a closed allowlist.

| Component | Phase 20 use |
|---|---|
| `Sheet` | Change sheets, residual review, control delivery, history (X-13), phone filters |
| `Dialog`, `AlertDialog` (through `ConfirmDialog`) | Close risk, decision review confirmations |
| `Command`, `Popover` | Person picker (X-40), record pickers, suggestions (X-67) |
| `Input`, `Textarea`, `Select`, `RadioGroup`, `Label`, `Calendar` | Forms |
| `Alert` | Stale-value, closed and withheld notices |
| `Table`, `Pagination`, `Skeleton`, `Badge`, `Button`, `Separator`, `Card`, `Tooltip` | Lists, panels, states |
| `sonner` `Toaster` | Undo and outcome toasts (X-14) |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

Non-exhaustive.

| Primitive | Phase 20 use |
|---|---|
| `DataTable`, `HorizontalScrollRegion` | My risks and treatments, register, reference lists |
| `StatusBadge` (`statusPresentation`), `RiskRatingBadge`, `AlertUrgencyBadge` | Every status, rating and urgency label (§1) |
| `SegmentedControl` | Progress, `Show`, review outcome |
| `PageHeader`, `RecordLink`, `DetailSection`, `ConfirmDialog`, `KpiTile`, `BarChart` | Pages, links, sections, confirmations, report sections |
| Earlier phases' planned modules: 13's notes thread; 14's file field, queue, file list and transfer helpers; 16's history sheet and reason parser UI; 17's people picker; 17.1's decision record; 18's views menu and column chooser; 19's export dialog; 19.1's notification item | as those phases plan them |
| **New** (recommended): `features/my-risks/` (list, filters, cards, domain module), `features/treatment/` (`tracking-panel.tsx`, `progress-control.tsx`, `completion-form.tsx`, `treatment-change-sheet.tsx`, `decision-review.tsx`, `evidence-section.tsx`, `treatment-domain.ts` zod-free), `features/risks/post-release/` (`residual-review-sheet.tsx`, `close-risk-dialog.tsx`, `control-delivery-sheet.tsx`), `components/csrm/usage-panel.tsx`, `components/csrm/suggestion-field.tsx` | Planner's choice |

---

## Voice, formats and shared copy rules

Phase 11's, 17's and 17.1's rules apply unchanged. In addition:

- **Terms:** `My risks and treatments`, `Treatment`, `Progress`, `Progress note`, `Evidence`, `Evidence statement`, `Mark complete`, `Reopen treatment`, `Resolve by`, `Record residual review`, `Close risk`, `Reopen risk`, `Review acceptance`, `Renew exception`, `Used in`, `Assessment type`, `Division`, `Business unit`. Never `Accept` or `Approve` on an analyst surface after release; never `Delete` for evidence (it is `Remove`); never `Reopen assessment`.
- **Due phrases** (one formatter, from the served due state and date, never computed in JSX): `Due today`, `Due in {n} {day|days}`, `Overdue by {n} {day|days}`, `Resolve by {date}`, `No resolve date`. Dates are X-3 calendar dates (`12 Mar 2027`); instants are X-3 instants.
- **A status and a due state read together** as the status badge, then, in `--text-caption` / `--color-text-secondary`, `{progress} · {due phrase}` (X-62): `In progress · Overdue by 3 days`.
- **Counts:** `tabular-nums` and written plurals.

---

## 1. Values in the one status mapping (D-08, D-09, D-15, D-17; X-63)

Feature code never chooses a label, tone or icon (G-13 seam).

| Family | Value | Label | Tone | Icon |
|---|---|---|---|---|
| Treatment status (existing `treatment`; labels now sentence case) | `Not Started` | `Not started` | neutral | `CircleDashed` |
| | `In Progress` | `In progress` | info | `Clock3` |
| | `Overdue` | `Overdue` | danger | `ClockAlert` |
| | `Complete` | `Complete` | success | `CircleCheck` |
| Treatment progress (new) | `not-started`, `in-progress`, `complete` | as the status labels | as the status tones | as the status icons |
| Risk state (new) | `closed` | `Closed` | neutral (terminal) | `LockKeyhole` (17.1's `Closed`) |
| Decision review (new) | `not-confirmed` | `Not confirmed` | warning (waits on a Security Analyst) | `BadgeX` |
| | `reviewer-missing` | `Reviewer needed` | warning | `ShieldQuestion` |
| Due state (filter vocabulary only, never a badge) | `not-tracked` | `Not tracked` | — | — |
| Part (X-39's `Your part`) | `treatment-owner`, `control-owner` | `Treatment owner`, `Control owner` | — | — |

- **Urgency** stays §4's: a tracked treatment due soon carries the `Due soon` urgency badge after its status badge; an overdue treatment's status badge already reads `Overdue`, so no urgency badge is added (no double signal). A decision review due within its lead or on its date carries `Due soon`; after its date, `Overdue`.
- A confirmed review and a review not yet due have no badge: the caption `Review by {date}` says it.
- Phase 19's label vocabulary follows the sentence-case labels (its parity test); stored values and the export's JDL values are unchanged (UI-D2).

---

## 2. My risks and treatments (`/app/my-risks`; D-20, D-21)

**Surface:** a data page at `--spacing-grid-max`. **Focal point:** the first row that needs the viewer.

### 2.1 Page

| Part | Contract |
|---|---|
| Title, route title | `My risks and treatments` |
| Description | `Risks you own, approve or treat, and risks whose controls you own. Track each treatment here once its risk assessment is released.` |
| Actions | `Export` (X-30; 19 §1), titled `Export my risks and treatments` |
| Toolbar | `Search risks` (number or statement); `Show` segmented control `Needs you` \| `Open` \| `Closed` (default `Open`); selects `Part` (`All parts`, `Risk owner`, `Executive approver`, `Treatment owner`, `Control owner`), `Status` (`All statuses`, `Not started`, `In progress`, `Overdue`, `Complete`, `Not tracked`), `Due state` (`All`, `Overdue`, `Due soon`, `Due later`, `No resolve date`), `Stage` (`All stages`, `Under assessment`, `Released`); density toggle. Chips `Part: Treatment owner`, `Status: Overdue`, `Due state: Due soon`, `Stage: Released`, with `Clear filters` |
| Count | `{n} {risk|risks}` (`tabular-nums`) |
| Sort | Default: needs the viewer first, then `Resolve by` soonest, empty last. Sortable: `Risk`, `Residual rating`, `Resolve by`, `Review by` |
| Pagination | 25 per page with the total (§4 DataTable) |

### 2.2 Columns (from 768px)

| Column | Content |
|---|---|
| `Risk` | The risk number, a `RecordLink` (mono): to the owner page (§3) once released; to 17.1's decision view (`#your-decisions`) before release |
| `Risk statement` | Long-text column (§4 DataTable) |
| `Your part` | Parts joined by ` · ` |
| `Residual rating` | `RiskRatingBadge` (dense form) |
| `Treatment` | Status badge (§1), urgency when due soon, then the caption `Resolve by {date}`; when overdue the caption is `{progress} · Overdue by {n} {day|days}`. Accepted: `Accepted` (`--text-table`, `--color-text-secondary`); before release: `Not tracked yet` |
| `Treatment owner` | Name, or `You` |
| `Review by` | For accepted risks and exceptions: the date, with `Due soon`, `Overdue`, `Not confirmed` or `Reviewer needed` beneath; otherwise empty |
| `Next step` | Plain text, `--text-table` 500, from the server: `Decide`, `Approve`, `Decide again`, `Update the treatment`, `Review acceptance`, `Renew exception`; otherwise `Nothing now` in `--color-text-secondary` |
| `Assessment` | `{assessment number}` (`RecordLink`), caption `Released` or `Under assessment` |

One link per row opens the risk (the `Risk` cell); `Next step` is text, so the row has one destination (UI-D4).

### 2.3 Phones (below 768px)

One block-link card per risk (§4 Record links, block links), to the same destination as `Risk`: line 1 the risk number with the residual badge at the end; line 2 the statement clamped to three lines; line 3 (caption) `Your part: {parts}`; line 4 the treatment status badge, urgency and due phrase; line 5 `Next step: {step}` (`--text-body` 500) when there is one. The toolbar becomes `Search risks`, the `Show` control at full width, and `Filters` (outline small, `SlidersHorizontal`) opening 18 §11's full-screen sheet with `Show {n} risks`.

### 2.4 States

| State | Contract |
|---|---|
| Loading | After 300ms, a skeleton of the toolbar and rows at the chosen density (cards below 768px) |
| First use | `No risks yet` · `Risks appear here when you’re named as a risk owner, executive approver, treatment owner or control owner on a risk assessment.` (no action) |
| Cleared (`Needs you`) | `No risks need you` · `Nothing is due, and no decision or review is waiting for you.` |
| Filtered | `No risks match these filters` · `Clear filters` |
| Error | `We couldn’t load your risks` · `Try again` |
| Unrelated risks | Never listed or counted (D-21); nothing to render |

---

## 3. The owner risk page (`/app/my-risks/{documentId}`; D-08 to D-13, D-18, D-20, D-21)

**Surface:** a reading page at `--spacing-container-max`, single column at every width. **Focal point:** the `Treatment` section's status line.

### 3.1 Order and frame

1. **Page header:** eyebrow `{assessment number}`; title `{risk number}`; description the risk statement (`--text-body`, `--color-text-secondary`, whole). Meta row: the residual `RiskRatingBadge`, `Closed` (§1) when closed, then `Your part: {parts}`. Actions: `History` (outline small, `History`; X-29) and `Open the released assessment` (outline small link to `/app/assessments/{id}#risk-{number}`).
2. **h2 `Treatment`** (§3.2), id `treatment`.
3. **h2 `Decision review`** (§5), only for an accepted risk or an exception, id `decision-review`.
4. **h2 `Progress notes`** (§3.4), id `progress-notes`; only for a tracked treatment, and kept read-only after closure.
5. **h2 `Evidence`** (§3.5), id `evidence`; only for a tracked treatment.
6. **h2 `Risk details`:** the owner projection read-only in 10 §15.2's layout: statement, cause, impact, category, Risk Type, impacted system and asset, inherent and residual ratings with X-57's `Overridden` note, residual rationale, risk owner, executive approver, the mitigation controls (control, owner, status, due date, implemented on), then 17.1 §9's `Decision` block. Analyst-only facts never render.

States of the whole page: Not tracked (accepted) shows items 1, 2 (one line), 3, 6; before release the risk is not on this route (its row links to 17.1's view); closed shows every section read-only.

### 3.2 The tracking panel (X-62)

| Part | Contract |
|---|---|
| Status line | Status badge (§1), urgency when due soon, then the caption `{progress} · {due phrase}`; `aria-live="polite"` so an optimistic change is announced |
| Facts | Definition list: `Treatment plan` (prose, whole), `Treatment owner` (name and, when it is the viewer, `(you)`), `Resolve by` (date or `No resolve date`), `Last progress update` (`{name} · {instant}`) |
| Progress | §4.1, for those who may set it |
| Completion | `Mark complete` (primary) while not complete (§4.2). Once complete, the completion record replaces it: `Completed by {name} · {part} · {instant}`, `Evidence statement` (prose), and `Reopen treatment` (outline small; §4.3) |
| Changes | For the risk owner and Security Analysts: `Change resolve date`, `Change plan`, `Change treatment owner` (outline small, in one row that wraps; §4.4) |
| Accepted risk | One line (`--text-body`, `--color-text-secondary`): `This risk was accepted, so it has no treatment to track. Its acceptance is reviewed below.` |
| Closed risk | `Alert` (info, `LockKeyhole`): title `Risk closed`; body `{name} closed this risk on {date}: “{reason}”. Its treatment, notes and evidence are read-only.` |
| Older releases | When the progress was never set in CSRM: caption `Progress hasn’t been updated in CSRM since release.` |

### 3.3 Acts per part (D-13; the server's allowed actions decide)

| Part | Sees |
|---|---|
| Treatment owner | Progress, `Mark complete`, `Reopen treatment`, note composer, evidence field and own-file `Remove`. No change actions, no disabled change controls (UI-D5) |
| Risk owner | All of the above, plus the change actions; the review form on Low and Moderate risks |
| Executive approver, control owner | Read-only page; the approver sees the review form on High and Critical risks; no other control renders |
| Security Analyst | Uses the register risk detail (§7), which holds the same panel |

### 3.4 Progress notes (X-16; D-11)

X-16 with: heading `Progress notes`; each note's part in words (`Treatment owner`, `Risk owner`, `Security Analyst`); composer label `Add a progress note`, hint `Everyone who works on this risk can read progress notes. A note can’t be changed once added.`, action `Add note` (outline, `Ctrl`/`⌘` `Enter`); files through 14 §4.1's `Attach files`. Empty: `No progress notes yet` · `Add a note when work on the treatment moves on.` Closed: X-16's `Lock` line `Notes closed when this risk was closed.`

### 3.5 Evidence (X-19 to X-21, X-23; D-18)

14 §3.2 to §3.5's list, actions, states and removal unchanged, with:
- **Description:** `Files that show the treatment’s progress or completion. Each file is checked for malware before anyone can download it.`
- **Columns:** `Name`, `Size`, `Added by` (name and part), `Added`, `Note` (a link to the note it came with, or `Added directly`). No AI column: evidence never reaches the AI.
- **Field:** X-19 labelled `Add evidence`, inside the section, for those who may upload while the risk is open.
- **Closed:** `Lock` line `Evidence closed when this risk was closed. It stays here as part of the record.`
- **Empty:** `No evidence yet` · `Add files such as test results, change records or screenshots.`; closed: `No evidence`.
- Toasts and Undo: 14 §9 with `evidence` for `file` where the noun is generic (`Removed {name} from the evidence.` · `Undo`).

---

## 4. Treatment forms (D-08, D-10, D-12)

### 4.1 Progress

A `SegmentedControl` labelled `Progress`: `Not started` \| `In progress`. Checking a segment applies at once (§5 Optimistic UI) and confirms with an Undo toast `{risk number} set to {label}.` · `Undo`; rollback restores the segment with family Y's reason. While overdue, the status badge stays `Overdue` and the caption shows the new progress. Hidden once complete (completion has its own record).

### 4.2 Mark complete (the form is its own confirmation)

`Mark complete` opens an In-place edit form (X-5) below the status line, titled `Mark {risk number} complete`:

| Field | Contract |
|---|---|
| `Evidence statement` | Required `Textarea`, 4 rows growing. Hint `Say what shows the treatment is done, such as a test result or a change record. Plain text, up to 2,000 characters.` Error on blur or submit: `Write what shows the treatment is done.`; over the bound `Keep this to 2,000 characters or fewer.` |
| `Evidence files (optional)` | X-19 inline; files upload on submit after the completion, queued in X-20 |
| Line | `Your name and the time are recorded. A Security Analyst then reviews the risk.` |
| Actions | `Mark complete` (primary; `Marking complete…`) and `Cancel completion` (outline) |

Success: the form closes, the completion record shows, focus moves to the status line, and the Undo toast reads `{risk number} marked complete.` · `Undo` (reverts within the toast's life; after it, `Reopen treatment`). Typed input survives navigation in the session (Phase 10 §6.3).

### 4.3 Reopen treatment

In-place form `Reopen the treatment on {risk number}`: `Reason for reopening` (required, 1 to 500 characters, hint `Plain text. Everyone who works on this risk can read it.`), the line `The completion record stays in the history.`, actions `Reopen treatment` (primary) and `Keep it complete` (outline). Toast `Treatment on {risk number} reopened.` (no Undo).

### 4.4 Change sheets (X-13)

Each opens a side sheet (full-screen below 768px) with `Current` shown read-only above the new value, a required reason, and a primary that names the act.

| Sheet title | Fields | Line | Actions | Success toast |
|---|---|---|---|---|
| `Change the resolve date for {risk number}` | `Current resolve date`; `New resolve date` (`Input type="date"`, hint 17.1 §7.1's `A date after today, within five years.`); `Reason for the change` | When overdue: `Moving the date clears Overdue, and the treatment shows {progress} again.` When moved inside seven days: `The treatment owner is reminded today.` | `Change resolve date` · `Keep current date` | `Resolve date for {risk number} moved to {date}.` |
| `Change the treatment plan for {risk number}` | `Current plan`; `New treatment plan` (pre-filled with the current plan); `Reason for the change` | — | `Change plan` · `Keep current plan` | `Treatment plan for {risk number} changed.` |
| `Change the treatment owner for {risk number}` | `Current treatment owner`; `New treatment owner` (X-40, suggested group `On this request`); `Reason for the change` | `{name} is told in CSRM.` once chosen | `Change treatment owner` · `Keep current owner` | `{name} is now the treatment owner for {risk number}.` |

Reason hint: `Plain text, up to 500 characters. Everyone who works on this risk can read it.` Field errors: `Choose a resolve date after today.`, `Choose a resolve date within five years.`, `Write the treatment plan.`, `Choose a treatment owner.`, `Write why you’re making this change.` No Undo: the change and its reason are recorded (UI-D7).

### 4.5 Stale values (`TREATMENT_CHANGED`)

In any form or sheet: a warning `Alert` above the actions, title `{risk number} changed since you opened this`, body `Someone else updated it. The current values are shown and your input is kept. Check it, then try again.` The current values replace the read-only `Current` facts; typed input stays.

---

## 5. Decision review (D-17; X-64)

The section shows for a released, open risk with a standing Accept decision or an exception, on the owner page and the register risk detail.

| Part | Contract |
|---|---|
| Status line | The review's badge or urgency (§1), then caption `Review by {date}`; after a confirmation `Last confirmed by {name} · {part} · {date}` |
| Authority line (served wording) | Reviewer, not yet open: `You review this {rating} risk as its {risk owner|executive approver}. You can review it from {date}.` Reviewer, open: `You review this {rating} risk as its {risk owner|executive approver}. Confirming renews the {acceptance|exception} for {m} months.` Owner of a High or Critical risk: `{approver}, the executive approver, reviews this {rating} risk.` Analysts and other readers: `{name} reviews this {rating} risk as its {part}.` Nobody eligible: `No one can review this risk until a Security Analyst reassesses it: it’s rated {rating} and has no executive approver who can act.` Not confirmed: `{name} didn’t confirm the acceptance on {date}: “{reason}”. It no longer counts as accepted. The Security Analyst has been told.` |
| Form (reviewer, while open) | X-5 well titled `Review acceptance` (exception: `Renew exception`): `Outcome` `SegmentedControl` `Confirm` \| `Don’t confirm`; then `Why the acceptance still stands` (Confirm) or `Why it no longer stands` (Don’t confirm), required, up to 2,000 characters; primary `Review acceptance` (exception `Renew exception`) |
| Earlier reviews | `Earlier reviews ({k})` (outline small toggle): entries `Confirmed` / `Renewed` / `Not confirmed` · `{name} · {part} · {date}`, rationale as prose |

**Confirmation (governance step; `ConfirmDialog` 480px, sheet below 768px):**

| Outcome | Title | Body | Actions |
|---|---|---|---|
| Confirm | `Confirm the acceptance of {risk number}?` | `It stays accepted, and its next review is due by {date}. Your name, the time and your rationale are recorded, and the Security Analyst can read them.` | `Confirm acceptance` (primary) · `Keep reviewing` |
| Renew exception | `Renew the exception for {risk number}?` | `The time-limited exception continues, and its next review is due by {date}. Your name, the time and your rationale are recorded.` | `Renew exception` · `Keep reviewing` |
| Don’t confirm | `Stop accepting {risk number}?` | `It no longer counts as accepted, and the assigned Security Analyst is told so they can reassess it. Your name, the time and your reason are recorded.` | `Don’t confirm acceptance` (primary) · `Keep reviewing` |

Success toasts (no Undo): `Acceptance of {risk number} confirmed. Next review by {date}.` · `Exception on {risk number} renewed. Next review by {date}.` · `{risk number} no longer counts as accepted. The Security Analyst has been told.` Analysts never see the form or a disabled one (G-14).

---

## 6. The Risk register (`/app/risks`; D-22, D-23)

### 6.1 Views and columns (X-59, X-61; 18 §5.2, §5.3)

The register gains 18's `View: {name}` menu, `Columns` and both densities. Built-in views:

| View | Filters | Columns after `Risk number` | Sort |
|---|---|---|---|
| `Standard` | none (Phase 11's defaults) | Today's columns, then `Assessment type` | Phase 11's |
| `Project` | `Assessment type: Project` | `Standard`'s, then `Division`, `Business unit` | `Residual rating` high to low |
| `BAU` | `Assessment type: BAU` | as `Project` | as `Project` |
| `Accepted risks` | `Stage: Released`, `Risk state: Open`, `Treatment action: Accept` | `Risk statement`, `Residual rating`, `Decided by`, `Authority`, `Review by`, `Decision review`, `Assessment type` | `Review by` soonest |

Columns offered by the chooser: `Assessment type` (`Project`, `BAU`, `Other`, `Not set`), `Division`, `Business unit` (`Not set` when empty), `Progress`, `Resolve by`, `Decision review`, `Closed on`. The `Treatment status` cell follows X-62 (badge, then `{progress} · {due phrase}`). Closed rows add the caption `Closed {date}` under the risk number.

### 6.2 Filters (11 §9.5's `More filters` and the phone sheet)

| Control | Options | Chip |
|---|---|---|
| `Assessment type` | `All`, `Project`, `BAU`, `Other`, `Not set` | `Assessment type: Project` |
| `Division`, `Business unit` | X-67 suggestion field, exact match | `Division: {value}` |
| `Control` | Record picker (X-2) over controls | `Control: {control number}` |
| `Risk Type` | Record picker | `Risk Type: {name}` |
| `Progress` | `All`, `Not started`, `In progress`, `Complete` | `Progress: In progress` |
| `Decision review` | `All`, `Due soon`, `Overdue`, `Not confirmed`, `Reviewer needed` | `Decision review: Overdue` |
| `Due state` (existing) | `All`, `Overdue`, `Due soon`, `Due later`, `No resolve date` (was `No target date`), `Complete or closed`, `Not tracked` | `Due state: Not tracked` |

The views menu's `Built-in` group lists the four views; filters live in the address so figure links open exact sets (X-10). Export (19) exports the view's rows and visible columns.

---

## 7. The register risk detail after release (`/app/risks/{documentId}`; D-13 to D-16)

16 §11.3's page, for a released risk, gains in order after its header:

1. **h2 `Treatment`:** §3.2's panel with the analyst's acts (progress, completion, reopen, changes), §3.4's notes and §3.5's evidence (analyst columns as §3.5).
2. **h2 `Decision review`:** §5, read-only for analysts.
3. **h2 `Residual review`** (§7.1).
4. **Mitigation controls:** each row gains `Record delivery` (§7.3).

Header actions add `Close risk` or `Reopen risk` (outline) before `Show history`.

### 7.1 Residual review

Summary: `Last reviewed by {name} · {date}` with the rationale, or `Not reviewed since release`. `Record residual review` (outline) opens a side sheet `Record a residual review of {risk number}`:

| Field | Contract |
|---|---|
| Residual rating | X-57 matrix picker (likelihood and consequence), `Derived rating` and `Override the rating` with `Reason for the override` |
| `Control effectiveness (optional)` | Select: `Effective`, `Partially effective`, `Ineffective`, `Not assessed` |
| `Rationale` | Required; hint `Why the residual rating is what it is now. Plain text, up to 2,000 characters.` Error `Write the rationale for this review.` |
| Lines | Going below Critical with an exception: `This review takes {risk number} below Critical, so its time-limited exception ends.` Raising to High or Critical on an accepted risk with no approver: `No one will be able to review its acceptance until it’s reassessed, because it has no executive approver.` Unchanged rating: `The rating stays {rating}. The review is still recorded.` |
| Actions | `Record review` (primary) · `Keep current rating` (outline) |

Toast `Residual review of {risk number} recorded.` (no Undo).

### 7.2 Close and reopen (governance step for closing)

`Close risk` opens a `ConfirmDialog` at the form size (640px): title `Close {risk number}?`; body `It leaves the open register and the exposure figures. Tracking, reminders and any decision review stop. You can reopen it with a reason.`; when not complete, also `Its treatment isn’t complete. Closing doesn’t complete it.`; field `Reason for closing` (required, up to 500 characters, error `Write why you’re closing this risk.`); actions `Close risk` (primary; `Closing…`) and `Keep open` (outline). Toast `{risk number} closed.`

`Reopen risk` opens a 640px dialog `Reopen {risk number}` with `Reason for reopening` and `Reopen risk` (primary) · `Keep closed`. Toast `{risk number} reopened. Tracking resumes.`

### 7.3 Control delivery

`Record delivery` (ghost small, named `Record delivery of {control label}`) opens a side sheet `Record delivery of {control label}`: `Status` (only the allowed moves: `Implemented`, `Retired`), `Implemented on` (date), `Effectiveness`, `Evidence` (text), `Review by` (date); `Save delivery` (primary) · `Keep as it is`. The control, its owner and its due date show read-only. Toast `Delivery of {control label} recorded.`

### 7.4 Phones

Sections stack; header actions stack full-width (§4 Page header); sheets are full-screen.

### 7.5 Withheld analyst acts (G-1, G-11)

No act controls render; one `Alert` (info) in their place:
- Raised the request: `You raised this request, so another Security Analyst reviews and closes its risks.`
- Holds a part: `You’re the {part} on this risk, so another Security Analyst reviews and closes it. You can act on it as {part} in My risks and treatments.` with a `RecordLink` `Open in My risks and treatments`.

---

## 8. The released record and its link (D-05, D-06, D-21)

- Released views read as released (17.1 §9 unchanged); nothing on them changes after a post-release act.
- **Participant page** (17 §6.1 item 6): under `Identified risks`, once released and when the viewer holds a part on any risk, the caption `Risks as they stood at release. Open Track this risk on yours to see its treatment now.` Each of the viewer's risks ends its card with the `RecordLink` `Track this risk` → the owner page. No link on others' risks (403 `NOT_RISK_PERSON` otherwise).
- **Analyst released record:** the same caption reads `Risks as they stood at release. The Risk register shows each risk now.`, and each risk number links to the register risk detail.

---

## 9. Homes and the sidebar (D-20, D-22)

### 9.1 Sidebar (11 §1.1 to §1.3; X-6)

- **Requestor profile:** `My work` appends `My risks and treatments` (`ListTodo`) → `/app/my-risks`. Count: the viewer's overdue and due-soon treatments plus reviews due, name `My risks and treatments, {n} {needs|need} you`, opening `/app/my-risks?show=needs-you` (X-10). Absent at zero. Decisions stay counted on `My risk assessments`.
- **Analyst profile:** the collapsible `My own requests` section becomes `My own work` and appends the same item and count (UI-D10).

### 9.2 Requestor Home `Needs your action` (11 §5.2; 17 §14.2; 17.1 §11.2)

- Description: `Requests, questionnaires, risk assessments, treatments and reviews waiting for you.`
- Items after 17.1's decision items: overdue treatments, then due-soon treatments, then reviews due, each by date. Line 1 `{risk number} · {request title}` (`RecordLink` to the owner page `#treatment` or `#decision-review`); line 2 (caption) `Treatment · Resolve by {date}` or `Acceptance review · Review by {date}`; line 3 the status or urgency badge, then `Update the treatment or mark it complete.` or `Review the acceptance.`
- Footer adds `View all {t} in My risks and treatments` → `/app/my-risks?show=needs-you`.
- Cleared: `No work waiting for you` · `When a request, questionnaire, risk assessment, treatment or review needs you, it appears here.`

### 9.3 Analyst Home (11 §5.3, §9.2, §9.4)

- **`Treatments due`** description: `Tracked treatments past their resolve date or due within 14 days, most overdue first. Released Risks only.`
- **`Risk exposure`** gains, after the rating rows and before `Under assessment`, an h3 `By assessment type` table `Released open Risks by assessment type`: `Assessment type` \| `Critical` \| `High` \| `All ratings`; rows `Project`, `BAU`, `Other`, `Not set`. Non-zero cells link (11 §8.1 rule 3) to `/app/risks?state=open&stage=released&assessmentType={type}` with the rating, named `{n} {Risk|Risks}: {type}, {rating}`; `All ratings` links without a rating. Fits 375px without horizontal scroll.
- **`Your own requests`** (renamed `Your own work`) adds the row `My risks and treatments` {n} → `/app/my-risks?show=needs-you`, named `My risks and treatments: {n} {risk|risks} need you`.

---

## 10. Reports and lists by type (D-22)

| Surface | Change |
|---|---|
| Risk exposure and Assessment throughput reports | A filter row under the description: `Assessment type`, `Division`, `Business unit` (X-67), with chips and `Clear filters`. Every figure link carries the active filters |
| Risk exposure report | New section `Residual rating by assessment type`, description `Released open Risks by assessment type and residual rating.` Table `Assessment type` \| `Critical` \| `High` \| `Moderate` \| `Low` \| `Not rated` \| `Total`; non-zero cells and `Total` link (11 §8.1). Empty: cleared `No released open Risks` |
| Risk exposure report, `Residual rating by treatment status` | Description ends `Overdue is set by each treatment’s resolve date.` (replaces the target-date sentence) |
| Assessment throughput report | New section `Released by assessment type`: `Assessment type` \| `Released in period` (links to the period's list with the type) \| `Median days to release` (plain) |
| Treatment performance report | Section and widget descriptions (11 §9.4) read `Tracked treatments` for `Risk treatments` and end `Released Risks only.`; `No target date` reads `No resolve date` |
| Review queue (`/app/review/requests`) | Filters `Assessment type`, `Division`, `Business unit`, `Information system`, `Information asset` (record pickers); chips by label |
| Risk assessments lists | Column `Assessment type` and the three filters; division and business unit offered by the column chooser (18 §5.4) |

---

## 11. Reference data and the request form (D-22, D-24)

### 11.1 Used in (X-65)

On `/app/admin/{collection}/{documentId}`, after the record's fields, h2 `Used in` (id `used-in`), description per type, figures as link rows (11 §5.3's row pattern; X-10):

| Record | Groups |
|---|---|
| Information System, Information Asset | `Requests`: one row `{n} {request|requests}` → `/app/review/requests?queue=all&informationSystem={id}` (asset: `informationAsset`), caption `Drafts aren’t counted.` · `Open risks by residual rating`: `Critical` to `Low` then `Not rated` with `RiskRatingBadge` → `/app/risks?state=open&stage=released&impactedSystem={id}&residualRating={rating}`, caption `Released Risks only.` · then 11 §9.2's separate `Under assessment` row |
| Control | `Mitigation controls by status`: rows `Planned`, `Existing`, `Implemented`, `Retired` with plain figures and row-header links `{status}: view the Risks with them` → `/app/risks?control={id}&mitigationStatus={status}&state=open` (11 §8.1 rule 5) · `Risks holding this control`: one link row → `/app/risks?control={id}&state=open` |
| Risk Type | `Open risks by residual rating` as for systems, with `riskType={id}` |

States: loading with the page (a heading and four row skeletons); empty, first use `No requests or risks yet` · `This {record kind} appears here once a request names it or a risk uses it.`; error `We couldn’t load where this is used` · `Try again`. Phones: rows full width.

**List counts:** Information Systems and Assets gain columns `Requests` and `Open risks`; Controls and Risk Types gain `Open risks` (released open, `tabular-nums`, right-aligned). Non-zero figures link (11 §8.1 rule 3), named `{n} {Risk|Risks}: {record name}, released and open` or `{n} {request|requests}: {record name}`.

### 11.2 Division and business-unit suggestions (X-67)

The request form's `Division` and `Business unit` (`request-form.tsx`), and §6.2's and §10's filters, become suggestion fields: free text, with a listbox `In use` of matching values after one typed letter (up to 8, alphabetical). Hint unchanged on the form plus `Choose a value in use, or type a new one.` A Requestor sees only values on their own requests (D-22); the field never says how many others exist.

---

## 12. Post-release history (X-29; D-19)

16 §8's sheet unchanged in frame, with:
- **Analysts** see every row. **The risk's people** see `History of {risk number}` with description `Changes since this risk was released, newest first.` and the end line `Changes before release aren’t shown here.`
- Attribution `{instant} by {name} · {part}`; rows written by the daily run read `{instant} by CSRM`.

| Kind | Label | Icon | Lines |
|---|---|---|---|
| `release-baseline` | `Values at release recorded` | `ShieldCheck` | `How this risk stood at release:` and a definition list |
| `progress-set` | `Progress set to {label}` | the label's icon | none |
| `progress-noted` | `Progress note added` | `NotebookPen` | The note, whole, X-16 body rules |
| `treatment-completed` | `Treatment marked complete` | `CircleCheckBig` | `Evidence statement: “{statement}”` |
| `treatment-reopened` | `Treatment reopened` | `RotateCcw` | `Reason: “{reason}”` |
| `treatment-changed` | `Resolve date changed`, `Treatment plan changed` or `Treatment owner changed` | `CalendarDays`, `FilePenLine`, `UserRoundPen` | The comparison, `Reason: “{reason}”` |
| `status-derived` | `Became overdue` / `No longer overdue` | `ClockAlert` / `Clock3` | `The resolve date, {date}, passed.` / none |
| `evidence-added`, `-removed`, `-restored` | `Evidence added`, `Evidence removed`, `Evidence restored` | `Paperclip`, `ArchiveX`, `ArchiveRestore` | `File: {name}` (X-23) |
| `residual-reviewed` | `Residual review recorded` | `Scale` | The comparison, `Rationale: “{rationale}”`, and `Time-limited exception ended.` when it did |
| `risk-closed`, `risk-reopened` | `Risk closed`, `Risk reopened` | `LockKeyhole`, `LockKeyholeOpen` | `Reason: “{reason}”` |
| `decision-reviewed` | `Acceptance confirmed`, `Exception renewed`, `Acceptance not confirmed` | `BadgeCheck`, `BadgeCheck`, `BadgeX` | `Rationale` or `Reason`, and `Next review by {date}` when confirmed |
| `control-implementation-updated` (post-release) | `Mitigation control delivery recorded` | `FilePenLine` | `Control: {control label}`, the comparison |

---

## 13. Notifications (D-25; rows added to 19.1 §3.2 and §3.3)

The record reads `{risk number} · {request title}` for a risk and `{assessment number} · {request title}` for an assessment (19.1 §3.2's assessment rule; UI-D8). The system acts, so no actor is named except where noted.

| Kind | Recipient part | Sentence | Record-level | Icon | Destination |
|---|---|---|---|---|---|
| `treatment-due-soon` | `treatment-owner` | `A treatment you own is due on {date}: …` | `Treatment due soon: …` | `CalendarClock` | Owner page `#treatment` |
| `treatment-overdue` | `treatment-owner` | `A treatment you own was due on {date} and isn’t complete: …` | `Treatment overdue: …` | `CalendarX2` | Owner page `#treatment` |
| `treatment-overdue-escalated` | `security-analyst`, `risk-owner` | Named `{name}’s treatment was due on {date} and isn’t complete: …`; part-named `A treatment was due on {date} and isn’t complete: …` | `Treatment overdue: …` | `BellRing` | Analyst: register risk detail `#treatment`; risk owner: owner page |
| `decision-waiting` | `risk-owner`, `executive-approver` | `A decision has waited for you for {d} days: {assessment number} · {request title}` | `Decision waiting: …` | `Hourglass` | 17.1's `#your-decisions` |
| `decision-review-due` | the reviewer | Due: `An accepted risk is due for your review on {date}: …`; overdue: `An accepted risk was due for your review on {date}: …`; exception: `A time-limited exception is due for your review on {date}: …` | `Acceptance review due: …` | `CalendarSync` | Owner page `#decision-review` |
| `assessment-review-due` | `security-analyst` | `A risk assessment assigned to you is due for review on {date}: …` | `Assessment review due: …` | `CalendarCheck2` | Analyst assessment page |
| `treatment-assigned` | `treatment-owner` | `You’re now the treatment owner for a risk: …` | `Treatment assigned to you: …` | `UserRoundPen` | Owner page `#treatment` |
| `decision-review-not-confirmed` | `security-analyst` | Named `{name} didn’t confirm the acceptance of a risk: …`; part-named `A {risk owner|executive approver} didn’t confirm the acceptance of a risk: …` | `Acceptance not confirmed: …` | `BadgeX` | Register risk detail `#decision-review` |

---

## 14. Reminder email (X-66; D-28)

Plain text only, worded by the server at send time. Never a title, statement, rating, name or Requestor text. Calendar dates as X-3 (`12 Mar 2027`); no time zone.

| Kind | Subject | Body line 1 | Record line |
|---|---|---|---|
| `treatment-due-soon` | `CSRM: treatment due {date} - {risk number}` | `A treatment you own in CSRM is due on {date}.` | `Risk: {risk number}` |
| `treatment-overdue` | `CSRM: treatment overdue - {risk number}` | `A treatment you own in CSRM was due on {date} and isn’t complete.` | `Risk: {risk number}` |
| `treatment-overdue-escalated` | `CSRM: overdue treatment on a risk - {risk number}` | `A treatment on a risk you {own|look after as Security Analyst} was due on {date} and isn’t complete.` | `Risk: {risk number}` |
| `decision-waiting` | `CSRM: decision waiting - {assessment number}` | `A decision in CSRM has waited for you for {d} days.` | `Risk assessment: {assessment number}` |
| `decision-review-due` | `CSRM: acceptance review due {date} - {risk number}` | `An accepted risk is due for your review on {date}.` (overdue: `was due for your review on {date}.`) | `Risk: {risk number}` |
| `assessment-review-due` | `CSRM: risk assessment review due {date} - {assessment number}` | `A risk assessment assigned to you is due for review on {date}.` | `Risk assessment: {assessment number}` |

Body, in order, separated by blank lines: line 1; the record line; `Open it in CSRM (you’ll be asked to sign in):` and the link on its own line; then the footer:

```
You’re receiving this because of your part on this record in CSRM. Reminders stop when the work is done or its date changes.

This message doesn’t include risk details, because email leaves CSRM’s access control. Please don’t reply to it.
IdamBox Cyber Risk Manager (CSRM)
```

Lines wrap at 78 characters; the link is never wrapped.

---

## 15. Refusal copy (new family Y, added to Phase 10 §10.2 and `refusal-copy.ts`)

Kinds as 10 §10.2. Every refusal keeps typed input.

### Y1. Treatment acts

| Reason | Copy | Kind |
|---|---|---|
| `TREATMENT_EVIDENCE_REQUIRED` | Field: `Write what shows the treatment is done.` | field |
| `TREATMENT_FIELD_NOT_PERMITTED` | `Only the risk owner or a Security Analyst can change the resolve date, plan or treatment owner.` | blocked |
| `TREATMENT_CHANGED` | §4.5 | conflict |
| `TREATMENT_NOT_TRACKED` | `This risk was accepted, so it has no treatment to update.` | blocked, `Refresh page` |
| `RISK_NOT_RELEASED` | `This risk isn’t released yet, so its treatment can’t be tracked. Its treatment is still a recommendation.` | blocked |
| `RISK_CLOSED` | `{risk number} was closed, so it can’t change. A Security Analyst can reopen it.` | blocked, `Refresh page` |
| `OWNER_NOT_ELIGIBLE` | Field: `{name} can’t be the treatment owner. Choose someone else.` | field |
| Date not after today, or beyond the horizon | 17.1 §7.1's field errors | field |
| Reason missing or too long | `Write why you’re making this change.` · `Keep this to 500 characters or fewer.` | field |
| `NOT_RISK_PERSON` (403) | `You don’t have a part on this risk, so you can’t track it.` | blocked |
| 404 | The not-found page; in a form, `{risk number} is no longer available to you.` | blocked |
| Evidence files | Family O with `evidence` for `this request’s files`; `ATTACHMENTS_CLOSED` reads `Evidence closed when this risk was closed, so this file can’t change.` | as O |
| Network, timeout or 5xx | `We couldn’t save that. Your input is kept. Try again.` | retryable |

### Y2. Analyst acts

| Reason | Copy | Kind |
|---|---|---|
| `OWN_REQUEST` | `You raised this request, so another Security Analyst reviews and closes its risks.` | blocked |
| `ACTOR_IS_RISK_OWNER`, `ACTOR_IS_EXECUTIVE_APPROVER`, `ACTOR_IS_TREATMENT_OWNER` | `You’re the {part} on this risk, so another Security Analyst reviews and closes it.` | blocked |
| Override reason missing | 18 X1's `RATING_OVERRIDE_REASON_REQUIRED` | field |
| Closing or reopening reason missing | `Write why you’re closing this risk.` · `Write why you’re reopening this risk.` | field |
| `ASSESSMENT_NOT_MUTABLE` on an old path | `{assessment number} is released. Change this risk from the Risk register.` | blocked |

### Y3. Decision review

| Reason | Copy | Kind |
|---|---|---|
| `REVIEW_NOT_DUE` | `You can review this acceptance from {date}.` | blocked |
| `REVIEW_AUTHORITY_MISSING` | `No one can review this risk until a Security Analyst reassesses it.` | blocked |
| `DECISION_NOT_PERMITTED` | `Only {name}, as {part}, can review this acceptance.` | blocked |
| Rationale missing | `Write why the acceptance still stands.` · `Write why it no longer stands.` | field |

---

## 16. Five-state contract and the premium bar

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| My risks and treatments | §2.4 skeleton | §2.4 | §2.4 | Unrelated risks never listed | Needs you, overdue, due soon, accepted, closed, before release |
| Owner page | Page skeleton: header, status line, two fact rows, notes and evidence blocks | Notes and evidence §3.4, §3.5 | `We couldn’t load this risk` · `Try again` | Maya: in-shell not-found; a participant without a part: 10 §10.2's permission state with Y1's `NOT_RISK_PERSON` | Not tracked, complete, overdue, closed, older release |
| Register views, filters | 18 §13 | 11 §9.5, filtered `Clear filters` | 18 X4 | Requestors: no route (gated) | Views, modified |
| Register post-release panel | With the page | `Not reviewed since release` | Y2 | Withheld (§7.5) | Closed, review recorded |
| Used in | §11.1 | §11.1 | §11.1 | Analysts only | — |
| Homes, sidebar | 11 §5.4 | §9.2 cleared | 11 §5.4 | Count absent on failure | Treatments and reviews |

| G-4 item | Phase 20 contract |
|---|---|
| Keyboard path for every primary action | Every act is a button or link in DOM order; `Ctrl`/`⌘` `Enter` adds a note and submits forms; segmented controls by arrows; sheets and dialogs trap focus and return it to their trigger |
| Optimistic feedback with rollback | Progress, notes, evidence removal and restore apply at once and roll back with Y1's reason (§5 Optimistic UI) |
| Skeletons | §16 table; forms and sheets load on demand (`next/dynamic`) with a skeleton after 300ms |
| Undo and confirmations | Undo: progress, completion (toast life), evidence removal. Confirmations: closing a risk and the decision review only (D-29). Changes, reopen and residual review are reasoned forms |
| Empty states that say what to do next | §2.4, §3.4, §3.5, §11.1, §9.2 |
| No lost input | Phase 10 §6.3's guard on every form and sheet; input kept on every refusal and on `TREATMENT_CHANGED` |
| Density | Comfortable and compact on My risks and treatments, the register, evidence and reference lists |
| Motion | Motion section; reduced motion honoured |
| Phone layouts | Cards (§2.3), full-screen sheets, stacked header actions |
| Every figure opens its records | Sidebar and Home counts, exposure by type, report cells, Used in rows, list counts (X-10 equal totals) |

---

## 17. Test assertions this contract changes

- **Journey final slice (`sliceTrackTreatment`, 1440 and 375):** Jane's list shows the risk with `Treatment owner`, `Low`, `Not started`, `Resolve by {date}`; `In progress` toast `{risk number} set to In progress.`; the note posts; evidence uploads; no `Change resolve date` control renders; `Mark complete` with an empty statement shows `Write what shows the treatment is done.`; completion shows `Completed by Jane …`. Bob's register `View: Project`; `Record review`; the close dialog `Close {risk number}?`; toast `{risk number} closed.` The owner `History` sheet lists `Values at release recorded`, `Progress set to In progress`, `Progress note added`, `Evidence added`, `Treatment marked complete`, `Residual review recorded`, `Risk closed`. Maya: the not-found page. Bob: no `Review acceptance` on the accepted risk.
- **Phase spec:** SC1 `View: Project`, `View: BAU` and the exposure `By assessment type` table with links whose totals equal the register; SC3 the approver persona's treatment rows and no others; SC4 a system's `Used in` rows open equal lists; SC5 the in-app sentence `A treatment you own is due on {date}: …`, a capture file whose subject is `CSRM: treatment due {date} - {risk number}` and whose body holds no title, statement, rating or name, `Overdue` in register, Home, alerts and an export, the escalation sentence, and after a dated change the status `In progress`; SC6 refusals as Y1.
- **Existing specs changed deliberately:** register (new filter labels, `No resolve date`), reports (descriptions, sections), Homes (description, cleared copy), reference pages (`Used in`), status-badge labels in sentence case, `performance.spec.ts` with the owner page.
- **Unit (Vitest):** the due-phrase formatter; X-62 composition with no double `Overdue`; §3.3's act table per part (no disabled controls); the review authority lines; the email content builder's snapshot per kind (no name, title or rating); family Y; the copy guard (`Accept` never on analyst post-release surfaces).

---

## Copywriting Contract

| Element | Copy |
|---|---|
| Primary CTAs | `Mark complete`, `Add note`, `Change resolve date`, `Change plan`, `Change treatment owner`, `Reopen treatment`, `Review acceptance`, `Renew exception`, `Confirm acceptance`, `Don’t confirm acceptance`, `Record review`, `Close risk`, `Reopen risk`, `Save delivery` |
| Other calls to action | `Track this risk`, `Record residual review`, `Record delivery`, `Cancel completion`, `Keep it complete`, `Keep current date`, `Keep current plan`, `Keep current owner`, `Keep reviewing`, `Keep current rating`, `Keep open`, `Keep closed`, `Keep as it is`, `Undo`, `History`, `Open the released assessment`, `Open in My risks and treatments`, `Export`, `Clear filters` |
| Headings and labels | `My risks and treatments`, `Treatment`, `Progress`, `Progress notes`, `Evidence`, `Evidence statement`, `Decision review`, `Residual review`, `Risk details`, `Resolve by`, `Review by`, `Next step`, `Your part`, `Used in`, `By assessment type`, `Assessment type`, `Division`, `Business unit` |
| Empty state headings | `No risks yet`; `No risks need you`; `No risks match these filters`; `No progress notes yet`; `No evidence yet`; `No requests or risks yet` |
| Empty state bodies | §2.4, §3.4, §3.5, §11.1 |
| Error state | Family Y and the section errors: what happened and what to do next, input kept |
| Destructive confirmation | None destructive. Governance confirmations: `Close {risk number}?` (§7.2) and the three review outcomes (§5). Evidence removal is reversible (Undo) |
| Email | §14 |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 | Sections are regions named by their h2; facts are definition lists; tables have headers; the progress control is a named radio group |
| 1.4.1 | Statuses, urgencies and review states carry icon and words; the due phrase is text |
| 1.4.10 | No horizontal scroll at 320px on the owner page and cards; tables scroll inside their named region |
| 2.4.3 | Forms open with focus on their first field; after success focus moves to the status line (§4.2) or the section heading; sheets return focus to their trigger |
| 2.5.3 | Link names begin with the visible figure or label (11 §8.1) |
| 2.5.8 | Targets at least 24px; the touch-target height below 768px |
| 3.3.1, 3.3.3 | Field errors say what to fix; refusals in family Y |
| 4.1.3 | The status line and toasts announce politely |
| Automated | Zero serious or critical axe violations on My risks and treatments, the owner page (tracked, complete, overdue, accepted, closed), the register with views, the post-release panel and sheets, `Used in`, at 1440 and 375 |

---

## Spacing Scale

The §3.9 scale, unchanged. Sections 24 to 32px apart (§3.9 rhythm); 8px between a badge and its caption; 16px inside wells and sheets; 12px between figure rows. No exceptions.

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Icon to text in badges, captions |
| sm | 8px | Badge to caption, action rows |
| md | 16px | Well and sheet padding, field gaps |
| lg | 24px | Between sections on the owner page |
| xl | 32px | Form sections (§4 Forms) |
| 2xl | 48px | Not used |
| 3xl | 64px | Not used |

---

## Typography

The §3.10 scale, unchanged.

| Role | Size | Weight | Line Height |
|---|---|---|---|
| Body (facts, notes, sentences) | 14px (`--text-body`) | 400 / 500 | 20px |
| Label (captions, due phrases, attribution) | 12px (`--text-caption`) | 400 / 500 | 16px |
| Heading (sections, sheet and dialog titles) | 16px (`--text-heading-sm`) | 600 | 24px |
| Display (page title) | 28px (`--text-heading-lg`) | 400 | 32px |

Tables use `--text-table` and `--text-micro` headers (§4 DataTable). `tabular-nums` on every count and risk number. Weights 400, 500 and 600 only.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas; tables, cards, sheets, dialogs |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-text-secondary` | Wells, skeletons, hairlines, captions |
| Accent (10%): ink | `--color-primary`, `--color-on-primary`, `--color-text-link`, `--focus-ring` | Reserved, below |
| Severity (§3.6) | the four risk sets | Rating badges, matrix cells, exposure rows |
| Status (§3.5) | danger (`Overdue`, errors), warning (`Due soon`, `Not confirmed`, `Reviewer needed`, stale-value alert), info (`In progress`, closed notice, withheld notice), success (`Complete`, toasts), neutral (`Not started`, `Closed`) | Always with an icon and words |
| Destructive | `--color-danger-solid` | None used |

Ink is reserved for: the primary pills in the Copywriting table, checked segments, record and figure links, and focus rings. No new hue.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Side sheets, phone sheets | §5 "Drawer / side panel"; fade under reduced motion |
| Dialogs, toasts | §5 "Dialog / toast" |
| In-place forms opening | None: instant |
| Progress, removal rollback | §5 Optimistic UI rollback |
| Rows, cards, figures | None (§6 item 8) |

---

## Proposed CSRM extensions

For the orchestrator to accept. A Phase 20 plan task records them in `docs/design/csrm-design-direction.md` before the implementing tasks run. Numbering continues after Phase 18's X-61. None adds a value.

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-62 | §4, new "Tracking panel" entry, after "Decision record" | The tracked-work summary and how a status and a due state read together | "**Tracking panel (CSRM extension, 2026-10-01).** Work tracked to a date after a record is released, such as a Risk's treatment, is summarised at the top of its section: a status line with the status badge, the urgency badge only when the work is due soon (an overdue status already says so, so no second Overdue is drawn), and a `--text-caption` / `--color-text-secondary` line reading `{progress} · {due phrase}`, where the due phrase is `Due today`, `Due in {n} days`, `Overdue by {n} days` or `Resolve by {date}`; then a definition list of the plan, owner, date and last update. The person's progress is a segmented control that applies at once with an Undo toast. Completion is a primary pill that opens an in-place form needing an evidence statement, and once complete the control gives way to a completion record (`Completed by {name} · {part} · {instant}` and the statement) with a quiet `Reopen`. Changes to the plan, date or owner open side sheets that show the current value read-only, ask for a reason, and name the act on the primary. Controls a viewer may not use are not drawn, never disabled. The status line is a polite live region." | D-08 to D-12, D-29; the direction has urgency badges but no way to read a status with its due state, nor a completion record |
| X-63 | §4 Status & risk badges, after "Contest markers" | Tracking, closure and review values | "**Tracking and review values (CSRM extension, 2026-10-01).** A tracked treatment's status reads `Not started` (neutral, `CircleDashed`), `In progress` (info, `Clock3`), `Overdue` (danger, `ClockAlert`) or `Complete` (success, `CircleCheck`), in sentence case; the progress a person set uses the same values without `Overdue`. A closed Risk is `Closed` (neutral, `LockKeyhole`). A decision review not confirmed is `Not confirmed` (warning, `BadgeX`), and one with nobody able to review it is `Reviewer needed` (warning, `ShieldQuestion`); a review due or overdue uses the urgency badges, and a confirmed or not-yet-due review has no badge, only `Review by {date}`. `Not tracked` is a filter value and never a badge." | D-08, D-09, D-15, D-17; G-13's one mapping |
| X-64 | §4 "Decision record", amendment | The review of a standing decision | "**Decision review (CSRM extension, 2026-10-01; amends Decision record).** A standing decision that is reviewed on a date shows, under its own h2 `Decision review`, the review's badge or urgency with `Review by {date}` and the last confirmation; an authority line saying who reviews it and from when; for the reviewer only, an in-place form with an `Outcome` segmented control (`Confirm` or `Don’t confirm`) and a required rationale; and `Earlier reviews ({k})`. The outcome is a governance step behind a confirmation dialog that states what changes and the next review date. People who may not review see the authority line and no control; when nobody can, the line says who must act." | D-17, G-14; X-45 records decisions but not their periodic review |
| X-65 | §4 Record links, after "Figure links" | Where a reference record is used, and usage counts | "**Used in (CSRM extension, 2026-10-01; extends Figure links).** A reference record (a system, asset, control or type) shows an h2 `Used in` after its fields: groups of link rows, each a label, a count and a trailing `ChevronRight`, opening the list whose total equals it; ratings rows carry their severity badge, released and under-assessment figures sit in separate groups, and counts that cannot be an equal list stay plain with their row header linking instead. Its list shows the same counts as right-aligned `tabular-nums` columns, each non-zero figure a text link. Empty is first-use: `No {nouns} yet` with what will make it appear." | D-24, ADMIN-06; the direction has figure links but no usage pattern |
| X-66 | §2 Voice, new "Email" paragraph | Reminder email | "**Email (CSRM extension, 2026-10-01).** CSRM's email is plain text in the product's voice and never HTML. Its subject is `CSRM: {what} - {record number}`; its body says what is due and when, names the record by its number only, and gives one link that opens the record after sign-in, on its own line; its footer says why the person receives it, when reminders stop, that it carries no risk details because email leaves CSRM's access control, and not to reply. It never holds a title, statement, rating, person's name or Requestor text. Dates are calendar dates without a zone; lines wrap at 78 characters except the link." | D-28, NOTIFY-02, ISO/IEC 27001:2022 A.5.14; the direction covers only the app |
| X-67 | §4 Forms, after "Record picker" | Free text with suggestions | "**Suggestion field (CSRM extension, 2026-10-01; amends Record picker).** A free-text field whose values should repeat, such as a division, is a combobox that keeps whatever is typed and, after one letter, offers up to eight matching values in use in a listbox grouped `In use`, alphabetically, without counts. Choosing fills the field; `Escape` closes the list and keeps the text. Its hint says `Choose a value in use, or type a new one.` It never reveals values the viewer may not read." | D-22; X-2 chooses records, not free text |

---

## Decisions recorded

Made without asking (auto mode), from the locked context, `AGENTS.md`, the glossary and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | An overdue treatment shows the `Overdue` status badge and no urgency badge; the caption carries the progress and days. | One signal per fact; D-08's status already is Overdue. |
| UI-D2 | Treatment status labels become sentence case (`Not started`, `In progress`); stored and exported JDL values unchanged. | §4 badges are sentence case; D-29's copy terms. |
| UI-D3 | The owner page is a single-column reading page with the treatment first. | The focal act is updating the treatment; matches 17's participant page. |
| UI-D4 | Each list row has one link; `Next step` is text, and the destination depends on stage (owner page or 17.1's decision view). | One keyboard target per row (§4 block links). |
| UI-D5 | Controls a part may not use are not drawn, never disabled. | 17.1 §7.4's rule; D-21's "no control". |
| UI-D6 | Progress applies on checking a segment, with Undo; completion is a separate form. | D-10 needs evidence; D-29's Undo for progress. |
| UI-D7 | Date, plan and owner changes, reopen and residual reviews have no Undo; they are reasoned and recorded. | D-29: forms with reasons; Undo only for progress, completion and evidence removal. |
| UI-D8 | A risk is named in notifications as `{risk number} · {request title}`. | 19.1 §3.2's identifier and name rule; a statement is too long for the panel. |
| UI-D9 | `Don’t confirm` is titled `Stop accepting {risk number}?`. | States the consequence (D-17). |
| UI-D10 | The analyst sidebar's `My own requests` becomes `My own work`, holding `My risks and treatments`. | 17 D-28's every-actor rule needs an analyst place; the label must stay true. |
| UI-D11 | The register's default view is `Standard`, as Phase 18's. | 18 UI-D13. |
| UI-D12 | `No target date` reads `No resolve date`. | D-09 moves the governing date. |
| UI-D13 | Home's exposure by type is a four-column table (`Critical`, `High`, `All ratings`). | Fits 375px; every figure links (X-10). |
| UI-D14 | Emails share one subject and footer pattern; the escalation names the recipient's relation, never the treatment owner. | D-28's minimisation. |
| UI-D15 | Refusals are family Y. | The spawn prompt. |

---

## Notes carried

- **For the orchestrator to settle:**
  - **UI-D2:** treatment status labels in sentence case change shipped labels and Phase 19's parity vocabulary; confirm, or keep the JDL title case.
  - **UI-D10:** renaming the analyst's `My own requests` section (11 §1.1) and the Home widget `Your own requests` (11 §5.3) to `My own work` / `Your own work`; confirm, or place the item elsewhere.
  - **Routes** `/app/my-risks` and `/app/my-risks/{documentId}` are proposals.
- **For research and the planner:** reason codes, bounds and query keys as research fixes them; the email's link base comes from D-28's public base URL setting; forms and sheets load with `next/dynamic` (R-08-34).
- **Earlier contracts this one amends (their plans have not executed):** 11 §1.1, §5.3, §9.4, §9.5 (`No target date`), §8.2 (treatment rows); 17 §6.1 item 6 (`Track this risk` and caption); 17 §14.2 and 17.1 §11.2 (Home description and cleared copy); 19.1 §3.2 and §3.3 (rows); 16 §8.3 (kinds).
- **Shared-file changes needed:** the direction records X-62 to X-67 through a Phase 20 plan task; `refusal-copy.ts` gains family Y; the glossary terms of D-29 (planned by a Phase 20 plan).

---

## UI Considerations

Written inline from the contract. The ui-phase probe replaces them when it runs.

State considerations: 17 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|---|---|---|---|
| empty | My risks and treatments, notes, evidence, Used in | ✅ covered | §2.4, §3.4, §3.5, §11.1 |
| loading | List, owner page, sheets, Used in | ✅ covered | §16 |
| error | Acts, reviews, analyst acts | ✅ covered | Family Y |
| permission | Maya, participant without a part, treatment owner, analysts with parts | ✅ covered | §3.3, §7.5, §8, Y1 |
| partial | Older releases without progress | ✅ covered | §3.2 |
| partial | Nobody to review | ✅ covered | §5 |
| interaction | Two people updating one treatment | ✅ covered | §4.5 |
| interaction | Overdue cleared by a date change | ✅ covered | §4.4 |
| interaction | Completion undone | ✅ covered | §4.2 |
| interaction | Leaving with typed input | ✅ covered | §16 |
| zero-one-many | Plurals, counts | ✅ covered | Written-out forms |
| overflow | Long plans, statements, notes | ✅ covered | Prose wraps; long-text columns |
| phone | Cards, sheets | ✅ covered | §2.3, §7.4 |
| figures | Counts open equal lists | ✅ covered | §9, §10, §11.1 |
| refusal | Released record unchanged | ✅ covered | §8 |
| email | No personal data | ✅ covered | §14 |
| copy | No analyst `Accept` | ✅ covered | §17 copy guard |
| email client | Plain text renders in Outlook and Gmail without reflow of the link | 🧪 backstop | `{ statement: "The pilot opens a captured reminder in Outlook and Gmail; the link is whole and opens CSRM after sign-in", verification: backstop }` |
| screen reader | The status line announces a progress change once | 🧪 backstop | `{ statement: "With NVDA, setting In progress announces the new status line once", verification: backstop }` |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|---|---|---|
| shadcn official (local source-owned components) | None new | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

---

## Verification contract

- **Unit and component (Vitest):** §17's unit list and every component in its refusal states.
- **E2E** (1440 and 375): §17's journey slice and phase spec, with the axe scope; each run leaves the tree clean.
- **Manual (pilot):** the two UI Considerations backstops.

---

## Checker Sign-Off

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

1. **Icons:** `ArchiveX` and `ArchiveRestore` are confirmed lucide icons and join this contract's icon list. The plan verifies them against the installed `lucide-react` and records any substitute it uses.
2. **§10's report tables on phones:** below 768px each report table becomes a card list, one card per row, with the row header as the card title and every figure kept as a link (X-10). This is the direction's table-to-cards pattern, as Phase 18's phone card list uses.
3. **Settled items:** UI-D2 (sentence-case treatment status labels), UI-D10 ("My own work") and the `/app/my-risks` routes are accepted. The Phase 20 plans change the earlier phases' shipped labels and surfaces, with their tests.
4. **Typography** follows the direction's scale (ADR 0001 gap 8).
