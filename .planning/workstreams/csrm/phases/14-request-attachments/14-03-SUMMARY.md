---
phase: 14-request-attachments
plan: 03
subsystem: file-screening
tags: [content-sniffing, ooxml, cfb, clamav, clamd, instream, malware-scanning, security-events, configuration]
requires:
  - phase: 14-request-attachments
    provides: "14-02: readZipDirectory, ooxmlMainPart, OOXML_MAIN_TYPES, probePdf (the worker's PDF open check) and the fixture builders"
provides:
  - "csrm/files/screen-attachment.ts: screenAttachment, the pipeline Phase 14's upload and Phase 20's evidence files share (name, size, content, SHA-256, scan; stores and logs nothing)"
  - "csrm/files/attachment-policy.ts: the eight types, media types, extensions, macro and old Office extensions, limits, the 7-year retention constant, sanitiseAttachmentName and claimedTypeFor"
  - "csrm/files/content-check.ts: sniffSignature and checkAttachmentContent (extension x signature x OOXML main part x CFB directory x PDF open check x text rule), dependency-free"
  - "csrm/files/scanner.ts: the MalwareScanner port, ScanVerdict, the development double (EICAR stored XOR 0x5A) and selectMalwareScanner"
  - "csrm/files/clamav-scanner.ts: the ClamAV INSTREAM adapter over node:net, failing closed"
  - "csrm/files/attachment-config.ts: the D-15 settings, their defaults and boot validation, stored under strapi.config csrm.attachments"
  - "csrm/audit/security-event-log.ts: the security event line (schema 1) Phase 17 and Phase 19 extend"
  - "tests/helpers/fake-clamd-server.ts and six hostile fixture builders"
affects: [14-04, 14-06, 14-09, 14-16, 14-17, 17, 19, 20]
actuals:
  tokens: 25367
  tasks: 3
  commits: 6
plan_head_before: a85e2571f957bb7552a48853f3080facb468f0bc
plan_head_after: 441ae1528bb05713ac1bde147cd871e96b59d5ca
tech-stack:
  added: []
  patterns:
    - "Fail closed at the scanner port: only `stream: OK` is clean; limits, drops, refusals, timeouts, aborts and a throwing scanner are `not-scanned` with a closed cause."
    - "Security event lines are built from an allow-list of fields; reasons, detections, outcomes and ids must match closed patterns or are replaced, so no free text reaches the log."
    - "A test-only signature (CSRM-TEST-MALWARE-SIGNATURE-7c1e4a) in every suite; the real test string exists only decoded in memory."
key-files:
  created:
    - apps/backend/src/csrm/files/screen-attachment.ts
    - apps/backend/src/csrm/files/attachment-policy.ts
    - apps/backend/src/csrm/files/content-check.ts
    - apps/backend/src/csrm/files/scanner.ts
    - apps/backend/src/csrm/files/clamav-scanner.ts
    - apps/backend/src/csrm/files/attachment-config.ts
    - apps/backend/src/csrm/audit/security-event-log.ts
    - apps/backend/tests/helpers/fake-clamd-server.ts
    - apps/backend/tests/attachment-policy.unit.test.ts
    - apps/backend/tests/attachment-content-check.unit.test.ts
    - apps/backend/tests/attachment-scanner.unit.test.ts
    - apps/backend/tests/attachment-config.unit.test.ts
    - apps/backend/tests/security-event-log.unit.test.ts
  modified:
    - apps/backend/src/index.ts
    - apps/backend/.env.example
    - apps/backend/tests/helpers/attachment-fixtures.ts
    - apps/backend/tests/ai-run-boot.unit.test.ts
    - apps/backend/tests/keycloak-provisioning.unit.test.ts
key-decisions:
  - "The development key is reused from ai/data-policy.ts isDevelopmentRuntime (NODE_ENV and CSRM_ENVIRONMENT both development), so attachments and the AI ceiling share one definition."
  - "A CFB is encrypted OOXML only when its directory, read through the FAT located by the header DIFAT and DIFAT sectors, names an EncryptedPackage stream; a structure that does not fit is refused as an old Office format (both are refusals)."
  - "The security event line serialises the event name as `event`, so the JSON has no key called `name`; reasons, detections, outcomes, ids and digests outside closed patterns are replaced (INVALID_REASON, INVALID_DETECTION, invalid, INVALID_ID)."
  - "Only ClamAV settings in use are validated: the port, host and timeout are checked when CSRM_ATTACHMENT_SCANNER=clamav; CSRM_ATTACHMENT_LOCAL_DIR defaults to .tmp/attachments wherever storage is local."
  - "clamav-scanner.ts declares its verdict type structurally (ClamavVerdict) so it imports only node:net and node:buffer; selectMalwareScanner returning it as a MalwareScanner proves the two agree."
