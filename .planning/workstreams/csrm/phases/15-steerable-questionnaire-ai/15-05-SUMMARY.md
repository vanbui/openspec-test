---
phase: 15-steerable-questionnaire-ai
plan: 05
subsystem: api
tags: [strapi, ai-proposals, wire-schema, adapter, questionnaire, question-rewrite, deterministic-provider, openai-compatible, not-sure, guardrails, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-02's envelope v1 and parser, bases, preservation, placement and near-duplicate scorer; 15-04's questionnaire context part, its allowed sets and source ids, and the instruction slot
  - phase: 12-ai-context-suggestions-and-provenance
    provides: 12-05's questionnaire generation wire pipeline and its Not sure rule, the shared wire-schema guard, the fake OpenAI-compatible server, UNTRUSTED_DATA_INSTRUCTION and composeUserPrompt
provides:
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-adapter.ts (both wire schemas, toQuestionnaireProposal, toQuestionRewriteProposal, QUESTIONNAIRE_PROPOSAL_CAPS, QuestionnaireAdapterContext)
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-provider.ts (the provider interfaces, providerQuestionViews, activeQuestionnaireProposalProviders)
  - apps/backend/src/api/csrm-questionnaire/services/deterministic-questionnaire-proposal-provider.ts (rules W1 to W3, the adversarial pair, R1, PLAIN_LANGUAGE_GLOSSARY)
  - apps/backend/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-proposal-provider.ts (the hosted providers and their system rules)
  - apps/backend/src/csrm/ai/not-sure-choice.ts (the one Not sure rule, moved unchanged)
affects: [15-06, 15-07, 15-08, 15-09, 15-11, 15-12, 15-14, 16, 17]
actuals:
  tokens: 34000
  tasks: 3
  commits: 6
plan_head_before: 991656bdeadb57618fbf72d06afb23be94e7f9ec
plan_head_after: deb1c9019870db5c422f8b89890b0c3100593906
tech-stack:
  added: []
  patterns:
    - "Both providers return model-facing wire JSON; one adapter assigns every server value and records every drop, so the deterministic suites exercise the drop rules (Pitfall 9)"
    - "Per item, the first failing rule records one adjustment; run-level counts (over-limit, ignored fields, dropped sources) are one aggregated entry each, and the list is bounded at 60 by construction"
    - "Each kept item is applied alone to a copy of the context-time definition and checked by the definition parser, preservesAnswers and keepsControllerValues"
    - "The closed, context-aware envelope parser is the final gate; a refusal fails the job with PROVIDER_OUTPUT_INVALID"
key-files:
  created:
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-adapter.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-provider.ts
    - apps/backend/src/api/csrm-questionnaire/services/deterministic-questionnaire-proposal-provider.ts
    - apps/backend/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-proposal-provider.ts
    - apps/backend/src/csrm/ai/not-sure-choice.ts
    - apps/backend/tests/questionnaire-proposal-adapter.unit.test.ts
    - apps/backend/tests/ai-provider-questionnaire-proposals.unit.test.ts
    - apps/backend/tests/helpers/questionnaire-proposal-fixture.ts
    - apps/backend/tests/fixtures/ai-wire/questionnaire-proposals-offshore.json
    - apps/backend/tests/fixtures/ai-wire/questionnaire-proposals-edge-cases.json
    - apps/backend/tests/fixtures/ai-wire/question-rewrite-cases.json
  modified:
    - apps/backend/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider.ts
    - apps/backend/tests/ai-provider-guardrails.unit.test.ts
key-decisions:
  - "The adapter context carries the context-time rows (removed questions included, raw help text, stored answers), the 15-04 allowed sets, generatedDate and the open and rejected item texts; active and removed texts for the scorer come from the rows."
  - "Target resolution: a Qn outside the run is unknown-target; an Rn within the removed list, or a Qn whose question is removed, is removed-target; a Qn in answeredRefs, or whose stored answer is answered, is answered-target. A target is claimed once it resolves, so a second item on it is duplicate-target even if the first is later left out."
  - "Choice values: an addition's choices are the shipped rule's output (value equals label, the canonical Not sure as not-sure), as generation stores them. A change's labels keep the target's value when the label matches (without case); a new label takes the label as its value."
  - "The 2-to-20 choice bound counts the model's own choices, after Not sure equivalents are merged into the canonical one."
  - "A change field left null keeps the target's value; an empty choices list keeps the target's choices on a select. Changes and rewrites that keep a target value the envelope cannot hold (text over 1,000, help over 2,000, a select with fewer than 2 or more than 21 choices, labels repeated without case) are left out as invalid-item rather than failing the run at the parser."
  - "Each item is checked alone against the context-time definition, with a fresh batch allocation for its placement and key; confirmation (15-07) re-places the batch."
  - "At most 100 wire items are examined; any beyond count as over-limit unexamined. Per-item drops are recorded one by one up to 47, then aggregated per code, so the list never passes 60."
  - "A rewrite carries no sources (its wire has none); a rewrite that is left out completes as no-change with its adjustment."
  - "Deterministic rule order: W1 runs for the default task and also when the analyst's instruction mentions offshore; W2 only with an analyst instruction; W3 only for the default task with no marked note; the adversarial pair always. W3 cites the answered question only when its answer was sent."
  - "The hosted providers use the questionnaireGeneration settings and name; the system message is UNTRUSTED_DATA_INSTRUCTION followed by the shared Phase 15 rules and the operation's own rules, naming the citable ids Q{n}, request.{field}, note-{n}, file-{n} and instruction."
requirements-completed: []  # QUES-11 and QUES-12 are traced by this plan but delivered by the phase; they are marked complete at the 15-14 gate
coverage:
  - id: D1
    description: "The offshore follow-ups end to end: both providers' wire JSON through one adapter and the closed parser, three cited additions in a new section, the answered change and the near-duplicate left out"
    requirement: QUES-11
    verification:
      - kind: unit
        ref: "apps/backend/tests/ai-provider-questionnaire-proposals.unit.test.ts (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every drop rule, the caps, sources, ignored fields and the one Not sure rule; W2 and W3"
    requirement: QUES-12
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-proposal-adapter.unit.test.ts (21 tests)"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/ai-provider-questionnaire.unit.test.ts (12-05's 6 tests, unchanged)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plain-language rewrites change wording only; the hosted rules and the Requestor-note guardrail"
    requirement: QUES-12
    verification:
      - kind: unit
        ref: "apps/backend/tests/ai-provider-guardrails.unit.test.ts#the hosted questionnaire system rules say answered questions are fixed and the instruction cannot change the rules"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend test (1,559 tests: 1,558 pass, 0 fail, 1 skipped by platform)"
        status: pass
    human_judgment: false
duration: 51min
completed: 2026-10-11
status: complete
---

# Phase 15 Plan 05: The Wire, the Adapter and the Providers Summary

**Both questionnaire proposal providers now return model-facing wire JSON, and one adapter turns it into the stored envelope. The deterministic provider runs in every suite and the hosted one is proved through the fake server. The adapter leaves out and records anything CSRM cannot stand behind: an item on an answered, removed or unknown question, a second item on one target, an incomplete or over-long item, a near-duplicate, a change that changes nothing, a result that breaks the definition or an answered question, and anything past the caps. A plain-language rewrite can only change wording, and one shared Not sure rule serves generation and proposals.**

## Performance

- **Duration:** about 51 min, of which the full Strapi suite took about 30
- **Started:** 2026-10-11T11:21:38Z
- **Completed:** 2026-10-11T12:13Z
- **Tasks:** 3 of 3 (Task 1 the tracer)
- **Files:** 13 changed (11 created), 2,509 insertions and 26 deletions

## Accomplishments

- **The wire schemas.**
  - `questionnaireProposalsWireSchema(allowed)` (`questionnaire_proposals`): 16 object properties, with the `Q` enums built from the run's refs.
  - `questionRewriteWireSchema()` (`question_rewrite`): 5 properties.
  - Both pass `walkWireSchema`: no forbidden keyword, at most 100 properties and five levels.
- **The adapter** (`toQuestionnaireProposal`): structure, kind rules, target resolution, duplicates, bounds, select labels and the Not sure rule, sources, near-duplicates, no-change, the result on a copy of the definition, and the caps.
  - Choice and visibility values arrive as labels and map to the server's values.
  - Kept items get keys `i-1…` and their bases (`changeBase`, `addBase`).
  - The closed parser with `{ questionDocumentIds, sourceRefs }` is the gate.
- **The rewrite adapter** (`toQuestionRewriteProposal`): wording only, with labels mapped positionally onto the unchanged values.
  - A label count that differs from the target's is `rewrite-out-of-scope`.
  - An unchanged result is `no-change` with no item.
  - Definition validity and preservation run as for a change.
- **The deterministic providers:**
  - `deterministic-questionnaire-proposals` (version `1`) runs W1, W2 (tax file numbers, a removal, plain language), W3 and the adversarial pair.
  - `deterministic-question-rewrite` (version `1`) runs R1 with the five-entry `PLAIN_LANGUAGE_GLOSSARY`.
  - Both keep `propose` and `rewrite` as plain, replaceable members.
- **The hosted providers** (`openaiCompatibleQuestionnaireProposalProvider`, `openaiCompatibleQuestionRewriteProvider`): `requestJsonCompletion` with the `questionnaireGeneration` settings.
  - The system message is `UNTRUSTED_DATA_INSTRUCTION` followed by `QUESTIONNAIRE_PROPOSAL_SYSTEM_RULES` or `QUESTION_REWRITE_SYSTEM_RULES`.
  - The user message is the built context.
- **Not sure** (N-1): `NOT_SURE_CHOICE`, `isNotSureEquivalent` and `withCanonicalNotSure` moved byte-for-byte (diffed) into `src/csrm/ai/not-sure-choice.ts`, with the private list and comparison.
  - The generation provider imports them and keeps no copy.
  - `git diff 15eb830b -- apps/backend/tests/ai-provider-questionnaire.unit.test.ts` prints nothing, and its 6 tests pass.

## Adjustment counts each fixture case produces

| Fixture case | Items kept | Adjustments |
| --- | --- | --- |
| `questionnaire-proposals-offshore` (with `Q2` answered) | 3 additions in the new section Offshore support, each citing `note-1`; the Yes or No select ends in Not sure | `answered-target` ×1 (wire index 3), `near-duplicate` ×1 (wire index 4) |
| The deterministic provider on the same context | the same 3 items, deep-equal | the same two |
| `edge-cases.over-limit` (20 additions, then 20 removals; 21 unanswered questions) | 30: 15 additions, 15 removals | `over-limit` ×1, count 10 |
| `edge-cases.hidden-dependent` | 0 | `answers-affected` ×1 |
| `edge-cases.duplicate-target` | 1 change on `Q3` | `duplicate-target` ×1 (wire index 1) |
| `edge-cases.unknown-target` | 0 | `unknown-target` ×1 |
| `edge-cases.removed-target` | 0 | `removed-target` ×1 |
| `edge-cases.bad-sources` | 1, with sources `note-1` and `request.title` | `sources-dropped` ×1, count 3 |
| `edge-cases.boolean-type` | 0 | `invalid-item` ×1 |
| `question-rewrite-cases.plain` | 1 change (wording only) | none |
| `question-rewrite-cases.label-mismatch` | 0, outcome `no-change` | `rewrite-out-of-scope` ×1 |
| `question-rewrite-cases.unchanged` | 0, outcome `no-change` | none |

The adapter test file has one case per item code: answered, unknown, removed, duplicate, invalid, near-duplicate, no-change, definition-invalid, answers-affected, rewrite-out-of-scope and over-limit. `ignored-field` (one entry, count 2) and `sources-dropped` are asserted inside other cases.

## Task Commits

1. **Task 1 (tracer): the offshore follow-ups end to end**: `ca0feee3` (test, RED) and `7e95d15f` (feat, GREEN). Tracer gate: auto mode is off and the verify is automated only. The verify re-ran green (3/3), so expansion continued.
2. **Task 2: every drop rule, the caps, sources and the one Not sure rule**: `50f80b17` (test, RED) and `e3472987` (feat, GREEN).
3. **Task 3: plain-language rewrites, rule R1 and the hosted system rules**: `f5a866ff` (test, RED) and `deb1c901` (feat, GREEN).

`git rev-list --count 991656bd..deb1c901` is 6.

How each RED step failed:

- Task 1: TS2307, because the adapter and provider modules did not exist.
- Task 2: TS2307, because `src/csrm/ai/not-sure-choice` did not exist.
- Task 3: TS2305 and TS2724, because the rewrite exports did not exist.

## Verification

- **Task 1 verify:** `tsc`, `tsc -p tests` and `ai-provider-questionnaire-proposals.unit`: 3/3 pass.
- **Task 2 verify:** `questionnaire-proposal-adapter.unit` (20 then), 12-05's `ai-provider-questionnaire.unit` (6) and `ai-provider-questionnaire-proposals.unit` (3): 29/29 pass.
- **Task 3 focused:** these four files passed 52/52 together:
  - `questionnaire-proposal-adapter.unit` (21)
  - `ai-provider-questionnaire.unit` (6)
  - `ai-provider-questionnaire-proposals.unit` (9)
  - `ai-provider-guardrails.unit` (16)
- **Task 3 verify, the full Strapi suite** (`pnpm --dir apps/backend test`): 1,559 tests ran, 1,558 passed, 0 failed and 1 was skipped (the POSIX-modes test, skipped on Windows). Exit 0, 1,786 s. It ran with the dev servers stopped, both Keycloak flags false, the classification ceiling empty and the deterministic provider.
- **Acceptance criteria:**
  - The deterministic providers' names and versions match the plan.
  - The offshore fixture holds `"schemaVersion": 1` and no `"key"`.
  - The generation provider imports `withCanonicalNotSure` from `../../../csrm/ai/not-sure-choice` and holds no second list.
  - 12-05's test file is unchanged against `15eb830b`.
  - `PLAIN_LANGUAGE_GLOSSARY` has five entries.
  - The guardrails file has a case named with `answered questions are fixed`.
- **Not run here:**
  - No web file, specification or catalogue changed, so the web suite, `api:check` and Playwright were not run, as planned.
  - The content-type freeze is empty (`git diff --name-only 15eb830b -- 'apps/backend/src/api/*/content-types/*'`).
  - No route was measured.
  - Nothing reached a hosted provider: the hosted providers were only pointed at the local fake server, with no key.

## Files Created/Modified

- `questionnaire-proposal-adapter.ts` (new): both wire schemas, both adapters, the caps and the adapter context type.
- `questionnaire-proposal-provider.ts` (new): the provider interfaces and inputs, `providerQuestionViews` (active questions as `Q1…Qn`, with choice labels for selects only) and the selection.
- `deterministic-questionnaire-proposal-provider.ts` (new): W1 to W3, the adversarial pair, R1, the glossary and both deterministic providers.
- `openai-compatible-questionnaire-proposal-provider.ts` (new): both hosted providers and their system rules.
- `src/csrm/ai/not-sure-choice.ts` (new): the moved rule.
- `openai-compatible-questionnaire-generation-provider.ts`: imports the shared rule and drops its copy (26 lines out, 2 in).
- Tests:
  - two new unit files;
  - the shared fixture helper `tests/helpers/questionnaire-proposal-fixture.ts`;
  - three wire fixtures;
  - two guardrail cases in `ai-provider-guardrails.unit.test.ts`.

## Decisions Made

The frontmatter's key decisions, with their reasons:

- **Rows in the adapter context, not text lists.** The preservation predicate needs the stored answers and the definition, removed questions included. The active and removed texts follow from the same rows, so the workflow (15-06) passes one source of truth.
- **`R{n}` reads as removed.** 15-04 numbers only active questions `Q1…Qn` and lists removed ones as `R1…`, so a model that names a removed question can only use an `R` ref. It is recorded as `removed-target`, the more useful line for the analyst, rather than as unknown.
- **The envelope's bounds are enforced before the parser.** A target may hold values the definition allows but the envelope does not. Leaving such an item out keeps the run's other proposals; failing the run would lose them all.
- **Each item is checked alone.** D-15 speaks of an item that makes the definition invalid "on its own". Placement at confirmation is recomputed for the whole batch (15-07), so the adapter's placement is a check, never stored.
- **Choice values.** Additions store the shipped rule's output, as hosted generation does, so the two AI paths agree. A relabelled change keeps the target's values where it can, so a dependent's rule still reads them.
- **W1 with an instruction.** An instruction that asks about offshore support while a marked note is about it gives the offshore follow-ups as well as W2's items, as a model would. An unrelated instruction does not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A shared test fixture helper outside the plan's file list**
- **Found during:** Task 1 (RED)
- **Issue:** The two new test files and the guardrail cases need the same proposal context: questions with stored answers, the 15-04 context and allowed sets, the adapter context and the provider inputs. Building it three times would repeat 150 lines.
- **Fix:** `apps/backend/tests/helpers/questionnaire-proposal-fixture.ts` builds all of it from one question list. In Task 2 the fixture's logging question was reworded to name "logging", so W2's word overlap finds it ("logged" and "logging" are different tokens).
- **Committed in:** `ca0feee3`, `50f80b17`

**2. [Rule 2 - Missing critical] Bounds the envelope parser would refuse**
- **Found during:** Task 3 (GREEN)
- **Issue:** A change or rewrite keeps the target's values. A target can hold text over 1,000 characters, a select with 1 or more than 21 choices, or labels repeated without case. The closed parser would refuse such an item and fail the whole run.
- **Fix:** `withinProposalBounds` leaves such an item out as `invalid-item`.
- **Committed in:** `deb1c901`

**3. [Rule 3 - Blocking] The rewrite-out-of-scope case in the adapter test file**
- **Issue:** Task 2's acceptance asks for one test per adjustment code in `questionnaire-proposal-adapter.unit.test.ts`, but `toQuestionRewriteProposal` arrives in Task 3.
- **Fix:** The case was added to that file in Task 3's RED commit.
- **Committed in:** `f5a866ff`

**4. [Rule 3 - Blocking] The provider selection widened in Task 3**
- **Issue:** The rewrite providers do not exist until Task 3.
- **Fix:** `activeQuestionnaireProposalProviders()` returned `{ proposals }` from Task 1 and gained `rewrite` in Task 3. No caller exists yet.
- **Committed in:** `7e95d15f`, `deb1c901`

**5. [Rule 1 - Bug] Control characters written for regular-expression escapes**
- **Found during:** Task 2 (GREEN)
- **Issue:** A scripted edit turned `\b` into backspace characters in two W2 patterns.
- **Fix:** The four characters were rewritten as `\b` before the commit. Later edits used the editor tool.
- **Committed in:** `e3472987` (never committed broken)

---

**Total deviations:** 5 auto-fixed (3 blocking, 1 missing critical, 1 bug)
**Impact on plan:** none on scope. The helper and the bounds guard keep the suites and the run robust.

## Identifier differences from the written-ahead plan

- 15-04 provides `QuestionnaireContextAllowed` with `refs`, `answeredRefs`, `removedDocumentIds` and `controllerChoiceLabels`. The adapter reads them as named. Visibility values map through the controller's own row (the same labels as `controllerChoiceLabels`), because the row also gives the value.
- The plan's "active, open, rejected and removed texts" are `openItemTexts` and `rejectedItemTexts`. Active and removed texts come from `rows`.
- The provider inputs also carry the question views and the marked notes as `{ ref: "note-{n}", body }`. The plan named "the marked note texts".
- `QUESTION_REWRITE_SYSTEM_RULES` is exported beside `QUESTIONNAIRE_PROPOSAL_SYSTEM_RULES`, because each operation has its own output rules.

## Issues Encountered

- Bash heredocs with nested quoting failed twice to parse. The edits were redone with the editor tool and scratchpad scripts. Nothing was lost.

## Known Stubs

None. No workflow calls the providers or the adapter yet; 15-06 does, as planned.

## Threat Flags

None. No endpoint, auth path, file access or schema changed. The hosted providers reuse `requestJsonCompletion`, so the call path is the existing one.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **15-06 (the jobs):**
  - Build `QuestionnaireAdapterContext` from the same records as the context: `allowed` is `context.questionnaire`.
  - `rows` are `PreservationRow`s for every question, removed ones included, with raw help text and stored answers.
  - `generatedDate` is the questionnaire's.
  - `openItemTexts` and `rejectedItemTexts` are the proposed texts of the open and rejected items, the same lists the context part reads.
  - Build the provider input with `providerQuestionViews(questionnaireContextQuestions)`, the marked notes as `{ ref: "note-{sequence}", body }`, and the resolved instruction and its source.
  - Call `activeQuestionnaireProposalProviders()`, then `toQuestionnaireProposal` or `toQuestionRewriteProposal`. Both throw `QuestionnaireGenerationJobFailure("PROVIDER_OUTPUT_INVALID", …)` on a structural or parser failure. The hosted providers map provider errors to the same class.
- **15-06's held-provider helper** can replace `deterministicQuestionnaireProposalProvider.propose` and `deterministicQuestionRewriteProvider.rewrite`.
- **15-07:** a rewrite's change carries no sources. A removal's base is `changeBase`, as for a change.
- **15-11:** the adapter's `detail` sentences are CSRM's own. The UI-SPEC's left-out lines map by code. `over-limit`, `ignored-field` and `sources-dropped` carry `count` and no `wireIndex`. Codes aggregated beyond 47 entries also carry `count`.
- **15-14:** the deterministic offshore run yields exactly three items and two left out (`answered-target`, `near-duplicate`) on a questionnaire with an answered question. The MFA question rewrites to text containing "a second sign-in step (multi-factor authentication)".

## Self-Check: PASSED

- FOUND: all 11 created files (`[ -f ]` on each), and both modified files.
- FOUND: ca0feee3, 7e95d15f, 50f80b17, e3472987, f5a866ff, deb1c901. `git rev-list --count 991656bd..HEAD` is 6 before this summary.
- Acceptance criteria re-run: all pass. Plan verification: the focused files 52/52, the full Strapi suite green, `tsc` clean, the content-type freeze empty, 12-05's test file unchanged.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-11*
