---
phase: 14-request-attachments
plan: 15
subsystem: ui
tags: [nextjs, react, server-actions, file-upload, notes, playwright, axe, attachments]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: "addRequestNoteAction (unchanged), the X-16 thread (NotesSection, NotesThread, NoteItem, NoteComposer), the composer's session-kept text, useUnloadWarning and the unsent-note well"
  - phase: 14-request-attachments
    provides: "14-12 the field, the X-20 queue and the tab's file store; 14-13 FilesList, downloadAttachmentAction and saveFile; 14-14 FilesPanel and the 25 MB action bodies on the attachment pages; uploadAttachmentAction with noteId and family N's offerNewNote"
provides:
  - "file-chip.tsx: FileChip (X-21) and FileChipDownload (icon-only ghost, family O toast, one hidden status)"
  - "The composer's Attach files, drop target, checked chips (Files to add with this note), hint, the UI-D7 refusal, and note-first posting with rollback"
  - "A note's Files with this note chips, its Waiting rows while it is added, and its field-less queue (scope note:{id}) that sends each file with its noteId"
  - "The tab's file store: the composer scope, useQueueRows and useFileStoreDispatch; the queue model's handedOff and restore keepChosen"
  - "composer-hand-off.tsx: ComposerHandOffField, the Files section's Add files with a note after submission (UI-D6)"
  - "Add with a new note (UI-D9), the composer's chips kept for the tab under Restored from earlier in this session., and the closed-notes well's file names with Discard note"
  - "noteFilesFor and groupAttachmentsByNote: both request pages pass filesByNote and attach to NotesSection"
  - "E2E COLLAB02_NOTE_WITH_FILES @journey (ROADMAP success criterion 1; UAT-012)"
affects: [14-16, 14-17, 19, 20]
actuals:
  tokens: 22500
  tasks: 2
  commits: 4
plan_head_before: 3a65cec97558c99e23e55bf6e41773d11c4c7c59
plan_head_after: 5b26a249b70e6f2dd40b70f2708886240cd0450c
tech-stack:
  added: []
  patterns:
    - "A record that carries files posts first; only its recorded id puts the files in its own queue in the tab's store, which sends them one at a time; if the record fails, its files go back where they were chosen"
    - "A queue filled on this view is fresh: it sends at once instead of restoring its rows as files left behind"
key-files:
  created:
    - apps/csrm/src/features/attachments/file-chip.tsx
    - apps/csrm/src/features/attachments/file-chip.test.tsx
    - apps/csrm/src/features/attachments/composer-hand-off.tsx
  modified:
    - apps/csrm/src/features/request-notes/note-composer.tsx
    - apps/csrm/src/features/request-notes/note-composer.test.tsx
    - apps/csrm/src/features/request-notes/note-item.tsx
    - apps/csrm/src/features/request-notes/note-item.test.tsx
    - apps/csrm/src/features/request-notes/notes-section.tsx
    - apps/csrm/src/features/request-notes/notes-section.test.tsx
    - apps/csrm/src/features/request-notes/notes-thread.tsx
    - apps/csrm/src/features/request-notes/notes-thread.test.tsx
    - apps/csrm/src/features/request-notes/notes-domain.ts
    - apps/csrm/src/features/request-notes/unsent-note-well.tsx
    - apps/csrm/src/features/request-notes/unsent-note-well.test.tsx
    - apps/csrm/src/features/attachments/attachments-domain.ts
    - apps/csrm/src/features/attachments/file-field.tsx
    - apps/csrm/src/features/attachments/file-store.tsx
    - apps/csrm/src/features/attachments/file-store.test.tsx
    - apps/csrm/src/features/attachments/files-section.tsx
    - apps/csrm/src/features/attachments/files-section.test.tsx
    - apps/csrm/src/features/attachments/upload-queue.tsx
    - apps/csrm/src/features/attachments/upload-queue-model.ts
    - "apps/csrm/app/(app)/app/requests/[documentId]/page.tsx"
    - "apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx"
    - apps/csrm/e2e/request-attachments.spec.ts
