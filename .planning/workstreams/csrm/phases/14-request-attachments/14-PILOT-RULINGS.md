# Phase 14: the pilot's stage B rulings (2026-10-11)

The pilot reviewed `14-REVIEW.md` (`1c3bc451`: 3 critical, 37 warning and 53 info findings from seven lanes over 219 files) and the worker's stage A report. The worker rules still bind stage B: brief §2, §4 and §5, and the resume prompt's §3 and §5.

Stage B follows Phase 13's stage B (`13-REVIEW-DISPOSITION.md` is the model):
- every confirmed Critical and Warning is fixed test-first;
- every Info gets a disposition in `14-REVIEW-DISPOSITION.md`, fixed or with a reason;
- each fix records its failing-then-passing evidence. A test-only fix is proven by breaking the guarded code once and restoring it byte for byte;
- commits are grouped and atomic, staged by explicit path;
- where a finding's own "Fix" is followed, say so; where a ruling below differs from it, the ruling wins.

No ruling below changes a content type. If any fix turns out to need one (schema, field or relation), stop and report: G-6's checkpoint applies.

## The Critical findings

### CR-401, CR-402 and WR-601 (one fix): the Server Action body-limit gate

Confirmed, Critical. Next treats every POST to an app route as a possible Server Action, with or without `Next-Action`, and the prefetch `missing` rule skips `proxy()` and the gate with it. Fix in the proxy, test-first:
- **The gate runs for every request.** Drop the matcher's prefetch `missing` exemption (or add `has:` entries that run only the gate). Inside `proxy()`, run the gate first; skip only the CSP work for a prefetch `GET`.
- **The gate holds every POST, not only those with `Next-Action`.** Outside the four attachment paths, a POST whose declared `Content-Length` is absent, malformed or above 6 MB answers 413. If a legitimate non-action POST must stay unmeasured, list it explicitly with its reason; prove at unit level that sign-in, sign-out, the OIDC routes (unit level only; never enable OIDC in a server) and an ordinary Server Action at its normal size still pass.
- **On the four attachment paths, only a `multipart/form-data` POST may exceed 6 MB** (IN-401). Every other POST there is held to 6 MB.
- **Tests.** Unit cases, also run through `config.matcher`: a header-less `multipart/form-data` POST, an `application/x-www-form-urlencoded` POST, a POST with `purpose: prefetch` and one with `next-router-prefetch: 1`, each over 6 MB outside the attachment paths, answer 413; a multipart POST over 6 MB on an attachment path is admitted; a non-multipart POST over 6 MB on an attachment path answers 413. Replace the unit test that asserted the bypass. The E2E `ACTION_BODY_LIMIT_OUTSIDE_ATTACHMENT_PAGES` gains the header-less multipart and the prefetch cases. IN-602: the "inside" check asserts Next's 404 exactly.
- **Record** both bypasses, the fix and the multipart-only scope in R-08-04's residual (the reverse proxy's per-path limit stays the outer layer) and wherever the gate is documented.

### CR-201 and WR-201 (one fix): the ZIP end record and the spreadsheet reader

Confirmed, Critical: a parser differential between CSRM's ZIP reader and `fflate`. Fix test-first, with the finding's two parts:
- **One end record.** The ZIP reader refuses an archive with any comment (Office never writes one), so the record it accepts is the one at `length - 22`, where `fflate` and ClamAV begin. In the same change, refuse part names that are duplicates when compared case-insensitively (IN-204).
- **The library never sees the uploaded bytes.** `readWorkbookSheets` gives `read-excel-file` a canonical archive rebuilt from the parts CSRM has already inflated and verified: stored entries (method 0), no comment, no extra fields. `fflate` then copies synchronously, and no nested worker starts (WR-201).
- **Tests:** the fake end-record archive is refused; an archive with a comment is refused; an XLSX extraction constructs no nested `Worker` (count the constructions); every fixture still extracts the same text and passes the same content check.
- **The structure refusals get truthful copy (IN-202).** A comment, a ratio, an entry count or a size bound refusal is not "content does not match the name". Add one closed reason, `ATTACHMENT_UNSUPPORTED_STRUCTURE` (415), for the ZIP structure bounds and the comment, with family N copy in the 14-UI-SPEC voice that gives a next step (for example, open the file and save a fresh copy). `ZIP_MALFORMED` stays a content mismatch.
- **IN-708:** add a line to 14-02's dependency justification naming `unzipper-esm` 0.13.3 and `worker-f` 0.1.20 with their licences, and stating that CSRM loads only `read-excel-file/universal`, whose code path never uses them.

