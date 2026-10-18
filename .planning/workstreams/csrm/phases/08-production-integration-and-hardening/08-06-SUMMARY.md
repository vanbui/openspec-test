---
phase: 08-production-integration-and-hardening
plan: 06
subsystem: api
tags: [strapi, ai-provider, assessment-draft, questionnaire-governance, revision-timeline, idambox-user, document-service, node-test, vitest]

requires:
  - phase: 08-production-integration-and-hardening
    provides: the 496-test Strapi baseline and the authorization matrix rows for GET /api/v1/questionnaires/{id} (08-05); the parity guard's boundary modes, which already accept the timeline actor's nullable display name (08-04)
provides:
  - compareRiskTypeNames and sortRiskProposals exported from assessment-draft-provider.ts, the one UTF-16 code-unit Risk Type ordering rule used by parseAssessmentDraftProposal, the deterministic provider and the OpenAI-compatible adapter (D-09)
  - governanceActorIds and governanceActorNames in questionnaire-scope.ts, and projectGovernanceEvents taking an optional display-name resolver for analyst projections (D-31)
  - the questionnaire read handler's one bounded lookup of active IdamBox users (documentId and displayName only) for analyst readers, so the revision timeline names the acting analyst
  - mounted, controller-seam, pure-projection and web proofs of the name, its null fallback and the Requestor omission
affects: [08-07-status-badges-and-copy, 08-14-int03-citations-and-gate, 08-VERIFICATION, any change to the assessment draft parser or a draft provider, any change to the questionnaire read projection]

tech-stack:
  added: []
  patterns:
    - "One ordering rule per sorted contract list: the parser exports the comparator it checks with, and every producer sorts with it; a source guard keeps a producer from growing its own comparator."
    - "Server-side name resolution for a stored actor id: collect the distinct ids the projection will emit, one Document Service findMany (documentId $in, accountStatus active, fields documentId and displayName, limit = id count), then hand a pure resolver to the projection; anything unresolved stays null."

key-files:
  created: []
  modified:
    - apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts
    - apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts
    - apps/strapi/src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider.ts
    - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts
    - apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
    - apps/strapi/tests/ai-provider-assessment.unit.test.ts
    - apps/strapi/tests/questionnaire-governance.integration.test.ts
    - apps/strapi/tests/questionnaire-governance.unit.test.ts
    - apps/strapi/tests/questionnaire-workflow.unit.test.ts
    - apps/web/src/features/questionnaires/questionnaire-revision-timeline.test.tsx

key-decisions:
  - "An unknown or inactive actor id keeps the null name, as the plan's must-have states: the one lookup filters accountStatus active, so a deactivated analyst's name is never served (the plan's action text listed only the documentId filter)."
  - "A stored display name counts only when it is a non-blank string of at most 255 characters, the width of a Strapi string column and the bound the web parser applies to by.displayName. Any other value resolves to null, so one malformed IdamBox user record degrades the timeline to its neutral wording instead of making the analyst's whole questionnaire read unparseable."
  - "The single-lookup and no-lookup-for-a-Requestor guarantees are proven at the controller seam with a fake Document Service, because a mounted test cannot count lookups; the pure-projection behaviour is proven beside the existing projectGovernanceEvents cases."
  - "The deterministic provider's use of the shared rule is proven by a source guard, because its input accepts only three fixed Risk Type names that sort the same under either rule."
  - "No contract-gap record for D-31: the datamodel already holds the fact (the governance log's by is the acting analyst's documentId, and idambox-user.displayName exists), and the contract already allows QuestionnaireRevisionTimelineEvent.by with a nullable displayName."
  - "INT-03 is the plan's requirement; REQUIREMENTS.md already records it complete since Phase 06.7, and the phase gate re-verifies it (D-07), so REQUIREMENTS.md is unchanged."

patterns-established:
  - "A sorted list that a closed parser checks is sorted by the comparator the parser exports, never by a locale-aware sort."
  - "A projection that names a stored actor takes a resolver from its caller and stays pure; the caller does one bounded lookup and only for the reader who may see the actor."

requirements-completed: [INT-03]

duration: about 34 min
completed: 2026-09-25
---

# Phase 08 Plan 06: One Risk Type ordering rule and a named timeline actor Summary

**The assessment draft parser, the deterministic provider and the OpenAI-compatible adapter now share one exported code-unit Risk Type ordering rule, so a mixed-case set such as `alpha risk`, `Beta risk` and `Gamma` orders as `Beta risk, Gamma, alpha risk` everywhere and a draft can no longer fail its own parser. The analyst revision timeline now names the acting analyst ("Bob Doe" in the mounted proof) through one bounded lookup of active IdamBox users. An unknown or inactive actor id keeps the null name and the "An analyst" wording, and a Requestor's timeline still carries no actor. No schema, contract, grant or `CSRM_AI_*` change.**

