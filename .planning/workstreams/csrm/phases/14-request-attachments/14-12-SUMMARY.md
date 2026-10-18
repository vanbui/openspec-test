---
phase: 14-request-attachments
plan: 12
subsystem: ui
tags: [nextjs, server-actions, react, file-upload, playwright, axe, attachments]
requires:
  - phase: 14-request-attachments
    provides: "14-05 attachmentAddRefusal (family N) and the transport's reason and detection on any 4xx; 14-06 to 14-09 attachments-service.ts (listRequestAttachments, uploadRequestAttachment) and attachments-schema.ts; 14-08 the request read's attachments summary"
  - phase: 13-request-pick-up-and-notes
    provides: "13-09 draftOwnerKey and useUnloadWarning; 13-10 the Notes section last on the Requestor's request page; 10-08 navigation-guard.tsx (useLeaveGuard)"
provides:
  - "attachments-domain.ts (zod-free): ATTACHMENT_ACCEPT, ALLOWED_TYPES_SENTENCE, MAX_FILE_BYTES, fileFieldHint, filesCountLabel, filesDescription, filesEmptyState, filesLockedLine, fileTypeLabel, fileTypeIconName, fileUploader, precheckChosenFiles, chosenRow, filesCopy, queueControlNames, filesLeaveCopy; re-exports the queue model"
  - "upload-queue-model.ts (import-free): QueueRow, QueueStage, QueueAction, queueReducer (add, settle, listed, retry, remove, replace, restore), queueCountLine, shownInQueue, holdsRoom, fileKey, TRANSFER_FAILED"
  - "lib/files/format-file-size.ts formatFileSize (X-23)"
  - "attachments-actions.ts ('use server'): listRequestAttachmentsAction, uploadAttachmentAction, type AttachmentActionResult<T>"
  - "FileField with usePageFileDropGuard (X-19, UI-D30); UploadQueue (X-20); AttachmentFileStoreProvider, useAttachmentQueue, useFilesInFlight, useKeptFiles (UI-D35); FilesList (DataTable from 768px, cards below); FilesSection"
  - "AppShell mounts the file store in its authorised branch; the Requestor's request page renders FilesSection before Notes"
  - "useLeaveGuard(blocking, reason, copy?) asks in the words the blocking page registers"
  - "E2E COLLAB02_DRAFT_FILE_ADDED and COLLAB02_REFUSALS (@journey, 1440 and 375); Playwright Strapi pins local storage under the run's directory and the development scanner; the mobile project collects request-attachments.spec.ts"
affects: [14-13, 14-14, 14-15, 14-16, 14-17, 19, 20]
actuals:
  tokens: 28419
  tasks: 3
  commits: 6
plan_head_before: 7b75ea0d13117053dd735061134b99c2cd568c32
plan_head_after: 1d1340d22e29156049fd04f0a6524bc85d7fd4da
tech-stack:
  added: []
  patterns:
    - "One Server Action per file, sent one at a time by a client queue; the page refreshes once after the queue settles, never per file (Pitfall 18)"
    - "Files not added live in a React-state store above the request routes, keyed {ownerKey}:{requestId}:{scope}; File objects never reach browser storage"
    - "Anything the shell loads on every route imports only import-free modules (the store reads upload-queue-model.ts, not the domain or the refusal copy)"
key-files:
  created:
    - apps/csrm/src/features/attachments/attachments-domain.ts
    - apps/csrm/src/features/attachments/upload-queue-model.ts
    - apps/csrm/src/features/attachments/attachments-actions.ts
    - apps/csrm/src/features/attachments/file-field.tsx
    - apps/csrm/src/features/attachments/upload-queue.tsx
    - apps/csrm/src/features/attachments/file-store.tsx
    - apps/csrm/src/features/attachments/files-list.tsx
    - apps/csrm/src/features/attachments/files-section.tsx
    - apps/csrm/src/lib/files/format-file-size.ts
    - apps/csrm/e2e/request-attachments.spec.ts
  modified:
    - apps/csrm/src/components/shell/app-shell.tsx
    - "apps/csrm/app/(app)/app/requests/[documentId]/page.tsx"
    - apps/csrm/src/components/csrm/navigation-guard.tsx
    - apps/csrm/playwright.config.ts
