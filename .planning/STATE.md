---
gsd_state_version: "1.0"
milestone: v2.0
milestone_name: Assessment Lifecycle and Oversight
status: verifying
stopped_at: Completed 10-23-PLAN.md
last_updated: "2026-10-02T19:21:47.811Z"
last_activity: 2026-10-03
last_activity_desc: "Plan 10-23 complete (the Phase 10 gate green three times, eleven walkthrough fixes and the Fix 8 addendum test-first, and the pilot's approved walk of both actors at 375 and 1440: 51 browser rows, all pass; ADMIN-05 delivered except the Information Asset owner, which moves to Phase 22)"
state_head: 50893bc00bd675f786e6f33cc6eb5e374442b5a5
progress:
  total_phases: 16
  completed_phases: 0
  total_plans: 290
  completed_plans: 23
  percent: 0
current_phase: 10
current_phase_name: Existing-flow gap closure
current_plan: 0
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-28)

**Core value:** Make a complex cyber-risk workflow simple and auditable while keeping Security Analysts—not AI—in control of assessment review and release.
**Current focus:** Phase 10 — Existing-flow gap closure (post-demo Stage 3 on branch `post-demo`, under `.planning/POST-DEMO-BRIEF.md`)

## Current Position

Stage 2 of the post-demo brief is complete: every phase of v2.0 is planned, in execution order (10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22). Phase 19.1, the in-app notification centre, was inserted on 2026-10-01 (G-19), taking NOTIFY-01 from Phase 17.

- **Planned, with a passing plan check:** 290 plans. Phase 10 has 23 (its 2026-09-27 check is resolved, and it gets a fresh check before it is built). Then 11 (21), 12 (19), 13 (19), 14 (17), 15 (14), 16 (15), 19 (15), 19.1 (10), 17 (19), 17.1 (18), 17.2 (15), 18 (19), 20 (23, kept whole by the pilot, with a named seam), 21 (18) and 22 (25). Each phase's verdict is in its `NN-PLAN-CHECK.md`.
- **UI-SPECs:** approved for Phases 10 to 22, with milestone-wide extensions X-1 to X-80, each recorded in the design direction by a plan task before it is used.
- **Done in Stage 3:**
  - the G-10 fonts quick task 261002-2y8 (`4913c90` to `6ae258b`), accepted by the pilot with the gate green: web 2,053/2,053, Strapi 578/578, Playwright 85/85;
  - the typography follow-up quick task 261002-drq (`ff61dbf` to `5ea2b77`): Vietnamese subsets for Plus Jakarta Sans and IBM Plex Mono on demand, and Buttons at the direction's weight 500. The pilot accepted it with the gate green: web 2,055/2,055, Strapi 578/578, Playwright 86/86.
- **Phase 10:** its fresh plan check found one blocker, guards that diffed from `uat-trial`'s `98fe99c`, which is not in this repository. The pilot resolved it by moving the baseline to `5ea2b77` (D-49), and the plans are ready to execute.
- **Now:** all 23 Phase 10 plans are executed (`/gsd-execute-phase 10`, one per wave, sequential on the main tree). Plan 10-23's walk is approved by the pilot. Still to run, by the orchestrator: the code review gate, the regression gate, `gsd-verifier` (10-VERIFICATION.md) and one final full gate, because Fix 3d and the Fix 8 addendum change code after the third gate. The phase is not marked complete until then.

