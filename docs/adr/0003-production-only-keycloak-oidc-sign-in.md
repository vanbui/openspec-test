# ADR 0003: Production-only Keycloak OIDC sign-in, behind a flag, fail-closed until Strapi verifies identity

- **Status:** Accepted
- **Date:** 2026-09-29
- **Code:** `apps/csrm/src/lib/auth/`, `apps/csrm/app/api/auth/[...nextauth]/route.ts`, `apps/csrm/instrumentation.ts`

## Context

The web (`apps/csrm`) has always signed people in through a development identity bridge: three fixture identities, a signed cookie, and an `x-csrm-dev-identity` header the transport sends to Strapi. Keycloak authenticates IdamBox identities; Strapi remains the source of application authorization through `IdamBox User -> Role -> Function -> Application`, with `FunctionApi` records supplying operation-level grants (ADR 0002). Today, Strapi trusts the web's full-access API token plus that development header — it does not yet verify a Keycloak-issued token or resolve an `IdamBoxUser` by `externalSubject`.

The request was to exercise real Keycloak identity end to end in the web, without waiting for the Strapi-side verification work, and without weakening production. Two constraints follow directly from that: the OIDC path must never run beside the development bridge (a caller must never be able to get both), and production must not offer a sign-in that Strapi cannot yet authorise.

## Decision

**The flag.** `CSRM_AUTH_OIDC_ENABLED` (default `false`) turns the OIDC path on. `parseOidcEnabledFlag` accepts only unset, empty, `'false'` or `'true'`; anything else throws naming the variable, never the value.

**One predicate, three modes.** `resolveSessionRuntimeMode` gained a third mode, `'oidc'`, checked first: with the flag true it resolves `'oidc'` only under a `next dev` compilation, and `'unavailable'` in every production build, including the attested E2E runtime (D-02, below). With the flag false or unset, its existing `'development' | 'unavailable'` logic is unchanged. Because every existing consumer already gated on `=== 'development'` (the development session adapter, the development sign-in form, and the `x-csrm-dev-identity` header in `server-client.ts`), all of them turn off automatically in OIDC mode with no change to those gates. The two session modes are therefore mutually exclusive by construction, not by convention: nothing can hold both a development role and an OIDC identity.

**The OIDC adapter behind the existing seam.** `OidcSessionAdapter` implements the same `SessionAdapter` interface the development adapter does. `getSessionAdapter()` (kept at its existing import path, `@/lib/auth/development-session-adapter`, since roughly twenty routes and their test mocks depend on it) now switches on `resolveSessionRuntimeMode` and returns whichever adapter mode demands. `Session.developmentRole` became optional: only a development-bridge session carries it, and an OIDC session never does (the assumption-delta "promote" decision recorded in the phase's plan — `Session` is the general representation, and the fixture role is an optional detail of one variant, never both at once).

**Auth.js loaded only through a dynamic import.** `oidc-auth.ts` builds the lazily configured `NextAuth()` instance; `oidc-session-adapter.ts` is its only importer, and only via `import('./oidc-auth')` inside functions that already checked the runtime mode. This keeps `next-auth` and every `AUTH_*` read out of the flag-off path entirely — the development path does not merely skip using Auth.js, it never loads the module.

**Session shape.** JWT strategy, 8-hour `maxAge` (matching the development cookie lifetime). The `jwt` callback keeps only `account.id_token`, added to the token as `idToken`; no access or refresh token is kept, because forwarding those to Strapi is the follow-up's job (D-01, below). The `session` callback returns exactly `{ expires, user: { name, email } }` — no `idToken`, no `sub` — so nothing sensitive reaches `/api/auth/session` or the browser. `pages.signIn`/`pages.error` both point at `/sign-in`, so Auth.js's own built-in HTML pages are never served. `debug: false`, and a custom `logger` that writes only the error's `name` (plus Auth.js's own `type` code when present) or a warning code — never a message, cause, request or config, which is exactly where a token or secret could otherwise leak.

**Empty capability grant until Strapi resolves identity.** `OidcSessionAdapter.capabilitiesFor` always resolves an empty set. This is deliberate fail-closed optimistic UX: the layout already renders `PermissionDeniedState` inside the shell for zero granted capabilities, so a signed-in OIDC user sees their name, "Sign out", and that state — never a page whose data call would 403 from Strapi.

**RP-initiated logout.** `signOut()` reads the `id_token` back through `next-auth/jwt`'s `getToken` (next-auth's docs mark this "not the preferred server-side API", but it is the only place the token can be read, since the session callback must not expose it), clears the Auth.js cookie via the internal `signOut({ redirect: false })`, then redirects to Keycloak's discovery-reported `end_session_endpoint` with `client_id`, `post_logout_redirect_uri` (the `AUTH_URL` origin, matching the realm's registered post-logout URI) and `id_token_hint` when available.

