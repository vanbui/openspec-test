# Phase 13: Request Assignment

## Gap

The frozen CSRM JDL gives `CsrmAssessmentRequest` three relations to `IdamBoxUser`: `requestor`, `sponsor` and the Phase 06.1 `revertedBy`. None names the Security Analyst accountable for the request, so a submitted request has no owner on the analysts' side and two analysts can work it without knowing about each other (UAT-014). Decision 10 asks for one accountable assignee per request, with every reassignment recorded, and leaves editing non-exclusive.

No existing attribute can hold that fact. `requestor` and `sponsor` name the business side, `revertedBy` names only the latest reversal, and the request has no unused JSON attribute. No JDL entity carries an assignment. This record is therefore a compatibility extension of the existing request aggregate, in the same shape as the Phase 06.1 and 06.8 facts: a current fact the server reads, plus an append-only log beside it. It is not a competing model, and it adds no entity.

## Approved Compatibility Extension

This is the only assignment schema change Phase 13 proposes: four optional attributes on `CsrmAssessmentRequest`.

```jdl
entity CsrmAssessmentRequest {
  // every existing attribute unchanged
  assignedAt Instant,
  assignmentLog AnyBlob
}

relationship ManyToOne {
  CsrmAssessmentRequest{assignedAnalyst} to IdamBoxUser,
  CsrmAssessmentRequest{assignedBy} to IdamBoxUser
}
```

The content type stays `api::csrm-assessment-request.csrm-assessment-request`, collection `csrm_assessment_requests`.

| Attribute | Strapi type | Meaning |
| --- | --- | --- |
| `assignedAnalyst` | relation manyToOne `api::idambox-user.idambox-user` | The current fact: the one Security Analyst accountable for the request, or nobody. The only assignment fact an authorisation decision reads. |
| `assignedAt` | datetime | Server-owned time of the change that produced the current assignment. Null when unassigned. |
| `assignedBy` | relation manyToOne `api::idambox-user.idambox-user` | Server-derived Security Analyst who made the current assignment (the assignee themselves after a pick-up). |
| `assignmentLog` | json | Append-only, schema-versioned history of every assignment change (see "Write Discipline"). |

Every attribute is:

- **optional**, so every request created before this extension stays valid and reads as unassigned with no history;
- **server-owned**, written only by the assignment operation below and never accepted from a generic create or update;
- **`private: true`**, so no Strapi core route (find, findOne, create, update) returns it; the facts reach callers only through Phase 13's server projections ("People Projection");
- **one-way**: neither relation has an inverse attribute on `IdamBoxUser`, in the same way `revertedBy` has none, so the IdamBox User content type does not change.

Strapi keeps every relation in a link table, `manyToOne` included. The two new link tables, computed with `@strapi/database` 5.51's identifier rules (both are under the 55-character limit, so neither name is shortened):

| Relation | Link table | Owner column | Target column |
| --- | --- | --- | --- |
| `assignedAnalyst` | `csrm_assessment_requests_assigned_analyst_lnk` | `csrm_assessment_request_id` | `idambox_user_id` |
| `assignedBy` | `csrm_assessment_requests_assigned_by_lnk` | `csrm_assessment_request_id` | `idambox_user_id` |

`assignedAt` and `assignmentLog` become the columns `assigned_at` and `assignment_log` on `csrm_assessment_requests`.

## Write Discipline

**One protected operation.** `PUT /api/v1/assessment_requests/{requestId}/assignee` is the only writer of the four facts. Its body names the new analyst (an IdamBox User documentId, or null to unassign), `expectedAnalyst` (the assignee the caller last saw, or null) and an optional plain-text reason of at most 500 characters. The server derives the action: **pick up** (the caller takes an unassigned request), **assign** (another analyst, when unassigned), **reassign** (from one analyst to another, the caller included) and **unassign** (back to the queue).

**One transaction under the request lock.** The operation runs inside `withRequestLock`, the per-request lock extracted from the Phase 06.1 revert: an in-process promise tail per request, then a transaction that takes `SELECT … FOR UPDATE` on the request row before reading anything it decides on. Every deciding read happens after the lock. The four facts are written together in that one transaction, so the current fact and its history never disagree. The revert, assignment, notes, mark-read and AI-input paths share the one lock module, and it is never nested for one request.

