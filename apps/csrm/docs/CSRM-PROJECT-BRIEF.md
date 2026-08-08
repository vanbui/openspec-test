# IdamBox Cyber Risk Manager — CSRM Web Application

## 1. Project

Build the first production-quality web application for:

IdamBox Cyber Risk Manager (CSRM)

CSRM is an agentic-AI-assisted Cyber Security Risk Management application.

The application automates cyber risk assessment workflows while keeping
Security Analysts in control of review, editing, approval and release.

The application is part of the BProton / IdamBox product family.

The product should feel:

- clean
- modern
- professional
- enterprise-ready
- uncluttered
- responsive
- accessible
- fast
- easy to understand
- easy to maintain and extend

Do not build the UI as a throw-away prototype. Establish a maintainable
application architecture and reusable design system that can grow into the
production CSRM product.

---

# 2. Reference Material

Treat these repository files as important project references:

1. docs/reference/CSRM Functions.docx
   - Defines the UI Functions/screens available to Requestor and
     Security Analyst roles.

2. docs/reference/idambox-datamodel.jdl
   - Defines the CSRM domain/data model.
   - Preserve its domain terminology.
   - Do not silently invent competing domain entities.

3. docs/reference/idambox-csrm-role-function-api-catalogue.json
   - Defines Roles, Functions and proposed FunctionApi mappings.
   - Use this as a starting API/UI capability catalogue.
   - API implementation may evolve but maintain traceability to Functions.

4. docs/references/specification.json
   - Defines the OpenAPI 3.1 contract generated from the Strapi backend.
   - Treat its paths, operations, parameters and schemas as the source of truth
     for communication between the CSRM application and the backend.

