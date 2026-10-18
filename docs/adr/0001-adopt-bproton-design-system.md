# ADR 0001: Adopt the BProton design system as the CSRM visual foundation

- **Status:** Accepted
- **Date:** 2026-09-24
- **Amended:** 2026-10-02 (G-10: the three families are self-hosted, with the vietnamese subsets of Plus Jakarta Sans and IBM Plex Mono added by quick task 261002-drq)
- **Supersedes:** the Phase 06.5 scope decision "The cool neutral scale, Inter, and the existing accent all stand" (`.planning/workstreams/csrm/ROADMAP.md`, Phase 06.5), and the rejections in `docs/design/csrm-design-direction.md` §2 revision of 2026-08-29.
- **Source of truth:** BProton design system, https://claude.ai/artifact/QaGDSeesQHocAe3yvoGpAx (`project/README.md`, `project/tokens.json`, `project/assets/Logos/README.md`; synced from `dthbui/bproton-website-v2@2383fbe` on 2026-09-20).

## Context

CSRM shipped its own visual direction: a cool blue-slate neutral scale, a single blue accent (`#155EEF`), a navy sidebar, Inter, 6px rounded-rect buttons, and no display or mono face. That direction deliberately diverged from the BProton marketing site.

BProton now publishes a design system with exact tokens for colour, type, spacing, radius, shadow and easing, plus the logo and its header lockup. The project brief (§13) asks for an application that is "clearly part of BProton" with BProton as the brand source of truth. Two diverging token sets for one company is the drift Phase 06.5 was created to close.

The BProton system describes a marketing site. It has no tokens for status, risk severity, form controls, tables, charts, overlays or dark mode, and some of its rules (no icons, pill-only controls, 10px tags, a white/30 focus ring on dark) do not transfer unchanged to a dense, accessible risk console.

## Decision

CSRM adopts the BProton design system. Every value the system defines is used exactly. Where CSRM needs something the system does not define, CSRM decides it here, reusing BProton values wherever one fits, and marks it as a **CSRM extension** in `docs/design/csrm-design-direction.md`. That document stays the single value-bearing authority in this repository.

### Adopted as defined

- Colour: `background`, `foreground`, `card`, `muted`, `muted-foreground`, `border`, `accent`, `accent-foreground`, `surface-dark`, `surface-dark-muted`, `selection`, and the ink and on-dark alpha tokens.
- Type families: Plus Jakarta Sans (`--font-sans`), Instrument Serif 400 (`--font-display`), IBM Plex Mono 400/500 (`--font-mono`), loaded with `next/font/google`. Since 2026-10-02 they are self-hosted through `next/font/local` (see the amendment below).
- Radius `sm`, `md`, `2xl`, `full`; shadows `shadow-button*`; easings `ease-out-expo`, `ease-out-soft`; spacing `grid-max`, `container-max`, `gutter-*`, `header-h-*`.
- The logo file and the header lockup: `foreground` tile, `radius-md`, 6px padding around a 20px mark, then "BProton" in `wordmark`. The same file is the favicon.
- Pill buttons, hover that lifts rather than recolours, borders instead of shadows, the scrolled-header treatment.

### Gap decisions

