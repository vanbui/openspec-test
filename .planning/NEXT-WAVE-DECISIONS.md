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
- **Roadmap:**
  - New Phase 17.1, "Review, peer approval and risk acceptance", inserted after Phase 17. It takes ASSESS-14 (and UAT-040) from Phase 17, plus ASSESS-20.
  - Phase 11 takes UX-10, and Phase 20 takes NOTIFY-02.
  - Control titles join Phase 10.
  - Execution order: 10, 11, 12, 13, 14, 15, 16, 19, 17, 17.1, 18, 20, 21, 22.

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

## What stays open

- **INT-02:** the Keycloak environment is still needed. Keycloak stays disabled until it exists.
- **Phase 8 residual decisions:** the residual register still lists the deployment-time decisions not settled above (the proxy topology, log retention and CSP reporting). They do not block the next wave.
