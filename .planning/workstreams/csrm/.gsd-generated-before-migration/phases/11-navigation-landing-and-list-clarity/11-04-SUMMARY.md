---
phase: 11-navigation-landing-and-list-clarity
plan: 04
subsystem: ui
tags: [navigation, page-headings, route-titles, copy, nextjs, vitest, playwright]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-02: Home at /app and the Home item; 11-03: Go to Home recovery copy, the Requests error boundary in the copy guard, the Risk detail body ready for its casing change"
  - phase: 10-existing-flow-gap-closure
    provides: "10-02: the analyst route gates and refusal copy in assessment-detail, questionnaire-review, assessment-editor, questionnaire-detail, released-assessment and risk-details"
provides:
  - "src/config/navigation/page-headings.ts: pageHeadings (one heading per navigation destination), PageHeadingKey, routeTitle(heading) -> '{heading} | IdamBox CSRM'"
  - "every navigation label reads pageHeadings, or for Reference data administrationConfig[kind].pluralLabel (D-09)"
  - "the PageHeader title and metadata title of /app, /app/requests, /app/requests/new, /app/questionnaires, /app/assessments, /app/review/requests, /app/review/questionnaires, /app/review/assessments and /app/risks read the same entry; Alerts, Reports and Home headers read theirs"
  - "My requests' description 'Requests you raised, and what happens next on each.' in src/features/requests/my-requests-copy.ts, shared by the page and both boundaries"
  - "every loading and error boundary that repeats its page header reads its pageHeadings entry"
  - "UI-SPEC §2.2 Risk register sentence case and §2.3 page names in gates, refusals and the My questionnaires empty action"
  - "UX07_LABEL_EQUALS_HEADING in navigation-and-home.spec.ts (desktop, outside @journey)"
affects: [11-05, 11-06, 11-09, 11-10, 11-11, 11-12, 11-13, 11-14, 11-21]

actuals:
  tokens: 9762
  tasks: 3
  commits: 5
plan_head_before: da0976a25d51ac148c169136b1ecef2034898c7c
plan_head_after: eb4ffa02a80134f7a3301fe929956f43ad60cb09

tech-stack:
  added: []
  patterns:
    - "A navigation destination's heading lives once in pageHeadings; the nav label, PageHeader title, boundaries and routeTitle() read it, so they cannot drift"
    - "Copy shared by a server page and its client boundaries lives in a plain module (no 'use client'), so both read the string itself"

key-files:
  created:
    - apps/csrm/src/config/navigation/page-headings.ts
    - apps/csrm/src/config/navigation/navigation.test.ts
    - apps/csrm/src/config/navigation/page-boundaries.test.tsx
    - apps/csrm/src/features/requests/my-requests-copy.ts
  modified:
    - apps/csrm/src/config/navigation/navigation.ts
    - apps/csrm/app/(app)/app/requests/page.tsx
    - apps/csrm/app/(app)/app/risks/page.tsx
    - apps/csrm/src/features/assessments/assessment-list.tsx
    - apps/csrm/src/features/risks/risk-register.tsx
    - apps/csrm/src/features/risks/risk-details.tsx
    - apps/csrm/e2e/navigation-and-home.spec.ts
    - apps/csrm/e2e/accessibility.spec.ts
    - apps/csrm/e2e/production-hardening.spec.ts

key-decisions:
  - "11-04: Reference data labels read administrationConfig[kind].pluralLabel directly; their headings and generateMetadata titles already read the same field, so they are left as they were"
  - "11-04: My requests' new description lives in features/requests/my-requests-copy.ts, a plain module, because request-table.tsx is a client module and a string exported from it reaches a server page as a client reference"
  - "11-04: UX07_LABEL_EQUALS_HEADING runs at 1440 only, outside the @journey describe, because the sidebar shows from 1024px; it reads every visible Primary navigation link's text and href, clicks it from /app, and asserts the main h1 text and the title"
  - "11-04: the Requests and Risk assessments error boundaries keep their own descriptions ('We couldn't load …'); only their headings change, as the plan says"
  - "11-04: accessibility.spec.ts splits requestQueueTitle ('Requests | IdamBox CSRM') from a new requestHubTitle that keeps the hub's static detail title (UI-D40)"
  - "11-04: UX-07 stays open: requirements.ready-ids reports 0/1 ready, because later Phase 11 plans also declare it"

