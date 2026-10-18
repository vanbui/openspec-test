---
phase: 6
slug: administration-and-csv-imports
status: approved
shadcn_initialized: true
preset: new-york
created: 2026-09-01
---

# Phase 6 — UI Design Contract

> Approved visual and interaction contract for Administration and CSV Imports.

## Scope and authority

This phase gives Security Analysts create, view, edit, list, and CSV-import access to four reusable library or inventory collections:

| Collection | List route | Create route | Detail/edit route | Import route |
|---|---|---|---|---|
| Risk Types | `/app/admin/risk-types` | `/app/admin/risk-types/new` | `/app/admin/risk-types/[documentId]` | `/app/admin/risk-types/import` |
| Controls | `/app/admin/controls` | `/app/admin/controls/new` | `/app/admin/controls/[documentId]` | `/app/admin/controls/import` |
| Information Systems | `/app/admin/information-systems` | `/app/admin/information-systems/new` | `/app/admin/information-systems/[documentId]` | `/app/admin/information-systems/import` |
| Information Assets | `/app/admin/information-assets` | `/app/admin/information-assets/new` | `/app/admin/information-assets/[documentId]` | `/app/admin/information-assets/import` |

The four areas use one consistent list → dedicated create/detail form → return-to-list pattern and one consistent five-step import pattern. Deletion is not rendered anywhere in this phase. Records referenced by workflows remain editable, not deletable.

Access is Security-Analyst-only and must be enforced server-side. Hidden navigation is not authorization. A direct visit without permission renders a full-page permission state and exposes no collection data, filters, counts, form values, file contents, or import preview.

### Domain language contract

- **Risk Type** means reusable `CsrmRiskType`: a canonical definition used by future assessments. Never label it “Risk,” and never imply that editing it changes an existing contextual Risk.
- **Control** means reusable `CsrmControl`: a library definition. Never label it “Mitigation Control” or “Control Implementation.” Contextual implementations remain assessment/risk workflow records.
- Use **Information System** and **Information Asset** exactly as the JDL does.
- Use `documentId` for route identity. Do not expose Strapi numeric IDs as the primary visible identifier.
- The Strapi OpenAPI contract currently exposes generic collection CRUD and read-only workflow `/v1` endpoints but no import operation. The capability catalogue defines the required import endpoints. Implementation must close and document this backend contract gap through the typed service layer; the UI must not add raw fetches, a frontend API facade, or mock-only transport shapes.

## Design System

| Property | Value |
|---|---|
| Tool | shadcn/ui, initialized in `apps/web/components.json` |
| Preset | `new-york`; Tailwind v4; CSS variables enabled |
| Component library | Radix |
| Icon library | Lucide |
| Font | Superseded by ADR 0001: see `docs/design/csrm-design-direction.md` §3.10 |

Use existing `DataTable`, `PageHeader`, `DetailSection`, `FormSection`, `ConfirmDialog`, `StatusBadge`, `OwnerCombobox` interaction patterns, and sonner toasts. Extend a composite only when the shared behavior is genuinely reusable. Use installed official shadcn primitives before adding any primitive or dependency.

No third-party registry, design system, chart library, CSV UI kit, or competing token set is permitted for this phase.

## Spacing Scale

**Amendment (Phase 06.5):** The former spacing table and page-gutter values are
withdrawn. They restated a scale that omits the 12px, 20px and 40px steps the
product actually uses and added a 64px step it does not. [`docs/design/csrm-design-direction.md`](../../../docs/design/csrm-design-direction.md) §3.9 is the sole
authority for the spacing scale and page gutters, and §4 DataTable for row height
and in-row target sizes.

Exceptions: none for phase-authored spacing. Existing composites retain their internal layout tokens without adding values to this phase scale. Border and focus-ring composition may use a 2px stroke thickness; that is a stroke specification, not spacing. Mobile interactive controls and card-row links must expose at least a 44px practical touch target; table-internal controls must be at least 24×24px with sufficient target separation under WCAG 2.2.

## Typography

**Amendment (Phase 06.5):** Typography is governed by
[`docs/design/csrm-design-direction.md` §3.10](../../../docs/design/csrm-design-direction.md),
including the established shared table and button primitives. Uppercase micro-labels
follow its named §2 and §3.10 uses only; navigation items and form labels remain
sentence case. Numeric counts, row numbers, control numbers, dates, and pagination
use tabular numerals. This replaces the duplicate numeric type ramp while preserving
the phase's existing page and form acceptance criteria.

