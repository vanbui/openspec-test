---
phase: 14-request-attachments
plan: 07
subsystem: api
tags: [strapi, attachments, download, binary-response, content-disposition, sha256, malware-scanning, quarantine, rescan, openapi, openapi-fetch]
requires:
  - phase: 14-request-attachments
    provides: "14-04 createAttachmentStorage and the harness's attachment options; 14-03 selectMalwareScanner, logSecurityEvent and the fake clamd; 14-05 the closed refusal reasons and the any-4xx transport; 14-06 the content type, CSRM_REQUEST_ATTACHMENT_OPERATIONS, attachmentStateOf, appendAttachmentEvent, ATTACHMENT_READ and the web attachments service"
  - phase: 13-request-pick-up-and-notes
    provides: "canUseRequestNotes (the readers) and withRequestLock"
provides:
  - "GET /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content (CSRM_REQUEST_ATTACHMENT_OPERATIONS.download, function.risk_assessment_requests.attachments_api.api.03): the contract's first binary response"
  - "apps/backend/src/csrm/files/send-stored-file.ts: readVerifiedStoredFile, contentDispositionFor, sendStoredFile (Phase 20 reuses)"
  - "apps/backend/src/csrm/files/rescan-scheduler.ts: createRescanScheduler, RESCAN_BACKOFF_MINUTES, RESCAN_MAX_ATTEMPTS, rescanDelayMs (Phase 20 reuses)"
  - "request-attachments.ts: readRequestAttachmentContent, rescanPendingAttachment, startAttachmentRescans, stopAttachmentRescans, scheduledAttachmentRescans"
  - "apps/backend/src/index.ts: the re-scan start at the end of bootstrap() and its stop in destroy()"
  - "apps/csrm/src/lib/files/file-response.ts: validateFileResponse, parseContentDispositionFileName, attachmentFileRule, ATTACHMENT_RESPONSE_CONTENT_TYPES, FileResponseRule (Phase 19 adds its export rule beside it)"
  - "Web attachments-service.ts downloadRequestAttachment (parseAs arrayBuffer) and the parity guard's file-response mode"
affects: [14-08, 14-09, 14-10, 14-11, 14-12, 14-13, 14-17, 19, 20]
actuals:
  tokens: 27700
  tasks: 3
  commits: 6
plan_head_before: 912722d6dedceb28d830c9ffda846ebb217db6d5
plan_head_after: 371fec3a51df65a835e9800b13271f0de8f3b27e
tech-stack:
  added: []
  patterns:
    - "Binary download: grant, readers (404), the file on this request (404), its state (409 with the closed reason), the verified read (SHA-256 compared before any byte), then the hardening headers and the bytes; refusals stay JSON"
    - "Parity guard file-response mode: a module registers fileResponses whose media types must equal the 200's declared content exactly, each a string with that contentMediaType and no JSON"
    - "In-process re-scans: scan outside the lock, re-check pending and write the verdict under withRequestLock, delete a blocked file's bytes after the lock; unref()'d timers kept per scheduler, stopped in destroy()"
key-files:
  created:
    - apps/backend/src/csrm/files/send-stored-file.ts
    - apps/backend/src/csrm/files/rescan-scheduler.ts
    - apps/backend/tests/attachment-rescan.unit.test.ts
    - apps/backend/tests/attachment-quarantine.integration.test.ts
    - apps/csrm/src/lib/files/file-response.ts
    - apps/csrm/src/lib/files/file-response.test.ts
  modified:
    - apps/backend/src/api/csrm-request-attachment/operations.ts
    - apps/backend/src/api/csrm-request-attachment/routes/request-attachments.ts
    - apps/backend/src/api/csrm-request-attachment/controllers/request-attachments.ts
    - apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts
    - apps/backend/src/index.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - docs/references/idambox-csrm-role-function-api-catalogue.json
    - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
    - docs/references/served-operations.json
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - apps/backend/tests/request-attachments.integration.test.ts
    - apps/csrm/src/features/attachments/attachments-schema.ts
    - apps/csrm/src/features/attachments/attachments-service.ts
    - apps/csrm/src/features/attachments/attachments-service.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
