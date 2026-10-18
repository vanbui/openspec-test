# 02-03 Summary: IAM catalogue and unserved SCIM reservations

**Plan:** 02-03-PLAN.md
**Status:** Complete

## What landed

- Both catalogue copies (`docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`) gain `role.identity_provisioning` and `function.identity_provisioning.api` (both named Identity Provisioning). The two are linked to each other and to nothing else. The Function has no `menuPath` and reserves 21 `METHOD:/scim/v2/...` FunctionApis.
- `seed-csrm-data.ts` seeds two Applications: IdamBox CSRM (`idambox-csrm`) and IdamBox IAM (`idambox-iam`, active). Catalogue Functions are partitioned by Application, so the Identity Provisioning Function belongs to `idambox-iam`. The same file carries 02-01's `protected: false` on the two existing fixture create paths.
- `docs/references/served-operations.json` was regenerated once in its maintenance mode. Every new reservation is unserved, with a Phase 3 reason. `served-operations.integration.test.ts` holds the reasons and checks that the new internal collections mount no routes.

## Checks (run from the repository root)

| Check | Outcome |
| --- | --- |
| The two catalogue copies are byte-identical (`cmp`) | Identical |
| Prior roles (3), functions (62) and functionApis (143) are unchanged, compared with the pre-phase commit | 0 changed. The additions are 1 role, 1 function and 21 functionApis. `metadata` and `designNotes` are unchanged. |
| `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false` | Pass |
| `contract-catalogue`, `served-operations`, `iam-schema-contract` and `iam-database-invariants` tests | 47 tests, 47 pass, 0 fail, 0 skipped |

## Deviations

The execution run stopped after regenerating the inventory and before writing this summary. The orchestrator ran the checks above and wrote this summary. No commit was made inside the run.