## Color

**Amendment (Phase 06.5):** The former colour table and its duplicate token/value
statements are withdrawn. [`docs/design/csrm-design-direction.md`
§§3.1–3.7](../../../docs/design/csrm-design-direction.md) is the sole authority for
surface, text, border, primary, status, severity, and focus values. Feature
components use semantic classes/tokens only; do not hard-code colour values in JSX.

Accent is reserved for: **Create {record}**, the active import step, selected file/row affordances, focus rings, links, and the final enabled **Confirm import** action. Secondary actions such as **Import CSV**, **Download template**, destination-specific return/back actions, **Cancel import**, density, filter, and retry controls use outline/link treatments.

Import row/result states use semantic sets with icon + text: info for Update, success for Create/Created, warning for Ambiguous, danger for Rejected/Error. Color is never the sole state signal. Do not use risk-severity colors for import validation.

## Shared page anatomy

### Navigation and headings

- Group all four links under the existing **Administration** navigation section. Show them only when the authenticated user has the appropriate capability, while independently enforcing access on the server.
- Every page starts with `PageHeader`, a useful H1, and exactly one one-line framing description.
- List header action order on desktop: outline **Import CSV**, then filled **Create {singular}**. On mobile, stack full-width with Create first in reading order and Import second.
- Breadcrumbs: `Administration / {Collection}`; create/detail/import add the current page label.
- The detail page title is the record name (or control number + name). An eyebrow or description identifies the record as reusable/inventory data.

### Framing copy

| Page | PageHeader description |
|---|---|
| Risk Types | “Manage reusable Risk Type definitions used to identify contextual Risks in assessments.” |
| Controls | “Manage reusable Control definitions; implementations remain attached to contextual Risks.” |
| Information Systems | “Manage the organisational Information Systems available to assessment workflows.” |
| Information Assets | “Manage the organisational Information Assets available to assessment workflows.” |

## List-page contract

### Common structure and behavior

1. `PageHeader` and actions.
2. Search and relevant filters in a labeled `role="search"` region.
3. Active filter chips, visible result count, and per-user density toggle from `DataTable`.
4. Server-paginated `DataTable` at ≥768px; semantic card list below 768px.
5. Honest footer showing total results, rows per page, and “Page X of Y.” Never infer a total from the current page.

All query state is URL-driven and shareable: `q`, named filters, `sort`, `page`, and `pageSize`. Search/filter/sort/page-size changes reset `page=1`; browser back/forward restores state. Use a 300ms search debounce, submit immediately on Enter, preserve typed text while loading, and prevent stale responses from replacing newer results. Default page size is 25; options are 10, 25, 50, 100. Default sorting is the collection’s stable identity ascending, with `documentId` as a server-side tie-breaker.

The entire row/card is not a hidden click target. The primary identity is an underlined-on-hover/focus link to the detail page. Sort buttons have reserved indicator space and `aria-sort`. Search, filters, density, pagination, and links remain keyboard operable.

### Per-collection table contract

| Collection | Search scope | Filters | Desktop columns | Mobile card priority | Default sort |
|---|---|---|---|---|---|
| Risk Types | name, description | Applicable Control (when supported by typed API) | Name; Description (2-line clamp); Applicable controls count; Updated | Name, description, applicable-control count | Name A–Z |
| Controls | **controlNumber, name, framework** | Framework; Control type | Control number; Name; Framework; Type; Reference; Updated | Control number + name, framework, type, reference | Control number A–Z |
| Information Systems | name, description, system type, hosting location | Environment; Deployment model; Lifecycle state; Internet-facing | Name; Type; Environment; Deployment model; Lifecycle; Internet-facing; Updated | Name, type, environment, lifecycle, internet-facing | Name A–Z |
| Information Assets | name, description, location, type | Data classification; Personal data; Legal data; Credit-card data | Name; Type; Classification; Location; Sensitive-data flags; Updated | Name, type, classification, sensitive-data flags | Name A–Z |

Boolean values display icon + “Yes”/“No,” never checkbox decoration or color alone. Enum values use human-readable contract strings (for example “Non-production,” “On-prem,” and “Critical infrastructure sensitive”). Missing optional values display “Not provided,” not an empty cell or dash without an accessible label.

Controls must remain responsive with the 2,646 seeded records: all search, framework filtering, sorting, count, and pagination execute server-side. Never load all controls into the browser, and never client-sort or client-filter the current page while implying global results.

