# Phase 10: Existing-flow gap closure - Research

**Researched:** 2026-09-27
**Domain:** Correctness and completion of existing Next.js 16.3 App Router screens over Strapi 5.51 workflow services, through the typed openapi-fetch contract layer. The screens are questionnaire governance and answering, the request hub, assessment editing and release, and reference data.
**Confidence:** HIGH for every root cause and file reference (each opened in this session). MEDIUM for the framework and library behaviours marked below.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Scope and contract boundary

- **D-01:** No Strapi content-type schema changes (`apps/strapi/src/api/*/content-types/*` stays frozen). Anything that would need one is deferred with a note, not worked around: the Information Asset owner (UAT-053) is deferred. The questionnaire `governanceLog` JSON envelope gains one event kind and one optional field (D-10, D-18). That extends the envelope approved in `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md` and is recorded there as a dated amendment; it is not a content-type change. **Reversibility:** costly - events written with the new kind and field persist in stored questionnaires.
- **D-02:** Every API change follows the established pattern:
  - exact IdamBox Role → Function → FunctionAPI grants in both catalogue copies, byte-identical;
  - record-level checks in Strapi;
  - the operation or schema in `docs/references/specification.json`, then `api:generate` and a clean `api:check`;
  - closed Zod parsers registered in the contract parity guard;
  - a row in `apps/strapi/tests/fixtures/authorization-matrix.ts` for any new route;
  - `docs/references/served-operations.json` regenerated while the dev servers are stopped.

  The server shape and the client parser change in the same plan (the 06.9 lesson).
- **D-03:** The API changes this phase makes are these seven, and no others. Each is verified against the code in `10-RESEARCH.md`.
  1. Closed conflict reason codes on the 409s the UAT met (D-22).
  2. One new read of a request's generation jobs (D-25).
  3. The `regenerated` governance event and a question-text snapshot on question events, with the timeline projecting question text (D-10, D-17, D-18).
  4. The number of analyst question changes since the latest generation on the questionnaire summary (D-16).
  5. Released-risk treatment and ownership facts on the shared risk read, and a bounded control summary on control implementations (D-34).
  6. The Information System owner's display name on the Administration record and list (D-37).
  7. Bounded applicable-control summaries on the picker's Risk Type list (D-31).

### Questionnaire governance editor (UAT-005, UAT-016; QUES-08 criteria 1-2)

- **D-04:** Where the question form opens:
  - **Edit** opens the form in place of the question it edits.
  - **Add** opens at the end of the section where it was invoked; each section has its own add control.
  - The **editor-level Add** opens at the top with a section choice.

  The form takes focus in its first field when it opens. Save and Cancel return focus to the control that opened it, or to the saved question (WCAG 2.4.3).
- **D-05:** The form chooses a section instead of typing a free-text title: an existing section by title, or "New section" with a title.
  - **Existing section:** the web sends that section's stored metadata unchanged.
  - **New section:** the web derives a key unique across every question, removed questions included, and the next free section order.
  - **Question order:** the next free order within the chosen section, again counting removed questions. The server's definition check counts them, and the web's question parser drops them today, so the governance editor needs the full placement set.
  - **Contract:** unchanged.
  - **Renaming a section** is not offered, because every question in the section would have to change together.

  Root cause, confirmed: `blankQuestion` sends section key `general` at order 0 whatever title is typed (`questionnaire-governance.tsx:36`). That collides with generated sections, which start at order 0, and with any second title after a first add. Seeded questionnaires start their sections at order 1, which is why the 06.8 journey passed.
- **D-06:** Errors show inside the form beside its Save button (`role="alert"`). The editor-level error area stays for release and return. A placement clash, for example another analyst's add saved first, returns a specific reason (D-22), and the message tells the analyst to reload for the latest questions.

### Released questionnaire for the analyst (UAT-020; QUES-08 criterion 4)

- **D-07:** A released, unsubmitted questionnaire shows the analyst its questions read-only: text, answer type, required flag, choices and section, with no answers. It also shows "N of M answered" from the summary's existing `progress`. No answer content crosses before submission (the operator default for Phase 10).

  No API change. `projectQuestionnaire` already serves `progress` to analysts (`apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts:386-406`), and question answers stay masked until the submitted batch (`projectQuestions`).

### Regeneration (UAT-019; QUES-08 criterion 3)

- **D-08:** When a questionnaire exists, the request hub's action reads "Replace questionnaire". Its confirmation states:
  - how many analyst question changes since the latest generation it discards (the D-16 count; it says so when there are none);
  - that Requestor answers are never replaced;
  - what happens next.

  Exact copy goes in the UI-SPEC.
- **D-09:** Replacing a released questionnaire is refused with a 409 and a reason code, and is not offered. The analyst returns it to analyst review (reason required) first.

  This was found in research. `persistGeneratedQuestionnaire` replaces the questions of a released, unanswered questionnaire and keeps `releasedAt`, because the request stays `submitted` until the Requestor's first save. Regenerated AI questions would then reach the Requestor without analyst review, contrary to 06.8 D-05 and D-15 (no implicit backward transition).
- **D-10:** Replacement appends a `regenerated` governance event in the same transaction that replaces the questions. It records the initiating analyst, the time, and an explanation naming the number of questions replaced and analyst changes discarded.

  Question keys are not versioned; soft-deleting replaced questions would collide with the definition's section and order checks. Instead, question events carry a text snapshot (D-18), and events older than the latest generation read as belonging to an earlier version (D-17).

### Requestor questionnaire (UAT-021, UAT-022, UAT-023, UAT-064; QUES-09)

- **D-11:** Answers autosave. This fits the existing save path: `saveQuestionnaireDraftAction` sends the full active answer set, and Strapi serialises saves per questionnaire.
  - **When it saves:** a debounced save about 1.5 seconds after the last change, and immediately when a field loses focus.
  - **Concurrency:** one save in flight at a time; changes made during a save queue one follow-up save.
  - **What the Requestor sees:** a saved state near the progress card: saving, "Saved" with the local time, or not saved with Retry. Failure is announced once.
  - **Save draft:** stays, as "save now" (brief §7 allows both).
  - **Revalidation:** the autosave action does not revalidate the page being edited. `revalidatePath` inside a Server Action re-renders the current page (Next 16.3 docs, `revalidatePath.md`). The explicit save and submit keep today's revalidation.
- **D-12:** Leaving warns first when changes are waiting to be saved, a save is in flight, or the last save failed.
  - **Client-side navigation:** `next/link`'s `onNavigate` consults a navigation-guard context provided by the app shell (the documented Next 16.3 pattern, `link.md` "Blocking navigation"), and the product's confirmation dialog asks.
  - **Reload, close and external navigation:** `beforeunload`.
  - **After a successful save:** nothing blocks navigation.
- **D-13:** The first screen and the history:
  - **Introduction first:** a short introduction built from existing facts: the request, why the Security Analyst asks, how many questions, that answers save automatically and can be finished later, and what to do when unsure. It must not promise a "Not sure" choice the form lacks; generated "Not sure" choices are Phase 12. The first section follows.
  - **Attention list:** "Questions requiring attention" appears only after a submit attempt and follows form order (section, then question). Root cause: `validateActiveRequiredAnswers` walks the definition in the server's order, and `projectQuestions` sorts by question order alone, so sections interleave.
  - **History:** moves below the questions. Its summary counts changes per release round and uses a neutral change icon; today it counts all rounds and borrows the latest event's icon, a bin after a deletion.
- **D-14:** Radio groups select with the arrow keys however quickly the key is released. The shared radio wrapper (`apps/web/src/components/ui/radio-group.tsx`) handles the arrow keys itself, so selection follows focus as the ARIA radio pattern and the direction's segmented control require. The segmented control gets the same behaviour.

  Root cause (research): Radix radio-group 1.4.7 selects on focus only while a document-level arrow-key flag is set, but roving focus moves in a deferred timeout and the keyup clears the flag first on a fast release. The UAT's scripted key press hit exactly that. The segmented-control unit test already works around it by holding the key.
- **D-15:** Submission dialogs and submitted notices say what happens next and how to change it, matching the actions the page then offers:
  - a request can return to draft until the questionnaire exists;
  - a questionnaire can return to draft until the assessment draft starts.

  They never call a reversible step "irreversible". Exact strings go in the UI-SPEC.

### Questionnaire summary facts (supports D-08)

- **D-16:** The questionnaire summary's `revision` facts gain a server-derived count of analyst question changes (added, edited, removed) since the latest generation. The hub reads it for the replace confirmation. **Reversibility:** costly - a published contract field.

### Timelines and local time (UAT-024; UX-06 criterion 3)

- **D-17:** Timelines name questions by their text, never by key.
  - **Analyst timeline:** shows the text captured when the event was written.
  - **Older events without a snapshot:** Strapi resolves the key against the current questions, removed ones included, only when the event is not older than the questionnaire's latest generation. Otherwise the event reads as "a question from an earlier version".
  - **Requestor summary:** never shows keys.
