---
phase: "08"
slug: "production-integration-and-hardening"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-26"
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

## Scope and Method

- **Audited commit.** `d11f469`, the range `a9394cf..d11f469`: 156 commits, the phase code review and all 21 of its fixes included. Every citation is `path:line` at that commit.
- **Register origin.** All fourteen plans carry a `<threat_model>`, so the register was authored at plan time: 63 threats. 58 are dispositioned `mitigate`, including T-08-03-02 and T-08-10-03, which mitigate part of a threat and accept the rest. 5 are dispositioned `accept`. The research's twenty inputs, T-08-R01 to T-08-R20, are re-keyed by the plans; each one's mapping is in the table after the register. This audit also:
  - audited the 39 rows of the consolidated residual register (`docs/security/phase-08-residual-risks.md`) by id;
  - read the code review (`08-REVIEW.md`) and its fixes (`08-REVIEW-FIX.md`) for security effect;
  - registered five items of its own, T-08-A1 to T-08-A5.
- **Configuration.** `.planning/config.json` sets no security key, so the defaults apply: enforcement on, ASVS level 1, `security_block_on: high`.
- **Counting convention.** `threats_open` counts every open threat, as the orchestrator's zero-open target asks. Two are open: T-08-A1 is medium and T-08-A2 is high. The earlier convention counted only open threats at or above `high` (06.8, 07), and under it the count would be 1. Either way the gate blocks. The re-audit found none open, under either convention.
- **Read-only.** This unit wrote only this file. It ran no Strapi suite, Playwright run, build or server. What it ran:

  | Check | Result |
  |---|---|
  | `vitest run src/lib/security src/lib/auth src/lib/testing src/lib/api src/lib/boundaries` (apps/web) | 20 files, 836 passed, 0 failed |
  | `vitest run` over the contract chain and parity guards, `src/lib/metadata`, `src/lib/performance`, `src/features/requests`, the revision timeline and the assessment review tests | 14 files, 156 passed, 0 failed |
  | `pnpm audit --json` at the root (a registry lookup) | critical 0, high 1, moderate 13, low 1: the same fifteen advisory ids that `dependency-audit-phase-08.md` records |
  | `cmp` of the two catalogue copies | identical; 121 FunctionAPIs, 3 roles, 45 Functions |
  | Schema freeze, `git diff a9394cf..d11f469 -- 'apps/strapi/src/api/*/content-types/*'` (15 schemas) | empty. The same diff from `b4f3d88^` shows the last schema change, so the check can fail |
  | Added-line sweeps over the range | no Keycloak mention, no `.env*` file, no `CSRM_AI_*` change, no token pattern (`sk-`, `ghp_`, `AKIA`, JWT, private key), no attribution in any commit subject or body |
  | Log and sink sweeps | thirteen `strapi.log` call sites, as recorded; no `console.*` in shipped web source; no HTML sink in shipped web source |
  | Read-only `curl` probes of the running dev servers | Strapi and web header facts, quoted where used below. No data was changed and no generation triggered |
  | `validatedReturnTo` probed in a scratch copy with twenty hostile values | every result resolves to the web origin |
  | `git status --porcelain` before and after | clean |

- **Browser and Strapi-suite evidence** is cited from the recorded runs:
  - the 08-14 gate on `0290f4f`: Strapi 504/504, web 1677 tests in 91 files, Playwright 81/81;
  - the review fixes' server scope on `117741f`: web 1756, Strapi 514/514, Playwright 82/82;
  - the web scope on `3251a0c`: web 1793 tests in 95 files, Playwright 82/82.

  No Strapi file changed after `117741f`.
- **Concurrency.** A verifier and a UI auditor ran alongside this audit. The UI-owned residuals R-08-26 to R-08-30 are theirs to rule on. They carry no security weight.
- **Remediation after this audit (2026-09-26).** A fixer unit closed the two open threats and the CORS exposure on `dev`, each test-first. The rows below cite its commits and proving tests at `51946b0`:

  | Item | RED test | Fix |
  |---|---|---|
  | T-08-A1 | `4529705` | `1379bf7` |
  | T-08-A2 | `a43ec4c` | `197965e` |
  | T-08-A3 / R-08-11 (CORS) | in the fix commit | `eb7e72d` |
  | The policy comment the verifier flagged | – | `bab4f15` |
  | The body-limit unit test, which read the middleware configuration as an array | – | `51946b0` |

  The residual register and `strapi-http-hardening.md` were corrected in the same unit. No schema, contract, catalogue grant or `CSRM_AI_*` value changed.

  Verification on `51946b0`, with the dev servers stopped:

  | Check | Result |
  |---|---|
  | Full Strapi suite | 526/526 in 636 s |
  | Web unit suite | 1793 tests in 95 files |
  | Web typecheck | clean |
  | `api:check` | clean; the generated client is byte-identical |

  The first full run, on `bab4f15`, had one failure: ADMIN-04's body-limit test still read the middleware configuration as an array, and `51946b0` fixed it. No Playwright run was needed, because no web code changed.

  A read-only probe through the mounted harness observed the default CORS answers: a foreign origin gets no grant on an `/api` read, on `POST /admin/access-token` (401) or on its preflight. A request with no `Origin` still carries Strapi's empty `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`, as before the change (`strapi-http-hardening.md` § CORS).

  `threats_open` now reads 0. The remediation set it on its own evidence, not an audit verdict. `status` stays `draft` until the audit is re-run, and that re-run confirms or reopens each row marked "remediated".
- **Re-audit (2026-09-26, at `8035357`).** The audit was re-run over the remediation and the 46 commits after it. It confirmed every row marked "remediated" and T-08-A3's new disposition. It also closed O-1 to O-3 and found no reopened mitigation, so `status` is now `verified`. The evidence is in § Security Audit 2026-09-26 (re-audit). The sections above and below keep their findings and their `d11f469` citations as history; the re-audit's own citations are at `8035357`.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Playwright to the production web server | The web runs `NODE_ENV=production`. The development sign-in exists only inside the attested E2E runtime (D-11). | Attestation path, nonce and run root; the development identity header |
| Browser to `proxy.ts` to routes | Every document response gets the header set and a fresh nonce, which reaches Next through the request's `Content-Security-Policy` header. | Nonce, policy |
| Cross-site page to Server Actions | A forged POST with a foreign `Origin` must be refused before any action runs. | Form posts, session cookie |
| Web server to Strapi | The `server-only` typed client carries the full-access API token and, only in a development session, `x-csrm-dev-identity`. Strapi re-authorises every call. | Every CSRM operation |
| API token holder to Strapi plugin routes | Users & Permissions, upload, email, i18n and content-type-builder routes stay mounted, and the token reaches them (R-08-02). | Plugin accounts, roles, files |
| Any browser origin to Strapi CORS | At this audit, `strapi::cors` echoed any `Origin` with credentials, on the content API and the admin panel alike (T-08-A3). Since `eb7e72d` it grants only the origins in `CSRM_CORS_ALLOWED_ORIGINS`, none by default. | Admin refresh cookie |
| Strapi policy to controller | The policy decides the actor (`requestor` or `analyst`) and the scope. The controller decides which fields of the body it writes. Since `1379bf7` and `197965e`, both actors write only the published create and update bodies. | Request bodies (T-08-A1, T-08-A2) |
| Build output to browser | Client chunks must carry no server-only name or value (D-22). | Static assets |
| Strapi harness to test-only middleware | The forced internal error exists only in the test process (D-38). | Sentinel header |
| Working tree to history | A run must modify no tracked file, and run artefacts are never staged (D-12). | Builds, SQLite files, logs |

## ASVS Key

ASVS 4.0.3, the level 1 requirements unless noted.

| Requirement | Meaning used here |
|-------------|-------------------|
| V2.2.1 | Anti-automation and account controls on authentication routes |
| V3.4.1–V3.4.3 | Cookie `Secure`, `HttpOnly` and `SameSite` |
| V4.1.1, V4.1.3, V4.1.5 | Trusted-layer access control; least privilege; fail securely |
| V4.2.1 | Protection against reading or modifying other principals' records (IDOR) |
| V4.2.2 | Anti-CSRF |
| V5.1.2 | Protection against mass parameter assignment |
| V5.1.3, V5.1.4 | Allow-list validation; structured data validated against a schema |
| V5.1.5 | Redirects only to allow-listed destinations |
| V5.3.3 | Context-aware output escaping (XSS) |
| V7.1.1, V7.1.2 | No credentials or sensitive data in logs |
| V7.4.1 | Generic message for unexpected errors |
| V8.3.4 | Sensitive data identified and handled by policy |
| V12.1.1 | Upload size limits |
| V13.1.4 (L2) | Authorisation at the route and at the resource, cited as in `07-SECURITY.md` |
| V13.2.1, V13.2.2 | Valid HTTP methods only; JSON schema validation |
| V14.2.1, V14.2.2 | Components current; unneeded features removed |
| V14.3.2, V14.3.3 | Debug modes off in production; no version headers |
| V14.4.3–V14.4.7 | CSP, `nosniff`, HSTS, `Referrer-Policy`, `frame-ancestors`/`X-Frame-Options` |
| V14.5.3 | CORS `Access-Control-Allow-Origin` from a strict allow list |

## Required Control Coverage

| Control | Threat IDs | Verified by |
|---------|------------|-------------|
| The development session is keyed on the compilation, and a production build has it only inside the attested runtime | T-08-02-01, T-08-02-02, T-08-02-04 | `development-runtime.ts:28-37`; `development-runtime.test.ts:56-186`; `e2e-runtime-attestation.test.ts:52-149`; the two refused-runtime proofs in `production-hardening.spec.ts:193,243` |
| Strapi resolves no identity outside a development runtime | T-08-02-01 | `development-identity-enabled.ts:1-7`; `authorization.integration.test.ts:34-66` |
| The IAM and generic reference routers mount nothing, registration is off, and no route collides | T-08-03-01, T-08-03-02, T-08-03-03 | `only: []` routers; `served-operations.integration.test.ts:633-683`; live probes answer 404 |
| One matrix row per served operation and plugin route; denials issued with persistence equality; allowed successes proven per actor | T-08-05-01, T-08-05-02 | `authorization-matrix.integration.test.ts:117-229`; `helpers/matrix-provenance.ts:52-78` |
| Field-level bound on analyst writes to a request | T-08-A1, T-08-A2 | Absent at this audit (`csrm-assessment-request.ts:147,173`). Remediated:<br>- **create:** `prepareRequestorCreate` for every actor (`request-workflow.ts:133-155`; `csrm-assessment-request.ts:135-160`);<br>- **update:** `prepareAnalystUpdate` (`request-workflow.ts:177-198`; `csrm-assessment-request.ts:177`);<br>- **tests:** `authorization.integration.test.ts:562,607,629,688` and `authorization-policy.unit.test.ts:292,317`.<br>**Verified by the re-audit** at `8035357`. |
| CORS origin allowlist, empty by default | T-08-A3 | Remediated:<br>- **configuration:** `config/middlewares.ts:10-19`; `src/utils/cors-allowed-origins.ts:24-41`;<br>- **tests:** `http-hardening.integration.test.ts:135,160`, `cors-allowlist.integration.test.ts:32,48` and `cors-allowed-origins.unit.test.ts`.<br>**Verified by the re-audit** at `8035357`, with a live probe of the dev Strapi. |
| Bare 500 envelope and no framework name | T-08-05-03, T-08-05-04 | `http-hardening.integration.test.ts:44-111`; `@strapi/core` `errors.js` has no environment branch |
| Nonce CSP, static header set, no eval in production | T-08-10-01 to T-08-10-04, T-08-11-03 | `proxy.ts`, `content-security-policy.ts`, `next.config.ts`; unit tests; the production sweep |
| No server-only value in client chunks | T-08-10-05 | `server-only-boundary.test.ts`; the chunk scan at `production-hardening.spec.ts:611` |
| Server Action origin check | T-08-10-06 | Next 16.3.6 `action-handler.js:427-467`; `production-hardening.spec.ts:648` with a positive control |
| No unsafe HTML sink; boundaries never print errors | T-08-10-07, T-08-09-01 | `output-safety.test.ts`; `route-boundaries.test.ts:101-120` |
| Contract chain and parity guards | T-08-03-04, T-08-04-01, T-08-04-02 | `contract-operation-chain.test.ts`; `contract-response-parity.test.ts`. Since this audit, O-1 widened both chain scans and the G1 closure widened the parity guard's reach (re-audit). After the re-audit, the G2 closure carried that reach inside each question's answer envelope (see T-08-04-02). |
| Browser IDOR at both widths | T-08-11-01, T-08-12-02 | `assessment-navigation-lifecycle.spec.ts:150-241`; `accessibility.spec.ts:198-208` |
| Same-origin return path only | T-08-A5 | `return-to.ts:9-28`; `return-to.test.ts` |
| Dependency hygiene, schema freeze, no Keycloak, no secrets | T-08-01-01, T-08-01-SC, T-08-14-03 to T-08-14-05, T-08-A4 | the re-runs listed under Scope and Method |

