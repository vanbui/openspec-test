---
phase: 08-production-integration-and-hardening
plan: 14
subsystem: assurance
tags: [phase-gate, residual-risk-register, playwright, next-start, production-build, node-test, vitest, pnpm-audit, requirements-ledger, int-02-deferral]

requires:
  - phase: 08-production-integration-and-hardening
    provides: plans 08-01 to 08-13 and their records (dependency audit, served-operations inventory, parity guard, authorization matrix, Strapi and web security records, WCAG 2.2 conformance record, performance baseline), and the orchestrator's four follow-up commits
provides:
  - docs/security/phase-08-residual-risks.md, one register of 38 R-08 rows (source, residual, why accepted, compensating control, revisit trigger, owner) for the phase security audit, with the contract-gap outcome (none needed)
  - the full five-command phase gate on the production build in both Playwright projects, green on 0290f4f, with the freeze, Keycloak-absence, catalogue, dependency and trailer checks recorded from observed output
  - the INT-03 hermetic re-verification with per-file counts (D-07)
  - the phase-gate dependency audit re-run recorded in docs/security/dependency-audit-phase-08.md
  - REQUIREMENTS (INT-01 and INT-04 complete, INT-03 re-verified, INT-02 unchecked with the deferral wording) and STATE (complete except INT-02, verification pending)
affects: [08-VERIFICATION, 08-SECURITY, 08-UI-REVIEW, phase-8-code-review, phase-8-close-out, INT-02]

tech-stack:
  added: []
  patterns:
    - "A gate check must be shown to be able to fail: the freeze diff is proven against the last real schema change, and the Keycloak grep against the two pre-phase mentions it must not count."
    - "A commit body never ends with a lone `Key: value` line, because git's trailer parser reads it as a trailer."

key-files:
  created:
    - docs/security/phase-08-residual-risks.md
    - .planning/phases/08-production-integration-and-hardening/08-14-SUMMARY.md
  modified:
    - docs/security/dependency-audit-phase-08.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "No docs/contract-gaps/phase-08-*.md record: no plan recorded a gap. The register's Contract gaps section explains why D-31, D-36 and D-40 needed none, and why the specification's stale plugin paths (R-08-19) are recorded in the inventory rather than as a gap."
  - "The register also carries the Phase 7 accepted risks that the Phase 7 gap record assigned to Phase 8 and Phase 8 did not take up (R-08-36 single-process job registry, R-08-37 PostgreSQL, R-08-38 the undeclared data: null), so the security audit sees them."
  - "The D-02 freeze was proven with a corrected pathspec: the plan's 'apps/strapi/src/api/*/content-types' matches no tracked file, while '.../content-types/*' matches all 15 schemas and finds the last schema change (b4f3d88) when the range starts before it."
  - "The trailer check prints 7, not 0: six SUMMARY: lines and one RED: line that end earlier plans' commit bodies are read as trailers by git. None is an attribution trailer, and history is not rewritten."
  - "The dependency audit was pre-checked before the gate, so that a new high or critical advisory would be fixed before a 25-minute gate rather than after it; the gate's own audit (step 10) is the recorded run."
  - "requirements-completed lists INT-01, INT-03 and INT-04. The plan's requirements field also names INT-02, which the plan carries only to record its deferral (D-01), so INT-02 is listed under requirements-deferred, and requirements.mark-complete was not run."

patterns-established:
  - "Residual register: one table per area with stable R-08 ids, each row citing the record that first accepted it, with an owner and, where the operator must decide, the words operator decision."

requirements-completed: [INT-01, INT-03, INT-04]
requirements-deferred: [INT-02]

duration: 41 min
completed: 2026-09-26
---

# Phase 08 Plan 14: Residual-risk register, INT-03 re-verification and the phase gate Summary

