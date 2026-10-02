# Phase 06.8: Questionnaire Governance Facts

## Gap

Phase 06.8 makes questionnaire release an authorization gate and gives both actors an
auditable revision history. The frozen CSRM JDL supports neither.

Two distinct facts are missing:

1. **No release fact.** `CsrmQuestionnaire` carries `generatedDate`/`generatedBy` and
   the Phase 06.1 reversal facts, but nothing that records whether a generated
   questionnaire has been released to its Requestor. Authorization for questionnaire
   reads is currently ownership-only, so a generated questionnaire is visible to its
   Requestor immediately. Decision D-05 requires that it stay analyst-only until an
   explicit Analyst release, which needs a persisted, server-owned release fact to gate
   on.
2. **No revision history.** The Phase 06.1 record states plainly that `revertReason`,
   `revertedAt`, and `revertedBy` "persist only the most recent reversal facts" and "do
   not form an immutable or complete reversal-event history", and it defers a full
   event-history model "pending a future domain-model decision". Decisions D-02, D-07,
   and D-09 require exactly that history: a dated timeline of releases, returns to
   review, question edits, question deletions, and cleared answers, in which later
   records are never silently deleted. Phase 06.8 is the deferred decision.

Neither gap can be closed by reusing an existing attribute. `CsrmQuestionnaire` has no
status attribute and no unused JSON attribute. A new audit content type is excluded: the
Phase 06.1 record requires that no competing audit entity be introduced outside the
frozen JDL.

## Approved Compatibility Extension

`CsrmQuestionnaire` receives three optional attributes.

| Attribute | Type | Meaning |
| --- | --- | --- |
| `releasedAt` | datetime | Server-owned time of the latest successful release to the Requestor. Absent means never released. |
| `releasedBy` | many-to-one `IdamBoxUser` | Server-derived Analyst who performed the latest successful release. |
| `governanceLog` | json | Append-only, schema-versioned array of governance events: release, return to analyst review, question added, question edited, question deleted, and answer cleared. |

Each attribute is optional so records created before this extension remain valid.

`releasedAt` and `releasedBy` are the authoritative release gate, read directly by the
authorization policy. The gate deliberately does not derive itself from `governanceLog`:
an access-control decision must not depend on parsing a mutable JSON array, where a
malformed or truncated log failing safe would deny every read of an already-released
questionnaire. `governanceLog` carries narrative history only and is never consulted for
an authorization decision.

The questionnaire still keeps no status attribute. Its submitted state stays derived from
its answer envelopes, and its released state is now a pair of audit facts about an event
in the same shape as the Phase 06.1 reversal facts. This extension therefore adds audit
facts and an event log only; it does not introduce a competing questionnaire status
field, and it does not add an entity.

## Write Discipline

`governanceLog` is append-only. The protected workflow operation appends one entry in the
same transaction as the state change it documents. No code path may remove, reorder, or
rewrite a prior entry. Reads validate the array against a closed schema and fail safe on
a malformed envelope, in the same posture as the existing questionnaire-definition and
answer-envelope parsers.

`releasedAt` and `releasedBy` are written only by the protected release operation.
Returning a questionnaire to analyst review clears them, and appends the return event to
`governanceLog` with its mandatory reason, so the history of releases survives the
clearing of the current release fact.

## What This Extension Does Not Add

No schema change is needed, and none is approved, for:

- **The request lifecycle stepper (D-01).** Its eight visible steps are derived from the
  existing `CsrmAssessmentRequest.requestStatus` enum, the questionnaire release facts
  above, the per-answer submitted envelopes, and the existing
  `CsrmAssessment.assessmentStatus` enum. No value is added to any existing enumeration,
  because the stepper is a read-only projection rather than a stored state.
- **Soft-deleted questions (D-07).** A deletion marker lives inside the existing
  versioned `CsrmQuestion.options` JSON envelope, which already carries parsed,
  schema-versioned question definition data.
- **The assessment review regression (D-13).** `CsrmAssessment.assessmentStatus` already
  enumerates `draft`, so returning a reviewed but unreleased assessment to `draft` is an
  ordinary transition within the existing vocabulary.

## Audit Semantics and Limitation

`governanceLog` is an append-only log inside its aggregate, not a global audit store. It
is scoped to one questionnaire and is readable only through the same ownership and
collection-scope checks as every other questionnaire read; no separate unscoped history
endpoint is introduced. A cross-aggregate audit trail spanning requests, assessments, and
risks remains out of scope and is deferred to a future domain-model decision.

