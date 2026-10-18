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

## Phase 10 amendment (2026-09-27), part two: the `regenerated` event and the change count

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

**The change count (D-16).** The published `QuestionnaireRevision` facts gain one optional field,
`analystChangesSinceGeneration`: an integer, 0 or more, counting the `question-added`,
`question-edited` and `question-deleted` events at or after the questionnaire's latest
`generatedDate` (every one of them when it has none or it cannot be read; a log that cannot be
parsed counts 0). It is what replacing the questionnaire now would discard, and the request hub's
Replace confirmation states it. It is derived from the log on each read and never stored, so no
stored record changes. It is served on analyst paths only: the analyst questionnaire read and
every governance result. The Requestor read omits it, which is why the field is optional, in the
same way `questionKey` and `questionText` are analyst-only. The list reads and the release result
do not carry it.

### Approval of the Phase 10 amendments (G-6)

**Approved** by the pilot under the operator's G-6 delegation, 2026-10-03, after review of both parts as implemented at `984b048`. Checked:

- **JDL** (`docs/references/idambox-datamodel.jdl`): no attribute of `CsrmQuestionnaire` or `CsrmQuestion` changes. No file under `apps/backend/src/api/*/content-types/` changed since the Phase 10 baseline `5ea2b77` (10-CONTEXT D-01, D-49). The amendments extend only the JSON `governanceLog` envelope that this record already governs.
- **`specification.json`:** `QuestionnaireGovernanceEvent` and `QuestionnaireRevisionTimelineEvent` declare the optional `questionText` (string, 1 to 500 characters) and the `regenerated` kind. `QuestionnaireRevision` declares the optional `analystChangesSinceGeneration` (integer, minimum 0), described as served on analyst reads only. No required field was added, and `api:check` is clean at `984b048`.
- **Role-function catalogue:** these amendments add no operation and no grant. Plan 10-13's API-only generation-jobs Function is a separate catalogue change, enforced in Strapi.
- **AGENTS.md:**
  - Authorisation and projection stay server-side.
  - The Requestor projection is unchanged and minimal: it carries no question text, no key, no actor, and no explanation for `regenerated`, because that explanation counts analyst work the Requestor never saw.
  - Replacing a released questionnaire is refused before the job and again inside it, so no history describes a version the Requestor could see.
  - The write discipline (append in the same transaction, refuse when the log cannot take the event) keeps the record complete for audit.
- **10-CONTEXT:** D-01, D-09, D-10 and D-16 to D-18.

## Phase 15 amendment (2026-10-01): AI proposal events and restored questions

Decided in Phase 15 (15-CONTEXT D-01, D-09, D-12 and D-26 to D-28) and written on 2026-10-11 by plan 15-01, before any code writes these events. Like the Phase 10 amendments, it extends the `governanceLog` event envelope and the published contract. It is an envelope amendment, not a content-type change: no attribute of `CsrmQuestionnaire` or `CsrmQuestion` changes, and no file under `apps/backend/src/api/*/content-types/` changes in Phase 15. The AI proposals themselves and their decisions live in the run record (`docs/contract-gaps/phase-12-ai-run-record-and-provenance.md`, "Phase 15 amendment (2026-10-01)"); this log records what they did to the questionnaire.

**Two added kinds.** The closed event vocabulary gains:

- `ai-proposal`: a Security Analyst asked the AI for proposals. It is appended in the transaction that completes a `questionnaire-proposals` or `question-rewrite` run, including a run whose items lapse because the questionnaire froze; a run that fails writes no event.
- `question-restored`: a question removed by a confirmed AI proposal was restored by that confirmation's Undo.

**The added keys.** Ten optional keys, each closed and bounded, and each allowed only on the kinds named here (any other combination is refused):

| Key | Value |
| --- | --- |
| `runId` | the AI run's documentId, 1 to 255 characters |
| `itemKey` | the proposal item's key, `i-1` to `i-30` |
| `aiEdited` | boolean: the analyst edited the proposal before confirming it |
| `aiUndo` | `true`: the event reverses a confirmation |
| `scope` | `questionnaire` or `question` |
| `instruction` | the analyst's instruction, 1 to 500 characters (the log's existing text bound, the run's `instruction` bound) |
| `instructionSource` | `plain-language-preset` or `default-task`, written when no instruction was given |
| `providerName`, `providerVersion` | the run's provider, 1 to 255 characters each |
| `itemCount` | the items the run kept, an integer from 0 to 30 |

**Which events carry them.**

