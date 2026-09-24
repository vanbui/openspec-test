# Roadmap: IdamBox Cyber Risk Manager (CSRM)

## Milestone 1: Controlled Cyber Risk Assessment Workflow

Deliver a production-quality, responsive CSRM application that proves the complete Requestor-to-Security-Analyst workflow while keeping Strapi authoritative for data and authorization.

### Phase 1: Monorepo Foundation and Secure Application Shell

**Goal:** Establish the Turborepo, move the existing Strapi application into `apps/strapi`, create the Next.js `apps/web` foundation, and prove the shared security, API, design, and test boundaries.
**Mode:** mvp
**UI hint:** yes
**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05
**Plans:** 10/11 plans complete

**Success Criteria:**

1. The repository runs reproducible root tasks for the Strapi and Next.js workspaces with one chosen package-manager/lockfile strategy.
2. The web application renders an accessible, responsive BProton/IdamBox AppShell using semantic design tokens, capability-driven navigation, and deliberate state components.
3. A typed service boundary uses the Strapi OpenAPI contract; pages do not issue ad-hoc production fetch calls.
4. Authentication/session and capability adapters establish the Keycloak-to-Strapi authorization design, including server-side IDOR and FunctionAPI enforcement tests.
5. Unit, component/integration, and Playwright E2E test foundations run in CI-oriented Turbo tasks.

### Phase 2: Requestor Risk Assessment Request Workflow

**Status:** Complete (2026-08-30)
**Goal:** As a Requestor, I want to create, save, edit, submit, and track only my authorised Risk Assessment Requests, so that I can initiate and follow cyber-risk work without crossing record or workflow boundaries.
**Mode:** mvp
**UI hint:** yes
**Requirements:** REQ-01, REQ-02, REQ-03, REQ-04, REQ-05
**Plans:** 12/12 plans complete

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Define the failing end-to-end Requestor workflow contract and dual-server harness.
- [x] 02-02-PLAN.md — Add the fail-closed Strapi development identity and least-privilege permission bridge.
- [x] 02-03-PLAN.md — Attach the server-derived development fixture identity through typed web transport.
- [x] 02-04-PLAN.md — Build the complete reusable CSRM DataTable contract, including density and focus behavior.
- [x] 02-10-PLAN.md — Extract the shared PageHeader and add accessible detail/form section composites.
- [x] 02-11-PLAN.md — Add non-color-only status, irreversible confirmation, and root notification composites.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-05-PLAN.md — Enforce owner scope, server-owned request facts, pagination, and draft-to-submitted workflow in Strapi.
- [x] 02-06-PLAN.md — Correct the typed API contract and secure/catalogue supporting inventory reads.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-07-PLAN.md — Deliver the authorised searchable, filterable, sortable, paginated My Requests slice.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-12-PLAN.md — Add authoritative shared mutation schemas, typed Strapi services, and Server Actions.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-08-PLAN.md — Deliver the structured form and create/detail/edit pages with irreversible submit interaction.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-09-PLAN.md — Deliver the data-driven Requestor dashboard and make the full acceptance journey green.

**Success Criteria:**

1. Requestors see only authorised requests in a responsive, searchable, filterable, paginated My Requests view and dashboard action widgets.
2. A structured New Request and Request Details experience uses actual CSRM persisted fields rather than duplicate UI-only data.
3. Draft requests can be saved, resumed, and edited only while their status permits it.
4. Submission validates the request, confirms the irreversible transition, and makes the resulting workflow state clear.

### Phase 3: Dynamic Questionnaire Workflow

**Status:** Complete (2026-08-30)
**Goal:** As a Requestor, I want to complete data-defined questionnaires for my authorised requests over time and submit them when valid, so that Security Analysts receive the structured context they need to review and assess risk.
**Mode:** mvp
**UI hint:** yes
**Requirements:** QUES-01, QUES-02, QUES-03, QUES-04, QUES-05
**Plans:** 12/12 plans complete

Plans:

- **Wave 1:** 03-01 (RED browser journey), 03-02 (versioned JSON contract), 03-03 (OpenAPI/catalogue contract)
- **Wave 2:** 03-04 (authorised questionnaire reads)
- **Wave 3:** 03-05 (draft and atomic submit workflow)
- **Wave 4:** 03-06 (development seed/permissions), 03-07 (typed web services/actions)
- **Wave 5:** 03-08 (Requestor discovery), 03-09 (shared renderer and Requestor detail)
- **Wave 6:** 03-10 (analyst discovery and shared read-only review)
- **Wave 7:** 03-11 (navigation and Requestor dashboard integration)
- **Wave 8:** 03-12 (green dual-server journey and final security gate)

**Success Criteria:**

1. Requestors can access only questionnaires related to authorised requests.
2. The questionnaire renderer supports grouped, conditional, data-defined questions with progress, validation, and unanswered indications.
3. Responses can be saved as drafts, resumed, and submitted only when valid, with clear confirmation and error recovery.
4. Security Analysts can review questionnaire definitions and submitted responses without a parallel screen implementation.

### Phase 4: Assessment Review, Risk Editing, and Release

**Status:** Complete (2026-08-31)
**Goal:** As a Security Analyst, I want to review submitted requests, observe reviewable AI draft jobs, edit assessment risks and mitigations, and explicitly release completed assessments, so that Requestors receive vetted, read-only risk assessments under analyst control.
**Mode:** mvp
**UI hint:** yes
**Requirements:** ASSESS-01, ASSESS-02, ASSESS-03, ASSESS-04, ASSESS-05
**Plans:** 23/23 plans complete

Plans:

- **Wave 1:** 04-01 (RED browser/harness), 04-02 (contract and gap records)
- **Wave 2:** 04-03 (IDs and release domain)
- **Wave 3:** 04-04 (deterministic provider/registry/seed), 04-05 (analyst review queue)
- **Wave 4:** 04-06 (draft-job backend)
- **Wave 5:** 04-07 (assessment metadata backend)
- **Wave 6:** 04-15 (full frozen non-server-owned contextual Risk backend)
- **Wave 7:** 04-08 (exact frozen-field ControlImplementation backend)
- **Wave 8:** 04-16 (atomic release and owner-only released reads)
- **Wave 9:** 04-09 (typed web boundary)
- **Wave 10:** 04-10 (analyst review/job UI), 04-13 (analyst editor/rating/release UI)
- **Wave 11:** 04-11 (Requestor released list/detail), 04-14 (Requestor dashboard released projection)
- **Wave 12:** 04-12 (green E2E and security gate)
- **Wave 14:** 04-17 (actor-specific lossless assessment detail contract)
- **Wave 15:** 04-18 (typed analyst hydration and authoritative readiness)
- **Wave 16:** 04-19 (bounded owner search and unique actor-aware descendant GET routes)
- **Wave 17:** 04-20 (server-backed accessible owner combobox), 04-22 (Risk statement and calendar-date validation)
- **Wave 18:** 04-21 (owner-picker page integration and integrity gate)
- **Wave 19:** 04-23 (no-op edit saves, full E2E gate, and human responsive keyboard verification)

**Success Criteria:**

1. Analysts can review authorised submitted requests and observe or trigger a non-blocking, reviewable AI draft-job lifecycle.
2. Analysts can edit assessment context; every frozen non-server-owned Risk field; and exactly the frozen ControlImplementation fields using CSRM terminology, while identifiers, parent relations, workflow/release/audit facts, and generated/reviewed/approved identities remain server-owned.
3. AI output cannot automatically release an assessment; release is an explicit analyst-only action after review.
4. After release, an authorised Requestor sees a purpose-built read-only assessment and cannot mutate it.

### Phase 5: Risk Register and Mitigation Management

**Status:** Complete (2026-09-01)
**Goal:** As a Security Analyst, I want to search, filter, sort, and maintain contextual Risks and their mitigation-control implementations in an organisation-level register, so that I can track and manage risk exposure across all assessments.
**Mode:** mvp
**UI hint:** yes
**Requirements:** RISK-01, RISK-02
**Plans:** 12/12 plans executed

**Success Criteria:**

1. The Risk Register supports responsive search, filtering, sorting, and pagination across the required risk, rating, ownership, date, relationship, and mitigation fields.
2. Risk Details distinguish a contextual Risk from a reusable Risk Type and expose full context and mitigation-control implementation management.
3. Records created or edited in an assessment are discoverable in the register subject to server-side authorization.

### Phase 6: Administration and CSV Imports

**Status:** Complete (2026-09-02)
**Goal:** As a Security Analyst, I want to manage reusable Risk Types, Controls, Information Systems, and Information Assets and safely import them from CSV with validation and preview, so that assessments reuse accurate organisational reference data.
**Mode:** mvp
**UI hint:** yes
**Requirements:** ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Plans:** 11/11 plans complete

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Establish the shared failing Bob/Jane acceptance and Phase 6 integrity prerequisite.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md — Mount the exact analyst-only `/v1` authorization boundary and remove generic/delete bypasses.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-03-PLAN.md — Publish exact grants, generated five-state DTOs, and the resolved INT-01 limitation.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 06-04-PLAN.md — Build the Risk Type server and typed-web half of the first CRUD vertical slice.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 06-05-PLAN.md — Immediately complete operable Risk Type list/create/detail/edit UI and navigation.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 06-06-PLAN.md — Add Controls as a complete authoritative UI-to-persistence CRUD outcome.

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 06-07-PLAN.md — Add Information Systems and Assets as complete CRUD outcomes.

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 06-08-PLAN.md — Build bounded authoritative/advisory five-state CSV parsing for the import slice.

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 06-09-PLAN.md — Immediately complete an operable Risk Type five-step preview/commit import outcome.

**Wave 10** *(blocked on Wave 9 completion)*

- [x] 06-10-PLAN.md — Extend imports to all collections and close GREEN Bob/Jane acceptance and integrity.

**Wave 11** *(blocked on Wave 10 completion)*

- [x] 06-11-PLAN.md — Close preview provenance/drift, Control cap, and multipart-bound verification gaps.

**Success Criteria:**

1. Analysts can manage CsrmRiskType, CsrmControl, CsrmInformationSystem, and CsrmInformationAsset collections through consistent responsive list and detail patterns.
2. The UI preserves distinctions among Risk Types, Risks, Controls, and Control Implementations.
3. Each supported CSV import offers columns/template guidance, file/header/required-value checks, preview, row-level errors, duplicate visibility, confirmation, and results.
4. Import operations use the typed CSRM service boundary and Strapi keeps authorization and final validation authoritative.

### Phase 06.1: Requestor and Analyst Revert-to-Draft for Requests and Questionnaires (INSERTED)

**Status:** Complete (2026-09-03)
**Goal:** As a Requestor or Security Analyst, I want to return a submitted Risk Assessment Request or a submitted Questionnaire to draft with a recorded reason, so that mistakes and missing information can be corrected and resubmitted without abandoning the record or losing the audit trail.
**Mode:** mvp
**UI hint:** yes
**Requirements:** REQ-06, QUES-06
**Depends on:** Phase 6
**Plans:** 4/4 plans complete

Plans:

- [x] 06.1-01-PLAN.md — Request reversal tracer, audit fields, authorization, and published contract.
- [x] 06.1-02-PLAN.md — Questionnaire envelope reversal, audit persistence, and contract parity.
- [x] 06.1-03-PLAN.md — Typed services, Server Actions, and the Requestor and analyst detail surfaces.
- [x] 06.1-04-PLAN.md — Dual-actor browser journeys and accessibility coverage.