### List states: five deliberate states

| State | Visual contract | Interaction/copy contract |
|---|---|---|
| Default/ready | Controls, result count, populated table/cards, honest pagination | All actions available; current URL state reflected in controls |
| Loading | After 300ms, skeletons mirror controls and exactly the selected page size/row density; no full-page spinner or result-count flash | Keep search/filter values visible but disabled; `role="status"` with “Loading {collection}” |
| Empty | Centered text state within table surface | First use: “No {collection} yet” + collection-specific explanation + **Create {singular}**. Filtered: “No {collection} match these filters” + “Try a different search or clear the active filters.” + **Clear filters** |
| Error | Danger-icon alert within the table surface; no stale rows presented as current | “We couldn’t load {collection}. Check your connection and try again.” + **Try again**; `role="alert"` |
| Success | List remains visible; sonner success toast with icon and text | Create: “{Singular} created.” Edit: “Changes saved.” Import: “Import complete: {created} created, {updated} updated, {rejected} rejected.” |

An additional permission state is required for denied direct access: “You don’t have permission to manage {collection}.” Provide **Return to dashboard** only; do not show list chrome or totals.

## Create and edit contract

Create and edit are dedicated pages, not dialogs or inline table rows. Use React Hook Form + zod. Validation occurs on blur, then on submit; after the first failed submit, revalidate a corrected field on change. Each error appears directly below its field with a 14px alert icon, danger text, and a message explaining both the problem and correction. Focus the first invalid field after submit and show a linked error summary only when more than one error is present.

Use `FormSection` in a single column, roughly five fields per section, with a sticky action bar only when the viewport would otherwise hide actions. Primary action labels are **Create Risk Type**, **Create Control**, **Create Information System**, **Create Information Asset** for create pages and **Save changes** for edit pages. The secondary action names its destination: **Return to Risk Types**, **Return to Controls**, **Return to Information Systems**, or **Return to Information Assets**. It returns to the originating list URL when safe.

While saving, disable duplicate submission, retain field values, show a 16px inline spinner in the primary button, and label it **Creating…** or **Saving…**. A server validation error maps to the related field; a non-field error appears in a persistent form alert and a danger toast with **Try again** where retry is safe. Success returns to the detail page and announces through a sonner toast.

If the user navigates away with unsaved changes, use the established `ConfirmDialog` pattern: title **Discard unsaved changes?**, body **Your changes to this {record} have not been saved.**, actions **Keep editing** and **Discard changes**. This is the only confirmation dialog in the CRUD surface and is not a delete action.

### Field grouping

| Record | FormSections and fields |
|---|---|
| Risk Type | **Definition:** Name (required, unique), Description. **Applicable Controls:** searchable multi-select using the established combobox interaction pattern; selected controls show control number + name and can be removed by keyboard. Explain that this maps reusable Controls, not implementations. |
| Control | **Identity:** Control number (required, unique), Name (required), Framework (required), Framework version. **Definition:** Description, Control type (Preventive/Detective/Corrective/Compensating), Control reference, Framework source. `sourceData` is provenance/internal data and is not an unrestricted JSON editor unless the backend contract explicitly requires one. |
| Information System | **Identity:** Name (required), Description, System type. **Environment:** Environment, Deployment model, Hosting location, Lifecycle state. **Exposure and ownership:** Business criticality, Internet-facing, External access required, Owner using the established OwnerCombobox interaction if the backend relation is writable. |
| Information Asset | **Identity:** Name (required), Description, Type, Location. **Classification and assurance:** Data classification, Confidentiality rating, Integrity rating, Availability rating. **Data characteristics:** Contains personal data, Contains legal data, Contains credit-card data. **Notes:** Comments. |

Use radios/segmented controls for binary values and enums of four or fewer options when they fit without wrapping; otherwise use labeled selects. Never use placeholders as labels.

### Detail context

Edit pages use `DetailSection` for read-only relationship context beneath the form where the service supplies it: applicable Controls/contextual Risks for Risk Types; applicable Risk Types and contextual Control Implementations for Controls; related assessment/risk references for Systems and Assets. These sections clarify downstream usage but provide no deletion affordance and do not imply edits cascade into historical contextual records.

## CSV import contract

Each **Import CSV** action opens its dedicated route. Import is a five-step page flow, not a dialog. The page title is **Import {collection} from CSV** and the description is **Review and validate every row before any records are created or updated.** Preserve safe in-progress client state when moving backward within the route; a full reload may require file reselection and must say so before reload/navigation.

