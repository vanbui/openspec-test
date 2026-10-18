---
phase: 08-production-integration-and-hardening
plan: 09
subsystem: ui
tags: [wcag-2.5.3, label-in-name, radix-dialog, not-found, global-error, next-16-3, error-boundaries, print, media-print, page-header, data-table, playwright, vitest]

requires:
  - phase: 08-production-integration-and-hardening
    provides: the production-build browser harness that leaves the tree clean (08-02); the data-overflow scroll regions and end-edge cue that print must expand and remove (08-08)
provides:
  - the mobile navigation trigger named by its visible label, Menu, with aria-expanded, aria-haspopup and aria-controls exposed (D-26)
  - app/not-found.tsx (root, sign-in card frame, 404) and app/(app)/not-found.tsx (the same copy inside the shell) with the locked copy; app/global-error.tsx with its own document, stylesheet, fonts and title; app/fonts.ts shared by the root layout and the global error (D-21)
  - route-boundaries.test.ts, a static inventory that fails when a page has no error boundary, a shell page would fall outside the shell, or a boundary reads the error it receives
  - X-4 recorded in the direction document, one @media print block, data-print="hidden" markers, and PageHeader split into status (prints) and action (controls, does not print) (D-33)
  - the print proof in design-system-conformance.spec.ts at 794 and 718px
affects: [08-10 (hardening proofs; production error-handling record), 08-11 (journeys and the D-18 IDOR block now expect Page not found; the Menu locators are renamed), 08-12 (accessibility sweep; root fallbacks and the streamed not-found title), 08-14 (residual register; Google Fonts in the production build), Phase 8 UI review]

tech-stack:
  added: []
  patterns:
    - "A PageHeader takes status (badges, ratings: content, prints) and action (links, buttons: controls, wrapped in a display: contents element marked data-print=hidden); pass a status badge as status, never as action."
    - "Interaction-only controls carry data-print=\"hidden\"; the one @media print block in globals.css removes them with the shell. A control whose state is content (a filter chip label, a result count, Page x of y) stays unmarked."
    - "A notFound() under app/(app) renders app/(app)/not-found.tsx inside the shell; a URL no route matches renders app/not-found.tsx on the root card. A new not-found closer to a page must keep the locked copy or a record-specific equivalent."
    - "Print proofs run under page.emulateMedia({ media: 'print' }) and assert computed layout (no sticky, blurred or cued box, no vertical rule, wrapped cells, repeating headers); the A4 PDF shows what emulation cannot, such as a blurred header printing blank."

key-files:
  created:
    - apps/web/app/fonts.ts
    - apps/web/app/not-found.tsx
    - apps/web/app/(app)/not-found.tsx
    - apps/web/app/global-error.tsx
    - apps/web/src/lib/security/route-boundaries.test.ts
    - apps/web/src/lib/security/root-fallbacks.test.tsx
    - apps/web/src/components/csrm/page-header.test.tsx
  modified:
    - docs/design/csrm-design-direction.md
    - apps/web/app/layout.tsx
    - apps/web/app/globals.css
    - apps/web/src/components/shell/capability-navigation.tsx
    - apps/web/src/components/shell/mobile-navigation.test.tsx
    - apps/web/src/components/csrm/page-header.tsx
    - apps/web/src/components/csrm/data-table.tsx
    - apps/web/e2e/app-shell.spec.ts
    - apps/web/e2e/assessment-navigation-lifecycle.spec.ts
    - apps/web/e2e/design-system-conformance.spec.ts

key-decisions:
  - "A notFound() under the signed-in shell is governed by app/(app)/not-found.tsx. Next 16.3 passes each segment's not-found to the LayoutRouter of that segment's children, inside its layout (create-component-tree), and next-app-loader injects the built-in not-found at the first-layer route group only while no app/not-found exists. That injection is why the default 404 appeared inside the shell before this plan, and adding the root file would have moved every in-shell notFound() onto the root card, dropping the banner and navigation. The (app) file renders the root not-found's locked copy under a PageHeader, the page's only level-one heading, with no record data."
  - "PageHeader's action slot held status badges on nine pages and the Risk ratings on the Risk detail, so marking the whole slot data-print=hidden, as planned, would have removed a printed record's status. PageHeader now takes status (prints, a direct child as before) and action (controls, in a display: contents wrapper marked data-print=hidden, so the screen layout is unchanged)."
  - "The Risk Register cannot fit 794px at the screen type scale: its narrowest printed layout is 1101px, and still 882px with its long-text minimum released and cell padding halved, both new values X-4 rules out. Chromium's print path scales wider content onto the page, by about 1.5 times at most (measured), and the A4 sample shows all eight columns. The proof therefore asserts the report and the Risk detail fit the paper, and that the register is unclipped and no wider than itself."
  - "Two print defects were found only in the A4 PDF and fixed within X-4: the DataTable header's blurred backdrop printed the header row blank, and the sticky first column's hairline (the X-1 start-edge cue) printed as a vertical rule. The proof now fails on both (sensitivity runs recorded)."
  - "The new boundaries use retry (stable in Next 16.3); the global error renders its own html, head and body with a React title, and never reads error, digest or stack. Radix 1.1.15's Dialog.Trigger supplies aria-haspopup and aria-controls, so the trigger needed only its aria-label removed."

