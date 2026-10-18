---
phase: 13-request-pick-up-and-notes
plan: 19
subsystem: phase-gate
tags: [gate, static-checks, playwright, strapi, vitest, browser-walk, coverage]
status: complete
requirements: [REQ-08, COLLAB-01]
closes: [UAT-013, UAT-014]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: plans 13-01 to 13-18 executed; PHASE_13_BASE=ab000f6 (13-01-SUMMARY.md)
provides:
  - the Phase 13 gate and static checks (Task 1)
  - the pilot's browser walk of Jane, Maya, Bob and Sam at 375 and 1440, with the development database check and the Manual-Only results (Task 2, recorded in Task 3)
  - the coverage of REQ-08, COLLAB-01, success criteria 1 to 5, UAT-013, UAT-014 and D-01 to D-34
  - the phase's COVERAGE.md (the provider API coverage matrix, re-decided for Phase 13)
affects: [13-REVIEW-DISPOSITION, 13-UAT, 13-VERIFICATION, 14, 15, 16, 17, 17.1, 19.1, 21]
key-files:
  created:
    - .planning/workstreams/csrm/phases/13-request-pick-up-and-notes/COVERAGE.md
  modified:
    - .planning/workstreams/csrm/phases/13-request-pick-up-and-notes/13-19-SUMMARY.md
key-decisions:
  - "The walk verdict is the pilot's: pass after the walk fixes. D1 to D5 and O1 to O3 are fixed in stage B and recorded in 13-REVIEW-DISPOSITION.md under 'Pilot walk, 2026-10-09'. The final gate's browser assertions for D1, O1 and D2 are their re-verification."
  - "REQ-08 and COLLAB-01 are not marked complete here. That is the phase-close bookkeeping step (13-PILOT-RULINGS.md step 7), after the walk fixes and the final gate."
  - "The final full gate after the code review is not part of Task 3. It is appended later as '## Phase gate (final run, after the code review)'."
metrics:
  completed: 2026-10-09
  tasks: 3
actuals:
  tokens: 14400  # chars/4 over this plan's two files (13-19-SUMMARY.md and COVERAGE.md)
  tasks: 3
  commits: 4  # measured 172d665..3e28886 when this file was written: fe0a405 (Task 1) plus the orchestrator's b744ffb, 2082f20 and 3e28886; the Task 3 commit carrying this file comes after it
plan_head_before: 172d66563a6633a6e360d3245a1b40c7b4004541
plan_head_after: 3e288865208f9ace470a53c8e677b63193cdd7e4
---

# Phase 13 Plan 19: The Phase 13 gate, browser checks and coverage Summary

**The Phase 13 gate passed on the production build at `172d665` (web 4,205, Strapi 936, Playwright 202 with 0 flaky; every static check clean against `ab000f6`). The pilot walked Jane, Maya, Bob and Sam at 375 and 1440 on a copy of the development database, and B1 to B3 passed. The verdict is "pass after the walk fixes", with five walk defects and three observations ruled for stage B. Every requirement, success criterion, finding and decision maps to the plans and tests that prove it.**

Task 1 (the gate and the static checks) is recorded under `## Phase gate` and `## Static checks`. Task 2 was the pilot's walk (a blocking-human checkpoint). Task 3 records the walk under `## Browser checks` and `## Manual-Only`, adds `## Coverage` and `## Notes for the orchestrator`, and writes the phase's `COVERAGE.md`. The final full gate after the code review and the walk fixes is not part of this plan's tasks. It is appended later as `## Phase gate (final run, after the code review)` (`13-PILOT-RULINGS.md`, step 6).

## Phase gate

Run on 2026-10-09 from 16:50 to 17:35 (+11:00) at `172d665` (13-18 complete; plans 13-01 to 13-18 executed), on the branch checked out in the working tree, from the repository root with Node v24.19.0 and pnpm 11.24.0. Ports 1337 and 3000 were free before the Strapi suite and before Playwright; no dev server ran. One full run, the suites one at a time; every figure below comes from that run. `PHASE_13_BASE=ab000f6` (13-01-SUMMARY.md).

