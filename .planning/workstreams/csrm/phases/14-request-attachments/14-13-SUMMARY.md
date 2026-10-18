---
phase: 14-request-attachments
plan: 13
subsystem: ui
tags: [nextjs, server-actions, react, useOptimistic, sonner, radix-sheet, playwright, axe, attachments]
requires:
  - phase: 14-request-attachments
    provides: "14-05 family O (attachmentFileRefusal, downloadFailureTitle, downloadCheckFailedMessage); 14-07 downloadRequestAttachment and lib/files/file-response.ts; 14-08 setRequestAttachmentRemoval and the request read's attachments summary; 14-12 the domain, actions, field, queue, store, FilesList and FilesSection"
  - phase: 13-request-pick-up-and-notes
    provides: "X-14 Undo toasts (successToast, toastAction), the bottom-sheet pattern of assign-picker.tsx, NotesSkeleton and the hub's Notes row"
provides:
  - "lib/files/save-file.ts saveFile: checked bytes to a Blob behind a download anchor (Phase 19 reuses it)"
  - "attachments-actions.ts downloadAttachmentAction (flat { ok, fileName, contentType, bytes } or family O) and setAttachmentRemovalAction"
  - "FilesList: Download, optimistic Remove and Restore with Undo and rollback, the removed group, the state badges, the phone card's actions sheet, FilesReadError"
  - "FilesSection.filesSectionFor (D-18), used by both request pages; the analyst request page renders Files before Notes"
  - "the attachment family in the one status mapping (five neutral values)"
  - "the hub's Files row; FilesSkeleton before Notes on both request page skeletons"
  - "DataTable paginated={false} and a column's headerHidden"
  - "the copy guard covers features/attachments and lib/files, with no Accept"
  - "E2E COLLAB02_ANALYST_DOWNLOAD, COLLAB02_OTHER_REQUESTOR_NOT_FOUND and COLLAB02_REMOVE_UNDO (@journey, 1440 and 375)"
affects: [14-14, 14-15, 14-16, 14-17, 19, 20]
actuals:
  tokens: 34562
  tasks: 3
  commits: 5
plan_head_before: 83b4c770e1764d4ba69e20451f5a8db2d556a508
plan_head_after: f7a6e6c45baf2a7eb60b37a35906b46d7879854b
tech-stack:
  added: []
  patterns:
    - "A download is a Server Action that returns bytes the server already checked; the browser only saves them (no Route Handler, no raw fetch)"
    - "An optimistic list keeps what Strapi last served in state, reset when the page's prop changes, under useOptimistic; each answer replaces its file, then one router.refresh()"
    - "A DataTable whose cells hold focusable controls keeps its columns stable (useMemo) and reads changing handlers through context, so a change never remounts a focused cell"
key-files:
  created:
    - apps/csrm/src/lib/files/save-file.ts
    - apps/csrm/src/lib/files/save-file.test.ts
    - apps/csrm/src/features/attachments/files-list.test.tsx
    - apps/csrm/src/features/attachments/files-skeleton.tsx
  modified:
    - apps/csrm/src/features/attachments/files-list.tsx
    - apps/csrm/src/features/attachments/files-section.tsx
    - apps/csrm/src/features/attachments/files-section.test.tsx
    - apps/csrm/src/features/attachments/attachments-actions.ts
    - apps/csrm/src/features/attachments/attachments-actions.test.ts
    - apps/csrm/src/features/attachments/attachments-domain.ts
    - apps/csrm/src/components/csrm/status-badge.tsx
    - apps/csrm/src/components/csrm/status-badge.test.tsx
    - apps/csrm/src/components/csrm/data-table.tsx
    - apps/csrm/src/components/csrm/data-table.test.tsx
    - apps/csrm/src/features/requests/request-hub.tsx
    - apps/csrm/src/features/requests/request-hub.test.tsx
    - "apps/csrm/app/(app)/app/requests/[documentId]/page.tsx"
    - "apps/csrm/app/(app)/app/requests/[documentId]/loading.tsx"
    - "apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx"
    - "apps/csrm/app/(app)/app/review/requests/[documentId]/loading.tsx"
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/request-attachments.spec.ts
key-decisions:
  - "The attachment family of the status mapping moved from Task 2 to Task 1, because Task 1's pending file renders its badge from the one mapping."
  - "The removed group stays collapsed when a file is removed: its toggle's count changes at once and the Undo toast confirms (UI-D17 keeps the list calm)."
  - "A restored file returns at the pending opacity with no actions until Strapi answers, because it may come back pending rather than available."
  - "Download is named by aria-label (`Download {name}`, `Downloading… {name}`), so the file's name is never in its row's text twice."
  - "The hub's Files figure is built in request-hub.tsx (as holderRow is), so the analyst page's client bundle does not take refusal-copy.ts through the hub."
  - "On the analyst page the Secondary Requestor meets the page's existing role alert; on the Requestor page, its not-found state (the plan allows either)."
  - "FilesList takes viewer and no aiPolicy yet: the AI column, its switch and its policy lines are 14-16's."
