---
phase: 08-production-integration-and-hardening
reviewed: 2026-09-26T05:15:12Z
depth: deep
diff_base: a9394cf
head: 4176576
scopes:
  - id: server
    title: server, security, contract and harness
    findings: SR-01..SR-10
    reviewed: 2026-09-26T05:13:55Z
    files_reviewed: 88
  - id: web
    title: web UI half (pages, layouts, fallbacks, shared components, feature presentation and zod-free domain modules, E2E journeys and the accessibility spec, design-direction delta, CONTEXT.md)
    findings: WR-01..WR-11
    reviewed: 2026-09-26T05:15:12Z
    files_reviewed: 103
files_reviewed: 191
files_reviewed_list:
  - .gitignore
  - CONTEXT.md
  - apps/strapi/config/middlewares.ts
  - apps/strapi/package.json
  - apps/strapi/src/api/application/routes/application.ts
  - apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts
  - apps/strapi/src/api/csrm-assessment/services/deterministic-assessment-draft-provider.ts
  - apps/strapi/src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider.ts
  - apps/strapi/src/api/csrm-information-asset/routes/csrm-information-asset.ts
  - apps/strapi/src/api/csrm-information-system/routes/csrm-information-system.ts
  - apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
  - apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts
  - apps/strapi/src/api/function-api/routes/function-api.ts
  - apps/strapi/src/api/function/routes/function.ts
  - apps/strapi/src/api/idambox-user/routes/idambox-user.ts
  - apps/strapi/src/api/role/routes/role.ts
  - apps/strapi/src/bootstrap/disable-users-permissions-registration.ts
  - apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/strapi/src/index.ts
  - apps/strapi/tests/ai-provider-assessment.unit.test.ts
  - apps/strapi/tests/assessment-workflow.integration.test.ts
  - apps/strapi/tests/authorization-matrix.integration.test.ts
  - apps/strapi/tests/authorization-policy.unit.test.ts
  - apps/strapi/tests/authorization.integration.test.ts
  - apps/strapi/tests/contract-catalogue.integration.test.ts
  - apps/strapi/tests/fixtures/authorization-matrix.ts
  - apps/strapi/tests/fixtures/authorization.ts
  - apps/strapi/tests/helpers/strapi-http-harness.ts
  - apps/strapi/tests/http-hardening.integration.test.ts
  - apps/strapi/tests/questionnaire-governance.integration.test.ts
  - apps/strapi/tests/questionnaire-governance.unit.test.ts
  - apps/strapi/tests/questionnaire-workflow.unit.test.ts
  - apps/strapi/tests/served-operations.integration.test.ts
  - apps/web/app/(app)/app/admin/[collection]/[documentId]/page.tsx
  - apps/web/app/(app)/app/admin/[collection]/import/page.tsx
  - apps/web/app/(app)/app/admin/[collection]/new/page.tsx
  - apps/web/app/(app)/app/admin/[collection]/page.tsx
  - apps/web/app/(app)/app/assessments/[documentId]/page.tsx
  - apps/web/app/(app)/app/requests/[documentId]/edit/page.tsx
  - apps/web/app/(app)/app/requests/[documentId]/page.tsx
  - apps/web/app/(app)/not-found.tsx
  - apps/web/app/fonts.ts
  - apps/web/app/global-error.tsx
  - apps/web/app/globals.css
  - apps/web/app/layout.tsx
  - apps/web/app/not-found.tsx
  - apps/web/app/sign-in/page.tsx
  - apps/web/e2e/accessibility.spec.ts
  - apps/web/e2e/administration-workflow.spec.ts
  - apps/web/e2e/analyst-insights.spec.ts
  - apps/web/e2e/app-shell.spec.ts
  - apps/web/e2e/assessment-navigation-lifecycle.spec.ts
  - apps/web/e2e/assessment-release-workflow.spec.ts
  - apps/web/e2e/design-system-conformance.spec.ts
  - apps/web/e2e/helpers/csp.ts
  - apps/web/e2e/helpers/focus.ts
  - apps/web/e2e/helpers/navigation.ts
  - apps/web/e2e/helpers/settle.ts
  - apps/web/e2e/performance.spec.ts
  - apps/web/e2e/production-hardening.spec.ts
  - apps/web/e2e/questionnaire-generation-workflow.spec.ts
  - apps/web/e2e/questionnaire-governance-workflow.spec.ts
  - apps/web/e2e/questionnaire-workflow.spec.ts
  - apps/web/e2e/request-relationship-states.spec.ts
  - apps/web/e2e/requestor-request-workflow.spec.ts
  - apps/web/e2e/risk-register-workflow.spec.ts
  - apps/web/instrumentation-client.ts
  - apps/web/next.config.ts
  - apps/web/package.json
  - apps/web/playwright.config.ts
  - apps/web/proxy.ts
  - apps/web/src/components/csrm/bar-chart.test.tsx
  - apps/web/src/components/csrm/bar-chart.tsx
  - apps/web/src/components/csrm/data-table.test.tsx
  - apps/web/src/components/csrm/data-table.tsx
  - apps/web/src/components/csrm/horizontal-scroll-region.test.tsx
  - apps/web/src/components/csrm/horizontal-scroll-region.tsx
  - apps/web/src/components/csrm/page-header.test.tsx
  - apps/web/src/components/csrm/page-header.tsx
  - apps/web/src/components/csrm/risk-rating-badge.test.tsx
  - apps/web/src/components/csrm/risk-rating-badge.tsx
  - apps/web/src/components/csrm/status-badge.test.tsx
  - apps/web/src/components/csrm/status-badge.tsx
  - apps/web/src/components/shell/capability-navigation.tsx
  - apps/web/src/components/shell/mobile-navigation.test.tsx
  - apps/web/src/components/shell/wordmark.test.tsx
  - apps/web/src/components/shell/wordmark.tsx
  - apps/web/src/features/administration/administration-config.ts
  - apps/web/src/features/administration/administration-domain.ts
  - apps/web/src/features/administration/administration-form.tsx
  - apps/web/src/features/administration/administration-schema.ts
  - apps/web/src/features/administration/administration-workflow.test.tsx
  - apps/web/src/features/administration/administration-workspace.tsx
  - apps/web/src/features/administration/csv-import-flow.tsx
  - apps/web/src/features/alerts/alert-list.tsx
  - apps/web/src/features/alerts/alert-schema.ts
  - apps/web/src/features/alerts/alert-service.test.ts
  - apps/web/src/features/alerts/alert-service.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.test.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-presentation.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-schema.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-service.test.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard-service.ts
  - apps/web/src/features/analyst-dashboard/analyst-dashboard.test.tsx
  - apps/web/src/features/analyst-dashboard/analyst-dashboard.tsx
  - apps/web/src/features/assessments/assessment-detail.tsx
  - apps/web/src/features/assessments/assessment-domain.ts
  - apps/web/src/features/assessments/assessment-draft-job.tsx
  - apps/web/src/features/assessments/assessment-editor.test.tsx
  - apps/web/src/features/assessments/assessment-editor.tsx
  - apps/web/src/features/assessments/assessment-list.test.tsx
  - apps/web/src/features/assessments/assessment-list.tsx
  - apps/web/src/features/assessments/assessment-review-workflow.test.tsx
  - apps/web/src/features/assessments/assessment-schema.ts
  - apps/web/src/features/assessments/control-implementation-editor.tsx
  - apps/web/src/features/assessments/released-assessment-route.test.ts
  - apps/web/src/features/assessments/released-assessment.test.tsx
  - apps/web/src/features/assessments/released-assessment.tsx
  - apps/web/src/features/assessments/risk-editor.tsx
  - apps/web/src/features/contract-operation-chain.test.ts
  - apps/web/src/features/contract-response-parity.test.ts
  - apps/web/src/features/dashboard/requestor-dashboard.test.tsx
  - apps/web/src/features/dashboard/requestor-dashboard.tsx
  - apps/web/src/features/questionnaires/questionnaire-detail.tsx
  - apps/web/src/features/questionnaires/questionnaire-governance.test.tsx
  - apps/web/src/features/questionnaires/questionnaire-governance.tsx
  - apps/web/src/features/questionnaires/questionnaire-list.tsx
  - apps/web/src/features/questionnaires/questionnaire-review-list.tsx
  - apps/web/src/features/questionnaires/questionnaire-review.tsx
  - apps/web/src/features/questionnaires/questionnaire-revision-timeline.test.tsx
  - apps/web/src/features/questionnaires/questionnaire-workflow.test.tsx
  - apps/web/src/features/reports/report-period-control.tsx
  - apps/web/src/features/reports/report-periods.ts
  - apps/web/src/features/reports/report-schema.ts
  - apps/web/src/features/reports/report-service.test.ts
  - apps/web/src/features/reports/report-service.ts
  - apps/web/src/features/reports/report-table.tsx
  - apps/web/src/features/reports/report-views.test.tsx
  - apps/web/src/features/requests/request-form.test.tsx
  - apps/web/src/features/requests/request-form.tsx
  - apps/web/src/features/requests/request-hub.test.tsx
  - apps/web/src/features/requests/request-hub.tsx
  - apps/web/src/features/requests/request-routes.test.tsx
  - apps/web/src/features/requests/request-table.tsx
  - apps/web/src/features/requests/request-workflow-actions.tsx
  - apps/web/src/features/requests/request-workflow.test.tsx
  - apps/web/src/features/risks/mitigation-control-list.tsx
  - apps/web/src/features/risks/risk-detail-editor.tsx
  - apps/web/src/features/risks/risk-details.test.tsx
  - apps/web/src/features/risks/risk-details.tsx
  - apps/web/src/features/risks/risk-domain.test.ts
  - apps/web/src/features/risks/risk-domain.ts
  - apps/web/src/features/risks/risk-register-filters.tsx
  - apps/web/src/features/risks/risk-register-loading.test.tsx
  - apps/web/src/features/risks/risk-register-loading.tsx
  - apps/web/src/features/risks/risk-register.test.tsx
  - apps/web/src/features/risks/risk-register.tsx
  - apps/web/src/features/risks/risk-schema.ts
  - apps/web/src/lib/api/transport/server-client.test.ts
  - apps/web/src/lib/api/transport/server-client.ts
  - apps/web/src/lib/auth/development-runtime.test.ts
  - apps/web/src/lib/auth/development-runtime.ts
  - apps/web/src/lib/auth/development-session-adapter.test.ts
  - apps/web/src/lib/auth/development-session-adapter.ts
  - apps/web/src/lib/auth/session-adapter.ts
  - apps/web/src/lib/auth/sign-in-page.test.tsx
  - apps/web/src/lib/boundaries/alignment.test.ts
  - apps/web/src/lib/metadata/record-route-metadata.ts
  - apps/web/src/lib/performance/zod-client-boundary.test.ts
  - apps/web/src/lib/security/content-security-policy.test.ts
  - apps/web/src/lib/security/content-security-policy.ts
  - apps/web/src/lib/security/instrumentation-client.test.ts
  - apps/web/src/lib/security/output-safety.test.ts
  - apps/web/src/lib/security/proxy.test.ts
  - apps/web/src/lib/security/root-fallbacks.test.tsx
  - apps/web/src/lib/security/route-boundaries.test.ts
  - apps/web/src/lib/security/security-headers.test.ts
  - apps/web/src/lib/security/server-only-boundary.test.ts
  - apps/web/src/lib/testing/e2e-runtime-attestation.test.ts
  - apps/web/src/lib/testing/e2e-runtime-attestation.ts
  - apps/web/src/lib/testing/e2e-ui-state.ts
  - apps/web/src/lib/testing/performance-metrics.test.ts
  - apps/web/src/lib/testing/performance-metrics.ts
  - apps/web/src/test/layout-stubs.ts
  - apps/web/tsconfig.e2e.json
  - apps/web/tsconfig.json
  - docs/design/csrm-design-direction.md
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/specification.json
  - package.json
  - pnpm-workspace.yaml
