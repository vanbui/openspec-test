---
phase: 14-request-attachments
plan: 14
subsystem: ui
tags: [nextjs, server-actions, react, react-hook-form, file-upload, proxy, playwright, axe, attachments]
requires:
  - phase: 14-request-attachments
    provides: "14-12 the field, the X-20 queue (chosen stage), the tab's file store (useFilesInFlight, useKeptFiles), filesLeaveCopy and useLeaveGuard's copy; 14-13 FilesList with Download and Remove, FilesSection and filesSectionFor"
  - phase: 10-existing-flow-gap-closure
    provides: "ConfirmDialog, SaveStatus (X-1), navigation-guard.tsx (GuardedLink, useLeaveGuard), FormSection"
provides:
  - "lib/security/action-body-limit.ts: DEFAULT_ACTION_BODY_LIMIT_BYTES, ATTACHMENT_ACTION_BODY_LIMIT, ATTACHMENT_ACTION_PATHS, exceedsActionBodyLimit; proxy.ts answers 413 first"
  - "next.config.ts: serverActions.bodySizeLimit and proxyClientMaxBodySize both '26mb'"
  - "createRequestAction and updateRequestAction take { stayOnPage }: they return the draft and neither revalidate nor redirect"
  - "UploadQueue mode=\"deferred\" with a ref handle (hasWork, sendAll(requestId) resolving { added, pending, notAdded }) and a leaveCopy for chosen files"
  - "RequestForm's Supporting files section on the new-request form and the draft's edit form, the create-once save with replaceState, Draft saved at, Adding files…, the §2.2 alert with Go to draft, and the form's leave dialog"
  - "useSubmitFiles and SubmitDescription (request-workflow-actions.tsx): the submit dialog's wait and not-added lines on the request page and the edit form; ConfirmDialog confirmDisabled"
  - "FilesPanel: the Files section's body, shared by the request page and the edit form"
  - "E2E COLLAB02_CREATE_WITH_FILES @journey, COLLAB02_LARGE_UPLOAD and ACTION_BODY_LIMIT_OUTSIDE_ATTACHMENT_PAGES"
affects: [14-15, 14-16, 14-17, 19, 20]
actuals:
  tokens: 22021
  tasks: 3
  commits: 6
plan_head_before: 89ce0f9d396dded01ec0a064b0cf642bb6f0560e
plan_head_after: 70fea550b7104053dd1e7342a5517909a58ff0eb
tech-stack:
  added: []
  patterns:
    - "A form that sends files after creating its record stays on the page: the save returns the record (stayOnPage), the address is replaced with the record's edit route, the queue sends one file at a time, and the form moves on with router.replace once every file settles; nothing revalidates or refreshes in between"
    - "A path-scoped body ceiling lives in the proxy, because Next's body limits are global; next.config.ts imports the raised limit from the same module"
key-files:
  created:
    - apps/csrm/src/lib/security/action-body-limit.ts
    - apps/csrm/src/lib/security/action-body-limit.test.ts
  modified:
    - apps/csrm/next.config.ts
    - apps/csrm/proxy.ts
    - apps/csrm/src/features/requests/request-form.tsx
    - apps/csrm/src/features/requests/request-form.test.tsx
    - apps/csrm/src/features/requests/request-actions.ts
    - apps/csrm/src/features/requests/request-actions.test.ts
    - apps/csrm/src/features/requests/request-workflow-actions.tsx
    - apps/csrm/src/features/requests/request-workflow.test.tsx
    - apps/csrm/src/features/attachments/upload-queue.tsx
    - apps/csrm/src/features/attachments/upload-queue.test.tsx
    - apps/csrm/src/features/attachments/upload-queue-model.ts
    - apps/csrm/src/features/attachments/attachments-domain.ts
    - apps/csrm/src/features/attachments/files-section.tsx
    - apps/csrm/src/components/csrm/confirm-dialog.tsx
    - "apps/csrm/app/(app)/app/requests/[documentId]/edit/page.tsx"
    - "apps/csrm/app/(app)/app/requests/[documentId]/page.tsx"
    - "apps/csrm/app/(app)/app/requests/new/page.tsx"
    - apps/csrm/e2e/request-attachments.spec.ts