patterns-established:
  - "Page names: a navigation label, the page's h1, its boundaries and its route title are one pageHeadings string; copy that sends a person to a page names it in that casing (UI-D1)"

requirements-completed: []

coverage:
  - id: D1
    description: "Every navigation label equals the level-one heading of the page it opens, and the route title is '{heading} | IdamBox CSRM', for the Requestor and the Security Analyst"
    requirement: "UX-07"
    verification:
      - kind: unit
        ref: "apps/csrm/src/config/navigation/navigation.test.ts (page headings; navigation labels equal their page headings)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#UX07_LABEL_EQUALS_HEADING ([desktop] 1440)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each destination's loading and error boundaries repeat the renamed heading; My requests' boundaries repeat its new description"
    requirement: "UX-07"
    verification:
      - kind: unit
        ref: "apps/csrm/src/config/navigation/page-boundaries.test.tsx (14 boundaries, description, New request loading label, Risk register error)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Visible Risk register strings in sentence case; non-visible accessible names kept (UI-SPEC §2.2, UI-D37)"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-register.test.tsx; risk-register-page.test.tsx; risk-details.test.tsx"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/risk-register-workflow.spec.ts (detail refusal, [desktop] and [mobile]); accessibility.spec.ts Requestor /app/risks refusal"
        status: pass
    human_judgment: false
  - id: D4
    description: "Gates, refusals and the My questionnaires empty action name pages by their headings (UI-SPEC §2.3)"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/analyst-route-gate.test.tsx; released-assessment.test.tsx; questionnaire-workflow.test.tsx"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts (UX06 gate links, case-insensitive)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Browser suites assert the new headings, titles and labels, and every journey passes"
    verification:
      - kind: e2e
        ref: "pnpm --dir apps/csrm test:e2e (full suite, 99 passed: desktop 90, mobile 9)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Long page header strings wrap and header actions stack full width below 768px"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/navigation-and-home.spec.ts#the Requestor signs in to Home with New request in its header ([mobile] 375, action spans the header)"
        status: pass
    human_judgment: true
    rationale: "The stacking rule is the existing globals.css .page-header rule, proved for the Home header only; the renamed headings are short, and wrapping of the other headers at intermediate widths is not asserted"

duration: 58min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 04: Every page is named by the label that opens it Summary

**One heading string per navigation destination (`page-headings.ts`) now feeds the sidebar label, the page's level-one heading, its loading and error boundaries and its route title, so "Requests" opens "Requests" (titled "Requests | IdamBox CSRM"). The Risk register reads in sentence case wherever it is visible text, and every gate, refusal and empty action names its page by that heading.**

## Performance

- **Duration:** 58 min (wall clock, including three Playwright runs and the full web suite)
- **Started:** 2026-10-03T02:31:36Z
- **Completed:** 2026-10-03T03:29:10Z
- **Tasks:** 3 of 3
- **Files changed:** 59 (4 created, 55 modified, none deleted)

## Accomplishments

- `pageHeadings` holds `Home`, `My requests`, `New request`, `My questionnaires`, `My risk assessments`, `Requests`, `Questionnaires`, `Risk assessments`, `Risk register`, `Alerts` and `Reports`. `routeTitle(heading)` returns `{heading} | IdamBox CSRM`.
- Every `navigation` label reads `pageHeadings`, and the four Reference data labels read `administrationConfig[kind].pluralLabel`.
- The pages and their titles:
  - `/app/requests` is `My requests`, with the description `Requests you raised, and what happens next on each.`
  - `/app/requests/new` is `New request` (it was `New assessment request`, titled `New Request`).
  - `/app/questionnaires` is `My questionnaires`, and `/app/assessments` is `My risk assessments`.
  - `/app/review/requests` is `Requests`, `/app/review/questionnaires` is `Questionnaires` (all three `PageHeader`s), and `/app/review/assessments` is `Risk assessments`.
  - `/app/risks` is `Risk register`.
  - Home, Alerts and Reports read their entries. Their strings and titles are unchanged.
