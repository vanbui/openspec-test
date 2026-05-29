# Phase 05: CSRM Backend Content Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29T09:05:32Z
**Phase:** 05-CSRM Backend Content Model
**Areas discussed:** Collection boundaries and naming, Relationships and ownership, Lifecycle and release semantics, Feature flag behavior

---

## Collection Boundaries And Naming

| Option | Description | Selected |
|--------|-------------|----------|
| Separate collections | Create first-class collections for assessment request, information asset, information system, questionnaire, question, assessment, and risk. This fits Strapi relation management and Phase 6 querying. | ✓ |
| Hybrid model | Make assessment request, questionnaire, assessment, and risk collections, but store assets/systems/questions as components or JSON-like nested fields where practical. | |
| Minimal roadmap model | Only create the three roadmap collections: assessment request, questionnaire, and assessment; defer assets, systems, questions, and risks until Phase 6 needs them. | |
| Other | User-provided structure. | |

**User's choice:** Separate collections.
**Notes:** User's initial model notes listed the full CSRM collection set and representative fields for assets, systems, questions, assessments, and risks.

---

## Relationships And Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Request-centered aggregate | `csrm-assessment-request` links to many information assets/systems, one questionnaire, and one assessment. Questionnaire owns many questions. Assessment owns many risks. | ✓ |
| Assessment-centered risk model | Request still links to assets/systems/questionnaire, but risks belong primarily to the request and optionally relate to an assessment. | |
| Loose relations | All CSRM records can exist independently and link where needed, with fewer required relationships. | |
| Other | User-provided ownership model. | |

**User's choice:** Request-centered aggregate.
**Notes:** This matches the user's provided description: assessment request links to many assets and systems, one questionnaire, one assessment, and the assessment has multiple risks.

---

## Lifecycle And Release Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Use provided status enums as locked workflow states | Request status: `draft`, `submitted`, `questionnaire-in-progress`, `risk-assessment-drafted`, `under-review`, `approved`, `closed`. Assessment status: `draft`, `in-review`, `approved`, `closed`. Phase 5 stores these states; Phase 6 decides UI transitions. | ✓ |
| Keep statuses simpler for now | Request status: `draft`, `submitted`, `in-progress`, `approved`, `closed`. Assessment status: `draft`, `approved`, `closed`. Add detailed states later. | |
| Let planner normalize names | Keep the lifecycle concepts but allow the planner to choose exact enum names and casing based on Strapi conventions. | |
| Other | User-provided lifecycle model. | |

**User's choice:** Use provided status enums as locked workflow states.
**Notes:** Phase 5 should model detailed lifecycle values now, while Phase 6 owns UI transitions and workflow screens.

---

## Feature Flag Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Routes/services guard access | CSRM content types may exist in the Strapi project/schema, but application-facing routes/services should reject or avoid active CSRM behavior unless the flag is enabled. | ✓ |
| Hide from Strapi admin too | Try to prevent CSRM collections from appearing/being usable in Strapi admin when disabled. This is stricter but may fight Strapi's content-type registration model. | |
| Seed/config flag only | Define collections normally and only use the flag later in Phase 6 app/API code. | |
| Other | User-provided disabled behavior. | |

**User's choice:** Routes/services guard access.
**Notes:** The flag is the roadmap's `csrmAppIsEnabled`. The selected behavior is practical for Strapi and satisfies the success criterion that disabled CSRM behavior is not active for application consumers.

## the agent's Discretion

- Choose exact Strapi implementation details, relation direction, route/service guard structure, and verification script details while preserving the locked domain decisions.

## Deferred Ideas

- Next.js CSRM frontend workflows, OIDC login wiring, and requestor/security analyst UI behavior remain Phase 6 work.