key-decisions:
  - "The composer's chips live in the tab's file store under scope composer; posting takes them out, and the thread puts them in note:{id} only once Strapi has recorded the note (D-17); a failed note puts them back."
  - "A note posted on this view sends its files at once (fresh); the queue's restore, which turns waiting files into failed transfers to Retry, applies only after an in-app navigation."
  - "Under a note the queue has no field, hides a file once the page lists it (its chip carries the state) and keeps its count line only while it shows rows."
  - "A chip refused by the browser's checks stays in the composer with its reason; only the files that passed go with the note."
  - "A removed file's chip has no link, because its row has left the Files list; the name is plain text with the Removed badge."
  - "The files of a note still being added show as rows at Waiting with no actions, since nothing is sent until Strapi records the note."
  - "Add files with a note moves focus on the next tick, after the chooser hands focus back to Choose files, then scrolls to the composer."
  - "Add with a new note skips the browser checks (the file passed them when chosen), lists a file already a chip once, and focuses the composer's text."
  - "The well keeps Phase 13's toast words (Note text discarded., Undo) with files too, as the copy is verbatim; one Undo brings back both; Copy text shows only when there is text."
  - "The composer's restore keeps chosen chips (restore keepChosen) under the shared Restored from earlier in this session. caption."
  - "The page's drop guard lets any [data-file-drop] target take a drop, so the composer and a file field can sit on one page."
  - "The orchestrator's D-30 ruling on the per-file AI switch does not apply here; 14-16 renders that switch."
patterns-established:
  - "useFileStoreDispatch(owner, request)(scope, action) is how one feature moves files into another's queue (the thread into a note's, the Files section and Add with a new note into the composer's)"
  - "FileChip is the X-21 chip for a file inside another record; Phase 20's evidence files can reuse it"
requirements-completed: [COLLAB-02]  # traced here; COLLAB-02 stays Pending until the 14-17 phase gate
coverage:
  - id: D1
    description: "Jane creates the payroll SaaS request with a PDF, a DOCX and an XLSX, submits it, writes that the vendor sent their architecture deck, attaches the PPTX and adds the note; the note goes first and the deck follows with its id; Bob sees the note flagged, all four files with Jane Doe · Requestor and their times, the deck's row linking to the note, and downloads the deck (PK); axe clean with chips in the composer and on Bob's page, at 1440 and 375"
    requirement: COLLAB-02
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_NOTE_WITH_FILES @journey (desktop and mobile)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/note-composer.test.tsx#posting a note with files (14-UI-SPEC §4.2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The composer's Attach files, chips with size and Remove {name} from the list, the hint, the browser's checks, Write a note to say what these files are., and files returned with the text when the note fails"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/note-composer.test.tsx#the composer’s files (14-UI-SPEC §4.1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each note lists its files as X-21 chips linking to #file-{id}, with Download or the pending, blocked, unavailable or removed badge; both pages pass filesByNote"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/request-notes/note-item.test.tsx#a note’s files (14-UI-SPEC §4.2; X-21); notes-section.test.tsx#each note’s files on both request pages; file-chip.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "After submission the Files section's Add files with a note hands files to the composer, scrolls there, focuses its text and shows UI-D6's caption; a file its note can no longer take offers Add with a new note"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/attachments/files-section.test.tsx#Add files with a note after submission; note-item.test.tsx#a file its note can no longer take (§4.2; UI-D9)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The composer's files are kept for the tab and return under Restored from earlier in this session., arm beforeunload, never reach browser storage, and the closed-notes well lists them with Discard note under one Undo"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/attachments/file-store.test.tsx#the composer’s files kept for the tab; unsent-note-well.test.tsx; note-composer.test.tsx#keeps the note’s text and files in the well when notes close"
        status: pass
    human_judgment: false
  - id: D6
    description: "At 375px the composer with five file chips, its hint, Attach files and Add note fit without horizontal scroll (the UI-SPEC backstop)"
    verification: []
    human_judgment: true
    rationale: "Playwright proves no horizontal overflow at 375 with one chip; five chips at 375 are the UI-SPEC's backstop for the phase's UI review."
duration: 60min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 15: Files with Notes After Submission Summary

