---
phase: 05
slug: extend-strapi-with-csrm-assessment-content-types-behind-a-fe
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-29
---

# Phase 05 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js static verifier plus TypeScript compiler |
| **Config file** | `package.json` scripts |
| **Quick run command** | `yarn verify:csrm-model` |
| **Full suite command** | `yarn verify:csrm-model && yarn verify:schema && yarn verify:csrm-seed && yarn verify:keycloak-provisioning && yarn check-types` |
| **Estimated runtime** | ~30-90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `yarn verify:csrm-model` once it exists; before it exists, run `yarn check-types`.
- **After every plan wave:** Run `yarn verify:csrm-model && yarn check-types`.
- **Before `$gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 90 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | CSRM-02 | T-05-01 | Product users remain custom IdamBox users | static schema | `yarn check-types` | yes | pending |
| 05-01-02 | 01 | 1 | CSRM-03 | T-05-01 | Questionnaire data separate from auth model | static schema | `yarn check-types` | yes | pending |
| 05-01-03 | 01 | 1 | CSRM-04 | T-05-01 | Assessment/risk data separate from auth model | static schema | `yarn check-types` | yes | pending |
| 05-02-01 | 02 | 2 | CSRM-01 | T-05-02 | Disabled CSRM APIs reject active behavior | source/static | `yarn verify:csrm-model` | no | pending |
| 05-02-02 | 02 | 2 | CSRM-01 | T-05-03 | Shared guard applies to all CSRM routes | source/static | `yarn verify:csrm-model` | no | pending |
| 05-03-01 | 03 | 3 | CSRM-01..04 | T-05-04 | Verifier covers schemas, relations, enums, and flag | static verifier | `yarn verify:csrm-model` | no | pending |
| 05-03-02 | 03 | 3 | CSRM-01..04 | T-05-04 | Docs preserve phase scope and disabled behavior | static verifier | `yarn verify:csrm-model` | yes | pending |
| 05-03-03 | 03 | 3 | CSRM-01..04 | T-05-04 | Existing platform checks still pass | full suite | `yarn verify:csrm-model && yarn verify:schema && yarn verify:csrm-seed && yarn verify:keycloak-provisioning && yarn check-types` | yes | pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 5 adds its own verifier in Plan 05-03.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Strapi admin display of disabled CSRM collections | CSRM-01 | The locked decision permits schema/admin existence when disabled; automated gate checks application-facing guard only. | Start Strapi locally with `csrmAppIsEnabled=false` and confirm Content Manager visibility does not change the API guard requirement. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or existing infrastructure coverage.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] No Wave 0 files required before implementation.
- [x] No watch-mode flags.
- [x] Feedback latency < 90s.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending
