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
- **Voice**: Australian English, sentence case headings and buttons, spaced hyphen ( - ) not em dash, verb-first calls to action of two to three words. A spaced middle dot ( · ) joins an identifier to a name or a second fact, because identifiers contain hyphens; a spaced hyphen replaces the em dash in prose.
- **Dates and times (CSRM extension, 2026-09-27).** A calendar date is shown without a zone. An instant is shown in the viewer's time zone; when only its date is shown, no zone label is added. When a time of day is shown and the viewer's zone is not yet known, the time is followed by ` UTC`. Formats are en-AU: `27 Sept 2026, 3:47 pm`.
- **File names and sizes (CSRM extension, 2026-10-01).** A file's name is shown as stored, escaped as text and wrapping anywhere; where one line is required it ends in an ellipsis beyond 28rem, with the full name in the DOM and in the accessible name of its controls. A size uses 1,024-byte units to match the limit's label: under 1 KB `{n} bytes`, under 1 MB whole kilobytes rounded up (`640 KB`), otherwise megabytes to one decimal place (`2.4 MB`), with `tabular-nums`. Amended on 2026-10-11 (Phase 14 stage B, IN-404 and WR-604): megabytes are rounded up, as kilobytes are, so a size over a limit never reads as the limit (`25.1 MB`); a size whose kilobytes, rounded up, would reach 1,024 reads in megabytes (`1.0 MB`); counts take en-AU grouping (`1,023 bytes`). A file type is named by its extension in capitals (`PDF`, `DOCX`, `XLSX`, `PPTX`, `CSV`, `TXT`, `PNG`, `JPEG`) in a label, and in sentences as `PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG`.

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

Families, self-hosted from `apps/csrm/app/fonts/` and loaded with `next/font/local` in the root layout (ADR 0001, amendment of 2026-10-02):

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

**Chart geometry and marks (CSRM extension, 2026-09-24).** Decided for the Phase 7 dashboard and reports, which ship the first charts.

| Token | Value | Use |
|---|---|---|
| `--chart-bar-thickness` | `0.5rem` | Horizontal bar thickness. A thin mark reads as data, not as a control or a field. |
| `--chart-plot-height` | `10rem` | Plot height of a column chart. |
| `--chart-column-max-width` | `2.5rem` | Widest column, so a few columns in a wide section never become slabs. |
| `--chart-bar-min-length` | `2px` | Shortest drawn mark for a non-zero value; the direct label carries the exact value. |

- Data marks are square-ended. A rounded thin bar reads as a pill, and pills mean action (§3.8).
- A severity mark fills with the rating's §3.6 `fg` token, never its `bg` tint: the tints sit near 1.05:1 on white and fail WCAG 1.4.11.
- Non-severity categories are always ink (`--chart-1`, `--chart-2`). Status hues never fill a data mark.
- A partial period, such as the current month to date, is an unfilled mark with a 1px dashed `--chart-1` outline, marked "(to date)" in the chart's table and explained by a one-item legend.
- Every chart carries a text equivalent: direct labels on the marks, and a table that assistive technology can read. Charts render at their final size, with no entrance motion.

---

## 4. Component-level guidance

### Logo lockup

- Show the mark only as `bproton-logo.png` (served from `public/`); never redraw, recolour or recreate it.
- Lockup: a square `--color-text-primary` (`foreground`) tile, `--radius-md`, 6px padding around a 20px mark (32px tile), followed by "BProton" in `--text-wordmark`, 10px gap. The mark image is decorative (`alt=""`); the link's accessible name is "BProton, IdamBox CSRM home". It begins with the visible word, so a person who speaks the word they see reaches the link (WCAG 2.5.3 Label in Name; corrected 2026-09-26, when the name "IdamBox CSRM home" failed axe `label-content-name-mismatch`).
- Used at the top of the sidebar and mobile navigation sheet, with the wordmark in `--color-text-inverse`, and on the sign-in card, with the wordmark in `--color-text-primary`. The same file is the favicon (`app/icon.png`).

### AppShell / sidebar

- Sidebar `--color-bg-sidebar` (`surface-dark`), 256px expanded / 64px collapsed (icon rail), full-height, no border (the colour change is the edge). It is the one dark section on every screen; page content never adds another.
- Nav items: 36px height, 13px/500 text in `--color-text-inverse-muted` for inactive items (7.6:1), icons 16px in the same colour on a strict 4px grid, `--radius-md` corners.
- **Hover**: `--color-bg-sidebar-active` fill and `--color-text-inverse` text.
- **Active item**: `--color-bg-sidebar-active` fill, `--color-text-inverse` text + **2px `--color-text-inverse` left bar that grows in vertically** (180ms expo). Never a filled-accent row.
- Section labels: `--text-micro` in `--color-text-inverse-muted`. Dividers: `--color-border-on-dark`. Focus: `--focus-ring-inverse`.
- Top bar: `--spacing-header-h-sm` (56px) below 768px, `--spacing-header-h-md` (64px) from 768px, sticky; `--color-bg-page` at 95% + `backdrop-blur(8px)` + 1px `--color-border-default` bottom hairline. The role indicator is a neutral tag.
- <768px: sidebar becomes an overlay drawer (260ms expo slide; reduced-motion: fade); 375px layouts are single-column.
- **Sidebar sections, counts and primary action (CSRM extension, 2026-09-28).** Navigation is grouped into sections named by job. A section label is `--text-micro` in `--color-text-inverse-muted` above a `--color-border-on-dark` divider; the top section, holding Home, has no label. A section of personal or occasional work may collapse: its label row is a button of the nav item height with a 16px `ChevronRight` (collapsed) or `ChevronDown` (expanded) before the label, `aria-expanded` and `aria-controls`, the item hover fill and `--focus-ring-inverse`; it opens itself when the current page is one of its items, and its state is never persisted. A count on an item that holds work is the neutral tag on the sidebar at the item's end, `tabular-nums`, in the item's text colour; a zero, a failed read or a refused read shows no count, and the count with what it counts is part of the link's accessible name. A collapsed section's label row shows its items' count. An actor's primary action sits first in the navigation as a full-width light-filled pill: `--color-bg-page` fill, the label in `--color-text-primary` at `--text-button` with a 16px icon, `--shadow-button-light`, lifting 1px to `--shadow-button-light-hover` on hover; it never recolours.

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
- **Keyboard shortcut hint (CSRM extension, 2026-09-28).** A control with a keyboard shortcut may show it after its label as keys: each key a `kbd` in `--text-micro` and `--color-text-secondary`, with a 1px `--color-border-default` boundary, `--radius-sm` and 4px horizontal padding. The hint is `aria-hidden`, the control carries `aria-keyshortcuts`, the hint names the viewer's platform (`⌘` on Apple devices, `Ctrl` elsewhere) and renders after mount, and it is not shown below 768px. The header's search control sits beside the role indicator: from 768px an outline pill with a 16px `Search` icon, its visible label and the hint; below 768px an icon-only circle at the touch-target size. Its accessible name is its label at every width.

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
- When horizontal scrolling is needed, the identifier header and first body cell stay sticky on the left, retain their row-state background, and use a 1px `--color-border-default` right hairline with no shadow. Whenever the table is wider than its container, and only then, the scroll container is a keyboard-focusable region (`role="region"`, `tabindex="0"`) named `{table name}, scrolls horizontally`; a table that fits exposes no region. Arrow keys scroll it, the focus ring draws on its frame, and `scroll-padding` keeps a focused cell clear of the sticky column and header. Every DataTable applies the sticky identifier column while it overflows.
- **Scroll cues (CSRM extension, 2026-09-25):** token `--table-scroll-fade-width: 1.5rem`. While columns are hidden beyond the end edge of a horizontally scrolling table, a fade of `--table-scroll-fade-width` from transparent to `--color-bg-surface` covers that edge of the header and body. It is decorative and pointer-transparent, disappears at the end of the scroll, has no transition and is never a shadow. The start edge is cued by the sticky first column's 1px `--color-border-default` end hairline, which appears only while the table overflows.
- **Long-text columns (CSRM extension, 2026-09-25):** A long-text column (a statement, a title, a condition) wraps, clamps to two lines, keeps the full text in the DOM and is bounded between `14rem` and `28rem` wide. Rows grow to fit; cells stay vertically centred. Mobile cards clamp to three lines.
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
- **Tone vocabulary (CSRM extension, 2026-09-25):** Tones mean one thing across every record type: neutral for not yet started or terminal, info for work in progress with or waiting on the Requestor, warning for work waiting on a Security Analyst, success for submitted, approved or released, danger for a recorded overdue state. One shared mapping owns every status value's label, tone and icon; feature code never chooses them.
- **CSV import rows (CSRM extension, 2026-09-26):** the five states a CSV import gives each row, in its review and its results, are status values in the import-only row mapping, rendered through the shared tone badge (Phase 19, so only the import route loads them). A row that is or will be written, `Create` or `Update`, is success; an `Unchanged` row is neutral; a `Rejected` or `Ambiguous` row waits on the Security Analyst to correct the file, so it is warning, never danger. Icons: `Check`, `RefreshCw`, `FileCheck2`, `CircleX` and `CircleQuestionMark`; `Ambiguous` never uses the High severity triangle.
- **Matched by similar name (CSRM extension, 2026-10-01; extends CSV import rows).** An import row whose name equals an existing record's only when capitals, spacing and character width are ignored is a sixth import row state, `Matched by similar name`, in the import-only row mapping, rendered through the shared tone badge: warning tone, because it waits on the Security Analyst, with the `CaseSensitive` icon, never a severity shape. The row names the existing record and asks for a decision in a radio group named `Decision for row {n}`, with nothing chosen: `Update “{existing name}”`, which uses the row's other values and keeps the existing name, and `Skip this row`, which leaves the record as it is; creating a record is never offered. The chosen decision follows the badge as `Your choice: Update` or `Your choice: Skip` in `--text-caption`. While any similar row exists, a warning alert above the rows counts them and `{d} of {k} decided` (a polite live region), and offers `Update all {k}` and `Skip all {k}` as outline small pills and `Show these rows`; a bulk choice that replaces individual choices confirms with an Undo toast. Continuing with an undecided row is refused beside the action with the number left, and focus moves to the first one. Choices last while the person moves between review and confirmation, and choosing another file warns before clearing them. In results, a skipped row keeps the badge with `Skipped by your choice.`
- In ultra-dense table cells, the Linear alternative is allowed: severity icon + plain text in `fg` colour, no tinted chip. Same tokens, less ink.
- Counts inside badges: `tabular-nums`. Icon-only renderings (avoid) require `aria-label`; live status changes announce via `aria-live="polite"`.
- Max ~5 distinct statuses visible per view; roll-ups show the highest severity.
- **Urgency (CSRM extension, 2026-09-24):** time-bound work carries an urgency, which is a status and never a severity. `Overdue` uses the danger status recipe with `CalendarX2`, `Due soon` the warning recipe with `CalendarClock`, and `Needs attention` the info recipe with `Flag`. None reuses a severity or status icon. The badge carries a visually hidden `Urgency:` prefix, so a card or row without a column header still announces what the label means. Where the source is a Risk, the Risk's own rating badge sits beside the urgency; the two are never merged.

