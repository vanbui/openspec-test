# Phase 3 confirmed review findings (independent, adversarially verified)

## 1. [major] apps/web/src/features/questionnaires/questionnaire-renderer.tsx
**Locus:** line 349, 'Questions requiring attention' section (role="alert")
**Claim:** The permanently rendered unanswered-questions panel is marked role="alert", making a non-event, pre-submission guidance region an assertive live region.
**Scenario:** A screen-reader user opens a fresh questionnaire with required questions: the full 'Questions requiring attention' list is announced assertively on page load before they have done anything, and is re-announced every time the list content changes as they answer each question (the alert's children mutate on each answer), interrupting form entry repeatedly; it should be a plain labelled region (or role="status" at most) with role="alert" reserved for the submit-failure banner.

## 2. [major] apps/web/src/features/questionnaires/questionnaire-renderer.tsx
**Locus:** lines 159-187, EditableQuestion fieldset branches (Boolean / Single select / Multi select)
**Claim:** aria-invalid and aria-describedby (the error-message id) are placed on the <fieldset> instead of on the RadioGroup/Checkbox controls, so error state never reaches the focusable controls.
**Scenario:** After a failed submit of a required Boolean question, a NVDA/JAWS user tabs to the Yes/No radios: aria-invalid on a fieldset is not exposed on the radio widgets and fieldset aria-describedby is not read when focusing individual radios, so they hear no invalid state and no error text; visually, the shadcn RadioGroupItem/Checkbox 'aria-invalid:border-destructive' styles never activate either, so choice controls show no danger border on error (text inputs do, via the same mechanism), violating the design direction's 'input border → danger' error recipe.

## 3. [minor] apps/web/src/features/questionnaires/questionnaire-renderer.tsx
**Locus:** line 352, validation-summary anchor className="text-link ..."
**Claim:** The class text-link references a semantic token that does not exist — app/globals.css defines no --color-link/--color-text-link in @theme — so Tailwind v4 emits nothing and the link color silently falls back to inherited foreground.
**Scenario:** In the 'Questions requiring attention' panel the question links render in default #101828 text on the warning-subtle background instead of the design direction's --color-text-link (#155EEF); the design system's link token for this pattern is unimplemented and the mistake is invisible at build time because unknown utilities compile to nothing (design-direction rule 15: every value referenced through a real semantic token).

## 4. [minor] apps/web/src/features/questionnaires/questionnaire-detail.tsx
**Locus:** lines 19-21 (and questionnaire-review.tsx lines 18-29, SafeReviewState)
**Claim:** The detail routes' permission/error/empty (and awaiting-submission) states render a bare Alert with no PageHeader, leaving the page with no h1 heading and no recovery action.
**Scenario:** A user without grants opens /app/questionnaires/{id} (or an analyst opens /app/review/questionnaires/{id} pre-submission): the rendered page contains no h1 at all (AlertTitle is a div; the app shell provides no page heading), breaking heading hierarchy for screen-reader navigation, and there is no CTA back to a working page — unlike the list-level permission/error states which keep the h1 PageHeader and a 'Return to workspace'/'Try again' link, and unlike the design direction's empty-state anatomy (headline + context + one CTA).

## 5. [minor] apps/web/src/features/questionnaires/questionnaire-renderer.tsx
**Locus:** line 342, draftMessage paragraph with role="status"
**Claim:** The draft-saved confirmation is a live region that is conditionally mounted only when the message exists, so most screen readers will not announce it.
**Scenario:** A screen-reader user presses 'Save draft': the <p role="status"> node is inserted into the DOM together with its text, and NVDA/VoiceOver frequently ignore live-region content that arrives with the region itself (the region must exist empty beforehand), so the only feedback for a successful draft save is silent; the visual user sees 'Draft saved. Your answers remain editable.' while the AT user gets nothing.

## 6. [minor] apps/web/src/features/questionnaires/questionnaire-renderer.tsx
**Locus:** line 346, unanswered-count copy
**Claim:** The count string is not pluralized, producing '1 required questions unanswered' when exactly one required question remains.
**Scenario:** A requestor answers all but one required question: the progress panel reads '1 required questions unanswered' (and the list card equivalent shows '1 unanswered' correctly), a grammatical error visible to every user in the most-watched element of the form.

## 7. [minor] apps/web/src/features/questionnaires/questionnaire-renderer.tsx
**Locus:** lines 343-345, progress section aria-labels
**Claim:** The wrapping <section> and the inner progressbar both carry the identical aria-label 'Questionnaire progress', so AT announces the same name twice for nested landmarks/widgets.
**Scenario:** A screen-reader user navigating by region/element hears 'Questionnaire progress, region' then 'Questionnaire progress, progress bar, N%' — duplicate names make the elements indistinguishable in the rotor/elements list; the progressbar label should describe the value context (e.g. include the answered counts) or the section should not be a separately labelled region.

## 8. [minor] apps/strapi/tests/questionnaire-workflow.integration.test.ts
**Locus:** lines 123-142, mutation-denial loop in "mounted questionnaire mutations enforce ownership, allowlisting, and immutable submitted batches"
**Claim:** The analyst-identity denial against the owner's draft questionnaire asserts only the 403 status and response-leak regex; persistence after that denial is never re-read, unlike the owner-vs-other denial which is verified via deepEqual of getQuestion before/after.
**Scenario:** If the PATCH /api/v1/questionnaires/{id}/answers handler regressed to write the forged answer before evaluating the analyst's authorization (403 returned but side effect persisted), the test still passes: ownerDraftBefore is captured at line 142 only after the analyst's denied mutation, so the tainted state becomes the baseline and no assertion detects the unauthorized write to the owner's draft.

## 9. [minor] apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts
**Locus:** summary() at lines ~113-118 (WR-02 fix d5985d5) vs its only regression test in apps/strapi/tests/questionnaire-workflow.unit.test.ts lines 114-132
**Claim:** The WR-02 pagination fix is regression-protected only by a unit test of the extracted loadCompleteQuestionnaireScope helper; no test pins the summary controller to actually use it, and mounted fixtures never exceed one page (QUESTIONNAIRE_SUMMARY_PAGE_SIZE = 1000, fixtures have at most ~5 questionnaires).
**Scenario:** Reverting summary() to the pre-fix `questionnaires().findMany({ ...dataQuery, start: 0, limit: 10_000 })` (or any single bounded page) keeps every unit, mounted, and e2e suite green, silently reintroducing the truncated status_summary/review_summary counts the WR-02 review finding was raised for once a tenant exceeds the page size.

## 10. [major] apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts
**Locus:** activeQuestionSet (lines 150-157), called by questionnaireState/projectQuestionnaire/projectQuestions; controllers/csrm-questionnaire.ts catch blocks at lines 107-110, 124-127, 166, 179-182 handle only QuestionnaireQueryError
**Claim:** Every questionnaire read projection calls parseQuestionnaireDefinition, which throws QuestionnaireDefinitionError for a questionnaire with zero questions or any question whose options JSON deviates from the contract, and no read-path controller catches it, so one bad record 500s the collection endpoints for every caller.
**Scenario:** An analyst creates a new csrm-questionnaire in the Strapi admin panel (the generate_questionnaire endpoint is not yet served, so admin creation is the only way to add one) and has not yet attached questions, or edits one question's options JSON (e.g. removes questionKey or sets schemaVersion 2). parseQuestionnaireDefinition throws at questionnaire-definition.ts:151 (empty array) or :103-119; GET /api/v1/questionnaires, GET /api/v1/questionnaires/review_summary, GET /api/v1/my_questionnaires and its status_summary for the owning requestor, and GET detail/questions for that questionnaire all return 500 - a single record takes down the entire analyst review list and workload summary until the data is repaired.

## 11. [minor] apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts
**Locus:** submitQuestionnaire, line 286: nextRequestStatusAfterDraft(String(request.requestStatus)) result is discarded and no assessment-request update is persisted (contrast saveAnswers lines 272-277)
**Claim:** submitQuestionnaire validates the submitted->questionnaire-in-progress transition but never persists it, so a questionnaire submitted without a prior draft PATCH leaves the owning assessment request stuck in requestStatus 'submitted' even though its questionnaire is fully submitted.
**Scenario:** A requestor calls POST /api/v1/questionnaires/{id}/submit with an inline answers body (the endpoint accepts one via parseAnswerMutationPayload) - or submits a questionnaire whose visible questions are all optional - while the request is in status 'submitted'. The submit succeeds and stamps every answer submittedAt, but the assessment request remains 'submitted' permanently: subsequent PATCH drafts are 409-blocked by the submitted answer batch, so the transition can never occur, and any request-status-driven view (assessment request list, phase-2 dashboards) shows the request as pre-questionnaire while the analyst questionnaire views show it ready for review.

## 12. [blocker] apps/web/src/features/questionnaires/questionnaire-renderer.tsx
**Locus:** initialValue (lines 59-64) with activeAnswerInputs (line 109)
**Claim:** Untouched Single select and Date questions initialize to '' and activeAnswerInputs only null-coalesces (values[key] ?? null), so '' is sent in the draft payload, which the server's isQuestionnaireValueValid rejects ('' is not a configured choice value and fails the date regex), failing the entire batch with 400.
**Scenario:** On the seeded questionnaire (always-visible Single select 'hosting-model' and Date 'go-live-date'), a Requestor fills only the first section and clicks 'Save draft': normalizeDraftAnswers throws QuestionnaireWorkflowError(400) on the '' value, the whole save is rejected, and the user sees 'The questionnaire answers are invalid' with no field highlighted — partial drafts can never be saved for any questionnaire containing an unanswered visible select/date question; likewise, leaving an optional select/date blank blocks submission because submitCurrent's mandatory draft save 400s. The e2e journey answers every question before the first save, and renderer tests mock the action, so nothing exercises this path.

## 13. [major] apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts
**Locus:** activeQuestionSet (line 151) via questionnaireState/projectQuestionnaire/projectQuestions; uncaught in controllers/csrm-questionnaire.ts collection()/summary()/listQuestions() which only catch QuestionnaireQueryError
**Claim:** parseQuestionnaireDefinition throws QuestionnaireDefinitionError for a questionnaire with zero questions or any invalid options JSON, and every projection call site rethrows it uncaught, so one bad questionnaire 500s the whole listMine/listAll/status_summary/review_summary response and listQuestions.
**Scenario:** An admin creates a csrm-questionnaire linked to an assessment request but has not yet added questions (or typos one question's options json): GET /v1/my_questionnaires and the requestor dashboard summary return 500 for that user, so My Questionnaires and the dashboard render the error state for ALL questionnaires; GET /v1/questionnaires/{id}/questions also 500s, making the web detail page's designed 'empty' state (checked via !questionsResult.data?.length) unreachable.

## 14. [major] apps/web/src/features/questionnaires/questionnaire-service.ts
**Locus:** listMyQuestionnaires (line 122) and listQuestionnairesForReview (line 133)
**Claim:** Both list calls send no pagination parameters and never read meta.pagination, while buildQuestionnaireCollectionQuery defaults to pageSize 25, so the My Questionnaires and Questionnaire Review pages silently truncate to the first 25 records with no pagination UI or truncation indicator.
**Scenario:** A Security Analyst whose collection scope is 'all' has 30 questionnaires across requestors: GET /v1/questionnaires returns only 25 (sorted updatedAt:desc), the review list renders 25 cards with no pager, and the 5 oldest submitted questionnaires are invisible and unreviewable from the UI (the review_summary counts, which paginate exhaustively, will disagree with the visible list).

## 15. [minor] apps/strapi/src/api/csrm-questionnaire/services/questionnaire-workflow.ts
**Locus:** submitQuestionnaire (line 286): nextRequestStatusAfterDraft(String(request.requestStatus)) result discarded
**Claim:** The submit path validates the submitted->questionnaire-in-progress transition but never persists it, unlike saveAnswers, so submitting without a prior draft save leaves the owning assessment request stuck in requestStatus 'submitted' even though every answer is now state 'submitted'.
**Scenario:** A client POSTs /v1/questionnaires/{id}/submit with an inline answers body (the endpoint accepts and merges updates) while the request is still in 'submitted' status: the questionnaire becomes submitted and the analyst can review it, but the assessment request's status never reflects that the questionnaire phase happened, leaving the JDL request lifecycle inconsistent for downstream status-driven views.

## 16. [minor] apps/web/src/features/questionnaires/questionnaire-actions.ts
**Locus:** validationFailure (line 34) with questionnaire-renderer.tsx applyFailure (lines 222-228)
**Claim:** Zod flatten() on the action input schema yields top-level fieldError keys ('documentId', 'answers'), which applyFailure prefixes into non-existent RHF paths like 'answers.answers', so action-level validation failures highlight no field and surface only the generic fallback message.
**Scenario:** If the client ever submits a payload the action schema rejects (e.g. an answers array entry with an oversized string after a future edit), setError('answers.answers') targets no registered field: the user sees 'Check the highlighted answers and try again.' with nothing highlighted and no error-summary links, giving no way to locate the problem.

