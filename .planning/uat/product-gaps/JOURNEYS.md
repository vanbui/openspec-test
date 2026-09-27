# CSRM Product Gap UAT — Journeys

Run started 2026-09-27 on branch `uat-trial` at `91c2e00`. This log records each journey step by step: the intended step, what happened, the actor and the evidence. It also holds the AI job log and the list of records created. Findings are in `FINDINGS.md`; the summary is in `REPORT.md`.

## Progress checklist

- [x] 0. Orientation: documents read, planning digest, servers checked, database backed up, one sign-in per actor
- [x] 1. First impressions: each actor at 1440 and 375
- [x] 2. UAT-A full flow at 1440 (deep pass)
- [x] 3. UAT-B full flow at 375, refusal paths
- [x] 4. UAT-C and AI quality comparison
- [x] 5. Registers, lists and oversight (O1, O2)
- [x] 6. CSV import and export (Q3)
- [x] 7. Risk table and Excel interoperability (Q4)
- [x] 8. Dashboards (Q1)
- [x] 9. Sidebar and information architecture (Q2)
- [x] 10. Roles and administration (R1–R3)
- [x] 11. Cross-cutting checks, isolation check
- [x] Deliverables complete, counts reconciled, final commit

## Environment and setup

| Item | Value |
|---|---|
| Servers | Neither was running at the start. Strapi (`npm run develop`, port 1337) and the web app (`pnpm --filter @csrm/web dev`, port 3000) were started for this run, both from this repository. Strapi answered `/_health` with 204 and `/sign-in` answered 200. |
| Database backup | `apps/strapi/.tmp/data.pre-product-uat.db`, copied from `data.db` while Strapi was stopped; SHA-256 `404af449…c25b8c07` matches the source. |
| Browser | Headless Chromium driven by scripts that use the web app's `@playwright/test`, at 1440×900 and 375×812 unless stated. The web app runs in development mode, so the first visit to a route includes compilation; timings are from a second visit and are indicative. |
| Working files | Screenshots, scripts and CSV files under `apps/web/.tmp/audit/uat-product-gaps/` (gitignored). Committed evidence is under `evidence/`. |

## AI job log

The hard cap is 10 live generation jobs. Each row is one job that actually started.

| # | Time | Scenario | Operation | Duration | Outcome | Quality verdict |
|---|---|---|---|---|---|---|
| 1 | 15:41:07 | UAT-A | Generate questionnaire | about 12 s (server log 15:41:07 → 15:41:19) | Completed | Specific to the request (SSO, vendor admin, bank-detail changes, SFTP file to the finance system, payslip sub-processor, seven-year history). 15 questions (the cap) in 6 sections, all required, 13 long-text and mostly compound; technical wording (RTO/RPO, conditional access, replay) a non-expert requestor will struggle with; nothing on the privacy and tax file number obligations the model was never sent. |
| 2 | 15:48:50 | UAT-A | Regenerate the unanswered questionnaire (replace) | 13.9 s (queued 0.5 s, running 1.6 s, ready 13.9 s) | Completed | Same record, questions replaced. 15 questions in 5 sections; better mix (11 long text, 3 single select with "Unknown / Not yet determined" options, 1 multi select); still all required and technical. The analyst's earlier edit was discarded without warning. |
| 3 | 15:55:22 | UAT-A | Generate assessment draft | about 20.5 s (queued 0.5 s, running 1.6 s, ready 20.5 s) | Completed | ASM-2026-2XX26G. Three well-formed risks (cause, event, consequence) that trace to the answers (offshore admin access, 90-day deletion, push MFA, 99.5% availability), one per hard-coded Risk Type; ratings consistent with their rationale (Likely × Major = High; residual Possible × Major = High because controls are unverified). All treatments "Treat" with specific plans. No controls attached, no system, asset or classification set, and the unsigned payment-file and segregation-of-duties issues missed as separate risks. No invented systems or facts. |
| 4 | 16:10:51 | UAT-B | Generate questionnaire (at 375) | 13.6 s (queued 1.3 s, running 2.3 s, ready 13.6 s) | Completed | QNR-2026-6HSY0W: 13 questions in 5 sections, all required (8 long text, 1 Boolean, 4 multi select with "None of the above" options). Strongly on point: consent capture and withdrawal, per-account authorisation beyond the client token, credential lifecycle, plan-change validation, gateway rate limiting, privileged admins, partner and gateway assurance. Nothing on the Consumer Data Right, data residency or classification, which were only in the regulatory requirements and asset records the model never receives. |
| 5 | 16:12:26 | UAT-B | Generate assessment draft (at 375) | 23.6 s (queued 0.5 s, running 1.5 s, ready 23.6 s) | Completed | ASM-2026-19QK3M: three risks, again one per hard-coded Risk Type. Good, specific statements and treatments (secrets emailed to partners, account numbers in URLs, editable logs, no partner audits); residuals lowered to Moderate with the controls cited (MFA, scopes, consent checks), which the answers support. Missed a separate risk for unauthorised plan changes (no manual review, applied at next bill cycle). No controls, systems or assets set. |
| 6 | 16:17:56 | UAT-C | Generate questionnaire | 15.3 s (server log 16:17:55.7 → 16:18:11.0) | Completed | QNR-2026-NN5KNY: 14 questions in 4 sections, all required (8 long text, 4 single select, 2 Boolean). The best of the three: redaction before sending, 30-day supplier retention, privacy impact assessment status, processing locations, contract and data processing agreement before the pilot, API key handling, logging minimisation, agents checking AI summaries. Did not ask whether the supplier trains on submitted text or how malicious ticket text could manipulate summaries; one question restates a fact the request already gave (locations not confirmed). |
| 7 | 16:19:21 | UAT-C | Generate assessment draft | 24.6 s (queued 0.5 s, running 1.6 s, ready 24.6 s) | Completed | ASM-2026-022BJ9: three risks, one per hard-coded Risk Type; strong privacy and supplier risks; residual equal to inherent because no controls exist, which fits the answers. One risk (typed "Internet Exposure" for an API-key problem) asserts that the connector's "security and patch status… has not been assessed", a fact nobody gave. No risk for inaccurate summaries written back into tickets or for prompt injection through ticket text. Consequence given as "High" (the rating scale) where the other drafts used "Major". |

## Records created

