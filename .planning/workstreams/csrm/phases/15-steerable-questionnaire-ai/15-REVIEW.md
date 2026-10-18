---
phase: 15-steerable-questionnaire-ai
reviewed: 2026-10-13
depth: deep
diff_base: 15eb830b
files_reviewed: 163
status: issues_found
findings:
  critical: 21
  warning: 10
  info: 0
  total: 31
---

# Phase 15 code review

Three independent read-only lanes reviewed the changes since `15eb830b`. Lane bodies are preserved verbatim below. Severity is the reviewer classification; disposition validates each claim before accepting it. Ten frontend findings overlap pilot D1–D9/NVDA and are counted once each. CT-01/CT-02 concern operator-authored scripts outside Phase 15 and remain explicitly attributed. Reviewed-file counts overlap on contracts and generated types and are not a unique-source count.

## backend lane

---
phase: 15-steerable-questionnaire-ai
reviewed: 2026-10-13
depth: deep
diff_base: 15eb830b
files_reviewed: 40
files_reviewed_list:
  - apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts
  - apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts
  - apps/backend/src/api/csrm-assessment/services/ai-provenance.ts
  - apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-questionnaire/operations.ts
  - apps/backend/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts
  - apps/backend/src/api/csrm-questionnaire/services/deterministic-questionnaire-proposal-provider.ts
  - apps/backend/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-generation-provider.ts
  - apps/backend/src/api/csrm-questionnaire/services/openai-compatible-questionnaire-proposal-provider.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-answer-preservation.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-placement.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-adapter.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-context.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-decisions.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-envelope.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-gates.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-provider.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposals-read.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposals-workflow.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts
  - apps/backend/src/api/csrm-questionnaire/services/questionnaire-workflow.ts
  - apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json
  - apps/backend/src/csrm/ai/ai-inputs-signal.ts
  - apps/backend/src/csrm/ai/analyst-instruction.ts
  - apps/backend/src/csrm/ai/assessment-context-loader.ts
  - apps/backend/src/csrm/ai/assessment-context.ts
  - apps/backend/src/csrm/ai/not-sure-choice.ts
  - apps/backend/src/csrm/ai/prompt-sections.ts
  - apps/backend/src/csrm/ai/proposal-items.ts
  - apps/backend/src/csrm/ai/proposal-job-registry.ts
  - apps/backend/src/csrm/ai/text-similarity.ts
  - apps/backend/src/csrm/conflict-reasons.ts
  - apps/backend/src/csrm/files/extraction.ts
  - apps/backend/src/keycloak/development-fixture-subjects.ts
  - apps/backend/src/policies/csrm-authorization.ts
findings:
  critical: 5
  warning: 3
  info: 0
  total: 8
status: issues_found
---

# Phase 15 backend review

## Narrative Findings (AI reviewer)

Review is static and read-only against `15eb830b..HEAD`; no tests, builds, servers, database operations or git writes were performed. Evidence includes the changed backend modules and their actual authorization, definition, submission, locking and projection callers. Root `AGENTS.md`, Phase 15 context, UI contract and approved envelope amendments govern the findings.

The operator-authored `d32bb257` Keycloak path changes were distinguished from Phase 15 implementation; the changed backend fixture file is a comment-only relocation and contributes no finding. Backend `.env.example` and `README.md` changes were inspected additionally and introduce no reportable defect. The IN-306 watchdog was reviewed without treating the pilot's accepted fix as a new finding.

## Critical Issues

### BE-01: BLOCKER — Concurrent jobs exceed the run cap and hide undecided proposals from release gates

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposals-workflow.ts:180-186,320,423-451,516-519`

**Issue:** The 100-run bound counts completed runs only, before the provider call. Questionnaire-wide proposals and each question rewrite have separate registry keys. At 99 completed runs, one wide job and two rewrites can all pass the check, run their providers concurrently, and complete. Completion takes the governance lock but never rechecks or reserves the run bound, so all three persist, producing 102 completed runs in the same process. This is independent of the documented process-local/multiple-server residual.

The release/draft/replacement gate then reads only the first 101 runs in ascending id order (`questionnaire-proposal-gates.ts:38-42`), whereas the panel reads the newest 101 (`questionnaire-proposals-read.ts:183-187`). Decide the older items while leaving an item in run 102 open: after jobs finish the gate counts zero and allows release or draft generation with an undecided proposal. The approved amendment relies on the 100-run invariant to bound all these reads.

**Impact:** Bypasses D-08's mandatory per-question review and freezes or releases a questionnaire with hidden open work. The panel, context and gate can also disagree about which runs exist.

**Fix:** Reserve remaining capacity atomically for all keys of a questionnaire before creating a run/provider call, including in-flight reservations, and release the reservation on failure. Enforce the invariant again at locked completion. For records already over the bound, paginate all completed runs or explicitly handle overflow so no open item is omitted. Add a controlled concurrent wide-plus-two-rewrites case at 99 runs and prove the final gate sees every remaining open item.

### BE-02: BLOCKER — Hidden conditional questions suppress all submitted answers in follow-up context

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/csrm/ai/assessment-context-loader.ts:64-85`

**Issue:** `questionnaireContextQuestions` sets `submittedBatch` with `active.every(...)` before computing visibility. Submission writes submitted envelopes only for visible active questions (`questionnaire-workflow.ts:131-160`) and persists null for hidden questions (`:323-337`). Consequently a valid submitted questionnaire containing any currently hidden conditional question fails this new all-active test. Every visible submitted answer is omitted by `includeAnswer`, and the run records `answerContent: "withheld"`.