- **D-18:** New question events (added, edited, removed, answer cleared) store a bounded snapshot of the question text, truncated to the event field bound with an ellipsis. This extends the governance-log envelope (D-01). **Reversibility:** costly - persisted event data.
- **D-19:** Instants render in the viewer's time zone; calendar dates (Strapi `date`, JDL `LocalDate`) stay zone-free and keep today's formatting.
  - **Where the zone comes from:** a client component in the app shell sends the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` to a Server Action, which validates it as an IANA zone and stores it in a cookie.
  - **How instants are formatted:** server and client components format through one shared helper using that zone. Without a valid cookie they format in UTC and say "UTC".
  - **Why not an inline script:** the nonce CSP and the output-safety guard rule it out.
  - **Surfaces changed now:** Phase 10 applies this to what it touches: revision timelines, the revert audit summary, the request's submitted and updated dates, the released assessment's dates, and the autosave time.
  - **Recorded for Phase 11:** other instants on lists, dashboards, alerts and reports.

  This follows the Next 16.3 guidance for dates that depend on request data (`preventing-flash-before-hydration.md`, "When to use other approaches"). **Reversibility:** reversible.

### Request pages (UAT-015, UAT-037; REQ-07)

- **D-20:** The analyst's request page shows every field the Requestor submitted, grouped as on the request form:
  - "Request overview";
  - "Business context", with third-party involvement, third-party details and regulatory requirements;
  - "Scope and timing".

  One shared read-only component serves both actors' pages. Web only; the request read already carries every field (`request-schema.ts`).
- **D-21:** After every workflow transition, each actor's actions come from server state. `RequestWorkflowActions` keeps its in-page submit result and prefers it to the refreshed prop (`request-workflow-actions.tsx:26`), so a return to draft in the same page session left the submitted actions showing. It stops overriding server state, and each transition refreshes the route. This root cause is narrower than the UAT's reading, because the revert already refreshes.

### Actions, refusals and reasons (UAT-036; UX-06 criterion 1)

- **D-22:** Every backward action is offered only when the rule Strapi applies allows it, through shared zod-free domain predicates both actors use:
  - **Request return to draft:** only while `submitted` with the questionnaire and assessment relations `absent`. `unavailable` means one exists.
  - **Questionnaire return to draft:** only while the questionnaire is submitted and the request is `questionnaire-in-progress`.
  - **Return to analyst review:** only before an assessment exists.

  The 409s the UAT met carry a closed reason code in `error.details.reason`, declared in the conflict response schemas. The transport keeps a validated code, and each code maps to a plain message. An unknown code falls back to a generic message that never says "changed, reload" unless that is the reason. Research fixes the vocabulary for request revert, questionnaire revert, governance, answer save and submit, and generation. **Reversibility:** costly - a published error contract.

### Analyst routes opened by a Requestor (UAT-062; UX-06 criterion 5)

- **D-23:** The three analyst detail routes check `assessment:review` before any read, as the analyst dashboard does (07 D-16). The routes are `/app/review/requests/[documentId]`, `/app/review/questionnaires/[documentId]` and `/app/review/assessments/[documentId]`.
  - A Requestor gets the route's existing permission state under the route's heading and static title. Metadata does not read the record for them.
  - Strapi stays authoritative; the gate is presentation.
  - The existing permission headings stay, so the current denial proofs hold. The questionnaire journey step that expects a Requestor to see the analyst questionnaire page changes deliberately (`apps/web/e2e/questionnaire-workflow.spec.ts:181-190`).
- **D-24:** Permission descriptions drop internal language ("effective CSRM capabilities", "Navigation visibility is not an authorization control", "owner record scope") and say plainly what the person can do instead. The locked heading "You don't have access to {area}" and the route headings stay.

### Generation status (UAT-041; UX-06 criterion 2)

- **D-25:** One new read returns a request's current generation jobs: the questionnaire generation job (the active one, else the most recent retained) and the assessment draft job for its questionnaire.
  - **Who may read it:** any human Security Analyst who may review the request. The review queue's "Generation in progress" bucket already discloses that a job is running.
  - **Grant:** a new API-only Function granted to Security Analyst only, never the service agent or a Requestor (the 06.8-01 and 07 D-07 pattern).
  - **Shape:** the existing closed job shape plus whether this viewer may retry.

  **Reversibility:** costly - a new published operation and grant.
- **D-26:** The hub seeds both job panels from that read on load.
  - **Queued, running and failed jobs:** show in place of the Generate action, and the "Next action" line changes while a job runs.
  - **Completed jobs:** leave the normal next action (review, or replace).
  - **Retry:** stays initiator-only. Another analyst sees the failure and may start a new job.
  - **After a Strapi restart:** no job is shown, because jobs stay process-local (R-08-36).
- **D-27:** Phase 13 (REQ-08 criterion 3) widens job reads and retry by job id to any analyst on the request. Phase 10 does not change the by-id operations.

### Assessment editing (UAT-006, UAT-009, UAT-010, UAT-034; ASSESS-06)

- **D-28:** One shared single-record searchable picker serves the mitigation control, impacted system and impacted asset fields. It is server-backed, bounded and debounced, and generalises the established combobox pattern rather than adding a parallel one.
  - **Both editors:** the assessment editor and the Risk Register's Risk detail use it.
  - **Control owner:** uses the existing `OwnerCombobox` with the active-user search.
  - **What the page stops loading:** the whole control library (2,646 options today) and the first 25 systems and assets as options. `listInformationSystems` is one 25-row selector page, so records past it are unselectable today.
- **D-29:** Control search reuses the existing Administration control search: `GET /v1/controls` with a query matches number, name and framework, under the human analyst grant. Phase 22's Admin role must keep Security Analysts' read access to it (ADMIN-07 criterion 1 says it does).
- **D-30:** The request's selected systems and assets appear first in their pickers, from the originating request the analyst may already read, then search results. A selected value's label comes from the served relation or the selector's hydrate operation.
- **D-31:** The Risk Type's applicable controls appear first in the control picker, from a bounded applicable-control summary on the picker's Risk Type list (D-03 item 7). Typing searches the whole library.
- **D-32:** The exemption review date uses the same date input as every other date.
  - **Storage:** the calendar date at 00:00 UTC, because the frozen schema types it as a datetime (`exemptionReviewDate: datetime`).
  - **Display:** that date. An existing value with another time shows its UTC date and is rewritten only when the analyst changes it.
- **D-33:** Saving a risk, a mitigation control or the assessment details confirms inline beside its Save button, with the local time, in a polite live region cleared on the next change. The Risk Register's existing save messages stay.

### Released assessment (UAT-033; ASSESS-07)

- **D-34:** The released view shows each risk read-only for both actors:
  - statement, and the affected system and asset;
  - inherent and residual likelihood, consequence and rating;
  - treatment action, plan and status;
  - risk owner, treatment owner and target date (brief §8);
  - each control implementation's control number and name.

  It never shows an internal id. This needs an API change, so the UAT's "UI only" reading does not hold: the shared risk list returns five fields (`RiskSummary`, `projectRiskSummary` in `assessment-scope.ts:310-318`), and control implementations carry only the control's document id (`projectControlImplementationSummary`, lines 344-358). The Risk Register detail's `RiskDetailControl` is the precedent for the control summary.

### Release readiness (UAT-011; ASSESS-06 criterion 4)

- **D-35:** Release readiness shows a summary:
  - the outstanding assessment-level items;
  - then one row per risk with its outstanding count, linking to the risk;
  - met items only when the analyst chooses to show them.

  The "N of M release requirements met" line stays. Web only; the served requirements already carry scope, risk number, state and destination.

### Reference data (UAT-007, UAT-053; ADMIN-05)

- **D-36:** One control label rule applies everywhere a control is named: pickers, editors, the released view, and the Administration lists and forms.
  - **The number** appears once.
  - **The name** follows when it is not just the number. A stored name that begins with its own number, which the seed writes as `{id} — {label}`, is shown without repeating it.
  - **Controls with no title** show the framework instead, and the theme where the catalogue has one.

  Content:
  - **Licensed titles** for the 93 ISO/IEC 27001 Annex A controls wait for operator decision 15.
  - **Short descriptive titles** for the untitled CPS 230, CPS 234 and PSPF controls also wait for decision 15.
  - **The nine truncated Australian Privacy Principle titles** are corrected in the vendored catalogue (public legislation, no licence question).
  - **The three seeded Risk Types** get user-facing descriptions.

  Both data changes take effect through the existing seed reconciliation on the next Strapi start.
- **D-37:** The Information System form shows the owner's name, and the systems list gains Owner and Business criticality columns. This needs the owner's display name in the Administration record and list projections. Strapi already populates the owner and projects only its id (`administration-query.ts:251-257`).
  - The asset list already shows data classification.
  - An asset owner needs a content-type change and is deferred.
  - Column choice is not added.

### Copy (UAT-054; UX-06 criterion 4)

- **D-38:** Copy on Phase 10 surfaces follows the direction's voice: Australian English, sentence case, a spaced hyphen instead of an em dash, and verb-first calls to action. It drops back-end and internal terms such as "Strapi", "server-owned", "release fact", "mutation controls", "natural key", "Invalid Administration CSV", "reusable non-editable references" and "contextual Risks" (write "Risks").
  - **Surfaces:** the assessment editor, request hub, released view, permission states, and CSV import.
  - **Where the exact strings live:** `10-UI-SPEC.md`, which defers every visual value to `docs/design/csrm-design-direction.md` (the 08 D-34 precedent).
  - **Left for Phase 11:** "contextual Risks" on the analyst dashboard and reports, rewritten with DASH-03's exposure labels.

### Verification and plan shape

- **D-39:** How each finding is proved:
  - Each finding gets a failing test first where it is testable: a web unit, a Strapi integration or a Playwright journey.
  - E2E specs that assert changed copy or behaviour change deliberately in the same plan, and the plan names them.
  - New browser proofs get their own fixtures (the 06.9 lesson).
  - Plans that edit Strapi or run Playwright run with the dev servers stopped.
  - The phase gate is the full five-command gate on the production build, with a clean tree afterwards.
- **D-40:** Plans are serialised by shared files: the specification, the generated client, both catalogue copies, the served-operations inventory, the authorization matrix, the parity guard, and the hot feature files named in `10-RESEARCH.md`. One owner per file per wave.

### Planner's Discretion

- Component decomposition and file placement for the shared pickers, the time-zone helper, the navigation guard and the request context component.
- The debounce value, within about 1-2 seconds.
- Reason-code names within the families research proposes.
- The picker page size, within the existing selector bounds.
- The shape of the new generation read's response envelope, within the existing closed job schema.

### Deferred Ideas (OUT OF SCOPE)

- **Information Asset owner (UAT-053, asset half):** `CsrmInformationAsset` has no owner. This needs a content-type change: a `docs/contract-gaps/` record and operator approval in a later phase, a candidate for Phase 20 (oversight and owners) or Phase 22 (configurable reference data).
- **Licensed control titles, and short descriptive titles for untitled catalogues (UAT-007):** these wait for operator decision 15. They cover the ISO/IEC 27001 Annex A titles, and the CPS 230, CPS 234 and PSPF descriptive titles.
- **Column choice on reference and review lists (UAT-053 "let lists choose columns", UAT-035):** Phase 11 (UX-09), and Phase 18 for the risk table.
- **Analyst-authored question help text and its display (UAT-023 recommendation):** `CsrmQuestion.helpText` exists and the mutation accepts it, but the question read does not project it. This belongs to Phase 12 (QUES-10: generated help text), which needs the same projection and display.
- **Regulatory requirements, question text and selected systems in the AI context (UAT-015 recommendation):** Phase 12 (INT-05).
- **Job reads and retry by job id for any analyst on the request:** Phase 13 (REQ-08 criterion 3).
- **"Contextual Risks" wording on the analyst dashboard and reports, and other UTC-formatted instants on lists, dashboards, alerts and reports:** Phase 11, with DASH-03.
- **Keyboard jump to the risks, and grid navigation (UAT-063):** Phase 18. Phase 10's readiness summary removes most readiness tab stops.
- **Versioned question keys and soft-deleted replaced questions:** not needed once events carry text. Revisit with Phase 15's proposals if replacement keeps history.
- **Section rename, question reordering and conditional-logic editing in the governance editor:** new capabilities, not requested by any Phase 10 finding.
- **The analyst request hub's "The work is waiting with the other party." wording, and splitting the Requestor summary by who holds the work (UAT-003):** Phase 11.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Findings | Research support |
|----|-------------------------------|----------|------------------|
| REQ-07 | The analyst sees every field the Requestor submitted, and each actor's request actions refresh after every transition | UAT-015, UAT-037 | Group B: shared request context component (web only); stale `submitted` state in `RequestWorkflowActions` is the cause of UAT-037 |
| QUES-08 | The analyst governs any questionnaire, including generated ones, without errors or lost work | UAT-005, UAT-016, UAT-019, UAT-020 | Group C: placement from the complete question set; in-place forms with focus; the `regenerated` event, text snapshots and the discard count (contract); refusal while released; the released read-only view from existing `progress` |
| QUES-09 | The Requestor answers without losing work and with clear guidance | UAT-021, UAT-022, UAT-023, UAT-064 | Group D: autosave, the `onNavigate` guard and `beforeunload`; submit copy; introduction and form-order attention list; the Radix arrow-key race fixed in the shared wrapper |
| ASSESS-06 | Fitting pickers and clear feedback when editing risks and control implementations | UAT-006, UAT-009, UAT-010, UAT-011, UAT-034 | Group E: one shared server-backed picker for control, system and asset in both editors; Administration control search; request scope first (web) and applicable controls first (contract); date input at 00:00 UTC; visible save status; readiness summary (web) |
| ASSESS-07 | The released assessment shows each risk's full treatment for both actors | UAT-033 | Group F: a new list-item schema for the assessment's risks and a control summary on control implementations (contract), plus the control label rule |
| ADMIN-05 | Reference records read as real content | UAT-007, UAT-053 | Group G: the control label rule; APP title and Risk Type description corrections (seed data); the Information System owner name (contract); list columns |
| UX-06 | Actions, refusals, timestamps and copy tell each actor the truth in their own terms | UAT-024, UAT-036, UAT-041, UAT-054, UAT-062 | Group A (reason codes, local time, route gate, copy) and Group H (the generation-jobs read, contract plus new route) |
</phase_requirements>

## Summary

Every one of the 23 findings traces to a specific, local cause in today's code, and none needs a content-type schema change.
- **Web-only (14):** UAT-005, 009, 010, 011, 015, 016, 020, 021, 022, 023, 034, 037, 062 and 064.
- **API changes (7 findings):** UAT-006, 019, 024, 033, 036, 041 and 053 need one or more of seven bounded API changes. Each goes through the established contract chain: spec, regenerated client, closed Zod parser, parity guard, and a catalogue grant and authorization-matrix row where a route is new.
- **Strapi without a contract change (2):** UAT-007 (seeded catalogue and Risk Type text) and UAT-054 (one server error message).

The biggest correctness defects are simple. The question editor always sends section key `general` at order 0 (UAT-016). The Requestor's request actions prefer a stale in-page submit result over refreshed server state (UAT-037). Three analyst detail routes skip the capability gate the analyst dashboard already applies (UAT-062). The released view's risk read returns five fields and a bare control id (UAT-033).

Research corrected or extended the UAT's reading in eight places:
- **UAT-033** needs an API change.
- **UAT-020** needs none.
- **UAT-037** is stale local state, not a missing refresh.
- **UAT-064** is a Radix focus timing race, not a missing feature.
- **UAT-010** is worse than described: the pickers hold only the first 25 records.
- **UAT-016** has two further causes: removed questions still occupy orders, and the edit form's free-text section title breaks any multi-question section.
- **UAT-019:** regenerating a released, unanswered questionnaire publishes AI questions to the Requestor without review. This is a defect the UAT did not see.
- **UAT-053:** the system owner name needs a projection change.

The phase splits naturally into eight groups: cross-cutting truth (A), request pages (B), questionnaire governance (C), Requestor answering (D), assessment editing (E), the released view (F), reference data (G) and generation status (H). Contract changes are serialised because they share the specification, generated client, catalogue copies, served-operations inventory, authorization matrix and parity guard. Web-only groups come first, grouped into waves whose plans share no files.

The Next 16.3 bundled documentation settles the two framework questions:
- **Navigation blocking:** `<Link onNavigate>` with a React context guard (`link.md`, "Blocking navigation").
- **Local time:** Next's recommended inline-script approach is ruled out by the nonce CSP, which leaves server formatting from a cookie. That is the documented option for dates that depend on request data (`preventing-flash-before-hydration.md`).

**Primary recommendation:** fix each defect at its source with shared, reusable parts (one picker, one instant formatter, one control label rule, one set of zod-free action predicates). Keep the web presentation-only for authorization. Route each new fact through the contract chain in serialised plans, and prove every finding with a failing test first.

## Project Constraints (from AGENTS.md)

The binding project instructions are `AGENTS.md` and `apps/web/AGENTS.md`; the web app's other agent-instruction file only includes `apps/web/AGENTS.md`. Directives the planner must verify:

- Strapi is the production API boundary: no frontend API facade and no raw fetch in pages. The web uses the typed openapi-fetch layer only, and the chain guard (`contract-operation-chain.test.ts`) enforces this.
- Keycloak stays disabled. Strapi enforces IdamBox Role → Function → FunctionAPI grants and record-level authorization; navigation visibility is not security.
- The Requestor role is a birthright and Security Analyst is explicit. Requestors must not reach another Requestor's restricted records.
- AI output is advisory and never releases an assessment. Nothing in Phase 10 triggers generation against a live provider, and suites pin the deterministic provider.
- Preserve JDL terminology and document gaps instead of inventing entities. Content-type schemas are frozen.
- Semantic design tokens only. Do not hard-code BProton colours, and take every UI value from `docs/design/csrm-design-direction.md`.
- WCAG 2.2 AA, 375-1440px, strict TypeScript, and the five-state screen contract (loading, empty, populated, error, permission denied). Status and risk are never shown by colour alone.
- Server Components by default, Client Components only where needed. Business logic stays out of JSX (domain modules), and external input is validated with shared schemas.
- Use shadcn/ui before custom primitives, and add no dependency without a concrete reason. Phase 10 needs none.
- Every material workflow gets automated tests.
- Next.js 16.3.6 differs from training data, so read `apps/web/node_modules/next/dist/docs/` before framework code. This research did so for `onNavigate`, `cookies`, `revalidatePath` and hydration-safe dates.
- Project skills: `.agents/skills/tdd` (vertical slices, red before green, test at agreed seams); `code-review` and `diagnosing-bugs` for review and defects.

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|------------|-------------|----------------|-----------|
| Deciding whether a backward action is allowed | API (Strapi workflow services) | Browser (zod-free predicates that mirror it) | Strapi stays authoritative; the web only hides actions that would fail, using served facts (`relationships`, statuses) |
| Conflict reason codes | API (409 `error.details.reason`) | Frontend server (transport parses; Server Actions map to copy) | The reason is a server fact; the copy is presentation |
| Analyst route gating | Frontend server (page, before any read) | API (record and grant checks) | Presentation gate like 07 D-16; Strapi still refuses |
| Viewer time zone | Browser (detects the zone) | Frontend server (cookie, SSR formatting) | Only the browser knows the zone; the server must render the same string to avoid hydration mismatch |
| Question placement (section key and orders) | Browser (governance editor from the full question set) | API (definition parser validates, 409 on a clash) | The contract is unchanged; the server remains the validator |
| Regeneration safeguards and events | API (generation workflow, governance log) | Browser (Replace copy and count) | Audit facts are written in the same transaction as the replacement |
| Autosave and leave warning | Browser (debounce, guard, `beforeunload`) | Frontend server (Server Action) and API (serialised save) | Unsaved state exists only in the browser |
| Generation status by request | API (registries, new read) | Browser (seeds panels) | The registries are process-local server state |
| Searchable pickers | Browser (combobox) | API (bounded search operations) | Search must be server-side at inventory scale |
| Released risk facts and control labels | API (projection) | Browser (read-only view, label rule) | The Requestor cannot call analyst-only reads to enrich the view |
| Control label rule | Browser (zod-free domain function) | - | Display rule over served number, name and framework |
| Reference-data text (APP titles, Risk Type descriptions) | Database via seed reconciliation | - | Data content, applied on the next seeded Strapi start |

## Standard Stack

No new dependencies. Everything below is already installed; versions were read from `apps/web/package.json` and `apps/strapi/package.json` this session [VERIFIED: package.json files].

### Core
| Library | Version | Purpose | Why standard here |
|---------|---------|---------|-------------------|
| next | 16.3.6 | App Router, Server Actions, `Link onNavigate`, `cookies()` | Project framework; bundled docs consulted |
| react | 19.2.4 | UI, `useId`, context for the guard and time zone | Project framework |
| radix-ui (`@radix-ui/react-radio-group` 1.4.7, `react-roving-focus` 1.1.19) | ^1.6.7 | Radio groups (shadcn wrapper) | Existing primitive; the fix lives in the wrapper |
| react-hook-form | ^7.86.0 | Questionnaire and editor forms (dirty state feeds autosave) | Existing |
| zod | ^4.4.3 | Closed response parsers, input validation | Existing; stays out of new client modules (08-13) |
| openapi-fetch / openapi-typescript | 0.17.0 / 7.13.0 | Typed client generated from the spec | Existing contract chain |
| @strapi/strapi | 5.51.0 | Workflow services, policies, `ctx.conflict(message, details)` | Existing backend |
| sonner | ^2.0.8 | Toasts (existing request toasts) | Existing; inline status is preferred for saves (D-33) |

### Supporting (tests)
| Library | Version | Purpose |
|---------|---------|---------|
| vitest | 4.1.11 | Web unit tests (jsdom) |
| @testing-library/react / user-event | 16.3.0 / 14.6.1 | Component tests, keyboard simulation (`{ArrowDown}` without hold reproduces UAT-064) |
| @playwright/test | 1.58.2 | Journeys on the production build (`desktop` and `mobile` projects) |
| @axe-core/playwright | 4.11.0 | Accessibility scans |
| node:test (Node 24.19.0) | - | Strapi unit and integration suites compiled to `.tmp/tests-dist` |

### Alternatives Considered
| Instead of | Could use | Why not |
|------------|-----------|---------|
| Wrapper fix for the radio race | Native `<input type="radio">` | A new primitive against the shadcn-first rule; the wrapper fix covers every consumer |
| Cookie time zone and server formatting | The Next inline-script `LocalDate` pattern | Blocked by the nonce CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'`, `src/lib/security/content-security-policy.ts:42`) and the output-safety guard that bans `dangerouslySetInnerHTML` (`src/lib/security/output-safety.test.ts:36`) |
| Cookie time zone | Client-only formatting after mount (`useEffect`) | Flash and hydration-mismatch risk (`preventing-flash-before-hydration.md`) |
| Web-computed question placement | Server-assigned placement | Changes published add semantics; the web can compute placement from the full question set it already receives |
| New list-item schema for the assessment's risks | Extending `RiskSummary` | `RiskSummary` is also the create and update response; widening it forces relation population on every mutation path (Pitfall 9) |

**Installation:** none.

## Package Legitimacy Audit

Phase 10 installs no external packages. **Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** none.

## Findings: root cause, fix, layer, reuse, tests, E2E risk

Every root cause below was read in this session. A quote beside a `[VERIFIED]` tag is verbatim from the file and lines named.

### Group A - Cross-cutting truth (UX-06)

#### UAT-062 - Analyst pages opened by a Requestor show analyst actions or an error
- **Root cause** [VERIFIED: `apps/web/app/(app)/app/review/questionnaires/[documentId]/page.tsx:37-55`, `.../review/requests/[documentId]/page.tsx:21-43`, `.../review/assessments/[documentId]/page.tsx:29-43`]. The three routes read the record first and never check `assessment:review`.
  - The questionnaire route renders `QuestionnaireReview` (with governance controls) for any questionnaire Strapi lets the caller read, and the owning Requestor may read their own.
  - The analyst dashboard is the correct pattern [VERIFIED: `app/(app)/app/review/(analyst-dashboard)/page.tsx:26-30`]: `if (!can('assessment:review', granted)) return <PermissionDeniedState area={analystDashboardCopy.area} />;`
  - The request route already resolves capabilities, but only after the read and only to build links (`review/requests/[documentId]/page.tsx:28-35`).
  - The assessment route's "We couldn't load this assessment" is a parse failure. The analyst and released reads call the same operation, `GET /v1/risk_assessments/{assessmentId}` [VERIFIED: `assessment-service.ts:389-393` and `:395-399`]. For a Requestor, Strapi returns her released projection, the analyst parser rejects it, and the `request` helper turns the throw into a non-403 error (`:217-229`), so the page shows the error state instead of the permission state.
- **UAT reading:** confirmed.
- **Fix:** gate each route before any read and render its existing permission state: `AssessmentDetail state="permission"`, `QuestionnaireReview state="permission"`, `AssessmentEditor state="permission"`. In `generateMetadata`, skip the record read for non-analysts and return the static title.
- **Layer:** web only.
- **Reuse:** the dashboard gate; `can`, `getSessionAdapter`.
- **Tests:**
  - **Unit:** page tests that a Requestor gets the permission state and no service call.
  - **Playwright:** a Requestor on the analyst URLs of her own request, questionnaire and released assessment sees the permission state, no analyst action, and no record data, at both widths.