patterns-established:
  - "A page's status beside its title is PageHeader status; its controls are PageHeader action."
  - "A static inventory over app/ keeps every page inside an error boundary and every shell page inside the shell's own boundaries, and forbids a boundary from taking the error binding."

requirements-completed: [INT-04]

duration: about 70 min
completed: 2026-09-25
---

# Phase 08 Plan 09: The Menu label, safe fallbacks inside and outside the shell, and print Summary

**The mobile navigation trigger is now named by its visible label, `Menu`, and still exposes its expanded state and the sheet it controls. Fourteen test sites address it that way. A URL no route matches renders a branded `Page not found` card outside the shell with HTTP 404. A `notFound()` inside the shell renders the same locked copy inside the shell, under the page's only level-one heading, with no record data: the Secondary Requestor's direct URL to Jane's released assessment is proven at 1440 and 375. A root failure renders `Something went wrong` in its own document, with the stylesheet, fonts and title, and never shows what it received. A static inventory keeps every route inside an error boundary. Printing a page now drops the shell and the interaction-only controls. Tables print as tables with wrapped cells, labelled and repeating headers, and no sticky, blurred or cued box. Status badges and chart marks keep their tints. The full browser suite passed 54 of 54 on the production build.**

## Performance

- **Duration:** about 70 min
- **Started:** 2026-09-25T20:20:53Z
- **Completed:** 2026-09-25 (the metadata commit)
- **Tasks:** 3 of 3, plus the in-shell not-found the orchestrator added to scope. Tasks 1 and 2 ran test-first, and so did the PageHeader split in Task 3.
- **Files:** 37 across the code commits (8 created, 29 modified), plus this summary, STATE, ROADMAP and deferred-items.

## Accomplishments

- **X-4 recorded first (D-45).** `docs/design/csrm-design-direction.md` §4 gains `### Print` with the X-4 wording verbatim, headed `**Print (CSRM extension, 2026-09-25).**`, after `### Sign-in` and before `## 5. Motion system`. It was committed (`414ea8f`) before any component change.
- **Menu trigger (D-26, UI-D2).**
  - The `aria-label="Open navigation"` is gone, so the accessible name is the visible `Menu`.
  - `aria-expanded={open}` stays.
  - Radix 1.1.15's `Dialog.Trigger` supplies `aria-haspopup="dialog"` and `aria-controls`, which references the sheet content's id. Nothing was added by hand.
  - The close control keeps `Close navigation`.
  - While the modal sheet is open, Radix hides the rest of the page from the accessibility tree, so the trigger is out of the tree until the sheet closes. This is standard modal behaviour.
- **Root fallbacks (D-21, UI-SPEC §9.3).**
  - `app/not-found.tsx`, a server component, renders in the `.sign-in` card frame with the lockup, the `IdamBox CSRM` eyebrow, h1 `Page not found`, the lead, and a primary `Return to workspace` pill at the control height linking to `/app`. Its `metadata.title` is `Page not found | IdamBox CSRM`.
  - `app/global-error.tsx` starts with `'use client'` and imports `./globals.css` and `fontVariableClassName`. It renders `<html lang="en">` with the font classes, a `<head>` holding `<title>Something went wrong | IdamBox CSRM</title>`, and a `<body>` containing `GlobalErrorCard`, which is also exported for its test. The card shows h1 `Something went wrong`, the locked lead and a primary `Try again` that calls `retry`. The default export takes only `retry`.
  - `app/fonts.ts` holds the three `next/font/google` declarations and `fontVariableClassName`. `app/layout.tsx` imports it and declares no font itself.
- **In-shell not-found (orchestrator decision, 2026-09-26).** `app/(app)/not-found.tsx` renders `PageHeader` with title `Page not found`, the lead as its description, and a primary `Return to workspace` pill as its action. The same `metadata` title applies wherever Next renders it in not-found mode. "Which boundary governs" under Decisions explains why the file sits at the `(app)` group.
- **Boundary inventory.** `route-boundaries.test.ts` walks `app/`:
  - All 27 pages resolve to an `error.tsx` in their directory or an ancestor. The two root pages resolve to `app/global-error.tsx`, the only fallback for pages outside every segment boundary.
  - All 25 shell pages resolve to an `error.tsx` inside `app/(app)`, and to a `not-found.tsx` inside it. Twenty-three reach `(app)/not-found.tsx`; Risk detail and report detail keep their own.
  - The root fallbacks and the shell's not-found exist.
  - All 22 boundaries (21 `error.tsx` plus `global-error.tsx`) start with `'use client'` and never take the `error` binding in their default export. None reads `error.message`, `error.digest` or `error.stack`, with or without optional chaining, and none renders the error through `JSON.stringify(error`, `String(error` or `${error`.
  - A synthetic case proves the resolver reports a missing boundary, and a shell page that only the root would catch.