For example, Q1 is Yes/No and Q2 is shown only for Yes. Submit Q1=No: the server's proposal state and analyst answer read correctly say submitted, but a follow-up run sees no Q1 answer. The approved Phase 15 run amendment explicitly requires every **active, visible** question submitted; the existing analyst projection likewise tests the visible set (`questionnaire-scope.ts:672-674`).

**Impact:** Follow-up questions are generated without the submitted answers they must use; valid conditional questionnaires silently degrade instead of meeting QUES-12.

**Fix:** Compute visible active questions first and derive submission from that nonempty set, reusing the same submitted-batch predicate as the analyst read/state. Continue withholding draft answers. Cover a submitted visible controller with a null hidden dependent, and the corresponding draft batch, at the loader/provider boundary.

### BE-03: BLOCKER — Undoing an unreleased AI addition still discloses its text to the Requestor

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-questionnaire/services/questionnaire-scope.ts:671-695`

**Issue:** A confirmed AI addition creates a stored question. Undo before any release soft-removes it (`questionnaire-proposal-decisions.ts:424-427`), retaining its text, help text and choices. After other proposals are rejected and the questionnaire is released, the owning Requestor's `GET .../questions` still receives all these fields: `projectQuestions` maps `questions`, without an actor-specific removal filter. `active` is used only to decide answer visibility. The same all-row behavior also reaches Requestor mutation projections.

The timeline correctly drops the confirmation/Undo pair from the Requestor's history (`questionnaire-governance-log.ts:334-354`), but the question API bypasses that protection. A direct authorized API read reveals a never-released AI question that was explicitly taken out again. Frontend filtering cannot enforce the release/privacy boundary.

**Impact:** Exposes analyst-review content that the Requestor never received through release, violating D-07 and the explicit rule that an undone change within one review round leaves no Requestor trace. The old all-row projection predates Phase 15, but Phase 15 adds this concrete new disclosure producer.

**Fix:** Narrow Requestor question projections at the server boundary. Prefer omitting soft-removed rows entirely for Requestors; if legitimate released-question history must stay readable, distinguish previously released content from additions undone before release using the existing governance facts. Apply the same projection to mutation responses. Prove Confirm-add → Undo → Reject remaining → Release → owner GET and save return none of the undone text/help/choices, while analysts retain full history.

### BE-04: BLOCKER — Valid manual choice definitions cannot be snapshotted for an AI removal

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-envelope.ts:178-185,390-400`

**Issue:** `parseSnapshot` reuses `parseChoices`, which rejects duplicate labels ignoring case. The actual questionnaire definition parser accepts duplicate labels when choice values are distinct (`questionnaire-definition.ts:88-102`), and the manual mutation parser permits them (`questionnaire-governance-workflow.ts:112-141`). Such a definition is valid production state.

A removal proposal targeting an unanswered question with choices `{value:"a",label:"Other"}` and `{value:"b",label:"Other"}` passes the adapter's removal validation, because it changes no choice fields (`questionnaire-proposal-adapter.ts:522-526`). Confirmation stores the original question in `before` (`questionnaire-proposal-decisions.ts:389-397`). Appending that event then rejects this legal snapshot (`ai-run-record.ts:228-234`), throws `AiRunRecordError`, and rolls back the otherwise valid confirmation. The proposal controller does not map this error, so the request becomes a generic server failure.

**Impact:** A valid AI removal cannot be confirmed, and the accepted definition's history cannot be faithfully recorded. Manual removal/rejection is an unintended workaround.

**Fix:** Give snapshots the existing definition's exact choice rules; label uniqueness belongs to AI-generated proposed choices, not historical snapshots. Keep distinct-value validation. Test a completed removal proposal against a valid duplicate-label manual question, then Undo and compare the restored definition exactly.

### BE-05: BLOCKER — Proposal enqueue is not serialized with the release gate

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposals-workflow.ts:496-520`

**Issue:** Start validates state and enqueues outside `withQuestionnaireGovernanceLock`. Release checks the active registry inside that lock but then awaits its database write (`questionnaire-governance-workflow.ts:375-403`). On PostgreSQL, ordinary questionnaire reads do not wait for that row's `FOR UPDATE` lock. A concurrent start can read the unreleased state before/during release, finish its asynchronous validation after release's active-job check, and enqueue while release is committing. The job can likewise read the still-unreleased state before release commits, then create its run/provider work after the row unlocks. Completion treats the now-released awaiting-submission state as unfrozen (`questionnaire-proposals-workflow.ts:429-448`) and keeps new items open.

**Impact:** Release succeeds while a queued/running proposal job exists, and proposals may complete for a released questionnaire whose Requestor has not submitted. This violates D-06/D-08 despite both paths' individually plausible rechecks. It is a same-process transaction race, not the accepted shared-job-store limitation.

**Fix:** Establish state validation and active-job reservation atomically with the governance/release lock, and launch provider execution after the reservation transaction commits. Cover the equivalent retry admission as well. Add a PostgreSQL-style controlled interleaving after the release gate read, before its release write, and prove either start refuses the new state or release sees the reserved active job.

## Warnings

### BE-06: WARNING — Answer citations never identify the answered question

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposals-read.ts:120-144`

**Issue:** All `answered-question` sources return the generic label `An answered question`. The implementation comment acknowledges that the run preserves no Q-ref-to-question map. The UI contract §4.3 requires `Answered question: {question text}`, which the client cannot reconstruct safely once questions are inserted/removed between generation and reading. This makes multiple answer citations indistinguishable and prevents an analyst from checking the evidence behind a proposal.

