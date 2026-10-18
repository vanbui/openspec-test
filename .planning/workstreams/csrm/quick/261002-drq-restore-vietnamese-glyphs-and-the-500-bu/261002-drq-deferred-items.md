# Deferred items: quick task 261002-drq

## D-1: tailwind-merge has no config for the theme's text sizes

- **What:** `cn()` (tailwind-merge) reads `text-button`, `text-heading-sm`, `text-heading-md`, `text-heading-lg`, `text-wordmark` and `text-display` as text colours, so it drops them beside a plain text-colour utility.
- **Workarounds today:**
  - the important `!text-…` inks on every variant in `src/components/ui/button.tsx`;
  - `src/components/csrm/segmented-control.tsx`, which sets the colour on the group rather than beside `text-button`;
  - the two written-out footer-link classes in `analyst-dashboard.tsx` and `treatment-performance-report.tsx`.
- **Suggested follow-up:** an `extendTailwindMerge` theme config naming these sizes would remove the workarounds. It changes merge results app-wide, so it needs its own audit.

## Observation: dead CSS

- `.button-primary` and `.button-secondary` in `apps/csrm/app/globals.css` are unused.

## Observation: iOS input size

- shadcn's 16px mobile input size, which stops iOS Safari zooming on focus, is a design decision for the direction. It is not taken here: inputs stay at `--text-body` 14px at every width (D-9).
