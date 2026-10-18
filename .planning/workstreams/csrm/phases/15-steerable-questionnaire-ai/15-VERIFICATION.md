---
phase: 15-steerable-questionnaire-ai
verified: 2026-10-13T11:25:02Z
re_verified: 2026-10-15T02:45:00Z
status: passed
previous_status: human_needed
score: "4/4 must-haves verified; QUES-11 and QUES-12 satisfied; 0 gaps; the 4 human checks confirmed in 15-UAT.md (5/5 passed); final gate green at e224a148"
covered_files:
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-01-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-01-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-02-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-02-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-03-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-03-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-04-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-04-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-05-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-05-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-06-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-06-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-07-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-07-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-08-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-08-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-09-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-09-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-10-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-10-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-11-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-11-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-12-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-12-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-13-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-13-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-14-PLAN.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-14-SUMMARY.md
  - .planning/workstreams/csrm/phases/15-steerable-questionnaire-ai/15-UAT.md
  - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
  - apps/backend/tests/questionnaire-governance.integration.test.ts
  - apps/csrm/e2e/questionnaire-ai-proposals.spec.ts
  - apps/csrm/src/features/questionnaire-ai/hub-proposal-job.tsx
  - apps/csrm/src/features/questionnaire-ai/proposal-job-handoff.ts
  - apps/csrm/src/features/questionnaire-ai/start-proposals-button.tsx
  - apps/csrm/src/test/setup.ts
covered_digest: "v2:sha256:b2ec4f340b645e16ec0f7f6e39f0e5b021ad70f35cbf160f76990834c6ecec51"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "NVDA speech and keyboard-only operation on Windows"
    expected: "Preparing transitions, comparison field names, decisions, and refusal messages are announced once; focus remains on the next available action."
    why_human: "DOM assertions and axe checks cannot establish actual screen-reader speech cadence or usability."
  - test: "Live provider proposal quality with seeded fictitious data"
    expected: "Instructions steer useful proposals, marked notes and visible submitted answers inform follow-ups, answered questions remain untouched, and rejected items do not return as duplicates."
    why_human: "Automated suites use a deterministic provider and cannot judge the quality or consistency of live model output."
  - test: "Production schema and catalogue acceptance"
    expected: "Existing and new run/governance envelopes, identifier-only answer-source mappings, and the capability catalogue load during deployment while legacy records remain readable."
    why_human: "This requires deployment against the production schema/catalogue and cannot be proved by local tests."
  - test: "Visual review at the contracted desktop and mobile widths"
    expected: "Proposal hierarchy, clipping, alignment, long-label wrapping, action reachability, and focus presentation meet the UI-SPEC at 375px and 1440px."
    why_human: "The UI audit had no screenshots; source classes and DOM assertions do not verify actual rendered appearance."
---

# Phase 15: Steerable questionnaire AI — Verification Report

**Phase Goal:** As a Security Analyst, I want to tell the AI what to add, change or remove in a questionnaire and to have it propose follow-up questions without touching answered ones, so that the question list keeps up with new information while I stay in control.
**Verified:** 2026-10-13T11:25:02Z
**Status:** passed (re-verified 2026-10-15; `human_needed` on 2026-10-13)
**Re-verification:** Yes. The initial verification below is kept as written; this note closes it.

## Re-verification (2026-10-15, closing worker)

The 2026-10-13 report read `human_needed` for two reasons: four checks only a person can make, and a final full gate that had not run green after the closure fixes. Both are now closed, so the status is `passed`.

1. **The human checks are confirmed in `15-UAT.md`** (`status: complete`; 5 passed, 0 issues, 0 pending; `697c962e`, `a30203e6`):
   - the pilot walk regressions at 375 and 1440 (D1 to D9), re-verified by the focused browser journeys;
   - NVDA speech and keyboard-only operation on Windows, confirmed by the operator's manual check;
   - live-provider proposal quality with seeded fictitious data, the operator's check under `15-PILOT-RULINGS.md`;
   - production schema and catalogue acceptance, the deployment check under `15-PILOT-RULINGS.md`, with no content-type or grant change in the closure fixes;
   - the visual review at 375 and 1440, confirmed by the operator against the UI-SPEC.
