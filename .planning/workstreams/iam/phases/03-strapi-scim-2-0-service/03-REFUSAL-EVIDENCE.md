# Phase 3 live refusal evidence (plan 03-16, task 1)

**Status:** Passed. Orchestrator-run live gate; `node docker/midpoint/e2e/refusal-scim.mjs --verify-evidence` exits 0.
**Date:** 2026-10-16T03:06:36Z to 03:08:46Z (14:06 to 14:08 AEDT), 130 seconds
**Command:** `node docker/midpoint/e2e/refusal-scim.mjs --run` from the repository root
**Evidence:** [outcomes.json](evidence/browser-refusal/outcomes.json) (50 stage rows, all passed); browser proof in [03-BROWSER-REFUSAL-EVIDENCE.md](03-BROWSER-REFUSAL-EVIDENCE.md)

## Runtime

| Item | Value |
| --- | --- |
| Keycloak | Live `idp` container on `localhost:8080`, realm `idambox`; stopped and started by the gate in every scenario |
| Backend | Isolated in-process Strapi (authorization HTTP harness, own SQLite, random loopback port) with the real mounted `/scim/v2` routes, Keycloak provisioning and token verification on for that process only |
| Web | Isolated `next dev` for `apps/csrm`, listening on `127.0.0.1:3307` with OIDC on, the development identity off and its own build directory |
| Browser | Installed Playwright Chromium, `iam-scim-refusal.spec.ts` only; traces, videos and Playwright screenshots off |
| Gate configuration | Keycloak client values from the committed development realm seed, passed in memory only; the runner reads no environment file. The developer Strapi server and `apps/backend` configuration were not touched. Committed flags stay false. |

## Scenarios and order

The runner executes the stages below in this order for each scenario and records a row per stage (`outcomes.json`). A stage throws on any failed assertion, so a later row exists only if every earlier one passed.

| Stage | What is asserted |
| --- | --- |
| prepare | Sourced human created through real SCIM `POST /Users` (201), linked to a real Keycloak user, given an existing request, a risk it owns, and the Security Analyst Role; Keycloak password set by the admin API and a real PKCE session established |
| baseline | With the same identity token and the CSRM API token: `GET /api/v1/me/access`, `GET /api/v1/risks` and the request detail answer 200, and a request `PUT` answers 200. For PUT and PATCH the browser has already signed in through Keycloak and seen the risk register and request detail |
| stop | Keycloak container stopped |
| deactivate | Real SCIM `PUT` (`active:false` plus title change), `PATCH` (replace `active:false` plus title) or `DELETE`: 200, 200 or 204 |
| refusal | The same identity token, still unexpired (checked against `exp`), now gets 403 on access, risks, request detail and request `PUT`; for PUT/PATCH the browser session's token too, which the gate confirms has not changed |
| pending | User `inactive` (DELETE: `sourceDeletedAt` set), HR title persisted, one `KeycloakSyncOutbox` row `pending` with 0 attempts; source discovery `GET /ResourceTypes` and `GET /Groups` still 200; Role, subject, source binding, request and risk ownership references unchanged |
| browser | PUT/PATCH: browser refusal at the scenario width (see browser evidence); DELETE: API only |
| start | Keycloak container started and the realm discovery document answers |
| recover | The real worker completes the outbox row; Keycloak reports the user disabled with no sessions; references still unchanged |
| close | Scenario closed |

Scenarios: `put-1440`, `put-375`, `patch-1440`, `patch-375`, `delete-api`. All 50 rows passed.

Refusal (403) was observed with Keycloak stopped and the outbox row still pending, so it did not depend on Keycloak or on token expiry. No database edit or development header stood in for any step.

## SCIM log lines (backend `scim.request` events)

| Time (AEDT) | Operation | Status |
| --- | --- | --- |
| 14:07:15 | `POST /Users` (put-1440 person) | 201 |
| 14:07:26 | `PUT /Users/:id` | 200 |
| 14:07:40 | `POST /Users` (put-375) | 201 |
| 14:07:45 | `PUT /Users/:id` | 200 |
| 14:07:57 | `POST /Users` (patch-1440) | 201 |
| 14:08:03 | `PATCH /Users/:id` | 200 |
| 14:08:15 | `POST /Users` (patch-375) | 201 |
| 14:08:21 | `PATCH /Users/:id` | 200 |
| 14:08:33 | `POST /Users` (delete-api) | 201 |
| 14:08:35 | `DELETE /Users/:id` | 204 |

Each deactivation is followed within 0.2 seconds by successful `GET /ResourceTypes` and `GET /Groups` from the same source.

## Gate-only Keycloak change and cleanup

- The `idambox-csrm` client allows only `http://localhost:3000/api/auth/callback/keycloak`. For the duration of each run the orchestrator added `http://localhost:3307/api/auth/callback/keycloak` (and that web origin) through Keycloak's admin CLI inside the container, then restored the original list. Confirmed restored after every run, including failed ones. The realm seed is unchanged.
- The gate deleted every Keycloak user it created (prefix `iam-gate-refusal`); a search afterwards finds none. The isolated backend database, web build directory and listeners were removed.
- The three fictitious Keycloak users left from 03-13 (`probe.joiner`, `iam-scim-gate-02bc800fba0e`, `iam-scim-gate-702937bb9bc5`, all `@idambox.test`) were deleted at the same time.

## Attempts before the passing run

Each failed attempt cleaned up and published nothing.

1. The generated Playwright configuration imported `defineConfig` by name from the CommonJS `@playwright/test` package and did not load; cleanup then failed because the stopped `next dev` was still writing into the run directory. Fixed: plain configuration object, and the directory removal retries.
2. Sign-in failed with Auth.js `Configuration`. Keycloak logged `invalid_redirect_uri`: the sign-in request used `http://127.0.0.1:3307/...`, but the callback exchanged the code with `http://localhost:3307/...`, because the dev server reports its request host as `localhost`. Fixed: the web server still listens on 127.0.0.1 only, but `AUTH_URL`, the browser base URL and the registered callback all use `localhost:3307`. This affects only the gate's origin; normal development already uses `localhost:3000` throughout. Next.js telemetry is now off for the gate's processes.
3. The browser spec asserted "no protected content" on the fresh page with a locator while the server was still holding access, so the locator only waited for navigation and timed out. Fixed: the spec records whether the document has arrived and inspects its text and tables if it has.
