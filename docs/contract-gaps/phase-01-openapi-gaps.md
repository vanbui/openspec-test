# Phase 01 OpenAPI Contract Gaps

The supplied OpenAPI document is the production transport contract. These gaps remain owned by backend integration work; they are not implemented as a Next.js API facade, browser proxy, or competing CSRM model.

| Gap | Owner and boundary | Required future operation | Phase 1 behaviour |
| --- | --- | --- | --- |
| Effective capabilities | IdamBox/Strapi authorization boundary | An authenticated operation that resolves the caller's effective IdamBox Role → Function → FunctionAPI grants, including applicable record-level grants and a stable capability projection for the web client. | The web shell uses only a development fixture behind its capability adapter. It never sends a development role selector to Strapi as authorization, and Strapi remains authoritative for every FunctionAPI and record decision. |
| Keycloak authorization-code callback and session exchange | Keycloak-to-server authentication boundary | A named Keycloak authorization-code callback/session operation with validated `state`, validated internal return path, server-side credential exchange, and a hand-off that Strapi can validate for authorization. The generic `/auth/{provider}/callback` path in the supplied document does not specify this CSRM/Keycloak contract. | The production session adapter stays fail-closed. No client-side callback, credential storage, or Next.js proxy is introduced. |

Future backend work must publish the resulting OpenAPI operations and response schemas before a production web adapter consumes them. Until then, any fixture or HTTP-level test double must remain behind the typed feature-service seam.

## Development identity bridge transport boundary

The development identity bridge requires a Full access Strapi API token as its outer Content API transport credential. Operators provide `CSRM_API_TOKEN` through ignored local web environment configuration. Anonymous access and users-permissions public-role grants are not part of the bridge.

After Strapi authenticates that transport credential, `x-csrm-dev-identity` identifies the development actor and the existing IdamBox Role → Function → FunctionAPI and record-level policies remain the per-user authority. The API token does not replace or widen those decisions.

Isolated browser tests may set `CSRM_DEV_API_TOKEN` to reconcile a deterministic hashed credential only when all three backend development gates are enabled: `NODE_ENV=development`, `CSRM_ENVIRONMENT=development`, and `CSRM_DEV_IDENTITY=true`. Ordinary local Strapi databases leave this variable unset and use the operator-generated token already stored in that database.

Production Keycloak authentication and its Strapi validation hand-off remain Phase 8 work; the development bridge does not define or change that production design.