- **`ai-proposal`** carries `by` (the initiating analyst), `at`, `runId`, `scope`, exactly one of `instruction` or `instructionSource`, `providerName`, `providerVersion` and `itemCount`, and, for the `question` scope, `questionKey` and `questionText` (Phase 10's snapshot rule) naming the rewritten question.
- **`question-added`, `question-edited` and `question-deleted` written by a confirmation** carry `runId`, `itemKey` and `aiEdited` together, with `by` the confirming analyst and the question's `questionKey` and `questionText` as Phase 10 records them.
- **An Undo** writes the reverse event with the same `runId`, `itemKey` and `aiEdited` and adds `aiUndo: true`, with `by` the undoing analyst: an undone addition writes `question-deleted`, an undone change `question-edited`, and an undone removal `question-restored` (which requires `questionKey` and may carry `questionText`).
- **`regenerated`** gains `instruction`, or `instructionSource: "default-task"` when no instruction was given (D-12). Events written before carry neither.
- A rejection, and the Undo of a rejection, write no governance event: they change no question, and the run's decision events record them.

**Version and write discipline.** The event stays at `schemaVersion` 1: keys are not versioned (the Phase 10 precedent), and the closed parser still rejects every key and kind it does not declare. Writes stay append-only, in the same transaction as the change they document, under "Write Discipline" above. A log that cannot take an event (full at 1,000 events, or unreadable) refuses with `HISTORY_UNAVAILABLE` and nothing is written: a decision is refused, and a proposal run fails with that code and keeps no proposal. The two start operations check for a free slot before a job is queued.

**The release gate is unchanged.** It still reads only `releasedAt` and `releasedBy`, never this log (see "Approved Compatibility Extension").

**The change count (D-09).** `analystChangesSinceGeneration` counts `question-restored` beside `question-added`, `question-edited` and `question-deleted`: a confirmed AI proposal and its Undo are analyst changes. The narrowed questionnaire replacement reads that count and refuses with 409 `QUESTIONNAIRE_HAS_ANALYST_CHANGES` when it is above 0. An unreadable log still counts nothing toward the refusal; the replacement then fails with `HISTORY_UNAVAILABLE` as today.

**Who reads them.**

- **The analyst projection** carries every key of these events, with actor names resolved as today.
- **The Requestor projection** never carries an AI kind or key:
  - it drops every `ai-proposal` event;
  - it drops a confirmation and its Undo (the same `runId` and `itemKey`) when no `released` event lies between them, so a change the Requestor never saw leaves no trace;
  - it removes every AI key from the events it keeps;
  - it projects an unpaired `question-restored` (an Undo after a release) like any question change, with `kind` and `at` only, and Phase 10's per-round summary counts it among changes.

The published schemas `QuestionnaireGovernanceEvent` and `QuestionnaireRevisionTimelineEvent` declare both kinds and the ten keys with the same bounds, and say that the Requestor projection never carries them.

### Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams"). On 2026-10-11 that section's workstream table lists one workstream, `csrm`, whose application (`apps/csrm`) is the only reader of `CsrmQuestionnaire.governanceLog` and of the operations that serve it. This amendment is backward compatible for any later reader: logs written before it parse unchanged and no stored log is migrated; every change is additive, or a narrowing reached only by the `csrm` workstream's application, which changes its closed parsers in the same plan as the server (the 06.9 lesson); and no content type, attribute, relation or existing grant changes.

It changes these existing schemas and behaviours:

- **The governance and revision-timeline events.** `QuestionnaireGovernanceEvent` and `QuestionnaireRevisionTimelineEvent`, served by the questionnaire read (`GET /api/v1/questionnaires/{questionnaireId}`), the governance results (release, return to review, and the question add, edit and delete) and the timeline, gain the kinds `ai-proposal` and `question-restored` and the ten optional AI keys, in the analyst projection only.
- **The Requestor projection** drops them, and drops confirmation and Undo pairs within one round (D-26).
- **The analyst change count** (`analystChangesSinceGeneration`) counts `question-restored`, and the narrowed replacement reads that count (D-26, D-09; the run record's amendment lists the replacement's new refusals).

Phase 15 amendment status: **approved by the pilot on 2026-10-11** (G-6), for the two kinds, the ten keys and the kinds they may appear on, the Requestor projection and the change count exactly as this amendment states them. Plan 15-02 and every later Phase 15 plan write these events only after this line.

What the pilot checked:

- **JDL**: no attribute of `CsrmQuestionnaire` or `CsrmQuestion` changes. The amendment extends only the `governanceLog` envelope this record governs, at `schemaVersion` 1 as the Phase 10 amendments did, and the closed parser still refuses any undeclared kind or key, and any key on a kind it is not allowed on.
- **API contract**: `QuestionnaireGovernanceEvent` and `QuestionnaireRevisionTimelineEvent` gain two kinds and ten optional keys, in the analyst projection only; no required field is added.
- **AGENTS.md**: the release gate still reads only `releasedAt` and `releasedBy`, never the log; authorisation and projection stay server-side.
- **The Requestor projection stays minimal**: it never carries an AI kind, key, instruction or provider. A confirmation and its Undo inside one analyst-review round leave no trace, because the Requestor never saw either, and an Undo after a release reads as an ordinary question change.
- **Audit (D-26)**: every completed proposal run leaves an `ai-proposal` event with its initiating analyst, time, scope, instruction or its source, provider and item count, whatever later happens to its items. Every confirmed change names its run and item and whether the analyst edited it first. Writes stay append-only, in the transaction they document, and refuse with `HISTORY_UNAVAILABLE` when the log cannot take the event.
- **The change count**: counting `question-restored` keeps the narrowed replacement honest about analyst work (D-09).
- **Residual noted**: the log's 1,000-event bound is Phase 10's. A questionnaire with very heavy AI use could reach it; decisions then refuse with `HISTORY_UNAVAILABLE` rather than lose history, which is the right direction for an audit log.
