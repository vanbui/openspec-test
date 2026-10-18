---
phase: 13-request-pick-up-and-notes
plan: 16
subsystem: api
tags: [strapi, ai-context, request-notes, prompt-injection, context-summary, openapi, zod, deterministic-provider]
requires:
  - phase: 13-request-pick-up-and-notes
    provides: the CsrmRequestNote content type with changesAiInputs and aiInputLog, and the AI-input mark (13-05, 13-06)
  - phase: 12-ai-context-suggestions-and-provenance
    provides: the context builder and its RequestorDataSection extension point, promptDataTag rendering, the run record and its 64 KB summary bound, the run read (12-03, 12-04, 12-10)
provides:
  - The notes RequestorDataSection: each marked note as note.part, note.sequence and note.body values, in sequence order, inside the untrusted Requestor block
  - ContextNote, AssessmentContextRecords.notes, CONTEXT_BOUNDS.markedNotes (50) and contextTooLargeMessage naming the marked notes
  - loadMarkedRequestNotes (marked notes only, by sequence, at most 51 read; a refusal reads every marked sequence)
  - ContextSummaryV2 (v1 plus the notes section), ContextSummary, ContextSummaryRead; buildAssessmentContext always writes v2
  - parseContextSummary for v1 (read as no notes) and v2, closed, failing safe to null
  - AiRunContextSummary.schemaVersion (1 or 2) and .notes, AiRunContextNotes, AiRunContextNote in the specification and the generated client
  - aiRunContextNotesSchema and aiRunContextNoteSchema in the web run parser
  - uatALikeNotes and UAT_A_LIKE_NOTE_SENTINELS (fixture) and seedRequestNotes (harness)
affects: [13-17, 13-18, 13-19, 14, 15, 16, 17, 21]
actuals:
  tokens: 14400
  tasks: 2
  commits: 4
plan_head_before: f9640b8e15a67c3dc0f54d3f8b903145a3de5042
plan_head_after: 886afb9f8bfdc007f06246868d04140f9661fe8f
tech-stack:
  added: []
  patterns:
    - "A new Requestor data section added through Phase 12's extension point: constant field labels, server integers and closed enums as labels, every free text one promptDataTag value"
    - "A stored envelope versioned, not migrated: the closed parser reads the old version as the new one's empty case"
    - "A cross-module constant copied rather than imported when the import would close a CommonJS module cycle, with a unit test keeping the copy equal and a fresh-process test proving the load order"
key-files:
  created:
    - .planning/workstreams/csrm/phases/13-request-pick-up-and-notes/13-16-SUMMARY.md
    - .planning/workstreams/csrm/phases/13-request-pick-up-and-notes/deferred-items.md
  modified:
    - apps/backend/src/csrm/ai/assessment-context.ts
    - apps/backend/src/csrm/ai/assessment-context-loader.ts
    - apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts
    - apps/backend/src/api/csrm-ai-run/controllers/csrm-ai-run.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts
    - apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts
    - apps/csrm/src/features/ai-assistance/test-fixtures.ts
    - apps/backend/tests/fixtures/uat-a-like-context.ts
    - apps/backend/tests/helpers/strapi-http-harness.ts
    - apps/backend/tests/assessment-context.unit.test.ts
    - apps/backend/tests/assessment-context.integration.test.ts
    - apps/backend/tests/ai-provider-guardrails.unit.test.ts
    - apps/backend/tests/ai-provenance.unit.test.ts
    - apps/backend/tests/ai-run.integration.test.ts
    - apps/backend/tests/questionnaire-generation.integration.test.ts
    - apps/backend/tests/assessment-workflow.integration.test.ts
