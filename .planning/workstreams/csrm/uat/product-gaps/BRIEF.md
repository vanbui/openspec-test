# CSRM Product Gap UAT Brief

You are running a hands-on user acceptance test (UAT) of IdamBox Cyber Risk Manager (CSRM) in the operator's local repository. Read this brief in full before you start, and re-read it whenever you resume after a break in your working context.

## Mission

Test CSRM as it stands against the **intended product** the operator describes below, not only against the v1.0 specification it was built to. Document every gap between the two, every defect you meet, and every UI, UX and user-flow problem, including the dashboards, the sidebar, CSV import and export, and spreadsheet-style work with risks.

The operator will write the next wave of GSD phases from what you produce. It has to be specific, backed by evidence, traceable to the intended product, and already organised into proposed phases.

This is a test-and-document run. You don't fix code, change configuration, or edit the roadmap, requirements or state. Work autonomously: decide, record your reasoning, and keep going. Ask the operator only if you're genuinely blocked, for example if the servers won't start.

## Permissions for this run

- **Operate everything.** You may click every control as every actor, including Generate questionnaire, Generate assessment draft, Submit, Release, Revert to draft, Return to review, Delete and import confirmation. For this run only, this overrides any standing note that says never to click those controls or trigger live generation in the dev app.
- **Use and create data.** Use the local Strapi development data. Create whatever requests, questionnaires, assessments, risks, controls, systems and assets you need to run the whole flow end to end.
- **Live AI, within budget.** The dev Strapi's `.env` sends AI generation to OpenAI. See the AI budget below.
- **Commit your deliverables** to `uat-trial`, as set out under Git.

## Limits

- Change nothing in the repository outside your deliverable and working folders and the database backup: no code, tests, config, schemas or planning docs.
- Don't edit this brief (`BRIEF.md`). If something in it turns out to be wrong, say so in the report.
- If starting the web dev server rewrites `apps/web/AGENTS.md`, leave that change alone, don't commit it, and mention it in the report.
- Don't read, print or change `.env` files, and don't change any `CSRM_AI_*` setting.
- Don't run the automated gates (Playwright E2E, Strapi or web suites). You don't need them, and a Playwright run corrupts the dev Strapi's shared `apps/strapi/dist`.
- Stay in the CSRM web app. Don't use the Strapi admin panel or enter any credentials. Answer questions that only the admin panel could settle from the data model and the catalogue, and list them as operator checks.
- Use fictional data only. Anything you type into a request or questionnaire may be sent to OpenAI.

## Git

- **Branch:** work on `uat-trial` only. Never switch branches, merge, rebase, reset, stash, rewrite history or push. Pushing is the operator's decision.
- **What you commit:** only files under `.planning/uat/product-gaps/`, staged by explicit path, never with `git add -A` or `git add .`. Never stage `.env*` files, working files, the database or `apps/web/AGENTS.md`.
- **When:** commit after each completed area and once at the end. Use small conventional commits in the history's style, for example `docs(uat): record the request intake findings`.
- **Zero AI attribution:**
  - No trailers of any kind: no co-author lines, no session links, and no line crediting a tool with the work.
  - No mention of the tools, assistants or models used to run the test, in commit messages or in files.
  - Before each commit, check the staged diff and the message for such mentions and remove them.
  - The product's own AI features, and "the configured OpenAI provider", are product facts and fine to name.
- **Identity:** commit as the repository's configured user. Check `git log -1 --format='%an <%ae>'` after your first commit.

## AI budget

- **Hard cap:** 10 live generation jobs for the whole run, counting questionnaire generations, assessment-draft generations and retries together. Plan on about 7: a questionnaire and a draft for each of the three scenarios, plus one regeneration of an unanswered questionnaire.
- **Retries:** retry a failed job at most once. Never trigger generation from a loop or a script.
- **Refusals:** the server should refuse a regeneration after answers exist, or a second draft, before any model call. Count one only if a job actually starts.
- **Seeded records first:** explore the editors on seeded records that already have questionnaires or drafts before you spend budget.
- **Strapi restarts:** don't restart Strapi while a job is running; the job registry is held in memory.
- **Log every job** in `JOURNEYS.md`: time, scenario, operation, duration, outcome and a one-line quality verdict. Call the provider "the configured OpenAI provider", and don't copy model identifiers into the deliverables.
- **At the cap:** carry on without AI and say so in the report.