findings:
  critical: 1
  warning: 8
  info: 12
  total: 21
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-09-26 (server scope 05:13:55Z, web scope 05:15:12Z)
**Depth:** deep
**Files Reviewed:** 191 (range `a9394cf..4176576`; server scope 88, web scope 103, no file in both)
**Status:** issues_found

## Summary

Two reviewers read the Phase 8 diff, `a9394cf..4176576`, in two disjoint scopes. This report consolidates their partial reports. Every finding keeps the id and the text its reviewer gave it: the server scope's findings are `SR-01` to `SR-10`, the web scope's `WR-01` to `WR-11`. Within each scope the findings are ordered by severity.

| Scope | Findings | Critical | Warning | Info |
|---|---|---|---|---|
| Server, security, contract and harness | SR-01..SR-10 | 1 | 3 | 6 |
| Web UI | WR-01..WR-11 | 0 | 5 | 6 |
| **Total** | 21 | 1 | 8 | 12 |

- **Blocking:** SR-01. A production build started with `NODE_ENV=development` enables the development sign-in without the run attestation or either D-11 variable.
- **Warnings:** SR-02 to SR-04 (each a test or guard that can pass while its claim is false) and WR-01 to WR-05.
- **Info:** SR-05 to SR-10 and WR-06 to WR-11.

Each scope's own summary, method and evidence notes follow unchanged.

## Server scope: summary

This half covers every Strapi source, test and configuration change, the web proxy, the static headers and the Content-Security-Policy builder, the client instrumentation, the auth, transport and testing libraries under `apps/web/src/lib/`, the E2E harness (helpers, `playwright.config.ts`, the production-hardening and performance specs), the contract parity and operation-chain guards, the schema and service modules Phase 8 changed, the specification and catalogue deltas, and the root manifests. Each file's Phase 8 diff was read in context. Call chains were traced into the Strapi policy, the identity middleware, the harness and the installed Next 16.3.6 and `@strapi/core` 5.51.0 sources. The compiled output of the most recent production build under `apps/web/.tmp/` was inspected.

Most of the phase holds up under adversarial reading:

- The nonce CSP is generated and propagated correctly, and its development branch is fixed at compile time.
- The Strapi error envelope is environment-independent.
- Registration is disabled at the right point in the boot order.
- The IAM and generic reference routers mount nothing.
- The timeline-actor lookup runs only after record authorisation and only for analyst readers.
- The parity boundary modes behave as documented.

**One blocking defect.** The fail-closed development session, which is the central D-11 guarantee, is keyed on the *runtime* `NODE_ENV`. A production build started with `NODE_ENV=development` therefore offers the development sign-in with no attestation and without either D-11 variable. Before this phase the same check was a compile-time constant (SR-01).

**Three warnings.** Each is a test that can pass while its claim is false:

- The authorization matrix asserts some allowed outcomes it never observes (SR-02).
- The contract chain guard cannot see a client call made outside `*-service.ts`, or through a receiver not named `client` (SR-03).
- The WCAG 2.4.7 focus helper passes for any control with a resting shadow (SR-04).

**Six items are informational.**

## Server scope: scope and method

- **Read for context, outside this half's list:**
  - `apps/web/app/sign-in/page.tsx` and `apps/web/app/sign-in/server-actions.ts`;
  - `apps/web/app/(app)/layout.tsx` and `apps/web/src/lib/auth/return-to.ts`;
  - `apps/strapi/src/policies/csrm-authorization.ts`;
  - `apps/strapi/src/middlewares/csrm-development-identity.ts` and `apps/strapi/src/utils/development-identity-enabled.ts`;
  - `apps/strapi/src/bootstrap/reconcile-development-public-permissions.ts`;
  - the catalogue's role grants, and the cited proofs in `authorization.integration.test.ts` and `assessment-workflow.integration.test.ts`.
- **Nothing was executed.** No Strapi suite, Playwright run, dev server or production server was run, as this unit's instructions require. No vitest run was needed: every finding is established from source, from the installed framework source, or from the compiled build output named in its evidence.
- **Accepted residuals** R-08-01 to R-08-38 are not re-reported. The one residual whose recorded facts this review found false is called out in SR-01 and in "Residual register cross-check".

## Server scope: Critical Issues

### SR-01: A production build started with `NODE_ENV=development` enables the development sign-in without the attestation or either D-11 variable

**Severity:** BLOCKER
**File:** `apps/web/src/lib/auth/development-runtime.ts:14`. Also:
- `apps/web/src/lib/auth/development-session-adapter.ts:38-40` and `:126-128`;
- `apps/web/src/lib/api/transport/server-client.ts:70-72` and `:87`;
- the consumer `apps/web/app/sign-in/page.tsx:14-16`.

**Issue.** `resolveSessionRuntimeMode(env)` returns `'development'` whenever `env.NODE_ENV === 'development'`, before any other gate. Every caller passes the live `process.env` object.

- Next's bundler replaces only the literal expression `process.env.NODE_ENV` at build time. A property read through a parameter is not replaced, so a `next build` output evaluates the process's runtime `NODE_ENV`.
- `next start` keeps an explicitly set `NODE_ENV=development` and only prints a warning.

**Failure scenario.**
1. Build with `next build`, then start with `NODE_ENV=development next start`. This happens, for example, when a container image or compose file sets `NODE_ENV` for every service.
2. `/sign-in` offers "Continue as Requestor", "Continue as Secondary Requestor" and "Continue as Security Analyst".
3. `completeDevelopmentSignIn` mints `csrm-development-role`, and the shell renders the chosen role's capabilities.

None of this needs the run attestation or `CSRM_ENVIRONMENT`, and the session itself does not need `CSRM_DEV_IDENTITY`. If `CSRM_DEV_IDENTITY=true` is also set, as `apps/web/.env.local.example` sets it, the transport requires the API token and attaches `x-csrm-dev-identity` for the chosen fixture identity.

**What still holds.** Strapi stays the backstop. Its middleware (`apps/strapi/src/utils/development-identity-enabled.ts`) requires its own `NODE_ENV=development`, `CSRM_ENVIRONMENT=development` and `CSRM_DEV_IDENTITY=true`. A production Strapi therefore resolves no identity, and every data read answers 403.

**When it is fully open.** A deployment that also runs Strapi in development mode, for example `strapi develop` with the example environment, is open to anyone who clicks "Security Analyst".

**This is a regression.** At `a9394cf`:
- the adapter called `parseSessionRuntimeMode(process.env.NODE_ENV)`;
- the transport tested `process.env.NODE_ENV !== 'development'`.

Both are literal expressions that a production build compiles to `"production"`. A production build could therefore never yield a session, whatever its runtime `NODE_ENV`.

**What it contradicts.**
- D-11: "Any missing or invalid gate leaves the session unavailable (fail closed)".
- The recorded compensating control of R-08-03, which is false as recorded: "`resolveSessionRuntimeMode` fails closed outside the attested runtime, and each of its gates fails closed alone".

**Evidence.**
- **The resolver reads the runtime object.** Compiled production chunk `apps/web/.tmp/playwright-next-d8203215-1ca8-404f-9896-cf0b589a39de/server/chunks/ssr/[root-of-the-server]__12f-c3c._.js`:
  - the resolver is `a.s(["resolveSessionRuntimeMode",0,function(a){return"development"===a.NODE_ENV?"development":"production"!==a.NODE_ENV||"development"!==a.CSRM_ENVIRONMENT||"true"!==a.CSRM_DEV_IDENTITY?"unavailable":f(a)?"development":"unavailable"}],60936)`;
  - the adapter calls it as `function j(){return"development"===(0,e.resolveSessionRuntimeMode)(process.env)}`.
- **Literal checks are inlined in the same build:**
  - the proxy compiled to `{nonce:t,development:!1,https:"https:"===e.nextUrl.protocol}`;
  - the development-only message of `normalizeResponseParserError` ("did not match the expected CSRM contract") survives only in `.map` files, never in a `.js` chunk.

  Only the resolver's parameter read escapes the inlining.
- **The CLI keeps the value.** `apps/web/node_modules/next/dist/bin/next:71-84` warns with `NON_STANDARD_NODE_ENV` for `start` under `development`, then runs `process.env.NODE_ENV = process.env.NODE_ENV || defaultEnv`.
- **The tests encode the bypass or miss it:**
  - `development-runtime.test.ts:47-54` asserts it as intended: the session is available under `NODE_ENV=development` "regardless of every other variable", even with `CSRM_ENVIRONMENT=production` and `CSRM_DEV_IDENTITY=false`;
  - the unattested proof (`production-hardening.spec.ts:45-62, 128-194`) removes only the attestation variables, so no test exercises a production build with a development runtime `NODE_ENV`.

**Fix.** Key the `next dev` branch on the build-time constant. A production build then takes the attested path only, and only under a production runtime:

```ts
// apps/web/src/lib/auth/development-runtime.ts
/*
 * `process.env.NODE_ENV` written literally is replaced when Next compiles this module: it is
 * 'development' only in a `next dev` compilation and 'production' in every `next build`, whatever
 * NODE_ENV the server is later started with. Tests pass the compilation mode explicitly.
 */
export function resolveSessionRuntimeMode(
  env: NodeJS.ProcessEnv,
  compiledFor: string | undefined = process.env.NODE_ENV,
): SessionRuntimeMode {
  if (compiledFor === 'development') return env.NODE_ENV === 'development' ? 'development' : 'unavailable';
  if (compiledFor !== 'production' || env.NODE_ENV !== 'production') return 'unavailable';
  if (env.CSRM_ENVIRONMENT !== 'development') return 'unavailable';
  if (env.CSRM_DEV_IDENTITY !== 'true') return 'unavailable';
  return isAttestedE2eRuntime(env) ? 'development' : 'unavailable';
}
```

Then add three things:
1. A unit case: `resolveSessionRuntimeMode({ NODE_ENV: 'development', CSRM_ENVIRONMENT: 'development', CSRM_DEV_IDENTITY: 'true' }, 'production') === 'unavailable'`.
2. A hardening proof beside the unattested one: spawn the same build with `NODE_ENV=development`, both variables and no attestation. Assert the unavailable card, the `/app` redirect and no role cookie after a posted sign-in.
3. Corrected wording for R-08-03 and for `docs/security/web-headers.md` residual 4.

## Server scope: Warnings

### SR-02: The authorization matrix asserts allowed outcomes it never observes

**Severity:** WARNING
**File:** `apps/strapi/tests/authorization-matrix.integration.test.ts:135-152` and `:176`. The rows are in `apps/strapi/tests/fixtures/authorization-matrix.ts`:
- `:614-628` `POST /api/csrm-assessment-requests`;
- `:637-645` `PUT /api/csrm-assessment-requests/{id}`;
- `:646-655` `DELETE /api/csrm-assessment-requests/{id}`;
- `:912-920` `PATCH /api/v1/risk_assessments/{assessmentId}`;
- `:935-942` `POST /api/v1/risk_assessments/{assessmentId}/risks`.

**Issue.** `probe()` skips every expected 2xx unless the row sets `exercisesAllowed`. The citation guard then requires only that *some* `provenBy` title exists in *some* test file for the probe as a whole: `readFileSync(file).includes('test("<title>"')`. It never checks that the cited test exercises each actor the row claims is allowed. So D-16's "expected outcome for each actor" is asserted but not observed for these cells:

| Row | Actors whose success nothing observes | What the cited proof covers |
|---|---|---|
| `DELETE /api/csrm-assessment-requests/{id}` | service agent (204) | the owner and the human analyst |
| `PUT /api/csrm-assessment-requests/{id}` | service agent (200) | the owner and the analyst; its "missing grant" probe is the role-less `identities.analystAgent`, not `serviceAnalystAgent` |
| `PATCH /api/v1/risk_assessments/{assessmentId}` | service agent (200) | the human analyst only |
| `POST /api/v1/risk_assessments/{assessmentId}/risks` | service agent (201) | the human analyst only |
| `POST /api/csrm-assessment-requests` | other Requestor, analyst and service agent (200) | the owner only (`authorization.integration.test.ts` › "mounted POST derives requestor ownership and rejects PATCH") |

By contrast, the agent's 202 on `generate_assessment` is observed (`assessment-workflow.integration.test.ts:434-439`).

**Why it matters.** The claimed values match the catalogue: `role.security_analyst_agent` holds all five grants, as checked against `docs/references/idambox-csrm-role-function-api-catalogue.json`. The cells are plausible today, but they are unverified. A catalogue or policy change that silently removed the agent's or a Requestor's access would leave the matrix green. Denials are unaffected, because every non-2xx expectation is always issued.

**Fix.** Make provenance per actor, and prove it names that actor:

```ts
// fixtures/authorization-matrix.ts
provenBy?: Partial<Record<MatrixActor, readonly string[]>>;

// authorization-matrix.integration.test.ts: for every actor with an expected 2xx and no exercisesAllowed
const identityToken = { owner: 'identities.owner', other: 'identities.otherRequestor', analyst: 'identities.analyst', serviceAgent: 'identities.serviceAnalystAgent' }[actor];
// require probe.provenBy[actor], and require the cited test's body (not just the file) to contain identityToken
```

Alternatively, exercise the allowed mutations against throwaway records the row creates, as the Administration create rows could. At minimum, mark each unobserved cell as catalogue-derived.

### SR-03: The contract chain guard and the inventory's caller scan are blind to calls outside `*-service.ts` or through another receiver

**Severity:** WARNING
**File:**
- `apps/web/src/features/contract-operation-chain.test.ts:22`, `:49-54` and `:56-73`;
- `apps/strapi/tests/served-operations.integration.test.ts:239-268`.

**Issue.** Both scans read only feature `*-service.ts` modules and the transport directory, and only match `client\.(GET|POST|PUT|PATCH|DELETE)\(`, a receiver literally named `client`. Three kinds of call are invisible:
- a call from any other module, such as a server action, a page or a query helper;
- a call through another binding, such as `const strapi = await createStrapiClient(); strapi.GET('/applications')`;
- a destructured call, such as `const { GET } = client`.

None of these raises `NON_LITERAL_CLIENT_PATH`, `NOT_SERVED` or `NOT_CATALOGUED`, and the inventory's web-called set does not change.

**Why the types do not cover it.** The generated types reject undocumented paths but accept documented, unserved ones. The inventory lists 78 `specOnly` operations. `GET /applications`, the D-36 case that removed `listShellApplications`, still typechecks and would reach an unmounted route.

D-04 says the guard "fails when a new call bypasses the contract or targets an unserved operation". The defect is latent: every current importer of `createStrapiClient` is a `*-service.ts` module that binds `client`.

**Fix.** Pin who may hold the client, then scan every receiver it is bound to. In both scans:

```ts
it('lets only feature services and the transport reach the generated client', () => {
  const offenders = [resolve(webDir, 'src'), resolve(webDir, 'app')].flatMap(walk)
    .filter((file) => /\.tsx?$/.test(file) && !isTestFile(file))
    .filter((file) => /\bcreateStrapiClient\b|\bStrapiClient\b/.test(readFileSync(file, 'utf8')))
    .map(toPosix)
    .filter((file) => !file.endsWith('-service.ts') && !file.startsWith(`${TRANSPORT_DIRECTORY}/`));
  expect(offenders).toEqual([]);
});
// scanCalls: collect every identifier bound by `const <id> = await createStrapiClient()` and match `<id>.(GET|…)(`,
// failing on any `.GET(`-style call whose receiver is not such a binding.
```

A stronger alternative is to type `createStrapiClient()` over a `ServedPaths` subset generated from `served-operations.json`. An unserved call then fails `typecheck` wherever it is written.

### SR-04: `expectFocusVisible` passes for any control that carries a shadow at rest

**Severity:** WARNING
**File:** `apps/web/e2e/helpers/focus.ts:21-25`. The callers are at `apps/web/e2e/administration-workflow.spec.ts:183` and `:242`.

**Issue.** The helper accepts `outlineStyle !== 'none' || boxShadow !== 'none'` on the focused control, and never compares that with the control's unfocused state.

Primary and destructive buttons carry `shadow-button` at rest (`apps/web/src/components/ui/button.tsx:13-15`, `--shadow-button: 0 1px 2px …`), so their computed `box-shadow` is never `none`. The two Administration proofs, "Create Control" and "Create Information System", are both `buttonVariants()` primary links (`administration-workspace.tsx:225`). They would still pass if `focus-visible:ring-2` were removed.

An invisible outline declared as `2px solid transparent`, which is Tailwind's `outline-hidden`, would also count as visible.

This helper is the browser evidence for WCAG 2.4.7 in the D-25 conformance record.

**Fix.** Read the indicator before and after keyboard focus:

```ts
const indicator = (element: Element) => {
  const style = getComputedStyle(element);
  const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 && style.outlineColor !== 'rgba(0, 0, 0, 0)'
    ? `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}` : 'none';
  return { outline, shadow: style.boxShadow };
};
// `before`: after focusing the preceding stop; `after`: once Tab reaches the control
expect(after.outline !== 'none' && after.outline !== before.outline || after.shadow !== before.shadow).toBe(true);
```

## Server scope: Info

### SR-05: The proxy matcher's lookahead is unanchored, so some URLs render documents with no Content-Security-Policy

**Severity:** INFO
**File:** `apps/web/proxy.ts:44`; the test is `apps/web/src/lib/security/proxy.test.ts:81-86`.

**Issue.** In `'/((?!_next/static|_next/image|icon.png).*)'`, the dot in `icon.png` matches any character, and no alternative ends at a segment boundary. So `/iconXpng`, `/icon.png-x`, `/_next/staticfoo` and `/_next/imagery` all skip the proxy.

None of these URLs has a route, so each renders the root not-found per request. The request then carries no CSP header, so Next renders no nonce, and the response has no `Content-Security-Policy`, only the static headers.

The not-found copy is static, so there is no injection sink today. It is still a gap in D-19's "every response carries" the policy, and the matcher test covers only the intended exclusions. (The two `missing` prefetch conditions also yield CSP-less documents, but a victim's browser cannot be made to send those headers on a navigation.)

**Fix.** Use `source: '/((?!_next/static/|_next/image$|icon\\.png$).*)'`, then add `unstable_doesMiddlewareMatch` cases that expect `true` for `/iconXpng`, `/icon.png/x` and `/_next/staticfoo`.

### SR-06: The `sharp` override crosses `@strapi/upload`'s exact pin at a semver-0 breaking boundary, and the audit record overstates it

**Severity:** INFO
**File:** `pnpm-workspace.yaml:15`; `docs/security/dependency-audit-phase-08.md:5` and `:45`.

**Issue.** `@strapi/upload@5.51.0` pins `"sharp": "0.34.5"` exactly, and the override forces `0.35.4`.

- Under semver, a 0.x minor bump is a breaking range. That contradicts the record's scope line: "a compatible patched version exists in the same major".
- "Exercised by the Strapi suite" (line 45) holds only for loading. `@strapi/upload/dist/server/register.js` requires sharp at boot, but no test processes an image: the matrix's `POST /api/upload` sends no file and answers 400.

CSRM stores no uploads, so exposure is limited to the admin media library, but a break there would go unseen.

