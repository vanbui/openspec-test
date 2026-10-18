# CSRM Product Gap UAT — Report

Hands-on acceptance test of IdamBox Cyber Risk Manager (CSRM) against the operator's intended product (`BRIEF.md`), run on 2026-09-27 on branch `uat-trial`. The full register is `FINDINGS.md` (and `FINDINGS.csv`); the step-by-step log, AI job log and record list are in `JOURNEYS.md`; screenshots are in `evidence/`.

## 1. Summary

Today's CSRM is a careful, working v1.0 of a narrower product than the one the operator now wants. All three scenarios ran end to end (a Project request for a vendor payroll platform, a BAU partner API at phone width, and an "Other" external AI service raised by a second requestor): request, AI questionnaire, answers, AI risk draft, analyst review and release. There was no blocker: no data-isolation failure, no data loss of saved work, and every refusal tested was enforced by the server. The distance to the intended product is in the middle of the flow and around it. The requestor cannot take part between questionnaire and release (F8), nobody can add files or notes once a request is submitted (F1, A1), the AI runs once per stage with no steering or re-run (F4, A2, F7, F9), risks are edited one 34-field card at a time with no table, copy-out or paste-in (Q4), nothing exports (Q3), and oversight has one register with no BAU or Project view and no tracking after release (O1). There is no Admin role (R1). The AI features are fast (12–25 s) and relevant, but the draft generator receives only answer values keyed `q-1`…`q-15` and three hard-coded Risk Types (read from the code, and consistent with the output): every draft had exactly three risks, no controls and no system links, and one stated a fact nobody gave. Several existing screens need fixing first: adding a question to an AI questionnaire always fails, the analyst cannot see the requestor's third-party and regulatory details, unsaved answers are lost silently, and the released assessment shows controls as internal IDs.

**65 findings.** By type: Gap 21, Defect 26, UX 18, Improvement 0. By severity: blocker 0, major 31, minor 33, cosmetic 1.

| Type | blocker | major | minor | cosmetic | Total |
|---|---:|---:|---:|---:|---:|
| Gap | 0 | 20 | 1 | 0 | 21 |
| Defect | 0 | 9 | 16 | 1 | 26 |
| UX | 0 | 2 | 16 | 0 | 18 |
| Improvement | 0 | 0 | 0 | 0 | 0 |
| Total | 0 | 31 | 33 | 1 | 65 |

## 2. Top 15 gaps, ranked by value to users

| Rank | Finding | Gap | Intent |
|---:|---|---|---|
| 1 | UAT-025 | The requestor cannot see or respond to the initial risks before release | F8 |
| 2 | UAT-055 | An assessment's risks can only be edited one 34-field card at a time, with no table view (ten risks: 60 clicks, 110 keystrokes, about 36,800px of scrolling, ten saves) | Q4 |
| 3 | UAT-013 | Neither actor can add information to a request once it is submitted | A1 |
| 4 | UAT-012 | A request cannot carry supporting files, at intake or later | F1, A1 |
| 5 | UAT-018 | Once any answer exists there is no AI re-run of the question list | A2 |
| 6 | UAT-028 | The AI cannot be re-run for one risk or to propose additional risks | F7 |
| 7 | UAT-049 | Nothing can be exported, from any register, list, assessment, report or queue | Q3 |
| 8 | UAT-017 | The analyst cannot give the AI more information or ask it to add, change or remove questions | F4 |
| 9 | UAT-046 | Once released, risks cannot be updated, so the register cannot track treatment to closure | O1 |
| 10 | UAT-014 | Analysts cannot pick up, claim or assign a request | F2 |
| 11 | UAT-027 | A risk cannot be deleted, so a wrong AI-proposed risk can only be rewritten or released | F7 |
| 12 | UAT-045 | There is no BAU, Project or Other view anywhere | O1 |
| 13 | UAT-026 | No AI write-up of residual risk after mitigations are recorded | F9 |
| 14 | UAT-056, UAT-057 | Copying risks out gives one column of labels and values; pasting an Excel range drops everything into one text box | Q4 |
| 15 | UAT-061 | There is no Admin role and no user or role management | R1 |

Just outside the list: UAT-058 (owners cannot see their risks), UAT-059 (management metrics), UAT-008 (free-text likelihood and consequence), UAT-050 (no risk import) and UAT-047 (reference records do not show their use). The defects that most affect today's users are UAT-016 (adding a question always fails), UAT-030 and UAT-029 (the AI draft is blind to most of the context and limited to three Risk Types), UAT-015 (the analyst cannot see third-party and regulatory details), UAT-021 (unsaved answers lost), UAT-033 (released controls shown as IDs) and UAT-006 (a 2,647-option control dropdown).

## 3. The intended product, built or not

| ID | Intended capability | Status | What exists today | Findings |
|---|---|---|---|---|
| R1 | Admin manages roles, registers and lists | Not built | Analysts administer reference data; roles are assigned outside the web app | UAT-061 |
| R2 | Analyst carries out the assessment | Built | Security Analyst role with review, AI, editing and release | UAT-014 |
| R3 | Requestor submits a request | Built | Automatic Requestor role | UAT-062 |
| F1 | Request with context plus PDFs, documents and spreadsheets | Partly built | Structured request, searchable systems and assets; no files; analyst cannot see third-party and regulatory fields | UAT-012, UAT-015, UAT-030 |
| F2 | An analyst picks up the request | Partly built | Shared queue with status buckets; no pick-up or assignee | UAT-014, UAT-035 |
| F3 | AI generates initial questions | Built | Asynchronous job, 12–15 s, relevant but technical and all required | UAT-030, UAT-041, UAT-043 |
| F4 | Analyst edits, adds, or steers the AI to add, edit or delete questions | Partly built | Edit and delete work; add fails on AI questionnaires; no AI steering | UAT-005, UAT-016, UAT-017, UAT-019 |
| F5 | Analyst releases; requestor answers | Built | Release, answer, save, submit, return to review with answers kept | UAT-020, UAT-021, UAT-022, UAT-023, UAT-064 |
| F6 | AI drafts the initial risks | Built, with major quality gaps | One draft per request, 20–25 s; three risks, one per hard-coded type; no controls or scope links | UAT-029, UAT-030, UAT-031, UAT-032, UAT-042, UAT-044 |
| F7 | Analyst edits, deletes or re-runs the AI for one risk or new risks | Partly built | Edit and manual add; no delete; no AI re-run | UAT-008, UAT-009, UAT-010, UAT-027, UAT-028, UAT-034, UAT-055 |
| F8 | Initial risks released to the requestor, who responds with mitigating controls | Not built | Requestor sees nothing until final release | UAT-025 |
| F9 | AI writes up residual risk after mitigations; analyst reviews or re-runs | Partly built | Analyst records controls alone; residual values come from the first draft | UAT-006, UAT-026, UAT-031 |
| F10 | Analyst reviews and submits | Built | Readiness checklist, confirmation, read-only release | UAT-011, UAT-033, UAT-040 |
| A1 | Either actor adds documentation or text at any point | Not built | Only workaround: requestor reopens and edits answers | UAT-012, UAT-013 |
| A2 | New information triggers an AI re-run that keeps answered questions | Partly built | Manual Return to review keeps fitting answers; no AI re-run | UAT-018, UAT-019 |
| O1 | Registers for BAU, Project and other assessments | Partly built | One Risk Register with 12 filters, four reports; no type dimension; frozen at release | UAT-045, UAT-046, UAT-058, UAT-060 |
| O2 | Lists of systems, controls and similar | Partly built | CRUD and import for four lists; no usage links; weak seeded content | UAT-007, UAT-047, UAT-053 |
| Q1 | Informative dashboards with impactful metrics | Partly built | Requestor and analyst dashboards with accurate, linked counts; wrong landing for analysts; no management metrics | UAT-001, UAT-003, UAT-004, UAT-059, UAT-060 |
| Q2 | A sidebar divided into clear sections | Partly built | Capability-driven sidebar; ten ungrouped analyst items; labels differ from pages | UAT-002, UAT-065 |
| Q3 | Smooth CSV import and export | Partly built | Careful five-step import for four lists; no export anywhere | UAT-049, UAT-050, UAT-051, UAT-052 |
| Q4 | Risks as a table with copy and paste both ways | Not built | Per-risk cards only | UAT-055, UAT-056, UAT-057 |
| Q5 | Requestor feels guided; analyst feels in control | Partly built | Clear stepper and next action; vague copy, lost input, misleading refusals, no progress view | UAT-003, UAT-021, UAT-022, UAT-023, UAT-036, UAT-043 |

