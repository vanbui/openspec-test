---
phase: 08-production-integration-and-hardening
plan: 07
subsystem: ui
tags: [status-badge, design-direction, glossary, questionnaire-governance, assessment-draft, copy, lucide, vitest, playwright]

requires:
  - phase: 08-production-integration-and-hardening
    provides: the production-build browser harness that signs in only inside the attested runtime and leaves the tree clean (08-02); the named timeline actor (08-06), untouched here
provides:
  - statusPresentation, statusLabel, deriveQuestionnaireStatus and the family/value StatusBadge in components/csrm/status-badge.tsx - one label, tone and icon per value for the request, Risk Assessment, questionnaire and Risk treatment families, every badge carrying data-tone (D-27)
  - the X-5 tone vocabulary in docs/design/csrm-design-direction.md section 4, and the root CONTEXT.md glossary entry Released for the assessment status approved (D-45, D-50)
  - the analyst-review question editor as the single list of questions, grouped by section with answer type, required flag and choices; no read-only renderer or Submitted notice in that state (D-32)
  - provider-neutral, advisory drafting copy on the analyst request review, UI-SPEC section 1.1 verbatim (D-08)
affects: [08-08 (edits risk-register.tsx and risk-register-workflow.spec.ts after this plan), 08-11 (journey specs read the new copy and badges), 08-12 (accessibility sweep), 08-14 (INT-03 citations, phase gate, residual register), Phase 8 UI review]

tech-stack:
  added: []
  patterns:
    - "One status mapping: feature code passes a family and a value; label, tone and icon come from statusPresentation, and filter options and chips read statusLabel."
    - "Every status badge carries data-tone (neutral, info, warning, success, danger), so unit tests and browser proofs assert the tone without reading class names."
    - "A derived status takes the deciding fact as an explicit nullable parameter: only an explicit null release reads as analyst review, and a projection without the field passes its served state straight through."

key-files:
  created:
    - CONTEXT.md
    - apps/web/src/components/csrm/status-badge.test.tsx
  modified:
    - docs/design/csrm-design-direction.md
    - apps/web/src/components/csrm/status-badge.tsx
    - apps/web/src/features/assessments/assessment-domain.ts
    - apps/web/src/features/assessments/assessment-list.tsx
    - apps/web/src/features/assessments/assessment-editor.tsx
    - apps/web/src/features/assessments/released-assessment.tsx
    - apps/web/src/features/assessments/assessment-draft-job.tsx
    - apps/web/src/features/requests/request-hub.tsx
    - apps/web/src/features/risks/risk-details.tsx
    - apps/web/src/features/risks/risk-register.tsx
    - apps/web/src/features/questionnaires/questionnaire-list.tsx
    - apps/web/src/features/questionnaires/questionnaire-review-list.tsx
    - apps/web/src/features/questionnaires/questionnaire-detail.tsx
    - apps/web/src/features/questionnaires/questionnaire-review.tsx
    - apps/web/src/features/questionnaires/questionnaire-governance.tsx
    - apps/web/src/features/dashboard/requestor-dashboard.tsx
    - apps/web/e2e/assessment-release-workflow.spec.ts
    - apps/web/e2e/assessment-navigation-lifecycle.spec.ts
    - apps/web/e2e/risk-register-workflow.spec.ts
    - apps/web/e2e/questionnaire-governance-workflow.spec.ts

key-decisions:
  - "Tone maps to the Badge variant for every family, the request family included: info, warning, success and danger render the same-named variants, so request badges that were outline-plus-tint now carry data-variant equal to their tone. Tokens and appearance are unchanged; the neutral request badges (draft, closed) keep their exact previous markup plus data-tone."
  - "The per-family tables are private (requestFamily, assessmentFamily, questionnaireFamily, treatmentFamily) behind the exported statusPresentation, so the retired name assessmentStatusPresentation exists nowhere in apps/web/src."
  - "Questionnaire filter options and chips read statusLabel, so the analyst review list's Status chip reads 'Not started' where it showed the raw value 'not-started'."
  - "The released detail header passes the served assessmentStatus (always approved there); the Risk detail passes approved because a locked Risk implies a released assessment and its projection carries no assessment status."
  - "Section heading ids in the question editor come from useId (a section key is not guaranteed to be a valid id), and each section's list is named by its heading."
  - "The draft card's provider-neutral check excludes server-supplied text: a failure message is data and passes through verbatim (UI-SPEC section 1.3)."
  - "The first full browser run failed one spec on a transient Google Fonts response; after diagnosis and an isolated rerun, a second full run was made so the plan's 0 failed / 0 flaky full run is observed, not inferred. No harness change: the cause is not Windows-specific."