key-decisions:
  - "The notes section is the last Requestor data section (after the request fields and, for the draft, the answers) and is left out entirely when no note is marked; the v2 summary still records notes { included: [], marked: 0, bound: 50 }."
  - "A marked note's body also joins the relevance query that ranks the offered Risk Types and the control shortlist: a note marked as changing the AI inputs is an input, at the same trust level as the answers already in that query. The fixtures' deterministic output is unchanged by it."
  - "Notes are not citable sources: they add no entry to the source catalogue or allowed.sourceKeys, so a proposal can never cite a note and no note text reaches a citation."
  - "The refusal names the marked notes by sequence, runs of three or more written 'a to b', shortened to '… and N more' only to stay within the 255-character job failure message; with no note marked the message stays Phase 12's. The systems and assets bounds keep Phase 12's message, because unmarking a note would not help."
  - "More than 50 marked notes is refused in the loader before the builder runs, reading every marked sequence (at most 500) so the message names them all; the builder refuses the same for any direct caller."
  - "A marked note the loader cannot read as one (bad part, sequence, posting time or body) fails the context rather than being dropped, so what reaches a provider is never silently less than the analyst marked."
  - "parseContextSummary returns the read shape: a v1 summary gains notes { included: [], marked: 0, bound: 50 } and keeps schemaVersion 1; a v2 note entry with any key beyond documentId, part, sequence, postedAt and characters, a section with more included than marked, more than 50, or a bound other than 50 is null."
  - "COLLAB-01 stays Pending until the phase gate (the 13-03 to 13-06 precedent)."
requirements-completed: []
coverage:
  - id: D1
    description: "Only the notes marked as changing the AI inputs reach the questionnaire and draft contexts, in sequence order, each as escaped note.part, note.sequence and note.body values inside the one untrusted Requestor block, with no author name, posting time, note id or request number"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/assessment-context.integration.test.ts#mounted questionnaire context sends Jane's marked note as untrusted data, never Bob's unmarked reply, and keeps no note text"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/questionnaire-generation.integration.test.ts#mounted questionnaire generation sends the marked note as data and its run records it without its text"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#mounted draft generation sends the marked note and records it in the draft run's v2 summary"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/assessment-context.unit.test.ts#marked notes render in sequence order inside the one untrusted block, with no name, time, id or request number"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hostile note text stays data: a body closing value and requestorData, opening field and system tags and telling the model to release the assessment is one escaped value; the system message and the deterministic providers' output are unchanged; the classification ceiling still refuses"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/backend/tests/ai-provider-guardrails.unit.test.ts#a hostile marked note stays one escaped note.body value and never closes or opens a tag"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/ai-provider-guardrails.unit.test.ts#hostile marked notes reach the provider as the escaped prompt and leave the deterministic output unchanged"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/ai-provider-guardrails.unit.test.ts#the classification ceiling still refuses a request above it when notes are marked"
        status: pass
    human_judgment: false
  - id: D3
    description: "More than 50 marked notes, or a context over its budget because of a note, fails with CONTEXT_TOO_LARGE before any run or provider call, naming the marked notes; 50 are sent and a 5,000-character note is sent whole"
    requirement: "COLLAB-01"
    verification:
      - kind: unit
        ref: "apps/backend/tests/assessment-context.unit.test.ts#51 marked notes are CONTEXT_TOO_LARGE, naming the marked notes, and 50 are sent"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/assessment-context.unit.test.ts#a 5,000-character note is sent whole, and a note over the budget is CONTEXT_TOO_LARGE naming the notes"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/assessment-workflow.integration.test.ts#a draft with 51 marked notes fails as too large, naming them, before a run or a provider call"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each run records a v2 context summary naming every included note by documentId, part, sequence, posting time and length, never its text; a v1 summary reads as no notes; the run read and the web parser carry the section and refuse a note body"
    requirement: "COLLAB-01"
    verification:
      - kind: integration
        ref: "apps/backend/tests/ai-run.integration.test.ts#mounted run read carries the notes a run used without their text, and a v1 summary reads as none"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/ai-provenance.unit.test.ts#the context summary parser reads v1 as no notes, accepts v2 and refuses a note's text or a section past its bound"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/ai-assistance/ai-assistance-service.test.ts#refuses a summary without its version or notes section, or a note carrying its text (D-28, G-3)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts"
        status: pass
    human_judgment: false
duration: 62min
completed: 2026-10-09
status: complete
---

# Phase 13 Plan 16: Notes in the AI Context Summary

**Notes a Security Analyst marks as changing the AI inputs now reach questionnaire and draft generation, and only those notes. Each note goes in as escaped `note.*` values inside the untrusted Requestor block. Each run keeps a v2 context summary that names the notes it used without their text. More than 50 marked notes, or a note that takes the prompt over its budget, is refused before any run starts, and the refusal names the marked notes.**