- **AI provenance (CSRM extension, 2026-10-01).** AI-written content is marked until a Security Analyst reviews it. A field or question still awaiting review carries the status badge `AI proposed` (warning recipe, `Sparkles`), because it is work waiting on a Security Analyst; a statement that cites no source carries `No source cited` (warning recipe, `Unlink`). Both are values in the one shared status mapping. Once reviewed, the badge gives way to a provenance note: a 12px icon and `--text-caption` text in `--color-text-secondary`, with no fill or border, such as `Confirmed` (`Check`), `Edited` (`PenLine`) or `Added by analyst` (`UserRoundPen`); a note is not a status badge. A marker sits on its field's label row after the label, and the field's control names it in its description. A record generated with AI opens with a provenance header: a `--color-bg-surface` card with a `--color-border-default` hairline, `--radius-lg` and the Cards padding, a 16px `Sparkles` in `--color-text-secondary`, who asked for the generation in `--text-body` at 500, when and with which provider and model in `--text-caption`, and how much review remains. A Requestor never sees a marker, provider or model; where AI assisted, their page says so in one `--text-body` sentence in `--color-text-secondary` beside a 16px `Sparkles`. AI has no colour of its own, and AI content is never styled as final.

- **AI proposal items (CSRM extension, 2026-10-01).** Changes the AI proposes to a record's content, one item per addition, change or removal, are reviewed in a section headed `AI proposals`, grouped by the request that produced them, newest first. A group opens with an h3 naming who asked the AI and the instruction in typographic quotes (AI instruction field), a `--text-caption` facts line with when (Dates and times), the provider and model and how many remain open, a `{n} left out` figure link that opens a plain-language list of what CSRM did not keep and why, `Show what the AI used` as a ghost small pill opening the Side sheet, and `Reject remaining ({n})` as an outline small pill; there is no confirm-all control. Each item is a card on `--color-bg-surface` with a 1px `--color-border-default` boundary, `--radius-lg` and 16px padding: a `--text-micro` eyebrow with a 12px icon naming the kind (`Plus` for an addition, `PenLine` for a change, `CircleMinus` for a removal), the item's subject in `--text-body` at 500, its content, the AI's reason under a `Reason` micro-label, and its Source citations. A change shows a before-and-after comparison: from 768px a table with row headers naming the fields and two columns, `Current` and `Proposed`, with the DataTable's cell padding and hairlines; below 768px each field stacks its current value above its proposed value under `Current` and `Proposed` micro-labels. A changed field carries the provenance note `Changed` (`PenLine`) in its row header, never colour alone; unchanged fields collapse behind an outline small `Show {n} unchanged {field|fields}` toggle. Values render as they do elsewhere, so a rating stays its badge; where changed words are emphasised, inserted words are an `ins` at weight 500 on `--color-bg-inset` and removed words a `del` with a line-through in `--color-text-secondary`. An addition shows its proposed values and where it will go; a removal shows the current values and what confirming does. An open item offers `Confirm` (outline small, `Check`), `Edit, then confirm` (ghost small, `PenLine`), which opens the In-place edit form inside the card prefilled with the proposal and waits for the server, and `Reject` (ghost small, `X`), which opens an inline optional reason that `Enter` submits and `Escape` dismisses; the visible word is never `Accept`. `Confirm` and `Reject` apply at once, confirm with an Undo toast and move focus to the next item's `Confirm`; on phones the actions stack at full width and the touch-target height, `Confirm` first. An item whose basis has changed carries the status badge `Changed since proposed` (warning recipe, `History`) with a line saying what to do, and offers only `Reject`. Decided items leave the open list for a collapsed `Decided proposals` group behind an outline toggle with its count, each with a provenance note naming the decision, who and when (`Confirmed`, `Edited, then confirmed`, `Rejected` with its quoted reason, `Replaced by a newer proposal`, `Closed without a decision`) and `Undo` while the server allows it. The section offers comfortable and compact densities, persisted per person as the DataTable's is; compact uses 12px card padding and collapses each card's reason and sources behind `Show reason and sources`. Where a record cannot take a decision now, one line says why once for the section, never a disabled control per item.

- **Field decisions and similar records (CSRM extension, 2026-10-01).** This extends AI proposal items to proposals about a record's fields. **Field decisions:** a proposed change to one record whose fields are decided separately, such as an AI rewrite of a Risk, shows one before-and-after comparison inside that record, under its own heading, with the group's who, instruction and facts lines. Its rows are grouped into changes, and fields that derive from one another (a likelihood, a consequence and the rating derived from them) form one change, decided together. From 768px each change is a `tbody` whose final `Decision` cell, with a visually hidden header, spans its rows and holds `Confirm` (outline small, `Check`) and `Reject` (ghost small, `X`). Below 768px each change is a stacked card, current value above proposed, with full-width actions, `Confirm` first. A decided change stays in place with its provenance note (`Confirmed` or `Rejected`, who and when) and `Undo`, and the comparison moves to `Decided proposals` once every change is decided. Beside `Reject remaining ({n})`, such a comparison offers `Confirm all ({n})` (outline small, `ListChecks`), counting only the changes that can be confirmed. It is the only confirm-all control, and it stays within one record's comparison. A change whose basis has moved, or that a rule no longer allows, says why in one line and offers only `Reject`. While the record's own form holds unsaved changes, `Confirm` and `Confirm all` give way to one line asking the analyst to save or discard first. **Proposed records:** a proposed new record is an item whose eyebrow names its kind (`Proposed risk`, `Plus`), whose subject is its title, and which shows a one-line summary of its key facts, its rating badges, and its full proposed values behind an outline `Show proposed details` toggle. Its decision names where it goes, such as `Add to assessment` (outline small, `Plus`). That waits for the server, because it creates the record, and confirms with a toast offering `Open {identifier}` in place of Undo. A group of proposed records has no add-all control. **Similar records:** a proposed record that resembles an existing, withdrawn, rejected or open one carries the provenance note `Similar to {identifier}` (`Copy`), or `Similar to a withdrawn risk, {identifier}`, `Similar to a rejected proposal` or `Similar to an open proposal`. It also carries an outline `Compare with …` toggle that opens the before-and-after comparison with the other record's name and `Proposed` as its column labels and `Same` (`Equal`) in place of `Changed` on matching rows, and a ghost `Reject as duplicate` that rejects at once with the reason `Duplicate of {identifier}`. The decided group, densities, Undo and the visible verbs are as for AI proposal items; the visible word is never `Accept`.

