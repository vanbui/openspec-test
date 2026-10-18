---
phase: quick
plan: 260901-qri
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/playwright.config.ts
  - apps/web/e2e/harness-urls.ts
  - apps/web/e2e/requestor-request-workflow.spec.ts
  - apps/web/e2e/questionnaire-workflow.spec.ts
  - apps/web/e2e/assessment-release-workflow.spec.ts
  - apps/web/e2e/risk-register-workflow.spec.ts
autonomous: true
requirements:
  - FOUND-05
must_haves:
  truths:
    - Each Playwright invocation derives its Strapi and Next ports from the runner process PID, uses two disjoint valid high-port ranges, and never binds, probes, kills, or reuses live ports 1337 or 3000.
    - Playwright baseURL, both webServer commands and readiness URLs, the Next-to-Strapi API base, all Strapi health checks, and the secondary assessment browser context use the same per-run origins.
    - Playwright performs supported best-effort graceful shutdown for both managed servers and retains its forceful process-group fallback when graceful signals are unavailable or time out.
    - Two immediately consecutive complete E2E runs pass, followed by green TypeScript and Vitest gates.
  artifacts:
    - path: apps/web/playwright.config.ts
      provides: Per-run port derivation, shared harness origins, isolated server configuration, and teardown policy
    - path: apps/web/e2e/harness-urls.ts
      provides: Fail-closed access to the runner-provided Strapi and Next origins for E2E specs
    - path: apps/web/e2e/assessment-release-workflow.spec.ts
      provides: Dynamic Strapi health and secondary browser-context URLs
  key_links:
    - from: apps/web/playwright.config.ts
      to: apps/web/e2e/harness-urls.ts
      via: runner-set CSRM_E2E_STRAPI_ORIGIN and CSRM_E2E_WEB_ORIGIN environment variables inherited by Playwright workers
      pattern: CSRM_E2E_(STRAPI|WEB)_ORIGIN
    - from: apps/web/playwright.config.ts
      to: apps/web/next.config.ts
      via: per-invocation CSRM_NEXT_DIST_DIR retained in the Next webServer environment
      pattern: CSRM_NEXT_DIST_DIR
---

<objective>
Make complete Playwright suite invocations collision-free and rerunnable by assigning each invocation isolated Strapi and Next ports derived from `process.pid`, threading those origins through every harness consumer, and strengthening managed-server teardown.

Purpose: Prevent a just-finished or concurrent E2E invocation from colliding with fixed 1338/3100 listeners while guaranteeing the test harness never touches live development services on 1337/3000.
Output: A dependency-free dynamic-port harness, fail-closed E2E URL access, supported best-effort teardown settings, one atomic conventional code commit, and two consecutive green full-suite runs plus typecheck and unit tests.
</objective>

<execution_context>
@gsd-core/workflows/execute-plan.md
@gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@apps/web/AGENTS.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@apps/web/package.json
@apps/web/playwright.config.ts
@apps/web/next.config.ts
@apps/web/e2e/requestor-request-workflow.spec.ts
@apps/web/e2e/questionnaire-workflow.spec.ts
@apps/web/e2e/assessment-release-workflow.spec.ts
@apps/web/e2e/risk-register-workflow.spec.ts
@apps/web/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/distDir.md

The installed Next.js 16.3.3 guide confirms that `distDir` must remain inside the project directory; preserve the existing `.tmp/playwright-next-{UUID}` behavior. The installed Playwright 1.58.2 `TestConfigWebServer` contract supports `gracefulShutdown` with `SIGTERM` or `SIGINT` plus a bounded timeout, then forcefully terminates the process group if needed; on Windows the graceful signal is ignored and Playwright's existing forceful process-group shutdown remains the fallback.
</context>

