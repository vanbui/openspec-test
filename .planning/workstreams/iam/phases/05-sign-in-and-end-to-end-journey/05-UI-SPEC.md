---
phase: "05"
slug: "sign-in-and-end-to-end-journey"
status: approved
reviewed_at: "2026-10-17"
shadcn_initialized: true
preset: "new-york; neutral; CSS variables; existing configuration"
created: "2026-10-17"
---

# Phase 5 - UI Design Contract

This phase verifies the delivered sign-in, Requestor and refusal interfaces. It introduces no screen, theme, component family or visual redesign. `docs/design/csrm-design-direction.md` is authoritative for every UI value; existing implementation supplies concrete layouts and copy. P5-10 and P5-15–P5-22 govern interaction and evidence. Plans 05-07 and 05-08 implement the isolated browser proof offline; plan 05-12 is the orchestrator live checkpoint. No browser/runtime result is established by this contract.

## Design System

| Property | Value |
|---|---|
| Tool | Existing shadcn/ui; do not initialize or install anything |
| Preset | `apps/csrm/components.json`: new-york, neutral, CSS variables, RSC, TSX |
| Component library | Installed `radix-ui@1.6.7`; existing local shadcn primitives |
| Icon library | Existing Lucide icons; decorative icons remain hidden from accessibility names |
| Font | Existing self-hosted Plus Jakarta Sans, Instrument Serif and IBM Plex Mono |
| Scope boundary | CSRM reuses semantic tokens; Keycloak 26.6.1 forms remain vendor-owned with no custom theme |

## Component Inventory

Enumerated by `node -e "const p=require('./apps/csrm/node_modules/radix-ui/package.json'); const x=require('./apps/csrm/node_modules/radix-ui'); console.log(p.version); console.log(Object.keys(x).length); console.log(Object.keys(x).join(', '));"` - 35 exported component namespaces - radix-ui@1.6.7 - 2026-10-17.

These namespaces include infrastructure such as Slot and Portal; they are not a claim that 35 CSRM wrappers exist. Local wrappers were enumerated with `rg --files apps/csrm/src/components/ui`. This is a non-exhaustive inventory of relevant delivered components, not an allowlist.

| Component | Import path | Contract |
|---|---|---|
| Button / buttonVariants | `@/components/ui/button` | Existing pill control and focus treatment; sign-in uses `h-control-h` |
| BrandLockup | `@/components/shell/brand-lockup` | Existing accessible BProton wordmark; no brand recolouring |
| AppShell | `@/components/shell/app-shell` | Existing capability-derived desktop navigation and mobile drawer |
| PermissionDeniedState | `@/components/states/states` | Existing alert, heading, explanation and escape link |
| EmptyState / LoadingState / ErrorState | `@/components/states/states` | Reuse the selected Requestor view's delivered states |
| Sheet / DropdownMenu | `@/components/ui/sheet`, `@/components/ui/dropdown-menu` | Existing mobile navigation/account interactions; focus return preserved |

## Spacing Scale

The authoritative spacing scale in direction §3.9 is 2, 4, 8, 12, 16, 20, 24, 32, 40 and 48px. The journey uses the relevant delivered subset through existing tokens and classes. No new spacing tokens.

| Element | Delivered contract |
|---|---|
| Sign-in canvas | `.sign-in`: minimum viewport height, centred card, 32px vertical and 16px horizontal padding |
| Sign-in card | `.sign-in-card`: width `min(100%, 420px)`, 32px padding, 16px grid gap; actions have 8px gap |
| Sign-in action | `h-control-h` = 48px; existing full-width grid action |
| Requestor page | Existing `.page` and semantic `gutter-*` tokens; 375px single column, existing desktop shell at 1440px |
| Refusal panel | Existing StateFrame default: 24px horizontal / 48px vertical padding; compact variant only where already used |
| Focus | Existing 2px ring with 2px offset; inverse ring on dark navigation |
| Corners | `radius-lg` cards, `radius-full` buttons; preserve existing values |

