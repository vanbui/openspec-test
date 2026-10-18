---
phase: 13-request-pick-up-and-notes
plan: 18
subsystem: ui
tags: [nextjs, server-components, slots, ai-assistance, request-notes, request-assignment, playwright, route-budget]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: generation.aiInputsChanged, the request read's aiInputs, and the request summary's assignment and notes (13-17); the v2 run summary's notes.included (13-16); the X-17 unread marker and the notes domain (13-10); the mark switch (13-11); the assignment block anchor (13-09)
  - phase: 12-ai-context-suggestions-and-provenance
    provides: the provenance header, the lazily loaded "What the AI used" sheet body and its frame (12-13 to 12-15)
provides:
  - "src/features/ai-assistance/ai-inputs-changed.tsx: AiInputsChangedBlock with aiInputsChangedHeading, aiInputsChangedItem and aiInputsChangedCaption (X-18, 13-UI-SPEC §10.2). A Server Component that only the three analyst record pages import"
  - "src/features/assessments/request-context-lines.tsx: RequestContextLines (13-UI-SPEC §11). A Server Component that only the questionnaire review and assessment pages import"
  - "The provenance header's aiInputsChanged slot, set as its last block. QuestionnaireReview and AssessmentEditor pass it through. AssessmentDetail takes questionnaireAiInputs and draftAiInputs and hands them to the questionnaire and draft cards"
  - "AssessmentRequestLink and the questionnaire's request relationship take a requestContext slot under the request link"
  - "The run sheet's Notes group with sheetNotesHeading and sheetNoteRow, in the lazily loaded body"
  - "E2E COLLAB01_AI_INPUTS_CHANGED_SIGNAL and REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT, both projects"
affects: [13-19, 14, 15, 16]
actuals:
  tokens: 26500
  tasks: 3
  commits: 5
plan_head_before: 7ddf258f2f4ebb3f24e03aa15c9699889915e9d8
plan_head_after: c7dd3e2d2a770e0dc3830fab0783efb3fe09b05c
tech-stack:
  added: []
  patterns:
    - "A server-rendered block handed through client modules as a ReactNode slot, so no route gains client JavaScript for it. An importer check holds the block to its pages"
    - "A page test that calls the async Server Component and reads the props it hands its client view, with the view stood in for"
    - "A sheet link in Radix Close asChild around next/link closes the sheet and then navigates, because Next's Link runs onClick before it navigates"
key-files:
  created:
    - apps/csrm/src/features/ai-assistance/ai-inputs-changed.tsx
    - apps/csrm/src/features/ai-assistance/ai-inputs-changed.test.tsx
    - apps/csrm/src/features/assessments/request-context-lines.tsx
    - apps/csrm/src/features/assessments/request-context-lines.test.tsx
  modified:
    - apps/csrm/src/features/ai-assistance/ai-provenance-header.tsx
    - apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx
    - apps/csrm/src/features/assessments/assessment-request-link.tsx
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/src/features/assessments/assessment-detail.tsx
    - apps/csrm/src/features/assessments/questionnaire-generation-job.tsx
    - apps/csrm/src/features/assessments/assessment-draft-job.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-review.tsx
    - apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx
    - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
    - apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/request-notes.spec.ts
    - apps/csrm/e2e/request-pick-up.spec.ts
key-decisions:
  - "The signal, the request lines and their copy render on the server in the three record pages and travel as ReactNode slots. ai-assistance-domain.ts is unchanged, so the Risk route's client graph gains nothing."
  - "Once the request has its assessment, the draft card offers nothing to generate (W-1). While the served signal names notes changed since the draft, the card still renders with its heading and the signal, and no action."
  - "The signal is the provenance header's last block, below a top border, after the review line and the sheet trigger's row."
  - "Each sheet row's link is next/link inside Radix Close asChild. It closes the sheet, then navigates in the client. It drops the Close button's type, which an anchor does not take."
  - "The sheet's Notes group is its own section (heading, count line, list), not label and value rows, so its copy is exactly §10.3's."
  - "The notes figure link is named `{n} notes, {k} new`, the hub's naming. With no notes the line reads `No notes` in plain text."
  - "The questionnaire card carries the questionnaire signal only where the card renders, which is a submitted request. The questionnaire review page always carries it."
  - "COLLAB-01 and REQ-08 stay Pending until the phase gate (the 13-03 to 13-17 precedent)."
