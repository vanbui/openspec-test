# Phase 5 operating contract

Updated 2026-10-18 against 05-09, 05-08 (`bfee09b3`) and the default bindings (`6c39366e`), then corrected after the 05-11/05-12 live runs (through `e5964724`; see [05-KEYCLOAK-CONTRACT.md](05-KEYCLOAK-CONTRACT.md) and [05-LIVE-EVIDENCE.md](05-LIVE-EVIDENCE.md)). This is an operating reference, not live evidence. SIGN-01/SIGN-02 and phase acceptance remain open. See [05-OFFLINE-GATE.md](05-OFFLINE-GATE.md) for measured offline results; 05-11 and 05-12 own live checkpoints.

## Commands and scope

Run from the repository root using installed dependencies:

```sh
node docker/midpoint/e2e/journey.mjs --check
node docker/midpoint/e2e/journey.mjs --list
node --test docker/midpoint/e2e/journey*.test.mjs
pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list
```

These validate static contracts, injected observations and inert discovery. They do not start Docker, browsers or application listeners. Ordinary Playwright discovery excludes `iam-journey.spec.ts`; the explicit configuration uses one worker, zero retries, and the real isolated Next.js/Auth.js/OIDC flow. Trace, video, automatic screenshots and persisted browser state stay off.

Only the orchestrator runs these live commands, after supplying the private contract below:

```sh
node docker/midpoint/e2e/journey.mjs --probe-keycloak
node docker/midpoint/e2e/journey.mjs --run
node docker/midpoint/e2e/journey.mjs --verify-evidence
```

`--in03-conflict` additionally runs the first eight setup stages and the conflict scenario with cleanup, independently of the browser journey. It does not establish complete journey acceptance. `--verify-evidence --contract` validates an existing `contract.json`; the current default probe returns its observations in memory and does not itself publish that file. A successful probe exit alone creates no contract evidence bundle. `--verify-evidence` requires a complete published `journey.json` and its four screenshots. No mode accepts credentials as arguments. Imports, `--check` and `--list` remain inert.

## Private inputs and exclusive ownership

Allocate a new `iam-journey-<UUID>` directory directly under ignored `apps/backend/.tmp`, owner-only mode 0700. Set `IAM_JOURNEY_RUN_DIR` to its absolute path. Its owner-only `.journey-owner` file contains exactly the run directory basename, newline, `idp`, newline. Supply distinct owner-only mode 0600 files inside it through `ENV_PATH` and `IAM_JOURNEY_COMPOSE_ENV_FILE`. `DATABASE_FILENAME` is an absolute, initially absent SQLite path inside that directory. `IAM_JOURNEY_EVIDENCE_DIR` is the matching run basename below `.planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/evidence`; its parent exists and destination must be absent. Do not create unrelated files inside the run directory: cleanup only removes owned recorded files and refuses a nonempty directory.

Set `IAM_JOURNEY_DISPOSABLE=true`. `COMPOSE_PROJECT_NAME`, if present, must be `idp`. This is exclusive use of the disposable **idp** scope, not a parallel stack. Preflight refuses existing project inventory, the fixed container names, `idp_keycloak_data`, `idp_midpoint_data`, `idp_midpoint_home`, `clamav-db`, `idp_default`, occupied listeners and foreign compilers. The orchestrator must arrange disposal of prior developer state before invoking the runner. Never use this runner against retained developer data.

Every compose invocation receives `--project-name idp --env-file` with the private `IAM_JOURNEY_COMPOSE_ENV_FILE` and the committed compose file. The reload and HR publication helpers use `docker exec` against the already selected owned container; they do not invoke compose or read an environment file. Compose interpolation uses an allowlisted environment, not ambient secret overrides. The private file has exactly these keys, with names shown here and no credential values:

- `KC_BOOTSTRAP_ADMIN_USERNAME`, `KC_BOOTSTRAP_ADMIN_PASSWORD`
- `MIDPOINT_ADMIN_PASSWORD`, `MIDPOINT_DB_NAME`, `MIDPOINT_DB_USER`, `MIDPOINT_DB_PASSWORD`
- `MIDPOINT_SCIM_TOKEN` (initially empty; replaced atomically after protected token issuance)

