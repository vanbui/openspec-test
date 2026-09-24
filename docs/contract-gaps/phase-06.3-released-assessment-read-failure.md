# Released assessment read failure

## Symptom

Opening a released risk assessment as the owning Requestor can render
"We couldn't load this risk assessment" instead of the assessment.

## Mechanism

`releasedAssessmentDetailSchema` in `apps/web/src/features/assessments/assessment-schema.ts`
wraps the closed assessment detail schema in a refinement that fails when:

- `assessmentStatus` is not `approved`, or
- any of `assessmentDate`, `approvalDate`, or `approvedBy` is null.

`getReleasedAssessment` parses the response with that schema, and any parse
failure is normalised to the generic transport error. The route then renders its
`error` state. So a contract mismatch, an incomplete release fact, and a genuinely
unavailable service all present as the same sentence.

## Why this is worth a phase item rather than a one-line fix

Four defects across Phases 06.1 and 06.2 shared this shape: the server completed
the operation and the client reported failure, because a closed schema and the
payload it received had drifted. Each was expensive to find precisely because the
message says nothing about which of the two happened.

The parity tests compare served route against catalogue grant against the OpenAPI
document. Nothing compares the OpenAPI document against the client schemas that
parse its responses, which is where all four drifted.

## Resolution

**1. Reproduced.** The `RequestorReleasedAssessmentDetail` contract declared
`assessmentDate`, `approvalDate` as `["string", "null"]` and `approvedBy` as
nullable, while `assessmentStatus` accepted every status. The client refinement
rejects all four. So a payload the contract explicitly permits could never be
parsed, and the mismatch was structural rather than data-dependent: the failure
is reproducible straight from the contract, without seeding a broken record.

**2. Fixed at the source.** The released detail is only ever served for a
released assessment, so the contract now says so — `assessmentStatus` is
`const: "approved"`, and `assessmentDate`, `approvalDate` and `approvedBy` are
non-null. `releasedAssessmentQuery` filters `assessmentDate: { $notNull: true }`
alongside the existing `approvalDate` filter, so a partially written legacy row
is excluded from the projection and the Requestor gets an honest "not found"
rather than a 200 the client cannot parse. Release rules were not weakened: the
release transition already writes all four facts in a single update.

**3. Diagnosable.** `normalizeResponseParserError` tags a parse failure as
`response-contract-mismatch` and the released detail route renders the failing
operation in development only; production still shows the neutral message.

**4. Guarded.** `apps/web/src/features/contract-response-parity.test.ts` builds
payloads directly from `docs/references/specification.json` and feeds them to the
real client parsers, in three modes: contract-required properties only, every
declared property, and every nullable property served as null. The third mode is
what reproduces this defect. Where a client is deliberately narrower than a
shared contract component, the parser table declares the path and the reason, and
the guard fails if a declared narrowing no longer corresponds to a real
rejection.

### Found by the new guard, and also fixed

`controlStatus`, `effectivenessRating` and `overallControlEffectiveness` were
declared as unconstrained strings in several response components while both the
Strapi datamodel and the client restrict them to the same four values. The
contract now carries the enum, matching the declaration the same file already
used elsewhere.

### Found by the new guard, and deferred

`QuestionnaireGenerationJob` is declared as one flat object with optional
per-state fields, while its sibling `AssessmentDraftJob` is a discriminated
`oneOf` and the client models both as unions. The contract therefore permits a
job payload carrying `startedAt`, `completedAt`, `failureCode`,
`failureMessage` and `questionnaire` at once, which the client refuses. This is
recorded as a declared narrowing on `getQuestionnaireGenerationJob`. Restructuring
it belongs to the phase that owns questionnaire generation, not to a correctness
pass; nothing serves such a payload today.

## Original scope

## What the phase must do

1. Reproduce the failure against a released assessment owned by the signed-in
   Requestor, and record which of the refinement conditions actually failed.
2. Fix the cause. If a release fact is legitimately absent, the release workflow
   should not have produced it; if the projection omits a declared field, the
   projection or the contract is wrong.
3. Make a contract mismatch distinguishable from an unavailable service in
   development, so this class of defect is diagnosable from the screen rather
   than from a schema read.
4. Consider a contract-to-client-schema parity check. It is the single guard that
   would have caught all four occurrences.
