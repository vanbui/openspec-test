# Phase 6 — UI Review

**Audited:** 2026-09-10
**Baseline:** `06-UI-SPEC.md` (approved design contract)
**Screenshots:** not captured (no dev server; code-only audit against source in `apps/web`)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Copy strings match the contract almost verbatim, but the Step 1 guidance table silently drops the required **Example** column. |
| 2. Visuals | 2/4 | Enum form fields with ≤4 options use raw native `<select>` instead of the spec-mandated radio/segmented control, and boolean fields use unstyled native `<input type="radio">` with no design-system treatment. |
| 3. Color | 4/4 | Accent (`text-primary`/`border-primary`) appears only on the active step indicator and the results icon; semantic state tokens (`success`/`info`/`warning`/`danger`/`muted`) drive all row-state badges; no hard-coded hex/rgb found. |
| 4. Typography | 2/4 | `font-medium` (a third weight) is used repeatedly in phase-authored JSX alongside the two declared weights, violating the "exactly two weights" rule. |
| 5. Spacing | 3/4 | No arbitrary `[…px]`/`[…rem]` values found; spacing is class-based throughout, but manual `<select>` styling duplicates Input's spacing/height tokens by hand instead of via a shared primitive, risking drift. |
| 6. Experience Design | 3/4 | All five list/import states, loading/empty/error/permission handling, and unsaved-changes confirmation are implemented correctly; Step 2's file-selected state is missing required last-modified date and an explicit "Choose a different file" control. |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **Form enum fields use native `<select>` instead of required radios/segmented controls** — `controlType`, `environment`, `deploymentModel`, `lifecycleState`, and `dataClassification` all have ≤4 options, and the spec explicitly requires "radios/segmented controls for binary values and enums of four or fewer options when they fit without wrapping." All five use hand-styled `<select>` in `apps/web/src/features/administration/administration-workspace.tsx:407,417-420,436` — a systemic interaction-pattern deviation, not a one-off. **Fix:** replace these with a shadcn `RadioGroup`/segmented pattern per field.

2. **Boolean radios are unstyled native HTML, not the design system** — `internetFacing`, `externalAccessRequired`, `containsPersonalData/LegalData/CreditCardData` render as bare `<input type="radio">` with a text label and zero Tailwind/theme classes (`administration-workspace.tsx:424-425,440`). This breaks visual consistency with the rest of the form (which correctly uses the shadcn `Checkbox` elsewhere), fails the declared 44px touch-target/focus-ring contract, and provides no accent-colored selected state. **Fix:** swap in shadcn `RadioGroup`/`RadioGroupItem` (already available via Radix) for all boolean fields.

3. **Step 1 CSV guidance table omits the required "Example" column** — the contract mandates a table with **Column, Required, Format/allowed values, and Example**; `csv-import-flow.tsx:158` renders only three headers (Column, Required, Format), and the underlying `CsvColumn` type in `csv-import-schema.ts` carries no example value to render even if the column existed. **Fix:** add an `example` field to each column definition in `administrationCsvContracts` and render a fourth `TableHead`/`TableCell`.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- Toast copy matches exactly: `Import complete: ${create} created, ${update} updated, ${rejected} rejected` (`csv-import-flow.tsx:129`) mirrors the contract's `"Import complete: {created} created, {updated} updated, {rejected} rejected."`
- Empty/error/permission copy matches verbatim: `emptyState()` (`administration-workspace.tsx:89-105`) reproduces "No {collection} yet." / "No {collection} match these filters." exactly; `AdministrationPermissionState` (line 112) and the list error slot (line 251) reproduce the declared strings.
- CTA labels match: `Create {config.label}`, `Save changes`, `Return to {config.pluralLabel}`, `Choose CSV file` → `Validate and preview` → `Continue to confirmation` → `Confirm import` → `View {collection}` are all present verbatim in `csv-import-flow.tsx`.
- **Gap:** Step 1's accessible expected-columns table (`csv-import-flow.tsx:158`) has only `Column | Required | Format` headers; the contract requires a fourth **Example** column, and `CsvColumn` (`csv-import-schema.ts:22-28`) has no field to source example values from. Analysts validating a CSV against the guidance table lose the worked example the spec calls out as necessary context.
- Step 2's persistent file error is duplicated: the top-level `Alert` (line 152) and an inline `<p id="csv-file-error">` (line 164) both render the same `error` string for the same failure — not wrong, but redundant messaging not called for by the contract.

### Pillar 2: Visuals (2/4)

- **Systemic:** every ≤4-option enum field in create/edit forms (`controlType`, `environment`, `deploymentModel`, `lifecycleState`, `dataClassification`) is rendered as a native `<select>` with manually duplicated Tailwind classes (`administration-workspace.tsx:407,417,418,420,436`), when the contract requires radios/segmented controls at this threshold. This is a repeated pattern across all four collections, not an isolated miss.
- Boolean fields (`internetFacing`, `externalAccessRequired`, the three Information Asset data-characteristic flags) use raw `<input type="radio">` with no className at all (`administration-workspace.tsx:424-425,440`) — visually these render as bare browser radio buttons next to shadcn-styled text fields and Checkboxes elsewhere on the same page, an obvious inconsistency a reviewer would flag immediately in a screenshot.
- Icon-only affordances (state icons in badges, `FileCheck2`, `Check`, `RefreshCw`, `TriangleAlert`, `XCircle`) are consistently paired with `aria-hidden="true"` plus adjacent text labels (`csv-import-flow.tsx:147,171-173,189,191-192`) — this part meets the "icon + text, never color alone" contract well.
- Sort buttons/columns and row links show clear focal hierarchy (underlined links, `PageHeader` H1 + one-line description) consistent with the contract.

