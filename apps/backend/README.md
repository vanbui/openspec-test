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
- `Application Role`
- `Role`
- `IdamBox User`

Effective access is derived through:

```text
IdamBoxUser -> Role -> ApplicationRole -> Application
```

## Optional Sample Data

Set `IDAMBOX_SEED_CORE=true` before startup to seed sample application records and LMS application roles:

- IdamBox IAM
- IdamBox Compliance
- IdamBox Automation
- IdamBox Crypto Manager
- IdamBox LMS with `STUDENT` and `TUTOR`
- IdamBox Cyber Risk Manager

The seed is disabled by default and is intended for local verification only.

## Out Of Scope For Phase 1

- Auth0 end-user authentication
- Next.js application modules
- Fine-grained permission strings
- Production deployment automation
