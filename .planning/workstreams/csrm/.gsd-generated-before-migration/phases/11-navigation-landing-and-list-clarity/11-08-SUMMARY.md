---
phase: 11-navigation-landing-and-list-clarity
plan: 08
subsystem: api
tags: [strapi, openapi, request-lifecycle, next-action, holder, request-hub, zod, playwright, vitest, node-test]

requires:
  - phase: 11-navigation-landing-and-list-clarity
    provides: "11-07: the spec and parity guard as they stood after the assessment list widening"
  - phase: 10-existing-flow-gap-closure
    provides: "10-04 and 10-14: request-hub.tsx with nextActionOverride; 10-06: request-workflow.integration.test.ts; the closed parsers and the parity guard"
provides:
  - "Strapi: exported holderFor(key) over a frozen D-20 map (requestor at draft and questionnaire-released, none at assessment-released, analyst otherwise), exported types RequestHolder and LifecycleKey"
  - "Strapi: projectRequestLifecycle's nextAction is { actor, holder, summary, href? }; the UI-SPEC §6.1 sentences replace the retired waiting sentence; a closed request keeps nextAction null"
  - "Spec: AssessmentRequestLifecycleNextAction requires holder (enum requestor, analyst, none), closed; schema.d.ts regenerated"
  - "Web: requestHolders and RequestHolder in the zod-free request-domain.ts; holder parsed closed in requestLifecycleSchema"
  - "Web: RequestHub links the next action only when holder equals actor and an href is present, else plain text; nextActionOverride still wins as plain text"
  - "E2E: UX08_NEXT_ACTION_NAMES_HOLDER in requestor-request-workflow.spec.ts (both projects, asserted at 1440)"
affects: [11-09, 11-10, 11-11, 11-12, 13]

actuals:
  tokens: 11700
  tasks: 2
  commits: 3
plan_head_before: 76d493c303eac12869d5f933668377ee67b3e7df
plan_head_after: cf245625e8c3550a8a7ff7861c534ef2e221195d

tech-stack:
  added: []
  patterns:
    - "A per-step fact the server owns (holder) is served beside the viewer (actor); the web compares the two to choose link or text and never reads the sentence"
    - "A frozen Record<LifecycleKey, ...> map behind an exported accessor, so a later SQL predicate can be proved equal to it"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-assessment-request/services/request-lifecycle.ts
    - apps/backend/tests/request-lifecycle.unit.test.ts
    - apps/backend/tests/request-workflow.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/requests/request-domain.ts
    - apps/csrm/src/features/requests/request-schema.ts
    - apps/csrm/src/features/requests/request-hub.tsx
    - apps/csrm/src/features/requests/request-hub.test.tsx
    - apps/csrm/src/features/requests/request-lifecycle-stepper.test.tsx
    - apps/csrm/src/features/requests/request-domain.test.ts
    - apps/csrm/src/features/assessments/assessment-review-workflow.test.tsx
    - apps/csrm/src/features/contract-response-parity.test.ts
    - apps/csrm/e2e/requestor-request-workflow.spec.ts

key-decisions:
  - "11-08: actor stays the viewer and holder is the same for both viewers; the hub's link rule is holder === actor plus an href, so a forged or stray href for a non-holder still renders as text"
  - "11-08: the page-supplied hrefs.nextAction override is gated by the same holder rule as the served href (no production page passes it today)"
  - "11-08: LifecycleKey is exported with holderFor, because plan 11-10's equivalence test needs the key type"
  - "11-08: the spec documents actor (the viewer) and holder (who holds the step, and that a client links only when they match)"
  - "11-08: UX-08 is shared with later Phase 11 plans: requirements.ready-ids reports 0/1 ready, so REQUIREMENTS.md is unchanged"

patterns-established:
  - "holderFor(key): the single D-20 source plan 11-10's 'waiting on me' predicate must equal"

requirements-completed: []