**Scope decisions (operator-confirmed 2026-09-03):**

- A Request may be reverted only from `submitted` — before any questionnaire work exists. Reverting clears `submittedDate` and returns `requestStatus` to `draft`.
- A Questionnaire may be reverted only while the parent request is `questionnaire-in-progress` and no assessment draft exists. Reverting flips every submitted answer envelope back to `state: "draft"`; answer values are preserved.
- Both actors (owning Requestor, authorised Security Analyst) may revert; Strapi remains authoritative for record-level authorization.
- A short reason is mandatory and persisted, along with the reverting identity and timestamp, on `CsrmAssessmentRequest` and `CsrmQuestionnaire`. The data-model additions must be justified in a `docs/contract-gaps/` record before the schema changes, per the project brief.

**Success Criteria:**

1. An owning Requestor and an authorised Security Analyst can revert a `submitted` Request to `draft` through an irreversible-action confirmation that captures a mandatory reason, and Strapi rejects the transition from every other status and from unauthorised actors.
2. An owning Requestor and an authorised Security Analyst can revert a submitted Questionnaire to draft while its request is `questionnaire-in-progress` and no assessment exists; answers become editable again with their values intact, and the transition is refused once an assessment draft exists.
3. Reverted records are editable and resubmittable through the existing Phase 2 and Phase 3 flows, and resubmission restores the same workflow state as a first submission.
4. Who reverted, when, and why is persisted and visible on the Request and Questionnaire detail screens for both actors, with the data-model change documented as a contract gap and reflected in the OpenAPI contract and Role/Function/FunctionAPI catalogue.

### Phase 06.2: AI-Generated Contextualised Questionnaire (INSERTED)

**Status:** Complete (2026-09-04) — one browser journey leg outstanding, recorded in 06.2-VERIFICATION.md
**Goal:** As a Security Analyst reviewing a newly submitted Risk Assessment Request, I want to trigger a reviewable AI job that generates a questionnaire contextualised to that request, so that the Requestor receives relevant questions without an analyst hand-authoring them.
**Mode:** mvp
**UI hint:** yes
**Requirements:** QUES-07
**Depends on:** Phase 06.1
**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 06.2-01-PLAN.md — Generation contract, grants, job registry, provider boundary, and durable provenance.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06.2-02-PLAN.md — Transactional persistence and the safe regeneration rule.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06.2-03-PLAN.md — Typed web boundary and the analyst generation job island.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 06.2-04-PLAN.md — Browser, accessibility, and contract parity evidence.

**Scope decisions (operator-confirmed 2026-09-03):**

- Mirrors the Phase 4 assessment-draft pattern exactly: a `POST` generate operation, a job registry with `queued` / `running` / `completed` / `failed` / retry states, a provider-independent interface, and a polled analyst UI.
- The phase ships a working deterministic questionnaire provider that derives real questions from request context, matching `deterministic-assessment-draft-provider`. The real model arrives in Phase 06.3 behind the same interface.
- Generation is offered while the request is `submitted`. Regeneration replaces a questionnaire that has no answers, and is refused once the Requestor has answered anything — mirroring how `generate_assessment` refuses when a draft already exists.
- Generated questionnaires are ordinary drafts: the AI never submits a questionnaire, never generates an assessment, and never releases anything.

**Success Criteria:**

1. From the analyst view of a submitted Request, a Generate Questionnaire action starts a non-blocking job whose queued, running, completed, failed, and retry states are visible without an indefinite spinner.
2. A completed job persists a `CsrmQuestionnaire` with ordered, data-defined `CsrmQuestion` records contextualised to the request, rendered by the existing Phase 3 renderer with no parallel implementation.
3. Generation is refused with a clear, safe message when the request is not `submitted` or when an existing questionnaire already has answers; regeneration of an unanswered questionnaire replaces it under explicit confirmation.
4. Generation runs behind a provider-independent boundary with recorded provenance and provider version, uses the typed CSRM service boundary, and leaves Strapi authoritative for authorization and validation.

### Phase 06.3: Correctness, Search, and Selection (INSERTED)

**Goal:** As a signed-in CSRM user, I want to see my records, open entitled released assessments, and search lists and pickers within my authorised scope, so that I can work accurately as data volumes grow.
**Mode:** mvp
**UI hint:** yes
**Requirements:** UX-01, UX-02, UX-03
**Depends on:** Phase 06.2
**Plans:** 11/11 plans complete

Plans:

- [x] 06.3-01-PLAN.md
- [x] 06.3-02-PLAN.md
- [x] 06.3-03-PLAN.md
- [x] 06.3-04-PLAN.md
- [x] 06.3-05-PLAN.md
- [x] 06.3-06-PLAN.md
- [x] 06.3-07-PLAN.md
- [x] 06.3-08-PLAN.md
- [x] 06.3-09-PLAN.md
- [x] 06.3-10-PLAN.md
- [x] 06.3-11-PLAN.md

- [x] 06.3-01 Owner scoping for every My route
- [x] 06.3-02 Bounded, searchable assessment and request collection queries
- [x] 06.3-03 Search and filter controls across the collection screens
- [x] 06.3-04 Bounded relation selector mechanics
- [x] 06.3-05 Contract integrity and the released assessment correction
- [x] 06.3-06 Requestor inventory selector APIs

**Scope decisions (operator-confirmed 2026-09-07):**