- The boundaries:
  - Each loading and error boundary that repeats its page header reads its entry: `requests/`, `requests/new/loading`, `questionnaires/`, `assessments/`, `review/requests/error`, `review/questionnaires/`, `review/assessments/error` and `risks/`.
  - `review/requests/loading` and `review/assessments/loading` already used the shared list headers, so they follow without an edit.
  - The New request form now loads as `Loading new request`.
- §2.2 (Risk register in sentence case) covers the permission area, the invalid-filter heading, the error noun, the filter sheet title, the error boundary heading and the Risk detail refusal. `Risk Register results` and `Loading Risk Register` keep their wording, as UI-D37 says.
- §2.3 (page names in copy):
  - `Go to My requests`, `Go to My questionnaires` and `Go to My risk assessments`, each with its gate body.
  - `Yours are listed in My questionnaires.` and `Yours are listed in My risk assessments.`
  - `View My requests` on the My questionnaires empty state.
- Detail headings, safe-state headings, static detail titles and back links are unchanged (UI-D40).

## Task Commits

1. **Task 1: One heading per page feeds the label, the heading and the title (tracer, TDD)**
   - `f5bb8c7`: test(11-04), RED
   - `e3aedc7`: feat(11-04), GREEN
2. **Task 2: Boundaries and the copy that names pages follow the headings (TDD)**
   - `6aad816`: test(11-04), RED
   - `ab4e362`: feat(11-04), GREEN
3. **Task 3: Move the browser assertions to the new headings and labels, then run every journey**
   - `eb4ffa0`: test(11-04)

The ledger count is `git rev-list --count da0976a..eb4ffa0` = 5. All five commits end with the required `Co-Authored-By` trailer, checked with grep.

## TDD Gate Compliance

