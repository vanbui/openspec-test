---
phase: 08-production-integration-and-hardening
fixed_at: 2026-09-26T07:24:26Z
review_path: .planning/phases/08-production-integration-and-hardening/08-REVIEW.md
iteration: 1
fix_scope: all
scopes:
  - id: server
    findings: SR-01..SR-10
    findings_in_scope: 10
    fixed: 10
    skipped: 0
    fixed_at: 2026-09-26T06:14:29Z
  - id: web
    findings: WR-01..WR-11
    findings_in_scope: 11
    fixed: 11
    skipped: 0
    fixed_at: 2026-09-26T07:24:26Z
findings_in_scope: 21
fixed: 21
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-09-26T06:14:29Z (server scope), 2026-09-26T07:24:26Z (web scope)
**Source review:** `.planning/phases/08-production-integration-and-hardening/08-REVIEW.md`
**Iteration:** 1

**Summary:**

- **Findings in scope:** all 21, at every severity (fix scope `all`). Two fixers worked in turn: the server scope's SR-01 to SR-10 first, then the web scope's WR-01 to WR-11. Each scope has its own section below, with its own verification.
- **Fixed:** 21 (10 server, 11 web).
- **Skipped:** 0.

## Server scope (SR-01 to SR-10)

### How the fixes were made

- **Test first.** Each finding that changes behaviour (SR-01, SR-05 and SR-08) has a `test(08)` commit, then a `fix(08)` commit. The failing run was observed before the fix.
- **Sensitivity runs.** Each finding whose fix is a test or guard (SR-02, SR-03, SR-04, SR-07, SR-10) was shown failing for the bad case in a run that was then reverted, and passing once the bad case was gone. SR-09's cleanup was shown on a failing run and a passing run.
- **Commit bodies.** Each commit names its finding id.

### Fixed Issues

#### SR-01: A production build started with `NODE_ENV=development` enables the development sign-in without the attestation or either D-11 variable

**Files modified:**

- `apps/web/src/lib/auth/development-runtime.ts`
- `apps/web/src/lib/auth/development-runtime.test.ts`
- `apps/web/src/lib/boundaries/alignment.test.ts`
- `apps/web/e2e/production-hardening.spec.ts`
- `docs/security/phase-08-residual-risks.md`
- `docs/security/web-headers.md`
- `.planning/phases/08-production-integration-and-hardening/08-02-SUMMARY.md`

**Commits:** `fa4bc5b` (test, RED), `151a443` (fix)

**Applied fix:**

- **The resolver.** `resolveSessionRuntimeMode(env, compiledFor = process.env.NODE_ENV)` keys the `next dev` branch on the second parameter. Its default is the literal expression Next replaces at compile time.
  - A `next dev` compilation has the session only while it runs as next dev.
  - A production build takes only the attested path, which needs `NODE_ENV=production` at runtime, both D-11 variables and a valid attestation.
  - Every other compilation has none. Every other gate is unchanged.
- **The compiled output.** The production build compiles the resolver to `function(a,b="production"){…}`, read from the run's server chunk.
- **The browser proof.** A third server of the run's build, started with `NODE_ENV=development`, both variables and no attestation, sits beside the unattested one in `production-hardening.spec.ts`.
- **Stronger action posts.** Both refused-runtime proofs now post the build's real sign-in Server Action, its id read from the attested server. The previous bare form post never reached the action.

**Evidence:**

- **RED, unit.** 7 of 23 cases failed, each receiving `'development'`.
- **RED, browser.** On the old resolver the new proof failed at "SR-01: the production build started with NODE_ENV=development offers no fixture role": expected 0 buttons, received 3. The unattested `NODE_ENV=production` proof passed, and its real action post answered 500.
- **GREEN, unit.** 120 of 120 across the auth, boundary, transport and testing suites.
- **GREEN, browser.** 3 of 3 sign-in proofs passed:
  - the attested server still offers the sign-in;
  - both refused runtimes show the unavailable card and redirect `/app`;
  - both answer the posted action with 500 and set no role cookie.

**Records corrected:**

- R-08-03's compensating control, with a note in the register header.
- `web-headers.md` residual 4 and the proofs row for `production-hardening.spec.ts`.
- A correction note under the 08-02 summary's claim.
- D-11 itself, in `08-CONTEXT.md`, is left as written: it is the requirement, and the implementation now meets it.

#### SR-02: The authorization matrix asserts allowed outcomes it never observes

**Files modified:**

- `apps/strapi/tests/helpers/matrix-provenance.ts` (new)
- `apps/strapi/tests/authorization-matrix-provenance.unit.test.ts` (new)
- `apps/strapi/tests/authorization-matrix.integration.test.ts`
- `apps/strapi/tests/fixtures/authorization-matrix.ts`
- `apps/strapi/tests/authorization.integration.test.ts`
- `apps/strapi/tests/assessment-workflow.integration.test.ts`

**Commit:** `8e260c6`

**Applied fix:**

- **Per-actor provenance.** `provenBy` is now keyed by actor. A pure rule in `matrix-provenance.ts` enforces it:
  - every allowed actor of a probe that does not issue its successes needs a citation;
  - each cited test's body must name that actor's harness identity (`identities.serviceAnalystAgent` for the service agent; the role-less `identities.analystAgent` does not count);
  - a citation for a refused actor, or on a probe that issues its successes, is refused;
  - the two credential-less callers cannot be proven by citation.
