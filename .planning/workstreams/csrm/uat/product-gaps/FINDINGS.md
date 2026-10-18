# CSRM Product Gap UAT — Findings Register

65 findings. By type: Gap 21, Defect 26, UX 18, Improvement 0. By severity: blocker 0, major 31, minor 33, cosmetic 1. Severity is judged against the intended product (see `BRIEF.md`). Findings are grouped by area, most severe first. `FINDINGS.csv` holds the same register, one row per finding.

| Type | blocker | major | minor | cosmetic | Total |
|---|---:|---:|---:|---:|---:|
| Gap | 0 | 20 | 1 | 0 | 21 |
| Defect | 0 | 9 | 16 | 1 | 26 |
| UX | 0 | 2 | 16 | 0 | 18 |
| Improvement | 0 | 0 | 0 | 0 | 0 |
| Total | 0 | 31 | 33 | 1 | 65 |

## Contents

- [Request intake](#request-intake) (3)
- [Questionnaire](#questionnaire) (6)
- [AI assistance](#ai-assistance) (12)
- [Assessment and risks](#assessment-and-risks) (5)
- [Controls and residual risk](#controls-and-residual-risk) (2)
- [Release](#release) (3)
- [Collaboration and attachments](#collaboration-and-attachments) (2)
- [Registers and lists](#registers-and-lists) (6)
- [Dashboards and reports](#dashboards-and-reports) (7)
- [Navigation](#navigation) (1)
- [CSV](#csv) (4)
- [Risk table](#risk-table) (3)
- [Roles and administration](#roles-and-administration) (1)
- [Accessibility and responsiveness](#accessibility-and-responsiveness) (4)
- [Security](#security) (1)
- [Content](#content) (5)

## Request intake

### UAT-014 Analysts cannot pick up, claim or assign a request, and generation jobs are readable only by the analyst who started them

**Gap** · **major** · request intake · Intent: F2, R2

- **Actors:** Security Analyst
- **Route:** /app/review/requests, /app/review/requests/{id}
- **Steps:** Open the review queue and the UAT-A request as Bob and look for "pick up", "assign" or an owner.
- **Expected:** "An analyst picks up the ticket" (F2), so the team can see who is working on what.
- **Actual:** One shared queue ("Requires my attention", 10 requests) with columns Request, Title, Status and Submitted. No assignee column, filter or action; the hub's "OWNER" is the requestor. The data model has no assignee relation. The job registries let only the initiating analyst read or retry a generation or draft job, so a colleague who picks up the work cannot see a job another analyst started (inferred from code: `canReadAllDraftJobs:false`).
- **Evidence:** queue and hub as Bob (JOURNEYS.md, F2); JDL request relations (requestor, sponsor, revertedBy only).
- **Recommendation:** Add an assigned-analyst relation with "Pick up", "Assign to" and "Release back to queue", an "Assigned to me" queue, and assignee on lists and dashboards; let any analyst on the request read its jobs.
- **Impact:** Datamodel (frozen: assignee relation on the request; contract-gap record); API (assign and unassign operations, queue filter); operator decision (self-assignment only, or a lead assigns; whether assignment restricts editing).
- **Related:** 06.8 D-12 (status-based queue); STATE L133; Phase 7 gap item 3 (per-analyst state); O-5 (no separation of duties).
- **Proposed phase:** Phase 13: Request pick-up and notes

### UAT-015 The analyst's view of a request hides its third-party details and regulatory requirements

**Defect** · **major** · request intake · Intent: F2, F3

- **Actors:** Security Analyst
- **Route:** /app/review/requests/{id}
- **Steps:** Submit UAT-A with Third-party involvement, Third-party details (vendor, sub-processor, nightly file transfer, vendor MFA) and Regulatory requirements (Privacy Act, tax file number rules, data residency). Open it as Bob.
- **Expected:** The analyst reviews everything the requestor submitted.
- **Actual:** The analyst's "Request context" shows Description, Business purpose, Division, Business unit, Business criticality and Submitted date only. Third-party involvement, Third-party details and Regulatory requirements do not appear anywhere on the analyst page (text search: no "THIRD-PARTY", "SFTP" or "Privacy Act"), although Jane sees them on her own page.
- **Evidence:** evidence/a2-analyst-request-context-missing-fields.jpg
- **Recommendation:** Show every submitted field to the analyst, grouped as the requestor entered them, and include regulatory requirements in the AI context (see UAT-030).
- **Impact:** UI only.
- **Related:** REQ-02, ASSESS-01, 06.8 request hub.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-037 After returning a request to draft, the page keeps the old actions until it is reloaded

**Defect** · **minor** · request intake · Intent: F1

- **Actors:** Requestor
- **Route:** /app/requests/{id}
- **Steps:** As Jane, "Return to draft" on the submitted UAT-B request with a reason.
- **Expected:** The page shows the draft actions (Edit request, Submit request).
- **Actual:** The header changed to "Draft" but the page still showed "Return to draft" and no "Edit request" or "Submit request". A manual reload showed the right actions.
- **Evidence:** JOURNEYS.md area 3, row "Submit, return to draft, resubmit".
- **Recommendation:** Refresh the request's actions after the transition (the questionnaire's return-to-draft already does).
- **Impact:** UI only.
- **Related:** REQ-06, 06.1-03.
- **Proposed phase:** Phase 10: Existing-flow gap closure

## Questionnaire

### UAT-016 Adding a question to an AI-generated questionnaire always fails with a misleading "changed, reload" error

**Defect** · **major** · questionnaire · Intent: F4, A2

- **Actors:** Security Analyst
- **Route:** /app/review/questionnaires/{id} (analyst review)
- **Steps:** Generate the UAT-A questionnaire, click "Add question", enter a question, answer type and section title (tried an existing section title, a new one, and later "Offshore support" after Return to review), and save.
- **Expected:** The question is added to the chosen section (F4 "add more"; A2 "more questions will usually be needed").
- **Actual:** Every attempt (four) returned HTTP 409 and the message "This questionnaire changed or cannot be governed in its current state. Reload and try again." Reloading does not help. The message appears at the top of the editor (page y 323) while the Save button is at y 2,897, so nothing seems to happen. Editing and deleting generated questions works. Cause (inferred from code): the add form always sends section key `general` at section order 0 whatever title is typed (`questionnaire-governance.tsx` blank question), which collides with generated sections keyed `section-1` … at orders 0–5, so the server's definition validation rejects it.
- **Evidence:** evidence/a2-add-question-409-error.jpg; Strapi log `POST /api/v1/questionnaires/yzihv8dxcdwt37ugji8sn0k9/questions … 409` at 15:46:55 and three later times.
- **Recommendation:** Let the analyst pick an existing section or name a new one, send that section's key and next order, and show errors beside the form.
- **Impact:** UI only.
- **Related:** 06.8-04 (question add), 06.8-05 (governance interface); QUES-07.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-021 Unsaved questionnaire answers are lost without warning when the requestor leaves the page

**Defect** · **major** · questionnaire · Intent: F5, Q5, brief §28

- **Actors:** Requestor
- **Route:** /app/questionnaires/{id}
- **Steps:** Type an answer into a long-text question and click a sidebar link without pressing "Save draft"; return.
- **Expected:** A prompt before leaving with unsaved changes, or autosave ("protect against accidental loss of unsaved work where reasonable", brief §28; §7 "autosave or explicit Save Draft").
- **Actual:** No prompt; the typed answer was gone on return. Saved answers were intact. The UAT-A questionnaire has 11 long-text questions, so a requestor can lose a lot of work.
- **Evidence:** JOURNEYS.md area 2, row "F5 answer part" (q-7 typed, sidebar navigation, empty on return; no dialog event).
- **Recommendation:** Autosave drafts (debounced) with a visible "Saved" state, and warn on navigation while changes are unsaved.
- **Impact:** UI only.
- **Related:** QUES-03.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-005 Add question and Edit open their form at the bottom of the questionnaire, off-screen, and leave focus on the button

**Defect** · **minor** · questionnaire · Intent: F4

- **Actors:** Security Analyst
- **Route:** /app/review/questionnaires/{id} (analyst review state)
- **Steps:** Open a questionnaire in analyst review at 1440×900. Click "Add question" at the top, or "Edit" on the first question.
- **Expected:** The form opens where the analyst is working, or the page scrolls to it and moves focus into it.
- **Actual:** Both open one shared "Question details" form below the last section (its first label at y=1208 in a 900px viewport on a 7-question seeded questionnaire). The page does not scroll and focus stays on the button, so nothing appears to happen. Editing the first question means scrolling to the bottom to find its text. At 375 on UAT-B, tapping Edit on the fourth question opened the form 2,618px below the viewport.
- **Evidence:** evidence/a2-question-editor-form-offscreen.jpg (the viewport straight after clicking Add question); DOM check: scrollY 0, form label top 1208, active element the Add question button.
- **Recommendation:** Edit questions in place, open Add in the section where it was clicked, and move focus to the first field (WCAG 2.4.3 focus order).
- **Impact:** UI only.
- **Related:** 06.8-04/06.8-05 (question editor).
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-019 Regenerating a questionnaire silently discards the analyst's edits and leaves timeline entries pointing at the wrong questions

**Defect** · **minor** · questionnaire · Intent: A2, F4

- **Actors:** Security Analyst
- **Route:** /app/review/requests/{id}, /app/review/questionnaires/{id}
- **Steps:** Edit generated question q-14, then "Generate questionnaire" → "Replace unanswered questionnaire".
- **Expected:** A warning that analyst edits will be lost, and a timeline entry for the regeneration.
- **Actual:** The dialog only says "This replaces the existing questionnaire only when it has no Requestor answers." The edit vanished; the timeline still reads "Question edited … Question: q-14", which now names a different generated question, and nothing records the regeneration. The hub offered "Generate questionnaire" again with no sign that a questionnaire already existed.
- **Evidence:** JOURNEYS.md area 2, row "A2 regenerate unanswered"; AI job log #2.
- **Recommendation:** Say "Replace questionnaire (discards N analyst edits)", record a "Regenerated" event, and version question keys so old events stay attached to the question they described.
- **Impact:** UI; API (governance log event for regeneration).
- **Related:** 06.2 regeneration rule; 06.8-06 revision timeline.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-020 After release the analyst can no longer see the questions, or how far the requestor has got

**UX** · **minor** · questionnaire · Intent: F5, Q5

- **Actors:** Security Analyst
- **Route:** /app/review/questionnaires/{id} (released, not submitted)
- **Steps:** Release the UAT-A questionnaire and reopen it as Bob.
- **Expected:** The analyst can read what was sent and see progress (for example "5 of 14 answered", without the content) to chase or help the requestor.
- **Actual:** The page shows only "Released to Requestor", "Return it to analyst review before changing its questions", "Awaiting questionnaire submission. Draft answers remain private until the Requestor submits one complete answer batch." and the timeline. The released questions are not listed; the only way to read them is to return the questionnaire to review, which withdraws it from the requestor.
- **Evidence:** JOURNEYS.md area 2, row "F4 edit, F5 release".
- **Recommendation:** Show the released questions read-only and an answered count; keep draft answer content private if the operator wants that.
- **Impact:** UI; API (a progress count without answer content, if not already exposed).
- **Related:** 06.8 D-05; QUES-05.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-023 The requestor's questionnaire opens with history and an amber list of every question instead of guidance

**UX** · **minor** · questionnaire · Intent: F5, Q5

- **Actors:** Requestor
- **Route:** /app/questionnaires/{id}
- **Steps:** Open a newly released questionnaire as Jane.
- **Expected:** A short introduction (who is asking, why, roughly how long it takes, that it saves and can be finished later, and that "not sure" is an acceptable answer), then the questions.
- **Actual:** The first screen is the revision timeline ("4 questions added or changed", shown with a bin icon), progress, and an amber "Questions requiring attention" box listing all 13 required questions before the requestor has done anything, in an order that does not follow the form (the first question of each section, then the second, and so on). Every question is required, and there is no help text.
- **Evidence:** evidence/a2-requestor-questionnaire-first-screen.jpg; JOURNEYS.md area 2, row "F5 answer part".
- **Recommendation:** Lead with an introduction and the first section; show the attention list only after a submit attempt, in form order; move the history below the questions; let the analyst add help text (the JDL already has `CsrmQuestion.helpText`).
- **Impact:** UI only (help text editing may need an API field already in the model).
- **Related:** QUES-02; 06.8-06 timeline at requestor depth.
- **Proposed phase:** Phase 10: Existing-flow gap closure

## AI assistance

### UAT-017 The analyst cannot give the AI more information or ask it to add, change or remove questions

**Gap** · **major** · AI assistance · Intent: F4, F3

- **Actors:** Security Analyst
- **Route:** /app/review/requests/{id} (Questionnaire generation), /app/review/questionnaires/{id}
- **Steps:** After the first generation, look for a way to tell the AI "also cover tax file numbers and the offshore support team" or "drop the logging question".
- **Expected:** "The analyst will review the questions, could edit, add more, or prompt with more information for the AI to add/edit/delete questions" (F4).
- **Actual:** Generate and "Replace unanswered questionnaire" take no input; the only choices are to accept the whole set or regenerate the whole set. There is no per-question or per-section AI action.
- **Evidence:** JOURNEYS.md area 2, rows F4 and A2; `POST /assessment_requests/{id}/generate_questionnaire` accepts only `replaceUnansweredQuestionnaire`.
- **Recommendation:** Add an analyst instruction box to generation and targeted AI actions ("add questions about …", "rewrite in plain language", "remove duplicates") that produce a reviewable proposal the analyst accepts per question; record the instruction with the provenance.
- **Impact:** API (a new or extended operation taking analyst instructions, with grants); operator decision (06.7 D-08 treats request text as untrusted data; analyst instructions are a new, trusted input and need a prompt-safety rule); likely Phase 9 scope.
- **Related:** 06.7 D-08; Pre-06.5 decision "remaining conceptual AI operations out of scope" (STATE L52); Phase 9 placeholder.
- **Proposed phase:** Phase 15: Steerable questionnaire AI (Phase 9)

### UAT-018 Once any answer exists there is no AI re-run of the question list, only a manual Return to review

**Gap** · **major** · AI assistance · Intent: A2

- **Actors:** Security Analyst
- **Route:** /app/review/requests/{id}
- **Steps:** After Jane submitted answers and later added new information, look for a way to have the AI revisit the questionnaire, before and after "Return to analyst review".
- **Expected:** "If a question has already been answered by the requestor, keep it as information. The other unanswered questions could be changed and most likely, more questions will be required" (A2).
- **Actual:** With answers submitted, the hub removes "Questionnaire generation" entirely and offers only "Generate assessment draft", with no explanation. After Return to review the hub still offers no generation. The server refuses regeneration once answers exist (not reachable from the web app).
- **Evidence:** JOURNEYS.md area 2, row "A2 re-run with answers".
- **Recommendation:** Add "Propose follow-up questions": the AI receives the request, notes and answered questions as fixed context and proposes new or revised unanswered questions for the analyst to accept, keeping answered questions and their answers intact.
- **Impact:** API (new operation); operator decision: reverses the Pre-06.2 locked decision "Regeneration replaces an unanswered questionnaire and is refused once any answer exists" (STATE L43; ROADMAP L272, L279); likely Phase 9 scope.
- **Related:** QUES-07; 06.8 D-05, D-15.
- **Proposed phase:** Phase 15: Steerable questionnaire AI (Phase 9)

### UAT-026 No AI write-up of residual risk after mitigations are recorded

**Gap** · **major** · AI assistance · Intent: F9

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** After recording mitigation controls on all four UAT-A risks, look for an AI action to reassess residual likelihood, consequence, rating and rationale.
- **Expected:** "Once mitigating controls are submitted, the AI will write up the residual risk. Analysts review, edit, delete or even re-trigger the AI" (F9).
- **Actual:** No AI action exists once the draft is created; residual values are whatever the first draft proposed plus the analyst's manual edits. The draft's residual ratings were written before any controls existed.
- **Evidence:** JOURNEYS.md area 2, F9 row; served operations list only questionnaire and draft generation.
- **Recommendation:** Add a per-risk and whole-assessment "Reassess residual risk" proposal that takes the recorded controls (and requestor responses) and returns proposed residual values and rationale for the analyst to accept per field.
- **Impact:** API (new AI operation and job); operator decision (new AI operation; Phase 9 human-supervised agent scope); depends on UAT-025 for requestor input.
- **Related:** 06.7 scope ("remaining conceptual AI operations out of scope", STATE L52); Phase 9 placeholder.
- **Proposed phase:** Phase 17: Mitigation response and residual reassessment (Phase 9)

### UAT-028 The AI cannot be re-run for one risk or to propose additional risks

**Gap** · **major** · AI assistance · Intent: F7

- **Actors:** Security Analyst
- **Route:** /app/review/requests/{id}, /app/review/assessments/{id}
- **Steps:** With the UAT-A draft open, look for "regenerate this risk", "suggest more risks" or a second draft.
- **Expected:** The analyst can "re-trigger the AI to write up risks again … editing one specific risk, adding new risks" (F7).
- **Actual:** Once a draft exists the hub shows only "Open assessment draft"; there is no per-risk AI action and no way to ask for more risks. Retry exists only for a failed job. The analyst added the payment-file risk the draft missed entirely by hand (about 25 fields).
- **Evidence:** JOURNEYS.md area 2, F7 rows.
- **Recommendation:** Add "Suggest more risks" (proposals only, excluding existing risks) and "Rewrite this risk" (proposed field changes shown as a diff to accept per field).
- **Impact:** API (new AI operations); operator decision: reverses the Phase 04 decision that a linked draft is "restart discovery" and never invokes the provider again (STATE L136) and the "completed jobs are terminal" contract (`phase-04-deterministic-draft-jobs.md`); Phase 9 scope.
- **Related:** `regenerate_draft` unserved; ASSESS-02.
- **Proposed phase:** Phase 16: Risk curation and targeted AI re-runs (Phase 9)

### UAT-029 The AI draft can only use three hard-coded Risk Types, so it returns one risk per type and misses others

**Defect** · **major** · AI assistance · Intent: F6, O2

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Generate the UAT-A draft from a questionnaire whose answers describe unsigned payment files reconciled by hand, partial segregation of duties, an untested fallback for failed pay runs and no disaster recovery evidence.
- **Expected:** Risks drawn from the whole Risk Type library that fit the answers.
- **Actual:** Exactly three risks, one for each of "Personal Information Handling", "Third-Party Dependency" and "Internet Exposure". Payment-file integrity, segregation of duties and payroll resilience were folded in or missed; the analyst added the payment-file risk by hand. The draft code loads only those three names (`loadRiskTypeContext`), so Risk Types added in Administration never reach the AI, and the draft fails if any of the three is renamed (inferred from code).
- **Evidence:** ASM-2026-2XX26G risks RSK-2026-0520P7, RSK-2026-308BAE, RSK-2026-807EKE (JOURNEYS.md AI job log #3); `apps/strapi/src/api/csrm-assessment/services/assessment-workflow.ts` `loadRiskTypeContext`.
- **Recommendation:** Send the Risk Type library (bounded and searchable), allow several risks per type, and let the operator curate which types the AI may use.
- **Impact:** API (draft context and schema); operator decision (which Risk Types are AI-eligible).
- **Related:** 06.7-02 closed-vocabulary constraint; ADMIN-01; 06.7 D-10 (50-risk cap).
- **Proposed phase:** Phase 12: AI context, suggestions and provenance (Phase 9 foundation)

### UAT-030 The AI draft never sees the request or the question wording, and questionnaire generation omits regulatory requirements and the selected systems and assets

**Defect** · **major** · AI assistance · Intent: F3, F6

- **Actors:** Security Analyst
- **Route:** /app/review/requests/{id} (both generation jobs)
- **Steps:** Compare what each generation job sends the model (inferred from code) with the UAT-A output.
- **Expected:** The AI works from everything the requestor provided: request fields, selected systems and assets with their classification, regulatory requirements, and each question with its answer.
- **Actual:** Questionnaire generation sends title, description, assessment type, business purpose, criticality and third-party fields only; the UAT-A questionnaire asked nothing about the Privacy Act, tax file number rules or data residency policy the requestor listed, or the "Restricted" classification recorded only on the asset. Draft generation sends only answers as `q-1`…`q-15` key–value pairs, without the question text or any request field: all four UAT-A risks were left with system, asset and classification "Not specified", and the draft never mentions the finance-system file transfer that the request and question text described.
- **Evidence:** inferred from code (`openai-compatible-questionnaire-generation-provider.ts` `userPrompt`; `openai-compatible-assessment-draft-provider.ts` `buildUserPrompt`), consistent with the UAT-A questionnaire and draft (JOURNEYS.md, AI job log #1–#3).
- **Recommendation:** Build one reviewable "assessment context" (request fields, notes, systems and assets with classifications, questions with answers) and send it to both operations; pre-fill each risk's system, asset and classification from it for the analyst to confirm.
- **Impact:** API (prompt context only; no schema change).
- **Related:** 06.7 D-08 (untrusted data tags); QUES-07; ASSESS-02; INT-03.
- **Proposed phase:** Phase 12: AI context, suggestions and provenance (Phase 9 foundation)

### UAT-031 The draft's suggested controls are thrown away, so every AI risk arrives with no mitigation controls

**Defect** · **major** · AI assistance · Intent: F6, F9

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Open the UAT-A draft and look for the controls the AI suggested.
- **Expected:** "Suggested controls from the library" (project baseline for F6), shown as proposals the analyst can accept.
- **Actual:** All three AI risks had an empty "Mitigation controls" list. The provider's `suggestedControlNumbers` are parsed and then discarded; only the deterministic test provider writes them into the treatment plan text (inferred from code). The analyst then has to find controls in a 2,646-option dropdown (UAT-006).
- **Evidence:** ASM-2026-2XX26G before analyst edits (JOURNEYS.md, F6); `apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts` and `deterministic-assessment-draft-provider.ts`.
- **Recommendation:** Show suggested controls on each risk as proposals with one-click "add as planned control", drawn from the whole library (not only the three types' applicable controls).
- **Impact:** API (persist or return suggestions; possibly a contract field); UI.
- **Related:** ASSESS-02, ASSESS-03, RISK-02.
- **Proposed phase:** Phase 12: AI context, suggestions and provenance (Phase 9 foundation)

### UAT-032 Nothing marks AI-proposed content, and the released assessment says the analyst "generated" it

**UX** · **major** · AI assistance · Intent: F6, F7, brief §19

- **Actors:** Security Analyst, Requestor
- **Route:** /app/review/assessments/{id}, /app/assessments/{id}
- **Steps:** Open the UAT-A draft as Bob and search the page for any AI or provenance marker; after edits, try to tell which values the AI wrote and which Bob changed. Open the released view as Jane.
- **Expected:** AI output is visibly advisory, and the analyst can tell AI proposals from human changes (brief §19: provenance, human modifications; INT-03).
- **Actual:** The assessment editor has no "AI", "generated", "proposed" or "advisory" text anywhere; values the AI wrote look identical to analyst edits, and nothing records which fields changed. Jane's released view lists "Generated by Bob Doe". The only advisory notice is on the request hub before generation ("The draft is advisory …"), and the provider appears only in the questionnaire job panel.
- **Evidence:** text search of ASM-2026-2XX26G (JOURNEYS.md, F6); Jane's released view.
- **Recommendation:** Label AI-proposed fields until an analyst accepts or edits them, show provenance (provider, time, initiating analyst) on the assessment and questionnaire, keep a per-field change history, and tell the requestor that AI assisted and an analyst reviewed.
- **Impact:** UI; API (expose stored provenance; per-field review state may need a contract-gap record).
- **Related:** INT-03; 06.7 provenance fields (`providerName`, `providerVersion`).
- **Proposed phase:** Phase 12: AI context, suggestions and provenance (Phase 9 foundation)

### UAT-042 AI drafts can state facts nobody provided, and nothing links a statement to its source answer

**Defect** · **major** · AI assistance · Intent: F6, F7

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Compare each draft risk's statements with the questionnaire answers for UAT-A, UAT-B and UAT-C.
- **Expected:** Every statement traces to the request or an answer, with no invented facts (brief area 4 criteria), and the analyst can check the source quickly.
- **Actual:** UAT-C's API-key risk says "The security and patch status of the connector and supporting integration components has not been assessed", and its treatment plan asks to "assess, patch, and monitor the connector"; no answer mentions patching. The other two drafts were traceable. No draft cites which answers support a statement, so checking takes a side-by-side read of the questionnaire. Likelihood and consequence vocabulary also drifts between drafts ("Major" in UAT-A and UAT-B, "High" in UAT-C).
- **Evidence:** ASM-2026-022BJ9 risk RSK-2026-VW2JG4 as generated (JOURNEYS.md AI job log #7 and area 4); the analyst's correction is recorded in its Comments field.
- **Recommendation:** Have each proposed field cite the answer keys and request fields it used, show those citations beside the field, flag uncited claims, and constrain likelihood and consequence to the organisation's scales (see UAT-008).
- **Impact:** API (draft schema adds citations; closed vocabularies); UI.
- **Related:** INT-03; 06.7 D-08; UAT-030, UAT-032.
- **Proposed phase:** Phase 12: AI context, suggestions and provenance (Phase 9 foundation)

### UAT-043 AI questionnaires make every question required, mostly long free text in technical language, with no help text

**UX** · **major** · AI assistance · Intent: F3, F5, Q5

- **Actors:** Requestor, Security Analyst
- **Route:** /app/review/questionnaires/{id}, /app/questionnaires/{id}
- **Steps:** Generate questionnaires for UAT-A, UAT-B and UAT-C and read them as a non-expert requestor.
- **Expected:** Questions a business requestor can answer: plain language, one thing per question, choices where possible, "not sure" accepted, and optional where the analyst can find the answer elsewhere (Q5 "the requestor feels guided").
- **Actual:** 15, 13 and 14 questions (the cap is 15), every one required in all four generations. Long text dominates (13 of 15 in UAT-A's first run; 8 of 13 and 8 of 14 in UAT-B and UAT-C). Many are compound ("authenticated, encrypted, monitored and protected against file tampering, replay, unauthorised destination changes and failed transfers?") or use specialist terms (RTO, RPO, mutual TLS, audience restriction). No question has help text. Rewriting them is manual, and adding questions is broken (UAT-016).
- **Evidence:** JOURNEYS.md AI job log #1, #2, #4 and #6 and the area 4 comparison table.
- **Recommendation:** Instruct generation to write for a non-expert (one question each, choices with "Not sure", optional where appropriate, short help text), and give analysts a "simplify wording" action (see UAT-017).
- **Impact:** API (prompt and schema: help text, required flag guidance); UI (help text display already modelled as `CsrmQuestion.helpText`).
- **Related:** QUES-02, QUES-07; 06.7 D-14.
- **Proposed phase:** Phase 12: AI context, suggestions and provenance (Phase 9 foundation)

### UAT-041 Leaving the page during a generation job loses its status, and the hub invites the analyst to generate again

**Defect** · **minor** · AI assistance · Intent: F3, Q5

- **Actors:** Security Analyst
- **Route:** /app/review/requests/{id}
- **Steps:** Start UAT-C's questionnaire generation, open the analyst dashboard, and return to the request 1.7 s later while the job is still running.
- **Expected:** The hub shows the running job (queued or running, with its progress) and does not offer to start another.
- **Actual:** The dashboard showed "Generation in progress 1", but back on the request the panel showed a plain "Generate questionnaire" button and the summary said "Next action: Generate the questionnaire." Only a reload after the job finished showed the new questionnaire. The job panel is mounted without the running job (inferred from code: `assessment-detail.tsx` renders it without `initialJob`); the registry appears to de-duplicate jobs per request (inferred from code), but the analyst cannot know that, and only the initiating analyst can read the job anyway.
- **Evidence:** JOURNEYS.md area 4, row "Generate, then leave the page".
- **Recommendation:** Load any active or recent job for the request on page load, show it, and replace "Generate" with its status until it ends.
- **Impact:** UI; API (a read of the active job by request, readable by any analyst on the request).
- **Related:** QUES-07, ASSESS-02; R-08-36 (jobs held in memory); UAT-014 (initiator-only job access).
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-044 The AI draft proposes "Treat" for every risk

**Defect** · **minor** · AI assistance · Intent: F6

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Read the treatment action on all nine AI-proposed risks.
- **Expected:** Treatment proposals that fit each risk, including acceptance where the residual rating is within appetite.
- **Actual:** All nine are "Treat". The draft schema fixes the treatment action to "Treat" (`treatmentAction: { const: "Treat" }`, inferred from code), so the AI can never propose acceptance.
- **Evidence:** ASM-2026-2XX26G, ASM-2026-19QK3M, ASM-2026-022BJ9 (JOURNEYS.md AI job log); `openai-compatible-assessment-draft-provider.ts`.
- **Recommendation:** Allow the model to propose "Accept" with a rationale for the analyst to confirm, once the operator defines risk appetite.
- **Impact:** API (draft schema); operator decision (risk appetite and who may accept a risk).
- **Related:** ASSESS-02; JDL `CsrmTreatmentAction` (Accept, Treat).
- **Proposed phase:** Phase 12: AI context, suggestions and provenance (Phase 9 foundation)

## Assessment and risks

### UAT-008 The risk editor takes likelihood and consequence as free text, separate from the rating

**Gap** · **major** · assessment and risks · Intent: F7, Q1 (heat map)

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Open an assessment draft and inspect a risk's inherent and residual fields.
- **Expected:** Likelihood and consequence come from a fixed scale and drive the rating, so ratings are consistent and a likelihood-by-consequence heat map is possible.
- **Actual:** Inherent likelihood, highest inherent consequence, residual likelihood and highest residual consequence are text inputs (seeded values "Possible", "Major", "Unlikely"); inherent and residual rating are separate selects (Low to Critical). Nothing checks that the rating matches the likelihood and consequence.
- **Evidence:** DOM check on ASM-2026-MWQA7E risk RSK-2026-3D4RVV: `inherentLikelihood` input/text "Possible", `highestInherentConsequence` input/text "Major", `inherentRating` select "High".
- **Recommendation:** Offer the organisation's likelihood and consequence scales as pick lists with a derived, overridable rating. The JDL stores all four as unconstrained strings (`CsrmRisk.inherentLikelihood` and so on), so a closed vocabulary can be enforced by the API without a content-type change; existing free-text values need a migration rule.
- **Impact:** UI; API (closed vocabulary on risk create and update, and in the AI draft schema); operator decision (the organisation's likelihood, consequence and rating matrix).
- **Related:** ASSESS-03, RISK-01.
- **Proposed phase:** Phase 18: Risk table and spreadsheet interoperability

### UAT-027 A risk cannot be deleted, so a wrong AI-proposed risk can only be rewritten or released

**Gap** · **major** · assessment and risks · Intent: F7

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Look for delete, remove, withdraw or "not applicable" on each risk in the UAT-A draft.
- **Expected:** The analyst can "review, edit, delete" risks (F7).
- **Actual:** Each risk has "Save risk" and mitigation-control actions only. There is no delete, and no status that excludes a risk from the assessment; the release readiness check requires every risk to be complete.
- **Evidence:** button inventory on ASM-2026-2XX26G (JOURNEYS.md area 2, F7); no risk DELETE in `served-operations.json`.
- **Recommendation:** Allow deleting (or withdrawing with a reason) an unreleased risk, recorded in the assessment's history; keep released risks immutable.
- **Impact:** API (risk delete or withdraw operation with exact grants and an audit record); operator decision: reverses the Phase 04 decision "Expose no Risk delete service" (STATE L149).
- **Related:** risk close deferred (`served-operations.json` L2217-2221); ASSESS-03.
- **Proposed phase:** Phase 16: Risk curation and targeted AI re-runs (Phase 9)

### UAT-009 Exemption review date asks the analyst to type a UTC timestamp

**Defect** · **minor** · assessment and risks · Intent: F7

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}; Risk detail
- **Steps:** Open a risk editor and find "Exemption review date".
- **Expected:** A date picker like every other date on the form.
- **Actual:** A text input with the hint "Use UTC format YYYY-MM-DDTHH:mm:ssZ.", while the other five dates are date inputs.
- **Evidence:** evidence/a7-risk-card-dates-utc-hint.jpg; DOM check: `Exemption review date` input/text; the other dates input/date.
- **Recommendation:** Use the shared date input and convert to the stored format on save.
- **Impact:** UI only.
- **Related:** ASSESS-03.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-010 The risk editor lists every system and asset in the inventory in plain dropdowns, not the request's scope

**UX** · **minor** · assessment and risks · Intent: F7, O2

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Open a risk and open "Information system impacted" and "Information asset impacted".
- **Expected:** A searchable picker that offers the request's selected systems and assets first.
- **Actual:** Plain selects with every Information System and Information Asset in the inventory, unrelated to the request. This works with today's handful of records and will not at inventory scale.
- **Evidence:** DOM check on ASM-2026-MWQA7E (options "Customer portal | Phase 7 exposure platform" before this run's records were added).
- **Recommendation:** Reuse the searchable relation selector, scoped first to the request's systems and assets.
- **Impact:** UI only.
- **Related:** UX-02, 06.3-04.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-034 Saving a risk or a control gives no confirmation, and the control-owner list offers only people already named on the risk

**Defect** · **minor** · assessment and risks · Intent: F7, F9

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Edit a UAT-A risk and click "Save risk"; add a mitigation control and open "Control owner".
- **Expected:** A visible "Saved" confirmation; an owner picker that searches all users, like the risk owner picker.
- **Actual:** No toast or status text after "Save risk" or "Add mitigation control"; the only sign is the readiness count changing (31 → 37 of 48) and the header status moving from Draft to In review. "Control owner" is a select holding "Not specified" plus the users already set as risk or treatment owner ("Jane Doe"); on a risk with no owners it offers only "Not specified".
- **Evidence:** JOURNEYS.md area 2, F7 and F9 rows; DOM check of `controlOwner` options on ASM-2026-MWQA7E and ASM-2026-2XX26G.
- **Recommendation:** Confirm each save inline, and use the searchable user picker for control owners.
- **Impact:** UI only.
- **Related:** ASSESS-03, UX-02.
- **Proposed phase:** Phase 10: Existing-flow gap closure

## Controls and residual risk

### UAT-006 The mitigation control picker is a plain dropdown of all 2,646 library controls, most named only by a number

**Defect** · **major** · controls and residual risk · Intent: F9, O2

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id} → Add mitigation control; Risk detail
- **Steps:** Open an assessment draft, click "Add mitigation control" on a risk and open "Reusable control".
- **Expected:** The analyst finds the right control by searching name, framework or reference (UX-02 made every record picker searchable).
- **Actual:** "Reusable control" is a native select with 2,647 options (including "Select a control"), sorted as text: "5.1 — 5.1", "5.10 — 5.10", "5.11 — 5.11" and so on for the ISO/IEC 27001 Annex A entries, then "ACCESS-1a — ACCESS-1a — Establish Identities and Manage Authentication" for the energy-sector framework. There is no search, no framework filter and no description. "Control owner" offers only "Not specified".
- **Evidence:** DOM check on ASM-2026-MWQA7E: select `control` with 2,647 options, first options "Select a control | 5.1 — 5.1 | 5.10 — 5.10"; `controlOwner` has one option.
- **Recommendation:** Use the searchable relation selector from 06.3 (server-backed, with framework and type filters), and offer the risk type's applicable controls first.
- **Impact:** UI only (the searchable Control list operation exists); check the owner lookup.
- **Related:** UX-02, 06.3-04 bounded relation selector.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-025 The requestor cannot see or respond to the initial risks before release

**Gap** · **major** · controls and residual risk · Intent: F8, Q5

- **Actors:** Requestor, Security Analyst
- **Route:** /app/assessments/{id}, /app/review/assessments/{id}
- **Steps:** With the UAT-A draft in review, look for a way for Bob to send the initial risks to Jane and for Jane to respond with mitigating controls; open the assessment as Jane by direct URL.
- **Expected:** "The analysts release the initial risks raised for the requestor to respond to with mitigating controls" (F8).
- **Actual:** No such step exists. Jane's direct URL shows "Page not found" (no record details leak); her request stepper says "Assessment reviewed" and "The work is waiting with the other party." The analyst records mitigation controls alone, and release makes everything read-only for both actors.
- **Evidence:** JOURNEYS.md area 2, rows F8; Jane's direct-URL check (h1 "Page not found").
- **Recommendation:** Add a "Released for response" stage: the requestor sees the initial risks read-only, proposes mitigating controls per risk (existing or planned, with owner, evidence and due date), and submits; the analyst accepts, edits or rejects each proposal before the residual review.
- **Impact:** Datamodel (frozen: a new assessment stage and a requestor response per risk; contract-gap record); API (requestor read of in-review risks, response operations, exact grants and record checks); operator decision: reverses the locked decisions that the requestor sees an assessment only after release (ASSESS-05; 06.4 decision, STATE L47) and that every risk and control mutation is analyst-only (STATE L146).
- **Related:** ASSESS-05; 06.9 D-4; JDL assessment status vocabulary (DRAFT, IN_REVIEW, APPROVED, CLOSED).
- **Proposed phase:** Phase 17: Mitigation response and residual reassessment (Phase 9)

## Release

### UAT-033 The released assessment shows controls as internal IDs and hides each risk's treatment, owners and dates

**Defect** · **major** · release · Intent: F10, Q5, brief §8

- **Actors:** Requestor
- **Route:** /app/assessments/{id}
- **Steps:** Release UAT-A and open it as Jane.
- **Expected:** The requestor, who is named risk owner on all four risks, sees each risk's statement, likelihood and consequence, ratings, treatment plan, owners, target date and the named controls (brief §8).
- **Actual:** Each risk shows only its number, statement, inherent and residual rating, and control implementations. Every control appears as "CONTROL REFERENCE mgin2kcqf3xcv4npn7ehmk0x" (an internal ID) with no number or name; treatment plan, treatment owner, risk owner, target date, likelihood, consequence and rationale are not shown.
- **Evidence:** evidence/a2-released-view-control-id.jpg
- **Recommendation:** Show the control number and name, and each risk's treatment and ownership fields, read-only; offer a risk table view (see the risk table requirements).
- **Impact:** UI only (fields exist in the released read; confirm the control relation is populated).
- **Related:** ASSESS-05, UX-03.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-011 The release readiness checklist lists fourteen items per risk

**UX** · **minor** · release · Intent: F10, Q5

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Open an assessment draft with three risks and read "Release readiness".
- **Expected:** A short summary of what blocks release, grouped by risk, with links.
- **Actual:** "31 of 48 release requirements met" followed by 48 rows: five assessment rows, 14 per risk ("Risk RSK-… — Risk owner", "— Target date", "— Treatment owner" and so on) and "At least one Risk". A ten-risk assessment would list 146 rows between the details form and the risks.
- **Evidence:** evidence/a7-ten-risk-editor-readiness-146.jpg (UAT-C with ten risks: "124 of 146 release requirements met"); ASM-2026-MWQA7E readiness panel (48 rows), recorded in JOURNEYS.md.
- **Recommendation:** Summarise by risk ("RSK-… : 4 fields missing"), show only outstanding items by default, and let the analyst jump to each.
- **Impact:** UI only.
- **Related:** UX-04, 06.4-06 release requirement set.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-040 Review is recorded implicitly by saving, and any later edit withdraws it

**UX** · **minor** · release · Intent: F10, Q5

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Complete every UAT-B release requirement, change the next review date, then save the assessment again.
- **Expected:** An explicit "Mark reviewed" step the analyst chooses, with edits after review clearly flagged.
- **Actual:** The first edit of a draft records the editor as reviewer and moves the assessment to "In review". Editing a release-ready assessment returns it to Draft with "Completed review withdrawn … Save the assessment again to record a fresh review", and a second save restores "In review". The message is clear, but the review is a side effect of saving rather than a decision, and "Draft" now means "edited after review".
- **Evidence:** JOURNEYS.md area 3, row "Edit after review complete (D-13)".
- **Recommendation:** Add an explicit "Mark reviewed" action (enabled when the checklist is met), keep "Reviewed by" and the review time visible, and show edits made since review.
- **Impact:** UI; API (an explicit review operation); operator decision (changes the 06.8 D-04/D-13 edit-driven transitions).
- **Related:** 06.8 D-04, D-13; ASSESS-04.
- **Proposed phase:** Phase 17: Mitigation response and residual reassessment (Phase 9)

## Collaboration and attachments

### UAT-012 A request cannot carry supporting files, at intake or later, for either actor

**Gap** · **major** · collaboration and attachments · Intent: F1, A1

- **Actors:** Requestor, Security Analyst
- **Route:** /app/requests/new, /app/requests/{id}, /app/review/requests/{id}, questionnaires and assessments
- **Steps:** As Jane, create UAT-A and look for a way to attach the vendor's security pack (PDF), a data-flow document and a spreadsheet. As Bob, look for the same on the request, questionnaire and assessment.
- **Expected:** The requestor submits the request "with important context as well as pdfs, docs, spreadsheets" (F1), and either actor can add documentation at any point (A1).
- **Actual:** No file input, drop zone or "attach" action exists on any screen for either actor (DOM check on the new-request form: 0 file inputs). The questionnaire's file-upload answer type is disabled and never generated.
- **Evidence:** UAT-A intake form (JOURNEYS.md, area 2, F1); `served-operations.json` has no CSRM upload operation; the JDL has no attachment entity or media field.
- **Recommendation:** Add request-level attachments (and later questionnaire and assessment attachments) with type and size limits, malware scanning, retention, per-record authorisation, and a list of files on each record; let the AI read extracted text only after the operator settles how untrusted file content reaches the model.
- **Impact:** Datamodel (frozen: an attachment entity or media relation needs a `docs/contract-gaps/` record and operator approval); API (upload, list, download and delete operations with exact grants); new dependency likely (malware scanning, text extraction); operator decision (storage, scanning, size limits, retention; open since Phase 1, STATE L289).
- **Related:** Phase 03 "file-upload-deferred" (STATE L89, L111; 03 D-04; `docs/contract-gaps/phase-03-questionnaire-json-contract.md`); 06.7 D-14; catalogue design note 6; COLLAB-01.
- **Proposed phase:** Phase 14: Request attachments

### UAT-013 Neither actor can add information to a request once it is submitted

**Gap** · **major** · collaboration and attachments · Intent: A1, Q5

- **Actors:** Requestor, Security Analyst
- **Route:** /app/requests/{id}, /app/review/requests/{id}
- **Steps:** After UAT-A's questionnaire existed, Jane learned that after-hours vendor support would come from an offshore team with administrator access. Look for a way to tell the analyst; as Bob, look for a way to record a note.
- **Expected:** "A requestor or an analyst could add extra documentation/information in plain text, relating to the ticket" at any point (A1).
- **Actual:** Jane's request page has no action at all once a questionnaire exists ("Return to draft" disappears, and the submit dialog says the request "cannot be edited after submission"). The only route was to reopen her submitted questionnaire (reason required), change a residency answer and append the news to an unrelated answer about vendor accounts. Bob has no note, comment or edit on the request, questionnaire or assessment; the only free text is each risk's "Comments" field.
- **Evidence:** JOURNEYS.md area 2, rows "A1 requestor adds information" and "A1 analyst adds information".
- **Recommendation:** Add a dated, attributed notes thread on the request, visible to both actors, where each note can flag that the AI inputs have changed; show new notes on the analyst's queue and the requestor's dashboard.
- **Impact:** Datamodel (frozen: no comment or activity entity; contract-gap record); API (note create and list with record-level grants); operator decision (who may add notes at which stage, and whether notes feed the AI).
- **Related:** COLLAB-01 (v2); REQ-03, REQ-06; STATE L98 (submitted answer batches immutable); catalogue design note 6; `CsrmQuestion.reviewComment` unused.
- **Proposed phase:** Phase 13: Request pick-up and notes

## Registers and lists

### UAT-045 There is no BAU, Project or Other view anywhere: assessment type is not a column, filter or report dimension

**Gap** · **major** · registers and lists · Intent: O1

- **Actors:** Security Analyst (risk manager)
- **Route:** /app/risks, /app/review/requests, /app/review/assessments, /app/reports/*, /app/review
- **Steps:** Try to list open High risks for Project assessments only, and to compare BAU with Project exposure.
- **Expected:** "Overall registers for BAU/Project/etc." (O1): registers and reports that separate assessment types.
- **Actual:** Assessment type (stored on the request as BAU, Project or Other) appears in no list column, filter, report or dashboard: not in the Risk Register (8 fixed columns; 12 filters), the request queue (4 columns; status and queue filters), the assessment list, My Requests, the four reports or the analyst dashboard. The only way to learn a record's type is to open its request.
- **Evidence:** JOURNEYS.md area 5 ("BAU versus Project oversight"); register and list inventories.
- **Recommendation:** Add assessment type as a column and filter on the register, queues and assessment list, and as a breakdown in the exposure and throughput reports and dashboard; consider saved views per type ("Project register", "BAU register").
- **Impact:** API (a type filter and projection on risk, request and assessment reads, and a report breakdown, all joined through the request; no content-type change); UI.
- **Related:** RISK-01; 07 D-13, D-14 (closed report keys); 07 D-36 (precedent for adding a register filter).
- **Proposed phase:** Phase 20: Oversight registers and post-release tracking

### UAT-046 Once released, risks cannot be updated, so the register cannot track treatment to closure

**Gap** · **major** · registers and lists · Intent: O1, F10

- **Actors:** Security Analyst, risk owners
- **Route:** /app/risks/{id}, /app/risks, /app/alerts
- **Steps:** Open a released UAT-A risk and try to record treatment progress or close it.
- **Expected:** A register a risk manager can maintain after the assessment: treatment status, completion, closure, review dates and control status updated as work happens.
- **Actual:** "Released assessment - read only. This Risk belongs to a released assessment. Risk and mitigation-control information can no longer be changed." Treatment status stays at its release value, nothing can close a risk, request or assessment (the "Closed" states are never set), and alerts on released work never clear. A register built from releases goes stale from the day of release.
- **Evidence:** RSK-2026-NR85X3 detail (JOURNEYS.md area 5); `served-operations.json` (risk close deferred).
- **Recommendation:** Allow post-release treatment tracking on released risks (status, dates, evidence, closure with reason) without reopening the assessment, keep the released assessment itself immutable, and record each change in history.
- **Impact:** API (post-release treatment and close operations with grants); datamodel possibly (history of post-release changes; contract-gap record); operator decision (which fields stay mutable after release and who may change them; 07 D-27 and Phase 7 gap item 1 list the options without choosing).
- **Related:** 07 D-27; `docs/contract-gaps/phase-07-derived-insights.md` gap item 1; STATE L330 (no closed bucket); NOTIFY-01 (reminders).
- **Proposed phase:** Phase 20: Oversight registers and post-release tracking

### UAT-007 Reference data reads as test data: unnamed and truncated controls, and Risk Types described as developer notes

**Defect** · **minor** · registers and lists · Intent: O2

- **Actors:** Security Analyst
- **Route:** /app/admin/controls, /app/admin/risk-types
- **Steps:** Open Controls and read the first page; open a Privacy Principles control; open each Risk Type.
- **Expected:** Each reusable control has a recognisable name and each Risk Type a business description, so analysts and the AI can match them to a risk.
- **Actual:** 2,646 controls are loaded. The ISO/IEC 27001 Annex A rows show the number as the name ("5.1 | 5.1 | ISO/IEC 27001 …"), with type and reference "Not provided". The energy-sector rows repeat the number in the name ("ACCESS-1a — Establish Identities and Manage Authentication"). Some names are cut short ("APP-11 — security of personal"). The three seeded Risk Types, the only ones the AI draft uses, are described as "Reusable deterministic draft mapping for internet-reachable and externally hosted services" and similar developer notes.
- **Evidence:** /app/admin/controls first page and `?q=access`, recorded in JOURNEYS.md.
- **Recommendation:** Load licensed control titles, or show the framework's short title where the full text cannot be stored; the operator should confirm what the library may hold.
- **Impact:** Operator decision (control library content and licensing); data load only.
- **Related:** ADMIN-02.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-035 Review queues lack the columns an analyst needs to triage

**UX** · **minor** · registers and lists · Intent: F2, Q5

- **Actors:** Security Analyst
- **Route:** /app/review/requests, /app/review/assessments
- **Steps:** Open both review lists.
- **Expected:** Enough on each row to decide what to pick up next: requestor, assessment type, criticality, due date, age, assignee (and for assessments, the request title and highest residual rating).
- **Actual:** Requests: Request, Title, Status, Submitted. Assessments: Assessment, Summary, Status, Draft initiated by; no request title, so "ASM-2026-2XX26G" has to be opened to know it is the payroll platform.
- **Evidence:** queue and list inventories in JOURNEYS.md (areas 1 and 2).
- **Recommendation:** Add requestor, type, criticality, due date, age and assignee to the request queue, and request title, risk count and highest residual rating to the assessment list, with column choice.
- **Impact:** UI; API (queue projection returns only number, title, status and submitted date).
- **Related:** ASSESS-01, UX-03, 06.6 DataTable.
- **Proposed phase:** Phase 11: Navigation, landing and list clarity

### UAT-047 Systems, assets, controls and Risk Types do not show the requests, risks or implementations that use them

**Gap** · **minor** · registers and lists · Intent: O2

- **Actors:** Security Analyst
- **Route:** /app/admin/information-systems/{id}, /app/admin/information-assets/{id}, /app/admin/controls/{id}, /app/admin/risk-types/{id}
- **Steps:** Open "UAT-A: Brightwage People HR and payroll platform" and look for its requests and risks; do the same for a control used in three assessments.
- **Expected:** Lists of systems and controls that support oversight: each record shows where it is used, with counts and ratings ("which systems carry the most high residual risk?").
- **Actual:** Each detail page is an edit form with a static "Downstream use" note ("Assessment and Risk references retain their own workflow history."). There are no related requests, risks or control implementations, and the lists have no usage or risk columns. The register can filter risks by system, and the exposure report lists the ten most exposed systems, but requests cannot be filtered by system and nothing links a control to where it is implemented.
- **Evidence:** JOURNEYS.md area 5 ("Systems, assets, controls and Risk Types").
- **Recommendation:** Add "Used in" panels (requests, open risks by residual rating, control implementations by status) and usage columns on the lists, each linking to the filtered register or queue.
- **Impact:** API (relation reads or counts for each reference type, with grants); UI.
- **Related:** ADMIN-01 to ADMIN-03; RISK-01.
- **Proposed phase:** Phase 20: Oversight registers and post-release tracking

### UAT-053 The Information System form shows its owner as an internal ID, and system and asset lists omit owner and criticality

**Defect** · **minor** · registers and lists · Intent: O2

- **Actors:** Security Analyst
- **Route:** /app/admin/information-systems/{id}, /app/admin/information-systems, /app/admin/information-assets
- **Steps:** Create a system with an owner, reopen it, and read the lists.
- **Expected:** The owner's name on the form, and owner and criticality available as list columns for oversight.
- **Actual:** The form shows "Selected owner: sxgr1xj98ojps6uq2jpl5u8y". The systems list shows Name, Type, Environment, Deployment model, Lifecycle and Internet-facing only; assets have no owner at all in the data model.
- **Evidence:** evidence/a5-system-owner-shown-as-id.jpg
- **Recommendation:** Display the owner's name, add owner and criticality columns, and let lists choose columns.
- **Impact:** UI; datamodel for an asset owner (frozen: needs a contract-gap record).
- **Related:** ADMIN-03, UX-02.
- **Proposed phase:** Phase 10: Existing-flow gap closure

## Dashboards and reports

### UAT-058 Risk and treatment owners cannot see the risks and treatments assigned to them

**Gap** · **major** · dashboards and reports · Intent: Q1, O1, Q5

- **Actors:** Requestor (as risk or treatment owner)
- **Route:** /app, /app/assessments/{id}, /app/risks
- **Steps:** After release, sign in as Jane, who is risk owner on all four UAT-A risks and treatment owner on two, and look for "my risks" or "my treatments".
- **Expected:** Owners see what they own, with target dates and status, and are told when something is due (Q1 for the requestor; brief §10 "requests requiring action").
- **Actual:** The requestor dashboard has no risk or treatment widget; the Risk Register is analyst-only; the released view does not even show who owns each risk or its target date (UAT-033). Nothing tells Jane she owns treatments due in February 2027.
- **Evidence:** JOURNEYS.md area 8 (requestor widget inventory); area 2 ("After release: requestor").
- **Recommendation:** Add "My risks and treatments" for any user named as risk, treatment or control owner, scoped server-side to records they own, with due-soon and overdue flags, and owner-editable treatment progress once post-release tracking exists (UAT-046).
- **Impact:** API (an owner-scoped risk read with record-level checks and a catalogue grant for the Requestor role); UI; operator decision (whether non-analyst owners may update treatment progress).
- **Related:** RISK-01 (analyst-only register, STATE L173); NOTIFY-01; UAT-046.
- **Proposed phase:** Phase 20: Oversight registers and post-release tracking

### UAT-059 The dashboards show current counts only, without the management metrics the intended product asks for

**Gap** · **major** · dashboards and reports · Intent: Q1, O1

- **Actors:** Security Analyst, risk manager, leadership
- **Route:** /app/review, /app/reports/*
- **Steps:** Look for ageing, cycle time, trends, a heat map, breakdowns and AI job health on the analyst dashboard and reports.
- **Expected:** "Informative dashboards with impactful metrics and information" (Q1): work by stage with ageing, cycle time and time to release, throughput, open risks by residual rating over time, an inherent-versus-residual heat map, overdue treatments by owner, upcoming reviews, top Risk Types, control effectiveness, exposure by assessment type, division, business unit and system, and failed AI jobs.
- **Actual:** The analyst dashboard shows current counts and short lists only; reports add releases per month, a median time to release and top exposed systems. There is no ageing, per-stage cycle time, trend, heat map, per-owner or per-analyst view, type, division or business-unit breakdown, or AI job health. Some metrics cannot be computed today: likelihood and consequence are free text (UAT-008), stage timestamps are overwritten on revert or return, jobs are held in memory, and there is no assignee.
- **Evidence:** JOURNEYS.md area 8; REPORT.md dashboard metrics proposal (feasibility per metric).
- **Recommendation:** Deliver the metric set in REPORT.md section 4 in two steps: first the metrics today's data supports, then those needing history, assignment or controlled scales.
- **Impact:** API (new aggregate reads with grants; closed report keys per 07 D-13, D-14); datamodel for status history and job history (frozen: contract-gap records); new dependency possibly (charting; 07 D-19 rules it out today); operator decision (which metrics and audiences).
- **Related:** DASH-01, DASH-02; 07 D-01, D-13, D-14, D-19.
- **Proposed phase:** Phase 21: Management dashboards and metrics

### UAT-001 The analyst lands on a requestor dashboard that shows none of their review work

**UX** · **minor** · dashboards and reports · Intent: Q1, Q5, R2

- **Actors:** Security Analyst
- **Route:** /app
- **Steps:** Sign in as the Security Analyst and read the landing page.
- **Expected:** The analyst's first screen says what needs their attention: requests to pick up, questionnaires and drafts to review, jobs running or failed, overdue treatments (Q1; brief §10 Security Analyst Dashboard).
- **Actual:** `/app` (sidebar label "Workspace", heading "Dashboard") shows only the owner-scoped requestor widgets for the analyst's own requests: lifecycle tiles, "Draft requests", "Questionnaires in progress" and "Recently released assessments", mostly zeros. The review queue (9 requests needing attention, 6 overdue items) is on a separate "Analyst dashboard" item at `/app/review`.
- **Evidence:** evidence/a1-analyst-landing-dashboard.jpg
- **Recommendation:** Give each actor one landing dashboard. For analysts, lead with the queue, jobs and alerts and show their own requests as a secondary panel, or route analysts to the analyst dashboard and drop the second "dashboard" item.
- **Impact:** UI only.
- **Related:** DASH-01, REQ-05, 06.3 owner-scoped screens decision, 07 D-15 (fixed routes).
- **Proposed phase:** Phase 11: Navigation, landing and list clarity

### UAT-003 The requestor dashboard's lifecycle tiles count work that is waiting on the analyst as if it were the requestor's

**UX** · **minor** · dashboards and reports · Intent: Q1, Q5

- **Actors:** Requestor
- **Route:** /app, /app/requests?status=questionnaire-in-progress, /app/requests/{id}
- **Steps:** Sign in as Jane. Compare the "Questionnaire in progress" tile with the "Questionnaires in progress" panel, then open the three requests behind the tile.
- **Expected:** The requestor can tell at a glance what needs their action and what is waiting on someone else (Q5 "the requestor feels guided").
- **Actual:** The tile says 3 requests are "Questionnaire in progress" but the panel lists 1 questionnaire needing input. Of the three requests, one has a questionnaire still in analyst review (stepper "Questionnaire generated", next action "The work is waiting with the other party."), and one has no questionnaire at all (stepper "Submitted"; a seeded fixture). The stored status label is shown to the requestor either way, and "the other party" does not say who.
- **Evidence:** Jane's `/app` (tile 3, panel 1) and the three request pages, recorded in JOURNEYS.md (area 1).
- **Recommendation:** Split the requestor's summary into "Needs your action" and "With the Security Analyst", driven by the derived lifecycle rather than the stored request status, and name the actor in the next-action text.
- **Impact:** UI only.
- **Related:** REQ-05, 06.8 request hub and stepper, 08-UI-REVIEW L372-374 (draft card copy, known).
- **Proposed phase:** Phase 11: Navigation, landing and list clarity

### UAT-004 On a phone the requestor dashboard fills the first two screens with seven status tiles before anything actionable

**UX** · **minor** · dashboards and reports · Intent: Q1, Q5

- **Actors:** Requestor
- **Route:** /app at 375
- **Steps:** Sign in as Jane at 375×812 and read the first screen.
- **Expected:** The first screen on a phone shows what the requestor has to do next.
- **Actual:** The seven lifecycle tiles stack one per row (about 90px each). The first screen shows the heading, "Create request" and five tiles; "Questionnaires in progress", the only actionable panel, starts on the third screen.
- **Evidence:** evidence/a1-requestor-dashboard-375.jpg
- **Recommendation:** On narrow widths, put the action panel first and collapse the lifecycle tiles into a compact two-column grid or a single summary line.
- **Impact:** UI only.
- **Related:** brief §12 (stacked dashboard cards).
- **Proposed phase:** Phase 11: Navigation, landing and list clarity

### UAT-048 Some oversight views stop short of the records behind them

**UX** · **minor** · dashboards and reports · Intent: O1, Q1

- **Actors:** Security Analyst
- **Route:** /app/reports/risk-exposure, /app/reports/assessment-throughput, /app/risks (Related assessment filter)
- **Steps:** From each report, try to reach the records behind a figure; filter the register by the payroll assessment by name.
- **Expected:** Every figure and row leads to the filtered list behind it, and pickers find records by the names people use.
- **Actual:** The exposure report's "Most exposed Information Systems" rows do not link; the throughput report has no links at all; the register's Related assessment picker matches only assessment numbers ("payroll" finds nothing, "2XX26G" finds UAT-A). Reports are tables only, with no trend over time except releases per month.
- **Evidence:** JOURNEYS.md area 5 (Reports table and register checks).
- **Recommendation:** Link every figure and row to its filtered list, search assessments by request title, and add simple trend charts where the question is about change over time.
- **Impact:** UI; API (assessment search by request title); new dependency possibly (charting, which 07 D-19 currently rules out).
- **Related:** DASH-02; 07 D-19.
- **Proposed phase:** Phase 11: Navigation, landing and list clarity

### UAT-060 Risk exposure counts unreleased draft and in-review risks as open exposure without saying so

**Defect** · **minor** · dashboards and reports · Intent: Q1, O1

- **Actors:** Security Analyst, risk manager
- **Route:** /app/review, /app/reports/risk-exposure, /app/risks?state=open
- **Steps:** Add ten unreleased risks to UAT-C (in review) and read Risk exposure.
- **Expected:** Exposure separates accepted (released) risks from proposals still under review, or labels what it includes.
- **Actual:** The exposure widget moved to High 10, Moderate 13, Low 3 as soon as UAT-C's AI-proposed and draft risks existed, before any review or release. "Open contextual Risks" includes risks from draft and in-review assessments, so an AI proposal counts the same as an accepted risk.
- **Evidence:** JOURNEYS.md area 8 (Risk exposure row).
- **Recommendation:** Default exposure to released risks, with a separate "under assessment" figure, and state the rule on the widget and report.
- **Impact:** UI; API (a status dimension on the exposure aggregate).
- **Related:** DASH-01; 07 D-01.
- **Proposed phase:** Phase 11: Navigation, landing and list clarity

## Navigation

### UAT-002 The analyst sidebar mixes personal and review items in one ungrouped list of ten, with labels that differ from the pages they open

**UX** · **minor** · navigation · Intent: Q2

- **Actors:** Security Analyst
- **Route:** sidebar on every /app route
- **Steps:** Sign in as the analyst at 1440 and read the sidebar; open each item and compare the label with the page heading.
- **Expected:** A sidebar divided into clear sections, so it is obvious what each item does (Q2).
- **Actual:** Ten ungrouped items come first: Workspace, My Requests, My Questionnaires, My Risk Assessments, New request, Analyst dashboard, Assessment Requests, Questionnaires, Risk Assessments, Risk register. Only "Reports" (Alerts, Reports) and "Administration" (four items) have headings. "My Questionnaires" sits next to "Questionnaires" and "My Risk Assessments" next to "Risk Assessments" with nothing saying which is personal and which is the review queue. Six labels differ from the page heading: Workspace → "Dashboard", New request → "New assessment request", Assessment Requests → "Assessment request review", Questionnaires → "Questionnaire Review", Risk Assessments → "Risk assessment review", Risk register → "Risk Register". There are no counts or badges on any item.
- **Evidence:** evidence/a1-analyst-landing-dashboard.jpg; navigation tree recorded for all actors at 1440 and 375 in JOURNEYS.md (area 1).
- **Recommendation:** Section the sidebar by job (for example "My work", "Review", "Oversight", "Reference data"), make labels match page headings, and show queue counts on review items. See the proposed sidebars in REPORT.md.
- **Impact:** UI only.
- **Related:** 07-UI-SPEC UI-D2 (two labelled groups after the ungrouped items); 08-UI-REVIEW L289 ("Questionnaire Review" title case, known).
- **Proposed phase:** Phase 11: Navigation, landing and list clarity

## CSV

### UAT-049 Nothing can be exported: no CSV or XLSX from any register, list, assessment, report or queue

**Gap** · **major** · CSV · Intent: Q3, O1

- **Actors:** Security Analyst, Requestor, risk manager
- **Route:** /app/risks, /app/review/*, /app/reports/*, /app/alerts, /app/admin/*, /app/assessments/{id}, /app/requests
- **Steps:** Look for export, download, copy or print on 20 routes as analyst and requestor.
- **Expected:** "Smooth CSV import and export" (Q3): the register, an assessment's risks, reports, queues and reference lists export to CSV (and XLSX for Excel users), following the current filters and the viewer's authorisation.
- **Actual:** No screen offers any export, download or print. The only downloads are the import templates and the import error and result reports. The API has no export operation (`GET /risks/export` and `POST /reports/{key}/export` are catalogued but unserved).
- **Evidence:** JOURNEYS.md area 6 ("Export inventory"); `served-operations.json` unserved list.
- **Recommendation:** Add export to the register, assessment risks, lists and reports as specified in REPORT.md (CSV import and export requirements): current filters and sort, column choice, CSV and XLSX, authorised scope, and neutralised formula-like values.
- **Impact:** API (export operations with exact grants that reuse each list's filters and record-level scope; streaming for large registers); new dependency likely for XLSX; operator decision (formats, and whether requestors may export their released assessments).
- **Related:** served operations "Deferred beyond this milestone" (risk export, report export); 07 D-06; 01 D-15 (no frontend facade, so export must be a Strapi operation).
- **Proposed phase:** Phase 19: CSV export and import hardening

### UAT-050 Risks, control implementations and requests cannot be imported; import covers only the four reference lists

**Gap** · **major** · CSV · Intent: Q3, Q4

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}, /app/risks
- **Steps:** Look for a way to bring an existing risk list (for example from a vendor's workbook) into an assessment, or to map existing controls in bulk.
- **Expected:** Rows from a spreadsheet can be added to an assessment's risks and control implementations with the same preview and validation as reference imports.
- **Actual:** Import exists only for Risk Types, Controls, Information Systems and Information Assets. Risks are added one at a time through a 34-field form (about 25 fields filled per manual risk in UAT-A), and control implementations one at a time through a 2,647-option dropdown.
- **Evidence:** JOURNEYS.md area 2 (F7 add, F9 controls) and area 6 ("Beyond Administration").
- **Recommendation:** Add "Import rows" to an assessment's risk table (create and update by risk number, with the same five-step preview), and bulk control-implementation import keyed by risk number and control number. Keep request intake form-based.
- **Impact:** API (bulk risk and control-implementation operations with preview and exact grants; per-row validation matching the single-risk rules); UI.
- **Related:** ADMIN-04; STATE L126, L140, L153 (per-risk, changed-fields-only edits; no bulk endpoint).
- **Proposed phase:** Phase 18: Risk table and spreadsheet interoperability

### UAT-051 Import is strict in ways that trip up spreadsheet users, and its templates and reports are not spreadsheet-friendly

**UX** · **minor** · CSV · Intent: Q3

- **Actors:** Security Analyst
- **Route:** /app/admin/{collection}/import
- **Steps:** Import files prepared as a spreadsheet user would: capitalised headers and an extra column; saved with Excel's default Windows encoding; Yes/No and Y flags; a blank cell to clear a value; then open the error report in Excel.
- **Expected:** Tolerant, well-explained import (Q3 "smooth"): headers matched regardless of case, unknown columns ignored with a warning, clear advice for encoding problems, common boolean spellings accepted, and error reports that can be corrected and re-imported.
- **Actual:** "Name,Description" plus an "Owner" column rejects the whole file with "Invalid Administration CSV: the file contains an unsupported header." (the header is not named). A Windows-1252 file is rejected with "the file is not valid UTF-8." and no advice. "Yes", "No" and "Y" are rejected ("must be true or false"), though "TRUE" and "FALSE" pass. A blank cell never clears a value. Templates are header-only with API names (`controlNumber`, `internetFacing`) and no example row; the error report (`rowNumber,naturalKey,state,issues`, no BOM) omits the original values. Owners and applicable controls cannot be imported. What works well: BOM, CRLF, quoted commas, doubled quotes and in-cell line breaks, leading zeros, case-insensitive enum values, row numbers that match Excel, and update previews that show "field: old → new".
- **Evidence:** evidence/a6-import-unsupported-header.jpg; JOURNEYS.md area 6 (test file table).
- **Recommendation:** Match headers case-insensitively (and by display label), warn on and ignore unknown columns, name the offending header, detect Windows-1252 and explain "Save as CSV UTF-8", accept Yes/No/Y/N, support an explicit "clear" token, ship templates with display headers, an example row and a notes sheet (XLSX), and make the error report the original rows plus an "issues" column.
- **Impact:** UI; API (parser tolerance and error details are server-side).
- **Related:** ADMIN-04; STATE L225-233 (import commit rules); 08-UI-REVIEW L375 (CSV review copy, known).
- **Proposed phase:** Phase 19: CSV export and import hardening

### UAT-052 A differently-cased name in an import silently becomes an update of an existing record

**Defect** · **minor** · CSV · Intent: Q3, O2, brief §9

- **Actors:** Security Analyst
- **Route:** /app/admin/information-systems/import
- **Steps:** Import a row named "uat-b: core customer billing system" while "UAT-B: Core customer billing system" exists.
- **Expected:** "Make duplicate or ambiguous matches visible rather than silently overwriting records" (brief §9): a near-match is flagged for a decision.
- **Actual:** The row was classified as a plain "Update" (with a field diff among the other updates) and, once confirmed, replaced the existing system's description and hosting location. The name kept its original case. Nothing marked the match as case-insensitive.
- **Evidence:** JOURNEYS.md area 6 (`is-1` row); the round-trip import `is-2-roundtrip` restored the values.
- **Recommendation:** Flag case- or whitespace-only matches as "Matched by similar name" needing an explicit choice (update the existing record or skip).
- **Impact:** API (classification) and UI.
- **Related:** ADMIN-04; STATE L225-233.
- **Proposed phase:** Phase 19: CSV export and import hardening

## Risk table

### UAT-055 An assessment's risks can only be edited one 34-field card at a time, with no table view

**Gap** · **major** · risk table · Intent: Q4, F7, Q5

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** On UAT-C's ten-risk assessment, set treatment owner, target date and treatment status on every risk and review each residual rating.
- **Expected:** "The risks in each risk assessment … have a table format like SharePoint Tables or Excel" (Q4): all risks visible as rows, edited in place, saved together.
- **Actual:** Each risk is a card with all 34 fields expanded (2,438–2,518px tall). The first risk starts at y 12,378, below the details form and a 146-row readiness list, and the page is 37,251px tall. The update took 60 clicks, 110 keystrokes, about 36,800px of scrolling and ten separate saves with no confirmation; a person would need roughly 3–4 minutes for three fields on ten risks. Risks are ordered by risk number, which interleaves AI and manual risks; there is no sort, filter, search or collapse. The requestor's released view is a read-only card list.
- **Evidence:** evidence/a7-ten-risk-editor-readiness-146.jpg; JOURNEYS.md area 7 ("Reviewing and updating ten risks today").
- **Recommendation:** Build the risk table specified in REPORT.md (risk table requirements): configurable columns, sort, filter, frozen first column, saved views, inline editing with per-cell validation, batch save and undo, with the card kept as a detail panel.
- **Impact:** UI; API (bulk risk update with exact grants and conflict handling); new dependency possibly (grid component; licensing to settle in research); operator decision (the table approach).
- **Related:** ASSESS-03; STATE L126, L140, L153 (per-risk, changed-fields-only writes); 06.6 D-02 (DataTable extended, never forked); UAT-011 (readiness list).
- **Proposed phase:** Phase 18: Risk table and spreadsheet interoperability

### UAT-056 Copying risks out of CSRM gives a single column of labels and values, not rows and columns

**Gap** · **major** · risk table · Intent: Q4, Q3

- **Actors:** Requestor, Security Analyst
- **Route:** /app/assessments/{id}, /app/review/assessments/{id}
- **Steps:** Select the risks on Jane's released view (and one risk in Bob's editor), press Ctrl+C, and paste into a spreadsheet.
- **Expected:** A copied range pastes into Excel and SharePoint's grid view as rows and columns (Q4 "copy and pasting across both").
- **Actual:** The clipboard held text with one value per line ("RSK-2026-0520P7", statement, "Inherent risk rating", "High", …, "Control reference", "mgin2kcqf3xcv4npn7ehmk0x"), no tab characters and no HTML table, so a spreadsheet receives one long column; controls appear as internal IDs.
- **Evidence:** JOURNEYS.md area 7 ("Copying risks out"); clipboard capture in `area7-clipboard` data.
- **Recommendation:** Copy selected rows or cells from the risk table as tab-separated text plus an HTML table (header row optional), with display values (names, dates, ratings) rather than IDs.
- **Impact:** UI only for copy; see UAT-049 for file export.
- **Related:** UAT-033 (control IDs on the released view).
- **Proposed phase:** Phase 18: Risk table and spreadsheet interoperability

### UAT-057 Pasting an Excel or SharePoint range into the risk editor drops everything into one text box

**Gap** · **major** · risk table · Intent: Q4

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}
- **Steps:** Copy a range of three rows by four columns (Risk statement, Inherent rating, Residual rating, Treatment owner) as Excel does (tab-separated text plus an HTML table) and press Ctrl+V in a risk's "Risk statement".
- **Expected:** The range maps to columns and rows, adds rows past the end, converts values such as "High", and previews changes and errors before applying (Q4; brief area 7).
- **Actual:** The whole block, tabs and line breaks included, went into that one "Risk statement" box. The rating and owner fields were untouched, no rows were added, and nothing warned; saving would have stored the block as the statement.
- **Evidence:** evidence/a7-excel-range-pasted-into-one-field.jpg
- **Recommendation:** Handle multi-cell paste in the risk table with column mapping, type conversion, a change and error preview, and an all-or-nothing apply (see REPORT.md risk table requirements).
- **Impact:** UI; API (bulk create and update with per-row validation).
- **Related:** UAT-050 (no risk import).
- **Proposed phase:** Phase 18: Risk table and spreadsheet interoperability

## Roles and administration

### UAT-061 There is no Admin role and no user or role management; analysts carry the administration duties

**Gap** · **major** · roles and administration · Intent: R1, R2, O2

- **Actors:** Admin (intended), Security Analyst
- **Route:** /app/admin/*, (none for users and roles)
- **Steps:** Look for an Admin role, a user list, role assignment and list configuration; check who can edit the libraries.
- **Expected:** "Admin - managing roles, registers, list, etc." (R1): an Admin manages users' roles, registers and reference lists, separate from analysts doing assessments.
- **Actual:** The catalogue defines Requestor (automatic), Security Analyst and the Security Analyst Agent service role. Every Administration function (Risk Types, Controls, Systems, Assets, imports) is granted to Security Analyst. Roles are assigned outside the web app; there is no user list, role assignment, role-change audit, or configuration of lists such as divisions, business units, likelihood and consequence scales or assessment types. The development sign-in has no Admin identity.
- **Evidence:** JOURNEYS.md area 10; catalogue roles (three); served operations (no IAM or user-management routes).
- **Recommendation:** Introduce an Admin role that owns reference data and product configuration (lists, scales, AI-eligible Risk Types, retention), with analysts keeping read access. Keep identity and role assignment in the identity platform (IdamBox and Keycloak), exposing in CSRM at most a read-only "who holds which role" view, unless the operator accepts the risk of role management over HTTP with dual control and audit.
- **Impact:** API (new role in both catalogue copies, re-granted Administration functions, configuration operations); datamodel (frozen: configurable lists and scales need entities; contract-gap records); operator decision: reverses the two-human-role model (Requestor birthright plus Security Analyst; PROJECT.md L51, STATE L44, 08 D-17) and touches 08 D-36/D-44 if role management returns to the API; depends on INT-02 for real identities.
- **Related:** ADMIN-01 to ADMIN-04; 08 D-36, D-37, D-44; INT-02; O-5 (separation of duties).
- **Proposed phase:** Phase 22: Admin role and configurable lists

## Accessibility and responsiveness

### UAT-038 On a phone the request's lifecycle stepper takes more than a screen before the next action

**UX** · **minor** · accessibility and responsiveness · Intent: Q5, brief §12

- **Actors:** Requestor, Security Analyst
- **Route:** /app/requests/{id}, /app/review/requests/{id} at 375
- **Steps:** Open the UAT-B request at 375×812.
- **Expected:** The current state and the next action on the first screen.
- **Actual:** The eight steps stack vertically in an 880px block; "Next action" is at y 1,620, two screens down.
- **Evidence:** JOURNEYS.md area 3, row "Request hub".
- **Recommendation:** On narrow widths show "Step 2 of 8: Submitted" with the next action and let the full stepper expand on demand.
- **Impact:** UI only.
- **Related:** 06.8-07 shared stepper; 08-UI-REVIEW L283-285 (stepper wording at 1440, known).
- **Proposed phase:** Phase 11: Navigation, landing and list clarity

### UAT-039 The analyst editors are not practical on a phone

**UX** · **minor** · accessibility and responsiveness · Intent: Q4, brief §12

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}, /app/review/questionnaires/{id} at 375
- **Steps:** Review and edit UAT-B's questionnaire and assessment at 375×812.
- **Expected:** A presentation designed for a phone (brief §12: "do not allow desktop layouts simply to shrink onto mobile").
- **Actual:** The assessment editor is 21,784px tall for three risks (every risk's 34 fields expanded, about 27 screens). Editing the fourth question opened its form 2,618px below the viewport. There is no overflow and everything works, but reviewing on a phone means long scrolling with no summary or jump list.
- **Evidence:** JOURNEYS.md area 3, rows "Question editor" and "Assessment editor".
- **Recommendation:** Collapse risks to summary rows that expand one at a time (the risk table's mobile presentation), and edit questions in place.
- **Impact:** UI only.
- **Related:** UAT-005; risk table requirements (REPORT.md).
- **Proposed phase:** Phase 18: Risk table and spreadsheet interoperability

### UAT-063 Keyboard users must tab through the whole readiness list to reach the risks

**UX** · **minor** · accessibility and responsiveness · Intent: F7, brief §21

- **Actors:** Security Analyst (keyboard only)
- **Route:** /app/review/assessments/{id}
- **Steps:** On UAT-C's ten-risk assessment, tab from the top of the page to the first risk and to its "Save risk".
- **Expected:** A quick way to reach the risks and each risk (brief §21 keyboard operability; WCAG 2.4.1 bypass blocks).
- **Actual:** 177 Tab presses to reach the first risk's first field, 146 of them the readiness links, and 228 to its "Save risk". The skip link goes to the top of the main content only; there is no link or landmark to jump to "Identified Risks" or between risks.
- **Evidence:** JOURNEYS.md area 11 ("Keyboard only").
- **Recommendation:** Collapse the readiness list to per-risk summaries (UAT-011), add in-page navigation to the risks, and use the grid's keyboard model once the risk table exists.
- **Impact:** UI only.
- **Related:** UAT-011, UAT-055; INT-04.
- **Proposed phase:** Phase 18: Risk table and spreadsheet interoperability

### UAT-064 In questionnaire radio groups, arrow keys move focus without selecting the option

**Defect** · **minor** · accessibility and responsiveness · Intent: F5, brief §21

- **Actors:** Requestor (keyboard or screen reader)
- **Route:** /app/questionnaires/{id}
- **Steps:** Tab to a Yes/No question, press Space on "Yes", then press the Down arrow.
- **Expected:** The ARIA radio group pattern: arrow keys move to and select the next option.
- **Actual:** Focus moved to "No" but "Yes" stayed selected (`aria-checked` unchanged); a screen reader user hears "No" and may think it is chosen.
- **Evidence:** JOURNEYS.md area 11 ("Keyboard only"); `aria-checked` states before and after the arrow key.
- **Recommendation:** Make selection follow focus in radio groups, as the pattern expects.
- **Impact:** UI only.
- **Related:** QUES-02; INT-04.
- **Proposed phase:** Phase 10: Existing-flow gap closure

## Security

### UAT-062 Analyst pages opened by a requestor show analyst actions or an error instead of a clean "no access"

**Defect** · **minor** · security · Intent: R3, observation

- **Actors:** Requestor
- **Route:** /app/review/questionnaires/{own id}, /app/review/requests/{own id}, /app/review/assessments/{own id}
- **Steps:** As Jane, open the analyst URLs for her own questionnaire, request and released assessment.
- **Expected:** Requestors reach only requestor pages; an analyst URL shows the permission state, and never offers analyst actions (AGENTS.md: navigation visibility is not authorisation; the server must refuse, and the interface should not invite the attempt).
- **Actual:** The analyst questionnaire page rendered for her own questionnaire with "Return to analyst review" (timeline correctly redacted to "by An analyst"); pressing it with a reason was refused inside the dialog: "You do not have permission to govern this questionnaire." The analyst request hub rendered her own request. The analyst assessment route showed "We couldn't load this assessment. Try again." The server enforced every refusal and no other requestor's data appeared, so this is not an isolation failure.
- **Evidence:** JOURNEYS.md area 10 (direct URL checks).
- **Recommendation:** Gate analyst routes on the analyst capability before rendering, show the permission state, and hide analyst-only actions for requestors even on their own records.
- **Impact:** UI only.
- **Related:** FOUND-04; 06.3 separate owner and review surfaces; R-08-15 (HTTP 200 on refused pages, known).
- **Proposed phase:** Phase 10: Existing-flow gap closure

## Content

### UAT-022 Submit dialogs say "irreversible" and "cannot be edited", then the page offers Return to draft

**Defect** · **minor** · content · Intent: Q5

- **Actors:** Requestor
- **Route:** /app/requests/{id}, /app/questionnaires/{id}
- **Steps:** Submit a request, then a questionnaire.
- **Expected:** Copy that matches what the product allows.
- **Actual:** Request: "Submission is irreversible. This request cannot be edited after submission." then a "Return to draft" button. Questionnaire: "Submission is irreversible. This questionnaire cannot be edited after submission." then "read-only and can no longer be edited" beside "Return to draft", which reopens it.
- **Evidence:** JOURNEYS.md area 2, rows "F1 submit" and "F5 submit".
- **Recommendation:** Say what happens next and how to change it ("You can return it to draft until the analyst starts the questionnaire").
- **Impact:** UI only.
- **Related:** REQ-06, QUES-06.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-024 Revision timelines show UTC clock times as if local, and name questions by internal key

**Defect** · **minor** · content · Intent: A2, observation

- **Actors:** Requestor, Security Analyst
- **Route:** /app/review/questionnaires/{id}, /app/questionnaires/{id}
- **Steps:** Edit questions at 15:47 local time (UTC+10) and read the timeline.
- **Expected:** Local times (or an explicit zone) and the question's text.
- **Actual:** "27 Sept 2026, 5:47 am by Bob Doe — Question: q-14". Every event names questions as "q-1", "q-9" and so on; the requestor sees "8 questions added or changed" for a round that changed 4.
- **Evidence:** JOURNEYS.md area 2 (note under the table).
- **Recommendation:** Format in the viewer's time zone, quote the question text (and the change), and count changes per round.
- **Impact:** UI only.
- **Related:** 06.8-06 revision timeline.
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-036 Actions that can no longer succeed stay on offer, and their refusals say "changed, reload and try again"

**Defect** · **minor** · content · Intent: Q5

- **Actors:** Security Analyst, Requestor
- **Route:** /app/review/requests/{id}, /app/questionnaires/{id}
- **Steps:** (1) As Bob, "Return to draft" on UAT-B's request after its questionnaire was generated. (2) As Jane, "Return to draft" on UAT-B's submitted questionnaire after the analyst drafted the assessment.
- **Expected:** The action is hidden or disabled with the reason ("A questionnaire already exists", "The analyst has started the assessment"), or the refusal names that reason.
- **Actual:** Both dialogs accept a mandatory reason and then refuse inside the dialog with "This request changed while you were editing it. Reload and try again." and "This questionnaire changed or is no longer answerable. Reload and try again." Nothing changed, and reloading does not help. Jane's request page correctly hides the action in case (1); the analyst's does not.
- **Evidence:** evidence/a3-refusal-misleading-message-375.jpg; JOURNEYS.md area 3 (refusal rows).
- **Recommendation:** Derive action availability from the same rules the server applies, and map each conflict to a specific, plain message.
- **Impact:** UI; API (return a reason code with each 409).
- **Related:** REQ-06, QUES-06; UAT-016 (same message pattern).
- **Proposed phase:** Phase 10: Existing-flow gap closure

### UAT-065 The requestor sees "Approved" for a request whose assessment is "Released"

**UX** · **minor** · content · Intent: Q5, F10

- **Actors:** Requestor
- **Route:** /app, /app/requests
- **Steps:** After UAT-A and UAT-B were released, read Jane's dashboard and My Requests.
- **Expected:** One word for one event in the requestor's language.
- **Actual:** The request tiles and status say "Approved 5" while "Recently released assessments 5" and each assessment say "Released"; nothing explains that they are the same outcome.
- **Evidence:** JOURNEYS.md area 8 (requestor widget inventory).
- **Recommendation:** Show "Released" (or "Assessment released") as the request's display label too, keeping the stored value.
- **Impact:** UI only; operator decision (CONTEXT.md keeps the request label "Approved"; STATE L59, D-50).
- **Related:** CONTEXT.md "Released"; D-50.
- **Proposed phase:** Phase 11: Navigation, landing and list clarity

### UAT-054 Interface copy names the back-end system and internal concepts

**Defect** · **cosmetic** · content · Intent: Q5, brief §33

- **Actors:** Security Analyst
- **Route:** /app/review/assessments/{id}, /app/admin/{collection}/import
- **Steps:** Read the release readiness panel and the import confirmation and error messages.
- **Expected:** Plain product language (brief §33: "do not expose the complexity of the underlying … data model").
- **Actual:** "Strapi rechecks every item when release is requested."; "Strapi will validate and classify the same file again before writing."; "Invalid Administration CSV: …"; "Natural-key matches update existing Risk Types."; "Contextual Risks", "reusable non-editable references".
- **Evidence:** evidence/a7-ten-risk-editor-readiness-146.jpg ("Strapi rechecks every item when release is requested."); JOURNEYS.md areas 2 and 6 (quoted copy).
- **Recommendation:** Replace with user terms ("We check everything again when you release", "Rows that match an existing name update it").
- **Impact:** UI only.
- **Related:** 08-UI-REVIEW L375 (CSV review copy, known).
- **Proposed phase:** Phase 10: Existing-flow gap closure