**After submission every file now travels with a note. In the composer, Jane chooses files with `Attach files` (or drops them on it) and sees them as X-21 chips. A note with files must say what they are. `Add note` posts the note first through Phase 13's unchanged operation. Only once Strapi has recorded it are the files sent, one at a time, with that note's id. Each note lists its files as chips that link to their rows, and each row links back. The Files section's `Add files with a note` hands files to the composer. A file a stale note refuses offers `Add with a new note`. Composer files are kept for the tab, and the closed-notes well lists them with `Discard note`. ROADMAP success criterion 1 now passes end to end at 1440 and 375.**

PHASE_14_BASE=e50053f. COLLAB-02 is traced here but stays Pending until 14-17's phase gate (`requirements-completed` copies the plan's array, as the template asks). REQUIREMENTS.md is unchanged.

## Performance

- **Duration:** 60 min (2026-10-10T09:16:56Z to 10:17:15Z), including the full Playwright run (26.5 min).
- **Tasks:** 2 of 2, each test first (a RED commit, then a GREEN commit). Task 1 is the tracer: before its GREEN commit its verify passed end to end on both projects (16/16). The run is interactive, `end-of-phase`, with an automated-only verify, so expansion went ahead with no checkpoint.
- **Files:** 25 (3 created, 22 modified; 1,421 lines added, 79 removed across the four commits).
- **The criterion 1 journey:** `COLLAB02_NOTE_WITH_FILES` took 8.2 s on desktop and 7.6 s on mobile (Task 1 run), and 8.1 s and 7.8 s in the Task 2 run. That covers creating with three files, submitting, the note with the deck, Bob's checks and the download.

## Accomplishments

- **The chip (X-21).** `FileChip` has a 1px default boundary, the medium radius, and 8px by 12px padding. It holds the type icon, the name on one line (ellipsis beyond 28rem, full name in the DOM) and the size. The name is a record link when the file has a row. `FileChipDownload` is the icon-only ghost `Download {name}`: it shows a spinner while it works, reads the bytes through the Server Action, saves them, and says `{name} downloaded.` once. A refusal raises the danger toast `File not downloaded`.
- **The composer (§4.1).**
  - Where Strapi's add facts say files go with a note (`canAdd` and `needsNote`), it offers `Attach files` (outline, small, `Paperclip`) before `Add note`. Its hidden input is reached only through that button. The composer is also a drop target.
  - Chosen files pass §1.3's checks and become chips in `Files to add with this note`, with the size and `Remove {name} from the list`. A refused file keeps its chip with `Not added.` and its reason.
  - With chips present, the composer shows the hint `Files are checked for malware, then added with your note.` Files with no text are refused with `Write a note to say what these files are.`
- **Posting (§4.2; D-17, D-26).**
  - The composer hands the passing files to the thread. The optimistic note shows `Adding…` with the files as rows at `Waiting`, and the composer clears.
  - Once `addRequestNoteAction` returns the note, the files go into `note:{id}` in the tab's file store. The note's queue sends each one with `noteId`, one at a time, then refreshes once.
  - If the note fails, it leaves and its text and files return to the composer. The note's unread flag tells the other party.
- **A note's files.** `Files with this note` lists the settled files as chips. Each name links to `#file-{id}` (a removed file's name is plain). Each chip has `Download`, or the badge for a pending, blocked, unavailable or removed file. Files still on their way, or kept after a refusal, show as X-20 rows under the note.
- **The hand-off (UI-D6).** After submission, for the Requestor and a human Security Analyst Strapi lets add, the Files section's field reads `Add files with a note`. The line `Files are added with a note, so everyone knows what they are.` sits before the type list. Choosing or dropping files puts them in the composer's chips and scrolls to the composer. The composer's text takes focus, and the caption `Write a note to say what these files are, then add it.` shows above the chips.
- **Add with a new note (UI-D9).** A row refused with `ATTACHMENT_NOTE_INVALID` (or `ATTACHMENT_NOTE_REQUIRED`) shows family N's sentence. `Add with a new note: {name}` (outline, small) replaces `Retry` and `Choose another file`, and `Remove from list` stays. It moves the file to the composer's chips and focuses the composer.
- **Kept files (§4.3; UI-D10).**
  - The composer's chips survive leaving and coming back for the same person and request, under `Restored from earlier in this session.` Another person on the tab sees none.
  - The store arms `beforeunload` while it holds them, and nothing is written to browser storage.
  - With notes closed, the well lists the files' names beneath the text, and `Discard text` reads `Discard note`. It discards both, and one Undo brings both back.