- **Traceability citations.** Citations on issued or non-2xx probes move to a new `seeAlso` field, which must still name an existing test.
- **Two new mounted proofs**, each kept last in its file:
  - "mounted request writes admit every granted actor, the service agent included": the other Requestor's create with ownership derived, the analyst's and the service agent's creates, and the service agent's update and delete of a request it does not own;
  - "mounted assessment writes admit the service agent's exact grants": the service agent's first accepted edit of its own draft assessment, and a contextual Risk create.

**Evidence:**

- **Sensitivity.** With the new rule and every allowed actor citing the test the old array named, the guard failed 7 cells:
  - exactly the review's: request POST for the analyst and the service agent, and request PUT, DELETE, assessment PATCH and Risk POST for the service agent;
  - plus the service agent on `generate_assessment`, for a cited test that never sends it.
- **The rule's unit test.** 8 of 8.
- **The new proofs and the guard.** Both new proofs pass, and the guard passes with the final citations.

**Limitation, recorded honestly.** The check establishes that a cited test sends a request as the actor. It does not establish that the request is the cited operation. That is why the other Requestor's POST success, whose older proof names her only for a refused read, now cites the new proof.

#### SR-03: The contract chain guard and the inventory's caller scan are blind to calls outside `*-service.ts` or through another receiver

**Files modified:**

- `apps/web/src/features/contract-operation-chain.test.ts`
- `apps/strapi/tests/served-operations.integration.test.ts`

**Commit:** `1005bd9`

**Applied fix:**

- **What both scans read.** Every web source module (`app/`, `src/` and the files beside them, tests and declarations excepted), and every HTTP-method call whatever its receiver is named.
- **What both refuse.** A method destructured off the client, or reached by a computed key.
- **The web guard** also allows only the feature services and the transport to build or name the client (`createStrapiClient`, `StrapiClient`, `openapi-fetch`).
- **The inventory** gains the invariant `WEB_CALLS_UNSERVED`: every web call must name a served operation.

**Evidence:**

- **Old guard, probes present.** Three probes were added and later removed: a page calling `strapi.GET('/applications')`, a service using another receiver, and a destructured `GET`. The old web guard passed 5 of 5.
- **New guard, probes present.** It failed four checks:
  - `CLIENT_OUTSIDE_SERVICE_LAYER`;
  - `CLIENT_METHOD_DETACHED`;
  - `NOT_SERVED GET /applications`;
  - the inventory disagreement.
- **The Strapi inventory, page probe present.** It failed with `SERVED_OPERATIONS_INVARIANTS: WEB_CALLS_UNSERVED_GET:/api/applications (app/sr03-probe.ts)`.
- **Probes removed.** The web guard passes 8 of 8, and the inventory test 8 of 8 with the checked-in inventory unchanged.

#### SR-04: `expectFocusVisible` passes for any control that carries a shadow at rest

**Files modified:** `apps/web/e2e/helpers/focus.ts`

**Commit:** `e482a5c`

**Applied fix:**

- **Two reads.** The helper reads the control's outline and box-shadow at rest, while the preceding stop holds focus, and again once Tab reaches it. Each read waits for the control's finite animations and transitions to finish.
- **The pass condition.** Focus must add one of two things the resting control lacks:
  - a visible outline: a style other than none, a non-zero width and a colour that is not transparent;
  - a visible shadow layer: a colour that is not transparent and a non-zero length.
- **Failure message.** It prints both states.

**Evidence.** A throwaway sensitivity run on synthetic pages, since removed:

- the previous helper passed a control with a resting shadow and no focus style, and one with a transparent focus outline;
- the new helper fails both;
- the new helper passes a ring added through a 120 ms transition, and the direction's focus outline.

The helper's twelve real call sites run in the full browser suite (see Verification).

#### SR-05: The proxy matcher's lookahead is unanchored, so some URLs render documents with no Content-Security-Policy

**Files modified:**

- `apps/web/proxy.ts`
- `apps/web/src/lib/security/proxy.test.ts`
- `apps/web/e2e/production-hardening.spec.ts`
- `docs/security/web-headers.md`

**Commits:** `52ec2c2` (test, RED), `c226881` (fix)

**Applied fix.** The matcher source is now `'/((?!_next/static/|_next/image$|icon\\.png$).*)'`:

- the static directory with its slash;
- the image optimiser and the favicon exactly (the matcher tests the path without its query);
- the prefetch conditions unchanged.

**Evidence:**

- **RED, unit.** Next's own matcher (`unstable_doesMiddlewareMatch`) failed 8 of 27 cases.
- **RED, browser.** The last run's production build, carrying the old matcher, was served on a throwaway port and stopped afterwards. `/iconXpng`, `/icon.png-x`, `/_next/staticfoo` and `/_next/imagery` each answered the 404 document with 14 script tags, no CSP and no nonce. `/app/this-route-does-not-exist` carried both.
- **GREEN, unit.** 652 of 652 across the security suites.
- **GREEN, browser.** In a targeted run on the fixed build, the header test asserts the full header set and the nonce on every script for the four lookalikes, and it passed.

#### SR-06: The `sharp` override crosses `@strapi/upload`'s exact pin at a semver-0 breaking boundary, and the audit record overstates it

**Files modified:**

- `docs/security/dependency-audit-phase-08.md`
- `docs/security/phase-08-residual-risks.md`
- `apps/web/package.json`
- `package.json`
- `pnpm-lock.yaml`

**Commit:** `117741f`

**Applied fix:**