key-decisions:
  - "The queue sends the chosen File without a filename argument, so Retry sends the very File the person chose (a filename makes FormData copy it)."
  - "Added rows leave the queue once the list re-renders; a file waiting for the malware check keeps its row, because its line (nobody can download it yet) is not in the list's row."
  - "After an in-app navigation, a file left waiting is restored as a failed transfer with Retry (never sent behind the person's back); added files are dropped (the list shows them); a file still being added settles where it stands."
  - "The in-flight leave dialog reads 14-UI-SPEC §10's words through a new optional copy argument to useLeaveGuard; nothing else in the guard changes."
  - "After submission (window after-submission, needsNote) the Files section renders no add control yet: the field's handoff to the Notes composer is 14-15's."
  - "#file-{documentId} rides on the layout the viewport shows (matchMedia from 768px), so the id is never on two elements; the table is assumed until the browser says otherwise."
  - "filesEmptyState takes a third argument (whether files can be added) so a paused or closed section reads No files with its locked line."
patterns-established:
  - "Pre-checks are fast feedback only: precheckChosenFiles reuses attachmentAddRefusal so the browser and Strapi refuse in one set of words"
  - "Count lines are written out with en-AU grouping: {a} of {n} files added · {k} not added"
requirements-completed: [COLLAB-02]  # traced here; COLLAB-02 stays Pending until the 14-17 phase gate
coverage:
  - id: D1
    description: "Jane chooses vendor-security-pack.pdf with Choose files on her draft's request page; it is added at once (1 of 1 files added) and joins the Files list with PDF, 2 KB, Jane Doe, Requestor, a time and Before submission, at 1440 and 375, with no serious or critical axe violation"
    requirement: COLLAB-02
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_DRAFT_FILE_ADDED @journey (desktop and mobile)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/attachments/files-section.test.tsx; attachments-actions.test.ts; attachments-domain.test.ts; src/lib/files/format-file-size.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "tool.exe and a 30 MB big.pdf are refused in the browser, a PDF-named PNG and a text file carrying CSRM's test signature by Strapi; each row reads Not added. with family N's sentence, the count line reads 0 of 4 files added · 4 not added, nothing joins the list, at 1440 and 375 with axe"
    requirement: COLLAB-02
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_REFUSALS @journey (desktop and mobile)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The queue sends one file at a time, a refusal never stops the next, the pending stage, Retry with the same File, Choose another file, Remove from list focus, aria-busy while adding, the count line as the only status, the in-flight leave dialog and the beforeunload-only warning for kept rows"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/attachments/upload-queue.test.tsx; apps/csrm/src/components/csrm/navigation-guard.test.tsx#asks in the words the blocking page registered"
        status: pass
    human_judgment: false
  - id: D4
    description: "Refused and failed rows survive an in-app navigation away and back under 'Restored from earlier in this session.', per person; useFilesInFlight counts waiting plus adding; the store stays off the domain module"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/attachments/file-store.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "The field's drag state, drops outside the field cancelled (UI-D30), listeners removed on unmount, the drag line from 768px only"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/attachments/file-field.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "The field, queue rows and list at 375 and 1440 against X-19 to X-21 (visual weight, wrapping, the drag state in a real drag, a 20-file queue)"
    verification: []
    human_judgment: true
    rationale: "Playwright proves the journeys, overflow and axe at both widths; a real drag-and-drop, the drag state's look and a 20-row queue need the phase's UI review and 14-17's browser backstops."
duration: 58min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 12: Adding Files on the Draft's Request Page Summary

**Jane now adds files on her draft's request page. The X-19 field (Choose files always, a drop region from 768px, a hint with the types, 25 MB and the room left) feeds the X-20 queue, which checks each file in the browser and sends the rest one Server Action at a time. Each row shows Waiting, Adding…, Added, the malware-check line or Not added. with family N's reason, and Retry or Choose another file and Remove from list. Files not added stay in the tab's memory and return after in-app navigation. The new Files section lists every file with its type, size, who added it and when. Two Playwright journeys prove the intake and the four refusals at 1440 and 375.**

PHASE_14_BASE=e50053f. COLLAB-02 is traced here but stays Pending until 14-17's phase gate (`requirements-completed` copies the plan's array, as the template asks). REQUIREMENTS.md is unchanged.

## Performance