**Fix:** Preserve the context's Q-ref mapping as identifiers only in an approved envelope location, then resolve each current question label at read time with a neutral fallback when gone; retain the rule that answer values never appear in the citation. This is a persisted-envelope change and must be routed through the pilot under the ruling's contract-boundary rule. If the pilot deliberately accepts generic citation labels, amend the UI contract and record the decision instead of claiming the named citation is implemented.

### BE-07: WARNING — Requesting analyst is offered Retry for an instructed job the server forbids

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts:177-179,279,293-299`

**Issue:** Direct generation-job projection and the hub's `getRequestGenerationJobs` compute `canRetry` solely from registry status/access. A human requesting analyst can read any retained generation job, so a failed instructed job started by another analyst is projected with `canRetry: true`. The retry handler then correctly denies that same viewer with `403 OWN_REQUEST` when the job carries an instruction. The affordance advertises an operation the viewer may never perform, and both the nested job and hub-level retry facts are wrong.

**Fix:** Apply the requesting-analyst/instruction rule to all served retry facts using the job's requestor, reusing one eligibility predicate with the actual retry handler. Test the failed instructed job read as its initiating analyst, another analyst and the requesting analyst, including the hub projection.

### BE-08: WARNING — Decision log capacity refusal escapes as an unhandled server failure

**File:** `/Users/vanbui/src/test/idambox/apps/backend/src/api/csrm-questionnaire/services/questionnaire-proposal-decisions.ts:549-550,594-597`

**Issue:** A run legitimately reaches its 5,000-decision bound through Reject/Undo cycles without filling the questionnaire governance log, because rejections write no governance events. The next otherwise legal batch reaches `appendAiRunDecisions`, which throws `AiRunRecordError` on capacity (`ai-run-record.ts:228-234`). The decision workflow catches only `QuestionnaireGovernanceError`, and the controller catches only proposal/governance errors, so an expected history-capacity refusal becomes a generic 500 with no actionable reason. The batch rolls back, but the UI cannot show its pinned Q2 history-unavailable recovery copy.

**Fix:** Check per-run decision capacity before persistence and translate exhaustion to a published safe conflict, preferably the existing `HISTORY_UNAVAILABLE` semantics after confirming the contract interpretation. Preserve the all-or-nothing batch. If undecided items remain at exhaustion, explicitly define an operator recovery path; repeatedly retrying the current batch cannot succeed. Verify a near-cap multi-event batch and the exact-cap refusal without weakening the 5,000 bound.

## Known pilot defects and excluded candidates

- **D6 remains known, not a new BE finding:** `csrm-authorization.ts:489-490` answers 403 before the transaction's new 409 release-state recheck. The pilot already directs the ownership-established state-conflict fix and privacy negative tests. This report does not duplicate it.
- `target.available` remains true for a soft-removed row, but staleness correctly refuses confirmation and no production frontend consumer uses this flag. No independently established behavioral defect was assigned for that candidate.
- Process-local proposal job retention and multi-server coordination are documented residuals; BE-01 and BE-05 demonstrate different defects within one process.
- Performance-only concerns and stylistic complexity were excluded. Test files were consulted for intended rules; none was reported as a source defect.

_Reviewer: backend read-only adversarial lane. Report only; no source modifications or commits._


## frontend lane

---
phase: 15-steerable-questionnaire-ai
reviewed: 2026-10-13
depth: deep
lane: frontend
diff_base: 15eb830b
files_reviewed: 55
files_reviewed_list:
  - "apps/csrm/app/(app)/app/questionnaires/[documentId]/page.tsx"
  - "apps/csrm/app/(app)/app/review/questionnaires/[documentId]/page.tsx"
  - "apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx"
  - "apps/csrm/app/sign-in/page.tsx"
  - "apps/csrm/src/components/csrm/confirm-dialog.tsx"
  - "apps/csrm/src/components/csrm/status-badge.tsx"
  - "apps/csrm/src/features/ai-assistance/ai-assistance-domain.ts"
  - "apps/csrm/src/features/ai-assistance/ai-assistance-schema.ts"
  - "apps/csrm/src/features/ai-assistance/ai-generation-facts-schema.ts"
  - "apps/csrm/src/features/ai-assistance/ai-inputs-changed.tsx"
  - "apps/csrm/src/features/ai-assistance/ai-provenance-domain.ts"
  - "apps/csrm/src/features/ai-assistance/ai-provenance-header.tsx"
  - "apps/csrm/src/features/ai-assistance/ai-run-sheet-frame.tsx"
  - "apps/csrm/src/features/ai-assistance/ai-run-sheet-trigger.tsx"
  - "apps/csrm/src/features/ai-assistance/ai-run-sheet.tsx"
  - "apps/csrm/src/features/ai-assistance/field-comparison-domain.ts"
  - "apps/csrm/src/features/ai-assistance/field-comparison.tsx"
  - "apps/csrm/src/features/assessments/assessment-actions.ts"
  - "apps/csrm/src/features/assessments/assessment-detail.tsx"
  - "apps/csrm/src/features/assessments/assessment-draft-job.tsx"
  - "apps/csrm/src/features/assessments/assessment-service.ts"
  - "apps/csrm/src/features/assessments/questionnaire-generation-job.tsx"
  - "apps/csrm/src/features/attachments/context-too-large-files.tsx"
  - "apps/csrm/src/features/parser-free-modules.ts"
  - "apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx"
  - "apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-loader.tsx"
  - "apps/csrm/src/features/questionnaire-ai/ai-proposals-panel.tsx"
  - "apps/csrm/src/features/questionnaire-ai/answered-question-note.tsx"
  - "apps/csrm/src/features/questionnaire-ai/decided-proposals.tsx"
  - "apps/csrm/src/features/questionnaire-ai/hub-proposal-job.tsx"
  - "apps/csrm/src/features/questionnaire-ai/instruction-field.tsx"
  - "apps/csrm/src/features/questionnaire-ai/proposal-edit-form.tsx"
  - "apps/csrm/src/features/questionnaire-ai/proposal-item-card.tsx"
  - "apps/csrm/src/features/questionnaire-ai/question-rewrite-control.tsx"
  - "apps/csrm/src/features/questionnaire-ai/questionnaire-ai-actions.ts"
  - "apps/csrm/src/features/questionnaire-ai/questionnaire-ai-domain.ts"
  - "apps/csrm/src/features/questionnaire-ai/questionnaire-ai-refusal-copy.ts"
  - "apps/csrm/src/features/questionnaire-ai/questionnaire-ai-schema.ts"
  - "apps/csrm/src/features/questionnaire-ai/questionnaire-ai-service.ts"
  - "apps/csrm/src/features/questionnaire-ai/start-proposals-button.tsx"
  - "apps/csrm/src/features/questionnaires/ai-instruction-text.tsx"
  - "apps/csrm/src/features/questionnaires/questionnaire-detail.tsx"
  - "apps/csrm/src/features/questionnaires/questionnaire-domain.ts"
  - "apps/csrm/src/features/questionnaires/questionnaire-governance.tsx"
  - "apps/csrm/src/features/questionnaires/questionnaire-renderer.tsx"
  - "apps/csrm/src/features/questionnaires/questionnaire-review.tsx"
  - "apps/csrm/src/features/questionnaires/questionnaire-revision-timeline.tsx"
  - "apps/csrm/src/features/questionnaires/questionnaire-schema.ts"
  - "apps/csrm/src/features/questionnaires/questionnaire-service.ts"
  - "apps/csrm/src/features/questionnaires/questionnaire-submitted-answers.tsx"
  - "apps/csrm/src/features/questionnaires/use-answer-autosave.ts"
  - "apps/csrm/src/lib/api/conflict-reasons.ts"
  - "apps/csrm/src/lib/api/refusal-copy.ts"
  - "apps/csrm/src/lib/auth/oidc-configuration.ts"
  - "apps/csrm/src/lib/session-drafts/session-drafts.ts"
findings:
  critical: 14
  warning: 7
  info: 0
  total: 21
status: issues_found
---

# Phase 15 frontend review

## Scope and limits

Read-only deep review of changed frontend production sources and their relevant callers: typed Strapi operations, Server Actions, App Router projections, proposal decisions/jobs, questionnaire editing and session recovery. Generated schema declarations and test fixtures are excluded from production-source coverage; test assertions were consulted as evidence only. No test suite, application server, browser process, source edit or Git mutation was performed.

Project instructions, Phase 15 CONTEXT/UI-SPEC, STATE and the 15-PILOT-RULINGS were consulted. Installed Next useRouter documentation confirms router.refresh preserves unaffected client state, relevant to FE-02 and FE-08.

## Overlap

FE-12 through FE-21 explicitly carry the already recorded pilot D1–D9/NVDA concerns; do not count these twice when merging the pilot disposition. FE-01–FE-11 are additional source findings; FE-02 is adjacent to D6 but persists after its policy fix. No claim of NVDA speech verification is made.

## Narrative Findings (AI reviewer)

## Critical issues

### FE-01: Restoration deletes the only durable answer copy before a save succeeds

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaires/questionnaire-renderer.tsx:344`
**Issue and impact:** The restoration effect removes `unsaved-answers` before applying fields and scheduling autosave. If that autosave fails with a retryable network/server error, or the page unload cancels it, neither Strapi nor sessionStorage retains the restored answers. The new autosave hook only writes a recovery record for `QUESTIONNAIRE_NOT_ANSWERABLE`, so its ordinary retryable-failure path cannot repair this loss.
**Fix:** Keep the eligible restored entries in sessionStorage until a save acknowledges them. Track restored recovery state in the autosave hook and clear only the acknowledged snapshot; preserve newer edits queued behind that save. Prove restore → retryable save failure → reload retains text.

