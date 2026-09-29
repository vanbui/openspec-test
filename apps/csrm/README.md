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

1. `docker compose up -d` in `idp/`.
2. Copy the `AUTH_*` lines from `.env.local.example` into `apps/csrm/.env.local`, and generate `AUTH_SECRET` with `openssl rand -base64 32`.
3. `pnpm --filter @csrm/web dev` (port 3000).
4. Sign in as `jane.doe` / `jane`. The shell shows "Signed in as Jane Doe" and the permission-denied state, because Strapi does not yet authorise Keycloak identities (the tracked follow-up).
5. Click "Sign out", which ends the Keycloak session and returns to `http://localhost:3000`.

`AUTH_KEYCLOAK_SECRET=idambox-csrm-local-secret` is a local-only value from `idp/README.md`. Never reuse it outside local development.

Startup errors to expect: an invalid `CSRM_AUTH_OIDC_ENABLED` value, or any missing or malformed `AUTH_*` value under `next dev`, stops the server naming the variable and never its value. The flag set to `true` in a production build stops the server naming that Strapi does not yet verify Keycloak identity.

Sign-in and sign-out both rely on the hydrated client: the CSP's `form-action 'self'` blocks a no-JS redirect to Keycloak's authorization or end-session endpoint.

### (c) Production setup

1. Register a confidential OpenID Connect client with the Standard flow and PKCE S256.
2. Callback URL `https://<host>/api/auth/callback/keycloak`, post-logout redirect `https://<host>`.
3. Supply `AUTH_URL`, `AUTH_SECRET`, `AUTH_KEYCLOAK_ID`, `AUTH_KEYCLOAK_SECRET` and `AUTH_KEYCLOAK_ISSUER` from the deployment's secret store, never committed.
4. Serve over TLS.

Production builds currently refuse `CSRM_AUTH_OIDC_ENABLED=true` outright until the Strapi-side Keycloak token verification follow-up lands: see `docs/adr/0003-production-only-keycloak-oidc-sign-in.md`.
