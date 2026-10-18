# Phase 13 Plan Check

## Iteration 3 (fresh check, 2026-10-09)

**Verdict after round 3:** no blockers and no warnings remain; the advisories are recorded below. The 19 plans can be executed against the tree at Phase 12's close: HEAD `7d889a3`, plus the other worker's `ab23681` and `0156e81`, which touch Phase 12 files only. The check ran no application server, test suite or browser suite.

**`PHASE_13_BASE`** is this check's own commit (`docs(13): revise Phase 13's plans from the fresh check against today's code`), the HEAD before any Phase 13 code, as `7e4fa02` was for Phase 12. The orchestrator gives its SHA to the 13-01 executor, `13-01-SUMMARY.md` records it on its own line, and STATE.md carries it from the start of execution. 13-07's and 13-19's checks read it from that summary.

### Round 1 — fresh check against HEAD `7d889a3`

Method: six `gsd-plan-checker` lanes ran in parallel (13-01 to 13-03; 13-04 to 13-06; 13-07 to 13-10; 13-11 to 13-14; 13-15 to 13-19; and a phase-wide lane for coverage, dependencies, cross-plan contracts, validation and compliance). Each lane compared every file, symbol, route, schema, catalogue entry, matrix row, test, copy string and budget a plan assumes from Phases 10 to 12 with the tree at Phase 12's close. The orchestrator re-checked the key evidence in the tree. The deterministic probes were clean: `verify-command-paths` reported 48/48 not applicable, `verify-failure-directions` 48/48 ok, and `verify.plan-structure` found all 19 plans valid. The structure check's only warnings are the one-way-door notes on 13-03 and 13-05, which are gated by the 13-01 and 13-02 checkpoints in the same way 12-04 was.

