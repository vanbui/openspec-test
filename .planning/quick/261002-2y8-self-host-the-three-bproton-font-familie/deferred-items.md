# Deferred items: quick task 261002-2y8

## D-1: the unlayered form-control font reset defeats the `text-button` utility (pre-existing, out of scope)

- **Found during:** Task 2, the "self-hosted type families" browser proof.
- **What:** `apps/csrm/app/globals.css` (about line 400) declares `button, select, input, textarea { font: inherit; }` outside any `@layer`. Unlayered CSS beats every layer, so it overrides the `.text-button` utility (`font-size: var(--text-button-size)`, `font-weight: var(--tw-font-weight, 500)`, line height and tracking) that `src/components/ui/button.tsx` applies. On the production build, the "Continue as Requestor" button's computed `font-weight` is `400` and it renders in `PlusJakartaSans-Regular`, not the `--text-button--font-weight: 500` the theme declares. Every `Button` in the app is affected the same way.
- **Why not fixed here:** this predates the loader change. The Google-era build had the same cascade, and the loader cannot affect computed weight. Moving the reset into `@layer base`, as the anchor reset above it already was, would change button size and weight across the whole app. That breaks this task's D-1 rule ("no design value changes") and needs a visual and type-contract review of its own.
- **What the proof does instead:** the button must render in the Plus Jakarta Sans face that matches its computed weight, so it passes today and still passes after the reset is fixed. A `font-weight: 500` probe proves `PlusJakartaSans-Medium`, as the research spike did.
- **Suggested follow-up:** move the form-control `font: inherit` reset into `@layer base`, then re-run the design-system conformance suite and check that the button typography matches direction section 3.10 (button token: 500).
