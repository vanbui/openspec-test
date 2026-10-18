---
status: complete
phase: 16-risk-curation-and-targeted-ai-re-runs
source: [16-VERIFICATION.md, 16-VALIDATION.md, 16-UI-REVIEW-DISPOSITION.md, 16-15-SUMMARY.md]
started: "2026-10-16"
updated: "2026-10-16"
---

# Phase 16 human verification

Verification found no gap. All four roadmap criteria hold in the code, and ASSESS-09 and ASSESS-10 are satisfied, closing UAT-027 and UAT-028 (`16-VERIFICATION.md`, 4/4, 0 gaps). The status is `human_needed` only because seven checks need a person or a deployment. They are the verifier's six human checks, plus 16-15's live UAT-A check on the operator's own records ("Manual-only items for the orchestrator"). No browser walk has been run for this phase, so no check is recorded as passed here. The pilot rules on each one: run it, or accept it as a deferred operator follow-up, as Phases 10 to 14 did.

Each check below names its automated backstop. The final gate in `16-15-SUMMARY.md`, under "Phase gate (final run, after the code review)", runs `risk-curation.spec.ts` at 375 and 1440 with axe on every Phase 16 state. It uses the deterministic provider and the spec's own UAT-A-like records.

**Pilot status ruling (2026-10-16):** `passed`. Verification found 0 gaps: 4/4 criteria, ASSESS-09 and ASSESS-10 satisfied, 43/43 threats closed, Nyquist-compliant, and 54 review findings dispositioned with 0 open. The final gate is green at `fa0cf7a4` (web 5,847/5,847; Strapi 2,022 passed, 1 skipped; Playwright 248/248, 0 flaky). In that gate, `risk-curation.spec.ts` runs every Phase 16 state at 375 and 1440 with axe, including both negative cases. As in Phases 10 to 14, the seven checks in `16-UAT.md` that need a person, a hosted model, the operator's records or a deployment stay open as deferred operator follow-ups. They do not block completion. The pilot also accepts the stage B leave-warning copy (16-UI-SPEC §7 amendment) and keeps UI-02, UI-04 and UI-06 unchanged, as `16-UI-REVIEW-DISPOSITION.md` records.

## Current Test

[testing complete]

## Tests

### 1. Live provider quality on UAT-A-like seeded fictitious data (SC-2, SC-3)

expected: On seeded fictitious UAT-A-like records, with an approved hosted model and the AI data policy's classification ceiling as configured, `Suggest more risks` proposes the missing payment-file risk. It repeats none of the drafted risks, its similar flags are sensible, and `Rewrite this risk` proposes a cited, field-by-field change that the analyst confirms or rejects.
result: pending
reason: "Deferred operator follow-up. No suite may send data to a hosted provider. The deterministic provider proves the behaviour: `ai-provider-risk-proposals.unit.test.ts` covers the payment-file risk, near-duplicate drops, the rejected-suggestion rule and the UAT-A reply of ten risks keeping eight. `PH16_SC2_SUGGEST_PAYMENT_FILE` and `PH16_SC3_REWRITE_DIFF` cover it in the browser."

### 2. The live UAT-A check on the operator's own records at 1440 and 375

expected: On the operator's development database, with the real UAT-A records, Bob withdraws and reinstates a risk with a reason. He asks for more risks and decides them, rewrites one risk and decides its changes, and reads the history and readiness. Jane sees none of the withdrawn risks or the AI's internals.
result: pending
reason: "Deferred operator follow-up. The real UAT-A records are not in this host's seeded database. `risk-curation.spec.ts` runs the same journeys on its own UAT-A-like records at both widths."

### 3. NVDA and keyboard-only on Windows (UI-05)

expected: With NVDA and Chrome on Windows, at 1440 and 375, check the withdraw and reinstate forms, the Undo toasts (Alt+T, then Undo), the history sheet, the AI proposals section and its job status, the rewrite comparison, the phone actions menu, and the new Risk's leave warning. Each is spoken once with its state. `aria-expanded` and `aria-controls` are announced on the toggles, and the whole path works without a mouse.
result: pending
reason: "Deferred operator follow-up (no screen reader in this environment). Automated proofs: the keyboard paths in the unit tests (Enter and Escape on the reason forms, focus after withdraw, reinstate, Undo and decisions), the UI-01 tests for `aria-controls` (`45da8c1e`), and axe at 375 and 1440 in `risk-curation.spec.ts`."

