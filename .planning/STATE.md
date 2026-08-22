---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 7
current_phase_name: Requestor Request Workflow
status: planning
stopped_at: Completed 06-09-PLAN.md
last_updated: "2026-08-09T12:35:23.087Z"
last_activity: 2026-08-09
last_activity_desc: Phase 6 complete, transitioned to Phase 7
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 22
  completed_plans: 22
---

# State: IdamBox Platform

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-29)

**Core value:** IdamBox must provide a clean shared authorization model where each application can define roles and users receive access indirectly through assigned role bundles.
**Current focus:** Phase 06 — establish the CSRM application foundation

## Current Phase

| Field     | Value                      |
| --------- | -------------------------- |
| Phase     | 7 — Requestor Request Workflow                          |
| Name      | CSRM Foundation            |
| Status    | Ready to plan           |
| Started   | -                          |
| Completed | -                          |
| Plans     | 0                          |

## Workflow State

Last activity: 2026-08-22 - Completed quick task 260822-u5d: align the AccountMenu to the right in AppHeader.

- Project initialized: 2026-05-20
- Requirements defined: 2026-05-20
- Roadmap created: 2026-05-20
- Phase 1 planned: 2026-05-20
- Phase 1 executed: 2026-05-20
- Phases 2-6 added to roadmap: 2026-05-24
- Phase 2 context gathered: 2026-05-24
- Phase 2 planned: 2026-05-24
- Phase 2 executed: 2026-05-24
- Phase 3 context gathered: 2026-05-25
- Phase 3 planned: 2026-05-25
- Phase 3 executed: 2026-05-25
- Phase 4 context gathered: 2026-05-25
- Phase 4 planned: 2026-05-25
- Phase 4 executed: 2026-05-26
- Phase 5 context gathered: 2026-05-29
- Phase 5 planned: 2026-05-29
- Phase 5 executed: 2026-05-29
- Phase 6 replaced with the eight CSRM project brief stages as Phases 6-13: 2026-08-08
- Next command: `$gsd-discuss-phase 6`

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260802-onb | review the changes and make any necessary adjustments | 2026-08-02 | 13cbce5 | [260802-onb-review-the-changes-and-make-any-necessar](./quick/260802-onb-review-the-changes-and-make-any-necessar/) |
| 260805-sct | update the Strapi backend data schema to rename Entitlement object to Function and add menuPath | 2026-08-05 | b4f113e | [260805-sct-update-the-strapi-backend-data-schema-to](./quick/260805-sct-update-the-strapi-backend-data-schema-to/) |
| 260805-sm8 | add FunctionApi to the Strapi backend data model with a one-way Function relation | 2026-08-05 | d15a950 | [260805-sm8-extend-the-strapi-backend-data-model-to-](./quick/260805-sm8-extend-the-strapi-backend-data-model-to-/) |
| 4 | update the CSRM project brief to reference the Strapi OpenAPI specification and use the Strapi backend API | 2026-08-08 | 0ed1b67 | — |
| 5 | update CSRM authentication and authorization for Keycloak and Role Function FunctionAPI enforcement | 2026-08-08 | 961566e | — |
| 260810-cjm | update the CSRM role/function/API catalogue with Administration Functions and CSV import grants | 2026-08-10 | e29ce18 | [260810-cjm-update-the-csrm-role-function-api-catalo](./quick/260810-cjm-update-the-csrm-role-function-api-catalo/) |
| 260811-ne2 | move the apps/csrm/docs/references/controls folder to apps/backend/src/bootstrap and update the seed-csrm-data.ts script accordingly. | 2026-08-11 | a1b66f7 | [260811-ne2-move-the-apps-csrm-docs-references-contr](./quick/260811-ne2-move-the-apps-csrm-docs-references-contr/) |
| 260822-tdg | align CSRM shell controls and navigation with the engineering rules | 2026-08-22 | e1ae64b | [260822-tdg-check-the-csrm-engineering-rules-in-apps](./quick/260822-tdg-check-the-csrm-engineering-rules-in-apps/) |
| 260822-u5d | align the AccountMenu to the right in AppHeader | 2026-08-22 | pending | [260822-u5d-in-the-appheader-align-the-accountmenu-t](./quick/260822-u5d-in-the-appheader-align-the-accountmenu-t/) |