| Scenario | Record | Identifier | Created by |
|---|---|---|---|
| UAT-A | Information System "UAT-A: Brightwage People HR and payroll platform" (SaaS, new, internet-facing, owner Jane Doe) | `mm0x1dd4srz9qe4h68k54316` | Bob (Administration) |
| UAT-A | Information System "UAT-A: Ledgerline finance system" (on-prem, existing) | `zzulduff8pzb9plllrmdgblc` | Bob |
| UAT-A | Information System "UAT-A: Corporate identity provider" (cloud, existing, critical) | `agmr6i6xiqgyhrohym8zs41a` | Bob |
| UAT-A | Information Asset "UAT-A: Employee personal and bank details" (Restricted, personal data) | `y6vrujk7l2n87fhgk7rp9bzp` | Bob |
| UAT-B | Information System "UAT-B: Core customer billing system" (on-prem, existing, critical) | `irh9olgqsyxkwhmtagx2vkh2` | Bob |
| UAT-B | Information Asset "UAT-B: Partner usage and pricing data" (Internal) | `jyyy8higtvq6jrg9w0kf0j3y` | Bob |
| UAT-C | Information System "UAT-C: Service desk platform" (SaaS, existing) | `f8wjeow8exh9if8vv4cmv5uj` | Bob |
| UAT-C | Information System "UAT-C: Quillnote ticket summarisation service" (SaaS, new, external) | `nmtcpwt43ofa7dmpo756k28u` | Bob |
| UAT-C | Information Asset "UAT-C: Service desk ticket records" (Internal, occasional personal data) | `oifabiipti6e8268sssvqwhf` | Bob |
| UAT-A | Assessment Request RAR-2026-5WWFVQ "UAT-A: Brightwage People cloud HR and payroll platform" (Project, High) | `al0a14wgmyfu4ugdnnqkwzhx` | Jane |
| UAT-A | Questionnaire QNR-2026-S0FF6J (AI-generated, regenerated once, edited, released twice, submitted) | `yzihv8dxcdwt37ugji8sn0k9` | Bob (AI job), answered by Jane |
| UAT-A | Risk Assessment ASM-2026-2XX26G, released; risks RSK-2026-0520P7, RSK-2026-308BAE, RSK-2026-807EKE (AI) and RSK-2026-NR85X3 (manual); four control implementations | `n7dc239udhera6gmsputx6zz` | Bob (AI job and edits) |
| UAT-B | Assessment Request RAR-2026-5MK24A "UAT-B: Customer portal partner API for retail partners" (BAU, High), returned to draft once and resubmitted | `nsl47ylot56t8esbqo6r1170` | Jane |
| UAT-B | Questionnaire QNR-2026-6HSY0W (AI-generated, one edit, released, submitted) | `wj22kfb4auded9ha80a1beuc` | Bob (AI job), answered by Jane |
| UAT-B | Risk Assessment ASM-2026-19QK3M, released; risks RSK-2026-0X23Y6, RSK-2026-9QR8G9, RSK-2026-CESKXC (AI); three control implementations | `xf87yizqogdok4o78y7ogok5` | Bob (AI job and edits) |
| UAT-C | Assessment Request RAR-2026-ZCKZMH "UAT-C: Service desk ticket summarisation with an external AI service" (Other, Moderate) | `ou52rjyuftbtko286fpp029r` | Maya |
| UAT-C | Questionnaire QNR-2026-NN5KNY (AI-generated, released unchanged, submitted) | `dywsntt7dk1nps5hz1vabkrl` | Bob (AI job), answered by Maya |
| UAT-C | Risk Assessment ASM-2026-022BJ9, In review (not released); risks RSK-2026-EXW2SM, RSK-2026-PAE0AH, RSK-2026-VW2JG4 (AI; one corrected) and RSK-2026-475W2D, RSK-2026-4C34AH, RSK-2026-4K75RG, RSK-2026-CGR8RY, RSK-2026-NXKV6K, RSK-2026-TTFHAD, RSK-2026-Y6G66A (manual, area 7); ten risks updated in the timing run | `wpxq7o2qhs3hl0natilxvfaw` | Bob |
| UAT-CSV | Risk Types "UAT-CSV: Supplier data processing", "UAT-CSV: Payment integrity"; Controls `0042` and `UAT-CSV-004`; Information Systems "UAT-CSV: Payroll test environment", "UAT-CSV: HR analytics dashboard"; Information Asset "UAT-CSV: Lower-case classification"; updates to "UAT-CSV: Payroll test environment" and "UAT-C: Quillnote ticket summarisation service" (hosting location) | see area 6 | Bob (CSV import) |

UAT-B reuses the seeded "Customer portal" system and "Customer records" asset, as the brief asks. The seeded portal is recorded as not internet-facing, which contradicts the scenario; it was left unchanged so the run could see how stale inventory data flows through.

## Journey log

### Area 0. Orientation (2026-09-27 15:19–15:23)

- Read `AGENTS.md`, `CONTEXT.md`, `docs/CSRM-PROJECT-BRIEF.md` (sections 1–13, 19–23, 26–33), `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md` and the ROADMAP headings. The locked decisions in `STATE.md` and the phase CONTEXT files, the known issues (`WINDOWS.md`, `APP-UI-REVIEW.md`, `08-UI-REVIEW.md`, STATE risks), the role–function–API catalogue, the JDL and `served-operations.json` were digested into working notes, which later areas cite.
- Neither server was running. The database was copied to `apps/strapi/.tmp/data.pre-product-uat.db` while Strapi was stopped (checksums match), then Strapi and the web app were started from this repository. Starting the web dev server did not modify `apps/web/AGENTS.md` (git status clean after start).
- Each actor signed in once through "Continue as …" and reached the "Dashboard" heading.
- Code reading that the run later checks against behaviour (inferred from code until confirmed):
  - Questionnaire generation sends the model only the request's title, description, assessment type, business purpose, business criticality, third-party involvement and third-party details. It does not send division, business unit, regulatory requirements, due date or the selected Information Systems and Assets. It asks for 8–15 questions and never uses the file-upload type (`openai-compatible-questionnaire-generation-provider.ts`).
  - Generated questions get keys `q-1` … `q-15`. Assessment-draft generation sends the model only the submitted answers as key–value pairs (no question text, no request fields) plus a fixed list of three Risk Types, "Internet Exposure", "Personal Information Handling" and "Third-Party Dependency", with their applicable control numbers. Suggested controls can only come from those types' applicable controls, and every proposed treatment is "Treat" (`openai-compatible-assessment-draft-provider.ts`, `assessment-workflow.ts` `loadRiskTypeContext`).

### Area 1. First impressions (2026-09-27 15:23–15:38)

Method: a script signed in as each actor at 1440×900 and 375×812, recorded the navigation tree, opened every item twice and recorded the second visit, and saved screenshots. No console errors and no horizontal overflow on any page.

**Navigation tree, Security Analyst (Bob), 1440.** Requestor and Secondary Requestor see items 1–5 only, in the same order, with the same icons.

| # | Section | Label | Opens | Page heading | Icon | Second visit |
|---|---|---|---|---|---|---|
| 1 | (none) | Workspace | `/app` | Dashboard | layout-dashboard | 924 ms |
| 2 | (none) | My Requests | `/app/requests` | My Requests | file-text | 906 ms |
| 3 | (none) | My Questionnaires | `/app/questionnaires` | My Questionnaires | clipboard-list | 937 ms |
| 4 | (none) | My Risk Assessments | `/app/assessments` | My Risk Assessments | shield-check | 922 ms |
| 5 | (none) | New request | `/app/requests/new` | New assessment request | file-plus-corner | 919 ms |
| 6 | (none) | Analyst dashboard | `/app/review` | Analyst dashboard | activity | 1,092 ms |
| 7 | (none) | Assessment Requests | `/app/review/requests` | Assessment request review | inbox | 934 ms |
| 8 | (none) | Questionnaires | `/app/review/questionnaires` | Questionnaire Review | clipboard-check | 935 ms |
| 9 | (none) | Risk Assessments | `/app/review/assessments` | Risk assessment review | shield-alert | 935 ms |
| 10 | (none) | Risk register | `/app/risks` | Risk Register | table2 | 1,068 ms |
| 11 | Reports | Alerts | `/app/alerts` | Alerts | bell | 964 ms |
| 12 | Reports | Reports | `/app/reports` | Reports | file-chart-column | 904 ms |
| 13 | Administration | Risk Types | `/app/admin/risk-types` | Risk Types | layers | 903 ms |
| 14 | Administration | Controls | `/app/admin/controls` | Controls | sliders-horizontal | 937 ms |
| 15 | Administration | Information Systems | `/app/admin/information-systems` | Information Systems | server | 925 ms |
| 16 | Administration | Information Assets | `/app/admin/information-assets` | Information Assets | database | 903 ms |