Built 6, partly built 12, not built 4.

## 4. Dashboard metrics proposal (Q1)

Every widget's figures matched the records created in this run, and most widgets link to the filtered list behind them (`JOURNEYS.md` area 8). What is missing is the right landing page per actor and the management questions (UAT-001, UAT-003, UAT-058, UAT-059, UAT-060). "Supported" means today's data model can produce the metric (a new read may still be needed); "Partly" means an approximation is possible; "Needs" names what is missing.

### Requestor ("what do I need to do, and what happens next?")

| Metric or widget | Data source | Supported today? |
|---|---|---|
| Needs my action: requests to complete, questionnaires to answer (with required-unanswered counts), returned items with the reason | Derived lifecycle and next-action actor; questionnaire progress | Supported |
| With the Security Analyst: my requests waiting, with days since submission | `submittedDate`, derived stage | Partly: time in the current stage is not stored; days since submission or last update as a proxy |
| My released assessments by overall rating | `overallRating`, `approvalDate` | Supported (exists) |
| My risks and treatments: risks where I am risk, treatment or control owner, due soon and overdue | `riskOwner`, `treatmentOwner`, `controlOwner`, `targetDate`, `treatmentResolveDate` | Needs an owner-scoped risk read for non-analysts (UAT-058) and post-release tracking (UAT-046) |
| Due dates for my requests | `dueDate` | Supported |
| Messages from the analyst | — | Needs notes (UAT-013) and notifications (NOTIFY-01) |

### Security Analyst ("what should I do next, and is anything stuck?")

| Metric or widget | Data source | Supported today? |
|---|---|---|
| My work by stage (assigned to me) | Assignee | Needs an assignee relation (UAT-014; contract gap) |
| Team queue by stage with ageing (0–2, 3–5, 6–10, over 10 working days) | Derived stage, `submittedDate`, `releasedAt`, answer `submittedAt`, `generatedDate`, `updatedAt` | Partly: stage entry times are overwritten on revert or return; exact ageing needs a status history (contract gap) |
| Questionnaires waiting on requestors, oldest first | `releasedAt`, answer state | Supported |
| Assessments in review with outstanding release requirements | Release readiness projection | Supported |
| Generation jobs running and failed in the last 7 days, with retry | Job registry | Partly: held in memory, lost on restart and readable only by the initiator (R-08-36); a team view needs a persisted job summary |
| Overdue and due-soon treatments by owner | `treatmentOwner`, `targetDate`, derived due state | Supported |
| Upcoming reviews (assessment next review, risk exemption review) | `nextReviewDate`, `exemptionReviewDate` | Supported |
| Alerts assigned to me or acknowledged | Alert state | Needs persisted alert state (07 D-06; Phase 7 gap item 3) |

### Risk manager and leadership ("where is our risk, is it improving, and is the process keeping up?")

| Metric or widget | Data source | Supported today? |
|---|---|---|
| Open released risks by residual rating, with the trend over 6 and 12 months | Risk ratings, `createdAt`, `closureDate`, `approvalDate` | Partly: current counts supported; an open-count trend can be rebuilt from creation and closure dates, but rating changes over time need history; separate unreleased proposals (UAT-060) |
| Inherent versus residual heat map (likelihood by consequence) | Likelihood and consequence fields | Needs controlled scales (UAT-008): today they are free text, and "Major" and "High" both appear as consequences |
| Exposure by assessment type (BAU, Project, Other) | Request `assessmentType` through assessment and risk | Supported by the data; needs an aggregate read (UAT-045) |
| Exposure by division and business unit | Request `division`, `businessUnit` | Partly: free text; needs normalised lists (operator decision) |
| Most exposed systems and assets | `informationSystemImpacted`, `informationAssetImpacted` | Supported (systems already in the exposure report) |
| Top Risk Types by count and severity | `riskType` | Supported, but meaningless until the AI can use the whole library (UAT-029) |
| Time to release (median and 90th percentile), throughput per month | `submittedDate`, `approvalDate` | Supported (median exists) |
| Cycle time per stage | Stage timestamps | Needs status history (contract gap) |
| Overdue treatments by owner and division | `treatmentOwner`, due state, `division` | Supported (division free text) |
| Control effectiveness: implementations by status and rating; planned controls past due | Control implementation fields | Supported (exists), but frozen at release (UAT-046) |
| Accepted risks and exemptions with review dates | `treatmentAction` Accept, `isExempted`, `exemptionReviewDate` | Supported (the AI never proposes Accept, UAT-044) |
| AI assistance health: jobs per week, failure rate, share of AI-proposed fields changed by analysts | Job registry, provenance | Needs persisted jobs and per-field provenance (UAT-032) |

**Presentation rules.** One landing dashboard per actor, the analyst's leading with their queue (UAT-001); every figure links to its filtered list (extend to the reports, UAT-048); each widget states its scope ("released risks only", "last 12 months"); trends and the heat map need a charting approach, which 07 D-19 currently rules out (operator decision).

## 5. Proposed sidebar for each actor (Q2)

Principles: sections named by job; labels identical to page headings; counts on items that hold work; the primary action as a button, not a nav item; one "Home" per actor. Usage in the journeys (`JOURNEYS.md` area 9) shows analysts start almost everything from the request queue and never used their personal "My …" items, while requestors worked from the dashboard panels rather than the sidebar.

### Requestor

| Section | Label (page heading) | Description | Change from today |
|---|---|---|---|
| — | **New request** (button) | Start a new assessment request | Was a nav item |
| — | Home | What needs your action, and where your requests are | Renamed from "Workspace"; heading "Home" |
| My work | My requests (badge: needs action) | Requests you raised and their stage | Unchanged route |
| My work | Questionnaires to answer (badge: open) | Questions from the Security Analyst | Renamed from "My Questionnaires" |
| My work | My assessments | Released results for your requests | Renamed from "My Risk Assessments" |
| My work | My risks and treatments | Risks and treatments you own (after UAT-058) | New |

### Security Analyst

