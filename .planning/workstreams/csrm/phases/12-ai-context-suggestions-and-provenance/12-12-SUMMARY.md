---
phase: 12-ai-context-suggestions-and-provenance
plan: 12
subsystem: assessment decisions and contract
tags: [assessment, provenance, authorization, contract]
requires:
  - phase: 12-09
    provides: stored provenance on assessments and risks
  - phase: 12-11
    provides: the mutability guard and selectable review transition
provides:
  - one transactional proposal decision operation for assessment and risk fields
  - human analyst grant, mounted route, contract, inventory, matrix row and typed web service
affects: [12-13, 15, 16, 17, 17.1]
status: complete
completed: 2026-10-06
commits:
  red: 972ebcd
  green: 1d3dec2
  docs: (this commit)
---

# Phase 12 Plan 12 Summary

## Accomplishments

- Added the bounded decision batch for proposed assessment and risk fields, including confirmation, restore, repeated-call no-ops and all-or-nothing refusals.
- Kept the current provenance fact and the proposing run's attributed history in one transaction. Content changes use the existing review transition; a batch with no changes leaves review state untouched.
- Refused confirmation of a proposed Accept treatment action beside a Planned control. Restricted the operation to a human Security Analyst and added its typed client and contract chain.

## Verification

- New mounted tests first failed 0/3 against the absent route. The full backend suite then passed 749/749, including the mounted decisions, authorization matrix, catalogue and inventory checks. The final decision file, expanded with the Planned-versus-Treat boundary and release-ready restore regression, passed 6/6. The matrix contains 118 rows.
- Web feature, response parity and operation chain tests: 169/169 passed. Web typecheck passed. Backend build passed.
- Contract inventory regeneration passed 7/7 with one intentional write-mode skip. Catalogue copies are byte-identical. `git diff --check` passed.
- `api:check` regenerated the declaration, then its Git index comparison returned 1 because the declaration remains unstaged under the read-only Git rule. The diff contains only the planned operation and components.

## Decisions

- The published request shape accepts a suggestion key, while this plan returns 400 for it until plan 12-13 implements suggestion decisions.
- Batch validation and the planned-control check finish before any provenance or history write, so a refused item cannot leave a partial batch.

## Deviations

- Updated the authorization matrix's fixed human-only operation count to include the new route.
- Git remained read-only. The orchestrator must stage the generated declaration before rerunning `api:check`.

## Self-Check: PASSED
