# IdamBox Strapi Backend

This app is the Phase 1 backend foundation for IdamBox.

## Run Locally

From the repository root:

```powershell
yarn install
Copy-Item apps/backend/.env.example apps/backend/.env
yarn develop:cms
```

Open `http://localhost:1337/admin` and create the first Strapi administrator account when prompted.

## Environment

Use `apps/backend/.env.example` as the local template. Generate real values for:

- `APP_KEYS`
- `API_TOKEN_SALT`
- `ADMIN_JWT_SECRET`
- `TRANSFER_TOKEN_SALT`
- `ENCRYPTION_KEY`

SQLite is the default local database. PostgreSQL settings are included as commented examples for later environments.

## Collections

The backend defines four core collection types:

- `Application`
- `Entitlement`
- `Role`
- `IdamBox User`

Strapi Content Manager reserves the request field `status` for document publication state. Use `accountStatus` for `IdamBox User` records and `applicationStatus` for `Application` records.

Effective access is derived through:

```text
IdamBoxUser -> Role -> Entitlement -> Application
```

## Optional Sample Data

Set `IDAMBOX_SEED_CORE=true` before startup to seed sample application records and entitlements:

- IdamBox IAM
- IdamBox Compliance
- IdamBox Automation
- IdamBox Crypto Manager
- IdamBox LMS with `LMS STUDENT` and `LMS TUTOR`
- IdamBox Cyber Risk Manager

The seed is disabled by default and is intended for local verification only.

Set `IDAMBOX_SEED_CSRM=true` before startup to seed CSRM sample users. Requires `IDAMBOX_SEED_CORE=true` first so CSRM entitlements and roles exist:

- `IdamBox User`: Jane Doe (`jane.doe`, `jane.doe@idambox.com`), active with no roles
- `IdamBox User`: Bob Doe (`bob.doe`, `bob.doe@idambox.com`), active and assigned to `CSRM Security Analyst`

Keycloak, CSRM assessment content types, and the CSRM Next.js application are later phases.

## Optional Keycloak Provisioning

Set `IDAMBOX_KEYCLOAK_PROVISIONING=true` to provision custom `IdamBox User` records into Keycloak when users are created or updated in Strapi. Provisioning is disabled by default.

Local development values:

```env
IDAMBOX_KEYCLOAK_PROVISIONING=true
KEYCLOAK_BASE_URL=http://localhost:8080
KEYCLOAK_REALM=idambox
KEYCLOAK_ADMIN_CLIENT_ID=idambox-strapi-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=idambox-strapi-admin-local-secret
```

The `idambox-strapi-admin-local-secret` value is local-only and must not be reused outside local development. Strapi uses the dedicated `idambox-strapi-admin` service-account client for Keycloak Admin API calls, not the bootstrap `admin` / `admin` account. Strapi-created users are created in the existing `idambox` realm.

When provisioning is enabled, a Keycloak API failure blocks the Strapi user save so Strapi and Keycloak do not silently drift. To verify the local runtime path, start Keycloak from `idp/` with `docker compose up -d`, run Strapi with the environment values above, create or update an `IdamBox User`, and inspect the matching user in the Keycloak `idambox` realm. If the realm import needs to be reset after changing `idp/keycloak/import/idambox-realm.json`, run `docker compose down -v` from `idp/`.

## Out Of Scope For Phase 1

- Auth0 end-user authentication
- Next.js application modules
- Fine-grained permission strings
- Production deployment automation