| # | Gap | Decision | Why |
|---|---|---|---|
| 1 | Status colours | Keep the existing info, success, warning and danger sets as CSRM extensions. Values unchanged. | The system has none and CSRM cannot work without them. Recomputed against the new canvas, every foreground still passes AA (§3.5). With no accent hue left in the interface, status hues are the only chroma on screen, so they read more strongly than before. |
| 2 | Risk severity | Keep the four-step ladder, its tokens and the mandatory shape and label signifiers. Values unchanged. | Same reasoning. The earlier objection, that warm hues lose distinctness on a warm canvas, is answered by the rule that severity always renders on its own tinted chip on a white `card` surface, never directly on the canvas, and never by colour alone. |
| 3 | Charts | Monochrome ink ramp: `foreground`, then `muted-foreground`. Further series are separated by dash or pattern and direct labels, not by new hues. Severity charts use the risk tokens. `--chart-3` to `--chart-5` are retired. | The system forbids an accent hue. No chart ships today, so nothing breaks. |
| 4 | Links | Links are ink (`foreground`), weight 500, with an always-visible 1px underline in `muted-foreground` that becomes `foreground` on hover and focus. | No link hue exists. Link and body text now share a colour, so the at-rest underline is the non-colour cue required by WCAG 1.4.1. It was already mandatory after Phase 06.6. |
| 5 | Hover and pressed | Retire `primary-hover` and `primary-active`. The primary button lifts 1px and gains `shadow-button-hover` on hover and scales to 0.995 on press. Quiet controls change fill by a few percent (`bg-hover`). | This is the system's own state rule. Durations stay app-scaled (120ms, 80ms), not the site's 450ms. |
| 6 | Selected and subtle tints | `bg-hover` = `foreground` at 4% (the `grid-line` value). `bg-selected` = `muted` plus a 2px `foreground` left edge. `primary-subtle` is retired. | Reuses system values and keeps selection distinguishable without colour. |
| 7 | Form inputs | Input, select, checkbox, radio and switch-off boundaries use `muted-foreground` (5.5:1 on `card`). Inputs are 6px (`radius-md`) rectangles, not pills. Field labels stay sentence case in Plus Jakarta Sans. | The system `border` is 1.35:1 and marked decorative. WCAG 1.4.11 needs 3:1 for a boundary that identifies a control. Rectangular fields keep fields visibly different from pill buttons. |
| 8 | Tables and dense type | Keep the dense app scale (11–14px UI, 13px table body) in Plus Jakarta Sans. Micro-labels (table headers, KPI captions, eyebrows, section labels) adopt the system `label` style: IBM Plex Mono, 11px, uppercase, +0.14em. Page titles and the wordmark use Instrument Serif 400. Everything else stays sans. | The system's editorial scale (16px body, 36–136px display) is for a marketing page. Mono labels and serif titles carry the brand signature where they do not cost legibility. The serif is never used for data, numbers or text below 20px. |
| 9 | Dark mode | Light only. Remove the empty `.dark` stub; `color-scheme: light` stays. | The system defines a light theme only. Improvising one is already on the do-not list. Revisit when BProton publishes a dark theme. |
| 10a | Modal scrim | `surface-dark` at 50%. | Derived from a system token, like the system's own alpha tokens. |
| 10b | Overlay shadow | One floating shadow for dialogs, popovers, menus and toasts, reusing the `shadow-button-hover` value. | Floating layers need separation from the page. This reuses an existing system value rather than inventing one. |
| 10c | Sidebar states | Inactive nav text `surface-dark-muted` (7.6:1). Hover and active fill `fill-on-dark-button`. Active text `accent-foreground` plus a 2px `accent-foreground` bar. Dividers `line-on-dark`. | Everything reuses system on-dark tokens. The active item is marked by text, bar and fill, never by fill alone. |
| 10d | Focus ring | 2px solid `foreground`, 2px offset on light grounds. On the sidebar, 2px solid `accent-foreground`. The source's `ring-white/30` is not used. | The system itself flags the light-ground problem. White/30 on `surface-dark` computes to 2.7:1, which fails the 3:1 requirement. |
| 10e | Radius steps | Use Tailwind v4's default radius scale, which the system states it uses unchanged. Remove the app's overrides. `xs` is retired; `lg` (8px) carries cards and popovers. | Keeps all four system tokens exact without inventing sizes. |
| 11a | Pill buttons | Adopt. Every button, icon button and interactive chip is `radius-full`. App heights stay (32/36/40px; 44px minimum touch targets on mobile). Status and risk badges stay 4px rectangles. | This is the most recognisable BProton control. The old weak-affordance objection is answered by an ink-filled primary (16.9:1) and by fields and badges keeping rectangular shapes, so shape itself means "action". |
| 11b | Icons | Keep Lucide. This is a documented divergence from the system's no-icon rule. | Status and severity icons are WCAG 1.4.1 signifiers, and navigation icons support scanning in a 10+ item nav. The rule serves a six-link marketing page. Icons stay `currentColor`, 16px, and decorative when a label is present. No illustrations or emoji. |
| 11c | Dark sidebar | Keep the sidebar dark on `surface-dark`. It is the one dark section on every screen; no page content may add another. | Satisfies the one-dark-section rule by construction. |
| 12 | Favicon | Replace `app/icon.svg` with `bproton-logo.png` (`app/icon.png`). | The Logos README names the file as the favicon. |

## Consequences

- Visual change is broad but mechanical. Components keep consuming semantic token names; values change in `globals.css`. Class-only edits: `bg-accent` hovers move to `bg-muted`/`bg-hover`, radius classes are re-mapped, and buttons become pills.
- `docs/design/csrm-design-direction.md` is rewritten to these values. The browser conformance suite (`apps/csrm/e2e/design-system-conformance.spec.ts`) parses its §3.10 table, so it will fail until the CSS implementation lands. Doc and implementation ship on the same branch.
- Phase UI specifications stay deferential: their font rows now point at the direction document instead of naming Inter.
- The phrase "one blue accent" disappears from the product vocabulary. Blue now means *info status* only.
- The loaded Plus Jakarta Sans exposes tabular figures (`tnum`), verified in the browser on 2026-09-24, so numeric columns stay in the sans face.

## Amendment 2026-10-02: self-hosted families (G-10)

- **Decision source:** `.planning/workstreams/csrm/NEXT-WAVE-DECISIONS.md` G-10, built by quick task 261002-2y8. It closes R-08-24.
- **What changed:** the loader, and each font token now lists its family's companions first: latin-ext, then vietnamese for Plus Jakarta Sans and IBM Plex Mono (quick task 261002-drq), then the latin face (see Coverage). The families, weights, normal style, swap display and CSS variables are unchanged, and no design value changes.
- **Why:** R-08-24. The Google loader fetched the families from Google Fonts on every build and dev compile, and the fetch failed four times on 2026-09-25 and 2026-09-26: in three builds and one `next dev` compile.
- **Provenance:** the three @fontsource 5.3.0 packages from the npm registry (Plus Jakarta Sans 2.071, Instrument Serif 1.000, IBM Plex Mono 2.3), copied byte-identical into `apps/csrm/app/fonts/`. Its README records every file's SHA-256 and each tarball's integrity. No dependency is added.
- **Licence:** SIL Open Font License 1.1. The licence text sits beside the files.
- **Coverage:** latin is preloaded. latin-ext, and since quick task 261002-drq vietnamese for Plus Jakarta Sans and IBM Plex Mono (24,484 B, never preloaded), are downloaded on demand by `unicode-range` through companion faces listed ahead of the latin face in each font token, because `next/font/local` sets preload and descriptors per call, not per file. latin-ext comes before vietnamese, so the vietnamese file loads only for the Vietnamese tone letters and combining marks no other subset covers. Instrument Serif has no vietnamese subset, so Vietnamese tone letters in display text fall back to Times New Roman. Cyrillic is not shipped.
- **Fallback metrics:** the same local fallback fonts as before (Arial for Plus Jakarta Sans and IBM Plex Mono, Times New Roman for Instrument Serif). The metrics are now computed from the files and sit within 3% of the Google values.
