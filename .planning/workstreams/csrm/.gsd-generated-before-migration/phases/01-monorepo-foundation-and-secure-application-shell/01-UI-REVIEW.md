# Phase 1 — UI Review

**Audited:** 2026-09-10
**Baseline:** `01-UI-SPEC.md` (design contract)
**Screenshots:** not captured (no dev server detected at localhost:3000 — code-only audit)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Error and Permission-denied state copy does not match the exact contract strings; Loading and Empty copy match. |
| 2. Visuals | 2/4 | Two required shell primitives (`UserMenu`, `Breadcrumbs`) do not exist anywhere in the codebase; shared `LoadingState` renders no skeleton. |
| 3. Color | 3/4 | 60/30/10 hierarchy and no-raw-hex-in-components rule are respected, but `--foreground`, `--border`, `--muted-foreground` hex values drift from the spec's declared values. |
| 4. Typography | 1/4 | Six distinct Tailwind text sizes and three font weights are in production use against a contract of exactly four sizes / two weights. |
| 5. Spacing | 2/4 | Header is 56px, not the contracted 64px; sidebar is a fixed 256px with no 264px/72px collapse behaviour at all — the entire collapse-toggle requirement is unimplemented. |
| 6. Experience Design | 2/4 | Shared `LoadingState`/`ErrorState`/`PermissionDeniedState` primitives are thin and under-specified even though individual features (assessments, risks, requests) build their own compliant skeletons that bypass the shared primitive. |

**Overall: 12/24**

---

## Top 3 Priority Fixes

1. **Typography scale has 6 sizes / 3 weights instead of the contracted 4/2** — `grep` across `apps/web/src` shows `text-xs` (44), `text-sm` (263), `text-base` (9), `text-lg` (23), `text-xl` (11), `text-2xl` (4) and weights `font-medium` (116), `font-semibold` (59), `font-normal` (4). This is a foundation-phase failure that propagates to every future screen. Fix: define Tailwind utility aliases (or a lint rule) that only exposes the four contracted sizes (14/16/20/28px → e.g. `text-label`, `text-body`, `text-heading`, `text-display`) and two weights (400/600), then migrate `font-medium` usages to 400 or 600 and consolidate `text-xs`/`text-lg`/`text-xl` usages into the approved scale.

2. **`UserMenu` and `Breadcrumbs` primitives were never built** — `01-UI-SPEC.md` "Required shell primitives" lists both as mandatory; `grep -rln "UserMenu|AppHeader|Breadcrumbs|PageActions" apps/web/src` returns only one incidental string match in `features/administration/administration-workspace.tsx`. The sidebar in `apps/web/src/components/shell/app-shell.tsx:20-25` ends with the dev `RoleSwitcher`, with no user identity/avatar/sign-out affordance, and the header (`app-shell.tsx:27-31`) shows a static "Cyber Risk Manager" string instead of a breadcrumb/page-context region. Fix: build `UserMenu` (avatar + sign-out + dev role switcher nested inside it per spec) and `Breadcrumbs`, and wire them into `AppShell`.

3. **Sidebar collapse (264px/72px) and 64px header height are unimplemented** — `apps/web/app/globals.css:308` hardcodes `grid-template-columns: 256px minmax(0, 1fr)` with no icon-only collapsed state, no labelled toggle, and no tooltips for collapsed items; `.header` at `globals.css:392` is `min-height: 56px`, not the contracted 64px used on all breakpoints. Fix: implement the collapse toggle with `aria-expanded`, persist state, add `Tooltip` to icon-only collapsed nav items, and correct the header height token to 64px everywhere.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

