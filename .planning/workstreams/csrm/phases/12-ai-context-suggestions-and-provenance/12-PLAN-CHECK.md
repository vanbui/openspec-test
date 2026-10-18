# Phase 12 Plan Check

## Iteration 4 (fresh check, 2026-10-05)

**Verdict after round 2:** no blockers; 14 low-confidence scope warnings remain. The plans are executable against the current Phase 10 and 11 tree, subject to the recorded scope risk. No application server or browser suite was run.

### Round 1 — fresh check against HEAD

| Severity | Plan | Evidence / required property | Fix |
| --- | --- | --- | --- |
| BLOCKER | 12-01 to 12-19 | The shared hard rule in all 19 plans and the Node preamble in 45 automated commands named `/c/ProgramData/nvm/v24.19.0`, which does not exist on this host. The current Git Bash resolves Node 24.21.0 and pnpm 11.24.0 from PATH. A verify command must start in a runnable shell. | Replace the machine-specific preamble in all 19 plans with a Node 24.19+ check and pnpm availability check; use POST-DEMO-BRIEF §4 for hosts whose PATH needs setup. |
| BLOCKER | 12-06 | The task named an assertion of `Deterministic assessment assistance identified 3 reviewable risk proposals.` in `assessment-release-workflow.spec.ts`. That assertion is absent after Phase 11; the Requestor checks now cover Home's released-assessment list. An edit instruction must identify current code. | Retain the current Requestor Home checks; adjust only risk-count or order assertions needed for the fourth draft risk. |
| BLOCKER | 12-04 | Task 1 runs its three-schema freeze verify before its feature commit. `git diff --name-only "$BASE"` cannot see the newly created, untracked run schema. The freeze verify must count every schema change. | Union tracked changes with `git ls-files --others --exclude-standard` for the content-type path before comparing the approved three files. |
| BLOCKER | 12-19 | The interface block described `expectNoSeriousAxeViolations`, `expectNoHorizontalOverflow`, and `dismissToasts` as importable helpers. They are local functions in existing specs, not exports from `e2e/helpers`. The new journey must use callable checks. | Define these checks in the new spec or explicitly extract and export a shared helper. |
| WARNING | 12-03 to 12-10, 12-14 to 12-19 | `estimate-check --calibrated --ws csrm` reports 14 plans over the 100,000-token smart zone (105,000–175,000). Confidence is low (`sample_count: 0`). The plans should remain within a usable execution context. | Retain as an execution pacing risk; slice tracer and expansion work if a plan approaches the context limit. The existing scope notes explain the coupled files in the seven plans with 15+ paths. |

### Round 2 — after minimal plan revision

| Severity | Plan | Evidence / required property | Resolution |
| --- | --- | --- | --- |
| BLOCKER | 12-01 to 12-19 | All 47 `<automated>` commands pass `bash -n`; the revised Node preamble executes successfully in Git Bash with the current Node and pnpm. | Resolved by the portable version and availability checks. |
| BLOCKER | 12-06 | The release journey still has `completeRiskForRelease` and the Requestor Home released-assessment assertions; the plan now names those current locations. | Resolved. |
| BLOCKER | 12-04 | The Task 1 freeze expression includes both tracked and untracked content-type files, sorted uniquely; the approval precondition remains before the schema task. | Resolved. |
| BLOCKER | 12-19 | The interface block now identifies the local checks and requires local definitions or explicit shared exports. | Resolved. |
| WARNING | 12-03 to 12-10, 12-14 to 12-19 | Estimated tokens by plan: 03 120k, 04 105k, 05 125k, 06 160k, 07 130k, 08 110k, 09 115k, 10 150k, 14 115k, 15 150k, 16 175k, 17 165k, 18 135k, 19 140k. Budget 100k; calibration confidence low. | Open advisory; use the existing tracer boundaries and pause or slice expansion work during execution. No requirement or dependency change is needed. |

### Checks that pass