## The intended product

This is the operator's target, restated with IDs for you to cite. Their original words are in Appendix A. Where this reading and the original differ, the original wins.

**Roles**

- **R1 Admin:** manages roles, registers, lists and similar configuration.
- **R2 Analyst:** carries out the cyber risk assessment once a request exists.
- **R3 Requestor:** submits a request for a cyber risk assessment.

**Core flow**

- **F1** The requestor submits a request with the important context plus supporting files: PDFs, documents and spreadsheets.
- **F2** An analyst picks up the request.
- **F3** AI generates initial questions to gather more information.
- **F4** The analyst reviews the questions: edits them, adds more, or gives the AI more information and has it add, edit or delete questions.
- **F5** The analyst releases the questions, and the requestor answers them.
- **F6** AI drafts the initial risks.
- **F7** The analyst reviews the risks: edits, deletes, or re-runs the AI, whether for one specific risk, to add new risks, or otherwise.
- **F8** The analyst releases the initial risks to the requestor, who responds with mitigating controls.
- **F9** Once the mitigating controls are submitted, AI writes up the residual risk. The analyst reviews, edits, deletes or re-runs the AI for the residual risks.
- **F10** The analyst reviews and submits the final assessment.

**At any point**

- **A1** The requestor or the analyst can add extra documentation or plain-text information to the request.
- **A2** New information may need the analyst to re-run the AI on the question list or the risk analysis. Questions the requestor has answered are kept as information; unanswered ones may change, and more questions will usually be needed.

**Oversight**

- **O1** Overall registers for BAU, Project and other kinds of assessment.
- **O2** Lists of systems, controls and similar reference data.

**Product qualities**

- **Q1** Informative dashboards with impactful metrics and information.
- **Q2** A sidebar divided into clear sections, so it's obvious what each item does.
- **Q3** Smooth CSV import and export.
- **Q4** The risks in each assessment available as a table, like a SharePoint list or Excel, with basic cross-functionality such as copy and paste in both directions.
- **Q5** An intuitive user flow throughout: the requestor feels guided, and the analyst feels in control.

### How to judge

1. The intended product decides what CSRM should do.
2. `docs/CSRM-PROJECT-BRIEF.md` sets the product principles and quality bar, especially sections 11–13, 21, 23, 28 and 33. It also covers what the intended product doesn't mention.
3. The non-negotiables in `AGENTS.md` bind every recommendation:
   - Strapi stays the API boundary.
   - Authorization is enforced server-side, through Role → Function → FunctionAPI plus record-level checks.
   - Requestors never see each other's records.
   - AI output is advisory and never releases anything.
   - JDL terminology, semantic tokens, and WCAG 2.2 AA from 375 to 1440px.
   - The Strapi content-type schemas are frozen. An intended capability that needs a schema change needs a `docs/contract-gaps/` record and the operator's approval. Say so in the finding; don't propose a way around it.
4. Where the intended product contradicts a locked v1 decision, log the finding against the intended product and name the decision it would reverse (from `.planning/STATE.md` or the ROADMAP) as an operator decision. Examples: two roles; no AI regeneration once answers exist; the requestor sees an assessment only after release.
5. Where nothing decides, judge as the real users would: a requestor who isn't a security expert, and an analyst who has to stay in control.

## Current baseline: verify, don't assume

Code reading on 2026-09-27 suggests the following. Confirm each point in the running app before you rely on it. Code reading isn't evidence of behaviour.

- **Roles (R1–R3):**
  - There are two human roles: Requestor, which every signed-in user gets automatically, and Security Analyst, which is assigned. There is also a service role, Security Analyst Agent.
  - There's no Admin role. The analyst manages Risk Types, the Control Library, Information Systems and Information Assets under `/app/admin/[collection]`.
  - The web app has no user or role management. Phase 8 deliberately removed HTTP access to the IdamBox IAM records.
- **F1:**
  - A request (an "Assessment Request") has structured fields only (see `CsrmAssessmentRequest` in the JDL), including an assessment type of BAU, PROJECT or OTHER.
  - Nothing accepts file uploads; the questionnaire's file-upload answer type is deliberately disabled.
  - A request is editable only as a Draft. It returns to Draft, with a reason, only from Submitted and before a questionnaire exists.
