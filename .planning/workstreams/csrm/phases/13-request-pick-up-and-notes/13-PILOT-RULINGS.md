# Phase 13: the pilot's stage B rulings (2026-10-09)

Copied from the pilot session's scratchpad so a later session can resume stage B. The worker records each outcome in `13-REVIEW-DISPOSITION.md`; these rulings say what each finding needs.


The pilot reviewed `13-REVIEW.md` (`2082f20`) and your stage A report. The worker rules still bind you: brief §2, §4 and §5, and the resume prompt's §3. Stage B follows Phase 12's stage B exactly (`12-REVIEW-DISPOSITION.md` is the model): every confirmed Warning is fixed test-first, every Info gets a disposition in `13-REVIEW-DISPOSITION.md`, with each finding's failing-then-passing evidence, and commits are grouped and atomic.

## Rulings on the review

- **WR-601:** no new `CSRM_AI_` setting, test-only or not. 13-19's static check stands, and a provider-timing knob in product configuration is a risk with no product value.
  - Prove D-18 at the levels where it can fail:
    - a Strapi integration test: a second human analyst reads and retries a job another analyst started, sees the initiator's display name and the new `canRetry` meaning, and the agent and a Requestor are refused;
    - a component test of the card's "Started by {name}." copy in the running and failed states.
  - Add a browser assertion only if the existing E2E UI-state harness (`CSRM_E2E_UI_STATE_HARNESS`, used for Phase 11's guarded fixtures) can render the running card for a second analyst without new product configuration.
  - Fix the spec's vacuous check either way.
- **WR-201:**
  - On SQLite, knex's single connection serialises transactions, so the race tests cannot fail without the lock. Say so in the tests: name them for the serialised outcome they prove, not the lock.
  - Prove the in-process half of `withRequestLock` with a unit test that fails without the promise tail: two callbacks for one request never interleave, and two requests run independently.
  - Route the row lock's proof to R-08-37 with a dated line in `docs/security/phase-08-residual-risks.md`, as the records already say.
- **WR-101:** check the acting analyst's own eligibility on every assignment action (defence in depth against a dual-role user holding both the human analyst and the agent role), with a dual-role test. Fold IN-204's dual-role case into it.
- **WR-102:** the mark set at posting is guarded exactly like the mark operation: the human-analyst-only check as well as the grant.
- **WR-301, WR-303 and WR-502, WR-401:**
  - a failed action call rolls back in place with the danger toast (G-4), never the error page;
  - a failed post never overwrites text typed while it was pending;
  - Sign out warns before it clears kept text (the leave prompt first).
  - Prove each in a component test, and in a browser assertion where the existing specs reach it cheaply.
- **WR-306:** the hub keeps showing the questionnaire's AI-inputs-changed signal while the Requestor answers. Check 13-UI-SPEC for the intended states first; if the UI-SPEC deliberately hides it, record that as "no change needed" with the citation.
- **WR-602, WR-603, WR-604:** fix the specs so each check can fail: the mark-read proof, awaited clean-up and no leaked unread state; count tests that exercise a non-zero branch; a real "holder not offered" check.
- **WR-605, WR-606:** add the keyboard and focus paths and the axe and 1440 overflow checks the lane names, inside the existing journeys. Use no new spec unless it is cheaper.
- **WR-505, WR-503:** extend the copy guard to the Server Action modules, and bring the lazily loaded picker under the zod boundary walk.
- Every other Warning (WR-103, WR-202 to WR-206, WR-302, WR-304, WR-305, WR-501, WR-504, WR-607) is fixed test-first as its lane proposes, unless your failing test shows it is not real.
- Fix the Info items that are real defects and cheap: IN-101 (no-op), IN-103 (fail-visible), IN-302, IN-303, IN-304, IN-306, IN-307, IN-401, IN-402, IN-501, IN-505. Disposition the rest.

## The pilot's browser walk

Appended below by the pilot when the walk reports. Treat each defect like a review Warning, under the heading "Pilot walk, 2026-10-09".

## Then, in order (as Phase 12's stage B)

1. 13-19 Task 3: record the walk (its table and Manual-Only results, appended below) and `COVERAGE.md`.
2. Regression: the full web and Strapi suites, plus Playwright for the specs the fixes touched.
3. `verify:post`: `/gsd-secure-phase 13 --ws csrm`, `/gsd-validate-phase 13 --ws csrm`, `/gsd-ui-review 13 --ws csrm`, plus the UI review's disposition. Close every open threat or gap.
4. The verifier, writing `13-VERIFICATION.md`. Close every gap.
5. `13-UAT.md` with the Manual-Only results.
6. The final full gate, recorded in `13-19-SUMMARY.md` as `## Phase gate (final run, after the code review)`, with the static checks against `ab000f6`.
7. Bookkeeping, for the pilot to review: `phase complete 13`, ROADMAP, REQUIREMENTS (REQ-08 and COLLAB-01), and STATE (Current Position, decisions prefixed `[Phase 13 close, 2026-10-09, worker]`, Performance Metrics, and Session Continuity naming Phase 14's fresh plan check). Commit by explicit path. Do not push.

**Usage:** read "Weekly · all models" before each unit:
- start a fix group or the final gate only at 97.5% or below;
- start a fan-out step (the `verify:post` audits, more than one agent at once) only at 95% or below;
- at the line, stop at a clean boundary, name the exact next step in STATE.md's Session Continuity, and report.


**How it ran.** On the dev servers restarted at `b744ffb` with both Keycloak flags off and the deterministic provider, on a fresh copy of the development database (`apps/backend/.tmp/pilot-walk-13.db`, copied from `data.db`; the operator's database is untouched). An independent agent drove it read-only with the Playwright browser at 1440x900 and 375x812, injecting axe-core. Records: RAR-2026-W081G8 (1440) and RAR-2026-7S6GYK (375), each titled "Pilot walk 13 —". RAR-DEV-CROSS-001 and RAR-E2E-NAV-OWNER-001 were only viewed, and no UAT record was touched. Screenshots: `scratchpad\walk13\`. On every surface: zero serious or critical axe violations, no horizontal overflow (1425/1425 or 1440/1440; 360/360; 375/375 with a modal open), and only a `favicon.ico` 404 in the console.

**The development database check (Task 2 step 2): pass, on the copy.**
- The schema sync added `assigned_at` and `assignment_log` to `csrm_assessment_requests`, created `csrm_request_notes` (with `body`, `author_part`, `sequence`, `posted_at`, `changes_ai_inputs` and `ai_input_log`) and `csrm_request_note_read_states` (with `last_read_at` and `last_read_sequence`), and created the six link tables.
- The seed added Sam Analyst.
- All 12 existing requests read as not picked up, with no assignment log and no notes.
- UAT-A to UAT-C are not in this host's database (as Phase 11 recorded), so the UAT baselines stay the operator's.

## The browser check table (record it verbatim in 13-19-SUMMARY's walk section)

| # | Check | Actor | Width | Result | Evidence |
|---|---|---|---|---|---|
| B1 | Header with "Second Security Analyst" | Sam | 375 | pass | Banner 56 px, 360/360; the tag pill (175x38) wraps to two centred lines; Menu and search intact |
| B2 | Long names in toast and history, Undo reachable | Bob | 375 | pass | The longest seeded names are 11 to 14 characters. The reassign toast wraps to 2 lines; Undo is 59x44 at y735 to 779, reached by Alt+T then Tab three times. The history wraps at 278 px. Synthetic 38 to 60 character names injected into the page also wrapped, still 360/360 |
| B3 | Composer grows to 12 rows, then scrolls | Jane | 375 | pass (D5 nit) | 76 px tall, +20 px per line, caps at 256 px and scrolls inside itself; the hint and Add note (278x44) fit |
| W1 | Request page: submit, Ctrl+Enter note, leave and return | Jane | 1440 | pass | "Adding…", then "Requestor · 9 Oct 2026, 5:46 pm"; one "Note added."; the composer cleared and focused; the text restored with its caption, no dialog |
| W2 | Same | Jane | 375 | pass | Add note full width (278x44), no shortcut hint; the restore works via the drawer |
| W3 | Home after Bob's reply | Jane | 1440 | pass | "New notes on 1 request" above Needs your action; "· Assigned to Bob Doe"; "1 new note" |
| W4 | Same | Jane | 375 | issue (D1) | Read "New notes on 2 requests", because W081G8 stayed unread after Jane followed its link |
| W5 | My requests, Notes: New notes | Jane | 1440 | pass | Chip shown; 1 result equals the figure; Security Analyst column "Bob Doe" |
| W6 | Same | Jane | 375 | pass | The card reads "Security Analyst: Bob Doe", then "1 new note"; 2 results equal the figure |
| W7 | Request page after the reply | Jane | 1440 | issue (D1) | Content correct ("3 notes, 1 new", "Bob Doe · Security Analyst · 5:50 pm", New, no switch), but the link landed at the top of the page |
| W8 | Same | Jane | 375 | issue (D1) | Same: landed at the top, with Notes 3,334 px below |
| W9 | Maya: Jane's URL, Home, My requests | Maya | 1440 | issue (O1) | Shows the permission state, where UI-SPEC §8.6 asks for the request page's not-found state; nothing leaks (no title, number or note text in the HTML) |
| W10 | Same | Maya | 375 | issue (O1) | Same |
| W11 | Requests queue | Bob | 1440 | pass (D2) | Copy, the Assigned to column, "Pick up RAR-…", "2 new notes", the filter chips and "Assigned to: Me" showing Bob Doe all match the spec |
| W12 | Requests queue, cards | Bob | 375 | pass | Pick up 302x44, last on the card; Alt+T reaches Undo; focus goes to the next Pick up, and back to the restored one after Undo |
| W13 | Assignment section, flagged note, mark and Undo, reply | Bob | 1440 | pass | All §5.2, §7.1 and §10.4 copy matches; focus goes to the status line, and stays on the switch through Undo |
| W14 | Same | Bob | 375 | pass | Actions stacked at 278x44; the note header wraps |
| W15 | Picker popover, reassign, history | Bob | 1440 | pass (D4) | 480 px popover; the holder is not offered; the reason survives a click outside and Escape; Ctrl+Enter assigns; the history reads "Reason: “…”" |
| W16 | Picker sheet | Bob | 375 | pass (D4) | Full-screen sheet; "Close assign" 71x44; the action 343x44 at the bottom; the reason survives Close, Escape and in-app navigation |
| W17 | "AI inputs changed" signal on the hub card | Bob | 1440 | pass | The link plus "· Marked since" on one line, a closing caption, no action of its own |
| W18 | Same | Bob | 375 | pass (D3) | Stacked layout; the questionnaire review header shows the signal too |
| W19 | Home and sidebar counts | Bob | 1440 | pass | "Assigned to me, 1 needs your action"; tile 1 opens a list of 1; "Requests, 8 waiting for pick-up" |
| W20 | Home and drawer counts | Bob, Sam | 375 | pass | The Review queue starts at y646; Sam's tile 2 opens 2 results, and "With new notes: 2" opens 2 results |
| W21 | Quick find | Bob | 1440 | pass | "Submitted · Assigned to Bob Doe", later "· Assigned to Sam Analyst" |
| W22 | Same | Bob | 375 | pass | "Submitted · Assigned to Sam Analyst" |
| W23 | Bob's own request | Bob | 1440 | pass | The row reads "Not picked up / You raised it"; the page shows the §5.2 line with no actions, the requesting-analyst hint and no AI checkbox |
| W24 | Same | Bob | 375 | pass | Same |
| W25 | Assigned to me | Sam | 1440 | pass | Lists W081G8; "Queue: All open"; 9 columns; no Assigned to filter |
| W26 | Same | Sam | 375 | pass | Both walk requests listed with unread lines; no Pick up |
| W27 | The request page names the assigner | Sam | 1440 | pass | "Assigned by Bob Doe · 9 Oct 2026, 5:54 pm"; the running job was not seen (below) |
| W28 | Same | Sam | 375 | pass | "Assigned by Bob Doe · 6:08 pm" |

## Manual-Only results

- the leave prompt with unsent note text: **pass**. A `beforeunload` dialog appears on tab close at both widths and on a full navigation away; the picker's kept reason arms it too, and in-app navigation shows no dialog;
- Alt+T to the pick-up toast's Undo: **pass**, keyboard path. Alt+T focuses the toast list, then Tab reaches the toast, "Close toast", then "Undo", and Enter undoes. The region is "Notifications alt+T" with `aria-live=polite`;
- the switch's state and "Note added.": **pass**, accessible facts. The switch has role switch, `aria-checked` toggles, and its name comes from its label; "Note added." is one polite status per note;
- NVDA speech: **pending, the operator's** (no screen reader here);
- "Started by Bob Doe." while a job runs: **not seen**. The deterministic job finishes in 0.3 to 0.6 s. Sam's finished card shows "Replace questionnaire" with no job line. It is covered by the WR-601 ruling in the rulings above.

## Rulings on the walk defects (fix test-first; record under "Pilot walk, 2026-10-09")

- **D1 (medium), the important one:** links to `#notes` and `#assignment` do not land on their target, at either width and for every actor, so the unread flags never clear after following "1 new note" (§2.2, §12.3, §12.4, X-10, G-4, §9.2). The likely cause is the routes' `loading.tsx`, which streams the page in after the browser's hash scroll (`notes-section.tsx:58`, `assignment-block.tsx:172`). Make the target land after hydration (scroll into view once it exists, and focus as the UI-SPEC says), so read-marking then works as designed. Prove it in the browser with `toBeInViewport()` on the target after following the real link, at both widths, and that the unread figure then clears. The e2e tests that checked only the URL and `toBeVisible` cannot fail; fix them.
- **O1 (deviation from UI-SPEC §8.6):** another Requestor opening a request's page must get the request page's own not-found state, not the permission state; today the page renders the permission state from the request read's 403 (`requests/[documentId]/page.tsx:40`). Fix the web route so a refused or missing request on that route renders its not-found state with no notes surface, count or flag. Change the e2e expectation deliberately. The API's 403 on the v1 request read predates this phase: leave it, and add a dated note to `17-CONTEXT.md` that Phase 17's G-12 and ASSESS-22 criterion 4 ("the refusal a missing record gets, at every route, in the API and the UI") should unify the request read's API refusal for an unrelated Requestor.
- **D2 (low):** after a filtered pick-up removes the only row, focus goes to `<body>`; move it per §7.3.
- **D3 (low):** the signal's note link scrolls but does not move focus to the note (§8.2).
- **D4 (cosmetic):** the picker's search focus ring is clipped at the top (a 40 px input in a 36 px row inside an overflow-hidden container; `components/ui/command.tsx:70`, `:76`, shared with quick find). Fix it in the shared component, and watch the `/app/risks/{documentId}` budget, which has 115 bytes left.
- **D5 (nit):** the composer's `min-h` and `max-h` leave out the 2 px border (`note-composer.tsx:177`), so it shows 2.9 and 11.9 rows; include the border.
- **O2:** `request-pick-up.spec.ts:491` expects "No requests match these filters", but the heading is "No assessment requests match these filters"; the branch runs only when nothing waits. Fix the spec.
- **O3:** in a freshly loaded page, assignment times flash as "6:54 am UTC" before switching to local time. Check it against the `LocalInstant` rule (Phase 10 D-19): if the flash is the documented server-render fallback, dispose of it with that citation; if it is avoidable within the rule, fix it.

Walk verdict for 13-19 and `13-UAT.md`: **pass after the walk fixes**. The pilot accepts the browser assertions for D1, O1 and D2 in the final gate as their re-verification.

## Go-ahead

The pilot has stopped both dev servers (nothing listens on 1337 or 3000) and restored `.claude/launch.json`, so the tree is clean. Stage B may start now, including the Strapi suite and Playwright: 13-19 Task 3 first, then the fixes and the steps in the rulings above.