coverage:
  - id: D1
    description: "Strapi gives every lifecycle step its D-20 holder and names the holder in the UI-SPEC §6.1 sentence for both viewers; only the holder's own step carries an href; no sentence says 'other party'; a closed request has no next action"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/backend/tests/request-lifecycle.unit.test.ts#holderFor gives the D-20 holder of every lifecycle step"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/request-lifecycle.unit.test.ts#each step's next action names its holder in the UI-SPEC §6.1 sentence for both viewers, linking only the holder's own step"
        status: pass
      - kind: unit
        ref: "apps/backend/tests/request-lifecycle.unit.test.ts#a closed request has no next action and no holder"
        status: pass
    human_judgment: false
  - id: D2
    description: "The served request read carries holder: a released questionnaire names the Requestor as holder for both readers (the analyst reads 'The Requestor is answering the questionnaire.' with no link); a submitted request gives its Requestor the analyst-held sentence with no href and the analyst 'Generate the questionnaire.' with an href"
    requirement: "UX-08"
    verification:
      - kind: integration
        ref: "apps/backend/tests/request-workflow.integration.test.ts#authorised request reads carry one lifecycle truth with actor-specific next actions"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/request-workflow.integration.test.ts#a submitted request names the Security Analyst as the holder of its next step for both readers (D-27)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The contract requires holder on AssessmentRequestLifecycleNextAction; the generated client is current; the closed web parser accepts holder and refuses a missing or unknown one"
    verification:
      - kind: other
        ref: "pnpm --dir apps/csrm api:check (exit 0)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts#parses the lifecycle next action with its holder, refusing a missing or unknown holder (D-02 item 5, D-27)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The hub renders 'Next action: ' and the served sentence, as a link only when holder equals actor and an href exists; a non-holder reads plain text even if an href arrived"
    requirement: "UX-08"
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-hub.test.tsx#links the next action only when the viewer holds the step and the server supplies an href (D-27)"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/requests/request-hub.test.tsx#adds only governance wording for the analyst view and does not infer an action link"
        status: pass
    human_judgment: false
  - id: D5
    description: "In the browser, a Requestor who has just submitted reads 'Next action: The Security Analyst is reviewing your request and will send you a questionnaire to answer.' as plain text in the Request summary at 1440"
    requirement: "UX-08"
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/requestor-request-workflow.spec.ts#UX08_NEXT_ACTION_NAMES_HOLDER ([desktop] and [mobile])"
        status: pass
    human_judgment: false

duration: 63min
completed: 2026-10-03
status: complete
---

# Phase 11 Plan 08: The next action names who holds the work Summary

**A request's lifecycle `nextAction` now carries `holder` (requestor, analyst or none) beside `actor`, which stays the viewer. Strapi's exported `holderFor` gives each step's holder. The next-action sentences name the holder: a Requestor reads "The Security Analyst is reviewing your request and will send you a questionnaire to answer.", and the analyst reads "The Requestor is answering the questionnaire.". "The work is waiting with the other party." is gone. The field is required in the specification and parsed closed on the web. The hub links the sentence only when the viewer holds the step and an href was served.**

## Performance

- **Duration:** 63 min. Wall clock covers two Playwright runs, the full Strapi suite and two full web runs.
- **Started:** 2026-10-03T07:19:09Z
- **Completed:** 2026-10-03T08:22:05Z
- **Tasks:** 2 of 2
- **Files changed:** 14, all modified (none created or deleted)

## Accomplishments

- **Strapi holder (D-02 item 5, D-20).**
  - `holderFor(key)` reads a frozen `Record<LifecycleKey, RequestHolder>`:
    - `requestor` at `draft` and `questionnaire-released`;
    - `none` at `assessment-released`;
    - `analyst` at the other five steps.
  - `holderFor`, `RequestHolder` and `LifecycleKey` are exported for plan 11-10's equivalence test.
  - `projectRequestLifecycle` returns `nextAction = { actor, holder, summary, href? }`. A closed request still returns `nextAction: null`.
- **Strapi sentences (D-21, D-27, UI-SPEC §6.1, copied verbatim with ’).**
  - The Requestor reads:
    - at `submitted`: "The Security Analyst is reviewing your request and will send you a questionnaire to answer.";
    - at `questionnaire-generated`: "…checking your questionnaire before sending it to you.";
    - at `questionnaire-submitted`: "…reviewing your answers to assess the request’s risk.";
    - at `assessment-drafted`: "…preparing your risk assessment.";
    - at `assessment-reviewed`: "…finalising your risk assessment before releasing it to you.".
  - The analyst reads:
    - at `draft`: "The Requestor hasn’t submitted this request yet.";
    - at `questionnaire-released`: "The Requestor is answering the questionnaire.".
  - The verb-first sentences and "No action is required." are unchanged, and the waiting constant is deleted.
  - The href rule is unchanged: only the viewer who holds the step gets one, and only to a relationship `projectRequestRelationships` marks available.
