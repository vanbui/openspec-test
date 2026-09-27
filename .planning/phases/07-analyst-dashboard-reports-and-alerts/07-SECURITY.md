---
phase: "07"
slug: "analyst-dashboard-reports-and-alerts"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-09-25"
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

## Scope and Method

- **Audited commit.** The audit covers `be64f63`: the range `eb28084..be64f63`, which is 76 commits and 164 files. Every citation is `path:line` at that commit.
- **Register origin.** All nine plans carry a `<threat_model>`, so the register was authored at plan time: 42 threats, 39 to mitigate and 3 to accept. This audit verified each one against the code and added nine residual risks from the contract-gap record and five items of its own.
- **Configuration.** `.planning/config.json` sets no security keys, so the workflow defaults apply: enforcement on, ASVS level 1. Earlier phases counted only open threats at or above `high`. No threat here is open at any severity, so that threshold does not change the result.
- **Read-only.** No suite, build or dev server was run. The gate figures are the ones plan 07-09 recorded on `d3c6150`: Strapi 349/349, web 832/832 in 69 files, the typecheck and `api:check` clean, and Playwright 49/49 with none flaky.
- **Concurrent fixes.** Review fixes landed after `be64f63` while this audit ran. They are read for regressions at the end.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser to Next.js routes | Untrusted path keys and search parameters enter closed URL parsers: `reportKey`, `kind`, `urgency`, `page`, `pageSize`, `period`, `state`, `__e2eState` and `__e2ePartial`. The capability check gates presentation only. | URL values |
| Next.js server to Strapi | Every read goes through the `server-only` typed openapi-fetch client, and Strapi re-authorises each call. | Insight DTOs, owner counts |
| Strapi policy to controller | The policy resolves IdamBox Role → Function → FunctionAPI and sets the insight or owner scope. Each controller asserts that scope before it reads anything. | Authorisation decision |
| Strapi to SQLite | Closed query values become bound parameters, and scope predicates are ANDed in SQL. | Risk, request, questionnaire, assessment and Control Implementation facts |
| Catalogue JSON to seeded grants | Bootstrap turns the two byte-identical catalogue copies into Role, Function and FunctionAPI rows. | Grants |
| Seed to development and E2E databases | A boot-relative fixture runs under explicit development gates. | Fixture records |
| Strapi to browser | Closed DTOs reach the browser and are parsed by closed Zod schemas. Actor display names reach human analysts only. | Workload figures, record references, display names |

## ASVS Key

The audit maps controls to ASVS 4.0.3 chapters V4, V5, V7, V8 and V13. Three rows cite another chapter where none of the five fits, and are marked "outside".

| Requirement | Meaning used here |
|-------------|-------------------|
| V4.1.1 | Access control enforced on a trusted service layer |
| V4.1.3 | Least privilege |
| V4.2.1 | Protection against reading other principals' records (IDOR) |
| V5.1.1 | HTTP parameter pollution defences |
| V5.1.3 | Positive (allow-list) input validation |
| V5.1.4 | Structured data validated against a defined schema |
| V5.3.1 | Output encoding for the interpreter and context |
| V5.3.4 | Parameterised queries |
| V7.4.1 | Generic message for unexpected or security-sensitive errors |
| V7.4.2 | Exception handling accounts for expected and unexpected errors |
| V8.1.1 | Sensitive data kept out of server-side caches |
| V13 | API and web service controls. V13.1.4 means authorisation at both the route and the resource level; V13.2.1 means only valid HTTP methods are enabled. |

## Required Control Coverage

