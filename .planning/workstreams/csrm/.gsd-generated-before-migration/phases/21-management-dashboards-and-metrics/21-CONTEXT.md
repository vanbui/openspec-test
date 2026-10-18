# Phase 21: Management dashboards and metrics - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`, one pass. Every gray area took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005 monitoring and review; ISO/IEC 27001:2022 clause 9.1 on monitoring, measurement, analysis and evaluation) at the G-4 premium bar, consistent with `.planning/NEXT-WAVE-DECISIONS.md` (decisions 1 to 18, G-1 to G-20). Following stage2-rules §3a, upstream decisions are cited by number, not restated. Grounded in:
- the product gap UAT (UAT-059 in `.planning/uat/product-gaps/FINDINGS.md`) and `REPORT.md` §4, the metric sets per audience;
- the orchestrator's seeds, each confirmed or corrected (last section);
- the planned outputs of Phases 7 (shipped: report keys, insight scope, chart primitives), 11 (plans 11-15 and 11-17, the due rule; X-10), 12 (plan 12-01, the run record), 13, 16, 17, 17.1, 17.2, 18, 19, 19.1 and 20 (each CONTEXT with its Orchestrator Confirmations or Seeds section);
- a read of today's code (`<code_context>`).

There is no SPEC.md, no todo matched (`todo.match-phase 21`: 0) and no discuss hook is active. The discussion log is `21-DISCUSSION-LOG.md`.

**Plans are written ahead.** Phase 21 executes after Phases 10 to 20 (order 10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22). Its plans are written against today's code plus those phases' planned outputs, name the earlier plans they rely on (11-15 and 11-17 for `treatment-due-state.ts`, 12-01 for `CsrmAiRun`, and the plans of 13, 16 to 20 once written), and get a fresh plan check just before execution.

<domain>
## Phase Boundary

Risk managers and leaders get the evidence that risk and the assessment process are improving: open released risks by residual rating over twelve months, a likelihood-by-consequence heat map of inherent and residual positions, the median and 90th-percentile time each stage takes (the response, acceptance and rework rounds included) with the slowest items, queue ageing, and the health of AI assistance. Every figure comes from recorded history, states its scope and opens its records. Analysts see failed AI runs of the last seven days. First-line people keep their personal figures only. The phase closes UAT-059.

### In scope
- One new record, the stage history, written by one recorder inside every stage-changing act, including the round acts of Phases 17, 17.1 and 17.2 (D-01, D-05 to D-08).
- Stage times, round measures, time to release and queue ageing (D-09 to D-12).
- The residual-rating trend and the heat map, with their drill-downs (D-13 to D-16).
- Metric sets per audience: the Requestor's one addition, the analyst's Home additions, the leadership view, and additions to the four existing reports (D-17 to D-20).
- AI job history through Phase 12's run record, the failed-runs list, AI assistance health, and the R-08-36 and R-08-37 dispositions (D-21 to D-24).
- Two contract-gap records and their checkpoint, grants, interface, tests and fixtures (D-02 to D-04, D-25 to D-29).

