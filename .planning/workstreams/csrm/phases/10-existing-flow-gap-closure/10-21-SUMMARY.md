---
phase: 10-existing-flow-gap-closure
plan: 21
subsystem: ui
tags: [nextjs, react, release-readiness, copy, accessibility, playwright, vitest]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-02's copy guard and permission descriptions; 10-15 to 10-20's assessment editor (shared released Risk, pickers, save confirmations) and release journey"
provides:
  - "release-readiness-summary.ts (zod-free): summarizeReleaseReadiness and missingCaption"
  - "The Release readiness card: outstanding assessment items, one row per Risk with a Missing caption, met items on demand"
  - "DetailSection headingFocusable prop; focusable readiness destinations (UI-D27)"
  - "Plain assessment editor and Risk Register detail copy, both under the copy guard"
  - "Journey proof ASSESS06_READINESS_BY_RISK (E10); E13 checked"
affects: [10-22, 10-23, phase-11, phase-17.1, phase-18]

actuals:
  tokens: 14950
  tasks: 3
  commits: 5
plan_head_before: b18cf2c9bb9a1bbc0b6f7998203d96c5a19622e8
plan_head_after: 27bae94f99e9826059989b81eee40c00c1515b33

tech-stack:
  added: []
  patterns:
    - "Readiness grouping lives in a zod-free domain module; the card only renders it"
    - "A composed link name is set with aria-label when it must read exactly (a visually hidden separator is padded with spaces by accessible-name computation)"
    - "In-page link destinations take tabIndex=-1 so fragment navigation moves focus (DetailSection headingFocusable, Risk cards)"

key-files:
  created:
    - apps/csrm/src/features/assessments/release-readiness-summary.ts
    - apps/csrm/src/features/assessments/release-readiness-summary.test.ts
  modified:
    - apps/csrm/src/components/csrm/detail-section.tsx
    - apps/csrm/src/components/csrm/section-composites.test.tsx
    - apps/csrm/src/features/assessments/assessment-editor.tsx
    - apps/csrm/src/features/assessments/assessment-editor.test.tsx
    - apps/csrm/src/features/risks/risk-details.tsx
    - apps/csrm/src/features/risks/risk-details.test.tsx
    - apps/csrm/src/lib/performance/interface-copy-guard.test.ts
    - apps/csrm/e2e/assessment-release-workflow.spec.ts

key-decisions:
  - "Risk readiness rows take their exact name `{risk number}: {n} outstanding` (and `{n} met`) from aria-label, not a visually hidden `: `, because accessible-name computation pads the absolutely positioned sr-only span with spaces; the Missing caption is the link's description"
  - "The met list is always rendered and toggled with the hidden attribute, so the toggle's aria-controls always resolves"
  - "Following a readiness link relies on native fragment navigation to move focus to a tabIndex=-1 destination; no click handler"
  - "The count line alone is the polite live region; the lists are not announced on every refresh"

patterns-established:
  - "headingFocusable: a DetailSection heading that is an in-page link destination"

requirements-completed: [ASSESS-06, UX-06]

coverage:
  - id: D1
    description: "Release readiness lists outstanding assessment items first, then one row per Risk with its outstanding count and Missing caption, each linking to the Risk; the N of M line is unchanged"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/release-readiness-summary.test.ts"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#lists outstanding assessment items first, then one row per Risk saying what is missing (D-35, UI-SPEC §14.1)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS06_READINESS_BY_RISK"
        status: pass
    human_judgment: false
  - id: D2
    description: "Met items show only when the analyst asks (Show met requirements / Hide met requirements, aria-expanded, aria-controls, print-hidden)"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#shows met items only when the analyst asks, and hides them again (D-35)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS06_READINESS_BY_RISK the met requirements show on demand"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every readiness destination is focusable and following a link moves focus there (UI-D27)"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#makes every readiness destination focusable, so following a link moves focus there (UI-D27)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/components/csrm/section-composites.test.tsx#makes a section heading an in-page link destination only when asked (UI-D27)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS06_READINESS_BY_RISK following a Risk row moves focus to its Risk"
        status: pass
    human_judgment: false
  - id: D4
    description: "No readiness control is named with save, add, edit, remove or release except Release assessment (UI-D19)"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#names no readiness control with save, add, edit, remove or release but Release assessment (UI-D19)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#released editor has no mutation-named button (E13)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Assessment editor and Risk Register detail copy follows UI-SPEC §14.1, §17.1 and D-45; the copy guard covers both files and the new module"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/lib/performance/interface-copy-guard.test.ts"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#describes the released, closed and otherwise read-only assessment without internal terms (D-38)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/risks/risk-details.test.tsx#says when a Risk has no statement recorded, in its header (UI-SPEC §17.1)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Readiness backstop: a ten-Risk all-outstanding assessment shows at most fifteen links (proved); rows wrap at 375 without overflow and the card keeps its right column at 1440 (browser check)"
    requirement: ASSESS-06
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/assessments/assessment-editor.test.tsx#keeps a ten-Risk all-outstanding assessment to fifteen readiness links (UAT-011)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/assessment-release-workflow.spec.ts#ASSESS-03 readiness requirements have no overflow at 375px and 1440px"
        status: pass
    human_judgment: true
    rationale: "The plan records the 375 and 1440 layout backstop for the browser check in plan 10-23; the journey proves visibility and no overflow at both widths but not the visual column placement"

