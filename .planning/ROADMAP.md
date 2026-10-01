# Roadmap: IdamBox Cyber Risk Manager (CSRM)

## Milestones

- ✅ **v1.0 Controlled Cyber Risk Assessment Workflow** — Phases 1–9 with 06.1–06.10 (shipped to `main` 2026-09-26; closed 2026-09-28). Full detail: `.planning/milestones/v1.0-ROADMAP.md`.
- 🚧 **v2.0 Assessment Lifecycle and Oversight** — Phases 10–22, 17.1 and 17.2 (planning).

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

## v2.0 Assessment Lifecycle and Oversight (Phases 10–22, 17.1 and 17.2)

Added 2026-09-27 from the product gap UAT in `.planning/uat/product-gaps/` (`REPORT.md`, `FINDINGS.md` and `FINDINGS.csv`, 65 findings). These phases take CSRM from the v1 workflow to the operator's intended product (`BRIEF.md`, Appendix A: roles R1–R3, core flow F1–F10, A1–A2 at any point, oversight O1–O2, qualities Q1–Q5). Every finding maps to exactly one phase (the `Proposed phase` column of `FINDINGS.csv`) and to at least one Next-wave requirement in `REQUIREMENTS.md`. Milestone v1.0 stays open (STATE.md Decisions, 2026-09-27): these phases continue its numbering, and the operator may move them into their own milestone when v1.0 is closed.

**Decisions.** The operator delegated the product decisions on 2026-09-27. `.planning/NEXT-WAVE-DECISIONS.md` records all eighteen from `REPORT.md` §9 and six more (G-1 to G-6), each grounded in cyber-governance practice and a premium experience bar. Each phase's CONTEXT.md cites the numbers it depends on. On 2026-10-01 the post-demo decisions G-11 to G-18 reconciled the product demo's risk-owner asks (PD-1 to PD-5) into Phases 17, 17.1 and 20, and inserted Phase 17.2.

**Frozen datamodel.** A phase that needs a content-type change writes its `docs/contract-gaps/` record first. The schema change then waits at a checkpoint until the record is reviewed and approved (G-6). Phases 10, 11, 12 (except its run record and provenance), 19 and 21's first metric set need no content-type change.

**Execution order and waves.**

| Wave | Phases | Why this order |
|---|---|---|
| 1. Fix and trust | 10 → 11 → 12 | Fixes what users hit today, clarifies navigation and landing, and gives the AI full context and visible provenance, which every later AI phase builds on |
| 2. Collaboration and iterative AI | 13 → 14 → 15 → 16, then 19 | Notes and assignment come before the steps that use new information; export is independent and delivers CSV early |
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

**Plans:** 23 plans (one per wave; serialised by shared files and Playwright, D-40)