- No item carries a count or badge. The header shows "Cyber Risk Manager" and the role ("Requestor" / "Security Analyst"); there is no user menu or sign-out (real sign-in is deferred with INT-02). A development role switcher sits at the foot of the sidebar.
- At 375 the sidebar becomes a "Menu" button (85×44) opening a 264px "Navigation" drawer with a full-width Close button. Drawer links are 36px tall. The analyst's drawer scrolls (content 941px in an 812px viewport); the requestors' fits.
- Ambiguities and duplicates: "Workspace" opens "Dashboard", and a second "Analyst dashboard" exists; "My Questionnaires" and "Questionnaires", "My Risk Assessments" and "Risk Assessments" sit side by side with nothing saying which is personal and which is the review queue; "Reports" is both a section heading and an item; six labels differ from their page headings (UAT-002).
- **Requestor dashboard (Jane).** Seven lifecycle tiles (Draft 0, Submitted 1, Questionnaire in progress 3, Risk assessment drafted 1, Under review 3, Approved 3, Closed 0), "Draft requests" (0), "Questionnaires in progress" (1: "Customer portal questionnaire draft", Not started, 0 of 7 answered) and "Recently released assessments" (3, with Low/Moderate/High/Critical counts). It shows what needs attention only through the questionnaire panel; the tiles mix work waiting on Jane with work waiting on the analyst (UAT-003). At 375 the tiles fill the first two screens (UAT-004).
- **Secondary Requestor dashboard (Maya).** Same layout, all empty states ("No draft requests yet", "No active questionnaires yet", "No released risk assessments yet").
- **Analyst landing (Bob).** The same requestor dashboard for Bob's own records (Submitted 1, Under review 1, everything else 0), not his review work (UAT-001). The "Analyst dashboard" (`/app/review`) is informative: Needs action tiles (Requires my attention 9, Overdue 6, Due within 14 days 2, Needs attention 2), Review queue by bucket, Risk exposure by residual rating, High and Critical residual Risks, Treatments due, Upcoming due dates, Top alerts and Recent activity.
- Seeded reference data is thin: 3 Risk Types, 2 Information Systems, 1 Information Asset, and 2,646 Controls (ISO/IEC 27001 Annex A entries named only by number, UAT-007).

### Seeded records explored before spending AI budget (2026-09-27 15:26–15:30)

- **Questionnaire governance editor** (QUES-DEV-UNRELEASED-001, analyst review). A full-width "Release questionnaire" button sits above the editor. The editor lists sections and questions with Edit and Delete per question and one "Add question". The form has Question text, Answer type (Text, Long text, Boolean, Single select, Multi select, Date; Choices one per line for selects), a free-text Section title defaulting to "General" and Required. There is no reordering, no help text, no conditional logic, no preview of the requestor's view and no AI action. Add and Edit open the form below the last section, off-screen (UAT-005). A revision timeline follows.
- **Assessment editor** (ASM-2026-MWQA7E, Draft, three AI-proposed risks). The page is 12,001px tall at 1440. Order: header, originating request link, lifecycle stepper (Drafted, In review, Released, Closed), Assessment details (Summary, Overall rating, Overall control effectiveness, Overall risk rationale, Recommendations, Next review date, Save assessment), Release readiness (48 rows, UAT-011), then one expanded editor per risk with 34 fields and its own "Save risk", a "Mitigation controls" region with "Add mitigation control", and "Add Risk" at the end. There is no delete, no AI action and no marker of which values the AI proposed. Likelihood and consequence are free text (UAT-008); "Exemption review date" wants a typed UTC timestamp (UAT-009); system and asset pickers list the whole inventory (UAT-010); the control picker lists all 2,646 controls (UAT-006).
- **Review lists.** The assessment review list shows Assessment, Summary, Status and Draft initiated by: no request title, requestor, assessment type, risk count or age. The questionnaire review list shows "Analyst review" as a status that its Status filter (Not started, Draft, Submitted) cannot select.

### Area 2. UAT-A, the full flow at 1440 (2026-09-27 15:38–16:08)

UAT-A is a Project request from Jane for a vendor-run cloud HR and payroll platform (fictional Brightwage People for fictional Coralbay Utilities). Records: request RAR-2026-5WWFVQ (`al0a14wgmyfu4ugdnnqkwzhx`), questionnaire QNR-2026-S0FF6J (`yzihv8dxcdwt37ugji8sn0k9`).