requirements-completed: []
coverage:
  - id: D1
    description: "After Bob marks Jane's note, the hub's questionnaire card and the questionnaire review page's provenance header say `AI inputs changed since this questionnaire was generated`. They link the note in the thread with `Marked since`, then `The AI hasn’t seen these changes.` There is no action, and Jane's page shows none of it. Checked at 1440 and 375, axe clean."
    requirement: "COLLAB-01"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-notes.spec.ts#COLLAB01_AI_INPUTS_CHANGED_SIGNAL (desktop and mobile)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/ai-assistance/ai-inputs-changed.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#the AI-inputs signal on the hub’s generation cards"
        status: pass
    human_judgment: false
  - id: D2
    description: "What the AI used gains a Notes group: `{n} notes included` and one row per note by part, time and length, whose link closes the sheet, or `None included`. A v1 run reads `None included`. The note's text is never shown."
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/ai-assistance/ai-run-sheet.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "The questionnaire review and assessment pages read `Assigned to {name}`, or `Not picked up · Pick up on the request page`, under the originating request link, with the notes figure and `{k} new`. The pick-up link opens the request at its assignment block."
    requirement: "REQ-08"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/request-pick-up.spec.ts#REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT (desktop and mobile)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/request-context-lines.test.tsx"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/analyst-assessment-route.test.tsx#shows the assignee and notes lines under the originating request link, editable or released"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Risk route gains no client code. The editor stays within its 460,000-byte budget. No budget override."
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/performance.spec.ts (desktop, 11 passed)"
        status: pass
    human_judgment: false
duration: 33min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 18: The AI-Inputs Signal, the Run Sheet's Notes and the Record Lines Summary

**Analysts now see which marked notes the AI has not yet seen, wherever a record's generation shows: the questionnaire review page's and the editor's provenance header, and the hub's questionnaire and draft cards. "What the AI used" names the notes a run included, by part, time and length. The questionnaire and assessment pages say who holds the request and how many notes it has. All of it renders on the server and reaches the client views as slots, so the Risk route's client code is unchanged.**

## Performance

- **Duration:** about 33 min, including two runs of the two journey specs and one performance run
- **Started:** 2026-10-09T05:15Z
- **Completed:** 2026-10-09T05:48Z
- **Tasks:** 3 (Tasks 1 and 2 RED, then GREEN; Task 1 the tracer)
- **Files:** 4 created, 16 modified (code and tests)

## Accomplishments

- **The signal (D-29, X-18, §10.2).** `AiInputsChangedBlock({ target, requestId, signal })` renders nothing for `null`. Otherwise it renders:
  - the heading line beside a 16px `Sparkles`;
  - a `ul` named by the heading. Each item is a record link `{Requestor|Security Analyst} note · {LocalInstant}` to `/app/review/requests/{id}#note-{noteId}`, then `Marked since` or `Unmarked since`;
  - `The AI hasn’t seen these changes.`

  Each item sits on one line from 768px, with ` · ` before the caption, and stacks at 375. The block has no button.
- **Placement.** The block is placed on three pages:
  - The questionnaire review page renders it from `generation.aiInputsChanged`, linked to the originating request, and hands it through `QuestionnaireReview` to the provenance header.
  - The assessment page does the same through `AssessmentEditor`.
  - The request hub page renders both targets from `request.aiInputs` and hands them through `AssessmentDetail` to the two cards, above their action or state line.
- **The sheet (D-28, §10.3).** The lazily loaded `ai-run-sheet.tsx` body gains `Notes` after `Request`: `{n} {note|notes} included`, then one row per note, `{part} note · {time} · {characters} characters`. Lengths and counts are written out (`1 character`, `2,400 characters`). With no notes it reads `None included`. It never shows the note's text.
- **The record lines (D-16, D-25, §11).** `RequestContextLines` renders, as captions:
  - `Assigned to {name}`, or `Not picked up`. When the served pick-up state is `allowed`, ` · Pick up on the request page` follows, linking `#assignment`;
  - the notes figure link with the X-17 `{k} new` (to `#notes`), or `No notes`.

  It renders nothing when a read serves neither, as a Requestor's does.