| Gate | Command | Result | Duration | POST-DEMO-BRIEF §3 baseline (2026-10-01, `ece1a25`) | Phase 12 close (2026-10-09, `ab23681`) |
|---|---|---|---|---|---|
| `api:check` | `pnpm --dir apps/csrm api:check`, then `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | clean; the refresh exited 0 and left nothing modified | 2 s | clean | clean |
| Typecheck | `pnpm --dir apps/csrm typecheck` | clean | 5 s | clean | clean |
| Lint | `pnpm --dir apps/csrm lint` | clean | 4 s | clean | clean |
| Web (Vitest) | `pnpm --dir apps/csrm test` | **Test Files 190 passed (190), Tests 4,205 passed (4,205)**; no `EPERM: rename`, no rerun | 60 s | 2,046 / 2,048 (2 baseline failures, fixed after Stage 0) | 3,682 / 3,682 (166 files) |
| Strapi (node:test) | `pnpm --dir apps/backend test` | **ℹ tests 936, ℹ pass 936, ℹ fail 0**, cancelled 0, skipped 0, todo 0 | 18.6 min (duration_ms 1,111,161) | 578 / 578 (10 min 45 s) | 822 / 822 (16.2 min) |
| Playwright (production build, both projects) | `pnpm --dir apps/csrm test:e2e` | **202 passed**: desktop **156 / 156**, mobile **46 / 46**; 0 failed, **0 flaky**, 0 skipped, 0 did not run (202 tests, 1 worker) | 24.5 min | 84 / 84 (11.1 min) | 161 passed: desktop 135, mobile 26; 0 flaky (18.6 min) |
| Tree | `git status --short` | empty: the run modified no tracked file (Phase 8 D-12, G-6) | | the three operator items | clean |

Phase 13's journeys in that run:

| Spec | Desktop | Mobile |
|---|---|---|
| `request-pick-up.spec.ts` (REQ08_*) | 10 passed | **10 passed** |
| `request-notes.spec.ts` (COLLAB01_*) | 10 passed | **10 passed** |

Both specs are in the mobile project's `testMatch` (`apps/csrm/playwright.config.ts`), and their mobile counts are above zero.

- **The mobile Risk Register pixel check held.** `risk-register-workflow.spec.ts` passed 7 / 7 on desktop and 3 / 3 on mobile in the full run, including `Bob filters the Risk Register, maintains mitigation, and Jane learns no Risk facts @journey` (the pinned header's end hairline at 768 px, stabilised in `ab23681`; cause recorded as data in `0156e81`). No alone-run and no `fix(13-19)` commit were needed.
- **Performance budgets** (`performance.spec.ts`, desktop, 11 / 11; figures from this run's `apps/csrm/.tmp/performance/baseline-desktop.json`, measured 06:29 to 06:30 UTC). Every route is within its budget; Phase 13 added no override, and the two existing overrides (`/app/questionnaires/{documentId}` 500,000; `/app/review/assessments/{documentId}` 460,000) are unchanged since `ab000f6`.

  | Route | Actor | Delivered JS bytes | Decoded | Budget | 13-18 |
  |---|---|---|---|---|---|
  | `/app` | Requestor | 235,963 | 755,543 | 300,000 | |
  | `/app/requests` | Requestor | 257,761 | 825,760 | 300,000 | |
  | `/app/requests/{documentId}` | Requestor | 280,532 | 893,088 | 300,000 | |
  | `/app/questionnaires/{documentId}` | Requestor | 360,973 | 1,232,086 | 500,000 (override) | |
  | `/app` | Security Analyst | 235,963 | 755,543 | 300,000 | |
  | `/app/review/assessments/{documentId}` | Security Analyst | 317,297 | 1,027,149 | 460,000 (override) | 317,297 |
  | `/app/risks` | Security Analyst | 269,556 | 865,773 | 300,000 | |
  | `/app/risks/{documentId}` | Security Analyst | **299,885** | 962,902 | 300,000 | 299,885 (decoded 962,902) |
  | `/app/reports/risk-exposure` | Security Analyst | 261,463 | 832,806 | 300,000 | |
  | `/app/admin/controls` | Security Analyst | 256,366 | 824,725 | 300,000 | |

  `/app/risks/{documentId}` is unchanged from 13-18 (decoded unchanged since 13-15) and keeps 115 bytes of headroom; the watch note from Phase 12 stands for Phase 14 onward.
- **Server log noise, not a failure.** The harness's Next server logged `Error: The destination stream closed early.` (digest `1439679298`) 276 times. It is the production server reporting a streamed response whose client navigated away; Phase 12's final full run logged it 154 times with 41 fewer tests, and no test failed on it. The one other server error, `Invalid Server Actions request` (digest `1384481903@E80`), is `production-hardening.spec.ts` sending a forged-origin Server Action on purpose. No connection drop to the harness's Next server occurred.

## Static checks

Each check ran against `PHASE_13_BASE=ab000f6` at `172d665` (115 commits; 285 files changed, 26,298 insertions, 932 deletions).

1. **Content-type freeze** (`git diff --name-only ab000f6..HEAD -- 'apps/backend/src/api/*/content-types/*' | LC_ALL=C sort`): exactly the three approved schema files (D-01; `docs/contract-gaps/phase-13-request-assignment.md`, `docs/contract-gaps/phase-13-request-notes.md`, approved in `ef0fcc9`). The string comparison in the plan's verify command passed.
   ```
   apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json
   apps/backend/src/api/csrm-request-note/content-types/csrm-request-note-read-state/schema.json
   apps/backend/src/api/csrm-request-note/content-types/csrm-request-note/schema.json
   ```
   The generated Strapi types changed deliberately in their own commits, as the overlay requires: `5c1302c chore(backend): regenerate Strapi content types for the request assignment` and `db1a2bc chore(backend): regenerate Strapi content types for the request notes`. They are expected, not drift.
2. **Catalogue copies** (`cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`): silent, exit 0. Both SHA-256 `cbe042a546bc83a01f539302b8b1bf693a6602d164435dea7663aabc9b9b5deb`.
3. **Keycloak-named paths** (`git diff --name-only ab000f6..HEAD | grep -i keycloak`): none (grep exit 1).
4. **Auth and identity flags in `.example` files** (`git diff ab000f6..HEAD -- '*.example'`, lines adding or removing `CSRM_AUTH_OIDC_ENABLED`, `CSRM_DEV_IDENTITY`, `IDAMBOX_KEYCLOAK_PROVISIONING` or `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION`): none; no `.example` file changed at all since the base.
5. **Manifests and lockfile** (`git diff --name-only ab000f6..HEAD -- package.json apps/csrm/package.json apps/backend/package.json pnpm-lock.yaml`, and every `**/package.json`): empty. No dependency added or removed (T-13-SC).
6. **`CSRM_AI_` source lines** (`git diff ab000f6..HEAD -- apps scripts package.json turbo.json pnpm-workspace.yaml | grep '^[+-].*CSRM_AI_'`): none (grep exit 1). No AI provider setting was added, removed or renamed.
7. **Tree after the gate commit** (`git status --short`): see the commit step; recorded in the return to the orchestrator.

The plan's Task 1 `<verify>` command is the composition of the gate and these checks; every part exited 0 in this run.

## Browser checks

Task 2, the pilot's walk on 2026-10-09 (`13-PILOT-RULINGS.md`, "The pilot's browser walk"). The paragraphs and the table below are the pilot's, verbatim, with one exception noted under the table.

**How it ran.** On the dev servers restarted at `b744ffb` with both Keycloak flags off and the deterministic provider, on a fresh copy of the development database (`apps/backend/.tmp/pilot-walk-13.db`, copied from `data.db`; the operator's database is untouched). An independent agent drove it read-only with the Playwright browser at 1440x900 and 375x812, injecting axe-core. Records: RAR-2026-W081G8 (1440) and RAR-2026-7S6GYK (375), each titled "Pilot walk 13 —". RAR-DEV-CROSS-001 and RAR-E2E-NAV-OWNER-001 were only viewed, and no UAT record was touched. Screenshots: `scratchpad\walk13\`. On every surface: zero serious or critical axe violations, no horizontal overflow (1425/1425 or 1440/1440; 360/360; 375/375 with a modal open), and only a `favicon.ico` 404 in the console.

**The development database check (Task 2 step 2): pass, on the copy.**
- The schema sync added `assigned_at` and `assignment_log` to `csrm_assessment_requests`, created `csrm_request_notes` (with `body`, `author_part`, `sequence`, `posted_at`, `changes_ai_inputs` and `ai_input_log`) and `csrm_request_note_read_states` (with `last_read_at` and `last_read_sequence`), and created the six link tables.
- The seed added Sam Analyst.
- All 12 existing requests read as not picked up, with no assignment log and no notes.
- UAT-A to UAT-C are not in this host's database (as Phase 11 recorded), so the UAT baselines stay the operator's.

| # | Check | Actor | Width | Result | Evidence |
|---|---|---|---|---|---|
| B1 | Header with "Second Security Analyst" | Sam | 375 | pass | Banner 56 px, 360/360; the tag pill (175x38) wraps to two centred lines; Menu and search intact |
| B2 | Long names in toast and history, Undo reachable | Bob | 375 | pass | The longest seeded names are 11 to 14 characters. The reassign toast wraps to 2 lines; Undo is 59x44 at y735 to 779, reached by Alt+T then Tab three times. The history wraps at 278 px. Synthetic 38 to 60 character names injected into the page also wrapped, still 360/360 |
| B3 | Composer grows to 12 rows, then scrolls | Jane | 375 | pass | (D5 nit) 76 px tall, +20 px per line, caps at 256 px and scrolls inside itself; the hint and Add note (278x44) fit |
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

**The one change to the pilot's table:** the pilot's B3 Result cell reads `pass (D5 nit)`. Here the Result cell reads `pass` and `(D5 nit)` opens the Evidence cell. The words are the same; only the cell boundary moved. The plan's Task 3 verify requires each backstop row's Result cell to be exactly `pass`, and the plan's resume signal fixes the row as `| B{n} | … | pass | {evidence} |`. Every other row is as the pilot wrote it.

All three backstops (B1 to B3) pass. Of the 28 surface rows, 23 pass (four of them with a walk defect noted: W11 D2, W15 and W16 D4, W18 D3) and 5 are issues: W4, W7 and W8 (D1), and W9 and W10 (O1).

**Walk verdict (the pilot's):** **pass after the walk fixes**. The pilot accepts the browser assertions for D1, O1 and D2 in the final gate as their re-verification.

### The walk defects and the pilot's rulings

Each defect is treated like a review Warning and fixed test-first in stage B (`13-PILOT-RULINGS.md`). **Disposition of every item below: fixed in stage B, see `13-REVIEW-DISPOSITION.md`, Pilot walk, 2026-10-09.** That record is written by the stage B fixes that follow this plan. It does not exist yet at this commit, so the commit hashes and the failing-then-passing evidence are there, not here.

- **D1 (medium), the important one:** links to `#notes` and `#assignment` do not land on their target, at either width and for every actor, so the unread flags never clear after following "1 new note" (§2.2, §12.3, §12.4, X-10, G-4, §9.2). The likely cause is the routes' `loading.tsx`, which streams the page in after the browser's hash scroll (`notes-section.tsx:58`, `assignment-block.tsx:172`). Make the target land after hydration (scroll into view once it exists, and focus as the UI-SPEC says), so read-marking then works as designed. Prove it in the browser with `toBeInViewport()` on the target after following the real link, at both widths, and that the unread figure then clears. The e2e tests that checked only the URL and `toBeVisible` cannot fail; fix them. *(Walk rows W4, W7, W8.)*
- **O1 (deviation from UI-SPEC §8.6):** another Requestor opening a request's page must get the request page's own not-found state, not the permission state; today the page renders the permission state from the request read's 403 (`requests/[documentId]/page.tsx:40`). Fix the web route so a refused or missing request on that route renders its not-found state with no notes surface, count or flag. Change the e2e expectation deliberately. The API's 403 on the v1 request read predates this phase: leave it, and add a dated note to `17-CONTEXT.md` that Phase 17's G-12 and ASSESS-22 criterion 4 ("the refusal a missing record gets, at every route, in the API and the UI") should unify the request read's API refusal for an unrelated Requestor. *(Walk rows W9, W10. Nothing leaked: no title, number or note text in the HTML.)*
- **D2 (low):** after a filtered pick-up removes the only row, focus goes to `<body>`; move it per §7.3. *(Walk row W11.)*
- **D3 (low):** the signal's note link scrolls but does not move focus to the note (§8.2). *(Walk row W18.)*
- **D4 (cosmetic):** the picker's search focus ring is clipped at the top (a 40 px input in a 36 px row inside an overflow-hidden container; `components/ui/command.tsx:70`, `:76`, shared with quick find). Fix it in the shared component, and watch the `/app/risks/{documentId}` budget, which has 115 bytes left. *(Walk rows W15, W16.)*
- **D5 (nit):** the composer's `min-h` and `max-h` leave out the 2 px border (`note-composer.tsx:177`), so it shows 2.9 and 11.9 rows; include the border. *(Walk row B3.)*
- **O2:** `request-pick-up.spec.ts:491` expects "No requests match these filters", but the heading is "No assessment requests match these filters"; the branch runs only when nothing waits. Fix the spec.
- **O3:** in a freshly loaded page, assignment times flash as "6:54 am UTC" before switching to local time. Check it against the `LocalInstant` rule (Phase 10 D-19): if the flash is the documented server-render fallback, dispose of it with that citation; if it is avoidable within the rule, fix it.