- **Answered question note (CSRM extension, 2026-10-01).** Where a Security Analyst may know that a question is answered but the AI may not change it, the question carries the provenance note `Answered` (`LockKeyhole`), with a visually hidden ` - the AI can’t change or remove it`; it reveals that an answer exists, never the answer or whether it is a draft. It is shown only where answered questions are fixed and the analyst may know of them, and never while the Requestor is still answering a released questionnaire, where only the count of answered questions is shown. A section reviewing AI proposals lists the answered questions behind a `{n} answered {question|questions} stay as they are` figure link, collapsed by default, and offers no AI rewrite on them.

- **AI input mark (CSRM extension, 2026-10-01).** Supplementary text that a Security Analyst opts into what CSRM sends to the AI carries the §4 Forms switch labelled `Changes the AI inputs`, which applies at once with an Undo toast; when the text is created, the same choice is a checkbox, off by default. A Security Analyst who may not change it sees the provenance note `Changes the AI inputs` (`Sparkles`) instead; a Requestor sees neither. When the marked set differs from what a record's latest generation used, the record's provenance header, and the card that generates it, add `AI inputs changed since this {record} was generated` in `--text-body` at 500 beside a 16px `Sparkles`, then a list of the changed items as record links, each with `Marked since` or `Unmarked since` in `--text-caption`, then `The AI hasn’t seen these changes.` The signal offers no action of its own.

- **AI input files (CSRM extension, 2026-10-01; extends AI input mark).** A file whose text a Security Analyst may include carries the AI input mark's switch, with a `--text-caption` / `--color-text-secondary` line beneath it stating what is sent: `Not included`, `Included · all {m} characters` or `Included · first {n} of {m} characters`, so truncation is never silent. Turning it on reads the file first, so the switch waits for the server with `Reading the file’s text…` and the 16px inline spinner, then confirms with an Undo toast; turning it off applies at once. A file that cannot be included shows one `--text-caption` line saying why in place of the switch; a reason that applies to every file, such as the request's data classification or a requesting analyst, is said once for the section instead. `Preview text` (ghost, small, `ScanText`) opens a side sheet with the stored text exactly as sent, in a `--color-bg-inset` well in `--text-body` with line breaks kept, ending with how much is left out. In the `AI inputs changed` signal a file's caption is `Included since`, `Excluded since` or `Removed since`; in `What the AI used` a `Files` group lists each included file by name with its part and the characters sent, and a file removed since the run still shows, marked `Removed since`. A Requestor sees only the section's sentence that a Security Analyst may include a file's text.

- **Unread (CSRM extension, 2026-10-01).** Something new to the viewer, such as a note they haven't seen, is marked in ink, never in a status hue, because unread is a personal fact and not a status: on a count, a 12px `MessageSquareDot` and `{n} new {noun}`; on one item, an 8px `--color-text-primary` dot with `--radius-full` and `New`; the text is `--text-caption` at 500 in `--color-text-primary`. A count of new items is a figure link to them, and a list that can hold unread items offers a filter for them. The marker stays for the view in which the items were first shown and clears on the next.

### Withdrawn records

- **Withdrawn records (CSRM extension, 2026-10-01).** A record that a Security Analyst takes out of its parent without deleting it, such as a withdrawn Risk, is withdrawn, never deleted or removed, and copy never names the act `Delete`, `Remove` or `Not applicable`. It carries the status value `Withdrawn` (neutral tone, `Archive`) from the one shared mapping. It leaves every count, figure, gate, export and default list, and only the people who may reinstate it see it. Its list offers a segmented control labelled `Show` with `Active ({n})` and `Withdrawn ({n})` in `tabular-nums`, kept in the page address so a link can open either. Elsewhere, such as a register, `Withdrawn` is an explicit filter value that no default view includes, and choosing it adds one line saying who sees these records and that they count nowhere. A withdrawn record is a collapsed, read-only card on `--color-bg-surface` with a 1px `--color-border-default` boundary, `--radius-lg` and the Cards padding. The card holds its identifier, the `Withdrawn` badge, its rating where it has one, its title clamped to two lines, `Reason: “{reason}”` in `--text-body` and `Withdrawn by {name} · {instant}` in `--text-caption` / `--color-text-secondary`. Its actions are the small pills the server allows: `Reinstate {record}` (outline, `ArchiveRestore`), `History` (ghost, `History`) and an outline `Show details` toggle that reveals the record's read-only view in place. Withdrawing and reinstating each ask for a required reason of up to 500 characters in the In-place edit form, or a bottom sheet below 768px, with `Enter` to submit and `Escape` to keep the record as it is. Each applies at once, moves the record between the two lists, moves focus to the next record and confirms with an Undo toast. Neither asks for confirmation, uses the destructive button or loses the typed reason on a refusal. Where a record cannot be withdrawn or reinstated now, one line says why, never a disabled control.

### Forms