### FE-02: Soft refresh after re-release skips restoration and resets typed answers

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaires/questionnaire-renderer.tsx:338-361`
**Issue and impact:** `restoreChecked` becomes true on the first editable mount even when no recovery record exists. Later a taken-back save can create that record. On the SaveStatus `Refresh page` action after re-release, Next preserves the component; `restoreChecked` prevents reading the new record, and the seed-reset effect replaces the form with server answers. The kept answer disappears from the form despite the same-tab recovery promise. This remains after the pilot D6 policy fix.
**Fix:** Recheck restoration for an explicit refreshed editable seed/answerability transition. Reset the form from the refreshed server seed first, then merge eligible recovery entries and schedule save, without running the later reset over restored values. Cover take-back refusal → re-release → soft Refresh page.

### FE-03: The typed question-list pipeline discards the Answered flag

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaires/questionnaire-service.ts:117-147`
**Issue and impact:** The intermediate question-list object schema does not declare `answered` and its transform never forwards it. Zod strips the newly served flag before `questionnaireDefinitionSchema` can parse it. Strapi supplies this flag in `questionnaire-scope.ts:695`; the analyst-review renderer relies on it for `AnsweredQuestionNote` and rewrite eligibility. Answered rows therefore lack the protection marker and offer an AI rewrite that Strapi refuses. Submitted rows conceal the bug by deriving it from visible answer values.
**Fix:** Declare and preserve `answered` in the intermediate analyst list pipeline, and strip it explicitly in the Requestor projection if required. Add a service-to-renderer test using a real analyst transport payload with `answered: true`, rather than injecting an already parsed definition.