## Manual-Only

The pilot's results for 13-VALIDATION's Manual-Only items, verbatim:

- the leave prompt with unsent note text: **pass**. A `beforeunload` dialog appears on tab close at both widths and on a full navigation away; the picker's kept reason arms it too, and in-app navigation shows no dialog;
- Alt+T to the pick-up toast's Undo: **pass**, keyboard path. Alt+T focuses the toast list, then Tab reaches the toast, "Close toast", then "Undo", and Enter undoes. The region is "Notifications alt+T" with `aria-live=polite`;
- the switch's state and "Note added.": **pass**, accessible facts. The switch has role switch, `aria-checked` toggles, and its name comes from its label; "Note added." is one polite status per note;
- NVDA speech: **pending, the operator's** (no screen reader here);
- "Started by Bob Doe." while a job runs: **not seen**. The deterministic job finishes in 0.3 to 0.6 s. Sam's finished card shows "Replace questionnaire" with no job line. It is covered by the WR-601 ruling in `phase13-stageB.md`.

Notes on the two open items:
- **NVDA speech** stays pending for the operator's UAT, as in Phases 10 and 11. `13-UAT.md` records it with the other Manual-Only results (`13-PILOT-RULINGS.md` step 5).
- **"Started by Bob Doe."** The pilot's WR-601 ruling (now in `13-PILOT-RULINGS.md`, "Rulings on the review") covers it. There is no new `CSRM_AI_` setting to slow the job down. D-18 is proven instead by a Strapi integration test (a second human analyst reads and retries a job another analyst started, sees the initiator's display name and the new `canRetry` meaning, and the agent and a Requestor are refused) and by a component test of the card's "Started by {name}." copy in the running and failed states. A browser assertion is added only if the existing E2E UI-state harness can render the running card for a second analyst without new product configuration.

## Coverage

Each item below names the plans that deliver it and the tests that prove it. All of these tests ran green in Task 1's gate (web 4,205, Strapi 936, Playwright 202). Strapi tests are cited as `file › test name`. The web unit tests are under `apps/csrm/src/features/` unless a path is given. Playwright journeys are `request-pick-up.spec.ts` (REQ08_*) and `request-notes.spec.ts` (COLLAB01_*), each at 1440 and 375. Walk rows refer to the table above.

### REQ-08: pick-up, assignment and shared job access

| Criterion | Plans | API proof (Strapi) | UI proof (web unit, Playwright, walk) |
|---|---|---|---|
| (1) Pick-up, assignment, reassignment and release record actor and time, and the assignee's name shows on the request, the review queue and the dashboards | 13-01, 13-03, 13-04, 13-09, 13-12, 13-13, 13-14, 13-15, 13-17, 13-18 | `request-assignment.integration › a Security Analyst picks up a submitted request and the facts and one log event are recorded (D-05, D-09)`; `› the request read names who holds the request: the analyst view for analysts and the display name alone for the Requestor (D-09, D-16, D-17)`; `request-assignment.unit › appendAssignmentEvent appends without touching earlier events and refuses at the cap`; `review-queue-buckets.integration › each queue item names who holds it, whether the viewer may pick it up and the viewer's new notes (D-13)`; `analyst-dashboard.integration › each analyst's summary counts the requests that analyst holds, and the team's pick-up pool, each equal to its list (D-15)`; `my-requests.integration › my requests name the assigned Security Analyst and count the Requestor's new notes, equal to the summary (D-17, D-24, D-23)` | `request-assignment/assignment-history.test.tsx`, `assignment-block.test.tsx`, `queue-pick-up-button.test.tsx`, `requests/request-hub.test.tsx` (`tells the Requestor which Security Analyst holds the request, or that nobody has picked it up yet`); `REQ08_PICK_UP_FROM_QUEUE_ROW`, `REQ08_PICK_UP_FROM_REQUEST_PAGE`, `REQ08_REASSIGN_THROUGH_PICKER`, `REQ08_QUICK_FIND_NAMES_ASSIGNEE`, `REQ08_REQUESTOR_SEES_ASSIGNEE`, `REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT`; walk W3, W5, W6, W11 to W16, W19 to W22, W27, W28 |
| (2) The review queue has an "Assigned to me" view that the analyst dashboard counts | 13-12, 13-13, 13-14 | `review-queue-buckets.integration › every queue with every assignee and notes filter returns exactly the oracle's requests, with exact totals (D-13, D-24)`; `analyst-dashboard.integration › each analyst's summary counts the requests that analyst holds, and the team's pick-up pool, each equal to its list (D-15)` | `apps/csrm/src/components/shell/navigation-counts.test.ts`, `analyst-dashboard/analyst-dashboard.test.tsx`, `analyst-dashboard-presentation.test.ts`, `reports/figure-link-audit.test.ts`; `REQ08_ASSIGNED_TO_ME_VIEW`, `REQ08_HOME_COUNTS_ASSIGNED_WORK`; walk W19, W20, W25, W26 |
| (3) Any Security Analyst who may read the request can read its questionnaire and draft generation jobs | 13-08 | `questionnaire-generation.integration › mounted analysts share a request's running job and any analyst follows it by id (D-18)`; `› mounted second analyst retries Bob's failed questionnaire generation and the retry is theirs (D-18)`; `assessment-workflow.integration › mounted second analyst follows and retries Bob's failed draft job and the retry is theirs (D-18)`; `contract-catalogue.integration › Phase 13 generation job FunctionAPIs are neutral about who follows them and keep their grants (D-18)` | `assessments/questionnaire-generation-job.test.tsx`; `REQ08_COLLEAGUE_FOLLOWS_JOB`; walk: "Started by" not seen live (Manual-Only); the WR-601 proofs are added in stage B |
| (4) One analyst is accountable, and assignment does not restrict which analysts may contribute (decision 10) | 13-01, 13-03, 13-09 | `request-assignment.unit › no questionnaire, assessment, Risk or control implementation code reads the assignment policy (decision 10)`; `request-assignment.integration › two analysts picking up at once never overwrite each other: one succeeds and the other is told ASSIGNMENT_CHANGED (D-05)`; `› a stale expectedAnalyst is refused with ASSIGNMENT_CHANGED carrying only its reason (D-05)` | `request-assignment/assignment-block.test.tsx` (`names the new holder and refreshes the page at once when someone else changed the assignment first`); `REQ08_COLLEAGUE_FOLLOWS_JOB` (a colleague who does not hold the request follows the job) |
| (5) An analyst cannot pick up or be assigned a request they raised, enforced in Strapi (G-1) | 13-03, 13-04, 13-09, 13-12 | `request-assignment.integration › an analyst who raised a request is refused every assignment action on it with OWN_REQUEST (G-1)`; `› an analyst who raised a request cannot list who may hold it (OWN_REQUEST), and the Requestors and the service agent are refused (D-07)`; `› naming the service agent, an inactive analyst, the requestor or another Requestor is refused with ASSIGNEE_NOT_ELIGIBLE`; `request-assignment.unit › isEligibleAssignee holds only for an active human analyst who did not raise the request (D-06, D-07, G-1)` | `request-assignment/assignment-block.test.tsx` (`tells the analyst who raised the request why there is no control, and offers none`), `assignment-domain.test.ts` (`says why a draft or the viewer’s own request offers no action`); `REQ08_OWN_REQUEST_NO_PICK_UP`; walk W23, W24 |