- **F2:** analysts share one review queue at `/app/review/requests`. The data model has no assigned-analyst relation, so there is probably no way to pick up or assign a request.
- **F3–F4:**
  - The analyst starts an asynchronous Generate questionnaire job with queued, running, completed, failed and retry states. It takes no instructions from the analyst.
  - Regenerating replaces the whole questionnaire and is allowed only while nothing is answered.
  - The analyst adds, edits and deletes questions by hand in the governance editor.
- **F5:**
  - The analyst releases the questionnaire; the requestor answers, saves drafts and submits.
  - After submission, Return to review (analyst only, with a reason) allows edits and a new release. Answers that still fit are kept, and the requestor answers the new required questions and submits again.
  - A dated revision timeline records the changes.
- **F6:** the analyst starts an asynchronous Generate assessment draft job. One pass proposes risks with inherent and residual likelihood, consequence, rating and rationale, a treatment, and suggested controls from the library.
- **F7:** the analyst edits risks and adds risks by hand. There's no way to delete a risk (the API has no operation for it). There's no way to re-run the AI once a draft exists; retry appears only after a failed job.
- **F8–F9:** not built as steps.
  - The requestor sees nothing of the assessment until the final release.
  - The analyst records mitigation controls (Control Implementations linked to library Controls).
  - Residual ratings come from the first draft and the analyst's edits.
- **F10:**
  - Release requires a readiness checklist and a confirmation.
  - The status then shows "Released" (stored as `approved`; see `CONTEXT.md`), and the requestor gets a read-only view.
  - Editing a reviewed but unreleased assessment sends it back to draft.
- **A1–A2:** no comments, notes or attachments on any record; comments are the deferred v2 requirement COLLAB-01. There's no AI re-run that keeps answered questions, only the manual Return to review.
- **O1:**
  - Assessment type is a field on the request.
  - There's a single Risk Register at `/app/risks`. It filters by search, treatment status, inherent and residual rating, risk owner, treatment owner, assessment, system, asset, mitigation status, open or closed, and target-date range, but not by assessment type.
  - Four reports are at `/app/reports`: risk exposure, treatment performance, assessment throughput and control effectiveness, each over 6 or 12 months. Alerts are at `/app/alerts`.
- **O2:** list and detail screens exist for Information Systems, Information Assets, the Control Library and Risk Types. Mitigation controls appear on Risk detail.
- **Q1:** there's a Dashboard at `/app` for every actor, and an analyst dashboard at `/app/review`.
- **Q2:** the sidebar is generated per capability from `apps/web/src/config/navigation/navigation.ts`.
- **Q3:** CSV import exists only for the four Administration collections, with template download, preview, row-level validation, confirmation and a result summary. No CSV export appears to exist anywhere.
- **Q4:** risks are edited one at a time in a per-risk editor (`apps/web/src/features/assessments/risk-editor.tsx`), and the requestor's released view is read-only. There's no grid editing, range selection or multi-cell paste.
- **Known deferrals:** real sign-in (INT-02, Keycloak), local model evaluation (Phase 06.10), notifications (NOTIFY-01, v2) and the unscoped Phase 9 placeholder ("Human-Supervised Agentic Workflows"). Don't log these as new findings, but do say where the intended product depends on them.
- **Known issues:** before logging an issue, check `.planning/WINDOWS.md`, `.planning/APP-UI-REVIEW.md` and the open risks and decisions in `.planning/STATE.md`. If it's already listed, reference it rather than logging a duplicate.

## Environment

- **Host:** Windows 11, repository `C:\Users\dylan\Developer\csrm`, branch `uat-trial`. Bash is Git Bash; PowerShell is also available.
- **Node:** prefix every node, pnpm or npm command in Bash with `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" &&`. Never run `nvm use`.
- **Servers:** Strapi runs on port 1337 and the web app on 3000. The operator may already have them running; reuse them.
  - **Check a port** with PowerShell `Get-NetTCPConnection -LocalPort 1337 -State Listen`. Then confirm that the owning process's command line is under `\Developer\csrm\`, with `Get-CimInstance Win32_Process -Filter "ProcessId = <pid>"`. Other projects (`csrm-dylan`, `edalas-dylan`) sometimes use the same ports; never stop their processes.
  - **Start Strapi** as a background task from `apps/strapi`: `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && npm run develop`. It's ready when `http://localhost:1337/_health` answers. Never start Strapi through a launcher that health-checks `GET /`: Strapi answers that with a redirect, and the launcher kills it a few seconds later.
  - **Start the web app** as a background task with `pnpm --filter @csrm/web dev` from the repo root, or through its `web` launch configuration. It's ready when `http://localhost:3000/sign-in` loads.
  - **Stop a server** with `taskkill /PID <pid> /T /F`, after checking its command line.
  - **Dev-mode timing:** the web app runs in development mode, so the first visit to each route includes compilation. Judge speed on a second visit and treat timings as indicative. The dev build's overlay badge isn't a finding.