### Out of scope
- Alert acknowledgement or assignment (07 record item 3), and any persisted alert state.
- Breakdowns by division and business unit (Phase 22's lists; 20 D-22), and per-analyst workload views.
- Management metrics for anyone without the human Security Analyst grant; a new IdamBox Role.
- A shared job store for more than one Strapi process (R-08-36), and running the suites on PostgreSQL (R-08-37).
- Any slice of `apps/csrm/e2e/risk-owner-journey.spec.ts`, which Phase 20 completes; Keycloak; live AI in any suite.
</domain>

<requirements>
## Requirements and Success Criteria This Phase Owns

| Requirement | Acceptance (REQUIREMENTS.md, abridged) | Decisions |
|---|---|---|
| **DASH-04** Each audience has a metric set that answers its questions, with every figure opening its records | (1) Requestor, Security Analyst and risk-manager metric sets as in `REPORT.md` §4, each widget stating its scope; (2) failed AI jobs in the last seven days are visible to analysts | D-17 to D-23, D-25, D-26 |
| **DASH-05** Trends, a heat map, cycle times and ageing come from recorded history | (1) open released risks by residual rating over 12 months; (2) a likelihood-by-consequence heat map of inherent and residual positions for the filtered set, readable without colour (decision 13: accessible SVG components with a data-table alternative); (3) median and 90th-percentile time per stage linking to the slowest items, and queue ageing bands | D-05 to D-16 |

**ROADMAP success criteria (Phase 21), each planned in the UI and the API with its negative cases:**
1. The leadership view shows open released risks by residual rating over 12 months. (D-13, D-14, D-19)
2. A likelihood-by-consequence heat map shows inherent and residual positions for the filtered set, readable without colour. (D-15, D-16)
3. Median and 90th-percentile time per stage are shown and link to the slowest items. (D-05 to D-12)
4. Failed AI jobs in the last seven days are visible to analysts. (D-18, D-21, D-22)

**Closes:** UAT-059. **Intent:** Q1. **Ask:** none (the pilot's seam: stage times include the response, acceptance and rework rounds).
</requirements>

<decisions>
## Implementation Decisions

### Scope and contract boundary

- **D-01:** One new content type, through record 1 and the checkpoint (`<contract_gaps>`): the stage history, proposed `CsrmStageTransition` (the record fixes names). One immutable row per stage a request enters: `request` (many-to-one, required), `stage` (D-06's closed vocabulary), `enteredAt`, `enteredBy` (many-to-one `IdamBoxUser`, null only for a system act), `cause` (a closed vocabulary naming the act, D-07), an optional `round` (many-to-one Phase 17's `CsrmAssessmentRound`) and a per-request `sequence`. Relations are unidirectional and the type gets no core router (17 D-02). It competes with no JDL entity: the JDL has no history entity (Phase 12 D-19's and Phase 16 D-18's reasoning). Nothing else changes schema: persisted job history is Phase 12's `CsrmAiRun` unchanged (D-21), and the rounds, decisions, contest points, risk history, notifications and deliveries stay as Phases 16 to 20 build them. **Reversibility:** one-way - a new table holding the process record; undoing it loses every stage time.
- **D-02:** Every new read follows the chain of 17.1 D-02 and 20 D-02, with a matrix row stating all seven callers (17 D-75). Each is an API-only Function granted to `role.security_analyst` only, in both catalogue copies, joins `HUMAN_ANALYST_ONLY_OPERATIONS`, and passes the analyst insight scope with its underlying reads (07 D-14; `ANALYST_INSIGHT_UNDERLYING_READS` in `csrm-authorization.ts`), to which Phase 12's run read is added for the AI reads, so an insight never widens scope. No new IdamBox Role, and no new Requestor operation: D-17's addition rides on existing owner-scoped reads.
- **D-03:** The API changes are these groups, and no others. Paths and names are proposals; research fixes them within these families.
  1. **Closed report keys** join `ReportKey` and `GET /api/v1/reports` (07 D-13): `risk-trend` (D-13), `cycle-times` (D-09 to D-12) and `ai-assistance` (D-21 to D-23), with `period` (6 or 12) and Phase 20's report filters (assessment type, division, business unit; 20 D-22).
  2. **Report drill-downs:** one paginated read per new key, with closed parameters (the measure, the point or stage, the period), returning the records behind a figure with an equal total (D-26).
  3. **Additions** to the four existing reports and the dashboard summary (D-18, D-20).
  4. **The heat-map aggregate:** a sibling of the register list over its closed query (D-15).
  5. **Closed filters:** the register gains the four likelihood and consequence positions (each a scale label or "not on the scale") and, if Phase 20's plans add none, an exception filter; the review queue gains `stage` and `ageBand` and projects the time in the current stage (D-12).
  6. **The Requestor's own request projections** gain the time in the current stage (D-17).
  7. **Closed refusal reasons** for the new parsers join Phase 10's vocabulary.

  No write operation is added: only D-07's acts write the stage history. **Reversibility:** costly - published report shapes, filters and vocabularies.
- **D-04:** What this phase settles, narrows or reads, each named in its record:
  - **Settles Phase 11 D-43's deferral:** the control-effectiveness report splits released from under assessment; alerts keep their population and gain no stage filter, because no figure here needs one (D-20).
  - **Settles 07 record items 2 and 7 in part:** submissions and returns now leave a trace (the stage history), and job history persists through Phase 12's runs (D-21, D-24).
  - **Narrows the throughput median's sample:** time to release gets one definition from the first submission (D-11), so a request once returned to draft no longer drops out.
  - **Reads decision 13 with 07 D-19:** plotted charts are custom SVG with a data table; the heat map is a native table, so it is its own data table (D-16).
  - **Unchanged:** alerts stay derived and stateless (07 D-10); division and business unit stay filters (20 D-22).

### The stage history (DASH-05; `REPORT.md` §4 "needs status history")

- **D-05:** Stage transitions are recorded, not derived on read. The stage is derived and never stored as a status (17 D-05), and before the first round its entry times are overwritten or absent: a return to draft clears `submittedDate` (07 record item 2), a return to review clears the questionnaire's `releasedAt` (06.8), and answer submission times live inside each answer's JSON. So the round acts of Phases 17, 17.1 and 17.2 feed the same history as every earlier act, and stage times read one source (the pilot's seam). The round records stay the authority for rounds and feed the round measures directly (D-10); a test proves each round-stage episode starts and ends at its round's `openedAt` and `closedAt`. Gates never read the history (16 D-18's posture), and it follows the request's retention.
- **D-06:** The stage vocabulary, closed and owned by the contract, derived by one pure function from the facts the lifecycle already reads (Phase 11 D-02's lifecycle and holder; 17 D-05 to D-08; 17.1 D-49; 17.2 D-13):

  | Stage | The request is | With |
  |---|---|---|
  | `intake` | submitted, its questionnaire not released (or returned to review) | Security Analyst |
  | `questionnaire` | waiting for answers to a released questionnaire | Requestor |
  | `drafting` | past submitted answers, no round ever opened | Security Analyst |
  | `response` | in an open response round | Requestor and risk owners |
  | `rework` | between rounds, after a round closed, was recalled or was returned | Security Analyst |
  | `acceptance` | in an open acceptance round | risk owners and executive approvers |
  | `returned-to-draft` | a draft again after a submission (06.1) | Requestor |
  | `released` | released (and closed, G-13) | terminal |

  Labels go through the one status mapping and Phase 19's label vocabulary (the G-13 seam). Research fixes the predicate's edge cases. **Reversibility:** costly - a published vocabulary every stage figure reads.
- **D-07:** One recorder writes it. Each act that can change the derived stage calls one recorder module inside its own transaction; the recorder derives the stage from the facts as they now stand and appends a row only when it differs from the request's latest row, so an act that changes nothing writes nothing and a rolled-back act leaves no row. The acts: submit and return to draft (Phase 2; 06.1), the questionnaire's release, return to review and return to draft (06.8; 06.1), answers submitted (Phase 3), response round open and close (17 D-09, D-12), "Submit final assessment" and recall (17.1 D-21, D-25), send back (17.2 D-11), and release and close (17.1 D-42); research confirms the list against the code. `cause` names the act and `round` the round. A coverage test enumerates the acts, and an oracle test proves the latest row equals the derived stage over fixtures for every path. Any later act that can change the stage calls it too (Phase 22's manual start, G-20).
- **D-08:** History starts when this phase deploys, as Phase 16 D-19's did. Nothing is reconstructed for earlier requests: their entry times are partly lost (D-05), and an estimate would pass for a record. Their open stage reads "Not recorded" in ageing, their episodes stay out of stage samples, and each stage figure says "Stage history recorded from {date}" with the count of requests that predate it. No production deployment exists yet (STATE.md, INT-02), so production records from its first request. The development fixture (D-28) is the only other writer.

### Stage times and ageing (DASH-05 criterion 3; success criterion 3)

- **D-09:** Statistics. An episode runs from a row to the request's next row. A stage's sample is its episodes that ended within the period (6 or 12 months, the throughput control), on requests in the analyst's current scope (D-25), newest first under `THROUGHPUT_SAMPLE_CAP` with the `truncated` flag (07 D-03). The median keeps `medianDays`'s definition (07 D-13); the 90th percentile is the nearest-rank value, shown from ten episodes, otherwise "Not available" with the sample size (direction §4, KPI tiles). Both are calendar days to one decimal, computed in the pure domain module over portable reads, with no percentile or JSON SQL (R-08-37). **Reversibility:** costly - published measures.
- **D-10:** Round measures, read straight from the round records (the 17, 17.1 and 17.2 seams): response rounds per assessment and the time to each response's submission; acceptance rounds per release, with recalled and returned counts; contest points per acceptance round and the median time to their first answer; and the time from a round's opening to each risk's completing decision (17.1 D-36's completing act).
- **D-11:** Time to release has one definition: from the request's first `intake` row (or `submittedDate` where it has no history) to its `released` row (or the release triple's `approvalDate`). The throughput report's median (Phase 11 D-39) with its new 90th percentile, and the cycle-times total, read the same function over the same sample, and the sample note says which requests use the fallback.
- **D-12:** Slowest items and queue ageing.
  - **Slowest items (SC3):** each stage's median and 90th-percentile figures open the stage's episode drill-down for the period, slowest first, whose first rows are the slowest items, each opening its request, or its assessment for a round stage. The report also lists the five slowest per stage inline.
  - **Queue ageing (DASH-05 criterion 3):** the open requests in the review queue by current stage, in bands of 0–2, 3–5, 6–10 and over 10 working days since entering it (`REPORT.md` §4), plus "Not recorded" (D-08). Working days are Monday to Friday over UTC dates, with no holiday calendar; the bands and the working week sit in one configuration point in `insight-constants.ts`.
  - **Links:** each band opens the review queue with the new closed `stage` and `ageBand` filters, and Phase 13's `assignee=me` for the viewer's own work, with an equal total. The queue gains an "In stage" column.
  - **Drafts,** including requests returned to draft, never enter ageing or the queue (07 D-29).

### Trend and heat map (DASH-05 criteria 1 and 2; success criteria 1 and 2)

- **D-13:** The trend counts open released risks by residual rating at the end of each UTC month over 6 or 12 months (default 12), with the current month to date as the partial point (direction §3.14). As at an instant, a risk counts when:
  - its assessment's release (`approvalDate`) is at or before it, and it is not withdrawn (16 D-14);
  - it is not closed then: Phase 20's closure and reopen rows decide, and a closure with no row counts from its `closureDate`'s UTC day;
  - and its rating then is the `to` of its latest residual review at or before the instant, otherwise the `from` of its first later review, otherwise the live value, because after release only 20 D-14's review changes a residual rating.

  One domain rule with its SQL part proven against an oracle (07 D-21, D-30). Counts are exact or "Not available", never a partial total (07 D-03). **Reversibility:** costly - a published measure.
- **D-14:** Trend drill-down. The current point opens the register's live filters (released, open, the rating; Phase 11 D-40). Each past point opens the trend's drill-down for that month and rating, which lists each risk with its rating then and now and opens it in the register.
- **D-15:** The heat map counts risks by likelihood and consequence on the 5 × 5 scale, inherent and residual side by side.
  - **The scale:** axes, scores and bands come from the published scale (18 D-20; 17.1 D-58, so Phase 22's configuration reaches it). Every stored value is read through 18 D-21's function, values off the scale count as "Not on the scale", and withdrawn risks never count.
  - **Where:** one aggregate over the register's closed query serves the leadership view and the risk-exposure report (released and open, with the report filters and the under-assessment count beside it, decision 11), and the register's "Heat map" view of its current filters, stating their scope.
  - **Links:** each cell opens the register with the same filters plus the new position filters, with an equal total.
- **D-16:** Readable without colour (decision 13; SC2). Each cell carries its count, its band's icon and label (§3.6) and an accessible name. The matrix is a native table with likelihood row headers and consequence column headers, so it is its own data table. The trend is a custom SVG chart with direct labels and a data table (07 D-19; §3.14). Only §3.6 and §3.14 tokens. No charting dependency: a plan that wants one must show the interaction need decision 13 names.

### Metric sets per audience (DASH-04; `REPORT.md` §4)

- **D-17:** First-line people get no management metrics. Requestors, risk owners, executive approvers and treatment owners see personal figures over their own records only, which Phases 11, 13, 17, 17.1, 19.1 and 20 deliver. This phase adds one: the Requestor's "With the Security Analyst" items and My requests rows show the time in the current stage from the stage history, falling back to the days since submission (Phase 11 D-19), through the existing owner-scoped reads. Portfolio figures stay with the second line: leaders who are not analysts receive them as printed or exported reports (D-19), on G-12's need-to-know basis, with no new role.
- **D-18:** The Security Analyst set, on Home in Phase 11 D-18's order:
  - queue ageing by stage, for the team and for the viewer (D-12);
  - failed AI runs in the last seven days, beside "Generation in progress" (D-21);
  - accepted risks and exceptions due for review (D-20).

  `REPORT.md` §4's other analyst rows are delivered by Phases 11, 13, 17.1, 17.2 and 20. Alerts assigned or acknowledged stay deferred (07 record item 3).
- **D-19:** The leadership view, for risk managers and leaders, leads the Reports index (`/app/reports`; 07 D-15), analyst-only like every report, with no new nav item. It shows:
  - open released risks by residual rating now and over 12 months (SC1);
  - the heat map (SC2);
  - accepted risks and exceptions by review state;
  - time to release and stage times, with queue ageing;
  - AI assistance health.

  Each section opens its detailed report, and the report catalogue follows. The page prints on A4 through the print stylesheet, and each report exports through Phase 19's report export (19 D-22, D-36).
- **D-20:** Additions to the existing reports, each figure opening its records:
  - **`risk-exposure`:** the heat map (D-15); the most exposed Information Assets beside the systems (`EXPOSED_SYSTEMS_LIMIT`); the top Risk Types by count and severity (Phase 20 D-24's Risk Type filter); accepted risks and exceptions (the JDL's exemption fields) by review state (due soon, overdue, not confirmed) from 20 D-17's facts, opening the register's "Accepted risks" view (20 D-23) with its review-state filter.
  - **`treatment-performance`:** overdue and due-soon tracked treatments by treatment owner, through the one due rule (G-16; `treatment-due-state.ts`).
  - **`assessment-throughput`:** the 90th percentile (D-11).
  - **`control-effectiveness`:** released by default with under assessment separately, as Phase 11 D-42 did for exposure (settling D-43).

  Division and business unit stay filters until Phase 22's lists (20 D-22).

### AI job history (DASH-04 criterion 2; SC4; R-08-36, R-08-37)

- **D-21:** Persisted job history is Phase 12's run record (plan 12-01: "Phase 21 counts `failed` runs by `startedAt`"). A failed AI job is a run whose status is `failed` or `interrupted` (12 D-20), and "the last seven days" is the current UTC day and the six before (07 D-02's explicit today). Runs group by `jobId` and `attempt`, and a failed attempt whose job later completed reads "Completed on retry". A refusal before the provider call creates no run and is not an AI failure (12 D-20). The in-process registries keep a terminal job for an hour only, so they are never a metric source. **Reversibility:** costly - the published definition of a failed AI job.
- **D-22:** The failed-runs list is the `ai-assistance` drill-down: paginated, newest first, with closed filters (status, operation, window). Each row holds the operation, the target record's number and title, the initiating analyst's display name, the attempt, the times, and the failure code with its safe message. It opens its record, where Phase 10's job read offers retry while the job is still held (13 D-18). It never holds the instruction, the context summary, the proposal or any Requestor text (G-3).
- **D-23:** `ai-assistance` reports, per UTC month over the period:
  - runs by operation, provider and outcome, and the failure rate;
  - proposal outcomes (proposed, confirmed, edited, dismissed or rejected, lapsed) from the runs' decisions (the 15 and 16 seams);
  - the share of AI-written fields an analyst edited before confirming, from `aiProvenance` (12 D-21), over a capped sample.

  JSON is parsed in the domain module, never in SQL (R-08-37).
- **D-24:** The residuals. **R-08-36** stays open, re-scoped: job history now persists through the runs, while in-flight coordination (the queue, deduplication, retry) and the "Generation in progress" bucket stay process-local until Strapi runs as more than one process. **R-08-37** stays open: this phase adds no dialect-specific SQL and appends its constructs to the residual's checklist. A plan updates both rows of `docs/security/phase-08-residual-risks.md` (13 D-19's precedent).

### Who reads

- **D-25:** Every figure counts only records in the human analyst's current scopes (07 D-14):
  - drafts, requests returned to draft, withdrawn risks (16 D-14) and anything outside the register and review scopes never count;
  - a figure and its list share one definition;
  - no Phase 21 read exists for any other caller.

  The service identity is refused every one (403), whatever it holds, and Phase 22's Admin holds no analyst grant (decision 1), so it gets none.

### Interface and verification

- **D-26:** Figure links. Every figure opens the canonical list with a closed filter wherever that list can reproduce it exactly (Phase 11 D-35; X-10). Where none can (a past trend point, a stage sample, the failed runs), it opens its report's drill-down, whose total equals the figure (Phase 11 D-39's rule for a median). Every widget states its population and window ("Released, open Risks", "Completed in the last 6 months", "Started in the last 7 days", "Stage history recorded from {date}"); the UI-SPEC fixes the strings.
- **D-27:** Surfaces, with every value from `docs/design/csrm-design-direction.md`:
  - **New:** the leadership view; the three report pages; the register's "Heat map" view; the queue's "In stage" column and filters; Home's additions; the Requestor's time in stage; the drill-down lists.
  - **Extensions:** at least the trend chart and the risk matrix, proposed from the first free X-n the orchestrator gives and recorded in the direction by a plan task before the task that uses them. Reused: X-3, X-10, Phase 7's chart geometry and KPI tiles, `bar-chart.tsx` and `report-table.tsx`.
  - **The G-4 bar for a read-only phase:** a keyboard path to every figure and control; skeletons; empty states that say what to do next; comfortable and compact density on the tables; purpose-built phone forms for the matrix, the trend and the tables (the UI-SPEC decides them at 375px); no entrance motion on data (direction §5, do-not 8); every figure opens its records. Nothing here needs a confirmation or an Undo.
  - **Route budgets** (R-08-34): charts render on the server, with any client island small and zod-free, and `performance.spec.ts` stays green or records an exception.
- **D-28:** Tests and fixtures (stage2-rules §3).
  - **Strapi unit:** the stage derivation and the recorder's append-on-change rule; episodes; the median and the nearest-rank percentile with the minimum sample; working-day bands; the as-at rule against its oracle; the heat-map fold through the scale function; run grouping and the window; the AI health folds.
  - **Strapi integration** (`apps/backend/tests/*.integration.test.ts`, node:test): each D-07 act writes its row in its own transaction, and a refused or rolled-back act writes none; round episodes equal their round records; exact values for every new read and filter over controlled fixtures with an injected clock, window boundaries included (07 D-24); every figure's total equals its list's; the scope exclusions of D-25; the run list never discloses run content; matrix rows for all seven callers.
  - **Web unit (Vitest):** parsers and domain modules; the trend chart and the matrix with their table equivalence and accessible names; "Not available" and "Not recorded" states; the permission state for a Requestor at every report URL; Home's additions and the Requestor's time in stage.
  - **Playwright,** at 1440px and 375px, each run on its own records, leaving the tree clean (Phase 8 D-12; G-6): a phase spec (the planner names it) proving SC1 to SC4 with axe on each new page, a past trend point and a heat-map cell opening equal lists, a slowest item and an ageing band opening their records, and the failed runs on Home. Negatives: Maya and the risk owner persona get the permission state at every report URL, with only personal figures on Home; the API refuses them 403; matrix rows refuse the service identity. `analyst-insights.spec.ts` changes deliberately where report shapes change.
  - **Fixture:** a time-relative development fixture behind `IDAMBOX_SEED_CSRM` and the development identity, reconciled at each start like `seed-analyst-insights.ts` (07 D-23): requests with stage episodes of known lengths, releases and residual reviews in past months, and failed and interrupted runs inside and outside the window. No new persona. No journey slice: `risk-owner-journey.spec.ts` stays green with the recorder in its acts.
- **D-29:** Plan shape and size.
  - **Serialised by shared files,** one owner per file per wave: the specification and the generated client; both catalogue copies and `served-operations.json`; the matrix and the parity and chain guards; `report-definitions.ts`, `report-repository.ts`, `dashboard-summary.ts` and `insight-constants.ts`; `risk-register-query.ts` and `risk-register.ts`; `review-queue-repository.ts`; `request-lifecycle.ts` and each act's workflow file; `csrm-authorization.ts`; the web's report, dashboard, register and queue modules and `report-copy.json`.
  - **Waves:**
    1. the two records and their checkpoint, with the pure modules alongside (stage derivation, statistics, working days, the as-at rule, the heat-map fold, run grouping);
    2. the schema;
    3. the recorder in every act, with its coverage and oracle tests;
    4. stage reads: `cycle-times`, its drill-down, the queue's filters and column, and the throughput change;
    5. the trend and its drill-down, the heat-map aggregate and the register's position filters, and the existing-report additions;
    6. the AI reads;
    7. the dashboard summary and the Requestor's projections;
    8. the web: the chart and matrix primitives, the report pages, the leadership view, Home, the queue and the register view;
    9. fixtures, the phase spec, and the full gate: `api:check`, typecheck, lint, web unit, Strapi, Playwright, then a clean `git status --short`.
  - **Size:** M, at its upper end. If the plan count runs high, the trim seam is the existing-report additions (D-20) and AI assistance health beyond the failed runs (D-23), planned last.

### Planner's Discretion
- Module placement, for example: Strapi `apps/backend/src/csrm/insights/` for the pure modules, `apps/backend/src/csrm/stage-history/` for the recorder, a new API folder for the stage-history type (no routes), and new services in `apps/backend/src/api/csrm-analyst-insight/services/`; web `apps/csrm/src/components/csrm/` for the trend chart and the risk matrix, and `apps/csrm/src/features/reports/` for the report views and the leadership view.
- Names, paths, closed parameter names, reason codes and constants (the slowest-N, the minimum sample, caps), within the families above.
- Whether the leadership view reads each report or one composed read, provided each section fails independently (07 D-34); whether Home's additions extend the dashboard summary or are their own reads.
- How plans split, provided D-29's serialisation and order hold.

### Open for research
- The stage derivation over the 06.1, 06.8, Phase 3, 17, 17.1 and 17.2 facts and its edge cases (a questionnaire returned after release; a recall with no earlier response round), and the exact list of acts that can change it.
- What happens to a deleted draft's rows.
- The as-at rule's split between SQL over typed columns and a bounded read of the review rows' JSON; closures recorded before Phase 20 without a row.
- The latest-row join behind the queue's `stage` and `ageBand` filters, with working-day cut-offs bound as dates; every new construct for R-08-37's checklist.
- How interrupted runs carry `jobId` and `attempt`, and grouping across retries.
- The drill-down read's shape within 07 D-13 and D-14: a sub-resource of the report key or a sibling path.

### Open for the UI-SPEC
- The leadership view's composition at 1440px and 375px, and its print layout.
- The trend chart's form (stacked columns or small multiples) and its table; the matrix's cell anatomy with §3.6 tokens, the inherent and residual arrangement, and its phone form.
- Stage-time, round and ageing tables; "Not recorded" and "Not available"; the drill-down lists.
- The register's "Heat map" view switch and scope line; the queue's "In stage" column; Home's additions; the Requestor's wording.
- Stage labels through the one mapping, scope lines and empty states.
</decisions>

<operator_decisions>
## Decisions This Phase Depends On

All are settled in `.planning/NEXT-WAVE-DECISIONS.md`; none is open.

| Decision | What it settles here | Decisions |
|---|---|---|
| #13 Charts | Custom accessible charts with a data table; no charting library unless interaction needs grow | D-16, D-27 |
| #11 What exposure counts | Released by default, under assessment separately, accepted marked | D-13, D-15, D-20, D-26 |
| #8 Scales, matrix and appetite | The 5 × 5 axes and bands, through 18 D-20 and 17.1 D-58 | D-15 |
| #9 After release | Residual ratings change after release only through the recorded review | D-13 |
| #10 Assignment | The viewer's own work in ageing | D-12, D-18 |
| #12 Exports | The reports export; leaders outside CSRM get prints and exports | D-19 |
| #1 Admin role | The Admin holds no analyst grant | D-25 |
| #6 Removing risks | Withdrawn risks never count | D-15, D-25 |
| G-3 AI data policy | No run content in the list; pre-call refusals are not AI failures | D-21, D-22 |
| G-4, G-6 | The premium bar; the pilot approves the records; Playwright leaves the tree clean | D-27, D-28, `<contract_gaps>` |
| G-12 Who reads | Need to know: first-line people see only their own records | D-17 |
| G-13 Release and close | Stage labels in the one mapping; released means `approved` or `closed` (17.1 D-45) | D-06, D-11 |
| G-14, G-16 | Accepted risks, exceptions and the one due rule | D-20 |
| G-15 | Returned and recalled rounds, contest points and answers in stage times | D-06, D-10 |
| G-20 | Phase 22's manual start calls the recorder | D-07 |

**Conflicts:** none between the ROADMAP entry and these decisions. Readings recorded, and named in the return:
1. The ROADMAP's "status history" is a stage history, because Phase 17 D-05 keeps stages derived and never stored as statuses; the round acts feed it (D-05 to D-07).
2. "Persisted job history" is Phase 12's run record, as plan 12-01 anticipated; it needs no new type (D-21).
3. "Failed AI jobs" are failed or interrupted runs, grouped by job (D-21).
4. Decision 13's "SVG components": the heat map is a native table, its own data table; plotted charts are SVG (D-16).
5. The "leadership view" leads the Reports index and is analyst-only; leaders outside CSRM receive prints and exports (D-17, D-19).
6. Queue ageing is in working days, as `REPORT.md` §4 proposes; durations stay in calendar days, as today's median is (D-09, D-12).
7. Phase 11 D-43's deferral is settled for controls only; alerts are unchanged (D-04, D-20).
</operator_decisions>

<contract_gaps>
## Contract-Gap Records and Their Approval Checkpoint

Each record follows the format of `docs/contract-gaps/phase-06.1-revert-audit-facts.md` and the Phase 16 to 20 records: Gap, Approved Compatibility Extension, Write Discipline, What This Extension Does Not Add, Audit Semantics and Limitation, and Migration.

1. **`docs/contract-gaps/phase-21-stage-history.md`** (the ROADMAP's "status history").
   - **The gap:** no dated record of a request's stages: a return to draft clears `submittedDate` and leaves no trace of earlier submissions (07 record item 2); the questionnaire's release fact is cleared by a return to review (06.8); answer submission times live in each answer's JSON; queue ageing and stage times need entry times (`REPORT.md` §4; UAT-059).
   - **The extension:** D-01, with D-06's vocabulary and D-07's causes.
   - **Write discipline:** only the recorder writes rows, inside the transaction of a D-07 act, appending on change; the development fixture under the double development key is the only other writer; rows are never updated or deleted; no gate reads them.
   - **The rules:** D-05 to D-12.
   - **Dated amendments, summarised here:**
     - `phase-07-derived-insights.md`: the new report keys and drill-downs, items 2 and 7 settled in part, the throughput's time-to-release definition, and the control-effectiveness split;
     - the round records written by Phases 17, 17.1 and 17.2 (response rounds, acceptance rounds and decisions, release and close, contest points): each round act writes its transition in its own transaction;
     - `phase-06.1-revert-audit-facts.md` and `phase-06.8-questionnaire-governance-facts.md`: returns and releases write their transitions.
   - **Not added:** stored durations, a stored stage on the request, reconstruction of earlier history, holder changes within a stage, alert state.
   - **Migration:** none; history starts at deployment (D-08).
2. **`docs/contract-gaps/phase-21-ai-job-history.md`** (the ROADMAP's "persisted job history").
   - **The gap:** the job registries keep a terminal job for an hour in one process's memory (07 record item 7; R-08-36), so failed jobs over seven days, failure rates and AI assistance health cannot be read.
   - **The extension:** no schema change. Phase 12's `CsrmAiRun` is the persisted job history: the failed-job definition (D-21), the failed-runs drill-down and its projection (D-22), and the health measures (D-23), by a dated amendment to `phase-12-ai-run-record-and-provenance.md`.
   - **Not added:** a job entity or a shared job store (R-08-36 stays open, D-24), retry from the list, any run content in a projection.

**Approval checkpoint:** the first plan writes both records and their amendments, then a `checkpoint:decision` task at which the executor stops. Under G-6 the pilot reviews and approves each record, recording the approval in the record itself. The schema, catalogue and specification work runs only after that. The change is additive, so Strapi's schema sync creates the table and `apps/backend/database/migrations/` stays empty (the 06.1 to 20 precedent). The proof boots a fresh test database; the operator's development database shows the table after the orchestrator's next Strapi start, with earlier requests reading "Not recorded"; the content-type freeze check lists exactly the approved schema file.
</contract_gaps>

<authorisation>
## Authorisation Model and Negative Cases

Keycloak authenticates. Strapi enforces Role → Function → FunctionAPI, then the analyst insight scope with its underlying reads (07 D-14), against the resolved IdamBox User in `ctx.state`, identically under the development identity bridge and a Keycloak-verified user, never branching on the auth mode (POST-DEMO-BRIEF §2). Navigation visibility is not authorisation: every gated surface is also refused by Strapi.

**Grants (D-02, D-25):** every Phase 21 read is an API-only Function held by `role.security_analyst` only, in `HUMAN_ANALYST_ONLY_OPERATIONS`, never granted to `role.security_analyst_agent` or `role.requestor`. The Requestor's time in stage rides on existing owner-scoped reads.

**Positive cases:** any human Security Analyst holding the underlying reads reads every Phase 21 figure, report, drill-down, filter and the heat map over the analyst scopes; a Requestor reads the time in stage of their own requests.

**Negative cases** (each proven in the API by a Strapi integration test or a matrix row, and in the UI by Vitest or Playwright):

| Case | API outcome | UI outcome |
|---|---|---|
| A Requestor, risk owner, executive approver or treatment owner (Maya, Jane, the risk owner persona) calls any new report, drill-down, the heat map, the queue's new filters or Home's analyst additions | 403 (grant) | The permission state on every report, register and queue URL; their Home shows personal figures only |
| A Requestor reads another person's request, or its time in stage | 404, as today's owner scope | Not-found page |
| The service identity calls any Phase 21 read | 403 | Not applicable |
| A human analyst lacking one underlying read | 403 (insight scope) | The permission state |
| A draft, a request returned to draft, a withdrawn risk or an out-of-scope record | Never counted, listed or drilled into | Not shown |
| An unknown report key, measure, stage, period, band or position value | 400 (closed parser) | Not applicable |
| A failed-run row | Never holds the instruction, context summary, proposal or Requestor text | Not shown |
| Any write to the stage history through a route | No route exists (inventory and matrix) | Not applicable |
| Phase 22's Admin | 403: no analyst grant | The permission state |
| No identity, or no token | The matrix conventions | The sign-in path |

The seventh matrix caller (17 D-75) states its outcome on every new route.
</authorisation>

<seams>
## Cross-Phase Seams

Seams from `stage2-rules.md` that touch this phase:
- **G-16:** no due logic here. The by-owner figures read `treatment-due-state.ts`, the one rule Phase 20 switched (D-20).
- **G-13:** the stage labels join the one status mapping and Phase 19's label vocabulary with its parity test (D-06); every released population uses the released predicate over `approved` or `closed` (17.1 D-45).
- **Phase 13's assignee:** the viewer's own ageing through `assignee=me` (D-12). A named-analyst filter and per-analyst workload stay deferred (13's candidates).
- **Phase 19's exports:** the new reports export through the report export (19 D-22, D-36). The record-read check is not used: everything here is analyst-only. Drill-down lists do not export in this phase.
- **Phase 14's attachments and the security event log:** not touched; reads are not logged, and exports log through Phase 19.
- **Phase 17's fixtures:** no new persona; the risk owner persona and Maya prove the refusals.
- **Phase 18's bulk edits:** they change no stage; the heat map reads 18 D-21's function.
- **Phase 21's stage times include the response, acceptance and rework rounds:** this phase (D-05 to D-07, D-10).
- **Phase 22:** the scale and bands reach the heat map through `risk-scale.ts` (17.1 D-58); the ageing bands and working week sit in one configuration point; the Admin gets no metrics (decision 1); its manual start calls the recorder (G-20).
- **The post-demo journey:** no slice; it stays green with the recorder in its acts (D-28).

Other seams:
- **Phase 7:** the closed report keys, the insight scope, the chart primitives, the seed pattern, and record items 2, 3, 7 and 9.
- **Phase 11:** Home's order (D-18), X-10 (D-35, D-39), exposure (D-40 to D-42), D-43 settled (D-20).
- **Phase 12:** the run record (D-19 to D-21) and plan 12-01's "Later Phases".
- **Phases 15 and 16:** proposal outcomes from the runs' decisions; withdrawn risks excluded (16 D-14).
- **Phases 17, 17.1 and 17.2:** the round acts write transitions (record amendments); the round measures read their records (D-10).
- **Phase 19.1:** notifications are not a metric source.
- **Phase 20:** the history's review, closure and reopen rows feed the trend; D-17's review facts; the report filters; the "Accepted risks" view.
</seams>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/uat/product-gaps/FINDINGS.md`: UAT-059 in full (and UAT-001, UAT-048 and UAT-060 for the figure rules).
- `.planning/uat/product-gaps/REPORT.md`: §4 (the metric sets per audience and their feasibility), §5 (the sidebar), and §8's Phase 21 entry.
- `.planning/POST-DEMO-BRIEF.md`: §1 and §2 (overrides, dev-mode rules).

### Planning authority
- `.planning/ROADMAP.md`: the Phase 21 entry (goal, decisions, contract line, four success criteria) and the 13, 17 to 17.2, 18, 20 and 22 entries for the seams.
- `.planning/REQUIREMENTS.md`: DASH-04 and DASH-05; DASH-03, UX-09 and RISK-03 for the figure and scope rules.
- `.planning/NEXT-WAVE-DECISIONS.md`: decisions 1, 6, 8 to 13 and their notes; G-3, G-4, G-6, G-12 to G-16 and G-20.
- `.planning/STATE.md`: Decisions, and "Risks and Open Decisions" (R-08-36, R-08-37; INT-02's deployment).
- `.planning/phases/07-analyst-dashboard-reports-and-alerts/07-CONTEXT.md` (D-01 to D-03, D-10, D-13 to D-15, D-19, D-21, D-23, D-24, D-29, D-30, D-34) and `07-UI-SPEC.md` (its chart extensions).
- `.planning/phases/11-navigation-landing-and-list-clarity/11-CONTEXT.md` (D-02, D-18, D-19, D-35, D-39 to D-43), `11-UI-SPEC.md` (X-10, §8.1) and plans `11-15-PLAN.md` and `11-17-PLAN.md`.
- `.planning/phases/12-ai-context-suggestions-and-provenance/12-CONTEXT.md` (D-19 to D-21) and `12-01-PLAN.md` (the run record's "Later Phases").
- `.planning/phases/13-request-pick-up-and-notes/13-CONTEXT.md` (D-13, D-15, D-18, D-19, the Phase 21 seam).
- `.planning/phases/16-risk-curation-and-targeted-ai-re-runs/16-CONTEXT.md` (D-14, D-18, D-19, S-12).
- `.planning/phases/17-mitigation-response-and-residual-reassessment/17-CONTEXT.md` (D-01, D-05 to D-09, D-12, D-75, the Phase 21 seam, Orchestrator Confirmations).
- `.planning/phases/17.1-review-peer-approval-and-risk-acceptance/17.1-CONTEXT.md` (D-21, D-22, D-25, D-32, D-33, D-36, D-42, D-45, D-49, D-58, the Phase 21 seam, Orchestrator Confirmations).
- `.planning/phases/17.2-contest-points-and-rework-rounds/17.2-CONTEXT.md` (D-01, D-11, D-13, the Phase 21 seam, Orchestrator Confirmations).
- `.planning/phases/18-risk-table-and-spreadsheet-interoperability/18-CONTEXT.md` (D-20, D-21, the Phase 21 seam).
- `.planning/phases/19-csv-export-and-import-hardening/19-CONTEXT.md` (D-07, D-22, D-36).
- `.planning/phases/20-oversight-registers-and-post-release-tracking/20-CONTEXT.md` (D-09, D-14, D-15, D-17, D-19, D-22 to D-24, the Phase 21 seam).
- `.planning/phases/15-steerable-questionnaire-ai/15-CONTEXT.md` (D-01, the Phase 21 seam).

### Product, domain and contract
- `CONTEXT.md` (repository root): Released, Released for response, Submit final assessment, Closed, Withdrawn (Risk), Contest point.
- `docs/CSRM-PROJECT-BRIEF.md` §10 (dashboards).
- `docs/references/idambox-datamodel.jdl` (`CsrmAssessmentRequest`, `CsrmAssessment`, `CsrmRisk` ratings and exemption fields; no history entity).
- `docs/references/specification.json` (`ReportKey`, the report and dashboard schemas, `GET /v1/reports/{reportKey}` with `period`); `docs/references/served-operations.json`.
- Both catalogue copies: `function.reports.*`, `function.dashboard.*` and the human-only API Function pattern.
- `docs/contract-gaps/phase-07-derived-insights.md` (items 2, 3, 7 and 9), `phase-06.1-revert-audit-facts.md` (format), `phase-06.8-questionnaire-governance-facts.md`, and, once written, the Phase 12, 16, 17, 17.1, 17.2 and 20 records.
- `docs/security/phase-08-residual-risks.md`: R-08-34, R-08-36 and R-08-37.

### Design and framework
- `docs/design/csrm-design-direction.md` and `docs/adr/0001-adopt-bproton-design-system.md`: §3.6 risk severity, §3.14 data visualisation and chart geometry, §4 Cards and KPI tiles, DataTable, Record links, Skeletons, Empty states, Print; §5 Motion; §6 Do-not list.

### External
- ISO/IEC 27001:2022 clause 9.1 (monitoring and measurement) and ISO/IEC 27005:2022 (monitoring and review); the Three Lines Model (IIA, 2020); WCAG 2.2 AA (1.4.1 use of colour, 1.4.11 non-text contrast).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/api/csrm-analyst-insight/services/`: `report-definitions.ts` (`REPORT_KEYS`, the closed set), `report-query.ts` (the period parser), `report-repository.ts` (database group-bys; the throughput sample, newest first under a cap), `dashboard-summary.ts` (`DashboardSummaryFigures`), `insight-scope.ts` (`assertAnalystInsightScope`).
- `apps/backend/src/csrm/insights/`: `report-math.ts` (`medianDays`, month buckets, closed partitions), `insight-constants.ts` (`THROUGHPUT_PERIODS` 6 and 12, `THROUGHPUT_SAMPLE_CAP` 5,000, `EXPOSED_SYSTEMS_LIMIT`), `utc-date.ts`, `treatment-due-state.ts`.
- `apps/backend/src/policies/csrm-authorization.ts`: `HUMAN_ANALYST_ONLY_OPERATIONS`, `ANALYST_INSIGHT_UNDERLYING_READS`, `requireAnalystInsightScope`.
- `apps/backend/src/api/csrm-assessment-request/services/request-lifecycle.ts` (`REQUEST_LIFECYCLE_STEPS`, `highestMatchingStep`) and `review-queue-repository.ts` (buckets as database predicates with an oracle).
- `apps/backend/src/api/csrm-risk/services/risk-register-query.ts` (the closed register filters, including `system`, `asset` and `treatmentOwner`) and `risk-register.ts`.
- The job registries: `apps/backend/src/api/csrm-assessment/services/assessment-draft-registry.ts` and `apps/backend/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts` (in memory; a terminal job kept for one hour, at most 500; a retry keeps the job id and raises `attempt`).
- The acts D-07 hooks: `request-workflow.ts` (submit, return to draft), `questionnaire-governance-workflow.ts` (release, return to review), `questionnaire-workflow.ts` (answers), and the round, acceptance, contest and release services that Phases 17 to 17.2 add.
- `apps/backend/src/bootstrap/seed-analyst-insights.ts` (the time-relative fixture pattern).
- Web: `apps/csrm/src/components/csrm/bar-chart.tsx` (ink and severity tones, labelled-values and figure-with-table forms, the partial period), `kpi-tile.tsx`, `record-link.tsx`, `data-table.tsx`; `apps/csrm/src/features/reports/` (report views, `report-table.tsx`, `report-period-control.tsx`, `report-copy.json` as the canonical copy); `features/analyst-dashboard/` and `features/dashboard/requestor-dashboard.tsx`; routes `apps/csrm/app/(app)/app/reports/(report-index)` and `[reportKey]`.
- Planned by earlier phases: Phase 12's `CsrmAiRun` and `aiProvenance`; Phase 16's `CsrmRiskHistoryEvent` with Phase 20's review, closure and reopen kinds; the round, decision and contest-point entities of 17 to 17.2; Phase 18's published scale and `risk-scale.ts` reader; Phase 20's report filters, review facts and "Accepted risks" view.

### Established Patterns
- Figures computed on read from recorded facts, with an explicit UTC today (07 D-01, D-02); database aggregates and bounded reads (07 D-03).
- Closed report keys and closed parsers; an insight never widens scope (07 D-13, D-14).
- One rule with an SQL mirror proven equal by an oracle (07 D-21, D-30).
- Append-only history that no gate reads, recorded from a date (06.8; 16 D-18, D-19).
- Time-relative development fixtures behind the seed flag and the development identity (07 D-23).
- The server computes and links; the web formats; zod-free domain modules for client components.

### Integration Points
- **Strapi:** the insight services and policy; the queue and register; each D-07 act; a new stage-history API folder; both catalogue copies and the specification.
- **Web:** the Reports index and report pages; the analyst Home; the queue; the register; the Requestor Home and My requests.
- **Tests:** the matrix and harness, the integration suites, Vitest beside each module, the phase spec, and `analyst-insights.spec.ts` and `performance.spec.ts` where they change.
</code_context>

<specifics>
## Specific Ideas

- **The quarterly risk committee.** The lead analyst opens Reports. Open released risks: 4 Critical, 11 High, down from 7 and 15 in March; the 12-month trend shows the fall after two residual reviews. The residual map shows nothing left at Almost certain × Severe, with "2 risks under assessment are not shown". Time to release is a median 24 days and a 90th percentile of 51; acceptance rounds are the slowest stage, and its slowest item is a vendor assessment returned twice. Three accepted risks are due for review this month. She prints the page for the committee and exports the risk-exposure workbook.
- **An analyst's morning.** Home shows two requests over 10 working days in `questionnaire` (waiting on Requestors) and one in `rework` assigned to her. "Failed in the last 7 days: 2" opens two draft runs that timed out against the provider; one reads "Completed on retry".
- **A Requestor.** Jane's Home says her request has been with the Security Analyst for 3 days in this stage. Maya, or the risk owner persona, opening `/app/reports` gets the permission state, and the API refuses them.
- **Development database.** The table reaches the operator's development database at the orchestrator's next Strapi start; earlier requests read "Not recorded", and the fixture's records show every figure.
</specifics>

<deferred>
## Deferred Ideas

- Alert acknowledgement and assignment (07 record item 3).
- Breakdowns by division and business unit (Phase 22's lists).
- Per-analyst workload, a named-analyst queue filter, time to pick-up and reassignment counts (13's candidates).
- Recent-activity entries and a per-request stage timeline from the stage history.
- Reconstructing stage history for earlier requests.
- A holiday calendar for working days, and Admin-configurable ageing bands.
- Trends of other measures (stage times or exposure by type over time), and forecasting.
- A heat map on participant or Requestor views; saving the register's heat-map view in saved views.
- Exporting the drill-down lists.
- Portfolio metrics for first-line leaders, which would need a role decision.
- Counting rating overrides (18's seam).
- A shared job store for more than one Strapi process (R-08-36), and the suites on PostgreSQL (R-08-37).
</deferred>

## Seeds Confirmed or Corrected

- **DASH-04 and DASH-05; closes UAT-059; decision 13; `REPORT.md` §4's sets plus accepted risks and exemptions due for review:** confirmed (`<requirements>`, D-17 to D-20). **Precisions:** the heat map is a native table, its own data table (D-16); the leadership view leads the Reports index (D-19).
- **Aggregate reads with closed report keys (07 D-13, D-14):** confirmed, with three new keys and a paginated drill-down per key for figures no canonical list can reproduce (D-03, D-26).
- **Status history and persisted job history: records first, then a checkpoint:** confirmed, corrected:
  - the status history is a stage history of derived stages (D-01, D-05 to D-08);
  - persisted job history needs no new type: it is Phase 12's run record, as plan 12-01 anticipated, so its record is an amendment with no schema change (D-21);
  - R-08-36 stays open, re-scoped to in-flight coordination; R-08-37 stays open, with this phase's constructs added (D-24).
- **Stage times including the response, acceptance and rework rounds; where transitions are recorded:** decided as a stage history that the round acts feed, not derivation from the round records alone, because before the first round the entry times are overwritten or absent (D-05). The round records stay the authority for rounds and feed the round measures directly (D-10). Medians and 90th percentiles open the slowest items (D-12).
- **The leadership trend, the heat map readable without colour, failed AI jobs for analysts:** confirmed (D-13 to D-16, D-18, D-21, D-22). **Precision:** a failed AI job is a failed or interrupted run, grouped by job, with recovery shown.
- **Every figure opens its records; only readable records count; the service identity refused; Requestors see no management metrics:** confirmed (D-17, D-25, D-26, `<authorisation>`). **Added:** the Requestor's one personal addition, the time in the current stage (D-17).

## Orchestrator Confirmations (2026-10-01, post-demo Stage 2)

The research raised three questions. Each is settled as follows and binds the plans:

- **Deleting a request with stage history** is refused with 409 `REQUEST_HAS_STAGE_HISTORY`, beside Phases 13, 14 and 16's delete refusals. A draft that was never submitted has no rows and stays deletable.
- **The trend fixture's write exception:** record 1's amendments include `docs/contract-gaps/phase-16-risk-withdrawal-and-history.md`. The development fixture may set the times of history rows it creates, through the development seed path only and never through any API. The rows stay append-only for every other writer.
- **Time to release ends at `approvalDate`** (D-11). The released stage row is written at that same instant.
- **Recorder findings bind the plans (21-RESEARCH):** the recorder compares against the stage before the act and takes its time from the act. Submission is wrapped in `withRequestLock`, and the questionnaire acts take the request lock first, so the lock order is the same everywhere.

---

*Phase: 21-management-dashboards-and-metrics*
*Context gathered: 2026-10-01*
