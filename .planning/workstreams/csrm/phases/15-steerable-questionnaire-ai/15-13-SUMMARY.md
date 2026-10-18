---
phase: 15-steerable-questionnaire-ai
plan: 13
subsystem: web
tags: [nextjs, hub, generation-instruction, narrowed-replace, ai-proposals, draft-gate, context-too-large, requestor-save, session-drafts, e2e, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-08's generation instruction and narrowed replacement; 15-10's domain, copy and ContextTooLargeFailure; 15-11's InstructionField and session draft kinds; 15-12's StartProposalsButton and the signal's action slot
provides:
  - apps/csrm/src/features/questionnaire-ai/hub-proposal-job.tsx (HubProposalJob)
  - QuestionnaireGenerationJob props aiProposals, ownRequest, ownerKey; the instruction on Generate and in the Replace dialog
  - AssessmentDraftJob prop aiProposals and the draft gate line
  - AssessmentDetail props aiProposals and ownRequest
  - ConfirmDialog children (fields after the description)
  - questionnaire-domain.ts KeptUnsavedAnswer, choicesSignature, parseKeptUnsavedAnswers, keptUnsavedAnswersOf, restorableUnsavedAnswers, unsavedAnswersRestoredCaption
  - useAnswerAutosave option keepUnsaved and NOT_ANSWERABLE; QuestionnaireRenderer prop ownerKey; QuestionnaireDetail prop draftOwnerKey
affects: [15-14]
actuals:
  tasks: 4
  commits: 9
plan_head_before: 435e471
plan_head_after: 4434486
requirements-completed: []
completed: 2026-10-12
status: complete
closes: [UAT-017]
---

# Phase 15 Plan 13: Hub and Requestor Summary

**The analyst's request hub takes an optional instruction on Generate and inside Replace, offers Replace only when nothing would be lost (and otherwise says why and points at AI proposals), counts the open AI proposals, follows a proposal job started from the hub, and holds the assessment draft while proposals are open; both hub cards read `CONTEXT_TOO_LARGE` by the shared rule; and a Requestor whose questionnaire is taken back mid-answer keeps every typed answer, restored safely on the next released load.**

## What was built

- **Generate** (Task 1): `InstructionField` (kind `generation-instruction`, the request's id) above `Generate questionnaire`, §3.1's hint; the instruction goes in the start body only when given; an instruction refusal shows beside the field and keeps the text; a requesting analyst (D-32) sees §12's caption instead of the field; success clears the field and its session draft.
- **Replace** (Task 2, D-09): with the proposals read, `replaceOffer(view)` decides. Offered: Phase 10's dialog with the one §8.3 description followed by `InstructionField` (kind `replacement-instruction`). Not offered: §8.3's line for `QUESTIONNAIRE_ANSWERED`, `QUESTIONNAIRE_HAS_ANALYST_CHANGES` or `AI_PROPOSALS_OPEN`, with `Open AI proposals` or the count link to `/app/review/questionnaires/{id}#ai-proposals`. Without the read (a requesting analyst, or a failed read), Replace is offered only when the served change count is 0; a positive count shows the analyst-change line without a link; no count shows a line saying the check could not be made. The same rule governs the Replace offered after a `QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED` failure.
- **Proposals line and hub job** (D-29, D-33): `AI proposals: {n} open` (a link to the panel) or `AI proposals: none open`, never for a requesting analyst. `HubProposalJob` follows the questionnaire-wide proposal job the read serves (`panelJobOf`): `The AI is preparing follow-up questions.` (the element `StartProposalsButton` focuses), `Started by {name}.`, `Open AI proposals`, polling with `Status unavailable` and `Check again`; on completion it refreshes and shows `{n} AI proposals are ready to review.` with `Review AI proposals`, or `The AI proposed nothing new for this questionnaire.`; a failure reads Q3's copy (`CONTEXT_TOO_LARGE` by the shared rule, Q1's sentence as fallback) with `Retry AI proposals`. The hub page passes `StartProposalsButton` as the questionnaire signal's `action` when `actions.start.allowed`, otherwise `panelGuidance`'s line when there is one.
- **Hub read**: the page calls `listQuestionnaireAiProposals` alongside its other reads when the request has a questionnaire; a failure leaves the lines absent; an `OWN_REQUEST` refusal marks the requesting analyst.
- **Draft card** (D-08): while proposals are open the idle `Generate assessment draft` is replaced by `draftGateLine` with the count as a link to the panel; while a proposal job is preparing (none open yet), `The AI is preparing proposals for the questionnaire. Decide them before you generate the draft.` with `Go to AI proposals`. A refused enqueue keeps the existing refusal path (Strapi's `AI_PROPOSALS_OPEN` reads the draft card's copy from 15-10).
- **`CONTEXT_TOO_LARGE` on both cards** (D-29): `ContextTooLargeFailure` with the job's message and files, and 12 §11.2's sentence as fallback; other codes keep today's order (the draft card adds `assessmentDraftJobFailureCopy` between the shared copy and the served message).
- **Requestor's refused save** (Task 3, D-25, UI-D25): a save refused with `QUESTIONNAIRE_NOT_ANSWERABLE` stops autosave, shows §11.2's sentence and keeps the form; the hook writes `JSON.stringify(KeptUnsavedAnswer[])` under kind `unsaved-answers` (the questionnaire's id) and rewrites it on every later change while blocked; a later successful save clears it. The save before submitting, refused the same way, shows family D's §11.2 submit sentence in the dialog. On the next load in edit mode, `restorableUnsavedAnswers` keeps only answers whose question has the same key, is served and answerable, has the same answer type and choice values and holds no saved answer; they go back as unsaved edits (autosave then saves them), the caption `{n} unsaved answers were restored from earlier in this session. Check them before you carry on.` shows, and the store is cleared either way (a value that does not parse, or holds entries of another shape, restores nothing). The leave guard already warns while a save failed or waits. `session-drafts.ts` is unchanged by this plan.

## Task commits

1. Task 1: `e19b57a` (test, RED) and `e8decec` (feat).
2. Task 2: `7227244` (test, RED: 17 failures) and `c282d59` (feat).
3. Task 3: `aea92bf` (test, RED: 9 failures) and `43f171e` (feat).
4. Task 4: `4434486` (test: E2).

## Verification

- Task 1: assessments 534/534. Task 2: assessments and attachments 812/812; copy guard and boundary tests 285/285. Task 3: questionnaires, session drafts and performance guards 596/596.
- Full web unit suite: 222 files, **5,379/5,379**; typecheck and lint clean.
- Playwright (dev servers stopped; throwaway Strapi secrets exported for the run only): `questionnaire-generation-workflow.spec.ts` (E2) and `questionnaire-workflow.spec.ts` (desktop) passed; `request-attachments.spec.ts`, `request-pick-up.spec.ts`, `ai-context-provenance.spec.ts` and `quick-find.spec.ts` passed in the desktop project and their `@journey` tests in the mobile project: **62 of 63** first run, the one failure `COLLAB02_OTHER_REQUESTOR_NOT_FOUND` (desktop) on a Chromium `Network.getResponseBody` protocol error while reading a replayed action's response (it passed in the mobile project in the same run); re-run once as a flake: **1/1**. Desktop `performance.spec.ts` **11/11**.
- `git diff --name-only 15eb830b -- apps/csrm/e2e/performance.spec.ts apps/csrm/e2e/request-attachments.spec.ts apps/csrm/e2e/request-pick-up.spec.ts apps/csrm/e2e/ai-context-provenance.spec.ts apps/csrm/e2e/quick-find.spec.ts` prints nothing; `git status --short` empty after the runs.

## Budget

Desktop run of 2026-10-12, 16:05:41 to 16:06:46 UTC.

| Route | Actor | Delivered JS bytes | 15-12's figure | Change | Budget | Headroom | Fallback if grown |
|---|---|---|---|---|---|---|---|
| `/app/risks/{documentId}` | Security Analyst | 293,871 | 293,859 | +12 | 300,000 | 6,129 | — (noise) |
| `/app/requests/{documentId}` | Requestor | 298,054 | 297,954 | +100 | 300,000 | 1,946 | `ConfirmDialog`'s children slot ships on this route; if needed, move the stale badge out of the shared `aiReview` family (15-11's named fallback) |
| `/app/questionnaires/{documentId}` | Requestor | 361,767 | 360,351 | +1,416 | 500,000 (override) | 138,233 | The renderer now imports `refusal-copy.ts` for the submit sentence and the session draft reader; if needed, have the save action return the submit sentence with its refusal so the renderer imports no copy module |

## Existing assertions changed deliberately

- **U3** (Phase 10's Replace variants): `questionnaire-generation-job.test.tsx` "states what a replacement discards when the served count is %s" (four variants) became one test of the single description and the instruction field; the dismiss, pending and refusal tests and "offers Replace questionnaire through the confirmation when the replacement was not acknowledged" now pass a count of 0 (and the last asserts the single description); "sets the slot above the idle action" and "shows the error inside the replacement confirmation when the replacement action throws" pass a count of 0. `assessment-review-workflow.test.tsx` "offers Replace questionnaire with the served change count…" became "offers no Replace once analysts changed the questionnaire, and says why", "says it cannot count the changes…" became "offers no Replace when the hub was given no count…", and "hands each card its own target’s slot…" passes a count of 0. `analyst-route-gate.test.tsx` "reads the questionnaire summary for the change count a replacement discards" and "confirms a replacement without a count…" now assert no Replace (with the analyst-change line for a count of 2).
- **U4** (families C and D): the save refusal's sentence was already §11.2's (15-10); what changed is the submit dialog, which now reads family D's §11.2 sentence when the save before submitting is refused with `QUESTIONNAIRE_NOT_ANSWERABLE` (it read the save sentence). The existing blocked-save test is unchanged; the new cases are additions.
- **E2** (`questionnaire-generation-workflow.spec.ts`): generates with `Cover the offshore support team and payroll data`; the Replace dialog on the unchanged questionnaire asserts the single description and the instruction field (axe on the dialog); `QUES08_ADD_TO_GENERATED_SECTIONS` moved after the replacement, on the new questionnaire, and the hub then shows no Replace, the analyst-change line and `Open AI proposals` (axe on the cards). The `discarding the 2 changes…` and `Requestor answers are never replaced.` assertions were removed.

## Deviations and decisions

- **Task 3's renderer cases are in `questionnaire-renderer.test.tsx`**, not `questionnaire-workflow.test.tsx`: the workflow file mocks the renderer. The domain rule, the caption, the owner-key hand-off and the "no AI on the Requestor's view" cases are in `questionnaire-workflow.test.tsx` as the plan says. The kept-answers case wraps the renderer in `NavigationGuardProvider` (the leave guard registers only inside it), added during GREEN.
- **Without the read and without a count, Replace is not offered** and the card says `CSRM couldn’t check whether analysts have changed this questionnaire since it was generated, so it isn’t offered for replacement. Reload the page to check again.` A second-line function does not offer a destructive action whose loss it cannot state; Strapi refuses a replacement of a changed questionnaire either way.
- **The keyboard shortcut does not confirm a replacement** (`onSubmitShortcut` is a no-op in the dialog): the analyst confirms a destructive action with the dialog's own button.
- **The draft card's job-active line** is new copy (`The AI is preparing proposals for the questionnaire. Decide them before you generate the draft.`, `Go to AI proposals`), modelled on 15-12's release line; `draftGateLine` covers only open proposals.
- **The hub job is a small module** (`hub-proposal-job.tsx`) rather than the panel's `useProposalJob`, so the hub does not load the panel client.
- **Restored answers are scheduled for autosave** like any other unsaved edit; the caption asks the Requestor to check them. "Active" is read as served to the Requestor and answerable (`support.status === 'supported'`); the Requestor's definition carries no inactive questions.
- **Tests mock `questionnaire-ai-actions`** where they render the hub card (`assessment-review-workflow.test.tsx`, `analyst-route-gate.test.tsx`, `context-too-large-files.test.tsx`), as 15-12's tests do, because the actions module reaches `server-only`; the route test also mocks the proposals service.
- **One Playwright flake re-run once** (above); no spec outside E2 changed.

## Next Phase Readiness

- **15-14:** the walk should check the hub at 1440 and 375: Generate's instruction field, the Replace dialog's field, the analyst-change line with `Open AI proposals`, the proposals line, a hub-started job (`Suggest follow-up questions` on the signal), and the draft card's gate line; and the Requestor's refused save and restore (take a questionnaire back while answering, then release it again in the same tab).
- Budget: `/app/requests/{documentId}` has 1,946 bytes left; the fallbacks above are named.

## Self-Check: PASSED

- FOUND: `hub-proposal-job.tsx`; commits `e19b57a` to `4434486`.
- Acceptance: `questionnaire-generation-job.tsx` calls `replaceOffer(` and `hubProposalsLine(`; `assessment-draft-job.tsx` calls `draftGateLine(`; both render `ContextTooLargeFailure` for `CONTEXT_TOO_LARGE`; both card test files hold a case named with `marked as changing the AI inputs`; the hub `page.tsx` calls `listQuestionnaireAiProposals(` and passes `action` to the questionnaire `aiInputsChangedSlot`; `questionnaire-domain.ts` exports `restorableUnsavedAnswers` and imports nothing from `zod`; `use-answer-autosave.ts` handles `QUESTIONNAIRE_NOT_ANSWERABLE` and calls `writeSessionDraft('unsaved-answers', …, JSON.stringify(…))`; `session-drafts.ts` carries only 15-11's change since `15eb830b`; the E2 spec contains `Instruction for the AI (optional)` and `Open AI proposals`.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-12*
