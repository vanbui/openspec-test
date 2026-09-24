# Phase 1: Monorepo Foundation and Secure Application Shell - Pattern Map

**Mapped:** 2026-08-27  
**Files classified:** 18 destination groups  
**Analogs found:** 4 / 18 (the root has no application source and no frontend exists yet)

## File Classification

| New/Modified File | Role | Data flow | Closest analog / authority | Match |
|---|---|---|---|---|
| `apps/strapi/**` (source-level copy) | config, API, model | CRUD, request-response | `../strapi/**` | exact migration |
| `apps/strapi/package.json` | config | batch | `../strapi/package.json` | exact migration |
| `apps/strapi/config/middlewares.ts` | config/middleware | request-response | `../strapi/config/middlewares.ts` | exact migration |
| `apps/strapi/config/plugins.ts` | config/middleware | request-response, file-I/O | `../strapi/config/plugins.ts` | exact migration |
| root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore` | config | batch | `01-RESEARCH.md` Pattern 2 | greenfield |
| `apps/web/package.json`, `tsconfig.json`, Next/Tailwind config, `components.json` | config | batch | `01-RESEARCH.md` Patterns 2/5; `01-UI-SPEC.md` | greenfield |
| `apps/web/app/layout.tsx`, protected layout, page/metadata boundaries | component/layout | request-response | `01-RESEARCH.md` lines 145-151; `01-UI-SPEC.md` | greenfield |
| `apps/web/app/globals.css` | config/style | transform | `01-UI-SPEC.md` Design System and token tables | greenfield |
| `apps/web/src/components/shell/{app-shell,sidebar,mobile-navigation,app-header,wordmark,user-menu}.tsx` | component | event-driven | `01-UI-SPEC.md` Required shell primitives | greenfield |
| `apps/web/src/components/shell/{capability-navigation,page-header,breadcrumbs,page-actions}.tsx` | component | transform | `01-UI-SPEC.md` layout/capability contract | greenfield |
| `apps/web/src/components/states/*-state.tsx` | component | request-response | `01-UI-SPEC.md` state copy table | greenfield |
| `apps/web/src/components/ui/*` | component | event-driven | official shadcn output; `01-UI-SPEC.md` Registry Safety | greenfield/owned generated |
| `apps/web/src/lib/auth/{session-adapter,development-session-adapter,keycloak-session-adapter}.ts` | service/adapter | request-response | `01-RESEARCH.md` lines 271-288 | greenfield |
| `apps/web/src/lib/capabilities/{capability-adapter,capabilities,navigation}.ts` | service/utility | transform | `01-RESEARCH.md` lines 281-288 | greenfield |
| `apps/web/src/lib/api/generated/schema.d.ts` | generated model | transform | `docs/references/specification.json`; research lines 257-265 | generated |
| `apps/web/src/lib/api/transport/server-client.ts` and `src/features/**/**-service.ts` | service | request-response, CRUD | `01-RESEARCH.md` lines 290-305 | greenfield |
| `apps/web/{vitest.config.ts,src/test/setup.ts,src/**/*.test.ts?(x)}` | test/config | request-response | `01-RESEARCH.md` lines 387-389 | greenfield |
| `apps/web/e2e/{app-shell,accessibility}.spec.ts`, `playwright.config.ts` | test/config | event-driven | `01-RESEARCH.md` lines 390-391 | greenfield |

## Pattern Assignments

### `apps/strapi/**` — migrate the existing API; do not scaffold a replacement

**Analog:** `../strapi/` source tree. Preserve its `config/`, `src/`, `database/`, `public/`, `types/`, `tsconfig.json`, `package.json`, and `.env.example` layout. The API modules use one directory per CSRM JDL entity: `src/api/<entity>/{content-types,controllers,routes,services}`.

**Core Strapi CRUD/policy pattern:** [`../strapi/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts` lines 1-10](../strapi/src/api/csrm-assessment-request/routes/csrm-assessment-request.ts) wraps the generated core router with the application-enabled policy; its matching controller/service use `factories.createCoreController` and `factories.createCoreService`. Keep this topology intact during the copy.

```ts
export default factories.createCoreRouter('api::csrm-assessment-request.csrm-assessment-request', {
  config: {
    find: { policies: ['global::csrm-app-enabled'] },
    findOne: { policies: ['global::csrm-app-enabled'] },
    create: { policies: ['global::csrm-app-enabled'] },
    update: { policies: ['global::csrm-app-enabled'] },
    delete: { policies: ['global::csrm-app-enabled'] },
  },
});
```

**Lifecycle/seed integration:** [`../strapi/src/index.ts` lines 1-14](../strapi/src/index.ts) registers no active Keycloak integration and bootstraps `seedCoreData` then `seedCsrmData`. Preserve this ordering; Phase 1 must not treat the UI development role switcher as backend authorization.

**Prohibited copy artifacts:** `../strapi/.git`, `.planning`, `node_modules`, `.tmp`, `.strapi`, `dist`, `.env`, `package-lock.json`, and `yarn.lock`. Copy, never move, so the sibling remains an unchanged backup. Keep destination `.env` ignored; review/copy `.env.example` without exposing an `.env` value.

### `apps/strapi/config/{middlewares,plugins}.ts` — retain the security baseline

**Analogs:** [`../strapi/config/middlewares.ts` lines 1-16](../strapi/config/middlewares.ts), [`../strapi/config/plugins.ts` lines 1-44](../strapi/config/plugins.ts).

**Middleware order to preserve:**

```ts
const config: Core.Config.Middlewares = [
  'strapi::logger', 'strapi::errors', 'strapi::security', 'strapi::cors',
  'strapi::poweredBy', 'strapi::query', 'strapi::body', 'strapi::session',
  'strapi::favicon', 'strapi::public',
];
```

**Session and upload pattern to retain/review:**

```ts
'users-permissions': { config: { jwtManagement: 'refresh', sessions: { httpOnly: true } } },
upload: { config: { security: { allowedTypes: allowedMediaTypes, deniedTypes: deniedExecutableTypes } } },
```

Configure the web origin deliberately when CORS is revised. Do not weaken `httpOnly`, upload denylists, or Strapi-side authorization as part of a frontend seam.

### Root workspace and task files — greenfield configuration

**Authority:** `01-RESEARCH.md` Pattern 2 (lines 184-188) and `../strapi/package.json`.

Copy the Strapi application’s scripts as the package-level contract (`build`, `dev`/`develop`, `start`, `strapi`), but move orchestration to root pnpm/Turbo. Root workspaces include `apps/*`; the one root `pnpm-lock.yaml` replaces the sibling's mixed npm/Yarn locks. Turbo `build` depends on `^build` and declares outputs; `dev` is persistent, uncached, and never a dependency. Root CI must run web `api:check` plus clean typecheck.

### `apps/web/app/**` and shell components — greenfield, server-derived shell

**Authority:** `01-RESEARCH.md` lines 145-151 and `01-UI-SPEC.md` Required shell primitives/layout contract.

The server layout obtains the session and capability set, then passes a presentation model to `AppShell`/`CapabilityNavigation`; client components only manage UI interaction (Sheet, dropdown, sidebar collapse). Keep one `header`, `nav`, and `main`, with a skip link to the main/h1. Generate navigation centrally, not from `role === ...` checks. Route denial renders `PermissionDeniedState`; it does not disclose record existence or authorize API access.

`globals.css` owns the light semantic CSS variables and a future `.dark` override point. TSX consumes semantic Tailwind/token utilities only; apply the exact 64px header, 264/72px desktop sidebar, 44px targets, breakpoints, typography, and state copy in `01-UI-SPEC.md`. `Wordmark` is the single replaceable `IdamBox CSRM` text component. Add shadcn primitives only from its official registry and keep their output locally owned under `src/components/ui`.

### Session and capability adapters — greenfield security seam

**Authority/code shape:** `01-RESEARCH.md` lines 271-288.

```ts
export interface SessionAdapter {
  getSession(): Promise<Session | null>
  setDevelopmentRole?(role: DevelopmentRole): Promise<void>
  signIn(returnTo: string): Promise<never>
}

export interface CapabilityAdapter {
  getEffectiveCapabilities(session: Session): Promise<ReadonlySet<Capability>>
  can(capability: Capability, granted: ReadonlySet<Capability>): boolean
}
```

Implement only the development adapter in Phase 1, behind this interface: a server action/handler writes a bounded, signed/encrypted, HTTP-only, SameSite=Lax cookie (`secure` in production) containing only a development session selector. Validate a `returnTo` as an internal relative path before the later Keycloak redirect. Never use localStorage for tokens, expose a token to a client component, or make the fixture role an API authorization input. Strapi must enforce effective Role → Function → FunctionAPI and record rules.

### Generated transport and domain services — greenfield request boundary

**Authority/code shape:** `01-RESEARCH.md` lines 257-265 and 290-305; contract: `docs/references/specification.json`.

```ts
import 'server-only'
import createClient from 'openapi-fetch'
import type { paths } from '../generated/schema'

export const strapi = createClient<paths>({ baseUrl: process.env.CSRM_API_BASE_URL })
```

Generate and commit only `src/lib/api/generated/schema.d.ts`; it is internal. `transport/server-client.ts` is the sole `openapi-fetch` construction point. Feature services call typed operations, map DTOs to domain/UI models, and normalize `result.error`; pages/components import the service or hook, never generated types or raw `fetch`.

Use the repeatable package script pattern:

```json
"api:generate": "openapi-typescript ../../docs/references/specification.json -o src/lib/api/generated/schema.d.ts",
"api:check": "pnpm api:generate && git diff --exit-code -- src/lib/api/generated/schema.d.ts"
```

The supplied OpenAPI contract has CRUD paths but no effective-capabilities endpoint or Keycloak callback. Record those as contract gaps; use only a fixture or HTTP-level test double behind the service seam. Do not add `app/api` as a Strapi proxy/facade.

### Tests — greenfield, test seams rather than internals

**Authority:** `01-RESEARCH.md` lines 387-392 and `01-UI-SPEC.md` acceptance criteria.

Vitest/Testing Library covers capability-to-navigation/action projection and exact state messages, roles, retry, and landing-link behavior. Playwright covers 375, 390, 430, 768, 1024, and 1440px; Sheet keyboard/close behavior; no page horizontal scroll; and axe smoke checks. Test frontend gating as UX only; add a separate Strapi authorization integration/seed plan before claiming Role/Function/FunctionAPI or IDOR coverage.

## Shared Patterns

### Backend authority and error handling

Source: `AGENTS.md` and the Strapi route/policy analog above. Frontend failures use the UI-SPEC’s exact `ErrorState` copy and retry only the failed request; never show stack traces, API URLs, tokens, or sensitive record detail. A page/route guard is optimistic UX, not enforcement.

### Contract/model terminology

Source: `docs/references/specification.json`, `docs/references/idambox-datamodel.jdl`, and `../strapi/src/api/*/content-types/*/schema.json`. Keep JDL names such as `CSRM Assessment Request`; map transport fields rather than create competing frontend entities. For example, the assessment-request schema defines `requestNumber`, `requestStatus`, and links to `idambox-user` (lines 15-115).

### Environment and secrets

Source: `../strapi/config/server.ts` lines 3-14 and `../strapi/config/database.ts` lines 5-72. Read configuration through Strapi’s typed `env` accessor; retain `.env.example`, keep `.env` ignored, and never commit secrets. Next public environment variables contain no credentials.

## No Analog Found

There is no existing Next.js, React, Tailwind, shadcn, OpenAPI client, auth adapter, test harness, or CI/task configuration in the root repository. The planner must use `01-RESEARCH.md` and `01-UI-SPEC.md` as the concrete starting contract, then establish the listed layout consistently rather than copying Strapi code into the web app.

## Metadata

**Analog search scope:** root repository (docs/planning only) and sibling `../strapi` package/config/source layout.  
**Files read for extraction:** 12 primary project/config/source artifacts; no `.env` file was read.  
**Pattern extraction date:** 2026-08-27
