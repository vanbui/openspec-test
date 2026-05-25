---
phase: 04
slug: provision-strapi-idambox-users-into-keycloak-from-backend-li
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-25
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js static verifier plus TypeScript compiler |
| **Config file** | `package.json`, `apps/backend/tsconfig.json` |
| **Quick run command** | `yarn verify:keycloak-provisioning` |
| **Full suite command** | `yarn verify:keycloak-idp && yarn verify:keycloak-provisioning && yarn verify:schema && yarn verify:csrm-seed && yarn check-types` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn verify:keycloak-provisioning` once the command exists; before then run `yarn verify:keycloak-idp`.
- **After every plan wave:** Run `yarn verify:keycloak-idp && yarn verify:keycloak-provisioning && yarn check-types`.
- **Before `$gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 60 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | IDP-06 | T-04-01 | Admin API client uses local-only secret and service account, not admin/admin. | static | `yarn verify:keycloak-idp` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | IDP-06 | T-04-01 | Env docs require explicit provisioning flag and client secret. | static | `yarn verify:keycloak-idp` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 2 | IDP-05, IDP-06 | T-04-02 | Provisioning disabled unless explicitly enabled and configured. | static/type | `yarn check-types` | ✅ | ⬜ pending |
| 04-02-02 | 02 | 2 | IDP-05 | T-04-03 | User create/update maps by email/externalSubject and clears password after success. | static/type | `yarn check-types` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 3 | IDP-05, IDP-06 | T-04-01/T-04-03 | Static verifier proves realm, backend, docs, and password-clearing contract. | static | `yarn verify:keycloak-provisioning` | ❌ W3 | ⬜ pending |
| 04-03-02 | 03 | 3 | IDP-05, IDP-06 | — | Full verification command chain passes. | command | `yarn verify:keycloak-idp && yarn verify:keycloak-provisioning && yarn verify:schema && yarn verify:csrm-seed && yarn check-types` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers the phase requirements. Plan 03 adds the missing static verifier command.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end Keycloak runtime provisioning | IDP-05 | Requires Docker Keycloak and Strapi runtime credentials; not always available in automated planning/execution environment. | From `idp/`, run `docker compose up -d`; run backend with provisioning env vars; create/update an IdamBox user; inspect the `idambox` realm user in Keycloak; reset with `docker compose down -v` when needed. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