2. **The final full gate is green** (`15-14-SUMMARY.md`, "Phase gate (final run, after the code review and walk fixes)", `cc5cf693`): `api:check`, typecheck and lint clean; web 5,409/5,409 (222 files); Strapi 1,637 passed, 0 failed, 1 skipped (the POSIX file-mode check on Windows) of 1,638, at `90a91942`; Playwright 240/240 on the production build (desktop 176, mobile 64, 0 flaky, no retries) at `e224a148`, with every route within budget. The first Playwright run failed one Phase 14 test, `COLLAB02_UAT012_SCENARIO` at 1440, on a viewport-based branch where the layout shown decides; it was fixed test-only in `e224a148`. That run also closes the two INFO rows below: the complete E2E gate and both Phase 15 spec files (`questionnaire-ai-proposals.spec.ts`, 12/12 across both projects including `QUES12_SUBMITTED_HUB_JOB` and `QUES12_TAKE_BACK_RECOVERY`; `questionnaire-governance-workflow.spec.ts`) passed in one full run.

No code-level truth changed: the closure fixes ended at `36315786`, and the only later code change is the test-only `e224a148`.

## User Flow Coverage

The roadmap goal is a valid user story (`user-story.validate`: `true`). The MVP outcome is that a Security Analyst can steer proposal generation, decide changes, preserve answered content, and release the resulting questionnaire only under analyst control.

| Step | Expected | Evidence | Status |
|---|---|---|---|
| Open a submitted questionnaire with a marked offshore-support note | Analyst sees the proposal entry point; requestor answers remain fixed context | `questionnaire-proposals-workflow.ts` builds assessment context and marked-note inputs; `QUES11_QUES12_JOURNEY` passes at desktop and mobile | ✓ VERIFIED |
| Ask for follow-up questions and rewrite a question | Proposal job and per-question rewrite provide reviewable, scoped items | `startQuestionnaireProposals` delegates to the provider adapter; the journey exercises follow-up and plain-language rewrite at 1440/375 | ✓ VERIFIED |
| Review and decide individual proposals | Confirm/edit/reject/undo operate on separate proposal items; changes are recorded | `questionnaire-proposal-decisions.ts` and run-decision persistence; browser journey exercises decisions and revision timeline | ✓ VERIFIED |
| Release the questionnaire | Requestor receives only analyst-released changes; answered values remain unchanged | workflow release gate plus the browser journey's Requestor assertions; governance browser test passes | ✓ VERIFIED |
| Judge speech, live model quality, production compatibility and final visual quality | These remain credible in the actual operator environment | Operator checks in 15-UAT.md and UI-REVIEW’s screenshot limitation; all confirmed in `15-UAT.md` (5/5, 2026-10-13) | ✓ VERIFIED (re-verification 2026-10-15; HUMAN NEEDED on 2026-10-13) |

