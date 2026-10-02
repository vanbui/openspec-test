# Roadmap: IdamBox Cyber Risk Manager (CSRM)

## Milestones

- ✅ **v1.0 Controlled Cyber Risk Assessment Workflow** — Phases 1–9 with 06.1–06.10 (shipped to `main` 2026-09-26; closed 2026-09-28). Full detail: `.planning/milestones/v1.0-ROADMAP.md`.
- 🚧 **v2.0 Assessment Lifecycle and Oversight** — Phases 10–22, 17.1, 17.2 and 19.1 (planning).

## Phases

<details>
<summary>✅ v1.0 Controlled Cyber Risk Assessment Workflow (Phases 1–9) — SHIPPED 2026-09-26</summary>

- [x] Phase 1: Monorepo Foundation and Secure Application Shell (10/10 plans)
- [x] Phase 2: Requestor Risk Assessment Request Workflow (12/12 plans)
- [x] Phase 3: Dynamic Questionnaire Workflow (12/12 plans)
- [x] Phase 4: Assessment Review, Risk Editing, and Release (23/23 plans)
- [x] Phase 5: Risk Register and Mitigation Management (12/12 plans)
- [x] Phase 6: Administration and CSV Imports (11/11 plans)
- [x] Phase 06.1: Requestor and Analyst Revert-to-Draft for Requests and Questionnaires (4/4 plans)
- [x] Phase 06.2: AI-Generated Contextualised Questionnaire (5/5 plans)
- [x] Phase 06.3: Correctness, Search, and Selection (11/11 plans)
- [x] Phase 06.4: Cross-Record Navigation and Interface Consistency (11/11 plans)
- [x] Phase 06.5: Design System Conformance (8/8 plans)
- [x] Phase 06.6: Cross-Surface UI Consistency (8/8 plans)
- [x] Phase 06.7: Real AI Provider Integration for Questionnaire and Assessment Generation (6/6 plans)
- [x] Phase 06.8: Workflow Visibility and Questionnaire Governance (10/10 plans)
- [x] Phase 06.9: Assessment Navigation and Lifecycle Visibility (4/4 plans)
- [ ] Phase 06.10: Local LLM Evaluation and Optimisation — deferred; moved to the backlog (999.1)
- [x] Phase 7: Analyst Dashboard, Reports, and Alerts (9/9 plans)
- [x] Phase 8: Production Integration and Hardening (14/14 plans) — complete except INT-02 (deferred by operator decision)
- [ ] Phase 9: Human-Supervised Agentic Workflows — superseded by v2.0 Phases 12, 15, 16 and 17

</details>

## v2.0 Assessment Lifecycle and Oversight (Phases 10–22, 17.1, 17.2 and 19.1)

Added 2026-09-27 from the product gap UAT in `.planning/uat/product-gaps/` (`REPORT.md`, `FINDINGS.md` and `FINDINGS.csv`, 65 findings). These phases take CSRM from the v1 workflow to the operator's intended product (`BRIEF.md`, Appendix A: roles R1–R3, core flow F1–F10, A1–A2 at any point, oversight O1–O2, qualities Q1–Q5). Every finding maps to exactly one phase (the `Proposed phase` column of `FINDINGS.csv`) and to at least one Next-wave requirement in `REQUIREMENTS.md`. Milestone v1.0 stays open (STATE.md Decisions, 2026-09-27): these phases continue its numbering, and the operator may move them into their own milestone when v1.0 is closed.

**Decisions.** The operator delegated the product decisions on 2026-09-27. `.planning/NEXT-WAVE-DECISIONS.md` records all eighteen from `REPORT.md` §9 and six more (G-1 to G-6), each grounded in cyber-governance practice and a premium experience bar. Each phase's CONTEXT.md cites the numbers it depends on. On 2026-10-01 the post-demo decisions G-11 to G-18 reconciled the product demo's risk-owner asks (PD-1 to PD-5) into Phases 17, 17.1 and 20, and inserted Phase 17.2. The same day, G-19 moved the in-app notification centre out of Phase 17 into the inserted Phase 19.1, which keeps Phase 17 within size L.

**Frozen datamodel.** A phase that needs a content-type change writes its `docs/contract-gaps/` record first. The schema change then waits at a checkpoint until the record is reviewed and approved (G-6). Phases 10, 11, 12 (except its run record and provenance), 19 and 21's first metric set need no content-type change.

**Execution order and waves.**

| Wave | Phases | Why this order |
|---|---|---|
| 1. Fix and trust | 10 → 11 → 12 | Fixes what users hit today, clarifies navigation and landing, and gives the AI full context and visible provenance, which every later AI phase builds on |
| 2. Collaboration and iterative AI | 13 → 14 → 15 → 16, then 19 → 19.1 | Notes and assignment come before the steps that use new information; export is independent and delivers CSV early; the notification centre lands before the response stage that sends most of its events |
| 3. The full flow and the table | 17 → 17.1 → 17.2 → 18 → 20 | The response stage needs notes, curation and provenance; review and acceptance close the flow, and contest rounds rework it before closure; the risk table needs withdrawal, provenance markers, export and the acceptance-round lock; post-release tracking needs the registers and the owners' decisions |
| 4. Oversight and administration | 21 → 22 | Metrics need the history, assignment and scales from earlier phases; the Admin role takes over the configuration they introduce |

Phase 19 runs before Phase 18, because the risk table's import and export reuse its export and spreadsheet infrastructure.

### Phase 10: Existing-flow gap closure

**Goal:** As a Security Analyst or Requestor, I want the existing request, questionnaire, assessment and administration screens to work as they say, so that today's flow completes without workarounds, lost input or misleading messages.
**Mode:** mvp
**UI hint:** yes
**Requirements:** REQ-07, QUES-08, QUES-09, ASSESS-06, ASSESS-07, ADMIN-05, UX-06
**Depends on:** Phase 8
**Closes:** UAT-005, UAT-006, UAT-007, UAT-009, UAT-010, UAT-011, UAT-015, UAT-016, UAT-019, UAT-020, UAT-021, UAT-022, UAT-023, UAT-024, UAT-033, UAT-034, UAT-036, UAT-037, UAT-041, UAT-053, UAT-054, UAT-062, UAT-064
**Intent:** F1, F4, F5, F7, F9, F10, O2, Q5, R3
**Decisions:** every control gets a readable title, the framework's own name where it has one and otherwise a short descriptive title (#15, now in this phase); the analyst sees the Requestor's answered count but not the answers before submission; every human analyst sees a request's generation-job status (G-6). Numbers refer to `NEXT-WAVE-DECISIONS.md`.
**Contract and datamodel:** API only (conflict reason codes, a generation-job read by request, questionnaire progress without content, a Regenerated governance event); no content-type change. The Information Asset owner (the rest of UAT-053) needs a content-type change and moves to Phase 22 with a contract-gap record.
**Size:** L

**Success Criteria:**

1. An analyst adds a question to a new section and to an existing section of an AI-generated questionnaire, and the form opens where they clicked with focus inside it.
2. The analyst's request page shows third-party involvement, third-party details and regulatory requirements, and the actions refresh after a return to draft.
3. A Requestor who leaves with unsaved answers finds them autosaved or is warned first; radio groups select with the arrow keys.
4. The mitigation control, system, asset and control-owner pickers find records by typing, every date uses the date input, and saving a risk confirms it.
5. The released assessment names each control and shows each risk's treatment plan, owners and target dates.
6. Every refusal this UAT met (UAT-016, UAT-036, UAT-062) is either not offered or states its real reason, and revision timelines show local times and question text.

**Plans:** 18/23 plans executed (one per wave; serialised by shared files and Playwright, D-40)

Plans:
**Wave 1**
- [x] 10-01-PLAN.md — Record the five UI-SPEC extensions (X-1 to X-5) in the design direction, then deliver D-19's viewer time zone end to end: the browser's zone reaches a validated cookie through a Server Action, the app

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-02-PLAN.md — Gate the three analyst detail routes on `assessment:review` before any read, exactly as the analyst dashboard does (07 D-16), and rewrite every Phase 10 permission description in plain terms (D-24). C

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 10-03-PLAN.md — Make arrow keys select deterministically in the shared shadcn radio wrapper and in the segmented control (D-14), removing the Radix timing race behind UAT-064.

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 10-04-PLAN.md — Deliver REQ-07 on both request pages. One shared read-only request context shows every submitted field in the form's groups (D-20); the Requestor's actions derive from server state after every transit

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 10-05-PLAN.md — Rebuild the Requestor's questionnaire page around guidance (D-13): the introduction first, the attention list only after a submit attempt and in form order, history below the questions counted per rel

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 10-06-PLAN.md — Add D-03's first API change: closed conflict reason codes on the 409s the UAT met (D-22). Strapi's workflow errors carry one reason each (split throw sites), the controllers pass it as `details`, both

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 10-07-PLAN.md — Turn plan 10-06's reason codes into UI-SPEC §10.2's copy in the Server Actions for requests, questionnaires and questionnaire generation, and replace every "changed, reload" 409 fallback (§10.3). Save

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 10-08-PLAN.md — Deliver D-11 and D-12: answers autosave with a visible save status, and leaving warns while anything is unsaved. `useAnswerAutosave` drives a new autosave Server Action variant that calls no `revalida

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 10-09-PLAN.md — Fix the governance editor (D-04 to D-06) and the analyst's view of a released questionnaire (D-07). Placement comes from the complete question set through a new registered placement parser; the form c

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 10-10-PLAN.md — Add D-03's third API change in part: question events store a bounded text snapshot (D-18), and the analyst timeline projects question text by snapshot or by the D-17 resolution rule, so no timeline sh

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 10-11-PLAN.md — Deliver the server and contract half of UAT-019: the `regenerated` governance event (D-10, the remaining part of D-03 item 3), the refusal to replace a released questionnaire (D-09), and the analyst c

**Wave 12** *(blocked on Wave 11 completion)*
- [x] 10-12-PLAN.md — Build the hub side of UAT-019 on plan 10-11's contract: `Replace questionnaire` with a confirmation that states the discard count (D-08), no offer and an explanatory hint while the questionnaire is re

**Wave 13** *(blocked on Wave 12 completion)*
- [x] 10-13-PLAN.md — Add D-03's second API change: one human-analyst-only read of a request's current generation jobs (D-25), through the full chain of D-02: registry reads, a workflow function, a route and handler, the o

**Wave 14** *(blocked on Wave 13 completion)*
- [x] 10-14-PLAN.md — Seed the analyst hub's questionnaire and draft job panels from plan 10-13's read on load (D-26), show jobs another analyst started with the right retry rights, override the Next action line while a jo

**Wave 15** *(blocked on Wave 14 completion)*
- [x] 10-15-PLAN.md — Add D-03's fifth API change (D-34): a new list-item schema for the assessment's risk read carrying the brief §8 treatment and ownership facts, and a bounded control summary on control implementations.

**Wave 16** *(blocked on Wave 15 completion)*
- [x] 10-16-PLAN.md — Add D-03's sixth API change: the Information System owner's display name on the Administration record and list (D-37), then seed the form's owner combobox with it and add the Owner and Business critic

**Wave 17** *(blocked on Wave 16 completion)*
- [x] 10-17-PLAN.md — Finish D-36's content and label work in Administration: correct the public APP titles and the three Risk Type descriptions in the seed data, apply the control label rule to the Administration controls

**Wave 18** *(blocked on Wave 17 completion)*
- [x] 10-18-PLAN.md — Deliver D-28's shared record picker and use it first for the assessment editor's mitigation control (D-29, D-31), with D-03's seventh API change: bounded applicable-control summaries on the picker's R

**Wave 19** *(blocked on Wave 18 completion)*
- [ ] 10-19-PLAN.md — Finish D-28's picker rollout: the impacted system and asset fields in both editors (D-30), and the Risk Register's mitigation control (D-29, D-31), reusing plan 10-18's `RelationPicker`, `searchContro