- **Print (D-33, X-4, UI-D11).**
  - `globals.css` gains one `@media print` block.
  - It hides `.skip-link`, `.sidebar`, `.header`, `.shell-footer`, `.mobile-trigger`, `.sheet-overlay` and `.sheet-content`. It also hides open overlays (`[role="dialog"]`, `[role="alertdialog"]`, `[data-radix-popper-content-wrapper]`), the toaster `[data-sonner-toaster]`, every `[data-print="hidden"]` and every `form[role="search"]`.
  - The shell becomes a block, and `.page` drops its width cap and padding. `html` and `body` print on `var(--surface)` with `overflow: visible`.
  - The DataTable prints its table layout at any paper width and never its cards. Every scroller expands, the end-edge fade and the start-edge hairline go, and sticky cells and the `thead` turn static.
  - The `thead` loses its backdrop filter, cells wrap, headers repeat as `table-header-group`, and rows, list items, cards and KPI tiles avoid breaking inside. Headings avoid a break after them.
  - Badges and chart marks keep their tints with `print-color-adjust: exact`, and links print no URL.
  - No px, rem or colour literal was added.

## Which not-found governs a `notFound()` under `app/(app)/app/**` (read from the installed Next 16.3.3)

- `dist/server/app-render/create-component-tree.js` passes a segment's `not-found` element as the `notFound` prop of the `LayoutRouter` for that segment's `children` slot. The boundary therefore renders inside that segment's layout, and a `notFound()` thrown in a page is caught by the nearest such boundary above it, or in its own directory (`not-found.md`: "wrapped by the error boundary from `error.js` in the same segment").
- `dist/build/webpack/loaders/next-app-loader/index.js` injects the built-in `not-found.js` at the root layer and at a first-layer route group whenever the layer defines none. For the group, it does so only while no `app/not-found` exists: `!(hasRootFallbackFile && isFirstLayerGroupRoute) && !hasLayerFallbackFile`.
- Before this plan, then, Next's default was injected at `(app)`, which is why the orchestrator saw "404 | This page could not be found." with an h1 `404` inside the shell. With `app/not-found.tsx` added, that injection stops, and without `app/(app)/not-found.tsx` a shell `notFound()` would have rendered the root card in place of the whole `(app)` layout, shell included.
- `app/(app)/not-found.tsx` therefore governs every page under the shell, except the two segments with their own (`risks/[documentId]` and `reports/[reportKey]`). The inventory asserts it.
- Unmatched URLs are served by the `/_not-found` route, composed of the root layout and the root `not-found.tsx`. `/app/this-route-does-not-exist` answers 404 with the root card, proven at 1440 and 375.

## Browser evidence (production build)

| Proof | 1440 | 375 | Other |
|---|---|---|---|
| Unmatched URL `/app/this-route-does-not-exist` | 404, one h1 `Page not found` in the card, title `Page not found \| IdamBox CSRM`, no banner, sidebar or navigation, axe clean (5 tags), no overflow | same | |
| In-shell `notFound()`, analyst on `/app/admin/not-a-collection` | one h1 `Page not found` in main, lead, `Return to workspace` → `/app`, banner role kept, title `Page not found \| IdamBox CSRM` (raised in `generateMetadata`), no framework 404 text, axe clean, no overflow | same | |
| Secondary Requestor's direct URL to Jane's released assessment | h1 `Page not found` in main, the only h1, banner `Secondary Requestor`, no lifecycle or originating-request section, none of `ASM-E2E-NAV-OWNER-001`, `RAR-E2E-NAV-OWNER-001`, the request title or the documentId in `body`, no overflow | same | HTTP 200 (streamed); the title stays `Released Risk Assessment \| IdamBox CSRM` (see open issues) |
| Menu trigger | hidden at 1440 | accessible name `Menu` (`- button "Menu"`), no `aria-label`, `aria-haspopup="dialog"`, `aria-expanded` `false` → `true`, `aria-controls` = the open sheet's id | |
| Print, Risk Register `?state=open` | | | At 794 and 718: no shell, no marked control or search form, table visible with its eight headers, no cards, `Risk state: Open` chip, `5 results`, `Page 1 of 1`; nothing sticky, blurred or cued, no vertical rule, every cell wraps, headers repeat, rows keep together, badges tinted; unclipped and no wider than itself (1101px) |
| Print, `/app/reports/risk-exposure` | | | At 794 and 718: every section table visible, fits the paper (794 / 718), chart marks tinted |
| Print, first Risk detail | | | At 794 and 718: Risk number and the header ratings print, fits the paper |