### FE-04: Rewrite status stops permanently after an error or the time limit

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/question-rewrite-control.tsx:135-155`
**Issue and impact:** A status result with `ok: false` returns without changing job state or a polling-cycle state, so the effect never schedules the next check. A rejected Server Action promise has no catch and behaves the same way. At the 30-second limit the effect also silently returns. The row still renders only `Rewriting…` (177-179), with no error, timeout explanation or `Check again`. A transient error or a longer AI request leaves the analyst unable to discover completion without leaving/reloading the page.
**Fix:** Use the bounded polling/recovery pattern of the proposal panel: catch action rejection, expose status failure, advance a cycle, and expose `Check again` when automatic checks stop. Cover a failed status read followed by completion and a job running beyond 30 seconds.

### FE-05: Successful Replace leaves its submitted instruction in session storage

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/assessments/questionnaire-generation-job.tsx:318`
**Issue and impact:** A successful start always clears `generation-instruction`, but the Replace field writes `replacement-instruction` (374). Reopening the dialog or navigating away and back restores the instruction already sent, inviting an unintended repeat and violating §3.2's clear-after-success rule.
**Fix:** Clear the draft kind corresponding to the successful operation (`replacement-instruction` when replacement was acknowledged, otherwise `generation-instruction`). Verify a nonempty replacement instruction is absent when the dialog is reopened after success.

### FE-06: Removal proposals expose an edit operation the server cannot accept

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/questionnaire-ai-domain.ts:238`
**Issue and impact:** `itemActionsFor` returns the same enabled Edit, then confirm control for every open current item, including `kind: remove`. The form pre-fills current values and sends changes. The actual callee `questionnaire-proposal-decisions.ts:390-391` rejects any removal decision carrying edits with 400, which the frontend misleadingly describes as the proposal no longer existing. Thus any real edit through this advertised path necessarily fails.
**Fix:** Hide Edit, then confirm for removals while keeping Confirm and Reject. Retain the server rejection. Test a removal card renders no editing path and its ordinary confirmation still works.

### FE-07: Assessment-draft gate ignores active per-question rewrites

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/assessments/assessment-draft-job.tsx:348-352`
**Issue and impact:** The draft card derives its active-job gate from `panelJobOf`, which intentionally selects only `questionnaire-proposals` (`questionnaire-ai-domain.ts:529-530`). A submitted questionnaire with zero open items and a queued/running `question-rewrite` therefore displays Generate assessment draft instead of the preparing-proposals gate. Strapi gates on active proposal jobs of either operation, so this visible action is guaranteed to be refused.
**Fix:** Calculate active work from all queued/running jobs in `aiProposals.jobs`; reserve `panelJobOf` for the questionnaire-wide status panel. Prove zero-open + active rewrite suppresses draft generation and links to AI proposals.

### FE-08: A requesting analyst remains locked out of release after colleagues clear proposals

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaires/questionnaire-governance.tsx:204-209`
**Issue and impact:** After a requesting analyst's release is refused for AI_PROPOSALS_OPEN, dismissRelease sets `proposalsRefusedRelease` to true (297-298). This flag is never reset. Their projection always carries `releaseGate.openCount: null`, so even a refreshed server payload after another analyst rejects all open proposals keeps the warning line and removes the Release control (364-367). A full component remount is the only way to retry an operation now allowed by Strapi.
**Fix:** Make the observed refusal expire on a refreshed questionnaire seed, or retain an explicit release retry control with the countless guidance. Do not expose restricted counts. Cover own analyst refusal → colleague clears proposals → soft refresh → release available.

### FE-12: Submitted hub loses its proposal count and job holder (pilot D2 overlap)

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/assessments/assessment-detail.tsx:199-200`
**Issue and impact:** The only card containing HubProposalJob and the AI proposals count is rendered behind `offersQuestionnaireGeneration`. Once the Requestor has answered/submitted, the hub retains at most GenerationSignalCard, which has neither. A hub-started proposal job cannot be followed there, and removing the focused card during refresh drops focus to body. The pilot reproduced this at both widths.
**Fix:** Keep a questionnaire proposal section for non-requesting analysts whenever the questionnaire supports reading/deciding proposals, independent of whether generation is offered. Keep its focused DOM holder mounted across the job start. Browser-check zero/three-open and start-to-completion in a submitted questionnaire.

### FE-13: Take-back returns 403 and bypasses recovery (pilot D6 overlap)

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaires/use-answer-autosave.ts:113-117`
**Issue and impact:** Session preservation is entered only for the reason QUESTIONNAIRE_NOT_ANSWERABLE. The current policy rejects an owning Requestor when requireQuestionnaireReleasedForRequestor is true and releasedAt is absent (`apps/backend/src/policies/csrm-authorization.ts:490-491`), yielding generic 403 without that reason. The hook blocks but never writes the unsaved recovery record; reload loses the latest text. This is the policy/UI mismatch reproduced by the pilot.
**Fix:** Follow D6's authorised ruling: establish ownership first, return 409 QUESTIONNAIRE_NOT_ANSWERABLE for an owning reader currently unable to answer, and keep unrelated actors at 403/404 without state disclosure. Regenerate the contract if needed and prove browser recovery at both widths.

### FE-14: Panel starts and take-back dialog drop keyboard focus (pilot D3 overlap)

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx:446-448`
**Issue and impact:** StartForm calls onStarted and is removed by the active-job render condition at 641 without transferring focus. ReturnToReview refreshes the route (411) while its trigger can disappear. The pilot observed body focus after both operations, disrupting the keyboard sequence.
**Fix:** Transfer focus after the committed render to the mounted preparing-status element; after a return-dialog trigger disappears, focus its stable replacement. Browser-assert the actual focused element for both flows.