| Control | Threat IDs | Verified by |
|---------|------------|-------------|
| Human-analyst-only grants and the independent policy guard | T-07-01-01, T-07-01-04, T-07-A3 | a catalogue trace of both copies; `csrm-authorization.ts:34-42,204-208,270-273` |
| Automation-identity refusal | T-07-01-01, T-07-04-01, T-07-06-05 | the mis-granted agent in `analyst-insight-authorization.unit.test.ts:131`; the seeded agent in the three mounted matrices |
| The insight scope requires the underlying reads | T-07-01-02 | `csrm-authorization.ts:50-55,326-336`; `analyst-insight-authorization.unit.test.ts:137` |
| No scope widening to partial-release parents, drafts or other Requestors | T-07-04-02, T-07-06-01, T-07-08-01, T-07-03-02, T-07-02-01 | `applyDisclosableParent`, the reviewable statuses, the release triple and the owner join, each pinned by exclusion fixtures |
| The owner-scoped Requestor summary | T-07-02-01, T-07-02-02 | `request-status-summary.ts:68-80`; `request-status-summary.integration.test.ts:85,112,148` |
| No report-key disclosure to a denied viewer | T-07-06-02, T-07-07-01 | policy before key at the server; capability before key in the page and its metadata |
| Closed query keys and enums | T-07-02-02, T-07-02-03, T-07-04-03, T-07-05-02, T-07-06-03, T-07-07-03, T-07-08-04 | closed parsers and 400 matrices |
| Bound SQL parameters | T-07-02-03, T-07-03-01, T-07-04-03, T-07-06-03, T-07-08-04 | bound values, `??` identifiers and constant fragments |
| Page-size caps and honest truncation | T-07-03-03, T-07-04-04, T-07-06-04, T-07-08-03 | named caps; limit+1 reads or exact counts |
| Safe error envelopes that never leak SQL or names | T-07-02-04, T-07-04-06, T-07-A1 | constant messages; body assertions; Strapi's generic 500 |
| The seed is gated to development identity flags and never runs in production | T-07-04-05 | `seed-analyst-insights.ts:333-344`; the five-gate test |
| No secrets | T-07-A2 | a sweep of the diff |

## Threat Register

Severity is this audit's grading, because the plans did not grade their threats. Every `mitigate` row was verified by reading the cited code and tests at `be64f63`.

