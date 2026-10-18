---
phase: 03-strapi-scim-2-0-service
reviewed: 2026-10-16T03:23:58Z
depth: standard
files_reviewed: 70
files_reviewed_list:
  - apps/backend/.env.example
  - apps/backend/config/middlewares.ts
  - apps/backend/package.json
  - apps/backend/src/bootstrap/boot-mode.ts
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/backend/src/iam/identity/identity-service.ts
  - apps/backend/src/iam/scim/config.ts
  - apps/backend/src/iam/scim/dev-token-export.ts
  - apps/backend/src/iam/scim/discovery.ts
  - apps/backend/src/iam/scim/errors.ts
  - apps/backend/src/iam/scim/filter.ts
  - apps/backend/src/iam/scim/handlers.ts
  - apps/backend/src/iam/scim/limiter.ts
  - apps/backend/src/iam/scim/mapping.ts
  - apps/backend/src/iam/scim/patch.ts
  - apps/backend/src/iam/scim/query.ts
  - apps/backend/src/iam/scim/routes.ts
  - apps/backend/src/iam/scim/source-activity.ts
  - apps/backend/src/iam/scim/source-context.ts
  - apps/backend/src/iam/scim/source-lock.ts
  - apps/backend/src/iam/scim/token-cli.ts
  - apps/backend/src/iam/scim/token-service.ts
  - apps/backend/src/iam/scim/wire.ts
  - apps/backend/src/index.ts
  - apps/backend/src/middlewares/scim-boundary.ts
  - apps/backend/src/policies/scim-source-bearer.ts
  - apps/backend/tests/ai-run-boot.unit.test.ts
  - apps/backend/tests/contract-catalogue.integration.test.ts
  - apps/backend/tests/fixtures/iam-scim/PROVENANCE.md
  - apps/backend/tests/fixtures/iam-scim/connector-lifecycle.json
  - apps/backend/tests/helpers/iam-live-scim-gate.ts
  - apps/backend/tests/helpers/iam-scim-http-harness.ts
  - apps/backend/tests/helpers/strapi-http-harness.ts
  - apps/backend/tests/iam-scim-auth.integration.test.ts
  - apps/backend/tests/iam-scim-auth.unit.test.ts
  - apps/backend/tests/iam-scim-boundary.unit.test.ts
  - apps/backend/tests/iam-scim-capture-tooling.unit.test.ts
  - apps/backend/tests/iam-scim-contract-projection.unit.test.ts
  - apps/backend/tests/iam-scim-discovery.unit.test.ts
  - apps/backend/tests/iam-scim-lifecycle.integration.test.ts
  - apps/backend/tests/iam-scim-limiter.unit.test.ts
  - apps/backend/tests/iam-scim-patch.integration.test.ts
  - apps/backend/tests/iam-scim-patch.unit.test.ts
  - apps/backend/tests/iam-scim-query.integration.test.ts
  - apps/backend/tests/iam-scim-query.unit.test.ts
  - apps/backend/tests/iam-scim-refusal-tooling.unit.test.ts
  - apps/backend/tests/iam-scim-refusal.integration.test.ts
  - apps/backend/tests/iam-scim-replay.integration.test.ts
  - apps/backend/tests/iam-scim-routes.integration.test.ts
  - apps/backend/tests/iam-scim-security.integration.test.ts
  - apps/backend/tests/iam-scim-seed-defaults.unit.test.ts
  - apps/backend/tests/iam-scim-token-cli.unit.test.ts
  - apps/backend/tests/iam-scim-token.integration.test.ts
  - apps/backend/tests/iam-scim-token.unit.test.ts
  - apps/backend/tests/iam-scim-wire.unit.test.ts
  - apps/backend/tests/served-operations.integration.test.ts
  - apps/csrm/e2e/iam-scim-refusal.spec.ts
  - apps/csrm/src/components/shell/protected-layout.test.tsx
  - apps/csrm/src/lib/api/generated/schema.d.ts
  - apps/csrm/src/lib/api/transport/server-client-oidc.test.ts
  - apps/csrm/src/lib/auth/oidc-session-adapter.test.ts
  - docker/.env.example
  - docker/README.md
  - docker/midpoint/e2e/README.md
  - docker/midpoint/e2e/capture-scim.mjs
  - docker/midpoint/e2e/refusal-scim.mjs
  - docker/midpoint/e2e/scim-evidence.mjs
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/served-operations.json
  - docs/references/specification.json
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
remediation_status: verified
unresolved_blockers: 0
unresolved_warnings: 0
live_recheck: required
---