- **Single column, always.** Max field width 640px. ~5 fields per titled section; sections separated by 32px + `--text-heading-sm` header + hairline rule.
- Labels: top-aligned, `--text-body` at 500, sentence case sans, 6px above the field. Optional hint text `--text-caption` in `--color-text-muted` below the label.
- Inputs, selects, textareas: 36px height, `--radius-md` (a rectangle, never a pill), `--color-bg-surface`, 1px `--color-border-strong` (5.5:1 ✓). Hover: border → `--color-text-primary`. Focus: `--focus-ring`. Placeholder `--color-text-muted`, never a substitute for a label.
- Checkbox and radio: `--color-border-strong` boundary; checked = `--color-primary` fill with `--color-on-primary` glyph. Switch: off = `--color-border-strong` outline track, on = `--color-primary` track.
- Validation: **on blur**, not per keystroke. Error = danger-fg `--text-caption` + 14px icon directly below the field, input border → `--color-danger-fg`; the message says what's wrong *and* how to fix it. Red is never the only signal.
- Prefer radios/segmented controls over selects for ≤4 options. Segmented controls are pills. Multi-step flows: 2–3 steps with a step indicator.
- **Segmented control (CSRM extension, 2026-09-24):** a radio group (`role="radiogroup"`, named by a visible label) drawn as a pill group on `--color-bg-surface` with a `--color-border-strong` boundary, because a radio boundary carries meaning. Segments are pills. Checked: `--color-primary` fill with `--color-on-primary` text. Unchecked: transparent, `--color-text-primary`, hover `--color-bg-hover`. Arrow keys move and check; Tab enters and leaves the group once. Labels use `--text-button`; height follows the small button height, and the touch-target height below 768px.
- **Save status (CSRM extension, 2026-09-27).** A form that saves in place confirms beside its Save control, or in its progress card for autosave, in `--text-body` / `--color-text-secondary` with a `CheckCircle2` at the inline-message icon size in `--color-success-fg`: `{Record} saved at {time}`, or `Saved at {time}` for autosave. The confirmation is a polite live region and clears on the next change. A save in progress shows `Saving…`, visibly but not announced. A failed save shows its message with an `AlertCircle` at the same size in `--color-danger-fg` and a recovery control, announced once. Colour is never the only signal.
- **Record picker (CSRM extension, 2026-09-27).** A single record chosen from a large or growing list uses a searchable combobox, never a native select: a labelled field with a hint, a `Popover` listbox at the field's width with `.micro-label` group labels, a suggested group first when the context has one, server-side search on typing, the active option on `--color-bg-inset`, and the chosen record shown below the field as `Selected {noun}: {label}` with a `Clear` control. Enter never submits the surrounding form.
- **In-place edit form (CSRM extension, 2026-09-27).** A form that edits or adds one item in a list opens where it was invoked, in place of the item it edits or at the end of its group, as a well on `--color-bg-inset` with a `--color-border-default` hairline, `--radius-lg` and the Cards padding (lower bound). Focus moves to its first field; saving moves focus to the saved item and discarding returns it to the control that opened the form. One such form is open at a time.
- **File field (CSRM extension, 2026-10-01).** Files are chosen with a labelled file field: a `--color-bg-surface` region with a 1px dashed `--color-border-strong` boundary, because the boundary is the drop target's only cue, `--radius-lg`, and 24px padding from 768px (16px below). It holds a 16px `Upload` icon in `--color-text-secondary`, the line `Drag files here, or` in `--text-body`, and a `Choose files` outline small pill that opens the browser's file chooser and is always the primary path; below 768px the drag line is not shown and `Choose files` is full width at the touch-target height. A hint in `--text-caption` / `--color-text-secondary` names the allowed types and the limits. While files are dragged over it, the boundary becomes solid `--color-text-primary` and the region takes `--color-bg-hover`, at the control-state timing; files dropped anywhere else on the page are ignored, so the browser never leaves the page to open one. The region is not a tab stop and dragging is never required. Chosen files are checked in the browser for type, size and count before anything is sent, and a refused file is listed with its reason, never dropped silently. Where files cannot be added, one `--text-body` line in `--color-text-secondary` beside a 16px icon says why in place of the field.
- **Upload queue (CSRM extension, 2026-10-01).** Files being added are a named list under their field or composer, one row per file in the order chosen, on `--color-bg-surface` with `--color-border-default` hairlines and at least the 44px row height. A row shows the file-type icon, the name in `--text-body` at 500, wrapping anywhere, the size in `--text-caption` with `tabular-nums`, and its stage as a 14px icon with `--text-caption` text: none while chosen and not yet sent; `Waiting` (`Clock`); `Adding…` (the 16px inline spinner); `Added` (`CheckCircle2`, `--color-success-fg`); `Added. Waiting for the malware check before anyone can download it.` (`ShieldEllipsis`); or `Not added.` (`AlertCircle`, `--color-danger-fg`) followed by what is wrong and how to fix it. Waiting and neutral stages use `--color-text-secondary`. Files are sent one at a time, so one failure never stops the others. A file not yet being sent can be taken off the list; a refused file offers `Choose another file` and `Remove from list`; a failed transfer offers `Retry`, which sends the same file without choosing it again. Each repeated row control's accessible name begins with its visible label and names its file. One `--text-caption` line above the rows counts `{a} of {n} files added` and is the queue's only announcement. While a file is waiting or being added, leaving the page warns first. A file not added (refused, or awaiting `Retry`) is kept in memory for the browser tab, keyed to the person and the record, and returns with its reason and actions wherever that record lists it under `Restored from earlier in this session.`, so in-app navigation never drops it; while one is kept, reloading or closing the tab warns first, and file contents are never written to browser storage.
- **AI instruction field (CSRM extension, 2026-10-01).** An instruction a Security Analyst gives the AI is an optional labelled textarea, `Instruction for the AI (optional)`, three rows growing to eight and then scrolling, with a hint that says what the AI already reads and gives an example in typographic quotes, and, once it holds text, a `--text-caption` / `--color-text-secondary` count `{n} of 500 characters` with `tabular-nums` that is not announced. It is checked when its action is pressed; an error shows under the field (Forms) and the text is never cleared by a refusal. Its action is the button that asks the AI, with the keyboard shortcut hint `Ctrl` or `⌘` with `Enter` from 768px. Unsent text is kept for the browser session per person and record, restored with `Restored from earlier in this session.`, guards reload and close, and clears once the AI has been asked. Wherever an instruction is shown afterwards, it is plain text in typographic quotes with line breaks kept, labelled `Instruction`, clamped to three lines with a `Show full instruction` toggle; with none, the line says what the AI did instead. A Requestor never sees an instruction, and a Security Analyst who may not give one sees a line saying why in place of the field.

### Cards / KPI tiles

