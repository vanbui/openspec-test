# Phase 19 Plan Check

## Iteration 1

**Result:** ISSUES FOUND (0 blockers, 1 warning, 1 info)
**Plans checked:** 15 (19-01 to 19-15, linear waves 1 to 15)

### Probes
- verify-command-paths: not_applicable (no unresolvable targets).
- verify-failure-directions: ok (every automated command states its failing direction).

### Coverage
| Requirement | Plans | Status |
|---|---|---|
| CSV-01 | 14 plans | Covered |
| CSV-02 | 7 plans | Covered |
| CSV-03 | 4 plans (incl. 19-13) | Covered |

### Gate checks
- Contract records: 19-01 Task 1 writes `phase-19-exports-and-export-log.md` and `phase-19-import-tolerance.md`; Task 2 is a blocking `checkpoint:decision` (G-6); Task 3 writes approvals; no content-type change, and 19-15's gate asserts an empty content-type diff. Pass.
- Phase 14 reuse: 19-03 relies on 14-02's `zip-archive.ts` and `xlsx-reader.ts`, adds only the writer and a first-sheet read. Pass.
- One released-assessment read check (`released-assessment-read.ts`, 19-10) used by export, named in the record for Phase 17 to widen. Pass.
- `SERVICE_IDENTITY_REFUSED_OPERATIONS` generic, named in 19-01 and used across 19-02/05/07/08/09/10/14. Pass.
- Single-quote neutraliser with exact inverse (19-03). Pass.
- `write-excel-file@4.1.1` justified against D-12, Strapi only, apps/csrm package.json unchanged (19-03, gate in 19-15). Pass.
- Grants and refusals: 19-10 covers Requestor own released export, another Requestor 404, own unreleased 404, analyst unreleased 409, agent 403 on all export operations; UI and Playwright in 19-06/11/12/15. Pass.
- Playwright tree clean: 19-15 verify asserts `git status --short` limited to the operator items. Pass.
- No pre-rename app paths in any phase file. Pass.
- `type="tracer"` tasks recognised; each plan has 3 to 4 tasks.

### Warnings
**1. [scope_sanity] Every plan above 15 files carries a scope note**
- Plans: 19-06 (17 files), 19-07 (17 files)
- Evidence: 19-08 to 19-12, 19-14, 19-15 carry "Scope note:" lines; 19-06 and 19-07 do not.
- Example fix (non-binding): add a one-line scope note to each (per stage2-rules 3a, a recorded note, no re-split).

### Advisories
**1. [scope_sanity] Plans at 4 tasks are borderline**
- Several plans have 4 tasks; acceptable given the scope notes and tracer-first structure. No action needed.

### Structured Issues
```yaml
issues:
  - plan: "19-06, 19-07"
    dimension: scope_sanity
    severity: warning
    required_property: "Every plan above 15 files carries a scope note"
    description: "19-06 and 19-07 list 17 files_modified each with no 'Scope note:' line"
    fix_hint: "Add a recorded scope note to each plan"
  - plan: null
    dimension: scope_sanity
    severity: info
    required_property: "Plans stay within 2-3 tasks where practical"
    description: "Several plans have 4 tasks (tracer + 2-3 auto, or with checkpoint)"
    fix_hint: "None required"
```

### Recommendation
1 warning: address with recorded scope notes in 19-06 and 19-07; no re-planning.

---

## Orchestrator disposition (2026-10-01)

The warning (19-06 and 19-07, 17 files each, with no scope note) is settled the way this report prescribes: a scope note is recorded at the top of each plan's objective. Under the pilot's economy rule, no re-check runs. **Verdict: PASSED, iteration 1, with the warning settled by recorded notes.**

---

## Fresh pre-execution check (iteration 2, 2026-10-16)

**Base.** Checked against HEAD `bdd0f698`, the code at Phase 16's close, which already contains the IAM merge `d1518c5f`. The local `origin/iam` is one commit ahead (`f2c0c192`, which changes only `overlay-onto-bproton-dev-csrm.sh`, no backend path). `origin/main` is not ahead. Nothing was fetched.

