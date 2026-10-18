# Phase 21: Management dashboards and metrics - Research

**Researched:** 2026-10-01
**Domain:** the stage history (derivation, acts and recorder), portable SQL for the trend, ageing and stage samples on SQLite and PostgreSQL, the AI run reads, and the drill-down read
**Confidence:** HIGH for today's acts, schemas, lock helpers and Strapi's column handling (read this session). MEDIUM for the round, decision, contest and history shapes of Phases 12, 13, 16, 17, 17.1, 17.2 and 20 (cited from their plans and research, not yet code). LOW where marked `[ASSUMED]`.

**Scope (stage2-rules §3a).** This file answers only the CONTEXT's "Open for research" items and the spawn prompt's three questions, then adds the Validation Architecture:
- the stage derivation's edge cases and the full list of stage-changing acts, so the one recorder sits inside each;
- what happens to a deleted draft's rows;
- the "as at" month-end rule's split between SQL and code, with closures that have no Phase 20 row;
- the latest-row join behind the queue's `stage` and `ageBand`, with working-day cut-offs, and every new construct for R-08-37's checklist;
- how interrupted runs carry `jobId` and `attempt`, and grouping across retries;
- the drill-down read's shape.

Everything else is cited, not re-surveyed:
- **Phase 7:** `docs/contract-gaps/phase-07-derived-insights.md` (item 9's construct list) and today's insight services.
- **Phase 11:** plans 11-15 and 11-17 (`treatment-due-state.ts`, the queue and the register parity tests).
- **Phase 12:** `12-RESEARCH.md` and plan 12-01 (the run record).
- **Phase 13:** plan 13-03 (`withRequestLock`), plan 13-06 (the core delete override).
- **Phase 16:** `16-RESEARCH.md` and plan 16-01 (the risk history entity; the static delete guard; `REQUEST_HAS_ASSESSMENT`).
- **Phase 17:** `17-RESEARCH.md` §F, §G and Pitfall 8 (rounds, the request-lock-first order); plan 17-03 (`deriveAssessmentStage`).
- **Phase 17.1:** `17.1-RESEARCH.md` and `17.1-PATTERNS.md` (submit, recall, release and close).
- **Phase 17.2:** `17.2-RESEARCH.md` (the shared reopening path).
- **Phase 18:** `18-RESEARCH.md` (the scale reader).
- **Phase 19:** plan 19-05 (`/v1/risks/export` before `:riskId`; `underlyingRead`).
- **Phase 19.1:** plan 19.1-03 (the in-transaction request row lock in `notify`).
- **Phase 20:** `20-RESEARCH.md` (history kinds, lock order, Pitfall 6).

## Summary

The stage is a pure function of facts that every act already loads: the request's status and `revertedAt`, the questionnaire's existence, `releasedAt` and answer state, and the assessment's release triple, gate fact and open round. The rework/drafting split needs no round read: Phase 17's gate fact `sharedWithParticipantsAt` is written by the first round of either kind and never cleared. That makes `rework` exactly "gate set, no round open, not released". Twelve acts can change the stage. Seven are served today and five come from Phases 17 to 17.2. A thirteenth, Phase 22's manual start, never changes it under this vocabulary but calls the recorder anyway (G-20).

Three findings change the recorder's shape from what D-07 says literally:
1. **It must compare against the stage before the act** when a request has no rows. Otherwise the first act on a request that predates deployment writes a false entry time whenever the act leaves the stage unchanged, for example Phase 22's manual start or a field edit on the wrapped update.
2. **It must take its time from the act** (`at`), never from the clock, so that round episodes equal `openedAt` and `closedAt` (D-05's test) and the release row equals `approvalDate`.
3. **Submission runs in no transaction today.** The core `PUT` calls `prepareRequestorUpdate` and then `documents.update` outside any lock. Phase 21 must wrap it in `withRequestLock` before the recorder can run "inside its own transaction".

The month-end trend splits cleanly. SQL reads a bounded candidate set over typed columns only: release triple, `withdrawn_at`, `closure_date`, the report filters and the scope. The Query Engine reads the candidates' `residual-reviewed`, `risk-closed` and `risk-reopened` history rows, because Strapi's field layer parses JSON on both dialects while a raw knex read does not. A pure fold then decides each risk at each month end. The current point is the register's live count, so D-14's equal total holds by construction, and an oracle proves the fold agrees with it at "now".

**Primary recommendation:**
- Build one `withStageRecording` wrapper. It takes the request row lock in the act's transaction, derives "before", runs the act, derives "after", and appends when `after ≠ (latest row ?? before)`.
- Call it from twelve act sites, plus Phase 22's manual start.
- Refuse deleting a request with rows (`REQUEST_HAS_STAGE_HISTORY`).
- Do all date arithmetic and JSON in code over bounded reads, with SQL limited to typed comparisons against bound `Date` cut-offs.
- Serve every drill-down through one `GET /api/v1/reports/{reportKey}/records`.

## User Constraints (from 21-CONTEXT.md)

D-01 to D-29 in `21-CONTEXT.md`, with `<operator_decisions>`, `<contract_gaps>`, `<authorisation>` and `<seams>`, are locked and cited by number here, not restated (stage2-rules §3a). The UI-SPEC binds with its four orchestrator amendments: proposal-outcome figures count runs; bar charts become labelled rows below 768px; `Over 10 working days`; the direction's type scale.

### Open for research (verbatim from the CONTEXT)
- The stage derivation over the 06.1, 06.8, Phase 3, 17, 17.1 and 17.2 facts and its edge cases (a questionnaire returned after release; a recall with no earlier response round), and the exact list of acts that can change it.
- What happens to a deleted draft's rows.
- The as-at rule's split between SQL over typed columns and a bounded read of the review rows' JSON; closures recorded before Phase 20 without a row.
- The latest-row join behind the queue's `stage` and `ageBand` filters, with working-day cut-offs bound as dates; every new construct for R-08-37's checklist.
- How interrupted runs carry `jobId` and `attempt`, and grouping across retries.
- The drill-down read's shape within 07 D-13 and D-14: a sub-resource of the report key or a sibling path.

### Planner's Discretion and Deferred Ideas
As in `21-CONTEXT.md` ("Planner's Discretion", `<deferred>`), unchanged.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-04 | Each audience has a metric set that answers its questions, with every figure opening its records | R9 (failed runs and grouping), R10 (one drill-down read whose total equals the figure), R7 (the Requestor's time in stage through the shared latest-row helper) |
| DASH-05 | Trends, a heat map, cycle times and ageing come from recorded history | R1 to R5 (the stage history and its writers), R6 (the as-at trend), R7 (ageing), R8 (episodes, percentiles, time to release), R11 (portability) |
</phase_requirements>

## Project Constraints (from AGENTS.md and the Stage 2 rules)

- Strapi is the API boundary, and the web reads only through `apps/csrm/src/lib/api` from server code. Authorisation runs in Strapi against `ctx.state` and never branches on the auth mode.
- Each content-type change starts with its contract-gap record and a checkpoint at which the executor stops. The pilot approves under G-6.
- Contract changes update the specification, both catalogue copies and `served-operations.json`, then `api:generate` and `api:check`.
- Every grant and refusal is proven in Strapi integration tests, the web gets Vitest units, and Playwright runs at 1440px and 375px and leaves the tree clean.
- No new dependency (D-16). No Keycloak. Leave `apps/backend/types/generated/*.d.ts` and `example-risk-assessment-questions/` alone. Never write the pre-rename app paths.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stage derivation and recording | API / Backend (pure module + recorder in each act's transaction) | Database (append-only rows) | The act's transaction is the only place both the facts and the rollback are known |
| Trend, ageing, stage samples, AI health | API / Backend (pure folds over bounded reads) | Database (typed filters, bound cut-offs) | R-08-37: no dialect-specific date or JSON SQL |
| Drill-downs and figure totals | API / Backend (one function builds figure and list) | — | 07 D-13, X-10: equal totals by construction |
| Formatting, charts, matrix | Browser / Client (Server Components) | — | The server computes and links; the web formats (07 D-19) |

## Standard Stack

No package is added. The work uses the installed `@strapi/strapi` and `@strapi/database` 5.51.0, which provide the Document Service, the Query Engine (`strapi.db.query`), knex through `strapi.db.connection`, and `strapi.db.transaction` with AsyncLocalStorage reuse [CITED: 17-RESEARCH.md line 399, from `@strapi/database` 5.51.0 `dist/index.js:61-62`]. It also reuses the existing insight modules `report-math.ts`, `utc-date.ts` and `insight-constants.ts` [VERIFIED: read this session].

## Package Legitimacy Audit

Not applicable: no external package is installed. Packages removed: none. Packages flagged: none.

## Settled Research Items

### R1. The stage derivation and its edge cases (D-06)

**Inputs** (one `StageFacts` value, loaded by the recorder in the act's transaction):

| Fact | Source | Provenance |
|---|---|---|
| `requestStatus` | request, enum `"draft", "submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review", "approved", "closed"` | [VERIFIED: `csrm-assessment-request/content-types/csrm-assessment-request/schema.json:89-101`] |
| `returnedToDraft` | request `revertedAt` (datetime) is set | [VERIFIED: same file `:78-80`]; `revertRequestToDraft` writes `requestStatus: "draft", submittedDate: null, … revertedAt` [VERIFIED: `request-workflow.ts:107-115`] |
| `questionnaireExists`, `questionnaireReleased` | questionnaire present; `releasedAt` non-empty | [VERIFIED: `request-lifecycle.ts:69-70`] |
| `answersSubmitted` | `questionnaireState(questionnaire) === "submitted"`, meaning every active question has a submitted answer | [VERIFIED: `questionnaire-scope.ts:210-214`] |
| `assessmentExists`, `released` | assessment present; `isReleased` (status `approved` with the release facts), or request status `approved` or `closed` (17.1 D-45) | [VERIFIED: `assessment-workflow.ts:121-125`; `collection-scope.ts:52` `RELEASED_REQUEST_STATUSES = Object.freeze(["approved", "closed"] as const)`] |
| `gateSet` | `sharedWithParticipantsAt` on the assessment (Phase 17 D-11) | [CITED: 17-CONTEXT D-11; 17-RESEARCH line 451] |
| `openRoundKind` | the assessment's round with `closedAt` null: `response` or `acceptance` | [CITED: 17-RESEARCH line 676; 17.1 D-22] |

**The function** (first match wins):

| # | Condition | Stage |
|---|---|---|
| 1 | `requestStatus === "draft"` | `returned-to-draft` if `revertedAt` is set, otherwise **no stage** (a never-submitted draft has no row) |
| 2 | `released` | `released` |
| 3 | `assessmentExists` and `openRoundKind === "response"` | `response` |
| 4 | `assessmentExists` and `openRoundKind === "acceptance"` | `acceptance` |
| 5 | `assessmentExists` and `gateSet` | `rework` |
| 6 | `assessmentExists`, or `answersSubmitted` | `drafting` |
| 7 | `questionnaireReleased` | `questionnaire` |
| 8 | otherwise | `intake` |

Rows 3 to 6 are Phase 17's `deriveAssessmentStage` mapped one to one: `released-for-response` → `response`, 17.1's `awaiting-acceptance` → `acceptance`, `with-security-analyst` → `rework`, `not-shared` → `drafting` [CITED: 17-03-PLAN line 180]. The function should call it rather than restate it, so 17.1's and 17.2's widenings reach the stage history unchanged.

**Edge cases, each a unit-test row:**
- **A questionnaire returned after release.** Return to review requires the request in `RELEASABLE_REQUEST_STATUSES = Object.freeze(["submitted", "questionnaire-in-progress"] as const)` and no assessment [VERIFIED: `questionnaire-governance-workflow.ts:35, 237-243`]. It clears `releasedAt` and turns submitted answers back to drafts in one transaction [VERIFIED: same file `:316-329`, `returnAnswersToDraft`]. So it moves `questionnaire` → `intake` or `drafting` → `intake`, and it can never happen once an assessment exists, so never after a round. Re-release gives a second `questionnaire` episode. Stage samples count both episodes and do not merge them.
- **A recall with no earlier response round.** "Submit final assessment" writes the gate when no round ever did (17.1 D-21), so after the recall, row 5 gives `rework`. This is the same as after any closed round: the gate is set exactly when some round was ever opened. A unit test asserts `gateSet ⟺ any round exists` over the fixtures.
- **A returned-to-draft request that is resubmitted.** `revertedAt` stays set, but row 1 applies only to `draft`, so it reads `intake` again. Time to release runs from the first `intake` row (D-11).
- **A never-submitted draft:** no stage and no row. It is never in ageing (07 D-29).
- **A `closed` request** reads `released` (G-13). A legacy assessment released before Phase 17, with no gate, reads `released` too.
- **Answers submitted while `releasedAt` is null** cannot happen. Return to review drafts the answers in the same transaction, so `answersSubmitted` implies released. Row 6 still puts `answersSubmitted` before row 7, so any malformed record reads `drafting`, never `questionnaire`.
- **An open acceptance round in which every risk is decided** stays `acceptance`, although the holder is now the analyst (17.1 D-49). The CONTEXT's "Not added: holder changes within a stage" keeps it that way, and D-10's "time from a round's opening to each risk's completing decision" measures the decided tail.
- **Questionnaire generation and regeneration never change the stage.** Generation needs request status `submitted`. It replaces an unanswered questionnaire's questions and leaves `releasedAt` as it was [VERIFIED: `questionnaire-generation-workflow.ts:31-35`]. The stage stays `intake` (unreleased) or `questionnaire` (released).

### R2. The acts that can change the stage (D-07)

**Served today** [VERIFIED: `docs/references/served-operations.json`, the write operations on requests, questionnaires and assessments, enumerated this session]:

| # | Act (cause, proposed) | Code site | From → to | `at` (the act's own instant) | Lock today |
|---|---|---|---|---|---|
| 1 | `request-submitted` | `PUT /api/csrm-assessment-requests/{id}` → `prepareRequestorUpdate` (`submittedDate`) | none or `returned-to-draft` → `intake` | `submittedAt` passed to `prepareRequestorUpdate` | **none**: plain `documents.update` [VERIFIED: `controllers/csrm-assessment-request.ts:161-185`] |
| 2 | `request-returned-to-draft` | `POST …/revert_to_draft` → `revertRequestToDraft` | `intake` → `returned-to-draft` | `revertedAt` | `withRequestLock` after 13-03 [CITED: 13-03-PLAN line 127] |
| 3 | `questionnaire-released` | `POST /v1/questionnaires/{id}/release` → `releaseQuestionnaire` | `intake` → `questionnaire` | `releasedAt` | governance tail + questionnaire row lock [VERIFIED: `questionnaire-governance-workflow.ts:186`] |
| 4 | `questionnaire-returned-to-review` | `POST …/return_to_review` → `returnQuestionnaireToAnalystReview` | `questionnaire` or `drafting` → `intake` | the act's `now` | same |
| 5 | `answers-submitted` | `POST …/submit` → `submitQuestionnaire` | `questionnaire` → `drafting` | the batch's submission instant | questionnaire tail + row lock [VERIFIED: `questionnaire-workflow.ts:205-212`] |
| 6 | `answers-returned-to-draft` | `POST …/revert_to_draft` (questionnaire) → `revertQuestionnaireToDraft` | `drafting` → `questionnaire` (needs `questionnaire-in-progress` and no assessment) | `revertedAt` | same [VERIFIED: `:214-222, 278-280, 358-385`] |
| 7 | `released-and-closed` | `POST /v1/risk_assessments/{id}/release`, which 17.1 D-42 turns into release and close in place | `acceptance` → `released` | `approvalDate` | request lock, then the assessment lock (17.1-PATTERNS line 199) |

**Added by Phases 17 to 17.2** (all under `withRequestLock` first, then the assessment serialisation; 17-RESEARCH §F and Pitfall 8):

| # | Act | Planned site | From → to | `at` | `round` |
|---|---|---|---|---|---|
| 8 | `response-round-opened` | `response-rounds.ts` open (17 D-09) | `drafting` or `rework` → `response` | round `openedAt` | the opened round |
| 9 | `response-round-closed` | `response-rounds.ts` close (17 D-12) | `response` → `rework` | round `closedAt` | the closed round |
| 10 | `final-assessment-submitted` | 17.1 D-21 | `drafting` or `rework` → `acceptance` | round `openedAt` | the acceptance round |
| 11 | `acceptance-round-recalled` | 17.1 D-25, through `closeAcceptanceRoundAndReopen` | `acceptance` → `rework` | round `closedAt` | the round |
| 12 | `acceptance-round-returned` | 17.2 D-11, the same inner function [CITED: 17.2-RESEARCH line 269] | `acceptance` → `rework` | round `closedAt` | the round; `enteredBy` is the sending participant |

Release and close (row 7) also sets `round` to the completed acceptance round. Phase 22's manual start (G-20; 22-CONTEXT D-23) calls the recorder with cause `manual-start`, which its record amends into the vocabulary. Under R1 it is always a no-op: a manual questionnaire is unreleased, so the stage stays `intake`, and a manual draft needs submitted answers, so it stays `drafting`.

**Acts verified not to change the stage**, so they do not call the recorder:
- answer saves (`PATCH …/answers`), which only move `submitted` → `questionnaire-in-progress`, inside `questionnaire`;
- question add, edit and delete, which happen in analyst review only;
- questionnaire and assessment generation and their retries;
- assessment edits and the accepted-edit transition;
- risk create and update, withdrawal, bulk edits and imports (18);
- assignment (13), notes (13) and attachments (14);
- response saves and submissions (17);
- decisions and approvals (17.1), contest points and answers (17.2);
- every Phase 20 act, all of which are post-release and risk-level.

The coverage test enumerates `STAGE_CAUSES` against this table (R3).

**Two acts need restructuring:**
- **Act 1 (submit).** Wrap the whole request `update` controller in `withRequestLock`, and re-read `persisted` inside it. This also closes today's race in which two concurrent submits both pass the `draft` check. Field-only edits by an analyst run through the same wrapper and record nothing.
- **Acts 3 to 6 (the questionnaire acts).** Take the request row lock as the first statement in their transaction, before the questionnaire row lock, resolving the request id through the questionnaire's request link, which never changes. This keeps "request lock first, always" (17-RESEARCH Pitfall 8; 20-RESEARCH Pitfall 6). It also removes the inversion 19.1's `notify` already creates when answer submission locks the questionnaire and then the request row [CITED: 19.1-03-PLAN line 102, "take the request row lock with the `lockAssessmentRequest` shape"].

### R3. The recorder (D-07)

- **Shape:** `withStageRecording(strapi, { requestDocumentId, cause, actorDocumentId, at, roundDocumentId? }, work)`, called inside the act's transaction. It throws when `strapi.db.inTransaction()` is false, as 19.1's `notify` does.
- **Steps:**
  1. Take the request row lock with 19.1's shape: `queryBuilder(REQUEST_UID).select(["id"]).where({ documentId }).forUpdate().transacting(trx)`. Never call `withRequestLock` here: its in-process tail is "never nested for one request" [CITED: 13-01-PLAN line 107].
  2. Load the facts and derive `before`.
  3. Run `work()`.
  4. Load the facts again and derive `after`.
  5. Read the latest row (`sequence` descending, one row).
  6. Append when `after !== null && after !== (latest?.stage ?? before)`, with `sequence = (latest?.sequence ?? 0) + 1`.
- **Why "before":** a request that predates deployment has no row. Comparing only with the latest row would append the unchanged stage at `at`, a false entry time, on any act that changes nothing (manual start; an analyst field edit through act 1's wrapper). With "before", the first row is written only when the stage really changes, so its entry time is true (D-08).
- **Why "latest" too:** if some act ever missed the recorder, the next act repairs the latest row to match the facts. The oracle test still fails on the miss, so it is caught.
- **`at` comes from the act.** The act passes the same `Date` it writes as `openedAt`, `closedAt`, `releasedAt`, `submittedDate`, `revertedAt` or `approvalDate`. D-05's round-episode test and D-11's equality then hold exactly.
- **Rollback:** the row is written through the Document Service or Query Engine inside the ALS transaction, so a failed act leaves no row.
- **Static guards:**
  - no source calls `.delete(`, `deleteMany`, `update(` or `updateMany` on the stage-history UID outside the recorder (append only) and the fixture (R5), following 16-RESEARCH line 420's guard;
  - no policy or workflow gate imports the stage-history read helpers (D-05: no gate reads it).

### R4. A deleted draft's rows

The core delete is analyst-only and API-only. It deletes any request today, whatever its status [VERIFIED: `operations.ts` `delete: "DELETE:/api/csrm-assessment-requests/{id}"`; `csrm-authorization.ts:399-419`, ownership only]. Strapi 5 removes relation link rows rather than cascading to related documents [CITED: 16-RESEARCH line 421, marked ASSUMED there], so a transition would survive as an orphan with no request.

**Recommendation:**
- Refuse the delete with 409 `REQUEST_HAS_STAGE_HISTORY` when any row exists, in the controller's `delete(ctx)` override beside `REQUEST_HAS_NOTES` (13-06), `REQUEST_HAS_ATTACHMENTS` (14) and `REQUEST_HAS_ASSESSMENT` (16).
- A never-submitted draft has no row and stays deletable. A draft returned after submission keeps its rows and is refused.
- This keeps rows append-only and following the request's retention, so no figure changes after the fact.
- A mounted test deletes a never-submitted draft (200) and refuses a returned draft (409, rows intact). There is no web caller.

### R5. The fixture's time-relative rows (D-28)

`seed-analyst-insights.ts` reconciles its records in place on each start so that relative dates stay relative [VERIFIED: `seed-analyst-insights.ts:109-146, 327-333`]. Immutable rows cannot follow "today" otherwise.

**Recommendation:**
- The fixture, under `IDAMBOX_SEED_CSRM` and the development identity, reconciles its own requests' transition rows by `(request number, sequence)` with `strapi.db.query(UID).update` of `enteredAt`. In the same pass it updates the facts those rows mirror (`submittedDate`, round `openedAt` and `closedAt`, `approvalDate`), so the oracle holds.
- Record 1's write discipline names this as the one exception, and the static guard allow-lists only the seed file.
- The fixture also needs residual reviews and closures in past months. Those are Phase 16 history rows, whose record says rows are never updated. So record 1's amendments also need a dated amendment to `phase-16-risk-withdrawal-and-history.md` naming the fixture as the same exception. The CONTEXT's amendment list does not include it (Open Question 2).

### R6. The "as at" rule: SQL and code (D-13)

**Instants.** The point for month m is "as at" the first instant of month m+1, exclusive: an event counts when its time is `< E`. `E` is `throughputMonths(...)[m].end` [VERIFIED: `report-math.ts:223-235`]. For a `date` column the test is `value < utcDate(E)`, that is, on or before the month's last day. The current partial point is not folded (below).

**Read 1, knex over typed columns only** (bounded, `Number()` counts, `Date` bindings):
- Risks of released assessments (`releasedAssessments`, the triple) with `a.approval_date < asOf`.
- `r.withdrawn_at IS NULL`. Withdrawal is pre-release only (16 D-14; 20 D-15), so it never changes after release.
- `r.closure_date IS NULL OR r.closure_date >= ?` bound to the period's first month start. A risk whose latest closure predates the period was closed for the whole period. A reopened risk has `closure_date` null, so it stays a candidate.
- The register scope (`applyDisclosableParent`) and Phase 20's report filters through the request join.
- Columns: risk id, documentId, risk number, live `residual_rating`, `approval_date`, `closure_date`.
- First a count. Over `TREND_RISK_CAP` (proposed 5,000, beside `THROUGHPUT_SAMPLE_CAP`), the whole trend is "Not available" (07 D-03: exact or nothing).

**Read 2, the Query Engine** for the candidates' history rows:
- `strapi.db.query("api::csrm-risk-history-event.csrm-risk-history-event").findMany({ where: { kind: { $in: ["residual-reviewed", "risk-closed", "risk-reopened"] }, occurredAt: { $lt: asOf }, risk: { id: { $in: chunk } } }, select: ["kind", "occurredAt", "changes"], populate: { risk: { select: ["id"] } }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] })`, in id chunks of at most 1,000 (item 9's bound).
- Kinds: Phase 20 D-19. Schema: 16-01-PLAN line 111, `occurredAt` (datetime) and `changes` (json).
- Over `TREND_HISTORY_ROW_CAP`, "Not available".
- **Why the Query Engine, not knex:** Strapi maps `json` to `jsonb` [VERIFIED: `@strapi/database/dist/schema/schema.js:167-172`]. Its `JSONField.fromDB` parses strings [VERIFIED: `dist/fields/json.js:15-26`]. A raw knex read bypasses `fromDB`, returning text on SQLite and an object from the `pg` driver [ASSUMED for `pg`]. The Query Engine gives one shape on both, and no JSON operator reaches SQL (R-08-37).

**The pure fold** (`trend-as-at.ts`), per risk and instant `E`:
- **Released:** `approval_date < E`.
- **Closed at E:**
  - the latest `risk-closed` or `risk-reopened` row before `E` decides;
  - with no such row before `E`, but a first later row that is `risk-reopened`, the risk was closed before it: from that row's `changes` entry `{ field: "closureDate", from }` day if present, otherwise closed;
  - with no closure row at all, a set `closure_date` counts from its UTC day (D-13).
- **A future-dated `closure_date` with no row.** v1 lets the analyst write `closureDate` on a mutable assessment [VERIFIED: `assessment-workflow.ts:575-581`]. Count it from `min(closureDate, today)`, so that the fold at "now" equals the register's live `closure_date IS NULL` predicate. Past points before that day count it as open.
- **Rating at E:**
  - the `to` of the latest `residual-reviewed` row before `E` whose `changes` holds a `residualRating` entry;
  - otherwise the `from` of the first later such row;
  - otherwise the live value;
  - then `normaliseRating`, with null meaning `notRated` [VERIFIED: `report-math.ts:147`].
  - A review that left the rating unchanged may have no `residualRating` entry, and is skipped (20 D-14).
- **A malformed `changes`** (fail-safe, 16 D-18's posture) makes the trend "Not available" rather than guessing.

**The current point** is the register's live count with `state=open`, `stage=released` and the rating (Phase 11 D-40), read by the same SQL the register list uses. D-14's link is then equal by construction. The oracle test asserts `fold(now) == live count` per rating over the fixtures.

**The drill-down for a past point** runs the same two reads and the fold, keeps the risks matching `(point, rating)`, sorts by risk number and paginates in code. Its total is the figure by construction.

### R7. The latest-row join, ageing and working days (D-12, D-17)

**One shared helper** `latestStageRow(knex)` for the queue, the dashboard ageing and the Requestor projections. It is portable and uses no window functions:

```ts
// Source: pattern of review-queue-repository.ts link joins (csrm_assessments_assessment_request_lnk, lines 98-111)
function latestStageRows(connection: Knex) {
  return connection.queryBuilder()
    .from("csrm_stage_transitions as st")
    .join("csrm_stage_transitions_request_lnk as stl", "stl.csrm_stage_transition_id", "st.id")
    .whereNotExists((later) => later
      .from("csrm_stage_transitions as st2")
      .join("csrm_stage_transitions_request_lnk as stl2", "stl2.csrm_stage_transition_id", "st2.id")
      .whereRaw("?? = ??", ["stl2.csrm_assessment_request_id", "stl.csrm_assessment_request_id"])
      .whereRaw("?? > ??", ["st2.sequence", "st.sequence"])
      .select("st2.id"))
    .select("stl.csrm_assessment_request_id as request_id", "st.stage as stage", "st.entered_at as entered_at");
}
// queue: .leftJoin(latestStageRows(connection).as("ls"), "ls.request_id", "rq.id")
```

The table and link names follow Strapi 5's `{collection}_{attribute}_lnk` pattern seen in `csrm_assessments_assessment_request_lnk` [VERIFIED: `review-queue-repository.ts:98`]. The new names are `[ASSUMED]` until the schema exists, and record 1 fixes them, as 13-02 did.

**Working days.** `wd(entered, today)` is the number of Monday-to-Friday UTC dates `d` with `enteredDate < d ≤ today`. Entering today gives 0. Entering on Friday or Saturday gives 1 on the following Monday. `wd` never increases as the entry date moves later, so each band is an interval of entry dates. The cut-off `c_k` is the earliest date with `wd ≤ k`, computed in code by walking back from today. The SQL then binds `utcDateToInstant(c_k)` as a `Date` against `entered_at`:
- `0-2`: `entered_at >= c2`;
- `3-5`: `c5 <= entered_at < c2`;
- `6-10`: `c10 <= entered_at < c5`;
- `over-10`: `entered_at < c10`;
- `not-recorded`: `ls.request_id IS NULL`.

The bands `[2, 5, 10]` and the working week `[1..5]` live in `insight-constants.ts` (D-12). A property test checks every entry date across six weeks against a direct count, for each weekday as "today".

**Scope.** The queue's existing status sets apply: `REVIEWABLE_REQUEST_STATUSES` for open requests [VERIFIED: `collection-scope.ts:45`], so drafts and returned drafts never enter ageing (D-12). The `stage` filter takes R1's open stages, and its parser refuses `released`, `returned-to-draft` and unknown values with 400 (D-03.7).

**The projection** `inStage: { stage, enteredAt } | null` (null means "Not recorded"). The server sends the instant. The working-day count and the Requestor's calendar-day count are computed in Strapi through one function, so the queue column, the band filter and the Home figure agree.

### R8. Episodes, percentiles and time to release (D-09 to D-11)

- **Episodes** pair a row with its successor by the self-join `st2.sequence = st1.sequence + 1` on the same request link. This is portable integer arithmetic: the recorder assigns `sequence` with no gaps under the row lock.
  - Filter `st2.entered_at >= periodStart AND st2.entered_at < asOf` (bound `Date`s).
  - The request in the analyst's scope: today's status is in `REVIEWABLE_REQUEST_STATUSES` or `RELEASED_REQUEST_STATUSES`, so a request now back in draft drops out (D-25). Plus the report filters.
  - Ordered newest first `(st2.entered_at DESC, st2.id DESC)`, `LIMIT cap + 1`.
  - Durations are computed in code (no date arithmetic in SQL), and the drill-down sorts slowest first and paginates in code over that same capped sample. The list's total therefore equals the sample size the median states.
  - `released` has no episode.
  - `returned-to-draft` episodes, ended by resubmission, count for requests now in scope. Note it in the sample text.
- **Percentile:** nearest rank, `sorted[Math.ceil(0.9 * n) - 1]`, shown only when `n >= 10` (`STAGE_PERCENTILE_MIN_SAMPLE`); otherwise `null`, with `sampleSize`. The median keeps `medianDays`'s definition and its one-decimal rounding [VERIFIED: `report-math.ts:247-261`]. Extract a `elapsedDaysSample(pairs, cap)` and compute both statistics from it, so the two can never use different samples.
- **Time to release (D-11):** released assessments in the period (today's query (f) [VERIFIED: `report-repository.ts:358-375`]), left-joined to a subquery `MIN(entered_at)` of `stage = 'intake'` rows grouped by request.
  - `from = first intake ?? submitted_date`; `to = approval_date`.
  - The recorder writes the `released` row at `approvalDate` (R3), so `to` equals the released row. A test asserts it, which avoids a second join.
  - The sample note counts requests using the `submitted_date` fallback.
  - The `rq.submitted_date IS NOT NULL` filter becomes "has an intake row or a submitted date".
- **Round measures (D-10)** are folds in code over bounded Query Engine reads of rounds, responses (`submittedAt`), decisions (`createdAt`, the completing act) and contest points. Each measure's drill-down lists the rounds behind it from the same read.

### R9. AI runs: `jobId`, `attempt`, interruption and grouping (D-21 to D-23)

- **What a run carries.** A run is created `running` "just before the provider call", carrying the job's `jobId` and `attempt`. A retry is a new run on the same job with `attempt + 1`. At bootstrap, `running` becomes `interrupted`, and nothing else changes [CITED: 12-01-PLAN line 142; 12-RESEARCH line 171]. Job ids are random (`randomBytes(18).toString("base64url")`) and retry keeps the id and raises `attempt` [VERIFIED: `assessment-draft-registry.ts:100, 185-194, 213`]. Phases 15 and 16 jobs have the same shape [CITED: 16-RESEARCH line 459; 15-RESEARCH line 857].
- **Consequences:**
  - An interrupted run's job died with the process, because the registries are in memory [VERIFIED: the registry options at `assessment-draft-registry.ts:39-41`]. It can never be retried under the same `jobId`. Interrupted runs therefore never read "Completed on retry". A new generation after a restart is a new job, and the list does not link the two.
  - Group by `(operation, jobId)`. Job ids are unique per registry, not across registries. A run with a null `jobId` is its own group.
  - "Completed on retry" means a `completed` run with the same `(operation, jobId)` and a higher `attempt`, read whatever the window, because the retry may fall just after the window ends.
- **The window** is `startedAt >= utcDateToInstant(addUtcDays(today, -6))`, bound as a `Date` (07 D-02's explicit today).
- **Reads:**
  - the failed-runs list and counts are knex over typed columns: `status` in (`failed`, `interrupted`), `operation`, `started_at`, `attempt`, `job_id`, `failure_code`, `failure_message`, the links and display names;
  - pagination is SQL, `started_at DESC, id DESC`;
  - a second query fetches recovery for the page's groups;
  - the projection is an allow-list that never selects `instruction`, `context_summary`, `proposal` or `decisions` (G-3, with a test that serialises a row and greps for seeded content);
  - proposal outcomes (amendment 1: count runs by each run's outcome) and the `aiProvenance` edit share need JSON. They use bounded Query Engine reads, folded in code under `AI_HEALTH_RUN_CAP`. The `Outcome` filter's proposal values therefore paginate in code over that capped read.
- **Scope:** a run counts only when its request is in the analyst's scope. A generation that failed before any questionnaire existed can be followed by a return to draft, which takes the request, and its run, out of every figure and list (D-25). Add a fixture row for it.

### R10. The drill-down read's shape (D-03.2, D-26)

**Recommendation: a sub-resource of the report key.**
- Path: `GET /api/v1/reports/{reportKey}/records`.
- operationId: `analyst-insights/list-report-records`.
- Function: `function.reports.records_api` ("Report Records API"), API-only, `role.security_analyst` only, in `HUMAN_ANALYST_ONLY_OPERATIONS`, with the insight policy (`requireAnalystInsightScope: true`).

**Why:**
- It mirrors `GET /v1/reports/:reportKey` and the catalogued `POST:/api/v1/reports/{reportKey}/export` family [VERIFIED: catalogue `function.reports.run_api.api.01`, `function.reports.reports.api.03`].
- It reuses the key's closed parse and its 404. A key with no drill-down answers 404.
- It needs one Function and one matrix row instead of three.
- It matches the UI-SPEC's `/app/reports/{reportKey}/records`.
- It cannot collide with `:reportKey`.

The alternative, sibling paths per measure, triples the grants, the matrix rows and the parity entries for no gain in closure.

**The closed query, by key** (each parser exact-key and single-valued like `parsePeriod` [VERIFIED: `report-query.ts:43-60`]; anything else is 400 with a family-Z reason):

| Key | Parameters |
|---|---|
| `risk-trend` | `point` (`YYYY-MM`, a complete month inside the period; the current month refused, because its link is the register), `rating` (`Critical`, `High`, `Moderate`, `Low`, `not-rated`), `period` (6 or 12) |
| `cycle-times` | exactly one of `stage` (R1's stages except `released`) or `measure` (D-10's closed list), `period` |
| `ai-assistance` | `outcome` (`failed-or-interrupted` default, `failed`, `interrupted`, `completed`, plus Phase 12's stored run outcomes), `operation` (the run vocabulary), `window` (`7d` default, `period`, or `YYYY-MM` inside the period), `period` |
| all | Phase 20's report filters, `page`, `pageSize` (`5`, `10`, `25`, `50`; `AlertPagination`'s values [VERIFIED: specification `AlertPagination`]) |

**Response:**
- `ReportRecordsResponse { data: oneOf [TrendPointRecords, StageEpisodeRecords, RoundMeasureRecords, AiRunRecords], discriminator "kind"; meta: { pagination, scope: { asAt, period, filters } } }`, following `ReportResponse`'s discriminated `oneOf` [VERIFIED: specification `ReportResponse`].
- Every figure and its records come from one service function returning `{ figure, rows }`, so the totals cannot diverge (X-10).

**Underlying reads.** Today the policy requires every entry in `ANALYST_INSIGHT_UNDERLYING_READS` for every insight operation [VERIFIED: `csrm-authorization.ts:57-62, 335-343`]. D-02 adds Phase 12's run read (`GET /api/v1/ai_runs/{runId}` [CITED: 12-RESEARCH line 39]) for the AI reads only.
- Make the policy compute the required reads from the operation and `params.reportKey`: the run read joins for `ai-assistance` on `run_api` and `records_api`.
- The dashboard summary's "Failed in the last 7 days" row is computed only when the viewer holds the run read. Otherwise that row is omitted and the rest of the summary is served (07 D-34).

**The heat map** follows 19-05's precedent: `GET /api/v1/risks/heat_map`, registered before `GET /v1/risks/:riskId`, with `underlyingRead` set to the register list [CITED: 19-05-PLAN lines 33, 103]. Today's `/v1/risks/:riskId` would otherwise capture it [VERIFIED: `csrm-risk/routes/*.ts`, `path: "/v1/risks/:riskId"` at lines 38 and 50]. The four position filters map to `inherentLikelihood`, `highestInherentConsequence`, `residualLikelihood` and `highestResidualConsequence` [VERIFIED: `csrm-risk/content-types/csrm-risk/schema.json:69-86`]. "Not on the scale" is `col IS NULL OR col NOT IN (?, …)` over the bound scale labels.

### R11. Constructs for R-08-37's checklist (D-24)

The plan appends these to `docs/security/phase-08-residual-risks.md` R-08-37 and to item 9 of `phase-07-derived-insights.md`:
1. A correlated `NOT EXISTS` latest-row predicate on `(request link, sequence)`, and a derived table joined with `leftJoin(subquery.as(...))`.
2. The self-join `st2.sequence = st1.sequence + 1`.
3. `MIN(entered_at)` grouped by request in a left-joined subquery.
4. Datetime columns (`entered_at`, `started_at`, `occurred_at`, `approval_date`) compared only with bound JS `Date`s. This is the existing lesson: "On SQLite an ISO string bound there returned no rows" [VERIFIED: `phase-07-derived-insights.md` item 9]. SQLite raw reads return epoch milliseconds and PostgreSQL returns a `Date`, both normalised by `normalizeDateTime` [VERIFIED: `utc-date.ts:130-136`].
5. JSON columns (`changes`, `decisions`, `aiProvenance`) read only through the Query Engine, never raw knex or `whereJsonPath`.
6. `col IS NULL OR col NOT IN (bound labels)` for "Not on the scale".
7. `SELECT … FOR UPDATE` on the request row inside the recorder, a no-op on SQLite.
8. The enumeration column `csrm_ai_runs.status` compared with bound strings.
9. `COUNT` returned as a string on PostgreSQL, read through `Number()`.
10. `ORDER BY` with an `id` tie-breaker on every paginated list.

## Architecture Patterns

### System Architecture Diagram

```
 act request (PUT submit / revert / release / round open-close / submit final / recall / send back / release & close)
   │ withRequestLock (request row first)  ── questionnaire acts: request row lock, then questionnaire lock
   ▼
 withStageRecording ── derive(before) ─▶ act's own writes (+ notify) ─▶ derive(after)
   │                                                     │
   │   after ≠ (latest ?? before) ? append row(at = act's instant, sequence+1) : nothing
   ▼                                                     ▼
 csrm_stage_transitions (append-only)        commit │ rollback (no row)

 analyst read ─▶ insight policy (grant + underlying reads [+ run read for AI]) ─▶ closed parser (400/404)
   ├─ report key ─▶ bounded typed SQL (Date-bound cut-offs) ─▶ Query Engine JSON reads ─▶ pure folds ─▶ { figure, rows }
   ├─ /records  ─▶ same function ─▶ rows sorted/paginated (SQL for typed lists, code for folded sets)
   └─ queue / register / dashboard ─▶ latestStageRows join / heat_map aggregate / summary rows
```

### Recommended module placement (within Planner's Discretion)
- `apps/backend/src/csrm/stage-history/` holds `stage-derivation.ts` (pure, calls `deriveAssessmentStage`), `stage-facts.ts` (loads `StageFacts` in a transaction), `stage-recorder.ts` (`withStageRecording`) and `stage-causes.ts` (`STAGE_CAUSES`, with the act map that the coverage test reads).
- `apps/backend/src/csrm/insights/` holds `working-days.ts`, `stage-statistics.ts` (sample, median, nearest rank), `trend-as-at.ts`, `ai-run-groups.ts` and `heat-map-fold.ts`.
- `apps/backend/src/api/csrm-stage-transition/` holds the content type with no routes, a core router `only: []` (16-01's folder shape).

### Anti-Patterns to Avoid
- **Comparing only with the latest row:** writes false entry times for requests that predate deployment (R3).
- **`new Date()` inside the recorder:** breaks D-05's equality with the round records.
- **Durations, month-ends or working days in SQL** (`julianday`, `date_trunc`, `EXTRACT`): dialect-specific (R-08-37).
- **Reading JSON with raw knex:** gives a different shape on each dialect (R6).
- **A stored stage or a "latest" flag on the request or the row:** excluded by record 1 ("Not added").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-request serialisation | A new lock map | `withRequestLock` (13-03) for acts; 19.1's in-transaction row lock inside the recorder | One lock order; the tail must not nest |
| Month buckets and UTC dates | New date helpers | `throughputMonths`, `utcDateToInstant`, `addUtcDays`, `normalizeDateTime` | Already proven at month and day boundaries |
| Median | A second median | `medianDays`, refactored to share its sample with the percentile | One sample definition |
| Assessment stage | A second round/gate predicate | `deriveAssessmentStage` (17-03, widened by 17.1 and 17.2) | Stays in step with the lifecycle |
| Scale positions | Literal axis labels | 18 D-21's `risk-scale.ts` reader | Phase 22 configures it |
| Due state | `targetDate` logic | `treatment-due-state.ts` (G-16) | The one switchable rule |

## Common Pitfalls

### Pitfall 1: Submission outside a transaction
**What goes wrong:** the recorder throws (`inTransaction()` false), or two concurrent submits both write.
**How to avoid:** wrap the request update controller in `withRequestLock` and re-read inside it (R2).
**Warning signs:** a submit integration test with an injected failure after `documents.update` still leaves `submitted`.

### Pitfall 2: Lock-order inversion in the questionnaire acts
**What goes wrong:** on PostgreSQL, the questionnaire lock followed by the request lock deadlocks against generation, which takes the request and then writes questions.
**How to avoid:** take the request row lock first in acts 3 to 6 (R2). Race "release" against "regenerate" in an integration test.

### Pitfall 3: Episodes that do not equal the round records
**What goes wrong:** the recorder stamps its own time, so it is milliseconds away from `openedAt`.
**How to avoid:** pass `at` from the act (R3). The integration test deep-equals each round episode with `openedAt` and `closedAt`.

### Pitfall 4: A figure and its drill-down built twice
**What goes wrong:** totals drift, for example when the list ignores the cap the median used.
**How to avoid:** one function returns `{ figure, rows }`, and the controller paginates `rows` (R8, R10).

### Pitfall 5: Trend current point not equal to the register
**What goes wrong:** a future-dated v1 `closureDate`, or a review written "now", makes the fold disagree with the live filter.
**How to avoid:** take the current point from the live register count, clamp the closure day (R6), and keep the oracle assertion `fold(now) == live`.

### Pitfall 6: `/v1/risks/heat_map` captured by `:riskId`
**What goes wrong:** the heat map read is served by the detail route instead.
**How to avoid:** register it before `/v1/risks/:riskId`, as 19-05 did for export.

### Pitfall 7: Working-day bands off by one at weekends
**What goes wrong:** entries on Friday, Saturday and Sunday land in the wrong band on Monday.
**How to avoid:** use R7's definition and the six-week property test for each weekday as "today".

## Code Examples

```ts
// stage-derivation.ts (pure, zod-free). Inputs per R1; deriveAssessmentStage from 17-03 (widened by 17.1).
// 17-03 publishes deriveAssessmentStage({ released, responseRoundOpen, sharedWithParticipantsAt }) [CITED: 17-03-PLAN line 104];
// the `openRoundKind` input below is [ASSUMED] to be 17.1's widening for acceptance rounds; adapt to the executed signature.
export const REQUEST_STAGES = ["intake", "questionnaire", "drafting", "response", "rework", "acceptance", "returned-to-draft", "released"] as const;
export type RequestStage = typeof REQUEST_STAGES[number];

export function deriveRequestStage(f: StageFacts): RequestStage | null {
  if (f.requestStatus === "draft") return f.returnedToDraft ? "returned-to-draft" : null;
  if (f.released) return "released";
  if (f.assessmentExists) {
    switch (deriveAssessmentStage({ released: false, openRoundKind: f.openRoundKind, sharedWithParticipantsAt: f.gateSetAt })) {
      case "released-for-response": return "response";
      case "awaiting-acceptance": return "acceptance";
      case "with-security-analyst": return "rework";
      default: return "drafting";
    }
  }
  if (f.answersSubmitted) return "drafting";
  return f.questionnaireReleased ? "questionnaire" : "intake";
}
```

```ts
// working-days.ts: the earliest entry date whose working days to `today` are at most k (R7).
export function workingDayCutoff(today: string, k: number, week: readonly number[] = WORKING_WEEKDAYS): string {
  let date = today; let days = 0;
  for (;;) {
    const weekday = new Date(utcDateToInstant(date)).getUTCDay(); // 0 Sunday … 6 Saturday
    const next = days + (week.includes(weekday) ? 1 : 0);          // crossing `date` going back adds it if a working day
    if (next > k) return date;
    date = addUtcDays(date, -1); days = next;
  }
}
```

```ts
// stage-statistics.ts: nearest-rank 90th percentile over the same sample as the median (R8).
export function nearestRank(sorted: readonly number[], p: number, minimum: number): number | null {
  if (sorted.length < minimum) return null;
  return Math.round(sorted[Math.ceil(p * sorted.length) - 1] * 10) / 10;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Time to release from `submittedDate` (cleared by a return to draft) | From the first `intake` row, else `submittedDate` | This phase (D-04, D-11) | Returned requests stay in the sample |
| Job history in memory for one hour | Phase 12's runs, queried by `startedAt` | Phase 12 / this phase | Seven-day and monthly AI figures |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `pg` driver returns `jsonb` as an object to raw knex reads | R6, R11 | None for the recommendation, which avoids raw JSON reads either way |
| A2 | The new link table and columns are `csrm_stage_transitions_request_lnk(csrm_stage_transition_id, csrm_assessment_request_id)` | R7 | The SQL names change; record 1 fixes them after the schema boots |
| A3 | The round, gate and decision shapes of Phases 17 to 17.2 and Phase 20's history kinds exist as their plans and research name them | R1, R2, R6 | Stage 3's plan check re-reads them before execution |
| A4 | Strapi 5 removes link rows rather than cascading a request delete | R4 | None: the refusal makes it moot |
| A5 | Phase 12's decision envelope yields one outcome per run, as amendment 1 assumes | R9 | The plan must define the run's outcome from the record's envelope |

## Open Questions (for the orchestrator)

1. **Refuse deleting a request with stage history?** The recommendation is 409 `REQUEST_HAS_STAGE_HISTORY` (R4). It makes every once-submitted request undeletable, which already holds for most requests through notes, attachments and assessments.
2. **The fixture exception for history rows.** Record 1's amendments need `phase-16-risk-withdrawal-and-history.md` added, so the development fixture may reconcile the `enteredAt` and `occurredAt` of its own rows (R5). Without it, the time-relative trend fixture cannot exist.
3. **Time to release ends at `approvalDate`.** By construction this equals the released row. Confirm it as the reading of D-11's "released row (or approvalDate)" (R8).

## Environment Availability

Step 2.6: SKIPPED. No external tool, service or runtime beyond the repository's Node 24, pnpm, SQLite (in the test harness) and Playwright, which earlier phases audited [CITED: 20-VALIDATION.md, Test Infrastructure].

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **Web:** vitest (jsdom) with @testing-library/react. **Strapi:** `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one process and one SQLite database per file [VERIFIED: `apps/backend/package.json` `test` script]. **E2E:** Playwright with @axe-core/playwright on the production build [CITED: 20-VALIDATION.md] |
| Config file | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` |
| Quick run command | Web: `pnpm --dir apps/csrm exec vitest run <path>`. Strapi file (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`. E2E: `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts` |
| Full suite command | `pnpm --dir apps/csrm api:check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm lint && pnpm --dir apps/csrm test && pnpm --dir apps/backend test`, then `pnpm --dir apps/csrm test:e2e` and `git status --short` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-05 / D-06 | Every R1 row and edge case; equivalence with `deriveAssessmentStage`; `gateSet ⟺ any round` | Strapi unit | `…/stage-derivation.unit.test.js` | ❌ W0 |
| DASH-05 / D-07 | Append-on-change against latest-or-before; no row when unchanged; `at` from the act; sequence without gaps; refuses outside a transaction | Strapi unit + integration | `…/stage-recorder.unit.test.js`, `…/stage-history.integration.test.js` | ❌ W0 |
| DASH-05 / D-07 | Coverage: each of the 12 acts writes its row in its own transaction; injected failure → no row; `STAGE_CAUSES` equals the act table; static append-only and no-gate guards | Strapi integration + unit | `…/stage-history-acts.integration.test.js`, `…/stage-history-guards.unit.test.js` | ❌ W0 |
| DASH-05 / D-05, D-07 | Oracle: the latest row equals the derived stage over fixtures for every path; round episodes equal `openedAt` and `closedAt`; the released row equals `approvalDate` | Strapi integration | `…/stage-history-oracle.integration.test.js` | ❌ W0 |
| R4 | Never-submitted draft deletable; returned draft refused 409 `REQUEST_HAS_STAGE_HISTORY`, rows intact | Strapi integration | `…/request-delete.integration.test.js` (extends 13-06's) | ❌ W0 / extends |
| DASH-05 (3) / D-09 to D-12 | Episodes, cap and `truncated`; nearest rank from 10; working-day cut-offs (six-week property); bands; "Not recorded"; queue `stage` and `ageBand` totals equal the ageing figures; the throughput 90th percentile and fallback note | Strapi unit + integration (injected clock) | `…/working-days.unit.test.js`, `…/stage-statistics.unit.test.js`, `…/cycle-times-report.integration.test.js`, `…/review-queue-ageing.integration.test.js` | ❌ W0 |
| DASH-05 (1) / D-13, D-14 | As-at fold: release, closure rows, no-row and future-dated closures, reviews before and after, malformed → Not available; `fold(now) == live`; past point drill-down total equals the point | Strapi unit + integration | `…/trend-as-at.unit.test.js`, `…/risk-trend-report.integration.test.js` | ❌ W0 |
| DASH-05 (2) / D-15, D-16 | Heat-map fold through the scale reader; off-scale; withdrawn excluded; cell total equals the register with position filters; route before `:riskId` | Strapi unit + integration; web unit | `…/heat-map-fold.unit.test.js`, `…/risk-heat-map.integration.test.js`; `risk-matrix.test.tsx` | ❌ W0 |
| DASH-04 (2) / D-21, D-22 | Window (today and the six before); failed and interrupted; grouping by `(operation, jobId)`; "Completed on retry"; interrupted never recovered; no run content in rows; scope excludes a returned draft's run | Strapi unit + integration | `…/ai-run-groups.unit.test.js`, `…/ai-assistance-report.integration.test.js` | ❌ W0 |
| DASH-04 (1) / D-17 to D-20, D-26 | Every new figure's total equals its list; report additions; Home additions; the Requestor's time in stage via owner-scoped reads | Strapi integration; web unit | `…/analyst-insights.integration.test.js` (extends), `…/my-requests.integration.test.js` (extends); web feature tests | ✅ extends / ❌ W0 |
| D-02, D-25, `<authorisation>` | Matrix rows for `records_api` and `heat_map` for all seven callers; Requestor, risk owner and Admin 403; service identity 403; an analyst lacking the run read refused on `ai-assistance` only; closed parsers 400/404 | Strapi integration + matrix | `…/authorization-matrix.integration.test.js`, `…/report-records-query.unit.test.js` | ✅ / ❌ W0 |
| SC1 to SC4 | Leadership view, trend past point, heat-map cell, slowest item, ageing band and failed runs on Home open equal lists; axe; Maya and the risk owner persona get the permission state | E2E (1440, 375) | `pnpm --dir apps/csrm test:e2e e2e/<phase spec>.spec.ts` | ❌ W0 |

### Sampling Rate
- **Per task commit:** the touched web files by path; the touched Strapi test file (dev servers stopped); `typecheck` after type changes; `api:check` after any specification change.
- **Per wave merge:** the full Strapi suite and the full web suite.
- **Phase gate:** the full suite, then Playwright (both projects), then a clean `git status --short`; `risk-owner-journey.spec.ts` stays green with the recorder in its acts.

### Wave 0 Gaps
- [ ] Harness helpers: `stageRows(requestDocumentId)` (Query Engine read), `withInjectedFailureAfter(act)` for rollback cases, and an injected clock for the insight services (07 D-24's pattern).
- [ ] Fixture: a time-relative seed behind `IDAMBOX_SEED_CSRM` and the development identity (R5), with episodes of known lengths, past-month reviews and closures (including a no-row and a future-dated v1 closure), and failed and interrupted runs inside and outside the window.
- [ ] The test files marked ❌ W0 above.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Keycloak and the development bridge, unchanged |
| V4 Access Control | yes | Role → Function → FunctionAPI; the insight scope with underlying reads (plus the run read for AI); `HUMAN_ANALYST_ONLY_OPERATIONS`; owner scope for the Requestor's projections; no stage-history route |
| V5 Input Validation | yes | Closed exact-key parsers for every new query (400 or 404) |
| V7 Error Handling and Logging | yes | Closed refusal reasons (family Z); no run content in any projection |
| V8 Data Protection | yes | The run list's allow-listed projection (G-3) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Insight widening scope | Information disclosure | Underlying reads required; one figure/list function; scope joins on every read |
| AI run content leaking through the failure list | Information disclosure | Allow-list projection; a test seeds the instruction and proposal and greps the response |
| Tampering with process history | Tampering / repudiation | No route; append-only static guard; delete refused; writes only inside the act's transaction |
| Parameter abuse on drill-downs (unbounded windows, operators) | Denial of service | Closed values, bounded caps, "Not available" over a cap |

## Sources

### Primary (HIGH; read this session)
- Repository: `request-lifecycle.ts`, `request-workflow.ts`, `controllers/csrm-assessment-request.ts:140-210`, `operations.ts` (request), the request schema `:76-103`, `collection-scope.ts:45-52`, `review-queue-repository.ts:73-128`, `questionnaire-governance-workflow.ts:35, 186-375`, `questionnaire-workflow.ts:196-385`, `questionnaire-generation-workflow.ts:30-35`, `assessment-workflow.ts:121-131, 509-548, 575-581, 690-797`, `assessment-draft-registry.ts:39-41, 100, 185-213`, `report-repository.ts:175-195, 355-400`, `report-math.ts:205-261`, `utc-date.ts:85-140`, `report-query.ts:1-60`, `routes/reports.ts`, `analyst-insight/operations.ts`, `csrm-authorization.ts:57-62, 335-343, 399-419`, `csrm-risk/operations.ts`, the risk schema, `seed-analyst-insights.ts`, `docs/references/served-operations.json`, the catalogue's report Functions, the specification's `ReportResponse`, `AlertPagination` and `/v1/reports/{reportKey}`, `docs/contract-gaps/phase-07-derived-insights.md` item 9, `docs/security/phase-08-residual-risks.md` R-08-37, `apps/backend/package.json` scripts.
- `@strapi/database` 5.51.0: `dist/schema/schema.js:160-172`, `dist/fields/json.js`, `dist/fields/datetime.js`, `dist/fields/date.js`.

### Secondary (MEDIUM; planned outputs cited)
- 12-01-PLAN, 12-RESEARCH; 13-01, 13-03 and 13-06 plans; 16-01-PLAN, 16-RESEARCH; 17-RESEARCH, 17-03-PLAN; 17.1-CONTEXT, 17.1-RESEARCH, 17.1-PATTERNS; 17.2-CONTEXT, 17.2-RESEARCH; 19-05-PLAN; 19.1-03-PLAN; 20-CONTEXT, 20-RESEARCH; 22-CONTEXT (D-23).

## Metadata

**Confidence breakdown:**
- Stage derivation and act list: HIGH for the seven served acts (read in code); MEDIUM for the five planned acts.
- SQL/code split and portability: HIGH (Strapi field layer and existing patterns read).
- Drill-down shape: HIGH (it mirrors the existing contract).
- AI runs: MEDIUM (the run record is planned; the registry behaviour was read).

**Research date:** 2026-10-01
**Valid until:** Stage 3's plan check (re-run against the executed Phases 12 to 20)
