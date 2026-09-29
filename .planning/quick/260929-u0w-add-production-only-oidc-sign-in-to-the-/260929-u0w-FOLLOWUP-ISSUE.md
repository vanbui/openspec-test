# Strapi: verify Keycloak access tokens and resolve IdamBoxUser by externalSubject (unblocks CSRM_AUTH_OIDC_ENABLED in production)

**Suggested labels:** `ready-for-agent`

## Problem

The web (`apps/csrm`) now signs in against Keycloak using Auth.js v5, behind the flag `CSRM_AUTH_OIDC_ENABLED` (`docs/adr/0003-production-only-keycloak-oidc-sign-in.md`). Strapi, however, authorises every CSRM call only through the web's full-access API token plus the `x-csrm-dev-identity` development header (`apps/backend/src/middlewares/csrm-development-identity.ts`, `apps/backend/src/policies/csrm-authorization.ts`) — it has no path that verifies a Keycloak-issued token or resolves the authenticated person's `IdamBoxUser` record. Because of that gap, production builds of the web currently refuse to start with the flag set to `true` at all (`resolveSessionRuntimeMode` and `assertSessionRuntimeConfiguration` both fail closed), and a signed-in OIDC user in `next dev` sees an empty capability grant and the permission-denied state everywhere, by design.

This issue is the Strapi-side work that lifts that refusal.

## Planning-time evidence

- Keycloak 26.6.1's `idambox-csrm` client's default scopes are `web-origins, acr, roles, profile, email` — they do not include `basic`.
- As a direct result, the **access token** Keycloak issues to `idambox-csrm` carries **no `sub` and no `aud`**. Only the **ID token** carries `sub`. A realm client-scope decision is needed before any access-token verification can map a token to a user.
- `apps/backend/src/policies/csrm-authorization.ts` denies any call whose `context.state.idamboxUser` is unset. `apps/backend/src/middlewares/csrm-development-identity.ts` is the only thing that currently sets it, from the trusted development header.
- `externalSubject` on `IdamBoxUser` already exists and holds the Keycloak user id, from the provisioning work in ADR 0002 (`apps/backend/src/keycloak/`).

## Proposed design

1. **Realm change (needs an explicit decision, not silently applied):** add the `basic` scope (or equivalent) to `idambox-csrm` so its access token carries `sub`, and add an audience mapper so the access token carries an `aud` (or `azp`) this middleware can check.
2. **A Strapi middleware verifies a Keycloak access token server-side** via the issuer's JWKS (`jose`'s `createRemoteJWKSet`, already a dependency of `apps/backend`). It checks `iss`, `exp`, and `azp` or an audience against the expected client.
3. **Map `sub` to an active `IdamBoxUser.externalSubject`** and set `context.state.idamboxUser`, sitting beside or replacing `csrm-development-identity.ts`'s job. An inactive or unmatched user is denied, the same way an absent header is today.
4. **Decide the transport contention:** the web's OIDC-mode `server-client.ts` needs to send the caller's Keycloak access token without colliding with the users-permissions API token that already occupies `Authorization` (`apiTokenHeader` in `apps/csrm/src/lib/api/transport/server-client.ts`). A second header (analogous to `x-csrm-dev-identity`, but carrying a bearer token instead of an email) is the leading option; record the final choice in an ADR.
5. **The web's Auth.js `jwt` callback keeps the access and refresh tokens**, with refresh rotation, once Strapi can consume them (`oidc-auth-options.ts` currently keeps only `id_token`, by design, because there was nothing to forward it to).
6. **`server-client.ts` forwards the access token in OIDC mode**, replacing today's "OIDC mode never sends an identity header" behaviour with "OIDC mode sends the caller's own token".
7. **The web shell derives capabilities from Strapi** once the identity resolves (Requestor birthright plus any explicit roles), replacing `OidcSessionAdapter.capabilitiesFor`'s always-empty grant.
8. **Lift the production refusal** in `resolveSessionRuntimeMode` (`apps/csrm/src/lib/auth/development-runtime.ts`) and `assertSessionRuntimeConfiguration` (`apps/csrm/src/lib/auth/oidc-configuration.ts`), and require `https://` for `AUTH_URL` and the issuer whenever `NODE_ENV=production`.

## Acceptance criteria

- [ ] Authorization-matrix and served-operations tests cover token-authenticated calls (a valid Keycloak access token resolves the correct `IdamBoxUser` and its granted capabilities), alongside the existing development-header and API-token coverage.
- [ ] An invalid, expired, or wrong-audience/issuer token is denied, with no information about why leaked back to the caller beyond the existing 401/403 shape.
- [ ] An inactive `IdamBoxUser` (or one with no matching `externalSubject`) is denied even with an otherwise valid token.
- [ ] No development header (`x-csrm-dev-identity`) is honoured when OIDC verification is available and active; the two identity paths stay mutually exclusive, the way `resolveSessionRuntimeMode` already keeps the web's own two session modes exclusive.
- [ ] A production build and `next start` with `CSRM_AUTH_OIDC_ENABLED=true` succeed once the above lands, and an end-to-end sign-in against Keycloak reaches a fully authorised page (no permission-denied state for a role that should have access).
- [ ] The realm client-scope change (`basic` scope, audience mapper) is applied to `idp/keycloak/import/idambox-realm.json` and documented, not just made by hand in a running Keycloak.

## Out of scope

- Refresh-token rotation UX (silent re-authentication on expiry) beyond what Auth.js's `jwt` callback already provides.
- Any change to the Requestor birthright or Security Analyst explicit-role model itself (ADR 0002's terms stand).
- Broker-mode Keycloak (federating to a customer IdP) — `idp/README.md`'s "Broker Boundary" section already flags that as later work.

## References

- `docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md`
- `docs/adr/0003-production-only-keycloak-oidc-sign-in.md`
- `apps/csrm/src/lib/auth/oidc-configuration.ts`, `oidc-session-adapter.ts`, `oidc-auth-options.ts`, `development-runtime.ts`
- `apps/csrm/src/lib/api/transport/server-client.ts`
- `apps/backend/src/policies/csrm-authorization.ts`, `apps/backend/src/middlewares/csrm-development-identity.ts`
- `apps/backend/src/keycloak/`
- `idp/README.md`, `idp/keycloak/import/idambox-realm.json`
