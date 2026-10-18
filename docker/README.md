# IdamBox Local Docker Services

This directory holds the local-only identity platform for IdamBox development, compose project `idp`:

| Service | Image | Address | Purpose |
| --- | --- | --- | --- |
| `keycloak` | `quay.io/keycloak/keycloak:26.6.1` | `http://127.0.0.1:8080` | Sign-in (OIDC) for IdamBox products |
| `clamav` | `clamav/clamav:stable` | `127.0.0.1:3310` | Attachment scanning |
| `midpoint_server` (container `midpoint`) | `idambox/midpoint:4.8.14-scim2-1.2.9`, built from `midpoint/Dockerfile` | `http://127.0.0.1:8081/midpoint` | Identity engine ([ADR 0005](../docs/adr/0005-midpoint-identity-engine-and-strapi-scim.md), [ADR 0006](../docs/adr/0006-midpoint-lts-and-community-scim2-connector.md)) |
| `midpoint_data` | `postgres:16-alpine` | internal only | midPoint repository and audit |
| `midpoint_init` | same image as `midpoint_server` | one-shot | Prepares midPoint's home, repository schema and connector, then exits |
| `mailpit` | `axllent/mailpit:v1.31.5` | `http://127.0.0.1:8025` (SMTP `mailpit:1025` inside the network) | Catches local email |
| `scim_stub` | `nginx:1.28.0-alpine` | internal only, profile `scim-spike` | Static SCIM discovery stub for the connector check |

The committed Keycloak realm passwords and client secrets listed below are intentionally easy local development values and must not be reused outside local development. Every other credential lives in the git-ignored `docker/.env`.

Product authorization remains in Strapi through `IdamBoxUser -> Role -> Function -> Application`, with FunctionApi records supplying operation-level grants; do not add authorization Roles, Functions, FunctionApi grants, or groups in Keycloak or midPoint.

## Quickstart

Run the commands in this README from this `docker/` directory: Compose reads `docker/.env` from here.

1. Create `docker/.env` once. The script copies `.env.example` and replaces each `change-me` with a fresh random value, printing no secret:

   ```bash
   midpoint/new-env.sh
   ```

   Or copy `.env.example` to `.env` and fill in the values yourself. midPoint's default password policy allows at most 14 characters for `MIDPOINT_ADMIN_PASSWORD`. `midpoint/tests/new-env.test.sh` checks the generator, including a CRLF copy of the example.

2. Start the stack. The first start builds the midPoint image, which clones and compiles the SCIM2 connector, so it needs network access to GitHub and the Maven repositories:

   ```bash
   docker compose up -d
   docker compose ps
   ```

   midPoint takes one to two minutes to report healthy. `midpoint_init` shows `Exited (0)` once it has done its work.

3. Open the consoles:
   - Keycloak admin: `http://localhost:8080/admin`, with `KC_BOOTSTRAP_ADMIN_USERNAME` / `KC_BOOTSTRAP_ADMIN_PASSWORD` from `.env` (the local default is admin/admin).
   - midPoint: `http://127.0.0.1:8081/midpoint`, user `administrator`, password `MIDPOINT_ADMIN_PASSWORD` from `.env`.
   - Mailpit inbox: `http://127.0.0.1:8025`.

Stop the stack and keep its data:

```bash
docker compose stop
```

Start it again with `docker compose up -d`; this also re-runs `midpoint_init`, which is safe to repeat. After changing `midpoint/Dockerfile` or `midpoint/init.sh`, run `docker compose up -d --build`.

## Reset

Remove every container and volume, then start clean:

```bash
docker compose --profile scim-spike down -v
docker compose up -d
```

`down -v` deletes the Keycloak data (the realm is re-imported from `keycloak/import` on the next start), midPoint's repository and home, and the ClamAV signature database (downloaded again on the next start). Changing a value in `.env` does not rotate a credential already stored in a volume: reset to apply it (`midpoint/new-env.sh --force` regenerates `.env`).

To reset only midPoint, remove its containers and volumes and start again:

```bash
docker compose rm -sf midpoint_server midpoint_init midpoint_data
docker volume rm idp_midpoint_data idp_midpoint_home
docker compose up -d
```

## midPoint

midPoint 4.8.14 LTS runs with its native PostgreSQL 16 repository. `midpoint_init` (`midpoint/init.sh`) runs before the server on every `up`:

1. creates `config.xml` in the home volume if it is absent;
2. checks the repository and audit tables with `psql`, creates whichever schema is absent (which also recovers a first run that stopped between the two), and stops with an error on a partial schema, a connection failure, or a failed midPoint repository check;
3. replaces the SCIM2 connector bundle in the home volume's `connid-connectors` with the one built into the image;
4. until it has once succeeded (marker `.idambox-objects-seeded` in the home volume), renders the numbered objects from `midpoint/objects/` into the home volume as post-initial objects, which midPoint imports in filename order when it starts; an object that cannot be rendered is skipped and must be applied later with reload;
5. seeds the reference HR CSV once into midPoint’s home at `var/hr/hr.csv`, only if absent; later changes are published with `midpoint/hr-publish.sh`;
6. installs the IdamBox schema extension into `var/schema`.

midPoint reaches Strapi on the host at `http://host.docker.internal:1337`.

### Configuration as code and reload

midPoint configuration lives in numbered files in `midpoint/objects/` (`100-resource-hr-csv.xml`, `110-resource-idambox-scim.xml`, `140-object-template-hr-person.xml`, ...), each with a fixed `oid`. The folder is mounted read-only. midPoint renames loaded post-initial objects to `*.done` inside its home volume, never in the repository.

Post-initial objects load only once, when the repository is created. After editing an object, re-apply it to the running midPoint:

```bash
midpoint/reload.sh                                   # every numbered object, in order
midpoint/reload.sh 110-resource-idambox-scim.xml     # one object
```

```powershell
midpoint/reload.ps1
midpoint/reload.ps1 110-resource-idambox-scim.xml
```

Each object is `PUT` through midPoint's REST API (create, or overwrite by OID), so the change goes through midPoint's model and caches. Rendering and the REST call run inside the `midpoint` container, so the Identity Source token and administrator password never reach the host. An object that cannot be rendered is reported and never sent. Both scripts stop at the first failure with a non-zero exit code. `reload.ps1` works in PowerShell 7 and in Windows PowerShell 5.1. Forgetting to reload leaves midPoint on the old configuration. Reloading a task object replaces it, including its run state: afterwards the validity scan checks every HR person once and live sync starts from the CSV connector's last snapshot, so reload tasks only when their definition changed.

### Phase 4 operations

Issue or rotate the dev Identity Source token from the repository root. The command writes it directly into the ignored `docker/.env`:

```bash
pnpm --dir apps/backend scim:token "midPoint (dev)" rotate --write-dev-env
```

Then, from `docker/`, recreate both containers so they receive the new environment:

```bash
docker compose up -d --force-recreate midpoint_init midpoint_server
```

Once midPoint is healthy, apply the objects from the repository root:

```bash
docker/midpoint/reload.sh
```

On PowerShell, use `docker/midpoint/reload.ps1`. Changing `.env` alone does not update the running containers. The renderer refuses a missing or malformed token and unsupported placeholders. The initial setup skips an object that cannot be rendered, so reload after issuing the token is required.

The Phase 4 objects are:

| Prefix | Purpose | Schedule (UTC) |
| --- | --- | --- |
| `100` | HR CSV resource: the reference Identity Source, strong inbound identity attributes and activation; missing rows deactivate. | Read by HR tasks. |
| `110` (`resource-idambox-scim`) | IdamBox SCIM resource: provisions sourced users, repairs drift and opens manual-user correlation cases; delete is disabled. | Read by synchronization and reconciliation. |
| `140` | HR person template: preferred display name, then given/family names, then username. | Applied to HR Identities. |
| `150` | HR person archetype: assigns the IdamBox construction only to HR Identities. | Applied to HR Identities. |
| `300` | HR live sync: applies joiner, mover and leaver changes. | Every 5 minutes. |
| `310` | HR reconciliation: compares the complete snapshot and repairs drift. | Daily at 01:00 UTC. |
| `320` | IdamBox reconciliation: reads all visible IdamBox Users, repairs sourced-user drift and finds manual-user claim candidates. | Daily at 02:00 UTC. |
| `330` | Pending-operation refresh: refreshes pending provisioning operations where present. | Every 1 minute. |
| `340` | Validity scan: applies start/end date transitions even without CSV edits. | Every 5 minutes. |

