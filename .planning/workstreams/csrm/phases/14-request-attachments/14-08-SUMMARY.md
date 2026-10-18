---
phase: 14-request-attachments
plan: 08
subsystem: api
tags: [strapi, attachments, soft-delete, removal, restore, audit-log, request-lock, openapi, openapi-fetch, zod]
requires:
  - phase: 14-request-attachments
    provides: "14-06 the content type, attachment-rules.ts (canRemoveAttachment and canRestoreAttachment, already written to this plan's rule), projectAttachment, projectAddFacts, appendAttachmentEvent and the web attachments service; 14-07 the download's ATTACHMENT_REMOVED refusal; 14-03 logSecurityEvent"
  - phase: 13-request-pick-up-and-notes
    provides: "canUseRequestNotes (the readers), withRequestLock, the request read's notes summary and the REQUEST_HAS_NOTES delete refusal"
provides:
  - "PUT /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal (CSRM_REQUEST_ATTACHMENT_OPERATIONS.setRemoval, handler setRemoval, function.risk_assessment_requests.attachments_api.api.04)"
  - "request-attachments.ts: setRequestAttachmentRemoval, requestAttachmentSummary, countStoredRequestAttachments, RequestAttachmentSummary"
  - "The request read's optional attachments summary (RequestAttachmentSummary), for readers only, and the core delete's 409 REQUEST_HAS_ATTACHMENTS"
  - "Spec: the removal path, RequestAttachmentRemovalRequest and RequestAttachmentSummary; the regenerated client; both catalogue copies; the served inventory"
  - "Web: setRequestAttachmentRemoval (attachments-service.ts); requestAttachmentSummarySchema and the removal schemas (attachments-schema.ts); request-schema.ts's attachments parser; request-domain.ts's RequestAttachmentSummary"
affects: [14-09, 14-10, 14-11, 14-12, 14-13, 14-14, 14-17, 17, 20, 22]
actuals:
  tokens: 22400
  tasks: 3
  commits: 6
plan_head_before: e0d67fa42502afc235203191eb2555cb65e70423
plan_head_after: be19cf61190366e80df498980fd09fc5cd5cfb76
tech-stack:
  added: []
  patterns:
    - "Soft removal under withRequestLock: re-read the request (readers, else 404) and the file on the path's request (else 404); answer a file already as asked unchanged; apply the actor rule (403 for who the caller is, 409 for the state); append the events (HISTORY_UNAVAILABLE when the log is full or unreadable); write the current facts. The stored bytes are never touched."
    - "A refused change to a file the caller can see is one attachment.refused line with its reason; a 404 is not logged"
    - "A reader-only block on an existing read: the controller guards it with canUseRequestNotes and spreads it, so a non-reader's read is unchanged"
key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-request-attachment/operations.ts
    - apps/backend/src/api/csrm-request-attachment/routes/request-attachments.ts
    - apps/backend/src/api/csrm-request-attachment/controllers/request-attachments.ts
    - apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts
    - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - docs/references/specification.json
    - docs/references/served-operations.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/attachment-rules.unit.test.ts
    - apps/backend/tests/request-attachments.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/csrm/src/features/attachments/attachments-schema.ts
    - apps/csrm/src/features/attachments/attachments-service.ts
    - apps/csrm/src/features/attachments/attachments-service.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/features/requests/request-schema.ts
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-service.test.ts
key-decisions:
  - "The list's meta.total now counts the main list (files not removed), as the plan's Task 1 and the UI-SPEC's hub figure ask; 14-06 served every stored file. The spec's description changed with it, and meta.removed and add.storedCount carry the rest."
  - "The removal is idempotent: removing a removed file, or restoring one that is not removed, answers the file as it is and writes and logs nothing. This check runs before any actor rule."
  - "NOT_UPLOADER and NOT_REMOVER are 403, because they are about who the caller is (as Phase 13's OWN_REQUEST); every state refusal is 409."
  - "Every removal clears aiTextIncluded, aiText and aiTextFacts (the record's Removal section deletes the facts too). The ai-excluded event and the attachment.ai_inclusion_changed line (from true, to false, outcome excluded) are written only when the file was included."
  - "Every refused removal or restore of a file the caller can see, and every refused body, is one attachment.refused line with its reason (D-37's 'every refusal', as 14-06 logs every upload refusal). A 404 is not logged, and a refused body's line names the request only."
  - "The request read's attachments key is optional and absent for a non-reader, as the plan states (Phase 13's notes key is always present and nullable). The controller adds it inside a canUseRequestNotes branch, and requestAttachmentSummary checks the readers rule again."
  - "The request delete counts every attachment through the query engine, inside the same withRequestLock as REQUEST_HAS_NOTES and after it, so an upload waiting behind the delete finds the request gone (404)."