Also in the dependency diff: `vitest` (`apps/web/package.json`) and `turbo` (`package.json`) moved from exact pins to caret ranges, unlike the exact pins the manifests keep elsewhere. The lockfile governs `--frozen-lockfile` installs, but a lockfile refresh can now move them silently.

**Fix.**
- Record the crossing in the audit record, and add a residual row with the next `@strapi/*` upgrade as its trigger.
- Or add a harness smoke test that runs one small PNG through the upload plugin's `image-manipulation` service (`getDimensions`, `generateResponsiveFormats`).
- Re-pin `vitest` and `turbo` exactly, or record why a range is preferred.

### SR-07: Two environment switches silence the matrix and the inventory drift check

**Severity:** INFO
**File:**
- `apps/strapi/tests/authorization-matrix.integration.test.ts:55-66` and `:189-193`;
- `apps/strapi/tests/served-operations.integration.test.ts:656-662`.

**Issue.**
- **`AUTHORIZATION_MATRIX_OBSERVE=1`:** every status assertion becomes a recorded observation, and the `after` hook only prints the mismatches. All 116 matrix tests pass whatever Strapi answers.
- **`SERVED_OPERATIONS_WRITE=1`:** the drift test rewrites `docs/references/served-operations.json` from the running server and passes. Only invariant problems block the write. The web chain guard then agrees with whatever was mounted.

Either variable, exported in a developer shell, a CI environment or a `.env` loader, turns the suite's two central server guards into no-ops.

**Fix.**
- In observe mode, fail the `after` hook when `mismatches.length > 0`.
- Refuse both switches when `process.env.CI` is set.
- Have write mode end in a skip or failure ("inventory regenerated; re-run to verify") rather than a pass.

### SR-08: `validatedReturnTo` accepts control characters, giving an open redirect in the development sign-in (pre-existing)

**Severity:** INFO
**File:** `apps/web/src/lib/auth/return-to.ts:1-3`, unchanged in Phase 8. It is used by:
- `apps/web/src/lib/auth/development-session-adapter.ts:42-44`;
- `apps/web/app/sign-in/page.tsx` and `apps/web/app/sign-in/server-actions.ts:8-13`.

**Issue.** `'/\t/evil.example'` passes the validator: it starts with `/`, its second character is a tab rather than `/`, and it contains no backslash. The chain:
1. `/sign-in?returnTo=/%09/evil.example` puts the value into the hidden `returnTo` field.
2. "Continue as …" calls `redirect('/\t/evil.example')`.
3. Next sends the value verbatim, as `x-action-redirect`, or as `Location` for a no-JS post.
4. The client resolves it with `new URL(...)` (`next/dist/client/assign-location.js`). Per WHATWG that strips tab and newline, giving `https://evil.example/`.
5. `isExternalURL` then makes a hard navigation (`next/dist/client/components/router-reducer/reducers/server-action-reducer.js:248-253`).

This is reachable only where the development sign-in exists: `next dev`, the attested E2E runtime, and any production build affected by SR-01.

**Fix.**

```ts
export function validatedReturnTo(returnTo: string | null | undefined, fallback = '/app'): string {
  if (!returnTo?.startsWith('/') || /[\u0000-\u001F\u007F\\]/.test(returnTo)) return fallback;
  const base = 'http://csrm.invalid';
  const parsed = new URL(returnTo, base);
  return parsed.origin === base ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
}
```

### SR-09: The harness never removes its isolated database or production build

**Severity:** INFO
**File:** `apps/web/playwright.config.ts:39-43`

**Issue.** Only the attestation root is removed when the process exits. Each run leaves two artifacts behind:
- `apps/strapi/.tmp/playwright-e2e-<uuid>.db`, about 8.5 MB;
- `apps/web/.tmp/playwright-next-<uuid>`, a 128 MB production build.

This host holds 64 leftover E2E databases, 539 MB in total, each with the seeded fixture data. Git ignores them, so D-12 still holds, but disk use grows with every run.

**Fix.** Remove the run's `isolatedDatabaseFilename` (with its `-wal` and `-shm` files) and its `isolatedNextDistDir` when the run ends, unless a keep-artifacts switch is set. Use a `globalTeardown`, or a runner-only exit hook.

### SR-10: The derived server ports fall inside the operating systems' ephemeral port ranges

**Severity:** INFO
**File:** `apps/web/playwright.config.ts:58-60`; `apps/web/e2e/production-hardening.spec.ts:25-26`

**Issue.** Two derived ports sit inside ephemeral ranges:
- the web server, `40000 + pid % 10000`;
- the unattested server, `48000 + pid % 10000`.

Both lie inside Linux's default ephemeral range (32768–60999), and partly inside Windows' dynamic range (49152–65535). A loopback connection the run itself opened can hold the chosen port, so `listen` fails with `EADDRINUSE`, and the unattested proof then times out after 120 s. The two formulas also collide outright when `runnerPid % 10000 − workerPid % 10000 = 8000`.

**Fix.** Keep every derived port below 32768, in disjoint bands (for example 20000, 24000 and 28000 plus `pid % 4000`). Or bind port 0 and pass the chosen port on.

## Server scope: residual register cross-check

- **R-08-03 is recorded incorrectly.** Its compensating control does not hold when the runtime `NODE_ENV` is `development` (SR-01). Its acceptance should be revisited once SR-01 is fixed.
- **Checked and accurate as recorded:**
  - **R-08-01:** `disableUsersPermissionsRegistration` runs after the plugin bootstraps (`@strapi/core/dist/Strapi.js:400-404`), so the plugin cannot re-seed `allow_register`.
  - **R-08-10 and D-20:** `@strapi/core/dist/services/errors.js` has no environment branch, so the bare 500 envelope proven under `NODE_ENV=development` also holds in production.
  - **R-08-20:** request numbers are server-generated through `createWithAssessmentRequestNumber`.
  - **R-08-09:** per-request rendering is pinned by `proxy.test.ts:101-105`.
  - **R-08-17 and R-08-18:** the grandfather list (33 entries, count asserted, stale entries fail) and the root-reporting wrapper blind spot match the code.
- **Not re-reported:** every other R-08 row.

## Server scope: not verified

- **SR-01** was not reproduced by starting a server, because this review may not start one. The evidence is the compiled production chunk and the installed Next CLI source. The hardening proof proposed in its fix would demonstrate it on the next Playwright run.
- **SR-08's** end-to-end redirect was not observed in a browser. The chain is read from `return-to.ts` and the installed Next client sources.
- The full Strapi suite, the web suite and Playwright were not run in this unit.

## Web scope: summary

The shared primitives Phase 8 introduced are sound. No finding blocks the phase. Five warnings and six info items follow, and all five orchestrator items were checked.

**What was verified and holds:**

- **`useHorizontalOverflow`** (`horizontal-scroll-region.tsx:57-95`).
  - It measures in a layout effect, so the read forces layout and is exact.
  - One `ResizeObserver` watches the scroller, its first child and its table. The scroll listener is removed and the observer disconnected on cleanup, with the element captured once per subscription.
  - It re-subscribes only on the caller's deps. DataTable passes `[state]`, and its scroller mounts only in the populated state. The cross-tab passes `[scrollLabel]`, and the CSV regions mount once.
  - The second layout effect re-reads the sticky column width after the sticky classes render, which the first effect cannot see.
  - Server markup and the first client render agree (`data-overflow="false"`, no role, name or tab stop), so hydration is clean. React 19.2 no longer warns about layout effects during server rendering.
  - An observer callback's state update renders at default priority in a later task, so toggling the 1px hairline cannot produce a ResizeObserver loop.
- **`StatusBadge`.**
  - Each family table is exhaustive at compile time (`satisfies Record<Value, StatusPresentation>`).
  - Every badge carries an icon, a label and `data-tone`, so no status is shown by colour alone.
  - No status reuses a severity or urgency icon.
  - The one lookup of an unvalidated value, the request hub tile, is guarded by `isAssessmentStatus`.
  - The Risk detail's hard-coded `approved` is correct: Strapi's `parentLock` is `released` only for an approved assessment with approval facts (`apps/strapi/src/api/csrm-risk/services/risk-register.ts:113-119`).
