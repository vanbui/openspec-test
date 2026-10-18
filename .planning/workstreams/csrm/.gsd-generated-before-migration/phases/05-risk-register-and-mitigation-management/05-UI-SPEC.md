---
phase: 5
slug: risk-register-and-mitigation-management
status: approved
shadcn_initialized: true
preset: new-york / radix / neutral / lucide
created: 2026-08-31
---

# Phase 5 — UI Design Contract

> Visual and interaction source of truth for the Security Analyst Risk Register and contextual Risk detail experience. This contract extends the existing CSRM shell, DataTable, DetailSection, RiskRatingBadge, Risk editor, and ControlImplementation editor; it does not create a parallel design language.

---

## Scope and locked terminology

Phase 5 provides two Security Analyst-only routes:

| Route | Purpose | Access |
|---|---|---|
| `/app/risks` | Organisation-level register of contextual `CsrmRisk` records across authorised assessments | Security Analyst capability plus server-side record scope |
| `/app/risks/[documentId]` | Full contextual Risk detail and mitigation `CsrmControlImplementation` management | Security Analyst capability plus server-side record scope |

Use the JDL terms exactly:

- **Risk** is a contextual `CsrmRisk` occurrence belonging to an Assessment.
- **Risk type** is the related reusable `CsrmRiskType`; label it **Risk type**, never “Risk” or “Category”.
- **Reusable control** is a `CsrmControl` catalogue definition.
- **Mitigation control** is the user-facing name for the contextual `CsrmControlImplementation`; helper copy must make its reusable-control relationship explicit.
- Never describe hiding navigation as authorization. A denied direct route returns the permission state without disclosing whether a record exists.
- A Risk whose Assessment aggregate has the complete released/approved fact is immutable. Render a purpose-built read-only presentation with no edit, add, remove, close, save, or overflow mutation affordance. Do not render disabled mutation controls.

Out of scope: creating or deleting Risk records from the register, Risk Type administration, reusable Control administration, CSV import, register export, aggregate dashboards, and standalone mitigation-control routes. Risk close is not exposed until its server workflow contract is implemented and authorised.

## Design System

| Property | Value |
|---|---|
| Tool | Existing shadcn/ui installation |
| Preset | `new-york`; Radix base; neutral base colour; CSS variables; RSC enabled |
| Component library | Existing shadcn/Radix primitives and CSRM composites |
| Styling | Tailwind CSS v4 mapped to semantic CSS tokens; no raw brand colours in feature components |
| Icon library | Lucide React; decorative beside visible text, labelled when icon-only |
| Font | Inter through `next/font`, with system sans-serif fallback |
| Existing composites to reuse | `PageHeader`, `DataTable`, `DetailSection`, `RiskRatingBadge`, `StatusBadge`, `OwnerCombobox`, `ConfirmDialog`, `RiskEditor`, `ControlImplementationEditor` |

Do not add a dependency or a new primitive when an installed shadcn or CSRM component can express the interaction. Extend `DataTable` only where the Risk Register requires reusable filter composition; preserve its manual server sorting/pagination, density persistence, table/mobile split, skeleton geometry, and state slots.

## Information architecture

### Risk Register — `/app/risks`

1. `PageHeader`: title **Risk Register**; description **Search and manage contextual Risks across authorised assessments.** No create CTA.
2. Filter toolbar above the results: labelled search, eight categorical/relationship filters, two target-date bounds, and a clear-filters affordance only when state is active.
3. Active filter chip row, honest result count, and density toggle from the existing `DataTable` composition.
4. Desktop table at `min-width: 768px`; mobile Risk cards below `768px`.
5. Pagination footer showing total results, page position, and rows per page.

**Primary visual anchor:** the filtered results surface—the desktop table or mobile Risk-card list—is the dominant visual mass and first content target after the PageHeader. The filter toolbar supports this anchor and must not visually outweigh it.

### Risk Details — `/app/risks/[documentId]`

`PageHeader` title is the Risk number. The description is **Contextual Risk** followed by a one-line statement excerpt. The right-side status region contains inherent and residual `RiskRatingBadge` values and, when immutable, a lock icon plus **Released — read only** status badge.

**Primary visual anchor:** the Risk number and adjacent rating/status region form the route’s strongest hierarchy. They must be visible together above the detail sections so the analyst can identify the record, compare inherent/residual severity, and recognise mutable versus released state at a glance.

Render `DetailSection` groups in this order:

