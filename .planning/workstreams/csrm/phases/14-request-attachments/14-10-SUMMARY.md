---
phase: 14-request-attachments
plan: 10
subsystem: api
tags: [strapi, attachments, ai-context, prompt-injection, untrusted-data, run-record, context-summary-v3, openapi, openapi-fetch, zod]
requires:
  - phase: 14-request-attachments
    provides: "14-09 aiTextIncluded, aiText (capped at 20,000) and aiTextFacts { available, kept, truncated, extractor, extractedAt }; 14-08 removal ending inclusion; 14-03 TEXT_BEARING_ATTACHMENT_TYPES and ATTACHMENT_LIMITS"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "buildAssessmentContext, CONTEXT_BOUNDS, AssessmentContextTooLargeError, parseContextSummary, projectAiRun, findRun, the generation registries, the OpenAI-compatible provider and its fake server"
  - phase: 13-request-pick-up-and-notes
    provides: "the marked notes in the untrusted block, ContextSummaryV2, the marked-note refusal message and the loader's fail-closed rule"
provides:
  - "prompt-data.ts promptDataBlock(label, attributes, value): an escaped block whose attributes are code constants and integers only (13-16 added no attribute-capable helper, so this is new)"
  - "assessment-context.ts: ContextAttachment, the attachments section kind, ATTACHMENT_CONTEXT_BOUNDS { questionnaire-generation 30,000, assessment-draft 60,000 }, ContextSummaryV3, AssessmentContextTooLargeError.attachmentDocumentIds, contextTooLargeMessage(notes, files)"
  - "prompt-sections.ts: one <attachment n type part truncated kept available> block per included file inside <requestorData>"
  - "assessment-context-loader.ts: loadIncludedAttachments (included, clean, unremoved, with text, upload order, never the name), resolveContextAttachments (current name, request, removed, one read), failureAttachmentIds, failureAttachmentsEntry"
  - "ai-run-record.ts: parseContextSummary for v1, v2 and v3 closed (v1/v2 read as no files); projectAiRun(run, names) and runAttachmentIds; findRun names the files in one query"
  - "Both registries keep failure.attachmentDocumentIds; the analyst job projections serve failureAttachments [{ documentId, fileName }] for a CONTEXT_TOO_LARGE failure"
  - "Spec: AiRunContextSummary v3 with attachments (AiRunContextAttachments, AiRunContextAttachment); GenerationJobFailureAttachment and optional failureAttachments on QuestionnaireGenerationJob and AssessmentDraftJobFailed; client regenerated"
  - "Web: aiRunContextAttachmentsSchema in ai-assistance-schema.ts; failureAttachments on the failed job parsers in assessment-schema.ts; parity registrations"
affects: [14-11, 14-13, 14-14, 14-15, 14-16, 14-17, 15, 16, 17]
actuals:
  tokens: 35857
  tasks: 3
  commits: 7
plan_head_before: bd9b110748935bdbbf9f1642e9e9fef3df44b66f
plan_head_after: 9201f708892452f8c6ec0014d833c115626b8b72
tech-stack:
  added: []
  patterns:
    - "A file's text enters the prompt only as promptDataBlock('attachment', constants and integers, escaped text), inside the untrusted Requestor block, capped by the builder to its stored kept length"
    - "Stored records keep files by documentId and digest only; every read that shows a file resolves its current name from the attachment record at read time, in one query"
    - "A refusal that names files carries their documentIds on the error and the job; the message counts them, the projection names them"
key-files:
  created: []
  modified:
    - apps/backend/src/csrm/prompt-data.ts
    - apps/backend/src/csrm/ai/prompt-sections.ts
    - apps/backend/src/csrm/ai/assessment-context.ts
    - apps/backend/src/csrm/ai/assessment-context-loader.ts
    - apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts
    - apps/backend/src/api/csrm-ai-run/controllers/csrm-ai-run.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
    - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/backend/tests/assessment-context.unit.test.ts
    - apps/backend/tests/ai-provider-guardrails.unit.test.ts
    - apps/backend/tests/attachment-ai-input.integration.test.ts
    - apps/backend/tests/ai-provenance.unit.test.ts
    - apps/backend/tests/ai-run.integration.test.ts
    - apps/backend/tests/assessment-context.integration.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/backend/tests/questionnaire-generation.integration.test.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-service.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts
    - apps/csrm/src/features/ai-assistance/test-fixtures.ts
    - apps/csrm/src/features/assessments/assessment-schema.ts
    - apps/csrm/src/features/assessments/assessment-service.ts
    - apps/csrm/src/features/assessments/assessment-service.test.ts
