# CSRM Design Direction

**Product:** IdamBox Cyber Risk Manager (CSRM): data-dense enterprise cyber-risk management
**Stack:** Next.js App Router, Tailwind v4 `@theme inline`, CSS custom-property semantic tokens
**Audience:** the engineer implementing the design system
**Status:** authoritative. Semantic token *names* are stable; the values below supersede every earlier value.
**Date:** 2026-09-24 (revised from 2026-08-29; see [ADR 0001](../adr/0001-adopt-bproton-design-system.md))
**Brand source:** [BProton design system](https://claude.ai/artifact/QaGDSeesQHocAe3yvoGpAx), synced from `dthbui/bproton-website-v2@2383fbe` on 2026-09-20

Every value the BProton system defines is used exactly and is labelled with its BProton token name. Values BProton does not define are marked **CSRM extension** and are justified in ADR 0001. Do not add a value to the product that is neither.

All contrast ratios below were computed with the WCAG 2.x relative-luminance formula (not eyeballed). "AA text" = ≥4.5:1, "AA large/UI" = ≥3:1.

---

## 1. Design thesis

CSRM is BProton's editorial restraint applied to an instrument panel. Warm paper, near-black ink, hairline rules, serif page titles and mono labels make it unmistakably BProton. **There is no accent hue:** ink is the only interactive colour, so the only colour on screen is meaning, meaning status and risk severity, always paired with a label or icon and never colour alone. Structure comes from 1px borders and a three-level surface ladder, not shadows. Hierarchy comes from type size, family and grey level. Motion uses BProton's expo curve at app speed (80–260ms): the product should feel *reactive*, not animated like a marketing site. Density is a feature: 13px tabular data, 44px rows, skeletons that mirror the real layout.

---

## 2. References: what we take, what we adapt

### BProton design system (brand source of truth: adopted)

**Adopted exactly:**
- **Palette**: warm paper `background`, ink `foreground`, white `card`, `muted` fill, `muted-foreground`, `border` hairline, ink `accent` for filled controls, `surface-dark` for the one dark section (the sidebar), and the ink and on-dark alpha tokens.
- **Families**: Plus Jakarta Sans for UI text, Instrument Serif 400 for page titles and the wordmark, IBM Plex Mono for uppercase labels.
- **The 1px line as the structural primitive.** Borders, not shadows; only the primary button and floating overlays carry a shadow.
- **Pill buttons** (`radius-full`) and **hover that lifts, never recolours**.
- **`ease-out-expo`** (`cubic-bezier(0.16, 1, 0.3, 1)`) as the house curve.
- **Scrolled-header treatment**: `background` at 95% + blur + 1px bottom `border`.
- **Logo and header lockup**: the mark on a `foreground` tile, then "BProton" in `wordmark`. The mark's three hues belong to the logo alone.
- **Voice**: Australian English, sentence case headings and buttons, spaced hyphen ( - ) not em dash, verb-first calls to action of two to three words.

**Adapted for a data application (ADR 0001):**
- **Type scale and density.** The site's 16px body and 36–136px fluid display are marketing sizes. CSRM keeps a fixed 11–14px UI scale; the serif appears only at ≥20px (page titles, wordmark).
- **Motion pacing.** The site's 450–1000ms durations, scroll reveals, fade-up entrances and rotating text are not used. Same curve, app durations.
- **Iconography.** The site uses no icons. CSRM keeps Lucide because status and severity icons are accessibility signifiers (WCAG 1.4.1) and navigation icons aid scanning.
- **Labels.** Tags are 11px, not the site's 10px, to hold the 11px floor. Form field labels stay sentence case sans.
- **Focus on dark.** The site's `ring-white/30` computes to 2.7:1 on `surface-dark`; CSRM uses a solid `accent-foreground` ring.
- **Layout width.** Data pages use `grid-max` (90rem), not the site's `container-max` (72rem), which is kept for reading and form pages.
- **Not used:** photography, the 12-column `grid-line` overlay, section-scale vertical rhythm (`section-y-*`), rotating or auto-advancing content.

### Linear

**Take:**
- **Tight surface ladder + text hierarchy**: surfaces a few % of lightness apart, elevation as *surface step + 1px border*, never drop shadows for in-page structure.
- **Density with calm**: ~36–44px rows, minimal chrome, no zebra, obsessive px alignment in the sidebar.
- **Speed as a design value**: <100ms perceived response, keyboard-first as a roadmap commitment.
- **Dot + text label** for status in ultra-dense lists.

**Reject:** dark-first theming (BProton defines light only); LCH generative theming; any accent hue.

### Vercel / Geist

**Take:**
- **Step-encoded scale intent**: bg → hover bg → border → strong border → solid fill → text, encoded semantically.
- **Alpha-based interaction tints** that work on any surface: `--color-bg-hover` is an ink alpha.
- **Weight ceiling 600; hierarchy via size + negative tracking on headings**, 400/500 for almost everything.
- **14px as the UI body size**, 12–13px captions and dense data.
- **Tabular numerics throughout** for metrics.

**Reject:** white-on-white minimalism (the warm canvas vs white `card` step groups dense modules); a 10×10 palette.

### Stripe (Dashboard + Apps SDK)

**Take:**
- **The badge taxonomy**: small rounded-rect, tinted background + darker same-hue text + leading icon; *status* separated from *severity*.
- **Filter chips above the DataTable**, "Clear filters" only when active; a filtered table never looks identical to an unfiltered one.
- **KPI discipline**: ~4 metric cards above the fold.
- **Semantic token naming** rather than raw hex at call sites.

**Reject:** spinner-first loading (we are skeleton-first); roomier density; multi-hue data viz (charts are ink + severity only).

---

## 3. Token specification (light theme, complete)

### Neutral temperature: BProton warm paper

The canvas is BProton's low-chroma warm paper. The earlier concern, that warm severity hues lose distinctness on a warm canvas, is handled by construction:

1. **Severity never sits on the canvas.** Tables, cards and panels are white `card` surfaces; badges carry their own tinted background. Recomputed ratios (§3.5, §3.6) all pass AA.
2. **No competing hue.** With ink as the only interactive colour, status and severity are the only chroma on screen, so they are more salient than they were beside a blue accent and navy sidebar.
3. **Never colour alone.** Every status and severity rendering carries an icon shape and a text label.

### 3.1 Backgrounds & surfaces

| Token | Value | BProton token | Use | Contrast notes |
|---|---|---|---|---|
| `--color-bg-page` | `#F6F5F2` | `background` | App canvas behind everything; scrolled header at 95% | — |
| `--color-bg-surface` | `#FFFFFF` | `card` | Cards, tables, panels, inputs, dialogs, popovers | vs page ≈ 1.09:1; the 1px border does the separation |
| `--color-bg-inset` | `#ECEAE5` | `muted` | Wells, detail blocks, table footer, skeleton base, secondary button hover | vs surface ≈ 1.2:1 |
| `--color-bg-hover` | `#1414130A` | `grid-line` value (CSRM extension role) | Row/item/ghost-control hover tint: ink at 4%, works on any surface | decorative |
| `--color-bg-selected` | `#ECEAE5` | `muted` (CSRM extension role) | Selected rows/items, always with a 2px `--color-text-primary` left edge | text-primary on it 15.3:1 ✓ |
| `--color-bg-sidebar` | `#121211` | `surface-dark` | App sidebar and mobile navigation sheet: the one dark section | see inverse text |
| `--color-bg-sidebar-active` | `#FFFFFF0A` | `fill-on-dark-button` | Sidebar item hover and active fill | decorative |
| `--color-bg-scrim` | `rgb(18 18 17 / 50%)` | `surface-dark` at 50% (CSRM extension) | Dialog/sheet overlay | — |
| `--color-selection` | `#1414131F` | `selection` | `::selection` background; selected text stays `--color-text-primary` | — |

### 3.2 Text

| Token | Value | BProton token | Use | Contrast |
|---|---|---|---|---|
| `--color-text-primary` | `#141413` | `foreground` | Headings, body, data cells, links | 18.4:1 on white, 16.9:1 on page, 15.3:1 on inset ✓ |
| `--color-text-secondary` | `#6B6962` | `muted-foreground` | Supporting copy, labels, secondary cells | 5.5:1 on white, 5.0:1 on page, 4.6:1 on inset ✓ |
| `--color-text-muted` | `#6B6962` | `muted-foreground` | Captions, timestamps, placeholders, micro-labels | as above ✓ |
| `--color-text-inverse` | `#F6F5F2` | `accent-foreground` | Text on sidebar, on ink fills | 17.2:1 on sidebar, 16.9:1 on ink ✓ |
| `--color-text-inverse-muted` | `#A8A59C` | `surface-dark-muted` | Inactive sidebar items, sidebar section labels | 7.6:1 on sidebar ✓; never on light grounds (2.5:1) |
| `--color-text-link` | `#141413` | `foreground` | Record links and inline links | 16.9:1 on page ✓ |
| `--text-link-decoration` | `#6B6962` | `muted-foreground` | At-rest link underline; becomes `--color-text-link` on hover and keyboard focus | 5.0:1 on page |

BProton has two text levels, so `--color-text-secondary` and `--color-text-muted` share a value; both names are kept so components need no change. Hierarchy between them now comes from size and weight. Never use pure `#000000` text.

### 3.3 Borders

| Token | Value | BProton token | Use | Contrast |
|---|---|---|---|---|
| `--color-border-default` | `#D8D5CD` | `border` | Hairlines: card edges, table row dividers, section rules, outline buttons | 1.35:1: decorative only |
| `--color-border-strong` | `#6B6962` | `muted-foreground` (CSRM extension role) | Input, select, checkbox, radio and switch-off boundaries; any boundary that must carry meaning alone | 5.5:1 on white, 5.0:1 on page ✓ (WCAG 1.4.11) |
| `--color-border-ink-subtle` | `#14141326` | `line-ink-15` | Neutral tag pills on the page | decorative |
| `--color-border-ink` | `#14141333` | `line-ink-20` | Link-card hover border | decorative |
| `--color-border-on-dark` | `#FFFFFF1A` | `line-on-dark` | Sidebar dividers | decorative |
| `--color-border-on-dark-strong` | `#FFFFFF26` | `line-on-dark-strong` | Tag chips on the sidebar | decorative |

Rule: `border-default` is the workhorse; `border-strong` on form controls and anywhere a boundary is the only affordance. The sidebar role select uses `--color-text-inverse-muted` as its boundary (7.6:1), because the on-dark line tokens are decorative.

### 3.4 Primary (ink)

| Token | Value | BProton token | Use | Contrast |
|---|---|---|---|---|
| `--color-primary` | `#141413` | `accent` | Primary button fill, checked controls, active indicators | 16.9:1 on page |
| `--color-on-primary` | `#F6F5F2` | `accent-foreground` | Text/icons on primary fills | 16.9:1 ✓ |

**No accent hue.** Ink is the only interactive colour. Hover and press never recolour a control (§4 Buttons): `--color-primary-hover`, `--color-primary-active` and `--color-primary-subtle` are retired; implementations that still reference them resolve to `--color-primary` or `--color-bg-inset`. The logo's magenta, cyan and green are never UI colours.

### 3.5 Status colors (system/state feedback: CSRM extension)

Recipe (Stripe pattern, AA-verified): tinted `bg` + dark same-hue `fg` text + soft same-hue `border` + leading icon. Text carries AA; the border is supportive (decorative by design, since icon + label + fg already carry meaning per WCAG 1.4.1). BProton defines no status colours; these values are unchanged from the previous direction and re-verified on the BProton canvas.

| Token set | bg | fg | border | fg-on-bg | fg on page | fg on inset |
|---|---|---|---|---|---|---|
| `--color-info-*` | `#EFF6FF` | `#1D4ED8` | `#B2CCFF` | **6.2:1** ✓ | 6.2:1 ✓ | 5.6:1 ✓ |
| `--color-success-*` | `#ECFDF3` | `#067647` | `#ABEFC6` | **5.4:1** ✓ | 5.2:1 ✓ | 4.7:1 ✓ |
| `--color-warning-*` | `#FFFAEB` | `#B54708` | `#FEDF89` | **5.2:1** ✓ | 5.0:1 ✓ | 4.5:1 ✓ (floor: prefer surface) |
| `--color-danger-*` | `#FEF2F2` | `#B42318` | `#FECDCA` | **6.0:1** ✓ | 6.0:1 ✓ | 5.5:1 ✓ |
| `--color-danger-solid` | `#D92D20` | white text | — | **4.8:1** ✓ | — | — |

Blue now means *info status* only. Info text is never underlined, so it cannot be mistaken for a link.

### 3.6 Risk severity scale (impact magnitude: CSRM extension, distinct from status)

Severity is a *ladder*, not a state. Tokens are separate from status tokens even where values coincide, so they can diverge later without renames.

| Token set | bg | fg | fg-on-bg | fg on page | Non-color signifier (mandatory) |
|---|---|---|---|---|---|
| `--color-risk-low-*` | `#ECFDF3` | `#067647` | **5.4:1** ✓ | 5.2:1 ✓ | ○ circle icon + label "Low" |
| `--color-risk-moderate-*` | `#FFFAEB` | `#B54708` | **5.2:1** ✓ | 5.0:1 ✓ | ◆ diamond icon + label "Moderate" |
| `--color-risk-high-*` | `#FFF4ED` | `#B93815` | **5.3:1** ✓ | 5.3:1 ✓ | ▲ filled triangle icon + label "High" |
| `--color-risk-critical-*` | `#FEE4E2` | `#912018` | **7.2:1** ✓ | 8.0:1 ✓ | ⯃ filled octagon icon + label "Critical" |
| `--color-risk-critical-solid` | `#B42318` | white text | **6.6:1** ✓ | — | solid fill = extra emphasis tier |

Rules:
- **Never color-only** (WCAG 1.4.1): every severity rendering = distinct icon shape **+** text label.
- Severity renders on its own tinted chip on a white surface, never as bare coloured text on the canvas, except the dense-table form in §4.
- Severity ladder is orderable non-visually: `aria-label="Severity: critical (4 of 4)"`.
- Risk-low intentionally shares green with success (documented coincidence, separate tokens).

### 3.7 Focus ring

| Token | Value | Notes |
|---|---|---|
| `--focus-ring` | `2px solid #141413`, `2px` offset | BProton's light-ground rule: `foreground` ring, 16.9:1 on page, 18.4:1 on white ✓ |
| `--focus-ring-inverse` | `2px solid #F6F5F2`, `2px` offset | Sidebar and mobile sheet: `accent-foreground`, 17.2:1 on `surface-dark` ✓. Replaces the source's `ring-white/30` (2.7:1, fails) |

Apply via `:focus-visible` only. Never `outline: none` without replacement. Focus must never hide behind sticky headers (WCAG 2.4.11): give sticky table headers `scroll-margin-top`.

### 3.8 Radii

Tailwind v4's default radius scale, unmodified, which is what BProton uses. The app's former overrides are removed.

| Token | Value | BProton token | Use |
|---|---|---|---|
| `--radius-sm` | `0.25rem` (4px) | `radius-sm` | Status and risk badges, checkboxes, tooltips, skeleton blocks |
| `--radius-md` | `0.375rem` (6px) | `radius-md` | Inputs, selects, textareas, menu items, the logo tile |
| `--radius-lg` | `0.5rem` (8px) | Tailwind default | Cards, KPI tiles, tables, popovers, menus, toasts |
| `--radius-2xl` | `1rem` (16px) | `radius-2xl` | Dialogs, sheets, large feature panels |
| `--radius-full` | `9999px` | `radius-full` | Every button and icon button, interactive chips, neutral tags, status dots, avatars |

Shape carries meaning: **pill = action**, rectangle = field or information. Status and risk badges are therefore never pills.

### 3.9 Spacing

In-component spacing uses Tailwind's default 4px scale, unchanged (BProton uses it too):

`2px` · `4px` · `8px` · `12px` · `16px` · `20px` · `24px` · `32px` · `40px` · `48px`

Layout tokens:

| Token | Value | BProton token | Use |
|---|---|---|---|
| `--spacing-grid-max` | `90rem` (1440px) | `grid-max` | Max width of data pages (lists, dashboard, registers) |
| `--spacing-container-max` | `72rem` (1152px) | `container-max` | Max width of reading and detail pages |
| `--spacing-gutter-xs` | `1rem` | `gutter-xs` | Page side padding below 640px |
| `--spacing-gutter-sm` | `1.5rem` | `gutter-sm` | Page side padding from 640px; grid gap |
| `--spacing-gutter-md` | `2.5rem` | `gutter-md` | Page side padding from 1024px |
| `--spacing-header-h-sm` | `3.5rem` | `header-h-sm` | Top bar height below 768px |
| `--spacing-header-h-md` | `4rem` | `header-h-md` | Top bar height from 768px |
| `--spacing-control-h` | `3rem` | `control-h` | Sign-in page actions only |

Tokens live under `--spacing-*` so they generate `max-w-grid-max`, `px-gutter-sm`, `h-header-h-md` without colliding with Tailwind's `max-w-max`. `gutter-lg` and `section-y-*` are marketing rhythm and are not used in the app frame. Section rhythm inside pages: 24–32px.

### 3.10 Type scale (Plus Jakarta Sans, Instrument Serif, IBM Plex Mono; weights 400/500/600 only)

Families, loaded with `next/font/google` in the root layout:

- `--font-sans`: Plus Jakarta Sans 400/500/600. All UI text, data and numbers.
- `--font-display`: Instrument Serif 400. Page titles and the wordmark only; never below 20px, never for data or numbers. Italic is not used.
- `--font-mono`: IBM Plex Mono 400/500. Uppercase micro-labels and machine identifiers (record IDs, CVE IDs, hashes).

| Token | Size/Line | Weight | Tracking | Use |
|---|---|---|---|---|
| `--text-micro` | 11px/16px | 400 | +0.14em, UPPERCASE, IBM Plex Mono | Micro-labels: table headers, KPI captions, eyebrows, sidebar section labels, neutral tags (BProton `label`) |
| `--text-caption` | 12px/16px | 400 | 0 | Helper text, timestamps, badge text (500) |
| `--text-table` | 13px/18px | 400 | 0 | **Dense table body**: the data workhorse |
| `--text-body` | 14px/20px | 400 | 0 | Default UI body, inputs, form labels (500) |
| `--text-button` | 14px/20px | 500 | −0.025em | Pill button labels (BProton `button`) |
| `--text-prose` | 16px/24px | 400 | 0 | Long-form reading (descriptions, docs) |
| `--text-heading-sm` | 16px/24px | 600 | −0.01em | Card/panel titles, state headlines |
| `--text-heading-md` | 20px/28px | 600 | −0.015em | Section headings |
| `--text-wordmark` | 20px/28px | 400 | −0.02em | "BProton" in the logo lockup, Instrument Serif (BProton `wordmark`) |
| `--text-heading-lg` | 28px/32px | 400 | −0.02em | Page titles and the sign-in heading, Instrument Serif |
| `--text-display` | 30px/36px | 600 | −0.02em | KPI values, hero numbers, Plus Jakarta Sans with `tabular-nums` |

- `font-variant-numeric: tabular-nums` on **every** numeric column, KPI value, delta, count, and pagination readout. Plus Jakarta Sans exposes `tnum` (verified in the browser on 2026-09-24).
- 11px is the floor. Fixed px steps: no viewport-fluid `clamp()` type in the app frame.
- Uppercase is reserved for `--text-micro`. Navigation items, form labels, headings and buttons are sentence case.
- Emphasis inside rows: 500 weight or `text-primary` vs `text-secondary`, never bold-700.

### 3.11 Motion tokens

| Token | Value | Interaction class |
|---|---|---|
| `--duration-micro` | `80ms` | Control state: checkbox, toggle, button press, row hover |
| `--duration-fast` | `120ms` | Button/card hover lift, tooltip in, exits of small overlays |
| `--duration-base` | `180ms` | Dropdown/popover/menu open, tab indicator slide |
| `--duration-slow` | `220ms` | Dialog/toast enter (exit 160ms), selection panels |
| `--duration-slower` | `260ms` | Drawer/side-panel slide, route-level content swap |
| `--duration-shimmer` | `1400ms` | Skeleton shimmer loop (ambient) |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | **Entrances, movement and hover lift**: BProton `ease-out-expo` |
| `--ease-out-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | BProton `ease-out-soft`; declared, not yet used |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0.38, 0.9)` | In-place property changes (colour, opacity): CSRM extension |
| `--ease-in` | `cubic-bezier(0.2, 0, 1, 0.9)` | Exits (leave fast): CSRM extension |

Durations are CSRM's; BProton's 450ms–1s pacing is for its marketing page. Exits always ≥25% shorter than entrances. Nothing in the product exceeds 400ms except the shimmer loop.

### 3.12 Elevation

| Token | Value | BProton token | Use |
|---|---|---|---|
| `--shadow-button` | `0 1px 2px rgba(0, 0, 0, 0.05)` | `shadow-button` | Primary button at rest |
| `--shadow-button-hover` | `0 10px 30px rgba(0, 0, 0, 0.1)` | `shadow-button-hover` | Primary button on hover |
| `--shadow-button-light` | `0 1px 2px rgba(0, 0, 0, 0.08)` | `shadow-button-light` | Light-filled button on the sidebar, at rest |
| `--shadow-button-light-hover` | `0 10px 30px rgba(0, 0, 0, 0.15)` | `shadow-button-light-hover` | Light-filled button on the sidebar, on hover |
| `--shadow-overlay` | `0 10px 30px rgba(0, 0, 0, 0.1)` | `shadow-button-hover` value (CSRM extension role) | Dialogs, popovers, menus, toasts: the one floating-layer shadow |

In-page structure never uses a shadow.

### 3.13 Theme

Light only, `color-scheme: light`. BProton defines no dark theme; the empty `.dark` selector is removed and shadcn `dark:` variants stay inert. Dark mode is revisited only when BProton publishes a dark theme.

### 3.14 Data visualisation

| Token | Value | BProton token | Use |
|---|---|---|---|
| `--chart-1` | `#141413` | `foreground` | Primary series |
| `--chart-2` | `#6B6962` | `muted-foreground` | Comparison series |
| `--chart-grid` | `#D8D5CD` | `border` | Gridlines and axes |

More than two series are separated by dash or pattern plus direct labels, never by a new hue. A metric that *is* a severity uses the §3.6 risk tokens. `--chart-3` to `--chart-5` are retired.

---

## 4. Component-level guidance

### Logo lockup

- Show the mark only as `bproton-logo.png` (served from `public/`); never redraw, recolour or recreate it.
- Lockup: a square `--color-text-primary` (`foreground`) tile, `--radius-md`, 6px padding around a 20px mark (32px tile), followed by "BProton" in `--text-wordmark`, 10px gap. The mark image is decorative (`alt=""`); the link's accessible name is "IdamBox CSRM home".
- Used at the top of the sidebar and mobile navigation sheet, with the wordmark in `--color-text-inverse`, and on the sign-in card, with the wordmark in `--color-text-primary`. The same file is the favicon (`app/icon.png`).

### AppShell / sidebar

- Sidebar `--color-bg-sidebar` (`surface-dark`), 256px expanded / 64px collapsed (icon rail), full-height, no border (the colour change is the edge). It is the one dark section on every screen; page content never adds another.
- Nav items: 36px height, 13px/500 text in `--color-text-inverse-muted` for inactive items (7.6:1), icons 16px in the same colour on a strict 4px grid, `--radius-md` corners.
- **Hover**: `--color-bg-sidebar-active` fill and `--color-text-inverse` text.
- **Active item**: `--color-bg-sidebar-active` fill, `--color-text-inverse` text + **2px `--color-text-inverse` left bar that grows in vertically** (180ms expo). Never a filled-accent row.
- Section labels: `--text-micro` in `--color-text-inverse-muted`. Dividers: `--color-border-on-dark`. Focus: `--focus-ring-inverse`.
- Top bar: `--spacing-header-h-sm` (56px) below 768px, `--spacing-header-h-md` (64px) from 768px, sticky; `--color-bg-page` at 95% + `backdrop-blur(8px)` + 1px `--color-border-default` bottom hairline. The role indicator is a neutral tag.
- <768px: sidebar becomes an overlay drawer (260ms expo slide; reduced-motion: fade); 375px layouts are single-column.

### Buttons

- **Every button is a pill** (`--radius-full`); icon-only buttons are circles. Label `--text-button`, sentence case, verb first, two to three words where the action allows.
- Heights stay app-scaled: 32px small, 36px default, 40px large; touch targets ≥44px below 768px.
- Variants, mapped to BProton:
  - **Primary** (BProton primary): `--color-primary` fill, `--color-on-primary` text, `--shadow-button`. Hover: translateY(−1px) + `--shadow-button-hover`, 120ms expo. Press: scale(0.995), 80ms. Colour never changes.
  - **Outline** (BProton secondary): `--color-bg-surface` fill, 1px `--color-border-default`, `--color-text-primary` text. Hover: `--color-bg-inset` fill + 1px lift.
  - **Secondary**: `--color-bg-inset` fill. Hover: `--color-bg-hover` layered over it.
  - **Ghost** (BProton ghost): transparent. Hover: `--color-bg-hover`. Never `bg-accent`, which is ink.
  - **Link**: record-link treatment (below).
  - **Destructive**: `--color-danger-solid` fill, white text, same lift behaviour.
- Disabled: 50% opacity, no lift, no shadow.

### Tags and chips

- **Neutral tag** (role indicator, metadata): pill, `--text-micro`, 1px `--color-border-ink-subtle`, no fill, 2px 10px padding. On the sidebar: `--color-border-on-dark-strong` and `--color-text-inverse-muted`.
- **Filter chips** are interactive, so they are outline pill buttons at 32px.

### DataTable

- Table sits on `--color-bg-surface` with a 1px `--color-border-default` edge and `--radius-lg`.
- **Row height 44px default**, 36px compact via a density toggle (persist per user). Interactive targets inside rows stay ≥24×24px (WCAG 2.2 2.5.8).
- Cell padding: 16px horizontal, vertical centering (top-align only if cell content >3 lines). 12px minimum column gap.
- Body `--text-table` (13px/18); **header** `--text-micro` (11px mono uppercase) in `--color-text-muted`, height 40px, `--color-bg-surface`, sticky, hairline bottom border; gains the backdrop-blur treatment when stuck.
- Identifier cells (record IDs, CVE IDs, hashes) may use `--font-mono` at 13px.
- Row separation: 1px `--color-border-default` horizontal hairlines only. **No zebra, no vertical rules.**
- When horizontal scrolling is needed, the identifier header and first body cell stay sticky on the left, retain their row-state background, and use a 1px `--color-border-default` right hairline with no shadow. The scroll container is a labelled, keyboard-scrollable region.
- Numbers/currency/percent: right-aligned, `tabular-nums`; identity numerics (dates, IDs) left-aligned; header alignment matches column.
- **Hover**: `--color-bg-hover` tint, 80ms `--ease-standard`. No translateY on rows: lift is for buttons and link cards only.
- **Selection**: checkbox column appears on hover/focus (never hover-only: always keyboard reachable); selected row = `--color-bg-selected` + 2px `--color-text-primary` left edge; bulk-action bar slides up as a sticky footer only after ≥1 selection (220ms expo).
- Sort: reserved-space chevrons (no column shift), direction always visible, quiet when unsorted. Filters: chip row above the table, chip labels = column header names, result count visible, "Clear filters" only when active.
- Row detail: side panel/sheet, 260ms expo slide. Pagination always shows total count + rows-per-page. Virtualize past ~1,000 client rows.

### Status & risk badges

- Shape: **rounded-rect** `--radius-sm` (4px), never a pill: pills mean action. 20px height, `--text-caption` at 500, 8px horizontal padding, sentence case.
- Anatomy: 12px leading icon (the shape system from §3.6) + label. **Icon + label always; never a coloured dot alone, never colour alone.**
- Two emphasis tiers: **subtle** (tinted bg/fg/border: the default everywhere) and **solid** (critical severity and danger-solid only: the "needs action now" tier).
- Every status badge uses the tinted recipe, whatever the record type; neutral outline chips are not a status treatment.
- In ultra-dense table cells, the Linear alternative is allowed: severity icon + plain text in `fg` colour, no tinted chip. Same tokens, less ink.
- Counts inside badges: `tabular-nums`. Icon-only renderings (avoid) require `aria-label`; live status changes announce via `aria-live="polite"`.
- Max ~5 distinct statuses visible per view; roll-ups show the highest severity.

### Forms

- **Single column, always.** Max field width 640px. ~5 fields per titled section; sections separated by 32px + `--text-heading-sm` header + hairline rule.
- Labels: top-aligned, `--text-body` at 500, sentence case sans, 6px above the field. Optional hint text `--text-caption` in `--color-text-muted` below the label.
- Inputs, selects, textareas: 36px height, `--radius-md` (a rectangle, never a pill), `--color-bg-surface`, 1px `--color-border-strong` (5.5:1 ✓). Hover: border → `--color-text-primary`. Focus: `--focus-ring`. Placeholder `--color-text-muted`, never a substitute for a label.
- Checkbox and radio: `--color-border-strong` boundary; checked = `--color-primary` fill with `--color-on-primary` glyph. Switch: off = `--color-border-strong` outline track, on = `--color-primary` track.
- Validation: **on blur**, not per keystroke. Error = danger-fg `--text-caption` + 14px icon directly below the field, input border → `--color-danger-fg`; the message says what's wrong *and* how to fix it. Red is never the only signal.
- Prefer radios/segmented controls over selects for ≤4 options. Segmented controls are pills. Multi-step flows: 2–3 steps with a step indicator.

### Cards / KPI tiles

- Card: `--color-bg-surface`, 1px `--color-border-default`, `--radius-lg`, padding 16–20px. **No shadow.** Hover (only if the card is a link): border → `--color-border-ink` + translateY(−1px) at 120ms expo.
- KPI tile anatomy (top-left = most important; max 4–6 per row):
  1. `--text-micro` caption (e.g., `OPEN CRITICAL FINDINGS`)
  2. `--text-display` value, `tabular-nums`
  3. Delta: `--text-caption`, icon (▲/▼) + signed value + period; icon and sign carry direction, colour (success/danger fg) is reinforcement only
  4. Optional 32px sparkline in `--chart-2`, severity hue only when the metric itself is a severity.
- 3-second rule: a tile must be readable at a glance; no mixed messages per tile.

### Page header

- Page title in `--text-heading-lg` (Instrument Serif 400, 28px). An optional `--text-micro` eyebrow sits above it; the description below uses `--text-body` in `--color-text-secondary`.
- Actions sit right on desktop and stack full-width below 768px.

### Dialogs

- Scrim `--color-bg-scrim`, fade 220ms. Panel: `--color-bg-surface`, `--radius-2xl`, 1px `--color-border-default` **+** `--shadow-overlay` (overlays float; in-page structure never does).
- Enter: opacity 0→1 + scale 0.98→1, 220ms expo. Exit: 160ms `--ease-in`, fade + scale to 0.98.
- Sizes: 480px (confirm), 640px (form), 800px (complex). Destructive confirms use the destructive pill + explicit noun ("Delete 3 assessments").
- Focus trapped; initial focus on first meaningful control; Esc closes non-destructive dialogs.

### Toasts

- Bottom-right stack, max 3 visible. `--color-bg-surface`, 1px border, `--radius-lg`, `--shadow-overlay`, 4px left edge in status colour + status icon + title/body text (colour never alone).
- Enter 220ms expo (translateY 8px→0 + fade); exit 160ms. Auto-dismiss 5s for info/success; **warning/danger persist until dismissed**. Hover pauses the timer.
- Optimistic-mutation failures land here: revert animates 150–250ms + danger toast with retry affordance.

### Skeletons (skeletons over spinners: hard rule)

- Content loads with known layout (tables, cards, dashboards) get skeletons; spinners only for blocking submits (inline in the button, 16px) and micro-loads. Never a full-page spinner.
- Show nothing for the first **300ms**; then skeleton. Skeleton mirrors the final layout *exactly*: same row height/density, same column widths, realistic row count filling the viewport; zero layout shift on swap.
- Blocks: `--color-bg-inset` base, left-to-right shimmer (`--duration-shimmer`, linear), `--radius-sm`.
- `prefers-reduced-motion`: shimmer off, static blocks.

### Empty states

- Anatomy: `--text-heading-sm` headline → 1–2 lines `--color-text-secondary` context → **one** primary CTA in plain action words. No illustration; an optional 20px Lucide icon in `--color-text-muted`; meaning lives entirely in the text.
- Differentiate the four types: first-use ("Import your asset inventory"), filtered-empty (**CTA = "Clear filters"**, never a dead end), cleared/complete (positive tone), error (recovery action + what happened).
- Multi-widget dashboards: consistent, quiet empty states; don't render a wall of competing CTAs.
- Shared state primitives own their structure, icon, typography, and locked copy: first-use is "No {noun} yet"; filtered-empty is "No {noun} match these filters" with a "Clear filters" action; errors are "We couldn't load {noun}" with "Try again"; permission denial identifies the unavailable area. Optional descriptions are reserved for domain facts.

### Record links

- A record identifier or title that opens that record uses `RecordLink`; feature surfaces do not style record navigation themselves.
- Record links use `--color-text-link` (ink), 500 weight, and a visible 1px underline at rest in `--text-link-decoration` with a 3px offset. Link and body text share a colour, so the at-rest underline is the non-colour cue and is never removed. On hover and `:focus-visible`, the underline becomes `--color-text-link`.
- Only text-decoration colour transitions, using `--duration-micro` and `--ease-standard`. Context determines text size; the record-link contract does not.

### Iconography

- Lucide React, the default 2px stroke, `currentColor`. 16px in navigation and controls, 12–14px inside badges and inline messages.
- Icons are `aria-hidden` when a visible label is present; an icon-only control carries an accessible name.
- Icons support meaning, never replace it. No decorative illustrations and no emoji (BProton rule, kept).

### Sign-in

- A single `--color-bg-surface` card, `--radius-lg`, on `--color-bg-page`. The logo lockup sits at the top; the heading uses `--text-heading-lg`. Actions are primary pills at `--spacing-control-h`.

---

## 5. Motion system

**Principle:** motion confirms causality and direction; it never entertains. Everything animates only `transform` and `opacity` (GPU-composited). The expo curve at short durations is the "reactive premium" signature: perceived movement completes in the first ~40% of the duration, so 180ms feels instant *and* smooth.

| Interaction | Duration | Easing | Notes |
|---|---|---|---|
| Button/toggle/checkbox state, button press (scale 0.995) | 80ms | standard | Feels like physical manipulation |
| Table-row / list-item hover | 80ms | standard | High-frequency → subtlest |
| Button / link-card hover (−1px lift, shadow or border change) | 120ms | expo | Lift on buttons and link cards only, never rows; never a colour change on a button |
| Tooltip | 120ms in / 80ms out | standard | Fade only |
| Dropdown / popover / menu | 180ms in / 120ms out | expo in, ease-in out | Fade + 4px translateY |
| Tab / nav active indicator | 180ms | expo | The animated 1px/2px line |
| Dialog / toast | 220ms in / 160ms out | expo in, ease-in out | Fade + scale 0.98 / translateY 8px |
| Drawer / side panel / route swap | 260ms | expo | Fade + short slide; no full-page wipes |
| Staggered dashboard reveal (first load only) | 40ms/item, ≤8 items, total <600ms | expo | Cards only: **rows and charts render instantly, never staggered** |
| Skeleton shimmer | 1400ms loop | linear | Ambient |

BProton's fade-up entrances, scroll reveals, rotating phrases and auto-advancing lists are marketing motion and are not used.

**Optimistic UI:** high-success mutations (status toggle, rename, assign) update instantly (<100ms perceived) with a subtle pending treatment (opacity 0.6 or inline 16px spinner); rollback animates 150–250ms + danger toast. Destructive/irreversible operations wait for the server.

**Reduced motion** (`prefers-reduced-motion: reduce`) is non-negotiable and matches BProton's own rule:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- `0.01ms`, not `none`: `transitionend`/`animationend` events still fire so JS never hangs.
- Transforms (slides, scales, lifts, staggers) degrade to plain opacity fades or nothing; state-change *feedback* must stay perceivable (reduced ≠ none).
- Skeleton shimmer becomes static. Tailwind usage prefers `motion-safe:` (opt-in) over `motion-reduce:` undo chains.
- Nothing auto-plays or auto-advances anywhere, so WCAG 2.2.2 is satisfied by construction.

---

## 6. Do-not list

1. **Do not** convey status or risk with colour alone: icon shape + text label accompany every coloured signal (WCAG 1.4.1).
2. **Do not** introduce an accent hue. Ink is the only interactive colour; blue is info status only; the logo's magenta, cyan and green never appear in the UI.
3. **Do not** use shadows for in-page structure. 1px borders + surface steps only; the primary button's `--shadow-button` pair and the single `--shadow-overlay` for dialogs, popovers, menus and toasts are the only shadows.
4. **Do not** use zebra striping, vertical column rules, or full grid lines in tables.
5. **Do not** use Instrument Serif below 20px or for data, numbers, body or buttons; do not use italic display type, font weights above 600, pure black text, or text below 11px.
6. **Do not** use proportional figures for any number a user might compare: `tabular-nums` everywhere numeric.
7. **Do not** ship spinners for content loads, full-page spinners ever, or skeletons that don't match the final layout px-for-px.
8. **Do not** scroll-reveal, stagger, or fade-in data (table rows, chart series); entrance choreography is for chrome, once, under 600ms total.
9. **Do not** auto-advance, auto-rotate, or auto-refresh visible content without a user-visible control.
10. **Do not** exceed 400ms for any interaction animation, or animate layout properties (width/height/top/left): transform/opacity only.
11. **Do not** put actions behind hover alone: every hover-revealed control has a keyboard/focus path.
12. **Do not** use viewport-fluid `clamp()` type, the `grid-line` column overlay, photography, or rounded-rect buttons in the app frame; do not make fields or status badges pills.
13. **Do not** recolour a button on hover or press; do not use `bg-accent` as a hover tint (it is ink).
14. **Do not** remove focus outlines without an equal-or-better `:focus-visible` replacement, use the source site's `ring-white/30`, or let sticky headers obscure focused elements (WCAG 2.4.7 / 2.4.11).
15. **Do not** improvise a dark theme; it waits for a BProton dark theme.
16. **Do not** redraw, recolour, crop or re-export the logo; show `bproton-logo.png` only, on its `foreground` tile.
17. **Do not** hardcode hex/px/ms at call sites: every value in this document exists to be referenced through its semantic token.