## Performance

- **Duration:** about 34 min, including two full Strapi runs of about 8.5 min each
- **Started:** 2026-09-25T17:40:42Z
- **Completed:** 2026-09-25T18:14:47Z (the metadata commit `7072ea7`)
- **Tasks:** 3 of 3 (Tasks 1 and 2 test-first, RED then GREEN)
- **Files modified:** 10 (5 Strapi source, 4 Strapi test, 1 web test); no file created or deleted

## Accomplishments

- **One Risk Type ordering rule (D-09, T-08-06-01).** `compareRiskTypeNames` (UTF-16 code-unit order) and `sortRiskProposals` (a sorted copy) are exported from `assessment-draft-provider.ts`. The parser's order check calls the comparator, the deterministic provider returns `sortRiskProposals(risks)` where it used a `localeCompare` sort, and the adapter's `sortProposal` uses the comparator in place of its private `compareCodeUnits`.
- **The mixed-case proof, at the parser seam.** Five new cases in `ai-provider-assessment.unit.test.ts` pin the rule, the sorted copy, the parser's acceptance of the shared order and refusal of the locale order, the deterministic provider's order, and a source guard. The adapter's existing mixed-case case still expects `Beta risk, alpha risk`.
- **The timeline names the acting analyst (D-31, T-08-06-02, T-08-06-03).** The questionnaire read (`findWorkflowOne`) collects the distinct actor ids of the events it will project (`governanceActorIds`) and runs one Document Service lookup: `findMany({ filters: { documentId: { $in: ids }, accountStatus: { $eq: "active" } }, fields: ["documentId", "displayName"], limit: ids.length })`. It then passes a resolver (`governanceActorNames`) into `projectGovernanceEvents`. It does this only for an analyst reader and only when the timeline has an event. The projection stays pure: without a resolver, and for any id the resolver cannot name, the name stays null.
- **The web keeps its fallback.** `questionnaire-revision-timeline.tsx` already rendered `by.displayName` with the `An analyst` fallback; a new case proves a null name and a null actor both read "by An analyst" and no documentId is shown. No web product, parser or contract change.
- **Full gate on the final tree.** Strapi 504 of 504 (8 min 36 s, on `947833c`); web 73 files and 885 tests (15.9 s); web typecheck clean; `api:check` clean; `git status --porcelain` empty.

## Task Commits

1. **Task 1: Share one Risk Type ordering rule between the parser and both providers (RED, then GREEN)**: `84d55f9` (test, RED: the five cases; the compile fails because the two helpers do not exist), `63e4550` (fix, GREEN: the helpers, the parser check, both providers)
2. **Task 2: Resolve the acting analyst's display name for the revision timeline server-side (RED, then GREEN)**: `8311fab` (test, RED: the mounted, controller and projection cases), `ac9c936` (feat, GREEN: the resolver parameter, the two helpers, the controller's one lookup)
3. **Task 3: Confirm the web timeline renders the name and keeps its fallback, then run the gate**: `947833c` (test: the null-name and null-actor case)

**Plan metadata:** the `docs(08-06): complete Risk Type ordering and timeline actor plan` commit that carries this summary, STATE and ROADMAP.

## TDD Gate Compliance

- **Task 1:** RED `84d55f9` was observed as a compile failure for the stated reason: `TS2305: Module '"../src/api/csrm-assessment/services/assessment-draft-provider"' has no exported member 'compareRiskTypeNames'` (and `'sortRiskProposals'`). `noEmitOnError` is on, so nothing ran. GREEN `63e4550`: 9 of 9 in the file; 77 of 77 across the five quick-run files (`ai-provider-assessment.unit`, `assessment-workflow.unit`, `ai-provider-guardrails.unit`, `ai-provider-failures.unit`, `assessment-workflow.integration`) in 28.1 s.
- **Task 2:** RED `8311fab` was observed twice. First, the mounted and controller cases, which compile against the old API, ran and failed at runtime, 3 of 20 failing, each for the stated reason:
  - `TIMELINE_ACTOR_NOT_NAMED_0`: actual `{ documentId: 'brnromgeg2pk3h570xm5w08v', displayName: null }`, expected `displayName: 'Bob Doe'`.
  - `ACTORS_NOT_RESOLVED_TO_ACTIVE_NAMES_ONLY`: the analyst's own events had null names.
  - `ACTOR_LOOKUP_IS_NOT_ONE_BOUNDED_QUERY`: actual `[]`, so no lookup happened.

  Adding the pure-projection case then made the compile fail (`TS2305` for `governanceActorIds`, `TS2554: Expected 2 arguments, but got 3` twice). GREEN `ac9c936`: 40 of 40 across `questionnaire-governance.unit`, `questionnaire-workflow.unit`, `questionnaire-governance.integration` and `questionnaire-workflow.integration` in 46.6 s. The full suite ran before the commit: 504 of 504.