- **Duration:** 58 min (2026-10-10T05:46:23Z to 06:44:56Z), including one full Playwright run (24.1 min).
- **Tasks:** 3 of 3. Tasks 1 and 2 went test first (a RED commit, then a GREEN commit), and Task 3 is a test-only journey. A `perf` commit followed. Task 1 is the tracer: its verify passed end to end before the GREEN commit (both projects), so expansion went ahead with no checkpoint (interactive, end-of-phase, automated-only verify).
- **Files:** 22 (16 created, 6 modified; 2,129 lines added, 16 removed).

## Accomplishments

- **The field (X-19).** `FileField` has a label, and a visually hidden `input type="file" multiple` (not a tab stop) that `Choose files` opens. The dashed region shows `Drag files here, or` from 768px. Below 768px the button is full width at the touch-target height. The hint describes both the input and the button.
  - A file drag over the region turns the boundary solid ink on the hover fill.
  - `usePageFileDropGuard` cancels file drags and drops anywhere else on the page while the field is mounted (UI-D30).
- **Checks before sending (§1.3).** `precheckChosenFiles` checks each file in order:
  - its extension (`.jpg` counts as JPEG; any case);
  - that it is not empty;
  - that it is not over 25 MB (the refusal names its size, for example `30.0 MB`);
  - that the request has room left.
  It lists a duplicate choice once (UI-D13). The refusal sentences come from `attachmentAddRefusal`, so the browser and Strapi use the same words.
- **The queue (X-20).** `UploadQueue` sends `waiting` rows one at a time, each as one `uploadAttachmentAction(formData)`. It shows each stage with its icon and words, and `aria-busy` while a row is being added.
  - Actions: `Retry {name}` resends the same `File`. `Choose another file to replace {name}` replaces the row and focuses it. `Remove from list: {name}` moves focus to the next row's first control, else the previous row's, else `Choose files`. A waiting row has `Remove {name} from the list`.
  - The count line (`role="status"`, the only announcement) reads `{a} of {n} files added · {k} not added`.
  - Once the queue settles, one `router.refresh()` lists the added files.
  - While a file is waiting or being added, in-app links ask `Leave while files are being added?` and the browser warns before unloading.
- **The tab's file store (UI-D35).** `AttachmentFileStoreProvider` keeps rows in React state, keyed `{ownerKey}:{requestId}:{scope}`, above the request routes. `AppShell` mounts it only for a viewer with `assessment-request:read`.
  - Refused and failed rows return after in-app navigation under `Restored from earlier in this session.`, and the count line counts them afresh.
  - Another person's rows are forgotten.
  - While any file is kept, the browser's own `beforeunload` prompt is armed on every page (in-app links never ask).
  - No file is written to any browser storage.
- **The Files section (§3.1, §3.2, §3.7).**
  - `FilesSection` is a server component. It has the `Files` h2 (`id="files"`, focusable), the Requestor's description, the `{n} {file|files}` count, the list or the §3.7 empty state, and the compact `We couldn’t load the files` error.
  - On a draft (`canAdd`, window `intake`), it shows the field and queue labelled `Add files`. Where files cannot be added, the §1.2/§3.6 line takes the field's place.
  - `FilesList` uses a `DataTable` from 768px (Name with type icon and label, Size, Added by with part, Added, Note or `Before submission`) and cards below 768px.
  - The request page reads the files only when the request read carries `attachments` (D-18). It renders the section directly before Notes.
- **Server Actions.** `uploadAttachmentAction` refuses a form with no `File` part locally, without calling Strapi. Otherwise it returns `{ ok: true, data }`, or family N with `sizeLabel` and the transport's `detection`. It never revalidates or redirects. `listRequestAttachmentsAction` reads the list.
- **Playwright.** Strapi's `webServer.env` pins `CSRM_ATTACHMENT_STORAGE: 'local'`, `CSRM_ATTACHMENT_LOCAL_DIR: join(e2eRuntimeRoot, 'attachments')` and `CSRM_ATTACHMENT_SCANNER: 'development'`. The mobile project collects `request-attachments.spec.ts`.

## Task Commits

1. **Task 1 (tracer):** `211f9a4` test (RED), `b6dfbed` feat (GREEN)
2. **Task 2:** `b0fcf45` test (RED), `e7a3940` feat (GREEN)
3. **Task 3:** `61d1bb7` test (the refusals journey)
4. **Route budget:** `1d1340d` perf (see Deviations)