## Goal Achievement

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Marked offshore-support context produces relevant follow-up proposals while answered questions remain unchanged. | ✓ VERIFIED | `questionnaire-proposals-workflow.ts` loads context and marked notes, derives answered question views, and passes the provider result through `toQuestionnaireProposal`; E2E `QUES11_QUES12_JOURNEY` passes on desktop and mobile and asserts topic relevance, answered targets left out, and unchanged answers. |
| 2 | Analyst instructions can request a plain-language rewrite, with the analyst deciding whether it is applied. | ✓ VERIFIED | Controller routes the rewrite operation to `startQuestionRewrite`; proposal decisions are separate; the desktop/mobile journey rewrites a question and confirms it. |
| 3 | Each proposal is attributable to its instruction, initiating analyst, time and provider in the run record and revision history. | ✓ VERIFIED | Run creation and completion in `questionnaire-proposals-workflow.ts`, with governance event append and run projections; the browser journey asserts instruction, initiator, time, provider/model and timeline events. |
| 4 | Proposed changes do not reach the Requestor until analyst release, and answered questions and answers stay protected. | ✓ VERIFIED | Server-side decision/release workflow and answer-preservation code; journey checks refused release while open proposals remain, then verifies released content and retained answers from the Requestor view. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposals-workflow.ts` | Proposal/rewrite job, context assembly, run persistence and governance events | ✓ VERIFIED | Substantive implementation; controller route calls it; database-backed run and questionnaire projections supply consumers. |
| `apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-decisions.ts` | Per-item confirmation/rejection/undo with answered-question safeguards | ✓ VERIFIED | Substantive locked workflow; called by questionnaire controller and exercised through browser journeys/integration tests. |
| `apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx` | Analyst review and decision controls | ✓ VERIFIED | Renders typed proposal views, action states and status; wired through server actions and typed API layer. |
| `apps/csrm/e2e/questionnaire-ai-proposals.spec.ts` | Desktop/mobile browser coverage for main journey and negative cases | ✓ VERIFIED | Mobile project collects it; primary journey and take-back recovery passed on both projects. The complete two-file rerun exposed two hub-focus assertions; the same named hub test then passed independently at desktop and mobile after the focus fix. |
| `apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts` | Authenticated endpoint/controller and Requestor mutation projection | ✓ VERIFIED | Real service calls; latest controller projection preserves schemaVersion for deleted v2 questions; dedicated mounted regression test passes. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Analyst proposal/rewrite UI | Strapi questionnaire routes | Server actions → typed questionnaire AI service → authorized controller | ✓ WIRED | Controller invokes `startQuestionnaireProposals`, `startQuestionRewrite`, and `decideQuestionnaireAiProposals`. |
| Proposal workflow | AI provider and assessment context | `buildAssessmentContextFor` → provider `propose` → `toQuestionnaireProposal` | ✓ WIRED | Real provider interface and context construction; deterministic provider is used by automated journeys. |
| Proposal workflow | AI run and governance records | `createRunningAiRun` / completion and `appendGovernanceEvent` | ✓ WIRED | Run/timeline data is projected back to analyst view and asserted by the journey. |
| Decisions and release | Requestor questionnaire projection | Locked proposal decisions / release gate → persisted questions → controller projection | ✓ WIRED | Requestor journey sees accepted changes only after release and retains prior answers. |
| Signal start | Hub job status and proposal panel | Job handoff/focus request → hub status polling and refresh | ✓ WIRED | Focused `QUES12_SUBMITTED_HUB_JOB` passed independently on desktop and mobile. |

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| Analyst proposal panel | `QuestionnaireAiProposalsView` | Authenticated Strapi proposal read; run records and persisted questionnaire | Yes | ✓ FLOWING |
| Proposal job | provider proposal and stored `AiRun` | Strapi assessment/request/marked-note/question queries and configured provider | Yes | ✓ FLOWING |
| Requestor questionnaire | projected question/answer records | Persisted Strapi question rows after analyst release | Yes | ✓ FLOWING |
| Revision timeline | governance/run events | Persisted questionnaire governance log and AI run metadata | Yes | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command/evidence | Result | Status |
|---|---|---|---|
| Full frontend tests | `pnpm --dir apps/csrm test` | 222 files, 5,409 tests passed | ✓ PASS |
| Full backend tests | `pnpm --dir apps/backend test` (before latest controller correction) | 1,637 passed, 0 failed; latest correction additionally covered by dedicated mounted questionnaire regression | ✓ PASS |
| Strict typecheck/API check | Root `pnpm typecheck` after backend and frontend code edits | Successful Turbo typecheck/API generation check | ✓ PASS |
| Main Phase 15 questionnaire journey | `questionnaire-ai-proposals.spec.ts` desktop/mobile | Follow-up, decisions, rewrite, release and answer preservation passed in both projects | ✓ PASS |
| Requestor governance and recovery | Dedicated browser tests | Governance workflow passed; take-back recovery passed desktop/mobile | ✓ PASS |
| Hub-started proposal job focus | Named `QUES12_SUBMITTED_HUB_JOB` test | 1 passed desktop and 1 passed mobile after the corrected focus handoff | ✓ PASS |
| Full 2-file Phase 15 E2E rerun | `questionnaire-ai-proposals.spec.ts` + `questionnaire-governance-workflow.spec.ts` | 11 passed; two hub focus assertions failed in that combined run. The named hub test passed later in isolated desktop and mobile runs; the full combined run was not repeated after that correction. | ℹ INFO |
| Previous whole-workspace E2E gate | Phase 15 full E2E command | 227 passed, 3 failures (two hub-focus expectations and one Requestor projection regression); each failure was subsequently exercised by focused passing tests, but the entire gate was not rerun. | ℹ INFO |
| Final whole-workspace gate (2026-10-15) | `api:check`, typecheck, lint, web, Strapi, `test:e2e` (both projects, production build) | web 5,409/5,409; Strapi 1,637 passed, 0 failed, 1 skipped; Playwright 240/240 (desktop 176, mobile 64) at `e224a148` after one test-only fix; every route within budget | ✓ PASS |

## Probe Execution

No phase-declared or conventional migration/tooling probes apply to this application feature phase.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| QUES-11 | 15-01 through 15-14 | Analyst steers additions, edits and removals, decides each proposal, and gets attributable run/timeline records without mixing instructions with Requestor text. | SATISFIED (operator quality checks confirmed in `15-UAT.md`, 2026-10-15 re-verification) | Provider/run wiring, typed instruction slot, decision flow, and desktop/mobile journey assertions. |
| QUES-12 | 15-01 through 15-14 | Follow-up proposals use marked context, preserve answered questions and answers, and reach Requestors only after analyst release. | SATISFIED (operator quality checks confirmed in `15-UAT.md`, 2026-10-15 re-verification) | Context and answer-preservation workflow plus desktop/mobile journey assertions. |

No phase-mapped requirement is orphaned. The roadmap’s phase success criteria correspond to the four truths above.

### Decision Coverage

The GSD decision-coverage check reports **37/37 trackable CONTEXT decisions honored**, with no unhonored decisions.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|---|---|---:|---:|---:|---|---|
| `apps/csrm/e2e/questionnaire-ai-proposals.spec.ts` | QUES-11, QUES-12 | Yes | 0 | No | Behavioral, multi-step UI and value assertions | PASS |
| `apps/backend/tests/questionnaire-governance.integration.test.ts` | QUES-11, QUES-12 | Yes | 0 | No | Mounted Strapi behavior and persisted projection assertions | PASS |
| `apps/backend/tests/*proposal*` and `apps/csrm/src/features/questionnaire-ai/*.test.ts` | QUES-11, QUES-12 | Yes | 0 linked skipped tests found | No circular expected-value generation found in inspected tests | Value and state-transition assertions | PASS |

**Disabled tests on requirements:** 0 found in the Phase 15 E2E and questionnaire AI test paths. **Circular patterns detected:** 0 for requirement-linked tests. The broad workspace suites passed; the remaining evidence limitation is that the complete E2E gate and the two-spec rerun were not rerun green after the focused fixes.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | No unresolved TODO/FIXME/XXX debt markers or user-visible stubs found in inspected Phase 15 implementation. | — | Conditional `return null` and empty collections are used for valid absent-state/validation branches; they are not static data stubs. |

## Human Verification Required

All four are confirmed in `15-UAT.md` (tests 2 to 5, each `pass`); the list is kept as the 2026-10-13 verifier wrote it.


1. **NVDA speech and keyboard-only operation on Windows** — verify live-region announcements and focus order with NVDA; expected speech and focus are defined in frontmatter and 15-UAT.md.
2. **Live provider proposal quality** — run the approved provider against seeded fictitious data and judge instruction adherence, marked-note context, answer preservation and duplicate suppression.
3. **Production schema/catalogue acceptance** — deploy/read existing and new envelopes and capability catalogue against the production schema, including legacy record reads.
4. **Visual review at 375px and 1440px** — inspect actual rendering, clipping, hierarchy, control reachability and focus presentation; the current UI review could not capture screenshots.

## Gaps Summary

No code-level must-have failed. All four roadmap outcomes have substantive implementations, live data paths and automated browser evidence. The initial complete E2E gate and later combined questionnaire rerun did not finish green because of assertions that were subsequently isolated and passed after fixes; that residual evidence limitation is disclosed above. The phase remains `human_needed` because NVDA speech, real-provider quality, production schema acceptance, and actual rendered visual quality cannot be established by source inspection or deterministic local tests.

**2026-10-15:** both limits are closed. The four human checks pass in `15-UAT.md`, and the complete gate ran green in one full run (see "Re-verification (2026-10-15, closing worker)"). The status is `passed`, with no gaps and no deferred items.

---

_Verified: 2026-10-13T11:25:02Z_  
_Verifier: gsd-verifier_  
_Re-verified: 2026-10-15T02:45:00Z (closing worker, from `15-UAT.md` and the final gate)_
