# Next-Wave Product and Governance Decisions

**Decided:** 2026-09-27, for Phases 10–22 (ROADMAP.md, Next Wave).
**Authority:** the operator delegated these decisions on 2026-09-27, to be made "based on what the process is in real life revolving around Cyber Governance as well as Premium UI/UX". They settle the eighteen decisions the product gap UAT left open (`.planning/uat/product-gaps/REPORT.md` §9), plus six more that the same practice calls for. They replace the provisional defaults recorded in STATE.md on 2026-09-27. The operator can still overrule any of them, and each phase's CONTEXT.md cites the numbers it depends on.

## The governance model these decisions follow

CSRM supports a second-line security function assessing first-line change, the arrangement in the Three Lines Model:

- **First line: the business.** The Requestor owns the change, the service or the vendor relationship. Named risk owners and treatment owners are business people, and every user holds the Requestor birthright role. The first line agrees the treatment plan and accepts residual risk.
- **Second line: Security Analysts.** They assess, challenge and advise, and they own the method: the matrix, the risk taxonomy and the control library. They do not accept business risk on the business's behalf.
- **Third line: audit.** Audit relies on the record: every change stored with who, when, and the old and new values, and every AI run recorded.

The assessment follows the risk management process of ISO/IEC 27005:2022, the guidance behind ISO/IEC 27001:2022 clause 6.1:

| Process step | CSRM stage |
|---|---|
| Context establishment | Request, attachments, notes |
| Risk identification | AI-assisted questionnaire and draft risks, which the analyst curates |
| Risk analysis | Likelihood by consequence on the 5 × 5 matrix |
| Risk evaluation | Against the risk acceptance criteria (the appetite) |
| Risk treatment | The Requestor's mitigating-controls response, which is the treatment plan |
| Risk acceptance | The risk owner approves the treatment plan and accepts the residual risk, as ISO/IEC 27001:2022 clause 6.1.3 f) requires |
| Communication | Release of the assessment |
| Monitoring and review | Register tracking, reviews and reminders |

## The eighteen decisions

| # | Topic | Decision | Real-world basis | Change from the report's recommendation | Phases |
|---|---|---|---|---|---|
| 1 | Admin role (R1) | Scope (b), with the details under Decision notes | Least privilege and separation of duties; configuration change control; joiner-mover-leaver and access recertification belong in IAM | Adds the access-review export and the configuration audit | 22 |
| 2 | Attachments (F1, A1) | Private storage, content checks, quarantine and per-file AI opt-in, detailed under Decision notes | OWASP file upload guidance; data minimisation; AI data governance | Adds the allow-list by content, the per-request cap, per-file AI opt-in and the classification ceiling | 14 (ceiling setting: 22) |
| 3 | Requestor participation before release (F8) | A "Released for response" stage, analyst-controlled and repeatable in numbered rounds, detailed under Decision notes | Management response to draft findings is standard assessment practice; the first line owns treatment | None | 17 |
| 4 | AI re-runs once answers exist (A2, F4) | (b): proposals add or change unanswered questions only; answered questions and their answers are kept as information; analyst edits change only through a proposal the analyst accepts | The operator's own wording for A2; human oversight of AI | None | 15 |
| 5 | Analyst instructions to the AI (F4) | Trusted but bounded, detailed under Decision notes | Prompt-injection defence; AI record keeping (NIST AI RMF, ISO/IEC 42001) | Makes the delimiting of untrusted text explicit | 12, 15 |
| 6 | Removing risks (F7) | No persisted risk is ever hard-deleted, detailed under Decision notes | Audit-trail integrity; AI accountability: record what the AI proposed and what a person decided | Drops the report's hard-delete exception | 16, 18 |
| 7 | Risk table approach (Q4) | A research spike with fixed criteria, detailed under Decision notes | Accessibility is a hard requirement here; licence cost and lock-in | Fixes the criteria as pass or fail | 18 |
| 8 | Scales, matrix and appetite | A 5 × 5 matrix with default scales, rating bands and acceptance authority, detailed under Decision notes | ISO 31000 risk criteria and ISO/IEC 27005 risk acceptance criteria; common Australian 5 × 5 practice; delegation-of-authority practice | Fixes the defaults | 12, 17.1, 18, 22 |
| 9 | After release (O1) | The released assessment is an immutable point-in-time record; its risks live on in the register, detailed under Decision notes | A register is a living record; monitoring and review is part of the process | Allows an analyst to re-rate residual risk after release, which the report kept frozen | 20 |
| 10 | Pick-up and assignment (F2) | One accountable assignee per request, with a conflict-of-interest rule, detailed under Decision notes | RACI: one accountable person; conflict of interest (security note O-5) | Adds the separation-of-duties rule | 13 |
| 11 | What exposure counts (Q1) | Released risks by default, with "under assessment" shown separately and accepted risks marked | Unvalidated draft risks are not yet register risks | Adds the accepted-risk marker | 11 |
| 12 | Exports (Q3) | CSV and XLSX in the viewer's authorised scope, logged, plus a print-ready report, detailed under Decision notes | OWASP CSV injection guidance; data loss prevention; a formal report is the usual deliverable | Adds export logging and the print-ready report | 19 |
| 13 | Charts (Q1) | Custom accessible SVG components, detailed under Decision notes | WCAG 2.2 AA; ADR 0001 gap 3; bundle budget | None | 21 |
| 14 | Risk Types the AI may use (F6) | The active Risk Type library, detailed under Decision notes | A risk taxonomy is curated by the risk function | Drops a separate "AI-eligible" flag unless research shows one is needed | 12, 22 |
| 15 | Control library content | Every control gets a readable title, detailed under Decision notes | Common GRC library practice; copyright | Decided now, and the titles move into Phase 10 | 10 |
| 16 | Released request label | "Released" for display; the stored value is unchanged | One word for one state across the product (root `CONTEXT.md`) | None | 11 |
| 17 | Review before release (F10) | An explicit "Mark reviewed" step, with peer approval for Critical residual risk, detailed under Decision notes | Maker-checker (four-eyes) for significant outcomes; separation of duties | Adds peer approval and moves review into Phase 17.1 | 17.1 (threshold setting: 22) |
| 18 | Notifications | An in-app centre in Phase 17, then due-date reminders in-app and by email in Phase 20, detailed under Decision notes | Workflow tools notify people when work waits for them; due dates need reminders to be met | Adds the email channel and persisted read state, split across two phases | 17, 20 |

