---
phase: 11-navigation-landing-and-list-clarity
plan: 01
subsystem: ui
tags: [status-mapping, design-direction, glossary, nextjs, vitest, playwright]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "X-1 to X-5 recorded in the design direction (10-01) and Phase 10's passed gate (10-23)"
provides:
  - "X-6 to X-10 recorded in docs/design/csrm-design-direction.md as CSRM extensions dated 2026-09-28"
  - "statusPresentation as the only request status label source; request approved reads Released"
  - "a module-private unknownStatusPresentation fallback in presentationOf (G-13 seam for Phase 17.1)"
  - "the root CONTEXT.md Released entry saying a released request also reads Released"
  - "PHASE_11_BASE=9f95575 for the 11-21 phase gate"
affects: [11-02, 11-03, 11-07, 11-09, 11-10, 11-12, 11-14, 11-21, 17.1]

actuals:
  tokens: 10200
  tasks: 2
  commits: 5
plan_head_before: 9f95575d57404350b00ad2ad07e2015a2bbc9384
plan_head_after: bc0b6ebf06afde00a07b53306901b831a1c9f602

tech-stack:
  added: []
  patterns:
    - "Every request status label is read through statusLabel('request', status) from components/csrm/status-badge; request-domain keeps only requestStatuses for order"
    - "presentationOf returns the family entry, else a sentence-case neutral fallback with CircleIcon"

key-files:
  created: []
  modified:
    - docs/design/csrm-design-direction.md
    - CONTEXT.md
    - apps/csrm/src/components/csrm/status-badge.tsx
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-table.tsx
    - apps/csrm/src/features/assessments/assessment-list.tsx
    - apps/csrm/src/features/dashboard/requestor-dashboard-service.ts
    - apps/csrm/src/features/reports/report-presentation.ts
    - apps/csrm/src/components/csrm/status-badge.test.tsx
    - apps/csrm/src/components/csrm/feedback-composites.test.tsx
    - apps/csrm/src/features/assessments/assessment-list.test.tsx
    - apps/csrm/src/features/assessments/assessment-status-filters.test.tsx
    - apps/csrm/src/features/dashboard/requestor-dashboard.test.tsx
    - apps/csrm/src/features/reports/report-presentation.test.ts
    - apps/csrm/src/features/reports/report-views.test.tsx
    - apps/csrm/src/features/requests/request-table.test.tsx
    - apps/csrm/e2e/assessment-navigation-lifecycle.spec.ts

key-decisions:
  - "11-01: the request family's approved label is Released, with its CircleCheck icon and success tone unchanged; the stored approved, status=approved and the API are unchanged (D-46)"
  - "11-01: requestStatusPresentation is retired; every request status label reads statusLabel('request', status) from status-badge.tsx, and request-domain keeps requestStatuses for order (G-13 seam: Phase 17.1 adds a request status by adding one entry)"
  - "11-01: presentationOf falls back, for every family, to the value with hyphens as spaces and its first letter capitalised, the neutral tone and CircleIcon; the StatusBadge status prop now goes through the same path"
  - "11-01: X-6 to X-10 are recorded verbatim from 11-UI-SPEC.md; X-9 sits under a new '### Lifecycle stepper' heading directly before '### Dialogs'"

patterns-established:
  - "Status labels: feature code passes a family and a value to statusLabel or StatusBadge and never keeps its own label map"

requirements-completed: []

coverage:
  - id: D1
    description: "X-6 to X-10 recorded in the design direction with the UI-SPEC's exact wording, before any Phase 11 code uses them"
    requirement: "UX-09"
    verification:
      - kind: other
        ref: "grep -F of the five '(CSRM extension, 2026-09-28)' labels and '### Lifecycle stepper' in docs/design/csrm-design-direction.md; node apps/csrm/scripts/verify-design-spec-authority.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A released request reads Released in its badge, the review queue and My requests status options, the Status chip, the Requestor dashboard lifecycle counts and the throughput lifecycle row, from the one mapping, while the URL keeps status=approved"
    requirement: "UX-09"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/csrm/status-badge.test.tsx#the request and assessment labels"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-table.test.tsx#labels a released request Released in its badge, the status options and the chip, while the URL keeps approved (D-46)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-list.test.tsx; assessment-status-filters.test.tsx; requestor-dashboard.test.tsx; report-presentation.test.ts; report-views.test.tsx"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-navigation-lifecycle.spec.ts#an Analyst status choice outside the queue shows the empty filtered list, not an error (UX09_RELEASED_REQUEST_LABEL)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A status value outside a family's vocabulary renders a sentence-case label, the neutral tone and an icon instead of throwing (G-13 seam)"
    verification:
      - kind: unit
        ref: "apps/csrm/src/components/csrm/status-badge.test.tsx#renders a status outside the vocabulary as the neutral badge with an icon and its label"
        status: pass
    human_judgment: false
  - id: D4
    description: "The root CONTEXT.md Released entry says a request whose stored status is approved also reads Released"
    requirement: "UX-09"
    verification:
      - kind: other
        ref: "grep -q 'also reads \"Released\"' CONTEXT.md"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 01: Released request label and the X-6 to X-10 direction entries Summary

