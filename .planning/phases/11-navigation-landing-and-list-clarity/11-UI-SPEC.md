---
phase: "11"
slug: "navigation-landing-and-list-clarity"
status: approved
shadcn_initialized: true
preset: "new-york / neutral / CSS variables / lucide"
created: "2026-09-28"
reviewed_at: "2026-09-28"
---

# Phase 11 — UI Design Contract

> Visual and interaction contract for the sectioned sidebar and phone drawer (D-06 to D-14), the header search control and quick find (D-15, D-47 to D-53), one Home per actor at `/app` (D-16 to D-25), the next action that names who holds the work and the phone lifecycle stepper (D-26 to D-28), the triage columns of the review and My lists (D-29 to D-34), figures that open their records (D-35 to D-39), exposure scope (D-40 to D-45), the "Released" request label (D-46), and the copy and local-time items Phase 10 deferred here (D-54, D-55). It introduces no colour, type size, weight, family, radius, shadow, spacing step or duration of its own. Five patterns the direction does not yet name are proposed as CSRM extensions X-6 to X-10.

---

## Binding inputs and value authority

- **Locked decisions.** D-01 to D-58 in `11-CONTEXT.md` govern this contract. It fixes every string the context leaves to the UI-SPEC (D-09, D-10, D-25, D-27, D-30, D-42, D-44, D-47, D-53) and the layout and behaviour of every interface decision. Where a decision leaves a choice open, this contract makes it and records the reason under "Decisions recorded" (UI-D1 to UI-D43).
- **Value authority.** `docs/design/csrm-design-direction.md`, adopted by `docs/adr/0001-adopt-bproton-design-system.md`, is the only value-bearing authority. This file names semantic tokens and cites the direction by section (§). It restates no colour, size, radius, shadow or duration. Spacing steps are named only where a new layout needs one, and each is a §3.9 step.
- **Extensions.** Phase 10's X-1 to X-5 (save status, record picker, dates and times, separators, in-place edit form) are recorded in the direction by plan 10-01 before any Phase 11 plan runs (D-04). This contract reuses X-3 and X-4. Patterns the direction does not define are listed under "Proposed CSRM extensions" (X-6 to X-10) with the exact wording to record. A plan task records each accepted extension in the direction before the implementing task runs.
- **Requirements.** UX-07, UX-08, UX-09, UX-10 and DASH-03. Acceptance bar: ROADMAP Phase 11 success criteria 1 to 6.
- **Findings closed.** UAT-001, UAT-002, UAT-003, UAT-004, UAT-035, UAT-038, UAT-048, UAT-060 and UAT-065 (evidence `a1-analyst-landing-dashboard.jpg`, `a1-requestor-dashboard-375.jpg`).
- **Delegated decisions.** #11 (exposure counts released Risks, under assessment apart, accepted marked), #16 ("Released" for display), G-1 (the analyst's own requests sit apart), G-4 (the premium bar, §13), G-5 (quick find), G-6 (a Playwright run leaves the tree clean).
- **Domain vocabulary** is the JDL's: Assessment Request, Questionnaire, Risk Assessment, Risk, Risk Type, Control, Control Implementation (shown as "mitigation control"), Information System, Information Asset, Security Analyst, Requestor. `CsrmTreatmentAction` values display verbatim (`Accept`, `Treat`). No competing entity is introduced; "holder", "stage" and "accepted" are presentations of existing facts (D-01, D-20, D-40, D-41).
- **Builds on Phase 10** (D-04). Phase 10 writes permission and recovery copy that names pages by today's headings (`Go to My Requests`, `Your workspace shows the work you can open.`, `Return to workspace`). This contract supersedes those strings in §2.3 and §2.4, so no Phase 10 plan changes; the Phase 11 plan that renames a heading changes them.
- **Carried items** (the orchestrator's phase seeds): the zod client boundary extended to every route, with the incidental zod imports moved out of client modules (§ Notes carried); the sidebar's prefetch cost (§1.7); the E2E sign-in helpers asserting the level-one `Home` heading after plan 11-02 (§14.1 E1); the Phase 10 UI-SPEC §17.2 file correction, whose right file (`apps/csrm/app/(app)/app/risks/page.tsx:13`) this contract uses in §11.1.

### Decision coverage

| Decisions | Where this contract honours them |
|---|---|
| D-01 to D-03 (no schema change; the six API groups; `GET /v1/my_requests` served) | The UI reads only the planned fields and filters: §5.2, §6.1, §7, §8.2, §9. The endpoint chain itself has no UI |
| D-04 (Phase 10 first) | Binding inputs; §1.5, §2.3, §2.4, §6.2, §11.3 |
| D-05 (serialised plans) | §14's plan column follows the research grouping; ownership per wave is the planner's |
| D-06 to D-08 | §1.1, §1.2, §1.4 |
| D-09 | §2.1, §2.2 |
| D-10, D-11 | §1.3 |
| D-12, D-13, D-14 | §1.4 and §1.6; §1.1 (seams); §1.5 |
| D-15 | §3 |
| D-16, D-17 | §5.1 |
| D-18 | §5.3 |
| D-19 to D-22, D-24 | §5.1, §5.2 |
| D-23 | §5.4 |
| D-25 | §2.4 |
| D-26 to D-28 | §6 |
| D-29, D-30 | §7.1 |
| D-31 | §7.2 |
| D-32 | §7.4 |
| D-33 (no column chooser) | §7 |
| D-34 | §7.3 |
| D-35 to D-39 | §8 |
| D-40 to D-44 | §9 |
| D-45 (the accepted seed Risk) | §9.5, Verification contract |
| D-46 | §10 |
| D-47 to D-53 | §3, §4 |
| D-54 | §11.1, §11.2 |
| D-55 | §11.3 |
| D-56 to D-58 | §14, Verification contract |

---

## Design system

| Property | Value |
|----------|-------|
| Tool | shadcn/ui, source-owned local components (`apps/csrm/components.json`: style `new-york`, RSC, CSS variables, neutral base, `iconLibrary: lucide`) |
| Preset | new-york; neutral base; CSS variables; RSC; Lucide icons |
| Component library | Radix primitives through the installed `radix-ui` package (1.6.7), composed by the local shadcn/ui components; `cmdk` 1.1.1 under the source-owned `Command` |
| Icon library | `lucide-react` 1.30.0, per §4 Iconography |
| Font | Plus Jakarta Sans for UI text, data and numbers; Instrument Serif for page titles only; IBM Plex Mono for micro-labels and machine identifiers (§3.10, ADR 0001 gap 8) |
| Tokens | Semantic tokens in `apps/csrm/app/globals.css`, whose values are the direction's; feature code consumes the mapped utilities only |
| New dependencies | None. Quick find composes the installed `Dialog` and `Command` (cmdk 1.1.1, MIT); the sidebar and Homes compose existing primitives |

---

## Component inventory

### Source-owned shadcn/ui components

Enumerated by `ls apps/csrm/src/components/ui/*.tsx | grep -v '\.test\.tsx$' | wc -l` — 30 components — radix-ui@1.6.7 (shadcn/ui new-york, source-owned; version from `node -p "require('radix-ui/package.json').version"` in `apps/csrm`) — 2026-09-28.

A non-exhaustive list of the known-good components this phase uses, never a closed allowlist. The full set is `alert-dialog`, `alert`, `avatar`, `badge`, `breadcrumb`, `button`, `calendar`, `card`, `checkbox`, `command`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `pagination`, `popover`, `progress`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea` and `tooltip`.

| Component | Import path | Phase 11 use |
|---|---|---|
| `Command`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`, `CommandEmpty` | `@/components/ui/command` | Quick find (§4), with `shouldFilter={false}`, `vimBindings={false}` and the list height of X-8. `CommandDialog` is not used: it renders its title outside the dialog content (research Pitfall 16) |
| `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription` | `@/components/ui/dialog` | The quick-find dialog, with its title inside the content and `showCloseButton={false}` (§4.1) |
| `Button` | `@/components/ui/button` | The header search control, the stepper disclosure, the section toggle and the quick-find Clear and Close controls |
| `Card`, `Skeleton`, `Progress`, `Badge`, `Table`, `Popover`, `Sheet`, `Input` | `@/components/ui/*` | Unchanged uses: Home sections, skeletons, questionnaire progress, list filters |

### CSRM shared primitives

Enumerated by `ls apps/csrm/src/components/csrm/*.tsx apps/csrm/src/components/csrm/*.ts | grep -v '\.test\.' | wc -l` — 15 modules — @csrm/web@0.1.0 (source-owned) — 2026-09-28.

A non-exhaustive list; the executor may use any exported primitive.

| Primitive | Path | Phase 11 change |
|---|---|---|
| `DataTable` | `components/csrm/data-table.tsx` | Reused for every list (06.6 D-02: extended, never forked). Gains no prop; the lists pass new columns, cards, sorting and chips |
| `KpiTile`, `KpiTileStrip`, `KpiTileSkeleton` | `components/csrm/kpi-tile.tsx` | Reused; the strips' column rules change (§5.3, §9.3) |
| `BarChart` | `components/csrm/bar-chart.tsx` | The `labelled-values` form gains an optional secondary link per row, rendered after the row link inside the same list item (§9.2) |
| `StatusBadge`, `statusPresentation`, `statusLabel` | `components/csrm/status-badge.tsx` | The request family's `approved` label becomes `Released` (§10) |
| `RiskRatingBadge` | `components/csrm/risk-rating-badge.tsx` | Highest residual rating column, Home rating chips, quick-find Risk lines (text only there) |
| `RecordLink` | `components/csrm/record-link.tsx` | Unchanged treatment; the figure links of X-10 reuse it |
| `PageHeader` | `components/csrm/page-header.tsx` | Unchanged; new titles and descriptions (§2) |
| `PermissionDeniedState`, `ErrorState`, `EmptyState`, `LoadingState` | `components/states/states.tsx` | Default copy loses "workspace" (§2.4) |
| `RetryableErrorState` | `components/states/retryable-error-state.tsx` | Unchanged; Home widget errors |
| Phase 10 `LocalInstant`, `formatInstant` | `components/csrm/local-time.tsx`, `lib/time/format-instant.ts` | Every instant of §11.3 |
| Phase 10 navigation guard (`GuardedLink`, `useNavigationGuard`) | `components/csrm/navigation-guard.tsx` | Every sidebar link, the primary action, the wordmark; gains a programmatic entry point for quick find (D-51, §4.6) |
| `ReportTable` | `features/reports/report-table.tsx` | Cells and row headers gain optional hrefs and accessible names (§8, X-10) |
| **New:** navigation profile data | recommended `config/navigation/navigation.ts` (profiles, sections, items, `activeNavigationHref`) and `config/navigation/page-headings.ts` (one heading string per page, read by the nav label, the page header and the route title) | §1, §2 |
| **New:** navigation counts | recommended `components/shell/navigation-counts.ts` (`server-only`) and a badge rendered inside `capability-navigation.tsx` | §1.3 |
| **New:** header search control | recommended `components/shell/quick-find-trigger.tsx` (`'use client'`) | §3 |
| **New:** quick find | recommended `features/quick-find/` (`quick-find-actions.ts` `'use server'`, `quick-find-dialog.tsx` `'use client'`, `quick-find-domain.ts` zod-free) | §4 |
| **New:** Home variants | recommended `features/home/` (`requestor-home.tsx`, `analyst-home.tsx` wrapping `features/analyst-dashboard`, `home-page-header.tsx`, `own-requests-panel.tsx`) | §5 |
| **New:** Home section frame | the analyst dashboard's `DashboardWidget` frame, moved to a shared module so both Homes render it | §5.2 |

Names and paths of new modules are the planner's (CONTEXT, Planner's Discretion). Zod stays out of every new client module (§ Notes carried).

---

## Token names used in this contract

Naming only; every value lives in the direction.

| Direction token | Utility or class in the shipped code |
|---|---|
| `--color-bg-page` / `--color-bg-surface` / `--color-bg-inset` / `--color-bg-hover` | `bg-background` / `bg-surface` (`bg-card`) / `bg-surface-muted` (`bg-muted`) / `bg-surface-hover` |
| `--color-text-primary` / `--color-text-secondary` / `--color-text-muted` | `text-foreground` / `text-foreground-secondary` / `text-muted-foreground` |
| `--color-border-default` / `--color-border-strong` | `border-border` / `border-border-strong`, `border-input` |
| `--color-bg-sidebar` / `--color-bg-sidebar-active` | `bg-sidebar` (`.sidebar`, `.sheet-content`) / `var(--sidebar-active)` (`.nav-link:hover`, `[aria-current="page"]`) |
| `--color-text-inverse` / `--color-text-inverse-muted` | `text-sidebar-foreground` / `text-sidebar-muted` |
| `--color-border-on-dark` / `--color-border-on-dark-strong` | `border-sidebar-border` / `border-line-on-dark-strong` |
| `--focus-ring` / `--focus-ring-inverse` | global `:focus-visible` outline / `.sidebar :focus-visible`, `.sheet-content :focus-visible` |
| `--shadow-button-light` / `--shadow-button-light-hover` / `--shadow-overlay` | `shadow-button-light` / `shadow-button-light-hover` / `shadow-overlay` |
| `--color-primary` / `--color-text-link` / `--text-link-decoration` | `Button` default variant / `.record-link` |
| `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-2xl` / `--radius-full` | badges, `kbd` / nav items, fields / cards, popovers / dialogs / buttons, tags |
| `--text-micro` / `--text-caption` / `--text-body` / `--text-button` / `--text-heading-sm` | `.micro-label` / `text-xs` / `text-sm` / `text-button` / `text-heading-sm` |
| `--spacing-header-h-sm` / `--spacing-header-h-md` | `.header` heights below and from 768px |
| `--duration-*`, `--ease-*` | §3.11 utilities, per §5 |

---

## Voice, formats and shared copy rules

These apply to every string in this contract.

- **Voice** (§2 BProton "Voice"): Australian English, sentence case for headings, labels, buttons and links, a spaced hyphen ( - ) instead of an em dash in prose, and verb-first calls to action of two to three words. Contractions use the typographic apostrophe (’); quoted user text uses typographic quotes (“ ”).
- **Separators** (X-4): a spaced middle dot ( · ) joins an identifier to a name or a second fact (`RAR-2026-5WWFVQ · UAT-A: Brightwage People cloud HR and payroll platform`, `ASM-2026-2XX26G · UAT-A: Brightwage People…`). No new copy contains an em dash. Data is shown verbatim.
- **Record terms.** `Security Analyst`, `Requestor`, `Risk`, `Risk Type` and `Assessment Request` keep their capitals in new copy (D-09). A request, a questionnaire and a risk assessment are lower case in running text ("My risk assessments", D-09). A control is a library control; a mitigation control is its use on a Risk.
- **Page names in copy** (UI-D1). A page is named by its heading, with the heading's own casing, wherever copy sends a person to it: `Go to Home`, `Go to My requests`, `View all 3 in My requests`, `Show all 12 in Requests`.
- **Counts.** `en-AU` grouping (`1,204`), `tabular-nums`, and singular and plural forms written out: `1 needs attention` / `9 need attention`, `1 request` / `3 requests`, `1 match` / `12 matches`.
- **Dates and times** (X-3): a calendar date (due, target, review, report as-at and month) is shown without a zone, as each surface formats it today. An instant shown as a date renders in the viewer's time zone through `LocalInstant`, with no zone label. §11.3 lists the surfaces.
- **The Released label** (decision 16): a request whose stored status is `approved` reads `Released` everywhere it is displayed (§10). The stored value, the `status=approved` query value and the API are unchanged.
- **No back-end or internal terms** (D-25, D-54): new copy avoids "contextual", "workspace", "authorised scope" and "bucket". §11.2 lists the files the interface copy guard scans.

---

## 1. Navigation: sidebar and phone drawer (UX-07; D-06 to D-14; UAT-002)

**Surface:** the shell's `aside.sidebar` from 1024px and the `Navigation` sheet below 1024px; `capability-navigation.tsx`, `navigation.ts`, `app-shell.tsx`.
**Focal point:** the current item (active bar and fill); for the Requestor, the `New request` primary action above it.

### 1.1 Profiles

The profile is chosen from the session's capabilities before render: the Security Analyst profile when the viewer holds `assessment:review`, otherwise the Requestor profile (D-06). A section renders only when it holds a visible item. Navigation visibility is not authorisation: every route gate and every Strapi check is unchanged.

**Requestor**

