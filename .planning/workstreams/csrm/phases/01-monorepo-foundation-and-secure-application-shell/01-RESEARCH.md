# Phase 1: Monorepo Foundation and Secure Application Shell - Research

**Researched:** 2026-08-27  
**Domain:** pnpm/Turborepo workspace migration, Strapi 5, Next.js App Router shell, contract-first client boundary  
**Confidence:** MEDIUM — architecture and framework behaviour are documented; package registry verification is blocked by the absent Node/npm runtime.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Copy the sibling Strapi project's working source into `apps/strapi` as a fresh workspace. Retain the existing sibling repository unchanged as a backup; do not import its Git history or retain nested `.git` metadata.
- **D-02:** The root repository's `.planning` directory is authoritative. Exclude the prior Strapi `.planning` directory.
- **D-03:** Adopt pnpm workspaces at the repository root with a single root `pnpm-lock.yaml`; migrate Strapi away from its current mixed npm/Yarn lockfile state.
- **D-04:** Copy all existing Strapi project files except `node_modules`. Any copied `.env` remains local-only and must be Git-ignored; it must never be staged or committed. Preserve/review `.env.example`.
- **D-05:** Phase 1 uses a centralized role-switching development session behind the same auth/capability adapter boundary intended for production.
- **D-06:** The production-ready browser session seam uses HTTP-only secure cookies. Do not use localStorage for access tokens.
- **D-07:** The Phase 1 development switcher is powered by a simple role flag, isolated in the adapter rather than scattered through UI components. It is a temporary development seam and must be replaceable by effective CSRM capabilities.
- **D-08:** Production authentication returns users to the protected page they originally requested after a successful Keycloak sign-in.
- **D-09:** Establish a BProton-led visual treatment now, but express every visual decision through semantic CSRM tokens rather than raw component-level values.
- **D-10:** Use balanced enterprise density: compact navigation and data views with comfortable controls and generous spacing in forms and details.
- **D-11:** Ship a polished light-first theme only. Token architecture must permit dark mode later without page rewrites.
- **D-12:** Until approved brand assets are available, render a deliberately replaceable `IdamBox CSRM` text wordmark component.
- **D-13:** Generate frontend transport types from the supplied OpenAPI document through a repeatable development/build step; commit generated output.
- **D-14:** Keep generated client/types internal. Feature code consumes domain-specific typed service modules that map transport data to domain/UI models.
- **D-15:** When a required operation is absent from OpenAPI, record a backend-contract gap. Only a fixture or HTTP-level test double behind the typed service seam may temporarily represent it; do not add a Next.js API facade.
- **D-16:** CI regenerates OpenAPI output and runs a clean typecheck; it fails when committed generated output drifts.

### the agent's Discretion
- Select specific pnpm/Turbo/OpenAPI generation packages and scripts after current-version research, while preserving the decisions above.
- Define the initial semantic token values from the approved public BProton reference without hard-coding them throughout components.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 1 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| FOUND-01 | Reproducible Turborepo tasks for `apps/strapi` and `apps/web`. | Root pnpm workspace, one lockfile, explicit Turbo outputs and persistent dev task guidance. |
| FOUND-02 | Strict-TypeScript App Router with semantic tokens and reusable responsive shell. | App Router, shadcn CSS-variable configuration, UI-SPEC shell and accessibility contracts. |
| FOUND-03 | Typed service boundary derived from Strapi OpenAPI; no raw page fetch. | Committed `openapi-typescript` output plus internal transport and domain-service layers. |
| FOUND-04 | Capability-driven navigation while Strapi enforces Role → Function → FunctionAPI and record access. | Central session/capability adapters, server route guards only as UX, and no frontend role flag for API authority. |
| FOUND-05 | Automated unit, component/integration, and E2E foundation with intentional state components. | Vitest/testing-library component tests; Playwright responsive/a11y E2E; Turbo CI task graph. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Keep Strapi as the production API boundary; do not add a frontend API facade or raw fetch calls in page components.
- Keycloak authenticates; Strapi enforces IdamBox Role → Function → FunctionAPI and record-level authorisation. Navigation visibility is not security.
- Requestor is an implicit birthright role; Security Analyst is explicit.
- AI output is reviewable assistance only and cannot release an assessment.
- Preserve CSRM JDL terminology; document contract/model gaps rather than invent competing entities.
- Use semantic design tokens, responsive accessible patterns, strict TypeScript, and reusable feature-oriented modules.
- Never commit secrets, move `node_modules`, or silently merge the Strapi nested Git history during workspace migration.

## Summary