patterns-established:
  - "Reader-only figures on a shared read are added by a guarded spread, never as a nullable key a non-reader would see"
requirements-completed: [COLLAB-02]  # traced here; COLLAB-02 stays Pending until the 14-17 phase gate
coverage:
  - id: D1
    description: "Jane removes the data-flow DOCX from her draft and restores it. Removal records who and when, keeps the bytes and the plugin record, takes the file out of the main list (total 0, removed 1) and out of downloads (409 ATTACHMENT_REMOVED), and logs one attachment.removed line. The restore logs one attachment.restored line, and the event log reads uploaded, removed, restored."
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#Jane removes the data-flow DOCX from her draft and restores it, with who and when on the record and its bytes kept (D-19, D-20, D-37)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts (PUT …/removal row: owner 200 proven mounted, other 404, analyst 409, serviceAgent 404, noIdentity 403)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The other Requestor, the service agent, a foreign or unknown file id and a missing request get 404 at the removal, and a malformed body gets 400; nothing is written in either case"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#the other Requestor, the service agent and a file id from another request get 404 at the removal, and a malformed body is 400, each with nothing written (D-18, D-20)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Who may remove and restore: 403 NOT_UPLOADER (with one refusal line), 403 NOT_REMOVER and the G-1 case; 409 ATTACHMENTS_CLOSED on a released or closed request; a blocked file is removed but never restored (409 ATTACHMENT_BLOCKED); 409 ATTACHMENT_LIMIT_REACHED at 20 active; 409 HISTORY_UNAVAILABLE for a full or malformed log; the 61st stored file is 409 ATTACHMENT_LIFETIME_LIMIT_REACHED"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-rules.unit.test.ts (the two 14-08 rule-order tests)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts (the seven 14-08 Task 2 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Removing an included file ends its AI inclusion: the stored text and its facts are deleted, an ai-excluded event and an attachment.ai_inclusion_changed line are written, and a restore never re-includes it"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#removing an included file ends its AI inclusion and deletes its stored text, logged, and restoring never includes it again (D-20, D-37)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The request read carries each reader's closed file summary (count, add facts, window, note, limits, types). The other Requestor's read (403) and the service agent's (403) are unchanged and carry nothing of the files. A request holding any file, a removed one included, cannot be deleted (409 REQUEST_HAS_ATTACHMENTS)."
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts (the two 14-08 Task 3 tests)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-service.test.ts#reads the viewer’s file summary when Strapi serves it, reads none otherwise, and refuses a summary the contract does not declare"
        status: pass
    human_judgment: false
  - id: D6
    description: "The contract chain: the spec, the regenerated client (api:check clean), both catalogue copies (cmp silent), the served inventory, the web's typed removal and the parity guard"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 14 request attachments are held by one Function granted to the Security Analyst and the Requestor alone and published closed"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts; apps/csrm/src/features/contract-operation-chain.test.ts; apps/csrm/src/features/attachments/attachments-service.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/backend test (1198/1198); pnpm --dir apps/csrm test (4440/4440); api:check; cmp"
        status: pass
    human_judgment: false
duration: 49min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 08: Attachment Removal, Restore and the Request's File Summary

**Files can now be removed and restored softly, on the record. `PUT …/attachments/{attachmentId}/removal` records who removed a file and when, keeps its bytes, takes it out of the main list and out of downloads, and ends its AI inclusion; only the remover can restore it. The rules are enforced under the request lock: uploader, Security Analyst after submission, remover, G-1, closed, blocked, the active limit and a full history. The request read now tells each reader how many files the request holds and whether they may add one, and a request that holds any file cannot be deleted.**