duration: 12min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 21: Release readiness by Risk and plain editor copy Summary

**The Release readiness card now lists outstanding assessment items, then one `RSK-…: n outstanding` row per Risk with a `Missing:` caption and met items on demand, every destination takes focus, and the assessment editor and Risk Register detail speak without internal terms under the copy guard.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-02T12:36:59Z
- **Completed:** 2026-10-02T12:49:19Z
- **Tasks:** 3 of 3
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments

- `release-readiness-summary.ts` (new, zod-free, type-only schema import): `summarizeReleaseReadiness(readiness)` returns `{ met, total, ready, outstandingAssessment, outstandingRisks, metAssessment, metRisks }`. Assessment items keep served order and their `#assessment-details` or `#identified-risks` destinations (from `releaseReadinessPresentation`). Risks are grouped in first-appearance order with `{ riskNumber, href, outstanding, missing }` or `{ riskNumber, href, met }`. `missingCaption(labels)` gives `Missing: A`, `A and B`, `A, B and C`, four in full, or `A, B, C, D and k more`.
- Release readiness card (UI-SPEC §14.1): the description reads `Every requirement must be met before release. We check them all again when you release.` The count line is unchanged and is the only polite live region. `ul aria-label="Release requirements"` lists the outstanding assessment items (link and `Outstanding` with `AlertCircle` in `text-warning`), then one row per Risk: a link named `RSK-0042: 2 outstanding` (caption at 500, `tabular-nums`, warning icon), described by the `Missing:` caption in `text-xs text-muted-foreground`. When everything is met the list is gone. `Show met requirements (n)` is an outline small button with `ChevronDown`/`ChevronUp`, `aria-expanded`, `aria-controls`, `data-print="hidden"` and `max-md:min-h-11`; it reveals `ul aria-label="Met release requirements"` and reads `Hide met requirements`. There is no toggle while nothing is met. `Release assessment` and its dialog work as before.
- Focusable destinations (UI-D27): `DetailSection` takes `headingFocusable`, which puts `tabIndex={-1}` on its h2. The editor sets it on `assessment-details` (both the editable and read-only branches) and `identified-risks`, and each Risk card `risk-{id}` has `tabIndex={-1}`. In the journey, following a Risk row moves focus to that Risk card.
- Copy (D-38, UI-SPEC §17.1, D-45):
  - Released alert: `The Requestor can now read this assessment. It can no longer be changed.`
  - Read-only alert: `This assessment is closed, so it can no longer be changed.` when closed, otherwise `This assessment can no longer be changed in its current state.`
  - Release dialog: `Release can’t be undone. The Requestor will receive this assessment read-only, and no one can change it afterwards.`
  - Identified Risks and Assessment details have their §17.1 descriptions.
  - Risk detail: the header is the statement excerpt, or `No risk statement recorded`; the edit description is `Edit this Risk’s details.`; Mitigation controls reads `Controls that mitigate this Risk, from the control library.`; the safe-state header reads `View a Risk and the controls that mitigate it.`
