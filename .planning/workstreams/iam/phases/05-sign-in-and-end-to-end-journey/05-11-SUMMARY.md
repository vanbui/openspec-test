---
phase: 05-sign-in-and-end-to-end-journey
plan: "11"
status: complete
completed: 2026-10-18
requirements-completed: []
---

# 05-11 summary: fresh-stack Keycloak endpoint contract

**Outcome: passed.** See [05-KEYCLOAK-CONTRACT.md](05-KEYCLOAK-CONTRACT.md) for the observations and evidence path (`evidence/iam-journey-bf168559-16be-4efb-8367-45db6e22f62b/contract.json`, accepted by `journey.mjs --verify-evidence --contract`).

- Task 1 (reset): the disposable `idp` stack was absent before the session. The probe launcher ran `down -v --remove-orphans` and `up -d --build keycloak mailpit` with a private generated compose file, observed pinned Keycloak 26.6.1 and Mailpit v1.31.5, and disposed the stack (`down -v`) afterwards. The developer `docker/.env` was not read or changed.
- Task 2 (A1–A4): all four observed live. Default action-token lifespan is 43200 s, and `lifespan` is in seconds. A missing SMTP configuration yields 500. Required actions alone send no mail. Action consumption clears `UPDATE_PASSWORD`. Each operator resend delivers fresh mail. Old-link invalidation was not tested.
- Five live-only defects in the runner seams were fixed with regression tests (`96060715`, `a7bd6d82`, `767762ad`, `38a43cb1`, `ede367f1`). One of them also touches `apps/csrm/e2e/iam-journey.spec.ts` (follow Keycloak's proceed page). CSRM typecheck passes and journey tests are 222/222.
- Not changed: backend source, schemas, grants, catalogues, committed defaults and the realm seed.

SIGN-01 and SIGN-02 remain open until 05-12 and the unfiltered backend gate (B1) pass.