key-decisions:
  - "13-16 added no attribute-capable helper, so promptDataBlock is new in prompt-data.ts; promptDataTag is unchanged."
  - "Each included file renders after the other Requestor sections under a sectionKind 'attachments' line, as one <attachment n type part truncated kept available> block, so the existing section list reads the same way for every kind."
  - "The builder caps each file to its stored kept length and sends exactly that; kept, truncated and the summary's charactersSent describe what was sent."
  - "An included file's text informs which Risk Types and controls are offered, as a marked note's does (D-27's precedent)."
  - "An included file the loader cannot read closed (type, part, digest, text or facts) fails the context rather than being left out, Phase 13's marked-note rule; the loader does not import the attachment projection, to avoid the module cycle the notes loader documents."
  - "A v3 summary whose attachments section is malformed parses as null (the whole summary unreadable), as a malformed notes section does: reading it as 'no files' would misstate what the AI used."
  - "Over the attachment bound the refusal names the files only; over the whole budget or the summary bound it names the marked notes and the files together, within the 255-character job message."
  - "The job projections are flat (failureCode, failureMessage), so the files land as a sibling failureAttachments rather than the plan's failure.attachments; 14-16 reads failureAttachments."
  - "The run read names a file only from a record on the run's own request; a file whose record is gone (or on another request) reads fileName null, requestId null, removed true."
  - "The job failure names stay unscoped to the request: the ids come from the server's own error, never from input."
  - "The web parsers stay shape-only (no cross-field checks); the server guarantees truncation and the bound, as with notes."
requirements-completed: [COLLAB-02]  # traced here; COLLAB-02 stays Pending until the 14-17 phase gate
coverage:
  - id: D1
    description: "On Jane's request with the vendor pack included and data-flow.docx not, the mounted context carries the pack's text as its own escaped block inside <requestorData> and nothing of the DOCX or either name; the OpenAI-compatible adapter against a fake loopback server sends exactly that"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/attachment-ai-input.integration.test.ts#Bob's context carries the included security pack's text and nothing of the data-flow document, and the provider receives exactly that (D-34, D-39)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/assessment-context.unit.test.ts#included files render in upload order as their own escaped blocks inside the untrusted block, with no name, person, time, id or request number"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bob's questionnaire generation records only the pack on its run (v3 summary: documentId, digest, type, part, counts; never text or name); v1 and v2 summaries read as no files; a malformed attachments section reads as none; promptDataBlock refuses anything but constants and integers"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/attachment-ai-input.integration.test.ts#Bob's questionnaire generation records the included security pack, and only it, on its run (D-35)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/assessment-context.unit.test.ts (the summary parser and promptDataBlock tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hostile file text (closing tags, a fake analyst instruction, a script tag, a 100,000-character line) stays one escaped block inside <requestorData>, capped to its kept length, with the system message unchanged"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/ai-provider-guardrails.unit.test.ts (the two hostile file text tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "File text over 30,000 (questionnaire) or 60,000 (draft) characters, or over the whole budget with files included, is CONTEXT_TOO_LARGE before any run or provider call; the job reads name the files by their current names; Jane's job reads stay 403"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/assessment-context.unit.test.ts (the two bound tests)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/attachment-ai-input.integration.test.ts#with two 20,000-character files included, Bob's questionnaire generation fails as too large before any provider call, and his job reads name both files (D-33)"
        status: pass
    human_judgment: false
  - id: D5
    description: "GET /api/v1/ai_runs/{runId} names the pack with its current fileName, requestId and removed false; after Jane removes it, removed true with the name still resolved; the stored summary never holds the name; a v2 run reads as no files"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/attachment-ai-input.integration.test.ts#Bob's run read names the pack the run used by its current name, still resolves it after Jane removes it, and reads an earlier run as having used none (D-35)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The contract chain and the web parsers: spec components, regenerated client (api:check 0), the run and job parsers closed, the parity guard"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts; apps/csrm/src/features/assessments/assessment-service.test.ts; apps/csrm/src/features/contract-response-parity.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/backend test (1232/1232); pnpm --dir apps/csrm test (4454/4454); api:check; typecheck; lint"
        status: pass
    human_judgment: false