<preflight>
From the repository root, confirm `node --version` is exactly `v24.19.0`, `git branch --show-current` is `dylan-test`, record `git rev-parse HEAD`, and record `git status --short`. Preserve every unrelated dirty or untracked path exactly as found, including `apps/web/next-env.d.ts`, `apps/web/tsconfig.json`, `.planning/debug/`, `.planning/phases/05-risk-register-and-mitigation-management/05-REVIEW-FINDINGS.md`, and `apps/web/.tmp/`; do not clean, reset, delete, stage, or overwrite them. Do not install dependencies, edit lockfiles, weaken/skip/focus tests, amend or rewrite history, add AI attribution, or push. Do not inspect, kill, bind, probe, or reuse services on ports 1337 or 3000.
</preflight>

<tasks>

<task type="auto">
  <name>Task 1: Isolate Playwright ports, thread harness origins, and prove clean reruns</name>
  <files>apps/web/playwright.config.ts, apps/web/e2e/harness-urls.ts, apps/web/e2e/requestor-request-workflow.spec.ts, apps/web/e2e/questionnaire-workflow.spec.ts, apps/web/e2e/assessment-release-workflow.spec.ts, apps/web/e2e/risk-register-workflow.spec.ts</files>
  <action>In `playwright.config.ts`, derive one bounded run slot from the Playwright runner's `process.pid`, then derive Strapi and Next ports from separate non-overlapping high-port ranges that always remain within 1-65535 and can never equal 1337 or 3000. Build `strapiOrigin`, `strapiHealthUrl`, `webOrigin`, and the Strapi `/api` base exactly once. Assign the two origins to clearly named `CSRM_E2E_STRAPI_ORIGIN` and `CSRM_E2E_WEB_ORIGIN` environment variables before `defineConfig` is evaluated so Playwright workers inherit the same values; do not recompute ports inside workers because their PIDs differ from the runner. Replace every fixed 1338/3100 value in `use.baseURL`, Strapi `PORT`, both webServer readiness URLs, the Next command's `--port`, and `CSRM_API_BASE_URL` with the derived values. Retain `reuseExistingServer: false`, the UUID-isolated SQLite filename, UUID-isolated in-project Next dist directory, Node/Corepack invocation, serial workers, current timeouts, and all existing development/seed/security environment gates. Add bounded `gracefulShutdown` settings to both Playwright-managed web servers using the installed Playwright contract; rely on Playwright's documented force-kill fallback rather than adding shell-specific process killing or broad `.tmp` deletion.</action>
  <action>Create `e2e/harness-urls.ts` as a dependency-free strict-TypeScript helper that reads the two runner-provided origin variables, validates that each is an absolute loopback HTTP origin with a valid port, and throws a clear configuration error when missing or malformed. Export the Strapi health URL and web origin (or named accessors returning them). Update the four workflow specs to use the shared dynamic Strapi health URL instead of literals; update the assessment release spec's secondary `browser.newContext` to use the shared dynamic web origin. Do not change browser assertions, workflow behavior, retries, production API code, or unrelated 1337 examples in README/env/test fixtures. Run the required gates from `apps/web` in the exact order below, with the second E2E command started only after the first exits successfully. Inspect `git diff --check` and `git status --short`, stage only the six task-owned files, and create one atomic conventional commit such as `fix(web): isolate playwright run ports` with no AI attribution. Never push.</action>
  <verify>
    <automated>cd apps/web &amp;&amp; pnpm test:e2e &amp;&amp; pnpm test:e2e &amp;&amp; pnpm typecheck &amp;&amp; pnpm test</automated>
  </verify>
  <done>Both consecutive full Playwright invocations pass using distinct PID-derived Strapi and Next ports; every config/spec URL in the E2E harness agrees within an invocation; Playwright tears down both managed servers best-effort without any custom broad kill; typecheck and Vitest pass; no live 1337/3000 service, unrelated dirty file, dependency, lockfile, or remote branch is touched; the implementation is captured in one conventional atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| Playwright runner to worker processes | The runner must supply one authoritative pair of origins; workers must not derive a different pair from their own PIDs. |