patterns-established:
  - "A status surface never styles a status itself: <StatusBadge family value /> or statusLabel(family, value); a new status family is a new row set in statusPresentation, with a tone that follows the X-5 meanings."
  - "A browser proof reads a status through [data-slot=badge] and data-tone, scoped to its surface (for example .page-header [data-slot=badge]), never through a bare getByText that a stepper or a sibling badge can also satisfy."

requirements-completed: [INT-03, INT-04]

duration: about 56 min
completed: 2026-09-25
---

# Phase 08 Plan 07: One status recipe, a single question list and provider-neutral drafting copy Summary

**Every workflow status (request, Risk Assessment, questionnaire, Risk treatment) now renders through one exported `statusPresentation` mapping as a tinted rounded badge with an icon, a label and a `data-tone`. No status renders as a neutral outline chip, and `Overdue` is a clock, not the High severity triangle. The assessment status `approved` reads Released on every surface and filter while its stored and query value stays `approved`, recorded in a new root `CONTEXT.md`. The analyst questionnaire review in analyst review lists each question once, grouped by section with its answer type, required flag and choices, with no untrue Submitted notice. The analyst request review's drafting card is now `Assessment draft generation`, advisory and provider-neutral. X-5 is recorded in the design direction first. The full browser suite passed 51 of 51 on the Windows host with a clean tree.**

## Performance

- **Duration:** about 56 min (including two full browser runs of about 6.5 minutes each, one isolated rerun and one full Strapi run)
- **Started:** 2026-09-25T18:16:16Z
- **Completed:** 2026-09-25T19:12:36Z (the metadata commit)
- **Tasks:** 4 of 4, each test-first (RED, then GREEN)
- **Files:** 32 changed across the code commits (2 created, 30 modified), plus this summary, `deferred-items.md`, STATE and ROADMAP

## Accomplishments

- **One status mapping (D-27, X-5).** `status-badge.tsx` exports `StatusTone`, the four family value types, `statusPresentation` (`request`, `assessment`, `questionnaire`, `treatment`, each a `satisfies Record<Value, { icon, label, tone }>` table), `statusLabel(family, value)`, `deriveQuestionnaireStatus(state, release)` and `StatusBadge`. `StatusBadge` takes `{ status }` for requests, so request call sites stay byte-identical, or `{ family, value }` for everything else. Tones map to the tinted `Badge` variants, and neutral is the tinted recipe in neutrals (`border-border bg-surface-muted text-foreground-secondary`). Every badge sets `data-tone`. No family uses a severity icon (`TriangleAlert`, `OctagonAlert`, `CircleGauge`) or an urgency icon (`CalendarX2`, `CalendarClock`, `Flag`).
- **X-5 recorded before any component change.** `docs/design/csrm-design-direction.md` section 4 Status & risk badges gained the bullet "Tone vocabulary (CSRM extension, 2026-09-25)" with the UI-SPEC wording verbatim (`be3ad80`).
- **Released, with a glossary entry (D-50, UI-D3).** Assessment `approved` displays Released on the review list (cell, card and filter option), the editor header, the released detail header, filter option and definition, the Risk detail header and the request hub tile. The stored value, the `status=approved` query value and the request-status label `Approved` are unchanged. The root `CONTEXT.md` (11 lines) holds the one glossary entry.
- **Questionnaire status is one derived family (UI-D4).** `analyst-review` (warning), `not-started` (neutral), `draft` (info), `submitted` (success) on My Questionnaires, the review list, the Requestor detail, both analyst review headers, the awaiting-submission heading and the Requestor dashboard. `Ready for review`, `Awaiting submission` and the detail's `In progress` are gone. The review filter keeps its three served-state options.
- **Each question once in analyst review (D-32, UI-D10).** The `analyst-review` branch no longer mounts `QuestionnaireRenderer`. The governance question editor is the single list: one `h3.micro-label` per section in definition order (via `orderQuestionnaire`), then one row per question with the text (`text-sm font-medium`), `{Answer type} · Required|Optional` and, for select types, `Choices: …` (`text-xs text-foreground-secondary`). `Edit`, `Delete`, `Add question` and the release control are unchanged. The `submitted` branch still shows the renderer with the answers.
- **Provider-neutral drafting copy (D-08, UI-D1).** Every UI-SPEC section 1.1 string is applied verbatim to `assessment-draft-job.tsx`: `Assessment draft generation`, the advisory description naming the Security Analyst, `Generate assessment draft` / `Starting draft generation…`, the four `Draft generation …` states, the completed and running bodies, `Draft generation lifecycle`, the five announcements, `Retry draft generation` / `Retrying draft generation…` and `Open assessment draft`. The component matches neither `/deterministic/i` nor `/assistance/i`. The persisted deterministic summary and the questionnaire generation card are untouched.