| Section | Label (page heading) | Description | Change from today |
|---|---|---|---|
| — | Home | Your queue, deadlines and alerts | Merges "Workspace" and "Analyst dashboard"; lands on the analyst view |
| Assessment work | Requests (badge: needs attention) | Submitted requests to pick up and progress | Renamed from "Assessment Requests"; heading matches |
| Assessment work | Questionnaires | Questionnaires in review, released or submitted | Heading case fixed |
| Assessment work | Risk assessments | Drafts in review and released assessments | Heading matches |
| Oversight | Risk register | All risks across assessments, with saved views by type | Moved into a section |
| Oversight | Alerts (badge: overdue) | Overdue and due-soon work | Moved from "Reports" |
| Oversight | Reports | Exposure, treatment, throughput and control reports | Section renamed |
| Reference data | Systems · Information assets · Controls · Risk types | Lists that assessments use | Renamed from "Administration"; moves to the Admin role if R1 is adopted |
| My own requests (collapsed) | My requests · New request | Requests you raised as a requestor | Moved from the top; collapsed by default |

### Admin (if R1 is adopted)

| Section | Label | Description |
|---|---|---|
| — | Home | Configuration health: lists, scales, AI-eligible Risk Types |
| Reference data | Systems · Information assets · Controls · Risk types | Maintain and import reference lists |
| Configuration | Lists and scales | Divisions, business units, likelihood and consequence scales, risk appetite |
| Configuration | AI settings | Which Risk Types and controls the AI may propose |
| People | Roles (read-only unless approved) | Who holds which role |

What moves, merges or goes: "Workspace" and "Analyst dashboard" merge into one Home per actor; the analyst's personal items collapse to the bottom; "Reports" becomes "Oversight" with the register and alerts; "Administration" becomes "Reference data"; "New request" becomes a button; every label matches its page heading. On phones the drawer shows the same sections, with the analyst's personal section collapsed so the drawer no longer scrolls.

## 6. CSV import and export requirements (Q3)

### What works today (keep)
Five-step import for Risk Types, Controls, Information Systems and Information Assets: guidance with required columns and allowed values, template download, a UTF-8 check, preview with Create, Update, Unchanged, Rejected and Ambiguous counts and CSV row numbers that match Excel, per-row errors, update diffs ("field: old → new"), a reviewed checkbox before commit, results with "View record" links, error and result reports. BOM, CRLF, quoted commas, doubled quotes, in-cell line breaks, leading zeros (`0042`), case-insensitive enumeration values and Excel's TRUE/FALSE all worked (`JOURNEYS.md` area 6).

### Import requirements
1. Match headers case-insensitively and by display label; ignore unknown columns with a warning; name any offending header (UAT-051).
2. Detect Windows-1252 and explain "Save as CSV UTF-8" instead of rejecting with "not valid UTF-8" (UAT-051).
3. Accept Yes/No, Y/N and TRUE/FALSE for flags; accept dd/mm/yyyy and ISO dates where date columns exist (for risk rows); keep leading zeros.
4. Treat blank cells as "no change" (as today) and support an explicit clear token.
5. Flag case- or whitespace-only name matches as "Matched by similar name" needing a choice (UAT-052).
6. Templates with display headers, an example row and allowed values, offered as CSV and as XLSX with a notes sheet.
7. Error reports that are the original rows plus an "Issues" column, with a BOM, so they can be fixed and re-imported.
8. Importable relations: a system's owner (by email or name) and a Risk Type's applicable controls (by control number).
9. Beyond Administration: import rows into an assessment's risks (create and update by risk number) and bulk control implementations (by risk number and control number), with the same preview (UAT-050). Keep request intake form-based; a portfolio import for scheduled BAU reviews can wait.

### Export requirements
Every export: follows the current filters, search and sort; lets the user choose columns (default: the visible columns); offers CSV (UTF-8 with BOM) and XLSX; is scoped server-side to what the viewer may read (requestors only their own released records); neutralises values starting with `=`, `+`, `-`, `@`, tab or carriage return against formula injection; names the file after the view and date; and is a Strapi operation with exact grants (no frontend facade, 01 D-15).

| Screen | Export expected | Notes |
|---|---|---|
| Risk Register | CSV and XLSX of the filtered register | Most requested; include assessment, request title, assessment type |
| An assessment's risks (analyst) | CSV and XLSX of the risk table | Same columns as the table view |
| Released assessment (requestor) | XLSX of risks and controls; PDF summary | Read-only, own records only |
| Review queues and assessment list | CSV | Workload reporting |
| Reports and analyst dashboard | CSV of each table; XLSX with one sheet per table | Leadership packs |
| Alerts | CSV | Chasing owners |
| Reference lists | CSV in the import template's format | Enables the spreadsheet round trip that is impossible today |
| My Requests | CSV | Low priority |

## 7. Risk table requirements (Q4)

**Why.** Each risk is a 34-field card about 2,450px tall; ten risks make a 37,251px page whose first risk starts at y 12,378, beside and below a 146-row readiness column. Updating three fields on ten risks took 60 clicks, 110 keystrokes, about 36,800px of scrolling and ten saves; keyboard users need 177 Tab presses to reach the first risk (UAT-055, UAT-063). Copying out gives one column of labels and values (UAT-056); pasting a range puts everything in one text box (UAT-057). There is no delete (UAT-027), import (UAT-050) or export (UAT-049).

**The table**
- One row per risk in the assessment, responsive with 100 or more rows. Default columns: Risk number (frozen), Risk statement, Risk Type, Category, Inherent likelihood, Inherent consequence, Inherent rating, Residual likelihood, Residual consequence, Residual rating, Treatment action, Treatment plan, Risk owner, Treatment owner, Target date, Treatment resolve date, Treatment status, Control count (links to the controls), Impacted system, Impacted asset, Data classification. Every other risk field available through a column chooser.
- Sort by any column; filter per column (text contains, pick list, date range, "is empty"); quick search; frozen first column and header row; column resize and reorder; row count and "n selected".
- Saved views in the manner of a SharePoint list: named column sets, filters and sort ("Treatment plan", "Ratings review", "Owners and dates"), personal by default and shareable with the analyst team, with a default view per actor.
- Rating chips with text (never colour alone), and an AI-proposed marker per cell until an analyst accepts or edits it (UAT-032).

**Editing**
- Inline editing with editors that fit the type: pick lists for enumerations (ratings, likelihood and consequence scales, treatment action and status, classification, Risk Type); a user search for owners; a date picker that accepts local formats (dd/mm/yyyy); multi-line text in an expanding editor; a searchable control picker.
- Validation per cell with the server's rules; fields required for release are flagged, not blocked, while drafting; errors shown in the cell and in a row status column.
- Visible unsaved changes (changed-cell marker and "n unsaved changes" bar), explicit "Save changes" with optional autosave, "Discard", and undo and redo within the session.
- Derived ratings (likelihood × consequence, once the operator fixes the matrix) recalculate as you type and can be overridden with a reason (UAT-008).

**Keyboard (WCAG 2.2 AA grid pattern)**
- `role="grid"` with row and column headers, roving focus, and `aria-rowindex` and `aria-colindex` when rows are virtualised.
- Arrow keys move between cells; Home and End, Ctrl+Home and Ctrl+End, Page Up and Page Down jump.
- Enter or F2 starts editing; Escape cancels; Enter commits and moves down; Tab and Shift+Tab commit and move across.
- Shift+Arrow and Shift+click extend a range; Ctrl+A selects all; Space selects a row.
- Ctrl+C, Ctrl+X and Ctrl+V work on cells and ranges; Delete clears the selected editable cells.
- Changes and errors announced in a polite live region; visible focus on the active cell; targets at least 24px.

