---
phase: 08-production-integration-and-hardening
plan: 11
subsystem: testing
tags: [playwright, projects, mobile, desktop, responsive, journeys, idor, csp, sign-in, wcag, e2e]

requires:
  - phase: 08-production-integration-and-hardening
    provides: the production-build harness that leaves the tree clean (08-02); the Menu trigger name and the in-shell not-found (08-09); the CSP collector e2e/helpers/csp.ts (08-10)
provides:
  - apps/web/playwright.config.ts with a desktop project (1440x900, every spec) and a mobile project (375x812, hasTouch, the @journey tests of four files)
  - apps/web/e2e/helpers/navigation.ts with signInAs, openFromNavigation and primaryViewport
  - the six critical journeys at 1440 and 375 with populated content at each width, four through the projects and two inside their single desktop pass
  - the browser IDOR proof for Jane's request, questionnaire and assessment at both widths in both projects (D-18)
  - the CSP collector on every journey page, zero violations (D-19)
  - URL-free, shell-asserting sign-in in every spec (D-15)
affects: [08-12 (the request and Administration denials still lack a level-one heading; the sweep can reuse signInAs and primaryViewport), 08-13 (suite time baseline 554 s), 08-14 (the phase gate runs both projects; the seed date note in deferred-items)]

tech-stack:
  added: []
  patterns:
    - "A journey reads its starting width from its Playwright project (primaryViewport) and returns there after every deliberate sweep of other widths."
    - "A list is read through the rendering its width shows: cards below 768 (the labelled list and its items), the table from 768; the hidden rendering is asserted present but hidden, never read."
    - "A second pass in one database needs its own starting state: record names carry the project name, and toggled edits choose between two values that keep every later assertion true."
    - "A page refused to another Requestor is read once for text (hidden text in, script, style and template out) and holds none of the owner's facts and no record identifier."

key-files:
  created:
    - apps/web/e2e/helpers/navigation.ts
  modified:
    - apps/web/playwright.config.ts
    - apps/web/e2e/requestor-request-workflow.spec.ts
    - apps/web/e2e/assessment-navigation-lifecycle.spec.ts
    - apps/web/e2e/risk-register-workflow.spec.ts
    - apps/web/e2e/administration-workflow.spec.ts
    - apps/web/e2e/questionnaire-workflow.spec.ts
    - apps/web/e2e/assessment-release-workflow.spec.ts
    - apps/web/e2e/questionnaire-generation-workflow.spec.ts
    - apps/web/e2e/questionnaire-governance-workflow.spec.ts
    - apps/web/e2e/request-relationship-states.spec.ts
    - apps/web/e2e/analyst-insights.spec.ts

key-decisions:
  - "Journeys 2 (questionnaire) and 3 (release) exercise both widths in one desktop pass because their fixtures are one-shot: the pass submits the seeded questionnaire and releases the seeded submitted request, so a second pass would find neither in its starting state (D-41). Journeys 1, 4, 5 and 6 run in both projects."
  - "D-18 on the assessment URL asserts the in-shell Page not found (orchestrator decision, 2026-09-26), replacing the plan's This page could not be found. The request URL's permission state is asserted without a heading, because it has none yet (08-12)."
  - "The Risk Register journey toggles the mutable Risk's target date between 2026-06-30 and 2026-07-31. Toggling back to the seeded 2026-12-01 on the second pass would put the date in the future, and the journey's Overdue proof would fail in the mobile project."
  - "The CSV import's record names carry the project name (dylan-test-<pid>-<project>), so the mobile pass previews Create 1, Update 1 and Unchanged 1 exactly like the desktop pass."
  - "The mobile project keeps Desktop Chrome with a 375x812 viewport and touch, not isMobile, so Chromium lays pages out as the product's breakpoints expect."

patterns-established:
  - "signInAs(page, role) is the one sign-in for journeys: the level-one Dashboard heading and the role in the banner, never the URL."
  - "openFromNavigation(page, name, exact) opens a navigation item from the sidebar at 1024 and wider, and through the Menu sheet below."

