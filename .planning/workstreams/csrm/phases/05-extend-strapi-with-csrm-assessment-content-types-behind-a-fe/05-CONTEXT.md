# Phase 05: CSRM Backend Content Model - Context

**Gathered:** 2026-05-29T09:05:32Z
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 extends the existing Strapi backend with feature-flagged CSRM assessment workflow content types. It defines the backend data model for requestor-submitted assessment requests, related information assets and systems, questionnaires and questions, assessment records, and risks. These collections support later CSRM application workflows but this phase does not build the Next.js CSRM frontend, OIDC login behavior, requestor screens, security analyst screens, or Keycloak authorization roles.

The phase must keep CSRM-specific data separate from the core IdamBox authorization model. Product authorization remains `IdamBoxUser -> Role -> Entitlement -> Application`; Keycloak remains the identity provider account store for later application authentication.

</domain>

<decisions>
## Implementation Decisions

### Collection Boundaries And Naming
- **D-01:** Phase 5 should create separate first-class Strapi collections for the full initial CSRM backend model, not embedded JSON-only structures.
- **D-02:** The initial CSRM collections are `csrm-assessment-request`, `csrm-information-asset`, `csrm-information-system`, `csrm-questionnaire`, `csrm-question`, `csrm-assessment`, and `csrm-risk`.
- **D-03:** The `CSRM Assessment Request` collection should include request metadata fields such as `requestNumber`, `title`, `description`, `requestor`, `sponsor`, `submittedDate`, `dueDate`, and `requestStatus`.
- **D-04:** The `CSRM Information Asset` collection should include fields such as `name`, `description`, `location`, `type`, `dataClassification`, `confidentialityRating`, `integrityRating`, `availabilityRating`, `containsPersonalData`, `containsLegalData`, and `comments`.
- **D-05:** The `CSRM Information System` collection should include fields such as `name`, `description`, `systemType`, `owner`, `environment`, `businessCriticality`, `internetFacing`, `externalAccessRequired`, `hostingLocation`, and `lifecycleState`.
- **D-06:** The `CSRM Questionnaire` and `CSRM Question` model should represent a questionnaire as a collection of questions. Questions should include `questionText`, `helpText`, `answerType`, `options`, `order`, `answer`, and `reviewComment`.
- **D-07:** The `CSRM Assessment` collection should include fields such as `assessmentNumber`, `assessmentStatus`, `generatedDate`, `generatedBy`, `reviewedBy`, `approvedBy`, `approvalDate`, `summary`, and `overallRating`.
- **D-08:** The `CSRM Risk` collection should include fields such as `riskNumber`, `issueStatement`, `riskStatement`, `riskOwner`, impacted system/asset links, `dataClassification`, inherent likelihood/consequence/rating/rationale, residual likelihood/consequence/rating/rationale, `riskCommunicationDate`, `treatmentAction`, `treatmentPlan`, `treatmentOwner`, `treatmentResolveDate`, and `treatmentStatus`.

### Relationships And Ownership
- **D-09:** Use `csrm-assessment-request` as the central aggregate for the workflow graph.
- **D-10:** A `csrm-assessment-request` can link to many `csrm-information-asset` records and many `csrm-information-system` records.
- **D-11:** A `csrm-assessment-request` links to one `csrm-questionnaire`.
- **D-12:** A `csrm-questionnaire` owns or links to many `csrm-question` records.
- **D-13:** A `csrm-assessment-request` has one `csrm-assessment`.
- **D-14:** A `csrm-assessment` contains zero or more `csrm-risk` records.
- **D-15:** CSRM risk records should be able to reference the impacted information system and impacted information asset when applicable.
- **D-16:** User-facing ownership fields such as requestor, sponsor, generatedBy, reviewedBy, approvedBy, riskOwner, and treatmentOwner should link to existing custom `IdamBox User` records where practical, not Strapi admin users.

### Lifecycle And Status Semantics
- **D-17:** Lock the `csrm-assessment-request.requestStatus` workflow states as `draft`, `submitted`, `questionnaire-in-progress`, `risk-assessment-drafted`, `under-review`, `approved`, and `closed`.
- **D-18:** Lock the `csrm-assessment.assessmentStatus` workflow states as `draft`, `in-review`, `approved`, and `closed`.
- **D-19:** Phase 5 stores lifecycle state and release-related fields, but Phase 6 will decide the full UI transitions and user workflow behavior.
- **D-20:** Data classification values should include `Public`, `Internal`, `Restricted`, and `Critical Infrastructure Sensitive`.
- **D-21:** Information system environment values should include `Production`, `Non-production`, `Cloud`, `SaaS`, and `On-prem`.
- **D-22:** Information system lifecycle state values should include `New`, `Changed`, `Existing`, and `Decommissioning`.
- **D-23:** Question answer type values should include `Text`, `Long text`, `Boolean`, `Single select`, `Multi select`, `Date`, and `File upload`.
- **D-24:** Risk treatment action values should include `Accept` and `Treat`.
- **D-25:** Risk treatment status values should include `Not Started`, `In Progress`, `Overdue`, and `Complete`.

### Feature Flag Behavior
- **D-26:** Active CSRM collection behavior must be gated by the roadmap flag `csrmAppIsEnabled`.
- **D-27:** When `csrmAppIsEnabled=false`, the Strapi project/schema may still contain CSRM content types, but application-facing CSRM routes/services should reject or avoid active CSRM behavior.
- **D-28:** Phase 5 should not attempt to force CSRM collections out of the Strapi admin registration model when disabled if that conflicts with normal Strapi content-type registration.
- **D-29:** Documentation and verification should make the disabled behavior explicit: the flag prevents active CSRM collection behavior for application consumers, not necessarily the physical existence of schema files in the repository.

