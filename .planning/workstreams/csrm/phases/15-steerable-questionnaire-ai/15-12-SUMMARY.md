---
phase: 15-steerable-questionnaire-ai
plan: 12
subsystem: web
tags: [nextjs, rewrite-in-plain-language, x-26, release-gate, provenance, run-sheet, copy-guard, tdd]
requires:
  - phase: 15-steerable-questionnaire-ai
    provides: 15-10's domain, actions and copy; 15-11's panel, InstructionField, session-draft kinds and QuestionFormScope
provides:
  - apps/csrm/src/features/questionnaire-ai/question-rewrite-control.tsx (QuestionRewriteControl, QuestionAiRowExtras)
  - apps/csrm/src/features/questionnaire-ai/answered-question-note.tsx (AnsweredQuestionNote)
  - apps/csrm/src/features/questionnaire-ai/start-proposals-button.tsx (StartProposalsButton)
  - questionnaire-ai-domain.ts: questionRowAiFactsOf, QuestionRowAiFacts, openProposalLinkLabel, the §6 constants, SUGGEST_FOLLOW_UP
  - QuestionnaireGovernance props rowExtras and releaseGate; SubmittedQuestionnaireAnswers prop questionExtras; QuestionnaireReview props questionAi and releaseGate
  - AiProvenanceHeader openProposals; questionnaireOriginLine's `from AI proposals`; AiGenerationFactsView.openProposals; AiRunSheetKind with `questionnaire-proposals`
  - aiInputsChangedSlot and AiInputsChangedBlock prop action
  - ai-run-sheet.tsx sheetInstructionRows, sheetQuestionnaireRows and the Instruction and Questionnaire groups
  - interface-copy-guard: questionnaireAiModules and reservedReviewVerbs
affects: [15-13, 15-14]
actuals:
  tasks: 3
  commits: 8
plan_head_before: 5d48b9e
plan_head_after: ee2244b
requirements-completed: []
completed: 2026-10-12
status: complete
closes: [UAT-018]
---

# Phase 15 Plan 12: Question Rows and Provenance Summary

**Each active, unanswered question in analyst review and in the submitted view can be rewritten in plain language from its row; answered questions carry the Answered note; a question with an open proposal links to its card; Release waits while proposals are open or a proposal job runs; the provenance header counts open proposals and questions from AI proposals; the AI inputs signal offers Suggest follow-up questions where a start is allowed; and What the AI used shows what the AI was asked and shown of the questionnaire.**

## What was built