| # | Section | Element | Label | Opens | Capability | Icon | Count (§1.3) |
|---|---|---|---|---|---|---|---|
| 1 | top, unlabelled | Primary action (§1.2) | `New request` | `/app/requests/new` | `assessment-request:create` | `FilePlus2` | — |
| 2 | top, unlabelled | Item | `Home` | `/app` | `assessment-request:read` | `House` | — |
| 3 | `My work` | Item | `My requests` | `/app/requests` | `assessment-request:read` | `FileText` | needs your action |
| 4 | `My work` | Item | `My questionnaires` | `/app/questionnaires` | `assessment-request:read` | `ClipboardList` | to answer |
| 5 | `My work` | Item | `My risk assessments` | `/app/assessments` | `assessment-request:read` | `ShieldCheck` | — |

**Security Analyst**

| # | Section | Element | Label | Opens | Capability | Icon | Count (§1.3) |
|---|---|---|---|---|---|---|---|
| 1 | top, unlabelled | Item | `Home` | `/app` | `assessment-request:read` | `House` | — |
| 2 | `Assessment work` | Item | `Requests` | `/app/review/requests` | `assessment:review` | `Inbox` | need attention |
| 3 | `Assessment work` | Item | `Questionnaires` | `/app/review/questionnaires` | `assessment:review` | `ClipboardCheck` | — |
| 4 | `Assessment work` | Item | `Risk assessments` | `/app/review/assessments` | `assessment:review` | `ShieldAlert` | — |
| 5 | `Oversight` | Item | `Risk register` | `/app/risks` | `risk:manage` | `Table2` | — |
| 6 | `Oversight` | Item | `Alerts` | `/app/alerts` | `assessment:review` | `Bell` | overdue |
| 7 | `Oversight` | Item | `Reports` | `/app/reports` | `assessment:review` | `FileChartColumn` | — |
| 8 | `Reference data` | Item | `Risk Types` | `/app/admin/risk-types` | `administration:manage` | `Layers` | — |
| 9 | `Reference data` | Item | `Controls` | `/app/admin/controls` | `administration:manage` | `SlidersHorizontal` | — |
| 10 | `Reference data` | Item | `Information Systems` | `/app/admin/information-systems` | `administration:manage` | `Server` | — |
| 11 | `Reference data` | Item | `Information Assets` | `/app/admin/information-assets` | `administration:manage` | `Database` | — |
| 12 | `My own requests` (collapsible, starts collapsed) | Item | `My requests` | `/app/requests` | `assessment-request:read` | `FileText` | needs your action |
| 13 | `My own requests` | Item | `New request` | `/app/requests/new` | `assessment-request:create` | `FilePlus2` | — |

`Workspace` and `Analyst dashboard` leave the navigation (D-08). The seams of D-13 are data only: Phase 20 appends `My risks and treatments` to `My work`, Phase 13 adds `Assigned to me` to `Assessment work`, Phase 22 adds an Admin profile.

### 1.2 Anatomy (X-6)

| Part | Contract |
|---|---|
| Landmark | One `nav` named `Primary navigation` (unchanged name) in the sidebar and in the drawer. Everything in the table above sits inside it, the primary action included (UI-D5) |
| Primary action (Requestor) | The first element in the landmark, above `Home`: a full-width pill link (X-6), `--color-bg-page` fill, `FilePlus2` at 16px and the label in `--color-text-primary` at `--text-button`, `--shadow-button-light`; hover lifts 1px to `--shadow-button-light-hover` (§4 Buttons, 120ms expo), never recolours; `--focus-ring-inverse`. Height: the §4 Buttons default from 768px and the touch-target height below 768px (drawer). It is not a navigation item and never carries `aria-current` (UI-D43) |
| Top section | `Home` alone, with no label and no divider |
| Section label | `--text-micro` (uppercase by CSS) in `--color-text-inverse-muted`, above a `--color-border-on-dark` divider, exactly as today's group labels. Each section is `role="group"` named by its label (`aria-label="Assessment work"`) |
| Item | Unchanged (§4 AppShell): 36px, 13px at 500 in `--color-text-inverse-muted`, 16px icon, hover and current fill `--color-bg-sidebar-active` with `--color-text-inverse`, the 2px current bar. `aria-current="page"` on the one current item (the longest-match rule, D-06) |
| Count | At the item's end: the neutral tag on the sidebar (§4 Tags and chips: pill, `--color-border-on-dark-strong`, `--text-micro`, its padding), `tabular-nums`, in the item's own text colour (`--color-text-inverse-muted` at rest, `--color-text-inverse` on hover and when current). The meaning is visually hidden text inside the link (§1.3) |
| Collapsible section (`My own requests`) | The label row is a `button` (X-6): full width, the nav item height, `--radius-md`, a 16px `ChevronRight` (collapsed) or `ChevronDown` (expanded) before the label in `--text-micro`, the item hover fill, `--focus-ring-inverse`, `aria-expanded` and `aria-controls` naming its group. While collapsed it shows its items' count (§1.3) at its end. Its group is `hidden` while collapsed |
| Footer | The development role switcher, unchanged |

### 1.3 Counts (D-10, D-11)

| Item | Read (D-11, existing operations through existing service functions) | Visible | Accessible name of the link |
|---|---|---|---|
| Requestor · `My requests` | `GET /v1/my_requests/status_summary`, holder count for the Requestor | `3` | `My requests, 3 need your action` · `My requests, 1 needs your action` |
| Requestor · `My questionnaires` | `GET /v1/my_questionnaires/status_summary`, not started plus draft | `2` | `My questionnaires, 2 to answer` |
| Security Analyst · `Requests` | the Requires my attention queue total (`pagination[pageSize]=1`) | `9` | `Requests, 9 need attention` · `Requests, 1 needs attention` |
| Security Analyst · `Alerts` | `GET /v1/alerts/summary`, `byUrgency.overdue` | `6` | `Alerts, 6 overdue` |
| Security Analyst · `My own requests` › `My requests` | the status summary's holder count for the Requestor side | `1` | `My requests, 1 needs your action` |
| Security Analyst · the `My own requests` button while collapsed | the same figure | `1` | `My own requests, 1 needs your action` (plus the collapsed state from `aria-expanded`) |

- The accessible name is the content: visible label, a visually hidden `, `, the visible count, then the visually hidden meaning. No `aria-label` (research Pitfall 5), so the visible words start the name (WCAG 2.5.3).
- **Zero, a failed read and a refused read show no count.** Never a `0`, a dash or an error in the sidebar. A count is never colour alone: it is a number with a meaning in its name.
- **No count blocks a page.** The layout starts the reads without awaiting them; the badges render inside a Suspense boundary whose fallback is nothing, so a count appears in place without moving the label (it sits at the item's end).
- **Refresh:** with every server render of the layout (a full load, a router refresh, a Server Action that revalidates). No polling (§6 do-not 9). Counts are not live regions; a changed count is not announced.
- The count's link opens the list unfiltered, as the item always does; the Home and My requests filters open the filtered lists (§8).

### 1.4 The own-requests section (D-08)

- It starts collapsed on every full load, unless the current page is one of its items by the longest-match rule over every profile item (`/app/requests`, `/app/requests/{id}`, `/app/requests/{id}/edit`, `/app/requests/new`): then it starts expanded, so the current item is never hidden (research Pitfall 14).
- A client navigation to one of its items expands it; navigating away never collapses it. The state is never persisted.
- `Enter` or `Space` on the button toggles it; focus stays on the button. Collapsed items are not rendered in the tab order and are not prefetched.
- The drawer follows the same rules (D-12). With the section collapsed, every analyst navigation item fits a 375 × 812 drawer without scrolling; the development role switcher below it may need a scroll.

### 1.5 Guarded navigation (D-14)

Every item, the primary action and the wordmark navigate through Phase 10's guard (`onNavigate` and `GuardedLink`). A blocked link in the drawer leaves the drawer open; `Keep answering` returns focus to that link; `Leave questionnaire` closes the drawer and navigates (Phase 10 §6.3, unchanged).

### 1.6 Viewports

| Viewport | Contract |
|---|---|
| 1440 and 1024 | The 256px sidebar with every section; `My own requests` collapsed at the bottom; counts at item ends |
| 768 to 1023 | The sidebar is hidden; `Menu` opens the drawer, which renders the same profile through the same component |
| 375 | The drawer: `Close navigation` stays the first focusable control (asserted), then the primary action (Requestor), `Home` and the sections. The primary action and the section button meet the touch-target height |

### 1.7 Prefetch (carried item)

The Phase 8 baseline recorded up to 176 KB delivered after hydration on `/app/review`, most of it the sidebar links' automatic prefetch. The rebuilt sidebar keeps the router's default prefetching for its frequent destinations (Home, the three review lists, Risk register, Alerts, Reports, My work), because instant navigation there is the point of the sidebar, and changes two things (UI-D8):
- the four `Reference data` links set `prefetch={false}` and call `router.prefetch(href)` on pointer enter and on focus, so they are fetched only on intent;
- the collapsed `My own requests` links are not rendered, so they are never prefetched.

The cost is paid only from 1024px: below it the sidebar is hidden and the drawer mounts its links only when opened. The plan that rebuilds the sidebar records the post-hydration prefetch bytes on `/app` for the analyst in `performance.spec.ts`'s JSON record (never budgeted), beside the Phase 8 figure.

---

## 2. Page headings, route titles and recovery copy (D-09, D-25)

### 2.1 Every navigation destination

Each navigation label equals its page's level-one heading, and the route title is `{heading} | IdamBox CSRM` (D-09). One heading string per page feeds all three (recommended `page-headings.ts`).

| Route | Label and `h1` | Route title | Description (`PageHeader`) |
|---|---|---|---|
| `/app` | `Home` | `Home \| IdamBox CSRM` | `What needs your action, and where your work stands.` (both actors, UI-D3) |
| `/app/requests` | `My requests` | `My requests \| IdamBox CSRM` | `Requests you raised, and what happens next on each.` (was `Find and track the cyber risk assessment requests you are authorised to view.`) |
| `/app/requests/new` | `New request` | `New request \| IdamBox CSRM` | unchanged: `Save a structured draft now and submit it when it is ready for assessment.` |
| `/app/questionnaires` | `My questionnaires` | `My questionnaires \| IdamBox CSRM` | unchanged |
| `/app/assessments` | `My risk assessments` | `My risk assessments \| IdamBox CSRM` | unchanged |
| `/app/review/requests` | `Requests` | `Requests \| IdamBox CSRM` | unchanged: `Review submitted requests and start draft generation.` |
| `/app/review/questionnaires` | `Questionnaires` | `Questionnaires \| IdamBox CSRM` | unchanged |
| `/app/review/assessments` | `Risk assessments` | `Risk assessments \| IdamBox CSRM` | unchanged |
| `/app/risks` | `Risk register` | `Risk register \| IdamBox CSRM` | §11.1 (D-54) |
| `/app/alerts`, `/app/reports`, `/app/admin/{collection}` | unchanged (`Alerts`, `Reports`, `Risk Types`, `Controls`, `Information Systems`, `Information Assets`) | unchanged | unchanged |

The same heading and description render in each route's `loading.tsx` and `error.tsx` where they repeat the page header today: `requests/`, `requests/new/loading.tsx`, `questionnaires/`, `assessments/`, `review/requests/error.tsx` (today `Assessment Request Review`), `review/assessments/error.tsx` (today `Risk Assessment Review`), `review/questionnaires/` (three `PageHeader`s in the page, plus loading and error), `risks/` and `app/`.

**Unchanged, by decision (UI-D40):** detail pages are headed by their records, so their headings, safe-state headings (`Assessment request review`, `Questionnaire review`, `Risk assessment review`) and static route titles (`Assessment Request | IdamBox CSRM`, `Assessment Request Review | IdamBox CSRM`, `Questionnaire Review | IdamBox CSRM`, `Risk Assessment Review | IdamBox CSRM`, `Risk Details | IdamBox CSRM`) stay; so do their back links (`Back to assessment requests`, `Back to questionnaire reviews`, `Back to risk assessments`, `Back to released assessments`, `Back to questionnaires`).

### 2.2 Strings that name the Risk register

Visible text follows the heading's casing; accessible names that are not visible text (the table `Risk Register results`, its scroll region, `Loading Risk Register`) keep their wording, because casing is not heard (UI-D37).

| Location | Current | New |
|---|---|---|
| `risk-register.tsx:78` permission area | `the Risk Register` | `the Risk register` (heading `You don’t have access to the Risk register`) |
| `risk-register.tsx:84` invalid filters heading | `Risk Register filters are invalid` | `Risk register filters are invalid` |
| `risk-register.tsx:137` error noun | `the Risk Register` | `the Risk register` |
| `risk-register-filters.tsx:208` sheet title | `Risk Register filters` | `Risk register filters` |
| `risks/error.tsx` state heading | `We couldn’t load the Risk Register` | `We couldn’t load the Risk register` |
| `risk-details.tsx:157` permission title (Phase 10 keeps it) | `You don’t have permission to view the Risk Register` | `You don’t have permission to view the Risk register` |

### 2.3 Page names in Phase 10's copy

| Surface | Phase 10 string | Phase 11 string |
|---|---|---|
| Request hub gate, Requestor (`assessment-detail.tsx`) | `Reviewing requests is for Security Analysts. Your own requests are in My Requests.` · `Go to My Requests` | `Reviewing requests is for Security Analysts. Your own requests are in My requests.` · `Go to My requests` |
| Questionnaire review gate, Requestor | `… To answer a questionnaire sent to you, open it from My Questionnaires.` · `Go to My Questionnaires` | `… open it from My questionnaires.` · `Go to My questionnaires` |
| Assessment editor gate, Requestor | `… Assessments released to you are in My Risk Assessments.` · `Go to My Risk Assessments` | `… are in My risk assessments.` · `Go to My risk assessments` |
| Requestor questionnaire refusal | `… Yours are listed in My Questionnaires.` | `… Yours are listed in My questionnaires.` |
| Released assessment refusal | `… Yours are listed in My Risk Assessments.` | `… Yours are listed in My risk assessments.` |
| Risk detail refusal body | `The Risk Register is for Security Analysts. Your workspace shows the work you can open.` | `The Risk register is for Security Analysts. Home shows the work you can open.` |
| My questionnaires empty action (`questionnaire-list.tsx`) | `View my requests` | `View My requests` |

### 2.4 Recovery and generic state copy ("Workspace" leaves the product, D-25)

| Surface | Current | New |
|---|---|---|
| `PermissionDeniedState` default action (`states.tsx:132`) | `Return to workspace` | `Go to Home` (→ `/app`) |
| `PermissionDeniedState` description (Phase 10) | `Your workspace shows the work you can open. If you think you should have access, contact your administrator.` | `Home shows the work you can open. If you think you should have access, contact your administrator.` |
| In-shell not-found (`app/(app)/not-found.tsx:19`) | `Return to workspace` | `Go to Home` |
| Root not-found (`app/not-found.tsx:27`) | `Return to workspace` | `Go to Home` |
| Risk detail permission action (`risk-details.tsx:164`) | `Return to workspace` | `Go to Home` |
| Requests list error boundary (`review/requests/error.tsx:9`) | `Back to workspace` | `Go to Home` |
| `LoadingState` heading and line (`states.tsx:53-54`) | `Loading workspace…` · `Preparing your authorised workspace.` | `Loading…` · `Getting this page ready.` |
| `ErrorState` default heading (`states.tsx:108`) | `We couldn’t load this workspace` | `We couldn’t load this page` |

The locked patterns hold: `You don’t have access to {area}`, `We couldn’t load {noun}`, `Try again`, `No {noun} yet`, `No {noun} match these filters` with `Clear filters`, cleared `No {noun}`.

---

## 3. Header search control and shortcut (D-15, D-47)

**Surface:** the shell header (`.header`), every route inside the shell. Rendered only for a viewer who holds `assessment-request:read`, which every list quick find searches requires.
**Focal point:** none of its own: the control sits quietly beside the role tag, and the page's heading keeps the eye.

| Part | Contract |
|---|---|
| Position | In the header's right-hand group, immediately before the role tag, with the 8px §3.9 step between them. The header's other contents are unchanged (D-15). DOM order: `Menu` (below 1024px), the header title (from 768px), then the search control, then the role tag, so the skip link's next Tab stop is still `Menu` (asserted) |
| From 768px | An outline pill button (§4 Buttons, Outline, the default height): a 16px `Search` icon (`aria-hidden`), the visible label `Search` in `--text-button`, and the shortcut hint (X-7) |
| Below 768px | An icon-only circle at the touch-target size with the same 16px icon; the label `Search` is visually hidden, not removed |
| Accessible name | `Search` at every width, from the content; no `aria-label`. `aria-keyshortcuts="Control+K Meta+K"`, `aria-haspopup="dialog"`, `aria-expanded` while the dialog is open |
| Shortcut hint (X-7) | Two keys after the label: `⌘` `K` on Apple devices, `Ctrl` `K` elsewhere, decided in the browser after mount, so server and client render the same markup; `aria-hidden="true"`; not shown below 768px |
| Prefetch | Pointer enter or focus on the control starts loading the dialog code (D-52, §4.7) |
| Role tag | Unchanged from 375px up. Below 375px only, it may shrink with an ellipsis, its full text staying in the DOM, so the header never forces a horizontal scroll at 320px (UI-D10) |

**The shortcut** (D-47). `Ctrl+K` and `⌘K` both work on every platform, anywhere in the shell, including inside a text field. The handler calls `preventDefault()` only for those keys, ignores `event.isComposing` and `event.repeat`, and does nothing while another dialog is open (the `Navigation` sheet, a confirmation, the Phase 10 leave warning). Pressed while quick find is open, it closes quick find.

| Viewport | Contract |
|---|---|
| 1440, 1024 | `[Cyber Risk Manager] … [Search ⌘K] [SECURITY ANALYST]` |
| 768 | `[Menu] [Cyber Risk Manager] … [Search Ctrl K] [ROLE]` |
| 375 | `[Menu] … [search icon] [ROLE]`; with the longest development role (`Secondary Requestor`) the row fits within 375px |

---

## 4. Quick find (UX-10; D-48 to D-53; G-5)

**Surface:** a modal dialog over any shell route; `features/quick-find/`.
**Focal point:** the input; then the active option.

### 4.1 Layout (X-8)

| Part | From 768px | Below 768px |
|---|---|---|
| Frame | `Dialog` content 640px wide (§4 Dialogs form size), `--radius-2xl`, hairline, `--shadow-overlay`, horizontally centred and anchored `--spacing-header-h-md` plus the 48px §3.9 step below the viewport top, so its top edge never moves as results arrive | A full-screen sheet on `--color-bg-surface` |
| Title | `DialogTitle` `Search`, inside the content, visually hidden | A visible title row: `Search` as the heading at `--text-heading-sm`, and `Close` (outline pill, touch-target height; accessible name `Close search` from a visually hidden ` search`) |
| Description | `DialogDescription`, visually hidden, per actor (§4.2) | the same |
| Input row | A 16px `Search` icon, the input at `--text-body`, and while the input holds text a `Clear search` icon-only circle (visually hidden name), on a `--color-border-default` hairline; the row shows `--focus-ring` while the input is focused. The input's accessible name is `Search by number or title` (cmdk's visually hidden `label`), and its placeholder shows the same words | the same, at the touch-target height |
| List | The groups (§4.3), scrolling within the viewport height that remains less 48px (the shipped `max-h-[300px]` is replaced) | Fills the rest of the sheet and scrolls |
| Footer | A hint row, `aria-hidden`, `--text-caption` in `--color-text-secondary`, keys as X-7: `↑` `↓` `to move` · `Enter` `to open` · `Esc` `to close` | none |

