# Phase 06.1: Revert Audit Facts

## Gap

The frozen CSRM JDL defines request submission facts but no facts that describe a
successful return from a submitted workflow state to draft. It also does not
define a separate reversal-event entity. Reusing or widening ordinary request
updates would make the reversal unauditable and would weaken server-owned
workflow fields.

## Approved Compatibility Extension

`CsrmAssessmentRequest` and `CsrmQuestionnaire` each receive the same three
optional attributes. Both aggregates are independently reversible — a request
returns to draft from `submitted`, and a questionnaire returns its answer
envelopes to draft while its request is `questionnaire-in-progress` — so each
must carry its own reversal facts rather than share one record.

| Attribute | Type | Meaning |
| --- | --- | --- |
| `revertReason` | text | The mandatory trimmed reason supplied for the latest successful reversal. |
| `revertedAt` | datetime | Server-owned time of the latest successful reversal. |
| `revertedBy` | many-to-one `IdamBoxUser` | Server-derived actor who performed the latest successful reversal. |

Each field is optional so records created before this extension remain valid.
The fields are written only by the protected reversal workflow operation, in the
same transaction as the workflow state change: for a request, alongside the
cleared submission time; for a questionnaire, alongside the answer envelopes
returned to draft.

The questionnaire keeps no status attribute. Its submitted state stays derived
from its answer envelopes, so this extension adds audit facts only and does not
introduce a competing questionnaire status field.

## Audit Semantics and Limitation

These attributes persist only the most recent reversal facts. They do not form
an immutable or complete reversal-event history. A full event-history model is
explicitly deferred pending a future domain-model decision; this phase must not
introduce a competing audit entity outside the frozen JDL.
