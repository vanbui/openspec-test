# Stack Research

## Recommended baseline

- Use **pnpm workspaces** and Turborepo at the repository root, with `apps/strapi` and `apps/web`. A root lockfile is essential for reproducible workspace dependency graphs and Turbo caching.
- Retain the existing **Strapi 5.51.0** application as the CSRM API workspace; migrate its package-management artifacts deliberately rather than mixing npm and Yarn lockfiles.
- Use **Next.js App Router**, strict TypeScript, Tailwind CSS, and shadcn/ui in `apps/web`. Pages and layouts are Server Components by default; isolate interactive forms, tables, drawers, and charts at small Client Component boundaries.
- Use **Keycloak Authorization Code Flow with PKCE** and a server-held application session. The CSRM API validates access tokens; CSRM authorization remains enforced by Strapi against IdamBox roles, functions, FunctionAPI grants, and record-level rules.
- Generate or validate frontend transport types from `docs/references/specification.json`; keep domain types and transport types distinct.

## Deliberate choices

- Prefer React Hook Form + Zod for complex dynamic forms, TanStack Table for data-heavy collections, and Playwright plus unit/component testing.
- Keep an adapter boundary for AI jobs and for CSV import endpoints. Deterministic development implementations are acceptable only behind those boundaries.
- Do not add a Next.js `/api/v1` facade, a global state library, or direct page-level fetch calls.

## Sources

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Turborepo repository structure](https://v2-8-0.turborepo.dev/docs/crafting-your-repository/structuring-a-repository)
- [Strapi 5 documentation](https://docs.strapi.io/)
- [Keycloak OIDC layers](https://www.keycloak.org/securing-apps/oidc-layers)