## Task Commits

1. **Task 1 (tracer):** `33966ab` test (RED), `59af20f` feat (GREEN)
2. **Task 2:** `73d3bc1` test (RED), `5b26a24` feat (GREEN)

`git rev-list --count 3a65cec9..HEAD` is 4 before this summary's commit.

## Verification

- **RED evidence.** Vitest JUnit reports were checked with `check tdd-red-evidence`, with the `classname` attributes removed so the parser reads each test's own name. Every target named returned `RED_EVIDENCE_OK`.
  - **Task 1:** 26 of 84 failed. Targets: the chip's boundary, the note's chip list, the composer posting its files, the note-first order with `noteId`, the waiting rows, the empty-text refusal and `filesByNote` on both pages. Two cases were green at RED by design as regression guards: `offers no Attach files where files cannot be added with a note` and `renders no list for a note without files`.
  - **Task 2:** 7 of 99 failed. Targets: the hand-off, `Add with a new note`, the kept chips with their caption, the well's names and `Discard note`, and the thread's closed-notes well. Four cases were green at RED as regression guards, already true after Task 1: another person keeps nothing, `beforeunload` while the composer holds a file, nothing in browser storage, and `Discard text` with no files.
- **GREEN, focused:**
  - Task 1: the four test files `84/84`. `vitest run src/features/request-notes src/features/attachments src/lib/performance/zod-client-boundary.test.ts`: `Tests 337 passed (337)`. Typecheck and lint clean. `test:e2e e2e/request-attachments.spec.ts`: 16 passed (2.3 min).
  - Task 2: the five test files `99/99`. `src/features/request-notes src/features/attachments src/lib/performance src/features/requests` with the AI-inputs test: `Tests 690 passed (690)`. Typecheck and lint clean. The spec: 16 passed (2.2 min). `test:e2e e2e/performance.spec.ts --project desktop -g 'app/requests/.documentId. as the Requestor'`: 1 passed.
- **Full suites (at `5b26a24`):**
  - Web (`pnpm --dir apps/csrm test`): 207 files, `Tests 4728 passed (4728)` (51.7 s).
  - Playwright (`pnpm --dir apps/csrm test:e2e`): `218 passed (26.5m)`, desktop 165 and mobile 53, none flaky. `REQ08_REASSIGN_THROUGH_PICKER` passed on both projects.
  - `api:check` exits 0 with no contract change (`schema.d.ts` refreshed, not staged).
  - The Strapi suite was not run: this plan changes no Strapi source, specification or configuration.
- **Route budgets (delivered JS, desktop):**
  - `/app/requests/{documentId}` (Requestor): 292,521 of 300,000 in the focused run and 292,526 in the full run. That is 3,822 bytes more than 14-14's 288,699, leaving 7,474 bytes. No source fallback (`next/dynamic` or server rendering) was needed.
  - `/app/review/requests/{documentId}` is not a key route in `performance.spec.ts`, so no figure exists for it.
  - Full run: `/app/risks/{documentId}` 293,295 (6,705 left); `/app` 228,711; `/app/requests` 251,109; `/app/review` 231,276; `/app/risks` 262,238; `/app/review/assessments/{documentId}` 317,231 of 460,000; `/app/questionnaires/{documentId}` 357,494 of 500,000.
  - Every route is within budget, and `git diff e50053f -- apps/csrm/e2e/performance.spec.ts` adds no `ROUTE_BUDGET_OVERRIDES` entry.