key-decisions:
  - "The parity guard's mode gains 'file-response' for a module that only reads files, and any module may register fileResponses; attachments-service stays 'parsers' with one file response, checked against the spec's media types both ways."
  - "The download sets Content-Type exactly as recorded with ctx.set, not Koa's ctx.type, which would add charset=utf-8 to a text file of unknown encoding."
  - "Download refusals follow attachmentStateOf's precedence (REMOVED, BLOCKED, QUARANTINED, UNAVAILABLE) with their own message; an unknown recorded type is UNAVAILABLE."
  - "A plugin file record whose storage key was altered counts as an integrity failure (tamper evidence); any other storage fault is thrown (500), so unverified bytes are never sent."
  - "attachment.integrity_failed carries the recorded digest, outcome refused and reason ATTACHMENT_INTEGRITY_FAILED; other download refusals are not logged, following D-37's list."
  - "bootstrap() starts the re-scans without awaiting them, so a scanner that is down never delays a start; destroy() awaits the stop, which waits for the start and any re-scan in flight."
  - "Re-scans include removed pending files, so a blocked verdict still deletes the bytes and a later restore finds a verdict."
  - "A blocked verdict is written under the lock first (blocked, detection, media link cleared, blocked event); the bytes and plugin file record are deleted after the lock, and a failure there leaves an unreachable orphan with an error line."
  - "The stored detection is kept only when it fits the contract's pattern; the security event line keeps the engine's detection through its own closed pattern (as at upload)."
  - "A pending file whose bytes cannot be read is not scanned (cause error): it stays pending and its attempt is counted."
patterns-established:
  - "send-stored-file.ts is the one place stored bytes leave Strapi: a verified read, then sendStoredFile"
  - "lib/files/file-response.ts is the web's one file check, a rule per kind of file (attachments now, exports in Phase 19)"
requirements-completed: [COLLAB-02]
coverage:
  - id: D1
    description: "Bob downloads Jane's data-flow DOCX through one authorised operation, byte for byte, with Content-Disposition attachment (ASCII filename and RFC 5987 filename*), the recorded media type, nosniff, no-store and the sandboxing CSP, and one attachment.downloaded line without the name; Jane downloads her own"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#Bob downloads Jane's data-flow DOCX byte for byte with hardened headers and one downloaded event without its name, and Jane downloads her own (D-23, D-37)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts (GET …/attachments/{attachmentId}/content row: owner 200, other 404, analyst 200, serviceAgent 404, noIdentity 403)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The other Requestor, the service agent, an unknown file id and a file id from another request get 404; a removed, quarantined, blocked or vanished file is 409 with its reason; tampered bytes are 409 ATTACHMENT_INTEGRITY_FAILED with a warn-level line; no refusal carries a byte of the file"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts (the 404 download test and the six Task 2 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A 24 MiB text file downloads byte for byte, and a non-ASCII name with quotes gets a safe ASCII filename and an exact filename*"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-attachments.integration.test.ts#a 24 MiB text file downloads byte for byte, and a non-ASCII name with quotes gets a safe filename and an exact filename* (D-23; 14-RESEARCH Pitfall 15)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Quarantined files are re-scanned with backoff and at every start, released when clean, blocked when infected (bytes and plugin record deleted, facts kept), kept pending on limits with an error; timers are unref()'d and stopped in destroy()"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-rescan.unit.test.ts"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/attachment-quarantine.integration.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The web's shared file-response validator, the typed binary download and the parity guard's file-response mode, with no Route Handler and no raw fetch; the contract, catalogue, generated client and inventory agree"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/files/file-response.test.ts; apps/csrm/src/features/attachments/attachments-service.test.ts; apps/csrm/src/features/contract-response-parity.test.ts; apps/csrm/src/features/contract-operation-chain.test.ts"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/contract-catalogue.integration.test.ts#Phase 14 request attachments are held by one Function granted to the Security Analyst and the Requestor alone and published closed"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/backend test (1184/1184); pnpm --dir apps/csrm test (4432/4432); api:check; cmp"
        status: pass
    human_judgment: false
duration: 55min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 07: Attachment Download and Re-scan Summary

**Readers now download a request's files through one authorised Strapi operation. Strapi reads the stored bytes through the storage port, checks them against the recorded SHA-256 before sending any, and sends them as an attachment with the recorded media type, `nosniff`, `no-store` and a sandboxing CSP. A file that is removed, quarantined, blocked, gone or altered never leaves Strapi and is refused with its reason. Quarantined files are re-scanned in process until released or blocked, and the web checks every downloaded file again through a shared validator that Phase 19 reuses.**

PHASE_14_BASE=e50053f. COLLAB-02 is traced here but stays Pending until 14-17's phase gate (`requirements-completed` copies the plan's array, as the template asks).

