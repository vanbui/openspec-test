---
phase: 10-existing-flow-gap-closure
plan: 04
subsystem: ui
tags: [nextjs, react, request-pages, server-state, revert-to-draft, local-time, copy, vitest, playwright]

requires:
  - phase: 10-01
    provides: "LocalInstant, useViewerTimeZone, TimeZoneProvider and formatInstant (D-19), and the X-4 spaced middle dot"
  - phase: 10-02
    provides: "the analyst route gate and plain permission copy in assessment-detail.tsx, and the interface copy guard"
  - phase: 10-03
    provides: "wave ordering on the shared E2E ports"
provides:
  - "RequestContextDetails({ request }) in apps/csrm/src/features/requests/request-context-details.tsx: the read-only request context both actors read, grouped Request overview, Business context, Scope and timing, with local submitted and updated dates and the revert summary last"
  - "canRevertRequestToDraft(request) in the zod-free request-domain.ts: submitted with questionnaire and assessment relations both absent; fails closed without relationships"
  - "RequestWorkflowActions with no local submitted state: every transition calls router.refresh(), the refreshed request decides the actions, and focus moves to the first new action or #request-actions"
  - "id=\"request-actions\" and tabIndex={-1} on the Requestor page's Request actions region"
  - "UI-SPEC 8.1 and 9.3 copy on the request pages and form; the hub's plain description, middle dot and Risks tally"
  - "six request and time files added to the interface copy guard"
  - "REQ07_ANALYST_SEES_SUBMITTED_FIELDS and REQ07_ACTIONS_REFRESH_AFTER_REVERT in the Requestor journey; E6 and E15 changed"
affects: [10-05, 10-06, 10-09, 10-10, 10-12, 10-14, 10-23, requests, assessments]

actuals:
  tokens: 11500
  tasks: 3
  commits: 6
plan_head_before: 57894d4a4f6d2ada97e797a7081ee15f45fe3197
plan_head_after: 7dc91880e5db488166f1c84253bec8e0f8b4814f

tech-stack:
  added: []
  patterns:
    - "Request actions come only from the served request: a transition sets a ref, refreshes the route, and an effect keyed on the refreshed status moves focus once; nothing in local state overrides the prop"
    - "Backward actions are offered from zod-free predicates over served relationships (never the legacy nullable fields), and fail closed when relationships are missing"
    - "One shared read-only record component serves both actors' pages, so neither reads less than the other"

key-files:
  created:
    - apps/csrm/src/features/requests/request-context-details.tsx
    - apps/csrm/src/features/requests/request-context-details.test.tsx
  modified:
    - apps/csrm/app/(app)/app/requests/[documentId]/page.tsx
    - apps/csrm/src/features/assessments/assessment-detail.tsx
    - apps/csrm/src/features/requests/request-workflow-actions.tsx
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-hub.tsx
    - apps/csrm/src/features/requests/request-form.tsx
    - apps/csrm/src/features/requests/request-workflow.test.tsx
    - apps/csrm/src/features/requests/request-hub.test.tsx
    - apps/csrm/src/features/requests/request-form.test.tsx
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/requestor-request-workflow.spec.ts
    - apps/csrm/e2e/request-relationship-states.spec.ts

key-decisions:
  - "The Requestor's Submitted {date} paragraph formats through formatInstant with useViewerTimeZone as one string, not <LocalInstant>: the same helper and zone, but one text node, so the status badge stays the only element whose text is Submitted and the journey's /^Submitted \\d{1,2} \\w{3,4} \\d{4}$/ check is unchanged. The form notice and every other surface use LocalInstant"
  - "The started-work hint shows only when the request carries relationships; a request read without them (older direct callers) shows no hint rather than a claim the page cannot back"
  - "The hub keeps its Submitted date label and drops only the UTC formatting: the plan's 'without a label' is read as UI-SPEC 4.1's 'never a zone suffix'"
  - "The analyst hub keeps the revert control where it was (after the hub, before the request context), now behind canRevertRequestToDraft; the request context sits in the page's grid gap-6 container, full width, as quick tasks 261001-kxa and 261001-le4 left it"
  - "The in-page journey step also asserts focus on Edit request after the revert (UI-SPEC 9.2) and the allowed hint after the second submit"

patterns-established:
  - "Focus after a transition the component started: a ref set on success, an effect keyed on the refreshed status, the first a[href] or enabled button, else the region; never on first render"

requirements-completed: [REQ-07, UX-06]