- **Back up the database first.** The dev data is the SQLite file `apps/strapi/.tmp/data.db`. Before you create anything, stop Strapi, copy the file to `apps/strapi/.tmp/data.pre-product-uat.db`, and start Strapi again. Record the backup in the report.
- **Browser:**
  - Drive the app with the headless Playwright browser tools configured in `.mcp.json`. Any code file you hand them must sit under `.playwright-mcp/`.
  - Alternatively, run node scripts in `apps/web/.tmp/audit/uat-product-gaps/` that use the web app's `@playwright/test`; run them with node from `apps/web`.
  - Don't take screenshots in the built-in browser pane; they time out on this app.
  - Open and look at every screenshot you cite.
- **Sign-in:**
  - At `http://localhost:3000/sign-in`, choose "Continue as Requestor" (`jane.doe@idambox.com`), "Continue as Secondary Requestor" (`maya.requestor@idambox.com`) or "Continue as Security Analyst" (`bob.doe@idambox.com`). Then wait for the level-1 "Dashboard" heading.
  - Switch actors by clearing cookies, or use a separate browser context per actor; the dev sign-out action can hang.
  - The analyst also holds the Requestor role, as everyone does.
- **CSV files:** the import's file input only appears at step 2 of the flow. Use the browser tools' file upload, or `setInputFiles` in a script.
- **Clipboard:** to test copy and paste in a script, grant `clipboard-read` and `clipboard-write`. Excel puts a copied range on the clipboard as tab-separated text plus an HTML table; simulate both.
- **Accessibility:** use `@axe-core/playwright` in scripts, or inject `node_modules/.pnpm/axe-core@4.11.4/node_modules/axe-core/axe.min.js` through the browser tools. Phase 8 swept every route, so focus on states that sweep couldn't reach, such as mid-flow states and long AI output.
- **Optional baseline:** `apps/web/.tmp/audit/audit.mjs` visits every route as all three actors at 1440 and 375px in about five minutes, recording axe results, overflow, console errors and screenshots. It only signs in and reads pages. Run it from `apps/web` with `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && AUDIT_LABEL=uat-baseline node .tmp/audit/audit.mjs`.
- **Working files:** keep raw screenshots, scripts and CSV files under `apps/web/.tmp/audit/uat-product-gaps/`. The Playwright browser tools write their own output to `.playwright-mcp/`. Both are gitignored.
- **Helpers:** you may hand read-only work, such as digesting documents or checking what the code supports, to helpers. Drive the browser yourself, and never let a helper change data, trigger generation or commit.

## Scenarios and data

- **Fictional only:** use fictional organisations and people.
- **Scenario tags:** start every record title with its scenario tag, for example "UAT-A: …", so the operator can find the records later.
- **Enough detail:** give each scenario about half a page of realistic detail. Thin input produces thin AI output and hides gaps.
- **Reference data:** use existing Information Systems and Information Assets where they fit, and create new ones through Administration where they don't.

The three scenarios:

- **UAT-A (Project; new system), created by Jane:** a new cloud HR and payroll platform run by a vendor.
  - Employee personal and bank details (restricted).
  - Single sign-on through the corporate identity provider, and an integration with the finance system.
  - Vendor administration, high business criticality, and privacy obligations.
- **UAT-B (BAU; existing system with external exposure), created by Jane:** an existing internet-facing customer portal opening a partner API.
  - External exposure and privileged administration.
  - Integration with a core system.
  - Internal and restricted data.
- **UAT-C (Other; consuming an external service), created by the Secondary Requestor:** the service desk sending ticket text to an external AI summarisation service.
  - Data leaving the organisation, and a new third party.
  - Internal data with occasional personal information.
  - A second requestor's data also gives the dashboards and the isolation checks something to work with.