- **Contract.**
  - `AssessmentRequestLifecycleNextAction` gains `holder` (enum, required), still `additionalProperties: false`.
  - `actor` and `holder` each gained a description.
  - `schema.d.ts` was regenerated, and `api:check` is clean.
  - These are unchanged:
    - routes, grants and content types;
    - `served-operations.json` (check mode 8/8);
    - both catalogue copies, which are byte-identical (SHA-1 `2da80b71…`, the same as after 11-07).
- **Web.**
  - `request-domain.ts` adds `requestHolders` and `RequestHolder`, and `RequestLifecycleNextAction.holder`.
  - `requestLifecycleSchema` parses `holder` with `z.enum(requestHolders)` inside the strict object.
  - `RequestHub` computes `nextActionHref` only when `holder === actor`, from `hrefs.nextAction ?? nextAction.href`. Otherwise the summary is plain text.
  - `nextActionOverride` still replaces the summary as plain text.
- **Browser proof.** `UX08_NEXT_ACTION_NAMES_HOLDER` runs straight after the journey's first submit, in both projects:
  - it sets the viewport to 1440;
  - it asserts the Request summary's `Next action:` line reads the submitted sentence, with no link in it;
  - it returns to the project's width.

## Task Commits

1. **Task 1: The next action names who holds the work, from Strapi to the hub (tracer, TDD)**
   - `f0b7f53`: test(11-08), RED
   - `223ba95`: feat(11-08), GREEN
2. **Task 2: The Requestor reads what the Security Analyst is doing, in the browser, then the Strapi suite**
   - `cf24562`: test(11-08)

The ledger count is `git rev-list --count 76d493c..cf24562` = 3. Each of the three commits ends with the `Co-Authored-By: Claude Opus 5.5` trailer (checked with grep).

## TDD Gate Compliance

- **Task 1:** RED `f0b7f53` comes before GREEN `223ba95`.
  - **Web RED:** 2 of 279 failed, each on an assertion:
    - the parity case: the spec's `required` was `['actor', 'summary']`;
    - the hub link-rule case at `request-hub.test.tsx:52`: a link was rendered for a non-holder that had an href.
  - **Strapi RED:**
    - The test compile reported TS2305: `holderFor` was not yet exported. The tsconfig's `noEmitOnError: true` then blocked the emit, so the first node run executed stale JS (7/7 old tests). That run is not counted as RED evidence.
    - For real evidence, I emitted with `tsc -p tests/tsconfig.json --noEmitOnError false`, into the ignored `.tmp`.
    - That run had 4 of 11 failing:
      - `holderFor` test: `TypeError … is not a function`;
      - the table: `NEXT_ACTION_draft_requestor`;
      - the released read: `UNEXPECTED_OWNER_LIFECYCLE_HOLDER`;
      - the new submitted read: `UNEXPECTED_REQUESTOR_SUBMITTED_NEXT_ACTION`.
    - The closed-request case passed at RED by design, because it pins behaviour that already existed.
- **Tracer feedback gate (Task 1):**
  - The run was interactive, in end-of-phase mode, with an automated-only verify.
  - I re-ran the full verify against the committed tree: web 279/279 (12 files), `api:check` and typecheck clean, Strapi 11/11.
  - Task 2 started only after that.
- The plan is `type: execute`, so the plan-level `tdd-red-evidence` check was not run. The failures above come from the RED runs' own output.
- No refactor commit was needed.

## Test Counts