- **The zod-free domain modules.**
  - `readRiskRegisterQuery` (`risk-domain.ts:79-105`) matches `riskRegisterQuerySchema` branch for branch:
    - trim and 200-character cap on `q`;
    - enum fallbacks;
    - opaque-id trim and regex;
    - `Number()` coercion of page and page size;
    - strict date refusal, arrays and empty strings included;
    - the reversed-range refusal.
  - The vocabularies moved into `assessment-domain.ts`, `administration-domain.ts`, `risk-domain.ts` and `report-periods.ts`. The schema modules import and re-export them, so each has exactly one owner. `assessment-service.test.ts:209,222` holds the writable-field lists to the input schemas.
  - The domain modules' imports from the schema modules are type-only. The zod walker below confirms none of them reaches zod.
- **The in-shell not-found and `recordRouteMetadata`.**
  - `notFound()` raised in `generateMetadata`, through the page's own read wrapped in React `cache()`, is the documented Next 16.3 path (`generate-metadata.md:197`).
  - `retry` on `global-error.tsx` is the stable 16.3 prop (`error.md:331`).
  - `force-dynamic` remains valid without Cache Components.
- **Print.**
  - The `@media print` class selectors match only the shell. Every `className` under `app/` and `src/` was checked for `header`, `sidebar`, `shell-footer`, `skip-link`, `mobile-trigger` and `sheet-*`.
  - The block adds no value.
  - `[data-print="hidden"]` marks controls only. `PageHeader`'s `display: contents` wrapper keeps the flex layout, and no call site passes both `status` and `action`, so the `space-between` header never gets three items.
- **Semantic tokens.** A scan of every added line in the 100 TS and TSX files finds no hex, px, rgb or arbitrary length. The only arbitrary utility added is the `xl:grid-cols-[2fr_1fr_1fr_1fr]` track ratio the UI-SPEC names.
- **Tests.**
  - The E2E region proofs compare `data-overflow` with the measured geometry before asserting either branch, so neither passes vacuously.
  - The print proof asserts computed layout.
  - The D-18 text check excludes only script, style and template content.
  - The one date-dependent assertion found is WR-01, and the one order-dependent coverage gap is WR-11.

**The orchestrator's five items:**

| Item | Verdict | Finding |
|---|---|---|
| 1. Equal-bounds date filter step | Holds | WR-01 |
| 2. "Draft assistance" empty state | Holds, but the branch is unreachable from any route | WR-06 |
| 3. zod default messages | Holds. The analyst assessment editor's Add Risk and Add mitigation control forms show zod defaults too, from the server | WR-04 |
| 4. Route titles for a nonexistent id | Holds, on four routes | WR-05 |
| 5. zod in the browser | No route violates the guard's own rule. One follow-up is a one-line import. R-08-32 names the wrong route | WR-07 |

**Found beyond the five items:**

- The Requestor's released-assessment list prints `Status: approved` in its filter chip (WR-02).
- The request-family tones contradict the X-5 rule the direction document now states (WR-03).

**Finding ids:** every finding uses the `WR-` prefix, as this run's config asks, and states its severity.

## Web scope: Warnings

### WR-01: The Risk Register journey's first filter step fails on four known dates

**Severity:** WARNING (test reliability). This is orchestrator item 1 and residual R-08-25, which is accepted only until 2026-11-24.
**File:** `apps/web/e2e/risk-register-workflow.spec.ts:314-318`

**Failure scenario:** the desktop pass reads the mutable Risk's target date. On a fresh database that is the seeded `2026-12-01` (`apps/strapi/src/bootstrap/seed-risk-register-workflow.ts:218`). The step then filters with equal bounds and asserts `1 result` and `toEqual([mutableRiskNumber])`. `seed-analyst-insights.ts:74-79` dates four Phase 7 Risks relative to the run day: `DUESOON` +7, `RELEASED` −12, `OVERDUE` −30 and `CLOSED` −40 days. On the run days below, one of them also has target date `2026-12-01`, so the register returns 2 results and the journey fails although the product is correct:

| Run day | Fixture Risk dated 2026-12-01 |
|---|---|
| 2026-11-24 | `DUESOON` (+7) |
| 2026-12-13 | `RELEASED` (−12) |
| 2026-12-31 | `OVERDUE` (−30) |
| 2027-01-10 | `CLOSED` (−40) |

`CLOSED` still matches, because the step sets no `state` filter.

**Why it matters:** the phase gate is a full run. A deterministic false red on a known calendar date is a scheduled failure, not a risk, and the first date is 59 days away. The mobile pass is unaffected, because it toggles between `2026-06-30` and `2026-07-31`, before the relative window. The composed-filter steps are unaffected too, because their other filters exclude the Phase 7 Risks.

**Fix:** assert what equal bounds guarantee rather than exclusivity. This keeps the later steps' `initialTotal` arithmetic intact:

```ts
await page.goto(`/app/risks?targetDateFrom=${currentMutableTargetDate}&targetDateTo=${currentMutableTargetDate}&unknown=discard-me&sort=targetDate%3Aasc&pageSize=25`);
const bounded = await visibleRiskNumbers(page, mobile);
expect(bounded, 'equal inclusive bounds include the stable dated Risk').toContain(mutableRiskNumber);
expect(await displayedResultTotal(page), 'the total is authoritative for the rows shown').toBe(new Set(bounded).size);
```

Alternatively, add `q=${mutableRiskNumber}` to that step (`q` matches `risk_number`, `risk-register.ts:335-339`), and clear it before the later `initialTotal` comparisons.

### WR-02: The Requestor's released-assessment list shows the raw stored value `approved` in its filter chip

**Severity:** WARNING (a D-27 and D-50 contract miss; it is user-facing and prints)
**File:** `apps/web/src/features/assessments/released-assessment.tsx:86`, rendered by `apps/web/src/components/csrm/data-table.tsx:263`

**Failure scenario:**

1. On `/app/assessments` the Requestor chooses the Status option **Released**. The option is labelled through `statusLabel` at line 93.
2. The URL becomes `?status=approved`, and `parseAssessmentCollectionQuery` keeps the stored enum value.
3. The chip row renders `Status: approved`.

The chip contradicts the option beside it and the glossary. `CONTEXT.md` says to avoid "Approved" as the label of an assessment's status. The chip also breaks UI-SPEC §3.3 ("Labels are what filter options, chips and cards render too") and X-5 ("feature code never chooses them"). Chips print (X-4), so a printed, filtered list reads `Status: approved`. A hand-typed `?status=closed` shows `Status: closed`.

**Evidence:**

- Line 86 is `[{ id: 'status', label: 'Status', value: query.status }]`.
- Every other list maps its chip through a label:
  - `request-table.tsx:108` uses `requestStatusPresentation[…].label`;
  - `alert-list.tsx:174` uses `alertKindLabels[…]`;
  - both questionnaire lists use `statusLabel`, which is 08-07 deviation 1, the same defect fixed there.
- `released-assessment.test.tsx:100` pins the option only, so no test covers the chip.

**Fix:**

```ts
...(query.status ? [{ id: 'status', label: 'Status', value: statusLabel('assessment', query.status) }] : []),
```

Add a unit case rendering `ReleasedAssessmentList` with `query={{ …, status: 'approved' }}` that asserts the chip reads `Status: Released`.

### WR-03: The request family's tones contradict the X-5 tone rule recorded in the direction document

**Severity:** WARNING (the shipped mapping violates the only value authority)
**File:** `apps/web/src/components/csrm/status-badge.tsx:56-57` (against `:76-77`); `docs/design/csrm-design-direction.md:360`

