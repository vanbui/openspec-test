# Phase 21: Management dashboards and metrics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 21-management-dashboards-and-metrics
**Mode:** `--auto`, one pass. Every area was selected and took the recommended option: what a mature second-line cyber-governance function would choose (Three Lines; ISO/IEC 27005 monitoring and review; ISO/IEC 27001:2022 clause 9.1) at the G-4 bar, within `NEXT-WAVE-DECISIONS.md` and the ROADMAP entry. No todo matched, and no discuss hook was active.
**Areas discussed:** where stage transitions are recorded; history for earlier requests; the stage vocabulary; the 90th percentile; ageing units; time to release; the trend's source and drill-down; the heat map's home and rendering; persisted job history; what a failed AI job is; R-08-36 and R-08-37; who sees management metrics; where the leadership view lives; Phase 11 D-43's deferral; the records.

---

## Where stage transitions are recorded (the pilot's seam)

| Option | Description | Selected |
|---|---|---|
| A stage history the round acts feed, written by one recorder in every stage-changing act | One source for every stage; exact before the first round, where entry times are overwritten or absent (07 record item 2) | ✓ |
| Derivation on read from the round records and existing dates | No new type, but pre-round stages rest on cleared or JSON-held times | |
| History for pre-round stages only, rounds derived | Two sources stitched on every read | |

**Choice:** D-01, D-05, D-07. **Notes:** the round records stay the authority for rounds and feed the round measures directly (D-10).

## History for earlier requests

| Option | Description | Selected |
|---|---|---|
| Record from deployment; earlier requests read "Not recorded" | Phase 16 D-19's precedent; no estimate passes for a record; no production data exists yet | ✓ |
| Reconstruct from surviving dates and logs | Partly lost facts would read as exact | |

**Choice:** D-08.

## The stage vocabulary

| Option | Description | Selected |
|---|---|---|
| Intake, questionnaire, drafting, response, rework, acceptance, returned to draft, released, each with whose turn it is, derived by one function | Partitions the time to release; matches the published lifecycle and holder | ✓ |
| The eight lifecycle steps as stages | Steps repeat and go back with rounds, so they do not partition time | |
| Holder only (analyst, Requestor, participants) | Hides which round or stage is slow | |

**Choice:** D-06.

## The 90th percentile

| Option | Description | Selected |
|---|---|---|
| Nearest rank, from ten episodes, otherwise "Not available"; the median as today | Transparent and portable; no fabricated precision on small samples | ✓ |
| Interpolated in SQL | PostgreSQL-only functions (R-08-37) | |

**Choice:** D-09.

## Ageing units

| Option | Description | Selected |
|---|---|---|
| Working days (Monday to Friday, UTC dates) for ageing bands; calendar days for durations | `REPORT.md` §4's bands; today's median stays comparable | ✓ |
| Calendar days for both | Departs from §4's proposal | |
| Working days with a holiday calendar | Needs a calendar nobody owns yet (deferred) | |

**Choice:** D-09, D-12.

## Time to release

| Option | Description | Selected |
|---|---|---|
| One definition from the first submission, falling back to `submittedDate`, shared by the throughput and cycle-times reports | One figure for one question | ✓ |
| Keep the throughput median as is and add a second figure | Two answers to the same question | |

**Choice:** D-11.

## The trend's source and drill-down

| Option | Description | Selected |
|---|---|---|
| Derived as at each month end from release dates and Phase 16 and 20's history; past points open the trend's drill-down | Covers releases before this phase; exact; every point opens its records | ✓ |
| Monthly snapshots from a scheduled run | Empty for a year, and points cannot open their records | |
| An as-at filter on the register | Puts history JSON into the register's SQL (R-08-37) | |

**Choice:** D-13, D-14.

## The heat map's home and rendering (decision 13)

| Option | Description | Selected |
|---|---|---|
| One aggregate over the register's query: leadership view, risk-exposure report and a register view; a native table with counts, band icons and labels | "The filtered set" is the register's filters; cells open equal lists; readable without colour by construction | ✓ |
| An SVG grid with a separate table | Two renderings of one matrix | |
| A report-only heat map | Cannot follow arbitrary filters | |

**Choice:** D-15, D-16. **Notes:** the native table is recorded as a reading of decision 13.

## Persisted job history

| Option | Description | Selected |
|---|---|---|
| Phase 12's run record, read as history; no new type | Plan 12-01 anticipated it; every provider call already has a durable row | ✓ |
| A new persisted job entity | Duplicates the run record | |
| A shared job store replacing the registries | Multi-process coordination nobody needs yet (R-08-36's trigger) | |

**Choice:** D-21, D-24.

## What a failed AI job is

| Option | Description | Selected |
|---|---|---|
| A failed or interrupted run, grouped by job, with "Completed on retry" | Honest about retries and restarts; refusals before the call are not AI failures | ✓ |
| Every failed job in the registries | Kept for an hour in one process | |

**Choice:** D-21, D-22.

## Who sees management metrics

| Option | Description | Selected |
|---|---|---|
| Human Security Analysts only; first-line people keep personal figures; leaders outside CSRM get prints and exports | Need to know (G-12); no new role; the second line reports to management | ✓ |
| Executive approvers see the leadership view | Needs a new grant or role, and exposes other requests | |

**Choice:** D-17, D-25.

## Where the leadership view lives

| Option | Description | Selected |
|---|---|---|
| It leads the Reports index | No new nav item (`REPORT.md` §5); each section opens its report | ✓ |
| A new "Overview" item in Oversight | One more page for the same audience | |
| The analyst Home | Home is for the day's work (Phase 11 D-18) | |

**Choice:** D-19.

## Phase 11 D-43's deferral

| Option | Description | Selected |
|---|---|---|
| Split the control-effectiveness report like exposure; alerts unchanged | Decision 11 for the leadership figures; the analyst's work view keeps its population | ✓ |
| Released-only alerts with a stage filter | No figure here needs it | |

**Choice:** D-20.

## Records

| Option | Description | Selected |
|---|---|---|
| Two records: the stage history (new type) and the AI job history (an amendment, no schema change) | One per ROADMAP item, each reviewable on its own | ✓ |
| One record | Mixes a new type with a reading of Phase 12's | |

**Choice:** `<contract_gaps>`.

---

## Claude's Discretion

Paths, names, constants, module placement, whether the leadership view composes one read, whether Home's additions extend the dashboard summary, and the copy and layouts are left to research, the planner and the UI-SPEC (CONTEXT, "Planner's Discretion", "Open for research", "Open for the UI-SPEC").

## Deferred Ideas

- Alert acknowledgement and assignment.
- Division and business-unit breakdowns (Phase 22).
- Per-analyst workload, time to pick-up and reassignment counts.
- Recent activity and a per-request stage timeline from the history.
- Reconstructed history; a holiday calendar; configurable bands.
- Trends of other measures; forecasting.
- Heat maps for participants; saved heat-map views; drill-down exports.
- Portfolio metrics for first-line leaders.
- A shared job store (R-08-36); PostgreSQL suites (R-08-37).