Plans:
**Wave 1**
- [ ] 10-01-PLAN.md — Record the five UI-SPEC extensions (X-1 to X-5) in the design direction, then deliver D-19's viewer time zone end to end: the browser's zone reaches a validated cookie through a Server Action, the app

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 10-02-PLAN.md — Gate the three analyst detail routes on `assessment:review` before any read, exactly as the analyst dashboard does (07 D-16), and rewrite every Phase 10 permission description in plain terms (D-24). C

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 10-03-PLAN.md — Make arrow keys select deterministically in the shared shadcn radio wrapper and in the segmented control (D-14), removing the Radix timing race behind UAT-064.

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 10-04-PLAN.md — Deliver REQ-07 on both request pages. One shared read-only request context shows every submitted field in the form's groups (D-20); the Requestor's actions derive from server state after every transit

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 10-05-PLAN.md — Rebuild the Requestor's questionnaire page around guidance (D-13): the introduction first, the attention list only after a submit attempt and in form order, history below the questions counted per rel

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 10-06-PLAN.md — Add D-03's first API change: closed conflict reason codes on the 409s the UAT met (D-22). Strapi's workflow errors carry one reason each (split throw sites), the controllers pass it as `details`, both

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 10-07-PLAN.md — Turn plan 10-06's reason codes into UI-SPEC §10.2's copy in the Server Actions for requests, questionnaires and questionnaire generation, and replace every "changed, reload" 409 fallback (§10.3). Save

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 10-08-PLAN.md — Deliver D-11 and D-12: answers autosave with a visible save status, and leaving warns while anything is unsaved. `useAnswerAutosave` drives a new autosave Server Action variant that calls no `revalida

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 10-09-PLAN.md — Fix the governance editor (D-04 to D-06) and the analyst's view of a released questionnaire (D-07). Placement comes from the complete question set through a new registered placement parser; the form c

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 10-10-PLAN.md — Add D-03's third API change in part: question events store a bounded text snapshot (D-18), and the analyst timeline projects question text by snapshot or by the D-17 resolution rule, so no timeline sh

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 10-11-PLAN.md — Deliver the server and contract half of UAT-019: the `regenerated` governance event (D-10, the remaining part of D-03 item 3), the refusal to replace a released questionnaire (D-09), and the analyst c

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 10-12-PLAN.md — Build the hub side of UAT-019 on plan 10-11's contract: `Replace questionnaire` with a confirmation that states the discard count (D-08), no offer and an explanatory hint while the questionnaire is re

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 10-13-PLAN.md — Add D-03's second API change: one human-analyst-only read of a request's current generation jobs (D-25), through the full chain of D-02: registry reads, a workflow function, a route and handler, the o

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 10-14-PLAN.md — Seed the analyst hub's questionnaire and draft job panels from plan 10-13's read on load (D-26), show jobs another analyst started with the right retry rights, override the Next action line while a jo

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 10-15-PLAN.md — Add D-03's fifth API change (D-34): a new list-item schema for the assessment's risk read carrying the brief §8 treatment and ownership facts, and a bounded control summary on control implementations.

**Wave 16** *(blocked on Wave 15 completion)*
- [ ] 10-16-PLAN.md — Add D-03's sixth API change: the Information System owner's display name on the Administration record and list (D-37), then seed the form's owner combobox with it and add the Owner and Business critic

**Wave 17** *(blocked on Wave 16 completion)*
- [ ] 10-17-PLAN.md — Finish D-36's content and label work in Administration: correct the public APP titles and the three Risk Type descriptions in the seed data, apply the control label rule to the Administration controls

**Wave 18** *(blocked on Wave 17 completion)*
- [ ] 10-18-PLAN.md — Deliver D-28's shared record picker and use it first for the assessment editor's mitigation control (D-29, D-31), with D-03's seventh API change: bounded applicable-control summaries on the picker's R

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

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 11 to break down)

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

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 12 to break down)

### Phase 13: Request pick-up and notes

**Goal:** As a Security Analyst, I want to pick up a request and exchange notes with the Requestor on it, so that ownership is clear and new information has a home at any point.
**Mode:** mvp
**UI hint:** yes
**Requirements:** REQ-08, COLLAB-01
**Depends on:** Phase 11 (queue columns)
**Closes:** UAT-013, UAT-014
**Intent:** F2, A1, A2, R2
**Decisions:** one accountable assignee: analysts self-assign or any analyst assigns, editing is not exclusive, and reassignment is recorded (#10); an analyst cannot be assigned a request they raised (G-1); both actors add notes from submission until closure; a note can mark the AI inputs as changed.
**Contract and datamodel:** an assignee relation on the request and a note entity: contract-gap records first, then an approval checkpoint; API for assign, release, note create and list with exact grants and record-level checks. Security note O-5 is settled by G-1 (separation of duties).
**Size:** M

**Success Criteria:**

1. An analyst picks up a request from the queue, and it shows "Assigned to <name>" everywhere it appears.
2. "Assigned to me" is a queue view and a dashboard figure, and any analyst on the request can follow its generation jobs.
3. The Requestor adds a note after submission, and the analyst sees it flagged on the queue and the request.
4. The analyst replies with a note the Requestor sees; each note shows its author and local time, and another Requestor cannot read it.
5. A note can be marked "changes the AI inputs", which Phases 12, 15 and 16 read.

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 13 to break down)

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

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 14 to break down)

### Phase 15: Steerable questionnaire AI

**Goal:** As a Security Analyst, I want to tell the AI what to add, change or remove in a questionnaire and to have it propose follow-up questions without touching answered ones, so that the question list keeps up with new information while I stay in control.
**Mode:** mvp
**UI hint:** yes
**Requirements:** QUES-11, QUES-12
**Depends on:** Phases 12 and 13
**Closes:** UAT-017, UAT-018
**Intent:** F4, A2 (Phase 9 workflow)
**Decisions:** re-runs propose additions and changes to unanswered questions only, and analyst edits change only through an accepted proposal (#4, reversing the pre-06.2 rule that regeneration is refused once any answer exists); analyst instructions are trusted but bounded, in their own slot, logged in the run record, never holding Requestor text (#5).
**Contract and datamodel:** API (a questionnaire proposal operation and job with exact grants); uses Phase 12's run record.
**Size:** M

**Success Criteria:**

1. After a note about offshore support, the analyst asks for follow-up questions and receives new questions only on that topic, with the answered ones untouched.
2. "Rewrite in plain language" on a question proposes a simpler version the analyst can accept or reject.
3. Every AI proposal shows its instruction, time and initiating analyst in the revision timeline.
4. Nothing reaches the Requestor until the analyst releases.

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 15 to break down)

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

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 16 to break down)

### Phase 17: Mitigation response and residual reassessment

**Goal:** As a Requestor or a nominated risk owner, I want to see the assessment once it is released for response and tell the analyst which controls we have or plan, and as a Security Analyst I want to nominate each risk's owner and have the AI reassess residual risk from the responses, so that the final assessment reflects the business's real mitigations and the people who must accept it have seen it.
**Mode:** mvp
**UI hint:** yes
**Requirements:** ASSESS-11, ASSESS-12, ASSESS-13, ASSESS-21, ASSESS-22, ASSESS-23, NOTIFY-01
**Depends on:** Phases 12, 13, 16 and 19 (participants export what they read)
**Closes:** UAT-025, UAT-026
**Intent:** F8, F9, PD-1, PD-4 (Phase 9 workflow)
**Decisions:** one analyst-controlled "Released for response" stage, repeatable in numbered rounds, in which the Requestor and named risk owners respond with the treatment plan (#3), reversing ASSESS-05's release-only visibility and "every risk and control mutation is analyst-only"; the analyst nominates each risk's owner, every risk needs one before release for response, and nobody who assesses a risk owns it (G-11); the Requestor, the nominated owners and named executive approvers read the whole assessment from its first release for response, and anyone else gets the refusal a missing record gets (G-12, reversing v1's owner-only Requestor read); first-line users find people through the hardened user search (G-17); an in-app notification centre with per-user read state, which risk owners receive too (#18, G-18). Review, peer approval and risk acceptance follow in Phase 17.1.
**Contract and datamodel:** contract-gap records first, then an approval checkpoint (G-6):
- `docs/contract-gaps/phase-17-response-rounds.md`: the response stage in the published status vocabulary, its numbered rounds, the response per risk from the Requestor or the risk's owner, and the first-release fact that opens the participant read (a dedicated fact that is never cleared, like 06.8's questionnaire release fact);
- `docs/contract-gaps/phase-17-participant-read.md`: who participates and what they read, amending `phase-04-composite-release-fact.md` ("Requestor visibility and projections");
- `docs/contract-gaps/phase-17-notifications.md`: notifications and per-user read state.

API for participant reads, owner nomination, response submission and residual proposals, with record-level checks. The hardened `GET /api/v1/users?search=` is an API change only: the operation is already catalogued for the Requestor. A development fixture identity for a first-line risk owner who is not the Requestor, so the journey has a Requestor, a different risk owner, an analyst and an unrelated Requestor.
**Size:** L

**Success Criteria:**

1. The analyst nominates the Requestor as owner of every risk in one step, then a different first-line person for one risk; release for response is refused while any risk has no owner, and the assigned analyst cannot be named.
2. The Requestor and that risk owner see the whole of UAT-A's assessment after the analyst releases it for response, and nothing of it before; the owner finds it in "My risk assessments" marked with their part, responds only on their own risk, and, once the assessment is released, prints and exports it as the Requestor can.
3. The Requestor adds two mitigating controls to a risk, naming a control owner found by name, and submits; the analyst accepts one and rejects one with a reason. The people search needs two characters, returns no email and no service identity, and logs each search.
4. "Reassess residual risk" proposes new residual values citing the accepted controls, and the analyst accepts them per field.
5. An unrelated Requestor gets the refusal a missing record gets for the assessment, its risks, control implementations and responses, at every stage, in the API and the UI; each participant is told in the app when the response waits or arrives.
6. Playwright, first slice of the post-demo journey: a Requestor raises a request; the analyst assesses it, nominates a different first-line risk owner for two of its risks (the two that owner later accepts and treats in Phase 17.1's slice) and releases it for response; the Requestor and that owner view it and respond; an unrelated Requestor is refused at each step, in the UI and the API.

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 17 to break down)

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

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 17.1 to break down)

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

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 17.2 to break down)

### Phase 18: Risk table and spreadsheet interoperability

**Goal:** As a Security Analyst, I want an assessment's risks in a table I can edit, copy and paste like Excel or a SharePoint list, so that reviewing and updating many risks takes minutes rather than a long scroll.
**Mode:** mvp
**UI hint:** yes
**Requirements:** ASSESS-15, ASSESS-16, ASSESS-17, ASSESS-18, ASSESS-19
**Depends on:** Phases 12, 16, 17.1 (bulk edits honour the acceptance-round lock and void changed decisions, ASSESS-24) and 19
**Closes:** UAT-008, UAT-039, UAT-050, UAT-055, UAT-056, UAT-057, UAT-063
**Intent:** Q4, Q3, F7
**Decisions:** the grid follows a research spike with pass-or-fail criteria (ARIA grid conformance at WCAG 2.2 AA, a permissive licence only, the route JavaScript budget, semantic tokens), leaning to the DataTable on TanStack Table (#7); the 5 × 5 scales with the product-banded rating and an override with a reason (#8); saved views personal by default and shareable with analysts; no persisted risk is hard-deleted from the table (#6).
**Contract and datamodel:** API (bulk update and create with exact grants, and bulk withdrawal through Phase 16's batch withdrawal operation; closed vocabularies for likelihood and consequence on the existing string fields); the risk change history is Phase 16's append-only risk history, extended by a record that amends `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md` rather than a second history; server-side saved views: contract-gap records first, then an approval checkpoint; possibly a grid dependency, justified by the spike. The review lists adopt this phase's column chooser (deferred here from Phase 11, D-33).
**Size:** L

**Success Criteria:**

1. Setting treatment owner, target date and status on ten risks takes under a minute with the keyboard, saved in one batch.
2. A range copied from the table pastes into Excel as rows and columns, and a 3 × 4 Excel range pastes into the table with a preview that converts "High" and dd/mm/yyyy.
3. A paste with one invalid cell applies nothing until the analyst chooses, and two analysts editing the same risk see a conflict, not a silent overwrite.
4. Released and Requestor views are read-only but copyable, and rows import from and export to CSV and XLSX.
5. 150 risks scroll and edit without visible lag at 1440px, and phones show a card list.

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 18 to break down)

### Phase 19: CSV export and import hardening

**Goal:** As a Security Analyst or risk manager, I want to export any list I can see and to import spreadsheets without fighting the format, so that CSRM fits the Excel work around it.
**Mode:** mvp
**UI hint:** yes
**Requirements:** CSV-01, CSV-02, CSV-03
**Depends on:** Phase 11 (list columns and filters)
**Closes:** UAT-049, UAT-051, UAT-052
**Intent:** Q3
**Decisions:** CSV and XLSX in the viewer's authorised scope, with Requestors exporting their own released assessments; formula-like values neutralised; every export logged with actor, view, filters and row count; a print-ready A4 report of the released assessment (#12).
**Contract and datamodel:** API (export operations reusing each list's filters and authorised scope; parser tolerance); a likely XLSX dependency, justified; no content-type change.
**Size:** M

**Success Criteria:**

1. The filtered Risk Register exports to XLSX with the visible columns, and a value starting with "=" arrives as text.
2. A Requestor can export only their own released assessment.
3. A file with "Name" headers and an extra column imports with a warning, and a Windows-1252 file gets a fix-it message.
4. The error report reopens in Excel, can be corrected and re-imports.
5. A lower-case duplicate of an existing name is held for a decision.
6. A released assessment prints as a clean A4 report.

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 19 to break down)

### Phase 20: Oversight registers and post-release tracking

**Goal:** As a risk manager, I want registers by assessment type that stay current after release, and as a risk or treatment owner I want to track each treatment to completion on evidence, so that oversight reflects what is actually being done.
**Mode:** mvp
**UI hint:** yes
**Requirements:** RISK-03, RISK-04, RISK-05, RISK-06, ADMIN-06, NOTIFY-02
**Depends on:** Phases 11, 14 (evidence files), 17 (notifications for due reminders), 17.1 (the decisions whose treatments it tracks) and 17.2 (the full post-demo journey)
**Closes:** UAT-045, UAT-046, UAT-047, UAT-058
**Intent:** O1, O2, Q1, PD-5
**Decisions:** the released assessment stays an immutable record while its risks live on in the register: treatment updates by owners and analysts, residual re-rating and closure by a Security Analyst as a recorded review, statements and inherent ratings frozen, every change in history (#9); each treatment moves from Not Started through In Progress to Complete on evidence, the server sets Overdue from `treatmentResolveDate` and every read derives it by the same rule, date changes need a reason, and overdue treatments escalate to the assigned analyst and the risk owner (G-16, reversing Phase 7 D-04 in part); due-date reminders in the app and by email through Strapi's email plugin, with a capture provider in development and tests, and email reminders for decisions left waiting (#18, G-18); divisions and business units stay free text with suggestions until the Admin lists of Phase 22.
**Contract and datamodel:** API (type filter and projection through the request, an owner-scoped risk read with a Requestor grant, post-release treatment operations, usage reads); a daily scheduled run in Strapi. Contract-gap record first, then an approval checkpoint (G-6): `docs/contract-gaps/phase-20-treatment-tracking.md`, covering post-release history (old and new values, actor, time), progress notes, evidence and its files, date-change reasons, and the server-written `Overdue` with its governing date, amending `phase-07-derived-insights.md`'s treatment due-state rule. Reminder delivery facts join Phase 17's notification record or get their own; the plan decides.
**Size:** L (was M: the treatment lifecycle of RISK-06)

**Success Criteria:**

1. The register has "Project" and "BAU" saved views, and the exposure reports break down by type.
2. The treatment from the Phase 17.1 journey moves from Not Started to In Progress to Complete with an evidence statement, recording who and when; the analyst re-rates residual risk and closes the risk with a reason; the released assessment is unchanged, and the history shows each change.
3. A risk owner sees their risks, their risks' treatments and the decisions awaiting them or due for review in "My risks and treatments"; a treatment owner sees their treatments with due dates; neither sees anybody else's.
4. A system's page lists its requests and open risks by residual rating.
5. A treatment due within seven days produces an in-app reminder and an email in the development capture mailbox; once its resolve date passes it reads Overdue in the register, Home, alerts and exports, and escalates to the assigned analyst and the risk owner; a date change with a reason clears it. A decision left waiting more than seven days reminds its decider in the app and by email.
6. An unrelated user gets the refusal a missing record gets for another person's treatment, by any route; a treatment owner cannot change a risk field, the plan or the due date; completing without evidence is refused.
7. Playwright, final slice: the whole post-demo journey passes end to end, from a Requestor raising a request through release for response, responses from the Requestor and a different risk owner, submission, two contest points and a resubmission, an accepted risk and a treated risk, and release and closure, to the treatment tracked to Complete; an unrelated Requestor is refused at every step, in the UI and the API, and the analyst cannot accept.

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 20 to break down)

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

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 21 to break down)

### Phase 22: Admin role and configurable lists

**Goal:** As an Admin, I want to own reference data and product configuration, separate from analysts' assessment work, so that registers, lists and scales are governed.
**Mode:** mvp
**UI hint:** yes
**Requirements:** ADMIN-07, ADMIN-08
**Depends on:** Phases 12, 17.1, 18 and 20 (the configuration they introduce); Keycloak identities exist behind flags (INT-02, off in development), so the Admin role uses a development fixture here
**Closes:** UAT-061
**Carried from Phase 10:** the Information Asset owner (the rest of UAT-053, ADMIN-05 criterion 1), which needs a contract-gap record.
**Intent:** R1, O2
**Decisions:** the Admin owns reference data and configuration (the Risk Type library, controls, systems, assets, scales, rating bands, risk appetite with its acceptance authority, divisions and business units, shared register views, the peer-review threshold and the AI data policy), with a read-only, exportable view of role holders; role assignment stays in the identity platform; the Admin holds no analyst grants, and every configuration change is recorded (#1, G-1).
**Contract and datamodel:** catalogue (a new IdamBox Role in both catalogue copies, re-granted Administration functions, a development sign-in fixture); configurable lists need entities: contract-gap records first, then an approval checkpoint. Role assignment in CSRM would re-open the IAM routes that 08 D-36 and D-44 removed, and is not planned.
**Size:** M

**Success Criteria:**

1. A user with the Admin role manages Risk Types, Controls, Systems and Assets; a Security Analyst without it can read but not change them.
2. The Admin edits the scales, the appetite and its acceptance authority, the division list, the peer-review threshold and the active Risk Types, and the forms, the AI and release readiness use them.
3. Role holders are visible in CSRM and export for an access review, and every configuration change shows who made it, when, and the old and new values.
4. Direct URLs to Admin screens show the permission state to everyone else.

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 22 to break down)

### Next-wave coverage

All 55 Next-wave requirements (`REQUIREMENTS.md`) map to exactly one of Phases 10–22, 17.1 and 17.2: the 46 from the product gap UAT, and nine added on 2026-10-01 from the product demo's risk-owner asks (ASSESS-21 to ASSESS-26, COLLAB-04, NOTIFY-04 and RISK-06). All 65 product gap UAT findings close in exactly one phase (the `Closes` lines above). UAT-040 closes in Phase 17.1: it moved from Phase 17 on 2026-09-27, after the UAT register's `Proposed phase` column was written. COLLAB-01 and NOTIFY-01 move from v2 Requirements into this wave. INT-02 (Keycloak) is implemented behind flags and off in development (2026-10-01: ADRs 0003 and 0004); Phase 22 uses a development fixture for the Admin role. Phase 06.10 stays deferred.

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
