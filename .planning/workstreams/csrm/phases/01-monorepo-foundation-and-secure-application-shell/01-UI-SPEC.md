---
phase: 1
slug: monorepo-foundation-and-secure-application-shell
status: draft
shadcn_initialized: false
preset: planned during implementation; no preset exists yet
created: 2026-08-27
---

# Phase 1 — UI Design Contract

> Visual and interaction contract for the reusable CSRM shell. This is a BProton-led, light-first foundation; all visual values below are semantic tokens so approved BProton assets and tenant branding can replace them without feature-page rewrites.

---

## Scope and locked decisions

This phase establishes the application shell, development session/capability seam, navigation, and reusable state primitives. It does not implement a Requestor workflow, real Keycloak sign-in, live capabilities, or feature data screens.

| Decision | Contract |
|---|---|
| D-09 | Use a BProton-led enterprise treatment through semantic CSRM tokens only. No raw colour, shadow, radius, or font values in TSX feature components. |
| D-10 | Use balanced enterprise density: compact navigation and future data views; comfortable 44px controls and generous form/detail spacing. |
| D-11 | Ship light-first only. Define tokens as CSS custom properties with a future `.dark` override point; do not add a dark-mode switch in this phase. |
| D-12 | Render the replaceable text wordmark **IdamBox CSRM**. It has no logo image dependency and must be a single `Wordmark` component. |

## Design System

| Property | Value |
|---|---|
| Tool | shadcn/ui, initialized during Phase 1 implementation |
| Preset | Not yet selected; use the generated project preset and commit `components.json` after initialization |
| Component library | Radix primitives via shadcn/ui |
| Styling | Tailwind CSS plus semantic CSS custom properties; no component-level brand hex values |
| Icon library | Lucide React; icons are decorative (`aria-hidden`) when a visible text label is present |
| Font | Superseded by ADR 0001: Plus Jakarta Sans, Instrument Serif and IBM Plex Mono per `docs/design/csrm-design-direction.md` §3.10 |
| Theme architecture | `:root` owns the light token values; a future `.dark` selector mirrors the same token names. Components consume names, never theme-specific values. |

### Required shell primitives

Implement these reusable, feature-neutral components before feature work: `AppShell`, `Sidebar`, `MobileNavigation`, `AppHeader`, `Wordmark`, `CapabilityNavigation`, `PageHeader`, `Breadcrumbs`, `PageActions`, `LoadingState`, `EmptyState`, `ErrorState`, `PermissionDeniedState`, and `UserMenu`.

Use shadcn `Button`, `Sheet`, `DropdownMenu`, `Tooltip`, `Separator`, `Skeleton`, `Alert`, `Avatar`, and `Sidebar` primitives internally. Add no third-party component registry.

## Layout and responsive interaction contract

| Viewport | Navigation | Content and controls |
|---|---|---|
| Desktop, 1024px+ | Persistent left sidebar with an icon-only collapsed state; the collapse control is labelled and icon-only items carry tooltips. Widths per the design direction §4. | Sticky top bar; page canvas gutters and maximum width per the design direction §3.9 and §4. Dense list/table regions may use the full canvas. |
| Tablet, 768–1023px | Sidebar is closed by default and opened as a modal `Sheet` from the header. | Gutters per the design direction §3.9; two-column layouts reduce to one or two columns without clipped controls. |
| Mobile, 0–767px | Header menu opens the same labelled modal `Sheet`; close on Escape, close button, route selection, or backdrop click. | Gutters per the design direction §3.9; single-column forms/cards; interactive target sizes per the design direction §4; actions stack or move into a labelled overflow menu. |

