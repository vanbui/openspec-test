---
phase: quick
plan: 260828-gvj
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/(app)/layout.tsx
  - apps/web/app/actions/session.ts
  - apps/web/app/globals.css
  - apps/web/app/sign-in/page.tsx
  - apps/web/app/sign-in/server-actions.ts
  - apps/web/src/components/shell/app-shell.tsx
  - apps/web/src/components/shell/capability-navigation.tsx
  - apps/web/src/components/shell/mobile-navigation.test.tsx
  - apps/web/src/components/ui/primitives.tsx
  - apps/web/src/features/shell/shell-service.ts
  - apps/web/src/lib/auth/development-session-adapter.ts
  - apps/web/src/lib/auth/session-adapter.ts
  - apps/web/src/lib/boundaries/alignment.test.ts
  - apps/web/src/lib/capabilities/server-guard.ts
autonomous: true
requirements:
  - QUICK-GVJ
estimate:
  tokens: 42000
  raw_tokens: 42000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - The development role cookie and selector are usable only when the runtime is explicitly a development build; production remains fail-closed until a real Keycloak adapter is implemented.
    - FormData roles, role cookies, runtime mode, return paths, and the current shell-service response are runtime-validated at their server boundaries.
    - Protected shell access performs a reusable server-side capability check while clearly retaining Strapi as the production FunctionAPI and record-level authorization authority.
    - The application shell is a Server Component except for pathname-aware navigation and modal interaction, and active navigation follows the actual route.
    - Mobile navigation uses locally owned Radix/CVA-based Button and Sheet primitives with modal focus, Escape, backdrop, close-button, route-selection, and focus-restoration behavior.
    - Shell presentation uses semantic tokens/classes without feature-level brand colors or inline layout styling.
    - Focused boundary and component tests pass without creating the comprehensive browser/CI harness owned by Phase 01-05.
  artifacts:
    - apps/web/src/lib/auth/session-adapter.ts provides the production-neutral session contract and shared development-role/runtime parsers.
    - apps/web/src/lib/auth/development-session-adapter.ts provides the development adapter plus fail-closed runtime selection, without a simulated Keycloak implementation.
    - apps/web/src/lib/capabilities/server-guard.ts provides reusable server route capability-denial semantics.
    - apps/web/src/components/ui/primitives.tsx provides the locally owned Radix/CVA Button and Sheet layer.
    - apps/web/src/lib/boundaries/alignment.test.ts covers server-boundary behavior without taking ownership of Phase 01-05's test harness files.
    - apps/web/src/components/shell/mobile-navigation.test.tsx covers the focused modal navigation behavior.
  key_links:
    - apps/web/app/(app)/layout.tsx resolves the active SessionAdapter and applies the server capability guard before rendering AppShell.
    - apps/web/app/actions/session.ts and apps/web/app/sign-in/server-actions.ts both consume the shared development-role parser before any cookie mutation.
    - apps/web/src/features/shell/shell-service.ts validates unknown transport data before mapping it into ShellApplication models.
    - apps/web/src/components/shell/capability-navigation.tsx derives active-route state from usePathname and composes the local Sheet primitives.
---

<objective>
Align the existing `apps/web` foundation with the agreed engineering rules without absorbing the remaining Phase 1 transport, Strapi authorization, or comprehensive test/CI deliverables.

Purpose: Make the current development auth seam fail closed, validate server boundaries, establish reusable route-capability semantics, and turn the shell into an accessible semantic-token-based Server Component composition before Phase 1 execution resumes.
Output: Hardened auth/capability/service seams, a small Radix/CVA shadcn-style primitive layer, a pathname-correct accessible mobile sheet, and focused tests that coexist with Plans 01-03, 01-04, and 01-05.
</objective>