- **The audit record** now says what the override does and what is exercised:
  - `@strapi/upload` 5.51.0 declares `sharp` `0.34.5` exactly, and the override replaces it with `0.35.4`, a 0.x minor that semver treats as breaking;
  - every Strapi boot loads it and calls `sharp.cache` and `sharp.concurrency`;
  - no suite runs an image through the plugin's image processing;
  - the web's `next` declares `^0.35.4`, so it crosses no pin.
- **Also corrected** in the same sentence: the `nodemailer` override crosses the sendmail provider's exact `9.0.1` inside a compatible 9.x range, is loaded at boot, and no test reaches its transport.
- **The override stays.** It removes two high advisories. The residual register gains **R-08-39**, with the next `@strapi/*` upgrade as its trigger.
- **The finding's second point.** `vitest` and `turbo`, left on caret ranges by the audit's bumps, are pinned exactly again, to the `4.1.11` and `2.11.3` the lockfile already resolved.

**Evidence:**

- `pnpm install --lockfile-only --offline` changed exactly the two importer specifiers.
- `pnpm install --frozen-lockfile --offline` reported "Lockfile is up to date, resolution step is skipped / Already up to date".
- The web unit suite runs on vitest 4.1.11 (see Verification).

#### SR-07: Two environment switches silence the matrix and the inventory drift check

**Files modified:**

- `apps/strapi/scripts/refuse-maintenance-switches.mjs` (new)
- `apps/strapi/package.json`
- `apps/strapi/tests/authorization-matrix.integration.test.ts`
- `apps/strapi/tests/served-operations.integration.test.ts`

**Commit:** `4e7423f`

**Applied fix:**

- **The everyday run refuses the switches.** The Strapi `test` script first runs the preflight, which fails at once, naming the switch and the dedicated scripts, when `AUTHORIZATION_MATRIX_OBSERVE` or `SERVED_OPERATIONS_WRITE` is set.
- **The dedicated scripts keep working.** `served-operations:write` is unchanged, and `authorization-matrix:observe` is new.
- **Inside the test files:**
  - both refuse their switch under `CI`;
  - an observing run still fails in its `after` hook, after printing the observations, when any status differs from its row;
  - a writing run ends with the drift check skipped, with a message to re-run it, never passed.

**Evidence:**

- **The everyday script.** With either switch set it exits 1 before compiling, printing `MAINTENANCE_SWITCH_SET`.
- **`SERVED_OPERATIONS_WRITE=1 … served-operations:write`.** 7 passed and 1 skipped, the drift check, with `SERVED_OPERATIONS_WRITTEN`. The only change was `generatedAt`, which was discarded.
- **`AUTHORIZATION_MATRIX_OBSERVE=1 … authorization-matrix:observe`.** 667 requests recorded with no mismatch, 116 of 116.
- **The same run with one row deliberately wrong (reverted).** It printed the mismatch (service agent expected 403, observed 200) and failed with `MATRIX_OBSERVED_MISMATCHES`, exit 1.

#### SR-08: `validatedReturnTo` accepts control characters, giving an open redirect in the development sign-in

**Files modified:**

- `apps/web/src/lib/auth/return-to.ts`
- `apps/web/src/lib/auth/return-to.test.ts` (new)

**Commits:** `856319c` (test, RED), `0d260a8` (fix)

**Applied fix.** The validator:

- refuses a control character or backslash anywhere, literal or percent-encoded;
- refuses a second slash or backslash after the first, literal or percent-encoded;
- parses the value against a fixed base and requires the same origin;
- returns the parsed path, and refuses one whose dot segments resolved to a protocol-relative form (`/.//evil.example`, `/%2e//evil.example`).

**Evidence:**

- **RED.** 16 of 31 cases failed. `'/\t/evil.example'` came back unchanged and resolved to `https://evil.example`.
- **GREEN.** All 31 pass, including `/%09/evil.example` and the check that no returned value resolves to another origin, with the auth and boundary suites at 75 of 75.

#### SR-09: The harness never removes its isolated database or production build

**Files modified:**

- `apps/web/src/lib/testing/e2e-run-artifacts.ts` (new)
- `apps/web/src/lib/testing/e2e-run-artifacts.test.ts` (new)
- `apps/web/playwright.config.ts`
- `apps/web/e2e/design-system-conformance.spec.ts`

**Commit:** `d43f576`

**Applied fix:**

- **Runner-only cleanup.** The runner process (not a worker, `TEST_WORKER_INDEX` unset) removes the run's own paths when it exits 0, after Playwright has stopped both servers:
  - the SQLite file with its `-journal`, `-wal` and `-shm` sidecars;
  - the production build;
  - the conformance spec's ordinary `next dev` build, now named by the run instead of the worker pid.
- **When the paths are kept.** On a failure or an interruption, and when `CSRM_E2E_KEEP_ARTIFACTS=1` asks for them. The paths are printed.
- **Only this run's files.** Every path is named by the run's UUID and listed exactly, never globbed, so another run's files are never touched.

**Evidence:**

- **Unit tests.** The names and the keep-or-remove decision are unit-tested.
- **A failing run.** A run failed on purpose with a 1 ms test timeout, and no code change. It exited 1 and kept its database and build, printing both paths.
- **A passing run.** The next run passed and removed its own database and build. The failed run's database stayed: 68 databases before, 68 after.

#### SR-10: The derived server ports fall inside the operating systems' ephemeral port ranges

**Files modified:**