PHASE_19_BASE=bdd0f698

**Method.** Three parallel `gsd-plan-checker` lanes ran against today's tree: lane A covered 19-01 to 19-05, lane B 19-06 to 19-10 and lane C 19-11 to 19-15. Each lane had the "why a fresh check" list (Phase 16's active-risk rule and Withdrawn filter, the new conflict reasons, X-27 to X-29, the catalogue count, the route budgets, the E2E `q=` rule, the `router.replace` Show filter) and the defect patterns from 16-PLAN-CHECK.md iterations 2 to 5. Full lane reports: `19-PLAN-CHECK-lane-A.md`, `-lane-B.md`, `-lane-C.md`.

**Verdict:** ISSUES. 15 blockers (lane A 4, lane B 5, lane C 6; several are one defect seen from different plans, merged below into B1 to B10), 16 warnings, 13 info.

### What still holds today (summary; detail in the lane reports)
- All 15 plans pass `verify plan-structure` and `frontmatter validate --schema plan`, and every `<automated>` command passes `bash -n`. The chain runs linearly from 19-01 to 19-15 (waves 1 to 15) with no cycle.
- Phase 14's `zip-archive.ts` and `xlsx-reader.ts` exist and 19-03 reuses them. `read-excel-file` 9.3.10 and `csv-parse` 7.0.2 are already in the backend.
- The register export reuses `RiskRegisterRepository`, whose base query applies `applyActiveRisk`, or `applyWithdrawnRisk` for `state=withdrawn` (risk-register.ts:591). It is already an accepted reader in `active-risk-readers.unit.test.ts`.
- The reserved operations and pinned rows the plans move exist: `GET:/api/v1/risks/export` (served-operations.json:2884), `function.reports.reports.api.03`, and `PHASE7_REPORT_EXPORT_PUBLISHED`.
- The design-direction anchors for X-30 to X-32 exist after Phase 16's X-27 to X-29.
- Every backend and web identifier the plans read exists, except the drift listed below.
- No plan adds a button to `/app/risks/{documentId}` or `/app/requests/{documentId}`. The shared-module growth that reaches them is B8 and C-I5.

### Blockers (merged)
- **B1. Host-specific verify preambles** (all 15 plans, 63 occurrences: lane A B3, lane B B1, lane C B1, plus the 19-VALIDATION Node row).
- **B2. The clean-status filters and rules reject the modified verification ledger** (lane A B4, lane B B4, lane C B2: every hard rule, plus the filters at 19-06:259, 19-11:210, 19-12:249, 19-15:226 and :249).
- **B3. The G-6 approval line is executor-written and in the stale form** (lane A B1, lane C B3).
  - The executor writes and checks "Approved by the pilot on" in 19-01:100, :233 and :236, the precondition at 19-02:133 (exports record only) and 19-05:143, and 19-15:249.
  - The Phase 06 and 07 notes have no amendment status line.
- **B4. Neither G-6 record has an Affected Workstreams section** (lane A B2). The iam workstream reads `csrm-authorization` (13 hits), the catalogue (15) and `served-operations` (22), and Phase 19 changes all three.
- **B5. The human-only count guard fails the Strapi suite** (lane B B2; lane A W6). `authorization-matrix.integration.test.ts:264` asserts `31 + insightOperations.size`, and :266-267 require every non-insight member as a quoted literal in the policy. 19-05, 19-07 to 19-10 and 19-14 add human-only exports without raising the count, listing the test or adding the literals.
- **B6. 19-06's register Export can't be built as described, and would show to a Requestor** (lane B B3).
  - The `PageHeader` prop is `action`, not "actions".
  - The header renders outside the Suspense, before the row total exists.
  - The Requestor's only gate is the API 403, rendered inside the content.
