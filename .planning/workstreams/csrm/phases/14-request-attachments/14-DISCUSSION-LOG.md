# Phase 14: Request attachments - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 14-request-attachments
**Mode:** `--auto`, one pass.
- Every area was selected automatically. Each question took the recommended option, judged as a mature second-line cyber-governance function would (Three Lines; ISO/IEC 27005) at the G-4 bar, with no user prompt.
- The orchestrator seeded COLLAB-02 and UAT-012, decision 2's storage, allow-list, limits, quarantine, removal, retention and AI opt-in, the contract-gap record and its checkpoint, the readers, the risk owners' reach, the pluggable scanner, extraction for the AI context, and the seams with Phases 19 and 20. The code read during the scout confirmed or corrected each seed before it was recorded. The corrections: Strapi's built-in local provider serves its files publicly from `public/uploads`; the upload plugin already sniffs content with `file-type`, but against a Media Library list far wider than decision 2's; the plugin's own content-API routes are mounted and reachable by the full-access token; a 25 MB file exceeds the web's 6 MB Server Action limit; and an EICAR file on disk would trip the Windows build host's antivirus.
- No todo matched the phase (`todo.match-phase 14`: 0). No `.continue-here.md`, SPEC.md or checkpoint existed, no discuss hooks were active, and no codebase maps exist, so the scout read the code directly.
- The discussion completed in one pass, so no `14-DISCUSS-CHECKPOINT.json` remains. Per the Stage 2 rules, nothing was committed and STATE.md was not updated.

**Areas discussed:**
1. Where attachments live (JDL first)
2. Private storage and URLs
3. The stored bytes and derived images
4. The upload plugin's own routes
5. Allowed types, checked by content
6. Limits and file names
7. When the scan runs, and quarantine
8. The scanner adapters
9. Test signatures on the build host
10. Configuration and environments
11. When files can be added
12. Notes and files
13. Who reads attachments
14. Who adds, removes and restores
15. Removal and blocked files
16. Retention
17. Downloads
18. How files reach the browser
19. How uploads travel
20. The upload experience
21. Where files show
22. Who decides what the AI reads
23. When text is extracted
24. Extraction safety and dependencies
25. Caps and the context budget
26. What the prompt carries
27. The run record and the "inputs changed" signal
28. Security events
29. Grants and the catalogue
30. Verification and plan shape

---

## 1. Where attachments live (COLLAB-02; decision 2; catalogue design note 6)

| Option | Description | Selected |
|--------|-------------|----------|
| A new `CsrmRequestAttachment` content type with one single media attribute holding the upload plugin's file record, plus the CSRM facts (uploader and part, digest, scan state, removal, AI inclusion, an append-only event log) | The upload plugin keeps the bytes and its file record, as decision 2 requires; the facts governance needs have a home; one record per file; competes with no JDL entity | ✓ |
| A multiple media field on `CsrmAssessmentRequest` | The smallest change, but the link holds no IdamBox uploader, part, scan state, quarantine, removal, AI inclusion or history, so criteria 4 and 5 and the quarantine have nowhere to live | |
| Extend the upload plugin's file type with CSRM fields | Bends the admin Media Library's schema, and every plugin upgrade, around one feature | |
| A CSRM file store that bypasses the upload plugin | Contradicts decision 2 and G-7, which name the upload plugin and its official S3 provider | |
| One generic attachment entity serving requests now and Phase 20's treatment evidence later | One table for two audiences: a query that forgets the holder filter leaks treatment evidence to a Requestor, or the reverse | |

**Choice:** `[auto] Entity: Q: "Where does an attachment live?"` → the new request-scoped entity with a single media attribute (recommended default).
**Notes:**
- The JDL has no attachment entity; UAT-012's evidence and catalogue design note 6 say so. G-15 already names "Phase 14's attachment" as a recorded concept like Phase 13's note.
- The record is `docs/contract-gaps/phase-14-request-attachments.md`, with an approval checkpoint (G-6).
- Phase 20 reuses the pipeline (storage, checks, scanning, downloads, the event log), and its own record decides its evidence entity; the recommendation is its own entity with the same file facts.

---

## 2. Private storage and URLs (decision 2, G-7)