coverage:
  - id: D1
    description: "Both request pages render one RequestContextDetails with every submitted field in the form's three groups, Not provided and None selected for empty values, lists one per line, local submitted and updated dates and the calendar due date"
    requirement: REQ-07
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-context-details.test.tsx#RequestContextDetails"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#shows the analyst every submitted request field in the request form’s groups"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/requestor-request-workflow.spec.ts#REQ07_ANALYST_SEES_SUBMITTED_FIELDS (desktop and mobile)"
        status: pass
    human_judgment: false
  - id: D2
    description: "After an in-page submit and a return to draft in the same page session, the Requestor sees Edit request and Submit request without reloading, focus moves to the first new action, and router.refresh runs after each transition (UAT-037)"
    requirement: REQ-07
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-workflow.test.tsx#shows the refreshed request’s actions after an in-page submit and a return to draft, and moves focus to them"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/requestor-request-workflow.spec.ts#REQ07_ACTIONS_REFRESH_AFTER_REVERT (desktop and mobile)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Return to draft is offered to either actor only while the request is submitted with no questionnaire and no assessment relation, from canRevertRequestToDraft; missing relationships fail closed"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-workflow.test.tsx#canRevertRequestToDraft"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx#withholds the analyst reversal once a questionnaire exists, keeping the gap around both generation cards"
        status: pass
    human_judgment: false
  - id: D4
    description: "Neither submission dialog calls the step irreversible; both use the UI-SPEC 8.1 description, the form's submitted notice and the two hints follow 8.1, and the sponsor sentence follows 9.3"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-form.test.tsx#preserves draft values and confirms submission, saying how to return to draft"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-workflow.test.tsx#explains that a request can no longer return to draft once a Security Analyst has started work"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/requestor-request-workflow.spec.ts (E6 dialog copy)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The hub reads Where this request stands and what happens next, joins number and title with a spaced middle dot, counts Risks by residual rating, and shows the local submitted date; the copy guard scans the request files"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-hub.test.tsx#RequestHub"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/request-relationship-states.spec.ts (E15, 375 and 1440)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The grouped request context reads well at 375 and 1440 for both actors (spacing, wrapping of long third-party and regulatory text)"
    verification: []
    human_judgment: true
    rationale: "Visual quality at the G-4 bar is judged by the pilot's walk of both actors at 375 and 1440 in plan 10-23 Task 2; tests prove content, structure and no horizontal overflow only"

duration: 15min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 04: Request pages, server-state actions and submission copy Summary

**One shared RequestContextDetails shows both actors every submitted field in the form's groups; the Requestor's actions now come only from the refreshed request (UAT-037); one zod-free canRevertRequestToDraft decides Return to draft on both pages; and the request dialogs, hints and hub drop "irreversible" and internal terms and show local dates.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-10-02T03:05:50Z
- **Completed:** 2026-10-02T03:20:51Z
- **Tasks:** 3 of 3
- **Files modified:** 15 (2 created, 13 modified)

## Accomplishments

- **D-20, UAT-015:** `RequestContextDetails` renders Request overview (Description, Assessment type, Division, Business unit), Business context (Business purpose, Business criticality, Third-party involvement Yes/No, Third-party details, Regulatory requirements) and Scope and timing (Due date, Submitted, Last updated, Information systems, Information assets). Both `/app/requests/{id}` and `/app/review/requests/{id}` render it full width with the description `The details submitted with this request.`. The analyst's six-field list and the Requestor page's inline list are gone.
- **D-21, UAT-037:** `RequestWorkflowActions` keeps no submitted state. Submit and return to draft both call `router.refresh()`, and the refreshed request decides the action set. Focus moves to the first new control, or to the `#request-actions` region (`tabIndex={-1}`), and never moves on first render.
- **D-22 (request side):** `canRevertRequestToDraft` covers both the Requestor's actions and the analyst hub. The analyst hub no longer offers Return to draft once a questionnaire exists, which Strapi would refuse.
- **D-15, D-19, D-38, D-43:** both submit dialogs, the form's submitted notice, the two hints, the sponsor sentence, the hub description, the `·` join and the Risks tally follow UI-SPEC 8.1 and 9.3. The request's submitted and updated instants show the viewer's local date. The copy guard now scans `local-time.tsx`, `request-context-details.tsx`, `request-domain.ts`, `request-form.tsx`, `request-hub.tsx` and `format-instant.ts`.
- **Journey (E6, plus the new in-page revert step):** the Requestor now enters third-party details and regulatory requirements, unique to the run. After the in-page submit, without reloading, they return the request to draft and see Edit request (focused) and Submit request, then submit again. The analyst then reads both values under Business context. **E15:** the relationship journey reads `Risks by residual rating` and `{rating} residual Risks: n`.

