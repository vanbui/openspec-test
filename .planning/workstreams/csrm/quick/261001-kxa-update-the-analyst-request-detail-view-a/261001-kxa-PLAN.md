---
phase: quick-261001-kxa
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/csrm/src/features/assessments/assessment-detail.tsx
  - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
autonomous: true
requirements: [RCTX-01, RCTX-02]

estimate:
  tokens: 25000
  raw_tokens: 25000
  tasks: 1
  confidence: low

must_haves:
  truths:
    - "On /app/review/requests/{documentId} at desktop widths (Tailwind lg and above), the 'Request context' card spans the full width of the page content column, so its left and right edges line up with the lifecycle stepper and the Request summary hub above it, as it already does on /app/requests/{documentId} (RCTX-01)"
    - "Below the lg breakpoint the Analyst view renders exactly as it does today: one column, no horizontal overflow (RCTX-02)"
    - "The section's content is unchanged: the same six fields in the same order, the same two-column field list from the sm breakpoint, and the revert audit summary beneath them"
    - "The Requestor page file and the shared DetailSection component are not modified"
    - "A vitest assertion fails if a column template is put back on the element that holds the Analyst 'Request context' section"
  artifacts:
    - path: apps/csrm/src/features/assessments/assessment-detail.tsx
      provides: "Analyst request detail whose 'Request context' section sits in a grid with no column template"
      contains: "title=\"Request context\""
    - path: apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
      provides: "Regression test for the full-width 'Request context' section"
      contains: "Request context"
  key_links:
    - from: apps/csrm/src/features/assessments/assessment-detail.tsx
      to: apps/csrm/src/components/csrm/detail-section.tsx
      via: "DetailSection (a w-full section) is the only child of a div whose classes are exactly `grid gap-6`, the same pair the Requestor page uses"
      pattern: "className=\"grid gap-6\""
---

<objective>
Make the "Request context" card on the Security Analyst's request detail view (`/app/review/requests/{documentId}`) span the full width of its parent, as it already does on the Requestor's request detail view (`/app/requests/{documentId}`).

Root cause (found during planning, in the working tree at `d161fce` with no uncommitted source changes): both views render the same shared `DetailSection` component, which is already `w-full`. The difference is the element around it.

- Requestor view, `apps/csrm/app/(app)/app/requests/[documentId]/page.tsx` line 59: the section is a child of `<div className="grid gap-6">`, a single implicit track, so the card fills the row.
- Analyst view, `apps/csrm/src/features/assessments/assessment-detail.tsx` line 79: the section is the only child of `<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">`. From the lg breakpoint that div has two tracks and one child. The card takes the first track, about 64% of the row, and the second track (at least 18rem) stays empty.

The fix removes the lg column template so the Analyst element carries the same `grid gap-6` pair as the Requestor page. Below lg the two class lists already resolve to the same layout, so mobile does not change.

Requirement IDs, local to this quick task:
- RCTX-01: At desktop widths the Analyst "Request context" card spans the full width of the page content column.
- RCTX-02: Mobile layout, section content, and the Requestor view are unchanged, and no page overflows horizontally.

Purpose: The two request detail views present the same record section the same way, and the Analyst view stops reserving an empty column.
Output: A one-token class change in `assessment-detail.tsx` and a regression test in `assessment-review-workflow.test.tsx`.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@apps/csrm/AGENTS.md
@apps/csrm/src/features/assessments/assessment-detail.tsx
@apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
@apps/csrm/app/(app)/app/requests/[documentId]/page.tsx
@apps/csrm/src/components/csrm/detail-section.tsx

<interfaces>
Facts verified during planning. Do not re-explore them.