duration: 102min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 10: Included File Text in the AI Context and the v3 Run Summary

**When an analyst generates, the AI now reads the files a Security Analyst included, and only those. Each file goes in as its own escaped `<attachment>` block inside the untrusted Requestor data. Its attributes are code constants and integers only: no name, person, time, id or request number. Files have their own per-run bound (30,000 characters for the questionnaire, 60,000 for the draft). Over that bound the job fails before any provider call and names the files to exclude. The run record's summary moves to v3. It keeps each file's documentId, digest, type, part and counts, never its text or name. The run read resolves each file's current name, and still names a file that was removed later.**

PHASE_14_BASE=e50053f. COLLAB-02 is traced here but stays Pending until 14-17's phase gate (`requirements-completed` copies the plan's array, as the template asks). REQUIREMENTS.md is unchanged.

## Performance

- **Duration:** 102 min (2026-10-10T02:45:43Z to 04:28:34Z). This includes two full Strapi suites (22 and 22.5 min); the second ran after the fix below.
- **Tasks:** 3 of 3, each test first (a RED commit, then a GREEN commit), plus one fix commit. Task 1 is the tracer. Its verify was re-run on the committed code (45/45). Expansion then went ahead with no checkpoint (interactive, end-of-phase, automated-only verify).
- **Files:** 27 modified, none created (870 lines added, 95 removed).

## Accomplishments

- **The prompt (D-34).**
  - `promptDataBlock(label, attributes, value)` escapes exactly as `promptDataTag` does. A label or attribute name must match `^[a-z][a-zA-Z]*$`, and a value must be a safe integer or match `^[a-z0-9-]+$`. Anything else throws, so a file name can never become markup.
  - Each included file renders as `<attachment n="1" type="pdf" part="requestor" truncated="false" kept="…" available="…">…</attachment>`, in upload order, after the other Requestor sections.
  - The uploader's part makes no difference: an analyst's file is untrusted data too.
  - Nothing renders when no file is included. Excluded, quarantined, blocked and removed files leave no trace.
- **The loader.** `loadIncludedAttachments` reads only files that are included, scanned clean, not removed and hold stored text. It sorts them by `uploadedAt`, then `id`. It selects `documentId`, `fileType`, `uploaderPart`, `sha256`, `aiText` and `aiTextFacts`, and never `fileName`. It reads at most 21, and more than 20 fails closed.
- **The bound (D-33).**
  - `ATTACHMENT_CONTEXT_BOUNDS` is 30,000 for the questionnaire and 60,000 for the draft, counted over the characters sent.
  - Over the bound, or over Phase 12's whole budget (or the 64 KB summary bound) with files included, the builder throws `AssessmentContextTooLargeError` with `attachmentDocumentIds` in upload order.
  - Its `safeMessage` reads: "The AI context is too large. The 2 files included in the AI inputs hold more text than can be sent; exclude some and try again."
  - When notes are also marked, the message names the notes and counts the files.
- **The job failure.**
  - Both registries keep `failure.attachmentDocumentIds` (at most 20) from their job failures.
  - The analyst projections (the job read by id, retry, and the request's jobs read) add `failureAttachments: [{ documentId, fileName }]` for a `CONTEXT_TOO_LARGE` failure. Current names are resolved in one query.
  - No run is created, and the provider is never called.
- **The run record (D-35).**
  - The builder writes `ContextSummaryV3` = v2 + `attachments: { included: [{ documentId, sha256, type, part, charactersSent, charactersAvailable, truncated }], bound }`.
  - `parseContextSummary` accepts v1, v2 and v3, closed. v1 and v2 read as having included no files.
  - A malformed attachments section makes the whole summary null. That covers an unknown key, `text`, `fileName`, a bad digest, an image type, an unknown part, sent > available, disagreeing truncation, a duplicate file, the wrong bound, or over the bound.
- **The run read.**
  - `findRun` resolves the summary's file ids in one query. `projectAiRun` then adds each file's `fileName`, `requestId` and `removed`.
  - A file is named only from a record on the run's own request.
  - The stored summary never holds a name.
- **The contract.**
  - Spec: `AiRunContextSummary` now has `schemaVersion` 1, 2 or 3 and a required `attachments`. New components: `AiRunContextAttachments`, `AiRunContextAttachment` and `GenerationJobFailureAttachment`. `failureAttachments` is optional on `QuestionnaireGenerationJob` and `AssessmentDraftJobFailed`.
  - The client is regenerated, and `api:check` exits 0.
  - The web parsers parse both shapes closed. The parity registrations narrow the file digest's pattern and the flat questionnaire job's `failureAttachments`, as their siblings already are.

## Task Commits

1. **Task 1 (tracer):** `9896355` test (RED), `457d858` feat (GREEN)
2. **Task 2:** `a20e954` test (RED), `a436e03` feat (GREEN)
3. **Task 3:** `0977e10` test (RED), `9201f70` feat (GREEN)
4. **Fix:** `7003c37` (the mounted context test's version pin)

`git rev-list --count bd9b1107..HEAD` is 7 before this summary's commit.

## Verification

- **RED evidence** (TAP reporter; `check tdd-red-evidence` returned `RED_EVIDENCE_OK` for each target):
  - **Task 1:** `# tests 45 / # pass 39 / # fail 6`. The four unit tests failed on the missing blocks, summary section and `promptDataBlock`. The two mounted tests failed on the missing pack text and the missing run section.
  - **Task 2:** `# tests 60 / # pass 57 / # fail 3`. The two bound unit tests and the mounted too-large job failed. The two guardrail tests passed at RED; see Issues.
  - **Task 3:** Strapi: `# tests 19 / # pass 18 / # fail 1` (the run read). Web: 2 failed of 59 (the v3 run parse, and the failed job's `failureAttachments`).
- **GREEN, focused:**
  - Task 1:
    - verify (`assessment-context.unit`, `attachment-ai-input.integration`): `ℹ tests 45 / ℹ pass 45 / ℹ fail 0`. The tracer re-run on the commit gave the same.
    - units (`assessment-context`, `ai-provenance`, `ai-inputs-signal`, `questionnaire-generation`, `ai-provider-guardrails`, `ai-provider-questionnaire`, `ai-provider-assessment`): 91/91.
    - `ai-run.integration`: 6/6. `questionnaire-generation.integration`: 26/26.
  - Task 2:
    - verify plus `questionnaire-generation.unit` and `ai-provenance.unit`: 82/82.
    - `questionnaire-generation.integration`: 26/26.
  - Task 3:
    - Strapi (`attachment-ai-input.integration`, `ai-run.integration`, `ai-provenance.unit`, `assessment-context.unit`): 64/64.
    - vitest (`src/features/ai-assistance`, `src/features/assessments`, parity, operation chain): `Tests 860 passed (860)`.
    - web typecheck and lint clean; `api:check` 0 after the commit.
  - Fix (`assessment-context.integration`): 3/3.
- **Full suites:**
  - Strapi, first run (Task 3 uncommitted): `ℹ tests 1232 / ℹ pass 1231 / ℹ fail 1` (1,320 s). The one failure was a pinned summary version; see Deviations.
  - Strapi, on `9201f70`: `ℹ tests 1232 / ℹ pass 1232 / ℹ fail 0` (1,354 s).
  - Web (`pnpm --dir apps/csrm test`): 196 files, `Tests 4454 passed (4454)`.
- **Acceptance criteria:**
  - The loader's attachment query selects no `fileName` (grep empty).
  - `prompt-sections.ts` renders attachment blocks only through `promptDataBlock`.
  - `ATTACHMENT_CONTEXT_BOUNDS` holds 30000 and 60000.
  - The stored `contextSummary` never contains `fileName` (asserted in the mounted run-read test).
  - Every verify command exits 0.
- **EICAR guard:** `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing.
- **Playwright:** not run (the plan runs none). `served-operations.json` is not regenerated (no route or grant changed).

## Decisions Made

See `key-decisions` in the frontmatter (one line each). The prompt helper was added (`promptDataBlock`), not reused: 13-16's executed code has none.

## Deviations from Plan

1. **[Rule 1 - Bug] Version pins at 2 in existing tests.** Five tests asserted the builder's summary version 2, or built a v1 summary by dropping only `notes`. These were `ai-provenance.unit`, `ai-run.integration`, `questionnaire-generation.integration`, `assessment-workflow.integration`, and `assessment-context.integration`, which only the full suite reads. They now expect v3 and drop `attachments` too. The first four went in with `457d858`, the fifth with fix `7003c37`.
2. **[Rule 3 - Blocking] Files outside the plan's list.**
   - The two generation workflows pass the error's ids to their job failures, project `failureAttachments` and resolve names.
   - `ai-assistance-service.ts` and `assessment-service.ts` hold the parity registrations.
   - `test-fixtures.ts` (the shared run fixture) is now v3.
   - `assessment-service.test.ts` and `ai-assistance-service.test.ts` hold the web cases.
   - The five test files in deviation 1.
3. **[Plan shape] `failureAttachments`, not `failure.attachments`.** The job projections and their contract components are flat (`failureCode`, `failureMessage`). The files therefore sit beside them as `failureAttachments`, and 14-16's job cards read that key.
4. **[Plan shape] The job projection landed in Task 2, its contract in Task 3.** The parity guard ties every spec component to its parser, so the spec and the web parser went in together (`9201f70`), as in 14-09.
5. **[Plan shape] Shared helpers in the loader.** `resolveContextAttachments`, `failureAttachmentIds` and `failureAttachmentsEntry` live in `assessment-context-loader.ts` (in the plan's list) and serve the run read and both job projections, so each read resolves names in one query.
6. **[Rule 2 - Security] The run read names a file only from its own request's record.** The read cross-checks the attachment's request against the run's request. A summary can therefore never surface another request's file name, even if a stored id were wrong.

**Total deviations:** 6 (1 Rule 1, 1 Rule 2, 1 Rule 3, 3 plan-shape notes). **Impact:** no change to scope. No content type, schema field or relation changed (the summary is a new envelope version of an existing JSON attribute), and no dependency was added.

## Issues Encountered

- **The Task 2 guardrail tests passed at RED.** Task 1's GREEN already escaped and capped each file, because rendering a block needs both. Task 2's target tests (the bounds and the mounted too-large job) failed as intended.
- **The Task 2 mounted job failed generically at RED, not with `CONTEXT_TOO_LARGE`.** With no bound in the builder, the v3 parser refused a summary over its bound when the run was created. The test failed on its planned assertion (the outcome).
- **`api:generate` staged `schema.d.ts`** in the index. It was unstaged before the fix commit, then committed with Task 3.
- **Shell heredocs mangle escapes on this host** (as in 14-08 and 14-09). Most edits went through the Edit and Write tools or Python scripts written as files.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- **T-14-37 is mitigated.** Each file is its own escaped block inside `<requestorData>`. `promptDataBlock` attributes are closed enums and integers. Guardrail tests cover closing tags, a fake analyst instruction, a script tag and a 100,000-character line.
- **T-14-38 is mitigated.** The loader reads only included, clean, unremoved files. The fake-server proof shows the excluded DOCX's text and both names absent.
- **T-14-39 is mitigated.** The prompt and the stored summary carry no name, person, time or request number. Names are resolved at read time, and only from the run's own request.
- **T-14-40 is mitigated.** The per-run bound and Phase 12's total are checked before any run or provider call.
- No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-11** (the "AI inputs changed" signal) can compare current inclusion with `parseContextSummary(...).attachments.included` of the target's latest run. v1 and v2 runs read as having included none.
- **14-16** (the UI) can render the run sheet's Files group from `contextSummary.attachments.included`. Each entry has `fileName` (null when gone), `removed`, `charactersSent`, `charactersAvailable` and `truncated`. The files variant of the job card reads `failureCode === "CONTEXT_TOO_LARGE"` with a non-empty `failureAttachments`.
- **Phases 15 to 17** get attachment blocks for free through `buildAssessmentContextFor`.

## Self-Check: PASSED

- FOUND: every file in `key-files`.
- FOUND: `9896355`, `457d858`, `a20e954`, `a436e03`, `0977e10`, `7003c37`, `9201f70`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
