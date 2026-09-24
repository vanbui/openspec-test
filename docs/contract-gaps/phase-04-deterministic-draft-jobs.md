# Phase 4 deterministic assessment draft-job contract

Phase 4 uses a deterministic provider behind a server-only interface. It proves
the asynchronous review workflow without adding durable job, provider,
provenance, or audit entities. Durable provider infrastructure and richer
provenance remain Phase 8 responsibilities.

## Processing boundary

The pipeline is strictly:

`authoritative questionnaire reload -> provider -> bounded proposal -> workflow persistence`

Every attempt reloads the submitted questionnaire definition and answers from
Strapi, validates the Phase 3 closed JSON envelopes, recomputes visibility and
completeness, and then passes only a normalized bounded input to the provider.
The registry and provider retain no questionnaire answer payload, raw user text,
or retrieved content after the attempt.

Provider output is untrusted. A closed proposal parser allows only assessment
draft fields, contextual Risk proposals, Risk Type references, and sorted
applicable reusable-Control references defined by this contract. Proposals have
no release capability and cannot contain or choose IDs, workflow statuses,
request relations, assessment relations, `riskNumber`, `assessmentNumber`,
`generatedBy`, `generatedDate`, `reviewedBy`, `approvedBy`, `approvalDate`,
timestamps, owner authorization facts, or any other server-owned field. The
workflow resolves relations, generates identifiers, and persists accepted data
in one transaction.

Provider failure never creates or partially updates an assessment, Risk, request
workflow fact, or release fact. A safe failure code and message are observable
through the job projection; provider diagnostics and questionnaire content are
not returned.

## Job state machine

A server-module registry stores a closed job record containing `jobId`,
`questionnaireId`, initiating analyst ID, provider name and version, `status`,
`attempt`, queued/started/completed timestamps, optional resulting assessment
ID, and an optional safe failure code/message.

The exhaustive statuses and transitions are:

- `queued` -> `running` when an attempt begins;
- `running` -> `completed` only after the aggregate transaction commits;
- `running` -> `failed` when validation, provider execution, or persistence
  fails without committing the aggregate;
- `failed` -> `queued` on an authorised retry event, incrementing `attempt`.

Retry is an event on the same logical job, not a second concurrent job. Only a
failed job can be retried. Completed jobs are terminal and return their persisted
assessment ID. The generation endpoint returns the existing active or completed
job for the questionnaire rather than scheduling a duplicate. Concurrent calls
are single-flight and idempotent for the same questionnaire; only one attempt
may be queued or running and only one one-to-one assessment may be committed.

Job lookup and retry require the narrow Security Analyst assessment grant and
the same server-side scope rules as generation. Knowledge of a job ID never
grants access. A job cannot release an assessment or bypass analyst review.

## Bounds, eviction, and restart behavior

The module-only registry is capped at 500 terminal entries. Terminal entries
expire after one hour and are evicted using least-recently-used ordering when
the terminal cap or TTL is enforced. `queued` and `running` entries are active
and must never be evicted. Cleanup must not turn an active single-flight job into
a duplicate generation opportunity.

Registry state is volatile across process restart. Provider name/version,
attempt, failure information, and job timestamps can therefore disappear. On a
restart, recovery is limited to reloading the questionnaire's owning request and
discovering its persisted one-to-one assessment. If that assessment exists, the
workflow reports the existing assessment instead of regenerating it. No claim
is made that an uncommitted queued, running, or failed attempt is recoverable.

## Deterministic proposal derivation

The provider normalizes relevant visible submitted answers, uses stable seeded
Risk Types, and produces the same proposal content for the same normalized
inputs and seed data. It evaluates these mappings:

- **Internet Exposure** from internet-facing and hosting answers;
- **Personal Information Handling** from personal-data flags and personal-data
  category answers;
- **Third-Party Dependency** from third-party involvement and provider answers.

Only applicable mappings produce Risk proposals. Before proposal output and
persistence, matched Risk Types are sorted by stable Risk Type name and all
applicable reusable Controls are sorted by control number. Statements, the
closed `Low|Moderate|High|Critical` ratings, rationales, and suggested-control
references use stable templates. Generated identifiers and server timestamps
are deliberately outside deterministic comparison.

Suggested Controls remain bounded references to the existing reusable Control
inventory. The proposal does not create Control definitions and does not imply
that every suggestion becomes a ControlImplementation. The analyst retains
control of contextual mitigation editing before release.

## Persisted provenance and wording

The frozen assessment model persists only `generatedDate` and `generatedBy` for
this workflow. `generatedBy` is the initiating Security Analyst because the
relation targets `IdamBoxUser`; the user-facing wording is exactly
“draft initiated by”. It must not suggest that the relation identifies a
provider or service identity.

Provider/version, attempt, safe failure, and job timing metadata stay volatile
in the registry. The frozen model cannot durably record provider provenance,
input snapshots, proposal sources, field-level human changes, prompt history, or
job audit history. Phase 8 owns real durable provider infrastructure and any
explicit provenance/audit model. Until then, UI and API projections must not
imply stronger persistence, recovery, or attribution than this contract.
