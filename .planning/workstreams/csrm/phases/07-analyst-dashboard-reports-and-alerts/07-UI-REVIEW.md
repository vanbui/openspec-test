# Phase 07 — UI Review

**Audited:** 2026-09-25
**Baseline:** `07-UI-SPEC.md` (approved), `07-CONTEXT.md`, and `docs/design/csrm-design-direction.md` including its 2026-09-24 extensions (§3.14 chart geometry and marks; §4 segmented control, KPI tiles, cleared empty state, urgency, block links)
**Method:** A scripted Playwright audit ran against the development servers with the Phase 7 fixture seeded. It covered axe (WCAG 2.0/2.1/2.2 A and AA tags), horizontal overflow, console errors and full-page screenshots, then a visual review of those screenshots. The screenshots are local audit artefacts and are not committed.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every alert names its condition in words ("Treatment overdue by 30 days"). Released sources say "Released · read-only". Reports state their basis ("Computed from current records as at …"). |
| 2. Visuals | 3/4 | The hierarchy is clear: serif title, then display-size KPI values, then widget headings. In the dashboard's equal-height grid, shorter widgets carry a large empty area at 1440px. |
| 3. Color | 4/4 | Ink is the only interactive colour. Urgency uses the status hues and severity bars use the risk `fg` tokens, with no new hue. Meaning never rests on colour alone: every badge pairs an icon with text. |
| 4. Typography | 4/4 | The design-system conformance scan resolves every rendered text element on the Phase 7 routes to a §3.10 pair. Mono micro-labels, a serif only at 20px and above, and tabular figures throughout. |
| 5. Spacing | 3/4 | Card padding, grid gaps and the KPI subgrid alignment hold at all four widths, with no overflow. The empty space in shorter dashboard widgets (Pillar 2) is the one rhythm weakness. |
| 6. Experience Design | 4/4 | Every tile total equals the total of the list it opens. Widgets fail independently. The deep link lands below the sticky header. Denial discloses nothing. All five states render on every surface. |

**Overall: 22/24**

---

## Measured Evidence

### Alerts (`/app/alerts`)
- **Widths 1440, 1024, 768 and 375:** populated (10 results), no error state, zero axe violations, zero horizontal overflow.
- **Mobile navigation sheet at 375×667:**
  - It scrolls (`overflow-y: auto`; content 864px in a 667px sheet).
  - All 14 items and the "Development role" select are reachable.
  - The select is visible after scrolling.
- **Control Implementation deep link:** `/app/risks/{id}#mitigation-controls` lands the section heading exactly at the sticky header's bottom edge (64px at 1440, 56px at 375).
- **Requestor and Secondary Requestor:**
  - no Alerts navigation item;
  - a direct URL shows the permission state alone, with no rows and no record links;
  - axe-clean.

### Reports (`/app/reports`, four reports)
- **Coverage:** 20 page loads (index plus four reports, at four widths). Zero axe violations, zero overflow and zero error states. Every chart section carries its table.
- **Period control** (throughput report, choosing 12 months):
  - updates the URL to `?period=12`;
  - checks the 12-month option and keeps focus on it;
  - shows no skeleton flash;
  - renders 12 month rows.
- **Unknown key as analyst:** "Report not found".
- **Requestor, three URLs:** the index, a known key and an unknown key render the same "Reports" permission state and the same document title, so no report key is disclosed.

### Analyst dashboard (`/app/review`)
- **Widths 1440, 1024, 768 and 375:** all eight sections render ("Needs action" plus seven widgets). No error state, zero axe violations, zero overflow. Exactly one navigation item is current ("Analyst dashboard").
- **Tile-to-list equality, observed in the browser:**

  | Tile | Tile value | List total |
  |------|-----------:|-----------:|
  | Requires my attention | 9 | 9 |
  | Overdue | 6 | 6 |
  | Due within 14 days | 2 | 2 |
  | Needs attention | 2 | 2 |

- **Nested review route** (`/app/review/requests`): only "Assessment Requests" is current.
- **Requestor:** no Analyst dashboard navigation item. A direct URL shows the permission state with no tiles.
- **Console:** no errors on any audited page.

---

## Fixed During Review

- **Alert row measure in narrow containers.** From the `@md` container size, the shared alert row placed the record identifier, its "Risk · statement" description and the governing date on one line. In a half-width dashboard widget at 1440px, that left the description about 180px wide, and it truncated into a cramped column.
  - Fix (`2db13a7`): the identifier and description now share a line only from `@2xl` and stack below it. The description gets a 312–326px measure; condition, badges and date keep their two-line layout.
  - Re-checked: 265 unit tests across the alerts, dashboard and reports features; no overflow at 375px.

---

## Remaining Findings (follow-ups, none blocking)

**Disposition at phase close-out (2026-09-25):** finding 1 is fixed in this phase: `DashboardWidget` no longer stretches its row area to pin the footer at the card's bottom edge, so a sparse widget's links follow its rows and the spare height of an equal-height row falls after them (the Requestor dashboard already behaves this way). Re-checked at 1440px: zero axe violations, zero overflow, zero console errors. Findings 2, 3 and 4 are carried into Phase 8 as locked decisions: the DataTable scroll-edge cue (08-CONTEXT D-29), the print stylesheet (D-33) and the "Menu" accessible name (D-26). Nothing remains open against Phase 7.

1. **WARNING (Visuals and Spacing): shorter dashboard widgets stretch to their row's height.** At 1440px "Treatments due" and "Upcoming due dates" match the height of taller neighbours, leaving a large empty band above their footer links. Options:
   - let cards take their content height (`items-start`), at the cost of misaligned footers;
   - raise the widget row caps so the paired widgets carry comparable content.

   Either is a small change to `features/analyst-dashboard/analyst-dashboard.tsx`; it is recorded as a Phase 8 polish item.
2. **INFO (Experience Design): the risk-exposure cross-tab at 375px.** The table region is labelled, focusable, scrolls from the keyboard and keeps its first column. But the cut falls on a column boundary, so nothing visual says more columns exist to the right. The direction document allows only a hairline at the sticky edge. A scroll-edge cue would need a recorded CSRM extension.
3. **INFO (Experience Design): printing a report prints the application shell.** The report body itself prints legibly, but there is no print stylesheet to hide the sidebar and header. Export is deferred (D-06); a print stylesheet is a Phase 8 polish candidate.
4. **Carried, not Phase 7: mobile "Menu" button label.** Its accessible name is "Open navigation" while its visible label is "Menu" (WCAG 2.5.3 Label in Name, Level A). The axe rule for this is disabled by default, so the suite does not catch it. It is recorded for the Phase 8 accessibility sweep.

---

## Files Audited

- `apps/web/app/(app)/app/alerts/*`, `apps/web/app/(app)/app/reports/(report-index)/*`, `apps/web/app/(app)/app/reports/[reportKey]/*`, `apps/web/app/(app)/app/review/(analyst-dashboard)/*`
- `apps/web/src/features/alerts/*`, `apps/web/src/features/reports/*`, `apps/web/src/features/analyst-dashboard/*`
- `apps/web/src/components/csrm/{kpi-tile,bar-chart,segmented-control,alert-urgency-badge}.tsx`, `apps/web/src/components/states/*`, `apps/web/src/config/navigation/navigation.ts`

---

_Reviewed: 2026-09-25_
_Reviewer: gsd-ui-auditor role, performed by the orchestrator from browser measurements_
