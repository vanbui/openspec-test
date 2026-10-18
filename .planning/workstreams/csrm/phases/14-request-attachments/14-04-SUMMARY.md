---
phase: 14-request-attachments
plan: 04
subsystem: file-storage
tags: [upload-plugin, private-storage, s3, sse-kms, presigned-url, multipart, formidable, authorization-matrix, served-operations]
requires:
  - phase: 14-request-attachments
    provides: "14-03: attachmentConfigOf, AttachmentConfig, ATTACHMENT_DEFAULT_LOCAL_DIR, ATTACHMENT_MEDIA_TYPES, ATTACHMENT_LIMITS, storageExtensionFor; 14-02: @strapi/provider-upload-aws-s3 5.51.0 and the PNG and JPEG fixtures"
provides:
  - "csrm/files/storage-port.ts: createAttachmentStorage (put, read, remove), AttachmentStorage, StoredAttachmentFile, AttachmentStorageError (four closed codes), STORAGE_KEY_PATTERN; Phase 20 reuses it"
  - "csrm/files/private-local-provider.ts: createPrivateLocalProvider, the upload plugin's local provider made private (/csrm-private/, never routed)"
  - "csrm/files/register-attachment-storage.ts: registerAttachmentStorage (provider override, baseUrl refusal, content-API unmount) and attachmentUploadPluginConfig (the private S3 block)"
  - "global::csrm-multipart-cleanup: every multipart temporary file removed after every request"
  - "Harness: pinned CSRM_ATTACHMENT_* settings and development key, options attachmentStorage (s3) and attachmentScanner (clamav), helpers attachmentStorage(), attachmentStorageDirectory(), findUploadFileRecord(), countUploadFileRecords()"
  - "tests/helpers/fake-object-store.ts: startFakeObjectStore (path-style PUT, GET, DELETE; presigned GETs only)"
affects: [14-05, 14-06, 14-07, 14-09, 14-12, 14-16, 14-17, 20]
actuals:
  tokens: 21283
  tasks: 3
  commits: 6
plan_head_before: 5aa6e1a5349deaf4ef294dec7637e6837f84deee
plan_head_after: 4e48d7716c1edd961292079f28ffd7d2d9d4fb39
tech-stack:
  added: []
  patterns:
    - "One storage port over the upload plugin's provider: CSRM generates the key and creates the plugin's file record itself, so the plugin's upload service (image optimisation, formats, name-derived keys) never runs for attachments."
    - "The provider is replaced through its own `extend` in the application's register(), never configured as a module path."
    - "Unmounting a plugin's content-API router by its `routes` setter in register(), failing boot when the router cannot be found."
    - "An unmounted plugin route keeps its matrix row (`unmounted: true`), asserting 404 or 405 for every caller and its absence from the inventory."
key-files:
  created:
    - apps/backend/src/csrm/files/storage-port.ts
    - apps/backend/src/csrm/files/private-local-provider.ts
    - apps/backend/src/csrm/files/register-attachment-storage.ts
    - apps/backend/src/middlewares/csrm-multipart-cleanup.ts
    - apps/backend/tests/helpers/fake-object-store.ts
    - apps/backend/tests/attachment-storage.unit.test.ts
    - apps/backend/tests/attachment-storage-s3.integration.test.ts
  modified:
    - apps/backend/src/index.ts
    - apps/backend/config/plugins.ts
    - apps/backend/config/middlewares.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/backend/tests/http-hardening.integration.test.ts
    - apps/backend/tests/fixtures/authorization-matrix.ts
    - apps/backend/tests/authorization-matrix.integration.test.ts
    - apps/backend/tests/served-operations.integration.test.ts
    - docs/references/served-operations.json
    - apps/backend/tests/ai-run-boot.unit.test.ts
    - apps/backend/tests/keycloak-provisioning.unit.test.ts
key-decisions:
  - "The upload plugin's file content type has no sizeInBytes attribute, so the port records the plugin's kilobyte `size` (two decimals) and the mounted test checks that; the byte count stays the attachment record's job (14-06)."
  - "The private local provider keeps the stock provider's checkFileSize, so the admin Media Library keeps the plugin's size limit; the port never calls it. It also replaces `replace` and `replaceStream`, which would otherwise write a Media Library replacement into public/uploads."
  - "The harness pins NODE_ENV and CSRM_ENVIRONMENT to development before boot (they were set only after it), because CSRM_ATTACHMENT_SCANNER=development fails boot outside the development key; boot-time behaviour changes only by dropping two AI warnings."
  - "The S3 harness keeps its dummy AWS credentials until close, not for the boot only, because the SDK resolves credentials on first use; it also clears AWS_PROFILE, AWS_SESSION_TOKEN and the endpoint variables and disables the instance-metadata lookup, so no real AWS endpoint can be reached."
  - "registerAttachmentStorage fails boot when the upload provider and CSRM_ATTACHMENT_STORAGE disagree, when the provider is neither local nor aws-s3, or when the content-API router cannot be emptied."
