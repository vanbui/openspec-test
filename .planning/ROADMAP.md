# Roadmap: IdamBox Platform

**Created:** 2026-05-20
**Granularity:** Coarse
**Current milestone:** Backend foundation

## Overview

| #   | Phase                                | Goal                                                                                                                                                               | Requirements                                                                                                        | Success Criteria |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Strapi Backend Foundation            | Complete 2026-05-20. Create the IdamBox monorepo backend and core authorization data model.                                                                        | MONO-01, MONO-02, MONO-03, BACK-01, BACK-02, BACK-03, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07 | 5                |
| 2   | CSRM Bootstrap Data                  | Complete 2026-05-24. Seed the Strapi backend with CSRM application access data and sample IdamBox users on boot.                                                   | BOOT-01, BOOT-02, BOOT-03, BOOT-04                                                                                  | 5                |
| 3   | Keycloak Identity Provider Setup     | Complete 2026-05-25. Added a top-level Keycloak Docker setup for IdamBox with CSRM users and an OIDC client.                                                       | IDP-01, IDP-02, IDP-03, IDP-04                                                                                      | 5                |
| 4   | Strapi To Keycloak User Provisioning | Complete 2026-05-26. Added Strapi-to-Keycloak provisioning with a dedicated admin client, idempotent lookup, transient password handling, and static verification. | IDP-05, IDP-06                                                                                                      | 4                |
| 5   | CSRM Backend Content Model           | Complete 2026-05-29. Added guarded CSRM assessment request, asset, system, questionnaire, question, assessment, and risk collections.                    | CSRM-01, CSRM-02, CSRM-03, CSRM-04                                                                                 | 5                |
| 6   | CSRM Foundation                      | Establish the production-quality CSRM Next.js application foundation, design system, application shell, capability model, typed API boundary, and test infrastructure. | APP-06                                                                                                               | 5                |
| 7   | Requestor Request Workflow           | Deliver the Requestor dashboard and complete draft, edit, and submit workflow for the Requestor's own risk assessment requests.                                      | CSRM-05                                                                                                              | 5                |
| 8   | Questionnaire Workflow               | Deliver dynamic questionnaire completion for Requestors and questionnaire review for Security Analysts.                                                             | CSRM-06, CSRM-08                                                                                                     | 5                |
| 9   | Assessment Workflow                  | Deliver analyst assessment review, editing, AI-assisted draft states, controlled release, and the Requestor's released read-only view.                               | CSRM-07, CSRM-08, CSRM-09                                                                                            | 5                |
| 10  | Risk Register                        | Deliver the organisation-level Risk Register, contextual risk details, and mitigation-control workflows.                                                            | CSRM-08                                                                                                              | 5                |
| 11  | Administration                       | Deliver Security Analyst management of risk types, controls, information systems, and information assets, including validated CSV imports.                           | CSRM-08                                                                                                              | 5                |
| 12  | Dashboard / Reporting                | Deliver Security Analyst dashboard metrics, reports, and alerts using reusable, data-driven widgets.                                                                 | CSRM-08                                                                                                              | 4                |
| 13  | Integration and Hardening            | Complete real Strapi, Keycloak/OIDC, AI-service, and authorization integration and harden accessibility, security, performance, and end-to-end coverage.              | AUTH-01, APP-06, CSRM-05, CSRM-06, CSRM-07, CSRM-08, CSRM-09                                                        | 5                |

## Phase Details

### Phase 1: Strapi Backend Foundation

**Goal:** Create a runnable IdamBox Strapi backend inside a Turbo monorepo and implement the core data model for IdamBox users, Roles, Applications, Functions, and FunctionApi operation grants.

**Requirements:**

- MONO-01
- MONO-02
- MONO-03
- BACK-01
- BACK-02
- BACK-03
- DATA-01
- DATA-02
- DATA-03
- DATA-04
- DATA-05
- DATA-06
- DATA-07

**Success Criteria:**