- **Task 3** is not a TDD task: the plan expected no product change, and the new web case passes on the unchanged component.

## The mixed-case orders asserted (D-09)

| Proof | Names | Order asserted |
|-------|-------|----------------|
| `compareRiskTypeNames` | `Beta risk` vs `alpha risk`; `Gamma` vs `Beta risk`; `Gamma` vs `Gamma` | negative; positive; 0 |
| `sortRiskProposals` | `alpha risk`, `Beta risk`, `Gamma` | `Beta risk, Gamma, alpha risk`; input left as `alpha risk, Beta risk, Gamma`; a new array |
| Parser, shared order | the `sortRiskProposals` output | accepted, `Beta risk, Gamma, alpha risk` |
| Parser, locale order | `alpha risk, Beta risk, Gamma` (asserted to be what `localeCompare(…, "en")` produces) | refused: `Error: CSRM assessment draft proposal is invalid.` |
| Deterministic provider | its three fixed Risk Types, given out of order, with hosting `third-party` and personal data | `Internet Exposure, Personal Information Handling, Third-Party Dependency`, equal to `sortRiskProposals` of itself, and `parseAssessmentDraftProposal(result)` deep-equals `result` |
| Adapter (existing case, kept) | `alpha risk`, `Beta risk` | `Beta risk, alpha risk` |
| Source guard | both provider files | the deterministic provider has no `localeCompare` and calls `sortRiskProposals(`; the adapter has no `compareCodeUnits` or `localeCompare` and calls `compareRiskTypeNames(` |

Sensitivity: applied to the plan-base files (`bc6d5ac`), all four source-guard assertions fail (the deterministic provider had `localeCompare` and no `sortRiskProposals(`; the adapter had `compareCodeUnits` and no `compareRiskTypeNames(`).

## The timeline actor (D-31)

- **Name observed in the mounted proof:** "Bob Doe", the seeded Security Analyst `bob.doe@idambox.com`. The test reads it from the analyst's IdamBox record through the questionnaire's release relation, straight from the harness database, so it does not hard-code a seed value. Every analyst event on the timeline questionnaire (`released`, `returned-to-review`, `question-edited`, `answer-cleared`) projects exactly `{ documentId: <Bob's documentId>, displayName: "Bob Doe" }`, with no other key.
- **Null fallback, mounted.** A dedicated questionnaire's stored five-event log names:
  - the analyst: projected as "Bob Doe";
  - an id no user holds (`retiredanalystdocument01`): `displayName: null`;
  - an inactive user created for the test ("Former Analyst"): `displayName: null`, and the name appears nowhere in the response.

  Sensitivity: with the `accountStatus` filter removed from the committed controller, this test fails, because the inactive user resolves to "Former Analyst". The file was then restored from `HEAD`.
- **Requestor omission, mounted (T-08-06-02).** After a second release, the owning Requestor reads the same timeline: five events (`released, returned-to-review, question-edited, answer-cleared, released`). No event has a `by` key or any key beyond `kind`, `at` and `explanation`. Neither the analyst's name nor their documentId appears in the events. (The release fact's `releasedBy` is a separate field that every authorised reader receives by design. It is unchanged.)
- **One lookup, analyst readers only, at the controller seam.** For a six-event log naming five distinct ids, an analyst read issues exactly one `findMany`:
  `{ filters: { documentId: { $in: [a, b, c, d, e] }, accountStatus: { $eq: "active" } }, fields: ["documentId", "displayName"], limit: 5 }`

  Id `a`'s name is served; `b` (not returned, so unknown or inactive), `c` (blank), `d` (null) and `e` (256 characters) all project `displayName: null`. A Requestor read issues no lookup and projects no `by`, and neither does an analyst read of an empty timeline.
- **Pure projection.** `projectGovernanceEvents(document, actor, resolve)` names analyst actors only through `resolve`, never consults it for a Requestor, and keeps every name null without it; the existing `TIMELINE_ACTOR_NAME_WAS_FABRICATED` assertion (no resolver) is unchanged, with only its comment updated. `governanceActorIds` returns the distinct ids of exactly the events the projection emits: a future event kind is omitted, and a malformed or absent log gives none.
- **No contract-gap record was needed.** The datamodel holds the fact: the governance log's `by` is the acting analyst's documentId, and `idambox-user.displayName` exists. The contract already allows `QuestionnaireRevisionTimelineEvent.by: QuestionnaireReleaseActor | null` with a nullable `displayName`. No `docs/contract-gaps/` record was written.

