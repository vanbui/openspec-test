# Phase 14 Plan Check

## Iteration 2 (fresh check, 2026-10-10)

**Verdict after round 2:** no blockers and no warnings remain; I-2 is recorded as an advisory. The 17 plans can be executed against the tree at Phase 13's close (HEAD `0e04b71`). Round 1 found 4 blockers and 5 warnings, and one minimal `gsd-planner` revision resolved them all. No redesign was needed: the dependency chain (one linear chain, waves 1 to 17), COLLAB-02 and ROADMAP success criteria 1 to 5 hold. The check ran no application server, test suite or browser suite.

**`PHASE_14_BASE`** is the HEAD before any Phase 14 code: this check's revision commit (`docs(14): revise Phase 14's plans from the fresh check against today's code`), as `PHASE_13_BASE` was for Phase 13. STATE.md records its SHA, and the orchestrator gives it to the 14-01 executor, whose summary records it on its own line.

### Round 1 — fresh check against HEAD `0e04b71`

Method: the usage budget was nearly spent (Weekly · all models at 93%), so one `gsd-plan-checker` checked all 17 plans against the tree at Phase 13's close, and the orchestrator then verified each finding in the tree and probed the classes the checker did not cover exhaustively (both conflict schemas, grants, strict parsers, the parity backlog, Phase 13 renames, existing assertions). The deterministic probes were clean: `verify plan-structure` found all 17 plans valid, and `check verify-command-paths 14` and `check verify-failure-directions 14` each reported 0 blockers over 46 commands. A path probe found that every repository path the plans cite exists today or is created by a Phase 14 plan.