## Status call sites migrated

| Surface | File | Before | After |
|---|---|---|---|
| Risk assessment review list, table cell and mobile card | `assessment-list.tsx` | local `AssessmentStatusBadge`: untinted `Badge variant="outline"` | `<StatusBadge family="assessment" value={…} />` |
| Risk assessment review, status filter options | `assessment-list.tsx` | `assessmentStatusPresentation[status].label` (`Approved`) | `statusLabel('assessment', status)` (`Released`); values unchanged |
| Risk assessment editor header | `assessment-editor.tsx` | neutral outline chip with `aria-live` | `<StatusBadge family="assessment" live value={…} />` |
| Released risk assessment header | `released-assessment.tsx` | ad hoc success chip `Released` | `<StatusBadge family="assessment" value={assessment.assessmentStatus} />` |
| My released risk assessments, status filter option | `released-assessment.tsx` | `<option value="approved">Approved</option>` | label `statusLabel('assessment', 'approved')` (`Released`), value `approved` |
| Released detail, `Assessment status` definition | `released-assessment.tsx` | literal `Released` | `statusLabel('assessment', assessment.assessmentStatus)` |
| Request hub assessment tile | `request-hub.tsx` | `assessmentStatusPresentation` lookup (`Approved`) | `statusLabel('assessment', …)` behind an `isAssessmentStatus` guard; unknown values still render raw |
| Risk detail header (locked Risk) | `risk-details.tsx` | neutral outline chip `Released — read only` | `<StatusBadge family="assessment" value="approved" />`; the Alert title is now `Released assessment - read only` |
| Risk Register treatment status, table cell and mobile card | `risk-register.tsx` | untinted outline chip, `AlertTriangle` for Overdue | `<StatusBadge family="treatment" value={…} />`; `Not provided` stays plain text |
| My Questionnaires, cell, card, filter chip and options | `questionnaire-list.tsx` | local `statePresentations` | `<StatusBadge family="questionnaire" value={deriveQuestionnaireStatus(state, release)} />`; chip and options via `statusLabel` |
| Questionnaires for review, cell, card, filter chip and options | `questionnaire-review-list.tsx` | local `reviewStatePresentations` (`Awaiting submission` / `Ready for review`); chip showed the raw value | the same derived badge; chip and options via `statusLabel` |
| Requestor questionnaire detail header | `questionnaire-detail.tsx` | ad hoc `In progress` / `Submitted` | `<StatusBadge family="questionnaire" value={submitted ? 'submitted' : questionnaire.state} />` |
| Analyst questionnaire review headers | `questionnaire-review.tsx` | ad hoc `Analyst review` (info) / `Submitted` | `analyst-review` (warning) / `submitted`; the awaiting-submission heading gains the served-state badge |
| Requestor dashboard questionnaire items | `requestor-dashboard.tsx` | local `questionnaireStatePresentations` | `<StatusBadge family="questionnaire" value={item.state} />` (served state, no release field) |
| Assessment status presentation table | `assessment-domain.ts` | `assessmentStatusPresentation` | retired; the shared mapping owns it |
| Request badges (`request-table.tsx`, `request-form.tsx`, `assessment-detail.tsx`, the request cells in `assessment-list.tsx`, dashboard request items) | unchanged call sites | `<StatusBadge status={…} />` | same call, now with `data-tone` and the tone's variant |

## Task Commits