| Step | Intended (cite) | What happened | Actor | How they knew what to do next | Clicks and waits | Status each actor sees |
|---|---|---|---|---|---|---|
| F1 create | Request with context plus PDFs, documents and spreadsheets (F1) | "Create request" opens a 13-field form in three groups (overview, business context, scope and timing). There is no file input or attachment affordance anywhere. Systems and assets are searchable multi-selects; all three UAT-A systems and the asset were found by typing. "Sponsor selection is unavailable until a least-privilege directory contract exists." "Save draft" took 165 ms and opened the request hub. | Jane | Form headings and field help are clear | 1 click to the form, 13 fields, 4 picker selections, 1 save | Jane: Draft, stepper step 1 of 8, "Next action: Complete and submit this request." |
| F1 resume | Save, leave, come back | The dashboard's "Draft requests" panel listed the draft; Edit reopened every value, including the four selections. Adding a sentence and saving took 1.0 s. | Jane | Dashboard panel | 3 clicks | Draft |
| F1 submit | Submit with confirmation | Dialog: "Submit this assessment request? Submission is irreversible. This request cannot be edited after submission." Confirmed in 0.5 s; toast "Request submitted." The page then offers "Return to draft", contradicting the dialog. | Jane | Dialog | 2 clicks | Jane: Submitted, "Next action: The work is waiting with the other party." |
| F2 pick up | An analyst picks up the request (F2) | The request tops Bob's queue ("Requires my attention", now 10), with columns Request, Title, Status and Submitted only: no requestor, type, criticality, due date or assignee. The hub has no pick-up, assign, claim or "ask for more information" action; "OWNER Jane Doe" is the requestor. The hub's "Request context" omits Third-party involvement, Third-party details and Regulatory requirements, which Jane entered and still sees on her own page. | Bob | Queue order and "Next action: Generate the questionnaire." | 1 click from the queue; hub 0.8 s | Bob: Submitted, step 2 of 8 |
| F3 generate | AI generates initial questions (F3) | "Generate questionnaire" sits at the foot of the hub. Job 1 completed in about 12 s; the panel showed "Attempt 1", then "Questionnaire generation is ready for review", naming the provider and model, and "Review generated questionnaire". | Bob | Button label | 1 click, 12 s wait | Hub: "Review and release the questionnaire." |
| F4 steer | Analyst edits, adds, or gives the AI more information to add, edit or delete questions (F4) | There is no way to give the AI instructions: the generate and replace actions take no input. "Add question" failed three times with "This questionnaire changed or cannot be governed in its current state. Reload and try again." (HTTP 409 on `POST /questionnaires/{id}/questions`), whether the section title was new or an existing one. The error appears at the top of the editor, about 2,600px above the Save button. Editing text, choices, answer type and the required flag works; delete works with a confirmation. | Bob | — | 3 failed adds | Questionnaire: Analyst review |
| A2 regenerate unanswered | Re-run the AI on the question list (A2) | The hub offered "Generate questionnaire" again with no sign that a questionnaire existed. Dialog: "Replace the unanswered questionnaire? This replaces the existing questionnaire only when it has no Requestor answers." Job 2 replaced every question in the same record in 13.9 s (queued, running, ready). The analyst's edit was discarded without warning, and the timeline still reads "Question edited, Question: q-14", which now names a different question; the regeneration itself is not recorded. | Bob | Dialog | 2 clicks, 14 s | Analyst review |
| F4 edit, F5 release | Analyst reviews and releases (F4, F5) | Rewrote q-1 in plainer words, made the contract question optional, deleted the logging question, and released after the confirmation "Release this questionnaire? The Requestor can view this questionnaire after release." After release the analyst page shows only the status, "Return to analyst review", "Awaiting questionnaire submission. Draft answers remain private until the Requestor submits one complete answer batch." and the timeline; the released questions are no longer visible to the analyst. | Bob | — | 8 clicks | Bob: "Released to Requestor"; request hub still "Submitted" |
| F5 answer part | Requestor answers, saves, leaves, returns (F5) | Jane's dashboard listed the questionnaire (Not started, 0 of 14), while her request tile still said "Submitted". The questionnaire opens with the revision timeline ("4 questions added or changed", with a bin icon), progress, and an amber "Questions requiring attention" box listing all 13 required questions in an order that does not follow the form. There is no introduction saying who is asking, why, or that "don't know" is an acceptable answer. Jane answered 5 and saved (1.5 s): "Draft saved. Your answers remain editable." She then typed an answer and left through the sidebar without saving: no warning, and the text was gone on return. Saved answers were intact. | Jane | Dashboard panel | 5 answers, 1 save | Jane: Draft, 5 of 14 answered |
| F5 submit | Finish and submit (F5) | 13 of 14 answered (one optional left blank). Dialog: "Submission is irreversible. This questionnaire cannot be edited after submission." The page then says "read-only and can no longer be edited" and shows "Return to draft". | Jane | Progress card "0 required questions unanswered" | 2 clicks, 1.6 s | Submitted |
| A1 requestor adds information | Requestor adds documentation or plain text at any point (A1) | New fictional fact: after-hours support will come from an offshore team with administrator access. The request page offers nothing (no Return to draft once a questionnaire exists, no note, no attachment). The only route was the questionnaire's "Return to draft" (reason required), changing the residency answer to "Yes" and appending the fact to an unrelated long-text answer, then resubmitting. | Jane | Nothing on screen says where new information goes | 6 clicks | Draft, then Submitted |
| A1 analyst adds information | Analyst adds documentation or plain text (A1) | There is no note, comment or attachment on the request, the questionnaire or (later) the assessment, and the analyst cannot edit the request in the web app. | Bob | — | — | — |
| A2 re-run with answers | Re-run the AI; keep answered questions, change unanswered ones, add more (A2) | With answers submitted, the hub hides questionnaire generation and offers only "Generate assessment draft". After "Return to analyst review" (reason required) the hub still offers no generation. There is no AI route; the manual route is Return to review. | Bob | — | — | Hub: "Draft the assessment." |
| A2 manual revision | Return to review, change and add questions, release again; answered questions kept (A2) | Returned to analyst review with a reason. Edited q-1's text (answer kept); replaced q-2's choices (answer cleared: "The answer was cleared because the revised question no longer accepts it."); repurposed the empty optional q-9 into a required question about offshore access; changed q-15 from long text to Boolean (answer cleared: "because the answer type changed"). "Add question" failed again (409). Released again. | Bob | — | about 15 clicks | Analyst review, then released |
| A2 requestor re-answers | Answers that still fit survive; new required questions answered (A2) | 11 of 14 answers survived. The three open questions were listed under "Questions requiring attention", and the timeline said "Some answers need completing again before you re-submit." The page's "Last returned to draft" panel showed Jane's own earlier reason, not the analyst's, and the timeline said "8 questions added or changed" for a round that changed 4. Jane answered 3 and resubmitted. | Jane | Attention box | 4 clicks | Submitted |

| F6 draft | AI drafts the initial risks (F6) | The hub's "Assessment draft generation" panel ("The draft is advisory: it is recorded as initiated by you and is released only by a Security Analyst after review.") started job 3 with no confirmation; queued, running, then "Draft generation is ready for Security Analyst review" at about 20.5 s, with "Open assessment draft". ASM-2026-2XX26G opened with three risks, readiness "31 of 48". No text on the assessment page marks any value as AI-proposed. | Bob | Hub next action "Draft the assessment." | 1 click, 20 s | Assessment: Draft; request: Risk assessment drafted |
| F7 edit | Analyst reviews and edits risks (F7) | Editing one risk for release (risk and treatment owner through searchable pickers, system, asset, classification, identified, target and resolve dates, status) took 18 actions; "Save risk" took 1.5 s and showed no confirmation. The first save moved the assessment to "In review" and readiness to 37 of 48. | Bob | Readiness list | 18 actions per risk | In review |
| F7 add | Analyst adds a risk (F7) | "Add Risk" appends a blank 34-field editor at the bottom of the 12,000px page. The payment-file integrity risk the draft missed (RSK-2026-NR85X3) took about 25 fields; "Add risk" saved in 2.1 s. The Risk type list offers the library's three types. | Bob | — | about 25 fields | Readiness 53 of 62 |
| F7 delete, re-run | Analyst deletes a risk or re-runs the AI for one risk or new risks (F7) | No delete, withdraw or "not applicable" on any risk. No AI action on the assessment; the hub shows only "Open assessment draft". | Bob | — | — | — |
| F8 send to requestor | Analyst releases the initial risks for the requestor to respond with mitigating controls (F8) | No such step. As Jane, the assessment's direct URL shows "Page not found" (HTTP 200, no details leaked); her stepper reads "Assessment reviewed", next action "The work is waiting with the other party." | Jane, Bob | — | — | Jane: Under review (tile) |
| F9 controls | Mitigating controls recorded; AI writes up residual risk (F9) | Bob added one control implementation per risk by choosing from the 2,647-option dropdown (APP-11, ISM-1785, E8 multi-factor authentication, CIS-3.10), with status, effectiveness, evidence and due date; "Add mitigation control" saved in about 1.7 s with no confirmation. "Control owner" offered only "Not specified" and people already named on the risk. No AI residual write-up exists; residual values are the draft's plus manual edits. | Bob | Readiness "At least one mitigation control" rows | 6–8 actions per control | — |
| F10 release | Analyst reviews and submits (F10) | With all 62 requirements met the panel read "All release requirements are met". "Release assessment" → "Release this risk assessment? Release is irreversible. Requestors will receive the assessment as read-only, and all analyst mutation controls will be removed." → "Confirm release" (2.1 s): "Assessment released. Release is complete. Analyst mutation controls have been removed." The page became fully read-only. | Bob | Readiness panel | 2 clicks | Released |
| After release: requestor | Requestor sees the released assessment | Jane's dashboard listed ASM-2026-2XX26G under "Recently released assessments"; her tiles moved UAT-A to "Approved" (request label) while the assessment says "Released". The released view (0.65 s) shows the overview (summary, rating, dates, "Generated by Bob Doe", reviewed and approved by Bob), then per risk only number, statement, inherent and residual rating, and control implementations shown as internal IDs ("CONTROL REFERENCE mgin2kcqf3xcv4npn7ehmk0x"). No treatment plan, owners or dates. | Jane | Dashboard panel | 1 click | Released |
| After release: oversight | Register, dashboards, reports, alerts | Risk Register search "RSK-2026" lists the four UAT-A risks with correct ratings, statuses, owners and target dates, related assessment shown as "ASM-2026-2XX26G" only. Analyst dashboard exposure moved from Critical 2 / High 4 / Moderate 5 to Critical 2 / High 7 / Moderate 6 (the three High and one Moderate UAT-A residuals); Recent activity lists the release, draft and questionnaire events. Reports: two UAT-A systems appear under "Most exposed Information Systems"; throughput counts the release (4 in September, median 1.1 days); control effectiveness counts the four new implementations. Alerts: none for UAT-A (no dates inside 14 days). | Bob | — | — | — |