### COLLAB-01: notes on a request

| Criterion | Plans | API proof (Strapi) | UI proof (web unit, Playwright, walk) |
|---|---|---|---|
| (1) Each note records author, local time and text, and notes are append-only | 13-02, 13-05, 13-06, 13-10 | `request-notes.integration › the Requestor and a Security Analyst exchange notes on a submitted request, oldest first, each unread only for the other part (D-21, D-24)`; `› two notes posted at once take sequences 1 and 2 with no duplicate (D-21)`; `› the 501st note is refused with NOTES_LIMIT_REACHED and a body over 5,000 characters or with a control character is refused with 400 (D-21)`; `› a request holding a note cannot be deleted (REQUEST_HAS_NOTES) and nothing is deleted; a request with no note still can be (D-21, T-13-22)`; `request-notes.unit › parseNoteBody trims, normalises line endings to LF, …`; `served-operations.integration` and `authorization-matrix.integration › every served operation has exactly one matrix row …` (no edit or delete route exists) | `request-notes/note-item.test.tsx` (`offers no edit or delete control (D-21)`), `notes-thread.test.tsx`, `note-composer.test.tsx`; `COLLAB01_NOTES_BETWEEN_JANE_AND_BOB`; walk W1, W2, W7 (content), W13 |
| (2) A new note is flagged on the analyst queue and the Requestor's Home until read | 13-05, 13-06, 13-10, 13-12, 13-14, 13-15 | `request-notes.unit › isUnreadNote holds only for another part's note, by someone else, above the viewer's lastReadSequence (D-24)`; `request-notes.integration › mark-read advances only forward, refuses a note from another request, keeps one row under concurrency, and no GET writes a read state (D-24)`; `› the request read carries each reader's notes summary, unread by sequence, …(D-24, D-25)`; `review-queue-buckets.integration › every queue with every assignee and notes filter returns exactly the oracle's requests, with exact totals (D-13, D-24)`; `my-requests.integration › my requests name the assigned Security Analyst and count the Requestor's new notes, equal to the summary (D-17, D-24, D-23)` | `request-notes/unread-marker.test.tsx`, `requests/request-table.test.tsx`, `home/requestor-home.test.tsx`; `COLLAB01_NEW_NOTE_FLAGGED_ON_QUEUE`, `COLLAB01_REPLY_FLAGGED_FOR_REQUESTOR`; walk W3, W5, W6, W11, W20 pass; **W4, W7, W8 issue (D1):** the flag does not clear after following the link, because the link does not land on `#notes`. Fixed in stage B; re-verified by the final gate's browser assertions |
| (3) A Security Analyst can mark a note as changing the AI inputs, and the AI context (INT-05) includes the marked notes only | 13-02, 13-05, 13-06, 13-11, 13-16, 13-17, 13-18 | `request-notes.integration › a Security Analyst marks the Requestor's note as changing the AI inputs and undoes it, one logged event per change and none for the same value (D-26)`; `› a Security Analyst may mark a note as changing the AI inputs when posting; a Requestor's mark is 400 and a requesting analyst's is OWN_REQUEST (D-26, D-07)`; `assessment-context.integration › mounted questionnaire context sends Jane's marked note as untrusted data, never Bob's unmarked reply, and keeps no note text`; `questionnaire-generation.integration › mounted questionnaire generation sends the marked note as data and its run records it without its text`; `assessment-context.unit › a context with no marked note sends no notes section and records none`; `ai-provider-guardrails.unit › a hostile marked note stays one escaped note.body value and never closes or opens a tag`; `ai-inputs-signal.unit` (7 tests) | `request-notes/note-ai-input-switch.test.tsx`, `note-composer.test.tsx` (`offers no checkbox to the Requestor or a requesting analyst`), `ai-assistance/ai-inputs-changed.test.tsx`, `ai-assistance/ai-run-sheet.test.tsx`; `COLLAB01_MARK_CHANGES_AI_INPUTS`, `COLLAB01_AI_INPUTS_CHANGED_SIGNAL`, `COLLAB01_REQUESTING_ANALYST_NO_MARK`; walk W13, W17, W18, W23 |
| (4) Another Requestor cannot list or read the notes by any route, enforced in Strapi | 13-02, 13-05, 13-10, 13-15 | the matrix rows for the four notes operations, `REQUEST_NOTES_READERS` = `{ owner: 200, other: 404, analyst: 200, serviceAgent: 404, noIdentity: 403 }` (`tests/fixtures/authorization-matrix.ts`); `request-notes.integration › another Requestor, the service agent and anyone naming a missing request get 404 on every notes route with nothing written (D-23)`; `› a participant-shaped caller who is not the requestor gets 404 on every notes route with nothing written (D-23, G-12)`; `request-notes.unit › canUseRequestNotes admits the requestor through either grant and a human Security Analyst, and no one else (D-23, G-12)`; `› summarizeRequestNotes answers null, reading nothing, for a viewer who may not use the request's notes (T-13-24)` | `request-notes/notes-section.test.tsx`, `requests/request-hub.test.tsx`; `COLLAB01_OTHER_REQUESTOR_REFUSED`, `COLLAB01_OTHER_REQUESTOR_SEES_NO_FLAG`; walk W9, W10 **issue (O1):** nothing leaks, but the page shows the permission state instead of UI-SPEC §8.6's not-found state. Fixed in stage B, with the e2e expectation changed deliberately |

### Success criteria (ROADMAP Phase 13)