PHASE_14_BASE=e50053f. COLLAB-02 is traced here but stays Pending until 14-17's phase gate (`requirements-completed` copies the plan's array, as the template asks). REQUIREMENTS.md is unchanged.

## Performance

- **Duration:** 49 min (2026-10-10T00:06:44Z to 00:56:43Z), including one 20.5-minute full Strapi suite
- **Tasks:** 3 of 3, each test first (a RED commit, then a GREEN commit). Task 1 is the tracer. Its verify passed end to end on the committed code (with api:check clean after the commit), so expansion went ahead with no checkpoint.
- **Files:** 21 (1,174 lines added, 30 removed)

## Accomplishments

- **The removal operation.** It is `PUT /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal`, with handler `setRemoval`, held by `function.risk_assessment_requests.attachments_api.api.04` ("Set Assessment Request Attachment Removal").
  - The controller admits readers with `canUseRequestNotes`; everyone else gets 404.
  - The body must be exactly `{ data: { removed: boolean } }`; anything else is a 400.
- **`setRequestAttachmentRemoval`** runs under `withRequestLock`:
  1. It re-reads the request (404) and the file, filtered by the path's request (404).
  2. A file that is already as asked is answered as it is, and nothing is written.
  3. The actor rule is applied: `NOT_UPLOADER` and `NOT_REMOVER` are 403; `ATTACHMENTS_CLOSED`, `REQUEST_NOT_SUBMITTED`, `ATTACHMENT_BLOCKED` and `ATTACHMENT_LIMIT_REACHED` are 409.
  4. It appends `removed` or `restored`, preceded by `ai-excluded` when the file was included. A full or malformed log is 409 `HISTORY_UNAVAILABLE` and nothing is written.
  5. A removal sets `removedAt` and `removedBy` and clears `aiTextIncluded`, `aiText` and `aiTextFacts`; a restore clears `removedAt` and `removedBy`.
  - The storage port is never called, so bytes and plugin file records stay. Retention stays with `ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE` (D-22).
- **Events.** A removal logs one `attachment.removed` line, and a restore one `attachment.restored` line. A removal that ends inclusion first logs `attachment.ai_inclusion_changed` (`from: true`, `to: false`). Every refusal but a 404 logs one `attachment.refused` line with its reason. No line carries the file's name or text.
- **The list.** `meta.total` now counts the files that are not removed (the main list).
- **The request read.** `findOne` adds `attachments: { count, ...projectAddFacts }` inside a `canUseRequestNotes` branch. `count` is the number of files not removed. Anyone else's read has no `attachments` key.
- **The request delete.** After `REQUEST_HAS_NOTES`, under the same lock, any attachment (removed and blocked ones included) makes the delete a 409 `REQUEST_HAS_ATTACHMENTS`, and nothing is deleted.
- **The contract.**
  - The spec has the removal path (200 `RequestAttachmentResponse`; 400, 403, 404 and 409), the closed `RequestAttachmentRemovalRequest`, and the closed `RequestAttachmentSummary` as an optional read field.
  - The delete's 409 description names both reasons.
  - `api:generate` and `api:check` are clean. The catalogue copies are equal (`cmp` silent).
  - `served-operations.json` gains the row, with web caller `src/features/attachments/attachments-service.ts`.
- **The web.**
  - `setRequestAttachmentRemoval(requestId, attachmentId, removed)` calls the generated `PUT` and parses the closed `RequestAttachmentResponse`. It is registered in the parity guard.
  - `request-schema.ts` parses the optional closed summary, and `request-domain.ts` types it as `RequestAttachmentSummary`.

## Matrix

There are 128 matrix rows, one of them new: `PUT …/attachments/{attachmentId}/removal`.

| owner | other | analyst | serviceAgent | noIdentity | noToken |
|---|---|---|---|---|---|
| 200 | 404 | 409 | 404 | 403 | 401 |

