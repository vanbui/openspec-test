---
gsd_state_version: "1.0"
milestone: v1.0
milestone_name: Identity Provisioning
status: Awaiting next milestone
stopped_at: v1.0 milestone completed (override_closeout); audit tech_debt 24/24, see milestones/v1.0-MILESTONE-AUDIT.md
closeout_type: override_closeout
last_updated: "2026-10-19T10:29:46.950Z"
last_activity: 2026-10-19
last_activity_desc: Milestone v1.0 completed and archived
state_head: d28ebfaf02b5efe4a040a786d0c53f411c114597
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 80
  completed_plans: 80
  percent: 100
current_phase: 5
current_phase_name: Sign-in and end-to-end journey
---

# Project State

## Project Reference

See: `.planning/workstreams/iam/PROJECT.md` (updated 2026-10-19)

**Core value:** A leaver in the customer's Identity Source loses access to every IdamBox product on the next sync, without anyone remembering to do it, and no external system can grant IdamBox roles.
**Current focus:** Planning next milestone (v1.0 Identity Provisioning shipped 2026-10-19)

## Current Position

Phase: Milestone v1.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-10-19 — Milestone v1.0 completed and archived

## Performance Metrics

**Velocity:**
- Total plans completed: 33
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 5 | ~4 h (incl. review) | delivered directly, see 01-SUMMARY.md |

*Updated after each plan completion*

## Accumulated Context

### Decisions

The brief's decisions D1–D26 (`.planning/workstreams/iam/IDENTITY-PROVISIONING-BRIEF.md`) are authoritative; PROJECT.md's Key Decisions table carries the headline ones. Roadmap placements (2026-10-13, see ROADMAP.md "Reconciling the brief with the atomic requirements"):

- [Roadmap]: Five phases as in brief section 7 (D25), kept under fine granularity because a finer cut would create thin phases.
- [Roadmap]: PLAT-03 (reload script) moves to Phase 1; Phase 4 uses it.
- [Roadmap]: LIFE-01 → Phase 3 (names SCIM); LIFE-02 stays in Phase 2.
- [Roadmap]: LIFE-04, ENG-04 and PROV-06 → Phase 4; Phase 3 builds the 503 with `Retry-After` and the Strapi SCIM log line, and Phase 2 enforces the one-time claim.
- [Phase 1]: Connector gate GO (ADR 0006). midPoint `evolveum/midpoint:4.8.14-alpine` + SCIM2 connector `V1.2.9` (commit 05c404bb, fatJar, BUILD_NUMBER=0) built in `docker/midpoint/Dockerfile`; image `idambox/midpoint:4.8.14-scim2-1.2.9`.
- [Phase 1]: midPoint objects are mounted read-only and seeded once into the home volume (deviation from D23's read-write mount: midPoint's `*.done` renames would otherwise touch tracked files). Reload is a REST `PUT` per object (`docker/midpoint/reload.sh`/`.ps1`), not `ninja import`, so changes pass through midPoint's caches.
- [Phase 1]: The Keycloak realm import and its local test fixtures are unchanged; only the Keycloak bootstrap admin moved to `docker/.env`.
- [Phase 1]: The spike resource uses a placeholder token (the stub does not authenticate). Phase 4 P4-02 resolves real source-token delivery through the shared seed/reload renderer and explicit runtime environment; application remains pending.
- [Phase 1]: midPoint 4.8's default password policy caps passwords at 14 characters.
- [Phase 2]: Existing-user deactivation commits with durable `KeycloakSyncOutbox` work; creates, other mirrored updates and reactivation still block on Keycloak (ADR 0002, amended 2026-10-15).
- [Phase 2]: The Identity Provisioning Role is recognised by its Function and can be attached only by the trusted registration grant, to a protected user with exactly one source binding (CR-01 fix).
- [Phase 2]: The worker bounds its own database coordination with transaction-local PostgreSQL `lock_timeout`/`statement_timeout` (at most 1 s); ordinary user writes are not bounded. Work interrupted by shutdown keeps its lease for expiry recovery.
- [Phase 3]: The pinned SCIM2 connector sends `Accept: application/json` and `Content-Type: application/json` on every request (observed live 2026-10-16). The SCIM boundary negotiates: `application/scim+json` when acceptable, otherwise `application/json` (RFC 7644 section 8.1), 406 only when neither is. With that fix midPoint's connection test passes against Strapi.
- [Phase 3]: `scim:token` boots Strapi in an administration mode (identity invariants and registration lock only; no seeds, fixtures or workers) and keeps stdout for the one token line, so it can run beside a dev server and be piped.
- [Phase 2]: The Document Service-only write guard is a TypeScript semantic inventory in the ordinary unit suite; it must cover more than 100 files, so it can never pass vacuously.