## Performance

- **Duration:** about 62 min (including two full Strapi suite runs of 15.5 and 18 minutes)
- **Started:** 2026-10-09T03:15:18Z
- **Completed:** 2026-10-09T04:18Z
- **Tasks:** 2
- **Files modified:** 18 source and test files, plus the SUMMARY and deferred-items.md

## Accomplishments

- **What the AI reads (D-27).** `loadMarkedRequestNotes` reads only the request's notes with `changesAiInputs: true`, ordered by sequence, and `loadAssessmentContextRecords` returns them as `records.notes`. `buildAssessmentContext` sorts them by sequence and appends one `{ kind: "notes" }` section after the request fields and, for the draft, the answers. Each note becomes three values: `note.part` (the closed enum), `note.sequence` (a server integer) and `note.body` (the whole body). The section goes through the unchanged `renderRequestorDataBlock`/`promptDataTag`. No author name, posting time, note documentId or request number is sent. Both generations use the one builder, so later operations built on it (Phases 15 to 17) get the notes too.
- **Bounds (T-13-53).** `CONTEXT_BOUNDS.markedNotes = 50`. Too many marked notes, a prompt over the operation's budget, or a summary over 64 KB throws `AssessmentContextTooLargeError` with the marked notes' sequences. Its `safeMessage` reads, for example, `The AI context is too large. 51 notes are marked as changing the AI inputs (notes 1 to 51); unmark some and try again.` and always fits the 255-character job failure message. Note text is never truncated.
- **Summary v2 (D-28, G-3).** `ContextSummaryV2` is v1 plus `notes: { included: [{ documentId, part, sequence, postedAt, characters }], marked, bound: 50 }`. The builder always writes v2. `parseContextSummary` reads v1 as having included no notes, accepts v2, and fails safe to null on anything else, including a note entry with a `body` or any other key. The 64 KB bound still applies.
- **The run read and the web.** In the specification, `AiRunContextSummary` gains `schemaVersion` (1 or 2) and a required `notes` (`AiRunContextNotes`, `AiRunContextNote`, both closed; the note has no `body`). The generated client is regenerated. The web run parser (`aiRunContextNotesSchema`) requires the section and refuses a note body, the run fixture carries it, and the parity guard passes.

## Task Commits

1. **Task 1 RED** `758c2e4`: `test(13-16): expect marked notes in the AI context and the run summary`
2. **Task 1 GREEN** `7d047f2`: `feat(13-16): send marked notes to the AI as untrusted data and record which were used`
3. **Task 2 tests** `93e9906`: `test(13-16): expect bounded, delimited notes in every generation`
4. **Rule 1 fix** `886afb9`: `fix(13-16): keep the context loader out of the notes policy's module cycle`

## Test Counts

| Run | Result |
| --- | --- |
| Task 1 RED, Strapi (3 mounted files) | 35 tests, 32 pass, 3 fail, each on the planned assertion (`MARKED_NOTE_NOT_SENT_ONCE_AS_DELIMITED_DATA`, `RUN_READ_NOT_V2`, `MARKED_NOTE_NOT_IN_THE_CONTEXT`) |
| Task 1 RED, web | Tests 2 failed / 308 passed (the run parser refusing the v2 fixture) |
| Task 1 verify, web (`src/features/ai-assistance` + parity guard) | Test Files 15 passed, **Tests 310 passed** |
| Task 1 verify, Strapi (`assessment-context.integration`, `ai-run.integration`, `questionnaire-generation.integration`) | **# pass 35 / # fail 0** |
| Task 1 verify, `api:check`, web typecheck, Strapi test compile | clean |
| Task 2 focused, Strapi (`assessment-context.unit`, `ai-provider-guardrails.unit`, `ai-provenance.unit`) | **# pass 43 / # fail 0** (after the fix's two cases) |
| Mounted draft cases (`assessment-workflow.integration`, name pattern "marked note") | # pass 2 / # fail 0 |
| `request-notes.integration` after the fix | # pass 15 / # fail 0 |
| **Full Strapi suite** (`pnpm --dir apps/backend test`, final) | **# tests 924 / # pass 924 / # fail 0** (18.2 min) |