- **Rewrite control** (`QuestionRewriteControl`): a ghost small `Rewrite in plain language` (`SpellCheck`, `aria-haspopup="dialog"`, named by its question) opening a popover from 768px and a bottom sheet with a title row and `Close` below; inside, `InstructionField` (kind `question-rewrite-instruction`, the question's id) with §6.1's hint, `Rewrite question` (`Ctrl`/`⌘` `Enter`) and `Keep as is`; focus returns to the trigger. On start the row shows `Rewriting…` (focused, `tabIndex={-1}`) and polls the job; completion refreshes the page; a failed job shows `The rewrite didn’t finish.` with `Retry` named `Retry rewrite: {question}`; a no-change run shows `The AI found nothing to simplify in this question.` until the next page view.
- **Row parts** (`QuestionAiRowExtras`, loaded on demand by the review): the open-proposal link (`Open AI proposal` or `{n} open AI proposals`, to the first card's anchor, moving focus to the card), the Answered note in the submitted view, and the rewrite control when the read's `actions.rewrite.allowed` and the question is not answered. Without the read (a requesting analyst, or a failed read) nothing shows. The page builds `questionRowAiFactsOf(view)` (plain data) and the review hands it to the editor rows (`rowExtras`) and to the submitted answers (`questionExtras`).
- **Answered note** (`AnsweredQuestionNote`, server-safe): `Answered` with `LockKeyhole` and the hidden ` - the AI can’t change or remove it`, from the served `answered` flag only; in the editor's caption line in analyst review, and through the row parts in the submitted view.
- **Origin notes**: `Confirmed AI proposal` and `Edited AI proposal` were already rendered by 15-08's `questionOriginMarker`; this plan adds their tests.
- **Release gate**: `releaseGateLine` replaces `Release questionnaire` with `Lock` and the line: the count as a figure link to `#ai-proposals`, or the job line with `Go to AI proposals`. A requesting analyst is served no count, so the countless line shows once a release is refused with `AI_PROPOSALS_OPEN` (the dialog shows family E's sentence; the line follows when it closes).
- **Header**: `openProposals` (from `generation.openProposals`, through `questionnaireProvenanceHeaderProps`) renders `{n} open AI {proposal|proposals}` linking to `#ai-proposals`, omitted at zero or unserved; `questionnaireOriginLine` adds `{c} from AI proposals` (proposal-confirmed plus proposal-edited) before the analysts' part.
- **Signal action**: `aiInputsChangedSlot` and `AiInputsChangedBlock` take `action`, rendered after the caption; the questionnaire page passes `StartProposalsButton` when the proposals read allows a start. The button starts the default task, refreshes, and moves focus to the panel's job status line (`data-ai-proposals-job-status`), or to the panel.
- **Sheet**: the panel's groups open the sheet with kind `questionnaire-proposals` (§9.3's description); `Instruction` (`Given by` the analyst, `Plain-language rewrite (standard wording)` or `None: the AI suggested the questions it judged still needed`; the instruction in typographic quotes, plain text with line breaks) and `Questionnaire` (scope, questions offered, answered, answers included or withheld, open and rejected (`{r} of {t}`) and removed proposals listed) after `Run`; a run without the sections shows neither.
- **Copy guard**: every shipped module of `features/questionnaire-ai` and `field-comparison.tsx`, and a reserved-verb check (a capitalised `Accept`, `Approve` or `Dismiss`, or the word inside a phrase; a one-word lowercase literal is the API's value, never shown).

## Task commits

1. Task 1 (tracer): `4871c33` (test, RED: no module) and `e1d3cc7` (feat).
2. Task 2: `363fac2` (test, RED: 7 failures) and `0b28c1f` (feat).
3. Task 3: `4ef91ca` (test, RED: 9 failures; the guard's checks passed already), `d536f02` (feat) and `ee2244b` (fix: panel placement on a submitted questionnaire).

## Verification

- Task 1: rewrite control 10/10; questionnaire-ai, questionnaires, neighbours and lib 2,530/2,530.
- Task 2: questionnaire-ai and questionnaires 451/451.
- Task 3: ai-assistance, questionnaire-ai, questionnaires and guards 901/901; full web unit suite 222 files, **5,350/5,350**; typecheck and lint clean.
- Playwright: `questionnaire-governance-workflow.spec.ts` (desktop) and `ai-context-provenance.spec.ts` (desktop, and its `@journey` test at 375) **3/3**; `questionnaire-workflow.spec.ts` (desktop) **1/1** after the placement fix (first run: the submitted page's first button was the panel's, below); desktop `performance.spec.ts` **11/11**; the governance and provenance journeys re-ran **3/3** after the fix. `git status --short` empty after each run; `git diff --name-only 15eb830b -- apps/csrm/e2e/performance.spec.ts` empty. No spec changed in this plan.

## Budget

Desktop run of 2026-10-12, 15:15:10 to 15:16:13 UTC.

| Route | Actor | Delivered JS bytes | 15-11's figure | Change | Budget | Headroom | Fallback if grown |
|---|---|---|---|---|---|---|---|
| `/app/risks/{documentId}` | Security Analyst | 293,859 | 293,906 | -47 | 300,000 | 6,141 | — |
| `/app/requests/{documentId}` | Requestor | 297,954 | 297,992 | -38 | 300,000 | 2,046 | — (15-11's badge move stands ready) |
| `/app/questionnaires/{documentId}` | Requestor | 360,351 | 360,197 | +154 | 500,000 (override) | 139,649 | Render the header's open-proposal line from a slot the analyst page passes (the header ships in the Requestor's questionnaire bundle through shared code) |

The plan's fallback for the risk route was applied from the start: the sheet's two row builders live in the on-demand sheet body, so `ai-assistance-domain.ts` did not grow. Every time to first byte was under 41 ms and every largest contentful paint 572 ms or less.

## Deviations and decisions

- **The sheet rows live in `ai-run-sheet.tsx`**, not `ai-assistance-domain.ts`: the body loads on demand, as the Notes and Files rows already do; this is the plan's named fallback for `/app/risks/{documentId}`, applied before it was needed.
- **The row parts load on demand** in the review (`next/dynamic`): they reach the questionnaire-ai Server Actions, and a static import would also have pulled `server-only` into every test that renders the review.
- **The submitted view's panel sits after `Return to draft`**: the review keeps Phase 06.1's reversal as the screen's first action (`questionnaire-workflow.spec.ts` asserts it), so the order there is header, provenance, Return to draft, the panel, then governance. Analyst review and awaiting submission keep the panel directly after the provenance header.
- **The requesting analyst's release line** shows only after a refused release: the count is not served to them (Strapi's `mayCount`), so the line cannot truthfully show earlier; until then Release stays offered and Strapi refuses it while proposals are open.
- **`One question`** for a rewrite run's scope: the run summary carries counts only, never the question's text.
- **The sheet's instruction** shows in full (at most 500 characters) without §3's three-line clamp.
- **The rewrite control renders no link itself in the rows**; the row parts show the open-proposal link with its count, so a row never shows two links.
- **No existing assertion changed** in this plan (U1's release assertions stay as they were: their fixtures pass no gate); U6's sheet cases are additions.

## Next Phase Readiness

- **15-13 (hub, Requestor):** `StartProposalsButton` for the hub card's start; `hubProposalsLine`, `replaceOffer`, `draftGateLine` and the job copy from the domain; `InstructionField` with kinds `generation-instruction` and `replacement-instruction`; the budget table above.
- **15-14:** the walk should check the submitted view's order (Return to draft, then the panel), the rewrite popover at 1440 from the last row, and the bottom sheet at 375.

## Self-Check: PASSED

- FOUND: the three new modules; commits `4871c33` to `ee2244b`.
- Acceptance: the control holds `aria-haspopup="dialog"` and calls `startQuestionRewriteAction`; its test names include `answered row` and `requesting analyst`; governance calls `releaseGateLine(`; the note holds `LockKeyhole` and `the AI can’t change or remove it`; the copy guard lists `src/features/questionnaire-ai`; the sheet renders both groups from `sheetInstructionRows` and `sheetQuestionnaireRows`; `aiInputsChangedSlot` accepts `action` and the page passes `StartProposalsButton`; `questionnaireOriginLine` holds `from AI proposals` and `ReviewLine` renders it.

---
*Phase: 15-steerable-questionnaire-ai*
*Completed: 2026-10-12*