1. Repository has a Turbo workspace layout matching the closest example, with Strapi located at `apps/backend` and room for future app modules under `apps/*`.
2. Strapi backend can be installed, built, and run in development mode from root workspace scripts.
3. Native Strapi admin authentication allows an administrator to enter and edit Phase 1 records.
4. Content types exist for IdamBox user, Role, Application, Function, and FunctionApi with the agreed attributes and ownership relationships.
5. Relationships support deriving application access through `IdamBoxUser -> Role -> Function -> Application`, with FunctionApi records carrying operation-level grants.

**Plans:**

**Wave 1**

- `01-PLAN.md` - Monorepo And Strapi Backend Scaffold

**Wave 2 _(blocked on Wave 1 completion)_**

- `02-PLAN.md` - Core IdamBox Data Model

**Wave 3 _(blocked on Wave 2 completion)_**

- `03-PLAN.md` - Backend Verification, Seeds, And Documentation

**Cross-cutting constraints:**

- Phase 1 is backend-only; do not create a frontend app.
- Strapi native admin authentication is the Phase 1 admin path.
- Auth0 is deferred to later app phases.
- Product users must use a custom IdamBox user collection, not Strapi admin users.
- Effective access must follow `IdamBoxUser -> Role -> Function -> Application`; FunctionApi records carry operation-level grants below Functions.

**UI hint:** no

### Phase 2: CSRM Bootstrap Data

**Goal:** Populate the Strapi backend at boot with baseline CSRM application access data and representative IdamBox users.

**Requirements:**

- BOOT-01
- BOOT-02
- BOOT-03
- BOOT-04

**Depends on:** Phase 1

**Success Criteria:**

1. Strapi bootstraps an `Application` record for CSRM, standing for Cybersecurity Risk Manager.
2. Strapi bootstraps CSRM-owned Functions and FunctionApi operation grants for the Security Analyst access catalogue.
3. Strapi bootstraps reusable Function-backed Roles for `Security Analyst`, `Security Analyst Agent`, and the current `Requestor` catalogue Role; Security Analyst Agent has the same Function grant set as Security Analyst.
4. Strapi bootstraps IdamBox users `Jane Doe <jane.doe@idambox.com>` and `Bob Doe <bob.doe@idambox.com>`.
5. Bob Doe is assigned only to the `Security Analyst` Role, while Jane Doe has no Roles and remains an end-user/requestor account for later CSRM assessment requests; `Security Analyst Agent` is seeded but assigned to neither sample user.

**Plans:** 3/3 plans complete

Plans:

- [x] `02-01-PLAN.md` - CSRM Seed Data, Documentation, And Verification
- [x] `02-02-PLAN.md` - Function-Based CSRM Seed Runtime And Verification Gap Closure
- [x] `02-03-PLAN.md` - Authorization Contract Documentation And Traceability Gap Closure

**Cross-cutting constraints:**

- Preserve the authorization path: `IdamBoxUser -> Role -> Function -> Application`, with FunctionApi operation grants below Functions.
- Bootstrap data must be idempotent so repeated Strapi starts do not create duplicate records.
- Use the existing Phase 1 custom IdamBox user model, not Strapi admin users.
- The accepted equivalent of historical D-07/D-08 is a reusable `Security Analyst Agent` Role with the same Function grant set as `Security Analyst`; do not restore ApplicationRole to match historical wording.

**UI hint:** no

### Phase 3: Keycloak Identity Provider Setup

**Goal:** Create a top-level `idp` Keycloak Docker Compose setup for the IdamBox platform using `example-projects/idambox_old/keycloak` as the template.

**Requirements:**

- IDP-01
- IDP-02
- IDP-03
- IDP-04

**Depends on:** Phase 2

**Success Criteria:**

