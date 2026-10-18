# Phase 3: Keycloak Identity Provider Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25T10:16:46Z
**Phase:** 03-Keycloak Identity Provider Setup
**Areas discussed:** Local credentials and user bootstrap, CSRM OIDC client values, Realm import and reset behavior, Developer command surface

---

## Local Credentials And User Bootstrap

| Question | Options Presented | User's Choice |
|----------|-------------------|---------------|
| For Phase 3 local Keycloak, what credential policy should the imported users use? | Easy local; Env placeholders; Temporary reset | Easy committed local-only credentials |
| Should Jane and Bob be imported as immediately usable local accounts, or should Keycloak require account actions on first login? | Ready to sign in; Verify email; Reset password | Ready to sign in |
| For the local Keycloak admin account in `docker-compose.yml`, should we keep the old template's `admin` / `admin` values? | Keep admin/admin; Use idambox/admin; Env-driven admin | Keep admin/admin |
| What passwords should Jane and Bob use in the imported realm? | Email prefix; Full local names; Shared demo password | Email prefix: `jane` and `bob` |

**Notes:** The setup is local-only and optimized for quick verification.

---

## CSRM OIDC Client Values

| Question | Options Presented | User's Choice |
|----------|-------------------|---------------|
| What should the future CSRM Next.js OIDC client ID be in the Keycloak realm import? | idambox-csrm; csrm-app; nextjs-csrm | `idambox-csrm` |
| What should the local confidential client secret be? | idambox-csrm-local-secret; csrm-local-secret; Generate later | `idambox-csrm-local-secret` |
| What local origin should the future CSRM Next.js app use in Phase 3 Keycloak client settings? | http://localhost:3000; http://localhost:3001; Both 3000 and 3001 | `http://localhost:3000` |
| What redirect settings should Phase 3 import for the future CSRM app? | Auth.js defaults; Wildcard local redirects; Placeholder docs only | Auth.js defaults |

**Notes:** The selected values align with the old Keycloak/Next.js template and the future Phase 6 app path.

---

## Realm Import And Reset Behavior

| Question | Options Presented | User's Choice |
|----------|-------------------|---------------|
| How should Phase 3 bootstrap the Keycloak realm? | Static realm JSON; Startup script/API; Manual admin setup | Static realm JSON |
| Should local Keycloak use a named Docker volume so admin-console changes survive normal restarts? | Named volume; Ephemeral only; Host-mounted data | Named volume |
| How explicit should the reset/import documentation be? | Full reset section; Short note only; No reset docs | Full reset section |
| Should the Phase 3 realm import include only users/client basics, or also Keycloak roles/groups for CSRM authorization? | Users/client only; Add Keycloak realm roles; Add groups only | Users/client only |

**Notes:** Keycloak authenticates users in Phase 3. Strapi remains the source of IdamBox product authorization.

---

## Developer Command Surface

| Question | Options Presented | User's Choice |
|----------|-------------------|---------------|
| How should developers start Keycloak for Phase 3? | From `idp/`; Root script only; Both | From `idp/` |
| What should the root README include for Keycloak? | Quickstart + values; Quickstart only; Pointer only | Quickstart + values |
| Should Phase 3 also add a dedicated `idp/README.md`? | Yes, detailed; Yes, minimal; No | Yes, detailed |
| What should planning assume for Phase 3 verification? | Static + optional Docker; Docker required; Docs only | Static + optional Docker |

**Notes:** Runtime Docker startup should be documented, while automated verification can use static checks.

---

## the agent's Discretion

- The exact static verifier implementation and script name.
- Nonessential Keycloak realm display metadata, if it does not conflict with captured decisions.

## Deferred Ideas

- Phase 4: Strapi-to-Keycloak user provisioning.
- Phase 5: CSRM backend content model.
- Phase 6: CSRM Next.js authentication and user workflows.
- Future milestone: customer IdP brokering configuration.
