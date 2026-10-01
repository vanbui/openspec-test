# Phase 14: Request attachments - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`, one pass. Every gray area took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005), at the G-4 premium bar. The decisions are grounded in:
- the product gap UAT (`.planning/uat/product-gaps/`: UAT-012, `REPORT.md` §8 and §9 decision 2, `JOURNEYS.md` area 2's F1 and A1 rows, `BRIEF.md` Appendix A's F1 and A1);
- the delegated decisions in `.planning/NEXT-WAVE-DECISIONS.md` (#2 first, with #5, #6, #9, #12, #18, G-1, G-3, G-4, G-6 and G-7, and the post-demo G-12, G-13, G-15 and G-16);
- the orchestrator's seeds for this unit, each confirmed or corrected against the code;
- the planned outputs of Phase 10 (CONTEXT and 23 plans), Phase 11 (CONTEXT, UI-SPEC, RESEARCH, PATTERNS and plans), Phase 12 (CONTEXT, RESEARCH, UI-SPEC and PATTERNS), Phase 13 (CONTEXT only: it has no UI-SPEC, research or plans yet) and Phase 19 (CONTEXT: the file-transfer pattern and the event log);
- a read of today's code in `apps/backend` and `apps/csrm`, and of the installed `@strapi/upload` 5.51.0 and `@strapi/provider-upload-local` 5.51.0.

There is no SPEC.md for this phase. The discussion log is `14-DISCUSSION-LOG.md`. Plans for this phase are written ahead, against today's code plus the planned outputs of Phases 10 to 13, and each plan says so and names the earlier plans it relies on. Phase 14 executes before Phase 19 (execution order 10, 11, 12, 13, 14, 15, 16, 19, …), so it builds the two shared modules that Phase 19's CONTEXT designed: the file-transfer pattern (D-24) and the security event log (D-37).

**Seeds corrected against the code** (recorded so the planner does not reopen them):
- **Strapi's built-in local provider is not private.** `@strapi/provider-upload-local` writes to `apps/backend/public/uploads`, which `strapi::public` serves to anyone at `/uploads/{hash}{ext}`. "Local in development" therefore needs a private local provider outside `public/` (D-06).
- **The upload plugin already sniffs content.** `@strapi/upload` 5.51.0 (`dist/server/utils/mime-validation.js`) checks every plugin upload with `file-type` 21.3.4, already in the tree, against `config/plugins.ts`'s `security.allowedTypes`. That list serves the admin Media Library and admits images, video, audio and every Office Open XML type, so it is a second layer only; CSRM's own allow-list is stricter (D-09).
- **The upload plugin's own content-API routes are mounted.** The authorization matrix records that the full-access API token reaches `POST /api/upload` and the `/api/upload/files` reads and delete (R-08-02). Once private files live in the plugin, those routes would reach them (D-08).
- **A 25 MB file exceeds today's Server Action body limit** (`next.config.ts`: `bodySizeLimit: '6mb'`), while Strapi's multipart limit (`config/middlewares.ts`: 52,428,800 bytes per file) already admits it (D-25).
- **Tests would trip the build host's antivirus** if a suite wrote the EICAR string to disk on this Windows host (D-14).

<domain>
## Phase Boundary

Let the Requestor and Security Analysts attach supporting files to an Assessment Request, at intake and at any later point until it is released or closed. Files are kept in private storage that is reachable only through authorised Strapi operations, accepted only when their content is an allowed type within the limits and has passed a malware scan, removed only softly and on the record, and read by the AI only when a Security Analyst opts a file's extracted text into the assessment context. The phase closes UAT-012 and delivers COLLAB-02. It builds the attachment pipeline (storage, content checks, scanning and quarantine, downloads, extraction) that Phase 20's treatment evidence files reuse and, because it executes first, the file-transfer and security-event modules that Phase 19's exports reuse.

In scope:
- the attachment record, its contract-gap record and approval checkpoint, and its operations: list, upload, download, remove and restore, the analyst's AI inclusion and the text preview;
- private storage through the upload plugin: a private local provider in development and tests, and the official S3 provider configured private for production; the plugin's own content-API routes unmounted;
- the allow-list checked by content, the limits, the scanner port with its development double and its ClamAV adapter, quarantine and re-scans;
- files at intake (the new-request form and the draft), and later posted with a note (Phase 13);
- the Files panel on both request pages, each note's files in the thread, the server-rendered summaries on the analyst questionnaire and assessment pages, and the upload queue's per-file progress;
- per-file AI inclusion: extraction on opt-in, caps, untrusted delimiting, the run record's attachments section, the "What the AI used" group and the "AI inputs changed" signal;
- the security event log module and the shared file-transfer modules (Phase 19's designs, built here first);
- the catalogue grants, the authorisation proofs, the configuration in the `.example` files, and the tests.

Out of scope:
- attachments on questionnaires, assessments, risks or control implementations, and the questionnaire's `File upload` answer type, which stays deferred (`docs/contract-gaps/phase-03-questionnaire-json-contract.md`);
- treatment evidence files (Phase 20, which reuses this pipeline);
- inline previews or thumbnails, OCR, sending images to the model, and citing attachments in AI proposals;
- notifications (Phase 17): files posted after submission ride on Phase 13's "new note" event (D-17);
- a disposal job, legal hold, and the Admin's retention setting (D-22);
- any reach for risk owners or executive approvers (G-12);
- Keycloak, live AI generation, and a running ClamAV or S3 in any suite.
</domain>

<requirements>
## Requirements and Success Criteria This Phase Owns

**COLLAB-02:** The Requestor and Security Analysts can attach supporting files (PDF, office documents, spreadsheets) to a request at intake and at any later stage.
- (1) Allowed files (PDF, DOCX, XLSX, PPTX, CSV, TXT, PNG and JPEG, checked by content; up to 25 MB each and 20 per request) upload at creation and later, each showing name, size, uploader and time, and download only through an authorised operation: D-09, D-10, D-16, D-17, D-23 to D-28.
- (2) A disallowed type, an oversize file or a file that fails the malware scan is refused with its reason: D-09 to D-14.
- (3) Only actors who may read the request can list or download its files, and another Requestor is refused at every route: D-08, D-18, D-19, D-23.
- (4) Removal records actor and time, and retention follows the assessment's: D-20 to D-22.
- (5) The analyst opts each file's extracted text into the AI context, off by default; included text is size-capped, marked as untrusted, and never sent above the provider's approved classification ceiling: D-30 to D-36.

**ROADMAP success criteria (Phase 14):**
1. A Requestor attaches a PDF, a Word document and a spreadsheet when creating a request and adds another later; the analyst sees all four: D-16, D-17, D-26 to D-28.
2. Another Requestor cannot list or download them by any URL: D-06, D-08, D-18, D-23.
3. A disallowed, oversize or infected file is refused with a clear message: D-09 to D-14, D-26.
4. Each file shows who added it and when, and removal is recorded: D-01, D-20, D-28.
5. The analyst includes one file's text in the AI context and the run record shows it; excluded files never reach the provider: D-30 to D-35.

**Closes:** UAT-012 (a request cannot carry supporting files, at intake or later, for either actor).
**Intent:** F1, A1.
</requirements>

<decisions>
## Implementation Decisions

### Scope and contract boundary

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

### Storage (decision 2, G-7)

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

### Types, limits and refusals (decision 2; COLLAB-02 criteria 1 and 2)

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

### Malware scanning and quarantine (decision 2, G-7)

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

### Configuration and environments (G-7; new settings in the `.example` files)

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

### When files are added, and notes give them context (COLLAB-02 criterion 1; Phase 13 D-22)

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

### Who reads, adds and removes (COLLAB-02 criterion 3; G-12; Phase 13 D-23)

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

### Removal, blocked files and retention (COLLAB-02 criterion 4; decision 2)

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

### Downloads and how files reach the browser (decision 2; Phase 19 D-19)

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

### The upload experience and its surfaces (G-4)

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

### The AI context (decision 2, decision 5, G-3; COLLAB-02 criterion 5)

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

### Security events (decision 12's pattern; ISO/IEC 27001:2022 Annex A 8.15 and 8.16)

- **D-37:** One security event log module in Strapi, built here to Phase 19 D-18's contract: one structured line per event through Strapi's logger, with a stable event name and a JSON payload.
  - **Events:** uploaded, refused (with its reason), quarantined, scan verdict, blocked, downloaded, integrity failure, removed, restored, and AI inclusion changed.
  - **Fields:** the time (UTC), the actor (`documentId` and display name), the request and attachment `documentId`s, the type, the size, the digest, and the outcome with its closed reason or the detection name.
  - **Never** a file's content, name or extracted text.
  - **Levels:** a malware detection, a blocked verdict and an integrity failure log at warning level, which the deployment's log platform alerts on.
  - **Reuse:** Phase 19 adds its export and import events, and Phase 17 its people-search log (G-17), to this module rather than building another.
  - **Retention:** R-08-13: the lines hold names, so the deployment's log policy treats them as personal data.

  **Reversibility:** costly - log consumers key on the event names and fields.

### Roles, grants and the catalogue

- **D-38:** The catalogue, in both copies, byte-identical:

  | Function (names are proposals) | Holder | Operations |
  |---|---|---|
  | `function.risk_assessment_requests.attachments_api` | `role.requestor` and `role.security_analyst` | list, upload, download, remove and restore |
  | `function.risk_assessment_requests.attachment_ai_input_api` | `role.security_analyst` | AI inclusion and the text preview |

  - Neither is granted to `role.security_analyst_agent`.
  - The AI inclusion and the text preview join `HUMAN_ANALYST_ONLY_OPERATIONS` in the policy and in the matrix's mirror, as a second refusal.
  - The attachment operations serve both actors, so they cannot join that set. Their analyst path is human-only because the agent's role lacks the grant, and the record rule (D-18) does the rest (Phase 13 D-30).
  - A catalogue design note records the new Functions and amends note 6 for attachments, and `served-operations.json` is regenerated: the new operations served, and the upload plugin's content-API routes gone (D-08).

### Verification and plan shape

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

### Planner's Discretion

- Module placement: a new `csrm-request-attachment` API folder or routes under the request API; the shared Strapi pipeline (for example `apps/backend/src/csrm/files/` for storage, content checks, scanning and extraction, and `apps/backend/src/csrm/audit/` for the event log); the web feature (for example `apps/csrm/src/features/attachments/`) and the shared file-transfer modules.
- The names of reason codes, Functions, operations, fields, settings, event names and envelope versions, within the families above.
- The bounds within the proposals: the per-file text cap, the per-run attachment bound, the note window, the lifetime bound, scan timeouts and the re-scan backoff.
- How the private local provider is wired, and whether attachments are stored through the plugin's upload service with formats off or through the provider and the file record directly (D-06, D-07).
- Whether the file-transfer modules and the event log land in their own plan or with the first operation that uses them.
- Whether the plugin's file records go in a dedicated Media Library folder.
- How the work splits into plans, provided D-40's serialisation holds.
- Copy, layout, routes and visuals: the UI-SPEC's.
</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/NEXT-WAVE-DECISIONS.md` and the ROADMAP entry; none is open.

| Decision | What it settles here | Implemented by |
|---|---|---|
| #2 Attachments | Private storage through the upload plugin; downloads only through an authorised operation with attachment disposition and `nosniff`; an allow-list by content and extension; 25 MB and 20 per request; quarantine until the scan passes; a pluggable scanner (ClamAV in production, a double in development and tests); soft, recorded removal; retention 7 years after closure, set by the Admin; per-file AI opt-in, off by default, capped, untrusted, never above the ceiling | D-01, D-06 to D-23, D-30 to D-34 |
| #5 Analyst instructions | Attachment text is always delimited as untrusted data, never in the instruction slot | D-34 |
| #6 Removing risks (pattern) | Nothing persisted is hard-deleted; removal is recorded | D-20 |
| #9 After release | The released record is immutable: attachments are read-only once released or closed | D-16 |
| #12 Exports (pattern) | Every file leaving the system is logged; hardened file headers (19 D-10) | D-23, D-37 |
| #18 Notifications | Files posted after submission ride on the "new notes" event in Phase 17 | D-17 |
| G-1 Separation of duties | A requesting analyst acts as the Requestor; no AI inclusion on one's own request; the service agent holds no attachment grant | D-19, D-30, D-38 |
| G-3 AI data policy | Minimal context; attachment text delimited as untrusted; the run records a summary, never the text; refusal above the ceiling | D-30 to D-36 |
| G-4 Premium bar | Per-file progress, no lost input, Undo, skeletons, empty states, phone layouts, a keyboard path | D-26 to D-29 |
| G-6 Housekeeping | The pilot approves the contract-gap record; a Playwright run leaves the tree clean | D-01, D-39, D-40 |
| G-7 Production infrastructure | S3 in Sydney, private, SSE-KMS, versioning, lifecycle; `clamd` INSTREAM, failing closed; a double that flags EICAR; nothing installed on the build host; Phase 14 builds the storage and scanner adapters | D-06, D-12 to D-15 |
| G-12 Who reads the assessment | Participants read the request summary, not its attachments | D-18 |
| G-13 Release and close | `closed` joins the read-only statuses | D-16 |
| G-15 Contest points | Names Phase 14's attachment as its own recorded concept | D-02 |
| G-16 Treatment tracking | Evidence files go through this phase's attachment pipeline (Phase 20) | Seams |

No conflict was found between the ROADMAP entry and these decisions. The ROADMAP's "delete" is decision 2's soft removal (D-04 item 4). One gap is flagged for the orchestrator: decision 2 makes the retention period Admin-settable, but no phase names that setting (D-22).
</operator_decisions>

<contract_gaps>
## Contract-Gap Record and Its Approval Checkpoint

One record, in the format of `docs/contract-gaps/phase-06.1-revert-audit-facts.md` and `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md` (Gap, Approved Compatibility Extension, Write Discipline, What This Extension Does Not Add, Audit Semantics and Limitation):

**`docs/contract-gaps/phase-14-request-attachments.md`.**
- **The gap:** the JDL has no attachment entity or media field (catalogue design note 6; UAT-012), and the questionnaire's `File upload` answer type fails closed until a contract exists for authenticated upload, storage, malware scanning, retention and record authorisation (`phase-03-questionnaire-json-contract.md`). That answer type stays deferred; this record is the contract a later phase can reuse for it.
- **The extension:** D-01's content type, D-04's operations, and the upload plugin's content-API routes unmounted (D-08).
- **Storage:** the private providers, no URL leaving Strapi, generated keys, byte-for-byte storage, and the digest (D-06, D-07).
- **Content and scanning:** the allow-list and its checks, the limits, the scanner port, quarantine, re-scans and blocked files, and the ClamAV deployment requirements (D-09 to D-14, D-21).
- **Write discipline:** one service writes the facts, serialised per request; the event log is append-only and versioned, read through a closed parser that fails safe, and never read by an authorisation decision (the 06.8 posture). Gates read the current facts only.
- **The rules:** the window (D-16), the note link and its window (D-17, a cross-reference to `phase-13-request-notes.md`: the note entity is unchanged), the readers and actors (D-18, D-19), removal and restore (D-20), retention (D-22), downloads (D-23), and AI inclusion with its extracted text (D-30 to D-33).
- **The run record:** the context summary's attachments section (D-35), a new envelope version of `phase-12-ai-run-record-and-provenance.md`'s summary without a schema change, as Phase 13's notes section is.
- **The security events** (D-37).
- **Not added:** a media field on the request; file versions or replacement; inline previews; OCR or images sent to the model; per-file classification; folders or tags; a disposal job; any participant reach; edits to a stored file; the questionnaire's `File upload` answers; attachments on any other record.

**Checkpoint:** the record is followed by a `checkpoint:decision` task at which the executor stops. Under G-6 the pilot reviews the record, approves it, and records the approval in the record itself. Only then does the plan that changes `apps/backend/src/api/*/content-types/*`, the specification, the catalogues or the inventory run. The content-type freeze check then lists exactly the approved schema file. The change is additive, so Strapi's schema sync creates the table, and `apps/backend/database/migrations/` stays empty, as in 06.1, 06.7, 06.8, Phase 12 and Phase 13. The proof boots a fresh test database, reads legacy requests as having no attachments, and confirms the development database's new table after the orchestrator's next Strapi start.
</contract_gaps>

<authorisation>
## Authorisation Model

Keycloak authenticates. Strapi enforces Role → Function → FunctionAPI, then the record-level rule, against the resolved IdamBox User (`ctx.state` after the identity middlewares), identically under the development identity bridge and a Keycloak-verified user. Navigation visibility is not authorisation: every control the UI hides is also refused by Strapi.

**Grants:**
- **Attachments** (list, upload, download, remove and restore): the Requestor birthright and the Security Analyst, with the record rule of D-18 and the actor rules of D-16, D-17 and D-19.
- **AI inclusion and the text preview:** the human Security Analyst only, held twice (the grant and `HUMAN_ANALYST_ONLY_OPERATIONS`).

**Positive cases:**
- the request's requestor adds files to their draft, and after submission with their own note; any human Security Analyst adds files after submission with their own note;
- the requestor and any human Security Analyst list the request's files and download its clean, unremoved files;
- the uploader removes their own files; any human Security Analyst removes any file; the remover restores it; all within the window;
- any human Security Analyst who did not raise the request includes or excludes a clean, text-bearing file and reads its stored text, within the window and the AI policy.

**Negative cases** (each proven in the API by a Strapi integration test or matrix row, and in the UI by a web unit test or Playwright):

| Case | API outcome | UI outcome |
|---|---|---|
| Another Requestor lists, uploads to, downloads from, removes or restores files of Jane's request, by any URL | 404, persistence unchanged | Jane's request shows its existing permission or not-found state; no file, name or count of hers appears anywhere |
| An attachment id from one request used under another request's path | 404 | Not applicable |
| A participant who is not the requestor (Phase 17 onward) uses any attachment route | 404 (the readers predicate never includes participants) | No Files panel on any participant view |
| The service agent uses an attachment route on a request it did not raise | 404 | Not applicable (no web session) |
| A Requestor or the service agent calls AI inclusion or the text preview | 403 (no grant; the human-only set) | No AI control shown |
| An analyst who raised the request changes or previews a file's AI inclusion on it | `OWN_REQUEST` refusal (research fixes 403 or 409 with the closed reason, as Phase 13 does) | No AI control, and a line saying another Security Analyst decides |
| An upload carrying any part other than `file` and `noteId` | 400, nothing written | No such control |
| An analyst adds a file to a draft | 409 `REQUEST_NOT_SUBMITTED` | Not offered |
| A file after submission without a note, with another person's note, a note on another request, or a note past its window | 409 `ATTACHMENT_NOTE_REQUIRED` or `ATTACHMENT_NOTE_INVALID` | The composer always posts files with the note |
| Any add, remove, restore or AI change on a released or closed request | 409 `ATTACHMENTS_CLOSED` | A read-only panel that says why |
| A Requestor removes someone else's file; someone other than the remover restores | Refused with `NOT_UPLOADER` or the restore reason (research fixes 403 or 409, as for `OWN_REQUEST`), nothing changed | Remove only on their own files; Restore only for the remover |
| A disallowed, mismatched, macro-enabled, encrypted, old-format, empty or oversize file | Closed reasons (research fixes 400, 413 or 415), nothing stored | The refusal with its fix |
| A file carrying malware (the double's test signature, or the fake `clamd`'s finding) | Refused with the detection, nothing stored, a warning event | The refusal names it and points to the IT service desk |
| The 21st active file, or past the lifetime bound | 409 `ATTACHMENT_LIMIT_REACHED` | Add disabled, with the reason |
| Downloading a quarantined, blocked or removed file | 409 with its reason | No Download control |
| A stored file whose bytes no longer match the digest | Refused (`ATTACHMENT_INTEGRITY_FAILED`), a warning event | The download error |
| Including a PNG or JPEG, a quarantined, blocked or removed file, or one with no text | 409 with its reason | The control says why |
| Including while the request's AI policy refuses | 409 `AI_CLASSIFICATION_ABOVE_CEILING` or `AI_POLICY_NOT_CONFIGURED` | The control says why, naming the classification and the limit |
| Uploading where storage or scanning is not configured | 409 `ATTACHMENTS_NOT_CONFIGURED` | Add replaced by the reason |
| The upload plugin's content-API routes | Unmounted (the recorded 404 or 405) | Not applicable |
| Deleting a request that holds an attachment | 409 `REQUEST_HAS_ATTACHMENTS` | Not applicable (no web caller) |
| No identity, or no token | Per the matrix conventions: 403, or the token family's status | The sign-in path |

The AI never decides what it reads: only a human Security Analyst's recorded opt-in puts a file's text in the context, and generation itself stays human-initiated (Phase 12 D-32).
</authorisation>

<seams>
## Cross-Phase Seams

- **Phase 10** (executes first):
  - its navigation guard (D-12) protects queued uploads and unsent form or composer input (D-26);
  - its closed conflict-reason list and refusal copy gain this phase's reasons (D-11);
  - `LocalInstant` and X-3 show when each file was added and removed;
  - Phase 12's `aiPolicy` block on 10-13's generation-jobs read feeds the AI control's state.
- **Phase 11** (executes first): the one status mapping (`status-badge.tsx` `statusPresentation`) gains the attachment states. Nothing in its navigation, counts, lists or Homes changes.
- **Phase 12** (executes first):
  - this phase builds the context builder's attachment extension point (D-08) inside the untrusted data block, under the same policy;
  - the context summary gains its attachments section, a new envelope version after Phase 13's;
  - the "What the AI used" sheet gains its Attachments group;
  - AI inclusion reads the data-policy module (D-26 to D-29);
  - the guardrail tests extend to attachment text.
- **Phase 13** (executes first; CONTEXT only when these plans are written):
  - notes give files their context: after submission, a file is posted with its author's note, and the note's unread flag tells the other party (D-17). The note entity and its operations are unchanged; the composer gains files, and the thread shows each note's files;
  - one readers predicate serves notes and attachments (D-18), and `acceptsAttachments` builds on `acceptsNotes` (D-16);
  - the D-29 signal gains files (D-36), and the analyst pages' notes summary gains file counts (D-27);
  - G-1's reading (Phase 13 D-07) covers removal and AI inclusion (D-19, D-30);
  - its second analyst persona (D-31) serves the removal and restore proofs.
- **Phases 15 and 16:** their operations use the context builder, so included files are sent automatically, and they read the signal, files included.
- **Phase 17:**
  - participants never reach attachments (G-12; ASSESS-22 criterion 3): its participant read of the request summary excludes the attachment summary, and the readers predicate refuses participants with 404. Its slice of `risk-owner-journey.spec.ts` may assert the risk owner's 404 at the attachment list as one of its negative cases;
  - its notification centre's "new notes" event covers files posted after submission (D-17), so no separate file event is needed;
  - statuses it adds before closure join `acceptsNotes`, and so the attachment window.
- **Phase 17.1:** release and close moves the request to `closed`, which makes its attachments read-only (D-16).
- **Phase 19:**
  - it reuses the file-transfer modules (D-24) and the security event log (D-37) that this phase builds to its D-18 and D-19 designs, rather than building them; the orchestrator aligns this, as 19 D-19 asked;
  - its one XLSX reader (19 D-12) is the one this phase adds for extraction, if it adds one;
  - exports never include attachments (19 D-04).
- **Phase 20:**
  - treatment evidence files (RISK-06 criterion 3, G-16) reuse the storage port, the content checks and limits, the scanner and quarantine, the download operation's pattern and headers, the file-transfer modules and the event log;
  - its record (`docs/contract-gaps/phase-20-treatment-tracking.md`) decides the evidence entity. The recommendation is its own entity carrying the same file facts as D-01, because its readers (risk and treatment owners after release, RISK-05) differ from a request's, and a second holder on this entity would put two audiences in one table;
  - evidence follows the risk record's retention.
- **Phase 21:** attachment events are in the log; no metric is planned.
- **Phase 22:** the AI data policy's ceiling becomes the Admin's (Phase 12 D-27), and AI inclusion reads it; decision 2's Admin retention setting needs a home (D-22, flagged); the allow-list and limits stay fixed by decision 2.
</seams>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/uat/product-gaps/FINDINGS.md`: UAT-012 in full (route, steps, expected, actual, evidence, recommendation, impact, related).
- `.planning/uat/product-gaps/REPORT.md`: §8 (the Phase 14 proposal) and §9 (decision 2's row).
- `.planning/uat/product-gaps/JOURNEYS.md`: area 2's "F1 create", "A1 requestor adds information" and "A1 analyst adds information" rows.
- `.planning/uat/product-gaps/BRIEF.md` Appendix A: F1 ("a ticket with important context as well as pdfs, docs, spreadsheets") and "At any point in time" (A1).

### Planning authority
- `.planning/ROADMAP.md`: the Phase 14 entry (goal, decisions, contract line, success criteria 1 to 5), and the entries for Phases 13, 17, 17.1, 19, 20 and 22 for the seams.
- `.planning/REQUIREMENTS.md`: COLLAB-02 with its acceptance criteria; COLLAB-01, INT-05, ASSESS-22 (criterion 3) and RISK-06 (criterion 3) for the seams.
- `.planning/NEXT-WAVE-DECISIONS.md`: decision 2 and its note; #5, #6, #9, #12, #18; G-1, G-3, G-4, G-6, G-7, G-12, G-13, G-15 and G-16.
- `.planning/POST-DEMO-BRIEF.md` §1 and §2 (overrides and dev-mode rules); `.planning/STATE.md` Decisions; `.planning/PROJECT.md`.

### Earlier phases this phase builds on
- `.planning/phases/13-request-pick-up-and-notes/13-CONTEXT.md`: D-02 (no core router), D-04 (people projections), D-07 (G-1's reading), D-09 (per-request serialisation), D-21 to D-25 (the note, its window, its readers, its unread fact and its presentation), D-26 to D-29 (the AI-input mark, the context, the run summary and the signal), D-30 (Functions), D-31 (the second analyst), and its seams naming Phase 14.
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-CONTEXT.md`: D-04 to D-08 (the builder, slots, bounds and extension points), D-19 to D-21 and D-25 (the run record and run read), D-26 to D-29 (the data policy), D-32 (human-initiated generation).
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-RESEARCH.md`: "Envelopes (versioned, closed)", "The assessment context" (delimiting and bounds: about 200,000 characters for the draft and 100,000 for the questionnaire).
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-UI-SPEC.md`: §2 (the "What the AI used" sheet), X-13 (side sheet) and X-14 (Undo toast).
- `.planning/phases/19-csv-export-and-import-hardening/19-CONTEXT.md`: D-10 (file headers), D-12 (dependency criteria and the XLSX reader), D-18 (the security event log), D-19 (delivery to the browser), D-04 (attachments not exported); `19-DISCUSSION-LOG.md` §15.
- `.planning/phases/10-existing-flow-gap-closure/10-CONTEXT.md`: D-12 (the navigation guard), D-19 (local time), D-22 (closed reasons); `10-08-PLAN.md` (the guard) and `10-13-PLAN.md` (the generation-jobs read).
- `.planning/phases/11-navigation-landing-and-list-clarity/11-CONTEXT.md`: D-11 (bounded reads, no polling), and D-46 with its code context (the one status mapping, `status-badge.tsx` `statusPresentation`, which the attachment states join).
- `.planning/phases/08-production-integration-and-hardening/08-CONTEXT.md` and `docs/security/phase-08-residual-risks.md`: R-08-02 (the token reaches the upload handlers), R-08-04 (proxy topology), R-08-13 (log retention), R-08-34 (route budgets), R-08-36 (single process), R-08-39 (the `sharp` override).

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md`: §6 (requests carry data flows and context), §19 (untrusted content), §20 (collaboration; record gaps rather than competing models), §22 (IDOR, output escaping, an audit trail), §32 (file and attachment storage as a decision to confirm).
- `docs/references/idambox-datamodel.jdl`: `CsrmAssessmentRequest` and `CsrmRequestStatus`, `IdamBoxUser`, and `CsrmQuestionAnswerType.FILE_UPLOAD` (why no entity fits).
- `CONTEXT.md` (repository root): the glossary ("Released", "Closed", "Contest point"); a plan adds "Attachment".

### Contract, authorisation and records
- `docs/contract-gaps/phase-03-questionnaire-json-contract.md` ("File upload limitation"); `docs/contract-gaps/phase-06.1-revert-audit-facts.md` and `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md` (the record format and the fact-plus-log posture); `docs/contract-gaps/phase-04-composite-release-fact.md` (the released and closed states); Phase 12's and Phase 13's records once written.
- `docs/references/specification.json`: the administration import operations (the multipart precedent), `ApiCsrmAssessmentRequestCsrmAssessmentRequestDocument`, `QuestionnaireSummary` and `AnalystAssessmentDetail` (the summaries), and the conflict response schemas.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`: design note 6, the request Functions, and Phase 13's `notes_api` pattern.
- `docs/references/served-operations.json`.
- `docs/security/strapi-http-hardening.md`: "Body limits", "Unmounted paths (recorded)" and "Plugin routes the API token reaches (recorded)".
- `apps/backend/src/policies/csrm-authorization.ts`, `apps/backend/tests/fixtures/authorization-matrix.ts` (the upload plugin rows, lines 586-623), `apps/backend/tests/contract-catalogue.integration.test.ts`, `apps/csrm/src/features/contract-response-parity.test.ts` and `apps/csrm/src/features/contract-operation-chain.test.ts`.

### Design and framework
- `docs/design/csrm-design-direction.md` and `docs/adr/0001-adopt-bproton-design-system.md`: §4 Forms, Status and risk badges (the tone vocabulary and the one mapping), Toasts, Skeletons, Empty states, DataTable (density), Iconography; §5 Motion; §6 Do-not list.
- `apps/csrm/node_modules/next/dist/docs/01-app/02-guides/server-actions.md` (sequential dispatch, the body size limit, security) and `01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` (`bodySizeLimit`).

### External
- OWASP File Upload Cheat Sheet (allow-lists, content checks, renaming, storage outside the web root, malware scanning) and OWASP ASVS 5.0 "File Upload and Content" (already in the seeded control library, `apps/backend/src/bootstrap/controls/owasp-asvs-5.0.0.json`).
- The ASD ISM control on restricting upload types with malicious-content scanning before access (`apps/backend/src/bootstrap/controls/asd-ism-controls-2026.06.18.json`).
- ClamAV `clamd` documentation: the INSTREAM command, `StreamMaxLength`, `MaxFileSize`, `MaxScanSize` and `AlertExceedsMax`.
- ISO/IEC 27001:2022 Annex A 8.15 (logging) and 8.16 (monitoring); RFC 6266 and RFC 5987 (`Content-Disposition` file names).
- CVE-2024-4367 (pdf.js script evaluation), for the extraction library's configuration.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/api/csrm-administration/services/administration-workflow.ts` (`uploadFrom`, `readCsvUpload`): the multipart pattern on Strapi's side, reading formidable's `filepath`, `originalFilename`, `mimetype` and `size`; `apps/backend/src/api/csrm-administration/controllers/csrm-administration.ts` passes `ctx.request.files`.
- `apps/csrm/src/features/administration/administration-actions.ts` and `administration-service.ts` (`multipartBodySerializer`): the web's FormData-to-Server-Action-to-openapi-fetch multipart pattern for uploads.
- `@strapi/upload` 5.51.0: `dist/server/utils/mime-validation.js` (`file-type` sniffing), `dist/server/register.js` (provider resolution by module path), `dist/server/services/file.js` (`isPrivate` and `getSignedUrl`); `@strapi/provider-upload-local` (why it is not private: `public/uploads`).
- `apps/backend/config/plugins.ts` (the upload plugin's `security.allowedTypes` and `deniedTypes`), `apps/backend/config/middlewares.ts` (`strapi::body`: formidable 50 MiB per file, 250 MiB total; `strapi::public`).
- `apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts`: `serializeRequestRevert` and `lockRequest`, the per-request serialisation the upload's final section reuses (Phase 13 D-09).
- `apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts`: `REVIEWABLE_REQUEST_STATUSES` and `RELEASED_REQUEST_STATUSES`, beneath `acceptsNotes` and `acceptsAttachments`.
- `apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts`: `findOne`'s server-side augmentation, the place for the attachment summary.
- `apps/backend/src/policies/csrm-authorization.ts`: `HUMAN_ANALYST_ONLY_OPERATIONS` (lines 41-49), `hasHumanAnalystOperation`, `loadEffectiveGrants`.
- `apps/backend/src/csrm/prompt-data.ts`: `promptDataTag`, the escaping for each attachment block.
- `apps/backend/src/utils/development-identity-enabled.ts`: the `NODE_ENV` plus `CSRM_ENVIRONMENT` double key the scanner double reuses.
- `apps/backend/tests/helpers/fake-openai-compatible-server.ts`: the model for the fake `clamd` server, and the recorder that proves what reached the provider.
- `apps/backend/tests/helpers/strapi-http-harness.ts` (environment pins around lines 428-454) and `apps/csrm/playwright.config.ts` (the Strapi `webServer.env` and the mobile project's `testMatch`).
- Planned by earlier phases: Phase 10's `conflict-reasons.ts` (both sides), `refusal-copy.ts`, the navigation guard and `LocalInstant`; Phase 12's context builder under `apps/backend/src/csrm/ai/`, its data-policy module and the "What the AI used" sheet; Phase 13's notes service, `acceptsNotes`, `canUseRequestNotes`, the composer and the signal.
- Web: `apps/csrm/src/features/requests/request-form.tsx` and `request-actions.ts` (`createRequestAction` redirects today), the two request pages, `apps/csrm/src/components/csrm/status-badge.tsx`, `next.config.ts` (`bodySizeLimit: '6mb'`) and `proxy.ts`.

### Established Patterns
- **API-only Functions,** with `HUMAN_ANALYST_ONLY_OPERATIONS` as a second refusal for human-only operations (06.8, Phase 7 D-07, Phase 12 D-32, Phase 13 D-30).
- **Current fact plus append-only log** (06.8): gates read a dedicated fact, never the log; logs are versioned and parsed closed, failing safe.
- **A policy denial is 403; an unreadable record is 404 by design;** denials keep persistence deep-equal, and responses never echo fixture titles (the matrix conventions).
- **Closed 409 reason codes** in `error.details.reason`, with actor-neutral copy (Phase 10 D-22).
- **Typed openapi-fetch services and Server Actions,** with no raw `fetch` and no Route Handler standing in for an API (01 D-15, Phase 11 D-49, Phase 19 D-19); zod-free `*-domain.ts` modules for client components.
- **Provider substitution with deterministic doubles** in every suite, and fake servers for external protocols (06.7, Phase 12).
- **The server words, links and counts;** the web formats what it is given (Phase 7 D-02).

### Integration Points
- **Strapi:** a new API folder (or routes under the request API) for the attachment operations; the request controller; the Phase 12 builder and run read; the Phase 13 notes service; `csrm-authorization.ts`; `config/plugins.ts` (the providers); an `src/extensions/upload` entry or equivalent that unmounts the plugin's content-API routes; the bootstrap (the quarantine re-scan); `apps/backend/.env.example`; both catalogue copies.
- **Web:** the new-request form and the draft's edit form; the Requestor request page and the analyst request page; Phase 13's thread and composer; the analyst questionnaire and assessment pages' summaries; the "What the AI used" sheet; `status-badge.tsx`; `next.config.ts` and `proxy.ts`.
- **Tests:** `apps/backend/tests/*.integration.test.ts`, the authorization matrix, `served-operations.integration.test.ts`, Vitest beside each module, and a new Playwright journey under `apps/csrm/e2e/`.
</code_context>

<specifics>
## Specific Ideas

- **UAT-012's scenario is the yardstick.** Jane creates UAT-A, the payroll SaaS request, and attaches the vendor's security pack (a PDF), a data-flow document (a DOCX) and the vendor's security questionnaire answers (an XLSX), then submits. After the questionnaire exists she posts a note, "The vendor sent their architecture deck after today's call", with a PPTX. Bob sees the note flagged and all four files, with who added each and when. He includes the security pack's text, which mentions the offshore support team with administrator access (UAT-013's fact): the control reads "Included · first 20,000 of 85,412 characters". The hub says one file changed the AI inputs since the questionnaire was generated, and after the next generation "What the AI used" lists the security pack. The data-flow document, never included, appears nowhere in the run or the prompt. Maya, the Secondary Requestor, finds nothing of it, and every attachment route answers her 404.
- **Refusals by example:** `invoice.pdf` that is really a PNG ("This file's content doesn't match its name"); a `.docm`; a 30 MB PDF ("Files can be up to 25 MB"); the CSRM test signature ("This file contains malware and wasn't added").
- **Fixtures:** small committed files with known text, a few KB each, with a README line saying how each was made. No fixture contains the EICAR string.
- **The development database** gains the new table and, on the first upload, the private storage directory under `apps/backend/.tmp/`. Nothing is seeded. The schema change and grants reach it only when the orchestrator restarts Strapi; tests use their own databases and directories.
</specifics>

<deferred>
## Deferred Ideas

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
</deferred>

---

*Phase: 14-request-attachments*
*Context gathered: 2026-10-01*
