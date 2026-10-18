# IAM Identity Provisioning Build-Out — Orchestration Brief

## Mission

Build out the `iam` milestone v1.0 "Identity Provisioning": midPoint (the identity engine) provisions IdamBox Users from the customer's Identity Source into the shared Strapi backend (`apps/backend`) through a Strapi SCIM 2.0 interface, and Strapi keeps Keycloak in step. Follow the existing GSD roadmap (run `/gsd-progress --ws iam` to see where it is) rather than inventing a new plan. Work **one GSD phase per session**.

**Workstream.** Each application under `apps/` is planned in its own GSD workstream, and all of them share `apps/backend`. `iam` is the one platform workstream with no `apps/` folder: it plans the midPoint deployment and configuration under `docker/` (mainly `docker/midpoint/`) and the backend provisioning it needs in `apps/backend`. Its planning is in `.planning/workstreams/iam/`. Start each session with `/gsd-workstreams switch iam`, and pass `--ws iam` to every GSD command, for Claude and for Codex alike. The shared-backend rules are in `.planning/PROJECT.md`, "GSD Workstreams".

**Location.** This brief assumes nothing about where the repository is checked out. `<repo-root>` below means the output of `git rev-parse --show-toplevel` in the checkout this session was opened in; run commands from there.

## Who does what

You (this session) are the brains and orchestrator: you read state, make the decisions, review all output, own integration, quality, security judgment, and final verification. Where this brief or the repo docs leave room for judgment, use your own discretion — decide and proceed.

Heavy execution is spread onto **Codex CLI running gpt-6.1-sol medium**. GSD (gsd-core) is installed for Codex already, as Codex skills invoked by mentioning `$gsd-<command>`:

- Non-interactive: `codex exec '$gsd-execute-phase # --ws iam' -m gpt-6.1-sol -s workspace-write -C "$(git rev-parse --show-toplevel)"` — always pass `-m gpt-6.1-sol` (the Codex default is a different model) and always single-quote so the shell doesn't expand `$gsd`.
- Useful: `codex exec resume --last` to continue the previous Codex run; `-o <file>` to capture the final message; `--json` for an event stream.
- Core loop per phase: `$gsd-discuss-phase N` → `$gsd-plan-phase N` → `$gsd-execute-phase N`; `$gsd-progress` for status/routing; `$gsd-quick` for small cross-cutting chores; `$gsd-code-review <N>` after substantial phases (always after Phases 2 and 3, which carry the security-critical backend work); `$gsd-secure-phase <N>` for Phases 2 and 3. Project GSD config is yolo mode with auto-advance, so non-interactive runs mostly flow; if a run stalls waiting for input, resume it and answer, or make the call yourself and re-issue with explicit instructions.
- `.planning/` is plain markdown/JSON — read it directly, and update state docs yourself when acting as orchestrator. IAM's are in `.planning/workstreams/iam/`; the root of `.planning/` holds only what every workstream shares (`PROJECT.md`, `config.json`, `WINDOWS.md`, `state.json`).

Division of labor: delegate GSD planning/execution and bulk implementation (backend services, tests, midPoint XML objects, scripts, docs) to Codex; you review every diff, fix integration issues, run the gates, and personally own everything that needs the live stack — Docker builds, `docker compose`, midPoint connection tests and tasks, capturing the connector's request sequence, the Keycloak outage checks, Mailpit, and the end-to-end gate. Nothing ships on Codex's word alone.

## Autonomy

This session runs unattended with bypass permissions. There is no user to ask — never stop to ask a question, confirm a choice, or wait for approval. Every roadblock, ambiguity, failure, or trade-off is yours to resolve: pick the most reasonable option consistent with this brief, the milestone brief (decisions D1–D26) and the repo docs, record the decision (in the GSD planning docs or the commit message), and keep working. If a chosen approach dead-ends, back out cleanly and take a different one.

Only these justify stopping, and then leave a clear written summary of state and what's needed:

