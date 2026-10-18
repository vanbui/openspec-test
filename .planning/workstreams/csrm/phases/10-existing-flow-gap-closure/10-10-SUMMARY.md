---
phase: 10-existing-flow-gap-closure
plan: 10
subsystem: api
tags: [questionnaire-governance, governance-log, revision-timeline, question-text-snapshot, contract-amendment, parity-guard, d-01, d-02, d-17, d-18, d-39, ux-06, uat-024]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-01 LocalInstant on the timeline; 10-06 log-first governance writes (appendOrConflict before any write, HISTORY_UNAVAILABLE); 10-09 the cleared-answer notice by question text and the analyst page's single questions read"
provides:
  - "questionnaire-governance-log.ts: the optional questionText event key (1-500 characters, closed parser), MAX_QUESTION_TEXT_LENGTH = 500 and questionTextSnapshot(text)"
  - "appendQuestionEvent(questionnaire, kind, questionKey, questionText, input, explanation?): every question event (added, edited, removed, answer cleared) stores a bounded snapshot, appended before any write"
  - "projectGovernanceEvents: the analyst branch projects questionText from the snapshot, else by the D-17 key resolution (removed questions included, only from the latest generation on); the Requestor branch is unchanged"
  - "Spec: questionText (minLength 1, maxLength 500) on QuestionnaireGovernanceEvent and QuestionnaireRevisionTimelineEvent; schema.d.ts regenerated; both closed web event schemas mirror it"
  - "The analyst timeline reads Question: {text}, or Question: A question from an earlier version in the secondary text colour; no entry shows a key"
  - "The dated 'Phase 10 amendment (2026-09-27): question text snapshots' section in docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md"
affects: [10-11 the regenerated event and replacement safeguards (it extends the same envelope and amendment record), 10-23 pilot walkthrough, any later plan that writes or projects governance events]

actuals:
  tokens: 10845
  tasks: 2
  commits: 4
plan_head_before: 0df5f35748e55ecb20cb399e0406e5ea0af04c85
plan_head_after: d354282579534ff58ad0094055f78c4dfa3ab6a9

tech-stack:
  added: []
  patterns:
    - "Envelope extension with read-time resolution: new events carry a bounded snapshot; old events are resolved at read time under a dated rule, so no stored log is migrated"
    - "A resolved value obeys the same bound as a stored one: the projection passes resolved text through questionTextSnapshot so the closed client schema (max 500) never sees a longer string"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts
    - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/backend/tests/questionnaire-governance.unit.test.ts
    - apps/backend/tests/questionnaire-governance.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.ts
    - apps/csrm/src/features/questionnaires/questionnaire-service.test.ts
    - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx
    - apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx
    - docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md
    - apps/csrm/e2e/questionnaire-governance-workflow.spec.ts

key-decisions:
  - "10-10: question events keep the question's words: added and edited the text after the change, removed the text when removed, answer-cleared the revised question's text. The snapshot is trimmed; longer than 500 characters it keeps the first 499 (never half a surrogate pair, trailing spaces trimmed) and a closing ellipsis"
  - "10-10: the analyst projection always prefers a stored snapshot; without one it resolves the key against every populated question, removed ones included, only when the event's at is not before generatedDate (none: always). An unknown key, an older event, or a generatedDate that is present but unreadable names no question (the web then shows A question from an earlier version): naming the wrong question is worse than naming none"
  - "10-10: a resolved text goes through questionTextSnapshot, because a question's text can be 65,535 characters and the closed web event schema bounds it at 500 (one over-long text would fail the whole questionnaire read, research Pitfall 1)"
  - "10-10: the analyst projection keeps questionKey (the contract has it) but the web never renders it; the timeline shows a question line whenever an event carries text or a key"
  - "10-10: the amendment heading keeps the plan's decision date (2026-09-27) and states it was recorded on 2026-10-02 with plan 10-10; it is an envelope amendment for orchestrator approval under G-6, not a content-type change"

patterns-established:
  - "Envelope fields that name a domain object carry a bounded snapshot plus the key; reads resolve old events only inside a stated validity window and otherwise say so in words"

requirements-completed: [UX-06]