**Copying out**
- A copied range goes on the clipboard as tab-separated text and as an HTML table (with the header row when whole columns are copied), using display values (names, dd/mm/yyyy dates, rating labels, control numbers and names), so it pastes into Excel and SharePoint's grid view as rows and columns.
- Allowed in read-only states: released assessments and the requestor's view.

**Pasting in**
- A range copied from Excel or SharePoint (tab-separated text or the HTML table) pastes from the active cell: columns map by position, or by header when the first row matches column names; rows past the end become new risks.
- Values convert to the field type: "High" or "high" to the rating, "30/11/2026" or "2026-11-30" to a date, a display name to a user, "Yes" or "No" to a flag, a control number to a control.
- A preview lists every change (cell, old value, new value) and every error per cell before anything is applied; apply is all-or-nothing, or the analyst explicitly applies only the valid rows. Nothing is applied partially without saying so.
- Pasted rows go through the same server-side validation as single edits.

**Rows**
- Add, duplicate (fields only, not the identifier or controls), delete or withdraw with a reason (UAT-027), and bulk-set a column for selected rows (for example one treatment owner for five risks).
- Every change recorded with who, when, and old and new values (needs a history model: contract-gap record).

**Files**
- Export the current view (visible columns, filters and sort) to CSV and XLSX with formula-injection protection.
- Import rows from CSV or XLSX into the assessment with the five-step preview, creating and updating by risk number.

**Constraints**
- Server-side validation through new Strapi bulk operations (bulk update, bulk create, delete or withdraw) with exact grants in both catalogue copies, record-level checks (unreleased assessment, analyst role) and the OpenAPI contract; no frontend facade.
- Concurrent edits: each row carries a version; a save with stale rows returns the conflicts, and the table shows "changed by Bob at 14:02" with keep-mine or take-theirs per cell.
- Released assessments read-only for everyone, with copying and export still allowed; requestors read-only on their released assessments (and, if F8 is adopted, able to fill only their response column).
- Phones (below 768px): a stacked card list with the key columns and a detail sheet for editing; no grid editing on phones (UAT-039).
- Performance: 100–500 rows responsive (virtualised rows, memoised cells) within the 300 KB route JavaScript budget or an agreed exception; the three heaviest routes already use 81–91% (R-08-34).
- Semantic design tokens only.

**Candidate approaches for the research phase (no choice made)**
- Extend the existing DataTable on TanStack Table (MIT) with custom cell editing, range selection, clipboard handling and TanStack Virtual (MIT): full control of accessibility and tokens, most build effort; consistent with 06.6 D-02 ("DataTable may be extended, never forked").
- react-data-grid (MIT): editing, keyboard navigation and copy and paste hooks built in; check range-paste depth and ARIA grid conformance.
- AG Grid: the Community edition (MIT) edits, but range selection and clipboard ranges are Enterprise (commercial licence) features.
- MUI X Data Grid: the MIT edition lacks cell-range selection and clipboard paste (Pro and Premium are commercial), and brings a second design system.
- Handsontable: the most Excel-like, under commercial licensing for this use.
- Canvas grids such as Glide Data Grid (MIT): fast, but screen-reader support must be checked against WCAG 2.2 AA.
- Research questions: licence cost and terms, bundle size against the 300 KB budget, ARIA grid conformance, theming with semantic tokens, and the shape of the server-side bulk contract.

## 8. Proposed next wave of GSD phases

Numbers are proposals. Phase 10 closes defects in features that already exist; every later phase is a vertical slice a user can see working. Four phases belong in the **Phase 9 placeholder** ("Human-Supervised Agentic Workflows", whose intended scope in `06.8-CONTEXT.md` is reviewable AI drafts with a run record and analyst approval of every mutation and requestor communication): Phase 12 is its foundation, and Phases 15, 16 and 17 are its workflows. If the operator keeps Phase 9 as the container, number them 9.1 to 9.4.

Requirement IDs extend REQUIREMENTS.md (last used: REQ-06, QUES-07, ASSESS-05, RISK-02, ADMIN-04, UX-05, DASH-02, INT-04). COLLAB-01 and NOTIFY-01 are reused; CSV- is the only new prefix, for cross-cutting import and export.

### Order in waves

| Wave | Phases | Why this order |
|---|---|---|
| 1. Fix and trust | 10, 11, 12 | No content-type changes: fixes what users hit today, makes navigation and landing pages clear, and gives the AI full context and visible provenance, which every later AI phase builds on |
| 2. Collaboration and iterative AI | 13, 14, 15, 16, with 19 in parallel | Needs the first contract-gap records and operator decisions; notes and assignment come before the steps that depend on "new information"; export is independent and delivers Q3 early |
| 3. The full intended flow and the table | 17, 18, 20 | Requestor response and residual reassessment need notes, curation and ideally notifications; the risk table needs delete, provenance markers and bulk operations; registers need the post-release decision |
| 4. Oversight and administration | 21, 22 | Metrics need the history, assignment and scales from earlier phases; the Admin role's identity side depends on INT-02 |

### Phase 10: Existing-flow gap closure
- **Goal:** As a Security Analyst or Requestor, I want the existing request, questionnaire, assessment and administration screens to work as they say, so that today's flow completes without workarounds, lost input or misleading messages.
- **Candidate requirements:**
  - REQ-07: The analyst sees every field the requestor submitted, and request actions refresh after each transition.
  - QUES-08: Analysts can add questions to any section of any questionnaire (including AI-generated ones) and edit in place, with errors shown beside the form; regeneration warns before discarding edits and is recorded in the timeline.
  - QUES-09: Requestors never lose typed answers (autosave or an unsaved-change warning), start from a short guide, and use radio groups that follow the ARIA pattern.
  - ASSESS-06: Risk and control editing uses searchable pickers (controls, systems, assets, control owners), date pickers for every date, confirms each save, and summarises release readiness by risk.
  - ASSESS-07: The released assessment shows each risk's treatment, owners, dates and named controls.
  - ADMIN-05: Reference records show owners by name and carry meaningful control names and Risk Type descriptions.
  - UX-06: Offered actions match what the server allows, refusals state the reason, timestamps use local time, questions are named by their text, copy avoids internal terms, and analyst routes show the permission state to requestors.
- **Success criteria:**
  1. An analyst adds a question to a new section and to an existing section of an AI-generated questionnaire, and the form opens where they clicked with focus inside it.
  2. The analyst's request page shows third-party involvement, third-party details and regulatory requirements.
  3. A requestor who navigates away with unsaved answers is warned or finds them autosaved.
  4. The mitigation control, system, asset and control-owner pickers find records by typing; saving a risk shows a confirmation.
  5. The requestor's released view names each control and shows treatment plan, owners and target date.
  6. Every refusal tested in this UAT (UAT-016, UAT-036, UAT-062) either is not offered or states its real reason.
  7. Revision timelines show local times and question text.