| Threat ID | Category | ASVS | Severity | Component | Disposition | Status | Verification evidence |
|-----------|----------|------|----------|-----------|-------------|--------|-----------------------|
| T-07-01-01 | Elevation of privilege | V4.1.1, V4.1.3, V13.1.4 | high | Automation identity reaching the five insight operations | mitigate | closed | Two independent refusals. (1) **Catalogue:** each served FunctionAPI sits in its own API-only Function, with no `menuPath` and `roleIds: ["role.security_analyst"]`. A trace script confirmed this over both identical copies; see also `contract-catalogue.integration.test.ts:1101` and `analyst-insight-catalogue-seed.integration.test.ts:142`. (2) **Guard:** all five operations are in `HUMAN_ANALYST_ONLY_OPERATIONS` (`csrm-authorization.ts:34-42`). It is enforced at `:270-273` against the role named exactly "Security Analyst" (`:204-208`). A deliberately mis-granted "Security Analyst Agent" is refused (`analyst-insight-authorization.unit.test.ts:131`). The seeded agent is refused on every route (`analyst-alerts.integration.test.ts:560`, `analyst-reports.integration.test.ts:618`, `analyst-dashboard.integration.test.ts:491`). |
| T-07-01-02 | Information disclosure | V4.1.3, V4.2.1 | high | An insight read widening a human analyst's scope | mitigate | closed | `requireAnalystInsightScope` requires the insight operation plus four reads on the human role: the Risk Register, the review queue, the questionnaire review list and the assessment list (`csrm-authorization.ts:50-55,326-336`). A read held only through an agent role does not count (`analyst-insight-authorization.unit.test.ts:137`). Every handler asserts the scope before it reads a key, a query or a row (`insight-scope.ts:20-26`; `controllers/alerts.ts:32,60`; `dashboard.ts:36`; `reports.ts:63,73`). |
| T-07-01-03 | Tampering | V4.1.1 | medium | Drift between the docs and bootstrap catalogue copies | mitigate | closed | `cmp` reports the two copies identical (re-run in this audit); the contract-catalogue test asserts the bytes. |
| T-07-01-04 | Elevation of privilege | V4.1.3 | medium | Duplicate API-only Function rows accumulating grants | mitigate | closed | The API-only names (`function.dashboard.summary_api`, `function.alerts.list_api`, `function.alerts.summary_api`, `function.reports.list_api`, `function.reports.run_api`) differ from the menu Functions. The reconciler matches API-only Functions by a NULL `menuPath`. Seeding twice leaves one row each (`analyst-insight-catalogue-seed.integration.test.ts:110,130`). Older development databases keep detached, unreachable duplicates (gap record item 12). |
| T-07-01-05 | Repudiation | – | low | Re-use of reserved FunctionAPIs for their purpose | accept | closed | AR-07-01 |
| T-07-02-01 | Information disclosure | V4.2.1 | high | The Requestor summary counting another Requestor's records | mitigate | closed | The policy sets `own` with the caller's numeric id (`csrm-authorization.ts:179-185,381-384`). The controller accepts nothing else (`my-request-status-summary.ts:30-38`). The SQL joins the requestor link on that id alone (`request-status-summary.ts:68-80`). The owner, a second Requestor, the analyst and the agent each see only their own counts (`request-status-summary.integration.test.ts:85,112`). |
| T-07-02-02 | Tampering | V5.1.3 | medium | Summary query parameters widening scope | mitigate | closed | Any query key answers 400 before a read (`my-request-status-summary.ts:37`; `request-status-summary.integration.test.ts:148`). |
| T-07-02-03 | Tampering (injection) | V5.1.3, V5.3.4 | high | The Risk Register `state` filter | mitigate | closed | A closed enum in the parser (`risk-register-query.ts:7,142`) and in the spec (`open`, `closed`); constant SQL fragments (`risk-register.ts:349-350`); `contract-catalogue.integration.test.ts:1288`. |
| T-07-02-04 | Information disclosure | V7.4.1 | medium | Error bodies leaking SQL | mitigate | closed | Constant messages through `ctx.badRequest` and `ctx.forbidden`; the body assertions under T-07-04-06. |
| T-07-02-05 | Spoofing | – | low | The web overdue marker contradicting the server | accept | closed | AR-07-02 |
| T-07-03-01 | Tampering (SQL injection) | V5.3.4 | high | Queue sort, filter and text | mitigate | closed | The sort field is closed (`collection-scope.ts:244`) and mapped through `SORT_COLUMNS` (`review-queue-repository.ts:42-49`). Text is bound as `LOWER(?) ... ESCAPE '!'` with escaping (`:170-182`). The raw order fragments use only the closed map and a checked direction (`:194-201`). `review-queue-buckets.integration.test.ts:311` proves literal matching. |
| T-07-03-02 | Information disclosure | V4.2.1 | high | A queue returning a draft or out-of-queue record | mitigate | closed | The status bound is always ANDed (`review-queue-repository.ts:175`). An outside-queue read short-circuits with no read (`csrm-assessment-request.ts:61-67`). Tests: `review-queue-buckets.integration.test.ts:207,219`. |
| T-07-03-03 | Denial of service | V13, V5.1.4 | medium | Unbounded generation-id snapshot | mitigate | closed | `MAX_ACTIVE_GENERATION_REQUEST_IDS = 1_000` fails closed (`questionnaire-generation-workflow.ts:78-91`) and is re-checked on every count and page (`review-queue-repository.ts:218,225`). Hydration takes at most 100 ids (`:36,235`). |
| T-07-03-04 | Elevation of privilege | V4.1.1, V13.1.4 | high | Queue read without the analyst scope | mitigate | closed | The `assessmentReviewCollectionScope === "all"` gate (`csrm-assessment-request.ts:59`) is set only by `requireAnalystRequestCollectionScope` (`csrm-authorization.ts:338-347`). |
| T-07-03-05 | Information disclosure | – | low | Registry inconsistency across Strapi processes | accept | closed | AR-07-03 |
| T-07-04-01 | Elevation of privilege | V4.1.1, V13.1.4 | high | The automation agent or a Requestor reading alerts | mitigate | closed | Route policy (`routes/alerts.ts:10-13`), controller assertion (`controllers/alerts.ts:32,60`) and the guard (T-07-01-01). The mounted matrix refuses six identities and a missing token on both routes. A malformed query from a Requestor still answers 403, so authorisation precedes parsing (`analyst-alerts.integration.test.ts:560-585`). |
| T-07-04-02 | Information disclosure | V4.2.1 | high | Alerts revealing drafts or partially released parents | mitigate | closed | Risk and Control Implementation branches reuse `applyDisclosableParent` with `closure_date IS NULL` (`alert-repository.ts:234-249`; the rule is at `risk-register.ts:137-164`). Request branches read the four reviewable statuses only (`:252-255`). Reviews and the released flag need the complete release triple (`:134-156,341-369`). Fixtures RP, AP, Q5 to Q7, CI2, R6, R7 and R10 are absent from the literal 14-alert list (`analyst-alerts.integration.test.ts:79-146,440`). |
| T-07-04-03 | Tampering (SQL injection) | V5.1.1, V5.1.3, V5.3.4 | high | `kind`, `urgency` and paging | mitigate | closed | Keys and members are closed; duplicates, lists beyond eight and operator objects are refused (`alert-query.ts:25,41-84`). Branches come from a frozen map (`alert-repository.ts:298`). Values are bound, identifiers are bound as `??`, and the order is constant (`:119-126,187-195`). The 400 matrix covers `kind[$eq]`, a repeated `urgency` and `sort` (`analyst-alerts.integration.test.ts:587`). |
| T-07-04-04 | Denial of service | V13 | medium | Unbounded alert pages | mitigate | closed | Page sizes are 5, 10, 25 or 50 (`insight-constants.ts:16`) and the page is at most 1,000,000 (`alert-query.ts:23,59-73`), both re-checked in the repository (`alert-repository.ts:91-92,505-508`). Counts run in SQL. |
| T-07-04-05 | Tampering | V14 (outside) | high | The fixture seed running in production | mitigate | closed | The seed needs `IDAMBOX_SEED_CSRM === "true"` and `developmentIdentityEnabled()`, which requires `NODE_ENV` and `CSRM_ENVIRONMENT` to be `development` and `CSRM_DEV_IDENTITY` to be `true` (`seed-analyst-insights.ts:333-344`; `development-identity-enabled.ts:1-7`). Bootstrap calls it at `index.ts:26`. A five-case test, including `NODE_ENV=production`, proves no record is created (`analyst-insights-seed.integration.test.ts:147-167`). |
| T-07-04-06 | Information disclosure | V7.4.1 | medium | Error bodies | mitigate | closed | Every 400, 403 and 404 message is a constant (`alert-query.ts:29-34`; `report-query.ts`; `insight-scope.ts:24`; `controllers/dashboard.ts:17`). Tests assert that no body contains `SQL`, `stack` or `database`, fixture data, or a person's name (`analyst-alerts.integration.test.ts:560,587`; `analyst-reports.integration.test.ts:618,652`; `analyst-dashboard.integration.test.ts:491`, which includes `Jane Doe` and `Bob Doe`). |
| T-07-05-01 | Information disclosure | V4.1.1 | high | A Requestor opening `/app/alerts` directly | mitigate | closed | The capability is checked before any read (`alerts/page.tsx:25`), and Strapi's 403 renders the same state (`:36`). `alerts-page.test.tsx:106,121` prove no read. The browser matrix covers both Requestor identities (`analyst-insights.spec.ts:601`). |
| T-07-05-02 | Tampering | V5.1.3 | low | URL filter values | mitigate | closed | `alertListUrlQuerySchema` maps unknown values to defaults and strips unknown keys (`alert-schema.ts:162-173`). The server re-validates with 400 (T-07-04-03). |
| T-07-05-03 | Spoofing | V5.3.1 | medium | Alert links opening the wrong actor's route | mitigate | closed | `alertSourceHref` builds analyst routes only, with encoded ids (`alert-presentation.ts:105-117`). The journey asserts `/app/risks/{id}` and lands there (`analyst-insights.spec.ts:539-543`). |
| T-07-05-04 | Information disclosure | V4.1.1 | medium | An E2E fixture state rendered in normal runtime | mitigate | closed | `isAttestedE2eRuntime` requires the harness flag, a nonce matching an attestation under an isolated temp root, and a timestamp under an hour old (`e2e-ui-state.ts:25,33-55`). The fixture resolves only after a successful read (`alerts/page.tsx:40`). The denial matrix also requests every URL with `?__e2eState=populated` and finds no `[data-ui-state]`. |
| T-07-06-01 | Information disclosure | V4.2.1 | high | A report widening scope through its parameters | mitigate | closed | There is no grouping parameter; the only one is `period` in {6, 12} (`report-query.ts:47-67`). Figures use open contextual Risks (`report-repository.ts:162-172`), the release triple (`:186-195`) and the review-scope statuses (`:383`). Tests: `analyst-reports.integration.test.ts:549,589,677,737`. |
| T-07-06-02 | Information disclosure | V4.1.1, V13.1.4 | medium | Report key probing by non-analysts | mitigate | closed | The route policy runs first, and the handler asserts the scope before it reads the key (`controllers/reports.ts:73-75`). An unknown key answers 403 to all six non-analyst identities (`analyst-reports.integration.test.ts:618-650`). |
| T-07-06-03 | Tampering (SQL injection) | V5.1.3, V5.3.4 | high | Report key or period | mitigate | closed | `isReportKey` checks a Set (`report-definitions.ts:46-48`); the period is closed (`report-query.ts:47-52`); the report comes from a closed switch (`controllers/reports.ts:42-58`); every value is bound. Tests: `analyst-reports.integration.test.ts:652,783`. |
| T-07-06-04 | Denial of service | V13 | medium | Heavy aggregates | mitigate | closed | Aggregates run in SQL. The lists are capped at 10 and 5 (`report-repository.ts:274,337`) and the median sample at 5,000 + 1, with a truncated flag (`:380`; `report-math.ts:247-261`). Test: `analyst-reports.integration.test.ts:804`. |
| T-07-06-05 | Elevation of privilege | V4.1.1 | high | Automation reading reports | mitigate | closed | The T-07-01-01 controls apply. The service agent and the analyst-named identity without a role are refused (`analyst-reports.integration.test.ts:618`). |
| T-07-07-01 | Information disclosure | V4.1.1 | medium | Report key validity revealed through not-found, the header or the title | mitigate | closed | The capability resolves before the key in `generateMetadata` and in the page (`[reportKey]/page.tsx:41-45,66-77`). For a Requestor, `params` is never read (`reports-pages.test.tsx:393`). Both identities get one header, state and title for a real and an invented key (`analyst-insights.spec.ts:76-82,601`). The orchestrator's browser check confirms it (07-UI-REVIEW). |
| T-07-07-02 | Information disclosure | V4.1.1 | high | Report data rendered for a Requestor | mitigate | closed | No read runs without `assessment:review` (`(report-index)/page.tsx:25`; `[reportKey]/page.tsx:67-74`). Strapi's 403 is the second refusal (`(report-index)/page.tsx:28`; `[reportKey]/page.tsx:53`). Test: `reports-pages.test.tsx:187`. |
| T-07-07-03 | Tampering | V5.1.3 | low | Injection through `period` or the key | mitigate | closed | `isReportKey` and `reportPeriodSchema` (`[reportKey]/page.tsx:77,80`); `getReport` re-validates before a read, and so does the server (T-07-06-03). |
| T-07-07-04 | Information disclosure | V4.1.1 | medium | An E2E fixture state outside the harness | mitigate | closed | The same attestation as T-07-05-04; resolved after the read (`[reportKey]/page.tsx:56`; `(report-index)/page.tsx:32`). |
| T-07-08-01 | Information disclosure | V4.2.1 | high | Dashboard figures or activity beyond the analyst's scope | mitigate | closed | Risk figures use `applyDisclosableParent` with the open predicate (`dashboard-summary.ts:143-149`). Bucket counts use the queue's own definition (`:228-230`). Request activity is limited to the review-scope statuses (`recent-activity-repository.ts:35,85,96`), and releases need the triple (`:152`). Questionnaire and assessment events stay inside the analyst's unfiltered "all" lists (`questionnaire-scope.ts:109-125` adds no status predicate for `all`; `assessment-scope.ts:62-70,122-124`). Mounted exclusions: T10, a partial release, and T11, a still-draft revert (`analyst-dashboard.integration.test.ts:535-539,635`). |
| T-07-08-02 | Information disclosure | V4.1.1 | medium | Actor display names reaching Requestors | mitigate | closed | The operation is analyst-only (T-07-01-01). Actor relations cross as `documentId` and `displayName` only (`recent-activity-repository.ts:38`). Generated drafts name no actor (`:103-113,136-146`). The Requestor route shows the permission state with no read (`(analyst-dashboard)/page.tsx:30`). The mounted denial asserts that no name appears (`analyst-dashboard.integration.test.ts:491`). |
| T-07-08-03 | Denial of service | V13 | medium | Unbounded activity or row reads | mitigate | closed | Each source reads `RECENT_ACTIVITY_LIMIT + 1` rows, with a length check (`recent-activity-repository.ts:32,197-199`). The High and Critical list reads `DASHBOARD_WIDGET_ROW_LIMIT + 1` rows (`dashboard-summary.ts:244`). Widget alert pages hold 5 rows (`analyst-dashboard-service.ts:100`). Counts run in SQL. |
| T-07-08-04 | Tampering | V5.1.3, V5.3.4 | high | Query injection | mitigate | closed | Any query key answers 400 (`controllers/dashboard.ts:37`; `alert-query.ts:87-89`). Every value is bound, and the order fragments are constants with one bound value (`dashboard-summary.ts:99-105,212`). Refused probes include `?populate=*`, `?filters[requestStatus]=draft` and `?today=` (`analyst-dashboard.integration.test.ts:491`). |
| T-07-08-05 | Information disclosure | V4.1.1 | medium | The partial fixture outside tests | mitigate | closed | `resolveE2eAnalystDashboardPartial` requires the attested runtime (`e2e-ui-state.ts:75-77`). It is resolved only after the real reads succeed (`(analyst-dashboard)/page.tsx:32-39`). `e2e-ui-state.test.ts` covers a missing harness, a missing attestation, a stale attestation and a nonce mismatch. |
| T-07-09-01 | Information disclosure | V4.1.1 | high | Analyst surfaces rendered to Requestors | mitigate | closed | The denial matrix covers five URLs, two identities, and plain and fixture requests (`analyst-insights.spec.ts:601-680`). Every absent selector is proven present for the analyst elsewhere in the suite. It passed in the 49/49 gate. |
| T-07-09-02 | Repudiation | V7 | low | Unverified gate claims | mitigate | closed | The 07-09 summary records exact per-suite counts. This audit found them consistent with the tree at `be64f63`: 69 web test files, and 49 Playwright tests including the loop-generated ones. |
| T-07-09-03 | Tampering | V14 (outside) | low | Harness files leaking into commits | mitigate | closed | `git diff --name-only eb28084 be64f63 -- apps/web/next-env.d.ts apps/web/tsconfig.json` is empty. |
| T-07-A1 | Information disclosure | V7.4.1, V7.4.2 | medium | Unexpected errors in the insight handlers (audit-registered) | mitigate | closed | Each handler catches only its typed 400, 403 and 404 errors and re-throws anything else (`controllers/alerts.ts:23-27`; `reports.ts:34-39`; `dashboard.ts:26-31`). Strapi's error middleware logs the error and serves `createError(500)` as "Internal Server Error", because `expose` is false for 5xx (`@strapi/core` 5.51.0 `dist/middlewares/errors.js` and `dist/services/errors.js`, `formatInternalError`). The web maps any transport failure to one constant message (`server-client.ts:87-89`). A parser failure exposes only an operation label, and only in development (`:92-98`). The four Phase 7 `error.tsx` boundaries render no error text. **Residual:** no Phase 7 test exercises the 500 path. |
| T-07-A2 | Information disclosure | V2.10.4 (outside) | high | Secrets in the phase's commits (audit-registered) | mitigate | closed | No `.env*` file is in the diff, no `CSRM_AI_*` value changed, and no token pattern (`sk-`, `ghp_`, `AKIA`, JWT) appears in any added line. The only secret-shaped literals are placeholder JWT secrets set for isolated test Strapi processes (`analyst-insight-catalogue-seed.integration.test.ts:70,74`; `analyst-insights-seed.integration.test.ts:114,118`). They follow the pre-phase pattern in four earlier test files. |
| T-07-A3 | Elevation of privilege | V4.1.3, V13.2.1 | medium | Catalogued, unserved operations still granted to the Requestor or the agent (audit-registered) | mitigate | closed | `GET /api/v1/dashboard/reports` and `GET /api/v1/dashboard/alerts` stay granted to `role.requestor` and `role.security_analyst_agent` through `function.dashboard.dashboard`. `GET /api/v1/alerts/{alertId}`, the acknowledge operation and report export stay granted to the agent through the menu Functions (catalogue trace). None is in the spec or mounted, and the route inventory test fails the suite if any router mounts one (`analyst-insight-routes.unit.test.ts:81,128`). None is in `HUMAN_ANALYST_ONLY_OPERATIONS`. **Forward note:** a phase that serves one must first move it to an analyst-only API Function (the D-07 pattern) and add it to the guard. |
| T-07-A4 | Information disclosure | V8.1.1 | high | Cross-user caching of analyst responses on the Next server (audit-registered) | mitigate | closed | The typed client sets no cache option (`server-client.ts:78-85`). Next 16.3 does not cache `fetch` by default (`apps/web/node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md:62`). No Phase 7 file uses `use cache`, `unstable_cache` or `revalidate`. Every page reads the session before any data read. |
| T-07-SC | Tampering (supply chain) | V14.2 (outside) | low | Dependencies | accept | closed | AR-07-04 |
| T-07-G1 | Tampering, information disclosure | V5.3.4, V4.2.1 | medium | PostgreSQL execution unverified (gap record item 9) | accept | closed | AR-07-05 |
| T-07-G2 | Repudiation | – | medium | No post-release treatment tracking (gap record item 1) | accept | closed | AR-07-06 |
| T-07-G3 | Repudiation | V7 | low | The activity feed is not an audit trail; alerts cannot be acknowledged (gap record items 2 and 3) | accept | closed | AR-07-07 |
| T-07-G4 | Tampering | V5.1.3 | low | Requestor-entered values steer analyst figures (gap record item 11) | accept | closed | AR-07-08 |
| T-07-G5 | Tampering (data integrity) | – | low | The malformed-definition divergence in the "submitted" predicate (gap record item 8) | accept | closed | AR-07-09 |
| T-07-G6 | Information disclosure (contract) | V13 | low | Error bodies carry an undeclared `data: null` (gap record item 12) | accept | closed | AR-07-10 |
| T-07-G7 | Elevation of privilege (verification gap) | V4.1.1 | medium | `authorization.policy.test.js` never runs (gap record item 12) | accept | closed | AR-07-11 |
| T-07-G8 | Tampering (contract drift) | V5.1.4, V13 | low | The parity guard cannot exercise the Risk Register parser or see parser narrowings (gap record item 12; code review IN-03) | accept | closed | AR-07-12 |
| T-07-G9 | Information disclosure (production behaviour) | V7.4.1 | medium | `next build` has not been run for the Phase 7 routes (gap record item 12) | accept | closed | AR-07-13 |