| Playwright runner to managed Strapi/Next processes | Commands, readiness probes, browser navigation, and server-to-server API calls must agree on the same isolated ports. |
| Managed test processes to developer machine | Teardown may terminate only Playwright-owned process groups and must not target live development ports or broad process names. |
| Dirty worktree to task commit | Existing user-owned modifications and runtime artifacts must remain preserved and unstaged. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|---|---|---|---|---|
| T-260901-QRI-01 | Denial of Service | Strapi and Next listener allocation | mitigate | Derive disjoint valid high ports from one runner PID and remove every fixed harness listener reference. |
| T-260901-QRI-02 | Tampering | Worker harness origins | mitigate | Set origins once in the runner and validate inherited loopback HTTP origins in a shared helper; fail closed on missing/malformed values. |
| T-260901-QRI-03 | Denial of Service | Managed server teardown | mitigate | Configure bounded graceful shutdown for both web servers and retain Playwright's process-group force-kill fallback. |
| T-260901-QRI-04 | Elevation of Privilege | Developer services on 1337/3000 | mitigate | Never bind, probe, reuse, or kill these ports; all E2E consumers use the derived high-port origins. |
| T-260901-QRI-SC | Tampering | Package supply chain | accept | No dependency or package-manager installation is needed or permitted. |
</threat_model>

<verification>
From `apps/web`, run these commands separately and in this exact sequence so the two E2E results are independently visible:

1. `pnpm test:e2e`
2. `pnpm test:e2e`
3. `pnpm typecheck`
4. `pnpm test`

Afterward, run `git diff --check`, inspect the final diff and `git status --short`, and compare them with preflight. Confirm the only task changes are the six declared files, the pre-existing dirty/untracked work remains intact, no dependency or lockfile changed, the commit is conventional and atomic, and no push occurred. The second E2E invocation is the teardown/collision proof: it must start only after the first exits and must bind a newly PID-derived pair rather than reusing the first pair or any fixed development port.
</verification>

<success_criteria>
- One Playwright invocation has one authoritative PID-derived port pair shared by configuration, managed processes, readiness probes, browser fixtures, direct health checks, and secondary browser contexts.
- Consecutive invocations choose new harness ports and both complete without address-in-use collisions or stale-server reuse.
- Best-effort graceful teardown is bounded and Playwright-owned, with the existing forceful process-group fallback preserved.
- `pnpm test:e2e`, `pnpm test:e2e`, `pnpm typecheck`, and `pnpm test` all pass in that order from `apps/web`.
- Node remains v24.19.0, branch remains `dylan-test`, nothing is pushed, no AI attribution is added, live ports 1337/3000 are untouched, and unrelated worktree changes are preserved.
</success_criteria>

<source_audit>

| Source | ID | Requirement | Task | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Make consecutive Playwright runs collision-free with PID-derived Strapi/Next ports, threaded E2E references, resilient teardown, and the exact four-command proof | 1 | COVERED | Complete quick-task outcome. |
| REQ | FOUND-05 | Maintain reproducible automated end-to-end test infrastructure | 1 | COVERED | Harness-only reliability change. |
| RESEARCH | — | No research phase | — | EXCLUDED | Quick-mode constraint explicitly disables research; installed Next and Playwright contracts were verified locally. |
| CONTEXT | — | Node v24.19.0; branch dylan-test; conventional atomic commit; never push; no AI attribution; never touch 1337/3000; preserve dirty worktree | Preflight, 1, verification | COVERED | All quick-task ground rules are explicit gates. |
</source_audit>

<output>
Create `.planning/quick/260901-qri-make-consecutive-playwright-runs-collisi/260901-qri-SUMMARY.md` when execution is complete, then update only the `.planning/STATE.md` Quick Tasks Completed table and quick-task continuity metadata as required by the quick workflow. Do not update ROADMAP.md or change the current Phase 5 status.
</output>
