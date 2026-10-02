# Phase 11 Plan Check: Iteration 2

## ISSUES FOUND

**Phase:** 11 Navigation, landing and list clarity
**Plans checked:** 21 (11-01 to 11-21)
**Issues:** 0 blockers, 0 warnings, 1 info

Probes: `verify-command-paths` returned not_applicable for every command, and `verify-failure-directions` returned ok for all 57 runnable commands. Neither produced a finding.

### Iteration 1 issues

- **Blocker 1, the "Assigned to me" seam: RESOLVED.** 11-06's must_haves (line 42) and Seams (line 115) now leave the slot to Phase 13. They describe it per 13-CONTEXT D-13/D-14 and its Orchestrator Confirmations as an orthogonal `filters[assignee]=me` over the `open` bucket, on its own route, and they state it is not a `REVIEW_QUEUE_BUCKETS` value. No queue value, select option or parameter is added. The 11-05 navigation.ts data seam stays neutral.
- **Warning 1, 11-VALIDATION.md: RESOLVED.** The per-task map now has 58 rows, matching every task exactly (37 auto, 20 tracer and 1 checkpoint, compared plan by plan). No `--filter` or `--prefix` forms remain. 11-21 is the phase gate, with static checks against `PHASE_11_BASE`, and the Strapi and full-Playwright run lists cite the current plan numbers.
- **Info 1, the strict sequential chain: UNCHANGED** (carried below).

### Re-check summary

The requirement claims are UX-07 (4 plans), UX-08 (8), UX-09 (9), UX-10 (3) and DASH-03 (4), so all five are covered. The dependencies are acyclic (a linear chain, with 11-21 depending on all the others). No pre-rename app paths appear. The G-16 due-state rule stays in one shared module. The status labels stay one extensible mapping (G-13). There are no content-type changes, and the gate enforces a content-type freeze. The negative authorisation cases (a cross-Requestor quick find, the `my_requests` owner predicate) are proven in the API and the UI. Each plan carries its written-ahead note.

### Advisories (info)

**1. [scope_sanity] The plans should run in parallel where they are independent.**
- Plan: all
- Evidence: there are 21 strictly sequential waves (each plan depends on the one before it), even where files do not overlap. The chain is correct but slow.
- Example fix (non-binding): flatten independent plans into shared waves.

### Structured Issues

```yaml
issues:
  - plan: null
    dimension: scope_sanity
    severity: info
    required_property: "Independent plans can run in parallel"
    description: "21 strictly sequential waves"
    fix_hint: "Flatten independent plans into shared waves"
```

### Recommendation

Advisory only. No revision is required.

---

### Iteration 1 summary

Iteration 1 found 1 blocker, 1 warning and 1 info. The blocker: 11-06 had fixed Phase 13's "Assigned to me" as a new `REVIEW_QUEUE_BUCKETS` value, which contradicted 13-CONTEXT D-13/D-14. The warning: 11-VALIDATION.md still reflected the 15-plan research sketch, with stale numbering, the wrong Strapi list, the wrong gate plan and the old command forms. The info: the plans run as 21 strictly sequential waves. The blocker and the warning are resolved in iteration 2.

---

## Orchestrator disposition (2026-10-02)

Iteration 2 found 0 blockers and 0 warnings, and one advisory info item: the 21 plans run as 21 strictly sequential waves. Under GSD's revision loop, an info-only result is a pass. The serialisation is deliberate, because Playwright and the shared contract files are serialised, as Phase 10 D-40 also does. **Verdict: PASSED, iteration 2.**

---

## Fresh check before execution (2026-10-03, post-demo at 0b9557c)

## ISSUES FOUND

**Phase:** 11 Navigation, landing and list clarity
**Plans checked:** 21 (11-01 to 11-21)
**Issues:** 0 blockers, 3 warnings, 2 info

**How far I read.** I did not read every plan in full. For all 21 plans I read the frontmatter, the context, the interfaces, the Phase 10 dependency notes ("Written ahead") and the task text that mattered. Then I checked 230 referenced paths and about 60 symbols, copy strings and line references against HEAD.

### Warnings

