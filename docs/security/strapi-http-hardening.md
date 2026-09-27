# Strapi HTTP hardening (Phase 8)

- **Date:** 2026-09-25; the CORS section was revised on 2026-09-26 after the phase security audit (R-08-11)
- **Scope:** the HTTP surface of the Strapi API process (`apps/strapi`, Strapi 5.51.0). The admin panel is out of scope (Phase 8 decision D-39); the web application's headers are D-19, recorded by plan 08-10 in `docs/security/web-headers.md`.
- **Decisions:** D-20 (review the security middleware; prove the safe error envelope) and D-39 (remove `strapi::poweredBy`; keep `strapi::security` at its defaults, each documented with its reason). D-39 names the phase security record; this document is its Strapi section.
- **Threats:** T-08-05-03 (stack or internal message in a 500), T-08-05-04 (`X-Powered-By`), T-08-05-05 (sensitive data in server logs), T-08-05-08 (clickjacking of API responses, accepted).
- **Evidence:** every header value below was observed on a mounted Strapi through the integration test harness (`apps/strapi/tests/helpers/strapi-http-harness.ts`) after the change, on a 200, a 403, a 401, a 404 and a forced 500; the proofs are named under each section.

## Middleware order as configured

`apps/strapi/config/middlewares.ts`, outermost first:

| # | Middleware | Role here |
|---|------------|-----------|
| 1 | `strapi::logger` | Writes one `http` line per request: method, URL with its query string, duration, status (see Logging review). |
| 2 | `strapi::errors` | Turns every thrown error into the JSON error envelope (see Error envelope). Everything below it is covered. |
| 3 | `global::csrm-development-identity` | Development only (`NODE_ENV=development` and `CSRM_DEV_IDENTITY=true`): resolves `x-csrm-dev-identity` to an active IdamBox User and sets `ctx.state.idamboxUser`; inert in every other runtime. INT-02 (deferred) replaces it. |
| 4 | `strapi::security` | koa-helmet 7.1.0 over helmet 6.2.0, Strapi's defaults (table below). |
| 5 | `strapi::cors` | `@koa/cors`, granting only the origins listed in `CSRM_CORS_ALLOWED_ORIGINS`, none by default (see CORS). |
| 6 | `strapi::query` | Parses the query string. |
| 7 | `strapi::body` | koa-body 6.0.1 with the limits below (see Body limits). |
| 8 | `strapi::session` | koa-session: signed, `httpOnly`, `secure` when `NODE_ENV=production`. The CSRM routes authenticate with the API token and never read it. |
| 9 | `strapi::favicon` | Serves the favicon. |
| 10 | `strapi::public` | Serves `apps/strapi/public`: `robots.txt` and the local upload directory, which is empty (CSRM stores no uploads; file-upload questions are deferred). |

`strapi::poweredBy` was the sixth entry until this plan and is removed (see X-Powered-By).

## `strapi::security` settings, observed headers and reasons

Strapi 5.51.0 passes this configuration to helmet (`@strapi/core/dist/middlewares/security.js`); CSRM sets no override, so every row is a default kept on purpose. helmet's own defaults fill in the rows Strapi does not name.