- **Where each new module ships:**

| Module | Ships as |
| --- | --- |
| `ai-inputs-changed.tsx` | Server-rendered slot. Importers: the three record pages only (verify's importer check) |
| `request-context-lines.tsx` | Server-rendered slot. Importers: the questionnaire review and assessment pages only |
| `sheetNotesHeading`, `sheetNoteRow`, `NotesGroup` | Lazy sheet body (`ai-run-sheet.tsx`), outside every first load |
| Slot props on the header, editor, questionnaire review, detail view, two cards and request link | Client. A prop pass-through only |

## Task Commits

1. **Task 1 RED** `bbe2680`: `test(13-18): expect analysts to see which notes changed the AI inputs`
2. **Task 1 GREEN** `da98092`: `feat(13-18): show analysts when marked notes changed the AI inputs`
3. **Task 2 RED** `bfd3e43`: `test(13-18): expect the run sheet's notes and the request lines on both records`
4. **Task 2 GREEN** `3a3fd1a`: `feat(13-18): show which notes a run used and who holds the request on its records`
5. **Task 3** `c7dd3e2`: `test(13-18): prove the AI-inputs signal and the record lines in the browser`

## Test Counts

| Run | Result |
| --- | --- |
| Task 1 RED, web (5 files) | **7 failed / 305 passed**, each on the planned slot or guard assertion. `ai-inputs-changed.test.tsx` could not load its missing module (the 13-10 precedent) |
| Task 1 verify, web (`src/features/ai-assistance`, `assessments`, `questionnaires`, copy, zod and server-only guards) | Test Files 46 passed, **Tests 1,147 passed** |
| Task 1 verify, typecheck, lint, importer check, `ai-assistance-domain.ts` copy check | clean. Importers are exactly the three record pages |
| Task 1 tracer gate | Task 1's full verify re-run passed before expansion |
| Task 2 RED, web (4 files) | **10 failed / 50 passed**, on the sheet's Notes group, the editor's lines and the questionnaire slot. `request-context-lines.test.tsx` could not load its missing module |
| Task 2 verify, web (same folders and guards, with the copy guard) | Test Files 47 passed, **Tests 1,167 passed** |
| Task 2 verify, typecheck, lint, importer check, domain copy check | clean. Importers are exactly the questionnaire review and assessment pages |
| Mobile list check (`--list --project=mobile`, both specs) | both new tests listed, 20 mobile tests in the two specs |
| Playwright, `request-notes.spec.ts` and `request-pick-up.spec.ts`, first run | 38 passed / 2 failed. The new signal test failed on its own request title, which contained "AI inputs changed" (fixed, see Deviations) |
| Playwright, the same two specs, final run | **40 passed** (desktop 20, mobile 20), 5.5 min. Tree clean after |
| Playwright, `performance.spec.ts --project desktop` | **11 passed** (1.8 min). Tree clean after |
| Full web unit suite (`vitest run`, at `c7dd3e2`) | **Test Files 190 passed, Tests 4,205 passed** |

Nothing listened on 1337 or 3000 before either Playwright run. After both, `git status --short` showed only the two spec files this plan was editing.

## Route Budgets (delivered JavaScript, desktop medians, `performance.spec.ts`)

| Route | Phase 12 final | Before this plan (13-15/13-17 run) | After this plan | Budget |
| --- | --- | --- | --- | --- |
| `/app/review/assessments/{documentId}` | — | 317,246 (decoded 1,026,954) | **317,297** (decoded 1,027,155) | 460,000 |
| `/app/risks/{documentId}` | 299,594 (406 headroom) | 299,882 (decoded 962,902) | **299,885** (decoded **962,902**, unchanged) | 300,000 |

- **The Risk route gains no code.** Its decoded JavaScript is byte for byte the same size: 35 scripts before and after, and each of the 7 chunks whose hash changed keeps its exact decoded size. The +3 delivered bytes are gzip jitter from content-hashed names that change on every build.
  - Every route this plan does not touch moved the same way in this run, with unchanged decoded bytes: `/app` 235,962 to 235,964, `/app/risks` 269,555 to 269,557, `/app/admin/controls` 256,365 to 256,367.
  - 13-15 measured this build-to-build spread as ±3 bytes on the same route.
  - Headroom is 115 bytes.
- **The editor** gains 51 delivered bytes (201 decoded): the slot props, the header's slot wrapper and the draft card's signal-only state. It keeps 142,703 bytes of headroom under its own budget.
- `PERFORMANCE_BUDGETS` and `ROUTE_BUDGET_OVERRIDES` are untouched. No 13-18 commit touches `performance.spec.ts`.

## Decisions Made

See `key-decisions` above. In short:
- Server-rendered slots carry the signal and the lines, and `ai-assistance-domain.ts` is unchanged.
- The draft card stays for its signal once the assessment exists, offering nothing.
- The signal is the header's last block, below a border.
- The sheet's link closes the sheet, then navigates in the client.
- The Notes group is its own section, with §10.3's copy exactly.
- The figure link is named as on the hub.
- The questionnaire card carries the signal only where it renders.
- COLLAB-01 and REQ-08 stay Pending until the phase gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] The draft card rendered nothing once the assessment existed**
- **Found during:** Task 1 RED
- **Issue:** `AssessmentDraftJob` returns null when the request has its assessment and no job is on the card (W-1). That is exactly when the draft's signal exists, so the hub could never show it. §10.2 places the signal on the draft card.
- **Fix:** In that state, the card renders its heading and the signal slot when one is served, with no description and no action. Without a slot it still renders nothing, so the existing W-1 cases are unchanged.
- **Files modified:** `apps/csrm/src/features/assessments/assessment-draft-job.tsx`
- **Commit:** `da98092`