| Run | Result |
|---|---|
| Task 1 RED, web (`src/features/requests`, review workflow, parity) | 2 failed, 277 passed (279) |
| Task 1 RED, Strapi (two files, emitted with `--noEmitOnError false`) | 4 failed, 7 passed (11) |
| Task 1 GREEN, web (same paths) | 12 files, 279/279; typecheck clean; `api:check` exit 0 |
| Task 1 GREEN, Strapi (two files) | 11/11; `tsc` (src) and `tsc -p tests` clean |
| Task 1 GREEN, full web suite (before the GREEN commit) | 138 files, 2,974/2,974 |
| Tracer re-run of the plan's verify (committed tree) | exit 0: web 279/279, `api:check`, typecheck, Strapi 11/11 |
| Task 2 Playwright, the plan's spec (`requestor-request-workflow.spec.ts`) | **2 passed: desktop 1, mobile 1; 0 failed, 0 flaky, 0 skipped; 2.0 min**. Afterwards `git status --short` showed only my uncommitted spec edit and the three operator items |
| **Full Strapi suite** (`pnpm --dir apps/backend test`) | **676/676, 0 skipped, 13 min 16 s** (07:40:26Z to 07:53:42Z) |
| `served-operations:write`, check mode (dev servers stopped) | 8/8; `docs/references/served-operations.json` unchanged |
| `lint` | clean |
| **Full Playwright suite** (`pnpm --dir apps/csrm test:e2e`, production build) | **113 passed: desktop 98, mobile 15; 0 failed, 0 flaky, 0 skipped; 15.0 min** (08:01:28Z to 08:16:31Z). Afterwards `git status --short` showed only the three operator items |

- **Playwright evidence.** The plan names one spec, run first. The hub's sentences render on pages other specs visit, so the full suite was run as well. Neither run changed a file.
- **Servers.** Before every Strapi, served-operations and Playwright run, `netstat -ano | grep -E ':(1337|3000) .*LISTENING'` printed nothing.
- **`schema.d.ts`.** The contract changed, so the file was staged with the spec before `api:check` and committed with it in `223ba95`. After that, `git update-index --refresh` left it clean.

## Files Created/Modified

- **Strapi**
  - `request-lifecycle.ts`: `holderFor`, the holder map, `RequestHolder`, the exported `LifecycleKey`, the §6.1 sentences and `nextAction.holder`.
- **Strapi tests**
  - `request-lifecycle.unit.test.ts`:
    - the eight-step, two-viewer table, with fixtures that derive each step and are checked by `currentKey`;
    - the `holderFor` map;
    - the closed request.
  - `request-workflow.integration.test.ts`: holder and the analyst sentence on the released read, and the new submitted-request read for both identities.
- **Contract:** `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`.
- **Web**
  - `request-domain.ts`: the vocabulary and the type.
  - `request-schema.ts`: the closed parser.
  - `request-hub.tsx`: the link rule.
- **Web tests**
  - The plan's cases:
    - `request-hub.test.tsx`: the link-rule case, and the analyst-side §6.1 sentence as plain text;
    - `request-lifecycle-stepper.test.tsx`: a §6.1 fixture;
    - `contract-response-parity.test.ts`: the holder parse, missing and unknown.
  - Fixtures updated outside the list:
    - `request-domain.test.ts`: the retired sentence becomes §6.1 sentences with holder;
    - `assessment-review-workflow.test.tsx`: `holder: 'analyst'` on three analyst-held fixtures, so their expected links still render under the holder rule.
- **E2E:** `requestor-request-workflow.spec.ts` (`UX08_NEXT_ACTION_NAMES_HOLDER`).

## Decisions Made

- **The link comes from facts, never words.** `holder === actor` plus an href is the whole rule. A non-holder's line is text even when an href is present, which the hub test proves with a deliberately stray href (T-11-23).
- **The page override obeys the same rule.** `hrefs.nextAction` is gated by holder too. No production page passes it today, so nothing visible changes.
- **The key type is exported.** `LifecycleKey` is exported beside `holderFor`, so plan 11-10's equivalence test can iterate the keys with their type.
- **The spec describes both fields.** `actor` is the viewer the sentence is written for. `holder` is who holds the step, and a client links only when the two match. Phase 13 can then change the sentence to the assignee's name with no web change (D-21).
- **A fresh request for the integration proof.** The new integration case creates and submits its own request instead of reusing the memoised `seedRequestWorkflowFixtures().requests.submitted`, which other tests in the file can move on.
- **UX-08 stays open.** `requirements.ready-ids` reports 0/1 ready, because later Phase 11 plans also declare it. REQUIREMENTS.md is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3: blocking] Two test files outside the plan's list held the old next-action shape**
- **Found during:** Task 1, RED (the pre-GREEN grep the orchestrator asked for)
- **Issue:**
  - `request-domain.test.ts` quoted "The work is waiting with the other party." in three places.
  - `assessment-review-workflow.test.tsx` had three analyst-held fixtures with no `holder`. Under the new rule, their expected links would not render.