### Pillar 3: Color (4/4)

- `grep` for `text-primary|bg-primary|border-primary` across the administration feature and admin routes returns exactly two hits, both contract-sanctioned: the active step indicator (`csv-import-flow.tsx:146`) and the Step 5 result icon (`csv-import-flow.tsx:187`).
- Row/result state badges use the declared semantic variants (`success`, `info`, `muted`, `warning`, `danger`) defined in `src/components/ui/badge.tsx:14-19`, matching "info for Update, success for Create, warning for Ambiguous, danger for Rejected."
- No hard-coded `#hex`/`rgb()` values found anywhere in `src/features/administration` or the admin route tree.
- No risk-severity color reuse detected in the import row states.

### Pillar 4: Typography (2/4)

- Distinct sizes in use are limited to `text-sm`, `text-xl`, `text-2xl` (plus the exempt `DataTable`/badge internals) — broadly consistent with the four declared roles, though ad hoc page titles outside `PageHeader` (e.g., `AdministrationPermissionState`, `AdministrationUnavailableState`, `emptyState` — all `text-xl font-semibold`) use the Heading (20px) token rather than the Display/page-title (24px) token the contract reserves for page titles; borderline but defensible since these aren't literal page H1s.
- **Violation:** `font-medium` appears 10 times in phase-authored JSX (`administration-workspace.tsx:178,184,189,191,199,246,424,425,440,449`) on table cell links, mobile-card detail text, and radio/checkbox labels. The contract states phase-authored text "uses only the two weights above" (400 and 600) and explicitly forbids introducing another weight. `font-medium` (500) is a third weight not on the declared scale.

### Pillar 5: Spacing (3/4)

- No arbitrary bracket spacing (`[…px]`, `[…rem]`) found in the audited files — spacing is expressed through Tailwind's scale consistently.
- Manually re-implemented `<select>` styling (`min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground`, repeated 9+ times) duplicates `Input`'s internal spacing tokens by hand rather than composing a shared primitive. This isn't a spacing-scale violation per se (values match `Input`), but it is a maintenance risk: any future adjustment to `Input`/`Select` padding will silently desync these hand-copied selects.
- Touch targets: radio/checkbox rows in fieldsets use `min-h-11` (44px) consistently where labels are wrapped, satisfying the mobile touch-target rule for the styled controls; the unstyled boolean radios (Pillar 2 finding) do not carry this class and likely fall short of 44px on their own hit area.

### Pillar 6: Experience Design (3/4)

- All five list states (default/loading/empty/error/permission) are wired through `DataTable`'s `state`/`stateSlots` props (`administration-workspace.tsx:248-253`), including a distinct "Loading {collection}" label and a working "Try again" retry action — matches the contract closely.
- Import flow correctly implements progressive disclosure across five steps with `aria-current="step"`, a polite live-region step announcement (`csv-import-flow.tsx:142`), and heading focus-on-step-change (`useEffect` at line 87) — this is a genuinely strong, spec-literal accessibility implementation.
- Unsaved-changes confirmation only appears when `form.formState.isDirty` (`administration-workspace.tsx:454`), matching "this is the only confirmation dialog in the CRUD surface."
- Unknown-outcome handling after a failed commit correctly avoids blind retry language and offers "View {collection}" (`csv-import-flow.tsx:130-133,152`), matching the contract's unknown-outcome copy.
- **Gap:** Step 2's selected-file summary (`csv-import-flow.tsx:165`) shows only file name and size — it omits the required "last-modified date when available" and provides no distinct **Choose a different file** action; users must re-interact with the same file input, which the contract calls out as a named, separate affordance.
- Mobile step indicator: the contract requires that at 375px the stepper compact to "Step N of 5" plus the current label, with the full list available only to assistive technology. The implementation instead stacks all five full-text step items vertically on mobile (`grid-cols-1` at the base breakpoint, `sm:grid-cols-5` only from 640px) — visually all five steps remain always visible at 375px rather than being compacted, which will consume significant vertical space on small screens and diverges from the explicit mobile contract.

---

## Registry audit: shadcn is initialized (`components.json` present) but the phase's Registry Safety table declares no third-party registries or blocks — audit not applicable; 0 third-party blocks checked.

---

## Files Audited

- `apps/web/src/features/administration/administration-workspace.tsx`
- `apps/web/src/features/administration/csv-import-flow.tsx`
- `apps/web/src/features/administration/administration-config.ts`
- `apps/web/src/features/administration/administration-schema.ts`
- `apps/web/src/features/administration/csv-import-schema.ts`
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/app/(app)/app/admin/[collection]/page.tsx`
- `apps/web/app/(app)/app/admin/[collection]/[documentId]/page.tsx`
- `apps/web/app/(app)/app/admin/[collection]/new/page.tsx`
- `apps/web/app/(app)/app/admin/[collection]/import/page.tsx`
- `apps/web/app/(app)/app/admin/error.tsx`
- `apps/web/app/(app)/app/admin/loading.tsx`
- `.planning/phases/06-administration-and-csv-imports/06-UI-SPEC.md`
- `.planning/phases/06-administration-and-csv-imports/06-01-SUMMARY.md` through `06-11-SUMMARY.md`