## Decisions Made

See `key-decisions` above. In short: notes are the last Requestor section and are left out when none is marked; a marked note's text also feeds the relevance ranking of Risk Types and controls; notes are never citable sources; the refusal names notes by sequence within 255 characters; a malformed marked note fails the context closed; v1 summaries are read, never rewritten.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The loader's notes import emptied the notes window**
- **Found during:** Task 2's full Strapi suite (first run: 904 pass, 18 fail, every note post and mark refused `NOTES_CLOSED`)
- **Issue:** Task 1's loader imported `NOTES_PER_REQUEST_MAX` from `request-notes-policy.ts`. That closed a CommonJS cycle (request-notes-policy → collection-scope → assessment-workflow → assessment-context-loader → request-notes-policy). When collection-scope loaded first, `ACCEPTING_STATUSES` was built from an undefined `REVIEWABLE_REQUEST_STATUSES`, so `acceptsNotes("submitted")` was false. Reproduced in a fresh process and through the mounted API.
- **Fix:** The loader keeps its own `MARKED_NOTE_SEQUENCES_READ_LIMIT = 500`, with a comment saying why. One unit test keeps it equal to `NOTES_PER_REQUEST_MAX`. A second test loads collection-scope first in a fresh process and checks that the window is open for a submitted request (it printed `false` before the fix).
- **Files modified:** `apps/backend/src/csrm/ai/assessment-context-loader.ts`, `apps/backend/tests/assessment-context.unit.test.ts`
- **Commit:** `886afb9`

**2. [Rule 3 - Blocking] One Phase 12 parser case named v2 as invalid**
- **Found during:** Task 1 GREEN
- **Issue:** `ai-provenance.unit.test.ts` "run envelopes parse closed" listed `{ ...summary, schemaVersion: 2 }` as a refused summary. v2 is now the contract.
- **Fix:** That case now uses `schemaVersion: 3`, plus a v1 summary that carries a notes section. Both are refused.
- **Commit:** `7d047f2`

**3. [Plan sequencing] Task 2's cases passed on their first run**
- **Issue:** The plan's "Recorded planning decisions" describe the bound, the message and the ordering together with the section, and Task 1 GREEN built them in one pass. So Task 2's RED commit (`93e9906`) passed on first run, and no `feat(13-16): bound marked notes …` commit was needed or made. No escaping gap was found, and `prompt-sections.ts` and `promptDataTag` are unchanged.
- **Compensating check:** a mutation run that removed the 50-note bound, the sequence sort and the note entry's closed key set failed exactly the three matching cases (51 notes, sequence order, parser). The source was restored byte for byte, and `git status` was clean.

## Escaping Gaps Found by the Guardrail Cases

None. The hostile note was a closing `value` tag, an opening `field` tag, a closing `requestorData` tag, an opening `system` tag and a release instruction, also quoted inside an analyst's note. It stayed one escaped `note.body` value each time. `<requestorData>` and `</requestorData>` each appear once, the `field` and `value` tags balance, and exactly six pairs are added for two notes.

## Deferred Issues

- **The web shows Phase 12's CONTEXT_TOO_LARGE copy** ("… Contact your administrator."), not the served message that names the marked notes. 13-UI-SPEC.md gives no copy for this case, and no Phase 13 plan owns it. Recorded in `deferred-items.md` (low severity: the refusal is safe and nothing is sent).

## Threat Surface

T-13-50 to T-13-53 are mitigated as the register states, and no new surface was added: no new route, no content-type change, no new dependency, and only the deterministic provider was used (the guardrail case uses the local fake OpenAI-compatible server only).

## Known Stubs

None.

## Next Phase Readiness

13-17 can compute "AI inputs changed" from `parseContextSummary(run.contextSummary).notes.included` (a v1 summary reads as included none) against the currently marked notes. 13-18's "What the AI used" sheet can read `contextSummary.notes` from the run read through `aiRunContextNotesSchema`.

## Self-Check: PASSED

- All 18 modified source and test files, the SUMMARY and deferred-items.md exist.
- Commits `758c2e4`, `7d047f2`, `93e9906` and `886afb9` are on the branch.