- **Acceptance criteria:**
  - `note-composer.tsx` contains `Attach files` and hands the files on only through `onSubmit`, after which the thread adds them to the note's queue once `addRequestNoteAction` returns (asserted by call order).
  - `git diff e50053f -- notes-service.ts notes-schema.ts` is empty.
  - `files-section.tsx` contains `Add files with a note`, and `note-item.tsx` contains `Add with a new note`.
  - `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing, and `git status --short` was clean after every run.

## Decisions Made

See `key-decisions` in the frontmatter (one line each).

## Deviations from Plan

1. **[Rule 3 - Blocking] `notes-thread.test.tsx` mocks the attachments Server Actions (outside the list).** The note item now reaches them, and their service imports `server-only` (`59af20f`).
2. **[Rule 3 - Blocking] Other files outside the list.**
   - `upload-queue.tsx` gained the field-less note variant, `WaitingRows` and `Add with a new note`.
   - `upload-queue-model.ts` gained `handedOff` and `restore` `keepChosen`.
   - `file-field.tsx` gained the optional lead line, an exported `carriesFiles`, and a drop guard that lets any `[data-file-drop]` target take a drop.
   - `attachments-domain.ts` gained `groupAttachmentsByNote`, `composerChips` and the copy, and `notes-domain.ts` gained `noteFilesCopy` and `Discard note`.
   - `notes-section.test.tsx` gained the wiring test.
   - The new `composer-hand-off.tsx` holds the client field, because `files-section.tsx` is shared with server pages.
3. **[Plan shape] `handOffToComposer` is `ComposerHandOffField` plus `useFileStoreDispatch`, not a store method.**
4. **[Plan shape] The literals live in the domain copy objects.** `note-composer.tsx`, `files-section.tsx` and `note-item.tsx` name `Attach files`, `Add files with a note` and `Add with a new note` in their header comments, which the acceptance greps read.
5. **[TDD] Some RED cases were green at RED (listed under Verification).**
   - Task 1's RED ran against a throwaway `file-chip.tsx` stub, deleted before the RED commit.
   - Task 2's RED tests reference props that did not exist yet, which fails Next's build type check. For Task 1's E2E verify, the five files were copied to the scratchpad and restored to `HEAD` (`git checkout --` on files this plan changed), then copied back for the Task 2 RED commit.
6. **[Rule 1 - Test] The journey's read clean-up first failed on both projects.** Bob scrolled to Jane's note just before `page.reload()`, so the reload cancelled the mark-read call, and later reloads opened at the top. He now lands on `#notes`, as Phase 13's journeys do, so each reload re-lands on the thread. Only the spec changed (`59af20f`).
7. **[Rule 1 - Bug] Focus after the hand-off.** Moving focus in the change handler lost it to `Choose files`, because user-event, and browsers when the chooser closes, give focus back to the opener. The hand-off now focuses on the next tick (`5b26a24`).

**Total deviations:** 7 (2 Rule 3, 2 Rule 1, 2 plan-shape notes, 1 TDD note). **Impact:** no change to scope. No content type, schema field, relation or contract changed, Phase 13's notes operation is unchanged, and no dependency was added.

## Issues Encountered

- **Shell heredocs broke on a typographic apostrophe in one edit.** The edit was applied from a script file in the scratchpad instead, and no file was left half-written.
- **Next logs `The destination stream closed early`** while a journey leaves a page that is still streaming, and `failed-to-find-server-action` for the body-limit test's deliberate action id `0`. Every test passed.

## Known Stubs

None. The analyst's per-file AI switch is 14-16's. The orchestrator's D-30 ruling (an included file keeps an off-only switch under a refusing policy) applies there.

## Threat Flags

None beyond the plan's register:
- **T-14-52 is mitigated.** The composer posts the note first and uses only the id Strapi returned. Strapi accepts only the caller's own note on the same request within its window (14-06). A stale note's refusal offers `Add with a new note`.
- **T-14-53 is mitigated.** After submission the web never sends a file without a note: the Files section hands files to the composer, and only a recorded note's queue sends them. Strapi refuses a file without a note (`ATTACHMENT_NOTE_REQUIRED`).
- **T-14-SC is accepted.** No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-16** adds the AI column and the per-file switch to `FilesList`, applying the orchestrator's D-30 ruling. The note chips show no AI facts.
- **14-17** runs the phase gate and marks COLLAB-02 complete.
- **Route budget:** `/app/requests/{documentId}` has 7,474 bytes left and `/app/risks/{documentId}` 6,705. The store, which every route loads, grew only by `useQueueRows` and `useFileStoreDispatch`.
- **For the phase's UI review:** the composer with five chips at 375 (the UI-SPEC backstop) and the closed-notes well with files.

## Self-Check: PASSED

- FOUND: every file in `key-files` (created and modified).
- FOUND: `33966ab`, `59af20f`, `73d3bc1`, `5b26a24`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