1. **Risk statement and classification** — Issue statement when present, Risk statement, Risk category, Risk sub-category, Risk cause, Potential impact, Data classification, Risk velocity, and a separately labelled **Risk type** relation with reusable-type name and description where available.
2. **Ratings** — Inherent likelihood, Highest inherent consequence, Inherent rating, Inherent rating rationale, Residual likelihood, Highest residual consequence, Residual rating, Residual rating rationale, and Control effectiveness. Ratings always use `RiskRatingBadge`; missing ratings say **Not provided**.
3. **Ownership and treatment** — Risk owner, Treatment owner, Treatment action, Treatment plan, Treatment status, Identified date, Target date, Treatment resolve date, Closure date, Risk communication date, Exempted, Exemption review date, Escalation details, and Comments.
4. **Mitigation controls** — contextual ControlImplementation list with reusable Control number/name, Control owner, Control status, Effectiveness rating, Evidence, Implementation due date, Implemented date, and Review date. Mutable Risks provide add, edit, and remove interactions using the Phase 4 control-implementation pattern.
5. **Related records** — Assessment number/title link, impacted Information system, and impacted Information asset. Never make a link from a relation the analyst is not authorised to read.

Use one column from 375–767px. From 768px upward, read-only definition lists may use two columns, but long statements, rationale, plans, evidence, escalation details, and comments span both columns. Edit forms remain single-column with a maximum field width of 640px; do not reproduce Phase 4’s broad two-column editor on this dedicated detail route.

## Risk Register interaction contract

### Approved target-date addendum (superseding)

This addendum supersedes the earlier omission of target-date filters. The canonical URL includes optional `targetDateFrom` and `targetDateTo` calendar dates. Desktop places the two visibly labelled native date inputs in **More filters**; mobile places the same shared controls in the full-width Sheet. Each bound independently contributes a **Target date from** or **Target date to** chip and active-filter count, resets page to 1 when changed, and retains every other filter, sort, and page size. Analysts can remove either chip, use **Clear target dates** to remove both, or use **Clear filters** to remove both with all other filters while retaining sort and page size. Loading keeps both values visible and disables their inputs and clear action.

Required evidence is: component tests for native labelled inputs, desktop popover/mobile Sheet reuse, URL round-trip, count, chips, individual/paired/global clearing, page reset, retained sort/page size, and loading persistence; browser evidence at 375px and 1440px for visible labels, keyboard operation, 44px targets, no clipping, and canonical URL behavior.

### URL-driven query state

The URL is the source of truth. Use these canonical parameters and discard unknown list-state parameters:

| Parameter | Contract |
|---|---|
| `q` | Trimmed search across Risk number and Risk statement; omitted when empty |
| `treatmentStatus` | One JDL treatment status |
| `inherentRating` | One of Low, Moderate, High, Critical |
| `residualRating` | One of Low, Moderate, High, Critical |
| `riskOwner` | Opaque active-user document ID |
| `treatmentOwner` | Opaque active-user document ID |
| `assessment` | Opaque Assessment document ID |
| `system` | Opaque Information System document ID |
| `asset` | Opaque Information Asset document ID |
| `mitigationStatus` | One ControlImplementation status; **No mitigation controls** is a distinct supported value |
| `targetDateFrom` | Optional calendar-valid `YYYY-MM-DD` inclusive lower Target date bound |
| `targetDateTo` | Optional calendar-valid `YYYY-MM-DD` inclusive upper Target date bound |
| `sort` | `{field}:{asc|desc}` from the allowlist below |
| `page` | 1-based positive integer; reset to 1 after search/filter/sort/page-size change |
| `pageSize` | 10, 25, or 50; default 25 |

Default sort is `targetDate:asc`, with null target dates after dated records. Allowed fields are `riskNumber`, `riskStatement`, `inherentRating`, `residualRating`, `treatmentStatus`, `treatmentOwner`, `targetDate`, and `assessment`. Risk severity sorting follows Low (1), Moderate (2), High (3), Critical (4), never alphabetical order. Sort buttons expose `aria-sort` and announce the field and resulting direction.

Use `router.replace(..., { scroll: false })` so filter and paging changes remain shareable without growing history. Search submits on Enter or the **Search Risks** button; categorical filters apply on selection. Owner, assessment, system, and asset filters use bounded searchable comboboxes with visible labels and server-backed options. Preserve selected relation labels in active chips. Each date bound may be used alone or with the other. Invalid, repeated, impossible, or inverted supplied date state renders the accessible non-data **Risk Register filters are invalid** state after the permission check and before any register or picker request; **Clear invalid filters** returns to `/app/risks`. **Clear filters** removes `q` and all eleven filters, preserves the selected sort and page size, and returns to page 1.