- **E2E risk:**
  - `questionnaire-workflow.spec.ts:181-190` expects `Awaiting questionnaire submission` for the Requestor on the analyst route. It must change.
  - `assessment-release-workflow.spec.ts:245` (`You don’t have permission to review this request`) keeps passing because the gate reuses that component.

#### UAT-054 and D-24 - Interface copy names the back end and internal concepts
- **Sources.** Every site below was grep-located and read this session [VERIFIED]:

  | Site | String today |
  |------|--------------|
  | `assessment-editor.tsx:99` | "Assessment access is enforced by your effective CSRM capabilities." |
  | `assessment-editor.tsx:175` | "Release is complete. Analyst mutation controls have been removed." and "A release fact exists or this workflow state cannot be changed." |
  | `assessment-editor.tsx:187` | "Strapi rechecks every item when release is requested." |
  | `assessment-editor.tsx:216` | "Release is irreversible. Requestors will receive the assessment as read-only, and all analyst mutation controls will be removed." ("irreversible" is true here; only "mutation controls" is internal) |
  | `assessment-editor.tsx:228` | "Contextual Risks identified for this assessment. Risk Types remain reusable non-editable references." |
  | `assessment-editor.tsx:302` | "Edit the analyst-owned assessment conclusion. Workflow and release facts are server-owned." |
  | `states.tsx:129` | "Access is determined by your effective CSRM capabilities. Navigation visibility is not an authorization control." |
  | `assessment-detail.tsx:47`, `questionnaire-review.tsx:35` | "Access is enforced by your effective CSRM capabilities." |
  | `questionnaire-detail.tsx:33`, `risk-details.tsx:157` | "Access is enforced by your effective CSRM capabilities and record scope." |
  | `released-assessment.tsx:109` | "Access is enforced by your effective CSRM capabilities and owner record scope." |
  | `released-assessment.tsx:214` | "Authoritative risks and mitigation controls included in this released assessment." |
  | `request-hub.tsx:91`; `request-form.tsx:270` (the request page's assessment tile) | "Contextual Risks by residual rating" |
  | `questionnaire-generation-job.tsx:179, 192`; `assessment-draft-job.tsx:239` | "This page remains available while the server-owned job is checked." and "The server-owned job remains authoritative." |
  | `csv-import-flow.tsx:162` | "Natural-key matches update existing {plural label}. …" |
  | `csv-import-flow.tsx:186` | "Imports never delete records. Strapi will validate and classify the same file again before writing." |
  | `csv-client-parser.ts:27`; Strapi `csv-import.ts:95` | `Invalid Administration CSV: ${message}` |

  Unit tests that assert these strings: `states.test.tsx:36` (the navigation sentence) and `request-hub.test.tsx:47` (the tile sentence). No E2E asserts the CSV messages.
- **Fix:** rewrite on Phase 10 surfaces per D-38, with exact strings in the UI-SPEC. The permission heading ("You don’t have access to {area}") is locked; the description is free.
- **Layer:**
  - **Web:** most strings.
  - **Strapi:** only the `Invalid Administration CSV:` prefix in `csv-import.ts`, which the server returns in its error message.
- **Tests:** unit copy assertions where the component is under test; a web source guard that the listed internal terms no longer occur in `src/features/**` user copy (a scan like `zod-client-boundary.test.ts`); Strapi CSV tests if the server message changes.
- **E2E risk:** `request-relationship-states.spec.ts:24` (`tileLabel = 'Contextual Risks by residual rating'`) changes. No E2E asserts the permission description.

#### UAT-024 (time half) and D-19 - UTC clock times shown as local
- **Root cause** [VERIFIED: `questionnaire-revision-timeline.tsx:18-22`]: `day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC',`.
  - Same pattern in `revert-audit-summary.tsx:14-21`, which also shows a document id as a name at line 32: `const by = facts.revertedBy?.displayName?.trim() || facts.revertedBy?.documentId || 'Not recorded';`.
  - `formatRequestDate` formats every value, instants included (`submittedDate`, `updatedAt`), as a UTC date [VERIFIED: `request-domain.ts:144-155`].
  - The released view uses a `timeZone: 'UTC'` formatter for datetimes too [VERIFIED: `released-assessment.tsx:35`].
- **Which fields are instants** (read from the content-type schemas this session):
  - `submittedDate`, `revertedAt` (request);
  - `generatedDate`, `assessmentDate`, `approvalDate` (assessment);
  - `generatedDate`, `revertedAt`, `releasedAt` (questionnaire);
  - `exemptionReviewDate` (risk).

  Every other date is a calendar `date` and keeps UTC-date formatting.
- **Fix:** D-19's cookie plus shared formatter. Show the "UTC" label only when a time of day is shown without a known zone, so date-only renders keep their current text (Pitfall 13).
- **Layer:** web only (Server Action, cookie, provider, helper).
- **Tests:**
  - **Unit:** the formatter with explicit zones (`Australia/Brisbane`, which has no DST, and `UTC`); zone validation; the timeline renders the local hour; the revert summary never shows an id.
  - **Playwright:** a context with `timezoneId: 'Australia/Brisbane'` asserts a timeline entry's local hour after the sync settles.
- **E2E risk:** `requestor-request-workflow.spec.ts:225` asserts `/^Submitted \d{1,2} \w{3,4} \d{4}$/`, so the date-only format must not gain a suffix. `risk-register-workflow.spec.ts:594` formats a calendar target date with `timeZone: 'UTC'`, which is unchanged.

#### UAT-036 and D-22 - Actions that can no longer succeed, refused with "changed, reload"
- **Root cause.** Three parts:
  - **Analyst hub:** it offers "Return to draft" whenever the request is submitted and no assessment exists [VERIFIED: `assessment-detail.tsx:78`: `request.requestStatus === 'submitted' && request.relationships?.assessment.availability !== 'available'`].
  - **Strapi rule:** it also refuses when a questionnaire exists [VERIFIED: `request-workflow.ts:104-105`: `if (request.requestStatus !== "submitted" || request.questionnaire || request.assessment) { throw new AssessmentRequestWorkflowError("CSRM assessment request cannot be reverted to draft.", 409);`].
  - **Requestor's questionnaire page:** it offers "Return to draft" whenever the questionnaire is submitted [VERIFIED: `questionnaire-detail.tsx:46`]. Strapi refuses once the request has left `questionnaire-in-progress` (the draft moves it to `risk-assessment-drafted` [VERIFIED: `assessment-workflow.ts:795-798`]) or an assessment exists [VERIFIED: `questionnaire-workflow.ts:278-279`].

  The web discards the 409 body and maps every 409 to one sentence [VERIFIED: `server-client.ts:94-95` keeps only `status`; `request-actions.ts:33-34`: `'This request changed while you were editing it. Reload and try again.'`; `questionnaire-actions.ts:92-93`: `'This questionnaire changed or is no longer answerable. Reload and try again.'`; `questionnaire-actions.ts:119` for governance]. The body is still in hand where it is dropped: each service's `request` helper passes the openapi-fetch `error` body to `normalizeTransportError(error, response.status)` [VERIFIED: `assessment-service.ts:217-229`], so parsing the reason there covers every service at once.
- **Also:** the Requestor's revert condition reads the legacy nullable fields (`request-workflow-actions.tsx:37`: `!request.questionnaire && !request.assessment`), while the analyst hub reads `relationships`. The shared predicates read `relationships` for both.
- **Fix:** zod-free predicates (`canRevertRequestToDraft`, `canRevertQuestionnaireToDraft`, `canReturnToAnalystReview`) from served facts, used by both actors. Add closed reason codes (see "Conflict reason vocabulary").
- **Layer:** web (predicates, copy) plus Strapi and contract (reason codes).
- **Tests:**
  - **Unit:** predicate tables over every state.
  - **Strapi integration:** each refusal returns its code and leaves persistence deep-equal.
  - **Web unit:** transport parsing and the action copy per code.
  - **Playwright:** the analyst hub hides Return to draft once a questionnaire exists; the Requestor questionnaire hides it after the draft.
- **E2E risk:** `requestor-request-workflow.spec.ts:244-249` opens the analyst route before a questionnaire exists, so the action stays offered and the check holds.

### Group B - Request pages (REQ-07)

#### UAT-015 - The analyst's request page hides third-party and regulatory fields
- **Root cause** [VERIFIED: `assessment-detail.tsx:81`]. The analyst "Request context" lists `Description`, `Business purpose`, `Division`, `Business unit`, `Business criticality` and `Submitted date` only.
  - The fields are in the request read both actors receive: `getRequest` calls `GET /csrm-assessment-requests/{id}` for both, and `request-schema.ts` maps `thirdPartyInvolvement`, `thirdPartyDetails` and `regulatoryRequirements`.
  - The Requestor's page shows them [VERIFIED: `app/(app)/app/requests/[documentId]/page.tsx`, "Request context" definition list].
- **UAT reading:** confirmed (web only).
- **Fix:** one shared read-only `RequestContextDetails`, grouped like the form: "Request overview", "Business context", "Scope and timing" (`request-form.tsx:203-233`). Use it on both pages, with the D-19 formatter for the submitted and updated instants.
- **Tests:** a unit test that the analyst hub renders the three fields and groups. The Playwright journey that creates UAT-A-like input asserts them on the analyst page.
- **E2E risk:** keep the heading `Request context`, which `request-relationship-states.spec.ts:160` and `accessibility.spec.ts:336` assert.

#### UAT-037 - After returning to draft, the page keeps the old actions until reload
- **Root cause** [VERIFIED: `request-workflow-actions.tsx:24-26`: `const [submitted, setSubmitted] = useState<RequestMutationResult | null>(null);` … `const status = submitted?.requestStatus ?? request.requestStatus;`].
  - An in-page submit stores its result (`setSubmitted(result.data)`, line 49).
  - The later revert calls `router.refresh()` (line 33), so the prop becomes `draft`, but the stale local `submitted` still wins.
  - The E2E never caught it because it reverts after a fresh sign-in and page load (`requestor-request-workflow.spec.ts:253-266`).
- **UAT reading:** differs. The revert already refreshes; the stale local override is the defect.
- **Fix:** derive status from props only. The submit Server Action already revalidates the detail path [VERIFIED: `request-actions.ts:117` calls `revalidateRequestPages`, which revalidates `/app/requests/${id}` at `:40-42`], and that re-renders the page (`revalidatePath.md`: "Updates the UI immediately (if viewing the affected path)"). Alternatively, clear the local state on revert. Keep the live announcement (`StatusBadge live`).
- **Tests:**
  - **Unit:** submit then revert in one render, then expect Edit request and Submit request.
  - **Playwright:** submit, then return to draft without reloading, then expect `Edit request` and `Submit request`.
- **E2E risk:** none beyond adding the step.

#### UAT-022 (request half) - "Submission is irreversible", then Return to draft
- **Root cause** [VERIFIED]:
  - `request-workflow-actions.tsx:58`: `description="Submission is irreversible. This request cannot be edited after submission."`.
  - The edit form's own submitted notice says the same: `request-form.tsx:200`, "Submitted {date}. This request can no longer be edited."
- **Fix:** copy that says what happens next and how to change it (D-15, UI-SPEC), in both places.
- **E2E risk:** `requestor-request-workflow.spec.ts:219` asserts `/cannot be undone|irreversible/i` and must change.

### Group C - Questionnaire governance (QUES-08)

#### UAT-016 - Adding a question to an AI-generated questionnaire always fails
- **Root cause** [VERIFIED: `questionnaire-governance.tsx:36`]:
  `const blankQuestion: DraftQuestion = { questionText: '', answerType: 'Text', required: false, sectionKey: 'general', sectionTitle: 'General', sectionOrder: 0, order: 0, choices: '' };`
  - Add seeds it with `order: definition.length` (line 83), and the section title input changes only `sectionTitle` (line 104).
  - Strapi rejects the definition [VERIFIED: `questionnaire-definition.ts:189-194`]: `if (sectionAtOrder && sectionAtOrder !== question.section.key) throw new QuestionnaireDefinitionError();` and `const orderKey = \`${question.section.key}:${question.order}\`;`
  - The rejection surfaces as `governanceConflict` → 409 "CSRM questionnaire definition cannot be changed." (`questionnaire-governance-workflow.ts:394-399`), which the web maps to "This questionnaire changed or cannot be governed in its current state. Reload and try again." (`questionnaire-actions.ts:119`).
- **Why generated questionnaires always fail:**
  - Hosted-provider sections are `key: \`section-${sections.size + 1}\`, title, order: sections.size` [VERIFIED: `openai-compatible-questionnaire-generation-provider.ts:78`].
  - Deterministic-provider sections are `section: { key: "context", title: "Request context", order: 0 }` [VERIFIED: `deterministic-questionnaire-generation-provider.ts:9`].

  So `general` at 0 always collides. Seeded sections start at `order: 1` [VERIFIED: `seed-questionnaire-workflow.ts:41`], which is why 06.8's journey passed.
- **Further causes found:**
  1. **Removed questions drop out of the web's view but still count on the server.** The web drops removed questions [VERIFIED: `questionnaire-service.ts:97-101` filters `options.deleted`], while the server's definition check includes them, so "next order" computed from the web's list can collide.
  2. **The edit form breaks multi-question sections.** It lets the analyst retype one question's section title while keeping the key, and every question in a section must carry identical section metadata (`questionnaire-definition.ts:184-187`).
- **UAT reading:** confirmed and extended.
- **Fix (D-05):**
  - Keep a placement set from the raw `/questions` response. `projectQuestions` returns every question with a `deleted` marker [VERIFIED: `questionnaire-scope.ts:408-429`].
  - Offer a section chooser: existing, or new with a title.
  - For an existing section, send its stored `{ key, title, description?, order }`. For a new one, send `{ key: unique, title, order: max(all section orders) + 1 }`. Set `order` to `max(orders in that section, removed included) + 1`.
  - Edit sends `section` and `order` only when the section changes.
- **Layer:** web only; the contract is unchanged. A 409 on a race returns a reason (Group A).
- **Reuse:** `orderQuestionnaire`, `questionOptionsSchema` (parses `deleted`).
- **Tests:**
  - **Unit:** a placement function over the three real shapes (hosted `section-N` from 0, deterministic `context` at 0, seeded from 1), with a removed question at the next order.
  - **Strapi integration:** add to an existing section and to a new section of a generated questionnaire succeeds, and a clash returns the reason (extend `questionnaire-governance.integration.test.ts`).
  - **Playwright:** generate with the deterministic provider, then add to "Request context" and to a new "Offshore support" section.
- **E2E risk:** `questionnaire-governance-workflow.spec.ts:117-121` adds with the defaults, so the top-level Add should default to the last section.

#### UAT-005 - Add and Edit open off-screen and leave focus on the button
- **Root cause** [VERIFIED: `questionnaire-governance.tsx:93`]: `{draft ? <QuestionForm … /> : null}` renders after every section. There is no focus management, and the only error line is at the top of the panel (line 79).
- **Fix:**
  - **Placement:** render the form in the question's `li` (Edit), after the section's list (section Add), or at the top (editor Add).
  - **Focus:** focus `Question text` on mount (ref plus effect); store the invoking control and return focus on Save and Cancel.
  - **Errors:** show them in the form (`role="alert"`).
  - **Visibility:** moving focus scrolls the field into view. The shell has no sticky or fixed header (`components/shell/app-shell.tsx` has no `sticky` or `fixed` element), so nothing obscures the focused field (WCAG 2.4.11). The Playwright check asserts `toBeInViewport`.
- **Layer:** web only.
- **Tests:**
  - **Unit:** after clicking Edit, focus is in the text field and the form sits inside the question's list item; the error appears inside the form.
  - **Playwright:** at 1440 and 375 the form is in the viewport after the click (`toBeInViewport`).
- **E2E risk:** `questionnaire-governance-workflow.spec.ts:123-127, 174-177` locate Edit by the question text's grandparent (`xpath=../..`). They still find it; afterwards the form sits in that item.

#### UAT-019 - Regeneration discards edits silently; timeline entries point at the wrong questions
- **Root cause** [VERIFIED: `questionnaire-generation-workflow.ts:34-36`].
  - **Replacement:** replacing deletes every question row (`await questions.delete(…)`) and updates the questionnaire with `title, … generatedDate, generatedBy, providerName, providerVersion`. It then creates new questions under the provider's keys: `q-1` to `q-N` from the hosted provider (`openai-compatible-…:86`), and fixed keys such as `security-objectives` from the deterministic one. Those keys repeat the replaced questions' keys.
  - **No record:** `governanceLog` is not appended. Older `question-edited` events keep their keys, which now resolve to different, new questions.
  - **Released questionnaires (research finding):** there is no release check. A released, unanswered questionnaire (the request stays `submitted` until the first save [VERIFIED: `questionnaire-workflow.ts:99-103`]) is replaced with `releasedAt` intact, so the Requestor sees AI questions no analyst reviewed.
  - **Hub label:** the hub offers the same "Generate questionnaire" label for a replacement (`questionnaire-generation-job.tsx:176`, `acknowledgedReplacementTrigger`; the dialog at `:190` and `:199`).
- **UAT reading:** confirmed and extended (the released case).
- **Fix:**
  - **Server (D-09, D-10, D-16, D-18):**
    - Refuse while released: synchronously in `generateQuestionnaire`, and in the job transaction with a new failure code for the race.
    - Append `regenerated` in the same transaction.
    - Snapshot question text on new question events.
    - Project `analystChangesSinceGeneration` from events at or after `generatedDate`.
  - **Web:** "Replace questionnaire" with the count, offered only while `relationships.questionnaire.state === 'analyst-review'`, with a hint to return it to review otherwise. The relation derives `analyst-review`, `released` or `submitted` from the release fact [VERIFIED: `relationship-scope.ts:110-113`]. The analyst request page reads only the request today (`review/requests/[documentId]/page.tsx:21-43`), so it adds the analyst questionnaire summary read when the relationship is `available`, to get the count.
- **Layer:** Strapi and contract (`QuestionnaireGovernanceEvent`, `QuestionnaireRevisionTimelineEvent`, `QuestionnaireRevision`), plus web.
- **Tests:**
  - **Strapi integration:** replacing a released questionnaire is refused with its code and changes nothing; replacement appends exactly one `regenerated` event.
  - **Strapi unit:** the change count ignores events before `generatedDate`.
  - **Web:** the Replace copy shows the count; Replace is offered only in `analyst-review`.
  - **Playwright:** `questionnaire-generation-workflow.spec.ts` replacement step with the new names.
- **E2E risk:** `questionnaire-generation-workflow.spec.ts:133-138` (`'Generate questionnaire'`, `'Replace the unanswered questionnaire?'`, `'Replace unanswered questionnaire'`) must change.

#### UAT-020 - After release the analyst sees neither the questions nor progress
- **Root cause** [VERIFIED: `questionnaire-review.tsx:40-42`]. The `awaiting-submission` state renders an alert ("Draft answers remain private until the Requestor submits one complete answer batch.") and the governance return control, but no question list. The page already loads the definition (`page.tsx:45-55`), and the summary already carries `progress` [VERIFIED: `questionnaire-scope.ts:397`: `progress: { answered, total: questions.length, percent: … }`], served to analysts by `findWorkflowOne`.
- **UAT reading:** the UI part is confirmed; the API part ("if not already exposed") is unnecessary.
- **Fix:** a read-only question list (the governance rows without their actions, each question once) and "N of M answered" from `questionnaire.progress`. The awaiting-submission state is already governable (`questionnaire-review.tsx:58`), so the list sits beside the existing Return to analyst review control.
- **Layer:** web only.
- **Tests:** a unit test that the awaiting-submission view lists questions with no answer text and shows the count. In Playwright, after release the analyst sees the questions and "0 of N answered", and no answer content appears after the Requestor saves a draft.
- **E2E risk:** the `Awaiting questionnaire submission` heading stays (`accessibility.spec.ts:270`, `questionnaire-workflow.spec.ts:305`).

#### UAT-024 (text half) - Timelines name questions by key; counts are wrong
- **Root cause** [VERIFIED: `questionnaire-revision-timeline.tsx:35`]: `{event.questionKey ? <p …><span className="font-medium">Question: </span>{event.questionKey}</p> : null}`. The summary counts every change event across all rounds (`:54`) and takes the latest change's icon, which is a bin after a deletion (`:56`, `:62-66`, icon from `eventPresentation` at `:14`).
- **What each actor receives today** [VERIFIED: `questionnaire-scope.ts:319-345`, `projectGovernanceEvents`]: analyst events carry `kind`, `at`, `by`, `reason`, `questionKey` and `explanation`; Requestor events carry only `kind`, `at` and `explanation`. The Requestor never receives a key, so the Requestor summary cannot count distinct questions. Governance mutation results return the raw stored log (`resultForGovernance`, `questionnaire-governance-workflow.ts:417-423`), which only analysts call.
- **Fix:**
  - **Analyst:** snapshot or resolved question text (D-17, D-18), projected on the analyst branch only, as `questionKey` is today.
  - **Requestor:** one entry per release round counting the change events in that round, with a neutral icon.
  - **Cleared-answers notice:** name questions by text; today it renders `<strong>{answer.questionKey}</strong>` (`questionnaire-governance.tsx:80`). The governance result's `clearedAnswers` would need the text too, or the web resolves the key against the question set it already holds (web only).
- **Layer:** Strapi and contract (text), web (counts and icon).
- **E2E risk:** `questionnaire-governance-workflow.spec.ts:179-180` (`/hosting-model/` key visible) must change to the question text.

### Group D - Requestor answering (QUES-09)

#### UAT-021 - Unsaved answers are lost without warning
- **Root cause** [VERIFIED: `questionnaire-renderer.tsx:288-306, 343`]. Answers save only when the form is submitted (`onSubmit={… void saveCurrentDraft(); }`) or before submission. There is no autosave, no `beforeunload`, and no navigation guard.
- **Fix:** D-11 and D-12. The autosave action variant omits the current-page `revalidatePath`, the explicit save flushes and cancels the pending autosave, and the guard is armed only while a save is pending, in flight or failed.
- **Layer:** web only.
- **Reuse:** react-hook-form watch values; `saveQuestionnaireDraft` service; the Next `onNavigate` pattern.
- **Tests:**
  - **Unit (fake timers):** debounce, blur flush, one in flight, a queued follow-up, a failure then Retry, the guard's armed state, and `beforeunload` registration.
  - **Playwright:** type, click a sidebar link, and the dialog appears; stay, and the text remains. Type, wait for "Saved", navigate and return, and the answer is present.
- **E2E risk:** `questionnaire-workflow.spec.ts:227-231` saves, then reloads. The guard must be disarmed by then (Pitfall 6).
- **Performance:** the questionnaire detail route has a 500,000-byte delivered-JavaScript budget (`performance.spec.ts:76`, from 08-13). Keep zod out of the new client modules.

#### UAT-022 (questionnaire half) - "Irreversible" dialogs next to Return to draft
- **Root cause** [VERIFIED: `questionnaire-renderer.tsx:387`]: `description="Submission is irreversible. This questionnaire cannot be edited after submission."`. And line 336: `Questionnaire submitted. This questionnaire is read-only and can no longer be edited.`
- **Fix:** copy per D-15. The read-only notice varies with `canRevertQuestionnaireToDraft`, passed from the page.
- **E2E risk:** `questionnaire-workflow.spec.ts:254` (`/cannot be undone|irreversible/i`) and `performance.spec.ts:117` (the read-only sentence as the populated guard) must change.

#### UAT-023 - The first screen is history and an amber list, not guidance
- **Root cause** [VERIFIED: `questionnaire-detail.tsx:45-50`]. The order is header, request link, revert control, description, revert audit, timeline, then the renderer.
  - The attention list renders whenever required answers are missing [VERIFIED: `questionnaire-renderer.tsx:366-374`].
  - Its order comes from `definition.filter(…)` [VERIFIED: `questionnaire-domain.ts:127`] over the server order, which is `options.order` only [VERIFIED: `questionnaire-scope.ts:416-420`]. Generated questions number their `order` per section from 0 (`openai-compatible-…:88`: `order: section.next++`), so sections interleave.
- **UAT reading:** confirmed; the ordering cause is identified.
- **Fix:** introduction panel, the renderer, then history. Show the attention list only after `prepareSubmission` fails. Iterate in `orderQuestionnaire` order.
- **Layer:** web only.
- **Tests:**
  - **Unit:** no attention list before a submit attempt; after one, the list follows form order for a two-section, interleaved-order definition.
  - **Playwright:** the existing questionnaire journey (`questionnaire-workflow.spec.ts:244-248` already clicks Submit before expecting the guidance) plus a first-screen assertion.

#### UAT-064 - Arrow keys move focus without selecting
- **Root cause** [VERIFIED].
  - The radio item selects on focus only while a document-level flag is set: `@radix-ui/react-radio-group/dist/index.mjs:338-352, 369-373` (`isArrowKeyPressedRef.current = true` on arrow keydown, `handleKeyUp = () => isArrowKeyPressedRef.current = false`, `onFocus: … if (isArrowKeyPressedRef.current) { ref.current?.click(); }`).
  - Roving focus moves in a deferred timeout: `@radix-ui/react-roving-focus/dist/index.mjs:194`, `setTimeout(() => focusFirst(candidateNodes));`.
  - A keyup that lands before the timeout, as with Playwright's `press` or a quick release, clears the flag, so focus moves without checking. The project's own segmented-control test holds the key to avoid this [VERIFIED: `segmented-control.test.tsx:64-66`: "A physical key press is released after roving focus has moved, and the move is what checks the radio. Hold the key until focus lands, as a person does, then release it."].
- **Requirement:** the ARIA pattern requires that arrow keys "move focus to the next radio button in the group, uncheck the previously focused button, and check the newly focused button" [CITED: w3.org/WAI/ARIA/apg/patterns/radio/].
- **UAT reading:** differs in cause. Radix intends to select but loses a timing race.
- **Fix (D-14):** in the shared wrapper, handle Arrow keys on the item.
  - **Skip the roving handler:** call `preventDefault()`. The item's key handlers run in a fixed order [VERIFIED]:
    - the Slot that joins the roving item to the radio button runs the child's handler (the wrapper's) before its own (`@radix-ui/react-slot@1.3.3/dist/index.mjs:88-93`);
    - the roving item composes its handler with the default check (`@radix-ui/react-roving-focus@1.1.19/dist/index.mjs:176`);
    - `composeEventHandlers` runs it only `if (checkForDefaultPrevented === false || !event || !event.defaultPrevented)` (`@radix-ui/primitive@1.1.7/dist/index.mjs:6-13`).
  - **Move and check:** find the next enabled radio in the same `radiogroup` in DOM order, with wrap. Call `focus()` and then `click()` on it. That is the same check path Radix's own `onFocus` uses (`ref.current?.click()`), so the wrapper needs no access to the group's `onValueChange`.
  - **Leave alone:** arrows with modifier keys (roving ignores them too), Home and End (focus only, unchanged), and Tab (one tab stop on the checked item).
  - **Segmented control:** apply the same handler in `segmented-control.tsx`, which uses `RadioGroupPrimitive` directly.