| # | Criterion | Proven by |
|---|---|---|
| 1 | An analyst picks up a request from the queue, and it shows "Assigned to <name>" everywhere it appears | REQ-08 (1) and (5); D-05, D-13, D-16, D-17; `REQ08_PICK_UP_FROM_QUEUE_ROW`, `REQ08_QUICK_FIND_NAMES_ASSIGNEE`, `REQ08_REQUESTOR_SEES_ASSIGNEE`, `REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT`; walk W3, W11, W12, W21, W22 |
| 2 | "Assigned to me" is a queue view and a dashboard figure, and any analyst on the request can follow its generation jobs | REQ-08 (2) and (3); D-14, D-15, D-18; `REQ08_ASSIGNED_TO_ME_VIEW`, `REQ08_HOME_COUNTS_ASSIGNED_WORK`, `REQ08_COLLEAGUE_FOLLOWS_JOB`; walk W19, W20, W25, W26 |
| 3 | The Requestor adds a note after submission, and the analyst sees it flagged on the queue and the request | COLLAB-01 (1) and (2); D-22, D-24; `COLLAB01_NOTES_BETWEEN_JANE_AND_BOB`, `COLLAB01_NEW_NOTE_FLAGGED_ON_QUEUE`, `COLLAB01_NOTES_CLOSED_ON_RELEASED`; walk W1, W2, W11, W13 |
| 4 | The analyst replies with a note the Requestor sees; each note shows its author and local time, and another Requestor cannot read it | COLLAB-01 (1), (2) and (4); D-23, D-25; `COLLAB01_REPLY_FLAGGED_FOR_REQUESTOR`, `COLLAB01_OTHER_REQUESTOR_REFUSED`, `COLLAB01_OTHER_REQUESTOR_SEES_NO_FLAG`; walk W3, W5 to W10 (D1 and O1 are fixed in stage B) |
| 5 | A note can be marked "changes the AI inputs", which Phases 12, 15 and 16 read | COLLAB-01 (3); D-26 to D-29; `COLLAB01_MARK_CHANGES_AI_INPUTS`, `COLLAB01_AI_INPUTS_CHANGED_SIGNAL`; `CONTEXT_WIDE_AI_OPERATIONS` is the seam Phases 15 and 16 extend (below); walk W13, W17, W18 |

### Findings closed

| Finding | Closed by | Proof |
|---|---|---|
| UAT-013 (neither actor can add information after submission) | COLLAB-01; D-21 to D-29; plans 13-02, 13-05, 13-06, 13-10, 13-11, 13-12, 13-14 to 13-18 | Every `COLLAB01_*` journey at 1440 and 375; the yardstick scenario (13-CONTEXT "Specific Ideas") walked as W1 to W10, W13, W17 and W18. It closes when the stage B fixes for D1 and O1 pass the final gate |
| UAT-014 (no pick-up or assignment; jobs readable only by their initiator) | REQ-08; D-05 to D-18; plans 13-01, 13-03, 13-04, 13-07 to 13-09, 13-12 to 13-15, 13-17, 13-18 | Every `REQ08_*` journey at 1440 and 375, and `REQ08_SECOND_ANALYST_SIGN_IN` (`app-shell.spec.ts`); the scenario walked as W11 to W16 and W19 to W28 |

### Decisions D-01 to D-34

| Decision | Plans | Proof |
|---|---|---|
| D-01 Only the approved content-type changes | 13-01, 13-02 (records, approved `ef0fcc9`), 13-03, 13-05 (schemas) | Static check 1 (exactly three schema files since `ab000f6`); `request-assignment.integration › a fresh database reads every seeded request as unassigned and holds the approved columns and link tables (D-01)`; `request-notes.integration › a fresh database holds the approved notes columns and the four link tables (D-01)`; the walk's database check |
| D-02 The endpoint chain (grants, record checks, spec, parsers, matrix, served operations) | 13-03 to 13-06, 13-08, 13-12 to 13-17 | `api:check` clean; static check 2 (`cmp`); `served-operations.integration`; `authorization-matrix.integration › every served operation has exactly one matrix row …`; `contract-response-parity.test.ts` |
| D-03 The API changes, and no others | 13-03 (assignee), 13-04 (assignable analysts), 13-05 (notes list, create, read), 13-06 (AI-input mark, summary, delete and submit refusals), 13-08, 13-12, 13-14 to 13-17 (projections) | `served-operations.integration` (the inventory); the matrix's one-row-per-operation test |
| D-04 People are server projections (`documentId` and `displayName` only) | 13-03, 13-04, 13-08 | `request-assignment.integration › the Requestor's request reads carry none of the private assignment facts after a pick-up (D-04)`; `› a Security Analyst lists exactly the analysts who may hold a request, by name only and searchable (D-06)`; `request-workflow.integration` (D-04) |
| D-05 One accountable assignee, compare-and-set | 13-03, 13-09 | The race and stale-`expectedAnalyst` tests (REQ-08 (4)); `assignment-block.test.tsx`; `REQ08_PICK_UP_FROM_REQUEST_PAGE` |
| D-06 One eligibility predicate | 13-03, 13-04, 13-09 | `request-assignment.unit › isEligibleAssignee …`; `› the eligible person is active and never the Security Analyst Agent …`; `ASSIGNEE_NOT_ELIGIBLE` integration test; `request-assignment/assignment-service.test.ts`, `assign-picker.test.tsx`; walk W15 (the holder is not offered) |
| D-07 G-1 for the acting analyst | 13-03, 13-04, 13-06, 13-09, 13-11 | The `OWN_REQUEST` integration tests (assignment, eligible list, AI-input mark); `note-item.test.tsx` (`shows a requesting analyst the X-11 note on a marked note, with Sparkles, and no switch (D-07)`); `REQ08_OWN_REQUEST_NO_PICK_UP`, `COLLAB01_REQUESTING_ANALYST_NO_MARK`; walk W23, W24 |
| D-08 When the assignment can change | 13-03, 13-09 | `request-assignment.integration › a draft is refused with REQUEST_NOT_SUBMITTED …`; `› a released request can be reassigned but not unassigned … (ASSIGNMENT_REQUIRED, D-08)`; `request-assignment.unit › allowedAssignmentActions … (D-08)`; `assignment-block.test.tsx` (released, draft) |
| D-09 The history | 13-03, 13-04, 13-09 | `request-assignment.unit` log parser, reader and append tests; `› a log at its cap refuses the change with HISTORY_UNAVAILABLE and writes nothing (T-13-08)`; `assignment-history.test.tsx`; walk W15 |
| D-10 `assertAssignedAnalyst`, one predicate for Phase 17.1 | 13-01 (record), 13-03 | `request-assignment.unit › assertAssignedAnalyst holds for the current, still-eligible assignee reaching it as a human analyst (D-10)`; `› … refuses with REQUEST_UNASSIGNED (409) when nobody is assigned`; `› … refuses with NOT_ASSIGNED_ANALYST (403) another analyst, a lapsed assignee and a caller without the human grant`. It gates nothing in Phase 13 (D-10) |
| D-11 What "unassigned" means for later steps | 13-01 (record), 13-13, 13-14 (the "waiting for pick-up" pool) | Recorded for Phases 17, 17.1 and 20, with no gate added in Phase 13. The pool counts are proven by `analyst-dashboard.integration` (D-15) and walk W19 |
| D-12 This phase records; Phase 19.1 notifies | all (no notification code) | No notification entity or sender in the diff since `ab000f6`; the assignment log (D-09) and the read state (D-24) are the facts Phase 19.1 reads |
| D-13 The review queue contract | 13-12, 13-13 | `review-queue-buckets.integration` (D-13) tests above; `contract-response-parity.test.ts`; `request-table.test.tsx`; walk W11, W12, W21, W22 |
| D-14 "Assigned to me" | 13-13 | `REQ08_ASSIGNED_TO_ME_VIEW`; `apps/csrm/src/config/navigation/navigation.test.ts`, `apps/csrm/src/components/shell/navigation-counts.test.ts`; walk W19, W25, W26 |
| D-15 The analyst Home | 13-14 | `analyst-dashboard.integration … (D-15)`; `analyst-dashboard-presentation.test.ts`, `figure-link-audit.test.ts`; `REQ08_HOME_COUNTS_ASSIGNED_WORK`; walk W19, W20 |
| D-16 The analyst's request, questionnaire and assessment pages | 13-04, 13-09, 13-17, 13-18 | `request-assignment.integration … (D-09, D-16, D-17)`; `questionnaire-workflow.integration`, `assessment-workflow.integration` (D-16); `assessments/request-context-lines.test.tsx`; `REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT`; walk W13, W14, W27, W28 |
| D-17 The Requestor's surfaces | 13-04, 13-09, 13-15 | `my-requests.integration … (D-17, D-24, D-23)`; `request-hub.test.tsx`; `REQ08_REQUESTOR_SEES_ASSIGNEE`; walk W3, W5, W6 |
| D-18 Any analyst on the request follows its jobs | 13-08 | REQ-08 (3) proofs; the stage B WR-601 proofs |
| D-19 R-08-36 stays open | 13-08 (residual register line) | No shared job store in the diff; R-08-36 stays open (Notes below) |
| D-20 O-5 settled | 13-06 | `authorization.integration › D-20 an analyst submitting a draft they did not raise is refused with NOT_REQUEST_REQUESTOR, while amending it and the requestor's own submission stay allowed`; the O-5 dispositions in `08-SECURITY.md` and the residual register (13-06) |
| D-21 The note entity, append-only | 13-02, 13-05, 13-06 | COLLAB-01 (1) proofs |
| D-22 When notes can be added | 13-05, 13-10, 13-11 | `request-notes.integration › a never-submitted draft, a request returned to draft, and an approved or closed request refuse a new note with NOTES_CLOSED (D-22)`; `request-notes.unit › acceptsNotes …`; `request-notes/notes-domain.test.ts` (`says why the composer is replaced, …`), `notes-thread.test.tsx`; `COLLAB01_NOTES_CLOSED_ON_RELEASED` |
| D-23 Who reads and writes notes | 13-02, 13-05, 13-10, 13-15 | COLLAB-01 (4) proofs |
| D-24 The minimal "unseen" fact | 13-05, 13-06, 13-10, 13-12, 13-14, 13-15 | COLLAB-01 (2) proofs |
| D-25 The notes presentation baseline | 13-06, 13-10, 13-11, 13-17, 13-18 | `notes-section.test.tsx` (`tells the Requestor who reads notes … (D-25)`), `notes-domain.test.ts`, `note-item.test.tsx`; walk W1, W7, W13, W14, B3 |
| D-26 The AI-input mark is the analyst's | 13-05, 13-06, 13-11 | COLLAB-01 (3) mark proofs; `request-notes.integration › the AI-input mark is refused to the Requestor, the other Requestor, the service agent and a requesting analyst, …`; `note-item.test.tsx` (`shows the Requestor neither the switch nor the note (D-26)`) |
| D-27 What the AI reads: marked notes only | 13-16 | `assessment-context.integration`, `assessment-context.unit` (marked notes, 50-note bound, budget), `ai-provider-guardrails.unit` (hostile notes); `COVERAGE.md` |
| D-28 The run record | 13-16, 13-17, 13-18 | `ai-run.integration`, `ai-provenance.unit` (v2 summary); `ai-assistance/ai-run-sheet.test.tsx`, `ai-assistance-service.test.ts` |
| D-29 "AI inputs changed since the last generation" | 13-17, 13-18 | `ai-inputs-signal.unit` (7 tests); `request-notes.integration › the request read carries the AI-inputs signal per target to human Security Analysts only (D-29)`; `ai-inputs-changed.test.tsx`; `COLLAB01_AI_INPUTS_CHANGED_SIGNAL`; walk W17, W18 |
| D-30 The catalogue, both copies byte-identical | 13-01 to 13-06, 13-08, 13-12 to 13-17 | Static check 2 (`cmp`, SHA-256 `cbe042a5…`); `contract-catalogue.integration` |
| D-31 Sam Analyst, development and E2E only, with no Keycloak subject | 13-07 | `second-analyst-seed.integration` (3 tests, T-13-25, T-13-26); `apps/csrm/src/lib/auth/sign-in-page.test.tsx` (`offers the four fixture identities, Second Security Analyst after Security Analyst (D-31, UI-D26)`), `apps/csrm/src/components/shell/role-switcher.test.tsx`; `REQ08_SECOND_ANALYST_SIGN_IN`; static check 3; walk B1, W20, W25 to W28 |
| D-32 How the phase is proved | all | Every behaviour above has a test at its seam; the matrix rows; the Playwright journeys at 1440 and 375; Task 1's gate |
| D-33 Plan shape | all; 13-19 the last | Wave 1 records with their approval checkpoints, then one plan per wave; Task 1's gate on the production build with a clean tree; this walk |
| D-34 UI values come only from the design direction | 13-01 (X-15 to X-18), 13-09, 13-10, 13-11, 13-18 | `design-system-conformance.spec.ts`, `apps/csrm/src/lib/performance/interface-copy-guard.test.ts`; walk: zero serious or critical axe violations and no overflow on every surface |