- The top bar contains the navigation trigger, breadcrumb/page context, and user menu; its height and sticky/scrolled treatment are defined in the design direction §4. Do not place more than one primary page action in the header on narrow screens.
- Sidebar order is: wordmark, primary navigation, divider, secondary navigation when capabilities permit, then the user menu at the bottom. The wordmark route points to the authorised landing page.
- Navigation is generated from central capability configuration. A hidden item is a usability choice only; direct routes must still show `PermissionDeniedState` when the session capability adapter denies access, and the Strapi API remains authoritative.
- The development role switcher is visibly marked **Development role** and is rendered only in development builds. It belongs inside `UserMenu`, updates the central session adapter, has Requestor and Security Analyst options, and never stores tokens in `localStorage`.
- On every route change, set a concise, unique document title: `{Page title} | IdamBox CSRM`.
- Validate layouts at 375, 390, 430, 768, 1024, and 1440px. No horizontal page scrolling; only a deliberate, labelled table scroll container may scroll horizontally.

## Spacing Scale

**Amendment (Phase 06.5):** The former spacing table and its exception list are
withdrawn. They declared a different scale from the one the product is built to —
omitting the 12px, 20px and 40px steps and adding a 64px step — and restated
sidebar, header, and hit-area dimensions that also disagreed.
[`docs/design/csrm-design-direction.md`](../../../docs/design/csrm-design-direction.md) §3.9 is the sole
authority for the spacing scale and page gutters, and §4 for component dimensions.

## Typography

**Amendment (Phase 06.5):** The former four-pair typography table and blanket
all-caps prohibition are withdrawn because they duplicated a superseded design
contract. Use [`docs/design/csrm-design-direction.md` §3.10](../../../docs/design/csrm-design-direction.md)
for the authoritative type scale and named uses. Uppercase micro-labels are
intentional only for the named design-system uses (including table headers, KPI
captions, eyebrows, and sidebar section labels); navigation items and form labels
remain sentence case.

- Use `font-variant-numeric: tabular-nums` for IDs, dates, counts, and future risk scores.
- A page has one `h1`; shell sections descend in order. Do not skip heading levels for visual sizing.

## Color and semantic tokens

**Amendment (Phase 06.5):** The duplicated colour, semantic-token, contrast, and
accent-use values are withdrawn. [`docs/design/csrm-design-direction.md` §§3.1–3.7](../../../docs/design/csrm-design-direction.md)
is the sole authority for those values and their accessible application.

## Shape, elevation, and component density

- **Amendment (Phase 06.5):** The former radius and elevation values are withdrawn.
  They disagreed with the design direction on both counts: buttons and inputs take
  `--radius-sm`, not `--radius-md`, and the system is border-driven, using 1px rules
  rather than the box-shadows listed here. See [`docs/design/csrm-design-direction.md`](../../../docs/design/csrm-design-direction.md) §3.8 for radii and §2 for the
  hairline treatment.
- **Amendment (Phase 06.5):** The former 40px visual sidebar-row value is withdrawn.
  Follow [`docs/design/csrm-design-direction.md` §4, AppShell / sidebar](../../../docs/design/csrm-design-direction.md)
  for sidebar dimensions and navigation-row guidance, and §4 DataTable for row height
  and in-row target sizes. Navigation rows are 36px by design and satisfy WCAG 2.2
  2.5.8, which requires 24x24px.
- Primary button is solid `primary`; secondary is outline/surface; tertiary is text/ghost. Never rely on hover state alone to distinguish actions.

## Deliberate state components and copywriting contract

All state components receive a heading, explanatory text, and an optional action. The state region is announced with `role="status"` for non-blocking loading and `role="alert"` for failures; do not announce a decorative skeleton.

| State/element | Exact copy and behaviour |
|---|---|
| Primary CTA | **Create risk assessment request** — display only when the effective capability configuration exposes the create action; Phase 1 may render it as a disabled/fixture-backed shell example, never as an unauthorised route. |
| Loading | **Loading workspace…** — use 3–5 skeleton rows/cards matching the eventual layout; retain the page heading and announce once. |
| Empty state heading | **Nothing to show yet** |
| Empty state body | **Items available to you will appear here. Try changing your filters or return when work has been assigned.** |
| Empty-state action | **Clear filters** only when filters are active; otherwise no invented data or dummy action. |
| Error state | **We couldn’t load this page. Try again. If the problem continues, contact your CSRM administrator.** Include a visible **Try again** action that retries only the failed request. Never expose a stack trace, API URL, token, or sensitive record details. |
| Permission denied | **You don’t have access to this area.** **Return to your workspace** links to the authorised landing route. Do not reveal that a requested record exists. |
| Destructive confirmation | No destructive domain action is in Phase 1. The reusable `ConfirmDialog` contract is: action label **Delete {record}**; title **Delete {record}?**; body **This action cannot be undone.**; destructive button **Delete**; secondary button **Cancel**. |
| Development role switch | Label **Development role**; helper **Changes the local development session only.** Options: **Requestor** and **Security Analyst**. |

