# Phase 19 pilot rulings

Rulings the pilot made during Phase 19's execution. The plan-check rulings (iterations 2 to 6) are in `19-PLAN-CHECK.md`; the G-6 approvals are in the records themselves.

## The Keycloak path static check (2026-10-17)

`git diff --name-only bdd0f698..HEAD -- apps/ | grep -i keycloak` lists one path: `apps/backend/tests/keycloak-identity.unit.test.ts`.

**Ruling: pass, the one reviewed exception.** 19-07 (`946cb1ef`) adds a single unit test, 23 lines with nothing removed. The test asserts that effective access offers the My requests export to Jane and Bob through the Requestor birthright, never offers it to the Security Analyst Agent (which `SERVICE_IDENTITY_REFUSED_OPERATIONS` refuses), and leaves the agent its birthright list. The file is named for the identity module it tests, not for anything Keycloak does. No Keycloak source, configuration, realm, flag or harness pin changed. 19-07's plan lists the file under the pilot's ruling of 2026-10-16 (`isOperationGranted` honours the refused set). Phase 14 handled `keycloak-provisioning.unit.test.ts` the same way (`14-PILOT-RULINGS.md`).

Any later Phase 19 change to a path naming Keycloak, including review fixes, needs a new ruling here.

## Route budgets (2026-10-17)

19-11's shared-chunk regrouping cost about 127 bytes on every route. The code itself did not change; with the Exports stubbed, the routes return to their exact earlier sizes. **Ruling:** accepted for Phase 19 as chunking variance, with no lazily loaded primary action. Reclaiming at least 5 KB of headroom on `/app/risks/{documentId}` and `/app/requests/{documentId}` is a pilot-run quick task after Phase 19 closes and before Phase 19.1 (`deferred-items.md`). At the 19-15 gate the two routes sit at 298,267 and 298,436 of 300,000 bytes.

## Malformed CSV (2026-10-17)

A CSV that cannot be parsed gets its own 422 reason, `IMPORT_CSV_MALFORMED`, not the file-type refusal. Approved as an execution amendment in `docs/contract-gaps/phase-19-import-tolerance.md` (`a23aaa85`).