**A released request now reads "Released" everywhere a request status shows, through the one `statusPresentation` mapping with a sentence-case fallback for unknown values, and the design direction carries X-6 to X-10.**

PHASE_11_BASE=9f95575

## Performance

- **Duration:** 9 min (wall clock on the host's clock; the full web suite and the Playwright run are inside it)
- **Started:** 2026-10-03T00:27:46Z
- **Completed:** 2026-10-03T00:36:50Z
- **Tasks:** 2 of 2
- **Files modified:** 17

## Accomplishments

- Recorded X-6 (Sidebar sections, counts and primary action), X-7 (Keyboard shortcut hint), X-8 (Quick find), X-9 (Compact lifecycle stepper, under a new `### Lifecycle stepper` heading before `### Dialogs`) and X-10 (Figure links) verbatim from 11-UI-SPEC.md, before any implementing task. Nothing else in the direction changed.
- `requestFamily.approved.label` is `Released` (icon `CircleCheck`, tone success, unchanged). The duplicate `requestStatusPresentation` in `request-domain.ts` is gone. The My requests table (options and chip), the review queue (options and `statusLabelFor`), the Requestor dashboard tile labels and the throughput lifecycle rows all read `statusLabel('request', status)`.
- `presentationOf` returns the family entry, or `unknownStatusPresentation(value)`: the value in sentence case with hyphens as spaces, the neutral tone and `CircleIcon`. `StatusBadge`'s `status` prop goes through the same path, so an unlabelled request status renders instead of throwing.
- In `CONTEXT.md`, the `Released (Risk Assessment status)` entry's "Only the displayed label changes." paragraph now says that a request whose stored status is `approved` also reads "Released". The `Closed` entry is unchanged.
- E19: the browser assertions now expect `Released` and `Status: Released`, and the URL still carries `status=approved`. `UX09_RELEASED_REQUEST_LABEL` proves that the released request's row badge in the filtered Released queue reads `Released`.

## Task Commits

1. **Task 1: Record X-6 to X-10, then a released request reads "Released" through the one mapping (tracer, TDD)**
   - `1e36e6d`: docs(11-01), the five direction entries
   - `a52684b`: test(11-01), RED
   - `77da8a9`: feat(11-01), GREEN
2. **Task 2: Glossary and browser assertions**
   - `237d0fe`: docs(11-01), the glossary sentence
   - `bc0b6eb`: test(11-01), the E2E assertions

Commits measured from the ledger: `git rev-list --count 9f95575..bc0b6eb` = 5. Every commit ends with the required `Co-Authored-By` trailer (checked).

## TDD Gate Compliance

- RED `a52684b` comes before GREEN `77da8a9`. No refactor commit was needed.
- RED evidence: `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed) for `status-badge.test.tsx`, "the request and assessment labels > labels a released request Released, as a released assessment, and keeps Closed" (expected `Released`, received `Approved`).
- The RED run over all 8 RED files failed 14 tests, every one on a label or fallback assertion: `Approved` received where `Released` was expected, or `TypeError` thrown where the fallback was expected. There were no load or syntax failures.

## Test Counts

| Run | Result |
|---|---|
| RED, 8 files (`status-badge`, `feedback-composites`, `assessment-list`, `assessment-status-filters`, `requestor-dashboard`, `report-presentation`, `report-views`, `request-table`) | 14 failed, 128 passed (142): the intended failures |
| GREEN: the plan's verify set (the 7 RED files, all of `src/features/requests`, `zod-client-boundary`) | 18 files, 220/220 passed; typecheck clean |
| Tracer gate re-run of the Task 1 verify | 18 files, 220/220; typecheck clean |
| Full web suite (`pnpm --dir apps/csrm test`) | 134 files, 2,867/2,867 passed |
| `typecheck` (also the `lint` script: `next typegen && tsc --noEmit`) | clean |
| `api:check` | exit 0; `schema.d.ts` unchanged after `git update-index --refresh` (no contract change) |
| `verify-design-spec-authority.mjs` | passed |
| Playwright `e2e/assessment-navigation-lifecycle.spec.ts` | 4 passed (desktop 3, mobile 1), 0 failed, 0 flaky, 0 skipped; 1.1 min. The tree was clean afterwards |

The Strapi suite was not run: this plan changes no Strapi file.

## Files Created/Modified

- `docs/design/csrm-design-direction.md`: X-6 to X-10.
- `CONTEXT.md`: the replaced sentence of the `Released` entry.
- `apps/csrm/src/components/csrm/status-badge.tsx`: the request label `Released`, `unknownStatusPresentation`, `presentationOf` with the fallback, and the updated family comment.
- `apps/csrm/src/features/requests/request-domain.ts`: `requestStatusPresentation` removed.
- `apps/csrm/src/features/requests/request-table.tsx`, `assessments/assessment-list.tsx`, `dashboard/requestor-dashboard-service.ts`, `reports/report-presentation.ts`: these read `statusLabel('request', …)`.
- Unit tests: `status-badge`, `feedback-composites`, `assessment-list`, `assessment-status-filters`, `requestor-dashboard`, `report-presentation`, `report-views`, `request-table`.
- `apps/csrm/e2e/assessment-navigation-lifecycle.spec.ts`: E19 and `UX09_RELEASED_REQUEST_LABEL`.

## Decisions Made

- The fallback applies to every family (`presentationOf` is shared), not only the request family. It shows only the status value, which the closed parsers already accepted (T-11-12).
- Imports: `requestor-dashboard-service.ts` and `report-presentation.ts` use relative paths to `../../components/csrm/status-badge`, because both files already import relatively. `request-table.tsx` and `assessment-list.tsx` use the `@/` alias they already used.
- The review queue's `Released` bucket and the request status option `Released` now share a word. UI-SPEC §10 keeps the bucket, so tests read the status option inside its own select.
- `UX-09` stays open: `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing coverage] Added a My requests proof in `request-table.test.tsx`**
- **Found during:** Task 1, RED
- **Issue:** The behaviour names the My requests status options and chip, but none of the plan's listed test files covered `request-table.tsx`.
- **Fix:** New test: the badge, the `approved` option labelled `Released`, choosing it writes `status=approved` to the URL, and the chip reads `Status: Released`.
- **Files modified:** `apps/csrm/src/features/requests/request-table.test.tsx`
- **Verification:** It failed in RED (`Approved`) and passes in GREEN.
- **Committed in:** `a52684b`