- **B7. 19-10 misses the `myRatingSummary` released-read caller** (`controllers/csrm-assessment.ts:343-348`), so its own verify fails (lane B B5).
- **B8. The `similar` badge in the shared `status-badge.tsx` map reaches the two tight routes** (289 and 558 bytes of headroom), and nothing measures them before the gate (lane C B4).
- **B9. 19-13 adds `similar` to the web `csvRowStates` while the exhaustive badge map entry only arrives in 19-15,** so 19-13's typecheck fails (lane C B5).
- **B10. 19-15's dependency check fails on a correct change.** The `unpdf` line gains a comma, and `pnpm-lock.yaml` is not checked (lane C B6).

### Warnings
- **A-W1.** 19-05 adds a duplicate `SERVICE_IDENTITY_ROLE_NAME`. Reuse `SECURITY_ANALYST_AGENT_ROLE_NAME` (csrm-authorization.ts:16).
- **A-W2 / C-W1.** The content-type freezes lack the IAM exclusions.
- **A-W3.** The "Written ahead" headers cite `6e005b2` and planned outputs.
- **A-W4.** 19-04's repository interface leaves out `today` (risk-register.ts:77-82).
- **A-W5.** 19-04 pins no `withdrawn` → `Withdrawn` label and has no withdrawn or default-export case.
- **A-W6.** 19-05 should confirm the catalogue placement and state the literal counts.
- **B-W1.** 19-07 to 19-10 never name the active-risk rule. 19-10 should name `riskSummariesFor` and `projectRequestorAssessmentSummary`.
- **B-W2.** 19-06 tells the executor to ignore the CSV charset, which the parity guard forbids.
- **B-W3.** 19-06's journey edits an unnamed shared seed Risk.
- **B-W4.** 19-09 misses the `contract-catalogue.integration.test.ts:1123` row.
- **B-W5.** A refused export would get the questionnaire-governance wording (`csrm-authorization.ts:157`).
- **C-W2.** The Keycloak grep is not scoped to `-- apps/`.
- **C-W3.** 19-11's alerts, review-list and report headers render outside the Suspense that holds the data.
- **C-W4.** 19-12 says nothing about withdrawn Risks, and its fixtures need the required `withdrawal`.
- **C-W5.** 19-12's shared loader drops the permission, error and contract-mismatch states and the metadata cache.

### Info
- **A-I1 to A-I3:** `XlsxReadError.code` is unchanged; `UNSERVED_REASONS` edits go after the IAM spread; `PHASE_19_BASE` recording.
- **B-I1:** duplicated `</output>` lines.
- **B-I2 to B-I4:** cross-lane dependencies; no identity-source double is needed.
- **C-I1:** `risk-owner-journey.spec.ts` doesn't exist yet.
- **C-I2:** stale baselines.
- **C-I3:** drifted names: preview `summary`, `IMPORT_PREVIEW_CHANGED`, no 422 in the error type, `harness.createCsvMultipart`.
- **C-I4:** `csv-parse` stays unused in the web package.json.
- **C-I5:** 19-02's refusal-copy additions ship on `/app/requests/{documentId}`.
- **C-I6:** the admin journey should search with `q=`.

### Dependency check (worker, 2026-10-16)
- **Legitimacy.** `gsd-tools package-legitimacy check --ecosystem npm write-excel-file` returns verdict OK: about 1.42M weekly downloads, not deprecated, no postinstall, repository `gitlab.com/catamphetamine/write-excel-file`.
- **Metadata.** `npm view write-excel-file@4.1.1` (read-only) shows: MIT, published 2026-06-08, the current `latest`, `engines.node >=18`, and a single dependency `fflate ^0.8.2`. `pnpm-lock.yaml` already resolves `fflate@0.8.3`, the fixed version for GHSA-px8p-9vwx-vf98.
- **Justification.** It is concrete. 19-03's D-12 table weighs it against pass-or-fail criteria (typed cells, no formula unless explicit, frozen bold header, widths), pins it exactly in `apps/backend` only and makes `xlsx-writer.ts` the only importer. `read-excel-file` is not added again; Phase 14's `xlsx-reader.ts` is reused for reading.