**Wave 20** *(blocked on Wave 19 completion)*
- [ ] 10-20-PLAN.md — Deliver D-32 (the exemption review date as a date input in both editors), the control owner part of D-28 (`OwnerCombobox` in both editors) and D-33 (save confirmations in the assessment editor, using 

**Wave 21** *(blocked on Wave 20 completion)*
- [ ] 10-21-PLAN.md — Deliver D-35's release readiness summary (web only; the served requirements already carry scope, Risk number, state and destination) and the remaining D-38 copy on the assessment editor and the Risk R

**Wave 22** *(blocked on Wave 21 completion)*
- [ ] 10-22-PLAN.md — Deliver D-46 (operator decision 15): load a title for every seeded control whose catalogue gives none, as seed data. The ISO/IEC 27001:2022 Annex A controls take the standard's own control names; the 

**Wave 23** *(blocked on Wave 22 completion)*
- [ ] 10-23-PLAN.md — Close Phase 10 in three steps. First, run the five-command phase gate on the production build with the static checks D-01 and D-02 require, commit the gate record, and only then check that the tree is

### Phase 11: Navigation, landing and list clarity

**Goal:** As a Requestor or Security Analyst, I want a sectioned sidebar and a Home that leads with my next action, so that I always know where my work is and what to do next.
**Mode:** mvp
**UI hint:** yes
**Requirements:** UX-07, UX-08, UX-09, UX-10, DASH-03
**Depends on:** Phase 10 (shared screens; no functional dependency)
**Closes:** UAT-001, UAT-002, UAT-003, UAT-004, UAT-035, UAT-038, UAT-048, UAT-060, UAT-065
**Intent:** Q1, Q2, Q5, F2
**Decisions:** "Released" is the request's display label (#16); exposure defaults to released risks, with "under assessment" apart and accepted risks marked (#11); analysts land on the analyst Home; quick find opens with Ctrl+K or ⌘K (G-5); the premium experience bar applies to every surface (G-4).
**Contract and datamodel:** API only, with no content-type change and no new grant (11-RESEARCH D-02):
- the catalogue-reserved `GET /v1/my_requests` is served, with a lifecycle `holder` field for the Requestor split;
- the review queue gains an `all` view, search by number or title, and the triage projection fields;
- the assessment lists gain request title, risk count, highest residual rating and their filters;
- the Risk Register gains the filters its figures open;
- a released or under-assessment dimension is added to exposure;
- the treatment report window moves from 30 to 14 days, changing Phase 7 D-13.

"Assigned to me" counts arrive with Phase 13. Phase 7 D-15 (`/app` stays the personal dashboard) is reversed by the Home decision.
**Size:** M

**Success Criteria:**

1. The analyst's sidebar has headed sections, no personal items above the review work, and every label matches its page heading; the phone drawer shows the same sections.
2. The analyst lands on their queue and deadlines; the Requestor's first screen on a 375px phone shows what needs their action.
3. The Requestor's Home separates "Needs your action" from "With the Security Analyst", naming who holds each item.
4. The request queue shows requestor, assessment type, criticality, due date and age, and every dashboard and report figure opens its records.
5. Exposure widgets and reports say whether they include unreleased risks, and a released request reads "Released".
6. Ctrl+K or ⌘K finds a request, questionnaire, assessment or risk by number or title and opens it, showing only records the user may read.

**Plans:** 21 plans (one per wave; serialised by Playwright and shared files)

Plans:
**Wave 1**
- [ ] 11-01-PLAN.md — Record the UI-SPEC's extensions X-6 to X-10 in the design direction first (orchestrator constraint: the first Phase 11 plan records them before any implementing task). Then deliver D-46 end to end: th

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 11-02-PLAN.md — Make `/app` Home for both actors (D-16): the page reads the session's capabilities, renders the analyst Home (today's analyst dashboard content, moved) for `assessment:review` and the Requestor Home (

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 11-03-PLAN.md — Reorder the analyst Home to lead with the queue, deadlines and alerts (D-18) and set its tiles two by two below xl so the queue is on the first 375px screen (UI-D20). Render Recent activity dates thro

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 11-04-PLAN.md — Introduce one heading string per navigation destination (`page-headings.ts`) and make the navigation label, the `PageHeader` title and the route title read it (D-09, UI-SPEC §2.1). Rename the headings

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 11-05-PLAN.md — Turn the flat navigation list into per-actor profiles of labelled sections (D-06 to D-08, D-12, D-13), render them in the sidebar and the drawer through the one component that keeps Phase 10's guard o

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 11-06-PLAN.md — Deliver D-02 item 1 through the full endpoint chain: the queue projection gains the requestor's display name, assessment type, business criticality, due date and days since submission; `filters[q]` ma

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 11-07-PLAN.md — Deliver D-02 item 2 through the full chain: the shared assessment projection gains `requestTitle`, `riskCount` and `highestResidualRating`; `q` also matches the request title; `overallRating`, `approv

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 11-08-PLAN.md — Deliver D-02 item 5: the lifecycle's `nextAction` gains `holder`, and `request-lifecycle.ts`'s sentences name the holder (D-20, D-21, D-27, UI-SPEC §6.1), through the specification, the closed web par

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 11-09-PLAN.md — Build the compact lifecycle stepper below 768px (D-26, X-9) on both request pages, with one next action displayed per width (UI-D23) and Phase 10's generation-job override feeding it on the analyst hu

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 11-10-PLAN.md — Serve the catalogue-reserved `GET /v1/my_requests` (D-03) with an owner predicate from the policy and a holder predicate built from the review queue's lifecycle facts (D-02 item 6, D-20), projecting e

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 11-11-PLAN.md — Move My requests onto `GET /v1/my_requests` (D-34): add the `Next step` column with the holder line and the server's sentence, the `Show` holder filter and chip, the local `Updated` date, and the hold

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 11-12-PLAN.md — Rebuild the Requestor Home (D-19 to D-24) on `GET /v1/my_requests`'s holder: Needs your action, With the Security Analyst and Released assessments, each bounded with its total and an equal list link (

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 11-13-PLAN.md — Add the count badges of D-10 to the sidebar and drawer: server-scoped, bounded reads through existing service functions (D-11), started in the layout without awaiting them and streamed to the navigati

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 11-14-PLAN.md — Split the Risk register's scope into its two named branches, released and under assessment (D-40), and expose them as the `stage` filter and row field, with `treatmentAction` as a filter and row field

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 11-15-PLAN.md — Complete D-02 item 3: the Risk register's closed filters `dueState`, `mitigationEffectiveness`, `mitigationStatus=any`, the `none` values and `impactedSystem=none`, so every figure that counts Risks c

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 11-16-PLAN.md — Deliver D-02 item 4's dashboard half: the summary's exposure splits into released, released-and-accepted and under-assessment rating counts using the Risk register's named branches (D-40, D-41), and t

**Wave 17** *(blocked on Wave 16 completion)*
- [ ] 11-17-PLAN.md — Deliver D-02 item 4's report half: the risk-exposure report counts released Risks and adds the accepted and under-assessment figures (D-42); the treatment-performance window becomes 14 days (D-38), co

**Wave 18** *(blocked on Wave 17 completion)*
- [ ] 11-18-PLAN.md — Link every remaining report figure to its list (D-35 to D-39, X-10, UI-SPEC §8): `ReportTable` gains cell and row-header links; the presentation module builds each href and accessible name from the li

**Wave 19** *(blocked on Wave 18 completion)*
- [ ] 11-19-PLAN.md — Build quick find (D-47 to D-52, X-7, X-8): the header search control and the shortcut, a lazily loaded dialog on the source-owned shadcn `Command` (cmdk 1.1.1, already installed), one validated Server

**Wave 20** *(blocked on Wave 19 completion)*
- [ ] 11-20-PLAN.md — Complete quick find's states (D-53), phone sheet and desktop frame (X-8), focus rules and guard interaction (D-48, D-51), the kept term (UI-D12) and the cold-open and load-failure paths (D-52), and ca

**Wave 21** *(blocked on Wave 20 completion)*
- [ ] 11-21-PLAN.md — Close Phase 11 in three steps. First, the full gate on the production build with the static checks D-01 and D-02 require, committed before the clean-tree check. Second, a blocking checkpoint: the orch

### Phase 12: AI context, suggestions and provenance

**Goal:** As a Security Analyst, I want the AI to work from everything the Requestor gave and to show where each proposal came from, so that I can trust, check and correct its output quickly.
**Mode:** mvp
**UI hint:** yes
**Requirements:** INT-05, INT-06, ASSESS-08, QUES-10
**Depends on:** Phase 10 (question editing works)
**Closes:** UAT-029, UAT-030, UAT-031, UAT-032, UAT-042, UAT-043, UAT-044
**Intent:** F1, F3, F6, F7, Q5 (Phase 9 foundation)
**Decisions:** the AI draws on the active Risk Type library (#14); it may propose "Accept" only for Low or Moderate residual risk, with a rationale (#8); the AI data policy applies: minimal context, Requestor text delimited as untrusted, a run record per generation, and refusal above the provider's approved classification ceiling (G-3); analyst instructions are trusted but bounded (#5). Approving the hosted provider for production data stays the operator's, and every suite stays on the deterministic provider.
**Contract and datamodel:** API (the assessment context, draft and questionnaire schemas, persisted suggestions). Per-field provenance and the AI run record have no home in the frozen schema: contract-gap record first, then an approval checkpoint. Carries R-08-42 (the analyst service agent's request grants).
**Size:** M

**Success Criteria:**

1. A draft for UAT-A-like input links each risk to the request's systems and assets and proposes more than one risk per Risk Type where the answers warrant it.
2. Each proposed statement cites the answers or request fields it used, and uncited claims are flagged.
3. Suggested controls appear on each risk as one-click proposals.
4. The assessment and questionnaire mark AI-proposed values and show who generated them, when and with which provider; the Requestor's view says AI assisted and an analyst reviewed.
5. A generated questionnaire for a non-expert request has help text and choice questions with "Not sure".

**Plans:** 19 plans (wave 1 pairs the contract record with the harness pins; then one per wave, serialised by the shared Strapi test build and Playwright)

Plans:
**Wave 1**
- [ ] 12-01-PLAN.md — Record the 12-UI-SPEC's extensions X-11 to X-14 in the design direction (orchestrator constraint: before any implementing task). Write `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md` in 
- [ ] 12-02-PLAN.md — Build the shared scale module (D-10, D-11) and the AI data policy module (D-26 to D-28), wire the new ceiling setting from environment to configuration to boot validation (D-27), gate the transcript d

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 12-03-PLAN.md — Build the deep context module in `apps/backend/src/csrm/ai/` (D-04 to D-08): a loader that reads the request, its selected systems and assets, the submitted questionnaire (draft only), the Risk Type l

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 12-04-PLAN.md — Apply the approved schema change (D-01): the `CsrmAiRun` content type and the optional `aiProvenance` JSON on `CsrmRisk` and `CsrmAssessment`. Add the run-record service (lifecycle, append-only decisi

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 12-05-PLAN.md — Move questionnaire generation onto the assessment context (D-04, D-16), give it the wire v2 shape and adapter inside the portable schema subset (D-06), persist help text (D-17), guarantee "Not sure" o

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 12-06-PLAN.md — Replace the draft provider layer with the internal proposal v2, a context-aware closed parser, the hosted adapter for wire v2 and a deterministic provider that exercises every behaviour (D-09 to D-15)

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 12-07-PLAN.md — Refuse both AI operations at enqueue when the data policy refuses (D-28), carrying the closed reasons through Strapi, the specification and the web's refusal copy (D-02), and prove the enqueue and exe

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 12-08-PLAN.md — Project `helpText` on every question read (D-17), `aiAssisted` on every questionnaire summary, and, for analysts only, the `generation` facts on the header and `aiOrigin` on each question (D-22, D-23,

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 12-09-PLAN.md — Project the assessment's `generation` facts and the assessment's and each risk's `aiProvenance` to the analyst (D-21, D-23, D-25), resolving actors, controls and citation labels in bounded reads, and 

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 12-10-PLAN.md — Serve the run read (D-25) as a human-analyst-only operation with its web service and Server Action; move draft generation and its job read and retry into human-analyst-only Functions (D-32); withdraw 

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 12-11-PLAN.md — Give the one mutability guard its closed reason end to end and add the transition option to `withMutableAssessmentMutation`, as the 2026-10-01 confirmations and Phase 16 D-22 and D-23 fix them. Add th

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 12-12-PLAN.md — Build the decision operation (D-24) for AI-proposed fields, on 12-11's guard reason and transition option, with its grant and matrix row, its contract and the typed web service, and the G-14 refusal t

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 12-13-PLAN.md — Extend 12-12's decision operation to suggested controls (D-12): "Add as planned control", dismiss and restore, the guarded Undo (UI-D12), and the G-14 refusal when a suggestion is added and an AI Acce

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 12-14-PLAN.md — Add the request's AI policy status to Phase 10's generation-jobs read (D-29) and render it on both job cards: the allowed caption, the two refusal alerts in place of the actions, the three new failure

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 12-15-PLAN.md — Build the provenance header (X-11), the "What the AI used" side sheet (X-13) and the Requestor's notice, mount them on the analyst's assessment editor (all states), the analyst's questionnaire review 

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 12-16-PLAN.md — Add the "Review of AI proposals" readiness requirement (D-21), and build the field markers, review bars, Confirm and Confirm remaining with optimistic feedback, rollback and Undo (D-24, D-35, D-36), t

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 12-17-PLAN.md — Build the citations and their source popover (X-12, D-14), the uncited claims region, and the suggested controls list with add, dismiss, restore and Undo (D-12, D-24, UI-D11, UI-D12), and place them i

**Wave 17** *(blocked on Wave 16 completion)*
- [ ] 12-18-PLAN.md — Render help text for both actors, Not sure, the Requestor's introduction disclosure, the analyst's question origin markers, the help text field in the governance form and the release dialog's variant 

**Wave 18** *(blocked on Wave 17 completion)*
- [ ] 12-19-PLAN.md — Write the UAT-A-like journey (D-38; UI-SPEC §14.1 E6) with its own records at both widths and axe, share the release helper with the release journey, add the glossary entries, record the API coverage 

### Phase 13: Request pick-up and notes

**Goal:** As a Security Analyst, I want to pick up a request and exchange notes with the Requestor on it, so that ownership is clear and new information has a home at any point.
**Mode:** mvp
**UI hint:** yes
**Requirements:** REQ-08, COLLAB-01
**Depends on:** Phase 11 (queue columns)
**Closes:** UAT-013, UAT-014
**Intent:** F2, A1, A2, R2
**Decisions:** one accountable assignee: analysts self-assign or any analyst assigns, editing is not exclusive, and reassignment is recorded (#10); an analyst cannot be assigned a request they raised (G-1); both actors add notes from submission until closure; a note can mark the AI inputs as changed.
**Contract and datamodel:** an assignee relation on the request and a note entity with per-person read state: `docs/contract-gaps/phase-13-request-assignment.md` and `docs/contract-gaps/phase-13-request-notes.md` first, then an approval checkpoint; API for pick up, assign, reassign and unassign (one compare-and-set operation), the eligible-analyst read, note create and list, mark read, and the analyst's "changes the AI inputs" mark, with exact grants and record-level checks. Security note O-5 is settled by G-1 (separation of duties). One `assertAssignedAnalyst` predicate serves Phase 17.1's submit, recall, and release and close.
**Size:** L (was M: the read state, the eligible-analyst read and the AI-input mark join assignment and notes)

**Success Criteria:**

1. An analyst picks up a request from the queue, and it shows "Assigned to <name>" everywhere it appears.
2. "Assigned to me" is a queue view and a dashboard figure, and any analyst on the request can follow its generation jobs.
3. The Requestor adds a note after submission, and the analyst sees it flagged on the queue and the request.
4. The analyst replies with a note the Requestor sees; each note shows its author and local time, and another Requestor cannot read it.
5. A note can be marked "changes the AI inputs", which Phases 12, 15 and 16 read.

**Plans:** 19 plans (wave 1 pairs the two contract records; then one per wave, serialised by the spec, catalogue, matrix and test build)

Plans:
**Wave 1**
- [ ] 13-01-PLAN.md — Record the 13-UI-SPEC's extensions X-15 to X-18 in the design direction (orchestrator constraint: before any implementing task; D-34). Write `docs/contract-gaps/phase-13-request-assignment.md` in the 
- [ ] 13-02-PLAN.md — Write `docs/contract-gaps/phase-13-request-notes.md` in the format of the 06.1 and 06.8 records (D-01 item 2), carrying the note `sequence` and the read state's `lastReadSequence` (Orchestrator Confir

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 13-03-PLAN.md — Add the four approved request attributes (D-01 item 1), extract the per-request lock (13-RESEARCH §E), and serve `PUT /api/v1/assessment_requests/{requestId}/assignee` with its eligibility, G-1 and ch

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 13-04-PLAN.md — Serve the eligible-analyst read end to end (D-06), add the web's assignment Server Actions with refusal family K and a transport that keeps a 403's reason, and add the assignment projection to the req

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 13-05-PLAN.md — Create the two approved content types (D-01 item 2) and serve `GET` and `POST /api/v1/assessment_requests/{requestId}/notes` and `POST …/notes/read` with the window, the readers, the unread rule, the 

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 13-06-PLAN.md — Serve the AI-input mark end to end (D-26), add the notes summary to the request read (D-24, D-25), and add the two refusals on existing operations (D-03 item 13): the request delete with notes (D-21) 

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 13-07-PLAN.md — Seed and offer a second human Security Analyst persona for development and E2E only (D-31), with no Keycloak fixture subject, and prove the sign-in at both widths.

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 13-08-PLAN.md — Widen the generation-job reads and retries to every human analyst who may read the request, change `canRetry`'s meaning, attribute a retry to the retrying analyst, project the initiator's name, declar

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 13-09-PLAN.md — Build the X-15 assignee control on the analyst's request page: the Assignment section with its states, optimistic actions, Undo toasts, rollback and focus (D-05, D-16; UI-SPEC §5.2, §7), the picker wi

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 13-10-PLAN.md — Build the X-16 notes thread and composer on both request pages with the X-17 unread marker, optimistic posting, mark-read on view, the closed and empty states, earlier notes and the hub's `Notes` figu

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 13-11-PLAN.md — Add the X-18 AI-input switch and composer checkbox for analysts (D-26; UI-SPEC §10.1, §10.4) and the no-lost-input behaviour: session-kept composer text, the beforeunload guard and the unsent-text wel

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 13-12-PLAN.md — Extend the review queue contract and SQL with the `open` bucket, the `assignee` and `notes` filters and three item fields (D-13, D-24), and the Requests page with the `Assigned to` column, row and car

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 13-13-PLAN.md — Add the `Assigned to me` view and its navigation item and count, change the `Requests` count's meaning (D-14), and add the assignee to quick find's line 2 (D-13); change the existing navigation and qu

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 13-14-PLAN.md — Add the per-viewer counts to the dashboard summary (D-15) and recompose the analyst Home's tile 1 and Review queue widget (UI-SPEC §3), changing the existing assertions deliberately (U1, E1).

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 13-15-PLAN.md — Name the assignee in the Requestor-facing holder sentences (D-17), add the assignee name, the unread count and the notes filter to My requests and the unread total to the status summary (D-17, D-24), 

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 13-16-PLAN.md — Build Phase 12's notes extension point (D-27): load the marked notes, render each as a delimited untrusted block, bound them, and record them in a v2 context summary that the run read and its web pars

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 13-17-PLAN.md — Implement D-29's "AI inputs changed" signal in one module and serve it on the analyst's request read and in the `generation` block of the questionnaire and assessment reads; add the assignee and the n

**Wave 17** *(blocked on Wave 16 completion)*
- [ ] 13-18-PLAN.md — Render D-29's signal in Phase 12's provenance header and the hub's generation cards (UI-SPEC §10.2), the notes group of the "What the AI used" sheet (§10.3), and the assignee and notes lines under the

**Wave 18** *(blocked on Wave 17 completion)*
- [ ] 13-19-PLAN.md — Run the full gate on the production build with the static checks, have the orchestrator walk the four actors in the browser at 375 and 1440, and record the evidence and the coverage of every requireme

### Phase 14: Request attachments

**Goal:** As a Requestor or Security Analyst, I want to attach supporting files to a request at any point, so that the assessment can use the vendor pack, data flows and spreadsheets the business already has.
**Mode:** mvp
**UI hint:** yes
**Requirements:** COLLAB-02
**Depends on:** Phase 13 (notes give files their context)
**Closes:** UAT-012
**Intent:** F1, A1
**Decisions:** private storage through Strapi's upload plugin (local in development, private encrypted object storage in production), with downloads only through an authorised operation; an allow-list checked by content (PDF, DOCX, XLSX, PPTX, CSV, TXT, PNG, JPEG), 25 MB per file and 20 per request; quarantine until a pluggable malware scan passes; recorded soft removal and the assessment's retention; the analyst opts each file's extracted text into the AI context, off by default and never above the provider's classification ceiling (#2, G-3).
**Contract and datamodel:** an attachment entity or media relation: contract-gap record first, then an approval checkpoint; API for upload, list, download and delete with exact grants; likely new dependencies (scanning, text extraction), each justified.
**Size:** L

**Success Criteria:**

1. A Requestor attaches a PDF, a Word document and a spreadsheet when creating a request and adds another later; the analyst sees all four.
2. Another Requestor cannot list or download them by any URL.
3. A disallowed, oversize or infected file is refused with a clear message.
4. Each file shows who added it and when, and removal is recorded.
5. The analyst includes one file's text in the AI context and the run record shows it; excluded files never reach the provider.

**Plans:** 17 plans (one per wave, serialised by the spec, both catalogue copies, the matrix and the shared test build)

Plans:
**Wave 1**
- [ ] 14-01-PLAN.md — Record the 14-UI-SPEC's extensions X-19 to X-23 in `docs/design/csrm-design-direction.md` and the `Attachment` glossary entry in the root `CONTEXT.md` (orchestrator constraint: before any implementing

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 14-02-PLAN.md — Build the dependency-free ZIP reader and OOXML text scanner, verify and install the three justified dependencies, and build the shared XLSX reader and the worker-isolated extraction with its caps (D-3

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 14-03-PLAN.md — Build the screening pipeline Phase 14's upload and Phase 20's evidence files share: the attachment policy (types, limits, names, retention), the content check (D-09), the scanner port with its develop

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 14-04-PLAN.md — Build the storage port over the upload plugin with a CSRM private local provider and the private S3 configuration (D-06, D-07), unmount the upload plugin's content-API routes with their matrix and inv

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 14-05-PLAN.md — Add Phase 14's closed refusal reasons in one contract change to Strapi's list, both error response schemas (with `detection` for the 422) and the web's list (D-04 item 10, D-11); make the web transpor

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 14-06-PLAN.md — Create the approved content type (D-01) and serve `GET` and `POST /api/v1/assessment_requests/{requestId}/attachments` with the window, the note link, the readers, the limits under the per-request loc

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 14-07-PLAN.md — Serve `GET /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content` (the contract's first binary response) with the readers, the state refusals, the digest check and the D-23 header

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 14-08-PLAN.md — Serve `PUT /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal` with soft, recorded removal and restore and their actor rules (D-19 to D-21), add the viewer's attachment summary

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 14-09-PLAN.md — Serve `PUT …/attachments/{attachmentId}/ai_input` and `GET …/attachments/{attachmentId}/ai_text` as human-analyst-only operations with their rules, extraction on opt-in, caps and policy check (D-30, D

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 14-10-PLAN.md — Extend Phase 12's context builder with the attachment blocks inside the untrusted data block, the per-run attachment bound and the job failure that names the included files (D-33, D-34); add the run s

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 14-11-PLAN.md — Add the request's file counts and the files half of the AI-inputs-changed signal to the analyst questionnaire and assessment reads (D-27, D-36), with their contract and web parsers (D-03), and render 

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 14-12-PLAN.md — Build the web's attachment feature for adding files on a draft: the zod-free domain module, the X-23 size formatter, the upload and list Server Actions, the X-19 field, the X-20 queue, the tab's in-me

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 14-13-PLAN.md — Complete the `Files` section on both request pages: the client list with Download (Server Action, file-response check, save helper), optimistic Remove with Undo and rollback, the removed group with Re

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 14-14-PLAN.md — Add files to the new-request form and the draft's edit form (D-26, D-27; UI-SPEC §2), with create and update that stay on the page while files are queued (UI-D3), the submit dialog's wait line (UI-D5)

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 14-15-PLAN.md — Give Phase 13's composer and thread files (D-17; UI-SPEC §4): `Attach files` and chips in the composer, the note-first posting order with rollback, each note's file chips and the link back from each f

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 14-16-PLAN.md — Build the analyst's AI controls in the UI: the per-file switch with its facts line and Undo, the section-level reasons, the lazily loaded text preview sheet, the Server Actions behind them (D-30, D-31

**Wave 17** *(blocked on Wave 16 completion)*
- [ ] 14-17-PLAN.md — Run UAT-012's yardstick scenario as one Playwright journey across the four personas at both widths, record the deployment requirements, the hardening notes, the residuals and the API coverage matrix, 

### Phase 15: Steerable questionnaire AI

**Goal:** As a Security Analyst, I want to tell the AI what to add, change or remove in a questionnaire and to have it propose follow-up questions without touching answered ones, so that the question list keeps up with new information while I stay in control.
**Mode:** mvp
**UI hint:** yes
**Requirements:** QUES-11, QUES-12
**Depends on:** Phases 12 and 13
**Closes:** UAT-017, UAT-018
**Intent:** F4, A2 (Phase 9 workflow)
**Decisions:** re-runs propose additions and changes to unanswered questions only, and analyst edits change only through an accepted proposal (#4, reversing the pre-06.2 rule that regeneration is refused once any answer exists); analyst instructions are trusted but bounded, in their own slot, logged in the run record, never holding Requestor text (#5).
**Contract and datamodel:** API only, with exact grants: starting a questionnaire-wide proposal and a question rewrite (both jobs), the proposal job read and retry, the proposals read, and the questionnaire's proposal decisions, plus an optional analyst instruction on questionnaire generation and two new refusals on its replacement path. Proposals live in Phase 12's run record, so there is no content-type change. Two approved records change by dated amendments, `docs/contract-gaps/phase-12-ai-run-record-and-provenance.md` and `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`, followed by an approval checkpoint (G-6) before any code writes the new shapes.
**Size:** M

**Success Criteria:**

1. After a note about offshore support, the analyst asks for follow-up questions and receives new questions only on that topic, with the answered ones untouched.
2. "Rewrite in plain language" on a question proposes a simpler version the analyst can accept or reject.
3. Every AI proposal shows its instruction, time and initiating analyst in the revision timeline.
4. Nothing reaches the Requestor until the analyst releases.

**Plans:** 14 plans (one per wave: every Strapi test run compiles into one shared build folder)

Plans:
**Wave 1**
- [ ] 15-01-PLAN.md — Record the 15-UI-SPEC's extensions X-24 to X-26 in the design direction (orchestrator constraint: before any implementing task). Write the dated Phase 15 amendments to `docs/contract-gaps/phase-12-ai-

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 15-02-PLAN.md — Scope note (orchestrator, 2026-10-01): four tasks, one of them a small tracer, at the scope limit; most listed files are tests. They stay together because each task extends the previous one in the sam

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 15-03-PLAN.md — Apply the approved 06.8 amendment to the governance log (D-26): the `ai-proposal` and `question-restored` kinds, the closed AI source keys, the instruction on `regenerated`, the Requestor projection r

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 15-04-PLAN.md — Extend Phase 12's run record and context builder for the two operations (D-14, D-17, D-19, D-20): the run operations, per-operation envelope parsing and the append of decision events v2; the context s

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 15-05-PLAN.md — Build the two model-facing wire schemas, the one adapter with every drop rule, the deterministic providers that exercise each rule, the hosted OpenAI-compatible providers with their system instruction

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 15-06-PLAN.md — Build the generic in-process proposal job registry and the questionnaire proposals workflow (D-10, D-11, D-16, D-24, D-26, D-29): start and rewrite with their D-06 state rules, G-1, the instruction va

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 15-07-PLAN.md — Build the questionnaire decision operation's service (D-21 to D-25), the questionnaire counterpart of Phase 12 D-24: the closed batch, the leak-safe check order inside the governance lock, applying co

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 15-08-PLAN.md — Scope note (orchestrator, 2026-10-01): four tasks, one of them a small tracer, at the scope limit; most listed files are tests. They stay together because each task extends the previous one in the sam

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 15-09-PLAN.md — Serve the six operations (D-03 items 1 to 5) through routes, controller handlers and the closed specification; grant them through five new API-only Functions held by `role.security_analyst` only, in b

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 15-10-PLAN.md — Build the web's typed API layer for the six operations (closed zod parsers, a server-only service, strict Server Actions with one batch decision action), keep a 400's closed reason in the transport, w

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 15-11-PLAN.md — Scope note (orchestrator, 2026-10-01): four tasks, one of them a small tracer, at the scope limit; most listed files are tests. They stay together because each task extends the previous one in the sam

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 15-12-PLAN.md — Add the question-row parts and the provenance surfaces (UI-SPEC §4.7, §6, §7.1, §8.1, §9): the Rewrite in plain language control with its form and row states, the X-26 Answered note, the open-proposal

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 15-13-PLAN.md — Scope note (orchestrator, 2026-10-01): four tasks, one of them a small tracer, at the scope limit; most listed files are tests. They stay together because each task extends the previous one in the sam

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 15-14-PLAN.md — Write the Phase 15 journey (D-36; UI-SPEC §16 E1) on its own UAT-A-like records at 1440 and 375 with axe, covering success criteria 1 to 4 and the UI negative cases; extend the glossary if 12-19's "AI

### Phase 16: Risk curation and targeted AI re-runs

**Goal:** As a Security Analyst, I want to withdraw wrong risks and ask the AI to rewrite one risk or propose missing ones, so that the draft ends up complete and correct without rebuilding it by hand.
**Mode:** mvp
**UI hint:** yes
**Requirements:** ASSESS-09, ASSESS-10
**Depends on:** Phase 12; it also reads Phase 13's notes marked "changes the AI inputs" and reuses Phase 15's analyst instruction slot (16-CONTEXT D-27, D-28)
**Closes:** UAT-027, UAT-028
**Intent:** F7, A2 (Phase 9 workflow)
**Decisions:** no persisted risk is ever hard-deleted: an unsaved row is discarded, a persisted unreleased risk is withdrawn with a reason and kept in history, and a rejected AI proposal is recorded as rejected (#6); targeted re-runs reverse the Phase 04 decision "a linked draft never invokes the provider again".
**Contract and datamodel:** API (risk withdrawal and reinstatement in batches, with no delete operation (decision 6); AI risk proposal operations; exact grants); the withdrawal facts and an append-only risk history that later phases extend: `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md` first, then an approval checkpoint.
**Size:** M

**Success Criteria:**

1. A withdrawn risk leaves the assessment and release readiness but stays in history with its reason.
2. "Suggest more risks" on UAT-A-like input proposes the missing payment-file risk without duplicating the existing ones.
3. "Rewrite this risk" shows a field-by-field diff the analyst accepts or rejects.
4. Released risks cannot be withdrawn, deleted or re-run.

**Plans:** 15 plans (one per wave, serialised by the shared Strapi build, the spec and the catalogues)

Plans:
**Wave 1**
- [ ] 16-01-PLAN.md — Record the 16-UI-SPEC's extensions X-27 to X-29 in the design direction (orchestrator constraint: before any implementing task; D-46). Write `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 16-02-PLAN.md — Scope note (orchestrator, 2026-10-01): this plan has four tasks, at the scope limit. They stay together because each task builds on the previous one in the same files, and splitting would separate a r

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 16-03-PLAN.md — Apply the approved schema change (D-01): the three withdrawal attributes on `CsrmRisk` and the new `CsrmRiskHistoryEvent` type with its only writer and its paginated read service. Add the four new clo

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 16-04-PLAN.md — Scope note (orchestrator, 2026-10-01): this plan has four tasks, at the scope limit. They stay together because each task builds on the previous one in the same files, and splitting would separate a r

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 16-05-PLAN.md — Serve `POST /api/v1/risk_assessments/{assessmentId}/risk_withdrawals`, `POST /api/v1/risk_assessments/{assessmentId}/risk_reinstatements` and `GET /api/v1/risks/{riskId}/history` (D-03 items 1 to 3) a

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 16-06-PLAN.md — Apply the active-risk rule (D-13) to every assessment-side and Requestor reader: release readiness and the release path, the analyst detail (all risks, each with its `withdrawal` block, readiness over

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 16-07-PLAN.md — Apply the active-risk rule's SQL form (D-13) to the Risk Register list and filters, its detail (the `withdrawal` block), the dashboard summary, the alerts, the reports and the exposure figures; add th

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 16-08-PLAN.md — Build the two targeted AI operations' context, wire, adapters and providers on Phase 12's foundations (D-25), with the existing, withdrawn and decided lists (D-31), the target and its controls (D-35),

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 16-09-PLAN.md — Serve `POST /api/v1/risk_assessments/{assessmentId}/risk_suggestions`, `POST /api/v1/risks/{riskId}/rewrite`, `GET /api/v1/risk_proposal_jobs/{jobId}`, `POST /api/v1/risk_proposal_jobs/{jobId}/retry` 

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 16-10-PLAN.md — Extend Phase 12's decision operation with run-scoped targets (D-39) on Phase 15's fold (D-40): add a suggested risk (D-33), confirm a change with the stale check (D-37) and the Accept rule (D-38, G-14

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 16-11-PLAN.md — Build `apps/csrm/src/features/risk-curation/`'s schema, service, actions and zod-free domain module for withdrawal, reinstatement, Undo, history, both AI operations, jobs, the proposals read and decis

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 16-12-PLAN.md — Build the X-27 withdrawn-record pieces (`RiskCardActions`, `WithdrawRiskForm`, `useRiskWithdrawal`, `WithdrawnRiskCard`, the `risk` status family) and the X-29 `RiskHistorySheet` (D-11, D-18 to D-21, 

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 16-13-PLAN.md — Build the AI proposals section (§2), proposed-risk cards with similarity (§3), Rewrite this risk with the AI rewrite comparison (§4), batch decisions with optimistic feedback, rollback, Undo and focus

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 16-14-PLAN.md — Integrate 16-12's and 16-13's pieces into the analyst assessment editor (D-45): the page loader's proposals read, the section before Identified Risks, the `Show` filter (`?risks=withdrawn`), card acti

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 16-15-PLAN.md — Finish the interface in the Risk Register (D-08, D-45; UI-SPEC §11), then prove the phase end to end with `apps/csrm/e2e/risk-curation.spec.ts` (D-50) and run the full gate with the freeze, catalogue,

### Phase 17: Mitigation response and residual reassessment

**Goal:** As a Requestor or a nominated risk owner, I want to see the assessment once it is released for response and tell the analyst which controls we have or plan, and as a Security Analyst I want to nominate each risk's owner and have the AI reassess residual risk from the responses, so that the final assessment reflects the business's real mitigations and the people who must accept it have seen it.
**Mode:** mvp
**UI hint:** yes
**Requirements:** ASSESS-11, ASSESS-12, ASSESS-13, ASSESS-21, ASSESS-22, ASSESS-23
**Depends on:** Phases 12, 13, 16, 19 (participants export what they read) and 19.1 (the notification centre that carries its response events)
**Closes:** UAT-025, UAT-026
**Intent:** F8, F9, PD-1, PD-4 (Phase 9 workflow)
**Decisions:** one analyst-controlled "Released for response" stage, repeatable in numbered rounds, in which the Requestor and named risk owners respond with the treatment plan (#3), reversing ASSESS-05's release-only visibility and narrowing "every risk and control mutation is analyst-only" (participants submit responses, and only the analyst applies them to risks and controls); the analyst nominates each risk's owner, every risk needs one before release for response, and nobody who assesses a risk owns it (G-11); the Requestor, the nominated owners and named executive approvers read the whole assessment from its first release for response, and anyone else gets the refusal a missing record gets (G-12, reversing v1's owner-only Requestor read); first-line users find people through the hardened user search (G-17); the Requestor and the risk owners are told in the app when a response waits or arrives, through Phase 19.1's notification centre (#18, G-18, G-19). Review, peer approval and risk acceptance follow in Phase 17.1.
**Contract and datamodel:** contract-gap records first, then an approval checkpoint (G-6):
- `docs/contract-gaps/phase-17-response-rounds.md`: the response stage in the published status vocabulary, its numbered rounds, the response per risk from the Requestor or the risk's owner, and the first-release fact that opens the participant read (a dedicated fact that is never cleared, like 06.8's questionnaire release fact);
- `docs/contract-gaps/phase-17-participant-read.md`: who participates and what they read, amending `phase-04-composite-release-fact.md` ("Requestor visibility and projections");

API for participant reads, owner nomination, response submission and residual proposals, with record-level checks. The hardened `GET /api/v1/users?search=` is an API change only: the operation is already catalogued for the Requestor. A development fixture identity for a first-line risk owner who is not the Requestor, so the journey has a Requestor, a different risk owner, an analyst and an unrelated Requestor.
**Size:** L

**Success Criteria:**

1. The analyst nominates the Requestor as owner of every risk in one step, then a different first-line person for one risk; release for response is refused while any risk has no owner, and the assigned analyst cannot be named.
2. The Requestor and that risk owner see the whole of UAT-A's assessment after the analyst releases it for response, and nothing of it before; the owner finds it in "My risk assessments" marked with their part, responds only on their own risk, and, once the assessment is released, prints and exports it as the Requestor can.
3. The Requestor adds two mitigating controls to a risk, naming a control owner found by name, and submits; the analyst accepts one and rejects one with a reason. The people search needs two characters, returns no email and no service identity, and logs each search.
4. "Reassess residual risk" proposes new residual values citing the accepted controls, and the analyst accepts them per field.
5. An unrelated Requestor gets the refusal a missing record gets for the assessment, its risks, control implementations and responses, at every stage, in the API and the UI; each participant is told in the app when the response waits or arrives.
6. Playwright, first slice of the post-demo journey: a Requestor raises a request; the analyst assesses it, nominates a different first-line risk owner for two of its risks (the two that owner later accepts and treats in Phase 17.1's slice) and releases it for response; the Requestor and that owner view it and respond; an unrelated Requestor is refused at each step, in the UI and the API.

**Plans:** 19 plans (wave 1 pairs the contract records with the development persona; then one per wave, serialised by the spec, the catalogues, the matrix and Playwright)

Plans:
**Wave 1**
- [ ] 17-01-PLAN.md — Record the 17-UI-SPEC's extensions X-36 to X-41 in the design direction (orchestrator constraint, D-71) and add the "Response round" and "Participant" glossary entries (D-73), both before any implemen
- [ ] 17-02-PLAN.md — Scope note (orchestrator, 2026-10-01): 16 files, because the risk-owner persona and the unrelated Requestor touch the development seed, the fixture subjects (ADR 0004), the realm import, the sign-in f

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 17-03-PLAN.md — Create the approved schema (D-01): the three new types and the private gate pair (D-11), proven on a fresh boot with legacy assessments unchanged (D-05, D-23). Build the pure participation module (D-0

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 17-04-PLAN.md — Harden `GET /api/v1/users?search=` in place (D-52): two to 100 characters, no other parameter, at most 20 eligible people through Phase 19.1's `isEligiblePerson` with a set-level form (D-16), two fiel

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 17-05-PLAN.md — Serve owner nomination (D-17): the batch operation and the risk update's `riskOwner`, with one validation (D-16, D-20): eligible people only through Phase 19.1's `isEligiblePerson`, never the request'

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 17-06-PLAN.md — Add G-11's owner rule to Phase 16's one editable guard (D-18, D-45), keep `isAssessmentEditable` record-level, extend Phase 13's assignment rules (assignee eligibility excludes named owners; assignmen

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 17-07-PLAN.md — Widen the existing Requestor branches of the detail, risks and control-implementation reads to the participant predicate (D-22, D-23, D-27), with the participant projection and the `beingPrepared` mas

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 17-08-PLAN.md — Move "My risk assessments" and its rating summary from the owner filter onto a repository over the participant SQL predicate (D-28), with the stage, parts, round and awaited flag per item and closed f

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 17-09-PLAN.md — Serve "Release for response" and "Close round {n}" (D-09, D-12, D-13) to the assigned analyst only, with release-for-response readiness (D-10), the gate pair on the first round (D-11), one requested r

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 17-10-PLAN.md — Add the response step to the published lifecycle with the `skipped` state (D-07; X-41), the `participants` holder (D-08) in the pure rule, the My requests SQL and `byHolder`, the next-action sentences

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 17-11-PLAN.md — Serve the participant's own response (D-31 to D-35, D-37): read, save and submit, with the draft envelope parser and completeness rules as a pure module, the participation rule per item (D-32), items 

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 17-12-PLAN.md — Add D-57's two kinds to Phase 19.1's registry (`response-requested`, `response-submitted`) and the part `risk-owner`, with their facts, sentences and destinations (17-UI-SPEC §12), readability through

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 17-13-PLAN.md — Serve the response decisions batch (D-38): accept a proposed control into a library control through the existing control-implementation creation path, accept a proposed owner under the nomination rule

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 17-14-PLAN.md — Serve "Reassess residual risk" (D-46) as a new operation on Phase 16's risk proposal job family and Phase 15's registry (D-47), with a run per provider call, the AI data policy at enqueue and executio

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 17-15-PLAN.md — Build the analyst's side of the response stage in the editor (D-69): the Participants section and the nomination sheet with the X-40 person picker (D-17, D-55), release-for-response readiness and its 

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 17-16-PLAN.md — Build the analyst's decisions and the reassessment in the editor: the Responses section under each risk (D-36; X-38), the add form, reject row and group reject with Undo and rollback (D-38, D-39; UI-D

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 17-17-PLAN.md — Make the participant page stage-aware (D-25, D-27, D-69; 17-UI-SPEC §6), add the participant form of the round panel and the response form with autosave, the phone sheet and submission (D-31 to D-35; 

**Wave 17** *(blocked on Wave 16 completion)*
- [ ] 17-18-PLAN.md — Build the list and landing surfaces of the participant read (D-28): "My risk assessments" with stage, part, filters and empty states (17-UI-SPEC §14.1), the sidebar count of awaited responses (§14.2; 

**Wave 18** *(blocked on Wave 17 completion)*
- [ ] 17-19-PLAN.md — Create `apps/csrm/e2e/risk-owner-journey.spec.ts` with its first slice (D-76; SC6; orchestrator constraint), its negative-case and Strapi API helpers, and the mobile project entry; write `response-sta

### Phase 17.1: Review, peer approval and risk acceptance (INSERTED)

**Goal:** As a risk owner, I want to decide each of my risks, accepting it or approving its treatment, within my authority once the analyst submits the final assessment, and as a Security Analyst I want an explicit review, a colleague's approval for the most serious outcomes, and one confirmed step that releases the assessment and closes the request, so that every closed request carries accountable acceptance and independent review.
**Mode:** mvp
**UI hint:** yes
**Requirements:** ASSESS-14, ASSESS-20, ASSESS-24, ASSESS-25
**Depends on:** Phase 17
**Closes:** UAT-040
**Intent:** F8, F10, PD-2, PD-4 (ISO/IEC 27001:2022 clause 6.1.3 f)
**Decisions:** an explicit "Mark reviewed" by the assigned analyst, withdrawn by any later edit; a second Security Analyst approves before submission when any residual risk is Critical, a threshold the Admin can change from Phase 22 (#17, G-13); "Submit final assessment" opens numbered acceptance rounds that lock analyst editing, the assigned analyst can recall a round, and once every risk has a valid decision the assigned analyst releases and closes in one confirmed step, the request reading "Closed" (G-13, reversing v1's release transition to request `approved`); each risk takes an explicit Accept or Treat decision from its named owner, with authority by residual rating for both choices: High adds the named executive approver, only the executive approver decides Critical risk, as a time-limited exception, and a disagreement is a contest point rather than a decline (#8, G-14, reversing G-2's decline); decisions carry a fingerprint and survive a round only while their risk is unchanged (G-15); the treatment owner is found by name (G-17); nobody reviews, approves or releases the assessment of a request they raised (G-1), and nobody who assesses a risk decides it (G-11); participants are told in the app at each step (G-18). Inserted 2026-09-27 (`NEXT-WAVE-DECISIONS.md`), taking ASSESS-14 and UAT-040 from Phase 17; amended 2026-10-01 by the post-demo decisions.
**Contract and datamodel:** contract-gap records first, then an approval checkpoint (G-6):
- `docs/contract-gaps/phase-17.1-review-and-peer-approval.md`: explicit review facts (reviewer, time, withdrawal by an edit) and peer-approval facts, replacing the save-driven `reviewedBy` of 06.8 D-13;
- `docs/contract-gaps/phase-17.1-acceptance-rounds-and-decisions.md`: acceptance rounds (number; opened, recalled or completed, by whom, when and why), the per-risk decision record (decider, authority, choice, rationale, review date, fingerprint, revision and void), and the named executive approver of each High or Critical risk;
- `docs/contract-gaps/phase-17.1-release-and-close.md`: the release transition to request `closed` and the released predicate over `approved` or `closed`, amending `phase-04-composite-release-fact.md` ("Transitions and irreversibility").

API for mark reviewed, peer approval, executive approver nomination, submit, recall, decide and revise, and release and close, with exact grants and record-level checks: decisions are open only to the named risk owner or executive approver, through the Requestor birthright; submit, recall, and release and close only to the assigned human Security Analyst (`HUMAN_ANALYST_ONLY_OPERATIONS`); every analyst editing route refuses while a round is open. Release readiness gains the review, approval and decision conditions.
**Size:** L (was M: submission rounds, recall, decisions for both choices, and release and close join review and acceptance; the contest loop moves to Phase 17.2 to keep this phase within L)

**Success Criteria:**

1. The analyst marks the assessment reviewed; a later edit shows as "changed since review", withdraws the review and withholds "Submit final assessment" until the analyst marks it again.
2. With a Critical residual risk, submission waits for a second Security Analyst's approval, which neither the assignee, the Requestor nor a risk owner of that assessment can give.
3. After "Submit final assessment", Strapi refuses the analyst's edits while round 1 is open; a recall with a reason reopens editing, and in round 2 an unchanged risk's decision stands while a changed risk's decision is voided and its owner is asked again.
4. The owner of a Moderate risk accepts it with a rationale from their Home, and treats a Low risk with a plan, a treatment owner found by name and a due date; Accept is not offered for a risk with a planned control; a High risk also needs the named executive approver; only the executive approver decides a Critical risk, as a time-limited exception.
5. Release is refused until every risk has a valid decision under the authority it needs; the assigned analyst then releases and closes in one confirmed step, the request reads "Closed" everywhere, and the released assessment shows who decided each risk, under what authority, and its review date; the Requestor and the risk owner still read the released assessment of the closed request, and a request released before this flow still reads as released.
6. The assigned analyst, another analyst and the service identity cannot decide a risk: the API refuses, and the UI shows them no decision control. Only the assigned analyst can submit, recall, and release and close. An unrelated Requestor gets the refusal a missing record gets at every route, in the API and the UI.
7. Playwright, second slice: continuing Phase 17's journey, the analyst submits the final assessment; the different risk owner accepts one of their risks and treats the other with a plan, a treatment owner and a due date, and every other risk is decided by its owner; the analyst releases and closes, and the request reads "Closed"; the analyst cannot accept, and an unrelated Requestor is refused at each step, in the UI and the API.

**Plans:** 18 plans (wave 1 pairs the contract records with the pure modules; then one per wave, serialised by the contract files, the Strapi build and Playwright)

Plans:
**Wave 1**
- [ ] 17.1-01-PLAN.md — Record the 17.1-UI-SPEC's extensions X-42 to X-47 in the design direction (orchestrator constraint; D-64) and the glossary entries Acceptance round, Recall, Mark reviewed and Peer approval (D-66), bot
- [ ] 17.1-02-PLAN.md — Scope note (orchestrator, 2026-10-02): 16 files, because one behaviour's contract chain or its interface and their tests change together. The pilot's pacing rule (planner-context) accepts this. Build 

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 17.1-03-PLAN.md — After the pilot's approval, apply the schema changes of the three records (D-01) and prove them on a fresh boot with legacy rows unchanged; give the harness the `executive-approver` identity and the r

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 17.1-04-PLAN.md — Replace the accepted-edit transition in place (06.8 D-13, reversed per D-04 and D-06): no reviewer stamp, no regression, and the review's withdrawal by the first content edit with its edit descriptor 

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 17.1-05-PLAN.md — Scope note (orchestrator, 2026-10-02): 16 files, because one behaviour's contract chain or its interface and their tests change together. The pilot's pacing rule (planner-context) accepts this. Serve 

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 17.1-06-PLAN.md — Scope note (orchestrator, 2026-10-02): 16 files, because one behaviour's contract chain or its interface and their tests change together. The pilot's pacing rule (planner-context) accepts this. Serve 

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 17.1-07-PLAN.md — Serve "Submit final assessment" (D-19 to D-22, D-38, D-54) and "Recall round {n}" (D-25) to the assigned analyst only, and the acceptance read for analysts and participants (D-22, D-47 as amended). Pu

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 17.1-08-PLAN.md — Serve the decision operation (D-03 item 5) to the named people only (D-31), with Accept and Treat (D-27, D-28), the High and Critical sequences (D-29, D-30), immutable rows with fingerprints and snaps

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 17.1-09-PLAN.md — Extend the analyst assessment detail (D-48) and the participant projection (D-47 as amended) with the review, peer, round, decision and readiness facts, through one projector shared with the acceptanc

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 17.1-10-PLAN.md — Turn the existing release operation into release and close in place (D-42, D-46): its readiness (D-41), the compare-and-set body `{ roundNumber, lastDecisionId }` (Orchestrator Confirmation), the one 

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 17.1-11-PLAN.md — Extend the published lifecycle with the review, acceptance and closed steps, the next actions and the holder (D-49); move the review queue and My requests' holder in the SQL and the oracle together (D

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 17.1-12-PLAN.md — Widen Phase 19's one released predicate to `closed` in both forms and prove it on every released route (D-45). Show the decisions in the released record, the A4 report, the export's Risks sheet and th

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 17.1-13-PLAN.md — Scope note (orchestrator, 2026-10-02): 16 files, because one behaviour's contract chain or its interface and their tests change together. The pilot's pacing rule (planner-context) accepts this. Build 

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 17.1-14-PLAN.md — Build the analyst's acceptance surfaces (D-62, D-63; 17.1-UI-SPEC §2.6, §4, §5, §9 analyst overview): the typed web layer for executive approver naming, recall and the acceptance read; the Participant

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 17.1-15-PLAN.md — Build the decider's surfaces on the participant page and the analyst-participant panel (D-26 to D-38, D-47, D-62, D-63; 17.1-UI-SPEC §6, §7, §5.4): the decision area (X-44) with the authority line, th

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 17.1-16-PLAN.md — Scope note (orchestrator, 2026-10-02): 16 files, because one behaviour's contract chain or its interface and their tests change together. The pilot's pacing rule (planner-context) accepts this. Build 

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 17.1-17-PLAN.md — Add the executive approver persona (D-61) in 17-02's shape: the development seed, the fixed Keycloak fixture subject and the matching realm user changed together, the README rows, and the web's develo

**Wave 17** *(blocked on Wave 16 completion)*
- [ ] 17.1-18-PLAN.md — Extend `apps/csrm/e2e/risk-owner-journey.spec.ts` with its second slice (orchestrator constraint; D-69; SC7) and its negatives; move every spec that released through v1 onto the acceptance flow throug

### Phase 17.2: Contest points and rework rounds (INSERTED)

**Goal:** As a risk owner, I want to contest anything in an assessment I am asked to accept and see each point answered, and as a Security Analyst I want to rework the whole assessment and resubmit it, so that acceptance rests on content both lines have challenged and agreed.
**Mode:** mvp
**UI hint:** yes
**Requirements:** COLLAB-04, ASSESS-26, NOTIFY-04
**Depends on:** Phase 17.1
**Closes:** no UAT finding (post-demo ask PD-3)
**Intent:** PD-3, F10
**Decisions:** contest points are their own recorded concept, raised by any participant on any content they can read, each with a reason, a reply thread and a status; a risk owner or executive approver sends the assessment back, which reopens all of it; the analyst answers every point before resubmitting; decisions survive only for unchanged risks, and their deciders see what changed (G-15, reversing G-2's per-risk decline); the raiser, the analyst and the other participants are told in the app (G-18). Inserted 2026-10-01 (`NEXT-WAVE-DECISIONS.md`, G-15), because the contest-and-rework loop would push Phase 17.1 past size L.
**Contract and datamodel:** `docs/contract-gaps/phase-17.2-contest-points.md` first, then an approval checkpoint (G-6): the contest point (target, reason, status, raiser), its replies and answer, and the acceptance round's "returned" fact. API to raise, reply to, answer, resolve and withdraw points and to send an assessment back, with exact grants and record-level checks: the assessment's participants raise and reply, the raiser resolves or withdraws, a Security Analyst answers, and a risk owner or executive approver sends back.
**Size:** M

**Success Criteria:**

1. In an open round the risk owner raises two contest points, one on a risk's treatment plan and one on the overall rating, each with a reason, and sends the assessment back; round 1 closes as "returned".
2. The analyst edits the risk and answers that point "changed", answers the other "kept" with a reason, and cannot resubmit while either is unanswered or before marking the assessment reviewed again; release is refused while any point is open.
3. In round 2 the owner sees which decisions stand and, for the changed risk, each changed field before and after, and decides it again.
4. The history shows both rounds, both points with their replies and answers, and the void, with who and when; the analyst and the owner are told in the app at each step.
5. The Requestor who owns no risk can raise a point but not send back; the analyst cannot send back or resolve a participant's point; an unrelated Requestor gets the refusal a missing record gets for the points and the history, in the API and the UI.
6. Playwright, third slice: Phase 17.1's journey with the contest inserted after "Submit final assessment": the owner contests two points and sends the assessment back, the analyst edits and resubmits, then the owner accepts one risk and treats another and the analyst releases and closes; the analyst cannot accept, and an unrelated Requestor is refused at each step, in the UI and the API.

**Plans:** 15 plans (wave 1 pairs the contract record with the pure modules; then one per wave)

Plans:
**Wave 1**
- [ ] 17.2-01-PLAN.md — Record the 17.2-UI-SPEC's extensions X-48 to X-52 in the design direction (orchestrator constraint; D-25) and the glossary entries "Send back" and "Withdrawn (contest point)" (D-25), both before any i
- [ ] 17.2-02-PLAN.md — Build the pure modules D-28 puts beside the record, each RED-first (the `tdd` skill; D-26: each behaviour gets a failing test first at its seam): the target vocabulary and the snapshot cutter (D-04), 

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 17.2-03-PLAN.md — After the pilot's approval, apply the schema changes of `phase-17.2-contest-points.md` (D-01) and prove them on a fresh boot with legacy rows unchanged, no core route (D-20) and the control-implementa

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 17.2-04-PLAN.md — Serve the eight point operations (D-02 items 1 to 5): raise (D-04, D-06), list and read one with its thread and comparison (D-05, D-14, D-16), reply (D-07), answer (D-08), resolve, withdraw and undo (

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 17.2-05-PLAN.md — Serve "Send back" (D-02 item 6, D-11) to current risk owners and executive approvers with an open contest point of their own, closing the acceptance round as `returned` and reopening the whole assessm

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 17.2-06-PLAN.md — Add the one "no open point" predicate to 17.1's two readiness projections (D-12) so it gates mark reviewed, submission, and release and close (orchestrator constraint), re-checked inside release and c

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 17.2-07-PLAN.md — Extend the reads that change shape (D-02 item 8, D-16): the participant projection (per-target counts, the latest round's outcome facts, the viewer's contest acts) and the analyst detail (per-target o

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 17.2-08-PLAN.md — Serve the history read (D-02 item 7, D-15): `GET /api/v1/risk_assessments/{assessmentId}/history` with its closed event vocabulary, round windows (17.2-02), per-actor projection (participants without 

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 17.2-09-PLAN.md — Add the four contest notification kinds to Phase 19.1's registry and emit them through its service in each act's own transaction (D-17; orchestrator constraint: the notification kinds go through 19.1'

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 17.2-10-PLAN.md — Build the web's typed layer for the ten operations (D-02; D-28 step 7): closed parsers, server-only services, Server Actions with revalidation and a closed result, the history read's parser and servic

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 17.2-11-PLAN.md — Build the reading and discussion surfaces (D-23, D-24; 17.2-UI-SPEC §4, §5.1 to §5.3, §5.6): the "Contest points" section on both assessment pages, the point sheet with its comparison (X-50 through Ph

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 17.2-12-PLAN.md — Build every act on a point in the UI: the raise form with its target picker and every entry point (D-04, D-06; 17.2-UI-SPEC §3; amendment 1's "Close and keep draft"), including 17.1's decision-view se

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 17.2-13-PLAN.md — Build the send-back confirmation and the returned round's surfaces (D-11, D-13; X-51; 17.2-UI-SPEC §6), the contest items in "Review and submit" and release readiness (D-12; §7), and round n+1's "stan

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 17.2-14-PLAN.md — Build the history route per actor (D-15, D-23; X-52; 17.2-UI-SPEC §9 and orchestrator amendment 4) on the typed read from 17.2-10, linked from both assessment pages, and the list and Home figures for 

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 17.2-15-PLAN.md — Insert the contest slice into `apps/csrm/e2e/risk-owner-journey.spec.ts` after `submitFinalAssessment` (orchestrator constraint; D-27; SC6): two points raised, sent back, the analyst edits and answers

### Phase 18: Risk table and spreadsheet interoperability

**Goal:** As a Security Analyst, I want an assessment's risks in a table I can edit, copy and paste like Excel or a SharePoint list, so that reviewing and updating many risks takes minutes rather than a long scroll.
**Mode:** mvp
**UI hint:** yes
**Requirements:** ASSESS-15, ASSESS-16, ASSESS-17, ASSESS-18, ASSESS-19
**Depends on:** Phases 12, 16, 17.1 (bulk edits honour the acceptance-round lock and void changed decisions, ASSESS-24), 17.2 (its detail sheet carries every per-risk surface up to the contest points) and 19
**Closes:** UAT-008, UAT-039, UAT-050, UAT-055, UAT-056, UAT-057, UAT-063
**Intent:** Q4, Q3, F7
**Decisions:** the grid follows a research spike with pass-or-fail criteria (ARIA grid conformance at WCAG 2.2 AA, a permissive licence only, the route JavaScript budget, semantic tokens), leaning to the DataTable on TanStack Table (#7); the 5 × 5 scales with the product-banded rating and an override with a reason (#8); saved views personal by default and shareable with analysts; no persisted risk is hard-deleted from the table (#6).
**Contract and datamodel:** API (bulk update and create with exact grants, and bulk withdrawal through Phase 16's batch withdrawal operation; closed vocabularies for likelihood and consequence on the existing string fields); the risk change history is Phase 16's append-only risk history, extended by a record that amends `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md` rather than a second history; server-side saved views: contract-gap records first, then an approval checkpoint (`docs/contract-gaps/phase-18-risk-scales-and-rating-override.md` with the two override-reason fields on `CsrmRisk`, `docs/contract-gaps/phase-18-saved-views.md` for `CsrmSavedView`, and `docs/contract-gaps/phase-18-bulk-risk-changes-and-import.md` with no schema change); possibly a grid dependency, justified by the spike. The review lists adopt this phase's column chooser (deferred here from Phase 11, D-33).
**Size:** L

**Success Criteria:**

1. Setting treatment owner, target date and status on ten risks takes under a minute with the keyboard, saved in one batch.
2. A range copied from the table pastes into Excel as rows and columns, and a 3 × 4 Excel range pastes into the table with a preview that converts "High" and dd/mm/yyyy.
3. A paste with one invalid cell applies nothing until the analyst chooses, and two analysts editing the same risk see a conflict, not a silent overwrite.
4. Released and Requestor views are read-only but copyable, and rows import from and export to CSV and XLSX.
5. 150 risks scroll and edit without visible lag at 1440px, and phones show a card list.

**Plans:** 19 plans (waves 1 and 2 pair independent work; then one per wave, serialised by the contract files, the Strapi build and Playwright)

Plans:
**Wave 1**
- [ ] 18-01-PLAN.md — Record the 18-UI-SPEC's extensions X-53 to X-61 in the design direction before any implementing task (orchestrator constraint, D-28), with the UI-SPEC's orchestrator amendments 1 and 3 applied, and th
- [ ] 18-02-PLAN.md — Build, RED first, the pure modules D-30 places beside the records: the scale reading and the rating write rules in Phase 12's `risk-scale.ts` (D-20, D-21, D-22), per-cell compare-and-set and the bulk 

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 18-03-PLAN.md — Build the risk table's grid on the installed TanStack Table 9.2.4 as the DataTable's grid mode (D-04's lean, research Answer 1), with the APG keymap (D-17), the unsaved change set with undo and redo h
- [ ] 18-04-PLAN.md — Scope note (orchestrator, 2026-10-01): 16 to 17 files, because the contract chain (the specification, both catalogue copies, served operations, the matrix) or the grid's editors and their tests change

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 18-05-PLAN.md — Put the grid of 18-03 on the real Risks route (D-06) with the X-58 local navigation and the server's mode (18-04), and run decision 7's measured spike (D-04): axe and a scripted APG walk in both modes

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 18-06-PLAN.md — Scope note (orchestrator, 2026-10-01): 16 to 17 files, because the contract chain (the specification, both catalogue copies, served operations, the matrix) or the grid's editors and their tests change

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 18-07-PLAN.md — Scope note (orchestrator, 2026-10-01): 16 to 17 files, because the contract chain (the specification, both catalogue copies, served operations, the matrix) or the grid's editors and their tests change

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 18-08-PLAN.md — Build the risk import (D-23) and the current-view export (D-24) as Strapi services on Phase 19's reader, header matching, converters, writers, export pipeline and event log, and Phase 14's reader exte

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 18-09-PLAN.md — Serve 18-08's import and export through the endpoint chain (D-02): five operations, two Functions in both catalogue copies, `HUMAN_ANALYST_ONLY_OPERATIONS`, the export in `SERVICE_IDENTITY_REFUSED_OPE

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 18-10-PLAN.md — Serve `CsrmSavedView` (18-04's type) through four operations (D-09) with ownership, sharing, uniqueness and bounds, a strict write parser and a fail-safe read (18-02), and the one sharing decision Pha

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 18-11-PLAN.md — Scope note (orchestrator, 2026-10-01): 16 to 17 files, because the contract chain (the specification, both catalogue copies, served operations, the matrix) or the grid's editors and their tests change

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 18-12-PLAN.md — Scope note (orchestrator, 2026-10-01): four executable tasks at the scope limit; each extends the previous one in the same clipboard module, and the pilot's pacing rule (planner-context) accepts this.

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 18-13-PLAN.md — Build copy (D-18) with Phase 19's neutraliser (Orchestrator Confirmation) and paste (D-19) with mapping, the web mirror of the converters (parity over 18-02's fixture), the X-55 preview with its apply

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 18-14-PLAN.md — Mirror 18-02's filter-and-sort module in the web with a parity test (D-08), build the toolbar's search, `Show`, column menus, filter popovers and chips, sort and the address (D-08), the grid's column 

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 18-15-PLAN.md — Scope note (orchestrator, 2026-10-01): 16 to 17 files, because the contract chain (the specification, both catalogue copies, served operations, the matrix) or the grid's editors and their tests change

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 18-16-PLAN.md — Move every existing spec that drives a per-risk card to the Risks route and the detail sheet (D-06, D-29), through one shared helper, while the Overview still shows its cards, so 18-17 can remove them

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 18-17-PLAN.md — Scope note (orchestrator, 2026-10-01): 16 to 17 files, because the contract chain (the specification, both catalogue copies, served operations, the matrix) or the grid's editors and their tests change

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 18-18-PLAN.md — Present the read-only modes from the server's mode (D-05) with their banners; give every participant the read-only, copyable grid of their projection above Phase 17's cards (D-05, D-06, D-07, UI-D17);

**Wave 17** *(blocked on Wave 16 completion)*
- [ ] 18-19-PLAN.md — Build the risk import route on Phase 19's five steps (D-23) and the table's Export through 19-06's dialog with the current view (D-24), the keyboard shortcuts dialog (D-17), SC4's CSV and XLSX round t

### Phase 19: CSV export and import hardening

**Goal:** As a Security Analyst or risk manager, I want to export any list I can see and to import spreadsheets without fighting the format, so that CSRM fits the Excel work around it.
**Mode:** mvp
**UI hint:** yes
**Requirements:** CSV-01, CSV-02, CSV-03
**Depends on:** Phase 11 (list columns and filters)
**Closes:** UAT-049, UAT-051, UAT-052
**Intent:** Q3
**Decisions:** CSV and XLSX in the viewer's authorised scope, with Requestors exporting their own released assessments; formula-like values neutralised; every export logged with actor, view, filters and row count; a print-ready A4 report of the released assessment (#12).
**Contract and datamodel:** API (export operations reusing each list's filters and authorised scope; parser tolerance); a likely XLSX dependency, justified; no content-type change. The two contract changes are documented first, followed by an approval checkpoint (G-6): `docs/contract-gaps/phase-19-exports-and-export-log.md` (the export operations and grants, the row cap, formats and neutralisation, and the export log in Strapi's server log) and `docs/contract-gaps/phase-19-import-tolerance.md` (amending `phase-06-administration-import-contract.md`).
**Size:** L (was M: about 22 export and import operations, each following one pattern)

**Success Criteria:**

1. The filtered Risk Register exports to XLSX with the visible columns, and a value starting with "=" arrives as text.
2. A Requestor can export only their own released assessment.
3. A file with "Name" headers and an extra column imports with a warning, and a Windows-1252 file gets a fix-it message.
4. The error report reopens in Excel, can be corrected and re-imports.
5. A lower-case duplicate of an existing name is held for a decision.
6. A released assessment prints as a clean A4 report.

**Plans:** 15 plans (one per wave, serialised by the spec, both catalogue copies, the matrix and the Strapi test build)

Plans:
**Wave 1**
- [ ] 19-01-PLAN.md — Record the 19-UI-SPEC's extensions X-30 to X-32 in the design direction (orchestrator constraint: after Phase 16's X-27 to X-29 and before any implementing task). Write `docs/contract-gaps/phase-19-ex

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 19-02-PLAN.md — Add the 19 approved closed reasons to Strapi's `CONFLICT_REASONS`, both specification enums and the web mirror (D-03 group 4); add the closed details `rowCount`, `rowCap` and `found` to `AssessmentWor

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 19-03-PLAN.md — Add `write-excel-file@4.1.1` to Strapi only, justified (D-12); move the neutraliser into `csrm/spreadsheets/neutralise.ts` with its exact inverse (D-11); build the CSV and XLSX writers (D-08); extend 

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 19-04-PLAN.md — Build the export pipeline in Strapi (D-05, D-17), the view registry with the Risk register as its first view (D-05, D-36), the vocabulary of columns, fixed tables, import columns and labels with its p

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 19-05-PLAN.md — Serve the reserved `GET /api/v1/risks/export` (D-03 group 1): extend the authorisation policy with the generic `SERVICE_IDENTITY_REFUSED_OPERATIONS` set and the `underlyingRead` rule (D-13), add the r

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 19-06-PLAN.md — Scope note (orchestrator, 2026-10-01): 17 files, because each served export carries the D-02 chain together: the specification, both catalogue copies, served operations, the authorisation matrix, the 

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 19-07-PLAN.md — Scope note (orchestrator, 2026-10-01): 17 files, because each served export carries the D-02 chain together: the specification, both catalogue copies, served operations, the authorisation matrix, the 

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 19-08-PLAN.md — Serve the Questionnaires, My questionnaires and Alerts exports (D-03 group 1, D-04) over the 19-04 pipeline: export variants of each list's own query builder or parser, three views, routes beside thei

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 19-09-PLAN.md — Serve the reserved `POST /api/v1/reports/{reportKey}/export` (D-03 group 1, D-22): a closed body parsed with the report's own parser, the report computed as its read computes it, the figures shaped as

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 19-10-PLAN.md — Gather the released-assessment read into one module (D-14) and switch the three released reads and the My risk assessments list to it with no behaviour change; serve the released-assessment export for

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 19-11-PLAN.md — Add one typed export function per operation to its feature service (D-19), one Server Action per view in `features/exports/export-actions.ts`, and the `ExportButton` in the page header of every list s

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 19-12-PLAN.md — Factor the released page's loader into one shared module and add the two report routes on it (D-23); render the report document and its print rules as X-31 (D-24); put `Print report` and `Export` in b

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 19-13-PLAN.md — Move the four Administration imports onto the 19-03 reader, header matcher and value converters (D-25 to D-29), add the `similar` tier and its commit decisions (D-30), keep issue codes in the preview 

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 19-14-PLAN.md — Serve the template and error-report operations for the four collections (D-03 group 3, D-31, D-32) and the four reference-list exports (D-04, D-33); grant them through the four Administration Function

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 19-15-PLAN.md — Rework the web import flow onto Strapi's tolerant import (D-25 to D-32): retire the client parser, show file refusals with fix-it steps, warnings and notes, the similar-row decisions (X-32), template 

### Phase 19.1: In-app notification centre (INSERTED)

**Goal:** As a Requestor, a risk owner or a Security Analyst, I want to be told in the app when work waits for me and to open it in one step, so that nothing waits unseen between the people in the flow.
**Mode:** mvp
**UI hint:** yes
**Requirements:** NOTIFY-01
**Depends on:** Phases 11 (the header and Home), 13 (assignment and notes, two of its events) and 19 (its check that refuses service identities); it runs after Phase 19 and before Phase 17
**Closes:** no UAT finding of its own (NOTIFY-01 traces to UAT-025, which Phase 17 closes)
**Intent:** F8, A1, PD-1 (decision 18, G-18)
**Decisions:** one notification per recipient per event, written in the same transaction as its event through one notification service, and never for the person who acted, a service identity or an inactive user; nobody is told about a record they may not read, checked whenever the list and the count are read; the server words each notification and gives its destination at read time, storing no titles; per-person read state, cleared by opening, "Mark as read", "Mark all as read" or acting on the work; a header control with the unread count, a panel and a Notifications page, with no polling; channel-neutral, so Phase 20 adds email delivery without changing the entity; never deleted, following the request's retention (decision 18, G-18; the decisions Phase 17's discussion recorded as its D-56 to D-63). Its first kinds are the events that exist before Phase 17: assignment (Phase 13), questionnaire released and submitted, assessment released, and new notes (Phase 13). Phases 17, 17.1, 17.2 and 20 add theirs without a schema change. Inserted 2026-10-01 (`NEXT-WAVE-DECISIONS.md`, G-19), because the notification centre pushed Phase 17 beyond size L.
**Contract and datamodel:** `docs/contract-gaps/phase-19.1-notifications.md` first (the notification, its per-person read state, and the closed kind vocabulary later phases extend), then an approval checkpoint (G-6); API for the list, the unread count, mark read and mark all read, with exact grants for every human user and record-level checks at read time.
**Size:** M

**Success Criteria:**

1. When an analyst assigns a request to a colleague, the colleague sees the unread count rise in the header and opens the request from the notification in one step; the analyst who acted is not notified.
2. The Requestor is told when the questionnaire and the assessment are released, the assigned analyst when the answers are submitted, and each side of a request when the other posts a note; each notification names its record by number and title.
3. Opening a notification, "Mark as read", "Mark all as read" and acting on the work clear it; the count stays exact without polling, and a failed count read shows no badge.
4. A notification whose record its recipient can no longer read leaves the list and the count; an unrelated Requestor never sees another person's notification or learns of its record, in the API and the UI, and the service identity receives none.
5. The centre is a sheet at 375px and a panel from 768px, and works by keyboard alone.

**Plans:** 10 plans (one per wave, a linear chain)

Plans:
**Wave 1**
- [ ] 19.1-01-PLAN.md — Record the 19.1-UI-SPEC's extensions X-33 to X-35 in the design direction (orchestrator constraint, D-30) and add the "Notification" glossary entry (D-31), both before any implementing task. Write `do

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 19.1-02-PLAN.md — Create the approved `CsrmNotification` content type (D-01) and the pure modules D-41 places beside it: the kind registry (D-08, D-11, D-12), the facts envelope (D-09), the read-time projection (D-16, 

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 19.1-03-PLAN.md — Build the notification service (`notify`, D-05 to D-08) and the repository whose one SQL readability predicate feeds the list, the total, the unread count and "Mark all as read" (D-13 to D-15), with e

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 19.1-04-PLAN.md — Serve the three operations (D-03) through standalone routes with the caller as the only scope and the service identity refused (D-35, D-36), publish them in the specification, both catalogue copies an

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 19.1-05-PLAN.md — Hook the two Phase 13 events (D-11): `request-assigned` in `changeRequestAssignee` with the reversal read of the former assignee's analyst-part notifications (D-21, Orchestrator Confirmation), and `no

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 19.1-06-PLAN.md — Hook the three workflow events (D-11): `questionnaire-released` in `releaseQuestionnaire`, `questionnaire-submitted` in `submitQuestionnaire` with the Requestor's acting read (D-20), and `assessment-r

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 19.1-07-PLAN.md — Add the `notification:read` capability (D-37), start the unread summary in the layout without awaiting it (D-25), and render the header control with its count capsule and accessible name in its place 

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 19.1-08-PLAN.md — Build the panel (D-26, X-35) and the item (X-34) the header control opens, the one-step opening through Phase 10's guard (D-19), the client count store with optimistic changes reconciled by `asOf` (D-

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 19.1-09-PLAN.md — Add Mark all as read with its Undo toast to the panel through one shared hook the page reuses (D-19, D-29), the two remaining Server Actions, and the count's two event-driven refresh points: once afte

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 19.1-10-PLAN.md — Build the Notifications page (D-27) with its views, pagination, per-item marks, Mark all as read with Undo and its states, then complete `notification-centre.spec.ts` with success criteria 1 to 5 and 

### Phase 20: Oversight registers and post-release tracking

**Goal:** As a risk manager, I want registers by assessment type that stay current after release, and as a risk or treatment owner I want to track each treatment to completion on evidence, so that oversight reflects what is actually being done.
**Mode:** mvp
**UI hint:** yes
**Requirements:** RISK-03, RISK-04, RISK-05, RISK-06, ADMIN-06, NOTIFY-02
**Depends on:** Phases 11, 14 (evidence files), 19.1 (the notification centre for due reminders), 17, 17.1 (the decisions whose treatments it tracks) and 17.2 (the full post-demo journey)
**Closes:** UAT-045, UAT-046, UAT-047, UAT-058
**Intent:** O1, O2, Q1, PD-5
**Decisions:** the released assessment stays an immutable record while its risks live on in the register: treatment updates by owners and analysts, residual re-rating and closure by a Security Analyst as a recorded review, statements and inherent ratings frozen, every change in history (#9); each treatment moves from Not Started through In Progress to Complete on evidence, the server sets Overdue from `treatmentResolveDate` and every read derives it by the same rule, date changes need a reason, and overdue treatments escalate to the assigned analyst and the risk owner (G-16, reversing Phase 7 D-04 in part); due-date reminders in the app and by email through Strapi's email plugin, with a capture provider in development and tests, and email reminders for decisions left waiting (#18, G-18); divisions and business units stay free text with suggestions until the Admin lists of Phase 22.
**Contract and datamodel:** API (type filter and projection through the request, an owner-scoped risk read with a Requestor grant, post-release treatment operations, usage reads); a daily scheduled run in Strapi. Contract-gap record first, then an approval checkpoint (G-6): `docs/contract-gaps/phase-20-treatment-tracking.md` (with `docs/contract-gaps/phase-20-reminders-and-email.md` for reminder delivery and email), covering post-release history (old and new values, actor, time), progress notes, evidence and its files, date-change reasons, and the server-written `Overdue` with its governing date, amending `phase-07-derived-insights.md`'s treatment due-state rule. Reminder delivery facts join Phase 19.1's notification record or get their own; the plan decides.
**Size:** L (was M: the treatment lifecycle of RISK-06)

**Success Criteria:**

1. The register has "Project" and "BAU" saved views, and the exposure reports break down by type.
2. The treatment from the Phase 17.1 journey moves from Not Started to In Progress to Complete with an evidence statement, recording who and when; the analyst re-rates residual risk and closes the risk with a reason; the released assessment is unchanged, and the history shows each change.
3. A risk owner sees their risks, their risks' treatments and the decisions awaiting them or due for review in "My risks and treatments"; a treatment owner sees their treatments with due dates; neither sees anybody else's.
4. A system's page lists its requests and open risks by residual rating.
5. A treatment due within seven days produces an in-app reminder and an email in the development capture mailbox; once its resolve date passes it reads Overdue in the register, Home, alerts and exports, and escalates to the assigned analyst and the risk owner; a date change with a reason clears it. A decision left waiting more than seven days reminds its decider in the app and by email.
6. An unrelated user gets the refusal a missing record gets for another person's treatment, by any route; a treatment owner cannot change a risk field, the plan or the due date; completing without evidence is refused.
7. Playwright, final slice: the whole post-demo journey passes end to end, from a Requestor raising a request through release for response, responses from the Requestor and a different risk owner, submission, two contest points and a resubmission, an accepted risk and a treated risk, and release and closure, to the treatment tracked to Complete; an unrelated Requestor is refused at every step, in the UI and the API, and the analyst cannot accept.

**Plans:** 23 plans (wave 1 pairs the contract records with the pure modules; then one per wave, serialised by the contract files, the Strapi build and Playwright; kept whole by the pilot's decision, with a named seam in its PLAN-CHECK)

Plans:
**Wave 1**
- [ ] 20-01-PLAN.md — Record the 20-UI-SPEC's extensions X-62 to X-67 in the design direction and the six glossary entries (D-29; orchestrator constraint), both before any implementing task. Write `docs/contract-gaps/phase
- [ ] 20-02-PLAN.md — Build the pure modules D-30 puts in wave 1 beside the records, each RED-first with its unit test: `treatment-facts.ts` (D-07, D-08, D-09's applicability and governing date; G-16), `risk-people.ts` (D-

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 20-03-PLAN.md — Create the schema record 1 and record 2 approve (D-01): the CsrmRisk facts, CsrmTreatmentEvidence (D-18) and CsrmReminderDelivery (D-27), each with no route; prove on a fresh boot that the columns, li

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 20-04-PLAN.md — Switch Phase 11's one rule (plans 11-15 and 11-17) in `treatment-due-state.ts` per D-09: applicability, the governing date `COALESCE(treatmentResolveDate, targetDate)` (G-16), the order with `not-trac

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 20-05-PLAN.md — Build `withReleasedRiskMutation`, the release baseline and its overlay (D-05, D-06): the lock order of research §R3, one `release-baseline` history row before a risk's first post-release change, and t

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 20-06-PLAN.md — Serve the treatment acts (D-03 item 2): set progress, add a note, complete with evidence, reopen (with the completer's Undo), and change the resolve date, plan or treatment owner with a reason, per D-

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 20-07-PLAN.md — Serve evidence files on a released risk's treatment (D-03 item 3) in Phase 14 D-04's family shape, as Phase 14's pipeline's second holder (D-18): list, upload (with an optional progress note link), do

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 20-08-PLAN.md — Serve the analyst's post-release acts (D-03 item 4): close and reopen (the catalogued close, D-15), the residual review (D-14), and control implementation delivery (D-16), human-only with G-1 and G-11

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 20-09-PLAN.md — Serve the owner reads (D-03 item 1): "My risks and treatments" with its summary and export, the owner risk read, and the owner history read (D-19, D-20), scoped by Strapi through 20-05's repository an

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 20-10-PLAN.md — Add type, division and business unit through the request to the Risk register's rows, filters and sort, and the control, Risk Type, progress, decision review and treatment action filters the views and

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 20-11-PLAN.md — Add the type breakdowns and filters to the risk-exposure and assessment-throughput reports and the analyst Home's exposure figures (D-22), keep their accepted counts consistent with a not-confirmed re

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 20-12-PLAN.md — Serve the four "Used in" reads and the usage counts on the four reference lists (D-24), counted with the register's and queue's own predicates so every figure equals its list (X-10), in the records' A

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 20-13-PLAN.md — Extend Phase 19.1's notification service by the approved amendment (D-25; Orchestrator Confirmation: the plan that adds reminders extends it, with tests): a system actor, explicit recipients, the risk

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 20-14-PLAN.md — Build the reminder run (D-26): the server-written status first (D-08), then every kind's candidates from 20-02's rules, claimed exactly once in `CsrmReminderDelivery` (D-27) and written through 20-13'

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 20-15-PLAN.md — Add the email channel (D-28): install the official nodemailer provider after the pilot's verification, configure the plugin always with it, swap in the capture provider under the double development ke

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 20-16-PLAN.md — Build the owner risk page (D-20, D-29; 20-UI-SPEC §3) and its tracking panel (X-62): progress with optimistic Undo (D-08), completion on evidence with Undo and reopen (D-10), the refusal and stale sta

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 20-17-PLAN.md — Complete the owner page (D-29; 20-UI-SPEC §3.3 to §5, §12): the change sheets (D-12), progress notes (D-11), evidence on Phase 14's components (D-18), the decision review (D-17; X-64) and the post-rel

**Wave 17** *(blocked on Wave 16 completion)*
- [ ] 20-18-PLAN.md — Build "My risks and treatments" (D-20; 20-UI-SPEC §2): the Server Component page, the list with filters, sort, pagination, cards and states, the export through Phase 19's dialog (CSV-01), the `my-risk

**Wave 18** *(blocked on Wave 17 completion)*
- [ ] 20-19-PLAN.md — Add "My risks and treatments" to the sidebar with its count (D-20; UI-D10), the treatment and review items to the Requestor Home (D-20), and the analyst Home's tracked "Treatments due", exposure by ty

**Wave 19** *(blocked on Wave 18 completion)*
- [ ] 20-20-PLAN.md — Build the suggestion field (X-67) on the scoped suggestions read and use it in the request form (D-22); add the reports' filter row, the two type sections with phone card lists, and the copy the switc

**Wave 20** *(blocked on Wave 19 completion)*
- [ ] 20-21-PLAN.md — Build the register's views, columns and new filters (D-22, D-23; X-59, X-61), the queue's and assessment list's type filters and column (D-22), and the "Used in" panels and list counts (D-24; X-65), w

**Wave 21** *(blocked on Wave 20 completion)*
- [ ] 20-22-PLAN.md — Build the register risk detail's post-release panel (D-13 to D-16; 20-UI-SPEC §7): the shared treatment sections for analysts, the residual review sheet, close and reopen confirmations, control delive

**Wave 22** *(blocked on Wave 21 completion)*
- [ ] 20-23-PLAN.md — Append the post-demo journey's final slice, `sliceTrackTreatment`, to `apps/csrm/e2e/risk-owner-journey.spec.ts` with its negatives at every step (D-30; SC7; orchestrator constraint), write `post-rele

### Phase 21: Management dashboards and metrics

**Goal:** As a risk manager or leader, I want trends, ageing, cycle times and a heat map, so that I can see whether risk and the assessment process are improving.
**Mode:** mvp
**UI hint:** yes
**Requirements:** DASH-04, DASH-05
**Depends on:** Phases 13, 17.2 (stage times include the response, acceptance and rework rounds), 18 and 20
**Closes:** UAT-059
**Intent:** Q1
**Decisions:** metric sets per audience as `REPORT.md` §4 proposes, plus accepted risks and exemptions due for review; custom accessible SVG charts with data-table alternatives, and a charting library only if needs grow (#13).
**Contract and datamodel:** API (aggregate reads with closed report keys, 07 D-13 and D-14); status history and persisted job history: contract-gap records first, then an approval checkpoint.
**Size:** M

**Success Criteria:**

1. The leadership view shows open released risks by residual rating over 12 months.
2. A likelihood-by-consequence heat map shows inherent and residual positions for the filtered set, readable without colour.
3. Median and 90th-percentile time per stage are shown and link to the slowest items.
4. Failed AI jobs in the last seven days are visible to analysts.

**Plans:** 18 plans (waves 1, 2 and 11 pair independent work; otherwise one per wave)

Plans:
**Wave 1**
- [ ] 21-01-PLAN.md — Record the 21-UI-SPEC's extensions X-68 to X-73 in the design direction before any implementing task (orchestrator constraint; D-27). Write `docs/contract-gaps/phase-21-stage-history.md` (D-01, D-03 t
- [ ] 21-02-PLAN.md — Scope note (orchestrator, 2026-10-02): four tasks at the scope limit; each extends the previous one in the same module or report, and the pilot's pacing rule (planner-context) accepts this. Build, RED

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 21-03-PLAN.md — Create the approved CsrmStageTransition (D-01) and the one recorder (D-07): the facts loader, before-and-after derivation, append-on-change against the latest row or the stage before the act, the act'
- [ ] 21-04-PLAN.md — Scope note (orchestrator, 2026-10-02): four tasks at the scope limit; each extends the previous one in the same module or report, and the pilot's pacing rule (planner-context) accepts this. Build, RED

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 21-05-PLAN.md — Scope note (orchestrator, 2026-10-02): four tasks at the scope limit; each extends the previous one in the same module or report, and the pilot's pacing rule (planner-context) accepts this. Call the o

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 21-06-PLAN.md — Scope note (orchestrator, 2026-10-02): four tasks at the scope limit; each extends the previous one in the same module or report, and the pilot's pacing rule (planner-context) accepts this. Build the 

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 21-07-PLAN.md — Add the review queue's closed `stage` and `ageBand` filters, the `inStage` sort and projection (D-03 items 5 and 7, D-12) over 21-06's shared latest-row join and band predicate, so the queue's totals 

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 21-08-PLAN.md — Publish the `cycle-times` report key end to end (D-03): its closed parser with the period and Phase 20's filters, its computation through 21-06's `cycleTimes`, its specification schema, its export tab

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 21-09-PLAN.md — Serve `GET /api/v1/reports/{reportKey}/records` (D-03 item 2; 21-RESEARCH R10) with its closed parser (D-03 item 7), one `{ figure, rows }` function per kind (D-26), the cycle-times kinds `stage-episo

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 21-10-PLAN.md — Render the figure drill-down page `/app/reports/{reportKey}/records` (X-72; D-26), for the cycle-times kinds (D-10, D-12), reading 21-09's typed layer from a Server Component, with its five states, it

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 21-11-PLAN.md — Publish the `risk-trend` report key end to end (D-03, D-13): its parameters (period 12 by default, Phase 20's filters), its computation through 21-06's `riskTrend`, its specification, its export (D-19

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 21-12-PLAN.md — Serve `GET /api/v1/risks/heat_map` (D-03 item 4, D-15) as a sibling of the register list over its closed query, folding positions through the published scale (18 D-21; 17.1 D-58) with withdrawn risks 

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 21-13-PLAN.md — Draw the register's `Show as: Heat map` display (D-15; UI-SPEC §6) from 21-12's typed layer with 21-04's `RiskMatrixPair` (X-69; D-16), with links from every cell and off-scale axis to the equal regis
- [ ] 21-14-PLAN.md — Publish the `ai-assistance` report key end to end (D-03, D-21 to D-23) with the `ai-runs` drill-down kind on the shared records route and page (D-22, D-26), its export (D-19), and the run read the pol

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 21-15-PLAN.md — Extend the dashboard summary (D-18) with failed AI runs, computed only for a viewer holding the run read (D-02, D-21; 07 D-34), queue ageing for the team and the viewer (D-12), and reviews due (D-20's

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 21-16-PLAN.md — Scope note (orchestrator, 2026-10-02): four tasks at the scope limit; each extends the previous one in the same module or report, and the pilot's pacing rule (planner-context) accepts this. Add D-20's

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 21-17-PLAN.md — Lead the Reports index with the leadership view (D-19; UI-SPEC §3), composed from the risk-trend, risk-exposure, cycle-times and AI assistance reads with each section failing alone (07 D-34), every fi

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 21-18-PLAN.md — Scope note (orchestrator, 2026-10-02): four tasks at the scope limit; each extends the previous one in the same module or report, and the pilot's pacing rule (planner-context) accepts this. Seed the t

### Phase 22: Admin role and configurable lists

**Goal:** As an Admin, I want to own reference data and product configuration, separate from analysts' assessment work, so that registers, lists and scales are governed.
**Mode:** mvp
**UI hint:** yes
**Requirements:** ADMIN-07, ADMIN-08
**Depends on:** Phases 12, 17.1, 18 and 20 (the configuration they introduce); Keycloak identities exist behind flags (INT-02, off in development), so the Admin role uses a development fixture here
**Closes:** UAT-061
**Carried from Phase 10:** the Information Asset owner (the rest of UAT-053, ADMIN-05 criterion 1), which needs a contract-gap record.
**Carried from Phases 12, 14 and 19.1 (2026-10-01):** a manual start path, an empty questionnaire or assessment draft, for a request whose generation the AI data policy refuses, because the Admin's ceiling setting makes that refusal reachable (`NEXT-WAVE-DECISIONS.md` G-20); the attachment retention period, which decision 2 makes an Admin setting (14-CONTEXT); and a shorter retention for read notifications, a candidate setting (17-CONTEXT D-63, now Phase 19.1's).
**Intent:** R1, O2
**Decisions:** the Admin owns reference data and configuration (the Risk Type library, controls, systems, assets, scales, rating bands, risk appetite with its acceptance authority, divisions and business units, shared register views, the peer-review threshold and the AI data policy), with a read-only, exportable view of role holders; role assignment stays in the identity platform; the Admin holds no analyst grants, and every configuration change is recorded (#1, G-1).
**Contract and datamodel:** catalogue (a new IdamBox Role in both catalogue copies, re-granted Administration functions, a development sign-in fixture); configurable lists need entities: contract-gap records first, then an approval checkpoint. Role assignment in CSRM would re-open the IAM routes that 08 D-36 and D-44 removed, and is not planned.
**Size:** L (was M: the Admin role and its re-granted Functions, the settings with a forward-only criteria snapshot, one append-only change log, and the carried items; 22-CONTEXT D-28)

**Success Criteria:**

1. A user with the Admin role manages Risk Types, Controls, Systems and Assets; a Security Analyst without it can read but not change them.
2. The Admin edits the scales, the appetite and its acceptance authority, the division list, the peer-review threshold and the active Risk Types, and the forms, the AI and release readiness use them.
3. Role holders are visible in CSRM and export for an access review, and every configuration change shows who made it, when, and the old and new values.
4. Direct URLs to Admin screens show the permission state to everyone else.

**Plans:** 25 plans (wave 1 pairs the records with the pure modules; then one per wave)

Plans:
**Wave 1**
- [ ] 22-01-PLAN.md — Record the 22-UI-SPEC's extensions X-74 to X-80 in the design direction (orchestrator constraint; D-25), the glossary entries "Admin (role)" and "Retired (Risk Type, list entry)" (D-25) and the dated 
- [ ] 22-02-PLAN.md — Build, RED first, the pure modules D-28 puts beside the records: the five setting parsers and defaults with their constraints (D-10, D-13 to D-17), the round criteria snapshot (D-11), the list and req

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 22-03-PLAN.md — Apply the schema changes the pilot approved (D-01; records 2 and 3) and prove them on a fresh boot with existing rows unchanged; prove the four new types are hidden and unwritable from the Content Man

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 22-04-PLAN.md — Add `role.admin` to both catalogue copies and re-grant the eight Administration Functions (D-02): reads to both roles, writes moved into four Admin-only manage Functions. Split the policy's Administra

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 22-05-PLAN.md — Build the settings store (D-10): rows parsed at boot into one in-memory store that a committed change replaces; the change log's one writer (D-12); and the configuration read and write operations (D-0

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 22-06-PLAN.md — Point every configuration point's getter at the 22-05 store (D-10), keeping each explicit argument: the scale's bands and descriptions (D-13), the appetite with its new `treatmentExpected` and the nar

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 22-07-PLAN.md — Write the round criteria snapshot at "Submit final assessment" and evaluate every act and read of the round under it (D-11; D-01 item 6; 22-RESEARCH §3), keep everything between rounds on the current 

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 22-08-PLAN.md — Record a change row for every Admin create, update and import apply of reference data (D-06, D-12), add the Information Asset owner to the write, reads and export (D-21; closes UAT-053's remaining hal

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 22-09-PLAN.md — Serve Risk Type retirement and reinstatement (D-03 group 3) in `function.administration.risk_types_manage_api`, add the list's status filter and the picker's active-only offer, refuse a new choice of 

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 22-10-PLAN.md — Serve the two-level list (D-03 group 2) in `function.configuration.request_lists_api`: the Admin's read with retired entries and use counts, and add, rename, reorder, retire and reinstate with the div

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 22-11-PLAN.md — Build D-08's role-change recording as a document middleware (22-RESEARCH §1): a database diff before and after each user or role write, one `role-assignment` change row per affected user in the same t

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 22-12-PLAN.md — Serve the role holders read and export (D-07; D-03 group 5) and the change log read and export (D-12; D-03 group 6) through the endpoint chain with `function.access_review.role_holders_api` and `funct

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 22-13-PLAN.md — Serve shared-view governance (D-20; D-03 group 7) in `function.saved_views.governance_api`: list every shared view, rename, unshare with its restore, and transfer with its reverse, each a change row (

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 22-14-PLAN.md — Serve the two manual starts (G-20; D-22; D-03 group 8) in `function.generation.manual_start_api`, human Security Analyst only: the availability decision (policy refusal, a failed or interrupted latest

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 22-15-PLAN.md — Serve the manual start's reads (D-03 item 8; D-22, D-23): the jobs read's `aiPolicy.manualStart` per kind and viewer, and the analyst questionnaire and assessment `generation.manualStart` facts, with 

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 22-16-PLAN.md — Conclude the service agent's role review (D-09): withdraw every explicit grant of `role.security_analyst_agent` in both catalogue copies, keep the explicit refusals as defence in depth, turn the matri

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 22-17-PLAN.md — Add the Admin persona (D-26) in 17-02's and 17.1-17's shape: the development seed with the Admin role, the fixed Keycloak fixture subject and the matching realm user changed together, the README rows,

**Wave 17** *(blocked on Wave 16 completion)*
- [ ] 22-18-PLAN.md — Split `administration:manage` into the four capabilities of D-24 with their anchors, give the Admin a navigation profile (UI-SPEC §1.1), gate the reference routes on read versus manage with the permis

**Wave 18** *(blocked on Wave 17 completion)*
- [ ] 22-19-PLAN.md — Build the access review screens on 22-12's reads: Role holders (D-07; X-79; UI-SPEC §9) and the Change log with its details sheet (D-12; X-78; UI-SPEC §10), the reusable history sheet (X-29), both exp

**Wave 19** *(blocked on Wave 18 completion)*
- [ ] 22-20-PLAN.md — Build the configuration index and the five setting pages on 22-05's operations (D-10, D-13 to D-17, D-24, D-25; UI-SPEC §5, §6): X-74's editor and confirmation, X-56's conflict, the invalid summary, R

**Wave 20** *(blocked on Wave 19 completion)*
- [ ] 22-21-PLAN.md — Build the divisions and business units page on 22-10's operations (D-19; X-76, X-77; UI-SPEC §7.1, §7.2) and turn the request form's division and business unit into selects from the served form metada

**Wave 21** *(blocked on Wave 20 completion)*
- [ ] 22-22-PLAN.md — Complete the reference data screens for the Admin (D-06, D-18, D-21; UI-SPEC §4): the Show control, retire and reinstate with Undo, the asset owner, History and plain usage; mark retired Risk Types in

**Wave 22** *(blocked on Wave 21 completion)*
- [ ] 22-23-PLAN.md — Build the shared views page on 22-13's operations (D-20; UI-SPEC §8): the table with its owner notes and filter, rename, stop sharing and transfer with exact Undo, and family AA3's view rows, with the

**Wave 23** *(blocked on Wave 22 completion)*
- [ ] 22-24-PLAN.md — Build the manual start in the generation cards (G-20; D-22; X-80; UI-SPEC §11.1, §11.2) on 22-14's operations and 22-15's served state, the analyst's provenance header for a manually started record (D

**Wave 24** *(blocked on Wave 23 completion)*
- [ ] 22-25-PLAN.md — Write the phase spec `apps/csrm/e2e/admin-configuration.spec.ts` (D-27) proving SC1 to SC4 and G-20 at 1440 and 375 with axe, each change restored in its own teardown; add the configuration page to th

### Next-wave coverage

All 55 Next-wave requirements (`REQUIREMENTS.md`) map to exactly one of Phases 10–22, 17.1, 17.2 and 19.1: the 46 from the product gap UAT, and nine added on 2026-10-01 from the product demo's risk-owner asks (ASSESS-21 to ASSESS-26, COLLAB-04, NOTIFY-04 and RISK-06). All 65 product gap UAT findings close in exactly one phase (the `Closes` lines above). UAT-040 closes in Phase 17.1: it moved from Phase 17 on 2026-09-27, after the UAT register's `Proposed phase` column was written. COLLAB-01 and NOTIFY-01 move from v2 Requirements into this wave. INT-02 (Keycloak) is implemented behind flags and off in development (2026-10-01: ADRs 0003 and 0004); Phase 22 uses a development fixture for the Admin role. Phase 06.10 stays deferred.

**Post-demo asks** (`NEXT-WAVE-DECISIONS.md`, Post-demo decisions; requirements amended in passing are in `REQUIREMENTS.md`):

| Ask | New requirements | Phases |
|---|---|---|
| PD-1 The nominated risk owner and the Requestor view the assessment | ASSESS-21, ASSESS-22 | 17 |
| PD-2 Acceptance after the final assessment closes the request | ASSESS-24, ASSESS-25 (with ASSESS-20 amended) | 17.1 |
| PD-3 The owner contests anything, and the analyst edits everything again | COLLAB-04, ASSESS-26, NOTIFY-04; recall and voids in ASSESS-24 | 17.2; 17.1 |
| PD-4 Acceptance or a treatment plan | ASSESS-20 amended; ASSESS-23 for the people search | 17.1; 17 |
| PD-5 Treatment plans are tracked | RISK-06 (with RISK-04, RISK-05 and NOTIFY-02 amended) | 20 |

**The post-demo journey.** The brief's full-path Playwright journey (`.planning/POST-DEMO-BRIEF.md`, Stage 3 item 4) is built in slices, each a success criterion: Phase 17 (a Requestor raises a request, the analyst assesses it, nominates a different first-line risk owner for two of its risks and releases it for response, and the Requestor and that owner view it and respond), Phase 17.1 (the analyst submits the final assessment, the owner accepts one of their risks and treats the other, every other risk is decided by its owner, and the analyst releases and closes), Phase 17.2 (two contest points, an edit and a resubmission, inserted after the submission) and Phase 20 (the treatment tracked to Complete). Every slice carries the negative cases: an unrelated Requestor is refused at each step, in the UI and the API, and the analyst cannot accept. The journey passes end to end once Phase 20 lands.

## Backlog

### Phase 999.1: Local LLM evaluation and optimisation (BACKLOG)

**Goal:** Evaluate and tune a local model runtime (the operator-approved Ollama `qwen3.5:9b` at `127.0.0.1:11434`) for both generation operations, so request content can stay on the machine. Captured for future planning: moved from v1.0 Phase 06.10 at the v1.0 close (2026-09-28). It needs the operator to define its scope and to provide the runtime on the build host.
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

---
*Roadmap created: 2026-08-27; regrouped 2026-09-28 at the v1.0 close (v1.0 detail archived in `.planning/milestones/v1.0-ROADMAP.md`). v2.0 was added 2026-09-27 from the product gap UAT, with the delegated decisions in `NEXT-WAVE-DECISIONS.md` and Phase 17.1 inserted. The post-demo decisions (2026-10-01) amended Phases 17, 17.1 and 20 and inserted Phase 17.2.*