Exceptions are inherited structural sizes rather than additions to the spacing scale: 1px hairlines, 2px focus, icon dimensions, 420px sign-in maximum width and 44px mobile touch controls. Preserve existing 6px eyebrow gap. Do not restyle unrelated screens to normalise these values.

## Typography

Retain the existing semantic type scale. A generic reduced type-scale or two-weight template must not override the adopted direction or alter existing Requestor screens.

| Role | Existing semantic value | Weight / family |
|---|---|---|
| Sign-in eyebrow | `text-micro`: 11px/16px, +0.14em tracking | 400 / IBM Plex Mono |
| Sign-in note | Existing `.sign-in-note`: 12px/18px | 400 / Plus Jakarta Sans |
| Body and errors | `text-body`: 14px/20px | 400 / Plus Jakarta Sans |
| Action label | `text-button`: 14px/20px, −0.025em tracking | 500 / Plus Jakarta Sans |
| Refusal heading | `text-heading-sm`: 16px/24px, −0.01em tracking | 600 / Plus Jakarta Sans |
| Sign-in heading | `text-heading-lg`: 28px/32px, −0.02em tracking | 400 / Instrument Serif |
| Wordmark | Existing `text-wordmark`: 20px/28px | 400 / Instrument Serif |

Requestor list/detail data retains its existing 13px table and other semantic typography from direction §3.10. Do not change body line height to a generic 1.5 ratio or substitute system fonts.

## Color

| Role | Existing semantic tokens | Usage |
|---|---|---|
| Dominant (approximately 60%) | `background` | Warm app canvas |
| Secondary (approximately 30%) | `surface`, `surface-muted`, `sidebar` | White cards, inset areas and delivered dark navigation |
| Accent (at most approximately 10%) | `primary`, `primary-foreground`, `foreground` | Ink primary action, checked controls, existing active indicators and links |
| Secondary text | `foreground-secondary`, `muted-foreground` | Explanations and helpers; readable on existing surfaces |
| Error/destructive | Existing semantic `destructive*` tokens | Delivered error semantics only, paired with text/icon |

The 60/30/10 proportions describe hierarchy, not new measured pixel quotas. There is no accent hue. Brand logo colours never become interactive colours. Use semantic tokens only; no feature-level literal colours. Preserve primary hover lift/shadow, visible focus and reduced-motion behaviour.

## Visual hierarchy

The sign-in heading and primary sign-in action are the focal points of the centred card. The Requestor page heading and existing permitted primary action lead its delivered content. After refusal, the access-unavailable heading and recovery action become the focal points; protected content and actions are absent. Preserve existing hierarchy, rather than adding competing emphasis.

## Copywriting Contract

| Element | Exact delivered copy / rule |
|---|---|
| OIDC heading | Sign in |
| OIDC introduction | Continue with your organisation’s IdamBox account. |
| Primary CTA | Continue to IdamBox sign-in |
| Sign-in error (`role=alert`) | Sign-in did not complete. Try again or contact your administrator. |
| Refusal heading | You don’t have access to this area |
| Post-leaver explanation | Your access is unavailable. Return to sign in and try again. If the problem continues, contact your administrator. |
| Refusal action | Return to sign in |
| Empty Requestor data | Reuse the selected view's existing EmptyState noun/description/action; a new person need not have prior work, and an empty list does not replace proof of a real permitted action |
| Loading | Retain delivered skeleton or LoadingState; no protected content flashes after refusal |
| Destructive confirmation | No new destructive interface; retain existing unsaved-work sign-out confirmation if exercised |
| Vendor forms | Observe Keycloak's actual password/setup/login validation text; do not prescribe replacement wording or translate vendor errors into raw remote response text |