### Decision notes

**1. Admin role.**
- The Admin owns reference data and configuration:
  - the Risk Type library, controls, systems and assets;
  - the scales, the matrix and the risk appetite, with its acceptance authority;
  - divisions and business units;
  - shared register views;
  - the review policy;
  - the AI data policy.
- The Admin has a read-only view of role holders, exportable for access reviews.
- Role assignment stays in the identity platform.
- The Admin does not inherit Security Analyst rights.
- Every configuration change is recorded with who, when, and the old and new values.

**2. Attachments.**
- **Storage:** Strapi's upload plugin with a private provider: local disk in development, private object storage encrypted at rest in production.
- **Downloads:** no public URLs. A file downloads only through an authorised Strapi operation, with `Content-Disposition: attachment` and `nosniff`.
- **Types and limits:** the type is checked by content signature and extension against an allow-list: PDF, DOCX, XLSX, PPTX, CSV, TXT, PNG and JPEG. Up to 25 MB per file and 20 files per request.
- **Scanning:** a file stays quarantined until the malware scan passes. The scanner is pluggable: ClamAV in production, a deterministic double in development and tests.
- **Removal and retention:** removal is recorded, soft removal. Files follow the assessment record's retention: 7 years after closure by default, and the Admin can set it.
- **AI use:** the analyst chooses, per file, whether its extracted text joins the AI context. The default is off. The text is size-capped and marked as untrusted, and it is never sent when the request's data classification is above the AI provider's approved ceiling (G-3).

**3. The response stage.** The Requestor, and any named risk owners, read the initial risks and respond per risk with the treatment plan:
- the existing controls;
- the planned controls, each with an owner, a due date and evidence.

**5. Analyst instructions.**
- An instruction has its own slot and is logged in the run record.
- It never holds Requestor text.
- Requestor text and attachment text are always delimited as untrusted data.

**6. Removing risks.**
- An unsaved row can be discarded.
- A persisted, unreleased risk is withdrawn with a reason. It stays in history and under a "Withdrawn" filter.
- A rejected AI proposal is recorded in the run record as rejected.
- A released risk is closed through the register with a reason.

**7. Risk table approach.** The spike's criteria are pass or fail:
- WCAG 2.2 AA conformance to the ARIA APG grid pattern, keyboard and screen reader;
- a permissive licence only (MIT, Apache 2.0 or ISC), with no commercial or source-available grid;
- within the route JavaScript budget, or a recorded exception;
- semantic tokens.

The lean is to extend the DataTable on TanStack Table with TanStack Virtual.

**8. Scales, matrix and appetite.**
- **Likelihood:** Rare, Unlikely, Possible, Likely, Almost certain (scores 1–5).
- **Consequence:** Insignificant, Minor, Moderate, Major, Severe (1–5), each described across financial, operational, regulatory and legal, reputational, privacy and safety impact.
- **Rating:** the product of the two scores, banded as 1–4 Low, 5–9 Moderate, 10–16 High and 20–25 Critical. It is derived automatically and can be overridden with a recorded reason.
- **Acceptance authority and review intervals:**

  | Residual rating | Position | Who may accept | Review |
  |---|---|---|---|
  | Low | Within appetite | The risk owner | Every 12 months |
  | Moderate | Within tolerance | The risk owner, with a treatment plan or rationale | Every 12 months |
  | High | Outside appetite | Treatment is required. Acceptance needs the risk owner plus a named executive approver | Every 6 months |
  | Critical | Outside tolerance | Treatment is required. Acceptance only by a named executive approver, as a time-limited exception | Every 3 months |

- **AI proposals:** the AI may propose "Accept" only for Low or Moderate residual risk, and only with a rationale.
- **Configuration:** these are defaults the Admin can change.

**9. After release.**
- Treatment owners and analysts update treatment status, progress notes, dates and evidence.
- A Security Analyst re-rates residual risk after treatment, as a recorded review with a rationale, and closes the risk with a reason.
- Statements and inherent ratings are frozen: a changed statement is a new risk.
- Every change is recorded with who, when, and the old and new values.

**10. Pick-up and assignment.**
- Analysts self-assign, or any Security Analyst assigns, and reassignment is recorded.
- Other analysts may contribute: editing is not exclusive.
- An analyst cannot be assigned a request they raised (G-1).

**12. Exports.**
- CSV (UTF-8 with a BOM) and XLSX, in the viewer's authorised scope.
- Requestors export their own released assessments.
- Values that start like formulas are neutralised.
- Every export is recorded in the server log with the actor, the view, the filters and the row count.
- The released assessment offers a print-ready A4 report, for PDF, through the print stylesheet.

**13. Charts.** Custom accessible SVG components on the design direction's monochrome ink ramp and risk tokens, each with a data-table alternative. No charting library unless the interaction needs grow.

**14. Risk Types the AI may use.** The AI draws on the organisation's taxonomy, and may propose several risks per type. The Admin controls which types are active, and types are retired rather than deleted.

**15. Control library content.**
- Where the framework names the control, use that name: ISO/IEC 27001:2022 Annex A control titles, Essential Eight strategy names, Australian Privacy Principle titles.
- Where it does not, as with the paragraph-level requirements of APRA CPS 234 and CPS 230 and the PSPF requirements, write a short descriptive title in CSRM's own words.
- The source reference (standard, clause or paragraph) is kept.
- The body text of ISO standards is never loaded.
- The Admin can edit titles.