## Threat Register

Severity is this audit's grading; the plans did not grade their threats. Every `mitigate` row was verified by reading the cited code and tests at `d11f469`.

| Threat ID | Category | ASVS | Severity | Component | Disposition | Status | Verification evidence |
|-----------|----------|------|----------|-----------|-------------|--------|-----------------------|
| T-08-01-01 | Elevation of privilege, denial of service | V14.2.1 | high | Transitive advisories (`tar`, `js-yaml`, `nodemailer`, `sharp`, `vitest`, `turbo`) | mitigate | closed | Overrides at `pnpm-workspace.yaml:12-15`, `vitest` 4.1.11 and `turbo` 2.11.3 pinned exactly. The audit re-run on `d11f469` shows 0 critical and one high, `vite` GHSA-fx2h-pf6j-xcff (T-08-01-02). The suites are green on the patched tree. **Re-audit:** the same fifteen ids on `8035357`, and `nodemailer` is now pinned exactly (O-3). |
| T-08-01-02 | Denial of service | V14.2.1 | medium | `vite` 5.4.21 in Strapi's admin build | accept | closed | R-08-21 |
| T-08-01-SC | Tampering (supply chain) | V14.2.1 | low | Package installs | mitigate | closed | Across the phase, the three manifests and `pnpm-workspace.yaml` add or remove no dependency key. They change three versions (`next`, `vitest`, `turbo`), add four overrides and change scripts. The upload plugin's `sharp` link resolves 0.35.4 (R-08-39). |
| T-08-02-01 | Spoofing | V14.3.2, V4.1.1, V4.1.5 | high | The development identity under a production build | mitigate | closed | **Resolver.** `resolveSessionRuntimeMode(env, compiledFor = process.env.NODE_ENV)` (`development-runtime.ts:28-37`). A `next dev` compilation has the session only while running as development. A production build has it only with runtime `production`, both D-11 variables and a valid attestation. All consumers go through it: `development-session-adapter.ts:38-40,126-128`, `server-client.ts:70-72`, `sign-in/page.tsx:14-16`. **Gates.** Each gate is proven alone in `development-runtime.test.ts:56-186`, including SR-01 at `:74-94` and the literal default at `:178-186`. **Browser.** `production-hardening.spec.ts:193` (no attestation) and `:243` (started with `NODE_ENV=development`) show the card, the `/app` redirect, and the build's real sign-in action posted with no role cookie. The second was RED on the old resolver (3 buttons). **Backstop.** Strapi's gate needs its own three variables (`development-identity-enabled.ts:1-7`) and refuses a production runtime (`authorization.integration.test.ts:34-66`). **History.** This was open at review as SR-01, a regression, and was closed by `fa4bc5b` and `151a443`. |
| T-08-02-02 | Spoofing | V4.1.5 | medium | Attestation forgery or replay | mitigate | closed | `e2e-runtime-attestation.ts:35-55` requires: a root strictly inside `os.tmpdir()/csrm-playwright-e2e`, the file directly inside the root, an equal nonce, and `createdAt` not in the future and under an hour old. The module is `server-only`. `e2e-runtime-attestation.test.ts:52-149` refuses each case. The harness writes a random-UUID nonce with mode 0600 and removes the root at exit (`playwright.config.ts:41-49`). |
| T-08-02-03 | Information disclosure | V3.4.1–V3.4.3 | low | Session cookie without `Secure` over TLS | mitigate | closed | `Secure` follows the first `x-forwarded-proto` value. The cookie keeps `httpOnly`, `SameSite=Lax`, path `/` and 8 h (`development-session-adapter.ts:51-54,79-87`; `development-session-adapter.test.ts:179-197`). Residual R-08-03. |
| T-08-02-04 | Information disclosure | V7.4.1 | medium | The framework's default error from `ProtectedLayout` | mitigate | closed | `UnavailableSessionAdapter` resolves null and redirects to the card (`development-session-adapter.ts:105-121`; test `:77-114`). Both refused runtimes land on the card from `/app` (`production-hardening.spec.ts:147-176`). The root fallbacks are T-08-09-01. |
| T-08-02-05 | Tampering (hygiene) | – | low | A run mutating tracked files or leaving a server listening | mitigate | closed | An isolated build uses the extends-only `tsconfig.e2e.json` (`next.config.ts:38-41`). `next-env.d.ts` is untracked and ignored (`.gitignore:6`). The spawned servers get SIGTERM, then SIGKILL (`production-hardening.spec.ts:96-105`), and their ports are polled closed (`:234,270`). The tree was clean after every recorded run and in this audit. |
| T-08-03-01 | Elevation of privilege | V4.1.3, V4.1.1, V13.2.1 | high | IAM core routers reachable by the full-access token | mitigate | closed | `only: []` on `function`, `function-api`, `idambox-user`, `role` and `application`, and on the two generic reference reads (D-44). `served-operations.integration.test.ts:633-661` asserts no application layer serves those bases, GET answers 404, and a mutation answers 404 or 405. Live probe: `/api/functions`, `/api/idambox-users` and `/api/roles` answer 404. |
| T-08-03-02 | Spoofing, denial of service | V2.2.1, V14.2.2 | medium | Users & Permissions registration, login and `me` | mitigate / accept | closed | `disableUsersPermissionsRegistration` (`disable-users-permissions-registration.ts:15-22`) runs first in bootstrap (`index.ts:23`). `served-operations.integration.test.ts:663-673` asserts `allow_register === false`, a 4xx registration and an unchanged account count. Matrix rows `fixtures/authorization-matrix.ts:400-420` confirm. Login and `me`: R-08-01. |
| T-08-03-03 | Information disclosure | V4.1.1 | medium | `/api/roles` served by an unexpected handler | mitigate | closed | `served-operations.integration.test.ts:675-683`: no application layer, 404 and no responder, and `collisions` empty. The inventory records 0 collisions. Live probe: 404. |
| T-08-03-04 | Tampering | V5.1.3 | medium | A service call with a computed or non-contract path | mitigate | closed | `contract-operation-chain.test.ts:31-36,78-97,125-188` enforces `NON_LITERAL_CLIENT_PATH`, `CLIENT_OUTSIDE_SERVICE_LAYER`, `CLIENT_METHOD_DETACHED`, `NOT_IN_SPEC`, `NOT_SERVED`, `NOT_CATALOGUED`, `FETCH_OUTSIDE_TRANSPORT` and server-only services. The inventory adds `WEB_CALLS_UNSERVED` (`served-operations.integration.test.ts:488`). SR-03 widened both scans to every module and receiver; its probes failed before the fix and passed after (`1005bd9`). Blind spot: observation O-1, closed by `e4b7d2d` (re-audit). |
| T-08-03-05 | Elevation of privilege | V4.1.3 | high | Catalogue grants widened | mitigate | closed | Both copies are byte-identical (`cmp`; `served-operations.integration.test.ts:613-617`). The phase diff of either copy touches design notes 8 and 9 only. `apps/strapi/src/policies` is unchanged across the phase. |
| T-08-04-01 | Denial of service | V5.1.4, V13.2.2 | medium | A blank or over-long identifier failing a page's closed parse (IN-03) | mitigate | closed | `a36569d`, the phase's only contract commit, adds exactly nine `minLength`/`maxLength` bounds, and the parsers mirror them. The `boundary-empty` and `boundary-long` modes (`contract-response-parity.test.ts:222-257`) prove acceptance at both edges. |
| T-08-04-02 | Tampering | V5.1.3 | low | A parser narrower than the contract, invisible to the guard | mitigate | closed | `contract-response-parity.test.ts:398-469` enforces three rules: an unregistered rejection fails; a Phase 7 or later parser can never be grandfathered (`:443`); a stale grandfather fails (`:453-462`). The backlog count of 33 is asserted (`:465-470`). Blind spots: R-08-17, R-08-18. **Re-audit:** the G1 closure closed R-08-18. Every registered parser must now report a mistyped field at that field (`:500`). The count is 43, asserted at `:591`, and the Phase 7 and stale-grandfather rules still hold (`:561`, `:571`). **G2 closure (2026-09-26, after the re-audit; `fc6a791` RED, `f3dc30f` fix):** the phase re-verification found the field-path and question-key rules did not reach inside each question's answer envelope. A nested parse reported every envelope rejection at the answer, which the four question-list registrations narrowed. Each envelope rejection is now reported at its own field (`questionnaire-schema.ts:150-157`), and the blanket narrowing is replaced by the one path the guard sees, `…answer.submittedAt` on a draft, with its reason. Two rules keep it so:<br>- the four registrations must report a corrupted answer state, `updatedAt`, value or unrecognised key at that envelope field (`contract-response-parity.test.ts:574`);<br>- a narrowing that names an object or a list may not hide a mistyped field inside it (`:620`), which also catches a wrapper that reports at `data`.<br>A 5-character cap planted on a text answer's value now fails the guard at `data.0.answer.value`, and passed every earlier rule on `7d89665`. The note therefore covers the answer envelope too. The count stays 43 (`:683`). |
| T-08-04-03 | Information disclosure | – | low | A bound wider than the server guarantees | accept | closed | R-08-20 |
| T-08-05-01 | Information disclosure, tampering, elevation of privilege | V4.2.1, V4.1.3, V13.1.4 | high | Another Requestor's record through the API; "My" operations widening | mitigate | closed (Requestor actors at audit; every actor since the re-audit) | **Completeness.** Exactly one row per served operation and plugin route (`authorization-matrix.integration.test.ts:117-148`). **Denials.** Every denial is issued with persistence equality, leak and fixture patterns, `mustNotDisclose` and owner-scoped totals (`:180-229`). Rows: requests `fixtures/authorization-matrix.ts:622-706`, questionnaires `:707-898`, assessments `:899-1015` (404 for another Requestor's assessment). **Allowed successes.** SR-02 proves each unissued success per actor (`:150-160`; `helpers/matrix-provenance.ts:52-78`, plus two new mounted proofs). **Switches.** SR-07 refuses the observe and write switches in the everyday run and under CI (`scripts/refuse-maintenance-switches.mjs`; `authorization-matrix.integration.test.ts:59-73`). **Limit.** The matrix proves status and persistence per actor. It does not bound which fields an allowed analyst write sets: see T-08-A1 and T-08-A2. Both were remediated on 2026-09-26, and the matrix's create and update rows now cite the ownership proofs for the analyst and the service agent (`fixtures/authorization-matrix.ts:644,674`). The re-audit verified both, so the limit is closed. |
| T-08-05-02 | Elevation of privilege | V4.1.3 | high | Service agent holding a human-analyst grant | mitigate | closed | Every `HUMAN_ANALYST_ONLY_OPERATIONS` literal must stay in the policy, and each row must deny the agent, the owner and the other Requestor (`authorization-matrix.integration.test.ts:162-178`). A mis-granted agent is refused the release that a human analyst with the same grant receives (`authorization-policy.unit.test.ts:419-429`). The guard is `csrm-authorization.ts:34-42,270-273`. T-08-A2 reached an equivalent effect without a human grant, until `197965e` remediated it. The policy comment now states the actual grant (`bab4f15`): the service agent's role holds the release FunctionAPI, and this guard is what refuses it. |
| T-08-05-03 | Information disclosure | V7.4.1 | medium | Stack trace or internal message in a 500 | mitigate | closed | `http-hardening.integration.test.ts:55-84`. The test-only middleware is absent from `src` (`:44-53`). `@strapi/core` 5.51.0 `dist/services/errors.js:66-75` and `dist/middlewares/errors.js:26-29` have no environment branch (read in this audit). The live 401 carries the bare envelope. |
| T-08-05-04 | Information disclosure | V14.3.3 | low | `X-Powered-By: Strapi` | mitigate | closed | `config/middlewares.ts:3-23` has no `strapi::poweredBy`. The header is asserted absent on a 200, a 403 and a 500 (`http-hardening.integration.test.ts:86-111`), and was absent on the live 401 and preflight. |
| T-08-05-05 | Information disclosure | V7.1.1, V7.1.2 | medium | Sensitive data in server logs | mitigate | closed | The sweep re-run finds exactly the thirteen call sites `strapi-http-hardening.md` tables. Twelve write constants or seed identifiers. The thirteenth is the opt-in AI transcript diagnostic (`openai-compatible-client.ts:27`; default `false` at `config/ai.ts:9`), accepted as R-08-12. The plan's "fixed" became "recorded", because `CSRM_AI_*` behaviour is outside the phase (08-05 deviation). |
| T-08-05-06 | Spoofing | V2.2.1 | medium | Users & Permissions public routes | accept | closed | R-08-01; matrix rows `fixtures/authorization-matrix.ts:288-470` |
| T-08-05-07 | Elevation of privilege | V4.1.3 | high | Grant widening in 08-05 | mitigate | closed | No catalogue change in the plan's commits (see T-08-03-05). |
| T-08-05-08 | Tampering | V14.4.7 | low | Clickjacking of API responses | accept | closed | R-08-10 |
| T-08-06-01 | Denial of service (INT-03 safe failure) | V5.1.4 | medium | Deterministic draft refused by its own parser | mitigate | closed | `compareRiskTypeNames` and `sortRiskProposals` (`assessment-draft-provider.ts:87-94`) are used by the parser (`:116`), the deterministic provider (`deterministic-assessment-draft-provider.ts:146`) and the adapter (`openai-compatible-assessment-draft-provider.ts:52`). Proven by `ai-provider-assessment.unit.test.ts:81-168`. |
| T-08-06-02 | Information disclosure | V4.1.3 | medium | Actor display names reaching a Requestor | mitigate | closed | The lookup runs only for the analyst actor, after the authorised record read (`csrm-questionnaire.ts:142-151,369`). The Requestor projection omits `by` (`questionnaire-scope.ts:319-345`). Mounted proof: `questionnaire-governance.integration.test.ts:447-495` (`:482`). Unit proof: `questionnaire-governance.unit.test.ts:185,220`. |
| T-08-06-03 | Information disclosure | V8.3.4 | low | The lookup returning more of the user record | mitigate | closed | `fields: ["documentId", "displayName"]`, active users only, limit equal to the distinct ids (`csrm-questionnaire.ts:146-150`). Names count only when non-blank and at most 255 characters (`questionnaire-scope.ts:297-307`). The mounted projection carries two keys (`questionnaire-governance.integration.test.ts:142`), and an unknown or inactive actor gets a null name (`:496-531`). |
| T-08-06-04 | Elevation of privilege | V4.1.3 | high | Grant widening in 08-06 | mitigate | closed | `ac9c936` and `63e4550` touch no catalogue, spec or policy file. |
| T-08-07-01 | Repudiation, tampering (INT-03) | – | medium | Copy implying a draft is complete, approved or provider-made | mitigate | closed | `assessment-review-workflow.test.tsx:327-371`: no `deterministic` or `assistance`; the copy calls the draft advisory and "has not been released". Release stays human-only (`csrm-authorization.ts:34-36`). WR-06 (`8b7ab5c`) gates the action on a submitted questionnaire in presentation only; Strapi's 409 stays the authority. |
| T-08-07-02 | Information disclosure | V4.2.1 | medium | Answers surfacing in the analyst-review state | mitigate | closed | `questionnaire-workflow.test.tsx:341`: no renderer in analyst review. |
| T-08-07-03 | Tampering | V5.1.3 | low | A status outside its vocabulary | mitigate | closed | `status-badge.tsx:74,82,89,96,109` use `satisfies Record<…>` tables, so a vocabulary change fails the typecheck. |
| T-08-07-04 | – (assurance) | – | low | Status by colour alone | mitigate | closed | Icon, text and `data-tone` on every badge; the conformance suites pass in the full runs. |
| T-08-08-01 | – (assurance) | – | low | Hidden columns unreachable by keyboard | mitigate | closed | The region is `tabIndex=0` only while it overflows. `ArrowRight` browser proofs; the unit tests of `horizontal-scroll-region`. |
| T-08-08-02 | – (assurance) | – | low | A purposeless tab stop | mitigate | closed | Semantics keyed on measured overflow, with no-overflow unit and browser cases. |
| T-08-08-03 | Tampering | – | low | Values outside the direction document | mitigate | closed | X-1 to X-3 are recorded in `docs/design/csrm-design-direction.md` before use. |
| T-08-08-04 | Information disclosure | – | low | Full statement leaving the DOM when clamped | accept | closed | R-08-31 |
| T-08-09-01 | Information disclosure | V7.4.1 | medium | A root failure or unmatched URL falling to the framework page | mitigate | closed | `app/global-error.tsx:40-50`, `app/not-found.tsx`, `app/(app)/not-found.tsx`. `route-boundaries.test.ts:101-120`: every boundary is a client component that never reads `error.message`, `digest` or `stack` and never binds `error`. `root-fallbacks.test.tsx:98-107`. Residual R-08-08. |
| T-08-09-02 | Information disclosure | – | low | A printed filtered table reading as unfiltered | mitigate | closed | Chips, result counts and page numbers print. The two analyst review lists are residual R-08-29. |
| T-08-09-03 | – (assurance, 2.5.3) | – | low | Trigger name differing from its label | mitigate | closed | The visible `Menu` text has no `aria-label` (`capability-navigation.tsx:121-132`); "Open navigation" is gone from source and tests. |
| T-08-09-04 | Tampering | – | low | A segment without a boundary | mitigate | closed | `route-boundaries.test.ts:55-99` runs in every web suite. |
| T-08-10-01 | Tampering, information disclosure (XSS) | V14.4.3, V5.3.3 | high | Injected script execution | mitigate | closed | **Policy.** A fresh nonce per request, on both the request and the response (`proxy.ts:19-35`). `content-security-policy.ts:36-57` sets `'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and `frame-ancestors 'none'`, allows `'unsafe-eval'` only under `next dev`, and validates the nonce. **Supporting controls.** The matcher is anchored (SR-05, `proxy.ts:45-55`). Every page renders per request (`layout.tsx`). Zod runs jitless in the browser. **Tests.** Unit: `content-security-policy.test.ts`, `proxy.test.ts:31-113`. Browser: an exact policy and the nonce on every script tag for documents, the 404 and four lookalike URLs (`production-hardening.spec.ts:331`), and zero violations across the sweep (`:532-563`). **Live check.** The dev policy differs from production only by `'unsafe-eval'`. Residuals R-08-05, R-08-07, R-08-08, R-08-09. |
| T-08-10-02 | Tampering | V14.4.7 | medium | Clickjacking, cross-origin window reference | mitigate | closed | `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin` and the Permissions-Policy (`next.config.ts:10-20`), with `frame-ancestors 'none'`. Unit: `security-headers.test.ts:30-64`. Asserted on documents and a static asset of the production build, and observed on the dev server. |
| T-08-10-03 | Information disclosure | V14.4.5 | medium | HSTS ineffective over HTTP; `preload` misuse | mitigate / accept | closed | HSTS is `max-age=63072000; includeSubDomains`, production builds only, never `preload` (`next.config.ts:17-19`; `security-headers.test.ts:37-49`). `upgrade-insecure-requests` is sent only over HTTPS (`content-security-policy.ts:55`). Residuals R-08-06, R-08-04. |
| T-08-10-04 | Information disclosure | V14.3.3 | low | `X-Powered-By: Next.js` | mitigate | closed | `poweredByHeader: false` (`next.config.ts:24`; `security-headers.test.ts:60`). Absent on the dev probe. |
| T-08-10-05 | Information disclosure | V8.3.4, V14.2.2 | high | A server-only value in a client chunk | mitigate | closed | `server-only-boundary.test.ts:60-95` requires `import 'server-only'` first in 17 modules. The client-chunk scan (`production-hardening.spec.ts:611-646`) finds none of sixteen needles, the run's token, nonce and Strapi base URL among them. No `NEXT_PUBLIC_` variable exists. |
| T-08-10-06 | Tampering (CSRF) | V4.2.2 | high | CSRF against Server Actions | mitigate | closed | Next 16.3.6 `action-handler.js:427-467` (read in this audit) compares the `Origin` host with `x-forwarded-host` or `Host` before the action runs. `allowedOrigins` is unset (`next.config.ts:25-29`), and the cookie is `SameSite=Lax`. `production-hardening.spec.ts:648-682` observed:<br>- a foreign fetch action: 500;<br>- a foreign form post: not 303, with no cookie;<br>- the same-origin controls: 404 and 303. Residual R-08-04. |
| T-08-10-07 | Tampering (XSS) | V5.3.3 | high | Unsafe HTML sinks | mitigate | closed | `output-safety.test.ts:51-102` covers 230 modules and has a self-check. The sink sweep re-run here finds none. |
| T-08-11-01 | Information disclosure | V4.2.1 | high | Another Requestor's records by URL | mitigate | closed | `assessment-navigation-lifecycle.spec.ts:150-241` runs at 1440 and 375 in both projects:<br>- Jane's request renders the permission state;<br>- her questionnaire renders its own permission copy;<br>- her assessment renders the in-shell not-found (Strapi 404).<br>In each case no owner fact and no record identifier is in the page text (`:31-46`). The server half is T-08-05-01. Residual R-08-15. |
| T-08-11-02 | Tampering | – | low | Journeys colliding across projects | mitigate | closed | CSV names carry a project suffix. One-shot journeys run desktop only. `workers: 1` and `fullyParallel: false` (`playwright.config.ts`). |
| T-08-11-03 | Tampering | V14.4.3 | medium | A CSP regression surfacing only in a journey | mitigate | closed | The collector (`e2e/helpers/csp.ts`) is attached on every journey page and matches both Chromium wordings. 08-11 recorded a negative control. |
| T-08-11-04 | Repudiation | – | low | A sign-in that never left `/sign-in` passing as success | mitigate | closed | All seven sign-in helpers assert the Dashboard heading and the banner role (`e2e/helpers/navigation.ts:12-19` and the six local ones, `production-hardening.spec.ts:178-184` among them). The grep for `toHaveURL(/\/app$/)`, re-run here, finds nothing. See observation O-2, closed by `91f8fe5`: a unit scan now keeps this true (re-audit). |
| T-08-12-01 | – (assurance) | – | low | Criteria axe cannot decide | mitigate | closed | `docs/accessibility/phase-08-wcag22-conformance.md` and the sweep. |
| T-08-12-02 | Information disclosure | V4.1.1 | medium | A denial rendering data before its permission state | mitigate | closed | `accessibility.spec.ts:198-208` requires the shared permission state, one alert, the area heading, no record link and no error state. It runs for both Requestor identities (`:365-368,443-482`). |
| T-08-12-03 | Tampering | – | low | The keyboard proof submitting a request | mitigate | closed | The confirmation is cancelled with Escape and the page reloaded (`accessibility.spec.ts:555-583`). |
| T-08-13-01 | – (assurance) | – | low | Cache hits reported as zero bytes | mitigate | closed | CDP `Network.setCacheDisabled` and the `PERFORMANCE_ACCOUNTING_INCOMPLETE` self-checks (`performance.spec.ts:232-271`). |
| T-08-13-02 | Information disclosure | V8.3.4 | low | Records carrying environment values | mitigate | closed | A grep of the phase records finds no token, secret or home path. |
| T-08-13-03 | Tampering | – | low | Analyzer output entering a commit | mitigate | closed | `.next/` and `apps/web/.tmp/` are ignored (`.gitignore:5,18`), and the tree is clean. |
| T-08-13-04 | Repudiation | – | low | A budget loosened without trace | mitigate | closed | `PERFORMANCE_BUDGETS` is unchanged (`performance.spec.ts:55`). The one override carries its reason (`:74`). |
| T-08-14-01 | Repudiation | – | low | A pass recorded without its output | mitigate | closed | The 08-14 summary quotes every command's counts, and the review-fix report does likewise. |
| T-08-14-02 | Tampering | – | medium | Run artefacts entering a commit | mitigate | closed | Staging is explicit and the tree is clean. SR-09 removes a passing run's database and builds by exact name (`e2e-run-artifacts.ts`), never by pattern. |
| T-08-14-03 | Elevation of privilege | – | medium | Keycloak slipping in under the deferral | mitigate | closed | No added line in `apps/`, `package.json` or `pnpm-workspace.yaml` mentions Keycloak. The only mentions are the two pre-phase comments at `apps/strapi/src/index.ts:13,18` (`4e2f1e8`). |
| T-08-14-04 | Tampering | – | medium | Schema drift | mitigate | closed | Empty over the range with the matching pathspec, and shown able to fail (Scope and Method). The pathspec 08-14 first planned matched nothing; its summary records this as deviation 1. |
| T-08-14-05 | Elevation of privilege, denial of service | V14.2.1 | high | An advisory landing after 08-01 | mitigate | closed | Re-run here: the same fifteen ids, 0 critical. The same again in the re-audit, on `8035357`. |
| **T-08-A1** | Spoofing, tampering, repudiation | V5.1.2, V4.2.1 | medium | Analyst-branch create of an assessment request writes the body as given (audit-registered) | mitigate | closed (verified by the re-audit) | **At audit:** open, at `csrm-assessment-request.ts:147`. See "Decision: ownership of a request created on the analyst branch".<br>**Fix:** `1379bf7`; RED `4529705`. Every actor's create goes through `prepareRequestorCreate` (`csrm-assessment-request.ts:135-160`; `request-workflow.ts:133-155`), which:<br>- makes the caller the owner;<br>- writes the published create fields only;<br>- sets `draft` and no submitted date;<br>- refuses a missing or non-string identity with the safe 400.<br>`request-ownership.ts` is deleted.<br>**Proofs, for the analyst and the service agent:**<br>- `authorization.integration.test.ts:562`: a forged owner, status, dates, sponsor, reversal facts and links persist the caller as the owner and none of the forged facts; the named Requestor neither lists nor reads the request (403);<br>- `:607`: the caller's own request is in the caller's My Requests and counted as a draft;<br>- `authorization-policy.unit.test.ts:292,317` prove the preparation and its refusal, replacing the dead-helper cases.<br>**RED on the old code:** `T08A1_OWNER_IS_NOT_THE_CREATOR_ANALYST` (the forged owner was persisted), `T08A1_OWN_REQUEST_NOT_IN_MY_REQUESTS_ANALYST`, and the unit refusal's "Missing expected exception". Residual R-08-40 (closed).<br>**Re-audit:** verified. Every create goes through the one preparation, and nothing outside the request router writes a request from a body. The tests can fail as recorded, and a scratch probe of the preparation passes. See § Security Audit 2026-09-26 (re-audit). |
| **T-08-A2** | Information disclosure, tampering, elevation of privilege | V5.1.2, V4.2.1, V4.1.3 | high | Analyst-branch update writes `requestor` and every other field as given, which moves record ownership (audit-registered) | mitigate | closed (verified by the re-audit) | **At audit:** open, at `csrm-assessment-request.ts:173`.<br>**Fix:** `197965e`; RED `a43ec4c`. The analyst branch writes `prepareAnalystUpdate` (`request-workflow.ts:177-198`; `csrm-assessment-request.ts:177`): the thirteen Requestor fields, plus the submission intent under the Requestor's own transition rule (a draft only, dated by the server). The owner, number, sponsor, submitted date, reversal facts and links are never taken from a body. The analyst's reach over any request is unchanged.<br>**Proofs, for the analyst and the service agent:**<br>- `authorization.integration.test.ts:629`: a forged `requestor` on the owner's approved request leaves the owner in place; the other Requestor is still refused the request (403), its released questionnaire (403) and its released assessment (404), while the owner keeps all three;<br>- `:688`: forged server-owned facts are ignored; `approved` and `risk-assessment-drafted` are refused (400) with nothing written; the caller's draft is submitted once, dated by the server, and a second submission is refused.<br>**RED on the old code:** `T08A2_OWNER_MOVED_ANALYST` and `T08A2_REQUESTOR_WRITTEN_ANALYST`.<br>**Setup changes:** two tests used the old branch as a fixture shortcut. With the fix they failed (`UNEXPECTED_QUESTIONNAIRE_GUARD_STATUS`, `ASSESSMENT_QUEUE_FIXTURE_TRANSITION_FAILED`), so they now build those fixtures as the server's workflows do. Residual R-08-41 (closed).<br>**Re-audit:** verified. The questionnaire-link shortcut also answers this audit's open question: the old branch could attach a questionnaire through the request's inverse side. See § Security Audit 2026-09-26 (re-audit). |
| T-08-A3 | Information disclosure, elevation of privilege | V14.5.3 | medium | `strapi::cors` echoes any origin with credentials, and the admin panel's refresh endpoint answers a token (audit-registered) | mitigate / accept (was accept) | closed (verified by the re-audit) | **Mitigated by `eb7e72d`.** `strapi::cors` grants only the exact origins in `CSRM_CORS_ALLOWED_ORIGINS`, empty by default (`config/middlewares.ts:10-19`). An entry that is not an exact http or https origin stops the boot (`cors-allowed-origins.ts:24-41`).<br>**Proofs:**<br>- `http-hardening.integration.test.ts:135`: a foreign origin gets no `Access-Control-Allow-*` header on an `/api` read, on `POST /admin/access-token` or on either preflight;<br>- `:160`: the admin panel's same-origin requests answer as before;<br>- `cors-allowlist.integration.test.ts:32,48`: a listed origin is granted, and no lookalike is.<br>**RED on the old configuration:** `CORS_GRANTED_CONTENT_API_access-control-allow-origin: https://untrusted.example`.<br>**Accepted residual:** an origin the operator lists (R-08-11, corrected).<br>**Re-audit:** verified in the framework source, the tests and a live probe. The running dev Strapi granted no foreign origin on an `/api` read, on either preflight or on an admin read, not even the web's origin. The new disposition holds. See § Security Audit 2026-09-26 (re-audit). |
| T-08-A4 | Information disclosure | V14.3 | high | Secrets or attribution in the phase's commits (audit-registered) | mitigate | closed | No `.env*` file in the range, no `CSRM_AI_*` change, no token pattern in any added line, and no attribution in commits. The literals `csrm-playwright-development-only` and `authorization-test-*` are harness-only values, as in earlier phases. **Re-audit over `d11f469..8035357`:** the one `.env*` file is `apps/strapi/.env.example`, which adds `CSRM_CORS_ALLOWED_ORIGINS=` with no value. The other sweeps find nothing. |
| T-08-A5 | Spoofing (open redirect) | V5.1.5 | medium | The sign-in return path (review SR-08; pre-existing) (audit-registered) | mitigate | closed | `return-to.ts:9-28` refuses control characters and backslashes, literal or encoded, and a second slash. It requires a same-origin parse and returns the serialised path. `return-to.test.ts` has 23 hostile cases and asserts that every result resolves to the web origin. This audit's twenty extra probes, `/.%2e//…`, `/%2e%2e//…`, full-width solidus and ideographic space among them, all stayed same-origin. Fixed by `856319c` and `0d260a8`. |