patterns-established:
  - "File controls carry data-file-actions={id} with data-layout table or card, so focus after a change goes to the layout the viewport shows"
requirements-completed: [COLLAB-02]  # traced here; COLLAB-02 stays Pending until the 14-17 phase gate
coverage:
  - id: D1
    description: "Bob downloads Jane's security pack from the analyst request page: the Files section directly before Notes, Download named for its file, Downloading… while it comes, the browser saves vendor-security-pack.pdf with the bytes Jane added (%PDF-), said once, no inline preview, axe clean, at 1440 and 375"
    requirement: COLLAB-02
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_ANALYST_DOWNLOAD @journey (desktop and mobile)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/attachments/files-list.test.tsx#Download on the Files list (§3.3); attachments-actions.test.ts#downloadAttachmentAction; src/lib/files/save-file.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Remove applies at once with an Undo toast (Alt+T reaches it), rolls back on refusal with File not removed, File not restored or Couldn’t undo and Try again or Refresh page; the removed group shows Added by and Removed by with times and Restore for the remover only; nothing asks for confirmation; both actors see the record"
    requirement: COLLAB-02
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_REMOVE_UNDO @journey (desktop and mobile)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/attachments/files-list.test.tsx#Remove with Undo (§3.5, §9); #the removed group (§3.5); attachments-actions.test.ts#setAttachmentRemovalAction"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Secondary Requestor gets the Requestor page's not-found state and the analyst page's own refusal, with no file name, Files heading, section or hub row there, on her Home or her list, at 1440 and 375"
    requirement: COLLAB-02
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_OTHER_REQUESTOR_NOT_FOUND @journey (desktop and mobile)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/attachments/files-section.test.tsx#filesSectionFor (D-18); request-hub.test.tsx#adds no Files row when the read carries no file summary"
        status: pass
    human_judgment: false
  - id: D4
    description: "File states in the one mapping (every one neutral; no badge for an available file), the §3.7 empty states and §1.2/§3.6 lines, the 20-file limit, the compact read error with Try again, the hub's Files row, the skeleton blocks, the unpaged table with a hidden Actions header, the phone card and actions sheet with its focus rules, and the copy guard with no Accept"
    verification:
      - kind: unit
        ref: "status-badge.test.tsx; files-section.test.tsx; request-hub.test.tsx#RequestHub’s Files row; data-table.test.tsx; files-list.test.tsx#the phone card and its actions sheet; interface-copy-guard.test.ts#the request attachments copy"
        status: pass
    human_judgment: false
  - id: D5
    description: "A remove toast naming a 255-character file name wraps at 375px and its Undo stays visible and reachable; the list, removed group and actions sheet against X-21 at both widths"
    verification: []
    human_judgment: true
    rationale: "The plan marks the long-name toast a backstop for the orchestrator's browser pass; Playwright proves the journeys, overflow and axe at both widths but not a 255-character toast's wrapping."
duration: 64min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 13: The Files Section on Both Request Pages Summary

**Both request pages now carry the full `Files` section. Bob downloads Jane's security pack through a Server Action that checks the bytes on the server; the browser saves them through the new `saveFile` helper and nothing previews inline. Jane removes a file at once with an Undo toast, and a refused change rolls back with family O's words. Removed files sit in a collapsed group that says who added and who removed each one, with `Restore` for the remover only. Pending, blocked and unavailable files show neutral badges from the one status mapping. Phones get cards with a full-width `Download` and an actions sheet. The hub gains a `Files` row and both skeletons a `Files` block. Three Playwright journeys prove the download, the removal record and that another Requestor finds nothing, at 1440 and 375.**

PHASE_14_BASE=e50053f. COLLAB-02 is traced here but stays Pending until 14-17's phase gate (`requirements-completed` copies the plan's array, as the template asks). REQUIREMENTS.md is unchanged.