- The owner's 200 is proven by the mounted removal test (`provenBy`), so the download row keeps its seeded file.
- The analyst's 409 is `REQUEST_NOT_SUBMITTED` on Jane's draft.
- Every refused call is checked for unchanged persistence.

## Task Commits

1. **Task 1 (tracer):** `8ad0d049` test (RED), `13500a84` feat (GREEN)
2. **Task 2:** `968dbc0a` test (RED), `6bee99af` feat (GREEN)
3. **Task 3:** `11662a91` test (RED), `be19cf61` feat (GREEN)

`git rev-list --count e0d67fa4..HEAD` is 6 before this summary's commit.

## Verification

- **RED evidence** (TAP reporter):
  - **Task 1:**
    - Strapi, 5 files: `# tests 197 / # pass 190 / # fail 7`. The failures were matrix completeness, provenance and the row; the catalogue's missing `.api.04`; the inventory test; and both mounted removal tests (405 Method Not Allowed).
    - Web: 5 failures (the missing `setRequestAttachmentRemoval`, and the missing registration and spec path).
  - **Task 2:** `# tests 38 / # pass 35 / # fail 3`. The refusal line, `HISTORY_UNAVAILABLE` (500 at RED) and the inclusion ending failed as intended. The rest passed at RED; see Issues.
  - **Task 3:** Strapi `# tests 33 / # pass 31 / # fail 2` (no summary, and the delete went through). Web: 2 failures (the parse test and the spec check).
- **GREEN, focused:**
  - Task 1 verify:
    - `cmp` silent;
    - vitest (parity, chain and `src/features/attachments`): `Tests 198 passed (198)`;
    - web typecheck clean;
    - node, 5 files (`request-attachments`, `served-operations`, matrix provenance, matrix, `contract-catalogue`): `ℹ tests 197 / ℹ pass 197 / ℹ fail 0`;
    - `api:check` exit 0 after the commit.
  - Task 2 verify (`attachment-rules.unit`, `request-attachments.integration`): `ℹ tests 38 / ℹ pass 38 / ℹ fail 0`.
  - Task 3:
    - vitest (`src/features/requests`, parity, `src/features/attachments`): `Tests 305 passed (305)`;
    - `request-attachments.integration`: `ℹ tests 33 / ℹ pass 33 / ℹ fail 0`;
    - with `request-notes.integration` added: 52 tests, 1 fail before the test fix below;
    - web typecheck and lint clean; `api:check` exit 0 after the commit.
- **Full suites:**
  - Strapi (`pnpm --dir apps/backend test`, dev servers stopped): `ℹ tests 1198 / ℹ pass 1198 / ℹ fail 0` (1,231 s), on the code in `be19cf61`.
  - Web (`pnpm --dir apps/csrm test`): 196 files, `Tests 4440 passed (4440)`.
- **Acceptance criteria:**
  - `setRequestAttachmentRemoval` has no `createAttachmentStorage` or `.remove(` call.
  - The integration file has a test for `NOT_UPLOADER`, `NOT_REMOVER`, G-1, `ATTACHMENTS_CLOSED`, the blocked restore, the restore limit, `HISTORY_UNAVAILABLE`, inclusion ending and `ATTACHMENT_LIFETIME_LIMIT_REACHED`.
  - `attachments` is added only inside the `canUseRequestNotes` branch.
  - The delete test uses a removed file.