## Phase 10 amendment (2026-09-27): question text snapshots

Decided in Phase 10 (10-CONTEXT D-01, D-17 and D-18) and recorded on 2026-10-02 with the change
that implements it (plan 10-10). It extends the `governanceLog` event envelope above; it is not a
content-type change, and no attribute of `CsrmQuestionnaire` or `CsrmQuestion` changes.

**The added key.** A governance event may carry one more optional key, `questionText`: a string
of 1 to 500 characters. The event stays at `schemaVersion` 1, and the closed parser still rejects
every key it does not declare. The writer trims the question's text and, when it is longer than
500 characters, keeps its first 499 and a closing ellipsis (`…`).

**Which events carry it.** The four question events, each with the question's own words:

| Event | Text kept |
| --- | --- |
| `question-added` | the new question's text |
| `question-edited` | the question's text after the edit |
| `question-deleted` | the text the question had when it was removed |
| `answer-cleared` | the text of the revised question whose answer was cleared |

**Write discipline.** The snapshot is part of the event, so it is appended in the same transaction
as the change it documents, before any write, under the rules in "Write Discipline" above. A log
that cannot take the event refuses the change (`HISTORY_UNAVAILABLE`) and leaves nothing behind.

**Reading older events.** Events written before this amendment carry no `questionText`, and no
stored log is migrated. The analyst timeline projection names such an event by resolving its
`questionKey` against every question of the questionnaire, removed ones included, only when the
event is not older than the questionnaire's latest generation (`generatedDate`; a questionnaire
with none resolves every key). Question keys are not versioned, so an older event's key may belong
to a question set a replacement has since discarded: such an event, and one whose key matches no
question, names no question, and the timeline reads it as "a question from an earlier version". A
resolved text is bounded exactly like a snapshot.

**Who reads it.** Only the analyst projection carries `questionText`, beside the `questionKey` it
already carried. The Requestor projection is unchanged: `kind`, `at` and `explanation`, never a
question's text, key or actor. The published schemas `QuestionnaireGovernanceEvent` and
`QuestionnaireRevisionTimelineEvent` declare the key with the same bounds.

## Phase 10 amendment (2026-09-27), part two: the `regenerated` event

Decided in Phase 10 (10-CONTEXT D-01, D-09 and D-10) and recorded on 2026-10-02 with the change
that implements it (plan 10-11). Like part one, it extends the `governanceLog` event envelope and
the published contract; it is not a content-type change, and no attribute of `CsrmQuestionnaire`
or `CsrmQuestion` changes.

**The added kind.** The closed event vocabulary gains one kind, `regenerated`: a newly generated
questionnaire replaced this questionnaire's questions. The event stays at `schemaVersion` 1 and
carries `by` (the analyst who started the generation), `at` and `explanation`, never a reason or
a question key. The published schemas `QuestionnaireGovernanceEvent` and
`QuestionnaireRevisionTimelineEvent` list the kind, and so do the web's closed parsers.

**When it is written.** Only by the generation job that replaces an existing questionnaire, in the
transaction that deletes the replaced questions and stamps the new generation. Its `at` is the new
`generatedDate`, so the part-one resolution window and the change count below restart from the
replacement. A first generation writes no event. Under "Write Discipline" above, the event is
appended in memory before any write: a log that cannot take it fails the job with the registry's
safe generic failure (`QUESTIONNAIRE_GENERATION_FAILED`), and the questionnaire keeps its
questions, generation facts and log. Replacing a released questionnaire is refused before a job is
queued (409 `QUESTIONNAIRE_RELEASED`) and again inside the job, under the request row lock, when a
release lands while it runs (failure code `QUESTIONNAIRE_RELEASED`, D-09). So no `regenerated`
event ever describes a version the Requestor could see.

**Its explanation.** The server writes it, because the analyst timeline shows it verbatim
(UI-SPEC §3.4): `A newly generated questionnaire replaced {n} {question|questions}. {m} analyst
{change was|changes were} discarded.`, or, when `m` is 0, `… No analyst changes were discarded.`
`n` counts the replaced questionnaire's questions that were not already removed; `m` is the number
of `question-added`, `question-edited` and `question-deleted` events at or after the replaced
generation's `generatedDate` (every one of them when it has none), counted before the event is
appended.

**Who reads it.** The analyst projection carries the event like any other: kind, time, the named
analyst and the explanation. The Requestor projection carries only `kind` and `at`: the
explanation counts analyst work the Requestor never saw. The Requestor's history lists a
replacement only after the questionnaire was first released (UI-SPEC §4.3).