- `apps/web/src/lib/testing/e2e-harness-ports.ts` (new)
- `apps/web/src/lib/testing/e2e-harness-ports.test.ts` (new)
- `apps/web/e2e/helpers/ports.ts` (new)
- `apps/web/playwright.config.ts`
- `apps/web/e2e/production-hardening.spec.ts`
- `apps/web/e2e/design-system-conformance.spec.ts`

**Commit:** `d97858d`

**Applied fix.** Both remedies are in place.

- **Derived outside the ephemeral ranges.** Every harness port comes from its own 2,000-port band between 20000 and 29999: Strapi, the web server, the two refused runtimes, and the conformance spec's `next dev` server, whose `47000 + pid % 1000` port had the same defect. None is ephemeral on Linux (32768–60999) or Windows (49152–65535), and no two bands overlap.
- **Checked free before use.** The three servers the specs spawn bind their port for a moment first, and fail at once, naming the port, if it is taken. Playwright already refuses to start the configuration's two servers over a URL that answers.

**Evidence:**

- The band test passes 15 of 15.
- A reverted sensitivity run with the old web base of 40000 and one overlapping band failed both checks: "expected 41999 to be less than 32768", and one overlap.
- The targeted browser runs above and the full run used the new bands.
- One band is partly taken on this host by a system service (see the host note under Verification).

### Verification after all fixes

Run on `117741f` with the development servers stopped (ports 1337 and 3000 free), 2026-09-26:

| Check | Command | Result |
|---|---|---|
| Web unit suite | `pnpm --filter @csrm/web test` | 94 files, 1756 passed, 0 failed (26 s) |
| Web typecheck | `pnpm --filter @csrm/web typecheck` | exit 0 |
| Contract drift | `pnpm --prefix apps/web api:check` | exit 0; the regenerated `schema.d.ts` is identical |
| Strapi typecheck and suite | `pnpm --filter @csrm/strapi test` | 514 passed, 0 failed (584 s) |
| Browser suite, both projects | `pnpm --filter @csrm/web test:e2e` | 82 passed, 0 failed, no retry: 78 desktop and 4 mobile (11.1 min, 668 s wall) |

After the browser run:

- **Tree.** `git status --porcelain` shows only this report.
- **Cleanup (SR-09).** The run removed its own database (68 before and after) and both of its builds; no `playwright-next-*` or `playwright-ordinary-next-*` directory remains.
- **Listening ports.** Nothing the harness started is still listening, and ports 1337 and 3000 are free.
- **Google Fonts.** No build hit the R-08-24 Google Fonts failure.
- **Log noise.** The production server logged R-08-14's "destination stream closed early" 44 times. That is server-side noise and failed nothing, but it is above the 8 to 33 per run the residual records.

**Browser coverage of the fixes:**

- **SR-01.** The new refused-runtime proof, and the strengthened unattested proof.
- **SR-04.** The twelve real `expectFocusVisible` call sites: Administration create links and CSV file button, the accessibility sweep's filter, reversal and CSV controls, and the Risk Register's date inputs, record link, sort control and Control search.
- **SR-05.** The four lookalike URLs.
- **SR-10.** The conformance spec's ordinary `next dev` server on its new band and run-named build.

**SR-10 host note.** A system service on this host, `ROGLiveService.exe`, listens on 127.0.0.1:22112, inside the web band. It is not part of the repository and was left alone. A run whose runner process id gives slot 112 would find that port taken:

- the web server would fail to start, loudly and at once;
- a rerun takes a new process id.

The three servers the specs spawn check their port first and would say which port is taken.

### Decisions and deviations

- **No worktree.** The fixer role's isolated worktree, on a temporary branch fast-forwarded afterwards, was not used. The operator's rules for this repository allow work on `dev` only, with no branch creation or switching. No other session was editing the tree.
- **Commits.** Plain `git` commits were made with explicit paths, following the repository's convention: a plain-language subject, and the finding id in the body.
- **SR-01's parameter.** The compilation is a defaulted second parameter, not a module constant. A constant read at import could not be varied by tests, while a default is evaluated at each call in vitest and inlined by Next.
- **SR-01's action posts.** Both refused-runtime proofs now post the build's real sign-in action. The previous bare post never reached the action, so it could not show that the action mints nothing.
- **SR-02's approach.** Each unobserved success is proven through citations checked per actor, plus two new mounted proofs. The alternative, issuing every mutation in the matrix against throwaway records, would have needed new seeding for about 25 rows. A success the matrix does not issue is still observed by a real mounted test that sends that actor.
- **SR-02 finding, left unchanged.** An explicit-analyst create of an assessment request writes the body as given, `{ ...input, requestNumber }`. So an analyst's or the service agent's request keeps whatever `requestor` the body names, and only the Requestor path derives ownership. That is authorization design outside this unit. The new proof asserts only the success the matrix states.
- **SR-04's scope.** The helper judges outline and box-shadow, the two ways the direction and the shadcn primitives draw focus. A control whose only focus change is a border colour would fail it.
- **SR-05's docs.** `web-headers.md`'s matcher section records the anchored source.
- **SR-06, both remedies.** The finding offered two remedies for `vitest` and `turbo`: re-pin, or record why a range is preferred. Re-pinning restores the exact pins both carried before the audit. A web image check was considered and not claimed: the record states only what `next` declares.
- **SR-07, CI refusal.** Refusal under `CI` was added inside both test files, as the review suggested. A maintenance switch has no place in CI.
- **SR-09, keep switch.** `CSRM_E2E_KEEP_ARTIFACTS=1` was added so that a passing run's build can still be inspected, as the review did for SR-01.
- **SR-10, the extra port.** The conformance spec's port was fixed too. It was not cited by the finding, but it is a harness port with the same defect.