### Step indicator

Use an ordered list above the step panel:

1. **Guidance**
2. **Select file**
3. **Review rows**
4. **Confirm import**
5. **Results**

The current step has primary accent plus “Current step” screen-reader text; completed steps use a check icon + “Complete”; future steps show their number and neutral text. Set `aria-current="step"` on the active item. On 375px, show “Step N of 5” plus current label, with the full ordered list available to assistive technology. When a step changes, move focus to the step H2 and announce “Step N of 5: {label}” in a polite live region. Reduced motion removes transitions.

### Step 1 — Guidance

- Explain that natural-key matches update existing records, unmatched valid rows create records, and rejected/ambiguous rows are not imported.
- Show an accessible expected-columns table with **Column**, **Required**, **Format/allowed values**, and **Example**. Mark required columns in text, not asterisk alone.
- Provide **Download {collection} CSV template** as an outline action; generated/downloaded content must match the current zod/service contract.
- Required columns: Risk Types `name`; Controls `controlNumber`, `name`, `framework`; Information Systems `name`; Information Assets `name`. Other writable JDL fields are optional unless backend validation says otherwise.
- Natural key: Risk Type `name`; Control `controlNumber`; Information System `name`; Information Asset `name`. Match after contract-defined trim/case normalization. Multiple existing matches or conflicting duplicate rows are **Ambiguous**, never guessed.
- Primary action: **Choose CSV file**. The collection-specific secondary label is **Return to Risk Types**, **Return to Controls**, **Return to Information Systems**, or **Return to Information Assets**.

### Step 2 — Select file and client validation

- Use a labeled file input accepting `.csv` and `text/csv`. Drag-and-drop may supplement but never replace **Choose file**.
- After selection show file name, human-readable size, last-modified date when available, and **Choose a different file**.
- Validate before preview: exactly one file, `.csv`/CSV MIME when supplied, configured size/row limit, decodable text, non-empty content, one header row, normalized unique headers, all required headers, no structurally wider rows, and required values after trimming.
- Parsing stays in a typed feature service/worker boundary, not JSX. Client validation is advisory; server authorization and validation remain authoritative.
- File-level errors appear in a persistent alert with icon + text and a corrective action. Example: **This file is missing required columns: framework. Download the template and try again.** Never upload a file that fails file/header validation.
- Primary action: **Validate and preview**. While parsing: **Validating…** with inline spinner, disabled duplicate action, and polite progress. Secondary: **Back to guidance**.

### Step 3 — Review rows

- Start with summary cards/counts for **Create**, **Update**, **Rejected**, and **Ambiguous**, all tabular numerals. State text/icons are mandatory.
- Provide filter tabs/chips for **All rows**, **Create**, **Update**, **Rejected**, **Ambiguous**, plus row-number/error search when useful. Counts are included in labels.
- Desktop preview is a table with sticky header and columns: CSV row, state, natural key, record-specific fields, and issues. Mobile uses row cards with the same priority. The state column is first after row number.
- Row state labels: check icon **Create**, refresh icon **Update**, alert-triangle **Ambiguous**, x-circle **Rejected**. Each issue names the column and correction. Example: **Row 18 · framework: Enter a framework.**
- Update rows show the matched existing record and a field-level before → after diff. Unchanged values are visually quiet. Create rows state that no existing match was found.
- Ambiguous rows list the competing natural-key candidates and remain excluded. Rejected rows remain excluded. The user may choose **Back to file selection** and replace/correct the file; there is no complex spreadsheet editor in this phase.
- Provide **Download error report CSV** when any row is rejected or ambiguous. The report includes original row number, natural key, state, and all issue messages.
- Preview is honestly paginated/virtualized for large files; counts always refer to the whole validated file.
- Primary action: **Continue to confirmation**, enabled only when at least one create/update row exists. Secondary: **Back to file selection**.

### Step 4 — Explicit confirmation

