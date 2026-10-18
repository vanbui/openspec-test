---
status: complete
phase: 14-request-attachments
source: [14-VERIFICATION.md, 14-VALIDATION.md, 14-PILOT-RULINGS.md]
started: "2026-10-11"
updated: "2026-10-11"
---

# Phase 14 human verification

Verification found no gap. All five roadmap criteria and COLLAB-02's five acceptance criteria are verified at the code (`14-VERIFICATION.md`, `227d325c`). The status is `human_needed` only because six checks need a person or a deployment: the live ClamAV and private S3 checks, a timed 25 MiB browser transfer, NVDA speech, the PostgreSQL row lock, and the operator's database after a restart. The pilot's walk of 2026-10-11 ran its development database check on a copy, so the operator's own database stays the operator's check.

These are the phase's Manual-Only checks from `14-VALIDATION.md`, the verifier's human verification items and the pilot's browser walk of 2026-10-11, with their results. The walk's full record is in `14-PILOT-RULINGS.md` under "The pilot's browser walk (2026-10-11)". Its defects D1 to D7 and observations O1 to O9 are disposed of in `14-REVIEW-DISPOSITION.md` under "Pilot walk, 2026-10-11".
- Five checks passed.
- Six stay with someone else: two with the deployment, one with the PostgreSQL deployment, one with the operator, one with the operator's next start, and one with the pilot's next walk.
- One group of walk states was not reached in the browser; automated proofs cover it.

**Walk verdict: pass after the walk fixes.** The pilot accepts the final gate's browser assertions for D1, D2, D3 and D5 as their re-verification (`14-17-SUMMARY.md`, "Phase gate (final run, after the code review)").

## Current Test

[testing complete]

## Tests

### 1. The development database gains the attachment table and its link tables, and the catalogue changes reach it (D-01, D-38)

expected: After a Strapi start with both Keycloak flags off and the deterministic provider, `csrm_request_attachments` exists with its `sha_256` column, the four link tables exist (`assessment_request`, `note`, `removed_by`, `uploaded_by`), every existing request reads as having no files, and one upload stores a file under the configured private directory.
result: pass
reason: "Pass, by the pilot on 2026-10-11, on a copy. The check ran on a fresh copy of the development database (`apps/backend/.tmp/pilot-walk-14.db`, copied from `data.db`), on dev servers at `d0aa204c`, with local private storage under `apps/backend/.tmp/pilot-walk-14-attachments` and the development scanner double. Schema sync created `csrm_request_attachments` with its `sha_256` column and the four link tables. All five held 0 rows across the 12 existing requests. After the walk, every stored file had a 64-character digest and the scan status `clean`, and the refused files were never stored. The operator's own `data.db` is unchanged and syncs the same way on its next start (test 11)."

### 2. The premium bar at 375 and 1440 (D-26 to D-29, G-4)

expected: Jane's new-request form with files, the draft's Files section, the cards and the actions sheet, the edit form and submit, files with a note, Bob's Files section with the AI control and the text preview, the questionnaire line, the signal and What the AI used, the second analyst, the Secondary Requestor, the oversize refusal, Jane after the analysts, and a failed transfer with Retry meet the premium bar at 375 and 1440.
result: pass
reason: "Pass after the walk fixes: the pilot's verdict of 2026-10-11. An independent agent drove the walk with the Playwright browser at 1440x900 and 375x812, injecting axe-core, on the records RAR-2026-GTCFCX and RAR-2026-DTFDB9. Axe found no serious or critical violation anywhere except D3, and there was no horizontal page overflow at 375. The issues the walk found are fixed test-first in stage B: D1 to D6, O1 to O3 and O5 to O9 (`14-REVIEW-DISPOSITION.md`). O4 is right by the pilot's ruling, and D7's 404 is development-only. The UI review that followed (`14-UI-REVIEW.md`, 21/24) is disposed of with all six warnings fixed. The table below is the walk's record, verbatim."