<execution_context>
@gsd-core/workflows/execute-plan.md
@gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md
@.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-PATTERNS.md
@.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md
@.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-03-PLAN.md
@.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-04-PLAN.md
@.planning/phases/01-monorepo-foundation-and-secure-application-shell/01-05-PLAN.md
@apps/web/package.json
@apps/web/src/lib/auth/session-adapter.ts
@apps/web/src/lib/auth/development-session-adapter.ts
@apps/web/src/features/shell/shell-service.ts
@apps/web/src/components/shell/app-shell.tsx
@apps/web/app/globals.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make the development session boundary explicit and fail-closed</name>
  <files>apps/web/src/lib/auth/session-adapter.ts, apps/web/src/lib/auth/development-session-adapter.ts, apps/web/app/actions/session.ts, apps/web/app/sign-in/server-actions.ts, apps/web/app/sign-in/page.tsx</files>
  <read_first>AGENTS.md; .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md (D-05 through D-08); .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-PATTERNS.md (Session and capability adapters); apps/web/src/lib/auth/session-adapter.ts; apps/web/src/lib/auth/development-session-adapter.ts; apps/web/src/lib/auth/return-to.ts; apps/web/app/actions/session.ts; apps/web/app/sign-in/server-actions.ts; apps/web/app/sign-in/page.tsx</read_first>
  <action>Refactor the session contract so protected code consumes a runtime-selected `SessionAdapter` rather than the exported development singleton. Keep the Phase 1 role-switching adapter centralized per D-05/D-07 and its HTTP-only, SameSite cookie behavior per D-06, but add pure shared parsers for the finite development role and runtime mode. Select the development adapter only when `NODE_ENV` is exactly `development`; every other runtime selects an explicitly unavailable adapter whose session and sign-in methods fail closed with a configuration-safe error. Do not create a Keycloak fixture, callback, token, or adapter that implies production authentication exists. Make the cookie reader use non-throwing shared role validation, and make both server actions use the throwing shared parser on raw `FormDataEntryValue` before calling a development-only mutation method that re-checks runtime eligibility. Keep `validatedReturnTo` as the single internal-relative-path validator per D-08. Make the `/sign-in` fixture route return Next.js `notFound()` outside development so the role selector is not exposed as a production path. Use readable strict TypeScript with named functions and domain-neutral session fields; do not place parsing or environment decisions in JSX.</action>
  <verify>
    <automated>pnpm --filter @csrm/web typecheck &amp;&amp; node -e 'const fs=require("node:fs"); const files=["apps/web/app/actions/session.ts","apps/web/app/sign-in/server-actions.ts","apps/web/app/sign-in/page.tsx"]; for(const file of files){const text=fs.readFileSync(file,"utf8"); if(!text.includes("development")) throw new Error("Expected development boundary in "+file)}' &amp;&amp; git diff --check -- apps/web/src/lib/auth apps/web/app/actions/session.ts apps/web/app/sign-in</automated>
  </verify>
  <acceptance_criteria>
    - The SessionAdapter seam is selected by a finite runtime-mode parser and has no production implementation masquerading as Keycloak.
    - `NODE_ENV=production` and `NODE_ENV=test` cannot read or write the development role session or redirect into the fixture sign-in flow.
    - Cookie and FormData role values share one finite parser; invalid cookie values produce no session and invalid submitted roles are rejected.
    - The role cookie remains HTTP-only and SameSite=Lax, and return paths still reject external, protocol-relative, and backslash paths.
    - The fixture sign-in page is reachable only in a development build.
  </acceptance_criteria>
  <done>The development role selector is still usable for local Phase 1 work but cannot become a production authentication path, and the auth seam remains ready for a real later Keycloak adapter.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Validate server trust boundaries and add route capability semantics</name>
  <files>apps/web/src/lib/capabilities/server-guard.ts, apps/web/src/features/shell/shell-service.ts, apps/web/src/lib/boundaries/alignment.test.ts, apps/web/app/globals.css</files>
  <read_first>AGENTS.md; .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-CONTEXT.md (D-05 through D-11 and D-14); .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-04-PLAN.md; .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-05-PLAN.md; apps/web/src/lib/capabilities/capability-adapter.ts; apps/web/src/features/shell/shell-service.ts; apps/web/src/lib/api/transport/server-client.ts; apps/web/app/globals.css</read_first>
  <behavior>
    - Runtime mode `development` selects the fixture adapter only for a development build; production, test, missing, and unknown values resolve to the unavailable state.
    - Requestor and Security Analyst are accepted at cookie/FormData boundaries; all other values are rejected or treated as no session as appropriate.
    - Safe internal return paths survive unchanged; absolute, protocol-relative, and backslash paths fall back to `/app`.
    - `requireCapability` succeeds for a granted capability and throws a typed, non-record-disclosing denial for a missing capability.
    - A valid `/applications` payload maps to `ShellApplication[]`; missing `data`, non-array `data`, invalid IDs, or invalid names normalize to the existing redacted transport error rather than entering the UI model.
  </behavior>
  <action>Write `alignment.test.ts` first so the behaviors above fail against the incomplete boundaries, using Vitest's module mocking only where needed to isolate `server-only` and the transport client. Then add a `server-only` `requireCapability` guard that accepts a capability and a granted set, throws a typed denial without record identifiers, and is explicitly documented as web-route defense in depth rather than Strapi FunctionAPI or record-level authorization. Add a small zero-dependency runtime parser in `shell-service.ts` for the current `/applications` response before D-14 domain mapping; treat transport data as unknown at runtime, retain the existing redacted error contract, and do not modify generated types, client construction, endpoint ownership, or contract-gap documentation belonging to Plan 01-04. In `globals.css`, add semantic overlay and shell-footer tokens/classes required by the following UI task and replace the raw mobile-overlay color with the semantic token per D-09/D-11 while preserving current responsive behavior. This quick task must not add dependencies, package scripts, Vitest/Playwright configuration, Turbo tasks, CI files, API generation changes, or Strapi authorization tests owned by Plans 01-03 through 01-05.</action>
  <verify>
    <automated>pnpm --filter @csrm/web exec vitest run src/lib/boundaries/alignment.test.ts &amp;&amp; pnpm --filter @csrm/web typecheck &amp;&amp; git diff --check -- apps/web/src/lib/capabilities/server-guard.ts apps/web/src/features/shell/shell-service.ts apps/web/src/lib/boundaries/alignment.test.ts apps/web/app/globals.css</automated>
  </verify>
  <acceptance_criteria>
    - Focused tests prove runtime/session/returnTo input handling, capability denial, and shell-response validation.
    - The reusable server guard denies absent capabilities without claiming to replace Strapi authorization.
    - Malformed external application data cannot be mapped into a ShellApplication model or expose raw errors.
    - API generation, server-client construction, Strapi policies/tests, comprehensive test configuration, Turbo, and CI remain untouched.
    - Mobile overlay and shell footer presentation are represented by semantic CSS tokens/classes.
  </acceptance_criteria>
  <done>Current server trust boundaries have executable runtime checks and focused tests while Phase 01-03/01-04/01-05 retain their planned deliverables.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Convert the shell to a pathname-aware accessible Sheet composition</name>
  <files>apps/web/app/(app)/layout.tsx, apps/web/src/components/ui/primitives.tsx, apps/web/src/components/shell/app-shell.tsx, apps/web/src/components/shell/capability-navigation.tsx, apps/web/src/components/shell/mobile-navigation.test.tsx</files>
  <read_first>AGENTS.md; .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-UI-SPEC.md (Design System, responsive interaction contract, accessibility contract); .planning/phases/01-monorepo-foundation-and-secure-application-shell/01-PATTERNS.md (App Router shell pattern); apps/web/app/(app)/layout.tsx; apps/web/src/components/shell/app-shell.tsx; apps/web/src/components/shell/capability-navigation.tsx; apps/web/src/components/shell/role-switcher.tsx; apps/web/src/components/shell/wordmark.tsx; apps/web/app/globals.css</read_first>
  <behavior>
    - Protected layout resolves the active SessionAdapter, requests its effective fixture capabilities, and applies `requireCapability('assessment-request:read', granted)` before rendering the workspace shell; denial renders PermissionDeniedState and never calls Strapi.
    - AppShell has no Client Component directive; only pathname navigation, Sheet state, and existing development role switching remain client-side.
    - The active navigation link follows mocked `usePathname()` for nested routes rather than a layout-provided constant.
    - The mobile menu opens a labelled modal Sheet, initially focuses its close control, closes on Escape/backdrop/close/route selection, and restores focus to the trigger.
  </behavior>
  <action>Write the focused `mobile-navigation.test.tsx` first for current-path selection and modal interaction. Create one locally owned `src/components/ui/primitives.tsx` module containing a CVA-based Button and Radix Dialog-based Sheet surface using the already installed `class-variance-authority`, `clsx`/`tailwind-merge`, and `@radix-ui/react-dialog`; keep variants semantic-token/class based and do not add a registry or dependency. Refactor `AppShell` into a Server Component that renders desktop structure and delegates only mobile Sheet state/pathname behavior to the client `capability-navigation.tsx` module. Use `usePathname()` inside capability navigation, close the Sheet when a route is chosen, keep visible labels and decorative Lucide icons, and rely on Radix for focus trapping, Escape, backdrop handling, scroll locking, and focus restoration. Replace the inline `marginTop` with the semantic shell-footer class from Task 2. Update the protected layout to obtain the selected adapter, fail closed when no production adapter exists, derive granted capabilities, apply the server guard and render PermissionDeniedState on typed denial, then pass only the presentation model to AppShell; remove the hard-coded pathname prop. Render the development role switcher only when a development role exists. Keep navigation filtering as presentation, never pass the development role to the Strapi service, and do not add a frontend API route.</action>
  <verify>
    <automated>pnpm --filter @csrm/web exec vitest run src/components/shell/mobile-navigation.test.tsx --environment jsdom &amp;&amp; pnpm --filter @csrm/web typecheck &amp;&amp; pnpm --filter @csrm/web build &amp;&amp; git diff --check -- apps/web</automated>
  </verify>
  <acceptance_criteria>
    - AppShell is server-rendered, with client code limited to path-aware navigation, the Sheet, and the existing development role form.
    - The protected layout uses the selected session adapter and a server capability guard, while its denied state says and behaves as presentation-layer denial rather than backend authorization.
    - Active navigation reflects the actual nested route and does not accept a pathname prop from the protected layout.
    - The mobile Sheet satisfies labelled-dialog, focus, Escape, backdrop, close-control, route-selection, and focus-restoration behavior in focused component tests.
    - Button/Sheet primitives live under `src/components/ui`, use already installed Radix/CVA utilities, and consume semantic theme classes/tokens.
    - No inline presentation style or component-level brand color is introduced.
  </acceptance_criteria>
  <done>The shell is a responsive, accessible Server Component composition with narrow client islands and route-correct navigation, verified without taking ownership of Phase 01-05's browser/CI suite.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser FormData/cookie -> development session adapter | Untrusted role values could attempt to mint a privileged UI fixture session. |