- Display file name and exact totals: “This import will create **N** and update **M** {records}. **R** rejected and **A** ambiguous rows will be skipped.”
- Repeat that imports do not delete records and that server validation may reject additional rows.
- A required checkbox reads **I have reviewed the create and update rows.** It is not preselected.
- Primary action is **Confirm import**, disabled until the checkbox is selected and there is at least one eligible row. Secondary actions are **Back to review rows** and **Cancel import**.
- On submit, lock navigation/actions, label the button **Importing…**, show inline spinner and determinate progress only when trustworthy server progress exists; otherwise use a labeled indeterminate Progress component and the text **Import in progress. Keep this page open.** Announce meaningful progress changes without per-row noise.
- `ConfirmDialog` may guard **Cancel import** before submission when leaving would discard the selected file/preview: **Cancel this import?** / **Your selected file and reviewed preview will be cleared.** / **Keep reviewing** / **Cancel import**. It must not interrupt the actual server mutation once accepted.

### Step 5 — Results

- Page-level status uses icon + heading: **Import complete**, **Import completed with rejected rows**, or **Import could not be completed**.
- Summary counts: **Created**, **Updated**, **Rejected**, and **Skipped/ambiguous**. Counts are server results, not merely client-preview counts.
- Row-detail table/cards show original CSV row, natural key, final result, server message, and link to the created/updated detail record where authorized.
- If preview and server results differ, show: **Server validation changed the result for N rows. Review the details below.**
- Primary success action: **View {collection}**. Secondary actions: **Import another CSV** and, when applicable, **Download result report CSV**.
- Do not auto-redirect. Preserve the results page on refresh through a safe import result identifier when the backend supports it; never place raw CSV contents in the URL.

### Import states: five deliberate states

| State | Visual contract | Copy/action contract |
|---|---|---|
| Ready | Current-step panel, guidance/file input/review/confirm controls as appropriate | One clear primary action; the destination-specific back action remains available before submission |
| Loading/processing | Layout-stable skeleton for server match preview, or labeled Progress/inline spinner for parsing/submission | Disable duplicate or conflicting actions; announce step/progress politely; never full-page spinner |
| Empty/no eligible rows | Preview counts show 0 create and 0 update; rejected/ambiguous details remain visible | “No rows are ready to import.” / “Correct the listed issues in your CSV, then choose the updated file.” + **Choose a different file** |
| Error | Persistent icon + text alert scoped to file, preview, or submission; keep recoverable state | “We couldn’t {validate/preview/import} this CSV. {specific correction or retry path}.” + **Try again** or **Choose a different file** |
| Complete | Step 5 icon heading, server-authoritative counts and row detail | **View {collection}**, **Import another CSV**, optional **Download result report CSV**; sonner summary toast |

If the connection fails after submission and the result is unknown, never claim failure or encourage blind resubmission. Say **We couldn’t confirm whether the import completed. Check the collection before trying again.** and provide **View {collection}** plus **Check import status** if supported.

## Copywriting Contract

| Element | Copy |
|---|---|
| Primary list CTAs | **Create Risk Type**; **Create Control**; **Create Information System**; **Create Information Asset** |
| Import entry CTA | **Import CSV** |
| Edit CTA | **Save changes** |
| Create/edit return actions | **Return to Risk Types**; **Return to Controls**; **Return to Information Systems**; **Return to Information Assets** |
| Import primary sequence | **Choose CSV file** → **Validate and preview** → **Continue to confirmation** → **Confirm import** → **View {collection}** |
| Import back actions | **Back to guidance**; **Back to file selection**; **Back to review rows** |
| First-use empty | **No {collection} yet.** “Create the first {record}, or import a CSV to add multiple records.” |
| Filtered empty | **No {collection} match these filters.** “Try a different search or clear the active filters.” |
| List error | **We couldn’t load {collection}.** “Check your connection and try again.” |
| Import empty | **No rows are ready to import.** “Correct the listed issues in your CSV, then choose the updated file.” |
| Import error | **We couldn’t import this CSV.** “Your records were not changed. Review the error details and try again.” |
| Unsaved-change confirmation | **Discard unsaved changes?** “Your changes to this {record} have not been saved.” |
| Import-cancel confirmation | **Cancel this import?** “Your selected file and reviewed preview will be cleared.” |
| Destructive confirmation | Not applicable — deletion is explicitly out of scope |

Use sentence case, direct verbs, and exact domain nouns. Never say “Something went wrong” without context or recovery. Never call reusable Controls “mitigations,” and never call Risk Types “Risks.”

## Responsive and accessibility contract