| Option | Description | Selected |
|--------|-------------|----------|
| A private local provider writing outside `public/` in development and tests; the official `@strapi/provider-upload-aws-s3` configured private (no public ACL, SSE-KMS, Sydney) in production; one storage port in Strapi; no URL ever leaves Strapi; generated object keys | Decision 2 and G-7 as written; a test proves nothing is reachable under `/uploads/` | ✓ |
| Strapi's built-in local provider | Writes to `public/uploads`, which `strapi::public` serves to anyone: the opposite of private | |
| Presigned URLs handed to the browser for downloads | Bearer URLs that leak through history and logs, and the response headers are no longer CSRM's; decision 2 requires an authorised Strapi operation | |
| Local storage in production too | Decision 2 names private object storage encrypted at rest for production | |

**Choice:** `[auto] Storage: Q: "Where are the bytes kept, and how are they reached?"` → private providers behind a storage port, with no URL leaving Strapi (recommended default).
**Notes:**
- The scout confirmed that `@strapi/provider-upload-local` 5.51.0 writes to `public/uploads`, and that the upload plugin loads a provider by module path when no `@strapi/provider-upload-*` package matches, so a provider module inside `apps/backend` can be wired in.
- The bucket's public access block, versioning and lifecycle rules are deployment configuration (G-7). A check against a real bucket is manual and the operator's; the suites prove the read path against a fake object store.
- The plugin has one provider, so the admin Media Library becomes private too; nothing in CSRM relies on public media.

---

## 3. The stored bytes and derived images

| Option | Description | Selected |
|--------|-------------|----------|
| Byte-for-byte storage: no thumbnails, responsive sizes, optimisation or re-orientation for attachments; the stored bytes match the scanned digest | The digest stays meaningful for integrity checks; `sharp` (R-08-39) stays out of the attachment path | ✓ |
| The plugin's default image processing for PNG and JPEG | Derived files nobody views (there are no previews), stored bytes that differ from the scanned ones, and R-08-39's trigger fired | |

**Choice:** `[auto] Stored bytes: Q: "Does CSRM transform uploaded images?"` → no, byte for byte (recommended default).
**Notes:** Research decides whether that is done through the plugin's settings or by calling the provider and the plugin's file record directly.

---

## 4. The upload plugin's own routes (R-08-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Unmount the plugin's content-API routes (`POST /api/upload` and the `/api/upload/files` reads and delete); the matrix rows become unmounted-path assertions; the admin panel's routes stay | Once private files live in the plugin, these routes would let the full-access token holder list their metadata, add unscanned files, or hard-delete them; unmounting narrows R-08-02 | ✓ |
| Keep them, relying on the token never leaving the web server | Today's residual posture, but the routes would then reach real private documents | |
| Guard them with CSRM's policy | Plugin routes take no CSRM policy without patching the plugin, and nothing in CSRM needs them | |

**Choice:** `[auto] Plugin routes: Q: "What happens to the upload plugin's own API?"` → unmount it (recommended default).
**Notes:** Strapi administrators can still see the files in the admin Media Library: privileged operator access outside CSRM's role model, as for the Content Manager. It is recorded as a residual, with the recommendation that Media Library rights stay with super admins.

---

## 5. Allowed types, checked by content (decision 2; COLLAB-02 criterion 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Extension and content must name the same allowed type: PDF by header and an opening check; DOCX, XLSX and PPTX by their `[Content_Types].xml` main part; PNG and JPEG by signature; CSV and TXT as text. Refuse macro-enabled, encrypted, password-protected and old binary Office files. `file-type` as a direct dependency (already in the tree through `@strapi/upload`) plus CSRM's own Office Open XML and text checks | Decision 2's "content signature and extension" checked properly, including the ZIP ambiguity of Office files; files that cannot be scanned are refused (ASD ISM: scan before access) | ✓ |
| Trust the browser's declared MIME type | Spoofable by any client | |
| Extension only | A renamed executable passes | |
| The upload plugin's own check alone | Its allow-list admits images, video, audio and every Office Open XML type for the Media Library, and its ZIP exception trusts the extension for Office files | |

**Choice:** `[auto] Types: Q: "How is a file's type checked?"` → content and extension together, with CSRM's own Office checks (recommended default).
**Notes:** The plugin's `security.allowedTypes` stays as the Media Library's second layer. Research confirms `file-type`, or proposes a dependency-free sniff.

---

## 6. Limits and file names (decision 2)