| Setting | Value | Observed header | Reason it is kept |
|---------|-------|-----------------|-------------------|
| `contentSecurityPolicy` | helmet defaults (`useDefaults: true`) plus Strapi's `CSP_DEFAULTS` for `connect-src`, `img-src` and `media-src`, with `upgradeInsecureRequests: null` | `connect-src 'self' https:;img-src 'self' data: blob: https://market-assets.strapi.io;media-src 'self' data: blob:;default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline'` | API responses are JSON and are never rendered as a document, so the policy only matters for the admin panel. Strapi's additions are admin-panel sources (the `market-assets.strapi.io` images); dropping `upgrade-insecure-requests` keeps the HTTP development and test origins working. Tightening it is admin-panel work, out of scope (D-39). |
| `frameguard` | `{ action: 'sameorigin' }` | `X-Frame-Options: SAMEORIGIN` | D-39: `deny` would also forbid the admin panel framing itself, and that compatibility is unverified and out of scope. No page frames the API, and the CSP's `frame-ancestors 'self'` states the same rule (T-08-05-08, accepted). |
| `hsts` | `{ maxAge: 31536000, includeSubDomains: true }` | `Strict-Transport-Security: max-age=31536000; includeSubDomains` | One year, no `preload`: preloading is hard to undo for the operator (D-42 takes the same line for the web). Browsers ignore the header on plain HTTP, so it takes effect only when a production deployment terminates TLS in front of Strapi; that is the recorded TLS assumption. |
| `crossOriginOpenerPolicy` | `false` | absent | D-39: COOP isolates a browsing context, which only a page has (the admin panel, unverified, out of scope). A JSON response opens no window. |
| `crossOriginEmbedderPolicy` | `false` | absent | COEP would require every admin-panel subresource to opt in; unverified and out of scope. It has no effect on JSON. |
| `crossOriginResourcePolicy` | `false` | absent | CORP stops other origins loading a response as a no-cors resource. A no-cors request cannot carry the bearer token, so such a load is refused (401 or 403) before any record is read. Kept at Strapi's default because it also governs the admin panel's and the upload provider's public files. |
| `originAgentCluster` | `false` | absent | A page-level hint for the admin panel only. |
| `xssFilter` | `false` | absent | The header only controlled the legacy XSS auditor, which current browsers no longer ship. helmet's own default sends `X-XSS-Protection: 0`, and OWASP's guidance is to send `0` or nothing, so absence is equivalent. For a JSON API the controls that matter are `nosniff` and the declared content type. |
| `referrerPolicy` (helmet default) | `no-referrer` | `Referrer-Policy: no-referrer` | The strictest value; the API emits no links. |
| `xContentTypeOptions` (helmet default) | on | `X-Content-Type-Options: nosniff` | Stops a browser reinterpreting a JSON body as script or HTML. |
| `xDnsPrefetchControl` (helmet default) | off | `X-DNS-Prefetch-Control: off` | Harmless default. |
| `xDownloadOptions` (helmet default) | on | `X-Download-Options: noopen` | Harmless legacy default. |
| `xPermittedCrossDomainPolicies` (helmet default) | `none` | `X-Permitted-Cross-Domain-Policies: none` | Harmless legacy default. |
| `xPoweredBy` (helmet default) | on | removes `X-Powered-By` | helmet removes the header before the request reaches the inner middlewares, so it could never stop `strapi::poweredBy`, which set it again after the response was built. |

The proof is `apps/strapi/tests/http-hardening.integration.test.ts` › "every response carries helmet's headers and never X-Powered-By": on a 200, a 403 and a forced 500 it asserts `X-Frame-Options: SAMEORIGIN`, the HSTS value above, `nosniff`, `no-referrer`, a CSP with `default-src 'self'` and `frame-ancestors 'self'` and without `upgrade-insecure-requests`, and the absence of COOP, COEP, CORP, `Origin-Agent-Cluster`, `X-XSS-Protection` and `X-Powered-By`. A change to any default fails it.

## X-Powered-By (D-39, ASVS V14.3.3)

- **Before:** `strapi::poweredBy` (`@strapi/core/dist/middlewares/powered-by.js`) set `X-Powered-By: Strapi <strapi.io>` after the inner middlewares returned, so it rode on every response that completed without a thrown error. It was observed on a 200, a 401 and a 404; a thrown policy 403 or 500 skipped it, and so did a CORS preflight. The RED run of `http-hardening.integration.test.ts` failed on the 200 (`X_POWERED_BY_SENT_200`, commit `62accfb`).
- **After:** the entry is removed from `apps/strapi/config/middlewares.ts`. Nothing else sets the header (Koa sets none): the same test observes it absent on a 200, a 403 and a 500, and a probe through the same harness during this review saw it absent on a 401, a 404 and a preflight as well.

## Error envelope (D-20, ASVS V7.4.1)

`strapi::errors` (`@strapi/core/dist/middlewares/errors.js` with `dist/services/errors.js`) decides what a client sees, the same in every `NODE_ENV`:

- an `ApplicationError` (from `@strapi/utils`) answers `{ data: null, error: { status, name, message, details } }` with its mapped status: 400 by default, 401 for `UnauthorizedError`, 403 for `ForbiddenError` and its `PolicyError` subclass, 404 for `NotFoundError`, and 413, 429 or 501 for the others. Observed: a policy denial answers `403 PolicyError "Policy Failed"`, a missing or invalid token `401 UnauthorizedError "Missing or invalid credentials"`;
- an `HttpError` (http-errors, which Strapi's response helpers such as `ctx.notFound()` also produce) answers its own status, name and message. Observed: a request no handler answers becomes `404 NotFoundError "Not Found"`;
- anything else is logged in full on the server (`strapi.log.error(error)`) and answered as exactly `{ data: null, error: { status: 500, name: "InternalServerError", message: "Internal Server Error" } }`: no stack, no internal message, no `details`. The one exception is an error that carries its own `status` below 500, as the body parser's size errors do: `formatInternalError` passes it through http-errors, which keeps its status and message because a 4xx is exposable.

A handler's deliberate 4xx answer carries the message the handler chose. The hardening concern here is the unexpected error, which never reaches a client in any form but the envelope above.

Proofs:

- `apps/strapi/tests/http-hardening.integration.test.ts` › "a forced internal error answers the bare 500 envelope with no stack and no internal message". The harness installs a test-only middleware (D-38) inside `strapi::errors` that throws a plain `Error` carrying an internal detail for a request with `x-csrm-test-internal-error: 1`; the body deep-equals the envelope, carries no `stack` key at any depth and matches none of `injected`, `SQL` or a `file.js:line` frame. Without the header the same route answers 200, so the middleware is inert. Nothing test-only exists under `apps/strapi/src`.
- Same file › "a production error path answers the same bare envelope without test-only plumbing": the email plugin's send handler, given an empty body, throws inside a production code path and answers the identical envelope, with no provider detail.
- `apps/strapi/tests/assessment-workflow.integration.test.ts` › "mounted explicit release is readiness-gated, atomic, and concurrent-safe": the injected failure of the release's second write answers the exact envelope (`FAILED_RELEASE_ENVELOPE_NOT_BARE`) and the release is rolled back.

## Body limits (ASVS V12.1.1)

`strapi::body` (koa-body 6.0.1) bounds every request body before any handler runs:

| Body | Limit | Source |
|------|-------|--------|
| JSON | 1 MB | koa-body default (`jsonLimit`) |
| Text | 56 KB | koa-body default (`textLimit`) |
| URL-encoded form | 6 MB | `formLimit: '6mb'` |
| One multipart file | 50 MB (52,428,800 bytes) | `formidable.maxFileSize`; an oversize file is answered 413 |
| All multipart files | 250 MB (262,144,000 bytes) | `formidable.maxTotalFileSize` |

The CSV import routes, CSRM's only multipart consumers, enforce a tighter bound of their own: at most 5,242,880 bytes (5 MB), 5,000 rows and 65,536 bytes per record (`apps/strapi/src/api/csrm-administration/services/csv-import.ts`), answering 413 `IMPORT_LIMIT_EXCEEDED` above the byte limit. The upload plugin's `POST /api/upload` is the other multipart route; CSRM does not use it, and the authorization matrix records that only the API token reaches it.

## CORS (restricted by default; R-08-11)

### Before

`strapi::cors` ran with Strapi's defaults (`@strapi/core/dist/middlewares/cors.js`):
- any request `Origin` was echoed in `Access-Control-Allow-Origin`, together with `Access-Control-Allow-Credentials: true`;
- a preflight allowed `GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS` and the headers `Content-Type, Authorization, Origin, Accept`, cached for a year.

This review observed all of it for `Origin: https://untrusted.example`, and first recorded it as not exploitable. That reasoning covered the CSRM content API only:
- browsers never call Strapi, because the web's transport is server-only and holds the API token;
- every CSRM route requires that bearer token, which a cross-origin page cannot obtain and a browser never attaches by itself;
- `x-csrm-dev-identity` is not an allowed CORS request header.

