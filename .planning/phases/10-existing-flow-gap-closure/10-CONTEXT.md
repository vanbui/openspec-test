# Phase 10: Existing-flow gap closure - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning
**Mode:** discuss-phase `--auto`. Every gray area was resolved with the recommended option, grounded in the product gap UAT (`.planning/uat/product-gaps/`), the three STATE.md decisions dated 2026-09-27, the orchestrator's seeded decisions, and a read of the code each finding names. There is no SPEC.md for this phase. The discussion log is `10-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

Make today's request, questionnaire, assessment and administration screens work as they say, so the existing flow completes without workarounds, lost input or misleading messages. The phase closes 23 findings (UAT-005, UAT-006, UAT-007, UAT-009, UAT-010, UAT-011, UAT-015, UAT-016, UAT-019, UAT-020, UAT-021, UAT-022, UAT-023, UAT-024, UAT-033, UAT-034, UAT-036, UAT-037, UAT-041, UAT-053, UAT-054, UAT-062, UAT-064) and delivers REQ-07, QUES-08, QUES-09, ASSESS-06, ASSESS-07, ADMIN-05 and UX-06.

In scope: fixing and completing the existing screens, the API changes those fixes need through the established contract pattern, seeded reference-data text, and the tests that prove each fix.

Out of scope: any Strapi content-type schema change; new capabilities that belong to Phases 11-22 (sidebar and landing, AI context and provenance, assignment and notes, attachments, AI steering and re-runs, risk withdrawal, the requestor response stage, the risk table, export, registers, metrics, the Admin role); Keycloak; live AI generation.
</domain>

<decisions>
## Implementation Decisions

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
### Orchestrator Decisions After the Plan Check (2026-09-27)

The plan check (`10-PLAN-CHECK.md`) found one blocker: the plans adopted readings of D-36 and D-38 and five design extensions that nobody had accepted. The orchestrator decides them here. The plans already implement each accepted reading, so no plan changes for this blocker.

