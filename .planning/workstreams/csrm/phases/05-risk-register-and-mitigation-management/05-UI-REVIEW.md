# Phase 5 — UI Review

**Audited:** 2026-09-10
**Baseline:** `.planning/phases/05-risk-register-and-mitigation-management/05-UI-SPEC.md`
**Screenshots:** not captured (no dev server running at localhost:3000/5173/8080 — code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Every mandated string (titles, empty/error/permission copy, save/discard/confirm CTAs, announcements) is verbatim and asserted in tests. |
| 2. Visuals | 3/4 | Read mode uses three distinct `DetailSection` cards, but the edit-mode form collapses all three sections into one card with raw `<h2>` sub-headers, producing a jarring layout shift and duplicated-heading structure between modes. |
| 3. Color | 4/4 | No hardcoded hex/rgb in Phase 5 feature files; `text-primary`/accent restricted to links; all severity/status presentation pairs icon + text, never colour alone. |
| 4. Typography | 3/4 | Register and detail read views hold to the declared 13/14/20/24px scale, but `RiskDetailEditor`'s inline "Ratings" and "Ownership and treatment" sub-headers use `text-lg` (18px), a fifth undeclared size not in the phase's four-size contract. |
| 5. Spacing | 4/4 | Table density (44px/36px), header height (40px), touch targets (44px links/buttons), and gutter/gap classes all trace to the declared 4px-grid tokens or documented exceptions. |
| 6. Experience Design | 4/4 | All five deliberate states (populated/loading/empty/error/permission) implemented on both routes with 300ms-delayed final-geometry skeletons, polite live-region success/no-op announcements, destructive `ConfirmDialog` with retry-on-failure, and structurally zero mutation affordances when released. |

**Overall: 22/24**

---

## Top 3 Priority Fixes

1. **Edit-mode Risk form collapses 3 spec-mandated `DetailSection` groups into 1 Card with raw `<h2>` sub-headers** (`apps/web/src/features/risks/risk-detail-editor.tsx:183,191`) — Analysts lose the visual/structural anchor they had in read mode (three separate bordered Cards for "Risk statement and classification," "Ratings," "Ownership and treatment") the instant they click Edit, and the DOM briefly has multiple sibling `<h2>` inside a section already headed by an `<h2>` from `DetailSection`. Fix: keep three separate `DetailSection`/Card wrappers in edit mode (or otherwise preserve the visual section boundaries) rather than one flat form with ad hoc headers.
2. **`text-lg` introduces an undeclared fifth typography size** (`apps/web/src/features/risks/risk-detail-editor.tsx:183,191`) — Violates the "exactly four sizes and two weights" typography contract (13/14/20/24px). Fix: replace `text-lg font-semibold` with the same `text-xl`/section-heading treatment (20px/600) used by `DetailSection` headings elsewhere in the phase, or better, resolve finding #1 and let `DetailSection` supply the heading.
3. **`RiskDetailEditor`'s "Edit risk" trigger button lives inside the "Ownership and treatment" section, far from the Risk number/rating status header** (`apps/web/src/features/risks/risk-details.tsx:97`) — The spec's primary visual anchor for the details route is "the Risk number and adjacent rating/status region... visible together... so the analyst can identify the record, compare inherent/residual severity, and recognise mutable versus released state at a glance," implying the primary action should sit near that anchor. Placing Edit risk at the bottom of the third section (after two full sections of read content) weakens that anchor once the page scrolls. Fix: consider surfacing Edit risk in the `PageHeader` action region alongside the rating/status badges, consistent with the accent-reservation rule ("Edit risk/Save risk... as the single primary action in its current mode").

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- Register: title "Risk Register", description "Search and manage contextual Risks across authorised assessments." exact match (`apps/web/app/(app)/app/risks/page.tsx:11-12`).
- Empty/filtered-empty/error/permission copy exact match to spec table (`risk-register.tsx:71-84`).
- Detail: not-found/error/permission copy exact match (`risk-details.tsx:127-138`); released banner copy exact ("Released assessment — read only" / full body) (`risk-details.tsx:85`).
- Mitigation confirm dialog title/body/buttons exact ("Remove this mitigation control?", "This removes the contextual implementation from this Risk. The reusable Control remains in the library.", "Remove mitigation control"/"Keep mitigation control") (`mitigation-control-list.tsx:123`).
- Save/discard/no-op/success announcements exact and covered by component tests (`risk-details.test.tsx:142,155,180,191,202`).
- No generic "Submit"/"OK"/"Click Here" labels found in the feature directory.

### Pillar 2: Visuals (3/4)
- Register: DataTable is the dominant visual mass beneath `PageHeader`; filter toolbar sits above but does not visually outweigh it (`risk-register.tsx:130-133`).
- Detail read mode renders exactly the spec's ordered five `DetailSection` groups as Card composites with clear boundaries (`risk-details.tsx:92-104`).
- **Defect:** in edit mode, `RiskDetailEditor` is rendered inside a single `DetailSection` titled "Risk statement and classification" (`risk-details.tsx:87-90`) but internally injects two more raw `<h2 className="pt-2 text-lg font-semibold">` labels for "Ratings" (`risk-detail-editor.tsx:183`) and "Ownership and treatment" (`risk-detail-editor.tsx:191`) instead of using `DetailSection`/Card. This means: (a) the three-Card visual rhythm established in read mode disappears while editing, (b) three `<h2>` elements exist for what reads as one section region, and (c) the icon-only "Edit risk" trigger's context (its home section, "Ownership and treatment") is no longer visually distinguishable once editing starts.
- Icon-only controls (pagination chevrons, filter-chip remove `X`, density toggle icon) all carry `aria-label`, satisfying the icon-pairing rule.

### Pillar 3: Color (4/4)
- `grep -rn "#[0-9a-fA-F]\{3,8\}\|rgb(" apps/web/src/features/risks` returns no matches — no raw brand colours in feature TSX.
- `text-primary` used twice total, both for inline record links (`risk-details.tsx:184`, `risk-register-filters.tsx:89`) — matches the spec's accent reservation for "inline record links."
- `RiskRatingBadge` pairs an icon (`CircleCheckIcon`/`CircleGaugeIcon`/`TriangleAlertIcon`/`OctagonAlertIcon`) with text and an `aria-label` of the exact form `Severity: {label} ({n} of 4)` (`risk-rating-badge.tsx:46-55`), matching the non-colour-signifier contract.
- Overdue target dates render an `AlertTriangle` icon plus literal "Overdue" text via `text-warning`, not colour alone (`risk-register.tsx:67`).
- Treatment status renders icon + label via `Badge variant="outline"` (`risk-register.tsx:58-61`) rather than a solid colour fill.

### Pillar 4: Typography (3/4)
- Register state headings correctly use `text-xl font-semibold` (Tailwind default 20px/28px), matching the declared Section heading role (`risk-register.tsx:71,72,76,80,84`).
- Body/label text consistently uses `text-sm font-medium` (14px) across filters, definition lists, and form labels.
- **Defect:** `risk-detail-editor.tsx:183` and `:191` use `text-lg font-semibold` (18px), which is not one of the four declared sizes (13/14/20/24px). This is the only occurrence of `text-lg` anywhere in the Phase 5 feature directory (confirmed via grep), so it is an isolated but real scale violation.
- `tabular-nums` correctly applied to Risk numbers, dates, counts, and pagination (`risk-register.tsx:67,119`, `data-table.tsx:253,355`, target-date inputs `risk-register-filters.tsx:113,117`).
- One `h1` per route is preserved by `PageHeader`; `DetailSection`/state headings correctly descend to `h2` without skipping levels, except for the edit-mode double-`h2` structural issue noted under Visuals.

### Pillar 5: Spacing (4/4)
- Desktop row heights: `h-11` default (44px) / `h-9` compact (36px), exactly matching the spec (`data-table.tsx:210`, reused in `risk-register.tsx` via `DataTable`).
- Header row height `h-10` (40px), sticky (`sticky top-0 z-10`) (`data-table.tsx:275-277`).
- Touch targets: relation-combobox inputs and date inputs use `h-11` (44px) on the shared filter fields (`risk-register-filters.tsx:113,117`), mobile card links use `min-h-11` (`risk-register.tsx:132`), sort-header buttons reserve `min-h-6 min-w-6` (24px, matching the compact-control exception).
- Mobile card container padding is `p-3` (12px), matching the declared mobile-card exception; internal card layout uses `space-y-3` (12px) gaps.
- `max-w-[640px]` arbitrary value on both edit forms exactly matches the spec's declared "maximum field width of 640px" for edit forms — an intentional, spec-sanctioned arbitrary value, not a violation.
- No other arbitrary px/rem values found outside the two spec-sanctioned 640px form-width declarations.

### Pillar 6: Experience Design (4/4)
- Both routes implement all five deliberate states: `page.tsx` resolves permission before data fetch and renders `RiskRegisterPermissionState`/`RiskRegisterInvalidFilterState` pre-fetch (`app/(app)/app/risks/page.tsx:18-21`); `RiskDetails` switches on `loading`/`permission`/`error`/`not-available`/ready (`risk-details.tsx:65-68`).
- Loading skeletons are delayed 300ms and match final geometry/density (`risk-details.tsx:110-115`, `data-table.tsx` `TableLoading`).
- Mutation feedback uses a polite `role="status" aria-live="polite"` live region, not toast-only (`risk-details.tsx:84`).
- Destructive mitigation removal uses `ConfirmDialog` with exact copy, waits for server success before removing, and keeps the dialog open with a retryable error on failure (`mitigation-control-list.tsx:88-101,123`).
- Released aggregates render zero mutation affordances structurally — `canEdit`/`mutable` gate every Edit/Add/Remove button and the released branch never mounts editor components (`risk-details.tsx:70-104`, `mitigation-control-list.tsx:81,86,105,123,128-129`).
- 409 conflict handling refreshes from one authoritative read and discards local editor state (`risk-details.tsx:53-63`), matching the "authoritative conflict refresh" pattern documented in the Plan 07 summary.
- Focus restoration to the Edit risk trigger after save/cancel is implemented via `requestAnimationFrame` (`risk-details.tsx:49-50,89`) and covered by component tests (`risk-details.test.tsx:156,168`).

---

## Files Audited

- `apps/web/src/features/risks/risk-register.tsx`
- `apps/web/src/features/risks/risk-register-filters.tsx`
- `apps/web/src/features/risks/risk-details.tsx`
- `apps/web/src/features/risks/risk-detail-editor.tsx`
- `apps/web/src/features/risks/mitigation-control-list.tsx`
- `apps/web/src/components/csrm/risk-rating-badge.tsx`
- `apps/web/src/components/csrm/data-table.tsx`
- `apps/web/src/components/csrm/detail-section.tsx`
- `apps/web/src/components/ui/card.tsx`, `table.tsx`, `badge.tsx`, `button.tsx`
- `apps/web/app/(app)/app/risks/page.tsx`
- `apps/web/src/features/risks/risk-details.test.tsx` (for copy/behavior evidence)
- `.planning/phases/05-risk-register-and-mitigation-management/05-UI-SPEC.md`
- `.planning/phases/05-risk-register-and-mitigation-management/05-01-SUMMARY.md` through `05-12-SUMMARY.md`