- Card: `--color-bg-surface`, 1px `--color-border-default`, `--radius-lg`, padding 16–20px. **No shadow.** Hover (only if the card is a link): border → `--color-border-ink` + translateY(−1px) at 120ms expo.
- KPI tile anatomy (top-left = most important; max 4–6 per row):
  1. `--text-micro` caption (e.g., `OPEN CRITICAL FINDINGS`)
  2. `--text-display` value, `tabular-nums`
  3. Delta: `--text-caption`, icon (▲/▼) + signed value + period; icon and sign carry direction, colour (success/danger fg) is reinforcement only
  4. Optional 32px sparkline in `--chart-2`, severity hue only when the metric itself is a severity.
- 3-second rule: a tile must be readable at a glance; no mixed messages per tile.
- **CSRM extension (2026-09-24):** an optional supporting line after the value, in `--text-caption` / `--color-text-secondary`, names what is counted ("Overdue" what?). A tile that opens a list is one link with a trailing `ChevronRight` in `--color-text-muted` as its at-rest cue; a plain tile has no chevron, hover or lift, so the two are distinguishable at rest. A value the server cannot supply renders `Not available` in `--text-body`, never a dash or a zero. The delta keeps its reserved position even when absent.

### Page header

- Page title in `--text-heading-lg` (Instrument Serif 400, 28px). An optional `--text-micro` eyebrow sits above it; the description below uses `--text-body` in `--color-text-secondary`.
- Actions sit right on desktop and stack full-width below 768px.

### Lifecycle stepper

- **Compact lifecycle stepper (CSRM extension, 2026-09-28).** Below 768px a lifecycle stepper keeps its heading and shows, in order: `Step {n} of {m}` in `--text-body` at 500 with `tabular-nums`, the next action, and an outline disclosure button at the touch-target height, `Show all steps` or `Hide all steps`, with a `ChevronDown` or `ChevronUp` swapped with no transition, `aria-expanded` and `aria-controls`, which reveals the full ordered list below it. From 768px the full stepper shows and the compact lines do not. The next action is displayed once per width.

### Dialogs

- Scrim `--color-bg-scrim`, fade 220ms. Panel: `--color-bg-surface`, `--radius-2xl`, 1px `--color-border-default` **+** `--shadow-overlay` (overlays float; in-page structure never does).
- Enter: opacity 0→1 + scale 0.98→1, 220ms expo. Exit: 160ms `--ease-in`, fade + scale to 0.98.
- Sizes: 480px (confirm), 640px (form), 800px (complex). Destructive confirms use the destructive pill + explicit noun ("Delete 3 assessments").
- Focus trapped; initial focus on first meaningful control; Esc closes non-destructive dialogs.
- **Quick find (CSRM extension, 2026-09-28).** A command dialog for finding records. From 768px it is the form size (640px), horizontally centred and anchored `--spacing-header-h-md` plus 48px below the top of the viewport, so its top edge never moves as results arrive; its list scrolls within the remaining viewport height less 48px. Below 768px it is a full-screen sheet with a visible title row and a Close control. The input row (a 16px `Search` icon, the input at `--text-body`, and a Clear control while it holds text) sits above a `--color-border-default` hairline and shows the focus ring while focused. Results are grouped under `.micro-label` headings with their totals; an option is two lines (`--text-body`, then `--text-caption` in `--color-text-secondary`), at least the touch-target height below 768px, and the active option is `--color-bg-inset`. From 768px a footer row shows the keys that move, open and close as keyboard shortcut hints. Loading rows are skeletons after 300ms; while a newer search runs, the previous results stay at the §5 pending opacity.

- **Side sheet (CSRM extension, 2026-10-01).** Supporting detail read beside the page, such as what an AI run used, opens in a side sheet. From 768px it is a full-height panel at the end edge, at the form dialog width (640px) bounded by the viewport, on `--color-bg-surface` with a 1px `--color-border-default` start edge and `--shadow-overlay`, over `--color-bg-scrim`, entering per the §5 drawer row and fading only under reduced motion. Below 768px it is a full-screen sheet with a visible title row and a `Close` control, as quick find's phone sheet is. Its title is an h2 in `--text-heading-sm`; its groups are h3 headings in `--text-heading-sm` over definition lists whose labels are `.micro-label`, 24px apart; its body scrolls inside it. Focus moves to the title on open and returns to the trigger on close; `Escape` closes it. (Amended 2026-10-08, when the Phase 12 browser walk found that `.micro-label` group headings read the same as the row labels under them.)

- **Record history (CSRM extension, 2026-10-01).** A record's change history opens from a small `History` pill (`History`, ghost on a card, outline in a page header) in a Side sheet titled `History of {identifier}`, newest first, with `{shown} of {total} {change|changes}` in `--text-caption` with `tabular-nums`. Each entry is an `li` on `--color-bg-surface` with a 1px `--color-border-default` boundary, `--radius-lg` and 12px padding. It holds a 16px icon in `--color-text-secondary` and the change in `--text-body` at 500, then `{instant} by {name}` in `--text-caption` / `--color-text-secondary` (Dates and times), then the lines that apply: `Reason: “{reason}”`, a `Source:` line naming how the change was made (by hand, from a confirmed AI proposal, by an Undo) with a record link to the proposal while it is listed, and the changed fields as the AI proposal items' before-and-after comparison, read-only, with the column labels `Before` and `After`, no decision column and no unchanged rows. An item taken off the record lists its values at that moment. A value keeps the label it had when recorded, and an entry whose details cannot be read says so in one line rather than failing the list. Entries load 25 at a time. An outline `Show older changes` loads the next 25 and moves focus to the first new entry. Where recording began after the record was created, the list ends with `History recorded from {date}. Earlier changes to this record weren’t recorded.` The sheet offers comfortable and compact densities, persisted per person; compact collapses each comparison behind `Show {n} changed {field|fields}`. Review decisions that change no value are not history entries.

