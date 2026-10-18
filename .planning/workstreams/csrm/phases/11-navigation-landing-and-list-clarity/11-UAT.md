---
status: complete
phase: 11-navigation-landing-and-list-clarity
source: [11-VERIFICATION.md]
started: "2026-10-04"
updated: "2026-10-05"
---

# Phase 11 human verification

Canonical verification found no implementation gap and supported all six roadmap criteria. These three checks remain human-only. The approved historical premium walk and accepted seed check are retained separately; no response is recorded as a pass here.

## Current Test

[testing complete]

## Tests

### 1. NVDA count, disclosure and quick-find announcements

expected: Use NVDA with Chrome on Windows. Navigate the sidebar counts, expand Show all steps, and complete two searches. Hear each count's meaning, the expanded state and one announcement for each completed search.
result: skipped
reason: "Deferred follow-up: accepted residual (pilot, 2026-10-05). Not run: there is no screen reader in this environment. Each count is in its link's accessible name, the disclosure carries aria-expanded and quick find announces through one polite status region, all proven in unit tests and Chromium. It stays open for NVDA UAT by the operator."

### 2. macOS Safari and Firefox quick-find shortcut

expected: In both Safari and Firefox on macOS, invoke⌘K on Home and in a questionnaire text field. Close, reopen and press Escape. Search toggles without the browser binding firing and restores focus correctly.
result: skipped
reason: "Deferred follow-up: accepted residual (pilot, 2026-10-05). Not run: this environment drives Chromium only. The Ctrl+K and ⌘K handler and its preventDefault are unit-tested (quick-find-trigger.test.tsx), and Ctrl+K opens quick find in quick-find.spec.ts in Chromium. It stays open for the operator's UAT in Safari and Firefox on macOS."

### 3. Original operator UAT-A, UAT-B and UAT-C records

expected: Read Bob's and Jane's actual operator records at375px and desktop. Confirm queue/deadline and Needs your action hierarchy, triage facts, UAT-C Risks under assessment, and Released request labels. Do not submit, release, generate, answer or save during the check.
result: skipped
reason: "Deferred follow-up: accepted residual (pilot, 2026-10-05). Not run: the UAT-A, UAT-B and UAT-C records are not in this host's development database, which holds the seed only (11-21 W27). The seeded stand-ins pass (W7, W15, W16, W18, W20). It stays open for the operator's UAT on the operator's database."

## Summary

total: 3
passed: 0
issues: 0
pending: 0
skipped: 3
blocked: 0

## Gaps

No observed implementation gap. SECURITY.md separately records two non-blocking evidence warnings, T-11-20 and T-11-49. Final complete automated gate results will be attached to11-21-SUMMARY.md before this human checkpoint is presented.

## Deferred Follow-Ups

- test: 1
  idea: "NVDA announcements of the sidebar counts, the Show all steps disclosure and quick-find results: NVDA UAT by the operator (accepted residual, pilot 2026-10-05)"
  deferred_at: 2026-10-05
- test: 2
  idea: "Quick-find ⌘K in Safari and Firefox on macOS: the operator's UAT (accepted residual, pilot 2026-10-05)"
  deferred_at: 2026-10-05
- test: 3
  idea: "UAT-A, UAT-B and UAT-C baselines read on the operator's database at 375 and desktop: the operator's UAT (accepted residual, pilot 2026-10-05)"
  deferred_at: 2026-10-05
