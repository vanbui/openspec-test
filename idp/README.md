# IdamBox Keycloak Identity Provider

This directory contains the local-only Keycloak identity provider for IdamBox development. The committed admin password, user passwords, and OIDC client secret are intentionally easy local development values and must not be reused outside local development.

Phase 3 only provides the identity provider. It does not wire Next.js login, Strapi provisioning, or CSRM runtime authentication. Product authorization remains in Strapi through `IdamBoxUser -> Role -> Function -> Application`, with FunctionApi records supplying operation-level grants; do not add CSRM authorization Roles, Functions, FunctionApi grants, or groups in Keycloak for this phase.

## Quickstart

Run Keycloak from this directory:

```powershell
docker compose up -d
docker compose logs -f keycloak
```

If the Keycloak Docker container had been launched previously then run this command to start the Keycloak Docker container instead:

```powershell
docker compose start
```

Open the admin console and login as admin/admin:

```text
http://localhost:8080/admin
```

Stop the container and keep the imported realm data:

```powershell
docker compose stop
```

Stop the container and remove the named volume so the checked-in realm JSON imports again on the next startup:

```powershell
docker compose down -v
```

## Local-Only Credentials

| Purpose                        | Value                               |
| ------------------------------ | ----------------------------------- |
| Keycloak admin username        | `admin`                             |
| Keycloak admin password        | `admin`                             |
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

When Docker is available, runtime verification is:

```powershell
docker compose up -d
docker compose logs keycloak
curl -f http://localhost:8080/realms/idambox/.well-known/openid-configuration
docker compose down
```

If port `8080` is already in use, stop the conflicting local service or change the host port mapping in `docker-compose.yml` for your local machine.
