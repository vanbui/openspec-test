---
phase: 6
slug: create-the-idambox-csrm-next-js-application
status: draft
shadcn_initialized: false
preset: planned -- Next.js / Radix / CSS variables / Lucide / neutral base
created: 2026-08-09
---

# Phase 6 — UI Design Contract

> Visual and interaction contract for the CSRM application foundation. This phase establishes the shell and reusable primitives only; it does not implement the request, questionnaire, assessment, risk-register, administration, reporting, or OIDC workflows scheduled for Phases 7–13.

---

## Scope and source decisions

The shell must feel like a focused BProton / IdamBox enterprise product: calm, light-first, technically credible, spacious, and operational rather than promotional. BProton's public language positions IdamBox as the foundation beneath its application modules; use that relationship in the product lock-up and restrained blue/teal visual language, never a marketing-page hero or campaign treatment.

The supplied Saviynt captures are interaction references only. Retain their useful persistent navigation, account affordance, grouping, and desktop information hierarchy. Do **not** copy their black sidebar, dense desktop tables, wrapped mobile tabs, tiny controls, clipped controls, or desktop layout shrunk wholesale onto phones.

| Decision | Contract |
|----------|----------|
| Implemented Phase 6 destination | `/` is the only enabled application destination. It is the CSRM foundation landing page, not the Phase 12 data dashboard. It may show only product identity, the signed-in fixture context, and non-domain shell demonstration content; do not fabricate workflow metrics, requests, risks, or alerts. |
| Future destinations | Keep their Function-derived definitions in the central navigation registry with `status: planned`; omit them completely from rendered navigation and do not make them actionable until their owning phase implements them. |
| Capability source | Navigation, action visibility, and route guards consume typed Function identifiers from the catalogue. Requestor is always included as a birthright capability set; Security Analyst adds its explicitly granted Function set. No component may compare role-name strings. |
| Authority boundary | Hidden navigation is usability only. A recognized, implemented target lacking its required capability renders the forbidden state before UI data is requested. Planned or unknown routes render not-found/unavailable, never a misleading forbidden screen. Backend authorization remains authoritative. |
| Development identity | The deterministic Requestor and Security Analyst fixture selector is visible only for `development` and automated-test builds. It is absent from production bundles and cannot be enabled by a URL, local storage value, or client-side flag. |

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui — initialize during Phase 6 before component work |
| Initialization | Next.js monorepo workspace at `apps/csrm`, Radix primitives, CSS variables enabled, RSC enabled, `@/*` resolving to `src/*` |
| Preset | `new-york` visual foundation, neutral base, then apply the semantic CSRM tokens below. Do not use an unreviewed generated preset string. |
| Component library | Radix through shadcn/ui; compose CSRM primitives rather than copying generated components per screen |
| Icon library | Lucide React only; every icon-only control has an accessible name and tooltip on pointer-capable desktop |
| Font | Inter variable via `next/font`, with `ui-sans-serif, system-ui, sans-serif` fallback |
| Theme architecture | Define light values on `:root` and equivalent dark-ready values under `.dark`; component TSX uses semantic Tailwind utilities/CSS variables only. A theme switcher is not part of this phase. |
| Registry | shadcn official registry only. No third-party registry, block, or copied remote component is approved for this phase. |

### Required foundation components

Install only the official shadcn components needed by the shell: `avatar`, `button`, `breadcrumb`, `card`, `collapsible`, `dropdown-menu`, `separator`, `sheet`, `skeleton`, `tooltip`, and `alert` (or their current official equivalents). Build the following CSRM-owned compositions around them; they are the reusable contract for later phases:

| Composition | Required behaviour |
|-------------|--------------------|
| `AppShell` | Owns landmarks, responsive shell geometry, capability-filtered navigation, page region, and no domain data. Server-render the shell where possible; isolate drawer, collapse, account menu, and fixture selector as small Client Components. |
| `Sidebar` / `NavigationGroup` | Desktop-only fixed sidebar with product lock-up, collapsible domain groups, active-route indicator, and a persistent compact/collapsed preference. The preference is presentational only and must not control access. |
| `MobileNavigation` | A left-side `Sheet` navigation drawer, not a compressed desktop sidebar. See the mobile interaction contract below. |
| `AppHeader` / `PageHeader` / `Breadcrumbs` | Header with product context, optional breadcrumb trail, account menu, page title, and a right-aligned page-action slot. Omit empty action slots rather than leaving a large void. |
| `EmptyState`, `LoadingState`, `ErrorState` | Shared state primitives with the exact copy and behaviours below. They must be suitable for future list, detail, and form surfaces without making Phase 6 feature claims. |
| `AccessDeniedState` / `UnavailableState` | Shared direct-route states with a clear return affordance and no leaked protected metadata. |

### Component variants and interaction rules

| Component | Variants / rules |
|-----------|------------------|
| Button | `primary` (filled blue), `secondary` (quiet surface with border), `ghost`, and `destructive`; sizes `sm` (36px min height), `md` (40px), and `icon` (40px desktop / 44px mobile). Use one primary action per visual action group. |
| Navigation item | 40px row minimum on desktop and 44px on touch. The active item uses a 3px left teal rule plus `primary-soft` fill and semibold label; inactive items use no fill. Group labels are not navigation links. |
| Card | White secondary surface, 8px radius, 1px `border-subtle`; use a very soft shadow only for a floating sheet/menu. Do not nest cards merely to create decoration. |
| Menu / drawer | Opening state manages focus; `Escape`, close control, backdrop click (drawer), and a navigation selection close it. Trigger receives focus again on dismiss. Use `aria-expanded`, a programmatic name, and visible keyboard focus. |
| Status / severity | Reserve semantic success, warning, destructive, info, and risk tokens for actual status. Always pair colour with a readable label; never use colour alone. Risk-rating badges belong to later feature phases but their tokens are defined now. |
| Motion | Opacity/transform transitions only, 150ms standard and 200ms drawer maximum. Under `prefers-reduced-motion: reduce`, remove non-essential transitions and never use auto-advancing motion. |

---

## Spacing Scale