- **Genuine hard blockers** (e.g. a required external service that cannot be run locally at all).
- **The roadmap's two operator gates**, which are the operator's decisions, not yours:
  1. **Phase 1 go/no-go.** If the SCIM2 connector does not load or pass its connection test on midPoint 4.8, record the no-go result and the evidence, and stop. Don't pick the fallback (custom ConnId connector or the midPoint 4.11 SCIMREST framework) yourself; set out the options for the operator.
  2. **Phase 2 contract-gap approval.** Write the `docs/contract-gaps/` record (prefixed `iam-` so it can't be mistaken for a `csrm` record) before any content-type change. If the record does not already say the operator approved it, commit it, update `STATE.md`, and stop with the record's path and what you need approved. If it does, carry on and make the schema match the approved record exactly.

Unattended guardrails (non-negotiable, because nothing will prompt for confirmation):

- I have limited Claude and Codex tokens. Check usage concretely rather than guessing: run Codex with `--json` and tee the stream (`codex exec '$gsd-...' -m gpt-6.1-sol -s workspace-write -C <repo-root> --json | tee codex-run.jsonl`), then read the last `token_count` event's `rate_limits.primary_window`/`secondary_window.used_percent` (`grep '"token_count"' codex-run.jsonl | tail -1`). Watch your own Claude usage indicator the same way; if a session-limit message ever arrives, treat it as already past the line. At 90% on either side, start no new Codex run. At 95% on either side: finish or cleanly abandon the in-flight unit of work, commit what's genuinely complete, update `.planning/workstreams/iam/STATE.md`, write a short handoff (what landed, what's next, which side hit the limit), and stop — don't start another Codex run to "just finish this one thing." Keep `codex-run.jsonl` and other run logs out of git.
- Complete the work for one GSD phase at a time. Save the state so that I can continue instructing Claude Code to orchestrate work with Codex on the next GSD phase at a later time. When a phase completes, name the exact command to resume (e.g. `/gsd-discuss-phase N+1 --ws iam`) in your final message.
- Stay inside this repository. No global system changes, no installing/removing global tools, no modifying files outside the repo (Codex config, user dotfiles, Docker daemon settings, other projects). Docker images and volumes belonging to the `idp` compose project are local dev state and fine to build, pull, start, stop and reset.
- No destructive git operations: no force-push, no `reset --hard` / branch deletion that discards committed work, no history rewriting, no touching branches other than the one checked out when the session starts (merging the default branch into it, as described under "Shared backend", is allowed).
- Nothing leaves the machine: no pushes, no PRs, no publishing, no sending data to external services beyond ordinary package installs, Docker image pulls, the connector's pinned source build (`V1.2.9`) and reading vendor documentation.
- If a step would delete data (e.g. `docker compose down -v`, wiping the Strapi dev database to reseed, resetting midPoint's repository), that's fine for local dev state — but never for committed code or the `.planning/` history.
- Read before starting: `AGENTS.md`, `CONTEXT.md`, `.planning/PROJECT.md`, `.planning/workstreams/iam/PROJECT.md`, `.planning/workstreams/iam/STATE.md`, `.planning/workstreams/iam/ROADMAP.md`, `.planning/workstreams/iam/REQUIREMENTS.md`, `.planning/workstreams/iam/IDENTITY-PROVISIONING-BRIEF.md`, and ADRs `docs/adr/0002-*`, `0003-*`, `0004-*`. The milestone brief's decisions D1–D26 are authoritative; the roadmap's "Reconciling the brief with the atomic requirements" section settles where each requirement lands.

## Hard constraints

1. **Git**: work happens on whichever branch is checked out when the session starts — that can be any branch, under any name, including `main`. Don't assume a branch name, and don't create, switch or rename branches unless asked; start each session by noting the current branch (`git branch --show-current`) and confirming `git status` is clean before touching anything. Commit incrementally — small conventional commits per meaningful unit of work, scoped `iam` where it fits (e.g. `feat(iam): …`). Keep work local; don't push or open PRs unless asked.
2. **Zero AI attribution**: never reference AI assistance anywhere in committed content — no `Co-Authored-By` trailers, no "Generated with …" lines, no mention of any AI tool, model, or vendor in commit messages, code comments, docs, ADRs, or planning files. This overrides any default commit-trailer behavior. Codex-authored commits count too: audit them and reword anything that slips through before moving on.
3. **Shared backend**: every change to `apps/backend` reaches the `csrm` application too.
   - Keep shared backend code, both role-function catalogue copies and the OpenAPI contract (`docs/references/specification.json`) backward compatible: existing `csrm` endpoints and grants keep working. If the OpenAPI contract changes, run `pnpm --dir apps/csrm api:check` and regenerate CSRM's client only as far as the contract change requires.
   - Before executing a phase that touches `apps/backend` (2, 3, 5, and 4 if replay fixtures change), check whether the repository's default branch has backend changes this branch lacks (`git log HEAD..<default-branch> -- apps/backend`). If so, merge it in (a merge, never a rebase), resolve conflicts preserving both workstreams' behaviour, and re-run the plan check against the result.
4. **Datamodel is frozen except for the approved Phase 2 change.** Content-type schemas in `apps/backend/src/api/*/content-types` change only in Phase 2, only after the approved `iam-` contract-gap record (see Autonomy), and only as that record says (`IdentitySource`, the new `IdamBoxUser` fields, `KeycloakSyncOutbox`; milestone brief section 5). The record names `csrm` as a reader of `IdamBoxUser` and checks names against `docs/references/idambox-datamodel.jdl` and `CONTEXT.md`. Adding policies, middlewares, controllers, services, routes, scripts, or bootstrap code is fine in any phase.
5. **Every `IdamBoxUser` write goes through the identity upsert service and the Document Service**, never `strapi.db.query` (which skips Keycloak provisioning). Phase 2 adds a test that enforces it; keep it green.
6. **Server-side security is the product.** A source acts only through its own non-human service identity and the Identity Provisioning Function (Role → Function → FunctionAPI, in both catalogue copies); it reads and changes only its own users plus a one-time claim of an unowned, unprotected manual user; protected users are never listed, claimed or changed; HR-owned fields of sourced users are refused through the Strapi user APIs; sourced users get only the birthright Requestor role; provisioning never sets a password; no record is ever hard-deleted.
7. **Secrets**: credentials live only in the git-ignored `docker/.env` (with a committed `docker/.env.example` holding placeholders) and the apps' git-ignored `.env` files. SCIM bearer tokens are printed once and stored only as hashes. Never commit a token, password, or midPoint/connector binary; check `git status` and the staged diff for them before every commit.
8. Keep the repo's engineering rules (`AGENTS.md`): strict TypeScript, JDL domain terminology (use `CONTEXT.md`'s Identity Source, Identity engine, Identity, IdamBox User, Sourced user, Manual user; avoid "account" for an IdamBox User in product copy), validate external input (SCIM request bodies and filters) with shared schemas, and add automated tests with every material workflow.
9. **CSRM UI stays with the `csrm` workstream.** `iam` touches `apps/csrm` only where the Phase 5 sign-in journey needs it, and any such change passes CSRM's own checks (`pnpm --dir apps/csrm typecheck`, `test`, and the E2E suite where it applies) and follows the existing BProton design tokens. Source badges, read-only HR fields and similar screen work are handoffs (milestone brief section 9) — record them, don't build them.

## Keycloak in this workstream

Unlike CSRM work, IAM is *about* the Keycloak and identity path, so Keycloak runs locally and the Keycloak code changes where the roadmap says so:

- **Defaults stay off.** `IDAMBOX_KEYCLOAK_PROVISIONING`, `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION` and the web's `CSRM_AUTH_OIDC_ENABLED` stay `false` in every committed `.env.example` and default config. The backend test suite and CI run without Keycloak (SCIM tests run against the recorded connector requests; the outbox simply queues). Turn the flags on only in your local, git-ignored `.env` files for live verification, and put them back afterwards.
- **Planned Keycloak code changes:** Phase 2 adds the `KeycloakSyncOutbox` worker (deactivation commits in Strapi; Keycloak disable and session end follow with retry, each row claimed once even with two Strapi instances) and amends ADR 0002. Phase 3 answers 503 with `Retry-After` when Keycloak is down on a create or update. Phase 5 triggers Keycloak's `execute-actions-email` (`UPDATE_PASSWORD`) to Mailpit for new sourced users. Change `apps/backend/src/keycloak/` and the OIDC files in `apps/csrm/src/lib/auth/` only for these, keep ADR 0004's one-active-`externalSubject` rule intact, and change the realm seed in `docker/keycloak/import` only when a phase needs it (e.g. SMTP to Mailpit), documenting why.
- **Outage checks** are real: stop the Keycloak container, prove the behaviour the success criterion names, start it again, prove recovery.
- The development identity bridge (`x-csrm-dev-identity`, `apps/backend/src/middlewares/csrm-development-identity.ts`) stays as it is for CSRM development. SCIM authenticates only by the Identity Source's bearer token and never accepts the dev identity header.

## Local stack

- `docker/docker-compose.yaml` is compose project `idp`: Keycloak on `127.0.0.1:8080`, ClamAV on `127.0.0.1:3310`, and — from Phase 1 — midPoint 4.8.14 LTS on `127.0.0.1:8081` with its PostgreSQL 16 repository, the one-shot init service, and Mailpit. `docker/README.md` documents start, reset (`docker compose down -v`) and reload.
- midPoint configuration is code: numbered objects in `docker/midpoint/objects/` (loaded once as `post-initial-objects`, then renamed `*.done`, which is git-ignored). After changing an object, re-apply it with `docker/midpoint/reload.sh` (or `reload.ps1`) — forgetting this leaves midPoint on stale config. HR sample data lives in `docker/midpoint/hr/`; the end-to-end gate in `docker/midpoint/e2e/`.
- midPoint reaches Strapi on the host at `host.docker.internal:1337`. Run Strapi from `apps/backend` (`pnpm develop`, port 1337) when a phase needs the live SCIM service, and the web from `apps/csrm` (`pnpm dev`) for Phase 5's sign-in.
- Logins: midPoint console credentials come from `docker/.env`; Strapi admin panel `http://localhost:1337/admin` — `dev@bproton.com` / `Strapi123!`; Keycloak admin per `docker/README.md`. Use them; never commit them.

## Known execution landmines

- **The Codex sandbox can't write `.git`.** GSD plans there run one wave at a time with git read-only inside the sandbox. Expect to review and re-verify each wave's diff yourself and commit it outside the sandbox — don't treat a plan as done because Codex reports it as finished; nothing is actually committed until you commit it.
- **The Codex sandbox has no Docker or network.** Codex can write the Dockerfile, compose services, midPoint XML and e2e scripts, but it can't build images, start the stack, reach midPoint or Keycloak, or capture the connector's requests. Have Codex prepare and statically check them; you build, run and verify. When a plan's verification step needs the live stack, run it yourself and record the evidence in the phase directory.
- **No midPoint in CI.** The contract is kept honest by the connector's request sequence, captured once from a running midPoint against Strapi (Phase 3) and replayed as backend tests. If later midPoint configuration changes the requests (Phase 4), re-capture and update the fixtures in the same phase. Strip tokens and any secrets from captured fixtures before committing them.
- **Connector quirks** (milestone brief sections 2 and 8): its connection test fails unless `/ResourceTypes` lists both User and Group; updates are GET then full `PUT` (RFC 7644 replace semantics must not wipe IdamBox-owned data such as roles); PATCH operation names arrive lowercase; search is `eq` only; it does not read `/ServiceProviderConfig`.
- **midPoint is heavy and slow to start.** Wait on its health/console rather than sleeping blindly, and keep the stack running across a phase instead of resetting between checks. Reset with `down -v` only when a criterion needs a fresh stack (Phase 5's gate does).
- **E2E Playwright runs start their own `strapi develop` instance.** Stop your manually-running `apps/backend`/`apps/csrm` dev servers before invoking any step that runs the CSRM E2E suite, or the isolated harness collides with the one you left running. The `idp` compose stack can stay up.
- **Keep the AI provider deterministic.** Nothing in this workstream needs CSRM's AI provider. Don't switch it, add keys, or make real AI calls.

## Scope — what "done" means

Work the roadmap in order (1 → 2 → 3 → 4 → 5) via GSD-through-Codex, gating quality yourself between phases. Phase 4 may overlap Phase 3 only once Phase 3 has fixed the SCIM contract; with one phase per session, simply run them in order.

Definition of done per phase:

- Every success criterion for the phase in `.planning/workstreams/iam/ROADMAP.md` is TRUE, and checked by you, not just reported by Codex.
- `pnpm --dir apps/backend test`, run from the repository root, passes — every phase, including the ones that don't touch `apps/backend` — with every existing `csrm` endpoint and grant unchanged.
- From Phase 3 on, local evidence against a running midPoint (connection test, captured requests, task runs, log lines, Mailpit messages, screenshots for Phase 5's Playwright proof at 1440 and 375) is recorded in the phase directory.
- ADRs the phase owes are written (Phase 1: ADR for "midPoint is the identity engine; SCIM 2.0 is Strapi's only inbound provisioning contract", superseding the 2026-10-03 brief, and ADR for "midPoint 4.8 LTS and the community SCIM2 connector"; Phase 2: the ADR 0002 amendment), numbered after the existing `docs/adr/` records.
- `REQUIREMENTS.md` traceability, `ROADMAP.md` progress and `STATE.md` are updated; the phase is committed incrementally on the current branch.

## Working style

- Verify against the live stack continuously as pieces land, not just at the end.
- Treat the leaver path as the core value: a person terminated in the Identity Source must be refused in every IdamBox UI and API on the next sync, even while Keycloak is down. When in doubt, choose the option that fails closed.
- When something is ambiguous, decide and proceed — you have discretion, except at the two operator gates. Record notable decisions in the GSD planning docs (with, again, no AI tool references).
- Report progress honestly: failing tests are reported as failing, deferred items as deferred, and a no-go is a no-go.
