---
status: complete
phase: 13-request-pick-up-and-notes
source: [13-VERIFICATION.md, 13-VALIDATION.md]
started: "2026-10-09"
updated: "2026-10-10"
---

# Phase 13 human verification

Verification found no gap. All five roadmap criteria and both requirements, REQ-08 and COLLAB-01, are verified at the code. The status is `human_needed` only because two checks need a person: NVDA speech and the PostgreSQL row lock. The verifier's one note was the copy for a `CONTEXT_TOO_LARGE` caused by marked notes, which was routed only in STATE. It is now carried into Phase 15's ROADMAP section and `15-CONTEXT.md` (`798db60`).

These are the phase's manual-only checks from `13-VALIDATION.md` and the verifier's human verification items, with the pilot's results of 2026-10-09. The full results are in `13-PILOT-RULINGS.md`, walk appendix, and `13-19-SUMMARY.md`, `## Browser checks`.
- Five checks passed.
- Three stay with someone else: one with the operator, one with the deployment, and one with the pilot's next walk.
- One was not seen in the browser; automated proofs cover it.

## Current Test

[testing complete]

## Tests

### 1. The development database gains the assignment and notes tables, the second analyst and the catalogue grants

expected: Strapi is started with the Keycloak flags off and the deterministic provider (D-01, D-30, D-31). After that start:
- `csrm_assessment_requests` has `assigned_at` and `assignment_log`;
- `csrm_request_notes`, `csrm_request_note_read_states` and the six link tables exist;
- every existing request reads as `Not picked up`, with no assignment history and no notes;
- the second analyst signs in through the development sign-in.
result: pass
reason: "Pass, by the pilot on 2026-10-09. The check ran on a copy of the development database (`apps/backend/.tmp/pilot-walk-13.db`, copied from `data.db`), on dev servers restarted at `b744ffb`. The schema sync added `assigned_at` and `assignment_log` to `csrm_assessment_requests`. It created `csrm_request_notes` (`body`, `author_part`, `sequence`, `posted_at`, `changes_ai_inputs`, `ai_input_log`) and `csrm_request_note_read_states` (`last_read_at`, `last_read_sequence`), and the six link tables. The seed added Sam Analyst, who signed in through the development sign-in and walked W20 and W25 to W28. All 12 existing requests read as not picked up, with no assignment log and no notes. The UAT-A to UAT-C records are not in this host's database (as Phase 11 recorded), so their baselines stay the operator's. The operator's own `data.db` is unchanged and syncs the same way on its next Strapi start."

### 2. The premium bar at 375 and 1440, with the three UI backstops B1 to B3 (D-25, D-34, G-4)

expected: The surfaces meet the premium bar at 375 and 1440 for Jane, Maya, Bob and Sam: the queue, Assigned to me, the assignment section, the picker, the notes thread and composer, both Homes, My requests, quick find and the AI-inputs-changed signal. The three backstops: B1, the header with `Second Security Analyst` at 375; B2, two long names in a toast and in the history at 375; B3, the composer at 375.
result: pass
reason: "Pass after the walk fixes: the pilot's verdict of 2026-10-09. An independent read-only agent drove the walk with the Playwright browser at 1440x900 and 375x812, injecting axe-core. Results on every surface: zero serious or critical axe violations, no horizontal overflow, and only a `favicon.ico` 404 in the console. B1, B2 and B3 passed; B3 carried the D5 nit (the composer's height left out its border), since fixed. Of W1 to W28, W4, W7 and W8 found D1 (links to `#notes` and `#assignment` landed at the top), and W9 and W10 found O1 (another Requestor saw the permission state, not the request page's not-found state). Every other row passed, some with the D2, D3 and D4 nits. D1 to D5 and O1 are fixed test-first, O2 is fixed in the spec and O3 is accepted under Phase 10 D-19 (`13-REVIEW-DISPOSITION.md`, `Pilot walk, 2026-10-09`). The pilot accepts the final gate's browser assertions for D1, O1 and D2 as their re-verification."

### 3. The browser's leave prompt with unsent note text or a kept picker reason (D-25, UI-D18)

expected: Closing a tab that holds unsent note text or a kept picker reason, or navigating fully away from it, shows the browser's leave prompt. In-app navigation does not.
result: pass
reason: "Pass, by the pilot on 2026-10-09. A `beforeunload` dialog appeared on tab close at both widths and on a full navigation away. The picker's kept reason arms it too. In-app navigation showed no dialog. Since then, stage B's WR-401 makes Sign out warn before it clears kept text (component tests)."

### 4. Alt+T reaches the pick-up toast's Undo by keyboard

expected: After a pick-up, Alt+T moves focus to the notifications, Tab reaches the toast's Undo, and Enter undoes the pick-up.
result: pass
reason: "Pass, by the pilot on 2026-10-09, on the keyboard path. Alt+T focuses the toast list. Tab then reaches the toast, `Close toast` and `Undo`, and Enter undoes. The region is `Notifications alt+T` with `aria-live=polite`. W12 also confirmed that focus goes to the next `Pick up`, and returns to the restored one after Undo."

