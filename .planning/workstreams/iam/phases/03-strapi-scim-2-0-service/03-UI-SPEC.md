---
phase: "03"
slug: strapi-scim-2-0-service
status: approved
reviewed_at: "2026-10-15"
shadcn_initialized: true
preset: new-york
created: "2026-10-15"
---

# Phase 3 - UI design contract

## Scope and inherited decisions

This contract covers the existing CSRM refusal journey required by LIFE-01 and P3-29/P3-30. SCIM discovery, provisioning, pagination and tokens are backend operations. Reuse the protected layout, typed API transport, existing OIDC session and PermissionDeniedState. No new screens, source administration, source badges, token controls or password setup are included. The existing authoritative design direction and components supply every visual value; this contract introduces no theme change.

After SCIM deactivation, a fresh protected-page navigation or reload using the same existing OIDC session must resolve access from Strapi again. Access failure grants no capabilities and displays the existing refusal state without protected page content. A direct detail URL and a write/server action must also be refused server-side. Hidden navigation alone is insufficient. No background browser refresh or immediate change to already rendered content is promised.

Sources: 03-CONTEXT.md P3-29/P3-30; 03-RESEARCH.md; docs/design/csrm-design-direction.md; apps/csrm/app/(app)/layout.tsx; apps/csrm/src/lib/auth/oidc-session-adapter.ts; apps/csrm/src/lib/capabilities/strapi-capabilities.ts.

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn, already initialised in apps/csrm/components.json |
| Preset | new-york; neutral CSS variables; existing component customisations remain authoritative |
| Component library | radix-ui@1.6.7, installed and resolved locally |
| Icon library | Existing lucide-react; LockKeyhole in PermissionDeniedState |
| Font | Existing self-hosted Plus Jakarta Sans, Instrument Serif and IBM Plex Mono |
| Theme | Existing BProton light theme and semantic tokens; no new palette or theme |

The shadcn CLI is not installed; its info command could not run. The checked-in configuration and local component inventory establish the inherited design system without installing another dependency.

## Component Inventory

Enumerated by `node -e 'const fs=require("node:fs"); const a=fs.readdirSync("apps/csrm/src/components/ui").filter(x=>x.endsWith(".tsx")&&!x.includes(".test.")); console.log(a.length,a.join(", ")); console.log(JSON.parse(fs.readFileSync("apps/csrm/node_modules/radix-ui/package.json")).version);'` - 30 components - radix-ui@1.6.7 - 2026-10-15.

The count is the checked-in primitive module inventory; the resolved package version identifies their installed Radix foundation, not a claim that the package exports exactly 30 components. This table is a non-exhaustive list of existing reusable components.

| Component | Import path | Notes |
|-----------|-------------|-------|
| PermissionDeniedState | @/components/states/states | Existing alert with LockKeyhole, heading, description and action |
| AppShell | @/components/shell/app-shell | Existing responsive frame; access grants supply navigation visibility |
| buttonVariants | @/components/ui/button | Existing outline pill link used for Return to sign in |
| Sheet | @/components/ui/sheet | Existing mobile navigation; no new sheet |

## Spacing Scale

| Existing value | Usage |
|----------------|-------|
| 4px, 8px | Existing inline and compact control spacing |
| 12px | Existing default refusal section vertical gap, space-y-3 |
| 16px | Mobile gutter, px-gutter-xs; compact state padding if used elsewhere |
| 24px | Default refusal card horizontal padding, px-6; gutter-sm |
| 32px | Existing page section rhythm |
| 40px | Desktop gutter-md from 1024px |
| 48px | Existing refusal card vertical padding, py-12 |

Use existing semantic spacing utilities and inherited component classes. The default refusal state remains rounded-lg, border-border, bg-surface, text-center. No spacing exception is introduced. The global design system's existing 2px micro-spacing is outside this journey.

## Typography

| Role | Existing token | Size / line height | Weight |
|------|----------------|--------------------|--------|
| Refusal description | text-sm, existing body scale | 14px / 20px | 400 |
| Refusal action | text-button | 14px / 20px | 500 |
| Refusal heading | text-heading-sm | 16px / 24px | 600 |
| Shell wordmark | text-wordmark | 20px / 28px | 400 |

Three inherited sizes are relevant here. The three inherited weights are required by the existing authoritative design tokens and unchanged components: do not restyle an existing heading or action to satisfy a generic two-weight recommendation. Body ratio is 20/14; heading ratio is 24/16. Keep the default semantic h2 and the existing alert role.

## Color