## Web scope (WR-01 to WR-11)

### How the fixes were made

- **Test first.** Each finding that changes behaviour (WR-02 to WR-10) has a `test(08)` commit, then a `fix(08)` commit, and the failing run was observed before the fix. WR-01 and WR-11 change tests only, so each is one `test(08)` commit; WR-11's guard was also shown failing on purpose.
- **The orchestrator's decisions.** Each finding was fixed as the orchestrator decided for it. Where a decision left a choice open, the choice and its reason are under "Decisions and deviations".
- **Commit bodies.** Each commit names its finding id.

### Fixed Issues

#### WR-01: The Risk Register journey's first filter step fails on four known dates

**Files modified:**

- `apps/web/e2e/risk-register-workflow.spec.ts`
- `docs/security/phase-08-residual-risks.md`

**Commit:** `d93b9f8` (test)

**Applied fix.** The equal-bounds step no longer expects exactly one result. It asserts what equal inclusive bounds guarantee on every run day:

- the stable dated Risk, `RSK-DEV-MUTABLE-001`, is returned;
- the authoritative total equals the distinct Risks shown;
- the total is below the unfiltered total;
- every Risk shown carries the bounded date, read from the `datetime` attribute of the `<time>` element the register already renders. No product markup was added.

The later steps' comparisons with the unfiltered total are unchanged. The residual register records R-08-25 as closed.

**Evidence.** The Risk Register journey passes in both projects in the full run (see Verification). The collision dates themselves cannot be reproduced before 2026-11-24; the new assertions hold whether one or two Risks share the date.

#### WR-02: The Requestor's released-assessment list shows the raw stored value `approved` in its filter chip

**Files modified:**

- `apps/web/src/features/assessments/released-assessment.tsx`
- `apps/web/src/features/assessments/released-assessment.test.tsx`
- `apps/web/src/features/risks/risk-register.tsx`
- `apps/web/src/features/risks/risk-register-filters.tsx`

**Commits:** `faa241e` (test, RED), `f33a157` (fix)

**Applied fix:**

- **The chip.** Its value is `statusLabel('assessment', query.status)`, so it reads `Status: Released`, as the option beside it does.
- **Other chips and filters.** The Risk Register's treatment status chip and filter options now read the shared mapping too. Treatment statuses display verbatim, so their output is unchanged.
- **Checked and already labelled:** the request list (the request labels), both questionnaire lists (`statusLabel`) and the alerts list (its own kind and urgency vocabularies).
- **Left as it is:** the Risk Register's mitigation-control status chip. It shows stored `CsrmControlStatus` values, a family UI-SPEC §3.3 keeps outside the mapping, and it already labels `none` as `No mitigation controls`.

**Evidence:**

- **RED.** 1 of 12 released-assessment cases failed, receiving `Status: approved`.
- **GREEN.** 179 of 179 across the released-assessment, Risk Register, status badge and zod boundary suites.

#### WR-03: The request family's tones contradict the X-5 tone rule recorded in the direction document

**Files modified:**

- `apps/web/src/components/csrm/status-badge.tsx`
- `apps/web/src/components/csrm/status-badge.test.tsx`
- `apps/web/src/features/assessments/assessment-list.test.tsx`
- `apps/web/src/features/dashboard/requestor-dashboard.test.tsx`
- `.planning/phases/08-production-integration-and-hardening/08-UI-SPEC.md`

**Commits:** `f2fd6ea` (test, RED), `14a8dab` (fix)

**Decision (orchestrator).** The request family is aligned with the X-5 vocabulary rather than recorded as an exception:

- request `draft` becomes info: work in progress with the Requestor, as the questionnaire draft;
- request `submitted` becomes success, as a submitted questionnaire;
- icons, labels and the other five request tones are unchanged.

Only the mapping changed, so every surface follows it. The Requestor dashboard's two `Draft` badges, which differed in tint, now match. UI-SPEC §3.3 carries the amended request rows with the reason.

**Tests changed deliberately:**

- `status-badge.test.tsx`: the two request rows. The case that pinned the request draft's neutral recipe byte for byte now pins it as identical to the questionnaire draft. A new case holds a submitted request to the success badge with its own `Send` icon.
- `assessment-list.test.tsx`: the request review list's `Submitted` badges, info to success.
- `requestor-dashboard.test.tsx`: a new assertion that the dashboard's two `Draft` badges share the info tone.
- No E2E or design-contract assertion pinned a request tone. `data-tone` and every tone name were searched across `apps/web/e2e`, so none changed.

**Contrast.** Computed from the shipped tokens in `globals.css` with the WCAG 2.x formula:

| Text | On its tint | On white | On the page | On the inset surface |
|---|---|---|---|---|
| info `#1d4ed8` | 6.16:1 | 6.70:1 | 6.15:1 | 5.57:1 |
| success `#067647` | 5.40:1 | 5.69:1 | 5.22:1 | 4.73:1 |

Every pairing is AA for text (4.5:1).

**Evidence:**

- **RED.** 8 of 60 cases failed. The dashboard read `['neutral', 'info']`.
- **GREEN.** 365 of 365 across the badge, assessment, dashboard, request and questionnaire suites.