- The copy guard now covers `assessment-editor.tsx`, `release-readiness-summary.ts` and `risk-details.tsx`.
- Journey E10 (`ASSESS06_READINESS_BY_RISK`): the per-Risk links match `/^RSK-\S+: \d+ outstanding$/` with one row per Risk, at least three distinct `#risk-` destinations that are visible, and a visible `Missing:` caption. Following a row moves focus to its Risk card. Once everything is met, the outstanding list is gone and `Show met requirements` reveals `Met release requirements`, which contains `Met`.
- E13 check: the dialog still matches `/read-only|cannot be undone|irreversible/i` (through `read-only`), and the released editor still has no button named save, add, edit, remove or release.

## Task Commits

1. **Task 1: Readiness shows one row per Risk with what is missing.** RED `cf44422` (test), GREEN `68b9fe7` (feat). This is a tracer task: in this interactive end-of-phase run with an automated-only verify, its verify was re-run green before expanding.
2. **Task 2: The assessment editor and the Risk detail speak plainly, under the copy guard.** RED `e6775d1` (test), GREEN `1c037be` (fix, the commit type the plan names).
3. **Task 3: Prove the per-Risk readiness in the release journey (E10, E13 check).** `27bae94` (test).

**Plan metadata:** the SUMMARY commit, then the STATE and ROADMAP commit (see git log).

## Tests run

| Run | Result |
| --- | --- |
| Task 1 RED: `release-readiness-summary.test.ts`, `section-composites.test.tsx` and `assessment-editor.test.tsx` | 8 failed and 47 passed, plus the new module's file failing to load (the module did not exist yet). Every other failure was on its planned assertion. |
| Task 1 GREEN: `src/features/assessments`, `section-composites.test.tsx` and `zod-client-boundary.test.ts` | 17 files, 321/321 passed; typecheck clean |
| Task 2 RED: `assessment-editor.test.tsx`, `risk-details.test.tsx` and `interface-copy-guard.test.ts` | 10 failed and 117 passed. The guard named the 7 editor strings and the 4 Risk detail strings. |
| Task 2 GREEN: `src/features/assessments`, `src/features/risks` and `interface-copy-guard.test.ts` | 24 files, 485/485 passed (after scoping two Risk detail queries; see Deviations); typecheck clean |
| Release journey: `pnpm --filter @csrm/web test:e2e e2e/assessment-release-workflow.spec.ts` | **desktop 1 passed, 0 failed, 0 flaky, 0 skipped** (test 22.1s, run 1.7m). The mobile project's `@journey` grep does not select this spec. The run changed nothing in the tree. The server log's `The destination stream closed early.` lines are the known pre-existing noise (recorded since 10-01). |
| Full web suite: `pnpm --dir apps/csrm test` | 129 files, **2,745/2,745 passed** (61.2s) |
| `pnpm --dir apps/csrm typecheck` and `lint` (lint runs the same `next typegen && tsc --noEmit`) | clean |

## Files Created/Modified

- `apps/csrm/src/features/assessments/release-readiness-summary.ts`: grouping and caption, zod-free.
- `apps/csrm/src/features/assessments/release-readiness-summary.test.ts`: grouping, order, counts, the fifteen-row cap, captions and the zod-free source check.
- `apps/csrm/src/components/csrm/detail-section.tsx`: the `headingFocusable` prop. Other callers are unchanged.
- `apps/csrm/src/components/csrm/section-composites.test.tsx`: the `headingFocusable` case, including that a plain heading stays unfocusable.
- `apps/csrm/src/features/assessments/assessment-editor.tsx`: `ReleaseReadinessRequirements` and `ReadinessState`, focusable destinations, the §14.1 and §17.1 copy.
- `apps/csrm/src/features/assessments/assessment-editor.test.tsx`: per-Risk rows, the met disclosure, the empty states, focus, naming, the fifteen-link cap, alerts, dialog and descriptions.
- `apps/csrm/src/features/risks/risk-details.tsx`: the §17.1 copy and the D-45 safe-state header.
- `apps/csrm/src/features/risks/risk-details.test.tsx`: the header excerpt, the empty statement, the edit and mitigation descriptions, the safe-state header.
- `apps/csrm/src/lib/performance/interface-copy-guard.test.ts`: three files added to `guardedFiles` (sorted).
- `apps/csrm/e2e/assessment-release-workflow.spec.ts`: E10.