- **Layer:** web only.
- **Tests:**
  - **Unit:** `user.keyboard('{ArrowDown}')` without holding checks the next radio, which fails today. ArrowUp wraps; Tab still enters on the checked item; the segmented-control tests pass unchanged.
  - **Playwright:** on a Yes/No question, `press('ArrowDown')`, then `aria-checked="true"` on "No".

### Group E - Assessment editing (ASSESS-06)

#### UAT-006 - The mitigation control picker is a 2,646-option native select
- **Root cause.**
  - The page loads the whole library through the assessment picker path [VERIFIED: `review/assessments/[documentId]/page.tsx:36-41` calls `listControls()`; `csrm-risk.ts:198-203`: with no query, `listControlDocuments(workflowStrapi)).map(projectControlSummary)`].
  - The editor renders a native select [VERIFIED: `control-implementation-editor.tsx:121`: `<select … {...form.register('control')}><option value="">Select a control</option>{options.controls.map(…)}`].
  - The Risk Register form filters the same full list client-side [VERIFIED: `mitigation-control-list.tsx:158-159, 191-192`].
  - The Risk Type form's search action also loads the whole library per search [VERIFIED: `administration-actions.ts:96-105`: `const result = await listControls();` … `.slice(0, 20)`, with `listControls` imported from the assessment service at line 24].
  - The full-library read has five callers in all [VERIFIED by grep]:
    - the assessment review page (`review/assessments/[documentId]/page.tsx:38`);
    - the Risk Register detail page (`app/(app)/app/risks/[documentId]/page.tsx:32`);
    - the Risk Type Administration pages (`admin/[collection]/new/page.tsx:40`, `admin/[collection]/[documentId]/page.tsx:57`), which seed their selected-control labels from it;
    - `searchApplicableControlsAction` (`administration-actions.ts:99`).

    D-28 removes it from the two editors. The Administration pages can keep it until a label source exists for them (Planner's Discretion).
  - The unfiltered picker projection has no `framework` [VERIFIED: `assessment-scope.ts:328-338`, `projectControlSummary` returns `documentId`, `controlNumber`, `name`, `description`]. The Administration list does (`administration-config.ts:38` `projectedFields`), which the control label rule needs for untitled controls.
- **Server search already exists.** A query switches the same path to the Administration list [VERIFIED: `csrm-risk.ts:200`: `if (!isEmptyQuery(ctx.query)) return await listAdministrationCollection(strapi, "controls", ctx);`], which searches `["control_number", "name", "framework"]` with filters `framework` and `controlType` [VERIFIED: `administration-config.ts:36-37`].
- **UAT reading:** confirmed. The operation exists; the owner lookup is fixed with UAT-034.
- **Fix (D-28, D-29, D-31):** a shared single-record picker calling a new `searchReusableControlsAction({ search })` over the Administration list (small page), showing the Risk Type's applicable controls first when the query is empty. Retire the full-library read once control implementations carry their own labels (Group F). Move `searchApplicableControlsAction` to the server search too.
- **Layer:** web, plus the D-31 contract change (`RiskTypeSummary.applicableControls`).
- **Tests:**
  - **Unit:** the picker debounces, calls the search once per settled query, keeps the selected label when off-page, and supports keyboard selection.
  - **Strapi integration:** the Risk Type picker list carries bounded applicable-control summaries.
  - **Playwright:** type a control number or name, choose, and save.
- **E2E risk:**
  - `assessment-release-workflow.spec.ts:205-212, 224-225` drives `combobox 'Reusable control'` with `locator('option').nth(1)`, `selectOption` and `toHaveValue(reusableControlValue)`.
  - `risk-register-workflow.spec.ts:599-603` focuses `textbox 'Search reusable Controls'`.

  Both must change.

#### UAT-010 - System and asset pickers list the inventory in plain selects
- **Root cause** [VERIFIED: `risk-editor.tsx:192-193` (`SelectField … options={options.systems…}`); `request-service.ts:121` `export const selectorPageSize = 25 as const;` and `:177-178` `export const listInformationSystems = searchInformationSystems;`]. The options are the first 25 selector results, not the inventory, so any record past 25 is unselectable. The Risk Register editor has the same selects [VERIFIED: `risk-detail-editor.tsx:186-187`].
- **UAT reading:** differs in degree (a 25-row cap, not "every").
- **Fix (D-30):**
  - **Picker:** the shared picker over `searchInformationSystemsAction` and `searchInformationAssetsAction`.
  - **Request scope first:** the originating request's selections come from `getRequest(assessment.assessmentRequest.documentId)`, which the analyst may read.
  - **Labels:** from `hydrate…Selections`.
  - **Risk Register editor:** its detail carries `assessment: { documentId, assessmentNumber, title }` only, so request-first there needs the assessment read, then the request read. Open Question 2.
- **Layer:** web only.
- **Tests:** unit tests for request-first ordering and hydration. In Playwright, a 26th system is found by typing.

#### UAT-034 - No save confirmation; control owner limited to names already on the risk
- **Root cause** [VERIFIED].
  - `assessment-editor.tsx:160`: `const options = { assets, controls, riskTypes, systems, users: currentAssessment.ownerLabels };`.
  - The control owner is a select over `options.users` (`control-implementation-editor.tsx:122`).
  - `RiskEditor` sets `statusMessage` only for `'No changes to save.'` (`risk-editor.tsx:155`); success just calls `onUpdated` (line 173).
- **Fix:** pass `searchOwners` to the control editor and use `OwnerCombobox`. On success, set a visible status in the existing polite region (`risk-editor.tsx:179`, `control-implementation-editor.tsx:119`), with the local time (D-33).
- **Layer:** web only.
- **Tests:** unit tests that "Risk saved" is visible after success and cleared on the next edit, and that the owner combobox searches all active users. In Playwright, "Saved" is visible after Save risk.
- **E2E risk:** `assessment-release-workflow.spec.ts:212` (`selectOption({ label: 'Jane Doe' })`) must change.

#### UAT-009 - Exemption review date asks for a typed UTC timestamp
- **Root cause** [VERIFIED].
  - The field is a text input with a hint (`risk-editor.tsx:198`: `Use UTC format YYYY-MM-DDTHH:mm:ssZ.`), validated as `exemptionReviewDate: z.iso.datetime({ offset: true, error: 'Enter the date and time as YYYY-MM-DDTHH:mm:ssZ.' }).nullable().optional()` (`assessment-schema.ts:251`).
  - The content type stores `exemptionReviewDate` as `datetime`, the only risk date that is not a `date`.
  - The Risk Register editor repeats the text input (`risk-detail-editor.tsx:190`).
- **Fix (D-32):** `<Input type="date">`. The form value is the UTC date part of the stored instant; submit `\`${date}T00:00:00.000Z\`` or `null`; compare the date parts in `changedValues` so an untouched legacy value is not rewritten.
- **Layer:** web only (both editors).
- **Tests:** unit round-trip for an empty value, a new date, an unchanged legacy `…T13:45:00Z` (not submitted), and clearing (null).

#### UAT-011 - Release readiness lists fourteen items per risk
- **Root cause** [VERIFIED: `assessment-editor.tsx:195-210`]. It maps every requirement to a row; risk rows are labelled `` `Risk ${requirement.riskNumber} — ${requirement.label}` `` (`assessment-domain.ts:50`).
- **Fix (D-35):** a zod-free grouping function (assessment-scope outstanding items, then per-risk `{ riskNumber, outstanding, href: '#risk-…' }`) and a "Show met requirements" disclosure. Keep the list's accessible name for outstanding items.
- **Layer:** web only.
- **Tests:** a unit test of the grouping for 3 risks with 14 requirements each. In Playwright, the per-risk link lands on the risk, and "All release requirements are met" still shows.
- **E2E risk:** `assessment-release-workflow.spec.ts:81, 181-192, 227-229` (the list name, `^Risk .+ — ` links, `getByText('Met')`) must change.

### Group F - Released view (ASSESS-07)

#### UAT-033 - The released view shows controls as internal IDs and hides treatment
- **Root cause** [VERIFIED].
  - `released-assessment.tsx:132`: `<Definition label="Control reference" value={implementation.control} />`, and `ReleasedRisk` (`:144`) renders only the two ratings (`:152-155`).
  - The page reads `listReleasedAssessmentRisks` and `listReleasedControlImplementations` (`app/(app)/app/assessments/[documentId]/page.tsx:11-12, 37, 64`). They are the same functions as the analyst lists (`assessment-service.ts:415, 438`), over `GET /v1/risk_assessments/{assessmentId}/risks` and `GET /v1/risks/{riskId}/control_implementations`, registered for parity at `assessment-service.ts:158-159`.
  - The web's risk parser is closed at five fields (`assessment-schema.ts:279-285`: `documentId`, `riskNumber`, `riskStatement`, `inherentRating`, `residualRating`).
  - The server projects exactly those (`assessment-scope.ts:310-318`), and the spec declares them (`specification.json:25793-25797`, `"required": ["documentId", "riskNumber", "riskStatement", "inherentRating", "residualRating"], "additionalProperties": false`).
  - Control implementations project only the id (`assessment-scope.ts:347-349`: `control: isRecord(document.control) && typeof document.control.documentId === "string" ? document.control.documentId : document.control`), with `"control": { "type": "string" }` in `ControlImplementationSummary` (`specification.json:25808-25812`).
- **UAT reading:** differs. "UI only (fields exist in the released read)" is wrong.
- **Fix (D-34):**
  - Give `GET /v1/risk_assessments/{id}/risks` its own item schema: statement; system and asset `{ documentId, name }`; inherent and residual likelihood, consequence and rating; treatment action, plan and status; risk and treatment owner `ActiveUserSummary`; target date. Leave `RiskSummary`, the mutation response, unchanged (Pitfall 9).
  - Add `controlSummary: { documentId, controlNumber, name, framework }` to `ControlImplementationSummary`. Populate `control` on every path that projects it, create and update included.
  - Render read-only definition lists and use the control label rule. Also give `ControlReadOnly` in the editor the summary instead of the loaded library.
- **Layer:** Strapi and contract, plus web.
- **Tests:**
  - **Strapi integration:** the owning Requestor's released risk list carries the fields; another Requestor still gets 404 (the matrix row is unchanged); control summaries are populated.
  - **Web:** the view shows the treatment and owner facts and no id.
  - **Playwright:** Jane sees the control number and name, the treatment plan, the owners and the target date.
- **E2E risk:** `assessment-release-workflow.spec.ts:315` asserts that the Requestor sees `reusableControlValue` (the document id), and must change. The no-mutation-controls checks at `:317-320` must stay green.

### Group G - Reference data (ADMIN-05)

#### UAT-007 - Unnamed, repeated or truncated control names; developer-note Risk Type descriptions
- **Root causes** [VERIFIED]:
  - **Name composition** (`seed-csrm-data.ts:225-236`): `return label ? \`${control.id} — ${label}\` : (control.id as string);`. Every titled control's stored name repeats its number (2,260 controls), and the untitled ones store the number alone (386: ISO 93, CPS 230 51, CPS 234 24, PSPF 218; counted with a script over `bootstrap/controls/*.json`). The pickers compose the number again: `` `${control.controlNumber} — ${control.name}` `` in the Risk Register (`mitigation-control-list.tsx:124, 126`) and `` `${control.controlNumber} · ${control.name}` `` in the Risk Type form's options (`administration-actions.ts:105`). That gives "5.1 — 5.1" and "ACCESS-1a — ACCESS-1a — …".
  - **ISO titles** are null by licence [VERIFIED: `iso-iec-27001-2022-annex-a.json:12, 18-21`]: "Titles and control text are not reproduced because the standard is copyrighted and paywalled; use a licensed copy of ISO/IEC 27001:2022 for authoritative wording." with `"theme": "Organizational", "title": null`.
  - **APP titles** are cut at a PDF line break [VERIFIED: `privacy-act-app-ndb-2026-06-04.json:92-96`: `"title": "security of personal"` with `legalText` starting `"information 11.1 …"`]. 9 of 13 APP titles are affected.
  - **Risk Type descriptions** are developer notes [VERIFIED: `seed-assessment-workflow.ts:16, 20, 24`, for example `"Reusable deterministic draft mapping for internet-reachable and externally hosted services."`], re-applied on every seeded start (`seed-assessment-workflow.ts:67-77`).
- **Fix (D-36):**
  - A zod-free `controlLabel({ controlNumber, name, framework })`: strip a leading `` `${controlNumber} — ` `` from the name; when the name equals the number, show the number and framework.
  - The theme lives only in `sourceData`, which nothing projects. Showing it would widen the projection (Open Question 3).
  - Correct the nine APP titles in the vendored JSON and rewrite the three descriptions. Both reach the dev database on the next seeded Strapi start.
- **Layer:** web (label rule); seed data (Strapi bootstrap files).
- **Tests:**
  - **Unit:** `controlLabel` over the three shapes.
  - **Strapi:** a seed test for the corrected titles and descriptions (`assessment-seed.integration.test.ts`, or a unit test over the catalogue file).
  - **Playwright:** the Administration controls list shows "5.1" once.

#### UAT-053 - The system owner shows as an ID; lists omit owner and criticality
- **Root cause** [VERIFIED].
  - The form seeds the combobox with the id as the name (`administration-form.tsx:87`: `typeof initialValues?.owner === 'string' ? { documentId: initialValues.owner, displayName: initialValues.owner } : null`).
  - The record projects only the owner's id (`administration-query.ts:251-257`: `const owner = isRecord(input.owner) ? input.owner.documentId : input.owner;` … `owner: typeof owner === "string" ? owner : null,`), although the repository populates `owner`.
  - The systems list has no owner or criticality column: its columns are Name, Type, Environment, Deployment model, Lifecycle and Internet-facing (`administration-workspace.tsx:197-204`).
  - `CsrmInformationAsset` has no owner in the JDL.
- **UAT reading:** differs for the system half (the name needs a projection change, not UI only). The asset half is confirmed as a datamodel gap.
- **Fix (D-37):** add `ownerName: string | null` to `InformationSystemsAdministrationRecord` (list and detail share it). Seed `OwnerCombobox` with it, and add Owner and Business criticality columns.
- **Layer:** Strapi and contract, plus web.
- **Tests:** a Strapi integration test that the record and list carry `ownerName` for an active owner and `null` for none. Web tests that the form shows the name and the list shows the columns. A Playwright step in `administration-workflow.spec.ts`.

### Group H - Generation status (UX-06 criterion 2)

#### UAT-041 - Leaving mid-job loses its status; the hub invites another generation
- **Root cause** [VERIFIED].
  - The panel is mounted without its job: `assessment-detail.tsx:85`, `<QuestionnaireGenerationJob hasExistingQuestionnaire={…} requestId={request.documentId} />`, although the component accepts `initialJob` (`questionnaire-generation-job.tsx:49-58`). The draft panel is the same (`assessment-detail.tsx:86`), and `AssessmentDraftJob` also accepts `initialJob` (`assessment-draft-job.tsx:83-108`).
  - The registry de-duplicates active jobs per request [VERIFIED: `questionnaire-generation-registry.ts:22`: `const existing = activeByRequest.get(input.requestId); if (existing) { … return publicJob(job); }`] but reads only for the initiator (line 20, `authorize`). The workflow builds the actor as `{ documentId, canReadAllQuestionnaireGenerationJobs: false }` (`questionnaire-generation-workflow.ts:15`). The registry exposes `{ enqueue, get, retry, cleanup, hasActiveJob, activeRequestIds }` (`:33`).
  - The draft registry keys jobs by questionnaire (`assessment-draft-registry.ts:107-108`, `jobsByQuestionnaire`) and exposes `{ enqueue, get, retry, cleanup }` (`:233`), so a latest-by-questionnaire read builds on the existing map.
  - No read by request exists in the catalogue (checked every `functionApis` entry) or the spec (the generation paths are `/v1/assessment_requests/{requestId}/generate_questionnaire`, `/v1/questionnaire_generation_jobs/{jobId}` and its `/retry`, and the draft equivalents).
- **UAT reading:** confirmed, including the draft panel.
- **Fix (D-25, D-26):**
  - **Operation:** `GET /api/v1/assessment_requests/{requestId}/generation_jobs`, human analyst only.
  - **Registries:** `latestForRequest(requestId)` (active, else the newest retained terminal job; retention is `terminalTtlMs` 3600000 and `maxTerminal` 500, line 15) and the draft registry's `latestForQuestionnaire`.
  - **Projection:** wraps each job as `{ job, canRetry }`, leaving the closed job schemas unchanged.
  - **Hub:** seeds panels for queued, running and failed jobs, polls by request for jobs the viewer did not start, and overrides the next-action text while a job is active.
- **Layer:** Strapi, catalogue, contract, inventory, matrix, and web.
- **Tests:**
  - **Strapi unit:** registry selection.
  - **Strapi integration:** the analyst gets the active job; another analyst gets it with `canRetry: false`; the Requestor and the service agent are refused; an unknown request gets 404.
  - **Web:** the panel renders the seeded job without a Generate button.
  - **Playwright:** start, navigate away and back, and the status shows. Deterministic jobs finish in about 1-2 seconds, so assert the completed or seeded state tolerantly (Open Question 5).
- **E2E risk:** `questionnaire-generation-workflow.spec.ts:127-134` must still reach Replace, so do not seed completed jobs.

### Root causes that differ from the UAT's reading

| Finding | UAT reading | What the code shows |
|---------|-------------|---------------------|
| UAT-033 | "UI only (fields exist in the released read)" | The released read returns five risk fields and a bare control id; an API change is required |
| UAT-020 | "API (a progress count without answer content, if not already exposed)" | `progress` is already served to analysts; web only |
| UAT-037 | "Refresh the request's actions after the transition" | The revert already refreshes; stale local state from an in-page submit overrides the refreshed prop |
| UAT-064 | Arrow keys do not select | Radix selects on arrow focus but loses a race to a quick keyup (deferred roving focus) |
| UAT-010 | Every system and asset in the inventory | Only the first 25 selector results; later records are unselectable |
| UAT-016 | Key `general` at order 0 collides with generated sections | Confirmed, plus removed questions occupying orders and the edit form breaking multi-question sections |
| UAT-019 | Silent discard and wrong timeline keys | Confirmed, plus replacing a released questionnaire publishes unreviewed AI questions |
| UAT-053 | UI (system) and datamodel (asset) | The system owner name needs a projection change; the asset owner is a datamodel gap |

## Contract changes (D-03, in detail)

All seven follow D-02. For each, "files" lists what changes. The spec, the generated `apps/web/src/lib/api/generated/schema.d.ts` and the parity guard change in every one.

1. **Conflict reason codes (D-22).**
   - **Spec:**
     - `AssessmentWorkflowErrorResponse.error.details`, today `{ "type": "object", "additionalProperties": false }` [VERIFIED: `specification.json:24927`], gains `properties.reason` with a closed enum.
     - `QuestionnaireWorkflowErrorResponse.error.details`, today `{ "type": "object", "additionalProperties": true }` [VERIFIED: `specification.json:25833`], gains the same typed property.
   - **Strapi:** the workflow error classes carry an optional `reason`, and controllers pass it as `details`.
     - **Strapi's helpers accept details** as the second argument [VERIFIED: `@strapi/core/dist/services/server/koa.js:19-25`: `app.response[methodName] = function responseCode(response = statusName, details = {}) { const httpError = createError__default.default(code, response, { details }); const { status, body } = errors.formatHttpError(httpError);`].
     - **The formatter keeps them:** it writes `details: error.details` into `{ data: null, error: { status, name, message, details } }` [VERIFIED: `@strapi/core/dist/services/errors.js:52-64`].
     - **Where the change goes:** today each controller sends conflicts through its own helper with the message only, and those helpers gain the `details` argument:
       - `csrm-assessment-request.ts:50`, `if (ctx.conflict) return ctx.conflict(message);`;
       - `safeError` in `csrm-questionnaire.ts:103-114`, including its fallback body at `:113`;
       - `safeError` in `csrm-assessment.ts:54-55`.
   - **Web:** `TransportError` gains `reason?` (`server-client.ts:11-16`), parsed from the error body with a closed enum in a server-only module. Actions map codes to copy. Add a unit test that the web enums equal the spec enums.
2. **Generation jobs by request (D-25).**
   - **New path:** `GET /v1/assessment_requests/{requestId}/generation_jobs`, with 400, 403 and 404 using the questionnaire error responses.
   - **Catalogue** (both copies, byte-identical): a new API-only Function modelled on `function.questionnaire_generation.job_read_api`, `"roleIds":["role.security_analyst"]`, "This API-only Function intentionally has no menuPath.", plus one FunctionAPI.
   - **Strapi:**
     - Add the operation to `HUMAN_ANALYST_ONLY_OPERATIONS` (`csrm-authorization.ts:41-49`), as 07 D-07 did for the analyst insights. Today the generation operations rely on the exact grant alone.
     - Add the route and handler (questionnaire or assessment-request controller) and the registry read methods.
     - Regenerate `served-operations.json` with `SERVED_OPERATIONS_WRITE=1 pnpm --filter @csrm/strapi served-operations:write` (dev servers stopped).
     - Add an authorization-matrix row `humanAnalystOnly(…)`.
     - Cover it in `contract-catalogue.integration.test.ts`.
   - **Web:** a service with a closed parser registered in the parity guard, and a Server Action for polling.
3. **Governance events (D-10, D-17, D-18).**
   - **Strapi** (`questionnaire-governance-log.ts`):
     - `GOVERNANCE_EVENT_KINDS` gains `"regenerated"` [VERIFIED current list, lines 26-33: `"released", "returned-to-review", "question-added", "question-edited", "question-deleted", "answer-cleared"`].
     - `GOVERNANCE_EVENT_KEYS` gains `"questionText"` [VERIFIED current keys, lines 47-55], bounded like `MAX_EXPLANATION_LENGTH = 500` (line 60).
     - `appendQuestionEvent` snapshots the text.
     - `persistGeneratedQuestionnaire` appends `regenerated` in its transaction.
     - `projectGovernanceEvents` (`questionnaire-scope.ts:319-345`) projects `questionText` on its analyst branch only, beside `questionKey`, from the snapshot or resolved per D-17, plus an earlier-version marker. The Requestor branch keeps `kind`, `at` and `explanation`. `findWorkflowOne` already populates `questions`, so resolution needs no extra read (`controllers/csrm-questionnaire.ts:363-370`).
   - **Spec:** `QuestionnaireGovernanceEvent` (the raw stored event, returned by governance results through `resultForGovernance`) and `QuestionnaireRevisionTimelineEvent` (the projected event) gain the kind and property [VERIFIED current enums: `specification.json:24906` and the timeline event].
   - **Web:** the enums in `questionnaire-service.ts:29` and `:113` must change in the same plan, because both are closed.
   - **Record:** a dated amendment in `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`.
4. **Change count (D-16).** `QuestionnaireRevision` [VERIFIED: `specification.json:24908`, `{"eventCount", "lastEventAt"}`] gains an optional `analystChangesSinceGeneration` (integer, 0 minimum).
   - **Where it appears:** `QuestionnaireRevision` is shared by `QuestionnaireSummary`, `QuestionnaireGovernanceResult` and `QuestionnaireReleaseResult`.
   - **Who receives it:** `projectQuestionnaire` (`questionnaire-scope.ts:386-406`) has no actor parameter and serves both actors. The count is added only on analyst paths:
     - the analyst branch of `findWorkflowOne` (`controllers/csrm-questionnaire.ts:370`);
     - `resultForGovernance` (`questionnaire-governance-workflow.ts:417-423`).

     The field is optional for that reason, matching how `questionKey` is analyst-only.
   - **How it is computed:** from events at or after `generatedDate`, in `summariseGovernanceLog` (`questionnaire-governance-log.ts:150-159`) or beside it.
   - **Web:** the revision schema (`questionnaire-service.ts:49`) is updated, and the analyst request page adds the questionnaire summary read (Group C, UAT-019).
5. **Released risk facts and control summary (D-34).**
   - **Why a new list schema:** today `RiskSummary` is wrapped by both `RiskListResponse` (`GET /v1/risk_assessments/{assessmentId}/risks`) and `RiskResponse` (the `POST …/risks` and `PATCH /v1/risks/{riskId}` responses) [VERIFIED with a script over the spec].
   - **Risk list:** a new `AssessmentRiskListItem` for the list response only, so the mutation responses keep five fields.
   - **Control implementations:** `ControlImplementationSummary` gains `controlSummary`. It is shared by `ControlImplementationListResponse` and `ControlImplementationResponse` (the `POST` and `PATCH` responses), so every path that projects it must populate `control`.
   - **Strapi:** the list read populates `riskOwner`, `treatmentOwner`, `informationSystemImpacted`, `informationAssetImpacted` and `control`; the projections to change are in `assessment-scope.ts:310-358`.
   - **Web:** new parsers in `assessment-schema.ts` and `assessment-service.ts`, registered in the parity list (`assessment-service.ts:158-159`, the `listAssessmentRisks` and `listControlImplementations` rows).
6. **System owner name (D-37).** `InformationSystemsAdministrationRecord`, shared by the record and list responses, gains `ownerName` (string, maximum 255, or null). Update the Strapi `administration-query.ts` projection and the web `administration-schema.ts:201`.
7. **Applicable controls on the picker's Risk Type list (D-31).**
   - **The change:** `RiskTypeSummary` [VERIFIED: `specification.json:25815`: `documentId`, `name`, `description`] gains `applicableControls` (bounded array of `{ documentId, controlNumber, name, framework }`).
   - **Where it lands:** `RiskTypeSummary` is used only by `RiskTypeListResponse`, the legacy picker list. The web parses the no-query `GET /v1/risk_types` against it (`assessment-service.ts:160`).
   - **A spec nuance the plan must respect:** the path's declared 200 response is `RiskTypesAdministrationListResponse`, described as "Risk Type page or legacy picker-compatible list". The picker branch is served when the query is empty (`csrm-risk.ts:188-190`); `GET /v1/controls` is declared the same way.
   - **Why this change is needed** (considered and rejected: reading the Administration record):
     - The Administration record already carries the Risk Type's `applicableControls`, but as ids only (`RiskTypesAdministrationRecord`, `maxItems: 1000`).
     - There is no read that hydrates control labels by id, so ids alone cannot label the picker's first group without per-id reads.
   - **Files:** Strapi `projectRiskTypeSummary` (`assessment-scope.ts:320-326`) with the populate in the picker read; the web `riskTypeSchema` (`assessment-schema.ts:369-373`).
   - **The bound** is Open Question 1.

## Conflict reason vocabulary (proposed, closed)

**Rules for the codes.**
- **Actor-neutral:** no code tells an actor more than the relationship state they are already served. A Requestor sees an unreleased questionnaire only as `unavailable` (`relationship-scope.ts:115-122`), and an assessment likewise, so "work has started" discloses nothing new.
- **Tied to the code:** each code below was mapped to the throw site that raises it, read this session.
- **One reason per throw:** several sites test two or three conditions in one `if`. Those sites split so each throw carries a single reason. The splits are marked "(split)" below.
- **Copy:** the Server Action already knows the operation, so one code can read differently per action. For example, `QUESTIONNAIRE_RELEASED` reads "Return it to analyst review first" on an edit, and "It has already been released" on a release.

| Family | Code | Throw site: condition (message today) |
|--------|------|----------------------------------------|
| Request revert | `REQUEST_NOT_SUBMITTED` | `request-workflow.ts:104-105` (split): `requestStatus !== "submitted"` ("cannot be reverted to draft.") |
| Request revert | `REQUEST_WORK_STARTED` | same site (split): a questionnaire or an assessment exists |
| Questionnaire revert | `ASSESSMENT_STARTED` | `questionnaire-workflow.ts:278-279` (split): an assessment exists, or the request has moved past `questionnaire-in-progress` (the draft sets `risk-assessment-drafted`, `assessment-workflow.ts:795-798`) |
| Questionnaire revert | `REQUEST_NOT_ELIGIBLE` | same site (split): the request is missing or at another stage |
| Questionnaire revert | `QUESTIONNAIRE_NOT_SUBMITTED` | `questionnaire-workflow.ts:348-349`: not every active visible question holds a submitted answer ("is not submitted.") |
| Answer save and submit | `QUESTIONNAIRE_NOT_ANSWERABLE` | `questionnaire-workflow.ts:102` (`nextRequestStatusAfterDraft`: the request is not `submitted` or `questionnaire-in-progress`), `:251` |
| Answer save and submit | `QUESTIONNAIRE_ALREADY_SUBMITTED` | `questionnaire-workflow.ts:107` |
| Answer save and submit | `QUESTIONNAIRE_INCOMPLETE` | `questionnaire-workflow.ts:131` |
| Answer save and submit; release | `QUESTIONNAIRE_HAS_NO_QUESTIONS` | `questionnaire-workflow.ts:122`; `questionnaire-governance-workflow.ts:223` (release without an active question) |
| Governance | `QUESTIONNAIRE_RELEASED` | `questionnaire-governance-workflow.ts:210` (release when already released); `:241` (split, `assertQuestionnaireInAnalystReview` at `:237-243`): `releasedAt` is set, so a question change must wait for a return to review |
| Governance | `REQUEST_NOT_ELIGIBLE` | `:218` (split): the request is missing or its status is not in `RELEASABLE_REQUEST_STATUSES` (`submitted`, `questionnaire-in-progress`, `:35`); `:241` (split) and `:299` (split), same test; `:289` and `:445`: no request on the questionnaire |
| Governance | `ASSESSMENT_STARTED` | `:218` (split), `:241` (split) and `:299` (split): an assessment exists. `:299` is the return to review, which reruns the review-stage check with the release cleared |
| Governance | `ALREADY_IN_ANALYST_REVIEW` | `:292` |
| Governance | `DEFINITION_INVALID` | `:227`: the stored definition fails to parse at release |
| Governance | `DEFINITION_CONFLICT` | `:397` (split, `governanceConflict`): a `QuestionnaireDefinitionError`, meaning a placement or section clash on add or edit. This is the D-06 placement race. |
| Governance | `HISTORY_UNAVAILABLE` | `:397` (split): a `GovernanceLogError`; `:322`, `:369`: the log cannot be extended (it is full at 1,000 entries, `GOVERNANCE_LOG_MAX_ENTRIES`, or invalid) |
| Governance | `QUESTION_REMOVED` | `:455`, `:544` |
| Governance | `QUESTION_HAS_DEPENDENTS` | `:458` |
| Governance | `LAST_ACTIVE_QUESTION` | `:461` |
| Governance | `ANSWER_DATA_INVALID` | `:272`, `:551` |
| Governance | none | `:529` is a defensive guard for a missing document-service `create`. It cannot occur through the API, so it takes no code and falls back to the generic message. |
| Generation (synchronous 409) | `REQUEST_NOT_ELIGIBLE` | `questionnaire-generation-workflow.ts:67` (`generateQuestionnaire`: the request is not `submitted`) |
| Generation (synchronous 409, new) | `QUESTIONNAIRE_RELEASED` | new check before enqueue (D-09): the request's questionnaire has `releasedAt` |
| Generation job `failureCode` (existing strings kept) | `REQUEST_NOT_ELIGIBLE`, `QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED`, `QUESTIONNAIRE_ANSWERED`, plus the new `QUESTIONNAIRE_RELEASED` for the race inside the job transaction | `questionnaire-generation-workflow.ts:31`, `:34` |

The closed union is therefore:
- `REQUEST_NOT_SUBMITTED`, `REQUEST_WORK_STARTED`, `REQUEST_NOT_ELIGIBLE`, `ASSESSMENT_STARTED`;
- `QUESTIONNAIRE_NOT_SUBMITTED`, `QUESTIONNAIRE_NOT_ANSWERABLE`, `QUESTIONNAIRE_ALREADY_SUBMITTED`, `QUESTIONNAIRE_INCOMPLETE`, `QUESTIONNAIRE_HAS_NO_QUESTIONS`, `QUESTIONNAIRE_RELEASED`, `ALREADY_IN_ANALYST_REVIEW`;
- `DEFINITION_INVALID`, `DEFINITION_CONFLICT`, `HISTORY_UNAVAILABLE`, `QUESTION_REMOVED`, `QUESTION_HAS_DEPENDENTS`, `LAST_ACTIVE_QUESTION`, `ANSWER_DATA_INVALID`.

That is 18 codes; names are at the planner's discretion (CONTEXT, Planner's Discretion).

