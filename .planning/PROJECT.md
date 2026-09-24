# IdamBox Cyber Risk Manager (CSRM)

## What This Is

CSRM is a production-quality, agentic-AI-assisted cyber security risk-management application in the BProton / IdamBox product family. It guides Requestors through risk assessment requests and questionnaires while giving Security Analysts controlled review, editing, risk and mitigation management, and final release responsibility.

The repository will be a Turborepo monorepo with the existing Strapi backend at `apps/strapi` and a strict TypeScript Next.js App Router application at `apps/web`.

## Core Value

Make a complex cyber-risk workflow simple and auditable while keeping Security Analysts—not AI—in control of assessment review and release.

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

### Active

- [ ] Deliver the Requestor-to-Security-Analyst assessment workflow: request, questionnaire, assessment, analyst review, release, and Requestor read-only access.
- [ ] Use a typed frontend service layer targeting the Strapi OpenAPI contract and preserve CSRM domain terminology.
- [ ] Enforce effective CSRM capabilities and record-level authorization server-side and reflect them in UI navigation/actions.
- [ ] Provide Risk Register, reusable library/inventory management, and safe CSV import workflows.
- [ ] Build a responsive, accessible BProton/IdamBox-branded design system and reusable application primitives.
- [ ] Establish testing, security, performance, and accessibility practices from the foundation onward.
- [ ] Allow a submitted Request or Questionnaire to be returned to draft, with a recorded reason, so mistakes can be corrected and resubmitted.
- [ ] Let a Security Analyst generate a contextualised questionnaire from a submitted Request through the same reviewable, provider-independent AI job pattern used for assessment drafts.
- [ ] Let a person move between a request, its questionnaire, and its assessment directly, and meet the same control behaving the same way on every screen.

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
| Follow the brief's eight vertical phases | It preserves demonstrable user journeys and avoids a collection of disconnected screens | — Pending |
| Keep AI advisory and reviewable | Analysts must retain responsibility for assessment approval and release | — Pending |
| Revert-to-draft only from the earliest submitted state | Reverting a Request only from `submitted`, and a Questionnaire only before an assessment draft exists, avoids orphaned or stale downstream records | — Pending (Phase 06.1) |
| Persist reverter identity, timestamp, and mandatory reason | This is an auditable cyber-risk product; a silent reversal of a submitted record is not defensible | — Pending (Phase 06.1) |
| Ship deterministic AI providers first, substitute a real provider behind the same interface | Each phase stays demonstrable and hermetically testable; real model integration becomes a swap, not a rewrite | ✓ Validated in Phase 06.2; real provider pending in 06.7 |
| Owner-scoped screens stay owner-scoped for every role | Requestor is a birthright role, so an analyst who raises a request is a Requestor for that record; conflating it with the review queues hides their own work | ✓ Validated in Phase 06.3 |
| Preserve separate owner and analyst-review surfaces | The shared Requestor birthright and explicit analyst review grant have different server-enforced scopes; UI must not conflate them | ✓ Validated in Phase 06.3 |
| A record opens from its identifier or title, never a separate row button | One affordance per action reads as one product and keeps dense tables free of a redundant column | — Pending (Phase 06.4) |
| Exactly one explicit, Analyst-only, mandatory-reason return-to-analyst-review transition governs every questionnaire backward move | An implicit backward transition triggered by an edit could not carry the reason and audit record the workflow requires; one operation with no hidden state changes covers both the released and submitted cases | ✓ Validated in Phase 06.8 |
| A questionnaire's release gate reads dedicated release-fact fields, never a scan of the governance log | Access control must read an explicit validated field rather than derive itself from parsing a mutable JSON array, where a malformed or truncated log failing safe would deny every read; the log carries narrative history, the fields carry the gate | ✓ Validated in Phase 06.8 |
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
*Last updated: 2026-09-21 after completing Phase 06.8*