The A4 PDF samples (0.4in margins, backgrounds on) are in `apps/web/.tmp/audit/08-09/`: `risk-register-a4.pdf` and `risk-exposure-report-a4.pdf`. Print screenshots at 794 and 718, the fallback screenshots, `menu-open-375.png` and `findings.json` sit beside them.
- The register fits one page with all eight columns and their header labels.
- The report prints on two pages, with KPI tiles, tinted severity bars and all three tables.

## Task Commits

1. **Task 1: X-4, then the Menu trigger**
   - `414ea8f` docs(08-09): record the print pattern as a CSRM extension
   - `b595e92` test(08-09): address the mobile navigation trigger by its visible label (RED)
   - `1266ffd` feat(08-09): let the Menu trigger's visible label be its accessible name (GREEN)
2. **Task 2: Root fallbacks, the in-shell not-found and the inventory**
   - `30e6290` test(08-09): expect root fallbacks with safe copy and an error boundary on every route segment (RED)
   - `97ad3c6` feat(08-09): add root not-found and global error fallbacks with safe copy (GREEN, with the in-shell not-found and its browser proofs)
3. **Task 3: Print**
   - `ccb8f13` test(08-09): keep page header status in print and its controls out (RED)
   - `0e2d32a` feat(08-09): separate page header status from its controls so status prints (GREEN)
   - `941116e` feat(08-09): print application pages without the shell and with wrapped, static tables
   - `d6b9c56` fix(08-09): print the table header row and drop the start-edge rule
   - `ee21d52` test(08-09): prove the print layout in the browser

**Plan metadata:** the `docs(08-09): complete …` commit that carries this summary, STATE, ROADMAP and deferred-items.

## TDD Gate Compliance

Each test-first cycle has its `test(08-09)` RED commit before its `feat(08-09)` GREEN commit.

- **Menu (`b595e92` → `1266ffd`).** RED: 4 of 43 failed, each `Unable to find an accessible element with the role "button" and name "Menu"`. GREEN: 43 of 43.
- **Fallbacks (`30e6290` → `97ad3c6`).**
  - RED: `root-fallbacks.test.tsx` failed to load (`Failed to resolve import "../../../app/(app)/not-found"`), and the inventory failed 27 of 77.
  - The inventory failures were the missing root fallbacks, the two root pages with no boundary, the 23 shell pages with no shell not-found, and the missing global-error source.
  - The inventory's own 50 passes include the synthetic resolver case, which asserts the resolver itself and so passes in RED by design.
  - GREEN: 87 of 87.
- **PageHeader (`ccb8f13` → `0e2d32a`).** RED: 2 of 2 failed, with no print marker on the control and no rendered status. GREEN: 2 of 2, with the six existing `.page-header > [data-slot="badge"]` selectors still passing.

## Assertions changed deliberately, and why

**Unit (vitest)**

| File | Change | Reason |
|---|---|---|
| `mobile-navigation.test.tsx:233, 308, 377, 414` | `{ name: 'Open navigation' }` → `{ name: 'Menu' }` | D-26: the name is the visible label |
| `mobile-navigation.test.tsx` focus-return test | Adds: no button named `/open navigation/i`, no `aria-label`, text `Menu`, `aria-haspopup="dialog"`, `aria-expanded` false then true then false, and `aria-controls` equal to the open sheet's non-empty id | UI-SPEC §2 state contract |
| `route-boundaries.test.ts` (between RED and GREEN) | The forbidden-read patterns widened to cover optional chaining and `${error`, and the test title names `error.message`, `error.digest`, `error.stack` | Stronger than the RED's plain regexes; the acceptance grep for `error.message` |

**Browser (Playwright)**

| Spec | Change | Reason |
|---|---|---|
| `app-shell.spec.ts:28, 50`; `administration-workflow.spec.ts:67`; `analyst-insights.spec.ts:284`; `assessment-release-workflow.spec.ts:116`; `questionnaire-generation-workflow.spec.ts:72`; `questionnaire-workflow.spec.ts:175`; `requestor-request-workflow.spec.ts:144, 284` | `{ name: 'Open navigation' }` → `{ name: 'Menu', exact: true }` | D-26; `exact` because Playwright otherwise matches a case-insensitive substring |
| `app-shell.spec.ts` `signInAsSecurityAnalyst` | `toHaveURL(/\/app$/)` and `main` visible → the level-one `Dashboard` heading and `Security Analyst` in the banner | D-15 |
| `assessment-navigation-lifecycle.spec.ts:143` | `getByText('This page could not be found.')` → a loop at 1440 and 375: main's h1 `Page not found` is the page's only h1, with the lead, `Return to workspace` → `/app`, the banner role kept, the two absent sections, no owner fact in `body` and no overflow | The in-shell not-found decision |
| `assessment-release-workflow.spec.ts:254` | heading `This page could not be found.` → main's level-one `Page not found` | The framework default is no longer rendered |
| `questionnaire-governance-workflow.spec.ts:58` | the refusal pattern's `could not be found` → `Page not found` | Same |