- Requestor is a birthright role, so the "My Requests", "My Questionnaires", and "My Risk Assessments" screens are owner-scoped for **every** actor, including a Security Analyst. An analyst submitting a request must see that request, its questionnaire, and its released assessment in those three screens exactly as a Requestor does. The analyst's organisation-wide view stays in the separate review queues; the two must not be conflated.
- Selection of Information Systems and Information Assets on a Risk Assessment Request becomes a searchable multi-select rather than a checkbox list, because both inventories are expected to grow well past what a form can render. It follows the server-backed bounded combobox already used for the Risk owner picker rather than introducing a second pattern.
- The Risk owner field on the analyst Risk editor becomes a lookup over IdamBox users, reusing the existing bounded active-user search rather than free text.
- Search and status filtering are added to "My Questionnaires", "My Risk Assessments", and all three analyst review screens, following the established Requestor "My Requests" pattern: server-backed, paginated, with the filter set matching each record's own status vocabulary.
- Filtering and search stay server-side. Strapi remains authoritative for scope; a client-side filter over a partial page would misrepresent totals and leak nothing useful.

**Known defect to fix in this phase:**

Opening a released assessment can fail with "We couldn't load this risk assessment". `releasedAssessmentDetailSchema` fails closed when the assessment is not `approved` or when any of `assessmentDate`, `approvalDate`, or `approvedBy` is null, and every one of those outcomes renders as the same generic message. A validation failure is therefore indistinguishable from a service outage, which is why this class of defect has been expensive to diagnose. The phase must reproduce the failure against a released assessment owned by the signed-in Requestor, fix the cause, and make a contract mismatch distinguishable from an unavailable service in development.

**Success Criteria:**

1. A Security Analyst who submits a request sees that request, its questionnaire, and its released assessment in the three "my" screens, and sees no record belonging to another Requestor in them; Strapi enforces the owner scope and a test proves the denial.
2. Information Systems and Information Assets are chosen through a searchable, keyboard-accessible, server-backed selector that supports zero, one, or many selections and retains chosen records that fall outside the current result page.
3. The analyst Risk editor assigns a Risk owner by searching IdamBox users, and persists the selected identity rather than typed text.
4. "My Questionnaires", "My Risk Assessments", and the three analyst review screens each offer search and status filtering consistent with "My Requests", including result counts, empty-filter recovery, and preserved paging.
5. A released assessment authorised to the signed-in Requestor opens and renders; the previously reported failure is reproduced, fixed, and covered by a regression test, and a contract mismatch no longer presents as a service outage.

### Phase 06.4: Cross-Record Navigation and Interface Consistency (INSERTED)

**Goal:** As either actor, I want to move between a request, its questionnaire, and its assessment without going back to a list, and to meet the same control behaving the same way on every screen, so that the workflow reads as one product rather than a set of separate pages.
**Mode:** mvp
**UI hint:** yes
**Requirements:** UX-04, UX-05
**Depends on:** Phase 06.3
**Plans:** 11 plans

Plans:

- [x] 06.4-01 Release readiness projection
- [x] 06.4-02 Relationship availability and contextual-Risk tally
- [x] 06.4-03 Published contract and typed client boundary
- [x] 06.4-04 Request-to-questionnaire and request-to-assessment navigation
- [x] 06.4-05 Questionnaire-to-request backlinks
- [x] 06.4-06 Complete release-requirement set
- [x] 06.4-07 Identifier-only record opening
- [x] 06.4-08 One reversal control and a full-width reason field
- [x] 06.4-09 Request relationship browser proof
- [x] 06.4-10 Questionnaire navigation browser proof
- [x] 06.4-11 Reversal browser proof

**Scope decisions (operator-confirmed 2026-09-07):**

- A record's identifier or title is the single way to open it. Row-level "Open" buttons are removed from every list, and the link is styled so that it is unmistakably interactive, with the whole row responding to hover and the link remaining the keyboard target. This resolves the inconsistency where some lists opened from a button and others from the title.
- The assessment tile on a request shows the count of contextual Risks at each rating — Low, Moderate, High, Critical — and opens the assessment. Counts carry the same non-colour-only treatment as every other risk signal.
- Release readiness names the specific record and field for each outstanding requirement, so that a missing Risk owner identifies which Risk it belongs to, and presents the complete requirement set rather than only what is currently absent.
- Navigation is capability-checked and record-scoped: a link to a related record appears only where the signed-in actor is authorised to open it, and Strapi still enforces that on the way in.

**Success Criteria:**

1. A Risk Assessment Request shows a link to its questionnaire when one exists, and an assessment tile reporting Low, Moderate, High, and Critical contextual Risk counts that opens the assessment; neither appears when the related record is absent or unauthorised.
2. A Questionnaire links back to its Risk Assessment Request.
3. Release readiness identifies the specific record and field behind every outstanding requirement and shows the full requirement set, so an analyst can see what release demands before starting.
4. Every list opens a record from its identifier or title, no list carries a redundant open control, and the interactive affordance is evident without hover.
5. The reversal confirmation gives its reason field the full dialog width, and the "Return to draft" control uses the standard primary treatment and sits in the same position on the Questionnaire and the Request detail screens.

### Phase 06.5: Design System Conformance (INSERTED)

**Goal:** As a maintainer, I want one document to describe the design system and the planning specs to agree with it, so that future work and future audits measure the product against the contract it was actually built to instead of a superseded one.
**Mode:** mvp
**UI hint:** yes
**Requirements:** — (remediation of delivery quality; no new requirement mapping)
**Status:** Complete (2026-09-10)
**Depends on:** Phase 06.4
**Plans:** 6/6 plans executed

Plans:

- [x] 06.5-04-PLAN.md
- [x] 06.5-05-PLAN.md
- [x] 06.5-06-PLAN.md

**Wave 1**

- [x] 06.5-01-PLAN.md — documentation authority, measured type fixes, light UA scheme
- [x] 06.5-02-PLAN.md — shared sortable-header repair and ad hoc header tokens

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06.5-03-PLAN.md — document-driven browser conformance coverage

