---
phase: 12-ai-context-suggestions-and-provenance
plan: 04
subsystem: backend-run-record-and-provenance
requirements: [INT-06]
status: complete
completed: 2026-10-05
---

# Phase 12 Plan 04 Summary

## Accomplishments

- Added the approved `csrm_ai_runs` collection and optional `aiProvenance` JSON attributes on assessments and risks.
- Added bounded run lifecycle writes, append-only decisions, fail-safe closed envelope parsers, and bootstrap reconciliation before seeds.
- Added provenance field-state parsing and edit marking. Existing records read with null provenance, and the current assessment detail, risk list, and risk update projections omit it.
- Confirmed the risk and assessment writable-field parsers reject client-supplied provenance.

## Content-Type Freeze Check

Against `PHASE_12_BASE=7e4fa02`, the complete changed content-type schema list (tracked and untracked) is exactly:

```text
apps/backend/src/api/csrm-ai-run/content-types/csrm-ai-run/schema.json
apps/backend/src/api/csrm-assessment/content-types/csrm-assessment/schema.json
apps/backend/src/api/csrm-risk/content-types/csrm-risk/schema.json
```

The two existing schemas each add only `aiProvenance: json`.

## Verification

- Node 24.21.0 and pnpm 11.24.0: pass.
- Backend source TypeScript compile: pass.
- Backend test TypeScript compile: pass.
- Focused tests, `ai-provenance.unit.test.js` and `ai-run.integration.test.js`: 4 passed, 0 failed, 0 skipped.
- After adding circular-value and proposal-size cases, the focused unit file was recompiled and rerun: 2 passed, 0 failed, 0 skipped.
- `git diff --check`: pass.
- The first expanded integration run had 1 pass and 1 fail because its fixture used a request state that correctly rejects risk edits. The fixture was corrected to `risk-assessment-drafted`; the final scoped run passed 4/4.

## Deviations and Remaining Work

- The plan's full backend suite command was replaced by the required scoped test run. The orchestrator runs the full suite.
- Development database verification after its next start remains for plan 12-19, as specified in the approved record.
- commit pending (orchestrator).