**Failure scenario:** X-5 states that "Tones mean one thing across every record type": info is work waiting on the Requestor, warning is work waiting on a Security Analyst, and success is submitted, approved or released. The mapping ships two request rows that break it:

| Status value | Label and icon | Tone shipped | Tone the X-5 wording gives | Compare |
|---|---|---|---|---|
| Request `submitted` | `Submitted`, `Send` | info | success ("submitted"), or warning (it waits on a Security Analyst) | Questionnaire `submitted` is success with `CircleCheck` |
| Request `draft` | `Draft`, `FilePenLine` | neutral | info (a draft is work in progress with the Requestor) | Questionnaire `draft` is info, with the same label and icon |

The Requestor dashboard shows the conflict directly (`requestor-dashboard.tsx:49-52`). The Draft requests card shows `Draft` neutral, and the Questionnaires in progress card shows `Draft` info: the same word, the same icon and a different tint.

**Evidence:**

- UI-SPEC §3.3 kept the request rows "unchanged from the shipped StatusBadge".
- X-5 was recorded with unqualified wording.
- `status-badge.test.tsx:44-51` pins the request tones.
- The spec and the direction document therefore disagree, and the code follows the spec.

**Fix:** choose one, record it, and keep the tests in step.

- **(a) Doc-only.** Add the request family to the X-5 bullet as a named exception, for example: "the request family keeps its Phase 06.x tones: draft neutral, submitted info".
- **(b) Re-tone.** Move request `draft` to info, and `submitted` to warning (or to success, per "submitted"). Update `status-badge.test.tsx` and any assertion of request tones.

### WR-04: Required-field validation shows zod's default English on every Administration form, and on two analyst editor forms