**17. Review before release.**
- The assigned analyst marks the assessment reviewed. Edits after review withdraw the review and show what changed.
- When any residual risk is Critical, a second Security Analyst approves before release (four-eyes). The Admin can move this threshold to High, apply it to all assessments, or turn it off.
- Neither reviewer can be the Requestor of that request (G-1).

**18. Notifications.**
- **Phase 17:** an in-app notification centre with per-user read state, covering:
  - assignment;
  - questionnaire released and submitted;
  - risks released for response, and the response submitted;
  - acceptance requested and decided;
  - assessment released;
  - new notes.
- **Phase 20:** due-date reminders, in-app and by email through Strapi's email plugin:
  - treatments due soon or overdue;
  - acceptance and exemption reviews due;
  - an assessment's next review due.
- **Email:** development and tests use a capture provider, so nothing leaves the machine. The production mail provider is deployment configuration.

## Six further decisions

- **G-1 Separation of duties.** An analyst cannot be assigned, review, peer-approve or release the assessment of a request they raised. Strapi enforces this. The analyst service agent never holds human-analyst grants, as today. The Admin holds no analyst grants by default. Phases 13, 17.1 and 22.
- **G-2 Risk acceptance by the risk owner** (ISO/IEC 27001:2022 clause 6.1.3 f).
  - Before release, each risk's owner approves its treatment plan and accepts its residual risk, within the authority decision 8 sets.
  - A decline, with a reason, returns the risk to the analyst.
  - Each acceptance records who accepted, the authority, the rationale and the review date.
  - Acceptances appear on the owner's Home and in the register's "Accepted risks" view.
  - This is new requirement ASSESS-20, delivered with ASSESS-14 in the new Phase 17.1.
- **G-3 AI data policy.**
  - The AI context holds only what the operation needs (data minimisation).
  - Requestor text and attachment text are delimited as untrusted.
  - Each run records its context summary, provider, initiating analyst and outcome.
  - Generation is refused, with a plain message, when the request's data classification is above the provider's approved ceiling. The ceiling is an Admin setting with no ceiling by default in development, and the research settles where a request's classification comes from.
  - Phases 12, 14 and 22.
- **G-4 Premium experience bar for every Next-wave UI-SPEC:**
  - a keyboard path for every primary action;
  - optimistic feedback that rolls back on error;
  - skeletons while loading;
  - an Undo toast instead of a confirmation for reversible actions, with confirmations kept for governance-significant, irreversible steps (submit, release for response, accept, release);
  - empty states that say what to do next;
  - no lost input anywhere;
  - comfortable and compact density on dense data surfaces;
  - motion from the direction, honouring reduced motion;
  - purpose-built phone layouts (cards and sheets), not squeezed desktop layouts;
  - every figure opens its records.

  The design direction stays the only source of values, and anything new is a recorded extension.
- **G-5 Quick find.**
  - Ctrl+K, or ⌘K on a Mac, opens a dialog that jumps to a request, questionnaire, assessment or risk by number or title.
  - It covers only records the user may read, using the existing server-side list searches.
  - New requirement UX-10, Phase 11.
- **G-6 Planning housekeeping.**
  - Every human Security Analyst may see a request's generation-job status (Phase 10 D-25).
  - The Playwright rule follows Phase 8 D-12: a run leaves the tree clean, and a dirty tree is a harness defect, with no restore step.
  - Under this delegation, the orchestrator approves each `docs/contract-gaps/` record once it has been written and reviewed. It records the approval in the record rather than holding it for the operator.

## What these decisions change

- **Requirements:**
  - **New:** ASSESS-20 (risk acceptance), NOTIFY-02 (reminders and email) and UX-10 (quick find), making 46 in all.
  - **Updated acceptance criteria:** REQ-08, COLLAB-02, INT-05, ASSESS-08, ASSESS-09, ASSESS-14, ASSESS-18, RISK-04, RISK-05, NOTIFY-01, CSV-01, ADMIN-05 and ADMIN-07.
  - **New after the product demo (G-11 to G-18, 2026-10-01):** ASSESS-21 to ASSESS-26, COLLAB-04, NOTIFY-04 and RISK-06, making 55 in all.
  - **Updated after the product demo:** ASSESS-11, ASSESS-12, ASSESS-14, ASSESS-20, RISK-04, RISK-05, NOTIFY-01 and NOTIFY-02.
- **Roadmap:**
  - New Phase 17.1, "Review, peer approval and risk acceptance", inserted after Phase 17. It takes ASSESS-14 (and UAT-040) from Phase 17, plus ASSESS-20.
  - Phase 11 takes UX-10, and Phase 20 takes NOTIFY-02.
  - Control titles join Phase 10.
  - After the product demo (2026-10-01):
    - Phase 17 takes ASSESS-21, ASSESS-22 and ASSESS-23, and stays L.
    - Phase 17.1 takes ASSESS-24 and ASSESS-25 and grows from M to L.
    - New Phase 17.2, "Contest points and rework rounds", inserted after Phase 17.1, takes COLLAB-04, ASSESS-26 and NOTIFY-04 (G-15), because the contest-and-rework loop would push Phase 17.1 past L.
    - Phase 20 takes RISK-06 and grows from M to L.
    - Phase 17 now depends on Phase 19, Phase 18 on Phase 17.1, Phase 20 on Phases 14, 17.1 and 17.2, and Phase 21 on Phase 17.2.
    - New Phase 19.1, "In-app notification centre", inserted after Phase 19 and run before Phase 17, takes NOTIFY-01 from Phase 17 (G-19). Phases 17 and 20 now depend on it.
  - Execution order: 10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22 (17.2 and 19.1 added on 2026-10-01).

## Operator-delegated infrastructure and release decisions

On 2026-09-28 the operator delegated the remaining items as well ("Use your own discretion for these") and asked for planning to continue past the usage threshold.

