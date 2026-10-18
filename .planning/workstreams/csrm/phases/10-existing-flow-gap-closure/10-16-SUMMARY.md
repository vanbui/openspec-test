---
phase: 10-existing-flow-gap-closure
plan: 16
subsystem: api, ui
tags: [strapi, openapi, zod, administration, information-system, owner, d-37, uat-053]

requires:
  - phase: 10-existing-flow-gap-closure
    provides: "10-02 the Administration permission copy and the copy guard; 10-15 the latest contract and the parity guard at 42 grandfathered labels"
provides:
  - "ownerName (the owner's trimmed display name, 1-255, else null) on the Strapi Information System record and list projection (D-03 item 6)"
  - "ownerName on InformationSystemsAdministrationRecord in the spec (string or null, maxLength 255, optional) and the regenerated schema.d.ts"
  - "The web Information System record parser mirrors the bound; the form seeds OwnerCombobox with the served name or Name not available"
  - "Owner and Business criticality columns after Name in the systems list, unsortable, and an Owner · Business criticality line on its mobile card"
  - "The administration journey sets a system owner through the owner search and checks the name after a reload and the columns at 1440 (ADMIN05_SYSTEM_OWNER_COLUMNS)"
affects: [10-17, 10-23, phase-22-configurable-reference-data]

actuals:
  tokens: 7061
  tasks: 2
  commits: 4
plan_head_before: bdefa46e46baa6070cffb97360bc740d472b22d1
plan_head_after: 838c40165aec11d3f0bfc5aadd00466d73f78dfc

tech-stack:
  added: []
  patterns:
    - "A related user's name crosses as a bounded display name only: trimmed, 1-255, else null, never partial and never the rest of the user record"
    - "A relation populate names only the fields its projection reads (owner: documentId and displayName)"
    - "A list label that falls back (served name, Name not available, Not provided) is a module-level function, not logic inside the column JSX"

key-files:
  created: []
  modified:
    - apps/backend/src/api/csrm-administration/services/administration-query.ts
    - apps/backend/src/api/csrm-administration/services/administration-repository.ts
    - apps/backend/tests/administration.integration.test.ts
    - docs/references/specification.json
    - apps/csrm/src/lib/api/generated/schema.d.ts
    - apps/csrm/src/features/administration/administration-schema.ts
    - apps/csrm/src/features/administration/administration-form.tsx
    - apps/csrm/src/features/administration/administration-workspace.tsx
    - apps/csrm/src/features/administration/administration-workflow.test.tsx
    - apps/csrm/e2e/administration-workflow.spec.ts

key-decisions:
  - "10-16: ownerName is null when the trimmed display name is empty or longer than 255, so the server never serves a value the contract forbids (the 10-15 bounded-summary rule); the owner id is still served, and the UI reads Name not available"
  - "10-16: ownerName is served whatever the owner's account status: an inactive owner is still the recorded owner, and naming them lets the analyst see who to replace (the owner search offers only active users)"
  - "10-16: the Information System owner populate loads only documentId and displayName, so no other field of the user record reaches the projection (T-10-41)"
  - "10-16: ownerName is not writable; a create or update that sends it is refused with 400 by the existing closed mutation allowlist"
  - "10-16: ADMIN-05 stays open: the Information Asset owner needs a content-type change and moves to Phase 22 (D-01, D-37); requirements.ready-ids also holds it for the later Phase 10 plans that declare it"

patterns-established:
  - "projectedOwnerName(owner): the one rule for the Information System owner's served name"
  - "systemOwnerLabel and systemCriticalityLabel: the systems list's and mobile card's fallbacks in one place"

requirements-completed: [ADMIN-05]

