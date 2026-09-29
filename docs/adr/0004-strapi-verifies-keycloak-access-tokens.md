# ADR 0004: Strapi verifies Keycloak access tokens and serves the caller's own effective access

- **Status:** Accepted
- **Date:** 2026-09-30
- **Supersedes:** the production refusal and the empty capability grant in [ADR 0003](0003-production-only-keycloak-oidc-sign-in.md)
- **Code:** `apps/backend/src/keycloak/`, `apps/backend/src/middlewares/csrm-keycloak-identity.ts`, `apps/backend/src/api/csrm-current-user/`, `apps/csrm/src/lib/auth/`, `apps/csrm/src/lib/capabilities/strapi-capabilities.ts`, `apps/csrm/src/lib/api/transport/`, `apps/csrm/proxy.ts`, `idp/keycloak/import/idambox-realm.json`

## Context

ADR 0003 let the web sign people in through Keycloak but left Strapi unable to tell who they were: it still trusted only the web's full-access API token plus the development `x-csrm-dev-identity` header. So an OIDC session was granted no capability, every page under `(app)` rendered the permission-denied state, and a production build refused `CSRM_AUTH_OIDC_ENABLED=true` outright. Keycloak authenticates; Strapi must enforce `IdamBox User -> Role -> Function -> FunctionApi` for the person actually signed in (`AGENTS.md`).

Planning found that the realm's `idambox-csrm` access token carried no `sub` and no `aud`: the client's default scopes did not include `basic`.

## Decision

**Realm.** `idambox-csrm` gains the `basic` default client scope (so the access token carries `sub`) and an `oidc-audience-mapper` that adds `idambox-csrm` to the access token's `aud`. The local fixture people get fixed Keycloak ids, which the local development seed writes to their `externalSubject` (`apps/backend/src/keycloak/development-fixture-subjects.ts`, only while provisioning is off; with provisioning on, ADR 0002 writes back the id Keycloak assigned). Verified against Keycloak 26.6.1: the access token now carries `sub`, `aud: idambox-csrm`, `azp: idambox-csrm` and `typ: Bearer`; the ID token carries the same `aud` but `typ: ID`.

**Transport.** The web forwards the caller's own access token in `x-csrm-identity-token`. `Authorization` stays with the users-permissions API token, which every CSRM route still requires (`content-api-token`), so the outer gate is unchanged and the two credentials never contend for one header. In OIDC mode the API token is mandatory, as it already was for the development bridge.

**Verification in Strapi.** `global::csrm-keycloak-identity`, beside the development-identity middleware, is inert unless `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true`. When on, it requires `KEYCLOAK_ISSUER` (https in production) and `KEYCLOAK_TOKEN_CLIENT_ID`, and stops the boot naming any missing or malformed variable, never its value. It verifies with `jose` against the realm JWKS (`createRemoteJWKSet`, cached and re-fetched on an unknown `kid`): RS256 only, exact `iss`, `exp`/`nbf` with 5 s tolerance, the client in `aud`, `azp` equal to the client, `typ: "Bearer"` (the check that keeps an ID token, which shares the `aud`, from standing in for an access token), and a `sub`. The `sub` must match exactly one **active** IdamBox User's `externalSubject`. Anything else leaves `idamboxUser` unset, so `csrm-authorization` answers the same 403 an absent identity always has; the reason is logged by error name only, never with the token.

**Mutually exclusive identity paths.** While verification is on, the development header is ignored whatever `CSRM_DEV_IDENTITY` says. Development seeding still runs, so a developer can exercise Keycloak sign-in against the seeded fixtures.

**The caller's own access: `GET /api/v1/me/access`.** A new catalogued operation, granted through the API-only *Current User Access API* Function to all three Roles (so the Requestor birthright alone is enough). It returns the display name, the menu Functions (those with a `menuPath`) and the FunctionApi urls the caller is granted, computed by the same primitives `csrm-authorization` uses: Requestor birthright plus explicit Roles, and a human-analyst-only operation only through the human Security Analyst Role. Route-level scope checks still apply on every call, so the list is never wider than the policy. It is documented in `specification.json`, catalogued, and recorded in `served-operations.json`.

**Web capabilities from Strapi.** `OidcSessionAdapter.capabilitiesFor` now asks `/v1/me/access` and maps operations to the five web capabilities (`strapi-capabilities.ts`). Each capability is anchored to the operations its screens depend on and is held only when every anchor is granted; any failure grants nothing. This is presentation only: Strapi authorises every call. The development bridge keeps its fixture mapping.

**Token lifecycle in the web.** The Auth.js `jwt` callback keeps the id, access and refresh tokens (in the encrypted cookie only; the `session` callback still exposes none of them, only a `RefreshTokenError` code after a failed refresh). It refreshes the access token 60 s before expiry via the realm token endpoint (`transport/keycloak-token-client.ts`, the only place outside the Strapi client that calls `fetch`). A Server Component cannot write cookies, so `proxy.ts`, in OIDC mode only, runs the Auth.js session read when the token is inside its refresh window, sends the new cookie to the browser and forwards it on the same request so the render reads the fresh token. It writes nothing otherwise, and never on a server action or `/api/auth/*`, because Auth.js re-issues the session cookie on every read and an unconditional write would race sign-out. A failed refresh ends the session; the layout sends the visitor through sign-in again.

**Production.** `resolveSessionRuntimeMode` resolves `'oidc'` for a production build run as production, and `instrumentation.ts` no longer refuses the flag. In production, `AUTH_URL` and `AUTH_KEYCLOAK_ISSUER` must be https.

## Consequences

- Signing in as `bob.doe` shows the Security Analyst navigation and pages; `jane.doe` sees the Requestor ones. Strapi, not the web, decides.
- A deployment that turns on `CSRM_AUTH_OIDC_ENABLED` must also turn on `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION` in Strapi, apply the realm changes, and have every IdamBox User linked through `externalSubject` (provisioning does this). Otherwise signed-in people see the permission-denied state, which is fail-closed.
- An existing local Keycloak volume keeps its old realm: `docker compose down -v` in `idp/` re-imports the new one.
- Keycloak's default access-token lifespan is 5 minutes and the refresh token's 30. The refresh keeps an active session alive; an idle one ends and needs sign-in again.
- `jose` 6.1.3 is now a direct Strapi dependency (the same exact version the web pins) for JWKS verification.

## Alternatives considered

- **Replace the API token with the user's token in `Authorization`.** Rejected: users-permissions would try to verify the Keycloak token as its own JWT, and every route's `content-api-token` gate would have to change at once.
- **Match the Keycloak token to an IdamBox User by email.** Rejected: `externalSubject` is the stable identifier ADR 0002 already writes back; email linking invites account takeover through a changed or unverified email.
- **Identity-only `/v1/me/access` without a FunctionApi grant.** Rejected in favour of a catalogued grant, so every served operation stays traceable through Role -> Function -> FunctionApi.
- **Refresh in Server Components only.** Rejected: the refreshed cookie would never persist, so the stored refresh token would expire 30 minutes after sign-in.
