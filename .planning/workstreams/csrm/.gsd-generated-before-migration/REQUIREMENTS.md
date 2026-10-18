# Requirements: IdamBox Cyber Risk Manager (CSRM)

**Milestone:** v2.0 Assessment Lifecycle and Oversight
**Defined:** 2026-09-27; milestone started 2026-09-28
**Core Value:** Make a complex cyber-risk workflow simple and auditable while keeping Security Analysts—not AI—in control of assessment review and release.

v1.0's requirements are archived in `.planning/milestones/v1.0-REQUIREMENTS.md`.

## v2.0 Requirements

**Defined:** 2026-09-27, from the product gap UAT (`.planning/uat/product-gaps/`). Each requirement has acceptance criteria and a trace to the operator's intended product (IDs from `BRIEF.md`: roles R1–R3, flow F1–F10, A1–A2, oversight O1–O2, qualities Q1–Q5), to the findings it closes (`FINDINGS.md`) and to its phase. Decision numbers refer to `.planning/NEXT-WAVE-DECISIONS.md`.

**Post-demo (2026-10-01):** nine requirements come from the product demo's risk-owner asks, PD-1 to PD-5, and decisions G-11 to G-18 (`NEXT-WAVE-DECISIONS.md`, Post-demo decisions). They trace to those IDs and close no UAT finding. Each requirement those decisions changed carries an "Amended" line saying what changed.

### Requests

- [x] **REQ-07**: A Security Analyst sees every field the Requestor submitted, and each actor's request actions refresh after every workflow transition.
  - Acceptance: (1) the analyst's request page shows third-party involvement, third-party details and regulatory requirements, grouped as on the Requestor's form; (2) after a request returns to draft, both actors see the draft actions without reloading.
  - Trace: F1, F2 · UAT-015, UAT-037 · Phase 10
- [ ] **REQ-08**: A Security Analyst can pick up a submitted request, assign or reassign it to a Security Analyst, or release it back to the queue, and every analyst on the request can follow its generation jobs.
  - Acceptance: (1) pick-up, assignment, reassignment and release record actor and time, and the assignee's name shows on the request, the review queue and the dashboards; (2) the review queue has an "Assigned to me" view that the analyst dashboard counts; (3) any Security Analyst who may read the request can read its questionnaire and draft generation jobs; (4) one analyst is accountable, and assignment does not restrict which analysts may contribute (decision 10); (5) an analyst cannot pick up or be assigned a request they raised, enforced in Strapi (G-1).
  - Trace: F2, R2 · UAT-014 · Phase 13

### Collaboration

- [ ] **COLLAB-01**: The Requestor and Security Analysts can add attributed plain-text notes to a request at any point after submission and read its notes history.
  - Acceptance: (1) each note records author, local time and text, and notes are append-only; (2) a new note is flagged on the analyst queue and the Requestor's Home until read; (3) a Security Analyst can mark a note as changing the AI inputs, and the AI context (INT-05) includes the marked notes only; (4) another Requestor cannot list or read the notes by any route, enforced in Strapi.
  - Trace: A1, A2 · UAT-013 · Phase 13
  - Amended (2026-10-01, Phase 13 context): a Security Analyst marks a note as changing the AI inputs, and only marked notes reach the AI context.
- [ ] **COLLAB-02**: The Requestor and Security Analysts can attach supporting files (PDF, office documents, spreadsheets) to a request at intake and at any later stage.
  - Acceptance: (1) allowed files (PDF, DOCX, XLSX, PPTX, CSV, TXT, PNG and JPEG, checked by content; up to 25 MB each and 20 per request) upload at creation and later, each showing name, size, uploader and time, and download only through an authorised operation; (2) a disallowed type, an oversize file or a file that fails the malware scan is refused with its reason; (3) only actors who may read the request can list or download its files, and another Requestor is refused at every route; (4) removal records actor and time, and retention follows the assessment's; (5) the analyst opts each file's extracted text into the AI context, off by default; included text is size-capped, marked as untrusted, and never sent above the provider's approved classification ceiling (decision 2, G-3).
  - Trace: F1, A1 · UAT-012 · Phase 14
- [ ] **COLLAB-04**: Participants contest any part of an assessment under acceptance, and each point gets a recorded answer.
  - Acceptance: (1) while an acceptance round is open, the Requestor, a risk owner or an executive approver raises a contest point on anything they can read (an assessment field, a whole risk, one risk field or a control implementation), with a required reason; (2) each point has an append-only reply thread of attributed plain text, shown in the viewer's local time, and a status of open, answered, then resolved or withdrawn by its raiser; (3) every participant and analyst of the assessment sees each point beside the content it targets and in the round's list; (4) release is refused while any point is open, and an answered point its raiser did not resolve stays on the record as answered; (5) nobody edits or deletes a point or a reply, and an unrelated user, Requestor or not, gets the refusal a missing record gets at every contest-point route, in the API and the UI.
  - Trace: PD-3 · Phase 17.2 (G-15)

### Questionnaires

- [x] **QUES-08**: A Security Analyst can govern any questionnaire, including AI-generated ones, without errors or lost work.
  - Acceptance: (1) adding a question to an existing section or to a new named section succeeds on generated and seeded questionnaires; (2) Add and Edit open where invoked with focus in the first field, and errors show beside the form; (3) regenerating first states how many analyst edits it discards, and the timeline records a Regenerated event while earlier entries stay attached to their questions; (4) after release the analyst sees the released questions read-only and the Requestor's answered count, without answer content before submission (default).
  - Trace: F4, F5 · UAT-005, UAT-016, UAT-019, UAT-020 · Phase 10
