# Phase 6 Multi-Source Coverage Audit

Every in-scope item from the ROADMAP goal, APP-06, Phase 6 research, locked context, and approved UI contract is covered. CONTEXT decisions are unnumbered in the source, so stable audit-local `C-*` labels are used without inventing `D-NN` identifiers.

| SOURCE | ID | Feature / requirement | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Production-quality CSRM Next.js application foundation | 06-01..09 | COVERED | Audited workspace, runnable tracer, boundaries, shell, and evidence. |
| GOAL | — | Reusable BProton-aligned design system | 06-05, 06-06 | COVERED | Exact approved tokens/primitives and reusable states. |
| GOAL | — | Responsive application shell | 06-07..09 | COVERED | Server shell, bounded client islands, and viewport evidence. |
| GOAL | — | Centralized capability model | 06-04, 06-07, 06-08 | COVERED | Exact Function IDs, route preflight, and safe interaction consumption. |
| GOAL | — | Typed Strapi API boundary | 06-03 | COVERED | Full generated contract plus one service tracer. |
| GOAL | — | Automated test infrastructure | 06-02, 06-03, 06-05..09 | COVERED | Runtime probe, Vitest, Testing Library, MSW, Playwright. |
| REQ | APP-06 | IdamBox Cyber Risk Manager can be added as a Next.js module | 06-01..09 | COVERED | Requirement appears in every plan frontmatter. |
| RESEARCH | R-01 | Next App Router/React/Tailwind/shadcn workspace on port 3001 | 06-01, 06-02 | COVERED | Audited exact dependencies/config followed by runnable root Turbo tracer. |
| RESEARCH | R-02 | Mandatory SUS/ASSUMED package legitimacy review | 06-01-01 | COVERED | Blocking-human gate precedes installation. |
| RESEARCH | R-03 | Server Components by default; narrow client boundaries | 06-02, 06-07, 06-08 | COVERED | Layout/shell server-first; interaction islands are separately bounded. |
| RESEARCH | R-04 | Generated transport, handwritten focused services | 06-03 | COVERED | All 103 types; only `listApplications` runtime adapter. |
| RESEARCH | R-05 | Server-only configurable Strapi base URL/prefix | 06-03-01 | COVERED | Full URL contains configurable prefix; production required. |
| RESEARCH | R-06 | Commit generated OpenAPI output and verify drift | 06-03-02 | COVERED | Non-mutating temp regeneration comparison. |
| RESEARCH | R-07 | Safe discriminated service results | 06-03-01, 06-03-03 | COVERED | HTTP/network/timeout/malformed/configuration cases. |
| RESEARCH | R-08 | MSW owns mock HTTP and blocks network escape | 06-03-01, 06-03-03, 06-09 | COVERED | Shared server, strict unhandled-request policy, browser origin abort. |
| RESEARCH | R-09 | Exact Function-ID registry and Requestor union elevation | 06-04 | COVERED | 23-ID parity plus both role grants. |
| RESEARCH | R-10 | Registry-owned plural display label, no catalogue mutation | 06-04-01 | COVERED | `Questionnaires` display mapping is reversible/presentational. |
| RESEARCH | R-11 | Fixtures compiled to non-production server boundary | 06-04-02, 06-08, 06-09 | COVERED | Selector/action/build tests prevent production activation. |
| RESEARCH | R-12 | Known unauthorized before data; planned/unknown unavailable | 06-04-03, 06-07-02, 06-09 | COVERED | Pure callback-count tests and test-only browser route. |
| RESEARCH | R-13 | Exact semantic token/design primitive contract | 06-05, 06-06 | COVERED | Contrast, typography, spacing, status/risk, primitives, and state composition. |
| RESEARCH | R-14 | Responsive/focus behavior requires browser evidence | 06-09 | COVERED | Six exact viewports, focus/geometry/screenshots. |
| CONTEXT | C-ARCH-01 | `apps/csrm/src` App Router with feature/domain/lib/config organisation | 06-01, 06-02 | COVERED | Workspace/config and first App Router source path established without empty workflow scaffolding. |
| CONTEXT | C-ARCH-02 | Server-first, small explicit Client Components | 06-02, 06-07, 06-08 | COVERED | Server layout/AppShell and separately bounded interaction islands. |
| CONTEXT | C-ARCH-03 | Server/URL/local state; no global state library | 06-02, 06-07, 06-08 | COVERED | No global provider/dependency. |
| CONTEXT | C-ARCH-04 | `@idambox/csrm`, root Turbo integration, independent port | 06-01, 06-02 | COVERED | Audited package plus runnable port-3001 Turbo path. |
| CONTEXT | C-UI-01 | Light-first restrained enterprise BProton styling | 06-05, 06-09 | COVERED | Exact visual contract plus human review. |
| CONTEXT | C-UI-02 | Semantic light/dark-ready tokens; no scattered raw brand colours | 06-05 | COVERED | CSS-only raw values and TSX scan. |
| CONTEXT | C-UI-03 | Collapsible domain-grouped desktop sidebar | 06-07..09 | COVERED | Server navigation plus collapse/tooltips and browser evidence. |
| CONTEXT | C-UI-04 | Compact mobile header and accessible drawer/reflow | 06-08, 06-09 | COVERED | Sheet, 44px targets, breakpoint/overflow evidence. |
| CONTEXT | C-UI-05 | Page heading/breadcrumb/account and capability navigation | 06-07, 06-08 | COVERED | Server hierarchy plus bounded account island; optional regions omitted. |
| CONTEXT | C-CAP-01 | Stable IDs from existing Function catalogue; no competing permission names | 06-04 | COVERED | Exact JSON parity. |
| CONTEXT | C-CAP-02 | Requestor birthright plus explicit Security Analyst elevation | 06-04 | COVERED | Deterministic union tests. |
| CONTEXT | C-CAP-03 | Requestor/Analyst selector only development/test | 06-04, 06-08, 06-09 | COVERED | Server-only action, isolated island, and production build gate. |
| CONTEXT | C-CAP-04 | Hide unavailable UI; forbidden direct state; backend authoritative | 06-04, 06-07, 06-09 | COVERED | Pre-request guard and explicit authority invariant. |
| CONTEXT | C-API-01 | Generate TypeScript from committed `specification.json` | 06-03 | COVERED | Entire 103-operation artifact. |
| CONTEXT | C-API-02 | Focused domain services above generated boundary | 06-03 | COVERED | `listApplications` tracer only. |
| CONTEXT | C-API-03 | MSW uses production HTTP contract | 06-03 | COVERED | Same base/path/client serialization. |
| CONTEXT | C-API-04 | Normalize failures into typed errors/results | 06-03 | COVERED | Safe discriminants and error cases. |
| CONTEXT | C-TEST-01 | Vitest/Testing Library/MSW/Playwright foundation | 06-03, 06-05..09 | COVERED | Unit/component/integration/browser layers. |
| UI | UI-COVERED-01 | loading | 06-06-01, 06-07-02, 06-09 | COVERED | Stable shell/list geometry and one status announcement. |
| UI | UI-COVERED-02 | error | 06-03-03, 06-06-01, 06-09 | COVERED | Safe copy/retry/no raw transport. |
| UI | UI-COVERED-03 | empty | 06-06-01, 06-09 | COVERED | Exact neutral copy/no Phase 6 CTA. |
| UI | UI-COVERED-04 | populated | 06-06, 06-07 | COVERED | Authorized enabled children only. |
| UI | UI-COVERED-05 | partial | 06-06-02, 06-09 | COVERED | `Not provided` vs required-region error. |
| UI | UI-COVERED-06 | overflow | 06-05, 06-06, 06-08, 06-09 | COVERED | Independent navigation scroll/no horizontal page scroll. |
| UI | UI-COVERED-07 | zero-one-many | 06-06-02, 06-09 | COVERED | Zero EmptyState; one/many normal geometry. |
| UI | UI-BACKSTOP-01 | 🧪 backstop — long-text | 06-09-02 | COVERED | Structured marker preserved in plan and exact viewport evidence. |
| UI | UI-BACKSTOP-02 | 🧪 backstop — loading mobile controls | 06-09-02 | COVERED | Structured marker preserved in plan and 375/390 browser evidence. |

## Explicit exclusions (not gaps)

- Production Keycloak/OIDC and real effective-capability retrieval are assigned to Phase 13.
- Request, questionnaire, assessment, risk-register, administration, dashboard/reporting/alert workflows are assigned to Phases 7-12.
- Provider-independent AI services and AI workflow states are assigned to later workflow phases/Phase 13; Phase 6 therefore intentionally has no AI-SPEC.md.
- Customer-specific branding controls beyond dark-ready tokens remain future product work.
- No ORM/schema push or backend schema modification belongs to this phase.

## Audit result

No source item is missing, silently reduced, or moved into Phase 6 from the deferred set.