1. **Task 1: Record X-5, create the glossary, build the shared status badge:** `be3ad80` (docs: X-5 and `CONTEXT.md`), `7efe71c` (test, RED: 47 of 47 failing on the missing mapping, derivation, `data-tone` and `family` prop), `e6457f6` (feat, GREEN: 47 of 47)
2. **Task 2: Migrate the assessment and Risk status surfaces:** `7888873` (test, RED: 9 failing), `2d44774` (feat, GREEN)
3. **Task 3: Migrate the questionnaire status surfaces and list each question once:** `2939791` (test, RED: 8 failing), `e327a22` (feat, GREEN)
4. **Task 4: Provider-neutral drafting copy, E2E text updates, full browser run:** `a2e6d3a` (test, RED: 10 failing), `9c96569` (feat, GREEN, with the three planned spec edits), `0f49d0d` (test: the governance journey asserts each question once)
5. **Deferred findings:** `29fd835` (docs: three out-of-scope findings in `deferred-items.md`); the Google Fonts finding is added with this summary.

**Plan metadata:** the `docs(08-07): complete …` commit that carries this summary, STATE and ROADMAP.

## TDD Gate Compliance

Every task has a `test(08-07)` RED commit before its `feat(08-07)` GREEN commit, and each RED was observed failing for the stated reason:

- **Task 1 (`7efe71c`):** 47 of 47 failed. The failures were `statusPresentation` undefined, `deriveQuestionnaireStatus is not a function`, no `data-tone`, and the family badges throwing without a `family` prop. GREEN `e6457f6`: 47 of 47; the 11 files in `components/csrm` passed, 105 tests.
- **Task 2 (`7888873`):** 9 failed, each on the old behaviour: no `data-tone` on the editor, released and Risk headers; the `Approved` option; the em-dash Alert title; untoned treatment chips; the hub tile reading `Approved`. The new request-list guard passed already, because Task 1 had given request badges their tone. GREEN `2d44774`: 18 files, 179 tests; full web suite 74 files, 939 tests.
- **Task 3 (`2939791`):** 8 failed, each on the old behaviour: the `Ready for review` and `Awaiting submission` labels, no section headings, no `data-tone`, the analyst-review badge. **Sensitivity:** with its badge assertions commented out, the analyst-review case still failed with the renderer mounted: `Where is the service hosted?: expected [ Array(2) ] to have a length of 1 but got 2`. The file was then restored with `git checkout --`. GREEN `e327a22`: 20 files, 187 tests; full web suite 74 files, 942 tests.
- **Task 4 (`a2e6d3a`):** 10 failed. Nine failed on the old copy. The timeout case failed by cascade: a once-queued `completed` poll result, left by the RED-failing transitions case, completed its job early. GREEN `9c96569`: 20 of 20; full web suite 74 files, 948 tests.

## Assertions changed deliberately, and why

**Unit (vitest)**

| File | Assertion | Change | Reason |
|---|---|---|---|
| `assessment-list.test.tsx` | assessment status options (was line 137) | `'Approved'` → `'Released'`, plus the option values `approved` etc. asserted unchanged | D-50 / UI-D3; the request options at lines 110 and 122 still say `Approved` |
| `risk-details.test.tsx` | lines 254 and 293 | `'Released assessment — read only'` → `'Released assessment - read only'` | the Risk detail Alert retitle (UI-SPEC section 2 Voice), taken in step with `risk-register-workflow.spec.ts` line 8 |
| `questionnaire-workflow.test.tsx` | review list labels (were lines 355-356) | `Ready for review` ×2 and `Awaiting submission` ×2 → `Submitted` (success) ×2, `Draft` (info) ×2, `Analyst review` (warning) ×2. The fixtures now carry a release fact, and a third unreleased fixture was added. `Customer portal review` 4 → 6 | UI-D4: one derived questionnaire family; the counts follow the three fixtures |
| `questionnaire-workflow.test.tsx` | review filter options | `toHaveTextContent` checks → the exact list `All statuses, Not started, Draft, Submitted` with values | pins that the filter keeps its three served states |
| `assessment-review-workflow.test.tsx` | lines 278, 308, 310, 311, 312, 323, 326 | `Start deterministic draft assistance`, `Draft assistance is running`, `Draft assistance is ready for analyst review`, `Draft assistance lifecycle`, `Open completed assessment`, `Retry draft assistance` → the UI-SPEC section 1.1 strings; the describe title no longer says deterministic | D-08 / UI-D1; the `failureMessage` fixture (server data) is unchanged |