**Startup fail-fast, in two places.** `instrumentation.ts`'s `register()` calls `assertSessionRuntimeConfiguration(process.env)` once, on the `nodejs` runtime, before the server serves a request: an invalid flag, an incomplete or malformed `AUTH_*` value, or the flag set in a production build all stop startup with a clear error. `resolveSessionRuntimeMode` still fails closed at request time if a host somehow ignores that startup error, so the request-time predicate is never the only guard.

**The production-build refusal (D-02).** With the flag true, a production build refuses to start — `instrumentation.ts` throws `OIDC_PRODUCTION_REFUSAL`, which names that Strapi does not yet verify Keycloak identity, and `resolveSessionRuntimeMode` independently resolves `'unavailable'` at request time (so `/api/auth/*` answers 404 and `/sign-in` renders the existing unavailable card even if the startup check were bypassed). `next dev` is the only place OIDC mode runs, signing in against the local Keycloak in `idp/`.

**Harness pins.** `vitest.config.ts` sets `test.env.CSRM_AUTH_OIDC_ENABLED = 'false'`, and `playwright.config.ts` assigns `process.env.CSRM_AUTH_OIDC_ENABLED = 'false'` at module load, after its imports. Both webServer entries and every spec-spawned server inherit that value, so a developer's local `CSRM_AUTH_OIDC_ENABLED=true` cannot switch the unit or E2E suites into OIDC mode; both exercise the development identity bridge unless a test stubs the flag itself.

## Dependency

`next-auth` is pinned to `5.0.0-beta.32` exactly (`--save-exact`; `@auth/core` 0.41.3 as its transitive dependency). Auth.js v5 is still on its beta channel, so a version bump is a deliberate, tested change, never an incidental one from a caret range.

The concrete reason for taking this dependency rather than hand-rolling it on `openid-client` v6 plus `jose` (already a dependency): the authorization-code flow needs PKCE, `state` and nonce handling, an encrypted session cookie, and CSRF protection on its own POST endpoints, plus a maintained Keycloak provider that already matches the realm's discovery document. Reimplementing that security-sensitive surface in this repository is a bigger, riskier undertaking than depending on the library the OIDC ecosystem already tests against a wide set of providers. `openid-client` v6 by hand was the fallback if a concrete blocker with Auth.js v5 appeared; none did.

## Consequences

- Production stays fail-closed on Keycloak sign-in until the Strapi follow-up (below) lands. Nobody can authenticate through Keycloak in a production build today, by design.
- An OIDC user sees the app shell with their name and "Sign out", but every page under `(app)` renders the existing permission-denied state, because the capability grant is always empty. This is expected, not a bug, until Strapi resolves the identity.
- Sign-in and sign-out both need the hydrated client: the existing CSP (`form-action 'self'`, `src/lib/security/content-security-policy.ts`) blocks a no-JS `303` redirect to Keycloak's authorization or end-session endpoint. The CSP is not widened for this; a no-JS visitor's sign-in and sign-out simply do not complete, which is an acceptable, documented limitation rather than a security trade a wider `form-action` would force everywhere.
- The harness pins mean a contributor cannot accidentally flip the automated test suites into OIDC mode by setting the flag in their own shell or `.env.local`.
- Planning-time finding, needed by the Strapi follow-up: Keycloak 26.6.1's `idambox-csrm` client's default scopes are `web-origins, acr, roles, profile, email`, which do not include `basic`. Its **access token carries no `sub` and no `aud`**; only the **ID token** carries `sub`. Strapi-side access-token verification therefore needs a realm client-scope decision before it can map a token to an `IdamBoxUser`.

## Alternatives considered

- **`openid-client` v6 by hand.** Rejected as the default path (see Dependency, above): more security-sensitive code to own, for a spec Auth.js's maintained provider already implements correctly against this realm.
- **A frontend API facade that verifies Keycloak tokens itself.** Rejected: it would duplicate authorization decisions outside Strapi, which `AGENTS.md`'s non-negotiables forbid — Strapi is the production API boundary, and Keycloak authenticates while Strapi authorises.
- **Enabling OIDC in production now, accepting the current dev-header/API-token trust model as good enough.** Rejected: that would be authentication without server-side authorisation of the authenticated identity — Strapi would still only ever see the shared API token, never the individual Keycloak user, for any OIDC-mode request.
- **Granting the Requestor birthright capability set in the web shell for a signed-in OIDC user, optimistically.** Rejected for now: it would render pages whose Strapi calls then fail, which is a worse experience than the current permission-denied state, and capability derivation belongs in Strapi once it can resolve the identity — that is exactly the follow-up's job.

## Follow-up

The Strapi-side work this ADR depends on is drafted, not filed, at `.planning/quick/260929-u0w-add-production-only-oidc-sign-in-to-the-/260929-u0w-FOLLOWUP-ISSUE.md`: a Strapi middleware that verifies a Keycloak access token via the issuer's JWKS, maps `sub` to an `IdamBoxUser.externalSubject` (ADR 0002), and lifts the production refusal in `resolveSessionRuntimeMode` and `assertSessionRuntimeConfiguration` once that verification exists.
