# Phase 3: Dynamic Questionnaire Workflow - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning
**Source:** Operator-supplied plan-phase orchestrator context

<domain>
## Phase Boundary

Deliver the Requestor questionnaire workflow and Security Analyst response review for QUES-01 through QUES-05. The phase covers authorised questionnaire discovery, a shared grouped and conditional renderer, draft save/resume, validated submission, post-submit read-only behaviour, analyst review, realistic development seed data, and mounted/E2E assurance. It does not re-plan Phase 1 or Phase 2 foundations.

</domain>

<decisions>
## Implementation Decisions

### D-01 — Existing foundations
- Reuse the triple-gated development identity bridge, catalogue-backed `csrm-authorization` policy pattern, shadcn/ui token system, CSRM composites, typed `openapi-fetch` service layer, and dual-server Playwright harness. Do not rebuild or replace these foundations.

### D-02 — Backend authorisation
- Give `csrm-questionnaire` and `csrm-question` the full established authorisation treatment: `operations.ts` constants, `csrm-app-enabled` and `csrm-authorization` route policies, served-route Function/FunctionAPI grants in both byte-identical catalogue copies, and least-privilege development users-permissions actions with no IAM actions.
- Derive record access through the owning assessment request: Requestors may read and answer only questionnaires whose `assessmentRequest.requestor` is their identity; Security Analysts may read all. Answer mutations must also enforce an answerable questionnaire workflow state.
- Never modify either content type's `schema.json`.

### D-03 — JSON convention and validation
- Preserve the existing `csrm-question` fields only: `questionText`, `answerType`, `options`, `answer`, and `questionnaire`.
- Define and document an explicit convention inside `options` JSON for grouping, ordering, conditional visibility, and requiredness, and inside `answer` JSON for responses. Add a Phase 3 note under `docs/contract-gaps/` and validate the convention in the web application with Zod. Do not invent entities or persisted fields.

### D-04 — Development sample
- Add a development-gated, idempotent seed using the established seed gates. It creates one realistic grouped questionnaire with conditional questions attached to a submitted assessment request owned by `jane.doe@idambox.com`.
- Research and planning must decide whether File upload rendering is proportionate for Phase 3. If deferred, record the limitation explicitly in the contract-gap note and ensure unsupported input is handled deliberately rather than silently.

### D-05 — Requestor workflow
- Provide My Questionnaires discovery, either as a list or the already-planned dashboard-driven entry, and a filling experience with grouped sections, progress, unanswered indicators, conditional questions driven by earlier answers, per-question validation, save draft/resume, and explicit submit confirmation.
- Submission must produce an unambiguous result; submitted questionnaires are read-only. Save, submit, validation, loading, empty, error, and permission-denied behaviour must be deliberate and recoverable.

### D-06 — Analyst workflow
- Security Analysts can review questionnaire definitions and submitted answers using the same renderer in read-only mode. Do not create a parallel renderer implementation.

### D-07 — Frontend quality boundary
- Use Server Components by default and Client Components only for interactive form state. Keep domain logic outside JSX and all Strapi communication behind typed services. Use React Hook Form plus Zod for external/data-driven validation.
- All screens must cover loading, empty, error, permission-denied, and populated/success states; use semantic tokens only; meet WCAG 2.2 AA expectations; and work continuously from 375px through 1440px.

### D-08 — Automated assurance
- Extend the dual-server Playwright journey so the Requestor answers, saves, resumes, and submits, then the Security Analyst reviews the submitted responses.
- Add mounted Strapi coverage proving cross-requestor questionnaire access returns 403 and answer-state guards reject mutations outside answerable workflow states.

### D-09 — Contract stability
- The existing OpenAPI specification already contains CRUD paths for `/csrm-questionnaires` and `/csrm-questions`. Regenerate the web schema with `pnpm api:generate` only if the specification changes, and keep `api:check` green.

### the agent's Discretion
- Exact `options`/`answer` JSON property names and versioning, provided the convention is documented, Zod-validated, compatible with persisted JSON, and supports the locked workflow.
- Exact questionnaire route hierarchy, component boundaries, query parameter names, and plan/wave decomposition.
- Whether My Questionnaires is a dedicated list, dashboard-driven entry, or both, provided QUES-01 remains directly usable and accessible.
- Whether File upload rendering is included or explicitly deferred based on implementation proportionality.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md` — Product scope, workflows, roles, and UX expectations.
- `docs/references/specification.json` — Authoritative API paths and schemas.
- `docs/references/idambox-datamodel.jdl` — Authoritative CSRM domain terminology and relations.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` — Capability traceability catalogue copy.

### Existing implementation patterns
- `apps/strapi/src/api/csrm-assessment-request/` — Phase 2 controller, route, operations, ownership, and workflow guard patterns.
- `apps/strapi/src/policies/csrm-authorization.ts` — Strapi Function/FunctionAPI enforcement pattern.
- `apps/strapi/src/bootstrap/seed-development-content-api-permissions.ts` — Development permission allowlist and gating.
- `apps/strapi/src/bootstrap/seed-csrm-data.ts` — Existing seed style and development data.
- `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` — Runtime catalogue copy that must remain byte-identical to the docs copy.
- `apps/web/src/features/requests/` — Typed service, schema, server action, form, and test patterns.
- `apps/web/e2e/requestor-request-workflow.spec.ts` — Dual-server Requestor workflow pattern.
- `apps/strapi/tests/request-workflow.integration.test.ts` — Mounted Strapi workflow and ownership-test pattern.

### Design and engineering
- `docs/design/csrm-design-direction.md` — Authoritative design direction and semantic tokens.
- `AGENTS.md` and `apps/web/AGENTS.md` — Repository and web engineering constraints.

</canonical_refs>

<specifics>
## Specific Ideas

- Development fixtures use Jane Doe (`jane.doe@idambox.com`) as Requestor and Bob Doe (`bob.doe@idambox.com`) as Security Analyst.
- The sample questionnaire must be attached to a submitted assessment request so the entire Requestor-to-Analyst path is immediately exercisable in development and E2E.
- Known execution environment: Node v24.19.0; ports 1337, 3000, and 3100 are expected to be free for test runs.

</specifics>

<deferred>
## Deferred Ideas

- Production Keycloak integration remains Phase 8 work.
- File upload answer rendering may be deferred by Phase 3 research if upload plumbing is disproportionate; the persisted answer type remains documented and deliberately unsupported in the renderer until implemented.
- New questionnaire fields, content types, or a frontend API facade are out of scope.

</deferred>

---

*Phase: 03-dynamic-questionnaire-workflow*
*Context gathered: 2026-08-30 from operator-supplied planning constraints*