key-decisions:
  - "Files chosen before the draft exists stay in the deferred queue's own state, not the tab's store, because nothing can keep them for a draft yet; leaving loses them, and the form's dialog says so."
  - "The queue's count line stays empty while every row only waits for the draft: it counts a transfer (§12), and nothing has been sent."
  - "sendAll returns a promise of { added, pending, notAdded } instead of a separate settled callback, so the save reads as one sequence."
  - "Saving again retries failed transfers; a refused file waits to be replaced or removed. A save with only refused files left saves and moves to the draft, where they stay listed, as Go to draft does."
  - "On the draft's edit form, Save draft with a file on its way or awaiting Retry waits for the queue before moving on, so no redirect cuts an upload short (Pitfalls 17 and 18)."
  - "The form's own leave dialog covers the new-request form only, measured against the fields as last saved (form.reset with keepValues after a save); files chosen before the draft exists are guarded by the deferred queue in the same words; while a file is on its way only the queue's dialog asks."
  - "The §2.2 alert shows while the draft keeps files not added after a save, recounts as they change, goes at zero, and is focused each time a save ends that way; Go to draft is a GuardedLink."
  - "The new-request form offers 20 places, because there is no request read yet; where storage is not configured each file shows family N's refusal after the save."
  - "The submit dialog's line sits inside its description as polite live text, so a change while the dialog is open is said; useSubmitFiles lives in request-workflow-actions.tsx and serves both dialogs."
  - "The gate treats a Content-Length that is not a non-negative integer as missing, and its 413 has no body."
patterns-established:
  - "UploadQueue's ref handle (hasWork, sendAll) is how a form waits on its files; FilesPanel passes it through on the edit form"
requirements-completed: [COLLAB-02]  # traced here; COLLAB-02 stays Pending until the 14-17 phase gate
coverage:
  - id: D1
    description: "Jane fills the new-request form for the payroll SaaS request, chooses vendor-security-pack.pdf, data-flow.docx and vendor-questionnaire.xlsx under Supporting files, saves the draft, and lands on the draft's request page, whose Files section lists all three with her name; her list holds one new draft; axe clean on the form with three files, at 1440 and 375"
    requirement: COLLAB-02
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_CREATE_WITH_FILES @journey (desktop and mobile)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-form.test.tsx#saving the draft with files (§2.2; D-26; UI-D3); request-actions.test.ts#saving a draft while its files are queued (stayOnPage); upload-queue.test.tsx#the new-request form’s queue waits for its draft (deferred)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A partly failed save stays on the edit address with the focused §2.2 alert and Go to draft; Choose another file and Retry work in place; saving again updates the same draft and retries the files still listed; Go to draft keeps a file not added, restored on the draft's page with Retry sending the same file"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-form.test.tsx#when the draft is saved but a file is not added (§2.2; UI-D29)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Leave this request? for unsaved fields or files chosen before the draft exists, Leave while files are being added? while one is on its way, and only beforeunload with kept files"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-form.test.tsx#leaving the new-request form (§10); upload-queue.test.tsx#leaving with the new-request form’s files (§10; UI-D35)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The submit dialog on the request page and the edit form says Wait until your files are added, then submit. with Submit request disabled while a file is on its way, names files not added without blocking, and submitting clears them"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-workflow.test.tsx#submitting while files are on their way (§2.4; UI-D5); request-form.test.tsx#the edit form’s submit dialog while files are being added (§2.4; UI-D5)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The draft's edit form lists its files with Download and Remove and adds a chosen file at once (UI-D4)"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-form.test.tsx#Supporting files on the draft’s edit form (§2.3; UI-D4)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Server Action bodies up to 26 MB reach the action whole on the four attachment pages only; elsewhere an action post over 6 MB or without a length is refused 413 by the proxy; the two Next limits are equal; a 12 MiB file downloads byte for byte"
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/security/action-body-limit.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-attachments.spec.ts#COLLAB02_LARGE_UPLOAD; #ACTION_BODY_LIMIT_OUTSIDE_ATTACHMENT_PAGES (desktop)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Supporting files section, the §2.2 alert and Adding files… at 375 and 1440 against the direction (alert weight and placement, the queue rows under the form)"
    verification: []
    human_judgment: true
    rationale: "Playwright proves the create journey, overflow and axe at both widths with three chosen files; the partial-failure alert is proven in unit tests only, so its look at both widths needs the phase's UI review."