# Phase 3: Code Review Report

## Scope and decisions

Task 1 of plan 03-17 only. Review enabled (`workflow.code_review=true`, resolved default); standard depth, with cross-file tracing for the explicitly required boundaries. Reviewed plans 03-01 through 03-16 SUMMARY ownership and `git log c0d48b8b..bb27cfef`, including live-probe corrections and gate fixes. Base `c0d48b8b` is the Phase 3 planning commit; initial reviewed head is `bb27cfef`. The file list above is the union of actual source/test/script/contract changes and remediation files. Planning documents and published evidence were supporting references. Only tracked example templates and synthetic temporary export fixtures are relevant to configuration checks; no checkout environment file or operational credential was opened or printed.

Review ran inline under the skill's spawn restriction. No questions were needed: locked P3 decisions take precedence over suggestions. No task 2 security audit, plan 03-18, roadmap/state edits, dependency installation, content-type/JDL/generated content-type changes or live infrastructure execution is included. Historical evidence is preserved. Severity counts describe original findings; dispositions below track resolution.

## Narrative Findings

### WR-01: Case-sensitive Bearer scheme rejects valid authentication

**Severity:** WARNING. **File:** `apps/backend/src/iam/scim/source-context.ts:24`.
**Evidence:** `startsWith("Bearer ")` rejects lowercase/mixed-case schemes and additional separating spaces. [RFC 7235 section 2.1](https://www.rfc-editor.org/rfc/rfc7235#section-2.1) defines the scheme case-insensitively; the credential bytes remain exact. The original unit test incorrectly expected lowercase rejection. New regression reproduced failure before remediation.
**Fix:** Recognize only a case-insensitive Bearer scheme followed by one or more ASCII spaces, then run unchanged canonical-token parsing and digest verification on the captured credential. Test authentication and subsequent fresh route authorization, malformed separators, and altered credential bytes.
**Disposition:** Fixed and verified. **Fixing commit:** `078888cb`. **Recheck:** C + F (auth unit: 8/8 passed); R passed persisted authorization/boundary regression (151/151).
**Wire change:** Yes: valid scheme case/spacing variants are accepted; credential integrity is unchanged.

### WR-02: Malformed JSON escape in PATCH selector escapes validation

**Severity:** WARNING. **File:** `apps/backend/src/iam/scim/patch.ts:126`.
**Evidence:** The case-insensitive selector regex accepts uppercase JSON escapes such as `\U0061` and `\N`. Unguarded `JSON.parse(selector[2])` throws; the boundary returns 500 rather than a closed 400. A later bad operation still rolls back, but is misclassified as an internal failure. New reducer regression reproduced SyntaxError before remediation.
**Fix:** Catch selector JSON decoding failures and return `invalidInput`; retain ordered reduction, single write, immutable ownership and shared lock. Test all uppercase escape variants and mounted HTTP failure with unchanged full persisted record/activity ordering.
**Disposition:** Fixed and verified. **Fixing commit:** `250aed0a`. **Recheck:** C + P (17/17 passed, including mounted HTTP unchanged-record/activity assertions); F (patch unit: 9/9 passed).
**Wire change:** Yes: these malformed selector values return 400 invalidValue instead of 500.

### WR-03: Projected response schema rejects supported nested projections

**Severity:** WARNING. **File:** `docs/references/specification.json:30315` (`components.schemas.ScimProjectedUser.properties.emails.items.required` and `.meta.required`); `apps/csrm/src/lib/api/generated/schema.d.ts:2548` (`ScimProjectedUser`).
**Evidence:** `projectScimUser` can return only `emails.primary`, only `emails.value`, only `meta.location` or only `meta.resourceType`. The projected schema copied full-resource nested required lists, so valid responses violate the advertised contract and client types. Full `ScimUser` requirements are correct.
**Fix:** Remove nested required lists only from `ScimProjectedUser`, regenerate client declarations, and test actual include/exclude projections against required-field constraints while retaining full-resource requirements.
**Disposition:** Fixed and verified. **Fixing commit:** `98551c0a`. **Recheck:** C + F (projection regression: 1/1 passed), G, T and V (36/36 passed).
**Wire change:** No: contract/types correction for existing response behavior.

### IN-01: IAM seed switch missing from backend example

**Severity:** INFO. **File:** `apps/backend/.env.example` (missing setting); `apps/backend/src/bootstrap/seed-iam-data.ts:8`.
**Evidence:** The opt-in seed checks development mode and exact `IDAMBOX_SEED_IAM=true`, but the tracked backend example lacks the setting.
**Fix:** Document `IDAMBOX_SEED_IAM=false` with development-only guidance. Test no backend access for unset/false/nondevelopment settings and the example's off setting. Never enable it by default.
**Disposition:** Fixed and verified. **Fixing commit:** `2240a430`. **Recheck:** C + F (seed defaults/template: 2/2 passed).

### IN-02: Token entrypoint diagnostics omit closed codes

**Severity:** INFO. **File:** `apps/backend/src/iam/scim/token-cli.ts:134` and final entrypoint catch.
**Evidence:** Orchestrator note 3 is partially rejected: `runTokenCli` already emits an IAM_SCIM code and an existing test covers it. However preflight usage and the outer `main` catch omit it; cleanup failure is also generic. The prefix regex is a pattern rather than a finite allowlist.
**Fix:** Share finite closed-code formatting for command/entrypoint failures, label cleanup as IAM_SCIM_UNEXPECTED and test usage entrypoint without boot plus unknown-message suppression. No error may print credential/error payloads.
**Disposition:** Fixed and verified. **Fixing commit:** `3102a85c`. **Recheck:** C + F (CLI: 21/21 passed, including entrypoint usage and unknown-code suppression).

### IN-03: Upstream 409 retains locked provisioning-failure mapping

**Severity:** INFO. **File:** `apps/backend/src/iam/identity/identity-service.ts:104`; `apps/backend/tests/iam-scim-lifecycle.integration.test.ts` final remote collision assertion.
**Evidence:** Confirmed orchestrator note 4: every `KeycloakProvisioningError`, including status 409, maps to `keycloakUnavailable` and SCIM 503 Retry-After 30 after rollback. Existing real fake-Keycloak HTTP collision coverage explicitly asserts 503/no adoption/no persisted local user. `03-CONNECTOR-CAPTURE-EVIDENCE.md` records the observed email conflict too.
**Disposition:** Retained by locked decision P3-19 (creates, mirrored active updates/reactivation fail with 503 and rollback), not an unresolved warning. The suggested 409 mapping is rejected for this remediation: it would revise the locked upstream-failure contract. Local username/email/source tuple conflicts continue to return 409 uniqueness. A future decision can distinguish remote conflict from availability while retaining rollback/no adoption. **Fixing commit:** none. **Recheck:** R (151/151 passed, including the explicit remote collision/rollback assertion).

### IN-04: Unpaged connector reconciliation truncates above 100 users

**Severity:** INFO. **File:** `apps/backend/src/iam/scim/query.ts:40`; `docker/midpoint/e2e/scim-evidence.mjs` page scenario; `apps/backend/tests/fixtures/iam-scim/PROVENANCE.md`.
**Evidence:** Confirmed orchestrator note 5/P3-36: actual page scenario emits `/scim/v2/Users` with no paging parameters. Parser/service defaults are 100 and explicit counts cap at 500; totalResults is independently scoped. Captured 5-of-5 data proves no large-directory paging.
**Disposition:** Deferred to Phase 4 under P3-36; do not rely on connector full reconciliation above 100 until filtered correlation, supported paging or an approved default change is proven. No paging defaults changed. **Fixing commit:** none. **Recheck:** R (151/151 passed, including default-count query checks and byte-exact 47-envelope replay).

### IN-05: Discovery description predates asserted-attribute PUT

**Severity:** INFO. **File:** `apps/backend/src/iam/scim/discovery.ts:70` Core User `active` description.
**Evidence:** Description says omitted create/replacement active defaults true, while P3-34 and `parseReplaceUser` correctly preserve omitted PUT active. This text also exists verbatim in historical capture sequence 45. The runtime, OpenAPI replacement description and lifecycle tests implement P3-34 correctly.
**Disposition:** Deferred wording correction to a coordinated discovery/capture refresh; no runtime default change. This is descriptive metadata debt, not an authorization or state defect. **Fixing commit:** none. **Recheck:** R (151/151 passed); wire/lifecycle/replay tests preserve current locked behavior.

## Orchestrator note dispositions

| Note | Verdict | Disposition |
| --- | --- | --- |
| 1. Bearer casing | Confirmed; WR-01 | Fixed in `078888cb`, tested without changing credential bytes. |
| 2. Missing seed example | Confirmed; IN-01 | Fixed in `2240a430`; committed example is false and unset remains off. |
| 3. Generic CLI failures | Partially confirmed; IN-02 | Main command already had codes; fixed remaining entrypoint/cleanup paths and tightened finite allowlisting in `3102a85c`. |
| 4. Keycloak 409 becomes 503 | Confirmed; IN-03 | Retain locked P3-19 mapping and rollback; reject the suggested mapping change in this task. |
| 5. Unpaged default 100 | Confirmed; IN-04 | Record Phase 4 dependency under P3-36; no paging-default change. |

## Required review areas

| Area | Evidence and conclusion |
| --- | --- |
| Thin handlers | `handlers.ts` calls typed wire/query helpers and the six identity-service methods. No direct record writer or external call; PUT merge is passed as a reduction to run under the service lock. |
| Parser ordering | `config/middlewares.ts` places `scim-boundary` before identity and body parsing. Boundary consumes trusted socket-IP budget, authenticates and commits activity, consumes source budget, checks media/size and adapts the existing JSON parser. Unit tests cover malformed/chunked bodies including GET/DELETE/OPTIONS and unchanged CSRM form limits. |
| Exact grant freshness | Private request-object/instance WeakMap context; policy rechecks current token digest, principal invariants and exact METHOD/template URL through active IAM Application, Identity Provisioning Role/Function. All 21 route-grant withdrawals and credential rotation/revocation are tested. No cross-request grant cache. |
| Independent activity | `source-activity.ts` refuses ambient transactions and commits its Document Service update before business work; auth/security tests exercise later grant/parser/throttle denial, user rollback and activity-write failure. No success is claimed if activity fails. |
| Token/export | Complete canonical credential digest, 32-byte timingSafeEqual, source-row serialization, one-time committed output, tokenless seed, export preflight, ignored/untracked path checks, NOFOLLOW, owner-only staging, atomic rename, compensation that cannot revoke a later rotation. CLI tests use transient synthetic fixtures only. WR-01/IN-02 address transport and diagnostics gaps. |
| Locked PATCH/rollback | Reducer sees the frozen current public projection after user lock and fresh principal/scope reads; returns one validated delta. Invalid later operations write nothing, conflicts are classified after outer rollback, inactive writes enqueue durable work, blocking remote writes roll back. WR-02 closes malformed selector decoding. |
| Mounted route inventory | Root registration is observed before bootstrap and compared with actual Koa layers; exactly 21 method/templates, no `/api/scim/v2` aliases, auth:false plus exact explicit source policy. Catalogue copies/grants and unrelated OpenAPI operations are preserved. WR-03 corrects only projected nested requirements. |
| Capture/browser provenance | Capture runner checks pins/isolation, observes original request/response streams, sanitizes before staging, validates ordered invocation/origin/substitutions and requires cleanup before publication. Fixture bytes/digests match published 47-envelope capture. Direct Schemas/config/Groups probes remain separately labelled. Refusal gate stages baseline→stop→SCIM→same-credential refusal/pending→browser→start→worker recovery; same browser cookie/token and held fresh-page assertions cover 1440/375. Published 50-row outcomes and four PNGs are historical evidence, not a fresh run. Validators establish shape/integrity, not independent attestation of execution; orchestrator reports establish the recorded live provenance. |

## Verification and live handoff

Initial regression compilation: `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-03-15.json --pretty false` passed. This config extends the complete backend test config and excludes only `risk-curation-rules.unit.test.ts` and `risk-history-changes.unit.test.ts` (WINDOWS.md entry 11). Initial `node --test --test-concurrency=1` on compiled auth/patch unit suites reproduced the two runtime findings: 15 passed, 2 failed.

Five narrow remediation commits and the selected boundary/contract regression are verified. There are no unresolved BLOCKER or WARNING findings. Two INFO items are fixed, one retains locked behavior, and two are deferred as documented above. SCIM wire behavior changes in WR-01/WR-02 require the orchestrator to rerun relevant live connector and refusal evidence before final acceptance. This task will not recapture, rewrite evidence, or mark task 2/03-18 complete. A passing offline replay is regression evidence, not a replacement live run.


### Executed commands

All fixtures use synthetic temporary data. Compiled-test commands run with `ENV_PATH=/tmp/iam-03-review-no-env` to prevent loading a checkout environment file. The test runner needs the backend working directory for existing fixture paths; `pnpm --dir apps/backend exec` provides that directory from the repository root. P and R were invoked directly with the backend working directory, with the same runner arguments. No live browser or infrastructure is invoked by these tests.

- **C:** `pnpm --dir apps/backend exec tsc -p .tmp/tsconfig.iam-03-15.json --pretty false` — pass on final source. The new contract test initially used a library API unavailable to the configured TypeScript target; changed it to `Object.prototype.hasOwnProperty.call` and reran compilation successfully. No tsconfig exclusions were added.
- **F:** `ENV_PATH=/tmp/iam-03-review-no-env pnpm --dir apps/backend exec node --test --test-concurrency=1 .tmp/tests-dist/tests/iam-scim-auth.unit.test.js .tmp/tests-dist/tests/iam-scim-patch.unit.test.js .tmp/tests-dist/tests/iam-scim-token-cli.unit.test.js .tmp/tests-dist/tests/iam-scim-seed-defaults.unit.test.js .tmp/tests-dist/tests/iam-scim-contract-projection.unit.test.js` — **41/41 pass**, zero skipped. Before their fixes, the new projected contract/template regressions failed as expected (missing primary / missing seed switch).
- **P:** `node --test --test-concurrency=1 .tmp/tests-dist/tests/iam-scim-patch.unit.test.js .tmp/tests-dist/tests/iam-scim-security.integration.test.js` — **17/17 pass**, zero skipped, backend cwd with the ENV_PATH override above.
- **R:** `node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-scim-auth.integration.test.js .tmp/tests-dist/tests/iam-scim-boundary.unit.test.js .tmp/tests-dist/tests/iam-scim-patch.integration.test.js .tmp/tests-dist/tests/iam-scim-lifecycle.integration.test.js .tmp/tests-dist/tests/iam-scim-routes.integration.test.js .tmp/tests-dist/tests/iam-scim-replay.integration.test.js .tmp/tests-dist/tests/contract-catalogue.integration.test.js .tmp/tests-dist/tests/served-operations.integration.test.js .tmp/tests-dist/tests/iam-scim-query.unit.test.js .tmp/tests-dist/tests/iam-scim-wire.unit.test.js .tmp/tests-dist/tests/iam-scim-discovery.unit.test.js .tmp/tests-dist/tests/iam-scim-limiter.unit.test.js .tmp/tests-dist/tests/iam-scim-capture-tooling.unit.test.js .tmp/tests-dist/tests/iam-scim-refusal-tooling.unit.test.js` — **151/151 pass**, zero skipped; backend cwd, ENV_PATH override, `IDAMBOX_SEED_IAM=false CSRM_AUTH_OIDC_ENABLED=false`.
- **G:** `pnpm --dir apps/csrm api:generate` then, after the contract/types commit, `pnpm --dir apps/csrm api:check` — both pass; regeneration is reproducible with no diff.
- **T:** `pnpm --dir apps/csrm typecheck` — pass.
- **V:** `pnpm --dir apps/csrm test src/lib/auth/oidc-session-adapter.test.ts src/lib/api/transport/server-client-oidc.test.ts src/components/shell/protected-layout.test.tsx` — **3 files, 36/36 tests pass**. T and V used the ENV_PATH override too.
- **E:** `node docker/midpoint/e2e/capture-scim.mjs --check`, `node docker/midpoint/e2e/capture-scim.mjs --verify-evidence`, `node docker/midpoint/e2e/refusal-scim.mjs --check`, `node docker/midpoint/e2e/refusal-scim.mjs --verify-evidence` — all pass offline. All four published screenshots inspected: refusal heading/copy, focused sign-in CTA, no protected table, text fits at mobile/desktop widths. This confirms historical artifacts only.

The source/code/type diff was reread after fixes. No new warning found in the fixes: Bearer parsing still validates exact canonical credential bytes; selector failures return before the only write; CLI error output uses an explicit finite allowlist; only projected nested requirements changed, leaving full-resource requirements intact. Published fixture/evidence, catalogue copies, activation defaults, content types, generated content-type declarations, JDL, ROADMAP.md and STATE.md are untouched by remediation.


### Final disposition

Code review/remediation for 03-17 task 1 is complete on source commit `98551c0a`, with the report finalized afterwards. The selected checks above all exited 0. `git diff --check` and report schema/disposition checks pass; the tracked backend/CSRM examples retain false activation flags and the IAM seed remains false. No operational environment file was opened.

**Live handoff remains required:** rerun the connector gate and same-session refusal gate against the final source for the Bearer acceptance and malformed PATCH 400 changes. Preserve/replace historical proof through the orchestrator's evidence process; existing published evidence is unchanged and is not claimed as post-fix live acceptance. Security audit (task 2) and 03-18 were not run.

## Orchestrator acceptance (2026-10-16)

Reviewed commits `078888cb`, `250aed0a`, `2240a430`, `3102a85c` and `98551c0a`: no attribution, no credential, no content-type or evidence change, activation defaults still false. Rechecked on `57756d14`: backend test compilation (two WINDOWS.md entry 11 exclusions only) passes; auth, PATCH, token CLI, seed defaults, projection contract, security, auth integration and the byte-exact 47-envelope replay pass 58/58 with none skipped; `pnpm --dir apps/csrm api:check` passes.

**Live rerun decision:** not rerun. WR-01 only widens accepted `Authorization` forms; the connector's captured form (`Bearer` followed by one space and the token) was accepted before and still is, and token bytes are validated exactly as before. WR-02 turns an exception on a malformed selector escape into a SCIM 400 before any write; the connector never emits such a selector. Neither change alters any request or response the connector or the refusal gate exchanges, and the byte-exact replay of the captured traffic through the mounted HTTP stack passes on the final source. Live capture and refusal evidence therefore remain valid for the final source. IN-03 (remote 409 kept as 503 under P3-19), IN-04 (P3-36, Phase 4) and IN-05 (discovery wording) are accepted as recorded.
