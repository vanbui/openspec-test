# API Coverage — committed Strapi OpenAPI surface

> Full coverage by default. Opt-outs are explicit, reasoned runtime-service decisions. Source: `apps/csrm/docs/references/specification.json` (SHA-256 `745c325bf6f586ee0e1bbf433bfe9f54478a34298004ae4d908d1fe6fa34607a`).

Phase 6 generates and commits TypeScript transport types for **all 103 operations** below. The decision column governs handwritten runtime service methods in this phase: `application/get/applications` is the one foundation tracer; every other operation remains typed but has no callable service adapter until the cited owning roadmap phase (or is intentionally outside the CSRM frontend). The separate FunctionApi catalogue is authorization/capability evidence and does not replace this transport surface.

| capability | decision | reason |
|---|---|---|
| `GET /applications` | INTEGRATE | |
| `POST /applications` | OPT-OUT | Application mutation is platform administration outside Phases 6-13; Phase 6 only reads the application list through the foundation adapter. |
| `GET /applications/{id}` | OPT-OUT | An application-detail runtime workflow is not assigned to Phases 6-13; Phase 6 only needs the typed list tracer. |
| `PUT /applications/{id}` | OPT-OUT | Application mutation is platform administration outside Phases 6-13. |
| `DELETE /applications/{id}` | OPT-OUT | Application mutation is platform administration outside Phases 6-13. |
| `GET /csrm-assessments` | OPT-OUT | Runtime assessment and release service methods are owned by Phase 9 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `POST /csrm-assessments` | OPT-OUT | Runtime assessment and release service methods are owned by Phase 9 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-assessments/{id}` | OPT-OUT | Runtime assessment and release service methods are owned by Phase 9 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `PUT /csrm-assessments/{id}` | OPT-OUT | Runtime assessment and release service methods are owned by Phase 9 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `DELETE /csrm-assessments/{id}` | OPT-OUT | Runtime assessment and release service methods are owned by Phase 9 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-assessment-requests` | OPT-OUT | Runtime request workflow service methods are owned by Phase 7 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `POST /csrm-assessment-requests` | OPT-OUT | Runtime request workflow service methods are owned by Phase 7 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-assessment-requests/{id}` | OPT-OUT | Runtime request workflow service methods are owned by Phase 7 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `PUT /csrm-assessment-requests/{id}` | OPT-OUT | Runtime request workflow service methods are owned by Phase 7 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `DELETE /csrm-assessment-requests/{id}` | OPT-OUT | Runtime request workflow service methods are owned by Phase 7 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-controls` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `POST /csrm-controls` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-controls/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `PUT /csrm-controls/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `DELETE /csrm-controls/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-control-implementations` | OPT-OUT | Runtime risk and mitigation service methods are owned by Phases 9-10 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `POST /csrm-control-implementations` | OPT-OUT | Runtime risk and mitigation service methods are owned by Phases 9-10 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-control-implementations/{id}` | OPT-OUT | Runtime risk and mitigation service methods are owned by Phases 9-10 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `PUT /csrm-control-implementations/{id}` | OPT-OUT | Runtime risk and mitigation service methods are owned by Phases 9-10 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `DELETE /csrm-control-implementations/{id}` | OPT-OUT | Runtime risk and mitigation service methods are owned by Phases 9-10 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-information-assets` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `POST /csrm-information-assets` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-information-assets/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `PUT /csrm-information-assets/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `DELETE /csrm-information-assets/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-information-systems` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `POST /csrm-information-systems` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-information-systems/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `PUT /csrm-information-systems/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `DELETE /csrm-information-systems/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-questions` | OPT-OUT | Runtime questionnaire service methods are owned by Phase 8 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `POST /csrm-questions` | OPT-OUT | Runtime questionnaire service methods are owned by Phase 8 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-questions/{id}` | OPT-OUT | Runtime questionnaire service methods are owned by Phase 8 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `PUT /csrm-questions/{id}` | OPT-OUT | Runtime questionnaire service methods are owned by Phase 8 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `DELETE /csrm-questions/{id}` | OPT-OUT | Runtime questionnaire service methods are owned by Phase 8 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-questionnaires` | OPT-OUT | Runtime questionnaire service methods are owned by Phase 8 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `POST /csrm-questionnaires` | OPT-OUT | Runtime questionnaire service methods are owned by Phase 8 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-questionnaires/{id}` | OPT-OUT | Runtime questionnaire service methods are owned by Phase 8 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `PUT /csrm-questionnaires/{id}` | OPT-OUT | Runtime questionnaire service methods are owned by Phase 8 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `DELETE /csrm-questionnaires/{id}` | OPT-OUT | Runtime questionnaire service methods are owned by Phase 8 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-risks` | OPT-OUT | Runtime risk and mitigation service methods are owned by Phases 9-10 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `POST /csrm-risks` | OPT-OUT | Runtime risk and mitigation service methods are owned by Phases 9-10 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-risks/{id}` | OPT-OUT | Runtime risk and mitigation service methods are owned by Phases 9-10 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `PUT /csrm-risks/{id}` | OPT-OUT | Runtime risk and mitigation service methods are owned by Phases 9-10 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `DELETE /csrm-risks/{id}` | OPT-OUT | Runtime risk and mitigation service methods are owned by Phases 9-10 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-risk-types` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `POST /csrm-risk-types` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /csrm-risk-types/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `PUT /csrm-risk-types/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `DELETE /csrm-risk-types/{id}` | OPT-OUT | Runtime library/inventory service methods are owned by Phase 11 and real authorization/integration by Phase 13; Phase 6 generates their types only. |
| `GET /functions` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `POST /functions` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `GET /functions/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `PUT /functions/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `DELETE /functions/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `GET /function-apis` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `POST /function-apis` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `GET /function-apis/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `PUT /function-apis/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `DELETE /function-apis/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `GET /idambox-users` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `POST /idambox-users` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `GET /idambox-users/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `PUT /idambox-users/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `DELETE /idambox-users/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `GET /roles` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `POST /roles` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `GET /roles/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `PUT /roles/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `DELETE /roles/{id}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `GET /content-types` | OPT-OUT | Strapi content-type builder operations belong to backend administration and are outside the CSRM application roadmap. |
| `GET /content-types/{uid}` | OPT-OUT | Strapi content-type builder operations belong to backend administration and are outside the CSRM application roadmap. |
| `GET /components` | OPT-OUT | Strapi content-type builder operations belong to backend administration and are outside the CSRM application roadmap. |
| `GET /components/{uid}` | OPT-OUT | Strapi content-type builder operations belong to backend administration and are outside the CSRM application roadmap. |
| `POST /` | OPT-OUT | No file-management or attachment workflow is assigned to Phases 6-13; Strapi upload administration is outside APP-06. |
| `GET /files` | OPT-OUT | No file-management or attachment workflow is assigned to Phases 6-13; Strapi upload administration is outside APP-06. |
| `GET /files/{id}` | OPT-OUT | No file-management or attachment workflow is assigned to Phases 6-13; Strapi upload administration is outside APP-06. |
| `DELETE /files/{id}` | OPT-OUT | No file-management or attachment workflow is assigned to Phases 6-13; Strapi upload administration is outside APP-06. |
| `GET /locales` | OPT-OUT | No localization workflow is assigned to Phases 6-13; locale administration remains outside APP-06. |
| `GET /connect/(.*)` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `POST /auth/local` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `POST /auth/local/register` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `GET /auth/{provider}/callback` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `POST /auth/forgot-password` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `POST /auth/reset-password` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `GET /auth/email-confirmation` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `POST /auth/send-email-confirmation` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `POST /auth/change-password` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `GET /users/count` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `GET /users` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `POST /users` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `GET /users/me` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `GET /users/{id}` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `PUT /users/{id}` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `DELETE /users/{id}` | OPT-OUT | Phase 13 uses Keycloak/OIDC for application authentication; Strapi Users & Permissions authentication/user administration is not a CSRM frontend contract. |
| `PUT /roles/{role}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `DELETE /roles/{role}` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |
| `GET /permissions` | OPT-OUT | Phase 13 owns production identity/effective-capability integration and must use an authorized server endpoint rather than expose raw platform-administration CRUD from Phase 6. |

## Coverage invariants

- Generated transport coverage: **103/103 operations**.
- Phase 6 runtime service adapters: **1 INTEGRATE**, **102 explicit OPT-OUT**.
- Runtime adapters may be added only by updating the authoritative OpenAPI document first when necessary, regenerating `openapi.ts`, updating this matrix, and preserving FunctionApi traceability.
- Opt-outs for Phases 7-12 do not authorize mock-only endpoints: each owning phase must use an operation present in the regenerated Strapi OpenAPI contract or record/close the backend API gap.