Assertions added, none loosened: `status-badge.test.tsx` (new, 47 tests over all 19 values); the tone of the assessment list's table and card badges; a guard on the request list's tones; the editor header (`In review` warning and `Released` success, both `aria-live="polite"`); the released header and filter option; the Risk detail badge (and none on a mutable Risk); every treatment tone, the clock icon and `Not provided`; the hub tile; the questionnaire grouping, captions and choices (governance test); the Requestor list tone, the detail header across three states, the analyst headers, and the single-list case; the dashboard questionnaire badge never reading `Analyst review`; and every draft-job string, announcement and the absence of `deterministic` or `assistance` in the idle, queued, running, completed and failed states.

**Browser (Playwright)**

| Spec | Line(s) | Change | Reason |
|---|---|---|---|
| `assessment-release-workflow.spec.ts` | 160, 163, 164, 165, 170, 171 | the drafting button, the queued and completed states, the lifecycle list name and the completion link follow UI-SPEC section 1.1; the assertion message no longer says deterministic | D-08 |
| `assessment-release-workflow.spec.ts` | 270 | `getByText('Approved', { exact: true }).first()` → the `.page-header [data-slot="badge"]` reads `Released` with `data-tone="success"` | the header badge reads Released now; the persisted summary `Deterministic assessment assistance identified 3 reviewable risk proposals.` (line 279) is data and stays |
| `assessment-navigation-lifecycle.spec.ts` | 175 | `'Approved'` → `'Released'` in the assessment options | D-50; the request options at 162 and 168 are unchanged |
| `risk-register-workflow.spec.ts` | 8 | `releasedNoticeHeading = 'Released assessment - read only'` | changed together with the `risk-details.tsx` Alert title, before the full run (the plan-check decision) |
| `questionnaire-governance-workflow.spec.ts` | 109-111 | the comment describing the double rendering is replaced, and `toHaveCount(1)` is added beside the visibility check, at both widths | D-32 browser proof; `.first()` would have kept passing silently |

## Files Created/Modified

- `CONTEXT.md` (new): the glossary, one term (Released).
- `docs/design/csrm-design-direction.md`: the X-5 bullet in section 4.
- `apps/web/src/components/csrm/status-badge.tsx` / `.test.tsx` (new test): the mapping, derivation, label helper and badge, and their 47 tests.
- `apps/web/src/features/assessments/`: `assessment-domain.ts` (table retired), `assessment-list.tsx`, `assessment-editor.tsx`, `released-assessment.tsx`, `assessment-draft-job.tsx`, and tests `assessment-list.test.tsx`, `assessment-editor.test.tsx`, `released-assessment.test.tsx`, `assessment-review-workflow.test.tsx`.
- `apps/web/src/features/requests/request-hub.tsx` / `.test.tsx`.
- `apps/web/src/features/risks/`: `risk-details.tsx`, `risk-register.tsx`, and tests `risk-details.test.tsx`, `risk-register.test.tsx`.
- `apps/web/src/features/questionnaires/`: `questionnaire-list.tsx`, `questionnaire-review-list.tsx`, `questionnaire-detail.tsx`, `questionnaire-review.tsx`, `questionnaire-governance.tsx`, and tests `questionnaire-governance.test.tsx`, `questionnaire-workflow.test.tsx`.
- `apps/web/src/features/dashboard/requestor-dashboard.tsx` / `.test.tsx`.
- `apps/web/e2e/`: `assessment-release-workflow.spec.ts`, `assessment-navigation-lifecycle.spec.ts`, `risk-register-workflow.spec.ts`, `questionnaire-governance-workflow.spec.ts`.
- `.planning/phases/08-production-integration-and-hardening/deferred-items.md`: four rows (08-07).

## Decisions Made

See `key-decisions` above. In short:

- Tones drive the Badge variant for every family.
- The per-family tables are private.
- Questionnaire chips and options read the shared labels.
- The released and Risk headers pass values the served facts justify.
- Section ids come from `useId`.
- Server-supplied text is exempt from the copy check.
- A second full run was made instead of inferring a green run from the isolated rerun.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The analyst review list's Status filter chip showed the raw status value**
- **Found during:** Task 3 GREEN
- **Issue:** `questionnaire-review-list.tsx` built its active-filter chip from `resolvedQuery.status`, so choosing Not started showed the chip `Status: not-started`.
- **Fix:** the chip reads `statusLabel('questionnaire', status)`, as My Questionnaires' chip already did through its local map. This is part of moving every label onto the shared mapping.
- **Files modified:** `questionnaire-review-list.tsx`. **Commit:** `e327a22`