#### WR-04: Required-field validation shows zod's default English on every Administration form, and on two analyst editor forms

**Files modified:**

- `apps/web/src/lib/schemas/validation-messages.ts` (new)
- `apps/web/src/features/administration/administration-schema.ts`
- `apps/web/src/features/administration/administration-form.tsx`
- `apps/web/src/features/assessments/assessment-schema.ts`
- `apps/web/src/features/administration/administration-schema.test.ts`
- `apps/web/src/features/administration/administration-workflow.test.tsx`
- `apps/web/src/features/assessments/assessment-actions.test.ts`

**Commits:** `a9fe609` (test, RED), `1f9d4c9` (fix)

**Applied fix.** One zod-free module holds the copy, and each input-schema bound a form can hit carries it. The client forms and the Server Actions validate with the same schemas, so a message reads the same from either.

| Case | Message |
|---|---|
| A required field left blank or holding only spaces | `Enter a name.`, `Enter a control number.`, `Enter a framework.`, `Enter a risk statement.` |
| Any length limit | `Use 255 characters or fewer.`, and likewise for 500, 2,000, 10,000 and 65,535 |
| A missing relation | `Select a reusable Control.`, as the Risk detail's form already asks |
| The Applicable Controls list limit | `Select 1,000 Applicable Controls or fewer.` |
| The exemption review date, typed as text | `Enter the date and time as YYYY-MM-DDTHH:mm:ssZ.` |

- **Optional text holding only spaces.** The Administration form submits every optional free-text field that is blank or holds only spaces as null, the empty value those fields accept, instead of raising an error. The Risk Type description already did this. The optional Control fields' schemas keep refusing a spaces-only value on a direct call, and now say how to fix it: `Enter a control reference, or leave it empty.`
- **What is unchanged.** What the schemas accept and refuse: every bound keeps its value, and only the messages change. The one payload change is the form's null for spaces-only optional text, which those fields already accepted.
- **Out of reach, so left alone.** The forms' own summaries (`Check the … details and try again.`), the `Unrecognized field` message for a forged key, and the enum and identifier checks behind selects: no form can raise them.
- **Shared with other forms.** The Risk detail's forms share the Risk and mitigation-control schemas, so their Server Action messages improve too.

**Evidence:**

- **RED.** 7 of 51 cases failed, each receiving zod's default: `Too small: expected string to have >=1 characters`, `Too big: …`, `Invalid input: expected string, received null`, `Invalid ISO datetime`.
- **GREEN.** 1,204 of 1,204 across the Administration, assessment, Risk, contract parity, chain and lib suites. The web typecheck is clean.

#### WR-05: Four detail routes keep their own title over `Page not found` for an id that does not exist

**Files modified:**

- `apps/web/app/(app)/app/questionnaires/[documentId]/page.tsx`
- `apps/web/app/(app)/app/review/questionnaires/[documentId]/page.tsx`
- `apps/web/app/(app)/app/review/requests/[documentId]/page.tsx`
- `apps/web/app/(app)/app/review/assessments/[documentId]/page.tsx`
- `apps/web/src/lib/metadata/record-route-titles.test.ts` (new)
- `apps/web/e2e/production-hardening.spec.ts`
- `docs/security/phase-08-residual-risks.md`
- `docs/accessibility/phase-08-wcag22-conformance.md`

**Commits:** `bb2540f` (test, RED), `c2a30a1` (fix)

**Applied fix.** Each route applies `recordRouteMetadata`, the helper 08-12 proved on the released assessment route:

- its `generateMetadata` makes the page's own read, wrapped in React `cache()`, so the page and its title share one read per request;
- a 404 raises `notFound()`, so the tab title and the page announcement read `Page not found | IdamBox CSRM`;
- a record that can be read, is refused or fails keeps the route's title, which never names the record.

The residual register closes R-08-16. The conformance record marks its open finding 3 resolved.

**Evidence:**

- **RED.** 8 of 8 route cases failed: no route exported `generateMetadata`.
- **GREEN.** 8 of 8, and 914 of 914 across the metadata, assessment, questionnaire, security and performance suites, including the source-level route guards.
- **Browser.** The production sweep adds five steps, and all pass in the full run:
  - the Security Analyst opens each of the four routes with an id that does not exist and gets the not-found card and title, status 200 (the streamed not-found, R-08-15);
  - the Requestor's refused read of the same questionnaire id keeps `Questionnaire | IdamBox CSRM` over `Questionnaire unavailable`.

#### WR-06: The analyst request review's empty-state copy still says "Draft assistance", on a branch no route reaches

**Files modified:**

- `apps/web/src/features/assessments/assessment-draft-job.tsx`
- `apps/web/src/features/assessments/assessment-detail.tsx`
- `apps/web/src/features/assessments/assessment-review-workflow.test.tsx`
- `apps/web/e2e/questionnaire-generation-workflow.spec.ts`
- `docs/security/phase-08-residual-risks.md`

**Commits:** `c94a620` (test, RED), `8b7ab5c` (fix)

**Applied fix:**

- **The card.** The draft card takes a required `questionnaireSubmitted` fact, which the request review reads from the relationship's served state.
  - Until the questionnaire is submitted, the card shows `Draft generation can begin only after the linked questionnaire is submitted.` in place of `Generate assessment draft`, with no action.
  - Once the questionnaire is submitted, the action returns.
  - A started job still shows its lifecycle.