## Performance

- **Duration:** about 55 min (2026-10-09T23:02:58Z to about 23:58Z), including one 20-minute full Strapi suite
- **Completed:** 2026-10-10 (+11:00)
- **Tasks:** 3 of 3, each test first (RED commit, then GREEN commit). Task 1 is the tracer. Its verify passed end to end on the committed code, so expansion went ahead with no checkpoint.
- **Files:** 24 (1,906 lines added, 21 removed)

## Accomplishments

- **The download operation.**
  - `GET /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content`, handler `download`, held by `function.risk_assessment_requests.attachments_api.api.03` ("Download Assessment Request Attachment").
  - The controller admits the caller with `canUseRequestNotes`. Everyone else gets 404, and so does a file id that is not on the path's request (the lookup filters by both).
- **The state refusals.** Each is 409 with its closed reason, in `attachmentStateOf`'s precedence:
  - `ATTACHMENT_REMOVED`, `ATTACHMENT_BLOCKED` and `ATTACHMENT_QUARANTINED`;
  - `ATTACHMENT_UNAVAILABLE` for a deleted plugin file record or missing stored bytes;
  - `ATTACHMENT_INTEGRITY_FAILED` for bytes that no longer match the digest, with a warning-level `attachment.integrity_failed` line.
- **`send-stored-file.ts`** (Phase 20 reuses it):
  - `readVerifiedStoredFile` compares the SHA-256 with `timingSafeEqual` before returning any byte;
  - `contentDispositionFor` builds `attachment; filename="…"; filename*=UTF-8''…`, with non-ASCII, `"` and `\` replaced by `_` in the ASCII name and `'()*` percent-encoded in `filename*`;
  - `sendStoredFile` sets the four hardening headers, the recorded media type and the body.
- **Events.** Every download logs one `attachment.downloaded` line without the file's name.
- **The contract.**
  - The spec declares the binary 200 under the eight media types (`{ type: "string", contentMediaType }` each), with its four headers. 403, 404 and 409 use the JSON error responses.
  - `api:generate` and `api:check` are clean.
  - The catalogue copies are equal (`cmp` silent).
  - `served-operations.json` gains the row, with web caller `src/features/attachments/attachments-service.ts`.
- **The re-scan scheduler** (`rescan-scheduler.ts`):
  - backoff of 1, 5, 15 and 60 minutes, then hourly, and no attempt past 24 (one error at the bound);
  - `start()` re-scans every pending item once, then schedules each by its attempts;
  - every timer is `unref()`'d;
  - `stop()` clears every timer and waits for the start and any re-scan in flight;
  - a re-scan that throws is logged and stays scheduled.
- **`rescanPendingAttachment`** reads and scans outside the lock, then re-checks `pending` under `withRequestLock` and writes the verdict:
  - **clean:** `scanStatus` clean, `scanCheckedAt`, the engine, a `scan-verdict` event and an `attachment.scan_verdict` line;
  - **infected:** `scanStatus` blocked, the detection, the media link cleared and a `blocked` event. The bytes and plugin file record are then deleted, and a warning-level `attachment.blocked` line is logged. Name, size, digest and uploader are kept;
  - **not scanned:** the attempt is counted. A `limits` cause logs an error naming clamd's StreamMaxLength, MaxFileSize, MaxScanSize and AlertExceedsMax requirement.
- **The boot and destroy hooks.**
  - `bootstrap()` calls `startAttachmentRescans(strapi)` without awaiting it, and `destroy()` awaits `stopAttachmentRescans(strapi)`.
  - An upload stored pending schedules its first re-scan.
- **The web.**
  - `lib/files/file-response.ts` checks the type by its media-type essence, the safe name with the type's extension (`.jpg` or `.jpeg` for JPEG), the 26,214,400-byte bound and the signature: `%PDF`, PNG, JPEG, `PK`, or Strapi's own text rule.
  - `downloadRequestAttachment` calls the generated path with `parseAs: 'arrayBuffer'` and returns `{ fileName, contentType, bytes: Uint8Array }`, a `TransportError` with the closed reason, or `{ kind: 'file-check', failure }`.
  - The parity guard registers the download in its file-response mode.
  - There is no Route Handler and no raw `fetch`.

## Matrix

There are 127 matrix rows, one of them new: `GET …/attachments/{attachmentId}/content` answers owner 200, other 404, analyst 200, serviceAgent 404 and noIdentity 403. The row issues its successes (`exercisesAllowed`) against a clean seeded file on the matrix draft, and no denial may carry the draft, the file id or the seeded content.