### FE-15: Confirm focus is scheduled before the relevant committed render (pilot D4 overlap)

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx:128-135`
**Issue and impact:** The decision path schedules focus with requestAnimationFrame, and confirmWithEdits calls it before the parent closes the editing form (280-284 and 594-597). The target can still be absent/disabled or then be removed during revalidation. The pilot reproduced body focus after ordinary Confirm and Confirm with edits; Reject's observed success does not prove these flows.
**Fix:** Queue a focus target and resolve it after the render that removes the decided form/card, using the next remaining primary control or stable panel status. Preserve it across the server refresh. Browser-check both confirmation paths at both widths.

### FE-16: Edited-add toast names the AI placement instead of the chosen placement (pilot D5 overlap)

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx:283`
**Issue and impact:** Confirm with edits computes the success toast using `item.placement.sectionTitle`, ignoring `edits.section`. Moving an addition to another existing or new section produces a factually wrong confirmation toast. This also prevented the real-data long-section mobile backstop in the pilot.
**Fix:** Resolve the title from the confirmed edit's new title/existing section key (or authoritative response) and pass that to decisionToast. Verify a real 255-character chosen title at 375px with Undo visible and functional.

### FE-17: Signal start gives up before its job status is available (pilot D8 overlap)

**Classification:** BLOCKER
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/start-proposals-button.tsx:19-26`
**Issue and impact:** Focus lookup gives the refreshed job status only 60 animation frames, then focuses the panel section. This is unrelated to actual Server Component/dynamic-module readiness and can settle on the wrong element under ordinary slow reads. Cross-page hash landings also need the shared landing policy the pilot explicitly required.
**Fix:** Carry the intended focus target through rendering and resolve it when the job status mounts; use useHashLanding/landOn for hub-to-panel anchors. Browser-prove focused element plus in-viewport state.

## Warnings

### FE-09: Empty proposal outcomes omit the explanation of discarded items

**Classification:** WARNING
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx:620`
**Issue and impact:** Groups are filtered to runs with at least one open item. The finished no-change branch renders only NOTHING_NEW (640). All left-out adjustment explanations live in ProposalRunGroup, so a run whose every item was dropped can never show its `{n} left out` explanation, despite UI-D34 requiring it beside the no-change outcome. An analyst cannot distinguish an empty model suggestion from rejected/invalid/answered-target suggestions.
**Fix:** Render the finished run's adjustment list with the no-change outcome, extracting the existing left-out fragment for reuse. Cover a zero-item run with answered-target and invalid-item adjustments.

### FE-10: Reject reasons have no session preservation or leave protection

**Classification:** WARNING
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/proposal-item-card.tsx:253`
**Issue and impact:** RejectRow holds the reason only in local useState; it neither reads/writes session drafts nor registers useUnloadWarning. Navigation/reload/remount discards a reason being composed. §15's No lost input contract explicitly includes reject reasons, and these reasons steer the next run.
**Fix:** Keep reason drafts per actor and proposal/run, restore on reopen, arm the existing unload warning while unsent text exists, and clear on successful rejection or intentional discard. Preserve reasons on refused decisions.

### FE-11: Edited proposal drafts do not warn before the tab closes

**Classification:** WARNING
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/proposal-edit-form.tsx:95`
**Issue and impact:** The form writes drafts to sessionStorage on each change, but neither ProposalEditForm nor shared QuestionForm calls useUnloadWarning/useLeaveGuard. §5.2 explicitly requires beforeunload for changed values. Closing the tab destroys its sessionStorage without any prompt.
**Fix:** Track whether the proposal draft differs from its initial values and arm useUnloadWarning for changed unsent data. Stand it down after successful confirmation/discard and the authorised sign-out path.

### FE-18: Figure toggles fall below the required target height (pilot D9 overlap)

**Classification:** WARNING
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx:536`
**Issue and impact:** The fixed-question toggle is a bare text button, and the left-out toggle in proposal-item-card.tsx:226 is likewise unpadded. The pilot measured heights of 20px and 16px, below the 24px target required by §1/WCAG 2.5.8.
**Fix:** Give both toggles at least a 24px target height with a shared accessible figure-link treatment. Browser-measure actual hit boxes; do not depend on the spacing exception.

### FE-19: Preparing announcements and comparison row names remain unreliable (pilot NVDA risks overlap)

**Classification:** WARNING
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/questionnaire-ai/ai-proposals-panel-client.tsx:517`
**Issue and impact:** The preparing paragraph is conditionally inserted already containing its text, which may not trigger a polite live-region announcement. Separately, field-comparison.tsx:51 puts the Changed note inside the row header, making the row name `Question Changed` rather than the field name. These are the pilot's pending NVDA risks, independently visible in the source; speech itself has not been tested here.
**Fix:** Keep a stable mounted live region and change its text on state transitions. Put the change state outside the row-header accessible name (cell text or aria-describedby). Keep the operator's NVDA speech check pending.

### FE-20: Replace's instruction hint diverges from the pinned generation guidance (pilot D1 overlap)