### The authorisation table's negative cases (13-CONTEXT "Authorisation Model")

| Case | API proof | UI proof |
|---|---|---|
| Another Requestor lists, reads, adds or marks read the notes of Jane's request | Matrix `other: 404` on the four notes rows; `request-notes.integration › another Requestor, the service agent and anyone naming a missing request get 404 on every notes route with nothing written (D-23)` | `COLLAB01_OTHER_REQUESTOR_REFUSED`, `COLLAB01_OTHER_REQUESTOR_SEES_NO_FLAG`; `notes-section.test.tsx`; walk W9, W10 (O1: not-found state, fixed in stage B) |
| A participant who is not the requestor uses any notes route | `request-notes.integration › a participant-shaped caller who is not the requestor gets 404 on every notes route with nothing written (D-23, G-12)`; `request-notes.unit › a participant who is not the requestor never reaches notes, …` | No participant view exists before Phase 17 |
| A Requestor calls the assignment operation, the eligible list or the AI-input mark | `request-assignment.integration › the Requestor, the other Requestor, the service agent and an inactive analyst are refused by grant before anything is written`; `› … the Requestors and the service agent are refused (D-07)`; the AI-input refusal test (D-26) | `assignment-block.test.tsx` (`renders nothing for the Requestor’s view, …`); `note-item.test.tsx` (`shows the Requestor neither the switch nor the note (D-26)`) |
| A Requestor's note create carries the AI-input mark | `request-notes.integration › … a Requestor's mark is 400 and a requesting analyst's is OWN_REQUEST (D-26, D-07)` | `note-composer.test.tsx` (`offers no checkbox to the Requestor or a requesting analyst`) |
| The service agent calls assignment, the eligible list or the AI-input mark | The grant-refusal tests above (403, the human-only set); `request-assignment.unit › the eligible person is active and never the Security Analyst Agent …` | Not applicable (no web session) |
| The service agent uses a notes route on another person's request | Matrix `serviceAgent: 404`; the D-23 refusal test above | Not applicable |
| The service agent, an inactive user, a Requestor-only user or the request's requestor is named as assignee | `request-assignment.integration › naming the service agent, an inactive analyst, the requestor or another Requestor is refused with ASSIGNEE_NOT_ELIGIBLE` | `assign-picker.test.tsx` (the picker lists only the server's eligible list); walk W15 |
| An analyst who raised the request acts on its assignment, eligible list or AI-input mark | The three `OWN_REQUEST` integration tests (REQ-08 (5), D-26) | `assignment-block.test.tsx` (`tells the analyst who raised the request why there is no control, and offers none`); `REQ08_OWN_REQUEST_NO_PICK_UP`, `COLLAB01_REQUESTING_ANALYST_NO_MARK`; walk W23, W24 |
| A stale assignment | `› a stale expectedAnalyst is refused with ASSIGNMENT_CHANGED carrying only its reason (D-05)`; the race test | `assignment-block.test.tsx` (`names the new holder and refreshes the page at once …`) |
| An assignment change on a draft | `› a draft is refused with REQUEST_NOT_SUBMITTED …` | `assignment-block.test.tsx` (`says a draft keeps its assignment until it is resubmitted, and offers no control`) |
| Unassigning a released or closed request | `› a released request can be reassigned but not unassigned … (ASSIGNMENT_REQUIRED, D-08)` | `assignment-block.test.tsx` (`shows a released request held by the viewer with no Return to queue (D-08)`); `queue-pick-up-button.test.tsx` (`offers no Undo on a released request, …`) |
| A note on a draft, released or closed request | `request-notes.integration › … refuse a new note with NOTES_CLOSED (D-22)` | `notes-domain.test.ts`, `notes-thread.test.tsx`; `COLLAB01_NOTES_CLOSED_ON_RELEASED` |
| Editing or deleting a note | No such route: `served-operations.integration` and the matrix | `note-item.test.tsx` (`offers no edit or delete control (D-21)`) |
| Deleting a request that holds a note | `request-notes.integration › a request holding a note cannot be deleted (REQUEST_HAS_NOTES) …`; `› a delete and a note create started together leave no orphan …` | Not applicable (no web caller) |
| An analyst submits a draft they did not raise | `authorization.integration › D-20 an analyst submitting a draft they did not raise is refused with NOT_REQUEST_REQUESTOR, …` | Not offered |
| A Requestor or the service agent reads or retries a generation job by id | The matrix's changed by-id job rows; `contract-catalogue.integration … (D-18)`; the stage B WR-601 test adds the refusal assertions beside the second analyst's success | Not applicable |
| No identity, or no token | The matrix's `noIdentity` and `noToken` columns on every new row, per its conventions | The sign-in path |