requirements-completed: [INT-04]

duration: 60 min
completed: 2026-09-26
---

# Phase 08 Plan 11: Six critical journeys at 1440 and 375, the browser IDOR proof and the CSP collector on every journey Summary

**The Playwright suite now runs in two projects on the production build: `desktop` at 1440×900 runs every spec, and `mobile` at 375×812 with touch runs the four journeys that can run twice against one database. The request, Requestor read-only, Risk Register and CSV import journeys start at their project's width, read lists through the cards below 768 and the table from 768, and filter the Risk Register through the `Filters (n)` sheet at 375. The questionnaire and release journeys consume one-shot fixtures, so they prove both widths at each stage inside their single pass. The Secondary Requestor opens Jane's request, questionnaire and assessment at 1440 and 375 in both projects and learns nothing: a permission state, the questionnaire's permission copy and the in-shell `Page not found`, with none of Jane's identifiers, titles or documentIds. Every journey runs with the CSP collector and ends with zero violations, and every sign-in proves the shell rather than the URL. The full suite passed 65 of 65 (61 desktop, 4 mobile) in 554 s, with no retry and a clean tree.**

## Performance

- **Duration:** about 60 min
- **Started:** 2026-09-25T23:18:44Z
- **Completed:** 2026-09-26 (the metadata commit)
- **Tasks:** 3 of 3
- **Files:** 12 (1 created, 11 modified) across the code commits, plus this summary, STATE, ROADMAP and deferred-items

## Full run (Task 3), production build, both projects

| Measure | Value |
|---|---|
| Result | **65 passed / 0 failed / 0 flaky**, no retries (`retries` is 0 outside CI) |
| Per project | `desktop` **61 passed** (446.8 s of test time); `mobile` **4 passed** (60.6 s of test time) |
| Duration | **554 s wall** (2026-09-25 23:50:07Z to 23:59:21Z), 9.2 min reported. About 47 s of it is not test time: the Strapi boot, `next build` and `next start`, and browser and worker start-up, the worker change between projects included |
| Against 08-10 | 61 tests in 470 s wall. The mobile project adds 61 s; the new checkpoints and the D-18 URLs add a few seconds to four journeys |
| Ceiling | Well inside 30 minutes, and under the plan's 22-minute trim threshold, so nothing was trimmed and no `test.setTimeout` budget changed |
| Tree | `git status --porcelain` empty before and after the run; nothing left listening on 1337 or 3000 |
| Server log | `The destination stream closed early.` 16 times (the known 08-02 note: navigations away from a streaming page) |

**Slowest five tests**

| Seconds | Test |
|---|---|
| 56.5 | `[desktop]` design-system-conformance › Phase 7 audited route state, type, and authorization matrix |
| 46.2 | `[desktop]` design-system-conformance › audited route state, type, and authorization matrix |
| 33.2 | `[desktop]` design-contract › compares shared empty, error, and permission state contracts before their recovery controls |
| 32.0 | `[desktop]` design-contract › compares RecordLinks, responsive DataTables, accessibility, and console output across every scoped surface |
| 30.8 | `[desktop]` production-hardening › every analyst route renders under the production policy with no CSP violation |

The journeys in the same run: Risk Register 23.7 s (desktop) and 24.7 s (mobile); request 20.1 s and 20.5 s; release 19.3 s; CSV import 6.3 s and 9.3 s; questionnaire 6.9 s; lifecycle 5.8 s and 6.1 s.

## The widths each journey asserts, and where

