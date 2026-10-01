# Phase 20: Oversight registers and post-release tracking - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`, one pass. Every gray area took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005 monitoring and review; ISO/IEC 27001:2022 clauses 6.1.3 f, 8.3 and 9.1) at the G-4 premium bar, consistent with `.planning/NEXT-WAVE-DECISIONS.md` (decisions 1 to 18, G-1 to G-20). Grounded in:
- the product gap UAT (UAT-045, UAT-046, UAT-047 and UAT-058 in `.planning/uat/product-gaps/FINDINGS.md`) and the post-demo ask PD-5;
- the orchestrator's seeds, each confirmed or corrected (last section);
- the planned outputs of Phases 11 (plans 11-15 and 11-17, the due-state switch point), 13, 14, 16, 17, 17.1, 17.2, 18, 19 and 19.1 (each CONTEXT with its Orchestrator Confirmations, and RESEARCH where it exists);
- a read of today's code (`<code_context>`).

There is no SPEC.md, no todo matched (`todo.match-phase 20`: 0) and no discuss hook is active. The discussion log is `20-DISCUSSION-LOG.md`. Following stage2-rules §3a, upstream decisions are cited by number, not restated.

**Plans are written ahead.** Phase 20 executes after Phases 10 to 16, 19, 19.1, 17, 17.1, 17.2 and 18 (order 10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22). Its plans are written against today's code plus those phases' planned outputs, name the earlier plans they rely on (Phase 11's 11-15 and 11-17 for `treatment-due-state.ts`; the plans of 14, 16, 17, 17.1, 17.2, 18, 19 and 19.1 once written), and get a fresh plan check just before execution.

<domain>
## Phase Boundary

After release the assessment stays the immutable record it was, while its risks live on in the register. Each treated risk's treatment is tracked by its owners from Not Started through In Progress to Complete on evidence; the server marks it Overdue by one date rule; a Security Analyst re-rates residual risk and closes the risk, each as a recorded review; every change lands in the risk's history. Accepted risks and exceptions are reviewed by whoever holds their authority. Risk, treatment and control owners see exactly their own records in "My risks and treatments". Risk managers get registers by assessment type, and reference records that show where they are used. People are reminded of due work in the app and by email from one daily run. The phase closes UAT-045, UAT-046, UAT-047 and UAT-058, answers PD-5, and completes the post-demo journey.

### In scope
- What changes after release and what stays frozen, the released record kept as released, and when tracking starts (D-05 to D-07).
- The treatment lifecycle: progress and the server-written status, the one due-state rule switched to `treatmentResolveDate`, completion on evidence, progress notes, and date, plan and owner changes with reasons (D-08 to D-12).
- Who acts after release (D-13); the analyst's residual review, closure and control delivery (D-14 to D-16); decision reviews (D-17); evidence files on Phase 14's pipeline (D-18); the post-release history (D-19).
- "My risks and treatments", the owner risk page, Home and sidebar items, and their refusals (D-20, D-21).
- Registers, lists and reports by assessment type, division and business unit, with suggestions, and the register's saved views (D-22, D-23); "Used in" panels and usage counts (D-24).
- Reminders and escalations through Phase 19.1's service, the daily run, the delivery record and email with a capture provider (D-25 to D-28).
- Two contract-gap records and their approval checkpoint, the interface, the tests, fixtures and the final slice of `apps/csrm/e2e/risk-owner-journey.spec.ts` (D-01 to D-04, D-29, D-30).

### Out of scope
- A new decision after release (Accept to Treat, or the reverse), a re-assessment that supersedes a released assessment, and changing the risk owner or executive approver after release (`<deferred>`).
- Adding or removing control implementations after release; control owners recording delivery themselves.
- Admin-owned lists for divisions and business units, Admin ownership of shared views and of the reminder policy (Phase 22); notification preferences, digests and other channels (NOTIFY-03); trends and stage times (Phase 21).
- Any AI operation after release, a new IdamBox Role, Keycloak, and live AI in any suite.
</domain>

<requirements>
## Requirements and Success Criteria This Phase Owns

| Requirement | Acceptance (REQUIREMENTS.md, abridged) | Decisions |
|---|---|---|
| **RISK-03** Type, division and business unit as register columns, filters, saved views and report dimensions | (1) the register, the review queues and the assessment list show and filter by type, with "Project" and "BAU" saved views; (2) the exposure and throughput reports and the analyst Home break down by type | D-22, D-23 |
| **RISK-04** Released risks track treatment to closure without reopening the assessment | (1) the treatment owner updates status, notes and evidence; the risk owner also changes owner, plan and due date with reasons; an analyst does all of these, re-rates residual risk and closes the risk as recorded reviews; statements, inherent ratings and the decision record frozen; (2) the released assessment unchanged, every change in the history with actor, time, old and new values; (3) tracking starts from the owner's Treat decision, or from the released fields for earlier releases | D-05 to D-16, D-19 |
| **RISK-05** Risk, treatment and control owners see what they own | (1) "My risks and treatments", scoped by Strapi, with due-soon and overdue flags, decisions and executive approvals awaiting them, decisions to make again, decisions due for review, and nobody else's; a risk owner sees each of their risks' treatments; (2) owners update progress where RISK-04 allows; (3) another person's risk or treatment gets the refusal a missing record gets, by any route | D-13, D-17, D-20, D-21 |
| **RISK-06** A recorded lifecycle to completion on evidence, Overdue by date | (1) people set Not Started, In Progress, Complete; the server sets Overdue in a daily run and on any update; (2) every read, export, Home figure, alert, report and reminder derives due soon and overdue by one rule from one date; Overdue leaves only on completion or a date change, returning to the last progress status; (3) completion needs an evidence statement and records who and when; notes append-only and attributed; files through Phase 14's service; (4) a date change needs a reason, by the risk owner or an analyst, recorded old and new; (5) an unrelated user refused as a missing record; a treatment owner refused any risk field, the plan or the due date, in the API and the UI | D-07 to D-13, D-18, D-21 |
| **ADMIN-06** Systems, assets, controls and Risk Types show where they are used | (1) a "Used in" panel (requests, open risks by residual rating, control implementations by status) whose figures open the filtered list; (2) usage counts on the lists | D-24 |
| **NOTIFY-02** Due-date reminders in the app and by email | (1) treatments due within seven days or overdue remind their treatment owner; acceptance and exemption reviews due remind the decider; an assessment's next review due reminds the assigned analyst; a decision waiting more than seven days reminds its decider; overdue treatments escalate to the assigned analyst and the risk owner; (2) email through Strapi's email plugin, a capture provider in development and tests, production mail as deployment configuration | D-25 to D-28 |

**ROADMAP success criteria (Phase 20), each planned in the UI and the API with its negative cases:**
1. "Project" and "BAU" saved views; exposure reports by type. (D-22, D-23)
2. The journey's treatment moves Not Started → In Progress → Complete with an evidence statement, recording who and when; the analyst re-rates and closes with a reason; the released assessment is unchanged; the history shows each change. (D-06, D-08, D-10, D-14, D-15, D-19)
3. A risk owner sees their risks, their treatments and the decisions awaiting them or due for review; a treatment owner sees their treatments with due dates; neither sees anybody else's. (D-17, D-20, D-21)
4. A system's page lists its requests and open risks by residual rating. (D-24)
5. Due within seven days: an in-app reminder and an email in the development capture mailbox; past the resolve date: Overdue in the register, Home, alerts and exports, escalated to the assigned analyst and the risk owner; a date change with a reason clears it; a decision waiting more than seven days reminds its decider in the app and by email. (D-08, D-09, D-12, D-25 to D-28)
6. An unrelated user gets the refusal a missing record gets for another person's treatment, by any route; a treatment owner cannot change a risk field, the plan or the due date; completing without evidence is refused. (D-10, D-12, D-13, D-21)
7. Playwright, final slice: the whole post-demo journey passes end to end to the treatment tracked to Complete, with the negative cases at every step. (D-30)

**Closes:** UAT-045, UAT-046, UAT-047, UAT-058. **Ask:** PD-5 (RISK-06, with RISK-04, RISK-05 and NOTIFY-02 amended). **Intent:** O1, O2, Q1.
</requirements>

<decisions>
## Implementation Decisions

### Scope and contract boundary

- **D-01:** The content-type changes are exactly these, through two contract-gap records and their checkpoint (`<contract_gaps>`), before any schema file changes. Names are proposals the records fix.
  1. **On `CsrmRisk`** (record 1), current facts:
     - `treatmentProgress` (closed: `Not Started`, `In Progress`, `Complete`): what a person last set (D-08). The JDL's `treatmentStatus` becomes server-maintained.
     - Completion: `treatmentCompletedAt`, `treatmentCompletedBy` (many-to-one `IdamBoxUser`) and `treatmentEvidence` (text, the evidence statement) (D-10).
     - Closure: `closedBy` (many-to-one `IdamBoxUser`) and `closureReason` (text), beside the JDL's `closureDate` (D-15).
     - Decision review: `decisionReviewDate` (date) and `decisionReviewOutcome` (closed: `confirmed`, `not-confirmed`) (D-17).
  2. **`CsrmTreatmentEvidence`** (record 1): one file on one released risk's treatment (D-18).
  3. **`CsrmReminderDelivery`** (record 2): one row per reminder per recipient per period (D-27).

  Vocabulary-only amendments: Phase 16's history kinds and sources (D-19), Phase 18's view keys (D-23), Phase 19.1's kinds and parts (D-25). Nothing changes on `CsrmNotification` (19.1 D-33), `CsrmRiskDecision` (frozen after release, 17.1 D-46), the assessment, the request or the control implementation. **Reversibility:** one-way - new tables and columns holding audit, authority and delivery facts; undoing them needs a data migration.
- **D-02:** Every new or changed operation follows the chain of 17.1 D-02 and 18 D-02, including a matrix row per new route stating all seven callers (17 D-75), with the executive approver's outcomes proven by integration tests through 17.1's harness identity (17.1 D-68). The catalogued, unserved `POST /api/v1/risks/{riskId}/close` ("nothing closes a Risk yet") becomes served. Its Function, `function.risk_register.risk_details`, is held by the agent role, so its FunctionAPI moves into a human-only API Function with its name, URL and description kept (19 D-13's move). Every new operation joins `SERVICE_IDENTITY_REFUSED_OPERATIONS`, and every analyst-only one also joins `HUMAN_ANALYST_ONLY_OPERATIONS`. No new IdamBox Role.
- **D-03:** The API changes are these groups, and no others. Paths are proposals within these families; research fixes them.
  1. **Owner reads:** the "My risks and treatments" list and its summary (for Home and the sidebar); the owner risk read (projection, tracking facts, notes, evidence list, post-release history and the viewer's allowed acts); the list's export through Phase 19's module (19 D-05).
  2. **Treatment acts on a released risk:** set progress, add a progress note, complete with evidence, reopen, and change the resolve date, the plan or the treatment owner with a reason. Each act carries the values it was made from (18 D-14's compare-and-set; `TREATMENT_CHANGED` on a mismatch).
  3. **Evidence files:** list, upload, download, remove and restore, in Phase 14 D-04's family shape under the risk.
  4. **Analyst acts:** the residual review, close and reopen (the catalogued close), and control implementation delivery after release.
  5. **Decision review:** confirm, or do not confirm (D-17).
  6. **Registers:**
     - the register's filters and projection: type, division and business unit through the request, control, Risk Type, review state and progress;
     - the queue's and assessment lists' filters: type, division and business unit, plus system and asset on the queue;
     - the reports' type breakdown and filters, and the dashboard summary by type;
     - register views through Phase 18's operations under the new key.
  7. **Suggestions:** the division and business-unit values in use.
  8. **Usage reads:** "Used in" for systems, assets, controls and Risk Types, and usage counts on their lists.
  9. **Release and close (17.1 D-42) gains one write:** the `treatment-assigned` notification (D-25). Nothing else in it changes.
  10. **Closed conflict reasons** join Phase 10's vocabulary (for example `RISK_NOT_RELEASED`, `TREATMENT_NOT_TRACKED`, `RISK_CLOSED`, `TREATMENT_EVIDENCE_REQUIRED`, `TREATMENT_FIELD_NOT_PERMITTED`, `TREATMENT_CHANGED`, `NOT_RISK_PERSON`, `ACTOR_IS_TREATMENT_OWNER`, `REVIEW_NOT_DUE`, `REVIEW_AUTHORITY_MISSING`). They reuse `OWN_REQUEST` (13), `ASSESSMENT_NOT_MUTABLE` (16), `OWNER_NOT_ELIGIBLE` and `ACTOR_IS_RISK_OWNER` (17), `ACTOR_IS_EXECUTIVE_APPROVER` and `DECISION_NOT_PERMITTED` (17.1), and Phase 14's file and Phase 18's scale reasons.

  The reminder run has no public operation (D-26). **Reversibility:** costly - published operations, fields, filters, vocabularies and error codes.
- **D-04:** What this phase reverses or narrows, each named in its record:
  - **Phase 7 D-04, in part (G-16):** the server now writes Overdue, and the governing date moves (D-08, D-09). `phase-07-derived-insights.md` items 1 (post-release tracking) and 6 (the stored "Overdue") are amended.
  - **Phase 11 D-43, for due states only.** The one rule gives a due state only to tracked treatments (D-07, D-09), so risks under assessment leave "Treatments due", the due values of the `dueState` filter and the treatment alerts. Every other population of Phase 11 is unchanged. Basis: tracking starts at release (G-16; RISK-04 criterion 3), and a pre-release treatment is the analyst's recommendation (17.1 D-20, D-43), already shown without due markers (17.1 D-28; 18 D-07).
  - **v1's read-only released risk (UAT-046):** released risks change through this phase's operations only, and every existing write path still refuses them (D-05).
  - **Phase 16 D-21 and 17.2 D-15:** the risk's people read the post-release rows of its history (D-19). Pre-release history stays as those phases decided.
  - **17.1's deferral** of a notification to a treatment owner named in a Treat decision is settled: `treatment-assigned` (D-25).
  - **Settled here:** the fallback recipient that 13 D-11 left open (D-25), and the maintenance of the exception fields that 17.1 D-44 handed on (D-14, D-15, D-17).

### After release: the record and the living risk (decision 9; RISK-04)

- **D-05:** The released assessment stays immutable through every existing path. The assessment, its rounds, decisions and contest points stay as released, and every pre-release write route keeps refusing a released assessment with `ASSESSMENT_NOT_MUTABLE`: risk update and create, Phase 18's bulk save and import, withdrawal, control implementation create, update and removal, and AI operations. A released risk changes only through this phase's operations (D-03 items 2 to 5), each in one transaction under the risk's row lock, and only in:
  - the treatment (progress, notes, evidence, completion, resolve date, plan, treatment owner);
  - the residual review (residual likelihood, consequence, rating with 18 D-22's override reason, rationale, control effectiveness);
  - closure;
  - its control implementations' delivery facts (D-16);
  - the exception and decision review facts (D-14, D-17);
  - the server-written status (D-08).

  Frozen: statements, cause, impact, category, classification, impacted system and asset, Risk Type, inherent ratings, the risk owner, the executive approver and the decision record (decision 9: a changed statement is a new risk). **Reversibility:** costly - one rule every post-release path reads.
- **D-06:** The released record stays as released.
  - **The baseline:** the first post-release change to a risk appends, in its own transaction, one `release-baseline` row to Phase 16's risk history. It holds every field D-05 lets change, and the delivery facts of the risk's control implementations, as they stood at release. Nothing writes a second baseline.
  - **The released reads** take those fields from the baseline when one exists, in one query per assessment, and from the live risk otherwise (unchanged since release by construction). They are: the participant and analyst released views with 17.1 D-51's decision block, Phase 18's read-only table on a released assessment, and Phase 19's released export and A4 report. Risks released before this phase need no migration.
  - **The living reads** use the live values: the register, "My risks and treatments", the owner risk page, alerts, reports and their exports.

  **Reversibility:** costly - the released record's fidelity rests on it.
- **D-07:** Tracking starts at release (RISK-04 criterion 3).
  - **A tracked treatment** is a released, open (no `closureDate`), non-withdrawn risk whose `treatmentAction` is `Treat`. It starts from its owner's Treat decision for releases under the acceptance flow (17.1 D-43), and from its released treatment fields for earlier releases.
  - **An accepted risk** has no treatment (G-16): treatment acts are refused (`TREATMENT_NOT_TRACKED`), and its decision review applies (D-17).
  - **Before release** a risk has no tracked treatment: its treatment fields are the analyst's recommendation (17.1 D-20), and every treatment act is refused (`RISK_NOT_RELEASED`).
  - **Earlier releases:** until first written, `treatmentProgress` reads as the stored `treatmentStatus` when that is Not Started, In Progress or Complete, and as Not Started when it is Overdue or empty, because nothing recorded says work began. No stored value is rewritten.

### The treatment lifecycle (G-16; RISK-06)

- **D-08:** People set progress; the server sets the status.
  - **Progress:** `treatmentProgress` holds what a person last set: Not Started, In Progress or Complete.
  - **The status:** the JDL's `treatmentStatus` derives from it by the one rule (D-09). It is Complete when progress is Complete, Overdue when the governing date has passed and the treatment is not complete, and the progress otherwise. An overdue treatment therefore leaves Overdue only by completion or a recorded date change, and then shows its last progress status, by construction (G-16). Someone may record In Progress while it is Overdue; it shows Overdue until the date moves or it completes.
  - **Writes:** the server writes the derived value in the daily run (D-26) and in the same transaction as every treatment act, under the risk's lock, with a history row when it changes (D-19).
  - **Reads:** every read (projections, filters, counts, exports, reminders) derives it by the same rule instead of reading the column, so a read between runs is never stale.
  - **Phase 7's untreated rule** (`critical-residual-risk-untreated`, 07 D-31) reads progress, never the stored Overdue.

  **Reversibility:** costly.
- **D-09:** The one rule in `apps/backend/src/csrm/insights/treatment-due-state.ts` (`deriveTreatmentDueState` and `applyTreatmentDueStatePredicate`, the switch point of Phase 11 plans 11-15 and 11-17) changes once, in both functions together:
  - **Applicability:** only a tracked treatment (D-07) has a due state. Every other risk reads a new state, `not-tracked` (name by research), added to the closed `dueState` vocabulary.
  - **Governing date:** `treatmentResolveDate`, falling back to `targetDate` only when a tracked treatment has no resolve date (G-16).
  - **Order:** not-tracked; complete-or-closed (progress Complete, or the risk closed); no-target-date; overdue (the date before today); due-soon (inside the window); later.
  - **Unchanged:** today is the UTC calendar date every insight rule takes explicitly (`apps/backend/src/csrm/insights/utc-date.ts`, as 17.1-RESEARCH confirms), and the due-soon window stays Phase 11 D-38's 14 days.

  Every consumer follows, with no rule of its own: the register's rows, filters and sorts; the analyst Home's "Treatments due"; the treatment alerts; the treatment-performance report; the owner views and Home items; reminders (D-26); the stored status (D-08); and every export, through its list (19 D-05 and its G-16 seam). A test proves the SQL predicate equals the function over fixtures covering every state. **Reversibility:** costly - a published vocabulary and every due figure.
- **D-10:** Completion on evidence (RISK-06 criterion 3).
  - **Mark complete** needs an evidence statement saying what shows the treatment is done (plain text, required, at most 2,000 characters); files are optional (D-18). It sets progress Complete and records `treatmentCompletedAt`, `treatmentCompletedBy` and `treatmentEvidence`, with a history row.
  - **Without an evidence statement** it is refused (`TREATMENT_EVIDENCE_REQUIRED`).
  - **Reversal:** the completion form is its own confirmation, and an Undo toast reverses it at once (G-4). After that, reopening (back to In Progress) needs a reason and clears the completion facts, which the history keeps. The treatment owner, the risk owner and a Security Analyst may reopen while the risk is open.
  - **Completion closes nothing:** the analyst reviews and closes (D-14, D-15).
- **D-11:** Progress notes (RISK-06 criterion 3).
  - **What:** plain text of 1 to 2,000 characters, append-only, attributed with the author's part, shown in local time, never edited or deleted, never rendered as HTML or Markdown.
  - **Where:** each note is a `progress-noted` row in Phase 16's risk history, its text in the row's text field as the amendment defines, so a treatment's notes and changes read as one timeline.
  - **Who:** the treatment owner, the risk owner and Security Analysts, while the risk is open. A note may carry evidence files (Phase 14 D-17's posture).
- **D-12:** Date, plan and owner changes (RISK-06 criterion 4; G-16).
  - **Who:** the risk owner and a Security Analyst change the resolve date, the plan and the treatment owner, each with a reason (1 to 500 characters, Phase 16's reason parser), recorded with the old and new values.
  - **Rules:** a new resolve date is after today, within the horizon 17.1 D-28's research sets. A new treatment owner is an eligible person (19.1 D-07), found through the hardened search (G-17), and is told (`treatment-assigned`, D-25).
  - **Effects:** a date change re-derives the status in the same transaction, so an overdue treatment returns to its progress status, and re-arms its reminders (D-26).
  - **The treatment owner** can make none of these changes, and cannot change any risk field (`TREATMENT_FIELD_NOT_PERMITTED`; RISK-06 criterion 5).
  - **Not added:** the executive approver's approval of a change on a High or Critical risk (G-16 names none; deferred).

### Who acts after release (G-16; G-1; G-11; RISK-04, RISK-05)

- **D-13:** The risk's people. One predicate module answers, for a viewer and a released risk, the parts they hold now:
  - `risk-owner` (`riskOwner`);
  - `executive-approver` (the risk's named approver, 17.1 D-01);
  - `treatment-owner` (`treatmentOwner`);
  - `control-owner` (the `controlOwner` of one of its control implementations).

  Parts are current: someone who stops holding one loses its reads, and their entries stay attributed.

  | Act on a released risk | Treatment owner | Risk owner | Executive approver | Control owner | Security Analyst |
  |---|---|---|---|---|---|
  | Read the owner page, notes, evidence and post-release history | ✓ | ✓ | ✓ | ✓ | ✓ (register) |
  | Set progress, add a note, complete, reopen, add evidence | ✓ | ✓ | | | ✓ |
  | Change the resolve date, plan or treatment owner, with a reason | | ✓ | | | ✓ |
  | Residual review, close and reopen the risk, control delivery | | | | | ✓ |
  | Decision review (D-17) | | Low, Moderate | High, Critical | | never (G-14) |

  - **Analyst acts** are human-only and open to any human Security Analyst (decision 10). They are refused to an analyst who raised the request (`OWN_REQUEST`, G-1) or who holds a part on that risk (`ACTOR_IS_RISK_OWNER`, `ACTOR_IS_EXECUTIVE_APPROVER`, `ACTOR_IS_TREATMENT_OWNER`; G-11): nobody reviews or closes their own risk as the second line. An analyst who holds a part acts in that part.
  - **The service identity** is refused every Phase 20 act and read, whatever it holds.

  **Reversibility:** costly.

### Analyst review, closure and control delivery (decision 9; decision 6)

- **D-14:** The residual review. A Security Analyst re-rates a released, open risk as a recorded review:
  - **What:** residual likelihood and consequence on the scale (18 D-20), the derived rating or an override with its reason (18 D-22), a required rationale (`residualRatingRationale`, 1 to 2,000 characters), and optionally the control effectiveness.
  - **The record:** one `residual-reviewed` history row with the old and new values. A review that leaves the rating unchanged is still recorded, with its rationale.
  - **The exception** follows the rating (17.1 D-44's handoff). A review that takes a Critical risk below Critical ends it, clearing `isExempted` and `exemptionReviewDate` in the same row. A review that raises a risk to Critical adds no exception, because only an executive decision grants one (deferred).
- **D-15:** Closure.
  - **Closing:** a Security Analyst closes a released, open risk with a reason (1 to 500 characters) through the catalogued close operation, behind a confirmation (G-4: the risk leaves the open register and its exposure). It writes `closureDate` (the rule's today), `closedBy` and `closureReason`, and one history row.
  - **What closure needs and ends:** it needs no completed treatment (a decommissioned system closes its risks). It ends tracking, the exception, decision reviews and every reminder for the risk, and leaves the treatment's recorded status as it was.
  - **Reopening:** a Security Analyst reopens with a reason. It clears the closure facts, which the history keeps, and tracking resumes from the facts as they stand.
  - Withdrawal stays pre-release (Phase 16), and closure post-release.
- **D-16:** Control implementation delivery after release (UAT-046 expects "control status updated as work happens").
  - **Who and what:** a Security Analyst records the delivery of a released, open risk's control implementation: `controlStatus` (Planned to Implemented or Retired, Existing to Retired), `implementedDate`, `effectivenessRating`, `evidence` and `reviewDate`. Each change is a history row (Phase 16's `control-implementation-updated` kind with the post-release source).
  - **Unchanged after release:** the control, its owner and its due date. No control implementation is added or removed after release. Control owners read theirs (D-13).
  - **Effect on alerts:** Phase 7's `control-implementation-overdue` alert clears once its planned control is recorded implemented or its risk closes (phase-07 item 1, amended).

### Decision reviews (decision 8; G-14; NOTIFY-02; RISK-05)

- **D-17:** A released, open risk with a standing Accept decision, or with an exception (Critical, either choice; 17.1 D-26), is reviewed on its review date.
  - **The date:** `decisionReviewDate` once set, otherwise the completing act's review date (17.1 D-36), read through one function and its SQL mirror, so risks released before this phase need no migration. For an exception it is the exemption review date.
  - **The reviewer** is the person holding the authority the current residual rating needs, read from 17.1 D-58's configuration point: the risk owner for Low and Moderate, and the executive approver for High and Critical. The higher authority's confirmation stands for the delegation, and the owner of a High risk sees "awaiting {approver}".
  - **When:** open from seven days before the date (D-26's lead), and refused earlier (`REVIEW_NOT_DUE`).
  - **The outcomes**, behind a confirmation (G-4: it renews an acceptance):
    - **Confirm**, with a rationale: `decisionReviewOutcome` becomes `confirmed`, and `decisionReviewDate` moves to today plus the appetite's interval for the current rating (12, 6 or 3 months); for an exception, `exemptionReviewDate` moves with it ("Renew exception").
    - **Do not confirm**, with a reason: `decisionReviewOutcome` becomes `not-confirmed`. Reminders to the reviewer stop, the assigned analyst is told (`decision-review-not-confirmed`, D-25), and the risk no longer counts as accepted (Phase 11 D-41's marker, as 17.1 D-52 refined it, excludes it) until a later confirmation or closure.
  - **The record:** each review is a `decision-reviewed` history row. The decision rows stay untouched (RISK-04 criterion 1).
  - **Nobody to review:** where the authority the rating needs has nobody eligible (no approver named, because a residual review raised the rating; or the person inactive), the act is refused (`REVIEW_AUTHORITY_MISSING`), and the page says the Security Analyst must reassess.
  - **Never:** a Security Analyst confirms nothing (G-14). A Treat decision's review date drives no reminder; tracking does.

### Evidence files (Phase 14's pipeline; RISK-06 criterion 3)

- **D-18:** `CsrmTreatmentEvidence` (D-01) is its own entity, because its readers differ from a request's (Phase 14's seam). It carries Phase 14 D-01's file, scan, removal and event-log facts, with no AI facts: evidence never reaches the AI.
  - **Reused unchanged from Phase 14:** the storage port, the content checks, the allow-list and limits (25 MB per file, 20 active files per risk, the lifetime bound), the scanner and quarantine, the download's integrity check and headers, the file-transfer modules and the security event log (14 D-06 to D-15, D-20 to D-25, D-37), and the path-scoped Server Action body limit, which gains the evidence pages.
  - **Upload:** the treatment owner, the risk owner and Security Analysts, while the risk is released and open. The uploader's part is recorded.
  - **Download:** the risk's people and Security Analysts.
  - **Removal** is soft, by the uploader or a Security Analyst, with Undo; restore is by the remover. After closure evidence is read-only.
  - **Retention** follows the risk record: decision 2's seven years after closure, in Phase 14's one configuration point.

### History (RISK-04 criterion 2; Phase 16 seam S-10)

- **D-19:** Every post-release change is a row in Phase 16's risk history, written in the change's transaction, through a dated amendment to its record.
  - **New kinds** (names by research): `release-baseline`; `progress-set`; `progress-noted`; `treatment-completed`; `treatment-reopened`; `treatment-changed` (a date, plan or owner change, with its reason); `status-derived` (the server's Overdue in and out); `evidence-added`, `evidence-removed` and `evidence-restored`; `residual-reviewed`; `risk-closed` and `risk-reopened`; `decision-reviewed`; and `control-implementation-updated` with the post-release source.
  - **New sources:** `post-release`, and `scheduled-run` with no human actor, shown as "CSRM". If Phase 16's schema requires an actor, the amendment makes it optional for that source only.
  - **Readers:** Security Analysts read the whole history (16 D-21). The risk's people read the post-release rows, from the baseline onwards, with names resolved as their own read allows (19.1 D-16's rule), and never the pre-release rows (17.2 D-15 stands).
  - **No gate reads it.** The only read of a value is the released reads' baseline (D-06), never a decision.

### Owner views (RISK-05; G-12; UAT-058)

- **D-20:** "My risks and treatments" (RISK-05 criterion 1), for every actor, analysts included (17 D-28's rule), scoped by Strapi.
  - **The list holds:**
    - every released risk on which the viewer holds a part (D-13): open by default, closed under a filter, each with its parts, residual rating, progress and status, resolve date, due state (D-09) and decision review state;
    - from an assessment's gate on (17 D-23), the viewer's own risks before release, as risk owner or executive approver, with their stage and the acts awaiting them from 17.1's decision state (decide, approve, decide again after a void), each linking to 17.1's decision view.
  - **Filters:** closed filters for part, "needs your action" (pending decision acts, overdue and due-soon treatments the viewer owns, and reviews due), due state, status and stage, with search, sort and pagination. The list exports through Phase 19's module (CSV-01).
  - **The owner risk page** shows the owner projection (the risk fields of 17 D-25 and 17.1 D-47, the decision block, 18 D-22's override reasons, never analyst-only facts), the tracking facts, notes, evidence and post-release history, and the acts the server allows the viewer.
  - **Home:** the Requestor Home's "Needs your action" (Phase 11 D-19, D-20) gains the viewer's overdue and due-soon treatments and reviews due, each opening an equal filtered list (X-10). 17.1 D-50's decision items stay as they are, so nothing counts twice.
  - **The sidebar:** My work gains "My risks and treatments" (Phase 11 D-13), with a count of its own action items (Phase 11 D-10); decisions stay counted on "My risk assessments".
  - **Non-participants:** a treatment or control owner who is not a participant reads only their own risks (G-12).
- **D-21:** Refusals on the owner routes (RISK-05 criterion 3; RISK-06 criterion 5).
  - **Anyone who cannot read the risk at all** (an unrelated user, a former owner, anyone naming a missing risk) gets the refusal a missing record gets, 404, on every owner read, act, evidence route and history read. Persistence is unchanged, and the web shows the not-found page.
  - **A participant who reads the released record but holds no part on that risk** gets 403 `NOT_RISK_PERSON`, because a 404 would be untrue (17 D-24's and 19 D-15's reasoning).
  - **The released view** shows "Track this risk" only on the viewer's own risks.

### Registers by type (RISK-03; UAT-045; decision 11)

- **D-22:** Assessment type, division and business unit, joined through the request:
  - **The Risk Register:** its rows, closed filters and sort (with "Not set" for an empty type), and Phase 19's register export with no export work (19 D-05).
  - **The review queue and the risk assessment lists:** the queue already shows the type (Phase 11) and gains the filter; the assessment lists gain the column and the filter. Phase 18's column chooser offers division and business unit (18 D-10).
  - **The risk-exposure and assessment-throughput reports:** a breakdown by type, and filters for type, division and business unit. The analyst Home's exposure figures break down by type, each opening its filtered register (X-10). Division and business unit stay filters, not breakdowns, while they are free text.
  - **Suggestions:** divisions and business units stay free text with suggestions until Phase 22 (ROADMAP). One suggestions read returns the distinct trimmed values in use, case-folded and bounded, for the request form, the filters and the column chooser. Security Analysts get every value; every other caller gets only the values on requests they raised, so no Requestor learns of another's request. Phase 22's Admin lists replace it (decision 1).
- **D-23:** The register's views use Phase 18's `CsrmSavedView` (18 D-09).
  - **The key:** `risk-register` joins its closed view-key vocabulary, by a dated amendment to `phase-18-saved-views.md`. A definition holds the register's columns, sort and filters, parsed by the register's own closed query parser, so a view never grants data.
  - **Built-in views, in code:** the default, "Project", "BAU", and "Accepted risks": released, open and Accept, with the decision's decider, authority and review date, and the review state. "Accepted risks" is ASSESS-20 criterion 3's view (17.1 D-52).
  - **Analysts' views:** personal views, and views shared with analysts, as Phase 18 rules them; the column chooser and density come with the DataTable.
  - **New filters these views need:** the decision review state (due soon, overdue, not confirmed) and progress.
  - **Sharing:** who may share a register view stays in Phase 18's one place, for Phase 22 (decision 1).

### Where reference data is used (ADMIN-06; UAT-047)

- **D-24:** Each Information System, Information Asset, Control and Risk Type detail page shows a "Used in" panel, and each of their lists shows usage counts:
  - **systems and assets:** the requests in the analyst's scope (never drafts, Phase 11's `queue=all`), and the risks impacting them by residual rating: released and open, with those under assessment shown separately (decision 11);
  - **controls:** control implementations by status, and the risks holding them;
  - **Risk Types:** the type's risks by residual rating.

  Every figure opens its filtered list with an equal total (X-10). The review queue gains system and asset filters, and the register gains control and Risk Type filters. Control implementation figures open the register filtered to the risks holding them, saying so (Phase 11 D-36). The usage reads and counts are analyst reads in their Administration Functions (19 D-13's pattern), so Phase 22's re-grant moves them together. Success criterion 4's "system's page" is the system's detail page with this panel.

### Reminders and email (NOTIFY-02; decision 18; G-7; G-16; G-18)

- **D-25:** Phase 20's kinds join Phase 19.1's vocabulary through its one service, with no schema change (19.1 D-12), the system acting (19.1's seam):

  | Kind (proposed) | When | Recipient (part) | Email | Repeats |
  |---|---|---|---|---|
  | `treatment-due-soon` | a tracked treatment enters its seven-day lead | the treatment owner (`treatment-owner`) | yes | once per resolve date |
  | `treatment-overdue` | it becomes overdue | the treatment owner | yes | every seven days while overdue |
  | `treatment-overdue-escalated` | it becomes overdue | the assigned analyst (`security-analyst`) and the risk owner (`risk-owner`) | yes | once per overdue episode |
  | `decision-waiting` | an act in an open acceptance round has waited more than seven days (17.1 D-33's state, from when the act became pending) | the decider (`risk-owner` or `executive-approver`) | yes | every seven days while it waits |
  | `decision-review-due` | a decision review enters its lead, falls due, and while it is overdue | the reviewer (D-17) | yes | at the lead, on the date, then every seven days |
  | `assessment-review-due` | a released assessment's `nextReviewDate` enters its lead and falls due | the assigned analyst | yes | at the lead and on the date only, because nothing in the app records an assessment re-review (deferred) |
  | `treatment-assigned` | release and close names a treatment owner, or a later change names a new one | the new treatment owner | no: in the app only | an event |
  | `decision-review-not-confirmed` | a reviewer does not confirm (D-17) | the assigned analyst | no: in the app only | an event |

  - **19.1 D-06 holds:** never a service identity or an inactive user (the system has no actor to skip).
  - **One per person per event,** in the part that gives them the most to do: a risk owner who owns the treatment gets the treatment reminder, not the escalation too.
  - **Readability** is checked at read time and at send time (19.1 D-13): through the risk's-people predicate for owner parts, and the participant predicate for `decision-waiting`.
  - **Destinations by part:** the owner risk page, the analyst register risk detail or assessment page, or 17.1's decision view.
  - **"The assigned analyst"** is the request's current assignee, which 13 D-08 keeps after release. For requests released before Phase 13, it is the releasing analyst (`approvedBy`) while still an eligible human analyst, and otherwise nobody: the derived alerts still show the work (settles 13 D-11).
  - **Reminders stop** when the work is done, the date moves, the round closes or the risk closes.
- **D-26:** One reminder run evaluates every rule over the current facts, with D-09's rule and today.
  - **When it runs:** daily through Strapi's scheduler, at a configured time; once at every Strapi start; and for one risk inside the transaction of every treatment act and decision review. The default time is `5 0 * * *` UTC: just after the rule's UTC day turns, mid-morning in Sydney. Running inside each act means a date moved into the lead reminds at once, and a date moved out of Overdue stops its reminders.
  - **What it writes:** the stored status changes first (D-08), under each risk's lock, then the reminders.
  - **The policy:** the lead, the repeat interval and the waiting threshold (seven days each) live in one reminder-policy configuration point, read through functions, with code defaults and no environment variable, for Phase 22 to take over.
  - **Safety:** the run is idempotent and safe to repeat or to run in two processes (D-27). It works in bounded batches and logs one structured line per run, with counts and failures and no personal data (R-08-13).
  - **In the harnesses:** the Strapi tests disable the timer and call the run with an injected clock; Playwright relies on the start-up run.
- **D-27:** `CsrmReminderDelivery` (D-01, record 2) holds one row per reminder per recipient per period.
  - **Facts:** a unique `reminderKey` (the kind, subject, recipient and period, for example the resolve date or the repeat number); the notification written with it; and the email facts: status (`pending`, `sent`, `failed`, or `skipped` with a closed reason such as `no-address` or `not-configured`), attempts, last-attempt and sent times, and a sanitised error code.
  - **Idempotency:** the row and the notification are written in one transaction, and the unique key means a repeated or concurrent run writes nothing twice: the transaction rolls back on conflict.
  - **Sending:** email goes out after the commit, never inside a transaction. A failed send retries on later runs, up to a bound research sets, and never blocks the in-app reminder.
  - **Reads and retention:** no route reads delivery rows in this phase (a delivery report is deferred). They are never deleted, and follow the request's retention (19.1 D-34).
- **D-28:** Email goes through Strapi's email plugin (decision 18; G-7). The plugin is installed with `sendmail` as its default provider, so the configuration always names a provider, and a test proves `sendmail` is never used.
  - **Development and tests:** a capture provider in `apps/backend` writes each message as a file to a capture directory: by default under the ignored `apps/backend/.tmp/`, with each harness pinning its own. Nothing leaves the machine. It is allowed only under Phase 14 D-12's double development key, and configured anywhere else it fails boot. Success criterion 5's "development capture mailbox" is this directory, which the tests read.
  - **Production:** SMTP through the official `@strapi/provider-email-nodemailer`, pinned to the Strapi version. It is G-7's named provider, which is the dependency's reason, and the plan that adds it justifies it. It points at the organisation's relay or Amazon SES in Sydney, from a domain aligned with SPF, DKIM and DMARC, and is deployment configuration only.
  - **Settings** go in `apps/backend/.env.example`, with safe defaults and a commented production block (names are proposals): the provider (`capture` by default in development), the capture directory, the sender address, the SMTP block, and the web's public base URL for links. Outside development, an unset provider makes email unavailable: deliveries record `skipped` (`not-configured`), in-app reminders still arrive, and the application runs. An invalid value fails boot (Phase 14 D-15's posture).
  - **Content** (data minimisation; ISO/IEC 27001:2022 A.5.14): plain text; what is due and when, the record by number only, and a link that opens it in the app after sign-in. It never holds a title, statement, rating, person's name or Requestor text, because email leaves CSRM's access control. The server words it at send time (19.1 D-16), and the UI-SPEC writes the copy. The address is the recipient's IdamBox User email, and it is never logged.

### Interface

- **D-29:** Surfaces, with every value from `docs/design/csrm-design-direction.md`. The UI-SPEC proposes new patterns from the first free X-n the orchestrator gives, each recorded in the direction by a plan task before the task that uses it.
  - **"My risks and treatments"** (cards below 768px) and **the owner risk page:**
    - a tracking summary with the due state and a progress control;
    - a notes thread (X-16's pattern) and evidence (X-19 to X-21, X-23);
    - the completion form, change sheets with reasons (X-13) and the decision review form;
    - the post-release history (X-29).
  - **The register:**
    - type, division and business-unit columns and filters, Phase 18's column chooser and views menu, and the "Accepted risks" view;
    - the risk detail's post-release panel: tracking, residual review, close and reopen, control delivery, history.
  - **Elsewhere:**
    - the released view's "Track this risk" link;
    - the Requestor Home's items and the sidebar item;
    - the analyst Home's exposure by type, and the reports' breakdowns and filters;
    - "Used in" panels and list counts;
    - the request form's division and business-unit suggestions.
  - **The G-4 bar:**
    - a keyboard path for every action;
    - confirmations for closure and decision reviews only;
    - completion's form plus Undo, and Undo toasts for progress changes and evidence removal;
    - forms with reasons for date, plan and owner changes, reopening and residual reviews;
    - optimistic feedback with rollback, and skeletons;
    - empty states that say what to do next ("Nothing is due");
    - no lost input (Phase 10's guard);
    - comfortable and compact density, and reduced motion;
    - cards and sheets on phones;
    - every figure opens its records.
  - **Reuse:** X-1 to X-5, X-10, X-13, X-14, X-16, X-17, X-19 to X-21, X-23, X-27, X-29, X-30, X-33 to X-35, Phase 18's grid and views patterns, 17.1's decision block, and the one status mapping for every status and due-state label (the G-13 seam).
  - **Route budgets** (R-08-34): forms on the owner page and the register detail load on demand (`next/dynamic`), and `performance.spec.ts` stays green or records an exception.
  - **Copy terms:** "My risks and treatments", "Not started", "In progress", "Complete", "Overdue", "Due soon", "Progress note", "Evidence", "Mark complete", "Reopen", "Resolve by", "Record residual review", "Close risk", "Reopen risk", "Review acceptance", "Renew exception", "Used in"; never "Accept" for an analyst. The UI-SPEC fixes the exact strings. A plan adds "Treatment (tracked)", "Progress note", "Overdue", "Closed (Risk)", "Decision review" and "Reminder" to the root `CONTEXT.md` glossary.

### Verification and plan shape

- **D-30:** Tests (stage2-rules §3) and the plan shape.
  - **Strapi unit:**
    - the rule's applicability, governing date and order, and the SQL predicate's parity with it;
    - the progress and status derivation, and the defaults for earlier releases;
    - the risk's-people predicate and the act table;
    - the baseline overlay;
    - the review authority and dates;
    - reminder rules, keys, periods and recipients;
    - the email content builder, proving no title or name reaches it;
    - provider selection.
  - **Strapi integration** (`apps/backend/tests/*.integration.test.ts`, node:test):
    - every operation and every refusal in `<authorisation>`;
    - the released record unchanged after every post-release act: the released read, export and report deep-equal before and after;
    - history rows in each act's transaction;
    - the run with an injected clock: Overdue in and out, each kind, the repeats, the escalation, idempotency on a repeated and a concurrent run, readability at send time, retries;
    - a capture file per email;
    - the old write paths still refusing a released risk;
    - matrix rows for all seven callers.
  - **Web unit (Vitest):**
    - closed parsers and zod-free domain modules;
    - every component in its refusal states: no date control for a treatment owner, no tracking link for a participant without a part, no review control for an analyst, Maya's not-found page;
    - confirmations, Undo and rollback, and the parity and chain guards.
  - **Playwright,** at 1440px and 375px, each run on its own records, leaving the tree clean (Phase 8 D-12; G-6):
    - **The journey's final slice,** `sliceTrackTreatment`, appended to `apps/csrm/e2e/risk-owner-journey.spec.ts` after 17.1's release and close (17-RESEARCH's structure). In order:
      1. The treatment owner finds the treated risk in "My risks and treatments", sets In Progress with a progress note and adds an evidence file.
      2. They are refused the resolve date (no control; API 403) and completion without evidence (400), then complete with an evidence statement, recording who and when.
      3. Bob, in the register's "Project" view, records a residual review and closes the risk with a reason.
      4. The released assessment still reads as released for Jane and the risk owner persona, and the owner page's history shows each change with who and when.

      The negatives: Maya gets the not-found page and 404 for the owner page, every act, the evidence download and the history, and nothing in her lists. Bob gets no "Review acceptance" control on the accepted risk, and the API refuses him: the analyst cannot accept.

      The slice signs in as the treatment owner the journey records. 17.1's slice should name Jane (by typing "Ja"), so that the treatment owner differs from the risk owner persona; otherwise the treatment owner's refusals move to the phase spec.
    - **A phase spec** (named by the planner) covers what the journey does not:
      - SC1: the views and exposure by type;
      - SC3: the owner and treatment owner views, with 17.1's executive approver persona as a non-participant treatment owner;
      - SC4: a system's "Used in" panel;
      - SC5: a date change into the lead reminds in the app and in the capture mailbox; a seeded overdue treatment reads Overdue in the register, Home, alerts and an export, and has escalated; a date change with a reason clears it; a seeded decision waiting eight days reminded its decider;
      - SC6's negatives.
  - **Fixtures:** no new persona. SC5's time-relative fixtures (a treatment due in three days, one overdue, an act waiting eight days in an open acceptance round, a review due) are reconciled at each start behind `IDAMBOX_SEED_CSRM` and the development identity, like Phase 7's insight fixture (`seed-analyst-insights.ts`), so that the start-up run processes them. They name people whose notification counts no other spec asserts, and no journey relies on them.
  - **Serialised by shared files,** one owner per file per wave:
    - the specification and the generated client;
    - both catalogue copies and `served-operations.json`;
    - the matrix and the parity and chain guards;
    - `treatment-due-state.ts` and its consumers;
    - `risk-register.ts`, `risk-register-query.ts`, and the risk controller and routes;
    - `assessment-scope.ts` and the released readers;
    - Phase 16's history writer and Phase 19.1's kind registry;
    - `csrm-authorization.ts`, `config/plugins.ts` and `config/server.ts`;
    - the web's risk, report, dashboard and navigation modules;
    - the E2E sign-in helper and the journey spec.
  - **Waves:**
    1. the two records and their checkpoint, with the pure modules alongside: the rule, the progress derivation, the risk's-people predicate, the reminder policy and keys, the email content builder;
    2. the schema;
    3. the rule switch and its consumers;
    4. tracking acts, the baseline and the history;
    5. evidence;
    6. the analyst's reviews, closure and control delivery;
    7. decision reviews;
    8. owner reads;
    9. registers, views, reports and suggestions;
    10. "Used in";
    11. reminders, the run and email;
    12. the UI;
    13. fixtures, the journey's final slice, the phase spec, and the full gate: `api:check`, typecheck, lint, web unit, Strapi, Playwright, then a clean `git status --short`.
  - **Size:** L, likely at the top of the band. If the plan count exceeds L, the seam is RISK-03 and ADMIN-06 (D-22 to D-24) on one side and tracking and reminders on the other; the orchestrator decides, as for 17.1 and 18.

### Planner's Discretion

- Operation paths, Function names, reason codes, kinds, parts, history kinds and sources, setting names and envelope versions, within the families above.
- Module placement, for example:
  - Strapi: `apps/backend/src/csrm/treatment/` (the predicate and acts), `apps/backend/src/csrm/reminders/` (policy, rules, run), `apps/backend/src/csrm/email/` (content builder and capture provider), and new API folders for `csrm-treatment-evidence` and `csrm-reminder-delivery`;
  - web: `apps/csrm/src/features/my-risks/` and `features/treatment/`.
- Bounds (note, reason, rationale and statement lengths as proposed above), page and batch sizes, the retry bound, and the capture file's format.
- Whether the owner history is part of the owner risk read or a sibling read; whether reopen uses the close operation with a flag or its own path.
- How plans split, provided D-30's serialisation and order hold.

### Open for research

- Strapi 5.51.0's scheduler: `config/server.ts` `cron` with a time zone, or `strapi.cron.add` in bootstrap. How the start-up run is ordered after the seeds. That two processes running it write nothing twice: the unique key inside a transaction, on SQLite and PostgreSQL.
- Wiring an in-repo email provider (as Phase 14 wires its local upload provider), the nodemailer provider's version pin, proving `sendmail` is never selected, and sending after commit.
- The SQL for "tracked treatment", on Phase 11's released branch of `applyDisclosableParent`, and for the decision review date with its fallback to the completing act, each against an oracle.
- The baseline overlay in one query per assessment, for the released reads, Phase 18's read-only table, and Phase 19's export and report.
- Whether Phase 16's history schema needs its actor made optional for the system source.

### Open for the UI-SPEC

- The owner page's layout, the progress control, the completion and review forms, the change sheets and the history at 375px and 1440px.
- How a status and a due state read together ("In progress · Overdue by 3 days").
- The register's new columns and filters, the built-in views' columns, the "Used in" panels, the type breakdowns, and how the released view's link reads.
- Every sentence for the new kinds, and the email copy (subject, body and footer), within D-28's content rule.
</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/NEXT-WAVE-DECISIONS.md`; none is open.

| Decision | What it settles here | Implemented by |
|---|---|---|
| #9 After release | The released record is immutable; risks live on; treatment updates; residual re-rating and closure as recorded reviews; statements and inherent ratings frozen; every change recorded | D-05, D-06, D-13 to D-16, D-19 |
| G-16 Treatment tracking | The lifecycle, the server-written Overdue, the governing date, evidence, who changes what, "My risks and treatments", escalation | D-07 to D-13, D-20, D-25 |
| #18 Notifications, G-18, G-19 | Reminders in the app and by email; decisions left waiting; the escalation to the risk owner; the kinds through Phase 19.1's service | D-25 to D-28 |
| G-7 Infrastructure | The email plugin, a capture provider in development and tests, nodemailer SMTP in production | D-28 |
| #8 Scales, matrix and appetite | Review intervals and authority by residual rating, from 17.1 D-58's configuration point | D-17 |
| G-14 Accept or Treat | Tracking from a Treat decision; accepted risks reviewed by their authority; no analyst decides | D-07, D-13, D-17, D-23 |
| G-12 Who reads | Owners who are not participants see only their own risks after release; nobody else sees anything | D-13, D-20, D-21 |
| G-1, G-11 Separation of duties | No analyst reviews or closes a risk on a request they raised or a risk they own, approve or treat | D-13 |
| #6 Removing risks | Released risks close through the register with a reason | D-15 |
| #11 What exposure counts | Released by default, under assessment separately, accepted marked | D-17, D-22, D-24 |
| #12 Exports | The owner list exports; the register export carries types and due states | D-20, D-22 |
| #2 Attachments | Evidence files on Phase 14's pipeline and retention | D-18 |
| #1 Admin role | Divisions and business units, shared views and the policies become the Admin's in Phase 22 | D-22, D-23, D-24, D-26 |
| #10 Assignment | Any human analyst acts; the assigned analyst receives escalations | D-13, D-25 |
| G-13, G-15 | The released predicate over `approved` or `closed`; decision rows frozen | D-05, D-06 |
| G-17 People search | New treatment owners found by name | D-12 |
| G-4, G-6 | The premium bar; the pilot approves the records; Playwright leaves the tree clean | D-29, D-30, `<contract_gaps>` |
| G-20 | Touches nothing here: no AI runs after release | — |

**Conflicts:** none between the ROADMAP entry and these decisions. Readings recorded, and named in the return:
1. G-16's one rule, read with RISK-04 criterion 3, gives due states only to tracked treatments, which narrows Phase 11 D-43 for due figures (D-04, D-09).
2. The seven-day reminder lead sits inside Phase 11 D-38's 14-day due-soon window, so every reminded treatment already shows as due soon.
3. RISK-05's "decisions due for review" and NOTIFY-02's review reminders need an act that resolves them: the decision review (D-17).
4. `treatment-assigned` and `decision-review-not-confirmed` extend G-18's list under decision 18's rule, as 17.1 D-54 did for peer approvals.
5. Reminder deliveries get their own record, the ROADMAP's "get their own".
6. RISK-03's "report dimensions" is read as a breakdown by type, plus filters for type, division and business unit.
7. A participant without a part on a risk gets 403 rather than 404 on its tracking routes, reading RISK-05 criterion 3 with 17 D-24.
</operator_decisions>

<contract_gaps>
## Contract-Gap Records and Their Approval Checkpoint

Each record follows the format of `docs/contract-gaps/phase-06.1-revert-audit-facts.md` and the Phase 14, 16, 17 and 17.1 records: Gap, Approved Compatibility Extension, Write Discipline, What This Extension Does Not Add, Audit Semantics and Limitation, and Migration.

1. **`docs/contract-gaps/phase-20-treatment-tracking.md`** (the ROADMAP's record).
   - **The gap:** the JDL holds `treatmentStatus` (with OVERDUE), `treatmentResolveDate`, `treatmentOwner`, `treatmentPlan`, `closureDate`, `isExempted` and `exemptionReviewDate`. It holds no post-release lifecycle, completion, evidence, closure reason, review record or released baseline. Phase 7's record items 1 and 6 name the gap.
   - **The extension:** D-01 items 1 and 2.
   - **Write discipline:**
     - progress and completion are written only by the treatment acts;
     - the status only by the rule, in the run and in the acts;
     - closure facts only by close and reopen;
     - review facts only by the review act;
     - the baseline once;
     - evidence only by its operations;
     - history append-only.
   - **The rules:** D-05 to D-19, D-21.
   - **Dated amendments, summarised here:**
     - `phase-07-derived-insights.md`: items 1 and 6;
     - `phase-16-risk-withdrawal-and-history.md`: the kinds, sources and system actor, the owner read of post-release rows, and the baseline row;
     - `phase-17-participant-read.md` and `phase-17.1-release-and-close.md`: the released reads' baseline overlay, `treatment-assigned` at release, the exception fields after release, and the decision review;
     - `phase-18-saved-views.md`: the `risk-register` key;
     - `phase-19-exports-and-export-log.md`: the owner list export, and the released export's baseline overlay;
     - `phase-14-request-attachments.md`: the pipeline's second holder.
   - **Not added:** a risk lifecycle status; a decision after release; approval of date or plan changes; control implementations added or removed after release; owner reassignment after release; AI on evidence; deletion.
   - **Migration:** none. Earlier releases read as D-06, D-07 and D-17 say.
2. **`docs/contract-gaps/phase-20-reminders-and-email.md`**.
   - **The gap:** no reminder, delivery or email facts exist, and `CsrmNotification` is channel-neutral (19.1 D-33).
   - **The extension:**
     - `CsrmReminderDelivery` (D-27);
     - the kinds and the `treatment-owner` part, by a dated amendment to `phase-19.1-notifications.md`;
     - the email channel, the provider configuration and the content rule (D-28);
     - the run and its policy (D-26).
   - **Write discipline:** deliveries are written only by the run and by the per-risk evaluation, and email status only by the sender.
   - **Not added:** preferences and digests (NOTIFY-03), email for events other than reminders, a delivery read, any change to `CsrmNotification`.

**Approval checkpoint:** the first plan writes both records and their amendments, then a `checkpoint:decision` task at which the executor stops. Under G-6 the pilot reviews and approves each record, recording the approval in the record itself. Each record's schema, catalogue and specification work runs only after its own approval. The changes are additive, so Strapi's schema sync creates the tables and columns, and `apps/backend/database/migrations/` stays empty (the 06.1 to 18 precedent). The proof boots a fresh test database, where released risks read as D-06, D-07 and D-17 say and their released reads are unchanged. The operator's development database shows the changes after the orchestrator's next Strapi start, and the content-type freeze check lists exactly the approved schema files.
</contract_gaps>

<authorisation>
## Authorisation Model and Negative Cases

Keycloak authenticates. Strapi enforces Role → Function → FunctionAPI, then the record rule, against the resolved IdamBox User in `ctx.state`, identically under the development identity bridge and a Keycloak-verified user, never branching on the auth mode (POST-DEMO-BRIEF §2). Navigation visibility is not authorisation: every control the UI hides, Strapi also refuses.

**Grants (D-02, D-13):**
- The owner reads, treatment acts, evidence routes and the decision review go through new API-only Functions granted to `role.requestor` (the birthright) and `role.security_analyst`, never to the agent, each with the risk's-people rule.
- The residual review, close and reopen, control delivery, register views and filters, report breakdowns, the dashboard by type and the usage reads go through human-only analyst Functions plus `HUMAN_ANALYST_ONLY_OPERATIONS`, with G-1 and G-11 for the post-release acts.
- The suggestions read is open to both grants, with D-22's scoping.
- The web gains an owner capability anchored to the owner list (ADR 0004; 19.1 D-37's pattern), granted in development to every role.

**Positive cases:**
- The treatment owner sets progress, adds notes and evidence, and completes on evidence.
- The risk owner does the same, and changes the date, plan and treatment owner with reasons.
- The reviewer confirms or does not confirm a due review.
- Any eligible human analyst does every treatment act, records residual reviews, closes and reopens, and records control delivery.
- Each of the risk's people reads their own risks, and analysts read the register.

**Negative cases** (each proven in the API by a Strapi integration test or a matrix row, and in the UI by Vitest or Playwright):

| Case | API outcome | UI outcome |
|---|---|---|
| Maya (unrelated) lists, reads or acts on Jane's released risk: the owner page, notes, evidence download, history, treatment acts, review | 404, persistence unchanged | Not-found page; nothing in her lists, Home, notifications or quick find |
| A participant with no part on that risk reads its tracking or acts | 403 `NOT_RISK_PERSON` | The released view offers no tracking link |
| The treatment owner changes the date, plan, treatment owner or any risk field | 403 `TREATMENT_FIELD_NOT_PERMITTED` | No control |
| A control owner or an executive approver does a treatment act | 403 | Read-only page |
| Completion without an evidence statement | 400 `TREATMENT_EVIDENCE_REQUIRED` | The form says why, input kept |
| A date, plan or owner change without a reason, a date not after today, or an ineligible owner | 400, or 409 `OWNER_NOT_ELIGIBLE` | Form validation |
| Any treatment act before release | 409 `RISK_NOT_RELEASED` | Not offered; pre-release fields are the recommendation |
| A treatment act on an accepted risk | 409 `TREATMENT_NOT_TRACKED` | Not offered |
| Any act on a closed risk except an analyst's reopen | 409 `RISK_CLOSED` | Read-only |
| An act with stale values | 409 `TREATMENT_CHANGED` with the current values | Refreshes with the reason; input kept |
| Any existing write path on a released risk: risk update, bulk save, import, withdrawal, control implementation create, update or remove, AI | 409 `ASSESSMENT_NOT_MUTABLE` (unchanged) | The released record stays read-only |
| Residual review, close, reopen or control delivery by a Requestor, an owner or the service identity | 403 (grant) | Not offered |
| The same, by an analyst who raised the request | 403 `OWN_REQUEST` | Withheld, with the reason |
| The same, by an analyst who holds a part on the risk | 409 `ACTOR_IS_RISK_OWNER`, `ACTOR_IS_EXECUTIVE_APPROVER` or `ACTOR_IS_TREATMENT_OWNER` | Withheld, with the reason |
| A decision review by any Security Analyst, by the risk owner of a High or Critical risk, or by the Requestor when not the reviewer | 403 `DECISION_NOT_PERMITTED` | No review control |
| A review before its lead, or with nobody eligible to hold its authority | 409 `REVIEW_NOT_DUE` or `REVIEW_AUTHORITY_MISSING` | The page says when, or who must act |
| Writing statements, inherent ratings, the risk owner, the executive approver or a decision row after release | No operation accepts them | Not offered |
| The service identity at any Phase 20 operation | 403 | Not applicable |
| A reminder about a risk the recipient may no longer read | Not written or sent; not listed or counted | Not shown |
| An email body | Holds no title, statement, rating, name or Requestor text | Not applicable |
| A Requestor at register views, register filters, report breakdowns or usage reads | 403 (grant) | Gated |
| A Requestor's suggestions read | Only values on requests they raised | Not applicable |
| No identity, or no token | The matrix conventions | The sign-in path |
</authorisation>

<seams>
## Cross-Phase Seams

- **G-16 (stage2-rules):** the one switch is `treatment-due-state.ts`, where Phase 11's plans 11-15 and 11-17 put the rule and its SQL predicate, with every due figure reading them (D-09). No `targetDate` due logic is written anywhere else.
- **Phase 14's attachments (stage2-rules):** evidence reuses the pipeline in its own entity (D-18), as 14-CONTEXT's seam recommends.
- **Phase 19's exports (stage2-rules):** the owner list export is authorised by the owner list's own predicate, never by a hard-coded Requestor check. Released exports and the A4 report gain the baseline overlay through 19 D-14's one predicate and D-21's projection (D-06).
- **Phase 22 (stage2-rules):** the reminder policy, the review intervals (in 17.1 D-58's point), divisions and business units, and who may share register views each sit in one configuration point Phase 22 can take over (D-22, D-23, D-26).
- **Phase 17's fixtures (stage2-rules):** the risk owner persona and Maya serve the journey. No persona is added (D-30), so ADR 0004's fixture subjects and the realm import do not change.
- **Phase 7** (record items 1 and 6, amended) and **Phase 11** (D-13's sidebar slot, D-19 and D-20's Home, D-36's control figures, D-38's window, D-41's marker, D-43 narrowed for due states).
- **Phase 13:** the assignee kept after release receives escalations, with D-25's fallback for older requests; `closed` keeps reassignment, so escalations follow a new assignee.
- **Phase 16:** the history store with new kinds, sources and the owner read (D-19); the active-risk rule (withdrawn risks are never released); S-10.
- **Phases 17 and 17.1:** the participant predicate for pre-release items and `decision-waiting`; the decision state (D-33) and review dates (D-36); the appetite point (D-58); release and close gains `treatment-assigned`; the exception fields after release (D-44); the released decision block read through the baseline. The journey's Treat step should name Jane as treatment owner (D-30).
- **Phase 17.2:** contest points and rounds stay frozen after release, and no reminder covers them; the journey's slices run before this one.
- **Phase 18:** the saved-view entity and its key vocabulary; the column chooser; compare-and-set bases; the scale and override rules for the residual review; the read-only table on a released assessment reads the baseline; no due marker in the table (18 D-07 stays true for unreleased risks).
- **Phase 19.1:** the kinds, the `treatment-owner` part, readability at send time, the system actor; nothing changes on `CsrmNotification`.
- **Phase 21:** its "accepted risks and exemptions due for review" metrics read D-17's facts; its stage times and trends read the history; persisted job history remains Phase 21's, and this phase's run logs only.
- **Phase 22:** the Admin holds the birthright, so it receives reminders as an owner, but holds no analyst grant, so no analyst act here.
- **The post-demo journey:** this phase appends the final slice, and the journey passes end to end (D-30).
</seams>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings, asks and intent
- `.planning/uat/product-gaps/FINDINGS.md`: UAT-045, UAT-046, UAT-047 and UAT-058 in full.
- `.planning/uat/product-gaps/REPORT.md`: §4 (metric sets by audience) and §9 (decisions 9 and 18).
- `.planning/POST-DEMO-BRIEF.md`: §1 and §2 (overrides, dev-mode rules) and §6 (PD-5; the Stage 3 journey).

### Planning authority
- `.planning/ROADMAP.md`: Phase 20 (goal, decisions, contract line, seven success criteria), "The post-demo journey", and the 11, 14, 16, 17, 17.1, 17.2, 18, 19, 19.1, 21 and 22 entries for the seams.
- `.planning/REQUIREMENTS.md`: RISK-03 to RISK-06, ADMIN-06 and NOTIFY-02 with their amendments; ASSESS-20 (its "Accepted risks" amendment), ASSESS-22, NOTIFY-01, CSV-01, ADMIN-07.
- `.planning/NEXT-WAVE-DECISIONS.md`: decision notes 1, 2, 6, 8, 9, 12 and 18; decisions 10 and 11; G-1, G-4, G-6, G-7; G-11 to G-19.
- `.planning/STATE.md` Decisions (the planning method; G-16's entry).
- `.planning/phases/17.1-review-peer-approval-and-risk-acceptance/17.1-CONTEXT.md`: D-01, D-20, D-26, D-28, D-33, D-36, D-42 to D-47, D-50 to D-52, D-58, D-68, its Phase 20 seam and Orchestrator Confirmations; `17.1-RESEARCH.md` (UTC review dates).
- `.planning/phases/17-mitigation-response-and-residual-reassessment/17-CONTEXT.md` (D-22 to D-30, D-75, the Phase 20 seam) and `17-RESEARCH.md` §L (the journey's structure and `sliceTrackTreatment`).
- `.planning/phases/17.2-contest-points-and-rework-rounds/17.2-CONTEXT.md` (D-15, the journey's third slice, the Phase 20 seam).
- `.planning/phases/19.1-in-app-notification-centre/19.1-CONTEXT.md` (D-01, D-06, D-07, D-12, D-13, D-16, D-17, D-33, D-34, the Phase 20 seam, Orchestrator Confirmations) and `19.1-RESEARCH.md`.
- `.planning/phases/14-request-attachments/14-CONTEXT.md` (D-01, D-06 to D-25, D-37, the Phase 20 seam) and `14-RESEARCH.md`.
- `.planning/phases/16-risk-curation-and-targeted-ai-re-runs/16-CONTEXT.md` (D-05, D-14, D-18 to D-22, S-10) and `16-RESEARCH.md` (the history entity and read).
- `.planning/phases/18-risk-table-and-spreadsheet-interoperability/18-CONTEXT.md` (D-07, D-09, D-10, D-14, D-20 to D-22, the Phase 20 seam).
- `.planning/phases/19-csv-export-and-import-hardening/19-CONTEXT.md` (D-05 to D-07, D-13 to D-15, D-21, the G-16 and Phase 20 seams).
- `.planning/phases/13-request-pick-up-and-notes/13-CONTEXT.md` (D-08, D-11, the Phase 20 seam).
- `.planning/phases/11-navigation-landing-and-list-clarity/11-CONTEXT.md` (D-02, D-10, D-13, D-19, D-20, D-35, D-36, D-38, D-40 to D-44) and plans `11-15-PLAN.md` and `11-17-PLAN.md` (the due-state switch point).

### Product, domain and contract
- `docs/CSRM-PROJECT-BRIEF.md` §8 (risk content), §10 (dashboards), §20 (record gaps), §22 (IDOR).
- `docs/references/idambox-datamodel.jdl`: `CsrmRisk` (`treatmentAction`, `treatmentPlan`, `treatmentOwner`, `treatmentResolveDate`, `treatmentStatus`, `targetDate`, `closureDate`, `isExempted`, `exemptionReviewDate`, the residual fields, `riskOwner`); `CsrmTreatmentStatus`; `CsrmControlImplementation`; `CsrmAssessmentRequest` (`assessmentType`, `division`, `businessUnit`); `CsrmAssessment.nextReviewDate`.
- `CONTEXT.md` (repository root): Released, Risk owner, Executive approver, Accept and Treat, Assigned analyst, Withdrawn ("a risk's closure after release is Phase 20's"), Closed.
- `docs/contract-gaps/phase-07-derived-insights.md` (items 1 and 6, amended here); `phase-04-composite-release-fact.md`; `phase-06.1-revert-audit-facts.md` (format); and, once written, the Phase 14, 16, 17, 17.1, 18, 19 and 19.1 records that this phase amends.
- `docs/references/specification.json` (the risk register, risk detail, report, dashboard, administration and notification schemas); `docs/references/served-operations.json` (`POST /api/v1/risks/{riskId}/close`, unserved today).
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`: `function.risk_register.*` (`risk_details.api.05` Close Risk), `function.administration.*`, `function.risk_assessments.my_risk_assessments`.
- `docs/security/phase-08-residual-risks.md`: R-08-13 (personal data in logs), R-08-34 (route budgets), R-08-36 (single-process jobs).
- `docs/adr/0004-strapi-verifies-keycloak-access-tokens.md` (capability anchors).

### Design and framework
- `docs/design/csrm-design-direction.md` and `docs/adr/0001-adopt-bproton-design-system.md`: §4 DataTable, Status and risk badges, Forms, Dialogs, Toasts, Skeletons, Empty states, Record links; §5 Motion; §6 Do-not list.
- Strapi 5 email plugin and cron documentation (research confirms the 5.51.0 behaviour); `apps/backend/node_modules/@strapi/email` (installed, `sendmail` default).

### External
- ISO/IEC 27001:2022 clauses 6.1.3 f, 8.3 and 9.1, and Annex A 5.14 (information transfer); ISO/IEC 27005:2022 (monitoring and review; risk acceptance); the Three Lines Model (IIA, 2020).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/csrm/insights/treatment-due-state.ts`: `TREATMENT_DUE_STATES`, `isTreatmentOpen` and `deriveTreatmentDueState` on `targetDate` today, with a comment saying nothing sets Overdue. Phase 11 adds `applyTreatmentDueStatePredicate` and `TREATMENT_DUE_DATE_COLUMN` here.
- `apps/backend/src/csrm/insights/alert-rules.ts` (`critical-residual-risk-untreated` reads `treatmentStatus` as untreated when empty or Not Started) and `apps/backend/src/api/csrm-analyst-insight/services/alert-repository.ts` (risk alerts scoped to open risks, `whereNull("r.closure_date")`); `report-repository.ts`, `report-definitions.ts` (`risk-exposure`, `treatment-performance`, `assessment-throughput`, `control-effectiveness`) and `dashboard-summary.ts`.
- `apps/backend/src/api/csrm-risk/services/risk-register.ts`:
  - `applyDisclosableParent` (mutable or released parent);
  - `projectRiskRegisterItem` (the due state per row);
  - `getRiskRegisterDetail` (`parentLock: "released"`);
  - the repository's `count`, `selectPage` and `hydrate`.

  Also `risk-register-query.ts` (the closed parser views and exports reuse); `risk-workflow.ts` (updates through `withMutableAssessmentMutation`, which refuses released risks); `routes/csrm-risk.ts` (register routes behind `requireAnalystRiskRegisterScope`).
- `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts` (`releasedAssessmentQuery`, `projectAnalystRiskDetail`, `RISK_DETAIL_FIELDS`), which the baseline overlay joins; `assessment-workflow.ts` (`RISK_WRITABLE_FIELDS`, `releaseAssessment`).
- `apps/backend/src/api/csrm-administration/` (the reference detail and list reads that gain "Used in" and counts).
- `apps/backend/src/policies/csrm-authorization.ts` (`HUMAN_ANALYST_ONLY_OPERATIONS`, the register scope, `loadEffectiveGrants`); `apps/backend/tests/fixtures/authorization-matrix.ts`; `apps/backend/tests/helpers/strapi-http-harness.ts`.
- `apps/backend/config/plugins.ts` (no email configuration today) and `config/server.ts` (no cron today); `apps/backend/.env.example`; `apps/backend/.tmp/` (ignored); `@strapi/email` 5.51.0 with `@strapi/provider-email-sendmail` installed.
- `apps/backend/src/bootstrap/seed-analyst-insights.ts`: a fixture reconciled to "today" at each start, behind `IDAMBOX_SEED_CSRM` and the development identity, which is the pattern for D-30's fixtures.
- Planned modules from earlier phases:
  - Phase 11: `treatment-due-state.ts`'s predicate, and the released and under-assessment branches;
  - Phase 14: the storage port, scanner, policy, file-transfer modules and `csrm/audit/security-event-log.ts`;
  - Phase 16: the history writer and reason parser;
  - Phase 17: the participant predicate and the people picker;
  - Phase 17.1: the decision state, review dates, `risk-scale.ts` authority and intervals, and release and close;
  - Phase 18: `CsrmSavedView`, the column chooser and compare-and-set;
  - Phase 19: the export module and the released predicate;
  - Phase 19.1: the notification service, kind registry and eligible-person predicate.
- Web:
  - `apps/csrm/src/features/risks/` (`risk-register-filters.tsx`, `risk-detail-editor.tsx`, `risk-details.tsx`, `risk-domain.ts`);
  - `apps/csrm/app/(app)/app/risks/` and `app/(app)/app/admin/[collection]/[documentId]`;
  - `apps/csrm/src/features/reports/`, `features/analyst-dashboard/` and `features/dashboard/requestor-dashboard.tsx`;
  - `features/requests/request-form.tsx` (division and business unit are free `TextField`s today);
  - `apps/csrm/src/components/csrm/status-badge.tsx` (`statusPresentation`);
  - `apps/csrm/e2e/helpers/navigation.ts` (`signInAs`).

### Established Patterns
- A current fact plus append-only history: gates read facts, the history narrates (06.8, Phase 16).
- One rule with an SQL mirror, proven equal by an oracle (Phase 7 D-21 and D-30; Phase 11).
- An unreadable record is 404; a refusal to someone who can read the record is 403 or 409 with a closed reason; denials keep persistence deep-equal.
- Human-only API Functions plus `HUMAN_ANALYST_ONLY_OPERATIONS`; birthright operations with record rules; the service identity refused explicitly.
- Development-only doubles under the double key, failing boot elsewhere (Phase 14 D-12, D-15).
- The server words, links and counts, and the web formats; zod-free domain modules for client components; batch Server Actions.

### Integration Points
- **Strapi:**
  - the risk API (routes, controller, register, workflow), the insight readers, the administration reads and the assessment readers;
  - Phase 16's history writer and Phase 19.1's service;
  - new evidence and delivery API folders, the reminder and email modules, and the configuration files;
  - both catalogue copies and the bootstrap seeds.
- **Web:** the register and its risk detail; a new "My risks and treatments" list and owner risk page; the released view's link; both Homes; the navigation profile; the reports; the reference detail pages and lists; the request form.
- **Tests:** the matrix and harness, the integration suites, Vitest beside each module, the journey's final slice, the phase spec, and the existing specs that change deliberately (the register, reports, Home and reference pages, `performance.spec.ts`), each named in the plan that changes it.
</code_context>

<specifics>
## Specific Ideas

- **The journey's final slice in words.** Bob has released and closed; the persona's payroll-file risk is treated, with Jane as its treatment owner, resolving at the end of next quarter, Not Started.
  1. Jane opens "My risks and treatments": the risk shows "Treatment owner", Low, Not started, "Resolve by …". She sets In Progress with a note ("Signing configured in the test tenant") and attaches the bank's configuration export.
  2. She has no control to move the date, and a direct API call is refused (403). Pressing Mark complete without a statement is refused. She completes with "Production payment files signed since 3 March; first signed run attached", and the page shows her name and the time.
  3. The persona sees the risk Complete in their own list.
  4. Bob opens the register's "Project" view, records a residual review ("Signing verified in production; likelihood lowered") and closes the risk with a reason, confirming.
  5. Jane's released assessment still shows the treatment as released. The owner page's history lists the baseline, In Progress, the note, the evidence, Complete, the review and the closure, each with who and when.
  6. Maya gets the not-found page and 404 throughout. Bob has no "Review acceptance" control on the accepted segregation-of-duties risk, and the API refuses him.
- **A week of reminders.** A treatment owned by a non-participant falls within seven days of its resolve date. The daily run puts "Treatment RSK-… is due on 12 Mar" in their notification centre and a matching email in the capture directory, naming the risk number only. The date passes: the register, Home and alerts read Overdue, the owner gets a weekly reminder, and the assigned analyst and the risk owner each get one escalation. The risk owner moves the date to the end of the month with a reason, and the treatment reads In progress again.
- **A review in practice.** Twelve months after an acceptance of a Moderate risk, the owner is reminded seven days ahead. On the date they confirm with a rationale, and the next review moves to twelve months on. Had the analyst raised the risk to High in a residual review, no executive approver would be named, so the review would say the Security Analyst must reassess.
- **Development database.** The schema, the grants, the email capture and the run reach the operator's development database only when the orchestrator restarts Strapi; tests use their own databases. Released risks show their released values until their first post-release change.
</specifics>

<deferred>
## Deferred Ideas

- A decision after release (changing Accept to Treat or the reverse), and a re-assessment that supersedes a released assessment and records an assessment's re-review.
- Changing the risk owner or the executive approver after release, which joiner-mover-leaver cases will need. Until then, reminders to an inactive person are not sent, and the derived alerts show the work.
- The executive approver's approval of date or plan changes on High and Critical risks; granting an exception after a residual review raises a risk to Critical.
- Control owners recording delivery themselves; adding or removing control implementations after release.
- Escalation and alerts for overdue decision reviews; reminders for response rounds and unanswered contest points (not in G-18's list).
- Digests, notification preferences and further channels (NOTIFY-03); email for event kinds; a delivery report.
- Breakdowns by division and business unit, which wait for Phase 22's Admin lists.
- Persisted run history, which belongs with Phase 21's job history.
</deferred>

## Seeds Confirmed or Corrected

- **RISK-03 to RISK-06, ADMIN-06 and NOTIFY-02; closes UAT-045, UAT-046, UAT-047 and UAT-058; PD-5:** confirmed (`<requirements>`).
- **`phase-20-treatment-tracking.md` first, then an approval checkpoint:** confirmed, with corrections:
  - reminder delivery facts get their own entity in a second record, `phase-20-reminders-and-email.md`, never a change to `CsrmNotification` (19.1 D-33);
  - post-release history extends Phase 16's store by amendment;
  - evidence is its own entity on Phase 14's pipeline (14's seam);
  - date-change reasons are history rows;
  - the Overdue rule amends `phase-07-derived-insights.md` items 1 and 6.
- **The treatment lifecycle (G-16):** confirmed. Precisions:
  - a progress fact separate from the stored status makes "returns to its last progress status" hold by construction (D-08);
  - the rule applies only to tracked treatments, narrowing Phase 11 D-43 for due figures (D-09);
  - the 14-day due-soon window stays, and the seven-day lead is the reminder's;
  - Phase 7's untreated rule reads progress.
- **After release (decision 9):** confirmed. Added:
  - a release baseline keeps the released record, its export and its report as released (D-06);
  - G-1 and G-11 apply to the analyst's post-release acts (D-13);
  - control delivery, from UAT-046's "control status" (D-16);
  - the exception's maintenance, from 17.1 D-44's handoff (D-14, D-17).
- **"My risks and treatments":** confirmed. Precisions:
  - the risk's people include the executive approver and control owners;
  - 404 for anyone who cannot read the risk, and 403 for a participant without a part (17 D-24's reasoning);
  - pre-release items come from 17.1's state after the gate;
  - Home counts nothing twice (D-20, D-21).
- **Registers by type:** confirmed on Phase 18's entity with the `risk-register` key, adding the "Accepted risks" view (ASSESS-20's amendment) and the filters that "Used in" figures need (D-22 to D-24).
- **Reminders (decision 18, G-18):** confirmed. Precisions:
  - the kinds and repeats (D-25);
  - a daily run plus a start-up run plus a per-risk evaluation (D-26);
  - an idempotent delivery record (D-27);
  - the capture provider under Phase 14's double development key, SMTP through the official nodemailer provider, and minimal email content (D-28);
  - the fallback recipient settles 13 D-11.

  Added:
  - `treatment-assigned`, from 17.1's deferral;
  - the decision review act, so "due for review" items resolve (D-17).
- **Divisions and business units stay free text with suggestions until Phase 22:** confirmed, with the suggestion scope that keeps Requestors to their own values (D-22).
- **The post-demo journey:** confirmed as `sliceTrackTreatment`, with its negatives (D-30). Seam: 17.1's Treat step should name Jane as the treatment owner.

## Orchestrator Confirmations (2026-10-01, post-demo Stage 2)

The research raised four questions. Each is settled as follows and binds the plans:

- **Tracked treatments:** count released, Treat, not-withdrawn risks, whether open or closed. A closed one reads `complete-or-closed` (D-07 and D-09 reconciled).
- **Close Risk's description:** a Phase 20 plan changes the catalogue description in both catalogue copies to match D-15 (closure needs no completed treatment). This is a contract change, under the phase's record and approval.
- **The journey:** Phase 17's first slice raises a Project-type request, so this phase's final slice finds the treated risk through the "Project" view. The Phase 17 planner was told.
- **The notification service:** Phase 19.1's committed service stays as planned. This phase extends it with a system actor for scheduled writes, explicit recipients and returned notification ids, with tests, in the plan that adds reminders.

---

*Phase: 20-oversight-registers-and-post-release-tracking*
*Context gathered: 2026-10-01*
