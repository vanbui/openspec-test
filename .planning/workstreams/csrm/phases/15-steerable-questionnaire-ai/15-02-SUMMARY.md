---
phase: 15-steerable-questionnaire-ai
plan: 02
subsystem: api
tags: [strapi, ai-proposals, decision-events, questionnaire, fingerprint, placement, instruction, near-duplicate, pure-modules, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-01's approved Phase 15 amendments (questionnaire proposal envelope v1, decision event v2, bases and staleness, bounds)
  - phase: 12-ai-context-suggestions-and-provenance
    provides: tokenize (library-ranking.ts), the CsrmAiRun proposal and decisions attributes and AI_RUN_BOUNDS
  - phase: 10-questionnaire-governance
    provides: the browser placement rules and case table (10-09), questionKeyFromText, the definition parser and the answer envelope
provides:
  - apps/backend/src/csrm/ai/proposal-items.ts, the generic item core (decision event v2, the transition table, the fold, open items)
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-envelope.ts, the closed envelope v1, payload parsers, fingerprints, bases and staleness
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-answer-preservation.ts, the one answered rule and the preservation predicates
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-placement.ts, server placement and batch key allocation
  - apps/backend/src/csrm/ai/analyst-instruction.ts, the shared instruction validator, the branded slot type, the preset and the Requestor-text guard
  - apps/backend/src/csrm/ai/text-similarity.ts, the shared near-duplicate scorer
affects: [15-04, 15-05, 15-06, 15-07, 15-08, 16, 17]
actuals:
  tokens: 30928
  tasks: 4
  commits: 8
plan_head_before: 878a27efcc4345352777f0047b3d4102a5caad3a
plan_head_after: af9e6deefa2a2e96f6e85630cfb36ee3c0b8b915
tech-stack:
  added: []
  patterns:
    - "Generic item core with target-supplied payload parsers (editFields, before, applied): one item mechanism for Phases 15, 16 and 17"
    - "Closed, frozen, never-throwing envelope parsers in the governance log's posture; a damaged run is null and counts no open item"
    - "Mutable batch allocation: placement and key allocation remember what earlier decisions of the same batch took"
    - "Branded SlotInstruction: only the validator and the preset produce slot input"
key-files:
  created:
    - apps/backend/src/csrm/ai/proposal-items.ts
    - apps/backend/src/csrm/ai/analyst-instruction.ts
    - apps/backend/src/csrm/ai/text-similarity.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-envelope.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-answer-preservation.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-placement.ts
    - apps/backend/tests/proposal-items.unit.test.ts
    - apps/backend/tests/questionnaire-proposal-envelope.unit.test.ts
    - apps/backend/tests/questionnaire-answer-preservation.unit.test.ts
    - apps/backend/tests/questionnaire-placement.unit.test.ts
    - apps/backend/tests/analyst-instruction.unit.test.ts
    - apps/backend/tests/text-similarity.unit.test.ts
  modified: []
key-decisions:
  - "DecisionPayloadParsers carries editFields beside before and applied, so the generic core names no question field; the questionnaire supplies its six."
  - "A decision event's optional keys belong to their actions: edits and before only on accepted, applied on accepted or restored, reason only on rejected, and a cause required on superseded (newer-rewrite) and lapsed (questionnaire-frozen); edits are 1 to 10 unique names."
  - "Absent or null decisions read as an empty log (a run with no decision yet), not a damaged run; any other malformed log, a v1 event included, is damaged (null)."
  - "Envelope items are keyed i-1 to i-n in stored order; a rewrite envelope holds at most one change; an addition's base agrees with its proposed section, and it has a controller exactly when it has a visibility rule, on the same question key."
  - "The envelope bounds a source ref as a token (1 to 255 characters of letters, digits and . _ : -) and leaves membership to the allowed-sets gate, because 15-04 owns the Phase 15 context ids (Phase 12's answer ids read answer.{questionKey})."
  - "The envelope does not require the canonical Not sure: a rewrite keeps its target's choice values (D-11), so a target without Not sure cannot gain one; selects carry 2 to 21 choices with case-insensitively unique labels, other types none, and only an addition is refused Boolean or File upload."
  - "isAnsweredValue copies questionnaire-scope.ts hasValue exactly, so an envelope with no value member counts as answered, the protective direction for D-05."
  - "preservesAnswers refuses an invalid answer only when the change made it invalid, so a stored answer that was already invalid does not block every proposal; the hidden-dependent rule keeps an answered question's controller active and still offering the rule's value it offered before, beside the visible-before, visible-after check."
  - "addBase(live, { section, visibility }) returns null when an existing section has no active question or the controller is missing or removed, so the adapter leaves that addition out; generation dates compare as instants."
  - "placeAddition records each placement in the batch allocation and returns null for a blank new-section title."
requirements-completed: []  # QUES-11 and QUES-12 are traced by this plan but delivered by the phase; they are marked complete at the 15-14 gate
coverage:
  - id: D1
    description: "The generic proposal item core: decision event v2 parsed closed, every transition row, the fold with damaged runs failing safe"
    requirement: QUES-11
    verification:
      - kind: unit
        ref: "apps/backend/tests/proposal-items.unit.test.ts (11 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The questionnaire proposal envelope v1 and its decision payloads, parsed closed and never throwing, with the allowed-sets gate"
    requirement: QUES-11
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-proposal-envelope.unit.test.ts (envelope and decision-event cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fingerprints, change and addition bases, and staleness for every item kind"
    requirement: QUES-12
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-proposal-envelope.unit.test.ts (fingerprint, base and staleness cases; 17 tests in the file)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The one answered rule, the answer-preservation predicate (direct and hidden-dependent harm) and the controller-value rule"
    requirement: QUES-12
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-answer-preservation.unit.test.ts (12 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Server placement and batch key allocation, equal to the 10-09 browser case table"
    requirement: QUES-11
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-placement.unit.test.ts (16 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The shared instruction validator, the Requestor-text guard and the near-duplicate scorer"
    requirement: QUES-11
    verification:
      - kind: unit
        ref: "apps/backend/tests/analyst-instruction.unit.test.ts (13 tests) and apps/backend/tests/text-similarity.unit.test.ts (5 tests)"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend test (1,498 tests: 1,497 pass, 0 fail, 1 skipped by platform)"
        status: pass
    human_judgment: false
duration: 37min
completed: 2026-10-11
status: complete
---

# Phase 15 Plan 02: The Pure Proposal Modules Summary

**Six pure Strapi modules, each proved at its interface without Strapi: a generic proposal item core (decision event v2 and a fold in which a damaged run fails safe), the closed questionnaire proposal envelope v1 with sha256 fingerprints, bases and staleness, the one answered rule with a predicate that catches direct and hidden-dependent harm, server placement equal to 10-09's browser rules, the 500-character instruction validator with its 60-character Requestor-text guard, and the 0.8 token-set near-duplicate scorer.**

## Performance

- **Duration:** about 37 min, of which the full Strapi suite took about 20
- **Started:** 2026-10-11T08:28:17Z
- **Completed:** 2026-10-11T09:05:14Z
- **Tasks:** 4 of 4 (Task 1 the tracer)
- **Files created:** 12 (6 modules, 6 unit test files; 2,237 lines); no existing file changed

## Accomplishments

- **The item core** (`proposal-items.ts`) folds decision events v2 over a proposal's item keys by the amendment's table. An unknown item, an illegal transition or a stored no-op makes the run damaged (null), and a damaged run has no open item. It imports nothing.
- **The questionnaire envelope** parses the approved v1 shape closed and frozen, never throws, and enforces every bound: 30 items, 15 additions, one item per target, 10 sources, 60 adjustments, the thirteen adjustment codes and the text bounds. It fingerprints questions as `sha256:` over canonical JSON with keys sorted recursively (`node:crypto`), and derives staleness exactly as the amendment states it.
- **Answer preservation**: one answered rule (the progress count's), `preservesAnswers` for direct harm, removal, invalidated answers, an unreachable rule and visible-to-hidden changes, and `keepsControllerValues` for controllers that drop a value a dependent's rule reads.
- **Placement**: end of section or a new section after the last, counting removed questions, keys within 120 characters, with batch memory. It never moves an existing question.
- **Instruction and scorer**: the closed refusals, the branded `SlotInstruction`, `PLAIN_LANGUAGE_PRESET`, the 60-character guard after NFKC, case and whitespace normalisation, and Jaccard over `tokenize` at 0.8. Both modules name Phases 16 and 17 as consumers.

## Module exports

- `apps/backend/src/csrm/ai/proposal-items.ts`: `PROPOSAL_ITEM_STATES`, `DECISION_ACTIONS`, `DECISION_EVENT_SCHEMA_VERSION`, `DECISION_EVENTS_MAX`, `PROPOSAL_ITEMS_MAX`, `DECISION_EDITS_MAX`, `DECISION_REASON_MAX_LENGTH`, `isProposalItemKey`, `parseDecisionEventV2`, `parseDecisionEventsV2`, `nextState`, `foldItemStates`, `openItemKeys`; types `ProposalItemState`, `DecisionAction`, `DecisionCause`, `DecisionEventV2<TBefore, TApplied>`, `DecisionPayloadParsers<TBefore, TApplied>`.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-envelope.ts`: `QUESTIONNAIRE_PROPOSAL_SCHEMA_VERSION`, `QUESTIONNAIRE_PROPOSAL_OPERATIONS`, `PROPOSAL_OUTCOMES`, `PROPOSAL_ITEM_KINDS`, `SOURCE_KINDS`, `ADJUSTMENT_CODES` (13), `QUESTIONNAIRE_EDIT_FIELDS`, `AI_UNPROPOSABLE_ANSWER_TYPES`, `PROPOSAL_BOUNDS`, `parseQuestionnaireProposal(value, allowed?)`, `questionnaireDecisionPayloads`, `parseQuestionnaireDecisionEvents`, `questionFingerprint`, `changeBase`, `addBase(live, { section, visibility? })`, `isItemStale`; types `QuestionnaireProposalV1`, `QuestionnaireProposalItem`, `ProposedQuestion`, `ProposedChoice`, `ProposedSection`, `ProposedVisibility`, `ProposalTarget`, `ProposalSource`, `ProposalAdjustment`, `ChangeBase`, `AddBase`, `AddBaseSection`, `QuestionFingerprintInput`, `QuestionSnapshot`, `AppliedQuestion`, `QuestionnaireDecisionEvent`, `ProposalAllowedSets`, `LiveQuestion`, `LiveQuestionnaire`, `QuestionnaireProposalOperation`, `ProposalItemKind`, `SourceKind`, `AdjustmentCode`.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-answer-preservation.ts`: `isAnsweredValue`, `preservesAnswers`, `keepsControllerValues`; types `PreservationRow`, `PreservationResult`.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-placement.ts`: `createBatchAllocation`, `placeAddition`, `newSectionKey(title, taken)`, `allocateQuestionKey`; types `BatchAllocation`, `Placement`, `PlacementSection`, `AdditionSection`.
- `apps/backend/src/csrm/ai/analyst-instruction.ts`: `INSTRUCTION_MAX_LENGTH` (500), `REQUESTOR_TEXT_QUOTE_THRESHOLD` (60), `PLAIN_LANGUAGE_PRESET`, `InstructionShapeError`, `parseAnalystInstruction`, `normaliseForQuoteCheck`, `repeatsRequestorText(instruction, corpus: readonly string[])`; types `SlotInstruction`, `InstructionRefusal`, `InstructionSource`, `InstructionParseResult`.
- `apps/backend/src/csrm/ai/text-similarity.ts`: `NEAR_DUPLICATE_THRESHOLD` (0.8), `NEAR_DUPLICATE_MIN_TOKENS` (3), `tokenSetSimilarity`, `isNearDuplicate`.

## Differences from 10-09's browser placement cases

The server reproduces every case in `apps/csrm/src/features/questionnaires/questionnaire-placement.test.ts` with identical orders, section metadata and keys. The cases are the hosted, deterministic and seeded shapes for existing and new sections; a section holding only removed questions; a missing section; skipping a removed or taken key; trimming; the `section` fallback; the 120-character bound with its `-2` successor; and an empty set opening at order 0. The test restates them in `questionnaire-placement.unit.test.ts`. The differences are additions the browser has no need for:

- **Batch memory.** The allocation records each placement, so a second addition to the same section takes the next order. A new section that a second addition names by the same trimmed title (case-insensitively) is reused at its next order. A later new section follows the first at the next section order. Allocated question keys are taken for the rest of the batch.
- **A blank new-section title offers no placement** (null). The browser would derive the key `section` with an empty title, which the definition parser refuses.
- **Section metadata** is taken from the first active question in definition order, where the browser uses the first active question in served order. The result is the same, because the definition parser requires identical metadata for every question in a section.
- `sectionChoices` (the browser's Section select) has no server counterpart.

## Task Commits

1. **Task 1 (tracer): the item core and the envelope**: `4ede5dff` (test, RED), `10ea3b18` (feat, GREEN). Tracer gate: auto mode off, verify automated-only, re-run green, so expansion continued.
2. **Task 2: fingerprints, bases and staleness**: `6a2cb466` (test, RED), `c615c892` (feat, GREEN)
3. **Task 3: the answered rule, preservation and placement**: `41faf128` (test, RED), `4a5bcacb` (feat, GREEN)
4. **Task 4: the instruction validator, the guard and the scorer**: `ae358b2b` (test, RED), `af9e6dee` (feat, GREEN)

Commit count: `git rev-list --count 878a27ef..af9e6dee` is 8. Each RED failed because the module, or for Task 2 the exports, did not exist yet (TS2307 or TS2305), which is the failure each task's action names.

## Verification

- Task 1 verify: `tsc`, `tsc -p tests` and the two files: 19/19 pass.
- Task 2 verify: `questionnaire-proposal-envelope.unit.test.js`, 17/17 pass.
- Task 3 verify: `questionnaire-answer-preservation.unit.test.js` and `questionnaire-placement.unit.test.js`, 28/28 pass.
- Task 4 focused: `analyst-instruction.unit.test.js` and `text-similarity.unit.test.js`, 18/18 pass.
- The six files together: 74/74 pass.
- Task 4 verify, the full Strapi suite (`pnpm --dir apps/backend test`, dev servers stopped, Keycloak flags false, the classification ceiling empty): 1,498 tests, 1,497 pass, 0 fail, 1 skipped (the existing POSIX-modes test, skipped on Windows), exit 0, 1,186 s.
- Acceptance criteria: `proposal-items.ts` has no import at all. `questionnaire-answer-preservation.ts` and `questionnaire-placement.ts` import nothing from `@strapi`. `ADJUSTMENT_CODES` holds exactly the amendment's thirteen codes (asserted). The envelope uses `createHash("sha256")`. Staleness has fresh and stale cases for add, change and remove. A test named "hidden dependent" exists (two, in fact). The constants 500 and 60 are asserted. `text-similarity.ts` imports `tokenize` from `./library-ranking`. The 59-character pass and 60-character refusal cases exist.
- Content-type freeze: `git diff --name-only 15eb830b -- 'apps/backend/src/api/*/content-types/*'` is empty. No specification, catalogue or web file changed, and Playwright was not run, as planned.

## Files Created/Modified

- `apps/backend/src/csrm/ai/proposal-items.ts`: the generic item core.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-envelope.ts`: the envelope v1, payloads, fingerprints, bases and staleness.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-answer-preservation.ts`: the answered rule and preservation.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-placement.ts`: placement and key allocation.
- `apps/backend/src/csrm/ai/analyst-instruction.ts`: the instruction validator and the Requestor-text guard.
- `apps/backend/src/csrm/ai/text-similarity.ts`: the near-duplicate scorer.
- Six unit test files under `apps/backend/tests/`, one per module.

## Decisions Made

The frontmatter's key decisions, with their reasons:

- **`editFields` on the payload parsers.** The plan named only `before` and `applied`. The allowed edit names are target-specific (Phase 16's risk fields differ), so the target supplies them and the core stays free of question fields.
- **Keys tied to actions, and causes required.** The amendment gives each optional key to particular actions. Refusing them elsewhere keeps a stored event unambiguous for the Undo and the timeline, at no cost to any writer the amendment describes.
- **Source refs are bounded, not patterned.** Phase 12's context names answer sources `answer.{questionKey}`, while the amendment names `Q{n}`. Plan 15-04 builds the Phase 15 context, so pinning a format here could make a valid stored run read as damaged. The `allowed` gate checks exact membership at write time.
- **No canonical Not sure check.** It would contradict D-11 for a target that lacks one. 15-05's adapter canonicalises additions with the shipped `withCanonicalNotSure`.
- **The answered rule copies `hasValue` exactly.** An envelope with no `value` member counts as answered. That is the protective direction: an answer-shaped record is never treated as free to change, and 15-08 makes the progress count call this same function.
- **Validity refuses only harm the change caused.** Because every fingerprinted field must stay equal, an answer that was already invalid stays invalid either way. Refusing it would block every proposal on that questionnaire for no protection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Invisible characters written literally, breaking a regular expression**
- **Found during:** Task 4 (GREEN)
- **Issue:** The tool layer turned the `U+2028` and `U+2029` escapes in `analyst-instruction.ts` into the literal characters. Those characters end a line in a regular expression literal, so `tsc` failed with TS1161. The RED test file had the same conversion inside string literals; it still compiled, but the characters were invisible in review.
- **Fix:** A one-off scratchpad script rewrote each of those characters as its escape, building the backslash from its character code. The test strings are unchanged at runtime.
- **Files modified:** `apps/backend/src/csrm/ai/analyst-instruction.ts`, `apps/backend/tests/analyst-instruction.unit.test.ts`
- **Verification:** `tsc` clean. Both Task 4 files pass, 18/18.
- **Committed in:** `af9e6dee` (the Task 4 GREEN commit; its message records the test file's escape change)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** None on behaviour or scope.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None. No external service configuration required.

## Next Phase Readiness

- 15-04 to 15-08 can import every module listed above. No workflow calls them yet, as planned.
- **15-05 (the adapter):** it calls `parseQuestionnaireProposal(envelope, allowed)` before storing, `addBase` and `changeBase` for bases, `isNearDuplicate`, and `preservesAnswers` and `keepsControllerValues`. It must canonicalise Not sure on additions.
- **15-07 (decisions):** it calls `parseQuestionnaireDecisionEvents`, `foldItemStates` (a null result means a damaged run that nothing may confirm), `nextState`, `isItemStale`, `createBatchAllocation`, `placeAddition` and `allocateQuestionKey` inside the decision transaction.
- **15-06:** it builds the Requestor-text corpus from submitted answers only and passes it to `repeatsRequestorText`.
- **15-08:** it makes `questionnaire-scope.ts` call `isAnsweredValue`.
- **15-04:** it should name answered-question source refs consistently with the `allowed` set it builds; the envelope accepts any bounded token.

## Self-Check: PASSED

- FOUND: all 12 created files (`[ -f ]` on each module and test path).
- FOUND: 4ede5dff, 10ea3b18, 6a2cb466, c615c892, 41faf128, 4a5bcacb, ae358b2b, af9e6dee (`git rev-list --count 878a27ef..HEAD` is 8 before this summary).
- Acceptance criteria re-run: all pass. Plan verification: six unit files 74/74, full Strapi suite green, `tsc` clean, content-type freeze empty.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-11*
