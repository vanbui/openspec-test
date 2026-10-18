# Phase 22: Admin role and configurable lists - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 22-admin-role-and-configurable-lists
**Mode:** `--auto`, one pass. Every area was selected and took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005 risk criteria; ISO/IEC 27001:2022 clauses 6.1.2 and 6.1.3, Annex A 5.3, 5.15, 5.18 and 8.32) at the G-4 bar, within `NEXT-WAVE-DECISIONS.md` and the ROADMAP entry. No todo matched, no discuss hook was active, and no codebase map exists.
**Areas discussed:** the re-grant; the Admin and other roles; the settings store; open acceptance rounds; what the scale allows; the AI's Accept rule; the ceiling's source; divisions and business units; shared register views; role holders and role changes; the service agent's role review; retention; the manual start; seeds and Admin-owned data; matrix and fixtures; records.

---

## The re-grant of the Administration Functions

| Option | Description | Selected |
|---|---|---|
| Split each Function: reads stay (both roles); writes move into Admin-only manage Functions | Analysts keep read, search, export and usage; FunctionAPIs keep their names and URLs (19 D-13's move) | ✓ |
| Re-grant the whole Functions to the Admin and add analyst read Functions | A FunctionAPI belongs to one Function, so the reads would still have to move | |
| Grant the Admin alongside analysts | Analysts would keep editing, against decision 1 | |

**Choice:** D-02, D-06.

## The Admin and other roles

| Option | Description | Selected |
|---|---|---|
| No analyst grant; birthright kept; may own or approve risks as any first-line person; an Admin-and-analyst combination flagged in the access review | Decision 1 and G-1; IdamBox grants are additive; logging and forward-only changes compensate | ✓ |
| Refuse an Admin as risk owner or approver | Blocks small teams; the Admin implements approved criteria rather than setting them | |
| Refuse the Admin-and-analyst combination | CSRM does not assign roles, so it would only lock a person out | |

**Choice:** D-05.

## The settings store

| Option | Description | Selected |
|---|---|---|
| One current row per closed key, plus an append-only change log written in the same transaction; code defaults when no row | State and evidence separate; a fresh database matches the decisions | ✓ |
| Versions only (the latest change is the value) | The audit log becomes a functional dependency | |
| One JSON singleton | Concurrent edits to unrelated settings conflict | |

**Choice:** D-10, D-12. **Notes:** getters stay synchronous over an in-memory value refreshed on each change (17.1-RESEARCH); R-08-36 records the multi-process refresh.

## Changes during an open acceptance round

| Option | Description | Selected |
|---|---|---|
| The round keeps the configuration it opened under (a snapshot); changes reach the next submission | No moving goalposts for deciders; 17.1-RESEARCH's recommendation | ✓ |
| The current configuration applies at once | A tightened authority could strand a round the analyst cannot edit | |
| Refuse changes while any round is open | Blocks the Admin on unrelated work | |

**Choice:** D-11.

## What the scale allows

| Option | Description | Selected |
|---|---|---|
| Descriptions and band boundaries editable; labels, structure and impact areas fixed | Stored values, AI schemas, filters and tokens carry the labels | ✓ |
| Labels renameable with aliases | Ripples through stored values, schemas and imports; deferred | |
| Descriptions only | Leaves "the rating bands" (decision 1, ADMIN-07) unconfigurable | |

**Choice:** D-13.

## The AI's Accept rule

| Option | Description | Selected |
|---|---|---|
| Decision 8's Low-or-Moderate limit stays fixed, narrowed by the appetite, never widened | An Admin widening owner authority cannot widen the AI (17.1-RESEARCH) | ✓ |
| Follows the appetite fully | A wider appetite would let the AI propose Accept for High | |
| Fixed, ignoring the appetite | The AI could recommend what the owner alone may not decide | |

**Choice:** D-14.

## The classification ceiling's source

| Option | Description | Selected |
|---|---|---|
| The Admin's setting once recorded; the deployment variable until then (bootstrap) | Behaviour unchanged until the Admin acts; production still fails closed when neither is set | ✓ |
| The Admin's setting only | Breaks deployments configured under Phase 12 | |
| The variable as an upper bound on the Admin's value | Two keys for one value; not asked | |

**Choice:** D-16. **Notes:** the unclassified default is configurable, never Public.

## Divisions and business units

| Option | Description | Selected |
|---|---|---|
| A two-level list constraining the JDL strings; labels corrected only while unused; retire and add otherwise | Matches the seeded organisation; no recorded value rewritten | ✓ |
| Two flat, independent lists | Allows impossible pairs | |
| Relations replacing the strings | Competes with the JDL | |

**Choice:** D-19.

## Shared register views

| Option | Description | Selected |
|---|---|---|
| Owners share; the Admin governs the shared set (rename, unshare, transfer) through definitions only | The Admin holds no register read; leavers' views stay usable | ✓ |
| Only the Admin publishes shared views | The Admin cannot see what a view shows | |
| A setting for who may share | Governs nothing about the views themselves | |

**Choice:** D-20.

## Role holders and role changes

| Option | Description | Selected |
|---|---|---|
| A read-only, exportable view, plus a middleware recording every change to the identity records | Meets "any role change is audited" without assigning roles in CSRM | ✓ |
| The view only | No record of role changes | |
| Role assignment in CSRM with dual control | Re-opens the IAM routes 08 D-36 removed; decision 1 rejected it | |

**Choice:** D-07, D-08.

## The service agent's role review (12 D-33)

| Option | Description | Selected |
|---|---|---|
| Withdraw every explicit grant; keep the role catalogued and the birthright rule; flag holders | Least privilege for a role no workflow uses; no AGENTS.md conflict | ✓ |
| Keep its grants | Broad analyst-shaped access with no consumer | |
| Remove the birthright as well | Reads against AGENTS.md's birthright rule | |
| Delete the role | Loses the refusal proofs and the catalogue's traceability | |

**Choice:** D-09.

## Retention

| Option | Description | Selected |
|---|---|---|
| A recorded records-retention rule, no disposal job; read-notification retention declined | Decision 2's setting; notifications are the record that people were told | ✓ |
| Build disposal now | Needs legal hold; deferred by Phase 14 | |
| Purge read notifications after a period | Loses evidence; little privacy gain | |

**Choice:** D-17.

## The manual start (G-20)

| Option | Description | Selected |
|---|---|---|
| The assigned analyst, when the policy refuses or the latest run failed or was interrupted | G-20's words; G-1 and the assignee rule hold | ✓ |
| Any analyst, at any time | Wider than G-20 | |
| The analyst's choice even when AI is available | A new capability; deferred | |

**Choice:** D-22, D-23.

## Seeds and Admin-owned data

| Option | Description | Selected |
|---|---|---|
| Create-only seeds for reference data | An Admin's edit survives every restart | ✓ |
| Keep reconciliation | Each start would revert the Admin's titles | |

**Choice:** D-06.

## Matrix and fixtures

| Option | Description | Selected |
|---|---|---|
| An `admin` matrix caller on every row, and an Admin persona with fixture subject `…5e05` and a realm user | Proves "no analyst grants" route by route; local Keycloak sign-in stays possible | ✓ |
| Integration tests only | Leaves earlier routes unproven for the Admin | |

**Choice:** D-26, D-27.

## Records

| Option | Description | Selected |
|---|---|---|
| Four records (role and access review; configuration and change log; lists, Risk Types and asset owner; manual start) and one checkpoint | Each reviewable on its own, as Phase 17.1 did | ✓ |
| One record | Mixes catalogue, schema and operation changes | |

**Choice:** `<contract_gaps>`.

---

## Claude's Discretion

Paths, names, constants, bounds, module placement and plan splits are left to research and the planner, and copy and layouts to the UI-SPEC (CONTEXT, "Planner's Discretion", "Open for research", "Open for the UI-SPEC").

## Deferred Ideas

- Renamed scale labels, a custom matrix, configurable impact areas, assessment types and business criticality.
- Configurable reminder timings and ageing bands.
- Disposal with legal hold; read-notification retention.
- Dual control for configuration changes; notices of configuration changes; a risk criteria page for everyone.
- Starting without AI by choice; an AI-off switch.
- Auto-assignment; a decider-chosen earlier review date.
- Owners and Risk Type controls imported by reference.
- Division and business-unit breakdowns in reports.
- Role assignment in CSRM.
- Retiring controls, systems or assets.