## Task Commits

1. **Task 1 (tracer):** `01f355bf` test (RED), `fe1908e3` feat (GREEN)
2. **Task 2:** `2b549f6f` test (RED), `5436be33` feat (GREEN)
3. **Task 3:** `8f2ec27b` test (RED), `371fec3a` feat (GREEN)

`git rev-list --count 912722d6..HEAD` is 6 before this summary's commit.

## Verification

- **RED evidence:**
  - **Task 1:**
    - TAP `# tests 177 / # pass 170 / # fail 7`: the download cases (404 where 200 was expected), the matrix completeness, provenance and row (`MATRIX_NO_TOKEN_UNRECORDED`, a 404 for the owner), the unserved inventory row, and the catalogue's missing `.api.03`.
    - Web: the service function was missing (3 failures), and the validator module was missing, so `file-response.test.ts` and the parity file failed at import.
  - **Task 2:** TAP `# tests 22 / # pass 17 / # fail 5`. Four refusals got the generic `ATTACHMENT_UNAVAILABLE`, and the header's ASCII name carried raw quotes. The unavailable and cross-request cases passed at RED; see Issues.
  - **Task 3:** 7 of 7 failed. The scheduler module and the four service functions did not exist.
- **GREEN, focused:**
  - Task 1 verify:
    - `cmp` silent; `api:check` exit 0 after commit;
    - vitest 4 files `Tests 203 passed (203)`;
    - web typecheck clean;
    - node 5 files (`request-attachments`, `served-operations`, matrix provenance, matrix, `contract-catalogue`): `ℹ tests 187 / ℹ pass 187 / ℹ fail 0`.
  - Task 2 verify: `ℹ tests 22 / ℹ pass 22 / ℹ fail 0`.
  - Task 3: the unit and quarantine files, `ℹ tests 14 / ℹ pass 14 / ℹ fail 0`. With both attachment mounted files added: `ℹ tests 40 / ℹ pass 40 / ℹ fail 0`.
- **The 24 MiB download round trip** (local adapter, the harness's loopback): 85 ms in the focused run and 76 ms in the full suite.
- **Full suites:**
  - Strapi (`pnpm --dir apps/backend test`, dev servers stopped): `ℹ tests 1184 / ℹ pass 1184 / ℹ fail 0` (1,200 s), on the code in `371fec3a`.
  - Web (`pnpm --dir apps/csrm test`): 196 files, `Tests 4432 passed (4432)`. `pnpm --dir apps/csrm lint` is clean.
- **Acceptance criteria:**
  - `git diff --name-only --diff-filter=A e50053f..HEAD -- apps/csrm/app` lists nothing, and `file-response.ts` has no `fetch(`.
  - The download 200 has exactly eight content keys, each with `contentMediaType`.
  - The test file has one download test per reason, plus the cross-request 404.
  - `index.ts` holds `startAttachmentRescans(strapi)` in `bootstrap` and `stopAttachmentRescans(strapi)` in `destroy`.
  - `rescan-scheduler.ts` calls `handle.unref()` on every timer it creates.
  - The EICAR guard (`git grep -n -I "ANTIVIRUS-TEST" -- apps`) prints nothing.
- **Playwright:** not run (the plan runs none).

## Decisions Made

See `key-decisions` in the frontmatter. Also:
- **2026-10-11, stage B (WR-103): overruled by the pilot.** The key decision that "other download refusals are not logged, following D-37's list" no longer holds (`14-PILOT-RULINGS.md`, WR-103, and "The worker's decisions during stage A"). Each download state refusal (`ATTACHMENT_REMOVED`, `ATTACHMENT_BLOCKED`, `ATTACHMENT_QUARANTINED`, `ATTACHMENT_UNAVAILABLE`) and the integrity refusal now go through `refused()` and are one `attachment.refused` line each (the integrity refusal after its warning-level `attachment.integrity_failed` line, as at the AI inclusion), and a download's 404 is one line with the closed log reason `NOT_FOUND`. The key decision above is kept as written.
- **2026-10-11, stage B (WR-101, WR-102).** A re-scan verdict is never refused by the file's history: on a log at its cap or malformed, the verdict is written with the log untouched and a warning-level `attachment.history_unavailable` line. The scheduler's bookkeeping no longer derives an unhandled rejection from a start whose listing fails, and `bootstrap()` logs one error line for a failed start.
- Task 1's GREEN was kept minimal so that Task 2's RED was real. Task 1 refused every unavailable state with the generic `ATTACHMENT_UNAVAILABLE` and replaced only non-ASCII characters in the ASCII name. It never sent a byte it should not.
- `scheduledAttachmentRescans(strapi)` is exported so the mounted test can prove that bootstrap starts the re-scans and destroy stops them.
- In the spec, the four headers are `required` and the three fixed ones carry `const`.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 - Blocking] Four files outside the plan's list.**
   - `contract-catalogue.integration.test.ts` asserts the Function's exact `functionApiIds`, so it had to name `.api.03`. It now also checks the binary 200, the headers and the refusals.
   - `authorization-matrix.integration.test.ts` seeds one clean file on the matrix draft for the download row.
   - `attachments-schema.ts` gains `downloadAttachmentInputSchema`.
   - `attachments-service.test.ts` holds the download's call tests, as 14-06 kept the upload's there.
   - **Commits:** `01f355bf`, `fe1908e3`