- [x] **QUES-09**: A Requestor answers a questionnaire without losing work and with clear guidance.
  - Acceptance: (1) answers autosave with a visible saved state, or leaving with unsaved answers warns first; (2) the questionnaire opens with an introduction and the first section, the unanswered-required list appears only after a submit attempt and in form order, and the history follows the questions; (3) radio groups follow the ARIA radio pattern, so arrow keys move and select; (4) submission dialogs say what happens next and how to change it, matching the actions the page then offers.
  - Trace: F5, Q5 · UAT-021, UAT-022, UAT-023, UAT-064 · Phase 10
- [ ] **QUES-10**: Generated questionnaires suit a Requestor who is not a security expert.
  - Acceptance: (1) generated questions ask one thing each in plain language, offer choices with "Not sure" where a choice fits, are optional where appropriate and carry short help text; (2) generation receives the assessment context (INT-05), regulatory requirements and the selected systems and assets included.
  - Trace: F3, Q5 · UAT-043 · Phase 12
- [ ] **QUES-11**: A Security Analyst can instruct the AI to add, change or remove questions, and accept or reject each proposed change.
  - Acceptance: (1) an instruction such as "add questions about offshore support" or "rewrite in plain language" returns a proposal of additions, edits and deletions; (2) each proposed change is accepted or rejected on its own, and nothing changes until accepted; (3) the run record and the revision timeline show the instruction, the initiating analyst, the time and the provider; (4) the instruction travels in its own slot, never mixed with Requestor text (decision 5).
  - Trace: F4, A2 · UAT-017 · Phase 15
- [ ] **QUES-12**: After answers exist, a Security Analyst can ask the AI for follow-up questions that keep every answered question and its answer unchanged.
  - Acceptance: (1) the proposal uses the request, the notes marked as changing the AI inputs (COLLAB-01) and the answered questions as fixed context and adds or revises unanswered questions only; (2) no proposal changes or removes an answered question or its answer; (3) revised questions reach the Requestor only when the analyst releases them.
  - Trace: A2, F4 · UAT-018 · Phase 15 (decision 4, reversing the pre-06.2 rule that regeneration is refused once any answer exists)
  - Amended (2026-10-01, Phase 13 context): the fixed context holds the notes marked as changing the AI inputs, not every note.

### Assessments

- [x] **ASSESS-06**: A Security Analyst edits risks and control implementations with fitting pickers and clear feedback.
  - Acceptance: (1) mitigation control, impacted system, impacted asset and control owner use server-backed searchable pickers, with the Risk Type's applicable controls first and the request's systems and assets first; (2) every date field, the exemption review date included, uses the shared date input; (3) saving a risk or a control implementation confirms inline; (4) release readiness is summarised per risk with its outstanding count and a link to the risk, and met items are hidden by default.
  - Trace: F7, F9, F10 · UAT-006, UAT-009, UAT-010, UAT-011, UAT-034 · Phase 10
- [x] **ASSESS-07**: The released assessment shows each risk's full treatment for both actors.
  - Acceptance: controls show by number and name, and each risk shows its treatment action and plan, owners and dates, read-only.
  - Trace: F10, O1 · UAT-033 · Phase 10
- [ ] **ASSESS-08**: AI draft generation uses the organisation's Risk Type library and proposes controls and treatments for the analyst to accept.
  - Acceptance: (1) drafts draw on the active Risk Type library, whose active types the Admin controls from Phase 22 (decision 14), and may propose several risks per type; (2) each proposed risk carries suggested controls from the whole control library as one-click "add as planned control" proposals; (3) a draft may propose Accept, with a rationale, only for Low or Moderate residual risk (decision 8), and the analyst confirms.
  - Trace: F6, F7 · UAT-029, UAT-031, UAT-044 · Phase 12
  - Amended (2026-10-01, Phase 22 context D-14): the Admin's risk appetite can narrow the AI's Accept limit (Low or Moderate, decision 8) but never widen it.
- [ ] **ASSESS-09**: A Security Analyst can withdraw an unreleased risk with a reason.
  - Acceptance: (1) a withdrawn risk leaves the assessment, release readiness and counts, and the history keeps it with reason, actor and time; (2) no persisted risk is ever hard-deleted: an unsaved row is discarded, and a rejected AI proposal is recorded as rejected in the run record (decision 6); (3) Strapi refuses to withdraw a released risk, which closes through the register instead.
  - Trace: F7 · UAT-027 · Phase 16
- [ ] **ASSESS-10**: A Security Analyst can re-run the AI for one risk or to propose additional risks.
  - Acceptance: (1) "Suggest more risks" proposes risks that do not duplicate existing ones, each accepted or rejected on its own; (2) "Rewrite this risk" proposes field changes as a diff accepted per field; (3) each run is recorded with instruction, analyst, time and provider, and released risks cannot be re-run.
  - Trace: F7, A2 · UAT-028 · Phase 16
