---
phase: "13"
slug: "request-pick-up-and-notes"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 13 — UI Design Contract

> Visual and interaction contract for request pick-up and notes. It covers:
> - the `Assigned to me` sidebar item, view and counts, the `Requests` queue's assignee column, pick-up and filters, and quick find (D-13, D-14);
> - the analyst Home's own-work figures (D-15);
> - the request pages' summary rows, the analyst's assignment block, the eligible-analyst picker and the history (D-05 to D-09, D-16, D-17);
> - the notes thread and composer on both request pages, the unread marker, and the Requestor's Home and My requests (D-21 to D-25);
> - the "Changes the AI inputs" mark, the "AI inputs changed" signal and the notes group of "What the AI used" (D-26 to D-29);
> - the generation-job cards that any analyst on the request can now follow and retry (D-18).
>
> It introduces no colour, type size, weight, family, radius, shadow, spacing step or duration of its own. Four patterns the direction does not yet name are proposed as CSRM extensions X-15 to X-18.

---

## Binding inputs and value authority

- **Locked decisions.** D-01 to D-34 in `13-CONTEXT.md` govern this contract. It fixes the copy, layout, routes and visuals the context leaves to the UI-SPEC (Planner's Discretion: "Copy, layout, routes and visuals"). Where a decision leaves a choice open, this contract makes it and records the reason under "Decisions recorded" (UI-D1 to UI-D31).
- **Value authority.** `docs/design/csrm-design-direction.md` (ADR 0001) is the only value-bearing authority. This file names semantic tokens and cites the direction by section (§). It restates no colour, size, radius, shadow or duration. Spacing steps are named only where a new layout needs one, and each is a §3.9 step.
- **Extensions.** Recorded in the direction before any Phase 13 plan runs: X-1 to X-5 (plan 10-01), X-6 to X-10 (Phase 11's first plan), X-11 to X-14 (plan 12-13). This contract reuses:
  - X-2 (record picker) inside the assign picker;
  - X-3 (dates and times) for every note time and assignment time;
  - X-4 (separators);
  - X-6 (sidebar sections and counts) for `Assigned to me`;
  - X-7 (keyboard shortcut hint) for the composer;
  - X-10 (figure links) for every new figure;
  - X-11 (provenance notes and header), X-13 (side sheet) and X-14 (Undo toast).

  New patterns are proposed as X-15 to X-18 under "Proposed CSRM extensions", each with its exact wording. A plan task records them before any implementing task runs.
- **Requirements.** REQ-08 and COLLAB-01. Acceptance bar: ROADMAP Phase 13 success criteria 1 to 5.
- **Findings closed.** UAT-013 and UAT-014 (and UAT-041's job visibility, through D-18).
- **Delegated decisions.** #2, #5, #10, #16, #17, #18, G-1, G-3, G-4 (§15 of this contract), G-6, G-11, G-12, G-13, G-14 (UI-D29), G-15, G-16 and G-18.
- **Builds on Phases 10, 11 and 12.** The surfaces are the ones those contracts define: Phase 10's request pages (10 §9), refusal families A to I (10 §10.2), job cards (10 §12) and leave warning (10 §6.3); Phase 11's navigation profile (11 §1), Homes (11 §5), holder sentences (11 §6.1), lists (11 §7.1, §7.3) and quick find (11 §4.3); Phase 12's provenance header (12 §1), "What the AI used" sheet (12 §2) and refusal family J. Every plan re-reads those files after the earlier phases execute, because this phase's plans are written ahead.
- **Domain vocabulary** is the JDL's and the glossary's. Assessment Request, Security Analyst and Requestor keep their capitals. Two presentations are new: "assigned analyst" (`assignedAnalyst`) and "note" (`CsrmRequestNote`); the glossary records both (a Phase 13 plan task, CONTEXT canonical refs). "Note" is never used for a contest point (glossary, G-15).
- **Reserved words.** `Accept` is the risk owner's decision (G-14; Phase 12 UI-D1); no Phase 13 string uses it, and assignment has no "accept" step (UI-D29). "Release" names the assessment's state (decision 16): giving a request back is `Return to queue` (UI-D1), never "release".

### Decision coverage

| Decisions | Where this contract honours them |
|---|---|
| D-01 to D-04 (contract, endpoints, people projections) | No UI of their own. The UI reads only the planned fields; people show as display names only (§5, §8, §12) |
| D-05 | §5.2 actions, §7 (optimistic, Undo, no confirmation) |
| D-06 | §6 (the picker lists only the eligible set) |
| D-07 | §2.3 and §5.2 (no control, a line saying why); §10.1 (no switch) |
| D-08 | §5.2 (no `Return to queue` after release; draft line), §7.1 (Undo only when allowed, UI-D4) |
| D-09 | §5.3 history; §12.1 the Requestor sees the name only |
| D-10, D-11, D-12 | No UI in this phase (Notes carried) |
| D-13 | §2 (column, filters, `All open`, relabel), §4 (quick find) |
| D-14 | §1 (sidebar item, counts), §2.1 (the view) |
| D-15 | §3 |
| D-16 | §5, §6, §11 |
| D-17 | §12 |
| D-18, D-19 | §13 |
| D-20 | No UI: the analyst is never offered submit on another person's draft |
| D-21, D-22 | §8 (append-only, no edit or delete control; closed states) |
| D-23 | §8.6 (another Requestor gets the request page's not-found state), §12 |
| D-24 | §8.4 (read rule in the UI), §2.2, §3, §12 (where unread shows), X-17 |
| D-25 | §8, §9 |
| D-26 | §10.1 |
| D-27 | No UI (the context builder) |
| D-28 | §10.3 |
| D-29 | §10.2 |
| D-30, D-31 | §5.2 (controls only with the grant); §17 (the second persona's sign-in label) |
| D-32, D-33 | §16, Verification contract |
| D-34 | The whole contract; §15 (G-4); Motion; X-15 to X-18 |

---

## Design system

| Property | Value |
|----------|-------|
| Tool | shadcn/ui, source-owned local components (`apps/csrm/components.json`: style `new-york`, RSC, CSS variables, neutral base, `iconLibrary: lucide`) |
| Preset | new-york; neutral base; CSS variables; RSC; Lucide icons |
| Component library | Radix primitives through the installed `radix-ui` package (1.6.7), composed by the local shadcn/ui components; `cmdk` 1.1.1 under `Command`; `sonner` 2.0.8 under the source-owned `Toaster` |
| Icon library | `lucide-react` 1.30.0, per §4 Iconography |
| Font | Plus Jakarta Sans for UI text, data and numbers; Instrument Serif for page titles only; IBM Plex Mono for micro-labels and identifiers (§3.10, ADR 0001 gap 8) |
| Tokens | Semantic tokens in `apps/csrm/app/globals.css`, whose values are the direction's; feature code consumes the mapped utilities only |
| New dependencies | None. The picker composes `Popover`, `Command` and `Sheet`; the thread composes `Textarea`, `Switch`, `Checkbox` and `Button`; Undo toasts use the installed `sonner` action |

---

## Component inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

A non-exhaustive list of the known-good components this phase uses, never a closed allowlist. The full set is the 30 Phase 11 lists (`alert-dialog` to `tooltip`).

| Component | Import path | Phase 13 use |
|---|---|---|
| `Popover`, `Command` (`CommandInput`, `CommandList`, `CommandItem`, `CommandEmpty`) | `@/components/ui/popover`, `@/components/ui/command` | The assign picker from 768px (§6, X-15) |
| `Sheet` | `@/components/ui/sheet` | The assign picker below 768px (X-13 full-screen sheet) |
| `Textarea`, `Label`, `Checkbox` | `@/components/ui/*` | The note composer and the picker's reason (§6, §8.3) |
| `Switch` | `@/components/ui/switch` | The per-note AI-input mark (§10.1, X-18) |
| `Toaster` (sonner `toast` with `action`) | `@/components/ui/sonner` | Undo toasts and rollback toasts (§7, §9, §10; X-14) |
| `Skeleton` | `@/components/ui/skeleton` | Picker list, earlier notes, page skeleton blocks |
| `Button`, `Card`, `Select`, `Separator` | `@/components/ui/*` | Actions, filters, unchanged uses |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

A non-exhaustive list; the executor may use any exported primitive.

| Primitive | Path | Phase 13 change |
|---|---|---|
| `DataTable` | `components/csrm/data-table.tsx` | Reused, never forked: the queue gains a column, filters and a row action through its existing props (§2) |
| `KpiTile` | `components/csrm/kpi-tile.tsx` | Tile 1 of the analyst Home changes (§3) |
| `RecordLink` | `components/csrm/record-link.tsx` | Figure links to notes and lists (X-10) |
| `DetailSection` | `components/csrm/detail-section.tsx` | The `Assignment` and `Notes` sections (§5, §8) |
| `ConfirmDialog` | `components/csrm/confirm-dialog.tsx` | Not used: nothing in this phase asks for confirmation (D-34) |
| Phase 10 `LocalInstant`, `formatInstant`, navigation guard, `refusal-copy.ts` | as Phase 10 plans them | Note and assignment times (X-3); the composer's unload guard (§9.3); families K to M (§7.4, §9.5, §10.4) |
| Phase 11 navigation profile, Home widget frame, quick-find options | as Phase 11 plans them | §1, §3, §4, §12 |
| Phase 12 provenance header, run sheet, `ai-assistance-domain.ts` | as Phase 12 plans them | §10.2, §10.3 |
| **New:** assignment feature | recommended `features/request-assignment/` (`assignment-domain.ts` zod-free, `assignment-block.tsx`, `assign-picker.tsx` lazy, `queue-pick-up-button.tsx`, `assignment-history.tsx`, `assignment-actions.ts` `'use server'`) | §5 to §7 |
| **New:** notes feature | recommended `features/request-notes/` (`notes-domain.ts` zod-free, `notes-section.tsx`, `note-item.tsx`, `note-composer.tsx`, `notes-summary.tsx` (server), `unread-marker.tsx`, `notes-actions.ts` `'use server'`) | §8 to §10 |

Names and paths of new modules are the planner's (CONTEXT, Planner's Discretion). Zod stays out of every new client module (`zod-client-boundary.test.ts`).

---

## Token names used in this contract

As the Phase 11 contract's table ("Token names used in this contract"), which this contract does not repeat. This phase uses these additionally or more heavily:

| Direction token | Utility or class in the shipped code | Phase 13 use |
|---|---|---|
| `--color-text-primary` with weight 500 | `text-foreground font-medium` | The unread marker (X-17): ink, never a status hue |
| `--color-border-default` | `border-border` | Hairlines between notes and between history events |
| `--color-border-strong`, `--color-primary` | `Switch`, `Checkbox` | The AI-input switch and the composer checkbox (§4 Forms) |
| `--color-bg-inset` | `bg-surface-muted` | The read-only unsent-note well (§9.4); the picker's active option (X-2) |

---

## Voice, formats and shared copy rules

The Phase 11 contract's "Voice, formats and shared copy rules" section applies unchanged (Australian English, sentence case, spaced hyphen, middle-dot separator, typographic apostrophes and quotes, written-out plurals with `tabular-nums`, X-3 times). In addition:

- **People are names.** An assignee, assigner or note author is shown by display name only (D-04). The viewer is never "you" in place of their own name in a list or a note header, so a name reads the same to every analyst; "you" appears only in sentences addressed to the viewer (`You picked up RAR-2026-5WWFVQ.`).
- **Times.** Every note and assignment time is an instant with its time of day, through `LocalInstant` (X-3): `1 Oct 2026, 3:47 pm`.
- **Parts.** A note's part reads `Requestor` or `Security Analyst`, the words the people see elsewhere.
- **Assignment verbs.** `Pick up`, `Assign`, `Assign to me`, `Reassign`, `Return to queue` (UI-D1, UI-D2). States: `Assigned to {name}`, `Not picked up`. Never "claim", "own", "accept" or "release".
- **No internal terms.** New copy avoids "assignee", "unassigned", "read state", "bucket", "AI context", "context builder" and "envelope". The queue's `unassigned` value reads `Not picked up`.

---

## 1. Navigation: Assigned to me and the counts (D-14; X-6)

**Surface:** the analyst profile in `navigation.ts` (Phase 11 §1.1), sidebar and phone drawer alike.

| # | Section | Label | Opens | Capability | Icon | Count |
|---|---|---|---|---|---|---|
| 2 (new, first in the section) | `Assessment work` | `Assigned to me` | `/app/review/assigned` | `assessment:review` | `UserRoundCheck` | need your action |
| 3 (was 2) | `Assessment work` | `Requests` | `/app/review/requests` | `assessment:review` | `Inbox` | waiting for pick-up (changed meaning) |

The other items keep their Phase 11 rows and order. The drawer renders the same profile, so `Assigned to me` appears there too.

| Item | Read (one bounded queue read each, `pagination[pageSize]=1`; no polling; Phase 11 D-11) | Accessible name of the link |
|---|---|---|
| `Assigned to me` | `queue=requires-attention`, `filters[assignee]=me` | `Assigned to me, 3 need your action` · `Assigned to me, 1 needs your action` |
| `Requests` | `queue=requires-attention`, `filters[assignee]=unassigned` | `Requests, 4 waiting for pick-up` (singular and plural alike) |

Phase 11 §1.3's rules hold unchanged: zero, a failed read and a refused read show no count; counts are not announced; the item opens its page as it always does. The equal-list figures for these counts are the analyst Home's (§3), as Phase 11 settled for the sidebar (UI-D7).

---

## 2. The review queues (D-13, D-14, D-24; Phase 11 §7.1)

### 2.1 Assigned to me (`/app/review/assigned`)

**Focal point:** the table; the `Queue:` line names the view.

| Part | Contract |
|---|---|
| `h1` and nav label | `Assigned to me` (Phase 11 D-09: label equals heading) |
| Route title | `Assigned to me \| IdamBox CSRM` |
| Description | `Requests you’re accountable for, and what each needs next.` |
| Fixed scope | `filters[assignee]=me`, never shown as a chip or a control |
| Queue (default `All open`) | The §2.2 Queue select, with `All open` as this view's default |
| Other controls | Search, Status and `Notes` (§2.2) |
| Columns | Phase 11 §7.1's nine, without `Assigned to` |
| Mobile card | Phase 11 §7.1's card, plus the unread line (§2.2) |
| Empty (default view) | Cleared: `No open requests assigned to you` · `Requests you pick up, or that another Security Analyst assigns to you, appear here until they’re released. Requests waiting for pick-up are in Requests.` (no action, §4 Empty states cleared type) |
| Filtered empty | The locked `No requests match these filters` with `Clear filters` (back to `All open`) |
| Loading, error, permission | As the Requests route: the queue skeleton with nine columns; the route's locked error and permission states, with `Assigned to me` as the area |

### 2.2 Requests (`/app/review/requests`) and the shared queue controls

| Control | Contract |
|---|---|
| Description | `Submitted requests across the team. Pick up a request to make it yours.` (was `Review submitted requests and start draft generation.`; UI-D30) |
| Queue | `Requires attention` (default here; was `Requires my attention`, UI-D9), `Awaiting Requestor`, `Generation in progress`, `All open` (new, the `open` bucket), `Released`, `All requests`. The line above reads `Queue: {label}` |
| `Assigned to` (Requests only, new) | Select: `Anyone` (default), `Me`, `Not picked up`. Chip `Assigned to: Me` or `Assigned to: Not picked up` |
| `Notes` (both views, new) | Select: `All requests` (default), `With new notes`. Chip `Notes: New notes` |
| `Clear filters` | Resets search, status, `Assigned to` and `Notes`, and the queue to the view's default |

**Column (Requests only), after `Status`:**

| Column | Content | Sort |
|---|---|---|
| `Assigned to` | The assignee's name (`--text-table`). Unassigned and `canPickUp`: the `Pick up` button (X-15: outline, small; accessible name `Pick up {request number}`). Unassigned otherwise: `Not picked up` in `--color-text-secondary`; on a request the viewer raised, a second caption line `You raised it` | no |

**Unread line (both views).** Under the title in the `Title` cell, outside its two-line clamp: the X-17 count marker, `{n} new {note|notes}`, a link to `/app/review/requests/{id}#notes` named `{n} new {note|notes} on {request number}`. Absent at zero.

**Mobile card** (Phase 11 §7.1), with two added lines after line 2: the unread line, then `Assigned to {name}`, or `Not picked up` and, when `canPickUp`, `Pick up` at full width and the touch-target height.

**Density.** Both views keep the DataTable density toggle; the `Pick up` button meets the row's 24px minimum target in compact density.

| Viewport | Contract |
|---|---|
| 1440 | Ten columns on Requests (nine on Assigned to me); a table wider than its container scrolls inside its labelled region, its identifier column sticky (§4 DataTable) |
| 375 | Cards, one per request; `Pick up` is the card's last element |

### 2.3 The requesting analyst (G-1, D-07)

On a request the viewer raised, the queue offers no `Pick up` (§2.2 `You raised it`), and the request page says why (§5.2). The server's `canPickUp` decides; the web never infers it.

---

## 3. The analyst Home (D-15; Phase 11 §5.3; X-10)

**Focal point:** tile 1, `Needs your action`, then the `Review queue` widget's `Assigned to you` group.

**Tiles.** Four, in Phase 11's grid. Tile 1 changes; tiles 2 to 4 are unchanged (UI-D8).

| Tile 1 part | Contract |
|---|---|
| Caption | `Needs your action` (was `Requires my attention`) |
| Value | Requires attention ∩ assigned to the viewer |
| Supporting line | `Requests assigned to you that need analyst action` |
| Icon | `UserRoundCheck` (was `Inbox`), the tile's muted tone |
| Opens | `/app/review/assigned?queue=requires-attention` |

**Review queue widget.** Description: `Your assigned requests first, then the team’s queue.` Each row is a Phase 7 link row (whole row one link, count and `ChevronRight`), zero rows render, and each opens a list whose total equals its figure.

| Group | Row | Opens |
|---|---|---|
| `Assigned to you` (new, first) | `Needs your action` | `/app/review/assigned?queue=requires-attention` |
| | `With new notes` | `/app/review/assigned?notes=unread` (open ∩ the viewer ∩ unread) |
| | `Awaiting Requestor` | `/app/review/assigned?queue=awaiting-requestor` |
| | `Generation in progress` | `/app/review/assigned?queue=generation-in-progress` |
| `Assessment Requests` (the team) | `Waiting for pick-up` (new, first) | `/app/review/requests?assignee=unassigned` (default queue `Requires attention`) |
| | `Requires attention` (was `Requires my attention`) | `/app/review/requests` |
| | `Awaiting Requestor`, `Generation in progress` | unchanged |
| `Questionnaires`, `Risk Assessments` | unchanged | unchanged |

Row names follow the shipped pattern: `{label}: {n} {request|requests}`. The `Assigned to you` group's `With new notes` row is named `With new notes: {n} {request|requests} assigned to you`.

| Viewport | Contract |
|---|---|
| 1440 | Phase 11's grid unchanged; the widget grows by one group |
| 375 | Phase 11's order; the `Review queue` widget still begins within the first 812px screen, because the tile strip is unchanged |

---

## 4. Quick find (D-13; Phase 11 §4.3)

The analyst's `Requests` options gain the assignee on line 2: `{status label} · Assigned to {name}` or `{status label} · Not picked up`. The Requestor's `My requests` options are unchanged. No new read, group or option.

---

## 5. Request pages: summary rows and the assignment block (D-16, D-17; X-15)

### 5.1 The hub's Request summary (both pages)

| Row | Analyst page | Requestor page |
|---|---|---|
| `Requestor` (was `Owner`; Phase 10 UI-D30) | the Requestor's name | the Requestor's name |
| `Assigned to` (analyst) / `Security Analyst` (Requestor) | the name, or `Not picked up` | the name, or `Not picked up yet` |
| `Notes` | a figure link (X-10) to `#notes`: `{n} {note|notes}`, followed by the X-17 marker `{k} new` when above zero, named `{n} {note|notes}, {k} new`. With none and the window open (D-22): the link `Add a note` → `#note-composer`. With none and the window closed: `No notes` | the same |

### 5.2 The assignment block (analyst page only)

**Placement:** a `DetailSection` titled `Assignment`, directly after the hub, before the analyst's `Return to draft` control and `Request context`. Region id `assignment`.
**Focal point:** the status line.

| Part | Contract |
|---|---|
| Status line (`--text-body` at 500, `tabIndex={-1}` for focus) | `Assigned to {name}`, or `Not picked up` |
| Caption (`--text-caption`, `--color-text-secondary`) | Picked up by the assignee: `Picked up {instant}`. Assigned by another: `Assigned by {name} · {instant}`. Not picked up: `Any Security Analyst who didn’t raise this request can pick it up.` Released before this phase with nobody assigned: `Released before CSRM recorded assignments. Assign it so its monitoring reaches a Security Analyst.` |
| Actions | Outline small pills, in this order, offered only as the server allows this viewer (the projection's allowed actions): |
| — unassigned | `Pick up` (`UserRoundPlus`), `Assign` (`UserRoundSearch`) |
| — assigned to the viewer | `Reassign` (`UserRoundSearch`), `Return to queue` (`Undo2`) |
| — assigned to another | `Assign to me` (`UserRoundPlus`), `Reassign`, `Return to queue` |
| — released or closed | `Return to queue` is absent (D-08) |
| — a draft (returned, 06.1) | No actions. Line: `This request is a draft, so its assignment stays as it is until it’s resubmitted.` |
| — the viewer raised the request (D-07) | No actions. Line: `You raised this request, so another Security Analyst picks it up.` |
| History | §5.3 |

Accessible names begin with the visible label: `Pick up {request number}`, `Assign {request number}`, `Reassign {request number}`, `Return {request number} to the queue`, `Assign {request number} to me`.

| Viewport | Contract |
|---|---|
| 1440 | Status and caption on the left; actions right-aligned on the status row, wrapping beneath it when the section is narrow |
| 375 | Stacked; each action at full width and the touch-target height; the history toggle below them |

### 5.3 The history (D-09)

An outline small toggle, `Show assignment history ({n})` / `Hide assignment history`, with `aria-expanded`, `aria-controls` and `ChevronDown` / `ChevronUp` swapped with no transition (the Phase 12 §5 toggle pattern). Absent when there is no event. The list is an `ol` named `Assignment history`, newest first, events separated by `--color-border-default` hairlines.

| Action | Sentence (`--text-body`) |
|---|---|
| pick up | `Picked up by {actor}` |
| assign | `Assigned to {to} by {actor}` |
| reassign | `Reassigned from {from} to {to} by {actor}` |
| unassign | `Returned to the queue by {actor}` (from {from}: `Returned to the queue by {actor}, from {from}`) |

Each event adds a caption `{instant}` and, when present, `Reason: “{reason}”` on its own caption line with `whitespace-pre-wrap`. A malformed log, which the parser projects as absent, shows no toggle (fail safe). The history prints when expanded; the actions never print.

---

## 6. The assign picker (D-06, D-16; X-15, X-2, X-13)

**Trigger:** `Assign` or `Reassign`. The list reads `GET /api/v1/assessment_requests/{id}/assignable_analysts` through the typed service from a Server Action when the picker opens, then on search (debounced, latest result applied, as quick find). The picker body is code-split with `next/dynamic` from the block's client trigger.

| Part | Contract |
|---|---|
| Title | `Assign {request number}` or `Reassign {request number}` (`--text-heading-sm`; visually hidden in the popover, visible in the sheet) |
| Search | `CommandInput` named `Search Security Analysts`, the same words as its placeholder |
| List | A listbox of the eligible analysts by name (`--text-body`); the current assignee is not listed; the active option is `--color-bg-inset` (X-2). Selecting an option marks it chosen (`Check`), never applies it |
| Reason | `Reason (optional)` textarea, hint `Recorded in the assignment history. Up to 500 characters.`; over 500 on the action: `Keep the reason to 500 characters or fewer.` |
| Action | `Assign to {name}` (outline, small). Never disabled: before a choice it reads `Assign to a Security Analyst`, and activating it then shows `Choose a Security Analyst first.` under the list |
| Close | `Escape`, a click outside (popover) or the sheet's visible `Close` named `Close assign`; focus returns to the trigger. Closing never loses the reason (below) |
| Kept reason and choice (no lost input, UI-D31) | The reason and the chosen analyst are kept as they are typed (debounced) in the §9.3 session store, keyed by the signed-in person and the request. Reopening the picker on that request (`Assign` or `Reassign`, after `Escape`, a click outside, `Close`, in-app navigation or a failed assign) restores the reason, with the caption `Restored from earlier in this session.` under it, and re-marks the chosen analyst when the freshly served list still holds them (otherwise no option is chosen). The kept text is cleared when the assignment succeeds and on sign-out; an `Undo` never brings it back. While a kept reason holds text, it arms the §9.3 `beforeunload` guard as the composer does |

| State | Contract |
|---|---|
| Loading | Nothing for 300ms, then four skeleton option rows (§4 Skeletons), `aria-busy` on the list |
| No one eligible | `No other Security Analyst can be assigned` · `Only active Security Analysts who didn’t raise this request can be assigned.` |
| No match | `No Security Analyst matches “{term}”` |
| Error | `We couldn’t load Security Analysts.` with `Try again` (outline, small) |
| Permission (403, or `OWN_REQUEST`) | Family K's copy (§7.4); the picker closes |

| Viewport | Contract |
|---|---|
| from 768 | A `Popover` anchored to the trigger at the §4 Dialogs confirm width, bounded by the viewport; its list scrolls inside it |
| below 768 | The X-13 full-screen sheet with the title row and `Close`; the action sits at the bottom at full width and the touch-target height |

Keyboard: focus opens in the search; arrows move, `Enter` chooses, `Tab` reaches the reason and the action; `Ctrl+Enter` or `⌘+Enter` in the reason assigns.

---

## 7. Assignment actions: optimistic, Undo, focus and refusals (D-05, D-08; X-14)

Every action goes through one Server Action on `PUT /api/v1/assessment_requests/{id}/assignee` with `expectedAnalyst` set to the assignee the page showed. It applies at once (§5 Optimistic UI): the status line, caption, row cell or card line change at the pending opacity until the server answers. No action asks for confirmation (D-05, D-34).

### 7.1 Toasts

| Action | Success toast (X-14) | `Undo` sends | After `Undo` |
|---|---|---|---|
| `Pick up` | `You picked up {request number}.` | unassign | `Pick-up undone. {request number} is back in the queue.` |
| `Assign` | `{request number} assigned to {name}.` | unassign | `Assignment undone. {request number} is back in the queue.` |
| `Assign to me` | `{request number} is now assigned to you.` | reassign to the previous analyst | `Undone. {request number} is assigned to {previous} again.` |
| `Reassign` | `{request number} reassigned to {name}.` | reassign to the previous analyst | `Undone. {request number} is assigned to {previous} again.` |
| `Return to queue` | `{request number} returned to the queue.` | assign to the previous analyst | `Undone. {request number} is assigned to {previous} again.` |

- **Undo only where the reverse is allowed** (UI-D4). On a released or closed request, a pick-up or assign has no `Undo` (unassigning is refused, D-08) and its toast adds `Reassign it if someone else should hold it.`
- **Undo is a second recorded change** and sends the new `expectedAnalyst`. A refused Undo shows family K's copy as a danger toast titled `Couldn’t undo`.
- **Failure titles:** `Request not picked up`, `Request not assigned`, `Request not reassigned`, `Request not returned to the queue`.

### 7.2 Rollback

On failure, the changed text returns to its previous value with an opacity transition at `--duration-base` (§5 Optimistic UI), then a danger toast with family K's copy and `Try again` (retryable) or `Refresh page` (blocked). `ASSIGNMENT_CHANGED` refreshes the route at once, so the page names who holds the request now, and its toast says so (§7.4).

### 7.3 Focus

| Event | Focus |
|---|---|
| `Pick up` in a queue row or card | The next `Pick up` in DOM order; when none remains, the row's request number link |
| Any action in the block, or from the picker | The block's status line |
| `Undo` succeeds | The block's status line, or the restored row's `Pick up` |
| Rollback | Stays where it is; the toast announces itself |

### 7.4 Refusal copy (new family K, added to Phase 10 §10.2 and `refusal-copy.ts`)

| Reason | Copy | Kind |
|---|---|---|
| `ASSIGNMENT_CHANGED` (with an assignee) | `{name} now holds this request, so your change wasn’t made.` | blocked (the route refreshes) |
| `ASSIGNMENT_CHANGED` (now unassigned) | `This request was returned to the queue, so your change wasn’t made.` | blocked (refreshes) |
| `ASSIGNEE_NOT_ELIGIBLE` | `{name} can’t be assigned this request. Choose another Security Analyst.` | blocked |
| `OWN_REQUEST` | `A Security Analyst can’t pick up or assign a request they raised. Another Security Analyst picks it up.` | blocked |
| `REQUEST_NOT_SUBMITTED` | `This request is a draft now, so its assignment can’t change. Refresh the page to see where it is.` | blocked |
| `ASSIGNMENT_REQUIRED` | `A released request keeps an assigned Security Analyst. Reassign it instead.` | blocked |
| 403 | `You can’t change who this request is assigned to.` | blocked |
| 404 | Phase 10's locked request refusal | blocked |
| 409, none or unknown | `This request’s assignment can’t change in its current state.` | blocked |
| Network, timeout or 5xx | `We couldn’t change the assignment. Try again.` | retryable |

---

## 8. Notes: the thread and composer (D-21 to D-25; X-16, X-17)

**Surfaces:** the Requestor's `/app/requests/{id}` and the analyst's `/app/review/requests/{id}`.
**Placement:** a `DetailSection` titled `Notes` (`h2`, region id `notes`), the last section on both pages (UI-D13). The hub's `Notes` row (§5.1) jumps to it.
**Focal point:** the newest note and the composer beneath it.

### 8.1 Section frame

| Part | Requestor | Security Analyst |
|---|---|---|
| Description | `Notes between you and the Security Analysts on this request. A Security Analyst may include a note in the information CSRM sends to the AI.` (D-25 transparency) | `Notes between the Requestor and the Security Analysts. Mark a note as changing the AI inputs to include it in AI generation.` |
| Count line (`--text-caption`, `tabular-nums`) | `{n} {note|notes}`, then ` · ` and the X-17 marker `{k} new` when above zero | the same |

### 8.2 The thread

An `ol` named `Notes on {request number}`, oldest first (D-25). Each note is an `li` holding an `article` with `id="note-{documentId}"` and `tabIndex={-1}`, so a link to `#note-{id}` scrolls to it and moves focus there.

| Part | Contract |
|---|---|
| Header line | The author's name (`--text-body` at 500), then `--text-caption` / `--color-text-secondary`: `{Requestor|Security Analyst} · {instant}` in a `<time dateTime>` |
| New marker | For an unread note (D-24's rule, served per note): the X-17 dot and `New`, at the end of the header line; it stays for this page view |
| Body | `--text-body`, `whitespace-pre-wrap`, `[overflow-wrap:anywhere]`, rendered as text only (never HTML or Markdown, never auto-linked). Beyond ten lines it clamps with `Show full note` / `Show less` (ghost, small, `aria-expanded`); the full text stays in the DOM and prints whole |
| AI mark | §10.1 (Security Analysts only) |
| No edit, no delete | No such control exists (D-21) |

**Earlier notes.** The page renders the newest 20 notes. When more exist, an outline small `Show earlier notes ({m})` sits above the list; it loads the previous 20 through a Server Action (the button shows `Loading…` with its inline 16px spinner), inserts them above without moving the viewport, and moves focus to the first inserted note. It leaves when none remain.

### 8.3 The composer (shown while the window is open, D-22)

| Part | Contract |
|---|---|
| Label | `Add a note` (`--text-body` at 500); the textarea's id is `note-composer` |
| Hint | Requestor: `You and the Security Analysts on this request can read notes. A note can’t be changed or removed once added.` Analyst: `The Requestor and every Security Analyst can read notes. A note can’t be changed or removed once added.` A requesting analyst on their own request: `You raised this request, so your note is added as its Requestor. A note can’t be changed or removed once added.` |
| Textarea | Three rows, growing with its text to twelve, then scrolling. No `maxLength` (a paste is never cut) |
| AI checkbox (analyst, not a requesting analyst) | `Changes the AI inputs`, off by default, hint `Include this note in what CSRM sends to the AI for this request.` (X-18) |
| Action | `Add note` (primary, default size), with the X-7 hint `Ctrl` `Enter` or `⌘` `Enter` after it from 768px; `aria-keyshortcuts="Control+Enter Meta+Enter"` on the textarea |
| Validation, on `Add note` | Empty after trimming: `Write a note before adding it.` Over 5,000 characters: `Keep the note to 5,000 characters or fewer. It has {n}.` (§4 Forms error) |
| Restored draft | When unsent text is restored (§9.3): caption `Restored from earlier in this session.` |

| Viewport | Contract |
|---|---|
| 1440 | The section at the content width; header line on one row; the action right-aligned under the textarea |
| 375 | Notes as stacked blocks; the header line wraps (name, then part and time); the textarea at full width; `Add note` at full width and the touch-target height; no shortcut hint |

### 8.4 When the composer is replaced (D-22)

A `--text-body` line in `--color-text-secondary` with a 16px `Lock` (`aria-hidden`) replaces the composer:

| Request | Requestor | Security Analyst |
|---|---|---|
| Never submitted (draft) | `You can add notes once you submit this request.` | not applicable (analysts don't open drafts) |
| Returned to draft (06.1) | `Notes are paused while this request is a draft. Resubmit it to add a note.` | `Notes are paused while this request is a draft.` |
| `approved` or `closed` | `Notes closed when the assessment was released. They stay here as part of the record.` | the same |

### 8.5 Empty threads

| Case | Copy |
|---|---|
| Requestor, window open | `No notes yet` · `Add a note if something about this request changes, or to answer a Security Analyst’s question.` |
| Analyst, window open | `No notes yet` · `Add a note to ask the Requestor for more information or to record what you’ve learned.` |
| Window closed, none | `No notes` (the cleared type) with the §8.4 line beneath |

The composer is the call to action in both open cases, so the empty state carries no button.

### 8.6 States

| State | Contract |
|---|---|
| Loading | The thread renders with the page. Each request page's skeleton gains a `Notes` block: a heading line, two note blocks (a header line and two body lines) and a textarea block |
| Error (the notes read failed, the page did not) | Compact `We couldn’t load the notes` with `Try again`; the composer stays, so nothing is lost |
| Not found (another Requestor, a participant, a missing request; D-23) | The request page's own not-found state; no notes surface, count or flag renders anywhere for that viewer |
| Printing | The thread prints whole with its header lines; the composer, toggles, switches and `Show earlier notes` do not (`data-print="hidden"`) |

---

## 9. Notes: posting, read state and no lost input (D-24, D-25)

### 9.1 Posting

- **Optimistic, with an honest pending state** (UI-D16). On `Add note`, the note appears at once at the end of the thread at the §5 pending opacity, with `Adding…` in place of its time; the textarea clears and keeps focus. On success, it takes the server's time and full opacity, and a polite status (visually hidden) says `Note added.` No toast: the note itself is the confirmation, and a note can't be undone (D-21).
- **Rollback.** On failure, the pending note is removed with the `--duration-base` opacity transition, its text returns to the textarea with the cursor at the end, and the field shows family L's copy as its error (retryable failures add `Try again` beside `Add note`). Validation errors (400) show under the field and post nothing.
- **One in flight.** `Add note` is not re-entrant: a second press while one is pending does nothing.

### 9.2 Marking read

The web calls `POST …/notes/read` through the newest loaded note once per page view, when the first unread note enters the viewport (UI-D15). Its result changes nothing visible: the `New` markers and the hub's `{k} new` stay for this view (D-24), and the sidebar, queue and Home flags update on their next server render. A failed call is silent and the next view tries again.

### 9.3 Unsent text (no lost input)

- **Kept for the browser session** in `sessionStorage`, keyed by the signed-in person and the request, written as the person types (debounced) and cleared when the note is added (UI-D17). Signing out clears every stored note draft.
- **Restored** into the composer on return, with `Restored from earlier in this session.`
- **The guard** (Phase 10's navigation guard) arms the browser's `beforeunload` prompt while the composer holds unsent text, or the assign picker's kept reason holds text (§6), because closing the tab is the only way the text is lost. In-app navigation keeps the text, so it shows no blocking dialog (UI-D18).

### 9.4 Notes closed with unsent text

If the window closed (D-22) while text was unsent (a `NOTES_CLOSED` refusal, or a restored draft on a closed request), the §8.4 line shows, followed by the text in a read-only well on `--color-bg-inset` with `Copy text` and `Discard text` (ghost, small). `Copy text` confirms with a success toast `Note text copied.`. `Discard text` removes the well and the stored draft at once and confirms with an Undo toast (X-14) `Note text discarded.`; its `Undo` puts the text back in the well and the session store, then shows `Note text restored.` (UI-D19). Focus moves to the §8.4 line (`tabIndex={-1}`) on discard, and to the well's `Copy text` after `Undo`. When the toast leaves without `Undo`, the text is gone.

### 9.5 Refusal copy (new family L)

| Reason | Copy | Kind |
|---|---|---|
| `NOTES_CLOSED` | `Notes are closed on this request now, so your note wasn’t added. Your text is kept below.` | blocked (§9.4) |
| `NOTES_LIMIT_REACHED` (added on 2026-10-01 during planning, plan 13-05) | `This request has reached its limit of 500 notes, so your note wasn’t added.` | blocked (a field error; the text stays in the composer) |
| 400 (length or empty) | §8.3's validation copy | field |
| 404 | The request page's not-found state on refresh | blocked |
| 403 | `You can’t add notes to this request.` | blocked |
| Network, timeout or 5xx | `We couldn’t add your note. Try again.` | retryable |
| Loading earlier notes fails | `We couldn’t load earlier notes.` with `Try again` in place of the button | retryable |

---

## 10. The AI inputs (D-26 to D-29; X-18)

### 10.1 The mark on a note (Security Analysts only)

| Viewer | Contract |
|---|---|
| A human Security Analyst who did not raise the request | Below the body: a `Switch` labelled `Changes the AI inputs` (accessible name from its label; described by the note's header line). It applies at once with an Undo toast (§10.4) |
| A requesting analyst on their own request (D-07) | No switch. A marked note shows the X-11 note `Changes the AI inputs` (`Sparkles`) when the server serves the mark |
| The Requestor | Nothing: no switch, no note, no mark (D-26) |

### 10.2 "AI inputs changed" (the signal)

Rendered on the server from the served signal, analysts only, wherever the target's generation is shown. Absent when the server serves none (no baseline, D-29).

| Surface | Placement |
|---|---|
| The questionnaire review page and the assessment editor | The last block of Phase 12's provenance header (12 §1), after line 3 |
| The hub | The questionnaire card (questionnaire target) and the draft card (assessment target), above the card's idle action or state line |

| Part | Contract |
|---|---|
| Heading line (`--text-body` at 500, `Sparkles` 16px `aria-hidden`) | `AI inputs changed since this {questionnaire|draft} was generated` |
| List (`ul`, named by the heading) | One item per changed note: a record link `{Requestor|Security Analyst} note · {instant}` → `/app/review/requests/{id}#note-{noteId}`, then a caption `Marked since` or `Unmarked since` |
| Caption | `The AI hasn’t seen these changes.` |
| Action | None in this phase (Phases 15 and 16 attach theirs) |

| Viewport | Contract |
|---|---|
| 1440 | In the provenance header or the card at their width; each list item on one line (the link, then its caption after ` · `) |
| 375 | The heading wraps beside its icon; the list stacks, one item per block: the note link at full width on its own line, wrapping anywhere, then its caption beneath; the closing caption last. No horizontal scroll |

### 10.3 "What the AI used" gains `Notes` (12 §2.2)

A group after `Request`: `{n} {note|notes} included`, then one row per included note: `{Requestor|Security Analyst} note · {instant} · {characters} characters`, the first part a record link to the note in the thread (the sheet closes, then the route navigates). With none: `None included`. Earlier runs read `None included` (D-28). The note's text is never shown in the sheet (G-3).

### 10.4 Toasts and refusals (new family M)

| Action | Success toast (X-14) | After `Undo` | Failure title |
|---|---|---|---|
| Switch on | `Note marked as changing the AI inputs.` | `Mark removed.` | `Mark not changed` |
| Switch off | `Note no longer marked as changing the AI inputs.` | `Mark restored.` | `Mark not changed` |

The switch flips at once at the pending opacity and rolls back on failure. Focus stays on the switch throughout.

| Reason | Copy | Kind |
|---|---|---|
| `OWN_REQUEST` | `A Security Analyst can’t change the AI inputs of a request they raised.` | blocked |
| 403 | `You can’t change the AI inputs on this request.` | blocked |
| 404 | `This note is no longer available. Refresh the page.` | blocked |
| 409 (`NOTES_CLOSED`, `HISTORY_UNAVAILABLE` or unknown; added on 2026-10-01 during planning, plan 13-06) | `This note’s mark can’t change now. Refresh the page.` | blocked |
| Network, timeout or 5xx | `We couldn’t change the mark. Try again.` | retryable |

---

## 11. The analyst questionnaire and assessment pages (D-16, D-25; route budget)

`AssessmentRequestLink` (the originating-request block on `/app/review/questionnaires/{id}` and `/app/review/assessments/{id}`) gains two server-rendered lines after the link, in `--text-caption` / `--color-text-secondary`:

| Line | Copy |
|---|---|
| Assignee | `Assigned to {name}`, or `Not picked up` followed by ` · ` and the link `Pick up on the request page` → `/app/review/requests/{id}#assignment` when the viewer may |
| Notes | A figure link `{n} {note|notes}` with the X-17 `{k} new` → `/app/review/requests/{id}#notes`; with none, `No notes` (plain) |

| Viewport | Contract |
|---|---|
| 1440 | Both lines under the request link in the block's existing column |
| 375 | Each line wraps at full width under the link: the assignee line, then `Pick up on the request page` on its own line when offered (its link text wraps, never truncates), then the notes line; no horizontal scroll |

No composer, no picker and no client component are added to these routes (D-34): the editor's first-load JavaScript is unchanged. The AI-inputs signal is §10.2.

---

## 12. The Requestor's surfaces (D-17, D-24; Phase 11 §5.2, §6.1, §7.3)

### 12.1 Holder sentences (`request-lifecycle.ts`, Requestor viewer)

| Step | Assigned | Not picked up |
|---|---|---|
| `submitted` | `{name} is reviewing your request and will send you a questionnaire to answer.` | `Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.` |
| `questionnaire-generated` | `{name} is checking your questionnaire before sending it to you.` | `A Security Analyst is checking your questionnaire before sending it to you.` |
| `questionnaire-submitted` | `{name} is reviewing your answers to assess the request’s risk.` | `A Security Analyst is reviewing your answers to assess the request’s risk.` |
| `assessment-drafted` | `{name} is preparing your risk assessment.` | `A Security Analyst is preparing your risk assessment.` |
| `assessment-reviewed` | `{name} is finalising your risk assessment before releasing it to you.` | `A Security Analyst is finalising your risk assessment before releasing it to you.` |

The other steps and every analyst-facing sentence are Phase 11's, unchanged; `holder` keeps its meaning.

### 12.2 Request page

§5.1's rows (`Security Analyst`: name or `Not picked up yet`) and §8's `Notes` section. No assignment block, history or picker.

### 12.3 Home (Requestor)

| Element | Contract |
|---|---|
| New-notes row (new) | Directly under the page header, only when the status summary's unread count is above zero: a Phase 7 link row card (X-10 block link) with `MessageSquareDot` 16px, `New notes on {n} {request|requests}` (`--text-body` at 500) and `ChevronRight` → `/app/requests?notes=unread`. Not rendered at zero (UI-D25) |
| Items in `Needs your action` and `With the Security Analyst` | Line 2 gains ` · Assigned to {name}` when assigned. Below the item's last line, the X-17 marker `{k} new {note|notes}`, a link to `/app/requests/{id}#notes` named `{k} new {note|notes} on {request number}` |

| Viewport | Contract |
|---|---|
| 1440 | The row spans the content width above Phase 11's two-column grid |
| 375 | The row at full width above `Needs your action`, which still starts within the first screen |

### 12.4 My requests (`/app/requests`)

| Change | Contract |
|---|---|
| Column `Security Analyst` (after `Status`) | The name, or `Not picked up yet` (`--color-text-secondary`) |
| Unread line | Under the title, as §2.2, linking to `/app/requests/{id}#notes` |
| Filter `Notes` | `All requests` / `With new notes`; chip `Notes: New notes`; `Clear filters` clears it |
| Mobile card | After the holder line: `Security Analyst: {name}` or `Not picked up yet`, then the unread line |

The analyst's `Your own requests` panel and `My requests` route are these same surfaces.

---

## 13. Generation jobs any analyst can follow (D-18; Phase 10 §12)

| Phase 10 string | Phase 13 |
|---|---|
| `Started by another Security Analyst.` | `Started by {name}.` (whenever the initiator is not the viewer; queued, running or failed) |
| `Only the Security Analyst who started it can retry it.` | Retired: `canRetry` now means "failed, and you may retry". A failed job offers `Retry questionnaire generation` or `Retry draft generation` to every analyst on the request |
| After a retry by the viewer | The card shows the new attempt as the viewer's own (no `Started by`) |

Polling, the `Attempt {n}` tag and the announcements are unchanged.

---

## 14. Five-state contract

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| Sidebar counts | absent until settled | no count at zero | no count | analyst profile only | `Assigned to me`, changed `Requests` |
| Assigned to me | nine-column skeleton | cleared copy (§2.1) | the route's locked error | the route's permission state | view, queue default, notes filter |
| Requests queue | ten-column skeleton | locked patterns | unchanged | unchanged | column, `Pick up`, filters, `All open` |
| Analyst Home | Phase 11 skeletons | zero rows render as data | widget compact error | unchanged | tile 1, `Assigned to you` group, `Waiting for pick-up` |
| Assignment block | with the page | `Not picked up` | rollback and family K | no action offered; refusal copy | four holder states, draft, own request, legacy released |
| Assign picker | skeleton after 300ms | no one eligible; no match | `We couldn’t load Security Analysts.` | family K | chosen option, reason, restored reason and choice |
| Notes | page skeleton block; earlier notes button spinner | §8.5 | §8.6, family L | not-found state | new markers, pending note, clamp, closed lines, unsent well |
| AI mark and signal | with the page | signal absent | rollback and family M | no switch for the Requestor or a requesting analyst | marked, changed list, sheet group |
| Requestor Home and My requests | Phase 11 skeletons | row absent at zero | Phase 11 errors | unchanged | names, markers, notes filter |
| Job cards | unchanged | unchanged | unchanged | unchanged | `Started by {name}`, retry for all |

---

## 15. The premium experience bar (G-4), item by item

| G-4 item | Phase 13 contract |
|---|---|
| A keyboard path for every primary action | `Pick up`, the block's actions, the picker (search, arrows, `Enter`, reason, `Ctrl`/`⌘`+`Enter`), `Add note` and its shortcut, the AI switch (`Space`), the toggles and every figure link are buttons or links in DOM order; `Undo` by `Alt+T` (X-14) |
| Optimistic feedback that rolls back on error | Assignment (§7), posting (§9.1) and the AI mark (§10.4) apply at once and roll back with the direction's timing |
| Skeletons while loading | Picker list, the queues, page skeleton notes block; spinners only inside `Show earlier notes` |
| Undo for reversible actions; confirmation for governance steps | Every assignment change, AI mark and `Discard text` (§9.4) carries `Undo`; none confirms (D-34). Posting is append-only and says so before it happens (§8.3) |
| Empty states that say what to do next | §2.1, §6, §8.4, §8.5; the hub's `Add a note` link |
| No lost input | Session-kept composer text, rollback restoring text, the `beforeunload` guard, the read-only well when notes close, whose `Discard text` is undoable (§9.3, §9.4); the picker's reason and choice are kept in the session store and restored on reopen after `Escape`, a click outside, `Close`, navigation or a failed assign, and arm the `beforeunload` guard (§6, UI-D31) |
| Comfortable and compact density | Both queues keep the density toggle; `Pick up` meets the 24px minimum in compact rows |
| Motion from the direction | Motion section; reduced motion honoured |
| Purpose-built phone layouts | Queue cards with full-width `Pick up`; the full-screen picker sheet; stacked assignment actions; note blocks and a 375px composer |
| Every figure opens its records | Tile 1, the `Review queue` rows, the hub's `Notes` figure, unread markers, the Requestor's new-notes row, `AssessmentRequestLink`'s lines, the signal's note links. Sidebar counts follow Phase 11 §1.3 (UI-D7) |

---

## 16. Test assertions this contract changes

Each plan greps its strings before editing and changes these deliberately in the plan that changes the behaviour (D-32). Line numbers are today's; Phases 10 to 12 edit several of these files first.

| # | File:line | Asserts today | Change |
|---|---|---|---|
| E1 | `e2e/analyst-insights.spec.ts:479-487` | The `Requires my attention` tile equals the default review queue | `Needs your action` equals `/app/review/assigned?queue=requires-attention` |
| E2 | Phase 11's `navigation-and-home.spec.ts` (planned) | `Requests` count equals its list; analyst items | Adds `Assigned to me`; the `Requests` name `waiting for pick-up` |
| E3 | Phase 11's `quick-find.spec.ts` (planned) | Line 2 status only | Analyst request options carry the assignee |
| U1 | `analyst-dashboard-presentation.test.ts:87, 233`; `analyst-dashboard.test.tsx:205, 238` | `Requires my attention` | §3 tile and rows |
| U2 | `assessment-list.test.tsx:159` (and Phase 11's queue tests) | `Queue: Requires my attention` | `Queue: Requires attention`; the new column, filters and `All open` |
| U3 | `request-hub.test.tsx` (Phase 11's fixtures) | `Owner` row | `Requestor`; `Assigned to` / `Security Analyst`; `Notes` |
| U4 | `questionnaire-generation-job.test.tsx`; the draft-card cases in `assessment-review-workflow.test.tsx` | `Started by another Security Analyst.`; `Only the Security Analyst who started it can retry it.` | §13 |
| U5 | `kpi-tile.test.tsx:50, 55, 125` | A fixture caption `Requires my attention` | Stays: a generic fixture, not product copy |
| New | `e2e/request-pick-up.spec.ts`, `e2e/request-notes.spec.ts` (names the planner's) | — | D-32's journeys at 375 and 1440 with axe, including the Secondary Requestor's not-found state and the second analyst following a job |

Phase 10's copy guard (10 §17.2) scans the new `request-assignment` and `request-notes` files; a unit test asserts no assignment or notes string contains `Accept`, and no assignment string contains `release`.

---

## 17. Development sign-in

The development role switcher (`role-switcher.tsx`, `developmentRoles`) gains `Second Security Analyst` after `Security Analyst` (D-31; UI-D26). The header's role tag shows it like the others; at 375px the header fits it (Phase 11 UI-D10 measured `Secondary Requestor`; see the backstop below).

---

## Copywriting contract

| Element | Copy |
|---|---|
| Primary CTAs | `Add note` (new). Phase 10 to 12 primaries unchanged |
| Other calls to action | `Pick up`, `Assign`, `Assign to me`, `Reassign`, `Return to queue`, `Assign to {name}` (before a choice `Assign to a Security Analyst`), `Undo`, `Show assignment history ({n})` / `Hide assignment history`, `Show earlier notes ({m})`, `Show full note` / `Show less`, `Copy text`, `Discard text`, `Add a note` (hub link), `Pick up on the request page`, `Try again`, `Refresh page` |
| Navigation and headings | `Assigned to me`; sections `Assignment`, `Notes`; group `Assigned to you` |
| States | `Assigned to {name}`, `Not picked up`, `Not picked up yet`, `New`, `{k} new {note|notes}`, `Changes the AI inputs`, `AI inputs changed since this {questionnaire|draft} was generated` |
| Empty states | `No open requests assigned to you`; `No notes yet` (two descriptions); `No notes`; `No other Security Analyst can be assigned`; `No Security Analyst matches “{term}”`; `None included` |
| Error states | `We couldn’t load the notes`, `We couldn’t load earlier notes.`, `We couldn’t load Security Analysts.`, each with `Try again`; families K, L and M |
| Permission states | The request page's not-found state for notes (D-23); family K's and M's 403 copy |
| Toasts | §7.1, §9.4, §10.4, word for word |
| Destructive confirmations | None. Every assignment change, mark and `Discard text` is reversible with `Undo` (`Note text discarded.` / `Note text restored.`); posting states its permanence in the composer hint |
| AI output | The mark and signal describe inputs only; nothing here generates, accepts or releases anything |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 Info and relationships | `Assignment` and `Notes` are headed sections; the thread is an ordered list of articles; history is a named list; the signal's list is named by its heading; the picker is a dialog with a listbox |
| 1.4.1 Use of colour | Unread is an icon or dot plus words in ink; the AI mark is a labelled switch; parts are words |
| 2.1.1 Keyboard | §15 first row |
| 2.2.1 Timing adjustable | Undo toasts pause on hover and focus (X-14); every change can still be made again on the page |
| 2.4.3 Focus order | §6, §7.3, §8.2 (earlier notes), §9.1 (focus stays in the composer) |
| 2.4.6 Headings | Request pages: h1 the request, h2 `Assignment` and `Notes`; the picker's title is its dialog heading |
| 2.5.3 Label in name | `Pick up {request number}`, `Return {request number} to the queue`, `Changes the AI inputs`, `{n} new notes on {request number}` each begin with the visible words |
| 2.5.8 Target size | Row `Pick up`, toggles and the switch meet 24px; phone actions meet the touch-target height |
| 3.3.1, 3.3.3 Errors | Composer and reason errors say what's wrong and how to fix it, below the field |
| 4.1.2 Name, role, value | `aria-expanded` and `aria-controls` on the toggles; `aria-haspopup="dialog"` and `aria-expanded` on `Assign` and `Reassign`; the switch's checked state; `aria-keyshortcuts` on the composer |
| 4.1.3 Status messages | Toasts (polite; danger once); `Note added.` once; marking read and count changes are silent |
| 1.4.10 Reflow | No horizontal page scroll from 320 to 1440; notes wrap anywhere |
| Automated | Zero serious or critical axe violations at 375 and 1440 on Assigned to me, Requests with the new column, both request pages with notes (populated, closed, unsent well), the picker open, and the analyst Home |

---

## Spacing

The §3.9 scale applies unchanged; this phase adds no spacing value.

| §3.9 step | Use in this phase |
|---|---|
| 4px | Icon-to-text gaps in the unread marker and notes; between a note's header line and its body |
| 8px | Between the assignment status line, caption and actions; between the composer's field, hint and action |
| 16px | Block padding of each note and each history event; between the thread and the composer |
| 24px | Between page sections (section rhythm, as today) |

Existing primitives keep their shipped spacing (DataTable, Popover, Sheet, toasts, `DetailSection`). Exceptions: none.

---

## Typography

The §3.10 scale applies unchanged; this phase adds no size, weight or family.

| Emphasis level | Token | Weight | Phase 13 use |
|---|---|---|---|
| 1. Panel title | `--text-heading-sm` | its own heading weight | `Assignment`, `Notes`, the picker's title, empty-state headlines |
| 2. Body | `--text-body` | 400; 500 for the status line, note authors, the signal heading and the new-notes row | Note bodies, history sentences, closed lines |
| 3. Caption | `--text-caption` | 400; 500 for the unread marker | Times, parts, assignment captions, quick-find line 2 |
| 4. Micro-label | `--text-micro` | 400 | Sidebar count, filter chips, X-7 keys |

Table cells keep `--text-table`; buttons `--text-button`. The checker's two-weight heuristic is superseded by the adopted scale (ADR 0001 gap 8), as in Phases 06.5 to 12. `tabular-nums` on every count.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas, sections, notes, picker, sheet |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-border-strong`, `--color-text-secondary` | Unsent well, active option, hairlines, field and switch boundaries, captions |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--focus-ring` | Only as listed below |
| Status (§3.5) | danger (rollback toasts), success (Undo toasts' icon) | Always with an icon and words |
| Destructive | `--color-danger-solid` | None added |

Ink is reserved for: the `Add note` primary button; the switch's and checkbox's checked fill (§4 Forms); record and figure links (note links, the hub's `Notes` figure, unread markers, the Requestor's new-notes row); the unread marker's dot and text (X-17); focus rings. `Pick up`, the block's actions, `Assign to {name}`, the toggles and `Show earlier notes` are outline; `Show full note`, `Copy text` and `Discard text` are ghost. No new hue; unread and AI are never given a colour.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Picker popover | §5 "Dropdown / popover / menu"; the phone sheet as §5 "Drawer / side panel"; fade only under reduced motion |
| Toasts | §5 "Dialog / toast" |
| Optimistic pending (assignment, pending note, switch) | The §5 Optimistic UI pending opacity, applied with no transition |
| Rollback | Opacity at `--duration-base`, `--ease-standard` |
| Switch | §5 "Button / toggle / checkbox state" |
| New, earlier and restored notes; toggles; clamp | None: they render in place (§6 do-not 8) |
| Skeleton shimmer | §4 Skeletons; static under reduced motion |

Nothing polls or auto-refreshes; the notes thread updates on the person's own actions and page loads only. Reduced motion needs no rule beyond the global one.

---

## Proposed CSRM extensions

For the orchestrator to accept, and a Phase 13 plan task to record in `docs/design/csrm-design-direction.md` before the implementing tasks run. None introduces a value; each names a pattern over existing tokens. Numbering continues after Phase 12's X-14 (UI-D28).

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-15 | §4, new "Assignee control" entry | The assignment block, picker, row pick-up and history | "**Assignee control (CSRM extension, 2026-10-01).** A record with one accountable person shows who holds it in an assignment block: `Assigned to {name}`, or `Not picked up`, in `--text-body` at 500, then who assigned them and when, or who may pick it up, in `--text-caption` / `--color-text-secondary`, then only the actions the server allows this viewer, as outline small pills that stack at full width and the touch-target height below 768px. Taking or giving back the record (`Pick up`, `Assign to me`, `Return to queue`) applies at once and confirms with an Undo toast. Choosing someone else opens a picker that lists only the people who may hold the record: from 768px a popover at the confirm dialog width holding the record picker's search and listbox, an optional reason and an `Assign to {name}` action; below 768px the full-screen side sheet. Choosing a person never applies on its own. In a list, the holder is a column of names; an unheld row offers `Pick up` as an outline small pill to a viewer who may take it, and otherwise reads `Not picked up`. A viewer who may not act sees why in words, never a disabled control. The history sits behind an outline toggle, newest first, one sentence per change naming who, whom and when, with any reason quoted." | D-16 and D-34 ask for a recorded assignee control; the direction has a record picker for form fields but nothing for an accountable holder. |
| X-16 | §4, new "Notes thread" entry | The thread and composer | "**Notes thread (CSRM extension, 2026-10-01).** An append-only conversation on a record is a section headed `Notes`: an ordered list, oldest first, of notes separated by `--color-border-default` hairlines with 16px block padding, with no bubbles, avatars or colour per author. Each note starts with the author's name in `--text-body` at 500, then their part in words and the posting time (Dates and times) in `--text-caption` / `--color-text-secondary`; its body is `--text-body` with line breaks kept, never rendered as HTML or Markdown and never auto-linked, clamped to ten lines with a `Show full note` toggle and printed whole. Earlier notes load above the list through an outline `Show earlier notes` button. The composer follows the newest note: a labelled textarea, three rows tall and growing with its text, a hint that says who reads notes and that a note can't be changed once added, and the add action with its keyboard shortcut hint (`Ctrl` or `⌘` with `Enter`). A note being added shows at once at the §5 pending opacity with `Adding…`; a failure removes it and returns its text to the composer. Unsent text survives navigation for the browser session. Where notes are closed, one `--text-body` line in `--color-text-secondary` with a 16px `Lock` says why in place of the composer, and any unsent text stays readable and copyable." | D-25 and D-34 need a thread; the direction has no conversation pattern. Phase 17.2's contest replies reuse it. |
| X-17 | §4 Status & risk badges, new "Unread" entry | The unread marker | "**Unread (CSRM extension, 2026-10-01).** Something new to the viewer, such as a note they haven't seen, is marked in ink, never in a status hue, because unread is a personal fact and not a status: on a count, a 12px `MessageSquareDot` and `{n} new {noun}`; on one item, an 8px `--color-text-primary` dot with `--radius-full` and `New`; the text is `--text-caption` at 500 in `--color-text-primary`. A count of new items is a figure link to them, and a list that can hold unread items offers a filter for them. The marker stays for the view in which the items were first shown and clears on the next." | D-24 shows unread on six surfaces; the tone vocabulary has no meaning for "new to you", and a status badge would misstate it. |
| X-18 | §4 Status & risk badges, after "AI provenance" | The AI input mark and the "AI inputs changed" signal | "**AI input mark (CSRM extension, 2026-10-01).** Supplementary text that a Security Analyst opts into what CSRM sends to the AI carries the §4 Forms switch labelled `Changes the AI inputs`, which applies at once with an Undo toast; when the text is created, the same choice is a checkbox, off by default. A Security Analyst who may not change it sees the provenance note `Changes the AI inputs` (`Sparkles`) instead; a Requestor sees neither. When the marked set differs from what a record's latest generation used, the record's provenance header, and the card that generates it, add `AI inputs changed since this {record} was generated` in `--text-body` at 500 beside a 16px `Sparkles`, then a list of the changed items as record links, each with `Marked since` or `Unmarked since` in `--text-caption`, then `The AI hasn’t seen these changes.` The signal offers no action of its own." | D-26 and D-29 add an analyst-owned opt-in and a staleness signal that Phases 14 to 16 reuse for files and re-runs. |

---

## Decisions recorded

Made without asking, as this phase's discussion and UI contract run in auto mode. Each follows the locked context, `AGENTS.md`, the glossary and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | Unassigning is `Return to queue`; its history sentence is `Returned to the queue by {actor}`. | D-05 forbids "release"; the label says where the request goes and pairs with `Pick up`. |
| UI-D2 | Labels follow the holder: `Pick up` and `Assign` when unassigned; `Assign to me`, `Reassign` and `Return to queue` when held. The server derives the action. | One verb per intent; "reassign to yourself" (D-05) reads naturally as `Assign to me`. |
| UI-D3 | `Pick up`, `Assign to me` and `Return to queue` are one step with Undo; `Assign` and `Reassign` open the picker with an optional reason. | A reason matters when handing work to someone else; taking or returning work should be instant (G-4). |
| UI-D4 | Undo is offered only when the reverse action is allowed, so a pick-up after release has none and says how to correct it. | D-08 refuses unassigning a released request; an Undo that always fails would mislead. |
| UI-D5 | The picker is a popover from 768px and the X-13 full-screen sheet below; choosing a person never applies on its own. | D-16 asks for a sheet on phones; the explicit `Assign to {name}` lets the reason be added and prevents a mis-tap from assigning. |
| UI-D6 | The view's route is `/app/review/assigned`; its heading equals its nav label. | D-14 asks for its own route; a sibling of `/app/review/requests` avoids a static segment beside `[documentId]`. |
| UI-D7 | The sidebar counts keep Phase 11 §1.3's rule (the item opens its page); the analyst Home carries the equal-list figures. `Requests` is named `waiting for pick-up`. | Phase 11's approved precedent; the Home rows open exactly the counted lists (G-4). |
| UI-D8 | The analyst Home keeps four tiles; tile 1 becomes `Needs your action`; the pool and new notes are rows in a new first `Assigned to you` group and the team group. | KPI discipline (~4 tiles) and Phase 11 UI-D20's first-screen rule at 375; every D-15 figure still leads the page and opens its list. |
| UI-D9 | `requires-attention` reads `Requires attention` everywhere. | D-13 drops "my"; the value is unchanged. |
| UI-D10 | The `open` bucket reads `All open` and is Assigned to me's default queue. | D-14's view is the viewer's open work; the label contrasts with `All requests`. |
| UI-D11 | The queue's `Assigned to` column holds `Pick up` inline; rows stay non-block. | D-16 picks up from the row; the DataTable rows hold record links, so a row button is reachable and unambiguous. |
| UI-D12 | Unread is ink and weight (X-17), never a status badge. | The tone vocabulary means work states; "new to you" is personal (D-24) and must not read as a status. |
| UI-D13 | `Notes` is the last section on both request pages, reached from the hub's `Notes` figure. | The composer belongs at the end of the conversation; the existing order (and its tests) stays, and the figure link removes the scroll cost. |
| UI-D14 | The thread shows the newest 20 notes and loads earlier ones above in twenties. | D-25 bounds the thread; recent context first without losing oldest-first reading order. |
| UI-D15 | Marking read happens once per view when the first unread note enters the viewport; failures are silent. | D-24's "once the thread has been shown"; a note scrolled past unseen should stay new. |
| UI-D16 | Posting is optimistic with an explicit `Adding…` pending state and no toast or Undo. | D-25 locks optimistic posting; the pending state never claims the note is added, which keeps the direction's rule that irreversible operations don't pretend to succeed. D-21 makes notes append-only, so the composer states permanence before posting. |
| UI-D17 | Unsent text is kept in `sessionStorage` per person and request and cleared on sign-out. | D-25's "kept for the browser session"; per-person keys and sign-out clearing protect a shared browser. |
| UI-D18 | The guard arms `beforeunload` only; in-app navigation keeps the text without a dialog. | D-25's guard "warns before it is lost": in-app navigation no longer loses it, so a blocking dialog would only interrupt. |
| UI-D19 | When notes close with unsent text, it stays in a read-only well with `Copy text` and `Discard text`; discarding confirms with an Undo toast. | No lost input even when posting becomes impossible (D-22); the phase's only clearing control stays reversible (G-4). |
| UI-D20 | The AI mark is a per-note switch for analysts and a checkbox in the composer. | Decision 2's opt-in pattern; a switch shows state and control in one and applies at once (§5 Optimistic UI's toggle). |
| UI-D21 | The "AI inputs changed" signal sits in Phase 12's provenance header and in the hub's generation cards. | D-29 puts it on the hub, governance page and editor; the header is where those pages already say what the AI used. |
| UI-D22 | Long notes clamp at ten lines with `Show full note`. | A 5,000-character note would dominate a phone screen; the full text stays in the DOM and in print. |
| UI-D23 | Notes have no bubbles, avatars, alignment or colour by author; the part is a word. | §1 thesis (structure from hairlines, no hue); the record reads as an audit trail, not a chat. |
| UI-D24 | The hub reads `Requestor` (was `Owner`), with `Assigned to` for analysts and `Security Analyst` for the Requestor. | Phase 10 UI-D30 deferred the naming here; each actor reads the role that matters to them. |
| UI-D25 | The Requestor Home shows a new-notes row only when the count is above zero. | D-24's Home flag with an equal list (X-10); a zero row would be noise on the Requestor's calm Home. |
| UI-D26 | The second persona's sign-in label is `Second Security Analyst`. | Parallel to `Secondary Requestor`; the persona's name and email stay the planner's (D-31). |
| UI-D27 | The assignment history is newest first, behind a toggle. | It is an audit trail read for the latest change; collapsed by default keeps the block short. |
| UI-D28 | Extensions are numbered X-15 to X-18. | They continue Phase 12's X-14 (STATE.md Decisions; the spawn prompt). |
| UI-D29 | No string uses `Accept`; assignment has no acceptance step. | G-14 reserves Accept for the risk owner (Phase 12 UI-D1). |
| UI-D30 | The Requests description becomes `Submitted requests across the team. Pick up a request to make it yours.` | The page's role changes from "my work" to the team queue (D-14). |
| UI-D31 | The assign picker's reason and chosen analyst are kept in the §9.3 session store per person and request, restored when the picker reopens, cleared on a successful assignment and on sign-out, and arm the same `beforeunload` guard while the reason holds text. Every way of closing the picker stays available. | G-4 no lost input: a stray click outside, `Escape` or navigation must not discard a typed reason. Reusing UI-D17's store and UI-D18's guard adds no mechanism, and keeping the click-outside close avoids a popover that refuses to dismiss. |

---

## Notes carried

- **For the orchestrator.** Confirm UI-D7 (sidebar counts open their page, as Phase 11 §1.3; the equal lists are on Home) and UI-D18 (the leave guard arms `beforeunload` only, because session-kept text survives in-app navigation). Both are readings of locked wording ("every figure opens its records"; D-25's guard).
- **Phase 11 strings superseded.** §1, §2.2, §3 and §5.1 replace Phase 11 copy (`Requires my attention`, the `Requests` count name, the queue description, the hub's `Owner`). Phase 11's plans need no change; this phase's plans own the assertions (§16).
- **Phase 12 surfaces extended.** §10.2 adds a block to the provenance header and §10.3 a group to the sheet; Phase 12 UI-D17 anticipated both.
- **Route budget.** The assessment editor gains only server-rendered lines (§10.2, §11); `performance.spec.ts` stays green. The picker loads with `next/dynamic`.
- **Later phases.** Phase 17.1's `REQUEST_UNASSIGNED` and `NOT_ASSIGNED_ANALYST` refusals join family K with copy that offers `Pick up` or names the holder. Phase 17's notification centre links to `#note-{id}`. Phase 14 adds files to the X-18 signal and may attach files to a note. Phase 17.2's contest replies reuse X-16 without the AI mark. Phase 19's queue export carries the `Assigned to` column and never a note.
- **Copy guard.** Phase 10's guard gains the two new feature folders; the `Accept` and `release` assertions of §16 are a unit test, not guard terms, because "released" is legitimate state wording.

---

## UI Considerations

These rows are written inline from the contract. The ui-phase consideration probe (Step 9.5) replaces them when it runs.

Applicable state considerations resolved: 27 covered, 3 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| empty | Assigned to me | covered | Cleared copy naming where requests waiting for pick-up are (§2.1); filtered-empty with `Clear filters` |
| empty | Notes thread | covered | Open and closed variants (§8.4, §8.5); the hub link `Add a note` |
| empty | Picker | covered | No one eligible; no match (§6) |
| empty | Signal; sheet group | covered | Signal absent without a baseline; `None included` (§10.2, §10.3) |
| empty | Counts and Home rows | covered | Sidebar shows nothing at zero; Home rows render zero as data; Requestor new-notes row absent at zero |
| loading | Picker; earlier notes | covered | Skeleton after 300ms; inline spinner in the button (§6, §8.2) |
| loading | Pages | covered | Queue skeletons with the new column count; the notes skeleton block (§8.6, §14) |
| error | Assignment; notes; mark | covered | Rollback and families K, L, M with `Try again` or `Refresh page` (§7, §9, §10) |
| error | Notes read; picker read | covered | Compact error with `Try again`; the composer stays (§8.6, §6) |
| error | Mark read | covered | Silent; retried on the next view (§9.2) |
| error | Malformed assignment log | covered | No history toggle (fail safe, §5.3) |
| permission | Another Requestor; participants | covered | The request page's not-found state; no notes, counts or flags (§8.6) |
| permission | Requestor; requesting analyst | covered | No assignment control, no switch, a line saying why (§5.2, §10.1) |
| populated | Every surface | covered | §1 to §13 |
| partial | Assignment states | covered | Held by viewer, by another, unassigned, draft, released, legacy released (§5.2) |
| partial | Notes | covered | Pending, unread, clamped, closed with unsent text (§8, §9) |
| partial | Jobs | covered | `Started by {name}`; retry for every analyst (§13) |
| overflow | Queue | covered | Labelled scroll region with the sticky identifier column; cards below 768px (§2.2) |
| overflow | Picker list | covered | Scrolls inside the popover or sheet (§6) |
| overflow | Thread | covered | Bounded to 20 with `Show earlier notes`; bodies clamp at ten lines (§8.2) |
| overflow | Assignment actions | covered | Wrap beneath the status at 1440, stack at 375 (§5.2) |
| overflow | Header with the second persona | backstop | `{ statement: "At 375px the header shows Menu, the search icon and the role tag 'Second Security Analyst' without horizontal scroll", verification: backstop }` |
| long-text | Note bodies | covered | `whitespace-pre-wrap`, wrap anywhere, ten-line clamp, print whole (§8.2) |
| long-text | Names in toasts and history | backstop | `{ statement: "A toast or history sentence naming two long display names wraps at 375px and the toast's Undo stays visible and reachable", verification: backstop }` |
| long-text | Reasons | covered | Quoted on their own caption line with `whitespace-pre-wrap` (§5.3) |
| long-text | Composer at 375 | backstop | `{ statement: "At 375px the composer, its hint and Add note fit without horizontal scroll, and the textarea grows to twelve rows then scrolls inside itself", verification: backstop }` |
| zero-one-many | Counts and markers | covered | `{n} new {note|notes}`, `{request|requests}`, `need|needs your action` written out (§1, §2, §12) |
| zero-one-many | History; changed notes | covered | No toggle at zero; one or many render alike (§5.3, §10.2) |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | None new. The existing `Popover`, `Command`, `Sheet`, `Textarea`, `Switch`, `Checkbox`, `Select`, `Skeleton`, `Button`, `Card` and `sonner` `Toaster` | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

No new dependency.

---

## Verification contract

- **Unit and component (vitest):**
  - navigation: `Assigned to me` first in `Assessment work`, both count names and reads, nothing at zero;
  - queues: the column (name, `Pick up`, `Not picked up`, `You raised it`), filters and chips, `All open`, the unread line, cards, Assigned to me's fixed scope and empty states;
  - Home: tile 1, both groups, each row's href equal to its predicate; the Requestor's row and item markers;
  - assignment: every holder state and its actions; optimistic apply, rollback, Undo (including none after release), focus, family K; the picker's states and keyboard, the `Assign to a Security Analyst` label before a choice, and the reason and choice kept across `Escape`, a click outside, `Close` and a remount, restored with their caption, cleared on success and sign-out, and arming `beforeunload`; history sentences and fail-safe;
  - notes: thread order, header, `New` markers, clamp, earlier notes; composer validation, shortcut, pending note, rollback with restored text, session draft and sign-out clearing, `beforeunload`; closed lines and the unsent well, `Discard text` with its Undo toast, restore and focus; mark-read timing and silence; family L;
  - AI: the switch for analysts only (none for the Requestor or a requesting analyst), Undo and family M; the signal; the sheet group;
  - jobs: `Started by {name}`, retry for every analyst;
  - copy: no `Accept`, no `release` in assignment strings; the copy guard.
- **Contract parity:** every new or widened parser joins `contract-response-parity.test.ts` (D-02).
- **E2E** (dev servers stopped): §16, plus D-32's journeys at 375 and 1440 with axe: Bob picks up from the row and sees `Assigned to Bob Doe` on the row, request, Home, quick find, questionnaire and assessment pages, and Jane's request and Home; Bob reassigns to the second analyst, who finds it in Assigned to me and follows Bob's draft job; on Bob's own request no `Pick up`; Jane adds a note, Bob sees it flagged on the queue and request, marks it, sees the signal, replies; Jane sees the reply flagged on Home and the request with Bob's name and local time; the Secondary Requestor gets the not-found state and no flag anywhere.
- **Browser backstops** (orchestrator): the three UI Considerations backstops; NVDA reading a pick-up toast's `Undo` by `Alt+T`, the switch state, and `Note added.` once; session-kept note text across in-app navigation and its loss prompt on tab close; a typed picker reason restored after a click outside the popover and after in-app navigation.

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