Legacy `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD` are refused. Leave developer `docker/.env` untouched. No `--write-dev-env` export is used. Owner, mode, symlink, inode and replacement-race checks bind handoff files to the run; foreign or changed files fail closed. The compiler lock is `.tmp/iam-journey-runtime.lock` under the backend.

Private application configuration uses these implemented names:

| Purpose | Names and handling |
| --- | --- |
| Remote administration | `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET`; private client-credentials exchange with a cached token. Bootstrap credentials are for compose only. |
| Backend configuration forwarded to owned processes | `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`; also `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_PROVISIONING_CLIENT_ID`, `KEYCLOAK_PROVISIONING_CLIENT_SECRET`, `KEYCLOAK_REQUEST_TIMEOUT_MS`, `KEYCLOAK_TOKEN_CLIENT_ID` when supplied. |
| OIDC client | `AUTH_KEYCLOAK_ID`, `AUTH_KEYCLOAK_SECRET`, `AUTH_KEYCLOAK_ISSUER`. |
| Outer API credential | `CSRM_API_TOKEN`, created by the disposable listener and passed privately to the web process. |
| Web session secret | `AUTH_SECRET`, generated afresh by the runner for the isolated web child. |
| Browser control | `IAM_JOURNEY_CONTROL_URL`, `IAM_JOURNEY_CONTROL_TOKEN`, generated for loopback-only control and passed privately to the browser child; `IAM_JOURNEY_LIVE=true` enables the explicit spec. |
| Optional local contract source | `IAM_KEYCLOAK_VENDOR_DIR`, a local pinned 26.6.1 source checkout; absence leaves source references empty. No network source retrieval occurs. |

Use private environment, stdin or owner-only ignored handoffs, never shell literals, screenshots of secrets, command arguments or raw diagnostic attachments. The runner enforces `KEYCLOAK_BASE_URL=http://localhost:8080`, `KEYCLOAK_REALM=idambox`, matching `KEYCLOAK_ISSUER`/`AUTH_KEYCLOAK_ISSUER=http://localhost:8080/realms/idambox`, `AUTH_URL=http://localhost:3000`, and runner `CSRM_API_BASE_URL=http://127.0.0.1:1337`. The web child uses the same backend with `/api` appended. The registered callback remains `http://localhost:3000/api/auth/callback/keycloak`. Mailpit reads are loopback-only at port 8025.

## Setup, bootstrap and source token

The runner owns a fresh reset on **every** full run: `down -v --remove-orphans`, then `up -d keycloak mailpit midpoint_data`, all with the private compose file. An interrupted or failed run requires a new private directory, new absent database and fresh reset; never reuse partial users, mailbox state or browser sessions.

Source registration happens before a listener exists. The administration child compiles the backend, marks administration boot, loads Strapi with provisioning and token verification off and all ordinary fixture seeds false. It explicitly calls `seedCoreData` with a scoped `IDAMBOX_SEED_CORE=true`, restores that setting, and calls `seedCapabilityCatalogue`. Normal `seedCsrmData` behavior remains unchanged.

Before registration it requires one active `idambox-iam` Application, one `Identity Provisioning` Role with exactly one same-named Function, no menu path, that Application relation, and exact equality to all **21** provisioning FunctionAPI URLs from the catalogue. No IdamBox Users may yet exist. Missing prerequisites refuse before creating a service user. It calls `registerIdentitySource` for `midPoint (dev)` / `midpoint-dev-provisioning`, issues the initial token through `administerSourceToken`, and destroys the administration app in `finally`.

Next, while the listener is still absent, the runner captures stdout privately from:

```sh
pnpm --dir apps/backend scim:token 'midPoint (dev)' rotate
```

The CLI compiles, loads in administration mode, rotates the already issued token and destroys the app. The runner validates the single protected token line and atomically replaces only `MIDPOINT_SCIM_TOKEN` in the private compose file. No developer export is involved. Do not run this compiler beside a Strapi listener.

`up -d --force-recreate midpoint_init midpoint_server` supplies the token to the committed renderer. `bash docker/midpoint/reload.sh` renders inside the container and applies the numbered XML objects through authenticated REST PUT. Only after reload, native-object checks and schedule suspension does the disposable Strapi listener start from the compiled output, with provisioning, token verification and `csrmAppIsEnabled` true and core/CSRM/IAM fixture flags still false. The listener creates the private outer API credential. Later browser startup enables `CSRM_AUTH_OIDC_ENABLED=true` and disables `CSRM_DEV_IDENTITY=false` in the owned process only. All three committed activation defaults remain false; flag-off boot creates no invitation client or timer.