- [ ] **ASSESS-11**: A Security Analyst can release the initial risks to the Requestor and the nominated risk owners for a response.
  - Acceptance: (1) in a "Released for response" stage the owning Requestor and every nominated risk owner (ASSESS-21) read the initial risks, and see nothing of them before it; (2) the Requestor and the owners edit only their responses, never the risk fields, and the analyst can close the round and open another; (3) an unrelated user, Requestor or not, cannot see or respond to the risks at any stage, and gets the refusal a missing record gets (ASSESS-22).
  - Trace: F8, PD-1 · UAT-025 · Phase 17 (decision 3 and G-12, reversing ASSESS-05's release-only visibility and "every risk and control mutation is analyst-only")
  - Amended (2026-10-01, G-11, G-12): the nominated risk owners join the Requestor in criteria 1 and 2, and criterion 3 names the refusal.
- [ ] **ASSESS-12**: The Requestor and the nominated risk owners respond to each initial risk with mitigating controls, and the analyst decides on each.
  - Acceptance: (1) per risk, the Requestor or the risk's owner proposes existing controls, each with an owner found by name (ASSESS-23) and its evidence, or planned controls, each with an owner found by name and a due date, may propose a different risk owner, and then submits the response; (2) the analyst accepts, edits or rejects each proposed control with a reason, and accepted ones become control implementations; (3) a risk owner responds only on the risks they own, and the Requestor on any risk of their request; Strapi refuses every other response.
  - Trace: F8, F9, PD-1 · UAT-025 · Phase 17
  - Amended (2026-10-01, G-11, G-17): nominated owners respond as well as the Requestor, control owners are found by name, and criterion 3 is new.
  - Amended (2026-10-01, Phase 17 context D-33): an existing control carries its evidence and a planned control its due date, each with an owner found by name.
- [ ] **ASSESS-13**: The AI proposes a residual-risk write-up from the recorded controls and responses.
  - Acceptance: (1) "Reassess residual risk", per risk or for the assessment, proposes residual likelihood, consequence, rating and rationale citing the accepted controls; (2) the analyst accepts proposals per field and can re-run.
  - Trace: F9 · UAT-026 · Phase 17
- [ ] **ASSESS-14**: A Security Analyst marks an assessment reviewed explicitly.
  - Acceptance: (1) "Mark reviewed" is offered once the release requirements are met and records reviewer and time; (2) edits after review show as "changed since review" and need review again before the assessment is submitted for acceptance; (3) when any residual risk is Critical, a threshold the Admin can change from Phase 22, a second Security Analyst approves before the assessment is submitted for acceptance; (4) neither the reviewer nor the approver can be the Requestor of that request (G-1), or a risk owner or executive approver on that assessment (G-11).
  - Trace: F10 · UAT-040 · Phase 17.1 (decision 17, reversing save-driven review, 06.8 D-04 and D-13)
  - Amended (2026-10-01, G-11, G-13): review and peer approval now come before "Submit final assessment" (ASSESS-24), not just before release, and criterion 4 adds risk owners and executive approvers.
- [ ] **ASSESS-15**: An assessment's risks are available as a table with configurable columns, sort, filter, a frozen first column and saved views.
  - Acceptance: (1) one row per risk with the default columns of `REPORT.md` §7 and every other field through a column chooser; (2) sort by any column, per-column filters, quick search, a row count, and named saved views that are personal by default and shareable with analysts; (3) below 768px the risks show as a stacked card list with a detail sheet, with no grid editing on phones; (4) 150 risks scroll and edit without visible lag at 1440px within the route JavaScript budget or a recorded exception.
  - Trace: Q4, F7 · UAT-039, UAT-055 · Phase 18
- [ ] **ASSESS-16**: A Security Analyst edits risks inline in the table with validation, batch save, undo and conflict handling.
  - Acceptance: (1) cell editors fit the field type (pick lists, user search, dates in the local format, multi-line text, the control picker) and apply the server's validation per cell; (2) changed cells are marked, "Save changes" saves a batch through a Strapi bulk operation, and Discard, undo and redo work within the session; (3) a save with stale rows returns the conflicts, resolved per cell; (4) every change records who, when and the old and new values.
  - Trace: Q4, F7 · UAT-055 · Phase 18
- [ ] **ASSESS-17**: The risk table follows the WCAG 2.2 AA grid keyboard pattern and copies and pastes with Excel and SharePoint in both directions.
  - Acceptance: (1) grid role, roving focus, arrow and jump keys, Enter, F2 and Escape editing, and announced changes, with the risks reachable without tabbing through the readiness list; (2) a copied range is tab-separated text plus an HTML table with display values, and pastes into Excel as rows and columns; (3) an Excel or SharePoint range pastes from the active cell with column mapping and type conversion ("High", dd/mm/yyyy, names, control numbers), previewed with every change and error, and nothing applies partially without the analyst choosing; (4) released and Requestor views are read-only but copyable.
  - Trace: Q4 · UAT-056, UAT-057, UAT-063 · Phase 18
- [ ] **ASSESS-18**: Likelihood and consequence use controlled scales, with a derived rating the analyst can override with a reason.
  - Acceptance: (1) likelihood (Rare, Unlikely, Possible, Likely, Almost certain) and consequence (Insignificant, Minor, Moderate, Major, Severe) are pick lists from the organisation's 5 × 5 scales (decision 8), enforced by the API on the existing string fields, with a recorded rule for existing free text; (2) the rating derives as values change, as the product of the two scores banded 1–4 Low, 5–9 Moderate, 10–16 High and 20–25 Critical, and can be overridden with a recorded reason.
  - Trace: F7, Q1 · UAT-008 · Phase 18
- [ ] **ASSESS-19**: A Security Analyst imports rows into, and exports rows from, an assessment's risks.
  - Acceptance: (1) CSV or XLSX import creates and updates risks by risk number, and bulk-imports control implementations by risk number and control number, through the five-step preview; (2) export writes the current view (visible columns, filters, sort) to CSV and XLSX with formula-injection protection.
  - Trace: Q3, Q4 · UAT-050 · Phase 18
- [ ] **ASSESS-20**: Each risk's owner decides it, accept or treat, before release, within the authority the risk appetite sets.
  - Acceptance: (1) each risk's owner, and for High and Critical risk its executive approver, sees the acceptance request on their Home and in the app's notifications, and the owner decides each of their risks: Accept with a rationale, offered only for a risk with no planned control implementation, or Treat with a treatment plan, a treatment owner found by name (defaulting to the risk owner, ASSESS-23) and a resolve date, starting at Not Started; the analyst's values pre-fill the form as a recommendation; (2) authority follows the residual rating whichever the choice: the risk owner decides Low and Moderate risk, High also needs the named executive approver, and for Critical risk the owner proposes and only the named executive approver decides, as a time-limited exception that sets the exemption flag and a review date three months out; for High and Critical risk an Accept rationale says why treatment is not practicable; the analyst names the executive approver before submission, and it is a different person from the risk owner (decision 8); (3) each decision records who decided, when, the authority, the choice, the rationale, a review date from the appetite's interval and a fingerprint of the risk, is never overwritten, can be revised by its decider until release, and shows in the released assessment and in the register's "Accepted risks" view; (4) release is refused until every risk has a valid decision under the authority it needs; (5) only the named risk owner or executive approver can decide a risk: Strapi refuses the assigned analyst, every other Security Analyst, the Requestor when not named, an unrelated user and the service identity, and the UI shows them no decision control.
  - Trace: F8, F10, PD-2, PD-4 · UAT-025, UAT-040 · Phase 17.1 (G-2, G-14; ISO/IEC 27001:2022 clause 6.1.3 f)
  - Amended (2026-10-01, G-14, G-15): criterion 1 replaces "accepts or declines with a rationale, and a decline returns the risk to the analyst" with the explicit Accept or Treat decision, because a disagreement is now a contest point (COLLAB-04); criterion 2 applies the authority to Treat as well as Accept; criterion 3 adds the fingerprint and revisions; criterion 5 is new.
  - Amended (2026-10-01, Phase 17.1 context D-52): the register's "Accepted risks" view is delivered in Phase 20, and Phase 17.1 shows acceptances on the owner's Home and the released assessment.
- [ ] **ASSESS-21**: A Security Analyst nominates a risk owner for every risk before releasing the assessment for response.
  - Acceptance: (1) the analyst sets each risk's owner (`riskOwner`) through the analyst user search, or one owner for every risk in one step, and the risk's history records each change with who and when; (2) release for response is refused, with its reason, while any non-withdrawn risk has no owner, and Strapi refuses an inactive user or a service identity as owner; (3) the Requestor (in the response or a note) or a nominated owner (in the response; request notes stay between the Requestor and the Security Analysts, Phase 13) can propose a different owner, and only an analyst changes it; (4) Strapi refuses to name the request's assigned analyst as a risk owner, and refuses a person named as a risk owner every analyst mutation of that assessment, whatever roles they hold; Phase 17.1 extends the rule to reviewers, peer approvers and executive approvers (ASSESS-14, ASSESS-20).
  - Trace: PD-1, F8 · Phase 17 (G-11, extending G-1)
  - Amended (2026-10-01, Phase 13 context): a nominated owner who is not the Requestor proposes a different owner in the response only, because request notes stay between the Requestor and the Security Analysts.
- [ ] **ASSESS-22**: The Requestor and the nominated risk owners read the whole assessment from its first release for response, and nobody else does.
  - Acceptance: (1) from the first release for response, or the first submission for acceptance if the analyst skipped the response stage, Strapi grants the Requestor, every nominated risk owner and every named executive approver a read of the assessment's fields and every non-withdrawn risk with its control implementations and responses, plus, as Phases 17.1 and 17.2 add them, the decisions and contest points with their history; the gate reads a dedicated fact that is never cleared, and an assessment released before this flow has none, so only its Requestor reads it whole, as in v1; (2) the read lasts through every round, the analyst's rework and the released record, each view names its stage (Released for response, With the Security Analyst, Awaiting acceptance, Released), and actions are open only in their own stage and, for a risk owner, only on their own risks; (3) a participant who is not the Requestor also reads the request's summary (number, title, description, assessment type, division, business unit, business criticality, systems and assets) but not its questionnaire, notes or attachments; (4) before the gate opens, and for anyone who is not a current participant, every assessment, risk, control implementation, response and history route returns the refusal a missing record gets, and the web shows the not-found page; an unrelated Requestor is refused this way at every stage, in the API and the UI; (5) "My risk assessments" lists every assessment the person takes part in, with their part, and the print-ready report and export of a released assessment are open to every participant (extending decision 12 and CSV-01).
  - Trace: PD-1, F8 · Phase 17 (G-12, extending decision 3 and reversing v1's owner-only Requestor read, Phase 4)
- [ ] **ASSESS-23**: First-line users find people by name through a least-privilege search.
  - Acceptance: (1) `GET /api/v1/users?search=` returns at most 20 active human users whose display name contains a term of at least two characters, each as `documentId` and `displayName` only; (2) it never returns an inactive user or a service identity, never includes email, username or roles, refuses a shorter term or any other query parameter, and refuses a caller without an active IdamBox User, as every CSRM route does; (3) every search is recorded in the server log with the actor, the time, the term and the result count; (4) the Requestor and nominated risk owners use it to name planned-control owners in the response, and Phase 17.1 reuses it for the treatment owner; sponsor selection stays unavailable.
  - Trace: PD-4, F8 · Phase 17 (G-17, settling Phase 2's deferred least-privilege directory contract)
- [ ] **ASSESS-24**: A Security Analyst submits the final assessment for acceptance in numbered rounds, and can recall it.
  - Acceptance: (1) "Submit final assessment" is offered to the assigned analyst only when "Mark reviewed" is current, peer approval is in place where decision 17 needs it, every risk has an owner and, at High or Critical residual rating, a named executive approver, and every other readiness condition is met; otherwise the page says what is outstanding; (2) submitting opens acceptance round n, tells each participant with a decision to make in the app, and makes Strapi refuse every analyst edit to the assessment, its risks and their control implementations, by any route, until the round closes; (3) the assigned analyst can recall an open round with a reason, which closes it as "recalled" and reopens everything for editing, and the next submission opens round n+1; (4) a decision from an earlier round stays valid only while its risk matches the fingerprint recorded with it; otherwise it is voided as "superseded by a change in round n+1", kept in the history, and its decider is told in the app to decide again; (5) Strapi refuses submit and recall to any caller other than the assigned human Security Analyst, including other analysts, the service identity, the Requestor and risk owners.
  - Trace: PD-2, PD-3, F10 · Phase 17.1 (G-13, G-15)
- [ ] **ASSESS-25**: The assigned Security Analyst releases the accepted assessment and closes the request in one confirmed step.
  - Acceptance: (1) "Release and close" is offered once every non-withdrawn risk has a valid decision under the authority it needs, with a confirmation that says what it does, and Strapi refuses it with its reason before then; (2) the confirmed step sets, in one transaction, the assessment to `approved` with `approvedBy`, `approvalDate` and `assessmentDate`, and the request to `closed`; the assessment reads "Released" and the request "Closed" everywhere, and the assessment's next review date is the earliest decision review date unless the analyst set an earlier one; (3) released reads, lists, summaries and exports work for a `closed` request exactly as for a request released before this flow (`approved`), and the released record is immutable (decision 9); (4) Strapi refuses the step to any caller other than the assigned human Security Analyst, and no AI path or service identity can decide, release or close; (5) every participant is told in the app that the assessment was released and the request closed.
  - Trace: PD-2, F10 · Phase 17.1 (G-13, reversing v1's release transition to request `approved`, Phase 4)
- [ ] **ASSESS-26**: A returned assessment is reworked, every contest point is answered, and owners decide again only what changed.
  - Acceptance: (1) a risk owner or an executive approver sends the assessment back with at least one contest point, which closes round n as "returned" and reopens the whole assessment for editing, and any edit withdraws "Mark reviewed" and a Critical peer approval (decision 17); (2) the analyst answers each point of the closed round "changed", saying what changed, or "kept", with a reason, and cannot resubmit while any is unanswered or before marking the assessment reviewed again; (3) in round n+1 each decider sees which of their decisions stand and, for each voided one, every changed field before and after; (4) the assessment's history shows every round, submission, recall, decision, revision, void, contest point, reply and answer with who and when, to its participants and analysts; (5) the Requestor who owns no risk can raise points but cannot send back, the analyst cannot send back or resolve a participant's point, and an unrelated user gets the refusal a missing record gets for the history and every rework route.
  - Trace: PD-3 · Phase 17.2 (G-15, reversing G-2's per-risk decline)

### Risk Register and Oversight

- [ ] **RISK-03**: Assessment type (BAU, Project, Other), division and business unit are register columns, filters, saved views and report dimensions.
  - Acceptance: (1) the register, the review queues and the assessment list show and filter by assessment type, with "Project" and "BAU" saved views; (2) the exposure and throughput reports and the analyst Home break down by type.
  - Trace: O1 · UAT-045 · Phase 20
- [ ] **RISK-04**: Released risks track treatment to closure without reopening the assessment.
  - Acceptance: (1) after release, the treatment owner updates treatment status, progress notes and evidence; the risk owner also changes the treatment owner, the plan and the due date, each with a reason; a Security Analyst can do all of these, re-rates residual risk after treatment and closes the risk with a reason, each as a recorded review; statements, inherent ratings and the decision record stay frozen (decision 9); (2) the released assessment is unchanged, and the risk's history shows each change with actor, time and the old and new values; (3) a risk released under the acceptance flow starts tracking from its owner's Treat decision (ASSESS-20), and a risk released before it from its released treatment fields.
  - Trace: O1, PD-5 · UAT-046 · Phase 20
  - Amended (2026-10-01, G-16): criterion 1 states who may change what and freezes the decision record, criterion 2 adds the old and new values, and criterion 3 is new.
- [ ] **RISK-05**: Risk, treatment and control owners see the risks and treatments they own.
  - Acceptance: (1) "My risks and treatments" lists, scoped by Strapi, the records where the viewer is risk, treatment or control owner, with due-soon and overdue flags, the decisions and executive approvals awaiting them, the decisions to make again after a change, and the decisions due for review, and nobody else's; a risk owner sees the treatment of each of their risks, whoever owns it; (2) owners can update treatment progress on their released risks where RISK-04 allows; (3) another person's risk or treatment returns the refusal a missing record gets, by any route.
  - Trace: O1, Q1, PD-5 · UAT-058 · Phase 20
  - Amended (2026-10-01, G-12, G-16): criterion 1 adds executive approvals, decisions to make again and the risk owner's view of their risks' treatments; criterion 3 is new.
  - Amended (2026-10-01, Phase 20 context D-17): a due acceptance or exception review is confirmed or declined by whoever holds the authority, without changing the decision records.
- [ ] **RISK-06**: Treatments move through a recorded lifecycle to completion on evidence, and become Overdue by their date.
  - Acceptance: (1) people set a treatment's status to Not Started, In Progress or Complete, and the server sets Overdue once `treatmentResolveDate` has passed without completion, in a daily run and on any update; (2) every read, export, Home figure, alert, report and reminder derives due soon and overdue from the same date by the same rule (`targetDate` only for a treated risk without a resolve date), and an overdue treatment leaves Overdue only on completion or a date change, returning to its last progress status; (3) completion needs an evidence statement and records who completed it and when, progress notes are append-only and attributed, and evidence files can be attached through Phase 14's attachment service; (4) a due-date change needs a reason, is made by the risk owner or a Security Analyst, and is recorded with the old and new dates; (5) an unrelated user gets the refusal a missing record gets for any treatment read or update, and a treatment owner who is not the risk owner is refused any change to a risk field, the plan or the due date, in the API and the UI.
  - Trace: PD-5, O1 · Phase 20 (G-16, reversing Phase 7 D-04 in part)

### Administration

- [ ] **ADMIN-05**: Reference records read as real content.
  - Acceptance: (1) system and asset owners show by name, and the lists show owner and criticality columns; (2) controls carry meaningful names (decision 15: the framework's own control name where it has one, otherwise a short descriptive title in CSRM's words, with the source reference kept), and seeded Risk Types carry user-facing descriptions.
  - Trace: O2 · UAT-007, UAT-053 · Phase 10
  - Remainder (2026-09-27, Phase 10 plan check): the Information Asset owner needs a content-type change and moves to Phase 22 with a contract-gap record. Control titles are decided (decision 15) and stay in Phase 10.
  - Partial by decision (2026-10-03, Phase 10 verified): the system owner by name with the owner and criticality columns, the APP titles, the 386 control titles and the Risk Type descriptions are delivered. The Information Asset owner (criterion 1, asset half) stays open, and Phase 22 closes ADMIN-05.
- [ ] **ADMIN-06**: Systems, assets, controls and Risk Types show where they are used.
  - Acceptance: (1) each record has a "Used in" panel (requests, open risks by residual rating, control implementations by status) whose figures open the filtered list; (2) the lists show usage counts.
  - Trace: O2 · UAT-047 · Phase 20
- [ ] **ADMIN-07**: An Admin role owns reference data and product configuration, and Security Analysts keep read access.
  - Acceptance: (1) a user with the Admin role manages Risk Types, Controls, Information Systems and Information Assets and their imports, and a Security Analyst without it can read but not change them, enforced in Strapi; (2) the Admin maintains the configuration (the likelihood and consequence scales, the rating bands, the risk appetite with its acceptance authority and review intervals, divisions and business units, the active Risk Types, shared register views, the peer-review threshold and the AI data policy), and the forms, the AI and release readiness use it; (3) direct URLs to Admin screens show the permission state to everyone else; (4) the Admin holds no Security Analyst rights by default, and every configuration change records who, when, and the old and new values (decision 1, G-1).
  - Trace: R1, O2 · UAT-061 · Phase 22
- [ ] **ADMIN-08**: The Admin sees who holds which CSRM role, and any role change is audited.
  - Acceptance: (1) a read-only view lists role holders from the identity records and exports for an access review; (2) role assignment stays in the identity platform unless the operator approves it in CSRM with dual control and audit (decision 1).
  - Trace: R1 · UAT-061 · Phase 22

### Workflow Experience

- [x] **UX-06**: Actions, refusals, timestamps and copy tell each actor the truth in their own terms.
  - Acceptance: (1) offered actions match what Strapi allows, and a refusal states its real reason in plain words; (2) an in-flight or recent generation job shows when the analyst returns to the request, in place of a new Generate action; (3) revision timelines show the viewer's local time and name questions by their text; (4) interface copy avoids back-end and internal terms; (5) a Requestor who opens an analyst route sees the permission state, and analyst-only actions never show to a Requestor.
  - Trace: Q5, R3 · UAT-024, UAT-036, UAT-041, UAT-054, UAT-062 · Phase 10
- [ ] **UX-07**: The sidebar is divided into sections named by job, with labels that match page headings and counts on items that hold work.
  - Acceptance: (1) each actor's sidebar follows `REPORT.md` §5 (Requestor: a New request button, Home and My work; Security Analyst: Home, Assessment work, Oversight, Reference data and a collapsed section for their own requests); (2) every label matches its page heading, review items show counts, and the phone drawer shows the same sections.
  - Trace: Q2 · UAT-002 · Phase 11
- [ ] **UX-08**: Each actor lands on one Home that leads with their next actions, on a phone as on a desktop.
  - Acceptance: (1) the Security Analyst lands on their queue, deadlines and alerts, with their own requests secondary; (2) the Requestor's Home separates "Needs your action" from "With the Security Analyst", naming who holds each item, and shows the action panel first at 375px; (3) on a phone the request's lifecycle reads "Step n of m" with the next action and expands on demand.
  - Trace: Q1, Q5 · UAT-001, UAT-003, UAT-004, UAT-038 · Phase 11
- [ ] **UX-09**: Review lists carry the columns needed to triage, figures open their records, and statuses use user terms.
  - Acceptance: (1) the request queue shows requestor, assessment type, criticality, due date and age, and the assessment list shows request title, risk count and highest residual rating; (2) every dashboard and report figure opens its filtered list, and assessments can be searched by request title; (3) a request whose assessment is released reads "Released", with the stored value unchanged (decision 16).
  - Trace: F2, Q1, Q5 · UAT-035, UAT-048, UAT-065 · Phase 11
- [ ] **UX-10**: Quick find opens any record the user may read by number or title.
  - Acceptance: (1) Ctrl+K, or ⌘K on a Mac, and a visible search control in the header open a quick-find dialog that searches requests, questionnaires, assessments and risks by number or title as the user types; (2) results show only records the user may read, through the existing server-side list searches, and open with Enter; (3) the dialog follows the dialog and combobox keyboard patterns at 375px and 1440px.
  - Trace: Q2, Q5 · UAT-048 · Phase 11 (G-5)

### Dashboards and Reports

- [ ] **DASH-03**: Exposure figures state their scope and separate released risks from risks still under assessment.
  - Acceptance: exposure widgets and reports default to released risks, show "under assessment" separately and say so on the widget, and accepted risks are marked (decision 11).
  - Trace: Q1 · UAT-060 · Phase 11
- [ ] **DASH-04**: Each audience has a metric set that answers its questions, with every figure opening its records.
  - Acceptance: (1) Requestor, Security Analyst and risk-manager metric sets as in `REPORT.md` §4, each widget stating its scope; (2) failed AI jobs in the last seven days are visible to analysts.
  - Trace: Q1 · UAT-059 · Phase 21
  - Amended (2026-10-01, Phase 21 context D-17, D-21): management metrics are for human Security Analysts only, and first-line users keep their personal figures; a failed AI job is a failed or interrupted run in Phase 12's run record, grouped by job.
- [ ] **DASH-05**: Trends, a heat map, cycle times and ageing come from recorded history.
  - Acceptance: (1) open released risks by residual rating over 12 months; (2) a likelihood-by-consequence heat map of inherent and residual positions for the filtered set, readable without colour (decision 13: accessible SVG components with a data-table alternative); (3) median and 90th-percentile time per stage linking to the slowest items, and queue ageing bands.
  - Trace: Q1 · UAT-059 · Phase 21

### Integration and Assurance

- [ ] **INT-05**: Both AI operations receive one reviewable assessment context built from everything the request holds.
  - Acceptance: (1) the context holds the request fields (regulatory requirements and third-party details included), the selected systems and assets with classifications, the notes marked as changing the AI inputs once COLLAB-01 exists, and each question's text with its answer; (2) the analyst can see the context a run used, and Requestor text is passed as quoted, untrusted data; (3) drafted risks pre-fill impacted system, asset and classification from the context for the analyst to confirm; (4) generation is refused, with a plain message, when the request's data classification is above the provider's approved ceiling, and each run records its context summary (G-3).
  - Trace: F1, F3, F6 · UAT-030 · Phase 12
  - Amended (2026-10-01, Phase 13 context): the context holds the notes marked as changing the AI inputs, not every note.
- [ ] **INT-06**: AI-proposed content is marked until an analyst accepts or edits it, and cites its sources.
  - Acceptance: (1) each AI-proposed field shows a proposed marker until accepted or edited, and the questionnaire and assessment show provider, time and initiating analyst; (2) each proposed statement cites the answers and request fields it used, and uncited claims are flagged; (3) the Requestor's released view says that AI assisted and a Security Analyst reviewed; (4) a run record keeps each generation's instruction, context summary, provider and outcome for Phases 15–17.
  - Trace: F6, Q5 · UAT-032, UAT-042 · Phase 12

### Notifications

- [ ] **NOTIFY-01**: Users are told in the app when work waits for them.
  - Acceptance: (1) an in-app notification centre with an unread count and per-user read state tells people when work waits for them: assignment, questionnaire released and submitted, risks released for response (to the Requestor and each nominated risk owner), response submitted, acceptance requested and decided, assessment released and request closed, and new notes; Phase 19.1 builds the centre with the events that exist before Phase 17, and Phases 17, 17.1, 17.2 and 20 add theirs to it (G-18, G-19); (2) each notification opens the record it is about, within what the person may read, and nobody is told about a record they may not read (decision 18).
  - Trace: F8, PD-1 · UAT-025 · Phase 19.1 (moved from Phase 17 by G-19, 2026-10-01)
  - Amended (2026-10-01, G-18): nominated risk owners and executive approvers receive notifications, release now also closes the request, and later phases' events join the same centre.
  - Amended (2026-10-01, G-19): the centre moves to Phase 19.1 with the events that exist before Phase 17, and Phases 17, 17.1, 17.2 and 20 add theirs.
  - Amended (2026-10-01, Phase 17.1 context D-54): peer approval requested and peer approval given join Phase 17.1's events.
  - Amended (2026-10-01, Phase 20 context): Phase 20 adds the `treatment-assigned` and `decision-review-not-confirmed` kinds.
- [ ] **NOTIFY-02**: Users receive due-date reminders in the app and by email.
  - Acceptance: (1) treatments due within seven days or overdue remind their treatment owner, acceptance and exemption reviews due remind the risk owner or executive approver who decided, an assessment's next review due reminds the assigned analyst, and a decision waiting more than seven days reminds its decider; overdue treatments escalate to the assigned analyst and the risk owner; (2) email goes through Strapi's email plugin, with a capture provider in development and tests so nothing leaves the machine, and the production mail provider is deployment configuration (decision 18).
  - Trace: O1, Q1, PD-5 · UAT-046, UAT-058 · Phase 20
  - Amended (2026-10-01, G-16, G-18): each reminder names its recipient, a decision left waiting is reminded, and escalation reaches the risk owner as well as the assigned analyst.
  - Amended (2026-10-01, Phase 20 context D-17, D-25 to D-28): reminders cover due decision reviews, which their holder confirms or declines; deliveries are recorded once each, and emails carry the record number only.
- [ ] **NOTIFY-04**: Participants and analysts are told in the app about contest points and returned assessments.
  - Acceptance: (1) a contest point raised notifies the assigned analyst, an answer notifies the point's raiser, and an assessment sent back notifies the assigned analyst and the other participants; (2) each notification opens the point or the assessment, and nobody is told about a point on an assessment they do not take part in; (3) these events stay in the app (decision 18).
  - Trace: PD-3 · Phase 17.2 (G-18)
  - Amended (2026-10-01, Phase 17.2 context D-17): a reply to a contest point notifies the point's raiser, the assigned analyst and any other analyst who answered the point (`contest-point-replied`).

### CSV Import and Export

- [ ] **CSV-01**: Registers, lists, queues, alerts and reports export to CSV and XLSX.
  - Acceptance: (1) exports follow the current filters, search and sort, default to the visible columns with a column choice, and are named after the view and date; (2) Strapi scopes each export to what the viewer may read, and a Requestor exports only their own released assessments (decision 12); (3) values starting with `=`, `+`, `-`, `@`, tab or carriage return are neutralised, and CSV is UTF-8 with a BOM; (4) every export is logged with actor, view, filters and row count, and a released assessment prints as an A4 report (decision 12).
  - Trace: Q3 · UAT-049 · Phase 19
- [ ] **CSV-02**: Imports tolerate spreadsheet habits and return files a user can fix and re-import.
  - Acceptance: (1) headers match case-insensitively and by display label, and unknown columns are ignored with a warning that names them; (2) a Windows-1252 file gets a "Save as CSV UTF-8" explanation, Yes/No, Y/N and TRUE/FALSE are accepted for flags, and an explicit clear token empties a field; (3) templates carry display headers, an example row and allowed values (CSV, and XLSX with a notes sheet), and error reports are the original rows plus an Issues column, with a BOM.
  - Trace: Q3 · UAT-051 · Phase 19
- [ ] **CSV-03**: A near-match name in an import needs an explicit decision.
  - Acceptance: case- or whitespace-only matches show as "Matched by similar name" and are neither created nor updated until the user chooses.
  - Trace: Q3 · UAT-052 · Phase 19

## Future Requirements

- **INT-02** (carried from v1.0): the application uses Keycloak authorization-code authentication, and Strapi validates token issuer, audience, signature, expiry and effective CSRM authorisation server-side.
  - Status (2026-10-01): implemented and flag-gated, and off in development. The web's OIDC sign-in (ADR 0003, quick task 260929-u0w, with the avatar menu of quick task 260930-iei) runs only with `CSRM_AUTH_OIDC_ENABLED=true`. Strapi's access-token verification (ADR 0004, `b6000d0`) runs only with `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true`, and provisioning (ADR 0002) only with `IDAMBOX_KEYCLOAK_PROVISIONING=true`. Development, the unit suites and Playwright keep all three off and use the development identity bridge (`CSRM_DEV_IDENTITY=true`).
  - Rule for v2.0 work: every new authorisation rule is enforced in Strapi against the resolved IdamBox User, so the development bridge and a Keycloak-verified user behave identically. Authorisation never branches on the auth mode, and the OIDC tests stay green.
  - Open: enabling it in a deployment needs a Keycloak environment, the realm changes of ADR 0004 and every IdamBox User linked through `externalSubject`.
- **COLLAB-03**: comments and activity history on questionnaires and assessments. Notes on requests are COLLAB-01. Contest points (COLLAB-04) belong to acceptance rounds and are not general comments, so this stays future (G-15).
- **NOTIFY-03**: notification preferences per user, and further channels.
- **TENANT-01**: customers can administer tenant-specific branding and multi-tenant configuration.
- **WORKFLOW-01**: administrators can configure no-code workflow definitions.
- **999.1**: local LLM evaluation and optimisation (backlog, from v1.0 Phase 06.10).

## Out of Scope

| Feature | Reason |
|---|---|
| Automatic AI assessment release | Human analyst review and release are mandatory. |
| Real-time collaborative editing | Normal save/edit flows meet the first-milestone need. |
| Native mobile app | Responsive web application is the first delivery. |
| Full GRC suite and custom ML training | Not part of the core assessment workflow. |
| Frontend API facade | The Strapi OpenAPI contract is the production service contract. |
| Notification channels beyond the app and email | NOTIFY-01 and NOTIFY-04 are in-app, and NOTIFY-02 adds email reminders in Phase 20 (decision 18, G-18). Further channels and per-user preferences are NOTIFY-03. |
| Role assignment inside CSRM (next wave) | Role assignment stays in the identity platform unless the operator approves it with dual control and audit (`REPORT.md` §9, decision 1); Phase 8 removed the IAM routes deliberately. |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| REQ-07, QUES-08, QUES-09, ASSESS-06, ASSESS-07, UX-06 | Phase 10 | Complete (plan 10-23; phase verified 2026-10-03) |
| ADMIN-05 | Phase 10; the Information Asset owner moves to Phase 22 (Remainder) | Partial by decision (Phase 10 verified 2026-10-03; Phase 22 closes it) |
| UX-07, UX-08, UX-09, UX-10, DASH-03 | Phase 11 | Pending |
| INT-05, INT-06, ASSESS-08, QUES-10 | Phase 12 | Pending |
| REQ-08, COLLAB-01 | Phase 13 | Pending |
| COLLAB-02 | Phase 14 | Pending |
| QUES-11, QUES-12 | Phase 15 | Pending |
| ASSESS-09, ASSESS-10 | Phase 16 | Pending |
| ASSESS-11, ASSESS-12, ASSESS-13, ASSESS-21, ASSESS-22, ASSESS-23 | Phase 17 | Pending |
| ASSESS-14, ASSESS-20, ASSESS-24, ASSESS-25 | Phase 17.1 | Pending |
| COLLAB-04, ASSESS-26, NOTIFY-04 | Phase 17.2 | Pending |
| ASSESS-15, ASSESS-16, ASSESS-17, ASSESS-18, ASSESS-19 | Phase 18 | Pending |
| CSV-01, CSV-02, CSV-03 | Phase 19 | Pending |
| NOTIFY-01 | Phase 19.1 | Pending |
| RISK-03, RISK-04, RISK-05, RISK-06, ADMIN-06, NOTIFY-02 | Phase 20 | Pending |
| DASH-04, DASH-05 | Phase 21 | Pending |
| ADMIN-07, ADMIN-08 | Phase 22 | Pending |

**Post-demo asks** (`NEXT-WAVE-DECISIONS.md`, Post-demo decisions):

| Ask | Requirements | Phase |
|---|---|---|
| PD-1 The nominated risk owner and the Requestor view the assessment | ASSESS-21, ASSESS-22; amended ASSESS-11, ASSESS-12, NOTIFY-01 | 17; 19.1 |
| PD-2 Acceptance after the final assessment closes the request | ASSESS-24, ASSESS-25; amended ASSESS-14, ASSESS-20 | 17.1 |
| PD-3 The owner contests anything, and the analyst edits everything again | COLLAB-04, ASSESS-26, NOTIFY-04; the recall and voids of ASSESS-24 | 17.2; 17.1 |
| PD-4 Acceptance or a treatment plan | amended ASSESS-20; ASSESS-23, the people search it uses | 17.1; 17 |
| PD-5 Treatment plans are tracked | RISK-06; amended RISK-04, RISK-05, NOTIFY-02 | 20 |

**Coverage:**

- v2.0 requirements: 55 total (46 from the product gap UAT and 9 from the post-demo asks), mapped to Phases 10–22, 17.1, 17.2 and 19.1: 55, unmapped: 0 ✓
- Product gap UAT findings: 65, each closed by exactly one phase ✓
- Post-demo asks: PD-1 to PD-5, each traced to at least one requirement, a phase and its success criteria ✓

---
*Requirements defined: 2026-09-27*
*Last updated: 2026-10-03 — Phase 10 complete: six requirements complete, and ADMIN-05 partial by decision until Phase 22.*