| Option | Description | Selected |
|--------|-------------|----------|
| 25 MiB per file (shown as 25 MB), empty files refused; 20 active files per request (removed and blocked ones excluded); a lifetime bound on stored files including removed ones; names sanitised (path, control and bidirectional-override characters) and never used as keys; the count checked in a section serialised per request | Decision 2's limits, with soft removal kept from growing storage without bound and the RLO spoofing trick removed | ✓ |
| Count removed files toward the 20 | A request that tidied up its files could never take more | |
| No lifetime bound | Upload, remove and repeat would grow storage indefinitely, because removal is soft | |

**Choice:** `[auto] Limits: Q: "What do the limits count, and how are names handled?"` → the recommended option.
**Notes:** One attachment policy module holds the allow-list and the limits; decision 2 fixes them, so no setting exposes them.

---

## 7. When the scan runs, and quarantine (decision 2, G-7; COLLAB-02 criterion 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Scan inside the upload request: a clean file is stored and available at once; an infected one is refused with nothing stored; if the scanner is unavailable, the file is stored quarantined and re-scanned with backoff and at every start, then released or blocked | A clear refusal in the same round trip for success criterion 3; G-7's "fails closed: an unavailable scanner keeps files quarantined" | ✓ |
| Always asynchronous: store everything quarantined, scan in the background | Every upload waits for a later read, with no polling (Phase 11 D-11), so the refusal criterion needs another round trip | |
| Synchronous only, refusing every upload while the scanner is down | Contradicts G-7's quarantine, and loses the person's upload during an outage | |

**Choice:** `[auto] Scan timing: Q: "When does the malware scan run?"` → synchronously, with quarantine as the fallback (recommended default).
**Notes:** A blocked file (found by a re-scan) loses its bytes and keeps its record, digest and verdict.

---

## 8. The scanner adapters (G-7)

| Option | Description | Selected |
|--------|-------------|----------|
| A scanner port with a deterministic development double (development and tests only; it fails boot anywhere else) and a ClamAV adapter speaking `clamd` INSTREAM over Node's own `net`, tested against a fake `clamd` server; deployment requirements recorded: limits above 25 MiB and `AlertExceedsMax` on | No dependency, no external service in development, nothing installed on the build host; a skipped file is never reported clean | ✓ |
| A `clamd` client package from npm | A dependency for a small protocol | |
| A cloud scanning service | Sends the Requestor's documents to another external service | |

**Choice:** `[auto] Adapters: Q: "Which scanners does CSRM build?"` → the double and the INSTREAM adapter (recommended default).
**Notes:** `clamd`'s stream and file-size limits must sit above CSRM's 25 MiB in the deployed version; research checks that version's defaults, and the adapter treats a limits reply as "not clean".

---

## 9. Test signatures on the build host

| Option | Description | Selected |
|--------|-------------|----------|
| The double flags EICAR and a harmless CSRM test signature; the suites use the CSRM signature, build EICAR only in memory, and prove the quarantine and blocked paths through the fake `clamd` | The Windows build host's real-time antivirus would quarantine formidable's temporary file mid-test if a suite wrote EICAR to disk; no test-only mode enters production code | ✓ |
| EICAR files in the suites | Flaky on this host, and alarming on any developer machine | |
| No infected-file test | Success criterion 3 left unproven | |

**Choice:** `[auto] Test signatures: Q: "How do the suites prove a malware refusal?"` → the CSRM signature, plus a fake `clamd` (recommended default).

---

## 10. Configuration and environments (G-7; the Stage 2 rules)

| Option | Description | Selected |
|--------|-------------|----------|
| One module reads the storage and scanner settings. Development defaults to local storage and the double; elsewhere an unset setting makes attachments unavailable with a plain reason; an invalid value, an incomplete block, or the double outside development fails boot. Safe defaults in `.env.example`, and both harnesses pin their own directory and scanner | Phase 12 D-27's pattern: fail closed without taking the product down, and fail loudly on a misconfiguration | ✓ |
| Fail boot whenever a setting is unset in production | Takes the whole application down for one feature (Phase 12 rejected the same for the AI ceiling) | |
| Fall back to local storage and the double in production | Production would run with no malware scanning | |

**Choice:** `[auto] Configuration: Q: "What happens when storage or scanning is not configured?"` → unavailable with a reason, and invalid values fail boot (recommended default).

---

## 11. When files can be added (COLLAB-02 criterion 1; Phase 13 D-22)