All schedules use UTC. The separate `110-resource-scim-spike.xml` is the earlier discovery check, not the IdamBox provisioning resource. See [the HR reference guide](midpoint/hr/README.md) for the D19 columns, activation rules and snapshot publication.

The schema extension is `midpoint/schema/idambox-extension.xsd`. Reloading XML objects does not reload the schema: after editing it, rerun the init service to install it and restart the server with `docker compose up -d --force-recreate midpoint_init midpoint_server` from `docker/`.

To resolve a manual-user correlation case, open the midPoint console and go to **Cases / My work items**. Review the candidate and choose the existing **Identity** to claim the manual IdamBox User as a sourced user, or choose **none** if it does not belong to that Identity. Complete the work item to record the decision. A candidate match alone does not claim or change a manual user.

While Keycloak is down, Strapi rejects provisioning writes with HTTP 503 and `Retry-After: 30`. The connector reports this as a generic error and does not pass on `Retry-After`, so midPoint keeps no provisioning pending operation for that failure. The one-minute pending-operation refresh therefore does not recover these writes. Instead, the HR task's `retryLater` reaction puts a durable retry trigger on the person's HR row. midPoint's trigger scanner fires it after five minutes, then every fifteen minutes while retries are needed. The HR live sync, HR reconciliation and validity scan have this reaction. Nightly HR and IdamBox reconciliations repair anything missed. See [ADR 0006](../docs/adr/0006-midpoint-lts-and-community-scim2-connector.md) for the connector observations.

### SCIM2 connector

The Provision IAM SCIM2 connector `V1.2.9` is built from source in the first stage of `midpoint/Dockerfile` ([ADR 0006](../docs/adr/0006-midpoint-lts-and-community-scim2-connector.md)). The resolved dependency list is kept in the image at `/opt/midpoint/connector-bundle/runtime-classpath.txt`.

The connector check runs against a static discovery stub in the `scim-spike` profile:

```bash
docker compose --profile scim-spike up -d
midpoint/spike-test.sh
```

It prints `RESULT: GO` when midPoint lists exactly one SCIM2 connector 1.2.9, the spike resource passes its connection test, and the stub logged the connector's `GET /scim/v2/ResourceTypes`.

## Mailpit

Mailpit catches all mail sent to it. Services in the compose network send through SMTP at `mailpit:1025`; read the mail at `http://127.0.0.1:8025`. Keycloak's set-password email for new sourced users uses it from `iam` Phase 5.

## ClamAV

The compose file runs `clamav/clamav:stable` as container `clamav`. Its scanner port is bound only to `127.0.0.1:3310`. The named Docker volume `clamav-db` stores the signature database at `/var/lib/clamav` and survives container recreation and `docker compose down` (but not `down -v`).

```bash
docker compose up -d clamav
docker compose logs -f clamav
```

Initial startup downloads signatures before the scanner is ready. To re-import only the Keycloak realm while keeping signatures, remove only the Keycloak volume instead of running `down -v`.

The Compose project remains named `idp` so the existing `idp_keycloak_data` volume is reused after the directory rename. The ClamAV volume is explicitly named `clamav-db`, matching the standalone Docker command.

## Disposable backend PostgreSQL gate

The `iam_pg_gate` service is enabled only by the `iam-pg-gate` profile. Plain
`docker compose up` leaves it stopped. It uses PostgreSQL 16 on
`127.0.0.1:15432`, with disposable tmpfs data and no named volume. Set
`IAM_PG_GATE_USER`, `IAM_PG_GATE_PASSWORD` and `IAM_PG_GATE_DB` in your local
environment from the placeholders in `.env.example`.

From this directory, start only this service and wait for readiness:

```powershell
docker compose --profile iam-pg-gate up -d --wait iam_pg_gate
```

Stop and remove only the gate service (all its data is disposable):

```powershell
docker compose --profile iam-pg-gate stop iam_pg_gate
docker compose --profile iam-pg-gate rm -f iam_pg_gate
```

The standalone backend helper reads `IAM_PG_GATE_HOST=127.0.0.1`,
`IAM_PG_GATE_PORT=15432`, `IAM_PG_GATE_USER`, `IAM_PG_GATE_PASSWORD` and
`IAM_PG_GATE_ADMIN_DB` (or `IAM_PG_GATE_DB`) from the invoking process environment.
Compose does not export `.env` variables into the invoking shell. The helper creates
and drops a unique `iam_gate_<random>` database for each run; the supplied user needs
database creation privileges. It rejects other endpoints, SQLite, database URL
overrides and midPoint repository names. Its timeout accepts 30–3600 seconds,
including a fifteen-second teardown reserve. Never use `midpoint_data` for this gate.