Timestamps in every revision timeline show UTC ("5:49 am") while the browser and server run at UTC+10 (15:49), and events name questions by internal key ("Question: q-14") rather than by their text.

UAT-A records: request RAR-2026-5WWFVQ, questionnaire QNR-2026-S0FF6J, assessment ASM-2026-2XX26G (`n7dc239udhera6gmsputx6zz`) with risks RSK-2026-0520P7, RSK-2026-308BAE, RSK-2026-807EKE (AI) and RSK-2026-NR85X3 (manual), four control implementations, released 27 Sept 2026.

### Area 3. UAT-B, the full flow at 375 (2026-09-27 16:08–16:16)

UAT-B is a BAU request from Jane: the existing internet-facing customer portal opening a partner API to three fictional retail partners through a fictional managed API gateway. Every step ran at 375×812. Records: request RAR-2026-5MK24A (`nsl47ylot56t8esbqo6r1170`), questionnaire QNR-2026-6HSY0W (`wj22kfb4auded9ha80a1beuc`), assessment ASM-2026-19QK3M (`xf87yizqogdok4o78y7ogok5`).

| Step | What happened on a phone | Actor |
|---|---|---|
| Navigation | "Menu" (85×44) opens the drawer; "New request" and "Assessment Requests" reached in two taps. The drawer closes on navigation. | Jane, Bob |
| Request form | Single column, no horizontal overflow; page 2,519px. Inputs, selects and "Save draft" are 36px tall (known: 08-UI-REVIEW L287, L376). The 16px third-party checkbox is also toggled by its label, so the target is acceptable. Searchable pickers work with the on-screen list. Filling everything took about 11 s scripted. | Jane |
| Submit, return to draft, resubmit | Dialogs fit (343×220px). "Return to draft" (reason required) worked from Submitted, but the page then kept showing "Return to draft" and no "Edit request" or "Submit request" until a manual reload. Resubmitted after reload. | Jane |
| Request hub | The 8-step stepper stacks vertically: 880px tall, so "Next action" sits at y 1,620, two screens down. | Jane, Bob |
| Review queue | Rows become cards (no table), readable at 375. | Bob |
| Generate questionnaire | Job 4, 13.6 s, clear queued, running and ready states. | Bob |
| Analyst "Return to draft" with a questionnaire | Still offered to the analyst (hidden from Jane). Dialog accepted a reason, then refused inside the dialog: "This request changed while you were editing it. Reload and try again." The request stayed Submitted. | Bob |
| Question editor | Buttons 32px tall (Edit 51×32, Delete 68×32, Add question 127×32). Tapping Edit on the fourth question opened the form 2,618px below the viewport. One edit, then release. | Bob |
| Answer and submit | Page 5,778px for 13 questions; radio and checkbox controls are 16px but their labels are tappable. One save part-way, then submit with confirmation. | Jane |
| Regenerate after answers exist (refusal) | Not offered: the hub hides questionnaire generation once answers exist and shows only "Generate assessment draft". The server refusal cannot be reached from the web app. | Bob |
| Generate draft | Job 5, 23.6 s. Afterwards the hub shows only "Open assessment draft". | Bob |
| Second draft (refusal) | Not offered anywhere in the web app once a draft exists; the server's refusal cannot be reached from the web app. | Bob |
| Assessment editor | 21,784px tall at 375 for three risks (about 27 screens); no overflow. | Bob |
| Questionnaire "Return to draft" after the draft exists (refusal) | Still offered to Jane. Dialog accepted a reason, then refused: "This questionnaire changed or is no longer answerable. Reload and try again." | Jane |
| Release before readiness (refusal) | In Draft there is no "Release assessment" button. After the first edit (In review, 34 of 48 met) the button appears disabled, with the readiness list above it. The server-side refusal cannot be reached from the web app. | Bob |
| Edit after review complete (D-13) | With all 48 requirements met, changing the next review date returned the assessment to Draft with: "Completed review withdrawn. A later edit superseded the review completed by Bob Doe … Save the assessment again to record a fresh review; it cannot be released until a fresh review is recorded." Saving again restored In review. | Bob |
| Release | Enabled once ready; dialog fits (343×240px); released. | Bob |
| Released view | Jane's released view at 375: 4,979px, no overflow; same content limits as UAT-A (UAT-033). | Jane |
| Oversight lists | Risk Register, assessment review list, Controls and Alerts render as cards with filters behind a "Filters" button; no overflow. | Bob |

Revert to draft, by state: request Submitted → Draft allowed (requestor); request with a questionnaire → refused (analyst offered the action, misleading message; requestor not offered); questionnaire Submitted → Draft allowed before a draft exists (UAT-A); questionnaire after a draft exists → refused (requestor offered the action, misleading message); assessment → no revert action, only the edit-after-review regression to Draft; released assessment → nothing is editable.

### Area 4. UAT-C and AI quality (2026-09-27 16:16–16:21)

UAT-C is an "Other" request from Maya (Secondary Requestor): the service desk sending ticket text to a fictional external AI summarisation service. Records: request RAR-2026-ZCKZMH (`ou52rjyuftbtko286fpp029r`), questionnaire QNR-2026-NN5KNY (`dywsntt7dk1nps5hz1vabkrl`), assessment ASM-2026-022BJ9 (`wpxq7o2qhs3hl0natilxvfaw`), left In review.

| Step | What happened | Actor |
|---|---|---|
| Create and submit | Same form and flow as UAT-A at 1440; no issues beyond those already logged. | Maya |
| Generate, then leave the page | Job 6 started and the panel showed "queued". Bob went to the analyst dashboard (Review queue showed "Generation in progress 1") and came back 1.7 s after starting: the hub showed a plain "Generate questionnaire" button and "Next action: Generate the questionnaire.", with no sign the job was running. Bob did not click it. After the job finished and the page was reloaded, the next action read "Review and release the questionnaire." | Bob |
| Review and release | Released unchanged. | Bob |
| Answer and submit | 14 answers, several "not yet" (no redaction, no data processing agreement, locations unconfirmed, no key rotation). | Maya |
| Draft and review | Job 7, 24.6 s. Bob corrected the invented patch-status statement in one risk, noted why in its Comments field, set a risk owner, system and target date, and saved: status In review, reviewed by Bob, 35 of 48 requirements met. Left unreleased. | Bob |

**AI quality across the three scenarios**

| Criterion | UAT-A (payroll SaaS, Project) | UAT-B (partner API, BAU) | UAT-C (external AI service, Other) |
|---|---|---|---|
| Questionnaire relevance | High: SSO, vendor admin, bank-detail changes, payment file, sub-processor, migration, pay-run resilience | High: consent, per-account authorisation, credential lifecycle, plan-change validation, gateway, privileged admins | High: redaction, retention, privacy assessment, locations, contract, key handling, pilot gate, AI output checks |
| Missed context | Privacy Act, tax file numbers, data residency policy and "Restricted" classification (never sent to the model) | Consumer Data Right, residency, classification (never sent) | APP 8 cross-border disclosure (never sent); supplier training on data; prompt injection through ticket text |
| Duplicates or already answered | Mostly refinements of stated facts | Refinements | One question restates "locations not confirmed" |
| Plain language for a non-expert | Poor: compound questions with RTO/RPO, replay, conditional access | Mixed: OAuth client credentials, mutual TLS, audience restriction in choices | Fair |
| Answer types and length | 15 (cap); first run 13 of 15 long text, regenerated 11 long text, 3 single, 1 multi; all required | 13; 8 long text, 4 multi, 1 Boolean; all required | 14; 8 long text, 4 single, 2 Boolean; all required |
| Draft: traceable to answers | Yes | Yes | Mostly; one invented fact (connector patch status) |
| Risk statements (cause, event, consequence) | Well formed | Well formed | Well formed |
| Ratings consistent with rationale | Yes (Likely × Major = High; residual Possible × Major = High) | Yes (residual Moderate with cited controls) | Yes, but consequence written as "High" (rating scale) instead of a consequence term |
| Residual below inherent only with controls | Held at High because controls are unverified | Lowered to Moderate for cited controls | Equal to inherent: no controls |
| Suggested controls | Discarded before display (none shown) | Discarded | Discarded |
| Invented systems or assets | None; no system, asset or classification set on any risk | Same | Same |
| Treatments | All "Treat" (forced), specific plans | All "Treat", specific | All "Treat", specific |
| Coverage | Three risks, one per hard-coded type; missed payment-file integrity and segregation of duties | Three, one per type; missed unauthorised plan changes | Three, one per type; missed summary integrity and prompt injection; an API-key risk forced into "Internet Exposure" |