## How to run the UAT

Work through the areas in order. Write to the deliverables as you go, not at the end, and commit after each area (see Git). Keep a progress checklist at the top of `JOURNEYS.md`, so an interruption loses nothing.

### 0. Orientation

Read `AGENTS.md`, `CONTEXT.md`, `docs/CSRM-PROJECT-BRIEF.md`, `.planning/REQUIREMENTS.md` and `.planning/PROJECT.md`, and skim `.planning/ROADMAP.md`. Have a read-only helper digest the rest and return conclusions:

- the locked decisions in `.planning/STATE.md` and the phases' CONTEXT files that stand between today's product and the intended one;
- the role–function–API catalogue as a who-can-do-what table;
- the JDL's entities, fields and lifecycles, which you need for the dashboard metrics;
- `docs/references/served-operations.json`, as the list of what the API can do today;
- the known issues listed above.

Then check the servers, back up the database, and sign in once as each actor.

### 1. First impressions (each actor, at 1440 and 375)

Land on the dashboard and use the sidebar as a newcomer would. For each actor, record:

- the whole navigation tree: sections, labels, order, icons and counts;
- what each item actually opens;
- anything ambiguous or duplicated;
- whether the dashboard says what needs attention and what to do next.

Capture now; propose in areas 8 and 9.

### 2. UAT-A, the full flow at 1440 (the deep pass)

Walk F1 to F10, bringing in A1 and A2 where they fit and switching actors as the flow needs. At every step, record:

- what the intended product says should happen (cite the step);
- what actually happens;
- how the actor knew what to do next;
- the clicks and waits involved;
- the status each actor sees;
- anything confusing.

Along the way:

- try to attach supporting files as the requestor (F1, A1) and as the analyst (A1);
- look for a way to pick up or assign the request (F2);
- generate the questionnaire and judge it (F3). Try to give the AI more information (F4). Edit, add and delete questions by hand, then release it (F5);
- as the requestor, answer part of it, save, leave, come back, finish and submit (F5);
- add new information mid-flow (A1) and try every route to re-run the AI (A2). Then use Return to review, change and add questions, release again, and check which answers survive (A2);
- generate the assessment draft and judge it (F6). Edit a risk, add one, try to delete one, and try to re-run the AI for a single risk and for new risks (F7);
- look for any way to send the initial risks to the requestor for mitigating controls (F8). Then record mitigation controls the way the product allows, and look for any AI write-up of residual risk (F9);
- release (F10). Then check the requestor's view, the Risk Register, the dashboards, the reports and the alerts for the new records.

### 3. UAT-B, the full flow at 375

Repeat the flow at phone width, more quickly. Concentrate on what changes on mobile: navigation, forms, the questionnaire, the analyst editors, tables, dialogs and touch targets.

Exercise the refusal paths here:

- regenerating after answers exist;
- a second draft;
- release before the readiness checklist is complete;
- revert to draft from each state.

### 4. UAT-C and AI quality

Take UAT-C at least as far as a reviewed assessment draft. Compare the AI output across all three scenarios:

- **Questionnaire:**
  - relevant to the request: system type, data, exposure, hosting, integrations and third parties;
  - no duplicates, and nothing the request already answers;
  - plain language a requestor can answer;
  - sensible answer types, sections and length;
  - covers what an analyst would need to know.
- **Draft:**
  - every risk traceable to the request or the answers;
  - well-formed risk statements (cause, event, consequence);
  - ratings consistent with their rationale;
  - residual ratings lower than inherent only where controls justify it;
  - suggested controls that exist in the library and fit;
  - no invented systems, assets or facts;
  - sensible treatments.
- **Experience:**
  - time to complete;
  - what the UI shows while waiting. The job view polls on a client budget of about 30 seconds, so record what happens when a job takes longer;
  - failure and retry;
  - how clearly AI output is marked as advisory;
  - how easily the analyst can tell what the AI produced from what a person changed.

### 5. Registers, lists and oversight (O1, O2)

- **Risk Register:** search, every filter, sorting, pagination, detail and mitigation controls. Could a risk manager get the BAU versus Project oversight the intended product describes?
- **Reports and alerts:** what question each one answers, and whether it leads to action.
- **Systems, assets, controls and risk types:** list, create and edit. Check their links to requests and risks, and whether they support oversight questions such as "which systems carry the most high residual risk?".