### Filter toolbar

- First row: **Search Risks** input plus **Search Risks** button; at desktop, treatment status, inherent rating, and residual rating sit alongside it.
- Remaining filters live in a labelled **More filters** popover/drawer: Risk owner, Treatment owner, Related assessment, Impacted system, Impacted asset, Mitigation-control status, and the Target date range. The range uses native date inputs with persistent visible labels **Target date from** and **Target date to**, plus a keyboard-operable **Clear target dates** action. On mobile, all filters use a full-width Sheet triggered by **Filters ({active count})** and reuse the same date-range composition.
- Active filters render as removable chips using the exact visible labels: Search, Treatment status, Inherent rating, Residual rating, Risk owner, Treatment owner, Related assessment, Impacted system, Impacted asset, Mitigation-control status, Target date from, Target date to. Each bound contributes independently to the active count and may be removed individually. **Clear target dates** removes both bounds; **Clear filters** removes both along with every other filter.
- Loading disables controls but leaves current values visible. Never clear or optimistically change the result count before the server response.
- Any date-bound change or clearing action returns to page 1 while retaining every other filter, the selected sort, and page size. Date controls use installed `Input` and `Button` primitives, semantic tokens, tabular numerics, and a minimum 44px target.

### Desktop table

Default row height is 44px; compact is 36px. The density preference uses the established per-user storage key. Header height is 40px and sticky. Use horizontal hairlines only: no zebra stripes, vertical rules, row lift, or in-page shadow.

| Column | Cell contract | Sortable |
|---|---|---|
| Risk number | Tabular identity; link to Risk Details; never truncate | Yes |
| Statement | Maximum two lines with visual ellipsis; link has full statement as accessible name/title | Yes |
| Inherent rating | `RiskRatingBadge`; **Not provided** if absent | Yes, severity order |
| Residual rating | `RiskRatingBadge`; **Not provided** if absent | Yes, severity order |
| Treatment status | Status badge with icon and label | Yes |
| Treatment owner | Display name; **Unassigned** if absent | Yes |
| Target date | `en-AU` medium date in UTC; overdue adds warning icon and **Overdue** text, not colour alone | Yes |
| Related assessment | Assessment number link when authorised; otherwise plain **Unavailable** | Yes |

The server response must provide the exact authorised total for the current filters. Show **{n} results**, **Page {x} of {y}**, and rows-per-page options. Do not derive totals from the returned page length. If a requested page is beyond the last page after data changes, replace the URL with the last valid page and show the matching skeleton during correction.

### Mobile Risk card below 768px

Each card is one linkable record summary with no horizontal scroll:

- first row: Risk number link and Treatment status;
- statement excerpt, limited to three lines;
- labelled Inherent and Residual `RiskRatingBadge` values;
- Treatment owner and Target date;
- Related assessment link when authorised;
- entire card is not one giant link: keep explicit links and 44px action targets to avoid nested interaction.

The density preference applies to the desktop table only; the mobile cards keep 12px internal padding and at least 8px gaps for touch readability.

## Risk Details interaction contract

### Mutable aggregate

- Default presentation is readable detail, not an always-open form. **Edit risk** changes the statement/classification, ratings, and ownership/treatment sections into the established validated Risk form.
- Editing uses the existing positive allowlist and sends changed fields only. The sticky/local form action row contains **Save risk** and **Discard risk changes**. **Discard risk changes** restores authoritative values; if dirty, confirm with **Discard unsaved risk changes?**.
- Validate on blur and again on submit. Place icon plus corrective text below each invalid field, connect it with `aria-describedby`, and place a form-level alert above the first field for server errors.
- On success, return to read mode, update from the authoritative response, announce **Risk changes saved.**, and preserve focus at the Edit risk trigger.
- If the server reports that the parent aggregate became released, discard local mutation UI, refresh authoritative data, and show the released read-only treatment.

### Mitigation controls