| Severity | Plan | Evidence / required property | Fix |
| --- | --- | --- | --- |
| BLOCKER | all 19, VALIDATION | The shared hard rule, 43 `<automated>` commands and 13-VALIDATION's Node row hard-code `/c/ProgramData/nvm/v24.19.0`. `.planning/PROJECT.md` ("Portable briefs and prompts") makes host values variables. | Phase 12's portable Node 24.19+ and pnpm check (P-1). |
| BLOCKER | 13-19 | Task 2 restarts the dev servers "on `post-demo`". Plans may not name a branch. A local `post-demo` branch exists, and it is not the working branch. | The gate commit on the branch checked out in the working tree (P-2). |
| BLOCKER | 13-01, 13-02 | Neither contract-gap record names the workstreams that read the content type or states backward compatibility (PROJECT.md "The shared backend"). Phase 12's approved record has `## Affected Workstreams`. | Add the section, naming `csrm` and every change to an existing endpoint (R-1). |
| BLOCKER | 13-03 (13-04, 13-06) | `authorization-matrix.integration.test.ts:181-196` requires every `HUMAN_ANALYST_ONLY_OPERATIONS` literal to be served, to have a matrix row, and to match the exact count `12 + insightOperations.size`. 13-03 adds three literals, but only one is served in 13-03, and it leaves the count unchanged. | Each plan adds its own literal when it mounts the handler, and the count goes 13, 14, 15 (A-1). |
| BLOCKER | 13-06 | The D-20 refusal fires on any `requestStatus`. T-08-A2 (`authorization.integration.test.ts:727-732`) expects 400 for an analyst's `approved` and `risk-assessment-drafted` on another person's draft. | Refuse only `requestStatus === "submitted"` (D-1). |
| BLOCKER | 13-08 (13-09, 13-10) | The mobile project (`playwright.config.ts:191-205`) runs an allowlist of specs and greps `@journey`. The new `request-pick-up.spec.ts` and `request-notes.spec.ts` are not on the allowlist, so every 375 proof would run at 1440 only. | 13-08 and 13-10 add their spec to the mobile `testMatch`, and the 375 tests are tagged `@journey` (F-1). |
| BLOCKER | 13-08 | The narrowed paths that cite "D-27, Phase 13" are in `assessment-service.ts:134-157`, not in `contract-response-parity.test.ts`. The grep that is meant to fail before the work already passes today. | Edit and grep `assessment-service.ts` (F-2). |
| BLOCKER | 13-08 | When the grandfathering is removed, the spec must bound every field the job parsers bound (`jobId`, `requestId`, `providerName`, `providerVersion`, `questionnaireId`). The plan bounds `jobId` only. | Declare every bound (F-3). |
| BLOCKER | 13-08 | `! grep -rq "Only the Security Analyst who started it can retry it." apps/csrm/src` also scans test files, which keep the literal in absence assertions, so the check fails when the work is right. | Scan shipped modules only (F-4). |
| BLOCKER | 13-13 | The new route `(app)/app/review/assigned` must be classified in `zod-client-boundary.test.ts:182-185`, which the plan neither edits nor runs. | Add the entry and run the guard (K-1). |
| BLOCKER | 13-13 | The 'use client' shell navigation imports `navigation.ts`, so the new item reaches every route's first load. `/app/risks/{documentId}` had 406 bytes of headroom, and the plan never measures it. | Measure with `performance.spec.ts`, record the figure, and name a fallback with no budget override (K-2). |
| BLOCKER | 13-14 | The `DashboardReviewQueue` fixtures in `figure-link-audit.test.ts:143-144` and `:293-294` would fail typecheck. `analyst-insights.spec.ts:630` and `design-system-conformance.spec.ts:234` assert six widget links, and the plan adds five. | Update the fixtures and both assertions, and run them (L-1). |
| BLOCKER | 13-15 | Two more e2e assertions of the old `submitted` holder sentence exist: `navigation-and-home.spec.ts:237` and `request-relationship-states.spec.ts:275`. The plan names neither, so the 13-19 gate would go red. | Change both, and make the acceptance a check across the e2e tree (N-1). |
| BLOCKER | 13-17 | The strict web parser `ai-generation-facts-schema.ts` does not list the newly required `aiInputsChanged` field, so every analyst questionnaire and assessment read would be rejected. | Add that parser to the plan (Q-1). |
| BLOCKER (raised by the orchestrator) | 13-18 | The new copy functions go into `ai-assistance-domain.ts`, which `risk-editor.tsx` imports. That puts them on `/app/risks/{documentId}`, which has 406 bytes of headroom. Also, `AiInputsChangedBlock` ships as client JS because every importer is 'use client'. | Move the copy to a module outside the Risk route's import graph and record both routes' figures (S-1). |
| WARNING | 13-01, 13-02 | Task 3 would overwrite an approval that the pilot writes. | Verify the approval and leave it unchanged (R-2). |
| WARNING | 13-03, 13-05, 13-06 | The new reasons go into only one of the two conflict response schemas that the guards compare. | Add them to both schemas (A-2). |
| WARNING | 13-03 to 13-05 | The new Functions are granted through `roleIds` only. The seeder and the catalogue test read the role's `functionIds`. | Grant through both (A-3). |
| WARNING | 13-03 (13-06) | The human-only refusal falls back to the questionnaire-governance sentence. | Each operation gets its own sentence (A-4). |
| WARNING | 13-03 | The lock note leaves out CR-101's row locks and `lockAssessmentRequest`. | One lock order, and never nested (A-5). |
| WARNING | 13-03, 13-05 | The plans don't say how the generated Strapi types are handled. | Use the UID cast pattern, and regenerate the types in a separate commit (the `a775a21` precedent) (A-7). |
| WARNING | 13-04 | `server-client.ts` is missing from the plan's files, and "any 4xx" breaks the rule that a 400 carries no reason. | Widen to 403 and 409 only (B-1). |
| WARNING | 13-05 | The plan forbids `createCoreRouter`, but its own precedent uses `{ only: [] }`. | Resolve the conflict (C-1). |
| WARNING | 13-06 | The delete guard counts notes outside `withRequestLock`. | Run it inside the lock (D-2). |
| WARNING | 13-07 | `app-shell.spec.ts` runs only in the desktop project. | Loop `setViewportSize` (E-1). |
| WARNING | 13-08 | Card polling still reads `canRetry` as "started by the viewer", and `AssessmentDraftJob` is a `oneOf`. | Key polling on `initiatedByViewer`, and update every variant (F-5). |
| WARNING | 13-09 | The plan ignores the X-14 helper `successToast` and the existing `Session.identityKey`. | Reuse both (G-1, G-2). |
| WARNING | 13-10 | The plan adds client notes components to `/app/requests/{documentId}` without measuring the route. | Measure it, or lazy-load the components (H-1). |
| WARNING | 13-13 | The plan leaves out `mobile-navigation.test.tsx` count assertions and the hand-written route guards. | List them (K-3, K-4). |
| WARNING | 13-14 | `UX08_ANALYST_PHONE_FIRST_SCREEN` is not rerun, and the plan uses `supporting`, not `supportingText`, and ignores the KPI count. | Run the test and name the fields (L-2). |
| WARNING | 13-15 | The plan wrongly assumes the Requestor Home already reads the status summary. | Add the fifth read (N-2). |
| WARNING | 13-16 | The `notes` section kind already exists, and `promptDataTag` cannot emit attributes. | Describe both as they are today, and fix one markup (O-1, O-2). |
| WARNING | 13-17 | The assessment's baseline run comes from its `aiProvenance`, not from a query. | Use the same `runId` the read serves (Q-2). |
| WARNING | 13-19 | The plan does not handle the known flaky mobile pixel check or a `COVERAGE.md` record. | State how both are handled (T-1, T-2). |
| INFO | several | Line-number drift, wording, the trivially true criterion in 13-12, `UserRoundCheckIcon`, the D-34 citation, the guarded `update-index`, the v2 summary bound, `inactiveAnalyst`, copy-guard directories, and the scope estimates (14 plans over the 100k smart zone, low confidence). | Applied where they fell on an edited line; the rest are recorded under "Advisories". |