The phase security audit found what it missed. The same policy governs the admin panel:
- `POST /admin/access-token` has `auth: false`. It answers a fresh admin access token in its JSON body to anyone who presents the `strapi_admin_refresh` cookie.
- That cookie is `httpOnly` and `SameSite=Lax` (`@strapi/admin` 5.51.0 `shared/utils/session-auth.js`).
- The audit's read-only preflight on the dev Strapi echoed two foreign origins with credentials.

`SameSite=Lax` stops a cross-site page, but not a same-site one: another `localhost` port in development, or a sibling subdomain in production. Such a page could read an admin token from a browser signed in to the admin panel (ASVS V14.5.3).

### Now

No browser needs cross-origin access to Strapi. The web calls it server-side. The admin panel is served from Strapi's own origin, in development too, where `strapi develop` runs Vite as middleware on Strapi's own HTTP server.

So `config/middlewares.ts` configures `strapi::cors` with an explicit origin list. The list is read from `CSRM_CORS_ALLOWED_ORIGINS` by `src/utils/cors-allowed-origins.ts`, and `apps/strapi/.env.example` documents the variable with an empty default. Every other `strapi::cors` setting keeps Strapi's default.

| Request | Answer |
|---------|--------|
| No `Origin` header: the web's server-side calls, tools, same-origin navigations | Unchanged. As before, Strapi answers such a request with an empty `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`: its origin matcher returns `*` before it reads the list, and `@koa/cors` then substitutes the empty request origin because credentials are on. An empty value matches no origin, and a browser always sends `Origin` on a cross-origin request, so this grants nothing. |
| An `Origin` the list does not name, including a same-origin admin-panel request | No `Access-Control-Allow-*` header at all: the middleware passes the request on untouched. A preflight gets no grant, so a browser never sends the credentialed request. A same-origin request needs no grant and is answered as before. |
| An `Origin` the list names exactly | Strapi's grant: that origin in `Access-Control-Allow-Origin`, with credentials, the methods and the headers above. |