- **Export (CSRM extension, 2026-10-01).** A list or record that can leave CSRM as a file offers `Export`, an outline pill with a 16px `Download` icon, last among its page header's actions and never disabled there. It opens an export dialog at the form size (640px); below 768px it is a full-screen sheet with a visible title row and a `Close` control, as the side sheet's phone form is. Its title is `Export {page heading}`. In order it holds: a `--text-body` sentence stating how many rows the file will hold, with `tabular-nums`, that every page is included, and the active search and filters in `--text-caption` using the filter chips' labels, joined by the middle dot; a `Format` segmented control, `Excel workbook (.xlsx)` first and the default, then `CSV (.csv)`, with a `--text-caption` hint for the checked format; for a file of several tables, a `Table` radio group shown only for CSV; then a column choice, or for fixed tables a line saying every column is included. A column choice is a fieldset with the legend `Columns`, the count `{k} of {n} columns`, a `Select all` ghost small pill hidden when all are checked and a `Reset to visible` ghost small pill shown only while the choice differs from the visible columns, over checkboxes labelled with each column's on-screen header in the view's column order, one column below 640px and two from 640px, 8px apart; it opens with the visible columns checked, and with none checked it says `Choose at least one column.` as a field error. When nothing matches, or the rows exceed the export limit, a line or a warning alert says so and how to fix it, and the submit is disabled and described by it. The submit is the primary pill `Export file`, pending as `Exporting…` with the inline spinner while every choice stays in place. On success the dialog closes, the browser saves the file under the server's name, focus returns to `Export`, and a success toast reads `Exported {file name}` with the row count. A refusal shows in the dialog above its actions, says what happened and how to fix it, and keeps every choice. An export changes nothing, so it asks for no confirmation and offers no Undo. Focus starts on the checked format; `Enter` exports and `Escape` closes. A template or other file a person downloads confirms with the success toast `Downloaded {file name}`.

### Toasts

- Bottom-right stack, max 3 visible. `--color-bg-surface`, 1px border, `--radius-lg`, `--shadow-overlay`, 4px left edge in status colour + status icon + title/body text (colour never alone).
- Enter 220ms expo (translateY 8px→0 + fade); exit 160ms. Auto-dismiss 5s for info/success; **warning/danger persist until dismissed**. Hover pauses the timer.
- Optimistic-mutation failures land here: revert animates 150–250ms + danger toast with retry affordance.

- **Undo toast (CSRM extension, 2026-10-01).** A reversible action applies at once and confirms with a success toast that names what changed and offers `Undo` as an outline small pill inside the toast. It follows the success timing (5s), pausing while hovered or while focus is inside it, and `Alt+T` moves focus to the toast region. `Undo` reverses exactly that action and confirms with a plain success toast; if the action fails, its change rolls back and a danger toast says why, with `Try again` or `Refresh page`. What an Undo reverses can still be corrected on the page after the toast closes. Reversible actions never ask for confirmation; governance-significant, irreversible steps always do.

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
- **Cleared (CSRM extension, 2026-09-24):** the cleared/complete type is "No {noun}", without "yet", an optional domain-fact description, and no action. "No overdue treatments yet" would misstate a queue that is clear.

### Record links

- A record identifier or title that opens that record uses `RecordLink`; feature surfaces do not style record navigation themselves.
- Record links use `--color-text-link` (ink), 500 weight, and a visible 1px underline at rest in `--text-link-decoration` with a 3px offset. Link and body text share a colour, so the at-rest underline is the non-colour cue and is never removed. On hover and `:focus-visible`, the underline becomes `--color-text-link`.
- Only text-decoration colour transitions, using `--duration-micro` and `--ease-standard`. Context determines text size; the record-link contract does not.
- **Block links (CSRM extension, 2026-09-24):** a link that is a whole tile, row or card is not underlined, so it carries a trailing `ChevronRight` in `--color-text-muted` as its non-colour cue on touch devices. A block link that contains a record identifier still opens through one keyboard target only.
- **Figure links (CSRM extension, 2026-09-28).** A figure that opens the records behind it is a link whose list total equals the figure. A tile or a row is one block link (§4 Cards, block links); a figure in a table or a chip is a text link with the record-link treatment on the figure alone, right-aligned with `tabular-nums` like any numeric cell. A figure of zero in a table or a chip is plain text. A sum of linked parts stays plain. A row header may link to the records its row describes when its figures cannot, and its name says so. Each link's accessible name begins with its visible figure or label, then says what it counts.

- **Source citations (CSRM extension, 2026-10-01).** A statement that cites its sources is followed by a `Sources` micro-label and a wrapping list of citations, each `{kind}: {label}` in `--text-caption` at 500 with the record-link treatment and 4px block padding, so each target is at least 24px tall. A citation keeps one line, ending in an ellipsis beyond 28rem, with its full text in the DOM. A citation that can show its source is a button that opens it: from 768px a `Popover` (`--radius-lg`, `--shadow-overlay`) no wider than the confirm dialog size, below 768px a bottom sheet; the source shows its label, its value as recorded and a record link to where it lives, and loads with a skeleton after 300ms. A citation whose source has nothing more to show is plain text. A statement with no source shows the `No source cited` badge instead of the list.

### Assignee control

- **Assignee control (CSRM extension, 2026-10-01).** A record with one accountable person shows who holds it in an assignment block: `Assigned to {name}`, or `Not picked up`, in `--text-body` at 500, then who assigned them and when, or who may pick it up, in `--text-caption` / `--color-text-secondary`, then only the actions the server allows this viewer, as outline small pills that stack at full width and the touch-target height below 768px. Taking or giving back the record (`Pick up`, `Assign to me`, `Return to queue`) applies at once and confirms with an Undo toast. Choosing someone else opens a picker that lists only the people who may hold the record: from 768px a popover at the confirm dialog width holding the record picker's search and listbox, an optional reason and an `Assign to {name}` action; below 768px the full-screen side sheet. Choosing a person never applies on its own. In a list, the holder is a column of names; an unheld row offers `Pick up` as an outline small pill to a viewer who may take it, and otherwise reads `Not picked up`. A viewer who may not act sees why in words, never a disabled control. The history sits behind an outline toggle, newest first, one sentence per change naming who, whom and when, with any reason quoted.