## Contract changes in stage B (WR-701 and the fixes below)

WR-701 is confirmed: the shipped contract changes existing endpoints that the approved record does not list. Each change is additive and reaches only `csrm`. The pilot acknowledges these, and stage B's own contract changes listed here, in advance:
1. `failureAttachments` on `AssessmentDraftJobFailed` and `QuestionnaireGenerationJob`;
2. the required `files` key, served as `null` to the Requestor, on `AssessmentRequestSummary` and the questionnaire's request summary (correct the record's "The Requestor's shapes are unchanged");
3. `requestId` on the v3 `AiRunContextAttachment`;
4. the detection pattern admits `_` (WR-501) in the spec, Strapi's served and logged patterns and the web transport, and `RequestAttachment.detection` is held to the same pattern, served `null` otherwise (IN-704);
5. three new closed reasons, each in Strapi's list, both spec enums and the web's list with its family copy: `ATTACHMENT_UNSUPPORTED_STRUCTURE` (415, above), `ATTACHMENT_ACTIVE_CONTENT` (415, WR-205) and `ATTACHMENT_BUSY` (503, retryable, WR-204);
6. the hand-written refusal envelope drops `data: null` (IN-705), unless a web or contract parser needs it; then declare it and amend R-08-38 instead;
7. the record's column name for `sha256` is `sha_256` (IN-104; the attribute is unchanged).

Write these into `docs/contract-gaps/phase-14-request-attachments.md` as a dated section, `## Amendment (2026-10-11, stage B)`, with "Acknowledged by the pilot on 2026-10-11 (G-6), per `14-PILOT-RULINGS.md`", and add the items to "What the pilot checked". Keep every earlier line of the record, the approval line included, verbatim. Any other contract change: stop and report.

New or changed copy (the three reasons, WR-502, WR-503, IN-502, IN-504) is recorded in 14-UI-SPEC §8 as dated amendments, as 14-05 recorded `HISTORY_UNAVAILABLE`.

## Rulings on the Warnings

**Lane 1**
- **WR-101:** fix as proposed: the changes that withdraw text or record a system verdict (`ai-excluded`, `removed`, the scan verdicts) always fit, through a reserve below the cap, and only adding changes (`restored`, `ai-included`) are refused within the reserve. A malformed `eventLog` never blocks a withdrawal or a verdict either: the state change proceeds, the log is left untouched (never repaired), and a warning-level security event line records the change. G-3 minimisation and D-21's deletion outrank bookkeeping. Tests at 199 and 200 events, and for a verdict at the cap.
- **WR-102:** fix as proposed, with the scheduler test.
- **WR-103:** fix: one `attachment.refused` line for every refusal after the policy, the readers-rule 404 included, which logs a closed reason and only the requested identifiers (the response stays a reasonless 404). The download's state refusals and the preview's refusals go through `refused()`. This overrules the 14-06 and 14-07 summaries' "404 not logged" and "other download refusals are not logged".