**Classification:** WARNING
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/assessments/questionnaire-generation-job.tsx:66`
**Issue and impact:** The replacement field uses a separate shortened hint. §3.1 pins the same concrete focus example for Generate and Replace; the pilot requires the exact approved line on both. This is a recorded contract discrepancy rather than an independently invented style preference.
**Fix:** Use one shared approved GENERATE_INSTRUCTION_HINT for both fields, including the offshore-support/payroll example; update the exact-copy assertion.

### FE-21: Requesting analyst replacement omits its explanatory caption (pilot D7 overlap)

**Classification:** WARNING
**File:** `/Users/vanbui/src/test/idambox/apps/csrm/src/features/assessments/questionnaire-generation-job.tsx:374-375`
**Issue and impact:** The replacementField is null for an own request, and no alternative caption is rendered in the Replace dialog. The own-request caption is only displayed in the `action === generate` branch at 411-413, so it is absent from the hub Replace path too. This violates §12's required explanation of why instruction is unavailable.
**Fix:** Render OWN_REQUEST_GENERATE_CAPTION below the requesting analyst's Replace action and inside its confirmation dialog. Verify both surfaces for an own request.




## contracts lane

---
phase: 15-steerable-questionnaire-ai
lane: contracts-tests-and-harnesses
depth: deep
diff_base: 15eb830b
files_reviewed: 68
files_reviewed_list:
  - CONTEXT.md
  - README.md
  - apps/backend/.env.example
  - apps/backend/README.md
  - apps/backend/tests/ai-inputs-signal.unit.test.ts
  - apps/backend/tests/ai-provenance.unit.test.ts
  - apps/backend/tests/ai-provider-guardrails.unit.test.ts
  - apps/backend/tests/ai-provider-questionnaire-proposals.unit.test.ts
  - apps/backend/tests/ai-run.integration.test.ts
  - apps/backend/tests/analyst-instruction.unit.test.ts
  - apps/backend/tests/assessment-context.integration.test.ts
  - apps/backend/tests/assessment-context.unit.test.ts
  - apps/backend/tests/assessment-workflow.integration.test.ts
  - apps/backend/tests/attachment-ai-input.integration.test.ts
  - apps/backend/tests/attachment-extraction.unit.test.ts
  - apps/backend/tests/authorization-matrix.integration.test.ts
  - apps/backend/tests/authorization-policy.unit.test.ts
  - apps/backend/tests/conflict-reasons.unit.test.ts
  - apps/backend/tests/contract-catalogue.integration.test.ts
  - apps/backend/tests/fixtures/ai-wire/question-rewrite-cases.json
  - apps/backend/tests/fixtures/ai-wire/questionnaire-proposals-edge-cases.json
  - apps/backend/tests/fixtures/ai-wire/questionnaire-proposals-offshore.json
  - apps/backend/tests/fixtures/authorization-matrix.ts
  - apps/backend/tests/helpers/questionnaire-proposal-fixture.ts
  - apps/backend/tests/helpers/strapi-http-harness.ts
  - apps/backend/tests/keycloak-identity.unit.test.ts
  - apps/backend/tests/proposal-items.unit.test.ts
  - apps/backend/tests/proposal-job-registry.unit.test.ts
  - apps/backend/tests/questionnaire-ai-decisions.integration.test.ts
  - apps/backend/tests/questionnaire-ai-proposals.integration.test.ts
  - apps/backend/tests/questionnaire-answer-preservation.unit.test.ts
  - apps/backend/tests/questionnaire-generation.integration.test.ts
  - apps/backend/tests/questionnaire-governance.integration.test.ts
  - apps/backend/tests/questionnaire-governance.unit.test.ts
  - apps/backend/tests/questionnaire-placement.unit.test.ts
  - apps/backend/tests/questionnaire-proposal-adapter.unit.test.ts
  - apps/backend/tests/questionnaire-proposal-context.unit.test.ts
  - apps/backend/tests/questionnaire-proposal-envelope.unit.test.ts
  - apps/backend/tests/text-similarity.unit.test.ts
  - apps/csrm/.env.local.example
  - apps/csrm/README.md
  - apps/csrm/e2e/helpers/request-collaboration.ts
  - apps/csrm/e2e/questionnaire-ai-proposals.spec.ts
  - apps/csrm/e2e/questionnaire-generation-workflow.spec.ts
  - apps/csrm/e2e/questionnaire-governance-workflow.spec.ts
  - apps/csrm/e2e/request-attachments.spec.ts
  - apps/csrm/e2e/request-notes.spec.ts
  - apps/csrm/playwright.config.ts
  - apps/csrm/src/lib/api/generated/schema.d.ts
  - docs/adr/0003-production-only-keycloak-oidc-sign-in.md
  - docs/adr/0004-strapi-verifies-keycloak-access-tokens.md
  - docs/architecture/overview.md
  - docs/configuration/configuration.md
  - docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md
  - docs/contract-gaps/phase-12-ai-run-record-and-provenance.md
  - docs/contract-gaps/phase-13-request-notes.md
  - docs/frontend/components.md
  - docs/guides/development.md
  - docs/guides/getting-started.md
  - docs/guides/testing.md
  - docs/references/idambox-csrm-role-function-api-catalogue.json
  - docs/references/served-operations.json
  - docs/references/specification.json
  - docs/services/backend-services.md
  - overlay-with-bproton-dev-csrm.sh
  - scripts/claude-cloud-setup.sh
  - scripts/verify-keycloak-idp.mjs
  - scripts/verify-keycloak-provisioning.mjs
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
phase_findings:
  critical: 0
  warning: 0
operator_only_findings:
  critical: 2
  warning: 0
status: issues_found
---

# Phase 15 contracts, tests and harnesses review

## Narrative Findings (AI reviewer)

No additional Phase 15 defect was established in this lane. This is not evidence that the implementation is correct. Backend and frontend production source are reviewed by their dedicated lanes.

## Operator-authored changes outside Phase 15

The following findings concern operator commits in the review range. Keep their attribution separate from Phase 15 implementation findings and obtain the orchestrator's disposition before editing them.

### CT-01: BLOCKER — Cloud setup reports success after required background installs fail

**File:** `/Users/vanbui/src/test/idambox/scripts/claude-cloud-setup.sh:41-48,67,77`
**Severity:** BLOCKER.
**Attribution:** Operator commit `56bdd117`, authored by vanbui.
**Issue:** Chromium system-dependency installation, Chromium download and the repository's frozen pnpm install all run as background jobs. Their process IDs are discarded. The final bare `wait` waits for children but returns success without propagating individual failures; the script then explicitly exits 0. Thus a registry/network failure or frozen-lockfile refusal leaves the environment without necessary packages or Chromium while setup is reported successful. `set -uo pipefail` does not repair the lost background exit statuses.
**Impact:** An environment that the script claims is ready cannot run builds or browser tests; automation loses the actual installation failure.
**Fix:** Save every background PID, wait for each individually, aggregate nonzero statuses, print the relevant logs and exit nonzero if any required installer failed. Only print the success summary after all required installation statuses pass.
**Evidence:** The three background commands are at lines 41, 42 and 48; line 67 is an unqualified `wait`; line 77 forces `exit 0`. This follows shell control flow and was not executed during this read-only review.
**Pilot overlap:** None. This script is not among the pilot's accepted stale verifier scripts.

### CT-02: BLOCKER — Exporting the snapshot deletes a fixture required by the exported test suite

**File:** `/Users/vanbui/src/test/idambox/overlay-with-bproton-dev-csrm.sh:28`
**Related file:** `/Users/vanbui/src/test/idambox/apps/backend/tests/keycloak-identity.unit.test.ts:278-286`
**Severity:** BLOCKER.
**Attribution:** Overlay deletion is operator commit `8838dbd3`; the fixture's docker path comes from operator commit `d32bb257`.
**Issue:** After rsync copies the backend and all of its tests, the overlay script removes the entire `docker/` tree. The copied identity test unconditionally reads `docker/keycloak/import/idambox-realm.json` and asserts the development fixture subjects match it. The exported checkout therefore lacks a file needed by its standard backend suite, which fails with ENOENT even when Keycloak is disabled.
**Impact:** The intended intern snapshot cannot pass `pnpm --filter @csrm/strapi test`; published local-Keycloak setup links also point to removed artifacts.
**Fix:** Keep the canonical realm fixture in the export, or move a canonical test fixture into a retained path and update the integration between the realm import and the fixture check. Preserve the existing fixture-subject assertions; do not skip or delete the test. Separate deployment-service removal from test-data retention.
**Evidence:** Overlay lines 25-26 copy the application/test trees; line 28 removes `docker`. The test at lines 278-286 has no runtime flag guard and synchronously loads the deleted path.
**Pilot overlap:** The pilot accepted the operator's Keycloak-path changes as outside the phase, but did not rule on the overlay deleting the dependency those tests now read.

## Pilot overlap and rejected concerns

- **D6 is already ruled:** `questionnaire-ai-decisions.integration.test.ts:433-458` checks the service's 409 but its HTTP assertion still expects 403 after take-back. The policy/client mismatch and needed ownership-preserving 409 are recorded in 15-PILOT-RULINGS.md; do not count this as a new unique CT finding.
- The generation E2E's QUES08 section-add assertions were moved intact after replacement. The old ability to replace analyst-modified questionnaires was changed to the explicitly approved refusal, rather than silently weakening the assertions.
- The six Phase 15 routes appear in the published paths and role catalogue, and their HTTP negative tests include the owner Requestor, unrelated Requestor, analyst-agent/service identities and requesting analyst. The policy unit tests also exercise a deliberately mis-granted automation role.
- The new proposal fixture helpers set `humanAnalyst: true` for direct service calls; this is not an authorization bypass finding because separate mounted HTTP tests exercise the real policy.
- The questionnaire snapshot retains the full question `options` envelope, including section/order/visibility/deletion metadata; an initial concern that it omitted those fields was rejected on exact-source inspection.
- Possible production-read concern forwarded to the backend lane: `questionnaire-proposals-read.ts:252-257` projects `target.available` from row existence even when the row is soft-removed. No CT finding is assigned here; the backend lane owns its semantics and UI impact.
- The pilot's accepted stale model/provisioning verifier scripts and host heap-watchdog ruling are not re-raised.

## Coverage and limitations

The list above preserves the contracts/test/documentation/script scope examined in this lane. The review traced the new request/response fields, role grants, direct-service versus mounted-route authorization evidence, answer preservation and decision batch assertions, deterministic provider fixtures, serial browser records, generated-client additions, and changed existing assertions. For large pre-existing test files and generated JSON/types, review concentrated on changed sections and referenced cases; this report does not claim exhaustive line-by-line examination of every unchanged line.

Production references followed include questionnaire proposal reads, decisions, governance mutation parsing, proposal envelope vocabularies, API package scripts and the questionnaire context builder. The two findings above are independently supported by exact source control flow. No tests, server processes, Git writes or source edits were performed.

