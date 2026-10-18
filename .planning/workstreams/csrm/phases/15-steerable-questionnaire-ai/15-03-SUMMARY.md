---
phase: 15-steerable-questionnaire-ai
plan: 03
subsystem: api
tags: [strapi, governance-log, revision-timeline, requestor-projection, closed-reasons, contract, zod, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-01's approved 06.8 and run-record amendments; 15-02's INSTRUCTION_MAX_LENGTH, isProposalItemKey and PROPOSAL_ITEMS_MAX
  - phase: 10-questionnaire-governance
    provides: the closed governance log, questionText snapshots, regenerated, countAnalystChangesSinceGeneration, the timeline and the Requestor's per-round summary
  - phase: 10-existing-flow-gap-closure
    provides: 10-06's one closed reason list in Strapi, both conflict schemas and the web
provides:
  - The governance log's ai-proposal and question-restored kinds and ten AI keys, each closed to its kinds, at schemaVersion 1
  - projectGovernanceEventsForRequestor, called by the scope module's Requestor projection
  - countAnalystChangesSinceGeneration counting question-restored
  - Both published event schemas, the generated client and both closed web parsers widened
  - The analyst timeline's AI request, Source and restored-question entries, with the optional proposalAnchors prop
  - AiInstructionText, the X-25 instruction display (plain text, line breaks kept, three lines with Show full instruction)
  - Twelve closed reasons in Strapi, both conflict schemas and the web
affects: [15-05, 15-06, 15-07, 15-08, 15-09, 15-10, 15-11, 15-12, 15-13]
actuals:
  tokens: 28700
  tasks: 3
  commits: 6
plan_head_before: aabeccb1fc1c8f07d694205175648285ed58c675
plan_head_after: 3938588d9838666c6f8ed6505ea799fcd4485126
tech-stack:
  added: []
  patterns:
    - "Per-kind key map in a closed parser: one flat key list for exactKeys, then a kind-to-allowed-keys map with the amendment's together and exactly-one rules"
    - "A pure Requestor projection applied before the scope module's narrowing, so a new analyst-only fact cannot leak by default"
    - "A patterned contract string carries an OpenAPI example the parity harness synthesises from"
key-files:
  created:
    - apps/csrm/src/features/questionnaires/ai-instruction-text.tsx
  modified:
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/backend/src/csrm/conflict-reasons.ts
    - apps/backend/tests/questionnaire-governance.unit.test.ts
    - apps/backend/tests/conflict-reasons.unit.test.ts
    - apps/backend/tests/contract-catalogue.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/lib/api/conflict-reasons.ts
    - apps/csrm/src/lib/api/conflict-reasons.test.ts
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx
key-decisions:
  - "instructionSource is closed to the amendment's two values (plain-language-preset, default-task) in the parser and both spec schemas; the plan's spec line also listed analyst, which the amendment does not, so it is left out (the run record's source vocabulary is 15-04's)."
  - "question-restored may carry aiEdited, as the amendment says an Undo repeats the confirmation's aiEdited; the plan's per-kind list omitted it."
  - "An ai-proposal of scope questionnaire names no question (questionKey and questionText refused); scope question requires both. regenerated carries instruction or default-task, never both and never the preset."
  - "A question change's run, item and edit flag go together; aiUndo only with them and only as true; question-restored requires its key and carries run and item together when present."
  - "Requestor pairing: each confirmation pairs with the first later unconsumed Undo of the same run and item, and a released event stops the search, so a pair a release splits stays and a re-confirmation pairs with its own Undo."
  - "The timeline shows a regenerated event's instruction only; its default-task source shows no line (Phase 10's entry already describes the generation)."
  - "proposalAnchors: runs holds run ids; items holds card ids from proposalItemAnchor(runId, itemKey) = ai-proposal-{runId}-{itemKey}. Show proposal appears on a confirmation, never on an Undo or a restored question."
  - "The twelve reasons follow ATTACHMENT_BUSY under a Phase 15 comment, the nine 409s first, then the three 400 instruction reasons; both reason descriptions name the 400s."
requirements-completed: []  # QUES-11 and QUES-12 are traced by this plan but delivered by the phase; they are marked complete at the 15-14 gate
coverage:
  - id: D1
    description: "The closed governance log accepts the ai-proposal and question-restored kinds and the ten AI keys only on their kinds, at schemaVersion 1, append-only"
    requirement: QUES-11
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-governance.unit.test.ts (27 tests; the ai-proposal and confirmation-key cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The analyst projection carries every AI key and the analyst's name; the Requestor projection drops ai-proposal, same-round confirmation and Undo pairs and every AI key, and projects an unpaired question-restored with kind and at"
    requirement: QUES-11
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-governance.unit.test.ts#the Requestor projection drops AI requests, every AI key and a confirmation undone in the same round"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/questionnaire-governance.unit.test.ts#an unpaired question-restored reaches the Requestor as a question change with kind and at only"
        status: pass
    human_judgment: false
  - id: D3
    description: "The analyst change count counts question-restored (D-09)"
    requirement: QUES-12
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-governance.unit.test.ts#countAnalystChangesSinceGeneration counts a question-restored beside added, edited and deleted (D-09)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The specification, generated client and both closed web parsers accept every new kind and key and refuse an unknown key"
    requirement: QUES-11
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-service.test.ts#accepts an AI proposal event with its keys on the timeline and in a governance result, and refuses an unknown key"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts (183 tests)"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/csrm api:check"
        status: pass
    human_judgment: false
  - id: D5
    description: "The analyst timeline shows each AI request with its instruction or what the AI did, analyst, time, provider and model, result, and each confirmed or undone change with its Source line"
    requirement: QUES-11
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx (22 tests; the AI proposals describe block)"
        status: pass
    human_judgment: true
    rationale: "Copy and structure are asserted, but the entries' visual fit at mobile and desktop widths and the clamp toggle's feel need the phase's UI review (15-11 wires proposalAnchors and the page)."
  - id: D6
    description: "Twelve closed reasons in Strapi, both conflict response enums and the web list"
    requirement: QUES-12
    verification:
      - kind: unit
        ref: "apps/backend/tests/conflict-reasons.unit.test.ts#the Phase 15 AI proposal, gate and instruction reasons join the one closed list (D-03 item 9, Q-1)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/lib/api/conflict-reasons.test.ts (139 tests)"
        status: pass
      - kind: integration
        ref: "pnpm --dir apps/backend test (1,507 tests: 1,506 pass, 0 fail, 1 skipped by platform)"
        status: pass
    human_judgment: false
duration: 62min
completed: 2026-10-11
status: complete
---

# Phase 15 Plan 03: The Governance Log Amendment and the Phase 15 Reasons Summary

**The closed governance log now records AI proposal requests and restored questions with ten AI keys, each allowed only on the kinds the approved 06.8 amendment names. The analyst timeline shows each request with its instruction, provider, model and result, and each confirmed or undone change with its source. A pure Requestor projection keeps every AI kind, every AI key and every change undone within one round out of the Requestor's history. The analyst change count includes restored questions. Twelve closed reasons now exist in Strapi, the contract and the web, all added in one change.**

## Performance

- **Duration:** about 62 min. The two full Strapi suite runs took about 20 min each.
- **Started:** 2026-10-11T09:10:44Z
- **Completed:** 2026-10-11T10:13:11Z
- **Tasks:** 3 of 3 (Task 1 is the tracer)
- **Files:** 16 changed (1 created), 988 insertions and 37 deletions

## Accomplishments

- **The log** (`questionnaire-governance-log.ts`):
  - It gains the `ai-proposal` and `question-restored` kinds and the type `GovernanceEventAiKeys`. The private `GOVERNANCE_EVENT_KEYS` list gains the ten keys.
  - A private `AI_KEYS_BY_KIND` map refuses an AI key on any kind that may not carry it. The parser also enforces the amendment's "together" and "exactly one of" rules and every bound. The instruction bound is `INSTRUCTION_MAX_LENGTH`. The item key and the item count come from `proposal-items.ts`.
  - `schemaVersion` stays 1. The log stays append-only, and a full log still refuses.
  - The new `projectGovernanceEventsForRequestor` is pure.
  - `countAnalystChangesSinceGeneration` now counts `question-restored`.
- **The scope module:**
  - The analyst branch adds one explicit spread per AI key, after `explanation`.
  - The Requestor branch calls `projectGovernanceEventsForRequestor` before it narrows each event to `kind`, `at` and `explanation`.
- **The contract:**
  - `QuestionnaireGovernanceEvent` and `QuestionnaireRevisionTimelineEvent` declare both kinds and the ten keys with the amendment's bounds. `itemKey` carries a pattern and the example `i-1`. Both schemas keep `additionalProperties: false`, and their descriptions say the Requestor projection never carries the AI kinds or keys.
  - Both parsers in `questionnaire-service.ts` share one kind enum and one AI key set.
- **The timeline:**
  - An AI request is labelled `Proposals requested from the AI` (the questionnaire scope) or `Plain-language rewrite requested from the AI` (the question scope), with `Sparkles`. It shows the instruction, `Instruction: none - the AI suggested the questions it judged still needed`, or `Instruction: Rewrite in plain language (standard wording)`. It also shows `Provider: {name} · Model: {version}`, and `Result: {n} proposal(s)` or `Result: nothing proposed`. `Show in AI proposals` appears only for a run the panel lists.
  - A confirmed change shows `Source: AI proposal, confirmed` or `Source: AI proposal, edited before confirming`, and `Show proposal` when the panel lists its proposal. An Undo shows `Source: undo of a confirmed AI proposal`.
  - A restored question shows `Question restored`, with `ArchiveRestore`, its question line and the Undo source.
  - The Requestor summary counts a restored question among the round's changes and never shows an AI request.
  - `AiInstructionText` (a client component) renders an instruction under the X-25 rule. Plans 15-11 to 15-13 can reuse it.
- **The reasons:** the twelve reasons are now in Strapi's `CONFLICT_REASONS`, the web list and both `reason` enums. The three instruction reasons are 400s; the other nine are 409s. Both reason descriptions name the three 400s. Phase 12's `AI_PROPOSAL_ALREADY_DECIDED` remains the only code for a proposal that is no longer open.

## Task Commits

1. **Task 1 (tracer): an `ai-proposal` event end to end**: `d0e28cb8` (test, RED) and `c2d3bf5b` (feat, GREEN). Tracer gate: auto mode is off and the verify is automated only, so it was re-run (green) and expansion continued.
2. **Task 2: confirmation sources, restored questions, the Requestor projection and the count**: `e806c2c7` (test, RED) and `bedb4dad` (feat, GREEN).
3. **Task 3: the closed reasons**: `206769e3` (test, RED) and `3938588d` (feat, GREEN).

`git rev-list --count aabeccb1..3938588d` is 6.

How each RED step failed:

- **Task 1:** the kind-list assertion failed. Appending an `ai-proposal` threw `GovernanceLogError` (unknown kind), and the analyst projection lacked the keys. All six web cases failed on their assertions. The refusal case passed, as a guard should before the kinds exist.
- **Task 2:** the three projection cases and the count case failed. The Requestor projection was read through the module namespace, so the missing export failed as an assertion rather than as TS2305. The four web cases failed. The confirmation-key parse case passed in RED, because Task 1 had already implemented the whole per-kind parser, as the plan's "Keys and their kinds" asks of Task 1.
- **Task 3:** `AI_PROPOSALS_OPEN_MISSING` (Strapi) and the 12 web cases failed.

## Verification

- **Task 1 verify** (`tsc`, the governance unit file, `api:check`, the timeline and service tests, the web typecheck): exit 0. Governance tests 22/22 pass, web tests 31/31 pass.
- **Task 2 focused:** the governance unit file 27/27 and the timeline file 22/22.
- **Task 2 verify:** the full Strapi suite (`pnpm --dir apps/backend test`, with the dev servers stopped, both Keycloak flags false and the classification ceiling empty) ran 1,506 tests: 1,505 pass, 0 fail, 1 skipped (the POSIX-modes test is skipped on Windows). Exit 0, 1,190 s.
- **Task 3 verify** (`tsc`, `conflict-reasons.unit.test.js` 5/5, `api:check`, `conflict-reasons.test.ts` 139/139, typecheck, lint): exit 0.
- **After the last code commit:**
  - The full Strapi suite ran 1,507 tests: 1,506 pass, 0 fail, 1 skipped. Exit 0, 1,199 s.
  - The full web unit suite (`pnpm --dir apps/csrm test`): 214 files, 5,078 tests, all pass, 57 s.
  - The contract catalogue, governance and reason files together: 57/57 pass.
  - `api:check` exits 0. `git update-index --refresh` leaves `schema.d.ts` clean.
- **Acceptance criteria:**
  - `GOVERNANCE_EVENT_KINDS` holds both new kinds, and `GOVERNANCE_LOG_SCHEMA_VERSION = 1`.
  - Refusal cases exist for `aiEdited` on `ai-proposal` and `runId` on `released`.
  - The analyst branch names `runId` and `itemCount`.
  - Read with `node -e`, both spec schemas list `ai-proposal` (`true`) and keep `additionalProperties: false`.
  - The timeline contains both labels.
  - `questionnaire-scope.ts` contains `projectGovernanceEventsForRequestor(`.
  - There are tests named with `same round` and with `question-restored`.
  - Both `conflict-reasons.ts` files and both enums hold the twelve.
- **Out of scope here:** no route budget was measured (Playwright is not part of this plan). No content type changed (`git diff --name-only 15eb830b -- 'apps/backend/src/api/*/content-types/*'` is empty), and nothing touched Keycloak.

## Files Created/Modified

- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts`: the kinds, keys, per-kind check, Requestor projection and count.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts`: the analyst spreads and the Requestor call.
- `apps/backend/src/csrm/conflict-reasons.ts` and `apps/csrm/src/lib/api/conflict-reasons.ts`: the twelve reasons.
- `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`: both event schemas and both reason enums and descriptions.
- `apps/csrm/src/features/questionnaires/questionnaire-service.ts`: the shared kind enum and the AI keys, parsed closed.
- `apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx`: the AI request, Source and restored entries, `proposalAnchors`, `aiRunAnchor` and `proposalItemAnchor`.
- `apps/csrm/src/features/questionnaires/ai-instruction-text.tsx` (new): the X-25 instruction display.
- Tests: `questionnaire-governance.unit.test.ts`, `conflict-reasons.unit.test.ts`, `contract-catalogue.integration.test.ts`, `questionnaire-service.test.ts`, `questionnaire-revision-timeline.test.tsx`, `conflict-reasons.test.ts` and `contract-response-parity.test.ts`.

## Decisions Made

The frontmatter's key decisions, with their reasons:

- **Amendment over plan wording, twice.** The approved amendment is the source of truth, so where the plan differs from it, this plan follows the amendment:
  - `instructionSource` takes only the two values the amendment lists.
  - `question-restored` may carry `aiEdited`, because an Undo repeats the confirmation's flag.
- **Strict scope rules.** An `ai-proposal` is closed to its scope: a questionnaire-scope request names no question. This keeps every stored event unambiguous for the timeline and for later readers. The writers (15-06 to 15-08) write exactly these shapes.
- **Pairing stops at a release.** The Requestor saw any change on either side of a release, so a pair split by a release must stay. A re-confirmation pairs with its own Undo.
- **A shared instruction component.** X-25's display rule appears on the timeline, the panel's run groups and the run facts, so `AiInstructionText` lives beside the timeline for 15-11 to 15-13 to import. Its overflow hook copies the 15-line hook in `note-item.tsx`. The plan's scope did not include extracting a shared hook.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The contract parity harness could not satisfy a patterned response string**
- **Found during:** Task 1 (GREEN)
- **Issue:** `contract-response-parity.test.ts` synthesises one fixed value (`ASM-2026-33SAEN`) for every patterned string. The `itemKey` pattern (`i-1` to `i-30`) refuses that value, so 7 questionnaire parsers failed parity.
- **Fix:** `itemKey` carries `"examples": ["i-1"]` in both spec schemas. The harness now uses a patterned string's first contract example when one exists, and the fixed value otherwise.
- **Files modified:** `docs/references/specification.json`, `apps/csrm/src/features/contract-response-parity.test.ts`
- **Verification:** the parity tests pass, 183/183.
- **Committed in:** `c2d3bf5b`

**2. [Rule 3 - Blocking] The catalogue integration test pinned the governance kind list**
- **Found during:** Task 1 (GREEN)
- **Issue:** `contract-catalogue.integration.test.ts` asserted the spec's seven kinds.
- **Fix:** the asserted list now has nine kinds, with a comment naming the Phase 15 amendment.
- **Files modified:** `apps/backend/tests/contract-catalogue.integration.test.ts`
- **Verification:** the file passes, and so does the full Strapi suite.
- **Committed in:** `c2d3bf5b`

**3. [Rule 2 - Missing critical] Summary defence against an AI request**
- **Found during:** Task 2
- **Issue:** the Requestor summary rendered every kind it did not group. An `ai-proposal` reaching it would have shown `Proposals requested from the AI`.
- **Fix:** `summarise` skips `ai-proposal`. Strapi's projection is still the boundary (T-15-07); this is defence in depth.
- **Files modified:** `questionnaire-revision-timeline.tsx`
- **Committed in:** `bedb4dad`

**4. [Rule 3 - Blocking] A new client component file**
- **Found during:** Task 1
- **Issue:** the X-25 clamp toggle needs client state, and the timeline is a shared Server Component.
- **Fix:** added `ai-instruction-text.tsx` (`'use client'`), which is not in the plan's file list.
- **Committed in:** `c2d3bf5b`

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 missing critical)
**Impact on plan:** none on scope. Each fix keeps the contract, the parity guard or the Requestor boundary honest.

## Issues Encountered

- During Task 3 GREEN, the one-off reasons script stopped on the spec's spaced enum format after it had already edited both list files. I corrected the script and re-ran it for the spec only. The diff was checked before the commit.

## Known Stubs

None. `proposalAnchors` is optional and has no caller yet: 15-11 passes it from the proposals read, as planned. Without it, no AI link renders.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **15-06 to 15-08 (the writers):**
  - Append `ai-proposal` with `runId`, `scope`, exactly one of `instruction` or `instructionSource`, `providerName`, `providerVersion` and `itemCount`. A question-scope request also needs `questionKey` and `questionText`; a questionnaire-scope request takes neither.
  - Confirmations write `runId`, `itemKey` and `aiEdited` together.
  - An Undo repeats those three and adds `aiUndo: true`. An undone removal writes `question-restored` with `questionKey`.
  - `regenerated` takes `instruction`, or `instructionSource: "default-task"`.
  - Any other shape throws `GovernanceLogError`, which the writer maps to `HISTORY_UNAVAILABLE`.
- **15-08:** `QUESTIONNAIRE_ANSWERED`, `QUESTIONNAIRE_HAS_ANALYST_CHANGES` and `AI_PROPOSALS_OPEN` are closed reasons now, and the count includes restored questions. 15-08 and 15-09 still declare the instruction reasons on their 400 responses.
- **15-11:** pass `proposalAnchors={{ runs: <run ids>, items: <proposalItemAnchor(runId, itemKey)> }}` to `QuestionnaireRevisionTimeline`, and reuse `AiInstructionText` for run instructions.
- **D-22 `aiOrigin` fold (15-RESEARCH §O):** `deriveQuestionAiOrigins` still reads every `question-added` as analyst-added. The plan that adds `proposal-confirmed` and `proposal-edited` changes it.

## Self-Check: PASSED

- FOUND: `apps/csrm/src/features/questionnaires/ai-instruction-text.tsx`, and every modified file listed.
- FOUND: d0e28cb8, c2d3bf5b, e806c2c7, bedb4dad, 206769e3 and 3938588d. `git rev-list --count aabeccb1..HEAD` is 6 before this summary.
- Acceptance criteria re-run: all pass. Plan verification: the governance, reason, timeline and service tests, `api:check`, typecheck, lint, both full suites.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-11*