- **Closes:** UAT-005, UAT-006, UAT-007, UAT-009, UAT-010, UAT-011, UAT-015, UAT-016, UAT-019, UAT-020, UAT-021, UAT-022, UAT-023, UAT-024, UAT-033, UAT-034, UAT-036, UAT-037, UAT-041, UAT-053, UAT-054, UAT-062, UAT-064.
- **Depends on:** nothing. **UI phase:** yes.
- **Contract and datamodel impact:** UI mostly; API for 409 reason codes, a job read by request, questionnaire progress without content, and the regeneration governance event. No content-type change, except an asset owner (UAT-053), which would need a contract-gap record and can be deferred.
- **Operator decisions before planning:** control library content and licensing (ISO titles); whether analysts may see the requestor's answer progress before submission.
- **Size:** L.

### Phase 11: Navigation, landing and list clarity
- **Goal:** As a Requestor or Security Analyst, I want a sectioned sidebar and a landing page that leads with my next action, so that I always know where my work is and what to do next.
- **Candidate requirements:**
  - UX-07: The sidebar is sectioned by job, labels match page headings, and work items show counts.
  - UX-08: Each actor lands on one dashboard that leads with their next actions (analyst: queue and deadlines; requestor: needs my action versus with the analyst), laid out for phones.
  - UX-09: Review lists show the columns needed to triage (requestor, type, criticality, due date, age), and every dashboard and report figure links to its records.
  - DASH-03: Exposure figures state their scope and separate released risks from those still under assessment.
- **Success criteria:**
  1. The analyst's sidebar has headed sections and no personal items above the review work; each label matches its page heading.
  2. The analyst lands on their queue and deadlines; the requestor's first screen on a 375px phone shows what needs their action.
  3. The requestor's summary separates "needs your action" from "with the Security Analyst", naming who holds each item.
  4. The request queue shows requestor, type, criticality, due date and age.
  5. Exposure widgets and reports say whether they include unreleased risks.
- **Closes:** UAT-001, UAT-002, UAT-003, UAT-004, UAT-035, UAT-038, UAT-048, UAT-060, UAT-065.
- **Depends on:** nothing (counts for "assigned to me" arrive with Phase 13). **UI phase:** yes.
- **Contract and datamodel impact:** API for extra queue projection fields and a status dimension on exposure; no content-type change.
- **Operator decisions before planning:** the request status label for released requests ("Approved" versus "Released", CONTEXT.md); whether analysts land on the analyst dashboard.
- **Size:** M.

### Phase 12: AI context, suggestions and provenance (Phase 9 foundation)
- **Goal:** As a Security Analyst, I want the AI to work from everything the requestor gave and to show where each proposal came from, so that I can trust, check and correct its output quickly.
- **Candidate requirements:**
  - INT-05: Both AI operations receive one reviewable assessment context: request fields, selected systems and assets with classifications, regulatory requirements, notes (after Phase 13) and each question with its answer.
  - INT-06: AI-proposed values are marked until an analyst accepts or edits them, carry source citations, and the provenance is visible to analysts and disclosed to requestors.
  - ASSESS-08: Draft generation uses the curated Risk Type library (several risks per type), the organisation's scales, and proposes controls and treatments (including Accept) for the analyst to accept.
  - QUES-10: Generated questionnaires use plain language, one question each, choices with "Not sure", optional flags and help text.
- **Success criteria:**
  1. A draft for UAT-A-like input links each risk to the request's systems and assets and proposes more than one risk per Risk Type where the answers warrant it.
  2. Each proposed statement cites the answers or request fields it used; uncited claims are flagged.
  3. Suggested controls appear on each risk as one-click proposals.
  4. The assessment and questionnaire pages mark AI-proposed values and show who generated them, when and with which provider; the requestor's view says AI assisted and an analyst reviewed.
  5. A generated questionnaire for a non-expert request has help text and at least some choice questions with "Not sure".
- **Closes:** UAT-029, UAT-030, UAT-031, UAT-032, UAT-042, UAT-043, UAT-044.
- **Depends on:** Phase 10 (question editing works). **UI phase:** yes (provenance markers), plus API.
- **Contract and datamodel impact:** API (prompt context, draft and questionnaire schemas, persisted suggestions); per-field provenance and review state have no home in the frozen schema and need a contract-gap record ("AI proposal provenance per field"); an AI run record shared with Phases 15–17 needs one too.
- **Operator decisions before planning:** which Risk Types the AI may use; the risk appetite that allows "Accept"; whether requestor free text and attachments may reach the provider (06.7 D-08); the approval record for the hosted provider (STATE L49 versus L258).
- **Size:** M.

### Phase 13: Request pick-up and notes
- **Goal:** As a Security Analyst, I want to pick up a request and exchange notes with the requestor on it, so that ownership is clear and new information has a home at any point.
- **Candidate requirements:**
  - REQ-08: An analyst can pick up, be assigned to or release a request; queues and dashboards filter by assignee; any analyst on the request can read its generation jobs.
  - COLLAB-01 (reuse): Users can add comments and see activity history on permitted requests (and later questionnaires and assessments).
- **Success criteria:**
  1. An analyst picks up a request from the queue and it shows "Assigned to Bob" everywhere it appears.
  2. "Assigned to me" is a queue view and a dashboard figure.
  3. The requestor adds a note after submission; the analyst sees it flagged on the queue and the request.
  4. The analyst replies with a note the requestor sees; each note shows author and local time.
  5. A note can be marked "changes the AI inputs", which Phase 15 uses.
- **Closes:** UAT-013, UAT-014.
- **Depends on:** Phase 11 (queue columns). **UI phase:** yes.
- **Contract and datamodel impact:** frozen schema: an assignee relation on the request and a note or comment entity each need a contract-gap record and operator approval; API for assign, unassign, note create and list with record-level grants.
- **Operator decisions before planning:** self-assignment or lead assignment, and whether assignment limits who may edit; who may add notes at which stage; whether notes feed the AI.
- **Size:** M.

### Phase 14: Request attachments
- **Goal:** As a Requestor or Security Analyst, I want to attach supporting files to a request at any point, so that the assessment can use the vendor pack, data flows and spreadsheets the business already has.
- **Candidate requirements:**
  - COLLAB-02: Either actor can attach files to a request (and later to questionnaires and assessments) within type and size limits, with malware scanning, retention and per-record authorisation.
- **Success criteria:**
  1. Jane attaches a PDF, a Word document and a spreadsheet when creating a request and later adds another; Bob sees all four.
  2. Maya cannot list or download Jane's attachments by any URL.
  3. An infected or disallowed file is refused with a clear message.
  4. Each file shows who added it and when; removal is recorded.
  5. If approved, extracted text from attachments is part of the AI context, marked as untrusted content.
- **Closes:** UAT-012.
- **Depends on:** Phase 13 (notes give files their context). **UI phase:** yes.
- **Contract and datamodel impact:** frozen schema: an attachment entity or media relation needs a contract-gap record; API for upload, list, download and delete with exact grants; new dependency likely (scanning, text extraction); storage outside SQLite.
- **Operator decisions before planning:** storage location, scanning, size and type limits, retention and deletion, and whether the AI may read attachment text (open since Phase 1, STATE L289).
- **Size:** L.

### Phase 15: Steerable questionnaire AI (Phase 9)
- **Goal:** As a Security Analyst, I want to tell the AI what to add, change or remove in a questionnaire and to have it propose follow-up questions without touching answered ones, so that the question list keeps up with new information while I stay in control.
- **Candidate requirements:**
  - QUES-11: The analyst can give instructions to generate or revise questions; the AI returns proposals (add, edit, delete) accepted or rejected per question, with the instruction recorded.
  - QUES-12: The AI proposes follow-up questions using the request, notes and answered questions as fixed context; answered questions and their answers are never changed without the analyst.