## Performance

- **Duration:** 64 min (2026-10-10T06:56:09Z to 08:00:44Z), including one full Playwright run (26.3 min).
- **Tasks:** 3 of 3. Tasks 1 and 2 went test first (a RED commit, then a GREEN commit), and Task 3 is a test-only journey commit. Task 1 is the tracer: its verify passed end to end on both projects (6/6) before its GREEN commit, so expansion went ahead with no checkpoint (interactive, end-of-phase, automated-only verify).
- **Files:** 22 (4 created, 18 modified; 1,890 lines added, 64 removed).

## Accomplishments

- **Download (D-23, D-24; UI-D15, UI-D25).**
  - `downloadAttachmentAction` reads the file through `downloadRequestAttachment`, so the shared validator has checked it before any byte leaves the server. It returns `{ ok: true, fileName, contentType, bytes }` (a `Uint8Array`) or family O. A failed check reads `downloadCheckFailedMessage` and is retryable.
  - `saveFile` turns the bytes into a Blob of their checked type, clicks an anchor with `download` and `rel="noopener"`, and revokes the URL on the next tick. There is no Route Handler and no raw `fetch`.
  - The button reads `Download`, is named `Download {name}`, and shows `Downloading…` with the inline spinner while the file comes. A visually hidden status then says `{name} downloaded.` once. A refusal is a danger toast titled `File not downloaded`, with `Try again` or `Refresh page`.
- **Remove, Undo and Restore (D-20, D-21; UI-D17, UI-D18).**
  - `setAttachmentRemovalAction` returns the file as the caller now sees it, or family O's sentence for the action asked.
  - `FilesList` keeps what Strapi last served under `useOptimistic`. `Remove` moves the file to the removed group at once, at the pending opacity, then shows an X-14 toast with `Undo`. Undo is a second recorded change. A refusal rolls the change back with `File not removed`, `File not restored` or `Couldn’t undo`, and `Try again` or `Refresh page`. Nothing asks for confirmation.
  - Removing an included file adds ` Its text is no longer included in the AI inputs.` to the toast, and undoing it adds ` Include its text again if the AI should use it.`
  - Focus follows §3.5: the next file's first action after Remove, else the previous file's, else the `Files` heading. After Restore or Undo it goes to the restored file's first action. On rollback it stays where it is.
- **The removed group (§3.5).** `Show removed files ({n})` / `Hide removed files` is an outline toggle with `aria-expanded`, `aria-controls` and the chevron swapped, and is absent at zero. The `ul` named `Removed files` shows each file's type and size, `Added by {name} · {time}` and `Removed by {name} · {time}`. `Restore {name}` shows for the remover only, and there is no Download. The group prints only when it is open.
- **States (§3.4; UI-D14).** `statusPresentation.attachment` holds five neutral values: `Available` (`ShieldCheck`), `Waiting for malware check` (`ShieldEllipsis`), `Blocked` (`ShieldX`), `File unavailable` (`FileX`) and `Removed` (`ArchiveX`). A file that cannot be downloaded shows its badge and §3.4's line in place of `Download`; a blocked file's line names the detection. An available file shows no badge.
- **Phones (X-21, UI-D16).** Each card has `Download` at full width and the touch-target height. When the file has other actions, the icon-only `More actions for {name}` (`aria-haspopup="dialog"`) opens a bottom sheet titled with the file's name, holding `Remove` and `Close` (named `Close actions for {name}`). Focus moves to the title on open and back to `More actions` on close.
- **The section and pages.**
  - `filesSectionFor(request, files, { viewer, draftOwnerKey })` returns the section's props only when the request read carries `attachments` (D-18). Both request pages use it, and the analyst request page now reads the files and renders the section directly before Notes.
  - A failed files read shows the compact `We couldn’t load the files` error, whose `Try again` refreshes in place, and the add control stays.
  - The hub's `Files` row follows `Notes`: `{n} {file|files}` linking to `#files`; with none, `Add files` while files can be added, else `No files`.
  - `FilesSkeleton` (a heading line, three rows, three phone cards and a field-height block) sits before the Notes block on both loading states.
- **DataTable.** `paginated={false}` drops the pager and the results count, and the density toggle stays. A column's `headerHidden` keeps its header for assistive technology only, so the file table has no `Page 1 of 1` and its Actions header is visually hidden.
- **Copy guard.** Every shipped module of `features/attachments` and `lib/files` is guarded, and no visible string there contains `Accept` (UI-D33).