## Native provisioning and ordered stages

The existing validated whole-snapshot path is `bash docker/midpoint/hr-publish.sh <owned-csv-path>`; it validates the complete CSV before publication. No partial rows, direct provisioning substitutes or alternate identity writer are used. Source registration and identity writes retain the identity service and Document Service boundary.

Object OIDs use prefix `11000000-0000-4000-8000-000000000` plus their three-digit suffix:

| Suffix | Committed object / call |
| --- | --- |
| 100, 110 | HR CSV and IdamBox SCIM resources; resource 110 test proves connection. |
| 140, 150 | HR person template and archetype. |
| 300 | HR live sync: mover, leaver and conflict, `POST /tasks/{oid}/run`. |
| 310 | HR reconciliation: joiner baseline, same run endpoint. |
| 320, 330, 340 | IdamBox reconciliation, pending-operation refresh, validity scan; inspected and suspended with the other numbered tasks. |

Runtime pins remain Keycloak **26.6.1**, midPoint **4.8.14**, SCIM2 connector **1.2.9**, source commit `05c404bbecf9c28938e2183411c7b04b4f8f4226`.

Task runs poll for completion strictly newer than the trigger and no running execution state. midPoint ignores run-now for a suspended task, so a held task is resumed for the on-demand run and suspended again afterwards, including on failure. Success is read from `resultStatus`. Configuration checks use `options=raw`, which does not contact the resource. Each container-local REST call is bounded at 45 s with a 16 MiB read bound, because task records grow with every run. IN-03 detects its handled connector error from the run's own item-processing statistics: with `retryLater` the run result stays `success`. Native paging and the configured five-minute live-sync/validity cadence remain intact. On-demand completion does **not** prove elapsed scheduled cadence. Ready schedules are restored during cleanup before the owned stack is disposed.

The exact order is `preflight`, `reset`, `readiness`, `source-registration`, `source-token`, `render`, `reload`, `connection`; then, at 1440×900 followed by 375×812: `csv-joiner`, `linkage`, `mail`, `password-setup`, `requestor-sign-in`, `requestor-access`, `csv-mover`, `csv-leaver`, `immediate-refusal`, `remote-completion` (each stage has its width suffix); finally `in03-conflict`, `evidence`. A failure stops dependent stages and retains the first failure through separate cleanup.

Budgets from `BUDGETS` are: shared setup 300 s across the first eight stages, ordinary stage 180 s, mail 120 s, each viewport 600 s, conflict 1500 s, overall execution 3600 s, and independent cleanup 60 s. Individual IPC requests are bounded at 15 s, remote default observations at 10 s and readiness HTTP at 3 s. Owned child shutdown escalates after 3 s. The evidence stage retains its ordinary 180 s budget, including its internal cleanup and regressions.

## Invitations, recovery and endpoint contract

Only a committed new sourced, active, unprotected human with stored linkage is eligible. Manual users, registered source service users, claims, updates, reactivation, inactive/tombstoned users and replay do not automatically send. A real outer transaction rollback never sends; remote linkage failure never leaves a successful invitation. After commit, one detached best-effort request bounded at the lesser of the configured timeout and 5 s uses the stored subject and `['UPDATE_PASSWORD']`. There is no automatic mail retry, durable invitation queue or delivery field. The existing outbox remains `disableAndEndSessions` only.

`sent (accepted)` means the remote endpoint accepted the request; it does not prove delivery. A crash, timeout or lost response leaves uncertainty. The operator verifies eligibility and mailbox state, then explicitly recovers using one local 24-character documentId:

```sh
pnpm --dir apps/backend iam:password-setup <local-documentId>
```

Supply private backend configuration for the intended database, with provisioning enabled for this bounded administration command and no listener/compiler overlap. It loads without a listener, rechecks sourced-human eligibility, reads the stored subject and mutates no user. Exit 0 requires `sent (accepted)` and successful cleanup; all other outcomes exit 1. It accepts no email, username or remote subject selector. No guarantee about invalidating an earlier link is made.