An empty list grants no origin, and it is the default. The list is always an array: Strapi reads an undefined `origin` as a wildcard, so the configuration never passes one.

Each comma-separated entry must be an exact `http` or `https` origin. It is normalised as browsers send it: lower-case host, default port dropped, no trailing slash. A wildcard, `null`, a path, a query, a fragment or credentials stop the boot, and the error names the entry by position without echoing it. A mistake therefore fails loudly instead of re-opening access.

Listing an origin is an operator decision, recorded as residual R-08-11. A listed origin is granted credentialed reads of every route, the admin access-token route included. That is what an admin panel served from another origin would need, so list only an origin trusted as much as the admin panel.

### Proofs

- `apps/strapi/tests/http-hardening.integration.test.ts`, the default:
  - › "a foreign origin is granted no cross-origin read of the content API or the admin access-token route". It checks an `/api` read (200), `POST /admin/access-token` (401 without the refresh cookie) and a preflight to each. None carries `Access-Control-Allow-Origin`, `-Credentials`, `-Methods` or `-Headers`.
  - › "the admin panel's same-origin requests are answered exactly as before". `GET /admin/init` and `POST /admin/access-token` return the same status and body whether or not they carry Strapi's own origin.
- `apps/strapi/tests/cors-allowlist.integration.test.ts`, a harness booted with two origins, written with the spacing and trailing slash an operator might use:
  - each listed origin is granted on an `/api` read and on the access-token preflight (204, credentials, `POST` allowed, `Vary: Origin`);
  - these are granted nothing: a foreign origin, the `http` scheme, another port, a subdomain, a suffix lookalike and `null`.
- `apps/strapi/tests/cors-allowed-origins.unit.test.ts` covers the parser's normalisation and refusals.
- The test harness pins `CSRM_CORS_ALLOWED_ORIGINS`, empty unless a test sets it, so a developer's `.env` never reaches a test.

Before the change, two tests failed on the echoed origin:
- the default-deny test, with `CORS_GRANTED_CONTENT_API_access-control-allow-origin: https://untrusted.example`;
- the lookalike test, with `UNLISTED_READ_GRANTED_https://untrusted.example_access-control-allow-origin`.