- Render each ControlImplementation as a bordered surface within the Mitigation controls `DetailSection`. The heading is **{controlNumber} — {controlName}**; supporting labels distinguish **Reusable control**, **Control owner**, **Control status**, **Effectiveness rating**, **Evidence**, **Implementation due date**, **Implemented date**, and **Review date**.
- **Add mitigation control** opens an inline form below the section introduction. Reusable control selection is required and searches the authorised reusable Control library by number/name. Creating a Control record is not offered here.
- **Edit mitigation control** opens that item’s fields in place. Submit only changed allowlisted fields. Buttons are **Save mitigation control** and **Discard mitigation changes**.
- **Remove mitigation control** is destructive and requires `ConfirmDialog`. Exact title: **Remove this mitigation control?** Exact body: **This removes the contextual implementation from this Risk. The reusable Control remains in the library.** Buttons: **Remove mitigation control** and **Keep mitigation control**. Wait for server success before removal; on failure keep the dialog open with a retryable error.
- Empty mutable section: **No mitigation controls added** / **Add a reusable Control implementation to record how this Risk is mitigated.** / CTA **Add mitigation control**.
- Empty immutable section: same heading; body **No mitigation controls were recorded before this assessment was released.** No CTA.

### Released/approved aggregate

At the top of the page, render an info surface with lock icon:

**Released assessment — read only**

**This Risk belongs to a released assessment. Risk and mitigation-control information can no longer be changed.**

All five detail sections render semantic values. There are zero mutation affordances: no Edit risk, Save, Add mitigation control, Edit mitigation control, Remove, close action, kebab menu, disabled form fields, or hidden mutation route prefetch. This rule is driven by the complete server-owned aggregate release fact, not by a client inference from a label.

## Five deliberate states

Both routes implement exactly these top-level states. Retain the route `PageHeader` in every state so orientation does not disappear.

| State | Risk Register | Risk Details |
|---|---|---|
| Populated | Toolbar, honest count, table/cards, pagination | Full five-section detail in mutable or released read-only mode |
| Loading | After 300ms, skeleton toolbar and rows/cards matching selected density and final geometry; no full-page spinner | After 300ms, header, badge, and five section skeletons matching final layout |
| Empty | First-use or filtered-empty copy below | Authorised response lacks a renderable Risk: treat as safe not-found, not a blank detail shell |
| Error | Inline alert and **Try again**; keep current URL/query visible | Inline alert and **Try again**; never show partial Risk or mitigation data after a failed aggregate load |
| Permission | Safe denied state and **Return to workspace**; no count, filters, or record clues | Same denial copy for forbidden and concealed not-found responses; no Risk number, statement, relation, or mutation clue |

Loading skeletons are silent visually but the region announces once with `role="status"` and `aria-live="polite"`. Error and permission regions use `role="alert"`. Warning/danger messages persist until dismissed or resolved.

## Copywriting Contract

| Element | Exact copy |
|---|---|
| Register page title | **Risk Register** |
| Register description | **Search and manage contextual Risks across authorised assessments.** |
| Search label | **Search Risks** |
| Search CTA | **Search Risks** |
| Register first-use heading | **No Risks in the register** |
| Register first-use body | **Contextual Risks created in authorised assessments will appear here.** |
| Register filtered-empty heading | **No Risks match these filters** |
| Register filtered-empty body | **Try a different search or clear the active filters.** |
| Filtered-empty CTA | **Clear filters** |
| Register loading | **Loading Risk Register** |
| Register error heading | **We couldn’t load the Risk Register** |
| Register error body | **Try again. If the problem continues, contact your CSRM administrator.** |
| Permission heading | **You don’t have permission to view the Risk Register** |
| Permission body | **Access is enforced by your effective CSRM capabilities and record scope.** |
| Permission CTA | **Return to workspace** |
| Detail not-found heading | **Risk not available** |
| Detail not-found body | **This Risk may no longer exist or may not be available to you.** |
| Detail error heading | **We couldn’t load this Risk** |
| Detail error body | **Try again. If the problem continues, contact your CSRM administrator.** |
| Primary edit CTA | **Edit risk** |
| Primary save CTA | **Save risk** |
| Risk editor secondary CTA | **Discard risk changes** |
| Mitigation CTA | **Add mitigation control** |
| Mitigation editor secondary CTA | **Discard mitigation changes** |
| No-op save announcement | **No changes to save.** |
| Save success announcement | **Risk changes saved.** |
| Mitigation success announcements | **Mitigation control added.** / **Mitigation control changes saved.** / **Mitigation control removed.** |
| Destructive confirmation | **Remove this mitigation control?** — **This removes the contextual implementation from this Risk. The reusable Control remains in the library.** — confirm **Remove mitigation control** / secondary **Keep mitigation control** |

Use sentence case. Preserve the capitalised domain nouns Risk, Risk type, Control, and Control implementation where the distinction is instructional. Never use “risk template” for Risk type or “control” alone when a contextual implementation is meant.

## Spacing Scale

