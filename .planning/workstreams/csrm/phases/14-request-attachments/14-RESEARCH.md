# Phase 14: Request attachments - Research

**Researched:** 2026-10-01
**Domain:** private file storage through the Strapi 5.51 upload plugin (a private local provider and the official S3 provider), content checks by signature and OOXML structure, a pluggable malware scanner (`clamd` INSTREAM and a development double), quarantine, authorised binary downloads through a Next 16.3 Server Action, multipart uploads under a path-scoped body limit, and bounded text extraction (PDF, DOCX, XLSX, PPTX, CSV, TXT) into Phase 12's AI context.
**Confidence:** HIGH for the six research questions. Each was settled from source read this session (Strapi 5.51.0, `@strapi/provider-upload-aws-s3` 5.51.0, Next 16.3.6, React Flight, `unpdf` 1.8.1, `read-excel-file` 9.3.10), from official ClamAV and AWS documentation, or from a probe on Node 24.19.0 in the scratchpad. MEDIUM for the OOXML content-type strings and the CFB `EncryptedPackage` marker (no Office here; proven by fixtures in the plans). LOW (ASSUMED) where marked.

## Summary

Phase 14 adds one content type, six operations, a private storage path and a scanning pipeline. The locked decisions (D-01 to D-40) already fix the behaviour. This research settles the technical choices the context left open, and it found five facts in the installed code that change how the plans must be written:

1. **Next's proxy silently truncates large bodies.** `apps/csrm/proxy.ts` matches every page path, so every Server Action POST runs through it. Next clones the body for the proxy with a 10 MB default limit (`DEFAULT_BODY_CLONE_SIZE_LIMIT = 10 * 1024 * 1024`), and above it the request body handed on to the action is cut short without an error (`body-streams.js:95-106`; the bundled `proxyClientMaxBodySize.md`: "The request will **not** fail"). Raising `serverActions.bodySizeLimit` alone would break every upload over 10 MB. The plan must raise `experimental.proxyClientMaxBodySize` with it.
2. **Strapi cleans only the multipart part named `files`.** `strapi::body` removes temporary files only from `ctx.request.files.files` (`body.js:23`, `:59-68`). The attachment part is `file` (D-04), as is the CSV import's, which leaks today. Route middlewares run after policies (`compose-endpoint.js:64-72`), so a refused caller would also leave files behind. One global cleanup middleware after `strapi::body` fixes both.
3. **The upload plugin's upload service rewrites images and names keys after the upload.** `enhanceAndValidateFile` optimises images through `sharp` (`upload.js:145-153`), image uploads gain derived formats (`:303`), and `generateFileName(basename)` builds the key from the uploaded name (`:103`). D-06 and D-07 both forbid this. CSRM therefore calls the provider and creates the plugin's file record directly.
4. **The S3 provider defaults to `public-read`.** When `params` has no `ACL` key, it sets `ACL = public_read` (`index.js:130-131`). Sending `ACL: 'private'` fails on AWS's default "Bucket owner enforced" buckets (AWS: "`PUT` requests that contain other ACLs … fail and return a `400` error with the error code `AccessControlListNotSupported`"). The configuration must carry an `ACL` key whose value is `undefined`.
5. **The upload plugin lower-cases a provider module path and resolves it from its own folder** (`register.js:55-62`). A path-configured private provider would therefore break on a case-sensitive filesystem. CSRM instead installs the private local provider by overriding the plugin's provider object in the application's `register()`, which runs after the plugins' (`Strapi.js:328-329`).

**The six questions, settled:**