### Round 2 — after the minimal revision

Method: four `gsd-planner` revisions ran in parallel, each owning one plan group (13-01 to 13-04, 13-05 to 13-08, 13-09 to 13-14, 13-15 to 13-19). A single-owner pass then synced 13-VALIDATION.md and made two cross-plan edits. Three `gsd-plan-checker` lanes re-checked every round-1 property against the revised text and today's tree, and looked for defects the revision itself introduced. After the revision, all 19 plans are valid (`verify.plan-structure`), all 48 `<automated>` commands pass `bash -n`, both probes report 48/48, and no plan or validation file names `ProgramData`, `post-demo` or an absolute checkout path.

| Round-1 blocker | Resolution (verified in round 2) |
| --- | --- |
| Host Node path (all plans, VALIDATION) | Phase 12's portable Node 24.19+ and pnpm check is in every hard-rule bullet, in each of the 43 prefixed commands and in the VALIDATION Node row. |
| Branch named (13-19) | Replaced by "the branch checked out in the working tree (`git branch --show-current`)" at the gate commit. |
| Affected workstreams (13-01, 13-02) | Each record has `## Affected Workstreams` before `## Migration`. 13-01 names `csrm` and every change to an existing endpoint: the populate narrowing (D-04, 13-04), the additive fields, the job access and the `canRetry` meaning (D-18, 13-08), and the submit refusal (D-20, 13-06). 13-02 names `csrm`, `REQUEST_HAS_NOTES` (D-21, 13-06) and the 65,536-byte summary bound. Task 1's verify greps the heading. |
| Human-only literals (13-03, 13-04, 13-06) | Each plan adds its own literal in the task that serves the route, and lists the matrix test. The count literal goes 12 → 13 (13-03), → 14 (13-04), → 15 (13-06). |
| D-20 scope (13-06) | Refused only when `requestStatus === "submitted"` and the actor is not the requestor. Other statuses keep today's 400, and T-08-A2 is not edited. |
| Mobile proofs (13-08 to 13-14) | 13-08 adds `request-pick-up.spec.ts` and 13-10 adds `request-notes.spec.ts` to the mobile `testMatch`. Tests meant for 375 carry `@journey`. Each Task 3 first proves with `playwright test --list --project mobile` that its tests run at 375 (list mode starts no web server in Playwright 1.58.2). |
| Narrowed paths, bounds and grep (13-08) | `assessment-service.ts` is in the files and its six paths are removed. The spec bounds every field the job parsers bound, checked by `node -e`. The retired-sentence grep excludes tests. |
| Zod boundary (13-13) | The `/app/review/assigned` entry is added and the guard runs in Task 1. |
| Shell budget (13-13, and 13-09 by extension) | The desktop performance spec runs and records `/app/risks/{documentId}`. Each plan names a source fallback, never an override (13-13: count meanings resolved on the server; 13-09: the beforeunload-only warning as its own hook module). |
| Dashboard consumers (13-14) | The `figure-link-audit.test.ts` fixtures carry the new fields. Both six-link assertions become 11. `design-system-conformance.spec.ts` is edited and run. |
| Holder sentence (13-15) | `navigation-and-home.spec.ts` is added. A check across the e2e tree runs first, and the planner fixed the new column's header and `nth` assertions in `review-lists.spec.ts`. |
| Strict facts parser (13-17) | `ai-generation-facts-schema.ts` gains the required, nullable, closed `aiInputsChanged`, with its boundary entry and fixtures. |
| Risk route bytes (13-18) | The signal block renders on the server and passes as a slot. Its copy lives in `ai-inputs-changed.tsx` and the lazy sheet, and nothing is added to `ai-assistance-domain.ts`. Importer checks enforce this. The performance spec records the editor and Risk route figures, and a verify line proves no 13-18 commit touches `performance.spec.ts`. |