- Directory names: the web app is `apps/csrm` (package `@csrm/web`) and Strapi is `apps/backend`. STATE.md and older planning docs still say `apps/web` and `apps/strapi`.
- Branch is `csrm-20260928`. Work stays on it. No worktree.
- `AssessmentDetail({ assessmentHref?, questionnaireHref?, request?, state })` in `apps/csrm/src/features/assessments/assessment-detail.tsx` is a client component. Its populated return is a fragment: `PageHeader`, the lifecycle stepper in a `mt-6` div, the `RequestHub` in a `mt-6` div, an optional "Return to draft" control, then the div on line 79 that holds the "Request context" `DetailSection`, then the two optional job cards.
- `DetailSection` in `apps/csrm/src/components/csrm/detail-section.tsx` renders `<section aria-labelledby=... className="w-full">` around a shadcn `Card`. Because the section is labelled by its `h2`, Testing Library finds it with `getByRole('region', { name: 'Request context' })`, and its `parentElement` is the div on line 79.
- The Analyst route file `apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx` only reads the request and renders `AssessmentDetail`. It has no layout of its own and is not edited.
- `assessment-review-workflow.test.tsx` already mocks `./assessment-actions`, `@/features/requests/request-actions` and `next/navigation` at the top of the file, and renders `AssessmentDetail` directly with plain object fixtures. The test named "withholds the analyst reversal once the request is no longer submitted" uses a draft request with no questionnaire, so neither job card mounts.
- Precedent for asserting layout classes in jsdom: `apps/csrm/src/features/risks/risk-register.test.tsx` lines 147-148 (`toHaveClass(...)` plus a `className` regex with `not.toMatch`).
- Verify command form already proven in quick task 260930-iei, and re-run during this planning session against the unchanged file (it passed): `pnpm --filter @csrm/web exec vitest run assessment-review-workflow`. The `typecheck` script is `next typegen && tsc --noEmit`.
- Browser specs: nothing under `apps/csrm/e2e` pins the Analyst two-track layout. `accessibility.spec.ts` line 336 and `request-relationship-states.spec.ts` lines 160-174 only assert that the "Request context" heading is visible and that the page has no horizontal overflow. Both stay true. No spec is edited.
- Design direction: no new UI value is introduced. `gap-6` is already on the element, and the page container still caps detail pages at `--spacing-container-max` (72rem, `docs/design/csrm-design-direction.md` line 204).
</interfaces>