### the agent's Discretion
- Planners may choose exact Strapi schema implementation details, relation ownership direction, collection display names, and controller/service helper structure as long as the locked collection set, relationship intent, and status values are preserved.
- Planners may normalize field casing to fit Strapi conventions where needed, but should preserve the domain names and enum values clearly enough for the future CSRM app to map to them.
- Planners may choose whether `options` for questions is represented as JSON, repeatable components, or a related option collection after checking Strapi patterns and implementation cost.
- Planners may choose the exact technical mechanism for evaluating `csrmAppIsEnabled` in routes/services, provided disabled CSRM behavior is guarded and verified.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Sources
- `.planning/ROADMAP.md` — Phase 5 goal, requirements, success criteria, dependency, and constraints.
- `.planning/REQUIREMENTS.md` — `CSRM-01` through `CSRM-04` and Phase 5 traceability.
- `.planning/PROJECT.md` — platform constraints, backend foundation context, and shared authorization model.
- `.planning/STATE.md` — current focus and memory from completed phases.
- `.planning/phases/04-provision-strapi-idambox-users-into-keycloak-from-backend-li/04-CONTEXT.md` — latest Keycloak/user provisioning boundary and source-of-truth identity decisions.
- `.planning/phases/03-create-keycloak-docker-compose-identity-provider-setup-for-i/03-CONTEXT.md` — Keycloak authentication boundary and deferred CSRM app login context.
- `.planning/phases/02-create-strapi-backend-bootstrap-data-for-the-csrm-applicatio/02-CONTEXT.md` — CSRM application identity, Jane/Bob sample user context, and seeded CSRM role decisions.

### Existing Backend Model
- `apps/backend/src/api/application/content-types/application/schema.json` — existing application content-type pattern and status-field naming convention.
- `apps/backend/src/api/entitlement/content-types/entitlement/schema.json` — application-scoped entitlement relation pattern.
- `apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json` — custom product user schema that CSRM user ownership fields should relate to.
- `apps/backend/src/api/role/content-types/role/schema.json` — existing reusable role and user relation pattern.
- `apps/backend/src/index.ts` — Strapi register/bootstrap entry point and existing backend integration style.

### Configuration And Verification Surfaces
- `apps/backend/.env.example` — existing environment flag documentation pattern.
- `apps/backend/README.md` — backend documentation surface for CSRM model and flag behavior.
- `README.md` — root developer documentation surface for verification commands and platform model notes.
- `package.json` — root script surface for adding Phase 5 verification.
- `scripts/verify-core-model.mjs` — existing static schema verification style for content types.
- `scripts/verify-csrm-seed.mjs` — existing CSRM-specific verifier style and documentation checks.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/api/*/content-types/*/schema.json`: existing Strapi collection schema pattern using `collectionType`, `collectionName`, `info`, `options.draftAndPublish`, and relation attributes.
- `apps/backend/src/api/*/controllers/*.ts`, `routes/*.ts`, and `services/*.ts`: existing generated core controller/router/service pattern for collection APIs.
- `apps/backend/src/keycloak/config.ts`: existing environment-driven feature configuration pattern with explicit enabled flag behavior.
- `scripts/verify-core-model.mjs` and `scripts/verify-csrm-seed.mjs`: static verifier patterns for asserting schema fields, relationships, environment documentation, and package scripts.

### Established Patterns
- Domain status fields avoid Strapi's reserved `status` name. Existing models use names such as `accountStatus` and `applicationStatus`; Phase 5 should use `requestStatus`, `assessmentStatus`, and `treatmentStatus`.
- Optional behavior is environment-driven and disabled by default unless explicitly enabled.
- Product users are represented by the custom `IdamBox User` collection and remain separate from Strapi admin users.
- Documentation and static verification are part of each backend phase closeout.

### Integration Points
- Add CSRM API content types under `apps/backend/src/api/`.
- Add or extend CSRM controllers/services/routes so application-facing behavior respects `csrmAppIsEnabled`.
- Add backend environment documentation in `apps/backend/.env.example` and `apps/backend/README.md`.
- Add root documentation and a verification script entry in `package.json`.
- Update or regenerate Strapi generated content type typings if the codebase requires it for build/type checks.

</code_context>

<specifics>
## Specific Ideas

- Treat the provided CSRM model as the initial domain vocabulary for Phase 5.
- Keep `csrm-assessment-request` as the request-centered aggregate, with assets, systems, questionnaire, assessment, and risks hanging from that workflow.
- Store detailed status values now so Phase 6 can build requestor/security analyst workflows without redefining the backend lifecycle.
- Use route/service guarding for `csrmAppIsEnabled` rather than trying to remove schema files or fight Strapi admin registration.

</specifics>

<deferred>
## Deferred Ideas

- Next.js CSRM requestor/security analyst workflows belong to Phase 6.
- Keycloak/OIDC login wiring belongs to Phase 6.
- Fine-grained CSRM authorization permissions and Keycloak CSRM roles/groups remain out of scope unless a later module phase requires them.
- Full UI transition rules, screens, and requestor visibility behavior belong to Phase 6, though Phase 5 stores the needed lifecycle fields.

</deferred>

---

*Phase: 05-CSRM Backend Content Model*
*Context gathered: 2026-05-29T09:05:32Z*