| Option | Description | Selected |
|--------|-------------|----------|
| At intake, the requestor adds files to the draft directly (the new-request form and the draft); after submission, both actors add files with a note until release or closure; released and closed requests are read-only; one predicate built on `acceptsNotes` | Criterion 1's "when creating a request and adds another later"; the released record stays immutable (decision 9); analysts do not work on drafts (Phase 13 D-08) | ✓ |
| Any time, released and closed requests included | Changes a released record; later information belongs to Phase 20's treatment evidence | |
| Only after submission | Fails criterion 1's intake | |

**Choice:** `[auto] Window: Q: "When can files be added?"` → intake, then with notes until release or closure (recommended default).

---

## 12. Notes and files ("notes give files their context")

| Option | Description | Selected |
|--------|-------------|----------|
| After submission every file is posted with its author's note: the note is created first through Phase 13's unchanged operation, then each file uploads with the note's id, accepted only for the caller's own note on the same request within a short window | The other party is told through the note's existing unread flag, every later file carries its reason, and Phase 13's read model and operations stay as they are | ✓ |
| Files independent of notes after submission | A file added mid-assessment would reach nobody's attention and carry no reason | |
| A second read state, for files | Duplicates Phase 13's unread fact and its filters for a narrow gain | |
| Upload files first as staged, and let the note's create link them | Atomic, but needs a staged state hidden from the other party, a clean-up job for abandoned files, and a change to Phase 13's note operation | |

**Choice:** `[auto] Notes and files: Q: "How do files added after submission get their context?"` → posted with a note, the note first (recommended default).
**Notes:** The window (proposed 60 minutes) lets the composer finish and retry its uploads, but nobody can slip a file into an old, already-read note. Phase 17's "new notes" notification then covers files too.

---

## 13. Who reads attachments (COLLAB-02 criterion 3; G-12; ASSESS-22 criterion 3)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 13's notes readers, through one predicate for notes and attachments: the request's requestor and any human Security Analyst; everyone else, a participant included, gets the refusal a missing record gets at every route | G-12 and ASSESS-22 criterion 3 kept (participants read the request summary but not its attachments); the two can never drift | ✓ |
| The request read's predicate | Phase 17 widens that read to participants for the summary, which would hand them the files | |
| Also nominated risk owners | Reverses G-12's explicit choice; risk owners raise contest points instead (Phase 17.2) | |

**Choice:** `[auto] Readers: Q: "Who may list and download a request's files?"` → the notes readers, one predicate (recommended default).
**Notes:** Phase 17's slice of the post-demo journey can assert the risk owner's 404 at the attachment list as a negative case.

---

## 14. Who adds, removes and restores (G-1)

| Option | Description | Selected |
|--------|-------------|----------|
| The requestor adds at intake and after; a human analyst after submission; the uploader removes their own files and any human analyst removes any file; only the remover restores; a requesting analyst acts as the Requestor; the service agent holds no grant | The second line can take out an overly sensitive file (data minimisation); the first line controls only its own files; G-1 as Phase 13 D-07 reads it | ✓ |
| Only the uploader removes | An analyst could not remove a file that should never have been shared | |
| Anyone who can read restores | An analyst could undo a Requestor's privacy-driven removal | |

**Choice:** `[auto] Actors: Q: "Who may add, remove and restore files?"` → the recommended option.

---

## 15. Removal and blocked files (decision 2; COLLAB-02 criterion 4)

| Option | Description | Selected |
|--------|-------------|----------|
| Soft removal records who and when, ends any AI inclusion, keeps the bytes and the record, lists removed files in a collapsed section for every reader, and offers an Undo toast | Decision 2's soft, recorded removal; G-4's Undo for reversible actions; an AI run that used a file still resolves it | ✓ |
| Hard delete | Decision 2 requires soft removal; the record would lose evidence | |
| A confirmation dialog with a required reason | G-4 keeps confirmations for governance-significant irreversible steps, and removal is reversible | |

**Choice:** `[auto] Removal: Q: "What does removing a file do?"` → soft removal with Undo (recommended default).
**Notes:** A blocked file's bytes and plugin record are deleted, while the attachment record keeps the facts and the verdict.

---

## 16. Retention (decision 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Files follow the assessment record's retention (7 years after closure by default); soft removal never shortens it; no disposal job yet; the period sits in one configuration point; production's bucket lifecycle enforces it | Nothing can reach the period for years, and the assessment record has no disposal either | ✓ |
| Build the disposal job now | Code with nothing to act on until the 2030s, and no disposal for the record it follows | |
| No retention notion | Leaves decision 2 unaddressed | |

