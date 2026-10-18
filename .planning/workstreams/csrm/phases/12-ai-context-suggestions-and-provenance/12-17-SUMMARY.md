---
phase: 12-ai-context-suggestions-and-provenance
plan: 17
subsystem: assessment editor AI review (citations, suggestions, claims)
tags: [ui, provenance, citations, suggested-controls, uncited-claims]
requires:
  - phase: 12-13
    provides: suggestion decisions and decideAiProposalsAction
  - phase: 12-16
    provides: useAiDecisions, field markers and review bars
provides:
  - AiCitations and the lazily loaded AiSourcePopover (popover from 768px, bottom sheet below)
  - readAiSourceAction over the existing request and questionnaire reads
  - AiControlSuggestions with useSuggestionDecisions (add waits for the server; dismiss and restore are optimistic; Undo)
  - AiUncitedClaims in both treatments
  - listControlImplementationsAction, so an added or removed planned control shows at once
affects: [12-19]
status: complete
completed: 2026-10-07
commits:
  red: c187673
  green: e2a9c58
  docs: (this commit)
---

# Phase 12 Plan 17 Summary

Executed by the pilot (the execution tool reached its usage limit at the end of 12-16).

## Accomplishments

- Each statement field (Risk: issue, risk, cause, impact, both rationales, treatment plan; assessment: summary, overall risk rationale, recommendations) lists its sources under the field's error: answer and request citations are buttons (`aria-haspopup="dialog"`, `aria-expanded`) that open the source in place; system and asset citations are plain text; a statement with no source shows `No source cited` and the check-it caption.
- `readAiSourceAction` validates `{ requestId, sourceKey }` strictly and reads only through `getRequest` and `getQuestionnaireGovernanceQuestions` (no new operation, D-03). Answers render with choice labels through the questionnaire's own `answerDisplay`, now exported.
- The source view shows nothing for 300 ms, then a skeleton; the title (the served label) takes focus on open, and focus returns to the citation on close. Error, missing and permission states are plain sentences; `Try again` retries.
- `Suggested by AI` sits after a Risk's mitigation controls and before `Add mitigation control`, `data-print="hidden"`. Add waits for the server (`Adding…`, the row's Dismiss disabled), re-reads that Risk's controls and toasts with Undo; a refused Undo explains UI-D12's rule. Dismiss and Restore are optimistic and roll back on a refusal; dismissed suggestions sit behind `Show dismissed suggestions (n)`. Focus follows §6.2.
- `Claims to check` (warning treatment) follows the review bar while a proposed field remains, then `Claims the AI couldn’t support` on the neutral surface; claims render as text.

## Verification

- Web full suite 3,534/3,534 (160 files); typecheck clean.
- Playwright: `accessibility.spec.ts` and `performance.spec.ts` green (editor route 307,724 of its 460,000 budget); `assessment-release-workflow.spec.ts` 1/1 after the fix below.

## Decisions

- The source popover is anchored with Radix's `virtualRef` to the citation, so it can load lazily (`next/dynamic`) without wrapping each citation in a Popover root.
- The popover's title is the citation's served label (the question text or the request field label), so focus has a target before the read returns.
- `listControlImplementationsAction` (over the existing `listControlImplementations` service) refreshes a Risk's mitigation controls after an add or Undo; the editor holds those in client state, so revalidation alone would not show the new Planned control.
- The source view's tests run through `ai-citations.test.tsx`, which renders the popover directly; suggestion decisions are tested through `ai-control-suggestions.test.tsx` rather than separate hook tests.

## Deviations

- The release journey found horizontal overflow at 375 px: a citation button's `max-w-[28rem]` exceeded the phone width. Citations now cap at `min(28rem, 100%)`.
- Tests and implementation were written in one pass.

## Self-Check: PASSED
