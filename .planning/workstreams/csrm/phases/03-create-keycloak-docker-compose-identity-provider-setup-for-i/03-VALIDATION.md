---
phase: 03
slug: create-keycloak-docker-compose-identity-provider-setup-for-i
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-25
---

# Phase 3 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js static verification scripts plus existing Yarn/Turbo checks |
| **Config file** | `package.json`, `idp/docker-compose.yml`, `idp/keycloak/import/idambox-realm.json` |
| **Quick run command** | `yarn verify:keycloak-idp` |
| **Full suite command** | `yarn verify:keycloak-idp && yarn verify:schema && yarn verify:csrm-seed && yarn check-types` |
| **Estimated runtime** | ~45 seconds in a warm workspace, excluding optional Docker startup |

---

## Sampling Rate

- **After every task commit:** Run `yarn verify:keycloak-idp` once the script exists.
- **After every plan wave:** Run `yarn verify:keycloak-idp && yarn verify:schema && yarn verify:csrm-seed && yarn check-types`.
- **Before `$gsd-verify-work`:** Full suite must be green; optional Docker startup should be run locally when Docker is available.
- **Max feedback latency:** 90 seconds for static verification and type checking in a warm workspace.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | IDP-01, IDP-02, IDP-03 | T-03-01 / T-03-02 | Local Keycloak import is repeatable and scoped to auth only | static | `yarn verify:keycloak-idp` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | IDP-04 | T-03-03 | Docs label local-only credentials and reset behavior | static | `yarn verify:keycloak-idp` | ✅ | ⬜ pending |
| 03-01-03 | 01 | 1 | IDP-01, IDP-02, IDP-03, IDP-04 | T-03-01 / T-03-02 / T-03-03 | Static verifier guards compose, realm, docs, and package script | static + type | `yarn verify:keycloak-idp && yarn check-types` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements:

- `scripts/verify-core-model.mjs` shows the existing static verifier pattern.
- `scripts/verify-csrm-seed.mjs` shows the existing source/docs verification pattern.
- Phase 3 should add `scripts/verify-keycloak-idp.mjs` and root `verify:keycloak-idp`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Start local Keycloak container and import the `idambox` realm | IDP-01, IDP-02, IDP-03 | Docker may be unavailable or restricted in the execution environment | From `idp/`, run `docker compose up -d`, inspect `http://localhost:8080/admin` with `admin` / `admin`, confirm Jane/Bob users and `idambox-csrm` client, then run `docker compose down`. |
| Reset local Keycloak to force JSON re-import | IDP-01 | Destructive to local Docker volume and should remain operator-controlled | From `idp/`, run `docker compose down -v`, then `docker compose up -d` to re-import checked-in realm JSON. |

---

## Validation Sign-Off

- [x] All tasks have automated verification commands.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing references.
- [x] No watch-mode flags.
- [x] Feedback latency target < 90s for static checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
