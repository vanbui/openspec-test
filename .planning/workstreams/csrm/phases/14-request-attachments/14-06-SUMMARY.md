---
phase: 14-request-attachments
plan: 06
subsystem: api
tags: [strapi, content-type, multipart, attachments, malware-scanning, quarantine, request-lock, openapi, openapi-fetch, zod]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: "withRequestLock, PERSON_FIELDS and projectPerson, acceptsNotes, canUseRequestNotes, authorPartFor, the notes operations and the csrm-request-note API folder pattern"
  - phase: 14-request-attachments
    provides: "14-03 screenAttachment, attachmentConfigOf, selectMalwareScanner, ATTACHMENT_LIMITS, logSecurityEvent and the fake clamd; 14-04 createAttachmentStorage, the multipart cleanup middleware and the harness's attachment options; 14-05 every refusal reason and the 422 detection"
provides:
  - "Content type api::csrm-request-attachment.csrm-request-attachment (csrm_request_attachments) exactly as the approved record states it, with no core router and no inverse attribute"
  - "GET and POST /api/v1/assessment_requests/{requestId}/attachments (CSRM_REQUEST_ATTACHMENT_OPERATIONS.list and .upload), readers decided by canUseRequestNotes with 404 for everyone else"
  - "attachment-rules.ts: attachmentWindow, acceptsAttachments, addRefusalFor, noteAcceptsAttachments, attachmentStateOf, isActiveAttachment, canRemoveAttachment, canRestoreAttachment, readersRequestFacts, readersCallerFacts"
  - "attachment-event-log.ts: the schema-1 append-only event log (parseAttachmentEventLog, appendAttachmentEvent, AttachmentEventLogError at 200 events)"
  - "attachment-projection.ts: projectAttachment, projectAddFacts, ATTACHMENT_READ"
  - "request-attachments.ts: listRequestAttachments, uploadRequestAttachment, recordAttachmentRefusal, RequestAttachmentsError, loadAttachmentsRequest"
  - "function.risk_assessment_requests.attachments_api (.api.01 list, .api.02 upload) granted both ways to role.requestor and role.security_analyst in both catalogue copies; design note 6 amended"
  - "Spec paths, components RequestAttachmentType, RequestAttachmentState, RequestAttachmentPart, RequestAttachmentActions, RequestAttachment, RequestAttachmentAddFacts, RequestAttachmentListMeta, RequestAttachmentListResponse, RequestAttachmentResponse, RequestAttachmentUploadRequest; the regenerated client and served inventory"
  - "Web features/attachments/attachments-schema.ts and attachments-service.ts (listRequestAttachments, uploadRequestAttachment, responseParserModule)"
  - "Harness helpers listRequestAttachments, countRequestAttachmentRows, listAttachmentStorageFiles, seedRequestAttachments"
affects: [14-07, 14-08, 14-09, 14-10, 14-11, 14-12, 14-13, 14-14, 14-15, 14-16, 14-17, 17, 20]
actuals:
  tokens: 42960
  tasks: 3
  commits: 6
plan_head_before: 13ef825d469a8bf37f31ecec58d8fec9e4dc3699
plan_head_after: 091323b7da64ffab3e10aed7bb3f7b649cac943d
tech-stack:
  added: []
  patterns:
    - "Upload pipeline: grant, readers (404), parts (400), add refusal and note pre-check (409), declared size (413/400), read, screen (415/422/400/413), store, then withRequestLock re-reads the request, the window, the note and the counts and inserts; a refusal under the lock deletes the stored bytes"
    - "Counts inside the request lock through strapi.db.query only (no raw knex)"
    - "The readers predicate is called with readersRequestFacts and readersCallerFacts, so no participant fact can reach canUseRequestNotes"
    - "A new content type's mounted test proves its column names with PRAGMA, and a helper reads the record's server-only facts (digest, scan attempts, event log) that no response serves"
key-files:
  created:
    - apps/backend/src/api/csrm-request-attachment/content-types/csrm-request-attachment/schema.json
    - apps/backend/src/api/csrm-request-attachment/operations.ts
    - apps/backend/src/api/csrm-request-attachment/routes/request-attachments.ts
    - apps/backend/src/api/csrm-request-attachment/controllers/request-attachments.ts
    - apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts
    - apps/backend/src/api/csrm-request-attachment/services/attachment-rules.ts
    - apps/backend/src/api/csrm-request-attachment/services/attachment-event-log.ts
    - apps/backend/src/api/csrm-request-attachment/services/attachment-projection.ts
    - apps/backend/tests/attachment-rules.unit.test.ts
    - apps/backend/tests/request-attachments.integration.test.ts
    - apps/backend/tests/request-attachments-scanning.integration.test.ts
    - apps/csrm/src/features/attachments/attachments-schema.ts
    - apps/csrm/src/features/attachments/attachments-service.ts
    - apps/csrm/src/features/attachments/attachments-service.test.ts
  modified:
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
key-decisions:
  - "The sha256 attribute is stored in the column sha_256: Strapi names columns with lodash snakeCase, which splits a letter from a digit. The attribute name is the approved one; only the record's expected column name differs, and the mounted PRAGMA test pins the real one."
  - "scanAttempts counts scans that could not decide: 0 for a clean upload, 1 for a pending one, so 14-07's re-scans add to it until the 24 bound."
  - "A file is pending for any scanStatus other than clean or blocked, so an unknown status is never available; an unknown request status closes the window."
  - "The 422 body carries details.detection only when it fits the contract's pattern; the security event line keeps the engine's detection through the event log's own closed pattern."
  - "Every refusal after admission is one attachment.refused line, a refused part included; a 404 at the readers rule is not logged, as the notes operations log none."
  - "canRemoveAttachment and canRestoreAttachment are written to 14-08's full rule now, because the projection's actions read them; 14-08 proves them in its own unit tests."
patterns-established:
  - "API folder for a recorded request-scoped entity: schema, operations.ts, a standalone router, one controller, rules, event log, projection and service modules"
  - "Separate mounted test file per scanner configuration (request-attachments-scanning.integration.test.ts), as 14-04 did for S3, because one process runs one Strapi"
requirements-completed: []  # COLLAB-02 is traced here but completes at the 14-17 gate
coverage:
  - id: D1
    description: "The approved content type with its columns and four link tables, no core route and no inverse attribute; legacy requests list no files"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#a fresh database holds the approved attachment columns and the four link tables, and no other type gains one (D-01)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#request attachments are served by their two operations alone, with no core route (D-01, D-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Jane adds a file to her draft and lists it: 201 with name, type, size, uploader (documentId and displayName), part, time, note link, state and actions; stored byte for byte with its digest; one uploaded event without the name"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#Jane adds the data-flow DOCX to her draft and it is stored byte for byte, clean, with one uploaded event and no name in the log (D-05, D-13, D-16, D-37)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#Jane lists her draft's file with the add facts, Bob sees it without the add, and a legacy request lists none (D-16, D-28)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Another Requestor, the service agent and anyone naming a missing request get 404 at the list and the upload with persistence unchanged; the matrix rows prove each actor"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#another Requestor, the service agent and anyone naming a missing request get 404 at the list and the upload with nothing written (D-18)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts (GET and POST attachments rows)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The window, the note link and its 60 minutes, who adds, the 400 part cases and the race at 19 active files"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-rules.unit.test.ts"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts (the five Task 2 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Refused files name their reason (400, 413, 415, 422 with the detection), leave nothing behind and are each one refusal event; unscanned files wait in quarantine"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#disallowed, oversize, empty and infected files are refused with their reason and status, leave nothing, and each is one refusal event (D-09 to D-14, D-37)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-attachments-scanning.integration.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "The grant both ways, the contract, the generated client, the served inventory and the web's typed service in the parity guard"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 14 request attachments are held by one Function granted to the Security Analyst and the Requestor alone and published closed"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/attachments/attachments-service.test.ts; apps/csrm/src/features/contract-response-parity.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/backend test (1160/1160); pnpm --dir apps/csrm test (4415/4415)"
        status: pass
    human_judgment: false
duration: 72min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 06: Request Attachment List and Upload Summary

**Requests can now hold files. `CsrmRequestAttachment` exists exactly as approved, and `GET` and `POST /api/v1/assessment_requests/{requestId}/attachments` let Jane add files to her draft and, after submission, Jane and Bob add files with their own fresh notes. Readers are the notes readers; everyone else gets 404. Each upload is screened, scanned and stored privately, the window, the note and the 20/60 limits are re-checked under the request lock, refused files name their reason and leave nothing, and a file the scanner cannot check waits in quarantine.**

PHASE_14_BASE=e50053f

## Performance

- **Duration:** about 72 min (2026-10-09T19:49:42Z to 21:01:26Z), including one 18.9-minute full Strapi suite
- **Completed:** 2026-10-10 (+11:00)
- **Tasks:** 3 of 3, each test first (RED commit, then GREEN commit). Task 1 is the tracer. Its verify ran end to end after GREEN and passed, so expansion went ahead.
- **Files:** 24 (2,923 lines added, 7 removed)

## Precondition

The record's status line is `Status: **approved by the pilot on 2026-10-10** (G-6)`. I read it case-insensitively and ignoring the bold, against `Approved by the pilot on [0-9]{4}-[0-9]{2}-[0-9]{2}`, so the precondition is met. I did not edit the record.

## Accomplishments

- **Schema** (`csrm_request_attachments`, `draftAndPublish: false`):
  - the record's sixteen attributes, its three enumerations and the private single media `file`;
  - four `manyToOne` relations with no `inversedBy`;
  - `aiText` private;
  - the record's bounds (`fileName` 1 to 255, `byteSize` 1 to 26,214,400, `sha256` 64, `scanEngine` 255, `scanDetection` 128).
  - Nothing else changed: `git diff --name-only e50053f -- 'apps/backend/src/api/*/content-types/*'` lists only this schema.
- **PRAGMA.** `csrm_request_attachments` has these columns: `file_name`, `file_type`, `byte_size`, `sha_256`, `uploader_part`, `uploaded_at`, `scan_status`, `scan_checked_at`, `scan_engine`, `scan_detection`, `scan_attempts`, `removed_at`, `ai_text_included`, `ai_text`, `ai_text_facts` and `event_log`. Note `sha_256`, not `sha256` (decision 1).

  | Link table | Columns |
  |---|---|
  | `csrm_request_attachments_assessment_request_lnk` | `csrm_request_attachment_id`, `csrm_assessment_request_id` |
  | `csrm_request_attachments_note_lnk` | `csrm_request_attachment_id`, `csrm_request_note_id` |
  | `csrm_request_attachments_uploaded_by_lnk` | `csrm_request_attachment_id`, `idambox_user_id` |
  | `csrm_request_attachments_removed_by_lnk` | `csrm_request_attachment_id`, `idambox_user_id` |

  `csrm_assessment_requests`, `csrm_request_notes` and `idambox_users` gain no attachment column.
- **Routes.** One standalone router with token-only auth and only the `global::csrm-app-enabled` and `global::csrm-authorization` policies. There is no core router, and `/api/csrm-request-attachments` answers 404.
- **Controller.** Every handler loads the request and calls `canUseRequestNotes(readersRequestFacts(request), readersCallerFacts(caller))`. A missing request and a refused caller get the same 404, `CSRM request attachments were not found.`. The upload takes exactly one `file` part and an optional `noteId` of 1 to 255 characters, given once. Anything else is 400 and is logged.
- **Upload service**, in this order:
  1. `addRefusalFor` (409);
  2. the note rule (409 `ATTACHMENT_NOTE_REQUIRED` or `ATTACHMENT_NOTE_INVALID`);
  3. the declared size (413 or 400, before a byte is read);
  4. `screenAttachment` (415 for the content refusals, 422 for malware with `details.detection`);
  5. `createAttachmentStorage(strapi).put`;
  6. `withRequestLock`, which re-reads the request (404), the window and the counts (`strapi.db.query` only), and the note, then creates the record.

  A refusal under the lock removes the stored bytes and the plugin file record.
- **Stored facts.** A clean file gets `scanStatus` `clean`, `scanCheckedAt`, the engine and `scanAttempts: 0`. A file the scan could not check gets `pending`, `scanAttempts: 1` and no `scanCheckedAt`. The `eventLog` is `uploaded`, plus `quarantined` for a pending file.
- **Security events.** A successful upload logs `attachment.uploaded`; a pending one also logs `attachment.quarantined`, with the cause as its outcome. Every refusal logs `attachment.refused` with its reason, and malware logs at warning level with the detection. No line holds a file's name.
- **List.** At most 60 files, newest first (`uploadedAt` then `id`). `meta: { total, removed, add }`. `add` is `projectAddFacts`: `canAdd`, `refusal`, `window`, `needsNote`, `remaining`, `activeCount`, `storedCount`, `limits` and `allowedTypes`.
- **Projection.** It serves no digest, no plugin file record, no storage key or URL, and no `aiText`. The media relation is read as its id only, to tell an `unavailable` file from an `available` one.
- **Catalogue.** `function.risk_assessment_requests.attachments_api` is granted in both copies, in its `roleIds` and in the `functionIds` of `role.security_analyst` and `role.requestor`. `role.security_analyst_agent` does not get it. Design note 6 records the attachment and the record's path. `cmp` is silent.
- **Contract.**
  - Both operations are in the spec, the upload as `multipart/form-data` `RequestAttachmentUploadRequest`.
  - Responses: the upload 201, 400, 403, 404, 409, 413, 415 and 422; the list 200, 403 and 404.
  - `api:generate` and `api:check` are clean.
  - `served-operations.json` gains the two rows, each with web caller `src/features/attachments/attachments-service.ts`.
- **Web.** Closed zod parsers mirror the components. The service starts with `import 'server-only'`. The list goes through the generated path. The upload sends a `FormData` with `file` and, after submission, `noteId`, through `bodySerializer` (the administration pattern). `responseParserModule` is registered in the parity guard.

## Matrix

There are 126 matrix rows, two of them new:

| Operation | owner | other | analyst | serviceAgent | noIdentity | noToken |
|---|---|---|---|---|---|---|
| `GET …/attachments` | 200 | 404 | 200 | 404 | 403 | 401 |
| `POST …/attachments` on Jane's own draft (`MATRIX-ATTACHMENTS`) | 201 | 404 | 409 | 404 | 403 | 401 |

- The owner's 201 is proven by the mounted upload test (`provenBy`).
- Every refused POST is checked for unchanged persistence: the attachment rows, the plugin file records and the stored files.

## Task Commits

1. **Task 1 (tracer):** `75b9dd27` test (RED), `cd4015d4` feat (GREEN)
2. **Task 2:** `d457db36` test (RED), `76ed9332` feat (GREEN)
3. **Task 3:** `5694568a` test (RED), `091323b7` feat (GREEN)

`git rev-list --count 13ef825d..HEAD` is 6 before this summary's commit.

## Verification

- **RED evidence** (TAP reporter; no stub was committed):
  - **Task 1:**
    - `request-attachments`: `# tests 5 / # pass 0 / # fail 5`. I ran it with the new API folder held aside and its stale `dist` output removed (see Issues).
    - The matrix failed on the two unserved rows and the completeness test.
    - The catalogue test failed on the missing Function.
    - Web: the service module was missing.
  - **Task 2:** `# tests 15 / # pass 11 / # fail 4`. The four failures were the note-rule unit test (against a throwing stub), the two note flows and the 400 part cases.
  - **Task 3:** `# tests 17 / # pass 12 / # fail 5`. The refusal statuses and events failed, as did the pending, limits and infected scanner cases.
- **GREEN, focused:**
  - Task 1 verify: vitest 3 files 210/210 (with the service test, 207/207); `api:check` and the web typecheck clean; `cmp` silent; node 5 files `ℹ tests 176 / ℹ pass 176 / ℹ fail 0`.
  - Task 2 verify: `ℹ tests 15 / ℹ pass 15 / ℹ fail 0`.
  - Task 3, both mounted files and the unit file: `ℹ tests 22 / ℹ pass 22 / ℹ fail 0`.
