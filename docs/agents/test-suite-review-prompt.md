# Prompt: rerun the test-suite review and apply its cleanups

Give this file to a Claude Code agent at the repository root once every GSD workstream (`.planning/PROJECT.md`, "GSD Workstreams") has finished its current phase and its code has been merged into the branch checked out for the session. It reruns every test suite, compares the results with the baseline below, and then makes the three cleanups in Part C, each only when its preconditions hold.

Follow `.planning/PROJECT.md` "Portable briefs and prompts": run commands from `git rev-parse --show-toplevel`, work on the branch already checked out (`git branch --show-current`), and don't create, switch or push branches unless the developer asks. Commit each cleanup on its own, with a conventional message, only after its checks pass.

---

## Part A: preconditions (stop and report if any fails)

1. **Workstreams settled.** For each workstream in `.planning/workstreams/*/STATE.md`, report the current phase and whether it's complete. If any phase is still executing, or its code isn't merged, stop: say which one, and ask whether to carry on anyway.
2. **No orphan test/implementation pairs.** The baseline run failed to compile because a phase's RED test commit was merged without its GREEN commit: `apps/backend/tests/risk-curation-rules.unit.test.ts` and `risk-history-changes.unit.test.ts` (csrm 16-02, test commit `aa14dc26`) import `apps/backend/src/csrm/risk-curation-rules.ts` and `risk-history-changes.ts`, which arrived only in commit `77fb9c04`. Run `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false`. Any `TS2307 Cannot find module '../src/...'` means a workstream's implementation is still missing. Find the commit that adds it (`git log --all --oneline -- <path>`), report it, and stop. Don't delete those tests or write stub implementations.
3. **Clean tree, nothing running.** `git status --short` is empty, and no `strapi develop` or `next dev` is running. The backend test harness and the Playwright Strapi server both compile into `apps/backend/dist`, so running them together corrupts it (ENOTEMPTY, then spurious 405s).

## Part B: rerun every suite and report

Run the suites one after another, not in parallel. Two `pnpm` commands started together race on pnpm's dependency check (`ENOENT … unlink node_modules/.pnpm/node_modules/vite`). Run long suites in the background and log to the scratchpad. Don't poll; wait for the completion notice.

| # | Suite | Command (from the root) |
|---|---|---|
| 1 | Web typecheck | `pnpm --dir apps/csrm typecheck` |
| 2 | API contract drift | `pnpm --dir apps/csrm api:check` (on Windows a stat-only change to `schema.d.ts` from line endings can show; if `git diff` is empty, `git checkout --` the file) |
| 3 | Web unit and component | `pnpm --dir apps/csrm test` (add `--reporter=default --reporter=json --outputFile.json=<scratch>/vitest.json` for analysis) |
| 4 | Backend (Strapi, node:test) | `pnpm --dir apps/backend test`. For per-file timing, run `node --test --test-concurrency=1 --test-timeout=600000 --test-reporter=spec --test-reporter-destination=<scratch>/backend-spec.log --test-reporter=junit --test-reporter-destination=<scratch>/backend-junit.xml .tmp/tests-dist/tests/*.test.js` in `apps/backend` after the `tsc` steps |
| 5 | Script tests | `node --test apps/csrm/scripts/verify-design-spec-authority.test.mjs`; `pnpm verify:csrm-seed` (it boots Strapi, so never alongside 4 or 6) |
| 6 | E2E (Playwright) | `pnpm --dir apps/csrm test:e2e`. Then `--last-failed` for anything that failed, and name any test that "did not run" by `file:line --project=<name>` |

Not in scope: `apps/csrm/e2e/iam-journey.spec.ts` (needs its disposable live runner) and the live-Keycloak cases of `iam-scim-refusal.spec.ts`, which skip without live infrastructure. Report them as not run, not as passing.

### Baseline to compare against (taken 2026-10-18, Windows 11, Node 24.21, `core.autocrlf=true`)

| Suite | Baseline |
|---|---|
| Web typecheck | pass, 1m40 |
| Web Vitest | 222 files, **5,412 / 5,412** pass, 3m30, 0 skipped |
| API contract | no drift |
| Backend | as checked in, **failed to compile** (the orphan pair above). With those two files left out: 145 files, **2,070 tests: 2,058 pass, 11 fail, 1 skipped**, 94 min |
| Backend timing | 83 unit files 0.7 min in total; 62 integration files 91 min, of which about 76 min is each file's first test (Strapi boot plus re-seeding 2,646 controls, 72 boots) |
| E2E | 244 tests: 224 pass, 14 fail, 2 did not run, 4 skipped, 1.9 h. All 16 passed on rerun, so **240 pass, 4 skipped** |
| CI (`.github/workflows/ci.yml`) | red or cancelled on every default-branch run checked back to 2026-09-24; its single job has `timeout-minutes: 15` |

