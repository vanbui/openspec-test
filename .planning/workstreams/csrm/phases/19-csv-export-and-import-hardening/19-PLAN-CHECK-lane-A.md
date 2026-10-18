# Phase 19 plan check, lane A (19-01 to 19-05)

## Fresh pre-execution check (2026-10-16)

Checked against HEAD `bdd0f698` (Phase 16 closed). Read-only. Nothing was run except greps, `bash -n` and gsd-tools.

### What still holds today

- `verify plan-structure` and `frontmatter validate --schema plan` both report valid for 19-01 to 19-05. Every `<automated>` command passes `bash -n`. The chain is 19-01 (wave 1), then 02, 03, 04, 05, each depending on the one before. There are no cycles.
- The design-direction anchors exist. `### Dialogs` holds `Record history (CSRM extension, 2026-10-01)` at csrm-design-direction.md:435, `### Print` is at :492 and `### Status & risk badges` is at :358. The X-30 to X-32 placement in 19-01:99 is reachable.
- Phase 14’s modules exist and 19-03 reuses them without duplicating them: `readZipDirectory`, `readZipEntry`, `findZipEntry` and `ZipArchiveError` (zip-archive.ts:34-239), and `readWorkbookSheets(bytes, { maxInflated })`, `xlsxCellText` and `XlsxReadError` (xlsx-reader.ts:30-121). `read-excel-file` 9.3.10 is in apps/backend/package.json:34. `write-excel-file` is pinned to apps/backend only, with a diff check against apps/csrm/package.json (19-03:196). `csv-parse` 7.0.2 is already in the backend (package.json:27).
- The register export reuses `RiskRegisterRepository`. Its base query applies `applyActiveRisk`, or `applyWithdrawnRisk` only for `state=withdrawn` (risk-register.ts:591), so the export inherits the active-risk rule and the Withdrawn filter. risk-register.ts is already a reader that `active-risk-readers.unit.test.ts` accepts (:55, :208). No new risk-table reader is added in 19-04 or 19-05.
- `GET:/api/v1/risks/export` is reserved in served-operations.json:2884 on `function.risk_register.risk_register.api.04`. The catalogue URL `GET:/api/v1/risks/export?format={format}` is at catalogue :2467, as 19-05:101 states.
- `HUMAN_ANALYST_ONLY_OPERATIONS` (csrm-authorization.ts:113), `hasHumanAnalystOperation`, `isHumanSecurityAnalyst` and `loadEffectiveGrants` exist. `role.security_analyst` is the right role id.
- `RISK_CURATION_UNDO_UNAVAILABLE` is in conflict-reasons.ts. 19-02 appends after the existing codes and keeps a single entry if a name already exists, so Phase 16’s codes are safe.
- No plan in lane A adds a button to `/app/risks/{documentId}` or `/app/requests/{documentId}`, so route budgets are not affected here (19-04 adds only a JSON copy under `features/exports`).

### Blockers

1. **Approval string does not match the pilot’s G-6 format.** In 19-01:100 and :233, Task 3 has the executor write `Approved by the pilot on {date} (G-6). Recorded by the 19-01 executor...`. The check at 19-01:236 greps for `Approved by the pilot on ...`, and the precondition at 19-02:133 and 19-05:143 uses the same string. Per 16-PLAN-CHECK, the pilot writes the line, in the form `Status: **approved by the pilot on YYYY-MM-DD** (G-6)`, and the Phase 06/07 dated notes need `Phase 19 amendment status: **approved by the pilot on YYYY-MM-DD** (G-6)`. 19-01:176 has no amendment-status line at all.
   **Fix:** make Task 3 a pilot-written step. Check by piping the file through `tr -d "*"` and running `grep -Eq "Status: approved by the pilot on [0-9]{4}-[0-9]{2}-[0-9]{2} \(G-6\)"` (same pattern for the amendment line in phase-06 and phase-07). Use the same strings in the 19-02 and 19-05 preconditions and in the 19-01 must_haves (:26, :41). The 19-02 precondition names only the exports record; it should also name the import-tolerance record.
2. **No "Affected Workstreams" section in either G-6 record.** 19-01 contains 0 hits for it, and its Task 1 section list (:160-176) omits it. The precedent is phase-14-request-attachments.md:355. The IAM grep over `.planning/workstreams/iam/` prints 13 hits for `csrm-authorization`, 15 for `idambox-csrm-role-function-api-catalogue` and 22 for `served-operations` (IDENTITY-PROVISIONING-BRIEF.md, iam 01-03/01-05/02-03/02-05/02-12 plans and others). It prints none for `CONFLICT_REASONS` or `risks/export`. The `/import` hits are Keycloak realm import, which is unrelated. Phase 19 changes all three of the read files (19-05 policy, catalogue, served-operations).
   **Fix:** add `## Affected Workstreams` to both records. Name csrm and iam. For each change, state its backward-compatibility position: additive operations, a moved FunctionApi id (`function.risk_register.risk_register.api.04` to `export_api.api.01`), the new `SERVICE_IDENTITY_REFUSED_OPERATIONS`, and the added reason codes and details. Add a grep for it to 19-01:179.
