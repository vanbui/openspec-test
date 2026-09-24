# Phase 4 composite assessment release contract

Phase 4 implements assessment release using only the frozen
`CsrmAssessment` and `CsrmAssessmentRequest` fields. It does not add a field,
relation, entity, or content-type schema change.

## Authoritative release fact

An assessment is released if and only if all three assessment facts are true:

1. `assessmentStatus` is exactly `approved`;
2. `approvedBy` is populated with the acting Security Analyst; and
3. `approvalDate` is a valid server-generated timestamp.

The owning `CsrmAssessmentRequest.requestStatus` must be `approved` as part of
the same release transaction. The three assessment facts and the owning-request
status are one atomic workflow fact: either every write commits or none does.
All seven partial combinations of the three assessment facts, and any mismatch
with the owning request status, fail closed and are not released.

Only an explicitly authorised Security Analyst may invoke
`POST /api/v1/risk_assessments/{assessmentId}/release`. The server validates
record scope, mutable state, and readiness before writing `assessmentDate`,
`approvedBy`, `approvalDate`, `assessmentStatus=approved`, and the owning
`requestStatus=approved`. Clients cannot submit or override any of those facts.

## Transitions and irreversibility

- Release is allowed only from assessment `in-review` and owning request
  `under-review`.
- A successful release transitions the assessment to `approved` and the owning
  request to `approved` in one transaction.
- `closed` is not a release state and Phase 4 defines no transition to it.
- From the Requestor perspective, release is irreversible. Phase 4 serves no
  unrelease, reopen, submit-for-approval, or separate approval operation.
- `submit_for_approval` and `approve` remain unserved because the frozen model
  cannot represent the distinction between approval and Requestor-visible
  release. Serving either verb would create an ambiguous second release fact.

After release, the entire assessment aggregate is immutable. The server denies
assessment updates, Risk creation or updates, and every descendant
ControlImplementation create, update, or delete. UI visibility and disabled
controls are never treated as authorization.

## Release-readiness contract

The server is authoritative for readiness. One pure readiness check must require:

- assessment status is `in-review`;
- `reviewedBy` is populated;
- `summary`, `overallRating`, and `overallRiskRationale` are non-empty;
- at least one Risk exists;
- every Risk has a non-empty risk statement, inherent likelihood, highest inherent consequence,
  inherent rating, residual likelihood, highest residual consequence, residual rating,
  risk owner, treatment action, and target date;
- every Risk whose treatment action is `Treat` additionally has a non-empty
  treatment plan, treatment owner, treatment resolve date, and at least one
  ControlImplementation that references a reusable Control.

The analyst UI may project this same checklist as guidance, but it cannot make
an incomplete aggregate releasable. The assessment and Risk rating DTO
vocabulary is closed to `Low`, `Moderate`, `High`, and `Critical`. The server
accepts only those exact values; clients display them and never calculate or
infer a rating.

## Requestor visibility and projections

Before complete release, Requestors receive no assessment, Risk, mitigation,
rating-summary, or descendant projection. This includes an assessment with only
`assessmentStatus=approved`, a partially populated release triple, or a complete
triple whose owning request is not approved.

After complete release, a Requestor may read only an assessment owned through
their own `CsrmAssessmentRequest.requestor` relation. Owner scope and the full
release predicate are checked server-side for every list, summary, detail, Risk,
and ControlImplementation read. A Requestor can never read another Requestor's
record and receives a bounded read-only DTO with no mutation grant.

The Requestor dashboard uses the real owner-scoped
`GET /api/v1/my_risk_assessments/rating_summary` projection. Counts include only
complete releases and group the server-provided overall ratings using the closed
`Low|Moderate|High|Critical` vocabulary; no client-side reconstruction from
unreleased records is permitted.

Analyst owner pickers use only active users and expose the minimal directory
projection `{ documentId, displayName }`. No email, role, authorization, or
other identity fields are part of this picker contract. Relation identifiers in
mutation DTOs are resolved and authorised by the server rather than accepted as
populated objects.

## Frozen-model limitation

The current fields can express a single terminal approval/release event but
cannot separately persist review submission, approval, publication, revocation,
or a release audit history. Phase 4 therefore uses the composite fact above and
leaves the catalogue's ambiguous `submit_for_approval` and `approve` intents
unserved. A future distinction requires an explicit model and contract decision;
it must not be simulated with competing entities or overloaded fields.
