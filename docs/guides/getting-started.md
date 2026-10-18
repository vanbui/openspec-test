<!-- generated-by: gsd-doc-writer -->
# Getting started

## Prerequisites

- Node.js `>=24.19.0 <25` and pnpm `11.24.0`, from the root package manifest.
- Git and a local checkout.
- Docker Compose only if you want the local Keycloak identity provider.
- Chromium for browser tests; see [Testing](testing.md).

The default local database is SQLite. The deterministic AI provider and development attachment scanner need no external AI service or antivirus daemon.

## Installation steps

Clone the repository using your authorised Git remote, then enter its root. Run:

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env
cp apps/csrm/.env.local.example apps/csrm/.env.local
```

Do not overwrite existing local environment files. The examples enable development seeds, the fixture identity bridge and CSRM routes. Replace placeholder secrets before using any non-development environment.

## First run

1. Run `pnpm dev` from the root to start Strapi and Next.js.
2. At http://localhost:1337/admin, complete initial administrator setup. Under **Settings → API Tokens**, create a **Full access** token.
3. Put the token in `CSRM_API_TOKEN` in the web's ignored .env.local, then restart the servers.
4. Visit http://localhost:3000. Development sign-in offers fixture identities; the seeded Requestor and Security Analyst exercise different access scopes.

The server token is the transport credential. Strapi still checks each person's IdamBox grants and record scope.

## Local Keycloak sign-in

[The identity-provider README](../../docker/README.md) describes the Compose service and realm import. Start it from its directory:

```bash
cd docker
docker compose up -d
```

Return to the repository root. In the backend environment enable `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true` and use the local issuer and token client from its example. In the web environment enable `CSRM_AUTH_OIDC_ENABLED=true` and configure all five AUTH_* values from its example. Generate AUTH_SECRET with `openssl rand -base64 32`. Keep `CSRM_API_TOKEN` configured.

Use the imported local accounts described in the identity-provider README. Optional Keycloak provisioning mirrors IdamBox User changes and passwords; its configuration and failure behaviour are described in [Backend README](../../apps/backend/README.md). Start Keycloak before Strapi when provisioning is enabled.

An existing Keycloak realm is not replaced by an import at startup. If your local realm is old, follow the reset guidance in the identity-provider README, understanding that deleting its volume removes local realm changes.

To return to fixtures, disable the web OIDC flag and backend token-verification flag, then restart both applications.

## Common setup issues

| Symptom | Check |
|---|---|
| Wrong Node or pnpm version | Match the root engines and packageManager fields |
| API reads denied | Replace the token placeholder; confirm CSRM routes and backend development gates are enabled |
| OIDC startup error | Supply all AUTH_* values, a secret of at least 32 characters, and valid registered URLs |
| OIDC signed in with no access | Enable backend token verification; check issuer/client and the IdamBox User externalSubject |
| Port already in use | Default web port is 3000 and Strapi port is 1337; stop the conflicting local service or configure its port |
| Attachments unavailable outside development | Configure both storage and scanner; see [Configuration](../configuration/configuration.md) |

## Next steps

Read [Development](development.md) for scripts and conventions, [Testing](testing.md) for isolated test harnesses, and [Architecture](../architecture/overview.md) for the production boundary.
