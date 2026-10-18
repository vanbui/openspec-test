# Phase 6: CSRM Foundation - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the production-quality CSRM Next.js application foundation under `apps/csrm`: workspace integration, strict TypeScript App Router architecture, semantic BProton-aligned design system, responsive application shell, centralized Function-derived capability model, typed Strapi OpenAPI service boundary, development identity fixtures, and automated test infrastructure. Feature workflows for requests, questionnaires, assessments, risks, administration, reporting, production Keycloak/OIDC, and real authorization enforcement remain in their later roadmap phases.

</domain>

<decisions>
## Implementation Decisions

### Application Architecture
- Organize application source under `apps/csrm/src` using App Router plus feature-oriented `features`, `domain`, `lib`, and `config` directories.
- Use Server Components by default and isolate interactive behavior in small, explicit Client Components.
- Prefer server state, URL state, and local React state; do not add a global state library without a concrete requirement.
- Name the workspace package `@idambox/csrm`, integrate it with root Turbo scripts, and configure its development port independently from Strapi and Keycloak.

### Design System and App Shell
- Use a light-first enterprise visual treatment with restrained BProton styling, strong typography, generous whitespace, and blue/teal accents.
- Express branding through semantic CSS tokens with light and dark-ready values; reusable components must not scatter raw brand colours.
- Provide a collapsible, domain-grouped desktop sidebar with product identity and clear active-route treatment.
- Provide a compact mobile header and accessible navigation drawer; content and actions reflow responsively rather than shrink in place.
- Include contextual page heading or breadcrumbs and an account menu in the shell. Generate navigation visibility from centralized capabilities.

### Capabilities and Development Identity
- Derive stable capability identifiers from the existing Function catalogue and expose them through one typed registry; do not invent competing frontend-only permission names or scatter role-string checks.
- Combine birthright Requestor capabilities with explicitly assigned elevated roles such as Security Analyst. Keycloak proves identity but is not the authorization source.
- Provide deterministic Requestor and Security Analyst fixtures, with an identity/role switcher available only in development and automated tests.
- Hide unavailable navigation and actions for usability, and render a proper forbidden state for direct unauthorized route access. Backend authorization remains authoritative.

### API Boundary and Testing
- Generate TypeScript transport types from `apps/csrm/docs/references/specification.json`, then wrap them in focused domain services rather than exposing a generated SDK throughout UI code.
- Use MSW as the HTTP-level Strapi test double so fixtures exercise the same production service contract.
- Normalize transport failures into typed API errors and discriminated service results.
- Use Vitest and Testing Library for unit/component tests, MSW for integration tests, and Playwright for desktop and mobile application-shell smoke coverage.

### the agent's Discretion
- Exact compatible dependency versions, token values, typography choices, responsive breakpoints, icon set, component composition, generated-type tooling configuration, and test-file organisation may follow current ecosystem guidance and repository conventions.
- Choose the specific independent local development port while avoiding the established Strapi and Keycloak ports.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend` supplies the existing Strapi application, schemas, bootstrap catalogues, and OpenAPI source contract.
- `apps/csrm/docs/references/specification.json` is the authoritative transport contract.
- `apps/csrm/docs/references/idambox-csrm-role-function-api-catalogue.json` supplies the initial Function and FunctionApi capability vocabulary.
- `apps/csrm/docs/CSRM-PROJECT-BRIEF.md` defines product architecture, navigation, design-system expectations, and phased delivery boundaries.

### Established Patterns
- The repository is a Turbo/Yarn workspace with applications under `apps/*` and root scripts for common workflows.
- Authorization follows `IdamBoxUser -> Role -> Function -> Application`, with FunctionApi operation grants; Requestor is a birthright role and elevated roles are explicit.
- Existing verification scripts favor deterministic static checks plus integration tests against real Strapi behavior.

### Integration Points
- Add `apps/csrm` to the root workspace and Turbo task graph without changing the existing backend or identity-provider launch paths.
- Generate frontend transport types from the committed Strapi OpenAPI document and fail development checks on contract drift.
- Keep the Phase 6 mock identity boundary replaceable by the production Keycloak/OIDC and effective-capability integration planned for Phase 13.

</code_context>

<specifics>
## Specific Ideas

- The product should feel clean, modern, professional, enterprise-ready, uncluttered, responsive, accessible, and fast.
- Use BProton's open-standards and IdamBox product identity as brand inspiration without turning the application shell into a marketing page.
- Future feature navigation may be represented in centralized configuration, but only implemented/enabled routes should be actionable during Phase 6.

</specifics>

<deferred>
## Deferred Ideas

- Production Keycloak/OIDC session handling and real effective-capability retrieval — Phase 13.
- Requestor, questionnaire, assessment, risk-register, administration, reporting, and alert workflows — Phases 7-12.
- Provider-independent AI services and AI workflow states — later workflow phases and Phase 13 integration.
- Customer-specific branding controls beyond dark-ready semantic tokens — future product work.

</deferred>