Plan: 23 of 23
Status: All plans executed — awaiting the code review, regression and verification gates and the final full gate
Last activity: 2026-10-03 — Plan 10-23 complete: the Phase 10 gate green three times (last at `4c10b43`: Strapi 649/649, web 2,777/2,777, Playwright 87/87, 0 flaky, `verify:csrm-seed` and the four static checks clean); walkthrough fixes 1 to 8, 3b, 3c and 3d and the Fix 8 addendum, each test-first (Fix 3d: PSPF-130 keeps "appropriate"; the addendum accepts only the overflowing popup's `scrollable-region-focusable`, with the keyboard path proved); the pilot's 51 browser rows all pass; REQ-07, QUES-08, QUES-09, ASSESS-06, ASSESS-07 and UX-06 delivered, ADMIN-05 open with its Remainder (Information Asset owner to Phase 22). Previous: 2026-10-02 — Plan 10-22 complete: csrm-control-titles.json beside the byte-identical vendored catalogues holds 386 titles (93 Annex A names cross-checked against a public listing, 293 descriptive CPS 230, CPS 234 and PSPF titles, each anchored to its paragraph and reading-pass checked: 1 and 36 corrections, 4 more from the copy check); readControlLibrary, parseControlTitles and createControlSeeds feed seedCsrmData, and the reconciliation renames a control stored by its number; ADMIN05_CONTROL_TITLES_LOADED and ADMIN05_PICKER_FINDS_CONTROL_BY_TITLE_WORD (masking finds 8.11 · Data masking) in the journeys; Strapi 630/630, web 2,745/2,745, journeys 6/6, typecheck and api:check clean

## Milestone

**Version:** 2.0, Assessment Lifecycle and Oversight
**Phases:** 10–22, 17.1, 17.2 and 19.1 (16 phases). Execution order: 10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22.
**Requirements:** 55 in `.planning/REQUIREMENTS.md`: 46 tracing all 65 product gap UAT findings (`.planning/uat/product-gaps/`), and 9 from the product demo's risk-owner asks PD-1 to PD-5.
**Decisions:** `.planning/NEXT-WAVE-DECISIONS.md`: the eighteen from the UAT report, G-1 to G-10, and the post-demo G-11 to G-18.
**Previous milestone:** v1.0, shipped 2026-09-26 and closed 2026-09-28:
- `.planning/MILESTONES.md`;
- `.planning/milestones/v1.0-ROADMAP.md` and `v1.0-REQUIREMENTS.md`;
- `.planning/milestones/v1.0-STATE.md` (its full decision log, risks and gate records).

## Decisions

v1.0's decisions (`.planning/milestones/v1.0-STATE.md`) stay binding unless a v2.0 decision reverses them, and `NEXT-WAVE-DECISIONS.md` names each reversal.

- [Next wave, 2026-09-27]: The product gap UAT (`.planning/uat/product-gaps/`: 65 findings against the operator's intended product in `BRIEF.md` Appendix A) becomes Phases 10–22, planned with GSD. Milestone v1.0 stays open for now: closing it needs the operator's decisions on the 52 open items the close audit lists, the v1.0 acceptance test has not run, and nine of the UAT's major defects are in v1.0's own flows (Phase 10 closes them). The new phases continue v1.0's numbering under a "Next Wave" section of ROADMAP.md, and the Next-wave requirements in REQUIREMENTS.md (46 after the delegated decisions) trace to the intended-product IDs and to every finding. Phase 9 keeps its entry but is scoped by Phases 12, 15, 16 and 17, and its carried items move there (R-08-42 to Phase 12, O-5 to Phase 13). Phase 19 runs before Phase 18, whose risk-row import and export reuse its infrastructure.
- [Next wave decisions, 2026-09-27]: The operator delegated the product decisions, to be made "based on what the process is in real life revolving around Cyber Governance as well as Premium UI/UX". `.planning/NEXT-WAVE-DECISIONS.md` records all eighteen from `REPORT.md` §9 and six more (G-1 to G-6), replacing the provisional defaults. The model is the Three Lines: the business owns treatment and accepts residual risk, and Security Analysts assess and own the method. The assessment follows the ISO/IEC 27005 process, and risk owners approve the treatment plan and accept residual risk (ISO/IEC 27001:2022 clause 6.1.3 f). Headline choices:
  - a 5 × 5 matrix, with ratings as the product of the two scores banded Low, Moderate, High and Critical, and acceptance authority and review intervals by rating;
  - no hard delete of persisted risks;
  - analyst re-rating after release as a recorded review;
  - separation of duties on an analyst's own request;
  - peer approval before release when any residual risk is Critical;
  - per-file AI opt-in for attachments, under a classification ceiling;
  - control titles loaded in Phase 10;
  - notifications in the app (Phase 17), then reminders and email (Phase 20);
  - quick find with Ctrl+K or ⌘K;
  - a premium experience bar for every UI-SPEC.

  Three requirements were added: ASSESS-20, NOTIFY-02 and UX-10, making 46. Phase 17.1, "Review, peer approval and risk acceptance", was inserted. Contract-gap records are approved by the orchestrator after review (G-6).
- [Next wave planning method, 2026-09-27]: Each phase is planned in roadmap order with GSD: discussion in auto mode (CONTEXT.md), the UI design contract for UI phases (UI-SPEC.md, deferring every value to `docs/design/csrm-design-direction.md`), research, plans and the plan check. Planning stops before execution: auto-advance is not used for this wave's planning. Plans for Phases 11–22 are written against today's code plus the planned outputs of earlier phases, so re-run the plan check for a phase just before executing it.
- The Turborepo contains `apps/backend` (Strapi) and `apps/csrm` (Next.js); the sibling Strapi project was migrated in during Phase 1, and the folders took these names in d161fce.
- The provided CSRM project brief governs scope; the Strapi OpenAPI contract governs production API communication.
- Keycloak authenticates identities; IdamBox/Strapi remains the source of application authorization.
- AI assists with drafts and suggestions but cannot release assessments.
- [v1.0 close and v2.0 start, 2026-09-28]: Decided under the operator's delegation (G-8).
  - v1.0 closed as an override close-out; see MILESTONES.md.
  - Its phase directories stay in place, and no tag was created. The suggested `v1.0` tag target is `37874ed` on `main`.
  - v2.0 continues the phase numbering.
  - Phase 06.10 is now backlog item 999.1.
  - The v1.0 STATE body moved to `.planning/milestones/v1.0-STATE.md`, so every agent reads a short STATE.

- [v2.0 planning conventions, 2026-09-28]:
  - Work moved to branch `v2.0`, created from `uat-trial` at `e3d393d`. `uat-trial` stays as the UAT and planning snapshot.
  - Recorded UI extensions form one milestone-wide sequence in `docs/design/csrm-design-direction.md`: Phase 10's X-1 to X-5 (recorded by plan 10-01), then Phase 11's X-6 to X-10 (recorded by Phase 11's first plan). Each later UI-SPEC numbers after the highest number in the committed UI-SPECs, so Phase 12 starts at X-11. Phase 7's X-1 to X-13 were local to its own contract; they are in the direction as dated CSRM extension notes and are cited by those.
  - Phase 11's UI-D33 is approved: "mitigation control" is the display term for a Control Implementation in the copy that phase rewrites, as in Phase 7's contract, Phase 10's D-28 and D-33, and the Risk Register's save messages. The JDL name stays in the data model and API.
- [Post-demo start, 2026-10-01]: The product demo's risk-owner asks are reconciled, planned and built on branch `post-demo` under `.planning/POST-DEMO-BRIEF.md`. That brief overrides three stale facts: the `v2.0` branch and the git-excluded brief above; the app paths, now `apps/backend` and `apps/csrm` (`d161fce`); and INT-02, now implemented, flag-gated and off in development. GSD agents inherit the session model, and auto-advance is off, so the pilot drives every transition.
- [Post-demo G-11, 2026-10-01]: The nominated risk owners are each risk's own `riskOwner`, set by the analyst (one step for all) and required before release for response; no request-level owner and no reuse of `sponsor`; the assigned analyst, the reviewer and the peer approver cannot be a risk owner or executive approver on that assessment, and an owner cannot act on it as an analyst (extends G-1).
- [Post-demo G-12, 2026-10-01]: The Requestor, the nominated risk owners and named executive approvers read the whole assessment from its first release for response through the released record, with the stage labelled; anyone else gets the refusal a missing record gets at every route and stage (extends decision 3; reverses v1's owner-only Requestor read).
- [Post-demo G-13, 2026-10-01]: "Submit final assessment" opens numbered acceptance rounds that lock analyst editing, and the assigned analyst can recall a round; once every risk has a valid decision, the assigned analyst releases and closes in one confirmed step (assessment `approved`, request `closed`, shown "Closed"); automatic closure on the last decision is rejected (reverses v1's release transition to request `approved`; decision 16's "Released" request label now covers only earlier releases).
- [Post-demo G-14, 2026-10-01]: Each risk takes an explicit Accept or Treat decision from its named owner, with authority by residual rating for both choices (High adds the named executive approver; only the executive decides Critical, as a time-limited exception); Accept only where no planned control exists; each decision records authority, rationale, review date and a fingerprint; no analyst, AI or service identity decides (reverses G-2's per-risk decline).
- [Post-demo G-15, 2026-10-01]: Contest points are their own entity (Phase 17.2): any participant raises one on any content they can read, with a reason, a reply thread and a status; sending back or recalling reopens the whole assessment, every point is answered before resubmission, and a decision survives a round only while its risk's fingerprint is unchanged (reverses G-2's decline that returned one risk).
- [Post-demo G-16, 2026-10-01]: Phase 20 tracks treatments from Not Started through In Progress to Complete on evidence; the server sets Overdue from `treatmentResolveDate` and every read derives it by the same rule; date changes need a reason; overdue treatments escalate to the assigned analyst and the risk owner (new RISK-06; reverses Phase 7 D-04 in part).
- [Post-demo G-17, 2026-10-01]: First-line users find people through the already-granted `GET /api/v1/users?search=`, hardened (two characters, active human users only, `documentId` and `displayName` only, every search logged): control owners in Phase 17, then treatment owners in 17.1 (settles Phase 2's deferred directory contract; sponsor selection stays off).
- [Post-demo G-18, 2026-10-01]: Risk owners and executive approvers receive in-app notifications at each stage (Phases 17 and 17.1, and NOTIFY-04 for contest points in 17.2), and decisions left waiting get email reminders from Phase 20.
- [Post-demo G-19, 2026-10-01]: The in-app notification centre moves from Phase 17 into the inserted Phase 19.1 (after 19, before 17), keeping Phase 17 within L; NOTIFY-01 moves with it, its first kinds are the events that exist before Phase 17, and Phase 17 adds its response kinds through the same service (reverses only decision 18's placement of the centre in Phase 17).
- [Phase 10 baseline, 2026-10-02]: Phase 10's static guards (content-type freeze, Keycloak, `CSRM_AI_`, vendored catalogues) diff from `5ea2b77`, the last `post-demo` commit before any Phase 10 code. The plans' `uat-trial` baseline `98fe99c` is not in this repository (10-CONTEXT D-49).
- [Post-demo G-20, 2026-10-01]: When the AI data policy refuses generation, Phase 22 adds a manual start (an empty questionnaire or assessment draft); until then Phase 12's refusal names the classification, the ceiling and the administrator who sets `CSRM_AI_DATA_CLASSIFICATION_CEILING` (named in the `.example` with a safe default). Offering the deterministic provider as a template was rejected as a governance risk.
- [Phase 10]: 10-01: ViewerTimeZoneSync relies on Next's same-round-trip route re-render after the cookie-setting Server Action; no explicit router.refresh(), which rendered the page twice and aborted the first response (e12e0f8). LocalInstant/formatInstant is the one way to render an instant on a D-19 surface.
- [Phase 10]: 10-01: VIEWER_TIME_ZONE_COOKIE lives in the pure lib/time/format-instant.ts and is re-exported by the server-only viewer-time-zone.ts, so jsdom tests rendering LocalInstant never import server-only. Plan 10-02 should add viewer-time-zone.ts to the server-only gate list.
- [Phase 10]: 10-02: canViewerReviewAssessments() (server-only, React cache) runs first in the three analyst detail routes and their generateMetadata; a refused viewer gets the static title, no read, and the role variant (Go to My Requests / Questionnaires / Risk Assessments). Later plans that edit these routes keep the gate first.
- [Phase 10]: 10-02: The D-38 copy guard (src/lib/performance/interface-copy-guard.test.ts) starts with twelve clean files; each later Phase 10 plan appends, in sorted order, the files it cleans (10-05, 10-09, 10-15, 10-17 and 10-21 are named in the plan).
- [Phase 10]: 10-03: selectAdjacentRadio (components/ui/radio-group.tsx) owns radio arrow keys: it prevents default at once, then in a microtask focuses the next enabled radio (wrapping) and checks it through its own click, clicking only when Radix's onFocus did not, so one change per press. A synchronous click nested in the keydown stalled a Suspense transition under testing-library's act. Any component rendering RadioGroupPrimitive.Item directly passes onKeyDown={selectAdjacentRadio}.
- [Phase 10]: 10-04: RequestWorkflowActions takes its actions only from the served request; a transition refreshes the route and moves focus once to the first new control or #request-actions. canRevertRequestToDraft (zod-free request-domain.ts) reads only served relationships and fails closed; both the Requestor's actions and the analyst hub use it. Plan 10-05's questionnaire predicates should follow the same shape.
- [Phase 10]: 10-04: RequestContextDetails is the one read-only request context for both actors (Request overview, Business context, Scope and timing). The Requestor's 'Submitted {date}' is one string through formatInstant with useViewerTimeZone, so the status badge stays the only element whose text is Submitted. Later plans editing assessment-detail.tsx (10-09, 10-10, 10-12, 10-14) keep it full width in the grid gap-6 container.
- [Phase 10]: 10-05: canRevertQuestionnaireToDraft and canReturnToAnalystReview live in the zod-free questionnaire-workflow-rules.ts and read only the served questionnaire state and request relationship, failing closed. Both questionnaire pages gate Return to draft on the first and choose the renderer's submittedNotice (requestor-revertible, requestor-locked, analyst) from the same rule. Plan 10-09 wires canReturnToAnalystReview into the governance panel.
- [Phase 10]: 10-05: The attention list shows only after a submit attempt or a server field error, in orderQuestionnaire's form order; server field errors carry type 'server' so a lingering client required error never keeps an answered question listed. The introduction's 'Your answers save automatically' (UI-SPEC 5.2 verbatim) is untrue until plan 10-07's autosave lands, which must precede shipping.
- [Phase 10]: 10-06: Every 409 the UAT met carries error.details.reason from one closed 18-code list (apps/backend/src/csrm/conflict-reasons.ts, both conflict response schemas, apps/csrm/src/lib/api/conflict-reasons.ts; equality tests on both sides). The web transport keeps a reason only on a 409 and only when isConflictReason accepts it (TransportError.reason). Plan 10-07 maps each code to its copy; DEFINITION_CONFLICT tells the analyst to reload (D-06).
- [Phase 10]: 10-06: ASSESSMENT_STARTED means an assessment exists or the request is at risk-assessment-drafted, under-review, approved or closed (ASSESSMENT_STAGE_REQUEST_STATUSES in questionnaire-workflow.ts); any other non-releasable stage, or no request, is REQUEST_NOT_ELIGIBLE. Governance log appends run before any write through appendOrConflict, so HISTORY_UNAVAILABLE never leaves a partial write. New workflow refusals add their code to all three lists in one change.
- [Phase 10]: 10-07: refusal-copy.ts (zod-free, imports only the ConflictReason type) holds UI-SPEC 10.2 families A to I with fallbacks and the 10.3 request sentence; each Server Action names its family, maps a 409 through refusalMessage(family, reason) and returns the served reason, never Strapi's message. No action says 'Reload and try again'. A new refusal adds its sentence to its family and its row to refusal-copy.test.ts.
- [Phase 10]: 10-07: every failed saveQuestionnaireDraftAction returns failure: blocked on 403, 404 and every 409 (autosave stops until a refresh), retryable on 400, answer field errors, 5xx and transport failures. Answer-only validation failures read 'Some answers need attention before they can be saved.'; a malformed save is blocked. Plan 10-08's save status drives autosave from this field; plan 10-09 shows Reload questions from reason DEFINITION_CONFLICT or QUESTION_REMOVED.
- [Phase 10]: 10-08: autosaveQuestionnaireDraftAction validates and maps failures like Save draft but calls no revalidatePath and writes no cookie (Next 16.3.6 re-renders the page being edited for any revalidation); useAnswerAutosave drives it (1,500 ms, blur flush, one in flight plus one queued, blocked stops until Refresh page re-seeds). A session record of the last save wins at mount only when later than the page's latest answer time (questionnaire.updatedAt does not move on answer saves), so Back after an autosave shows the saved answers.
- [Phase 10]: 10-08: NavigationGuardProvider (shell, inside TimeZoneProvider) owns the controlled Leave this questionnaire? dialog and beforeunload; pages register with useLeaveGuard, single links use GuardedLink, link lists record the activated element in onClick and call guardLink from Link onNavigate. Sign out (OIDC) is guarded too, because the action ends the session before the browser leaves. Every overlay must use the radix-ui build: the mobile sheet moved off @radix-ui/react-dialog 1.1.15 so dialogs stack in one layer and focus stack (the old package is deferred for removal).
- [Phase 10]: 10-09: the analyst questionnaire page reads getQuestionnaireGovernanceQuestions, one GET /questions parsed as the active definition and as placements (every question, removed ones included, through the bound-free getQuestionnaireQuestionPlacements parser). questionnaire-placement.ts (zod-free) sends a section's stored metadata unchanged, gives a new section an unused section-{slug} key within 120 characters at the next free section order, and places a question one past the highest order in its section. QuestionnaireGovernance requires placements; later plans that render it pass them.
- [Phase 10]: 10-09: governance question forms open in place (Edit in its row, Add question to {section} after each section, the editor-level add at the top with the last section) and only one at a time. Focus is managed through a pending-focus ref that an every-render effect resolves once its element exists, so an added or removed question's focus waits for the reloaded questions. Save question is never disabled, so focus stays on it after a refusal; the form's single role=alert line carries the server reason, with Reload questions for DEFINITION_CONFLICT and QUESTION_REMOVED. The awaiting-submission view lists the released questions through ReleasedQuestionList with the served progress, and the released panel follows canReturnToAnalystReview.
- [Phase 10]: 10-10: question events (added, edited, removed, answer cleared) store a questionText snapshot in the governance log (trimmed, cut to 499 characters and an ellipsis above 500), appended before any write. The analyst projection prefers the snapshot, else resolves the key against every populated question (removed included) only when the event is not before generatedDate (none: always); an older event, an unknown key or an unreadable generatedDate names no question and the web reads 'A question from an earlier version'. Resolved text is bounded like a snapshot. Plan 10-11's regenerated event extends the same envelope and amendment and must keep generatedDate moving on replacement.
- [Phase 10]: 10-11: replacing a questionnaire appends one regenerated event (initiating analyst, new generatedDate, replaced and discarded counts in the UI-SPEC 3.4 sentence) built in memory before any question is deleted, so a full log fails the job and writes nothing; the Requestor projection keeps only kind and at, and the Requestor summary lists it only after the first release, restarting that round's count.
- [Phase 10]: 10-11: D-09 refuses generation for a released questionnaire (releasedAt, never the log) with 409 QUESTIONNAIRE_RELEASED before queueing, acknowledged or not, and the job re-checks under the request row lock and fails with the same code. revision.analystChangesSinceGeneration (question added, edited, removed at or after generatedDate; all of them when the date is absent or unreadable) is served by projectAnalystRevision on the analyst questionnaire read and every governance result only; plan 10-12's Replace confirmation reads it.
- [Phase 10]: 10-12: questionnaireGenerationAction offers Replace only for a questionnaire served in analyst-review; released, submitted, unavailable and state-less relations give released, so the hub never offers a replacement Strapi would refuse (D-22). The analyst request page reads the questionnaire summary on the server only when it will show the count (submitted request, replace action); a failed read or missing count gives the count-unavailable sentence (D-16).
- [Phase 10]: 10-12: a not-acknowledged generation failure offers the Replace this questionnaire? confirmation only while the questionnaire is not released (then the released hint shows); other failures keep Retry questionnaire generation (UI-SPEC 12.1). ConfirmDialog's description accepts a ReactNode so the served count renders in tabular figures (UI-SPEC 3.2).
- [Phase 10]: 10-13: GET /api/v1/assessment_requests/{requestId}/generation_jobs is human-analyst only (function.questionnaire_generation.request_jobs_read_api, role.security_analyst only, plus the HUMAN_ANALYST_ONLY_OPERATIONS literal). It returns { questionnaireGeneration, assessmentDraft }, each { job, canRetry } or null: the active job, else the retained job queued last, in the existing closed projections, with canRetry true only for the initiator. The registry reads neither authorise nor touch lastAccess; the by-id get and retry stay initiator-only and still answer another analyst 403 (D-27, not the 404 the plan named). Plan 10-14 seeds the hub from getRequestGenerationJobs and polls getRequestGenerationJobsAction.
- [Phase 10]: 10-13: a completed questionnaire job whose questionnaire can no longer be loaded reads as null on the request read instead of failing it. The harness has a second active human analyst (identities.secondAnalyst, users.secondAnalyst), and the matrix keeps six actors.
- [Phase 10]: 10-14: the analyst request page reads getRequestGenerationJobs after the gate and the request read; AssessmentDetail seeds both job cards with queued, running or failed jobs (never completed ones) through seededJob { job, canRetry }, reset only when the job id, status or retry right changes, and derives UI-SPEC 12.3's plain-text Next action (RequestHub nextActionOverride) from the cards' onJobStatusChange, falling back to the seeded status for the server render. Retry shows only while canRetry is not false; another analyst gets the retry-rights line and Generate or Replace (questionnaire) or Generate assessment draft.
- [Phase 10]: 10-14: a card polls by id only a job the viewer started or retried; any other job, and one a start handed back (the registry returns the active job to any analyst, so the retry right is unknown), is polled through getRequestGenerationJobsAction by request (D-27, UI-SPEC 12.5). A refused start or retry has its own title (Questionnaire generation couldn’t start, Draft generation couldn’t start; Status unavailable is only for a failed status check), resolving the 10-12 deferred item. Both job cards are in the D-38 copy guard.
- [Phase 10]: 10-15: GET /api/v1/risk_assessments/{assessmentId}/risks answers AssessmentRiskListResponse of AssessmentRiskListItem (statement; system and asset { documentId, name } inline with 1-255 bounds; inherent and residual likelihood, consequence and rating; treatment action, plan and status; risk and treatment owner as ActiveUserSummary; target date), populated and projected by projectAssessmentRiskListItem for the owning Requestor and the analyst alike; RiskSummary stays the five-field create and update response and RiskListResponse is removed. Every control implementation response carries the required nullable controlSummary { documentId, controlNumber, name, framework } (1-255 each, else null). The parser is listAssessmentRiskItems (no grandfathering), so the grandfather count is 42.
- [Phase 10]: 10-15: controlLabel/controlTitle (features/assessments/control-label.ts, zod-free) is the D-36 rule for every later plan. ReleasedRiskDetails is the one read-only Risk: h4 groups under the released view's h3 Risk number, h3 groups in the analyst's read-only editor, which now renders the whole shared Risk (mitigation group included) instead of RiskReadOnly/ControlReadOnly and the separate Mitigation controls section; the review page reads the list items when canMutateAssessment (now in assessment-domain.ts) is false. The released view's assessment and release dates use LocalInstant date-long; a contract mismatch shows the ordinary error state and the route logs [csrm-contract] response contract mismatch: {operation}.
- [Phase 10]: 10-16: the Information System record and list serve ownerName, the owner's trimmed display name (1-255, else null), from an owner populate narrowed to documentId and displayName; the form reads Selected owner: {name} or Name not available, never the id; ownerName is served whatever the owner's account status and is not writable
- [Phase 10]: 10-16: the systems list shows Owner and Business criticality after Name, unsortable, through systemOwnerLabel and systemCriticalityLabel (served name, Name not available, Not provided); ADMIN-05 stays open for the Information Asset owner (Phase 22). Plan 10-17's copy sweep keeps these columns
- [Phase 10]: 10-17: the Risk Type form's applicable-control options come from applicable-controls.ts (zod-free): the first 100 controls by number plus each saved selection beyond them, labelled by controlLabel; searchApplicableControlsAction asks listAdministrationControls for one page of 25 (number, name, framework). A selection with no option reads Control not found, never an id.
- [Phase 10]: 10-17: CSV messages name the matching column through keyLabel (Control number for Controls, else Name) in the web parser and Strapi's csv-import.ts alike; the APP titles and Risk Type descriptions reach the development database on the next seeded Strapi start (the control seed rewrites earlier-seeded rows, proven on a truncated APP-11).
- [Phase 10]: 10-18: RelationPicker (components/csrm/relation-picker.tsx, zod-free, shadcn Input and Popover) is the single-record picker for 10-19 and 10-20: a suggested group first, a debounced server search paged by pageSize with a stale-response guard, options named by aria-label and described by their second line, ArrowDown or Alt+ArrowDown or a pointer press opens it (never Tab), Enter never submits, Selected {noun}: {label} with Clear {label}. The assessment editor's Control field uses it with applicableControlGroup (assessment-domain.ts) and searchControlsAction (one Administration control page of 10, labelled by controlPickerItem); the review page no longer loads the control library.
- [Phase 10]: 10-18: the picker Risk Type list (GET /v1/risk_types with no query) serves RiskTypeSummary.applicableControls, each a RiskTypeApplicableControl of documentId, controlNumber, name and framework within 1-255 (a control outside the bounds is left out, never partial), sorted by control number and capped at 1,000; both closed picker parsers mirror it. chooseRelationMessage replaces selectRelationMessage (Choose a control.). The accessibility sweep now heads a Control record by its control label, repairing an expectation 10-17's title change left behind.
- [Phase 10]: 10-19: the review page reads the served Risk list for every assessment and the originating request only while it can change; the Risk Register reads the Risk's assessment then its request for a mutable Risk and degrades to search only on any failure
- [Phase 10]: 10-19: a saved Risk Register mitigation card takes its control from the response's controlSummary, else the current control only while the choice is unchanged; otherwise the form reads the UI-SPEC 13.5 unavailable message
- [Phase 10]: 10-19: a record chosen by search joins the assessment editor's label map (onRelationChosen), so a remounted editor keeps its name; an unknown id reads Name not available, never the id
- [Phase 10]: 10-20: the exemption review date is a date input in both editors; the form holds the stored instant's UTC date (exemptionReviewDateFormValue), compares date parts so an untouched legacy value is never resent, and saves a chosen date at 00:00 UTC (exemptionReviewDateFromForm, withExemptionReviewInstant); the schema message is Enter a valid exemption review date.
- [Phase 10]: 10-20: Control owner is an OwnerCombobox over searchActiveUsersAction in both editors (no new grant); ControlImplementationEditorOptions carries searchOwners instead of users; the Risk Register card takes its owner from the saved control implementation's controlOwner, and editing needs both options and searchOwners
- [Phase 10]: 10-20: useRecordSaveStatus (features/assessments) confirms a form's save in its data-slot=form-actions row only after an ok result, notes No changes to save. in the same region (SaveStatus note), and clears on any change and on failure; a new Risk or control confirms {Record} added at once its form mounts, and focus returns to Add Risk or that Risk's Add mitigation control
- [Phase 10]: [10-21] Release readiness Risk rows take their exact name {risk number}: {n} outstanding from aria-label, not a visually hidden colon (accessible-name computation pads the absolutely positioned sr-only span with spaces); the Missing caption is the link description, the met list is always rendered behind hidden, and focus moves by native fragment navigation to tabIndex=-1 destinations (DetailSection headingFocusable, Risk cards).
- [Phase 10]: 10-22: control titles live in apps/backend/src/bootstrap/controls/csrm-control-titles.json beside the byte-identical vendored catalogues (93 Annex A names, 293 descriptive CPS 230, CPS 234 and PSPF titles); readControlLibrary(appRoot) reads catalogues and titles, parseControlTitles refuses a malformed file naming the file and control, and controlName uses a title only where the catalogue gives no label. A later catalogue or title change edits that file; coverage is a test-time proof, never a boot check.
- [Phase 10]: 10-22: each descriptive title must share a non-generic five-letter stem with its own paragraph (generic = in more than half of the framework's paragraphs), be unique in its framework, 2 to 8 words, at most 80 characters, with no must or shall and not the paragraph's opening; control-titles.unit.test.ts enforces it. The PSPF Essential Eight rows read 'Maturity Level Two: {strategy}'.
- [Phase 10]: 10-23 Fix 3d: PSPF-130 reads 'Enabling appropriate access to official information and controlling supporting technology access', keeping the need-to-know 'appropriate' (pilot ruling); PSPF-042 and PSPF-095 keep their titles
- [Phase 10]: 10-23 Fix 8 addendum: axe scrollable-region-focusable on an overflowing picker popup is accepted as the APG activedescendant combobox false positive, set aside only for that rule on the open popover content, only in the overflow test that proves ArrowDown reaches the last option in view; the container stays untabbable
- [Phase 10]: 10-23 Task 3: REQ-07, QUES-08, QUES-09, ASSESS-06, ASSESS-07 and UX-06 delivered; ADMIN-05 delivered except the Information Asset owner, which moves to Phase 22 with a contract-gap record, so ADMIN-05 stays open

## Risks and Open Decisions

- **INT-02 (Keycloak):** implemented, flag-gated, and off in development (updated 2026-10-01). OIDC sign-in (ADR 0003, quick tasks 260929-u0w and 260930-iei) and Strapi access-token verification (ADR 0004, `b6000d0`) ship behind `CSRM_AUTH_OIDC_ENABLED` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION`, with provisioning behind `IDAMBOX_KEYCLOAK_PROVISIONING` (ADR 0002). Development and every suite keep them off and use the development identity bridge; nobody starts Keycloak or flips them during v2.0 work. New authorisation rules are enforced in Strapi against the resolved IdamBox User and never branch on the auth mode. Phase 22 keeps a development fixture for the Admin role. The remaining risk is deployment-time: a Keycloak environment, the ADR 0004 realm changes, and `externalSubject` links for every user.
- **Phase 8 residuals** (`docs/security/phase-08-residual-risks.md`):
  - closed: the fonts (R-08-24, G-10), self-hosted by quick task 261002-2y8 on 2026-10-02;
  - decided: the AI transcript flag (R-08-12, G-7);
  - already closed in code: the CORS allowlist (R-08-11);
  - still open, and deployment-time only: the proxy topology (R-08-04), log retention (R-08-13) and CSP reporting (R-08-07);
  - carried: the in-memory job registry and the shared job store (R-08-36) and PostgreSQL execution (R-08-37). Phases 13 and 21 touch jobs. Phase 21 narrows R-08-36 to in-flight coordination, because job history is Phase 12's persisted run record, and adds its new query constructs to R-08-37's checklist (21-CONTEXT D-21, D-24).
- **Plans written ahead:** Phases 11–22 and 17.1 are planned against today's code plus the planned outputs of earlier phases. Re-run each phase's plan check just before executing it.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260929-u0w | Add production-only OIDC sign-in to the CSRM web app against Keycloak | 2026-09-29 | 0f27661 | [260929-u0w-add-production-only-oidc-sign-in-to-the-](./quick/260929-u0w-add-production-only-oidc-sign-in-to-the-/) |
| 260930-iei | When CSRM_AUTH_OIDC_ENABLED=true, move the Signed in as / Sign out block to a top-right initials avatar menu with name, email and Sign out | 2026-09-30 | e76aa5f | [260930-iei-when-csrm-auth-oidc-enabled-true-move-th](./quick/260930-iei-when-csrm-auth-oidc-enabled-true-move-th/) |
| 261001-kxa | Make the Request context card span the full content width in the Analyst request detail view, matching the Requestor view | 2026-10-01 | a11d51b | [261001-kxa-update-the-analyst-request-detail-view-a](./quick/261001-kxa-update-the-analyst-request-detail-view-a/) |
| 261001-le4 | Add the missing gap after the Request relationships card in the Analyst request detail view, matching the Requestor view | 2026-10-01 | e10a1a1 | [261001-le4-add-the-missing-gap-between-the-request-](./quick/261001-le4-add-the-missing-gap-between-the-request-/) |
| 261002-2y8 | Self-host the three BProton font families through next/font/local (G-10, R-08-24) | 2026-10-02 | e3d805d | [261002-2y8-self-host-the-three-bproton-font-familie](./quick/261002-2y8-self-host-the-three-bproton-font-familie/) |
| 261002-drq | Restore Vietnamese glyphs and the 500 Button weight (typography follow-ups to 261002-2y8, G-10) | 2026-10-02 | c8d164d | [261002-drq-restore-vietnamese-glyphs-and-the-500-bu](./quick/261002-drq-restore-vietnamese-glyphs-and-the-500-bu/) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| debug_sessions | phase4-full-e2e-gate | awaiting_human_verify | 2026-09-28 | v1.0 |
| quick_tasks | 260830-1hh-remediate-the-confirmed-phase-2-review-f | unknown | 2026-09-28 | v1.0 |
| quick_tasks | 260830-89x-remediate-the-confirmed-phase-3-review-f | unknown | 2026-09-28 | v1.0 |
| quick_tasks | 260831-srn-remediate-every-phase-4-review-finding-w | unknown | 2026-09-28 | v1.0 |
| quick_tasks | 260901-oiw-remediate-every-confirmed-phase-5-review | unknown | 2026-09-28 | v1.0 |
| quick_tasks | 260901-qri-make-consecutive-playwright-runs-collisi | unknown | 2026-09-28 | v1.0 |
| quick_tasks | 260902-a9r-remediate-all-phase-6-independent-review | unknown | 2026-09-28 | v1.0 |
| uat_gaps | 02/02-HUMAN-UAT.md | passed | 2026-09-28 | v1.0 |
| uat_gaps | 03/03-HUMAN-UAT.md | passed | 2026-09-28 | v1.0 |
| uat_gaps | 05/05-HUMAN-UAT.md | passed | 2026-09-28 | v1.0 |
| uat_gaps | 06/06-HUMAN-UAT.md | passed | 2026-09-28 | v1.0 |
| deferred_items | 08/deferred-items.md: Close-out dispositions (2026-09-26) The phase review closed or routed every row above. Where a row's owner cel… | acknowledged | 2026-09-28 | v1.0 |
| deferred_items | 08/deferred-items.md: the 40 table rows (08-02 to 08-13) | resolved (Status column added; each row was closed or routed at the Phase 8 close-out) | 2026-09-28 | v1.0 |

## Performance Metrics

**v1.0 final gate** (2026-09-26, `7eaf99d`):
- Playwright 84/84 in both projects on the production build;
- Strapi 526/526;
- web 1,892/1,892;
- typecheck and `api:check` clean.

**Post-demo baseline** (2026-10-01, `ece1a25`): Playwright 84/84; Strapi 578/578; web 2,046/2,048, with two stale paths fixed in `678b117`.

**Post-demo gate after G-10** (2026-10-02, `e3d805d`): Playwright 85/85 (81 desktop, 4 mobile); Strapi 578/578; web 2,053/2,053; typecheck, lint and `api:check` clean.

**Post-demo gate after 261002-drq** (2026-10-02, `c8d164d`): Playwright 86/86 (82 desktop, 4 mobile, 10.9 min); Strapi 578/578 (676 s); web 2,055/2,055; typecheck, lint and `api:check` clean; the tree was clean afterwards.

Gate history: `.planning/milestones/v1.0-STATE.md`.
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 10 P01 | 32 min | 3 tasks | 16 files |
| Phase 10 P02 | 41 min | 3 tasks | 20 files |
| Phase 10 P03 | 23 min | 2 tasks | 4 files |
| Phase 10 P04 | 15 min | 3 tasks | 15 files |
| Phase 10 P05 | 13 min | 3 tasks | 16 files |
| Phase 10 P06 | 36 min | 3 tasks | 20 files |
| Phase 10 P07 | 11 min | 2 tasks | 9 files |
| Phase 10 P08 | 39 min | 3 tasks | 20 files |
| Phase 10 P09 | 40 min | 3 tasks | 16 files |
| Phase 10 P10 | 25 min | 2 tasks | 13 files |
| Phase 10 P11 | 40 min | 3 tasks | 17 files |
| Phase 10 P12 | 13 min | 2 tasks | 10 files |
| Phase 10 P13 | 33 min | 3 tasks | 23 files |
| Phase 10 P14 | 19 min | 3 tasks | 12 files |
| Phase 10 P15 | 32 min | 3 tasks | 22 files |
| Phase 10 P16 | 37 min | 2 tasks | 10 files |
| Phase 10 P17 | 36 min | 3 tasks | 18 files |
| Phase 10 P18 | 47 min | 3 tasks | 24 files |
| Phase 10 P19 | 24 min | 3 tasks | 13 files |
| Phase 10 P20 | 22 min | 3 tasks | 16 files |
| Phase 10 P21 | 12 min | 3 tasks | 10 files |
| Phase 10 P22 | 43 min | 3 tasks | 7 files |
| Phase 10 P23 | 48min gate + walkthrough rounds (2026-10-02 to 2026-10-03) | 3 tasks | 51 files |

## Session Continuity

**Last session:** 2026-10-02T19:21:39.561Z
**Stopped At:** Completed 10-23-PLAN.md

**Planning gate record (2026-10-02, pilot):**
- Every phase has plans and a passing plan check: 16 phases, 290 plans (`<phase>-PLAN-CHECK.md`). Phase 10 keeps its 2026-09-27 check and re-checks at the start of its execution, as every phase does.
- Every ask PD-1 to PD-5 traces to requirements, a phase, success criteria and plans (ASSESS-21 to 26, COLLAB-04, NOTIFY-04 and RISK-06 each appear in plan frontmatter; the journey spec `apps/csrm/e2e/risk-owner-journey.spec.ts` is built by 17-19, 17.1-18, 17.2-15 and 20-23).
- No pre-rename app path in Phases 10–22, ROADMAP, REQUIREMENTS, STATE, PROJECT, NEXT-WAVE-DECISIONS or CONTEXT.md.
- `gsd-tools validate health`: 0 errors, 16 I001 (plans without summaries, expected before execution) and 3 W019 warnings, dispositioned and not renamed. W019 flags every root `.planning/` file GSD does not generate, and GSD has no allowlist. `POST-DEMO-BRIEF.md` and `NEXT-WAVE-DECISIONS.md` are named by the operator's brief and cited across the phases, and `APP-UI-REVIEW.md` is a v1 record (2026-09-10) that v1 documents cite by path.

**Resume prompt:** `.planning/prompts/post-demo-build.md`. Paste the launcher line the operator was given into a new session after the weekly reset.
**Resume File:** None

**Exact next step to resume:**
1. Re-read the brief and this file, confirm the branch is `post-demo` with a clean tree (apart from the brief's three operator items), and check usage.
2. Stage 2 is complete and its planning gate passed: every phase in execution order (10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22) has its CONTEXT, an approved UI-SPEC, research, a pattern map, plans and a passing plan check.
3. Both quick tasks before Phase 10 are done (261002-2y8 and 261002-drq). Deferred from 261002-drq, for a later task: a tailwind-merge configuration that knows the theme's custom text sizes, which would retire the `!text-*` Button inks; the unused `.button-primary` and `.button-secondary` CSS; and whether 14px inputs should become 16px on phones to stop iOS zooming on focus, a question for the design direction (`261002-drq-deferred-items.md`).
4. Stage 3: build each phase in execution order, from Phase 10, whose plan check is done (`10-PLAN-CHECK.md`, fresh check of 2026-10-02). Each phase opens with a fresh plan check, then `/gsd-execute-phase` through the worker, the GSD verifier, every gate green in dev mode with Playwright covering the phase's flows, and atomic commits. Every contract-gap record stops at its approval checkpoint for the pilot (G-6). Plan 10-23 Task 2 is a blocking checkpoint where the pilot walks both actors on the dev servers at 375 and 1440. The post-demo journey (`apps/csrm/e2e/risk-owner-journey.spec.ts`) is built in slices by 17-19, 17.1-18, 17.2-15 and 20-23.
5. Phase 20 stays whole at 23 plans. If execution shows a split is needed, its PLAN-CHECK names the seam (RISK-03 and ADMIN-06: plans 20-10 to 20-12 and 20-19 to 20-21).

## Next Action

**Post-demo Stage 3 on branch `post-demo`:** Phase 10 execution (its fresh plan check is done), following Session Continuity above. No phase is built yet.

## Accumulated Context

### Roadmap Evolution

- Phases 10–22 added (2026-09-27): the next wave from the product gap UAT (65 findings). Phase 9 is scoped by Phases 12, 15, 16 and 17.
- Phase 17.1 inserted after Phase 17 (2026-09-27): Review, peer approval and risk acceptance (`NEXT-WAVE-DECISIONS.md` decision 17 and G-2). There are now 46 requirements.
- v1.0 closed (2026-09-28): an override close-out, with its phase directories kept and Phase 06.10 moved to backlog 999.1.
- v2.0 started (2026-09-28): Assessment Lifecycle and Oversight, Phases 10–22 and 17.1.
- Phase 17.2 inserted after Phase 17.1 (2026-10-01): Contest points and rework rounds (`NEXT-WAVE-DECISIONS.md` G-15), because the contest-and-rework loop would push Phase 17.1 past size L. The post-demo decisions G-11 to G-18 also amend Phases 17, 17.1 and 20; there are now 55 requirements.
- Phase 19.1 inserted after Phase 19 (2026-10-01): In-app notification centre (`NEXT-WAVE-DECISIONS.md` G-19), because the notification centre pushed Phase 17 beyond size L. NOTIFY-01 moves from Phase 17, and Phase 19.1 runs before Phase 17.