- **Authority.** This is presentation only. Strapi's 409 stays the authority.
- **The empty state.** The review's dead empty state uses the same sentence, so "Draft assistance" is gone.
- **The register.** The residual register marks the routed item resolved.

**Tests changed deliberately:** the card's 12 existing renders in `assessment-review-workflow.test.tsx` now state that their questionnaire is submitted.

**Evidence:**

- **RED.** 3 of 24 cases failed. The submitted case passed, as the positive control should.
- **GREEN.** 143 of 143 across the assessment and zod boundary suites.
- **Browser.** The questionnaire generation journey asserts the sentence and no generation button while its generated questionnaire is in analyst review, and passes in the full run.

#### WR-07: zod in the browser outside the key routes, and R-08-32 names the wrong route

**Files modified:**

- `apps/web/src/features/requests/request-hub.tsx`
- `apps/web/src/lib/performance/zod-client-boundary.test.ts`
- `docs/security/phase-08-residual-risks.md`
- `docs/performance/phase-08-baseline.md`

**Commits:** `1342f6e` (test, RED), `f6694e8` (fix)

**Applied fix:**

- **The import.** `request-hub.tsx` imports `assessmentStatuses` from the zod-free `assessment-domain.ts`, and the `AssessmentStatus` type only from the schema module.
- **The guard.** The zod client-boundary guard now walks the analyst request review too.
- **The records.** R-08-32 and its source, the performance baseline's finding 2, now name the analyst request review instead of the Requestor's released assessment, which never carried zod, and record that it no longer carries zod either.

**Evidence:**

- **RED.** The new guard case failed with the one chain the review found: `app/(app)/app/review/requests/[documentId]/page.tsx -> src/features/assessments/assessment-detail.tsx -> src/features/requests/request-hub.tsx -> src/features/assessments/assessment-schema.ts -> zod`.
- **GREEN.** 179 of 179 across the guard, request and assessment suites, the guard's 11 cases included.

#### WR-08: The CSV import row-state badges choose their own label, tone and icon; Ambiguous reuses the High-severity triangle

**Files modified:**

- `docs/design/csrm-design-direction.md`
- `apps/web/src/components/csrm/status-badge.tsx`
- `apps/web/src/features/administration/csv-import-flow.tsx`
- `apps/web/src/components/csrm/status-badge.test.tsx`
- `apps/web/src/features/administration/administration-workflow.test.tsx`

**Commits:** `c890149` (test, RED), `cf71029` (fix)

**Applied fix:**

- **The direction document first.** §4 Status & risk badges records the family as a CSRM extension (2026-09-26), in the X-5 vocabulary:
  - a row that is or will be written, `Create` or `Update`, is success;
  - an `Unchanged` row is neutral;
  - a `Rejected` or `Ambiguous` row waits on the Security Analyst to correct the file, so it is warning, never danger, which X-5 reserves for a recorded overdue state.
- **Icons.** `Check`, `RefreshCw`, `FileCheck2` and `CircleX` are kept. `Ambiguous` changes from the High severity triangle to `CircleQuestionMark`.
- **The mapping and the flow.** The shared mapping gains that `importRow` family. The flow's review and results render every row state through `StatusBadge`, and read their labels, filter buttons and summary counts from the same mapping. The badge icon now has the badge's own size everywhere.
- **Unchanged.** The results summary keeps its past-tense `Created` and `Updated` counts.

**Evidence:**

- **RED.** 14 cases failed: the mapping had no `importRow` family, and the flow's badges carried no tone.
- **GREEN.** 239 of 239 across the component (status badge included), Administration and zod boundary suites.
- **Browser.** The Administration import journeys in the full run still read `Create` and `Unchanged` from each badge.

#### WR-09: `BrandLockup` uses `next/image`'s `priority`, deprecated since Next 16

**Files modified:**

- `apps/web/src/components/shell/wordmark.tsx`
- `apps/web/src/components/shell/wordmark.test.tsx`

**Commits:** `f2d3be3` (test, RED), `9bf9af9` (fix)

**Applied fix.** The logo mark passes `preload`, which the installed docs name as `priority`'s replacement (`02-components/image.md`, "priority"). In the installed 16.3.6 the two take the same path: `get-img-props.js` treats `priority` as `preload`. The mark therefore still renders without lazy loading and keeps its head preload on the shell, sign-in, the root not-found and the global error page.

**Evidence:**

- **RED.** 1 of 2 wordmark cases failed, on the source check.
- **GREEN.** 60 of 60 across the shell, root fallback and sign-in suites.

#### WR-10: The Risk Register loading state reads a repeated query parameter differently from the page

**Files modified:**

- `apps/web/src/features/risks/risk-register-loading.tsx`
- `apps/web/src/features/risks/risk-register-loading.test.tsx`

**Commits:** `12ed8a3` (test, RED), `8f27220` (fix)

**Applied fix:**

- **The URL's shape.** The fallback builds the shape Next passes the page: a string for a key that appears once, and an array only for a repeated key. The shared reader therefore takes the first value, as the page's parser does.
- **A repeated target date.** It is not a date, so the reader refuses it, and 15dcacf's handling draws the register without that bound, matching the page's invalid-filter state.
- **Unchanged.** A single-valued URL reads as before.

**Evidence:**

- **RED.** 2 of 5 cases failed: the skeleton selected `Overdue` instead of `Complete`, and it drew a `Target date from` chip for a date the page refuses.
- **GREEN.** 123 of 123 across the Risk and zod boundary suites.

