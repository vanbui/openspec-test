---
phase: 16-risk-curation-and-targeted-ai-re-runs
plan: 08
subsystem: backend-ai-risk-proposals
tags: [ai-proposals, risk-suggestions, risk-rewrite, context, adapter, deterministic-provider, hosted-provider, run-record, contract, tdd]

requires:
  - phase: 16-risk-curation-and-targeted-ai-re-runs
    provides: "16-02's pure rules (classifyProposedRisk, diffIntoUnits, aiAcceptCheck, normaliseRiskValues, parseRiskProposal, parseRiskDecisionEvents); 16-07's active-risk reader guard; the approved Phase 16 amendment (risk proposal envelope v1, context summary v5)"
  - phase: 15-steerable-questionnaire-ai
    provides: "SlotInstruction and the instruction slot, foldItemStates, ProposalJobFailure, the provider-returns-wire pattern"
  - phase: 12-ai-context-suggestions-and-provenance
    provides: "buildAssessmentContext, the draft wire v2 risk object and its per-risk adapter steps, riskHasPlannedControl, the run record"
provides:
  - "risk-proposal-context.ts: RISK_PROPOSAL_CONTEXT_BOUNDS, RISK_CONTEXT_TOO_LARGE_MESSAGE, buildRiskProposalContextPart, parseRewriteFocus and the types RiskProposalContextRecords, RiskProposalContextPart, RiskProposalContextAllowed, RiskContextRisk, RiskContextSuggestion, RiskContextControl, RiskListedEntry, RiskListedRef, RiskRewriteTarget, RiskTargetWireView"
  - "risk-proposal-adapter.ts: toRiskSuggestionsProposal, toRiskRewriteProposal, riskSuggestionsWireSchema, riskRewriteWireSchema, checkWireRiskStructure, invalidRiskProposalOutput, RISK_PROPOSAL_WIRE_SCHEMA_VERSION, RISK_WIRE_RISKS_EXAMINED"
  - "risk-proposal-provider.ts: RiskProposalProvider, RiskProposalProviderInput, selectRiskProposalProvider, and re-exports of the two wire schemas, RISK_PROPOSAL_SYSTEM_INSTRUCTIONS, RISK_SUGGESTIONS_TASK, RISK_REWRITE_TASK"
  - "deterministic-risk-proposal-provider.ts: deterministicRiskProposalProvider (deterministic-risk-proposals, version 1), setDeterministicRiskProposalHold, PAYMENT_FILE_RISK, SEGREGATION_OF_DUTIES_RISK, REWRITE_* sentences"
  - "openai-compatible-risk-proposal-provider.ts: openAiCompatibleRiskProposalProvider, RISK_PROPOSAL_SYSTEM_INSTRUCTIONS"
  - "assessment-context.ts: AiRunOperation + risk-suggestions and risk-rewrite; ContextSummaryV5 and ContextSummaryRiskProposals; contextRecordKeys; RISK_PROPOSAL_CONTEXT_OPERATIONS; AssessmentContext.riskProposals; AssessmentContextTooLargeError's optional safeMessage"
  - "assessment-context-loader.ts: buildAssessmentContextFor takes assessmentId, targetRiskId and focus and returns riskSource; loadRiskProposalRecords, loadDecidedRiskSuggestions, riskContextRisk"
  - "ai-run-record.ts: both operations in AI_RUN_OPERATIONS; parseRunProposalFor and parseRunDecisionsFor dispatch them to the risk envelope; parseContextSummary reads v5 beside v1 to v4"
  - "openai-compatible-assessment-draft-provider.ts: DRAFT_WIRE_RISK_KEYS, assessmentDraftRiskWireSchema, toAssessmentDraftRisk (Phase 12's per-risk steps, exported unchanged)"
  - "Spec: AiRun.operation and AiRunContextSummary.operation gain both values; AiRunContextSummary.schemaVersion gains 5 and the required, nullable riskProposals; component AiRunContextRiskProposals. Web: aiRunSchema and aiRunContextRiskProposalsSchema"