### 6. CSV import and export (Q3)

- **Import, for each of the four collections:**
  - Download the template and fill it in as a spreadsheet user would, including Excel habits: UTF-8 with a byte-order mark, CRLF line endings, quoted commas and line breaks, local date formats, and leading zeros.
  - Include invalid, duplicate and ambiguous rows.
  - Upload, review the preview and the row-level errors, and confirm. Check the result summary and the records.
  - Then try a round trip that changes existing records.
- **Export:** list every screen where a user would expect an export (registers, lists, an assessment's risks, reports, queues) and whether it exists. For each one that should exist, record the expected behaviour:
  - follows the current filters and sort;
  - lets the user choose columns;
  - offers CSV, and XLSX where Excel users expect it;
  - is scoped by authorization;
  - is safe against spreadsheet formula injection.
- **Beyond Administration:** whether risks, control implementations or requests can come in from a spreadsheet, and whether they should.

### 7. Risk table and Excel interoperability (Q4)

Time how long it takes to review and update ten risks today, and count the clicks. Try copying risks into a spreadsheet from the released view and from the editor. Try pasting a tab-separated block of several rows and columns into the editor. Record exactly what happens.

Then write the requirement in detail, as its own section of the report:

- **The table:** every risk in the assessment, with configurable columns across the Risk fields:
  - number, statements and category;
  - inherent and residual likelihood, consequence and rating;
  - treatment, owners, dates, status and control count.

  Include sorting, filtering, a frozen first column and saved views, in the manner of a SharePoint list.
- **Editing:** inline cell editing with editors that fit the type (enumerations, people, dates), validation per cell, visible unsaved changes, save or autosave, and undo.
- **Keyboard:** arrow-key navigation, Enter to edit, Tab, range selection, Ctrl+C and Ctrl+V.
- **Copying out:** a copied range pastes into Excel and into SharePoint's grid view as rows and columns.
- **Pasting in:** a range copied from Excel or SharePoint pastes into the table. It maps its columns, adds rows when it runs past the end, and converts values such as "High". It previews the changes and any errors before applying them, and never applies part of a paste silently.
- **Rows:** add, duplicate and delete, with an audit trail. Delete doesn't exist today.
- **Files:** export to CSV or XLSX, and import rows into an assessment.
- **Constraints:**
  - server-side validation through new Strapi bulk operations with exact grants;
  - handling of concurrent edits;
  - released assessments read-only, with copying still allowed;
  - requestors read-only;
  - the WCAG 2.2 AA keyboard pattern for grids;
  - a sensible mobile presentation;
  - performance with 100 or more risks.

  Name candidate approaches and any licensing questions for the research phase, without choosing one. Examples: TanStack Table with custom editing, or a dedicated grid component.

### 8. Dashboards (Q1)

Inventory every widget on every dashboard:

- the question it answers;
- whether its numbers match the records you created;
- whether it links to the filtered list behind it;
- whether it helps someone act.

Then propose metrics for each audience: requestor, analyst, and risk manager or leadership. Ground them in the data model, and for each metric say whether today's data supports it or what's missing.

Some starting points, not a checklist:

- my work by stage, with ageing;
- cycle time per stage, and time to release;
- throughput;
- open risks by residual rating, and the trend;
- an inherent versus residual heat map (likelihood by consequence);
- overdue treatments by owner;
- upcoming review dates;
- top risk types;
- control effectiveness;
- exposure by assessment type, division, business unit and system;
- failed AI jobs.

### 9. Sidebar and information architecture (Q2)

From area 1 and everything since, propose a sidebar for each actor, with section headings, labels and a one-line description of each item. Say what moves, merges or goes. Weigh it against how often each item was actually needed in the journeys. Pay attention to the analyst, who also holds the Requestor role and may see overlapping "My …" and review items.

### 10. Roles and administration (R1–R3)

Compare the intended Admin role with today's model:

- who manages the libraries and inventories;
- how roles get assigned;
- what an Admin interface would need: users, role assignment, and register and list configuration;
- the security implications. Phase 8 removed HTTP access to the IAM records on purpose.

Check what each actor can and can't reach, including by direct URL; navigation visibility isn't authorization.

### 11. Cross-cutting checks

Along the way, and in a final sweep:

- the five screen states (loading, empty, populated, error, permission denied) wherever you meet them;
- copy and terminology: plain language for requestors, consistent JDL terms, and "Released";
- the core screens at 375, 768, 1024 and 1440px;
- keyboard only, through the requestor's questionnaire and the analyst's risk editing;
- perceived performance;
- a light isolation check. As the Secondary Requestor, open UAT-A's request, questionnaire and assessment by direct URL, and as Jane, open UAT-C's. Expect a permission-denied state or "Page not found", with none of the record's details. Any failure here is a blocker.

## Recording findings

Give each finding in `FINDINGS.md`:

- **ID:** UAT-001, UAT-002, and so on.
- **Title:** one line.
- **Type:** Gap (the intended product needs it and it isn't built), Defect (built but wrong), UX (it works, but is confusing, slow or awkward), or Improvement (beyond the stated intent, but recommended).
- **Area:** request intake, questionnaire, AI assistance, assessment and risks, controls and residual risk, release, collaboration and attachments, registers and lists, dashboards and reports, navigation, CSV, risk table, roles and administration, accessibility and responsiveness, performance, security, or content.
- **Intent:** what it traces to: R1–R3, F1–F10, A1–A2, O1–O2, Q1–Q5, a project-brief section, or "observation".
- **Severity, against the intended product:**
  - **blocker:** the intended flow can't be completed, or there is a security, data-isolation or data-loss failure;
  - **major:** a core intended capability is missing or broken, or needs a workaround;
  - **minor:** it works but is wrong, inconsistent or awkward;
  - **cosmetic:** visual polish only.
- **Actors** and **route**.
- **Steps**, **expected** (from the intended product) and **actual** (what you observed).
- **Evidence:** a screenshot path, an HTTP status, or other proof. Mark anything you inferred from code rather than observed as "inferred from code".
- **Recommendation:** the direction, not the implementation.
- **Impact:** one or more of:
  - UI only;
  - API: a new or changed Strapi operation and catalogue grant;
  - datamodel: frozen, so it needs a `docs/contract-gaps/` record and the operator's approval;
  - a new dependency;
  - an operator decision: name it, and any locked decision it would reverse.
- **Related:** existing requirement IDs (such as COLLAB-01 or NOTIFY-01), phases, decisions or known issues.
- **Proposed phase:** the phase in the report it belongs to.

## Deliverables

Everything goes under `.planning/uat/product-gaps/`, next to this brief:

- **`REPORT.md`:** what the operator reads first; its contents are below.
- **`FINDINGS.md`:** the whole register, grouped by area, most severe first.
- **`FINDINGS.csv`:** the same register, one row per finding, in UTF-8 with a byte-order mark so it opens cleanly in Excel.
- **`JOURNEYS.md`:** the progress checklist, then the step-by-step log of each journey (intended step, what happened, actor, evidence). It also holds the AI job log and the list of records you created.
- **`evidence/`:** JPEG screenshots for the findings. They are committed, so keep them lean: quality 70, cropped to what matters, about 300 KB each at most, and 60 images in total.

`REPORT.md` covers, in order:

1. **Summary:** a paragraph on how far today's product is from the intended one, with counts by type and severity.
2. **Top 15 gaps**, ranked by value to users.
3. **The intended product** (F1–F10, A1–A2, O1–O2, Q1–Q5) as a table: built, partly built or not built, with finding IDs.
4. **Dashboard metrics proposal** (area 8).
5. **Proposed sidebar** for each actor (area 9).
6. **CSV import and export requirements** (area 6).
7. **Risk table requirements** (area 7).
8. **Proposed next wave of GSD phases.** Map every Gap and Defect to a phase, or to a backlog list with a reason. For each phase, give:
   - a name, and the goal as a user story in ROADMAP.md's style ("As a …, I want …, so that …");
   - candidate requirements with IDs in REQUIREMENTS.md's style. Reuse existing IDs such as COLLAB-01 and NOTIFY-01 where they fit, and add new prefixes only where none do;
   - three to eight observable success criteria;
   - the findings it closes, its dependencies, and whether it's a UI phase;
   - its contract and datamodel impact, with the contract-gap records it needs;
   - the operator decisions to settle before planning;
   - a relative size: S, M or L.

   Put fixes to features that already exist first, as their own gap-closure phase. Keep phases as vertical slices a user could see working. Say which phases belong in the Phase 9 placeholder, and propose an order in waves, with the reasoning.
9. **Operator decisions:** every question only the operator can answer, each with options and your recommendation. Examples:
   - the Admin role's scope;
   - attachment storage, scanning, size limits and retention;
   - how far the requestor takes part before release;
   - how an AI re-run treats answered questions and analyst edits;
   - the approach to the risk table.
10. **Operator checks:** anything you couldn't verify, with the steps to check it.
11. **Run facts:**
    - the date, the starting commit and your commit range on `uat-trial`;
    - the servers;
    - the database backup path;
    - AI jobs used, out of 10;
    - the records you created, by scenario tag;
    - anything left running.
12. **Operator notes for the next milestone:** a short, paste-ready list for the operator's next-milestone notes, or for `/gsd-new-milestone`.

## Rules for the deliverables

- **Zero AI attribution.** These files are committed. Never mention the tools, assistants or models used to run the test; write as a QA team would. The product's own AI features, and "the configured OpenAI provider", are product facts and fine to name.
- **Evidence over assertion.** Every finding needs evidence you have looked at, or is marked "inferred from code".
- **No invention.** Where the data model or API can't support something, say what's missing. Don't design around the frozen datamodel.
- **Be specific and brief.** The operator writes phases from this, so every sentence should help.

## Finishing

Stop when every area is covered and the deliverables are complete. Check that `FINDINGS.csv` matches `FINDINGS.md`, and that the report's counts match the register. Make the final commit, then confirm that `git status` shows none of your deliverables left uncommitted. Leave the servers running so the operator can look at the records, and say whether you started them. Keep the UAT records, and don't restore the backup.

Finish with a short summary in chat:

- counts by type and severity;
- the top ten gaps;
- the proposed phases, in order;
- AI jobs used;
- records created;
- the operator decisions needed;
- your commit range on `uat-trial`.

## Appendix A: the operator's words, verbatim

The product idea:

```text
Overall BProton CSRM product idea:

3 key roles:
Admin - managing roles, registers, list, etc.
Analysts - Help with the cyber risk assessments when a ticket is created.
Requestor - A person submitting a ticket requesting a cyber risk assessment

Flow:
A requestor submits a ticket with important context as well as pdfs, docs, spreadsheets.
An analysts picks up the ticket.
The AI will help generate initial questions for more information.
The analyst will review the questions, could edit, add more, or prompt with more information for the AI to add/edit/delete questions.
The analysts releases the questions and then the requestor will answer the questions.
The AI does the initial draft of the risks. |
The analysts review, edit, delete or even re-trigger the AI to write up risks again. This could mean, editing one specific risk, adding new risks, etc.
The analysts release the initial risks raised for the requestor to respond to with mitigating controls.
Once mitigating controls are submitted, the AI will write up the residual risk. Analysts review, edit, delete or even re-trigger the AI to write up residual risks again.
Analysts review and then submit.


At any point in time:
A requestor or an analyst could add extra documentation/information in plain text, relating to the ticket. This could require the analyst to manually trigger the AI to redo the question list/ risk analysis. For the questions, if a question has already been answered by the requestor, keep it as information. The other unanswered questions could be changed and most likely, more questions will be required.

There are also other registers like overall registers for BAU/Project/etc. There should also be lists of systems, controls, etc. These are all for oversight.
```

The purpose of this UAT, and the run decisions:

```text
The purpose of this UAT test is to write up more GSD phases to get the functionality correct. I am providing the intended goal. The task is to do a full UAT test to document all the gaps. While being mindful of the intended product. I also want to note down anything relating to UI/UX, user intuition flow etc. This could include, developing more informative dashboards will impactful metrics an information. Cleaning up the sidebar so that it is divided and intuitive about what tab does what. Another part of the product is that it needs to be able to work pretty smoothly with CSV like importing/exporting.

The risks in each risk assessment need to be able to also have a table format like Sharepoint Tables or Excel with basic cross functionality like copy and pasting across both.

Add all of this information into the prompt to open up the project and do real UAT testing, documenting everything possible for improvement and gaps that need to be actioned in the next wave of GSD phases.
2) full UAT test requires full permission to click buttons, etc
3) use the Strapi data, you can also make data and simulate the whole flow.
4) AI provider in .env is OpenAI, use it sparingly.
```
