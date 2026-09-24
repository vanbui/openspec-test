# Phase 06.4 Request relationship projection contract gap

## Resolved contract record

**Resolved:** The contract work was completed in `docs/references/specification.json` and the generated declaration was regenerated at `apps/web/src/lib/api/generated/schema.d.ts`. `GET /csrm-assessment-requests/{id}` now declares `data.relationships` with discriminated questionnaire and assessment availability unions, including bounded residual Risk counts. This record is retained as historical context; it no longer blocks Plan 06.4-04.

## Original blocking contract mismatch

The `GET /csrm-assessment-requests/{id}` controller now adds a bounded
`data.relationships` projection containing the questionnaire and assessment
availability summaries. The published response schema still describes only the
base Strapi assessment-request document. Consequently, the generated web
declarations do not expose `relationships`, the three-state availability
variants, or `residualRiskCounts`.

Plan 06.4-04 cannot safely parse or present these values through the typed
service layer until the OpenAPI operation response declares the projection and
the web declarations are regenerated from that final specification.

## Required contract work

- Declare the request-detail `relationships` object on the GET response with
  closed questionnaire and assessment availability unions.
- The `available` questionnaire summary must include only its bounded identity.
- The `available` assessment summary must include only its bounded identity,
  status, and non-negative `Low`, `Moderate`, `High`, `Critical`, and `total`
  residual Risk counts.
- The `absent` and `unavailable` variants must contain only `availability`; in
  particular, unavailable must not carry an identifier or tally.
- Regenerate `apps/web/src/lib/api/generated/schema.d.ts` with
  `pnpm --filter @csrm/web api:generate` after the specification is final.

## Reason this is not a datamodel change

The server already derives this projection from existing request,
questionnaire, assessment, and Risk records. The gap is an API response schema
and generated-client declaration mismatch, not a content-type or stored-model
change.