| Journey | Spec and test | `desktop` project | `mobile` project | Other widths inside the pass |
|---|---|---|---|---|
| 1. Request create → submit | `requestor-request-workflow.spec.ts`, the `@journey` test | At 1440: My Requests as a table (populated), create, edit, submit, the analyst review, return to draft, resubmit, and the resubmitted request listed as `Submitted` in the table. The keyboard path reaches the skip link, then the sidebar's home link | The same at 375: My Requests as cards, the resubmitted request's card `Submitted`, and the keyboard path skip link → `Menu` → sheet | Return-to-draft dialogs at 375 and 1440 (Requestor and analyst); list search, status filter, sort and pager at 768; dashboard lifecycle cards at 375 and 1440 |
| 2. Questionnaire complete → submit | `questionnaire-workflow.spec.ts` (desktop only, one-shot) | One pass: discovery and form at 375; **new:** the filled form at 1440 (answer value, dependent group, checked answer, no overflow); saved at 375; validation and submission at 768; return-to-draft dialogs at 375 and 1440; analyst review at 1440 and **new:** at 375 (the submitted answer, the `Submitted` badge, no overflow) | Not run: the seeded questionnaire ends submitted | — |
| 3. Draft → review → release | `assessment-release-workflow.spec.ts` (desktop only, one-shot) | One pass: queue at 375; questionnaire and assessment links at 375 and 1440; readiness list at 375 and 1440; **new:** the completed editor at 375 and 1440 (`Save assessment`, the first Risk form's `Save risk`, the drafted Risk statement, `All release requirements are met`, no overflow); release at 1440; Jane's dashboard item at 375 and 1440; **new:** the released view at 375 and 1440 (the article, the Risk statement, the mitigation controls, no overflow) | Not run: the seeded submitted request ends released | — |
| 4. Requestor read-only viewing | `assessment-navigation-lifecycle.spec.ts`, the `@journey` test | The analyst's and Jane's assessments with lifecycle context at 1440; each originating-request link at 375 and 1440; D-18 at 1440 and 375 | The same starting at 375 | The link sweeps hand the page back at the project's width |
| 5. Risk Register filter → detail → mitigation edit | `risk-register-workflow.spec.ts`, the `@journey` test | Table rows, the `More filters` popover and the sort headers at 1440 | Cards, the `Filters (n)` sheet for search, the three selects and the five relation pickers, and sorting through `?sort=targetDate%3Adesc` then `asc` at 375 | Register and detail geometry at 375, 390, 430, 768, 1024, 1280 and 1440; Alerts at 768; My Requests at 1440; 200% zoom at 720; Jane's denial at 720 |
| 6. CSV import preview → commit | `administration-workflow.spec.ts`, the `@journey` test | Records created, and the preview, confirmation and results read as table rows at 1440 | The same read as cards at 375 | Import guidance at 375, 768, 1280 and 1440; all four import pages at 375 |

**For VERIFICATION:** journeys 2 and 3 exercise both widths in one pass because their fixtures are one-shot. The questionnaire journey submits the seeded `Customer portal questionnaire draft`, and the release journey releases the seeded submitted `Customer portal security assessment`. A second pass in the mobile project would find neither in its starting state (D-41, research Pitfall 4).

## D-18: what the Secondary Requestor sees on Jane's three URLs

Each URL was opened at 1440 and at 375 in each project, so four times in the full run. On every visit the banner kept `Secondary Requestor` and the page had no horizontal overflow. The page text, read once per visit, held none of ten protected values and no record identifier (`RAR-`, `QUES-`, `QNR-`, `ASM-`, `RSK-`). The protected values were `RAR-E2E-NAV-OWNER-001`, `Owner navigation lifecycle released request`, the request's documentId, `QUES-DEV-DRAFT-001`, `Customer portal questionnaire draft`, `RAR-DEV-QUES-DRAFT-001`, `Customer portal questionnaire draft request`, the questionnaire's documentId, `ASM-E2E-NAV-OWNER-001` and the assessment's documentId. The URLs came from Jane's own navigation: the originating-request link, the My Questionnaires list and the assessment path.

| URL | Strapi | Asserted and passing | Also rendered (from source, not asserted) |
|---|---|---|---|
| `/app/requests/{Jane's documentId}` | 403 | The shared permission state inside `main` (`role="alert"`, `data-state-kind="permission"`) containing `You don’t have access to this area`, with `Return to workspace` → `/app`. No `Request actions` region and no lifecycle heading. **No level-one heading is asserted, because the page has none yet (08-12).** | `Access is determined by your effective CSRM capabilities. Navigation visibility is not an authorization control.` |
| `/app/questionnaires/{Jane's documentId}` | 403 | The only h1 is `Questionnaire unavailable`, with the alert `You don’t have permission to view this questionnaire` and `Back to questionnaires` → `/app/questionnaires`. No answer field and no `Assessment request …` link | The lead `This questionnaire cannot be displayed.` and `Access is enforced by your effective CSRM capabilities and record scope.` |
| `/app/assessments/{Jane's documentId}` | 404 | The only h1 is `Page not found`, inside the shell, with `The page you asked for doesn’t exist or has moved.` and `Return to workspace` → `/app`. No lifecycle or originating-request section | — |

**Plan text superseded (orchestrator decision, 2026-09-26).** The plan's D-18 row and its acceptance grep expect `This page could not be found.` on the assessment URL. That was Next's default 404, which 08-09 replaced with the in-shell not-found. The spec asserts `Page not found` and its lead instead, so the acceptance grep for `This page could not be found.` is replaced by `Page not found`.

## Sign-in helpers (D-15)

- **Replaced by `signInAs`, all nine URL-asserting sites:** `administration-workflow`, `assessment-release-workflow`, `questionnaire-generation-workflow` (it had no heading or banner check), `questionnaire-governance-workflow`, `questionnaire-workflow`, `request-relationship-states`, `requestor-request-workflow` (two helpers; the analyst one had no heading or banner check) and `risk-register-workflow`.
- **Moved to `signInAs`:** `assessment-navigation-lifecycle`, which already asserted the shell.
- **Heading narrowed to level one:** `analyst-insights`.
- **No change needed:** `accessibility`, `app-shell`, `design-contract`, `design-system-conformance` and `production-hardening` already assert the level-one Dashboard heading and the banner role.
- `grep -rn "toHaveURL(/\/app$/)" apps/web/e2e/*.spec.ts` prints nothing, and nine spec files import `signInAs`.

## CSP collector (D-19)

- `attachCspCollector` runs before the first navigation of all six journeys, and on their extra pages: the Requestor's pre-release context in the release journey and the Secondary Requestor's context in the lifecycle journey.
- `expectNoCspViolations` closes each journey: the request journey (its create, edit and submit routes included, which the 08-10 sweep could not reach), the questionnaire, the release journey and its pre-release page, the lifecycle journey (analyst and owner, then the Secondary Requestor), the Risk Register and the CSV import.
- Zero violations in every run.

**Sensitivity (temporary edits, reverted with `git checkout --`).** Both probes ran in the mobile project, on a fresh database, against the lifecycle journey.

- `expectNoOwnerFact` on Jane's own request page failed as intended (`NO_OWNER_FACT_SENSITIVITY_OWNER_PAGE`), so the text read is not vacuous.
- An image from `https://csp-probe.invalid/probe.png`, added in the Secondary Requestor's context, failed the journey. The message was `the Secondary Requestor denials: no securitypolicyviolation event`, with `img-src: https://csp-probe.invalid/probe.png (on http://127.0.0.1:40828/app)`.
- The first probe, an inline script appended by page code, raised nothing. `'strict-dynamic'` trusts a script element that already-trusted script inserts (CSP3 behaviour, not a collector gap), so the probe moved to an image source.

## Task Commits

1. **Task 1** — `4306e35` test(08-11): run the re-runnable journeys in desktop and mobile projects with shell-asserting sign-in
   - The projects, `e2e/helpers/navigation.ts`, the four width-aware journeys and the sign-in sweep in all nine files.
2. **Task 2** — `f9d732d` test(08-11): check both widths inside the one-shot journeys, extend the browser IDOR proof and carry the CSP collector
3. **Task 3** — `a8ecaac` chore(08-11): record the two-project suite budget from the measured run
   - A comment in `playwright.config.ts` with the measured run. It is comment-only; the full run ran on `f9d732d`.

**Plan metadata:** the `docs(08-11): complete …` commit carrying this summary, STATE, ROADMAP and deferred-items.

## Files Created/Modified

- `apps/web/playwright.config.ts`: the two projects, why journeys 2 and 3 are desktop-only files, and the measured budget.
- `apps/web/e2e/helpers/navigation.ts` (new): `signInAs`, `openFromNavigation`, `primaryViewport`.
- The journey specs:
  - `requestor-request-workflow.spec.ts`
  - `assessment-navigation-lifecycle.spec.ts`
  - `risk-register-workflow.spec.ts`
  - `administration-workflow.spec.ts`
  - `questionnaire-workflow.spec.ts`
  - `assessment-release-workflow.spec.ts`
- The sign-in sweep only:
  - `questionnaire-generation-workflow.spec.ts` (also its local `openFromNavigation`, now shared)
  - `questionnaire-governance-workflow.spec.ts`
  - `request-relationship-states.spec.ts`
  - `analyst-insights.spec.ts`

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in test data] The Risk Register journey's second pass would have toggled its target date into the future**
- **Found during:** Task 1, reading the edit step before the first mobile run.
- **Issue:** The journey saved `2026-08-30` or `2026-12-01`, whichever differed from the current value, then asserted the `Overdue` marker for the saved date. On a fresh database the first pass saves `2026-08-30` (past). A second pass in the same database, the mobile project, would save `2026-12-01`, which is after today (2026-09-26), so no `Overdue` marker would render.
- **Fix:**
  - Toggle between `2026-06-30` and `2026-07-31`: both are past, and both fall before the window in which the Phase 7 fixtures are dated relative to the run (−40 to +7 days), so the second pass's equal-bounds filter still matches the mutable Risk alone.
  - The first pass still filters by the seeded `2026-12-01`: see the deferred item on the dates when that collides.