**Origin:** `.planning/APP-UI-REVIEW.md`, including its §0 correction. The review scored Typography 2.1/4 across all ten phase audits, but did so against `01-UI-SPEC.md`. Re-measured against `docs/design/csrm-design-direction.md`, the real design system, per-route conformance is 88-99%. The review's headline finding is retracted; the phase is rescoped accordingly.

**Scope decisions (operator-confirmed 2026-09-10, revised):**

- **`docs/design/csrm-design-direction.md` is the single source of truth** for colour, type, spacing, radii, motion, and component guidance. It is 360 lines, carries computed contrast ratios, and is named in the `globals.css` header comment. `01-UI-SPEC.md` and `06-UI-SPEC.md` are amended to reference it rather than restate competing values. Three documents describing the type system is the actual defect this phase exists to close.
- **Superseded 2026-09-24 by [ADR 0001](../docs/adr/0001-adopt-bproton-design-system.md):** the BProton design system is now adopted (warm paper neutrals, Plus Jakarta Sans / Instrument Serif / IBM Plex Mono, ink as the only interactive colour). The original decision is kept below for history. **The cool neutral scale, Inter, and the existing accent all stand.** A revision of this entry earlier today proposed warm neutrals, a serif display face, and a mono family. All three had already been considered and rejected in the design document with product-specific reasoning, chiefly that risk severity is carried by warm hues and loses distinctness on a warm canvas. That direction is withdrawn.
- **Uppercase micro-labels are kept.** The earlier sentence-case decision is reversed for the same reason: it was taken without the design document in view, which takes the uppercase micro-label deliberately (§2) and specifies it at 11px/500/+0.05em (§3.10) for table headers, KPI captions, eyebrows, and sidebar section labels. Navigation items and form field labels stay sentence case, which is already how they render.
- **The sidebar target finding is withdrawn.** 36px nav rows are specified by the design document; `01-UI-SPEC.md:109`'s 44px is the stale value. 36px passes WCAG 2.2 2.5.8, which requires 24x24px.
- **`DataTable`'s uppercase headers are a real bug, and the fix is to make them render.** The treatment is specified but renders sentence case. The cause must be identified rather than worked around; the leading hypothesis is that sortable headers wrap their label in a `<button>` and the Tailwind preflight `button { text-transform: none }` reset cancels the inherited transform, which would mean other inherited styles are silently dropped on those headers too.
- Remaining type drift is small and specific: `12/600` and `11/400` once each on every route (shell-level), `14/600` x4 on the dashboard, and `12/700` x4 in `assessment-list.tsx`'s ad hoc table. That ad hoc table is also the one surface still rendering its own headers rather than going through `DataTable`.

**Success Criteria:**

1. `01-UI-SPEC.md` and `06-UI-SPEC.md` no longer restate type, colour, spacing, or radius values; each defers to `docs/design/csrm-design-direction.md`, and no two documents disagree on any token.
2. Every rendered text element on every route resolves to a pair the design document defines, verified by an automated check that reads its token set rather than a hard-coded list; the six known off-contract elements are corrected.
3. `DataTable` headers render uppercase as specified, the cause of the cancellation is recorded, and the same cause is checked for other silently dropped inherited styles.
4. Neither ad hoc table in `assessment-list.tsx` declares its own header type classes; both render at the shared micro treatment, removing the `12/700` weight. The migration onto `DataTable` is deferred to 06.6, where the list-layout rewrite happens anyway.
5. `color-scheme: light` is declared explicitly, so UA-painted chrome stops following the OS while the light-first app does not.
6. The five-state screen contract still holds on every route at 375px and 1440px, unit and E2E suites are green, and axe reports no violations.

### Phase 06.6: Cross-Surface UI Consistency (INSERTED)

**Goal:** As either actor, I want the same kind of thing to look and behave the same way on every screen it appears on, so that what I learn on one list transfers to the next instead of each surface teaching me a new convention.
**Mode:** mvp
**UI hint:** yes
**Requirements:** — (remediation of UX-04/UX-05 delivery quality; mapping stays with Phase 06.4)
**Depends on:** Phase 06.5
**Plans:** 8 plans

Plans:

- [x] 06.6-01-PLAN.md — RecordLink, heading and display token utilities, design direction updates (wave 1)
- [x] 06.6-02-PLAN.md — DataTable optional capabilities and sticky first column, parameterised state primitives, static state guard (wave 2)
- [x] 06.6-03-PLAN.md — My Requests and My Questionnaires migration; anchor pagination retired (wave 3)
- [x] 06.6-04-PLAN.md — Analyst request and assessment lists and released assessments onto DataTable (wave 3)
- [x] 06.6-05-PLAN.md — Questionnaire review, Administration, and Risk Register sticky identifier (wave 4)
- [x] 06.6-06-PLAN.md — Dashboard and related-record links; dashboard states (wave 5)
- [x] 06.6-08-PLAN.md — Product-wide heading token adoption (wave 6)
- [x] 06.6-07-PLAN.md — Comparative design-contract harness with sensitivity proof (wave 7)

**Origin:** `.planning/APP-UI-REVIEW.md` §3.1, §3.2, §3.3, §3.6, §3.7.

**Scope decisions (operator-confirmed 2026-09-10):**