Added:
- the two fallback tests in `app-shell.spec.ts` (`:77` the unmatched URL, `:97` the in-shell `notFound()`, each at 1440 and 375 with axe);
- the print test in `design-system-conformance.spec.ts`;
- `route-boundaries.test.ts`, `root-fallbacks.test.tsx` and `page-header.test.tsx`.

Nothing was loosened.

## `data-print="hidden"` sites

- `components/csrm/page-header.tsx`: the `action` wrapper (`display: contents`); `status` is not marked.
- `components/csrm/data-table.tsx`: each chip's remove button, `Clear filters`, the density toggle, the `Rows per page` label with its select, `Previous page` and `Next page`. The chip labels, `{n} results` and `Page {x} of {y}` still print.
- The seven list filter rows:
  - `requests/request-table.tsx` (search and status);
  - `questionnaires/questionnaire-list.tsx`;
  - `questionnaires/questionnaire-review-list.tsx`;
  - `assessments/released-assessment.tsx`;
  - `assessments/assessment-list.tsx` (the filter row both analyst review lists share);
  - `alerts/alert-list.tsx` (`AlertFilters`);
  - `risks/risk-register-filters.tsx` (the root, with `More filters` and `Filters (n)`).

## Files Created/Modified

- **Direction:** `docs/design/csrm-design-direction.md` (X-4).
- **Fallbacks:** `apps/web/app/fonts.ts`, `not-found.tsx`, `(app)/not-found.tsx` and `global-error.tsx` (new); `layout.tsx`.
- **Shell:** `apps/web/src/components/shell/capability-navigation.tsx`.
- **Print:**
  - `apps/web/app/globals.css`;
  - `src/components/csrm/page-header.tsx` and `data-table.tsx`;
  - the seven filter rows above;
  - the nine `status` call sites: `assessments/assessment-detail.tsx`, `assessment-editor.tsx` and `released-assessment.tsx`; `questionnaires/questionnaire-detail.tsx` and `questionnaire-review.tsx` (three headers); `risks/risk-details.tsx`; `app/(app)/app/requests/[documentId]/page.tsx`.
- **Tests:**
  - new: `src/lib/security/route-boundaries.test.ts`, `root-fallbacks.test.tsx`, `src/components/csrm/page-header.test.tsx`;
  - changed: `src/components/shell/mobile-navigation.test.tsx`;
  - specs: `e2e/app-shell.spec.ts`, `assessment-navigation-lifecycle.spec.ts`, `assessment-release-workflow.spec.ts`, `questionnaire-governance-workflow.spec.ts`, `administration-workflow.spec.ts`, `analyst-insights.spec.ts`, `questionnaire-generation-workflow.spec.ts`, `questionnaire-workflow.spec.ts`, `requestor-request-workflow.spec.ts`, `design-system-conformance.spec.ts`.

## Decisions Made

See `key-decisions` above.

- The shell has its own not-found, and it is the boundary that governs.
- PageHeader separates `status` from `action`.
- The register's print proof is that it is unclipped and no wider than itself.
- Two print defects were fixed.
- The new boundaries use `retry`, and Radix supplies the trigger's state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Hiding PageHeader's whole action slot would have stopped a record's status from printing**
- **Found during:** Task 3, while reading every `PageHeader` call site before adding the marker.
- **Issue:** The plan said to wrap `{action}` in `<div data-print="hidden">`. But nine headers pass a `StatusBadge` as their action, and the Risk detail passes its ratings and status. A printed request, questionnaire, Risk Assessment or Risk would then lose its status. That contradicts UI-SPEC §8 ("badges … print as rendered") and T-08-09-02 ("hidden chrome must not hide content that carries meaning").
- **Also:** A plain wrapper div would have broken six unit selectors (`.page-header > [data-slot="badge"]`). It would also have changed the header's flex layout on screen: the Administration action group is `w-full` below `sm` and relies on being the header's flex item.
- **Fix:**
  - `PageHeader` takes `status` (a direct child as before, prints) and `action` (controls, in `<div className="contents" data-print="hidden">`).
  - The nine call sites move from `action` to `status`.
  - `page-header.test.tsx` is written test-first.
- **Files:** `page-header.tsx`, `page-header.test.tsx` and the nine call sites (8 files).
- **Commits:** `ccb8f13`, `0e2d32a`.

