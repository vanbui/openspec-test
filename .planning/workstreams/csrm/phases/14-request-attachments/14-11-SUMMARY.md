---
phase: 14-request-attachments
plan: 11
subsystem: api
tags: [strapi, attachments, ai-inputs-signal, request-summary, server-components, openapi, openapi-fetch, zod]
requires:
  - phase: 14-request-attachments
    provides: "14-10 ContextSummaryV3 attachments.included (a documentId per included file; v1 and v2 read as none) through parseContextSummary; 14-09 aiTextIncluded and aiTextFacts.extractedAt; 14-08 removal ending the inclusion"
  - phase: 13-request-pick-up-and-notes
    provides: "13-17 ai-inputs-signal.ts (aiInputsChanged, loadAiInputsChanged, runBaseline) and loadAnalystRequestSummaryFacts; 13-18 RequestContextLines and AiInputsChangedBlock as server-rendered slots"
provides:
  - "attachment-ai-signal.ts: attachmentAnalystCounts ({ count, included }), changedAttachmentInputs (the D-36 file rule), AttachmentInputChange, AttachmentInputsBaseline"
  - "The analyst questionnaire and assessment reads' request summary gains files: { count, included }; null on every Requestor read and for any viewer who is not a human Security Analyst"
  - "One merged AI-inputs signal { count, notes, files }: count sums both lists, non-null when either has an item; served unchanged as generation.aiInputsChanged and as the request read's aiInputs"
  - "Spec: RequestSummaryFiles on AssessmentRequestSummary and QuestionnaireAssessmentRequestAvailable; AiInputsChanged gains required files (AiInputsChangedFile, closed, maxItems 500) and drops notes minItems; client regenerated"
  - "Web: requestSummaryFilesSchema; aiInputsChangedFileSchema, and aiInputsChangedSchema strict and refined (never both lists empty); the files line in RequestContextLines; file items in AiInputsChangedBlock"
affects: [14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 15, 16]
actuals:
  tokens: 33465
  tasks: 2
  commits: 4
plan_head_before: e72e14cd47161c87f6d25748826ada772cecf2c3
plan_head_after: a648f6747646f1099acfc702f1ea058e23351a36
tech-stack:
  added: []
  patterns:
    - "A file is in the AI inputs exactly when the context loader would send it (aiTextIncluded, scanned clean, not removed). The counts and the signal both read that one predicate."
    - "The AI-inputs signal stays one served value with one loader. Every producer reaches loadAiInputsChanged, which compares the notes and the files against the same baseline."
key-files:
  created:
    - apps/backend/src/api/csrm-request-attachment/services/attachment-ai-signal.ts
    - apps/backend/tests/attachment-ai-signal.unit.test.ts
  modified:
    - apps/backend/src/csrm/ai/ai-inputs-signal.ts
    - apps/backend/src/api/csrm-assessment-request/services/request-summary-facts.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/backend/tests/ai-inputs-signal.unit.test.ts
    - apps/backend/tests/questionnaire-workflow.integration.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-summary-schema.ts
    - apps/csrm/src/features/requests/request-schema.ts
    - apps/csrm/src/features/questionnaires/questionnaire-domain.ts
    - apps/csrm/src/features/questionnaires/questionnaire-schema.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/assessments/request-context-lines.tsx
    - apps/csrm/src/features/assessments/assessment-request-link.tsx
    - "apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx"
    - "apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx"
    - apps/csrm/src/features/ai-assistance/ai-generation-facts-schema.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-domain.ts
    - apps/csrm/src/features/ai-assistance/ai-inputs-changed.tsx
    - apps/csrm/src/features/ai-assistance/ai-inputs-changed.test.tsx
    - apps/csrm/src/features/assessments/request-context-lines.test.tsx
    - apps/csrm/src/features/assessments/assessment-service.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.test.ts
    - apps/csrm/src/features/requests/request-service.test.ts
