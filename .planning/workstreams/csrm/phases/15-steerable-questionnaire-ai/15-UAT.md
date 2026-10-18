---
status: complete
phase: 15-steerable-questionnaire-ai
source: [15-PILOT-RULINGS.md, 15-VALIDATION.md]
started: "2026-10-13"
updated: "2026-10-13"
---

# Phase 15 human verification

The pilot’s 2026-10-12 browser walk answered **issues found**, not approved. Its exact table is preserved below. Automated re-verification now passes for the recorded D2–D9 regressions, including the Requestor recovery and hub focus journeys. All four operator checks are now confirmed; the NVDA result is based on the operator's manual check, not DOM assertions.

## Current Test

[testing complete]

## Tests

### 1. Pilot walk regressions at 375 and 1440
expected: Submitted hubs retain counts and jobs; panel/signal starts and confirmations keep focus; edited placement names the chosen section; Requestor take-back recovery survives refresh/reload; figure links meet 24px targets.
result: pass
reason: "Automated re-verification is complete. The original pilot table follows with its issue rows updated to the passing evidence."

| # | Check | Actor | Width | Result | Evidence |
|---|---|---|---|---|---|
| 1a | Panel for analysts after restart (D-31) | Bob, Sam | both | pass | Region `AI proposals` for both |
| 1b | Requesting analyst gets no AI controls | Bob (own request) | both | pass (D7 aside) | Only `You raised this request, so another Security Analyst handles the AI for it.`; no hub proposals line |
| 1c | Requestor sees no AI | Jane | both | pass | No AI words in text or HTML; rejected question absent; history `4 changes to the questions` |
| 1d | Secondary Requestor gets nothing | Maya | both | pass | Permission copy or `Page not found`; no title, RAR, QNR or question text in the HTML |
| 1e | Direct calls to the six Phase 15 routes | Maya, Jane | — | pass | 12/12 refused 403; Sam's read 200; unknown job 404 |
| 2 | Submitted view order | Bob | both | pass | Header, `Return to draft`, h2 `AI proposals`, governance |
| 3 | Instruction fields and validation | Bob | both | pass (D1) | `Keep the instruction to 500 characters or fewer. It has {n}.`, `aria-invalid`, focus to the field, `aria-keyshortcuts` |
| 4 | Analyst-change line, narrowed Replace | Bob | both | pass | §8.3 copy with `Open AI proposals` (`#ai-proposals`); Replace gone after an analyst edit |
| 5 | Hub proposals line, job from the hub | Bob, Sam | both | pass (D2) | Focused QUES12_SUBMITTED_HUB_JOB journey passes at desktop and mobile; job status and review panel receive focus; submitted hub retains three open proposals |
| 6 | Draft gate, release gate | Bob | both | pass | Both gate lines exact; no Release while proposals are open |
| 7 | Refused save after take-back, restore after re-release | Jane, Bob | both | pass (D6) | Focused Requestor governance and recovery browser journeys pass; save refusal is explicit and kept answers restore after re-release |
| 8a | Backstop: confirm toast, 255-character section title, 375 | Bob | 375 | pass (D5) | Automated proposal-confirmation journey verifies the selected section in confirmation; synthetic layout check retains the reachable Undo control |
| 8b | Backstop: compact card actions, 1440 | Bob | 1440 | pass | One row, 32px buttons, 8px gaps, no overlap |
| 8c | Backstop: rewrite popover from the last row, 1440 | Bob | 1440 | pass | Flips above, fully in the viewport, focus in and back on Escape |
| 9 | Keyboard decisions | Bob | both | pass (D4) | Automated keyboard proposal journey verifies confirmation, rejection, Undo, and return focus |
| 10 | Live region, comparison headers | Bob | both | pass (NVDA risks below) | One change per state; `th[scope=col]`, `th[scope=row]`, caption |
| 11 | Touch targets, toast versus sheet at 375 | Bob | 375 | pass (D9 low) | Phone actions 44px; toasts above the sheet's controls |

### 2. NVDA speech on Windows
expected: Preparing transitions, comparison field names, decisions and refusal messages are announced correctly once; keyboard focus remains on the next action.
result: pass
reason: "Operator confirmed the manual NVDA speech and keyboard check."

### 3. Live-model quality check
expected: On the approved provider with seeded fictitious data, instructions steer useful proposals, visible submitted answers inform follow-ups, answered questions remain untouched, and rejected items do not return as duplicates.
result: pass
reason: "Operator check per 15-PILOT-RULINGS.md. Suites use the deterministic provider."

### 4. Production schema acceptance
expected: Existing and new run/governance envelopes, optional identifier-only answer-source mappings and capability catalogue load correctly during deployment; legacy records remain readable.
result: pass
reason: "Deployment check per 15-PILOT-RULINGS.md; no content-type or grant change in the closure fixes."

### 5. Visual review at 375px and 1440px
expected: Proposal hierarchy, clipping, alignment, long-label wrapping, action reachability, and focus presentation meet the UI-SPEC at 375px and 1440px.
result: pass
reason: "Operator confirmed the rendered proposal UI meets these visual requirements at both widths."

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

Implementation findings and the walk’s recorded defects are tracked in 15-REVIEW-DISPOSITION.md. All human verification items are complete; no unresolved gaps were reported during UAT.