*Status: open · closed. Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party).*

### Research inputs to plan threats

| Research ID | Plan threats | Research ID | Plan threats |
|---|---|---|---|
| T-08-R01 | T-08-03-01, T-08-14-03 | T-08-R11 | T-08-10-05 |
| T-08-R02 | T-08-02-01 | T-08-R12 | T-08-05-01, T-08-05-02, T-08-06-02, T-08-11-01 (T-08-A1 and T-08-A2 extend it) |
| T-08-R03 | T-08-02-02 | T-08-R13 | T-08-10-06 |
| T-08-R04 | T-08-02-03 | T-08-R14 | T-08-03-02, T-08-05-06 |
| T-08-R05 | T-08-10-01, T-08-11-03 | T-08-R15 | T-08-03-03 |
| T-08-R06 | T-08-10-02, T-08-05-08 | T-08-R16 | T-08-01-01, T-08-01-02, T-08-14-05 |
| T-08-R07 | T-08-10-03 | T-08-R17 | T-08-04-01 |
| T-08-R08 | T-08-05-04, T-08-10-04 | T-08-R18 | T-08-03-04, T-08-04-02, T-08-10-07 |
| T-08-R09 | T-08-02-04, T-08-05-03, T-08-09-01 | T-08-R19 | T-08-02-05 |
| T-08-R10 | T-08-05-05 | T-08-R20 | T-08-08-01, T-08-09-03, T-08-12-01, T-08-13-01 |