key-decisions:
  - "The files line lives in RequestContextLines (request-context-lines.tsx), the server component 13-18 built for the notes line. It is not in AssessmentRequestLink, which is client code through its importers; copy there would ship in the editor's first load. This follows the plan's must-have and its 'edit that component instead' rule."
  - "files is a required, nullable field beside Phase 13's assignment and notes on the shared request summary components. It is null on every Requestor read (including the released assessment read) and for any viewer who is not a human Security Analyst."
  - "The counts and the files half of the signal use the same human Security Analyst gate as Phase 13's figures and signal. canUseAttachmentAiInputs still governs the per-file AI facts and changes (14-09). The figures are read-only facts about files the analyst can already read."
  - "A file is in the AI inputs when it is aiTextIncluded, scanned clean and not removed (the context loader's predicate). A file the run included that is now quarantined or blocked reads Excluded since."
  - "A file the run named whose record is not among the request's files cannot be named or linked, so it is not listed. A changed file the signal cannot name (no documentId or no name) fails the read, under Phase 13 IN-103's fail-visible rule."
  - "Against a generation date, a file in the inputs whose aiTextFacts.extractedAt is later reads Included since. Unreadable facts or an unreadable date count as changed (fail visible, as for notes)."
  - "aiInputsChanged takes changedFiles as optional (none when absent), so Phase 13's callers keep their calls. The files arrive in upload order from changedAttachmentInputs, and the merge keeps that order."
  - "No producer needed more than the merged loader. Both controller helpers on GET /csrm-assessment-requests/{id} delegate to questionnaireAiInputsChanged and assessmentAiInputsChanged, and both call loadAiInputsChanged."
  - "The merge's cases live in apps/backend/tests/ai-inputs-signal.unit.test.ts. attachment-ai-signal.unit.test.ts holds the file rule only."
requirements-completed: [COLLAB-02]  # traced here; COLLAB-02 stays Pending until the 14-17 phase gate
coverage:
  - id: D1
    description: "Bob's analyst questionnaire and assessment reads carry assessmentRequest.files: { count: 0, included: 0 } before any file, { count: 2, included: 1 } for Jane's two files with the pack included, and { count: 1, included: 1 } after she removes the DOCX. Jane's reads serve files null."
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/questionnaire-workflow.integration.test.ts#mounted analyst questionnaire read's request summary counts the request's files and those in the AI inputs; Jane's carries none (D-27)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted analyst assessment read's request summary counts the request's files and those in the AI inputs; Jane's carries none (D-27)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted Requestor reads require owner scope and the complete release aggregate"
        status: pass
    human_judgment: false
  - id: D2
    description: "The server-rendered files line under the request link reads '2 files' (linking to #files) then ' · 1 included in the AI inputs', or '1 file' with no AI part, or plain 'No files'. Both analyst pages hand it to their client views as a slot."
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/request-context-lines.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "The D-36 file rule: included, excluded and removed since a run, in upload order; included since a generation date; nothing without a baseline. A changed file that cannot be named fails the read."
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-ai-signal.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "One merged signal. Files only gives { count: 2, notes: [], files }, not null. Notes only gives Phase 13's value with files: []. Both are summed. Neither, or no baseline, gives null. The loader reads the same run's v3 attachments section (a v2 run as none) or the generation date. On the mounted app, Bob's questionnaire read and request read both list the two files with no note."
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/ai-inputs-signal.unit.test.ts"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/questionnaire-workflow.integration.test.ts#mounted analyst reads say which files changed the questionnaire's AI inputs since it was generated, with no note changed, and Jane's never do (D-36)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Contract and web parsers: spec RequestSummaryFiles, AiInputsChanged with required files, and AiInputsChangedFile; the regenerated client (api:check 0). The parsers are closed: they accept files only and notes only, and refuse both lists empty. The parity and zod client-boundary guards pass."
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-schema.test.ts; apps/csrm/src/features/requests/request-service.test.ts; apps/csrm/src/features/assessments/assessment-service.test.ts; apps/csrm/src/features/contract-response-parity.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "The signal list renders file items after the note items. Each links to #file-{id} and is captioned Included since, Excluded since or Removed since. Names render as text only, and no action is offered."
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/ai-assistance/ai-inputs-changed.test.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "The files line and the signal items at 375 and 1440 against 14-UI-SPEC §6 (wrapping, stacking, visual weight)"
    verification: []
    human_judgment: true
    rationale: "This plan runs no browser. The layout classes are asserted in unit tests; the visual result belongs to the phase's UI review and 14-17's gate."
duration: 58min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 11: The Request's Files on the Analyst Pages and in the AI-Inputs Signal

**Bob's questionnaire and assessment pages now show, under the request link, how many files the request holds and how many feed the AI. The line reads `2 files · 1 included in the AI inputs` (or `1 file`, or `No files`) and is rendered on the server. The "AI inputs changed" signal now names files as well as notes: each file included, excluded or removed since the last generation, linked to its row on the request page. It stays one served value. Its count covers both lists, and a change to files alone shows it with no notes. Requestors see neither.**