Motion: the shipped `Dialog` open and close (§5 "Dialog / toast", 220ms in, 160ms out); reduced motion fades only.

### 4.2 What is searched (D-49)

One Server Action runs, in parallel, the existing list searches the viewer's capabilities allow, five results each. Strapi scopes every read; a list the viewer cannot read is never asked.

| Actor | Groups, in this order (each labelled as its sidebar item) | Description (visually hidden, and the hint's second line) |
|---|---|---|
| Requestor | `My requests`, `My questionnaires`, `My risk assessments` | `Find one of your requests, questionnaires or risk assessments by its number or title.` |
| Security Analyst | `Requests` (every request in review scope, `queue=all`), `Questionnaires`, `Risk assessments`, `Risk register`, `My requests` | `Find a request, questionnaire, risk assessment or Risk by its number or title.` |

A request an analyst raised may appear in both `Requests` and `My requests`; each group mirrors its list, so neither is removed (UI-D11).

### 4.3 Groups and options

| Part | Contract |
|---|---|
| Group heading | `.micro-label` in `--color-text-secondary`: the group label, then its total (`REQUESTS 12`). Its accessible name adds a visually hidden `, ` and ` {match\|matches}`: `Requests, 12 matches`. A group with no result is not shown |
| Option | Two lines. Line 1 at `--text-body`, `{identifier} · {name}` (X-4), wrapping onto a second line and clamping there (a Risk statement clamps to one line); the identifier never breaks. Line 2 at `--text-caption` in `--color-text-secondary`. The option's accessible name is its full text. Minimum height: the touch-target height below 768px |
| Active option | `--color-bg-inset` fill (the X-2 active option); `aria-selected` from cmdk |
| `Show all` option | Last in a group whose total exceeds five: `Show all {total} in {group label}`, opening that list filtered by the term |

| Kind | Line 1 | Line 2 | Opens |
|---|---|---|---|
| Request (review) | `{request number} · {title}` | `{status label}` (`Released` for approved) | `/app/review/requests/{id}` |
| Request (own) | same | same | `/app/requests/{id}` |
| Questionnaire | `{questionnaire number} · {title}` | `{status label}` (`Analyst review`, `Not started`, `Draft`, `Submitted`) | the analyst or Requestor route by group |
| Risk assessment | `{assessment number} · {request title}` | `{status label}` (`Draft`, `In review`, `Released`, `Closed`) | by group |
| Risk | `{risk number} · {statement}`, clamped to one line | `Residual rating: {rating}` or `Residual rating: Not rated`, then ` · Released` or ` · Under assessment` | `/app/risks/{id}` |

`Show all` destinations: `/app/review/requests?queue=all&q={term}`, `/app/review/questionnaires?q={term}`, `/app/review/assessments?q={term}`, `/app/risks?q={term}`, `/app/requests?q={term}`, `/app/questionnaires?q={term}`, `/app/assessments?q={term}`.

### 4.4 States (D-53)

| State | What shows | Announced (polite, one region) |
|---|---|---|
| Fewer than 2 characters after trimming | In the list area: `Type 2 or more characters of a number or title.` then the actor's description (§4.2) | nothing |
| First search in flight | Nothing for 300ms, then five skeleton option rows (§4 Skeletons); the list has `aria-busy="true"` | nothing |
| A newer search in flight | The previous results stay at the §5 pending opacity with `aria-busy="true"` until the new ones replace them; `Enter` still opens the active option, which is a real record (UI-D14) | nothing |
| Results | The groups, with totals and `Show all` | `{n} {match\|matches}`, where `n` is the sum of the group totals |
| No results | `No matches for “{term}”` at `--text-body` 500, then `Check the number, or try a word from the title. Only records you can open are searched.` | `No matches for {term}` |
| One list failed | That group's heading, `We couldn’t search {group label} just now.`, and the option `Retry search`; the other groups still show | `{n} {match\|matches}. {Group label} couldn’t be searched.` |
| Every list failed | `Search isn’t available right now.` `Try again in a moment.` and the option `Retry search` | `Search isn’t available right now.` |

The term is trimmed, searched from 2 to 100 characters (the input's `maxLength` is 100), debounced by about 250ms, with one search in flight: a newer term waits and only the latest result is applied (D-50). The dialog keeps the last term for the page session: reopening shows it selected, so typing replaces it (UI-D12).

### 4.5 Keyboard and focus (D-48, WAI-ARIA APG dialog and combobox)

| Event | Result |
|---|---|
| Open (control or shortcut) | Focus moves to the input (`role="combobox"`, `aria-expanded="true"`, `aria-autocomplete="list"`, `aria-controls` the listbox, `aria-activedescendant` the active option); the listbox is always present |
| `ArrowDown`, `ArrowUp` | Move the active option across groups; no wrap |
| `Home`, `End` | First and last option |
| `Enter` | Opens the active option (§4.6); on `Retry search` it searches again and focus stays in the input |
| `Escape` | Closes the dialog; focus returns to the element that was focused before it opened, stored on open and restored on close (research A3) |
| `Tab`, `Shift+Tab` | Stay inside the dialog: the input and `Clear search` (and `Close` below 768px) |
| `Clear search` | Empties the input; focus returns to the input |
| `Ctrl+J`, `Ctrl+K`, `Ctrl+N`, `Ctrl+P` | cmdk's bindings are off (`vimBindings={false}`); `Ctrl+K` closes quick find |

### 4.6 Opening a result (D-51)

Opening goes through Phase 10's guard, which gains a programmatic entry point (`navigate(href, { trigger, onLeave })`):
- **Not blocking:** quick find closes and the router navigates; focus goes to the header `Search` control, which persists across the navigation, and the router's announcer reads the new page title (UI-D13).
- **Blocking** (a Requestor with unsaved answers): the leave warning opens above quick find. `Keep answering` closes it and returns focus to the quick-find input; `Leave questionnaire` closes quick find and navigates. Phase 10's dialog copy is unchanged.

### 4.7 Loading the dialog (D-52)

The dialog body loads through `next/dynamic` on first open, prefetched on pointer enter or focus of the header control, so it adds nothing to any route's first-load JavaScript (R-08-34). Opened by the shortcut before its code has arrived, the dialog shows its frame and a skeleton input row (§4 Skeletons), then moves focus to the input the moment it is ready; nothing typed is lost. If the code cannot load, the frame shows the every-list-failed state of §4.4 (`Search isn’t available right now.` `Try again in a moment.`), and `Retry search` loads it again.

---

## 5. Home (UX-08; D-16 to D-25; UAT-001, UAT-003, UAT-004)

### 5.1 The route

- `/app` is Home for every actor: `h1` `Home`, route title `Home | IdamBox CSRM`, description `What needs your action, and where your work stands.` The page reads the session's capabilities (no Strapi read) and renders the analyst Home for `assessment:review`, otherwise the Requestor Home, before any data read (D-16). A Requestor issues no analyst read, fixture or partial.
- The Requestor Home's page header carries `New request` (primary pill link → `/app/requests/new`; was `Create request`) at every width; below 768px it spans the header (§4 Page header). The analyst Home has no header action (D-24).
- `/app/review` answers a 307 to `/app` from `next.config.ts`, keeping any query; `/app/review/*` is unaffected. There is no UI for the redirect (D-17).

### 5.2 Requestor Home (D-19 to D-22)

**Focal point:** `Needs your action`, the first content after the page header at every width.
**Layout:** one column below lg; from lg two columns, `Needs your action` beside `With the Security Analyst`, then `Released assessments` across both. DOM order equals visual order at every width (D-22). Each section is the analyst Home's widget frame (`Card`; icon at 16px and `h2` at `--text-heading-sm`; a one-line description; body; footer with a truncation note and links), shared by both Homes (UI-D16).

**Needs your action** (`ListChecks`)

| Part | Contract |
|---|---|
| Description | `Requests and questionnaires waiting for you.` |
| Source | `GET /v1/my_requests?holder=requestor`, up to ten items in the server's order |
| Item line 1 | The request title, a `RecordLink` to `/app/requests/{id}` at `--text-body` 500 |
| Item line 2 | `--text-caption` / `--color-text-secondary`: `{request number} · Due {due date}` or `{request number} · No due date` |
| Item line 3, questionnaire to answer | The server's next step as a text link to the questionnaire: `Answer and submit the questionnaire.`, then `{answered} of {total} answered` (`--text-caption` 500, `tabular-nums`) and the shared `Progress` bar named `{answered} of {total} questions answered` |
| Item line 3, draft | The server's next step as plain text: `Complete and submit this request.` (its destination is the title's; UI-D17) |
| Returned draft | One more caption line: `Returned to draft on {local date}. Reason: {reason}`, or `Returned to draft on {local date}.` without a reason |
| Footer | `Showing {shown} of {total}` when truncated; `View all {total} in My requests` → `/app/requests?holder=requestor` |
| Empty, first use (the Requestor has no request) | `No requests yet` · `Start a request when you plan a change that needs a cyber risk assessment.` · action `New request` |
| Empty, cleared | `No requests waiting for you` · `When a request or questionnaire needs you, it appears here.` (no action) |
| Section error | Compact `We couldn’t load requests waiting for you` with `Try again` |

**With the Security Analyst** (`Hourglass`)

| Part | Contract |
|---|---|
| Description | `Requests a Security Analyst is working on.` |
| Source | `GET /v1/my_requests?holder=analyst`, up to five |
| Item | Line 1: the title (`RecordLink`). Line 2 (caption): `{request number} · Submitted today`, `… · Submitted 1 day ago`, `… · Submitted {n} days ago` from the server's `daysSinceSubmission`. Line 3 (`--text-body` / `--color-text-secondary`): the server's sentence naming the Security Analyst (§6.1) |
| Footer | `Showing {shown} of {total}` when truncated; `View all {total} in My requests` → `/app/requests?holder=analyst` |
| Empty (cleared) | `No requests with the Security Analyst` · `Requests appear here while a Security Analyst works on them.` |
| Section error | Compact `We couldn’t load requests with the Security Analyst` with `Try again` (the Requestor partial fixture, §5.4) |

**Released assessments** (`ShieldCheck`; was `Recently released assessments`)

| Part | Contract |
|---|---|
| Description | `Your most recently released risk assessments.` |
| Rating chips | The list `Released assessments by overall rating`: `Low`, `Moderate`, `High`, `Critical` (today's order), each a `RiskRatingBadge` and its count. A count above zero makes the chip a block link with a trailing `ChevronRight` to My risk assessments filtered by that overall rating, named `{Rating}: {n} released risk {assessment\|assessments}`; a zero is plain (X-10) |
| Item (up to five) | The assessment number (`RecordLink` → `/app/assessments/{id}`), the request title (`--text-body`), `Released {local date}` (caption), and the overall rating badge or `Not rated` |
| Footer | `View all {total} in My risk assessments` → `/app/assessments` |
| Empty (first use) | `No released risk assessments yet` · `Assessments appear here after a Security Analyst releases them.` (the chips still show, plain) |
| Section error | Compact `We couldn’t load released assessments` with `Try again` |

The seven stored-status tiles leave Home (UAT-003); My requests keeps its status filter. Only `Needs your action` carries a call to action when the Requestor has nothing yet, so an empty Home shows one next step (§4 Empty states).

| Viewport | Contract |
|---|---|
| 1440 | Two sections side by side, `Released assessments` beneath at full width |
| 375 | Heading, description, `New request` at full width, then `Needs your action` starts within the first screen (812px), then the other two |

### 5.3 Analyst Home (D-18)

**Focal point:** the `Needs action` tiles, then the `Review queue` widget.

| Order | Unit | Change |
|---|---|---|
| 1 | `Needs action` tiles (four, sr-only `h2` `Needs action`) | Copy unchanged. Two columns below xl (was one below sm), four from xl, so the queue starts within the first 375px screen (UI-D20) |
| 2 | `Review queue` | Unchanged; its `Generation in progress` row is the jobs figure |
| 3 | `Treatments due` | Description §9.4 |
| 4 | `Upcoming due dates` | Description §9.4 |
| 5 | `Top alerts` | Description §9.4 |
| 6 | `Risk exposure` | §9.2 |
| 7 | `High and Critical residual Risks` | §9.2 |
| 8 | `Recent activity` | Full width from lg (unchanged); dates in the viewer's zone (§11.3) |
| 9 | `Your own requests` (new) | The left column from lg, full width below lg (UI-D21) |

**Your own requests** (`FileText`)

| Part | Contract |
|---|---|
| Description | `Requests you raised yourself, as a Requestor.` |
| Rows | Link rows in the Review queue's pattern (whole row one link, the count and a `ChevronRight` at the end): `Needs your action` {n} → `/app/requests?holder=requestor`, named `Needs your action: {n} {request\|requests}`; `With the Security Analyst` {n} → `/app/requests?holder=analyst`, named `With the Security Analyst: {n} {request\|requests}`. Zero rows render: they are data |
| Footer links | `View My requests` → `/app/requests`; `New request` → `/app/requests/new` |
| Error | Compact `We couldn’t load your own requests` with `Try again` |

| Viewport | Contract |
|---|---|
| 1440 | Four tiles in one row; widgets in two columns: `Review queue` and `Treatments due`, `Upcoming due dates` and `Top alerts`, `Risk exposure` and `High and Critical residual Risks`, then `Recent activity` across both, then `Your own requests` in the left column |
| 375 | Heading and description, the tiles two by two, then every widget full width in order; the `Review queue` begins within the first screen (812px) |

**Focus and announcements (both Homes).** Home moves no focus on load and announces nothing; the skip link reaches `main` as on every page. Each section and widget is a region named by its `h2`, so headings and landmarks reach it.

### 5.4 Loading, errors, permission and fixtures (D-23)

| State | Requestor Home | Analyst Home |
|---|---|---|
| Route `loading.tsx` (kept, UI-D4) | The Home page header without the action, and no body | the same |
| Loading (the page's Suspense fallback) | Three section skeletons in the final grid (icon and heading line, description line, three two-line rows, footer line), `role="status"` named `Loading Home` | Four tile skeletons (two columns below xl) and eight widget skeletons in the final order and spans, named `Loading Home` |
| Page error (every read failed) | `We couldn’t load your requests` · `Try again` | `We couldn’t load the review summary` · `Try again` |
| Route `error.tsx` | Home page header and the default `We couldn’t load this page` · `Try again` | the same |
| Permission (a refused read) | `You don’t have access to your requests` with the shared description and `Return to sign in` (→ `/sign-in`; `Go to Home` would loop, UI-D19) | `You don’t have access to the review summary`, the same description and action |
| Partial (one unit failed) | New closed selector `__e2ePartial=requestor-home-with-analyst-error` fails `With the Security Analyst` alone (replaces `draft-requests-error`) | `analyst-top-alerts-error` (unchanged, now at `/app`) |
| `__e2eState` fixtures | populated, loading, empty (first-use and cleared sections), error, permission, resolved only after the real reads succeed | the same, as today |

---

## 6. Next action and the phone lifecycle stepper (UX-08 criterion 3; D-26 to D-28; UAT-038, UAT-003)

**Surfaces:** the Requestor's `/app/requests/{id}` and the analyst's `/app/review/requests/{id}`; `request-lifecycle-stepper.tsx`, `request-hub.tsx`, Strapi `request-lifecycle.ts`.
**Focal point:** the next action, under the stepper's heading on a phone and in the hub's summary from 768px.

### 6.1 The next action names who holds the work (D-27)

`request-lifecycle.ts` holds these strings; `nextAction` gains `holder` beside `actor` (the viewer). The web renders `Next action: ` (unchanged lead, UI-D22) and the summary, as a link only when the viewer holds the step and the server supplies an href. "The work is waiting with the other party." retires.

| Step | `holder` | The Requestor reads | The Security Analyst reads |
|---|---|---|---|
| `draft` | `requestor` | `Complete and submit this request.` (link, request page) | `The Requestor hasn’t submitted this request yet.` |
| `submitted` | `analyst` | `The Security Analyst is reviewing your request and will send you a questionnaire to answer.` | `Generate the questionnaire.` (link) |
| `questionnaire-generated` | `analyst` | `The Security Analyst is checking your questionnaire before sending it to you.` | `Review and release the questionnaire.` (link) |
| `questionnaire-released` | `requestor` | `Answer and submit the questionnaire.` (link, questionnaire) | `The Requestor is answering the questionnaire.` |
| `questionnaire-submitted` | `analyst` | `The Security Analyst is reviewing your answers to assess the request’s risk.` | `Draft the assessment.` (link) |
| `assessment-drafted` | `analyst` | `The Security Analyst is preparing your risk assessment.` | `Complete the assessment review.` (link) |
| `assessment-reviewed` | `analyst` | `The Security Analyst is finalising your risk assessment before releasing it to you.` | `Release the assessment.` (link) |
| `assessment-released` | `none` | `No action is required.` | `No action is required.` |

A closed request has no next action (unchanged). The Requestor's sentences name no unreleased record and carry no link to one (existing rule).

### 6.2 One next action per width (D-26, D-28; UI-D23)

| Width | Stepper | Hub |
|---|---|---|
| Below 768px | Compact (§6.3), carrying `Next action: …` | The hub's `Next action` line is `display: none` |
| From 768px | The full stepper, as today, with no next action | The hub's `Next action` line, as today |

Both lines render in the DOM; only one is displayed and exposed at any width. Phase 10's generation-job text (Phase 10 §12.3) replaces the summary in both while a job is queued or running, as plain text (D-28).

### 6.3 Compact stepper (X-9; both request pages)

| Part | Contract |
|---|---|
| Heading | `Current lifecycle state: {label}` (unchanged text), `h2` at `--text-heading-sm` at every width (UI-D24) |
| Step line | `Step {n} of {m}` at `--text-body` 500, `tabular-nums`; `n` is the current step's position, `m` is 8 |
| Next action | `Next action: {summary}` at `--text-body`, the lead at 500, the summary a `RecordLink` when it links |
| Terminal line | Unchanged: `This request is closed. All lifecycle steps are complete.` |
| Disclosure | An outline pill button at the touch-target height: `Show all steps` with `ChevronDown`, or `Hide all steps` with `ChevronUp`, swapped with no transition; `aria-expanded`, `aria-controls` the ordered list `Assessment request lifecycle` |
| Expanded | The full ordered list below the button, one column, the shipped step cards; each step's `Step {n}` label at `--text-caption` 500 (UI-D24) |
| Spacing | 8px between heading, step line and next action; 16px before the disclosure (§3.9) |

Focus stays on the disclosure when it toggles; no live region (the expanded state is announced from `aria-expanded`). At 375 × 812 the heading, step line and next action sit within the first screen on both request pages.

---

## 7. Review and My lists (UX-09 criterion 1; D-29 to D-34; UAT-035, UAT-048)

Every list stays on `DataTable` with its density toggle, filter chips, result count, sticky identifier column while it overflows, and mobile cards below 768px. No list gains a column chooser: column choice is designed once with Phase 18's DataTable work (D-33).

| Viewport | Contract (every list) |
|---|---|
| 1440 | The table with the columns below; a table wider than its container scrolls only inside its labelled region, its identifier column sticky, with the end-edge fade (§4 DataTable) |
| 375 | The mobile cards below 768px, one per record, with the fields each list names; the controls stack (unchanged) |

**Focus and announcements (every list).** Unchanged DataTable behaviour: a sort button and a filter select keep focus when they change the URL; the result count is an `output` and is not live; `Clear filters` moves no focus.

### 7.1 Requests (`/app/review/requests`)

**Focal point:** the table; the `Queue:` line above the controls names the view.

| Control | Contract |
|---|---|
| Search | Label and accessible name `Search by number or title` (was `Search assessment requests`); matches the request number or the title (D-30) |
| Status | `All statuses`, then the request statuses with `Released` (§10) |
| Queue | `Requires my attention` (default), `Awaiting Requestor`, `Generation in progress`, `Released`, `All requests`; the line above reads `Queue: {label}` |

| Column | Content | Sort |
|---|---|---|
| `Request` | Request number, `RecordLink`, identity numeric | yes |
| `Title` | Title, `RecordLink`, long-text column (§4 DataTable) | yes |
| `Requestor` | Display name, else `Not recorded` | no |
| `Assessment type` | `BAU`, `Project` or `Other`, else `Not provided` | no |
| `Business criticality` | `Low`, `Moderate`, `High` or `Critical` as plain text, else `Not provided`: a business attribute, never the severity badge (UI-D27) | no |
| `Status` | `StatusBadge` | yes |
| `Due date` | Calendar date (`30 Oct 2026`), else `Not provided` | yes |
| `Age` | `{n} {day\|days}` from `daysSinceSubmission` (`0 days` included), magnitude numeric; else `Not recorded` | no (the `Submitted` sort orders by age, UI-D28) |
| `Submitted` | `LocalInstant` date (`27 Sept 2026`), else `Not recorded` | yes |

**Mobile card:** line 1, the request number (`RecordLink`, caption, `tabular-nums`) with the `StatusBadge` at the end; line 2, the title (`RecordLink`); line 3 (caption, secondary), `{requestor} · Due {due date}` or `{requestor} · No due date`; line 4 (caption, secondary), `Age {n} {day|days}`.

### 7.2 Risk assessments (`/app/review/assessments`) and My risk assessments (`/app/assessments`)

**Focal point:** the `Request title` column beside each assessment number, which identifies the work without opening it (UAT-035).

| Column | Risk assessments (analyst) | My risk assessments (Requestor) |
|---|---|---|
| `Assessment` | number, `RecordLink` | number, `RecordLink` (sort unchanged) |
| `Request title` | request title, long-text, else `Not recorded` (replaces `Summary`) | the same (replaces `Summary`, UI-D29) |
| `Status` | `StatusBadge` (assessment family) | — (released only) |
| `Risks` | the count, magnitude numeric | — |
| `Highest residual rating` | `RiskRatingBadge` (dense form allowed), else `Not rated` | — |
| `Overall rating` | — | unchanged |
| `Draft initiated by` | unchanged | — |
| `Released` | `LocalInstant` date where released, else `Not released` | unchanged column, now `LocalInstant` in the long form (`27 September 2026`) |

| Control | Contract |
|---|---|
| Search | Labels unchanged (`Search risk assessments`); matches the number, the summary or the request title (D-31) |
| Overall rating (new, both lists) | Select `Overall rating`: `All ratings`, `Low`, `Moderate`, `High`, `Critical`; chip `Overall rating: High` |
| Released date range (analyst list) | No visible control; set by the throughput figures (§8.2) and shown as removable chips `Released from: {date}` and `Released to: {date}` (UI-D30) |

**Mobile cards.** Analyst: the number with the status badge; the request title; `{n} {Risk|Risks} · Highest residual` with the badge, or `No Risks yet`; `Draft initiated by {name}`; `Released {date}` when released. Requestor: the number with the rating badge; the request title; `Released {date}`.

### 7.3 My requests (`/app/requests`; D-34)

**Focal point:** the `Next step` column, whose holder line says whose turn it is.

| Column | Content |
|---|---|
| `Request ID` | unchanged |
| `Title` | unchanged |
| `Status` | `StatusBadge` (`Released` for approved) |
| `Next step` (new) | Line 1, `.micro-label` in `--color-text-secondary`: `Needs your action`, `With the Security Analyst` or `No action needed`, from `holder`. Line 2, `--text-table`: the server's sentence (§6.1), a `RecordLink` when the viewer holds the step and it links. A long-text column (§4 DataTable): the sentence wraps and clamps to two lines, its full text in the DOM |
| `Due date` | unchanged (`Due {date}`, `No due date`) |
| `Updated` | `Updated {LocalInstant date}`, `No update date` |

| Control | Contract |
|---|---|
| Search, Status | unchanged; Status options read `Released` |
| Show (new) | Select `Show`: `All requests`, `Needs your action`, `With the Security Analyst`, `No action needed` (`holder` = requestor, analyst, none); chip `Show: Needs your action`; `Clear filters` clears it |

**Mobile card:** the number and title with the status badge (unchanged), then the holder line and the sentence, then `Due {date} · Updated {date}`.

### 7.4 The Related assessment picker (D-32)

In the Risk register's `More filters`, `Related assessment` searches on the server by number, summary or request title. Each option and the selected line read `{assessment number} · {request title}` (X-4); an assessment without a request title reads its number alone. The chip reads `Related assessment: {assessment number} · {request title}`.

---

## 8. Figures open their records (UX-09 criterion 2; D-35 to D-39; UAT-048)

### 8.1 Link rules (X-10)

1. A figure that counts records opens the list holding exactly those records, so the list's total equals the figure (07 D-18, D-24, D-36).
2. **Tiles** (`KpiTile`) and **Home link rows** (review queue, own requests, exposure rows) are block links at any value, as Phase 7 shipped them (UI-D31).
3. **Report table cells and Home rating chips:** a figure above zero is a link with the record-link treatment on the figure alone; a zero is plain text.
4. **Sums** of linked parts stay plain beside their parts (D-37).
5. **Control implementation counts** never pose as an equal list (D-36): the tile is a block link whose supporting line says what it opens (`View the Risks that have them`), and table figures stay plain while their row headers link with names beginning `{label}: view the Risks with …`.
6. **Row headers** may link to the records their row describes when the figures cannot (systems, control statuses).
7. **Names:** each link's accessible name begins with its visible figure or label (WCAG 2.5.3), then says what it counts.

| Link | Visible | Accessible name pattern |
|---|---|---|
| Table cell | `{n}` | `{n} {Risk\|Risks}: {row label}, {column label}` (for example `3 Risks: Critical, Not Started`); in a table with one figure column, `{n} {Risk\|Risks}: {row label}` (for example `2 Risks: Due later`) |
| Month cell | `{n}` | `{n} released in {Month Year}` |
| Lifecycle cell | `{n}` | `{n} {request\|requests}: {status label}` |
| Row header | `{label}` | `{label}: view {what}` (for example `Existing: view the Risks with Existing mitigation controls`) |
| Rating chip | badge and `{n}` | `{Rating}: {n} released risk {assessment\|assessments}` |

### 8.2 Inventory

| Surface | Figure | Opens (filters by the list's own vocabulary; new filters from D-35) |
|---|---|---|
| Analyst Home | the four tiles, the six review queue rows, Treatments due, Upcoming due dates, Top alerts | unchanged |
| Analyst Home | exposure rows, accepted links, under assessment | §9.2 |
| Analyst Home | High and Critical footer | `View Critical Risks` → `/app/risks?residualRating=Critical&state=open&stage=released`; `View High Risks` → the same with `High` (replaces `Open Risk Register`; the list total is not a figure, D-37) |
| Analyst Home | own requests rows | §5.3 |
| Requestor Home | section totals, rating chips | §5.2 |
| Risk exposure report | tiles, table cells, systems, under assessment | §9.3 |
| Treatment performance | `Overdue` tile and row | `/app/alerts?kind=risk-treatment-overdue` (unchanged) |
| Treatment performance | `Due within 14 days` tile and row | `/app/alerts?kind=risk-treatment-due-soon` |
| Treatment performance | `Due later` row; `No target date` tile and row | `/app/risks?dueState=later`; `/app/risks?dueState=no-target-date` |
| Treatment performance | treatment status rows (`Not Started` … `Not provided`) | `/app/risks?state=open&treatmentStatus={value}` (`Not provided` → the `none` value) |
| Assessment throughput | `Released in period` and `Median days to release` tiles | the period's released list: `/app/review/assessments?status=approved&approvedFrom={period start}&approvedTo={today}`. The median's supporting line keeps `Across {n} releases with a submission date` (D-39) |
| Assessment throughput | each month cell | the same list for that month |
| Assessment throughput | lifecycle rows | `/app/review/requests?queue=all&status={status}` (the `approved` row reads `Released`) |
| Control effectiveness | `Mitigation controls` tile (was `Control Implementations`) | A block link to `/app/risks?mitigationStatus=any&state=open` whose supporting line reads `View the Risks that have them`, so its name says what it opens; the figure still counts mitigation controls (UI-D32) |
| Control effectiveness | implementation status rows | Row header links → `/app/risks?mitigationStatus={value}&state=open`, named `{status}: view the Risks with {status} mitigation controls`; figures plain; the section description adds `Select a status to view the Risks with those mitigation controls.` |
| Control effectiveness | effectiveness rows | Row header links → `/app/risks?mitigationEffectiveness={value}&state=open`, named `{rating}: view the Risks with {rating} mitigation controls`; the description adds `Select a rating to view the Risks with those mitigation controls.` |
| Control effectiveness | `Rated Ineffective` tile | `/app/alerts?kind=ineffective-control` (unchanged) |

Query names in this table follow the research's proposals; the planner names the final keys within the closed vocabularies (CONTEXT, Planner's Discretion).

---

## 9. Exposure scope (DASH-03; D-40 to D-45; UAT-060)

### 9.1 Vocabulary

| Term | Meaning | Where it shows |
|---|---|---|
| `Released` | an open Risk whose risk assessment carries the complete release facts | exposure figures, the Risk register stage, quick find |
| `Under assessment` | an open Risk whose risk assessment is a draft or in review, with no release facts | the separate exposure figure, the Risk register stage |
| `Accepted` | a released open Risk with the treatment action `Accept`; a draft's `Accept` never counts | the exposure widget, the report, the Risk register row |

Scope lines, in words on each figure's surface: `Released Risks only.` and `Includes Risks under assessment.`

### 9.2 Analyst Home

**Focal point:** the released rating rows; the under-assessment row sits apart below them, so the two stages are never read as one total.

**Risk exposure**

| Part | Contract |
|---|---|
| Description | `Released Risks only. Open Risks by residual rating, with accepted Risks marked.` |
| List name | `Released open Risks by residual rating` (was `Open contextual Risks by residual rating`) |
| Rows | `Critical`, `High`, `Moderate`, `Low`, then `Not rated` when above zero: each row one link (badge, bar, count, chevron) → `/app/risks?residualRating={rating}&state=open&stage=released` (`Not rated` → the `none` value), named `{Rating}: {n} released open {Risk\|Risks} by residual rating` |
| Accepted | After a row whose accepted figure is above zero, a text link `{n} accepted` → the same filters plus `treatmentAction=Accept`, named `{n} accepted {Rating} {Risk\|Risks}`; it sits on the row's line from the widget's `@md` size and wraps beneath the count below it (the `BarChart` secondary link, UI-D34) |
| Under assessment | Below the chart, after a `--color-border-default` hairline, a link row in the Review queue's pattern: `Under assessment` and its count → `/app/risks?state=open&stage=under-assessment`, named `Under assessment: {n} open {Risk\|Risks} not yet released`; under it, `--text-caption` / `--color-text-secondary`: `Not yet released, so not counted above.` It renders at zero too |
| Empty | When no released open Risk exists: cleared `No released open Risks` · `Risks count here once their risk assessment is released.`, with the under-assessment row beneath |

**High and Critical residual Risks**

| Part | Contract |
|---|---|
| Description | `Released open Risks rated High or Critical after treatment, highest first.` |
| Rows | Released Risks only (D-42); anatomy unchanged |
| Empty | `No released High or Critical residual Risks` · `Released open Risks rated High or Critical after treatment appear here.` |
| Footer | `View Critical Risks` · `View High Risks` (§8.2) |

| Viewport | Contract |
|---|---|
| 1440 | Both widgets side by side in the Home grid; each exposure row holds its accepted link on the same line |
| 375 | Full width; an accepted link wraps beneath its row's count; the under-assessment row keeps its caption beneath it |

### 9.3 Risk exposure report

**Focal point:** the Summary tiles, where `Released open Risks` and `Under assessment` sit side by side as separate figures.

| Part | Contract |
|---|---|
| Description (`report-copy.json`, `report-definitions.ts`) | `Released Risks by rating and treatment status, the most exposed Information Systems, and the Risks still under assessment.` |
| Tiles (five) | `Released open Risks` {total}, supporting `Released Risks only` → `/app/risks?state=open&stage=released`; `Critical residual` and `High residual`, supporting `Released open Risks` → the same plus the rating; `Accepted`, supporting `Released Risks with the treatment action Accept` → plus `treatmentAction=Accept`; `Under assessment`, supporting `Not yet released` → `/app/risks?state=open&stage=under-assessment`. Strip: two columns below sm, three from sm, five from xl (UI-D38) |
| `Inherent and residual rating` | Description `Released open Risks by inherent and residual rating, with accepted Risks by residual rating.` Table `Rating` \| `Inherent` \| `Residual` \| `Accepted`; each non-zero cell links (inherent and residual by their rating, accepted with `treatmentAction=Accept`), all with `state=open&stage=released`. The small multiples chart inherent and residual only |
| `Residual rating by treatment status` | Description `Released open Risks by residual rating and treatment status. Treatment status is the value recorded on each Risk. Overdue by target date is in the Treatment performance report.` Non-zero cells link (`residualRating` and `treatmentStatus`, with `none` for `Not rated` and `Not provided`); a row total links by rating alone |
| `Most exposed Information Systems` | Description `Information Systems carrying the most released open High and Critical residual Risks, highest first. Select a system to view its released open Risks.` The system name links to its released open Risks (`{name}: view its released open Risks`); `Critical` and `High` cells link; `Total` is a sum and stays plain. The coverage note keeps its sentence and count (`{n} High or Critical residual {Risk has\|Risks have} no impacted Information System.`) and is followed by two links, `View Critical` and `View High`, named `View Critical Risks with no impacted Information System` and `View High Risks with no impacted Information System`, each opening the no-impacted-system filter with its rating, `state=open&stage=released`; the note's own figure is their sum (D-37) |
| `Under assessment` (new section) | Description `Open Risks in risk assessments not yet released, by residual rating. They are not counted in the sections above.` Table `Residual rating` \| `Risks`, `Critical` to `Low` then `Not rated`, non-zero cells → `/app/risks?state=open&stage=under-assessment&residualRating={rating}`; a severity-toned bar chart beside it. Empty (cleared): `No Risks under assessment` · `Risks appear here while their risk assessment is a draft or in review.` |
| Empty (no released open Risk) | cleared `No released open Risks` · `Risks count here once their risk assessment is released.` in the three released sections |

### 9.4 Figures that keep both stages (D-43)

| Surface | New description |
|---|---|
| Treatments due (Home) | `Risk treatments past their target date or due within {window}, most overdue first. Includes Risks under assessment.` |
| Upcoming due dates (Home) | `Due, target and review dates in the next {window}, soonest first. Includes Risks under assessment.` |
| Top alerts (Home) | `The most urgent alerts across your scope, including Risks under assessment.` |
| Treatment performance (`report-copy.json`) | `Risk treatments by due state and treatment status, and the most overdue treatments. Includes Risks under assessment.` |
| Due state section | `Open Risks whose treatment is not Complete, by target date. Includes Risks under assessment.` |
| Treatment status section | `All open Risks, by the treatment status recorded on each Risk. Includes Risks under assessment.` |
| Control effectiveness (`report-copy.json`) | `Mitigation controls on open Risks by implementation status and effectiveness rating. Includes Risks under assessment.` |
| Implementation status section | `Mitigation controls on open Risks by implementation status. Select a status to view the Risks with those mitigation controls.` |
| Effectiveness rating section | `Mitigation controls on open Risks by effectiveness rating. Select a rating to view the Risks with those mitigation controls.` |

The treatment report's window is the product's due-soon window, 14 days (D-38): its tile and row read `Due within 14 days`, from the served `dueWindowDays`.

### 9.5 Risk register markers and filters (D-44)

**Row markers** (text, never colour alone; UI-D36):
- `Related assessment` cell: the assessment link, then a second line at `--text-caption` / `--color-text-secondary`: `Released` or `Under assessment`.
- `Treatment status` cell: the badge, then `Accepted` on a second caption line for an accepted Risk.
- Mobile card: after the assessment link, `Released` or `Under assessment`, then ` · Accepted` when accepted.

**Filters.** Core row unchanged (search, treatment status, inherent rating, residual rating), with new options: `Not rated` in both rating selects and `Not provided` in the treatment status select. `More filters` (and the phone `Filters` sheet) gains, after `Risk state`:

| Control | Options | Chip |
|---|---|---|
| `Stage` | `All`, `Released`, `Under assessment` | `Stage: Released` |
| `Treatment action` | `All`, `Accept`, `Treat` | `Treatment action: Accept` |
| `Due state` | `All`, `Overdue`, `Due soon`, `Due later`, `No target date`, `Complete or closed` | `Due state: Due later` |
| `Mitigation-control effectiveness` | `All`, `Effective`, `Partially Effective`, `Ineffective`, `Not Assessed`, `Not provided` | `Mitigation-control effectiveness: Effective` |
| `Mitigation-control status` (existing) | adds `Any mitigation control` | `Mitigation-control status: Any mitigation control` |
| `Impacted system` (existing) | adds a checkbox under the picker, `No impacted system`, exclusive with a chosen system | `Impacted system: None` |

The phone sheet's description: `Search and filter Risks.` (was `Search and filter authorised contextual Risks.`). By default the register still lists every Risk in scope.

The accepted marker's browser proof reads the one released, open, accepted Risk that `seed-analyst-insights.ts` gains (D-45): its row shows `Released` and `Accepted`, and it appears in the exposure widget's accepted link for its rating.

---

## 10. The Released label (UX-09 criterion 3; D-46; UAT-065)

| Where | Contract |
|---|---|
| `status-badge.tsx:72` and `request-domain.ts:29` | Both label maps change together: `approved` → `Released`; icon `CircleCheck` and the success tone unchanged (research Pitfall 13) |
| Surfaces | Request badges, status filter options, chips (`Status: Released`), the throughput report's lifecycle row, Home, My requests, quick find |
| Unchanged | The stored `approved`, the `status=approved` query value, the API and the review queue's `Released` bucket |
| Root `CONTEXT.md` glossary | The last sentence of the `Released` entry is replaced by the sentence below |

> Only the displayed label changes. The stored value `approved` and the `status=approved` query value are unchanged, and a request whose stored status is `approved` (`CsrmRequestStatus`) also reads "Released".

---

## 11. Copy and local time (D-54, D-55)

### 11.1 "contextual" leaves the product

| File:line | Current | New |
|---|---|---|
| `app/(app)/app/risks/page.tsx:13` (and `risks/loading.tsx`, `risks/error.tsx`) | `Search and manage contextual Risks across authorised assessments.` | `Search and manage Risks from released risk assessments and from those still under assessment.` |
| `risk-register-filters.tsx:208` | `Search and filter authorised contextual Risks.` | `Search and filter Risks.` |
| `analyst-dashboard-presentation.ts:171, 173, 325` | the exposure description, empty noun and list name | §9.2 |
| `analyst-dashboard-presentation.ts:113` | `Untreated Critical Risks and ineffective Control Implementations` | `Untreated Critical Risks and ineffective mitigation controls` (UI-D33) |
| `analyst-dashboard-presentation.ts:53-57` | title `Analyst dashboard`, description, `Loading analyst dashboard`, area `the analyst dashboard` | retire; §5.1 and §5.4 |
| `report-presentation.ts:117` | tile `Open contextual Risks` | `Released open Risks` (§9.3) |
| `report-presentation.ts:136` | tile `Control Implementations` | `Mitigation controls` (§8.2) |
| `report-presentation.ts:336` | empty noun `open contextual Risks` | exposure: `released open Risks`; treatment: `open Risks` (`Risks appear here when a Risk Assessment identifies them.` unchanged) |
| `report-presentation.ts:342-344` | `Control Implementations` empty noun and description | `No mitigation controls` · `Mitigation controls appear here when they are added to open Risks.` |
| `report-presentation.ts:351, 359, 371, 377, 400, 406` | section descriptions | §9.3 and §9.4 |
| `report-presentation.ts:402, 408` | column `Control Implementations` | `Mitigation controls` |
| `report-copy.json:5, 23` and `report-definitions.ts:24, 39` | report descriptions | §9.3 and §9.4 (the mounted test keeps the two equal) |

### 11.2 The interface copy guard

The Phase 10 guard (`interface-copy-guard.test.ts`) drops its Phase 11 exclusions and scans, in addition: `features/analyst-dashboard/**`, `features/reports/**` (with `report-copy.json`), `features/home/**`, `features/quick-find/**`, `features/risks/risk-register.tsx`, `features/risks/risk-register-filters.tsx`, `app/(app)/app/risks/page.tsx`, `components/shell/**`, `config/navigation/**`, `components/states/states.tsx` and both `not-found.tsx` files. It adds `workspace` to its terms (identifiers such as `AdministrationWorkspace` are not copy and are not scanned).

### 11.3 Instants in the viewer's time zone (X-3)

| Surface | Value | Rendering |
|---|---|---|
| Requests queue `Submitted` | `submittedDate` | `LocalInstant` date (`27 Sept 2026`) |
| My requests `Updated` | `updatedAt` | `Updated {LocalInstant date}` |
| Requestor Home | returned-to-draft date, `Released {date}` | `LocalInstant` date |
| Analyst Home `Recent activity` | `occurredAt` | `LocalInstant` date, `<time dateTime>` kept |
| Risk assessments `Released` (analyst) | `approvalDate` | `LocalInstant` date |
| My risk assessments `Released` | `approvalDate` | `LocalInstant` long date (`27 September 2026`), as the list formats it today |

Calendar dates stay zone-free: due, target and review dates, the reports' as-at dates and month buckets. Alerts show calendar dates only and do not change.

---

## 12. Five-state contract

| Surface | Loading | Empty | Error | Permission | Populated states added |
|---|---|---|---|---|---|
| Sidebar and drawer | a count is absent until its read settles; no placeholder | a section with no visible item does not render | a failed count shows no badge | items gated by capability; route gates unchanged | profiles, sections, counts, collapsed own section |
| Header search control | — | — | — | not rendered without `assessment-request:read` | hint after mount |
| Quick find | skeleton rows after 300ms; pending opacity while refining | hint below 2 characters; `No matches for “{term}”` | per-group line with `Retry search`; all failed | lists outside the viewer's capabilities are never asked | groups, totals, `Show all` |
| Requestor Home | three section skeletons | first-use and cleared per section (§5.2) | page and section errors (§5.2, §5.4) | `You don’t have access to your requests` · `Return to sign in` | sections; partial fixture |
| Analyst Home | tile and widget skeletons | the empty fixture: zero rows and cleared widgets | page and widget errors | `You don’t have access to the review summary` · `Return to sign in` | new order, own requests, exposure split |
| Request pages | unchanged | unchanged | unchanged | Phase 10 gate unchanged | compact stepper, holder wording |
| Requests queue | nine-column skeleton | unchanged patterns | unchanged | unchanged | columns, cards, sorting, `All requests` |
| Risk assessments, My risk assessments | seven- and four-column skeletons | unchanged | unchanged | unchanged | new columns, overall rating filter, date chips |
| My requests | six-column skeleton | unchanged; `Clear filters` clears `Show` | unchanged | unchanged | `Next step` column, `Show` filter |
| Risk register | unchanged | unchanged | unchanged (`the Risk register`) | unchanged (`the Risk register`) | stage and accepted markers, new filters |
| Reports | unchanged | new `No Risks under assessment`; renamed cleared states | unchanged | unchanged | figure links, five exposure tiles, the new section |

The `design-contract.spec.ts` state matrix and the conformance type scan stay green: every new text element uses a §3.10 pair (Typography).

---

## 13. The premium experience bar (G-4), item by item

| G-4 item | Phase 11 contract |
|---|---|
| A keyboard path for every primary action | Links and buttons throughout; `Ctrl+K` / `⌘K` and the combobox keys (§4.5); the section button and the stepper disclosure take `Enter` and `Space`; no hover-only control |
| Optimistic feedback that rolls back on error | No mutation ships in this phase. Local toggles (the section, the disclosure) change at once; quick find drops a stale result instead of applying it (D-50) |
| Skeletons while loading | Both Homes, quick find (after 300ms), the lists' widened skeletons; counts never show a placeholder or a spinner |
| Undo instead of confirmation for reversible actions | No reversible destructive action and no new confirmation in this phase |
| Confirmations for governance-significant steps | None added; Phase 10's leave warning guards quick find and the sidebar (§1.5, §4.6) |
| Empty states that say what to do next | Home first-use offers `New request`; cleared sections say what will appear; quick find says what is searched; filtered lists keep `Clear filters` |
| No lost input | Quick find keeps the last term for the session; filters live in the URL; the leave warning protects unsaved answers |
| Comfortable and compact density | Every list keeps the DataTable density toggle, including the nine-column queue |
| Motion from the direction | Dialog and sheet per §5; section and disclosure swap icons with no transition; reduced motion honoured |
| Purpose-built phone layouts | Home's action panel first; two-column tiles; compact stepper; quick find as a full-screen sheet; list cards with the triage fields; the collapsed own section in the drawer |
| Every figure opens its records | §8, with the zero, sum and control-implementation rules stated |

---

## 14. Test assertions this contract changes

Each plan greps its strings before editing and changes these assertions deliberately, in the same plan as the behaviour (D-56). Line numbers are today's; Phase 10 edits several of these files first, so each plan re-reads them. Playwright name matching is a case-insensitive substring unless `exact: true`, so many non-exact assertions on renamed labels stay green (§14.4). "Plan" follows the research's proposed grouping.

### 14.1 End-to-end

| # | Spec:line | Asserts today | Change | Plan |
|---|---|---|---|---|
| E1 | `helpers/navigation.ts:17`; `analyst-insights.spec.ts:95`; `app-shell.spec.ts:29`; `design-contract.spec.ts:47`; `design-system-conformance.spec.ts:70, 78`; `production-hardening.spec.ts:182` | Sign-in proves the shell by the level-one `Dashboard` heading | The level-one `Home` heading (`exact: true`) and the role in the banner, as before | 11-02 |
| E2 | `design-system-conformance.spec.ts:177-180` | The ordinary server's `Dashboard` heading | `Home` (`exact: true`) | 11-02 |
| E3 | `accessibility.spec.ts:48, 357-358`; `performance.spec.ts:95-96, 120-121`; `production-hardening.spec.ts:453, 478, 506` | `/app` as `Dashboard`; `/app/review` as `Analyst dashboard` | `/app` is `Home \| IdamBox CSRM` / `Home` for both actors; the `/app/review` rows become the analyst Home at `/app`, and the redirect is proved separately (307, then `Home`) | 11-02 |
| E4 | `accessibility.spec.ts:71`; `analyst-insights.spec.ts:77` | A Requestor at `/app/review` sees `You don’t have access to the analyst dashboard` | A Requestor at `/app/review` lands on their Home (redirect); the refusal row goes | 11-02 |
| E5 | `analyst-insights.spec.ts:466-470, 485-486, 582, 608-612, 636` | The `Analyst dashboard` item, heading and title; the item not current on a queue | Home at `/app`; the `Home` item current; `/app?__e2eState=populated&__e2ePartial=analyst-top-alerts-error` | 11-02 |
| E6 | `analyst-insights.spec.ts:172-180, 477` | h2 order `Needs action`, then seven widgets | `Needs action`, `Review queue`, `Treatments due`, `Upcoming due dates`, `Top alerts`, `Risk exposure`, `High and Critical residual Risks`, `Recent activity`, `Your own requests` | 11-02, 11-09 |
| E7 | `accessibility.spec.ts:429, 485, 497`; `administration-workflow.spec.ts:96`; `analyst-insights.spec.ts:710`; `app-shell.spec.ts:9`; `assessment-navigation-lifecycle.spec.ts:194, 229`; `design-contract.spec.ts:201`; `design-system-conformance.spec.ts:119, 123, 508, 511` | `Return to workspace` | `Go to Home` | 11-02 |
| E8 | `analyst-insights.spec.ts:203-208, 289, 291, 314-319, 654`; `administration-workflow.spec.ts:86, 111`; `design-system-conformance.spec.ts:286` | Groups `Reports` and `Administration` | Sections `Oversight` and `Reference data`; `:314` `toHaveText(['Alerts', 'Reports'])` becomes the section's three items read by name | 11-03 |
| E9 | `analyst-insights.spec.ts:696-700` | Requestors see `Workspace`; no `Analyst dashboard` | `Home`; no `Analyst dashboard`; no `Oversight` section | 11-03 |
| E10 | `accessibility.spec.ts:49-56, 77-80, 412-418, 420, 441, 449-450, 470-473, 682, 690`; `performance.spec.ts:99, 129`; `production-hardening.spec.ts:454-457, 479, 481, 483, 485, 507, 577` | Exact titles and headings `My Requests`, `New assessment request` / `New Request`, `My Questionnaires`, `My Risk Assessments`, `Assessment request review` / `Assessment Request Review`, `Questionnaire Review`, `Risk assessment review` (list) / `Risk Assessment Review` (list), `Risk Register` | The §2.1 headings and titles; detail rows (`:300`, `:306`, `:345`, `:419`, `:480`, `:482`, `:484`, `:689`, `performance.spec.ts:124`) stay | 11-03 |
| E11 | `questionnaire-workflow.spec.ts:276`; `analyst-insights.spec.ts:520`; `assessment-release-workflow.spec.ts:113` | Non-exact list headings `Questionnaire Review`, `Assessment request review` | `Questionnaires`, `Requests` | 11-03 |
| E12 | `assessment-release-workflow.spec.ts:108`; `questionnaire-generation-workflow.spec.ts:90`; `analyst-insights.spec.ts:485` | Exact `Assessment Requests` link | `/^Requests\b/` (the count joins the name, research Pitfall 5); `openFromNavigation` accepts a pattern | 11-03, 11-10 |
| E13 | `analyst-insights.spec.ts:203-208, 289` | Exact `Alerts` link | `/^Alerts\b/` once the overdue count joins its name | 11-10 |
| E14 | `accessibility.spec.ts:216-219` (`lifecycleDashboard`); `requestor-request-workflow.spec.ts:307-325`; `performance.spec.ts:95-96`; `assessment-release-workflow.spec.ts:282` | Seven lifecycle cards; `Draft requests`; `Questionnaires in progress`; `Recently released assessments` | The Requestor Home sections (§5.2): `Needs your action` region with its items, `Released assessments` | 11-09 |
| E15 | `design-system-conformance.spec.ts:186-197` | Partial `draft-requests-error` on `Draft requests` | `requestor-home-with-analyst-error` on `With the Security Analyst`; siblings `Needs your action` and `Released assessments` stay visible | 11-09 |
| E16 | `design-system-conformance.spec.ts:278-282` (**new, research missed it**) | As the Security Analyst on `/app`, the `{rating} released assessments: {n}` count cells' type | Sign in as the Requestor for these repair points and read the rating chip links named `{Rating}: {n} released risk {assessment\|assessments}` | 11-09 |
| E17 | `design-system-conformance.spec.ts:120-122` (**new**) | `/app` recovers with `View My Requests` (error) and `Return to sign in` (permission) | Error recovers with `Try again`; permission keeps `Return to sign in` | 11-09 |
| E18 | `request-relationship-states.spec.ts:152` (375); `questionnaire-governance-workflow.spec.ts:113, 157` (1440) | `getByText(/^Next action:/)` resolves one element | Two render (one hidden per width): scope to the lifecycle section at 375 and the `Request summary` section at 1440, or filter `{ visible: true }` | 11-07 |
| E19 | `assessment-navigation-lifecycle.spec.ts:253, 259, 288` | Status options and chip `Approved` | `Released`; `Status: Released` | 11-01 |
| E20 | `risk-register-workflow.spec.ts:376` | `Search and manage contextual Risks across authorised assessments.` | The §11.1 description | 11-11 |
| E21 | `analyst-insights.spec.ts:326-335` | The Critical residual tile opens `residualRating=Critical&state=open` | The URL also carries `stage=released`; equality kept | 11-12 |
| E22 | `analyst-insights.spec.ts:500-509, 594`; `design-system-conformance.spec.ts:219` | Row name `/^Critical: [\d,]+ open Risks? by residual rating$/`; list `Open contextual Risks by residual rating` | `/^Critical: [\d,]+ released open Risks? by residual rating$/`; `Released open Risks by residual rating`; the row's URL carries `stage=released` | 11-12 |
| E23 | `analyst-insights.spec.ts:535-543` | `Open Risk Register` lists every open Risk sorted | `View Critical Risks` and `View High Risks`; the membership check reads the two lists | 11-12 |
| E24 | `analyst-insights.spec.ts:36-66` | Risk exposure `tiles: 3` and three table sections | `tiles: 5`; sections add `Under assessment` | 11-12 |
| E25 | `requestor-request-workflow.spec.ts:299` (**new**) | `getByRole('button', { name: 'Search' })` on My requests | The header control is also named `Search`: scope to `main` | 11-14 |
| E26 | `app-shell.spec.ts:33-54` | No overflow and the `Menu` path at six widths | Stays green with the search control (a check, not an edit) | 11-14 |

### 14.2 Unit

| File:line | Change | Plan |
|---|---|---|
| `src/lib/testing/e2e-sign-in-assertions.test.ts:17` | `DASHBOARD_HEADING` pins `'Home'` (research Pitfall 6) | 11-02 |
| `src/lib/performance/zod-client-boundary.test.ts:117` | The `(analyst-dashboard)` route row goes; the carried item extends the table to every route | 11-02 |
| `src/lib/testing/e2e-ui-state-route-authorization.test.tsx:52, 100, 126, 172` | Imports the analyst Home content from its new module; proves a Requestor at `/app` issues no analyst read, fixture or partial | 11-02 |
| `src/components/shell/mobile-navigation.test.tsx` (whole file) | Profiles, sections, counts, the collapsible section, the primary action | 11-02, 11-03 |
| `src/components/states/states.test.tsx:19-20, 31, 37, 61`; `src/lib/security/root-fallbacks.test.tsx:25`; `administration-workflow.test.tsx:293`; `alert-list.test.tsx:295`; `alerts-page.test.tsx:109`; `analyst-dashboard.test.tsx:484, 489, 520`; `reports-pages.test.tsx:196`; `request-routes.test.tsx:98, 125` | §2.4 copy | 11-02 |
| `analyst-dashboard-presentation.test.ts:71`; `analyst-dashboard.test.tsx:50` | The retired title and description | 11-02 |
| `questionnaire-workflow.test.tsx:254` | `View my requests` → `View My requests` | 11-03 |
| `status-badge.test.tsx:62, 234`; `feedback-composites.test.tsx:49`; `assessment-list.test.tsx:68, 171, 183, 236`; `assessment-status-filters.test.tsx:177`; `report-presentation.test.ts:304`; `report-views.test.tsx:524` | `Approved` → `Released` | 11-01 |
| `assessment-list.test.tsx:198-199` | `Search assessment requests` → `Search by number or title` | 11-04 |
| `request-lifecycle-stepper.test.tsx:42, 46` | The stepper now holds the compact next action (hidden from 768px) | 11-07 |
| `request-hub.test.tsx:86-88` | Fixture sentence only; update to a §6.1 sentence | 11-06 |
| `requestor-dashboard.test.tsx` (whole file) | Rebuilt as Requestor Home tests | 11-09 |
| `report-presentation.test.ts:133, 139-141, 221, 231`; `report-views.test.tsx:174, 282-287, 303-317, 333-334, 352, 371, 382-399, 441-451`; `report-service.test.ts:37, 40`; `reports-pages.test.tsx:135, 140, 434, 514-516`; `report-schema.test.ts:63` | "contextual", `Control Implementations`, the five exposure tiles and new section, the 14-day window (fixture data may keep 30, research Pitfall 10) | 11-12, 11-13 |
| Strapi `analyst-insights.unit.test.ts:166`; `analyst-reports.integration.test.ts:683-706` | The window constant and its boundary fixture move to 14 | 11-12 |

### 14.3 Conformance and design-contract suites

- `design-system-conformance.spec.ts:16-24, 36, 255-257`: `/app/review` leaves `phase7AuditedRoutes`; `/app` joins as the analyst (four tiles, type scan, five states). 11-02.
- `design-system-conformance.spec.ts` type scan on `/app` (both actors) and the report routes: the count badge, the shortcut hint and group headings use `--text-micro`; `Step {n} of {m}` and options use `--text-body`; captions `--text-caption`. No edit; a new element outside §3.10 fails it.
- `design-contract.spec.ts:30` (`dashboard record links` at `/app` as the analyst): the analyst Home keeps visible `RecordLink`s (High and Critical rows, Recent activity). No edit.

### 14.4 Assertions that must stay green

`Current lifecycle state: …` headings (`assessment-navigation-lifecycle.spec.ts:61, 197`, `questionnaire-governance-workflow.spec.ts:112, 142, 156, 198`); `Request summary` and `Request context`; the `Close navigation` initial focus and `Menu` focus return (`app-shell.spec.ts:56-65`); the skip link then `Menu` (`assessment-release-workflow.spec.ts:102-104`); `Questionnaires` exact link in the drawer (`:106`); non-exact `My Requests`, `My Questionnaires`, `Risk Register`, `Risk Register filters`, `Risk Register results` and `You don’t have access to the Risk Register` (`requestor-request-workflow.spec.ts:144, 152, 156, 289`; `questionnaire-workflow.spec.ts:166-167, 172, 314`; `questionnaire-generation-workflow.spec.ts:69`; `administration-workflow.spec.ts:110`; `risk-register-workflow.spec.ts:100, 234, 244, 373, 646`; `analyst-insights.spec.ts:334, 508`), which match case-insensitively; `openFromNavigation(page, 'New request')` as the Requestor at 375 (`questionnaire-generation-workflow.spec.ts:70`), because the primary action is a link inside `Primary navigation` in the drawer (UI-D5); the detail titles and editor headings in E10's list; `the navigation sheet scrolls at 375×667` (`analyst-insights.spec.ts:280-300`, whose group names change under E8).

---

## Copywriting contract

| Element | Copy |
|---|---|
| Primary CTAs (new or renamed) | `New request` (sidebar primary action; Requestor Home header, was `Create request`) |
| Other calls to action | `Go to Home`; `Go to My requests`, `Go to My questionnaires`, `Go to My risk assessments`; `View My requests`; `View all {n} in My requests`, `View all {n} in My risk assessments`; `Show all {n} in {list}`; `Show all steps` / `Hide all steps`; `View Critical Risks`, `View High Risks`; `Retry search`; `Clear search`; `Close` (quick find, phone); `Return to sign in` (Home permission) |
| Navigation labels | §1.1; section labels `My work`, `Assessment work`, `Oversight`, `Reference data`, `My own requests` |
| Empty states | Locked patterns kept. New: `No requests yet` (with `New request`), `No requests waiting for you`, `No requests with the Security Analyst`, `No released risk assessments yet`, `No released open Risks`, `No released High or Critical residual Risks`, `No Risks under assessment`, `No mitigation controls`, `No matches for “{term}”`, the quick-find hint |
| Error states | Locked pattern `We couldn’t load {noun}` with `Try again`; new nouns `your requests`, `the review summary`, `requests waiting for you`, `requests with the Security Analyst`, `released assessments`, `your own requests`, `this page`; quick find's `We couldn’t search {list} just now.` and `Search isn’t available right now.` with `Retry search` |
| Permission states | `You don’t have access to your requests`, `You don’t have access to the review summary`, `You don’t have access to the Risk register`; the shared description (§2.4) |
| Destructive confirmations | None in this phase. Phase 10's `Leave this questionnaire?` → `Leave questionnaire` guards navigation from the sidebar and quick find, unchanged |
| Holder wording | §6.1 sentences; list labels `Needs your action`, `With the Security Analyst`, `No action needed` |
| Scope wording | `Released Risks only.`, `Includes Risks under assessment.`, `Not yet released, so not counted above.` |
| AI output | No AI surface changes. A generated draft's activity phrase (`draft generated for Security Analyst review`) is unchanged; nothing here releases anything |

---

## Accessibility contract (WCAG 2.2 AA)

| Concern | Contract |
|---|---|
| 1.3.1 Info and relationships | Sections are named `role="group"`s; the own section's button controls its group; Home sections and widgets are `section`s named by their `h2`; quick find groups are listbox groups named by their headings; tables keep `th scope` |
| 2.1.1 Keyboard | §4.5; the section and disclosure buttons; every figure link; no hover-only control (§6 do-not 11) |
| 2.4.3 Focus order | DOM order equals visual order on both Homes at every width (D-22); quick find's open, close and navigation focus rules (§4.5, §4.6); the disclosure keeps focus |
| 2.4.4 Link purpose | Figure links carry names that say what they open (§8.1); `View all {n} in {list}` names its list |
| 2.4.6 Headings | Home `h1` `Home` > `h2` sections > `h3` state headings; request pages keep `h2` `Current lifecycle state: …`; quick find's title is the dialog's `h2` |
| 2.4.11 Focus not obscured | The sticky header is offset by the existing `scroll-padding-top`; the quick-find dialog sits below the header |
| 2.5.3 Label in name | Count badges, figure links, rating chips and the search control are named by content starting with the visible words; `Close search` and `Clear search` extend visible `Close` and an icon |
| 2.5.8 Target size | Nav items 36px; the primary action, section button, disclosure, `Search` icon button and quick-find options meet the touch-target height below 768px |
| 3.2.3 Consistent navigation | One profile per actor, the same in the sidebar and the drawer; labels equal headings |
| 4.1.2 Name, role, value | Combobox, listbox, options and `aria-activedescendant` from cmdk; `aria-expanded` on the section button, the disclosure and the search control; `aria-keyshortcuts` |
| 4.1.3 Status messages | Quick find's one polite region (§4.4); counts are not announced; nothing else in this phase is live |
| 1.4.1 Use of colour | Counts are numbers with named meanings; stage and accepted are words; ratings keep their badges; criticality is text |
| 1.4.10 Reflow | No horizontal page scroll from 320 to 1440; the header's role tag may truncate below 375px (UI-D10); wide tables scroll only inside their labelled regions |
| Automated | Zero serious or critical axe violations at 375 and 1440 on both Homes, the sidebar and drawer, quick find open, the request pages with the compact stepper, the four lists and the four reports |

---

## Spacing

The §3.9 scale and layout tokens apply unchanged. This phase adds no spacing value. New layout uses only these steps, all multiples of four and all in the 4, 8, 16, 24, 32, 48 set:

| §3.9 step | Use in this phase |
|---|---|
| 4px | The shortcut hint key's horizontal padding (X-7); icon-to-text gaps in options |
| 8px | Between the search control and the role tag; between the compact stepper's heading, step line and next action; between an option's two lines |
| 16px | Before the stepper disclosure; section padding inherited by the Home widget frame |
| 24px | Between Home sections (the grid gap tokens, as the analyst dashboard today) |
| 32px | Between the analyst Home's tile strip and its widget grid (as today) |
| 48px | Quick find's offset below the header (X-8) and its list's bottom clearance |

Existing primitives keep their shipped internal spacing (the sidebar's section rhythm, the neutral tag's padding, the DataTable's cells); this phase declares none of it. Exceptions: none.

---

## Typography

The §3.10 scale applies unchanged: families, sizes, line heights, tracking and weights 400, 500 and 600. This phase adds no size, weight or family.

| Emphasis level | Token | Weight | Phase 11 use |
|---|---|---|---|
| 1. Panel title | `--text-heading-sm` | the token's own heading weight | Home section and widget titles, the stepper heading (UI-D24), the quick-find title on phones |
| 2. Body and labels | `--text-body` | 400; 500 for item titles, the `Next action:` lead, `Step {n} of {m}`, `No matches for …` | quick-find options and hint, next-step sentences, Home items |
| 3. Caption | `--text-caption` | 400; 500 for the questionnaire progress and the full list's `Step {n}` labels | secondary lines, stage and accepted markers, notes, the quick-find footer |
| 4. Micro-label | `--text-micro` (IBM Plex Mono, uppercase by CSS) | 400 | section labels, the count badge, shortcut keys, quick-find group headings, the `Next step` holder line |

Four text sizes carry every new element. The page title (`--text-heading-lg`), KPI values (`--text-display`), table body (`--text-table`) and button labels (`--text-button`) belong to shipped primitives and are unchanged. The GSD checker's "at most four sizes and two weights" heuristic holds for sizes; for weights it is superseded by the adopted scale (ADR 0001 gap 8; §3.10 gives headings their own weight), as in Phases 06.5, 07, 08 and 10; this phase adds no weight. No uppercase outside `--text-micro`; the serif never below the page-title size; `tabular-nums` on every count and age.

---

## Color

| Role | Tokens | Usage |
|---|---|---|
| Dominant (60%) | `--color-bg-page`, `--color-bg-surface` | canvas, Home cards, lists, the quick-find dialog and sheet |
| Secondary (30%) | `--color-bg-inset`, `--color-border-default`, `--color-border-strong`, `--color-text-secondary`, `--color-bg-sidebar` with its on-dark tokens | the active option, hairlines, field boundaries, captions and holder lines, the sidebar and drawer |
| Accent (10%): ink | `--color-primary`, `--color-text-link`, `--focus-ring`, `--focus-ring-inverse` | only as listed below |
| Status (§3.5) | success (the `Released` request badge, unchanged tone), danger and warning (urgency badges, unchanged) | always with an icon and words |
| Severity (§3.6) | `--color-risk-*` | `RiskRatingBadge` in lists, chips and quick find text lines; exposure and under-assessment bars (their `fg` token) |
| Destructive | `--color-danger-solid` | none in this phase |

Ink is reserved for: the Requestor Home's `New request` header button and the lists' `Search` submit buttons (primary), record links and figure links with their underline, focus rings, and the sidebar's current-item bar. The sidebar primary action is light-filled on the dark sidebar (`--color-bg-page`), never ink. The header search control, the disclosure, `Show all`, `Retry search`, `Close` and `Clear search` are outline or ghost. Business criticality and stage are text. No new hue.

---

## Motion

| Interaction | Token (§3.11, §5) |
|---|---|
| Quick find open and close | the shipped `Dialog`, per the §5 "Dialog / toast" row; the phone sheet the same, fading only under reduced motion |
| Navigation drawer | unchanged (§5 "Drawer / side panel") |
| Current nav item bar | unchanged (§5 "Tab / nav active indicator") |
| Sidebar primary action hover | §5 "Button / link-card hover": 1px lift, shadow change, no recolour |
| Section button, stepper disclosure | none: icons swap and the content appears |
| Counts, stage and accepted markers | none: text in place |
| Quick-find pending results | the §5 Optimistic UI pending opacity, applied with no transition |
| Skeleton shimmer | §4 Skeletons; static under reduced motion |

Nothing auto-advances or polls (§6 do-not 9). Reduced motion needs no rule beyond the global one.

---

## Proposed CSRM extensions

For the orchestrator to accept and record in `docs/design/csrm-design-direction.md` before implementation. A plan task records each accepted extension. None introduces a value; each names a pattern over existing tokens. Numbering continues after Phase 10's X-5 (UI-D41).

| # | Where | Proposal | Exact wording to record | Rationale |
|---|---|---|---|---|
| X-6 | §4 AppShell / sidebar | Sidebar sections, counts and primary action | "**Sidebar sections, counts and primary action (CSRM extension, 2026-09-28).** Navigation is grouped into sections named by job. A section label is `--text-micro` in `--color-text-inverse-muted` above a `--color-border-on-dark` divider; the top section, holding Home, has no label. A section of personal or occasional work may collapse: its label row is a button of the nav item height with a 16px `ChevronRight` (collapsed) or `ChevronDown` (expanded) before the label, `aria-expanded` and `aria-controls`, the item hover fill and `--focus-ring-inverse`; it opens itself when the current page is one of its items, and its state is never persisted. A count on an item that holds work is the neutral tag on the sidebar at the item's end, `tabular-nums`, in the item's text colour; a zero, a failed read or a refused read shows no count, and the count with what it counts is part of the link's accessible name. A collapsed section's label row shows its items' count. An actor's primary action sits first in the navigation as a full-width light-filled pill: `--color-bg-page` fill, the label in `--color-text-primary` at `--text-button` with a 16px icon, `--shadow-button-light`, lifting 1px to `--shadow-button-light-hover` on hover; it never recolours." | D-06 to D-12 need sections, counts, a collapsible section and a button on the dark sidebar; the direction names only labels, dividers and the light button's shadows. |
| X-7 | §4 Buttons | Keyboard shortcut hint and the header search control | "**Keyboard shortcut hint (CSRM extension, 2026-09-28).** A control with a keyboard shortcut may show it after its label as keys: each key a `kbd` in `--text-micro` and `--color-text-secondary`, with a 1px `--color-border-default` boundary, `--radius-sm` and 4px horizontal padding. The hint is `aria-hidden`, the control carries `aria-keyshortcuts`, the hint names the viewer's platform (`⌘` on Apple devices, `Ctrl` elsewhere) and renders after mount, and it is not shown below 768px. The header's search control sits beside the role indicator: from 768px an outline pill with a 16px `Search` icon, its visible label and the hint; below 768px an icon-only circle at the touch-target size. Its accessible name is its label at every width." | D-15 and D-47 add the only header control since the role tag; no shortcut presentation exists. |
| X-8 | §4 Dialogs | Quick find | "**Quick find (CSRM extension, 2026-09-28).** A command dialog for finding records. From 768px it is the form size (640px), horizontally centred and anchored `--spacing-header-h-md` plus 48px below the top of the viewport, so its top edge never moves as results arrive; its list scrolls within the remaining viewport height less 48px. Below 768px it is a full-screen sheet with a visible title row and a Close control. The input row (a 16px `Search` icon, the input at `--text-body`, and a Clear control while it holds text) sits above a `--color-border-default` hairline and shows the focus ring while focused. Results are grouped under `.micro-label` headings with their totals; an option is two lines (`--text-body`, then `--text-caption` in `--color-text-secondary`), at least the touch-target height below 768px, and the active option is `--color-bg-inset`. From 768px a footer row shows the keys that move, open and close as keyboard shortcut hints. Loading rows are skeletons after 300ms; while a newer search runs, the previous results stay at the §5 pending opacity." | D-48 and D-53 settle behaviour; the direction has dialog sizes but no command-dialog layout. |
| X-9 | §4, new "Lifecycle stepper" entry | Compact lifecycle stepper | "**Compact lifecycle stepper (CSRM extension, 2026-09-28).** Below 768px a lifecycle stepper keeps its heading and shows, in order: `Step {n} of {m}` in `--text-body` at 500 with `tabular-nums`, the next action, and an outline disclosure button at the touch-target height, `Show all steps` or `Hide all steps`, with a `ChevronDown` or `ChevronUp` swapped with no transition, `aria-expanded` and `aria-controls`, which reveals the full ordered list below it. From 768px the full stepper shows and the compact lines do not. The next action is displayed once per width." | D-26; UAT-038 measured the eight stacked steps at 880px. |
| X-10 | §4 Record links | Figure links | "**Figure links (CSRM extension, 2026-09-28).** A figure that opens the records behind it is a link whose list total equals the figure. A tile or a row is one block link (§4 Cards, block links); a figure in a table or a chip is a text link with the record-link treatment on the figure alone, right-aligned with `tabular-nums` like any numeric cell. A figure of zero in a table or a chip is plain text. A sum of linked parts stays plain. A row header may link to the records its row describes when its figures cannot, and its name says so. Each link's accessible name begins with its visible figure or label, then says what it counts." | D-35 to D-39 extend linking into report tables and chips, where the direction defines only tiles and block links. |

---

## Decisions recorded

Made without asking, as this phase's discussion and UI contract run in auto mode. Each follows the locked context, `AGENTS.md` and the direction.

| # | Decision | Reason |
|---|---|---|
| UI-D1 | Copy names a page by its heading, in the heading's casing (`Go to Home`, `Go to My requests`). | One name per page (D-09); a person scanning the sidebar finds the words the copy used. |
| UI-D2 | `Go to Home` replaces `Return to workspace` and `Back to workspace`; the generic states read `Loading…` / `Getting this page ready.` and `We couldn’t load this page`. | D-25 retires "workspace"; D-25 leaves the generic defaults to this contract, and a default that names no page is always true. |
| UI-D3 | One Home description for both actors. | The route's `loading.tsx` can then render the final header exactly, so the title never shifts. |
| UI-D4 | Keep `/app/loading.tsx` with the header only; each variant's skeleton renders inside the page's Suspense boundary. | Retiring it would show the `(app)` spinner state first; a header-only boundary mirrors the final layout (research Pitfall 2). |
| UI-D5 | The Requestor's `New request` action is the first element inside `Primary navigation`. | It is navigation; `openFromNavigation` finds it at both widths; the drawer renders it through the same component (D-12). |
| UI-D6 | Counts use the sidebar's neutral tag and carry their meaning in visually hidden text inside the link. | Reuses §4 Tags and chips; the meaning is in the name (D-10) without a second visible word per item. |
| UI-D7 | The own section opens itself on its own routes, including on client navigation, and never closes itself. | The current item is never hidden (D-08); the person's choice to open it is kept. |
| UI-D8 | Default prefetch for frequent destinations; intent prefetch for `Reference data`; none for the collapsed section. | Weighs the carried 176 KB against instant navigation; phones pay nothing because the sidebar is not rendered below 1024px. |
| UI-D9 | The header control is named `Search` from its content at every width; the hint is `aria-hidden`; `aria-keyshortcuts` names both shortcuts. | D-47 names it `Search`; content naming keeps Label in Name exact (research Pitfall 5). |
| UI-D10 | The role tag may truncate below 375px only. | With the new control the header needs about 360px at the longest development role; WCAG reflow is judged at 320px. |
| UI-D11 | Quick-find groups mirror the sidebar's lists, in its order and with its labels; no cross-group removal of duplicates. | Research Open Question 3; a result's group tells the person which page it opens. |
| UI-D12 | Quick find keeps the last term for the page session and shows it selected on reopen. | G-4 "no lost input"; typing still replaces it at once. |
| UI-D13 | `Escape` returns focus to where it was; opening a result sends focus to the header `Search` control. | APG dialog; after navigation the previous element may be gone, and the header control persists across routes. |
| UI-D14 | While a newer search runs, the previous results stay at the pending opacity and remain openable. | No flash of an empty list; each result is still a real record (D-50 drops only stale results). |
| UI-D15 | `Show all {n} in {list}` only when a group holds more than five. | The five shown are otherwise everything. |
| UI-D16 | The Requestor Home reuses the analyst Home's widget frame. | One visual system across both Homes; a proven accessible frame. |
| UI-D17 | A Home item's title opens the request; its next step is a separate link only when it leads elsewhere (the questionnaire). | Avoids two adjacent links to one place for keyboard users. |
| UI-D18 | `Needs your action` distinguishes first use (`No requests yet` with `New request`) from cleared (`No requests waiting for you`). | §4 Empty states types; one call to action on an empty Home. |
| UI-D19 | Home's permission state offers `Return to sign in` for both variants; Home errors offer `Try again`. | `Go to Home` would loop; a failed read is retried in place. |
| UI-D20 | The analyst Needs action tiles use two columns below xl. | At 375px four stacked tiles push the queue below the first screen (D-57). |
| UI-D21 | Analyst widget order per D-18, with `Your own requests` last in the left column from lg. | D-18's order; `Recent activity` keeps its full width (Phase 7). |
| UI-D22 | The hub and stepper keep the `Next action:` lead; the served sentence names the holder; `holder` decides link or text, never the words. | Stable across both actors and Phase 10 §12.3; the sentence already says who (D-27). |
| UI-D23 | One next action is displayed per width: the compact stepper below 768px, the hub from 768px. | D-26 and research Pitfall 7; 06.8 D-10 keeps the hub's line from 768px. |
| UI-D24 | The stepper heading uses `--text-heading-sm` at every width and the step labels `--text-caption` 500. | Today's 18px and 12/600 are off the §3.10 scale; the compact stepper must use tokens. |
| UI-D25 | My requests' holder line and `Show` filter use `Needs your action`, `With the Security Analyst`, `No action needed`. | The Home's section names; one vocabulary from Home to list. |
| UI-D26 | The queue's search is labelled `Search by number or title`. | D-30 makes the number searchable; the label says so. |
| UI-D27 | Business criticality is plain text. | D-29: a business attribute, not a risk rating. |
| UI-D28 | `Age` reads `{n} days` including `0 days` and is not sortable; `Submitted` sorts. | The server sorts by submitted date; sorting both would duplicate one order. |
| UI-D29 | My risk assessments shows `Request title` in place of `Summary`. | D-31 adds the projection; the title identifies the request, as on the analyst list. |
| UI-D30 | The released-date range shows only as chips. | Only figure links set it; the chips keep a filtered list distinguishable and removable. |
| UI-D31 | Zero figures in tables and chips are plain; tiles and Home rows link at any value. | Fewer dead-end tab stops in dense matrices; Phase 7's tiles and rows unchanged. |
| UI-D32 | The control implementation tile links with a supporting line that says it opens the Risks; the tables' figures stay plain and their row headers link to `View the Risks with …`. | D-36; a table figure link named for Risks would not contain its own figure (WCAG 2.5.3), while a tile's name is its whole visible content. |
| UI-D33 | "mitigation controls" replaces "Control Implementations" in the report and Home copy this phase rewrites. | Phase 10's voice rule; those strings change anyway under D-54. Approved by the orchestrator on 2026-09-28: "mitigation control" is the established display term for a Control Implementation (Phase 7 contract, Phase 10 D-28 and D-33, the Risk Register's save messages). The JDL name stays in the data model and API, and the change is limited to strings this phase rewrites. |
| UI-D34 | Accepted is a secondary link after each exposure row; under assessment is its own link row below the chart. | Each figure opens its own list (D-35) without nesting links. |
| UI-D35 | The exposure report gains `Accepted` and `Under assessment` tiles, an `Accepted` column and an `Under assessment` section. | D-42's contract fields, each shown once and linked. |
| UI-D36 | Stage shows under the Related assessment link; `Accepted` under the treatment status badge. | Stage belongs to the assessment; accepted belongs to the treatment decision; no ninth column. |
| UI-D37 | Visible "Risk Register" becomes "Risk register"; non-visible accessible names keep their wording. | Casing is not heard; avoids churning exact locators for no user gain. |
| UI-D38 | Report KPI strips use two columns on phones; the exposure strip has five columns from xl. | Purpose-built phone layout (G-4); five tiles need their own row width. |
| UI-D39 | Home and report figures use the X-10 treatment. | One figure-link language across surfaces. |
| UI-D40 | Detail headings, safe-state headings, static detail titles and detail back links are unchanged. | Detail pages are headed by records (research Open Question 2); D-09 governs navigation destinations. |
| UI-D41 | Extensions are numbered X-6 to X-10. | They continue Phase 10's X-1 to X-5, as the planning brief asks. |
| UI-D42 | The phone sheet's dismiss control shows `Close` and is named `Close search`. | It matches the shipped navigation sheet (`Close`, named `Close navigation`); it dismisses and is not a call to action. |
| UI-D43 | The Requestor's primary action never carries `aria-current`; on `/app/requests/new` the Requestor's `My requests` is current by the longest-match rule. | The action is a button, not a navigation item, and it has no current treatment; the analyst's `New request` is an item and is current there. |

---

## Notes carried

- **Zod boundary (carried item).** Extend `zod-client-boundary.test.ts` to every route under `app/(app)`, and move the incidental zod imports out of client modules: the Alerts list, the questionnaire lists and governance view, and the request hub's `assessmentStatuses` import chain. Every new client module here (the navigation and its counts, the header control, the quick-find dialog, both Homes, the compact stepper) reads its vocabularies from zod-free modules; quick find validates its term only in the Server Action.
- **Sign-in rule (carried item).** After plan 11-02 the orchestrator's standing instruction "E2E sign-in helpers assert the Dashboard heading" becomes "the level-one Home heading and the role in the banner".
- **Phase 10 UI-SPEC §17.2.** It names `features/risks/risk-register.tsx` for the Risk Register description; the string lives in `app/(app)/app/risks/page.tsx:13` (with `risks/loading.tsx` and `risks/error.tsx`). §11.1 uses the right files.
- **Phase 10 strings superseded.** §2.3 and §2.4 replace copy Phase 10 introduces; Phase 10's plans need no change, and Phase 11's renaming plans own the assertions.
- **Extension numbers.** Phase 7's contract numbered its own extensions X-1 to X-13, recorded in the direction by name and date, not number. If another phase's contract written in parallel also starts at X-6, the orchestrator renumbers one set before recording.
- **The stepper's step cards** keep their shipped `rounded-xl` corners and the retired `bg-primary-subtle` (which resolves to `--color-bg-inset`) for the current step; neither is in the direction's radius list. Out of scope (D-26: "as today"); a later UI review should move them to `--radius-lg` and the inset token.
- **Shared components extended.** `BarChart` (a secondary link per row) and `ReportTable` (cell and row-header links) change for every caller; existing callers pass nothing new and render as today.
- **Order dependency.** The Requestor Home and the own-requests panel read `GET /v1/my_requests` and the status summary's holder counts, so they follow the contract plan that serves them (research plan 11-08).
- **Detail route titles** remain Title Case (`Assessment Request Review | IdamBox CSRM`); aligning them is a later, deliberate change with its own test churn.

---

## UI Considerations

Produced by the ui-phase consideration probe (`ui-consideration-probe.cjs`, GSD Core 1.15.0) over the 27 surfaces this contract describes. Element kinds were set in auto mode as the union of the kinds the prose cues and the kinds they miss (for example the list kind on the compact stepper's ordered steps and the media kind on the exposure charts). The probe found no unclassified surface. Empty-state and error-state copy lives in the sections cited; this table covers state coverage only.

Applicable state considerations resolved: 167 applicable, 164 covered (explicit), 3 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution |
|---|---|---|---|
| empty | Sidebar; drawer | covered | A section with no visible item does not render; every actor holds `Home`, so no navigation is empty (§1.1) |
| empty | Quick-find input and listbox | covered | Below 2 characters the list shows the hint and the actor's scope line; a completed search with no result shows `No matches for “{term}”` and what is searched (§4.4) |
| empty | Requestor Home sections | covered | First-use and cleared states with §5.2's copy; only `Needs your action` offers `New request` |
| empty | Analyst tiles; own requests; exposure; High and Critical | covered | Tiles and link rows show zero as data; exposure shows `No released open Risks` with the under-assessment row beneath; High and Critical shows its cleared state (§5.3, §9.2) |
| empty | Compact stepper | covered | No lifecycle renders no stepper; a closed request shows the terminal line and no next action (§6.3) |
| empty | Requests queue; Risk assessments lists; My requests | covered | The DataTable's locked first-use and filtered-empty states; `Clear filters` also clears `Show` and the overall rating (§7, §12) |
| empty | Related assessment picker; register filters | covered | The shipped picker's no-match line; the register's filtered-empty state with `Clear filters` |
| empty | Report tables, tiles and the under-assessment section | covered | Sections keep their cleared states; the new section shows `No Risks under assessment` (§9.3); a zero cell is plain text |
| loading | Sidebar; drawer; own-section button | covered | Links render with the layout at once; counts are absent until they settle, never a placeholder (§1.3); the button has no load |
| loading | Header search control | covered | Renders with the shell; its hint appears after mount; hover or focus prefetches the dialog (§3) |
| loading | Quick-find input and listbox | covered | A cold shortcut open shows the frame and a skeleton input row (§4.7); nothing for 300ms, then five skeleton rows; refining keeps prior results at the pending opacity (§4.4) |
| loading | Both Homes and the Home header | covered | The page header renders first; each variant's skeleton mirrors its final grid; the route boundary shows the header only (§5.4) |
| loading | Compact stepper | covered | Part of the request page, whose route skeleton is unchanged |
| loading | Lists; picker; register filters | covered | DataTable skeletons with the new column counts (§12); the picker's shipped searching line |
| loading | Report tables, tiles and section | covered | The report route skeleton and `KpiTileSkeleton`, unchanged |
| loading | `/app/review` redirect | covered | No load of its own: the config redirect answers before any rendering (§5.1) |
| error | Sidebar; drawer; own-section button | covered | A failed or refused count shows no badge, never an error (§1.3) |
| error | Header search control | covered | A dialog-code load failure shows the every-list-failed state with `Retry search` (§4.7) |
| error | Quick-find input and listbox | covered | One failed group beside the others, or the all-failed state, each with `Retry search` (§4.4) |
| error | Both Homes and the Home header | covered | Section and widget compact errors, page errors and the route boundary's `We couldn’t load this page` (§5.2 to §5.4) |
| error | Compact stepper | covered | No failure of its own; the request page's error state is unchanged |
| error | Lists; picker; register filters | covered | The locked DataTable error states with `Try again`; the picker's shipped behaviour |
| error | Report tables, tiles and section | covered | The report's error states, unchanged |
| error | `/app/review` redirect | covered | A fixed destination: no failure state |
| populated | Every list, section, widget, table and the stepper | covered | §1.1 to §1.3, §4.3, §5.2, §5.3, §6.3, §7.1 to §7.4, §8.2, §9.2 to §9.5 fix the populated layout and copy |
| partial | Sidebar; drawer | covered | A count that fails alone leaves the others; each actor sees only their profile's sections |
| partial | Quick find | covered | A failed group sits beside the others; groups with no result are omitted (§4.4) |
| partial | Requestor Home | covered | The partial fixture fails `With the Security Analyst` alone; a returned draft without a reason reads `Returned to draft on {date}.`; only questionnaire items carry progress (§5.2) |
| partial | Analyst Home | covered | A failed widget shows its compact error beside the rest; an accepted link and the `Not rated` row show only above zero (§9.2) |
| partial | Compact stepper | covered | A terminal request shows the terminal line and no next action |
| partial | Lists | covered | `Not recorded`, `Not provided`, `Not rated`, `Not released` and `No Risks yet` per missing value (§7) |
| partial | Picker; register filters | covered | An assessment without a request title reads its number alone (§7.4); a partly released Risk Assessment is in neither stage (research Pitfall 20) |
| partial | Report tables, tiles and section | covered | Zero cells plain; sums plain beside their linked parts (§8.1) |
| overflow | Sidebar; drawer; section button; count badge | covered | Labels are short fixed strings on one line; a count grows with its digits at the item's end; with the own section collapsed the analyst drawer fits 375 × 812 without scrolling (§1.4) |
| overflow | Quick-find listbox | covered | Scrolls within the dialog's viewport-bounded list or the phone sheet (X-8) |
| overflow | Home sections and widgets | covered | Items wrap within their cards; truncated lists say `Showing {shown} of {total}` |
| overflow | Risk exposure widget | backstop | `{ statement: "At 375px each accepted link sits beneath its row’s count and no exposure row overflows its widget", verification: backstop }` |
| overflow | Compact stepper; hub line | covered | One column when expanded; sentences wrap; nothing scrolls horizontally (§6.3) |
| overflow | Requests queue; Risk assessments lists; My requests | covered | The DataTable's labelled scroll region with the sticky identifier column; long-text columns wrap and clamp (§7) |
| overflow | Picker; register filters | covered | The popover listbox at the field's width with wrapping options; the phone sheet scrolls (shipped) |
| overflow | Report tables and the under-assessment section | covered | The matrix scrolls inside its labelled region; row headers wrap (shipped `ReportTable`) |
| overflow | Report KPI tiles | backstop | `{ statement: "At 1024px and 1280px the five Risk exposure tiles wrap into rows of three and then five without clipping a caption, value or supporting line", verification: backstop }` |
| overflow | Page headers and states; the redirect; the Home header | covered | Header actions stack full width below 768px (§4 Page header); fixed copy wraps |
| zero-one-many | Every list, section, widget, group and table | covered | Singular and plural forms are written out (`1 needs attention`, `3 requests`, `1 match`, `0 days`); zero rows render as data where Phase 7 did; a group of one still shows its heading and total (§1.3, §4.3, §5, §7) |
| long-text | Sidebar; drawer; section button; count badge | covered | Fixed short labels; counts are numbers |
| long-text | Header search control | backstop | `{ statement: "At 320px the header shows Menu, the search icon and the role tag with no horizontal scroll, and the role tag truncates only below 375px", verification: backstop }` |
| long-text | Quick-find input | covered | `maxLength` 100; the input scrolls its own text on one line (§4.4) |
| long-text | Analyst tiles | covered | Captions and supporting lines wrap; the subgrid aligns them (shipped `KpiTile`) |
| long-text | Compact stepper; hub line | covered | Headings and sentences wrap within the card |
| long-text | Risk assessments lists; My requests | covered | `Request title` and `Next step` are long-text columns: they wrap, clamp to two lines and keep the full text in the DOM; mobile cards clamp to three (§4 DataTable) |
| long-text | Picker; register filters | covered | Option labels wrap; chips wrap in the chip row |
| long-text | Page headers and states; the redirect; the Home header | covered | Fixed strings of this contract |

---

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official (local source-owned components) | none new. Existing `Command` (cmdk 1.1.1, already a dependency and already in `components/ui/command.tsx`), `Dialog`, `Button`, `Card`, `Skeleton`, `Progress`, `Badge`, `Table`, `Popover`, `Sheet`, `Input` | not required: no block added and no registry fetched (2026-09-28) |
| Third-party | none | not applicable |

No new dependency. `cmdk` is installed (MIT, 1.1.1; research package audit OK).

---

## Verification contract

- **Unit and component (vitest):**
  - Navigation: each profile's sections, order, labels, icons and capability gating; a section with no visible item absent; the longest-match current item; the own section's open rule on each of its routes and on client navigation; label equals heading for every item (the page-heading constants).
  - Counts: capability-chosen reads (a Requestor issues no analyst count read); zero, failure and refusal show nothing; the accessible names of §1.3, singular and plural; the collapsed section's count.
  - Header control: the name `Search` at every width, `aria-keyshortcuts`, the hint only after mount; the shortcut's rules (composition, repeat, another dialog open, toggle).
  - Quick find: term validation (2 to 100, trimmed); lists by capability; five per list; display fields and hrefs only; no direct client call; stale results dropped; every §4.4 state and announcement; the keyboard table; focus return; the guard's blocking and non-blocking paths.
  - Homes: variant before any read; section content, empty types, errors and the partial; the 375 DOM order; the own-requests rows.
  - Stepper and hub: one next action per width class; the disclosure's `aria-expanded`; `Step {n} of {m}`; the job override in both.
  - Lists: columns, cards, sorting, chips, the `Show` and overall rating filters, local dates.
  - Figures: an audit that every figure of every report and Home unit carries an href, or is a documented sum or a control-implementation count; zero cells plain; names start with the visible figure.
  - Released: both label maps; `status=approved` still filters.
- **Strapi:** the holder for every step and viewer, the §6.1 sentences, no "other party"; the stage partition; accepted; the 14-day window.
- **E2E** (dev servers stopped; sign-in helpers assert the `Home` heading and the role in the banner): the §14.1 rows, plus the research journeys `navigation-and-home.spec.ts` (sidebar per actor at 1440 and in the drawer at 375; label equals heading; counts equal their lists; the collapsed section; the redirect's 307; each Home's first screen at 375 and 1440) and `quick-find.spec.ts` (by keyboard at both widths; find by number and by title; Enter opens; the Secondary Requestor finds none of Jane's records; axe clean with the dialog open). Zero serious axe violations at 375 and 1440 on each.
- **Browser backstops** (orchestrator, plan 11-15, D-58): at 375px and 1440px as the Requestor, the Secondary Requestor and the Security Analyst, the UI Considerations backstop rows and the G-4 bar of §13; NVDA reading the counts, the disclosure state and one announcement per search; ⌘K on macOS Safari and Firefox; the accepted seed Risk after the orchestrator's Strapi restart (D-45); the UAT-A, UAT-B and UAT-C baselines in the development database (`11-VALIDATION.md` Manual-Only).

---

## Checker sign-off

- [x] Dimension 1 Copywriting: PASS. Every call to action is a verb and a noun, except two names the context locks: `New request` (D-07) and the header control's `Search` (D-47). No label is generic; the phone sheet's `Close` is a dismiss control named `Close search`, as the shipped navigation sheet's `Close` is named `Close navigation` (UI-D42). Empty, error and permission copy is declared with a next step, and no destructive action exists in this phase. First-pass FLAGs, all fixed: the quick-find input's name and placeholder were unpinned; the exposed-systems note used vague in-sentence link fragments; the one-column cell name repeated its column label; the control-effectiveness tile's wording contradicted itself.
- [x] Dimension 2 Visuals: PASS. A focal point is declared for every primary surface (the first pass added the request pages, both assessment lists, My requests and both exposure surfaces). Icon-only controls carry names (`Search` below 768px, `Clear search`). Heading levels are fixed per surface. The first pass also added the viewport tables for the analyst Home, the lists and the exposure widgets, and the primary action's `aria-current` rule (UI-D43).
- [x] Dimension 3 Color: PASS. The 60/30/10 split is declared by token. Ink is reserved for an enumerated list. No destructive action, so no destructive colour is used. No new hue.
- [x] Dimension 4 Typography: PASS, by deferral to §3.10 as in Phases 06.5, 07, 08 and 10. New elements use four sizes (micro, caption, body, heading-sm) and the direction's own weights; the checker's two-weight heuristic is superseded by the adopted scale (ADR 0001 gap 8), and this phase adds no weight. The stepper's off-scale heading moves to a token (UI-D24).
- [x] Dimension 5 Spacing: PASS. Only the §3.9 steps 4, 8, 16, 24, 32 and 48 are declared, all multiples of four in the standard set, with no exceptions. Shipped internal spacing is cited, not declared.
- [x] Dimension 6 Registry Safety: PASS. shadcn official, source-owned components only; `cmdk` is already installed; no block added; no third-party registry.
- [x] Dimension 7 Inventory Provenance: PASS. Both inventories carry a command, a count, `package@version` and a date, placed before their tables.

**Checked:** 2026-09-28, gsd-ui-checker role, applied inline in two passes. Status: APPROVED. The first pass found no BLOCK. It raised FLAGs under Dimensions 1 and 2, coverage gaps (no decision-traceability table; D-33, D-45 and D-58's actors unstated) and four wrong file:line citations. All were fixed, and the second pass found them resolved, plus three wording slips and a broken glossary quote, also fixed. The UI-consideration probe ran afterwards (UI Considerations above); resolving it added three statements to the contract: the `Next step` column wraps, quick-find options wrap and clamp, and a dialog-code load failure shows the all-failed state.

**Approval:** approved 2026-09-28 by the inline checker. As in Phase 10 (D-41), the orchestrator accepts X-6 to X-10 before a plan records them, and confirms the readings in Notes carried.
