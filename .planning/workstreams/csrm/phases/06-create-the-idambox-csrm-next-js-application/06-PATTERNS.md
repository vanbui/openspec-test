# Phase 6: CSRM Foundation - Pattern Map

**Mapped:** 2026-08-09  
**Files analyzed:** 34 planned new/modified files (including generated shadcn sources)  
**Analogs found:** 24 / 34

> The referenced example in the planning documents is named `edatlas-dylan` on disk, not `edalas-dylan`. It is the closest structural analog. Its Auth0 client-side session model, React Query provider, role-name comparisons, proxy routes, and raw component colours are **not** CSRM patterns: Phase 6 must use server-first App Router modules, a Function-derived capability registry, a server-only Strapi boundary, and semantic tokens.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `package.json`, `turbo.json` | config | batch | `example-projects/edatlas-dylan/package.json`, `turbo.json` | exact |
| `apps/csrm/package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `components.json` | config | request-response | `example-projects/edatlas-dylan/apps/web/{package.json,tsconfig.json,next.config.ts,postcss.config.mjs,components.json}` | exact |
| `apps/csrm/src/app/layout.tsx`, `page.tsx`, `loading.tsx`, `not-found.tsx`, `globals.css` | component | request-response | `example-projects/edatlas-dylan/apps/web/src/app/{layout.tsx,globals.css}` | role-match |
| `apps/csrm/src/components/ui/{avatar,button,breadcrumb,card,collapsible,dropdown-menu,separator,sheet,skeleton,tooltip,alert}.tsx` | component | transform | `example-projects/edatlas-dylan/apps/web/src/components/ui/{button,card,dropdown-menu,skeleton}.tsx` | exact (registry source differs) |
| `apps/csrm/src/components/shell/{app-shell,sidebar,navigation-group,mobile-navigation,app-header,page-header,account-menu,development-identity-selector}.tsx` | component | event-driven | `example-projects/edatlas-dylan/apps/web/src/components/layout/Header.tsx` | role-match |
| `apps/csrm/src/components/states/{access-denied,unavailable,empty,loading,error}.tsx` | component | request-response | `example-projects/edatlas-dylan/apps/web/src/components/submissions/shared/{ErrorState,LoadingState}.tsx` | partial |
| `apps/csrm/src/config/{capabilities,routes,env}.ts` | config | transform | `example-projects/edatlas-dylan/apps/web/src/lib/constants/{paths,roles,routers}.ts` | partial |
| `apps/csrm/src/domain/{identity,service-result}.ts` | model | transform | `example-projects/edatlas-dylan/apps/web/src/lib/user-permissions.ts` | partial |
| `apps/csrm/src/lib/fixtures/{identities,resolve-identity}.ts` | service | request-response | `example-projects/edatlas-dylan/apps/web/src/lib/auth-wrapper.ts` | partial |
| `apps/csrm/src/lib/api/generated/openapi.ts` | model | transform | `example-projects/edatlas-dylan/apps/web/src/lib/openapi.d.ts` | role-match |
| `apps/csrm/src/lib/api/{client,csrm-service}.ts` | service | request-response | `example-projects/edatlas-dylan/apps/web/src/lib/api/{client,classes}.ts` | role-match |
| `apps/csrm/scripts/generate-openapi.mjs`, `scripts/check-openapi-drift.mjs` | utility | file-I/O | no close in-repo analog | none |
| `apps/csrm/src/test/{setup,handlers,server,fixtures}.ts` and `*.test.ts(x)` | test | request-response | no close in-repo analog | none |
| `apps/csrm/{vitest.config.ts,playwright.config.ts,e2e/shell.spec.ts}` | test | event-driven | `example-projects/grad/{vitest.config.ts,playwright.config.ts}` | role-match |

## Pattern Assignments

### `package.json` and `turbo.json` (workspace config, batch)

**Analog:** `example-projects/edatlas-dylan/package.json:1-31`, `example-projects/edatlas-dylan/turbo.json:1-37`.

Copy the Yarn workspaces and root Turbo command shape, adding CSRM scripts without changing existing backend commands. Unlike the current root `turbo.json`, add the standard Next `.next/**` build output through the app-aware task graph.

```json
"scripts": {
  "build": "turbo run build",
  "dev": "turbo run dev",
  "lint": "turbo run lint",
  "check-types": "turbo run check-types"
},
"workspaces": ["apps/*", "packages/*"]
```

```json
"build": {
  "dependsOn": ["^build"],
  "inputs": ["$TURBO_DEFAULT$", ".env*"],
  "outputs": [".next/**", "!.next/cache/**"]
}
```

### `apps/csrm/{package.json,tsconfig.json,next.config.ts,postcss.config.mjs,components.json}` (application/tooling config, request-response)

**Analog:** `example-projects/edatlas-dylan/apps/web/package.json:1-51`, `tsconfig.json:1-28`, `postcss.config.mjs:1-5`, `components.json:1-22`.

Use the same strict Next TypeScript and `@/* -> src/*` alias convention. Use `next dev --turbopack --port 3001` to keep CSRM separate from Strapi (1337) and Keycloak (8080). Keep `next.config.ts` minimal; remote image configuration is not justified in Phase 6.

```json
"compilerOptions": {
  "strict": true,
  "noEmit": true,
  "moduleResolution": "bundler",
  "jsx": "preserve",
  "plugins": [{ "name": "next" }],
  "paths": { "@/*": ["./src/*"] }
}
```

```js
const config = { plugins: ["@tailwindcss/postcss"] };
export default config;
```

```json
{
  "style": "new-york",
  "rsc": true,
  "tailwind": { "css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "lucide",
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui" }
}
```

### `apps/csrm/src/app/{layout,page,loading,not-found}.tsx` (server components, request-response)

**Analog:** `example-projects/edatlas-dylan/apps/web/src/app/layout.tsx:1-68`.

Copy the root layout’s metadata, global stylesheet import, `next/font` use, and typed `Readonly<{ children: React.ReactNode }>` signature. Replace its global `QueryProvider`, `Header`, and `Footer` with a server-rendered CSRM `AppShell`; do not introduce React Query or client-wide context. `page.tsx` renders only the neutral foundation copy; `loading.tsx` retains shell geometry via a silent skeleton; `not-found.tsx` uses the approved unavailable copy.

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'IdamBox CSRM' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### `apps/csrm/src/app/globals.css` (design-token stylesheet, transform)

**Analog:** `example-projects/edatlas-dylan/apps/web/src/app/globals.css:1-121`.

Copy Tailwind 4 import, dark selector, `@theme inline` token-to-utility mapping, paired `:root`/`.dark` CSS variables, and the base layer. Replace every example product colour, chart value, and animation with the UI-SPEC’s exact CSRM semantic token values; components must use those semantic utilities rather than raw values. Respect the contract’s 150–200ms motion and reduced-motion override, rather than copying the example’s 0.3–0.6 second animation utilities.

```css
@import 'tailwindcss';
@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

### `apps/csrm/src/components/ui/*.tsx` (local shadcn primitives, transform)

**Analog:** `example-projects/edatlas-dylan/apps/web/src/components/ui/button.tsx:1-52`, `card.tsx:1-56`.

Generate the approved official shadcn sources, retaining the local-source architecture, `cn` helper, `cva` variants, Radix `Slot`, typed native props, and `data-slot` convention. Do **not** copy the rounded-full button or example sizing; the UI contract requires `primary`, `secondary`, `ghost`, `destructive` and `sm`/`md`/`icon` sizes with its documented 36/40/44px minima.

```tsx
const buttonVariants = cva('inline-flex items-center justify-center gap-2 ...', {
  variants: { variant: { primary: 'bg-primary text-primary-foreground', ghost: '...' }, size: { sm: '...', md: '...', icon: '...' } },
  defaultVariants: { variant: 'primary', size: 'md' },
});

function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
```

### `apps/csrm/src/components/shell/*.tsx` (shell/client islands, event-driven)

**Analog:** `example-projects/edatlas-dylan/apps/web/src/components/layout/Header.tsx:1-117`.

Copy the clear separation of a `use client` interactive component, `Link`, pathname active-state calculation, mapped navigation, and Radix dropdown composition. The CSRM shell must receive server-resolved identity/capabilities, filter the single typed route registry, and put only collapse preference, Sheet state, menu state, and development selector in client components. Never derive visible items from role display-name comparisons such as the following rejected example:

```tsx
const isActivePath = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

{navigationItems.map((item) => (
  <Link key={item.href} href={item.href} className={cn('...', isActivePath(item.href) && '...')}>
    {item.label}
  </Link>
))}
```

Apply this pattern instead: `visibleRoutes = routeRegistry.filter(route => route.status === 'enabled' && capabilities.has(route.capability))`. The server guard must decide known enabled unauthorized routes before any protected service call; planned/unknown paths render `UnavailableState`.

### `apps/csrm/src/components/states/*.tsx` (shared UI states, request-response)

**Analog:** `example-projects/edatlas-dylan/apps/web/src/components/submissions/shared/ErrorState.tsx:1-31` and `LoadingState.tsx:1-13`.

The example demonstrates a small, typed state component and router-driven return action, but is otherwise a negative visual analog: CSRM must not full-screen-spin, use emoji, raw colour utilities, or reveal raw errors. Build semantic `Alert`/`Card` compositions with UI-SPEC copy, `role="alert"` for errors, and `aria-hidden` decorative skeletons. Retry is a supplied callback; it must retain any already-loaded safe content.

### `apps/csrm/src/config/{capabilities,routes,env}.ts` and `src/domain/{identity,service-result}.ts` (registry/domain model, transform)

**Analog:** `example-projects/edatlas-dylan/apps/web/src/lib/user-permissions.ts:4-14,42-80` (structure only).

Keep interfaces and a pure predicate outside presentation components, but replace the example’s `role: string` and role-name comparisons with a union inferred from a `const` mirror of `idambox-csrm-role-function-api-catalogue.json`. Define capability union, fixture identity snapshot, route record (`capability`, `status`, `menuPath`, title, icon), `canAccess`, `ApiError`, and `ServiceResult<T>` in these non-React modules.

```ts
export interface ViewPermissionResult { allowed: boolean; reason?: string; }

export function canAccess(route: RouteDefinition, capabilities: ReadonlySet<CapabilityId>) {
  return route.status === 'enabled' && capabilities.has(route.capability);
}

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
```

### `apps/csrm/src/lib/fixtures/{identities,resolve-identity}.ts` (server-only identity service, request-response)

**Analog:** `example-projects/edatlas-dylan/apps/web/src/lib/auth-wrapper.ts:1-16` (server boundary only).

Preserve the pattern that an authentication/identity boundary resolves on the server and returns early rather than trusting client data. Phase 6 must not import Auth0, establish a session, or return a 401 middleware response. Compile/select deterministic Jane/Bob fixture identities only in `development`/`test`; production imports no switcher or fixture resolver. The selector’s serializable requested fixture is valid only through a test/development-controlled boundary, never URL, local storage, or `NEXT_PUBLIC_` flag.

```ts
export function withAuth<T extends unknown[]>(handler: (...args: T) => Promise<NextResponse>) {
  return async (...args: T): Promise<NextResponse> => {
    // resolve trusted server identity, then invoke handler
    return handler(...args);
  };
}
```

### `apps/csrm/src/lib/api/{generated/openapi.ts,client.ts,csrm-service.ts}` (typed server-only service, request-response)

**Analog:** `example-projects/edatlas-dylan/apps/web/src/lib/api/client.ts:1-114`, `classes.ts:1-21`.

Preserve the layered boundary: a transport client normalizes failures and focused modules expose named operations. Improve it for CSRM by using `fetch`, `import 'server-only'`, generated OpenAPI types in this directory only, a parsed server environment value, and a discriminated result instead of throwing transport details into UI. UI modules import `csrm-service`/domain types—not generated `paths` or raw `fetch`. The committed `specification.json` supplies the actual Strapi collection paths; FunctionApi URL strings in the catalogue are capability evidence, not client endpoints.

```ts
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const classesApi = {
  getAll: async (query?: Query): Promise<ResponseShape> => apiClient.get(`/api/strapi/classes${queryString}`),
};
```

### `apps/csrm/scripts/{generate-openapi,check-openapi-drift}.mjs` (generation utility, file-I/O)

**Analog:** no close in-repository analog.

Use the RESEARCH.md build-time generation example: take only `docs/references/specification.json` as input and write only `src/lib/api/generated/openapi.ts`. A separate drift check must regenerate to a temporary location and fail if it differs; generated output is never handwritten.

### `apps/csrm/src/test/*`, `vitest.config.ts`, `playwright.config.ts`, and `e2e/shell.spec.ts` (test infrastructure, request-response/event-driven)

**Analog:** `example-projects/grad/vitest.config.ts` and `example-projects/grad/playwright.config.ts` (tooling role only); no current in-repo MSW/Testing Library shell-test analog.

Follow RESEARCH.md’s MSW lifecycle exactly: Node `setupServer`, `beforeAll(server.listen({ onUnhandledRequest: 'error' }))`, `afterEach(server.resetHandlers)`, `afterAll(server.close)`. Share typed HTTP payload factories with handlers; mocks intercept the focused service boundary rather than being embedded in page components. Playwright owns real responsive/focus testing at the UI-SPEC viewports; Vitest owns pure registry, service-result, and Client Component interactions. Do not unit-render async Server Components as a substitute for browser shell evidence.

## Shared Patterns

### Workspace and imports
**Source:** `example-projects/edatlas-dylan/apps/web/tsconfig.json:1-28`, `components.json:1-22`  
**Apply to:** every CSRM TypeScript/TSX module.

Use strict TypeScript, `@/*` absolute imports, `@/lib/utils` `cn`, and local `components/ui` primitives. The app is a standalone workspace under the existing Yarn/Turbo root.

### Server/client boundary
**Source:** `example-projects/edatlas-dylan/apps/web/src/app/layout.tsx:50-68`, `components/layout/Header.tsx:1-25`  
**Apply to:** routes, `AppShell`, and every interactive shell element.

Default to a server module. Add `'use client'` only to components requiring state, event handlers, focus management, browser storage, or client navigation. Pass serializable server results down; never import server-only API/env modules into a client island.

### Authorization/capability boundary
**Source:** `apps/csrm/docs/references/idambox-csrm-role-function-api-catalogue.json:25-61,224-235` and `apps/backend/src/bootstrap/seed-csrm-data.ts` (catalogue implementation)  
**Apply to:** route registry, navigation, action visibility, and direct-route preflight.

The source Function IDs are the single frontend capability vocabulary. Requestor is a birthright capability set; Security Analyst is additive. No TSX compares role labels. Visibility is usability only; Strapi remains authoritative and Phase 13 supplies production identity/effective capabilities.

### Error and state safety
**Source:** `example-projects/edatlas-dylan/apps/web/src/lib/api/client.ts:13-23,53-86` (boundary shape only), `06-UI-SPEC.md:176-221`  
**Apply to:** services and reusable state components.

Normalize non-2xx, malformed response, timeout, and network failures once in the service boundary. Surface only approved safe recovery copy; never raw Strapi bodies, headers, tokens, or stacks.

### CSS semantics and accessibility
**Source:** `example-projects/edatlas-dylan/apps/web/src/app/globals.css:1-121`, `06-UI-SPEC.md:223-272`  
**Apply to:** global CSS and every shell/state primitive.

Map UI-SPEC tokens to Tailwind CSS variables, use landmarks/skip link/one `h1`, semantic buttons and links, visible focus rings, and reduced-motion rules. State geometry stays stable through loading.

## No Analog Found

| File/group | Role | Data Flow | Reason |
|---|---|---|---|
| Typed Function-derived capability registry and birthright-plus-elevation resolver | config/model | transform | Existing reference app checks Auth0 role display strings; that violates the Phase 6 authorization contract. |
| Environment-compiled fixture resolver and development identity switcher | service/component | request-response/event-driven | Existing app has production Auth0 session handling, not a secure non-production fixture boundary. |
| `openapi-typescript` generation plus drift check | utility | file-I/O | Existing reference has manually maintained OpenAPI declarations, which Phase 6 must replace with generated transport types. |
| MSW handlers/server and Testing Library foundations | test | request-response | No MSW or Vitest integration suite exists in the current app/reference. |
| CSRM desktop/sidebar + mobile Sheet shell | component | event-driven | The reference has a responsive top header, but no capability-filtered enterprise sidebar/drawer shell. |

## Metadata

**Analog search scope:** root workspace config; `apps/backend`; `apps/csrm/docs`; `example-projects/edatlas-dylan/apps/web`; `example-projects/grad` test config  
**Files scanned:** 20 direct analog/config/reference files (plus catalogue/OpenAPI metadata searches)  
**Pattern extraction date:** 2026-08-09