Use success toasts only for completed, non-blocking user actions; include the completed action in past tense and do not use a toast as the sole confirmation of a consequential state change.

## Accessibility and inclusive interaction contract

- Meet WCAG 2.2 AA. Use semantic landmarks in this order: skip link, `header`, `nav`, and one `main`; the skip link moves focus to the page `h1`/main content and is visible on focus.
- All controls have an accessible name. Icon-only controls use an `aria-label` and tooltip. Labels remain visible for form fields; placeholders are not labels.
- Keyboard focus uses a visible 2px `--focus-ring` outline with 2px offset. Never remove focus styles. Keyboard operation must cover sidebar collapse, mobile menu, user menu, state retry action, and dialogs.
- `Sheet`, dropdowns, and confirmation dialogs trap focus while open, restore focus to their trigger when closed, close with Escape where safe, and do not rely on pointer-only gestures.
- Validation uses `aria-describedby` to connect field help/errors, announces the error summary after submit, and moves focus to the summary or first invalid field.
- Tables use captions, header cells with `scope`, sortable-button labels, and a responsive alternative for narrow viewports. Future status/risk badges include readable labels.
- Respect `prefers-reduced-motion`; limit shell transitions to opacity/transform under 200ms and disable non-essential motion under reduced motion.

## Visual-quality dimensions and acceptance criteria

| Dimension | Implementation contract | Phase-1 verification |
|---|---|---|
| 1. Copywriting | Use the exact state, CTA, and development-session copy above; plain language and no internal error details. | Component tests assert the loading, empty, error, and denied messages/actions. |
| 2. Visuals | Light-first, BProton-led shell; restrained elevation; replaceable text wordmark; one clear primary action. | Visual/E2E check at 375px and 1440px finds no overlap, clipping, or raw brand values in feature TSX. |
| 3. Color | Consume semantic tokens, preserve the 60/30/10 hierarchy, reserve accent uses, and pass AA contrast. | Automated contrast/manual token review covers body, sidebar nav, primary button, focus, error, and disabled states. |
| 4. Typography | Only 14/16/20/28px and 400/600 weights; one h1 and sequential headings. | Accessibility test verifies page title, landmark, heading order, and readable zoom at 200%. |
| 5. Spacing | Use the declared 4px scale; 44px touch targets; defined shell gutters and breakpoints. | Screenshot/E2E checks at 375, 390, 430, 768, 1024, and 1440px find no unintended horizontal scrolling. |
| 6. Registry safety | Official shadcn/ui components only; no third-party registry blocks. | `components.json` and dependency review confirm no external registry source was installed. |

## Registry Safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| shadcn official | Button, Sheet, DropdownMenu, Tooltip, Separator, Skeleton, Alert, Avatar, Sidebar | Not required — official registry only; planned, not yet initialized as of 2026-08-27 |
| Third-party registries | None | Not applicable — no third-party block may be added without `shadcn view` review and recorded approval. |

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

## UI-SPEC COMPLETE

**Phase:** 1 — Monorepo Foundation and Secure Application Shell  
**Design system:** planned shadcn/ui + Tailwind semantic-token foundation (no registry currently initialized)  
**Contract summary:** BProton-led light shell, responsive capability-driven navigation, replaceable `IdamBox CSRM` text wordmark, exact state copy, WCAG 2.2 AA interaction rules, and six explicit visual-quality acceptance dimensions.