**Phase 8 closes on a green gate. On `0290f4f`, with the dev servers stopped, the five commands passed:**
- **Playwright:** 81 of 81 on the production build (`next build`, then `next start`) in both projects, none flaky;
- **Strapi:** 504 of 504;
- **Web:** 1677 tests in 91 files;
- **Typecheck and `api:check`:** clean.

**The tree was clean afterwards, no content-type schema changed, no line mentioning Keycloak was added, the catalogue copies are identical, and the dependency audit found no new advisory. INT-03 was re-verified without a live provider: 97 Strapi tests in nine files and 39 web tests in three. One register of 38 R-08 rows now holds every residual Phase 8 accepted or left open, each with an owner. The ledgers say Phase 8 is complete except INT-02, which stays deferred by operator decision.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-09-26T04:09:59Z
- **Completed:** 2026-09-26T04:50:59Z (after the metadata commit `9d1129e`)
- **Tasks:** 3 of 3
- **Files:** 6 (2 created, 4 modified), no source or test file

## Accomplishments

- **One residual register (Task 1).** `docs/security/phase-08-residual-risks.md` has 38 rows in ten areas:
  - authentication, session and the plugin surface;
  - web headers and CSP;
  - the Strapi HTTP surface;
  - logging;
  - error and not-found semantics;
  - contract parity, with the 33 grandfathered parsers listed;
  - dependencies;
  - build and test hermeticity;
  - accessibility and print;
  - performance.

  It also carries a "Carried from Phase 7" section, the contract-gap outcome and the items routed to the phase reviews. Every orchestrator addition is a row: the Google Fonts dependency (R-08-24), the 08-05 items (R-08-02, R-08-11, R-08-12, R-08-13), the 08-10 items (R-08-04, R-08-05, R-08-07, R-08-08), the 08-12 streamed not-found (R-08-15) and the 08-13 zod and prefetch findings (R-08-32, R-08-33).
- **INT-03 re-verified hermetically (D-07).** The nine Strapi files and the three web files pass on the deterministic provider, with no `CSRM_AI_*` change. Counts are in the evidence block.
- **The phase gate (Task 2)** is green in the plan's order, with every hygiene check recorded from observed output (the evidence block). No fix was needed.
- **The ledgers (Task 3).**
  - **REQUIREMENTS:** INT-01 and INT-04 checked. INT-03 cites the re-verification. INT-02 is unchecked, with the verbatim deferral wording on its line and in its own traceability row.
  - **STATE:** says `phase complete except INT-02 (verification pending)` and carries the Phase 8 close-out gate block and the next steps for the phase review.

## Task Commits

1. **Task 1: Consolidate the residual-risk register, settle the contract-gap outcome, and cite the INT-03 suites.** `0290f4f` docs(08-14): consolidate the Phase 8 residual risks and the contract-gap outcome.
2. **Task 2: The full phase gate.** No file, by design. `3cb9fae` docs(08-14): record the phase-gate dependency audit on the next 16.3.6 lockfile (orchestrator input 3).
3. **Task 3: Close the requirement ledger and the project state.** `838fa61` docs(08-14): close the Phase 8 ledger as complete except INT-02 (exactly `.planning/REQUIREMENTS.md` and `.planning/STATE.md`).

**Plan metadata:** the `docs(08-14): complete …` commit that carries this summary, STATE and ROADMAP.

## Evidence for 08-VERIFICATION.md

**Gate commit: `0290f4f`**, run on 2026-09-26 with the dev servers stopped: ports 1337 and 3000 free before (checked 04:20:53Z and 04:30:59Z) and nothing listening after. Logs are in `apps/web/.tmp/logs/csrm-phase-08/` (gitignored): `08-14-gate-*.log`, `08-14-gate-e2e.log`, `08-14-audit.json`, `08-14-int03-*`.

### The five commands, in order