**W1. [context_compliance, walkthrough fix 4] On the analyst page, no width shows a Next action the page does not offer.**
- Plan: 11-09, Task 1.
- Evidence: at HEAD, assessment-detail.tsx:128 gives RequestLifecycleStepper the raw request.lifecycle. Only the hub, at :129, gets analystRequestLifecycle(request), the filter from commit 8c4e2a7 at request-domain.ts:174-180.
- 11-09 hides the hub line below 768px (hidden md:block). The compact line in the stepper becomes the only Next action shown there.
- D-28 passes only nextActionOverride to the stepper. 11-09 never mentions analystRequestLifecycle.
- So at 375px the stepper can show "Generate the questionnaire." when the page offers no generation. That is the defect fix 4 removed.
- Example fix: pass analystRequestLifecycle(request) to the stepper on the analyst page. Add a unit case: at a phone width, a request that is not submitted but whose step is still submitted shows no Next action.

**W2. [task_completeness] The UX10_GUARD_BLOCKS test can get a quick-find result while a save is failing.**
- Plan: 11-20, Task 1.
- Evidence: the guard blocks only while a save is waiting or has failed (navigation-guard.tsx:35 and :63-66; questionnaire-renderer.tsx:341).
- The only proven way to make a save fail is in questionnaire-workflow.spec.ts:250-253. It aborts every POST to the questionnaire page URL.
- In 11-19, quickFindAction is a Server Action, which also POSTs to the current page URL. That route would abort the search too, so no result appears and Enter never reaches the guard.
- Example fix: abort only the save POST, for example by matching its Next-Action header, or keep the save pending so the guard is in its waiting state.

**W3. [environment] The working tree at execution start shows only the three operator items in POST-DEMO-BRIEF section 2.**
- Plans: all 21. The acceptance criteria of every plan require git status --short to show only those three items after each commit.
- Evidence: at 0b9557c, git status --short also shows " M .claude/launch.json" (4 lines added, 4 removed).
- Example fix: the pilot restores or commits .claude/launch.json before execution, or the orchestrator allows it as an operator item.

### Advisories (info)

- I1: the plans run as 21 sequential waves, one plan per wave. This is deliberate (D-05) and was accepted in 11-PLAN-CHECK. It also rules out any file-sharing race.
- I2: some line references have drifted. All plans say to find code by its identifier, so this is harmless:
  - 11-10: the My Requests FunctionApi entries in the catalogue are at lines 1123-1135, not 1100-1125.
  - 11-19: the Search button in requestor-request-workflow.spec.ts is at line 340, not 299.
  - 11-04: pluralLabel is at lines 23, 36, 49 and 62, not 20, 31, 42 and 53. The export is named administrationConfig, not administrationCollections.

### Passed

- Requirements:
  - UX-07: 11-04, 11-05, 11-13.
  - UX-08: 11-02, 11-03, 11-08 to 11-12.
  - UX-09: 11-01, 11-06, 11-07, 11-11, 11-15, 11-17, 11-18.
  - UX-10: 11-19, 11-20.
  - DASH-03: 11-14, 11-16, 11-17.
  - 11-21 gates all five.
- Dependencies: one linear chain, and 11-21 depends on all 20 other plans. There are no cycles and no forward references.
- No content-type change and no new grant:
  - No content-types path appears in the files_modified of any plan. 11-14 only reads csrm-risk/schema.json.
  - 11-10 serves the existing FunctionApi function.risk_assessment_requests.my_requests.api.01 (catalogue line 1123), for role.requestor only. It adds no Function, FunctionApi or role.
  - The two catalogue copies are compared with cmp.
- Static-check baseline: 11-01 records PHASE_11_BASE with git rev-parse at execution start, and 11-21 reads it from 11-01-SUMMARY. Commit 1398aaa is cited only as the tree the plans were written against, and it exists in this repository.
- No plan names uat-trial, v2.0, apps/strapi or apps/web.
- All 230 referenced paths either exist now or are created by an earlier plan, or by the plan that uses them.
- AGENTS.md:
  - Authorisation stays in Strapi.
  - There is no frontend API facade; quick find is a Server Action that calls the typed services.
  - No new dependency: cmdk ^1.1.1 is already installed.
  - Plans use semantic tokens only.

### Phase 10 dependencies checked

