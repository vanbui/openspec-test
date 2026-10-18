<!-- generated-by: gsd-doc-writer -->
# Development

## Local setup

Follow [Getting started](getting-started.md), install with pnpm from the root, and keep environment files ignored. The root workspace orchestrates both applications; each application can also be started independently.

## Build commands

All commands below run from the repository root.

| Command | Description |
|---|---|
| `pnpm dev` | Turbo development servers |
| `pnpm build` | Turbo builds |
| `pnpm lint` | Defined workspace lint tasks |
| `pnpm typecheck` | Workspace type tasks, with API-check dependency |
| `pnpm test` | Workspace tests, with typecheck dependency |
| `pnpm test:e2e` | Uncached E2E task after build/test dependencies |
| `pnpm verify:csrm-seed` | Static and runtime seed verification |
| `pnpm --filter @csrm/web dev` | Next development server |
| `pnpm --filter @csrm/web build` | Next production build |
| `pnpm --filter @csrm/web lint` | Next type generation and TypeScript checking |
| `pnpm --filter @csrm/web typecheck` | Same defined type-generation/typecheck command |
| `pnpm --filter @csrm/web test` | Vitest |
| `pnpm --filter @csrm/web test:e2e` | Playwright |
| `pnpm --filter @csrm/web api:generate` | Regenerate schema types from the reference specification |
| `pnpm --filter @csrm/web api:check` | Regenerate and require no generated-schema diff |
| `pnpm --filter @csrm/strapi dev` | Strapi development server |
| `pnpm --filter @csrm/strapi develop` | Same Strapi development command |
| `pnpm --filter @csrm/strapi build` | Build Strapi |
| `pnpm --filter @csrm/strapi start` | Start built Strapi |
| `pnpm --filter @csrm/strapi console` | Strapi console |
| `pnpm --filter @csrm/strapi strapi` | Strapi CLI |
| `pnpm --filter @csrm/strapi test` | Compile and run serial Node tests |
| `pnpm --filter @csrm/strapi served-operations:write` | Compile and run served-operation integration proof |
| `pnpm --filter @csrm/strapi authorization-matrix:observe` | Compile and run mounted authorisation-matrix proof |
| `pnpm --filter @csrm/strapi deploy` | Declared Strapi deploy CLI; no repository deployment pipeline is implied |
| `pnpm --filter @csrm/strapi upgrade:dry` | Declared Strapi upgrade dry run |
| `pnpm --filter @csrm/strapi upgrade` | Declared Strapi upgrade command; treat as a dependency migration |

Turbo only runs tasks defined by each package. The backend has no lint or typecheck script; its test script compiles backend and test TypeScript. A root lint run is not a separate backend lint gate.

## Code style

TypeScript is strict. The web lint script currently runs Next type generation and tsc, rather than ESLint. No root formatting script is declared.

Prefer Server Components. Client Components handle interaction and browser APIs. Business logic belongs in domain/service modules, outside JSX. Use shadcn/ui primitives and semantic design tokens from the [Design direction](../design/csrm-design-direction.md). Every material workflow needs automated tests at mobile and desktop widths.

## API and domain changes

Strapi remains the production business API boundary. Use the typed API layer rather than raw fetch in page components. Validate external payloads with schemas. Update the reference specification and generated types together; `api:check` regenerates the tracked file and intentionally fails on a diff.

Use JDL terminology and [CONTEXT.md](../../CONTEXT.md). Record contract/model gaps under docs/contract-gaps before introducing new concepts. Backend changes can affect every application sharing Strapi. Keycloak authenticates; Strapi grants and record checks remain authoritative.

## Branch conventions

No repository-specific branch naming convention is documented in the contribution files. Work on the current branch unless the task explicitly requires a change. Do not infer a branch policy from a developer's local branches.

## PR process

- Describe the user-visible behaviour and relevant contract changes.
- Follow the [Issue tracker conventions](../agents/issue-tracker.md) and [Triage labels](../agents/triage-labels.md).
- Include meaningful validation evidence; [CI](../../.github/workflows/ci.yml) checks the contract and runs the finite quality suite on pull requests and pushes to main.
- Preserve human-controlled assessment release, record access and semantic styling.
- Keep secrets out of commits and generated browser code.

See [Frontend components](../frontend/components.md) and [Backend services](../services/backend-services.md) for module boundaries.