- **Verification must be comparative, not per-surface.** Phase 06.4 was already an interface-consistency phase and its `VERIFICATION.md` reported all criteria met via browser checks. It passed because each surface was checked alone, and each one renders correctly alone — the defects exist only when two surfaces are compared. Every success criterion below is therefore written as an assertion across surfaces, and a phase that verifies them one screen at a time has not met them.
- Record links standardise on the accent token with an affordance visible **at rest**. Today five of seven list surfaces carry `hover:underline` only, so nothing marks them as interactive until hover — which never arrives on touch. `/app/risks` is the worst case: a record link renders at weight 400, identical to its siblings.
- One layout per record type at a given breakpoint. The same assessment (`ASM-2026-33SAEN`) currently renders as a narrow card on `/app/assessments` and a full-width table row on `/app/review/assessments`.
- Feature components adopt the shared state primitives. `EmptyState`, `ErrorState`, `PermissionDeniedState` and `LoadingState` exist and are imported by 17 route files but by zero files under `src/features/`, which is the mechanism behind the empty- and error-copy drift that Phases 02, 03, and 06.3 each reported separately.
- The Risk Register's horizontal scroll stays — `01-UI-SPEC.md:58` permits a deliberate, labelled table scroll container. What changes is that the identifier column stops scrolling away with it. Confirm the container also satisfies the spec's "labelled" requirement, which this review did not verify.
- **`assessment-list.tsx` migrates onto `DataTable` here**, carried over from 06.5. It holds three list renderings, two of them raw `<table>`s; `DataTable` needs nine props including pagination and density state these lists wire differently; and two structural assertions in `assessment-review-workflow.test.tsx` bind to the current testids and responsive classes. Since this phase rewrites list layout regardless, doing the migration in 06.5 would have meant doing it twice.
- **Heading letter-spacing is not implemented.** Surfaced by the 06.5 conformance check once it began comparing tracking rather than only size and weight. `csrm-design-direction.md` §3.10 specifies negative tracking on the heading and display tokens (-0.01em on `--text-heading-sm`, -0.015em on `--text-heading-md`, -0.02em on `--text-heading-lg` and `--text-display`); the application renders `letter-spacing: normal` on all of them. It is a pre-existing divergence across every heading in the product, not a 06.5 regression, so 06.5 scoped its tracking assertion to the uppercase micro token and deferred this. Implement the heading tracking here and widen the assertion to cover every token that specifies it.
- **Empty, error and permission state headings are off-contract.** They use `text-lg` (18px), which the design direction does not define, across `request-table.tsx`, `assessment-list.tsx`, `questionnaire-review-list.tsx` and the administration states. The 06.5 conformance sweep does not catch them because it audits each route in its default state, not its fixture states. Correct the headings and extend the sweep to assert typography inside the state matrix as well.
- A committed regression harness is part of the deliverable, not a follow-up. The defects in this phase and 06.5 were all introduced without any check failing.

**Success Criteria:**

1. Record links on every list surface resolve to the same computed colour and text decoration at rest, asserted by comparing the surfaces against each other rather than each against a description.
2. No record type renders as a card on one surface and a table row on another at the same breakpoint.
3. No hand-rolled empty, error, permission, or loading block remains under `src/features/`; all render through the shared primitives, so their copy cannot drift independently.
4. Scrolling the Risk Register horizontally keeps the row identifier visible, and 8-column density remains usable at 1440px.
5. No disabled control is implemented as an anchor; `/app/review/questionnaires` currently ships `<a href="#" aria-disabled="true">` for Previous/Next, which stays activatable.
6. `apps/web/e2e/design-contract.spec.ts` asserts criteria 1–5 plus Phase 06.5's type and casing contract, and fails on regression.

### Phase 06.7: Real AI Provider Integration for Questionnaire and Assessment Generation (INSERTED)

**Goal:** As a CSRM operator, I want the questionnaire and assessment-draft generators backed by a real AI provider instead of deterministic stand-ins, so that analysts receive genuinely contextualised output while human review and release stay mandatory.
**Mode:** mvp
**UI hint:** no
**Requirements:** INT-03
**Depends on:** Phase 06.6
**Status:** Complete (2026-09-15) — live questionnaire generation verified against a local model; live assessment drafting did not complete on the local CPU runtime and failed safely (see 06.7-VERIFICATION.md)
**Plans:** 6/6 plans complete

Plans:
**Wave 1**

- [x] 06.7-01-PLAN.md — Tracer: questionnaire generation end-to-end through a real OpenAI-compatible endpoint, with the provider switch, shared client, config surface and durable provenance

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06.7-02-PLAN.md — Assessment-draft generation through the same seam, with request-level closed-vocabulary constraint and CsrmAssessment provenance
- [x] 06.7-03-PLAN.md — Fail-fast boot validation, forced test hermeticity, and operator configuration documentation

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06.7-04-PLAN.md — Complete the four-code provider failure taxonomy across both operations with generic analyst-facing messages
- [x] 06.7-05-PLAN.md — Contract-gap record, durable provenance proven on real records, forged-provenance rejection, and failure codes end to end

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 06.7-06-PLAN.md — Prompt-injection containment, whole-context transmission, and idempotency/concurrency/no-auto-release regression

**Scope decisions (operator-confirmed 2026-09-03):**

- Scope is limited to the two operations already implemented: assessment-draft generation (Phase 4) and questionnaire generation (Phase 06.2). The remaining conceptual AI operations in the brief stay out of scope for this milestone.
- The real provider is substituted behind the existing `AssessmentDraftProvider` and Phase 06.2 questionnaire-provider interfaces; no UI or job-lifecycle rework.
- The deterministic providers are retained as the test and offline implementation so automated journeys stay hermetic.
- Advances INT-03; INT-01, INT-02, and INT-04 remain with Phase 8.

**Success Criteria:**