| Runtime environment -> session adapter selector | Deployment configuration determines whether the development-only adapter can exist. |
| Protected route -> capability presentation model | A caller can request a hidden route directly; navigation filtering alone is insufficient. |
| Strapi transport response -> shell domain model | Typed compile-time data is still untrusted at runtime and may be malformed. |
| Mobile trigger -> modal navigation Sheet | Focus and background interaction must remain constrained while navigation is open. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-GVJ-01 | Spoofing / Elevation of Privilege | development role cookie and actions | high | mitigate | Share a finite role parser, re-check runtime eligibility at mutation time, and make every non-development runtime select an unavailable adapter. |
| T-GVJ-02 | Spoofing | fixture sign-in route | high | mitigate | Return not-found outside development and provide no simulated Keycloak implementation. |
| T-GVJ-03 | Elevation of Privilege | direct protected-route access | high | mitigate | Apply a reusable server capability guard and render a non-disclosing permission state; retain Strapi as authoritative for FunctionAPI and records. |
| T-GVJ-04 | Tampering | shell service response | medium | mitigate | Parse the unknown response shape and primitive fields before constructing ShellApplication models; normalize failures to redacted errors. |
| T-GVJ-05 | Information Disclosure | return paths and errors | medium | mitigate | Reuse internal-relative returnTo validation and emit configuration-safe/transport-safe errors without URLs, tokens, stack traces, or record IDs. |
| T-GVJ-06 | Denial of Service / Information Disclosure | modal navigation | low | mitigate | Use Radix Dialog semantics for focus containment, Escape/backdrop close, scroll lock, and trigger focus restoration, with focused component tests. |
</threat_model>