requirements-completed: []  # COLLAB-02 is traced here but completes at the 14-17 gate
coverage:
  - id: D1
    description: "Attachment bytes round-trip unchanged (PNG and JPEG included) through one port under a csrm_ key, in a private directory outside public/, with no derived formats"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-storage.unit.test.ts (private local provider, STORAGE_KEY_PATTERN)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/http-hardening.integration.test.ts#the storage port keeps PNG and JPEG bytes privately under a generated key and returns them unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nothing serves a stored attachment: /uploads/ and /csrm-private/ answer 404 with none of its bytes; remove deletes the file and the record"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/http-hardening.integration.test.ts#nothing serves a stored attachment: /uploads/ and /csrm-private/ answer 404 with none of its bytes, and remove deletes it"
        status: pass
    human_judgment: false
  - id: D3
    description: "The upload plugin's five content-API routes are unmounted for every caller (GET 404, mutation 405), the admin router stays (GET /upload/settings 401), the matrix and inventory record it"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/http-hardening.integration.test.ts#the upload plugin's content-API routes are unmounted for every caller, the full-access token included"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/served-operations.integration.test.ts#the upload plugin's content-API routes are unmounted while its admin routes stay mounted (D-08)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/authorization-matrix.integration.test.ts (the five upload rows)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No multipart temporary file survives a request, for a part named file or files and for a refused CSV import"
    requirement: COLLAB-02
    verification:
      - kind: integration
        ref: "apps/backend/tests/http-hardening.integration.test.ts#no multipart temporary file survives a request, whatever the part name and whether the caller was refused"
        status: pass
    human_judgment: false
  - id: D5
    description: "Private S3: no ACL header, SSE-KMS with the configured key, Sydney by default, no baseUrl; reads through a presigned GET only, never logged; proven against a fake object store"
    requirement: COLLAB-02
    verification:
      - kind: unit
        ref: "apps/backend/tests/attachment-storage.unit.test.ts (S3 block, registration, S3 read refusals)"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/attachment-storage-s3.integration.test.ts"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend test (1134/1134)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A check against a real S3 bucket (Block Public Access, owner-enforced ownership, the KMS key policy)"
    requirement: COLLAB-02
    human_judgment: true
    rationale: "Manual and the operator's by D-06; no real AWS endpoint is contacted in this plan. The README's deployment section is 14-17's."
duration: 48min
completed: 2026-10-10
status: complete
---

# Phase 14 Plan 04: Private Attachment Storage Summary

**Attachment bytes now go into private storage through one port, under a `csrm_` key, and come back identical, only through Strapi code. Locally the upload plugin's provider is replaced by a CSRM private provider writing outside `public/`; in production the official S3 provider is configured with no ACL, SSE-KMS and presigned server-side reads. The upload plugin's five public routes are unmounted for every caller, and no multipart temporary file outlives its request.**

PHASE_14_BASE=e50053f

## Performance

- **Duration:** about 48 min (2026-10-09 18:18 to 19:06 UTC), including one 17.7-minute full Strapi suite.
- **Completed:** 2026-10-10 (+11:00)
- **Tasks:** 3 of 3, each test first (RED commit, then GREEN commit). Task 1 is the tracer; its verify was re-run after GREEN and passed, so expansion went ahead.
- **Files:** 18 (1,267 lines added, 42 removed)

## Accomplishments

- **Storage port** (`storage-port.ts`):
  - `put(bytes, { type })` makes the key `csrm_` plus 32 hex characters from `randomUUID()` and the detected type's extension (`.jpg` for JPEG). It hands the buffer to the plugin's provider, then creates the `plugin::upload.file` record itself: `name` is the key, `size` is in KB, `provider` is the configured one, `folderPath` is `/`. If the record cannot be created, the stored bytes are deleted. It never calls the plugin's upload service.
  - `read(fileId)` loads the record (`STORAGE_FILE_MISSING`) and checks the key against `STORAGE_KEY_PATTERN` and the extension against the eight storage extensions (`STORAGE_KEY_INVALID`) before touching storage.
    - Local: it reads the file from the private directory.
    - S3: it gets `getSignedUrl(record)` and refuses a URL that is not http(s) with `X-Amz-Signature` (`STORAGE_URL_UNSIGNED`) before any request. It fetches with `redirect: "error"` and a 60 s timeout. It refuses a status other than 200, a declared length or a streamed body over 26,214,400 bytes (`STORAGE_READ_FAILED`). The URL never leaves the function, and nothing is logged.
  - `remove(fileId)` calls the provider's delete and deletes the record.