- **Fix:**
  - The domain test now uses §6.1 sentences with `holder`.
  - The review workflow fixtures gained `holder: 'analyst'`.
  - No assertion's intent changed.
- **Committed in:** `f0b7f53`

**2. [Acceptance grep] "other party" appears in regulatory control text**
- **Found during:** Task 1, acceptance check
- **Issue:** `grep -rn "other party" apps/backend/src apps/csrm/src | grep -v "\.test\."` prints three lines from imported standards catalogues:
  - `bootstrap/controls/apra-cps-230-2026.json` lines 103 and 188 ("another party");
  - `bootstrap/controls/asd-ism-controls-2026.06.18.json` line 3831 ("any other party").
- **Resolution:** These are statements quoted from APRA CPS 230 and the ASD ISM. They are not product copy, and changing them would misquote the standards. No code, sentence or comment in `src` uses the phrase. My own first-draft comment did, and I reworded it to "whoever waits" before committing. The criterion's intent holds.

**3. [RED method] Strapi RED needed an emit despite the type error**
- `noEmitOnError: true` in `apps/backend/tsconfig.json` blocks the emit when the test imports the not-yet-exported `holderFor`.
- I took the RED evidence from a `--noEmitOnError false` emit into the ignored `.tmp/tests-dist`, as recorded under TDD Gate Compliance. No config changed.

---

**Total deviations:**
- One blocking fixture update
- One acceptance-grep conflict recorded with evidence
- One RED method note

**Impact on plan:** No added scope.
- No content type, Function, FunctionAPI, role, route or dependency changed (D-01, D-02, T-11-SC).
- A Requestor's sentences name no record, and they carry no href at any analyst-held step. The unit table asserts both (T-11-06).

## Issues Encountered

- **Line endings.** A `sed -i` on `request-lifecycle.ts` turned its CRLF working copy to LF. I rewrote it with CRLF before staging, so Git saw only the content change. Other files kept their own line endings. Git printed its usual LF-to-CRLF warnings.
- **Production server log noise.** The full Playwright run logged 126 `The destination stream closed early` messages and one `failed-to-find-server-action`. 11-07 logged 43 and 1. Every test passed. The messages come from the Next production server's streaming. No test asserts on them, and this plan changed no streaming code.
- **Stat cache.** `git update-index --refresh` reports "needs update" for the operator's two `apps/backend/types/generated/*.d.ts` files. They stay untouched and unstaged.

## Known Stubs

None. Every sentence is served by Strapi, and "the Security Analyst" is the intended placeholder for the assignee's name until Phase 13 (D-21). It is not a stub.

## Threat Flags

None. There is no new endpoint, route or grant. The one new field, `holder`, is a step-derived fact identical for both viewers, so it discloses nothing the step itself does not. It is in the plan's threat model (T-11-06, T-11-23).

## User Setup Required

None.

## Next Phase Readiness

- Ready for 11-09: the phone stepper can render `Next action:` from the same served `holder`, `actor` and `href`, with the same link rule.
- Plan 11-10's SQL "waiting on me" predicate can be proved equal to `holderFor` over `REQUEST_LIFECYCLE_STEPS`.
- My requests and both Homes (11-10 to 11-12) can read `holder` from the lifecycle without any new contract change.

## Self-Check: PASSED

- Commits `f0b7f53`, `223ba95` and `cf24562` exist on `post-demo`, and each carries the trailer.
- Task 1 acceptance criteria re-ran:
  - `request-lifecycle.ts` exports `holderFor` and contains the submitted sentence: PASS.
  - The spec's `required` is `['actor', 'holder', 'summary']`: PASS.
  - The verify exited 0, twice: PASS.
  - The "other party" grep: see deviation 2 (only regulatory control text).
- Task 2 acceptance criteria re-ran PASS:
  - The spec file contains `UX08_NEXT_ACTION_NAMES_HOLDER`.
  - The Strapi suite passed in full (676/676), and the tree was clean.
- The plan's verification passed:
  - `api:check` is clean, the parity guard passes, and the web suite (2,974/2,974) and typecheck pass.
  - The full Strapi suite passes.
  - `requestor-request-workflow.spec.ts` and the full Playwright suite pass in both projects, with the tree clean afterwards.

---
*Phase: 11-navigation-landing-and-list-clarity*
*Completed: 2026-10-03*
