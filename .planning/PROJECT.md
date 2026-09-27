# IdamBox Cyber Risk Manager (CSRM)

## What This Is

CSRM is a production-quality, agentic-AI-assisted cyber security risk-management application in the BProton / IdamBox product family. It guides Requestors through risk assessment requests and questionnaires while giving Security Analysts controlled review, editing, risk and mitigation management, and final release responsibility.

The repository will be a Turborepo monorepo with the existing Strapi backend at `apps/strapi` and a strict TypeScript Next.js App Router application at `apps/web`.

## Core Value

Make a complex cyber-risk workflow simple and auditable while keeping Security Analysts—not AI—in control of assessment review and release.

## Current Milestone: v2.0 Assessment Lifecycle and Oversight

**Goal:** Take CSRM from the v1 workflow to the operator's intended product. That product has:
- an Admin role;
- requests with notes and attachments at any point;
- steerable, re-runnable AI with provenance;
- a Requestor mitigation response;
- risk-owner acceptance within an appetite;
- spreadsheet-grade risk editing with import and export;
- living registers, management metrics and a clear information architecture.

It also fixes every defect the product gap UAT found in v1.0 flows.

**Target features:**
- Existing-flow gap closure (Phase 10), navigation and landing clarity with quick find (Phase 11).
- AI context, provenance and suggestions (Phase 12); steerable questionnaire AI (Phase 15); risk curation and targeted re-runs (Phase 16).
- Request pick-up and notes (Phase 13), and attachments (Phase 14).
- Mitigation response and residual reassessment (Phase 17); review, peer approval and risk acceptance (Phase 17.1).
- The risk table with copy and paste both ways (Phase 18), and CSV and XLSX export and import (Phase 19).
- Registers by type with post-release tracking and reminders (Phase 20), management dashboards (Phase 21), and the Admin role with configurable lists (Phase 22).

**Decisions:** `.planning/NEXT-WAVE-DECISIONS.md`

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- [x] Establish a maintainable Turborepo with Strapi and Next.js workspaces. — Validated in Phase 1: Monorepo Foundation and Secure Application Shell.
- [x] Deliver the authorised Requestor assessment-request workflow from creation and draft editing through confirmed submission and tracking. — Validated in Phase 2: Requestor Risk Assessment Request Workflow.
- [x] Deliver the authorised data-defined questionnaire workflow from draft completion through confirmed submission and shared analyst review. — Validated in Phase 3: Dynamic Questionnaire Workflow.
- [x] Keep the owner-scoped screens truthful for every actor, since Requestor is a birthright role that a Security Analyst also holds. — Validated in Phase 06.3: Correctness, Search, and Selection.
- [x] Make every list and every record picker searchable and filterable, because the reference inventories and record volumes will outgrow what a screen can render. — Validated in Phase 06.3: Correctness, Search, and Selection.
- [x] Give both actors a shared, read-only lifecycle stepper and an actor-aware request hub that names the current state and the next required action, so neither actor has to infer where work stands. — Validated in Phase 06.8: Workflow Visibility and Questionnaire Governance.
- [x] Keep questionnaire generation, editing, release, and revision under explicit Security Analyst control with a mandatory-reason, audited backward transition and a dated revision timeline visible to both actors. — Validated in Phase 06.8: Workflow Visibility and Questionnaire Governance.

- [x] Deliver the Requestor-to-Security-Analyst assessment workflow: request, questionnaire, assessment, analyst review, release, and Requestor read-only access. — Validated in v1.0.
- [x] Use a typed frontend service layer targeting the Strapi OpenAPI contract and preserve CSRM domain terminology. — Validated in v1.0.
- [x] Enforce effective CSRM capabilities and record-level authorization server-side and reflect them in UI navigation/actions. — Validated in v1.0.
- [x] Provide Risk Register, reusable library/inventory management, and safe CSV import workflows. — Validated in v1.0.
- [x] Build a responsive, accessible BProton/IdamBox-branded design system and reusable application primitives. — Validated in v1.0.
- [x] Establish testing, security, performance, and accessibility practices from the foundation onward. — Validated in v1.0.
- [x] Allow a submitted Request or Questionnaire to be returned to draft, with a recorded reason, so mistakes can be corrected and resubmitted. — Validated in v1.0.
- [x] Let a Security Analyst generate a contextualised questionnaire from a submitted Request through the same reviewable, provider-independent AI job pattern used for assessment drafts. — Validated in v1.0.
- [x] Let a person move between a request, its questionnaire, and its assessment directly, and meet the same control behaving the same way on every screen. — Validated in v1.0.

