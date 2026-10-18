---
phase: 16-risk-curation-and-targeted-ai-re-runs
reviewed: 2026-10-16
depth: deep
diff_base: 01dc4118
diff_ranges: 01dc4118..f2a39dbe and d1518c5f..HEAD (Phase 16's own change; the IAM workstream's merge at d1518c5f is excluded per the pilot's freeze-scope ruling of 2026-10-15)
files_reviewed: 116
findings:
  critical: 3
  warning: 24
  info: 27
  total: 54
status: issues_found
---

# Phase 16 code review

Four independent read-only lanes reviewed Phase 16's own change since `01dc4118`, at `60522416`: Strapi risk curation, history, withdrawal, locking and authorisation (lane 1, `BE1-`); Strapi risk AI proposals, the job registry, provider adapters and context summary v5 (lane 2, `BE2-`); the web risk curation UI, editor, register and accessibility (lane 3, `FE3-`); and the web AI proposals and rewrite UI, Server Actions and API layer (lane 4, `FE4-`). Lane bodies are preserved verbatim below. Severity is the reviewer's classification; `16-REVIEW-DISPOSITION.md` validates each claim before accepting it. The reviewed-file count is the sum of the lanes (31, 28, 32 and 25); lanes overlap on the contract and shared modules, so it is not a unique-source count.

| Lane | Critical | Warning | Info | Total |
|------|----------|---------|------|-------|
| 1 backend curation | 0 | 3 | 6 | 9 |
| 2 backend AI | 2 | 6 | 8 | 16 |
| 3 web curation | 1 | 7 | 8 | 16 |
| 4 web AI | 0 | 8 | 5 | 13 |
| **Total** | **3** | **24** | **27** | **54** |

## backend curation lane

---
phase: 16-risk-curation-and-targeted-ai-re-runs
lane: backend-curation
reviewed: 2026-10-16
depth: deep
diff_base: 01dc4118 (Phase 16 ranges 01dc4118..f2a39dbe and d1518c5f..HEAD)
files_reviewed: 31
files_reviewed_list:
  - apps/backend/src/api/csrm-risk/controllers/risk-curation.ts
  - apps/backend/src/api/csrm-risk/routes/risk-curation.ts
  - apps/backend/src/api/csrm-risk/services/risk-curation.ts
  - apps/backend/src/api/csrm-risk/services/risk-workflow.ts
  - apps/backend/src/api/csrm-risk/services/risk-register.ts
  - apps/backend/src/api/csrm-risk/services/risk-register-query.ts
  - apps/backend/src/api/csrm-risk/operations.ts
  - apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json
  - apps/backend/src/api/csrm-risk-history-event/content-types/csrm-risk-history-event/schema.json
  - apps/backend/src/api/csrm-risk-history-event/controllers/csrm-risk-history-event.ts
  - apps/backend/src/api/csrm-risk-history-event/routes/csrm-risk-history-event.ts
  - apps/backend/src/api/csrm-risk-history-event/services/csrm-risk-history-event.ts
  - apps/backend/src/api/csrm-risk-history-event/services/risk-history.ts
  - apps/backend/src/csrm/active-risk.ts
  - apps/backend/src/csrm/risk-curation-rules.ts
  - apps/backend/src/csrm/risk-history-changes.ts
  - apps/backend/src/csrm/conflict-reasons.ts
  - apps/backend/src/policies/csrm-authorization.ts
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-scope.ts
  - apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts
  - apps/backend/src/api/csrm-control-implementation/services/control-implementation-workflow.ts
  - apps/backend/src/api/csrm-analyst-insight/services/alert-repository.ts
  - apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts
  - apps/backend/src/api/csrm-analyst-insight/services/report-repository.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment-request/services/relationship-scope.ts
  - apps/backend/src/api/csrm-assessment-request/services/revert-reason.ts
  - docs/references/specification.json
  - docs/contract-gaps/phase-16-risk-withdrawal-and-history.md
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 16 backend curation review

Scope: the Phase 16 change to Strapi risk curation (withdraw, reinstate, history read), the history writer and envelope, the one active-risk rule and its readers, the editable guard and lock frame, the catalogue grants and the curation contract. I traced each path from route and policy through the controller into `withMutableAssessmentMutation` / `withAssessmentLock`, and checked every reader that lists, counts or rates Risks.

What holds, verified against the code rather than the comments:

- **Authorisation (T-16-12).** The three routes carry `global::csrm-authorization` with their operation. The operations are granted to `role.security_analyst` only (checked per role in the catalogue JSON). The two catalogue copies are byte-identical (`cmp`). All three operations are in `HUMAN_ANALYST_ONLY_OPERATIONS`, which `csrm-authorization.ts:409` checks before it sets the actor. Each handler then calls `assertAnalystAssessmentScope`. The actor comes from `ctx.state.idamboxUser.documentId` only. Nothing branches on the auth mode.
- **Locking and transactions (T-16-06, T-16-08, T-16-10, Pitfalls 1 and 7).** Withdraw and reinstate run inside `withMutableAssessmentMutation`. That frame provides the in-process queue, `SELECT … FOR UPDATE` on the assessment row, the reload, `assertAssessmentEditable` and then `mutate`. The batch load, the Risk updates, `recordRiskHistory` and the rewrite-unit supersession all run inside that transaction. Every other Risk and control-implementation writer goes through the same frame and re-reads the Risk inside the lock (`updateRiskWithinMutation`, `*ControlImplementationWithinMutation`). The history writer opens no transaction of its own and exports no update or delete. Its core router mounts nothing.
- **State machine (T-16-13, T-16-14, T-16-15).**
  - A missing Risk, or one from another assessment, gets the same 404 for the whole batch (`loadBatch`).
  - A released assessment answers `ASSESSMENT_NOT_MUTABLE` before anything else.
  - A batch where every Risk is already active answers `RISK_NOT_WITHDRAWN`.
  - A batch that changes nothing takes no transition.
  - A typed "Withdrawal undone" reason never sets `undo`.
  - `assertRiskActive` is called on every inner Risk and control-implementation path and in both decision paths.
- **The active-risk rule (T-16-16, T-16-17).** Every reader uses one of the three forms of the rule:
  - release readiness: `releaseReadinessRisks` feeds both functions, so the index paths stay aligned;
  - the request relationship counts;
  - the assessment lists' `riskSummariesFor`;
  - the Requestor's risk list and its control-implementation read (same 404 body);
  - the register list and count (the shared `registerQuery`);
  - alerts, dashboard and reports (`activeRiskTable` / `applyActiveRisk`, including the control-implementation joins and the exposed-systems queries).

  No requestor-reachable reader serves a withdrawn Risk.
- **Request deletion (Pitfall 6).** `REQUEST_HAS_ASSESSMENT` is checked under `withRequestLock`. That lock takes the same request-row lock as `persistAssessmentDraft`, so a draft cannot slip in between the check and the delete.
- **Contract.** The bodies, the 200/400/403/404/409 answers, the history `page`/`pageSize` bounds (1 to 1,000,000 and 1 to 100), the `recordedFrom` meta and the four new conflict reasons all match `specification.json`.

The findings below are where the code departs from the approved G-6 record or the published contract, or where a server-side rule is weaker than its audit trail claims.

## Warnings

### BE1-01 (Warning): `created` history rows record no starting values, contrary to the approved G-6 record

**Files:** `apps/backend/src/api/csrm-risk/services/risk-workflow.ts:241-248` (`createRiskWithinMutation`, used by "Add risk" and by "Add to assessment" from a suggestions run), `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts:971-980` (`persistAssessmentDraft`).

**Evidence.**
- Both writers pass `changes: { fields: [] }` for `kind: "created"`.
- The approved record says otherwise. `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md:107` reads: "A `created` row lists each field the Risk was created with that holds a value, each with `from: null`."
- The pilot's G-6 approval (line 318) states it again as a confirmed executor choice: "a `created` row lists starting values with `from: null`".
- `16-01-SUMMARY.md:45,161` records it as a decision.
- No amendment or SUMMARY deviation records a change.
- `apps/backend/tests/risk-curation.integration.test.ts:518,534` asserts `fields: []`, so the tests pin the behaviour the contract rules out.
- By contrast, `control-implementation-added` correctly records `controlImplementationChanges(null, implementation)` (`control-implementation-workflow.ts:240`).

**Why it matters.**
- The history is the audit trail (D-18, G-15, D-20's "a history that showed an AI rewrite but not the manual edit after it would mislead the third line").
- For an AI-drafted or AI-suggested Risk, the `created` row is the only record of what the AI wrote before any human touched it.
- With `fields: []`, a reader can only infer the starting values from later `updated` rows. Any value changed outside the analyst paths cannot be recovered at all.
- The code also disagrees with a G-6 record the phase gate claims to check.

**Fix.** Do one of the following:
- Record the starting values. In `createRiskWithinMutation`, re-read the created Risk with `RISK_HISTORY_POPULATE` and pass `fields: riskChanges(null, created, RISK_HISTORY_FIELDS)`. Do the same in `persistAssessmentDraft`, after creating each Risk and populating its relations. `riskChanges(null, x)` already yields `{ from: null, to }` for each field that holds a value, as `controlImplementationChanges(null, …)` does.
- Or file a dated G-6 amendment that changes line 107 and the line-318 confirmation, and have the pilot approve it.

**Test.** Change the two integration cases at `risk-curation.integration.test.ts:509` and `:522` to expect the starting fields with `from: null` (for example `riskStatement`, `riskType` as `{ documentId, label }`, `treatmentStatus: "Not Started"`), and add the same assertion to the "Add to assessment" case in `risk-proposal-decisions.integration.test.ts`.

### BE1-02 (Warning): Withdrawn Risks in the register's Withdrawn view are served `accepted: true` and a live treatment due state

**File:** `apps/backend/src/api/csrm-risk/services/risk-register.ts:398-424` (`projectRiskRegisterItem`), reached through `registerQuery` (`:588-591`) when `state=withdrawn`.

**Evidence.**
- `accepted` is computed as `stage === "released" && treatmentAction === "Accept" && !document.closureDate`, with no withdrawal check. `treatmentDueState` is derived the same way for every row.
- A Risk withdrawn before its assessment was released stays withdrawn after release. In the Withdrawn view, its row comes back `accepted: true`, and `treatmentDueState` can be `overdue` or `due-soon`.
- The contract rules this out. `RiskRegisterItem.accepted` in `specification.json` is "true only for a released, open Risk". Phase 16 redefined "open" in the same spec as "an active Risk with no closure date recorded" (the `state` parameter).
- The web shows the flag: `apps/csrm/src/features/risks/risk-domain.ts:133` (`riskRegisterCardMarker`) renders "Released · Accepted" next to the Withdrawn badge (`risk-register.tsx:148,165`), and `TargetDate` renders the due state.

**Why it matters.**
- The register would present a withdrawn Risk as an accepted released risk with an overdue treatment. The dashboard, alerts and reports all deliberately exclude it (D-08, D-13: "no surface counts a withdrawn risk").
- This is server-derived meaning, which the web rightly does not second-guess ("Strapi supplies this fact, including openness; a client never guesses it").

**Fix.** In `projectRiskRegisterItem`, set `accepted` to false for a withdrawn row. Either serve `treatmentDueState` as the closed state's value for a withdrawn row, or document that it is not evaluated. For example: `const active = isActiveRisk(document);` then `accepted: active && stage === "released" && …`, and pass `withdrawnAt` through the hydrate read. `hydrate` must select `withdrawnAt`; it populates without a `fields` restriction today, so it already does.

**Test.** In `risk-register.integration.test.ts`: release an assessment that has a withdrawn Accept Risk with a past target date, then call `GET /api/v1/risks?state=withdrawn`. Assert that the row has `accepted: false` (and the agreed due state), and that `?state=withdrawn&treatmentAction=Accept&stage=released` does not present it as accepted.

### BE1-03 (Warning): The `undo: true` flag is not tied to the event it claims to undo, so it bypasses the reinstatement reason and can mislabel the audit trail

**Files:**
- `apps/backend/src/api/csrm-risk/services/risk-curation.ts:188-221` (`reinstateRisks`: `reason = UNDO_WITHDRAWAL_REASON` whenever `body.mode === "undo"`);
- `risk-curation.ts:111-119` (`withdrawalReasons`: undo needs only some earlier `withdrawn` event);
- `apps/backend/src/csrm/risk-curation-rules.ts:78-80`.

**Evidence.**
- `parseRiskCurationBody` accepts `{ riskIds, undo: true }` for any batch.
- `reinstateRisks` then reinstates every withdrawn Risk in the batch, with the fixed reason "Withdrawal undone" and `undo: true`. This holds whoever withdrew the Risk, whenever they did it, and whatever happened in between.
- `withdrawRisks` in undo mode re-withdraws any active Risk that has any earlier `withdrawn` event, and stamps `undo: true`. This holds even when the Risk's latest event is weeks of `updated` rows rather than a reinstatement.
- No check compares the acting analyst, the Risk's current `withdrawnBy`/`withdrawnAt`, or the most recent event.

**Why it matters.**
- D-10 and the G-6 record ("Batch rules", D-06 bounds) require every reinstatement to have a reason. In practice any analyst can reinstate another analyst's withdrawal with no reason entered, through a request the UI only sends from the Undo toast.
- The history then reads "Withdrawal undone" ("Reinstatement undone" for the reverse case). That tells the third line the change reversed the analyst's own immediately preceding action, when it did not.
- The rule is enforced only by the client. AGENTS.md requires authorisation and business rules to be enforced in Strapi, and T-16-15 exists to keep the `undo` audit flag trustworthy.
- G-6 does not forbid this, so the fix needs a dated G-6 amendment.

**Fix.** Bind undo to the state it reverses, reading the current facts rather than the history where possible (D-18):
- On reinstatement undo, require each applied Risk's `withdrawnBy` to be the acting analyst. Optionally also require `withdrawnAt` to be within a short window, and refuse otherwise (409, or 400 like the existing "nothing to restore").
- On withdrawal undo, require the Risk's most recent history event to be a `reinstated` row by the same actor. The path already reads history for the reason, so this adds no new kind of dependency.

Record the rule in a G-6 amendment and in the two `RiskCuration*Request` descriptions in `specification.json`.

**Test.** Add to `risk-curation.integration.test.ts`:
- (a) Analyst A withdraws, then analyst B sends `risk_reinstatements { undo: true }`. Expect a refusal, with the Risk still withdrawn and no new history row (persistence deep-equal).
- (b) A Risk is withdrawn, reinstated, then edited. A later `risk_withdrawals { undo: true }` is refused.
- (c) The immediate same-actor Undo in both directions still succeeds.

## Info

### BE1-04 (Info): The history read serves `kind`, `sourceKind` and `reason` unchecked against the closed contract, so one off-contract row fails the whole page in the web

**File:** `apps/backend/src/api/csrm-risk-history-event/services/risk-history.ts:245-260`.

**Evidence.**
- `kind: String(row.kind)`, `sourceKind: String(row.sourceKind)` and `reason: optionalString(row.reason)` are served as stored.
- `RiskHistoryEvent` in the spec closes `kind` to seven values and `sourceKind` to two, and bounds `reason` to 500 characters. The web parses them strictly (`apps/csrm/src/features/risk-curation/risk-curation-schema.ts:63,66`).
- The G-6 record accepts that the type stays editable in the Content Manager. The module's own posture is that "a row whose changes does not parse is served … rather than failing the read" (06.8).
- An off-vocabulary `kind` breaks that posture: the whole page fails client-side, and the web's `default:` branch for "a kind a later phase adds" (`risk-curation-domain.ts:650`) can never be reached.

**Fix.** Project unknown `kind`/`sourceKind` values the way a malformed envelope is projected: `changes: null` with the row skipped or marked, logged once. Or make the contract open to future kinds explicitly, which S-9 says later phases need.

**Test.** Add a unit case in `risk-history` that writes a row with `kind: "bogus"` directly and asserts that the read still returns a contract-valid page.

### BE1-05 (Info): The append-only guard covers deletes only; nothing proves that no code path updates a history row

**File:** `apps/backend/tests/risk-no-delete.unit.test.ts` (scanner `scanForRiskDeletes`).

**Evidence.**
- T-16-06 and the G-6 record ("No row is ever updated or deleted, by any route or code path") cover updates as well as deletes.
- The scanner matches only `delete|deleteMany`, raw `DELETE FROM`, and `.del(`. It does not see `update`/`updateMany`/`.update(` on `api::csrm-risk-history-event.csrm-risk-history-event` or `csrm_risk_history_events`.
- It also misses accessor forms beyond `documents(`/`query(`, for example `strapi.service(HISTORY_UID).delete(...)`.
- The source is clean today (I grepped it), but the guard would not catch a regression.

**Fix.** Extend the scanner with an update pattern restricted to the history UID and table, and add `service(` and `entityService` accessors. Add synthetic positive snippets for each.

### BE1-06 (Info): The Withdrawn branch restates the rule in raw SQL outside `active-risk.ts`

**File:** `apps/backend/src/api/csrm-risk/services/risk-register.ts:276-279` (`applyWithdrawnRisk` uses the literal `"r.withdrawn_at IS NOT NULL"`).

**Evidence.**
- D-13 and `active-risk.ts`'s header say the rule is "defined once in each form", and that module exports `WITHDRAWN_RISK_FILTER` for the Document Service.
- The SQL form of the withdrawn predicate has no counterpart there, and the register skips the alias validation that `activeRiskSql` applies.

**Fix.** Add `withdrawnRiskSql(alias)` beside `activeRiskSql` in `active-risk.ts` and use it in `applyWithdrawnRisk`.

### BE1-07 (Info): `projectRiskWithdrawal` can emit a `RiskWithdrawal` the contract forbids

**File:** `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts:458-476`.

**Evidence.**
- For a withdrawn Risk whose facts are damaged, the function emits `reason: null` (the spec requires a string with `minLength: 1`).
- In the same case, `at` falls back to the raw stored value (the spec requires a `date-time`).
- The comment calls this fail-closed. The analyst detail and the register detail are served under contract schemas that do not allow these values, and the contract-response parity tests only exercise well-formed rows.

**Fix.** Either widen the schema with a documented fallback, or project the damaged block deterministically (for example `reason: "Not recorded"`, and `at` as the instant or omitted with the Risk still marked withdrawn), and add a fixture for each case.

### BE1-08 (Info): Edits by the Security Analyst Agent are recorded as `sourceKind: "analyst"`

**Files:** `apps/backend/src/api/csrm-risk/services/risk-workflow.ts:184-191,372`; `control-implementation-workflow.ts:367,393,439`.

**Evidence.**
- D-44 keeps the agent's Risk update grant, and the agent's PATCH reaches `updateRisk` (exercised at `risk-curation.integration.test.ts:307`).
- Every non-AI change is recorded with `historySourceFields({ kind: "analyst" })`.
- The G-6 record defines `analyst` as "a hand edit, a withdrawal or a reinstatement". An automated edit is indistinguishable from a human one in the history, apart from the actor's name.

**Fix.** Pass the policy's `humanAnalyst` fact into the inner functions. Either record a distinct source (through a G-6 amendment, since sources are closed), or record the fact in the event so the third line can tell automation from people.

### BE1-09 (Info): Dead and redundant code touched by Phase 16

**Files:**
- `apps/backend/src/api/csrm-risk/services/risk-workflow.ts:95-107` (`listAssessmentRiskDocuments`) and `apps/backend/src/api/csrm-risk/controllers/csrm-risk.ts:144-155` (`listAssessmentRisks`): no route mounts `api::csrm-risk.csrm-risk.listAssessmentRisks` (the GET is served by the csrm-assessment controller). Phase 16 nevertheless added the active filter here, which suggests the function is still live when it is not.
- `apps/backend/src/csrm/risk-curation-rules.ts:88-99` (`inRequestOrder`): `loadBatch` already returns the rows in `riskIds` order, so the sort repeats work that is already done.

**Fix.** Remove the unrouted handler and service function, or route them deliberately. Drop the `order` re-sort, or keep it and note that callers may pass rows in any order.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer), lane 1 backend curation_
_Depth: deep_

## backend AI lane

---
phase: 16-risk-curation-and-targeted-ai-re-runs
lane: backend-ai
reviewed: 2026-10-16
depth: deep
diff_base: 01dc4118 (Phase 16 ranges 01dc4118..f2a39dbe and d1518c5f..HEAD)
files_reviewed: 28
files_reviewed_list:
  - apps/backend/src/csrm/ai/risk-proposals/deterministic-risk-proposal-provider.ts
  - apps/backend/src/csrm/ai/risk-proposals/field-units.ts
  - apps/backend/src/csrm/ai/risk-proposals/openai-compatible-risk-proposal-provider.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-duplicates.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-adapter.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-context.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-decisions.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-envelope.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-provider.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-proposal-workflow.ts
  - apps/backend/src/csrm/ai/risk-proposals/risk-proposals-read.ts
  - apps/backend/src/csrm/ai/ai-inputs-signal.ts
  - apps/backend/src/csrm/ai/assessment-context-loader.ts
  - apps/backend/src/csrm/ai/assessment-context.ts
  - apps/backend/src/csrm/ai/proposal-items.ts
  - apps/backend/src/csrm/ai/proposal-job-registry.ts
  - apps/backend/src/api/csrm-assessment/controllers/risk-proposals.ts
  - apps/backend/src/api/csrm-assessment/routes/risk-proposals.ts
  - apps/backend/src/api/csrm-assessment/operations.ts
  - apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts
  - apps/backend/src/api/csrm-assessment/services/ai-provenance.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-draft-provider.ts
  - apps/backend/src/api/csrm-assessment/services/openai-compatible-assessment-draft-provider.ts
  - apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts
  - docs/references/specification.json
  - docs/contract-gaps/phase-12-ai-run-record-and-provenance.md
  - docs/contract-gaps/phase-04-deterministic-draft-jobs.md
  - apps/backend/tests/risk-proposal-decisions.integration.test.ts
findings:
  critical: 2
  warning: 6
  info: 8
  total: 16
status: issues_found
---

# Phase 16 backend AI proposals review

Lane 2 covered the Strapi side of "Suggest more risks" and "Rewrite this risk": the job registry, the workflow (start, execute, complete, retry), the context part and loader, the adapters and envelope, the field units, the duplicate classifier, the decision path through `decideAiProposals`, the proposals read, the run record (`ai-run-record.ts`, context summary v5) and the matching spec and contract-gap text. I traced callers into `assessment-workflow.ts` (lock, guard, `initialRiskAiProvenance`), `risk-workflow.ts` (`updateRiskWithinMutation`), `proposal-items.ts` (fold) and `csrm-authorization.ts`.

These areas hold up:

- **Authorisation.** All five operations are in `HUMAN_ANALYST_ONLY_OPERATIONS`. Each handler requires the analyst scope and takes `humanAnalyst` from the policy. `OWN_REQUEST` is checked before state at every start, retry, job read, proposals read and decision batch.
- **Run ancestry and decisions.** Run ancestry is checked inside the transaction (T-16-28). Decisions are idempotent and fold-based. A double accept is a no-op, and a decision after release is refused by `withMutableAssessmentMutation`.
- **Locking and job lifecycle.** Completion runs under the assessment lock with the lapse and supersession paths. Start and retry admission is serialised under the lock and counts active reservations against the 100-run cap. Registry slots are released in `finally`.
- **Validation and context.** The closed envelope and decision parsers fail safe. Context summary v5 parses v1 to v4 back-compatibly. The prompt carries no documentIds, risk numbers, owners or dates. Tests pin the deterministic provider.

The defects are concentrated where Phase 16 provenance meets Phase 12's per-field review, and in the Accept rule's Undo path.

### BE2-01 (Critical): A Risk created by hand that has a confirmed rewrite change can no longer be edited (409 AI_RUN_RECORD_UNAVAILABLE)

**Files:** `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-decisions.ts:228`, `apps/backend/src/api/csrm-risk/services/risk-workflow.ts:284-297`, `apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts:328-331`, `apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts:318,348`

**Evidence.** The failure takes four steps:

1. `confirmChange` builds the provenance of a Risk that has none (created by hand) as `emptyRiskAiProvenance(run.runId, unit.key)`. That makes the envelope's `runId` the `risk-rewrite` run, and the confirmed fields become `accepted` facts.
2. The analyst later edits one of those fields (`PATCH /api/v1/risks/{id}`). `updateRiskWithinMutation` parses the provenance (the source is `analyst`, so line 284 takes the parse branch). `applyAiFieldEdit` then marks the `accepted` field `edited` and appends a Phase 12 v1 `edited` event to `provenance.runId`, which is the rewrite run.
3. `appendAiRunDecisions` takes the non-suggestions branch and runs `parseRunDecisionsFor("risk-rewrite", [v1])`. `parseRiskDecisionEvents` rejects a v1 event, so the call throws `AiRunRecordError`. `appendAiRunDecisionsWithinMutation` turns that into a 409 `AI_RUN_RECORD_UNAVAILABLE` and the edit rolls back.
4. A Phase 12 field decision on that Risk (for example `restore` of the accepted field) fails the same way through `addEvent(envelope.runId, …)`.

**Why it matters.**

- An ordinary workflow (hand-written Risk, rewrite, confirm, then fix a word) permanently blocks edits to the confirmed fields, with an "administrator must repair" message.
- The contract contradicts itself here. It says a hand-created Risk "gains the envelope … with that run … as its `runId`", that "an analyst's later edit of such a field makes it `edited` as today", and that "a v1 event on a `risk-rewrite` run stays refused". The 2026-10-16 amendment fixed this class of problem for added Risks (`risk-suggestions` runs) but not for this path.
- `risk-proposal-decisions.integration.test.ts:768-778` asserts that an envelope naming a rewrite run refuses edits, while the code itself creates such envelopes.

**Fix.** Pick one option and amend the contract to match:

- (a) Extend amendment item 1 to `risk-rewrite` runs. Accept Phase 12 v1 field events on a rewrite run when `target` is the run's own `risk` relation and the event's fields are within that run's units. Mirror the `parseRiskSuggestionsDecisionLog` split so the item fold reads only v2 events.
- (b) Route each v1 field event to `fieldRunId(provenance, field)`, grouped per run, with (a) as the acceptance rule.

**Test.** Integration test: create a Risk by hand, rewrite it, confirm `u-risk-cause`, then `PATCH /api/v1/risks/{id}` with a new `riskCause`. Expect 200, the fact becomes `edited`, and the v1 event is on the rewrite run. Repeat with a Phase 12 `restore` of `riskCause` and expect 200.

### BE2-02 (Critical): Undoing a confirmed residual change can leave an AI-confirmed Accept on a High or Critical residual rating

**Files:** `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-decisions.ts:345-364` (the undo branch at 358-361), `:280-293`

**Evidence.**

- `applyRiskProposalDecisions` adds a Risk to `confirmed` (the input to `assertAcceptRule`) only on `accepted` change units.
- The Undo branch (`undoConfirmedChange`, a restore of an accepted unit) writes `before.values` back through the update path but never records the Risk in `confirmed`.
- Scenario: the Risk's residual is High (Likely/Major) with Treat. A rewrite proposes `u-residual-rating` (Low) and `u-treatment` (Accept with a plan). Batch 1 confirms both, which passes. Batch 2 restores `u-residual-rating`. The Risk returns to a High residual while `treatmentAction` stays Accept, its fact `accepted` from the AI run.
- `assertAcceptRule` is never run for that Risk, so the batch succeeds.

**Why it matters.** D-38 and G-14 say the Accept rule holds end to end. Pitfall 11 is exactly "Accept left on a High risk", and T-16-30 (high) claims "either order and across batches proved". This path defeats that, and nothing re-checks it before release.

**Fix.** In the undo branch, record the Risk as well: `confirmed.set(item.riskDocumentId, { aiAccept: prev.aiAccept, residual: prev.residual || item.fields.some((f) => RESIDUAL_FIELDS.includes(f)) })`. The existing `units.residual && treatmentAction.state === "accepted"` check then refuses with `AI_ACCEPT_NOT_PERMITTED`. Treat the restore of a residual unit as a residual change in the contract text.

**Test.** Integration test of the scenario above. Expect batch 2 to answer 409 `AI_ACCEPT_NOT_PERMITTED` and persistence to stay deep-equal. Add a control case: Undo of `u-residual-rating` when the Accept was typed by a person (not an AI fact) still succeeds.

### BE2-03 (Warning): Phase 12 field events for a value a rewrite proposed are recorded on the wrong run

**Files:** `apps/backend/src/api/csrm-risk/services/risk-workflow.ts:295`, `apps/backend/src/api/csrm-assessment/services/ai-proposal-decisions.ts:318,348`, `apps/backend/src/api/csrm-assessment/services/ai-provenance.ts` (`fieldRunId`)

**Evidence.**

- Phase 16 introduces per-field run references (`fact.runId`), and readers resolve `fact.runId ?? envelope.runId`.
- The two writers of Phase 12 v1 events still use `provenance.runId` and `envelope.runId`: the human-edit `edited` event and `applyFieldDecisions`' accept and restore events.
- On a drafted Risk whose `riskCause` was later confirmed from rewrite R, an edit or restore of `riskCause` therefore appends its event to the draft run, a run that never proposed that value.

**Why it matters.** The audit trail (decision 6, WR-103: "who, when and why" on the run that proposed it) is misattributed. The 2026-10-16 amendment explicitly rejected this ("records the review … on a run that did not propose them"). BE2-01 is the failing face of the same root cause.

**Fix.** Write each v1 field event to `fieldRunId(provenance, field)`, splitting `edit.fields` by run. Add the rewrite-run acceptance rule from BE2-01(a).

**Test.** Integration test: confirm a rewrite unit on a drafted Risk, then edit the field. Expect the `edited` event on the rewrite run and none appended to the draft run.

### BE2-04 (Warning): The rewrite adapter checks a proposed Accept against a residual rating that the focus has dropped

**File:** `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-adapter.ts:302-315`

**Evidence.**

- `aiAcceptCheck` uses `proposed.residualLikelihood` and `proposed.highestResidualConsequence`, the AI's values.
- `diffIntoUnits` with focus `["treatment"]` then drops `u-residual-rating` as `outside-focus` but keeps `u-treatment` with `aiAccept`.
- On a High-residual Risk, the AI can lower the residual and propose Accept, and the run stores an Accept unit the Risk's real rating does not allow.
- The decision step refuses it (`residualRatingAfter(risk, [])`), and the read shows `acceptBlocked`. So the error surfaces only at decision, as a proposal that can never be confirmed.

**Why it matters.** D-38 says "the adapter turns an AI Accept into Treat … when the resulting residual rating is High or Critical". The adapter half of T-16-23 is not met under a focus.

**Fix.** Run the Accept check after the focus is applied. Compute the rating from `proposed` only when `ratings` is in focus; otherwise use `target.base`'s residual likelihood and consequence.

**Test.** Adapter unit test: High base residual, wire residual Low plus Accept, focus `["treatment"]`. Expect a Treat unit (or no `u-treatment`) and an `accept-not-permitted` adjustment.

### BE2-05 (Warning): The classification ceiling ignores the Risk records a risk proposal context now sends

**Files:** `apps/backend/src/csrm/ai/assessment-context-loader.ts:431`, `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-workflow.ts:123-129,266-279`, `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-context.ts:155-177`

**Evidence.**

- The policy is evaluated on `records.assets` (the request's selected assets) only.
- Phase 16 adds Risk content to the context: the rewrite target's twenty values, including `targetRisk.dataClassification` and the text, and the active and withdrawn Risks' statements and causes.
- A Risk's `informationAssetImpacted` is not limited to the request's assets (`risk-workflow.ts` `resolveRelations` only checks that the record exists), and `dataClassification` is analyst-writable.
- A Risk classified above the ceiling, or linked to a higher-classified asset outside the request, is therefore sent to the provider while the policy reports `allowed`.

**Why it matters.** T-16-26 (high) and G-3: data above the ceiling must not reach the provider.

**Fix.** Include the classification of every Risk the context lists (target, active, withdrawn) and of their linked assets in `evaluateAiDataPolicy`, in three places: at enqueue (`riskProposalPolicyRefusal`), at execution (`built.policy`) and in the read's `askReason`. Alternatively, leave out of the context any Risk above the ceiling and document that choice.

**Test.** Integration test: set a Risk's `dataClassification` above the configured ceiling, then start a rewrite of it. Expect 409 with the policy reason and no request on the fake provider server.

### BE2-06 (Warning): The rewrite context truncates the other Risks instead of refusing

**Files:** `apps/backend/src/csrm/ai/assessment-context-loader.ts:396-398`, `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-context.ts:251-252`

**Evidence.**

- The active Risks are read with `limit: entries + 1` (201), sorted by `id:asc`.
- For a rewrite, `others = active.filter(not target)` and the context refuses only when `others.length > 200`.
- With 250 active Risks and a target among the first 201 rows, `others` has exactly 200 entries: no refusal, and 49 Risks are silently left out.

**Why it matters.** Pitfall 13 and the module's own header say "refused, never truncated". The model is told "do not turn the target into one of them" with an incomplete list.

**Fix.** Read `entries + 2` rows for a rewrite, or exclude the target in the query (`documentId: { $ne: targetRiskId }`) and keep `limit: entries + 1`.

**Test.** Unit or integration test: 202 active Risks with the target first, then a rewrite. Expect `CONTEXT_TOO_LARGE` before any run.

### BE2-07 (Warning): The proposals read offers Undo of a rejected change on a withdrawn Risk, but the restore always fails

**File:** `apps/backend/src/csrm/ai/risk-proposals/risk-proposals-read.ts:291,331`

**Evidence.**

- `canUndo = state === "rejected" && editable`, and `canUndoChange = canUndo || …`, with no check that the Risk is active.
- Withdrawal supersedes only open units, so a rejected unit keeps `rejected`.
- The decision path runs `activeRiskOf` first and answers 409 `RISK_WITHDRAWN`. `risk-proposal-decisions.integration.test.ts:558` asserts that refusal.

**Why it matters.** The read advertises an action the server always refuses, and the UI shows a dead Undo control.

**Fix.** For change units, use `canUndo = state === "rejected" && editable && live`.

**Test.** Extend the 16-10 withdrawal test to assert that the rejected unit's `canUndo` is false in the read.

### BE2-08 (Warning): A failed job keeps showing as failed, and can be retried, after a later run on the same target succeeds

**Files:** `apps/backend/src/csrm/ai/proposal-job-registry.ts:246-256`, `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-workflow.ts:545-551`

**Evidence.**

- `failedFor` returns the latest failed job per key, whatever happened on that key since.
- `projectedRiskProposalJobs` drops a failed job only when an active job shares its key.
- When job A fails and the analyst starts again (a new job B, not a retry) and B completes, A is still listed as failed with `canRetry: true` (`mayRetry` holds: failed, nothing active on the key) until it expires an hour later.

**Why it matters.**

- The proposals read shows a stale failure next to B's results.
- A retry of A creates a redundant run that counts toward the 100-run cap and, for a rewrite, supersedes B's open units.
- D-41 intends a failure to stay visible only "until it is retried or expires".

**Fix.** On enqueue, remove or close any failed job with the same key (for example `jobs` entries where `status === "failed" && key === raw.key`). Alternatively, have `failedFor` skip a key whose newest job (by `queuedAt`) is not failed.

**Test.** Registry unit test: fail on key K, start a fresh job on K, and complete it. Expect `failedFor(scope)` to be empty and `mayRetry(A)` to be false.

### BE2-09 (Info): The damaged-run log is once per process, not once per read

**File:** `apps/backend/src/csrm/ai/risk-proposals/risk-proposals-read.ts:89-94`

The contract (phase-12 amendment, "A damaged run … is logged once per read") disagrees with the module-level `loggedDamagedRuns` Set, which logs once per process and grows without bound. **Fix:** align the contract to "once per process", or use a per-call set. **Test:** a unit test asserting the logging count across two reads.

### BE2-10 (Info): Registry errors at enqueue become a 500

**File:** `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-workflow.ts:403-406`

`registry.enqueue` can throw `ProposalJobRegistryError` (400 or 409). `startRiskProposalJob` does not convert it, and `handleError` in `controllers/risk-proposals.ts:46-52` rethrows unknown errors. `retry` already maps it at lines 495-500. **Fix:** wrap `enqueue` the same way.

### BE2-11 (Info): Every risk-workflow validation failure is reported as a stale proposal

**File:** `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-decisions.ts:125-135`

`asDecisionError` maps every `RiskWorkflowError` 400 to `AI_PROPOSAL_STALE`. A real validation failure of proposed values therefore reads as "the records have changed", which hides the defect. **Fix:** map only the known relation-missing case to STALE, and let other 400s surface as `AI_RUN_RECORD_UNAVAILABLE` or 400.

### BE2-12 (Info): The rewrite context drops control implementations without a control number

**File:** `apps/backend/src/csrm/ai/assessment-context-loader.ts:416`

`.filter((control) => control.controlNumber)` drops implementations whose control relation is missing. A Planned one then escapes the adapter's `riskHasPlannedControl` in `risk-proposal-adapter.ts:307`, and the prompt omits it. The decision-time check still catches it, so the effect is only an unconfirmable Accept proposal. **Fix:** compute `hasPlannedControl` from the unfiltered implementations.

### BE2-13 (Info): No limit on concurrent provider calls in one process

**File:** `apps/backend/src/csrm/ai/proposal-job-registry.ts`

Single flight is per key only. One assessment can run a suggestions job plus one rewrite per active Risk at once, up to the 100-run cap, each a provider call. T-16-27 lists only single flight and the run cap, so this is within the plan, but cost and rate limits are unbounded. **Fix (optional):** a per-process semaphore around `options.execute`.

### BE2-14 (Info): The decision-event parser accepts Phase 16 causes on questionnaire runs

**File:** `apps/backend/src/csrm/ai/proposal-items.ts` (`parseCause`)

`risk-withdrawn` and `assessment-not-editable` are accepted for any target kind, so a questionnaire run's log would accept them. The amendment keeps `questionnaire-frozen` on questionnaire runs and the two new causes on risk runs. **Fix:** let `DecisionPayloadParsers` declare the allowed cause kinds.

### BE2-15 (Info): The Requestor-text check passes a made-up questionnaire documentId

**File:** `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-workflow.ts:139`

`requestorTextCorpus` passes the invented documentId `${requestId}:no-questionnaire` so that Phase 15's corpus read finds nothing. This works, but it is fragile. **Fix:** make `questionnaireId` optional in `loadRequestorTextCorpus`.

### BE2-16 (Info): A failed commit during retry deletes the failed job record

**File:** `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-workflow.ts:502-504`

If the lock transaction fails after `registry.retry` has re-queued the job (a commit error), `discardReserved` removes the job entirely. The original failure then disappears and the job reads 404. **Fix:** restore the job to `failed` with its previous failure record instead of removing it.

## web curation lane

---
phase: 16-risk-curation-and-targeted-ai-re-runs
lane: web-curation
reviewed: 2026-10-16
depth: deep
diff_base: 01dc4118 (Phase 16 ranges 01dc4118..f2a39dbe and d1518c5f..HEAD)
files_reviewed: 32
files_reviewed_list:
  - apps/csrm/src/features/risk-curation/risk-card-actions.tsx
  - apps/csrm/src/features/risk-curation/withdraw-risk-form.tsx
  - apps/csrm/src/features/risk-curation/withdrawn-risk-card.tsx
  - apps/csrm/src/features/risk-curation/use-risk-withdrawal.ts
  - apps/csrm/src/features/risk-curation/risk-history-frame.tsx
  - apps/csrm/src/features/risk-curation/risk-history-sheet.tsx
  - apps/csrm/src/features/risk-curation/risk-history-trigger.tsx
  - apps/csrm/src/features/risk-curation/risk-curation-refusal-copy.ts
  - apps/csrm/src/features/risk-curation/risk-curation-domain.ts
  - apps/csrm/src/features/assessments/assessment-editor.tsx
  - apps/csrm/src/features/assessments/risk-editor.tsx
  - apps/csrm/src/features/assessments/assessment-schema.ts
  - apps/csrm/src/features/assessments/assessment-actions.ts
  - apps/csrm/src/features/assessments/release-readiness-summary.ts
  - apps/csrm/src/features/risks/risk-details.tsx
  - apps/csrm/src/features/risks/risk-details-states.tsx
  - apps/csrm/src/features/risks/risk-domain.ts
  - apps/csrm/src/features/risks/risk-register.tsx
  - apps/csrm/src/features/risks/risk-register-filters.tsx
  - apps/csrm/src/features/risks/risk-schema.ts
  - apps/csrm/app/(app)/app/risks/[documentId]/page.tsx
  - apps/csrm/app/(app)/app/risks/[documentId]/error.tsx
  - apps/csrm/app/(app)/app/risks/[documentId]/loading.tsx
  - apps/csrm/app/(app)/app/risks/[documentId]/not-found.tsx
  - apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx
  - apps/csrm/src/components/csrm/status-badge.tsx
  - apps/csrm/src/features/attachments/files-list.tsx
  - apps/csrm/src/lib/session-drafts/session-drafts.ts
  - apps/csrm/src/lib/api/conflict-reasons.ts
  - docs/design/csrm-design-direction.md
  - apps/csrm/e2e/risk-curation.spec.ts
  - apps/csrm/e2e/risk-register-workflow.spec.ts
findings:
  critical: 1
  warning: 7
  info: 8
  total: 16
status: issues_found
---

# Phase 16 web curation review

Lane 3 read the Phase 16 change to the withdraw and reinstate flow (`useRiskWithdrawal`, `WithdrawRiskForm`, `WithdrawnRiskCard`, `RiskCardActions`), the Risk history sheet (trigger, frame, body), the assessment editor's Phase 16 additions (the `Show` filter, the curation forms, the history dialog, `Discard new risk`, the overall-rating hint, the new readiness item), the Risk Register withdrawn view and the Risk detail page's withdrawn notice and states. I traced each act through the Server Actions in `risk-curation-actions.ts` and `assessment-actions.ts` to the refusal copy, and checked the backend's withdraw and reinstate semantics where the client depends on them (`apps/backend/src/api/csrm-risk/services/risk-curation.ts`).

Authorisation is sound in this lane. Every curation control is a courtesy, and Strapi decides each act again. Reasons, history values and notices render as React text nodes, with no `dangerouslySetInnerHTML` (T-16-34). Inputs pass through `.strict()` zod schemas in the Server Actions (T-16-32).

The defects are about state and focus:

- **Lost input (Critical):** the `Show` filter unmounts the whole Active list. Any unsaved Risk, mitigation-control or new-Risk input is lost without warning, which breaks the UI contract's "No lost input" row.
- **Focus (Warning):** two focus paths go wrong. The withdraw form takes focus from the Risk form while the analyst is typing in it. After `Keep` on a form that a refusal reopened, focus is lost.
- **Silent outcomes (Warning):**
  - A withdrawal that another analyst already made drops this analyst's reason without saying so.
  - A `RISK_WITHDRAWN` refusal on an edit shows the R1 sentence, but the Risk is never refreshed (§6.5).
- **Links that land nowhere (Warning):** links to cards go nowhere while the other list is shown. `Show in AI proposals` cannot land while the history sheet is modal.
- **History paging (Warning):** pages are merged without removing duplicates, so a change recorded while the sheet is open repeats an entry and duplicates a React key.

On the route budget, nothing in this lane adds a large static dependency to `/app/risks/{documentId}` or `/app/requests/{documentId}`. The history trigger and its body load on demand. The `risk` status family adds one icon and its mapping to every route that renders a `StatusBadge`, including the Requestor's request page (FE3-14).

---

### FE3-01 (Critical): The `Show` filter unmounts every Risk form, so unsaved Risk, control and new-Risk input is lost

**File:** `apps/csrm/src/features/assessments/assessment-editor.tsx:805-821` (with `:463-469`, `:812-813`; `apps/csrm/src/features/assessments/risk-editor.tsx:192-260`; `apps/csrm/app/(app)/app/review/assessments/[documentId]/page.tsx:63,91,101`)

**Evidence:**

- The Identified Risks body renders `filter === 'active' ? (<>…lists.active.map(activeRiskCard)…{addingRisk ? <RiskEditor mode="create" …/> : …}</>) : (<div data-risk-list="withdrawn">…</div>)`. Choosing `Withdrawn (n)` removes every active card's `RiskEditor`, every `ControlImplementationEditor` (edit and create), every `AiControlSuggestions` and the open `Add Risk` form.
- `RiskEditor` keeps its values only in `useForm` state. It has no session draft, no `useUnloadWarning` and no `useLeaveGuard` (none of these match in `risk-editor.tsx`, `control-implementation-editor.tsx` or `assessment-editor.tsx`).
- Choosing `Active` again remounts the forms from the served Risk, so the typed values are gone.
- `addingRisk` stays `true`, so the `Add Risk` form comes back empty, because `newRiskDraft` is `null`.
- `chooseFilter` also calls `router.replace(…)`, which re-runs `AssessmentEditorContent`. If that read fails (any 403 or other error at `page.tsx:63`, `:90-91` or `:100-101`), the page returns `<AssessmentEditor state="error" />` or `"permission"`. `PopulatedAssessmentEditor` then unmounts and every form on the page is lost. Before this change, a view toggle never took that path.

**Why it matters:**

- 16-UI-SPEC's accessibility contract says "No lost input … Decisions never reset an unsaved Risk form", and §6.3 makes `Show` an ordinary, frequent control ("Choosing an option moves no focus").
- An analyst who edits a Risk statement and then checks the Withdrawn list, for example to compare with a withdrawn duplicate, loses the edit silently.
- No test covers it. `assessment-editor.test.tsx:1899-1952` checks the counts and the checked option, never a typed value across a `Show` change.

**Fix:** Keep both lists mounted and hide the one not chosen, so form state survives:

```tsx
<div className="grid min-w-0 gap-5" data-risk-list="active" hidden={filter !== 'active'}>…active cards, Add Risk form and control…</div>
<div className="grid min-w-0 gap-5" data-risk-list="withdrawn" hidden={filter !== 'withdrawn'}>…withdrawn cards…</div>
```

`defaultFocusAfter` already scopes to the card's own `[data-risk-list]`, and `hidden` takes the inactive list out of the accessibility tree and out of print. Separately, a failed re-read after a `Show` change (or after any revalidation) should keep the editor mounted. The page can render the editor with a non-blocking "not refreshed" notice instead of swapping in the error state when it already holds a populated assessment. If that is out of scope, the filter could update the address with `{ scroll: false }` without making the read able to unmount the editor.

**Test:**

- In `assessment-editor.test.tsx`, type into R-1's `Risk statement`, choose `Withdrawn (1)`, then `Active (2)`, and expect the typed value.
- Open `Add Risk`, type, toggle, and expect the value.
- An e2e step in `risk-curation.spec.ts` does the same at 375 and 1440.

---

### FE3-02 (Warning): The open withdraw form takes focus from the Risk form while the analyst types in it

**File:** `apps/csrm/src/features/risk-curation/withdraw-risk-form.tsx:114-121` (with `assessment-editor.tsx:556`, `risk-editor.tsx:252-255`)

**Evidence:**

- `useEffect(() => { … focusFirst(); const frame = requestAnimationFrame(focusFirst); … }, [blocked, phone])`, where `blocked = mode === 'withdraw' && hasUnsavedChanges`.
- From 768px the form is an in-place well in the same `CardContent` as the Risk's `RiskEditor` (`assessment-editor.tsx:630` then `:652`). With the form open, the analyst can click into `Risk statement` below it and type.
- The first keystroke makes `unsaved` true in `RiskEditor`. Its effect calls `onUnsavedChange(true)`, then `noteUnsaved` re-renders the editor with `hasUnsavedChanges`, and `blocked` flips to `true`.
- The effect then focuses `Keep risk` twice, in the same task and on the next frame. The analyst's next keystrokes go to `Keep risk`, and a space or Enter closes the form.
- The reverse also happens. Saving the Risk (blocked flips back to `false`) moves focus from `Save risk` into the reason field, which takes the analyst away from the save confirmation.

**Why it matters:** This breaks WCAG 3.2.2 (On Input, no unexpected change of context). Keyboard and screen-reader users lose their place, and a stray key can dismiss the form.

**Fix:** Move focus only when the form opens, not when `blocked` changes. Key the effect on mount, plus the refusal reopen that the parent already re-keys:

```ts
useEffect(() => {
  if (phone) return undefined;
  focusFirst();
  const frame = requestAnimationFrame(focusFirst);
  return () => cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- on opening only
}, []);
```

If `blocked` flips while focus is inside the form (for example, the focused field is replaced by the line), move focus to `Keep risk` only when `form.contains(document.activeElement)` was true before the change.

**Test:** In `withdraw-risk-form.test.tsx`, render with `hasUnsavedChanges={false}`, focus an outside input, re-render with `hasUnsavedChanges`, and expect focus to stay on the outside input. In `assessment-editor.test.tsx`, open `Withdraw risk`, type into `Risk statement`, and expect the statement field to stay focused.

---

### FE3-03 (Warning): After a refused act, `Keep risk` or `Keep withdrawn` drops focus to the page

**File:** `apps/csrm/src/features/assessments/assessment-editor.tsx:548-567`; `apps/csrm/src/features/risk-curation/withdraw-risk-form.tsx:130-134`

**Evidence:**

- `onSubmit` calls `close()`, which runs `setCurationForm(null)` before the act is sent.
- When the act is refused, the form reopens from `withdrawal.refusal` with `returnFocusTo={curationForm?.riskId === riskId ? curationForm.opener : null}`. Because `curationForm` is now `null`, that evaluates to `null`.
- In the reopened form, `keep()` calls `onKeep()` and then `if (target) …focus()`. With no target, nothing takes focus: the form unmounts and focus falls to `<body>`.
- On a phone, the sheet's `onCloseAutoFocus` is `preventDefault`ed (`withdraw-risk-form.tsx:197`), so Radix does not restore focus either.

**Why it matters:** §6.1 sends focus back to the control that opened the form when it is kept. After a refusal, a keyboard or screen-reader user who chooses `Keep risk` (or presses Escape) is sent to the top of the document.

**Fix:** Keep the opener when the form closes on submit, for example by storing it on the refusal or in a ref:

```ts
const lastOpener = useRef(new Map<string, HTMLElement | null>());
// on open: lastOpener.current.set(riskId, opener)
returnFocusTo={curationForm?.riskId === riskId ? curationForm.opener : lastOpener.current.get(riskId) ?? null}
```

The pill is still connected after the rollback. If it is not, fall back to the card (`#risk-{id}`).

**Test:** In `assessment-editor.test.tsx`, make `withdrawRisksAction` resolve with a 409 `ASSESSMENT_NOT_MUTABLE` failure, submit, wait for the reopened form, press Escape, and expect focus on `Withdraw risk R-1`.

---

### FE3-04 (Warning): Withdrawing a Risk that another analyst already withdrew drops the analyst's reason silently and clears its draft

**File:** `apps/csrm/src/features/risk-curation/use-risk-withdrawal.ts:144-146`

**Evidence:**

- Strapi answers a withdrawal of an already-withdrawn Risk with 200 and the Risk under `unchanged` (backend `risk-curation.ts`, "a batch whose `applied` list is empty writes nothing").
- `succeeded` first runs `clearSessionDraft('risk-withdraw-reason', …)` and then `if (!result.applied.includes(risk.documentId)) return;`. No toast or line is shown, and the typed reason is neither recorded nor kept.
- The card ends in the Withdrawn list carrying the other analyst's reason. The analyst gets no signal that their own reason was not recorded.
- The same happens after a thrown or network failure on a withdrawal that Strapi did record. The form reopens with `Try again`, and the second submit takes this silent path.

**Why it matters:** The history (the audit trail) no longer matches what the analyst believes they recorded, and their reason is gone from the session store. X-27 says each act "confirms with an Undo toast", so a silent outcome is unexpected.

**Fix:** When `applied` does not include the Risk, show an info or warning toast, for example `{risk number} was already withdrawn by {name}. Your reason wasn’t recorded.` Keep the draft, clearing it only when the Risk is in `applied`. Apply the same rule to a reinstatement inside a mixed batch.

**Test:** In `use-risk-withdrawal` or `assessment-editor.test.tsx`, make `withdrawRisksAction` return `{ ok: true, data: { applied: [], unchanged: ['r1'] } }`. Expect a toast naming the outcome and `readSessionDraft('risk-withdraw-reason', owner, 'r1')` to still hold the reason.

---

### FE3-05 (Warning): A `RISK_WITHDRAWN` refusal on an edit says "Reinstate it" but never refreshes the Risk, so the card stays an editable active card

**File:** `apps/csrm/src/features/assessments/assessment-actions.ts:147-164, 365-389`; `apps/csrm/src/features/assessments/risk-editor.tsx:326-334`

**Evidence:**

- §6.5 says: "A refused change from a stale page shows §13 R1's `RISK_WITHDRAWN` copy, and the page refreshes the Risk."
- `serviceFailure` maps 409 `RISK_WITHDRAWN` to `This risk has been withdrawn, so it can’t be changed. Reinstate it to change it.`, but `AssessmentServerActionResult` returns only `formError`. The closed reason is dropped, and no `revalidatePath` runs on failure.
- `RiskEditor.submit` (and `ControlImplementationEditor`) only calls `setFormError(result.formError)`. Nothing calls `refreshAssessment` or `router.refresh()`.
- The analyst therefore sees "Reinstate it to change it" on a card that still shows `Withdraw risk`, the editable form and no `Reinstate risk`, until they reload by hand.
- The Risk detail page already refreshes on any 409 (`risk-actions.ts:152-182`), so the two pages disagree.

**Why it matters:** The UI contract is not met. The page shows contradictory state, and the copy's instruction cannot be followed from that card.

**Fix:** Return the closed `reason` (or a `refresh: true` flag) on `AssessmentServerActionResult` for this refusal. Have `RiskEditor`, `ControlImplementationEditor` and the removal path call their `onDecision` or `refreshAssessment` callback when it is set, so the card moves to the Withdrawn list. Keep the typed values in the error state.

**Test:** In `assessment-editor.test.tsx`, make `updateRiskAction` resolve `{ ok: false, formError: RISK_WITHDRAWN_EDIT, reason: 'RISK_WITHDRAWN' }`. Expect `refreshAnalystAssessmentAction` to be called and, with a refreshed Risk that carries withdrawal facts, `Withdrawn (1)`.

---

### FE3-06 (Warning): Links to Risk cards go nowhere while the other `Show` list is chosen

**File:** `apps/csrm/src/features/assessments/assessment-editor.tsx:805-821, 917-928`; `apps/csrm/src/features/risk-curation/ai-proposals-section-client.tsx:163, 204`

**Evidence:**

- The readiness card is rendered whatever `filter` holds. Its outstanding-Risk rows link to `#risk-{id}…` (`releaseReadinessHref`, `assessment-domain.ts:117-119`).
- The AI proposals section's `Open AI rewrites` index links to `#risk-{id}-rewrite`, and `Added as {risk number}` links to `#risk-{id}`.
- All of these targets exist only while `filter === 'active'`. With `Withdrawn` chosen they are not in the DOM, so the click changes the hash and nothing lands, and `useHashLanding` finds no element.
- Nothing switches the filter back: `chooseFilter` has no other caller (`grep RISK_FILTER_PARAM|chooseFilter`).

**Why it matters:** The contract's "Every figure opens its records" fails exactly where analysts compare withdrawn and active Risks. The link looks broken.

**Fix:** When a same-page link names a Risk that is not in the shown list, switch the filter first and then land. For example, in the editor:

```ts
useHashLanding((id) => {
  const riskId = id.match(/^risk-(.+?)(-rewrite)?$/)?.[1];
  const risk = riskId && withdrawal.risks.find((r) => r.documentId === decodeURIComponent(riskId));
  if (risk) { const want = risk.withdrawal ? 'withdrawn' : 'active'; if (want !== filter) chooseFilter(want); }
});
```

Fixing FE3-01 by keeping both lists mounted alone does not solve this, because the hidden list's targets are not shown.

**Test:** Render with `riskFilter="withdrawn"` and an outstanding requirement on R-1. Click `R-1: 2 outstanding` and expect `Active (n)` to be checked and the R-1 card to have focus.

---

### FE3-07 (Warning): `Show in AI proposals` in the modal history sheet cannot land; the sheet stays open and focus stays trapped

**File:** `apps/csrm/src/features/risk-curation/risk-history-sheet.tsx:153`; `apps/csrm/src/features/risk-curation/risk-history-frame.tsx:52-67`; `apps/csrm/src/features/assessments/assessment-editor.tsx:185-187`

**Evidence:**

- The link is a plain `RecordLink` (`next/link`) to `#ai-proposal-{run}-{item}` or `#ai-proposals`, inside a Radix `Dialog` with a modal `FocusScope`.
- Clicking it changes the hash, and `useHashLanding` in `ai-proposals-section-client.tsx` calls `landOn`. That scrolls the page behind the overlay and calls `focus()` on an element outside the dialog, which the modal `FocusScope` pulls back inside.
- Nothing closes the sheet. Below 768px the sheet is full-screen, so nothing visible changes at all.
- When the analyst then closes the sheet, `onCloseAutoFocus` focuses the opener (`target.focus()` without `preventScroll`). That scrolls back to the Risk card and undoes the landing.

**Why it matters:** The §8.3 link does not work at any width. On a phone it looks dead.

**Fix:** Have the link close the sheet and land after the close. Add an `onFollow` prop to `RiskHistorySheetProps`, which the frame turns into `onOpenChange(false)` plus a "skip return focus" flag (the pattern `OpenRewritesIndex` already uses with `skipReturn`). Then land on the target in `onCloseAutoFocus` instead of focusing the opener.

**Test:** In `risk-history-sheet.test.tsx` (or the editor test), click `Show in AI proposals`. Expect the dialog to be gone and `document.activeElement` to be `#ai-proposal-run-2-s-1`.

---

### FE3-08 (Warning): History paging merges pages without removing duplicates, so a change recorded while the sheet is open repeats an entry and duplicates a React key

**File:** `apps/csrm/src/features/risk-curation/risk-history-sheet.tsx:237-251, 282`

**Evidence:**

- `showOlder` reads `page + 1` of a newest-first, page-numbered list, then `setState({ events: [...state.events, ...result.data.events] })`.
- If any change to the Risk is recorded between the two reads (another analyst's edit or confirmation, or this analyst's own save in the card while the sheet is open on desktop), the server's page 2 begins with the last entry of page 1.
- The list then shows that entry twice, keyed by the same `event.id`. React warns, and an item can be dropped or mis-reconciled.
- `focusEntry.current = state.events.length` then focuses the repeated entry, not the first new one. `historyCountLine(events.length, total)` also overcounts.

**Why it matters:** The audit view shows a duplicated change and a wrong `{shown} of {total}` figure, and focus lands on the wrong entry (§8.4).

**Fix:** Remove duplicates by `id` when merging, and focus the first event that was not already listed:

```ts
const seen = new Set(state.events.map((e) => e.id));
const fresh = result.data.events.filter((e) => !seen.has(e.id));
focusEntry.current = fresh.length ? state.events.length : null;
setState({ …, events: [...state.events, ...fresh] });
```

Better still, page by cursor (`before={occurredAt,id}`) if the contract allows.

**Test:** Mock page 1 as events 25..1 and page 2 as starting with event 1 again. Expect 25 + n unique entries, no duplicate key warning, and focus on the first new entry.

---

### FE3-09 (Info): The withdrawn notice starts a sentence in lower case when the withdrawer can no longer be read

**File:** `apps/csrm/src/features/risks/risk-details.tsx:183`

**Evidence:** `{withdrawal.by?.displayName ?? 'a Security Analyst'} withdrew this risk on …` renders "a Security Analyst withdrew this risk on …" as the first words of the notice. `WithdrawnRiskCard` uses the same fallback mid-sentence ("Withdrawn by a Security Analyst"), which is correct there.

**Fix:** Use `'A Security Analyst'` at the start of the sentence. **Test:** Add a `risk-details.test.tsx` case with `by: null` that expects the text to start with "A Security Analyst withdrew".

---

### FE3-10 (Info): A kept reason is not restored when the form opens blocked by unsaved changes and then unblocks

**File:** `apps/csrm/src/features/risk-curation/withdraw-risk-form.tsx:103-111`

**Evidence:** The restore effect runs only on mount and returns early when `blocked`. If the analyst opens `Withdraw risk` while the Risk form is unsaved, then saves it, the field appears empty although a session draft exists. Their first keystroke then calls `writeSessionDraft` and overwrites the kept reason.

**Fix:** Restore when the field first appears: run the effect on `blocked` becoming `false`, guarded by a `restoredOnce` ref. **Test:** Open with `hasUnsavedChanges` and a stored draft, re-render with `hasUnsavedChanges={false}`, and expect the reason and `Restored from earlier in this session.`

---

### FE3-11 (Info): The reason-length rules disagree between the counter, the error and the comments, and 500 is written out twice

**File:** `apps/csrm/src/features/risk-curation/risk-curation-domain.ts:224-232, 243-245`; `withdraw-risk-form.tsx:176`; `risk-curation-refusal-copy.ts:67`

**Evidence:**

- The counter shows `reason.length`, the untrimmed length, while `curationReasonError` measures `reason.trim().length`. So "503 of 500 characters" can submit successfully, and the error's "It has {n}" can differ from the counter.
- The JSDoc says "the length counts the characters the analyst typed", which the code does not do.
- `riskCurationRefusal` uses the literal `500` instead of `CURATION_REASON_MAX_LENGTH`, and `reasonTooLong` hard-codes "500".

**Fix:** Measure one length everywhere: trimmed, as the server stores it. Use the constant for the bound and in the sentence.

---

### FE3-12 (Info): Risk card ids and hash links are encoded inconsistently

**File:** `assessment-editor.tsx:615, 624`; `withdrawn-risk-card.tsx:163`; `use-risk-withdrawal.ts:76, 82`

**Evidence:**

- The active card's id is `risk-${encodeURIComponent(riskId)}`, but the withdrawn card uses `risk-${risk.documentId}`, and the hook looks cards up with `getElementById(`risk-${riskId}`)`.
- The card's `{k} AI changes to review` link is unencoded, while `OpenRewritesIndex` encodes the same target.

Strapi documentIds are alphanumeric today, so nothing breaks yet. One helper (`riskCardId(id)`) would make the lookups and the anchors agree.

---

### FE3-13 (Info): `next/dynamic` is called during render

**File:** `apps/csrm/src/features/risk-curation/risk-history-trigger.tsx:41-46, 73, 79`

**Evidence:** `createRiskHistorySheet` calls `dynamic()` inside a `useState` initialiser and inside `onReload`, with the `import()` outside the `dynamic()` call. Next documents that `dynamic()` must be called at module top level with the `import()` inline for its preloading and chunk matching. It works here only because `ssr: false` needs no preload.

**Fix:** Keep one module-level `dynamic()` for the normal path. For the reload path, use `React.lazy` with a fresh `import()` (or a keyed `Suspense` around a lazy component), which is allowed during render. Optionally confirm against `node_modules/next/dist/docs/` for this Next version.

---

### FE3-14 (Info): The `risk` status family puts `ArchiveIcon` on every StatusBadge route, including the Requestor's request page

**File:** `apps/csrm/src/components/csrm/status-badge.tsx:3, 143-150, 183`

**Evidence:** `statusPresentation` is one static map, so `ArchiveIcon` and `riskFamily` ship wherever `StatusBadge` is imported, including `/app/requests/{documentId}`, which has 419 bytes of headroom. A Requestor never sees a `Withdrawn` badge. This is within budget now, but it is the kind of shared-module growth that will tip the tight routes.

**Fix:** None is required now. If the next change to `status-badge.tsx` needs bytes, split the analyst-only families into a second map that the request route does not import.

---

### FE3-15 (Info): The register e2e now fails once the shared run database holds more than 50 Risks

**File:** `apps/csrm/e2e/risk-register-workflow.spec.ts:452-454`

**Evidence:** The proof reads one 50-row page and asserts `initialTotal <= 50`. The comment says Phase 16's journeys alone add "some 20", and they run per project (375 and 1440). Any later spec that adds Risks to the run's database, or any reordering of the specs, fails this assertion for a reason unrelated to the register.

**Fix:** Walk the pages in `visibleRiskNumbers` (or filter the proof to the two fixtures with `q=`) instead of bounding the database size.

---

### FE3-16 (Info): `Undo` on `New risk discarded.` does nothing once a new `Add Risk` form is already open

**File:** `apps/csrm/src/features/assessments/assessment-editor.tsx:476-487, 812-813`

**Evidence:**

1. After a discard, the analyst can choose `Add Risk` again; this sets `newRiskDraft` to `null` and mounts an empty create form.
2. Clicking the still-visible toast's `Undo` then runs `setNewRiskDraft(draft); setAddingRisk(true)`.
3. The mounted `RiskEditor` read `draft` only once, as its `useForm` default, and `focusFirstField` only on mount, so nothing changes.
4. The toast closes, and the discarded values are gone with no message.

**Fix:** Either dismiss the discard toast when a new form opens, or key the create `RiskEditor` on the draft (`key={newRiskDraft ? 'restored' : 'new'}`). If the open form already holds input, ask before replacing it.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer), lane 3 of 4_
_Depth: deep_

## web AI lane

---
phase: 16-risk-curation-and-targeted-ai-re-runs
lane: web-ai
reviewed: 2026-10-16
depth: deep
diff_base: 01dc4118 (Phase 16 ranges 01dc4118..f2a39dbe and d1518c5f..HEAD)
files_reviewed: 25
files_reviewed_list:
  - apps/csrm/src/features/risk-curation/ai-proposals-section.tsx
  - apps/csrm/src/features/risk-curation/ai-proposals-section-client.tsx
  - apps/csrm/src/features/risk-curation/ai-proposals-section-loader.tsx
  - apps/csrm/src/features/risk-curation/proposed-risk-card.tsx
  - apps/csrm/src/features/risk-curation/rewrite-form.tsx
  - apps/csrm/src/features/risk-curation/rewrite-form-body.tsx
  - apps/csrm/src/features/risk-curation/risk-rewrite.tsx
  - apps/csrm/src/features/risk-curation/risk-proposal-job.tsx
  - apps/csrm/src/features/risk-curation/risk-proposal-job-handoff.ts
  - apps/csrm/src/features/risk-curation/suggest-more-risks-button.tsx
  - apps/csrm/src/features/risk-curation/use-risk-proposal-decisions.ts
  - apps/csrm/src/features/risk-curation/risk-curation-actions.ts
  - apps/csrm/src/features/risk-curation/risk-curation-service.ts
  - apps/csrm/src/features/risk-curation/risk-curation-schema.ts
  - apps/csrm/src/features/risk-curation/risk-curation-domain.ts
  - apps/csrm/src/features/risk-curation/risk-curation-refusal-copy.ts
  - apps/csrm/src/features/risk-curation/test-fixtures.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-domain.ts
  - apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts
  - apps/csrm/src/features/ai-assistance/ai-inputs-changed.tsx
  - apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx
  - apps/csrm/src/features/ai-assistance/ai-run-sheet-trigger.tsx
  - apps/csrm/src/features/ai-assistance/field-comparison.tsx
  - apps/csrm/src/features/ai-assistance/field-comparison-domain.ts
  - apps/csrm/src/features/parser-free-modules.ts
findings:
  critical: 0
  warning: 8
  info: 5
  total: 13
status: issues_found
---

# Phase 16 web AI proposals review

The first range (`01dc4118..f2a39dbe`) does not touch any file in this lane, so every file below is new or changed in `d1518c5f..HEAD`. I also read the callers that decide what these components receive (`assessment-editor.tsx`, `risk-card-actions.tsx`, `risk-editor.tsx`), the backend Accept rule (`apps/backend/src/csrm/ai/risk-proposals/field-units.ts`, `risk-proposal-decisions.ts`, `risk-proposals-read.ts`, `risk-proposal-adapter.ts`), the generated contract and `docs/references/specification.json`, the related tests, and `e2e/risk-curation.spec.ts`.

**What holds:**
- **API layer.** Every Server Action parses its input with a `.strict()` zod schema and calls one function in `risk-curation-service.ts`. That service reaches Strapi only through the generated client's literal paths, with closed parsers, so there is no raw fetch and no facade.
- **Parsers.** The web parsers in `risk-curation-schema.ts` match `RiskCurationResponse`, `RiskHistoryResponse`, `RiskProposalJob(Response)`, `RiskAiProposals(Response)`, `RiskAiProposalItem`, `RiskAiRunFacts`, `AiRunContextRiskProposals` and the v5 `AiRunContextSummary` key for key, including nullability and bounds. I found no mismatch that would reject a valid response or accept an invalid one.
- **AI text.** Model text renders only as React text nodes: no `dangerouslySetInnerHTML` in scope, and diff marks are built from segments (T-16-34, T-16-36 hold).
- **Advisory only.** Every AI result needs an explicit Add, Confirm, Reject or Undo; nothing applies or releases on its own.
- **Requesting analyst.** The analyst who raised the request gets no proposals on the page (`proposalsView = null`) and only the frame line (T-16-39).
- **Route budget.** Nothing in this lane adds first-load bytes to `/app/requests/{documentId}` or `/app/risks/{documentId}`:
  - the request page imports none of these modules;
  - the Risk detail page reaches risk-curation code only through `dynamic()` (`risk-history-trigger`, then `risk-history-sheet`);
  - `ai-inputs-changed.tsx`'s new import of `risk-curation-domain.ts` stays on the server, because that file is a Server Component imported only by page files (its own guard test enforces this).

**What fails:** the defects are in client state and lifecycle.
- A polled job's outcome never reaches the section.
- On phones the job is not followed while the sheet is closed.
- Focus after starting a rewrite targets an attribute value that is never set.
- The rewrite control stays on offer while a rewrite runs, and the editor keeps a stale started job forever.
- The optimistic decision state can visibly reopen a decided proposal.
- The Accept pre-check is missing one of the server's two rules.

None of these lets an analyst do something Strapi would allow that they shouldn't, so I classified nothing as Critical.

## Narrative Findings (AI reviewer)

### FE4-01 (Warning): A job that fails (or vanishes) while being polled leaves the section "running": the start form never returns

**File:** `apps/csrm/src/features/risk-curation/risk-proposal-job.tsx:94-101`, `apps/csrm/src/features/risk-curation/ai-proposals-section-client.tsx:452-463, 474, 498-500, 602`

**Evidence:**
- `RiskProposalJob` keeps the polled job in its own state (`setJob(result.data)`, line 98) and tells the parent only about completion (`onCompleted`) or a retry (`onRetried`). When a poll returns `status: 'failed'`, the child renders the failure `Alert` (lines 129-147), but the section's own `job` state is still the queued or running object.
- So `running = isActiveJob(job)` stays `true` (line 474), `startForm` stays `null` (line 498), the phone summary keeps saying `The AI is looking for more risks` (line 602), and `Suggest more risks` is not offered (line 610).
- The seed effect (lines 408-411) only ever replaces the job with a non-null served one. Even `router.refresh()` cannot clear it unless the read happens to serve the failed job.
- The same root cause applies when the job record is gone. Jobs are process-local per the contract, so after a Strapi restart `getRiskProposalJob` answers 404. The child then shows `Status unavailable` and `Check again` indefinitely, and the section stays "running" until a full page reload.

**Why it matters:**
- 16-UI-SPEC §2.3, Failed: "The start form returns below it with its text kept." That does not happen for any job that fails during this page view, which is the common case (`PROVIDER_OUTPUT_INVALID`, `ASSESSMENT_NOT_MUTABLE`, `CONTEXT_TOO_LARGE`).
- The analyst cannot change the instruction and ask again. Where `canRetry` is false, they have no action at all until they reload.
- The tests only cover a failed job seeded from the read (`ai-proposals-section.test.tsx:174`), never a running job that fails under polling.

**Fix:** Report every terminal transition to the owner, and let the owner hold the truth:
```tsx
// risk-proposal-job.tsx
onSettled?: (job: RiskProposalJobView) => void; // completed or failed
...
setJob(result.data);
if (result.data.status === 'completed') onCompleted(result.data);
else if (result.data.status === 'failed') { onSettled?.(result.data); }
else setCycle((c) => c + 1);
// on a 404 from readRiskProposalJobAction: onSettled?.(null) or onGone(), and let the section reload the proposals read
```
```tsx
// ai-proposals-section-client.tsx
<RiskProposalJob ... onSettled={(next) => setJob(next)} />   // running becomes false, startForm returns
```
Do the same in `risk-rewrite.tsx`. **Test:** render the section with a queued job, have `readRiskProposalJobAction` resolve `{ ok: true, data: { ...job, status: 'failed', failureCode: 'PROVIDER_OUTPUT_INVALID' } }`, and assert the failure alert and the `#ai-proposals-instruction` textarea with `Suggest more risks` are both present. Add a second case where the read resolves `{ ok: false, status: 404 }` and assert the section re-reads the proposals and leaves the running state.

### FE4-02 (Warning): Below 768px the job is not followed while the proposals sheet is closed, and two focus movers stay armed for an element that is not in the DOM

**File:** `apps/csrm/src/features/risk-curation/ai-proposals-section-client.tsx:426-432, 452-456, 601-613`; `apps/csrm/src/features/risk-curation/suggest-more-risks-button.tsx:197-209, 221-223`

**Evidence:**
- On phones, `body`, which holds `<RiskProposalJob>` and the `aria-live` announcement, is rendered only inside `ProposalsSheet`. Radix `Dialog.Portal` mounts its children only while `open`. With the sheet closed:
  - nothing polls;
  - the summary's `jobLine` is computed from the section's stale `job` and says `The AI is looking for more risks` indefinitely;
  - `completed()` never runs, so `router.refresh()` never refreshes the Risk list and readiness;
  - the "{n} proposed risks are ready to review." announcement never fires.
- When the AI inputs signal's `Suggest more risks` hands a job over, `started()` sets `focusSelector` to `[data-ai-proposals-job-status]`. The effect at lines 426-432 runs on every render and leaves the selector armed until it finds the element, so the next time the analyst opens the sheet (with `Review AI proposals`, whose contract is focus on the title), focus jumps to the job status line.
- `SuggestMoreRisksButton` meanwhile keeps a `MutationObserver` on the whole `document.body` (`subtree`, `characterData`) until a non-empty status line appears. If the job completes before the sheet is opened, the status never appears. The observer then stays for the rest of the page view and calls `landOn()` on the next unrelated job status (scrolling and stealing focus).
- The same never-firing observer arises whenever the section body is not mounted (for example, the proposals read failed and `ProposalsReadError` is shown instead of the loader).

**Why it matters:**
- 16-UI-SPEC §2.6 says the phone summary carries "the state line or the job status". A status that never advances misreports the job.
- Focus moving to an element the analyst did not ask for breaks §2.6's "`Review AI proposals` opens it with focus on its title" (WCAG 2.4.3).

**Fix:**
- Keep the job follower mounted outside the sheet on phones: render a visually quiet `RiskProposalJob` (or a headless `useRiskProposalJob` hook) in the summary card, and pass its state into the sheet body.
- Clear `focusSelector` when the target is not present and the layout is the phone summary.
- In `SuggestMoreRisksButton`, disconnect the observer after a bounded time (as `openRisk` does with `OPEN_RISK_WAIT_MS`), or after the handed job settles.

**Test:** with `matchMedia` false, start a job via the handoff and keep the sheet closed. Resolve the poll as completed and assert the summary line updates and `router.refresh` is called. Then open the sheet with `Review AI proposals` and assert the title has focus.

### FE4-03 (Warning): After `Rewrite risk`, focus can never reach the rewrite's status line; it goes back to the trigger, or is lost on phones

**File:** `apps/csrm/src/features/risk-curation/rewrite-form.tsx:77-86`; `apps/csrm/src/features/risk-curation/risk-proposal-job.tsx:153`; `apps/csrm/src/features/risk-curation/risk-rewrite.tsx:266`

**Evidence:**
- `closeAutoFocus` looks for `[data-risk-rewrite-status]` and keeps only an element whose `dataset.riskRewriteStatus === riskId`.
- `RiskProposalJob` sets the attribute with `{...{ [statusAttribute]: '' }}`, so its value is always the empty string. The `find` therefore never matches, and the code falls back to `trigger.current`.
- From the phone menu the trigger is not visible: `RiskCardActions` hides the pill and opens the form through `rewrite.open`. Focusing it fails silently and focus drops to `document.body`.
- No test asserts focus after a rewrite starts; `risk-rewrite.test.tsx:93-112` stops at `onStarted`.

**Why it matters:** The comment states the intent ("Once the AI is asked, focus goes to the card's job status line"), and §4.2 makes that line the polite status for the job. Keyboard and screen-reader users lose their place after the main action of the form.

**Fix:**
```tsx
// risk-rewrite.tsx
<RiskProposalJob ... statusAttribute="data-risk-rewrite-status" statusValue={risk.id} />
// risk-proposal-job.tsx
{...{ [statusAttribute]: statusValue ?? '' }}
```
Alternatively, in `rewrite-form.tsx`, query `document.getElementById(\`risk-${riskId}-rewrite\`)?.querySelector('[data-risk-rewrite-status]')`. Retry over a few frames, because the section is loaded with `dynamic()` and may not be rendered after one `requestAnimationFrame`.

**Test:** in `risk-rewrite.test.tsx`, render `RewriteForm` beside a `RiskRewriteSection` whose `job` follows `onStarted`. Submit, and assert `The AI is rewriting R-3` has focus, at both widths.

### FE4-04 (Warning): `Rewrite this risk` stays on offer while that Risk's rewrite is queued or running

**File:** `apps/csrm/src/features/assessments/assessment-editor.tsx:537, 589-599`

**Evidence:**
- `rewrite={rewriteAllowed ? { trigger: <RewriteForm .../> } : null}`, where `rewriteAllowed = aiOpen && proposalsView.actions.rewrite.allowed`.
- Neither `rewriteJob` (computed at line 577 for the same card) nor its status takes part, and `RiskCardActions` has no other gate.
- `assessment-editor.test.tsx` and `risk-editor.test.tsx` never assert the control is absent while a job runs.

**Why it matters:**
- 16-UI-SPEC §4.1 says it is "never offered on a withdrawn Risk, after release, **while that Risk's rewrite is queued or running**". The analyst can open the form and start again. Strapi refuses the duplicate active job, so the second act ends in an R2 refusal the interface invited.
- Combined with FE4-03, focus returns to this still-offered control, which makes the duplicate start the natural next keystroke.

**Fix:**
```tsx
const rewriteRunning = isActiveJob(rewriteJob);
rewrite={rewriteAllowed && !rewriteRunning ? { ... } : null}
```
For this to be correct, `rewriteJob` must reflect the job's live status (see FE4-05 and FE4-01). **Test:** render the editor with a queued `risk-rewrite` job for `r3` and assert there is no `Rewrite this risk: RSK-0003` button and no menu item.

### FE4-05 (Warning): The editor's `startedRewrites` map is never cleared and outranks the served job, while a served job's no-change outcome is unmounted away

**File:** `apps/csrm/src/features/assessments/assessment-editor.tsx:332, 577-580, 594`; `apps/csrm/src/features/risk-curation/risk-rewrite.tsx:116, 125-128, 165-173`

**Evidence:**
- `rewriteJob = startedRewrites[riskId] ?? proposalsView.jobs.find(...)`. `startedRewrites` is only ever added to. After the job completes, `RiskRewriteSection.completed()` clears its own state, but the editor keeps passing the original queued object as `job`.
- The consequences:
  - `showsRewrite` stays true for that card for the rest of the page view.
  - The stale started object takes precedence over a newer served job or status (for example, another analyst's retry, or the served failed job).
  - Whenever the card remounts (switching `Show` to `Withdrawn` and back, or withdraw then Undo), `useState(seededJob)` starts again from the queued job. It polls a job that finished long ago: it announces "AI changes to … are ready to review." again and calls `router.refresh()`, or, after a restart, sits at `Status unavailable` (FE4-01).
- The reverse case: for a job the section only knows from the served read (a reload while it ran, or another analyst's job), a `no-change` completion removes the job from the next read and leaves `openChanges` at 0. `showsRewrite` turns false and the section unmounts before it can show §4.2's "The AI proposed no changes to {risk number}." (spec: "until the next page view").

**Why it matters:** The card's AI state depends on how the job was first seen rather than on the server. It re-announces finished work and drops a required outcome message.

**Fix:**
- Let the section report settlement up, and drop the local entry on completion, failure or retry: `onSettled={(job) => setStartedRewrites(({ [riskId]: _, ...rest }) => rest)}`.
- Prefer the served job when its key is newer.
- Keep the card's section mounted (or lift `finishedRun` into the editor) for a run that finished this page view, so the no-change line survives the refresh.

**Test:**
- Start a rewrite, complete it, toggle `Show` to Withdrawn and back, and assert `readRiskProposalJobAction` is not called again and no second announcement is made.
- Seed a running job from `proposals.jobs`, complete it with `outcome: 'no-change'`, re-render with a read that has no job, and assert the no-change line is shown.

### FE4-06 (Warning): A decided proposal can flip back to open after a successful decision (stale `items` closure in `settle`)

**File:** `apps/csrm/src/features/risk-curation/use-risk-proposal-decisions.ts:198-200, 237-239, 269-286`

**Evidence:**
- `settle()` records `source: items`, where `items` is the hook argument captured when the analyst clicked. `base` applies the settled changes only while `settled.source === items`.
- Take two decisions in a row: A, then B, clicked after A's decide resolved but while A's follow-up `readRiskAiProposalsAction` is still in flight (Server Actions run one at a time, so B's decide queues behind A's read).
  1. A's read lands (`setView(R1)`). R1 has A decided and B open, because it was read before B was sent.
  2. B's decide resolves and calls `settle()` with `source` = the pre-R1 items. That does not equal R1, so `base` = R1 with B open.
  3. When the transition ends, the optimistic layer is dropped and B's card reappears with live `Add to assessment` and `Reject` buttons until B's own re-read lands.
- A click in that window sends a second decision and gets `AI_PROPOSAL_ALREADY_DECIDED` with a danger toast.

**Why it matters:** This is the normal rhythm of triaging a group, deciding one proposal after another. The interface briefly contradicts a decision it has just confirmed in a toast, and invites a refused duplicate.

**Fix:** Settle against the items the hook holds now, not the ones it held at the click:
```ts
const itemsRef = useRef(items);
itemsRef.current = items;
function settle(change: Change) {
  setSettled((current) => {
    const source = itemsRef.current;
    return { source, changes: current.source === source ? [...current.changes, change] : [change] };
  });
}
```
A sturdier option is to keep settled changes keyed by proposal and drop each one once a read shows that item's state as not `open`. **Test:** decide A, resolve A's action, hold A's read pending, decide B, resolve A's read with only A decided, then resolve B. Assert B's `Add to assessment` never reappears.

### FE4-07 (Warning): The Accept pre-check is missing the server's second rule, so `Confirm` and `Confirm all` are offered for a change Strapi will refuse

**File:** `apps/csrm/src/features/risk-curation/risk-curation-domain.ts:442-461, 410-413`; `apps/csrm/src/features/risk-curation/risk-rewrite.tsx:175-176`; server `apps/backend/src/csrm/ai/risk-proposals/risk-proposal-decisions.ts:280-292`

**Evidence:**
- Server-side, `assertAcceptRule` refuses a batch in two cases:
  - (a) an AI-proposed Accept that fails `aiAcceptCheck`;
  - (b) a confirmed **residual** change (`units.residual`) that leaves a High or Critical residual rating under an Accept the analyst confirmed from an AI proposal (`storedProvenance(risk)?.fields.treatmentAction?.state === "accepted"`). This is 16-RESEARCH Pitfall 11, and T-16-30.
- The web `acceptPreCheck` returns `null` as soon as `!item.aiAccept` (line 454), so it never sees case (b). The served `acceptBlocked` does not cover it either: `risk-proposals-read.ts:333-335` computes it only for `unit.aiAccept`.
- So a rewrite that proposes raising the residual rating on such a Risk shows `Confirm`, and counts the change in `Confirm all ({c})`.
- Because a batch applies all together or not at all, `Confirm all` then fails for every change it holds, every time, with R3's Accept sentence.
- The doc comment claims the pre-check "mirror[s] the server's one rule". The tests (`risk-curation-domain.test.ts:142-166`) cover only case (a).

**Why it matters:** UI-D19's purpose is that "Confirm is not offered when it would be refused". Here the bulk action becomes permanently unusable on that Risk, with no line explaining why.

**Fix:**
- Pass the Risk's treatment action and its `aiProvenance.fields.treatmentAction.state` into `AcceptCheckRisk`.
- Add the rule: if the item touches `residualLikelihood`, `highestResidualConsequence` or `residualRating`, the Risk's `treatmentAction === 'Accept'` with an AI-confirmed Accept, and the derived residual after the change is High or Critical, return `'AI_ACCEPT_NOT_PERMITTED'`.
- Preferably, ask the server to fold case (b) into `acceptBlocked` (a contract change to document).

**Test:** a domain test with `riskNow = { treatmentAction: 'Accept', aiAcceptConfirmed: true, residualRating: 'Moderate' }` and a residual change proposing `Likely`/`Major` should return `AI_ACCEPT_NOT_PERMITTED`, and `confirmableCount` should exclude it.

### FE4-08 (Warning): The focused job status line is removed on completion or failure, so focus falls to `<body>`

**File:** `apps/csrm/src/features/risk-curation/ai-proposals-section-client.tsx:452-463, 504`; `apps/csrm/src/features/risk-curation/risk-proposal-job.tsx:129-153`; `apps/csrm/src/features/risk-curation/suggest-more-risks-button.tsx:199-203`

**Evidence:**
- Starting a suggestion deliberately focuses the job status `<p tabIndex={-1}>`, through `started()` → `focusSelector` and through `SuggestMoreRisksButton`'s `landOn`.
- On completion, `RiskProposalJob` returns `null` (line 148) and the section unmounts it (`setJob(null)`).
- On failure, the same component swaps the status line for an `Alert` (lines 129-147).
- Either way the element holding focus leaves the DOM and the browser moves focus to `document.body`. The comment "focus is never moved on completion" holds only for a user whose focus was elsewhere.

**Why it matters:** For keyboard and screen-reader users who waited on the status line (the place the interface put them), the next Tab starts from the top of the page (WCAG 2.4.3). §2.3's "Focus does not move" is meant to avoid yanking focus, not to lose it.

**Fix:** Before unmounting, if `document.activeElement` is inside the job container, move focus to the section's persistent status line (`[data-ai-proposals-status]`), or on failure to the alert's title. Leave focus alone otherwise. **Test:** start a job, assert the status line has focus, resolve the poll as completed, and assert `document.activeElement` is the `n open proposals` status line, not `body`. Repeat with a failed poll.

### FE4-09 (Info): The decision and rewrite input schemas are looser than the contract, and a malformed rewrite input reads as a 409 sentence

**File:** `apps/csrm/src/features/risk-curation/risk-curation-schema.ts:212-217`; `apps/csrm/src/features/risk-curation/risk-curation-actions.ts:283, 415-419`

**Evidence:**
- `riskProposalDecisionSchema` accepts `reason` with `accept` and `restore`, while `AiProposalRunDecision` says "Only with `reject`", so Strapi answers 400.
- `rewriteInputSchema.focus` has no `.min(1)` (contract `minItems: 1`). It is saved only by the hand-written pre-check at line 415.
- A parse failure of the rewrite input returns `failure({ status: 400 }, riskAiStartRefusal({ status: 409 }))`, which pairs status 400 with the state-conflict sentence "The AI can't be asked in this assessment's current state."

**Fix:** Use a discriminated union on `action` with `reason` only on `reject`; add `.min(1)` to `focus` and drop the manual pre-check; map a parse failure to `riskAiStartRefusal({ status: 400 }, { operation: 'rewrite' })` or to a neutral sentence. **Test:** extend `risk-curation-actions.test.ts` so that `{ action: 'accept', reason: 'x' }` is refused before the service is called.

### FE4-10 (Info): A rejection's reason is cleared and its row closed before the decision is sent, so a blocked refusal loses the typed reason

**File:** `apps/csrm/src/features/risk-curation/proposed-risk-card.tsx:114-122`; `apps/csrm/src/features/risk-curation/ai-proposals-section-client.tsx:572, 590`; `apps/csrm/src/features/risk-curation/risk-rewrite.tsx:291, 312-315`

**Evidence:**
- `ReasonRow.reject()` writes `''` to the session draft and calls `onReject`, which closes the row before the Server Action resolves.
- A retryable refusal's `Try again` resends the same reason. A blocked refusal, or a dismissed retryable toast, leaves the analyst to type the reason again.

**Why it matters:** 16-UI-SPEC §15 says "Refusals never clear a field." This is low impact, because a blocked rejection usually means the item can no longer be rejected.

**Fix:** Clear the draft in the decision's `onSuccess` (already plumbed through `RejectInput.onSuccess`) rather than on submit.

### FE4-11 (Info): Dead or fragile code paths

**File:**
- `apps/csrm/src/features/risk-curation/risk-curation-refusal-copy.ts:189-197`: the `interrupted` option is never passed. Jobs are process-local, so an interrupted job is never served and this sentence is unreachable.
- `apps/csrm/src/features/risk-curation/rewrite-form-body.tsx:202`: a refusal is routed to the parts fieldset by comparing `result.message === NO_PART`, so any copy edit silently reroutes it to the instruction field.
- `apps/csrm/src/features/risk-curation/risk-curation-actions.ts:300-301`, `ai-proposals-section-loader.tsx:105`, `risk-proposal-job.tsx:25`: `PROPOSALS_LOAD_FAILED` and `STATUS_UNAVAILABLE` are each defined twice, which invites drift.

**Fix:** Remove `interrupted` or wire it to a served code. Have the action return a closed `field: 'focus' | 'instruction'` discriminator. Move the two strings into `risk-curation-domain.ts` (zod-free, so the bundle is unaffected).

### FE4-12 (Info): The handoff map can deliver a stale job on a later client-side visit

**File:** `apps/csrm/src/features/risk-curation/risk-proposal-job-handoff.ts:124-136`

**Evidence:**
- `pending` is module state that lives for the whole SPA session. If the section never mounts for that assessment during the visit (the proposals read failed, or the viewer navigates away first), the job stays in the map.
- On a later client-side navigation back, the section's mount-time `receive()` takes it. `started()` then follows a long-finished job: it re-announces "ready to review" and refreshes the page, or, after a restart, shows `Status unavailable`.

**Fix:** Store `{ job, at: Date.now() }`, and discard entries older than the poll timeout or whose `assessmentId` page has unmounted (for example, clear the map on the signal button's unmount).

### FE4-13 (Info): A security negative in the e2e journey can silently skip, and two decision branches are conditional

**File:** `apps/csrm/e2e/risk-curation.spec.ts:543, 353, 417, 425`

**Evidence:**
- `PH16_NEG_UNRELATED_REQUESTOR` (T-16-40) runs `test.skip(!assessmentId || !withdrawn, ...)`. Any earlier journey failure turns the access-control negative into a skip rather than a failure.
- `if (await compare.count() > 0)` and the two `Reject remaining` branches make the compare view and the bulk-rejection paths optional, so a regression that removes those controls passes.

**Fix:** Seed the negative's assessment and withdrawn risk independently, or fail rather than skip. Assert the presence of the controls the seeded data guarantees, or seed data that guarantees them.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer), lane 4 web AI_
_Depth: deep_