**Lane 2**
- **WR-202:** fix: the extraction and probe workers get `env: {}` and `execArgv: []`, with a test that the worker's `process.env` holds none of Strapi's keys. Record in the residual register that the worker is a resource boundary, not a privilege boundary.
- **WR-203:** scan before parse whenever the scanner answers. Run the malware scan before the PDF open check, and call the check only on a `clean` verdict: an infected file is refused without being parsed. When the scanner does not answer (`not-scanned`), the open check still runs in the isolated worker, now with an empty environment, before the file is stored pending. That pre-scan parse during an outage joins R-08-43 (ISM-2059) as part of the outage residual, with its compensating controls: the worker's limits, its empty environment and pdf.js `isEvalSupported: false`. The reason for running it there: the open check is what refuses an encrypted PDF a scanner cannot see inside, and a later failed check would have to mark a stored PDF `blocked`, which reads as malware. Test the order: the scanner is called before `probePdf`, and an infected verdict never reaches it.
- **WR-204:** fix: bound the screening and extraction queue to a small fixed number of waiting tasks, and allow at most one screening in flight per uploader. Beyond either bound, refuse at once with `ATTACHMENT_BUSY` (503, retryable; the web's queue row offers Retry). Do not give probes and extractions separate slots: that doubles the worst-case worker memory. Per-user rate limiting of refused uploads stays with the reverse proxy and WAF under R-08-04; every refusal is already a security event line, so it can be detected.
- **WR-205:** fix: refuse Office active content beyond VBA. External relationships (`TargetMode="External"` with a type ending `/oleObject`, `/attachedTemplate`, `/frame` or `/subDocument`) and ActiveX parts get the new `ATTACHMENT_ACTIVE_CONTENT`. XLM macro sheets (`macrosheet`, `intlmacrosheet`) and VBA data parts get `ATTACHMENT_MACRO_ENABLED`, because they are macros. Read every `*.rels` part through the bounded `PartReader` budget. Build the fixtures in memory in the tests; commit no active-content file.

**Lane 3**
- **WR-301:** as Phase 13's WR-201 ruling. On SQLite the race tests cannot fail without the lock, so name them for the serialised outcome they prove. Prove the in-process half of `withRequestLock` deterministically with a harness hold after `countAttachments` (as `withHeldAiContext` does): the second upload does not reach its own count while the first is held, then one 201 and one 409. Add the same proof for a restore racing an upload at 19. Route the PostgreSQL row lock to R-08-37 with a dated line, and correct the VALIDATION row and T-14-21's citation.
- **WR-302 to WR-308:** fix as each finding proposes. For WR-305: the EICAR gate becomes `git grep -n -a -E 'EICAR-STANDARD|ANTIVIRUS-TEST' -- apps` (no `-I`), and `.gitattributes` marks only the fixture types binary, so the README is text again (IN-706).

**Lane 4**
- **WR-401 to WR-405:** fix as each finding proposes. WR-405's touch targets are fixed together with WR-602.

**Lane 5**
- **WR-501:** fix in all four places in one change (contract item 4), with a Strapi test and a transport test using the real ClamAV name `Win.Test.EICAR_HDB-1`, built in memory. That name is a detection name, not the test string, and the EICAR gate does not match it.
- **WR-502, WR-503:** fix: truthful sentences per reason and per action (a refused restore never says "downloaded"), recorded in §8.2 and §8.3. IN-606's tests pin each action separately.
- **WR-504, WR-505:** fix as proposed.
- **WR-506:** render a removed file as its plain name, as `note-item.tsx` already does.

**Lane 6**
- **WR-602:** fix in the shared Sonner component: the Close button meets the touch-target height at phone widths. Scan with the toast showing, in both AI-inclusion journeys and the UAT-012 journey, and correct the "every page change" comment. Watch `performance.spec.ts`.
- **WR-603:** fix: 404 unit tests for the download, removal, AI-input and preview actions (the exact `This file is no longer available. Refresh the page.` and no bytes), and a browser proof that the Secondary Requestor replaying a bound attachment Server Action with Jane's ids gets not-found and no download. Rewriting the action's body with `page.route`, or posting to the action endpoint with her session, are both acceptable.
- **WR-604:** fix with IN-404: sizes over the limit round up, so a file just over 25 MB reads "25.1 MB", and the boundary sentence is pinned exactly.
- **WR-605:** fix: axe at 375 and 1440 on the pending, blocked and closed (released) states of the Files section, and on the new-request form with a refused row. Render them through the existing fixture mechanisms (an E2E seed of attachment rows behind the existing E2E gates, or the attestation-gated UI-state harness), with no new product configuration. If a state cannot be rendered that way, record it in `14-VALIDATION.md` as a partial proof with the reason, and prove its markup with a jsdom axe check.

**Lane 7**
- **WR-701:** the record amendment above.
- **WR-702:** Under S3 versioning, a delete leaves a noncurrent version. CSRM deletes bytes only for content that must not be kept, or that an administrator deletes in the Media Library:
  - a blocked file;
  - a refused late upload;
  - any other case you find.

  It never deletes a retained attachment's bytes, because removal is soft. The fix is in the deployment guidance, with no new dependency and no code:
  - README step 5 expires noncurrent versions under the attachment prefix after a short window (30 days). That bounds how long malware can survive as a noncurrent version, and keeps versioning as a short-term undo for an administrator's deletion.
  - Long-term retention protection is a backup in a separate account (AWS Backup or replication), not lifecycle rules (IN-709).
  - Correct R-08-43 and the record's line to say exactly this.
  - Add the residual, with the operator as owner: blocked bytes may survive up to the window as a noncurrent version, which CSRM's role cannot read (it holds no `s3:GetObjectVersion`).

  Deleting a specific version from code would need the AWS SDK as a new direct dependency, and `s3:DeleteObjectVersion` would let a compromised application role destroy every retained file permanently. Record that as the rejected alternative.
- **WR-703, WR-704:** fix the README as proposed.
- **WR-705:** fix: `attachment-config.ts` refuses an `http:` endpoint outside the development key (boot fails, like every other invalid S3 setting). The README and `.env.example` say `https://`, and the README's bucket policy denies `s3:*` when `aws:SecureTransport` is false.

## Rulings on the Info findings

Fix these. Each is a real defect, and cheap or security-relevant:
- **Lane 1:** IN-101 (fail-visible, Phase 13 IN-103: an included file whose text is null or empty fails the context and is named), IN-102, IN-103 (make `addRefusalFor` use `acceptsAttachments`, and prove `isActiveAttachment` equals the count query; D-16's single predicate), IN-104 (contract item 7) and IN-105.
- **Lane 2:** IN-201, IN-202 (contract item 5), IN-203, IN-204 (with CR-201), IN-205 (`\u` escapes; widen to the format, separator and tag characters; prefix Windows reserved stems with `_`), IN-206, IN-207, IN-208 (raise the backend's engine floor to 22.2), IN-209 (with WR-705; the R-08-44 wording goes with IN-702) and IN-210 (one deadline; the network requirement goes in the README).
- **Lane 3:** IN-301 to IN-307. For IN-305, moving the helpers into one module is worth it, because several fixes touch them.
- **Lane 4:** IN-401 (with CR-401), IN-402, IN-403, IN-404 (with WR-604), IN-405 (revoke after 60 s), IN-406, IN-407, IN-408 and IN-409.
  - IN-402: validate the download against what Strapi serves for the record (the recorded name's extension and the served type), never the client's claim.
  - IN-406: remove the unused exported Server Action, because an exported action is a callable endpoint.
- **Lane 5:** IN-501 to IN-506. For IN-506, either pass the icons by name, or record the editor route's measured first-load change in the route-budget notes.
- **Lane 6:** IN-601 to IN-607.
  - IN-601 matters: a 404 carries no reason through the transport, so D-18's existence-hiding refusal can never name a rule.
  - IN-604: replace the source greps with behaviour tests where that is cheap, and add IndexedDB to the "never in web storage" check.
- **Lane 7:** IN-701 to IN-709. IN-707 uses obvious placeholders and recommends an `s3:ResourceAccount` condition.

## The worker's decisions during stage A

- **Confirmed:**
  - D-30's off-only switch for an included file under a refusing AI policy. Record it in 14-UI-SPEC §5.1 as a dated amendment if it is not there yet. WR-404 fixes its pending state.
  - The list's `meta.total` counts files that are not removed. The spec's description says so.
  - The analyst pages' file figures use the human-analyst check, as notes do.
  - The 14-11 re-opening, which was test-first.
- **Overruled:**
  - 14-06 and 14-07's narrowed logging (WR-103).
  - 14-16's reordered phone axe scan (WR-602).
- **Accepted:** the stage A mechanics (executors reading the GSD references themselves, skipping `state.begin-phase` on a resume, and executors run in the foreground).

## The Keycloak path static check

Met in intent. The one path, `apps/backend/tests/keycloak-provisioning.unit.test.ts`, changed only in its fake Strapi (the fields `register()` now needs for the attachment steps) and in a log filter for the attachment summary line. The pilot read the diff: no Keycloak source, configuration, realm or flag changed. The final gate lists this file as the one reviewed exception. IN-303's fix tightens the test so it pins exactly one attachment line. Later phases keep the check literal, and the pilot reviews any hit.

## The pilot's browser walk (2026-10-11)

Treat each defect below as a review Warning, recorded in `14-REVIEW-DISPOSITION.md` under "Pilot walk, 2026-10-11".

**How it ran.**
- **Servers:** the dev servers at `d0aa204c`, with both Keycloak flags off, the deterministic provider, local private storage under `apps/backend/.tmp/pilot-walk-14-attachments` and the development scanner double.
- **Database:** a fresh copy of the development database (`apps/backend/.tmp/pilot-walk-14.db`, copied from `data.db`); the operator's database is untouched.
- **The agent:** an independent agent drove it with the Playwright browser at 1440x900 and 375x812, injecting axe-core.
- **Records:** RAR-2026-GTCFCX (`Pilot walk 14 — 1440`) and RAR-2026-DTFDB9 (`Pilot walk 14 — 375`). No other request was touched.
- **Results:** axe found no serious or critical violation anywhere except D3, and there was no horizontal page overflow at 375.
- **Screenshots:** the pilot session's `scratchpad\walk14\`.
- **Not reached:**
  - `Downloading…`: downloads finish too fast;
  - the pending, blocked and unavailable badges: the double passes or refuses at once (WR-605 covers them);
  - the §1.2 limit and not-configured lines, truncated facts, the preview's error and "no longer included" states, and `Add with a new note`.

**The development database check: pass, on the copy.** Schema sync created `csrm_request_attachments` with its `sha_256` column and the four link tables (`assessment_request`, `note`, `removed_by`, `uploaded_by`). All five held 0 rows across the 12 existing requests. After the walk, each stored file has a 64-character digest and scan `clean`, and the refused files were never stored.

### The browser check table (record it verbatim in `14-UAT.md`)

| # | Check | Actor | Width | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Form field, queue, refusals | Jane | 1440 | pass (O1, O3) | Hint `…· 15 more can be added to this request`; sizes `2 KB`/`2 KB`/`4 KB`/`82 bytes`/`75 bytes`; a duplicate listed once; Tab path Choose files → each row → Save draft; focus after removing the last row goes to the previous row |
| 1 | Save draft with files | Jane | 1440 | pass (O4) | The address became `/edit` without navigating; `Adding files…` disabled; `Draft saved at 1:39 am`; `3 of 5 files added · 2 not added`; both family N sentences exact; the `2 files weren’t added` alert focused, its copy exact |
| 1 | Refused rows kept (§1.5) | Jane | both | pass | `Go to draft` and `Edit request` raised no dialog; `Restored from earlier in this session.` and `0 of 2 files added · 2 not added` |
| 1 | Phone layout | Jane | 375 | issue (O2) | Choose files 294x44; the drag line hidden; 16px padding; the chosen row's `X` 24x24; refused-row actions 294x44; no overflow (360/375); axe clean |
| 2 | Leave warnings | Jane | both | pass | Both dialogs' copy exact; Stay and Keep editing get first focus; `beforeunload` fires on reload before the draft exists and during uploads |
| 3 | Draft Files section | Jane | 1440 | pass (D6) | Hub `3 files` → `#files`; description exact; newest first; type icons; Download saved under its name with an identical SHA-256; the hidden `…downloaded.`; Remove, Undo, the removed group, Restore and every focus move per §3.5 |
| 3 | Cards and actions sheet | Jane | 375 | issue (D3) | Download 268x44; More actions 44x44 with `aria-haspopup=dialog`; the sheet title focused; Remove 343x44; the sheet's Close 71x44; the toast's Close **20x20**; Undo 59x44; the removed toggle 278x44; Restore 253x44 |
| 4 | Edit form and submit | Jane | both | pass (D2) | Edit description exact; the PPTX added at once; dialog line `Wait until your files are added, then submit.` with the confirm disabled, then `1 file wasn’t added. Submit anyway, or retry it first.` (375: `2 files weren’t added… them`); kept rows cleared on submit |
| 5 | Files with a note | Jane | both | pass (D1) | Note POST first, then the file; the pending note at 0.6 opacity with `Waiting`; a chip whose name links to `#file-…`; the row's `Note · 11 Oct 2026, 1:47 am` → `#note-…`; the empty-note error exact; the 375 hand-off focuses the textarea with its caption; Attach files and Add note 278x44 |
| 6 | Analyst Files and AI control | Bob | both | issue (D2, D4) | Analyst description and `…Restricted classification.` exact; the image line exact; `Reading the file’s text…` while waiting; `Included · all 288 characters`; the include, exclude and included-file removal toasts and its Undo exact; preview 640px at 1440 and full screen at 375; focus returns to Preview text; the sheet's switch **32x18** |
| 7 | Questionnaire line, signal, What the AI used | Bob | both | issue (D1) | `5 files · 1 included in the AI inputs`; signal `vendor-security-pack.pdf · Included since`; after Replace the signal is gone and `Files` lists only the PDF, `Requestor file · 288 characters sent` |
| 8 | Second analyst | Sam, Bob | both | issue (D5 at 375) | `Removed by Sam Analyst · 2:02 am`; Bob has no Restore; Sam restores |
| 9 | Secondary Requestor | — | both | pass | `Page not found`; the role gate on the analyst route; no file name, title or number in the HTML; axe clean |
| 10 | Oversize | Jane | 1440 | pass | `Not added. Files can be up to 25 MB, and this one is 26.3 MB. Make it smaller or split it, then add it again.` (no request sent) |
| 11 | Jane after the analysts | Jane | both | pass | The removal record shows who and when; no Restore, no switch and no AI text; axe clean |
| 12 | Transfer failed, Retry | Jane | 375 | pass | `Not added. We couldn’t add this file. Try again.`; `Retry diagram.png` 245x44; the row kept across in-app navigation; Retry added the same file |

### Manual-Only results

- **The leave prompt: pass.**
  - Both dialogs' copy is exact.
  - Dismissing returns focus to the link that was clicked: the sidebar link at 1440, the Menu sheet's link at 375.
  - A reload or a typed URL raises the browser's `beforeunload` prompt.
  - While a refused row is kept, in-app links raise no dialog and `beforeunload` stays armed on other pages; it disarms after submit. WR-401 owns the unreachable-row case.
- **Alt+T to the toast's Undo: pass.** Alt+T, then three Tabs (notifications → toast → `Close toast` → `Undo`). Enter shows `data-flow.docx restored.`, and focus goes to the restored row's `Download`.
- **The switch's accessible facts: issue (O9).** It reads as a switch named `Changes the AI inputs`, described by the file name only, with its state. The facts line (`Not included` / `Included · all 288 characters`) is not announced with it.
- **NVDA speech: pending, the operator's.** There is no screen reader here.

### Rulings on the walk (fix test-first; record under "Pilot walk, 2026-10-11")

- **D1 (medium), the important one:** links to a file from other pages open the analyst page at the top, with focus on `body`. These are the questionnaire's files line, the signal's file link and What the AI used's file link (§3.2, §6.1, §6.2, §7.1, §12; X-10; G-4). On the same page, the hub's `{n} files` link and a note's chip scroll but leave focus on the link, while `Notes` focuses its heading.
  - Phase 13's D1 had the same cause, and `use-hash-landing.ts` is its fix. Make `#files` and `#file-{id}` land through `useHashLanding`/`landOn`, with focus where the UI-SPEC says (the section heading for `#files`; the file's row for `#file-{id}`).
  - Prove it in the browser at both widths with `toBeInViewport()` and the focused element after following each real link: from the questionnaire page, the signal, the run sheet, the hub and a note's chip.
  - A test that checks only the URL or `toBeVisible` cannot fail; fix any that does.
- **D2 (medium):** at 1440 the Files table overflows its region and cuts off Download and Remove. On the analyst page that is 1204px in 1038px, and the Size column slides under the sticky Name column when focus reaches the AI cell. In the draft's edit form the table sits in the 672px column.
  - Make the list fit its container at 1440 with every action visible and no overlap, choosing the layout by the container's width (the card layout where the table cannot fit), as X-21 and §3.2 allow.
  - Prove it with an overflow assertion on both pages at 1440.
- **D3 (medium):** at 375 a toast over the phone actions sheet fails axe `target-size` on its 20x20 Close (WR-602), and the inclusion toast covers the sheet's `Preview text` and `Remove`.
  - Fix WR-602.
  - Make sure a toast never covers an open sheet's controls at 375: offset the toaster above an open bottom sheet, or follow the direction's toast placement if it says otherwise.
  - Prove both with the toast showing over the sheet.
- **D4 (low):** the phone sheet's AI switch is 32x18. Fix it with WR-405: a full-width label row at the touch-target height.
- **D5 (low):** after an analyst's Restore at 375, focus lands on `More actions for {name}` instead of the card's `Download` (§3.5). Fix it in the focus effect, and test the analyst's card at 375.
- **D6 (low):** while a remove is pending, the count line keeps the old number. Make the count optimistic with the row (G-4), and roll it back on failure.
- **D7 (low):** in development, every analyst page preloads a `file-text-sheet` chunk that answers 404. Check a production build: if any preload answers 404 there, fix it; if it happens only in development, record the evidence and dispose of it.
- **O1, O3 (cosmetic):**
  - O1: queue rows get the file-type icon (X-20).
  - O3: the stage text sits on the name's line at 1440 where it fits (§1.4).
- **O2 (low):** WR-405.
- **O4 (ruling):** the observed behaviour is right. A refused row cannot be "sent": it would be refused again. §2.2's "sends the files still listed" means the rows that can be sent (waiting or failed). Refused rows stay listed for the tab with their reasons (§1.5), and nothing is lost. Record a dated clarification in §2.2. WR-402 fixes the first save, before the draft exists.
- **O5 (cosmetic):** hide the density toggle below 768px, where the list is cards (G-4: purpose-built phone layouts).
- **O6 (low):** the phone card's `Note · …` link is 151x15. Give it at least the 24px target (WCAG 2.5.8) or the touch-target height, as the UI-SPEC says for phone actions.
- **O7 (cosmetic):** the removed group stays collapsed once it has emptied and refilled (§3.5).
- **O8 (low, earlier phases):** at 375 the shared dialogs' buttons are 294x36, and `Go to draft` is 95x32.
  - If `docs/design/csrm-design-direction.md` sets the touch-target height for buttons below 768px, fix it once in the shared dialog footer and the alert's link button, with a test, watching every pixel and budget check.
  - If it does not, dispose of it with the direction's citation. These are 36px, above WCAG 2.5.8's 24px.
- **O9 (accessibility):** the AI switch's description includes its facts line (`aria-describedby` on the file name and the facts), so a screen reader hears whether the file is included and how much is sent (§5.1).

Walk verdict for `14-UAT.md`: **pass after the walk fixes.** The pilot accepts the browser assertions for D1, D2, D3 and D5 in the final gate as their re-verification.

## Then, in order

1. The fixes: the Criticals first, then the contract-change group (record amendment, reasons, patterns, 404 reasonless), then the rest by lane, then the walk defects. Record each in `14-REVIEW-DISPOSITION.md`.
2. Regression: the full web and Strapi suites, plus Playwright for every spec the fixes touched (both projects).
3. `verify:post`: `/gsd-secure-phase 14 --ws csrm`, `/gsd-validate-phase 14 --ws csrm` and `/gsd-ui-review 14 --ws csrm`, plus the UI review's disposition. Close every open threat or gap.
4. The verifier, writing `14-VERIFICATION.md`. Close every gap.
5. `14-UAT.md`, with the Manual-Only results and the walk.
6. The final full gate, recorded in `14-17-SUMMARY.md` as `## Phase gate (final run, after the code review)`. Include the static checks against `e50053f`: the EICAR gate as in WR-305, and the Keycloak exception above.
7. Bookkeeping, for the pilot to review:
   - `phase complete 14`, once `14-VERIFICATION.md` reads `passed`. If it reads `human_needed` only for operator checks, stop and report for the pilot's ruling;
   - ROADMAP;
   - REQUIREMENTS: COLLAB-02 complete in the list and in Traceability;
   - STATE: Current Position, decisions prefixed `[Phase 14 close, 2026-10-11, worker]`, Performance Metrics, and Session Continuity naming Phase 15's fresh plan check.

   Commit by explicit path. Do not push.

**Usage:** read "Weekly · all models" before each unit:
- start a fix group or the final gate only at 97.5% or below;
- start a fan-out step (the `verify:post` audits, or more than one agent at once) only at 95% or below;
- at the line, stop at a clean boundary, name the exact next step in STATE.md's Session Continuity, and report.