Declared values (all values are multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline icon-to-label gaps, focus-ring offset |
| sm | 8px | Compact internal gaps, badge padding |
| md | 16px | Default component padding and mobile page gutter |
| lg | 24px | Card padding, grouped control gaps, tablet page gutter |
| xl | 32px | Desktop page gutter and section gap |
| 2xl | 48px | Major content-region separation |
| 3xl | 64px | Desktop page top/bottom rhythm and header-scale separation |

Geometry is fixed as follows:

- Desktop header is 64px high. Expanded sidebar is 272px; collapsed sidebar is 64px. The main content never sits beneath either region.
- Main content has a 1440px maximum readable canvas; at 1024px and above use 32px gutters, at 768–1023px use 24px, and below 768px use 16px.
- The mobile header is 56px high. Its menu trigger, account trigger, drawer close control, and all touch-only targets are at least 44×44px. This 44px target is the sole scale exception.
- Page titles use 24px margin below breadcrumbs when breadcrumbs exist; otherwise page content starts 32px below the header. Do not invent one-off 10px, 12px, 18px, or 20px layout gaps.

---

## Typography

Only these four type sizes and these two weights are allowed for Phase 6 UI text. Use size, line-height, whitespace, and semantic hierarchy—not extra weights—to establish emphasis.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Label / navigation | 14px | 600 | 1.2 | Navigation items, controls, breadcrumbs, status labels |
| Body | 16px | 400 | 1.5 | Body copy, account details, empty/error explanations |
| Heading | 20px | 600 | 1.2 | Page-section headings, state titles, menu headings |
| Display | 28px | 600 | 1.2 | Page title only |

Long page titles may wrap to two lines; never reduce below the declared sizes. Navigation labels, breadcrumbs, account names, and compact menu text truncate with an ellipsis at one line and expose the full text through an accessible name/tooltip. Body and error copy wrap naturally; URLs and opaque identifiers break anywhere rather than causing horizontal overflow.

---

## Color and semantic tokens

Light mode is the first shipped appearance. The 60/30/10 split is a composition rule: approximately 60% pale application canvas, 30% white/muted structural surfaces, and no more than 10% blue/teal emphasis. Decorative gradients, high-chroma background fields, and raw hex values in TSX are prohibited.

| Semantic token | Light value | Dark-ready value | Usage |
|----------------|-------------|------------------|-------|
| `background` / dominant (60%) | `#F7FAFC` | `#0B1220` | Application canvas and main background |
| `foreground` | `#17212B` | `#E6EDF3` | Primary text and icons |
| `surface` / secondary (30%) | `#FFFFFF` | `#131E2A` | Cards, menus, header, drawer surface |
| `surface-muted` | `#EDF4F6` | `#1C2A38` | Sidebar rail, quiet panels, skeleton base |
| `border-subtle` | `#D7E2E8` | `#2D4152` | Controls, separators, card edges |
| `primary` | `#075E9B` | `#4EA7E8` | Primary CTA, text links, focus-adjacent active indicators |
| `primary-foreground` | `#FFFFFF` | `#06111B` | Text on primary controls |
| `primary-soft` | `#E4F1F8` | `#17354A` | Selected navigation and quiet selected-control fill |
| `accent` / emphasis (10%) | `#087F8C` | `#36BFC1` | Teal active-route rule, selected-state indicator, inline progress, and non-destructive confirmation icon only |
| `focus-ring` | `#0B73C9` | `#7BC5F5` | 2px visible focus ring with 2px offset |
| `success` | `#16794D` | `#55C58A` | Successful completion only |
| `warning` | `#9A5B00` | `#F0B45B` | Attention / pending only |
| `destructive` | `#B42318` | `#F28B82` | Destructive actions and blocking errors only |
| `info` | `#075E9B` | `#4EA7E8` | Informational state only |
| `risk-low` / `risk-medium` / `risk-high` / `risk-critical` | `#16794D` / `#9A5B00` / `#C2410C` / `#B42318` | `#55C58A` / `#F0B45B` / `#FB923C` / `#F28B82` | Future risk badges and charts; labels remain mandatory |

The teal `accent` token is reserved for the **active navigation rule, selected-state indicator, concise progress indicator, and non-destructive confirmation icon**. Blue `primary` is reserved for primary CTA fills, text links, and focus-adjacent active indicators. Neither is a default card colour, page background, border colour, or every interactive control. This provides the approved BProton-aligned blue/teal character without a marketing visual treatment.

All token pairings must meet WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for large text and meaningful UI boundaries/focus indicators. Validate the actual generated token pairs in both theme classes before approval.

---

## Shell and responsive contract

### Desktop: 1024px and wider

- Show the fixed sidebar and 64px header. The sidebar starts expanded on a first visit; its collapse toggle persists the visual preference for the current browser.
- Product lock-up reads `IdamBox` with `Cyber Risk Manager` as the product descriptor. Use a compact text/mark treatment designed in CSS/SVG or approved local asset; do not lift a logo from an unverified registry or copy the BProton marketing header.
- Render groups from `menuPath` in catalogue order: Dashboard; Risk Assessment Requests; Questionnaires; Risk Assessments; Risk Register; Administration; Reports. A group only exists if it has at least one enabled, capability-authorized entry. The Phase 6 registry therefore renders only its enabled foundation destination while keeping all future group definitions unrendered.
- Groups are collapsible buttons with `aria-expanded`. The group containing the active route opens on entry. A collapsed sidebar shows icon-only items with a tooltip and accessible label; group expansions remain discoverable from keyboard.
- Header layout: product context at left; breadcrumb above or preceding the page title where hierarchy is useful; account trigger at right. The account trigger shows avatar/initials plus name at desktop widths, opens a labelled menu, and contains a non-destructive `Sign out` placeholder only when production authentication is introduced—not in Phase 6.
- In development/test only, show the fixture selector in the account menu as `Development identity`. It names the current fixture and offers `Requestor — Jane` and `Security Analyst — Bob`; changing it updates the capability context, closes the menu, moves focus to the page title, and announces the new identity through a polite live region.

### Tablet: 768–1023px

- Do not show the pinned sidebar. Use the 56px compact header and mobile drawer pattern.
- Keep page title, account trigger, and one primary page action in the header/content row. Secondary actions move to a labelled overflow menu rather than squeezing or clipping.
- Use fluid one- or two-column foundation layouts; no control may be partially off-screen.

### Mobile: below 768px

- Use a 56px header with a left menu trigger, centred/truncated `CSRM` product label, and right account trigger. Preserve a 44px hit target for both triggers.
- The navigation is a left `Sheet` up to 320px wide (or 88vw when narrower). It has a visible close button, labelled navigation landmark, focus trap, focus restoration, `Escape` support, and an inert/backdrop-treated page beneath it. Selecting a route closes the drawer before navigation.
- Content is single-column with 16px gutters. Stack page actions full-width only when they cannot share a 44px-tall row with their label; do not scale controls below their readable/touch sizes.
- Future dense tables must use a deliberate card/list alternative or a contained labelled horizontal scroll region; they must not create horizontal page scrolling. Future detail tabs use a horizontally scrollable one-line tab strip, select, or accordion—never wrapped multi-row tabs.

### Required viewport acceptance matrix

| Viewport | Required evidence |
|----------|-------------------|
| 375×812 | Drawer opens, traps/returns focus, closes with Escape, body has no horizontal overflow, and all visible controls remain at least 44px high/wide. |
| 390×844 and 430×932 | Compact header, title wrapping/truncation, account menu, drawer, state surfaces, and page gutter remain legible with no clipping. |
| 768×1024 | Pinned sidebar is absent; drawer/header mode has no clipped action row. |
| 1024×768 | Expanded desktop sidebar, header, breadcrumb/title region, active item, and account menu render together without overlap. |
| 1440×900 | Expanded and collapsed sidebar screenshots prove the 1440px content canvas, whitespace rhythm, and tooltip access for compact navigation. |

---

## Page, access, and state contract

### Page and navigation states

| State | Required presentation and interaction |
|-------|----------------------------------------|
| Foundation landing | Page title: `Cyber Risk Manager`. Supporting text: `Your cyber risk management workspace is ready.` This is the phase's neutral shell state and contains no simulated workflow records, statistics, or future CTAs. |
| Authorized route | Page heading/breadcrumb accurately names the registered route; its active navigation item is visible only when its capability is present and the route is enabled. |
| Forbidden direct route | Use `AccessDeniedState` after a known enabled route's capability guard rejects the current identity. Heading: `You don’t have access to this area`. Body: `Your current CSRM access does not include this page. Return to a page available to you or switch the development identity.` Primary action: `Go to CSRM home`. Do not disclose protected record names, counts, actions, or URLs. |
| Planned or unknown direct route | Return an ordinary unavailable/not-found state, not forbidden. Heading: `This area isn’t available yet`. Body: `This CSRM capability will be available in a later release.` Action: `Go to CSRM home`. It must not appear in navigation. |
| Development identity change | Recalculate the single capability registry, remove no-longer-authorized navigation/actions immediately, route to CSRM home if the current route ceases to be permitted, and announce the fixture name. The switcher itself is not an authorization control. |

### Loading, empty, error, and partial data

| Surface | Contract |
|---------|----------|
| Initial shell loading | Render header, page gutters, sidebar/drawer trigger, and title-area skeleton in their final geometry. Do not replace the full viewport with a spinner or allow layout shift when the shell resolves. Mark decorative skeletons `aria-hidden`; announce only a concise loading status once. |
| Collection/list loading | Provide a reusable skeleton matching the eventual row/card count and width. It retains header and filters/action layout so controls do not jump. |
| Empty collection | Heading: `Nothing to show yet`. Body: `There are no items available here yet. When work is available, it will appear in this list.` The owning future phase may add one authorized primary CTA; Phase 6 has none. |
| Empty optional detail | Render `Not provided` in muted text, not `null`, `undefined`, a blank bordered field, or a misleading zero. |
| Recoverable load error | Heading: `We couldn’t load this page`. Body: `Check your connection and try again. If the problem continues, contact your CSRM administrator.` Primary action: `Try again`. Preserve any already-loaded safe content and do not erase form input in future form surfaces. |
| Validation/service error | Use an alert with a short actionable message, programmatic relationship to the failed field where applicable, and focus the summary only after a submit failure. Never expose raw HTTP, Strapi, stack-trace, or token content. |
| Partial data | Render complete known content; absent optional values use `Not provided`, while unavailable required sections show the error state with retry. Do not present partial data as final or silently substitute invented values. |
| Overflow | Sidebar body and drawer navigation scroll independently; main content never gains accidental horizontal scrolling. Long data uses the typography truncation/wrapping rule above. |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Phase 6 primary CTA | `Go to CSRM home` — used only on forbidden and unavailable states; there is no feature CTA in the foundation landing page. |
| Foundation page title | `Cyber Risk Manager` |
| Foundation supporting copy | `Your cyber risk management workspace is ready.` |
| Empty state heading | `Nothing to show yet` |
| Empty state body | `There are no items available here yet. When work is available, it will appear in this list.` |
| Recoverable error | `We couldn’t load this page. Check your connection and try again. If the problem continues, contact your CSRM administrator.` |
| Retry action | `Try again` |
| Forbidden state | `You don’t have access to this area` / `Your current CSRM access does not include this page. Return to a page available to you or switch the development identity.` |
| Unavailable direct route | `This area isn’t available yet` / `This CSRM capability will be available in a later release.` |
| Development selector | `Development identity` / `Requestor — Jane` / `Security Analyst — Bob` |
| Destructive confirmation | None in Phase 6. Do not introduce a confirmation dialog solely to demonstrate a primitive. Later destructive actions must name the object and irreversible outcome, default focus to Cancel, and never use a generic `Are you sure?`. |

Use sentence case, direct verbs, and the domain terms `Risk Assessment Request`, `Questionnaire`, `Risk Assessment`, `Risk`, `Risk Type`, `Control`, and `Information Asset` exactly when later phases need them. Do not call CSRM records “tickets,” “cases,” or generic “items” when their domain type is known.

---

## Accessibility and quality gates

The implementation must satisfy WCAG 2.2 AA for the Phase 6 shell and primitives.

- Use semantic landmarks in this order: skip link, header, navigation, main, and any complementary region. The skip link becomes visible on focus and moves to the start of main content.
- Entire shell is keyboard operable: `Tab` order follows visual reading order; buttons and links have names; collapsible groups, drawers, menus, and account selector expose state; no keyboard trap persists after a dismiss action.
- Use visible 2px `focus-ring` with 2px offset, not browser-default suppression. Verify contrast against both light and dark-ready backgrounds.
- Page titles are one `h1`; headings progress without skipping levels. Navigation groups use buttons and nested lists, not clickable `div`s.
- Icons supplement text. Icon-only triggers require a text alternative; tooltip content does not contain unique required information.
- Announce route transitions and fixture changes via a polite live region; assert blocking errors through `role="alert"`. Skeleton animation is silent to screen readers.
- Respect browser zoom to 200%, text-only zoom, forced-colors mode, and `prefers-reduced-motion`. Do not rely on hover alone for sidebar/tooltips or account actions.
- Use labels, descriptions, and errors programmatically associated with controls in future form primitives. Phase 6 establishes these wrappers but does not build feature forms.

---

## UI Considerations

Applicable state considerations resolved: 7 covered, 2 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| loading | AppShell, navigation, account menu, future list primitive | ✅ covered | Shell and collection loading retain their final geometry; one concise status announcement replaces spinner-only full-page loading. |
| error | Route service boundary, retry control, access states | ✅ covered | Recoverable errors use the documented error copy, safe retry, and never expose transport internals. |
| empty | Future collection primitive, foundation page | ✅ covered | The documented empty state provides neutral no-data copy and has no Phase 6 feature CTA. |
| populated | AppShell, authorized route | ✅ covered | An authorized route shows only capability-authorized enabled navigation, page hierarchy, and safe fixture context. |
| partial | Detail and future form primitive | ✅ covered | Optional absent values read `Not provided`; required unavailable regions use the recoverable error state. |
| overflow | Sidebar, drawer, header, future tables | ✅ covered | Independent navigation scroll, no accidental page horizontal scroll, and deliberate future table/list strategy are required. |
| zero-one-many | Future list primitive | ✅ covered | The empty copy handles zero; one and many use normal list geometry without a layout or copy special case. |
| long-text | Navigation labels, breadcrumbs, title, account menu, identifiers | 🧪 backstop | Playwright mobile and desktop evidence verifies two-line title wrapping plus one-line labelled truncation/tooltip and no horizontal page overflow. |
| loading | Mobile drawer and account-menu controls | 🧪 backstop | Playwright evidence verifies drawer open/close/focus restoration and a stable responsive shell at 375px and 390px. |

---

## Playwright visual evidence contract

Create deterministic visual/smoke coverage using development/test fixture mode. The evidence is a verification requirement, not an optional demo:

| Scenario | Assertions and screenshot evidence |
|----------|-----------------------------------|
| Desktop Requestor at 1440px | Expanded sidebar, active foundation route, header/breadcrumb/title hierarchy, Requestor account identity, and no analyst-only future navigation. Capture `shell-requestor-desktop.png`. |
| Desktop Analyst at 1024px | Central capability configuration changes the account identity/context without scattered role checks; expanded sidebar and collapsed-sidebar tooltip are operable. Capture `shell-analyst-desktop.png` and `shell-sidebar-collapsed.png`. |
| Mobile Requestor at 390px | Header menu opens labelled drawer; focus is contained and restored; Escape closes it; no horizontal page overflow; tap targets meet 44px. Capture `shell-requestor-mobile.png`. |
| Small mobile at 375px | Long identity/navigation labels do not clip important controls, and account menu/drawer remain reachable. Capture `shell-small-mobile.png`. |
| Tablet at 768px | Drawer mode replaces pinned sidebar and page action space is not clipped. Capture `shell-tablet.png`. |
| Direct route access | A fixture without a recognized enabled route capability receives `AccessDeniedState`; a planned/unknown route receives unavailable/not-found; neither shows protected metadata or calls a protected data service. |
| Core state primitives | Skeleton, empty, recoverable error/retry, `Not provided`, and reduced-motion state are rendered and asserted with accessible roles/names. |

Store snapshots under the app's Playwright output directory (not source-controlled unless the test convention explicitly commits golden snapshots). Tests must fail on unexpected visual regression in the shell's approved desktop/mobile evidence and must assert `document.documentElement.scrollWidth <= window.innerWidth` at the mobile viewports.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `avatar`, `button`, `breadcrumb`, `card`, `collapsible`, `dropdown-menu`, `separator`, `sheet`, `skeleton`, `tooltip`, `alert` | not required — official registry only; planned on 2026-08-09 |
| Third-party | none | no third-party registry declared — 2026-08-09; any later addition requires `shadcn view` vetting and a dated safety record |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