The browser check table (the pilot's walk, 2026-10-11, verbatim):

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

### 3. The browser's leave prompt with files waiting or kept (D-26, §10)

expected: Leaving the new form or a draft while files wait or are being added shows the product dialog in-app, and the browser's prompt on a reload, a close or a typed URL; dismissing the dialog returns focus to the link that was clicked.
result: pass
reason: "Pass, by the pilot on 2026-10-11 (Manual-Only results). Both dialogs' copy is exact. Dismissing returns focus to the link that was clicked: the sidebar link at 1440, and the Menu sheet's link at 375. A reload or a typed URL raises the browser's `beforeunload` prompt. While a refused row is kept, in-app links raise no dialog, and `beforeunload` stays armed on other pages; it disarms after submit. Since then, stage B's WR-401, WR-402, WR-504 and WR-505 have closed the unreachable-row, first-save, save-round-trip and posting-note cases (component tests)."

### 4. Alt+T reaches the attachment toast's Undo by keyboard

expected: After a removal, Alt+T moves focus to the notifications, Tab reaches the toast's Undo, and Enter restores the file, with focus on the restored row.
result: pass
reason: "Pass, by the pilot on 2026-10-11. Alt+T, then three Tabs (notifications, toast, `Close toast`, `Undo`). Enter shows `data-flow.docx restored.`, and focus goes to the restored row's `Download`. Since then, stage B's WR-602 has placed the toast's Close after Undo below 768px, where it is the touch-target size; it stays before Undo in focus order."

### 5. The AI switch's accessible facts (§5.1)

expected: The switch exposes its role, name and checked state, and its description carries both the file name and the facts line (`Not included`, or `Included · all {n} characters`).
result: pass
reason: "Issue O9 at the walk: the switch was described by the file name only, so its facts line was not announced with it. It is fixed test-first in stage B (`e7c1282`). The switch's `aria-describedby` now names the file name and the facts line, in the table and in the phone sheet, and `file-ai-control.test.tsx :: the switch’s accessible description (§5.1; O9)` asserts the accessible description. The pilot's next walk can re-read it on the accessibility tree. The speech itself is test 6."

### 6. NVDA speaks the attachment toasts, the AI switch and its facts, the queue's stages and the refusal alerts

expected: With NVDA and Chrome on Windows, on Jane's new form and Files section and on Bob's AI control and text preview, at 1440 and 375: the toasts and their Undo (Alt+T) are spoken; the switch's name, state and facts line are spoken together; the queue's stages and the refusal alerts are spoken once.
result: pending
reason: "Pending, the operator's: there is no screen reader on this host. Tests 4 and 5 prove the accessible facts the speech depends on. `14-VERIFICATION.md` lists this as a human verification item, and `14-VALIDATION.md` as a Manual-Only row."

### 7. A real clamd with freshclam detects EICAR and honours the limits (D-12, G-7)

expected: On the deployment's network, with `CSRM_CLAMAV_HOST` and `CSRM_CLAMAV_PORT` pointing at `clamd` (`StreamMaxLength`, `MaxFileSize` and `MaxScanSize` at or above the README's values, and `AlertExceedsMax yes`): EICAR, uploaded from a machine whose antivirus allows it, is refused with the engine's detection and one warning-level refusal line, and a 25 MiB PDF is stored clean.
result: pending
reason: "Pending, at deployment (the operator): nothing is installed on the build host (G-7), and EICAR must not touch its disk (D-14). The adapter is proven against the fake clamd, including the mid-stream size-limit reply (WR-307), one deadline and an abortable stop (IN-210), and scan before parse (WR-203)."

### 8. A real private S3 bucket (D-06, D-22; WR-702 to WR-705)

expected: In a non-production account: uploads succeed with no ACL header; `aws s3api head-object` shows `ServerSideEncryption: aws:kms`; an anonymous request for the object URL answers 403; and the bucket has Block Public Access, Bucket owner enforced, versioning with noncurrent versions expiring after 30 days, `AbortIncompleteMultipartUpload` and the `aws:SecureTransport` deny, as the README now says.
result: pending
reason: "Pending, at deployment (the operator): it needs the deployment's AWS account. `attachment-storage-s3.integration` proves the private provider against the fake object store: no ACL, SSE-KMS, the 60 s presigned expiry and the credential on the wire (IN-301), and the digest check on the S3 read (IN-307)."

### 9. A timed 24 to 25 MiB upload and download at 1440 in Chrome (D-24, D-25)

expected: Both complete; the times and the tab's memory are recorded in DevTools.
result: pending
reason: "Pending, the pilot's next walk: the worker may not start a dev server, and the walk's downloads finished too fast to show `Downloading…`. Automated stand-ins: `request-attachments.integration`'s 24 MiB stored-bytes test, the body-limit gate's unit and browser tests, and `COLLAB02_LARGE_UPLOAD` (12 MiB downloaded whole)."

### 10. PostgreSQL serialises concurrent uploads and restores at 19 active files (R-08-37)