Every round-1 warning was also resolved: the approval Task 3s keep a pilot-written approval, both conflict schemas are updated, grants are written both ways, each capability has its own refusal sentence, the lock order is stated, generated types are handled, the transport keeps the reason on 403 and 409 only, the no-router departure is stated, the delete guard runs under the lock, the app-shell loops 375, card polling keys on `initiatedByViewer`, `successToast` and `identityKey` are reused, the notes routes are measured, the count tests and route guards are listed, the first-screen proof reruns, the fifth Requestor Home read is added, the existing `notes` kind is reused with the `answer.*` value form, the assessment baseline comes from `aiProvenance`, the flaky-check procedure is stated, and `COVERAGE.md` is recorded.

Round 2 found 0 blockers, 2 warnings and 4 info:
- **Warning, 13-08:** the parity backlog count read "39 at HEAD `7d889a3`"; the test asserts 41 today.
- **Warning, 13-15 (new, from the revision):** `review-lists.spec.ts:221` `UX09_MY_REQUESTS_ROW_HOLDER` also reads cell `nth(3)`.
- **Info, 13-06:** three `<fails_when>` lines lacked the Node clause.
- **Info, 13-19:** said the known check failed "under load", but `0156e81` records the cause as data.
- **Info, 13-09:** `toast-action.ts` duplicates the three-line `toastAction`; this is accepted.
- **Info:** the list-mode check's soundness was confirmed.

### Round 3 — after the micro-revision

A `gsd-planner` micro-revision fixed the two warnings and two of the infos. The orchestrator verified each fix by reading the changed lines:
- 13-08-PLAN.md:214 now reads "the backlog count assertion falls from 41 to 39 (41 at HEAD `7d889a3`)", and line 111 agrees.
- 13-15 moves `UX09_MY_REQUESTS_ROW_HOLDER` with `UX09_MY_REQUESTS_NEXT_STEP` from `nth(3)` to `nth(4)`. The change appears in Task 3's action, its acceptance, the artifacts and the summary list, and in rows 13-15-03 and "Existing specs touched".
- 13-06 Tasks 1 to 3 name the Node and pnpm failure in `<fails_when>`.
- 13-19:112 and row 13-19-01 call the known check "the check fixed in `ab23681`, whose cause `0156e81` records as data, not load".

No `<automated>` command changed in round 3. After it, all 19 plans are valid, all 48 commands pass `bash -n`, both probes report 48/48, and no host path or branch name appears in a plan or in 13-VALIDATION.md.