`git rev-list --count 7b75ea0d..HEAD` is 6 before this summary's commit.

## Verification

- **RED evidence** (Vitest JUnit output; `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for each target named):
  - **Task 1:** 26 of 55 failed on assertions, against throwaway stubs that were deleted before the RED commit (no stub was committed). Targets checked: the upload action's send and no-file cases, `formatFileSize` in kilobytes, the field hint, the count label, the section's row and its empty state.
  - **Task 2:** 23 of 89 failed. Targets checked: the over-25 MB and duplicate pre-checks, Retry, the refusal not stopping the next file, Remove from list focus, the page drop guard, the restored rows and the in-flight dialog.
    - One planned case was already green at RED: `useFilesInFlight`, which came with Task 1's store (the plan puts the store in Task 1).
    - Task 2's RED also exposed a real Task 1 bug, fixed in its GREEN: the sender was freed after the row settled, so a second file never started (see Deviations).
- **GREEN, focused:**
  - Task 1:
    - `vitest run src/features/attachments src/lib/files src/lib/performance/zod-client-boundary.test.ts`: `Tests 83 passed (83)`.
    - The suites that import the request page or the shell: `Tests 340 passed (340)` and `Tests 414 passed (414)`.
    - Typecheck and lint clean.
    - `playwright test --list --project=mobile e2e/request-attachments.spec.ts` lists `COLLAB02_DRAFT_FILE_ADDED`.
    - `test:e2e e2e/request-attachments.spec.ts`: 2 passed (desktop 2.7 s, mobile 2.2 s), and the tree was clean afterwards.
  - Task 2:
    - `src/features/attachments`, `navigation-guard.test.tsx` and the zod boundary: `Tests 117 passed (117)`.
    - Components, questionnaires, notes and assignment: `Tests 981 passed (981)`.
    - Typecheck clean.
  - Task 3: `test:e2e e2e/request-attachments.spec.ts`: 4 passed (desktop and mobile). EICAR guard empty, and the tree was clean afterwards.
- **Intake timing (Playwright):** the intake journey took 2.1 s to 2.7 s on desktop and 2.1 s to 2.2 s on mobile across runs; the refusals journey took 3.7 s to 3.8 s on each.
- **Full suites:**
  - Web (`pnpm --dir apps/csrm test`, on HEAD `1d1340d`): 203 files, `Tests 4542 passed (4542)`.
  - Playwright (`pnpm --dir apps/csrm test:e2e`, on `61d1bb7`): `206 passed (24.1m)`, desktop 158 and mobile 48, none flaky.
  - After the perf fix, `performance.spec.ts` and `request-attachments.spec.ts` were re-run: 15 passed.
  - `api:check` exits 0 with no contract change (`schema.d.ts` refreshed, not staged).
  - The Strapi suite was not run: this plan changes no Strapi source, specification or configuration.
- **Route budgets (delivered JS, desktop, after `1d1340d`):**
  - `/app` 227,712
  - `/app/requests` 249,510
  - `/app/requests/{documentId}` 280,503 (279,835 before the phase)
  - `/app/risks/{documentId}` 290,944 (9,056 bytes left)
  - `/app/review/assessments/{documentId}` 314,278 of 460,000
  - `/app/questionnaires/{documentId}` 353,846 of 500,000
  - Every route is within budget, with no override.
- **Acceptance criteria:**
  - `attachments-domain.ts` imports nothing from zod; `attachments-actions.ts` starts with `'use server'`.
  - `file-store.tsx` contains no `localStorage`, `sessionStorage` or `indexedDB`.
  - `playwright.config.ts` has `CSRM_ATTACHMENT_SCANNER: 'development'` and `'**/request-attachments.spec.ts'`.
  - `upload-queue.tsx` renders `Restored from earlier in this session.` through `filesCopy.restored` and has one `role="status"`.
  - The spec has `COLLAB02_REFUSALS` `@journey` with the four sentences.
  - Every verify command exits 0.

## Decisions Made

See `key-decisions` in the frontmatter (one line each).

## Deviations from Plan

1. **[Rule 3 - Blocking] `files-list.tsx` added.** `DataTable` is a client component that needs function props, so the server `FilesSection` cannot render it directly. The list is a small client module now; 14-13 plans this same file as "the client list" and extends it with Download, Remove and the phone sheet.
2. **[Plan shape] The queue is imported statically, not with `next/dynamic`.** Next 16's lazy-loading guide says a Server Component's dynamic import of a Client Component is not code-split. The field and queue are one client island in the server section, and the route stays within budget (280,503 of 300,000).
3. **[Plan shape] No `{ beforeUnloadOnly: true }` option exists.** Phase 13 shipped `useUnloadWarning(active)` instead. The file store arms it while it keeps a file, which covers every page. The queue arms `useLeaveGuard` while files are in flight.
4. **[Rule 2 - Missing critical] `useLeaveGuard` takes the warning's words.** It now has an optional `copy` argument, with a test in `navigation-guard.test.tsx`. Otherwise the in-flight dialog would have read `Leave this questionnaire?`.
5. **[Rule 1 - Bug] The queue stalled after the first file.** The sender was freed in `.finally()`, after the settle render had already looked for the next file. It is now freed before the row settles. Task 2's RED test caught this before any journey sent a second file.
6. **[Rule 1 - Bug] Retry sent a copy.** `FormData.set('file', file, name)` makes a new `File`, so the queue now sets the chosen `File` with no filename.
7. **[Rule 3 - Route budget] `upload-queue-model.ts` added (`1d1340d`).** The shell's file store had pulled the domain module, and through it all of `refusal-copy.ts`, into every route (`/app/risks/{documentId}` measured 296,269). The queue model now lives in an import-free module that the domain re-exports, which saves about 5.3 KB on every route. A unit guard keeps the store off the domain. The fix is at source; there is no override.
8. **[Test fixture] `files-section.test.tsx` changed in GREEN.** The `readonly allowedTypes` fixture is spread into a mutable array for the list meta type (type-only).
9. **[Plan shape] `filesEmptyState(window, viewer, open)`.** It takes a third argument so a paused or closed section reads `No files`.

**Total deviations:** 9 (2 Rule 1, 1 Rule 2, 3 Rule 3, 3 plan-shape or test notes). **Impact:** no change to scope. No content type, schema field, relation or contract changed, and no dependency was added.

## Issues Encountered

- **Vitest JUnit output order vs the RED-evidence parser.** `check tdd-red-evidence` reads a test case's name with `/name="…"/`, which first matches inside `classname="…"`. The evidence was checked on a copy of the report with the two attributes swapped. The tests and their results were unchanged.
- **A shell heredoc broke on one edit** (a quoted Python heredoc ended early). The edit was re-applied from a script file. No file was left half-written.

## Known Stubs

None that block this plan's goal. Each of the following is planned for a later plan:
- Download, Remove, Restore, the state badges and the phone actions sheet: 14-13.
- `Add files with a note` after submission: 14-15.
- The list's `Try again` is a link that reloads the section's page, not a client retry: 14-13 completes the error state.
- `DataTable` still shows its `Page 1 of 1` footer and `{n} result` output: 14-13's plan owns "no sorting or pagination".

## Threat Flags

None beyond the plan's register:
- **T-14-43 is mitigated.** The browser checks are feedback only. The action passes the `File` to the typed service, which Strapi screens (journey: the PDF-named PNG and the signature file are refused by Strapi).
- **T-14-44 is mitigated.** `File` objects live only in React state, and `file-store.tsx` has no storage call (acceptance grep).
- **T-14-45 is mitigated.** Names render as React text with `[overflow-wrap:anywhere]`. A component case renders `<img src=x onerror=alert(1)>.pdf` with no `img` element.
- **T-14-SC is accepted.** No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-13** extends `files-list.tsx`, which holds the server list today with the `#file-{id}` anchors on the visible layout. It needs a `DataTable` option to drop the pagination footer.
- **14-14** reuses `FileField`, `UploadQueue`'s model (`chosen` stage), `useFilesInFlight` for the submit dialog's wait line, and `filesLeaveCopy`.
- **14-15** uses the `note:{noteId}` scope (the queue already sends `noteId`) and `offerNewNote` on refused rows.

## Self-Check: PASSED

- FOUND: every file in `key-files` (created and modified).
- FOUND: `211f9a4`, `b6dfbed`, `b0fcf45`, `e7a3940`, `61d1bb7`, `1d1340d`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
