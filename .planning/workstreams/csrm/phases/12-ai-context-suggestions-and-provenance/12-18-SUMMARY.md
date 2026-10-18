---
phase: 12-ai-context-suggestions-and-provenance
plan: 18
subsystem: questionnaires (Requestor and analyst) AI presentation
tags: [ui, questionnaire, help-text, not-sure, provenance]
requires:
  - phase: 12-05
    provides: deterministic questions with help text and Not sure choices
  - phase: 12-08
    provides: served helpText, aiOrigin and aiAssisted
provides:
  - help text as the Requestor's field hint for every answer type, and in the read-only answers
  - the introduction's AI disclosure and Not sure paragraph
  - question origin markers, help text rows and the Help text field in the analyst's governance view
  - the release dialog's description of the AI-proposed questions it records as reviewed
affects: [12-19]
status: complete
completed: 2026-10-07
commits:
  red: 5c9e48a
  green: 0c47988
  docs: (this commit)
---

# Phase 12 Plan 18 Summary

Executed by the pilot.

## Accomplishments

- The renderer puts the help text (`{field id}-hint`, caption size, secondary colour, `whitespace-pre-wrap`, plain text) under the label or legend and before the control, for Text, Long text, Date, Single select, Multi select and Boolean questions. `aria-describedby` lists the hint first and the error second, on the control or the fieldset; no help text adds nothing. The submitted, read-only answers show it too.
- `QuestionnaireIntroduction` takes `aiAssisted` and `offersNotSure`: the disclosure sentence follows paragraph 1, and the Not sure variant replaces paragraph 3 only when a question offers `not-sure`. `offersNotSure` lives in `ai-assistance-domain.ts`.
- Governance rows show `AI proposed` (the shared badge), `Edited` or `Added by analyst` on the caption line in analyst review only, and `Help text: …` under the question text in every state, released questions included.
- The question form gains `Help text` after `Question text`, with its hint and the 2,000-character check (focus moves to it on a refused save). An edit sends `helpText` only when it changed, so other edits keep their exact payloads.
- The release dialog says `Releasing also records that you reviewed its {n} AI-proposed question(s).` when generated questions remain, through `releaseDescriptionFor`.

## Verification

- Web full suite 3,544/3,544 (160 files); typecheck clean.
- Playwright: `questionnaire-generation-workflow.spec.ts` (with `E3_PROVENANCE_HEADER`, `E3_HELP_TEXT` and `E3_NOT_SURE`), `questionnaire-workflow.spec.ts` and `questionnaire-governance-workflow.spec.ts`: 3/3; the tree was unchanged afterwards.

## Decisions

- `E3_NOT_SURE` asserts the governance row's `Choices:` line for the deterministic third-party question, which lists `Not sure`; no form needs opening.
- E4: `questionnaire-workflow.spec.ts` needed no change (its fixture questionnaire is seeded, not AI-assisted, and offers no Not sure choice).
- `aria-describedby` is also set on the select and Boolean fieldsets, not only on their items, so the group reads its hint once.

## Deviations

- Tests and implementation were written in one pass.

## Self-Check: PASSED