### Orchestrator decisions in this check

- **Accepted planner-found defect (NEW-1).** `authorization.integration.test.ts:247-256` maps every `CSRM_ASSESSMENT_REQUEST_OPERATIONS` value to the core, delete or revert Function. The assignment operations therefore live in a separate `CSRM_REQUEST_ASSIGNMENT_OPERATIONS` export (13-03, 13-04).
- **Raised from warning to blocker.** 13-18's copy in `ai-assistance-domain.ts` would ride in `/app/risks/{documentId}`'s client graph, and that route budget is the pilot's watched seam.
- **Accepted routes that differ from the hints:**
  - 13-05 keeps no core router: a stated departure under D-02, and Strapi's API loader mounts only `routes/` files.
  - 13-09 copies `toastAction` into a new `components/ui/toast-action.ts` instead of lifting it from `use-ai-decisions.ts`, which sits in the Risk route's graph.
  - 13-16 writes each note as the constant-labelled values `note.part`, `note.sequence` and `note.body` (the `answer.*` precedent), never as a `<note>` tag.
  - 13-18 keeps the block server-rendered by passing it as a slot.
  - 13-03 places the assignment refusal sentence in Task 2, with its unit case.
- **Generated Strapi types.** After 13-03 and 13-05, the regenerated `types/generated/contentTypes.d.ts` is its own `chore(backend)` commit, following the `a775a21` precedent. It is made by whoever next starts a development Strapi with both Keycloak flags false. Executors never stage it.
- **Person parsers.** They mirror `ActiveUserSummary`, which declares no bounds (the `assessmentRiskPersonSchema` pattern), so nothing joins `boundaryGrandfathered`.

### Advisories (recorded, no revision)

- **Scope.** Fourteen plans are over the 100k smart zone (`estimate-check --calibrated --ws csrm`, confidence low):
  - within budget: 13-01 60k, 13-02 50k, 13-07 90k, 13-19 90k;
  - over budget: 13-14 150k; 13-11 and 13-13 170k; 13-16 and 13-17 190k; 13-06, 13-09, 13-10 and 13-18 200k; 13-04 and 13-08 210k; 13-12 and 13-15 220k; 13-03 and 13-05 230k.

  The scope notes record the reasons (an accepted pacing rule). Slice tracer and expansion work if a plan nears the context limit.
