# Phase 18: Risk table and spreadsheet interoperability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 18-risk-table-and-spreadsheet-interoperability
**Mode:** `--auto`, one pass. Every area was selected and took the recommended option, judged as a mature second-line cyber-governance function would choose it at the G-4 bar, within `NEXT-WAVE-DECISIONS.md` and the ROADMAP entry.
**Areas discussed:** grid approach; where the table lives; conflicts; saving; paste; scales and free text; the rating override; import; export; saved views; participant and phone views; the review lists.

---

## Grid approach (decision 7)

| Option | Description | Selected |
|---|---|---|
| Extend the DataTable on TanStack Table, measured by a two-stage spike | Already a dependency (9.2.4); full control of ARIA and tokens; Virtual only if the measurement needs it | ✓ |
| react-data-grid | MIT, editing hooks built in; scored as the alternative | |
| AG Grid, MUI X, Handsontable, canvas grids | Ranges and clipboard are commercial, or no DOM grid for screen readers | |

**Choice:** D-04. **Notes:** the direction virtualises past about 1,000 rows, and an assessment caps at 1,000 risks, so virtualisation is conditional.

## Where the table lives

| Option | Description | Selected |
|---|---|---|
| Overview and Risks routes for the analyst; the card becomes the detail sheet | A full-width grid like a SharePoint list, a separate route budget, and one place for each surface | ✓ |
| The table inside today's editor page, with in-page navigation | Less churn, but the grid shares the page and its JavaScript budget with every other panel | |

**Choice:** D-06. **Notes:** the participant page stays one page, with the read-only table, and no participant flow changes.

## Conflicts

| Option | Description | Selected |
|---|---|---|
| Per-cell base values (compare-and-set) | No schema change; per-cell resolution; edits to different cells merge; Phase 16 D-37's pattern | ✓ |
| A row version column | A schema change; conflicts the whole row on any change | |
| `updatedAt` as the version | Timestamp precision; whole-row conflicts | |

**Choice:** D-14, also applied to the single-risk PATCH so no form overwrites silently.

## Saving

| Option | Description | Selected |
|---|---|---|
| Explicit "Save changes", one call, all or nothing | One act withdraws one review; history reads as one batch | ✓ |
| Autosave | A review withdrawn on every pause; no batch boundary | |
| Per-row saves | Ten saves for ten risks, which is UAT-055's problem | |

**Choice:** D-12, D-13, D-15 (Undo saves the inverse, with bases).

## Paste

| Option | Description | Selected |
|---|---|---|
| Preview, then apply into the unsaved change set; "Apply valid only" is an explicit choice | One save path; undoable; nothing partial without saying so | ✓ |
| Preview, then save at once | A second write path beside "Save changes" | |

**Choice:** D-19.

## Scales and existing free text

| Option | Description | Selected |
|---|---|---|
| No rewrite; read case-folded matches as the label; mark the rest; readiness asks for a fix | No data migration; honest about legacy values; released risks untouched | ✓ |
| A one-time data migration | Rewrites records, including released ones (decision 9) | |
| Refuse to read legacy values | Breaks released reads | |

**Choice:** D-20, D-21. The web derives with the scale the server publishes, so Phase 22's configuration needs no web change.

## The rating override

| Option | Description | Selected |
|---|---|---|
| Two override-reason attributes on the risk | A current fact a gate can read; countable; through a contract-gap record | ✓ |
| Reuse the rating rationale | The AI always writes a rationale, so "a reason exists" would prove nothing | |
| The reason in the history only | Gates never read the history (Phase 16 D-18) | |

**Choice:** D-01, D-22. A change of likelihood or consequence clears the override, because its reason explained the old inputs.

## Import

| Option | Description | Selected |
|---|---|---|
| Two tables (risks; mitigation controls), Phase 19's machinery, one atomic commit, drift refuses | One aggregate under one lock; nothing partial without saying so | ✓ |
| Per-row commits, as for reference data | A half-applied assessment | |

**Choice:** D-23.

## Export

| Option | Description | Selected |
|---|---|---|
| Send the view definition; Strapi applies the same filter-and-sort module | The log records parsed filters; parity-tested semantics | ✓ |
| Send the visible risk ids | Loses the filters' meaning in the log and the About sheet | |

**Choice:** D-24. Participants keep Phase 19's released-record export and copy before release.

## Saved views

| Option | Description | Selected |
|---|---|---|
| A server-side entity; personal by default; shared with analysts by the owner; built-in views in code | Cross-device; one entity Phases 20 and 22 extend | ✓ |
| Browser storage only | Not shareable; the ROADMAP asks for server-side views | |

**Choice:** D-09. Participants get no saved views.

## Participant and phone views

| Option | Description | Selected |
|---|---|---|
| The same table read-only, from the participant projection; cards below 768px | Copy everywhere; no wider disclosure | ✓ |
| Keep participants on cards | Fails "Requestor views copyable" | |

**Choice:** D-05, D-07, D-18, D-26.

## The review lists

| Option | Description | Selected |
|---|---|---|
| The column chooser as a DataTable capability, remembered per browser | What the ROADMAP asks (Phase 11 D-33) | ✓ |
| Server-side views for the review lists too | Not asked | |

**Choice:** D-10.

---

## Claude's Discretion

Operation paths, names, bounds, module placement, the export's HTTP method, and the built-in views' columns are left to research, the planner and the UI-SPEC (CONTEXT, "Planner's Discretion").

## Deferred Ideas

The Risk Register's views (Phase 20); Admin-owned shared views and configurable scales (Phase 22); autosave, presence, formulas and pivots; an assessment-level override; a "Files" column; a portfolio import; importing people by email; bulk decisions and bulk contest acts.