- **Full Strapi suite** (`pnpm --dir apps/backend test`, dev servers stopped): `ℹ tests 1160 / ℹ pass 1160 / ℹ fail 0` (1,132 s), on the code in `091323b7`.
- **Full web suite** (`pnpm --dir apps/csrm test`): 195 files, `Tests 4415 passed (4415)`.
- **EICAR guard:** `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing. The suites use `CSRM-TEST-MALWARE-SIGNATURE-7c1e4a`.
- **Temporary files:** after each refusal, the system temporary directory holds no file of the refused size that was modified after the case began. The empty file is not checked, because a zero-byte file cannot be told from another process's.
- **Acceptance criteria:**
  - `routes/` holds only `request-attachments.ts`, and the folder has no `createCoreRouter`.
  - The schema has no `inversedBy`.
  - The request, note and user schemas are unchanged since `e50053f`.
  - The service starts with `import 'server-only'`.
  - The projection module does not contain `sha256`, `hash`, `url` or `aiText`.
  - The catalogue grants hold in both copies.
  - Both 409s and the race test are present, and the counts under the lock use `strapi.db.query` only.
  - 400, 413, 415 and 422 each have a mounted test asserting `error.details.reason`, and the 422 test asserts the detection and the warning level.
- **Generated types:** no Strapi boot in these runs rewrote `apps/backend/types/generated/*.d.ts`, because the harness does not regenerate them. The orchestrator's `chore(backend)` commit (G-1) for this schema still waits for the next development Strapi start.

## Decisions Made

See `key-decisions` in the frontmatter.

- **2026-10-11, stage B (WR-103): overruled by the pilot.** The key decision "a 404 at the readers rule is not logged" no longer holds (`14-PILOT-RULINGS.md`, WR-103, and "The worker's decisions during stage A"). Every refusal after the policy is now one `attachment.refused` line, the readers-rule 404 included, on every attachment operation: it logs the closed log reason `NOT_FOUND` (a log value, not an API reason) and only the requested identifiers that pass the log's identifier rule, and the response stays a 404 that names no reason. The upload's lock path follows the same rule, and a refusal under the lock now carries the screened type, size and digest (IN-102). The key decision above is kept as written.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] The `sha256` column is `sha_256`.**
   - **Found during:** Task 1 GREEN. The PRAGMA test failed on `sha256`.
   - **Issue:** Strapi derives column names with lodash `snakeCase`, so the approved attribute `sha256` becomes the column `sha_256`. The record's Migration section lists `sha256` as an expected column, and it asks for the real names to be confirmed with PRAGMA.
   - **Fix:** The test now asserts `sha_256` and asserts that no `sha256` column exists. The attribute name is unchanged, and the record was not edited.
   - **Commit:** `cd4015d4`
2. **[Rule 1 - Bug] Two of my RED tests were wrong.**
   - The catalogue test read `content` on the upload's `$ref` responses (400, 403, 404, 409). It now checks each `$ref`, and checks the schema only on the inline 413, 415 and 422.
   - The web service test called `File.arrayBuffer`, which jsdom lacks. It now uses the `FileReader` fallback from the administration test.
   - **Commit:** `cd4015d4`
3. **[Rule 3 - Blocking] Files outside the plan's list.**
   - `tests/helpers/strapi-http-harness.ts` gained `listRequestAttachments`, `countRequestAttachmentRows`, `listAttachmentStorageFiles` and `seedRequestAttachments`, and the attachment UID joined `CsrmFixtureUid`.
   - `tests/authorization-matrix.integration.test.ts` seeds the matrix's own attachments draft.
   - `apps/csrm/src/features/attachments/attachments-service.test.ts` holds the service's call tests, so the parity guard does not have to mock the transport for every other module. The parity guard keeps the registration and the multipart contract checks.
   - `tests/request-attachments-scanning.integration.test.ts` holds the fake-clamd cases. One process runs one Strapi, which is the 14-04 S3 precedent.
   - **Commits:** `75b9dd27`, `5694568a`
4. **[Rule 2 - Security] A refused part is a security event.** The plan logs every service refusal. The controller's 400 for an extra or repeated part is also logged once the caller is admitted, through `recordAttachmentRefusal`, so that D-37's "every refusal" holds. (`091323b7`)
5. **[Rule 2 - Correctness] Fail-closed state and window.**
   - An unknown `scanStatus` is `pending`, never available.
   - An unknown request status closes the window.
   - A note with no readable time, no author or a future time is `ATTACHMENT_NOTE_INVALID`.
   - (`cd4015d4`, `76ed9332`)
6. **[Verify format]** node:test prints `ℹ tests N`, `ℹ pass N` and `ℹ fail N`. I read the counts from those lines, and used the TAP reporter for the RED runs.

**Total deviations:** 5 auto-fixed (2 Rule 1, 1 Rule 3, 2 Rule 2) and 1 format note. **Impact:** none on scope. No content type, schema field or relation beyond the approved one changed, and no dependency was added.

## Issues Encountered

- **The first Task 1 RED run was contaminated.** I wrote the new source while that run was booting Strapi. `compileStrapi` compiled a router whose controller did not exist yet, and it left the stale `dist/src/api/csrm-request-attachment` output behind, which also broke the next boot. The hung test processes were stopped. The clean RED evidence above comes from a re-run with the folder held aside and its `dist` output removed. After that, I made no source edit while a harness was booting.
- **The race test passed at Task 2 RED.** Task 1's lock re-check and late-refusal cleanup already gave the serialised outcome. On SQLite it proves that outcome, not the lock. The lock is `request-lock.unit.test.ts`'s proof, and the PostgreSQL row lock is R-08-37's.
- **This shell drops backslashes in heredocs.** I applied the edits that needed backslashes with the Write and Edit tools.
- **A unit-only proof**, as the orchestrator accepted on 2026-10-01: `ATTACHMENTS_NOT_CONFIGURED` is proven only by `addRefusalFor`'s order in `attachment-rules.unit.test.ts` and by 14-03's `attachment-config.unit.test.ts`.

## Known Stubs

None. `canRemoveAttachment` and `canRestoreAttachment` already implement 14-08's rule, and they feed the projection's `actions`.

## Threat Flags

None beyond the plan's register:
- T-14-19 is mitigated by the readers rule's 404, the matrix rows and the absence of a core router.
- T-14-20 is mitigated by the note rule, re-checked under the lock.
- T-14-21 is mitigated by the size, the limits under the lock and the race test.
  - **2026-10-11, stage B (WR-301):** the race test proves the serialised outcome only and is renamed for it. T-14-21's lock is proven by the two hold tests in `request-attachments.integration.test.ts` (the in-process half, for an upload against an upload and a restore against an upload at 19) and by R-08-37 (the PostgreSQL row lock). The line above is kept as written.
- T-14-22 is mitigated by screening before storage and by quarantine: a `pending` file has `actions.download: false`.
- T-14-23 is mitigated by the projection's allow-list.
- No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-07 (download and re-scan)** can build on:
  - `attachmentStateOf` and `ATTACHMENT_READ`;
  - `appendAttachmentEvent`, and `RequestAttachmentsError` (which already maps 409);
  - pending records, with `scanAttempts: 1` and the `quarantined` event.
- **14-08 (removal and restore)** finds both actor rules written, the projection's `remove` and `restore` actions wired, and `projectAddFacts` ready for the request read's summary.
- **14-09 (AI inclusion)** adds `ai` to the projection and `aiPolicy` to the list's meta.
- **Generated types (G-1):** `apps/backend/types/generated/contentTypes.d.ts` still lacks the new type. The orchestrator's `chore(backend)` commit follows the next development Strapi start.

## Self-Check: PASSED

- FOUND: the eight files under `apps/backend/src/api/csrm-request-attachment/`, the three new Strapi test files, and the web schema, service and service test.
- FOUND: `75b9dd27`, `cd4015d4`, `d457db36`, `76ed9332`, `5694568a`, `091323b7`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