### Plan-text deviations

**2. [Plan file list] Test files outside the plan's list.** The plan's RED steps and fail conditions require assertions that live in:
- `assessment-editor.test.tsx`, `released-assessment.test.tsx`, `request-hub.test.tsx` and `risk-details.test.tsx` (the editor header, the released header and filter, the hub tile, and the Risk detail badge and Alert). The last of these also held the two em-dash title assertions the retitle changes.
- `requestor-dashboard.test.tsx` (the fail condition "dashboard items read Analyst review").
- `e2e/questionnaire-governance-workflow.spec.ts`. Its comment described the retired double rendering, and it now carries the browser proof of D-32.

Nothing in them is loosened.

**3. [Plan grep over-broad] Task 2 criterion "`grep -n 'variant="outline"'` … prints nothing".** In the four files the literal grep still matches two pre-existing Button controls, which are not status chips:
- `assessment-editor.tsx` `Add mitigation control`;
- `risk-details.tsx` `Return to workspace` and `Try again`.

The intent check, `grep -nE '<Badge[^>]*variant="outline"'` over the same files, prints nothing. The fail condition ("a status chip … is still `<Badge variant="outline">`") holds.

**4. [Plan grep] Task 3 verify grep matched a code comment.** `questionnaire-review.tsx` had a comment beginning "Awaiting submission is an authorised read…" that names the `awaiting-submission` state, not the retired label. It is reworded to "The awaiting-submission state is…", so the literal grep passes. Commit `e327a22`.

**5. [Environment - not Windows-specific, no harness change] The first full browser run failed one spec on a transient Google Fonts response.**
- **Result:** run 1 (HEAD `0f49d0d`, 396 s) passed 46, failed 1 and did not run 4. The failing test was `design-system-conformance.spec.ts:145` ("renders every guarded dashboard state, ordinary-server boundary, and partial-widget recovery"). Its `expect.poll` for the ordinary `next dev` server's `/sign-in` timed out after 120 000 ms. The other four tests in that serial describe did not run.
- **Diagnosis:** the spawned server's own log (`.tmp/ordinary-next-<pid>/dev/logs/next-development.log`, 113 errors, kept under `apps/web/.tmp/logs/csrm-phase-08/08-07-run1-failure/`) shows every compile of the root layout failing:
  ```
  Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
  next/font/google queries have exactly one entry
  ```
  For Plus Jakarta Sans, Google Fonts had answered with `fonts.gstatic.com/l/font?kit=…&skey=ca4b9e62a7d41df5&v=v12` URLs. Turbopack's dev-mode font file replacer splits the unescaped `&` into several query entries and refuses the request. The production build a few minutes earlier went through the same replacer and still completed, with all three families downloaded as local `woff2` files. Its responses therefore carried no such URLs; that is inferred from the successful build, not observed.
- **Evidence it was transient:** the same stylesheet fetched afterwards with next/font's user agent returned `/s/` URLs. A standalone reproduction of the spec's spawn (same Node, same `next` entry, same environment shape) served `/sign-in` 200 in 4.4 s, with `/s/plusjakartasans` URLs and zero errors.
- **Outcome:** an isolated rerun of the spec passed 5 of 5 (138 s), and a second full run passed 51 of 51.
- **Why no harness change:** the cause is an upstream response plus a Next.js dev-mode parsing gap, not a Windows behaviour. The hermeticity gap (the suite fetches Google Fonts at build and dev-compile time) is recorded in `deferred-items.md` for a decision.

**6. [Windows host] Command translations from the preamble.**
- `/opt/node24/bin` became `/c/ProgramData/nvm/v24.19.0`.
- `PLAYWRIGHT_BROWSERS_PATH` was omitted, so Playwright used its default Chromium.
- The free-port check used `Get-NetTCPConnection`; 1337 and 3000 were free before every run.
- Logs went under `apps/web/.tmp/logs/csrm-phase-08/`.
- `pnpm --filter @csrm/web test -- <pattern>` passes `--` through to vitest, so single files were run with `pnpm --filter @csrm/web exec vitest run <path>`.