1. A top-level `idp` directory contains a Docker Compose based Keycloak setup adapted from `example-projects/idambox_old/keycloak`.
2. Keycloak bootstraps matching users for `jane.doe@idambox.com` and `bob.doe@idambox.com`.
3. Keycloak bootstraps an OIDC client for the future CSRM Next.js application.
4. The top-level `README.md` includes setup instructions for launching the Keycloak container.
5. Documentation states that Keycloak is the IdamBox OIDC Identity Provider and may later broker authentication to customer IdPs such as Auth0, Ping Access Management, Okta, and Entra ID.

**Plans:** 1/1 plans complete

Plans:

- [x] `03-01-PLAN.md` - Local Keycloak IDP Setup, Realm Import, Documentation, And Verification

**Cross-cutting constraints:**

- Do not wire application login into a Next.js app in this phase.
- Keep Keycloak setup reusable for future IdamBox application modules.
- Treat customer IdP brokering as future configuration, not required Phase 3 behavior.

**UI hint:** no

### Phase 4: Strapi To Keycloak User Provisioning

**Goal:** Add backend lifecycle behavior that provisions Strapi IdamBox user records into Keycloak through Keycloak's API.

**Requirements:**

- IDP-05
- IDP-06

**Depends on:** Phase 3

**Success Criteria:**

1. Strapi has a lifecycle hook or equivalent backend integration for IdamBox user creation/update events.
2. New or updated Strapi IdamBox user records can be provisioned into Keycloak through the Keycloak API.
3. Provisioning is idempotent and does not create duplicate Keycloak users for the same email address.
4. Keycloak connection settings and credentials are driven by environment configuration and are not hard-coded.

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] `04-01-PLAN.md` - Keycloak Admin Client Seed And Provisioning Configuration

**Wave 2 _(blocked on Wave 1 completion)_**

- [x] `04-02-PLAN.md` - Backend Keycloak Provisioning Integration

**Wave 3 _(blocked on Wave 2 completion)_**

- [x] `04-03-PLAN.md` - Provisioning Verification And Documentation Closeout

**Cross-cutting constraints:**

- Strapi remains the source of product user/profile records.
- Keycloak is the identity provider account store for authentication.
- Do not store Keycloak admin credentials in source-controlled files.

**UI hint:** no

### Phase 5: CSRM Backend Content Model

**Goal:** Extend the Strapi backend with CSRM assessment workflow collections that are active only when the `csrmAppIsEnabled` environment flag is true.

**Requirements:**

- CSRM-01
- CSRM-02
- CSRM-03
- CSRM-04

**Depends on:** Phase 4

**Success Criteria:**

1. Strapi defines a `CSRM Assessment Request` collection for requestor-submitted assessment requests.
2. Strapi defines a `CSRM Assessment Questionnaire` collection associated with assessment requests.
3. Strapi defines a `CSRM Assessment` collection associated with assessment requests and release state.
4. The CSRM collections are gated by the Strapi environment flag `csrmAppIsEnabled`.
5. When the flag is disabled, the backend does not expose active CSRM collection behavior to application consumers.

**Plans:** 3/3 plans complete

Plans:

- [x] `05-01-PLAN.md` - CSRM Content-Type Schemas
- [x] `05-02-PLAN.md` - CSRM Feature Flag Guarding
- [x] `05-03-PLAN.md` - CSRM Verification Documentation And Types

**Cross-cutting constraints:**

- Keep CSRM-specific data separate from the core platform authorization model.
- Do not build CSRM frontend workflows in this phase.
- Preserve a clean path for enabling additional application modules later.

**UI hint:** no

### Phase 6: CSRM Foundation

**Goal:** Establish the production-quality CSRM Next.js application foundation with a reusable BProton-aligned design system, responsive application shell, centralized capability model, typed Strapi API boundary, and automated test infrastructure.

**Requirements:**

- APP-06

**Depends on:** Phase 5

**Success Criteria:**