5. docs/reference/ux/*
   - Reference screenshots showing useful enterprise UX patterns.
   - They are inspiration, not designs to copy literally.

6. https://www.bproton.com
   - Visual brand reference for BProton.
   - CSRM should look like a BProton/IdamBox product rather than Saviynt.
   - Reuse BProton brand language, visual character, typography,
     colours and logo treatment where appropriate.

When requirements conflict, use this precedence:

1. Explicit CSRM requirements in this project brief
2. Strapi OpenAPI specification for backend API contracts
3. CSRM data model
4. CSRM Functions / API catalogue
5. BProton branding
6. UX reference screenshots

Raise conflicts rather than silently choosing a materially different domain
model.

---

# 3. Primary Users

There are initially two application roles.

## Requestor

A Requestor can:

- create a Cyber Risk Assessment Request
- save a request as a draft
- edit a request while permitted by workflow state
- submit a request
- collaborate with Security Analysts on the request
- view questionnaires associated with their requests
- complete generated questionnaires
- save questionnaire responses as drafts
- submit questionnaire responses
- view resulting Risk Assessments only after a Security Analyst releases them
- never modify a released Risk Assessment
- only access records that they are authorised to access

## Security Analyst

A Security Analyst can:

- view submitted Risk Assessment Requests
- review and edit requests
- ask for additional information
- review generated questionnaires
- review submitted questionnaire responses
- trigger or review AI-generated Risk Assessment drafts
- edit the Risk Assessment
- add, modify and remove contextual risks
- associate mitigation controls with risks
- assign owners
- set statuses
- set treatment due dates
- release a completed Risk Assessment to the Requestor
- manage the Risk Register
- manage Risk Types
- manage the reusable Control library
- manage Information Systems
- manage Information Assets
- import Controls, Risk Types, Information Systems and Information Assets from
  CSV files through the frontend
- view dashboards, reports and alerts

Security Analyst capabilities are broader than Requestor capabilities.

Authorization must be enforced server-side as well as in the UI.

---

# 4. Application Functions / Screens

## Requestor Navigation

### Dashboard
- Dashboard

### Risk Assessment Requests
- My Requests
- New Request
- Request Details

### Questionnaires
- My Questionnaires
- Questionnaire Details

### Risk Assessments
- My Risk Assessments
- Risk Assessment Details — read only

## Security Analyst Navigation

### Dashboard
- Dashboard

### Risk Assessment Requests
- Requests
- Request Details

### Questionnaires
- Questionnaires
- Questionnaire Details

### Risk Assessments
- Risk Assessments
- Risk Assessment Details

### Risk Register
- Risk Register
- Risk Details
- Mitigation Controls
- Mitigation Control Details

### Administration
- Risk Types
- Risk Type Details
- Control Library
- Control Details
- Information Systems
- Information System Details
- Information Assets
- Information Asset Details

The Risk Types, Control Library, Information Systems and Information Assets
list screens must each provide a Security Analyst action for importing records
from a CSV file through the frontend.

### Reports
- Reports
- Alerts

Navigation must be generated from role/capability configuration rather than
duplicated manually across layouts.

---

# 5. Core Business Workflow

The primary workflow is:

Requestor
  ->
Creates Risk Assessment Request
  ->
Saves / edits draft
  ->
Submits request
  ->
Security Analyst reviews request
  ->
AI analyses context and identifies relevant areas of risk
  ->
AI generates context-aware questionnaire
  ->
Requestor completes questionnaire
  ->
Requestor submits questionnaire
  ->
Security Analyst reviews questionnaire and responses
  ->
AI generates initial Risk Assessment draft
  ->
Security Analyst reviews and edits assessment
  ->
Risks and mitigation controls are managed
  ->
Security Analyst releases assessment
  ->
Requestor gets read-only access to released assessment

The application must represent workflow state clearly.

Do not allow the AI to automatically release a Risk Assessment.

Human review by a Security Analyst is mandatory before release.

Use workflow/status values from the data model where they already exist.
If additional states are required, document why before changing the domain
model.

---

# 6. Risk Assessment Request

A Risk Assessment Request needs to support different assessment scenarios,
including at minimum:

- new information system
- existing information system
- external exposure
- consumption of an external service

The structured request should capture enough context for the AI workflow to
understand:

- what is being assessed
- business purpose
- system or service
- information assets
- information classification
- business owners
- technical owners
- hosting model
- internal/external exposure
- users and user populations
- authentication and access model
- privileged access
- integrations
- external parties
- data flows
- management model
- operational model
- security-relevant characteristics

Use the JDL model as the source of truth for actual persisted fields.

Do not invent duplicate fields merely for UI convenience.

---

# 7. Questionnaire

The questionnaire is dynamic.

Questions should be generated based on the context supplied by the Risk
Assessment Request, including:

- type of system/service
- information assets
- data classification
- external exposure
- hosting
- access model
- integrations
- management model
- relevant risk types

UI requirements:

- clear progress indication
- grouped sections
- autosave or explicit Save Draft
- validation
- unanswered question indication
- ability to return later
- Submit confirmation
- Security Analyst review mode
- support conditional questions
- support future AI-generated questions without requiring page redesign

The UI must render questionnaire definitions from data rather than hard-code
every questionnaire field into a page.

---

# 8. Risk Assessment

The Risk Assessment screen is one of the most important screens.

It should present:

- assessment metadata
- scope/context
- assessment status
- identified risks
- risk statements
- affected systems/assets
- inherent likelihood
- inherent consequence/impact
- inherent risk rating
- mitigation controls
- residual likelihood
- residual consequence/impact
- residual risk rating
- risk treatment
- risk owner
- treatment owner
- target treatment date
- review date
- analyst notes where appropriate

Security Analysts can edit.

Requestors can view only after release and must receive a read-only view.

Design the editing experience for analysts separately from the released
read-only presentation where that improves usability.

---

# 9. Risk Register

The Risk Register provides an organisation-level working view of contextual
Risk records.

It must support:

- filtering
- search
- sorting
- pagination
- risk status
- risk rating
- residual risk rating
- owners
- treatment owners
- due dates
- related assessment
- related system/assets
- mitigation control status

Risk Details should provide the full context for one Risk.

Do not confuse:

Risk Type
with
Risk

Risk Type is the reusable/canonical risk definition or category.

Risk is the contextualised occurrence identified within an assessment.

Similarly, distinguish:

Control
from
Mitigation Control / Control Implementation

A Control is a reusable control definition.

A mitigation/control implementation represents use of a control in the
context of a particular Risk or assessment.

Follow the actual JDL terminology where names differ.

## Security Analyst Library and Inventory Management

Security Analysts must have dedicated list and create/view/edit screens for:

- Risk Types
- the reusable Control library
- Information Systems
- Information Assets

These screens should use the common administration patterns defined elsewhere
in this brief, including search, filtering, sorting and pagination where the
data volume warrants them.

Risk Types are reusable/canonical risk definitions or categories. They are
distinct from contextual Risk records created for a specific assessment and
shown in the Risk Register. Use the existing `CsrmRiskType` data-model entity;
do not introduce a competing domain entity solely for the frontend.

For each of the four object types, the frontend must support CSV import. The
import experience should:

- provide the expected CSV columns or a downloadable template
- allow a Security Analyst to select and upload a CSV file
- validate the file type, headers and required values before import
- show a preview and row-level validation errors before confirmation
- require confirmation before creating or updating records
- present an import result summary with created, updated and rejected rows
- make duplicate or ambiguous matches visible rather than silently overwriting
  records
- preserve server-side authorization and validation; parsing in the browser is
  not a substitute for backend enforcement

CSV import services and DTOs must use the same typed API/service boundary as
the rest of the application so the screens can move from mock implementations
to real backend APIs without being rewritten.

---

# 10. Dashboard

Provide role-specific dashboards.

## Requestor Dashboard

Focus on:

- requests requiring action
- questionnaires requiring completion
- recently submitted requests
- request status
- recently released assessments
- important notifications

## Security Analyst Dashboard

Focus on:

- requests awaiting review
- questionnaires awaiting review
- assessments awaiting review
- overdue mitigation activities
- high/critical risks
- treatment due dates
- recent activity
- relevant alerts

Dashboard widgets should be reusable and data driven.

Do not hard-code dashboard values.

---

# 11. UX Direction

Use the supplied Saviynt screenshots only as enterprise UX inspiration.

Useful patterns from the screenshots include:

- persistent desktop navigation
- collapsible navigation groups
- compact application header
- user/avatar menu
- clear content hierarchy
- card-based dashboard content
- data tables for administrative collections
- status badges
- detail pages
- grouped forms
- mobile navigation drawer

However improve on weaknesses visible in the reference UI.

In particular:

- do not allow desktop layouts simply to shrink onto mobile
- do not allow detail-page tabs to wrap across multiple rows on phones
- avoid tiny touch targets
- avoid extremely dense tables on mobile
- avoid horizontal page overflow
- avoid excessive borders
- avoid inconsistent spacing
- avoid large empty areas without purpose

---

# 12. Responsive Layout

Design mobile-first but optimise strongly for desktop enterprise usage.

## Desktop

Use:

- collapsible left navigation sidebar
- top application header
- breadcrumbs where useful
- generous content area
- responsive content max-width where appropriate
- cards
- tables
- multi-column forms
- optional detail-page secondary navigation

## Tablet

- collapsible/drawer navigation
- reduced column counts
- responsive grids
- no clipped controls

## Mobile

Use:

- hamburger menu
- shadcn Sheet/Drawer for navigation
- single-column forms
- stacked dashboard cards
- responsive action menus
- minimum comfortable touch targets
- concise headers

For data-heavy tables:

- hide secondary columns at narrow widths OR
- provide a mobile record-list/card presentation OR
- use deliberate contained horizontal scrolling only where unavoidable

For detail navigation:

Prefer a horizontally scrollable tab strip, select navigation, or
section/accordion pattern instead of wrapped multi-row tabs.

Test common widths including approximately:

- 375px
- 390px
- 430px
- 768px
- 1024px
- 1440px

---

# 13. Visual Design and Branding

The application must have its own IdamBox CSRM visual identity while being
clearly part of BProton.

Use BProton.com as the brand source of truth.

Do not hard-code brand colours throughout components.

Create semantic design tokens.

Examples:

- background
- foreground
- surface
- surface-muted
- primary
- primary-foreground
- secondary
- accent
- border
- destructive
- warning
- success
- info
- risk-low
- risk-medium
- risk-high
- risk-critical

Also tokenise:

- typography
- font sizes
- spacing
- radii
- shadows
- sidebar colours
- chart colours
- status colours

The appearance must be customisable primarily by changing theme tokens rather
than rewriting components.

Support an architecture capable of future customer/tenant branding.

Do not duplicate raw colour values throughout TSX files.

---

# 14. Front-End Technology

Use:

- Next.js
- App Router
- TypeScript with strict typing
- React
- Tailwind CSS
- shadcn/ui as the primary component foundation

Use Server Components by default where appropriate.

Introduce Client Components only when client-side interactivity requires them.

Keep the server/client boundary explicit.

Recommended supporting libraries where justified:

- React Hook Form for complex forms
- Zod for runtime validation and schemas
- TanStack Table for data-heavy tables
- Lucide icons
- a lightweight chart library compatible with shadcn for dashboard charts

Avoid adding dependencies when native React/Next.js/shadcn functionality is
sufficient.

Avoid a global state-management library unless there is a demonstrated need.

Use URL/search parameters for shareable list filters, pagination and sorting
where practical.

---

# 15. Component Architecture

Build reusable application primitives rather than screen-specific copies.

Examples:

AppShell
Sidebar
MobileNavigation
AppHeader
PageHeader
Breadcrumbs
PageActions
DataTable
DataTableToolbar
FilterBar
SearchInput
EmptyState
LoadingState
ErrorState
StatusBadge
RiskRatingBadge
MetricCard
DashboardWidget
DetailSection
DetailField
FormSection
FormActions
ConfirmDialog
OwnerPicker
DatePicker
UserAvatar
ActivityTimeline
CommentsPanel
QuestionnaireRenderer
QuestionRenderer
RiskSummary
ControlSummary
CsvImportDialog
CsvImportPreview
CsvImportResultSummary

Use shadcn primitives internally where appropriate.

Do not put all page logic into one very large component.

---

# 16. Suggested Project Organisation

Prefer feature/domain organisation over a flat components directory.

For example:

src/
  app/
  components/
    ui/
    layout/
    shared/
  features/
    dashboard/
    requests/
    questionnaires/
    assessments/
    risks/
    controls/
    risk-types/
    information-systems/
    information-assets/
    imports/
    administration/
    reports/
  lib/
    api/
    auth/
    validation/
    permissions/
    utils/
  domain/
    types/
    schemas/
  config/
    navigation/
    theme/

Exact structure may be refined during planning.

Avoid circular dependencies.

Keep domain logic outside presentation components.

---

# 17. API Architecture

The frontend must not scatter raw fetch calls throughout page components.

Create a typed API/service layer.

The service layer must call the Strapi backend API directly. Use
`docs/references/specification.json` as the authoritative contract for its
paths, HTTP methods, parameters, request bodies and response schemas. Generate
or derive TypeScript client types from that specification where practical so
contract drift is detected during development.

Use the FunctionApi catalogue to map application capabilities to the relevant
Strapi operations, but do not treat it as a replacement transport contract.
Do not introduce a separate `/api/v1` facade or a mock-only API contract unless
an explicit architecture decision adds one later.

The typed service layer must also expose CSV import operations for Controls,
Risk Types, Information Systems and Information Assets. Final endpoint shapes
must be added to the Strapi backend OpenAPI specification and reflected in the
FunctionApi catalogue.

When a required operation is absent from the OpenAPI specification, treat it as
a backend API gap to implement and document rather than substituting a frontend
mock endpoint.

Create:

- typed request DTOs
- typed response DTOs
- API errors
- consistent result handling
- loading/error states

Keep domain types separate from transport/API types where beneficial.

Frontend development and automated tests may use fixtures or an HTTP-level
Strapi test double, but the production service implementation and its contract
must always target the Strapi backend API.

---

# 18. Authentication and Authorization

Authentication technology is not yet the main focus and may be finalised
separately.

Design authentication behind an abstraction.

For development, allow a safe mock/dev identity mechanism so both roles can
be tested easily:

- Requestor
- Security Analyst

Do not scatter checks such as:

if (role === "analyst")

through dozens of components.

Implement central capability/permission helpers.

Examples conceptually:

canViewRequest
canEditRequest
canSubmitQuestionnaire
canEditAssessment
canReleaseAssessment
canManageRiskTypes
canManageControls
canManageInformationSystems
canManageInformationAssets
canImportLibraryData

Navigation visibility is not a security control.

The backend/server layer must also enforce authorization.

Protect against IDOR: a Requestor must not retrieve another user's restricted
record merely by changing a URL identifier.

---

# 19. AI Architecture

AI is a core product capability but must not be tightly coupled to UI code.

Create a provider-independent AI/service boundary.

Conceptual AI operations include:

- analyse request context
- research context
- identify relevant Risk Types
- determine missing information
- generate questionnaire
- analyse questionnaire responses
- generate assessment draft
- suggest risks
- suggest mitigation controls
- suggest follow-up questions

AI operations may be asynchronous.

The UI should be able to display:

- queued
- analysing
- generating
- completed
- failed
- retry available

Do not make users wait on an indefinitely spinning browser request.

Do not allow AI-generated output to bypass analyst review.

Store enough metadata in the eventual architecture to support:

- provenance
- generated time
- model/provider where appropriate
- review state
- human modifications
- audit history

Treat external/retrieved content and user-supplied text as untrusted content.

Do not let retrieved text become privileged application instructions.

---

# 20. Collaboration

Requestors and Security Analysts should be able to collaborate around:

- Risk Assessment Request
- questionnaire clarification
- assessment review where permitted

Architect for:

- comments
- activity/history
- timestamps
- actor identity
- workflow transitions

If the current data model lacks these capabilities, record them as identified
gaps rather than quietly creating a second competing model.

Real-time collaborative editing is NOT required for the first milestone unless
explicitly added later.

Normal save/edit/comment workflows are sufficient initially.

---

# 21. Accessibility

Target WCAG 2.2 AA quality.

Requirements include:

- keyboard operability
- visible focus states
- semantic HTML
- appropriate labels
- accessible validation errors
- colour is not the only way risk/status is communicated
- sufficient colour contrast
- accessible dialogs
- accessible tables
- useful page titles
- sensible heading hierarchy
- screen-reader friendly loading/error state
- touch-friendly mobile controls

---

# 22. Security Requirements

This is a cyber security product and should demonstrate good application
security practices.

At minimum:

- no secrets in client-side bundles
- secure environment variable handling
- server-side authorization
- validate untrusted input
- output escaping
- protect against XSS
- protect state-changing endpoints appropriately
- avoid unsafe HTML rendering
- security headers
- safe error handling
- do not expose stack traces to end users
- prevent IDOR
- protect sensitive risk information
- avoid logging secrets or sensitive questionnaire contents unnecessarily
- dependency hygiene
- no credentials committed to Git

Design for an audit trail of significant domain actions.

---

# 23. Loading, Empty and Error States

Every major screen must deliberately support:

- loading
- empty
- populated
- error
- permission denied

Lists should have useful Empty States rather than blank tables.

Forms must preserve useful context when validation fails.

AI failures should be recoverable and understandable.

---

# 24. Testing

Establish testing from the beginning.

Include:

- unit tests for important domain/permission/validation logic
- component tests for complex reusable components where valuable
- integration tests for important workflows
- Playwright end-to-end tests for critical user journeys

Critical E2E journeys should eventually include:

Requestor:
Create Request
-> save
-> edit
-> submit

Requestor:
Open Questionnaire
-> answer
-> save draft
-> submit

Security Analyst:
Review Request
-> review Questionnaire
-> produce/review assessment draft
-> edit assessment
-> release assessment

Requestor:
View released assessment in read-only mode

Security Analyst:
Open Risk Register
-> inspect Risk
-> update mitigation information

Security Analyst:
Open each library or inventory
-> import a CSV file
-> review validation results
-> confirm the import
-> verify the resulting records

Responsive layouts should be tested at desktop and mobile sizes.

---

# 25. Code Quality

Priorities:

1. correctness
2. readability
3. maintainability
4. security
5. accessibility
6. testability
7. performance
8. visual consistency

Use:

- strict TypeScript
- small focused modules
- explicit types
- meaningful naming
- centralised configuration
- reusable schemas
- reusable UI primitives

Avoid:

- `any` unless unavoidable and documented
- giant page components
- copy/paste forms
- duplicate status mappings
- duplicate role rules
- hard-coded colours
- hard-coded API URLs in components
- business logic buried inside JSX
- unnecessary abstractions
- unnecessary state-management libraries
- premature microservices

---

# 26. Performance

Do not over-engineer performance initially, but follow good defaults.

Use:

- Server Components where they reduce client JavaScript
- route-level loading states
- sensible code splitting
- paginated large datasets
- debounced search where appropriate
- image/font optimisation
- skeletons for meaningful loading states

Avoid fetching entire large Risk Registers merely to render one page.

---

# 27. Design System

Create a small CSRM design system built on shadcn/ui.

It should contain:

- semantic theme tokens
- typography scale
- spacing conventions
- component variants
- status semantics
- risk-rating semantics
- form conventions
- table conventions
- page-layout conventions

The design system should permit the BProton theme to be changed later without
rewriting feature pages.

Future customer-specific branding should be possible.

---

# 28. UX Details

Use consistent patterns.

List screens:
- Page title
- short optional description
- primary action
- filters/search
- table/list
- pagination

Detail screens:
- title/identifier
- status
- primary actions
- important metadata
- logically grouped sections
- contextual related records
- history/activity when supported

Forms:
- logical groups
- inline help only where useful
- validation next to field
- Save Draft where workflow permits
- clear Submit action
- confirmation for irreversible workflow transitions
- protect against accidental loss of unsaved work where reasonable

Use toast notifications for successful background actions where appropriate.

Do not use modals for complex multi-section editing when a dedicated page is
more usable.

---

# 29. Initial Development Strategy

Build vertical slices rather than creating every empty screen first.

Suggested progression:

Phase 1 — Foundation
- Next.js project
- TypeScript
- Tailwind
- shadcn/ui
- theme/design tokens
- BProton visual treatment
- AppShell
- responsive sidebar/header
- role/capability model
- mock authentication
- typed API abstraction
- test infrastructure

Phase 2 — Requestor Request Workflow
- Requestor Dashboard
- My Requests
- New Request
- Request Details
- draft/save/edit/submit flow

Phase 3 — Questionnaire Workflow
- My Questionnaires
- Questionnaire Details
- dynamic questionnaire renderer
- save draft
- submit
- analyst questionnaire views

Phase 4 — Assessment Workflow
- analyst Requests
- analyst Request Details
- Risk Assessments
- editable Risk Assessment Details
- AI-generation state/prototype
- release workflow
- Requestor read-only assessment view

Phase 5 — Risk Register
- Risk Register
- Risk Details
- Mitigation Controls
- Mitigation Control Details

Phase 6 — Administration
- Risk Types
- Risk Type Details
- Control Library
- Control Details
- Information Systems
- Information System Details
- Information Assets
- Information Asset Details
- CSV import for Controls, Risk Types, Information Systems and Information
  Assets

Phase 7 — Dashboard / Reporting
- analyst dashboard metrics
- reports
- alerts

Phase 8 — Integration and Hardening
- real backend integration
- real authentication
- AI service integration
- authorization verification
- accessibility
- security hardening
- performance
- expanded E2E tests

GSD may adjust phase boundaries if research shows a better dependency order,
but preserve vertical deliverables and demonstrable working software.

---

# 30. First Milestone Definition of Done

The first useful milestone should allow a complete mocked or real vertical
journey:

1. Sign in/select Requestor role.
2. Create a Risk Assessment Request.
3. Save and submit it.
4. Security Analyst can review it.
5. A questionnaire can be generated or simulated.
6. Requestor can complete and submit questionnaire.
7. Security Analyst can review responses.
8. Initial Risk Assessment can be generated or simulated.
9. Security Analyst can edit risks and mitigation controls.
10. Security Analyst can release the Risk Assessment.
11. Requestor can view released assessment read-only.
12. Relevant risks appear in the Risk Register.
13. Application works cleanly on desktop and mobile.
14. Important permissions are enforced.
15. Critical workflow has automated tests.

AI calls may initially be represented by deterministic mocks if necessary to
deliver and validate the end-to-end product workflow before model integration.

---

# 31. What Is Explicitly Out of Scope for the Initial Version

Unless separately approved, do not make these dependencies for the first
working version:

- complex multi-tenant administration
- real-time Google-Docs-style co-editing
- mobile native application
- fully configurable no-code workflow designer
- full enterprise GRC suite
- certification/compliance framework management
- automatic risk acceptance
- automatic release of AI-generated assessments
- custom ML model training
- elaborate microservice architecture
- premature event-driven infrastructure
- tenant-specific visual theme editor

Design so important future capabilities can be added, but do not implement
them prematurely.

---

# 32. Decisions GSD Should Explicitly Research or Confirm

Before implementation, identify and document decisions for:

- authentication provider
- backend/API ownership
- API authentication model
- persistence strategy
- deployment target
- AI provider/model
- asynchronous AI execution
- file/attachment storage
- comments/activity model
- audit model
- notification mechanism
- final BProton design tokens
- whether assessment collaboration requires optimistic concurrency
- whether charts need a dedicated charting package

Do not block development of the frontend foundation unnecessarily when these
can be represented through adapters.

---

# 33. Overall Product Principle

CSRM should make a complex cyber-risk workflow feel simple.

The UI should not expose the complexity of the underlying AI orchestration or
data model unless doing so helps the user make a risk decision.

Requestors should feel guided.

Security Analysts should feel in control.

AI should assist, propose and accelerate.

Humans remain responsible for assessment review and release.