patterns-established:
  - "Fake network peer per protocol: fake-clamd-server.ts (modes clean, found:{name}, limits, size-exceeded, close, silent, down; setMode, received, versionRequests, close)"
  - "Boot validation chain in register(): assertCsrmAiConfiguration, then assertAttachmentConfiguration"
requirements-completed: []  # COLLAB-02 is traced here but completes at the 14-17 gate
coverage:
  - id: D1
    description: "One screening call: name, empty, size, content check, SHA-256, scan; infected is refused with the detection, a failing scanner is not scanned"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-content-check.unit.test.ts (screening tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every allowed type accepted only when content and extension agree; mismatch, macro-enabled, encrypted, old Office and not-allowed refusals; the name rule and the 25 MiB limit"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-content-check.unit.test.ts; apps/backend/tests/attachment-policy.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Development double flags the CSRM test signature and the EICAR string decoded in memory; ClamAV adapter fails closed against the fake clamd"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-scanner.unit.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Attachment settings: development defaults, unavailable elsewhere when unset, boot failures naming the setting; register() validates them"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-config.unit.test.ts"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend test (1114/1114)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Security event lines: named, versioned, key-ordered, warn for malware, blocked and integrity events, never a name, content or text"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/security-event-log.unit.test.ts"
        status: pass
    human_judgment: false
duration: 51min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 03: Screening, Scanning, Settings and Security Events Summary

**CSRM can now decide whether an uploaded file may be kept. `screenAttachment` checks the name, the size and the content against the eight-type allow-list without any file-type dependency, digests the bytes and asks a malware scanner: the development double, or a ClamAV adapter over `node:net` that fails closed. The settings default safely in development and turn attachments off elsewhere until configured, and every outcome can become one security event line that never holds a file's name or content.**

PHASE_14_BASE=e50053f

## Performance

- **Duration:** about 51 min (2026-10-09 17:19 to 18:10 UTC), including two 17-minute full Strapi suites.
- **Completed:** 2026-10-10 (+11:00)
- **Tasks:** 3 of 3, each test first (RED commit, then GREEN commit)
- **Files:** 18 (2,137 lines added, 4 removed)

## Accomplishments

- **Screening** (`screen-attachment.ts`). The order is: name (`null` gives `ATTACHMENT_TYPE_NOT_ALLOWED`), empty (`ATTACHMENT_EMPTY`), over 26,214,400 bytes (`ATTACHMENT_TOO_LARGE`), the content check, the SHA-256, then the scan (`infected` gives `ATTACHMENT_MALWARE_FOUND` with the detection and engine). A scanner that throws is `not-scanned` with cause `error`. A refused content check never reaches the scanner. `probePdf` defaults to the extraction worker's.
- **Policy** (`attachment-policy.ts`): the types, media types, extensions, `MACRO_ENABLED_EXTENSIONS`, `LEGACY_OFFICE_EXTENSIONS`, `TEXT_BEARING_ATTACHMENT_TYPES`, `ATTACHMENT_LIMITS`, `ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE = 7`, `storageExtensionFor`, `claimedTypeFor`, and `sanitiseAttachmentName`. The name rule:
  - it keeps only the part after the last `/` or `\`;
  - it removes C0, DEL and C1 controls, U+200E, U+200F, U+061C, U+202A to U+202E and U+2066 to U+2069;
  - it trims the result, and above 255 characters it shortens the stem and keeps the extension, never splitting a surrogate pair.
- **Content check** (`content-check.ts`):
  - **Signatures:** `%PDF-`, PNG, JPEG, `PK\3\4`, CFB.
  - **Text rule:** UTF-16 after its byte order mark (even length, fatal decode); otherwise UTF-8 (with or without its mark, fatal decode) holding no NUL. An `MZ` or ELF start is binary.
  - **CFB:** the directory is walked through the FAT (header DIFAT plus DIFAT sectors, every hop bounded). An `EncryptedPackage` stream means `ATTACHMENT_ENCRYPTED`; anything else is `ATTACHMENT_LEGACY_OFFICE`.
  - **ZIP:** `ZIP_ENCRYPTED` means `ATTACHMENT_ENCRYPTED`, and any other reader refusal is a mismatch. Then macros (`ATTACHMENT_MACRO_ENABLED`), then the main type against the claimed type.
  - **PDF:** `password` means `ATTACHMENT_ENCRYPTED`, and `invalid` is a mismatch.
  - `git grep -l "file-type" -- apps/backend/src` prints nothing.
- **Scanner** (`scanner.ts`):
  - `createDevelopmentScanner()` is named `csrm-development-double/1`. It flags `Eicar-Test-Signature` (decoded at load from `EICAR_XOR_5A_HEX`) and `Csrm.Test.Signature` anywhere in the bytes, with `Buffer.indexOf`.
  - `selectMalwareScanner(config, { connect? })` returns the double, the adapter, or `null`.
- **ClamAV adapter** (`clamav-scanner.ts`; imports only `node:net` and `node:buffer`):
  - `zINSTREAM\0`, 65,536-byte chunks with 4-byte big-endian lengths, then `00 00 00 00`.
  - A 2 s connect bound and an overall `timeoutMs`.
  - `zVERSION\0` gives the engine string, cached 10 minutes. It falls back to `clamav` when VERSION fails.
  - A reply over 4 KiB is an error. A reply that arrived before the connection failed is still parsed.
  - `parseClamdReply` mapping:

    | Reply or event | Verdict |
    |---|---|
    | `stream: OK` | clean |
    | `stream: {name} FOUND` | infected, `detection` capped at 200 characters |
    | `stream: Heuristics.Limits.Exceeded.* FOUND` | not-scanned `limits` |
    | contains `size limit exceeded` | not-scanned `limits` |
    | `… ERROR`, unknown or empty | not-scanned `error` |
    | ECONNREFUSED, EPIPE, ECONNRESET (and ECONNABORTED, EHOSTUNREACH, ENETUNREACH, ENOTFOUND, EAI_AGAIN, ETIMEDOUT), or a close with no reply | not-scanned `unavailable` |
    | connect beyond 2 s | not-scanned `unavailable` |
    | overall timeout | not-scanned `timeout` |
    | abort | not-scanned `error` |

- **Configuration** (`attachment-config.ts`):
  - `readAttachmentConfig(env, { appRoot })` and `assertAttachmentConfiguration(strapi, env = process.env)`. The second stores the result under `csrm.attachments` and logs one info line naming only the storage and scanner kinds, never a bucket, KMS key, directory, host or port.
  - `attachmentConfigOf(strapi)` reads the result back, and reads an unset value as unavailable.
  - `register()` calls `assertAttachmentConfiguration(strapi)` directly after `assertCsrmAiConfiguration(strapi)`.
- **Security events** (`security-event-log.ts`):
  - `SECURITY_EVENT_SCHEMA_VERSION = 1`, with the ten `attachment.*` names.
  - The line is `csrm.security_event {json}`, keys in a fixed order: `event`, `schemaVersion`, `at` (UTC ISO), `actor`, `requestId`, `attachmentId`, `fileType`, `byteSize`, `sha256`, `outcome`, `reason`, `detection`, `from`, `to`.
  - The levels are in `SECURITY_EVENT_LEVELS` and `SECURITY_EVENT_WARN_REASONS`: warn for `attachment.blocked`, `attachment.integrity_failed` and a refusal with `ATTACHMENT_MALWARE_FOUND`, info otherwise.
  - `type SecurityEvent = AttachmentSecurityEvent` is the union Phase 17 and Phase 19 extend.
- **`.env.example`:** a commented block with the development defaults, then the S3 and ClamAV production settings, pointing to `apps/backend/README.md`. No value is set uncommented.

## OOXML main types (Assumption A2)

These are the confirmed values. They equal 14-RESEARCH's strings and 14-02's `OOXML_MAIN_TYPES`:

| Type | Main-part content type |
|---|---|
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml` |
| XLSX | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml` |
| PPTX | `application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml` |
| Macro-enabled DOCX (`buildMacroDocx`) | `application/vnd.ms-word.document.macroEnabled.main+xml` |

No constant changed. The fixtures are script-made (14-02's builders), so they confirm that CSRM agrees with itself and with ECMA-376's published strings, not with a file saved by Office. A3 holds the same way: the encrypted OOXML fixture is a hand-built CFB with `EncryptionInfo` and `EncryptedPackage` streams.

## Fake clamd mode table

`tests/helpers/fake-clamd-server.ts` answers `zVERSION\0` with `ClamAV 1.4.1/27500/Wed Sep 30 2026\0`. For `zINSTREAM\0` it records every chunk's length and bytes, then answers per mode:

| Mode | Fake's behaviour | Adapter's verdict |
|---|---|---|
| `clean` | `stream: OK\0` after the terminator | clean, engine from VERSION |
| `found:{name}` | `stream: {name} FOUND\0` | infected with `{name}` |
| `limits` | `stream: Heuristics.Limits.Exceeded.MaxFileSize FOUND\0` | not-scanned `limits` |
| `size-exceeded` | `INSTREAM size limit exceeded. ERROR\0` after the terminator | not-scanned `limits` |
| `close` | destroys the socket as soon as INSTREAM arrives | not-scanned `unavailable` |
| `silent` | reads the stream and never answers | not-scanned `timeout` (200 ms in the test) |
| `down` | nothing listens on the port | not-scanned `unavailable` |

`setMode` switches modes, closing or reopening the listener on the same port. `received`, `versionRequests()` and `close()` let a test inspect the fake and shut it down. Test results:
- A 3 MiB payload arrived as 48 chunks of 65,536 bytes and the terminator, byte for byte.
- A scanner recovered when the fake came back from `down`.
- Two scans made one VERSION request.

## Task Commits

1. **Task 1 (tracer):** `5cd1c2e` test (RED), `a81e445` feat (GREEN)
2. **Task 2:** `1b4eb14` test (RED), `9666244` feat (GREEN)
3. **Task 3:** `1b9664d` test (RED), `441ae15` feat (GREEN)

`git rev-list --count a85e257..HEAD` is 6 before this summary's commit.

## Verification

- **RED evidence.** For each task, the tests were compiled against throwing stubs of the new modules. The stubs were never committed.
  - Task 1: `# tests 20 / # pass 0 / # fail 20`.
  - Task 2: `# tests 70 / # pass 39 / # fail 31`. The 31 were every new refusal, the text and name rules and the policy constants. The 39 that passed were behaviours Task 1 already implemented, such as accepted fixtures and the PNG named `.pdf`.
  - Task 3: `# tests 38 / # pass 5 / # fail 33`. The 5 were Task 1's double tests.
- **GREEN, focused files:**
  - Task 1: 20/20/0.
  - Task 2: 70/70/0.
  - Task 3: 38/38/0.
  - All five plan files together: `# tests 117 / # pass 117 / # fail 0`, three runs in a row.
  - With the two boot test files: 150/150/0.
  - 14-02's files (`zip-archive`, `attachment-extraction`) stay 48/48/0 after the builder change.
- **Typecheck:** `tsc --noEmit` and `tsc -p tests/tsconfig.json` are clean.
- **Full Strapi suite** (`pnpm --dir apps/backend test`): **`# tests 1114 / # pass 1114 / # fail 0`** (1,032 s) on the code committed in `441ae15`. The first run, before deviation 1, was 1114/1111/3.
- **EICAR guard:** `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing. A grep of `src`, `tests`, `.tmp/tests-dist` and `dist` for it also prints nothing.
- **Dev servers:** `netstat` showed no listener on 1337 or 3000 before either suite.
- **Acceptance criteria:**
  - the event type has no `fileName`, `text` or `content` property, and `name` is the event name, serialised as `event`;
  - `scanner.ts` contains `EICAR_XOR_5A_HEX` and `CSRM-TEST-MALWARE-SIGNATURE-7c1e4a`;
  - `clamav-scanner.ts` imports only `node:net` and `node:buffer`;
  - `attachment-config.ts` logs kinds only;
  - `index.ts` calls the attachment validation after the AI validation;
  - `.env.example` has every setting, commented.

## Decisions Made

See the `key-decisions` frontmatter. Also:

- `ScreenResult` is three variants (`clean`, `not-scanned` with `cause`, `refused`), so `cause` exists only where it means something.
- The `.env.example` block sits before the AI provider block, after the AI data policy setting.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 - Blocking] Two existing boot tests' fake Strapi objects had no `dirs` or `config.set`.**
   - **Found during:** Task 3's first full suite (1114/1111/3).
   - **Issue:** `ai-run-boot.unit.test.ts` and `keycloak-provisioning.unit.test.ts` call `register()` with hand-made fakes, which now reach `assertAttachmentConfiguration`. One Keycloak test also asserted that `register()` logs nothing at info. With the attachment validation, `register()` now writes one info line.
   - **Fix:**
     - Both fakes gained `dirs.app.root` and a no-op `config.set`.
     - The Keycloak test now filters out the `CSRM attachments` line before asserting that Keycloak logs nothing. Its intent is unchanged.
   - **Files modified:** `apps/backend/tests/ai-run-boot.unit.test.ts`, `apps/backend/tests/keycloak-provisioning.unit.test.ts`
   - **Commit:** `441ae15`. The second full suite was 1114/1114/0.
2. **[Rule 2 - Security] Closed-pattern sanitising of event fields.** The plan fixes the event's fields, but a `reason` or `detection` string could still carry free text, such as a file name or a forged JSON fragment from a network peer's detection. The line keeps only values that match closed patterns, and anything else becomes `INVALID_REASON`, `INVALID_DETECTION`, `invalid` or `INVALID_ID`. Extra properties a caller passes are dropped. Tested. (`a81e445`)
3. **[Rule 2 - Correctness] The ClamAV reply is bounded (4 KiB) and the detection capped (200 characters).** An abort is also not scanned. (`441ae15`)
4. **[Rule 2 - Security] An S3 endpoint that is not an http(s) URL fails boot.** The plan validates the S3 block's completeness only. (`441ae15`)
5. **[Design] `buildDocx` gained a `mainType` option** for `buildMacroDocx`. The default is unchanged, so the committed fixtures stay byte-identical (14-02's equality test passes).
6. **[Verify format] node:test in this repository prints the spec reporter (`ℹ tests N`, `ℹ pass N`, `ℹ fail N`), not TAP's `# pass`.** The counts above are those lines, reported in the brief's `# pass N / # fail 0` form.

**Impact on plan:** none on scope. Deviation 1 touches two test files outside the plan's list, only so they keep booting `register()` with the new validation.

## Issues Encountered

- The shell in this environment drops backslashes inside heredocs. The first in-memory EICAR computation came out as 67 bytes and failed its SHA-256 check. I recomputed it with `String.fromCharCode(92)`: 68 bytes, matching the published SHA-256. Only the XOR hex was ever printed or written.
- Unit-only proofs, as the orchestrator accepted on 2026-10-01: two outcomes need a runtime outside development, so only `attachment-config.unit.test.ts` proves them:
  - `ATTACHMENTS_NOT_CONFIGURED` when settings are unset outside development;
  - the boot failure when the development scanner is configured outside development.

## Threat Flags

None beyond the plan's register. The outbound TCP connection to clamd is the planned Strapi → clamd boundary (T-14-08). No route, endpoint or schema changed.

## User Setup Required

None for development. A deployment sets `CSRM_ATTACHMENT_STORAGE` and `CSRM_ATTACHMENT_SCANNER` with their blocks (`apps/backend/.env.example`). 14-17 writes the README's deployment section.

## Next Phase Readiness

- 14-04 can wire storage from `attachmentConfigOf(strapi).storage` (local directory or the S3 block).
- 14-06 can refuse with `ATTACHMENTS_NOT_CONFIGURED` from `attachmentConfigOf(strapi).available`, call `screenAttachment` with `selectMalwareScanner(config.scanner)`, and log every outcome with `logSecurityEvent(strapi.log, …)`.
- The harnesses do not pin attachment settings yet. They boot under the development key, so they get the defaults. D-15's harness pin belongs to the plan that wires storage.

## Self-Check: PASSED

- FOUND: the seven modules under `apps/backend/src/csrm/files/` and `apps/backend/src/csrm/audit/`, `fake-clamd-server.ts` and the five unit test files.
- FOUND: `5cd1c2e`, `a81e445`, `1b4eb14`, `9666244`, `1b9664d`, `441ae15`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