- **Private local provider** (`private-local-provider.ts`):
  - It provides `upload`, `uploadStream`, `replace`, `replaceStream`, `delete`, `isPrivate()` (true) and `getSignedUrl()` (the unrouted `/csrm-private/{key}`).
  - A key must be CSRM's form or the plugin's own (`[A-Za-z0-9][A-Za-z0-9_-]{0,199}`, so admin Media Library uploads and their formats still work). An extension must be a dot and up to 16 letters or digits. Anything else is refused before a path is joined.
- **Registration** (`register-attachment-storage.ts`), called in `register()` directly after `assertAttachmentConfiguration(strapi)`:
  - **local:** `strapi.plugin("upload").provider.extend(createPrivateLocalProvider(directory))`. The directory is the configured one, or `{appRoot}/.tmp/attachments` when attachments are unconfigured.
  - **aws-s3:** a `baseUrl` fails boot with "CSRM attachments refuse an upload baseUrl", and the URL is never echoed.
  - Both: the content-API router's `routes` is set to `[]`, and boot fails when that router is missing.
  - `attachmentUploadPluginConfig(process.env)` is spread into `upload.config` in `config/plugins.ts`. `allowedTypes` and `deniedTypes` are unchanged.
- **Cleanup middleware** (`csrm-multipart-cleanup.ts`, `'global::csrm-multipart-cleanup'` directly after `strapi::body`): in `finally`, every `filepath` (or `path`) under every key of `ctx.request.files`, arrays included, is unlinked and awaited, with errors swallowed.
- **Harness:**
  - Before boot it pins the development key, `CSRM_ATTACHMENT_STORAGE=local`, `CSRM_ATTACHMENT_LOCAL_DIR={appDir}/.tmp/authorization-http/attachments-{pid}` (removed on close) and `CSRM_ATTACHMENT_SCANNER=development`.
  - It clears every other attachment and AWS SDK variable, and restores all of them on close.
  - The new options are `attachmentStorage: { kind: "s3", endpoint, bucket, kmsKeyId }` and `attachmentScanner: { kind: "clamav", host, port, timeoutMs? }`.

## The admin upload route used in the test

`GET /upload/settings` (handler `admin-settings.getSettings`, policy `admin::isAuthenticatedAdmin`, from `@strapi/upload/dist/server/routes/admin.js`). Without an admin session it answers **401**, so the admin router is still mounted.

## Served-operations diff

`SERVED_OPERATIONS_WRITE=1 pnpm --dir apps/backend served-operations:write` (dev servers stopped), then a normal run passes. The diff is 5 insertions and 30 deletions:

- **`pluginRoutes`:** the five upload rows are removed (`POST /api/upload`, `GET /api/upload/files`, `DELETE /api/upload/files/:id`, `GET /api/upload/files/:id`, `GET /api/upload/files/page`).
- **`specOnly`:** the four documented upload operations (`upload/post`, `upload/get/files`, `upload/delete/files_by_id`, `upload/get/files_by_id`) keep their rows. Their reason now reads "the application unmounts the plugin's content-API routes (Phase 14 D-08), so attachment files are reached only through CSRM's own operations". The generator needed that reason, or it would have reported `SPEC_ONLY_WITHOUT_REASON`.
- **`generatedAt`** changed.

Nothing else changed. `grep '"path": "/api/upload' docs/references/served-operations.json` prints nothing.

## Task Commits

1. **Task 1 (tracer):** `e519eee` test (RED), `e9ea4e0` feat (GREEN)
2. **Task 2:** `4067b66` test (RED), `ee367d5` feat (GREEN)
3. **Task 3:** `4dc3b17` test (RED), `4e48d77` feat (GREEN)

`git rev-list --count 5aa6e1a..HEAD` is 6 before this summary's commit.

## Verification