- **Success criteria:**
  1. After a note about offshore support, the analyst asks for follow-up questions and receives new questions only on that topic, with the answered ones untouched.
  2. "Rewrite in plain language" on a question proposes a simpler version the analyst can accept.
  3. Every AI proposal shows its instruction, time and initiating analyst in the revision timeline.
  4. Nothing reaches the requestor until the analyst releases.
- **Closes:** UAT-017, UAT-018.
- **Depends on:** Phases 12 and 13. **UI phase:** yes.
- **Contract and datamodel impact:** API (new questionnaire proposal operation and job with grants); the AI run record from Phase 12 (contract gap).
- **Operator decisions before planning:** reverse the Pre-06.2 decision "Regeneration replaces an unanswered questionnaire and is refused once any answer exists" (STATE L43; ROADMAP L272, L279); how analyst instructions are trusted relative to untrusted requestor text (06.7 D-08).
- **Size:** M.

### Phase 16: Risk curation and targeted AI re-runs (Phase 9)
- **Goal:** As a Security Analyst, I want to delete or withdraw wrong risks and ask the AI to rewrite one risk or propose missing ones, so that the draft ends up complete and correct without rebuilding it by hand.
- **Candidate requirements:**
  - ASSESS-09: The analyst can delete or withdraw an unreleased risk with a reason, recorded in history.
  - ASSESS-10: The AI can rewrite a selected risk or propose additional risks that exclude existing ones, returned as proposals accepted per field or per risk.
- **Success criteria:**
  1. A withdrawn risk disappears from the assessment and readiness but stays in history with its reason.
  2. "Suggest more risks" on UAT-A-like input proposes the missing payment-file risk without duplicating the existing three.
  3. "Rewrite this risk" shows a field-by-field diff the analyst accepts or rejects.
  4. Released risks cannot be deleted or re-run.
- **Closes:** UAT-027, UAT-028.
- **Depends on:** Phase 12. **UI phase:** yes.
- **Contract and datamodel impact:** API (risk delete or withdraw, AI risk proposal operations, exact grants); risk history and the AI run record need contract-gap records.
- **Operator decisions before planning:** delete versus withdraw, and history retention; reverse the Phase 04 decisions "Expose no Risk delete service" (STATE L149) and "a linked draft never invokes the provider again" (STATE L136).
- **Size:** M.

### Phase 17: Mitigation response and residual reassessment (Phase 9)
- **Goal:** As a Requestor, I want to see the initial risks and tell the analyst which controls we have or plan, and as a Security Analyst I want the AI to reassess residual risk from those responses, so that the final assessment reflects the business's real mitigations.
- **Candidate requirements:**
  - ASSESS-11: The analyst releases the initial risks to the requestor for response (a new stage), read-only for the requestor apart from the response.
  - ASSESS-12: The requestor proposes mitigating controls per risk (existing or planned, owner, evidence, due date) and submits; the analyst accepts, edits or rejects each.
  - ASSESS-13: The AI proposes residual likelihood, consequence, rating and rationale from the recorded controls and responses, accepted per field, and can be re-run.
  - ASSESS-14: An explicit "Mark reviewed" step replaces save-driven review, and edits since review are shown.
  - NOTIFY-01 (reuse): The requestor is told when risks await a response, and the analyst when a response arrives.
- **Success criteria:**
  1. Jane sees UAT-A's initial risks after Bob releases them for response, and cannot see them before.
  2. Jane adds two mitigating controls to a risk and submits; Bob accepts one and rejects one with a reason.
  3. "Reassess residual risk" proposes new residual values citing the accepted controls; Bob accepts them per field.
  4. Bob marks the assessment reviewed explicitly; a later edit shows as "changed since review".
  5. Maya cannot see or respond to Jane's risks at any stage.
- **Closes:** UAT-025, UAT-026, UAT-040.
- **Depends on:** Phases 12, 13 and 16; NOTIFY-01 recommended. **UI phase:** yes.
- **Contract and datamodel impact:** frozen schema: a new assessment stage in the status vocabulary and a requestor response per risk need contract-gap records (06.8 D-01 notes the state vocabulary is a published contract); API for requestor reads of in-review risks, response submission and residual proposals with record-level checks.
- **Operator decisions before planning:** how far the requestor takes part before release; reverse ASSESS-05 and the 06.4 decision that the requestor sees an assessment only after release (STATE L47) and "every risk and control mutation is analyst-only" (STATE L146); whether a response round can repeat.
- **Size:** L.

### Phase 18: Risk table and spreadsheet interoperability
- **Goal:** As a Security Analyst, I want an assessment's risks in a table I can edit, copy and paste like Excel or a SharePoint list, so that reviewing and updating many risks takes minutes rather than a long scroll.
- **Candidate requirements:**
  - ASSESS-15: A risk table with configurable columns, sort, filter, a frozen first column and saved views.
  - ASSESS-16: Inline editing with per-cell validation, batch save, undo and conflict handling.
  - ASSESS-17: The WCAG 2.2 AA grid keyboard pattern and clipboard both ways (copy as tab-separated text and HTML; paste with mapping, conversion and preview).
  - ASSESS-18: Controlled likelihood and consequence scales with a derived, overridable rating.
  - ASSESS-19: Import rows into, and export rows from, an assessment.
- **Success criteria:**
  1. Setting treatment owner, target date and status on ten risks takes under a minute with the keyboard, saved in one batch.
  2. A range copied from the table pastes into Excel as rows and columns; a 3 × 4 Excel range pastes into the table with a preview and converts "High" and dd/mm/yyyy.
  3. A paste with one invalid cell applies nothing until the analyst chooses.
  4. Two analysts editing the same risk see a conflict, not a silent overwrite.
  5. The released and requestor views are read-only but copyable.
  6. 150 risks scroll and edit without visible lag at 1440; phones show a card list.
- **Closes:** UAT-008, UAT-039, UAT-050, UAT-055, UAT-056, UAT-057, UAT-063.
- **Depends on:** Phases 12 (provenance markers) and 16 (delete). **UI phase:** yes.
- **Contract and datamodel impact:** API (bulk update, create and withdraw with exact grants; closed vocabularies for likelihood and consequence on the existing string fields); new dependency possibly (grid component); risk change history and server-side saved views need contract-gap records.
- **Operator decisions before planning:** the grid approach and licence; the likelihood, consequence and rating matrix; whether saved views are personal, shared or both.
- **Size:** L.

### Phase 19: CSV export and import hardening
- **Goal:** As an analyst or risk manager, I want to export any list I can see and to import spreadsheets without fighting the format, so that CSRM fits the Excel work around it.
- **Candidate requirements:**
  - CSV-01: Registers, lists, queues, alerts and reports export to CSV and XLSX, following filters, sort and authorised scope, with formula-injection protection.
  - CSV-02: Import tolerates spreadsheet habits (header matching, legacy encodings, common booleans, a clear token) and produces correctable error files and friendlier templates.
  - CSV-03: Near-match names in an import need an explicit decision.