- **EICAR guard:** `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing.
- **Playwright:** not run (the plan runs none).

## Decisions Made

See `key-decisions` in the frontmatter. Also:
- **A non-reader with a read.** No mounted caller today reads a request without reading its files. The other Requestor and the agents are refused the read (403). So the "non-reader gets no summary" case is proven by the guarded branch and by the refused reads carrying nothing. Phase 17's participants exercise it.
- **No summary for an unreadable count.** The summary's `count` is a separate `removedAt IS NULL` count through the query engine. It is not derived from the list, so the read never loads the files.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] `meta.total` counted removed files.**
   - **Found during:** Task 1 RED.
   - **Issue:** The plan expects `meta.total` 0 after the only file is removed. 14-06 served the stored count, and the spec said "Every file of the request".
   - **Fix:** `total` is now the count of files not removed, and the spec description says so.
   - **Commit:** `13500a84`
2. **[Rule 1 - Bug] One RED test expected the wrong status.**
   - **Issue:** The plan's "another Requestor's request read is unchanged (404)" was written ahead. The existing read refuses another person's request with 403 (the matrix's `OWNER_REQUEST_AGENT_DENIED_403`).
   - **Fix:** The test now asserts the unchanged 403 and that nothing of the files is in it.
   - **Commit:** `be19cf61`
3. **[Rule 3 - Blocking] Files outside the plan's list.**
   - `contract-catalogue.integration.test.ts` asserts the Function's exact `functionApiIds`, so it names `.api.04` and checks the removal contract.
   - `attachments-service.test.ts` holds the removal's call tests, as 14-06 and 14-07 kept theirs there.
   - `request-domain.ts` types the summary for the zod-free domain.
   - `request-service.test.ts` holds the request read's parse tests, beside the notes ones.
   - `attachment-rules.ts` did not change: 14-06 had already written both rules in full.
   - **Commits:** `8ad0d049`, `13500a84`, `11662a91`, `be19cf61`
4. **[Rule 2 - Security] Refused removals are security events.** Each refusal of a removal or restore of a visible file is one `attachment.refused` line, so a Requestor's attempt on someone else's file is on the log (D-37). A refused body is logged the same way.
   - **Commits:** `6bee99af`
5. **[Spec shape] The read's summary is in the inline 200 schema.** The plan named `ApiCsrmAssessmentRequestCsrmAssessmentRequestDocument`, but the read's 200 is an inline schema, where 13-06 put `notes`. `attachments` sits beside `notes` there, not required, as a `$ref` to the closed component.
   - **Commit:** `be19cf61`

**Total deviations:** 5 (2 Rule 1, 1 Rule 3, 1 Rule 2, 1 spec-shape note). **Impact:** none on scope. No content type, schema field or relation changed, and no dependency was added.

## Issues Encountered

- **Some Task 2 cases passed at RED.** These were G-1, `ATTACHMENTS_CLOSED`, the blocked restore, the restore limit and the lifetime bound. The rule-order unit tests passed too. 14-06 wrote `canRemoveAttachment` and `canRestoreAttachment` in full (its SUMMARY says so), Task 1 applied them, and `addRefusalFor` already held the lifetime bound. The three new behaviours failed as intended: the refusal line, `HISTORY_UNAVAILABLE` and the inclusion ending.
- **`api:check` diffs the uncommitted client.** It compares against `HEAD`, so it ran after each contract commit, where it exits 0 (as in 14-07).
- **The catalogue copies use CRLF in the working tree.** The edit script matched CRLF anchors; `cmp` is silent.
- **Shell heredocs mangle backslashes and some quotes here.** Every edit went through the Edit and Write tools or a Python script read from a file.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- T-14-29 is mitigated by 403 `NOT_UPLOADER` and `NOT_REMOVER` under the lock, the G-1 case and their mounted tests.
- T-14-30 is mitigated by `removedAt`, `removedBy`, the append-only `removed` and `restored` events, the removed, restored and refused lines, and kept bytes.
- T-14-31 is mitigated: `attachments` is added only under `canUseRequestNotes`, and the refused reads carry nothing of the files.
- T-14-32 is mitigated by 409 `REQUEST_HAS_ATTACHMENTS`, which counts removed and blocked files, under the request lock.
- No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-09 (AI inclusion)** finds removal already clearing `aiTextIncluded`, `aiText` and `aiTextFacts` and logging the change. Its operation must refuse a removed file (`ATTACHMENT_REMOVED`) and keep `aiTextFacts` null while not included.
- **14-12 onwards (the UI)** can call `setRequestAttachmentRemoval` from a Server Action for Remove, Undo and Restore. They can read the hub's `{n} files` figure and the add state from the request read's `attachments`.
- **Phase 22** takes over `ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE` as the Admin retention setting.

## Self-Check: PASSED

- FOUND: every file in `key-files.modified`.
- FOUND: `8ad0d049`, `13500a84`, `968dbc0a`, `6bee99af`, `11662a91`, `be19cf61`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
