# Phase 6 Human Approval Record

This durable record consolidates the two blocking human checkpoints completed during Phase 6 execution on 2026-08-09. It records decisions made before the corresponding gated work continued; it does not infer approval from implementation results.

## Dependency provenance approval

Before installation, live npm registry metadata was reviewed for every proposed direct package: current version, maintainers/publisher, canonical repository where supplied, `dist.integrity`, deprecation, and `scripts.postinstall`. The user first approved a compatibility-corrected set, then explicitly approved the two additional compatibility pins revealed by executable lint checks.

| Direct package(s) | Approved exact version(s) | Publisher / repository review | Integrity | Postinstall / disposition |
|---|---:|---|---|---|
| `next`, `eslint-config-next` | 16.3.0, 16.3.0 | Vercel; `vercel/next.js` | confirmed | none; approved |
| `react`, `react-dom` | 19.2.8, 19.2.8 | Meta React; `facebook/react` | confirmed | none; approved |
| `server-only` | 0.0.1 | Sebastian Markbåge; registry supplied no repository, accepted as the Next-prescribed server-boundary marker | confirmed | none; approved with missing-repository note |
| `lucide-react` | 1.30.0 | Lucide; `lucide-icons/lucide` | confirmed | none; approved |
| `class-variance-authority` | 0.7.1 | Joe Bell; `joe-bell/cva` | confirmed | none; approved |
| `clsx` | 2.1.1 | Luke Edwards; `lukeed/clsx` | confirmed | none; approved |
| `tailwind-merge` | 3.6.0 | dcastil; `dcastil/tailwind-merge` | confirmed | none; approved |
| `tw-animate-css` | 1.4.0 | Wombosvideo; `Wombosvideo/tw-animate-css` | confirmed | none; approved |
| `@radix-ui/react-avatar`, `react-collapsible`, `react-dialog`, `react-dropdown-menu`, `react-separator`, `react-slot`, `react-tooltip` | 1.2.6, 1.1.20, 1.1.23, 2.1.24, 1.1.15, 1.3.3, 1.2.16 | Radix/WorkOS; `radix-ui/primitives` | confirmed for each | none; approved |
| `shadcn` | 4.16.2 | shadcn/Vercel; `shadcn-ui/ui` | confirmed | none; CLI restricted to UI-SPEC-approved components |
| `typescript` | 5.9.2 | Microsoft; `microsoft/TypeScript` | confirmed | none; approved after replacing incompatible 7.0.2 |
| `@types/node`, `@types/react`, `@types/react-dom` | 26.2.0, 19.2.18, 19.2.4 | Microsoft DefinitelyTyped publisher; `DefinitelyTyped/DefinitelyTyped` | confirmed for each | none; approved |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3, 4.3.3 | Tailwind Labs; `tailwindlabs/tailwindcss` | confirmed for each | none; approved |
| `postcss` | 8.5.26 | Andrey Sitnik; `postcss/postcss` | confirmed | none; approved |
| `eslint` | 9.39.2 | OpenJS Foundation/ESLint; `eslint/eslint` | confirmed | none; approved after replacing incompatible 10.8.1 |
| `openapi-typescript` | 7.13.0 | openapi-ts maintainers; `openapi-ts/openapi-typescript` | confirmed | none; approved |
| `msw` | 2.15.0 | Artem Zakharchenko; `mswjs/msw` | confirmed | reviewed script only runs MSW init when `msw.workerDirectory` exists; approved |
| `vitest` | 4.1.10 | Vitest/Vite maintainers; `vitest-dev/vitest` | confirmed | none; approved |
| `vite`, `@vitejs/plugin-react` | 8.2.1, 6.0.5 | Vite maintainers; `vitejs/vite`, `vitejs/vite-plugin-react` | confirmed for each | none; direct Vite pin added for peer compatibility |
| `jsdom` | 29.1.1 | jsdom maintainers; `jsdom/jsdom` | confirmed | none; pinned below 30 for Node 22.19 compatibility |
| `@testing-library/dom`, `react`, `jest-dom`, `user-event` | 10.4.1, 16.3.2, 7.0.0, 14.6.3 | Testing Library maintainers; canonical Testing Library repositories | confirmed for each | none; direct DOM pin added for peer compatibility |
| `@playwright/test` | 1.62.1 | Microsoft Playwright maintainers; `microsoft/playwright` | confirmed | none; approved |

Approval sequence:

1. The user selected option 1 to approve the corrected set with `jsdom@29.1.1`, direct `vite@8.2.1`, and direct `@testing-library/dom@10.4.1` before installation.
2. After executable compatibility detection, the user selected option 1 to replace TypeScript 7.0.2 with `typescript@5.9.2`.
3. After executable lint compatibility detection, the user selected option 1 to replace ESLint 10.8.1 with `eslint@9.39.2`.

The final installed direct set is the reviewed exact set in `apps/csrm/package.json` and `yarn.lock`. No later dependency-version changes were permitted.

## Visual/product approval

After the complete automated gate passed, the user reviewed the Phase 6 checkpoint and selected option 1 to approve the visual evidence and complete Phase 6. The approval covered the light-first restrained BProton/IdamBox hierarchy, navigation and focus clarity, responsive layout, readable state copy, and absence of obvious overflow across these committed images:

- `apps/csrm/e2e/snapshots/shell-requestor-desktop.png`
- `apps/csrm/e2e/snapshots/shell-analyst-desktop.png`
- `apps/csrm/e2e/snapshots/shell-sidebar-collapsed.png`
- `apps/csrm/e2e/snapshots/shell-requestor-mobile.png`
- `apps/csrm/e2e/snapshots/shell-small-mobile.png`
- `apps/csrm/e2e/snapshots/shell-mobile-430.png`
- `apps/csrm/e2e/snapshots/shell-tablet.png`
- `apps/csrm/e2e/snapshots/shell-states.png`

At approval time the automated checkpoint was green: 5 Playwright tests, 48 unit tests, 103-operation OpenAPI drift verification, production build, clean production fixture-label scan, and HTTP 404 responses for both test-evidence routes. Subsequent code-review fixes expanded Playwright to 6 passing tests and strengthened the emitted server/client asset scan without invalidating the approved visual baselines.