2. **[Rule 1 - Bug] A RED test defect.** In the stop test, the fake clock fired a timer without retiring it, which a real timer never does. A `fire` helper fixes it. Making `unref()` required on the handle type then needed one cast in the fake's `clearTimeout`. (`371fec3a`)
3. **[Rule 2 - Correctness] stop() waits for the start too.** The scheduler tracks its own `start()` as work in flight, so `destroy()` never returns while a boot re-scan still reads or writes (Pitfall 11). (`371fec3a`)
4. **[Test shape] Two mounted proofs set a fact directly.**
   - Task 2's quarantined download sets `scanStatus: "pending"` on a clean upload. The fake-clamd `down` path is proven in `attachment-quarantine.integration.test.ts`.
   - The non-ASCII name is set by a fixture update after the upload, so the multipart filename encoding cannot affect the header proof.

**Total deviations:** 3 auto-fixed (1 Rule 3, 1 Rule 1, 1 Rule 2) and 1 test-shape note. **Impact:** none on scope. No content type, schema field or relation changed, and no dependency was added.

## Issues Encountered

- **Two cases passed at Task 2's RED:** the file id from another request (404) and the vanished file record (`ATTACHMENT_UNAVAILABLE`). Task 1's lookup already filtered by the path's request, and its fail-closed refusal already named `ATTACHMENT_UNAVAILABLE`. Both stay as Task 2's proofs; the other four reasons and the header failed as intended.
- **Task 3's RED needed `--noEmitOnError false`.** The unit test imports the scheduler, which did not exist, so the tests tsconfig (`noEmitOnError: true`) emitted nothing. The RED run used `tsc -p tests/tsconfig.json --noEmitOnError false`. Every verify since uses the plain command.
- **This shell's heredocs mangle backslashes and some quote sequences.** Edits that needed them went through the Edit and Write tools, or a Python script written with Write.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- T-14-24 is mitigated by the readers 404, the request filter and the matrix row.
- T-14-25 is mitigated by the digest check and the warning-level event.
- T-14-26 is mitigated by the four headers, the recorded media type and the web validator.
- T-14-27 is mitigated: pending is 409, and a blocked verdict deletes the bytes and plugin record.
- T-14-28 is mitigated by the 24-attempt bound and by `unref()`'d timers cleared in `destroy()`.
- No package was added.

## User Setup Required

None.

## Next Phase Readiness

- **14-08 (removal and restore)** finds the download's `ATTACHMENT_REMOVED` refusal in place. Re-scans already include removed pending files.
- **14-12 onwards (the UI)** can call `downloadRequestAttachment` from a Server Action and save `bytes` through a Blob. The validator has already checked them.
- **Phase 19** adds its export rule beside `attachmentFileRule`, and a `file-response` mode module for its export service.
- **Phase 20** reuses `send-stored-file.ts` and `rescan-scheduler.ts`.
- **Generated types (G-1):** `apps/backend/types/generated/contentTypes.d.ts` still lacks `CsrmRequestAttachment`. The orchestrator's regeneration commit is still due before 14-17's gate.

## Self-Check: PASSED

- FOUND: `send-stored-file.ts`, `rescan-scheduler.ts`, `file-response.ts`, `file-response.test.ts`, `attachment-rescan.unit.test.ts`, `attachment-quarantine.integration.test.ts`.
- FOUND: `01f355bf`, `fe1908e3`, `2b549f6f`, `5436be33`, `8f2ec27b`, `371fec3a`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