- **G-7 Production infrastructure.** These are the targets the phases build adapters and configuration for. Provisioning them is deployment work outside the build.
  - **Region:** Australia (Sydney) for every store and processor, for Australian privacy and prudential expectations.
  - **Files:**
    - a private S3-compatible bucket through Strapi's official `@strapi/provider-upload-aws-s3`, with public access blocked, SSE-KMS encryption, versioning, and lifecycle rules that enforce retention;
    - the local provider in development and tests.
  - **Malware scanning:**
    - ClamAV (`clamd`) as a sidecar reached over its INSTREAM protocol, with signatures kept current by `freshclam`;
    - it fails closed: an unavailable scanner keeps files quarantined;
    - development and tests use a deterministic double that flags the EICAR test file, and nothing is installed globally on the build host.
  - **Email:** Strapi's email plugin with the nodemailer SMTP provider, pointed at the organisation's relay or Amazon SES in Sydney, from a domain aligned with SPF, DKIM and DMARC. Development and tests use a capture provider.
  - **AI provider for production data:**
    - an OpenAI-compatible endpoint hosted in Australia under enterprise terms (no training on customer data, bounded retention), for example Azure OpenAI in Australia East or a self-hosted model;
    - the AI data policy fails closed in production, so generation is refused until the Admin sets the classification ceiling (G-3);
    - the full-transcript diagnostics flag (R-08-12) takes effect only in development;
    - development keeps no ceiling, and every suite stays on the deterministic provider.
  - **Secrets:** environment configuration or a secrets manager, never committed.
  - **Where each is built:** Phase 14 (storage and scanner adapters), Phases 17 and 20 (email provider configuration), Phases 12 and 22 (the AI policy).
- **G-8 Milestones.** v1.0 shipped when `dev` merged into `main` on 2026-09-26 (`37874ed`). As in ordinary release practice, findings made after release go into the next version.
  - v1.0 closes now as an override close-out:
    - INT-02 stays deferred by operator decision;
    - Phase 06.10 moves to the backlog;
    - Phase 9 is superseded by Phases 12, 15, 16 and 17;
    - the product gap UAT's defects in v1.0 flows are carried into v2.0 Phase 10;
    - the 52 open close-audit items are acknowledged with their dispositions.
  - v2.0, "Assessment Lifecycle and Oversight", opens with Phases 10–22 and 17.1.
  - Phase directories stay in place.
  - No tag is created in the build; the suggested `v1.0` tag target is `37874ed` on `main`.
- **G-9 Pushing.**
  - `uat-trial` is pushed to `origin` as a branch at stable boundaries (after the milestone switch, and when planning ends), once the attribution audit is clean. It holds documents only.
  - Nothing is pushed to `dev` or `main`, and no pull request or merge is made: integration stays with the team's review.
- **G-10 Self-hosted fonts.** Plus Jakarta Sans, Instrument Serif and IBM Plex Mono (all SIL Open Font License) are served from the app through `next/font/local` instead of `next/font/google`. This takes a third-party request out of every build and page, making builds and the E2E suite hermetic (R-08-24), and changes no design value. It is a quick task before Phase 10 executes, and ADR 0001 gets an amendment note.

## Post-demo decisions

**Decided:** 2026-10-01, for Phases 17, 17.1, 17.2 (inserted) and 20.
**Authority:** the operator's post-demo brief (`.planning/POST-DEMO-BRIEF.md`, section 6) delegates the discretion: "choose what a mature cyber-governance function would do (Three Lines; ISO/IEC 27005), at the G-4 premium UX bar". These decisions reconcile the product demo's risk-owner asks with decisions 3, 8, 9 and 17 and G-1 to G-10. They amend the planned phases rather than add a parallel flow. The operator can still overrule any of them.

### The asks

The operator's words from the demo, split into the IDs that requirements trace to. "Ticket" means the `CsrmAssessmentRequest`.

| ID | Ask |
|---|---|
| PD-1 | "The nominated risk owner and the requestor need to be able to view the risk assessment." |
| PD-2 | "After the analyst submits the final assessment, it requires risk acceptance from the risk owner to formally close the ticket." |
| PD-3 | "In this stage, the risk owner can contest anything written down, and the analyst should be able to edit everything again." |
| PD-4 | "Risk acceptance or Treatment Plan." |
| PD-5 | "Treatment plans need to be tracked, etc." |

### What holds

- Acceptance stays before release (G-2; ISO/IEC 27001:2022 clause 6.1.3 f). Contest and rework therefore happen while the assessment is still editable, and decision 9's immutable released record holds.
- No new IdamBox Role. Risk owners and executive approvers are first-line people with the Requestor birthright. Every grant below is record-level: Strapi checks the resolved IdamBox User against the record, and never branches on the auth mode.
- An analyst never decides a risk on its owner's behalf. No AI path or service identity accepts, treats, closes or releases.

### The decisions

**G-11 Nominated risk owners.**
- **Ask:** PD-1 names "the nominated risk owner". The JDL holds an owner per risk (`CsrmRisk.riskOwner`); the request has only `requestor` and `sponsor`.
- **Options:**
  1. Each risk's own `riskOwner`, nominated by the analyst. Chosen.
  2. A request-level or assessment-level owner field. Rejected: it would duplicate `riskOwner`, the two could disagree, and the JDL already puts ownership on the risk.
  3. Reuse `sponsor`. Rejected: the sponsor backs the change, which is not the same as owning its risks. Overloading a JDL relation breaks the terminology rule, and first-line users cannot pick a sponsor anyway (Phase 2).
- **Choice:**
  - The risk is the unit of accountability. The nominated risk owners of an assessment are the distinct `riskOwner`s of its non-withdrawn risks.
  - A Security Analyst nominates each owner with the existing analyst user search, and can nominate one person for every risk in one step. Release for response is refused until every non-withdrawn risk has an owner. Strapi refuses an inactive user or a service identity (a user holding the Security Analyst Agent role).
  - The Requestor or a nominated owner can propose a different owner: in the response (Phase 17), in a note (Phase 13) or, during acceptance, in a contest point (G-15). The analyst decides.
  - Separation of duties, extending G-1 both ways. The request's assigned analyst, the reviewer and the peer approver cannot be a risk owner or an executive approver (G-14) on that assessment. A person named as either cannot edit, review, approve, submit, recall or release that assessment as a Security Analyst, whatever roles they hold. Strapi enforces both.
