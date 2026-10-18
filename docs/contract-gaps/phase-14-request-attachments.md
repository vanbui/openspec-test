# Phase 14: Request Attachments

## Gap

A request cannot carry supporting files, at intake or later, for either the Requestor or a Security Analyst (UAT-012). COLLAB-02 asks for allowed files checked by content, up to 25 MB each and 20 per request, added at creation and later, downloaded only through an authorised operation, refused with a reason when disallowed, oversize or infected, removed on the record, and read by the AI only when a Security Analyst opts a file's text in.

The frozen CSRM JDL cannot hold any of it. It has no attachment entity and no media field, as the role-function catalogue's design note 6 records ("The JDL does not contain persisted Alert, ReportDefinition, Attachment, Comment, or Activity/Audit entities … persisted workflow collaboration, file uploads, alerts, and audit history require model extensions"). The one file concept the JDL has is the questionnaire's `File upload` answer type (`CsrmQuestionAnswerType`), which fails closed "until a later phase defines authenticated upload, storage, malware scanning, retention, and record-authorization behaviour" (`docs/contract-gaps/phase-03-questionnaire-json-contract.md`, "File upload limitation"). That answer type stays deferred. This record is the contract a later phase can reuse for it.

`CsrmRequestAttachment` is therefore a new recorded concept, the glossary's "Attachment", and it competes with no JDL entity (brief §20: record gaps in the data model rather than create a competing model quietly). G-15 already assumes it ("like Phase 13's note and Phase 14's attachment"). It is request-scoped, like `CsrmRequestNote`. A media field on `CsrmAssessmentRequest` is not chosen: Strapi's polymorphic file link holds no IdamBox uploader, part, scan state, quarantine, removal, AI inclusion or history, and the upload plugin's file record names a Strapi admin user as its creator, not an IdamBox User. Extending the plugin's file type is not chosen either: it would bend the admin Media Library's schema and every plugin upgrade (D-02).

## Approved Compatibility Extension

This is the only content-type change Phase 14 proposes: one new content type (D-01). `CsrmAssessmentRequest`, `CsrmRequestNote` and the upload plugin's file type do not change.

```jdl
entity CsrmRequestAttachment {
  fileName String required,
  fileType CsrmRequestAttachmentType required,
  byteSize Integer required,
  sha256 String required,
  uploaderPart CsrmRequestNotePart required,
  uploadedAt Instant required,
  scanStatus CsrmRequestAttachmentScanStatus required,
  scanCheckedAt Instant,
  scanEngine String,
  scanDetection String,
  scanAttempts Integer,
  removedAt Instant,
  aiTextIncluded Boolean required,
  aiText TextBlob,
  aiTextFacts AnyBlob,
  eventLog AnyBlob
}

enum CsrmRequestAttachmentType { PDF, DOCX, XLSX, PPTX, CSV, TXT, PNG, JPEG }

enum CsrmRequestAttachmentScanStatus { PENDING, CLEAN, BLOCKED }

relationship ManyToOne {
  CsrmRequestAttachment{assessmentRequest} to CsrmAssessmentRequest,
  CsrmRequestAttachment{note} to CsrmRequestNote,
  CsrmRequestAttachment{uploadedBy} to IdamBoxUser,
  CsrmRequestAttachment{removedBy} to IdamBoxUser
}
```

The JDL has no media type, so the stored file is recorded here, outside the block: one single `file` attribute of Strapi's `media` type, holding the upload plugin's file record for the stored bytes ("Storage").

`uploaderPart` reuses Phase 13's `CsrmRequestNotePart`, stored as the Strapi enumeration values `requestor` and `security-analyst`. `CsrmRequestAttachmentType` is stored as `pdf`, `docx`, `xlsx`, `pptx`, `csv`, `txt`, `png` and `jpeg`, and `CsrmRequestAttachmentScanStatus` as `pending`, `clean` and `blocked`.

The content type is `api::csrm-request-attachment.csrm-request-attachment`, collection `csrm_request_attachments`, with `draftAndPublish: false`, in its own folder `apps/backend/src/api/csrm-request-attachment/`.

| Attribute | Strapi type | Required | Server-owned | Private | Meaning and bound |
| --- | --- | --- | --- | --- | --- |
| `assessmentRequest` | relation manyToOne `api::csrm-assessment-request.csrm-assessment-request` | always set in code | yes | no | The request the file is attached to. No inverse attribute. |
| `note` | relation manyToOne `api::csrm-request-note.csrm-request-note` | no | yes | no | The caller's own note the file was posted with after submission, set only at upload ("Window and Notes"). Null for a file added at intake. No inverse attribute. |
| `file` | media, single, `allowedTypes: ["files", "images"]` | always set in code; null once a blocked verdict deletes the bytes | yes | yes | The upload plugin's file record for the stored bytes ("Storage"). |
| `fileName` | string | yes | yes, from the sanitised original name | no | 1 to 255 characters after sanitising ("Content, Limits and Refusals"). Displayed escaped; never a storage key, never in a prompt or a log line. |
| `fileType` | enumeration `pdf`, `docx`, `xlsx`, `pptx`, `csv`, `txt`, `png`, `jpeg` | yes | yes, the detected type | no | The type the content check confirmed. A `.jpg` and a `.jpeg` file are both `jpeg`. |
| `byteSize` | integer | yes | yes | no | 1 to 26,214,400 (25 MiB, labelled "25 MB"). |
| `sha256` | string | yes | yes | no | The SHA-256 of the stored bytes: 64 lowercase hexadecimal characters, computed at upload and checked before every download. |
| `uploadedBy` | relation manyToOne `api::idambox-user.idambox-user` | always set in code | yes | no | The resolved IdamBox User who added the file. No inverse attribute. |
| `uploaderPart` | enumeration `requestor`, `security-analyst` | yes | yes | no | The uploader's part on the request, fixed at upload by Phase 13's `authorPartFor`. |
| `uploadedAt` | datetime | yes | yes | no | The server's time of the upload. The list's order (newest first). |
| `scanStatus` | enumeration `pending`, `clean`, `blocked` | yes | yes | no | The current malware-check fact ("Malware Scanning and Quarantine"). The only scan fact a gate reads. |
| `scanCheckedAt` | datetime | no | yes | no | The time of the latest verdict. Null while a file has never been scanned successfully. |
| `scanEngine` | string | no | yes | no | At most 255 characters: the adapter and, where the engine reports it, its signature version. |
| `scanDetection` | string | no | yes | no | At most 128 characters: the detection name a blocked file keeps (D-21). Null unless blocked. |
| `scanAttempts` | integer, default 0 | no | yes | no | The number of scans attempted, bounding the re-scans (at most 24). |
| `removedAt` | datetime | no | yes | no | The current removal fact: set by removal, cleared by restore. |
| `removedBy` | relation manyToOne `api::idambox-user.idambox-user` | no | yes | no | Who removed the file; cleared by restore. No inverse attribute. |
| `aiTextIncluded` | boolean, default false | yes | yes | no | The current AI-inclusion fact. The only inclusion fact the AI context and the signal read. |
| `aiText` | text | no | yes | yes | The capped extracted text, held only while the file is included ("AI Inclusion and Extracted Text"). Never served except by the analyst's text preview. |
| `aiTextFacts` | json | no | yes | no | A closed envelope of the extraction: characters available, characters kept, whether it was truncated, the extractor's version and when it ran. Null while not included. |
| `eventLog` | json | no | yes | no | Append-only, schema-versioned history, at most 200 events ("Write Discipline"). |

**Link tables.** Strapi 5 keeps every relation in a link table, `manyToOne` included. The expected names, which the schema plan confirms with `PRAGMA table_info` before any raw SQL names them:

| Relation | Link table |
| --- | --- |
| `assessmentRequest` | `csrm_request_attachments_assessment_request_lnk` |
| `note` | `csrm_request_attachments_note_lnk` |
| `uploadedBy` | `csrm_request_attachments_uploaded_by_lnk` |
| `removedBy` | `csrm_request_attachments_removed_by_lnk` |

The `file` media link lives in the upload plugin's polymorphic table, `files_related_mph`, as every media attribute's does.