- **RED evidence.** Each run used the TAP reporter, and `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` for each. The stubs were never committed.
  - Task 1: the run was against throwing stubs of `createAttachmentStorage` and `createPrivateLocalProvider`. Result: `# tests 14 / # pass 6 / # fail 8`, and all 8 new tests failed.
  - Task 2: `# tests 155 / # pass 146 / # fail 9`. The 9 were the completeness test, the five upload rows, the two new mounted tests and the served-operations test. The RED run also showed the risk the plan closes: `GET /api/upload/files` with the token listed the stored attachment's record.
  - Task 3: the run was against an `attachmentUploadPluginConfig` stub returning `{}`. Result: `# tests 16 / # pass 9 / # fail 7`. The S3 harness failed to boot with "configured for S3, but the upload plugin's provider is local".
- **GREEN, focused:**
  - Task 1 verify: `ℹ tests 14 / ℹ pass 14 / ℹ fail 0`. `git status --short -- apps/backend/public` is empty, and `git ls-files apps/backend/public/uploads` lists only `.gitkeep`.
  - Task 2 verify (http-hardening, served-operations, matrix provenance, matrix): `ℹ tests 155 / ℹ pass 155 / ℹ fail 0`.
  - Task 3 focused (unit and S3 integration): `ℹ tests 15 / ℹ pass 15 / ℹ fail 0`.
  - The two boot unit files with `attachment-config`: 53/53.
- **Full Strapi suite** (`pnpm --dir apps/backend test`, dev servers stopped): **`pass 1134 / fail 0`** (`ℹ tests 1134`, 1,059 s), run on the code committed in `4e48d77`.
- **Typecheck:** `tsc --noEmit` and `tsc -p tests/tsconfig.json` are clean.
- **Acceptance criteria:**
  - `storage-port.ts` never calls `service("upload")`.
  - `index.ts` calls `registerAttachmentStorage(strapi)` on the line after `assertAttachmentConfiguration(strapi)`.
  - `config/middlewares.ts` lists the cleanup entry right after the `strapi::body` object, with only a comment line between them.
  - `config/plugins.ts` contains `allowedTypes: allowedMediaTypes` and `attachmentUploadPluginConfig(`.
  - No file under `src/csrm/files/` contains `ACL: 'private'` or `ACL: "private"`.
- **EICAR guard:** `git grep -n -I "ANTIVIRUS-TEST" -- apps` prints nothing.
- **Temporary files:** after the full suite, no 777,777-byte file is left in `os.tmpdir()`. One was left by the Task 2 RED run (the `file` part sent to the still-mounted `/api/upload`), and I removed it.
- **No external service:** S3 was exercised only against `fake-object-store.ts` on 127.0.0.1, using dummy credentials with the metadata lookup disabled.

## Decisions Made

See the `key-decisions` frontmatter. Also:
- The S3 fake decodes `aws-chunked` framing when present. It answers a GET only with `X-Amz-Signature`, and records `x-amz-acl` and both SSE headers. The 2 MiB PDF arrived in one PUT, with no ACL header and `aws:kms` plus the key id.
- With an endpoint configured, the S3 provider prints a Node warning ("Encryption type 'aws:kms' is AWS S3-specific"). That is expected against a fake S3-compatible store, and production sets no endpoint.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] The plugin's file record cannot hold `sizeInBytes`.**
   - **Found during:** Task 1 GREEN. The mounted test read `NaN`.
   - **Issue:** `@strapi/upload@5.51.0`'s `file` content type has no `sizeInBytes` attribute. The plan's behaviour "`sizeInBytes` equal to the length" cannot hold.
   - **Fix:** the port stores the plugin's `size` in KB with two decimals, as `bytesToKbytes` does, and no longer sends `sizeInBytes` in the record data. The test asserts that `size`.
   - **Files modified:** `storage-port.ts`, `http-hardening.integration.test.ts`
   - **Commit:** `e9ea4e0`
2. **[Rule 2 - Security] `replace` and `replaceStream` on the private provider.** The stock local provider's replace writes into `public/uploads`, so a Media Library "replace file" would have made a file public. Both now write privately and remove the old key. (`e9ea4e0`)
3. **[Rule 2 - Correctness] `checkFileSize` is kept, not replaced by a no-op.** The plan listed a no-op `checkFileSize`. The port never calls it, so keeping the stock one only preserves the admin Media Library's size limit. (`e9ea4e0`)
4. **[Rule 2 - Security] Fail-closed registration.**
   - A provider that disagrees with `CSRM_ATTACHMENT_STORAGE` fails boot.
   - A provider other than `local` or `aws-s3` fails boot.
   - A missing content-API router fails boot. A silent no-op would have kept the public routes.
   - (`e9ea4e0`, `ee367d5`)