- **Basis:** ISO/IEC 27005:2022 gives each risk an owner with the accountability and authority to manage it. In the Three Lines the second line proposes the owner and the first line owns the risk. Nobody should both assess and accept the same risk.
- **Phases:** 17 (nomination, the release-for-response gate, the rule for owners); 17.1 (the rule for executive approvers, reviewers and peer approvers).
- **Reverses:** nothing. It moves the risk-owner condition of v1 release readiness (`phase-04-composite-release-fact.md`) forward to release for response, and extends G-1.

**G-12 Who reads the assessment, and when.**
- **Ask:** PD-1. Decision 3 lets "the Requestor, and any named risk owners, read the initial risks". It does not say what a risk owner who is not the Requestor reads, or until when.
- **Options:**
  1. Every participant reads the whole assessment from its first release for response onward. Chosen.
  2. Each owner reads only their own risks. Rejected: nobody can judge or accept a risk without its context (the summary, the related risks, the overall rating), and a partial view cannot carry a contest point on the assessment as a whole.
  3. Owners read only after release, as v1's Requestor did. Rejected: acceptance comes before release (G-2).
- **Choice:**
  - The participants are the Requestor, each nominated risk owner (G-11) and each named executive approver (G-14).
  - Strapi grants each participant a read of the whole assessment from its first release for response, or from its first submission for acceptance if the analyst skipped the response stage: the assessment's fields, every non-withdrawn risk with its control implementations, the responses, the decisions and their history, and the contest points with their replies. The gate reads a dedicated fact that is never cleared, as the questionnaire's release gate does (06.8). An assessment released before this flow has no such fact, so only its Requestor reads it whole, as in v1, and its risk owners see their own risks through Phase 20.
  - The read lasts through every response round, the analyst's rework, every acceptance round and the released record. Each view names its stage: Released for response, With the Security Analyst, Awaiting acceptance or Released. Before the gate opens, participants see nothing of the assessment.
  - The read includes the request's summary as context: number, title, description, assessment type, division, business unit, business criticality, and the systems and assets in scope. The questionnaire, the notes (COLLAB-01) and the attachments (COLLAB-02) stay with the Requestor and the analysts.
  - Actions are narrower than the read. Each is open only in its own stage and only on the person's own risks; the Requestor may respond on any risk of their request.
  - "My risk assessments" lists every assessment the person takes part in, with their part. The print-ready report and the export of a released assessment follow the read (decision 12).
  - Participation is current. Someone who stops being an owner or approver loses the read, and their entries stay in the history.
  - Treatment owners and control owners who are not participants see only their own risks and treatments, after release (Phase 20, RISK-05).
  - Anyone else, Requestor or not, gets the refusal a missing record gets, at every route and stage, in the API and the UI. AGENTS.md's rule that a Requestor must not reach another Requestor's restricted records still holds: the read comes from being named on the record, never from holding a role.
- **Basis:** need to know. The people who must accept a risk see what they accept, which ISO/IEC 27001:2022 6.1.3 f) presumes, and nobody else sees anything.
- **Phases:** 17 (the gate, its refusals, "My risk assessments", exports); 17.1 and 17.2 (decisions and contest history join the read); 20 (owner-scoped reads for non-participants).
- **Reverses:**
  - Extends decision 3 from the initial risks to the whole assessment, for as long as the person takes part.
  - Reverses v1's rule that a Requestor reads an assessment only through their own `requestor` relation (Phase 4: "Requestor assessment projections require exact owner ancestry plus the complete release triple and approved owning request"; `phase-04-composite-release-fact.md`, "Requestor visibility and projections"). Decision 3 had already opened the response stage to the Requestor.
  - Extends decision 12's Requestor export to every participant of a released assessment.

**G-13 Submit final assessment, acceptance rounds, release and closure.**
- **Ask:** PD-2. Map "submits the final assessment" and "formally close the ticket", and settle when the request closes.
- **Options for closure:**
  1. The assigned analyst releases and closes in one confirmed step once every risk has a valid decision. Chosen.
  2. The assessment releases and the request closes automatically on the last decision. Rejected: a first-line action would make the record final without the second line's last look at owner-entered treatment plans, which breaks the core value (Security Analysts control release); an executive's approval would double as a release; and nobody would confirm the record before it becomes immutable.
  3. Release with the request `approved`, and close it when every treatment completes. Rejected: treatment lives on in the register (decision 9), so requests would stay open for months and the queues would lose their meaning. The operator ties closure to acceptance, not to treatment.
  4. Release, then a separate "Close" step. Rejected: a second confirmation with no governance value.
- **Choice:**
  - "Submit final assessment" is the request for acceptance. The assigned analyst can submit only when "Mark reviewed" is current, peer approval is in place where decision 17 needs it, every risk has an owner and, at High or Critical residual rating, a named executive approver, and every other release-readiness condition is met.
  - Submitting opens acceptance round n (1, 2, …). While a round is open, Strapi refuses every analyst edit to the assessment, its risks and their control implementations, so owners decide on stable content. The analyst can still reply to contest points (G-15).
  - The assigned analyst can recall an open round, with a reason. A recall closes round n as "recalled" and reopens the whole assessment for editing. The next submission opens round n+1, and decisions already given survive only as G-15 allows.
  - The assessment is ready to release when every non-withdrawn risk has a valid decision under the authority G-14 sets. The assigned analyst then releases and closes in one confirmed step, in one transaction: the assessment becomes `approved` (shown "Released") with `approvedBy`, `approvalDate` and `assessmentDate`, and the request becomes `closed` (shown "Closed"). The assessment's `nextReviewDate` becomes the earliest decision review date, unless the analyst set an earlier one. The assessment's own `closed` status stays unused.
  - Submit, recall, and release and close are human-analyst-only, as release is today (`HUMAN_ANALYST_ONLY_OPERATIONS`).
  - The released predicate accepts an owning request in `approved` (released before this flow) or `closed`, so released reads, lists, summaries and exports keep working. Today `releasedAssessmentQuery` and `isReleasedAssessmentForOwner` accept `approved` only.