## Decision: ownership of a request created on the analyst branch

**The question.** It comes from the SR-02 fix. When a Security Analyst or the analyst service agent creates an assessment request, the body's `requestor` is written as given. Only the Requestor path derives ownership from the caller.

**The code.**
- **Actor.** `POST /api/csrm-assessment-requests` takes the analyst branch whenever the caller holds the operation through an analyst-named role (`csrm-authorization.ts:10-13,148-152,264-275`). Both the human Security Analyst and the Security Analyst Agent do: through `function.risk_assessment_requests.core_api`, an API-only Function that bundles create, list, read and update "for the four non-delete served assessment-request REST routes".
- **Create.** The Requestor branch builds `prepareRequestorCreate(input, caller, number)`. That keeps the thirteen writable fields, sets `requestor` to the caller and `requestStatus` to `draft`, and clears `submittedDate` (`request-workflow.ts:3-17,124-145`). The analyst branch writes `{ ...input, requestNumber }` (`csrm-assessment-request.ts:147`) through the Document Service. No input sanitisation runs there.
- **Update.** It has the same shape: `{ ...input, requestNumber: persisted.requestNumber }` (`:173`). The policy lets an analyst actor reach any request id (`csrm-authorization.ts:399-401`).

**Is an analyst or the service agent meant to create requests on another person's behalf? No.**