The 11 backend failures, all Windows-only:
- `iam-scim-replay.integration` (2) and `iam-scim-replay-phase4.integration` (2): `capture.json digest`. CRLF checkout changes the bytes.
- `iam-scim-capture-tooling.unit` › "authored token handoff…": `apps\backend\.tmp\.env.scim-capture` where `apps/backend/.tmp/.env.scim-capture` is expected.
- `iam-scim-token-cli.unit` (6): POSIX 0600 modes, symlinks (`EPERM`) and hardlinks.

The 14 E2E failures: every test after the one-hour mark landed on "Sign-in unavailable", because the run attestation outlived `E2E_ATTESTATION_MAX_AGE_MS` (60 min).

### What the report must contain

1. A results table in the same shape as the baseline, with the deltas.
2. Every failure with its root cause, sorted into: product defect, harness/portability defect, environment, or missing merged code. Don't call a failure flaky without evidence (a rerun that passes, plus a cause).
3. **Are all tests needed and effective?** Recheck the baseline findings below and look for new instances in tests added since:
   - Unit and integration pairs should complement each other: unit covers pure policy and parsers, integration covers mounted HTTP, persistence and concurrency. Sample at least three pairs.
   - Assertions made redundant by a global guard. Baseline: about 9 web tests assert `not.toMatch(/\bfetch\s*\(/)` on single page files, which `apps/csrm/src/features/contract-operation-chain.test.ts` already enforces across every module. They can be removed one assertion at a time; the test files themselves stay.
   - Source-text assertions (`readFileSync(...)` plus `toContain('someFunction')`) that break on renames and catch little. Recommend replacing them with rendering tests; don't delete them outright.
   - Tests of test tooling (`iam-scim-capture-tooling`, `iam-scim-lifecycle-capture-tooling`, `iam-scim-refusal-tooling`, which test `docker/midpoint/e2e/*`). Keep them only while the live-capture process they support is still used; ask the iam workstream.
   - Tests that read `.planning/` (`iam-scim-replay*.integration`). Recommend moving the evidence they need into `apps/backend/tests/fixtures/`.
   - Duplicate test titles (baseline: one, a `%s` collision in `apps/csrm/src/features/ai-assistance/ai-run-sheet.test.tsx`; rename only).
   - Skips and todos (baseline: 1 skip, `attachment-storage.unit` on win32).
4. Which Part C cleanups ran, and the evidence for each.

---

## Part C: cleanups

Do them in the order C1, C2, C3. Each is its own commit. Rerun the affected suites after each one.

### C1. Remove old scripts that nothing runs

Candidates, all at the repository root:

| Script | Why it's dead (baseline) |
|---|---|
| `scripts/verify-phase-04-integrity.ps1` and `scripts/verify-phase-04-integrity.test.ps1` | Require exactly Node `v24.19.0`, a frozen catalogue SHA-256 and a fixed phase base commit; the test fails on any other Node |
| `scripts/verify-phase-05-integrity.mjs` | Read `.planning/phases/05-…` (moved to `.planning/workstreams/csrm/phases/`), require branch `dylan-test`, exactly Node 24.19.0 and an old catalogue hash |
| `scripts/verify-phase-06-integrity.mjs` | Read `.planning/phases/06-…` (moved), exactly Node 24.19.0, exact catalogue counts that have since grown |
| `scripts/verify-csrm-model.mjs` | Pins `csrm-information-asset` routes to `global::csrm-app-enabled`; D-44 deliberately unmounted that generic route |
| `scripts/verify-keycloak-idp.mjs` | Pins doc strings (`local-only`, …) that the Keycloak docs no longer contain |
| `scripts/verify-keycloak-provisioning.mjs` | Pins `IDAMBOX_KEYCLOAK_PROVISIONING` text that the provisioning docs no longer contain |

Keep `scripts/verify-csrm-seed.mjs` and `scripts/verify-csrm-seed-runtime.mjs` (wired to root `verify:csrm-seed`), `scripts/verify-core-model.mjs` (passes; ask before removing), `scripts/csrm-seed-control-files.mjs` and `scripts/claude-cloud-setup.sh`.

For each candidate, delete it only if all of the following hold, and report the evidence:
1. It still fails when run from the root (`node scripts/<name>.mjs`, or `pwsh -NoProfile -File scripts/<name>.ps1`), for the stale reason above rather than a new one.
2. Nothing executes it: `git grep -n "<basename>"` turns up no hit in `package.json` files, `turbo.json`, `.github/`, `apps/*/scripts/`, `docker/`, or any other script.
3. Hits in documentation are only historical: phase summaries, verification and plan records under `.planning/` (leave those untouched; they record what was true then). For live docs, such as `docs/contract-gaps/phase-07-derived-insights.md`, which mentions `verify-phase-06-integrity.mjs`, rewrite the sentence to say the gate was retired and name the test that now guards the same property, if there is one.
4. The property it guarded is still checked somewhere else. For each one, name that test (for example: catalogue identity → `scripts/verify-csrm-seed.mjs`; no raw fetch → `contract-operation-chain.test.ts`; frozen content-type schemas → `apps/backend/tests/contract-catalogue.integration.test.ts` or `served-operations.integration.test.ts`). If nothing still guards a property that matters, keep the script, report the gap, and propose an updated test instead of deleting.

