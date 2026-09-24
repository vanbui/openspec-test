# Requirements: IdamBox Cyber Risk Manager (CSRM)

**Defined:** 2026-08-27  
**Core Value:** Make a complex cyber-risk workflow simple and auditable while keeping Security Analysts—not AI—in control of assessment review and release.

## v1 Requirements

### Foundation

- [x] **FOUND-01**: The repository provides reproducible Turborepo tasks for the `apps/strapi` and `apps/web` workspaces.
- [x] **FOUND-02**: The web application provides a strict-TypeScript Next.js App Router foundation with semantic BProton/IdamBox theme tokens and reusable responsive application shell.
- [x] **FOUND-03**: The web application uses a typed service boundary derived from the Strapi OpenAPI specification rather than page-level raw fetch calls.
- [x] **FOUND-04**: The application renders navigation and actions from effective capability configuration, while Strapi enforces Role → Function → FunctionAPI grants and record-level authorization.
- [x] **FOUND-05**: The foundation provides automated unit, component/integration, and end-to-end test infrastructure with deliberate loading, empty, error, and permission-denied states.

### Requests

- [x] **REQ-01**: A Requestor can view only authorised Risk Assessment Requests with status, search, filtering, sorting, and pagination.
- [x] **REQ-02**: A Requestor can create a structured Risk Assessment Request using persisted CSRM fields and assessment context.
- [x] **REQ-03**: A Requestor can save, resume, and edit a draft while its workflow state permits it.
- [x] **REQ-04**: A Requestor can submit a valid request and receive an unambiguous workflow-state confirmation.
- [x] **REQ-05**: A Requestor dashboard shows requests and questionnaires requiring action and recently released assessments from data-driven widgets.
- [x] **REQ-06**: An owning Requestor or an authorised Security Analyst can revert a `submitted` Risk Assessment Request to `draft` with a mandatory recorded reason, then edit and resubmit it.

### Questionnaires

- [x] **QUES-01**: A Requestor can view only questionnaires associated with authorised requests.
- [x] **QUES-02**: A Requestor can complete a data-defined, grouped, conditional questionnaire with progress and unanswered-question indication.
- [x] **QUES-03**: A Requestor can save questionnaire responses as a draft and resume later.
- [x] **QUES-04**: A Requestor can submit a valid questionnaire after an explicit confirmation.
- [x] **QUES-05**: A Security Analyst can review questionnaire definitions and submitted responses.
- [x] **QUES-06**: An owning Requestor or an authorised Security Analyst can revert a submitted questionnaire to draft with a mandatory recorded reason while no assessment draft exists, then edit and resubmit it with answer values preserved.
- [x] **QUES-07**: A Security Analyst can trigger a reviewable AI job from a submitted Risk Assessment Request that generates a contextualised questionnaire, with queued, running, completed, failed, and retry states and recorded provenance.

### Assessments

- [x] **ASSESS-01**: A Security Analyst can view and review submitted requests authorised to them.
- [x] **ASSESS-02**: A Security Analyst can trigger or observe a reviewable AI assessment-draft job with queued, running, completed, failed, and retry states.
- [x] **ASSESS-03**: A Security Analyst can edit assessment metadata, contextual risks, ratings, owners, treatments, target dates, and mitigation-control implementations.
- [x] **ASSESS-04**: A Security Analyst can explicitly release a completed assessment only after required review.
- [x] **ASSESS-05**: A Requestor can view an authorised released assessment read-only and cannot modify it.

### Risk Register

- [x] **RISK-01**: A Security Analyst can search, filter, sort, and paginate contextual Risk records by status, ratings, owners, dates, assessments, systems/assets, and mitigation status.
- [x] **RISK-02**: A Security Analyst can view Risk details and maintain its mitigation-control implementation information.

### Administration

- [x] **ADMIN-01**: A Security Analyst can list and create, view, or edit CsrmRiskType records without conflating them with contextual Risks.
- [x] **ADMIN-02**: A Security Analyst can list and create, view, or edit reusable CsrmControl records without conflating them with control implementations.
- [x] **ADMIN-03**: A Security Analyst can list and create, view, or edit CsrmInformationSystem and CsrmInformationAsset records.
- [x] **ADMIN-04**: A Security Analyst can import Risk Types, Controls, Information Systems, and Information Assets from CSV with template/column guidance, client validation, preview, row errors, confirmation, and result summary.