**2. [Rule 1 - Bug] The printed table header row was blank**
- **Found during:** Task 3, in the A4 PDF. Print emulation cannot show it: the computed style is visible.
- **Issue:** The DataTable `thead` carries `backdrop-blur-sm`. Chromium prints an element behind a blurred backdrop blank, so a printed register had no column labels.
- **Fix:** In print, `main thead { -webkit-backdrop-filter: none; backdrop-filter: none; }`.
- **Verification:**
  - A PDF pair of the same page: blank with the filter, all eight labels without it.
  - The proof asserts no blurred box inside `main`.
  - A sensitivity run without the rule fails with `prints nothing behind a blurred backdrop`, having received `["thead table-header Table header"]`.
- **Commits:** `d6b9c56`; proof `ee21d52`.

**3. [Rule 1 - Bug] The start-edge scroll cue printed as a vertical rule**
- **Found during:** Task 3, in the A4 PDF.
- **Issue:** The sticky first column's `border-r` hairline (X-1) printed down the whole table, although the region had expanded. The direction document says "no vertical rules", and UI-SPEC §8 says the edge cue is removed.
- **Fix:** In print, `[data-overflow] [class*="sticky"] { border-right-width: 0; }`.
- **Verification:** A sensitivity run without the rule fails with `draws no vertical rule in a table`, listing the header and the five first-column cells.
- **Commit:** `d6b9c56`.

### Plan-text deviations

**4. [Infeasible check] The register cannot print narrower than 794px at the screen type scale.**
- **Measured in print emulation:**
  - 1101px at both 794 and 718;
  - 1010px with the long-text minimum released;
  - 882px with half the cell padding as well.
- The floor comes from the mono uppercase sortable headers with their sort icons and the non-wrapping badges. The last two changes would be new values, which X-4 rules out.
- **Real printing:** a standalone probe showed that Chromium's print path scales wider content onto the page by about 1.5 times at most. On A4 with 0.4in margins, a 900px bar fits and a 1100px bar is cut by a few characters. The register's A4 PDF shows all eight columns on the page.
- **What the proof asserts instead:**
  - the report and the Risk detail satisfy the plan's `scrollWidth <= viewport`;
  - for the register: no ancestor inside `main` clips it, every cell wraps, and nothing else is wider than the table.
- Headroom is thin: see open issues.

**5. [Scope addition, orchestrator decision 2026-09-26] In-shell not-found.** `app/(app)/not-found.tsx`, its render tests, the inventory assertion that every shell page resolves to a shell not-found, the in-shell browser test in `app-shell.spec.ts`, and the Secondary Requestor proof at both widths in `assessment-navigation-lifecycle.spec.ts`. It also changed the three browser assertions of the framework's default 404 text.

**6. [Plan text] Print widths.** The proof runs at 718 as well as the plan's 794. At 718 Tailwind's `md` utilities are off, so the rules that print the table layout regardless of paper width are exercised, and 718 is the A4 width inside the browser's default margins.

**7. [Plan text vs grep] `Open navigation` absence.**
- The plan's behaviour line asserts that `Open navigation` finds nothing, while its verification requires the string to appear nowhere.
- The test uses `/open navigation/i`, which is stronger, and the grep stays at zero. 08-08 set this precedent with `Search collection`.

**8. [Plan text] Boundary counts and line numbers.**
- There are 21 `error.tsx` files (20 under `app/(app)/app` plus `app/(app)/error.tsx`), not the 26 plus 1 in the plan's interface block.
- The `Open navigation` sites had drifted: administration `:67`, analyst-insights `:284`, requestor `:284`.

**9. [Plan text] Inventory rules beyond the plan.**
- A shell page must resolve to boundaries inside `app/(app)`.
- `app/global-error.tsx` counts only at the root.
- A default-exported boundary must not take the `error` binding.
- The synthetic resolver case guards against a vacuous pass.

**10. [Windows host] Command translations from the preamble.**
- Node 24 from `/c/ProgramData/nvm/v24.19.0`, with no `PLAYWRIGHT_BROWSERS_PATH`.
- Ports checked with `Get-NetTCPConnection`, free before every run.
- Logs in `apps/web/.tmp/logs/csrm-phase-08/`.

**Total deviations:** 3 auto-fixed (1 Rule 2, 2 Rule 1) and 7 recorded. **Impact:** there is no change to any schema, contract, grant, Strapi file, `CSRM_AI_*` setting or Keycloak setting, and no new dependency. The PageHeader API gains one optional prop.

## Issues Encountered