expected: Before the first PostgreSQL deployment, the Strapi suites run on PostgreSQL, including the attachment count race and the restore race at 19 active files: one succeeds and the other is refused 409 `ATTACHMENT_LIMIT_REACHED`, with exactly 20 active files and no deadlock.
result: pending
reason: "Pending, at deployment: no suite runs on PostgreSQL, and the `pg` driver is not installed. On SQLite the hold tests prove the lock's in-process half (WR-301), and the row lock's proof is routed to R-08-37 by a dated line in `docs/security/phase-08-residual-risks.md`."

### 11. The operator's development database after a Strapi restart (D-01, D-38)

expected: On the operator's next start of the development servers, with both Keycloak flags off and the deterministic provider, the operator's own `data.db` gains `csrm_request_attachments` and its link tables as the pilot's copy did, and the seed adds the attachment-state fixtures behind its development gates.
result: pending
reason: "Pending, the operator's next start. Test 1 proved the sync on a copy of the same database, and `request-attachments.integration :: a fresh database holds the approved attachment columns and the four link tables` proves it on a fresh one."

### 12. Walk states not reached in the browser

expected: `Downloading…`; the pending, blocked and unavailable badges; the §1.2 limit and not-configured lines; truncated facts; the preview's error and "no longer included" states; and `Add with a new note`.
result: skipped
reason: "Not reached in the walk: downloads finish too fast, and the development scanner double passes or refuses at once. Since then, stage B's WR-605 renders the pending, blocked and closed states in the browser through the seeded fixtures behind the development gates (`COLLAB02_FILE_STATES` and `COLLAB02_FILES_CLOSED`, with axe at 375 and 1440), and UI-01 proves a waiting chip at 375. The other states are proven by component tests (`upload-queue.test.tsx`, `files-list.test.tsx`, `file-text-sheet.test.tsx` and `note-composer.test.tsx`)."

## Manual-Only results (the pilot's, 2026-10-11, verbatim)

- **The leave prompt: pass.**
  - Both dialogs' copy is exact.
  - Dismissing returns focus to the link that was clicked: the sidebar link at 1440, the Menu sheet's link at 375.
  - A reload or a typed URL raises the browser's `beforeunload` prompt.
  - While a refused row is kept, in-app links raise no dialog and `beforeunload` stays armed on other pages; it disarms after submit. WR-401 owns the unreachable-row case.
- **Alt+T to the toast's Undo: pass.** Alt+T, then three Tabs (notifications → toast → `Close toast` → `Undo`). Enter shows `data-flow.docx restored.`, and focus goes to the restored row's `Download`.
- **The switch's accessible facts: issue (O9).** It reads as a switch named `Changes the AI inputs`, described by the file name only, with its state. The facts line (`Not included` / `Included · all 288 characters`) is not announced with it.
- **NVDA speech: pending, the operator's.** There is no screen reader here.

## Summary

total: 12
passed: 5
issues: 0
pending: 6
skipped: 1
blocked: 0

## Gaps

No observed implementation gap:
- `14-VERIFICATION.md` records 0 gaps (5/5 criteria; COLLAB-02 satisfied);
- `14-SECURITY.md` records `threats_open: 0`, with 60 of 60 threats closed;
- `14-VALIDATION.md` is validated and Nyquist-compliant;
- `14-REVIEW-DISPOSITION.md` and `14-UI-REVIEW-DISPOSITION.md` are complete.

The final complete automated gate is recorded in `14-17-SUMMARY.md` under "Phase gate (final run, after the code review)".

## Deferred Follow-Ups

- test: 6
  idea: "NVDA speech for the attachment toasts and their Undo, the AI switch and its facts line, the queue's stages and the refusal alerts: the operator's"
  deferred_at: 2026-10-11
- test: 7
  idea: "A real clamd with freshclam on the deployment's network: EICAR refused, a 25 MiB PDF stored clean, the limits as the README sets them (at deployment, the operator)"
  deferred_at: 2026-10-11
- test: 8
  idea: "A real private S3 bucket in a non-production account, configured as the README's steps 4 to 8 say (at deployment, the operator)"
  deferred_at: 2026-10-11
- test: 9
  idea: "A timed 24 to 25 MiB upload and download at 1440 in Chrome, with the tab's memory: the pilot's next walk"
  deferred_at: 2026-10-11
- test: 10
  idea: "The PostgreSQL row lock for the attachment count and restore races at 19 active files: before the first PostgreSQL deployment (R-08-37)"
  deferred_at: 2026-10-11
- test: 11
  idea: "The operator's development database on its next Strapi start: the attachment table, its link tables and the attachment-state fixtures"
  deferred_at: 2026-10-11