**Total deviations:** 1 auto-fixed (Rule 1) and 5 recorded. **Impact on plan:** no scope added beyond evidence and the chip label; no schema, contract, grant, catalogue, Strapi or `CSRM_AI_*` change.

## First run of the production-build harness on Windows

The harness ran unchanged on this host. The Strapi `develop` server was ready after `Loading Strapi` (16.4 s) and `Compiling TS` (2.8 s). The Next production build and `next start` came up inside the web server budget, and the attested runtime signed in. Both full runs and the isolated rerun left `git status --porcelain` empty: `tsconfig.json` was not rewritten, and `next-env.d.ts`, `test-results/` and `apps/web/.tmp/` are ignored. No listener was left on 1337, 3000 or the derived harness ports after any run. Each full run logged 9 `The destination stream closed early.` lines from abandoned streams (the isolated rerun none), the known 08-02 noise.

| Run | HEAD | Wall | Result |
|---|---|---|---|
| Full run 1 | `0f49d0d` | 396 s | 46 passed, 1 failed (Google Fonts, deviation 5), 4 did not run |
| `design-system-conformance.spec.ts` alone | `29fd835` | 138 s | **5 passed** (2.3 min) |
| Full run 2 | `29fd835` | 370 s | **51 passed, 0 failed, 0 flaky** (6.1 min) |

`29fd835` differs from `0f49d0d` only in `deferred-items.md`.

## Verification

| Command | Result |
|---|---|
| `pnpm --filter @csrm/web exec vitest run src/components/csrm/status-badge.test.tsx` | 47 of 47 (after `e6457f6`) |
| Task 2 files (7) plus `src/components/csrm` | 18 files, 179 tests |
| Task 3 files: `src/features/questionnaires`, `src/features/dashboard`, `src/components/csrm` | 20 files, 187 tests |
| `assessment-review-workflow.test.tsx` | 20 of 20 |
| `pnpm --filter @csrm/web test` (final tree) | **74 files, 948 tests passed** (16.1 s); 885 before the plan plus 63 |
| `pnpm --filter @csrm/web typecheck` (`next typegen && tsc --noEmit`) | exit 0 (1,811 files in the program) |
| `pnpm --prefix apps/web api:check` | exit 0, no drift |
| `pnpm --filter @csrm/web test:e2e` | run 2: **51 of 51**, 0 flaky, 370 s; tree clean afterwards |
| `pnpm --filter @csrm/strapi test` (HEAD `29fd835`) | **504 passed / 0 failed**, 0 skipped (506.0 s of tests, 510 s wall); the same count as 08-06, since no Strapi file changed |
| `grep -nE "#[0-9a-fA-F]{3,8}\|[0-9]+px" apps/web/src/components/csrm/status-badge.tsx` | nothing |
| `grep -rn "assessmentStatusPresentation" apps/web/src` | nothing |
| `grep -ciE "deterministic\|assistance" apps/web/src/features/assessments/assessment-draft-job.tsx` | 0 |
| `grep -rn "Search collection" apps/web/src` | still matches `assessment-list.tsx`, as the plan expects (08-08 owns D-30) |
| Freeze diff since `b6ad116` (content types, `specification.json`, both catalogue copies) | empty; no `CSRM_AI_` line changed; no Keycloak line |
| `git status --porcelain` after every commit and every run | empty |

## Known Stubs

None.

## Threat Flags

None. The plan adds no endpoint, grant, data path or trust boundary. The mitigations T-08-07-01 to T-08-07-04 are each asserted:
- **T-08-07-01:** the copy test (`advisory` present; `deterministic` and `assistance` absent in every state) and the unchanged human release flow in the release journey.
- **T-08-07-02:** no renderer in analyst review, so no answers are shown there.
- **T-08-07-03:** exhaustive `satisfies Record` tables and a derivation that returns only the four values.
- **T-08-07-04:** icon and text on every badge, `data-tone` asserted, and the conformance and design-contract suites green.

## Browser backstops for the orchestrator

Restart the dev servers on this code, then check each item below at **375px and 1440px**.