### 4. Visual review at 375, 768 and 1440 (UI-07)

expected: The editor's `Show` filter and both lists, withdrawn cards (two-line clamp, 16px block rhythm), the history sheet (640px from 768px, full screen below), the proposals section and its phone sheet, the 12rem compare grid, the rewrite popover at the viewport edge, the 70vh bottom sheets, a long toast at 375, and the Register's `Withdrawn` filter and read-only detail. All reflow from 320 to 1440 with no clipping or horizontal page scroll.
result: pending
reason: "Deferred operator follow-up. The UI review was code-only (`16-UI-REVIEW.md`); its spacing and `aria-controls` findings are disposed of in `16-UI-REVIEW-DISPOSITION.md`. The Playwright journeys at 375 and 1440 assert layout facts and axe, not visual quality."

### 5. Safari and Firefox for the `Show` filter's address change and the Undo landing

expected: Choosing `Withdrawn` or `Active` changes `?risks=` through the router with no reload and no scroll jump. Back and forward restore the filter, and Undo after a withdrawal keeps the card in view.
result: pending
reason: "Deferred operator follow-up: this environment drives Chromium only. `PH16_UNDO_KEEPS_PLACE` proves the Undo landing in Chromium at 375 and 1440 (pilot ruling: the Show filter through `router.replace` with no scroll, `1bc59af2`)."

### 6. The operator's development database after the next Strapi start (16-03)

expected: With both Keycloak flags off, the first Strapi start on the operator's database adds the withdrawal attributes on `csrm_risks` (`withdrawn_at`, `withdrawal_reason` and the `withdrawn_by` link) and the `csrm_risk_history_events` table. The new API-only Functions reach the catalogue. Every existing Risk, UAT-A's included, reads as active.
result: pending
reason: "Deferred operator follow-up, at the operator's next start. `risk-curation.integration.test.ts :: a fresh database boots with the withdrawal columns…` proves it on a fresh database."

### 7. Production schema and catalogue acceptance

expected: The deployment accepts the two approved schema files, `csrm-risk` (the withdrawal attributes) and `csrm-risk-history-event`. Legacy Risks read as active, and the catalogue's API-only Functions, held by `role.security_analyst` alone, are applied.
result: pending
reason: "Deferred to deployment. The content-type freeze lists exactly the two approved files, and the catalogue copies are identical (the final gate's static checks); the contract-gap record carries the pilot's G-6 approval."

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

No observed implementation gap:
- `16-VERIFICATION.md` records 0 gaps (4/4 criteria; ASSESS-09 and ASSESS-10 satisfied);
- `16-SECURITY.md` records `threats_open: 0`, with 43 of 43 threats closed;
- `16-VALIDATION.md` is validated and Nyquist-compliant (its one gap, D-17's leave guard, fixed test-first in `8b13b1c2`/`cc1c8f25`);
- `16-REVIEW-DISPOSITION.md` (54 findings, 0 open) and `16-UI-REVIEW-DISPOSITION.md` (UI-01 and UI-03 fixed) are complete.

The final complete automated gate is recorded in `16-15-SUMMARY.md` under "Phase gate (final run, after the code review)".

## Deferred Follow-Ups

- test: 1
  idea: "Live provider quality for Suggest more risks and Rewrite this risk on seeded fictitious UAT-A-like data with an approved hosted model: the operator's"
  deferred_at: 2026-10-16
- test: 2
  idea: "The risk curation journeys on the operator's real UAT-A records at 1440 and 375: the operator's"
  deferred_at: 2026-10-16
- test: 3
  idea: "NVDA and keyboard-only on the withdraw and reinstate forms, toasts, history sheet, AI proposals, rewrite comparison, phone menu and the new Risk's leave warning: the operator's"
  deferred_at: 2026-10-16
- test: 4
  idea: "Visual review of every Phase 16 surface at 375, 768 and 1440: the operator's"
  deferred_at: 2026-10-16
- test: 5
  idea: "Safari and Firefox for the Show filter's router address change, back and forward, and the Undo landing: the operator's"
  deferred_at: 2026-10-16
- test: 6
  idea: "16-03's schema change on the operator's development database at the next Strapi start: the operator's"
  deferred_at: 2026-10-16
- test: 7
  idea: "Production acceptance of the two approved schema files and the API-only Functions: at deployment"
  deferred_at: 2026-10-16