| # | Command | Result | Duration | Exit |
|---|---|---|---|---|
| 1 | `pnpm --filter @csrm/strapi test` | **504 passed / 0 failed**, 0 cancelled, 0 skipped, 0 todo | 553.5 s of tests, 557 s wall (04:20:57Z–04:30:14Z) | 0 |
| 2 | `pnpm --filter @csrm/web test` | **91 files, 1677 tests passed**, 0 failed | 19.06 s reported, 20 s wall | 0 |
| 3 | `pnpm --filter @csrm/web typecheck` (`next typegen && tsc --noEmit`) | clean, no diagnostics | 3 s wall | 0 |
| 4 | `pnpm --prefix apps/web api:check` | no drift in `schema.d.ts` | 2 s wall | 0 |
| 5 | `DEBUG=pw:webserver pnpm --filter @csrm/web test:e2e 2>&1 \| tee …/08-14-gate-e2e.log` | **81 passed / 0 failed / 0 flaky / 0 skipped**, no retries (`retries` is 0 outside CI) | 11.0 min reported, 662 s wall (04:31:06Z–04:42:08Z) | 0 |

**Playwright per project (production build):**
- `desktop` (1440×900, every spec): **77 passed**, 0 failed, 0 flaky, 555.2 s of test time. `performance.spec.ts` ran last, as tests 68 to 77.
- `mobile` (375×812, the four `@journey` tests): **4 passed**, 0 failed, 0 flaky, 59.2 s. The four were the request journey 20.9 s, the Risk Register 23.6 s, the CSV import 9.1 s and the read-only lifecycle 5.6 s.
- **Slowest tests:** the two conformance matrices (57.4 s and 45.3 s), the two design-contract tests (33.3 s and 32.6 s), the analyst accessibility sweep (32.4 s) and the analyst CSP sweep (30.2 s).

**The `next start` line (D-10)**, `08-14-gate-e2e.log` line 171:

```
2026-09-26T04:31:36.757Z pw:webserver Starting WebServer process "C:\ProgramData\nvm\v24.19.0\node.exe" "C:\ProgramData\nvm\v24.19.0\node_modules\corepack\dist\pnpm.js" exec next build && "C:\ProgramData\nvm\v24.19.0\node.exe" "C:\ProgramData\nvm\v24.19.0\node_modules\corepack\dist\pnpm.js" exec next start --hostname 127.0.0.1 --port 45888...
```

**Server start-up:**
- The Strapi web server started at 04:31:07.6Z and was healthy 29 s later.
- The production build then compiled in 2.9 s, with TypeScript in 6.2 s.
- `next start` was ready in 149 ms, and `/sign-in` answered 200 at 04:31:49.8Z.
- The Google Fonts transient did not recur.
- The production server logged `The destination stream closed early.` 36 times (R-08-14).

### The checks after the run