1. **Brief.** Creating a request is a Requestor capability (§3). The analyst's navigation has "Requests" and "Request Details" but no "New Request" (§4). The workflow starts "Requestor → Creates Risk Assessment Request" (§5). Requestor is a birthright role (§18), so an analyst who creates a request does so as a Requestor.
2. **Catalogue.** The source catalogue's create operation is `POST:/api/v1/assessment_requests`, in `function.risk_assessment_requests.new_request` ("Risk Assessment Requests:New Request"), granted to `role.requestor` only. The served-operations inventory records that alias as "served by the core route POST /api/csrm-assessment-requests". The analyst and the agent reach the core route only through the bundled `core_api` Function. No Function grants on-behalf creation.
3. **Contract.** `docs/references/specification.json:3939-4033` declares the create body `data` closed (`additionalProperties: false`), with the thirteen Requestor fields and no `requestor`. The update body (`:4758-4856`) adds only `requestStatus`. No caller can name an owner through the published contract.
4. **JDL.** `CsrmAssessmentRequest{requestor}`, `{sponsor}` and `{revertedBy}` point to `IdamBoxUser`. No fact records who created a request for someone else, so an on-behalf create could not be attributed (brief §22, audit trail).
5. **History.** Phase 1 `386e1f3` ("bind assessment requests to trusted ownership") overwrote `requestor` with the caller for every actor. Phase 2 `97a2f9e` split the branches: its plan says only "keep analyst behavior distinct", and its verification truth 10 ("Strapi creates owner-bound drafts") was proven on the Requestor path alone. No decision anywhere records on-behalf creation.
6. **Web.** The analyst holds `assessment-request:create` (`development-capabilities.ts:8`) and is offered "New request" (`navigation.ts:59`). The web never sends a `requestor`: its editable fields are stripped to the thirteen (`request-schema.ts`). So today an analyst's own New Request is stored with no requestor. It is absent from the analyst's My Requests and owned by nobody. Once "submitted" through the analyst branch, it also has no submitted date. This is a live defect of the same branch.

**Can any actor create a request owned by a Requestor who never asked for it?**
- **Requestors: no.** Ownership is derived from the caller (`authorization.integration.test.ts:374-392`; the SR-02 proof at `:480-496`).
- **The human analyst and the service agent: yes.** The body's `requestor` is written as given, and so is every other attribute: `requestStatus` (any of the seven values), `submittedDate`, `sponsor`, the server-owned reversal facts (`revertReason`, `revertedAt`, `revertedBy`) and the one-to-one `questionnaire` and `assessment` relations. Whether the Document Service honours the inverse side of those relations was not exercised in this audit.

**What that enables.**
- **For the named Requestor.** The request appears in her My Requests and in her dashboard counts. She can open, edit and submit it as hers, because every ownership check keys on `requestor`.
- **Downstream.** Created in a later status, it enters the analyst queue under her name, and a questionnaire generated from it is addressed to her. Nothing records who created it.
- **Through the update branch.** The same unbounded branch lets the service agent or an analyst move an existing request to another Requestor. The new owner then passes:
  - the request check (`csrm-authorization.ts:403-410`);
  - the questionnaire check, which exposes the original owner's answers (`:360-378`);
  - the released-assessment scope (`assessment-scope.ts:159-189`).

  A human analyst released that assessment to one Requestor. The automation identity can make it readable by another, with no human act. That is T-08-A2.

**The suite asserts the opposite.** `authorization-policy.unit.test.ts:282-310` ("Strapi overwrites a forged Requestor relation with trusted server identity") exercises `request-ownership.ts:21-34`. No source module has called that helper since `97a2f9e`. Phase 8's port of the old policy test made the case run, so the suite now asserts a property that the served create lacks for two of the three roles that hold it.

**Classification: not intended; a threat to mitigate now.**
- T-08-A1 is the create half. It is medium: spoofing, repudiation and forged server-owned facts, plus the orphaned analyst draft.
- T-08-A2 is the update half. It is high: cross-Requestor disclosure of sensitive risk information, reachable by the automation identity.

**Exposure today.** While INT-02 is deferred, no production identity path exists, so both halves are reachable only where the development identity bridge runs: `next dev`, the attested E2E runtime, and a development-mode Strapi. They would ship into INT-02 unchanged, since the controller does not depend on how the identity was resolved.

It is not an acceptable residual, for three reasons:
- the fix changes no schema, contract or catalogue;
- accepting it would leave the published contract violated server-side (ASVS V5.1.2, level 1) and the analyst's own New Request broken;
- the service agent would keep an ownership-transfer power that no grant describes.

**The fix, precisely** (`apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts`):
1. **Create (`:139-149`).**
   - Require `identityDocumentId` for every actor, not only the Requestor.
   - Build the data with `prepareRequestorCreate(input, identityDocumentId, requestNumber)` for every actor. The creator becomes the owner, the closed create contract is the only writable surface, the status is `draft` and `submittedDate` is null.
2. **Update (`:171-173`).**
   - Replace `{ ...input, requestNumber: persisted.requestNumber }` with the published update body: `requestorWritableData(input)`, plus `requestStatus` when present and in the enum.
   - Never write `requestor`, `requestNumber`, `sponsor`, `submittedDate`, `revertReason`, `revertedAt`, `revertedBy`, `questionnaire` or `assessment` from a body.
3. **Tests.**
   - **Create, mounted, in `authorization.integration.test.ts` or `request-workflow.integration.test.ts`.** The analyst and the service agent each post a body that names `requestor: <owner>`, `requestStatus: "submitted"`, `submittedDate`, `sponsor` and `revertedBy`. Assert:
     - the persisted `requestor` is the caller, the status is `draft`, and the rest are null;
     - the owner's `GET /api/csrm-assessment-requests` does not list it, and the caller's does.
   - **Update, mounted.** The analyst and the service agent each `PUT` `requestor: <other>` onto the owner's request. Assert:
     - the `requestor` is unchanged;
     - the other Requestor is still refused the request and its questionnaire (403), and the released assessment (404).
   - **The dead helper.** Delete `request-ownership.ts` and its two cases at `authorization-policy.unit.test.ts:282-310`, or rebind those cases to the live create path.
   - **Run.** The full Strapi suite, with the dev servers stopped.

**If on-behalf creation is ever wanted,** it needs three things:
- a declared, human-only operation with a `requestor` field in the contract;
- a datamodel fact recording the creator, which is a schema change and so frozen in this milestone (a contract-gap record);
- its own matrix row.

**Resolution (2026-09-26).** The orchestrator recorded the decision: Requestor is every user's birthright, so a request is always owned by the identity that creates it, whichever role the caller also holds. No actor may create a request for someone else or move a request to another owner, and server-owned facts are never taken from a request body. The fix was implemented as specified above, with four refinements:
1. **The identity check lives in the create preparation.** `prepareRequestorCreate` itself refuses a missing identity, so the one create path owns both the owner binding and the fail-closed check. The controller calls it for every actor, and the error and status are unchanged.
2. **The update keeps the analyst's reach.** The analyst branch may still amend the thirteen published fields of any request, past draft included, as before. The fix bounds what it writes, not which requests it reaches.
3. **"In the enum" means the published enum, and only from draft.** A `requestStatus` in the body goes through the Requestor's own transition rule: only on a draft, only `draft` (no change) or `submitted`, dated by the server. The published update body's enum is `submitted` only. A status outside it is refused (400) with nothing written, which also refuses a backward move that would bypass the revert route's guards.
4. **Unknown and server-owned fields are ignored, not refused.** The update body's closed schema leaves them out of the operation, and the Requestor branch has ignored them since Phase 2. Refusing them on one branch only would make the two actors answer the same body differently.

No spec, catalogue or schema change was needed. `pnpm --prefix apps/web api:check` stayed clean.

## Open Threats

None. The audit listed T-08-A1 and T-08-A2 here. Both were remediated on 2026-09-26; see their register rows for the fix commits, the proving tests and the RED evidence.

The re-audit of 2026-09-26 verified both rows and T-08-A3's new disposition at `8035357`, and `status` is `verified` (§ Security Audit 2026-09-26 (re-audit)).

## Decisions the phase routed to this record

- **D-39: Strapi security middleware.**
  - `strapi::security` keeps its helmet defaults, each one tabled with its reason in `docs/security/strapi-http-hardening.md`, the Strapi section of this record.
  - `strapi::poweredBy` is removed.
  - As R-08-10's named owner, this audit accepts the defaults for this milestone:
    - API responses are JSON, sent with `nosniff`;
    - no browser calls the content API;
    - the admin panel is out of scope;
    - every default is asserted on a 200, a 403 and a 500, so any change is deliberate.
- **D-42: TLS assumption.**
  - Production assumes a TLS-terminating reverse proxy that:
    - sets `x-forwarded-proto`, which drives `upgrade-insecure-requests` and the cookie's `Secure` flag;
    - keeps the public host in `Host` or `x-forwarded-host`, for the Server Action origin check.
  - HSTS is sent without `preload`.
  - Behind a host-rewriting proxy, `serverActions.allowedOrigins` must name the public origin only. It is unset today (R-08-04, R-08-06).
- **D-47: session cookie.** `Secure` is keyed on the first forwarded protocol. The plain-HTTP E2E origin is residual R-08-03.
- **D-48: Server Action origin check.** Confirmed in the installed source and asserted with a positive control (T-08-10-06).

## Unregistered Flags

None. Every `## Threat Flags` entry maps to a register row:
- the 08-02 cookie trust assumption → R-08-03 and R-08-04;
- the 08-03 residual plugin surface → the 37 plugin matrix rows and R-08-02;
- the 08-04 wrapper blind spot → R-08-18.