| ID | Severity | Plan | Evidence | Required fix |
| --- | --- | --- | --- | --- |
| P-1 | BLOCKER | all 17, VALIDATION | The shared hard rule, every `<automated>` command and 14-VALIDATION's Node row hard-code `/c/ProgramData/nvm/v24.19.0` (187 occurrences: 14-01 3, 14-02 9, 14-03 12, 14-04 12, 14-05 9, 14-06 12, 14-07 12, 14-08 12, 14-09 12, 14-10 12, 14-11 9, 14-12 12, 14-13 12, 14-14 12, 14-15 9, 14-16 9, 14-17 9, VALIDATION 1). `.planning/PROJECT.md` ("Portable briefs and prompts") makes host values variables. | Phase 13's portable Node 24.19+ and pnpm check: the hard-rule bullet text and the `node -e "…major !== 24 \|\| minor < 19…" && pnpm --version >/dev/null && ` prefix (13-VALIDATION's Node row). |
| R-1 | BLOCKER | 14-01 | Task 2's spec for `docs/contract-gaps/phase-14-request-attachments.md` has no `## Affected Workstreams` section (PROJECT.md "The shared backend"; Phase 13's approved records carry it). Task 4 writes the approval line itself, but the pilot writes the approval into the record (worker rules, G-6; Phase 13 R-2). | Add the section to Task 2's spec and acceptance: it names `csrm` and says existing endpoints and grants stay backward compatible, listing each change to an existing endpoint (the request read's `attachments` summary, 14-08; `REQUEST_HAS_ATTACHMENTS` on request delete, 14-08; the analyst questionnaire and assessment reads' `assessmentRequest.files`, 14-11; `AiInputsChanged.files` on `AiGenerationFacts` and on the request read's `RequestAiInputs`, 14-11; the unmounted upload-plugin content-API routes, 14-04). Task 4 verifies a pilot-written dated approval and leaves it unchanged; it writes nothing over it. |
| A-1 | BLOCKER | 14-09 | `apps/backend/tests/authorization-matrix.integration.test.ts:197` asserts `HUMAN_ANALYST_ONLY_OPERATIONS.length, 15 + insightOperations.size`, and `:200` requires every non-insight human-only operation as a string literal in `csrm-authorization.ts` (`HUMAN_ANALYST_GUARD_LITERAL_MISSING`). 14-09 Task 1 runs that test but never moves the literal, and adds the two operations as imported constants (`CSRM_REQUEST_ATTACHMENT_OPERATIONS.setAiInput`, `.getAiText`). Its own verify would fail. | In the task that mounts `setAiInput` and `getAiText`: write both as string literals in `HUMAN_ANALYST_ONLY_OPERATIONS` (the Phase 13 notes `ai_input` literal at `csrm-authorization.ts:78` is the precedent), move the count to `17 + insightOperations.size`, and add the test file to that task's files. |
| S-1 | BLOCKER (raised from the checker's warning by the orchestrator) | 14-11 | `aiInputsChanged()` returns `null` unless a note changed, and `count` counts notes only (`apps/backend/src/csrm/ai/ai-inputs-signal.ts:93-111`); 14-11 adds a closed `files` list without defining `count` or when the value is non-null. The strict web parser `aiInputsChangedSchema` (`apps/csrm/src/features/ai-assistance/ai-generation-facts-schema.ts:21-24`, `.strict()`, `notes` `.min(1)`), its `SameType` check against `AiInputsChanged` in `ai-assistance-domain.ts:119`, its reuse in `apps/csrm/src/features/requests/request-schema.ts:206-207`, the third producer (the request read controller `apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts`, serving `RequestAiInputs` on `GET /csrm-assessment-requests/{id}`), `apps/backend/tests/ai-inputs-signal.unit.test.ts` and the renderer `ai-inputs-changed.tsx` are not in 14-11. As written, every analyst read with a non-null signal would fail the strict parse, and a files-only change would show nothing. | Define the merged signal: `count` = notes changed + files changed; non-null when either list is non-empty; `notes` may be empty when `files` is not. Change the spec's `AiInputsChanged` once (both referencing schemas follow), every producer (both scope services and the request read controller), every parser and type (`ai-generation-facts-schema.ts`, `ai-assistance-domain.ts`, `request-schema.ts`), and the renderer and its test; add a files-only case and a notes-only regression case; list them all in 14-11's files and verify. |
| C-1 | WARNING | 14-06, 14-09 | The catalogue Functions are granted through `roleIds` only, but `apps/backend/src/bootstrap/seed-csrm-data.ts` and `contract-catalogue.integration.test.ts` read the role's `functionIds` (Phase 13 A-3). | Grant through both, in both catalogue copies (`cmp` stays silent). |
| E-1 | WARNING | 14-12 | 14-12 adds `request-attachments.spec.ts` to the mobile `testMatch` (`apps/csrm/playwright.config.ts:198-210`) and tags `@journey`, but never proves it runs at 375. | Add `playwright test --list --project mobile` filtered to the spec, failing on a count of 0 (Phase 13 F-1; list mode starts no web server). |
| B-1 | WARNING | 14-14, 14-15 | They add client code to the request routes; `/app/requests/{documentId}` has about 20 KB of headroom (279,835 of 300,000 bytes, STATE.md:316). Only 14-13 measures it. | Each measures the routes it changes with `performance.spec.ts`, records the figures, and names a source fallback (lazy split or server rendering), never a budget override. |
| Z-1 | WARNING | 14-11 | 14-11 changes web parsers but does not run `apps/csrm/src/lib/performance/zod-client-boundary.test.ts`. | Run it, and classify any new module. |
| G-1 | WARNING | 14-06 onward | The plans forbid staging `apps/backend/types/generated/*.d.ts` but do not say who regenerates them. | Orchestrator decision below; 14-06 states it in one line. |
| I-1 | INFO | all 17 | The "Written ahead … against `f26cdde`" preambles predate Phase 13's build. | Add "re-checked against `0e04b71`, Phase 13 built (2026-10-10)". |
| I-2 | INFO | 14-04 | Task read-firsts cite `apps/backend/node_modules/@strapi/{upload,provider-upload-local,core,utils}/dist/…`, which pnpm does not hoist there (they live under `node_modules/.pnpm/@strapi+<package>@5.51.0_*`). No plan imports these packages. | Advisory; the executor resolves them with `require.resolve`. |

### Round 2 — after the minimal revision

Method: one `gsd-planner` revision applied every round-1 fix, editing only the 17 plans and 14-VALIDATION.md (18 files, 172 insertions, 134 deletions). P-1 was applied by a substitution script that had been dry-run first. The orchestrator then re-checked the changed lines against the tree. After the revision, all 17 plans are valid (`verify plan-structure`), all 46 `<automated>` commands pass `bash -n`, both probes report 0 blockers over 46 commands, and no plan or validation file names `ProgramData`, a branch or an absolute checkout path. (`14-RESEARCH.md` keeps two historical mentions; it is reference material, not a command source.)

| Round-1 finding | Resolution (verified in round 2) |
| --- | --- |
| P-1 host Node path | All 187 occurrences are replaced by Phase 13's portable check: the hard-rule bullet in each plan, every `<automated>` prefix, and the VALIDATION Node row. |
| R-1 affected workstreams and approval | 14-01 Task 2's record spec lists `## Affected Workstreams` before `## Migration`. It names `csrm` as the only reading workstream, states backward compatibility (no core router, no inverse attribute, no changed attribute or grant, and the agent role gets neither Function), and lists the five changes to existing endpoints. The heading is in the grep-only verify and in `<fails_when>`. Task 4 keeps a pilot-written approval, and its verify accepts the dated status line. |
| A-1 matrix count and literals | 14-09 Task 1 writes `"PUT:…/attachments/{attachmentId}/ai_input"` and `"GET:…/attachments/{attachmentId}/ai_text"` as literals in `HUMAN_ANALYST_ONLY_OPERATIONS`, moves the count to `17 + insightOperations.size`, and lists `authorization-matrix.integration.test.ts`. The scope note goes from 19 to 20 files. |
| S-1 merged signal, Z-1 | 14-11 merges in `ai-inputs-signal.ts`, the module every producer reaches: the scope services call `loadAiInputsChanged` (`questionnaire-scope.ts:515`, `assessment-scope.ts:377`), and the request read controller calls the scope helpers (`csrm-assessment-request.ts:54,60`). `count` is notes plus files. The signal is non-null when either list is non-empty, and either list may be `[]`. The spec's one `AiInputsChanged` gains a required closed `files` of a new `AiInputsChangedFile`, and `notes` loses `minItems`. In `ai-generation-facts-schema.ts`, both lists stay strict and a refinement rejects a signal where both are empty. The `AiInputsChanged` type in `ai-assistance-domain.ts` changes, so `SameType` holds. `request-schema.ts` is checked. `ai-inputs-changed.tsx` gates on either list. The plan adds files-only and notes-only cases, gives Phase 13's fixtures `files: []`, and runs `zod-client-boundary.test.ts`. |
| C-1 grants | 14-06 and 14-09 grant each Function through its `roleIds` and through each role's `functionIds`, in both copies, and `cmp` stays silent. |
| E-1 mobile proof | 14-12 Task 1 runs `playwright test --list --project=mobile e2e/request-attachments.spec.ts` and greps a `@journey` test name before the e2e run. |
| B-1 route budgets | 14-14 Task 3 and 14-15 Task 2 run the desktop `performance.spec.ts` with `-g 'app/requests/.documentId. as the Requestor'`, which matches the generated title at `performance.spec.ts:395`. They record `deliveredJsBytes` against 300,000 and name a source fallback; no `ROUTE_BUDGET_OVERRIDES` entry is allowed. |
| G-1, I-1 | 14-06 states the generated-types rule. Each "Written ahead." paragraph says it was re-checked against `0e04b71`. |

Planner decisions accepted: the merge lives in `ai-inputs-signal.ts`, so the controller and `request-schema.ts` are listed to be checked but their logic does not change; `files` is required (not optional) in the served shape; `/app/requests/new` and `/app/requests/{documentId}/edit` have no key-route figure in `performance.spec.ts`, so the summaries say so; E-1 and B-1 sit in the last Playwright task of each plan.

### Orchestrator decisions in this check

- **S-1 raised to blocker.** The strict parser makes the defect certain, not likely: Phase 13's Q-1 was the same class.
- **Generated Strapi types (G-1).** As in Phase 13: executors never stage `apps/backend/types/generated/*.d.ts`; after 14-06's schema lands, the regenerated `contentTypes.d.ts` is its own `chore(backend)` commit (the `a775a21` precedent), made by whoever next starts a development Strapi with both Keycloak flags false.
- **The approval is the pilot's (R-1).** The pilot writes the dated approval into the record. 14-01 Task 4 reads the record first: when the pilot's approval is there, it runs the verify and changes nothing (Phase 13's 13-01 pattern); otherwise, on the pilot's `approved` answer, it writes only what is missing, never over a line the pilot wrote.

### Checks that pass

- **Structure and probes.** 17 valid plans; both probes report 0 blockers over 46 commands; no branch name or absolute checkout path appears in any plan or in 14-VALIDATION.md.
- **Phase 13 seams exist under the names the plans use.** `withRequestLock`, `canUseRequestNotes` (`request-notes-policy.ts:65`), `aiInputsChanged` and `AiInputsChangedBlock` (`ai-inputs-changed.tsx`, server-rendered), `AssessmentRequestLink`, `ai-provenance-header.tsx`, `request-notes.spec.ts` and `request-pick-up.spec.ts` on the mobile list.
- **Operations module.** The attachment operations get their own export, `CSRM_REQUEST_ATTACHMENT_OPERATIONS` in `apps/backend/src/api/csrm-request-attachment/operations.ts`, so `authorization.integration.test.ts`'s request-operations mapping is untouched (Phase 13 NEW-1). 14-06 to 14-09 each list `tests/fixtures/authorization-matrix.ts` for their own rows.
- **Refusal reasons.** 14-05 adds them to Strapi's list, to both `AssessmentWorkflowErrorResponse` and `QuestionnaireWorkflowErrorResponse` (the two schemas holding Phase 13's `REQUEST_HAS_NOTES`), and to the web's list.
- **Parity backlog.** `contract-response-parity.test.ts:1007` holds 39; no Phase 14 parser joins `boundaryGrandfathered`.
- **Contract gate.** 14-06 Task 1's precondition requires `Approved by the pilot on YYYY-MM-DD` before any schema change.
- **Dependencies.** Installed `@strapi/strapi` is 5.51.0; 14-02 pins `@strapi/provider-upload-aws-s3@5.51.0`, `unpdf@1.8.1` and `read-excel-file@9.3.10`, each justified, and checks `fflate` 0.8.3.
- **AGENTS.md.** Strapi stays the API boundary (routes behind `global::csrm-authorization` and `global::csrm-app-enabled`); the two AI Functions are human-analyst only and exclude the service agent; AI inclusion stays an analyst's opt-in; the new spec is the only new e2e file; the figure-link audit does not cover the request link.
- **Not covered exhaustively** (budget): every "fails before the work" grep and every existing assertion the new UI might move. The executors' RED steps and the 14-17 gate cover them.

## Iteration 1

**Result:** VERIFICATION PASSED (0 blockers, 0 warnings, 0 info)
**Plans checked:** 17 (14-01 to 14-17), one linear chain, waves 1 to 17.

### Deterministic probes
- `check verify-command-paths 14`: not_applicable (no unresolved targets).
- `check verify-failure-directions 14`: ok, 46 of 46 automated commands carry a stated failing direction.

### Coverage
| Requirement | Plans | Status |
|---|---|---|
| COLLAB-02 | 14-01 to 14-17 (all claim it) | Covered |

### Stage 2 section 3 gates
- Contract-gap record `docs/contract-gaps/phase-14-request-attachments.md` written in 14-01 Task 2, then a blocking `checkpoint:decision` (Task 3) and the approval written into the record (Task 4) before 14-02 onwards changes any schema.
- Dependencies: 14-02 adds exactly unpdf 1.8.1, read-excel-file 9.3.10 and @strapi/provider-upload-aws-s3 5.51.0, each justified in "Dependency justification" (D-32, G-7), installed only after approval.
- Settings: 14-03 documents every `CSRM_ATTACHMENT_*` setting commented in `apps/backend/.env.example` with development defaults (local storage, development scanner that fails boot outside development).
- Tests: API refusals for another Requestor, the service agent and a Phase 17 participant at upload, download, removal and AI-input routes (14-06 to 14-09); disallowed type, content mismatch, oversize and infected refusals with their reasons in API and Playwright (14-12 `COLLAB02_REFUSALS`); UI not-found state for another Requestor and participants (14-13).
- Playwright tasks check `git status --short` against the three operator items, with no restore step; every plan carries the clean-tree rule.
- Shared modules for Phase 19: the security event log (14-03), the file-transfer pattern and the shared XLSX reader (14-02/14-03).
- Two residuals (ISM-2059 quarantine reading; reverse-proxy per-path body limits under R-08-04) recorded in `docs/security/phase-08-residual-risks.md` by 14-17.
- No EICAR string in any plan: tests use `CSRM-TEST-MALWARE-SIGNATURE-7c1e4a`; every plan carries the guard `git grep -n -I "ANTIVIRUS-TEST" -- apps`.
- No pre-rename app paths in any phase file.
- Plans above 15 files (02, 03, 06, 07, 08, 09, 10, 12, 13, 15, 16) each carry a scope note, which the pacing rule accepts. `type="tracer"` tasks recognised.
- 14-11 `files_modified` matches Phase 13's 13-18 components: `ai-provenance-header.tsx` (+test) and `assessment-request-link.tsx` (created/edited by 13-18; exists today); 14-11 adds `assessment-request-link.test.tsx`, which is new and consistent.

### Dependencies
Acyclic, no forward references; waves equal max(deps)+1. 14-06 also depends on 14-01 (redundant but valid).

### Structured Issues
```yaml
issues: []
```

### Recommendation
Plans verified. Proceed to execution in Stage 3 after the re-check.