## Files Created/Modified

- `apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts`: `compareRiskTypeNames`, `sortRiskProposals`; the parser's order check uses the comparator
- `apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts`: `buildRisks` returns `sortRiskProposals(risks)`
- `apps/strapi/src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider.ts`: `sortProposal` uses `compareRiskTypeNames`; `compareCodeUnits` removed; the control-number default sort kept
- `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts`: the event parsing factored into `projectableGovernanceEvents`; `governanceActorIds`, `governanceActorNames`; `projectGovernanceEvents` takes the optional resolver
- `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts`: `timelineActorNames`, the one lookup, used by the read handler
- `apps/strapi/tests/ai-provider-assessment.unit.test.ts`: the five D-09 cases
- `apps/strapi/tests/questionnaire-governance.integration.test.ts`: the named-actor and Requestor-omission assertions in the timeline test; the unknown-or-inactive test
- `apps/strapi/tests/questionnaire-governance.unit.test.ts`: the pure-projection case
- `apps/strapi/tests/questionnaire-workflow.unit.test.ts`: the controller-seam lookup case
- `apps/web/src/features/questionnaires/questionnaire-revision-timeline.test.tsx`: the neutral-wording case

## Decisions Made

See `key-decisions` above. In short: inactive ids stay unnamed (the must-have, enforced by the lookup's filter); only a non-blank name of at most 255 characters counts; the once-and-analyst-only guarantees are proven at the controller seam; the deterministic provider's use of the shared rule is proven by a source guard; no contract-gap record.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing evidence] The plan's fourth Task 2 behaviour and its "once, not for a Requestor" fail condition had no test file in the plan's list**
- **Found during:** Task 2 RED
- **Issue:** The plan lists only the mounted test for Task 2. A mounted test cannot count Document Service lookups or see a Requestor read skip one, and the pure-projection behaviour ("given a resolver it uses it, given none it keeps today's null names") is a unit property.
- **Fix:** One case in `questionnaire-workflow.unit.test.ts`, the file that already drives the controller with a fake Document Service. One case in `questionnaire-governance.unit.test.ts`, the file that already pins `projectGovernanceEvents`.
- **Verification:** Both RED before GREEN (runtime, and compile); both green after. **Committed in:** `8311fab`

**2. [Rule 2 - Robustness] A malformed display name could have failed the analyst's whole questionnaire read**
- **Found during:** Task 2 GREEN
- **Issue:** The plan says "only string display names". The web parser caps `by.displayName` at 255 characters (`questionnaire-service.ts:31`), and SQLite does not enforce the width of a Strapi string column. So a longer stored name would have made the web reject the entire questionnaire summary, a failure the old constant null never had. A blank string is not a name either.
- **Fix:** `governanceActorNames` accepts only a non-blank string of at most 255 characters; anything else resolves to null.
- **Verification:** The controller case covers a blank, a null and a 256-character name, each projecting `displayName: null`. **Committed in:** `ac9c936`

**3. [Plan consistency] The lookup filters active users**
- **Found during:** Task 2 GREEN
- **Issue:** The plan's action text gives the filter as `documentId: { $in }` only, but its must-have truth (and 08-RESEARCH F9.5) says unknown or inactive ids keep the null fallback.
- **Fix:** `accountStatus: { $eq: "active" }` in the same one query; `fields` stays `["documentId", "displayName"]`.
- **Verification:** The mounted inactive case, and the sensitivity run above. **Committed in:** `ac9c936`

### Other deviations

- **A fifth Task 1 case.** The plan asks for four new cases and a one-off grep for `localeCompare`. The source guard makes that grep permanent and extends it to the adapter's comparator. It is the only proof available for the deterministic provider, whose fixed names sort the same under either rule.
- **Test data without a harness change.** The research's serialisation table gives this plan read-only use of `strapi-http-harness.ts`. The unknown-or-inactive fixture is built with the harness's existing `createUserFixture`, `createAssessmentRequestFixture` and `createFixtureDocument`, and the expected name is read through the existing `getQuestionnaire`.
- **The Requestor read needs a second release.** After the return to review the owner cannot read the timeline questionnaire (403 by design), so the test releases it again before the owner reads it.
- **Windows host.** The plan's command translations were used:
  - `/opt/node24/bin` became `/c/ProgramData/nvm/v24.19.0`;
  - the free-port check used `Get-NetTCPConnection` (ports 1337 and 3000 free before any run);
  - logs went under `apps/web/.tmp/logs/csrm-phase-08/` (gitignored);
  - the verify line's `git -C /home/user/csrm-dylan` ran against this repository.

