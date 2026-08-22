# Phase 7 Multi-Source Coverage Audit

## Coverage

| Source | Item | Coverage |
|---|---|---|
| GOAL | Vertical Requestor workflow for viewing, creating, saving, editing, and submitting owned requests | 07-01 through 07-04 |
| REQ | CSRM-05 | 07-01 through 07-04 |
| RESEARCH | Direct-Strapi ownership, actor resolution, lifecycle transition matrix, server-owned fields, and IDOR-safe failures | 07-01 |
| RESEARCH | Generated OpenAPI, typed transport/service boundary, MSW parity, and explicit API coverage classification | 07-02 |
| RESEARCH | Persisted draft/submit validation, catalogue-backed relations, safe failures, and accessible workflow UI | 07-03 |
| RESEARCH | Responsive dashboard/list, bounded real-stack browser evidence, fixture exclusion, and dependency provenance | 07-04 |
| CONTEXT | D-01 real Strapi and backend ownership | 07-01, 07-04 |
| CONTEXT | D-02 centralized capabilities plus server ownership | 07-01, 07-03 |
| CONTEXT | D-03 submitted-to-draft withdrawal until later processing | 07-01, 07-03 |
| CONTEXT | D-04 analyst access to unsubmitted drafts | 07-01, 07-03 |
| CONTEXT | D-05 analyst edits retain draft and Requestor submits | 07-01, 07-03 |
| CONTEXT | D-06 one progressive sectioned page | 07-03 |
| CONTEXT | D-07 title-only save; essential persisted fields on submit | 07-01, 07-03 |
| CONTEXT | D-08 optional searchable systems/assets | 07-02, 07-03 |
| CONTEXT | D-09 conditional third-party details | 07-01, 07-03 |
| CONTEXT | D-10 action-first dashboard | 07-04 |
| CONTEXT | D-11 desktop table/mobile cards | 07-04 |
| CONTEXT | D-12 updated-desc default plus keyword/status filters | 07-04 |
| UI-SPEC | Route capability, dashboard, list, form, details, lifecycle actions, state/error/dirty behavior, responsive and accessibility contracts | 07-03, 07-04 |

## Explicit Exclusions

- Questionnaire authoring, evidence, review, and reporting belong to later phases.
- Production OIDC/effective FunctionApi authorization belongs to Phase 13; Phase 7 preserves its seam and proves internal-token plus fixture-server actors without weakening ownership.
- Sponsor editing, delete UI, analyst work queues, and reporting are outside the accepted Phase 7 contract.
- Package additions are excluded: the plan uses existing audited dependencies and native platform controls; an executor must halt for a package-legitimacy audit if package mutation becomes unavoidable.

## Result

All in-scope GOAL, REQ, RESEARCH, CONTEXT, and UI-SPEC items are covered. No unplanned source item or phase split is required.