- **Verification:** the mobile project passed after desktop in one run (13/13), alone on a fresh database (4/4), and in the full run.
- **Committed in:** `4306e35`.

**2. [Rule 2 - Must-have] One compliant-looking sign-in helper did not assert a level-one heading**
- **Issue:** The must-have says every E2E sign-in helper asserts the level-one Dashboard heading. `analyst-insights.spec.ts` matched `Dashboard` exactly but at any level.
- **Fix:** added `level: 1`.
- **Committed in:** `4306e35`.

**3. [Rule 2 - Non-vacuous proof] The Administration journeys' absent-group check would pass vacuously at 375**
- **Issue:** `signOutAndEstablishRequestorBaseline` asserted no `Administration` text inside `getByRole('navigation')`. Below 1024px the sidebar is hidden, so with the sheet closed there is no navigation to search, and the mobile CSV journey would prove nothing.
- **Fix:** below 1024 it opens the Menu sheet, asserts the Requestor's `My Requests` link is on screen and `Administration` is absent, then closes the sheet. `establishAnalystBaseline` likewise opens the sheet only while the `Menu` trigger is visible, as the plan asks.
- **Committed in:** `4306e35`.

### Plan-text deviations and additions

4. **D-18 copy (orchestrator decision).** The assessment asserts `Page not found`, not `This page could not be found.`, as described above. The request denial is asserted without a heading. The questionnaire denial is also asserted by its h1, which exists.
5. **Commit boundaries.** The sign-in sweep of `questionnaire-workflow` and `assessment-release-workflow` landed in the Task 1 commit, because Task 1's verification requires zero URL-asserting helpers. Their width checkpoints and collector landed in Task 2.
6. **Targeted runs were supersets of the plan's commands.**
   - **Task 1:** the four files in both projects in one invocation (13 passed, 2.7 min), then `--project=mobile` alone as its verify requires (4 passed, 1.6 min).
   - **Task 2:** all six journey files in both projects (15 passed, 3.3 min), because the collector went onto all six, not only the plan's three desktop files.
   - **Syntax:** `--project` is variadic, so the plan's `--project desktop <files>` form swallowed the file paths (`Project(s) "e2e/…" not found`, before any server started). The runs used `--project=desktop`.