coverage:
  - id: D1
    description: "The Information System record and list carry ownerName (the owner's trimmed display name, or null for no owner or a blank name) and nothing else of the owner's record; ownerName is not writable"
    requirement: ADMIN-05
    verification:
      - kind: integration
        ref: "apps/backend/tests/administration.integration.test.ts#ADMIN-05 UAT-053 the Information System record and list name the owner and nothing more of the owner's record"
        status: pass
      - kind: integration
        ref: "apps/backend/tests/administration.integration.test.ts#ADMIN-03 Systems and Assets preserve exact fields, owner scope, and normalized concurrency"
        status: pass
    human_judgment: false
  - id: D2
    description: "The contract declares ownerName (string or null, maxLength 255), the web parser mirrors it, and the generated schema matches (api:check clean, parity guard green)"
    requirement: ADMIN-05
    verification:
      - kind: other
        ref: "pnpm --dir apps/csrm api:check"
        status: pass
      - kind: unit
        ref: "apps/csrm/src/features/contract-response-parity.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Information System form shows Selected owner: {name}, or Selected owner: Name not available, and never the owner id"
    requirement: ADMIN-05
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/administration/administration-workflow.test.tsx#UAT-053 seeds the Information System owner with the served name and never the id"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/administration-workflow.spec.ts#Bob maintains both inventories with responsive and accessible presentation (ADMIN05_SYSTEM_OWNER_NAME)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The systems list reads Name, Owner, Business criticality, Type, Environment, Deployment model, Lifecycle, Internet-facing; Owner and Business criticality do not sort; the mobile card adds Owner: {name} · Business criticality: {value} with the same fallbacks"
    requirement: ADMIN-05
    verification:
      - kind: unit
        ref: "apps/csrm/src/features/administration/administration-workflow.test.tsx#UAT-053 lists each Information System owner and business criticality after Name, unsortable, on desktop and mobile"
        status: pass
      - kind: e2e
        ref: "apps/csrm/e2e/administration-workflow.spec.ts#Bob maintains both inventories with responsive and accessible presentation (ADMIN05_SYSTEM_OWNER_COLUMNS)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Backstop: at 1440 Name, Owner and Business criticality are visible without scrolling, and any overflow scrolls only inside the labelled table region"
    requirement: ADMIN-05
    verification:
      - kind: e2e
        ref: "apps/csrm/e2e/administration-workflow.spec.ts#ADMIN05_SYSTEM_OWNER_COLUMNS (desktop project, 1440 x 900)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this truth as a backstop that plan 10-23 re-checks in the browser; the journey proves the geometry at 1440 but not the visual read."

duration: 37min
completed: 2026-10-02
status: complete
---

# Phase 10 Plan 16: Information System owner by name, and the owner and criticality columns Summary