**Experience (area 4).** Questionnaires took 12–15 s and drafts 20–25 s (server log), so none reached the 30-second polling budget. The code shows that after 30 s the panel stops and says "Taking longer than expected. Automatic checks stopped after 30 seconds. The server-owned job remains authoritative." with "Check again" (inferred from code, not observed). No job failed, so failure and retry were not observed; retry exists only for failed jobs (see operator checks). Leaving the page mid-job loses the job's status (above). The only advisory wording is on the hub before generation ("The draft is advisory …") and the questionnaire job panel, which names the provider and model; the generated questionnaire and assessment pages carry no AI marking, and nothing distinguishes AI-written values from analyst edits.

### Area 5. Registers, lists and oversight (2026-09-27 16:21–16:27)

**Risk Register** (`/app/risks`, 22 risks after UAT-A, UAT-B and UAT-C):

| Check | Result |
|---|---|
| Search | "payroll" → 4 results, exactly the UAT-A risks. Search covers risk number and statement. |
| Treatment status, inherent and residual rating | Work and combine (residual Moderate → 9; plus inherent High → 7; In Progress → 7, including RSK-2026-0520P7). |
| More filters | A panel over the table with Risk owner, Treatment owner, Related assessment, Impacted system and Impacted asset (searchable pickers), Mitigation-control status (All, Existing, Planned, Implemented, Retired, No mitigation controls), Risk state (All, Open, Closed) and a target date range. Related assessment ASM-2026-2XX26G → 4; system "UAT-A: Brightwage People…" → 2; treatment owner Jane → 2; December target dates → 4 (UAT-B's three plus one seed); no mitigation controls → 9; closed → 1 seed. The Related assessment picker matches assessment numbers only: "payroll" finds nothing. Entering the second date within about a second of the first dropped the first (a navigation race); with a pause both applied. |
| Filters not available | Assessment type (BAU, Project, Other), division, business unit, requestor, Risk Type, data classification, review date. |
| Sorting | Every column sorts; residual rating sorts by severity both ways. |
| Pagination | 10, 25 or 50 rows; 22 results at 10 per page gave pages 1 and 2 as expected. The URL carries every filter, sort and page, so a view can be bookmarked. |
| Columns | Risk number, statement, inherent, residual, treatment status, treatment owner, target date, related assessment (number only). No column choice. |
| Risk detail | Read view grouped into statement and classification, ratings, ownership and treatment, mitigation controls, and related records (assessment number and request title). Released risks show "Released assessment - read only … can no longer be changed"; unreleased risks offer "Edit risk" and "Add mitigation control". No assessment type, and no history. |
| At 375 | Cards with filters behind a "Filters" button (area 3). |

**BAU versus Project oversight (O1).** Not possible. Assessment type appears in no column, filter, report or dashboard: the request queue (Request, Title, Status, Submitted; filters status and queue), the assessment list (Assessment, Summary, Status, Draft initiated by; filter status), My Requests and the Risk Register. A risk manager would have to open every request to learn its type.

**Reports.** All read-only, tables only (no charts), computed on read, no export.

| Report | Question it answers | Leads to action? |
|---|---|---|
| Risk exposure | How much open risk is there, at what rating, in what treatment state, and which systems carry the most High and Critical residual risk? | Headline figures link to the filtered register; the "Most exposed Information Systems" rows do not link. |
| Treatment performance | Which treatments are overdue, due within 30 days or undated? | Overdue figure and "View overdue treatments" link to Alerts; the most overdue risks link to their details. |
| Assessment throughput | How many assessments were released per month (6 or 12 months), how long from submission to release (median 1.1 days here), and how many requests sit in each state? | No links. |
| Control effectiveness | How many control implementations are existing, planned, implemented or retired, and how effective? | "Rated ineffective" links to Alerts; nothing else. |

**Alerts.** 10 alerts with urgency, residual rating, condition, record and date; filters by alert type and urgency; every row links to its record. Alerts cannot be acknowledged, assigned or snoozed, and alerts on released work never clear (known: 07 D-06, Phase 7 gap items 1 and 3).

**Systems, assets, controls and Risk Types.** List, create and edit work (nine records created in area 0 of this run; see Records). Detail pages are edit forms with a static "Downstream use" note ("Assessment and Risk references retain their own workflow history."); none lists the requests, risks or control implementations that use the record. The only system-level oversight is the Risk exposure report's "Most exposed Information Systems" list and the register's Impacted system filter; requests cannot be filtered by system. Seeded Risk Type descriptions read as developer notes ("Reusable deterministic draft mapping for external providers and service dependencies."), and some control names are cut short ("APP-11 — security of personal"). Nothing can be deleted or retired. The Information System edit form shows its saved owner as an internal ID ("Selected owner: sxgr1xj98ojps6uq2jpl5u8y"), and the systems list has no owner or criticality column.

### Area 6. CSV import and export (2026-09-27 16:27–16:33)

**Flow.** Each Administration list has "Import CSV" → five steps: Guidance (column table and "Download CSV template"), Select file ("Choose one UTF-8 .csv file no larger than 5 MiB and 5,000 data rows"), Review rows (counts by Create, Update, Unchanged, Rejected, Ambiguous; row table with CSV row number, state, natural key and details; tabs per state; "Download error report CSV"), Confirm (summary sentence, "I have reviewed the create and update rows" checkbox, then "Confirm import"), Results (final state per row, "View record" links, "Download result report CSV", "Import another CSV"). Validation took about 1.25 s and commit about 1.2 s for small files.

**Templates.** Header row only, CRLF, no BOM, no example row, API field names: `name,description`; `controlNumber,name,description,controlType,controlReference,framework,frameworkVersion,frameworkSource`; `name,description,systemType,environment,deploymentModel,businessCriticality,internetFacing,externalAccessRequired,hostingLocation,lifecycleState`; `name,description,location,type,dataClassification,confidentialityRating,integrityRating,availabilityRating,containsPersonalData,containsLegalData,containsCreditCardData,comments`. The Guidance step lists required columns, formats and allowed values. None of the four collections has a date column, so local date formats could not be exercised. The system owner and a Risk Type's applicable controls cannot be imported.

**Test files** (UTF-8 with BOM, CRLF, quoted commas, doubled quotes and in-cell line breaks as Excel writes them):

| File | Rows | Preview | Committed | Notes |
|---|---|---|---|---|
| Risk Types `rt-1` | 5 | Create 2, Rejected 1 (missing name), Ambiguous 2 (same name twice) | Created 2 | BOM and multi-line cell parsed; both duplicate rows held back. |
| Controls `ctl-1` | 6 | Create 2, Rejected 2 ("controlType must be one of: Preventive, Detective, Corrective, Compensating." for "Preventative"; "Enter a framework value."), Ambiguous 2 | Created 2 | `0042` kept its leading zeros; "detective" stored as "Detective". |
| Information Systems `is-1` | 7 | Create 1, Update 1, Rejected 3 ("environment must be one of: Production, Non-production." for "Prod"; "internetFacing must be true or false." for Yes/No; missing name), Ambiguous 2 | Created 1, updated 1 | The row "uat-b: core customer billing system" matched the existing "UAT-B: Core customer billing system" case-insensitively and was listed as an ordinary Update with a field diff; it overwrote the description and hosting location (name kept). |
| Information Assets `ia-1` | 4 | Create 1, Rejected 1 ("containsPersonalData must be true or false." for "Y"), Ambiguous 2 | Created 1 | "restricted" stored as "Restricted". |
| Information Systems `is-2-roundtrip` | 5 | Create 1, Update 3, Unchanged 1 | Created 1, updated 3, 1 skipped "without changes" | Excel's TRUE and FALSE accepted. Update rows show "field: old → new". A row with only name and hosting location changed that field and left the blank columns untouched, so a value cannot be cleared by import. Restored the UAT-B description changed by `is-1`. |
| Risk Types `rt-2-headers` | 1 | Rejected at step 2: "Invalid Administration CSV: the file contains an unsupported header." | — | Headers "Name,Description" plus an extra "Owner" column; the message does not name the header. |
| Risk Types `rt-3-cp1252` | 1 | Rejected at step 2: "Invalid Administration CSV: the file is not valid UTF-8." | — | Excel's default "CSV (Comma delimited)" on Windows writes this encoding; no advice on how to fix it. |

The error report (`risk-types-errors.csv`) has columns `rowNumber,naturalKey,state,issues`, CRLF and no BOM, and does not carry the original row values, so it cannot be corrected and re-imported. The confirmation step says "Strapi will validate and classify the same file again before writing."

A "round trip" in the spreadsheet sense is impossible: nothing can be exported, so updating existing records means retyping them from the screen.

**Export inventory.** No screen offers export, download, copy or print (checked on 20 routes as analyst and requestor). Where users would expect one:

| Screen | Why a user expects export |
|---|---|
| Risk Register (`/app/risks`) | Risk committee packs, audit requests, offline analysis in Excel |
| An assessment's risks (analyst editor and requestor's released view) | Sending the risk table to the business owner, treatment planning in Excel |
| Released assessment (requestor) | Attaching the result to a project gate or change record (PDF or XLSX) |
| Review queues and assessment list | Workload and status reporting |
| Reports (four) and the analyst dashboard | Monthly risk reporting to leadership |
| Alerts | Chasing overdue treatments with owners |
| Administration lists (Risk Types, Controls, Systems, Assets) | Round-trip maintenance of reference data in a spreadsheet |
| My Requests (requestor) | Tracking a portfolio of requests |

