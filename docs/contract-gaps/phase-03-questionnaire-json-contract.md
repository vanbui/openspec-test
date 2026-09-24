# Phase 3 questionnaire JSON contract

Phase 3 uses a versioned convention in the existing `CsrmQuestion.options` and
`CsrmQuestion.answer` JSON fields. It does not add an entity or persisted field,
and neither questionnaire content-type `schema.json` may be modified.

## Definition envelope (`options`, schema version 1)

Every question stores this closed shape in `options`:

```json
{
  "schemaVersion": 1,
  "questionKey": "internetFacing",
  "section": {
    "key": "system-context",
    "title": "System context",
    "description": "How the system is used and exposed.",
    "order": 0
  },
  "order": 0,
  "required": true,
  "visibility": {
    "questionKey": "externalAccess",
    "operator": "equals",
    "value": true
  },
  "choices": [{ "value": "yes", "label": "Yes" }]
}
```

`visibility` and `choices` are optional. The supported operators are `equals`,
`notEquals`, `includes`, and `notIncludes`. Conditions may reference only an
existing earlier question. Question keys, section orders, question orders within
a section, and choice values are unique. Select questions require non-empty
choices; all other answer types reject choices.

The persisted `answerType` is cross-checked against this definition. Supported
renderable types are `Text`, `Long text`, `Boolean`, `Single select`,
`Multi select`, and `Date`. Date values use `YYYY-MM-DD`.

The existing `helpText`, persisted `order`, and `reviewComment` fields are not
Phase 3 sources for grouping, ordering, requiredness, or conditional visibility.
Those facts come only from the versioned `options` convention.

## Answer envelope (`answer`, schema version 1)

Each answered question stores:

```json
{
  "schemaVersion": 1,
  "value": true,
  "state": "draft",
  "updatedAt": "2026-08-30T01:02:03.000Z"
}
```

`value` is narrowed by `answerType`: string for text, long text, single select,
and date; boolean for Boolean; string array for Multi select; or `null` for an
unanswered question. Submitted answers use `state: "submitted"` and must include
`submittedAt`. Every answer in one submitted batch has the same server-owned
submission timestamp. `state`, `updatedAt`, and `submittedAt` are server-owned;
draft mutation input cannot choose lifecycle fields or timestamps.

Unknown versions, properties, types, keys, condition values, choice values,
forward edges, and cycles fail closed during Zod normalization. Hidden answers
are removed before authoritative save, submission, or review projections so a
changed controller answer cannot retain stale sensitive values.

## Derived state and completeness

- `not-started`: no visible question has a value.
- `draft`: at least one visible value exists and there is no complete submitted batch.
- `submitted`: every active submitted envelope shares one server timestamp.

Progress and requiredness count only visible questions. A response is complete
only when every visible required question has a non-empty, type-compatible value.
Visibility, hidden-value clearing, progress, and completeness are recomputed from
the normalized definition and answers rather than trusted from client input.

## File upload limitation

`File upload` remains a persisted answer type but is deliberately unsupported in
Phase 3 because no authorised upload/storage contract exists. Its definition
normalizes to the typed result `unsupported/file-upload-deferred`; its answer
schema accepts only `null`, never a path or URL surrogate. A visible required
File upload therefore blocks completeness. This limitation fails closed until a
later phase defines authenticated upload, storage, malware scanning, retention,
and record-authorization behaviour.

## Security rationale

Both JSON fields cross a mutable Strapi-to-web trust boundary. Closed schemas and
pure recomputation prevent injected lifecycle state, invalid rendering types,
condition graph tampering, hidden-answer disclosure, and File upload surrogate
values from becoming authoritative application behaviour.
