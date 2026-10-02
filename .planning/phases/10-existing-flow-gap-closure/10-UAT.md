---
status: complete
phase: 10-existing-flow-gap-closure
source: [10-VERIFICATION.md, 10-23-SUMMARY.md]
started: 2026-10-03T00:00:00Z
updated: 2026-10-03T00:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Hosted-provider question add
expected: On a hosted-provider-generated questionnaire, adding a question to an existing section and to a new section both save, and the form opens where it was invoked with focus in Question text.
result: skipped
reason: "Deferred follow-up: accepted residual (pilot, 2026-10-03). Not run: it needs the hosted AI provider, which means an external account and credentials outside the dev-mode rules, and it writes data. Question add on generated questionnaires is proven with the deterministic provider (10-09's tests and the questionnaire-governance journey). It stays open for the operator's UAT with a hosted provider."

### 2. Browser leave prompt on reload
expected: With an answer typed and its autosave still pending, a reload or close shows the browser's native leave prompt.
result: skipped
reason: "Deferred follow-up: accepted residual (pilot, 2026-10-03). Not run: the browser-native prompt needs a pending or failed save, which means a typed answer that autosave writes to operator data. The guard's arm and disarm logic is unit-tested, and the leave warning is proven in questionnaire-workflow.spec.ts. It stays open for the operator's UAT on a throwaway questionnaire."

### 3. Screen-reader cadence
expected: With a screen reader, "Saved at {time}" is announced politely, a failure is announced once, and "Saving…" is never announced.
result: skipped
reason: "Deferred follow-up: accepted residual (pilot, 2026-10-03). Not run: there is no screen reader in this environment. The save status is a polite status region, verified in the walk and by unit tests. It stays open for NVDA or VoiceOver UAT by the operator."

## Summary

total: 3
passed: 0
issues: 0
pending: 0
skipped: 3
blocked: 0

## Gaps

## Deferred Follow-Ups

- test: 1
  idea: "Hosted-provider question add: the operator's UAT with a hosted AI provider (accepted residual, pilot 2026-10-03)"
  deferred_at: 2026-10-03
- test: 2
  idea: "Browser leave prompt on reload: the operator's UAT on a throwaway questionnaire (accepted residual, pilot 2026-10-03)"
  deferred_at: 2026-10-03
- test: 3
  idea: "Screen-reader cadence of the save status: NVDA or VoiceOver UAT by the operator (accepted residual, pilot 2026-10-03)"
  deferred_at: 2026-10-03