affects: [16-09, 16-10, 16-11, 16-15, phase-17]

actuals:
  tokens: 47000  # chars/4 over the added lines of the realized diff (188,280 characters)
  tasks: 3
  commits: 6  # git rev-list --count 8d7ebd18..HEAD before the docs commit

plan_head_before: 8d7ebd189dc365f7fa3c65978a04ad8250e5b1f4
plan_head_after: cab5f283878e3190f253fe0f1a920315399a5158

tech-stack:
  added: []
  patterns:
    - "One context builder, one extra part: the risk part adds reference blocks, allowed sets and a summary section, as Phase 15's questionnaire part does"
    - "Providers return wire JSON; one adapter per operation owns every rule; the closed, context-aware parser is the gate"
    - "Phase 12's draft risk wire object and per-risk steps reused through exports, not copied"

key-files:
  created:
    - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-context.ts
    - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-adapter.ts
    - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-provider.ts
    - apps/backend/src/csrm/ai/risk-proposals/deterministic-risk-proposal-provider.ts
    - apps/backend/src/csrm/ai/risk-proposals/openai-compatible-risk-proposal-provider.ts
    - apps/backend/tests/risk-proposal-context.unit.test.ts
    - apps/backend/tests/ai-provider-risk-proposals.unit.test.ts
    - apps/backend/tests/helpers/risk-proposal-fixture.ts
    - apps/backend/tests/fixtures/ai-wire/risk-proposals-wire.json
  modified:
    - apps/backend/src/csrm/ai/assessment-context.ts
    - apps/backend/src/csrm/ai/assessment-context-loader.ts
    - apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts
    - apps/backend/src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider.ts
    - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-envelope.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts
    - apps/backend/tests/ai-provider-guardrails.unit.test.ts
    - apps/backend/tests/assessment-context.unit.test.ts
    - apps/backend/tests/ai-provenance.unit.test.ts
    - apps/backend/tests/ai-inputs-signal.unit.test.ts
    - apps/backend/tests/ai-run.integration.test.ts
    - apps/backend/tests/assessment-context.integration.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
    - apps/backend/tests/questionnaire-generation.integration.test.ts
    - apps/backend/tests/attachment-ai-input.integration.test.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts
    - apps/csrm/src/features/ai-assistance/test-fixtures.ts

key-decisions:
  - "Context summary v5 is written by every context, every operation (the amendment: 'Every context built after this amendment is implemented writes v5'); riskProposals is null for the four earlier operations and required in the spec, as the amendment says (the plan said optional)"
  - "A same-run similar match is not flagged: the envelope's similarTo has no same-run kind, so the adapter re-classifies against the stored pools only and points the reviewer at the closest active, withdrawn, rejected or open entry, or at nothing. A same-run near-identical is still dropped as near-duplicate-proposed"
  - "The ninth kept suggestion onwards is one aggregated over-limit adjustment (the plan); the amendment's Bounds row names suggestions-capped, which already means suggested controls past five, so one code keeps one meaning"
  - "Both risk operations send the submitted answers as the draft does, read from the request's questionnaire only when its whole active batch is submitted (otherwise none: the fail-safe direction); sources stay the draft's (request fields, answers, systems, assets)"
  - "Suggestions offer control candidates (as the draft); a rewrite offers none and drops any suggested control (suggestions-dropped), since a rewrite changes no control"
  - "A rewrite never clears a value: an empty text, or a null Risk Type, system or asset, keeps the target's value; the classification follows the asset only when the asset changes"
  - "A refused AI Accept in a rewrite becomes Treat with the target's own plan (the AI's acceptance rationale is not kept as a treatment plan); the Accept rule applies only when the AI changes the action to Accept"
  - "A statement unit carries its sources; one that cites nothing has sources [] and the risk's uncited claims (at most five)"
  - "The rewrite's target keeps its own Risk Type on offer (pinned) when the library is ranked down to 60"
  - "More than 100 completed suggestion runs read for one context, or more than 200 entries, is CONTEXT_TOO_LARGE with CSRM's own message, never a truncation"