7. **Keyboard path at 1440.** The request journey's second Tab reaches the sidebar's `IdamBox CSRM home` link from 1024px, which is asserted; the `Menu` keyboard path runs in the mobile project.
8. **`openFromNavigation` is scoped** to the `Primary navigation` landmark (sidebar) before falling back to the `Menu` sheet. The generation spec's old helper clicked any visible link of that name.
9. **Additions in the D-18 block:**
   - the no-record-identifier check;
   - structural absences (no request actions or lifecycle; no answer field or request link);
   - one text read per visit, as the plan asks. The existing per-value `not.toContainText` assertions are kept.
10. **Additions elsewhere:**
    - The CSV preview rows also assert their state badge text.
    - Both My Requests readings assert that the other rendering is present but hidden.
    - The lifecycle sweeps return to the project's width, so the mobile pass keeps running at 375.
11. **Windows host translations,** as the preamble sets out:
    - Node 24 from `/c/ProgramData/nvm/v24.19.0`, with no `PLAYWRIGHT_BROWSERS_PATH`;
    - ports checked with `Get-NetTCPConnection`;
    - logs in `apps/web/.tmp/logs/csrm-phase-08/`.

**Total deviations:** 3 auto-fixed (1 Rule 1 in test data, 2 Rule 2 in the proofs) and 8 recorded. **Impact:** test and harness files only. There is no product, Strapi, schema, contract, grant, `CSRM_AI_*` or Keycloak change and no new dependency.