**Beyond Administration.** Risks, control implementations and requests cannot come in from a spreadsheet. Risks into an assessment should (Q4 paste and import); control implementations should, for bulk mapping of existing controls; request intake from a spreadsheet is less compelling, except for scheduled BAU reviews of many systems.

### Area 7. Risk table and Excel interoperability (2026-09-27 16:33–16:37)

**Setting up ten risks.** UAT-C's assessment (ASM-2026-022BJ9, In review) had three AI risks; seven realistic manual risks were added (summary accuracy and write-back, prompt injection, supplier training on data, cross-border disclosure, service outage, agent over-reliance, supplier breach). Each manual risk took 21 actions through "Add Risk" (about 3.2 s scripted). With ten risks the editor page is 37,251px tall at 1440 and the readiness panel lists 146 requirements ("112 of 146 release requirements met").

**Reviewing and updating ten risks today.** For each risk: set Treatment owner (searchable picker), Target date and Treatment status, read the residual rating, click "Save risk".

| Measure | Result |
|---|---|
| Where the first risk starts | y 12,378, below the details form and the 146-row readiness list |
| Height of each risk card | 2,438–2,518px (all 34 fields expanded) |
| Clicks and keystrokes | 60 clicks and 110 keystrokes (6 and 11 per risk) |
| Scrolling | about 36,800px in total (about 2,300px between risks) |
| Saves | 10 separate saves, 0.85–0.88 s each, no confirmation message |
| Scripted time | 23 s; a person working at 15–25 s per risk (scroll, find three fields, choose, save, wait) would need roughly 3–4 minutes for three fields on ten risks, before reading any statements |
| Order and navigation | Risks appear in risk-number order, which is effectively random (the three AI risks are interleaved with the manual ones); there is no sort, filter, search, jump list or collapse |
| Result | Readiness moved from 112 to 124 of 146 |

**Copying risks out.**

| Source | What reached the clipboard | Pasted into Excel |
|---|---|---|
| Jane's released view (select the "Identified risks" section, Ctrl+C) | `text/plain` and `text/html`, one value per line: "RSK-2026-0520P7", the statement, "Inherent risk rating", "High", "Residual risk rating", "High", "Control reference", "mgin2kcqf3xcv4npn7ehmk0x" … No tab characters and no HTML table. | One long column alternating labels and values; controls as internal IDs |
| Bob's editor (select one risk card, Ctrl+C) | Field labels and values one per line ("Issue statement", the text, "Risk statement", the text, "Risk category", "Operational" …); select values partly missing. | One long column per risk |

**Pasting in.** A three-row by four-column range (header, two risks; Risk statement, Inherent rating, Residual rating, Treatment owner) was put on the clipboard as tab-separated text plus an HTML table, as Excel does, and pasted with Ctrl+V into the second risk's "Risk statement". The whole block, tabs and line breaks included, landed in that one text box; the ratings and owner fields did not change, no rows were added, and nothing warned. The change was discarded by reloading without saving.

### Area 8. Dashboards (2026-09-27 16:37–16:39)

Figures were read at the end of area 7 and checked against the records this run created.

**Requestor dashboard (`/app`, every actor sees their own).**

| Widget | Question it answers | Figures vs records | Links to the list behind it | Helps someone act? |
|---|---|---|---|---|
| My Assessment Requests (7 lifecycle tiles) | Where are my requests? | Jane: Approved 5 = 3 seeded + UAT-A + UAT-B; Maya: Under review 1 = UAT-C. Match. | Yes, each tile to My Requests filtered by status | Partly: mixes work waiting on the requestor with work waiting on the analyst (UAT-003) |
| Draft requests | Which drafts can I resume? | 0 for all three (all drafts submitted). Match. | Each draft links to its request | Yes |
| Questionnaires in progress | Which questionnaires need my answers, and how far am I? | Jane 1 (seeded draft; UAT-A and UAT-B submitted); Maya 0. Match. | Each links to its questionnaire; progress bar | Yes |
| Recently released assessments | What has been released to me, and how serious is it? | Jane 5: Moderate 1, High 3, Critical 1. Match. | Each assessment links to its released view | Partly: nothing shows the risks or treatments Jane owns (she is risk owner on all four UAT-A risks) or their due dates |

Missing for the requestor: "important notifications" (brief §10; NOTIFY-01 deferred) and anything about risks or treatments they own.

**Analyst dashboard (`/app/review`).**

