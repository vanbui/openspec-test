# Phase 7: Requestor Request Workflow - Context

**Gathered:** 2026-08-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the Requestor-owned Cyber Risk Assessment Request workflow: dashboard, My Requests, New Request, Request Details, draft saving/editing/submission, and clear workflow state. The user approved direct Strapi integration in this phase, including the backend ownership and authorization work necessary to prevent cross-request access. Questionnaire, assessment, risk-register, administration, reporting, and full production hardening remain in their roadmap phases.

</domain>

<decisions>
## Implementation Decisions

### Persistence and access boundary
- **D-01:** Integrate Phase 7 directly with Strapi rather than using a deterministic MSW-only request store. Include the backend ownership and authorization work required by this Requestor workflow. — **Reversibility:** costly — replacing this boundary later would touch request services, authorization policies, and all workflow screens.
- **D-02:** Record access and available actions must continue to come from centralized capabilities, with server-side ownership enforcement preventing identifier-based access to another Requestor's records.

### Request lifecycle and ownership actions
- **D-03:** A Requestor can withdraw a submitted request back to `draft` until an analyst starts processing it; after processing starts, it is read-only to the Requestor.
- **D-04:** Security Analysts can view and edit a Requestor's unsubmitted draft.
- **D-05:** Analyst edits leave the request in `draft`; the Requestor must review and explicitly submit it.

### Persisted request form
- **D-06:** Present existing Strapi fields in one progressive, sectioned page rather than a wizard or unstructured long form.
- **D-07:** Saving a draft requires only `title`; submitting enforces the agreed essential persisted fields. Do not invent duplicate frontend-only domain fields.
- **D-08:** Information Systems and Information Assets use searchable selections from the existing Strapi catalogues; either relation may remain empty when none applies.
- **D-09:** Show `thirdPartyDetails` only when `thirdPartyInvolvement` is true and require it when submitting.

### Dashboard and My Requests
- **D-10:** The Requestor dashboard is action-first: needs-attention requests lead, followed by recent submissions, status summary, and notifications.
- **D-11:** My Requests is a sortable table on desktop and compact request cards on mobile.
- **D-12:** My Requests defaults to most recently updated first and initially provides keyword search plus a status filter only.

### the agent's Discretion
- Define the exact essential submission fields from the persisted Strapi schema and CSRM data-model terminology, preserving draft permissiveness.
- Determine the implementation details needed to reconcile the approved direct Strapi authorization work with the later Phase 13 OIDC/hardening scope; do not silently weaken ownership enforcement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contract
- `.planning/ROADMAP.md` §Phase 7 — goal, success criteria, and hard boundaries.
- `.planning/REQUIREMENTS.md` §CSRM-05 — Requestor creation, viewing, and editing requirement.
- `apps/csrm/docs/CSRM-PROJECT-BRIEF.md` §§3–6 — user permissions, workflow order, Requestor screens, and request-form guidance.

### Domain and backend contract
- `apps/backend/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json` — persisted request attributes, relationships, and permitted statuses.
- `apps/csrm/docs/references/idambox-datamodel.jdl` — canonical CSRM domain terms and relationships.
- `apps/csrm/docs/references/specification.json` — generated Strapi OpenAPI contract; source of truth for request transport.
- `apps/csrm/docs/references/idambox-csrm-role-function-api-catalogue.json` — role, Function, and FunctionApi traceability for Requestor and analyst operations.

### Foundation contracts
- `.planning/phases/06-create-the-idambox-csrm-next-js-application/06-CONTEXT.md` — App Router, capability, API-boundary, fixture, and test decisions to preserve.
- `.planning/phases/06-create-the-idambox-csrm-next-js-application/06-UI-SPEC.md` — inherited BProton visual, responsive, accessibility, state, and copy contract.
- `.planning/phases/07-requestor-request-workflow/.continue-here.md` — mandatory fixture-exclusion and dependency-provenance constraints.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/csrm/src/components/shell/app-shell.tsx` and `page-header.tsx`: responsive shell, page hierarchy, navigation, and action placement.
- `apps/csrm/src/components/states/`: reusable loading, empty, error, access-denied, unavailable, and optional-value states.
- `apps/csrm/src/config/capabilities.ts`, `routes.ts`, and `domain/route-access.ts`: centralized Function-derived route/action access model.
- `apps/csrm/src/lib/api/client.ts`, `csrm-service.ts`, and generated `openapi.ts`: server-only typed Strapi transport boundary.
- `apps/csrm/src/test/handlers.ts` and `msw-server.ts`: HTTP-level testing pattern that must use the same production contract.

### Established Patterns
- Server Components are the default; small Client Components contain interaction state.
- The current service boundary returns safe typed results and fails closed for undeclared HTTP in tests.
- Development identities are server-gated and production builds replace fixture/evidence modules at compile time; direct request work must preserve full emitted-asset and production-HTTP exclusion checks.
- Desktop tables need a deliberate mobile card/list alternative; page-wide horizontal overflow is prohibited.

### Integration Points
- Add Requestor routes through the centralized route and capability configuration, not duplicated navigation or role checks.
- Extend the typed Strapi service boundary for request and catalogue operations, and implement ownership checks at the backend boundary.
- Extend the existing unit, component, HTTP, Playwright, production-build, and mobile-accessibility test foundations.

</code_context>

<specifics>
## Specific Ideas

- Use the persisted terms `Risk Assessment Request`, `Information System`, and `Information Asset`; do not call requests tickets, cases, or generic items.
- At mobile widths beginning around 375px, list cards replace desktop table density while preserving search, status filtering, sorting, and pagination access.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-requestor-request-workflow*
*Context gathered: 2026-08-22*