## Issues Encountered

- **First Task 1 run did not start.** The plan's `--project desktop … e2e/<files>` form made Playwright read the file paths as project names. The rerun used `--project=desktop --project=mobile`.
- **First CSP probe raised nothing.** The inline-script probe was not reported because of `'strict-dynamic'`, as described above. The image-source probe was.
- **Strapi suite ran slower.** It took 712 s here against 508 s in 08-10, with the same 504 tests and no failure. The web unit suite, typecheck and `api:check` ran beside it for about a minute, which does not account for all of the difference; no Strapi file changed in this plan.

## Verification

| Command | Result |
|---|---|
| `pnpm --filter @csrm/web typecheck` (after each task and on the final tree) | exit 0 |
| Task 1: `test:e2e <four files> --project=desktop --project=mobile` | **13 passed** (9 desktop, 4 mobile), 2.7 min, tree clean |
| Task 1: `test:e2e --project=mobile` | **4 passed**, exactly the four `@journey` tests, 1.6 min |
| Task 2: `test:e2e <six journey files> --project=desktop --project=mobile` | **15 passed** (11 desktop, 4 mobile), 3.3 min |
| Sensitivity (temporary, reverted) | the owner-page text check threw as intended; the `img-src` probe failed the journey with the violation listed |
| **Task 3: `pnpm --filter @csrm/web test:e2e`** (full, both projects, on `f9d732d`) | **65 passed / 0 failed / 0 flaky**, no retries, 554 s wall; `git status --porcelain` empty before and after |
| `pnpm --filter @csrm/strapi test` | **504 passed / 0 failed / 0 skipped** (711.8 s) |
| `pnpm --filter @csrm/web test` | **84 files, 1598 tests passed** (19.7 s); unchanged count, no unit file changed |
| `pnpm --prefix apps/web api:check` | exit 0, no drift |
| `grep -rn "toHaveURL(/\/app$/)" apps/web/e2e/*.spec.ts` | nothing |
| Acceptance re-run on the final tree | config strings 10 of 10; three exports; `signInAs` in 9 spec files; `@journey` once in each of the four files; `project.name` in the suffix; the mobile sheet and `sort=targetDate%3Adesc` branch; `setViewportSize` 4 → 8 (questionnaire) and 6 → 8 (release); the D-18 block's strings (with `Page not found` for the superseded text); `expectNoCspViolations` in all six journey files |
| Frozen paths since `74616fe` (`apps/strapi`, `docs/references`, `.env*`); `CSRM_AI_` or Keycloak lines added | empty; 0 |
| Tool attribution in this plan's commit messages and added lines | none |