The same-origin and listed-origin tests passed before and after, as they should: they guard what must keep working.

## Unmounted paths (recorded)

Observed by plan 08-03 on the mounted Strapi and recorded in its summary: any `/api` path that no router mounts answers a `GET` with `404 NotFoundError "Not Found"`, a mutation with `405` and `Allow: HEAD, GET`, and `OPTIONS` with 200. That is koa's generic `allowedMethods` answer under Strapi's default middleware stack. `served-operations.integration.test.ts` asserts 404 or 405 for a mutation on each removed base. The answer says nothing about which routes exist, because every unmounted path answers the same way, so it is recorded rather than changed. A test that expects 404 for every method on a removed route asserts the wrong thing.

## Plugin routes the API token reaches (recorded)

`apps/strapi/tests/authorization-matrix.integration.test.ts` states an outcome for every route the users-permissions, upload, email, i18n and content-type-builder plugins keep mounted. A caller without the token is refused everywhere except the public users-permissions authentication routes, which refuse every request because no account exists. The full-access token holder can list, create (201) and delete users-permissions accounts, create users-permissions roles, and reach the email and upload handlers. This is the D-37 residual: the token never leaves the web server, and INT-02 replaces this surface.

## Logging review

T-08-R10 and T-08-05-05, ASVS V7.1.1 and V7.1.2. Swept on 2026-09-25 with `grep -rn "strapi.log" apps/strapi/src` (and `console.*`, which has no hit). The sweep found thirteen call sites:

| Call site | Level | What it writes | Request body, token or personal data? |
|-----------|-------|----------------|---------------------------------------|
| `bootstrap/disable-users-permissions-registration.ts:21` | info | constant | none |
| `bootstrap/reconcile-development-public-permissions.ts:61` | info | constant | none |
| `bootstrap/seed-analyst-insights.ts:323` | info | constant plus the fixture date | none |
| `bootstrap/seed-assessment-navigation-lifecycle.ts:131` | info | constant | none |
| `bootstrap/seed-assessment-workflow.ts:79` | info | constant | none |
| `bootstrap/seed-core-data.ts:75` | info | constant | none |
| `bootstrap/seed-csrm-data.ts:369` | info | constant plus control seed counts | none |
| `bootstrap/seed-csrm-data.ts:666` | info | constant | none |
| `bootstrap/seed-questionnaire-workflow.ts:395` | info | constant plus three fixture questionnaire numbers | none (seed identifiers) |
| `bootstrap/seed-risk-register-workflow.ts:252` | info | constant plus the fixture Risk number | none (seed identifier) |
| `bootstrap/seed-risk-register-workflow.ts:266` | info | constant plus the fixture Risk number | none (seed identifier) |
| `middlewares/csrm-development-identity.ts:47` | warn | constant "CSRM development identity lookup failed closed." (never the header value or the error) | none |
| `csrm/openai-compatible-client.ts:27` (`logCompletionDiagnostic`, called at `:72`, `:94` and `:118` and from `api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider.ts:115`) | info | **only when `CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS=true`** (default `false`): the system and user prompts, the model's raw response, and provider error metadata (status, request id, provider message) | **Yes when enabled:** the prompts carry request and questionnaire content, which can include personal data. Never the API key, headers or endpoint credentials. |

The last row is an operator-requested diagnostic (quick task 260917-kel), off by default. This plan does not change it, because `CSRM_AI_*` behaviour is outside its scope. It must stay off in production. Refusing the flag outside development, or redacting the transcript, is recorded in the phase's deferred items for the residual register (plan 08-14) and needs an operator decision.

Framework logging, also reviewed:

- `strapi::logger` writes `METHOD URL (ms) status` for every request. It writes no body, header or token, but the URL includes the query string, so search terms reach the log: the active-user search (`GET /api/v1/users?search=…`) can carry part of a person's name, and the `q=` searches carry record titles. Log retention should treat request lines as personal data.
- `strapi::errors` logs every unexpected error in full (message and stack) on the server. That is the counterpart of the bare client envelope, and nothing in it reaches a client.