coverage:
  - id: D1
    description: "Every new question event (added, edited, removed, answer cleared) stores the question's text, at most 500 characters with a closing ellipsis when cut (D-18)"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-governance.unit.test.ts#questionTextSnapshot keeps short text and cuts long text to the event bound with an ellipsis"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/questionnaire-governance.unit.test.ts#a question event carries its question text up to 500 characters and older events stay readable"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/questionnaire-governance.integration.test.ts#mounted question edit stores the question's text on its event and only the analyst timeline shows it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The analyst timeline names each question by its snapshot, or by its key's text from the latest generation on, else as A question from an earlier version; no entry shows a key (D-17, UI-SPEC §4.2)"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-governance.unit.test.ts#projectGovernanceEvents resolves an older event's question text only from the latest generation on"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx#names a question by its text and never by its key (UI-SPEC §4.2)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.test.tsx#reads a question it cannot name as a question from an earlier version (UI-SPEC §4.2)"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/questionnaire-governance-workflow.spec.ts#criteria 1-8 (CRITERION_5_CLEARED_ANSWER_NAMES_QUESTION, UX06_TIMELINE_NEVER_SHOWS_A_QUESTION_KEY)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Requestor's timeline projection carries no question text and no key (D-17, T-10-24)"
    requirement: UX-06
    verification:
      - kind: unit
        ref: "apps/backend/tests/questionnaire-governance.unit.test.ts#projectGovernanceEvents gives the analyst a question event's stored text and the Requestor neither text nor key"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/questionnaire-governance.integration.test.ts#mounted question edit stores the question's text on its event and only the analyst timeline shows it"
        status: pass
    human_judgment: false
  - id: D4
    description: "Contract: questionText bounded 1-500 on both event schemas, regenerated client types, closed web parsers accepting 500 and refusing 501, clean api:check and parity guard"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/questionnaires/questionnaire-service.test.ts#accepts a question text snapshot up to the 500-character event bound and no further"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts"
        status: pass
      - kind: other
        ref: "pnpm --dir apps/csrm api:check"
        status: pass
    human_judgment: false
  - id: D5
    description: "The dated governance-log envelope amendment in the 06.8 contract-gap record, with no content-type change (D-01)"
    verification:
      - kind: other
        ref: "git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*' (empty)"
        status: pass
    human_judgment: true
    rationale: "The amendment is a contract-gap record that the orchestrator approves after review (G-6); its wording is a governance judgement no test asserts"

duration: 25min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 10: Question text in the revision timeline Summary

**Question events now store a bounded snapshot of the question's own words in the governance log, and the analyst timeline names every question in words: by its snapshot, by its key's current text when the event is not older than the latest generation, or as "A question from an earlier version"; the Requestor's history is unchanged and no timeline shows a key.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-02T06:07:16Z
- **Completed:** 2026-10-02T06:32:00Z
- **Tasks:** 2 (Task 1 a tracer)
- **Files modified:** 13

## Accomplishments

- The governance log's closed event schema accepts an optional `questionText` (1-500 characters); `questionTextSnapshot` trims and cuts longer text to 499 characters and `…`.
- `appendQuestionEvent` takes the question's text, so added, edited, removed and answer-cleared events each keep their question's words. The event is still appended in memory before any write (10-06), so a full or unreadable log refuses the change with `HISTORY_UNAVAILABLE` and leaves nothing behind.
- The analyst projection carries `questionText` from the snapshot, else resolves an older event's key against every populated question (removed ones included) only when the event is not before `generatedDate`. The Requestor projection still carries only `kind`, `at` and `explanation`.
- The spec, the regenerated `schema.d.ts` and both closed web event schemas declare the same 1-500 bound, so the parity guard and `api:check` stay clean.
- The analyst timeline reads `Question: {text}` (overflow-safe) or `Question: A question from an earlier version` with the value in `text-foreground-secondary`. It never renders `questionKey`.
- The 06.8 contract-gap record has the dated amendment `Phase 10 amendment (2026-09-27): question text snapshots`.
- Journey change E8: the governance journey finds `Where will the service be hosted?` in the timeline where it found `/hosting-model/`, and asserts that the timeline shows no key.

## Task Commits

1. **Task 1 (tracer): an edited question's text travels from the stored event to the analyst timeline**
   - RED `e2f972d` (test): expect question events to carry and show the question's text
   - GREEN `bdd76fd` (feat): record and show the question text on every question event (spec and `schema.d.ts` committed together)
2. **Task 2: name older events by resolution or as an earlier version, record the amendment, then the journey**
   - RED `05cb97c` (test): expect older question events to resolve their text or read as an earlier version
   - GREEN `d354282` (feat): name older question events by their text or as an earlier version

