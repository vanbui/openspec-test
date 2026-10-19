---
phase: 05-sign-in-and-end-to-end-journey
status: passed
verified: 2026-10-19
head: 72aeb261
requirements: [SIGN-01, SIGN-02]
---

# Phase 5 verification: sign-in and end-to-end journey

**Verdict: passed.** All five success criteria in ROADMAP.md are true. Each was checked by the orchestrator against the live run and the repository. None rests on a delegated executor's report.

| # | Success criterion | Evidence | Result |
|---|---|---|---|
| 1 | A CSV joiner receives Keycloak's set-password email (`execute-actions-email`, `UPDATE_PASSWORD`) in Mailpit and sets their own password through Keycloak; nothing in SCIM, mapping or provisioning sets a password | Live: `mail-*` and `password-setup-*` passed at both widths. The bundle asserts `freshMatchedMail` and `actualPasswordLink` per person. The A1–A4 endpoint contract is in `05-KEYCLOAK-CONTRACT.md`. Offline: the 05-01/05-02 password-setup unit and integration tests (in the unfiltered backend suite) prove dispatch only after the outer commit and no credential provisioning | true |
| 2 | The joiner signs in to CSRM with only the Requestor's capabilities | Live: `requestor-sign-in-*` and `requestor-access-*` passed. Capabilities equal the catalogue's Requestor set. Restricted routes, APIs and a foreign Requestor's record are refused. The screenshots show the Requestor-only navigation | true |
| 3 | On a freshly reset stack, the scripted gate runs joiner → midPoint → Strapi → Keycloak → Requestor sign-in → mover → leaver → refused in the CSRM UI and the Strapi API, and names the failing step when one breaks | Live: official run `iam-journey-35607205-…`. Preflight found no `idp` resources, `reset` removed volumes, and the database was fresh. The `immediate-refusal-*` API 403s and UI refusal came before token expiry and remote logout. `remote-completion-*` covers Keycloak disable, ended sessions and a refused fresh sign-in. Failure naming was observed live: earlier runs stopped with `JOURNEY_STAGE_FAILED:evidence` and `JOURNEY_EVIDENCE_INVALID` | true |
| 4 | A Playwright sign-in proof passes at 1440 and 375, and the gate's evidence is recorded with the phase | `evidence/iam-journey-35607205-a771-477b-a22b-3f83895cc83a/` holds `journey.json` and four screenshots (1440×900, 375×812), accepted by `journey.mjs --verify-evidence` | true |
| 5 | `pnpm --dir apps/backend test` passes; any `apps/csrm` change is limited to the sign-in journey and passes CSRM's checks | Unfiltered backend 2576/2576 (standalone 2026-10-19, and again inside the evidence stage). CSRM `typecheck` and `test` pass inside the evidence stage. The iam commits touch only `apps/csrm/e2e/iam-*`, `playwright*.config.ts`, three auth/shell tests and the generated client from the Phase 3 contract | true |

## Requirements

- **SIGN-01**: complete (criteria 1 and 2).
- **SIGN-02**: complete (criteria 3 and 4).

## Not claimed

- The journey drives midPoint tasks on demand. It makes no new claim about the elapsed five-minute cadence, which Phase 4 proved (P5-14).
- IN-03 recovery used the native retry scanner after a correction. The persistent-collision operator procedure is in `05-OPERATIONS.md`.

## Handoffs

- csrm: `apps/csrm/tsconfig.json` includes `.next/dev/types`, and `next typegen` does not rewrite it. A stale dev-server output broke `typecheck` after route moves (removed locally, 2026-10-19).
- Unchanged from the milestone brief section 9: source badges, read-only HR fields and other screen work belong to csrm.