requirements: [ASSESS-10]
requirements-completed: []  # shared ID: marked complete by the phase's last plan

duration: 120min
completed: 2026-10-15
status: complete
---

# Phase 16 Plan 08: The Model-Facing Half of Both Risk AI Operations Summary

**"Suggest more risks" and "Rewrite this risk" from context to parsed proposal, without Strapi: Phase 12's context with short-keyed risk blocks bounded at 200 entries, the deterministic and hosted providers returning wire JSON, one adapter per operation owning the duplicate tiers, the cap of 8, the units, the focus and the one Accept rule, and the run record, contract and web parser reading both operations and the v5 summary.**

## Performance

- **Duration:** about 120 minutes, 35 of them the full Strapi suite
- **Tasks:** 3, each RED then GREEN
- **Files:** 9 created, 19 modified

## Accomplishments

- **Context** (`risk-proposal-context.ts`, D-25, D-31, D-35): suggestions list `existing-n` (Risk Type name, statement and cause capped at 600, system and asset short keys), `withdrawn-n` with the reason, `rejected-n` with the reason and `open-n`; a rewrite lists `targetRisk` (its twenty values whole, relations by name or short key, its controls by number, name and status), `other-n` and the focus. No risk number, owner, date or documentId reaches the prompt. 201 entries throw `AssessmentContextTooLargeError` (`CONTEXT_TOO_LARGE`). The base the units diff against is captured here.
- **Loader** (D-31): reads the active and withdrawn Risks through `ACTIVE_RISK_FILTER` and `WITHDRAWN_RISK_FILTER` (16-07's guard passes with no exemption), folds the assessment's completed `risk-suggestions` runs (at most 101 read) to their rejected and open items, and reads a rewrite's target with its control implementations, refusing a withdrawn target or one of another assessment.
- **Suggestions adapter** (D-30 to D-32, D-38): exact structure or `PROVIDER_OUTPUT_INVALID`; Phase 12's per-risk steps (`toAssessmentDraftRisk`) with a refused value as `invalid-item`; `classifyProposedRisk` against the four listed pools and the risks kept so far; `aiAcceptCheck` with no planned control; cap of 8 with one `over-limit`; `s-1` onwards; `no-change` when nothing is kept; the closed parser as the gate.
- **Rewrite adapter** (D-34 to D-38, G-14): the one risk mapped to the twenty fields, the Accept rule with `riskHasPlannedControl`, `diffIntoUnits` with the focus, units with sources and uncited claims, `no-change` when no unit remains.
- **Providers** (D-50): deterministic rules S1 to S4 and the rewrite rules; `setDeterministicRiskProposalHold` for 16-09; the hosted provider on the assessment draft's settings with `risk_suggestions` and `risk_rewrite` schemas inside the portable subset and the system rules.
- **Run record and read** (D-02): both operations in the closed vocabulary, dispatched by operation to the risk envelope and decision events v2; summary v5 parsed closed (scope agrees with the operation, counts within 200, focus a unique subset); the spec, the generated client and the web parser changed together.

## Context summary version, the draft risk wire, prompt-sections.ts

- **Context summary version: 5.** Every context writes it; `riskProposals` is set for the two new operations and null otherwise; v1 to v4 read with it null; a risk operation's summary must be v5.
- **12-06's risk wire builder had to be exported:** `assessmentDraftRiskWireSchema` (the risk object, which `assessmentDraftWireSchema` now uses), `DRAFT_WIRE_RISK_KEYS` and `toAssessmentDraftRisk` (the per-risk steps `toAssessmentDraftProposal` now maps over). Behaviour unchanged; Phase 12's provider tests pass.
- **`prompt-sections.ts` did not change:** the risk blocks are labelled values through `renderReferenceDataBlock`, as Phase 15's questionnaire part is.

## Task Commits

1. Task 1 RED: `f154f0da` test(16-08): pin the suggestion context and the deterministic suggestion path
2. Task 1 GREEN: `b78628f6` feat(16-08): build the suggestion context, adapter and deterministic provider
3. Task 2 RED: `d068ad32` test(16-08): pin the rewrite context, units and Accept downgrades
4. Task 2 GREEN: `1e95f4b2` feat(16-08): build the rewrite context, adapter and deterministic rules
5. Task 3 RED: `c3230842` test(16-08): pin the hosted risk proposal wire and the run record operations
6. Task 3 GREEN: `cab5f283` feat(16-08): add the hosted risk proposal provider and the run record operations

**Plan metadata:** the `docs(16-08)` commit adding this summary with STATE.md, state.json and ROADMAP.md.

## Verification

| Command | Result |
| --- | --- |
| Task 1 verify (both tsc; `risk-proposal-context`, `ai-provider-risk-proposals`, `assessment-context` unit files) | 50/50 pass |
| Extra after Task 1 (`ai-provenance`, `ai-provider-assessment`, `ai-provider-guardrails`, `ai-inputs-signal`, `questionnaire-review-regressions`, `risk-proposal-envelope`, `active-risk-readers`, `risk-field-units`, `risk-duplicates`, `ai-provider-failures`) | 127/127 pass |
| Task 2 verify (`risk-proposal-context`, `ai-provider-risk-proposals`) | 27/27 pass |
| Task 3 focused (all of the above with the Task 3 cases) | 198/198 pass |
| Task 3 verify: `tsc`, the FULL Strapi suite (`pnpm --dir apps/backend test`) | 1,960 passed, 0 failed, 1 skipped of 1,961 (exit 0, 2,118 s) |
| `pnpm --dir apps/csrm api:check` (after the commit) and `git update-index --refresh` | clean (exit 0) |
| `pnpm --dir apps/csrm exec vitest run src/features/ai-assistance src/features/contract-response-parity.test.ts` | 395/395 pass (17 files) |
| `pnpm --dir apps/csrm typecheck`, `pnpm --dir apps/csrm lint` | exit 0, exit 0 |
| Acceptance greps: the adapter imports `classifyProposedRisk`, `aiAcceptCheck`, `diffIntoUnits`, `riskHasPlannedControl`; the deterministic provider does not import `parseRiskProposal`; test names hold `payment-file`, `near-duplicate`, `CONTEXT_TOO_LARGE`, `outside-focus`, `uncited`, `planned control`, `cannot loosen`; `ai-run-record.ts` and the spec's `AiRun.operation` hold both operations | pass |

## Decisions Made

See `key-decisions` above. What 16-09 and 16-10 need:

- `buildAssessmentContextFor(strapi, { operation, requestId, assessmentId, targetRiskId?, focus?, instruction, instructionSource })` returns `{ context, policy, records, steering, riskSource }`. The adapters take `(raw, context)`; the providers take `{ context, records, instruction }`.
- Adapter and hosted provider failures are `ProposalJobFailure` (15-06's), code `PROVIDER_OUTPUT_INVALID` or the client's code.
- `context.riskProposals.target.base` is the unit base to keep; `context.riskProposals.refs` maps a short key back to its Risk or run item.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A module-load copy of `RISK_STATEMENT_FIELDS` in the risk envelope**
- **Found during:** Task 1 (adding the run record's import of the envelope)
- **Issue:** `risk-proposal-envelope.ts` built `new Set(RISK_STATEMENT_FIELDS)` when it loaded. The run record now reads the envelope, and `ai-provenance.ts` (which defines the constant) reads the run record, so in one load order the set would be empty and every rewrite unit with sources would fail to parse.
- **Fix:** the check reads the constant when a unit is parsed (`isStatementField`).
- **Commit:** `b78628f6`

**2. [Rule 1 - Tests kept true] Version pins and legacy fixtures after summary v5**
- The approved amendment makes every context write v5. Pins of `schemaVersion` 4 now read 5 (`assessment-context`, `ai-provenance` unit; `ai-run`, `assessment-context`, `assessment-workflow`, `questionnaire-generation` integration). Fixtures that derive an older summary from a built one also drop `riskProposals` (`ai-run`, `attachment-ai-input` integration; `ai-inputs-signal`, `ai-provenance` unit). The "unknown version" probes move from 5 to 6 (backend and web).
- **Commits:** `b78628f6`, `cab5f283`

**3. [Rule 3 - Blocking] Files beyond `files_modified`**
- `openai-compatible-assessment-draft-provider.ts` (the exports above), `risk-proposal-envelope.ts` (deviation 1), `tests/helpers/risk-proposal-fixture.ts` (the shared UAT-A-like risk records), `apps/csrm/src/features/ai-assistance/test-fixtures.ts` and `ai-assistance-service.test.ts` (the web parser's test, the plan's "web schema test"), and the version pins of deviation 2.

### Plan-shape notes

**4. [Plan detail] Work landed a task early**
- Task 1's GREEN needed the run record's v5 parse and risk dispatch (the loader folds suggestion runs through `parseRunProposalFor`), so "Run record" landed in Task 1. The provider module selects both providers, so the hosted provider landed with it too. Task 1 also built the rewrite half of the context and the deterministic rewrite rules. As a result, Task 2's RED failed on the missing `toRiskRewriteProposal` alone, and Task 3's backend cases passed at RED: only the web parser cases failed there (6 of them).

**5. [Plan detail] Where the wire schemas and system rules live**
- They are defined beside their readers (the schemas in the adapter, the system rules in the hosted provider) and re-exported from `risk-proposal-provider.ts`, so the provider module (which selects the hosted provider) and the hosted provider (which needs the schemas) form no module cycle.

**6. [Plan detail] One system message per operation**
- `RISK_PROPOSAL_SYSTEM_INSTRUCTIONS` holds every rule of "System instructions" for both operations, after Phase 12's untrusted-data instruction; each call prefixes its task (`RISK_SUGGESTIONS_TASK` or `RISK_REWRITE_TASK`).

**7. [Plan detail] Followed the executed code where the written-ahead plan differs**
- `ProposalJobFailure` (15-06) is the failure type, not a new one. `riskHasPlannedControl` is in `ai-proposal-decisions.ts`, so the adapter (not the pure context module, which the loader reads) imports it. The CONTEXT_TOO_LARGE refusal for the risk lists carries CSRM's own message through a new optional `safeMessage` on `AssessmentContextTooLargeError`.

**Total deviations:** 1 bug fixed, 1 set of tests kept true, 1 blocking file note and 4 plan-shape notes. No scope creep.

## Issues Encountered

- Bash heredocs that held template literals failed in this shell; those test chunks were written with the file tools instead.

## Known Stubs

None in this plan's scope. The run sheet (`ai-run-sheet.tsx`) parses the v5 summary but does not yet show the risk proposal section; the Phase 16 UI plans render it.

## Next Phase Readiness

- 16-09 runs these as jobs: `buildAssessmentContextFor` for both operations, `selectRiskProposalProvider`, the two adapters, `setDeterministicRiskProposalHold`, and the run record's dispatch.
- For the pilot: the amendment's Bounds row names `suggestions-capped` for suggestions past 8; the code uses `over-limit` (key decision above). A one-line clarification to the amendment would make the record and the code agree.

## Self-Check: PASSED

- All nine created files exist; the modified files carry the changes listed.
- All six plan commits exist: `f154f0da`, `b78628f6`, `d068ad32`, `1e95f4b2`, `c3230842`, `cab5f283`.
- The full Strapi suite exited 0 (1,960 passed, 1 skipped); `api:check`, the web AI tests, typecheck and lint pass.

---
*Phase: 16-risk-curation-and-targeted-ai-re-runs*
*Completed: 2026-10-15*