duration: 57min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 14: Files at Intake and the Raised Body Limit Summary

**Jane now chooses files with the new-request form. The first Save draft creates the draft once, the address becomes its edit route without a navigation, `Adding files…` shows while the files go one at a time, and the page moves to the draft once every file is added or waiting for the malware check. A partly failed save stays with a focused alert and `Go to draft`, and saving again only updates the draft. The draft's edit form lists its files and adds new ones at once. The new-request form warns before an in-app link would lose unsaved work, and the submit dialog waits while files are on their way. Next's two body limits are raised to 26 MB, and the proxy keeps the 6 MB ceiling on every page that does not add files.**

PHASE_14_BASE=e50053f. COLLAB-02 is traced here but stays Pending until 14-17's phase gate (`requirements-completed` copies the plan's array, as the template asks). REQUIREMENTS.md is unchanged.

## Performance

- **Duration:** 57 min (2026-10-10T08:07:31Z to 09:04:08Z), including one full Playwright run (26.4 min).
- **Tasks:** 3 of 3, each test first (a RED commit, then a GREEN commit). Task 1 is the tracer: its verify passed end to end on both projects (12/12) before its GREEN commit, so expansion went ahead with no checkpoint (interactive, end-of-phase, automated-only verify).
- **Files:** 20 (2 created, 18 modified; 1,363 lines added, 71 removed).

## Accomplishments

- **Saving with files (D-26; UI-D3; §2.2).**
  - `createRequestAction(values, { stayOnPage: true })` and `updateRequestAction` return the draft and neither revalidate nor redirect. Without the option they redirect as before.
  - With files chosen, `Save draft` validates as before; on errors, or a failed create, the files stay listed and nothing is sent.
  - The first save creates the draft, then `window.history.replaceState` moves the address to `/app/requests/{id}/edit`, the X-1 status reads `Draft saved at {time}`, and `Save draft` shows `Adding files…` with the inline spinner, disabled. A second click does nothing.
  - The queue sends the files in order to the new draft; once none is waiting or being added and none failed, `router.replace` opens the draft's request page.
- **Partial failure (UI-D29; §1.5).**
  - The page stays, with a danger alert above the queue, focused and announced: `{k} {file wasn’t|files weren’t} added`, §2.2's description and `Go to draft`.
  - `Retry` and `Choose another file` send to the draft at once. Saving again calls the update, never the create, and retries failed transfers.
  - `Go to draft` keeps the files not added. The draft's request page restores them under `Restored from earlier in this session.`, and `Retry` sends the same `File`.
- **The deferred queue.** `UploadQueue mode="deferred"` keeps chosen rows ("chosen, not yet sent", with `Remove {name} from the list`) in its own state. They count against the room in the hint. Its ref handle offers `hasWork()` and `sendAll(requestId)`. A deferred queue never refreshes the page, because a refresh would re-render the replaced address and unmount the form (Pitfall 18).
- **The edit form (UI-D4; §2.3).** The `Supporting files` section renders `FilesPanel`, the Files section's body: the draft's list with `Download` and `Remove`, and the field that adds a file at once. The edit page reads the files only when the request read carries a file summary (D-18). Rendering the queue there also puts the upload action in that route (Pitfall 17).
- **Leave warnings (§10).** In-app links ask `Leave this request?` (`Keep editing` first) while the new-request form has unsaved fields or files chosen before the draft exists. While a file is being added, they ask `Leave while files are being added?`. Files not added only arm `beforeunload`.
- **The submit dialog (UI-D5; §2.4).** On the request page and the edit form, the dialog adds `Wait until your files are added, then submit.` and disables `Submit request` while a file is waiting or being added. With files not added, it reads `{k} {file wasn’t|files weren’t} added. Submit anyway, or retry {it|them} first.`, and confirming clears them from the tab.
- **The body limits (D-25).** `next.config.ts` sets `serverActions.bodySizeLimit` and `proxyClientMaxBodySize` from `ATTACHMENT_ACTION_BODY_LIMIT` (`'26mb'`). `proxy()` first answers 413 to a Server Action post outside `/app/requests/{id}` (which also matches `new`), `/app/requests/{id}/edit` and `/app/review/requests/{id}` when its `Content-Length` is missing, not a whole number or over 6,291,456. The matcher is unchanged.