**The Strapi Information System record and list now serve `ownerName` (the owner's trimmed display name, 1-255, else null) through the spec, the regenerated client and the web parser; the form names the owner, never by id, and the systems list shows Owner and Business criticality right after Name on desktop and on the mobile card (D-37, UAT-053 system half).**

## Performance

- **Duration:** 37 min
- **Started:** 2026-10-02T09:20:29Z
- **Completed:** 2026-10-02T09:57:39Z
- **Tasks:** 2 of 2
- **Files modified:** 10

## Accomplishments

- **Projection (D-03 item 6).** `projectAdministrationRecord` adds `ownerName` next to `owner` for Information Systems through `projectedOwnerName`: the populated owner's `displayName`, trimmed, served when 1-255 characters, otherwise null; null when there is no owner. The repository's owner populate now loads only `documentId` and `displayName`. The record, list, create and update responses all carry it, because they share the projection.
- **Contract.** `InformationSystemsAdministrationRecord.ownerName` is `{ "type": ["string", "null"], "maxLength": 255 }` with a description, optional like `owner`. `schema.d.ts` is regenerated and committed with the spec. The create and update input schemas are unchanged, so `ownerName` is not writable: the closed mutation allowlist refuses it with 400.
- **Web parser.** `informationSystemAdministrationRecordSchema` adds `ownerName: z.string().max(255).nullable().optional()`. It mirrors the contract with no `.trim()`. The `administration.*` labels stay grandfathered for their older bounds, and the count stays at 42.
- **Form.** `OwnerCombobox` is seeded with `{ documentId: owner, displayName: ownerName?.trim() || 'Name not available' }`, so the form reads `Selected owner: Jane Doe` or `Selected owner: Name not available`, and never shows the id (UI-SPEC §16.4). The `initialValues` prop accepts `ownerName`, which is never submitted.
- **List.** The systems columns are `Name`, `Owner`, `Business criticality`, `Type`, `Environment`, `Deployment model`, `Lifecycle` and `Internet-facing`. The two new columns are plain text and are not in `sortableFields`. The mobile card adds `Owner: {name} · Business criticality: {value}`. `Owner` reads the name, `Name not available` or `Not provided`, and `Business criticality` reads the value or `Not provided` (UI-D23).
- **Journey.** The systems block gives its system a `High` criticality and the owner `Jane Doe` through the owner search. After the edit and a reload, it asserts that the form reads `Selected owner: Jane Doe` (`ADMIN05_SYSTEM_OWNER_NAME`). At 1440 it searches for that system and asserts four things (`ADMIN05_SYSTEM_OWNER_COLUMNS`):
  - the header order;
  - the first three headers are fully in the viewport and inside the table region;
  - there are no sort buttons for the two new columns;
  - there is no page overflow, and the row reads `Jane Doe` and `High`.

## Task Commits

1. **Task 1: The system owner's name travels from the record to the form**
   - RED `c5148d4` (test): the mounted case, the existing system `deepEqual` gains `ownerName: "Jane Doe"`, and the form cases.
   - GREEN `9315456` (feat): the projection, the populate, the spec, `schema.d.ts`, the parser and the form.
2. **Task 2: Owner and Business criticality in the systems list and its mobile card, then the journey**
   - RED `e5bab4b` (test): the list and card cases.
   - GREEN `838c401` (feat): the columns, the card line and the journey step.

**Plan metadata:** recorded in the docs commit that follows this summary.

## Files Created/Modified

- `apps/backend/src/api/csrm-administration/services/administration-query.ts`: `projectedOwnerName` and `ownerName` on the Information System projection.
- `apps/backend/src/api/csrm-administration/services/administration-repository.ts`: the owner populate narrowed to `documentId` and `displayName` (hydrate and findOne).
- `apps/backend/tests/administration.integration.test.ts`: the new mounted UAT-053 case (named, blank-named and no owner; create, detail and list; no email, username, account status or name parts; `ownerName` refused on write) and `ownerName` in the existing exact system record.
- `docs/references/specification.json` and `apps/csrm/src/lib/api/generated/schema.d.ts`: `ownerName` on `InformationSystemsAdministrationRecord`.
- `apps/csrm/src/features/administration/administration-schema.ts`: the parser field.
- `apps/csrm/src/features/administration/administration-form.tsx`: the owner seeding and the `initialValues.ownerName` prop.
- `apps/csrm/src/features/administration/administration-workspace.tsx`: `systemOwnerLabel`, `systemCriticalityLabel`, the two columns and the card line.
- `apps/csrm/src/features/administration/administration-workflow.test.tsx`: the form case and the list and card case.
- `apps/csrm/e2e/administration-workflow.spec.ts`: the owner and criticality steps, `ADMIN05_SYSTEM_OWNER_NAME` and `ADMIN05_SYSTEM_OWNER_COLUMNS`.

## Tests Run

| Run | Result |
| --- | --- |
| T1 RED, web (`administration-workflow.test.tsx -t UAT-053`) | 1 failed (target: `Selected owner: Jane Doe` not found), 26 skipped |
| T1 RED, Strapi (`administration.integration.test.js`) | 18 tests: 16 passed, 2 failed (the new case on `UAT053_RECORD_OWNER_NAME_MISSING`, the existing system `deepEqual` on `ownerName`); `check tdd-red-evidence`: `RED_EVIDENCE_OK` (TAP rerun, 43 s) |
| T1 GREEN, web (`src/features/administration`, `contract-response-parity.test.ts`) | 4 files, 184 passed; `api:check` clean; typecheck clean |
| T1 GREEN, Strapi (`tsc`, tests `tsc`, the administration file) | 18/18 passed (42 s) |
| T1 tracer re-run of the full `<verify>` on the committed state | exit 0 (64 s): web 184/184, `api:check`, typecheck, Strapi 18/18 |
| T2 RED, web (`-t "lists each Information System owner"`) | 1 failed (target: headers `Name, Type, …` instead of `Name, Owner, …`), 27 skipped |
| T2 GREEN, web (`src/features/administration`) | 3 files, 45 passed; typecheck and lint clean |
| Full Strapi suite (`pnpm --dir apps/backend test`, background) | 602 tests, 602 passed, 0 failed, 0 cancelled, 0 skipped; 1,282 s (601 at 10-15, plus the new case) |
| Administration journey (`test:e2e e2e/administration-workflow.spec.ts`, background) | 5 passed, 0 failed, 0 flaky, 0 skipped, 1.7 min: desktop 4 (Risk Types, Controls, Systems and Assets, CSV imports), mobile 1 (CSV imports `@journey`) |
| Full web suite (`pnpm --dir apps/csrm test`) | 126 files, 2,613/2,613 passed (2,611 at 10-15, plus the two new cases), 33 s |
| `api:check` (final) | clean; `git update-index --refresh` run afterwards |
| Tree after the Playwright run | only the three operator items and this plan's two uncommitted edits; the run changed nothing (D-48) |

## Decisions Made

- **Bounded, never partial.** `ownerName` is null when the trimmed name is empty or over 255 characters. Strapi already caps `displayName` at 255 on write, so in practice only a blank name reaches null. The UI then reads `Name not available` while the owner id keeps the relation.
- **Inactive owners keep their name.** The projection does not filter on `accountStatus`: the recorded owner is a governance fact, and naming a departed owner tells the analyst whom to replace. The owner search still offers only active users.
- **Least data loaded.** The owner populate names only `documentId` and `displayName`. The closed projection already kept the email and other fields out of the response; now they are never read either (T-10-41).
- **Not writable.** `ownerName` is in neither input schema, so the closed allowlist refuses it (400), and the mounted test proves it.
- **ADMIN-05 stays open.** `requirements.ready-ids` reports 0 of 1 ready, so REQUIREMENTS.md is not marked. The Information Asset owner moves to Phase 22 with a contract-gap record (D-01, D-37; REQUIREMENTS.md ADMIN-05 Remainder), and plan 10-23 reports ADMIN-05 as delivered except that owner.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Narrowed the Information System owner populate to the projected fields**
- **Found during:** Task 1 (GREEN)
- **Issue:** `populate: { owner: true }` loaded the whole IdamBox User record (email, username, account status, names) into the projection's input. Only the closed projection kept it out of the response.
- **Fix:** `populate: { owner: { fields: ["documentId", "displayName"] } }` in `hydrate` and `findOne`.
- **Files modified:** `apps/backend/src/api/csrm-administration/services/administration-repository.ts` (not in the plan's file list)
- **Verification:** the mounted UAT-053 case (no email, username, account status or name parts in the detail or list body); full Strapi suite 602/602.
- **Committed in:** `9315456`

**2. [Rule 3 - Blocking] RED fixture for "an owner with no served name"**
- **Found during:** Task 1 (RED)
- **Issue:** the first RED fixture, a 256-character display name, crashed in `createUserFixture` because Strapi caps `displayName` at 255. That is a fixture failure, not a valid RED.
- **Fix:** the fixture uses a blank (spaces-only) display name, which is the case that actually reaches `Name not available`. The rerun failed on the target assertion and returned `RED_EVIDENCE_OK`.
- **Files modified:** `apps/backend/tests/administration.integration.test.ts`
- **Committed in:** `c5148d4`

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking).
**Impact on plan:** the first reduces the data the read loads and is invisible to clients; the second corrects a test fixture. No scope creep; no content-type file changed.

## TDD Gate Compliance

Both tasks ran RED then GREEN, with no refactor commits. The RED commits are `c5148d4` and `e5bab4b`, and the GREEN commits are `9315456` and `838c401`. Task 1's Strapi RED is recorded as `RED_EVIDENCE_OK`. Both web REDs failed on their target assertions.

## Issues Encountered

- The journey logged Next's benign `The destination stream closed early` 9 times on the web server. It is known since 10-01 ("Issues Encountered"), and no assertion was affected.
- The full Strapi suite took 1,282 s, against 650 s at 10-15, with every test green. The duration is recorded, not investigated: no test timed out.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the display name on an analyst-only read that already served the owner id. T-10-41 is mitigated: only the trimmed, bounded name crosses, and the populate loads nothing else.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The contract now carries the D-03 item 6 change. The parity guard backlog stays at 42.
- 10-17 owns `administration-workspace.tsx`'s copy sweep. It should keep the two new columns and `systemOwnerLabel` and `systemCriticalityLabel` as they are.
- 10-23's browser walkthrough re-checks the 1440 backstop (D5) and reports ADMIN-05 as delivered except the Information Asset owner (Phase 22).

## Self-Check: PASSED

- The ten modified files exist on disk.
- Commits `c5148d4`, `9315456`, `e5bab4b` and `838c401` are on `post-demo`; `git rev-list --count bdefa46..838c401` is 4.
- Both tasks' acceptance criteria were re-run before their commits.
- Every plan-level verification passed: Strapi 602/602, web 2,613/2,613, typecheck, lint, `api:check` and the administration journey.

---
*Phase: 10-existing-flow-gap-closure*
*Completed: 2026-10-02*
