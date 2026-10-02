---
status: partial
phase: 10-existing-flow-gap-closure
source: [10-VERIFICATION.md, 10-23-SUMMARY.md]
started: 2026-10-03T00:00:00Z
updated: 2026-10-03T00:00:00Z
---

## Current Test

[testing paused: the three remaining checks are open by the pilot's decision of 2026-10-03; every other human check passed in the pilot's browser walkthrough, `10-23-SUMMARY.md` `## Browser checks`]

## Tests

### 1. Hosted-provider question add
expected: On a hosted-provider-generated questionnaire, adding a question to an existing section and to a new section both save, and the form opens where it was invoked with focus in Question text.
result: blocked
blocked_by: third-party
reason: The seed has no hosted-provider questionnaire, development pins the deterministic provider (no live AI generation), and adding a question writes data. Left open by the pilot (10-23 Manual-Only); the deterministic-provider path passed its mounted Strapi test.

### 2. Browser leave prompt on reload
expected: With an answer typed and its autosave still pending, a reload or close shows the browser's native leave prompt.
result: skipped
reason: Needs a typed answer, which autosave would write to the development data. Left open by the pilot (10-23 Manual-Only); the `beforeunload` registration is unit-tested.

### 3. Screen-reader cadence
expected: With a screen reader, "Saved at {time}" is announced politely, a failure is announced once, and "Saving…" is never announced.
result: skipped
reason: Needs assistive technology. Left open by the pilot (10-23 Manual-Only); the polite status region is confirmed in code and tests.

## Summary

total: 3
passed: 0
issues: 0
pending: 0
skipped: 2
blocked: 1

## Gaps
