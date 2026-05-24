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
| **Framework** | Node.js static verification scripts plus TypeScript compiler |
| **Config file** | `package.json`, `apps/backend/package.json`, `tsconfig.json` |
| **Quick run command** | `yarn verify:csrm-seed` |
| **Full suite command** | `yarn verify:schema && yarn verify:csrm-seed && yarn check-types` |
| **Estimated runtime** | ~30 seconds, excluding dependency install/build variance |

---

## Sampling Rate

- **After every task commit:** Run `yarn verify:csrm-seed` once the script exists.
- **After every plan wave:** Run `yarn verify:schema && yarn verify:csrm-seed && yarn check-types`.
- **Before `$gsd-verify-work`:** Full suite must be green, with any sandbox-only build limitation documented.
- **Max feedback latency:** 60 seconds for static verification and type checking in a warm workspace.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | T-02-01 / T-02-02 | Seed is opt-in and duplicate-safe | static + type | `yarn verify:csrm-seed && yarn check-types` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | T-02-01 | Documentation exposes opt-in flag only | static | `yarn verify:csrm-seed` | ✅ | ⬜ pending |
| 02-01-03 | 01 | 1 | BOOT-01, BOOT-02, BOOT-03, BOOT-04 | T-02-02 | Relationships preserve role path | static + schema | `yarn verify:schema && yarn verify:csrm-seed` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- `scripts/verify-core-model.mjs` already validates the core relationship model.
- `yarn check-types` already type-checks the backend workspace.
- Phase 2 should add `scripts/verify-csrm-seed.mjs` and root `verify:csrm-seed`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Optional live Strapi boot with `IDAMBOX_SEED_CSRM=true` | BOOT-01 to BOOT-04 | Live Strapi boot may be sandbox-sensitive because Phase 1 build needed escalation | If local environment permits, copy `.env.example`, set `IDAMBOX_SEED_CSRM=true`, run `yarn develop:cms`, and inspect the Strapi admin content manager for the seeded records and Bob's role assignment. |

---

## Validation Sign-Off

- [x] All tasks have automated verification commands.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency target < 60s for static checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