The refusal state lives in `apps/csrm/app/(app)/layout.tsx` with `PermissionDeniedState`, not a new `/access-unavailable` route. Assert the delivered heading, explanation and action using accessible roles/text. Existing restricted-record refusals retain their non-disclosing content.

## UI Considerations

Applicable state considerations resolved: 8 specified; live verification pending. The rows below are acceptance backstops, not claims of observed success.

| Category | Element(s) | Status | Resolution / Reason |
|---|---|---|---|
| Initial / populated | Mail setup, fresh CSRM login, Requestor work | 🧪 backstop | At each width, a distinct synthetic person consumes their own actual mail action link, chooses a password, then signs in in a separate fresh context; demonstrate an allowed Requestor page/action |
| Empty | New person's work view | 🧪 backstop | Accept the delivered empty state when appropriate, then prove a real permitted action; preserve existing copy |
| Loading / partial | Auth transition and capability boundary | 🧪 backstop | Await real readiness with bounded stages; partial workflow remains failed/pending and cannot pass from a screenshot |
| Error | CSRM and Keycloak forms | 🧪 backstop | Readable visible validation/refusal, labelled fields and meaningful recovery; do not expose raw URL/response/secret values |
| Permission | Restricted routes and leaver list/detail | 🧪 backstop | Require server refusal and delivered alert; same retained session after leaver reload/navigation renders no protected content or enabled protected actions before token expiry and independently of logout |
| Continuity | Mover | 🧪 backstop | Retain existing browser session and Requestor-only access across changed department/title/email; no new setup invitation |
| Overflow / long text | All exercised pages, errors and mobile navigation | 🧪 backstop | At 1440×900 and 375×812 require no horizontal document overflow; error text wraps and remains readable, controls stay reachable |
| Keyboard / focus | Sign-in, vendor forms, Requestor navigation/action, refusal escape | 🧪 backstop | Tab/Shift+Tab follows meaningful order, controls activate by keyboard, focused controls visibly ring and remain unobscured; mobile drawer closes/returns focus as delivered |

Keycloak forms are vendor-owned: exercise accessible labels, keyboard flow, visible focus, form errors and overflow in the installed version. A vendor failure is recorded as a named live checkpoint failure; it does not authorise a new theme, dependency or broader UI work. Necessary CSRM repairs stay within the journey and reuse existing primitives/tokens, with typecheck and tests per P5-25.

## Evidence and Live Checkpoint

Only plan 05-12 runs the live browser proof. It executes `node docker/midpoint/e2e/journey.mjs --run` with the private configuration in the planned operations guide; internally the runner selects `pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts` with `IAM_JOURNEY_LIVE=true`. These files/commands are execution deliverables, not evidence that they already ran.

For each viewport record allowlisted stage/status/timing and explicit keyboard/focus/error/overflow results, plus safe CSRM Requestor and post-leaver refusal screenshots. Screenshot only an allowlisted rendered CSRM area after inspecting its state; exclude identity/account areas carrying an email address, input values and other sensitive content. Never capture the Keycloak password/login form, Mailpit body, browser chrome or action URL. Disable automatic screenshots, traces, video, storage-state export and raw errors/network reporters. Tokens, cookies, action links, passwords and mailbox addresses stay in private memory or disposable owner-only handoffs; do not hash/store an action link as evidence.

Both widths require their own entire ordered lifecycle and independent contexts, not resizing one consumed-link session. A failing/partial viewport preserves a sanitised failure record and cannot produce a passing verdict. Verify safe publication with `node docker/midpoint/e2e/journey.mjs --verify-evidence`; automated evidence validation does not replace actual orchestrator observations.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|---|---|---|
| Existing shadcn official | Existing local primitives only | No new registry content requested; no download or initialization |
| Third-party | None | Not applicable |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS under authoritative inherited scale
- [x] Dimension 5 Spacing: PASS under authoritative inherited values
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS

**Approval:** approved 2026-10-17; spacing clarification and explicit focal points recorded after review. Live acceptance remains pending independently of planning approval.