- The 19 plans contain 48 complete tasks. `verify.plan-structure --ws csrm` is valid for every plan. The dependency graph is acyclic; waves 1–18 respect the declared edges.
- ROADMAP requirements INT-05, INT-06, ASSESS-08 and QUES-10 appear in frontmatter and have covering tasks, including the final journey. The context, draft, questionnaire, decision, source and provenance artifacts have planned links through Strapi and the typed web layer.
- Referenced repository paths resolve today or are produced by an earlier Phase 12 plan. Named current symbols, test targets, web routes, catalogue entries and Strapi services were compared with the current tree. Generated and future Phase 12 symbols are assigned to earlier tasks. The only stale Phase 11 assertion found was corrected in 12-06.
- Each automated command is syntactically valid in Git Bash. Package scripts and test targets exist now or are created before use. This is static command validation; test suites and Playwright were not run.
- Plan 12-01 records the contract gap and stops at a blocking pilot approval checkpoint; 12-04 checks the dated approval before the only three schema changes. The final gate rechecks the freeze.
- The plans keep the production API boundary in Strapi, server-side record authorization, human review of proposals, the deterministic provider in both suites, and the current Keycloak configuration. No new dependency or competing domain entity is planned.


## Iteration 3

## VERIFICATION PASSED

**Phase:** 12 (AI context, suggestions and provenance)
**Plans verified:** 19 (12-01 to 12-19), 48 tasks
**Issues:** 0 blockers, 0 warnings, 0 info

### Probes
- verify-command-paths 12: no unresolvable target (0 blockers, 0 warnings).
- verify-failure-directions 12: 47 of 47 runnable commands carry a `fails_when` (the 48th task is the 12-01 approval checkpoint).

### Iteration 2 issues
| Issue | Status | Evidence |
|---|---|---|
| W1 scope_sanity (12-05, 12-06, 12-07, 12-10, 12-15, 12-16, 12-17 at 15 to 21 files) | Resolved | Each of the seven plans now carries a "Scope note" giving its file count and why the files change together (for example 12-10: 21 files, task 1 is the run read's full D-02 chain touching 19, tasks 2 and 3 share single-owner catalogue and matrix files under D-39). All are within 21 files with a recorded reason, which the orchestrator's pacing rule accepts. |
| I1 `type="tracer"` | Resolved | The orchestrator confirms the GSD executor recognises `tracer`; every tracer task has files, action, verify and done. |

### What passes
- Requirement coverage: INT-05, INT-06, ASSESS-08 and QUES-10 each claimed in plan frontmatter with covering tasks; 12-19 proves every ROADMAP criterion in the browser and runs the full gate.
- Dependencies: acyclic, wave numbers consistent, no forward references; serial from wave 2, which suits Playwright serialisation.
- Contract gate: the contract-gap record, a blocking approval checkpoint, then the schema change in 12-04 with a content-type freeze checked again in 12-19.
- G-14 refusal (AI Accept beside a planned control) in the API, vocabulary, decision operation and UI rollback; G-20 classification ceiling with a safe empty default and copy that names the administrator.
- AGENTS.md and stage-2 section 3: typed API layer and Server Actions only, human-only decisions, AI never releases, authorisation in Strapi against the resolved user, deterministic provider in both suites, no Keycloak change, no new dependency, clean tree after Playwright, written-ahead notes. No pre-rename app paths appear in any phase file.
- 12-VALIDATION.md: 48 per-task rows matching the 48 tasks.

### Recommendation
Plans verified. Proceed to execution when Stage 3 re-runs this check.

## Earlier iterations (summary)
- **Iteration 1:** 3 blockers (G-14 refusal missing, 12-VALIDATION.md out of date, 12-11 at 28 files), 2 warnings, 1 info. Revision 1 added the refusal end to end, rebuilt validation and split 12-11 into 12-11 to 12-13.
- **Iteration 2:** 0 blockers, 1 warning (seven large plans without a recorded reason), 1 info (`tracer` task type). Revision 2 added scope notes to the seven plans.
