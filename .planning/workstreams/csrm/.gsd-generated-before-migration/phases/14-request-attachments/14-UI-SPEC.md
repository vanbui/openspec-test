---
phase: "14"
slug: "request-attachments"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-10-01"
reviewed_at: "2026-10-01"
---

# Phase 14 — UI Design Contract

> Visual and interaction contract for request attachments. It covers:
> - the file field and upload queue on the new-request form and the draft's edit form (D-16, D-26, D-27);
> - the `Files` section on both request pages, with its removed group, states and phone cards (D-18 to D-23, D-28);
> - files posted with a note in Phase 13's thread and composer (D-17);
> - downloads (D-23, D-24);
> - the analyst's per-file AI inclusion, the text preview, the "AI inputs changed" signal and the `Files` group of "What the AI used" (D-30 to D-36);
> - the analyst questionnaire and assessment pages' files line (D-27);
> - every refusal's words (D-11), the toasts and the leave warnings.
>
> It introduces no colour, type size, weight, family, radius, shadow, spacing step or duration of its own. Five patterns the direction does not yet name are proposed as CSRM extensions X-19 to X-23.

---

## Binding inputs and value authority

- **Locked decisions.** D-01 to D-40 in `14-CONTEXT.md` govern this contract. It fixes the copy, layout, routes and visuals the context leaves to the UI-SPEC (Planner's Discretion: "Copy, layout, routes and visuals"). Where a decision leaves a choice open, this contract makes it and records the reason under "Decisions recorded" (UI-D1 to UI-D35).
- **Value authority.** `docs/design/csrm-design-direction.md` (ADR 0001) is the only value-bearing authority. This file names semantic tokens and cites the direction by section (§). It restates no colour, size, radius, shadow or duration. Spacing steps are named only where a new layout needs one, and each is a §3.9 step.
- **Extensions.** Recorded before any Phase 14 plan runs: X-1 to X-5 (plan 10-01), X-6 to X-10 (Phase 11's first plan), X-11 to X-14 (plan 12-13) and X-15 to X-18 (Phase 13's recording task). This contract reuses:
  - X-1 (save status) on the new-request form;
  - X-3 (dates and times) for every time a file was added or removed;
  - X-4 (separators);
  - X-10 (figure links) for every new figure;
  - X-13 (side sheet) for the text preview, and its phone form for the file actions;
  - X-14 (Undo toast) for removal, restore and AI inclusion;
  - X-16 (notes thread) for the composer and the note's files;
  - X-18 (AI input mark) for the per-file switch and the signal, extended by X-22.

  New patterns are X-19 to X-23 under "Proposed CSRM extensions", each with its exact wording. A plan task records them before any implementing task runs, after Phase 13's task records X-18, which X-22 extends.
- **Requirements.** COLLAB-02. Acceptance bar: ROADMAP Phase 14 success criteria 1 to 5.
- **Findings closed.** UAT-012 (intent F1, A1).
- **Delegated decisions.** #2, #5, #6, #9, #12, #18, G-1, G-3, G-4 (§12 of this contract), G-6, G-7, G-12, G-13, G-14 (UI-D33), G-15 and G-16.
- **Builds on Phases 10 to 13,** whose plans are written but not yet executed: Phase 10's request form and pages (10 §8.1, §9), refusal families A to I (10 §10.2), leave warning (10 §6.3) and job failure copy (10 §12.4); Phase 11's voice and token tables (11 "Voice", "Token names") and the one status mapping (11 §10); Phase 12's "What the AI used" sheet (12 §2), policy copy (12 §11) and family J; Phase 13's hub rows (13 §5.1), notes thread and composer (13 §8, §9), AI mark and signal (13 §10), `AssessmentRequestLink` lines (13 §11) and families K to M. Every plan re-reads those files once the earlier phases have executed.
- **Domain vocabulary.** The record is `CsrmRequestAttachment`; people see it as a **file** (UI-D1). `Assessment Request`, `Security Analyst` and `Requestor` keep their capitals.
- **Reserved words.** `Accept` is the risk owner's decision (G-14). No Phase 14 string uses it, including "accepted types" (UI-D33). "Release" names the assessment's state only.

### Decision coverage

| Decisions | Where this contract honours them |
|---|---|
| D-01 to D-05 (contract, operations, projections) | No UI of their own. People show by display name only; no hash, provider metadata or URL reaches the page (§3, §8) |
| D-06 to D-08 (storage, unmounted routes) | No UI. A file whose bytes are gone shows `File unavailable` (§3.4) |
| D-09, D-10 | §1.1 hint, §1.3 pre-checks, X-23 names and sizes |
| D-11 | §8.1 family N, word for word |
| D-12 to D-15 | §1.4 stages, §3.4 pending and blocked, §3.6 not configured |
| D-16 | §2 (intake), §3.6 (windows), §4 (after submission) |
| D-17 | §4 |
| D-18 | §3.7 (not found), §11 |
| D-19 | §3.3 (actions per viewer) |
| D-20, D-21 | §3.5, §9 |
| D-22 | No UI (retention) |
| D-23, D-24 | §3.3 Download, §8.2 family O |
| D-25 | No UI (body limit); §1.4 `Adding…` is indeterminate |
| D-26 | §1, §1.5, §2, §4.3, §10 |
| D-27 | §2, §3, §4, §6, §7 |
| D-28 | §3 |
| D-29 | The whole contract; §12; X-19 to X-23 |
| D-30 to D-33 | §5, §8.3 family P |
| D-34 | No UI (the prompt); §5.1 says the text is sent as information, never instructions |
| D-35 | §7.1 |
| D-36 | §6.2 |
| D-37 to D-40 | No UI; §13 and the Verification contract |

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
| New dependencies | None in the web. The file field uses a native `input type="file"`; the queue, list and chips compose existing primitives |

---

## Component inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-10-01.

A non-exhaustive list of the known-good components this phase uses, never a closed allowlist. The full set is the 30 Phase 11 lists (`alert-dialog` to `tooltip`).

| Component | Import path | Phase 14 use |
|---|---|---|
| `Button` | `@/components/ui/button` | `Choose files`, `Attach files`, `Add files`, `Download`, `Remove`, `Restore`, `Retry`, `Preview text`, toggles |
| `Sheet` | `@/components/ui/sheet` | The text preview (X-13) and the phone file-actions sheet (X-21) |
| `Switch`, `Label` | `@/components/ui/switch`, `@/components/ui/label` | The per-file AI switch (X-18, X-22) |
| `Alert` | `@/components/ui/alert` | The new-request form's "not added" summary (§2.2) |
| `Toaster` (sonner `toast` with `action`) | `@/components/ui/sonner` | Undo and rollback toasts (X-14) |
| `Skeleton` | `@/components/ui/skeleton` | The `Files` block of each request page skeleton; the text preview |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-10-01.

A non-exhaustive list; the executor may use any exported primitive.

| Primitive | Path | Phase 14 change |
|---|---|---|
| `DataTable` | `components/csrm/data-table.tsx` | The file list from 768px, with its density toggle and cards (§3.2); reused, never forked |
| `StatusBadge`, `statusPresentation` | `components/csrm/status-badge.tsx` | Gains the `attachment` family (§3.4, X-21) |
| `DetailSection`, `FormSection` | `components/csrm/detail-section.tsx`, `form-section.tsx` | The `Files` section; the form's `Supporting files` section |
| `RecordLink` | `components/csrm/record-link.tsx` | Figure links, note links, file links in the sheet and signal |
| `ConfirmDialog` | `components/csrm/confirm-dialog.tsx` | Only through Phase 10's leave warning (§10) |
| Phase 10 `LocalInstant`, navigation guard, `refusal-copy.ts` | as Phase 10 plans them | X-3 times; §10; families N to P |
| Phase 12 run sheet; Phase 13 notes section, composer, signal and `AssessmentRequestLink` lines | as those phases plan them | §4, §6, §7 |
| **New:** attachments feature | recommended `features/attachments/` (`attachments-domain.ts` zod-free, `file-field.tsx`, `upload-queue.tsx`, `files-section.tsx`, `file-chip.tsx`, `file-ai-control.tsx`, `file-text-sheet.tsx` lazy, `attachment-actions.ts` `'use server'`) | §1 to §6 |
| **New:** shared file transfer | recommended `lib/files/` (`format-file-size.ts`, the file-response validator, the save-bytes helper; Phase 19 reuses them, D-24) | §3.3, X-23 |

Names and paths of new modules are the planner's. Zod stays out of every new client module (`zod-client-boundary.test.ts`).

---

## Token names used in this contract

As the Phase 11 contract's table, which this contract does not repeat. This phase uses these additionally or more heavily:

| Direction token | Utility or class in the shipped code | Phase 14 use |
|---|---|---|
| `--color-border-strong` | `border-border-strong` | The file field's dashed boundary (X-19) |
| `--color-text-primary`, `--color-bg-hover` | `border-foreground`, `bg-surface-hover` | The file field while files are dragged over it (X-19) |
| `--color-success-fg`, `--color-danger-fg` | `text-success`, `text-danger` | The `Added` and `Not added` stage icons (X-20) |
| `--color-bg-inset` | `bg-surface-muted` | The text preview's well (§5.3) |
| `--font-mono` with `--text-micro` | `.micro-label` | The file type label (`PDF`, X-23) |

---

## Voice, formats and shared copy rules

The Phase 11 contract's "Voice, formats and shared copy rules" applies unchanged (Australian English, sentence case, spaced hyphen, X-4 middle dot, typographic apostrophes and quotes, written-out plurals with `tabular-nums`, X-3 times), with Phase 13's "People are names" and "Parts" rules. In addition:

- **Files.** A file is "a file", the section is `Files`, the actions are `Choose files`, `Add files` and, in the composer, `Attach files` (UI-D1, UI-D8). Copy never says "attachment", "upload", "quarantine", "scan" or "extracted text"; it says "add", "malware check" and "the file's text".
- **Names and sizes** follow X-23: a name verbatim and escaped, a size in 1,024-byte units (`2.4 MB`, `640 KB`), a type by its extension (`PDF`).
- **The allowed list** reads, everywhere it is named: `PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG`.
- **The limits** read `up to 25 MB each` and `up to 20 per request`.
- **Malware** is named plainly. A detection name is shown verbatim as data.

---

## 1. The file field and the upload queue (X-19, X-20, X-23)

### 1.1 The field (X-19)

| Part | Contract |
|---|---|
| Label (`--text-body` at 500) | `Add files` (the form, the draft); `Add files with a note` (after submission, §4.1) |
| Region | X-19: dashed `--color-border-strong` boundary, `--radius-lg`, 24px padding from 768px and 16px below |
| Content | 16px `Upload` (`aria-hidden`), `Drag files here, or` (from 768px only), then `Choose files` (outline, small; full width at the touch-target height below 768px) |
| Hint (`--text-caption`, `--color-text-secondary`), linked by `aria-describedby` | `PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG · up to 25 MB each · {r} more can be added to this request` |
| The input | A visually hidden `input type="file" multiple` with the allowed extensions in `accept`, labelled by the field's label; `Choose files` activates it. The drop region is not a tab stop |
| Drag over | X-19's active state. Files dropped elsewhere on the page are ignored, so the browser never opens one and leaves the page (UI-D30) |

### 1.2 Where files cannot be added

The field is replaced by one `--text-body` line in `--color-text-secondary` with a 16px icon (`aria-hidden`):

| Case | Icon | Line |
|---|---|---|
| 20 active files | `Paperclip` | `This request has 20 files, the most it can hold. Remove a file to add another.` |
| The lifetime bound reached | `Paperclip` | `This request has reached the most files it can keep, counting removed ones, so no more can be added.` |
| Storage or scanning not configured (`ATTACHMENTS_NOT_CONFIGURED`, served on the request read) | `CloudOff` | `Files can’t be added right now because file storage isn’t set up. Contact your administrator.` |
| Released or closed, a returned draft for an analyst, a requesting analyst on a draft | `Lock` | §3.6 |

### 1.3 Checks before sending (D-11)

Chosen files are checked in the browser for extension, size (empty and over 25 MB) and the request's remaining count, in the order chosen. A file that fails is listed at once as `Not added` with family N's copy and never sent. Files beyond the remaining count are each listed with `ATTACHMENT_LIMIT_REACHED`'s copy. The same file chosen twice (same name, size and last-modified time) is listed once (UI-D13). Strapi stays authoritative: a file that passes here can still be refused there with the same words.

### 1.4 The queue (X-20)

An `ul` named `Files being added` under the field or composer, in the order chosen.

| Stage | Icon (14px) | Text (`--text-caption`) | Actions |
|---|---|---|---|
| Chosen, not yet sent (the form before `Save draft`, the composer before `Add note`) | none | none | `Remove {name} from the list` (ghost icon-only `X`) |
| Waiting | `Clock`, `--color-text-secondary` | `Waiting` | `Remove {name} from the list` |
| Adding | the 16px inline spinner (static under reduced motion) | `Adding…` | none |
| Added | `CheckCircle2`, `--color-success-fg` | `Added` | none; the row leaves the queue when the list it joins re-renders |
| Waiting for the malware check | `ShieldEllipsis`, `--color-text-secondary` | `Added. Waiting for the malware check before anyone can download it.` | none |
| Not added, refused | `AlertCircle`, `--color-danger-fg` | `Not added.` then family N's copy | `Choose another file` (outline, small; replaces this row; accessible name `Choose another file to replace {name}`), `Remove from list` (ghost, small; accessible name `Remove from list: {name}`) |
| Not added, transfer failed | `AlertCircle`, `--color-danger-fg` | `Not added.` then `We couldn’t add this file. Try again.` | `Retry` (outline, small; sends the same file; accessible name `Retry {name}`), `Remove from list` (as above) |

- **Accessible names.** Every repeated row control names its file, and each begins with its visible label (2.5.3). `Remove from list: {name}` differs from the `Files` list's `Remove {name}` (§3.3), which removes an added file, because both can be on one draft page.

- **The count line** above the list (`--text-caption`, `tabular-nums`, `role="status"`): `{a} of {n} files added`, then ` · {k} not added` when above zero. It is the only announcement; stages are not announced (UI-D11).
- **One at a time.** Files are sent in order, one Server Action each (D-26); a failure moves on to the next file.
- **Focus.** It stays where the person acted. After `Remove from list` it moves to the next row's first control, else the previous row's, else `Choose files`. `Choose another file` returns focus to the replacement row.

| Viewport | Contract |
|---|---|
| 1440 | Each row on one line where it fits: icon, name, size, stage, actions at the end; the reason wraps beneath |
| 375 | Each row stacks: icon and name (wrapping anywhere), size, stage and reason, then the actions at full width and the touch-target height |

### 1.5 Files not added are kept for the tab (no lost input; UI-D35)

Phase 13's pattern for unsent text (13 UI-D17, UI-D18, UI-D31), applied to files held in memory as §4.3 holds the composer's (UI-D10).

- **What is kept.** Every `Not added` row (refused, or transfer failed and awaiting `Retry`) on the draft's edit form, the draft's request page, the new-request form once its draft exists, or a posted note. Each keeps its file, its reason and its actions in the tab's in-memory file store (the one §4.3 uses), keyed by the signed-in person and the request. File contents are never written to browser storage.
- **In-app navigation keeps them.** Any in-app link, including the sidebar, the hub and `Go to draft` (§2.2), leaves without a dialog and drops nothing. The rows return where they were listed when the person next opens a page of that request that shows them:
  - a draft's rows on its edit form or its request page, which render the one queue (§2.3);
  - a note's rows under that note (§4.2).
- **On return.** The caption `Restored from earlier in this session.` (13 §9.3's words) shows above the restored rows. The count line counts them afresh (`0 of {k} files added · {k} not added`).
- **Cleared** when a row is added by `Retry` or `Choose another file`, when it is taken off by `Remove from list`, when the person chooses `Submit request` with the §2.4 line naming the rows not added, and on sign-out.
- **Reload, closing the tab or a typed URL** would lose them, so while the store holds any file, the `beforeunload` guard is armed on every page in the tab (§10).

---

## 2. Files at intake (D-16, D-26, D-27)

### 2.1 The new-request form (`/app/requests/new`)

A new `FormSection` after `Scope and timing`, before the form's actions.

| Part | Copy |
|---|---|
| Title | `Supporting files` |
| Description | `Add documents that help a Security Analyst understand this request, such as a vendor’s security pack, a data-flow diagram or a completed security questionnaire. Files are added when you save the draft.` |
| Field and queue | §1. Rows wait at "chosen, not yet sent" until `Save draft` |

### 2.2 Saving the draft with files

1. **Validate** the form as today. Errors show at their fields; the chosen files stay listed.
2. **Create the draft** (`Saving draft…`). A failure shows the form's existing error; nothing is sent and the files stay listed.
3. **On success,** the address becomes the draft's edit route (`/app/requests/{id}/edit`) without a navigation (UI-D3), the X-1 status beside `Save draft` reads `Draft saved at {time}`, and `Save draft` shows `Adding files…` with its inline spinner while the queue sends the files. It is not re-entrant.
4. **All settled, none refused** (each `Added` or waiting for the malware check): the page moves to the draft's request page, as today.
5. **Any not added:** the page stays. A danger `Alert` above the queue, focused (`tabIndex={-1}`) and announced once:

| Part | Copy |
|---|---|
| Title | `{k} {file wasn’t|files weren’t} added` |
| Description | `Your draft is saved. Retry, remove or replace {it|them}, then save again, or go to the draft, where {it stays|they stay} listed for you to retry.` |
| Action | `Go to draft` (outline, small) → `/app/requests/{id}` |

Saving again updates the same draft (never a second request) and sends the files still listed. `Go to draft` is an in-app link: the files not added go with it and wait in the draft's queue (§1.5). The leave warning (§10) covers the form while it holds unsaved fields, or files chosen before the draft exists.

### 2.3 The draft's edit form (`/app/requests/{id}/edit`) and request page

The edit form's `Supporting files` section and the draft's `Files` section (§3) render the same list and field, and files are added as soon as they are chosen (UI-D4).

| Part | Copy |
|---|---|
| Edit form description | `Files are added as soon as you choose them, and stay with the draft whether or not you save your other changes.` |
| Edit form list | §3.2's list, with `Download` and `Remove` (the removed group and Undo as §3.5) |

### 2.4 Submitting while files are being added (UI-D5)

While any file on the page is waiting or being added, the submit dialog (10 §8.1, on the edit form and the request page) adds the line `Wait until your files are added, then submit.` under its description, and its `Submit request` confirm is disabled until the queue settles. A file that is not added does not block submission; the line then reads `{k} {file wasn’t|files weren’t} added. Submit anyway, or retry {it|them} first.`

---

## 3. The Files section on both request pages (D-18 to D-23, D-28; X-21)

**Surfaces:** the Requestor's `/app/requests/{id}` and the analyst's `/app/review/requests/{id}`.
**Placement:** a `DetailSection` titled `Files` (h2, region id `files`), directly before `Notes`, so `Notes` stays last (13 UI-D13; UI-D2).
**Focal point:** the newest file, then the add control.

### 3.1 Frame and hub row

| Part | Requestor | Security Analyst |
|---|---|---|
| Description | `Files for this request, from you and the Security Analysts. Each file is checked for malware before anyone can download it. A Security Analyst may include a file’s text in the information CSRM sends to the AI, within your organisation’s data policy.` (D-28) | `Files from the Requestor and the Security Analysts. Each file is checked for malware before anyone can download it. Include a file’s text to use it in AI generation.` |
| Count line (`--text-caption`, `tabular-nums`) | `{n} {file|files}` (the main list) | the same |
| Add control | §3.6 | §3.6 |

**Hub `Files` row** (both pages, after 13 §5.1's `Notes`): a figure link (X-10) `{n} {file|files}` → `#files`, its total equal to the main list. With none and files can be added: the link `Add files` → `#files`. With none otherwise: `No files`.

### 3.2 The list (X-21)

The main list holds every file not removed, newest first, including blocked files (D-21). Each row or card has `id="file-{documentId}"` and `tabIndex={-1}`, so a link to `#file-{id}` scrolls to it and focuses it.

**From 768px:** a `DataTable` with the density toggle, no sorting, no pagination (at most 20 active files plus blocked ones):

| Column | Content |
|---|---|
| `Name` | 16px type icon (X-21), the name (`--text-table` at 500; a long-text column, X-23) and the type label (`--text-micro`) beneath |
| `Size` | X-23 size, right-aligned, `tabular-nums` |
| `Added by` | The name, then `{Requestor|Security Analyst}` in `--text-caption` / `--color-text-secondary` |
| `Added` | `LocalInstant` with the time of day (X-3) |
| `Note` | A record link `Note · {instant}` → `#note-{noteId}`; a file added to the draft reads `Before submission` (`--color-text-secondary`) |
| `AI inputs` (analysts only) | §5.1 |
| Actions (visually hidden header `Actions`) | §3.3 |

**Below 768px:** one card per file (X-21): the icon and name (clamped to three lines), `{TYPE} · {size}`, `{name} · {part} · {instant}`, the note link or `Before submission`, any state badge with its line (§3.4), for analysts the AI line `AI inputs: {facts}` (§5.1), then `Download` at full width and the touch-target height and, when other actions exist, the icon-only `More actions for {name}` (`Ellipsis`), which opens the actions sheet (§3.3).

### 3.3 Actions per viewer (D-19, D-23)

Offered only as the server's allowed actions say; the web never infers them.

| Action | Who | Control |
|---|---|---|
| `Download` | Any reader, on an available file | Outline, small, `Download` icon; accessible name `Download {name}`. Pending: `Downloading…` with the inline spinner. On success the browser saves the file and a visually hidden status says `{name} downloaded.` once. No toast |
| `Remove` | The uploader on their own file while files can change; any human Security Analyst on any file from submission until release | Ghost, small; accessible name `Remove {name}` (§3.5) |
| `Restore` | The person who removed it, while files can change | In the removed group (§3.5) |
| AI switch, `Preview text` | A human Security Analyst who did not raise the request | §5 |

The phone actions sheet: X-21's bottom sheet titled with the file's name (`--text-heading-sm`, wrapping), holding `Remove` and, for analysts, the AI switch with its line and `Preview text`, each at full width and the touch-target height, and `Close` named `Close actions for {name}`. Focus moves to the title on open and returns to `More actions` on close.

### 3.4 File states (X-21; the one status mapping)

A new `attachment` family in `statusPresentation`. Every value is neutral, because none is work waiting on a person and none is overdue (UI-D14). An available file shows no badge.

| Value | Label | Icon | Line beneath (`--text-caption`, `--color-text-secondary`) | Download |
|---|---|---|---|---|
| `available` | `Available` (in the mapping; not rendered as a badge) | `ShieldCheck` | none | yes |
| `pending` | `Waiting for malware check` | `ShieldEllipsis` | `It can be downloaded once it passes. Refresh the page later to see.` | no |
| `blocked` | `Blocked` | `ShieldX` | `Malware found: {detection}. The file was deleted and can’t be downloaded.` | no |
| `unavailable` | `File unavailable` | `FileX` | `This file can’t be downloaded. Contact your administrator.` | no |
| `removed` | `Removed` | `ArchiveX` | Shown only on a file chip inside another record (a note's, §4.2), never in a list row: a removed file leaves the main list for the removed group (§3.5) | no |

A pending or blocked file can be removed like any file. Nothing polls: a file released or blocked by a re-scan shows its new state on the next page load (D-13; 11 D-11).

### 3.5 Removing and restoring (D-20; X-14)

- **Removing** applies at once (§5 Optimistic UI): the row leaves the main list and joins the removed group at the pending opacity until the server answers. No confirmation and no reason are asked.
- **Toasts** (§9). Undo restores it, recorded as a second change.
- **The removed group:** an outline small toggle `Show removed files ({n})` / `Hide removed files` with `aria-expanded`, `aria-controls` and `ChevronDown` / `ChevronUp` swapped with no transition, below the main list. Absent at zero. Its list (`ul` named `Removed files`) shows each file's icon, name, type and size, `Added by {name} · {instant}` and `Removed by {name} · {instant}`, and `Restore` (outline, small; accessible name `Restore {name}`) for the person who removed it. No `Download`.
- **Focus.** After `Remove`: the next row's `Download` (or its first action), else the previous row's, else the section heading (`tabIndex={-1}`). After `Restore` or a successful `Undo`: the restored row's first action. On rollback focus stays and the toast announces itself.

### 3.6 Adding, and where files are closed (D-16, D-17)

| Request and viewer | Add control |
|---|---|
| Draft, its Requestor (and a requesting analyst on their own draft) | The §1 field inside the section, files added at once (§2.3) |
| Submitted until release, the Requestor or a human Security Analyst | The §1 field labelled `Add files with a note`, with the hint line `Files are added with a note, so everyone knows what they are.` before the type list. Choosing or dropping files hands them to the Notes composer (§4.1) |
| Returned to draft, a Security Analyst | `Lock` line: `Files are paused while this request is a draft. They can be added again once the Requestor resubmits it.` |
| `approved` (Released) or `closed` | `Lock` line: `Files closed when the assessment was released. They stay here as part of the record.` |
| Limit, lifetime bound, not configured | §1.2 |

### 3.7 Empty, loading, error and not found

| State | Contract |
|---|---|
| Empty, draft (Requestor) | `No files yet` · `Add documents that help a Security Analyst understand this request, such as a vendor’s security pack or a data-flow diagram.` The field is the call to action |
| Empty, submitted (Requestor) | `No files yet` · `Add files with a note when a Security Analyst asks for them, or when you have more to share.` |
| Empty, submitted (Security Analyst) | `No files yet` · `Add files with a note to share documents with the Requestor.` |
| Empty, closed or paused | `No files` (the cleared type) with the §3.6 line beneath |
| Loading | The section renders with the page. Each request page skeleton gains a `Files` block before its `Notes` block: a heading line, three rows at the list's density (cards below 768px) and a field-height block |
| Error (the files read failed, the page did not) | Compact `We couldn’t load the files` with `Try again`; the add control stays |
| Not found (another Requestor, a participant, a missing request; D-18) | The request page's own not-found state. No file name, count or `Files` row renders anywhere for that viewer |
| Printing | The main list prints with names, sizes, who, when, notes and states; the removed group prints when expanded; the field, queue, actions, switches and toggles do not (`data-print="hidden"`) |

| Viewport | Contract |
|---|---|
| 1440 | The section at the content width; the table scrolls inside its labelled region only if it overflows, with `Name` sticky (§4 DataTable) |
| 375 | Cards; the field's `Choose files` at full width; the removed toggle at full width |

---

## 4. Files with notes (D-17; X-16, X-20, X-21)

### 4.1 The composer gains files

| Part | Contract |
|---|---|
| `Attach files` | Outline, small, `Paperclip`, on the composer's action row before `Add note`; it opens the file chooser. The composer is also a drop target while files are dragged over it (X-19's active state on the composer's boundary) |
| Chosen files | Below the textarea, an `ul` named `Files to add with this note` of file chips (X-21) with the size and `Remove {name} from the list`; §1.3's checks run on choosing |
| Hint (with files) | `Files are checked for malware, then added with your note.` |
| From the Files section | Files chosen or dropped in `Add files with a note` join these chips; the page scrolls to `#note-composer`, focus moves to the textarea, and the caption `Write a note to say what these files are, then add it.` shows above the chips (UI-D6) |
| Validation, on `Add note` | Files with no text: `Write a note to say what these files are.` (§4 Forms error under the textarea) |

### 4.2 Posting

1. **The note posts first** through Phase 13's operation, optimistic as 13 §9.1: it appears at the end of the thread at the pending opacity with `Adding…`, and its files appear beneath its body as X-20 rows at `Waiting`. The composer clears.
2. **On the note's success,** each file is sent with the note's id, one at a time, its row moving through the X-20 stages.
3. **If the note fails,** it is removed as 13 §9.1, and its text and files return to the composer.
4. **A file not added** keeps its row on the note with its reason and actions (§1.4). When the note's window for files has passed (`ATTACHMENT_NOTE_INVALID`), `Retry` gives way to `Add with a new note` (outline, small; accessible name `Add with a new note: {name}`), which moves the file to the composer's chips (UI-D9). A note's rows not added are kept for the tab (§1.5).

**The note's files, settled.** Under the note body, an `ul` named `Files with this note` of file chips (X-21): icon, name, size, and `Download {name}` (ghost icon-only `Download`), or the file's badge (§3.4) for a pending, blocked, unavailable or removed file. Each chip's name is a record link to `#file-{id}` in the `Files` section, so the file leads to its row and its row (§3.2 `Note`) leads back.

### 4.3 Unsent files (no lost input)

- **Kept for the tab.** Chosen files not yet posted stay in memory with the composer's session-kept text (13 §9.3), keyed by the person and the request, and return when the person comes back to the request within the tab; the caption `Restored from earlier in this session.` covers both. File contents are never written to browser storage (UI-D10).
- **A reload or closing the tab** loses them, so the `beforeunload` guard is armed while the tab's file store holds them (§1.5), as it is for text.
- **Notes closed with unsent files** (`NOTES_CLOSED`, 13 §9.4): the read-only well lists the files' names beneath the text, with `Discard text` reading `Discard note` and discarding both, under the same Undo toast.

| Viewport | Contract |
|---|---|
| 1440 | Chips wrap in rows under the textarea; `Attach files` and `Add note` share the action row |
| 375 | Chips stack at full width; `Attach files` and `Add note` each at full width and the touch-target height, `Add note` last |

---

## 5. The AI inputs (D-30 to D-34; X-18, X-22)

Security Analysts only. The Requestor sees the §3.1 description and nothing else (D-28).

### 5.1 The control on each file

| File and request | Contract (the `AI inputs` cell, the card's AI line, and the actions sheet) |
|---|---|
| Available, text-bearing, the analyst may change it | The X-18 `Switch` labelled `Changes the AI inputs` (described by the file's name), then the X-22 line: `Not included`, `Included · all {m} characters` or `Included · first {n} of {m} characters`, then `Preview text` (ghost, small, `ScanText`; accessible name `Preview text of {name}`) when included |
| Turning it on | The switch shows on with the pending opacity and the line `Reading the file’s text…` with the inline spinner; it waits for the server (UI-D19). Success shows the facts and the §9 toast; a refusal turns it off with the transition and family P's copy in a danger toast |
| Turning it off | Applies at once (optimistic) with the §9 toast; rolls back on failure |
| PNG or JPEG | No switch. `Images can’t be included, because the AI reads text only.` |
| Waiting for the malware check | No switch. `It can be included once it passes the malware check.` |
| Blocked, unavailable | No switch and no line |
| Released, closed or a returned draft | No switch. The facts line stays as read-only fact (`Included · …` or `Not included`) |

**Section-level lines** (one `--text-body` line in `--color-text-secondary` under the section's description, instead of a line on every file):

| Case | Icon | Line |
|---|---|---|
| A requesting analyst on their own request (G-1) | `Lock` | `You raised this request, so another Security Analyst decides which files the AI uses.` |
| `AI_CLASSIFICATION_ABOVE_CEILING` (from the served `aiPolicy`) | `ShieldBan` | `Files can’t be included in the AI inputs: this request’s information is classified {level}, above the {ceiling} limit the AI provider is approved for.` |
| `AI_POLICY_NOT_CONFIGURED` | `ShieldBan` | `Files can’t be included in the AI inputs, because the AI provider hasn’t been approved for any information classification yet. Contact your administrator.` |
| Allowed | none | `Include only files whose content is within this request’s {level} classification.` (D-30) |

In the two refusal cases, and for a requesting analyst, no switch renders; facts lines stay.

### 5.2 Removal and inclusion

Removing an included file ends its inclusion (D-20). Restoring does not re-include it, and the toast says so (§9).

### 5.3 The text preview (X-13, X-22)

**Trigger:** `Preview text`. The sheet reads the stored text through the analyst-only operation (D-04 item 6) from a Server Action when it opens; it is code-split with `next/dynamic`.

| Part | Copy |
|---|---|
| Title (h2) | `Text the AI will read` |
| Description (`--text-body`, `--color-text-secondary`) | `{name} · {facts line}. CSRM sends this text to the AI as information to analyse, never as instructions.` |
| Body | The text in a `--color-bg-inset` well, `--text-body`, `whitespace-pre-wrap`, `[overflow-wrap:anywhere]`, rendered as text only; the sheet body scrolls |
| End line (truncated only, `--text-caption`) | `The text stops here. The remaining {m − n} characters aren’t sent.` |
| Close | `Close text preview`; `Escape` closes; focus returns to `Preview text` |

| State | Contract |
|---|---|
| Loading | Nothing for 300ms, then the title, description and eight text-line skeleton blocks |
| Error | `We couldn’t load the file’s text` · `Try again` |
| No longer included (409) | `This file’s text is no longer included, so there’s nothing to preview.` |
| Refused (403, `OWN_REQUEST`) | Family P's copy |

| Viewport | Contract |
|---|---|
| from 768 | X-13 side sheet at the form dialog width |
| 375 | X-13 full-screen sheet with the title row and `Close` |

---

## 6. The analyst questionnaire and assessment pages (D-27, D-36)

### 6.1 The files line

`AssessmentRequestLink` (13 §11) gains a third server-rendered line after the notes line, in `--text-caption` / `--color-text-secondary`: a figure link `{n} {file|files}` → `/app/review/requests/{id}#files`, then ` · {k} included in the AI inputs` when above zero. With none: `No files` (plain). No client component is added; the editor's first-load JavaScript is unchanged (R-08-34).

### 6.2 "AI inputs changed" gains files (X-18, X-22)

13 §10.2's list gains one item per changed file: a record link `{name}` → `/app/review/requests/{id}#file-{fileId}`, then the caption `Included since`, `Excluded since` or `Removed since`. Notes and files share the one list, notes first, each in its own order. The heading and closing caption are unchanged.

| Viewport | Contract |
|---|---|
| 1440 | §6.1 on its own line under the notes line; signal items on one line each |
| 375 | §6.1 wraps at full width; signal items stack as 13 §10.2 |

---

## 7. What the AI used, and the job failure (D-33, D-35)

### 7.1 The `Files` group (12 §2.2; X-22)

A group after 13 §10.3's `Notes`: `{n} {file|files} included`, then one row per included file in upload order:

| Label | Value |
|---|---|
| A record link `{name}` → `/app/review/requests/{id}#file-{fileId}` (the sheet closes, then the route navigates) | `{Requestor|Security Analyst} file · {s} characters sent`, then ` · first {s} of {m}` when truncated, then ` · Removed since` when removed after the run |

With none: `None included`. Runs before this phase read `None included`. The file's text is never shown here (G-3).

### 7.2 `CONTEXT_TOO_LARGE` with files (adds to 12 §11.2)

When the failure names included files, the job card reads `The files included in the AI inputs hold more text than CSRM can send at once, so nothing was sent. Exclude a file, then try again.` followed by an `ul` of the named files as record links to `#file-{id}`. Without files, 12 §11.2's copy is unchanged.

---

## 8. Refusal copy (new families N, O and P, added to Phase 10 §10.2 and `refusal-copy.ts`)

Each Server Action maps the served reason to the copy below. Reason names are the planner's within D-11's families.

### 8.1 Family N: adding a file (the queue row's reason, §1.4)

| Reason | Copy | Kind |
|---|---|---|
| Type not allowed | `This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.` | refused |
| Content does not match the name | `This file’s content doesn’t match its name. Check it’s the file you meant, save it in its real format and add it again.` | refused |
| Macro-enabled | `This file contains macros, so it can’t be added. Save it as .docx, .xlsx or .pptx and add it again.` | refused |
| Password-protected or encrypted | `This file is password-protected, so it can’t be checked for malware. Remove the password and add it again.` | refused |
| Old Office format | `This is an older Office format. Save it as .docx, .xlsx or .pptx and add it again.` | refused |
| Too large | `Files can be up to 25 MB, and this one is {size}. Make it smaller or split it, then add it again.` | refused |
| Empty | `This file is empty. Check it’s the file you meant and choose it again.` | refused |
| `ATTACHMENT_LIMIT_REACHED` | `This request already has 20 files. Remove a file to add another.` | refused |
| Lifetime bound | §1.2's line | refused |
| Malware found | `This file contains malware ({detection}) and wasn’t added. Don’t open it again, and contact your IT service desk, because your device may be affected.` | refused |
| `ATTACHMENTS_NOT_CONFIGURED` | §1.2's line | refused |
| `ATTACHMENTS_CLOSED` | `Files closed when the assessment was released, so this file wasn’t added.` | refused |
| `REQUEST_NOT_SUBMITTED` (an analyst, a draft) | `This request is a draft now, so files can’t be added. Refresh the page to see where it is.` | refused |
| `ATTACHMENT_NOTE_REQUIRED` | `This request has been submitted, so files are added with a note. Add the file from the note box.` (with `Add with a new note`) | refused |
| `ATTACHMENT_NOTE_INVALID` | `This note can no longer take files. Add the file with a new note.` (with `Add with a new note`) | refused |
| 400 | `This file couldn’t be added. Choose it again.` | refused |
| 403 | `You can’t add files to this request.` | refused |
| 404 | The request page's not-found state on refresh | blocked |
| Network, timeout or 5xx | `We couldn’t add this file. Try again.` | retryable (`Retry`) |

### 8.2 Family O: download, remove and restore

| Reason | Copy | Kind |
|---|---|---|
| `ATTACHMENT_QUARANTINED` | `This file is still waiting for its malware check. Try again later.` | blocked |
| `ATTACHMENT_BLOCKED` | `Malware was found in this file, so it can’t be downloaded.` | blocked |
| `ATTACHMENT_REMOVED` | `This file was removed, so it can’t be downloaded. Refresh the page.` | blocked |
| `ATTACHMENT_INTEGRITY_FAILED` | `This file doesn’t match the one that was added, so CSRM won’t download it. Contact your administrator.` | blocked |
| The downloaded bytes fail the web's check (D-24) | `This download didn’t look right, so CSRM stopped it. Try again, or contact your administrator.` | retryable |
| `NOT_UPLOADER` | `Only the person who added this file, or a Security Analyst, can remove it.` | blocked |
| The restore reason | `Only the person who removed this file can restore it.` | blocked |
| `ATTACHMENT_LIMIT_REACHED` (restore) | `This request already has 20 files. Remove another file before restoring this one.` | blocked |
| `ATTACHMENTS_CLOSED` | `Files closed when the assessment was released, so this file can’t change.` | blocked (refreshes) |
| `REQUEST_NOT_SUBMITTED` | `This request is a draft now, so its files can’t change. Refresh the page to see where it is.` | blocked |
| `HISTORY_UNAVAILABLE` (added on 2026-10-01 during planning, plan 14-05) | `This file’s history is full, so it can’t change any more. Contact your administrator.` | blocked |
| 403 | `You can’t change this request’s files.` | blocked |
| 404 | `This file is no longer available. Refresh the page.` | blocked |
| Network, timeout or 5xx | `We couldn’t download the file. Try again.`, `We couldn’t remove the file. Try again.` or `We couldn’t restore the file. Try again.` | retryable |

Download refusals show as a danger toast titled `File not downloaded`.

### 8.3 Family P: AI inclusion and the text preview

| Reason | Copy | Kind |
|---|---|---|
| `OWN_REQUEST` | `A Security Analyst can’t change the AI inputs of a request they raised.` (family M's words) | blocked |
| `ATTACHMENT_TEXT_UNAVAILABLE` | `CSRM couldn’t find text in this file, so it can’t be included. A scanned document needs a text layer.` | blocked |
| The image reason | §5.1's image line | blocked |
| `ATTACHMENT_QUARANTINED` | §5.1's pending line | blocked |
| `ATTACHMENT_BLOCKED`, `ATTACHMENT_REMOVED` | `This file can’t be included any more. Refresh the page.` | blocked |
| `AI_CLASSIFICATION_ABOVE_CEILING`, `AI_POLICY_NOT_CONFIGURED` | §5.1's section-level lines | blocked (refreshes) |
| `ATTACHMENTS_CLOSED` | `The assessment has been released, so what the AI uses can’t change.` | blocked |
| `REQUEST_NOT_SUBMITTED` | `This request is a draft now, so its AI inputs can’t change.` | blocked |
| 403 | `You can’t change the AI inputs on this request.` | blocked |
| Network, timeout or 5xx | `We couldn’t change whether this file is included. Try again.` | retryable |

---

## 9. Toasts (X-14)

| Action | Success toast | After `Undo` | Failure title |
|---|---|---|---|
| Remove | `{name} removed.` An included file adds ` Its text is no longer included in the AI inputs.` | `{name} restored.` A previously included file adds ` Include its text again if the AI should use it.` | `File not removed` |
| Restore | `{name} restored.` | `{name} removed again.` | `File not restored` |
| Include | `{name} included in the AI inputs.` | `{name} no longer included.` | `Inclusion not changed` |
| Exclude | `{name} no longer included in the AI inputs.` | `{name} included again.` (waits for the server, as turning on) | `Inclusion not changed` |

- A refused `Undo` shows the family's copy in a danger toast titled `Couldn’t undo` (13 §7.1).
- Failure toasts carry `Try again` (retryable) or `Refresh page` (blocked).
- Adding files raises no toast: the queue and the note are the confirmation.

---

## 10. Leave warnings (D-26; Phase 10 §6.3)

| Situation | In-app link (the product dialog) | Reload, close, typed URL |
|---|---|---|
| Any file waiting or being added (form, section, composer, note) | Dialog below | `beforeunload` |
| The new-request form with unsaved fields, or files chosen before the draft exists | Dialog below | `beforeunload` |
| The composer holding files or text, nothing in flight | None: kept for the tab (§4.3, 13 UI-D18) | `beforeunload` |
| A file not added (refused, or transfer failed and awaiting `Retry`) on a draft's edit form or request page, the new-request form once its draft exists (including `Go to draft`), or a note | None: kept for the tab and restored where it was listed (§1.5, UI-D35) | `beforeunload`, on every page in the tab while the file is kept |

No row loses a chosen file without a warning: an in-app link either keeps the file or opens the dialog, and every reload, close or typed URL that would lose one meets `beforeunload`.

| Part | Files in flight | The new-request form |
|---|---|---|
| Title | `Leave while files are being added?` | `Leave this request?` |
| Description | `Your files are still being added. If you leave now, the files not yet added won’t be.` | `Your request and its files haven’t been saved. If you leave now, they’ll be lost.` |
| Confirm (destructive) | `Leave page` | `Leave page` |
| Dismiss (initial focus; `Escape`) | `Stay on page` | `Keep editing` |

Focus after dismissing follows 10 §6.3.

---

## 11. Five-state contract

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| File field and queue | not applicable | field only | family N per row; `Retry` | §1.2 and §3.6 lines | chosen, waiting, adding, added, pending, not added |
| New-request form | unchanged | section with field | form error; §2.2 alert | unchanged | queued files, saving, adding, partial |
| Files section | page skeleton block | §3.7 four variants | compact error with `Try again`; families O and P | the request page's not-found state | available, pending, blocked, unavailable, removed group, analyst AI column |
| Note files | with the thread | no list | per-row reason; note rollback | not found | posting, settled chips, `Add with a new note` |
| AI control | `Reading the file’s text…` | `Not included` | rollback and family P | no switch (Requestor, requesting analyst, policy refusal) | included, truncated, image, pending |
| Text preview | skeleton after 300ms | no longer included | `We couldn’t load the file’s text` | family P | text, end line |
| Analyst pages | with the page | `No files` | line absent (fail safe) | analysts only | count, included, signal items |
| What the AI used | 12 §2.4 | `None included` | 12 §2.4 | 12 §2.4 | rows, truncation, `Removed since` |

---

## 12. The premium experience bar (G-4), item by item

| G-4 item | Phase 14 contract |
|---|---|
| A keyboard path for every primary action | `Choose files`, `Attach files`, `Retry`, `Choose another file`, `Remove from list`, `Download`, `Remove`, `Restore`, the AI switch (`Space`), `Preview text`, `More actions`, toggles and every figure link are buttons or links in DOM order; dragging is never the only path; `Undo` by `Alt+T` (X-14) |
| Optimistic feedback that rolls back on error | Remove, restore and exclude apply at once and roll back (§3.5, §5.1); inclusion and uploads show honest pending stages because their result is unknown (D-29) |
| Skeletons while loading | The `Files` block in both page skeletons; the text preview; spinners only inline (`Adding…`, `Downloading…`, `Reading the file’s text…`) |
| Undo for reversible actions; confirmation for governance steps | Remove, restore, include, exclude and `Discard note` carry `Undo`; nothing here confirms (D-29). Submit keeps its confirmation (§2.4) |
| Empty states that say what to do next | §3.7 four variants; §1.2 lines say why and what to do |
| No lost input | Files kept on a failed create or validation (§2.2); a refused file stays listed with its fix; `Retry` without choosing again; note failure returns text and files (§4.2); `Add with a new note`; composer files and every not-added row kept for the tab across in-app navigation, including `Go to draft` (§1.5, §4.3, UI-D35); drops outside the field ignored (UI-D30); §10's warnings |
| Comfortable and compact density | The file table keeps the DataTable density toggle; row actions meet 24px in compact rows |
| Motion from the direction | Motion section; reduced motion honoured |
| Purpose-built phone layouts | File cards with full-width `Download` and the actions sheet; stacked queue rows; full-width `Choose files`; full-screen text preview |
| Every figure opens its records | The hub's `Files` figure, the analyst pages' files line, the signal's file links, the sheet's file links, each note chip and each file's note link. The queue's count line counts a transfer, not records, so it is plain |

---

## 13. Test assertions this contract changes

Each plan greps its strings before editing. Line numbers are today's; Phases 10 to 13 edit several of these files first.

| # | File | Asserts today | Change |
|---|---|---|---|
| U1 | `features/requests/request-form.test.tsx` | Three sections; `Save draft` redirects | The `Supporting files` section; files kept on failure; `Adding files…`; the §2.2 alert; no second create |
| U2 | `features/requests/request-actions.test.ts` | `createRequestAction` redirects | It returns the draft's id while files are queued (the planner shapes it, D-26) |
| U3 | `features/requests/request-hub.test.tsx` (13 §5.1 fixtures) | Rows to `Notes` | The `Files` row |
| U4 | Phase 13's composer and thread tests | Text only | Chips, posting order, rollback with files, `Add with a new note`, the kept files |
| U5 | Phase 12's run sheet tests | Groups to `Notes` | The `Files` group |
| U6 | `components/csrm/status-badge.test.tsx` | Five families | The `attachment` family, every value neutral |
| U7 | Phase 13's signal tests | Note items | File items and captions |
| New | `e2e/request-attachments.spec.ts` (name the planner's) | — | D-39's five journeys at 375 and 1440 with axe |

`performance.spec.ts` and `design-contract.spec.ts` stay green. Phase 10's copy guard gains `features/attachments` and `lib/files`; a unit test asserts no visible string in them contains `Accept` (UI-D33).

---

## Copywriting contract

| Element | Copy |
|---|---|
| Primary CTA | `Save draft` (unchanged; `Adding files…` while files are sent) and `Add note` (unchanged; now carrying files) |
| Other calls to action | `Choose files`, `Attach files`, `Retry`, `Choose another file`, `Remove from list`, `Add with a new note`, `Download`, `Remove`, `Restore`, `Show removed files ({n})` / `Hide removed files`, `Preview text`, `More actions for {name}`, `Go to draft`, `Add files` (hub link), `Try again`, `Refresh page`, `Undo` |
| Headings | Sections `Supporting files` (form), `Files` (pages); sheets `Text the AI will read`, the file's name (actions); sheet group `Files` |
| Labels and states | `Add files`, `Add files with a note`, `Waiting`, `Adding…`, `Added`, `Not added`, `Waiting for malware check`, `Blocked`, `File unavailable`, `Removed`, `Changes the AI inputs`, `Included · first {n} of {m} characters`, `Not included`, `Before submission` |
| Empty state heading | `No files yet`; `No files` (closed or paused) |
| Empty state body | §3.7, by actor and window, each saying what to do next |
| Error states | `We couldn’t load the files`, `We couldn’t load the file’s text`, each with `Try again`; families N, O and P; §2.2's alert |
| Permission states | The request page's not-found state (D-18); §1.2, §3.6 and §5.1 lines |
| Toasts | §9 word for word |
| Destructive confirmation | None. Removal is soft and undoable (`{name} removed.` / `{name} restored.`). The only destructive buttons are §10's `Leave page` |
| AI output | Inclusion describes inputs only; nothing here generates, accepts or releases anything |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 Info and relationships | `Files` and `Supporting files` are headed sections; the queue, removed files, a note's files and chosen files are named lists; the file table has headers, including the visually hidden `Actions` |
| 1.4.1 Use of colour | Stages and states are icon plus words; the drop target's active state changes its line style as well as its colour |
| 2.1.1 Keyboard | §12 first row; the hidden file input is reached only through `Choose files` or `Attach files` |
| 2.2.1 Timing adjustable | Undo toasts pause on hover and focus (X-14); every change can be made again on the page |
| 2.4.3 Focus order | §1.4, §3.3, §3.5, §4.1 (to the textarea), §5.3 |
| 2.4.6 Headings | Request pages: h1 the request, h2 `Files` before h2 `Notes`; sheet titles are their dialog headings |
| 2.5.3 Label in name | `Download {name}`, `Remove {name}`, `Restore {name}`, `Preview text of {name}`, `More actions for {name}`, `Retry {name}`, `Choose another file to replace {name}`, `Remove from list: {name}` and `Add with a new note: {name}` begin with the visible label, so every repeated per-file control has a unique name |
| 2.5.7 Dragging movements | Dragging is never required (X-19) |
| 2.5.8 Target size | Row actions, chip icon buttons and the switch meet 24px; phone actions meet the touch-target height |
| 3.3.1, 3.3.3 Errors | Every refusal says what is wrong and how to fix it, beside its file |
| 4.1.2 Name, role, value | `aria-expanded` and `aria-controls` on the removed toggle; `aria-haspopup="dialog"` on `More actions` and `Preview text`; the switch's checked state; `aria-busy` on a row while adding |
| 4.1.3 Status messages | The queue's count line (polite); `{name} downloaded.` once; toasts (polite; danger once); the §2.2 alert once |
| 1.4.10 Reflow | No horizontal page scroll from 320 to 1440; names wrap anywhere |
| Automated | Zero serious or critical axe violations at 375 and 1440 on the new-request form with a queue (including a refused row), both request pages with files (populated, pending, blocked, removed group open, closed), the composer with chips, the actions sheet and the text preview |

---

## Spacing

The §3.9 scale applies unchanged; this phase adds no spacing value.

| §3.9 step | Use in this phase |
|---|---|
| 4px | Icon-to-text gaps in stages, badges and chips; between a row's name and its type label |
| 8px | Between the field's content and its hint; between chips; chip block padding (X-21) |
| 12px | Chip inline padding (X-21) |
| 16px | The field's padding below 768px; queue and card row padding; between the list and the removed toggle |
| 24px | The field's padding from 768px; between page sections |

Existing primitives keep their shipped spacing (DataTable, Sheet, toasts, `DetailSection`, `FormSection`). Exceptions: none.

---

## Typography

The §3.10 scale applies unchanged; this phase adds no size, weight or family.

| Emphasis level | Token | Weight | Phase 14 use |
|---|---|---|---|
| 1. Panel title | `--text-heading-sm` | its own heading weight | `Files`, `Supporting files`, sheet titles, empty-state headlines |
| 2. Body | `--text-body` | 400; 500 for the field label, file names in queues, cards and chips | Section lines, the preview text, descriptions |
| 3. Caption | `--text-caption` | 400 | Stages, sizes, who and when, facts lines, state lines, hints |
| 4. Micro-label | `--text-micro` | 400 | The type label, table headers, sheet group headings |

Table cells keep `--text-table`; buttons `--text-button`. The checker's two-weight heuristic is superseded by the adopted scale (ADR 0001 gap 8), as in Phases 06.5 to 13. `tabular-nums` on every size and count.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | Canvas, sections, field, queue, cards, chips, sheets |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-border-strong`, `--color-text-secondary` | Preview well, hairlines, the field's dashed boundary, captions |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--color-text-primary` boundary, `--focus-ring` | Only as listed below |
| Status (§3.5) | neutral badges (every attachment state); success fg (`Added`); danger fg (`Not added`, field errors, danger toasts) | Always with an icon and words |
| Destructive | `--color-danger-solid` | §10's `Leave page` only (Phase 10's dialog) |

Ink is reserved for: the `Save draft` and `Add note` primary buttons; the switch's checked fill; record and figure links (the hub's `Files` figure, note links, chip names, the signal's and sheet's file links); the file field's boundary while files are dragged over it; focus rings. `Choose files`, `Attach files`, `Download`, `Restore`, `Retry`, `Choose another file`, `Add with a new note`, `Go to draft` and the toggle are outline; `Remove`, `Remove from list` and `Preview text` are ghost. No new hue; AI and malware have no colour of their own.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| The field's drag-over state | §5 "Button / toggle / checkbox state" (`--ease-standard`) |
| Queue stages, new rows, chips | None: they render in place (§6 do-not 8) |
| Inline spinners | Rotation only, static under reduced motion |
| Optimistic pending (remove, restore, exclude, switch on) | The §5 Optimistic UI pending opacity, applied with no transition |
| Rollback | Opacity at `--duration-base`, `--ease-standard` |
| Sheets | §5 "Drawer / side panel"; fade only under reduced motion |
| Toasts and the leave dialog | §5 "Dialog / toast" |
| Skeleton shimmer | §4 Skeletons; static under reduced motion |

Nothing polls or auto-refreshes; a re-scanned file shows its state on the next load. Reduced motion needs no rule beyond the global one.

---

## Proposed CSRM extensions

For the orchestrator to accept, and a Phase 14 plan task to record in `docs/design/csrm-design-direction.md` before the implementing tasks run. None introduces a value; each names a pattern over existing tokens. Numbering continues after Phase 13's X-18 (UI-D34).

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-19 | §4 Forms, new "File field" entry | The file field and drop target | "**File field (CSRM extension, 2026-10-01).** Files are chosen with a labelled file field: a `--color-bg-surface` region with a 1px dashed `--color-border-strong` boundary, because the boundary is the drop target's only cue, `--radius-lg`, and 24px padding from 768px (16px below). It holds a 16px `Upload` icon in `--color-text-secondary`, the line `Drag files here, or` in `--text-body`, and a `Choose files` outline small pill that opens the browser's file chooser and is always the primary path; below 768px the drag line is not shown and `Choose files` is full width at the touch-target height. A hint in `--text-caption` / `--color-text-secondary` names the allowed types and the limits. While files are dragged over it, the boundary becomes solid `--color-text-primary` and the region takes `--color-bg-hover`, at the control-state timing; files dropped anywhere else on the page are ignored, so the browser never leaves the page to open one. The region is not a tab stop and dragging is never required. Chosen files are checked in the browser for type, size and count before anything is sent, and a refused file is listed with its reason, never dropped silently. Where files cannot be added, one `--text-body` line in `--color-text-secondary` beside a 16px icon says why in place of the field." | D-29 asks for a file field whose button is the primary path; the direction has no file input or drop target. Phases 19 and 20 reuse it. |
| X-20 | §4 Forms, new "Upload queue" entry | Per-file stages | "**Upload queue (CSRM extension, 2026-10-01).** Files being added are a named list under their field or composer, one row per file in the order chosen, on `--color-bg-surface` with `--color-border-default` hairlines and at least the 44px row height. A row shows the file-type icon, the name in `--text-body` at 500, wrapping anywhere, the size in `--text-caption` with `tabular-nums`, and its stage as a 14px icon with `--text-caption` text: none while chosen and not yet sent; `Waiting` (`Clock`); `Adding…` (the 16px inline spinner); `Added` (`CheckCircle2`, `--color-success-fg`); `Added. Waiting for the malware check before anyone can download it.` (`ShieldEllipsis`); or `Not added.` (`AlertCircle`, `--color-danger-fg`) followed by what is wrong and how to fix it. Waiting and neutral stages use `--color-text-secondary`. Files are sent one at a time, so one failure never stops the others. A file not yet being sent can be taken off the list; a refused file offers `Choose another file` and `Remove from list`; a failed transfer offers `Retry`, which sends the same file without choosing it again. Each repeated row control's accessible name begins with its visible label and names its file. One `--text-caption` line above the rows counts `{a} of {n} files added` and is the queue's only announcement. While a file is waiting or being added, leaving the page warns first. A file not added (refused, or awaiting `Retry`) is kept in memory for the browser tab, keyed to the person and the record, and returns with its reason and actions wherever that record lists it under `Restored from earlier in this session.`, so in-app navigation never drops it; while one is kept, reloading or closing the tab warns first, and file contents are never written to browser storage." | D-26 fixes the stages and recovery; the direction has save status (X-1) but nothing per file. |
| X-21 | §4, new "File list" entry | File rows, cards, chips and states | "**File list (CSRM extension, 2026-10-01).** The files on a record are a section headed `Files`, newest first. From 768px they are a DataTable with both densities: the file-type icon (`FileText` for PDF, DOCX and TXT, `FileSpreadsheet` for XLSX and CSV, `Presentation` for PPTX, `FileImage` for PNG and JPEG) and the name as a long-text column with the type as a `--text-micro` label beneath, the size right-aligned with `tabular-nums`, who added it with their part in `--text-caption`, when (Dates and times), where it came from, and the actions the server allows this viewer: `Download` as an outline small pill with its icon, then `Remove` as a ghost small pill. Below 768px each file is a card: icon and name, type and size, who and when, then `Download` at full width and the touch-target height, with every other action in a bottom sheet opened by an icon-only `More actions for {name}` circle. A file that cannot be downloaded shows a status badge from the one mapping in place of `Download`, with its consequence in a `--text-caption` line: `Waiting for malware check` (`ShieldEllipsis`), `Blocked` (`ShieldX`) or `File unavailable` (`FileX`); all are neutral, because none is work waiting on a person, and an available file shows no badge. Removed files leave the list for a collapsed `Removed files` group behind an outline toggle with its count, each showing who removed it and when, with `Restore` for the person who removed it; removing and restoring apply at once with an Undo toast and never ask for confirmation. Files never preview inline; they only download, and a download shows its pending state in its button. A file shown inside another record, such as a note, is a file chip: a rectangle with a 1px `--color-border-default` boundary, `--radius-md` and 8px by 12px padding holding the icon, the name on one line, the size and an icon-only `Download {name}` or the file's badge; only a chip can show the neutral `Removed` badge (`ArchiveX`), because a removed file is no longer in the list." | D-28 and D-29 ask for the file row, its chip on a note and the states in the one mapping; the tone vocabulary needs the reasoning for neutral recorded. Phase 20's evidence files reuse it. |
| X-22 | §4 Status & risk badges, after "AI input mark" | AI input mark for files | "**AI input files (CSRM extension, 2026-10-01; extends AI input mark).** A file whose text a Security Analyst may include carries the AI input mark's switch, with a `--text-caption` / `--color-text-secondary` line beneath it stating what is sent: `Not included`, `Included · all {m} characters` or `Included · first {n} of {m} characters`, so truncation is never silent. Turning it on reads the file first, so the switch waits for the server with `Reading the file’s text…` and the 16px inline spinner, then confirms with an Undo toast; turning it off applies at once. A file that cannot be included shows one `--text-caption` line saying why in place of the switch; a reason that applies to every file, such as the request's data classification or a requesting analyst, is said once for the section instead. `Preview text` (ghost, small, `ScanText`) opens a side sheet with the stored text exactly as sent, in a `--color-bg-inset` well in `--text-body` with line breaks kept, ending with how much is left out. In the `AI inputs changed` signal a file's caption is `Included since`, `Excluded since` or `Removed since`; in `What the AI used` a `Files` group lists each included file by name with its part and the characters sent, and a file removed since the run still shows, marked `Removed since`. A Requestor sees only the section's sentence that a Security Analyst may include a file's text." | D-30 to D-36 extend X-18 to files, where the facts, the wait for extraction and the preview are new. |
| X-23 | §2 Voice, new "File names and sizes" paragraph | Names, sizes and types | "**File names and sizes (CSRM extension, 2026-10-01).** A file's name is shown as stored, escaped as text and wrapping anywhere; where one line is required it ends in an ellipsis beyond 28rem, with the full name in the DOM and in the accessible name of its controls. A size uses 1,024-byte units to match the limit's label: under 1 KB `{n} bytes`, under 1 MB whole kilobytes rounded up (`640 KB`), otherwise megabytes to one decimal place (`2.4 MB`), with `tabular-nums`. A file type is named by its extension in capitals (`PDF`, `DOCX`, `XLSX`, `PPTX`, `CSV`, `TXT`, `PNG`, `JPEG`) in a label, and in sentences as `PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG`." | D-10 labels 25 MiB "25 MB"; sizes must read consistently with it everywhere (queue, list, refusals, Phase 19's exports). |

---

## Decisions recorded

Made without asking, as this phase's discussion and UI contract run in auto mode. Each follows the locked context, `AGENTS.md`, the glossary and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | People see "file" (`Files`, `Add files`); "attachment" stays the record and API term. | Plain words for both actors (Phase 11 "no internal terms"); the glossary's "Attachment" entry says how it is shown. |
| UI-D2 | `Files` sits directly before `Notes` on both request pages, with a hub `Files` row. | `Notes` stays last (13 UI-D13), and files sit next to the conversation that explains them. |
| UI-D3 | On the new form, files wait for `Save draft`; once the draft exists, the address becomes its edit route without navigating, and the page moves on only when every file has settled. | D-26's flow; a reload after creation lands on the draft, so saving again can never create a second request. |
| UI-D4 | On the draft (edit form and request page), files are added as soon as they are chosen. | The draft exists, files are their own records, and immediate feedback beats a hidden pending save; the description says so. |
| UI-D5 | While files are in flight, the submit confirm is disabled with a line saying why; a refused file does not block submission. | A file still sending when the request becomes submitted would be refused for lacking a note (D-17); waiting removes that race. |
| UI-D6 | After submission, the `Files` section's field hands files to the Notes composer and focuses its textarea. | D-27; one place to say what files are, so every file has its note. |
| UI-D7 | A note with files but no text is refused with `Write a note to say what these files are.` | D-17 makes the note the files' context; Phase 13's empty-note rule extended. |
| UI-D8 | The composer's control is `Attach files`, not `Add files`. | Two "Add" buttons side by side (`Add files`, `Add note`) would blur which one posts. |
| UI-D9 | A file left over after its note's window offers `Add with a new note`, moving it to the composer. | No lost input once the 60-minute note window (D-17) closes. |
| UI-D10 | Unsent composer files stay in memory for the tab, never in browser storage; reload is guarded. | File contents must not persist in the browser; text keeps Phase 13's session store. |
| UI-D11 | Only the queue's count line announces; stages do not. | Twenty files times five stages would flood assistive technology. |
| UI-D12 | The refused stage reads `Not added.` with the reason. | "Refused" sounds like a judgement of the person; the reason carries the specifics. |
| UI-D13 | The same file chosen twice is listed once. | A double drop is an accident, not intent; it would otherwise consume the 20-file limit. |
| UI-D14 | Every attachment state is neutral; an available file shows no badge. | The tone vocabulary reserves warning for analyst work and danger for overdue, as the CSV import rows did; icon and words carry "Blocked". Badges only on exceptions keep the list calm. |
| UI-D15 | `Download` is an explicit button; the name is not a link. | A record link opens a record; files only download (decision 2, no preview), so the action is named. |
| UI-D16 | On phones `Download` stays on the card; other actions go to a bottom sheet. | D-28's sheet, with the most frequent action one tap away. |
| UI-D17 | Removal applies at once with Undo; the removed group is collapsed and offers `Restore` only to the remover. | D-20 and D-19; reversible, so no confirmation (G-4). |
| UI-D18 | Removing an included file says it left the AI inputs; restoring says to include it again. | D-20 ends inclusion and restoring does not re-include; the analyst must not assume otherwise. |
| UI-D19 | Turning inclusion on waits for the server; turning it off is optimistic. | Extraction can fail (`ATTACHMENT_TEXT_UNAVAILABLE`); D-29 limits optimism to known results. |
| UI-D20 | The file switch reuses X-18's label `Changes the AI inputs`. | One vocabulary for notes and files feeds the one signal; the facts line says what is sent. |
| UI-D21 | Policy and own-request reasons show once per section, not per file. | Twenty identical lines would bury the list. |
| UI-D22 | `Preview text` opens an X-13 sheet with the text exactly as sent. | D-31's preview; the analyst checks what the AI reads before generating. |
| UI-D23 | The sheet group is `Files`, listed by current name. | D-35 resolves names at read time; consistency with the section. |
| UI-D24 | Sizes use 1,024-byte units with KB and MB labels (X-23). | The 25 MiB limit is labelled "25 MB" (D-10); a 25.5 MB decimal reading of an allowed file would contradict it. |
| UI-D25 | A download shows `Downloading…` in its button and no toast. | Up to 25 MB can take seconds; the browser's own download UI is the confirmation. |
| UI-D26 | Pending files tell people to refresh later; nothing polls. | D-13 and 11 D-11. |
| UI-D27 | The hint counts how many more files can be added; at the limit the field gives way to a line. | Every count is visible before a refusal, and the next step is named. |
| UI-D28 | Where storage is not configured, no add control is offered, only a line. | UX-06 and D-15: offer nothing the server will refuse. |
| UI-D29 | The new-request form's partial failure keeps the page and offers `Go to draft`. | No lost input, with an explicit way out. |
| UI-D30 | Drops outside the field are ignored on pages holding a field. | A stray drop would make the browser open the file and leave the page, losing input. |
| UI-D31 | Detection names are shown to both actors. | The uploader needs it for their IT service desk (D-11); it is data, shown verbatim. |
| UI-D32 | Released and closed requests keep their AI facts lines as read-only. | The record shows what was included; decision 9 makes it immutable. |
| UI-D33 | No visible string uses `Accept` (the `accept` attribute is not copy). | G-14 reserves Accept for the risk owner. |
| UI-D34 | Extensions are numbered X-19 to X-23. | They continue Phase 13's X-18 (the spawn prompt). |
| UI-D35 | Every not-added row (refused or transfer-failed) on a draft surface, the new-request form once its draft exists, or a note is kept in the tab's in-memory file store per person and request, restored where it was listed, cleared on add, `Remove from list`, submitting anyway or sign-out, and arms `beforeunload` on every page while kept; in-app links, including `Go to draft`, show no dialog. | G-4 no lost input on every navigation path, and D-26's guard over unsent input. It reuses §4.3's store (UI-D10) and Phase 13's reading (13 UI-D17, UI-D18, UI-D31): once in-app navigation no longer loses the file, a blocking dialog would only interrupt, and `Go to draft` stays an explicit way out (UI-D29). |

---

## Notes carried

- **For the orchestrator.**
  - Confirm UI-D1: the glossary's "Attachment" entry (a Phase 14 plan task, CONTEXT canonical refs) records that the product shows an attachment as a "file".
  - Confirm UI-D14: attachment states are neutral under the tone vocabulary, as the CSV import precedent chose warning over danger.
  - X-22 extends X-18, so Phase 13's recording task must run before Phase 14's.
- **Research to verify.** Replacing the address after the draft is created (UI-D3; Next.js `window.history.replaceState`); the shared "files in flight" state the submit dialog reads (UI-D5); ignoring page-level drops (UI-D30); the tab's in-memory file store (§1.5, §4.3, UI-D35) as a client provider above the request routes in the `(app)` layout, so `File` objects survive client-side navigation.
- **Phase 12 copy extended.** §7.2 adds a files variant of `CONTEXT_TOO_LARGE`; its file list depends on the job's failure carrying the files (D-33).
- **Route budget.** The analyst questionnaire and assessment pages gain server-rendered text only; the queue, the composer's files and the text preview load on demand (D-29).
- **Later phases.** Phase 17's participant views show no `Files` section. Phase 19 reuses `lib/files` and X-23. Phase 20's evidence files reuse X-19 to X-21 and family N.

---

## UI Considerations

These rows are written inline from the contract. The ui-phase consideration probe (Step 9.5) replaces them when it runs.

Applicable state considerations resolved: 25 covered, 3 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| empty | Files section | covered | Four variants by actor and window (§3.7) |
| empty | Removed group; note files | covered | No toggle at zero; no list on a note without files |
| empty | AI facts; sheet group | covered | `Not included`; `None included` (§5.1, §7.1) |
| loading | Files section; text preview | covered | Page skeleton block; skeleton after 300ms (§3.7, §5.3) |
| loading | Upload, download, inclusion | covered | Inline stages `Adding…`, `Downloading…`, `Reading the file’s text…` |
| error | Each upload | covered | Family N per row with its fix and `Retry` (§1.4, §8.1) |
| error | Draft created, files failed | covered | §2.2 alert with `Go to draft`; saving again never duplicates |
| error | Note posting with files | covered | Note rollback returns text and files (§4.2) |
| error | Files not added, then an in-app link | covered | Kept for the tab and restored where listed, including after `Go to draft`; `beforeunload` while kept (§1.5, §10) |
| error | Download, remove, restore, inclusion | covered | Families O and P; rollback toasts (§8, §9) |
| error | Files read | covered | Compact error; the add control stays (§3.7) |
| permission | Another Requestor; participants | covered | The request page's not-found state; nothing of the files anywhere (§3.7) |
| permission | Requestor; requesting analyst; policy | covered | No switch; section line says why (§5.1) |
| permission | Closed, paused, not configured, limit | covered | Lines in place of the field (§1.2, §3.6) |
| populated | Every surface | covered | §1 to §7 |
| partial | File states | covered | Pending, blocked, unavailable, removed (§3.4) |
| partial | Queue | covered | Mixed added, pending and not-added rows with the count line (§1.4) |
| overflow | File table | covered | Labelled scroll region with sticky `Name`; cards below 768px (§3.7) |
| overflow | Queue of 20 | covered | Rows in place; the count line on top (§1.4) |
| overflow | Preview text | covered | The sheet body scrolls; the end line states truncation (§5.3) |
| long-text | File names | covered | Wrap anywhere; one-line chips end in an ellipsis with the full name in the DOM (X-23) |
| long-text | Names in toasts | backstop | `{ statement: "A remove toast naming a 255-character file name wraps at 375px and its Undo stays visible and reachable", verification: backstop }` |
| long-text | Composer with chips at 375 | backstop | `{ statement: "At 375px the composer with five file chips, its hint, Attach files and Add note fit without horizontal scroll", verification: backstop }` |
| overflow | AI cell at compact density | backstop | `{ statement: "In compact density at 1440px the AI inputs cell's switch, facts line and Preview text keep 24px targets and wrap without overlapping the actions column", verification: backstop }` |
| zero-one-many | Counts | covered | `{n} {file|files}`, `{k} {file wasn’t|files weren’t} added`, `{r} more can be added` written out |
| zero-one-many | Changed inputs | covered | Notes and files share one list; absent at zero (§6.2) |
| zero-one-many | Limit edges | covered | 19 to 20 replaces the field; restore at 20 refused with its copy (§1.2, §8.2) |
| zero-one-many | Truncation | covered | `all {m}` and `first {n} of {m}` (X-22) |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | None new. The existing `Button`, `Sheet`, `Switch`, `Label`, `Alert`, `Skeleton` and `sonner` `Toaster` | Not required: no block added and no registry fetched (2026-10-01) |
| Third-party | none | Not applicable |

No new web dependency.

---

## Verification contract

- **Unit and component (Vitest):**
  - field and queue: the hint with the remaining count, the pre-checks with family N's copy, duplicate choice, every stage, one-at-a-time sending, `Retry` with the same file, `Choose another file`, `Remove from list` focus, each row control's file-specific accessible name, the count line as the only announcement, drops outside ignored;
  - kept rows (§1.5): a refused and a transfer-failed row survive an in-app navigation away and back on the draft's request page and edit form, and after `Go to draft`, with the restored caption and `Retry` still sending the same file; cleared on add, `Remove from list`, submitting anyway and sign-out; `beforeunload` armed on another page while a row is kept;
  - the new form: files kept on validation and create failures, `Adding files…`, the address replaced, the §2.2 alert, saving again updating the same draft, the leave dialog;
  - the edit form and draft: immediate adding; the submit dialog's wait line;
  - the Files section for the Requestor, an analyst, a requesting analyst, a returned draft and a released or closed request; every state badge and line; the removed group, `Restore` only for the remover, optimistic remove with Undo, rollback and focus; the phone card and actions sheet;
  - the composer: chips, the note-first order, rollback with files, `Add with a new note`, the kept files and the `beforeunload` guard;
  - AI: the switch for analysts only, waiting on, optimistic off, facts lines, image and pending lines, section-level lines, the preview sheet's states, the signal items and the sheet group;
  - downloads: the helper's validation (type, name, size, signature) and family O;
  - refusal states: another Requestor sees not found; no AI control for a Requestor or a requesting analyst; no add or remove on a closed request;
  - copy: no `Accept`; X-23 size formatting at the unit boundaries.
- **Contract parity:** every new parser, and the file-response mode, joins `contract-response-parity.test.ts` (D-03).
- **E2E** (dev servers stopped): D-39's journeys at 375 and 1440 with axe, using these contract strings: Jane's three files at intake and the PPTX with a note; Bob's download; the Secondary Requestor's not-found state; the four refusals with their family N copy; remove, Undo and remove again with `Removed by`; Bob including the PDF with `Included · first {n} of {m} characters` and "What the AI used" listing it.
- **Browser backstops** (orchestrator): the three UI Considerations backstops; NVDA reading the queue's count line once per settled file and a remove toast's `Undo` by `Alt+T`; a dropped file outside the field leaving the page intact; a reload after the draft is created landing on its edit route; a transfer-failed file on the new-request form following `Go to draft` and showing on the draft with `Retry`.

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