The five audit-registered rows (T-08-A1 to T-08-A5) come from this audit's reading and from the review, not from an unmapped summary flag.

## Accepted Risks Log

Each row states the acceptance and this audit's check of its recorded facts against the code. Detail lives in `docs/security/phase-08-residual-risks.md`. The plan-level acceptances each map to a register row:

| Plan threat | Register row |
|---|---|
| T-08-01-02 | R-08-21 |
| T-08-03-02 (login and `me`), T-08-05-06 | R-08-01 |
| T-08-04-03 | R-08-20 |
| T-08-05-08 | R-08-10 |
| T-08-08-04 | R-08-31 |
| T-08-A3 (the operator's allowlist) | R-08-11 |
| O-4 | R-08-42 |

| Risk ID | Threat Ref | Rationale | Accepted By | Date | Audit check |
|---------|------------|-----------|-------------|------|-------------|
| R-08-01 | T-08-03-02, T-08-05-06 | Users & Permissions `auth/local` and `users/me` stay mounted. No account exists, and registration is off at every boot. | INT-02 (operator decision) | 2026-09-26 | Facts match. Matrix rows `:351-420`: `auth/local` 400 for everyone; `me` 401 with the token and 403 without; `register` 400 with the count unchanged. |
| R-08-02 | T-08-05-06 (08-03 flag) | The full-access token reaches the plugin account, role, email, upload, i18n and content-type-builder routes. The token never leaves the web server. | INT-02 (operator decision) | 2026-09-26 | Facts match (matrix rows `:288-615`). A web-server compromise yields this surface. That is the recorded trigger (a scoped token). |
| R-08-03 | T-08-02-03 | The dev cookie is not `Secure` on the HTTP E2E origin. | INT-02 (operator decision) | 2026-09-26 | Facts match since SR-01; this audit verified the corrected control. |
| R-08-04 | T-08-10-06, T-08-10-03 | A TLS-terminating proxy is assumed; `allowedOrigins` is unset. | Deployment (operator decision) | 2026-09-26 | Facts match: Next source and `next.config.ts`. |
| R-08-05 | T-08-10-01 | `style-src 'unsafe-inline'`, needed by sonner and Radix. | Later UI dependency work | 2026-09-26 | Facts match. `img-src`, `font-src` and `connect-src` admit no foreign origin. |
| R-08-06 | T-08-10-03 | HSTS cannot be verified over HTTP; no `preload`. | Operator decision (deployment) | 2026-09-26 | Facts match. Web `63072000` in production builds; Strapi `31536000`, seen on the live dev Strapi. |
| R-08-07 | T-08-10-01 | No CSP `report-to`. | Operator decision (monitoring) | 2026-09-26 | Facts match. |
| R-08-08 | T-08-09-01, T-08-10-01 | The static `/_global-error` copy has no nonce. | Phase 8 code review | 2026-09-26 | Not re-observed (no build here); consistent with the recorded build output. |
| R-08-09 | T-08-10-01 | Every page is rendered per request. | Phase 8 code review | 2026-09-26 | Facts match: `layout.tsx`; `proxy.test.ts:113`. |
| R-08-10 | T-08-05-08 | `strapi::security` stays at helmet defaults. | This audit (the named owner) | 2026-09-26 | Facts match: the live dev preflight headers and `http-hardening.integration.test.ts:86-111`. |
| R-08-11 | T-08-A3 | At audit: `strapi::cors` echoed any origin with credentials. Since `eb7e72d` no origin is granted by default; the residual is an origin the operator lists. | Operator decision (the production origin list) | 2026-09-26 | **At audit, the facts were incomplete** (see "Corrections to recorded facts"). **Remediated:** the register row now records the admin access-token vector, the deny-by-default configuration and its proofs. **Re-audit:** facts match the configuration, the framework source and a live probe. |
| R-08-12 | T-08-05-05 | The AI transcript diagnostic logs prompts when enabled. | Operator decision | 2026-09-26 | Facts match: `config/ai.ts:9` defaults to `false`. |
| R-08-13 | T-08-05-05 | `strapi::logger` writes query strings. | Operator decision (log retention) | 2026-09-26 | Facts match. |
| R-08-14 | – | "Destination stream closed early" server log noise. | Phase 8 code review | 2026-09-26 | Kind matches. At audit the count was stale: 44 and 52 per run in the review-fix runs, against the recorded 8 to 33. Corrected in the register. **Re-audit:** the register now also records 53 and 52 from the UI review resolution's two full runs. |
| R-08-15 | T-08-11-01 | A streamed `notFound()` answers 200. | Phase 8 code review | 2026-09-26 | Facts match. No existence oracle: a Requestor gets 403 for another Requestor's request or questionnaire and for a missing one, and 404 for another's assessment and for a missing one. |
| R-08-17 | T-08-04-02 | 33 grandfathered parsers. | Phase 8 VERIFICATION backlog | 2026-09-26 | Facts match: count asserted at `contract-response-parity.test.ts:469`. **Re-audit:** 43 since the G1 closure, asserted at `:591`. The ten added parsers' bounds predate Phase 8, and each is grandfathered with its reason. |
| R-08-18 | T-08-04-02 | Ten root-reporting parsers. | Phase 8 VERIFICATION backlog | 2026-09-26 | Facts match: ten `narrowedPaths: ['data']` registrations. **Re-audit:** closed by the G1 closure (`0a98c21`, `390247e`, `4eb9ffd`, `de40347`). There were nine wrapper parsers, not ten. The guard now reads the closed schemas the services parse with (see T-08-04-02). **After the re-audit:** the G2 closure (`fc6a791`, `f3dc30f`) extends the closure inside each answer envelope, and the register row says so. |
| R-08-19 | T-08-03-03 | Twelve plugin operations are documented at unmounted paths; `/roles` is attributed to users-permissions. | Contract owner | 2026-09-26 | Facts match: 10 plugin-prefix entries plus `PUT` and `DELETE /roles/{role}`. |
| R-08-20 | T-08-04-03 | Nine identifier bounds rest on server guarantees. | Contract owner | 2026-09-26 | Facts match: `a36569d` adds exactly nine bounds. |
| R-08-21 | T-08-01-02 | `vite` high, pinned by `@strapi/strapi`. | Next `@strapi/*` upgrade | 2026-09-26 | Facts match: the audit re-run. |
| R-08-22 | T-08-01-01 | Six moderate advisories pinned by Strapi's majors. | Next `@strapi/*` upgrade | 2026-09-26 | Facts match. |
| R-08-23 | T-08-01-01 | Seven moderate and one low advisory, each with an in-major patch. | Next dependency pass | 2026-09-26 | Facts match. |
| R-08-24 | – | Builds depend on reaching Google Fonts. | Operator decision (ADR 0001) | 2026-09-26 | Not re-observed. No runtime exposure: `font-src 'self'`. |
| R-08-26 to R-08-30 | – | Sign-in title, exposure link wording, 3.3.8 scope, analyst-list print chips, print headroom. | Phase 8 UI review | 2026-09-26 | Outside security acceptance. R-08-29 (a printed queue does not say which filter it shows) has no disclosure effect. |
| R-08-31 | T-08-08-04 | The statement clamp is visual only. | 08-08 threat model | 2026-09-26 | Facts match. |
| R-08-32 to R-08-35 | – | Zod reaching some routes; prefetch bandwidth; budget headroom; the questionnaire override. | Phase 8 code review | 2026-09-26 | No security effect. |
| R-08-36 | AR-07-03 | Job registries live in one process's memory. | Orchestrator (a later phase) | 2026-09-26 | Facts match. |
| R-08-37 | AR-07-05 | No PostgreSQL run. | Orchestrator; operator for the production database | 2026-09-26 | Facts match: `pg` is absent, and `config/database.ts` accepts `postgres`. |
| R-08-38 | AR-07-10 | Error bodies carry `data: null`. | Contract owner | 2026-09-26 | Facts match: `errors.js` formats `data: null`. |
| R-08-39 | T-08-01-01 | The `sharp` override crosses `@strapi/upload`'s exact pin. | Next `@strapi/*` upgrade | 2026-09-26 | Facts match: the plugin declares `0.34.5`, and its link resolves `0.35.4`. |
| R-08-42 | O-4 | The analyst service agent still holds request create, update and delete that no product path uses. Since T-08-A1 and T-08-A2 it cannot own someone else's request, move an owner or write a server-owned fact. | Phase 9 (least-privilege catalogue decision) | 2026-09-26 | Recorded by the remediation; no grant changed. The catalogue gives `core_api` and `delete_api` to `role.security_analyst_agent`, and the matrix states the agent's outcome on every request route. **Re-audit:** facts match the catalogue. `core_api` (list, create, read and update on `/api/csrm-assessment-requests`) and `delete_api` include the agent's role. `revert_to_draft_api` does not. |

- **Closed rows.**
  - R-08-16 was closed by WR-05 (`c2a30a1`), and R-08-25 by WR-01 (`d93b9f8`).
  - R-08-40 (T-08-A1) and R-08-41 (T-08-A2) were registered and closed by the remediation (`1379bf7`, `197965e`).
  - R-08-18 was closed by the phase verification's G1 closure, after this audit.
  - The re-audit verified all three closures.
- **Carried from Phase 7.** AR-07-06 to AR-07-09 remain accepted and untouched. AR-07-11, AR-07-12 and AR-07-13 were closed by Phase 8, each verified: the ported policy test runs, IN-03 is resolved by contract, and the production build is under test.

*Accepted risks do not resurface in future audit runs.*

## Corrections to recorded facts

These files were not the audit's to edit. The remediation made each correction on 2026-09-26, in `phase-08-residual-risks.md` and `strapi-http-hardening.md`:
- item 1: R-08-11 now records the admin access-token vector, and CORS denies by default (`eb7e72d`);
- item 2: R-08-14 now carries the 44-to-52 count;
- item 3: the dead-helper cases are rebound to the live create path (`4529705`, `1379bf7`).

The re-audit found all three in place at `8035357`.

The text below is the audit's finding as written.

1. **R-08-11** in `docs/security/phase-08-residual-risks.md`, and the CORS section of `docs/security/strapi-http-hardening.md` ("It is not exploitable for CSRM today").
   - **What the reasoning covers.** It holds for the CSRM content API.
   - **What it omits.** The same CORS policy governs the admin panel:
     - `POST /admin/access-token` has `auth: false` and answers a fresh admin access token in its JSON body, authenticated only by the `strapi_admin_refresh` cookie;
     - that cookie is `httpOnly` and `SameSite=Lax` by default (`@strapi/admin` 5.51.0 `shared/utils/session-auth.js:43`; `config/admin.ts` sets no cookie option);
     - a read-only preflight to `/admin/access-token` on the running dev Strapi echoed `http://localhost:4000` and `https://evil.example` with `Access-Control-Allow-Credentials: true`.
   - **Consequence.** A cross-site page is stopped by `SameSite=Lax`. A same-site page is not: any other `localhost` port in development, or a sibling subdomain in production. Such a page can read an admin access token from a browser signed in to the admin panel (V14.5.3).
   - **Why acceptance still holds for this milestone.** No deployment exists, and the admin panel is out of scope (D-39).
   - **The remedy.** Restrict `strapi::cors` `origin` in `config/middlewares.ts`. Nothing in CSRM needs CORS: browsers never call the content API, and the admin panel is same-origin. The fix is configuration only and cheap to make now.
   - **Revisit trigger.** Before any shared or production deployment. Sooner if developers run untrusted local web content beside a signed-in admin panel.
2. **R-08-14.** The observed noise is now 44 to 52 lines per full run.
3. **After T-08-A1 and T-08-A2 are fixed.** Remove or rebind the dead-helper cases (`authorization-policy.unit.test.ts:282-310`). Phase 2's verification truth 10 held for the Requestor path only.

## Review Findings: Security Reading

| Finding | Commits | Security reading |
|---|---|---|
| SR-01 (critical): a production build started with `NODE_ENV=development` offered the development sign-in | `fa4bc5b`, `151a443` | Closed. The resolver is keyed on the compiled `NODE_ENV`. Seven unit cases were RED before the fix, and the browser proof was RED with 3 buttons and GREEN after. Verified here (T-08-02-01). |
| SR-02: the matrix asserted successes it never observed | `8e260c6` | Closed for provenance: each allowed actor is cited per actor, and the citation must send a request as that actor. The fixer's note on the analyst create is decided above (T-08-A1). |
| SR-03: chain guards blind outside `*-service.ts` | `1005bd9` | Closed. Residual blind spot: O-1. |
| SR-04: focus helper passing on a resting shadow | `e482a5c` | Accessibility evidence only. |
| SR-05: unanchored proxy matcher left some documents without CSP | `52ec2c2`, `c226881` | Closed. The four lookalike URLs are in the unit and browser proofs. |
| SR-06: the `sharp` override crosses its pin | `117741f` | Recorded as R-08-39. `vitest` and `turbo` pinned exactly. |
| SR-07: switches silencing the matrix and inventory | `4e7423f` | Closed. Refused by the everyday script and under CI; an observing run fails on a mismatch. |
| SR-08: open redirect in the sign-in return path | `856319c`, `0d260a8` | Closed (T-08-A5). |
| SR-09, SR-10: run artefacts; ephemeral ports | `d43f576`, `d97858d` | Hygiene. Cleanup names exact paths only. |
| WR-01 to WR-11 | `d93b9f8` … `3251a0c` | UI and test fixes. None moves an authorisation control. WR-05's `recordRouteMetadata` reuses the page's own authorised read and titles by page, never by record (`record-route-metadata.ts:17-23`). |

## Observations (informational, non-blocking)

- **O-1: chain-guard pattern.** Closed by `e4b7d2d`; verified in the re-audit.
  - As found: `METHOD_CALL` in `contract-operation-chain.test.ts:31` needs `(` straight after the method. A generic-typed call (`client.GET<…>(`) or a space before `(` would escape the guard; none exists today. Widen the pattern to `\.(GET|POST|PUT|PATCH|DELETE)\s*(?:<[^>]*>)?\s*\(` in both scans.
- **O-2: the T-08-11-04 grep.** Closed by `91f8fe5`; verified in the re-audit.
  - As found: it is a point-in-time command, not a test. A unit scan of `e2e/**` for a URL-only sign-in assertion, in the style of `output-safety.test.ts`, would keep it true.
- **O-3: `nodemailer` override.** Closed by `1e7bdf6`; verified in the re-audit.
  - As found: it stays a caret range (`pnpm-workspace.yaml:14`) while the other overrides are exact. The lockfile resolves 9.1.1. Pin it exactly for consistency.
- **O-4: service-agent request grants (least privilege, V4.1.3).** Accepted as R-08-42 (Phase 9), with no grant change. The re-audit checked its facts against the catalogue.
  - As found: once T-08-A1 and T-08-A2 are fixed, the service agent still holds request create, update and delete through `core_api` and `delete_api`, and no product path uses them. Whether the automation identity needs them is a catalogue decision for Phase 9 (human-supervised agentic workflows), not a Phase 8 blocker.
- **O-5: the analyst's reach after the fixes (re-audit; informational).** Two consequences follow from the recorded decision (Resolution, refinements 2 and 3). Neither moves an owner or discloses another Requestor's record.
  - **Self-review.** An analyst's own New Request is now theirs. The same person can answer its questionnaire as its Requestor and release its assessment as its analyst. The brief and the records state no separation-of-duties rule.
  - **Submitting a draft.** The analyst branch can submit any Requestor's draft, dated by the server. Before the fix it could set any status. R-08-42 records the same power for the service agent.

  Both are product decisions, for Phase 9 alongside R-08-42. Neither is a Phase 8 threat.

  **Phase 13 disposition (2026-10-01).** Both consequences are settled; O-5 is closed.
  - **Self-review** is settled by G-1, the first-line and second-line separation of duties. Through Phase 13's `OWN_REQUEST` rules (D-07), an analyst who raised a request cannot pick it up, be assigned it, or mark its notes as changing the AI inputs. Phase 17.1's review, approval and release rules complete the separation for the assessment.
  - **Submitting another person's draft** is closed by least privilege (D-20, plan 13-06): the analyst branch of the request update refuses a submission of a request the analyst did not raise with 403 and the closed reason `NOT_REQUEST_REQUESTOR`, writing nothing (`prepareAnalystUpdate`, decided against the resolved IdamBox User). An analyst may still amend another person's draft, and the first line alone attests its own request. R-08-42 had already withdrawn the same power from the service agent (Phase 12, D-33).
  - **Evidence.** `authorization.integration.test.ts`: the D-20 test proves the refusal with persistence deep-equal, the analyst's amendment and the requestor's own submission; T-08-A2's own-submission proof stays green and its assertions are unedited, so another status on another person's draft is still 400.

## Security Audit 2026-09-26 (re-audit)

| Metric | Count |
|--------|-------|
| Threats found | 68 |
| Closed | 68: 63 mitigated, 5 accepted |
| Open | 0 |

**Verdict: SECURED.**
- T-08-A1 and T-08-A2 are closed, and T-08-A3's new disposition holds.
- O-1 to O-3 are closed.
- No later commit reopened a verified mitigation.

So `threats_open` is 0 on this audit's own evidence, and `status` is `verified`.

### Scope and method

- **Re-audited commit.** `8035357`.
  - It covers the remediation (`4529705` to `3cdc2f0`) and the 46 commits after it (`0a98c21..8035357`).
  - Citations in this section are at `8035357`.
- **Read-only.** This unit wrote only this file and committed nothing. It ran no Strapi suite, no Playwright run and no server. What it ran:

  | Check | Result |
  |---|---|
  | `vitest run src/lib/security src/lib/auth src/lib/testing src/lib/api src/lib/boundaries`, with the chain and parity guards (apps/web) | 23 files, 977 passed, 0 failed |
  | `vitest run` over the changed assessment and questionnaire tests, `src/features/requests`, `src/lib/metadata` and `src/lib/performance` | 14 files, 120 passed, 0 failed |
  | The O-1 and O-2 guard files alone, verbose | 2 files, 13 passed, 0 failed |
  | `prepareRequestorCreate` and `prepareAnalystUpdate` probed in a scratch copy under Node 24 with hostile bodies | 31 of 31 checks passed, including two controls that show the pre-fix branches writing the forged owner |
  | The old and new O-1 patterns run in a scratch script over the self-check's four forms | old: none matched; new: all four |
  | `pnpm audit --json` at the root (a registry lookup) | critical 0, high 1, moderate 13, low 1: the fifteen ids `dependency-audit-phase-08.md` records |
  | `cmp` of the two catalogue copies | identical |
  | Schema freeze, `git diff a9394cf..8035357` over the content-type schemas | empty. The last schema change is still `b4f3d88`, so the check can fail |
  | Contract, catalogue and inventory diff, `d11f469..8035357` | empty |
  | Added-line sweeps, `d11f469..8035357` (57 commits) | no Keycloak mention, no token pattern, and no attribution in commit messages or added lines. `CSRM_AI_` appears only in record text and in the harness's existing saved-variable list, and `config/ai.ts` is unchanged. The one `.env*` file is `.env.example` (T-08-A4) |
  | Read-only `curl` probes of the running dev Strapi | the table under T-08-A3 below |
  | `git status --porcelain` before and after | clean |

- **Recorded runs relied on.** HEAD's code equals `b3e22e8`'s, because the three later commits change records only.
  - Strapi: 526/526 on `51946b0` (the remediation), and again on `665f642`, after O-1 changed the served-operations scan (`08-UI-REVIEW.md`). No Strapi file changed after `665f642`.
  - Web: 1,887 tests in 99 files on `8687484`, whose code is `b3e22e8`'s. The typecheck and `api:check` are clean.
  - Browser: 84/84 on `b3e22e8`, 80 desktop and 4 mobile. The run includes `production-hardening.spec.ts` and the IDOR journeys.

### T-08-A1: verified closed

- **One create path.**
  - `create` (`csrm-assessment-request.ts:141-160`) refuses a missing actor or a non-object body. Then it builds every actor's data with `prepareRequestorCreate` (`request-workflow.ts:140-155`).
  - The preparation writes the thirteen published fields, the caller as `requestor`, the server's number, `draft` and a null submitted date.
  - It throws the safe 400 for any identity that is not a non-empty string.
  - `createWithDomainNumber` (`domain-number.ts:43-56`) retries only a request-number unique conflict, so the refusal reaches the controller's catch unchanged.
- **No other entry point.** No other route creates a request, and nothing outside the request router writes one from a body:
  - the questionnaire and assessment workflows write only a `requestStatus` the server computes (`assessment-workflow.ts:474,546,795`; `questionnaire-workflow.ts:313,332`);
  - the other writers are development seeds.

  Inside the router, the revert writes only the parsed reason and the server's own reversal facts (`request-workflow.ts:107-120`), and the update is T-08-A2.

  The questionnaire and assessment routers mount no core create or update. Assessment writes are closed allowlists without `assessmentRequest` (`assessment-workflow.ts:22-37,87-91`).
- **The tests can fail.**
  - **Strict and populated.** `authorization.integration.test.ts:562,607` use `node:assert/strict`. `harness.getRequest` populates `requestor`, `sponsor`, `revertedBy`, `questionnaire` and `assessment` (`strapi-http-harness.ts:1326-1340`). So a forged relation reads as an object, never as the `null` the test requires.
  - **The forged owner is caught three ways:** by the persisted owner, by the named Requestor's 403 and by her list.
  - **The recorded RED messages follow from the old branch, `{ ...input, requestNumber }`:**
    - the forged owner persisted (`T08A1_OWNER_IS_NOT_THE_CREATOR_ANALYST`);
    - the analyst's own request had no owner (`T08A1_OWN_REQUEST_NOT_IN_MY_REQUESTS_ANALYST`);
    - the old preparation had no identity check ("Missing expected exception").

    The scratch probe's control reproduces the first.
- **Matrix.** The create row (`fixtures/authorization-matrix.ts:644`) cites both tests for the analyst and the service agent. The provenance rule accepts a citation only when the cited test names that actor's identity (`helpers/matrix-provenance.ts:17-24,52-77`). The row's persistence snapshot now counts the service agent's requests too.

### T-08-A2: verified closed

- **Code.** For an analyst actor, `update` (`csrm-assessment-request.ts:162-185`) writes `prepareAnalystUpdate` (`request-workflow.ts:189-198`). That is the thirteen published fields or, when the body carries a status, the Requestor's own transition (`:157-175`). The scratch probe confirms three things:
  - **Forged facts.** The probe's body carries `title` and `description` beside forged facts. They are the owner and the sponsor as relation operations, the number, the dates, the reversal facts, the links, `id`, `documentId`, `locale` and a `__proto__` key. On a draft, submitted, approved or closed request, the update writes only `title` and `description`.
  - **Refused statuses.** On a draft, every status but `submitted` and `draft` is refused, `null`, `""` and `1` included; `draft` writes no status. On a submitted or approved request, `draft` and `submitted` are refused too.
  - **Submission.** A draft is submitted with the server's date and no forged fact.
- **The tests can fail.**
  - **Owner.** `:629` checks the persisted owner after a forged `requestor`. It also checks that the other Requestor is still refused the request and the questionnaire (403) and the assessment (404). Its preconditions prove the fixture's links before the write.
  - **Server-owned facts.** `:688` checks every server-owned fact against `null` or its fixture value, under strict assert. It refuses `approved` and `risk-assessment-drafted` with the row unchanged (`deepEqual`). It also requires the submission date to fall between the times just before and after the request.
  - **RED.** The recorded messages (`T08A2_OWNER_MOVED_ANALYST`, `T08A2_REQUESTOR_WRITTEN_ANALYST`) follow from the old branch.
- **An open question of the first audit, answered.**
  - The question was whether the Document Service honours writes to the request's inverse `questionnaire` and `assessment` relations. It does.
  - `request-workflow.integration.test.ts` linked a questionnaire through the old analyst branch and got 200. After `197965e` that shortcut no longer linked it (`UNEXPECTED_QUESTIONNAIRE_GUARD_STATUS`).
  - So the old branch could also write the questionnaire and assessment links from a body. The fix writes neither, and the test now links the questionnaire from its own side (`:305-309`).
- **Matrix.** The update row (`fixtures/authorization-matrix.ts:674`) cites both tests for both actors.

### T-08-A3: new disposition verified

- **Configuration and framework.**
  - `config/middlewares.ts:10-19` passes `parseCorsAllowedOrigins(env("CSRM_CORS_ALLOWED_ORIGINS", ""))` as `origin` (`:17`).
  - In `@strapi/core` 5.51.0, `matchOrigin` (`dist/middlewares/cors.js:36-65`) reads an array as the list and returns `''` for an origin the list does not name. Only `undefined`, `null` or `'*'` act as a wildcard.
  - `@koa/cors` 5.0.0 (`index.js:61-65`) then passes the request on with no `Access-Control-Allow-*` header. So `[]` grants nothing.
  - A request with no `Origin` still gets an empty `Access-Control-Allow-Origin` with credentials. `matchOrigin` returns `'*'` before it reads the list, and `@koa/cors` then substitutes the empty request origin. That value matches no origin.
- **Parser.** `cors-allowed-origins.ts:24-41` returns `url.origin` for an exact http or https origin. Anything else stops the boot with a positional error: a wildcard, `null`, another scheme, a path, a query, a fragment or credentials. No other Strapi source or configuration sets a CORS header.
- **Tests, in both directions.**
  - **Pinned variable.** Every harness pins the variable (`strapi-http-harness.ts:437`), empty unless a test lists origins.
  - **Default.** `http-hardening.integration.test.ts:135` asserts no grant header on an `/api` read, on `POST /admin/access-token` and on both preflights. `:160` keeps the same-origin admin answers identical.
  - **Listed origins.** `cors-allowlist.integration.test.ts:32` passes only if the pinned list reaches the configuration. `:48` refuses six lookalikes, `null` among them.
  - **RED.** The recorded message, `CORS_GRANTED_CONTENT_API_access-control-allow-origin: https://untrusted.example`, is what Strapi's old default produces: `matchOrigin` with `'*'` echoes the origin.
- **Live probes** of the running dev Strapi (read-only; no token and no cookie):

  | Request | `Origin` | Status | CORS headers |
  |---|---|---|---|
  | `GET /api/csrm-assessment-requests` | `https://evil.example` | 403 | `Vary: Origin` only |
  | `GET /api/v1/risk_types` | `http://localhost:4000` | 401 | `Vary: Origin` only |
  | `OPTIONS /api/csrm-assessment-requests` (preflight) | `https://evil.example` | 200 | `Vary: Origin` only |
  | `OPTIONS /admin/access-token` (preflight) | `https://evil.example`, `http://localhost:4000`, `null` | 200 | `Vary: Origin` only |
  | `GET /admin/init` | `https://evil.example` | 200 | `Vary: Origin` only |
  | The access-token preflight; `GET /api/v1/risk_types` | `http://localhost:3000` (the web) | 200; 401 | `Vary: Origin` only |
  | The access-token preflight | `http://localhost:1337`, `http://127.0.0.1:1337` | 200 | `Vary: Origin` only |
  | `GET /admin/init` | none | 200 | an empty `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true` |

  At the first audit, the same preflight echoed `http://localhost:4000` and `https://evil.example` with credentials. Now the dev Strapi grants none of the probed origins, the web's own included.
- **Disposition.** `mitigate / accept` is right.
  - The default is mitigated and proven.
  - What remains is an origin an operator lists. It is granted credentialed reads of every route, the admin access-token route included.
  - R-08-11 records this. The operator owns it, and any deployment that sets the variable is the revisit trigger.
  - `.env.example` says to list only an origin trusted as much as the admin panel.

  Closed.

### O-1 to O-3: closed

- **O-1 (`e4b7d2d`).**
  - Both scans now use `\.(GET|POST|PUT|PATCH|DELETE)\s*(?:<[^()]*>)?\s*\(`: `contract-operation-chain.test.ts:32` and `served-operations.integration.test.ts:245`.
  - The self-check (`contract-operation-chain.test.ts:151-158`) covers a type argument, a nested one and spaces before the parenthesis. The scratch run shows the old pattern matched none of its four forms.
  - **Still unrecognised (informational):** a space after the dot, a method reached through `.call`, `.apply` or `.bind`, and a comment before the parenthesis. A grep finds none in the web source, and only the services and the transport may name the client (`:131-138`).
- **O-2 (`91f8fe5`).**
  - `src/lib/testing/e2e-sign-in-assertions.test.ts` parses every `e2e/**` module with the TypeScript parser.
  - A function that clicks a `Continue as …` button must assert the level-one Dashboard heading and the banner role, and `toHaveURL(/\/app$/)` is refused.
  - The scan reaches at least six signing-in files. Its self-checks report a URL-only helper and a heading-only helper.
  - The first audit's grep still finds nothing.
- **O-3 (`1e7bdf6`).** `nodemailer: 9.1.1` is pinned exactly in `pnpm-workspace.yaml:14` and in the lockfile's overrides. The lockfile resolves only 9.1.1, and the dependency audit is unchanged.

### Later commits: no mitigation reopened

- **Unchanged since `d11f469`:**
  - `proxy.ts`, `next.config.ts`, `instrumentation-client.ts`, `playwright.config.ts` and `tsconfig.e2e.json`;
  - the root layout, the root and app boundaries, and every `app/(app)` route;
  - `src/lib`, apart from two tests: `sign-in-page.test.tsx` and the new O-2 scan.

  So the session, attestation, CSP, header, transport and return-path controls (T-08-02-*, T-08-10-*, T-08-A5) stand as audited.
- **Changed, with no security effect:**
  - **Sign-in page.** `app/sign-in/page.tsx` changes the development page's title only. The runtime gate is untouched.
  - **Services.** The administration, Risk and questionnaire services register the closed schemas they parse with for the parity guard (G1). Their runtime parsing is unchanged in behaviour.
  - **Draft card.** It stops offering generation once an assessment exists (W-1). Strapi's 409 stays the authority, and the advisory copy and its tests stand (T-08-07-01).
  - **Refusals.** The permission guard in `accessibility.spec.ts` now also requires no search, filter, total or pager on a refusal (W-3). That strengthens T-08-12-02. The other e2e changes are title and chip expectations.
  - **Sweeps.** The web diff after `3cdc2f0` adds no external URL, no HTML sink, no raw `fetch` and no `NEXT_PUBLIC_` variable.
- **Strapi after `51946b0`:** only the served-operations scan (O-1). Across the whole range the policy changed in a comment only (`bab4f15`), and the rest of the Strapi change is the remediation itself.

### Records

- **Remediation rows.** R-08-11 is corrected, R-08-40 and R-08-41 are closed, and R-08-42 is added. R-08-42's facts match the catalogue (see its log row).
- **G1 closure.** It changed two rows this audit had checked:
  - R-08-17's count is 43;
  - R-08-18 is closed, and it had nine parsers, not ten.

  The field-path rule (`contract-response-parity.test.ts:500`) and the question-key rule (`:524`) prove the closure.
- **R-08-14.** The count rose again, to 53 and 52 in the UI review resolution's two full runs.

### What remains

Nothing blocks the phase. Three decisions stay with their owners:
- R-08-42 and O-5, for Phase 9;
- R-08-11's origin list, for the operator at deployment.

## Security Audit Trail

| Audit Date | Threats Total | Closed (mitigated) | Accepted | Open | Blocking open (≥ high) | Run By |
|------------|---------------|--------------------|----------|------|------------------------|--------|
| 2026-09-26 | 68 | 60 | 6 | 2 | 1 | gsd-security-auditor |
| 2026-09-26 | 68 | 63 | 5 | 0 | 0 | gsd-code-fixer (remediation evidence, not an audit run; the audit re-run confirms) |
| 2026-09-26 | 68 | 63 | 5 | 0 | 0 | gsd-security-auditor (re-audit at `8035357`; confirms the row above) |

- **The 68 threats** are the 63 plan-time threats (58 mitigated and 5 accepted, all verified) and five audit-registered items.
  - **At audit:** of the five, T-08-A4 and T-08-A5 were mitigated, T-08-A3 was accepted, and T-08-A1 and T-08-A2 were open.
  - **After remediation:** T-08-A1 and T-08-A2 are mitigated. T-08-A3 is mitigated by default, with the operator's allowlist accepted (R-08-11), so it counts as mitigated, as T-08-03-02 and T-08-10-03 do.
  - **Re-audit:** the same counts, now verified. The 63 mitigated are the 58 plan-time mitigations and T-08-A1 to T-08-A5. The 5 accepted are the plan-time acceptances.
- **The residual register** had 39 ids at audit: 37 accepted and 2 closed. R-08-11 was corrected, and R-08-14's count was stale.
  - **After remediation it has 42:** 38 accepted, R-08-42 among them, and 4 closed (R-08-16, R-08-25, R-08-40, R-08-41).
  - R-08-11 is corrected and mitigated by default, and R-08-14's count is corrected.
  - **At the re-audit it still has 42:** 37 accepted and 5 closed, since the G1 closure also closed R-08-18.

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed by the re-audit at `8035357`. The remediation first set it on its own evidence.
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-26.
- At audit, it was blocked on T-08-A1 and T-08-A2.
- Both were remediated on 2026-09-26 (`1379bf7`, `197965e`), with the CORS exposure (`eb7e72d`).
- The re-audit verified both, T-08-A3's new disposition and the closure of O-1 to O-3, at `8035357`.

_Auditor: gsd-security-auditor_