| Role | Existing semantic token | Usage |
|------|-------------------------|-------|
| Dominant, approximate 60% | bg-page / background | Warm canvas of the existing shell |
| Secondary, approximate 30% | bg-surface / surface, border-border | Existing white refusal surface and structural hairline |
| Accent, approximate 10% maximum | foreground, primary, ring | Existing ink labels, action text and keyboard focus |
| Supporting text | foreground-secondary, muted-foreground | Description and LockKeyhole icon |
| Destructive | Existing destructive tokens | No destructive action in this journey |

The 60/30/10 proportions describe inherited visual hierarchy, not quotas that warrant changing the existing screen. Accent is reserved for existing action text, heading text and focus rings; no accent hue, extra colour or warning treatment is added. The refusal state communicates through its heading, copy and lock icon.

## Copywriting Contract

| Element | Existing copy / disposition |
|---------|-----------------------------|
| Primary CTA | Return to sign in; existing outline link to /sign-in |
| Refusal heading | You don’t have access to this area |
| Refusal description / error state | Your access is unavailable. Return to sign in and try again. If the problem continues, contact your administrator. |
| Empty state heading and body | Not applicable: refused access renders the refusal state, never an empty business list |
| Destructive confirmation | Not applicable: no provisioning or destructive controls are added to CSRM |
| Loading | Preserve existing route loading behaviour; never display protected content while access resolution is pending |

Copy comes directly from the existing layout and PermissionDeniedState. Do not expose source ownership, token details, remote error bodies or provisioning internals. Keep the CTA visible and keyboard operable, its focus ring perceivable, and the heading and description readable at 375px with text wrapping.

## Live verification checkpoint

The orchestrator runs the live stack and browser proof only after the service and gate scripts exist. Execution must record actual outcomes in `03-BROWSER-REFUSAL-EVIDENCE.md` in this phase directory, with sanitized screenshots under `evidence/browser-refusal/` named by scenario and width. These paths are future evidence destinations; this contract does not claim captured proof.

Use the same still-valid OIDC session before and after deactivation. Establish successful access and an authorised data request; deactivate using actual SCIM PUT and PATCH scenarios; reload or navigate freshly; assert the refusal heading, description and CTA and absence of protected content. Test direct detail navigation and a write/server action against server-side denial. Repeat at 1440px and 375px; inspect horizontal overflow, focus visibility and text readability. Include the provisioning-enabled isolated Keycloak outage case and immediate denial before recovery or token expiry, as P3-29 requires. Browser setup must use isolated runtime flags; committed IDAMBOX_KEYCLOAK_PROVISIONING, IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION and CSRM_AUTH_OIDC_ENABLED remain false. Save no cookies, tokens or secrets in evidence. Phase 5 owns new-user password setup and the complete CSV journey.

## UI Considerations

The compiled UI-consideration probe was run on 2026-10-15 using its proposeElements, autoResolve and analyzeCoverage exports. Non-interactive kind confirmation classified the refusal alert as static-content and the recovery link as both nav and interactive-control. Its six applicable considerations were upgraded from the conservative backstop floor to explicit acceptance criteria below, grounded in the existing components and required browser checkpoint. Empty, populated, partial and zero-one-many are inapplicable because this journey introduces no collection, media or form.

Applicable state considerations resolved: 6 covered, 0 backstop, 0 unresolved. These are required outcomes, not assertions that execution evidence exists.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| overflow | Refusal alert | ✅ covered | At 1440px and 375px, the refusal card fits the content region without horizontal page scrolling or clipped heading and description; browser evidence records both widths. |
| long-text | Refusal alert | ✅ covered | The existing heading and description from Copywriting Contract wrap visibly at 375px, without truncation or ellipsis; browser assertions inspect their complete text. |
| loading | Recovery navigation | ✅ covered | During fresh navigation, protected content remains absent until current Strapi access resolution completes; browser interception/delay verifies this while retaining existing route loading behaviour. |
| error | Recovery navigation | ✅ covered | A refused access request yields the Copywriting Contract refusal state and the existing /sign-in recovery link; no protected detail or successful write appears. |
| overflow | Recovery navigation | ✅ covered | The existing Return to sign in link remains inside the refusal card and keyboard focus remains visible at 1440px and 375px. |
| long-text | Recovery navigation | ✅ covered | The complete fixed Return to sign in label remains visible and accessible without clipping at 375px; no variable user or source value is inserted into it. |

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Existing checked-in primitives only | No new registry download or block; locally inspected on 2026-10-15 |
| Third party | None | Not applicable |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: FLAG - inherited centred layout and hierarchy are specified; primary visual anchor is implicit in the existing heading.
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS - authoritative inherited weight scale takes precedence.
- [x] Dimension 5 Spacing: PASS - authoritative inherited spacing scale takes precedence.
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved 2026-10-15; one nonblocking inherited-layout documentation recommendation, no blocking issues. Live browser acceptance remains pending execution.