- **`/app/risks/{documentId}` headroom** is about 400 bytes (299,598 bytes in today's ignored baseline). 13-09 and 13-13 measure it before the shell changes land, and a source fallback is the only allowed remedy.
- **One-way doors.** `verify.plan-structure` warns about them on 13-03 and 13-05. They are gated by the 13-01 and 13-02 approval checkpoints, as 12-04 was.
- **Infos left as they are:**
  - 13-15 `ownRequestorId` is exported from `services/my-requests.ts` (N-3).
  - 13-16: `schemaVersion` widens to `1|2`, and the web literal is at `ai-assistance-schema.ts:15` (O-3).
  - The copy guard's `guardedDirectories` (G-4).
  - 13-10 must_haves still hold the picker truths (H-2).
  - 13-13 names `UserRoundCheck` where the code uses `UserRoundCheckIcon` (K-5, applied in 13-14).
  - 13-12's criterion about "Requires my attention" is trivially true (M-1).
  - Some line references in 13-14 have drifted (L-3).
  - `toast-action.ts` should be consolidated with `use-ai-decisions.ts` once the Risk route's budget allows.

### Checks that pass

- **Plans and probes.** There are 19 plans with 51 tasks: 48 automated and 3 blocking-human checkpoints. All are valid, and every command passes `bash -n` and both probes.
- **Coverage.** Every task has a covering task for:
  - REQ-08 and COLLAB-01 with all their criteria;
  - ROADMAP success criteria 1 to 5;
  - UAT-013 and UAT-014;
  - D-01 to D-34.

  The dependency graph is acyclic, and waves 1 to 18 match the ROADMAP.
- **Code references.** Every file, symbol, route, schema, catalogue entry, matrix row, test, copy string and budget the plans rely on from Phases 10 to 12 was checked against today's tree. Each one exists, or an earlier Phase 13 task creates it.
- **Contract gate.**
  - Two records carry `## Affected Workstreams`.
  - Each record ends at a blocking-human approval checkpoint.
  - 13-03 and 13-05 check the dated approval before any schema file changes.
  - The 13-19 freeze check lists exactly the three approved schema files.
- **AGENTS.md and PROJECT.md.**
  - Strapi stays the API boundary, with the typed API layer and Server Actions only.
  - Record-level authorisation happens in Strapi against the resolved IdamBox User, never branching on the auth mode.
  - The human-only grants are held twice.
  - AI stays advisory, and the deterministic provider runs in every suite.
  - Keycloak and its flags are unchanged, and the second analyst has no fixture subject.
  - No new dependency, host path or branch name is introduced.
  - The tree is clean after Playwright.
- **13-VALIDATION.md** is synced with the revised plans: 51 rows, the portable Node row, and `nyquist_compliant: true`.

---

## Iteration 2 (2026-10-01)

## VERIFICATION PASSED

**Phase:** 13 (Request pick-up and notes)
**Plans verified:** 19 (13-01 to 13-19)
**Issues:** 0 blockers, 0 warnings, 0 info

### Probes
- verify-command-paths 13: not_applicable for all 48 runnable commands (no unresolvable target).
- verify-failure-directions 13: ok for 48 of 48 (the 3 checkpoints carry none, as expected).

### Iteration 1 issues, confirmed resolved
- **Blocker 1 (13-VALIDATION.md out of step with the plans): resolved.** The file is rebuilt from the 19 plans. It has 51 per-task rows (13-01-01 to 13-19-03; 48 automated, 3 manual checkpoints), a plan-numbering table mapping the 13 outline plans to 13-01 to 13-19, and a sampling rate that names the Strapi-editing plans and the closing task of each. It lists the targeted Playwright specs per plan (13-07 to 13-15, 13-18), including the existing specs the plans change. The gate is 13-19, Wave 0 owners are corrected, and `nyquist_compliant: true` is set with the sign-off ticked. `status: draft` and `wave_0_complete: false` are correct before execution.
- **Warning 1 (scope above 15 files): resolved with recorded notes (rule 3a).** All 14 plans named in iteration 1 (13-03, 04, 05, 06, 08, 09, 10, 12, 13, 14, 15, 16, 17, 18) carry a scope note that names the contract-chain files inflating the count. The pilot's pacing rule accepts this.
- **Info 1 (proposed copy not in the UI-SPEC): resolved.** 13-UI-SPEC §9.5 holds the NOTES_LIMIT_REACHED line and §10.4 holds the AI-mark 409 line, both verbatim as 13-05 and 13-06 propose and dated with the plan that added them.

### Unchanged passes (from iteration 1)
Requirement coverage (REQ-08 and COLLAB-01, all criteria, success criteria 1 to 5, UAT-013 and UAT-014, D-01 to D-34), an acyclic dependency graph with consistent waves, the contract-gap gate with approval checkpoints, the negative authorisation cases in the API and the UI, the seams for Phases 15, 17 and 17.1, dev-mode and non-negotiable compliance, the clean tree after Playwright, and the written-ahead notes. No pre-rename app path appears in any phase file.

### Structured Issues
```yaml
issues: []
```

### Recommendation
Plans verified. Ready for execution in Stage 3 (re-check before execution, as the written-ahead rule requires).

---

## Iteration 1 (summary)
ISSUES FOUND: 1 blocker, 1 warning and 1 info.
- **Blocker:** 13-VALIDATION.md was still seeded from the 13-plan research outline: 13 rows against 51 tasks, wrong numbering, wrong Wave 0 owners and gate plan, and `nyquist_compliant: false`.
- **Warning:** 14 plans above 15 files had no accepted-budget note.
- **Info:** two proposed copy lines were not yet in 13-UI-SPEC §9.5 and §10.4.

All other dimensions passed.