### Workflow Experience

- [x] **UX-01**: The "My Requests", "My Questionnaires", and "My Risk Assessments" screens are owner-scoped for every actor, so a Security Analyst who submits a request sees that request, its questionnaire, and its released assessment there and no other Requestor's records.
- [x] **UX-02**: A Requestor selects zero or more CsrmInformationSystem and CsrmInformationAsset records through a searchable server-backed selector, and a Security Analyst assigns a Risk owner by searching IdamBox users rather than typing free text.
- [x] **UX-03**: "My Questionnaires", "My Risk Assessments", and the three analyst review screens each offer server-backed search and status filtering consistent with "My Requests", and an authorised released assessment opens without a service-unavailable failure.
- [ ] **UX-04**: A Risk Assessment Request links to its questionnaire and to an assessment tile reporting Low, Moderate, High, and Critical contextual Risk counts; a Questionnaire links back to its request; and release readiness names the specific record and field behind every outstanding requirement.
- [ ] **UX-05**: Every list opens a record from its identifier or title with no redundant open control, and shared controls present consistently across screens.

### Dashboards and Reports

- [ ] **DASH-01**: A Security Analyst dashboard presents data-driven review queues, high/critical risks, overdue treatments, due dates, recent activity, and alerts.
- [ ] **DASH-02**: A Security Analyst can view reports and alerts through authorised, responsive screens.

### Integration and Assurance

- [ ] **INT-01**: The production web service implementation calls Strapi operations defined in the OpenAPI contract; missing operations are documented and added to the backend contract.
- [ ] **INT-02**: The application uses Keycloak authorization-code authentication and Strapi validates token issuer, audience, signature, expiry, and effective CSRM authorisation server-side.
- [x] **INT-03**: AI integrations preserve provenance, review state, human modifications, safe failure/retry behaviour, and never release an assessment automatically.
- [ ] **INT-04**: Critical journeys, responsive behaviour, WCAG 2.2 AA concerns, security controls, performance, and IDOR protection are verified.

## v2 Requirements

- **COLLAB-01**: Users can add comments and activity history to permitted requests, questionnaires, and assessments when the data model/API supports it.
- **NOTIFY-01**: Users receive configurable notifications for workflow events and due dates.
- **TENANT-01**: Customers can administer tenant-specific branding and multi-tenant configuration.
- **WORKFLOW-01**: Administrators can configure no-code workflow definitions.

## Out of Scope

| Feature | Reason |
|---|---|
| Automatic AI assessment release | Human analyst review and release are mandatory. |
| Real-time collaborative editing | Normal save/edit flows meet the first-milestone need. |
| Native mobile app | Responsive web application is the first delivery. |
| Full GRC suite and custom ML training | Not part of the core assessment workflow. |
| Frontend API facade | The Strapi OpenAPI contract is the production service contract. |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| FOUND-01–FOUND-05 | Phase 1 | Complete; ready for re-verification |
| REQ-01–REQ-05 | Phase 2 | Complete |
| REQ-06 | Phase 06.1 | Complete |
| QUES-01–QUES-05 | Phase 3 | Complete |
| QUES-06 | Phase 06.1 | Complete |
| QUES-07 | Phase 06.2 | Complete |
| ASSESS-01–ASSESS-05 | Phase 4 | Complete |
| RISK-01–RISK-02 | Phase 5 | Complete |
| ADMIN-01–ADMIN-04 | Phase 6 | Complete |
| UX-01–UX-03 | Phase 06.3 | Pending |
| UX-04–UX-05 | Phase 06.4 | Pending |
| DASH-01–DASH-02 | Phase 7 | Pending |
| INT-03 | Phase 06.7 (advanced, complete 2026-09-15), Phase 8 (verified) | Complete |
| INT-01, INT-02, INT-04 | Phase 8 | Pending |

**Coverage:**

- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-27*  
*Last updated: 2026-09-15 after completing Phase 06.7*