Production invitation requests omit optional query parameters. The isolated `--probe-keycloak` default binding tests pinned 26.6.1: A1 endpoint `PUT /admin/realms/idambox/users/{subject}/execute-actions-email` with `UPDATE_PASSWORD` and 204; A2 `client_id`, `redirect_uri`, `lifespan` in seconds (seven accepted/refused combinations and observed token lifetime); A3 required actions alone produce no mail and missing SMTP produces 500, then recovery; A4 actual action consumption clears the password action and two operator resends yield fresh mail. These are executable probes, still pending live proof. The Strapi administration client deliberately holds only user-management roles, so the probe alone snapshots, changes and restores realm SMTP with the disposable stack's bootstrap administrator, read from the private compose handoff; probe-owned remote users and the sourced recovery fixture are cleaned independently. Its default overall/cleanup bounds are 600 s/60 s; operator readiness is separately bounded at 120 s.

The sole local realm seed exception is SMTP `mailpit:1025`, sender `identity@idambox.test`, without SSL, STARTTLS or authentication. Existing users, clients, fixed subjects, scopes, grants and redirect registrations remain intact.

## Delivered default observations and evidence

Default Mailpit observations inspect only matched synthetic recipients and count action invitations, rejecting truncation, malformed matches and transport/status failures. Bodies, recipients, action links and receipt caches never become published observations. Default remote observations use the cached private admin credential, verify server 26.6.1 from the owned `keycloak` container (pinned image, `idp` project, `127.0.0.1:8080`, version file; realm-scoped `serverinfo` omits it), stored subject, enabled state and sessions, and correlate native audit records with **source-authenticated** SCIM receipts. Successful creates retain the returned local documentId. Email is checked remotely; employee number, department and job title are checked on the local identity because the existing remote payload does not mirror those attributes.

The real browser retains one signed-in context per width through Requestor access, mover and leaver. Typed Strapi operations and server authorization prove owned read/write access, restricted route/API and foreign-record refusal. Independent retained-token probes verify list/detail/write 403 before token expiry and before remote logout; remote completion requires disabled account, zero sessions and fresh-sign-in refusal. A private hold bounds that proof window and is released even on failure. Navigation alone is never authorization.

IN-03 creates a **remote-only** email collision and proves connector 503 with `Retry-After: 30`, local rollback, unchanged source ownership and no invitation. The pinned connector reports a generic communication error; native HR `retryLater` persists a five-minute initial trigger and fifteen-minute subsequent interval. Correcting the remote collision must recover through the actual native retry scanner, whose own task OID/invocation is recorded. The five minutes are measured from failed processing start. The one-minute pending-operation refresh does not substitute for this recovery. No new cadence claim is made.

The default **evidence stage performs cleanup before regression compilation**: close proof window, control/browser/backend resources, restore schedules, dispose owned idp volumes and remove owned private material. Then it runs, in order, unfiltered `pnpm --dir apps/backend test`, CSRM `typecheck`, CSRM `test`, all eight journey test files and `journey.mjs --check`. It stops on the first failed command. It compares frozen contract/catalogue/schema/generated-type/example-default hashes. This ordering prevents compiler/listener overlap; a failed unfiltered backend command blocks publication even if narrowed diagnostics pass. Outer cleanup remains idempotent and preserves any earlier failure.

Only after complete execution and successful cleanup/regressions does the runtime assemble and atomically publish `journey.json` and four mode-0600 images inside owner-only directories. Closed top-level fields are `format`, `runId`, `date`, `provenance`, `reset`, `versions`, `stages`, `tasks`, `people`, `conflict`, `cleanup`, `regressions`. They contain reset/exclusivity booleans, pinned versions, ordered timings, task OIDs/invocations and timestamps, native audit/SCIM correlation IDs, source/identity/document/subject linkage, both viewport assertions, pre-expiry refusal statuses, conflict retry/correction/rollback outcomes and cleanup/regression booleans. Only `screenshots/csrm-{1440,375}-{requestor,refusal}.png` are allowed; never authentication pages. No raw mail, tokens, cookies, links, passwords, exception text or arbitrary process diagnostics are retained. A partial run cannot publish passing evidence, overwrite an existing bundle or manufacture history.

Historical Phase 3/4 capture/replay below `docker/midpoint/e2e/README.md` remains separate. Recapture/replay is required when actual connector request configuration or mappings change; documentation changes alone do not authorize a new capture or alteration of historical evidence.
