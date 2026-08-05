# IdamBox Platform

IdamBox is the shared platform foundation for BProton application modules such as IdamBox IAM, IdamBox Compliance, IdamBox Automation, IdamBox Crypto Manager, IdamBox LMS, and IdamBox Cyber Risk Manager.

Phase 1 contains only the shared Strapi backend. Future application modules will be added as separate Next.js apps under `apps/*`.

## Workspace

This repository follows the closest provided example project shape:

- `apps/backend` - Strapi backend
- `apps/*` - future Next.js application modules
- `packages/*` - future shared packages

The workspace uses Yarn workspaces and Turbo.

## Prerequisites

- Node.js 18 through 22
- Yarn 1.22.x

## Setup

```powershell
yarn install
Copy-Item apps/backend/.env.example apps/backend/.env
```

Before running Strapi, replace the placeholder secrets in `apps/backend/.env`.

## Development

Strapi backend is now dependent on Keycloak, so before launching the Strapi backend, please follow the instructions in the idp/README.md file to start up Keycloak. Basically run:

```
cd idp
docker compose up -d
```

Wait 1 minute for Keycloak to be ready then start the Strapi backend:

```powershell
yarn develop:cms
```

Strapi runs on `http://localhost:1337` by default. The admin panel is available at `http://localhost:1337/admin`.

## Keycloak Identity Provider

Phase 3 adds a local-only Keycloak identity provider under `idp/` for the future CSRM Next.js app. It does not wire Next.js login yet, and product authorization remains in Strapi through `IdamBoxUser -> Role -> Entitlement -> Application`.

Start Keycloak from the `idp/` directory:

```powershell
cd idp
docker compose up -d
docker compose logs -f keycloak
```

The admin console runs at `http://localhost:8080/admin`.

Local-only credentials and secrets:

| Purpose                        | Value                               |
| ------------------------------ | ----------------------------------- |
| Keycloak admin username        | `admin`                             |
| Keycloak admin password        | `admin`                             |
| Jane Doe login                 | `jane.doe` / `jane`                 |
| Jane Doe email                 | `jane.doe@idambox.com`              |
| Bob Doe login                  | `bob.doe` / `bob`                   |
| Bob Doe email                  | `bob.doe@idambox.com`               |
| CSRM client ID                 | `idambox-csrm`                      |
| CSRM client secret             | `idambox-csrm-local-secret`         |
| Strapi admin API client ID     | `idambox-strapi-admin`              |
| Strapi admin API client secret | `idambox-strapi-admin-local-secret` |

OIDC values for local CSRM development:

| Setting              | Value                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| Issuer               | `http://localhost:8080/realms/idambox`                                  |
| Discovery URL        | `http://localhost:8080/realms/idambox/.well-known/openid-configuration` |
| Callback URL         | `http://localhost:3000/api/auth/callback/keycloak`                      |
| Post-logout/home URL | `http://localhost:3000`                                                 |
| Web origin           | `http://localhost:3000`                                                 |

These committed credentials are local-only development values and must not be reused outside local development.

Keycloak imports `idp/keycloak/import/idambox-realm.json` on first startup. If the `idambox` realm already exists in the `keycloak_data` Docker volume, startup import skips it. To force a clean re-import after changing the realm JSON, run this from `idp/`:

```powershell
docker compose down -v
docker compose up -d
```

Keycloak is the IdamBox OIDC provider. A future phase may configure it to broker Auth0, Ping Access Management, Okta, or Entra ID while keeping the application-facing issuer and client contract stable.

## Strapi To Keycloak Provisioning

Set `IDAMBOX_KEYCLOAK_PROVISIONING=true` in `apps/backend/.env` to provision custom Strapi `IdamBox User` records into the Keycloak `idambox` realm. Provisioning is disabled by default and requires the dedicated local service-account client:

```env
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=idambox
KEYCLOAK_ADMIN_CLIENT_ID=idambox-strapi-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=idambox-strapi-admin-local-secret
```

The `idambox-strapi-admin-local-secret` value is local-only and must not be reused outside local development. Strapi uses this dedicated client for Keycloak Admin API calls, not the bootstrap `admin` / `admin` account.

When provisioning is enabled, a Keycloak API failure blocks the Strapi user save so Strapi and Keycloak do not silently drift. For local runtime verification, start Keycloak from `idp/`, run the backend with the provisioning env vars above, create or update an `IdamBox User`, and inspect the matching user in the Keycloak `idambox` realm. Use `docker compose down -v` from `idp/` to force a clean realm re-import after changing the checked-in realm JSON.

## Core Data Model

Phase 1 implements this access model:

```text
IdamBoxUser -> Role -> Entitlement -> Application
```

- `IdamBoxUser` is a custom product user collection, separate from Strapi admin users.
- `Role` is a reusable bundle assigned to one or more IdamBox users.
- `Entitlement` is a permission defined by one application, such as `LMS STUDENT` or `LMS TUTOR`.
- `Application` represents an IdamBox module such as IAM, LMS, or Cyber Risk Manager.

Strapi Content Manager reserves the request field `status` for document publication state. IdamBox domain state uses `accountStatus` on `IdamBoxUser` and `applicationStatus` on `Application`.

## CSRM Backend Model

Phase 5 adds the backend-only CSRM content model in Strapi: `csrm-assessment-request`, `csrm-information-asset`, `csrm-information-system`, `csrm-questionnaire`, `csrm-question`, `csrm-assessment`, `csrm-risk`, `csrm-control`, reusable `csrm-risk-type` definitions, and `csrm-control-implementation` records.

Set `csrmAppIsEnabled=true` to enable application-facing CSRM routes. When the flag is false, CSRM schemas may still be registered in Strapi, but CSRM API behavior is guarded. CSRM Next.js workflows, request transitions, and Keycloak/OIDC login screens belong to Phase 6 or later.

## Authentication Boundary

Phase 1 uses native Strapi admin authentication only, so administrators can create and edit records in Strapi.

Auth0 authentication for end users is intentionally deferred until Next.js application modules are added.

## Verification

Run the static project verifiers:

```powershell
yarn verify:keycloak-idp
yarn verify:keycloak-provisioning
yarn verify:schema
yarn verify:csrm-model
yarn verify:csrm-seed
```

After dependencies are installed, also run:

```powershell
yarn check-types
yarn build
```