| Widget | Question it answers | Figures vs records | Links | Helps someone act? |
|---|---|---|---|---|
| Needs action (Requires my attention 10, Overdue 6, Due within 14 days 2, Needs attention 2) | What needs the team now? | Requires attention includes UAT-C (under review). Match. "My" means the whole team: there is no assignment. | Yes, to the queue and filtered Alerts | Yes |
| Review queue (requests by queue; questionnaires Submitted 5; assessments Draft 1, In review 4) | What is in each review stage? | In review 4 includes UAT-C. Match. | Yes, each count to its filtered list | Yes |
| Risk exposure (Critical 2, High 10, Moderate 13, Low 3) | How much open risk, at what residual rating? | Matches: High +3 and Moderate +4, Low +3 from UAT-C's ten risks. These are unreleased (in review), so proposals and accepted risks are counted together without a label. | Yes, to the register filtered by rating and "open" | Partly |
| High and Critical residual Risks (top 5) | Which open risks are most severe? | Seeded Critical and High first; UAT-A and UAT-B risks beyond the top five | Yes, each risk and "Open Risk Register" | Yes |
| Treatments due | Which treatments are overdue or due within 14 days? | Seeded items only (no UAT dates inside 14 days). Match. | Yes | Yes |
| Upcoming due dates | What falls due in the next 14 days? | Seeded items only. Match. | Yes | Yes |
| Top alerts | What is most urgent? | Seeded alerts. Match. | Yes | Yes, but alerts cannot be acknowledged or assigned |
| Recent activity (8 events) | What just happened? | UAT-C draft, questionnaire release and generation, UAT-C submission, UAT-B release. Match. | Yes | Partly: no filter, no "mine" |

The analyst's own landing page (`/app`) is the requestor dashboard for their own requests (UAT-001). No dashboard shows ageing, cycle time per stage, trends, a likelihood-by-consequence heat map, breakdowns by assessment type, division, business unit or system, analyst workload, or AI job failures. There is no leadership or risk-manager view beyond the four reports.

### Area 9. Sidebar and information architecture (2026-09-27 16:39)

How often each item was actually needed in the journeys (analyst Bob, requestors Jane and Maya):

| Item | Used in the journeys | How it was usually reached |
|---|---|---|
| Workspace (`/app`) | Every sign-in (landing) | Automatic; for Bob it showed nothing about his work |
| My Requests | Jane: to reopen UAT-A and UAT-B; Bob: never | Sidebar, or the dashboard's draft panel |
| My Questionnaires | Jane and Maya: rarely | The dashboard's "Questionnaires in progress" panel instead |
| My Risk Assessments | Jane: once | The dashboard's "Recently released assessments" panel instead |
| New request | Jane, Maya: once per scenario | The dashboard's "Create request" button more often than the sidebar |
| Analyst dashboard | Bob: at the start of each session and for area 8 | Sidebar |
| Assessment Requests | Bob: every scenario (the entry point for all work) | Sidebar |
| Questionnaires (review) | Bob: rarely | Links from the request hub |
| Risk Assessments (review) | Bob: rarely | "Open assessment draft" on the request hub |
| Risk register | Bob: area 5 and after releases | Sidebar |
| Alerts, Reports | Bob: areas 5 and 8 | Sidebar and dashboard links |
| Administration (four items) | Bob: setting up scenario data and area 6 | Sidebar |
| Bob's own My Requests, My Questionnaires, My Risk Assessments, New request | Never | — |

The proposed sidebars are in REPORT.md section 5.

### Area 10. Roles and administration (2026-09-27 16:39–16:43)

- **Who manages libraries and inventories:** the Security Analyst (Risk Types, Controls, Information Systems, Information Assets and their CSV imports). There is no Admin role and no Admin fixture identity; the catalogue defines Requestor, Security Analyst and the Security Analyst Agent service role only.
- **How roles are assigned:** Requestor is automatic for every signed-in user; Security Analyst is assigned outside the web app (IdamBox records, administered through Strapi's admin panel today; the development sign-in picks a fixture). The web app has no user list, role assignment or audit of role changes, and Phase 8 unmounted the IAM routes on purpose (08 D-36, D-44).
- **Direct URL checks (navigation visibility is not authorisation).** As Jane and as Maya, every analyst list and report route (`/app/review`, `/app/review/requests`, `/app/review/questionnaires`, `/app/review/assessments`, `/app/risks`, `/app/alerts`, `/app/reports`, `/app/reports/risk-exposure`, `/app/admin/*` including `new` and `import`) rendered a "You don't have access…" permission state with no data. Analyst detail routes for another requestor's records were refused (Maya on UAT-A: "You don't have permission to review this…", "Page not found"). Analyst detail routes for a requestor's own records rendered: Jane saw the analyst hub for her own request (no analyst actions, same fields), and the analyst questionnaire page for her own questionnaire with the timeline redacted to "by An analyst", but with the analyst-only "Return to analyst review" button. Pressing it on her seeded released questionnaire was refused inside the dialog: "You do not have permission to govern this questionnaire." (nothing changed). The analyst assessment route for her own released assessment showed an error state: "We couldn't load this assessment. Try again. If the problem continues, contact your administrator." As Bob, Jane's requestor pages open (by design: the analyst reviews everything) and the draft-only edit page shows "You don't have access to this area".
- Every one of these pages returned HTTP 200 (streamed rendering; known R-08-15).

### Area 11. Cross-cutting checks (2026-09-27 16:41–16:45)

- **Isolation (blocker check): passed.** As Maya, UAT-A's request showed "You don't have access to this area", its questionnaire "Questionnaire unavailable … You don't have permission to view this questionnaire", and its assessment "Page not found". As Jane, UAT-C's request, questionnaire and in-review assessment showed the same three states. The page HTML contained none of the record's identifiers, titles or scenario words (checked for 12 strings).
- **Five screen states.** Seen in the run: loading (streamed "Loading Risk Register" skeletons), empty ("No draft requests yet", "No active questionnaires yet", "No released risk assessments yet"), populated, error ("We couldn't load this assessment. Try again." on an analyst route reached by a requestor), and permission denied ("You don't have access to this area. Access is determined by your effective CSRM capabilities. Navigation visibility is not authorisation…"). The permission message speaks the product's internal language to end users.
- **Widths.** Core screens at 768, 1024 and 1440 (requestor dashboard, new request, questionnaire mid-flow, released view, analyst hub, ten-risk editor, questionnaire review, register, import step): no horizontal overflow at any width; the drawer replaces the sidebar below 1024. 375 was covered in areas 1 and 3. The ten-risk editor is 35,312px tall at 768 and 37,071px at 1440.
- **Accessibility scans.** axe (WCAG 2.0 to 2.2 A and AA tags) on 11 mid-flow states at 768, 1024 and 1440 (33 scans): no violations.
- **Keyboard only.** Requestor questionnaire: logical order (skip link, sidebar, request link, the attention list's links, then each question, Save draft, Submit), visible focus throughout except one segment of the native date input; Save and Submit reachable. In a radio group, arrow keys moved focus to the next option without selecting it (the ARIA radio pattern selects on arrow). Analyst risk editing on the ten-risk assessment: 177 Tab presses to reach the first risk's first field, 146 of them the readiness links, and 228 to its "Save risk"; there is no skip link to the risks. The owner picker works with typing, arrows and Enter.
- **Copy and terminology.** Requestor dashboard tiles say "Approved" for requests whose assessments say "Released" (a recorded decision, see CONTEXT.md); "Workspace" opens "Dashboard"; "The work is waiting with the other party."; "Strapi rechecks…"; "Contextual Risks"; question keys "q-14" and UTC times in timelines; "Questionnaire Review" capitalisation (known).
- **Perceived performance (development mode, second visit).** Routes load in 0.9–1.1 s (1.3 s for the ten-risk editor); saves 0.2–2.1 s; import validation and commit about 1.2 s each; AI jobs 12–25 s. Nothing felt slow except scrolling and tabbing through the long assessment page.