3. **Host-specific verify preamble.** Occurrences of the `/c/ProgramData/nvm/v24.19.0` PATH export per plan: 19-01 1 (Hard-rules bullet), 19-02 4, 19-03 5, 19-04 4, 19-05 4 (each count = Hard-rules bullet + every `<automated>` that runs pnpm). As written, these commands fail on any host without `/c/ProgramData/nvm`.
   **Fix:** replace each with the Phase 15 host-neutral form (15-10-PLAN.md near line 187), the `node -e` major-24/minor-19 check followed by `pnpm --version >/dev/null &&`, and restate the Hard-rules bullet.
4. **Clean-status rule rejects the ledger.** The Hard-rules bullet in all five plans (e.g. 19-01:131) and the 19-01:241 criterion say `git status --short` "shows only POST-DEMO-BRIEF section 2’s three operator items". The tree today already carries a modified `.planning/workstreams/csrm/.verification-ledger.json` (status ` M`).
   **Fix:** accept that line as well in every plan.

### Warnings

1. **Duplicate service-identity constant (19-05:102).** The plan adds `SERVICE_IDENTITY_ROLE_NAME = "Security Analyst Agent"`, but csrm-authorization.ts:16 already re-exports `SECURITY_ANALYST_AGENT_ROLE_NAME`. Reuse that constant. Human eligibility must go only through `isHumanSecurityAnalyst`/`hasHumanAnalystOperation`.
2. **Freeze checks are not scoped to Phase 19 and lack the IAM exclusions.** 19-02:213, 19-03:290, 19-04:264 and 19-05:226 run `git diff --name-only PHASE_19_BASE` over the content-types glob. The IAM merge `d1518c5f` is already behind HEAD, so `PHASE_19_BASE..HEAD` is currently Phase 19’s own range. An IAM merge mid-phase would still trip these checks. Append the three exclusions from the Phase 16 ruling (idambox-user, identity-source, keycloak-sync-outbox under `apps/backend/src/api/`), and scope the dependency diff the same way.
3. **"Written ahead" headers are stale.** 19-01:82, 19-02, 19-03:101, 19-04:97 and others cite `6e005b2` plus planned outputs, and the 19-01:147 precondition names plans (14-02, 14-03, 16-01) as if they were pending. All of it now exists. Restate against `bdd0f698`.
4. **19-04 repository interface omits `today`.** 19-04:136 lists `count` and `selectPage({ filters, sort, offset, limit })`, but the real signatures are `count(filters, today)` and `selectPage({ ..., today })` (risk-register.ts:77-82). A fake repository written to the plan will not typecheck.
5. **Withdrawn label not pinned in 19-04.** The `riskState` label family (19-04:126) and the register view’s `riskState` column must map `withdrawn` to `Withdrawn`, because `RISK_REGISTER_STATES` includes withdrawn (risk-register-query.ts:30). The filter description must also include the Withdrawn chip. No case in 19-04 or 19-05 exports with `state=withdrawn`, or proves the default export excludes withdrawn risks. Add one behaviour case each.
6. **New Function is placed under `function.risk_register.*`.** 19-05:106 adds `function.risk_register.export_api`. Confirm that it sits in the `idambox-csrm` application block and is granted only to `role.security_analyst` (the plan does the latter). If the matrix and served-operations tests assert literal counts (human-only count 31 + 5 insights after Phase 16), 19-05 should state the new counts. It currently states none, so the executor has to discover them.

### Info

1. `XlsxReadError` today carries a `code` (`XLSX_TOO_LARGE` or `XLSX_UNREADABLE`, xlsx-reader.ts:28-31). 19-03 adds a separate `.reason`, which is fine as long as `code` stays unchanged, as 19-03:223 says.
2. In `served-operations.integration.test.ts`, `UNSERVED_REASONS` (:104) spreads `IAM_SCIM_RESERVATIONS` first. 19-05 removes the risk-export reason; keep the edit after the spread.
3. `PHASE_19_BASE` is recorded via `git rev-parse --short HEAD` before the first commit (19-01:141, :159, :274). That is correct.
