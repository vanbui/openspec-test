# Project Retrospective (iam workstream)

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Identity Provisioning

**Shipped:** 2026-10-19
**Phases:** 5 | **Plans:** 80 | **Sessions:** not tracked in the planning records

### What Was Built
- midPoint 4.8.14 LTS, a source-built SCIM2 connector V1.2.9 and Mailpit in the `idp` compose project, with a go/no-go connector gate.
- Identity Sources, source-owned and protected IdamBox Users, and a leaver outbox that commits while Keycloak is down.
- Strapi SCIM 2.0 `/Users` (21 root operations), per-source hashed bearer tokens, and replay in CI of a genuine connector capture.
- midPoint configuration as code: HR CSV → correlation → 5-minute sync → nightly reconciliation → retry and audit.
- Keycloak set-password email after commit, and a fresh-stack joiner → mover → leaver journey at two widths.

### What Worked
- A connector spike first. Phase 1's go/no-go meant no later phase built on an unproven connector.
- Real captured traffic as the contract. Replaying the genuine midPoint capture in CI caught the partial-PUT behaviour (P3-34) before it wiped source keys.
- Live probes before configuration. Phase 4's ten amendments came from running probes against the pinned runtime, not from assumptions.
- The final audit found no product defect. Every gap was evidence or traceability.

### What Was Inefficient
- Evidence bookkeeping lagged delivery. Phases 2 and 3 had gate evidence but no VERIFICATION.md until close-out, and Phases 1 and 4 used consolidated records that the tooling cannot project as complete.
- Plan granularity in Phase 4 (32 plans) did not survive contact with the runtime. Several plans were superseded by live findings, and the work ran as one consolidated pass.
- Cross-workstream breakage held up gates. The csrm red-phase files (WINDOWS.md entry 11) blocked the unfiltered backend gate in Phases 3 and 4.
- Executor usage limits stopped Phase 5 mid-wave.

### Patterns Established
- Published evidence bundles under `phases/<N>/evidence/` with `--verify-evidence` validators, read by `docker/midpoint/e2e/*.mjs`. Phase directories must therefore stay in place at archive time.
- Orchestrator-run live checkpoints. Delegated work is re-run before it is accepted, never accepted on report.
- Disable-only lifecycle with tombstones (`sourceDeletedAt`); no hard deletes.

### Key Lessons
1. Write VERIFICATION.md (with frontmatter and fingerprint) at the end of each phase, even when the work runs as a consolidated pass. Reconstructing it at milestone close costs about an hour of full-suite time per phase.
2. Size live-dependent phases by probe outcomes. Plan the probes first, then the configuration, rather than 32 plans up front.
3. Keep evidence paths independent of the planning layout, or document that phase directories are not archivable.

### Cost Observations
- Model mix: not recorded.
- Notable: the close-out verification of Phases 2 and 3 each re-ran the unfiltered backend suite (~50 minutes, 2577 tests).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | — | 5 | Spike-first go/no-go; real-capture replay as contract; orchestrator live checkpoints |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 2577 backend (unfiltered, at close) | not measured | — |

### Top Lessons (Verified Across Milestones)

1. (Needs a second milestone to cross-validate.)