## Task Commits

1. **Task 1: One request context for both actors (tracer)**: `1f597a4` (test, RED), `22a518d` (feat, GREEN)
2. **Task 2: Actions from server state, one revert rule, truthful submission copy**: `a17bafc` (test, RED), `1d7b49d` (fix, GREEN)
3. **Task 3: Hub copy and local dates, the copy guard list, both journeys**: `7380bad` (test, RED), `7dc9188` (fix, GREEN)

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Tests run

| Run | Result |
| --- | --- |
| RED, Task 1: `vitest run request-context-details.test.tsx assessment-review-workflow.test.tsx` | 1 failed / 32 passed. The new component file failed to resolve, which is the plan's stated RED (the component did not exist). The hub case failed on `toHaveAccessibleDescription` (old description, six fields). `check tdd-red-evidence`: RED_EVIDENCE_OK |
| GREEN, Task 1 verify: the two files plus `request-routes.test.tsx`, `zod-client-boundary.test.ts`; typecheck | 4 files, 59/59; typecheck clean |
| Tracer gate (interactive, end-of-phase, automated-only verify) | re-run green, expanded to Task 2 |
| RED, Task 2: `vitest run request-workflow.test.tsx request-form.test.tsx assessment-review-workflow.test.tsx` | 14 failed / 42 passed. Predicate rows: not a function. Rerender, hint, form copy and analyst-hub cases: assertion failures. `check tdd-red-evidence` on the analyst-hub questionnaire case: RED_EVIDENCE_OK |
| GREEN, Task 2 verify; typecheck | 3 files, 56/56; typecheck clean |
| RED, Task 3: `vitest run src/features/requests interface-copy-guard.test.ts` | 5 failed / 72 passed (three hub cases, plus the guard naming `request-form.tsx:271, 289` and `request-hub.tsx:73, 91`). `check tdd-red-evidence`: RED_EVIDENCE_OK |
| GREEN, Task 3 unit verify | 10 files, 77/77 |
| Playwright `e2e/requestor-request-workflow.spec.ts e2e/request-relationship-states.spec.ts`, production build, no dev servers | **10 passed, 0 failed, 0 flaky, 0 skipped, 2.3 min**: desktop 9 (six relationship-state cases and two hub cases at 375 and 1440, plus the journey), mobile 1 (the journey) |
| Tree after Playwright | clean apart from the three operator items (D-48) |
| Full web suite `pnpm --dir apps/csrm test` | 118 files, **2,171/2,171**, 29.9 s |
| `typecheck`, `lint`, `api:check` (then `git update-index --refresh` on `schema.d.ts`) | all clean; `schema.d.ts` unchanged |

The Playwright counts per project are desktop 9 and mobile 1 (10 in all), as the run log lists them (`[desktop]` tests 1 to 9, `[mobile]` test 10). The WebServer log shows `Error: The destination stream closed early` twice. This is pre-existing harness noise from aborted render streams on navigation: 10-02's journey run logged it 4 times, and the 10-01 to 10-03 full runs 46 to 61 times. No test failed.

## Files Created/Modified

- `apps/csrm/src/features/requests/request-context-details.tsx` (new): the shared, zod-free, grouped read-only request context.
- `apps/csrm/src/features/requests/request-context-details.test.tsx` (new): groups, every field, empty values, lists, local dates in a Brisbane provider, the revert summary last.
- `apps/csrm/app/(app)/app/requests/[documentId]/page.tsx`: renders `RequestContextDetails`; `DetailItem` removed; `#request-actions` with `tabIndex={-1}`.
- `apps/csrm/src/features/assessments/assessment-detail.tsx`: renders `RequestContextDetails` in place of `DetailValue` and its list; reversal behind `canRevertRequestToDraft`.
- `apps/csrm/src/features/requests/request-domain.ts`: `canRevertRequestToDraft`.
- `apps/csrm/src/features/requests/request-workflow-actions.tsx`: no local submitted state; refresh after each transition; the focus effect; the 8.1 description and hints; a local submitted date.
- `apps/csrm/src/features/requests/request-form.tsx`: the 8.1 description, the notice with a local date, the sponsor sentence, and the unused tile's 9.3 strings.
- `apps/csrm/src/features/requests/request-hub.tsx`: the 9.3 description, `·`, the Risks tally, and the local submitted date.
- Tests: `request-workflow.test.tsx`, `request-form.test.tsx`, `request-hub.test.tsx`, `assessment-review-workflow.test.tsx`, `interface-copy-guard.test.ts`.
- Journeys: `requestor-request-workflow.spec.ts` (third-party input, E6, the in-page revert step, the analyst check), `request-relationship-states.spec.ts` (E15).