**Total deviations:** 3 auto-fixed (2 Rule 2, 1 plan-consistency) and 4 recorded. **Impact on plan:** no scope added beyond evidence and one fail-soft bound; no schema, contract, grant, catalogue or `CSRM_AI_*` change.

## Issues Encountered

- `pnpm --filter @csrm/web test -- <patterns>` passes the `--` through to vitest literally, so the command in the plan's Task 3 verify runs the whole web suite rather than the two named files (73 files, 885 tests, all passing). The two files were also run by path: 2 files, 70 tests (4 timeline, 66 parity), all passing.
- The standalone pnpm binary prints an "Unsupported engine … current: v22.19.0" warning for its own process; every command it spawned ran on Node 24.19.0 (`pnpm exec node --version`).

## Verification

| Command | Result |
|---------|--------|
| `tsc --pretty false` and `tsc -p tests/tsconfig.json --pretty false` (Strapi) | exit 0 after each GREEN |
| Task 1 quick run (five files) | 77 of 77, 28.1 s |
| Task 2 quick run (four files) | 40 of 40, 46.6 s |
| `pnpm --filter @csrm/strapi test`, before the Task 2 GREEN commit | **504 of 504**, 8 min 31 s (496 before the plan plus 8 new cases) |
| `pnpm --filter @csrm/strapi test`, final tree (`947833c`) | **504 of 504**, 8 min 36 s |
| `pnpm --filter @csrm/web test` | 73 files, **885 of 885** (884 before the plan plus 1), 15.9 s |
| `pnpm --filter @csrm/web typecheck` (`next typegen && tsc --noEmit`) | exit 0, no diagnostics |
| `pnpm --prefix apps/web api:check` (regenerate, then `git diff --exit-code`) | exit 0, no drift |
| Freeze diff (below) | empty |
| `git diff bc6d5ac..HEAD`, lines naming `CSRM_AI_` | none |
| `git status --porcelain` after the gate | empty |

The freeze diff is `git diff --name-only bc6d5ac..HEAD -- 'apps/strapi/src/api/*/content-types' docs/references/specification.json` plus both catalogue copies.

## Known Stubs

None.

## Threat Flags

None. The only new data path is the analyst-only read of two IdamBox user fields for ids the stored log already holds; it is the `T-08-06-02` and `T-08-06-03` surface the plan's threat model covers, with no new endpoint, grant or trust boundary.

## User Setup Required

None: no external service configuration required.

## Next Phase Readiness

- 08-07 (the shared tinted status badge, the single question list in analyst review, provider-neutral drafting copy) can start. It runs Playwright, so the dev servers stay stopped for it. Once the dev Strapi runs this code, the analyst revision timeline names the analyst ("by Bob Doe" for events the development analyst recorded).
- 08-14 can cite `ai-provider-assessment.unit.test.ts` (nine cases) for D-09 alongside the INT-03 suites.
- The STATE ledger's two carried items, the latent ordering mismatch (2026-09-15) and "the analyst revision timeline names an actor only as 'An analyst'", are closed.

## Self-Check: PASSED

- The ten modified files and this summary are present.
- Commits present on `dev`: `84d55f9`, `63e4550`, `8311fab`, `ac9c936`, `947833c`.
- Acceptance re-run on the final tree:
  - **Task 1:** both helpers are exported, and the parser check calls `compareRiskTypeNames`. The deterministic provider has 0 `localeCompare` and 2 `sortRiskProposals`; the adapter has 0 `compareCodeUnits` and 2 `compareRiskTypeNames`. The test names `alpha risk`, `Beta risk`, `Gamma` and `deterministicAssessmentDraftProvider`.
  - **Task 2:** the optional resolver parameter is present, and no hard-coded `displayName: null` is left in `questionnaire-scope.ts`. The controller holds `api::idambox-user.idambox-user` and `fields: ["documentId", "displayName"]`. The mounted test asserts both named and null actors.
  - **Task 3:** the web test contains `displayName: null` and `An analyst`.
- Plan verification: the freeze diff over the content types, the specification and both catalogue copies is empty. No `CSRM_AI_` line changed and no Keycloak line was added. This plan's commits and files carry no tool attribution and no trailer.

---
*Phase: 08-production-integration-and-hardening*
*Completed: 2026-09-25*