*Status: open · closed. Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party).*

## Unregistered Flags

None. Every entry under `## Threat Flags` in the nine summaries maps to a register ID. The 07-05 hash scroll reads only `location.hash` and scrolls to an element the page rendered, so it adds no surface. The five audit-registered rows (T-07-A1 to T-07-A4 and T-07-SC) come from this audit's own analysis, not from an unmapped summary flag.

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-01-05 | The reserved FunctionAPIs keep their url, name and description verbatim; only the owning Function changed. Catalogue design note 7 records the move. | Phase plan (07-01 threat model) | 2026-09-24 |
| AR-07-02 | T-07-02-05 | The web renders only the server's `treatmentDueState` (`risk-register.tsx:130`), and `isRiskOverdue` is gone, so no client date logic remains to spoof. | Phase plan (07-02 threat model) | 2026-09-24 |
| AR-07-03 | T-07-03-05 | The "Generation in progress" bucket is exact only for a single Strapi process: each process sees only its own jobs, and a restart forgets jobs in flight. A shared job store is Phase 8 work. | Orchestrator (D-21; contract-gap record item 7) | 2026-09-25 |
| AR-07-04 | T-07-SC | No package was installed (no `package.json` change in the range) and no chart library was added (D-19). A future dependency needs its own package gate. | Phase plan (UI-SPEC registry safety) | 2026-09-24 |
| AR-07-05 | T-07-G1 | PostgreSQL portability is unverified. Every suite runs on SQLite and `pg` is not installed. Unproven on the production dialect: the scope predicates, the NULL-safe treatment terms, the typed `UNION ALL`, the collation-dependent tie order and the `Date` bindings against `approval_date`. They are portable by construction. Phase 8 runs the suites on PostgreSQL. | Orchestrator (contract-gap record item 9) | 2026-09-25 |
| AR-07-06 | T-07-G2 | Post-release treatment tracking is absent. Release makes Risks and Control Implementations immutable, so an alert on released work can never clear. Each such alert states a true fact and is marked "Released · read-only" (`source.released`). A later datamodel decision owns this. | Orchestrator (D-27; contract-gap record item 1) | 2026-09-25 |
| AR-07-07 | T-07-G3 | Recent activity shows seven column-backed events only. Questionnaire submission, governance events, edits and comments have no dated, attributed column, and alert handling has no persisted per-analyst state. The feed is not an audit trail, and alerts cannot be dismissed. | Orchestrator (D-06; contract-gap record items 2 and 3) | 2026-09-25 |
| AR-07-08 | T-07-G4 | A Requestor's optional `dueDate` decides whether their own request raises a request alert. Rating strings off the Low-to-Critical ladder count as "Not rated". The figures trust recorded values and never repair them. Prioritisation stays a human decision. Input validation is a later datamodel decision. | Orchestrator (contract-gap record item 11) | 2026-09-25 |
| AR-07-09 | T-07-G5 | Only malformed stored questionnaire data can place a request in a different queue from the in-application rule. The parsers still fail closed when that questionnaire is read. | Orchestrator (D-30; contract-gap record item 8) | 2026-09-25 |
| AR-07-10 | T-07-G6 | Strapi's error envelope carries `data: null`, which the closed error components do not declare. The web keys on the status and never parses an error body closed, so no user sees the mismatch. A later contract pass declares or strips it. | Orchestrator (contract-gap record item 12) | 2026-09-25 |
| AR-07-11 | T-07-G7 | A pre-existing policy test file is skipped silently. Phase 7's policy proofs live in `analyst-insight-authorization.unit.test.ts`, which runs every time. Restoring the old file is Phase 8 work. | Orchestrator (contract-gap record item 12) | 2026-09-25 |
| AR-07-12 | T-07-G8 | The parity guard synthesises minimum integers and short non-empty strings. It therefore rejects every Risk Register payload behind an excusing narrowing, and cannot see the undeclared bounds the code review found (IN-03). Mounted spec pinning and `risk-schema.test.ts` cover the register. The narrowings fail closed. IN-03 is deferred with no code change to Phase 8 contract parity (INT-01). | Orchestrator (contract-gap record item 12; IN-03 disposition in `07-REVIEW.md`, `07e5a8e`) | 2026-09-25 |
| AR-07-13 | T-07-G9 | Every browser suite runs against `next dev`. The production build of the Phase 7 routes, including Next's production error sanitisation, is unverified. Phase 8 verifies the production build. | Orchestrator (contract-gap record item 12) | 2026-09-25 |