The request revert returns `AssessmentWorkflowErrorResponse`, and the questionnaire operations return `QuestionnaireWorkflowErrorResponse`. Each schema declares the subset its operations can return, or both declare the full union, which is simpler and still closed.

A 403 from the release gate is not a 409. It happens when a Requestor saves after the analyst took the questionnaire back: `csrm-authorization.ts:382-384` calls `deny`, which calls `context.forbidden` (`:140-143`). Autosave shows it as "can no longer be saved here; reload" (Pitfall 7).

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client Components)                      Next server (RSC, Server Actions)            Strapi
─────────────────────────────                    ──────────────────────────────────           ──────
ViewerTimeZoneSync ── zone ≠ cookie? ──────────▶ syncViewerTimeZoneAction ─ validate IANA ─┐
                                                   cookies().set('csrm-time-zone')        │
      ◀── router.refresh() ──────────────────────  (app)/layout: read cookie ──────────────┘
TimeZoneProvider(zone) → formatInstant(v, zone)   server pages: formatInstant(v, zone)

QuestionnaireRenderer ─ change/blur ─▶ debounce ─▶ autosaveDraftAction (no current-path  ─▶ PATCH /v1/questionnaires/{id}/answers
   status: saving|saved(at)|failed                  revalidate)                              (serialised per questionnaire; 409/403)
   NavigationGuard.set(blocking) ─┐