### Pilot rulings applied in the revision (2026-10-16)
- **B6:** Export shows only to actors the server grants it to, decided in the page's server component from the session capabilities (as Phase 11's Home choice does). The API 403 stays the real control.
- **B-W2:** never weaken the parity guard. The specification declares the exact media type the server sends.
- **B-W3:** the journey creates its own uniquely titled records.
- **B-W5:** a refused export gets accurate, export-specific wording, recorded in the 19-02 reason list and the G-6 record if it is a closed reason or copy.
- **B8:** the `similar` badge adds zero bytes to the two tight routes. Reuse a bundled icon or keep an import-only map. 19-15 measures both routes before its gate. Keep the badge contract in 19-UI-SPEC.
- **B9:** the badge entry, or the import-only map, moves into 19-13 with the state.
- **B10:** a semantic dependency check: parsed package.json, and a lock allow-list.
- **C-W3:** Export goes where the data is, inside the Suspense (toolbar or result-count row), never with a second read.
- **C-W4:** the report excludes withdrawn Risks by the active-risk rule.
- **C-W5:** the shared loader keeps every state the page renders today and is behaviour-neutral.
- **Info items:**
  - remove the now-unused `csv-parse` from the web package in 19-15;
  - the admin journey searches with `q=`;
  - re-baseline to Phase 16's final gate (web 5,847; Strapi 2,022 plus 1 skipped; Playwright 248).
- **Also fixed:** A-W1, A-W4, A-W5, A-W6, B-W1 and B-W4.

---

## Revision (iteration 3, 2026-10-16)

**Mode.** A minimal in-place revision. No re-slice, no task added or removed, and no wave, `depends_on` or requirement change. Every plan passes `verify plan-structure`, `frontmatter validate --schema plan` and `bash -n` on every `<automated>` command, and `grep -c ProgramData` returns 0 in every plan and in 19-VALIDATION.md. Nothing was committed until the re-check passed.

**Who changed what.**
- **The worker, mechanically, in all 15 plans:**
  - the 63 host-specific preambles and hard rules became Phase 15's host-neutral Node 24.19 check (B1);
  - the four clean-tree filters and every staging and clean-status rule accept the modified verification ledger (B2);
  - the IAM exclusions were appended to the 12 content-type freezes (A-W2, C-W1);
  - the 19-VALIDATION Node row, its gate row and 38 map and task rows now follow the revised plans.
- **Three `gsd-planner` revisions,** one per lane, ran in parallel with fixed cross-plan values. Two pilot rulings then aligned 19-11 and 19-15 with 19-06.

**Cross-plan values (one source each).**
- **Export 403 messages,** from 19-05's branch in `humanAnalystDenialMessage` for every `SERVICE_IDENTITY_REFUSED_OPERATIONS` member, recorded in 19-01's exports record:
  - service identity: "CSRM exports are refused to automation identities.";
  - human-only: "CSRM analyst exports require a human Security Analyst.";
  - missing list read: "CSRM export requires the list read.".