### Notes thread

- **Notes thread (CSRM extension, 2026-10-01).** An append-only conversation on a record is a section headed `Notes`: an ordered list, oldest first, of notes separated by `--color-border-default` hairlines with 16px block padding, with no bubbles, avatars or colour per author. Each note starts with the author's name in `--text-body` at 500, then their part in words and the posting time (Dates and times) in `--text-caption` / `--color-text-secondary`; its body is `--text-body` with line breaks kept, never rendered as HTML or Markdown and never auto-linked, clamped to ten lines with a `Show full note` toggle and printed whole. Earlier notes load above the list through an outline `Show earlier notes` button. The composer follows the newest note: a labelled textarea, three rows tall and growing with its text, a hint that says who reads notes and that a note can't be changed once added, and the add action with its keyboard shortcut hint (`Ctrl` or `⌘` with `Enter`). A note being added shows at once at the §5 pending opacity with `Adding…`; a failure removes it and returns its text to the composer. Unsent text survives navigation for the browser session. Where notes are closed, one `--text-body` line in `--color-text-secondary` with a 16px `Lock` says why in place of the composer, and any unsent text stays readable and copyable.

### File list

- **File list (CSRM extension, 2026-10-01).** The files on a record are a section headed `Files`, newest first. From 768px they are a DataTable with both densities: the file-type icon (`FileText` for PDF, DOCX and TXT, `FileSpreadsheet` for XLSX and CSV, `Presentation` for PPTX, `FileImage` for PNG and JPEG) and the name as a long-text column with the type as a `--text-micro` label beneath, the size right-aligned with `tabular-nums`, who added it with their part in `--text-caption`, when (Dates and times), where it came from, and the actions the server allows this viewer: `Download` as an outline small pill with its icon, then `Remove` as a ghost small pill. Below 768px each file is a card: icon and name, type and size, who and when, then `Download` at full width and the touch-target height, with every other action in a bottom sheet opened by an icon-only `More actions for {name}` circle. A file that cannot be downloaded shows a status badge from the one mapping in place of `Download`, with its consequence in a `--text-caption` line: `Waiting for malware check` (`ShieldEllipsis`), `Blocked` (`ShieldX`) or `File unavailable` (`FileX`); all are neutral, because none is work waiting on a person, and an available file shows no badge. Removed files leave the list for a collapsed `Removed files` group behind an outline toggle with its count, each showing who removed it and when, with `Restore` for the person who removed it; removing and restoring apply at once with an Undo toast and never ask for confirmation. Files never preview inline; they only download, and a download shows its pending state in its button. A file shown inside another record, such as a note, is a file chip: a rectangle with a 1px `--color-border-default` boundary, `--radius-md` and 8px by 12px padding holding the icon, the name on one line, the size and an icon-only `Download {name}` or the file's badge; only a chip can show the neutral `Removed` badge (`ArchiveX`), because a removed file is no longer in the list.

### Iconography

- Lucide React, the default 2px stroke, `currentColor`. 16px in navigation and controls, 12–14px inside badges and inline messages.
- Icons are `aria-hidden` when a visible label is present; an icon-only control carries an accessible name.
- Icons support meaning, never replace it. No decorative illustrations and no emoji (BProton rule, kept).

### Sign-in

- A single `--color-bg-surface` card, `--radius-lg`, on `--color-bg-page`. The logo lockup sits at the top; the heading uses `--text-heading-lg`. Actions are primary pills at `--spacing-control-h`.

### Print

**Print (CSRM extension, 2026-09-25).** The shell (sidebar, header, skip link, footer, sheets, overlays) and interaction-only controls (search and filter inputs, density and pagination controls, header actions) do not print; page content prints at full width on `--color-bg-surface` with the screen type scale and the browser's default page margins. Scroll regions expand and sticky cells become static; table cells wrap so a table fits the paper; table headers repeat; rows, cards and tiles avoid breaking inside. Badges and chart marks keep their tints with `print-color-adjust: exact`; if a printer drops them, icon and text still carry the meaning. Links keep their underline and print no URL.

**Print refinements (CSRM extension, 2026-09-26, Phase 8 UI review).** In-page workflow actions, such as a questionnaire's release, add, edit and delete controls or an assessment draft's generate action, are interaction-only controls too and do not print. Text that a long-text column or card clamps on screen prints whole, so paper never cuts a statement short. A table header prints the sorted column's direction cue, which states the printed order, and never the unsorted columns' cue.

**Print report (CSRM extension, 2026-10-01).** A record that prints as a document has its own report page, opened by a `Print report` outline pill link with a 16px `Printer` icon placed before its `Export`. The page header is its screen-only toolbar: the record identifier as eyebrow, the title `Print report`, a description, a primary `Print or save as PDF` pill with `Printer` and a `Back to {record}` outline pill link with `ArrowLeft`; it never prints. On screen the document is one `--color-bg-surface` card with a 1px `--color-border-default` edge and `--radius-lg`, 40px padding from 768px and 16px below, at most `--spacing-container-max` wide. In print it is the page: `@page { size: A4 portrait; margin: 16mm }`, with no card edge, padding or shadow, and, where the browser supports page-margin boxes, `Page {n} of {m}` in the bottom-right margin box in `--text-caption` and `--color-text-secondary`, with `tabular-nums`; browsers without margin boxes print no number. The document opens with a header block: an `--text-micro` product eyebrow, the document title in `--text-heading-lg`, the record's identifiers joined by the middle dot in `--text-heading-sm`, then its key facts as a definition list and its overall rating badge, closed by a 1px `--color-border-default` rule. Sections are h2 in `--text-heading-md`, 32px apart; an overview table precedes the per-item detail, and the detail section starts on a new page. Each item avoids breaking inside where it fits on one page, table headers repeat, nothing is clamped, and badges keep their icon and text. The last section, `Notes`, states what the document is and when it was generated, with the time zone named, because the paper leaves the system.

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
