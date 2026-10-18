---
phase: 2
slug: csrm-bootstrap-data
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-24
---

# Phase 2 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js static verification scripts, a real Strapi two-boot disposable SQLite verifier, plus TypeScript compiler |
| **Config file** | `package.json`, `apps/backend/package.json`, `tsconfig.json` |
| **Quick run command** | `yarn verify:csrm-seed` |
| **Full suite command** | `yarn verify:csrm-seed && yarn verify:schema && yarn check-types` |
| **Estimated runtime** | ~15 seconds for `yarn verify:csrm-seed` in a warm workspace; allow ~30 seconds for the full suite. This is not a static-only 60-second check. |

---

## Sampling Rate

- **After every task commit:** Run `yarn verify:csrm-seed`; it runs static checks and then boots the same disposable SQLite database twice.
- **After every plan wave:** Run `yarn verify:csrm-seed && yarn verify:schema && yarn check-types`.
- **Before `$gsd-verify-work`:** Full suite must be green, with any sandbox-only build limitation documented.
- **Max feedback latency:** Target <30 seconds for the complete warm-workspace suite (the measured two-boot seed command is ~15 seconds); do not treat the former static-only 60-second assumption as the runtime contract.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | T-02-01 / T-02-02 | Seed is opt-in and duplicate-safe | static + type | `yarn verify:csrm-seed && yarn check-types` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | T-02-01 | Documentation exposes opt-in flag only | static | `yarn verify:csrm-seed` | ✅ | ⬜ pending |
| 02-01-03 | 01 | 1 | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | T-02-02 | Relationships preserve role path | static + schema | `yarn verify:schema && yarn verify:csrm-seed` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | T-02-01 / T-02-03 / T-02-04 | Independent CSRM seed persists the exact Function-based graph and remains idempotent across two real boots | live integration | `yarn verify:csrm-seed` | ✅ | ✅ green |
| 02-02-02 | 02 | 2 | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | T-02-01 / T-02-02 | Static catalogue and all five live authorization schemas reject dangling or obsolete model wiring | static + schema | `yarn verify:csrm-seed && yarn verify:schema && yarn check-types` | ✅ | ✅ green |
| 02-03-01 | 03 | 3 | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | T-02-06 / T-02-10 | Current requirements and roadmap retain BOOT traceability while accepting the Function migration without changing historical evidence | documentation traceability | `node -e "const fs=require('node:fs');const q=fs.readFileSync('.planning/REQUIREMENTS.md','utf8');const r=fs.readFileSync('.planning/ROADMAP.md','utf8');for(const id of ['BOOT-01','BOOT-02','BOOT-03','BOOT-04'])if(!q.includes(id)||!r.includes(id))throw Error(id)"` | ✅ | ✅ green |
| 02-03-02 | 03 | 3 | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | T-02-07 / T-02-08 / T-02-09 | Docs default both seed flags to opt-in, preserve exact Jane/Bob and agent-Role guidance, and keep Keycloak separate from Strapi authorization | documentation + live integration | `yarn verify:csrm-seed && yarn verify:schema && yarn check-types` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- `scripts/verify-core-model.mjs` already validates the core relationship model.
- `yarn check-types` already type-checks the backend workspace.
- Phase 2 should add `scripts/verify-csrm-seed.mjs` and root `verify:csrm-seed`.

---

## Manual-Only Verifications

No Phase 2 seed behavior remains manual-only. `yarn verify:csrm-seed` is the authoritative acceptance check: it creates a verifier-owned disposable SQLite database, boots the real Strapi backend twice against that same database, and verifies persistence, relations, and idempotency. Optional Strapi admin inspection is supplementary only and is not an acceptance gate.

---

## Validation Sign-Off

- [x] All tasks have automated verification commands.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency accounts for the live two-boot verifier rather than a static-only threshold.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