## Task Commits

1. **Task 1 (tracer):** `28077be` test (RED), `6de2860` feat (GREEN)
2. **Task 2:** `343e1ea` test (RED), `deed55c` feat (GREEN)
3. **Task 3:** `adce057` test (RED), `70fea55` feat (GREEN)

`git rev-list --count 89ce0f9d..HEAD` is 6 before this summary's commit.

## Verification

- **RED evidence.** Vitest JUnit reports were checked with `check tdd-red-evidence`, with `classname` renamed so the parser reads each test's own name; every target named returned `RED_EVIDENCE_OK`.
  - **Task 1:** 15 of 41 failed. Targets: the stayOnPage create, the deferred sendAll, the create-once save, the Supporting files section, the edit form's immediate add and the Pitfall 17 guard. `saves as before when no file is chosen` was green at RED by design (a regression guard).
  - **Task 2:** 12 of 61 failed. Targets: the focused alert, the update-on-resave, the unsaved-fields dialog, and the submit dialog's wait and not-added lines. Already green at RED: the queue's two §10 cases (its `leaveCopy` guard and the immediate send after binding came with Task 1's deferred mode) and the in-flight dialog (14-12's).
  - **Task 3:** 15 of 17 failed against a throwaway stub of `action-body-limit.ts`, deleted before the RED commit. The two cases that passed expect `false`, which the stub returns.
- **GREEN, focused:**
  - Task 1: `vitest run` of the three test files: `Tests 41 passed (41)`. `src/features/requests src/features/attachments src/lib/performance src/lib/security`: `Tests 1377 passed (1377)`. Typecheck and lint (the same `tsc`) clean. `test:e2e e2e/request-attachments.spec.ts`: 12 passed (1.8 min; the create journey 2.7 s desktop, 2.6 s mobile). The tree was clean apart from Task 2's uncommitted RED tests.
  - Task 2: the three test files: `Tests 61 passed (61)`. With `src/components`: `Tests 1819 passed (1819)`. Typecheck clean.
  - Task 3: `vitest run src/lib/security`: `Tests 938 passed (938)`, with `proxy.test.ts`. Typecheck clean. `test:e2e e2e/request-attachments.spec.ts`: 14 passed (2.0 min). `test:e2e e2e/performance.spec.ts --project desktop -g 'app/requests/.documentId. as the Requestor'`: 1 passed.
- **The 12 MiB upload:** the whole `COLLAB02_LARGE_UPLOAD` test, including creating the draft, took 2.7 s. The file was listed as `12.0 MB`, and the download was exactly 12,582,912 bytes, equal to the bytes chosen. A 7 MB action post to `/app/requests` answered 413 in 367 ms; to `/app/requests/new` it was not refused for its size.
- **Full suites:**
  - Web (`pnpm --dir apps/csrm test`, at `70fea55`): 206 files, `Tests 4683 passed (4683)` (52 s).
  - Playwright (`pnpm --dir apps/csrm test:e2e`, at `70fea55`): `216 passed (26.4m)`, desktop 164 and mobile 52, none flaky. `REQ08_REASSIGN_THROUGH_PICKER` passed this time.
  - `api:check` exits 0 with no contract change (`schema.d.ts` refreshed, not staged).
  - The Strapi suite was not run: this plan changes no Strapi source, specification or configuration.
- **Route budgets (delivered JS, desktop, the full run at `70fea55`):**
  - `/app/requests/{documentId}` (Requestor) 288,699 of 300,000 (286,175 at 14-13); the focused run measured 288,696. The submit dialog's line and `useSubmitFiles` add about 2.5 KB. No source fallback was needed.
  - `/app/requests/new` and `/app/requests/{documentId}/edit` are not key routes in `performance.spec.ts`, so no figure exists for them.
  - `/app/risks/{documentId}` 293,185; `/app` 228,618; `/app/requests` 250,917; `/app/risks` 262,135; `/app/review/assessments/{documentId}` 317,020 of 460,000; `/app/questionnaires/{documentId}` 357,325 of 500,000.
  - Every route is within budget. `git diff e50053f -- apps/csrm/e2e/performance.spec.ts` adds no `ROUTE_BUDGET_OVERRIDES` entry.