**Choice:** `[auto] Retention: Q: "How is retention handled?"` → recorded and configured, with no disposal job yet (recommended default).
**Notes:** Decision 2 makes the period Admin-settable, but no phase names that setting (Phase 22 lists the AI data policy, not retention). Flagged for the orchestrator.

---

## 17. Downloads (decision 2)

| Option | Description | Selected |
|--------|-------------|----------|
| One authorised operation per file: only a clean, unremoved file of a readable request; Strapi checks the bytes against the recorded SHA-256 before sending; attachment disposition with ASCII and RFC 5987 names, the recorded type, `nosniff`, `no-store` and a sandboxing CSP; every download logged | Decision 2's authorised operation, plus tamper evidence and a disclosure record (decision 12's pattern) | ✓ |
| Stream without the digest check | A storage-level overwrite would reach the reader unnoticed | |
| Leave downloads unlogged | Documents leaving the system would have no record, unlike exports | |

**Choice:** `[auto] Downloads: Q: "What does a download check and record?"` → the recommended option.
**Notes:** A reader who asks for a quarantined, blocked or removed file gets a 409 with its reason, because they can see the entry; everyone else gets 404.

---

## 18. How files reach the browser (Phase 19 D-19)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 19's pattern, built here first because Phase 14 executes first: a typed binary service, a Server Action returning the bytes or a refusal, a shared validator (type, name, size, signature), a Blob save helper, and the parity guard's file-response mode. Research verifies it at 25 MiB; if it fails there, the plan stops for the orchestrator | One way of sending files for both phases; no frontend API facade (AGENTS.md) | ✓ |
| A streaming Route Handler | Better for large files, but contradicts the project's no-Route-Handler stance, and a refusal becomes a broken download | |
| Base64 in a JSON result | A third larger, and needless with React 19 Flight's typed arrays | |

**Choice:** `[auto] Transfer: Q: "How does an attachment reach the browser?"` → Phase 19's Server Action pattern, built here (recommended default).
**Notes:** This settles the alignment `19-DISCUSSION-LOG.md` §15 left to the orchestrator.

---

## 19. How uploads travel