**Compare-and-set.** When the current assignee differs from `expectedAnalyst`, the change is refused with 409 and the closed reason `ASSIGNMENT_CHANGED`, carrying only that reason in Phase 10's closed `details`; the web re-reads the request to show who holds it now. Two analysts picking up at once therefore never overwrite each other: one succeeds and the other is told. A change that names the current assignee is a no-op that succeeds and writes no event.

**The log.** `assignmentLog` holds the envelope `{ schemaVersion: 1, events: [...] }`. Each change appends exactly one event:

```text
{ "schemaVersion": 1, "action": "pick-up" | "assign" | "reassign" | "unassign", "by": "<documentId>", "at": "<ISO 8601>", "from": "<documentId>" | null, "to": "<documentId>" | null, "reason": "<at most 500 characters>" | null }
```

`by`, `from` and `to` are IdamBox User documentIds; `from` and `to` are null where nobody held, or holds, the request. The log holds at most 1,000 events. At the cap a change is refused with 409 `HISTORY_UNAVAILABLE` (Phase 10's code) and nothing is written, so no assignment change is ever applied without its audit record.

**The 06.8 posture.** The log is append-only: no code path removes, reorders or rewrites an earlier event. Reads parse it closed (unknown keys, actions and versions are invalid) and fail safe: a malformed log projects as "history unavailable" and never denies the read of the request. The log is never read by an authorisation decision. Gates read `assignedAnalyst` only, so a damaged history can never move who is accountable.

## Eligibility and Separation of Duties

**One eligibility predicate.** `isEligibleAssignee` decides, in one module, who may hold a request. An eligible assignee is an IdamBox User who:

- is active;
- holds the human Security Analyst role and its analyst grants;
- does not hold the Security Analyst Agent role (G-1: a service identity is never assignable);
- did not raise the request.

**The eligible-analyst read.** `GET /api/v1/assessment_requests/{requestId}/assignable_analysts` returns exactly that set for the request, as `documentId` and `displayName` only, searchable by name and bounded at 50 people. A picker therefore never offers a person the operation would refuse. Naming anyone else as the assignee (an inactive user, a Requestor-only user, the service agent, the request's own requestor) is refused with 409 `ASSIGNEE_NOT_ELIGIBLE`.

**G-1 for the acting analyst.** On a request they raised, a Security Analyst is its Requestor for every control this extension adds. They take no assignment action on it (pick up, assign, reassign or unassign, whoever the target), they cannot read its eligible-analyst list, and they cannot change a note's AI-input mark on it. Each attempt is refused with 403 and the closed reason `OWN_REQUEST`: an identity-relative refusal, which no reload or state change resolves, so it stays in the 403 family (2026-10-01 orchestrator confirmation). Choosing one's own assessor is the conflict G-1 removes; it does not stop the analyst contributing edits.

**The acting analyst is an eligible person too** (code review WR-101, 2026-10-09). The human-only guard admits anyone holding the operation through the human Security Analyst role, so a misconfigured user who also holds the Security Analyst Agent role would pass it. The policy therefore records `eligibleHumanAnalyst` (the human grant, held by a user `isEligiblePerson` accepts), and only that caller takes an assignment action or reads the eligible-analyst list: anyone else is refused with 403 and no reason, before the body or the request is read, with nothing written. The request read, the review queue and the questionnaire and assessment reads' request summary offer an action or a pick-up from the same fact, so nothing is offered that the operation would refuse.

Phase 22's Admin holds no analyst grants and is therefore never eligible.

## Change Rules

- **Only on a submitted request.** An assignment change on a draft is refused with 409 `REQUEST_NOT_SUBMITTED` (reused from Phase 10): a draft is not in the analysts' scope.
- **A return to draft keeps the assignment.** The Phase 06.1 revert does not touch the four facts, and nobody changes them while the request is a draft, so the same analyst stays accountable when it is resubmitted.
- **Before release** (`submitted`, `questionnaire-in-progress`, `risk-assessment-drafted`, `under-review`) every action is allowed.
- **After release** (`approved`, and `closed` from Phase 17.1) the request can be reassigned but not unassigned: unassignment is refused with 409 `ASSIGNMENT_REQUIRED`, so released work never loses its accountable analyst.
- **Requests released before Phase 13** have no assignee and can be picked up or assigned.
- **Editing stays non-exclusive** (decision 10). No questionnaire, assessment, Risk or control mutation checks the assignment. Any eligible human Security Analyst may take any of the four actions on any request they may act on; there is no lead role.

## The Assigned Analyst

`assertAssignedAnalyst(request, caller)` is the one server-side predicate for steps reserved to the assigned analyst. It holds when the caller:

- is the request's current `assignedAnalyst`;
- is still eligible under `isEligibleAssignee` at the moment of use;
- reaches the operation through the human Security Analyst grant.

It refuses with a closed reason: 409 `REQUEST_UNASSIGNED` when nobody is assigned (a record-state refusal: an eligible viewer can pick the request up), and 403 `NOT_ASSIGNED_ANALYST` when someone else is (an identity-relative refusal). Both reasons are defined in code now and published in the API contract by Phase 17.1, when a route first returns them.

In Phase 13 the predicate is built and unit-tested and gates nothing new: the v1 release stays open to any human Security Analyst until Phase 17.1 replaces it (G-13), and editing stays non-exclusive.

## People Projection

The assignee, the assigner and every actor in the history cross the API as `documentId` and `displayName` only: never email, username, names, account status, external subject or roles. Analysts see the current assignee, who assigned them and when, and the history (who, when, from, to and reason). The Requestor sees the current assignee's display name alone.

None of these relations can be reached through a caller's `populate`. The request read (`GET /api/csrm-assessment-requests/{id}`) limits the caller's `populate` to `informationSystems`, `informationAssets`, `questionnaire` and `assessment`, and drops `*` and every IdamBox User relation. `revertedBy` is projected the same way, as `documentId` and `displayName`, because today `populate=revertedBy` returns the reverting user's email, username and external subject to the Next server, and `populate=*` does the same for `requestor` and `sponsor` (13-RESEARCH §D). The Next server's parser strips those keys, so no browser receives them, but the new relations would widen the same least-privilege break, and this extension closes it.

## What This Extension Does Not Add

- **No lead role.** Any eligible human Security Analyst assigns (decision 10).
- **No assignment entity.** The history lives in `assignmentLog` on the request, as 06.8's governance log lives on the questionnaire.
- **No edit restriction.** Editing stays non-exclusive; only Phase 17.1's reserved steps read the assignment.
- **No backfill.** Requests created or released before Phase 13 stay unassigned with no history (D-11).
- **No notification.** This phase records; Phase 19.1's notification centre (G-19) reads the log to send decision 18's "assignment" event (D-12).
- **No filter by a named analyst.** The review queue's `assignee` filter takes only `me` or `unassigned`; a filter or sort by a named analyst is a candidate for Phase 21's management views.

No existing attribute, relation or enumeration value changes.

## Affected Workstreams

`apps/backend` is shared by every workstream (`.planning/PROJECT.md`, "GSD Workstreams"). On 2026-10-09 that section's workstream table lists one workstream, `csrm`, whose application (`apps/csrm`) is the only reader of `CsrmAssessmentRequest`. This extension is backward compatible for any later reader: the four attributes are optional and `private`, so no core route returns them and existing rows read as unassigned with no history; no existing attribute, relation, enumeration value or grant changes; and the role-function catalogue gains only three new API-only Functions (D-30): `function.risk_assessment_requests.assignment_api` and `function.risk_assessment_requests.note_ai_input_api` for `role.security_analyst`, and `function.risk_assessment_requests.notes_api` for `role.security_analyst` and `role.requestor`. None is granted to `role.security_analyst_agent`.

Phase 13 also changes existing endpoints, separately from this extension. Each change concerns only the `csrm` workstream's application, and each is in a `csrm` plan:

- **The request read's caller `populate`** is narrowed to `informationSystems`, `informationAssets`, `questionnaire` and `assessment`, with `revertedBy` projected as `documentId` and `displayName` (D-04, plan 13-04).
- **Additive fields, buckets and filters** on the request read, the review queue, My requests, the dashboard summary and the analyst questionnaire and assessment reads (D-03 items 5 to 9).
- **The generation-job reads and retries** open to every human Security Analyst who may read the request, with the initiating analyst's display name, declared identifier bounds, and `canRetry` meaning "the job failed and this viewer may retry it" (D-18, plan 13-08). No grant changes.
- **The analyst branch of the request update** refuses to submit a request the analyst did not raise (D-20, plan 13-06). The analyst's ability to amend a request's writable fields stays.

The notes changes to existing endpoints (deleting a request that holds a note, and the AI run read's notes section) are recorded in `docs/contract-gaps/phase-13-request-notes.md`.

## Migration

The extension is additive. Strapi schema sync creates the two columns and the two link tables; no migration file accompanies it, following the Phase 06.1, 06.7, 06.8 and Phase 12 precedent, and `apps/backend/database/migrations/` stays empty. Proof requires:

- a fresh test database reading legacy requests as unassigned with no history;
- `PRAGMA table_info` on both link tables, listing `csrm_assessment_request_id` and `idambox_user_id`, and on `csrm_assessment_requests`, listing `assigned_at` and `assignment_log`;
- the development database showing both link tables and both columns after the orchestrator's next Strapi start;
- the content-type freeze check since `PHASE_13_BASE` listing exactly the approved schema files.

## Audit Semantics and Limitation

`assignmentLog` follows the request's retention and is never deleted: no CSRM workflow removes it or an event in it. It is scoped to one request and readable only through the request's own projections; no unscoped history endpoint is introduced, and a cross-aggregate audit store stays out of scope.

The compare-and-set race is proven on SQLite, where knex's single connection serialises the transaction (the lock statement compiles to a plain `SELECT` there). That test proves the serialised outcome, not the lock (code review WR-201, 2026-10-09): the lock's in-process tail is proven in `request-lock.unit.test.ts`. PostgreSQL's row lock stays unproven until R-08-37 runs the Strapi suites on PostgreSQL; its checklist gains the constructs this extension relies on: `FOR UPDATE` before the read of the current assignee, and queries inside the lock bound to the transaction (Document Service and query-builder calls through Strapi's async context; raw knex through `.transacting(trx)`).

## Later Phases

- **Phase 19.1** sends decision 18's "assignment" event (`request-assigned`) from the log, and factors the "active and not the service agent" part of `isEligibleAssignee` into its shared eligible-person module (19.1-CONTEXT D-07) unless this phase already built it as one.
- **Phase 17** adds the G-11 exclusion to `isEligibleAssignee` (not a nominated risk owner or a named executive approver of the request's assessment) and refuses unassignment from the first release for response.
- **Phase 17.1** gates Mark reviewed, Submit final assessment, recall, and release and close with `assertAssignedAnalyst`, publishes `REQUEST_UNASSIGNED` and `NOT_ASSIGNED_ANALYST`, and refuses unassignment while an acceptance round is open.
- **Phase 20** decides the fallback for events addressed to the assigned analyst on requests released before Phase 13, which have none; the releasing analyst (`approvedBy`) is the suggested default.
- **Phase 21** reads time to pick-up and reassignments from the log.
- **Phase 22** may make auto-assignment on an analyst's first workflow action a setting.

None needs another assignment schema change.

## Approval

Status: **approved by the pilot on 2026-10-09** (G-6), for the four attributes exactly as the "Compatibility Extension" section states them.

What the pilot checked:

- **JDL** (`docs/references/idambox-datamodel.jdl`): `CsrmAssessmentRequest` today relates to `IdamBoxUser` only through `requestor`, `sponsor` and `revertedBy`, none of which names the accountable analyst, and no JDL entity carries an assignment. The extension adds optional, private, one-way attributes in JDL terms, changes no existing attribute, relation or enumeration value, and adds no competing entity.
- **API contract** (`docs/references/specification.json`): the new operations (`PUT …/assignee`, `GET …/assignable_analysts`) are additive. The changes to existing endpoints are listed in "Affected Workstreams": the narrowed caller `populate`, the additive fields, the generation-job access and the D-20 refusal. Each is in a `csrm` plan, and `csrm` is the only reader. The new closed reasons join Phase 10's single list.
- **Role-function catalogue**: three API-only Functions are added (D-30), none is granted to `role.security_analyst_agent`, and the assignment operation joins the human-analyst-only operations. Separation of duties holds both ways (G-1, `OWN_REQUEST`), and the service identity is never assignable.
- **AGENTS.md**: every rule is enforced in Strapi against the resolved IdamBox User and never branches on the auth mode. Navigation grants nothing. People cross the API as `documentId` and `displayName` only, and the record closes an existing populate leak rather than widening it.
- **CONTEXT.md and 13-CONTEXT.md**: "Assigned analyst" matches the glossary. Decision 10 holds: one accountable assignee, non-exclusive editing, every change recorded. `assertAssignedAnalyst` is the one predicate Phase 17.1 will gate on, built now and gating nothing.
- **Audit**: one writer, compare-and-set under the request lock, an append-only, capped, fail-safe log that no authorisation decision reads, and no change applied without its audit record. PostgreSQL locking is carried to R-08-37.

Pilot correction made with this approval: the notification references now name Phase 19.1, which G-19 gave the centre and the "assignment" event. They had read Phase 17. Phase 13 still sends nothing.