5. **[Rule 2 - Security] S3 read hardening beyond the plan.**
   - A non-http(s) URL is refused even when it carries the signature parameter.
   - The fetch has a 60 s timeout.
   - The body is bounded while streaming as well as by `content-length`.
   - (`4e48d77`)
6. **[Rule 3 - Blocking] The harness pins the development key before boot.**
   - **Issue:** the harness set `NODE_ENV` and `CSRM_ENVIRONMENT` only after boot, so the pinned development scanner would fail boot on a host whose `.env` lacks `CSRM_ENVIRONMENT=development`. The plan requires an outcome a `.env` cannot change.
   - **Commit:** `e519eee`
7. **[Rule 3 - Blocking] The S3 harness keeps dummy AWS credentials until close.**
   - **Issue:** the plan says "for the boot only", but the SDK resolves credentials lazily on the first request. Restoring them after boot would send the chain to the developer's profile or the instance metadata service.
   - **Fix:** the credentials are restored on close.
   - **Commit:** `4dc3b17`
8. **[Rule 3 - Blocking] Two existing register() fakes gained an upload plugin.** `ai-run-boot.unit.test.ts` and `keycloak-provisioning.unit.test.ts` call `register()` with hand-made Strapi objects. These now reach `registerAttachmentStorage`, so each fake gained `plugin: () => ({ provider: { extend }, routes: { "content-api": { routes: [] } } })`. The intent of both tests is unchanged. (`e9ea4e0`, `ee367d5`)
9. **[Rule 3 - Blocking] Files outside the plan's list.**
   - `authorization-matrix.integration.test.ts`: its completeness test required every plugin row to be in the inventory. It now excludes rows marked `unmounted: true` from that count and requires them to be absent.
   - `served-operations.integration.test.ts`: `specOnlyReason` gained the unmounted-upload reason.
   - (`4067b66`)
10. **[Rule 1 - Bug] The S3 test's `after` hook.** A failed boot left the fake store listening, which hung the RED run until I ended that child process. The hook now closes the store in a `finally`. (`4dc3b17`)
11. **[Verify format]** node:test here prints the spec reporter (`ℹ tests N`, `ℹ pass N`, `ℹ fail N`), not TAP's `# pass`. RED runs used `--test-reporter=tap`, so the evidence checker could parse them. Counts are reported in the brief's form.

**Total deviations:** 10 auto-fixed (2 Rule 1, 4 Rule 2, 4 Rule 3) and 1 format note. **Impact:** none on scope. Every change makes storage more private, or keeps an existing test booting.

## Issues Encountered

- The shell in this environment rejected one Python heredoc that held backslash and quote sequences. I made that edit with the Edit tool instead.
- `lib` is `ES2020`, so `String.prototype.replaceAll` is untyped. The key uses `.replace(/-/g, "")`.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register:
- Strapi to the object store (T-14-15) is the planned boundary.
- The cleanup middleware is the planned T-14-16 mitigation.
- No route was added, and five were removed (T-14-13).

## User Setup Required

None for development. A deployment that sets `CSRM_ATTACHMENT_STORAGE=s3` needs a bucket with Block Public Access, owner-enforced object ownership and a KMS key whose policy admits Strapi's role. 14-17 writes the README's deployment section, and a check against a real bucket is the operator's (D-06).

## Next Phase Readiness

- 14-06 can store a screened file with `createAttachmentStorage(strapi).put(bytes, { type })` and keep `fileId` on the attachment record. Reads go through `read(fileId)` and the late-refusal path through `remove(fileId)`. An `AttachmentStorageError` code maps to `ATTACHMENT_UNAVAILABLE`.
- Mounted tests can use `harness.attachmentStorage()`, `attachmentStorageDirectory()`, and the `attachmentScanner` and `attachmentStorage` options (with `startFakeClamd` and `startFakeObjectStore`).
- Playwright's Strapi `webServer.env` does not pin the attachment settings yet. That is 14-12's harness pin (`CSRM_ATTACHMENT_SCANNER: 'development'` in `playwright.config.ts`).
- `docs/security/strapi-http-hardening.md` does not yet record the cleanup middleware or the narrowed R-08-02. The plan's file list leaves this to the phase's documentation plan.

## Self-Check: PASSED

- FOUND: the seven created files and the eleven modified files listed in `key-files`.
- FOUND: `e519eee`, `e9ea4e0`, `4067b66`, `ee367d5`, `4dc3b17`, `4e48d77`.

---
*Phase: 14-request-attachments*
*Completed: 2026-10-10*