- **Basis:** ISO/IEC 27001:2022 6.1.3 f): owners accept before the record is final. Maker-checker between the first line's decision and the second line's release. The core value: Security Analysts, not AI, control release.
- **Phases:** 17.1.
- **Reverses:**
  - v1's release transition, which moves the request to `approved` (Phase 4: "Release requires the complete assessment status/approver/date triple and owning-request approval in one transaction"; `phase-04-composite-release-fact.md`, "Transitions and irreversibility", including "`closed` is not a release state"). A release under this flow moves the request to `closed`; `approved` stays only on requests released before it.
  - Decision 16's "Released" label for the request's `approved` status (Phase 11 D-46) now covers only those earlier requests. A request released under this flow reads "Closed".
  - Decision 17's peer approval moves from "before release" to before submission, so owners decide on peer-approved content. It is still before release, so the rule narrows rather than reverses.

**G-14 The risk decision: accept or treat.**
- **Ask:** PD-4. G-2 and decision 8 say who may accept, but nothing gives the owner an explicit choice per risk.
- **Options:**
  1. One explicit decision per risk, Accept or Treat, on the JDL fields, by the named person, with authority by residual rating for both choices. Chosen.
  2. The same, with the authority applied to Accept only, so the owner alone may approve any treatment. Rejected: CSRM's residual rating already counts the planned controls (ASSESS-12, ASSESS-13), so it is the risk left once the plan is done. ISO/IEC 27001:2022 6.1.3 f) asks for acceptance of exactly that risk, and decision 8 sets who may accept it by its rating.
  3. One sign-off for the whole assessment. Rejected: ownership and authority are per risk, and one sign-off hides which risks were retained untreated.
  4. The owner only approves the analyst's treatment action. Rejected: treatment is a first-line decision; the analyst's value is advice.
- **Choice:**
  - Each non-withdrawn risk takes one decision, in the owner's acceptance view and API:
    - **Accept** (`treatmentAction` `Accept`), with a rationale: the risk is retained with no further treatment. Accept is offered only for a risk with no planned control implementation, because the residual rating counts planned controls. An owner who will not carry out a planned control contests the rating instead (G-15), so the analyst re-rates what is really retained. For High and Critical risk the rationale says why treatment is not practicable.
    - **Treat** (`treatmentAction` `Treat`), with `treatmentPlan`, `treatmentOwner` and `treatmentResolveDate`, starting at `treatmentStatus` `Not Started`. The treatment owner is found by name (G-17) and defaults to the risk owner.
    - The analyst's values pre-fill the form as a recommendation. An AI-proposed treatment action stays a recommendation; decision 8's rule that the AI proposes Accept only for Low or Moderate risk is unchanged.
  - Authority follows the residual rating, whichever the choice (decision 8):
    - Low and Moderate: the risk owner.
    - High: the risk owner, then the named executive approver.
    - Critical: the risk owner proposes, and only the named executive approver decides, as a time-limited exception that sets `isExempted` and an `exemptionReviewDate` three months out.
  - The analyst names the executive approver of each High or Critical risk with the analyst user search before submitting, or one approver for all of them in one step. The executive approver is a different person from the risk owner. The owner can ask for another approver in a contest point. The Admin can change the authority and intervals from Phase 22 (decision 8).
  - Each decision records who decided, when, under what authority, the choice, the rationale, a review date from the appetite's interval (12 months for Low and Moderate, 6 for High, 3 for Critical) and a fingerprint of the risk's decision-relevant content (G-15). A revision or a void adds a record; nothing is overwritten.
  - Only the named person can decide. Strapi checks the caller against the risk's `riskOwner` or named executive approver, never a role. No Security Analyst grant reaches the decision operation, the assigned analyst cannot be named (G-11), and no service identity can decide.
  - Until release, a decider can revise their own decision, and the revision is recorded.
  - The released assessment and the register show each decision. Phase 11 D-41's "accepted" marker then means a valid Accept decision; risks released before this flow keep D-41's rule.