1. Both generation operations call a real AI provider through the existing provider interfaces, selected by configuration, with no secrets in client code and deterministic providers still selectable for tests and offline runs.
2. Provider output is validated against the existing schema parsers before persistence; malformed or unsafe output fails the job safely with a retryable, non-leaking error rather than corrupting records.
3. Provenance — provider name, version, timestamp, and initiating analyst — is persisted for every generated questionnaire and assessment draft, and analyst edits to generated content are preserved.
4. AI output is never released automatically: assessment release remains an explicit analyst-only action, and generated questionnaires remain drafts until the Requestor submits them.

### Phase 06.8: Workflow Visibility and Questionnaire Governance (INSERTED)

**Goal:** As a Requestor or Security Analyst, I want the Assessment Request to be a shared, actor-aware operational hub that shows exactly where the work stands and what is required next, and I want questionnaire generation, editing, release, and revision to stay under explicit Analyst control with an auditable history, so that both actors can act on the same record without guessing at lifecycle state or losing evidence.
**Mode:** mvp
**UI hint:** yes
**Requirements:** None mapped — see Coverage
**Depends on:** Phase 06.7
**Plans:** 10/10 plans complete

Plans:
**Wave 1**

- [x] 06.8-01-PLAN.md — Questionnaire release facts, the server-side release gate, and the published Phase 06.8 operation surface.
- [x] 06.8-02-PLAN.md — Assessment review regression: an edit to a reviewed, release-ready assessment stores draft.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06.8-03-PLAN.md — The single explicit Analyst-only return-to-analyst-review transition with its mandatory reason.
- [x] 06.8-07-PLAN.md — Derived eight-step request lifecycle and the shared read-only stepper on both request detail routes.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06.8-04-PLAN.md — Analyst question add, edit and soft delete, with the answer-revalidation and exclusion rules.
- [x] 06.8-08-PLAN.md — The request hub: operational summary, next required action, and six permission-scoped related-record summaries.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 06.8-05-PLAN.md — Analyst governance interface: release, return to review, and the question editor.
- [x] 06.8-09-PLAN.md — Analyst review queue buckets and Requestor dashboard lifecycle-state cards.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 06.8-06-PLAN.md — The dated questionnaire revision timeline at analyst and Requestor depth.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 06.8-10-PLAN.md — Dual-actor browser governance journey, accessibility at both widths, and the full-suite phase gate.

**Known contract gap (identified during planning):** the authoritative JDL, OpenAPI
contract, and capability catalogue carry no durable audit/revision representation for
questionnaire governance. The backward-transition audit record and the questionnaire
revision timeline therefore require an approved contract/model reconciliation recorded
under `docs/contract-gaps/` before implementation, rather than a competing audit entity
invented in the frontend or a second source of truth in the web app.

**Success Criteria:**

1. Both actors see read-only request and assessment lifecycle visibility that names the current state in text and distinguishes completed, current, and future steps without relying on colour alone; the stepper explains state and does not become a second workflow-control surface.
2. A backward transition moves only to the immediately preceding editable state, is available only to an authorised Security Analyst, requires a mandatory reason, and persists a visible audit record; later records are never silently deleted, and editing a reviewed but unreleased assessment returns it to drafted and requires a fresh review before release.
3. A generated questionnaire is analyst-only until an explicit Analyst release: Analysts can view, edit, add, and delete questions, an Analyst edit to a submitted questionnaire returns it to analyst review, and after re-release the Requestor must complete newly required questions and explicitly re-submit while unchanged valid answers remain.
4. Questionnaire revision integrity holds: a deleted question and its submitted answer stay in audit history but are excluded from the active questionnaire and from later assessment input, an answer is preserved only when it still validates against the revised question definition, and cleared answers carry a plain-language explanation on re-release.
5. Both actors see a dated questionnaire-revision timeline at the right depth — detailed question and answer changes for Analysts, a plain-language summary of what requires review for Requestors.
6. The request detail hub shows a compact operational summary and the next required action, then concise permission-scoped summaries for the questionnaire, assessment, risks, controls, information systems, and information assets, each linking to its existing authoritative detail screen rather than embedding a duplicate editor.
7. The Requestor dashboard adds lifecycle-state cards for "My assessment requests" whose counts link to the owner-scoped My Requests list filtered to that state, and `/app/review/requests` defaults to "Requires my attention" with explicit "Awaiting Requestor", "Generation in progress", and "Released" filters so released work stays visible without diluting the action queue.
8. Every new surface renders real Strapi data through the typed service boundary with Strapi authoritative for authorization, honours the five-state screen contract, passes accessibility checks at mobile and desktop widths, and is covered by unit and end-to-end tests for both actors.

### Phase 06.9: Assessment Navigation and Lifecycle Visibility (INSERTED)

**Goal:** As a Requestor or Security Analyst, I want assessment lists to expose the complete lifecycle vocabulary and assessment details to show their lifecycle state and link back to the originating Assessment Request, so that I can navigate the workflow without losing context or inferring status from incomplete controls.
**Mode:** mvp
**UI hint:** yes
**Requirements:** None mapped — completes assessment-level navigation and lifecycle visibility within already-mapped workflow slices.
**Depends on:** Phase 06.8
**Status:** Complete (2026-09-23)
**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 06.9-01-PLAN.md — Bounded originating-request summary across the Strapi projection, OpenAPI contract, generated client and closed parser.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06.9-02-PLAN.md — Shared read-only assessment lifecycle stepper with two callers, actor-derived request link, and the complete labelled filter vocabularies.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06.9-03-PLAN.md — Dedicated two-Requestor fixture, dual-actor browser journey, direct-URL denial proof, and responsive accessibility coverage.

**Success Criteria:**