### `assertAssignedAnalyst` for Phase 17.1

`assertAssignedAnalyst` (`apps/backend/src/api/csrm-assessment-request/services/request-assignment-policy.ts`, with `REQUEST_UNASSIGNED` and `NOT_ASSIGNED_ANALYST`) is built and unit-tested, and gates nothing in Phase 13 (D-10). Its unit tests are in `apps/backend/tests/request-assignment.unit.test.ts`:
- `assertAssignedAnalyst holds for the current, still-eligible assignee reaching it as a human analyst (D-10)`;
- `assertAssignedAnalyst refuses with REQUEST_UNASSIGNED (409) when nobody is assigned`;
- `assertAssignedAnalyst refuses with NOT_ASSIGNED_ANALYST (403) another analyst, a lapsed assignee and a caller without the human grant`.

Phase 17.1 reuses it for Mark reviewed, Submit final assessment, recall, and release and close (G-13; ASSESS-24 criterion 5; ASSESS-25 criterion 4). It adds the mounted tests for those steps, and the matrix rows for `REQUEST_UNASSIGNED` and `NOT_ASSIGNED_ANALYST`, when it wires the predicate in.

## Notes for the orchestrator

- **`CONTEXT_WIDE_AI_OPERATIONS`** (`apps/backend/src/csrm/ai/ai-inputs-signal.ts`) is the list of AI operations whose completed run moves the "AI inputs changed" baseline: `questionnaire-generation` and `assessment-draft`. When Phases 15 and 16 add context-wide operations (follow-up questions, draft revision), they extend this list, and `ai-inputs-signal.unit.test.ts`'s `only context-wide runs move a baseline …` test with it. A risk-scoped operation must never join it (T-13-56).
- **`isEligibleAssignee`** (`apps/backend/src/api/csrm-assessment-request/services/request-assignment-policy.ts`, line 43) is the one eligibility predicate (D-06). Phase 17's G-11 exclusion adds "not a named risk owner or executive approver" there, and only there, so the picker, the assignment operation and `assertAssignedAnalyst` all follow (17-06).
- **R-08-36 and R-08-37 stay open.** Jobs remain process-local, and Phase 13 widened who may follow them without a storage change (D-19; persisted history is Phase 21's, DASH-04). The PostgreSQL proof of the request row lock remains R-08-37's; the stage B WR-201 ruling adds a dated line to `docs/security/phase-08-residual-risks.md`.
- **Requirements are not marked here.** REQ-08 and COLLAB-01 are marked complete in the phase-close bookkeeping step (`13-PILOT-RULINGS.md` step 7), after the walk fixes, `verify:post`, the verifier and the final gate.
- **What comes next is stage B, in the rulings' order** (`13-PILOT-RULINGS.md`): the review and walk fixes (D1 to D5, O1 to O3, recorded in `13-REVIEW-DISPOSITION.md` under "Pilot walk, 2026-10-09"); regression; `verify:post`; the verifier; `13-UAT.md` (including the NVDA item pending for the operator); then the final full gate, appended to this file as `## Phase gate (final run, after the code review)`, with the static checks against `ab000f6`.
- **Watch item:** `/app/risks/{documentId}` has 115 bytes of budget headroom. D4's fix to the shared `components/ui/command.tsx` must stay inside it.

## Deviations from Plan

- **Task 1:** none. The gate passed on its first full run, so no alone-run, fix commit or second full run was needed.
- **Task 2:** the pilot walked on a copy of the development database (`pilot-walk-13.db`), not on the operator's `data.db`, and restarted the servers at `b744ffb`, a later commit than the gate that changes no code. Both are within the plan's step 1 ("or a later commit that changes no code") and step 10 (no operator data changed).
- **Task 3, B3's cell:** the backstop row's `(D5 nit)` moved from the Result cell to the head of the Evidence cell (see under the table), so that the plan's verify, which requires `| pass |` in each backstop row, holds. No words changed.
- **Task 3, walk issues recorded as issues:** W4, W7 to W10 are recorded as the pilot wrote them (issue), not as pass. The plan's verify checks only that no backstop row is an issue. These five rows close through the stage B fixes and the final gate, per the pilot's verdict.

## Self-Check: PASSED

- Files: `13-19-SUMMARY.md`, `COVERAGE.md` and `13-PILOT-RULINGS.md` exist in the phase directory.
- Commits: `fe0a405` (Task 1), `172d665` (the gate's commit), `ef0fcc9` (the approvals), and the orchestrator's `b744ffb`, `2082f20` and `3e28886` exist.
- Task 3's `<verify>` command exits 0. The walk table matches the pilot's line for line, except B3's cell boundary (see under the table). "How it ran", the database check and the Manual-Only results match the pilot's text.

## Phase gate (final run, after the code review)

Run by the stage B worker on 2026-10-10 from 01:13 to 01:59 (+11:00) at `4d5e54c`. These steps came first:
- **The code review.** `13-REVIEW.md` had 60 findings, all dispositioned in `13-REVIEW-DISPOSITION.md`, with the pilot's walk items D1 to D5 and O1 to O3 under "Pilot walk, 2026-10-09".
- **The regression gate on `ecfea90`.** Web 4,272 tests in 194 files, typecheck and lint clean, Strapi 947 passed and 0 failed. The eight specs stage B touched passed 115 (desktop 83, mobile 32), 0 flaky.
- **`verify:post`.** `13-SECURITY.md` is SECURED, with 66 of 66 threats closed after T-13-F1 (`e225f02`, `111732e`). `13-VALIDATION.md` is validated and Nyquist-compliant. `13-UI-REVIEW.md` scored 18/24, with `13-UI-REVIEW-DISPOSITION.md`.
- **The verification.** `13-VERIFICATION.md` has `status: human_needed`, `score: "5/5 roadmap success criteria verified (code unchanged since 69d9aec; re-verified at HEAD 1b9e55c); 2/2 requirements implementation-satisfied; 0 gaps; 2 operator checks remain"`.
- **The UAT.** `13-UAT.md` is complete.

The gate ran from the repository root with Node v24.19.0 and pnpm 11.24.0. The tree was clean before the run, and ports 1337 and 3000 were free before the run, before the Strapi suite and before Playwright. No dev server ran. It was one full run with the suites one at a time, and every figure below comes from it. `PHASE_13_BASE=ab000f6`.

| Gate | Command | Result | Duration | First gate (`fe0a405`/`172d665`) |
|---|---|---|---|---|
| `api:check` | `pnpm --dir apps/csrm api:check`, then `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` | clean; nothing left modified | 2 s | clean |
| Typecheck | `pnpm --dir apps/csrm typecheck` | clean | 5 s | clean |
| Lint | `pnpm --dir apps/csrm lint` | clean | 4 s | clean |
| Web (Vitest) | `pnpm --dir apps/csrm test` | **Test Files 194 passed (194), Tests 4,282 passed (4,282)**. No `EPERM: rename` and no rerun | 58 s (Vitest 56.9 s) | 4,205 / 4,205 (190 files) |
| Strapi (node:test) | `pnpm --dir apps/backend test` | **ℹ tests 949, ℹ pass 949, ℹ fail 0**. Cancelled 0, skipped 0, todo 0 | 18.5 min (duration_ms 1,103,377) | 936 / 936 |
| Playwright (production build, both projects) | `pnpm --dir apps/csrm test:e2e` | **202 passed**: desktop **156 / 156**, mobile **46 / 46**. 0 failed, **0 flaky**, 0 skipped, 0 did not run (202 tests, 1 worker) | 25.1 min | 202 passed: desktop 156, mobile 46, 0 flaky |
| Tree | `git status --short` | empty: the run modified no tracked file (Phase 8 D-12, G-6) | | empty |

The lint and typecheck scripts in `apps/csrm/package.json` are the same command (`next typegen && tsc --noEmit`). This is recorded as observed, not changed.

Phase 13's journeys in that run:

| Spec | Desktop | Mobile |
|---|---|---|
| `request-pick-up.spec.ts` (REQ08_*) | 10 passed | **10 passed** |
| `request-notes.spec.ts` (COLLAB01_*) | 10 passed | **10 passed** |

Both specs are in the mobile project's `testMatch` (`apps/csrm/playwright.config.ts`), and their mobile counts are above zero.

**The walk defects' browser re-verification (the pilot's ruling).** Every test named in the "browser" rows of `13-REVIEW-DISPOSITION.md` for D1, O1 and D2 passed in this run, at 1440 (desktop) and at 375 (mobile) where the test runs on both:
- **D1 (browser re-verification):** all passed on desktop and mobile:
  - `request-notes.spec.ts :: COLLAB01_NOTES_BETWEEN_JANE_AND_BOB`;
  - `request-notes.spec.ts :: COLLAB01_REPLY_FLAGGED_FOR_REQUESTOR`;
  - `request-notes.spec.ts :: COLLAB01_NEW_NOTE_FLAGGED_ON_QUEUE`;
  - `request-pick-up.spec.ts :: REQ08_ASSIGNEE_ON_QUESTIONNAIRE_AND_ASSESSMENT`.

  Each landing on `#notes` or `#assignment` is checked by `expectLandedOn`.
- **D2 (browser proof):** `request-pick-up.spec.ts :: REQ08_PICK_UP_FROM_QUEUE_ROW` passed on desktop and mobile. Focus is on the filtered empty state after the pick-up.
- **O1 (browser expectations):** all passed:
  - `assessment-navigation-lifecycle.spec.ts :: assessment navigation gives both actors lifecycle context and keeps an unrelated Requestor denied @journey` (the `D18_REQUEST_NOT_FOUND_*` assertions), on desktop and mobile;
  - `accessibility.spec.ts :: has no axe violations for the Secondary Requestor lists and the denials of another Requestor’s records` ("Secondary Requestor on Jane’s request", at 1440 and 375 within the desktop test);
  - `request-notes.spec.ts :: COLLAB01_OTHER_REQUESTOR_REFUSED`, on desktop and mobile.

**Performance budgets.** `performance.spec.ts` passed 11 / 11 on desktop. The figures come from this run's `apps/csrm/.tmp/performance/baseline-desktop.json`, measured 14:52:03 to 14:52:43 UTC. Every route is within its budget. `git diff ab000f6..HEAD -- apps/csrm/e2e/performance.spec.ts` is empty, so Phase 13 added no override. The two existing overrides are unchanged.

| Route | Actor | Delivered JS bytes | Decoded | Budget | First gate (`172d665`) |
|---|---|---|---|---|---|
| `/app` | Requestor | 226,540 | 728,489 | 300,000 | 235,963 |
| `/app/requests` | Requestor | 248,338 | 798,706 | 300,000 | 257,761 |
| `/app/requests/{documentId}` | Requestor | 272,530 | 870,241 | 300,000 | 280,532 |
| `/app/questionnaires/{documentId}` | Requestor | 351,809 | 1,205,988 | 500,000 (override) | 360,973 |
| `/app` | Security Analyst | 226,540 | 728,489 | 300,000 | 235,963 |
| `/app/review/assessments/{documentId}` | Security Analyst | 311,304 | 1,010,332 | 460,000 (override) | 317,297 |
| `/app/risks` | Security Analyst | 259,450 | 838,911 | 300,000 | 269,556 |
| `/app/risks/{documentId}` | Security Analyst | **289,778** | 936,040 | 300,000 | 299,885 |
| `/app/reports/risk-exposure` | Security Analyst | 252,040 | 805,752 | 300,000 | 261,463 |
| `/app/admin/controls` | Security Analyst | 246,943 | 797,671 | 300,000 | 256,366 |

`/app/risks/{documentId}` is 289,778. It was 289,776 after the UI review fixes, a difference of 2 bytes. It keeps 10,222 bytes of headroom, against 115 at the first gate. The file also holds a `/app/review` entry measured on 2026-10-02. That entry is not from this run, as at the first gate, so it is left out of the table.

**Server log noise, not a failure.** The harness's Next server logged `Error: The destination stream closed early.` (digest `1439679298`) 283 times, against 276 at the first gate. It is the production server reporting a streamed response whose client navigated away, and no test failed on it. The only other server errors are 3 `Invalid Server Actions request` lines (digest `1384481903@E80`) and 1 `The Server Reference ID did not match the expected format` line. All four come from `production-hardening.spec.ts :: a cross-origin Server Action request is refused before any action runs`, which sends forged-origin and unknown-ID Server Actions on purpose (statuses: fetch foreign 500, same-origin 404; form foreign 500, same-origin 303). No connection to the harness's Next server dropped.

### Static checks against ab000f6

At `4d5e54c`: 223 commits; 318 files changed, 32,247 insertions, 1,101 deletions. The commands are those of `## Static checks` above.
1. **Content-type freeze:** exactly the three approved schema files (`csrm-assessment-request`, `csrm-request-note`, `csrm-request-note-read-state`).
2. **Catalogue copies:** `cmp` was silent (exit 0). Both SHA-256 values are `bf88cde8bb7c2d26a768449ffe2eff26420b707c38d94fd916ddfac6d260edf6`. The hash changed from the first gate's through `ac8425b`, IN-102's catalogue design note, which went to both copies.
3. **Keycloak-named paths:** none (grep exit 1).
4. **Auth and identity flags in `.example` files:** none. No `.example` file changed since the base.
5. **Manifests and lockfile:** none changed (grep exit 1). No dependency was added or removed.
6. **`CSRM_AI_` source lines:** none changed (grep exit 1).
7. **Tree after the gate:** `git status --short` is empty.

**The tree after the gate.** `git status --short` printed nothing after the Strapi suite, after Playwright and before this record's commit. The run left no operator item and no modified generated file.