Declared phase values, all on the existing 4px grid:

| Token | Value | Usage |
|---|---:|---|
| xs | 4px | Icon-to-label gap, rating badge internals |
| sm | 8px | Related controls, card field gaps |
| md | 16px | Default toolbar/card spacing and mobile gutter |
| lg | 24px | Section padding, tablet gutter |
| xl | 32px | Detail-section rhythm and desktop gutter |
| 2xl | 48px | Major state separation |
| 3xl | 64px | Reserved page-level state spacing |

Exceptions: 12px is allowed for table column gaps and mobile card padding; 20px is allowed for card padding; table rows are 44px default and 36px compact; all primary touch targets are at least 44px and compact row controls remain at least 24×24px per WCAG 2.2 target-size rules. Page gutters are 16px at 375px, 24px from 768px, and 32px from 1280px.

## Typography

Phase-specific content uses exactly four sizes and two weights. Shared shell tokens remain unchanged.

| Role | Size | Weight | Line Height | Usage |
|---|---:|---:|---:|---|
| Table | 13px | 400 | 18px | Desktop cells and dense supporting metadata |
| Body/Label | 14px | 400 / 600 | 20px | Body copy; 600 for visible field labels and buttons |
| Section heading | 20px | 600 | 28px | `DetailSection` headings and state headings |
| Page heading | 24px | 600 | 32px | Page title only |

Use Inter, no weight above 600, no text below 11px, and no viewport-fluid type. Apply `tabular-nums` to Risk numbers, dates, counts, pagination, and rating-order metadata. The page has one `h1`; section headings descend without skipped levels.

## Color

The percentages describe screen area. Feature components consume semantic tokens, never the literal values documented here.

| Role | Semantic token/value | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page` / `#F7F9FC` | Page canvas and open space |
| Secondary (30%) | `--color-bg-surface` / `#FFFFFF`; `--color-bg-inset` / `#EEF2F7`; sidebar token | Table, cards, sections, filter surfaces, shell chrome |
| Accent (10%) | `--color-primary` / `#155EEF` | Primary CTA, links, focus ring, active sort/pagination/filter controls, selected navigation only |
| Destructive | `--color-danger-solid` / `#D92D20` and danger subtle tokens | Confirmed mitigation removal and error feedback only |

Accent is reserved for: **Edit risk/Save risk or Add mitigation control as the single primary action in its current mode; inline record links; keyboard focus; active pagination/sort/filter state; and active navigation.** It is not used as generic card decoration or as a treatment/rating colour.

Risk ratings use the existing severity ladder tokens and non-colour signifiers:

| Rating | Token family | Signifier and accessible order |
|---|---|---|
| Low | `--color-risk-low-*` | Circle icon + Low; `Severity: low (1 of 4)` |
| Moderate | `--color-risk-moderate-*` (mapped by current alias where required) | Gauge/diamond icon + Moderate; `Severity: moderate (2 of 4)` |
| High | `--color-risk-high-*` | Triangle icon + High; `Severity: high (3 of 4)` |
| Critical | `--color-risk-critical-*` | Octagon icon + Critical; `Severity: critical (4 of 4)` |

Every status and severity presentation includes icon plus text. Colour is reinforcement only. Body text and controls meet WCAG 2.2 AA; focus indicators and meaningful boundaries meet 3:1 non-text contrast.

## Shape, motion, and responsive behavior

- Cards and table containers use `--radius-md` (8px), 1px `--color-border-default`, and no shadow. Inputs, buttons, badges, and chips use `--radius-sm` (6px), never pill buttons.
- Table hover is an 80ms colour change with no row transform. Buttons may use the established 120ms, −1px hover lift. Popovers use 180ms and Sheets use 260ms expo motion.
- Animate transform and opacity only. Do not stagger data rows. Nothing exceeds 400ms except the 1400ms skeleton shimmer.
- `prefers-reduced-motion` reduces transitions to 0.01ms, removes transforms, and makes skeletons static while preserving perceivable state changes.
- Validate at 375, 390, 430, 768, 1024, and 1440px; at 200% zoom; and with keyboard only. No page-level horizontal overflow.

## Accessibility contract