After compiling the test helpers, the orchestrator runs this from the repository root:

```powershell
pnpm --dir apps/backend exec node .tmp/tests-dist/tests/helpers/iam-postgres-gate.js --timeout-seconds 600
```

## Local-Only Credentials

| Purpose                        | Value                               |
| ------------------------------ | ----------------------------------- |
| Keycloak admin username        | `admin` (default in `.env.example`) |
| Keycloak admin password        | `admin` (default in `.env.example`) |
| Jane Doe username              | `jane.doe`                          |
| Jane Doe email                 | `jane.doe@idambox.com`              |
| Jane Doe password              | `jane`                              |
| Bob Doe username               | `bob.doe`                           |
| Bob Doe email                  | `bob.doe@idambox.com`               |
| Bob Doe password               | `bob`                               |
| CSRM OIDC client ID            | `idambox-csrm`                      |
| CSRM OIDC client secret        | `idambox-csrm-local-secret`         |
| Strapi admin API client ID     | `idambox-strapi-admin`              |
| Strapi admin API client secret | `idambox-strapi-admin-local-secret` |

## Realm Import

The import file is `keycloak/import/idambox-realm.json`. Docker Compose mounts it into `/opt/keycloak/data/import` and starts Keycloak with `start-dev --import-realm`.

| Setting                 | Value                                              |
| ----------------------- | -------------------------------------------------- |
| Realm                   | `idambox`                                          |
| Users                   | `jane.doe`, `bob.doe`                              |
| Emails                  | `jane.doe@idambox.com`, `bob.doe@idambox.com`      |
| Required user actions   | None                                               |
| Client                  | `idambox-csrm`                                     |
| Client type             | Confidential OpenID Connect client                 |
| Callback URL            | `http://localhost:3000/api/auth/callback/keycloak` |
| Post-logout/home URL    | `http://localhost:3000`                            |
| Web origin              | `http://localhost:3000`                            |
| Strapi admin API client | `idambox-strapi-admin`                             |
| `idambox-csrm` scopes   | default scopes include `basic`, so the access token carries `sub` |
| `idambox-csrm` audience | an audience mapper adds `idambox-csrm` to the access token's `aud` |
| Fixed user ids          | `jane.doe` `5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e01`, `bob.doe` `5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e02` |

The scope, audience and fixed ids let Strapi verify the web's forwarded access token and map its `sub` to the seeded IdamBox User's `externalSubject` (`docs/adr/0004-strapi-verifies-keycloak-access-tokens.md`). The ids must stay in step with `apps/backend/src/keycloak/development-fixture-subjects.ts`.

Keycloak startup import skips a realm that already exists in the persisted `keycloak_data` Docker volume. Normal restarts keep admin changes. To apply changes from `keycloak/import/idambox-realm.json` as a clean import, run `docker compose down -v` from this directory before starting again.

## Strapi Provisioning Client

The realm import includes a local-only service-account client for Strapi user provisioning:

```env
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=idambox
KEYCLOAK_ADMIN_CLIENT_ID=idambox-strapi-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=idambox-strapi-admin-local-secret
```

Strapi uses this dedicated client for Keycloak Admin API calls. Do not use the bootstrap `admin` / `admin` account for application provisioning. The client manages users in the existing `idambox` realm and does not add CSRM authorization roles or groups.

Provisioning is off unless Strapi runs with `IDAMBOX_KEYCLOAK_PROVISIONING=true`. For production setup, including a least-privilege service account with `manage-users` only, see `apps/backend/README.md` ("Keycloak user provisioning") and `docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md`.

For runtime provisioning verification, start Keycloak from this directory with `docker compose up -d`, run Strapi with `IDAMBOX_KEYCLOAK_PROVISIONING=true`, create or update an `IdamBox User`, and inspect the matching user in the `idambox` realm. If Keycloak has already imported the realm before client changes, run `docker compose down -v` and start it again so the checked-in realm JSON is re-imported.

## OIDC Values

