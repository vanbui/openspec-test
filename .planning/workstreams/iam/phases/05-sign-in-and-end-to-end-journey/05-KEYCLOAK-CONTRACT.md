---
phase: 05-sign-in-and-end-to-end-journey
plan: "11"
status: passed
observed: 2026-10-17T22:53:39.741Z
run: iam-journey-bf168559-16be-4efb-8367-45db6e22f62b
---

# Keycloak endpoint contract (live, fresh stack)

**PASSED.** All four endpoint assumptions A1–A4 were observed against a freshly reset disposable `idp` stack running Keycloak **26.6.1**, through the committed `node docker/midpoint/e2e/journey.mjs --probe-keycloak` entry point. Evidence: [`evidence/iam-journey-bf168559-16be-4efb-8367-45db6e22f62b/contract.json`](evidence/iam-journey-bf168559-16be-4efb-8367-45db6e22f62b/contract.json), which `--verify-evidence --contract` accepts. This proves the endpoint contract only. It does not prove the journey (05-12).

The plan named `evidence/keycloak-contract/manifest.json`. The validator requires `contract.json` inside a directory named after the run, so the bundle lives there instead.

## Reset and readiness

| Step | Result |
| --- | --- |
| Preflight | No `idp` containers, volumes or networks; ports 1337/3000 free; no compiler running |
| `docker compose --project-name idp --env-file <private> … down -v --remove-orphans` | exit 0 |
| `… up -d --build keycloak mailpit` | exit 0; `quay.io/keycloak/keycloak:26.6.1`, `axllent/mailpit:v1.31.5` (healthy) |
| Readiness | realm `idambox` discovery 29 s after start; Mailpit API ready |
| Version | owned `keycloak` container: image `quay.io/keycloak/keycloak:26.6.1`, project `idp`, `127.0.0.1:8080`, `version.txt` 26.6.1 |
| Probe | passed in 26.0 s; afterwards `down -v` exit 0 |

The probe runs only Keycloak and Mailpit. midPoint is not involved. Every compose credential was generated afresh into an owner-only run directory under `apps/backend/.tmp`. Client credentials came from the committed realm-seed fixtures. Nothing secret was printed, passed as an argument or retained. The probe's source operator compiled the backend in administration mode against a new SQLite file in the run directory (core and catalogue seeded, `midPoint (dev)` registered, one sourced user created through `identity-service.createFromSource`). No listener was started.

## Observations

| Case | Observed on 26.6.1 |
| --- | --- |
| A1 | `PUT /admin/realms/idambox/users/{id}/execute-actions-email` with body `["UPDATE_PASSWORD"]` → **204**, and the mail arrives in Mailpit |
| A2 | Seven combinations: none, `client_id`, `lifespan=60`, and all three valid → 204. Unknown `client_id`, `redirect_uri` without `client_id`, and an unregistered `redirect_uri` → **400**. `lifespan` is in **seconds**: the token's `exp − iat` equals the value sent. With no query the default lifespan is **43200 s** (12 h). Source: the action token in the mail (`observed-action-token`). No local vendor checkout was supplied, so `sources` is empty. |
| A3 | Setting `requiredActions: [UPDATE_PASSWORD]` alone sends **no mail** (1 s quiet window, count unchanged). With SMTP removed the endpoint returns **500** and sends nothing. With SMTP restored, a resend delivers fresh mail. |
| A4 | A real browser follows the mailed link and sets a password, after which `UPDATE_PASSWORD` is gone from `requiredActions`. For the Strapi-sourced fixture, two explicit `iam:password-setup` resends were each accepted and each delivered a **fresh** mail. Whether an earlier link is invalidated was not tested, and nothing about it is claimed. |

Cleanup: every probe-owned remote user was deleted. The sourced fixture was deactivated through the identity service and then disabled remotely with its sessions ended. The realm SMTP was restored from its snapshot. `cleanup: true`.

## Defects found and fixed before the pass

Each was a mismatch between the offline seams and the live 26.6.1/Mailpit behaviour. Each was fixed in the runner with a regression test. No backend, schema, grant, default or realm-seed change was needed.

| Commit | Live finding | Change |
| --- | --- | --- |
| `96060715` | Docker Desktop's VM process carries the kernel argument `tsc=reliable`, which the foreign-compiler guard (`\btsc\b`) matched. Every live start was refused. | One shared guard in the runner and the probe matches only a `tsc` command word. |
| `a7bd6d82` | `/admin/serverinfo` omits `systemInfo` for admin clients outside the master realm. | The version is read from the owned `idp` keycloak container (pinned image, port and version file). It fails closed otherwise. The same change covers the journey's remote observation. |
| `767762ad` | The Strapi admin client has only `manage-users`/`view-users`/`query-*`, so it can neither read nor change realm SMTP. | Only the probe's SMTP snapshot, set and restore use the disposable bootstrap administrator, read from the owner-only compose handoff. The Strapi client keeps least privilege. |
| `38a43cb1` | Keycloak 26's user profile drops the unmanaged `journeyProbe` attribute, and Mailpit message details carry `Date` rather than `Created`. | Ownership rests on the run-scoped username, the created id and the email. Mail freshness comes from the listing row, with details matched by ID and recipient. This also affects the IN-03 collision user and the journey's mail stage. |
| `ede367f1` | The action link first shows a "Click here to proceed" page. Users without first and last names then get an account-information form. | The probe consumer and `apps/csrm/e2e/iam-journey.spec.ts` follow the proceed link. Probe users carry names (Strapi-provisioned users already do). |