Shell nav <Link onNavigate> ◀─────┘ blocking? preventDefault → ConfirmDialog → router.push(href)
window 'beforeunload' ◀── blocking

Analyst request page (RSC) ─ gate assessment:review ─▶ getRequest ────────────────────────▶ GET /csrm-assessment-requests/{id}
                                                     ─▶ getRequestGenerationJobs ─────────▶ GET /v1/assessment_requests/{id}/generation_jobs
                                                                                              human-analyst guard → registries
   QuestionnaireGenerationJob(initialJob if queued|running|failed)                            latestForRequest / latestForQuestionnaire
   AssessmentDraftJob(initialJob …)  → poll by jobId (initiator) or by request               → { job, canRetry }

Any action ─ 409 ─▶ service normalizeTransportError(error, status) ─ parse error.error.details.reason (closed enum)
                  ─▶ Server Action maps reason → plain copy ─▶ component shows it beside the control

Governance editor ─ placement(section chooser, full question set incl. removed) ─▶ add/edit ─▶ definition parser ─ 200 | 409 DEFINITION_CONFLICT
```

### Recommended project structure (new modules)

```
apps/web/src/
├── lib/time/                     # formatInstant, formatCalendarDate, zone validation (zod-free), server-only getViewerTimeZone
├── components/csrm/
│   ├── relation-picker.tsx       # the shared single-record server-backed picker (D-28)
│   ├── navigation-guard.tsx      # context, provider, guarded link helper (D-12)
│   └── save-status.tsx           # the visible, polite save status (D-11, D-33)
├── features/requests/
│   └── request-context-details.tsx   # shared grouped read-only request fields (D-20)
├── features/questionnaires/
│   ├── questionnaire-placement.ts    # zod-free placement over the full question set (D-05)
│   └── use-answer-autosave.ts        # debounce, flush, single flight, status (D-11)
└── features/assessments/
    ├── control-label.ts              # control label rule (D-36), zod-free
    └── release-readiness-summary.ts  # zod-free grouping (D-35)
```

The names are recommendations; placement is at the planner's discretion. Keep zod out of every new client module (`zod-client-boundary.test.ts`).

### Pattern 1: Gate before read (analyst routes)
**What:** resolve capabilities, and if `assessment:review` is missing, return the route's permission state before any service call. **Example:** the existing dashboard [VERIFIED: `app/(app)/app/review/(analyst-dashboard)/page.tsx:26-30`].

### Pattern 2: Actions from server rules
**What:** zod-free predicates over served facts (`relationships` availability, statuses), shared by both actors. Never use the legacy nullable `questionnaire` and `assessment` fields for decisions (06.4: absent, unavailable and available differ).

### Pattern 3: Contract change in one plan
**What:** spec, then Strapi projection, `api:generate`, web parser, parity registration, and consumers, together. Closed enums on both sides make a one-sided change a runtime failure (06.9 lesson).

### Pattern 4: Guarded navigation (Next 16.3)
**What:** `Link onNavigate` plus a context guard (`link.md`, "Blocking navigation"). Use the product dialog asynchronously: `preventDefault()`, open the dialog, and on confirm call `router.push(href)`.

### Anti-Patterns to Avoid
- **Formatting instants with the process time zone** (`toLocale*` with no zone) in components that render on both server and client. That causes hydration mismatches; always pass the zone.
- **Computing placement from the filtered definition.** Removed questions still occupy orders.
- **Widening `RiskSummary`.** It is the mutation response too, so unpopulated relations would blank local editor state.
- **Loading whole libraries into selects.** Search on the server.
- **Letting local component state outlive a server transition.** Derive from props after `router.refresh()`.
- **Hiding refusals behind "changed, reload".** Carry the reason.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Navigation blocking | A document-level click interceptor | `Link onNavigate` plus context (Next 16.3) | Documented, handles modifier-key and new-tab cases (`link.md` "Good to know") |
| Reading and writing the time-zone cookie | Custom header plumbing | `cookies()` in a Server Action (async in 16.3) | Setting cookies is only allowed in Server Functions or Route Handlers (`cookies.md`) |
| Error envelope details | A custom error body | `ctx.conflict(message, { reason })` | Strapi formats `details` in its standard envelope (`koa.js:19-25`) |
| Keyboard radio groups | A new radio component | The shadcn Radix wrapper plus an arrow handler | Keeps one primitive and its focus management |
| Server-side search and filtering | Client filtering over full lists | The existing selector and Administration list operations | Bounded, authorised, already counted |
| Time zone validation | Regular expressions over zone names | `Intl.DateTimeFormat(undefined, { timeZone })` in try/catch, or `Intl.supportedValuesOf('timeZone')` | Accurate IANA validation |

**Key insight:** every fix in this phase has an existing seam: a service, a Server Action, a projection, a primitive or a domain module. The risk is a parallel implementation, not a missing library.

## Runtime State Inventory

Phase 10 is not a rename, but it changes stored and derived state:

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | Governance logs written before Phase 10 carry no `questionText` and no `regenerated` events. Development Risk Type descriptions and APP control names come from the seed | No data migration: read-time resolution (D-17) handles old events, and the seed reconciliation rewrites managed descriptions and names on the next seeded start (`seed-assessment-workflow.ts:75`; the control seed's update path) |
| Live service config | None; no `CSRM_AI_*` or other configuration changes | None |
| OS-registered state | None | None |
| Secrets and env vars | None added. The time-zone cookie is non-secret client state | None |
| Build artifacts | `apps/web/src/lib/api/generated/schema.d.ts` (regenerated per contract plan), `docs/references/served-operations.json` (regenerated when the new route mounts), Strapi `dist` (compiled by tests) | Regenerate through the scripts; never hand-edit; Strapi tests only with the dev servers stopped |

## Common Pitfalls

### Pitfall 1: A one-sided enum change breaks every questionnaire read
**What goes wrong:** Strapi projects a `regenerated` event, the web's closed enum rejects it, and the whole questionnaire page shows its error state. **How to avoid:** change `questionnaire-service.ts:29, 113` in the same plan as the Strapi kinds; add a parity row. **Warning sign:** questionnaire pages error after a replacement.

### Pitfall 2: Placement ignores removed questions
**What goes wrong:** the next order equals a removed question's order, so add fails with 409. **How to avoid:** placement over the raw `/questions` list (`projectQuestions` returns removed questions with `deleted`). **Warning sign:** add works on fresh questionnaires but fails after a delete.

### Pitfall 3: Section metadata drift
**What goes wrong:** sending an edited title under an existing key makes siblings inconsistent, so 409. **How to avoid:** send stored metadata for existing sections; no rename.

### Pitfall 4: The Radix fix breaks Tab or double-selects
**What goes wrong:**
- Handling arrows without `preventDefault` also lets Radix move focus, so focus jumps twice.
- Selection fires on Tab focus.
- While a key is held, Radix's document-level flag is already set. Its `onFocus` then clicks as well, so the same radio is checked twice.

**How to avoid:**
- Prevent default only for arrows without modifiers, move focus yourself, and check only on arrows.
- Check through `click()` rather than a second, separate state path. The Radix radio's click calls `onCheck` only `if (!checked)`, and `onCheck` sets the group value (`react-radio-group/dist/index.mjs:100-104`, `:324`). At worst, two clicks before a re-render set the same value twice, which is harmless.
- Keep the segmented-control tests green.

### Pitfall 5: Hydration mismatch from time formatting
**What goes wrong:** a client component formats with the browser zone during hydration while the server used another. **How to avoid:** the server and client both use the cookie zone passed down. Render UTC with a label only before the cookie exists; the sync then refreshes once.

### Pitfall 6: `beforeunload` blocks E2E reloads
**What goes wrong:** a pending autosave arms `beforeunload`, and `page.reload()` in `questionnaire-workflow.spec.ts:230` is held by the dialog. **How to avoid:** explicit Save flushes and disarms; E2E waits for the saved state before navigating. How Playwright disposes of a `beforeunload` dialog during `reload` is not verified here [ASSUMED], so the specs should not depend on it.

### Pitfall 7: Autosave after the analyst takes the questionnaire back
**What goes wrong:** the release gate refuses the Requestor's save with 403 (`csrm-authorization.ts:382-384`), and autosave loops or says "no permission". **How to avoid:** stop autosaving on 403 and 409, show a plain status, and offer reload.

### Pitfall 8: Autosave revalidation re-renders the page on every save
**What goes wrong:** `revalidatePath` of the current path in the autosave action re-renders the page each time ("Updates the UI immediately", `revalidatePath.md`). **How to avoid:** the autosave action variant revalidates nothing, or only list paths.

### Pitfall 9: Widening `RiskSummary`
**What goes wrong:** create and update responses parse the wider schema, relations are unpopulated on mutation paths, and the editor's merge (`risk-editor.tsx:172-173`) blanks owners. **How to avoid:** a new list-item schema for the assessment's risk list only.

### Pitfall 10: Dropping `listControls()` too early
**What goes wrong:** `ControlReadOnly` (`assessment-editor.tsx:338-341`) labels implementations from the loaded library, and falls back to ids. **How to avoid:** land the control summary (contract change 5) first, then remove the full read.

### Pitfall 11: Reason codes that disclose
**What goes wrong:** a Requestor's refusal names the questionnaire, its title or its state while it is unreleased (analyst-only). The Requestor is served only `unavailable` for it (`relationship-scope.ts:115-122`). **How to avoid:** actor-neutral codes (`REQUEST_WORK_STARTED`) and copy that says no more than the served relationship state.

### Pitfall 12: Parity guard boundary mode
**What goes wrong:** new parsers add `.trim()`, `.min()` or `.max()` beyond the spec and fail the five-mode guard. New parsers may not enter `boundaryGrandfathered`.

Four parsers this phase extends are already grandfathered entries: `listAssessmentRisks`, `listControlImplementations`, `listRiskTypes` and `listControls` (`contract-response-parity.test.ts:110-118`). Extending them does not license unbounded new fields. A wholly new list-item parser for the released risks is a new parser and must pass without the entry.

**How to avoid:** declare bounds in the spec for every new field (ids 255, names 255, snapshot 500), or register a `narrowedPaths` entry with a reason.

### Pitfall 13: Date-only renders gaining a label
**What goes wrong:** "Submitted 27 Sept 2026 (UTC)" breaks `requestor-request-workflow.spec.ts:225`'s `$`-anchored regex. **How to avoid:** the UTC label only on time-of-day renders.

### Pitfall 14: Stale dist and dev servers
**What goes wrong:** Strapi tests and Playwright compile into `apps/strapi/dist` beside the running dev Strapi. **How to avoid:** Strapi suites, `served-operations:write` and Playwright only with the dev servers stopped (the orchestrator's call).

### Pitfall 15: Vitest `EPERM: rename` on Windows
**What goes wrong:** intermittent failures under disk load. **How to avoid:** rerun the file alone before treating it as real (STATE "Notes carried forward").

## Code Examples

### Blocking client navigation (Next 16.3.6 bundled docs)
```tsx
// Source: apps/web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md ("Blocking navigation")
<Link
  onNavigate={(e) => {
    if (isBlocked && !window.confirm('You have unsaved changes. Leave anyway?')) {
      e.preventDefault()
    }
  }}
  {...props}