1. A strict-TypeScript Next.js App Router application exists under `apps/csrm` with Tailwind CSS, shadcn/ui, root workspace integration, and a maintainable feature-oriented structure.
2. Semantic design tokens and reusable UI primitives establish the BProton/IdamBox visual treatment without scattering raw brand values through components.
3. A responsive `AppShell` provides desktop sidebar, mobile navigation, application header, and navigation generated from centralized role/capability configuration.
4. A typed service abstraction targets the Strapi OpenAPI contract and supports production Strapi calls plus fixtures or an HTTP-level test double without introducing a competing mock-only contract.
5. Unit, component, integration, and Playwright foundations cover core layout, capability, validation, and responsive behavior.

**Plans:** 9 plans

Plans:

**Wave 1**

- [ ] `06-01-PLAN.md` — Audited dependency gate and strict CSRM workspace configuration

**Wave 2**

- [ ] `06-02-PLAN.md` — Runnable port-3001 foundation tracer, bounded runtime probe, and Turbo wiring

**Wave 3**

- [ ] `06-03-PLAN.md` — Generated Strapi transport boundary and fail-closed MSW integration
- [ ] `06-04-PLAN.md` — Function-ID capabilities, routes, development identities, and access preflight

**Wave 4**

- [ ] `06-05-PLAN.md` — Semantic design tokens and reviewed local UI primitives

**Wave 5**

- [ ] `06-06-PLAN.md` — Complete reusable loading, error, access, partial, overflow, and cardinality states

**Wave 6**

- [ ] `06-07-PLAN.md` — Server-rendered capability shell and safe direct-route states

**Wave 7**

- [ ] `06-08-PLAN.md` — Responsive navigation, account, focus, and development-identity client islands

**Wave 8**

- [ ] `06-09-PLAN.md` — Browser viewport, access, production-boundary, and visual approval evidence

**Cross-cutting constraints:**

- Use Next.js App Router, strict TypeScript, Tailwind CSS, and shadcn/ui.
- Preserve explicit server/client boundaries and use Server Components by default where appropriate.
- Keep domain logic outside presentation components and avoid scattered role checks or raw fetch calls.
- Treat the Strapi OpenAPI specification as the transport source of truth.

**UI hint:** yes

### Phase 7: Requestor Request Workflow

**Goal:** Deliver a vertical Requestor workflow for viewing, creating, saving, editing, and submitting the Requestor's own Cyber Risk Assessment Requests.

**Requirements:**

- CSRM-05

**Depends on:** Phase 6

**Success Criteria:**

1. The Requestor dashboard highlights requests requiring action, recent submissions, request status, and relevant notifications using data-driven widgets.
2. My Requests supports accessible search, filtering, sorting, pagination, and responsive list or table presentation.
3. New Request and Request Details use persisted fields and terminology from the CSRM data model without inventing duplicate frontend-only domain fields.
4. A Requestor can save a draft, return to it, edit while workflow state permits, confirm submission, and see workflow state clearly.
5. Record access and available actions are expressed through centralized capabilities and preserve ownership boundaries for later server-side enforcement.

**Plans:** 0 plans

Plans:

- [ ] TBD (run `$gsd-plan-phase 7` to break down)

**Cross-cutting constraints:**

- Design for both desktop enterprise use and mobile widths beginning at approximately 375px.
- Forms must expose validation, loading, empty, error, permission-denied, and unsaved-work behavior deliberately.
- Requestors must never gain access to another user's restricted records through identifier changes.

**UI hint:** yes

### Phase 8: Questionnaire Workflow

**Goal:** Deliver data-driven questionnaire completion for Requestors and questionnaire review for Security Analysts.

**Requirements:**

- CSRM-06
- CSRM-08

**Depends on:** Phase 7

**Success Criteria:**