No REFACTOR commits were needed.

**Plan metadata:** recorded in the docs commit that adds this SUMMARY with STATE.md and ROADMAP.md.

## Tests run

| Run | Scope | Result |
| --- | --- | --- |
| Task 1 RED, web | `questionnaire-revision-timeline.test.tsx`, `questionnaire-service.test.ts` | 2 failed (the two new cases, on their assertions), 14 passed |
| Task 1 RED, Strapi | governance unit and integration files (test build force-emitted, see Deviations) | 4 failed (the four new cases: `SNAPSHOT_NOT_STORED_WITH_THE_EDIT`, `GovernanceLogError` on the unknown key, `ANALYST_TIMELINE_LOST_THE_SNAPSHOT`, missing `questionTextSnapshot`), 23 passed; TAP evidence `RED_EVIDENCE_OK` |
| Task 1 GREEN | Strapi governance unit and integration files | 27/27 |
| Task 1 GREEN | web timeline, service and `contract-response-parity.test.ts` | 154/154 |
| Task 1 GREEN | `api:check` (then `git update-index --refresh`), web typecheck | clean, exit 0 |
| Task 2 RED, web | timeline test | 1 failed (the earlier-version case), 9 passed |
| Task 2 RED, Strapi | governance unit file (TAP) | 1 failed (`CURRENT_QUESTION_NOT_RESOLVED_BY_KEY`), 16 passed; `RED_EVIDENCE_OK` |
| Task 2 GREEN | Strapi governance unit file | 17/17 |
| Task 2 GREEN | web `src/features/questionnaires` (11 files) | 256/256 |
| Full Strapi suite | `pnpm --dir apps/backend test` (background, no dev servers) | 587 passed, 0 failed, 0 cancelled, 0 skipped; 709 s test time, 714 s wall |
| Playwright | `e2e/questionnaire-governance-workflow.spec.ts` (desktop project) | 1 passed, 0 failed, 0 flaky, 0 skipped; test 11.6 s, run 1.0 min; tree unchanged afterwards |
| Full web suite | `pnpm --dir apps/csrm test` | 2,517/2,517 in 125 files, 29.0 s |
| Web gates | `typecheck`, `lint`, `api:check` | exit 0, exit 0, clean |
| Static guard | `git diff --name-only 5ea2b77..HEAD -- 'apps/backend/src/api/*/content-types/*'` | empty |

The Playwright web server logged two `The destination stream closed early` lines from Next while the journey navigated. The journey passed, and the lines come from a client leaving a streaming response early; they are not caused by this plan.

## Files Created/Modified

- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts`: adds the `questionText` key, `MAX_QUESTION_TEXT_LENGTH` and `questionTextSnapshot`.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts`: `appendQuestionEvent` takes the question's text; the delete, add and edit paths (and answer-cleared) pass it.
- `apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts`: `questionTextResolver` (D-17) and the analyst branch's `questionText`.
- `apps/backend/tests/questionnaire-governance.unit.test.ts`: snapshot, parser, projection and resolution cases.
- `apps/backend/tests/questionnaire-governance.integration.test.ts`: the mounted edit and stored-snapshot proof with the Requestor read.
- `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`: the bounded `questionText` on both event schemas.
- `apps/csrm/src/features/questionnaires/questionnaire-service.ts`: both closed event schemas accept `questionText` (`min(1).max(500)`).
- `apps/csrm/src/features/questionnaires/questionnaire-service.test.ts`: the 500 and 501 bound case on both event shapes.
- `apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx` and its test: the question line by text, the earlier-version fallback, and no key.
- `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`: the dated Phase 10 amendment.
- `apps/csrm/e2e/questionnaire-governance-workflow.spec.ts`: E8.

## Decisions Made