Plan-pre checkpoints (written for roadmap phases; this quick task has no phase number):
- Coverage-matrix checkpoint: detector ran on the task scope and reported `detected: false`. No COVERAGE.md.
- Assumption-delta checkpoint: skipped, `reason: phase_unresolved`. No decision block.
- Schema push gate: no schema-pattern file in scope. Skipped silently.
- Security: `<threat_model>` below, ASVS level 1, block on high.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1 (tracer): Analyst "Request context" card spans the full content width</name>
  <files>apps/csrm/src/features/assessments/assessment-detail.tsx, apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx</files>
  <read_first>
    - apps/csrm/src/features/assessments/assessment-detail.tsx (lines 73-88, the populated return; line 79 is the element to change)
    - apps/csrm/app/(app)/app/requests/[documentId]/page.tsx (line 59, the reference class pair)
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx (lines 1-58 for mocks and imports; lines 108-238 for the `analyst review presentations` describe block and its fixtures)
    - apps/csrm/src/features/risks/risk-register.test.tsx (lines 140-150, the class-assertion precedent)
  </read_first>
  <behavior>
    - New test, "lets the request context section span the full width of its container": render `AssessmentDetail` with `state="populated"` and a request fixture, find the section with `screen.getByRole('region', { name: 'Request context' })`, and take its `parentElement`. That element has the classes `grid` and `gap-6`, and its `className` does not match `/\bgrid-cols-/`.
    - Before the source change this test fails on the `className` assertion (the lg column template is present). After the change it passes.
    - Every existing test in `assessment-review-workflow.test.tsx` still passes.
  </behavior>
  <action>
    Work test-first, in two commits if the executor's workflow commits per step, otherwise one.

    RED. In `apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx`, inside `describe('analyst review presentations', ...)`, add one `it` named "lets the request context section span the full width of its container". Build its fixture the same way the neighbouring test "withholds the analyst reversal once the request is no longer submitted" does (a draft request with no questionnaire and no relationships), so neither job card mounts and no extra mock is needed. Render `AssessmentDetail` with that fixture and `state="populated"`. Locate the section by role `region` and accessible name `Request context`, read its `parentElement`, and assert two things: it has the classes `grid` and `gap-6`, and its `className` does not match the regular expression `/\bgrid-cols-/`. Put a short comment above the test saying that jsdom computes no layout, so the class list stands in for it, and that a two-track template with a single child is what left the card at about two thirds of the row. Run the file and confirm the new test fails on the second assertion.

    GREEN. In `apps/csrm/src/features/assessments/assessment-detail.tsx` line 79, change the div's `className` from `grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]` to `grid gap-6`. That is the whole source change. The result is the same class pair the Requestor page uses on line 59 of `apps/csrm/app/(app)/app/requests/[documentId]/page.tsx`, and it is what the Analyst element already resolves to below the lg breakpoint, so mobile is unchanged (RCTX-02). Keep the div in place: removing it would change the block structure around the section for no gain.

    Leave everything else as it is. Do not edit `DetailSection` (it is shared and already `w-full`), the field list's own classes (`grid gap-4 sm:grid-cols-2`), the six fields or their copy, the `mt-6` and `mb-4` spacing on the sibling blocks, `AssessmentDetailSkeleton`, the Analyst or Requestor route files, or anything under `apps/csrm/e2e`. Do not add a class, a token, an arbitrary value or a dependency. The edit is a Tailwind class string in an existing client component and touches no Next.js interface; if anything beyond that turns out to be needed, stop and follow `apps/csrm/AGENTS.md` first.
  </action>
  <verify>
    <automated>pnpm --filter @csrm/web exec vitest run assessment-review-workflow && pnpm --filter @csrm/web typecheck</automated>
    <human-check>Optional, with both dev servers running. Switch the development role to Security Analyst, open any request at http://localhost:3000/app/review/requests/{documentId}, and check at 1440px that the "Request context" card's left and right edges line up with the "Request summary" hub above it, with no empty column to its right. Check at 375px that the page looks as before and does not scroll sideways. Compare with the same record as Requestor at /app/requests/{documentId}.</human-check>
  </verify>
  <done>
    The new test passed after failing first. Every test in `assessment-review-workflow.test.tsx` passes and the web type check is clean. `git diff --stat` lists exactly the two files in `<files>`. In `assessment-detail.tsx` the diff is the single `className` value on line 79.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| None changed | The change is a CSS class on an element inside an already-authorised view. No input, request, server action, capability check or data read is added, removed or altered. |

## STRIDE Threat Register

ASVS level 1; block on high. No threat here reaches medium.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-q261001-01 | Information disclosure | "Request context" section in `assessment-detail.tsx` | low | accept | The section shows the same six fields to the same viewer as before; only its width changes. The record is still read through `getRequest` in the route file, which is not edited, and Strapi still decides who may read it |
| T-q261001-02 | Elevation of privilege | Analyst request detail route | low | accept | The route file, its capability checks (`assessment:review`) and the permission and error states of `AssessmentDetail` are untouched. Layout is presentation and grants nothing |
| T-q261001-SC | Tampering | npm/pnpm installs | low | accept | No package is installed and no lockfile changes |
</threat_model>

<verification>
Required, cheap:
- `pnpm --filter @csrm/web exec vitest run assessment-review-workflow` passes, including the new test.
- `pnpm --filter @csrm/web typecheck` is clean.

Optional:
- `pnpm --filter @csrm/web exec playwright test request-relationship-states` (one spec; it opens both request detail views and asserts no horizontal overflow). The full Playwright suite takes about 18 minutes and is not part of this task.
- `pnpm --filter @csrm/web test` for the whole web unit suite.
- The human check in Task 1.
</verification>

<success_criteria>
- RCTX-01: In the Analyst request detail view the element holding the "Request context" section has the classes `grid gap-6` and no column template, so the card fills the row at every width.
- RCTX-02: The Requestor page, `DetailSection`, the section's fields and the browser specs are unchanged, and the diff touches only the two files listed.
- The regression test exists, failed before the source change, and passes after it.
</success_criteria>

<output>
Create `.planning/quick/261001-kxa-update-the-analyst-request-detail-view-a/261001-kxa-SUMMARY.md` when done
</output>