Also remove the redundant per-page `not.toMatch(/\bfetch…/)` assertions (Part B 3), each only if `contract-operation-chain.test.ts` still covers every module of the web source.

Done means the scripts are gone, live docs are updated, the web suite is green, and there's one commit (`chore(tests): retire unreferenced phase-era verification scripts`).

### C2. Fix the Windows-only backend failures and the E2E attestation expiry

Fix the cause. Don't delete or loosen these tests.

1. **Line endings for the evidence fixtures.** In `.gitattributes`, next to the existing font and attachment-fixture rules, add `-text` rules for `apps/backend/tests/fixtures/iam-scim/*.json` and `.planning/workstreams/iam/phases/*/evidence/connector-capture/*.json`, with a comment saying their bytes are digest-pinned. Then refresh the working copies from the index (`git rm --cached` plus `git checkout --` those paths, or `git add --renormalize .`, and check that `git status` shows no content change). Check: `sha256sum` of each `capture.json` matches its `manifest.json`, and both `iam-scim-replay*.integration` files pass.
2. **POSIX path for git.** In the capture tool under `docker/midpoint/e2e/` that `iam-scim-capture-tooling.unit.test.ts` › "authored token handoff…" exercises, convert the repository-relative path to forward slashes before passing it to `git` (`split(path.sep).join("/")`). Fix the tool, not the test, because git output and evidence should be the same on every OS.
3. **POSIX permissions in `iam-scim-token-cli.unit.test.ts`.** Follow the precedent in `attachment-storage.unit.test.ts`: give the six permission, symlink and hardlink cases `{ skip: process.platform === "win32" ? "<reason>" : false }`, with the reason stated. Then decide whether `apps/backend/src/iam/scim/token-cli` (the `scim:token` script) should refuse on Windows with a named, actionable error instead of `IAM_SCIM_DEV_EXPORT_FAILED`. If yes, add that and a test for it.
4. **E2E attestation lifetime.** In `apps/csrm/src/lib/testing/e2e-runtime-attestation.ts`, `E2E_ATTESTATION_MAX_AGE_MS` (60 min) is shorter than a full run on Windows (1.9 h). Either raise it with headroom (for example 4 h) or, better, have the Playwright runner refresh `createdAt` while it is alive. Keep the nonce, runtime-root and freshness checks, update the comment with the measured run time, and keep `src/lib/testing/*` tests green.

Done means the backend suite has 0 failures on Windows (report skips separately), and a full E2E run passes without `--last-failed`. Commit with `fix(tests): …`.

### C3. Cut the backend integration suite's boot/seed cost, only when it's safe

Do this only if all of the following hold. Otherwise report "deferred" and the reason.
- Part A passed, and no workstream has an open phase that changes `apps/backend/tests/helpers/strapi-http-harness.ts`, the seed bootstrap (`apps/backend/src/bootstrap/`) or content-type schemas. Check every workstream's ROADMAP and STATE files. A harness change like this conflicts with any in-flight backend phase.
- C2 is done and the backend suite is green, so the before and after pass counts can be compared.

The baseline cost: each of the 62 integration files calls `compileStrapi`/`createStrapi` against `apps/backend` (`appDir` in `strapi-http-harness.ts`, databases under `apps/backend/.tmp/authorization-http`) and re-seeds the core and CSRM catalogues and 2,646 controls. That's about 76 of the suite's 94 minutes.

Approach, in order of value:
1. **Seed once, copy per file.** In a setup step, boot once, seed into a template SQLite file under `apps/backend/.tmp/`, and have each integration file copy the template to its own database. Re-seed on boot only where a test asserts seeding behaviour.
2. **Compile once per run** instead of per file. Reuse `dist` when its inputs haven't changed.
3. **Optional: parallel integration files**, each with its own database copy, port and attachment directory, but only if `dist` can be shared read-only.

Keep these on a truly fresh database, because they assert seeding or reconciliation from empty: `*-seed.integration.test.ts`, `iam-database-invariants.integration.test.ts`, `harness-environment.integration.test.ts`, and any test whose title says "fresh database" (grep for it).

Guardrails:
- The same test count with the same titles, and the same pass and skip results (compare the junit XML before and after).
- No test may see another test's writes. Add a guard that fails if two files share a database file.
- The maintenance switches (`AUTHORIZATION_MATRIX_OBSERVE`, `SERVED_OPERATIONS_WRITE`) are still refused by `scripts/refuse-maintenance-switches.mjs`.

**CI.** Propose (and, if the developer agrees, make) a split of `.github/workflows/ci.yml` into separate jobs: web quality (lint, typecheck, Vitest, build), backend tests, and E2E. Give each a timeout based on the measured runtime plus headroom. One 15-minute job can't hold the suites today.

Done means a measured before-and-after runtime, identical results, and a commit (`perf(backend-tests): …`), with the CI proposal in the report.