## Task Commits

1. **Task 1 (tracer):** `cb2cdbd` test (RED), `1ef2009` feat (GREEN)
2. **Task 2:** `42b8e87` test (RED), `5dfdf4c` feat (GREEN)
3. **Task 3:** `f7a6e6c` test (the two journeys)

`git rev-list --count 83b4c770..HEAD` is 5 before this summary's commit.

## Verification

- **RED evidence.** Vitest JUnit output was checked with `check tdd-red-evidence`, which returned `RED_EVIDENCE_OK` for every target named (attributes swapped as in 14-12; see Issues).
  - **Task 1:** 25 of 100 failed on assertions, against throwaway stubs deleted before the RED commit. Targets checked: Downloading… then saved and said once, the refused-download toast, the pending badge, `saveFile`, the action's bytes and its failed check, and the neutral Blocked badge.
  - **Task 2:** 31 of 436 failed. Targets checked: the optimistic remove with Undo, the rollback toast, the removed group's lines and Restore, the phone sheet's focus, `filesSectionFor`, the skeleton blocks, the hub row, `paginated={false}`, the restore refusal, and the read error's Try again.
  - Already green at RED, built by 14-12 or Task 1: the empty states and §1.2/§3.6 lines, the 20-file limit, no Remove on a closed request, no toggle at zero, Remove only where allowed, the unavailable state, the removal action's input refusal, and the guard's coverage and no-Accept cases.
- **GREEN, focused:**
  - Task 1: `vitest run src/features/attachments src/lib/files src/components/csrm/status-badge.test.tsx src/lib/performance/zod-client-boundary.test.ts`: `Tests 203 passed (203)`. The page and badge importers (11 files): `Tests 534 passed (534)`. Typecheck and lint clean. `test:e2e e2e/request-attachments.spec.ts`: 6 passed (desktop and mobile; the download journey 6.1 s and 5.8 s).
  - Task 2: `vitest run src/features/attachments src/components/csrm/status-badge.test.tsx src/components/csrm/data-table.test.tsx src/features/requests/request-hub.test.tsx src/lib/performance/interface-copy-guard.test.ts src/lib/performance/zod-client-boundary.test.ts`: `Tests 437 passed (437)`. Typecheck and lint clean.
  - Task 3: `test:e2e e2e/request-attachments.spec.ts`: 10 passed (1.9 min). The not-found journey took 5.4 s and 5.2 s, and the remove-and-undo journey 7.3 s and 7.2 s.