## Source Coverage Audit

| Source | Item | Status | Plan coverage |
|--------|------|--------|---------------|
| GOAL | QUICK-GVJ — Implement the agreed `apps/web` engineering-rule alignments while preserving Phase 1 ownership | COVERED | Tasks 1-3 harden server boundaries and refactor the shell without taking phase-owned transport/backend/CI scope. |
| GOAL | Development selector cannot become a production auth path; Keycloak is not pretended | COVERED | Task 1 adds fail-closed runtime adapter selection and hides the fixture sign-in route outside development. |
| GOAL | Shared runtime validation for FormData, cookie, environment, returnTo, and shell response | COVERED | Tasks 1-2 share finite role/runtime parsers, retain the shared returnTo validator, and parse the shell response before mapping. |
| GOAL | Reusable server capability guard with Strapi remaining authoritative | COVERED | Tasks 2-3 define, test, and wire the route guard while explicitly excluding FunctionAPI/record authorization claims. |
| GOAL | Small shadcn-style primitive layer and accessible mobile navigation | COVERED | Task 3 creates local Radix/CVA Button/Sheet primitives and focused modal tests. |
| GOAL | Narrow Client Component boundaries and remove hard-coded pathname | COVERED | Task 3 makes AppShell server-rendered and moves current-path/modal interaction into one client module. |
| GOAL | Semantic token/class styling and readable source | COVERED | Tasks 1-3 require named boundary functions, semantic overlay/footer styling, and removal of inline shell layout styling. |
| GOAL | Actual lint configuration/command only if feasible without Phase 01-05 conflict | EXCLUDED | No lint engine is installed; adding one would require unaudited package/lock/script changes and overlap the pending package/CI plan. Existing typecheck remains accurately named, and this quick task does not claim it as lint. |
| GOAL | Focused tests without duplicating comprehensive browser/CI harness | COVERED | Tasks 2-3 add two targeted test files and invoke Vitest directly without creating config, package scripts, Playwright, Turbo, or CI artifacts. |
| REQ | Phase 01-03 Strapi FunctionAPI and IDOR harness | EXCLUDED | Explicitly retained by Plan 01-03; no Strapi file is modified. |
| REQ | Phase 01-04 generated types, transport construction, drift scripts, and contract gaps | EXCLUDED | Explicitly retained by Plan 01-04; only the existing feature-service response boundary is aligned. |
| REQ | Phase 01-05 comprehensive unit/browser/a11y/CI harness | EXCLUDED | Explicitly retained by Plan 01-05; focused tests use direct finite commands and do not create its owned files. |
| RESEARCH | No quick-task research phase requested | EXCLUDED | The work uses installed dependencies and established Phase 1 patterns only. |
| CONTEXT | D-05/D-07 — centralized replaceable development session/capability seam | COVERED | Tasks 1 and 3 select and consume the adapter centrally. |
| CONTEXT | D-06 — HTTP-only secure-cookie production seam; no localStorage token | COVERED | Task 1 preserves server-only cookie handling and introduces no browser token storage. |
| CONTEXT | D-08 — validated internal return path | COVERED | Tasks 1-2 retain and test the shared returnTo validator without implementing Keycloak. |
| CONTEXT | D-09/D-10/D-11 — semantic-token, responsive, light-first shell | COVERED | Tasks 2-3 use semantic presentation classes/tokens and preserve responsive control sizing. |
| CONTEXT | D-14 — feature service maps validated transport data to UI models | COVERED | Task 2 validates then maps `/applications` data inside the existing shell feature-service seam. |