| Dependency | At HEAD | Result |
|---|---|---|
| requestStatusPresentation and its six callers (11-01) | request-domain.ts:23 and the listed callers | matches |
| approved label is "Approved" (11-01) | status-badge.tsx:72 | matches |
| Glossary sentence (11-01) | CONTEXT.md:11 | matches |
| Design-direction headings and Block links bullet (11-01) | lines 310, 320, 397, 425, 430 | matches |
| Phase 10 extensions X-1 to X-5 | entries dated 2026-09-27 at lines 35 and 377-379 | present |
| Analyst dashboard page, Home metadata, DASHBOARD_HEADING, signInAs (11-02) | present | matches |
| "workspace" recovery copy (11-03) | present | matches |
| "Go to My ..." gate copy from 10-02 (11-04) | assessment-detail:63, assessment-editor:123, questionnaire-review | matches |
| Navigation labels and headings (11-04, 11-05) | navigation.ts:55-71 and the page titles | matches |
| runningLabel from f193a3d (11-04) | administration-config.ts | no conflict |
| 10-08 navigation guard API and onNavigated (11-05, 11-19, 11-20) | navigation-guard.tsx:82/163/168/181; capability-navigation:27/57/59 | matches |
| Leave-warning copy (11-20) | navigation-guard.tsx:149, 156 | matches (see W2) |
| nextActionOverride from 10-14 (11-08, 11-09) | assessment-detail.tsx:119, 129 | matches |
| analystRequestLifecycle from 8c4e2a7 (11-09) | request-domain.ts:174 | bypassed for the stepper (W1) |
| Middle-dot identifiers, X-4 (11-07, 11-15) | assessment-request-link:16, risk-details:219 | consistent |
| Time zone (10-01) and copy-guard constants (10-02) | local-time, layout, app-shell; copy-guard test | matches |
| Review-queue and status-summary symbols (11-06, 11-10) | present | matches |
| my_requests in catalogue and served-operations (11-10) | catalogue:1123; served-operations:526 | matches |
| routesWithoutClientValidation (11-09) | zod-client-boundary.test.ts:113 | matches |
| Risk-register and insight symbols (11-14 to 11-17) | present | matches |
| Service functions quick find calls (11-19) | present; listMyRequests is created by 11-10 | matches |
| 403 refusal, refused-start copy, unchanged Save, control titles, APP-13 description | no Phase 11 plan touches these | no collision |
| requestTitle, riskCount, highestResidualRating (11-07) | absent today | no duplication |

### Structured Issues

    issues:
      - plan: "11-09"
        dimension: context_compliance
        severity: warning
        required_property: "On the analyst page, no width shows a Next action the page does not offer"
        description: "assessment-detail.tsx:128 gives the stepper the raw lifecycle; the stepper becomes the only next action shown below 768px"
        task: 1
        fix_hint: "Pass analystRequestLifecycle(request) to the stepper"
      - plan: "11-20"
        dimension: task_completeness
        severity: warning
        required_property: "UX10_GUARD_BLOCKS gets a quick-find result while a save is failing"
        description: "Aborting every POST to the page URL (questionnaire-workflow.spec.ts:250-253) also aborts quickFindAction"
        task: 1
        fix_hint: "Abort only the save action POST, or keep the save pending"
      - plan: null
        dimension: environment
        severity: warning
        required_property: "The working tree shows only the three operator items"
        description: "git status --short also shows .claude/launch.json as modified"
        fix_hint: "Pilot restores or commits .claude/launch.json, or the orchestrator allows it"
      - plan: null
        dimension: dependency_correctness
        severity: info
        required_property: "Independent plans can run in parallel"
        description: "21 sequential waves, deliberate (D-05)"
        fix_hint: "None needed"
      - plan: "11-04, 11-10, 11-19"
        dimension: verification_derivation
        severity: info
        required_property: "Interface line references point at current code"
        description: "Several line references have drifted (see I2)"
        fix_hint: "None needed; plans find code by identifier"

### Recommendation

0 blockers and 3 warnings. W1 and W2 each need a short edit, to 11-09 and 11-20. W3 needs the pilot to act before execution.

### Pilot disposition (2026-10-03)

- **Warning 1 (11-09 hides the hub's line below 768px, so the stepper shows the raw lifecycle's Next action):** to be revised before execution. The stepper on the analyst request page takes `analystRequestLifecycle(request)` (`request-domain.ts`, Phase 10 walkthrough fix 4), with a phone-width unit case. The Phase 11 worker's first step is a GSD planner revision of 11-09.
- **Warning 2 (11-20's `UX10_GUARD_BLOCKS` proof aborts every POST, which also kills quick find's Server Action):** to be revised before execution. Abort only the save's POST, matched by its `Next-Action` header, or hold the save pending. This is part of the same planner revision.
- **Warning 3 (a dirty tree):** resolved. It was the pilot's temporary `.claude/launch.json` change for the Phase 10 walkthrough, restored before execution.
- **Info:** the checker read every plan's frontmatter, dependency notes, interfaces and relevant tasks, and checked about 230 paths and 60 symbols, but did not read every line. The pilot accepted that depth: executors read their plans in full, and the 23-row Phase 10 dependency table covers the main drift risk.