- **Success criteria:**
  1. The filtered Risk Register exports to XLSX with the visible columns, and a value starting with "=" arrives as text.
  2. A requestor can export only their own released assessment.
  3. A file with "Name" headers and an extra column imports with a warning; a Windows-1252 file gets a fix-it message.
  4. The error report reopens in Excel, can be corrected and re-imported.
  5. A lower-case duplicate of an existing name is held for a decision.
- **Closes:** UAT-049, UAT-051, UAT-052.
- **Depends on:** nothing (risk-row import and export are in Phase 18). **UI phase:** partly.
- **Contract and datamodel impact:** API (export operations reusing each list's filters and scope; parser tolerance); new dependency likely for XLSX; no content-type change.
- **Operator decisions before planning:** formats (CSV only or XLSX too), requestor export rights, export audit logging.
- **Size:** M.

### Phase 20: Oversight registers and post-release tracking
- **Goal:** As a risk manager, I want registers by assessment type that stay current after release, and as a risk owner I want to see and update my treatments, so that oversight reflects what is actually being done.
- **Candidate requirements:**
  - RISK-03: Assessment type (and division and business unit) as register columns, filters, saved views and report dimensions.
  - RISK-04: Released risks track treatment progress and closure, with history, without reopening the assessment.
  - RISK-05: Risk, treatment and control owners see (and, if approved, update) the risks and treatments they own.
  - ADMIN-06: Systems, assets, controls and Risk Types show where they are used, with counts and links.
- **Success criteria:**
  1. The register has "Project" and "BAU" saved views, and exposure reports break down by type.
  2. A treatment on a released risk moves to Complete and the risk closes with a reason; the released assessment is unchanged and the history shows the change.
  3. Jane sees the four UAT-A risks she owns, with due dates, and nobody else's.
  4. A system's page lists its requests and open risks by residual rating.
- **Closes:** UAT-045, UAT-046, UAT-047, UAT-058.
- **Depends on:** Phase 11; NOTIFY-01 recommended for due reminders. **UI phase:** yes.
- **Contract and datamodel impact:** API (type filter and projection through the request, owner-scoped risk read with a Requestor grant, post-release treatment operations, usage reads); post-release history needs a contract-gap record.
- **Operator decisions before planning:** which fields stay mutable after release and who may change them (07 D-27 and Phase 7 gap item 1 list the options); normalised lists for division and business unit.
- **Size:** M.

### Phase 21: Management dashboards and metrics
- **Goal:** As a risk manager or leader, I want trends, ageing, cycle times and a heat map, so that I can see whether risk and the assessment process are improving.
- **Candidate requirements:**
  - DASH-04: Role-specific metric sets as proposed in section 4, each linking to its records.
  - DASH-05: Trends, heat map, per-stage cycle time and ageing computed from recorded history.
- **Success criteria:**
  1. The leadership view shows open released risks by residual rating over 12 months.
  2. A likelihood-by-consequence heat map shows inherent and residual positions for the filtered set.
  3. Median and 90th-percentile time per stage are shown and link to the slowest items.
  4. Failed AI jobs in the last seven days are visible to analysts.
- **Closes:** UAT-059.
- **Depends on:** Phases 13 (assignee), 18 (scales) and 20 (history and types). **UI phase:** yes.
- **Contract and datamodel impact:** API (aggregate reads with closed report keys, 07 D-13, D-14); status history and persisted job history need contract-gap records; new dependency possibly (charting).
- **Operator decisions before planning:** metric set per audience; charting approach (07 D-19 today rules out a charting library).
- **Size:** M.

### Phase 22: Admin role and configurable lists
- **Goal:** As an Admin, I want to own reference data and product configuration, separate from analysts' assessment work, so that registers, lists and scales are governed.
- **Candidate requirements:**
  - ADMIN-07: An Admin role owns reference data and configuration (lists, scales, AI-eligible Risk Types, retention), with analysts keeping read access.
  - ADMIN-08: A read-only view of who holds which role, and role assignment in CSRM only if the operator approves it, with dual control and audit.
- **Success criteria:**
  1. A user with the Admin role manages Risk Types, Controls, Systems and Assets; an analyst without it can read but not change them.
  2. The Admin edits the likelihood and consequence scales and the division list, and the forms use them.
  3. Role holders are visible in CSRM; any role change is audited.
  4. Direct URLs to Admin screens show the permission state to everyone else.
- **Closes:** UAT-061.
- **Depends on:** INT-02 for real identities (the reference-data half can start earlier). **UI phase:** yes.
- **Contract and datamodel impact:** catalogue (new role in both copies, re-granted Administration functions); configurable lists need entities (contract-gap records); role assignment would re-open IAM routes that 08 D-36 and D-44 removed.
- **Operator decisions before planning:** the Admin role's scope (below); whether role assignment belongs in CSRM or stays in the identity platform.
- **Size:** M (L if role assignment moves into CSRM).

### Backlog
Every Gap and Defect is mapped to a phase above; nothing is left in a backlog. The known deferrals stay where they are: INT-02 (Phase 22 and anything showing real users depend on it), NOTIFY-01 (Phases 17 and 20 work better with it), 06.10 (local model evaluation, relevant to Phase 12 quality) and TENANT-01.

## 9. Operator decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Admin role scope (R1) | (a) Reference data and configuration only; (b) plus a read-only view of role holders; (c) plus role assignment in CSRM | (b): keep identity and role assignment in the identity platform; revisit (c) only with dual control and audit, since Phase 8 removed the IAM routes deliberately |
| 2 | Attachment storage and handling (F1, A1) | Storage: Strapi upload provider on object storage, or an external document store; scanning: on upload, or asynchronous with quarantine; limits; retention | Object storage behind Strapi, scan on upload with quarantine, 25 MB per file and common office and PDF types, retention tied to the assessment's retention; AI reads extracted text only after a separate decision |
| 3 | How far the requestor takes part before release (F8) | (a) As today, nothing until release; (b) a response stage on initial risks; (c) continuous shared editing | (b): one "released for response" stage, analyst-controlled, repeatable if needed |
| 4 | How an AI re-run treats answered questions and analyst edits (A2, F4) | (a) Refuse after answers (today); (b) propose additions and changes to unanswered questions only; (c) regenerate everything | (b), with analyst edits protected unless the analyst accepts a proposal |
| 5 | Analyst instructions to the AI (F4) | Treat as trusted system input, or as quoted data like requestor text | Trusted but bounded: a separate instruction slot, logged in the run record, never containing requestor text |
| 6 | Risk deletion (F7) | Hard delete, or withdraw with a reason and history | Withdraw with reason; hard delete only for unreleased risks the analyst created by mistake |
| 7 | The risk table approach (Q4) | Extend DataTable on TanStack; adopt an MIT grid; buy a commercial grid | Run the research spike with the section 7 questions; lean to extending DataTable unless range clipboard and accessibility cost exceed a licensed option |
| 8 | Likelihood, consequence and rating matrix; risk appetite | Adopt a standard 5 × 5; configure per organisation | A configurable 5 × 5 with the rating derived and overridable; appetite defines when "Accept" may be proposed |
| 9 | Post-release tracking (O1) | Keep released records immutable (today); allow treatment and closure fields to change with history | Allow treatment status, dates, evidence and closure to change after release, with history; keep statements and ratings frozen |
| 10 | Pick-up and assignment (F2) | Self-assign; lead assigns; both; exclusive editing or not | Both self-assign and lead assignment, non-exclusive editing, reassignment recorded |
| 11 | What "exposure" counts (Q1) | Released risks only; all open risks; both, labelled | Default to released risks, with "under assessment" shown separately |
| 12 | Export formats and rights (Q3) | CSV only; CSV and XLSX; requestor export of own released assessments | CSV and XLSX; requestors may export their own released assessments |
| 13 | Charting (Q1) | Keep 07 D-19 (no charting library); accessible SVG components; a small library within budget | Accessible SVG components for the heat map and trends; revisit a library only if needs grow |
| 14 | Which Risk Types the AI may use (F6) | The three hard-coded types (today); the whole library; a curated subset | A curated subset maintained by the Admin, with several risks allowed per type |
| 15 | Control library content | Numbers only for ISO/IEC 27001; licensed titles; framework short titles | Confirm licensing; load titles where licensed, otherwise short descriptive titles |
| 16 | Released request label | "Approved" (today) or "Released" | "Released" for display, keeping the stored value |
| 17 | Explicit review step (F10) | Save-driven review (today, 06.8 D-04, D-13); explicit "Mark reviewed" | Explicit "Mark reviewed", with edits after review shown |
| 18 | Notifications | Keep NOTIFY-01 in v2; bring it forward | Bring a minimal version forward with Phase 17 (response requested and received, treatments due) |

## 10. Operator checks

| Check | Why it could not be verified | Steps |
|---|---|---|
| Server refusal of questionnaire regeneration after answers exist | The web app hides the action once answers exist | With an API client and an analyst token, `POST /api/v1/assessment_requests/{id}/generate_questionnaire` with `replaceUnansweredQuestionnaire: true` for RAR-2026-5WWFVQ; expect a refusal before any provider call (no new `csrm.ai.completion.prompt` log line) |
| Server refusal of a second assessment draft | The hub shows only "Open assessment draft" | `POST /api/v1/questionnaires/{id}/generate_assessment` for QNR-2026-S0FF6J; expect the existing assessment (or 409), no provider call |
| Server refusal of release before readiness | "Release assessment" is hidden in Draft and disabled in review | `POST /api/v1/risk_assessments/wpxq7o2qhs3hl0natilxvfaw/release` (UAT-C, 124 of 146 met); expect a refusal listing missing items |
| AI job failure and retry, and the 30-second "Taking longer than expected" state | No job failed or ran longer than 25 s | Point the provider at an unreachable endpoint in a scratch environment (not the dev `.env`), start a generation, confirm the failed state, the retry button and the message after 30 s |
| Duplicate generation when an analyst restarts a running job | Not clicked, to stay within the AI budget | In a scratch environment with the deterministic provider, start a job, leave and return, press "Generate questionnaire" again, and confirm the registry reattaches rather than starting a second job |
| Roles in the Strapi admin panel | The brief rules out the admin panel | Confirm Bob holds exactly Requestor and Security Analyst, and that no user holds the Security Analyst Agent role by accident |
| Import at scale | Only small files were used | Import 5,000 rows (the documented limit) and a file just over 5 MiB; confirm timing, the size refusal and the 5-minute preview expiry |
| Strapi restart during a job | Not attempted (would lose the job) | In a scratch environment, restart Strapi mid-job and confirm the UI's message (R-08-36) |
| Prompt and response logging | Seen in the dev Strapi log: full request and answer text is logged | Decide R-08-12 (`CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS`) and log retention before real data is used |
| Owner display on the system form | Seen for two systems only | Open several systems and assets with owners to confirm UAT-053 is general |

## 11. Run facts

- **Date:** 2026-09-27, 15:19 to about 17:05 AEST.
- **Branch and commits:** `uat-trial`, starting at `91c2e00`; this run's commits start at `e18ef9d` and are listed by `git log --oneline 91c2e00..uat-trial`. Nothing was pushed.
- **Servers:** neither was running at the start. This run started Strapi (`npm run develop` in `apps/strapi`, port 1337) and the web app (`pnpm --filter @csrm/web dev`, port 3000), both from this repository. Both are left running so the records can be inspected.
- **Database backup:** `apps/strapi/.tmp/data.pre-product-uat.db`, copied while Strapi was stopped; SHA-256 `404af4498ff30b6e99f7a2755bceba8f8d41c1f5de6602b159c207b8d25b8c07`, matching `data.db` at the time. The backup was not restored.
- **AI jobs used:** 7 of 10 (UAT-A questionnaire, one regeneration, UAT-A draft, UAT-B questionnaire and draft, UAT-C questionnaire and draft); none failed or was retried. The dev Strapi log shows exactly seven completion responses.
- **Records created** (details in `JOURNEYS.md`):
  - UAT-A: RAR-2026-5WWFVQ, QNR-2026-S0FF6J, ASM-2026-2XX26G (released; four risks, four control implementations); systems "UAT-A: Brightwage People HR and payroll platform", "UAT-A: Ledgerline finance system", "UAT-A: Corporate identity provider"; asset "UAT-A: Employee personal and bank details".
  - UAT-B: RAR-2026-5MK24A, QNR-2026-6HSY0W, ASM-2026-19QK3M (released; three risks, three control implementations); system "UAT-B: Core customer billing system"; asset "UAT-B: Partner usage and pricing data"; reused the seeded "Customer portal" and "Customer records".
  - UAT-C: RAR-2026-ZCKZMH (Maya), QNR-2026-NN5KNY, ASM-2026-022BJ9 (in review, not released; ten risks); systems "UAT-C: Service desk platform", "UAT-C: Quillnote ticket summarisation service"; asset "UAT-C: Service desk ticket records".
  - UAT-CSV (area 6 imports): two Risk Types, two Controls (`0042`, `UAT-CSV-004`), two Information Systems, one Information Asset, and updates to two UAT systems (one restored).
- **Left running:** both dev servers. No browser sessions remain open.
- **`apps/web/AGENTS.md`:** starting the web dev server did not change it.
- **Notes on the brief:** the baseline's F6 point ("suggested controls from the library") does not hold in practice, because the configured provider's suggestions are discarded before display (UAT-031). The CSV check for local date formats could not run, because none of the four importable collections has a date column.

## 12. Operator notes for the next milestone

- Start with Phase 10 (gap closure): the add-question failure, the analyst's missing request fields, lost questionnaire input, the control picker and the released view's control IDs affect every assessment today.
- Give the AI the whole context before adding AI features: request fields, systems and assets, regulatory requirements and question text; drop the three hard-coded Risk Types; keep and show suggested controls; mark AI-proposed values and cite sources (Phase 12).
- Decide the lifecycle before building it: requestor response stage (F8), AI re-run rules (A2), risk withdraw versus delete, explicit review, and post-release tracking; each reverses a recorded decision.
- Write the contract-gap records early: assignee, notes, attachments, AI run record and per-field provenance, requestor response and new stage, risk and status history, configurable lists.
- Treat the risk table as its own research-led phase (grid choice, licence, bundle budget, ARIA grid, bulk API).
- Deliver export early and independently (CSV and XLSX with filters, scope and formula-injection protection).
- Add assessment type to the register, queues and reports; it is already on the request.
- Plan an Admin role for reference data and configuration; keep role assignment in the identity platform unless the operator accepts the risk; tie real identities to INT-02.
- Bring a minimal NOTIFY-01 forward with the requestor response stage.
- Re-run this UAT's three scenarios after each wave; the records and findings in `.planning/uat/product-gaps/` are the baseline.