- Required viewport range: 375–1440px. No horizontal page overflow, clipped actions, or inaccessible preview columns.
- Below 768px, lists and previews render semantic cards; filters open in a Sheet with active-filter count; header actions stack; form actions remain reachable; stepper compacts to “Step N of 5.”
- At ≥768px, use tables with horizontal overflow confined to the bordered table region. Sticky headers must not obscure focus (`scroll-margin-top`).
- One H1 per page, ordered H2s per `FormSection`/step, labeled landmarks, explicit table captions/aria-labels, and meaningful page titles.
- All functionality is keyboard accessible. Focus order follows visual order; focus is visible and never trapped except in dialogs/sheets. Dialog initial focus targets the least destructive meaningful action.
- WCAG 2.2 AA contrast applies. Status and row meaning always use icon + text; required fields and errors are not color-only.
- Loading, validation, step changes, result totals, and toast-equivalent important messages have appropriate `role="status"`, `role="alert"`, or live-region behavior without duplicate announcements.
- File input instructions identify accepted type and limits before selection. Error references connect to the file control/row via `aria-describedby`.
- Respect `prefers-reduced-motion`; remove shimmer and transitions while preserving all state cues.

## Motion and feedback

Use existing tokens only: 80ms control/row state, 120ms hover, 180ms popover/step indicator, 220ms dialog/toast entry, 260ms sheet/route-panel transition; exits are shorter. Animate only opacity and transform. Nothing auto-advances, and the import step never changes without the user action or completed processing they initiated.

Use sonner bottom-right, maximum three visible. Success/info dismiss after five seconds; warnings/errors persist until dismissed. Toasts summarize mutations but never replace inline errors or the Step 5 results record.

## Component inventory

| Component | Contract in this phase |
|---|---|
| `PageHeader` | H1, one-line framing copy, list/detail/import actions |
| `DataTable` | Manual server search/filter/sort/pagination, density persistence, exact skeletons, mobile card fallback, state slots |
| `FormSection` | Single-column create/edit groups, max 640px fields |
| `DetailSection` | Read-only relationship/downstream-use context |
| `ConfirmDialog` | Unsaved-change and pre-submit import-cancel confirmation only; never delete |
| `StatusBadge` pattern | Import states with semantic token + icon + label; enum badges only where they aid scanning |
| `OwnerCombobox` pattern | Information System owner and Risk Type applicable-control searchable selection; reuse interaction, not domain-specific code blindly |
| shadcn `Progress` | Import processing/progress with accessible label |
| shadcn `Alert`, `Skeleton`, `Sheet`, `Table`, form controls | Existing state, responsive, and form primitives |
| sonner | Concise mutation/result feedback with inline persistent counterpart when action is required |

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|---|---|---|
| shadcn official | Existing installed primitives only: alert-dialog, alert, badge, button, card, checkbox, form, input, label, pagination, progress, select, sheet, skeleton, sonner, table, textarea, tooltip | Official registry; no third-party vetting required |
| Third-party | None | No third-party registry or block declared; not applicable — 2026-09-01 |

## Verification anchors

- Every collection has the same list/create/detail/import anatomy and collection-specific nouns/fields.
- Controls demonstrate server-side behavior with 2,646 records, framework filtering, and search across control number, name, and framework.
- URL state survives reload/back/forward and pagination totals are server-authoritative.
- Each list and import route demonstrably renders the five deliberate states defined above.
- Import tests cover file/header/required-value failures, create/update/rejected/ambiguous preview, explicit confirmation, server-result divergence, and unknown outcome after connection loss.
- Keyboard-only and screen-reader checks cover file selection, step progression, preview filtering, row-error navigation, confirmation, and results.
- 375px, 768px, 1280px, and 1440px checks show no clipping or page-level horizontal scroll.
- No delete action, raw component fetch, competing entity, hard-coded brand color, or client-only authorization appears.

## Sources pre-populated

| Source | Decisions used |
|---|---|
| Locked operator direction | Routes, consistent pattern, five-step imports, five states, responsive/accessibility, no deletion, control scale/search/filter |
| `.planning/ROADMAP.md` and `REQUIREMENTS.md` | ADMIN-01–04 scope and success criteria |
| `docs/design/csrm-design-direction.md` | Tokens, typography, spacing, table/form/state/motion/accessibility rules |
| `docs/CSRM-PROJECT-BRIEF.md` | Security Analyst scope, CSV behavior, typed API boundary, responsive and UX requirements |
| JDL and API/catalogue references | Exact entity language, fields/enums, relationships, natural keys, API contract gap and capabilities |
| Existing web implementation | shadcn new-york/Radix/Lucide state and established composite contracts |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved — 2026-09-01
