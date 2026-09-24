# Phase 06.7: AI Provider Provenance

## Gap

The frozen CSRM JDL records the time and initiating analyst for generated
questionnaires and assessment drafts, but it has no attributes that identify
the configured provider model responsible for a generated record. The existing
deferrals in `docs/contract-gaps/phase-04-deterministic-draft-jobs.md` and
`docs/contract-gaps/phase-06.2-questionnaire-generation-provenance.md` keep
provider name and version only in volatile job records and assign durable
provider provenance to Phase 8.

## Approved Compatibility Extension

`CsrmQuestionnaire` and `CsrmAssessment` each receive optional string
attributes, `providerName` and `providerVersion`. They are written in the same
generation transaction as `generatedDate` and `generatedBy`. Optional fields
preserve the validity of all existing records and manually created records,
matching the Phase 06.1 and Phase 06.2 compatibility precedents.

This record supersedes the Phase 8 deferral in
`docs/contract-gaps/phase-04-deterministic-draft-jobs.md` and
`docs/contract-gaps/phase-06.2-questionnaire-generation-provenance.md` for
this narrow two-field addition. Phase 06.7 requires provider name, provider
version, generation timestamp, and initiating analyst to persist for every
generated questionnaire and assessment draft.

`providerName` is the operator-supplied friendly configuration label, defaulting
to `openai-compatible` when unset. It is not a hardcoded vendor name: this
integration targets a wire protocol rather than a fixed provider. It is also
not the raw endpoint host, which could disclose internal hostnames in a field
the interface may later display. The field lets an auditor distinguish output
from a self-hosted model from output supplied by a hosted service.

`providerVersion` is the exact model identifier configured for the operation.
The configured identifier is self-documenting and needs no separate version
bookkeeping.

## Persistence Boundary and Remaining Deferral

These fields are persistence-only in this phase. No API projection exposes
them, `docs/references/specification.json` remains unchanged, no route or
capability-catalogue entry changes, and no `apps/web` code is touched.

This addition does not claim durable job records, restart recovery of an
in-flight attempt, input snapshots, proposal sources, field-level
human-change tracking, prompt history, or job audit history. Those capabilities
remain deferred to Phase 8. Interface and API projections must not imply
stronger persistence, recovery, or attribution than this record describes.

No migration file accompanies this change. `apps/strapi/database/migrations/`
is an empty placeholder, and Strapi schema sync handles additive optional
attributes, following the unbroken Phase 06.1 and Phase 06.2 precedent.