- **Basis:** ISO/IEC 27001:2022 6.1.3 e) and f): the treatment plan is formulated, and risk owners approve it and accept the residual risk. ISO/IEC 27005 treatment options: Treat stands for modifying the risk and Accept for retaining it. Delegation of authority by rating.
- **Phases:** 17.1 (decisions, authority, records); 20 (review reminders, the register's accepted view).
- **Reverses:**
  - G-2's "a decline, with a reason, returns the risk to the analyst" (ASSESS-20 criterion 1). There is no per-risk decline; a disagreement is a contest point (G-15).
  - v1's analyst-set `treatmentAction` (Phase 4) becomes the analyst's recommendation, which the owner's decision replaces.

**G-15 Contest points and rework rounds.**
- **Ask:** PD-3.
- **Options:**
  1. Contest points on any content the participant can read; sending the assessment back reopens all of it; decisions survive a round only if their risk is unchanged. Chosen.
  2. G-2's per-risk decline, returning only that risk. Rejected: the ask is "anything written down", which includes the summary, the overall rating and the control implementations, and a change to one risk can move others and the overall rating.
  3. Notes (Phase 13). Rejected: a note has no target, no status and no round, so nobody could show that each challenge was answered, and notes are visible only to the Requestor and the analysts (COLLAB-01).
  4. A contest point as a kind of note, one entity with a type. Rejected: notes would then carry targets, rounds, statuses and a wider audience they do not need.

  For decisions already given there were three options: keep them all (rejected: an owner could be held to content that has since changed); void them all on any resubmission (rejected: every owner re-decides after a one-word fix elsewhere); or keep each only while its risk is unchanged (chosen).
- **Choice:**
  - **Contest points** are their own recorded concept, like Phase 13's note and Phase 14's attachment, and compete with no JDL entity. During an open acceptance round any participant (the Requestor, a risk owner or an executive approver) can raise one on anything they can read: an assessment field, a whole risk, one risk field or a control implementation. Each needs a reason, has an append-only reply thread (plain text, attributed, in local time), and has a status: open, answered, then resolved or withdrawn. The analyst answers; the raiser resolves or withdraws.
  - **Sending back.** A risk owner or an executive approver sends the assessment back with their points, closing round n as "returned". The analyst's recall (G-13) closes it as "recalled". Either way the whole assessment reopens for editing, and any edit withdraws "Mark reviewed" and a Critical peer approval (decision 17). The Requestor can raise points but not send back, unless they also own a risk.
  - **Answering.** The analyst answers each point "changed", saying what changed, or "kept", with a reason. "Kept" can be given while the round is open; "changed" needs the round closed. The analyst cannot resubmit while any point of the closed round is unanswered, and must mark the assessment reviewed again, with peer approval where needed, before round n+1.
  - **Decisions already given** stay valid in round n+1 only if their risk's decision-relevant content matches the fingerprint recorded with the decision: every field of the risk (its owner and executive approver included), its control implementations and its treatment fields. A changed risk's decision is voided, marked "superseded by a change in round n+1", and kept in the history. Its decider decides again, with a view of each changed field before and after. A change only to assessment-level fields voids nothing.
  - **Release** is refused while any point is open. An answered point its raiser did not resolve stays on the record as answered.
  - **History.** Rounds (opened, returned, recalled, completed), submissions, recalls, decisions, revisions, voids, points and replies are kept with who and when. Every participant and analyst of the assessment can read them.
- **Basis:** ISO/IEC 27005 communication and consultation: challenges from stakeholders are recorded and answered. The third line relies on a complete decision trail. Re-deciding only what changed keeps acceptance meaningful without making owners repeat themselves.
- **Phases:** 17.1 (rounds, recall, fingerprints and voids, because a recall already reopens the assessment); 17.2 (contest points, sending back, answers, the before-and-after view and the history view, inserted because this loop would push 17.1 past size L).
- **Reverses:** G-2's per-risk decline, which returned only that risk, becomes a contest that reopens the whole assessment (ASSESS-20 criterion 1). Decision 17's "edits after review withdraw the review" is unchanged and now applies in every rework round. COLLAB-03, comments on questionnaires and assessments, stays a future requirement: contest points belong to acceptance rounds and are not general comments.

**G-16 Treatment tracking after release.**
- **Ask:** PD-5. Phase 20 already plans post-release updates (decision 9, RISK-04), the owners' view (RISK-05) and reminders (NOTIFY-02). Confirm what it covers and fill the gaps.
- **Options:**
  1. Amend RISK-04 and RISK-05 only. Rejected: the lifecycle, its automation, evidence and the refusals form one testable state machine; folded into RISK-04 it could not be tested as one requirement.
  2. A new RISK-06 for the lifecycle, with RISK-04, RISK-05 and NOTIFY-02 amended. Chosen.

  For `Overdue` there were three options: derive it on read and never store it (Phase 7 D-04; rejected because the JDL's `CsrmTreatmentStatus` includes `OVERDUE`, and exports and the register should carry it); let people set it (rejected: lateness is a fact of the date, not a judgement); or have the server write it and every read derive it by one rule (chosen).
- **Choice:** Phase 20 covers:
  - "My risks and treatments" (RISK-05), scoped by Strapi to the risks the viewer owns, the treatments they own, the control implementations they own, and the decisions awaiting them or due for review. A risk owner sees the treatment of each of their risks, whoever owns it.
  - The lifecycle. People set `Not Started`, `In Progress` and `Complete`. The server sets `Overdue` when `treatmentResolveDate` passes before completion, in a daily run and in the same transaction as any treatment update, and every read derives the same rule, so a read between runs is never stale. An overdue treatment leaves `Overdue` only on completion or a recorded date change, and then returns to its last progress status.
  - Progress notes, append-only and attributed, in local time. Completion needs an evidence statement and records who and when; files can be attached through Phase 14's attachment service.
  - Who changes what. The treatment owner updates status, progress notes and evidence. The risk owner also changes the treatment owner, the plan and the due date, each with a reason. A Security Analyst can do all of these, re-rates residual risk and closes the risk (decision 9). Risk statements, inherent ratings and the decision record are frozen. A treatment owner cannot change any risk field.
  - The governing date. A treatment's due state, due soon or overdue, follows `treatmentResolveDate`, falling back to `targetDate` only for a treated risk without one. One rule serves the register, Home, alerts, reports, reminders, exports and the stored status. An accepted risk has no treatment due state; its decision's review date drives its reminders.
  - Reminders and escalation (NOTIFY-02): the treatment owner is reminded of treatments due within seven days or overdue, and overdue treatments escalate to the assigned analyst and the risk owner.
- **Basis:** ISO/IEC 27001:2022 clause 8.3 (implement the treatment plan) and clause 9.1 (monitoring); ISO/IEC 27005 monitoring and review. A register is a living record (decision 9), and closure rests on evidence the third line can check.
- **Phases:** 20.
- **Reverses:**
  - Phase 7 D-04, in part. The treatment due state moves from `targetDate` to `treatmentResolveDate`, and the server now writes `Overdue`, which D-04 said nothing sets and nothing reads; the derived rule stays the authority. Phase 7's treatment alert kinds and its treatment performance report follow the new date.
  - NOTIFY-02's escalation to the assigned analyst alone: it now reaches the risk owner too.

**G-17 Finding people by name.**
- **Ask:** first-line users must name people: planned-control owners in the response (decision 3) and treatment owners in a Treat decision (G-14). The web gives them no people search: the request form says sponsor selection is unavailable "until a least-privilege directory contract exists" (Phase 2).
- **Finding:** the API already serves one. `GET /api/v1/users?search=` is granted through the Requestor's `function.risk_assessment_requests.new_request` ("Search Users") as well as the analyst's `risk_assessment_details`. It returns only the `documentId` and `displayName` of active users, at most 20, and the authorisation matrix expects every identity to get 200. But the web never calls it for a first-line user, a one-character term is accepted, a service identity can be returned, and nothing records the searches.
- **Options:**
  1. Harden the served operation and use it for first-line users. Chosen.
  2. Default the treatment owner to the risk owner and offer no search. Rejected as the only path: owners routinely delegate treatment, and a typed name cannot receive reminders or appear in the register.
  3. The analyst assigns every control and treatment owner. Rejected: the second line would do the first line's work, with a round trip for every name.
  4. A new directory operation. Rejected: it would duplicate a catalogued operation the Requestor already holds.
- **Choice:** one hardened search for every caller:
  - a term of at least two characters, and no other query parameter;
  - at most 20 results, as today;
  - active human users only: never an inactive user or a service identity;
  - `documentId` and `displayName` only, never email, username or roles;
  - each search recorded in the server log with the actor, the time, the term and the result count, as exports are (decision 12).

  First-line users get it where they first need it: control owners in the Phase 17 response, then treatment owners in Phase 17.1, where the risk owner is the default. Sponsor selection stays out of scope.
- **Basis:** least privilege and data minimisation; logging, so that directory enumeration can be detected (ISO/IEC 27001:2022 Annex A 8.15 and 8.16).
- **Phases:** 17 (hardening and first use); 17.1 (treatment owner).
- **Reverses:** settles Phase 2's deferral, "Keep sponsor lookup absent until a least-privilege sponsor-directory contract is defined" (`STATE-ARCHIVE.md`): this is that contract, though sponsor selection itself stays off. The analyst's owner pickers now need two characters rather than one.

**G-18 Notifications for the acceptance flow.**
- **Ask:** the new stages only work if the people they wait on know. Decision 18 puts an in-app centre in Phase 17 and email reminders in Phase 20.
- **Options:**
  1. In-app events as each stage lands, and email only as a reminder for decisions left waiting, from Phase 20. Chosen.
  2. Email every acceptance event from Phase 17.1. Rejected: the email channel and its capture provider arrive in Phase 20 (decision 18, G-7), and building them early adds risk for little gain.
  3. In-app only. Rejected: executive approvers seldom sign in, so a decision that waits on them needs an email reminder.
- **Choice:**
  - Recipients now include nominated risk owners and executive approvers, always within what each may read.
  - Phase 17: risks released for response, to the Requestor and each nominated owner; a response submitted, to the assigned analyst.
  - Phase 17.1: acceptance requested in each round, to every participant with a decision to make; executive approval requested; a decision recorded, to the assigned analyst; a decision voided, to its decider; a round recalled, to the participants; the assessment released and the request closed, to every participant.
  - Phase 17.2 (NOTIFY-04): a contest point raised, to the assigned analyst; answered, to its raiser; the assessment sent back, to the assigned analyst and the other participants.
  - Phase 20 (NOTIFY-02): reminders in the app and by email for a decision waiting more than seven days, for treatments due within seven days or overdue, and for acceptance and exemption reviews due; overdue treatments escalate to the assigned analyst and the risk owner.
- **Basis:** people are told when work waits for them (decision 18), and overdue work has an escalation path.
- **Phases:** 17, 17.1, 17.2 and 20.
- **Reverses:** nothing. It extends decision 18's event list and NOTIFY-02's escalation.

**G-19 The notification centre in its own phase.**
- **Ask:** Phase 17's discussion found the phase beyond size L as scoped: four new content types, a participant read across every assessment route, a new AI operation, three new UI surfaces, and a notification centre wired into seven events (17-CONTEXT D-78).
- **Options:**
  1. Move the notification centre (NOTIFY-01; 17-CONTEXT D-56 to D-63) into a new Phase 19.1 that runs after Phase 19 and before Phase 17. Chosen.
  2. Keep it in Phase 17 and accept a phase beyond L. Rejected: work that pushes a phase past L is split (as G-15 did for Phase 17.2), and the centre is the most self-contained part of Phase 17.
  3. Move it to Phase 17.1. Rejected: Phase 17's own response events need it, and Phase 17.1 is already L.
- **Choice:**
  - Phase 19.1 builds the centre, its per-person read state and its first kinds, from the events that exist before Phase 17: assignment and notes (Phase 13), the questionnaire released and submitted, and the assessment released.
  - Phase 17 adds the response kinds through the same notification service, and Phases 17.1, 17.2 and 20 add theirs as G-18 lists.
  - NOTIFY-01 moves to Phase 19.1, and the contract-gap record becomes `docs/contract-gaps/phase-19.1-notifications.md`.
- **Basis:** a vertical slice that is useful on its own, because people are told when work waits for them (decision 18), and phases kept within L so that each is built and verified in one pass.
- **Phases:** 19.1, 17 and 20 (its reminders use the centre).
- **Reverses:** decision 18's placement of the in-app centre in Phase 17. Its substance is unchanged.

## What stays open

- **INT-02:** the Keycloak environment is still needed. Keycloak stays disabled until it exists.
  - Updated 2026-10-01: the code is no longer the gap. OIDC sign-in (ADR 0003) and Strapi access-token verification (ADR 0004) are implemented behind flags and off in development. What stays open is the deployment: a Keycloak environment, the ADR 0004 realm changes, and `externalSubject` links for every user.
- **Phase 8 residual decisions:** the residual register still lists the deployment-time decisions not settled above (the proxy topology, log retention and CSP reporting). They do not block the next wave.