| Question | Answer | Evidence |
|---|---|---|
| 25 MiB download as a Server Action return | **It works.** No Route Handler is needed and no deviation is recorded | Probe on Node 24.19.0 with Next 16.3.6's bundled Flight: a 26,214,400-byte `Uint8Array` serialised to a 26,214,501-byte payload in 47 ms (server peak RSS 75 MB), and the browser client build decoded it intact in 37 ms, with about 87 MB RSS growth including the `Blob` copy |
| Private local in development, private S3 in production, plugin routes unmounted | Override the plugin's provider in `register()` with a CSRM private local provider (`.tmp/attachments`); configure `@strapi/provider-upload-aws-s3@5.51.0` with `ACL: undefined`, SSE-KMS and `signedUrlExpires: 60`; read S3 through a server-side presigned GET; set the upload plugin's content-API router's `routes` to `[]` (the factory's setter) | `register.js`, `Strapi.js`, `content-api-router.js:21-27`, the S3 provider source, AWS Object Ownership docs |
| Text extraction libraries | **`unpdf` 1.8.1** (MIT, zero dependencies, bundles pdf.js `6.1.200`, 2.1 MB) for PDF; **`read-excel-file` 9.3.10** (Phase 19's reader, shared) for XLSX; a **CSRM ZIP reader over `node:zlib`** plus a small OOXML text scanner for DOCX and PPTX. Extraction runs in a worker thread | npm registry, tarballs read, probe: a 25.7 MB, 4,200-page PDF extracted in 6.6 s with 348 MB worker heap |
| Content sniffing | **Dependency-free.** `file-type` is not added: it is ESM-only, and Strapi's own code notes that it "often returns application/zip for Office formats" | `mime-validation.js:36-40`, `:182`; ASVS V5.2.2 |
| ClamAV limits and the scanner port | Current defaults are `StreamMaxLength 100M`, `MaxFileSize 100M`, `MaxScanSize 400M`; ClamAV 0.103 shipped `25M`, `25M`, `100M`. Require all three ≥ 30M (MaxScanSize ≥ 256M) and `AlertExceedsMax yes`. The development double builds EICAR from fragments, so no file on disk (source or compiled) contains it | `clamd.conf.sample` (main and `rel/0.103`), the ClamD protocol page |
| The raised body limit, upload routes only | `bodySizeLimit` and `proxyClientMaxBodySize` both `'26mb'` (27,262,976 bytes), plus a `proxy.ts` gate that answers 413 to any Server Action POST over 6 MiB, or without a `Content-Length`, outside the attachment pages. Strapi needs no change: formidable already admits 50 MiB per file | Next config schema, `action-handler.js:518-519`, `bytes` probe |

**Primary recommendation:** Build the attachment pipeline as deep Strapi modules under `apps/backend/src/csrm/files/`, plus the shared event log (`csrm/audit/security-event-log.ts`) and XLSX reader (`csrm/spreadsheets/xlsx-reader.ts`) at the paths Phase 19's research names. The files modules are storage port, ZIP reader, content check, scanner port, quarantine and extraction worker. Add exactly `unpdf@1.8.1`, `read-excel-file@9.3.10` and `@strapi/provider-upload-aws-s3@5.51.0` (pinned, Strapi only). Return download bytes from a Server Action as `Uint8Array`. Raise both Next body limits to `'26mb'` behind a `proxy.ts` gate.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Scope and contract boundary

- **D-01:** The only content-type change is one new content type, `CsrmRequestAttachment`, through `docs/contract-gaps/phase-14-request-attachments.md`, approved at a checkpoint before any schema file changes (G-6; see Contract-Gap Record below). One record holds one file attached to one request:

  | Group | Facts (names are proposals in JDL style; the record fixes them) |
  |---|---|
  | Where | `assessmentRequest` (many-to-one `CsrmAssessmentRequest`, required); `note` (many-to-one `CsrmRequestNote`, optional, set only at upload, D-17) |
  | The stored file | `file`: one single `media` attribute holding the upload plugin's file record, stored by the private provider (D-06) |
  | What | `fileName` (the sanitised original name, D-10), `fileType` (closed: `pdf`, `docx`, `xlsx`, `pptx`, `csv`, `txt`, `png`, `jpeg`), `byteSize`, `sha256` |
  | Who and when | `uploadedBy` (many-to-one `IdamBoxUser`), `uploaderPart` (`requestor` or `security-analyst`, fixed at upload, as Phase 13's `authorPart`), `uploadedAt` (server-owned) |
  | Scan | `scanStatus` (`pending`, `clean` or `blocked`), `scanCheckedAt`, `scanEngine` (adapter and signature version where the engine reports it), `scanAttempts` |
  | Removal | `removedAt` and `removedBy` (current facts; cleared on restore) |
  | AI | `aiTextIncluded` (boolean, default false), `aiText` (private; the capped extracted text, held only while included), `aiTextFacts` (characters available, characters kept, truncated, extractor version, extracted at) |
  | History | `eventLog`: append-only, schema-versioned events (uploaded, quarantined, scan verdict, blocked, removed, restored, AI included, AI excluded) |

  Nothing else in the schema changes: no media field on `CsrmAssessmentRequest`, no change to Phase 13's `CsrmRequestNote` (the link lives on the attachment), and no extension of the upload plugin's file type. The content type gets no Strapi core router: it is reachable only through the operations in D-04, and the inventory and the matrix prove that no core route exists for it (Phase 13 D-02). **Reversibility:** one-way - a new table holding audit facts, with stored objects behind it; undoing it needs a data migration.
- **D-02:** Why a CSRM entity, not a media relation on the request:
  - a media field (Strapi's polymorphic file link) holds no IdamBox uploader, part, scan state, quarantine, removal, AI inclusion or history, and the plugin's file record names a Strapi admin user as its creator, not an IdamBox User;
  - extending the plugin's file type would bend the admin Media Library's schema and every plugin upgrade;
  - the JDL has no attachment entity (catalogue design note 6; UAT-012's evidence), so this is a recorded concept that competes with no JDL entity (brief §20), as G-15 already assumes ("like Phase 13's note and Phase 14's attachment").
  The name is request-scoped, like `CsrmRequestNote`. Phase 20's evidence files reuse the pipeline, not this entity (seams).
- **D-03:** Every new or changed endpoint follows the established chain (Phase 12 D-02, Phase 13 D-02): exact Role → Function → FunctionAPI grants in both catalogue copies, byte-identical; record-level checks in Strapi against the resolved IdamBox User (`ctx.state` after the identity middlewares), never branching on the auth mode; the operation and schemas in `docs/references/specification.json`, then `api:generate` and a clean `api:check`; closed parsers, and the file-response mode for the download (D-24), registered in the contract parity guard; a row per operation in the six-actor authorization matrix; `docs/references/served-operations.json` regenerated with the dev servers stopped. The server shape and its web parser change in the same plan (the 06.9 lesson).
- **D-04:** The API changes are these, and no others (the planner names paths and parameters within this family):
  1. **List:** `GET /api/v1/assessment_requests/{requestId}/attachments`: every attachment of the request, bounded by the lifetime bound (D-10), with each file's state and the actions the server says this viewer may take; analysts also get the AI facts (D-30).
  2. **Upload:** `POST /api/v1/assessment_requests/{requestId}/attachments`: multipart with exactly one `file` part and an optional `noteId`; any other part is a 400 (D-17).
  3. **Download:** `GET /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content`: the file's bytes (D-23), the published contract's first binary response.
  4. **Remove and restore:** `PUT /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal` with `{ removed: true }` or `{ removed: false }` (D-20). This is the ROADMAP's "delete": removal is soft.
  5. **AI inclusion:** `PUT /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input` with `{ included }` (D-30, D-31).
  6. **AI text preview:** `GET /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text`: the stored text an included file sends (D-31).
  7. **The request read** gains the viewer's attachment summary: the count, whether this viewer may add a file now (with the closed reason when not), whether a note is needed (D-17), the limits and the allowed types.
  8. **The analyst questionnaire and assessment reads:** Phase 13's notes summary and AI-inputs signal gain the files (D-27, D-36).
  9. **The AI run read's** context summary gains the attachments section (D-35).
  10. **Closed refusal reasons** join Phase 10's list (`apps/backend/src/csrm/conflict-reasons.ts` and its web mirror; D-11, D-16, D-17, D-19, D-20, D-23, D-30, D-31).
  11. **One refusal on an existing operation:** deleting a request that holds an attachment, removed ones included (the analyst-only, API-only core delete), is refused with `REQUEST_HAS_ATTACHMENTS`, beside Phase 13 D-21's `REQUEST_HAS_NOTES`.
  12. **The upload plugin's content-API routes are unmounted** (D-08).

  The review queue, My requests, both Homes and quick find do not change. **Reversibility:** costly - published operations, a binary response, fields and error codes.
- **D-05:** People are server projections (Phase 13 D-04): the uploader and the remover are `documentId` and `displayName` only, never email, username, external subject or roles. No caller `populate` reaches the media relation or a user relation, and the plugin's file record (its hash, provider metadata and any URL) never leaves Strapi.

#### Storage (decision 2, G-7)

- **D-06:** Private storage through the upload plugin, behind one storage port in Strapi (put, read, delete) so the download, the extraction and Phase 20 never touch provider specifics:
  - **Development and tests:** a private local provider writes to a configured directory outside `public/` (default under the ignored `apps/backend/.tmp/`; each harness pins its own temporary directory, D-15). `strapi::public` never serves it, and a test proves that no attachment byte is reachable under `/uploads/`. The plugin loads a provider by module path when no `@strapi/provider-upload-*` package matches (`dist/server/register.js`), so research decides how the provider module is wired inside `apps/backend`.
  - **Production:** the official `@strapi/provider-upload-aws-s3`, pinned to the Strapi version (G-7 names it), configured private: no public ACL, server-side encryption with a configured KMS key, and the Sydney region by default. The bucket's public access block, versioning and lifecycle rules are deployment configuration (G-7), documented in `apps/backend/README.md`. Its read path is proven against a fake object store in the Strapi tests; a check against a real bucket is manual and the operator's.
  - **No URL leaves Strapi:** where a private provider reads through a signed URL, Strapi uses it server-side only, with a short expiry, and never returns it.
  - **Keys:** the stored object's key is the plugin's generated hash plus the detected type's extension, never the uploaded name.
  - **Consequence:** the upload plugin has one provider, so the admin Media Library becomes private too; nothing in CSRM relies on public media.

  **Reversibility:** costly - stored objects and the operator's storage configuration.
- **D-07:** Files are stored byte for byte. Attachments get no derived formats (thumbnails, responsive sizes, size optimisation or auto-orientation), so the stored bytes are the scanned bytes and match the recorded digest. Research decides how: the plugin's settings at bootstrap, or the provider and the plugin's file record called directly. R-08-39 (the `sharp` override across `@strapi/upload`'s pin) therefore stays unexercised for attachments by design, and the residual register says so.
- **D-08:** The upload plugin's own content-API routes are unmounted: `POST /api/upload`, `GET /api/upload/files`, `GET /api/upload/files/page`, `GET /api/upload/files/:id` and `DELETE /api/upload/files/:id`. Once private files live in the plugin, those routes would let the full-access token holder list their metadata, upload unscanned files into the store, or hard-delete them (R-08-02).
  - The admin panel's own upload routes are unaffected; research verifies.
  - The matrix's five upload rows become unmounted-path assertions under the recorded convention (`strapi-http-hardening.md`, "Unmounted paths"); that document and the residual register record the change, and R-08-02 narrows.
  - Strapi administrators still see attachment files in the admin Media Library. That is privileged operator access outside CSRM's role model, as for every record in the Content Manager. It is recorded as a residual, with the recommendation that Media Library rights stay with super admins; a Media Library delete leaves the attachment showing "File unavailable".

#### Types, limits and refusals (decision 2; COLLAB-02 criteria 1 and 2)

- **D-09:** The allow-list is checked by content and extension together. A file is accepted only when both name the same allowed type:

  | Type | Extension | Content check | Refused variants (each with its own reason) |
  |---|---|---|---|
  | PDF | `.pdf` | `%PDF-` header, and the document opens | password-protected: it cannot be scanned or read |
  | DOCX | `.docx` | a ZIP whose `[Content_Types].xml` declares the WordprocessingML main part | macro-enabled (a macro main part or `vbaProject.bin`), encrypted (an OLE container), the old `.doc` |
  | XLSX | `.xlsx` | the SpreadsheetML main part | `.xlsm`, encrypted, the old `.xls` |
  | PPTX | `.pptx` | the PresentationML main part | `.pptm`, encrypted, the old `.ppt` |
  | CSV | `.csv` | text | binary content |
  | TXT | `.txt` | text | binary content |
  | PNG | `.png` | the PNG signature | |
  | JPEG | `.jpg`, `.jpeg` | the JPEG signature | |

  - **Text** means UTF-8 with or without a byte-order mark, or UTF-16 with one; no NUL bytes outside UTF-16 and no binary signature.
  - **Extensions** match case-insensitively.
  - **Sniffing:** `file-type` becomes a direct dependency at the version `@strapi/upload` already pulls in, so no new code enters the tree; CSRM adds its own OOXML and text checks with the ZIP reader that extraction uses (D-32). Research confirms this or proposes a dependency-free sniff.
  - **The plugin's `security.allowedTypes`** stays as the admin Media Library's second layer; CSRM's check runs first and is the authority.

  Basis: OWASP file upload guidance and decision 2 ("checked by content signature and extension"); ASD ISM: content is scanned before it is accessed, so files that cannot be scanned (password-protected or encrypted) are refused.
- **D-10:** The limits, held in one attachment policy module (decision 2 fixes them, so no setting exposes them):
  - **Size:** at most 26,214,400 bytes (25 MiB) per file, labelled "25 MB"; an empty file is refused.
  - **Count:** at most 20 active files per request; active means available or awaiting the scan, so removed and blocked files do not count.
  - **Lifetime bound:** a bound on stored files per request, removed ones included, that research sets (proposed 60), so soft removal cannot grow storage without limit.
  - **Names:** the path is stripped, control and bidirectional-override characters (the RLO spoofing trick) are removed, the name is trimmed to at most 255 characters with its extension kept, and it is never used as a storage key. The name is displayed escaped like any text.
  - **Concurrency:** the count check, the window (D-16) and the note check (D-17) run in a section serialised per request (Phase 13 D-09's lock and in-process tail), so two simultaneous uploads at 19 cannot make 21. Bytes stored before a late refusal are deleted.
- **D-11:** Refusals are closed reasons with fix-it copy (Phase 10 D-22; the UI-SPEC writes the words):
  - not an allowed type (names the allowed list);
  - content does not match the name;
  - macro-enabled ("save it as .docx"), password-protected or encrypted ("remove the password and upload it again"), an old Office format ("save it as .docx, .xlsx or .pptx");
  - too large (names 25 MB), empty;
  - the request's file limit is reached ("remove a file to add another"), or the lifetime bound;
  - malware found: names the detection and tells the person to contact their IT service desk, because their own device may be affected;
  - attachments unavailable because storage or scanning is not configured (D-15);
  - the window and part refusals of D-16, D-17 and D-19.

  The web checks the extension and the size before sending, for fast feedback; Strapi is authoritative. Nothing of a refused file is stored, formidable's temporary file is always deleted, and every refusal is a security event line (D-37).

#### Malware scanning and quarantine (decision 2, G-7)

- **D-12:** A scanner port with two adapters:
  - **The development double:** deterministic; it flags the EICAR test string and a harmless CSRM test signature (D-14). It is allowed only in development (`NODE_ENV` and `CSRM_ENVIRONMENT` both `development`, the double key of `development-identity-enabled.ts` and Phase 12 D-27) and in the test harnesses; configured anywhere else, it fails boot, because a test double must never guard production.
  - **The ClamAV adapter:** `clamd`'s INSTREAM protocol over TCP with Node's own `net` (no dependency), with connect and scan timeouts. It is tested against a fake `clamd` server in the Strapi tests, as the AI adapters are tested against the fake OpenAI-compatible server. Running `clamd` with `freshclam` is deployment work (G-7), and nothing is installed on the build host.
  - **Deployment requirements,** recorded in the contract-gap record and `apps/backend/README.md`: `clamd`'s stream and file-size limits (`StreamMaxLength`, `MaxFileSize`, `MaxScanSize`) sit above 25 MiB, whatever the deployed version's defaults (research checks them, because some releases' defaults sit at or near 25 MB), and `AlertExceedsMax` is on, so a file the engine skips is never reported clean. The adapter treats a size-limit reply or a limits-exceeded heuristic as "not clean": the file stays quarantined and an error is logged.
- **D-13:** The scan runs inside the upload request, before the file is made available:
  - **Clean:** stored and available at once.
  - **Infected:** refused (D-11); the bytes are discarded and nothing is stored; a security event at warning level (D-37).
  - **Scanner unavailable or timed out:** fail closed (G-7). The file is stored in quarantine (`pending`): it cannot be downloaded, extracted or included, and the response says it is waiting for the malware check. An in-process re-scan retries with backoff and on every Strapi start (a single process, R-08-36); a clean verdict releases it, and an infected one makes it blocked (D-21).
  - **Every verdict** records the engine identity and the time, and appends to the event log.
  - **No polling** (Phase 11 D-11): a released or blocked file shows its new state on the next read.
- **D-14:** Automated suites never write the EICAR string to disk: the build host's real-time antivirus would quarantine formidable's temporary file mid-test and make the suites flaky. They use the CSRM test signature instead. One unit test builds the EICAR string in memory to prove that the double flags it. The quarantine and blocked paths are proven in the Strapi integration tests through the fake `clamd` server, which the test makes unavailable and then answers clean or infected, so production code carries no test-only scanner mode.

#### Configuration and environments (G-7; new settings in the `.example` files)

- **D-15:** One attachment configuration module reads these settings (names are proposals):
  - **Storage:** `CSRM_ATTACHMENT_STORAGE` (`local` or `s3`), `CSRM_ATTACHMENT_LOCAL_DIR`, and the S3 block (bucket, region defaulting to `ap-southeast-2`, KMS key, an endpoint for S3-compatible stores; credentials from the environment's standard provider chain, never committed).
  - **Scanner:** `CSRM_ATTACHMENT_SCANNER` (`development` or `clamav`), `CSRM_CLAMAV_HOST`, `CSRM_CLAMAV_PORT` and `CSRM_CLAMAV_TIMEOUT_MS`.

  The rules (Phase 12 D-27's pattern):
  - **Development** (the double key) defaults to `local` and `development`.
  - **Everywhere else,** an unset storage or scanner means attachments are unavailable: uploads are refused with `ATTACHMENTS_NOT_CONFIGURED`, the request read says so, and the UI offers no upload (UX-06). The rest of the application runs, because failing boot would take the whole product down for one feature.
  - **An invalid value,** an incomplete S3 or ClamAV block, or the development double outside development fails boot with a clear message.
  - **The `.example` file** (`apps/backend/.env.example`) gains the settings with safe defaults and commented production blocks.
  - **Both harnesses** (the Strapi test harness and Playwright's Strapi server) pin their own temporary storage directory and the development scanner, so a developer's `.env` cannot change an outcome and a run leaves the tree clean (Phase 8 D-12, G-6).

  **Reversibility:** costly - a configuration contract for operators.

#### When files are added, and notes give them context (COLLAB-02 criterion 1; Phase 13 D-22)

- **D-16:** The window, held in one predicate (`acceptsAttachments`) built on Phase 13's `acceptsNotes`:
  - **At intake:** while the request is a draft (never submitted, or returned to draft), its requestor adds files directly: on the new-request form and on the draft. Other analysts do not add, remove or include files on a draft, because they do not work on drafts (Phase 13 D-08 and D-22): `REQUEST_NOT_SUBMITTED`. A requesting analyst is the requestor of their own draft (D-19).
  - **After submission:** from submission until release or closure (exactly `acceptsNotes`: `submitted`, `questionnaire-in-progress`, `risk-assessment-drafted` and `under-review`, plus any status Phases 17 and 17.1 add before closure), the requestor and any human Security Analyst add files, each posted with a note (D-17).
  - **Released and closed** (`approved`, and `closed` from Phase 17.1, G-13): read-only. No add, remove, restore or AI change (`ATTACHMENTS_CLOSED`), because the released record is immutable (decision 9). Information after release belongs to Phase 20's treatment evidence.
  - The request's own create, update and submit operations do not change: files go through their own operation.
- **D-17:** Notes give files their context (the ROADMAP's "Depends on: Phase 13"; Phase 13's seam). After submission every file is posted with a note:
  - **The flow:** the person writes a note and adds files in Phase 13's composer. Posting creates the note first through Phase 13's operation, unchanged, then uploads each file with that note's id.
  - **The rule:** Strapi accepts a note id only for the caller's own note on the same request, within a short window after it was posted that research sets (proposed 60 minutes). The composer can therefore finish and retry its uploads, but nobody can slip a file into an old note that the other party has already read.
  - **Telling the other party:** the note carries Phase 13's unread flag, so the other party is told and knows what the files are, with no second read state (Phase 13 D-24 is unchanged). Phase 17's "new notes" notification covers them the same way (decision 18).
  - **Both directions:** the note lists its files, and each file links back to its note.
  - **Refusals:** a file after submission without a note id is refused (`ATTACHMENT_NOTE_REQUIRED`); someone else's note, a note on another request or one past its window is refused (`ATTACHMENT_NOTE_INVALID`); on a draft, a note id is refused, because drafts take no notes.

  Basis: every file added mid-assessment carries its reason, the other line is told, and the third line can see why each file arrived (ISO/IEC 27005 context establishment, communication and consultation). **Reversibility:** costly - a published rule and the composer's flow.

#### Who reads, adds and removes (COLLAB-02 criterion 3; G-12; Phase 13 D-23)

- **D-18:** The readers are Phase 13's notes readers: the request's requestor and any human Security Analyst.
  - **One rule for both:** notes and attachments use the same predicate (Phase 13 D-23's `canUseRequestNotes`, called by both or renamed for both), so the two can never drift, and Phase 17's participant read of the request summary never reaches either. This keeps G-12 and ASSESS-22 criterion 3: a risk owner or executive approver who is not the requestor reads the summary, but not the questionnaire, the notes or the attachments.
  - **Everyone else gets the refusal a missing record gets** (404) at every attachment route, with persistence unchanged: another Requestor, a participant who is not the requestor, the service agent on a request it did not raise, anyone naming a missing request, and any attachment id that does not belong to the request in the path (no cross-request reach).
  - **The web** shows the request's existing permission or not-found state, and no file, name or count of the request appears anywhere for another Requestor.
- **D-19:** Who acts:
  - **Add:** D-16 and D-17. The requestor adds at intake and after submission; a human analyst adds after submission.
  - **Download:** any reader, for a file that is clean and not removed (D-23).
  - **Remove:** the uploader removes their own files while the window is open (D-16); any human Security Analyst removes any file from submission until release or closure. A Requestor removing someone else's file is refused (`NOT_UPLOADER`).
  - **Restore:** only the person who removed the file, while the window is open.
  - **AI inclusion and the text preview:** a human Security Analyst only (D-30).
  - **G-1:** on a request they raised, an analyst is its Requestor for everything here (Phase 13 D-07). They add in the requestor part, remove only their own files, and cannot change or preview any file's AI inclusion (`OWN_REQUEST`).
  - **The service agent:** no attachment Function is granted to its role, and its Requestor birthright reaches only requests it raised.

#### Removal, blocked files and retention (COLLAB-02 criterion 4; decision 2)

- **D-20:** Removal is soft and recorded (decision 2; decision 6's spirit: nothing persisted is hard-deleted):
  - removal records who and when, takes the file out of the list's main section and out of downloads, and ends its AI inclusion (logged, and its stored text deleted);
  - removed files stay listed for every reader in a collapsed "Removed files" section, with who added and who removed each and when;
  - an Undo toast restores the file (G-4; X-14), recorded as an event; restoring does not re-include it in the AI context;
  - the bytes are kept, so the record stays complete and an AI run that used a removed file still resolves it;
  - no confirmation dialog and no reason are asked, because removal is reversible (G-4).
- **D-21:** Blocked files (malware found by a re-scan, D-13): the bytes and the plugin's file record are deleted, and the attachment record keeps its name, digest, uploader and verdict. Readers see it as blocked; it cannot be downloaded, extracted, included or restored, and it can be removed from the list like any file. A blocked verdict is a warning-level security event.
- **D-22:** Retention follows the assessment record (decision 2): files are kept for the retention period after the request's closure, 7 years by default, and soft removal never shortens it.
  - **No disposal job:** this phase builds none, because no record can reach the period for years and the assessment record itself has no disposal yet. Legal hold, disposal and purge on request are deferred.
  - **One configuration point** holds the period in the attachment policy module, as the seam for the Admin setting decision 2 promises. No phase names that setting yet (Phase 22's entry lists the AI data policy, not retention), so it is flagged for the orchestrator.
  - **In production** the bucket's lifecycle rules enforce retention (G-7).

#### Downloads and how files reach the browser (decision 2; Phase 19 D-19)

- **D-23:** One authorised download operation per file, through Strapi only:
  - **Only** a clean, unremoved file of a request the caller may read (D-18). A reader asking for a quarantined, blocked or removed file gets a 409 with its closed reason (`ATTACHMENT_QUARANTINED`, `ATTACHMENT_BLOCKED` or `ATTACHMENT_REMOVED`), because they can see the entry; everyone else gets 404.
  - **Integrity:** Strapi reads the stored bytes through the storage port and checks them against the recorded SHA-256 before sending any. A mismatch is refused (`ATTACHMENT_INTEGRITY_FAILED`) and is a warning-level security event: tamper evidence for the record.
  - **Headers** (Phase 19 D-10): `Content-Disposition: attachment` with an ASCII `filename` and an RFC 5987 `filename*`, the recorded type's media type, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, and a sandboxing `Content-Security-Policy`.
  - **Logging:** each download is a security event line (D-37).
- **D-24:** Downloads use Phase 19's file-transfer pattern (19 D-19), which this phase builds first because it executes first:
  - a typed service function calls the operation through openapi-fetch with a binary parse;
  - a Server Action returns `{ fileName, contentType, bytes }` or a closed refusal;
  - a shared file-response validator checks the content type against the attachment's recorded type, the file name against a safe pattern, the size against the bound and the content signature (`%PDF`, PNG, JPEG, `PK`, or text);
  - a small client helper saves the bytes through a Blob and an anchor;
  - the contract parity guard gains its file-response mode with this operation;
  - no Route Handler and no raw `fetch` (AGENTS.md: no frontend API facade).

  These modules live in one shared place (for example `apps/csrm/src/lib/files/`), so Phase 19's exports reuse them unchanged. Research verifies the Server Action's binary return (React 19 Flight's typed arrays) at 25 MiB, measuring time and memory on the web server and in the browser. If it fails there, the plan stops at a checkpoint for the orchestrator's decision rather than adding a Route Handler. This settles the alignment 19-DISCUSSION-LOG §15 left open.
- **D-25:** Uploads also go through the typed API layer, with one Server Action per file: the administration import's pattern of FormData to a Server Action, then openapi-fetch multipart to Strapi (`administration-actions.ts`, `administration-service.ts`).
  - Next.js's Server Action body limit (6 MB today) rises to fit one 25 MiB file with its multipart overhead.
  - That limit is global, so research measures the exposure, and the plan keeps the 6 MB ceiling everywhere else with a path-scoped check in `proxy.ts`: only Server Action posts to the pages that add attachments may exceed it. The residual is recorded for the deployment's reverse proxy (R-08-04).
  - Strapi's multipart limit (50 MiB per file) already admits 25 MiB. The attachment route enforces its own bound and always deletes formidable's temporary file.

#### The upload experience and its surfaces (G-4)

- **D-26:** Per-file progress, and no lost input:
  - **One at a time:** files upload one by one, each in its own Server Action (Next.js dispatches actions one at a time per client), so one file's failure never stops or loses the others.
  - **Stages:** each file shows its stage: Waiting, Adding, Added, Waiting for the malware check, or Refused with its reason. An overall line counts the files added out of the total. Adding is indeterminate, because Server Actions report no byte progress, and no Route Handler is added to get it.
  - **Recovery:** a refused file stays listed with its reason and its next step (remove it, or choose another file). A transfer failure offers Retry with the same file, without choosing it again.
  - **The navigation guard** (Phase 10 D-12) warns while any file is waiting or being added, and while the form or the composer holds unsent input.
  - **On the new-request form,** files are chosen with the form. The first Save draft creates the draft, then uploads the files, and the page moves to the draft only once every file is added or settled. A refused file stays listed with its choices, and saving again never creates a second request (`createRequestAction` stops redirecting while files are queued; the planner shapes it).
- **D-27:** Surfaces:
  - **the new-request form and the draft** (its edit form and its request page): files added directly;
  - **both request pages** (the Requestor's `app/(app)/app/requests/[documentId]` and the analyst's `app/(app)/app/review/requests/[documentId]`): the Files panel (D-28);
  - **Phase 13's note thread:** each note shows its files, and the composer adds them; after submission, the Files panel's "Add files" opens the composer with the chosen files attached;
  - **the analyst questionnaire and assessment pages:** Phase 13's server-rendered notes summary gains the file count, the number of files included in the AI context and the changes since the last generation, linking to the Files panel. The assessment editor's route budget is untouched (R-08-34);
  - **Phase 12's "What the AI used" sheet:** an Attachments group (D-35).
- **D-28:** The Files panel:
  - **Each file shows** its type, name, size, who added it (name and part), when (local time, X-3), the note it came with, its state, and its actions: Download; Remove; Restore for the remover; and, for analysts, the AI inclusion control with its reason when unavailable (D-30).
  - **Removed files** are collapsed, with who and when; blocked files show their verdict.
  - **States:** a skeleton while loading, and empty states that say what to do next (at intake, after submission, and read-only once released or closed).
  - **Phones:** cards, with actions in a sheet.
  - **Transparency:** the Requestor's panel says that a Security Analyst may include a file's text in what the AI assistance uses, within the organisation's data policy (G-3; Phase 13 D-25's wording for notes). The Requestor sees no per-file AI state.
  - **No inline preview:** files only download (decision 2's attachment disposition); previews are deferred.
- **D-29:** Interface values come only from `docs/design/csrm-design-direction.md`.
  - **Reuse:** X-3 (local times), X-13 (side sheet: the text preview, phone actions), X-14 (Undo toast), and Phase 13's notes-thread extensions once its UI-SPEC numbers them.
  - **New patterns:** the UI-SPEC proposes the file field and its drop zone (a "Choose files" button is always the primary path, never drag alone), the upload queue with per-file stages, the file row and its chip on a note, and the attachment states as values in the one status mapping (`status-badge.tsx` `statusPresentation`). Each is numbered from the first free X-n the orchestrator gives and recorded in the direction by a plan task before the task that uses it.
  - **The G-4 bar:** a keyboard path for choosing, uploading, retrying, downloading, removing and including; optimistic feedback with rollback where the result is known (removal, exclusion); Undo toasts for removal and AI inclusion; no confirmation dialog, because nothing here is a governance-significant irreversible step; skeletons; empty states that say what to do next; no lost input (D-26); comfortable and compact density where the panel is a table; motion from the direction that honours reduced motion; phone cards and sheets.
  - **Route budget:** the upload queue and the panel's client pieces load on demand where they can, and `performance.spec.ts` stays green.

#### The AI context (decision 2, decision 5, G-3; COLLAB-02 criterion 5)

- **D-30:** A Security Analyst opts each file in; the default is off.
  - **Who:** any human Security Analyst, except a requesting analyst on their own request (`OWN_REQUEST`, D-19). Never the Requestor, who neither sets nor sees it. The operation is human-only and in `HUMAN_ANALYST_ONLY_OPERATIONS`.
  - **Which files:** clean, not removed, and a text-bearing type (PDF, DOCX, XLSX, PPTX, CSV, TXT). PNG and JPEG have no text the AI can read (no OCR), so they cannot be included, and the control says why.
  - **When:** while the request is submitted and not yet released (`acceptsNotes`). A draft is refused with `REQUEST_NOT_SUBMITTED`, and a released or closed request with `ATTACHMENTS_CLOSED`.
  - **Policy:** refused while the request's AI policy refuses (Phase 12 D-28's `AI_CLASSIFICATION_ABOVE_CEILING` and `AI_POLICY_NOT_CONFIGURED`), so the control never promises what generation would refuse. Its description says that the request's data classification governs (Phase 12 D-26) and that only files whose content is within it should be included.
  - **Record and Undo:** each change is recorded in the event log (who, when, from and to); it is reversible with an Undo toast and needs no confirmation.

  Basis: G-3 data minimisation, decision 2's per-file opt-in, and Phase 13 D-26's pattern for notes; the second line owns what the method uses.
- **D-31:** Text is extracted when a file is opted in, not at upload.
  - **When:** opting in extracts the file's text, after the scan has passed, bounded in time and memory, and stores it with the attachment while it stays included. Opting out, removal or a blocked verdict deletes it. Nothing is extracted from files nobody includes, which is the minimal choice (G-3) and keeps the parsers away from most files.
  - **No text:** a file with no extractable text (a scanned PDF without a text layer, empty sheets) or one the extractor cannot read is refused with `ATTACHMENT_TEXT_UNAVAILABLE`, so the analyst knows before generating.
  - **What is extracted** (research fixes the details): a PDF's text layer in page order; a DOCX's body paragraphs and tables, without comments or deleted revisions; an XLSX's cell values, cached values and never formulas, sheet by sheet and row by row; a PPTX's slide text in order (speaker notes are research's call); CSV and TXT as decoded text. Control characters other than line breaks and tabs are removed.
  - **The text preview:** the analyst can open the stored text from the control (an analyst-only read, D-04 item 6) to check what the AI will read.
- **D-32:** Extraction is contained, and its dependencies are justified.
  - **Isolation:** extraction runs in a worker thread with memory and time limits, killed on overrun, never on Strapi's request thread.
  - **Bounds:** ZIP bombs are bounded (entry count, and uncompressed size read from the central directory before inflating); XML is read without DTDs or external entities; PDF parsing runs with script evaluation off (the pdf.js `isEvalSupported` lesson, CVE-2024-4367).
  - **Criteria:** each dependency passes Phase 19 D-12's pass-or-fail criteria: a permissive licence (MIT, Apache 2.0 or ISC); published on npm and maintained, with no unpatched high or critical advisory in it or its dependencies; pure JavaScript; and its install size, time and memory measured at 25 MiB. Each is justified in the plan that adds it and wrapped behind CSRM's own interface.
  - **The lean:** one ZIP reader serving DOCX, XLSX and PPTX and D-09's content checks, with Phase 19's XLSX reader (`read-excel-file`, 19 D-12) for sheet values if it fits; and one pdf.js-based PDF text library. Alternatively, one maintained office-text library, if it passes the same criteria. Phase 19 then reuses whatever XLSX reader this phase adds, so the codebase holds one.
- **D-33:** Caps, and the context budget.
  - **Per file:** the stored text is capped (proposed 20,000 characters; research may set 10,000 to 40,000), and the total available count is kept. Truncation is never silent: the control, the run summary and "What the AI used" say "first n of m characters". Decision 2 requires the cap; disclosing it honours 06.7 D-10's rule against silent truncation.
  - **Per run:** attachment text in one run has its own bound (proposed about 30% of Phase 12's budgets: 60,000 characters for the draft and 30,000 for the questionnaire). Over that bound, or over Phase 12's total, the job fails before any provider call with `CONTEXT_TOO_LARGE`, and its message names the included files, which the analyst can exclude (Phase 13 D-27's pattern).
- **D-34:** What the prompt carries (decision 5, G-3; Phase 12 D-05 and D-08):
  - exactly the included files' stored text, in upload order, each in a delimited block of its own inside the untrusted data block, escaped with `promptDataTag`;
  - each block is labelled by code constants: its sequence, its type, its part and the truncation fact. The prompt never carries the file name (an injection channel and often personal data), the uploader's name, times, ids or the request number;
  - nothing about excluded, quarantined, blocked or removed files, not even their existence (success criterion 5);
  - every operation built on the context builder includes them: Phase 12's questionnaire and draft generation now, then Phase 15's proposals, Phase 16's re-runs and Phase 17's residual reassessment, all under the same classification check;
  - the guardrail tests extend to hostile attachment text: closing tags, fake instructions and very long lines.
- **D-35:** The run record and "What the AI used":
  - **The context summary** gains an attachments section: each included file's `documentId`, digest, type, characters sent, characters available and truncation, never its text or name (G-3). It is a new envelope version that the closed parser accepts beside Phase 12's v1 and Phase 13's notes version; earlier runs read as having included no files.
  - **The sheet** (Phase 12 UI-SPEC §2) gains an Attachments group: each file by its current name, resolved at read time from the attachment record, with its part, the characters sent and the truncation, linking to the file in the request's Files panel. A file removed since the run still resolves, and says so.
- **D-36:** The "AI inputs changed since the last generation" signal (Phase 13 D-29) gains files on the same rule: the files whose current inclusion differs from their inclusion in the target's latest completed context-wide run (included since, or excluded or removed since). It is shown in analyst reads only, with no re-run action here (Phases 15 and 16 attach theirs).

#### Security events (decision 12's pattern; ISO/IEC 27001:2022 Annex A 8.15 and 8.16)

- **D-37:** One security event log module in Strapi, built here to Phase 19 D-18's contract: one structured line per event through Strapi's logger, with a stable event name and a JSON payload.
  - **Events:** uploaded, refused (with its reason), quarantined, scan verdict, blocked, downloaded, integrity failure, removed, restored, and AI inclusion changed.
  - **Fields:** the time (UTC), the actor (`documentId` and display name), the request and attachment `documentId`s, the type, the size, the digest, and the outcome with its closed reason or the detection name.
  - **Never** a file's content, name or extracted text.
  - **Levels:** a malware detection, a blocked verdict and an integrity failure log at warning level, which the deployment's log platform alerts on.
  - **Reuse:** Phase 19 adds its export and import events, and Phase 17 its people-search log (G-17), to this module rather than building another.
  - **Retention:** R-08-13: the lines hold names, so the deployment's log policy treats them as personal data.

  **Reversibility:** costly - log consumers key on the event names and fields.

#### Roles, grants and the catalogue

- **D-38:** The catalogue, in both copies, byte-identical:

  | Function (names are proposals) | Holder | Operations |
  |---|---|---|
  | `function.risk_assessment_requests.attachments_api` | `role.requestor` and `role.security_analyst` | list, upload, download, remove and restore |
  | `function.risk_assessment_requests.attachment_ai_input_api` | `role.security_analyst` | AI inclusion and the text preview |

  - Neither is granted to `role.security_analyst_agent`.
  - The AI inclusion and the text preview join `HUMAN_ANALYST_ONLY_OPERATIONS` in the policy and in the matrix's mirror, as a second refusal.
  - The attachment operations serve both actors, so they cannot join that set. Their analyst path is human-only because the agent's role lacks the grant, and the record rule (D-18) does the rest (Phase 13 D-30).
  - A catalogue design note records the new Functions and amends note 6 for attachments, and `served-operations.json` is regenerated: the new operations served, and the upload plugin's content-API routes gone (D-08).

#### Verification and plan shape

- **D-39:** How the phase is proved. Each behaviour gets a failing test first at its seam.
  - **Strapi unit:**
    - the content checks for every type, with small committed fixtures: a renamed executable, a ZIP that is not Office Open XML, macro-enabled, encrypted and old Office files, a password-protected PDF, empty and oversize files;
    - name sanitisation, the bidirectional-override trick included;
    - the double; the ClamAV adapter against the fake `clamd` (clean, found, a size-limit reply, unavailable, timeout);
    - the quarantine state machine and the re-scan; the window, note-window and readers predicates;
    - extraction for each type, with its bounds (a ZIP bomb, deep XML, a timeout);
    - the caps and truncation facts; the context builder's attachment blocks, with hostile text staying data;
    - the summary envelope parser, the signal and the event lines.
  - **Strapi integration** (mounted):
    - every operation, and every refusal in the authorisation table below;
    - the count race (two uploads at 19);
    - downloads' headers and bytes, and the digest check with the stored bytes tampered;
    - no byte under `/uploads/`, the upload plugin's routes unmounted, and the request delete refusal;
    - a generation through the fake OpenAI-compatible server proving that the included file's text is sent, and that an excluded file's text and name are not;
    - the inclusion refused under a pinned ceiling;
    - formidable's temporary files removed after refusals.
  - **The matrix:** a row for each new route with all six callers, and the upload plugin rows replaced by unmounted-path assertions.
  - **Web unit (Vitest):**
    - the queue's stages, retry and the client pre-checks;
    - the Files panel for the Requestor, an analyst, a requesting analyst, and a released or closed request;
    - the AI control's states and reasons, and the composer posting the note first with rollback;
    - the download helper's validation (type, name, size, signature), the refusal copy and the navigation guard;
    - the refusal states: another Requestor sees not found, a Requestor sees no AI control, a requesting analyst sees no AI control, and a closed request shows no add or remove.
  - **Playwright** (`apps/csrm/e2e/`), each journey with its own records, at 1440px and 375px (the new spec joins the mobile project's `testMatch`):
    - Jane creates a request with a PDF, a DOCX and an XLSX, submits it, and later posts a note with a PPTX; Bob sees all four and downloads one (download event: name, type and signature) (criterion 1);
    - the Secondary Requestor gets the request's permission or not-found state at Jane's request, and no file anywhere; her API refusals are proven in the Strapi tests (criterion 2);
    - a disallowed type, a PDF-named PNG, an oversize file and the CSRM test signature are each refused with their message (criterion 3);
    - Jane removes a file and undoes it, then removes it again; both actors see who removed it and when (criterion 4);
    - Bob includes the PDF's text, generates with the deterministic provider, and "What the AI used" lists the PDF and not the DOCX (criterion 5).

    The storage directory sits under the run's temporary root, and a run leaves the tree clean (Phase 8 D-12, G-6).
- **D-40:** Plan shape.
  - **The contract-gap record comes first,** followed by its checkpoint, where the executor stops. No plan changes a content type, `specification.json`, either catalogue copy or `served-operations.json` before approval.
  - **Dependency plans:** each plan that adds a dependency justifies it against D-32's criteria; the S3 provider rests on G-7.
  - **Serialised by shared files,** one owner per file per wave:
    - the specification and the generated client;
    - both catalogue copies, `served-operations.json`, the matrix, and the parity and chain guards;
    - `csrm-authorization.ts`, `conflict-reasons.ts` (both sides) and `refusal-copy.ts`;
    - `config/plugins.ts`, `config/middlewares.ts`, `next.config.ts` and `proxy.ts`;
    - the request controller (the summary and the delete refusal);
    - Phase 13's notes service and composer;
    - Phase 12's context builder, run envelopes and "What the AI used" sheet, and Phase 13's signal;
    - the request form, both request pages, the analyst questionnaire and assessment pages' summaries, and `status-badge.tsx`;
    - `playwright.config.ts`, the Strapi test harness and the E2E sign-in helper.
  - **Dev servers** are stopped for every plan that edits Strapi or runs Playwright.
  - **The last plan** runs the full gate on the production build, with the 375px and 1440px checks for Jane, the Secondary Requestor, Bob and the second analyst, then asserts a clean tree.

#### Orchestrator Confirmations (2026-10-01, post-demo Stage 2)

- **UI-SPEC UI-D1 (accepted):** visible copy says "file"; "attachment" stays the record and API term, and a Phase 14 plan adds the glossary entry.
- **UI-SPEC UI-D14 (accepted):** attachment state badges are neutral, each state told apart by its text and icon, with refusal copy that says what to do next.
- **X-22 extends Phase 13's X-18:** execution order records X-18 first.
- **For the research and the plans to verify:** UI-SPEC UI-D3, UI-D5 and UI-D30, and the UI-SPEC's "Research to verify" list, including that a client provider in the `(app)` layout keeps `File` objects across in-app navigation.

### Claude's Discretion (the context's "Planner's Discretion")

- Module placement: a new `csrm-request-attachment` API folder or routes under the request API; the shared Strapi pipeline (for example `apps/backend/src/csrm/files/` for storage, content checks, scanning and extraction, and `apps/backend/src/csrm/audit/` for the event log); the web feature (for example `apps/csrm/src/features/attachments/`) and the shared file-transfer modules.
- The names of reason codes, Functions, operations, fields, settings, event names and envelope versions, within the families above.
- The bounds within the proposals: the per-file text cap, the per-run attachment bound, the note window, the lifetime bound, scan timeouts and the re-scan backoff.
- How the private local provider is wired, and whether attachments are stored through the plugin's upload service with formats off or through the provider and the file record directly (D-06, D-07).
- Whether the file-transfer modules and the event log land in their own plan or with the first operation that uses them.
- Whether the plugin's file records go in a dedicated Media Library folder.
- How the work splits into plans, provided D-40's serialisation holds.
- Copy, layout, routes and visuals: the UI-SPEC's.

### Deferred Ideas (OUT OF SCOPE)

- **Attachments on questionnaires, assessments, risks and control implementations** (UAT-012's "later"), the risk table's "Files" column (`REPORT.md` §7), and the questionnaire's `File upload` answer type: later phases, reusing this pipeline and record.
- **Inline previews and thumbnails** of PDFs and images: they render untrusted content in the browser and need their own security design.
- **OCR, and sending images to the model:** decision 2 covers extracted text only.
- **Citing attachments (and notes) in AI proposals:** an extension of Phase 12's citation sources.
- **A per-file classification** that could raise the request's classification for the AI policy.
- **Re-scanning stored files when signatures update,** or on download.
- **A disposal job, legal hold and purge on request** (an audited, Admin-only purge of a file posted in error), with the Admin's retention setting (D-22).
- **File versions and replacement, folders, tags, per-file descriptions and bulk download** (a ZIP of all files).
- **Internal, analyst-only files:** not asked for; a visibility toggle invites disclosure mistakes (as Phase 13 deferred internal notes).
- **Byte-level upload progress and resumable chunked uploads:** they need a transport outside Server Actions.
- **Email-in attachments** and file events beyond notes in the notification centre.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLLAB-02 (1) | Allowed files (PDF, DOCX, XLSX, PPTX, CSV, TXT, PNG and JPEG, checked by content; up to 25 MB each and 20 per request) upload at creation and later, each showing name, size, uploader and time, and download only through an authorised operation | Content check (Pattern 3, Code Example 4); limits (Settled 7); storage port (Pattern 1); upload pipeline (Pattern 2); Server Action download at 25 MiB (Settled 1); body limits (Settled 6) |
| COLLAB-02 (2) | A disallowed type, an oversize file or a file that fails the malware scan is refused with its reason | Status and reason table (Settled 8); scanner port, double and ClamAV adapter (Settled 5, Code Examples 5 and 6); formidable's unreasoned 413 (Pitfall 9) |
| COLLAB-02 (3) | Only actors who may read the request can list or download its files; another Requestor is refused at every route | Phase 13's `canUseRequestNotes` reused (Pattern 2); 404 from the controller (Phase 13 Pattern 2); unmounted plugin routes (Settled 2); no URL leaves Strapi (Pattern 1) |
| COLLAB-02 (4) | Removal records actor and time; retention follows the assessment's | Current facts plus append-only `eventLog` (06.8 posture); bytes kept on removal; S3 versioning and lifecycle are deployment configuration (README) |
| COLLAB-02 (5) | The analyst opts each file's text in, off by default; included text is size-capped, marked untrusted and never sent above the ceiling | Extraction worker (Pattern 6, Settled 3); caps (Settled 7); attachment blocks in the untrusted data block (Pattern 7); Phase 12's `data-policy.ts` reused |
</phase_requirements>

## Project Constraints (from AGENTS.md and the Stage 2 rules)

- **Paths:** Strapi is `apps/backend` and the web app is `apps/csrm`. The proxy file is `apps/csrm/proxy.ts`, not `src/proxy.ts` [VERIFIED: `ls`].
- **Strapi is the API boundary:** no frontend API facade, no raw `fetch` in page components, and no Route Handler standing in for an operation. Downloads and uploads go through `apps/csrm/src/lib/api` (openapi-fetch) from Server Actions.
- **Authorisation in Strapi** against the resolved IdamBox User: Role → Function → FunctionAPI, then the record rule. Never branch on the auth mode, and remember that navigation visibility is not authorisation.
- **AI is advisory:** only a human Security Analyst's recorded opt-in puts a file's text in the context. Generation stays human-initiated.
- **JDL terminology:** document contract and model gaps rather than inventing competing entities. `CsrmRequestAttachment` is a recorded concept (D-02), and its record comes first and is approved at a checkpoint where the executor stops (G-6).
- **Contract chain:** `specification.json`, then both catalogue copies (byte-identical), `served-operations.json`, `pnpm --dir apps/csrm api:generate`, and a clean `api:check`.
- **UI:** semantic tokens only, shadcn/ui first, Server Components by default, no business logic in JSX, responsive and accessible. Every value comes from `docs/design/csrm-design-direction.md`, and new patterns are recorded X-n extensions (the UI-SPEC's job).
- **Dependencies:** none without a concrete reason, justified in the plan that adds it (D-32 criteria).
- **Dev mode only:** never start Keycloak or flip `CSRM_AUTH_OIDC_ENABLED`, `CSRM_DEV_IDENTITY`, `IDAMBOX_KEYCLOAK_PROVISIONING` or `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION`. New settings go in the `.example` files with safe defaults.
- **Tests with every workflow:**
  - Strapi integration tests for every grant and refusal;
  - Vitest for logic, components and refusal states;
  - Playwright for the flows, leaving a clean tree.

  Gate commands: `api:check`, `typecheck`, `lint`, `test` (web), `test` (Strapi), `test:e2e`, then `git status --short`.
- **Leave alone:** `apps/backend/types/generated/*.d.ts`, `example-risk-assessment-questions/` and `.env` files.
- **Project skills:**
  - `tdd`: failing test first at an agreed seam, in vertical slices;
  - `codebase-design`: deep modules behind small interfaces, with adapters at seams. The storage port, scanner port and extractor are the seams named here;
  - `domain-modeling`: the glossary gains "Attachment", in a plan task (the root `CONTEXT.md` is a shared file).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Record rule, window, note link, actor rules, count and lifetime bounds | API / Backend (Strapi services under `withRequestLock`) | — | Authorisation and serialisation are server-side (D-03, D-10, D-18) |
| Content check, name sanitisation, size | API / Backend (`csrm/files/content-check.ts`) | Browser (extension and size pre-check for fast feedback only) | Strapi is authoritative (D-11) |
| Malware scan, quarantine, re-scan | API / Backend (scanner port, `clamd` over TCP) | External service (`clamd`, deployment) | Fail closed server-side (D-12, D-13) |
| Storage of bytes | Database / Storage (upload plugin provider: private local directory or S3) | API / Backend (storage port) | No URL leaves Strapi (D-06) |
| Download | API / Backend (binary response) → Frontend Server (Server Action passes the bytes on) → Browser (Blob and anchor) | — | D-23, D-24; no Route Handler |
| Upload transport | Browser (queue) → Frontend Server (one Server Action per file, multipart to Strapi) → API / Backend | — | D-25, D-26 |
| Body size gate | Frontend Server (`next.config.ts` limits, `proxy.ts` path gate) | Deployment reverse proxy (R-08-04) | Next's limits are global (Settled 6) |
| Text extraction | API / Backend (worker thread) | — | Isolation and bounds (D-32) |
| AI inclusion and context | API / Backend (Phase 12 builder and data policy) | Frontend Server (displays the served state) | G-3, decision 5 |
| Security events | API / Backend (`csrm/audit/security-event-log.ts` → Strapi logger) | Deployment log platform (SIEM) | D-37, Phase 19 D-18 |

## The research questions, settled

### Settled 1: a 25 MiB download as a Server Action return (D-24)

**Result: it works.** The plan uses the Server Action path, with no checkpoint and no deviation.

**The probe** (scratchpad, Node 24.19.0, the Flight builds bundled in `next@16.3.6/dist/compiled/react-server-dom-webpack`):

| Step | Measured |
|---|---|
| `renderToPipeableStream({ ok, fileName, contentType, bytes })` with a 26,214,400-byte `Uint8Array` | 47 ms; payload 26,214,501 bytes, so 101 bytes of framing (`1:o1900000,` then the raw bytes); RSS 38 → 75 MB |
| `react-server-dom-webpack-client.node.production.js` `createFromNodeStream`, fed in 64 KiB chunks | 30 ms; `Uint8Array`, 26,214,400 bytes, content intact; RSS 36 → 90 MB |
| `react-server-dom-webpack-client.browser.production.js` `createFromReadableStream` (the browser's own code path), then `new Blob([bytes])` | 37 ms; Blob 26,214,400 bytes; RSS 36 → 123 MB |

[VERIFIED: probe output in this session]

**Why it holds:**
- **Raw binary rows, no encoding.** Flight emits a `Uint8Array` as a raw, length-prefixed binary row: `return serializeTypedArray(request, "o", value);`. That line is identical in the Turbopack and webpack server builds [VERIFIED: grep, `react-server-dom-turbopack-server.node.production.js:1725` and `react-server-dom-webpack-server.node.production.js:1725`]. Next 16 builds with Turbopack by default, so the line matters.
- **No response limit.** Next sets no response size limit for actions [VERIFIED: grep of `dist/server/app-render/` for `responseLimit` and `responseSizeLimit`: no match]. `bodySizeLimit` bounds the request only (bundled `serverActions.md`).

**Budget per download:**
- **Web server:** about 25 MiB for openapi-fetch's `ArrayBuffer` (`parseAs: "arrayBuffer"`, verified in 19-RESEARCH), plus Flight's chunk writes, which add no copy (probe: +37 MB).
- **Browser:** about three times the file (the received chunks, the merged array and the Blob).
- **Queueing:** actions dispatch one at a time per client (bundled `server-actions.md`: "Next.js dispatches Server Actions one at a time per client"), so a download briefly queues other actions from that tab.

**Not measured here:** a real browser over a real network, because no dev server may run during planning. The first Playwright download test records its time; the spec downloads a small file, plus one 24 MiB fixture in a Strapi integration test for the bytes and digest path.

### Settled 2: storage wiring and the unmounted plugin routes (D-06, D-07, D-08)

**How the plugin loads a provider** [VERIFIED: `@strapi/upload@5.51.0/dist/server/register.js:55-62`, verbatim]:
```js
const providerName = ___default.default.toLower(config.provider);
...
modulePath = require.resolve(`@strapi/provider-upload-${providerName}`);
...
modulePath = providerName;
```
- **Path configuration is fragile.** A module path in `config/plugins.ts` is lower-cased, then `require`d from inside the pnpm store. It works on Windows' case-insensitive filesystem and breaks on Linux whenever the path has a capital letter. Do not configure the private local provider by path.
- **Packages resolve through hoisting.** A real `@strapi/provider-upload-aws-s3` dependency of `apps/backend` resolves through pnpm's hoisted `node_modules/.pnpm/node_modules/@strapi/`. That directory already holds `plugin-users-permissions`, which is a direct dependency of `apps/backend` [VERIFIED: `ls`]. `.npmrc` sets no hoisting override [VERIFIED: no `.npmrc`].

**Recommended wiring:**

1. **`config/plugins.ts`:**
   - `storage = s3`: `provider: 'aws-s3'` with the S3 block (Code Example 3).
   - Otherwise: the default `'local'`, which still needs the tracked `public/uploads/.gitkeep`, because the stock provider's `init` throws if `public/uploads` is missing [VERIFIED: `provider-upload-local/dist/index.js:44-47`].
2. **The application's `register()`** (`apps/backend/src/index.ts`) runs after every plugin's `register()` [VERIFIED: `@strapi/core/dist/Strapi.js:328-329`: `await this.runPluginsLifecycles(...REGISTER); await this.runUserLifecycles(...REGISTER);`]. In it, `registerAttachmentStorage(strapi)`:
   - **(a) Validate.** Reads and checks the attachment configuration (D-15), failing boot on an invalid value, beside `assertCsrmAiConfiguration`.
   - **(b) Replace the local provider.** When storage is local, it replaces the plugin's provider methods with the CSRM private local provider through the provider object's own `extend` (`register.js:92`, `extend (obj) { Object.assign(this, obj); }`). The provider writes to `CSRM_ATTACHMENT_LOCAL_DIR` (default `.tmp/attachments`, resolved from the app root). Its `url` is a non-routable `/csrm-private/{hash}{ext}` that no middleware serves, `isPrivate()` is `true`, and `getSignedUrl()` returns no usable URL. The admin Media Library therefore shows no preview for private files, which is the intended consequence (D-06).
   - **(c) Unmount the content-API routes.** It sets `strapi.plugin('upload').routes['content-api'].routes = []`. The content-API router is a factory whose `routes` property has a setter [VERIFIED: `@strapi/utils/dist/content-api-router.js:21-27`: `Object.defineProperty(createContentApiRoutes, 'routes', { get: ensureSharedRoutes, set (next) { sharedRoutes = next; }, enumerable: true });`]. Routes are registered later, during bootstrap's `initRouting` [VERIFIED: `Strapi.js:393`].

   The `admin` and `viewConfiguration` routers are untouched, so the admin panel's `/upload/*` routes keep working [VERIFIED: `routes/index.js`: `{ admin, 'content-api': contentApi.routes, viewConfiguration }`].

   **Alternative:** `src/extensions/upload/strapi-server.ts` can unmount the routes too, but it cannot replace the provider, because the provider does not exist until the plugin's own `register()` has run. Keep both in one `register()` call for locality.
3. **Write path (D-07).** The storage port calls `strapi.plugin('upload').provider.upload(fileData)` with a `buffer`, then creates the plugin's file record through `strapi.db.query('plugin::upload.file').create(...)`, with the fields `formatFileInfo` builds (`upload.js:96-108`): `name`, `hash`, `ext`, `mime`, `size` in KB, `sizeInBytes`, `url`, `provider`, `folderPath`.
   - **Why not the plugin's upload service:** `uploadFileAndPersist` sends images through `uploadImage` (thumbnail and formats, `upload.js:303`). `enhanceAndValidateFile` optimises images when `isOptimizableImage` (`:150`), and the key comes from `generateFileName(basename)` (`:103`), the uploaded name plus 10 hex characters.
   - **`hash`:** CSRM's own `csrm_` followed by 32 hex characters from `crypto.randomUUID()`, with the detected type's extension (D-06).
   - **`provider`:** must equal `strapi.config.get('plugin::upload').provider`, because the plugin's `remove()` calls `provider.delete` only when they match (`upload.js:535-540`).
4. **Read path.** The provider interface has no read method [VERIFIED: the local provider exports `checkFileSize`, `uploadStream`, `upload`, `replaceStream`, `replace` and `delete`; the S3 provider adds `getSignedUrl`, `getObjectMetadata` and `objectExists`, but no read]. The storage port therefore owns `read`:
   - **local:** `fs.readFile` under the configured directory, joined from `hash + ext` only;
   - **s3:** `provider.getSignedUrl(file)` gives a presigned `GetObject`, which Strapi fetches server-side with `redirect: 'error'` and the 25 MiB bound. It refuses a URL without `X-Amz-Signature` (Pitfall 5). The URL never leaves the function.

**The S3 configuration facts** [VERIFIED: `@strapi/provider-upload-aws-s3@5.51.0/dist/index.js`]:
- **ACL:** `:130-131` `if (!('ACL' in config.params)) { config.params.ACL = clientS3.ObjectCannedACL.public_read; }`. Set `params: { Bucket, ACL: undefined, signedUrlExpires: 60 }`: the key is present, so no default applies, and with no value no ACL header is sent (`...config.params.ACL ? { ACL: … } : {}`).
- **Privacy flag:** `:328` `return config.params.ACL === 'private';`. With the ACL omitted, `isPrivate()` is `false`. The Media Library then shows the unsigned bucket URL, which the bucket's Block Public Access refuses. CSRM never relies on `isPrivate()`.
- **Encryption:** `:184-190`, SSE through `providerConfig.encryption: { type: 'aws:kms', kmsKeyId }` → `params.ServerSideEncryption`, `params.SSEKMSKeyId`.
- **Signed URL expiry:** `:353` reads `['params', 'signedUrlExpires']`, defaulting to `15 * 60`.
- **CDN bypass:** `:338` `if (!utils.isUrlFromBucket(file.url, config.params.Bucket, baseUrl))` returns the unsigned `file.url`, and `isUrlFromBucket` returns `false` whenever `baseUrl` is set. The CSRM configuration therefore refuses a `baseUrl` (boot failure).
- **Body:** `:162` `Body: file.stream || Buffer.from(file.buffer, 'binary')`. Pass `buffer`, so the size is known.
- **Client options:** `s3Options` is spread into the `S3Client` config (`getConfig`), so `region`, `endpoint`, `forcePathStyle` and `credentials` pass through. Credentials come from the default provider chain when absent.

**AWS default:** "By default, Object Ownership is set to the Bucket owner enforced setting and all ACLs are disabled … your bucket accepts only `PUT` requests that do not specify an ACL or `PUT` requests with bucket owner full control ACLs" [CITED: docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html].

**The matrix:** the five upload rows (`tests/fixtures/authorization-matrix.ts:586-623`: `POST:/api/upload`, `GET:/api/upload/files`, `DELETE:/api/upload/files/:id`, `GET:/api/upload/files/:id`, `GET:/api/upload/files/page`) become unmounted-path assertions: `GET` answers 404 and a mutation 405 [VERIFIED: `docs/security/strapi-http-hardening.md:141-143`].

### Settled 3: the text-extraction stack (D-31, D-32)

| Format | Reader | Licence / size / Node | Why |
|---|---|---|---|
| PDF | `unpdf` 1.8.1: `getDocumentProxy(data, { isEvalSupported: false, verbosity: 0 })`, then pages read **sequentially** through `getTextContent()` | MIT; no dependencies; 2.1 MB unpacked; `engines.node >=22`; bundles pdf.js `apiVersion: 6.1.200`, which postdates the CVE-2024-4367 fix (4.2.67); the bundle contains zero occurrences of `new Function` | Pure JavaScript and serverless (no `@napi-rs/canvas`, unlike `pdfjs-dist` 6.3.289, which lists it as an optional dependency and is 34.8 MB, and `pdf-parse` 2.4.5, which depends on it) [VERIFIED: npm view; tarball grep] |
| XLSX | `read-excel-file` 9.3.10, `read-excel-file/universal` default export (all sheets: `[{ sheet, data }]`) with `trim: false`, after the CSRM ZIP bound | MIT; Phase 19 D-12's chosen reader, so the codebase holds one | Cached values, never formulas ("it 'cheats' by returning the value that is already pre-computed") [CITED: README "Formulas"; VERIFIED: README "Use" and the 9.x migration notes, read from the tarball] |
| DOCX, PPTX | CSRM `zip-archive.ts` (central directory + `zlib.inflateRawSync(span, { maxOutputLength })`), then a CSRM OOXML text scanner over `word/document.xml`, or over the slides in `ppt/presentation.xml` order | No dependency | Offsets proven: a Python `zipfile` archive (deflated and stored entries) parsed and inflated exactly [VERIFIED: probe]. `maxOutputLength` throws `ERR_BUFFER_TOO_LARGE` [VERIFIED in 19-RESEARCH] |
| CSV, TXT | `TextDecoder` (`utf-8` with `fatal: true`; `utf-16le` or `utf-16be` after a BOM) | Built in | D-09's text rule |

**The probe** (scratchpad; `unpdf` in a `worker_threads` worker with `resourceLimits.maxOldGenerationSizeMb: 512`) [VERIFIED: probe output]:

| File | Pages | Open | Total | Characters available | Worker heap | Process RSS delta |
|---|---|---|---|---|---|---|
| 2,164-byte text PDF | 3 | 34 ms | 46 ms | 960 | 12 MB | 27 MB |
| 25,696,050-byte dense text PDF | 4,200 | 68 ms | 6,586 ms | 22,228,710 | 348 MB | 436 MB |
| `PK…` bytes named `.pdf` | — | — | — | `InvalidPDFException: Invalid PDF structure.` | — | — |

Implications:
- **The PDF open check is cheap.** "The document opens" (D-09) costs about 70 ms even at 25 MB, so it runs at upload, in the worker, with a 10 s timeout. A password-protected file raises pdf.js's `PasswordException`, the encrypted reason. A PDF encrypted with an empty user password opens and is accepted, because it is readable and scannable.
- **Iterate pages sequentially.** Do not use `unpdf`'s `extractText`: it calls `getPage` for every page at once through `Promise.all` [VERIFIED: `unpdf/dist/index.cjs:384-391`]. CSRM iterates pages, calls `page.cleanup()`, keeps the first `cap` characters and counts the rest.
- **Worker limits:** `maxOldGenerationSizeMb: 768`, a 30 s wall clock, one extraction at a time (a single-slot queue), and `worker.terminate()` on overrun. An overrun or a crash gives `ATTACHMENT_TEXT_UNAVAILABLE`. These are D-32's discretionary values; the measured worst case uses about half the heap and a quarter of the time.
- **Bound the external memory too.** `resourceLimits` bounds only the V8 heap. Inflated buffers are external memory, so the ZIP reader's `maxOutputLength` and an XLSX sheet-XML bound (recommended 128 MiB of inflated `xl/worksheets/*` and `xl/sharedStrings.xml` before calling the reader) bound the rest [ASSUMED values].

**What each extractor reads:**
- **DOCX:** `w:t` runs in `word/document.xml`; `w:p` ends a paragraph; `w:tab` is a tab; `w:br` and `w:cr` are line breaks. In tables, `w:tc` cells are joined by a tab and `w:tr` rows end with a line break. Inserted revisions (`w:ins`) are current text and kept. Deleted text lives in `w:delText`, which is never read. Comments are a separate part (`word/comments.xml`) and are never read. Field instructions (`w:instrText`) are not read. `mc:Fallback` subtrees are skipped, so text boxes are not duplicated.
- **PPTX:** slides in `p:sldIdLst` order, through `ppt/_rels/presentation.xml.rels`; `a:t` runs and `a:p` paragraphs. **Speaker notes are excluded** (D-31 left it to research). They are presenter commentary rather than the deck's content, and leaving them out is the minimal choice under G-3, matching DOCX comments.
- **XLSX:** each sheet becomes a `Sheet: {name}` line, then rows of cells joined by tabs. Dates become ISO `YYYY-MM-DD`, booleans `TRUE` and `FALSE`, and numbers `String(n)`. Empty trailing cells are dropped.
- **All formats:** C0 and C1 control characters other than `\t` and `\n` are removed, CRLF becomes LF, and the result is NFC-normalised.

**The OOXML scanner is CSRM code.** It is about 150 lines and is not a general XML parser. It tokenises tags and text, decodes the five predefined entities and numeric references, and refuses `<!DOCTYPE` or `<!ENTITY` outright, so no DTD or external entity is ever processed (D-32). **Why not a library:**
- `mammoth` is BSD-2-Clause, outside D-32's licence list.
- `officeparser` 8.1.0 pulls in `tesseract.js`, `pdfjs-dist` and `@xmldom/xmldom` (31 MB).
- `saxes` 6.0.0's last release was 2022-05-17, which fails D-32's maintenance criterion.
- A DOM parser would hold up to hundreds of MB of XML.

[VERIFIED: npm view for each]

### Settled 4: content sniffing (D-09)

**Dependency-free; `file-type` is not added.** The reasons:
- An allow-list needs positive matches for eight types, and the OOXML and text rules are CSRM's own anyway.
- Strapi's own code says `file-type` "often returns application/zip for Office formats" [VERIFIED: `@strapi/upload/dist/server/utils/mime-validation.js:182`].
- It is ESM-only: Strapi loads it with `await import('file-type')` (`:36-39`) from a CommonJS backend. The latest version, 22.1.1, is also flagged `too-new` by the legitimacy seam.

The check (Code Example 4) runs in this order:
1. **The extension.** A lower-cased extension maps to a claimed type: `.pdf .docx .xlsx .pptx .csv .txt .png .jpg .jpeg`. Known refused extensions get their own reasons: `.docm .xlsm .pptm .dotm .xltm .potm` are macro-enabled, and `.doc .xls .ppt` are old Office formats. Anything else is not an allowed type.
2. **The signature:**
   - `%PDF-` at offset 0 → PDF;
   - `89 50 4E 47 0D 0A 1A 0A` → PNG;
   - `FF D8 FF` → JPEG;
   - `50 4B 03 04` → ZIP;
   - `D0 CF 11 E0 A1 B1 1A E1` → CFB;
   - otherwise the text rule.
3. **ZIP.** The central-directory scan (bounded: at most 10,000 entries, no ZIP64 marker, no encryption flag (bit 0), methods 0 or 8 only, at most 1 GiB declared uncompressed in total, at most a 200:1 per-entry ratio) [ASSUMED bounds; planner's discretion]. Then `[Content_Types].xml` is inflated with a 1 MiB cap, and its main-part content type names the format. A `vbaProject.bin` part or a `macroEnabled` main type means macro-enabled. A main type that differs from the claimed type means a content mismatch.
4. **CFB.** The UTF-16LE directory name `EncryptedPackage` means an encrypted OOXML file, refused as encrypted. Any other CFB file is an old Office format, refused as such (19-RESEARCH Pitfall 16; a fixture CFB is built in the test).
5. **PDF.** The worker opens it; `PasswordException` means password-protected.
6. **Text:**
   - a UTF-8 BOM, or none, decoded with `fatal: true`;
   - a UTF-16 BOM, decoded as UTF-16;
   - a NUL byte without a UTF-16 BOM, or a known binary signature (`MZ`, `\x7fELF`, ZIP, CFB, PDF), means binary content.

**The main-part content types** (the planner verifies them with fixtures) [ASSUMED: ECMA-376 values from training]:
- DOCX: `application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml`;
- XLSX: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml`;
- PPTX: `application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml`;
- macro-enabled forms contain `macroEnabled`: `application/vnd.ms-word.document.macroEnabled.main+xml`, `application/vnd.ms-excel.sheet.macroEnabled.main+xml` and `application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml`.

**The rule:** the claimed and detected types must agree, or the file gets the specific refusal. The plugin's `security.allowedTypes` (`config/plugins.ts`) is untouched; it guards the Media Library only, and CSRM bypasses the plugin's upload service.

### Settled 5: ClamAV, the scanner port and the development double (D-12, D-13, D-14)

**`clamd.conf` defaults** [CITED: github.com/Cisco-Talos/clamav `etc/clamd.conf.sample` on `main` and on `rel/0.103`]:

| Option | Current default | 0.103 default | CSRM deployment requirement |
|---|---|---|---|
| `StreamMaxLength` | 100M | 25M | ≥ 30M |
| `MaxFileSize` | 100M | 25M | ≥ 30M |
| `MaxScanSize` | 400M | 100M | ≥ 256M (OOXML expands) |
| `AlertExceedsMax` | no | no | **yes** |

- **Why 30M:** under 0.103 defaults, a 25 MiB file sits exactly at the stream and file limits. 30M keeps headroom over a 26,214,400-byte file [ASSUMED: clamd's `M` suffix is MiB].
- **`AlertExceedsMax`:** "files exceeding the MaxFileSize, MaxScanSize, or MaxRecursion limit will be flagged with the virus name starting with 'Heuristics.Limits.Exceeded'" [CITED: clamd.conf.sample].

**The protocol** [CITED: docs.clamav.net/manual/Usage/ClamdProtocol.html]:
- **Framing:** `zINSTREAM\0` (z means a NUL-terminated command, the recommended form).
- **Chunks:** "Each chunk starts with a 4-byte unsigned length in network byte order, followed by that many bytes of data". The stream ends with a zero-length chunk, `00 00 00 00`.
- **The limit:** "If the stream exceeds that limit, `clamd` replies with an `INSTREAM size limit exceeded` error".
- **Replies:** `stream: OK` or `stream: Eicar-Signature FOUND`; `PING` answers `PONG`; `VERSION` reports the program and database version (`zVERSION\0` gives `scanEngine`).

**The port:**
```ts
type ScanVerdict =
  | { kind: "clean"; engine: string }
  | { kind: "infected"; engine: string; detection: string }
  | { kind: "not-scanned"; engine: string; cause: "unavailable" | "timeout" | "limits" | "error" };
interface MalwareScanner { readonly name: string; scan(bytes: Uint8Array, signal: AbortSignal): Promise<ScanVerdict>; }
```

**The ClamAV adapter** (`node:net`, no dependency; Code Example 5):
- connect with a 2 s timeout; 64 KiB chunks; an overall `CSRM_CLAMAV_TIMEOUT_MS` (default 60,000);
- `stream: OK` → `clean`;
- `stream: X FOUND` → `infected`, unless `X` starts with `Heuristics.Limits.Exceeded` → `not-scanned/limits`;
- a reply containing `size limit exceeded`, an `EPIPE` or `ECONNRESET` mid-stream, or `ERROR` → `not-scanned`;
- the engine string comes from `zVERSION`, cached for 10 minutes.

**Quarantine.** `not-scanned` stores the file `pending` (D-13). A `limits` cause logs an error, because re-scans repeat it until an operator raises the limits.
- **Re-scans:** a single in-process scheduler with backoff of 1, 5, 15 and 60 minutes, then hourly. It stops after `scanAttempts` reaches 24, and every Strapi start re-scans all `pending` files.
- **Timers:** use `unref()`'d timers, cleared in the app's `destroy()` (Pitfall 11).

**The development double** (D-12, D-14):
- **Flags two strings.** The double flags the EICAR string and the CSRM test signature (`CSRM-TEST-MALWARE-SIGNATURE-7c1e4a`; the name is the planner's).
- **No EICAR on disk.** It builds the EICAR string at runtime from fragments, so neither `src/**/*.ts` nor `dist/**/*.js` ever contains the 68-byte string. Windows Defender scans source and build output on write, and would quarantine a file holding the literal [ASSUMED: Defender behaviour on this host; D-14 records the risk].
- **Boot guard.** It is allowed only under the double key (`NODE_ENV` and `CSRM_ENVIRONMENT` both `development`) and otherwise fails boot. Both harnesses already run that key: the Strapi harness at `strapi-http-harness.ts:491-492`, and Playwright's Strapi `webServer.env` with `NODE_ENV: 'development'` and `CSRM_ENVIRONMENT: 'development'` (`playwright.config.ts:203-208`) [VERIFIED].
- **The one EICAR test.** It builds the string in memory the same way, so the test file contains no literal either.

**The fake `clamd`** (`tests/helpers/fake-clamd-server.ts`, modelled on `fake-openai-compatible-server.ts`) is a `net.Server` with scripted modes: `clean`, `found:<name>`, `limits`, `size-exceeded`, `close` (unavailable), `silent` (timeout) and `down` (port closed).

### Settled 6: the raised upload body limit, upload routes only (D-25)

**The two Next limits:**
1. `experimental.serverActions.bodySizeLimit: '26mb'` = 27,262,976 bytes [VERIFIED: `next/dist/compiled/bytes` probe: `parse('26mb') → 27262976`]. That is 1 MiB of headroom over 26,214,400 bytes, where Next's doc advises "an additional 10–20 KB" for multipart overhead [CITED: bundled `serverActions.md`]. Enforced in `action-handler.js:518-519` (`bodySizeLimitBytes`) and the multipart `sizeLimitTransform` (`:666-676`).
2. **`experimental.proxyClientMaxBodySize: '26mb'`** [VERIFIED: present in `config-schema.js:280`]. Without it, an 11 MB upload reaches the action truncated, because the proxy's clone stops pushing to the replacement body at the limit (`body-streams.js:98-106`, `p2.push(null)`), and Next only logs a warning. The bundled doc says it outright: "The request will **not** fail or return an error to the client".

**The `proxy.ts` gate** (Code Example 1). The path-scoped refusal runs before Next parses any action:
- **What it refuses:** a request carrying the `next-action` header with a `Content-Length` above 6,291,456 bytes (today's `'6mb'`), or with no `Content-Length` at all, answered 413 unless the path is an attachment page.
- **Where uploads are allowed:** `/app/requests/new`, `/app/requests/{id}`, `/app/requests/{id}/edit`, and `/app/review/requests/{id}`. The exact list is the routes the UI-SPEC places the uploader on.
- **Why the header test is reliable:** browsers send `Content-Length` for a `FormData` fetch body.

**Exposure after the change:**
- **Buffering:** the proxy's clone can buffer up to 26 MiB per request before the gate answers (today 10 MiB). The bound holds per request.
- **Parsing:** the action handler parses at most 26 MiB only on the attachment pages.
- **Memory per upload:** about 25 MiB in the clone, about 25 MiB in React's busboy `File`, and a stream to Strapi, so roughly 50–80 MiB in flight per upload, with one upload at a time per tab [ASSUMED estimate; the first upload plan measures it].
- **The residual:** R-08-04 gains a line: the deployment's reverse proxy sets a per-path body limit (6 MiB by default, 27 MiB on the attachment pages).

**Strapi needs no change:**
- formidable already admits 50 MiB per file (`config/middlewares.ts:27`, `maxFileSize: 52_428_800`) and 250 MiB in total (`:28`, `maxTotalFileSize: 262_144_000`) [VERIFIED];
- the attachment service enforces 26,214,400 bytes itself (413, closed reason);
- the global cleanup middleware (Pitfall 2) removes every temporary file, whatever the part name.

### Settled 7: bounds the context left to research

| Bound | Value | Reason |
|---|---|---|
| Note window (D-17) | 60 minutes after the note's `postedAt` | Covers a 20-file queue at 25 MiB each with retries, comfortably; short enough that a read note cannot gain files later |
| Lifetime bound (D-10) | 60 stored files per request (removed and blocked included) | 20 active plus two full rounds of replacement; 60 × 25 MiB = 1.5 GiB worst case per request, bounded |
| Per-file text cap (D-33) | 20,000 characters | The context's proposal. About 5,000 tokens, enough for the vendor pack's key sections |
| Per-run attachment bound (D-33) | 60,000 characters (draft), 30,000 (questionnaire) | About 30% of Phase 12's ~200,000 and ~100,000 budgets. Over the bound: `CONTEXT_TOO_LARGE`, naming the included files |
| ZIP at upload | ≤ 10,000 entries, ≤ 1 GiB declared, ≤ 200:1 per entry, no ZIP64, no encryption flag | ASVS V5.2.3 ("against maximum allowed uncompressed size and against maximum number of files before uncompressing"); `clamd`'s `MaxScanSize` is the second layer |
| ZIP at extraction | ≤ 128 MiB actually inflated (`maxOutputLength`) | Bounds external memory in the worker |
| Scan timeouts | Connect 2 s; whole scan 60 s (`CSRM_CLAMAV_TIMEOUT_MS`) | A 25 MiB stream over a LAN takes well under that |
| Re-scan backoff | 1, 5, 15, 60 minutes, then hourly; at most 24 attempts; all pending files on boot | Single process (R-08-36) |
| Event log per attachment | 200 events; at the cap a mutation is refused with `HISTORY_UNAVAILABLE` | The 06.8 and Phase 13 posture |
| Retention period | 7 years after closure, one constant in the attachment policy module | D-22; the Admin setting is flagged |

All [ASSUMED] as values (planner's discretion within the context's proposals), with the reasons above.

### Settled 8: statuses for the closed refusals

Following Phase 13's settled split (13-RESEARCH §C): identity-relative refusals are 403, record-state refusals 409, and the CSV import's existing 413 and 415 [VERIFIED: the spec has 413 and 415 on the eight import operations; no 422 exists today].

| Status | Reasons |
|---|---|
| 400 | Malformed multipart; any part other than one `file` and an optional `noteId`; `ATTACHMENT_EMPTY` |
| 403 | `OWN_REQUEST`, `NOT_UPLOADER`, `NOT_REMOVER` (restore), plus no grant and the human-only set |
| 404 | Every record-rule refusal (D-18) |
| 409 | `REQUEST_NOT_SUBMITTED`, `ATTACHMENTS_CLOSED`, `ATTACHMENT_NOTE_REQUIRED`, `ATTACHMENT_NOTE_INVALID`, `ATTACHMENT_LIMIT_REACHED`, `ATTACHMENTS_NOT_CONFIGURED`, `ATTACHMENT_QUARANTINED`, `ATTACHMENT_BLOCKED`, `ATTACHMENT_REMOVED`, `ATTACHMENT_INTEGRITY_FAILED`, `ATTACHMENT_TEXT_UNAVAILABLE`, `ATTACHMENT_NOT_TEXT_BEARING`, `AI_CLASSIFICATION_ABOVE_CEILING`, `AI_POLICY_NOT_CONFIGURED`, `REQUEST_HAS_ATTACHMENTS`, `HISTORY_UNAVAILABLE` |
| 413 | `ATTACHMENT_TOO_LARGE` |
| 415 | `ATTACHMENT_TYPE_NOT_ALLOWED`, `ATTACHMENT_CONTENT_MISMATCH`, `ATTACHMENT_MACRO_ENABLED`, `ATTACHMENT_ENCRYPTED` (password-protected PDF or encrypted OOXML), `ATTACHMENT_LEGACY_OFFICE` |
| 422 | `ATTACHMENT_MALWARE_FOUND`, with `details.detection` (new to the contract). The content is understood but refused; it is neither a state conflict nor a media-type problem (RFC 9110 §15.5.21). Phase 10's `normalizeTransportError` gains a 422 case |

**Upload success** is 201 with the attachment, `scanStatus` `clean` or `pending`: one shape, so the queue maps `pending` to "Waiting for the malware check". The reason names are the planner's, within these families.

### Settled 9: the UI-SPEC's "Research to verify" items (CONTEXT, Orchestrator Confirmations)

| Item | Verdict | Evidence and what the plan must do |
|---|---|---|
| **UI-D3:** the address becomes the draft's edit route without navigating | **Works**, with two conditions | "Next.js allows you to use the native `window.history.pushState` and `window.history.replaceState` … `pushState` and `replaceState` calls integrate into the Next.js Router, allowing you to sync with `usePathname` and `useSearchParams`" [CITED: bundled `01-app/01-getting-started/04-linking-and-navigating.md:343-347`]. The conditions come from what happens after the URL changes; see the notes below this table |
| **UI-D5:** a shared "files in flight" state that the submit dialog reads | **Works** as a client context | The queue and the submit confirmation read one store (UI-D35's provider). The store exposes `inFlight` (Waiting plus Adding), and the confirmation's disabled state and line derive from it. A pure-logic test covers the selector; a component test covers the dialog |
| **UI-D30:** ignoring page-level drops | **Works** | MDN: "the browser may process them by default (such as opening or downloading the file) even when the file is not dropped into a valid drop target. To prevent this behavior, we also need to listen for the `drop` event on `window` and cancel it", and "In order for the `drop` event to fire, the element must also cancel the `dragover` event". Outside the zone, set `dropEffect = "none"` [CITED: developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop]. One hook, mounted while a field is on the page, adds `window` `dragover` and `drop` listeners that cancel file drags (`item.kind === "file"`) outside the zone, and removes them on unmount |
| **UI-D35:** a client provider in the `(app)` layout keeps `File` objects across in-app navigation | **Works** within the `(app)` group, and is lost on a full reload | See the notes below this table |

**UI-D3, the two conditions.** After `replaceState`, every Server Action from that page posts to the new URL (`/app/requests/{id}/edit`):
1. **Import the upload action on every page that sends it.** Next forwards an action that the target route's worker does not hold, as a second internal request carrying the whole body [VERIFIED: `next/dist/server/app-render/action-handler.js:494-507`, `selectWorkerForForwarding` and `createForwardedActionResponse`]. For a 25 MiB upload that doubles the transfer, so the edit page must import the upload action too (it does, because D-27 adds files on the draft's edit form). The `proxy.ts` allow-list also includes `/app/requests/{id}/edit`.
2. **No refresh while the queue runs.** No action in the queue may call `revalidatePath`, `refresh` or `redirect`. Any of them re-renders the route for the new URL, the edit page, and unmounts the new form's tree. Move on with `router.replace` once every file has settled. `createRequestAction` stops redirecting while files are queued (D-26).

**UI-D35, the details.**
- **Layouts keep their state.** "On navigation, layouts preserve state, remain interactive, and do not rerender" [CITED: bundled `03-layouts-and-pages.md:43`]. "Client state is preserved for re-rendered components" after a server update [CITED: bundled `07-mutating-data.md:512`].
- **Where the provider goes:** `apps/csrm/app/(app)/layout.tsx` is an async Server Component that renders `<AppShell …>{children}</AppShell>` [VERIFIED: file read]. Put the client provider around `{children}` inside `AppShell`, in the authorised branch only. `app/(app)/error.tsx` sits beside that layout, so a page error does not unmount the provider (an `error.tsx` wraps its segment's children, not its layout).
- **The limits:** a full reload, or a navigation out of the `(app)` group to another root layout, drops every `File`. The UI-SPEC's `beforeunload` warning while files are kept covers the reload. Never persist `File` objects (no IndexedDB): it would keep unscanned bytes on the device.

## Standard Stack

### Core (new, Strapi only; each added by the plan that justifies it)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `unpdf` | 1.8.1 (published 2026-08-13) | PDF open check and text layer, in the worker | MIT; zero dependencies; 5.49M weekly downloads; the serverless pdf.js 6.1.200 build; CJS `require` export with types at the top level (node10 resolution safe) [VERIFIED: npm view; tarball `package.json` and `dist/index.cjs`] |
| `read-excel-file` | 9.3.10 (published 2026-08-10) | XLSX cell values for extraction; Phase 19 reuses it for imports | MIT; Phase 19 D-12's reader; reads cached values [VERIFIED: 19-RESEARCH; tarball README] |
| `@strapi/provider-upload-aws-s3` | 5.51.0 (published 2026-07-23), pinned to `@strapi/strapi` 5.51.0 | Production private storage (G-7) | Strapi's official provider; SSE-KMS, presigned reads; `npm audit` 0 vulnerabilities across its 116-package tree (with `unpdf` and `read-excel-file`) [VERIFIED: npm view, npm audit in scratchpad] |

### Existing (reused, no change)

| Library or API | Version | Purpose |
|----------------|---------|---------|
| `node:zlib` `inflateRawSync(buf, { maxOutputLength })` | Node 24.19.0 | Bounded ZIP entry inflation (DOCX, PPTX, the content check, and the guard before `read-excel-file`) |
| `node:net` | Node 24.19.0 | The `clamd` INSTREAM client |
| `node:worker_threads` `Worker(..., { resourceLimits })` | Node 24.19.0 | Extraction isolation |
| `node:crypto` `createHash('sha256')`, `randomUUID()` | Node 24.19.0 | Digests and storage keys |
| `openapi-fetch` `parseAs: "arrayBuffer"` | 0.17.0 | Binary success bodies; JSON error bodies still parsed [VERIFIED in 19-RESEARCH: `dist/index.mjs:183-198`] |
| React Flight typed-array rows | React 19.2.4 in Next 16.3.6 | `Uint8Array` Server Action returns (Settled 1) |
| Strapi upload plugin | 5.51.0 | Provider and file record (bypassing its upload service) |
| Phase 12 `csrm/ai/data-policy.ts`, `assessment-context.ts`, `prompt-data.ts` | planned | Ceiling check, builder extension point, escaping |
| Phase 13 `request-lock.ts` (`withRequestLock`), `request-notes-policy.ts` (`acceptsNotes`, `canUseRequestNotes`), `request-people.ts` | planned | Serialisation, window, readers, projections |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `unpdf` | `pdfjs-dist` 6.3.289 legacy build | Newer pdf.js and Apache-2.0, but 34.8 MB, with the optional native `@napi-rs/canvas`, which pnpm would try to install. It also needs a worker-source setup in Node. A fallback if `unpdf` falls behind on a pdf.js security fix (`definePDFJSModule(() => import('pdfjs-dist/legacy/build/pdf.mjs'))` swaps the engine behind the same API) |
| `unpdf` | `pdf-parse` 2.4.5 | Apache-2.0, but it hard-depends on `@napi-rs/canvas` 0.1.80 (native) and pins `pdfjs-dist` 5.4.296. It fails "pure JavaScript" |
| CSRM OOXML scanner | `mammoth` 1.13.0 | BSD-2-Clause (outside D-32's list), with eight dependencies including `jszip` and `@xmldom/xmldom` |
| CSRM OOXML scanner | `officeparser` 8.1.0 | MIT, one library for everything, but it brings `tesseract.js` (OCR, out of scope), `pdfjs-dist` 6.2.108 and `file-type` 22, for 31 MB |
| CSRM ZIP reader | `fflate` 0.8.3 direct | Already transitive through `read-excel-file`. Its `unzipSync` sizes output from the declared `originalSize`, so the actual-size bound still needs zlib. Not needed |
| Dependency-free sniff | `file-type` 21.3.4 (already in the tree through `@strapi/upload`) | ESM-only; returns `application/zip` for many Office files; positive allow-list matches gain nothing |
| Presigned GET for S3 reads | `@aws-sdk/client-s3` `GetObjectCommand` directly | It would have to become a direct dependency under pnpm's strict layout; the provider's `getSignedUrl` gives the same read with no new direct dependency |
| Provider override in `register()` | A provider module path in `config/plugins.ts` | The path is lower-cased (`register.js:55`) and resolved from the pnpm store: Linux breaks |
| Provider override in `register()` | A local `strapi-provider-upload-*` package | Resolution from the plugin's folder depends on pnpm hoisting of a `file:` dependency [ASSUMED]; more moving parts |

**Installation (Strapi only; executed by the dependency plan, after its checkpoint):**
```bash
export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm --filter @csrm/strapi add unpdf@1.8.1 read-excel-file@9.3.10 @strapi/provider-upload-aws-s3@5.51.0 --save-exact
```

**Version verification (2026-10-01):**
- `npm view unpdf version` → 1.8.1;
- `read-excel-file` → 9.3.10;
- `@strapi/provider-upload-aws-s3@5.51.0` exists (latest is 5.56.0, published 2026-09-30, which does not match the repository's Strapi 5.51.0 pin);
- `@strapi/strapi` latest is 5.56.0.

## Package Legitimacy Audit

Ran `gsd-tools query package-legitimacy check --ecosystem npm` on 2026-10-01:

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| unpdf 1.8.1 | npm | latest 2026-08-13 | 5,492,282/wk | github.com/unjs/unpdf | [OK] | Approved |
| read-excel-file 9.3.10 | npm | latest 2026-08-10 | 2,787,807/wk | gitlab.com/catamphetamine/read-excel-file | [OK] | Approved (shared with Phase 19) |
| @strapi/provider-upload-aws-s3 5.51.0 | npm | 5.51.0 from 2026-07-23; the package's latest (5.56.0) is one day old | 99,977/wk | github.com/strapi/strapi | [SUS] (reason `too-new`: refers to 5.56.0, not the pinned 5.51.0) | Kept, flagged. G-7 names it; the planner adds a `checkpoint:human-verify` before the install, confirming the pin equals `@strapi/strapi` |
| saxen 11.2.0 (transitive via read-excel-file) | npm | latest 2026-09-21 | — | github.com/nikku/saxen | [SUS] (`too-new`) | Kept, flagged (same disposition as 19-RESEARCH: installed, not loaded by the code paths used). Same checkpoint |
| fflate 0.8.3 (transitive) | npm | 2026-05-16 | 103M/wk | github.com/101arrowz/fflate | [OK] | Must resolve to 0.8.3 (GHSA-px8p-9vwx-vf98 below it) |
| unzipper-esm 0.13.3, worker-f 0.1.20 (transitive) | npm | 2026-07/08 | — | — | [OK] | Approved |
| file-type 22.1.1 | npm | 2026-09-17 | 66.9M/wk | github.com/sindresorhus/file-type | [SUS] (`too-new`) | Not added (Settled 4) |

- **Postinstall scripts:** none (`postinstall: null` from the seam for all of the above).
- **Advisories:** `npm audit` over a scratchpad install of the three direct packages (116 packages) reported `{"info":0,"low":0,"moderate":0,"high":0,"critical":0}`.
- **Install size:** 33 MB, almost all of it the AWS SDK.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `@strapi/provider-upload-aws-s3` (only because a newer version is fresh) and `saxen`. The planner inserts one `checkpoint:human-verify` before the install task.

## Architecture Patterns

### System Architecture Diagram

```
UPLOAD (one file per Server Action; the queue runs them one by one)
 Browser: choose files ─► client pre-check (extension, size ≤ 25 MiB, count) ─► queue: Waiting → Adding
     │  FormData { requestId, file, noteId? }
     ▼
 proxy.ts gate: next-action POST? ── path not an attachment page and (Content-Length > 6 MiB or absent) ─► 413
     ▼  (proxyClientMaxBodySize 26mb, bodySizeLimit 26mb)
 Server Action uploadAttachmentAction ─► attachments-service (openapi-fetch multipart) ─► POST /api/v1/assessment_requests/{id}/attachments
     ▼
 Strapi: strapi::body (formidable → os temp file) ─► global::csrm-multipart-cleanup (finally: remove every temp file)
     ▼
 policy: grant (attachments_api) ─► controller: parts exactly {file, noteId?} else 400
     ▼
 record rule canUseRequestNotes ─ no ─► 404 ; window/note pre-check ─ fail ─► 409
     ▼
 read bytes ─► size (413) ─► name sanitise ─► content check (extension × signature × OOXML/CFB/PDF-open/text) ─ fail ─► 415
     ▼
 sha256 ─► scanner port ─┬─ infected ─► 422 + warning event, nothing stored
                         ├─ clean ─────┐
                         └─ not-scanned ┴─► storage port put (provider.upload + plugin file record)
     ▼
 withRequestLock(request): re-check window, note, active count ≤ 20, lifetime ≤ 60 ─ refuse ─► delete bytes + 409
     ▼
 create CsrmRequestAttachment (scanStatus clean|pending, eventLog) ─► security event line ─► 201 { attachment }
                                                    pending ─► re-scan scheduler (backoff, boot) ─► clean | blocked(delete bytes)

DOWNLOAD
 Files panel ─► downloadAttachmentAction ─► service (parseAs arrayBuffer) ─► GET …/attachments/{id}/content
   Strapi: grant ─► record rule (404) ─► state (409 quarantined|blocked|removed) ─► storage port read
           ─► sha256 = recorded? ─ no ─► 409 INTEGRITY_FAILED + warning event
           ─► headers (attachment; filename + filename*; type; nosniff; no-store; CSP sandbox) ─► event line ─► bytes
   web: file-response validator (type = recorded, name pattern, size ≤ bound, signature) ─► { fileName, contentType, bytes: Uint8Array }
 Browser: saveFile (Blob + anchor)

AI INCLUSION
 Analyst toggles ─► PUT …/ai_input {included:true} ─► human-only + OWN_REQUEST + window + data policy + clean/text-bearing
   ─► extraction worker (≤ 30 s, ≤ 768 MB heap) ─► cap 20,000, facts ─► store aiText under lock ─► event ─► 200
 Generation (Phase 12 builder) ─► included files' aiText in upload order, each a delimited untrusted block
   ─► per-run bound (CONTEXT_TOO_LARGE) ─► run contextSummary.attachments (ids, digest, type, counts; no text, no name)
```

### Recommended Project Structure

```
apps/backend/src/
├── csrm/files/                         # the attachment pipeline Phase 20 reuses
│   ├── attachment-config.ts            # D-15: reads env, validates, development double key, boot errors
│   ├── attachment-policy.ts            # limits, retention constant, allowed types, media types, name sanitiser
│   ├── storage-port.ts                 # put/read/delete over the plugin provider; local + s3 adapters
│   ├── private-local-provider.ts       # the provider object installed with provider.extend()
│   ├── zip-archive.ts                  # central directory + bounded inflate (Phase 19's guard calls it)
│   ├── content-check.ts                # extension × signature × OOXML/CFB/text; returns type or closed refusal
│   ├── ooxml-text.ts                   # the DOCX/PPTX text scanner (no DTD)
│   ├── extraction.ts                   # runs the worker; single-slot queue; caps and facts
│   ├── extraction-worker.ts            # PDF open + text, OOXML, XLSX, text; posts {ok,text,facts}|{error}
│   ├── scanner.ts                      # MalwareScanner port, selection, development double
│   ├── clamav-scanner.ts               # INSTREAM adapter (node:net)
│   └── rescan-scheduler.ts             # pending re-scans with backoff; boot; destroy
├── csrm/spreadsheets/xlsx-reader.ts    # the only importer of read-excel-file (Phase 19 extends)
├── csrm/audit/security-event-log.ts    # one structured line per event (Phase 19 and Phase 17 extend)
├── middlewares/csrm-multipart-cleanup.ts  # global, after strapi::body
└── api/csrm-request-attachment/
    ├── content-types/csrm-request-attachment/schema.json   # no routes folder for a core router (D-01)
    ├── routes/request-attachments.ts   # custom routes only
    ├── controllers/request-attachments.ts
    ├── services/request-attachments.ts, attachment-event-log.ts, attachment-projection.ts
    └── operations.ts
apps/csrm/
├── proxy.ts                            # + the Server Action body gate
├── next.config.ts                      # + bodySizeLimit and proxyClientMaxBodySize '26mb'
└── src/
    ├── lib/files/file-response.ts      # shared validator (per-operation name pattern and types); Phase 19 reuses
    ├── lib/files/save-file.ts          # Blob + anchor; Phase 19 moves the CSV helper onto it
    └── features/attachments/
        ├── attachments-domain.ts       # zod-free: states, limits, allowed types, presentation for Client Components
        ├── attachments-schema.ts, attachments-service.ts, attachments-actions.ts
        ├── files-panel.tsx, upload-queue.tsx (lazy), file-row.tsx, attachment-ai-control.tsx
        └── *.test.ts(x)
```

### Pattern 1: The storage port

**What:** one module hides the provider. Its interface is `put(bytes, { ext, mime }) → StoredFile`, `read(stored) → Uint8Array` and `remove(stored)`. Callers never see a provider, a URL or a hash.
**Why:** Phase 20 reuses it unchanged, and tests exercise it through the local adapter and the fake object store.
- **`put`:**
  - generates `hash` = `csrm_` plus 32 hex characters;
  - calls `provider.upload({ hash, ext, mime, buffer, size, name })`;
  - creates the plugin file record with `provider: config.provider`;
  - returns its id.
- **`read`:**
  - **local:** reads the file at `path.join(root, hash + ext)`, after checking that `hash` matches `^csrm_[0-9a-f]{32}$` (no path traversal);
  - **s3:** gets a presigned URL, refuses one without `X-Amz-Signature`, fetches it with `redirect: 'error'`, and checks the `content-length` against the bound before buffering.
- **`remove`:** `provider.delete(file)` plus deleting the plugin file record. Used only for blocked files and late refusals (D-10, D-21).

### Pattern 2: The upload pipeline (cheap refusals first, lock last)

Order: grant (policy) → parts → record rule (404) → window and note pre-check (409) → size (413) → name → content (415) → digest → scan (422 or verdict) → storage `put` → `withRequestLock` (re-check window, note, count and lifetime; create the record) → event line → 201.
- **Outside the lock:** the scan and the storage write, so a slow scan never holds the request lock.
- **Inside the lock:** only the final checks and the insert, as D-10 requires.
- **Late refusals:** a refusal inside the lock deletes the stored bytes and file record.
- **Temporary files:** formidable's file is deleted by the cleanup middleware whatever happened.

**The readers predicate:** call Phase 13's `canUseRequestNotes(request, caller)` (or its shared rename) and nothing else (D-18). Test "is the caller this request's requestor" first (13-RESEARCH Pitfall 5).

### Pattern 3: The content check returns a type or a closed refusal

`checkContent({ fileName, bytes }) → { type: AttachmentType } | { refusal: AttachmentRefusal }` is pure apart from the PDF open, which is injected (a worker call), so unit tests run it without a worker. Every refusal reason is one value of a closed union that both sides mirror (Phase 10's list).

### Pattern 4: Scanner port with adapters, selected by configuration

`selectScanner(config)` returns the double (development key only) or the ClamAV adapter; with no scanner configured outside development, uploads are refused (`ATTACHMENTS_NOT_CONFIGURED`). Integration tests point the ClamAV adapter at the fake `clamd`, so production code carries no test mode (D-14).

### Pattern 5: Current facts plus an append-only event log (06.8)

Gates read `scanStatus`, `removedAt`, `aiTextIncluded` and `note`, never `eventLog`. The log is versioned (`schemaVersion: 1`), parsed closed and capped at 200 events. A malformed log projects as "history unavailable" and never denies a read.

### Pattern 6: Extraction in a worker, on opt-in

`extractText({ type, bytes }) → { text, available, kept, truncated, extractor } | { refusal: "ATTACHMENT_TEXT_UNAVAILABLE" }`.
- **The worker:** `new Worker(path.join(__dirname, "extraction-worker.js"), { workerData, resourceLimits: { maxOldGenerationSizeMb: 768 } })`, with a 30 s timer and `terminate()` on overrun.
- **Concurrency:** extractions run one at a time.
- **The bytes:** passed as a transferable `ArrayBuffer` (`transferList`), so they are not copied.
- **Versioning:** `extractor` is a code constant (for example `csrm-extract/1 unpdf/1.8.1 read-excel-file/9.3.10`) recorded in `aiTextFacts`.

### Pattern 7: Attachment blocks in the untrusted data block (D-34)

Phase 12's builder renders each included file as a block built from code constants and integers, with the text escaped by `promptDataTag`'s rules:
```
<attachment n="2" type="pdf" part="requestor" truncated="true" kept="20000" available="85412">…escaped text…</attachment>
```
- **Attributes:** all from closed enums or integers, never a name, time, id or request number.
- **Where it sits:** inside `<requestorData>`, whoever uploaded the file, because attachment text is untrusted either way.
- **One helper for notes and attachments:** `promptDataTag(label, value)` takes no attributes today [VERIFIED: `apps/backend/src/csrm/prompt-data.ts:8-10`, `return \`<${label}>${value.replace(/[&<>]/g, …)}</${label}>\``]. Reuse whatever attribute-capable helper Phase 13's notes block adds; if none exists when this plan runs, add `promptDataBlock(label, attributes, value)`, with attribute values restricted to `[a-z0-9-]` and integers.

### Pattern 8: The shared file transfer (web; Phase 19 reuses)

- **The validator:** `validateFileResponse(response, rule)`, where a `rule` names the allowed content types, the name pattern, the size bound and the signature check:
  - **Attachments:** the type must equal the recorded type. The name may not contain `/`, `\`, C0 controls or bidi overrides, is at most 255 characters, and its extension must match the type. The size is ≤ 26,214,400 bytes. The signature is `%PDF`, PNG, JPEG, `PK\x03\x04` or text.
  - **Exports:** Phase 19's own rule (`^[a-z0-9][a-z0-9-]{0,150}\.(csv|xlsx)$`).
- **The Content-Disposition name:** the service reads `filename*` (RFC 5987, `UTF-8''` percent-encoded) and falls back to `filename`.
- **The Action:** returns `{ ok: true, fileName, contentType, bytes: new Uint8Array(arrayBuffer) }` or a closed refusal.

### Anti-Patterns to Avoid

- **The plugin's `upload` service for attachments.** It optimises images and names keys after the upload (D-06, D-07).
- **A provider configured by file path.** It is lower-cased and resolved from the pnpm store.
- **`ACL: 'private'` in the S3 params.** It fails on AWS's default buckets; omitting the key entirely makes objects `public-read`.
- **`unpdf`'s `extractText`.** It loads every page concurrently.
- **A route-level middleware for temporary-file cleanup.** It never runs when a policy refuses.
- **The EICAR literal anywhere in the repository.**
- **Reading `eventLog` in a gate.**
- **A Route Handler or raw `fetch` for downloads.**
- **The file name in the prompt, the run summary, the security event or a storage key.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF parsing and text layout | A PDF tokenizer | `unpdf` (pdf.js) | Cross-reference streams, object streams, encodings, CMaps, encryption detection |
| XLSX cell reading | A sheet XML reader | `read-excel-file/universal` | Shared strings, inline strings, dates, booleans, cached formula values |
| Decompression bounds | Byte counting around a stream | `zlib.inflateRawSync(…, { maxOutputLength })` | Built in; throws `ERR_BUFFER_TOO_LARGE` |
| Object storage protocol | Signing S3 requests | `@strapi/provider-upload-aws-s3` (`getSignedUrl`, SSE-KMS) | SigV4, multipart and checksums |
| Malware detection | Signature matching | `clamd` with `freshclam` (deployment) | The double flags only test strings |
| Binary transport | base64 in JSON, or a Route Handler | `Uint8Array` from the Server Action | Raw Flight rows (Settled 1) |
| Request serialisation | A new lock | Phase 13's `withRequestLock` | One tail map plus `FOR UPDATE` |
| Readers rule | A second predicate | Phase 13's `canUseRequestNotes` | Notes and files can never drift (D-18) |
| UTF-8 validation | A byte checker | `TextDecoder('utf-8', { fatal: true })` | Exact WHATWG semantics |

**Key insight:** the risk sits around the formats, not in them: bodies truncated by the proxy, temporary files left behind, a default public ACL, a CDN URL returned unsigned, a test string on a scanned disk. Libraries cover the formats, and CSRM's own modules own every bound, refusal and storage decision, in one place each.

## Common Pitfalls

### Pitfall 1: The proxy truncates uploads over 10 MB
**What goes wrong:** a 12 MB PDF fails to decode in the action (or arrives corrupt), while a 5 MB file works.
**Why it happens:** `proxy.ts` matches every page path; Next clones the body for the proxy, and above `proxyClientMaxBodySize` (default 10 MB) it ends the replacement body early (`body-streams.js:95-106`), only warning on the console.
**How to avoid:** set `experimental.proxyClientMaxBodySize: '26mb'` with `bodySizeLimit`, and add a Playwright or integration upload of about 20 MB.
**Warning signs:** `Request body exceeded 10MB for /app/requests/…` in the web server log.

### Pitfall 2: Temporary files leak for the `file` part
**What goes wrong:** every attachment upload, refused or not, and every CSV import today leaves a formidable file in the OS temp directory.
**Why it happens:** `strapi::body` removes only `ctx.request.files.files` (`body.js:23`, `:59-68`), and the parts here are named `file`.
**How to avoid:**
- add `global::csrm-multipart-cleanup` immediately after `strapi::body` in `config/middlewares.ts`;
- in its `finally`, remove every `filepath` under every key of `ctx.request.files` (arrays included), awaited and errors swallowed;
- record it in `strapi-http-hardening.md`.

It also fixes the CSV import's leak (Phase 19 benefits).
**Warning signs:** `ls $TMPDIR` grows after the integration suite. The test lists formidable's upload directory before and after a refused upload.

### Pitfall 3: Route middlewares never run on a refusal
**What goes wrong:** cleanup or bounds placed in a route's `config.middlewares` are skipped for 403 and 404 callers.
**Why it happens:** Strapi composes `routeInfo, authenticate, authorize, policies, ...middlewares, returnBody, action` [VERIFIED: `@strapi/core/dist/services/server/compose-endpoint.js:64-72`].
**How to avoid:** global middleware for cleanup; policies and controllers for refusals.

### Pitfall 4: The S3 provider's default ACL
**What goes wrong:** objects become `public-read`, or every upload fails with `AccessControlListNotSupported`.
**How to avoid:** `params: { Bucket, ACL: undefined, signedUrlExpires: 60 }`, Block Public Access on the bucket, and a unit test of the configuration builder asserting `'ACL' in params && params.ACL === undefined`.

### Pitfall 5: A configured `baseUrl` returns unsigned URLs
**What goes wrong:** `getSignedUrl` returns `file.url` unchanged when `baseUrl` is set (`index.js:338`, `isUrlFromBucket` → `false`), so the read path fetches a CDN URL.
**How to avoid:** the configuration refuses a `baseUrl` (boot failure), and the read refuses a URL without `X-Amz-Signature`.

### Pitfall 6: The fake object store versus SDK framing
**What goes wrong:** the fake store's GET returns bytes that fail the digest check.
**Why it happens:**
- `@aws-sdk/lib-storage`'s `Upload` switches to multipart above its default 5 MiB part size;
- recent SDK versions add default integrity checksums, possibly sending `aws-chunked` bodies [ASSUMED: SDK v3 behaviour, not run here].

**How to avoid:** tests through the fake store use files under 5 MiB. The fake decodes `content-encoding: aws-chunked` framing, or stores the body as received and returns it, and the test asserts the digest round trip. The 25 MiB path is proven on the local adapter.

### Pitfall 7: EICAR on a Windows disk
**What goes wrong:** Defender quarantines a source file, a compiled `.js`, a fixture or formidable's temporary file, and suites fail intermittently.
**How to avoid:**
- build the string from fragments in the double and in its one test;
- give suites the CSRM test signature;
- add a repository check: `git grep -n "ANTIVIRUS-TEST" -- apps` prints nothing.

### Pitfall 8: The worker file is not emitted for unit tests
**What goes wrong:** `extraction.ts` spawns `extraction-worker.js`, and the unit test fails with `Cannot find module`.
**Why it happens:** `apps/backend/tests/tsconfig.json` compiles test files, helpers and whatever they import. Nothing imports the worker entry; it is loaded by path [VERIFIED: `tests/tsconfig.json` `include`].
**How to avoid:** add `"../src/csrm/files/extraction-worker.ts"` to the tests' `include`. The Strapi build (`tsc` over `src`) emits it into `dist/` for runtime.

### Pitfall 9: formidable's own 413 carries no CSRM reason
**What goes wrong:** a file over 50 MiB is refused by `strapi::body` with `ctx.payloadTooLarge('FileTooBig')` [VERIFIED: `body.js:48-50`], before any policy, without `details.reason`.
**How to avoid:** the web service maps any 413 without a known reason to `ATTACHMENT_TOO_LARGE`'s copy. The web pre-check and Next's 26 MiB limit stop such files first in practice.

### Pitfall 10: `unpdf` logs and loads every page at once
**What goes wrong:** heap spikes on large PDFs, and pdf.js writes `Warning: Indexing all PDF objects` to stdout (seen in the probe).
**How to avoid:** sequential pages with `cleanup()`, and `verbosity: 0` in the options.

### Pitfall 11: Re-scan timers outlive Strapi
**What goes wrong:** `node --test` hangs after a suite, or a re-scan runs against a destroyed Strapi.
**How to avoid:** `unref()` every timer, keep the handles in the scheduler, clear them in the app's `destroy()`, and give the scheduler an injectable clock for unit tests.

### Pitfall 12: The contract guards assume JSON
(19-RESEARCH Pitfall 6.) The parity guard and `contract-catalogue` read `content['application/json']`.
- **Binary response:** declare the download's 200 under eight media types (`application/pdf`, the three OOXML types, `text/csv`, `text/plain`, `image/png`, `image/jpeg`), each `{ type: "string", contentMediaType: … }`, with JSON error bodies.
- **Multipart request:** declare the upload body as `multipart/form-data` `{ file: { type: "string", format: "binary" }, noteId? }`, with `additionalProperties: false`, following `AdministrationImportPreviewRequest` [VERIFIED: the spec].
- **The first contract plan** adds the parity guard's `file-response` mode.

### Pitfall 13: The service agent through the birthright, and a requesting analyst
(13-RESEARCH Pitfalls 4 and 5.) The agent holds `attachments_api` through `role.requestor`. Only `canUseRequestNotes` (the human-analyst path through `hasHumanAnalystOperation`) and requestor-first checks keep it, and a requesting analyst, in their place.

### Pitfall 14: Raw knex inside the lock
(13-RESEARCH Pitfall 1.) Count active and stored attachments with `strapi.db.query(uid)` inside `withRequestLock`, never the raw connection.

### Pitfall 15: `Content-Disposition` for non-ASCII names
Koa's `ctx.attachment()` emits `filename*` only for non-ASCII names (19-RESEARCH). Set the header explicitly:
- the ASCII `filename` replaces non-ASCII characters, `"` and `\` with `_`;
- `filename*=UTF-8''` uses `encodeURIComponent`, then percent-encodes `'()*`.

### Pitfall 16: The `fflate` resolution
(19-RESEARCH Pitfall 13.) After the install, `pnpm why fflate` shows only 0.8.3.

### Pitfall 17: Action forwarding doubles a 25 MiB upload
**What goes wrong:** after UI-D3's `replaceState`, the upload action posts to the edit route. If that route's bundle does not include the action, Next forwards the whole request to another worker (`action-handler.js:494-507`).
**How to avoid:** every page that hosts the queue imports the same upload action module. A unit test can assert that the action module is imported by each page component that renders the uploader.

### Pitfall 18: A refresh during the queue unmounts the new form
**What goes wrong:** `revalidatePath`, `router.refresh` or `redirect` from any action while files are queued re-renders the route for the replaced URL.
**How to avoid:** no revalidation in upload actions on the new form; one `router.replace` after the queue settles. The queue state lives in the `(app)` provider (UI-D35) as a second line of defence.

## Code Examples

### 1. The `proxy.ts` gate and `next.config.ts`
```ts
// apps/csrm/next.config.ts (experimental block). Source: bundled serverActions.md and proxyClientMaxBodySize.md
experimental: {
  serverActions: { bodySizeLimit: '26mb' },   // 27,262,976 bytes: one 25 MiB file plus multipart overhead
  proxyClientMaxBodySize: '26mb',             // must be >= bodySizeLimit, or the body reaching the action is truncated
},

// apps/csrm/proxy.ts, at the top of proxy(): the default ceiling everywhere except the attachment pages
const DEFAULT_ACTION_BODY_LIMIT = 6_291_456; // today's '6mb'
const ATTACHMENT_ACTION_PATHS = [/^\/app\/requests\/new$/, /^\/app\/requests\/[^/]+(\/edit)?$/, /^\/app\/review\/requests\/[^/]+$/]; // UI-SPEC confirms
export function exceedsActionBodyLimit(request: NextRequest): boolean {
  if (request.method !== 'POST' || !request.headers.has('next-action')) return false;
  if (ATTACHMENT_ACTION_PATHS.some((pattern) => pattern.test(request.nextUrl.pathname))) return false;
  const length = Number(request.headers.get('content-length') ?? Number.NaN);
  return !Number.isFinite(length) || length > DEFAULT_ACTION_BODY_LIMIT;
}
// in proxy(): if (exceedsActionBodyLimit(request)) return new NextResponse(null, { status: 413 });
```

### 2. Provider override and route unmount in the application's `register()`
```ts
// apps/backend/src/csrm/files/register-attachment-storage.ts. Sources: register.js:92 (extend), content-api-router.js:21-27 (setter)
export function registerAttachmentStorage(strapi: Core.Strapi): void {
  const config = readAttachmentConfig(process.env);            // throws AttachmentConfigurationError on invalid values (D-15)
  const upload = strapi.plugin("upload");
  if (config.storage?.kind === "local") upload.provider.extend(createPrivateLocalProvider(config.storage.directory));
  (upload.routes["content-api"] as { routes: unknown[] }).routes = []; // D-08: POST /api/upload and /api/upload/files* unmounted
}
// apps/backend/src/index.ts register(): assertCsrmAiConfiguration(strapi); registerAttachmentStorage(strapi); …
```

### 3. The S3 provider configuration (`config/plugins.ts`)
```ts
// Source: @strapi/provider-upload-aws-s3@5.51.0 dist/index.js:130-131, :184-190, :353
upload: { config: {
  security: { allowedTypes: allowedMediaTypes, deniedTypes: deniedExecutableTypes },
  ...(env('CSRM_ATTACHMENT_STORAGE') === 's3' ? {
    provider: 'aws-s3',
    providerOptions: {
      rootPath: 'csrm/attachments',
      s3Options: {
        region: env('CSRM_ATTACHMENT_S3_REGION', 'ap-southeast-2'),
        ...(env('CSRM_ATTACHMENT_S3_ENDPOINT') ? { endpoint: env('CSRM_ATTACHMENT_S3_ENDPOINT'), forcePathStyle: true } : {}),
        params: { Bucket: env('CSRM_ATTACHMENT_S3_BUCKET'), ACL: undefined, signedUrlExpires: 60 }, // 'ACL' present ⇒ no public-read default
      },
      providerConfig: { encryption: { type: 'aws:kms', kmsKeyId: env('CSRM_ATTACHMENT_S3_KMS_KEY_ID') } },
    },
  } : {}),
} },
```

### 4. The content check (outline)
```ts
// Sources: D-09; signatures per the formats; ASVS V5.2.2 / V5.2.3 (seeded control library, verbatim above)
export function checkContent(input: { extension: string; bytes: Uint8Array; pdf: PdfProbe }): Promise<ContentResult> {
  const claimed = claimedType(input.extension);          // null → refusal by extension family (macro / legacy / not allowed)
  const detected = sniff(input.bytes);                   // 'pdf' | 'png' | 'jpeg' | 'zip' | 'cfb' | 'text' | 'binary'
  if (detected === "cfb") return refuse(hasEncryptedPackage(input.bytes) ? "ATTACHMENT_ENCRYPTED" : "ATTACHMENT_LEGACY_OFFICE");
  if (detected === "zip") return ooxmlType(input.bytes)   // central directory bounds, [Content_Types].xml ≤ 1 MiB, vbaProject.bin
    .then((ooxml) => ooxml.macro ? refuse("ATTACHMENT_MACRO_ENABLED") : agree(claimed, ooxml.type));
  if (detected === "pdf") return input.pdf(input.bytes).then((opened) => opened.password ? refuse("ATTACHMENT_ENCRYPTED")
    : opened.ok ? agree(claimed, "pdf") : refuse("ATTACHMENT_CONTENT_MISMATCH"));
  …
}
```

### 5. The `clamd` INSTREAM client
```ts
// Source: docs.clamav.net/manual/Usage/ClamdProtocol.html (INSTREAM, 4-byte network-order lengths, zero-length terminator)
import { connect } from "node:net";
export function clamdInstream(options: { host: string; port: number; timeoutMs: number }, bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: options.host, port: options.port });
    const chunks: Buffer[] = [];
    socket.setTimeout(options.timeoutMs, () => socket.destroy(new Error("CLAMD_TIMEOUT")));
    socket.once("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.length; offset += 65_536) {
        const chunk = bytes.subarray(offset, Math.min(offset + 65_536, bytes.length));
        const length = Buffer.alloc(4); length.writeUInt32BE(chunk.length);
        socket.write(length); socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));                       // 00 00 00 00 ends the stream
    });
    socket.on("data", (data) => chunks.push(data));
    socket.once("end", () => resolve(Buffer.concat(chunks).toString("utf8").replace(/\0+$/, "").trim()));
    socket.once("error", reject);                          // EPIPE/ECONNRESET when clamd closes on StreamMaxLength
  });
}
// reply mapping: "stream: OK" → clean; /^stream: (.+) FOUND$/ → infected (Heuristics.Limits.Exceeded.* → not-scanned/limits);
// /size limit exceeded/i or /ERROR$/ → not-scanned
```

### 6. The development double without the literal
```ts
// The EICAR test string never appears on disk, in any fragment that spells it (D-14; Pitfall 7).
// The module stores it encoded (for example its 68 bytes XOR 0x5A, as a hex constant the plan's executor generates once
// in memory from the published EICAR specification) and decodes it at module load.
const EICAR = decodeStoredSignature(EICAR_ENCODED);       // 68 bytes after decoding
// The double's unit test asserts the decoded length (68) and its SHA-256 against the value published with the
// EICAR specification, so the test file holds no spelling of the string either.
const CSRM_TEST_SIGNATURE = "CSRM-TEST-MALWARE-SIGNATURE-7c1e4a";
export const developmentScanner: MalwareScanner = {
  name: "csrm-development-double/1",
  async scan(bytes) {
    const text = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
    if (text.includes(EICAR)) return { kind: "infected", engine: this.name, detection: "Eicar-Test-Signature" };
    if (text.includes(CSRM_TEST_SIGNATURE)) return { kind: "infected", engine: this.name, detection: "Csrm.Test.Signature" };
    return { kind: "clean", engine: this.name };
  },
};
```
(No readable fragment of the string belongs in source, tests, fixtures or planning documents. That keeps the repository check in Pitfall 7, `git grep -n "ANTIVIRUS-TEST" -- apps` printing nothing, meaningful.)

### 7. The download response in Strapi
```ts
// Sources: Koa 2.16.4 response API; RFC 6266 / RFC 5987; D-23
export function sendAttachment(ctx: KoaLikeContext, file: { name: string; mediaType: string; bytes: Buffer }): void {
  const ascii = file.name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(file.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  ctx.set("Content-Disposition", `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`);
  ctx.set("X-Content-Type-Options", "nosniff");
  ctx.set("Cache-Control", "no-store");
  ctx.set("Content-Security-Policy", "default-src 'none'; sandbox");
  ctx.type = file.mediaType;
  ctx.body = file.bytes;
}
```

### 8. The extraction worker (PDF branch)
```ts
// Source: unpdf dist/index.cjs (getDocumentProxy passes options to pdf.js getDocument); probe on Node 24.19.0
import { parentPort, workerData } from "node:worker_threads";
import { getDocumentProxy } from "unpdf";
async function pdfText(bytes: Uint8Array, cap: number) {
  const pdf = await getDocumentProxy(bytes, { isEvalSupported: false, verbosity: 0 });
  try {
    let kept = "", available = 0;
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : "")).join("") + "\n";
      available += text.length;
      if (kept.length < cap) kept += text.slice(0, cap - kept.length);
      page.cleanup();
    }
    return { kept, available };
  } finally { await pdf.loadingTask.destroy(); }   // PDFDocumentProxy.destroy is not a function in unpdf 1.8.1 (probe)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middlewareClientMaxBodySize` | `experimental.proxyClientMaxBodySize` (middleware renamed to proxy in Next 16) | Next 16 | Older guidance names the old key; the warning text still links to the old page (`body-streams.js:102`) |
| S3 objects with `ACL: 'private'` | Bucket owner enforced (ACLs disabled) by default; no ACL header | AWS, April 2023 | Omit the ACL; rely on Block Public Access and the bucket policy |
| `clamd` 0.103 limits of 25M, 25M and 100M | 100M, 100M and 400M | ClamAV 1.x | Deployments on old images need explicit limits |
| pdf.js with `isEvalSupported` true by default (CVE-2024-4367) | Fixed in 4.2.67; `unpdf` 1.8.1 bundles 6.1.200 with no `new Function` | 2024 | Still pass `isEvalSupported: false` |
| `read-excel-file` `readSheetNames()` | The default export returns all sheets | 8.x | Use the default export for extraction and `readSheet` for imports |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Windows Defender on the build host quarantines a source or compiled file containing the EICAR literal | Settled 5, Pitfall 7 | Low: the fragment approach costs nothing either way |
| A2 | The OOXML main-part content-type strings and the `macroEnabled` forms | Settled 4 | Wrong refusals; caught by fixtures made by a script or Office elsewhere |
| A3 | An encrypted OOXML file is a CFB container with an `EncryptedPackage` stream | Settled 4 | Wrong copy (says old Office); no security impact |
| A4 | clamd's `M` suffix is MiB, and 30M covers 25 MiB | Settled 5 | Edge-size files are quarantined as `limits`; the README requirement still holds |
| A5 | The SDK's default checksums may use `aws-chunked` bodies against the fake store | Pitfall 6 | Fake-store tests fail until the fake decodes the framing |
| A6 | Memory per in-flight upload is about 50–80 MiB on the web server | Settled 6 | Higher memory under concurrent uploads; the reverse-proxy limit and one upload per tab bound it |
| A7 | The bounds in Settled 7 (60 minutes, 60 files, 20k/60k/30k characters, the ZIP limits, worker 768 MB and 30 s, 24 re-scans) | Settled 7 | Tuning only; each is one constant |
| A8 | pnpm hoisting would not resolve a local `file:` provider package from the plugin's folder | Alternatives | None (not recommended) |
| A9 | A real browser decodes the 25 MiB Flight row as the browser client build did under Node | Settled 1 | Covered by the Playwright download check, at a smaller size |
| A10 | Excluding PPTX speaker notes is the right minimal choice (G-3) | Settled 3 | The analyst may want notes later; one flag in the extractor |

## Open Questions

1. **Phase 19 alignment (orchestrator).**
   - What we know: 19-RESEARCH names `csrm/spreadsheets/zip-guard.ts`, `xlsx-reader.ts`, `csrm/audit/security-event-log.ts`, `lib/files/file-response.ts` and `save-file.ts`, and installs `read-excel-file` itself.
   - What's unclear: Phase 19's plans are not yet written against this phase's outputs.
   - Recommendation: Phase 14 builds `csrm/files/zip-archive.ts` (which Phase 19's guard calls), `xlsx-reader.ts`, the event log and the two web modules (with per-operation rules), and installs `read-excel-file@9.3.10` behind the `saxen` checkpoint. Phase 19's plans then reuse them, and only add `write-excel-file`.
2. **ISM-2059 and quarantine storage.**
   - What we know: the seeded ISM-2059 reads "malicious content scanning occurring prior to file access, file execution or file storage", while D-13 stores unscanned files in quarantine when the scanner is unavailable (fail closed for access, not for storage).
   - Recommendation: keep D-13 (locked), and record the reading in the contract-gap record and the residual register: quarantined bytes are stored but never accessible. An operator who reads ISM-2059 strictly can disable quarantine with a future setting.
3. **The 25 MiB browser measurement.**
   - What we know: the Flight path is verified in Node, with the browser client build.
   - Recommendation: the Playwright journey downloads a file and records the time. A 24 MiB fixture download runs once in the Strapi integration suite (bytes and digest), not in Playwright, to keep the E2E fast.
4. **`422` joins the contract.**
   - What we know: no operation returns 422 today.
   - Recommendation: accept it for `ATTACHMENT_MALWARE_FOUND` (Settled 8). The alternative is 415, which misdescribes the refusal.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 | All gates; worker threads; `maxOutputLength` | ✓ | 24.19.0 at `/c/ProgramData/nvm/v24.19.0` (the PATH default is 22.19.0) | — |
| pnpm | Install, scripts | ✓ | 11.24.0 (per 19-RESEARCH) | — |
| npm registry | Adding the three packages | ✓ | — | — |
| Python 3 | Optional: a fixture-generation script (OOXML via `zipfile`) | ✓ | 3.12.10 | A Node ZIP writer in the test helper |
| Chromium (Playwright) | Upload and download journeys | ✓ | Playwright 1.58.2 | — |
| `clamd` | Production scanning | ✗ (by design, G-7) | — | The fake `clamd` in tests; the development double |
| S3 bucket | Production storage | ✗ (by design) | — | The fake object store in tests; a manual operator check |
| Microsoft Office or LibreOffice | Real Office, macro and encrypted fixtures | ✗ | — | Script-generated OOXML; a hand-built CFB with `EncryptedPackage`; optional operator-made fixtures |

**Missing dependencies with no fallback:** none block execution.

**Runtime state to note:**
- After the orchestrator's next Strapi start, the development database gains the `csrm_request_attachments` table (with the media morph rows) and, on the first upload, `apps/backend/.tmp/attachments/`, which is git-ignored [VERIFIED: `git check-ignore`: `apps/backend/.gitignore:68: .tmp`].
- `public/uploads/` stays empty apart from `.gitkeep`.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **Web:** Vitest 4.1.11 (jsdom), @testing-library/react 16.3.0. **Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` into `.tmp/tests-dist`, one process and one SQLite database per file. **E2E:** Playwright 1.58.2, Chromium, production web build; `desktop` 1440×900, `mobile` 375×812 (`@journey`, `testMatch` list) |
| Config file | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json` (add `../src/csrm/files/extraction-worker.ts`, Pitfall 8); `apps/csrm/playwright.config.ts` (pin `CSRM_ATTACHMENT_STORAGE=local`, `CSRM_ATTACHMENT_LOCAL_DIR=<run temp root>/attachments`, `CSRM_ATTACHMENT_SCANNER=development`; add the new spec to the mobile `testMatch`) |
| Quick run command | **Web:** `pnpm --filter @csrm/web exec vitest run <path>`. **Strapi file** (dev servers stopped): `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js` |
| Full suite command | `pnpm --dir apps/csrm api:check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm lint && pnpm --dir apps/csrm test && pnpm --dir apps/backend test && pnpm --dir apps/csrm test:e2e && git status --short` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLLAB-02 (1) · D-09 | Every type accepted by content; renamed executable, non-OOXML ZIP, macro-enabled, encrypted (CFB `EncryptedPackage`), old Office, password PDF, PDF-named PNG, binary `.txt`, UTF-16 with BOM accepted, empty, refused with the right reason | Strapi unit | quick run `attachment-content-check.unit.test.js` | ❌ W0 |
| COLLAB-02 (1) · D-10 | Name sanitisation (path, controls, RLO and other bidi overrides, 255 with extension kept); 25 MiB and 26,214,401 bytes; 20 active; lifetime 60 | Strapi unit | quick run `attachment-policy.unit.test.js` | ❌ W0 |
| D-09 · D-32 | ZIP reader: central directory offsets, entry, ratio and total bounds, ZIP64 and encryption refused, `maxOutputLength` bomb | Strapi unit | quick run `zip-archive.unit.test.js` | ❌ W0 |
| COLLAB-02 (1) · D-16 · D-17 · D-19 | Upload at intake (draft, requestor) and after submission with own note; note window 60 min; analyst after submission; list shows name, size, uploader (projection), time; 201 with `clean` or `pending` | Strapi integration | quick run `request-attachments.integration.test.js` | ❌ W0 |
| D-10 | Two simultaneous uploads at 19 make 20, not 21; bytes of the late refusal deleted | Strapi integration | quick run `request-attachments.integration.test.js` (race case) | ❌ W0 |
| COLLAB-02 (2) · D-11 · D-12 · D-14 | Double flags the CSRM signature (integration) and in-memory EICAR (unit); ClamAV adapter vs fake `clamd`: clean, found, `Heuristics.Limits.Exceeded`, `size limit exceeded`, close, silent, down | Strapi unit + integration | quick run `attachment-scanner.unit.test.js`; `request-attachments.integration.test.js` (malware 422, warning line) | ❌ W0 |
| D-13 · D-21 | Scanner down → `pending`, no download/extract/include (409); re-scan clean releases; re-scan infected → blocked, bytes and plugin record deleted; boot re-scan; timers cleared | Strapi integration + unit | quick run `attachment-quarantine.integration.test.js`, `attachment-rescan.unit.test.js` | ❌ W0 |
| D-15 | Configuration: development defaults; unset outside development → `ATTACHMENTS_NOT_CONFIGURED` and the request read says so; invalid value, incomplete S3 or ClamAV block, `baseUrl`, the double outside development → boot error | Strapi unit + integration | quick run `attachment-config.unit.test.js`, `ai-provider-boot.unit.test.js` pattern | ❌ W0 |
| COLLAB-02 (1) · D-06 · D-07 | Local adapter: bytes identical to upload (PNG and JPEG unchanged), key `csrm_…` + ext, outside `public/`; S3 adapter vs fake object store: put, presigned read, delete, configuration has `ACL` key undefined and SSE-KMS | Strapi unit + integration | quick run `attachment-storage.unit.test.js`, `attachment-storage-s3.integration.test.js` | ❌ W0 |
| COLLAB-02 (3) · D-06 · D-08 | No attachment byte under `/uploads/`; upload plugin content-API routes unmounted (GET 404, mutation 405); admin upload routes still mounted; temp files removed after a refused upload (any part name) | Strapi integration | quick run `http-hardening.integration.test.js`, `served-operations.integration.test.js` | ✅ (extended) |
| COLLAB-02 (3) · D-18 · D-19 | Six actors × every attachment route: owner, other Requestor 404, analyst, requesting analyst (`OWN_REQUEST` 403 on AI), service agent 404/403, no identity; cross-request id 404; persistence deep-equal | Strapi integration + matrix | quick run `authorization-matrix.integration.test.js`, `request-attachments.integration.test.js` | ✅ (extended) / ❌ W0 |
| COLLAB-02 (1) · D-23 | Download headers (disposition with `filename*`, type, nosniff, no-store, CSP sandbox); 409 for quarantined, blocked, removed; tampered bytes → `ATTACHMENT_INTEGRITY_FAILED` + warning line; a 24 MiB download round trip | Strapi integration | quick run `request-attachments.integration.test.js` | ❌ W0 |
| COLLAB-02 (4) · D-20 · D-22 | Remove (own file; analyst any), restore (remover only), `NOT_UPLOADER`/`NOT_REMOVER` 403, `ATTACHMENTS_CLOSED` once released; removal ends AI inclusion and deletes `aiText`; restore does not re-include; event log entries; `REQUEST_HAS_ATTACHMENTS` on request delete | Strapi integration | quick run `request-attachments.integration.test.js`, `request-workflow.integration.test.js` | ❌ W0 / ✅ |
| D-31 · D-32 · D-33 | Extraction per type (PDF order, DOCX body/tables without deleted text or comments, XLSX cached values never formulas, PPTX slide order without notes, CSV/TXT decode); caps and facts; timeout and heap overrun → `ATTACHMENT_TEXT_UNAVAILABLE`; DOCTYPE refused; scanned PDF → unavailable | Strapi unit | quick run `attachment-extraction.unit.test.js` | ❌ W0 |
| COLLAB-02 (5) · D-30 · D-31 | AI inclusion: human analyst only; Requestor and agent 403; requesting analyst `OWN_REQUEST`; PNG/JPEG, pending, blocked, removed refused; ceiling refusals; preview returns the stored text | Strapi integration + matrix | quick run `attachment-ai-input.integration.test.js`, `authorization-matrix.integration.test.js` | ❌ W0 |
| COLLAB-02 (5) · D-34 · D-35 | Builder blocks: included only, upload order, escaped, constant attributes, no name; hostile text (closing tags, fake instructions, long lines) stays data; per-run bound → `CONTEXT_TOO_LARGE` naming files; summary envelope version parsed closed, earlier versions read as none | Strapi unit | quick run `assessment-context.unit.test.js`, `ai-provider-guardrails.unit.test.js` | ✅ (extended, Phase 12) |
| COLLAB-02 (5) · criterion 5 | A generation through the fake OpenAI-compatible server sends the included file's text and neither the excluded file's text nor any file name | Strapi integration | quick run `attachment-ai-input.integration.test.js` (recorder of `fake-openai-compatible-server.ts`) | ❌ W0 |
| D-36 · D-27 | The signal gains files (included since, excluded or removed since); analyst reads only; the questionnaire and assessment summaries carry counts | Strapi integration | quick run `questionnaire-workflow.integration.test.js`, `assessment-workflow.integration.test.js` | ✅ (extended) |
| D-37 | Event lines: names, fields, levels (warning for malware, blocked, integrity), never content, name or text | Strapi unit | quick run `security-event-log.unit.test.js` | ❌ W0 |
| D-03 · D-38 | Spec (multipart, binary response), `api:check`, parity file-response mode, operation chain, served inventory (new operations; upload plugin rows gone), byte-identical catalogues, `HUMAN_ANALYST_ONLY_OPERATIONS` mirror | Web unit + Strapi integration + static | `vitest run src/features/contract-response-parity.test.ts src/features/contract-operation-chain.test.ts`; quick run `served-operations.integration.test.js`, `contract-catalogue.integration.test.js`; `api:check`; `cmp` | ✅ (extended) |
| D-24 · D-25 | Web: file-response validator (type, name, size, signature, `filename*`), save helper, upload and download actions with closed refusals (413 without reason mapped), `proxy.ts` gate (paths, header, length), `next.config.ts` limits equal | Web unit | `vitest run src/lib/files src/features/attachments proxy.test.ts` | ❌ W0 |
| UI-D3 · UI-D5 · UI-D30 · UI-D35 | `replaceState` to the edit route after creation, with no refresh while queued; the submit confirmation disabled while files are in flight; window drops outside the zone cancelled; the `(app)` provider keeps queued `File`s across a client navigation; every uploader page imports the one upload action | Web unit + E2E | `vitest run src/features/attachments src/features/requests`; `test:e2e e2e/request-attachments.spec.ts` (create with files, then the address is `/edit`) | ❌ W0 |
| D-26 · D-28 · D-29 · D-30 | Queue stages, retry, pre-checks, navigation guard; Files panel for Requestor, analyst, requesting analyst, released/closed; AI control states and reasons; Undo; no AI state for Requestors; another Requestor sees not-found | Web unit | `vitest run src/features/attachments src/features/requests` | ❌ W0 |
| Success criteria 1–5 | Jane: PDF, DOCX, XLSX at creation, submit, later note + PPTX; Bob sees four, downloads one; Secondary Requestor not-found; refusals (type, PDF-named PNG, oversize, test signature); remove, Undo, remove; Bob includes the PDF, generates, "What the AI used" lists PDF not DOCX; 1440 and 375 | E2E | `pnpm --dir apps/csrm test:e2e e2e/request-attachments.spec.ts` | ❌ W0 |
| G-6 · D-40 | Tree clean after Playwright; content-type freeze lists exactly the attachment schema; no EICAR literal in the repo | static | `git status --short`; freeze `git diff --name-only`; `git grep -n "ANTIVIRUS-TEST" -- apps` prints nothing | ✅ |

### Sampling Rate
- **Per task commit:** the touched Vitest files by path; the touched Strapi file by path (dev servers stopped); `typecheck` when types change; `api:check` after a spec change.
- **Per wave merge:** the full web suite and `typecheck`; the full Strapi suite after each Strapi plan; each UI plan's Playwright spec once at its end.
- **Phase gate:** the full gate on the production build, then the clean tree, the `cmp` of the catalogue copies, the content-type freeze check and the EICAR grep.

### Proposed plan seeds (the planner owns the final split; D-40's serialisation holds)

| Seed | Content | Depends on |
|---|---|---|
| 14-01 | `docs/contract-gaps/phase-14-request-attachments.md` and the `checkpoint:decision` (stop; G-6) | — |
| 14-02 | Dependency plan: justification against D-32 and G-7, the `checkpoint:human-verify` (the two SUS flags), install, `pnpm why fflate`, typecheck tracer for `unpdf` and `read-excel-file/universal` | — |
| 14-03 | Strapi foundations without schema: `attachment-config.ts` (+ boot validation, `.env.example`), `attachment-policy.ts` (limits, names, types), `csrm/audit/security-event-log.ts`, `global::csrm-multipart-cleanup` | 14-02 |
| 14-04 | Content check: `zip-archive.ts`, `content-check.ts`, CFB, text, PDF open in the worker; fixtures script and committed fixtures | 14-02, 14-03 |
| 14-05 | Scanner: port, development double, ClamAV adapter, fake `clamd`, re-scan scheduler (unit level) | 14-03 |
| 14-06 | Storage: private local provider, `register()` override, S3 configuration, storage port (local and S3), fake object store; upload plugin content-API routes unmounted; matrix rows and served inventory; `strapi-http-hardening.md` and the residual register | 14-03 |
| 14-07 | After approval: the content type, the spec (multipart, binary, reasons), both catalogues, conflict reasons (both sides), `api:generate`, parity `file-response` mode | 14-01 approved |
| 14-08 | List, upload, download, remove and restore services, controllers and routes; the lock; the request read summary and delete refusal; integration and matrix proofs | 14-04 to 14-07 |
| 14-09 | Quarantine end to end: pending uploads, re-scan release and block, boot re-scan (integration with the fake `clamd`) | 14-08 |
| 14-10 | Extraction: the worker for each type, caps and facts, `xlsx-reader.ts` | 14-04 |
| 14-11 | AI inclusion and preview operations, the context builder blocks, the run summary envelope, the signal and the analyst summaries | 14-08, 14-10 |
| 14-12 | Web transfer: `lib/files/file-response.ts`, `save-file.ts`, attachments service and actions, `next.config.ts` limits, the `proxy.ts` gate | 14-07 |
| 14-13 | UI-SPEC extensions recorded in the direction; `statusPresentation` states; glossary "Attachment" | — |
| 14-14 | The `(app)` file store provider, the upload queue and field, the new-request form and draft (UI-D3, UI-D5, UI-D30, UI-D35) | 14-12, 14-13 |
| 14-15 | The Files section on both request pages; remove, restore and Undo; download | 14-12, 14-13 |
| 14-16 | Phase 13's composer and thread with files; "Add files" through the composer | 14-14 |
| 14-17 | The AI control, text preview sheet, "What the AI used" Attachments group, analyst page summaries | 14-11, 14-15 |
| 14-18 | Playwright `request-attachments.spec.ts` (both widths), harness pins, the full gate on the production build, clean tree | all |

### Wave 0 Gaps
- [ ] `apps/backend/tests/attachment-content-check.unit.test.ts`, `attachment-policy.unit.test.ts`, `zip-archive.unit.test.ts`
- [ ] `apps/backend/tests/attachment-scanner.unit.test.ts`, `attachment-rescan.unit.test.ts`, `attachment-config.unit.test.ts`
- [ ] `apps/backend/tests/attachment-storage.unit.test.ts`, `attachment-storage-s3.integration.test.ts`
- [ ] `apps/backend/tests/attachment-extraction.unit.test.ts`, `security-event-log.unit.test.ts`
- [ ] `apps/backend/tests/request-attachments.integration.test.ts`, `attachment-quarantine.integration.test.ts`, `attachment-ai-input.integration.test.ts`
- [ ] `apps/backend/tests/helpers/fake-clamd-server.ts`, `fake-object-store.ts`, `attachment-fixtures.ts` (OOXML writer, CFB with `EncryptedPackage`, PDF builder, test-signature text)
- [ ] `apps/backend/tests/fixtures/attachments/` (small committed files with a README of how each was made; no EICAR)
- [ ] `apps/csrm/src/lib/files/*.test.ts`, `apps/csrm/src/features/attachments/*.test.ts(x)`, `apps/csrm/proxy.test.ts`
- [ ] `apps/csrm/e2e/request-attachments.spec.ts` (and its fixtures under the run's temp root)
- [ ] Dependency install: `pnpm --filter @csrm/strapi add unpdf@1.8.1 read-excel-file@9.3.10 @strapi/provider-upload-aws-s3@5.51.0 --save-exact`, after the `checkpoint:human-verify`

## Security Domain

### Applicable ASVS Categories (OWASP ASVS 5.0, as seeded in `owasp-asvs-5.0.0.json`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5.1.1 (L2) documented types, extensions, sizes "including unpacked size", malicious-file behaviour | yes | The contract-gap record and `apps/backend/README.md` |
| V5.2.1 (L1) size the application can process | yes | 25 MiB; Next 26 MiB; formidable 50 MiB; worker bounds |
| V5.2.2 (L1) extension matches and "contents correspond to the type", magic bytes | yes | `content-check.ts` (Settled 4) |
| V5.2.3 (L2) compressed files checked "against maximum allowed uncompressed size and against maximum number of files before uncompressing" | yes | `zip-archive.ts` central-directory bounds, then `maxOutputLength` |
| V5.2.4 (L3) quota and number of files per user | partly | 20 active and 60 lifetime per request (per-user quota not added) |
| V5.2.6 (L3) pixel flood | no | Images are never decoded or resized (D-07) |
| V5.3.1, V5.3.2 (L1) no execution from public folders; internally generated paths | yes | Private storage outside `public/`; `csrm_` hash keys; hash pattern check on read |
| V5.4.1, V5.4.2 (L2) filename in `Content-Disposition`, encoded per RFC 6266 | yes | Code Example 7 |
| V5.4.3 (L2) "files obtained from untrusted sources are scanned by antivirus scanners" | yes | Scanner port; quarantine; ClamAV |
| V4 Access control | yes | Grants, the readers predicate (404), actor rules (403), human-only set |
| V7 Logging | yes | `security-event-log.ts` (D-37); no content, name or text; R-08-13 |

The seeded ISM-2059 also applies: "File uploads or input are restricted to specific file types, with malicious content scanning occurring prior to file access, file execution or file storage" (see Open Question 2).

### Known Threat Patterns for Strapi + Next file handling

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on list, download or mutate | Information disclosure | `canUseRequestNotes` → 404; the attachment id must belong to the path's request; matrix rows |
| Public object exposure | Information disclosure | Private local directory outside `public/`; `ACL` omitted with Block Public Access; no URL leaves Strapi; plugin routes unmounted |
| Malware distribution | Tampering / Elevation | Scan before availability; quarantine; blocked bytes deleted; warning events |
| Polyglot or renamed file | Tampering | Extension × signature agreement; `nosniff`; download as `attachment`; no inline rendering |
| Zip bomb or XML entity expansion | Denial of service | Central-directory bounds; `maxOutputLength`; DOCTYPE refused; worker heap and time limits |
| Malicious PDF script | Elevation | pdf.js 6.1.200, `isEvalSupported: false`, no rendering, worker isolation |
| Prompt injection through attachment text | Tampering (AI) | Delimited untrusted block, escaped; constant attributes; opt-in only; ceiling check |
| Name spoofing (RLO) or header injection | Spoofing / Tampering | Sanitised names; RFC 5987 encoding; names never in keys, prompts or logs |
| Oversized body exhaustion | Denial of service | Path-scoped `proxy.ts` gate; 26 MiB limits; reverse-proxy limit (R-08-04) |
| Integrity loss in storage | Tampering | SHA-256 recorded at upload; checked before every download; warning event |
| Temporary-file accumulation | Denial of service | Global cleanup middleware (Pitfall 2) |

## Sources

### Primary (HIGH confidence)
- **Installed source, read this session:**
  - `@strapi/upload@5.51.0`: `dist/server/register.js`, `services/upload.js`, `services/file.js`, `routes/index.js`, `routes/content-api.js` and `utils/mime-validation.js`;
  - `@strapi/provider-upload-local@5.51.0` `dist/index.js`;
  - `@strapi/core@5.51.0`: `dist/Strapi.js`, `middlewares/body.js`, `services/server/compose-endpoint.js` and `register-routes.js`;
  - `@strapi/utils@5.51.0` `dist/content-api-router.js`;
  - `next@16.3.6`: `dist/server/body-streams.js`, `lib/router-utils/resolve-routes.js`, `app-render/action-handler.js`, `config-schema.js`, the bundled docs `proxyClientMaxBodySize.md`, `serverActions.md` and `server-actions.md`, and `compiled/react-server-dom-{webpack,turbopack}`.
- **Tarballs (npm pack), read this session:** `@strapi/provider-upload-aws-s3@5.51.0` (`dist/index.js`, `dist/utils.js`, `LICENSE`), `unpdf@1.8.1` (`package.json`, `dist/index.cjs`, `dist/pdfjs.mjs`) and `read-excel-file@9.3.10` (`package.json`, `README.md`).
- **Probes on Node 24.19.0** (scratchpad):
  - Flight serialise and decode at 25 MiB (node and browser clients);
  - `unpdf` in a worker on 3-page and 4,200-page PDFs;
  - ZIP central-directory parsing of a Python-made archive;
  - `bytes` parsing;
  - `npm audit` of the three packages.
- **npm registry:** `npm view` for every candidate; `gsd-tools query package-legitimacy check`.
- **Repository files read:**
  - `apps/backend/config/plugins.ts`, `config/middlewares.ts`, `src/index.ts`, `src/csrm/prompt-data.ts`, `src/utils/development-identity-enabled.ts` and `src/policies/csrm-authorization.ts:35-52`;
  - `tests/helpers/strapi-http-harness.ts:420-493`, `tests/tsconfig.json` and `tests/fixtures/authorization-matrix.ts:575-623`;
  - `apps/csrm/next.config.ts`, `proxy.ts`, `playwright.config.ts:180-222` and `src/features/administration/administration-service.ts`;
  - `docs/security/strapi-http-hardening.md` and `docs/security/phase-08-residual-risks.md` (R-08-02, R-08-04);
  - `docs/references/specification.json` (status codes, multipart precedent);
  - the seeded `owasp-asvs-5.0.0.json` (V5.1–V5.4) and `asd-ism-controls-2026.06.18.json` (ISM-2059).

### Secondary (MEDIUM confidence)
- ClamAV: `etc/clamd.conf.sample` on `main` and on `rel/0.103` (raw.githubusercontent.com/Cisco-Talos/clamav) and the ClamD protocol page (docs.clamav.net/manual/Usage/ClamdProtocol.html).
- AWS: "Controlling ownership of objects and disabling ACLs for your bucket" (docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html).
- MDN: "File drag and drop" (developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop).
- Next 16.3.6 bundled docs: `04-linking-and-navigating.md` (Native History API), `03-layouts-and-pages.md`, `07-mutating-data.md`.
- Phase 12, 13 and 19 research (cited where reused).

### Tertiary (LOW confidence)
- A1–A10 in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Registry, advisories, tarball reads and probes on the target Node.
- Architecture: HIGH. Built on installed source and the locked decisions; the module boundaries are proposals (planner's discretion).
- Pitfalls: HIGH for 1–5 and 7–12, which are source-verified; MEDIUM for 6 (SDK framing) and 13–16 (carried from earlier phases' verified research).

**Research date:** 2026-10-01
**Valid until:** 2026-10-31. `read-excel-file` and `unpdf` release often; re-check `npm view` and the advisories at the plan check.