- **Full suites:**
  - Web (`pnpm --dir apps/csrm test`, on the Task 2 source): 205 files, `Tests 4631 passed (4631)` (52 s).
  - Playwright (`pnpm --dir apps/csrm test:e2e`, on `f7a6e6c`): 211 passed and 1 failed of 212 (26.3 min); desktop 160 of 160, mobile 51 of 52. The failure was `REQ08_REASSIGN_THROUGH_PICKER` (mobile, Phase 13's assignment history): axe measured contrast 4.01 on a caption inside a `.transition-opacity` wrapper, a scan taken mid-fade. The spec re-run on mobile passed 10/10, so it is a flake outside this plan.
  - `api:check` exits 0 with no contract change (`schema.d.ts` refreshed, not staged).
  - The Strapi suite was not run: this plan changes no Strapi source, specification or configuration.
- **Route budgets (delivered JS, desktop):**
  - `/app/requests/{documentId}` 286,175 of 300,000 (280,503 at 14-12)
  - `/app/risks/{documentId}` 293,353 (6,647 bytes left; 290,944 at 14-12; the shared status mapping's five new icons)
  - `/app` 228,783; `/app/requests` 251,082; `/app/risks` 262,300
  - `/app/review/assessments/{documentId}` 317,190 of 460,000; `/app/questionnaires/{documentId}` 356,424 of 500,000
  - Every route is within budget, with no override.
- **Acceptance criteria:**
  - No `route.ts` or `route.tsx` was added under `apps/csrm/app` since `e50053f`, and `save-file.ts` and `files-list.tsx` contain no `fetch(`.
  - `status-badge.tsx` holds `Waiting for malware check`, `File unavailable` and `ArchiveX` in the neutral attachment family.
  - `files-list.tsx` renders no `AlertDialog` or `ConfirmDialog`.
  - The spec has `COLLAB02_OTHER_REQUESTOR_NOT_FOUND` and `COLLAB02_REMOVE_UNDO`, both `@journey`.
  - `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing, and every verify command exits 0.

## Decisions Made

See `key-decisions` in the frontmatter (one line each).

## Deviations from Plan

1. **[Plan shape] The status mapping's attachment family went in with Task 1.** Task 1's pending file renders its badge from the one mapping, so Task 1's RED carried the family's rows (`cb2cdbd`, `1ef2009`).
2. **[Rule 3 - Blocking] `data-table.tsx` and its test changed (outside the plan's list).** The worker brief assigns the removal of `Page 1 of 1` and `{n} results` to this plan through a DataTable option. `paginated={false}` and `headerHidden` were added test first (`42b8e87`, `5dfdf4c`); every other DataTable keeps its pager.
3. **[Rule 3 - Blocking] `files-skeleton.tsx` added.** Both loading files share one Files block, as they share `NotesSkeleton` (`5dfdf4c`).
4. **[Rule 1 - Bug] Focus was lost after a change.** The table's columns were rebuilt on every render, so tanstack remounted each cell and the focused button went with it. The columns are now built once per layout (`useMemo`), and the cells read the handlers through context (`5dfdf4c`; the focus tests prove it).
5. **[Test harness] RED tests adjusted in GREEN, assertions unchanged in meaning.**
   - Task 1: the action's `Uint8Array` is checked by its tag, because the test environment's typed array is another realm's. The Blob is read with `FileReader`, and fake timers apply only to the revoke case. The status is found by its text, because the DataTable's `output` elements are statuses too.
   - Task 2: a closed group is `hidden`, so it has no accessible name and is found by its `aria-label`. Assertions after a transition wait for its render.
6. **[Test fix] The analyst page's refusal for a Requestor is its role alert, not a state frame.** The not-found journey asserts `You don’t have permission to review this request` there (`f7a6e6c`).
7. **[Plan shape] `FilesList` has no `aiPolicy` prop yet.** It takes `viewer`; the AI column is 14-16's.

**Total deviations:** 7 (1 Rule 1, 2 Rule 3, 4 plan-shape or test notes). **Impact:** no change to scope. No content type, schema field, relation or contract changed, and no dependency was added.

## Issues Encountered

- **The RED-evidence parser reads `classname` first.** As in 14-12, `check tdd-red-evidence` was run on a copy of the JUnit report with `name` and `classname` swapped. The tests and their results were unchanged.
- **A shell heredoc broke on one test edit** (bash read a quote inside the block). The block was appended from a scratch file instead, and no file was left half-written.
- **Next logs `The destination stream closed early`** while a journey navigates away from a page that is still streaming. Every test passed regardless.
- **The failed full run kept its scratch database and builds** under `apps/backend/.tmp` and `apps/csrm/.tmp` (gitignored). They were left for the pilot.

## Known Stubs

None that block this plan's goal. These are planned for later plans:
- The analyst's AI column, switch, facts line, `Preview text` and section-level policy lines: 14-16.
- `Add files with a note` after submission: 14-15.

## Threat Flags

None beyond the plan's register:
- **T-14-46 is mitigated.** Bytes reach the browser only after `validateFileResponse` on the server. They are saved through a Blob and an anchor with `download`, never previewed inline.
- **T-14-47 is mitigated.** `filesSectionFor` renders nothing without a file summary, and `COLLAB02_OTHER_REQUESTOR_NOT_FOUND` finds no file name, Files heading or hub row for the Secondary Requestor.
- **T-14-48 is mitigated.** Only the served `actions` render, and Strapi re-checks each one.
- **T-14-SC is accepted.** No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-14** reuses the field and queue on the new-request form; nothing here changes their contract.
- **14-15** hands files to the composer. Notes' file chips can reuse the attachment family's `Removed` badge.
- **14-16** adds the AI column to `fileColumns` and the switch to the actions sheet. `FileHandlers` is the place for its handlers, so the columns stay stable.
- **Route budget:** `/app/risks/{documentId}` has 6,647 bytes left. Watch any change to shared modules such as `status-badge.tsx`.

## Self-Check: PASSED

- FOUND: every file in `key-files` (created and modified).
- FOUND: `cb2cdbd`, `1ef2009`, `42b8e87`, `5dfdf4c`, `f7a6e6c`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