- **Google Fonts transient in the production build.** The first isolated print run (`08-09-print-run1.log`) failed before any test: `next build` stopped with `Turbopack build failed with 12 errors … next/font/google queries have exactly one entry`, in `plus_jakarta_sans…module.css`. This is the `l/font?kit=…&skey=…` response recorded in `deferred-items.md` (08-07 Task 4). This time it hit the production build, not the conformance spec's `next dev` server. Minutes later Google returned `/s/…woff2` to Next's user agent (three samples), and the isolated rerun built and ran. No harness change was made.
- **The first print run proper failed on the fit check,** with the Risk Register at 1101px against 794. The measurements and PDFs above led to deviations 2 to 4.
- **The 08-02 deferred item "The destination stream closed early."** The production server logged it 9 times in the full run. It is Next's server-side record of a stream abandoned by a navigation, carrying a digest. It reaches no boundary and no browser, and the new boundaries do not change it. It is left for 08-10's production error-handling record.

## Verification

| Command | Result |
|---|---|
| `pnpm --filter @csrm/web test` (final tree) | **78 files, 1055 tests passed** (17.1 s); 966 before the plan plus 89: 78 inventory cases (52 of them per page), 9 fallback renders, 2 PageHeader cases |
| `pnpm --filter @csrm/web typecheck` | exit 0 |
| `pnpm --prefix apps/web api:check` | exit 0, no drift |
| Targeted Playwright after Tasks 1 and 2 (`app-shell`, `assessment-navigation-lifecycle`, `assessment-release-workflow`, `questionnaire-governance-workflow`) | **14 passed**, 0 failed (1.3 min, 79 s wall) |
| Print proof alone, runs 1 to 3 | run 1: the build failed on the Google Fonts transient; run 2: 1 failed (the register fit check, 1101 > 794); run 3, after the fixes: 1 passed (41.5 s) |
| Sensitivity: print proof without the backdrop rule / without the hairline rule | each 1 failed as intended (messages above); `globals.css` restored byte-identical (`cmp`) after each |
| **Full Playwright suite** (`pnpm --filter @csrm/web test:e2e`, production build, final committed tree) | **54 passed / 0 failed / 0 flaky**, no retries; 6.5 min reported, 394 s wall; 51 before the plan plus 3 |
| `git status --porcelain` before and after the full run | empty and empty |
| **`pnpm --filter @csrm/strapi test`** | **504 passed / 0 failed / 0 skipped** (506.4 s, 511 s wall); unchanged count, as no Strapi file changed |
| `grep -rn "Open navigation" apps/web/src apps/web/e2e` | nothing |
| Freeze diff since `5a9420d` (`apps/strapi`, `docs/references`, `.env*`); `CSRM_AI_` or Keycloak lines | empty; 0 |
| Tool attribution in this plan's commits and added lines | none |
| Acceptance criteria of all three tasks, plus the plan greps, re-run on the final tree | 49 checks, 0 failed |

## Known Stubs

None.

## Threat Flags

None. No endpoint, grant, data path or trust boundary was added. Each mitigation holds:
- **T-08-09-01:** the fallbacks show locked copy only, and the inventory forbids reading error internals. The global error's static markup is asserted to contain neither the message, the digest nor the first stack frame.
- **T-08-09-02:** chip labels, `{n} results` and `Page x of y` print, and the print proof asserts each on the register. The two analyst review lists are a residual: see open issues.
- **T-08-09-03:** there is no `aria-label`, and the unit and browser tests address `Menu`. Plan 08-12 enables axe's `label-content-name-mismatch`.
- **T-08-09-04:** the inventory runs in every web suite.

## Open issues for the orchestrator (also in `deferred-items.md`)

1. **The analyst review lists print without their filter context.**
   - `Assessment request review` and `Risk assessment review` (`assessment-list.tsx`) render their DataTable without chips. Their search, status and queue exist only in the controls, which X-4 now hides in print.
   - A printed, filtered analyst queue therefore does not say which queue or filter it shows, which is the T-08-09-02 residual.
   - Recommendation: give both lists the direction §4 DataTable chip row. That means scoping the two unscoped `Clear filters` assertions in `assessment-navigation-lifecycle.spec.ts:207, 222`.
   - It is a screen change on two analyst surfaces, so it was not made here.
2. **The Risk Register's print headroom is thin.**
   - Its narrowest layout (1101px in emulation) is about 1.5 times the A4 printable width (718px). That is about the most Chromium's print path scales: a synthetic 1100px bar was cut by a few characters, yet the register's A4 PDF fits.
   - The margin is therefore a few pixels, and a row with longer identifiers or wider badges could push the last column (`Related assessment`) past the page.
   - Statements also print clamped to two lines.
   - Options, each an X-4 refinement to record first: in print, release the long-text minimum and clamp (1010px, with the full statement printed); print the register landscape (`@page`); or accept.