| # | Check | Observed |
|---|---|---|
| 6 | `git status --porcelain` right after the run | **prints nothing** (0 lines). It still printed nothing after checks 7 to 11. |
| 7 | `PHASE_BASE=$(git log --reverse --format=%H --grep='(08-01)' \| head -1)~1` (= `a9394cf`), then `git diff --name-only "$PHASE_BASE"..HEAD -- 'apps/strapi/src/api/*/content-types'` | **prints nothing**, but that pathspec matches no tracked file (`git ls-files` with it: 0), so it cannot fail; see deviation 1. The corrected `'apps/strapi/src/api/*/content-types/*'` matches all 15 schemas and also **prints nothing**. Run over `b4f3d88~1..HEAD`, it finds `apps/strapi/src/api/csrm-questionnaire/content-types/csrm-questionnaire/schema.json`, the last schema change (06.8-01, 2026-09-20). No Phase 8 commit touches a schema. |
| 8 | `git diff "$PHASE_BASE"..HEAD -- apps package.json pnpm-workspace.yaml pnpm-lock.yaml \| grep -i '^+.*keycloak'` | **prints nothing** (0 added, 0 removed). The range changes 191 files under those paths, and the two pre-phase mentions (`apps/strapi/src/index.ts`, `apps/strapi/tests/fixtures/authorization.ts`) remain. |
| 9 | `cmp docs/references/idambox-csrm-role-function-api-catalogue.json apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | **silent**, exit 0 |
| 10 | `pnpm audit --json > …/08-14-audit.json` (04:43:28Z, exit 1 because advisories exist), `metadata.vulnerabilities` | **critical 0, high 1, moderate 13, low 1, info 0**. These are the same 15 advisory ids as 08-01's "After", and all are in `docs/security/dependency-audit-phase-08.md`. All 546 finding paths start at `apps/strapi`, none at `apps/web`. The high is the recorded `vite` GHSA-fx2h-pf6j-xcff. Recorded in `3cb9fae`. D-23 holds. |
| 11 | `git log --format='%(trailers)' "$PHASE_BASE"..HEAD \| grep -c .` | **7, not 0** (deviation 2). Quoted verbatim: `RED: 7 failed, 3 passed (/app, /app/requests and the questionnaire exception).`, then `SUMMARY: .planning/phases/08-production-integration-and-hardening/08-0{9,7,6,5,4,3}-SUMMARY.md` (six lines). None is an attribution trailer: `%(trailers:key=Co-authored-by,key=Signed-off-by,key=Generated-by,key=Assisted-by)` gives 0 lines. A grep of the subjects and bodies of the 117 commits for tool or assistant names and attribution phrases gives 0. |

### INT-03 hermetic re-verification (D-07)

Deterministic provider only; no `CSRM_AI_*` change.

**Strapi**, 04:11:46Z–04:12:42Z, 54.2 s of tests, 56 s wall, exit 0. The plan's command was `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/strapi && node --test --test-concurrency=1 --test-timeout=600000 <the nine files>`. Node's summary gave tests 97, pass 97, fail 0. Per-file counts, from a scratch reporter that grouped the same run by file:

| File | Tests | Pass | Fail |
|---|---|---|---|
| `ai-provider-questionnaire.unit.test.js` | 6 | 6 | 0 |
| `ai-provider-assessment.unit.test.js` | 9 | 9 | 0 |
| `ai-provider-failures.unit.test.js` | 12 | 12 | 0 |
| `ai-provider-guardrails.unit.test.js` | 8 | 8 | 0 |
| `ai-provider-boot.unit.test.js` | 6 | 6 | 0 |
| `assessment-workflow.unit.test.js` | 26 | 26 | 0 |
| `assessment-workflow.integration.test.js` | 22 | 22 | 0 |
| `questionnaire-generation.unit.test.js` | 6 | 6 | 0 |
| `questionnaire-generation.integration.test.js` | 2 | 2 | 0 |
| **Total** | **97** | **97** | **0** |

**Web.** The plan's `pnpm --filter @csrm/web test -- assessment-review-workflow questionnaire-generation-job assessment-actions` exits 0, but it runs the whole suite (91 files, 1677 tests, 19 s), because vitest ignores patterns after `--`. The three files were therefore also run by path (`pnpm --filter @csrm/web exec vitest run …`), exit 0:

| File | Tests | Pass |
|---|---|---|
| `assessment-review-workflow.test.tsx` | 20 | 20 |
| `questionnaire-generation-job.test.tsx` | 7 | 7 |
| `assessment-actions.test.ts` | 12 | 12 |
| **Total** | **39** | **39** |

Together: 136 tests (97 Strapi, 39 web), the figure cited in REQUIREMENTS. Every Strapi file ran again inside gate command 1, and every web file inside gate command 2.

### Residuals and contract gaps

- **Residual register:** 38 rows, R-08-01 to R-08-38, in `docs/security/phase-08-residual-risks.md`. The rows name these operator decisions:
  - Google Fonts (R-08-24);
  - the AI transcript flag (R-08-12);
  - the production CORS origin (R-08-11);
  - log retention (R-08-13);
  - the proxy topology and `allowedOrigins` (R-08-04);
  - HSTS preload (R-08-06);
  - CSP reporting (R-08-07);
  - INT-02 (R-08-01, R-08-02, R-08-03, R-08-28).
- **Contract gaps:** none recorded by any plan, so no `docs/contract-gaps/phase-08-*.md` exists. The register's section names the three candidates, D-31, D-36 and D-40, and why each needed none.

### Fix commits the gate required

None. Every gate command passed on its first run.

**Phase 8 complete except INT-02 (deferred by operator decision, 2026-09-25)**

## Phase ledger

119 commits in `a9394cf..838fa61`: 116 plan-scoped commits, the orchestrator's two `(08)` commits and one merge. The metadata commit follows. Of the 08-08 count, `90a2565` and `5a9420d` are the orchestrator's.

| Plan | Commits | First .. last | Delivered |
|---|---|---|---|
| 08-01 | 3 | `46e7563` .. `4d39e9d` | Dependency hygiene: audit critical 1 / high 6 → 0 / 1 |
| 08-02 | 9 | `60bdbb0` .. `b29ffc2` | The production-build harness, the attested session, a clean tree after a run, the settle helper |
| 08-03 | 7 | `c0b0384` .. `b77adb8` | The served-operations inventory; IAM and generic reference routers unmounted; registration disabled |
| 08-04 | 5 | `a4c9a53` .. `d410a75` | The parity boundary modes, 33 grandfathered parsers, IN-03 closed by contract |
| 08-05 | 12 | `b5215dd` .. `bc6d5ac` | The policy-test port, the six-actor matrix, the bare 500 envelope, `X-Powered-By` removed |
| (merge) | 1 | `1edaa40` | Merge the Phase 8 build-out work (plans 08-01 to 08-05) into main |
| 08-06 | 7 | `84d55f9` .. `b6ad116` | One Risk Type ordering rule; the timeline names the acting analyst |
| 08-07 | 12 | `be3ad80` .. `aa38d74` | One status mapping; a single question list; provider-neutral drafting copy |
| 08-08 | 8 + 2 | `93b33e9` .. `7733882` | Scroll regions with the edge cue; the Risk Register filter layout; named searches |
| orchestrator, after 08-08 | 2 | `90a2565` (test), `5a9420d` (fix) | The desktop Search Risks input overlapped its button: a `nowrap` label pulled the inline input onto the text line. It is now block, with a geometry assertion. |
| 08-09 | 11 | `414ea8f` .. `2f6e4a6` | The `Menu` label, the root and in-shell fallbacks, print |
| 08-10 | 11 | `e8ddb6b` .. `74616fe` | The nonce CSP, the header set, `next` 16.3.6, the hardening proofs |
| 08-11 | 4 | `4306e35` .. `cd68e4c` | The desktop and mobile projects, six journeys at both widths, browser IDOR |
| 08-12 | 9 | `cf7d784` .. `6218433` | The WCAG 2.2 AA sweep, headed denials, truthful titles |
| 08-13 | 13 | `ec82d2d` .. `686012d` | The performance baseline and budgets; zod out of six routes' first load |
| orchestrator, after 08-13 | 2 | `e34dce8` (test), `15dcacf` (fix) | The Risk Register loading fallback threw on a URL the page refuses, abandoning the server render (present since Phase 5). It now draws without the refused bounds. |
| 08-14 | 3 + metadata | `0290f4f` .. `838fa61` | This plan |

## Files Created/Modified

- `docs/security/phase-08-residual-risks.md` (new): the register.
- `docs/security/dependency-audit-phase-08.md`: the "Phase gate re-run" section (the `next` bump, the gate audit, no new dependency key).
- `.planning/REQUIREMENTS.md`: INT-01 and INT-04 checked; INT-02 deferral wording on its line and in its row; the INT-03 row; the footer.
- `.planning/STATE.md`:
  - the frontmatter;
  - the focus, Milestone, Decisions (08-14), Risks and Session Continuity sections;
  - the rewritten Next Action with the Phase 8 close-out gate block;
  - the notes carried forward, the footer and the roadmap evolution log.
- `.planning/ROADMAP.md`: the 08-14 checkbox, 14/14 plans, and the status line (plans complete, phase review pending).
- `.planning/phases/08-production-integration-and-hardening/08-14-SUMMARY.md` (new): this summary.

## Decisions Made

See `key-decisions` above. The STATE progress counters had already been advanced plan by plan (162 of 163 before this plan), so this plan set `completed_plans` to 163. `percent` stays 84: GSD computes it as the smaller of the plan fraction (163/163) and the phase fraction (16/19), and the phase counters change only when the orchestrator closes the phase.

## Deviations from Plan

### Recorded, not fixable

**1. The plan's freeze pathspec cannot fail (gate step 7).**
- **Found during:** Task 2, when checking that each hygiene check could fail at all.
- **Issue:** `'apps/strapi/src/api/*/content-types'`, quoted, matches no tracked file. The schemas live at `…/content-types/<name>/schema.json`, and git matches a wildcard pathspec against the whole path. The same pathspec is in `08-VALIDATION.md`'s D-02 row and in 07-09's gate.
- **What was done:** the check was run as written (it prints nothing), then proven vacuous: it prints 0 lines over `b4f3d88~1..HEAD`, where the corrected pathspec finds the schema that `b4f3d88` changed. The corrected `'apps/strapi/src/api/*/content-types/*'` prints nothing for Phase 8.
- **Consequence:** D-02 holds. The last schema change in history is `b4f3d88` (06.8-01, 2026-09-20), before Phases 7 and 8, so the earlier freeze claims hold as well. `08-VALIDATION.md` is the orchestrator's to edit, so its D-02 row is recorded in STATE for close-out rather than changed here.

**2. The trailer count prints 7, not 0 (gate step 11).**
- **Issue:** six plan-close commits (`b77adb8`, `2412521`, `d57fbcf`, `7072ea7`, `aa38d74`, `2f6e4a6`) end their body with a one-line `SUMMARY: <path>` paragraph, and `d5aee5a` with `RED: …`. git's trailer parser reads a final paragraph of `Token: value` lines as trailers.
- **Why it is not a finding:** none is an attribution trailer. The stricter key check and the attribution grep over all 117 commits both give 0.
- **Why it is not fixed:** only a history rewrite could clear it, and the build-out's git rules forbid one.
- **Going forward:** this plan's commits end with prose or a bullet, and each has 0 trailers.

### Plan-text deviations and additions

3. **Orchestrator input 3: the audit result recorded in the dependency record.** Task 2 lists no file by design. The orchestrator asked for the gate's audit to be recorded against `docs/security/dependency-audit-phase-08.md`, so it is its own docs commit (`3cb9fae`) after the gate. No test reads that file.
4. **The dependency audit was pre-checked before the gate.** It found the same fifteen advisories, so no fix was needed and the gate ran on the final tree. The recorded run is gate step 10.
5. **INT-03 per-file counts came from a scratch reporter** attached to the plan's exact `node --test` command, because node's default reporters do not group by file. The web files were also run by path, because the plan's `test -- <patterns>` form runs the whole suite (as 08-10 recorded).
6. **`requirements-completed` omits INT-02.** The plan's `requirements` field names all four, and the template says to copy it verbatim. The plan carries INT-02 only to record its deferral, so INT-02 is under `requirements-deferred`. `requirements.mark-complete`, which would have checked INT-02, was not run; REQUIREMENTS was edited by hand exactly as Task 3 specifies.
7. **STATE's follow-up closures were mostly done already.** Eight of the nine items Task 3 names were already marked closed with their plan by earlier executors, and the `next-env.d.ts` note was already the D-12 fact (08-02). This plan added the ninth closure (the `accessibility.spec.ts:47` settle window: 08-02's helper, proven by 08-12), dropped that note from "Notes carried forward", and stated the 08-14 gate in the D-12 note.
8. **Additions to the register beyond the plan's minimum.** The Phase 7 carry-overs (R-08-36 to R-08-38) and the plan-time `accept` dispositions of 08-04 and 08-08 (R-08-20, R-08-31) are rows too, so that no accepted risk is left out of the audit.
9. **Windows host translations,** as the preamble sets out:
   - Node 24 from `/c/ProgramData/nvm/v24.19.0`, with no `PLAYWRIGHT_BROWSERS_PATH`;
   - ports checked with `Get-NetTCPConnection`;
   - logs under `apps/web/.tmp/logs/csrm-phase-08/` rather than `/tmp/csrm-phase-08/`;
   - the Strapi suite and Playwright run as background commands, each awaited before the next command.

**Total deviations:** 0 auto-fixed, 2 recorded as not fixable (both are checks as written), 7 plan-text deviations or additions. **Impact:** no source, test, schema, contract, grant, catalogue, `CSRM_AI_*`, Keycloak or manifest change in this plan.

## Issues Encountered

- **A trailing `tail` failed after the INT-03 run.** My wrapper's final `tail` used a path relative to the directory it had just left, so the background command reported exit 1. The test run itself exited 0 (`EXIT=0` in its log), and the log was complete.
- **pnpm engine warning.** The standalone pnpm prints `Unsupported engine … current: v22.19.0` for its own process. Every command it spawned ran on Node 24.19.0 (`node --version` in the INT-03 log).

## Known Stubs

None. This plan changed records and ledgers only.

## Threat Flags

None. No endpoint, grant, data path or trust boundary was added. T-08-14-01 to T-08-14-05 are each met:
- every count above comes from a command's own output;
- only named record and ledger files were staged, and the tree was clean after the run and before each commit;
- the Keycloak grep over added lines prints nothing;
- the corrected freeze diff is empty;
- the audit re-run matched every advisory against the 08-01 record.

## User Setup Required

None.

## Next Phase Readiness

Phase 8 is executed and complete except INT-02. The orchestrator's next steps:
1. The phase code review.
2. Verification: `08-VERIFICATION.md` from the evidence block above; the D-02 row of `08-VALIDATION.md` wants the corrected pathspec.
3. The security audit: `08-SECURITY.md` from the register's R-08 rows.
4. The UI review, which also takes the 08-07, 08-09 and 08-12 review items.
5. The phase close-out: the phase counters and the ROADMAP status.

The register names the operator decisions and the orchestrator decisions to take, and the earliest dated one is R-08-25 (the journey date, from 2026-11-24).

**Browser backstops:** none are new. This plan changed no UI. The backstops recorded by 08-07 to 08-13 still stand for the orchestrator's `next dev` pass.

## Self-Check: PASSED

- **Files exist:** `docs/security/phase-08-residual-risks.md`, `docs/security/dependency-audit-phase-08.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` and this summary. No `docs/contract-gaps/phase-08-*.md` exists, as the register states.
- **Commits on `dev`:** `0290f4f`, `3cb9fae` and `838fa61`. None deletes a file, and none carries a trailer.
- **Task 1 acceptance:**
  - 38 `| R-08-` rows, each with every cell filled, and the tables consistent;
  - `unsafe-inline`, `INT-02`, `HSTS`, `allow_register`, `auth/local`, `grandfather` and the count 33 all present;
  - the Contract gaps section names D-31, D-36 and D-40;
  - the INT-03 command exits 0, with per-file counts above.
- **Task 2 acceptance:** met, except the trailer count (deviation 2). The freeze criterion is met on the corrected pathspec (deviation 1).
- **Task 3 acceptance:** the plan's verify block exits 0, and `git show --stat 838fa61` lists exactly the two ledgers.
- **Attribution:** none in this plan's commits, records or planning files.
