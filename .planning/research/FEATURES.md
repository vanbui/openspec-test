# Feature Research

## Table stakes for CSRM v1

- Controlled request creation, draft editing, submission, and clear workflow status.
- Dynamic, resumable questionnaires with progress, validation, grouped sections, and analyst review.
- Analyst-owned assessment review, risk and mitigation treatment editing, and an explicit release action.
- Read-only Requestor access only after release.
- Searchable, paginated risk and administration collections; CSV import with preview, row errors, confirmation, and outcome summary.
- Capability-driven navigation and UI affordances backed by server-side record authorization.
- Accessible, responsive states for loading, empty, error, permission-denied, desktop, and mobile.

## Differentiators to retain in v1 architecture

- Provider-independent, asynchronous AI job states with provenance and human modifications.
- Semantic BProton/IdamBox design tokens and risk-rating semantics.
- Reusable, data-driven dashboards and a typed OpenAPI service boundary.

## Anti-features for this milestone

- Automatic AI release, custom ML training, real-time co-editing, full GRC expansion, and tenant administration.