PHASE_14_BASE=e50053f. COLLAB-02 is traced here but stays Pending until 14-17's phase gate (`requirements-completed` copies the plan's array, as the template asks). REQUIREMENTS.md is unchanged.

## Performance

- **Duration:** 58 min (2026-10-10T04:36:31Z to 05:34:54Z), including one full Strapi suite (20.6 min).
- **Tasks:** 2 of 2, each test first (a RED commit, then a GREEN commit). Task 1 is the tracer. Its exact verify was re-run on the committed code (web 504/504, Strapi 53/53). Expansion then went ahead with no checkpoint (interactive, end-of-phase, automated-only verify).
- **Files:** 31 (2 created, 29 modified; 935 lines added, 120 removed).

## Accomplishments

- **The files figures (D-27).**
  - `attachmentAnalystCounts({ strapi, requestId })` reads the request's stored files once. It returns `count` (files not removed) and `included` (files that are included, scanned clean and not removed). It never reads a name, the text or the digest.
  - `loadAnalystRequestSummaryFacts` adds `files` for a human Security Analyst. Both scope services project `assessmentRequest.files`, which is null for everyone else.
- **The files line (14-UI-SPEC §6.1).**
  - `RequestContextLines` renders a third caption line: the figure link `{n} {file|files}` to `/app/review/requests/{id}#files`, then ` · {k} included in the AI inputs` when k is above zero. With no files it renders plain `No files`. Figures are written out (`1,200 files`).
  - The questionnaire and assessment review pages pass `files` into the slot, so neither route gains client JavaScript.
- **The file rule (D-36).**
  - `changedAttachmentInputs({ strapi, requestId, baseline })` compares current inclusion with the baseline. A run baseline is the documentIds in its v3 `attachments.included`; a v1 or v2 run counts as having included none.
  - Against a run, a file is `included` (in the inputs now, not used then), `removed` (used then, removed since) or `excluded` (used then, otherwise out now). Against a generation date, a file is `included` when its text was extracted after that date. With no baseline, nothing is read.
  - Files are listed in upload order.
- **The merged signal (S-1).**
  - `aiInputsChanged({ markedNotes, changedFiles, baseline })` returns `{ count: notes + files, notes, files }`. It returns null with no baseline, or when neither list has an item.
  - `loadAiInputsChanged` derives both baselines from the same run, or from the same `generatedDate`.
  - Every producer reaches it: `questionnaireAiInputsChanged`, `assessmentAiInputsChanged`, and through them the request read's two helpers. The controller's D-29 comments now name files.
- **The contract.**
  - Spec: `RequestSummaryFiles` (`{ count, included }`, closed) is a required, nullable property on both request summary components. `AiInputsChanged` now requires `files` (items `AiInputsChangedFile`: `documentId`, `fileName` 1 to 255, `change` included/excluded/removed, closed; maxItems 500) and drops `minItems` on `notes`. `RequestAiInputs` and `AiGenerationFacts` still reference the one `AiInputsChanged`.
  - The client is regenerated, and `api:check` exits 0.
- **The web.**
  - `requestSummaryFilesSchema` is on both parsers.
  - `aiInputsChangedSchema` is `.strict()` with `files`. A refinement refuses a signal whose two lists are both empty. The `SameType` check holds against the domain type, which gains `files`.
  - `requestAiInputsSchema` reuses it (its comment now names files).
  - `AiInputsChangedBlock` and `aiInputsChangedSlot` show the block when either list has an item. File items render after the notes, with their captions. Names render as React text, and links are built from ids (T-14-42).

The component that renders the signal list is `AiInputsChangedBlock` in `apps/csrm/src/features/ai-assistance/ai-inputs-changed.tsx`. It is handed as a slot to the provenance header and the hub's generation cards; neither needed a change.

## Task Commits

1. **Task 1 (tracer):** `890c5fb` test (RED), `b09b7ad` feat (GREEN)
2. **Task 2:** `6c791d9` test (RED), `a648f67` feat (GREEN)

`git rev-list --count e72e14cd..HEAD` is 4 before this summary's commit.

## Verification