- **Task 1:** RED `f5bb8c7` comes before GREEN `e3aedc7`.
  - `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed) for `mobile-navigation.test.tsx`, "shipped Home navigation > shows the analyst Home and the three review queues, with no Analyst dashboard link". The labels were still `Assessment Requests` and `Risk Assessments`.
  - The RED run failed 15 of 58 tests. 14 failed on assertions about the renamed labels. `navigation.test.ts` failed at import, as expected, because `page-headings.ts` did not exist yet.
- **Task 2:** RED `6aad816` comes before GREEN `ab4e362`.
  - `RED_EVIDENCE_OK` for `page-boundaries.test.tsx`, "route boundaries repeat the page heading (UI-SPEC §2.1) > review/requests/error is headed with its navigation label". It found `Assessment Request Review`.
  - The RED run failed 33 of 143 tests, every one on an assertion about copy or a heading.
- As in 11-01 to 11-03, the gsd-core JUnit parser needs `name` before `classname`. The evidence was checked against copies in the scratchpad with the attributes reordered. Nothing in the repository changed.
- No refactor commit was needed.
- **Tracer feedback gate (Task 1):** the run was interactive, in end-of-phase mode, with an automated-only verify. The full Task 1 verify command was re-run after the GREEN commit and passed (below), and Task 2 started only after that.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED (`src/config/navigation`, `mobile-navigation.test.tsx`, `navigation-guard.test.tsx`) | 15 failed, 43 passed (58); `navigation.test.ts` failed at import |
| Task 1 GREEN, full web suite before commit | 137 files, 2,883 tests: 2 failed on `My Questionnaires` nav-link names (deviation 2), then fixed |
| Task 1 GREEN (navigation, home, shell, navigation-guard, dashboard, questionnaires) | 21 files, 359/359; typecheck clean |
| Task 1 Playwright `navigation-and-home.spec.ts` | 11 passed (desktop 6, mobile 5), 0 failed, 0 flaky, 0 skipped; 1.4 min. `git status` showed nothing the run changed |
| Tracer re-run of the Task 1 verify command | 10/10; typecheck clean; Playwright 11 passed (desktop 6, mobile 5); 1.3 min |
| Task 2 RED (the seven files in the commit) | 33 failed, 110 passed (143) |
| Task 2 GREEN verify (`risks`, `questionnaires`, `assessments`, `requests`, `config/navigation`, copy guard) | 49 files, 921/921; typecheck clean |
| Full web suite (`pnpm --dir apps/csrm test`) | 138 files, 2,900/2,900 |
| Task 3 changed specs (the plan's seven, plus `design-system-conformance` and `risk-register-workflow`) | 57 passed (desktop 56, mobile 1), 0 failed, 0 flaky, 0 skipped; 10.9 min. `git status` and the diff hash were identical before and after |
| **Full Playwright suite** (`pnpm --dir apps/csrm test:e2e`, production build) | **99 passed: desktop 90, mobile 9; 0 failed, 0 flaky, 0 skipped; 16.5 min** (03:08:37Z to 03:25:08Z). `git status --short` was identical before and after the run |
| `lint` (`next typegen && tsc --noEmit`) | clean |
| `api:check` | exit 0; `schema.d.ts` unchanged after `git update-index --refresh` (no contract change) |

The Strapi suite was not run, because this plan changes no Strapi file.

## E2E Assertions Changed

Listed in the plan:
- **E10:**
  - `accessibility.spec.ts`: the `myRequests`, `newRequest`, `myQuestionnaires`, `myAssessments` and `riskRegister` expectations; `requestQueueTitle` and `requestQueueHeading` (`Requests`); the Requestor refusal rows for `/app/risks`, `/app/review/questionnaires` and `/app/review/assessments`; the analyst list rows for `/app/review/questionnaires` and `/app/review/assessments`.
  - `performance.spec.ts`: the `/app/requests` and `/app/risks` rows.
  - `production-hardening.spec.ts`: `personalSteps`; the list rows for `/app/review/requests`, `/app/review/questionnaires`, `/app/review/assessments` and `/app/risks`; the `/app/risks` refusal; the client-side navigation to the Risk register.
  - The detail rows stay, as the plan says.
- **E11:**
  - `questionnaire-workflow.spec.ts` (today's line 357) and `analyst-insights.spec.ts:520` now expect the level-one `Questionnaires`, exact.
  - `assessment-release-workflow.spec.ts:118` now expects the level-one `Requests`, exact.
  - These became exact, level-one matches because a non-exact `Requests` or `Questionnaires` could also match other headings on the page.
- **E12:** the exact `Assessment Requests` link is now `{ name: 'Requests', exact: true }` at `analyst-insights.spec.ts:485`, `assessment-release-workflow.spec.ts:113` and `questionnaire-generation-workflow.spec.ts:91, 245`. No exact `Risk Assessments` link existed.
- **New:** `navigation-and-home.spec.ts` has `UX07_LABEL_EQUALS_HEADING`. The redirect test's queue heading is now `Requests`.

Changed beyond the plan's list:
- `accessibility.spec.ts`:
  - A new `requestHubTitle` keeps the request hub's static detail title (`Assessment Request Review | IdamBox CSRM`). Before, the hub read `requestQueueTitle`, which now names the list.
  - The 375 filter sheet name is now `Risk register filters`. It matched case-insensitively before, so this only follows the new casing.
- `design-system-conformance.spec.ts:858`: `New assessment request` → `New request`, exact. The old string is not a substring of the new heading, so the test would have failed.
- `risk-register-workflow.spec.ts:708`: `detailDenialCopy` is matched with `exact: true`, so it is now `You don’t have permission to view the Risk register`.
- Non-exact, case-insensitive matches stay as they were (§14.4), for example `My Requests`, `Go to My Questionnaires` and `Risk Register filters` in the requestor, questionnaire and risk register journeys.

Unit assertions changed beyond the plan's list:
- `mobile-navigation.test.tsx`: the nav labels `Requests`, `Risk assessments` and `My risk assessments`.
- `navigation-guard.test.tsx`: the `My requests` link.
- `requestor-dashboard.test.tsx:121, 126` and `questionnaire-workflow.test.tsx:363, 365`: the `My questionnaires` nav link.
- `risk-register-page.test.tsx`: the §2.2 permission and invalid-filter strings.
- `questionnaire-workflow.test.tsx`: a new assertion on the questionnaire refusal copy.

## Files Created/Modified

- Created:
  - `src/config/navigation/page-headings.ts`
  - `src/config/navigation/navigation.test.ts` and `page-boundaries.test.tsx`
  - `src/features/requests/my-requests-copy.ts`
- Navigation: `src/config/navigation/navigation.ts`
- Pages: `app/(app)/app/page.tsx`; `requests/page.tsx` and `requests/new/page.tsx`; `questionnaires/page.tsx` and `assessments/page.tsx`; `review/requests`, `review/questionnaires` and `review/assessments` `page.tsx`; `risks/page.tsx`
- Boundaries: the 13 `loading.tsx` and `error.tsx` files in Task 2's commit
- Headers: `home-page-header.tsx`, `alerts-page-header.tsx`, `reports-page-header.tsx`, `assessment-list.tsx`
- Copy: `risk-register.tsx`, `risk-register-filters.tsx`, `risk-details.tsx`, `assessment-detail.tsx`, `assessment-editor.tsx`, `released-assessment.tsx`, `questionnaire-review.tsx`, `questionnaire-detail.tsx`, `questionnaire-list.tsx`
- Unit tests: the files named under "Unit assertions changed" above, plus `analyst-route-gate.test.tsx`, `released-assessment.test.tsx`, `risk-details.test.tsx` and `risk-register.test.tsx`
- E2E: `navigation-and-home`, `accessibility`, `performance`, `production-hardening`, `questionnaire-workflow`, `questionnaire-generation-workflow`, `analyst-insights`, `assessment-release-workflow`, `design-system-conformance` and `risk-register-workflow`

## Decisions Made

- The Reference data labels read `administrationConfig[kind].pluralLabel`. Their list headings and `generateMetadata` titles already read that field, so the admin pages are unchanged.
- My requests' description lives in a plain module, `features/requests/my-requests-copy.ts`. `request-table.tsx` is a client module, and a string exported from it would reach the server page as a client reference.
- `UX07_LABEL_EQUALS_HEADING` runs in the desktop project only, outside the `@journey` describe, because the sidebar shows from 1024px. For each actor it reads every visible link in `Primary navigation` (text and href), opens `/app`, clicks the link, waits for the path, and asserts the `main` h1 text and the document title.
- The Requests and Risk assessments error boundaries keep their own `We couldn't load …` descriptions. Only their headings change, as the plan says.
- The full Playwright run went in the background. Its result was read with `timeout 590 tail -f log | grep -m1 __DONE__`, a blocking read rather than a sleep loop.
- UX-07 stays open: `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1: broken by the planned rename] Shell and leave-guard tests named the old navigation labels**
- **Found during:** Task 1, RED
- **Issue:** `mobile-navigation.test.tsx` and `navigation-guard.test.tsx` match links by exact name (Testing Library's default), so they would fail when the labels change. Neither file is on the plan's list.
- **Fix:** They now expect the new labels. Both were in the RED run and pass at GREEN.
- **Committed in:** `f5bb8c7`

**2. [Rule 1: broken by the planned rename, found late] Two capability-navigation tests named `My Questionnaires`**
- **Found during:** Task 1, GREEN (the full web suite before the commit)
- **Issue:** `requestor-dashboard.test.tsx` and `questionnaire-workflow.test.tsx` render `CapabilityNavigation` and match the `My Questionnaires` link exactly. The Task 1 RED grep did not cover them, so they changed in the GREEN commit rather than at RED.
- **Fix:** Both now expect `My questionnaires`.
- **Committed in:** `e3aedc7`

**3. [Rule 2: missing proof] A boundary test was added**
- **Found during:** Task 2, RED
- **Issue:** No unit test rendered the route boundaries, so the behaviour "each loading and error boundary shows the §2.1 heading" had no proof.
- **Fix:** `src/config/navigation/page-boundaries.test.tsx` renders the 14 boundaries, My requests' description, the New request loading label and the Risk register error. It mocks `server-only` and `next/navigation`, as other tests do.
- **Committed in:** `6aad816`

**4. [Rule 3: blocking] New file `features/requests/my-requests-copy.ts`**
- **Found during:** Task 1, GREEN
- **Issue:** The page and both of its boundaries need one description string, and the only module they share, `request-table.tsx`, is a client module.
- **Fix:** A one-constant plain module. It is not on the plan's file list.
- **Committed in:** `e3aedc7`

**5. [Plan inaccuracy] One Task 3 acceptance grep cannot print nothing**
- **Issue:** `grep -rn "'Questionnaire Review | IdamBox CSRM'" apps/csrm/e2e` matches three detail rows: `accessibility.spec.ts:303, 309` and `production-hardening.spec.ts:482`. These are the questionnaire review *detail* titles, which UI-D40 keeps and the plan's own E10 list says stay (`production-hardening.spec.ts:482`).
- **Result:** The other two patterns, `My Requests | …` and `Risk Register | …`, print nothing. No list row names `Questionnaire Review` any more.

**6. [Process] The plan ledger file was stale**
- **Issue:** `.git/gsd-plan-head-before-11-04` already existed and held `805de68`, which is not the commit this plan started from. HEAD was `da0976a`.
- **Fix:** The ledger was rewritten to `da0976a`. `commits: 5` and `plan_head_before` are measured from it.

**7. [Process] The Task 3 commit came before the full suite**
- The seven changed specs (plus two) passed, and then the commit was made. The full suite ran against the committed tree, so the tree-clean check compares committed states. No fix was needed afterwards.

---

**Total deviations:** 4 auto-fixed (2 assertions broken by the planned rename, 1 missing proof, 1 blocking file), plus 1 plan inaccuracy and 2 process notes.
**Impact on plan:** No added scope. No route, capability, gate or Strapi policy changed (T-11-17).

## Issues Encountered

- The production web server logged 222 `The destination stream closed early` messages and one `failed-to-find-server-action` during the full run. 11-03 logged 86 and 1. The increase comes from `UX07_LABEL_EQUALS_HEADING`, which opens about 20 pages in quick succession and aborts their streamed responses. Every test passed.
- `git update-index --refresh` reports "needs update" for the operator's two `apps/backend/types/generated/*.d.ts` files (CRLF/LF stat). They stay untouched and unstaged.

## Known Stubs

None.

## Threat Flags

None.
- T-11-17 is mitigated: only strings changed, with no route path, capability, gate or policy, and the full suite reran every permission journey.
- T-11-SC: no package was added.

## User Setup Required

None.

## Next Phase Readiness

- Ready for 11-05 and later.
- Plan 11-13 can change the exact `{ name: 'Requests', exact: true }` locators to `/^Requests\b/` when the count joins the name. They are at `analyst-insights.spec.ts:485`, `assessment-release-workflow.spec.ts:113`, `questionnaire-generation-workflow.spec.ts:91, 245`, and the `mobile-navigation.test.tsx` cases.
- Plan 11-03's sections (E8) are still not in `navigation.ts`, which keeps the `Reports` and `Administration` groups. That belongs to a later plan and is not touched here.

## Self-Check: PASSED

- The four created files exist: `page-headings.ts`, `navigation.test.ts`, `page-boundaries.test.tsx` and `my-requests-copy.ts`.
- Commits `f5bb8c7`, `e3aedc7`, `6aad816`, `ab4e362` and `eb4ffa0` exist, and each has the trailer.
- Task 1's acceptance criteria all re-ran PASS:
  - `page-headings.ts` has `reviewRequests: 'Requests'`, `reviewAssessments: 'Risk assessments'`, `riskRegister: 'Risk register'`, `myRequests: 'My requests'` and `routeTitle`.
  - `navigation.ts` has 11 `pageHeadings.` labels.
  - `requests/new/page.tsx` has `routeTitle(pageHeadings.newRequest)`.
  - The verify command exited 0, twice.
- Task 2's acceptance criteria all re-ran PASS:
  - `risk-register-filters.tsx` contains `Risk register filters`, and `risk-details.tsx` contains the §2.3 body.
  - `assessment-detail.tsx` contains `Go to My requests`, and `questionnaire-list.tsx` contains `View My requests`.
  - `review/requests/error.tsx` reads `pageHeadings.reviewRequests`.
  - The verify command exited 0.
- Task 3's acceptance criteria:
  - `assessment-release-workflow.spec.ts` contains `name: 'Requests', exact: true`.
  - The full run passed in both projects, and the tree was clean afterwards.
  - The title grep prints only the three kept detail rows (deviation 5).
- The plan's verification passed: the web suite, typecheck, lint and `api:check` are green, and the full Playwright suite is green in both projects with the tree clean afterwards.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
