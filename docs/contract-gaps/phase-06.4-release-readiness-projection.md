# Phase 06.4 release-readiness projection contract gap

## Resolved contract record

**Resolved:** The contract work was completed in `docs/references/specification.json` and the generated declaration was regenerated at `apps/web/src/lib/api/generated/schema.d.ts`. `ReleaseReadiness` now exposes the complete discriminated `requirements` set with assessment and Risk scopes. This record is retained as historical context; it no longer blocks the dependent work.

## Original blocking contract mismatch

The assessment-detail server projection now returns a complete bounded release
readiness checklist from `projectReleaseReadiness`. Its shape is:

- `ready: boolean`
- `requirements: ReleaseReadinessRequirement[]`
- assessment-scoped requirements with `scope`, `key`, `label`, and `state`
- Risk-scoped requirements with those fields plus the Risk's own `riskNumber`
  and a server-supplied `destination`

The published `ReleaseReadiness` schema still declares the retired
paths-oriented shape `{ ready, missing: string[] }`. The generated web
declaration therefore also lacks `requirements` and the closed assessment/Risk
requirement variants. A client parser or editor implementation cannot consume
the authoritative complete set without either accepting an undeclared response
extension or hand-editing generated declarations.

## Required contract work

- Replace the legacy `missing` array in `ReleaseReadiness` with a bounded
  `requirements` array and preserve `ready`.
- Declare closed assessment and Risk requirement variants, discriminated by
  `scope`.
- Require `key`, `label`, and `state` (`met` or `outstanding`) on every
  requirement.
- Require `riskNumber` and `destination` only for the Risk variant. The
  destination must be the server-provided stable Risk token; it must not be
  reconstructed from display order or an array index.
- Do not allow a destination, Risk number, or unrelated relation data on an
  assessment-scoped requirement.
- Regenerate `apps/web/src/lib/api/generated/schema.d.ts` using
  `pnpm --filter @csrm/web api:generate` only after the specification is final.
- Update the assessment response parser and its response-parser inventory entry
  together with the published schema, then exercise contract nullability modes.

## Reason this is not a datamodel change

The server derives every requirement from existing assessment and Risk records
and the existing release validator. The missing work is solely the API response
schema and the generated client declaration. No content type or stored-model
change is required.