<verification>
- `pnpm --filter @csrm/web exec vitest run src/lib/boundaries/alignment.test.ts` passes the focused server-boundary checks.
- `pnpm --filter @csrm/web exec vitest run src/components/shell/mobile-navigation.test.tsx --environment jsdom` passes the focused route and modal checks.
- `pnpm --filter @csrm/web typecheck` passes under strict TypeScript.
- `pnpm --filter @csrm/web build` completes with the unavailable production session adapter remaining fail-closed.
- `git diff --check -- apps/web` reports no whitespace errors.
- `git diff --name-only` for the implementation contains no `apps/strapi`, generated OpenAPI, server-client, package/lock, Turbo, CI, Playwright, or Phase 01-05 harness files.
- The executor stages and commits only this quick task's plan-owned files; the user's existing `pnpm-workspace.yaml` modification remains unstaged and unchanged.
</verification>

<success_criteria>
- The development role selector cannot write/read a production session and the production path does not masquerade as Keycloak.
- Current untrusted server inputs and the shell-service response are validated before use.
- Direct shell access is capability-checked on the server, with Strapi still explicitly authoritative for API and record access.
- AppShell is server-rendered around narrow client islands, and navigation uses the actual pathname.
- Mobile navigation is an accessible Radix Sheet built from local CVA/token-based primitives.
- Focused tests, strict typecheck, and production build pass without absorbing Plans 01-03, 01-04, or 01-05.
- `pnpm-workspace.yaml` and all unrelated user changes are preserved exactly and excluded from quick-task commits.
</success_criteria>

<output>
After completion, create `.planning/quick/260828-gvj-implement-the-agreed-apps-web-engineerin/260828-gvj-SUMMARY.md` with `status: complete` in the frontmatter.
</output>