**2. [Rule 1 - Test defect] The first signal journey matched its own request title**
- **Found during:** Task 3, first Playwright run
- **Issue:** The test titled Jane's request `AI inputs changed {project} …`. Its last check, that Jane's page shows no `/AI inputs changed/`, then found the title five times: the heading, the summary and three request fields. The product was right: every earlier step passed in both projects.
- **Fix:** The title is now `Note marked after generation …`. The Requestor check looks for the signal's own words (`AI inputs changed since this`, `seen these changes`, `Marked since`).
- **Files modified:** `apps/csrm/e2e/request-notes.spec.ts`
- **Commit:** `c7dd3e2`

### Files beyond the plan's list

- `apps/csrm/src/features/assessments/analyst-assessment-route.test.tsx` (Task 2 RED): a full render through the real page and editor shows the lines under the originating request link, editable and released. A second case shows none when the read serves neither.
- `apps/csrm/src/features/questionnaires/questionnaire-workflow.test.tsx` (Task 2 RED): the questionnaire's `requestContext` slot sits under its request link in the submitted and awaiting-submission states.
- `apps/csrm/src/lib/performance/interface-copy-guard.test.ts` also guards `request-context-lines.tsx` (Task 2 GREEN), beside Task 1's signal case.
- **Not modified:** `apps/csrm/src/features/assessments/released-assessment.tsx`.
  - It is the Requestor's released view (`/app/assessments/{id}`) only. The analyst's released assessment is the editor's read-only state, which carries the lines.
  - `AssessmentRequestLink`'s `requestContext` is optional, so the Requestor's view stays as it is, which the Requestor's null summary requires anyway.

## Threat Surface

- T-13-57 is mitigated. Both blocks render only from analyst-only served fields, and the E2E checks Jane's page carries none of the signal's words.
- T-13-58 is mitigated. The sheet shows part, time and length only, and the unit rows match `{part} note · {time} · {n} characters` exactly.
- T-13-59 is mitigated. The figures are measured above, with no override.
- T-13-SC: no package was added.
- No new route, content type, grant or contract change. Every run used the deterministic provider.

## Known Stubs

None.

## Next Phase Readiness

13-19's walk can see the signal on the hub card and in both provenance headers, the sheet's Notes group, and the lines under the originating request link. Phases 15 and 16 attach their re-run actions to the same served fields. The block carries no action today, and a slot leaves room for one.

## Self-Check: PASSED

- The four created files exist: `ai-inputs-changed.tsx`, `ai-inputs-changed.test.tsx`, `request-context-lines.tsx` and `request-context-lines.test.tsx`.
- Commits `bbe2680`, `da98092`, `bfd3e43`, `3a3fd1a` and `c7dd3e2` are on the branch, and `git rev-list --count 7ddf258..c7dd3e2` is 5.