>
```
In CSRM, replace `window.confirm` with `preventDefault()` plus the product `ConfirmDialog`, then call `router.push(href)` on confirm.

### Setting a cookie from a Server Action (Next 16.3.6)
`cookies.md`: "`cookies` is an **async** function …" and "Setting cookies is not supported during Server Component rendering. To modify cookies, invoke a Server Function from the client or use a Route Handler."

```ts
// Sketch (not from a source): validate, then set; the caller refreshes the route.
'use server';
import { cookies } from 'next/headers';
export async function syncViewerTimeZoneAction(zone: unknown) {
  if (typeof zone !== 'string' || zone.length > 64 || !isIanaZone(zone)) return { ok: false as const };
  (await cookies()).set('csrm-time-zone', zone, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  return { ok: true as const };
}
```
`isIanaZone`, the cookie name and the max age are recommendations [ASSUMED].

### A 409 with a reason in Strapi 5.51
```ts
// Verified wiring: @strapi/core/dist/services/server/koa.js:19-25 passes the second argument as `details`.
return ctx.conflict('CSRM assessment request cannot be reverted to draft.', { reason: 'REQUEST_WORK_STARTED' });
```

### Next free placement (sketch over verified rules)
```ts
// Rules verified in questionnaire-definition.ts:184-194: one key per section order,
// identical metadata per key, unique `${section.key}:${order}`, across removed questions too.
function nextQuestionOrder(all: Placement[], sectionKey: string): number {
  const orders = all.filter((q) => q.section.key === sectionKey).map((q) => q.order);
  return orders.length ? Math.max(...orders) + 1 : 0;
}
function newSection(all: Placement[], title: string): { key: string; title: string; order: number } {
  const keys = new Set(all.map((q) => q.section.key));
  const base = `section-${slug(title)}`.slice(0, 110) || 'section';
  let key = base; for (let n = 2; keys.has(key); n += 1) key = `${base}-${n}`;
  const order = Math.max(-1, ...all.map((q) => q.section.order)) + 1;
  return { key, title: title.trim(), order };
}
```

### Arrow keys select deterministically (sketch)
```tsx
// On the shared RadioGroupItem wrapper. Radix skips its roving handler when an earlier handler
// prevented default: the Slot runs the child's handler first (@radix-ui/react-slot@1.3.3
// mergeProps, lines 88-93), and the roving item composes its own with the default check
// (@radix-ui/react-roving-focus@1.1.19 line 176; @radix-ui/primitive@1.1.7 lines 6-13).
onKeyDown={(event) => {
  onKeyDown?.(event); // the caller's own handler, if any
  if (event.defaultPrevented) return;
  if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key) || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  event.preventDefault();
  const group = event.currentTarget.closest('[role="radiogroup"]');
  if (!group) return;
  const items = [...group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([disabled])')];
  const index = items.indexOf(event.currentTarget);
  const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
  const next = items[(index + step + items.length) % items.length];
  next.focus();
  next.click(); // the same check path Radix's onFocus uses
}}
```
The handler order was read from the installed sources [VERIFIED]. The unit test that presses and releases without holding is the executable proof.

## Plan grouping and wave order

Waves are dependency layers. Execution in this project is serial, one plan at a time, but plans are ordered so that no two in a wave own the same file (D-40).

| Wave | Plan (suggested) | Findings and requirements | Layer | Depends on |
|------|------------------|---------------------------|-------|------------|
| 1 | 10-01 Viewer time zone and shared instant formatting | UAT-024 (time), part of UX-06 c3 | web | - |
| 1 | 10-02 Analyst route gate and plain permission copy | UAT-062, part of UAT-054 and UX-06 c4 and c5 | web | - |
| 1 | 10-03 Radio groups select with the arrow keys | UAT-064 | web | - |
| 2 | 10-04 Request pages: context, server-state actions, revert availability, submit copy | UAT-015, UAT-037, UAT-036 (request web half), UAT-022 (request, including `request-form.tsx:200`), hub and tile copy (UAT-054, `request-hub.tsx:91`, `request-form.tsx:270`), REQ-07 | web | 10-01 |
| 2 | 10-05 Requestor questionnaire: introduction, attention list, history summary, submit copy, revert availability | UAT-023, UAT-022 (questionnaire), UAT-024 (summary counts), UAT-036 (questionnaire web half) | web | 10-01, 10-02 |
| 3 | 10-06 Conflict reason codes | UAT-036 (refusals), UX-06 c1 | Strapi and contract | 10-04, 10-05 (consumers) |
| 4 | 10-07 Questionnaire autosave and leave warning | UAT-021, QUES-09 c1 | web | 10-05, 10-06 |
| 4 | 10-08 Governance editor: placement, in-place forms, released read-only view | UAT-005, UAT-016, UAT-020, QUES-08 c1, c2, c4 | web | 10-02, 10-06 |
| 5 | 10-09 Regeneration safeguards and timeline question text | UAT-019, UAT-024 (text), QUES-08 c3 | Strapi and contract | 10-08, 10-05 |
| 6 | 10-10 Generation status by request | UAT-041, UX-06 c2, job panel copy (UAT-054, "server-owned job") | Strapi, catalogue, route, contract | 10-09 (shares `questionnaire-generation-job.tsx`) |
| 7 | 10-11 Released assessment content and the control label rule | UAT-033, ASSESS-07, part of UAT-007 (label) | Strapi and contract | 10-06 |
| 8 | 10-12 Reference data: owner name, list columns, APP titles, Risk Type text, CSV copy | UAT-053, UAT-007 (data), UAT-054 (CSV), ADMIN-05 | Strapi, contract, seed | 10-11 (label rule) |
| 9 | 10-13 Assessment pickers, exemption date, save status (with applicable controls) | UAT-006, UAT-009, UAT-010, UAT-034, ASSESS-06 c1-c3 | web and contract | 10-11 (control summary), 10-01 |
| 10 | 10-14 Release readiness summary and editor copy | UAT-011, UAT-054 (editor), ASSESS-06 c4 | web | 10-13 (`assessment-editor.tsx`) |
| 11 | 10-15 Phase gate | All | - | all |

**Hot files and owners:**
- `specification.json`, `schema.d.ts`, `contract-response-parity.test.ts`: plans 10-06, 10-09, 10-10, 10-11, 10-12 and 10-13, serial.
- Catalogue copies, `served-operations.json`, `authorization-matrix.ts`: 10-10.
- `questionnaire-renderer.tsx`: 10-05 → 10-07.
- `questionnaire-governance.tsx`: 10-08 → 10-09.
- `questionnaire-revision-timeline.tsx`: 10-01 → 10-05 → 10-09.
- `questionnaire-generation-job.tsx`: 10-09 → 10-10.
- `assessment-detail.tsx`: 10-04 → 10-09 → 10-10.
- `assessment-editor.tsx`: 10-02 (copy) → 10-11 (`ControlReadOnly`) → 10-13 → 10-14.
- `released-assessment.tsx`: 10-02 → 10-11.
- `questionnaire-actions.ts`: 10-06 → 10-07.
- `request-actions.ts`: 10-06.
- `server-client.ts`: 10-06.
- `app-shell.tsx`: 10-01 → 10-07.
- `capability-navigation.tsx`: 10-07.
- `questionnaire-detail.tsx`: 10-02 (permission copy) → 10-05.
- `request-form.tsx`, `request-workflow-actions.tsx`, `request-hub.tsx`: 10-04.
- `assessment-draft-job.tsx`: 10-10.
- `csrm-authorization.ts` (`HUMAN_ANALYST_ONLY_OPERATIONS`): 10-10.
- `assessment-service.ts` (the `contractResponseParsers` list at `:114-164`): 10-11 → 10-13.
- `risk-details.tsx` (permission copy): 10-02; `risk-detail-editor.tsx`, `mitigation-control-list.tsx`: 10-13.
- The questionnaire and assessment-request controllers' error helpers: 10-06 → 10-09 → 10-10.

**Mapping to the roadmap success criteria:**
- SC1 (add in a new or existing section, form where clicked, focus): 10-08.
- SC2 (analyst request fields, actions refresh): 10-04.
- SC3 (autosave or warning, radio arrows): 10-07, 10-03.
- SC4 (typing pickers, date inputs, save confirmation): 10-13.
- SC5 (released controls and treatment): 10-11.
- SC6 (refusals not offered or truthful, local time and question text): 10-02, 10-04, 10-05, 10-06, 10-01, 10-09.

## E2E specs that change deliberately

| Spec and lines | Asserts today | Changed by | Change |
|----------------|---------------|------------|--------|
| `questionnaire-workflow.spec.ts:181-190` | The Requestor sees the analyst questionnaire page | 10-02 | Expect the permission state and no analyst link |
| `questionnaire-workflow.spec.ts:254` | `/cannot be undone|irreversible/i` | 10-05 | The new dialog copy |
| `questionnaire-workflow.spec.ts:227-231` | Save, "Draft saved.", reload | 10-07 | Keep, and make sure no autosave is pending before reload |
| `performance.spec.ts:116-117` | The read-only sentence as the populated guard | 10-05 | The new sentence |
| `requestor-request-workflow.spec.ts:219` | `/cannot be undone|irreversible/i` | 10-04 | The new copy; add the in-page submit-then-revert step |
| `questionnaire-generation-workflow.spec.ts:133-138` | "Generate questionnaire", "Replace the unanswered questionnaire?" | 10-09 | "Replace questionnaire" and the new dialog |
| `questionnaire-governance-workflow.spec.ts:117-121` | Add with defaults | 10-08 | Stays green if the top-level Add defaults to the last section |
| `questionnaire-governance-workflow.spec.ts:179-180` | The key `hosting-model` visible | 10-09 | The question text |
| `assessment-release-workflow.spec.ts:81, 181-192, 227-229` | The flat readiness list and "Met" rows | 10-14 | The per-risk summary; show met on demand |
| `assessment-release-workflow.spec.ts:205-212, 224-225` | Native selects for control and owner | 10-13 | Picker interactions |
| `assessment-release-workflow.spec.ts:315` | The Requestor sees the control id | 10-11 | The number and name, no id |
| `request-relationship-states.spec.ts:24, 97, 114` | "Contextual Risks by residual rating" | 10-04 | The new tile label |
| `risk-register-workflow.spec.ts:599-603` | The `Search reusable Controls` textbox | 10-13 | The picker combobox |
| `design-system-conformance.spec.ts:455` | Governance buttons `/^(Release questionnaire|Add question|Edit|Delete)\b/` | 10-08 | Check the per-section "Add question …" buttons still match their styling rule |

**Assertions that must keep passing**, which the plans must not break:
- the `Awaiting questionnaire submission` heading: `accessibility.spec.ts:270`, `questionnaire-workflow.spec.ts:305`;
- the `Request context` heading on the analyst hub: `accessibility.spec.ts:336`, `request-relationship-states.spec.ts:160`;
- the permission title on a cross-owner analyst route: `assessment-release-workflow.spec.ts:245`;
- no mutation controls on the released view: `:317-320`;
- the date-only submitted text: `requestor-request-workflow.spec.ts:225`;
- the analyst's return-to-draft confirmation before a questionnaire exists: `:244-249`;
- the draft precondition copy: `questionnaire-generation-workflow.spec.ts:130`.

Unit test files that assert changed copy or structure include `questionnaire-governance.test.tsx`, `questionnaire-revision-timeline.test.tsx` ("1 question added or changed"), `questionnaire-renderer.test.tsx`, `request-workflow.test.tsx`, `assessment-editor.test.tsx`, `released-assessment.test.tsx`, `states.test.tsx`, `questionnaire-generation-job.test.tsx`, `administration-workflow.test.tsx`, `risk-details.test.tsx` and `segmented-control.test.tsx`. Each plan greps its strings before editing.

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| No navigation blocking in the App Router | `Link onNavigate` with `preventDefault()` | Next 15.3.0 (`link.md` history table) | D-12 is supported without router hacks |
| Synchronous `cookies()` | Async `cookies()` (`await cookies()`) | Next 15+, documented in 16.3 | Helpers must be async |
| `revalidatePath` in a Server Action only marks the path | "Updates the UI immediately (if viewing the affected path)" | Documented in 16.3 | Autosave must not revalidate the current page |
| Inline-script local dates | Still documented, but needs a nonce under CSP | 16.3 guide | CSRM uses the cookie route instead |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | How Playwright disposes of a `beforeunload` dialog during `page.reload()` is not verified | Pitfall 6 | A reload step could hang or fail; mitigated by disarming the guard after save |
| A2 | Some assistive technologies and switch devices release arrow keys faster than the roving timeout | UAT-064 | None for correctness; the fix is deterministic either way |
| A3 | About 1.5 seconds of debounce is an acceptable autosave load on Strapi (a full answer batch per save) | D-11 | More writes than needed; tune within 1-2 seconds |
| A4 | Showing a request's current generation status to every human analyst is acceptable, because the queue bucket already reveals "in progress" | D-25 | If the operator wants initiator-only visibility, restrict the new read and show only "in progress" to others |
| A5 | The cookie name `csrm-time-zone`, a one-year max age and `SameSite=Lax` | Code example | Cosmetic; the planner may rename |

A4 is closed by D-47 (2026-09-27): every human Security Analyst sees a request's generation-job status, and Requestors never see the job (plans 10-13 and 10-14).

Two claims were assumptions in the first draft and were then verified from the installed sources, so they are not in the log:
- Strapi keeps `details` in the error body (`errors.js:52-64`).
- Radix runs the wrapper's key handler before its roving handler (`react-slot@1.3.3` `mergeProps`, `react-roving-focus@1.1.19:176`).

## Open Questions (RESOLVED)

**Resolved (2026-09-28, plan revision after `10-PLAN-CHECK.md`).** Every question below is settled by the plan or decision cited in its **Resolved** line; none is open for execution.

1. **The bound for `RiskTypeSummary.applicableControls`.** Known: the Administration input allows up to 1,000 applicable controls (`administration-schema.ts:132`). Unclear: whether the picker list should carry all of them. Recommendation: declare `maxItems: 1000` to match the input bound (no truncation logic), and show the first page in the picker.
   **Resolved:** plan 10-18 declares `maxItems: 1000` on `RiskTypeApplicableControl[]` in `RiskTypeSummary` and mirrors it in both closed parsers; the picker shows the suggested group, and typing searches the whole library a page at a time.
2. **Request-first scope in the Risk Register editor.** Known: the Risk detail carries its assessment, not its request. Recommendation: read the analyst assessment, then the request, only when the risk is mutable and the editor is open, and otherwise search only. The planner may drop request-first there if the two reads are unwelcome; ASSESS-06 criterion 1 names both editors.
   **Resolved:** plan 10-19 keeps request-first suggestions in the Risk Register editor: for a mutable Risk it reads the analyst assessment and then its request, and any failed read leaves the suggested groups empty so the editor searches only.
3. **The ISO theme in labels.** Known: the theme lives in `sourceData`, which is not projected. Recommendation: label untitled controls with number and framework now, and add the theme only if the operator's decision 15 keeps ISO titles out long-term.
   **Resolved:** D-42 (2026-09-27): an untitled control reads `{number} · {framework}` and the theme is not shown. D-46 then took decision 15: plan 10-22 loads the Annex A control names and descriptive titles for all 386 untitled seeded controls, so D-42 remains only as the fallback for a control that still has no title.
4. **The UI-SPEC.** The STATE planning method runs the UI-SPEC before research for UI phases. This run wrote CONTEXT and research first. Recommendation: produce `10-UI-SPEC.md` (exact copy for D-08, D-13, D-15, D-24, D-33, D-35, D-38; the save status; the picker; the readiness disclosure) before planning.
   **Resolved:** `10-UI-SPEC.md` was produced and approved before planning; its extensions X-1 to X-5 and its flagged readings were accepted by D-41 to D-45, and plan 10-01 records the extensions in the design direction.
5. **Observing a running job in E2E.** Deterministic jobs finish in about 1-2 seconds. Recommendation: component tests cover the queued and running rendering; Strapi integration covers the read; the journey asserts that the hub never offers a second Generate while a job is active, using a retrying expectation right after navigation, and tolerates completion.
   **Resolved:** plan 10-14's `UX06_JOB_STATUS_ON_RETURN` uses the retrying, completion-tolerant expectation; the queued and running states are proven by plan 10-14's component tests and plan 10-13's mounted read; the plan summary records which case the run observed.
6. **Storing labels without the number in the control seed.** Recommendation: not in Phase 10. The display rule covers seeded and imported data alike; revisit when licensed titles load.
   **Resolved:** D-42. The seed keeps storing `{number} — {label}`, the D-36 display rule strips the repeated number for seeded and imported controls alike, and D-42 fixes what a control with no title reads. The titles D-46 loads (plan 10-22) use the same stored-name format, so no seed format change is needed.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (via `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH"`) | All builds and tests | ✓ | v24.19.0 | - (the default Node 22 is incompatible with the native modules) |
| pnpm | Workspace commands | ✓ | 11.24.0 | - |
| Playwright Chromium | E2E | ✓ | chromium-1208 in `%LOCALAPPDATA%/ms-playwright`; `PLAYWRIGHT_BROWSERS_PATH` unset | - |
| better-sqlite3 (Strapi tests) | Strapi integration | ✓ | 12.8.0 (built for Node 24) | - |
| Dev Strapi (1337) and Next (3000) | Browser checks | ✓ running (orchestrator-owned) | - | Strapi suites, `served-operations:write` and Playwright wait until the orchestrator stops them |
| Hosted AI provider | Nothing in Phase 10 | Not used | - | Deterministic provider in every suite |

**Missing dependencies with no fallback:** none. **With fallback:** none needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Web: vitest 4.1.11 (jsdom) with Testing Library. Strapi: `node:test` over TypeScript compiled to `.tmp/tests-dist`. E2E: Playwright 1.58.2 on the production build |
| Config files | `apps/web/vitest.config.ts` (includes `src/**/*.test.{ts,tsx}`, 20 s timeouts); `apps/strapi/tests/tsconfig.json`; `apps/web/playwright.config.ts` (projects `desktop` 1440×900 and `mobile` 375×812 for `@journey` tests, one worker) |
| Quick run (web) | `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm --filter @csrm/web exec vitest run <path> [<path> …]`, with paths under `apps/web`. Not `pnpm --filter @csrm/web test -- <pattern>`: vitest ignores a pattern after `--` and runs the whole suite (recorded in `08-VALIDATION.md`, Test Infrastructure). |
| Quick run (Strapi, one file, dev servers stopped) | `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/strapi && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js`. The harness compiles the app itself (`compileStrapi`, `tests/helpers/strapi-http-harness.ts:443-447`) into the `dist` the dev Strapi shares, so the dev servers must be stopped. |
| Quick run (E2E, dev servers stopped) | `pnpm --filter @csrm/web test:e2e e2e/<spec>.spec.ts [--project desktop|mobile]`. Every run pays the production build first, so batch targeted specs per plan. |
| Contract | `pnpm --prefix apps/web api:check` (after `api:generate`) |
| Typecheck | `pnpm --filter @csrm/web typecheck` |
| Full suites | `pnpm --filter @csrm/web test` (about 20 s); `pnpm --filter @csrm/strapi test` (serial, about 9-13 minutes); `pnpm --filter @csrm/web test:e2e` (about 11-15 minutes, dev servers stopped, run in the background) |

### Phase Requirements → Test Map
| Req ID | Behaviour | Test type | Automated command (target) | File exists? |
|--------|-----------|-----------|----------------------------|--------------|
| REQ-07 | The analyst sees the third-party and regulatory fields in the form's groups | unit | `pnpm --filter @csrm/web exec vitest run src/features/requests/request-hub.test.tsx` (or a new `request-context-details.test.tsx`) | ✅ / ❌ new component test |
| REQ-07 | Actions refresh after a return to draft in the same session | unit, E2E | `pnpm --filter @csrm/web exec vitest run src/features/requests/request-workflow.test.tsx`; `requestor-request-workflow.spec.ts` | ✅ (extend) |
| QUES-08 | Add to an existing and a new section of a generated questionnaire | unit, Strapi, E2E | new `questionnaire-placement.test.ts`; `questionnaire-governance.integration.test.ts`; `questionnaire-generation-workflow.spec.ts` or governance spec | ❌ placement test / ✅ others |
| QUES-08 | The form opens in place with focus; errors inside the form | unit, E2E | `questionnaire-governance.test.tsx`; governance spec at 1440 and 375 | ✅ (extend) |
| QUES-08 | Replace states the discard count; a `regenerated` event; refused while released | Strapi, unit, E2E | `questionnaire-generation.integration.test.ts`, `questionnaire-governance.unit.test.ts`; `questionnaire-generation-job.test.tsx`; generation spec | ✅ (extend) |
| QUES-08 | Released questions read-only with the answered count, no content | unit, E2E | `questionnaire-workflow.test.tsx` or `questionnaire-governance.test.tsx`; governance spec | ✅ (extend) |
| QUES-09 | Autosave and the leave warning | unit, E2E | new `use-answer-autosave.test.tsx`, `navigation-guard.test.tsx`; `questionnaire-workflow.spec.ts` step | ❌ new |
| QUES-09 | Introduction; attention list after a submit attempt, in form order | unit, E2E | `questionnaire-renderer.test.tsx`, `questionnaire-workflow.test.tsx`; questionnaire spec | ✅ (extend) |
| QUES-09 | Arrow keys select | unit, E2E | new `radio-group.test.tsx`; `segmented-control.test.tsx`; questionnaire spec `press('ArrowDown')` | ❌ radio test |
| QUES-09 | Submission copy matches the actions | unit, E2E | `questionnaire-renderer.test.tsx`; questionnaire spec | ✅ (extend) |
| ASSESS-06 | Searchable control, system, asset and owner pickers; request and applicable first | unit, Strapi, E2E | new `relation-picker.test.tsx`; `assessment-editor.test.tsx`, `risk-details.test.tsx`; the Strapi Risk Type picker list test; release and register specs | ❌ picker test / ✅ others |
| ASSESS-06 | Exemption review via the date input, round trip | unit | `assessment-editor.test.tsx`, `risk-details.test.tsx` | ✅ (extend) |
| ASSESS-06 | Save confirmation | unit, E2E | `assessment-editor.test.tsx`; release spec | ✅ (extend) |
| ASSESS-06 | Readiness summary per risk; met on demand | unit, E2E | new `release-readiness-summary.test.ts`; `assessment-editor.test.tsx`; release spec | ❌ domain test |
| ASSESS-07 | The released view names controls and shows treatment, owners and dates | Strapi, unit, E2E | `assessment-workflow.integration.test.ts`; `released-assessment.test.tsx`; release spec | ✅ (extend) |
| ADMIN-05 | Owner name and columns; control label rule; APP titles and Risk Type text | Strapi, unit, E2E | `administration.integration.test.ts`, `assessment-seed.integration.test.ts`; new `control-label.test.ts`; `administration-workflow.test.tsx`; administration spec | ❌ label test / ✅ others |
| UX-06 | Reason codes with plain messages; web and spec enums equal | Strapi, unit | new `conflict-reasons.integration.test.ts` or extensions of `request-workflow.integration.test.ts` and `questionnaire-*.integration.test.ts`; new `conflict-reason.test.ts` (transport and parity) | ❌ new |
| UX-06 | The generation read by request; panels seeded; matrix row | Strapi, unit, E2E | `questionnaire-generation.unit.test.ts`; new integration test; `authorization-matrix.integration.test.ts`; `served-operations.integration.test.ts`; `questionnaire-generation-job.test.tsx` | ✅ / ❌ new integration |
| UX-06 | Local time and question text in timelines | unit, E2E | new `format-instant.test.ts`; `questionnaire-revision-timeline.test.tsx`; governance spec with `timezoneId` | ❌ formatter test |
| UX-06 | Plain copy (no internal terms on Phase 10 surfaces) | unit (source scan) | new copy guard test beside `zod-client-boundary.test.ts` | ❌ new |
| UX-06 | A Requestor on analyst routes sees the permission state | unit, E2E | route page tests; `assessment-navigation-lifecycle.spec.ts` or a new spec | ✅ / ❌ new steps |

### Sampling Rate
- **Per task commit:** the targeted web vitest file(s), plus `pnpm --filter @csrm/web typecheck` when types change. For Strapi edits, the targeted Strapi file only when the dev servers are stopped; otherwise record it as pending for the wave gate. `api:check` after any spec change.
- **Per wave merge:** the full web unit suite, typecheck and `api:check`. The full Strapi suite for waves that touch Strapi (dev servers stopped).
- **Phase gate:** all five commands, with ports 1337 and 3000 free. That is web unit, web typecheck, `api:check`, the Strapi suite, and Playwright in both projects on the production build. Afterwards, before `/gsd-verify-work`:
  - `git status --porcelain` is empty;
  - the schema freeze check prints nothing: `git diff --name-only 98fe99c..HEAD -- 'apps/strapi/src/api/*/content-types/*'` (`98fe99c` is the CONTEXT commit, before any Phase 10 code);
  - `cmp` of the two catalogue copies is silent.

### Wave 0 Gaps
- [ ] `apps/web/src/lib/time/format-instant.test.ts`: covers UX-06 criterion 3 (zones, UTC label rule).
- [ ] `apps/web/src/components/ui/radio-group.test.tsx`: covers QUES-09 criterion 3 (quick press selects).
- [ ] `apps/web/src/features/questionnaires/questionnaire-placement.test.ts`: covers QUES-08 criterion 1 (three real section shapes, removed questions).
- [ ] `apps/web/src/features/questionnaires/use-answer-autosave.test.tsx` and a navigation-guard test: cover QUES-09 criterion 1.
- [ ] `apps/web/src/components/csrm/relation-picker.test.tsx`: covers ASSESS-06 criterion 1.
- [ ] `apps/web/src/features/assessments/release-readiness-summary.test.ts` and `control-label.test.ts`: cover ASSESS-06 criterion 4 and ADMIN-05.
- [ ] A conflict-reason transport and enum-parity test: covers UX-06 criterion 1.
- [ ] A Strapi integration file for the generation-jobs read (or extend `questionnaire-generation.integration.test.ts`), plus the matrix row and the served-operations inventory.
- [ ] E2E fixtures: new journeys create their own records through the UI (as `questionnaire-generation-workflow.spec.ts` does) and never reuse the one-shot seeded fixtures of the questionnaire and release journeys.

No framework installs are needed.

## Security Domain

### Applicable ASVS Categories

| ASVS category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | No change | Development sign-in only; Keycloak deferred (INT-02) |
| V3 Session management | Minor | The time-zone cookie is non-sensitive (`SameSite=Lax`, no PII, not used for authorization); the session cookie is unchanged |
| V4 Access control | Yes | The analyst route gate is presentation only; the new read is human-analyst-only through an exact grant and the human-analyst guard; record checks in Strapi; the released risk facts go only to the owning Requestor through the existing release and ownership checks (404 for others) |
| V5 Validation, sanitisation and encoding | Yes | Closed Zod parsers on new responses; the time-zone value validated as IANA and length-bounded; the placement payload validated by the existing definition parser; the reason enum closed; question-text snapshots rendered as text (React escaping), bounded to 500 characters |
| V7 Error handling and logging | Yes | Reason codes in `details` only, with no stack or internal message; the generic 500 envelope unchanged (08 D-20) |
| V8 Data protection | Yes | Draft answers never cross to analysts (count only, D-07); autosave does not widen exposure; owner display names on released risks go to the owning Requestor, as released assessments already name the analysts |
| V13 API | Yes | The new endpoint and schemas are in the spec; the served-operations inventory and the authorization matrix cover the new route |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| A Requestor probes analyst routes for their own records | Elevation of privilege and information disclosure | Page gate before reads (D-23); Strapi refuses analyst operations regardless |
| A reason code discloses an unreleased questionnaire | Information disclosure | Actor-neutral codes (Pitfall 11) |
| The service agent reads job status | Elevation of privilege | Human-analyst-only guard plus the matrix row asserting refusal |
| A forged time-zone cookie causes a `RangeError` or odd output | Tampering and denial of service | Validation with fallback to UTC; never echo raw input except a validated zone |
| A cross-origin Server Action for the time-zone sync | Tampering | Next's origin check for Server Actions (08 D-48); the action has no side effect beyond the caller's own cookie |
| Regenerated AI questions reach the Requestor unreviewed | Tampering with a workflow invariant | Refuse replacement while released (D-09), with an integration proof |
| Stale or partial contract parsing | Tampering and repudiation | The parity guard in five modes; closed enums on both sides in one plan |

## Sources

### Primary (HIGH confidence)
- Repository source read this session: every `[VERIFIED: path:lines]` citation above.
- `docs/references/specification.json` at lines 24905-24908, 24918-24935, 25793-25815 and 25824-25845, read this session.
- Next 16.3.6 bundled docs: `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` (`onNavigate`, "Blocking navigation"), `.../02-guides/preventing-flash-before-hydration.md`, `.../03-api-reference/04-functions/revalidatePath.md`, `.../03-api-reference/04-functions/cookies.md`.
- Installed Radix sources: `@radix-ui/react-radio-group` 1.4.7 `dist/index.mjs:96-108, 324, 336-375`; `@radix-ui/react-roving-focus` 1.1.19 `dist/index.mjs:172-198`; `@radix-ui/react-slot` 1.3.3 `dist/index.mjs:81-95` (the version the radio primitive resolves through `react-primitive`); `@radix-ui/primitive` 1.1.7 `dist/index.mjs:6-13`.
- Installed Strapi core 5.51.0: `dist/services/server/koa.js:16-28`; `dist/services/errors.js:52-64`.

### Secondary (MEDIUM confidence)
- W3C WAI-ARIA Authoring Practices, Radio Group pattern (keyboard interaction), https://www.w3.org/WAI/ARIA/apg/patterns/radio/, fetched this session.

### Tertiary (LOW confidence)
- None relied on.

## Metadata

**Confidence breakdown:**
- **Root causes and file references:** HIGH. Every cause was read, with values quoted verbatim.
- **Contract changes:** HIGH for the current shapes (read); MEDIUM for the proposed shapes, which are recommendations the planner may refine within D-03.
- **Framework behaviour:** HIGH for Next (bundled docs for the installed version), Strapi's error envelope (installed `@strapi/core` 5.51.0 source) and Radix handler order (installed `react-slot` 1.3.3, `react-roving-focus` 1.1.19, `react-radio-group` 1.4.7 and `primitive` 1.1.7 sources).
- **Pitfalls and E2E exposure:** HIGH (spec lines read); the `beforeunload` behaviour in Playwright is marked [ASSUMED].

**Research date:** 2026-09-27
**Valid until:** 2026-10-27, or until any of the hot files above changes (re-run the plan check before execution, per the STATE planning method).