- Meet WCAG 2.2 AA. Keep skip link, header, navigation, and one main landmark from the shell.
- Search uses `role="search"`. Every filter has a persistent visible label. A placeholder never substitutes for a label.
- Comboboxes expose expanded state, active option, loading/no-result feedback, and preserve focus after selection. Sheets/dialogs trap focus and restore it to the trigger.
- Sortable headers use buttons, reserved icon space, `aria-sort`, and visible focus. Rating order is exposed through the existing badge `aria-label`.
- Dates are displayed in `en-AU` medium format using UTC for date-only values; machine-readable values use `<time datetime>` where practical.
- Mutation status messages use a polite atomic live region. Destructive and load failures use alerts. Do not rely on toasts as the sole confirmation of saved state.
- Sticky headers cannot obscure focused elements. Icon-only controls have an accessible label and tooltip. Actions are never hover-only.
- Permission and concealed-not-found presentations are deliberately indistinguishable at the record boundary and reveal no sensitive values.

## API and authorization prerequisites

The UI must consume the typed service layer only. No page component or arbitrary feature component issues raw fetch calls.

Existing Phase 4 `/v1` operations may be reused for Risk PATCH, ControlImplementation list/create/update/delete, reusable Control list, active-user search, and related authorised assessment reads. Before the Register UI is implemented, the Strapi/OpenAPI boundary must add or freeze:

1. an authorised Security Analyst `GET /api/v1/risks` projection accepting the canonical search/filter/sort/page parameters and returning exact pagination totals;
2. an authorised Security Analyst `GET /api/v1/risks/{riskId}` projection containing all five section groups, relation labels/IDs, mitigation summary, and a server-owned `mutable` or complete release-fact projection;
3. relationship option/search operations for authorised Assessments, Information Systems, and Information Assets where the existing bounded service inventory is insufficient.

Do not fall back to generic Strapi CRUD, client-side filtering of a broad collection, or inference of release from Assessment status alone. Strapi enforces Security Analyst FunctionAPI grants and record scope on every read and mutation. A 409 from release immutability returns the refreshed read-only state.

## Component inventory

| Component | Contract |
|---|---|
| `RiskRegisterTable` | Client composition of canonical URL state, filters, columns, mobile cards, and shared `DataTable` |
| `RiskRegisterFilters` | Responsive toolbar/popover/Sheet; server-backed relation pickers; active-filter count |
| `RiskDetails` | Server-compatible state router and five ordered `DetailSection` groups |
| `RiskDetailEditor` | Dedicated single-column reuse/extraction of the Phase 4 Risk editor’s allowlisted fields and owner combobox |
| `MitigationControlList` | Read/mutable switch; empty treatment; item list |
| `MitigationControlEditor` | Reuse/extraction of Phase 4 create/edit/remove interaction; searchable reusable Control selection |
| `ReleasedRiskNotice` | Lock icon, exact released copy, no actions |
| `RiskRatingBadge` | Existing ladder tokens, icon + label, orderable aria-label |
| `RiskRegisterSkeleton` / `RiskDetailsSkeleton` | Final-geometry skeletons after the 300ms threshold |

Business query parsing, severity ordering, overdue calculation, date formatting, mutability, changed-field projection, and relation resolution live in domain/service/schema modules, not JSX.

## Registry Safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official | Existing Alert, Badge, Button, Card, Command, Dialog/AlertDialog, Input, Popover, Select, Sheet, Skeleton, Table, Textarea, Tooltip | Official registry; no third-party vetting required; verified by `components.json` and `shadcn info` on 2026-08-31 |
| Third-party registries | None | No third-party block is approved for Phase 5 as of 2026-08-31 |

## Verification acceptance criteria

| Dimension | Required evidence |
|---|---|
| Copywriting | Exact title, state, released, success, empty, and destructive confirmation copy appears in component/E2E assertions |
| Visuals | Register and details screenshots at 375px and 1440px show stable hierarchy, no clipping, correct mobile cards, and no mutation affordance when released |
| Color | Semantic-token scan finds no raw colours in Phase 5 feature TSX; badges use icon + label; contrast checks pass |
| Typography | Phase content uses the declared sizes/weights, one h1, ordered headings, and tabular numerics |
| Spacing | 44/36px table density, 44px touch controls, declared gutters, no unintended horizontal overflow at all target widths |
| Registry safety | Dependency and `components.json` review shows only the official shadcn registry and no unvetted block |
| Interaction | URL round-trip tests cover every filter, all eight sorts, page correction, result totals, Clear filters, focus restoration, and keyboard-only operation |
| Authorization | Requestor and ungranted analyst routes return the safe permission state; released aggregates expose zero mutation controls; Strapi denies direct mutations |
| States | Both routes prove populated, loading, empty/not-available, error, and permission states without partial disclosure |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** verified by `gsd-ui-checker` on 2026-08-31