See `key-decisions` in the frontmatter. In short:
- which text each event kind keeps;
- the snapshot always wins;
- the resolution window, and failing to name no question when the generation date is unreadable;
- resolved text is bounded like a snapshot;
- the key stays in the contract but is never rendered;
- the amendment heading keeps the plan's decision date and states the recording date.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The web schema-bound case lives in `questionnaire-service.test.ts`, not the timeline test**
- **Found during:** Task 1 RED
- **Issue:** the plan put "the closed schema accepts `questionText` up to 500 characters" in `questionnaire-revision-timeline.test.tsx`. The service module is `server-only`, so the jsdom component test cannot import its parsers (the suite failed to load).
- **Fix:** the case was added to `questionnaire-service.test.ts`, which already mocks `server-only`. It covers the timeline parser (`getQuestionnaire`) and the governance parser (`addQuestionnaireQuestion`).
- **Files modified:** `apps/csrm/src/features/questionnaires/questionnaire-service.test.ts` (not in the plan's file list)
- **Commit:** `e2f972d`

**2. [Rule 3 - Blocking] The Strapi RED was observed with `--noEmitOnError false`**
- **Found during:** Task 1 RED
- **Issue:** `apps/backend/tsconfig.json` sets `noEmitOnError: true`. A test that imports the not-yet-written exports blocks the emit, so the first run executed stale compiled tests (23/23 green) and proved nothing.
- **Fix:** the test build for the RED observation was force-emitted, so the new cases ran and failed on their assertions. TAP evidence was checked with `gsd-tools check tdd-red-evidence` (`RED_EVIDENCE_OK` for both REDs). No file changed.
- **Commit:** none (evidence only)

**3. [Rule 2 - Missing critical] Resolved question text is bounded like a snapshot**
- **Found during:** Task 2 GREEN
- **Issue:** a question's text may be up to 65,535 characters. Projecting it unbounded would break the closed web event schema (max 500) and fail the whole questionnaire read (research Pitfall 1).
- **Fix:** the resolver passes resolved text through `questionTextSnapshot`, with a unit assertion (`RESOLVED_TEXT_NOT_BOUNDED`).
- **Files modified:** `questionnaire-scope.ts`, `questionnaire-governance.unit.test.ts`
- **Commit:** `05cb97c` (test), `d354282` (implementation)

**4. [Rule 2 - Missing critical] E8 also asserts that the timeline shows no key**
- **Found during:** Task 2 E2E
- **Issue:** the plan replaced the key assertion with a text assertion only. D-17's "no entry ever shows a key" had no journey-level proof.
- **Fix:** added `UX06_TIMELINE_NEVER_SHOWS_A_QUESTION_KEY` (the timeline has no `/hosting-model/` text).
- **Commit:** `d354282`

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 missing critical).
**Impact on plan:** every task, acceptance criterion and verification ran as planned. The changes keep the contract closed and the proofs honest, with no scope creep and no content-type change.

## TDD Gate Compliance

RED then GREEN for each task: `e2f972d` then `bdd76fd`, and `05cb97c` then `d354282`. Each RED failed on its target assertions, with `RED_EVIDENCE_OK` recorded from TAP output. Each GREEN passed. No refactor was needed.

## Issues Encountered

- The first `api:check` after `api:generate` failed only because the regenerated `schema.d.ts` differed from the index. With the regenerated file staged alongside the spec, `api:check` is clean, and it stayed clean after `git update-index --refresh`.

## Known Stubs

None.

## Threat Flags

None. `questionText` reaches the analyst projection only. The mounted test proves the Requestor read carries neither text nor key (T-10-24). Writes and resolved reads are bounded at 500 characters (T-10-25), and the timeline renders text as React text only (T-10-26).

## Deferred

Nothing is deferred. The `regenerated` event, the other half of D-03 item 3, belongs to plan 10-11 as planned, and its amendment should extend the section this plan added.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Ready for 10-11. It adds the `regenerated` kind to the same envelope: `GOVERNANCE_EVENT_KINDS`, both spec enums and both closed web enums in one change. It should append to the Phase 10 amendment, and keep `generatedDate` moving on replacement, because the D-17 resolution window reads it.
- The amendment awaits orchestrator approval as a contract-gap record (G-6).

## Self-Check: PASSED

- Files: all 13 modified files exist, including `apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts` and `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`.
- Commits: `e2f972d`, `bdd76fd`, `05cb97c` and `d354282` are on `post-demo` (`git rev-list --count 0df5f35..HEAD` = 4 before this docs commit).
- Acceptance criteria:
  - `MAX_QUESTION_TEXT_LENGTH = 500` and `questionTextSnapshot` are present;
  - the spec bounds `questionText` at 500 on both schemas;
  - the timeline no longer renders `event.questionKey`;
  - the amendment heading is present;
  - E8 asserts the hosting question text;
  - the full Strapi suite and the journey pass.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