*Accepted risks do not resurface in future audit runs.*

## Review Fixes After the Audited Commit

Seven commits landed after `be64f63` while this audit ran: six test and fix commits, and `07e5a8e`, which records the resolution in `07-REVIEW.md`. Each code change was read for regressions against the controls above.

| Commits | Finding | Security reading |
|---------|---------|------------------|
| `182ff36` test, `5e8a396` fix | WR-01: "Ready for review" becomes "Submitted" | A label and description change. The predicate, the link and the contract field are unchanged, so no control moves. |
| `2c0f979` test, `155918e` fix | IN-01: unrated Risks sort last | Adds `CASE WHEN ${column} IN ('Low', 'Moderate', 'High', 'Critical') THEN 0 ELSE 1 END ASC`. The column comes from the closed sort field and the fragment is otherwise constant, so T-07-02-03 and T-07-03-01 still hold. |
| `0248a85` test, `607b41b` fix | IN-02: explicit `role="list"` | Markup only. |
| `07e5a8e` docs | IN-03: parser narrowings deferred to Phase 8 contract parity (INT-01) | No code change. The narrowings fail closed, and the risk stays accepted as AR-07-12. |

The orchestrator re-runs the full gate after these fixes.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Accepted | Blocking Open | Run By |
|------------|---------------|--------|----------|---------------|--------|
| 2026-09-25 | 56 | 43 | 13 | 0 | gsd-security-auditor |

The 56 threats are the 42 plan-time threats (39 mitigated, 3 accepted), four audit-registered mitigated items, the supply-chain acceptance, and nine residual risks accepted from the contract-gap record.

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-25

_Auditor: gsd-security-auditor_