**2. [Rule 1 - Test ambiguity] Scoped the queue test's `Released` option to the status select**
- **Found during:** Task 1, RED
- **Issue:** `assessment-list.test.tsx`'s `getByRole('option', { name: 'Approved' })` would become ambiguous as `Released`, because the queue select also has a `Released` option.
- **Fix:** The test reads the option inside `Filter by status` and asserts its value is `approved`.
- **Committed in:** `a52684b`

**3. [Scope note] Two of the listed "Approved" lines were left unchanged on purpose**
- `status-badge.test.tsx` ("labels the released assessment Released…") and `assessment-list.test.tsx` (the assessment list's badge test) assert that `Approved` is absent from assessment surfaces. Both stay true and stay as written.
- One test title in `assessment-status-filters.test.tsx` now says "when Released is chosen", to match the label.
- `request-hub.test.tsx`'s `/Approved/` absence assertion and the `Approved without release` fixture title in `requestor-dashboard.test.tsx` are not request-status labels. They are unchanged.

**4. [Rule 2 - Strengthened proof] Extra E2E assertions for decision 16**
- **Found during:** Task 2
- **Fix:** The spec now asserts that the `Released` option's `value` is `approved`, that the URL keeps `status=approved` after switching to the Released queue, and that the chip still reads `Status: Released` there.
- **Committed in:** `bc0b6eb`

**5. [Tooling] Worked around a RED-evidence parser defect**
- **Issue:** The gsd-core RED-evidence JUnit parser reads `name="…"` inside `classname="…"`, so vitest's JUnit output reports every failure under the file name.
- **Fix:** The evidence was validated on a scratch copy with the testcase attributes reordered name-first. The XML content is otherwise unchanged. Nothing in the repository was affected.

---

**Total deviations:** 4 auto-fixed or strengthened (2 coverage or proof additions, 1 test ambiguity, 1 scope note) and 1 tooling workaround.
**Impact on plan:** No scope creep. Every change proves or protects the D-46 label change.

## Issues Encountered

- During the Playwright run, the Next web server logged `Error: The destination stream closed early.` twice. Every test passed, and this plan only changes a label, so the log line is not caused by it. It is noted here and was not investigated.
- `sed -i` on Git Bash rewrote the edited files' working copies with LF. `core.autocrlf` normalises them, so the commits and diffs are unaffected and the tree is clean.

## Known Stubs

None.

## Threat Flags

None. T-11-11 is mitigated: only the label changed, and the E2E asserts `status=approved` in the filtered URL. T-11-12 is accepted as planned. T-11-SC: no package was added.

## User Setup Required

None.

## Next Phase Readiness

- Ready for 11-02. `PHASE_11_BASE=9f95575` is recorded for the 11-21 phase gate.
- Phase 17.1 adds a request status by adding one entry to `requestFamily`, and `requestStatuses` gains the value. A value added before its label renders through the fallback.

## Self-Check: PASSED

- All six key files checked exist on disk (`[ -f ]`).
- Commits `1e36e6d`, `a52684b`, `77da8a9`, `237d0fe` and `bc0b6eb` exist.
- Every acceptance criterion of both tasks re-ran PASS: the five extension labels and the heading, `requestStatusPresentation` absent from `apps/csrm/src` and `apps/csrm/app`, the mapping line and `CircleIcon`, `Awaiting acceptance`, `also reads "Released"`, and `Status: Released`, `UX09_RELEASED_REQUEST_LABEL` and `status=approved` in the spec.
- `git status --short` shows only the three operator items.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