1. My Questionnaires and Questionnaire Details show only questionnaires available to the Requestor and clearly communicate completion and workflow status.
2. A reusable questionnaire renderer supports grouped sections, dynamic and conditional questions, validation, unanswered-question indication, and future AI-generated definitions without page redesign.
3. Requestors can save responses as drafts, return later, and submit through an explicit confirmation flow.
4. Security Analysts can view generated questionnaires and review submitted responses through capability-controlled analyst views.
5. Critical draft, validation, submit, review, and responsive behaviors have automated integration and end-to-end coverage.

**Plans:** 0 plans

Plans:

- [ ] TBD (run `$gsd-plan-phase 8` to break down)

**Cross-cutting constraints:**

- Questionnaire fields must be rendered from data rather than hard-coded screen fields.
- AI-generated or externally supplied content is untrusted and must not become privileged application instructions.
- Preserve Requestor ownership boundaries and Security Analyst review authority.

**UI hint:** yes

### Phase 9: Assessment Workflow

**Goal:** Deliver Security Analyst review and editing of Risk Assessments, visible AI-generation states, human-controlled release, and the Requestor's released read-only assessment experience.

**Requirements:**

- CSRM-07
- CSRM-08
- CSRM-09

**Depends on:** Phase 8

**Success Criteria:**

1. Security Analysts can review assessment requests and questionnaire responses before producing or reviewing an initial Risk Assessment draft.
2. Risk Assessment Details supports analyst editing of assessment context, risks, ratings, owners, dates, treatments, mitigation controls, and notes using CSRM domain terminology.
3. AI operations expose queued, analysing, generating, completed, failed, and retry states without holding an indefinitely spinning browser request.
4. Only a Security Analyst can explicitly release an assessment; AI output can never bypass mandatory human review.
5. Requestors can access only their own released assessments through a purpose-built read-only presentation and cannot modify them.

**Plans:** 0 plans

Plans:

- [ ] TBD (run `$gsd-plan-phase 9` to break down)

**Cross-cutting constraints:**

- Keep AI behind a provider-independent service boundary.
- Preserve provenance, generation, review, and human-modification metadata where supported by the backend model.
- Enforce release and record-level authorization server-side during integration.

**UI hint:** yes

### Phase 10: Risk Register

**Goal:** Deliver the Security Analyst's organisation-level Risk Register with contextual Risk details and mitigation-control management.

**Requirements:**

- CSRM-08

**Depends on:** Phase 9

**Success Criteria:**

1. The Risk Register provides search, filtering, sorting, pagination, statuses, ratings, owners, due dates, related assessments, related systems or assets, and mitigation status.
2. Risk Details presents the complete context for one contextual Risk, including inherent and residual ratings, treatment, ownership, dates, and related records.
3. Mitigation Controls and Mitigation Control Details support analyst management of control implementations associated with contextual Risks.
4. The UI and domain layer clearly distinguish reusable Risk Types from contextual Risks and reusable Controls from mitigation/control implementations.
5. Data-heavy register and detail experiences remain accessible and usable across supported desktop, tablet, and mobile widths.

**Plans:** 0 plans

Plans:

- [ ] TBD (run `$gsd-plan-phase 10` to break down)

**Cross-cutting constraints:**

- Follow the JDL domain terminology wherever names differ from general product language.
- Use URL/search parameters for shareable filters, pagination, and sorting where practical.
- Avoid loading an entire large Risk Register to render a single page.

**UI hint:** yes

### Phase 11: Administration

**Goal:** Deliver Security Analyst administration of Risk Types, the Control library, Information Systems, and Information Assets, including validated frontend CSV-import workflows.

**Requirements:**

- CSRM-08

**Depends on:** Phase 10

**Success Criteria:**

1. Each administrative object has dedicated accessible list and create, view, and edit screens using shared search, filtering, sorting, pagination, form, and detail patterns.
2. Each list provides CSV template guidance, file selection, file-type and header validation, and a preview with row-level validation errors.
3. Imports require confirmation and report created, updated, and rejected rows while exposing duplicate or ambiguous matches instead of silently overwriting records.
4. CSV services and DTOs use the same typed Strapi service boundary as the rest of the application, with missing operations treated as documented backend API gaps.
5. Administration and import actions are capability-controlled in the UI and designed for server-side authorization and validation.

