---
phase: 04
status: complete
created: 2026-05-25T20:30:00Z
---

# Phase 04 Pattern Map

## Existing Analogs

| Planned Area | New/Modified Files | Closest Existing Analog | Pattern To Reuse |
|--------------|--------------------|-------------------------|------------------|
| Keycloak realm admin client seed | `idp/keycloak/import/idambox-realm.json` | Existing `idambox-csrm` client in the same file | Add a new client record with explicit local-only secret and boolean protocol flags. |
| Keycloak docs | `idp/README.md`, `README.md` | Phase 3 Keycloak quickstart sections | Keep local-only warnings, OIDC values, reset notes, and verification commands explicit. |
| Backend env docs | `apps/backend/.env.example`, `apps/backend/README.md` | Existing `IDAMBOX_SEED_CORE` / `IDAMBOX_SEED_CSRM` flags | Add opt-in flag plus related env vars; disabled by default. |
| Backend integration registration | `apps/backend/src/index.ts` | Existing `seedCoreData(strapi)` and `seedCsrmData(strapi)` registration | Keep `src/index.ts` as the Strapi integration entry point and delegate detailed logic to imported helpers. |
| IdamBox user lookup/update | backend provisioning helper | `apps/backend/src/bootstrap/seed-csrm-data.ts` | Use Strapi document services, lookup by unique email, update by `documentId`. |
| Static verification | `scripts/verify-keycloak-provisioning.mjs` | `scripts/verify-keycloak-idp.mjs`, `scripts/verify-csrm-seed.mjs` | Parse JSON where possible, assert exact strings only for docs/source contracts, expose root package script. |

## Implementation Notes

- Keep the Keycloak admin client separate from the CSRM OIDC client. The admin client is service-account-only and must not gain browser redirect settings.
- Keep product authorization in Strapi. Do not add CSRM realm roles or groups as part of Phase 4.
- Use `externalSubject` as the Keycloak user ID sink; do not add a new schema field unless execution proves `externalSubject` is insufficient.
- Treat `password` as transient input. Static verification should check that provisioning code clears it after success.