## Decisions Made

See `key-decisions` above. In short:
- the Requestor's `Submitted {date}` is one string through `formatInstant`;
- the started-work hint needs served relationships;
- the hub keeps its `Submitted date` label;
- the analyst revert control keeps its place;
- the journey also checks focus after the in-page revert.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A pre-existing analyst test asserted the reversal that D-22 removes**
- **Found during:** Task 2 (RED)
- **Issue:** `assessment-review-workflow.test.tsx` "keeps the same gap around the analyst reversal and the generation cards" rendered a submitted request with a submitted questionnaire and expected `Return to draft`. Strapi refuses that revert, so after D-22 the test would assert a wrong offer.
- **Fix:** the test is split. "keeps the same gap around the analyst reversal and the questionnaire generation card" covers no questionnaire. "withholds the analyst reversal once a questionnaire exists, keeping the gap around both generation cards" is the plan's new case. A third case covers a questionnaire the analyst cannot open (`unavailable`). The layout assertions (grid gap-6, no child margins) are kept.
- **Files modified:** `apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx`
- **Committed in:** `a17bafc`

**2. [Rule 1 - Bug] Two test fixtures relied on the legacy revert fields**
- **Found during:** Task 2 (RED)
- **Issue:** `request-form.test.tsx`'s "offers the primary return-to-draft trigger first" fixture had no `relationships`, so the fail-closed predicate would hide the trigger it asserts.
- **Fix:** the fixture gains `relationships` with both relations `absent`, as every production read serves.
- **Files modified:** `apps/csrm/src/features/requests/request-form.test.tsx`
- **Committed in:** `a17bafc`

**3. [Plan wording] The Requestor's submitted date: formatInstant instead of LocalInstant**
- **Found during:** Task 2 (GREEN)
- **Issue:** inside the paragraph, `<LocalInstant>` split `Submitted {date}` into a text node and a `<time>`. Two existing tests then found `Submitted` twice: the badge and the paragraph's own text.
- **Fix:** the paragraph is one string formatted by the same shared helper and viewer zone (`formatInstant` with `useViewerTimeZone`). D-19 is honoured and the rendered text is unchanged.
- **Files modified:** `apps/csrm/src/features/requests/request-workflow-actions.tsx`
- **Committed in:** `1d7b49d`

---

**Total deviations:** 3: two test corrections forced by D-22's fail-closed rule, and one equivalent formatting choice.
**Impact on plan:** none on scope. Every acceptance criterion passes.

## Issues Encountered

None blocking. RED for Task 1's new component was "module not found", which the plan names as the expected RED. The hub case in the same run failed on its assertion.

## Known Stubs

None. The unused `AssessmentRelationshipTile` in `request-form.tsx` received the 9.3 strings. Removing it stays out of scope (UI-SPEC Notes carried).

## Threat surface

No new surface. T-10-09 is mitigated: the predicate reads only served relationships and fails closed, and Strapi still decides. T-10-10 is mitigated: the submitted-state override is gone, and a rerender test covers submit then revert. T-10-08 is accepted: the analyst sees only fields the existing authorised read already served.

## User Setup Required

None.

## Next Phase Readiness

- Plan 10-05 (questionnaire half of D-15 and D-22) can mirror `canRevertRequestToDraft` in its new zod-free questionnaire predicates and append its files to the copy guard.
- Plan 10-06 adds the conflict reason codes that these Return to draft dialogs will display.
- The pilot's 375/1440 walk (10-23 Task 2) should look at the grouped request context on both actors' pages (coverage D6).

## Self-Check: PASSED

- FOUND: `apps/csrm/src/features/requests/request-context-details.tsx`, `apps/csrm/src/features/requests/request-context-details.test.tsx`
- FOUND commits: `1f597a4`, `22a518d`, `a17bafc`, `1d7b49d`, `7380bad`, `7dc9188`
- Every task's acceptance criteria re-run: 24/24 PASS. The plan's `<verification>` passed: full web suite, typecheck and `api:check`, and both request journeys on the production build.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