1. **Analyst questionnaire review, analyst-review state.** Sign in as Security Analyst, open `/app/review/questionnaires` and follow `Customer portal questionnaire awaiting release`.
   - The header badge reads `Analyst review` (warning, clipboard-pen icon).
   - The Question editor shows four section captions in mono uppercase: `Service context`, `Data and privacy`, `Hosting and access`, `Third parties`.
   - Each question (eight in the seed) appears exactly once, with its caption, for example `Text · Required` and `Single select · …`.
   - `Choices: …` appears under `Where will the service be hosted?` and `Which categories of personal information will be handled?`.
   - The page has no second read-only questionnaire and no `Questionnaire submitted` notice.
2. **Questionnaires for review list (`/app/review/questionnaires`).**
   - The unreleased fixture reads `Analyst review`; released ones read `Not started` (neutral), `Draft` (info) or `Submitted` (success).
   - The filter still offers `Not started`, `Draft` and `Submitted`.
   - Choosing Not started shows the chip `Status: Not started`, with rows labelled both `Analyst review` and `Not started` (UI-SPEC section 3.4).
3. **Risk Register (`/app/risks`).**
   - Treatment statuses render as tinted badges: `Not Started` neutral, `In Progress` info with a clock, `Complete` success with a check. At 375 they appear on the cards.
   - No treatment badge shows a triangle.
   - The seed has no `Overdue` treatment status. Setting one on the mutable Risk shows the danger badge with the clock-alert icon beside the separate `Urgency: Overdue` date marker.
4. **Risk detail for `RSK-RELEASED-33SAEN`.** The header shows a `Released` success badge beside the two rating badges. The Alert beneath reads `Released assessment - read only`.
5. **Request review drafting card.** As Security Analyst, open a submitted request with a submitted questionnaire under `/app/review/requests`.
   - The card reads `Assessment draft generation` with the advisory description and a `Generate assessment draft` pill.
   - After it runs, the card shows `Draft generation is ready for Security Analyst review` and `Open assessment draft`.
   - The card never says deterministic or assistance.
   - Do not trigger generation against the dev Strapi if its `CSRM_AI_PROVIDER` is a hosted endpoint. A seeded request that already has a job, or the Playwright evidence, suffices.
6. **Assessment surfaces.**
   - `/app/review/assessments` badges are tinted (`Draft` and `In review` warning, `Released` success). Its filter reads `All statuses, Draft, In review, Released, Closed`.
   - A released assessment's editor header reads `Released`.
   - The Requestor's `/app/assessments/{id}` header reads `Released`, and its list's filter option reads `Released`.
7. **Requestor surfaces.** Sign in as Requestor.
   - The `/app/questionnaires` list and a questionnaire detail header read `Not started`, `Draft` or `Submitted`, never `In progress`.
   - The dashboard's `Questionnaires in progress` items show the same badges.

## Next Phase Readiness

- `REQUIREMENTS.md` is unchanged, as in 08-01, 08-02 and 08-05. INT-03 has been complete since Phase 06.7, and D-08 re-verifies it here. INT-04 closes at the phase gate (08-14).
- 08-08 can start. It edits `risk-register.tsx`, where this plan changed only `TreatmentStatus` and its imports, and it extends `risk-register-workflow.spec.ts`, where line 8 now reads `Released assessment - read only`. It runs Playwright, so the dev servers stay stopped.
- The STATE follow-ups this plan closes:
  - the 06.6 status-badge inconsistency;
  - the 06.7 "Deterministic draft assistance" copy;
  - the 06.8 double question list.
- Four findings are recorded in `deferred-items.md`:
  - the empty-state "assistance" wording;
  - the second request-label table;
  - the section heading level;
  - the Google Fonts hermeticity gap.

## Self-Check: PASSED

- `CONTEXT.md`, `status-badge.test.tsx` and this summary exist.
- The eleven plan commits are on `dev`: `be3ad80`, `7efe71c`, `e6457f6`, `7888873`, `2d44774`, `2939791`, `e327a22`, `a2e6d3a`, `9c96569`, `0f49d0d` and `29fd835`.
- The acceptance criteria were re-run on the final tree, 42 checks, all passing. Task 2's literal outline grep is replaced by its intent, an outline `Badge`, as deviation 3 records.
- The verification greps pass. The freeze diff over the content types, `specification.json`, both catalogue copies and `apps/strapi` is empty, and no added or removed line names `CSRM_AI_`.
- Neither this plan's commits nor this summary carry tool attribution or a trailer.

---
*Phase: 08-production-integration-and-hardening*
*Completed: 2026-09-25*