- **D-41:** The five extensions the UI-SPEC proposes are accepted as written: X-1 save status, X-2 record picker, X-3 dates and times, X-4 separators, X-5 in-place edit form. Each names a pattern over existing tokens and introduces no value, and X-1, X-2 and X-5 codify patterns the app already ships. Plan 10-01 records them in `docs/design/csrm-design-direction.md` as recorded CSRM extensions dated 2026-09-27, before any plan uses them.
- **D-42 (amends D-36):** An untitled control reads `{number} · {framework}`. The catalogue theme is not shown. It lives only in the control's unprojected `sourceData`, serving it would be an eighth API change that D-03 excludes, and the real remedy for untitled controls is loading titles, which waits for the operator's decision 15. Show the theme when that decision is taken, if the control still has no title.
- **D-43 (clarifies D-38):** D-38's spaced hyphen replaces the em dash in prose. A spaced middle dot joins an identifier to a name or a second fact (X-4), because identifiers such as `RAR-2026-5WWFVQ` and `ACCESS-1a` contain hyphens. Stored data is shown verbatim.
- **D-44 (widens D-36's title fix):** All thirteen Australian Privacy Principle titles take sentence case, matching Schedule 1 of the Privacy Act, and the title fragments that leaked into nine `legalText` values are removed (UI-D22). The manual check against Schedule 1 in `10-VALIDATION.md` stays.
- **D-45:** The Risk detail's safe-state header reads "View a Risk and the controls that mitigate it." (10-21 Task 2). It replaces a string the copy guard rejects, and the UI-SPEC did not list it.

The plan check's warnings are not decided here. They go back to the planner as a targeted revision, followed by a fresh plan check (STATE.md, Next Action).

### Delegated Decisions That Change This Phase (2026-09-27)

The operator delegated the product decisions (`.planning/NEXT-WAVE-DECISIONS.md`). Three change Phase 10's plans; the planner applies them in the revision that also answers `10-PLAN-CHECK.md`.

- **D-46 (decision 15; replaces the deferral in D-36 and keeps D-42 only as a fallback):** Control titles load in this phase, as seed data:
  - **Where the framework names the control:** use that name, for example ISO/IEC 27001:2022 Annex A control titles, Essential Eight strategy names and Australian Privacy Principle titles.
  - **Paragraph-level requirements** (APRA CPS 234 and CPS 230 paragraphs, PSPF requirements): write a short descriptive title in CSRM's own words, and check each one against the paragraph it summarises.
  - **Source and body text:** keep the source reference (standard, clause or paragraph), and never load the body text of ISO standards.
  - **Fallback:** a control that still has no title, such as one imported later, reads `{number} · {framework}` (D-42).
  - **Plans:** the titles reach the dev database on the next seeded Strapi start, as 10-17's corrections do.
  - **Proof:** tests assert that no seeded control is left untitled, and a picker search finds a control by a word from its title.
- **D-47 (confirms D-25; G-6):** Every human Security Analyst sees a request's generation-job status, and research assumption A4 is closed. Requestors never see the job.
- **D-48 (G-6):** The Playwright rule follows Phase 8 D-12: a run leaves the tree clean, and a dirty tree afterwards is a harness defect to log, not something to restore. The plans drop the `git checkout -- apps/web/next-env.d.ts apps/web/tsconfig.json` step and assert a clean tree instead.

The operator decisions this phase listed as open are settled: decision 15 by D-46, and the answered-count rule (D-07) stands as decided.

</decisions>

<operator_decisions>
## Operator Decisions This Phase Depends On

The eighteen decisions are in `.planning/uat/product-gaps/REPORT.md` §9. Until the operator decides, the plans adopt the defaults recorded in STATE.md (Decisions, 2026-09-27). A different operator answer changes only the listed tasks.

| Operator decision | Default adopted | Decisions and findings that depend on it |
|---|---|---|
| Phase 10: whether analysts see the Requestor's progress before submission (`REPORT.md` §8, Phase 10 "Operator decisions before planning") | The analyst sees the answered count, never answer content | D-07 (UAT-020) |
| #15 Control library content and licensing | Licensed titles where allowed, otherwise short descriptive titles. Phase 10 fixes the display and the public APP titles; loading licensed or descriptive titles waits | D-36 (UAT-007) |
| #1 Admin role scope | Reference data and configuration, plus a read-only view of role holders; analysts keep read access | D-29: the control picker reuses the Administration control search, and Phase 22 must keep analysts' read grant |
| #4 How an AI re-run treats answered questions and analyst edits | Additions and changes to unanswered questions only; analyst edits protected | D-08, D-09, D-10: Phase 10 keeps whole replacement for unanswered, unreleased questionnaires and makes its cost visible; Phase 15 adds proposals |
| #7 The risk table approach | Research spike, leaning to extending the DataTable | D-28, D-33, D-35: the card editor changes are built from shared parts (pickers, date field, save status, readiness summary) that the Phase 18 table can reuse |
| #17 Explicit review step | Explicit "Mark reviewed" in Phase 17 | D-35: the readiness summary does not change the save-driven review (06.8 D-04, D-13) |
| #10 Pick-up and assignment | Self and lead assignment, non-exclusive | D-25 to D-27: Phase 10 reads jobs by request; Phase 13 widens job access with assignment |

No other open decision affects Phase 10.
</operator_decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and intent
- `.planning/uat/product-gaps/FINDINGS.md`: the 23 findings in full (steps, expected, actual, evidence, recommendation).
- `.planning/uat/product-gaps/REPORT.md` §3 (intended product status), §8 (Phase 10 proposal), §9 (operator decisions).
- `.planning/uat/product-gaps/JOURNEYS.md`, areas 2, 3, 4, 10 and 11: the observed behaviour behind each finding.
- `.planning/uat/product-gaps/evidence/`: `a2-add-question-409-error.jpg`, `a2-question-editor-form-offscreen.jpg`, `a2-analyst-request-context-missing-fields.jpg`, `a2-requestor-questionnaire-first-screen.jpg`, `a2-released-view-control-id.jpg`, `a3-refusal-misleading-message-375.jpg`, `a5-system-owner-shown-as-id.jpg`, `a7-risk-card-dates-utc-hint.jpg`, `a7-ten-risk-editor-readiness-146.jpg`.
- `.planning/uat/product-gaps/BRIEF.md` Appendix A: the operator's intended product (F1, F4, F5, F7, F9, F10, O2, Q5, R3).

### Planning authority
- `.planning/ROADMAP.md` Phase 10: goal, six success criteria, contract and datamodel line.
- `.planning/REQUIREMENTS.md` Next-wave Requirements: REQ-07, QUES-08, QUES-09, ASSESS-06, ASSESS-07, ADMIN-05, UX-06 (acceptance criteria and traces).
- `.planning/STATE.md` Decisions, 2026-09-27 (next wave, planning defaults, planning method), plus the locked decisions this phase must respect: 06.8 D-05, D-13, D-15; 06.9 D-2 to D-4; 07 D-07, D-16; 08 D-12, D-19, D-27, D-36; and "Notes carried forward".
- `.planning/phases/06.8-workflow-visibility-and-questionnaire-governance/06.8-CONTEXT.md`: governance, release gate and revision timeline decisions.
- `.planning/phases/08-production-integration-and-hardening/08-CONTEXT.md`: contract, parity, matrix and harness decisions.

### Product and domain
- `docs/CSRM-PROJECT-BRIEF.md` §7 (questionnaire: autosave or explicit save draft), §8 (risk assessment content, released read-only view), §21 (accessibility), §28 (protect against loss of unsaved work), §33 (do not expose the data model).
- `docs/references/idambox-datamodel.jdl`: `CsrmQuestion.helpText`, `CsrmInformationAsset` (no owner), `CsrmControl`, `CsrmRisk` fields.
- `CONTEXT.md` (repository root): the "Released" glossary entry.

### Contract and authorization
- `docs/references/specification.json`: `QuestionnaireQuestionMutationRequest`, `QuestionnaireGovernanceEvent`, `QuestionnaireRevisionTimelineEvent`, `QuestionnaireWorkflowErrorResponse`, `AssessmentWorkflowErrorResponse`, `RiskSummary`, `ControlImplementationSummary`, `RiskTypeSummary`, `RiskDetailControl`, `QuestionnaireGenerationJob`, and the Administration Information System schemas.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`: byte-identical grant catalogue copies; the `function.questionnaire_generation.*` API-only Functions are the pattern for D-25.
- `docs/references/served-operations.json`: the served inventory the web chain guard reads.
- `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md`: the governance-log envelope D-01 amends.
- `docs/contract-gaps/phase-04-deterministic-draft-jobs.md` and `docs/contract-gaps/phase-06.2-questionnaire-generation-provenance.md`: the job registry contracts D-25 extends.
- `apps/strapi/src/policies/csrm-authorization.ts`: grant enforcement and the human-analyst guard.
- `apps/web/src/features/contract-response-parity.test.ts` and `apps/web/src/features/contract-operation-chain.test.ts`: the parser and chain guards.
- `apps/strapi/tests/fixtures/authorization-matrix.ts`: the six-actor matrix rows.

### Design and framework
- `docs/design/csrm-design-direction.md`: every UI value; the voice (§2 BProton "Voice"), Forms (radio and segmented control keyboard behaviour), Dialogs, Toasts, Empty states and record links.
- `docs/adr/0001-adopt-bproton-design-system.md`: the adopted system and its gap decisions.
- `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` ("Blocking navigation", `onNavigate`): the D-12 mechanism.
- `apps/web/node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`: time-zone formatting options behind D-19.
- `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` and `cookies.md`: Server Action revalidation and cookie behaviour (D-11, D-19).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/features/assessments/owner-combobox.tsx`: `OwnerCombobox`, the single user picker, and `RelationMultiSelect`, the bounded multi picker. With `RelationCombobox` in `apps/web/src/features/risks/risk-register-filters.tsx` they are the established server-backed combobox pattern that D-28 generalises into one single-record picker.
- `apps/web/src/features/requests/request-service.ts`: `searchInformationSystems` and `searchInformationAssets` (a bounded selector page of 25) and `hydrate…Selections` (labels for selected ids); `request-actions.ts` exposes the search actions.
- `apps/web/src/features/administration/administration-service.ts`: the Administration control list with `q` (server-side match on number, name and framework). `searchApplicableControlsAction` today filters the full library in the action and should move to the server-side search.
- `apps/web/src/components/states/states.tsx`: shared state primitives with locked headings (`PermissionDeniedState`, `ErrorState`, `EmptyState`).
- `apps/web/src/components/csrm/confirm-dialog.tsx`: every confirmation dialog, reason field included.
- `apps/web/src/features/questionnaires/questionnaire-domain.ts`: `orderQuestionnaire` (section, then question order), the correct order for the attention list.
- `apps/web/src/features/assessments/questionnaire-generation-job.tsx` and `assessment-draft-job.tsx`: both already accept `initialJob`, but no caller passes one.
- `apps/web/src/lib/metadata/record-route-metadata.ts`: route titles resolved through the page's cached read.
- The Risk Register's save messages ("Risk changes saved.", "Mitigation control changes saved.") in `apps/web/src/features/risks/risk-details.tsx`: an existing save-status pattern (an `sr-only` live region there; D-33 needs a visible one).
- `apps/web/src/components/csrm/status-badge.tsx` (`statusPresentation`), `record-link.tsx`, `page-header.tsx`, `detail-section.tsx`, `form-section.tsx`.

### Established Patterns
- Typed openapi-fetch service modules and Server Actions only; the chain guard forbids raw fetch and unlisted operations.
- Client components read vocabularies from zod-free `*-domain.ts` modules (08-13, D-24), and `zod-client-boundary.test.ts` guards the key routes. New predicates and label rules belong in domain modules.
- Record-level states: absent, unavailable and available read differently (06.4). Actions must use `relationships`, not the legacy nullable fields.
- The analyst dashboard gates on `assessment:review` before any read (`app/(app)/app/review/(analyst-dashboard)/page.tsx`). The three analyst detail routes do not, which is the root cause of UAT-062.
- Strapi answers an unauthorised assessment read with 404. Denials keep persistence deep-equal (08 D-16).
- The questionnaire definition parser (Strapi `questionnaire-definition.ts:174-207`, mirrored in `questionnaire-schema.ts`) requires one section per order, identical metadata per section key, and unique question order per section, across all questions including removed ones.
- The governance log is append-only with a closed event vocabulary. Read paths omit unknown kinds, but the web parsers use closed enums, so a new kind must ship on both sides in one plan.
- The job registries are process-local, de-duplicate active jobs per request (questionnaire) or questionnaire (draft), and authorise reads to the initiating analyst only (`canReadAll…: false`).

### Integration Points
- **Questionnaire:** `questionnaire-governance.tsx`, `questionnaire-review.tsx`, `questionnaire-revision-timeline.tsx`, `questionnaire-detail.tsx`, `questionnaire-renderer.tsx`, `questionnaire-actions.ts` and `questionnaire-service.ts`. On the Strapi side, `questionnaire-governance-workflow.ts`, `questionnaire-generation-workflow.ts`, `questionnaire-governance-log.ts`, `questionnaire-scope.ts` and the questionnaire controller.
- **Request:** `request-workflow-actions.tsx`, `request-actions.ts`, `request-domain.ts`, `request-hub.tsx`, `assessment-detail.tsx` (the analyst hub) and the two request route pages. On the Strapi side, `request-workflow.ts` and the request controller.
- **Assessment:** `assessment-editor.tsx`, `risk-editor.tsx`, `control-implementation-editor.tsx`, `released-assessment.tsx`, `assessment-schema.ts` and `assessment-service.ts`. On the Risk Register, `risk-detail-editor.tsx` and `mitigation-control-list.tsx`. On the Strapi side, `assessment-scope.ts` projections and the `csrm-risk` controller picker handlers.
- **Administration:** `administration-form.tsx`, `administration-workspace.tsx`, `csv-import-flow.tsx` and `csv-client-parser.ts`. On the Strapi side, `administration-query.ts`, `csv-import.ts`, `bootstrap/seed-assessment-workflow.ts` and `bootstrap/controls/privacy-act-app-ndb-2026-06-04.json`.
- **Shell and transport:** `app/(app)/layout.tsx` and `components/shell/app-shell.tsx` for the time-zone cookie sync and the navigation-guard provider; `components/shell/capability-navigation.tsx` for guarded links; `lib/api/transport/server-client.ts` for the conflict reason on `TransportError`.
</code_context>

<specifics>
## Specific Ideas

- **UAT-016 without a live model:** the deterministic questionnaire provider already builds a `context` section at order 0, so adding a question to a deterministically generated questionnaire in the E2E harness reproduces UAT-016. The UAT-A scenario used the hosted provider (sections `section-1` … at orders 0-5).
- **The UAT scenarios as fixtures:** UAT-A (payroll SaaS, Project), UAT-B (partner API, BAU, at 375) and UAT-C (external AI service, Other, second Requestor) are the baseline scenarios to re-run after the phase (`REPORT.md` §12). Their records live in the operator's development database and must not be changed by tests.
- **UAT-062 copy continuity:** the analyst route gate must keep the copy that `assessment-release-workflow.spec.ts:245` asserts ("You don't have permission to review this request") by rendering the route's existing permission state.
- **Seed changes and the dev database:** the D-36 seed corrections reach the operator's development database only when the orchestrator restarts Strapi. Tests use their own databases.
</specifics>

<deferred>
## Deferred Ideas

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
</deferred>

---

*Phase: 10-existing-flow-gap-closure*
*Context gathered: 2026-09-27*