1. `/app/review/requests` offers all seven request statuses with human-readable labels independently of its queue filter, while the Analyst assessment list offers all four assessment statuses with human-readable labels; both native selects use the shared accessible select treatment.
2. The authorised assessment-detail projection supplies a bounded originating-request summary through the documented Strapi OpenAPI contract and regenerated typed web client, with no content-type schema change and Strapi retaining record-level authorisation.
3. Both the Analyst assessment editor and Requestor released assessment view show the same read-only assessment lifecycle stepper at the top, name the current state in text, distinguish completed/current/future states without colour alone, and provide an actor-aware RecordLink to the originating request.
4. The touched list and detail surfaces retain loading, empty, populated, error, and permission-denied states; responsive WCAG 2.2 AA behaviour is verified at 375px and 1440px.
5. Unit and end-to-end coverage proves the complete filter vocabulary, server/client request-summary contract, actor-specific request destinations, lifecycle visibility, and record-level denial for both Requestors and Analysts.

### Phase 06.10: Local LLM Evaluation and Optimisation (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 06.9
**Plans:** 0 plans

Plans:

- [ ] TBD (run $gsd-plan-phase 06.10 to break down)

### Phase 7: Analyst Dashboard, Reports, and Alerts

**Goal:** As a Security Analyst, I want a data-driven dashboard, reports, and alerts covering my review queues, high and critical risks, and overdue treatments, so that I can prioritise analyst work from live workload signals.
**Mode:** mvp
**UI hint:** yes
**Requirements:** DASH-01, DASH-02

**Success Criteria:**

1. Analysts see data-driven review queues, high/critical risks, overdue treatments, due dates, recent activity, and alerts.
2. Reports and alerts are accessible through capability-controlled, responsive screens with useful empty and error states.
3. Dashboard widgets reuse established metrics, status, layout, and service patterns rather than hard-coded values.

### Phase 8: Production Integration and Hardening

**Goal:** As a CSRM operator, I want production authentication, verified server-side authorization, hardened security, accessibility, and broad end-to-end coverage, so that the critical risk-assessment workflow is trustworthy in production.
**Mode:** mvp
**UI hint:** yes
**Requirements:** INT-01, INT-02, INT-03, INT-04

**Success Criteria:**

1. Frontend production services call the documented Strapi OpenAPI operations; missing operations, including imports, are implemented and recorded in the contract/catalogue.
2. Keycloak authorization-code authentication and Strapi token/capability/record enforcement are verified, including Requestor birthright behaviour and IDOR denial.
3. The AI provider adapter preserves provenance, status, retries, human edits, and mandatory analyst release control.
4. Automated critical journeys cover desktop and mobile request, questionnaire, assessment-release, read-only viewing, Risk Register, and CSV import flows.
5. WCAG 2.2 AA, security headers/input/output/error handling, performance, and dependency hygiene receive documented validation.

## Dependency Order

Phase 1 is required before all other phases. Phases 2 → 4 establish the core workflow; Phase 5 depends on assessment risks; Phase 6 can proceed after Phase 1 but should follow the core workflow. The inserted phases run in order after Phase 6: 06.1 corrects the submitted-record workflow gap; 06.2 depends on 06.1 and on the Phase 4 draft-job pattern it mirrors; 06.3 corrects owner scoping and a broken released-assessment read and makes every list and picker searchable; 06.4 depends on 06.3 because the navigation it adds is reached from the screens 06.3 repairs, and its open-affordance pass touches the same lists; 06.5 depends on 06.4 because it reconciles the design system that 06.3 and 06.4 exposed as drifting, and it must land before any further UI is built; 06.6 depends on 06.5 because the cross-surface treatments it standardises are expressed in the tokens 06.5 corrects; and 06.7 depends on 06.6 because it substitutes a real provider behind both generation interfaces once the surrounding experience is settled. Phase 06.8 depends on 06.7 for the lifecycle and governance facts it surfaces; Phase 06.9 depends on 06.8 so its assessment navigation and lifecycle visual reuse the shared state model; Phase 06.10 follows 06.9 for the local LLM evaluation work. Phase 7 depends on established data/query patterns, and follows 06.6 deliberately: it introduces a dashboard, reports, and alerts, and building those surfaces before the design system is reconciled would reproduce the same drift a third time. Phase 8 hardens all completed slices and retains INT-01, INT-02, and INT-04.

## Coverage

All 40 v1 requirements are mapped exactly once. REQ-06 and QUES-06 (revert to draft) map to Phase 06.1; QUES-07 (generated contextualised questionnaire) maps to Phase 06.2; UX-01 through UX-03 map to Phase 06.3 and UX-04 and UX-05 to Phase 06.4. INT-03 is advanced by Phase 06.7 and verified in Phase 8. Phases 06.5 and 06.6 carry no requirement mapping: they remediate the delivery quality of requirements already mapped to earlier phases, so the map stays exactly-once. Their acceptance evidence is the audited criteria in their own entries rather than a requirement identifier. Phase 06.8 carries no requirement mapping on the same basis: it deepens the request, questionnaire, and assessment slices already mapped to Phases 2, 3, 4, 06.1, and 06.2 with lifecycle visibility and Analyst questionnaire governance, so the map stays exactly-once and its audited criteria are its acceptance evidence. Phase 06.9 carries no separate requirement mapping because it completes assessment-level navigation and lifecycle visibility within the already-mapped workflow slices; Phase 06.10 retains its own planning scope.

### Phase 9: Human-Supervised Agentic Workflows

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 9 to break down)

---
*Roadmap created: 2026-08-27; last updated: 2026-09-10 — inserted Phases 06.5 (Design System Conformance) and 06.6 (Cross-Surface UI Consistency) from the application-wide UI review in `.planning/APP-UI-REVIEW.md`, settled the all-caps contract conflict as sentence case, and renumbered the AI integration phase from 06.5 to 06.7. Previously updated 2026-09-07 — inserted Phases 06.3 and 06.4 from post-06.2 review findings and renumbered the AI integration phase to 06.5.*