- **Media types,** declared exactly in the specification and registered exactly in `EXPORT_RESPONSE_CONTENT_TYPES` (the parity guard is unchanged): `text/csv; charset=utf-8` and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- **Human-only count** (`authorization-matrix.integration.test.ts:264`, from today's `31 + insightOperations.size`): 19-05 makes it 32, 19-07 33, 19-08 35, 19-09 36, 19-10 37 and 19-14 41. Each plan adds its exports as quoted literals in `csrm-authorization.ts` and lists the test.
- **Family S copy** moves to `features/exports/export-refusal-copy.ts` and `features/administration/import-refusal-copy.ts`, created by 19-02. `lib/api/refusal-copy.ts` is unchanged, because it ships on `/app/requests/{documentId}`. A 19-02 guard keeps it, `status-badge.tsx` and the `conflict-reasons` value importers unchanged.
- **Export placement pattern (pilot ruling 2026-10-16),** per 19-UI-SPEC §1 and X-30:
  - Export sits in the page header. The static header renders in the Suspense fallback.
  - The data component renders the header with Export, its count taken from the same read, only when the read succeeded and the list's own `<list>:export` capability is held.
  - There is one capability per export operation, granted in development exactly as Strapi grants the export. Read access alone never shows Export.
  - The served-anchor check strips only the register's `?format=` and still asserts the path is served.
  - Applied by 19-06 (`risk-register:export`), 19-11 (nine list capabilities), 19-12 (`released-assessment:export`) and 19-15 (four reference-list capabilities).

**Per plan, beyond the mechanical edits.**
- **19-01:**
  - The pilot writes the four approval lines at Task 2: `Status: **approved by the pilot on YYYY-MM-DD** (G-6)` in both records, and `Phase 19 amendment status: **approved by the pilot on YYYY-MM-DD** (G-6)` in new `## Phase 19 amendment` sections of the Phase 06 and 07 notes. Task 3 only checks them (B3).
  - Both records gain `## Affected Workstreams` naming csrm and iam, with compatibility positions; Task 1 re-runs the iam grep (B4).
  - Task 1 reads `PHASE_19_BASE` from this file and proves no `apps` or `docs/references` change landed since it.
  - The exports record states the three 403 messages and the media types. Drifted names are fixed.
- **19-02:**
  - Family S copy goes to the two feature modules (C-I5), and the copy guard covers them.
  - The precondition names both records in the pilot's format.
- **19-03:** `ZIP_COMMENT` → `IMPORT_FILE_TYPE` mapping.
- **19-04:**
  - `count(filters, today)` and `selectPage({ …, today })` (A-W4).
  - Open, Closed and Withdrawn labels, a `state=withdrawn` export case and a default-exclusion case (A-W5).
  - `active-risk-readers` in the verify.
- **19-05:**
  - Reuses `SECURITY_ANALYST_AGENT_ROLE_NAME` (A-W1).
  - The export denial branch (B-W5).
  - Count 32 with a quoted literal (B5).
  - The Function sits in `idambox-csrm`, granted to `role.security_analyst` only (A-W6).
  - The spec media-type check.
- **19-06:**
  - Register Export per the placement pattern, behind `risk-register:export` (B6).
  - Exact media types (B-W2).
  - The journey uses its own records with `q=export-{suffix}` (B-W3).
- **19-07:**
  - Count 33.
  - `effective-access.ts` `isOperationGranted` honours `SERVICE_IDENTITY_REFUSED_OPERATIONS`, test-first (pilot ruling), so the current-user operations match the policy.
- **19-08:** count 35, with the alert export as its own literal and `active-risk-readers` added.
- **19-09:** count 36; pinned rows at `contract-catalogue.integration.test.ts` :1123, :1167 and :1794 (B-W4).
- **19-10:**
  - Count 37.
  - `myRatingSummary` is the fourth caller, with a regression (B7).
  - Active-risk reads go through `riskSummariesFor`, `projectRequestorAssessmentSummary`, `ACTIVE_RISK_FILTER` and `isActiveRisk` (B-W1).
  - The released-detail schema leaves the shared module (route budget).
  - Another Requestor exporting someone else's released assessment gets a 404 and no export event.
- **19-11:** nine `<list>:export` capabilities and the header pattern on every list (C-W3, as the pilot ruled); the served inventory is regenerated.
- **19-12:**
  - A behaviour-neutral loader that keeps the permission, error, contract-mismatch and cached metadata states (C-W5).
  - Withdrawn Risks excluded, with `active-risk-readers`, `withdrawal` on the fixtures that require it, and a withdrawn case (C-W4).
  - `zod-client-boundary.test.ts` added: the planner found that new report routes would otherwise fail it.
- **19-13:**
  - The import row family moves with its `satisfies Record<CsvRowState, …>` from `status-badge.tsx` to the import-only `features/administration/import-row-status.tsx`, together with the `similar` state and badge (`Matched by similar name`, warning, `CaseSensitive`) (B8, B9). The shared map only shrinks.
  - Drifted names fixed (C-I3). The 409 `IMPORT_PREVIEW_CHANGED` → `IMPORT_REVIEW_EXPIRED` change is named and tested.
- **19-14:** count 41, the export 403 messages, and `authorization-matrix.integration.test.ts` listed.
- **19-15:**
  - The gate checks all four approval lines and that no awaiting line remains (B3).
  - The semantic dependency check: parsed `package.json` at base and HEAD differ only by `write-excel-file` 4.1.1 added to apps/backend and `csv-parse` removed from apps/csrm. The `pnpm-lock.yaml` `-U0` diff equals an exact line allow-list, dry-run against a synthetic repository in both directions (B10).
  - The Keycloak grep is limited to `-- apps/` (C-W2).
  - Task 3 runs `performance.spec.ts` and records both tight routes (B8).
  - The unused web `csv-parse` is removed; the admin journey uses `q=`; baselines are web 5,847, Strapi 2,022 + 1 skipped, Playwright 248.
- **19-UI-SPEC:** only the badge-primitive row (:95) changes, to name the import-only map. The label, icon and tone contract is unchanged, and §1 is untouched.

---

## Re-check (iteration 4, 2026-10-16)

**Method.** Three `gsd-plan-checker` lanes ran over the revised plans: A over 19-01 to 19-05, B over 19-06 to 19-10 and C over 19-11 to 19-15. Each verified the iteration-2 findings against today's code, looked for defects the revision introduced, and checked that every cross-plan value matches. Reports: `19-PLAN-CHECK-recheck-A.md`, `-recheck-B.md`, `-recheck-C.md`.

**Verdict:** ISSUES. Every iteration-2 finding is resolved in all 15 plans. The three re-checks found 3 new blockers, 6 warnings and 11 info items.
- **Unchanged since iteration 2:**
  - Every plan passes plan-structure, frontmatter and `bash -n` checks, and `ProgramData` appears in none.
  - The cross-plan values match in every plan: the three 403 strings, the two media types, the count chain 32/33/35/36/37/41, the family S module paths, the `<list>:export` capability names and the five export Function ids.
- **Verified against code:**
  - B8: the badge icons appear only in the import family.
  - B10: the lockfile allow-list was simulated against pnpm's v9 format and fits exactly.

### New blockers
- **A-NB-1.** 19-03 Task 1's verify greps `pnpm why` for `fflate 0.8.3`, but pnpm 11.24 prints `fflate@0.8.3`. The check therefore fails on a correct install, and its old-version rejection misses `fflate@0.8.2`.
- **B-NB-1.** `analyst-insight-routes.unit.test.ts:81` lists `"/export"` as an unserved fragment and checks every router under `src/api`. The full Strapi suite therefore fails in 19-05 and 19-07 on correct work; only 19-08 removed the fragment.
- **C-NB-1.** 19-15 Task 2's verify runs the full web suite before Task 3 regenerates `served-operations.json`. Tasks 1 and 2 add Strapi calls, so `contract-operation-chain.test.ts:176-182` and the parity registration fail.

### Warnings
- **A-W-1.** 19-04 types the export event's `reason` as nullable. The formatter writes any reason that is not `undefined` (security-event-log.ts:142), so it would log `INVALID_REASON`. The formatter extension for the export and import fields is also unstated.
- **B-W-1.** 19-08 and 19-09 must say how `SERVED_INSIGHT_ROUTES`' exact policy check admits `underlyingRead`.
- **B-W-2.** 19-10's web schema move breaks five test files that are not in its file list.
- **B-W-3.** 19-06 Task 1 changes the capability anchors but leaves `strapi-capabilities.test.ts` failing until Task 3.
- **C-W1.** 19-15 Task 1 deletes the client parser, but `administration-schema.test.ts` still tests it and is not in the plan.
- **C-W2.** 19-15's "pure helper module" has no path.

### Info
- **A-I-1:** a duplicated `</output>`. On inspection it is a CRLF artefact: each file has one tag, so no change is needed.
- **A-I-2:** `PHASE_19_BASE` must be committed before 19-01 runs.
- **A-I-3:** 19-02's importer grep misses multi-line type imports and double-quoted value imports.
- **A-I-4:** 19-05's withdrawn Risk must sit on a draft assessment.
- **B-I:** the 19-07 `isOperationGranted` ruling and the 19-10 negative case (another Requestor gets 404 and nothing is logged) are both confirmed.
- **C-I:**
  - the Home citation lines vary;
  - `md:flex-row-reverse` puts Export first visually on desktop;
  - the `save-file.ts:8` comment names the deleted parser;
  - 19-14 doesn't state whether the reference exports carry `?format`;
  - the lock check depends on pnpm's output format.

## Revision (iteration 5, 2026-10-16)

**Worker's own mechanical edits:**
- **A-NB-1.** 19-03's verify now reads every `fflate@…` key and `fflate: …` dependency line in `pnpm-lock.yaml` with node and requires the single version 0.8.3. It passes on today's lock and fails on a copy with a 0.8.2 entry. The action and `fails_when` match.
- **A-W-1.** In 19-04, `reason?` is optional (absent, never `null`). The formatter extension is spelled out: the common head, then one branch per family in a fixed key order, with closing rules. Attachment lines stay byte-identical. The acceptance adds three cases: no `reason` key on `export.completed`, no `INVALID_REASON`, and a 255-character cut on search.
- **A-I-3.** 19-02 Task 3's importer guard is now a node walk over `apps/csrm/src`. It reads multi-line imports and re-exports in either quote style and skips `import type`. Tested: it passes at HEAD, accepts a multi-line type import, and fails on a double-quoted value import.
- **A-I-4.** 19-05's withdrawn Risk sits on a draft, editable assessment (specification.json:25261).

**`gsd-planner` targeted pass, with pilot rulings:**
- B-NB-1, B-W-1 to B-W-3, C-NB-1, C-W1 and C-W2.
- The `save-file.ts` comment and the Home citation.
- **Export order:** visual order equals markup order, per 19-UI-SPEC.
- **19-14:** the reference exports take `?format={format}` like the register export, so the anchors are uniform.

**What the planner changed, in nine plans (19-05, 19-06, 19-08 to 19-12, 19-14, 19-15):**
- **19-05:** `UNSERVED_PATH_FRAGMENTS`' `"/export"` becomes the two still-unserved insight export literals, `'"/v1/alerts/export"'` and `'"/v1/reports/:reportKey/export"'`, with `analyst-insight-routes.unit.test.js` in the verify.
- **19-08 and 19-09:** each drops only its own literal and adds its `SERVED_INSIGHT_ROUTES` entry with `underlyingRead`, compared exactly.
- **19-06:** Task 1 owns `strapi-capabilities.test.ts` and the served-inventory regeneration. It adds the header action order rule and cites the Home choice as `page.tsx:24-29`.
- **19-10:** a server-only `assessment-server-schema.ts`, and the six affected web tests listed with line references.
- **19-11:** headers with two actions share one wrapper.
- **19-12:** Print report and Export share one wrapper.
- **19-14:** `GET:/api/v1/{segment}/export?format={format}` for the four reference exports.
- **19-15:**
  - Each task registers its file responses and regenerates the served inventory before its suite runs.
  - `administration-schema.test.ts` drops its parser cases.
  - `features/administration/import-flow-rules.ts` gets a path and joins the copy guard.
  - The `save-file.ts` comment is reworded.

**Pilot rulings recorded (2026-10-16):**
- **Header action order.** Export is last in DOM order (19-UI-SPEC §1 :133, UI-D1 :610), so the keyboard, screen-reader and phone order reads Create, Import, Export. On desktop the existing `md:flex-row-reverse` wrapper keeps Create at the right edge. Groups of two or more actions sit in one wrapper. This is settled for the UI review.
- **Released header.** The status badge stays with the title and number, as the record's identity. The action group (Print report, Export) sits at the header's end (19-12).
- **Export anchors.** The 19-07 to 19-10 exports keep their anchors without the `?format` template. The anchors strip the query, so the rule is consistent.

19-VALIDATION.md rows 19-05-01, 19-06-01, 19-06-03, 19-08-03, 19-09-01, 19-10-01, 19-14-03 and 19-15-01 to 19-15-03 follow the new verify commands.

---

## Re-check (iteration 6, 2026-10-16): PASSED

**Method.** Two targeted `gsd-plan-checker` lanes covered every plan touched since iteration 4:
- **lane A:** 19-02 to 19-06 and 19-08 (`19-PLAN-CHECK-recheck6-A.md`);
- **lane B:** 19-09 to 19-12, 19-14 and 19-15 (`19-PLAN-CHECK-recheck6-B.md`).

**Verdict: PASSED.** Both lanes found 0 blockers. Every iteration-4 finding is resolved against today's code.
- **Lane A** ran the fflate lockfile check and the importer walk read-only. Both pass on today's tree and fail on a wrong one.
- **Lane B** confirmed how each export takes its format, as 19-UI-SPEC's format choice needs: 19-05, 19-08 and 19-10 by query parameter, 19-09 by body field, and 19-14 through the `?format` template.

**Findings and their disposition:**
- **Lane A I-1:** widening `SecurityEvent` breaks the unnarrowed `event.reason` read in `securityEventLevel`.
  - Fixed: 19-04 now tells the executor to narrow it by event family (`"reason" in event`), so `tsc` passes and an import event never reads a reason.
- **Lane A I-2:** the export anchors are mixed. Accepted under the anchor ruling above.
- **Lane A I-3:** the importer walk counts `import { type X }` as a value import. It errs strict, which is acceptable.
- **Lane B warning:** 19-12 Task 3 must edit `assessment-editor.tsx:846-850`, the client component that renders the analyst review page's header, which has no action slot today. The route budget is 460,000, so this carries no budget risk.
  - Fixed, per the pilot's ruling: `assessment-editor.tsx` and `assessment-editor.test.tsx` join 19-12's `files_modified`, Task 3's files and its `read_first`.
  - The header gains an optional `headerAction?: ReactNode` passed to `PageHeader`'s `action`. The review page fills it by the Export placement pattern, and with no prop the header renders exactly as today.
  - A test proves the action renders last and that none renders by default. The 19-12-03 VALIDATION row says so.
- **Lane B minor notes:**
  - fixed the stale "after its existing actions" in 19-12, since `released-assessment.tsx:174-178` has no action today;
  - fixed 19-15's parser citation (`:242-275` → `:243-275`);
  - the Home citation is now consistent at `page.tsx:24-29`.
- No further re-check ran for these edits, per the pilot's ruling.

**Final state:**
- All 15 plans pass `verify plan-structure` and `frontmatter validate --schema plan`.
- All 50 `<automated>` commands pass `bash -n`.
- `grep -c ProgramData` returns 0 in every plan and in 19-VALIDATION.md.
- The plans keep their 15 linear waves, with task counts and requirements unchanged.

**Base.** PHASE_19_BASE is `bdd0f698`, recorded on its own line in iteration 2 above. 19-01 Task 1 reads it from this file, proves no `apps` or `docs/references` change landed since it, and copies the line into 19-01-SUMMARY.md for the later freeze checks and the gate.

**Next:** `/gsd-execute-phase 19 --ws csrm`, from 19-01. Its Task 2 stops for the pilot to write the four G-6 approval lines.