#### WR-11: The accessibility sweep's governed-questionnaire scans depend on file order to see the state they are meant to scan

**Files modified:** `apps/web/e2e/accessibility.spec.ts`

**Commit:** `3251a0c` (test)

**Applied fix.** Each governed scan asserts, at both widths and before scanning, the state it claims:

| Scan | State asserted |
|---|---|
| Analyst questionnaire review | The `Analyst review` badge and the `Release questionnaire` control |
| Analyst released questionnaire review | `Awaiting questionnaire submission`, and a badge that is neither `Analyst review` nor `Submitted` |
| Requestor questionnaire detail | The completion summary and `Submit questionnaire`, and not `Submitted` |

The analyst request hub step also expects the request in the awaiting-requestor queue before opening it.

**Evidence:**

- **Sensitivity.** A throwaway probe spec, sorted before the sweep and never committed, released the analyst-review fixture first. The sweep then failed at "analyst questionnaire review at 1440px is in analyst review": expected `Analyst review`, received `Not started`. The probe file and that run's database and build were removed.
- **Pass.** The sweep passes in the full run, in the file order the suite uses.

### Verification after all fixes

Run on `3251a0c` with the development servers stopped (ports 1337 and 3000 free), 2026-09-26:

| Check | Command | Result |
|---|---|---|
| Web unit suite | `pnpm --filter @csrm/web test` | 95 files, 1793 passed, 0 failed (21.4 s) |
| Web typecheck | `pnpm --filter @csrm/web typecheck` | exit 0. Earlier in this scope a deliberate type error in a throwaway file, since removed, failed it, which shows the incremental check does check |
| Contract drift | `pnpm --prefix apps/web api:check` | exit 0; the regenerated `schema.d.ts` is identical |
| Browser suite, both projects | `pnpm --filter @csrm/web test:e2e` | 82 passed, 0 failed, 0 flaky, no retry: 78 desktop and 4 mobile (11.4 min, 685 s wall) |
| Strapi suite | not run | No Strapi file changed in this scope |

After the browser run:

- **Tree.** `git status --porcelain` shows only this report.
- **Cleanup (SR-09).** The run removed its own database (68 before and after) and its builds.
- **Listening ports.** Only the host's `ROGLiveService.exe` on 22112 is listening, as the server scope recorded. Ports 1337 and 3000 are free.
- **Google Fonts.** No build hit the R-08-24 Google Fonts failure.
- **Sweep coverage.** The production sweep covered 42 analyst routes, the four missing-record steps included, and 14 Requestor routes, the refused read included.
- **Log noise.** The production server logged R-08-14's "destination stream closed early" 52 times, against 44 in the server scope's run and the 8 to 33 per run the residual records. It failed nothing. The ten new missing-record sweep visits, each a not-found raised while a page streams, are a likely share of the increase. This is not proven.

### Decisions and deviations

- **No worktree.** As for the server scope, work was committed directly on `dev`, as the operator's rules require.
- **WR-01.** The date is read from the `<time datetime>` the register already renders, so no markup was added for the test.
- **WR-02.** The Risk Register's treatment chip and options were routed through the mapping too; their output is unchanged. The mitigation-control status chip was left as it is, because UI-SPEC §3.3 keeps `CsrmControlStatus` outside the mapping.
- **WR-03.** UI-SPEC §3.3 was amended with a dated note beside the request rows. Otherwise the approved contract, which the UI audit reads, would state tones the product no longer ships.
- **WR-04, where the messages live.** On the input schemas, not in a global zod error map. Explicit messages are testable, and a global map would also reach every response parser.
- **WR-04, client rules.** The analyst editors gained none. They validate nothing in the browser, and the review editor is a zod-guarded key route. Their messages come back from the Server Actions and show under each field.
- **WR-04, wider reach.** The length message sits on the shared 65,535-character string, so the assessment editor's text fields and the Risk detail's Server Actions state it too.
- **WR-04, two additions.** The exemption review date's format message was added, because it is the one typed-text format an analyst can get wrong on the Add Risk form. The spaces-only rule was applied to every optional free-text field of the Administration form, one rule rather than three special cases.
- **WR-05.** Browser proof was added to the production sweep, beyond the unit cases the review asked for. The conformance record's open finding 3 was marked resolved, because it described the same defect.
- **WR-06, the prop.** `questionnaireSubmitted` is required. A default would either offer the action or withhold it without being told.
- **WR-06, the empty state.** The dead empty state keeps its place in the component's state set, with the new sentence, rather than being removed.
- **WR-07.** The performance baseline's finding 2, which R-08-32 cites, was corrected alongside the register.
- **WR-08.** Only the Ambiguous icon changed. The tones follow the recorded vocabulary. The direction document's entry is in the same commit, ahead of the code.
- **WR-09.** `preload` was chosen over the docs' `loading="eager"` or `fetchPriority="high"`: those would drop the head preload the mark has always had, and `preload` is the like-for-like replacement.
- **WR-11.** The guards assert their state; they do not re-establish it. A released questionnaire returns to analyst review only once it is submitted, so the states cannot all be recreated from inside the sweep.
- **Records left to the orchestrator.** `.planning/STATE.md` and `deferred-items.md` still describe R-08-25 and the "Draft assistance" item as open. Both are orchestrator-owned files and were not edited.

---

_Fixed: 2026-09-26T06:14:29Z (server scope), 2026-09-26T07:24:26Z (web scope)_
_Fixer: gsd-code-fixer_
_Iteration: 1_