## Known Stubs

None.

## Threat Flags

None. The plan adds test code only: no endpoint, grant, data path or trust boundary. Each mitigation holds:

- **T-08-11-01:** the browser proof at both widths, in both projects, of three record types, with the owner's facts and every record identifier absent. The server matrix (08-05) proves the API side.
- **T-08-11-02:** project-specific CSV names, the Risk Register's two-past-dates toggle, the one-shot journeys desktop-only, and `workers: 1`.
- **T-08-11-03:** the collector on every journey page, with a proven negative control.
- **T-08-11-04:** every helper asserts the Dashboard heading and the banner role; the static grep forbids the URL assertion.

## Open issues for the orchestrator (also in `deferred-items.md`)

1. **A calendar-dependent collision in the Risk Register journey's first pass** (predates Phase 8).
   - The seeded `2026-12-01` target date meets a Phase 7 fixture's run-relative date on 2026-11-24, 2026-12-13, 2026-12-31 and 2027-01-10. On those days the equal-bounds filter reads 2 results.
   - Options: seed a past date before the relative window, or add the Risk number to that step.
2. **Another Requestor's request URL renders the permission state with no level-one heading** and the root title `IdamBox CSRM`. D-18 asserts the state without a heading. 08-12 owns it, with the Administration denial.

## Browser backstops for the orchestrator

Against `next dev` on port 3000.

1. **Risk Register at 375, as Security Analyst.** On `/app/risks`, open `Filters (0)`.
   - Search `unauthorised access`, then choose Treatment status `In Progress`, Inherent `High` and Residual `Moderate`.
   - Pick `Bob Doe` for Risk owner and Treatment owner, `ASM-DEV-RISK-001`, `Customer portal` and `Customer records`, and set Mitigation-control status `Planned`. The sheet stays open throughout and each picker's options appear over it.
   - Escape returns focus to `Filters (n)`, and the cards show `1 result`.
2. **Secondary Requestor at 375 and 1440.** Copy Jane's request, questionnaire and released-assessment URLs (sign in as Requestor, open `ASM-E2E-NAV-OWNER-001`, its originating request and `Customer portal questionnaire draft`), then sign in as Secondary Requestor and open each:
   - the request shows the permission card (no heading above it);
   - the questionnaire shows `Questionnaire unavailable`;
   - the assessment shows `Page not found` in the shell;
   - nothing names Jane's records.
3. **My Requests at 375, as Requestor.** The cards list the requests with their status badges and no table. At 768 the table replaces them.

## Next Phase Readiness

- `REQUIREMENTS.md` is unchanged, as in 08-01 to 08-10. INT-04 closes at the phase gate (08-14).
- **08-12 can start.**
  - `signInAs` and `primaryViewport` are available to its sweep.
  - The request-detail and Administration denials still need their level-one headings.
  - When they land, the D-18 request block can add a heading assertion.
- **08-13:** the suite baseline is 554 s for 65 tests in two projects.

## Self-Check: PASSED

- Created file exists: `apps/web/e2e/helpers/navigation.ts`.
- The three plan commits are on `dev`: `4306e35`, `f9d732d` and `a8ecaac`.
- The acceptance criteria of all three tasks and the plan's verification greps were re-run on the final tree and pass. The superseded `This page could not be found.` grep is replaced by `Page not found`.
- Neither this plan's commits nor this summary carry tool attribution or a trailer.

---
*Phase: 08-production-integration-and-hardening*
*Completed: 2026-09-26*