## Decisions Made

- Risk rows get their exact accessible name from `aria-label` (see Deviation 1). The visible text is the Risk number and `{n} outstanding`, which keeps the label-in-name rule (WCAG 2.5.3).
- The met list is always in the DOM behind `hidden`, so `aria-controls` never points at a missing id. Tailwind 4's preflight keeps `[hidden]` hidden over the `grid` class.
- Focus moves through native fragment navigation to `tabIndex={-1}` destinations, with no click handler. This follows the existing precedents (the CSV import heading and the questionnaire fields). The unit test proves each destination is focusable (jsdom focuses only focusable elements), and the journey proves that a real click moves focus in Chromium.
- Only the count line is the polite live region. The old card wrapped the whole requirement list in it, which would announce every row after each refresh.
- The Risk detail's `excerpt()` empty fallback changed from `Risk statement not provided` to the §17.1 `No risk statement recorded`. The page header is its only caller.
- At the all-met point the journey asserts that the outstanding list is absent, which is stronger than dropping the old assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Risk row name uses aria-label instead of a visually hidden `: `**
- **Found during:** Task 1 (GREEN design, checked against Playwright's accessible-name code)
- **Issue:** UI-SPEC §14.1 builds the name `{risk number}: {n} outstanding` from a visually hidden `: `. Tailwind's `sr-only` is absolutely positioned, so its computed display is `block`. Playwright's accessible-name computation (`injectedScriptSource.js`: `if (display !== "inline") token = " " + token + " "`) and Chromium's own both pad block-level children with spaces. The name would read `RSK-0042 : 2 outstanding`, and E10's `/^RSK-\S+: \d+ outstanding$/` would never match.
- **Fix:** the link carries `aria-label="{risk number}: {n} outstanding"` (and `{n} met` in the met list). Its visible children are the Risk number and the count with its icon. `aria-describedby` points to the `Missing:` caption.
- **Files modified:** `apps/csrm/src/features/assessments/assessment-editor.tsx`
- **Verification:** the unit tests find the link by that exact name, and the journey matches the plan's regex.
- **Committed in:** `68b9fe7`

**2. [Rule 1 - Bug] Two Risk detail queries became ambiguous**
- **Found during:** Task 2 GREEN
- **Issue:** the header description is now the statement itself, so `getByText(statement)` matched both the header and the classification row (in the edit test and the released-detail test).
- **Fix:** both queries are scoped to the `Risk statement and classification` region. The assertions are unchanged.
- **Files modified:** `apps/csrm/src/features/risks/risk-details.test.tsx`
- **Committed in:** `1c037be`

---

**Total deviations:** 2 auto-fixed (both Rule 1).
**Impact on plan:** both keep the planned behaviour and proofs. There is no scope change.

## Issues Encountered

None. No file under `apps/backend/src/api/*/content-types/` changed, and this plan edits no Strapi source.

## Known Stubs

None.

## Deferred

- The readiness layout backstop (the card keeps its right column at 1440, and rows wrap with a touch-height toggle at 375) is checked in the browser in plan 10-23, as the plan records. The journey already proves visibility and no overflow at both widths.
- `releaseReadinessPresentation` in `assessment-domain.ts` still builds a `Risk {n} — {label}` label that the editor no longer shows; only its `href` is used. It is not in this plan's files, so it is left as is.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Ready for 10-22. The readiness summary and `headingFocusable` are shared parts that the Phase 18 risk table can reuse (10-CONTEXT §7).
- The release still needs explicit analyst confirmation and the server's own check. The summary only regroups the served readiness (T-10-55).

## Self-Check: PASSED

- FOUND: `apps/csrm/src/features/assessments/release-readiness-summary.ts` and `release-readiness-summary.test.ts`
- FOUND: `cf44422`, `68b9fe7`, `e6775d1`, `1c037be`, `27bae94`, each with the `Co-Authored-By` trailer
- Acceptance criteria re-run: the module exports both functions and imports no zod. The editor contains `Show met requirements` and `Met release requirements`. The internal-term grep over both files prints nothing. The guard lists all three files. The spec contains `ASSESS06_READINESS_BY_RISK` and `Met release requirements`. Every verify command exits 0.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