- `components/states/states.tsx:1-33` implements `LoadingState`, `EmptyState`, `ErrorState`, `PermissionDeniedState`.
  - Loading heading "Loading workspace…" — matches spec exactly.
  - Empty heading/body — matches spec exactly ("Nothing to show yet" / "Items available to you will appear here. Try changing your filters or return when work has been assigned.").
  - **Error state diverges**: spec requires *"We couldn't load this page. Try again. If the problem continues, contact your CSRM administrator."* Actual code (`states.tsx:19-24`) renders heading "We couldn't load this workspace" (not "this page") and body "Please try again. If the problem continues, contact your administrator." — drops "CSRM" and changes "page" to "workspace". Component tests that assert exact strings (per the spec's own verification method) would need updating or are currently testing the wrong copy.
  - **Permission-denied state diverges**: spec requires body/link copy *"Return to your workspace"*; actual (`states.tsx:26-32`) uses a different body ("Access is determined by your effective CSRM capabilities. Navigation visibility is not an authorization control.") and the link text is "Return to workspace" (missing "your").
- Document title contract `{Page title} | IdamBox CSRM` is correctly implemented via route-level `metadata` exports, e.g. `app/(app)/app/page.tsx:8` (`'Dashboard | IdamBox CSRM'`), `app/(app)/app/requests/page.tsx:9`, `app/(app)/app/risks/page.tsx:11`.
- Development role switcher copy matches spec exactly: label "Development role" and helper text present in `components/shell/role-switcher.tsx:11-13`, though the exact helper wording ("Changes the local development session only.") differs slightly — actual copy is "Development-only UI fixture. Strapi remains the authorization authority." (`role-switcher.tsx:24`), not the contracted helper string.

### Pillar 2: Visuals (2/4)

- Required primitive list in `01-UI-SPEC.md` ("Required shell primitives"): `AppShell, Sidebar, MobileNavigation, AppHeader, Wordmark, CapabilityNavigation, PageHeader, Breadcrumbs, PageActions, LoadingState, EmptyState, ErrorState, PermissionDeniedState, UserMenu`.
  - Present: `AppShell` (`components/shell/app-shell.tsx`), `MobileNavigation`/`CapabilityNavigation` (`components/shell/capability-navigation.tsx`), `Wordmark` (`components/shell/wordmark.tsx`), `PageHeader` (`components/csrm/page-header.tsx`), and the four state components (`components/states/states.tsx`).
  - **Missing entirely**: `Sidebar` as a standalone component (markup is inlined directly in `AppShell`), `AppHeader` as a standalone component (also inlined), `Breadcrumbs`, `PageActions`, and `UserMenu`. A repo-wide search (`grep -rln "UserMenu|AppHeader|Breadcrumbs|PageActions" src`) returns nothing but one incidental string in an unrelated file.
- No focal-point/identity affordance in the header or sidebar — no avatar, no user name, no sign-out control anywhere in the shell chrome.
- `LoadingState` (`states.tsx:3-9`) is plain text with no skeleton, contradicting the spec's explicit "use 3–5 skeleton rows/cards matching the eventual layout" instruction, even though `components/ui/skeleton.tsx` exists and is used extensively by individual features (e.g. `features/risks/risk-details.tsx:110-121`, `features/assessments/assessment-list.tsx:68-92`). The shared shell-level primitive itself fails the contract while ad hoc feature-level skeletons compensate inconsistently.
- Icon-only buttons (`MobileNavigation`'s "Open navigation"/"Close navigation" triggers in `components/shell/capability-navigation.tsx:113-131`) carry `aria-label`s, which is good, but have no `Tooltip` despite `ui/tooltip.tsx` being available and required for icon-only shell controls under D-10/spec collapse-icon requirement (moot currently since collapse doesn't exist, but the general pattern is unaddressed).

### Pillar 3: Color (3/4)

- No raw hex/`rgb()` literals found in any `.tsx` file outside test files (`grep -rn "#[0-9a-fA-F]{3,8}" src` returns nothing), correctly honoring D-09 ("No raw colour... values in TSX feature components").
- `text-primary`-class accent usage is measured at 16 occurrences repo-wide — consistent with the spec's "one primary CTA per view / active nav / focus / active tab" accent-reservation rule, not obvious overuse.
- Token *values* in `apps/web/app/globals.css:9-114` drift from the exact hex values declared in `01-UI-SPEC.md`:
  - Spec `--foreground: #172033` vs actual `--foreground: #101828` (`globals.css:19`).
  - Spec `--border: #D0D9E5` vs actual `--border: #e3e8ef` (`globals.css:30`).
  - Spec `--muted-foreground: #52657A` vs actual `--muted-foreground: #667085` (`globals.css:21`).
  - `--background: #F7F9FC`, `--surface: #FFFFFF`, `--sidebar: #102A43`, `--primary: #155EEF`, `--destructive: #B42318` all match the spec exactly.
  - The token *architecture* (semantic CSS custom properties, no dark-mode switch, single `.dark` override point at `globals.css:116-118`) matches D-11 correctly.
- This is a values-level drift, not a structural violation, and the deviations remain plausible AA-passing near-neutrals — hence a 3, not a 2.

### Pillar 4: Typography (1/4)

- Spec: "Use exactly four sizes and two weights" (14/16/20/28px, 400/600).
- Actual measured usage across `apps/web/src/**/*.tsx` (excluding tests):
  - Sizes: `text-xs` (44), `text-sm` (263), `text-base` (9), `text-lg` (23), `text-xl` (11), `text-2xl` (4) — six distinct Tailwind size utilities in active use, none of which map cleanly to the declared 14/16/20/28px ramp (`text-sm` is 14px, `text-base` is 16px, but `text-xs`=12px, `text-lg`=18px, `text-xl`=20px, `text-2xl`=24px are all off-scale or duplicative).
  - Weights: `font-medium` (116), `font-semibold` (59), `font-normal` (4) — three weights where the contract allows only 400 and 600; `font-medium` (500) is the dominant weight class in the codebase and is not a permitted value.
  - Shell-level CSS in `globals.css` compounds this: `.nav-link` is `font-size: 13px; font-weight: 500` (`globals.css:341-342`), `.header-title` is `font-weight: 500` (`globals.css:407`), `.page-header h1` is `font-size: 24px` (`globals.css:431`, not the contracted 20px Heading token), `.micro-label` is `font-size: 11px; font-weight: 500` (`globals.css:253-259`), and the data table uses a dedicated `--text-table-size: 13px` / `--text-micro-size: 11px` pair (`globals.css:25-26`, consumed in `components/csrm/data-table.tsx:113-117`) — none of which are declared sizes in the contract.
- This is a foundation-phase, shell-wide violation: the four-size/two-weight ramp was never actually enforced or wired into a constrained set of utility classes, so every downstream feature phase inherits an uncontrolled type scale.

### Pillar 5: Spacing (2/4)

- Desktop gutters and max-width match: `.page { width: min(100%, 1440px); padding: 32px; }` (`globals.css:418-421`) satisfies the "32px gutters, 1440px maximum width" contract. Tablet gutter (24px, `globals.css:567-570`) and mobile gutter (16px horizontal, `globals.css:591-596`) are close to contract.
- **Header height violates the contract**: spec requires "Header height is 64px on all breakpoints"; actual `.header { min-height: 56px; }` (`globals.css:392`) is 8px short and is only a `min-height`, not a fixed height, so it isn't guaranteed even at 56px under content growth.
- **Sidebar violates the contract on every dimension**: spec requires "264px expanded or 72px icon-only collapsed. Collapse state has a labelled toggle and tooltips for icon-only items." Actual `.shell { grid-template-columns: 256px minmax(0, 1fr); }` (`globals.css:307-309`) is a single fixed 256px column with no collapse state, no toggle control, and no icon-only mode anywhere in `app-shell.tsx` or `capability-navigation.tsx`. This is a complete non-implementation of a spec-mandated interaction, not a minor value drift.
- Sidebar row height: spec wants "40px visually, 44px interactive target." Actual `.nav-link { min-height: 36px; }` (`globals.css:335`) is under both the visual and interactive-target minimums, and `.mobile-trigger`/close controls do correctly use `min-height: 44px` (`globals.css:559-560`), showing the 44px rule was applied inconsistently.
- No arbitrary/off-scale spacing values were found via `grep "\[.*px\]"` outside typography-related `text-[length:...]` custom-property usages in `data-table.tsx`, which are deliberate token references, not raw magic numbers.

### Pillar 6: Experience Design (2/4)

- Individual features implement strong state coverage: dedicated loading skeletons (`features/risks/risk-details.tsx`, `features/assessments/assessment-list.tsx`, `features/assessments/assessment-editor.tsx`, `features/questionnaires/questionnaire-list.tsx`, `features/requests/request-form-loading.tsx`), a `ConfirmDialog` matching the exact contract labels (`components/csrm/confirm-dialog.tsx`, verified by `confirm-dialog.test.tsx`), and `role="status"`/`role="alert"` on shared state regions (`states.tsx:5,20,27`).
- However the **shared shell-level primitives are the weak link**: `LoadingState` has no skeleton at all despite the spec's explicit instruction, meaning any route that falls back to the generic shell state (rather than a feature-built skeleton) will under-deliver against the visual-quality acceptance criteria.
- `MobileNavigation` (`capability-navigation.tsx:79-140`) correctly implements focus-trap/focus-restoration via Radix `Dialog` (`triggerRef`/`restoreTriggerFocus`), Escape-to-close (native Radix behavior), and a labelled close control — this is a genuine strength and matches the spec's dialog/sheet accessibility contract.
- The development role switcher correctly avoids `localStorage` (uses a server action, `setDevelopmentRole`, per D-06/D-07) and is scoped inside the sidebar/mobile footer, satisfying the seam requirement, though it is not nested inside a `UserMenu` as the spec's sidebar-order contract implies ("... then the user menu at the bottom" with the dev switcher described as living "inside `UserMenu`").
- No destructive domain action exists yet (correctly out of scope per spec), so `ConfirmDialog`'s contract compliance is the only testable data point for that requirement, and it passes.

---

## Registry Safety

`components.json` exists (`style: new-york`, `iconLibrary: lucide`, official shadcn aliases). `01-UI-SPEC.md`'s Registry Safety table lists only the shadcn official registry with no third-party blocks, so the mandatory third-party audit (`shadcn view`/`shadcn diff`) does not apply.

Registry audit: 0 third-party blocks checked (none declared), no flags.

---

## Files Audited

- `apps/web/src/components/shell/app-shell.tsx`
- `apps/web/src/components/shell/capability-navigation.tsx`
- `apps/web/src/components/shell/wordmark.tsx`
- `apps/web/src/components/shell/role-switcher.tsx`
- `apps/web/src/components/states/states.tsx`
- `apps/web/src/components/csrm/page-header.tsx`
- `apps/web/src/components/csrm/data-table.tsx`
- `apps/web/src/components/csrm/confirm-dialog.tsx`
- `apps/web/src/components/ui/skeleton.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/(app)/layout.tsx`
- `apps/web/app/(app)/app/page.tsx`, `app/(app)/app/requests/page.tsx`, `app/(app)/app/risks/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/components.json`
- `apps/web/src/features/assessments/*.tsx` (skeleton/state patterns)
- `apps/web/src/features/risks/risk-details.tsx`
- `apps/web/src/features/questionnaires/*.tsx`
- `apps/web/src/features/requests/request-form-loading.tsx`
- `.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md`
- `.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md`
- All ten `01-0*-SUMMARY.md`/`01-0*-PLAN.md` execution files in the phase directory