3. **The streamed in-shell not-found keeps its route's document title.**
   - On the Secondary Requestor's direct URL the page raises `notFound()` after streaming has started. It answers HTTP 200 (Next's documented soft 404, with `noindex`) and keeps the page's static title, `Released Risk Assessment | IdamBox CSRM`.
   - The title is static per route, so it reveals nothing about the record, but WCAG 2.4.2 prefers `Page not found | IdamBox CSRM`.
   - A `notFound()` raised before streaming, or in `generateMetadata`, does get that title, as the admin case proves.
   - Owner: 08-12 (Page Titled sweep).
4. **Plan 08-11 text is stale.** Its D-18 block expects `This page could not be found.` on Maya's assessment URL, and the questionnaire refusal pattern names `could not be found`. The product now renders `Page not found`, which this plan already asserts at both widths.
5. **Google Fonts can now take the production build down, not only the conformance spec's `next dev` server.** This strengthens the 08-14 residual (self-host the families, or mock them for the E2E servers).

## Browser backstops for the orchestrator

Sign in as Security Analyst unless another role is stated.

1. **Menu trigger at 375.**
   - A screen reader or the accessibility tree announces `Menu, button, collapsed`, with `aria-haspopup` dialog.
   - Enter opens `Navigation`, and the trigger reads expanded, with `aria-controls` equal to the sheet's id.
   - `Close navigation` and Escape return focus to `Menu`.
2. **Root not-found.**
   - `/app/this-route-does-not-exist` at 1440 and 375 shows the card with the lockup, `IdamBox CSRM`, `Page not found`, the lead and a full-width `Return to workspace`.
   - The tab title is `Page not found | IdamBox CSRM`, with no banner or sidebar, and the network panel shows 404.
3. **In-shell not-found.**
   - As Secondary Requestor, open Jane's released assessment URL (sign in as Requestor, open `ASM-E2E-NAV-OWNER-001`, copy the URL).
   - The shell stays, main shows `Page not found`, and the header action is `Return to workspace`. Nothing names the assessment, and the tab title is the item in open issue 3.
   - As the analyst, `/app/admin/not-a-collection` shows the same copy in the shell, titled `Page not found | IdamBox CSRM`.
4. **Global error.** Not reachable without breaking the root layout. `GlobalErrorCard` is proven in unit tests, and its markup never contains the message, digest or stack. To eyeball it, throw temporarily in `app/layout.tsx` on a scratch branch.
5. **Print preview at A4** (Ctrl+P, default margins).
   - `/app/risks?state=open`: no sidebar, header, filters, density toggle or pager. The chip `Risk state: Open`, `5 results` and `Page 1 of 1` print. The table has its eight header labels, no vertical rule after `Risk number`, tinted rating and status badges, and all eight columns on the page.
   - `/app/reports/risk-exposure`: two pages, KPI tiles, tinted bars and all three tables, with no period control on this report and no scroll cue.
   - A Risk detail prints its number and ratings.
   - Samples: `apps/web/.tmp/audit/08-09/*.pdf`.
6. **Print of an analyst queue** (`/app/review/requests?queue=released`): confirm what open issue 1 describes.

## Next Phase Readiness

- `REQUIREMENTS.md` is unchanged, as in 08-01 to 08-08. INT-04 closes at the phase gate (08-14).
- **08-10 can start.** Its file list (`proxy.ts`, the CSP module and tests, `next.config.ts`, the output-safety tests, `e2e/helpers/csp.ts`, `production-hardening.spec.ts`, `docs/security/web-headers.md`) touches nothing this plan changed. Its new tests join `src/lib/security/`, which this plan created. The unmatched-URL 404 test in `app-shell.spec.ts` will run under its proxy.
- **08-11:**
  - The `Menu` locators are renamed everywhere.
  - `assessment-navigation-lifecycle.spec.ts` already proves Maya's assessment URL at 1440 and 375 with an in-spec loop, which the project split can collapse.
  - The D-18 text should read `Page not found` (open issue 4).
- **08-12:** the root fallbacks and the in-shell not-found are axe-clean at both widths (in `app-shell.spec.ts`). Open issue 3 belongs to its Page Titled pass.

## Self-Check: PASSED

- Created files exist: `apps/web/app/fonts.ts`, `apps/web/app/not-found.tsx`, `apps/web/app/(app)/not-found.tsx`, `apps/web/app/global-error.tsx`, `apps/web/src/lib/security/route-boundaries.test.ts`, `apps/web/src/lib/security/root-fallbacks.test.tsx`, `apps/web/src/components/csrm/page-header.test.tsx`.
- The ten plan commits are on `dev`: `414ea8f`, `b595e92`, `1266ffd`, `30e6290`, `97ad3c6`, `ccb8f13`, `0e2d32a`, `941116e`, `d6b9c56`, `ee21d52`.
- The acceptance criteria and plan greps were re-run on the final tree: 49 of 49.
- Neither this plan's commits nor this summary carry tool attribution or a trailer.

---
*Phase: 08-production-integration-and-hardening*
*Completed: 2026-09-25*