### Active

**v2.0 (Phases 10–22 and 17.1; requirements in REQUIREMENTS.md):**

- [ ] Make the existing request, questionnaire, assessment and administration screens work as they say, with no lost input or misleading refusal (Phase 10).
- [ ] Give each actor a sectioned sidebar and a Home that leads with their next action (Phase 11).
- [ ] Let the AI work from the whole request, show where each proposal came from, and mark AI-proposed content until an analyst accepts it (Phase 12).
- [ ] Let analysts pick up and assign requests, and let both actors add notes and files to a request at any point (Phases 13 and 14).
- [ ] Let the analyst steer and re-run the AI on questions and on single or additional risks, keeping answered questions as information (Phases 15 and 16).
- [ ] Release the initial risks to the Requestor for a mitigation response, then have the AI propose the residual risk for analyst review (Phase 17).
- [ ] Require an explicit review, peer approval for Critical outcomes, and the risk owner's acceptance of residual risk before release (Phase 17.1).
- [ ] Offer each assessment's risks as a spreadsheet-like table with copy and paste both ways, and export and import throughout (Phases 18 and 19).
- [ ] Give oversight registers by assessment type that track treatment after release, management metrics, and an Admin role that owns reference data and configuration (Phases 20, 21 and 22).

### Out of Scope

- Automatic release or acceptance of AI-generated assessments — analyst review and release are mandatory.
- Complex multi-tenant administration and tenant theme editing — defer until a validated need exists.
- Real-time Google-Docs-style collaborative editing — normal save, comment, and activity workflows are sufficient initially.
- Native mobile application — deliver a responsive web application first.
- Fully configurable workflow designer, full enterprise GRC suite, custom ML training, and premature microservices — not required for the first useful milestone.

## Context

- The CSRM project brief at `docs/CSRM-PROJECT-BRIEF.md` is the primary product and implementation reference.
- The Strapi OpenAPI contract in `docs/references/specification.json` is authoritative for backend communication. The JDL data model and Role/Function/FunctionAPI catalogue preserve domain terms and traceability.
- Keycloak is the OpenID Connect identity provider; application authorization remains in the IdamBox/Strapi data model. Requestor is an implicit birthright role and elevated roles, including Security Analyst, are explicitly assigned.
- AI operations must use a provider-independent boundary, can be asynchronous, must expose meaningful status, and must never bypass human review.
- The initial milestone should prove the full vertical journey, with deterministic AI implementations permitted while real integration matures.
- On 2026-09-27 the operator set a target product beyond the v1 brief: an Admin role; requests with attachments and notes at any point; analyst-steerable, re-runnable AI for questions and risks; a Requestor response on the initial risks followed by an AI residual-risk write-up; registers for BAU, Project and other assessments; informative dashboards and a sectioned sidebar; CSV import and export throughout; and each assessment's risks as a table that copies and pastes with Excel or SharePoint. The operator's words and the product gap UAT against them are in `.planning/uat/product-gaps/` (`BRIEF.md` Appendix A, `REPORT.md`, `FINDINGS.md`). Phases 10–22 deliver it.

## Constraints