Use a two-application pnpm workspace: the copied Strapi 5.51.0 application remains the API and enforcement tier, while `apps/web` is a strict-TypeScript Next.js App Router client. Configure Turbo from the root with explicit cache outputs and non-cached persistent development tasks; Turbo discovers task scripts from workspace `package.json` files and only restores declared outputs. [VERIFIED: docs/CSRM-PROJECT-BRIEF.md] [CITED: https://turborepo.dev/docs/crafting-your-repository/configuring-tasks]

The web application must have three separations: generated OpenAPI transport types, server-side transport/client code, and feature-oriented domain services/UI models. The supplied OpenAPI 3.1 document covers Strapi collection and single-record CRUD paths but does not describe a CSRM effective-capabilities endpoint or a Keycloak authorization-code callback; record these as backend-contract gaps rather than inventing a Next.js façade. [VERIFIED: docs/references/specification.json] [VERIFIED: docs/CSRM-PROJECT-BRIEF.md]

The Phase-1 role switcher is a development-only way to select a fixture session/capability set. Implement it through a server-only session adapter and an HTTP-only cookie, but never pass this role flag as authorization to Strapi and never derive permission from it in feature components. Next.js expressly distinguishes optimistic route/UI checks from secure checks close to the data source; Strapi remains that secure source for production calls. [CITED: https://nextjs.org/docs/app/guides/authentication] [VERIFIED: AGENTS.md]

**Primary recommendation:** Create the source-level Strapi copy with an auditable exclusion list, then establish root pnpm/Turbo, `apps/web`, OpenAPI generation, service/auth/capability seams, and tests in that dependency order.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Strapi content API and Role → Function → FunctionAPI/record enforcement | API / Backend | Database / Storage | The project contract makes Strapi the production API and authorization boundary. [VERIFIED: AGENTS.md] |
| Keycloak identity and OIDC callback | Frontend Server (SSR) | API / Backend | Next.js owns the browser session seam; Strapi validates the eventual bearer token and resolves CSRM grants. [VERIFIED: docs/CSRM-PROJECT-BRIEF.md] |
| HTTP-only session cookie and return-to path | Frontend Server (SSR) | Browser / Client | Cookies are read/written on the server; route/UI checks are only optimistic. [CITED: https://nextjs.org/docs/app/api-reference/functions/cookies] [CITED: https://nextjs.org/docs/app/guides/authentication] |
| Development role selector and capability-driven navigation | Frontend Server (SSR) | Browser / Client | A server adapter supplies a fixture capability set; client components render that supplied view. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md] |
| OpenAPI generation and transport client | Frontend Server (SSR) | Build / CI | Generated types are committed and service modules hide transport details from pages. [CITED: https://openapi-ts.dev/cli] [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md] |
| Responsive shell, tokens, state components | Browser / Client | Frontend Server (SSR) | The browser owns interaction/accessibility; server layouts can provide the session-derived model. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---:|---|---|
| `pnpm` [ASSUMED] | Pin exact version via root `packageManager` after Node is installed | Workspace package manager and single lockfile. | Locked by D-03; workspace manager must generate the sole root lockfile. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md] |
| `turbo` [ASSUMED] | Pin after registry verification | Root task orchestration/cache. | Official task configuration supports dependency ordering, outputs and non-cached persistent tasks. [CITED: https://turborepo.dev/docs/crafting-your-repository/configuring-tasks] |
| Strapi `@strapi/strapi` | 5.51.0 | Existing API/admin application. | Preserve the existing app rather than scaffold a competing backend. [VERIFIED: ../strapi/package.json] |
| `next`, `react`, `react-dom`, `typescript` [ASSUMED] | Pin generated current compatible set | Strict App Router application. | The UI-SPEC locks Next App Router + strict TypeScript; official App Router docs cover the server session hooks needed here. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md] [CITED: https://nextjs.org/docs/app/guides/authentication] |
| `tailwindcss`, `shadcn`, `lucide-react` [ASSUMED] | Pin after registry verification | Token-driven styling, owned primitives, icons. | shadcn recommends CSS variables and its documented Next setup uses the `@/*` alias; use the official registry only. [CITED: https://ui.shadcn.com/docs/theming] [CITED: https://ui.shadcn.com/docs/installation/next] |
| `openapi-typescript`, `openapi-fetch` [ASSUMED] | Pin after registry verification | Generate types from `specification.json`; type-safe internal transport client. | Official docs explicitly pair generation with `openapi-fetch` and a CI typecheck. [CITED: https://openapi-ts.dev/openapi-fetch/] |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| `jose` [ASSUMED] | Pin after registry verification | Sign/encrypt the temporary server-managed session payload. | Next.js recommends a session-management library such as Jose for stateless sessions. [CITED: https://nextjs.org/docs/app/guides/authentication] |
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` [ASSUMED] | Pin after registry verification | Unit/component/integration foundation. | Needed to test capability mapping and required state components without a browser. [VERIFIED: docs/CSRM-PROJECT-BRIEF.md] |
| `@playwright/test`, `@axe-core/playwright` [ASSUMED] | Pin after registry verification | Browser journeys, viewport smoke tests, automated a11y checks. | Playwright projects support desktop/mobile configurations and `webServer`; axe provides a Playwright integration. [CITED: https://playwright.dev/docs/test-configuration] [CITED: https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| `openapi-typescript` + `openapi-fetch` | Hand-written `fetch`/DTOs | Reject: it violates D-13/D-14 and makes contract drift a manual review problem. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md] |
| Local shadcn components | Third-party shadcn registries | Reject for Phase 1: the UI-SPEC permits only the official registry; copied component source remains reviewable. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md] |
| Server cookie session seam | Browser `localStorage` token/role state | Reject: D-06 forbids localStorage tokens and client state is editable. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md] |

**Installation (after the environment checkpoint):**

```bash
corepack enable
pnpm install
pnpm --filter @csrm/web add openapi-fetch jose lucide-react
pnpm --filter @csrm/web add -D openapi-typescript vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test @axe-core/playwright
```

Do not use `pnpm dlx` for unreviewed third-party registries. The only planned CLI use is the documented official `shadcn` CLI from the web workspace. [CITED: https://ui.shadcn.com/docs/cli] [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md]

## Package Legitimacy Audit

The required legitimacy command could not run: this host has `pnpm.ps1`, but no available `node`, `npm`, or `slopcheck` executable. The attempted `pip install slopcheck` did not produce an importable module. Therefore every new package is `[ASSUMED]`, and the plan must place a `checkpoint:human-verify` before package installation. [VERIFIED: environment availability audit, 2026-08-27]

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---|---|---|---|---|---|---|
| `turbo`, `next`, `tailwindcss`, `shadcn`, `lucide-react` | npm | Not verified | Not verified | Official documentation located | Unavailable | [ASSUMED] human verify before install |
| `openapi-typescript`, `openapi-fetch`, `jose` | npm | Not verified | Not verified | Official documentation located | Unavailable | [ASSUMED] human verify before install |
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` | npm | Not verified | Not verified | Not registry-verified | Unavailable | [ASSUMED] human verify before install |
| `@playwright/test`, `@axe-core/playwright` | npm | Not verified | Not verified | Official documentation/source located | Unavailable | [ASSUMED] human verify before install |

**Packages removed due to slopcheck [SLOP] verdict:** none — slopcheck was unavailable.  
**Packages flagged as suspicious [SUS]:** none — no verdict was produced; this is not an approval.

## Architecture Patterns

### System Architecture Diagram

```text
Developer role switch (development only)
  -> Server Action / Route Handler
  -> HTTP-only signed dev-session cookie
  -> SessionAdapter.getSession()
  -> CapabilityAdapter.getCapabilities(session)
  -> AppShell / CapabilityNavigation / route guard (UX only)

Browser request for protected route
  -> Next.js server layout/DAL obtains session
  -> unauthenticated: redirect to Keycloak with validated returnTo
  -> authenticated: typed feature service
  -> internal generated OpenAPI transport client
  -> Strapi API [validates Keycloak token + effective Role→Function→FunctionAPI + record rule]
  -> DTO/domain model -> rendered page

OpenAPI document -> `api:generate` -> committed generated transport types
                                      -> CI regenerate + `git diff --exit-code` + typecheck
```

### Recommended Project Structure

```text
apps/
├── strapi/                         # source-level copy; retains Strapi config/src/database migrations
└── web/
    ├── app/                        # App Router pages, layouts, loading/error/denied boundaries
    ├── src/
    │   ├── components/{shell,states,ui}/
    │   ├── features/<domain>/       # domain UI and typed service consumption
    │   ├── lib/api/{generated,transport,services}/
    │   ├── lib/auth/                # server-only SessionAdapter + Keycloak seam
    │   └── lib/capabilities/        # names, grants, navigation projection
    ├── tests/
    └── e2e/
docs/
└── references/specification.json
```

### Pattern 1: Clean, source-level Strapi migration

**What:** Copy source directories/files into `apps/strapi` while excluding `.git`, `.planning`, `node_modules`, `.env`, `.tmp`, `.strapi`, `dist`, build/test outputs, and the source `package-lock.json`/`yarn.lock`. Preserve `.env.example`, `config/`, `src/`, `database/migrations/.gitkeep`, `public/`, `types/`, `tsconfig.json`, and `package.json`; the source workspace currently contains transient `.tmp`, `.strapi`, and `dist` folders. [VERIFIED: ../strapi/.gitignore] [VERIFIED: source filesystem audit, 2026-08-27]

**When to use:** Once, before root install. Copy rather than move; leave `../strapi` untouched. If a developer requires the existing `.env`, copy it as a separate local-only action after confirming `apps/strapi/.env` is ignored and `git status --ignored` proves it is not stageable. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md]

**Verification:** Use an explicit copy allow/exclude manifest, inspect destination for forbidden nested Git/state files, and run `git -C apps/strapi rev-parse --is-inside-work-tree` expecting it to be governed only by the root repository. Do not add the sibling source as a Git safe-directory or alter its configuration just to inspect it. [ASSUMED]

### Pattern 2: Root package-manager and task graph

**What:** Use root `package.json` with `packageManager`, root `pnpm-workspace.yaml` containing `apps/*`, and one `pnpm-lock.yaml`. Root scripts invoke `turbo run lint`, `typecheck`, `test`, `build`, and `test:e2e`; each application owns matching scripts. Turbo `build` declares `dependsOn: ["^build"]` and concrete outputs, while `dev` is `persistent`, `cache: false`, and is never a dependency. [CITED: https://turborepo.dev/docs/crafting-your-repository/configuring-tasks] [CITED: https://turborepo.dev/docs/reference/configuration]

**Required outputs:** Web build: `.next/**` excluding `.next/cache/**`; Strapi build: `dist/**` (verify exact emitted output after the copied Strapi build); test coverage: `coverage/**`; `lint` and `typecheck` declare no file outputs. [CITED: https://turborepo.dev/docs/reference/configuration] [ASSUMED: Strapi output exactness must be confirmed after migration]

### Pattern 3: Generated transport, hand-authored services

**What:** Generate only schema/path types into `apps/web/src/lib/api/generated/`. Create one internal `transport/server-client.ts` that creates `openapi-fetch` with the Strapi base URL and production bearer-token resolver. Feature services accept/use explicit domain request types, call the transport, convert response DTOs to UI/domain models, and normalize errors. Pages import only feature services/hooks; no page/component imports the generated file or invokes `fetch`. [CITED: https://openapi-ts.dev/cli] [CITED: https://openapi-ts.dev/openapi-fetch/] [VERIFIED: AGENTS.md]

**Contract gap protocol:** Add `docs/contract-gaps/<date>-<slug>.md` naming the desired operation, existing nearest spec path, user impact, and owner. A fixture implementation may satisfy the service interface only in test/development; it must not create `/api/*` application façade routes. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md]

### Pattern 4: Replaceable session and capability adapters

**What:** Define `SessionAdapter` (`getSession`, `setDevelopmentRole`, `signIn`, `signOut`) and `CapabilityAdapter` (`getEffectiveCapabilities`, `can`). Implement only `DevelopmentSessionAdapter` in Phase 1. Its server action sets an HTTP-only cookie with `sameSite: 'lax'`, `path: '/'`, bounded expiry, and `secure: process.env.NODE_ENV === 'production'`; its payload must be signed/encrypted and contain only a development role/session selector, never Keycloak access tokens. The later Keycloak adapter preserves the interface, validates the `returnTo` path as an internal relative path, and redirects back after authorization-code completion. [CITED: https://nextjs.org/docs/app/guides/authentication] [CITED: https://nextjs.org/docs/app/api-reference/functions/cookies] [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md]

**Security boundary:** Capability checks drive navigation/action visibility and `PermissionDeniedState`; they are not an API authorization decision. No authenticated CSRM endpoint may use a frontend-only role flag. Production service calls use the Keycloak-derived credential and Strapi must independently resolve the implicit Requestor grant, explicit Security Analyst assignment, FunctionAPI match, and record-level rule. [VERIFIED: AGENTS.md] [VERIFIED: docs/CSRM-PROJECT-BRIEF.md]

### Pattern 5: Token-first owned shell

**What:** Initialize shadcn in `apps/web` with `components.json`, `rsc: true`, `tsx: true`, aliases, and `tailwind.cssVariables: true`; add only the UI-SPEC-listed components from the official shadcn registry. Map the locked CSRM CSS custom properties in global CSS to semantic Tailwind utilities. Build the single owned `Wordmark`, `AppShell`, `CapabilityNavigation`, `AppHeader`, mobile navigation, state primitives, and `UserMenu` on these local components. [CITED: https://ui.shadcn.com/docs/components-json] [CITED: https://ui.shadcn.com/docs/theming] [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md]

### Anti-Patterns to Avoid

- **Nested repository migration:** copying `../strapi/.git` or its `.planning` imports unrelated history/state. Exclude both. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md]
- **Mixed lockfiles:** retaining Strapi `package-lock.json`/`yarn.lock` conflicts with D-03. Generate one root lockfile after the package manifest is made pnpm-compatible. [VERIFIED: ../strapi/package.json] [VERIFIED: source filesystem audit, 2026-08-27]
- **Frontend authorization:** `role === 'analyst'`, hidden links, route Proxy, or a client role flag must not authorize a Strapi operation. [VERIFIED: AGENTS.md] [CITED: https://nextjs.org/docs/app/getting-started/proxy]
- **Next API façade:** do not proxy Strapi CRUD through `app/api`; use the typed server service boundary directly. Auth callback/session routes are narrow session plumbing, not an application API façade. [VERIFIED: AGENTS.md] [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md]
- **Token leakage:** never expose server secrets or Keycloak access tokens via `NEXT_PUBLIC_*`, client props, logs, error UI, or localStorage. [VERIFIED: docs/CSRM-PROJECT-BRIEF.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| OpenAPI type extraction | Manual DTO/type copies | `openapi-typescript` generation | Contract changes become a reproducible diff checked in CI. [CITED: https://openapi-ts.dev/cli] |
| Typed request signatures | String URLs/hand-coded request contracts in pages | `openapi-fetch` inside one transport client | Types derive from generated OpenAPI `paths`; page code stays contract-agnostic. [CITED: https://openapi-ts.dev/openapi-fetch/] |
| Accessible dialogs/sheets/menu focus behavior | Custom focus traps and escape logic | Official shadcn components backed by supported primitives | The UI-SPEC requires focus trap/restore/Escape behaviour; use the documented Sidebar/Sheet family rather than replicate it. [CITED: https://ui.shadcn.com/docs/components/base/sidebar] [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md] |
| Cookie crypto | Custom token signing/encryption | `jose` behind the session adapter | Next.js recommends a session-management library such as Jose for stateless sessions. [CITED: https://nextjs.org/docs/app/guides/authentication] |
| Browser/a11y runner | Browser automation or rules engine | Playwright and axe integration | Playwright supplies projects and managed web server configuration; axe supplies Playwright scanning. [CITED: https://playwright.dev/docs/test-configuration] [CITED: https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/package.json] |

**Key insight:** the only intentionally custom logic is CSRM-specific capability projection and domain mapping. Identity, transport typing, UI primitives, cookie cryptography, and browser testing have established components and should remain replaceable seams.

## Common Pitfalls

### Pitfall 1: Copying runtime state with source
**What goes wrong:** `apps/strapi` inherits a nested Git repository, stale admin/build state, local SQLite/runtime state, dependency tree, or credentials.  
**Why it happens:** a blanket filesystem copy treats generated/local folders as source.  
**How to avoid:** use an exclusion manifest, preserve `.env.example` but exclude `.env` by default, delete old lockfiles from the destination before root install, and inspect the destination before first commit. [VERIFIED: ../strapi/.gitignore] [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md]  
**Warning signs:** `apps/strapi/.git`, `apps/strapi/node_modules`, `apps/strapi/.planning`, destination `.env`, or more than root `pnpm-lock.yaml` appears in `git status`.

### Pitfall 2: Treating Proxy or navigation as authorization
**What goes wrong:** a client-selected development role gains access to an endpoint or another user's record.  
**Why it happens:** UI visibility is mistaken for a data-layer decision.  
**How to avoid:** use capability configuration only for UX; verify every production Strapi operation against effective grants and record ownership/relationship rules. Next.js describes Proxy checks as optimistic and says it is not a full authorization solution. [CITED: https://nextjs.org/docs/app/getting-started/proxy] [VERIFIED: AGENTS.md]  
**Warning signs:** request headers generated from the development role, `role ===` checks outside the adapter, or endpoint tests that pass without Strapi enforcement.

### Pitfall 3: Contract types leaking into feature UI
**What goes wrong:** a generated Strapi response shape becomes page state, then a backend contract change causes broad UI churn.  
**Why it happens:** generated types are imported throughout the app.  
**How to avoid:** generated code is internal; services map transport DTOs/errors to domain models and are the sole raw transport callers. [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md]

### Pitfall 4: Turbo cache misconfiguration
**What goes wrong:** builds are rerun unnecessarily or cache hits restore no artifacts; `dev` blocks dependent tasks.  
**Why it happens:** output paths and task lifecycle are unspecified.  
**How to avoid:** declare task outputs and mark dev `persistent`/`cache: false`; persistent tasks cannot be normal dependencies. [CITED: https://turborepo.dev/docs/crafting-your-repository/configuring-tasks]

### Pitfall 5: Breaking the UI-SPEC while adopting shadcn
**What goes wrong:** default colors, a dark-mode control, nonsemantic utility colors, or unreviewed registry code replace the locked shell contract.  
**Why it happens:** generated primitives are accepted without mapping their tokens to CSRM.  
**How to avoid:** configure CSS variables at initialization, map every shadcn token to the UI-SPEC values, use only official components, and test exact state copy plus required responsive widths. [CITED: https://ui.shadcn.com/docs/theming] [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md]

## Code Examples

### Generated OpenAPI type command

```json
// apps/web/package.json
{
  "scripts": {
    "api:generate": "openapi-typescript ../../docs/references/specification.json -o src/lib/api/generated/schema.d.ts",
    "api:check": "pnpm api:generate && git diff --exit-code -- src/lib/api/generated/schema.d.ts"
  }
}
```

Source: [OpenAPI TypeScript CLI](https://openapi-ts.dev/cli). [CITED: https://openapi-ts.dev/cli]

### Session/capability seam

```ts
// src/lib/auth/session-adapter.ts — server-only
export interface SessionAdapter {
  getSession(): Promise<Session | null>
  setDevelopmentRole?(role: DevelopmentRole): Promise<void>
  signIn(returnTo: string): Promise<never>
}

// src/lib/capabilities/capability-adapter.ts
export interface CapabilityAdapter {
  getEffectiveCapabilities(session: Session): Promise<ReadonlySet<Capability>>
  can(capability: Capability, granted: ReadonlySet<Capability>): boolean
}
```

The development implementation uses the HTTP-only session cookie; feature UI consumes `can(...)`, not a role string. The production implementation is substituted at this boundary and Strapi remains the secure authorization decision point. [CITED: https://nextjs.org/docs/app/guides/authentication] [VERIFIED: AGENTS.md]

### Typed server transport and domain service

```ts
// src/lib/api/transport/server-client.ts
import 'server-only'
import createClient from 'openapi-fetch'
import type { paths } from '../generated/schema'

export const strapi = createClient<paths>({ baseUrl: process.env.CSRM_API_BASE_URL })

// src/features/requests/request-service.ts
export async function listMyRequests(): Promise<RequestSummary[]> {
  const result = await strapi.GET('/csrm-assessment-requests', { params: { query: {} } })
  if (result.error) throw toDomainError(result.error)
  return mapRequestCollection(result.data)
}
```

The exact filters and authentication middleware must be supplied only after a documented contract gap is resolved; the current specification contains CRUD collection paths but no capability endpoint. [VERIFIED: docs/references/specification.json] [CITED: https://openapi-ts.dev/openapi-fetch/]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Next.js `middleware.ts` terminology | Next.js 16 calls this boundary `proxy.ts`; its limitation as optimistic/fast request handling remains. | Next.js 16. [CITED: https://nextjs.org/docs/app/getting-started/proxy] | Name the Phase-1 optional route guard `proxy.ts` only if the selected Next version is 16+; do not rely on it for authorization. |
| shadcn default style | `default` style is deprecated; current docs recommend a new preset and CSS variables. | Current shadcn docs. [CITED: https://ui.shadcn.com/docs/components-json] | Initialize once with CSS variables; do not switch component style later without deliberate migration. |

**Deprecated/outdated:**
- The existing Strapi README documents Yarn/npm commands, while D-03 requires pnpm and one root lockfile; update the migrated developer instructions as part of the migration. [VERIFIED: ../strapi/README.md] [VERIFIED: .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Current compatible package versions can be selected after Node/npm is installed. | Standard Stack | Install can fail or introduce incompatible peer dependencies. |
| A2 | Strapi build output can be cached as `dist/**` after migration. | Architecture Patterns | Turbo may miss/replay the wrong generated artifacts. |
| A3 | A signed/encrypted dev-role cookie is appropriate rather than a server-side dev-session store. | Session pattern | Local developer UX or deployment constraints may require a different temporary implementation. |

## Open Questions (RESOLVED AS PHASE-1 BOUNDARIES)

1. **What is the deployed Keycloak/client configuration and token exchange model?**
   - What we know: Keycloak authenticates and Strapi authorizes; real integration is explicitly deferred. [VERIFIED: docs/CSRM-PROJECT-BRIEF.md]
   - What's unclear: issuer/audience, callback URL, token refresh/session lifetime, and whether Next.js forwards a bearer token or exchanges a server-side session.
   - Resolution: Phase 1 implements only the adapter interface and a validated internal return path; Phase 8 owns the live Keycloak contract decision.

2. **What is the effective-capabilities API operation?**
   - What we know: the OpenAPI document has Strapi CRUD/auth paths but no dedicated CSRM effective-capabilities endpoint. [VERIFIED: docs/references/specification.json]
   - What's unclear: endpoint, response schema, cache/refresh rules, and permission-to-navigation projection.
   - Resolution: Phase 1 creates the contract-gap record and a fixture only behind the capability adapter; a live endpoint is not invented.

3. **Which Node LTS and pnpm versions are approved for the repository?**
   - What we know: Strapi declares Node `>=20 <=26`, but the research host currently lacks Node/npm. [VERIFIED: ../strapi/package.json] [VERIFIED: environment availability audit, 2026-08-27]
   - Resolution: Plan 01-01 Task 3 is a blocking human package/runtime checkpoint before installation; approved versions are then pinned via `packageManager` and CI setup.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | pnpm, Turbo, Strapi, Next, generators/tests | ✗ | — | None — install/pin before execution. |
| npm | Registry verification and package scripts | ✗ | — | None — Node install supplies npm. |
| pnpm launcher | Root workspace workflow | △ | `pnpm.ps1` exists but cannot run without Node | Install Node then verify pnpm through Corepack. |
| Docker | Optional service/container execution | ✓ | 28.4.0 | Not required for the initial source/shell implementation. |
| Python | slopcheck install attempt | ✓ | 3.12.10 | slopcheck module/executable unavailable; human package verification checkpoint required. |
| Context7 CLI | Documentation lookup fallback | ✗ | — | Official web documentation used. |

**Missing dependencies with no fallback:** Node.js/npm; they block pnpm installation, OpenAPI generation, typecheck, Strapi/Next builds, and browser tests.  
**Missing dependencies with fallback:** Context7 CLI; official documentation was available through web lookup.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Wave 0: Vitest + Testing Library/jsdom for web; Playwright for E2E. [ASSUMED: registry verification pending] |
| Config file | None exists — create `apps/web/vitest.config.ts` and root/`apps/web/playwright.config.ts`. |
| Quick run command | `pnpm --filter @csrm/web test --run` |
| Full suite command | `pnpm turbo run lint typecheck test build test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| FOUND-01 | Root tasks run both workspaces with one lockfile/no nested repo state. | integration/CI | `pnpm turbo run typecheck build` | ❌ Wave 0 |
| FOUND-02 | Shell at locked breakpoints, semantic landmarks/titles/state copy, focus and no horizontal overflow. | component + E2E | `pnpm --filter @csrm/web test --run`; `pnpm --filter @csrm/web test:e2e -- --project=chromium` | ❌ Wave 0 |
| FOUND-03 | Generation is deterministic and pages do not perform raw production fetches. | build + static policy | `pnpm --filter @csrm/web api:check && pnpm --filter @csrm/web typecheck` | ❌ Wave 0 |
| FOUND-04 | Navigation/route UX follows fixture capabilities; server-side Strapi test rejects unauthorised/IDOR operations when an endpoint test harness is available. | unit + integration | `pnpm --filter @csrm/web test --run`; `pnpm --filter @csrm/strapi test` | ❌ Wave 0 |
| FOUND-05 | Loading/empty/error/denied states and dev role switch are testable; E2E runs desktop/mobile/a11y smoke. | component + E2E | `pnpm --filter @csrm/web test:e2e` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @csrm/web test --run` plus relevant `typecheck`.
- **Per wave merge:** `pnpm turbo run lint typecheck test build`.
- **Phase gate:** Full suite green and Playwright shell/a11y responsive checks before `$gsd-verify-work`.

### Wave 0 Gaps

- [ ] `apps/web/vitest.config.ts` and `apps/web/src/test/setup.ts` — jsdom, Testing Library matchers.
- [ ] `apps/web/src/lib/capabilities/capability-adapter.test.ts` — navigation/action projection and no direct role-string use.
- [ ] `apps/web/src/components/states/*.test.tsx` — exact UI-SPEC copy, roles, retry and landing-link behaviour.
- [ ] `apps/web/e2e/app-shell.spec.ts` — 375, 390, 430, 768, 1024, 1440 widths; menu keyboard/close; no page horizontal scroll.
- [ ] `apps/web/e2e/accessibility.spec.ts` — axe scan plus manual-assessed WCAG behaviours.
- [ ] `apps/web/package.json` generation/check/typecheck/test/e2e scripts and Turbo task declarations.
- [ ] Strapi authorization integration-test harness/seed plan — required before claiming enforcement/IDOR coverage; it cannot be simulated by the web role switch.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Keycloak OIDC behind `SessionAdapter`; HTTP-only/Secure/SameSite server cookie seam. [VERIFIED: docs/CSRM-PROJECT-BRIEF.md] [CITED: https://nextjs.org/docs/app/guides/authentication] |
| V3 Session Management | yes | Server-only cookie read/write; bounded lifetime; no localStorage token. [CITED: https://nextjs.org/docs/app/api-reference/functions/cookies] |
| V4 Access Control | yes | Strapi effective Role → Function → FunctionAPI plus record rules; frontend capability checks are UX only. [VERIFIED: AGENTS.md] |
| V5 Input Validation | yes | Treat route params, `returnTo`, OpenAPI responses, and dev-role action input as untrusted; validate server-side. [VERIFIED: docs/CSRM-PROJECT-BRIEF.md] |
| V6 Cryptography | yes | Use established session library (`jose`) for cookie protection; never custom crypto. [CITED: https://nextjs.org/docs/app/guides/authentication] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Client role/capability tampering | Elevation of privilege | Server-only cookie/session adapter for Phase 1; Strapi independently enforces every production call. [VERIFIED: AGENTS.md] |
| IDOR through route/path ID | Information disclosure / elevation | Strapi record-level authorization test with two identities; do not trust a frontend route guard. [VERIFIED: docs/CSRM-PROJECT-BRIEF.md] |
| Open redirect after Keycloak login | Spoofing | Accept only validated internal relative `returnTo` paths; otherwise use authorised landing route. [ASSUMED] |
| Token/secret leakage | Information disclosure | HTTP-only cookies, no `NEXT_PUBLIC_*` secrets, redacted errors/logs, `.env` ignored. [VERIFIED: docs/CSRM-PROJECT-BRIEF.md] |
| CORS/session misconfiguration | Information disclosure / CSRF | Preserve/review existing Strapi security/CORS/session middleware and refresh session HTTP-only setting; configure allowed frontend origin deliberately. [VERIFIED: ../strapi/config/middlewares.ts] [VERIFIED: ../strapi/config/plugins.ts] |

## Sources

### Primary (HIGH confidence)

- [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication) — session cookie options, DAL and optimistic vs secure authorization.
- [Next.js cookies API](https://nextjs.org/docs/app/api-reference/functions/cookies) — server read/write limits and cookie flags.
- [Turborepo task configuration](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks) and [configuration reference](https://turborepo.dev/docs/reference/configuration) — task graph, outputs, cache and persistent task behaviour.
- [OpenAPI TypeScript CLI](https://openapi-ts.dev/cli) and [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) — generation and typed fetch patterns.
- [shadcn theming](https://ui.shadcn.com/docs/theming), [components.json](https://ui.shadcn.com/docs/components-json), and [sidebar](https://ui.shadcn.com/docs/components/base/sidebar) — CSS variables and owned components.
- [Playwright configuration](https://playwright.dev/docs/test-configuration) — web server and projects.
- Local authoritative sources: `AGENTS.md`, Phase 1 `CONTEXT.md`, `UI-SPEC.md`, `docs/CSRM-PROJECT-BRIEF.md`, `docs/references/specification.json`, and reviewed Strapi files listed in the task.

### Secondary (MEDIUM confidence)

- [Deque axe Playwright package source](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/package.json) — maintained package identity and Playwright integration.

### Tertiary (LOW confidence)

- None; package version/legitimacy findings remain explicitly `[ASSUMED]` because registry and slopcheck verification could not run.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — official documentation supports the architecture, but no Node/npm registry check or slopcheck verdict was possible.
- Architecture: HIGH — locked Phase 1 decisions, local source audit, product brief, and official Next/Turbo/OpenAPI guidance agree.
- Pitfalls: HIGH — the nested source tree, mixed lockfiles, existing Strapi session/upload config, and API contract gaps were directly inspected.

**Research date:** 2026-08-27  
**Valid until:** 2026-09-03 — frontend/build tooling changes quickly; re-run Node/npm registry and slopcheck checks before implementation.