**No inverse attributes.** None of the four relations has an inverse (`inversedBy`) attribute, as Phase 13's note relations have none. `CsrmAssessmentRequest`, `CsrmRequestNote` and `IdamBoxUser` therefore gain no `attachments` attribute: the request's `populate` (including `populate=*`), the note's projections and the generated client's populate enum never reach an attachment.

**No core router.** The content type has no Strapi core router and no core controller route. It is reachable only through the operations below; the served-operations inventory and the authorisation matrix prove that no core route exists for it.

**What does not change.** No existing attribute, relation or enumeration value changes. The request gains no media field, the note entity and its four operations are unchanged (the link lives on the attachment), and the upload plugin's file type gains no attribute.

## Operations and Functions

Six new operations (D-04). Every path is under `/api/v1/assessment_requests/{requestId}/attachments`.

| Operation | Purpose |
| --- | --- |
| `GET /api/v1/assessment_requests/{requestId}/attachments` | List every attachment of the request, newest first, bounded by the lifetime bound (60), with each file's state and the actions the server says this viewer may take; for a human Security Analyst also the AI facts. |
| `POST /api/v1/assessment_requests/{requestId}/attachments` | Add one file: multipart with exactly one `file` part and an optional `noteId` part. Any other part is a 400 with nothing written. Success is 201 with the attachment, `scanStatus` `clean` or `pending`. |
| `GET /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content` | Download the file's bytes ("Downloads"): the published contract's first binary response. |
| `PUT /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal` | `{ removed: true }` removes the file softly; `{ removed: false }` restores it ("Removal, Blocked Files and Retention"). This is the ROADMAP's "delete". |
| `PUT /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input` | `{ included }`: include or exclude the file's text in the AI context ("AI Inclusion and Extracted Text"). |
| `GET /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text` | The stored text an included file sends, for the analyst to check. |

Existing reads gain, additively:

- **The request read** (`GET /api/csrm-assessment-requests/{id}`) gains the viewer's `attachments` summary, only for a reader of the request's attachments ("Readers and Actors"): the count of files not removed, whether this viewer may add a file now (with the closed reason when not), whether a note is needed, the window, what remains of the limits, the limits and the allowed types. Another caller's request read is unchanged.
- **The analyst questionnaire and assessment reads** gain `assessmentRequest.files`: the count of files not removed and the number included in the AI inputs. The Requestor's shapes are unchanged.
- **The AI-inputs signal** (`AiInputsChanged`, served in `generation.aiInputsChanged` on the analyst questionnaire and assessment reads and in the request read's `RequestAiInputs`) gains files ("The Run Record").
- **The AI run read** (`GET /api/v1/ai_runs/{runId}`) serves the context summary's attachments section as a new envelope version ("The Run Record").

**One refusal on an existing operation.** The analyst-only, API-only core delete (`DELETE /api/csrm-assessment-requests/{id}`) refuses a request that holds any attachment, removed and blocked ones included, with 409 `REQUEST_HAS_ATTACHMENTS`, beside Phase 13's `REQUEST_HAS_NOTES`, under the same request lock. Nothing is deleted. So no attachment ever references a deleted request.

**Functions.** Two API-only Functions grant the operations, in both copies of the role-function catalogue, byte-identical (D-38):

| Function | Holders | Operations |
| --- | --- | --- |
| `function.risk_assessment_requests.attachments_api` | `role.requestor`, `role.security_analyst` | list, upload, download, removal and restore |
| `function.risk_assessment_requests.attachment_ai_input_api` | `role.security_analyst` | AI inclusion and the text preview |

Neither Function is granted to `role.security_analyst_agent`. The AI inclusion and the text preview also join `HUMAN_ANALYST_ONLY_OPERATIONS`, in the policy and in the matrix's mirror, as a second refusal. The four attachment operations serve both actors, so they cannot join that set: their analyst path is human-only because the agent's role lacks the grant, and the record rule does the rest. A catalogue design note records the two Functions and amends note 6 for attachments.

**Closed reasons and statuses.** Following Phase 13's split: identity-relative refusals are 403, record-state refusals 409, the content refusals take the CSV import's existing 413 and 415, and malware takes 422.

| Status | Reasons |
| --- | --- |
| 400 | `ATTACHMENT_EMPTY`; a malformed multipart body; any part other than one `file` and an optional `noteId` |
| 403 | `OWN_REQUEST` (Phase 13's), `NOT_UPLOADER`, `NOT_REMOVER`; also no grant and the human-only set |
| 404 | Every record-rule refusal ("Readers and Actors") |
| 409 | `REQUEST_NOT_SUBMITTED` (Phase 13's), `ATTACHMENTS_CLOSED`, `ATTACHMENTS_NOT_CONFIGURED`, `ATTACHMENT_NOTE_REQUIRED`, `ATTACHMENT_NOTE_INVALID`, `ATTACHMENT_LIMIT_REACHED`, `ATTACHMENT_LIFETIME_LIMIT_REACHED`, `ATTACHMENT_QUARANTINED`, `ATTACHMENT_BLOCKED`, `ATTACHMENT_REMOVED`, `ATTACHMENT_UNAVAILABLE`, `ATTACHMENT_INTEGRITY_FAILED`, `ATTACHMENT_TEXT_UNAVAILABLE`, `ATTACHMENT_NOT_TEXT_BEARING`, `AI_CLASSIFICATION_ABOVE_CEILING` and `AI_POLICY_NOT_CONFIGURED` (Phase 12's), `REQUEST_HAS_ATTACHMENTS`, `HISTORY_UNAVAILABLE` (Phase 10's) |
| 413 | `ATTACHMENT_TOO_LARGE` |
| 415 | `ATTACHMENT_TYPE_NOT_ALLOWED`, `ATTACHMENT_CONTENT_MISMATCH`, `ATTACHMENT_MACRO_ENABLED`, `ATTACHMENT_ENCRYPTED`, `ATTACHMENT_LEGACY_OFFICE` |
| 422 | `ATTACHMENT_MALWARE_FOUND`, with `details.detection` |

The new reasons join Phase 10's single closed list (`apps/backend/src/csrm/conflict-reasons.ts` and its web mirror) in `error.details.reason`. **422 is new to the contract** (Orchestrator Confirmations, 2026-10-01): the content is understood but refused, which is neither a state conflict nor a media-type problem (RFC 9110 §15.5.21). It carries the closed reason and `details.detection`, the detection name the scanner reported, and the web's transport keeps the reason, proven by a test, so the person is told what was found and to contact their IT service desk.

## Storage

**One storage port** (D-06). Strapi reaches stored bytes through one port with three methods, put, read and delete, so the download, the extraction and Phase 20 never touch provider specifics. Storage goes through the upload plugin, which has one provider for the whole application.

- **Development and tests:** a CSRM private local provider writes under a configured directory outside `public/` (`CSRM_ATTACHMENT_LOCAL_DIR`, default `.tmp/attachments` under the Strapi application, which Git ignores). It is installed in the application's `register()`, which runs after every plugin's, by replacing the plugin's provider methods through the provider object's own `extend`; it is never configured as a module path, which the plugin lower-cases and breaks on a case-sensitive filesystem. `strapi::public` never serves the directory, and a test proves that no attachment byte is reachable under `/uploads/`. Each test harness pins its own temporary directory.
- **Production:** the official `@strapi/provider-upload-aws-s3`, pinned to the Strapi version, 5.51.0 (G-7), configured private: the `ACL` key present and undefined, so the provider applies no default public ACL and sends no ACL header (the bucket's default owner-enforced object ownership refuses ACLs); server-side encryption with a configured KMS key (SSE-KMS); the Sydney region, `ap-southeast-2`, by default; and no `baseUrl`, which would make the provider return unsigned URLs, so a configured `baseUrl` fails boot. The bucket's public access block, versioning and lifecycle rules are deployment configuration, documented in `apps/backend/README.md`. The provider has no read method, so the port reads through a server-side presigned `GetObject` with a 60-second expiry, fetched by Strapi with redirects refused and the 25 MiB bound; a URL that is not presigned is refused. Its read path is proven against a fake object store in the Strapi tests; a check against a real bucket is manual and the operator's.
- **No URL leaves Strapi.** No response, log line or projection carries a storage URL, presigned or not, or the plugin's file record (its hash, provider metadata or URL).
- **Keys.** The stored object's key is `csrm_` followed by 32 hexadecimal characters from a random UUID, plus the detected type's extension. The uploaded name is never part of a key, and a read checks the key against that pattern before it touches storage.
- **Byte for byte** (D-07). The port calls the provider's upload with the screened buffer and creates the plugin's file record itself, rather than through the plugin's upload service, so attachments get no derived formats: no thumbnails, responsive sizes, optimisation or auto-orientation. The stored bytes are the scanned bytes and match the recorded digest. R-08-39 (the `sharp` override across `@strapi/upload`'s pin) therefore stays unexercised for attachments by design, and the residual register says so. The file record's `provider` equals the configured provider, so the plugin's own delete reaches the provider.

**The plugin's content-API routes are unmounted** (D-08). Once private files live in the plugin, its content-API routes would let the full-access API token holder list their metadata, upload unscanned files into the store, or hard-delete them. The application's `register()` empties the plugin's content-API router, unmounting `POST /api/upload`, `GET /api/upload/files`, `GET /api/upload/files/page`, `GET /api/upload/files/:id` and `DELETE /api/upload/files/:id`. The matrix's five upload rows become unmounted-path assertions under the recorded convention (`docs/security/strapi-http-hardening.md`, "Unmounted paths"): a `GET` answers 404 and a mutation 405. R-08-02 narrows, and that document and the residual register record it. The admin panel's own upload routes are a separate router and stay.

**The Media Library residual.** Strapi administrators still see attachment files in the admin Media Library, with no preview for private files. That is privileged operator access outside CSRM's role model, as for every record in the Content Manager, recorded as a residual with the recommendation that Media Library rights stay with super admins. A Media Library delete leaves the attachment `unavailable`: it lists as "File unavailable", and its download answers 409 `ATTACHMENT_UNAVAILABLE`.

## Content, Limits and Refusals

**The allow-list, checked by content and extension together** (D-09). A file is accepted only when its extension and its content name the same allowed type.

| Type | Extensions | Content check | Refused variants, each with its own reason |
| --- | --- | --- | --- |
| PDF | `.pdf` | the `%PDF-` header, and the document opens in the extraction worker | password-protected (`ATTACHMENT_ENCRYPTED`): it cannot be scanned or read |
| DOCX | `.docx` | a ZIP whose `[Content_Types].xml` declares the WordprocessingML main part | macro-enabled, a macro main part or a `vbaProject.bin` part (`ATTACHMENT_MACRO_ENABLED`); encrypted, an OLE container (`ATTACHMENT_ENCRYPTED`); the old `.doc` (`ATTACHMENT_LEGACY_OFFICE`) |
| XLSX | `.xlsx` | the SpreadsheetML main part | `.xlsm` (macro-enabled), encrypted, the old `.xls` |
| PPTX | `.pptx` | the PresentationML main part | `.pptm` (macro-enabled), encrypted, the old `.ppt` |
| CSV | `.csv` | text | binary content |
| TXT | `.txt` | text | binary content |
| PNG | `.png` | the PNG signature | |
| JPEG | `.jpg`, `.jpeg` | the JPEG signature | |

- **Text** is UTF-8 with or without a byte-order mark, or UTF-16 with one; no NUL byte outside UTF-16, and no binary signature (an executable, ZIP, OLE or PDF header).
- **Extensions** match case-insensitively. The macro-enabled extensions (`.docm`, `.xlsm`, `.pptm` and their templates) and the old Office extensions get their own reasons; any other extension is `ATTACHMENT_TYPE_NOT_ALLOWED`. Content that names a different type from the extension is `ATTACHMENT_CONTENT_MISMATCH`.
- **The sniff is dependency-free.** CSRM checks the signatures and its own Office Open XML and text rules with the ZIP reader that extraction uses; `file-type` is not added (14-RESEARCH Settled 4).
- **The ZIP bound at upload.** Before inflating anything, the central directory must hold at most 10,000 entries, no ZIP64 marker, no entry with the encryption flag, only stored or deflated entries, at most 1 GiB declared uncompressed in total, and at most a 200:1 ratio per entry (ASVS V5.2.3). `[Content_Types].xml` is inflated with a 1 MiB cap.
- **The plugin's `security.allowedTypes`** (`apps/backend/config/plugins.ts`) stays as the admin Media Library's second layer. CSRM's check runs first and is the authority.

**The limits** (D-10), held in one attachment policy module, because decision 2 fixes them and no setting exposes them:

| Limit | Value | Over the limit |
| --- | --- | --- |
| Size per file | 26,214,400 bytes (25 MiB, labelled "25 MB") | 413 `ATTACHMENT_TOO_LARGE` |
| Empty file | refused | 400 `ATTACHMENT_EMPTY` |
| Active files per request (available or awaiting the scan; removed and blocked files do not count) | 20 | 409 `ATTACHMENT_LIMIT_REACHED` |
| Stored files per request, removed and blocked included (the lifetime bound) | 60 | 409 `ATTACHMENT_LIFETIME_LIMIT_REACHED` |

**Names.** The path is stripped; control characters and the bidirectional-override characters (the right-to-left override spoofing trick) are removed; the name is trimmed to at most 255 characters with its extension kept. A name is never a storage key, never in a prompt and never in a log line, and it is displayed escaped like any text.

**Serialised checks.** The count, the lifetime bound, the window and the note check run under the per-request lock ("Write Discipline"), so two simultaneous uploads at 19 can never make 21.

**Nothing of a refused file is stored.** A refusal before the scan stores nothing. Formidable's temporary file is always deleted, for every part name and on every outcome, by a global middleware, because a route middleware does not run when a request is refused earlier. Every refusal is a security event line ("Security Events"). The web checks the extension, the size and the count before sending, for fast feedback; Strapi is authoritative.

## Malware Scanning and Quarantine

**The scanner port** (D-12). One port, `scan(bytes, signal)`, answers `clean`, `infected` with its detection, or `not-scanned` with a cause (unavailable, timeout, limits or error), each with the engine's identity. Two adapters implement it:

- **The development double:** deterministic, flagging the industry-standard antivirus test file and a harmless CSRM test signature. It is allowed only under the development double key, `NODE_ENV` and `CSRM_ENVIRONMENT` both `development` (the key of `development-identity-enabled.ts`), which both test harnesses run. Configured anywhere else, it fails boot, because a test double must never guard production. It builds the antivirus test string in memory from fragments, so no source file, build output, fixture or commit holds it (D-14); suites use the CSRM test signature.
- **The ClamAV adapter:** `clamd`'s `INSTREAM` command over TCP with Node's own `net` (no dependency): a 2-second connect timeout, 64 KiB chunks, and an overall scan timeout from `CSRM_CLAMAV_TIMEOUT_MS` (60 seconds by default). `stream: OK` is clean; a `FOUND` reply is infected; the engine identity comes from `VERSION`. It is tested against a fake `clamd` server in the Strapi tests. Running `clamd` with `freshclam` is deployment work (G-7), and nothing is installed on the build host.

**The ClamAV deployment requirements**, recorded here and in `apps/backend/README.md`, whatever the deployed version's defaults (some releases default to 25M, at the file limit):

| `clamd.conf` option | Requirement | Why |
| --- | --- | --- |
| `StreamMaxLength` | at least 30M | headroom over a 26,214,400-byte stream |
| `MaxFileSize` | at least 30M | the same |
| `MaxScanSize` | at least 256M | Office Open XML expands when scanned |
| `AlertExceedsMax` | `yes` | a file the engine skips for its size is flagged, never reported clean |

A reply that the stream exceeded its size limit, or a detection whose name starts with `Heuristics.Limits.Exceeded`, is **not clean**: the file is quarantined and an error is logged, because re-scans repeat the result until an operator raises the limits.

**Verdicts at upload** (D-13). The scan runs inside the upload request, after the content check and before the file is made available:

- **Clean:** stored with `scanStatus` `clean` and available at once.
- **Infected:** refused with 422 `ATTACHMENT_MALWARE_FOUND` and the detection; the bytes are discarded and nothing is stored; a warning-level security event.
- **Unavailable, timed out, over the limits or in error:** fail closed (G-7). The file is stored with `scanStatus` `pending`, in quarantine: it is never served, extracted or included, and the response says it is waiting for the malware check.

**Re-scans.** One in-process scheduler re-scans `pending` files with backoff of 1, 5, 15 and 60 minutes, then hourly, stopping when `scanAttempts` reaches 24, and every Strapi start re-scans every `pending` file (a single process, R-08-36). Its timers never hold the process open and are cleared when Strapi stops. A clean verdict releases the file; an infected one blocks it. Every verdict records the engine and the time and appends an event. There is no polling: the web shows a file's new state on its next read.

**Blocked files** (D-21). A re-scan's infected verdict deletes the stored bytes and the plugin's file record, and the attachment keeps its name, digest, uploader and detection (`scanDetection`), with `scanStatus` `blocked`. Readers see it as blocked. It cannot be downloaded, extracted, included or restored; it can be removed from the list like any file. A blocked verdict is a warning-level security event.

**The ISM-2059 reading.** ISM-2059 asks that uploads be restricted to specific file types, "with malicious content scanning occurring prior to file access, file execution or file storage". A clean or infected verdict is reached before storage. While the scanner is down, a file is stored before it is scanned, but only in private, isolated quarantine: it is never accessible, never executed, never extracted and never offered to the AI until a scan passes. That quarantine is the compensating control, and a plan of this phase records the difference as a residual in `docs/security/phase-08-residual-risks.md`.

## Write Discipline

**One writer.** One attachment service writes every fact of this content type. Every add, removal, restore, AI change and verdict decision runs inside `withRequestLock`, the one per-request lock module Phase 13 extracted (`docs/contract-gaps/phase-13-request-assignment.md`, "Write Discipline"): an in-process tail per request, then a transaction that takes `SELECT … FOR UPDATE` on the request row before reading anything it decides on. The revert, assignment, notes and attachment paths share the one lock, and it is never nested for one request. Raw knex inside the lock runs through `.transacting(trx)`.

**Slow work outside the lock.** The content check, the scan, the storage write and text extraction run outside the lock. The lock then re-reads the request, the window, the note and the counts and writes the record. A refusal that arrives under the lock after the bytes were stored deletes the stored bytes and the plugin's file record, so nothing is left behind.

**Server-owned facts.** Every attribute is the server's. The upload accepts only the `file` and `noteId` parts; the removal accepts only `removed`; the AI change accepts only `included`. Any other key is a 400.

**The event log** (the 06.8 posture). `eventLog` is append-only: each event `{ schemaVersion: 1, type, by, at, … }`, where `type` is one of `uploaded`, `quarantined`, `scan-verdict`, `blocked`, `removed`, `restored`, `ai-included` and `ai-excluded`, `by` is the actor's IdamBox User documentId (none for a re-scan), and a verdict carries the engine, the verdict and any detection. An event is appended in the same transaction as the change it documents. No code path removes, reorders or rewrites an earlier event. The log holds at most 200 events; at the cap a change is refused with 409 `HISTORY_UNAVAILABLE` and nothing is written, so no fact changes without its audit record. The log is parsed closed (unknown keys, types and versions are invalid) and fails safe: a malformed log projects as "history unavailable" and never denies a read.

**Gates read current facts only.** Every gate reads `scanStatus`, `removedAt`, `aiTextIncluded`, `note` and the request's status, never the log. No authorisation decision reads `eventLog`, so a damaged history can never make a file downloadable or put its text in front of the AI.

## Window and Notes

**The window** (D-16). One predicate, `acceptsAttachments`, built on Phase 13's `acceptsNotes` (`docs/contract-gaps/phase-13-request-notes.md`, "Posting Window"), decides when files may be added, removed, restored or included:

- **Intake.** While the request is a draft, never submitted or returned to draft, its requestor adds files directly, with no note. A note id on a draft is refused (409 `ATTACHMENT_NOTE_INVALID`), because drafts take no notes. Any other analyst does not add, remove or include files on a draft, because analysts do not work on drafts: 409 `REQUEST_NOT_SUBMITTED`.
- **After submission**, exactly while `acceptsNotes` holds (`submitted`, `questionnaire-in-progress`, `risk-assessment-drafted` and `under-review`, plus any status Phases 17 and 17.1 add before closure): the requestor and any human Security Analyst add files, each posted with a note.
- **Released or closed** (`approved`, and `closed` from Phase 17.1, G-13): read-only. Every add, removal, restore or AI change is refused with 409 `ATTACHMENTS_CLOSED`, because the released record is immutable (decision 9). Files stay listed and downloadable for readers. Information after release belongs to Phase 20's treatment evidence.
- **Storage or scanning not configured:** every add is refused with 409 `ATTACHMENTS_NOT_CONFIGURED`, and the request read says so; the rest of the application runs.

The request's own create, update and submit operations do not change: files go through their own operation.

**Notes give files their context** (D-17). After submission every file is posted with a note. The composer posts the note first through Phase 13's operation, unchanged, then uploads each file with that note's id. Strapi accepts a note id only for the caller's own note on the same request within 60 minutes of its `postedAt`, so the composer can finish and retry its uploads, but nobody can slip a file into an old note the other party has already read. A file after submission without a note id is refused with 409 `ATTACHMENT_NOTE_REQUIRED`; someone else's note, a note on another request or one past its window is refused with 409 `ATTACHMENT_NOTE_INVALID`. The note carries Phase 13's unread flag, so the other party is told and knows what the files are, with no second read state. The note lists its files, and each file links back to its note.

**The note is unchanged.** `CsrmRequestNote`, `CsrmRequestNoteReadState` and their four operations do not change. The link is the attachment's own `note` relation.

## Readers and Actors

**Readers** (D-18). The readers of a request's attachments are exactly the readers of its notes: Phase 13's `canUseRequestNotes`, the request's requestor (through either grant) and any human Security Analyst. One predicate serves both, so notes and attachments can never drift apart, and a later widening of the request read (Phase 17's participant read of the request summary) never reaches either.

**Everyone else gets the refusal a missing record gets: 404, at every attachment route, with persistence unchanged.** That covers another Requestor, a participant who is not the requestor (a nominated risk owner or an executive approver, from Phase 17), the Security Analyst Agent on a request it did not raise, anyone naming a missing request, and any attachment id that does not belong to the request in the path (no cross-request reach). The answer is the same for each, so a caller cannot tell a request they may not read from one that does not exist. The rule is decided in Strapi against the resolved IdamBox User, after the Role → Function → FunctionAPI check, and never branches on the auth mode. G-12 holds: participants never read attachments, and widening the predicate later needs its own decision.

**Actors** (D-19):

- **Add:** the requestor at intake and after submission; any human Security Analyst after submission ("Window and Notes").
- **Download:** any reader, for a clean file that is not removed ("Downloads").
- **Remove:** the uploader removes their own files while the window is open; any human Security Analyst removes any file from submission until release or closure. A Requestor removing someone else's file is refused with 403 `NOT_UPLOADER`.
- **Restore:** only the person who removed the file, while the window is open; anyone else is refused with 403 `NOT_REMOVER`. A restore that would make a 21st active file is refused with 409 `ATTACHMENT_LIMIT_REACHED`.
- **AI inclusion and the text preview:** a human Security Analyst only ("AI Inclusion and Extracted Text").
- **G-1.** On a request they raised, a Security Analyst is its Requestor for everything here (Phase 13's reading): they add in the `requestor` part, remove only their own files, and cannot change or preview any file's AI inclusion (403 `OWN_REQUEST`).
- **The service agent** holds no attachment Function, and its Requestor birthright reaches only requests it raised.

**People.** The uploader and the remover cross the API as `documentId` and `displayName` only, with the uploader's part: never email, username, names, account status, external subject or roles (D-05). No caller `populate` reaches the media relation or a user relation.

## Removal, Blocked Files and Retention

**Removal is soft and recorded** (D-20; decision 6's spirit: nothing persisted is hard-deleted). Removal sets `removedAt` and `removedBy`, takes the file out of the list's main section and out of downloads, and ends its AI inclusion: `aiTextIncluded` becomes false, the stored `aiText` and `aiTextFacts` are deleted, and the exclusion is logged. Removed files stay listed for every reader in a collapsed "Removed files" group, with who added and who removed each and when. The bytes are kept, so the record stays complete and an AI run that used a removed file still resolves it. Removal asks for no reason and no confirmation, because it is reversible.

**Restore** clears `removedAt` and `removedBy` and appends a `restored` event. Only the remover restores, while the window is open. Restoring never re-includes the file in the AI context.

**Blocked files** are described under "Malware Scanning and Quarantine": their bytes are gone, their facts stay, and a restore is refused with 409 `ATTACHMENT_BLOCKED`.

**Retention** (D-22). Attachments follow the assessment record: they are kept for 7 years after the request's closure, and soft removal never shortens it. The period is one constant in the attachment policy module. This phase builds no disposal job, because no record can reach the period for years and the assessment record itself has no disposal yet; legal hold, disposal and purge on request are deferred. In production the bucket's lifecycle rules enforce retention (G-7). The Admin retention setting decision 2 promises is owned by Phase 22 (ROADMAP Phase 22, "Carried from Phases 12, 14 and 19.1"), which takes over that one constant.

## Downloads

**One authorised download per file** (D-23), through Strapi only:

- **Who and what:** a reader, for a clean file that is not removed. A reader asking for a file they can see but not download gets 409 with its closed reason: `ATTACHMENT_QUARANTINED` (pending), `ATTACHMENT_BLOCKED`, `ATTACHMENT_REMOVED` or `ATTACHMENT_UNAVAILABLE` (the stored bytes are gone). Everyone else gets 404.
- **Integrity:** Strapi reads the stored bytes through the storage port and checks their SHA-256 against the recorded `sha256` before sending any byte. A mismatch is refused with 409 `ATTACHMENT_INTEGRITY_FAILED` and is a warning-level security event: tamper evidence for the record.
- **Headers:** `Content-Disposition: attachment` with an ASCII `filename` and an RFC 5987 `filename*`; the recorded type's media type as `Content-Type`; `X-Content-Type-Options: nosniff`; `Cache-Control: no-store`; and `Content-Security-Policy: default-src 'none'; sandbox`. A file is never rendered inline.
- **Logging:** each download is a security event line.

**How bytes reach the browser** (D-24). The web calls the operation through its typed API layer with a binary parse, and a Server Action returns the file's name, content type and bytes, or a closed refusal. A shared file-response validator checks the content type against the attachment's recorded type, the name against a safe pattern, the size against the bound and the content signature, and a small client helper saves the bytes. There is no Route Handler and no raw `fetch`. The contract parity guard gains its file-response mode with this operation. Phase 19's exports reuse these modules.

## AI Inclusion and Extracted Text

**Who and when** (D-30). A human Security Analyst opts each file in; the default is off. Not on a request they raised (403 `OWN_REQUEST`). Never the Requestor, who neither sets nor sees it. The operation is human-only twice: its Function is granted to `role.security_analyst` only, and it is in `HUMAN_ANALYST_ONLY_OPERATIONS`. It changes only while `acceptsNotes` holds: a draft is refused with 409 `REQUEST_NOT_SUBMITTED`, and a released or closed request with 409 `ATTACHMENTS_CLOSED`.

**Which files.** Only a clean file that is not removed, of a text-bearing type: PDF, DOCX, XLSX, PPTX, CSV or TXT. PNG and JPEG carry no text the AI can read (there is no OCR) and are refused with 409 `ATTACHMENT_NOT_TEXT_BEARING`; a pending, blocked or removed file is refused with `ATTACHMENT_QUARANTINED`, `ATTACHMENT_BLOCKED` or `ATTACHMENT_REMOVED`.

**The AI policy.** Inclusion is refused while the request's AI policy refuses (Phase 12's `AI_CLASSIFICATION_ABOVE_CEILING` and `AI_POLICY_NOT_CONFIGURED`), so the control never promises what generation would refuse. The request's data classification governs; only files whose content is within it should be included.

**Extraction on opt-in** (D-31, D-32). Text is extracted when a file is included, never at upload, so nothing is extracted from files nobody includes (G-3). Extraction runs in a worker thread, never on Strapi's request thread: a 768 MB heap, a 30-second wall clock, one extraction at a time, terminated on overrun. Its bounds:

- ZIP-based files pass the upload's central-directory bound, then inflate at most 128 MiB in the worker;
- Office XML is read by CSRM's own scanner, which refuses any `<!DOCTYPE` or `<!ENTITY`, so no DTD or external entity is ever processed;
- PDFs are read with `isEvalSupported: false` (the CVE-2024-4367 lesson), page by page, with nothing rendered;
- control characters other than tab and line break are removed, line endings are normalised, and the text is NFC-normalised.

What is read: a PDF's text layer in page order; a DOCX's body paragraphs and tables, without comments, deleted revisions or field instructions; an XLSX's cell values, cached values and never formulas, sheet by sheet; a PPTX's slide text in slide order, without speaker notes; CSV and TXT as decoded text. A file with no extractable text, or one the extractor cannot read, is refused with 409 `ATTACHMENT_TEXT_UNAVAILABLE` and stays excluded.

**The caps** (D-33). The stored text is capped at 20,000 characters per file, and `aiTextFacts` keeps the characters available, the characters kept and whether the text was truncated. Truncation is never silent: the control, the run summary and "What the AI used" say "first n of m characters".

**Deletion.** Opting out, removal or a blocked verdict deletes `aiText` and `aiTextFacts`. Each change of inclusion is an event (`ai-included` or `ai-excluded`) with who and when; turning inclusion on when it is already on, or off when off, is a no-op that writes nothing. Undo is a second change.

**The text preview.** `GET …/ai_text` returns the stored text exactly as it would be sent, with its facts, to a human Security Analyst who may change the file's inclusion; a file that is not included answers 409 `ATTACHMENT_TEXT_UNAVAILABLE`.

**What the prompt carries** (D-34; decision 5, G-3). Exactly the included files' stored text, in upload order, each in its own delimited block inside the untrusted data block, escaped with `promptDataTag`. Each block is labelled by code constants only: its sequence, its type, its part and whether it was truncated. The prompt never carries a file's name (an injection channel and often personal data), the uploader's name, times, ids or the request number, and it says nothing about excluded, pending, blocked or removed files, not even that they exist. Every operation built on the context builder includes them: Phase 12's questionnaire generation and assessment draft now, then Phases 15, 16 and 17's operations, under the same classification check. Attachment text is never in the instruction slot (decision 5).

**The per-run bound.** Attachment text in one run is bounded at 60,000 characters for the assessment draft and 30,000 for questionnaire generation, within Phase 12's totals (`CONTEXT_BOUNDS`). Over either bound the run fails before any run record or provider call with `CONTEXT_TOO_LARGE`, and its message names the included files, so the analyst can exclude some (Phase 13's pattern for marked notes).

## The Run Record

**The context summary v3** (D-35). `CsrmAiRun.contextSummary` (`docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`, "Envelopes") gains a new envelope version, not a schema change. A v3 summary is Phase 13's v2 envelope with `schemaVersion: 3`, plus:

```text
attachments: {
  included: [{ documentId, sha256, type, part, charactersSent, charactersAvailable, truncated }],
  bound: <the per-run attachment bound that applied>
}
```

Each included file is named by its documentId, its digest, its type, its uploader's part, the characters sent and available, and whether it was truncated: never its text and never its name (G-3). The closed parser (`parseContextSummary`) accepts v1, v2 and v3 and fails safe to null on anything else; a v1 or v2 summary, written before this phase, reads as "included no files". The summary bound (`CONTEXT_BOUNDS.summaryBytes`, 64 KB) still applies.

**Names at read time.** The analyst's run read and "What the AI used" resolve each included file's current name from the attachment record when they are served, never from the summary. A file removed since the run still resolves, and says so.

**The "AI inputs changed" signal** (D-36). Phase 13's signal gains files on the same rule: the files whose current inclusion differs from their inclusion in the target's latest completed context-wide run, included since, excluded since, or removed since. A v1 or v2 baseline run counts as having included no files, and Phase 13's `generatedDate` fallback applies to inclusions. The signal stays advisory and analyst-only, with no re-run action here.

## Security Events

One security event log module in Strapi (D-37), built to Phase 19 D-18's contract: one structured line per event through Strapi's logger, with a stable, versioned event name and a JSON payload.

- **Events:** `attachment.uploaded`, `attachment.refused` (with its closed reason), `attachment.quarantined`, `attachment.scan_verdict`, `attachment.blocked`, `attachment.downloaded`, `attachment.integrity_failed`, `attachment.removed`, `attachment.restored` and `attachment.ai_inclusion_changed`.
- **Fields:** the time in UTC; the actor (`documentId` and display name, or the re-scan system); the request and attachment documentIds; the type, the size and the digest; and the outcome with its closed reason or the detection name.
- **Never** a file's content, name or extracted text.
- **Levels:** a malware detection, a blocked verdict and an integrity failure log at warning level, which the deployment's log platform alerts on; the rest at information level.
- **Reuse:** Phase 19 adds its export and import events, and Phase 17 its people-search log, to this module rather than building another.
- **Retention:** R-08-13 applies: the lines hold display names, so the deployment's log policy treats them as personal data.

## What This Extension Does Not Add

- **No media field on the request**, and no extension of the upload plugin's file type.
- **No file versions or replacement**, and no edit to a stored file: a correction is a new file and the removal of the old one.
- **No inline previews or thumbnails:** files only download.
- **No OCR, and no image sent to the model:** only extracted text, and only when included.
- **No per-file classification:** the request's classification governs.
- **No folders, tags, per-file descriptions or bulk download.**
- **No disposal job,** legal hold or purge on request.
- **No participant reach:** nominated risk owners and executive approvers never read attachments (G-12).
- **No answers for the questionnaire's `File upload` type**, which stays deferred.
- **No attachments on any other record:** questionnaires, assessments, Risks and control implementations get none. Phase 20's treatment evidence files reuse the pipeline in their own entity.
- **No internal, analyst-only files:** every file is visible to every reader of the request.
- **No change to an existing content type:** `CsrmAssessmentRequest`, `CsrmRequestNote` and `IdamBoxUser` gain no attribute, and no enumeration gains a value.

## Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams"). On 2026-10-10 that section's workstream table lists one workstream, `csrm`, whose application (`apps/csrm`) is the only one that reads these content types and calls these operations. This extension is backward compatible for any later reader:

- the table and its four link tables are new, with no core router and no inverse attribute on `CsrmAssessmentRequest`, `CsrmRequestNote` or `IdamBoxUser`, so no existing read, `populate` (including `populate=*`) or generated populate enum reaches them;
- no existing attribute, relation, enumeration value or grant changes;
- the two new Functions, `function.risk_assessment_requests.attachments_api` (for `role.requestor` and `role.security_analyst`) and `function.risk_assessment_requests.attachment_ai_input_api` (for `role.security_analyst`), are additive, and neither is granted to `role.security_analyst_agent`.

The attachments also change existing endpoints. Each change is additive, concerns only the `csrm` workstream's application, and is in a `csrm` plan:

- **The request read's attachment summary.** `GET /api/csrm-assessment-requests/{id}` gains the viewer's `attachments` summary, only for a reader of the request's attachments (plan 14-08). No existing field changes meaning or is removed.
- **The request delete's new refusal.** `DELETE /api/csrm-assessment-requests/{id}` answers 409 `REQUEST_HAS_ATTACHMENTS` for a request that holds any attachment, removed and blocked ones included (plan 14-08). It refuses only a request that holds a file: every delete that succeeds today still succeeds until a file exists, and only this phase's operations create one.
- **The analyst reads' file counts.** The analyst questionnaire and assessment reads gain `assessmentRequest.files` (the count of files not removed and the number included in the AI inputs); the Requestor's shapes are unchanged (plan 14-11).
- **The AI-inputs signal gains files.** `AiInputsChanged` gains a `files` list, wherever it is served: `generation.aiInputsChanged` on `AiGenerationFacts`, and the request read's `RequestAiInputs` (plan 14-11). Its `count` now means the notes changed plus the files changed, and the value is present when either list is non-empty, so a files-only change carries an empty `notes` list. A notes-only change reads exactly as Phase 13 served it, with an empty `files` list.
- **The upload plugin's content-API routes are unmounted.** `POST /api/upload`, `GET /api/upload/files`, `GET /api/upload/files/page`, `GET /api/upload/files/:id` and `DELETE /api/upload/files/:id` stop answering (plan 14-04). No CSRM caller uses them; only the full-access API token reached them (R-08-02), and the admin panel's own upload routes stay.

The AI run read's context summary gains the v3 attachments section beside v1 and v2, which still parse ("The Run Record"); the read stays human Security Analyst only.

## Migration

The extension is additive. Strapi's schema sync creates the table and the four link tables; no migration file accompanies it, following the Phase 06.1, 06.7, 06.8, 12 and 13 precedent, and `apps/backend/database/migrations/` stays empty. Proof requires:

- a fresh test database, with legacy requests reading as having no attachments and an empty attachment summary;
- `PRAGMA table_info` on `csrm_request_attachments`, listing the attribute columns (`file_name`, `file_type`, `byte_size`, `sha256`, `uploader_part`, `uploaded_at`, `scan_status`, `scan_checked_at`, `scan_engine`, `scan_detection`, `scan_attempts`, `removed_at`, `ai_text_included`, `ai_text`, `ai_text_facts`, `event_log`), with the four link tables present;
- the development database showing the table and its link tables after the orchestrator's next Strapi start (nothing is seeded; the private storage directory appears on the first upload);
- the content-type freeze check since `PHASE_14_BASE` listing exactly the approved schema file, `apps/backend/src/api/csrm-request-attachment/content-types/csrm-request-attachment/schema.json`.

## Audit Semantics and Limitation

The attachments are part of the request record: the information on which the assessment's context was established (ISO/IEC 27005 context establishment), kept for as long as the request. That is why removal is soft and a released or closed request's files are read-only.

`eventLog` is the history and the scan, removal and inclusion attributes are the current facts, the split the 06.8 record makes between `governanceLog` and the release facts. The current facts are what gates, the AI context and the signal read; the history says who changed what and when, and is never consulted for an authorisation decision. The log follows the request's retention, is scoped to one attachment and is readable only through the attachment operations; no unscoped history endpoint is introduced, and a cross-aggregate audit store stays out of scope. The security event lines are a separate, operational record for the deployment's log platform.

A file added in error is removed, not purged. A purge, an audited Admin action, needs its own decision.

The concurrency proofs (the count race at 19, removal against a restore, the delete against an upload) run on SQLite, where knex's single connection serialises the transaction and the lock statement compiles to a plain `SELECT`. They prove the serialised outcome, not the lock: the lock's in-process tail is proven in `request-lock.unit.test.ts`. PostgreSQL's row lock stays unproven until R-08-37 runs the Strapi suites on PostgreSQL; its checklist gains the attachment constructs: `FOR UPDATE` before the counts and the note check, and queries inside the lock bound to the transaction.

The re-scan scheduler and the extraction worker are in-process, so quarantine release is honest only with one Strapi process (R-08-36).

The Media Library residual is recorded under "Storage". The per-path body limit is a deployment residual under R-08-04: the web raises its upload body limit only for the pages that add files, and the deployment's reverse proxy sets a matching per-path limit (6 MiB by default, 27 MiB on those pages).

## Later Phases

- **Phases 15 and 16:** their operations use the context builder, so included files are sent automatically; they read the signal, files included, to offer re-runs.
- **Phase 17:** participants never reach attachments (G-12); its participant read of the request summary excludes the attachment summary, and the readers predicate answers them 404. Statuses it adds before closure join `acceptsNotes`, and so the attachment window.
- **Phase 17.1:** release and close moves the request to `closed`, which closes the window and makes its attachments read-only.
- **Phase 19.1:** its "new notes" event (`note-added`) covers files posted with notes, so no separate file event is needed.
- **Phase 19** reuses the file-transfer modules, the ZIP reader, the XLSX reader and the security event log this phase builds; exports never include attachments.
- **Phase 20:** treatment evidence files reuse the storage port, the content checks and limits, the scanner and quarantine, the download pattern and headers, the file-transfer modules and the event log, in their own entity with the risk record's readers and retention, decided in its own record.
- **Phase 22** owns the AI ceiling, which AI inclusion reads, and the attachment retention Admin setting (ROADMAP Phase 22, "Carried from Phases 12, 14 and 19.1"), which takes over the policy module's one constant.

None needs another attachment schema change.

## Approval

Status: **approved by the pilot on 2026-10-10** (G-6), for the one content type and the operations exactly as this record states them.

No content type, no `docs/references/specification.json` operation, no catalogue grant and no `served-operations.json` entry for attachments changes before the pilot's dated approval is written here (D-40).

What the pilot checked:

- **JDL** (`docs/references/idambox-datamodel.jdl`) **and the catalogue's design note 6**: the JDL has no attachment entity or media field, and its questionnaire `File upload` answer type stays deferred. `CsrmRequestAttachment` is a recorded concept, request-scoped like Phase 13's note, that competes with no JDL entity and reuses Phase 13's approved `CsrmRequestNotePart`. It has no inverse attribute, so `CsrmAssessmentRequest`, `CsrmRequestNote` and `IdamBoxUser` do not change.
- **API contract** (`docs/references/specification.json`):
  - six additive operations, with no core router;
  - the changes to existing endpoints listed under "Affected Workstreams": the request read's summary, `REQUEST_HAS_ATTACHMENTS` on the request delete, the analyst reads' file counts, and the AI-inputs signal's `files` and the new meaning of its `count`. Only `csrm` reads them, and each is in a `csrm` plan;
  - the closed reasons join Phase 10's single list;
  - the new 422 carries a closed reason.
- **The one removal of existing routes**: the upload plugin's content-API routes are unmounted. No CSRM caller uses them; they let the full-access token list, upload unscanned files and hard-delete private files (R-08-02). The admin panel's routes stay. The pilot accepts this as security hardening of the shared backend, recorded here for any later workstream.
- **Role-function catalogue**: `attachments_api` is granted to `role.requestor` and `role.security_analyst`, and `attachment_ai_input_api` to `role.security_analyst` only, which is also human-analyst-only. Neither is granted to `role.security_analyst_agent`, and both catalogue copies stay byte-identical.
- **AGENTS.md**:
  - the readers are exactly Phase 13's notes readers, with the refusal a missing record gets for everyone else (another Requestor and G-12's participants included), decided in Strapi against the resolved IdamBox User, with no branching on the auth mode;
  - people cross the API as `documentId` and `displayName` only;
  - downloads go through the typed API layer and a Server Action, with no Route Handler or raw `fetch`;
  - AI inclusion is a human analyst's opt-in, so AI output stays advisory.
- **Security (decision 2, G-3, G-7, OWASP and ASVS file-upload controls, ISM-2059)**:
  - **checks:** the allow-list checks content and extension together, refuses macro-enabled, encrypted and legacy Office files, bounds ZIP files before inflating, and sanitises names;
  - **storage:** storage is private, with random keys, byte-for-byte bytes, an integrity check on read and no URL served;
  - **downloads:** download headers force an attachment (`nosniff`, `no-store`, a sandboxed CSP);
  - **scanning:** scanning fails closed into quarantine, and the development double fails boot outside development;
  - **AI text:** extraction runs only on opt-in, in a bounded worker with no DTD or entity processing and PDF evaluation off. The prompt carries delimited, untrusted text with no file names, and the run summary keeps no text and no names;
  - **events:** security event lines never hold content or names.
- **Audit**:
  - soft, reversible removal by the remover;
  - an append-only, capped, fail-safe event log that no gate reads;
  - read-only files after release;
  - retention follows the assessment record.
  - The residuals are named: R-08-36 for the single-process re-scan and extraction, R-08-37 for the PostgreSQL row lock, R-08-04 for the per-path body limit, the Media Library and the ISM-2059 quarantine reading.
- **The stage B amendment (added on 2026-10-11)**, acknowledged by the pilot on 2026-10-11 (G-6) per `14-PILOT-RULINGS.md`, each item stated under "Amendment (2026-10-11, stage B)":
  - (2026-10-11) `failureAttachments` on `AssessmentDraftJobFailed` and `QuestionnaireGenerationJob`;
  - (2026-10-11) the required `files` key, served as `null` to the Requestor, on `AssessmentRequestSummary` and the questionnaire's request summary (`QuestionnaireAssessmentRequestAvailable`), which corrects "The Requestor's shapes are unchanged";
  - (2026-10-11) `requestId` on the v3 `AiRunContextAttachment`;
  - (2026-10-11) one detection pattern, `^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$`, in the specification, Strapi's served and logged patterns and the web transport and parser, with `RequestAttachment.detection` held to it and served `null` otherwise;
  - (2026-10-11) three new closed reasons, `ATTACHMENT_UNSUPPORTED_STRUCTURE` (415), `ATTACHMENT_ACTIVE_CONTENT` (415) and `ATTACHMENT_BUSY` (503, retryable), with a `503` response on the upload and the AI inclusion;
  - (2026-10-11) the attachment controller's refusal envelope is `{ error }`, without `data: null`;
  - (2026-10-11) the `sha256` attribute's column is `sha_256`.

This approval covers the content type, the operations and the contract changes above. Any new runtime dependency (for example PDF text extraction, or the production S3 upload provider, G-7) is governed by its plan, which names its concrete reason, and by the phase's manifest static check (AGENTS.md: no dependency without a concrete reason).

## Amendment (2026-10-11, stage B)

Acknowledged by the pilot on 2026-10-11 (G-6), per `14-PILOT-RULINGS.md`.

The approval above covers "the operations exactly as this record states them". The review's WR-701 found that the shipped contract changes existing endpoints this record does not list, and stage B makes its own contract changes. The pilot acknowledged all seven in advance ("Contract changes in stage B"); each is stated here. Every change is additive or a tightening of a served value, and reaches only the `csrm` workstream's application. The earlier sections stay as approved; where this amendment corrects one of them, it quotes the corrected words.

1. **`failureAttachments` on two existing job shapes (shipped in stage A, plan 14-10).** `AssessmentDraftJobFailed` (the failed branch of `AssessmentDraftJob`) and `QuestionnaireGenerationJob` gain the optional key `failureAttachments`: an array of `GenerationJobFailureAttachment`, each a file's `documentId` and its current `fileName` (null when the record no longer exists), listing the included files a `CONTEXT_TOO_LARGE` failure counted, so the analyst can exclude some. It is served by the draft-job operations (`assessment-workflow/generate-assessment-draft`, `assessment-workflow/get-assessment-draft-job` and `assessment-workflow/retry-assessment-draft-job`), the generation-job operations (`questionnaire-generation/generate-questionnaire`, `questionnaire-generation/get-questionnaire-generation-job` and `questionnaire-generation/retry-questionnaire-generation-job`) and the request's job list (`questionnaire-generation/get-request-generation-jobs`). The record said only that the failure's message names the included files ("The per-run bound").
2. **The required `files` key on the Requestor's shapes (shipped in stage A, plan 14-11).** `AssessmentRequestSummary` (the assessment reads: `AssessmentDetail`, `AnalystAssessmentDetail` and `RequestorReleasedAssessmentDetail`) and the questionnaire's request summary (`QuestionnaireAssessmentRequestAvailable`, on the questionnaire reads) gain `files` as a required key: `RequestSummaryFiles` on a human Security Analyst's read, and `null` on every other read, the Requestor's included. This corrects "Operations and Functions", which says "The Requestor's shapes are unchanged.", and "Affected Workstreams", which says "the Requestor's shapes are unchanged (plan 14-11)". The Requestor's shapes gain one required key, always `null` for them; a strict reader of those shapes must accept it.
3. **`requestId` on the v3 run entry (shipped in stage A, plan 14-10).** `AiRunContextAttachment`, served by the AI run read (`ai-runs/get-ai-run`), gains the required key `requestId`: the request the attachment record names when the run is read, or `null` when no record of the file remains on the run's request (its `fileName` is then `null` too). Like `fileName` and `removed`, it is resolved at read time and never stored in the summary. "The Run Record" names only the read-time name and the removal.
4. **One detection pattern (WR-501, IN-704).** A scanner's detection name is held to `^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$` wherever it is served or logged: the specification's `AssessmentWorkflowErrorResponse.error.details.detection` (the upload's 422), Strapi's served pattern (`SERVED_DETECTION`) and logged pattern (the security event line's `DETECTION`), both now the one constant `ATTACHMENT_DETECTION_PATTERN` in the attachment policy module, the web transport, and the web's attachments parser. `RequestAttachment.detection` (the list, the upload, the removal and the AI inclusion answers) gains the same `pattern`, stays nullable, and is served `null` when the recorded name does not match it. Two corrections of the review's premise are recorded with it: the earlier pattern's class `._:/-` already admitted the underscore, so real ClamAV names such as `Win.Test.EICAR_HDB-1` were served and logged before this amendment (WR-501 is not reproduced); the pattern is rewritten with the underscore first so it reads plainly. The changes in behaviour are that the security event line, which allowed 200 characters, now logs only what the contract serves (at most 128), and that a listed file's detection is now held to the pattern at all.
5. **Three new closed reasons.** Each is in Strapi's closed list (`apps/backend/src/csrm/conflict-reasons.ts`), both specification reason enums (`AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse`, with their descriptions) and the web's list, with its family copy in 14-UI-SPEC §8:
   - `ATTACHMENT_UNSUPPORTED_STRUCTURE`, 415, on the upload (`assessment-workflow/upload-request-attachment`): a ZIP-based file packaged in a way CSRM will not read. It is the archive comment CR-201 refuses, the three bounds of "Content, Limits and Refusals" (more than 10,000 entries, more than 1 GiB declared, an entry above 200:1), ZIP64 and a compression method other than stored or deflate (IN-202). A malformed archive stays `ATTACHMENT_CONTENT_MISMATCH`, and the encryption flag stays `ATTACHMENT_ENCRYPTED`.
   - `ATTACHMENT_ACTIVE_CONTENT`, 415, on the upload: an Office file carrying active content beyond macros, an external linked object, template, frame or subdocument, or an ActiveX control (WR-205; the behaviour is the Lane 2 fix's).
   - `ATTACHMENT_BUSY`, 503 and retryable, on the upload and on the AI inclusion (`assessment-workflow/set-request-attachment-ai-input`): the screening or extraction queue is full, so the request is refused at once and nothing is done (WR-204; the behaviour is the Lane 2 fix's). Both operations gain a `503` response with the existing refusal schema, `AssessmentWorkflowErrorResponse`. It is the only reason a 5xx carries, and the web transport keeps it on a 503 alone.
6. **The hand-written refusal envelope drops `data: null` (IN-705).** The attachment controller's own refusals are now exactly `{ error }`, as `AssessmentWorkflowErrorResponse` (closed, `error` only) publishes. No web or contract parser needs `data` on an error: `normalizeTransportError` reads only `error.details` from the body, openapi-fetch returns no `data` for an error response, and R-08-38 records that the web never parses an error body closed. R-08-38 is therefore not amended: it still covers Strapi's own framework envelope (for example a policy 403 or an internal 500), which keeps `data: null`.
7. **The `sha256` column is `sha_256` (IN-104).** Strapi snake-cases the attribute `sha256` to the column `sha_256` (14-06's finding, pinned by `request-attachments.integration.test.ts`). This corrects the Migration proof list, which names "`byte_size`, `sha256`, `uploader_part`": the column is `sha_256`. The attribute name, `sha256`, is unchanged, and the R-08-37 PostgreSQL checklist uses the column `sha_256`.

**The security event log's vocabulary (2026-10-11, stage B, Lane 1; not a contract change).** Two rulings of `14-PILOT-RULINGS.md` add to "Security Events" without changing any served operation, schema or reason enum. WR-101: a withdrawal or a verdict whose record the attachment's own event log cannot take (a log at its cap, which only a seed or a legacy record reaches, or a malformed log) is still made, the log left untouched, and the event `attachment.history_unavailable` records it at warning level, with the change as its outcome (`excluded`, `removed`, `clean` or `blocked`), the reason `HISTORY_UNAVAILABLE` and the same closed fields as every line. WR-103: the readers-rule 404 is now an `attachment.refused` line too, with the closed log reason `NOT_FOUND`, which is a log value only (it is in no reason enum, and the 404 names no reason), and only the request and attachment ids the caller asked for that pass the log's identifier rule.

**Record corrections that change no contract (2026-10-11, stage B, Lane 7).** The pilot's rulings on WR-702, IN-702, IN-709 and WR-705 (`14-PILOT-RULINGS.md`, Lane 7) correct or add to these sentences of the approved record. No served operation, schema, reason enum, content type or catalogue grant changes. The earlier sections stay as approved; each correction quotes the words it corrects.

- **Deleted bytes under S3 versioning (WR-702).** "Malware Scanning and Quarantine" says "A re-scan's infected verdict deletes the stored bytes and the plugin's file record", and "Write Discipline" says that a refusal under the lock "deletes the stored bytes and the plugin's file record, so nothing is left behind". Both hold for the current object only. In production the bucket is versioned, and the S3 provider's delete is a plain `DeleteObject` with no version id, which adds a delete marker and keeps the deleted bytes as a noncurrent version. CSRM deletes stored bytes only for content that must not be kept: a blocked file (the re-scan's infected verdict); a late refusal (an upload whose bytes were stored before the request lock refused it or failed to record it, for example the count race, D-10); and the storage port's own rollback when the plugin's file record cannot be created after the bytes were stored. An administrator can also delete a file in the Media Library. CSRM never deletes a retained attachment's bytes, because removal is soft. The deployment guidance (`apps/backend/README.md`, the private S3 bucket, step 5) expires noncurrent versions under the attachment prefix 30 days after they become noncurrent. That bounds how long malware can survive as a noncurrent version, and keeps versioning as a short-term undo of an administrator's deletion. Until then the bytes are private and encrypted, and CSRM's role cannot read them, because it holds no `s3:GetObjectVersion`. The residual is R-08-46, with the operator as owner. The rejected alternative: deleting the specific version from code would need the AWS SDK as a new direct dependency, and `s3:DeleteObjectVersion` would let a compromised application role destroy every retained file permanently.
- **Retention (IN-709).** "Removal, Blocked Files and Retention" says "In production the bucket's lifecycle rules enforce retention (G-7)." Lifecycle rules cannot enforce a minimum: they never expire current objects, and they can only expire or move objects. Versioning makes a deletion recoverable for the 30-day noncurrent window. Long-term protection of retained files is a backup in a separate AWS account (AWS Backup or replication), not lifecycle rules. Object Lock is not used, because blocked files must be deletable. R-08-45 records it.
- **The Media Library (IN-702, IN-209).** "Storage" says that "Strapi administrators still see attachment files in the admin Media Library". They can see and delete a file there, but not download it. Neither provider gives the admin panel a URL that serves the bytes: under S3 the provider signs a URL only for a `private` ACL, which CSRM never sends, so the panel gets the unsigned object URL, which Block Public Access refuses; the local provider's `/csrm-private/` URL is served by nothing. An administrator's Media Library upload is never content-checked or malware-scanned by CSRM, and it is stored under the same `csrm/attachments/` prefix and IAM scope as the attachments. The recommendation that Media Library rights stay with super admins covers it too (R-08-44).
- **The S3 endpoint (WR-705, IN-209).** "Storage" names no transport for an S3-compatible endpoint. Since `9555b0d`, an `http:` `CSRM_ATTACHMENT_S3_ENDPOINT` stops the boot outside development, like every other invalid S3 setting, and the deployment guidance adds a bucket policy that denies every S3 action when `aws:SecureTransport` is `false`.