- [Phase 3, 03-03]: SCIM parsing delegates final source DTO validation to the shared parser; replacement clears omitted optionals and outbound mapping uses an explicit public allowlist.

- [Phase 3, 03-02]: Development export validates the exact seeded source before issuance and again before delivery. Failed delivery revokes only its own credential under the source lock, preserving a newer concurrent rotation.

- [Phase 3, 03-04]: Follow P3-17 pagination normalization and the 500 cap. Refine LIKE-sensitive literals in scoped 500-row batches before counts/paging; ordinary comparisons keep database count/page behavior.

- [Phase 3, 03-05]: Reduce PATCH only inside the shared lock against the frozen public projection; retain protocol path/noTarget failures and resolve uniqueness after rollback.

- [Phase 3, 03-06]: Keep source authority private to the request and backend instance; persist activity independently before grants/parsing/user transactions and recheck current credentials and exact grants in the explicit policy.

- [Phase 3, 03-07]: Reuse the installed body parser with a request-local SCIM media predicate; preserve CSRM settings and cap nonstandard-method bodies through the same parser. IP/source buckets never evict active budgets.

- [Phase 3, 03-08]: Discovery uses the wire URNs and closed errors, returns fresh descriptors per call and exposes no persistence authority. All eight Group write routes will reuse the fixed 501 helper after source policy/throttling in 03-09.

- [Phase 3, 03-09]: Mount once through the root manager without a routing type; preserve literal {id} catalogue grants alongside :id router parameters. Use the existing identity service for every User read/write.

- [Phase 3, 03-10]: HTTP conformance retains P3-33–P3-35 asserted PUT/email behavior and the existing binding constraint; independent source activity is observed separately from rolled-back user state.
- [Phase 3, 03-11]: Publish root operation servers and negotiated JSON media; observe actual root registration/configuration and Koa layers, with source-bearer distinct from CSRM token authentication. Existing contract, grants and unrelated inventory records remain unchanged.

- [Phase 3, 03-13]: midPoint 4.8.14 does not pass shadow-search paging to the connector; an unpaged connector list gets the server default of 100 users (P3-36), which Phase 4 must handle. Gate runs need Keycloak flags off because Keycloak keeps earlier gate users.
- [Phase 3, 03-14]: Replay all 47 published envelopes byte-for-byte with only five declared user-id substitutions. Preserve manual candidate baseline, second-source isolation and P3-33 through P3-36; Phase 4 must recapture when request configuration changes.
- [Phase 3, 03-18]: Final gate green on `78794187`; the authorization matrix now holds one row per SCIM operation asserting 401 for every CSRM caller. A WR-01/WR-02 change that only widens accepted input and alters no connector or gate exchange does not require recapture (03-REVIEW.md orchestrator acceptance).
- [Phase 3, 03-12]: Capture only within an isolated gate listener; use explicit midPoint shadow operations and a dedicated ignored token handoff. Preserve P3-34 asserted PUT and P3-35 email shapes; missing real operations fail before evidence publication.
- [Phase 4]: Token rendered inside the container (`render.sh`, exact token format, one placeholder); no secrets provider in 4.8.14 (A1).
- [Phase 4]: The connector pages full listings itself (`pagination=true`, `importBatchSize=100`); answers P3-36 without changing Strapi's default (A4), proven on 139 users.
- [Phase 4]: Strapi's 503/429 reach midPoint as generic errors with no pending operation; durable retry is each task's retryLater trigger (5 min, then every 15 min) (A5). LIFE-04 proven live.
- [Phase 4]: Claims are native correlation cases; only the source key links automatically; decisions via console or `/rpc/executeScript` (A8).
- [Phase 4]: The CSV connector lets a duplicate key replace a person; `hr-publish.sh` validates the whole snapshot first (A2).
- [Phase 4]: Strong displayName costs one extra PUT and Keycloak update per user per IdamBox reconciliation (connector read-back defect, A6).