**Plans:** 0 plans

Plans:

- [ ] TBD (run `$gsd-plan-phase 11` to break down)

**Cross-cutting constraints:**

- Browser parsing does not replace backend validation or authorization.
- Use existing CSRM entities and do not introduce competing frontend domain models.
- Do not log imported sensitive content or expose unsafe error details.

**UI hint:** yes

### Phase 12: Dashboard / Reporting

**Goal:** Deliver reusable Security Analyst dashboard metrics, reports, and alerts that make risk workload, urgency, and treatment status understandable.

**Requirements:**

- CSRM-08

**Depends on:** Phase 11

**Success Criteria:**

1. The Security Analyst dashboard presents requests, questionnaires, and assessments awaiting review plus overdue mitigation activities and high or critical risks.
2. Reusable data-driven widgets communicate treatment due dates, recent activity, and relevant alerts without hard-coded metric values.
3. Reports and Alerts screens provide accessible loading, empty, populated, error, and permission-denied states with capability-controlled actions.
4. Dashboard, chart, report, and alert layouts remain understandable and operable on supported desktop and mobile widths.

**Plans:** 0 plans

Plans:

- [ ] TBD (run `$gsd-plan-phase 12` to break down)

**Cross-cutting constraints:**

- Colour must not be the only way status, severity, or risk rating is communicated.
- Use the shared semantic chart, status, and risk-rating tokens.
- Add a charting dependency only when native or existing component capabilities are insufficient.

**UI hint:** yes

### Phase 13: Integration and Hardening

**Goal:** Integrate the CSRM application with the real Strapi API, Keycloak/OIDC identity, IdamBox authorization, and provider-independent AI services, then harden accessibility, security, performance, and critical end-to-end workflows.

**Requirements:**

- AUTH-01
- APP-06
- CSRM-05
- CSRM-06
- CSRM-07
- CSRM-08
- CSRM-09

**Depends on:** Phase 12

**Success Criteria:**

1. Keycloak authorization-code login establishes an application session, Strapi validates token signature, issuer, audience, and expiry, and the identity resolves to the matching IdamBox user.
2. Production services call the Strapi OpenAPI operations directly, contract drift is detectable, and any required missing backend operations are implemented and documented rather than replaced with frontend mock endpoints.
3. Every protected operation is authorized server-side through effective `Role -> Function -> FunctionAPI` grants plus record-level rules, including implicit Requestor capability and explicit Security Analyst elevation.
4. AI-assisted request, questionnaire, and assessment operations use the provider-independent boundary, remain recoverable, and preserve mandatory analyst review before release.
5. WCAG 2.2 AA checks, security hardening, responsive and performance verification, and expanded Playwright journeys cover the complete Requestor-to-Analyst-to-release workflow and administrative CSV imports.

**Plans:** 0 plans

Plans:

- [ ] TBD (run `$gsd-plan-phase 13` to break down)

**Cross-cutting constraints:**

- Never put secrets in client bundles or source control.
- Protect against IDOR, XSS, unsafe input, sensitive logging, and authorization based only on navigation visibility or editable client state.
- Do not duplicate IdamBox authorization as Keycloak realm or client roles.
- AI may assist, propose, and accelerate, but humans remain responsible for assessment review and release.

**UI hint:** yes

## Coverage Validation

All 13 v1 requirements are mapped to Phase 1.

The active roadmap adds bootstrap data, Keycloak identity provider setup, Strapi-to-Keycloak provisioning, CSRM backend collections, and the eight-stage CSRM web application delivery across Phases 2-13.

## Future Milestones

Future milestones should add more IdamBox application modules after CSRM, using the same shared platform, Keycloak/OIDC identity provider, and Application/Function/FunctionApi/Role authorization model.

---

_Roadmap created: 2026-05-20_