**Severity:** WARNING (user-facing error copy; the direction document's §4 Forms rule says a message states what is wrong and how to fix it). This is orchestrator item 3. It predates Phase 8 and is not a regression.
**Files:**

- **Administration forms (client):** `apps/web/src/features/administration/administration-form.tsx:113`, which uses `zodResolver` with the create schemas at `administration-schema.ts:124, 142-152, 176, 194`.
- **Add Risk (server):** `apps/web/src/features/assessments/risk-editor.tsx:126-130, 163-166`, with `assessment-schema.ts:261` and `assessment-actions.ts:97-110`.
- **Add mitigation control (server):** `apps/web/src/features/assessments/control-implementation-editor.tsx:121`, with `assessment-schema.ts:390`.

**Failure scenarios**, with the exact strings zod 4.4.3 produces for these schemas:

| Where | Action | Message shown |
|---|---|---|
| Administration create and edit, all four collections (edit also validates with the create schema) | Clear `Name`, `Control number` or `Framework` | `Too small: expected string to have >=1 characters` |
| Same | Exceed a 255 cap | `Too big: expected string to have <=255 characters` |
| A Control's optional `Control reference`, `Framework version` or `Framework source` | Enter only spaces. `optionalControlText` is `.trim().min(1)…nullable()`, and the field's `onChange` keeps `'  '` because `'  ' \|\| null` is `'  '` | `Too small: …`, on an optional field |
| Analyst assessment editor, **Add Risk** | Save with an empty Risk statement. The form maps `''` to `null`, and `createRiskAction` fails `riskCreateInputSchema.riskStatement` | `Invalid input: expected string, received null` under *Risk statement* |
| Analyst assessment editor, **Add mitigation control** | Save with no Control selected. The select has no `required` rule | `Invalid input: expected string, received null` under *Reusable control* |

The last row differs from the same control on the Risk detail, where `mitigation-control-list.tsx:192` shows `Select a reusable Control.`

**Not affected:**

- the request form, where the title reads `Enter a request title.`;
- the questionnaire renderer, whose custom required copy is at `questionnaire-renderer.tsx:94, 100`;
- the governance question form, where Save is disabled while the text is empty.

**Evidence:** `node` against the installed zod printed `["Too small: expected string to have >=1 characters","Invalid input: expected string, received null","Too small: expected string to have >=1 characters","Too big: expected string to have <=255 characters"]` for exactly these schema shapes. The server actions forward `issue.message` verbatim: `assessment-actions.ts:109`, `risk-actions.ts:101` and `administration-actions.ts:130`.

**Fix:**

1. Give each required bound its own message, for example `z.string().trim().min(1, 'Enter a name.').max(255, 'Use 255 characters or fewer.')`.
2. Map whitespace-only optional Control text to `null` in `onChange`, as the Risk Type description already does (`event.target.value.trim() ? event.target.value : null`).
3. Add `register` rules to the analyst editors, as `mitigation-control-list.tsx:192` does: `required: 'Enter a Risk statement.'` and `required: 'Select a reusable Control.'`.
4. Optionally, add one project-wide zod error map (`z.config({ customError })`) as a backstop, so no default English reaches the UI.

### WR-05: Four detail routes keep their own title over `Page not found` for an id that does not exist

**Severity:** WARNING (WCAG 2.4.2 on a reachable path). This is orchestrator item 4 and residual R-08-16, which routes the decision to this review.
**Files:** `apps/web/app/(app)/app/review/questionnaires/[documentId]/page.tsx:11,31`; `.../review/requests/[documentId]/page.tsx:9,15`; `.../review/assessments/[documentId]/page.tsx:19,24`; `.../questionnaires/[documentId]/page.tsx:11,31`. These files are unchanged in Phase 8, and the item names them.

**Failure scenario:**

1. A Security Analyst opens a stale or mistyped review URL.
2. Strapi answers 404.
3. The page raises `notFound()` after the shell has streamed (each route sits under the `(app)/app` loading boundary, and the request review wraps its content in `Suspense`).
4. The page shows `Page not found`, but the tab title and the screen-reader page announcement stay the route's own, for example `Questionnaire Review | IdamBox CSRM`.

This is exactly the defect 08-12 fixed on the released-assessment route.

For `/app/questionnaires/{id}`, a Requestor's read of an unknown id is refused 403 by the ownership check (`apps/strapi/src/policies/csrm-authorization.ts:372-374`), so a Requestor sees a truthful `Questionnaire unavailable`. An actor holding the explicit analyst grant for that operation skips the ownership check and reaches the 404.

**Acceptance:** R-08-16's reasoning holds for disclosure: no IDOR, and refusals are 403 permission states with truthful titles. The title defect itself remains, and the helper that fixes it already exists and is proven.

**Fix** (per route; four lines, mirroring `app/(app)/app/assessments/[documentId]/page.tsx`):

```ts
const readQuestionnaire = cache(getQuestionnaire);
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return recordRouteMetadata(readQuestionnaire((await params).documentId), 'Questionnaire Review | IdamBox CSRM');
}
// …and use readQuestionnaire in the page.
```

Add one case per route in the style of `released-assessment-route.test.ts`.

## Web scope: Info

### WR-06: The analyst request review's empty-state copy still says "Draft assistance", on a branch no route reaches

**Severity:** INFO (orchestrator item 2)
**File:** `apps/web/src/features/assessments/assessment-detail.tsx:47` (with `:59` and `:80`)

**Details:** the string holds as reported: "Draft assistance can begin only after the linked questionnaire is submitted." It sits beside a card that now says "draft generation". It names no provider, so D-08's rule is met, but the vocabulary is retired. The branch is unreachable in production:

- The only caller, `app/(app)/app/review/requests/[documentId]/page.tsx:15-34`, passes `populated`, `permission` or `error`, and calls `notFound()` for a missing record.
- `empty` arises only from `state="populated"` with no request (line 59).
- No test renders it.

The precondition the string describes is also not enforced in the live view:

- The draft card renders whenever the questionnaire is available (line 80).
- Its new description says "from the submitted questionnaire".
- On a released but unsubmitted questionnaire, `Generate assessment draft` is enabled. Pressing it returns Strapi's 409 `CSRM questionnaire is not submitted.` (`apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts:661`), announced as "Draft generation could not be started".

**Fix:** change the string to `Draft generation can begin only after the linked questionnaire is submitted.`, or remove the dead branch. As a UI-review decision, consider gating `AssessmentDraftJob` on the relationship's `state === 'submitted'` (the projection carries `state`) and showing that sentence in the card's place otherwise.

### WR-07: zod in the browser outside the key routes — follow-ups only, and R-08-32 names the wrong route

**Severity:** INFO (orchestrator item 5; performance is outside this review's correctness scope)
**File:** `apps/web/src/features/requests/request-hub.tsx:1`; `docs/security/phase-08-residual-risks.md` R-08-32

**Decision:** none of these routes violates the guard's own rule. `zod-client-boundary.test.ts` covers the nine key routes plus the questionnaire exception, and all of them pass. Every other route is a follow-up.

**Evidence:** the guard's walker was replicated verbatim in a scratch script and run over every page at HEAD, and at `a9394cf` through `git archive`:

| Route | At HEAD | Chain and remedy |
|---|---|---|
| `/app/alerts` | zod | `alert-list → alert-schema → risk-schema → administration-schema`. Predates Phase 8 |
| `/app/questionnaires`, `/app/review/questionnaires` | zod | `questionnaire-list` and `questionnaire-review-list` → `questionnaire-domain.ts`, which imports zod for `assessmentRequestRelationshipSchema`. Predates Phase 8 |
| `/app/review/questionnaires/[documentId]` (the governance view) | zod | Through `questionnaire-renderer.tsx`'s top-level imports. The read-only mode used there validates nothing |
| `/app/review/requests/[documentId]` (analyst request review) | zod, one chain | `assessment-detail.tsx → request-hub.tsx → assessment-schema.ts`, introduced by 08-07 (`2d44774`) when `request-hub` switched to `assessmentStatuses` from `assessment-schema.ts`. The route's pre-Phase-8 chain, through `review/requests/loading.tsx → assessment-list.tsx`, was removed by 08-13, and 08-13 also moved `assessmentStatuses` into `assessment-domain.ts`. A one-line import change makes the route zod-free |
| `/app/assessments/[documentId]` (the Requestor's released assessment) | no zod | No chain at `a9394cf` or at HEAD |

R-08-32 cites "the Requestor's released assessment" as a route carrying zod. The walker contradicts that; the route it means is the analyst request review.

**Fix:**

```ts
// request-hub.tsx
import { assessmentStatuses } from '@/features/assessments/assessment-domain';
import type { AssessmentStatus } from '@/features/assessments/assessment-schema';
```

Then:

- add `['/app/review/requests/{documentId}', '(app)/app/review/requests/[documentId]']` to `routesWithoutClientValidation`;
- correct R-08-32's route list.

The alerts and questionnaire moves remain follow-ups.

### WR-08: The CSV import row-state badges choose their own label, tone and icon; Ambiguous reuses the High-severity triangle

**Severity:** INFO
**File:** `apps/web/src/features/administration/csv-import-flow.tsx:36-44` (rendered at `:184-185, 203-204`)

**Details:** X-5 says "One shared mapping owns every status value's label, tone and icon; feature code never chooses them". The five row states (Create, Update, Unchanged, Rejected, Ambiguous) break it in three ways:

- They keep a local label, variant and icon map.
- `ambiguous` uses `TriangleAlert`, the High severity shape that UI-SPEC §3.3 removed from `Overdue` for exactly that collision.
- `rejected` is danger, which X-5 reserves for "a recorded overdue state".

The icon is also sized `mr-1 size-3` in the table but default-sized on cards. Meaning never depends on colour: icon and text are always present. UI-SPEC §3.4 and §3.5 neither list nor exclude these states.

**Fix:** either add an import-row family to `statusPresentation`, with X-5 tones and a non-severity icon for Ambiguous, and render it through `StatusBadge`; or record the row states in §3.5 as not a status.

### WR-09: `BrandLockup` uses `next/image`'s `priority`, deprecated since Next 16

**Severity:** INFO
**File:** `apps/web/src/components/shell/wordmark.tsx:12`

**Details:** the installed docs say "Starting with Next.js 16, the `priority` property has been deprecated in favor of the `preload` property" (`02-components/image.md:291-293`). Phase 8 adds two more renderers of the lockup: the root `not-found.tsx` and `global-error.tsx`.

**Fix:** replace `priority` with `preload`, or with the docs' preferred `loading="eager"` or `fetchPriority="high"`.

### WR-10: The Risk Register loading state reads a repeated query parameter differently from the page

**Severity:** INFO (pre-existing and transient; the new comments claim exact parity)
**File:** `apps/web/src/features/risks/risk-register-loading.tsx:28`

**Details:**

- `Object.fromEntries(searchParams.entries())` keeps the **last** value of a repeated key.
- The page parses Next's `searchParams`, which gives an array, and keeps the **first** (`risk-schema.ts:29`, `firstValue`).
- So `?treatmentStatus=Complete&treatmentStatus=Overdue` draws a skeleton with Overdue selected, then the page selects Complete.
- `risk-domain.ts:74-78` and the loading comment say the two read the URL exactly alike. `risk-domain.test.ts` feeds arrays directly, so it never exercises this input path.

**Fix:** build the same shape Next passes: a string for a single value and an array only for a repeated key. An array for every key would make `targetDate()` refuse every date.

```ts
const input: Record<string, string | string[]> = {};
for (const key of new Set(searchParams.keys())) {
  const all = searchParams.getAll(key);
  input[key] = all.length === 1 ? all[0]! : all;
}
```

### WR-11: The accessibility sweep's governed-questionnaire scans depend on file order to see the state they are meant to scan

**Severity:** INFO (test soundness: order-dependent coverage)
**File:** `apps/web/e2e/accessibility.spec.ts:261-270`

**Details:** the "analyst questionnaire review" scan is meant to cover the D-32 analyst-review surface: the single question list and the `Analyst review` badge. Its guard, `shows(page, 'its originating request', …)`, holds in any state. Two things make the coverage order-dependent:

- `questionnaire-governance-workflow.spec.ts` ends by releasing that same fixture (lines 181-182).
- The sweep scans the analyst-review state only because `accessibility.spec.ts` sorts first under `workers: 1` and `fullyParallel: false`.

If the order changes (a renamed file, a partial or re-ordered run, a new spec sorting earlier that releases it), the scan silently covers the released state, and the D-32 surface goes unscanned without failing. The same applies to `releasedQuestionnaireTitle`, which `questionnaire-workflow.spec.ts` submits.

**Fix:** make the guards state-specific, so a changed order fails loudly:

```ts
shows(page, 'the analyst review state', (current) => current.getByRole('main').getByRole('button', { name: 'Release questionnaire', exact: true }))
```

Do the same with an awaiting-submission marker for the second scan.

## Web scope: verification performed

- **Reading:** `git diff a9394cf..HEAD` for each of the 103 files, with the surrounding code and callers. Unchanged callers were also read: the four detail routes in WR-05, the questionnaire service, and the Strapi policy and workflow modules cited above.
- **Zod walker:** a scratch replica of the `zod-client-boundary.test.ts` walker was run over every `page.tsx` at HEAD, and at `a9394cf` extracted with `git archive`. Results are in WR-07. It ran from the session scratchpad, and no repository file changed.
- **Zod messages:** a `node` evaluation of zod 4.4.3's default messages for the WR-04 schema shapes (output quoted there).
- **Docs:** the installed Next 16.3 docs were checked for `global-error` `retry`, `notFound()` in `generateMetadata`, streamed not-found status, route segment `dynamic` without Cache Components, and `next/image` `priority`.
- **Not run:** no vitest, Playwright, Strapi suite or dev server. `git status --porcelain` was empty before this report was written.

---

_Reviewed: 2026-09-26T05:13:55Z (server scope), 2026-09-26T05:15:12Z (web scope)_
_Reviewer: gsd-code-reviewer, server and web scopes_
_Depth: deep_