### Pending Todos

- Local only (operator): the git-ignored `apps/backend/.env` still has `IDAMBOX_KEYCLOAK_PROVISIONING` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION` set to true from Phase 3 live work; set both back to false unless the next live check needs them. Committed defaults are false.
- Phase 5 inherits IN-03 (remote email conflict reported as 503, not exercised in Phase 4) and the throughput note: about 150–200 users a minute under the default per-source limit (ADR 0006).
- Before Phase 5's fresh-stack gate, reset the developer data: the dev Strapi holds the reference people, 125 load users and the claimed/manual test users from Phase 4 (all fictitious).

### Blockers/Concerns

- [Phase 3, 2026-10-16]: Orchestrator live probe through midPoint and the real connector (`phases/03-strapi-scim-2-0-service/03-LIVE-PROBE.md`) found five contract gaps and fixed them (P3-33 to P3-35, commits `344bc8c9`, `b17bbaac`, `ad78a21d`, `2c164ba1`). Live: connection test passes; create 201, mover PUT+PATCH 200, leaver 200, DELETE 204 then 404. Plans 03-10 onward must build on these decisions, not on the original P3-13 clearing rule.
- [Phase 3, resolved by 03-11]: Replaced the stale unmounted-SCIM assertion and regenerated the runtime inventory. Ordinary inventory 13/13, contract 27/27 and focused SCIM regressions 71/71 pass. Full backend gate remains with the orchestrator.

- [Backend gate, RESOLVED 2026-10-19]: csrm's modules reached `main` (PR #9), `main` was merged here (PR #10), and the unfiltered backend suite passes 2576/2576. Original note: the modules exist on `origin/csrm` only, not on `main`. csrm 16-02 committed red-phase unit tests `risk-curation-rules.unit.test.ts` and `risk-history-changes.unit.test.ts` before their modules, so unfiltered `pnpm --dir apps/backend test` stops at compilation on every branch (WINDOWS.md entry 11, owner csrm). Phase 4 must re-evaluate the unfiltered baseline; the historical two-file diagnostic exclusions do not authorize a passing full-suite claim.

- [Phase 1, resolved]: Connector compatibility proven for discovery (GO). Community-support risk stays open; fallbacks are listed, unselected, in ADR 0006.
- [Phase 2 gate, CLOSED 2026-10-14]: `docs/contract-gaps/iam-identity-model-and-leaver-sync.md` approved by the operator, including private sourceIdentityKey, outbox lease/fencing fields, seeded idambox-iam Application and service birthright exclusion. The first execution task reconciles exact approved schemas; schema drift requires renewed approval.
- [Backend gate, RESOLVED 2026-10-15]: the pre-existing csrm ECONNRESET failure (`questionnaire-ai-proposals.integration.test.ts:458`) was a harness keep-alive race; fixed in `fc183567` (WINDOWS.md entry 10). The full suite is now expected to exit 0.
- [Phase 2]: Native decision parser does not recognise P2 IDs; explicit mapping and independent review cover P2-01 through P2-30. Command-path probe is not applicable to pnpm forms; creation-order/path audit is recorded in 02-VALIDATION.md.
- [Phase 2, CLOSED]: Provisioning and token-verification defaults remain false/unset. The live outage and two-process PostgreSQL gates passed on 2026-10-15 (`02-GATE-EVIDENCE.md`).
- [Operations]: Strapi instances sharing one database must run in the same time zone (UTC recommended); the outbox compares against database time in the server's zone (02-11).
- [Phase 4, measured]: First full reconciliation: 125 creates in 39.2 s with Keycloak provisioning on (about 3.2 a second); the per-source limit, not Keycloak, bounds larger runs (04-LIVE-EVIDENCE.md §6).

- [Phase 4 planning]: Pinned source evidence leaves native remote-target correlation, optional-field clearing, whole-snapshot scheduled integration and header-aware increasing retry as early live proof obligations. No weaker fallback is authorized.
- [Phase 4 planning]: Native decision parsing does not recognize P4 identifiers; explicit mapping and independent review cover 30/30. Command-path recognition is not applicable to these Node/pnpm forms; no path-probe pass is claimed.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| verification_override | Phase 1: verification lacks file fingerprint (stale); 1 consolidated summary for 5 plans | acknowledged | 2026-10-19 | v1.0 |
| verification_override | Phase 4: verification lacks frontmatter (missing); 1 consolidated summary for 32 plans | acknowledged | 2026-10-19 | v1.0 |

## Session Continuity

### 2026-10-19 session (milestone audit)

Landed: `v1.0-MILESTONE-AUDIT.md` (status gaps_found). The audit re-ran the journey unit tests (231/231), `journey.mjs --check`, and every evidence verifier (journey, contract, SCIM capture, lifecycle, refusal); all pass. It did not re-run live gates or the full backend suite. The `idp` stack stayed disposed, and no backend, schema, contract or default changed.
Resume with: `/gsd-verify-work 2 --ws iam`.

### 2026-10-19 session (Phase 5 acceptance)

Landed: B1 is closed (the unfiltered backend suite passes 2576/2576 in about 51 min). `1f47da95` gives the journey's evidence stage its own 7200 s budget: 180 s could never cover the unfiltered regressions. `72aeb261` makes the evidence verifier accept IN-03's PATCH receipts (P3-35). The fixtures had the same wrong PUT, so only a live publication could expose it. Locally, the stale git-ignored `apps/csrm/.next/dev` was removed because it broke CSRM `typecheck` after the csrm route moves (handoff recorded in 05-VERIFICATION.md). Official run `iam-journey-35607205-…` passed. The verification is in `05-VERIFICATION.md`.
Environment: the `idp` stack is disposed (no containers, volumes or networks). Developer `docker/.env` and `apps/backend/.env` were not touched. No delegated executor runs were needed in this session.
Resume with: `/gsd-audit-milestone --ws iam`.

### 2026-10-18 session (live checkpoints)

Landed: 05-11 passed on a fresh stack (`43ba478c`, run `iam-journey-bf168559-…`, `contract.json` verified). For 05-12 the full journey was driven live until every stage passed. That took 20 runner/spec fixes, listed in 05-KEYCLOAK-CONTRACT.md and 05-LIVE-EVIDENCE.md, all with regression tests and no backend, schema, grant or default change. The official `--run` at `e5964724` then passed all 29 live stages in 730 s, and the `evidence` stage failed on B1 exactly as designed (no publication, full cleanup). Journey tests 224/224, `--check` passes, CSRM typecheck passes.

Open: B1 only. To resume once the csrm modules are on `main`: merge `main` into this branch (merge, not rebase), confirm `pnpm --dir apps/backend test` passes unfiltered, then rerun the official journey with a fresh private run directory. The 05-11 launcher pattern is described in 05-KEYCLOAK-CONTRACT.md: owner-only run directory under `apps/backend/.tmp`, generated compose and backend credentials, realm-seed client fixtures, `runJourney` from `journey-runtime.mjs`. Then run `journey.mjs --verify-evidence`, update 05-VALIDATION.md, close SIGN-01/SIGN-02 and run `/gsd-verify-work 5 --ws iam`.
Environment: the `idp` stack is disposed (no containers or volumes). The developer `docker/.env` and `apps/backend/.env` were not touched. No delegated executor runs were used in this session.

### 2026-10-18 session (offline waves)

Landed (all reviewed and re-verified outside the restricted executor):
- `bfee09b3` 05-08: Requestor mover continuity and pre-expiry leaver refusal (journey tests 184/184).
- `6c39366e` Orchestrator gap closure (quick task `20261018-journey-default-bindings`): no plan owned the default Mailpit/remote observers or evidence assembly, so the default `--run` could never pass. Defaults now exist; the evidence stage cleans up, then runs the unfiltered regressions and compares frozen-contract hashes before publishing. Journey tests 218/218.
- `6b88f91b` B2 fix: `iam-journey-bootstrap.integration.test.ts` counted Strapi's own update check (`registry.npmjs.org/@strapi%2Fcore`, cached per user, so date-dependent) as journey transport. Strapi 5.51 ignores `STRAPI_DISABLE_UPDATE_NOTIFICATION`. The call is still refused but not counted.
- `b3415d21` 05-10: operating contract (`05-OPERATIONS.md`) and offline gate (`05-OFFLINE-GATE.md`).

Orchestrator re-run at `6b88f91b`: backend diagnostic suite (only the two B1 csrm files excluded) **2070/2070**; CSRM unit 5412/5412; CSRM typecheck passes. B1 (WINDOWS.md entry 11, owner csrm) still blocks the unfiltered backend gate; the default branch still lacks the csrm modules.

Stopped at 05-11 Task 1: the session's permission policy refused `docker compose --project-name idp ... down -v --remove-orphans`, which the runner requires (its preflight refuses existing idp containers/volumes). Not worked around. The leftover `apps/backend` `pnpm develop` from 2026-10-16 was stopped to free port 1337; the idp stack (Keycloak, midPoint, midpoint_data, Mailpit, ClamAV) is still running with its old volumes.

Plan for 05-11 (decided, not yet executed): no developer secret is needed. After the reset, every compose credential is generated fresh into the owner-only run directory (midPoint admin password at most 14 characters). OIDC (`idambox-csrm`) and Keycloak admin (`idambox-strapi-admin`) client credentials are the committed realm-seed fixtures, read inside the launcher process and never printed. The probe returns closed A1–A4 case records in memory only; the orchestrator writes `evidence/keycloak-contract/manifest.json` in the `verifyContractEvidence` shape and `05-KEYCLOAK-CONTRACT.md`.
Known consequence: the full `--run` evidence stage runs the unfiltered backend suite, so 05-12 cannot publish passing evidence until B1 closes (csrm merges its modules into the default branch, then the default branch is merged here).

Codex usage at stop: 5-hour window about 30%, weekly about 5%.

Last session: 2026-10-17 (wave 4 completed, reviewed and committed as `65e15658`).
Stopped at: the delegated executor's weekly usage window at 98% (5-hour window 17%), past the 95% stop line; it resets 2026-10-22 21:31 AEDT. The orchestration side was under its limit. No new delegated run was started after 05-09.
Resume with (after the reset): `/gsd-execute-phase 5 --ws iam --wave 5` (05-08 mover continuity and pre-expiry refusal), then `--wave 6` (05-10 operating contract and unfiltered offline gate). Waves 7–8 (05-11, 05-12) are orchestrator live checkpoints on a freshly reset stack.
Orchestrator decision (2026-10-17): 05-11 asks for a fully green 05-OFFLINE-GATE.md first. The only expected red is WINDOWS.md entry 11 (csrm red-phase tests whose modules exist only on the csrm branch, not on main). The live checkpoints may still run once everything iam owns is green, because the journey does not depend on those csrm tests; phase acceptance and SIGN-01/SIGN-02 closure stay blocked until the unfiltered suite passes. This fails closed for acceptance.
Environment note: node, pnpm and the delegated executor CLI live under the Node 24 nvm install (`~/.nvm/versions/node/v24.20.0/bin`), and the Docker CLI under `/Applications/Docker.app/Contents/Resources/bin`; neither is on the default PATH. The `idp` stack (Keycloak, midPoint, Mailpit, ClamAV) was left running.
Orchestrator note: the session secret guard refuses direct reads of `docker/.env`; live gate scripts must read credentials from a supplied file path inside the process and never print them.
Runtime at stop: no live stack operation. Offline backend tests used real SQLite and mounted in-process requests with injected remote transports. Journey observations were synthetic validator fixtures; no live evidence was retained.
Phase 5 execution records: `phases/05-sign-in-and-end-to-end-journey/05-02-SUMMARY.md`, `05-04-SUMMARY.md` and `05-05-SUMMARY.md` record exact results and deviations. No schema/default/contract change or dependency was introduced; the local realm change adds only SMTP configuration.
The inherited unfiltered backend compilation blocker remains open (WINDOWS.md entry 11). Focused checks do not satisfy that gate. Phase verification/completion and SIGN-01/SIGN-02 closure remain pending.

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone --ws iam