## Memory

- Phase 1 is backend-only.
- Use Strapi native admin authentication for content administration.
- Auth0 is deferred until Next.js app modules are added.
- Use a custom IdamBox user collection rather than Strapi admin users for product users.
- Applications own Functions; Functions may expose FunctionApi operation grants rather than free-floating permission strings.
- Roles bundle application-owned Functions and are assigned to users through `IdamBoxUser -> Role -> Function -> Application`.
- Follow the `example-projects/edalas-dylan` monorepo shape.
- Phase 2 added idempotent Strapi bootstrap data for the CSRM Application, Function/FunctionApi catalogue, Security Analyst, Security Analyst Agent, and Requestor Roles, plus Jane/Bob sample users behind `IDAMBOX_SEED_CSRM`; Jane has no Roles and Bob has only Security Analyst.
- Phase 3 added a top-level Keycloak `idp` setup based on `example-projects/idambox_old/keycloak`, with a local `idambox` realm, Jane/Bob Keycloak users, an `idambox-csrm` OIDC client, and static verification.
- Keycloak committed credentials and `idambox-csrm-local-secret` are local-only values and must not be reused outside local development.
- Phase 4 executed as three waves: Keycloak admin client/configuration, backend provisioning integration, and verification/documentation closeout.
- Phase 4 added Strapi-to-Keycloak provisioning gated by `IDAMBOX_KEYCLOAK_PROVISIONING=true`, using the dedicated local admin client `idambox-strapi-admin`, storing Keycloak user IDs in `externalSubject`, and clearing transient IdamBox user passwords after successful provisioning.
- Phase 5 added the backend-only CSRM content model with seven Strapi collections, generated API files, `csrmAppIsEnabled` route policy guarding, `verify:csrm-model`, docs, and regenerated content type declarations.
- Phases 6-13 follow the CSRM project brief progression: foundation, Requestor requests, questionnaires, assessments, Risk Register, administration, dashboard/reporting, and integration/hardening.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260805-qzp | extend the CSRMRisk object with two more attributes: isExempted:Boolean and exemptionReviewDate:dateTime | 2026-08-05 | 867b9f0 | [260805-qzp-extend-the-csrmrisk-object-with-two-more](./quick/260805-qzp-extend-the-csrmrisk-object-with-two-more/) |

Last activity: 2026-08-10 - Completed quick task 260810-cjm: update the CSRM role/function/API catalogue with Administration Functions and CSV import grants

## Accumulated Context

### Roadmap Evolution

- Phase 6 edited: replaced original Phase 6 with CSRM project brief stages across Phases 6-13

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02-create-strapi-backend-bootstrap-data-for-the-csrm-applicatio P02 | 18 min | 2 tasks | 6 files |
| Phase 02 P03 | 7 min | 2 tasks | 9 files |
| Phase 06-create-the-idambox-csrm-next-js-application P01 | 1h 43m | 2 tasks | 11 files |
| Phase 06-create-the-idambox-csrm-next-js-application P09 | 48min | 3 tasks | 23 files |

## Decisions

- [Phase ?]: Use IdamBoxUser -> Role -> Function -> Application with FunctionApi operation grants as the accepted Phase 1/2 authorization contract.
- [Phase ?]: Retain Security Analyst Agent as the Function-grant-equivalent Role for historical D-07/D-08 without restoring ApplicationRole.
- [Phase ?]: Use yarn verify:csrm-seed as the authoritative two-boot disposable SQLite seed acceptance check.
- [Phase ?]: Pin CSRM TypeScript to 5.9.2 and ESLint to 9.39.2 for eslint-config-next compatibility.
- [Phase ?]: Use NODE_PATH=./node_modules only in CSRM lint to bridge Yarn 1 hoisting of eslint-config-next.
- [Phase ?]: Use an isolated NODE_ENV=production E2E server to verify shipped CSRM output.
- [Phase ?]: Replace development identity client code with a null production module and proxy test-evidence paths to HTTP 404.

## Session

**Last session:** 2026-08-09T11:30:10.338Z
**Stopped at:** Completed 06-09-PLAN.md
**Resume file:** None