| Option | Description | Selected |
|--------|-------------|----------|
| One Server Action per file, through the typed API layer (the administration import's pattern); the Server Action limit rises to fit one 25 MiB file, with a path-scoped check in `proxy.ts` keeping 6 MB everywhere else | Keeps Strapi server-side behind the web; bounded memory per call; the residual is recorded for the deployment's proxy (R-08-04) | ✓ |
| Raise the global limit and leave it there | Every action in the product would accept 26 MB bodies | |
| Presigned uploads straight from the browser to Strapi or S3 | Makes Strapi or the bucket browser-facing and needs credentials in the browser | |
| One batch action for every file | One failure fails them all, and the body could reach 500 MB | |

**Choice:** `[auto] Upload transport: Q: "How does a file travel from the browser to Strapi?"` → one Server Action per file, with the limit scoped (recommended default).

---

## 20. The upload experience (G-4)

| Option | Description | Selected |
|--------|-------------|----------|
| Files upload one at a time; each shows its stage (waiting, adding, added, waiting for the malware check, or refused with its reason) with an overall count; a refusal keeps the file listed with its next step; Retry needs no new choice; the navigation guard protects queued files and unsent text; on the new-request form, the first save creates the draft and then uploads the files | Per-file progress and errors, and no lost input, within what Server Actions report | ✓ |
| Byte-level percentages | Server Actions report no upload progress, and getting it needs a transport outside them | |
| Upload only after the request is saved, on a separate page | Fails "when creating a request" and splits one task in two | |

**Choice:** `[auto] Experience: Q: "How does a person see uploads progress and recover from failures?"` → per-file stages, one at a time (recommended default).

---

## 21. Where files show

| Option | Description | Selected |
|--------|-------------|----------|
| The new-request form and the draft; a Files panel on both request pages; each note's files in the thread; server-rendered counts on the analyst questionnaire and assessment pages; an Attachments group in "What the AI used" | Files appear where people decide; the assessment editor's route budget is untouched (R-08-34) | ✓ |
| A separate Files page | One more place to look, away from the notes that explain the files | |
| Files inside the assessment editor | Pushes the editor past its route budget, and files belong to the request | |

**Choice:** `[auto] Surfaces: Q: "Where do files appear?"` → the recommended option.
**Notes:** No inline preview: files only download (decision 2). The Requestor's panel says that a Security Analyst may include a file's text in the AI assistance, and shows no per-file AI state (Phase 13 D-25's transparency). The UI-SPEC proposes the new patterns as X-n extensions.

---

## 22. Who decides what the AI reads (decision 2, G-3; COLLAB-02 criterion 5)

| Option | Description | Selected |
|--------|-------------|----------|
| A human Security Analyst opts each file in, off by default, never on a request they raised; only clean, text-bearing files; refused while the request's AI policy refuses; recorded; Undo | Decision 2 and G-3 as written; the second line owns what the method uses; Phase 13 D-26's pattern for notes | ✓ |
| The Requestor opts in | The first line would steer the second line's method | |
| Every file by default | Decision 2 sets the default to off | |

**Choice:** `[auto] Opt-in: Q: "Who decides which files the AI reads?"` → the analyst, per file, off by default (recommended default).
**Notes:** PNG and JPEG have no text the AI can read (no OCR), so they cannot be included. The control says that the request's data classification governs.

---

## 23. When text is extracted

| Option | Description | Selected |
|--------|-------------|----------|
| On opt-in, after the scan has passed; the capped text is stored with the attachment while it stays included and deleted on opt-out or removal; a file with no text is refused at opt-in; the analyst can read the stored text | The minimal choice (G-3): no derived copy of files nobody includes, the parsers kept away from most files, and the analyst knows before generating | ✓ |
| At upload, for every file | A derived copy of every document, and parsers run on every upload | |
| At every generation, with nothing stored | No preview, and a failure discovered only when the job runs | |

**Choice:** `[auto] Extraction timing: Q: "When is a file's text extracted?"` → on opt-in, kept while included (recommended default).

---

## 24. Extraction safety and dependencies

| Option | Description | Selected |
|--------|-------------|----------|
| A worker thread with memory and time limits; ZIP-bomb and XML-entity guards; PDF parsing with script evaluation off; dependencies chosen against Phase 19 D-12's pass-or-fail criteria and justified per plan; the lean is one ZIP reader for the three Office formats (with Phase 19's XLSX reader for sheet values if it fits) plus one pdf.js-based PDF library | Hostile documents cannot stall or crash Strapi's request thread; the codebase holds one XLSX reader | ✓ |
| Extract on Strapi's request thread | A crafted PDF could stall or exhaust the API process | |
| An external extraction service | A new service to run, and documents leaving the process | |

**Choice:** `[auto] Extraction safety: Q: "How is extraction contained, and with what?"` → a bounded worker and criteria-checked dependencies (recommended default).
**Notes:** The pdf.js lesson (CVE-2024-4367) is why script evaluation is off. A single maintained office-text library is acceptable if it passes the same criteria.

---

## 25. Caps and the context budget (decision 2; 06.7 D-10)

| Option | Description | Selected |
|--------|-------------|----------|
| A per-file cap (proposed 20,000 characters) with the truncation always disclosed; a per-run bound for attachment text (about 30% of Phase 12's budgets); over it, `CONTEXT_TOO_LARGE` naming the included files | Decision 2's cap, without silent truncation, and attachments cannot crowd out the request and its answers | ✓ |
| Send each file whole | Decision 2 requires the cap, and a vendor pack would exhaust the budget | |
| Truncate silently | Breaks 06.7 D-10's rule | |

**Choice:** `[auto] Caps: Q: "How much of a file reaches the AI?"` → capped and disclosed, within a per-run bound (recommended default).

---

## 26. What the prompt carries (decision 5, G-3)

| Option | Description | Selected |
|--------|-------------|----------|
| Each included file's text in its own delimited, escaped block inside the untrusted data block, labelled by code constants (sequence, type, part, truncation); never the file name, a person's name, times, ids or the request number; nothing about excluded files, not even their existence | Success criterion 5; file names are an injection channel and often personal data | ✓ |
| Include the file names | Helps the model a little, at the cost of another injection channel and personal data | |
| One block for all the files | Harder to attribute text to its source, and one hostile file could blur the others | |

**Choice:** `[auto] Prompt: Q: "How does attachment text enter the prompt?"` → one delimited block per file, labelled by constants (recommended default).
**Notes:** Every operation built on the context builder includes the files: Phase 12's two now, then Phases 15, 16 and 17. The guardrail tests extend to hostile attachment text.

---

## 27. The run record and the "inputs changed" signal (INT-05, INT-06; Phase 13 D-28 and D-29)

| Option | Description | Selected |
|--------|-------------|----------|
| The context summary gains an attachments section (ids, digests, types, characters sent and available, truncation; never text or names), a new envelope version; "What the AI used" gains an Attachments group resolving names at read time; Phase 13's signal gains files on the same rule | The run record shows what was used (criterion 5) and holds no Requestor text (G-3); Phases 15 and 16 read one signal | ✓ |
| Store the extracted text in the run | G-3: the run keeps a summary, not the text | |
| A separate signal for files | Two signals for one question: did the AI inputs change? | |

**Choice:** `[auto] Run record: Q: "How does the run show the files it used?"` → the summary section and the sheet group (recommended default).

---

## 28. Security events (decision 12's pattern; Phase 19 D-18)

| Option | Description | Selected |
|--------|-------------|----------|
| One security event log module, built here to Phase 19 D-18's contract: uploads, refusals, quarantine, verdicts, blocked files, downloads, integrity failures, removals, restores and AI inclusion; never a file's content, name or text; warnings for malware and integrity failures | One audit channel that Phase 19's exports and Phase 17's people search then reuse; a SIEM can alert on malware (Annex A 8.15 and 8.16) | ✓ |
| Strapi's request log only | It carries no actor, attachment or verdict | |
| A persisted audit table | Needs its own contract change, which Phase 19 also deferred | |

**Choice:** `[auto] Events: Q: "How are file events recorded?"` → the shared security event log (recommended default).

---

## 29. Grants and the catalogue

| Option | Description | Selected |
|--------|-------------|----------|
| Two API-only Functions: attachments (list, upload, download, remove and restore) for the Requestor and the Security Analyst; AI inclusion and the text preview for the Security Analyst, also in `HUMAN_ANALYST_ONLY_OPERATIONS`; none for the agent's role; a design note amending note 6 | Phase 13 D-30's pattern; the second refusal for human-only operations | ✓ |
| One Function for everything | AI inclusion would reach the Requestor's birthright | |
| Grant the service agent | No agent workflow needs files (G-1) | |

**Choice:** `[auto] Grants: Q: "Which grants serve the new operations?"` → two API-only Functions (recommended default).

---

## 30. Verification and plan shape

| Option | Description | Selected |
|--------|-------------|----------|
| RED first at each seam: Strapi unit and mounted integration tests for every operation and refusal (the fake `clamd`, the fake object store and the fake OpenAI-compatible server among them), matrix rows, web units for every refusal state, and Playwright at 1440px and 375px for the five criteria with their own records. The contract-gap checkpoint comes before any schema, specification or catalogue change; plans are serialised by shared files; the run leaves the tree clean | The Stage 2 test rules; every negative case proven in the API and the UI | ✓ |

**Choice:** `[auto] Verification: Q: "How is the phase proved and sequenced?"` → the recommended option.
**Notes:** The fixtures are small committed files with known text, and none contains the EICAR string.

---

## Planner's Discretion

- Module placement for the Strapi pipeline, the event log, the web feature and the shared file-transfer modules.
- Names of reason codes, Functions, operations, fields, settings, event names and envelope versions, within the families in CONTEXT.md.
- The bounds within the proposals: the per-file cap, the per-run bound, the note window, the lifetime bound, the scan timeouts and the re-scan backoff.
- How the private local provider is wired, and whether files go through the plugin's upload service or the provider and file record directly.
- Whether the file-transfer modules and the event log get their own plan; whether the plugin's file records go in a dedicated Media Library folder.
- Copy, layout and visuals, which the UI-SPEC fixes.

## Deferred Ideas

- Attachments on questionnaires, assessments, risks and control implementations; the risk table's "Files" column; the questionnaire's `File upload` answer type.
- Inline previews and thumbnails; OCR; images sent to the model; citing attachments in AI proposals; a per-file classification.
- Re-scanning stored files when signatures update; a disposal job, legal hold and an audited Admin purge; the Admin's retention setting.
- File versions and replacement, folders, tags, descriptions and bulk download; internal analyst-only files; byte-level progress and chunked uploads; email-in attachments.