- **Acceptance criteria:**
  - `request-actions.ts` contains `stayOnPage`, and with the option neither action reaches `redirect(`.
  - `request-form.tsx` contains `history.replaceState` and renders the `Supporting files` section; the literal is in `filesIntakeCopy` (see Deviations).
  - `request-workflow-actions.tsx` contains `Wait until your files are added, then submit.` and reads `useFilesInFlight`.
  - `next.config.ts` contains `proxyClientMaxBodySize` and no `'6mb'`. `proxy.ts` calls `exceedsActionBodyLimit(request)` before `resolveSessionRuntimeMode` (asserted by a unit test).
  - `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing, and `git status --short` is clean after each run.

## Decisions Made

See `key-decisions` in the frontmatter (one line each).

## Deviations from Plan

1. **[Rule 3 - Blocking] `confirm-dialog.tsx` gained `confirmDisabled` (outside the plan's list).** The submit dialog had no way to hold its confirm back (`deed55c`).
2. **[Rule 3 - Blocking] `files-section.tsx` now exports `FilesPanel`.** The edit form renders the same list and field as the request page (§2.3) without the `Files` frame, and passes the queue's ref through it (`6de2860`).
3. **[Rule 3 - Blocking] Other files outside the list.** `upload-queue-model.ts` gained `queueSettlement` and counts a chosen row's place. `attachments-domain.ts` gained the intake copy, the §2.2 alert and the request's leave words. `new/page.tsx` passes the person's key, and the request page passes it to the submit dialog (`6de2860`, `deed55c`).
4. **[Plan shape] No X-1 status or leave guard was on the form.** The plan assumed both from Phase 10. `SaveStatus` now reads `Draft saved at {time}`, and the form registers its own leave guard (`6de2860`, `deed55c`).
5. **[Plan shape] The `Supporting files` literal is in `attachments-domain.ts`.** The copy guard covers that module, so `request-form.tsx` renders `filesIntakeCopy.title` and does not carry the literal the acceptance criterion greps for.
6. **[Plan shape] The queue's settle report is `sendAll`'s resolved value, not a separate `settled` callback.**
7. **[TDD] Some RED cases were green at RED, as listed under Verification.** Task 3's RED ran against a throwaway stub that was never committed.

**Total deviations:** 7 (3 Rule 3, 3 plan-shape notes, 1 TDD note). **Impact:** no change to scope. No content type, schema field, relation or contract changed, and no dependency was added.

## Issues Encountered

- **Shell heredocs broke on two edits** (bash read a quote inside the block). The edits were applied from script files in the scratchpad instead, and no file was left half-written.
- **Next logs `The destination stream closed early`** while a journey leaves a page that is still streaming, and `failed-to-find-server-action` for the gate test's deliberate action id `0`. Every test passed.

## Known Stubs

None. `Add files with a note` after submission is 14-15's, and the analyst's AI column is 14-16's.

## Threat Flags

None beyond the plan's register:
- **T-14-49 is mitigated.** The proxy refuses an oversized or unmeasured action post outside the attachment pages before Next reads it (unit test and `ACTION_BODY_LIMIT_OUTSIDE_ATTACHMENT_PAGES`). 14-17 records the reverse-proxy residual under R-08-04.
- **T-14-50 is mitigated.** `proxyClientMaxBodySize` equals `bodySizeLimit` (asserted), and a 12 MiB upload downloads byte for byte.
- **T-14-51 is mitigated.** After the first create the form only updates; the journey finds one draft.
- **T-14-SC is accepted.** No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-15** hands files to the Notes composer. `UploadQueue`'s `scope="note:{id}"` and the store are unchanged, and `sendAll` is available if the composer needs to wait on its files.
- **14-16** adds the AI column to `FilesList`, which the edit form now also renders through `FilesPanel`. The Requestor's form never shows the switch.
- **14-17** records the reverse-proxy per-path limit (6 MiB by default, 27 MiB on the four attachment pages) and the `strapi-http-hardening.md` notes.
- **Route budget:** `/app/requests/{documentId}` has 11,301 bytes left and `/app/risks/{documentId}` 6,815.

## Self-Check: PASSED

- FOUND: every file in `key-files` (created and modified).
- FOUND: `28077be`, `6de2860`, `343e1ea`, `deed55c`, `adce057`, `70fea55`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
