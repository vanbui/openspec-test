# CSRM Web

The Next.js App Router workspace for the IdamBox Cyber Risk Manager.

Production data access belongs in server-only feature services that use the Strapi OpenAPI contract. UI navigation and development capabilities are optimistic UX only; Strapi remains the authorization boundary.

Set `CSRM_API_BASE_URL` to the Strapi REST base, including its terminal `/api` segment (for example, `http://localhost:1337/api`). It must be an absolute HTTP(S) URL without credentials, query parameters, or a fragment; reverse-proxy prefixes are supported when they end in `/api`.

## Sign-in modes

The web has two mutually exclusive sign-in modes, chosen by `CSRM_AUTH_OIDC_ENABLED` (`docs/adr/0003-production-only-keycloak-oidc-sign-in.md`). They never run together: `resolveSessionRuntimeMode` is the single predicate that decides which one is active.

### (a) Development identity bridge (default)

`CSRM_AUTH_OIDC_ENABLED` false or unset. This is the existing behaviour: `/sign-in` offers three fixture identities, `CSRM_DEV_IDENTITY=true` sends the corresponding `x-csrm-dev-identity` header to Strapi, and no Keycloak is needed. The unit test harness and the Playwright suite both pin the flag off (`vitest.config.ts`, `playwright.config.ts`), so a developer's local override never changes what they exercise.

### (b) Keycloak OIDC (`CSRM_AUTH_OIDC_ENABLED=true`)

Local walkthrough:

1. `docker compose up -d` in `docker/`.
2. Copy the `AUTH_*` lines from `.env.local.example` into `apps/csrm/.env.local`, and generate `AUTH_SECRET` with `openssl rand -base64 32`.
3. `pnpm --filter @csrm/web dev` (port 3000).
4. Run Strapi with `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true` (see `apps/backend/README.md`, "Keycloak access-token verification") and `IDAMBOX_SEED_CSRM=true`, so the seeded Jane and Bob are linked to their fixed Keycloak ids.
5. Sign in as `jane.doe` / `jane` for the Requestor screens, or `bob.doe` / `bob` for the Security Analyst ones. Strapi verifies the forwarded access token and decides what each person may reach (`docs/adr/0004-strapi-verifies-keycloak-access-tokens.md`).
6. Open the account menu (your initials, top right of the screen) and choose "Sign out", which ends the Keycloak session and returns to `http://localhost:3000`.

If you started `docker/` before the realm gained the `basic` scope, audience mapper and fixed user ids, run `docker compose down -v` there once so the realm is re-imported; otherwise the permission-denied state persists.

`AUTH_KEYCLOAK_SECRET=idambox-csrm-local-secret` is a local-only value from `docker/README.md`. Never reuse it outside local development.

Startup errors to expect: an invalid `CSRM_AUTH_OIDC_ENABLED` value, or any missing or malformed `AUTH_*` value, stops the server naming the variable and never its value. In production, `AUTH_URL` and `AUTH_KEYCLOAK_ISSUER` must be `https://`.

In OIDC mode the web sends Strapi the caller's own Keycloak access token in `x-csrm-identity-token`, beside the `CSRM_API_TOKEN` it always sends, refreshes that token shortly before it expires (`proxy.ts` persists the refreshed cookie), and takes its navigation capabilities from Strapi's `GET /api/v1/me/access`.

Sign-in and sign-out both rely on the hydrated client: the CSP's `form-action 'self'` blocks a no-JS redirect to Keycloak's authorization or end-session endpoint.

### (c) Production setup

1. Register a confidential OpenID Connect client with the Standard flow and PKCE S256.
2. Callback URL `https://<host>/api/auth/callback/keycloak`, post-logout redirect `https://<host>`.
3. Give the client the `basic` default client scope and an audience mapper adding the client id to the access token (the local realm in `docker/keycloak/import/idambox-realm.json` is the reference shape).
4. Supply `AUTH_URL`, `AUTH_SECRET`, `AUTH_KEYCLOAK_ID`, `AUTH_KEYCLOAK_SECRET` and `AUTH_KEYCLOAK_ISSUER` from the deployment's secret store, never committed, plus `CSRM_API_TOKEN`.
5. Serve over TLS.
6. Turn on `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION` in Strapi against the same issuer and client, and link every IdamBox User to Keycloak through `externalSubject` (Keycloak user provisioning does this). See `docs/adr/0004-strapi-verifies-keycloak-access-tokens.md`.

## Package scope

`@csrm/web` is the private CSRM App Router application, part of the [IdamBox CSRM workspace](../../README.md). Install workspace dependencies from the repository root rather than installing this package as a published library.

## Usage

From the repository root:

```bash
pnpm --filter @csrm/web dev
pnpm --filter @csrm/web build
```

Routes compose feature UI with server-only typed services. See [Frontend components](../../docs/frontend/components.md), [Architecture](../../docs/architecture/overview.md) and [Configuration](../../docs/configuration/configuration.md).

## Testing

From the repository root:

```bash
pnpm --filter @csrm/web typecheck
pnpm --filter @csrm/web api:check
pnpm --filter @csrm/web test
pnpm --filter @csrm/web test:e2e
```

The browser harness starts isolated servers and uses its own database, attachment directory and build. See [Testing](../../docs/guides/testing.md) for Chromium setup, selected tests and artifact retention.