- **RED evidence** (TAP; `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for each target):
  - **Task 1, Strapi:**
    - Assessment file: 2 of 53 failed (`FILES_BEFORE_ANY_FILE`, and the owner shape test on `files: null`).
    - Questionnaire case: 1 of 1 failed (`FILES_BEFORE_ANY_FILE`). This case was re-run with the GREEN source set aside; see Issues.
  - **Task 1, web:** 8 of 101 failed: the two parsers, and the files line and page cases.
  - **Task 2, Strapi units:** 15 of 20 failed. The merge cases failed on assertions; the file rule failed on the missing function.
  - **Task 2, Strapi mounted:** the D-36 case failed (`FILES_SIGNAL_NOT_LISTED`: null), and so did Phase 13's three exact-shape cases.
  - **Task 2, web:** 11 of 737 failed.
- **GREEN, focused:**
  - Task 1:
    - web: request-context-lines, assessment-service, `src/features/questionnaires`, parity and zod-boundary: `Tests 569 passed (569)`.
    - `questionnaire-workflow.integration` and `assessment-workflow.integration`: `# tests 53 / # pass 53`.
    - Typecheck clean; `api:check` 0 once committed.
  - Task 2:
    - web: `src/features/ai-assistance`, `src/features/questionnaires`, assessment-service, request-service, parity, zod-boundary and request-context-lines: `Tests 752 passed (752)`.
    - `attachment-ai-signal.unit` and `ai-inputs-signal.unit`: `ℹ tests 20 / ℹ pass 20`.
    - The two workflow files: `ℹ tests 54 / ℹ pass 54`.
    - Typecheck and lint clean; `api:check` 0 after the commit.
- **Full suites:**
  - Strapi (`pnpm --dir apps/backend test`, on the Task 2 code): `ℹ tests 1247 / ℹ pass 1247 / ℹ fail 0` (1,238 s).
  - Web (`pnpm --dir apps/csrm test`): 196 files, `Tests 4468 passed (4468)`. It was run twice; the second run followed two comment-only reflows.
- **Acceptance criteria:**
  - Met:
    - `ai-inputs-changed.tsx` holds `Included since`, `Excluded since`, `Removed since` and `signal.files`, and neither gate tests `signal.notes.length` alone.
    - The spec's `AiInputsChanged` requires `files`, has no `minItems` on `notes`, and references `AiInputsChangedFile`, whose `additionalProperties` is false. `RequestAiInputs` and `AiGenerationFacts` still reference `AiInputsChanged`, and there is no second signal schema.
    - `aiInputsChangedSchema` is `.strict()`, has no `.min(1)` on `notes`, and has `files` with `.max(500)`; `SameType` compiles.
    - `ai-inputs-signal.unit.test.ts` holds the files-only and notes-only cases.
    - Both verify commands exit 0.
  - Not met: Task 1's grep on `assessment-request-link.tsx` (see Deviations).
- **Route budget:** no unit counterpart of `performance.spec.ts` exists. The line is server-rendered and adds no client module.
- **EICAR guard:** `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing.
- **Playwright:** not run (the plan runs none). `served-operations.json` was not regenerated (no route or grant changed).

## Decisions Made

See `key-decisions` in the frontmatter (one line each).

## Deviations from Plan

1. **[Plan shape] The files line is in `request-context-lines.tsx`, not `assessment-request-link.tsx`.** `AssessmentRequestLink` is imported by the client editor and the released view, so copy there would ship in the editor's first load. 13-18 put the notes line in `RequestContextLines`, a server component, for exactly that reason. The plan's must-have ("no client component is added, so the editor's first-load JavaScript is unchanged") and its own "edit that component instead" rule therefore apply.
   - The component cases went into `request-context-lines.test.tsx`, so no `assessment-request-link.test.tsx` was created. That file checks that only the two record pages import the module, and that the module has no client directive and no hooks.
   - Task 1's acceptance grep (`assessment-request-link.tsx` contains `included in the AI inputs` and `No files`) is not met, by design. The link module's doc comment now names the files line.
2. **[Rule 3 - Blocking] Files outside the plan's list.**
   - `request-summary-facts.ts` is where the analyst summary facts are loaded.
   - `request-summary-schema.ts` and `request-domain.ts` hold the shared summary parser and type.
   - `questionnaire-domain.ts` holds the relationship type, for the `SameType` check.
   - The two analyst review pages pass `files` into the slot.
3. **[Plan shape] `ai-provenance-header.tsx` and its test are unchanged.** The header takes the signal as an opaque slot, so it renders file items with no change.
4. **[Rule 1 - Bug] RED fixture collision.** The first Task 2 mounted run failed at setup: the request number `QWF-AI-INPUTS-FILES` was already used by Task 1's `legacyGeneratedQuestionnaire("FILES")`. The new case was renamed (`QWF-AI-INPUTS-FILE-SIGNAL`) and re-run to a valid RED before the RED commit.

**Total deviations:** 4 (1 Rule 1, 1 Rule 3, 2 plan-shape notes). **Impact:** no change to scope. No content type, schema field or relation changed (read shapes and their contract only), and no dependency was added.

## Issues Encountered

- **The harness compiles `src` at each test file's start.** Task 1's first RED run took both workflow files in one process chain, and the questionnaire file started after Task 1's GREEN source was already on disk, so its new case passed. That GREEN source was copied aside and the three tracked files were restored to HEAD individually (no stash, no blanket reset). The questionnaire case was re-run to a valid RED, and the source was restored before the RED commit. No source was edited during any later Strapi run.
- **Strapi test type errors block emit** (`noEmitOnError`). The Task 2 RED run compiled with `--noEmitOnError false`, so the new tests ran against the old source.
- **`api:generate` staged `schema.d.ts`** after the first spec change (as in 14-10). It went in with the Task 1 GREEN commit, which was its home.
- **Shell heredocs mangle escapes on this host** (as in 14-08 to 14-10). One stray backspace in a test regex was caught by a byte check and fixed before the RED commit. Larger edits went through Python scripts written as files, or through the Edit tool.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- **T-14-41 is mitigated.** `files` and the signal are served to human Security Analysts only. Mounted cases assert that Jane's questionnaire read serves `files: null` with no `"included"` in the body, that her released assessment read serves `files: null` (exact shape), that her unreleased draft is 404, and that her request read's `aiInputs` is null.
- **T-14-42 is mitigated.** File names render as React text. A component case renders `<img src=x onerror=alert(1)>.pdf` as a link name with no `img` element. Links are built from documentIds.
- **T-14-SC is accepted.** No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-12** (Playwright settings and journeys) can assert the files line under the request link on both analyst pages, and the file items in the signal list.
- **14-16** (the UI) gets `#file-{id}` anchors as link targets from the signal. The Files section rows must carry those ids.
- **Phases 15 and 16** add their context-wide operations to `CONTEXT_WIDE_AI_OPERATIONS`. The files half then follows the same baseline with no further change.

## Self-Check: PASSED

- FOUND: `apps/backend/src/api/csrm-request-attachment/services/attachment-ai-signal.ts`, `apps/backend/tests/attachment-ai-signal.unit.test.ts`, and every modified file in `key-files`.
- FOUND: `890c5fb`, `b09b7ad`, `6c791d9`, `a648f67`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*

## Follow-up fix (2026-10-10, orchestrator re-opening)

- **Found by:** 14-17's `COLLAB02_UAT012_SCENARIO @journey`. Its axe scan of Bob's questionnaire review page failed at 1440 and 375 with `target-size: .gap-x-2 (Target has insufficient size (35.9px by 16px, should be at least 24px by 24px))`.
- **Defect:** WCAG 2.2 SC 2.5.8. The notes link in `RequestContextLines` was 35.9 by 16 px. It is `inline-flex`, so axe does not exempt it as inline text. This plan's files line (`b09b7ad`) put the `{n} files` link 4 px below it, so the spacing exception no longer held. The analyst assessment page renders the same component and had the same defect. The pick-up link (a flex item) and the files link (inline text only while the AI part follows it) could fail in the same way.
- **Fix:** the pick-up, notes and files links now share `inline-flex min-h-6 items-center`, the 24 px record-link target the lists already use. Every target in the component is at least 24 px tall whichever lines are shown. Only layout utilities changed; the record-link colour and underline tokens are unchanged.
- **Test:** `request-context-lines.test.tsx` checks all 18 combinations of the three lines (pick-up offered or assignee named; notes with or without unread, or none; files with or without included, or none). It asserts the link count and that every link has the 24 px target classes. It failed 17 of 18 before the fix (the combination with no links passed).
- **Commits:** test `7f42b392`, fix `cfa23fb5`.
- **Browser proof:** `pnpm --dir apps/csrm test:e2e e2e/request-attachments.spec.ts` passed 20 of 20 (11 desktop, 9 mobile), including the `COLLAB02_UAT012_SCENARIO` journey on both projects. The desktop performance spec passed 11 of 11: `/app/review/assessments/{documentId}` delivered 318,158 B JS against its 460,000 B budget, `/app/requests/{documentId}` 293,910 B and `/app/risks/{documentId}` 293,675 B against their 300,000 B budgets. The component is server-rendered, so it adds no client JS.