### 5. The AI-input switch's state and the “Note added.” status, as accessible facts

expected: The AI-input switch exposes its role, name and checked state, and each posted note announces “Note added.” once in a polite status.
result: pass
reason: "Pass, by the pilot on 2026-10-09, on the accessibility tree. The switch has role `switch`, `aria-checked` toggles, and its name comes from its label. “Note added.” is one polite status per note. W13 confirmed that focus stays on the switch through Undo."

### 6. NVDA speaks the toasts, the switch state, “Note added.” and the unread markers

expected: With NVDA and Chrome on Windows, on the analyst's request page, the Requests queue and the Requestor's request page:
- the pick-up, assign, reassign and unassign toasts are spoken, with their Undo reached by Alt+T;
- the AI-input switch's name and on or off state are spoken as it toggles;
- “Note added.” is spoken once per note;
- the New marker and the unread counts are spoken with their notes.
result: pending
reason: "Pending, the operator's: there is no screen reader in this environment. Tests 4 and 5 prove the accessible facts the speech depends on. `13-VERIFICATION.md` lists this as human verification item 1, and `13-UI-REVIEW-DISPOSITION.md` accepts it under UI-09."

### 7. “Started by {name}.” on a running job a colleague started (D-18)

expected: When the second analyst opens a request whose questionnaire or draft job Bob started and is still running, the job card reads “Started by Bob Doe.”.
result: skipped
reason: "Not seen in the browser. The deterministic job finishes in 0.3 to 0.6 seconds, and Sam's finished card shows `Replace questionnaire` with no job line. The WR-601 ruling covers it without any new `CSRM_AI_` setting. A Strapi integration test has a second human analyst read and retry Bob's job, see the initiator's display name and the new `canRetry` meaning, and the agent and a Requestor are refused. Component tests cover the card's copy in the running and failed states. The verifier ran both (`13-VERIFICATION.md`, note 4)."

### 8. PostgreSQL serialises concurrent pick-ups and note writes (R-08-37)

expected: Before the first PostgreSQL deployment, run the Strapi suites on PostgreSQL, including the races in `request-assignment.integration.test.ts` and `request-notes.integration.test.ts`. Two analysts pick up one request at once: one succeeds and the other gets 409 `ASSIGNMENT_CHANGED`, with nothing overwritten. A Requestor and an analyst post notes at once: the sequences run 1, 2, 3 with no gap or duplicate. Each person has one read state per request. There is no deadlock.
result: pending
reason: "Pending, at deployment: no suite runs on PostgreSQL, and the `pg` driver is not installed. On SQLite, knex's single connection serialises transactions, so the race tests prove the serialised outcome, not the `FOR UPDATE` row lock. They are named for that outcome under the WR-201 ruling. `request-lock.unit.test.ts` proves the in-process half of `withRequestLock`. The row lock's proof is routed to R-08-37 by a dated line in `docs/security/phase-08-residual-risks.md`. `13-VERIFICATION.md` lists this as human verification item 2."

### 9. Two captures after the walk fixes, at 375 (UI-09)

expected: At 375, on the pilot's next walk:
- a `#notes` landing from Jane's Home new-notes line;
- the composer grown to twelve rows, then scrolling inside itself.
result: pending
reason: "Pending, the pilot's next walk. The worker rules forbid starting a dev server, so no capture can be taken here. Browser and component proofs already cover both. The D1 landing is asserted with `toBeInViewport()` after following the real links at both widths. The D5 floor and ceiling are covered by `note-composer.test.tsx`. `13-UI-REVIEW-DISPOSITION.md` lists both captures under UI-09."

## Summary

total: 9
passed: 5
issues: 0
pending: 3
skipped: 1
blocked: 0

## Gaps

No observed implementation gap:
- `13-VERIFICATION.md` records 0 gaps;
- `13-SECURITY.md` records `threats_open: 0`, with 66 of 66 threats closed after T-13-F1;
- `13-VALIDATION.md` is validated and Nyquist-compliant;
- `13-REVIEW-DISPOSITION.md` and `13-UI-REVIEW-DISPOSITION.md` are complete.

The final complete automated gate is recorded in `13-19-SUMMARY.md` under "Phase gate (final run, after the code review)".

## Deferred Follow-Ups

- test: 6
  idea: "NVDA speech for the assignment toasts and their Undo, the AI-input switch, “Note added.” and the unread markers: the operator's"
  deferred_at: 2026-10-10
- test: 7
  idea: "“Started by {name}.” on a running card in a browser: the next pilot walk, if a slower provider makes the running state reachable without a new setting (WR-601)"
  deferred_at: 2026-10-10
- test: 8
  idea: "The PostgreSQL row lock for concurrent pick-ups and note writes: before the first PostgreSQL deployment (R-08-37)"
  deferred_at: 2026-10-10
- test: 9
  idea: "The two post-fix captures at 375, a `#notes` landing and the composer at twelve rows: the pilot's next walk (UI-09)"
  deferred_at: 2026-10-10