| Setting              | Value                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| Admin console        | `http://localhost:8080/admin`                                           |
| Issuer               | `http://localhost:8080/realms/idambox`                                  |
| Discovery URL        | `http://localhost:8080/realms/idambox/.well-known/openid-configuration` |
| Client ID            | `idambox-csrm`                                                          |
| Client secret        | `idambox-csrm-local-secret`                                             |
| Callback URL         | `http://localhost:3000/api/auth/callback/keycloak`                      |
| Post-logout/home URL | `http://localhost:3000`                                                 |
| Web origin           | `http://localhost:3000`                                                 |

Example local environment values for a future app integration:

```env
KEYCLOAK_ISSUER=http://localhost:8080/realms/idambox
KEYCLOAK_CLIENT_ID=idambox-csrm
KEYCLOAK_CLIENT_SECRET=idambox-csrm-local-secret
AUTH_URL=http://localhost:3000
AUTH_KEYCLOAK_ID=idambox-csrm
AUTH_KEYCLOAK_SECRET=idambox-csrm-local-secret
AUTH_KEYCLOAK_ISSUER=http://localhost:8080/realms/idambox
```

## Broker Boundary

Keycloak is the IdamBox OIDC provider. A later phase may configure it to broker authentication to customer identity providers such as Auth0, Ping Access Management, Okta, or Entra ID. The future CSRM app should continue to talk to the IdamBox Keycloak issuer and `idambox-csrm` client instead of binding directly to customer IdPs.

## Verification

Run the static project verifier from the repository root:

```powershell
yarn verify:keycloak-idp
yarn verify:keycloak-provisioning
```

When Docker is available, runtime verification is (after creating `docker/.env` as in the Quickstart):

```powershell
docker compose up -d
docker compose logs keycloak
curl -f http://localhost:8080/realms/idambox/.well-known/openid-configuration
docker compose down
```

If port `8080` is already in use, stop the conflicting local service or change the host port mapping in `docker-compose.yaml` for your local machine.

## SCIM request limits

Strapi validates these optional backend environment settings at startup. Explicit values
must be positive safe integers; malformed, empty, zero and negative values stop startup.

| Setting | Default | Window |
| --- | --- | --- |
| `IDAMBOX_SCIM_IP_LIMIT` | 1200 requests per client IP | 60 seconds |
| `IDAMBOX_SCIM_SOURCE_LIMIT` | 600 requests per verified Identity Source | 60 seconds |

Every `/scim/v2` request, including discovery and unknown routes, consumes the IP budget
before authentication, using `ctx.ip` under the existing trusted-proxy configuration.
Authenticated requests consume the source budget across all operations after source
activity is persisted. Live bucket capacity is 10,000 IPs and 1,000 sources. New keys
at capacity receive 429 without evicting active budgets. Expired windows free capacity;
`Retry-After` is the integer number of seconds until the relevant window resets.

These are per-process, single-instance limits with no persistent store. Before deploying
multiple Strapi instances, enforce the same aggregate limits at a shared ingress or store.
SCIM JSON bodies are limited to 1 MiB; existing CSRM JSON, form and upload limits retain
their current behavior. These settings do not enable provisioning or token verification.


## Phase 5 disposable identity journey

See the [journey operating contract](../.planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/05-OPERATIONS.md)
and [offline regression gate](../.planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/05-OFFLINE-GATE.md).
Repository-root `node docker/midpoint/e2e/journey.mjs --check` is inert.
`--probe-keycloak`, `--run` and `--verify-evidence` belong to the orchestrator's
live checkpoints; they require the private contract and exclusive disposable
`idp` ownership, including a fresh reset on every run. They must not target the
developer stack described above.

The local realm adds only Mailpit SMTP (`mailpit:1025`, fictitious sender);
existing clients, subjects, scopes and grants stay intact. Committed provisioning,
token-verification and web OIDC defaults remain false. The runner activates only
its isolated processes and disables the development identity bridge.

Use owner-only `IAM_JOURNEY_COMPOSE_ENV_FILE` for every journey compose call,
with `KC_BOOTSTRAP_ADMIN_USERNAME` / `KC_BOOTSTRAP_ADMIN_PASSWORD` and the
allowlisted midPoint keys documented in the operating contract. Do not export
the source token to developer `docker/.env`. The default evidence adapter stops
listeners and removes private run material **before** unfiltered regression
compilation; failures block publication. No live acceptance follows from these
instructions or an offline pass.