- **Monorepo**: Turborepo with `apps/strapi` and `apps/web` — backend and frontend must remain independently maintainable while sharing orchestration.
- **Frontend stack**: Next.js App Router, React, strict TypeScript, Tailwind CSS, and shadcn/ui — required by the project brief.
- **API contract**: Strapi OpenAPI specification — prevents invented or mock-only production contracts.
- **Identity and authorization**: Keycloak authentication plus server-side IdamBox Role → Function → FunctionAPI authorization — required to protect sensitive risk data and prevent IDOR.
- **Accessibility**: WCAG 2.2 AA — enterprise application quality baseline.
- **Security**: No client secrets, strict validation, safe rendering/error handling, security headers, auditability, and dependency hygiene — this is a cyber-security product.
- **Design**: Semantic BProton/IdamBox theme tokens, not scattered raw values — enables future tenant branding without component rewrites.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use a Turborepo monorepo | Coordinate frontend and Strapi backend while retaining clear workspace boundaries | ✓ Validated in Phase 1 |
| Place Strapi at `apps/strapi` | Turborepo workspaces must live inside the repository; the existing sibling project will be moved in | ✓ Validated in Phase 1 |
| Place the Next.js application at `apps/web` | Provides an obvious, conventional web workspace alongside the backend | ✓ Validated in Phase 1 |
| Follow the brief's eight vertical phases | It preserves demonstrable user journeys and avoids a collection of disconnected screens | ✓ v1.0 shipped (19 phases with the inserted 06.x work) |
| Keep AI advisory and reviewable | Analysts must retain responsibility for assessment approval and release | ✓ Validated in v1.0 (INT-03); extended in v2.0 by provenance and risk-owner acceptance |
| Revert-to-draft only from the earliest submitted state | Reverting a Request only from `submitted`, and a Questionnaire only before an assessment draft exists, avoids orphaned or stale downstream records | ✓ Validated in Phase 06.1 |
| Persist reverter identity, timestamp, and mandatory reason | This is an auditable cyber-risk product; a silent reversal of a submitted record is not defensible | ✓ Validated in Phase 06.1 |
| Ship deterministic AI providers first, substitute a real provider behind the same interface | Each phase stays demonstrable and hermetically testable; real model integration becomes a swap, not a rewrite | ✓ Validated in Phase 06.2; real provider pending in 06.7 |
| Owner-scoped screens stay owner-scoped for every role | Requestor is a birthright role, so an analyst who raises a request is a Requestor for that record; conflating it with the review queues hides their own work | ✓ Validated in Phase 06.3 |
| Preserve separate owner and analyst-review surfaces | The shared Requestor birthright and explicit analyst review grant have different server-enforced scopes; UI must not conflate them | ✓ Validated in Phase 06.3 |
| A record opens from its identifier or title, never a separate row button | One affordance per action reads as one product and keeps dense tables free of a redundant column | ✓ Validated in Phase 06.4 |
| Exactly one explicit, Analyst-only, mandatory-reason return-to-analyst-review transition governs every questionnaire backward move | An implicit backward transition triggered by an edit could not carry the reason and audit record the workflow requires; one operation with no hidden state changes covers both the released and submitted cases | ✓ Validated in Phase 06.8 |
| A questionnaire's release gate reads dedicated release-fact fields, never a scan of the governance log | Access control must read an explicit validated field rather than derive itself from parsing a mutable JSON array, where a malformed or truncated log failing safe would deny every read; the log carries narrative history, the fields carry the gate | ✓ Validated in Phase 06.8 |
| Plan the intended product as milestone v2.0 (Phases 10–22 and 17.1), with the product decisions made under the operator's delegation | The product gap UAT mapped every finding to one phase; v1.0 closed 2026-09-28 as shipped (G-8); `NEXT-WAVE-DECISIONS.md` grounds each decision in cyber-governance practice | — Pending (STATE.md Decisions, 2026-09-27) |
| Durable audit trails without a modeled entity go through `docs/contract-gaps/` before implementation | The authoritative JDL/OpenAPI/catalogue carry no audit-revision representation; documenting the gap and reconciling the contract avoids a competing entity invented only in the frontend or a second source of truth in the web app | ✓ Applied in Phase 06.8 (`docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. “What This Is” still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-28 after closing v1.0 and starting v2.0*
