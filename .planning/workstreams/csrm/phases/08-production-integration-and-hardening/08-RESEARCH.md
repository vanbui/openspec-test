# Phase 8: Production Integration and Hardening - Research

**Researched:** 2026-09-25
**Domain:** Next.js 16.3.3 production build under Playwright 1.58.2, Strapi 5.51.0 authorization and security middleware, OpenAPI contract fidelity, WCAG 2.2 AA verification, dependency hygiene
**Confidence:** HIGH for everything read from the repository and from installed `node_modules` source (cited `path:line`); MEDIUM for runtime estimates and for behaviour that could not be executed in this read-only session (marked `[ASSUMED]`)

<user_constraints>
## User Constraints (from 08-CONTEXT.md, verbatim)

### Locked Decisions

#### Scope guards

- **D-01:** INT-02 is deferred by operator decision. REQUIREMENTS keeps INT-02 unchecked with the deferral reason; the phase summary, VERIFICATION and STATE say "complete except INT-02". Nothing in this phase may add Keycloak code, configuration, packages or placeholders.
- **D-02:** No content-type schema change (`apps/strapi/src/api/*/content-types` is frozen). Policies, middlewares, controllers, services, routes and bootstrap code may change. If a follow-up needs a fact the datamodel does not hold, first use an existing relation or stored reference; otherwise stop and record the gap in `docs/contract-gaps/phase-08-*.md` instead of changing a schema.
- **D-03:** Every new or changed endpoint follows the established pattern: exact IdamBox Role → Function → FunctionAPI grants in both catalogue copies (byte-identical), record-level checks in Strapi, the operation published in `docs/references/specification.json`, the client regenerated with `api:check` clean, closed Zod parsers registered in the contract parity guard. Requestor is birthright, Security Analyst explicit, and the analyst service agent never inherits human-analyst grants.

#### INT-01 — contract fidelity

- **D-04:** A static, test-enforced inventory proves the whole chain for every operation the web service layer invokes: the call goes through the generated openapi-fetch client, the operation exists in `specification.json`, Strapi mounts it exactly once, and the catalogue grants it. The inventory also lists every catalogued-but-unserved operation with its reason (for example the five operations Phase 7 D-06 left unserved). The guard fails when a new call bypasses the contract or targets an unserved operation.
- **D-05:** Phase 7 finding IN-03 is resolved here. Where a client parser is stricter than the contract (trim, `min(1)`, `max(n)` not declared in the spec), either the contract declares the bound the server already guarantees (preferred), or the path is registered in the parity guard's `narrowedPaths` with its reason. Nothing stays invisible to the parity guard.
- **D-06:** The CSV import operations (criterion 1 names "including imports") are shown to be documented, served Strapi operations with no frontend facade; the inventory in D-04 covers them.

#### INT-03 — AI integration, re-verified hermetically

- **D-07:** INT-03 stays complete; Phase 8 re-verifies it without a live provider. The existing deterministic-provider and provider-adapter suites (provenance, job states, human modification, failure and retry taxonomy, no automatic release) are run and cited in VERIFICATION. No `CSRM_AI_*` setting is added or changed.
- **D-08:** The analyst request review's drafting copy becomes provider-neutral. "Deterministic draft assistance" and "Start deterministic draft assistance" misstate the source whenever a real provider is configured. The new copy describes the action and states that the output is advisory and reviewable; the source is named only where recorded provenance already names it. Exact strings are fixed in the UI-SPEC; tests that assert the old copy change deliberately.
- **D-09:** One shared Risk Type ordering rule is used by `parseAssessmentDraftProposal`, the deterministic provider and the OpenAI-compatible adapter, so a mixed-case Risk Type name can no longer fail the parser's order check. A unit test with mixed-case names proves it.

#### INT-04 — production build under test, and test-run hygiene

- **D-10:** The Playwright suite runs against a production Next build (`next build`, then `next start`) instead of `next dev`. The E2E Strapi stays `strapi develop` behind the development identity bridge, which is the only authentication available while INT-02 is deferred.
- **D-11:** A production build runs with `NODE_ENV=production`, where the web development session is unavailable today. It is enabled under a production build **only** inside the attested E2E runtime: `CSRM_ENVIRONMENT=development`, `CSRM_DEV_IDENTITY=true`, and a valid run attestation using the existing `CSRM_E2E_RUNTIME_ROOT` / `CSRM_E2E_RUNTIME_ATTESTATION_PATH` / `CSRM_E2E_RUNTIME_NONCE` pattern. Any missing or invalid gate leaves the session unavailable (fail closed). Unit tests prove each gate independently. A browser or integration proof shows a production build without the attestation refuses development sign-in. The `next dev` behaviour is unchanged. Strapi stays authoritative: its identity middleware still requires `NODE_ENV=development`, so a misconfigured web deployment still gets no identity from Strapi.
- **D-12:** A test run modifies no tracked file. Next rewrites `apps/web/tsconfig.json` and `apps/web/next-env.d.ts` for whatever dist directory it builds into; that is stopped at the source (for example by pointing the E2E build at an untracked tsconfig through Next's TypeScript configuration, or another mechanism the research confirms in the Next 16.3 docs), and the stale `.tmp/` include entries are then removed from `apps/web/tsconfig.json`. Proof: `git status --porcelain` is empty after a full E2E run, recorded in the phase gate.
- **D-13:** The `accessibility.spec.ts:47` scan that could start mid-navigation waits for a settled destination (destination URL, document title, a visible level-1 heading, and no visible loading state) before axe runs. It is proven by several consecutive isolated passes plus the full-suite run.

#### INT-04 — critical journeys at both widths

- **D-14:** Six critical journeys run at 1440px and at 375px: request create → submit; questionnaire complete → submit; assessment draft → review → release; Requestor read-only viewing of the released assessment; Risk Register filter → detail → mitigation edit; CSV import preview → commit. The mechanism (a mobile Playwright project scoped to the journey specs, or parametrised specs) is the planner's choice. Each journey asserts populated content at each width, not only an axe pass, and the full suite stays well inside the 30-minute harness ceiling.
- **D-15:** Journeys assert the shell after sign-in (the level-1 "Dashboard" heading and the role in the banner), never the URL.

#### INT-04 — IDOR and record-level authorization

- **D-16:** A spec-driven authorization matrix at the Strapi mounted-HTTP level states, for every served operation, the expected outcome for each actor: the owning Requestor (Jane), the Secondary Requestor (Maya), the human Security Analyst (Bob), the analyst service agent, and a request with no identity. Record-level rows cover another Requestor's request, questionnaire and assessment. The established conventions hold: an unauthorised assessment read answers 404; denial proves persistence is unchanged. A completeness guard fails when a served operation has no matrix row. Existing proofs are referenced or reused, not duplicated.
- **D-17:** Requestor-birthright behaviour is proven: the "My" operations are owner-scoped for every actor, including a Security Analyst; a Requestor holds birthright operations only; the service agent never holds a human-analyst grant.
- **D-18:** Browser-level IDOR: the Secondary Requestor's direct URLs to Jane's request, questionnaire and assessment render the not-found or permission state with no record data, at both widths (extends the Phase 06.9 two-Requestor fixture pattern).

#### INT-04 — security validation

- **D-19:** Every web response carries a documented security header set: a Content-Security-Policy compatible with Next 16 App Router (nonce- or hash-based scripts, no `unsafe-eval` in production, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`), `Strict-Transport-Security` in production, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, a restrictive `Permissions-Policy`, and `Cross-Origin-Opener-Policy: same-origin`; `X-Powered-By` is removed. The production-build E2E asserts the headers and that the journeys raise zero CSP violations.
- **D-20:** Strapi's security middleware configuration is reviewed and documented, and production-mode error responses carry the safe error envelope with no stack trace or internal message (integration proof or documented evidence).
- **D-21:** Input, output and error handling is validated and documented: closed Zod parsers at every trust boundary; no unsafe HTML rendering (each `dangerouslySetInnerHTML`, if any, justified or removed); every route segment has an error boundary; production builds show safe copy with no stack trace or internal message.
- **D-22:** No server-only value reaches the browser: a scan of the production build's client chunks finds no server environment names or values (for example `CSRM_API_TOKEN`), and the transport modules stay behind `server-only`.
- **D-23:** Dependency hygiene: `pnpm audit` (a registry advisory lookup only) for both workspaces; high and critical advisories are fixed where a compatible patched version exists; any accepted residual risk is recorded with its reason; no new runtime dependency is introduced without a concrete need.

#### INT-04 — performance

- **D-24:** Performance is measured on the production build and documented: per-route first-load JavaScript from the build output, and navigation timings for the key routes measured by Playwright against the seeded E2E database. Budgets are recorded and only real problems are fixed. No new performance tooling dependency.

#### INT-04 — accessibility

- **D-25:** WCAG 2.2 AA receives documented validation: axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) on every route for every actor at 375px and 1440px, extending `accessibility.spec.ts` to any route it does not yet cover, plus a conformance record for the criteria axe cannot decide: 2.4.11 Focus Not Obscured (sticky header), 2.5.3 Label in Name, 2.5.8 Target Size, 1.4.10 Reflow, 1.4.12 Text Spacing, 2.4.7 Focus Visible, 3.2.6 Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication, and keyboard operability of dialogs and sheets.
- **D-26:** The mobile navigation trigger meets 2.5.3 Label in Name: its accessible name is its visible label, "Menu", with its expanded state and controlled sheet still exposed. Tests that address it as "Open navigation" change deliberately (Phase 7 UI review finding 4).

#### Follow-ups carried forward (UI and correctness)

- **D-27:** Every status badge (request, questionnaire, assessment status, Risk treatment status and any other workflow status) uses the design direction §4 tinted status recipe with icon and text from one shared status-to-tone mapping. No status renders as a neutral outline chip.
- **D-28:** The Risk Register filter bar has a deliberate layout between the mobile sheet and the 1440px row: at 1024px the search input keeps a usable width and its label stays on one line. At 1440px the statement column wraps or clamps, so long statements no longer push most columns into horizontal scroll.
- **D-29:** Whenever a DataTable overflows its container, its scroll region is keyboard-focusable and labelled with the table's name, on every DataTable at every width, generalising the Risk Register's region. A visible scroll-edge cue marks hidden columns; its values are decided as a recorded CSRM extension in `docs/design/csrm-design-direction.md` (this also settles Phase 7 UI review finding 2, the risk-exposure cross-tab at 375px).
- **D-30:** Search inputs name the records they search (for example "Search assessment requests"); "Search collection" disappears.
- **D-31:** The analyst revision timeline names the acting analyst wherever the stored record already identifies them, resolved to a display name server-side; if the datamodel does not identify them, a contract-gap record says so and the wording stays neutral (D-02).
- **D-32:** The analyst questionnaire review renders each question exactly once.
- **D-33:** Printing an application page prints the content without the shell (sidebar, header, mobile navigation) and stays legible (Phase 7 UI review finding 3). Any value the direction document lacks is recorded there as a CSRM extension.

#### Process

- **D-34:** The UI-SPEC defers every value to `docs/design/csrm-design-direction.md`, as the 06.x and 07 specs do. It fixes copy, states and layout behaviour for D-08, D-26 to D-30, D-32 and D-33.
- **D-35:** Plans are fine-grained and serialised when they touch the same files or run Playwright. Dev servers are stopped for any plan that edits Strapi or runs Playwright. The phase gate is the full five-command gate with the production-build E2E, followed by a clean `git status`.

### Planner's Discretion

Left to research and planning, within the decisions above: the mechanism for D-12 (confirmed against the Next 16.3 docs), the D-14 structure (project or parametrisation), the CSP mechanism for D-19 (proxy-issued nonce or static policy, whichever Next 16.3 supports without breaking streaming), the matrix layout for D-16, and the measurement method for D-24.

### Deferred Ideas (OUT OF SCOPE)

- **INT-02 Keycloak** authorization-code authentication and Strapi token validation: deferred by operator decision; revisit when the operator provides a Keycloak environment.
- Report export, alert acknowledgement and notifications (Phase 7 D-06; NOTIFY-01 is v2).
- A closed bucket in the assessment status summary: nothing closes an assessment yet.
- Post-release treatment tracking (Phase 7 D-27 contract gap).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md, 2026-09-25) | Research Support |
|----|-------------|------------------|
| INT-01 | The production web service implementation calls Strapi operations defined in the OpenAPI contract; missing operations are documented and added to the backend contract. | §F1: 76 distinct web-invoked operations, every one in the spec and mounted; four-way inventory (web → spec → mounted → catalogue) with the 32 catalogued-but-unserved and 25 mounted-but-uncatalogued operations enumerated; guard design; IN-03 bounds with server guarantees. |
| INT-02 | Keycloak authorization-code authentication … | **Deferred by operator decision (D-01).** Not researched beyond noting: Keycloak stays disabled, the Strapi identity middleware stays `NODE_ENV=development`-gated (`apps/strapi/src/utils/development-identity-enabled.ts:1-7`), and the commented `registerIdamboxUserProvisioning` import in `apps/strapi/src/index.ts:12,17` must stay commented. |
| INT-03 | AI integrations preserve provenance, review state, human modifications, safe failure/retry behaviour, and never release an assessment automatically. (Complete; re-verify hermetically.) | §F8: the hermetic suites by file:line, the deterministic-provider pins, the D-08 copy sites, the D-09 ordering mismatch and its fix. |
| INT-04 | Critical journeys, responsive behaviour, WCAG 2.2 AA concerns, security controls, performance, and IDOR protection are verified. | §F2 (production-build E2E, clean tree), §F3 (headers, CSP, Strapi security, error handling, client-chunk scan), §F4 (IDOR matrix), §F5 (six journeys at both widths), §F6 (accessibility), §F7 (performance, dependency hygiene), §F9 (UI follow-ups). |
</phase_requirements>

## Summary

Phase 8 is a hardening and proof phase over code that already exists. Almost every decision has an existing pattern to extend rather than a new subsystem to build. The four expensive facts this research settles are: (1) **Next 16.3.3 rewrites `tsconfig.json` and `next-env.d.ts` from two functions whose behaviour is now read from source**: `writeConfigurationDefaults` bails out entirely when the configured tsconfig has an `extends` key, and `writeAppTypeDeclarations` rewrites `next-env.d.ts` whenever the dist directory changes, so the D-12 mechanism is `typescript.tsconfigPath` pointing at a tracked `tsconfig.e2e.json` that `extends` the base, plus untracking `next-env.d.ts` exactly as the Next docs instruct and generating it with `next typegen` before `tsc`. (2) **A production build cannot sign in today**: `parseSessionRuntimeMode` (`apps/web/src/lib/auth/session-adapter.ts:38-40`), the sign-in page (`apps/web/app/sign-in/page.tsx:15-17`) and the transport identity/token gates (`apps/web/src/lib/api/transport/server-client.ts:50-65`) all key on `NODE_ENV === 'development'`; Playwright's `url` readiness accepts only status 200–403 (`playwright-core/lib/server/utils/network.js:195`), so without the D-11 gate the production webServer times out rather than failing loudly. The attestation check to reuse is `isAttestedE2eRuntime` (`apps/web/src/lib/testing/e2e-ui-state.ts:33-55`), minus its UI-state-harness flag. (3) **The web calls 76 distinct operations and every one is in the spec, mounted exactly once and catalogued — except `GET /applications`**, an uncatalogued Strapi core route reached by a shell service nothing renders. The same inventory shows five IAM/application core routers mounted with all five CRUD routes and no CSRM policy, reachable by any holder of the web's full-access API token (`@strapi/admin …/strategies/content-api-token.js:73-76`); the existing proof covers only the token-less case. (4) **Nonce-based CSP through `proxy.ts` is the supported Next 16 mechanism**; every application route is already dynamic (`force-dynamic` at `apps/web/app/(app)/layout.tsx:6`), Next applies the nonce to its own inline scripts, but `sonner` injects a `<style>` element at module load (`sonner/dist/index.mjs:5-8`), so `style-src` needs `'unsafe-inline'` as a recorded residual while `script-src` stays strict.

The six critical journeys already exist as specs, but two of them (questionnaire complete → submit and assessment draft → review → release) mutate one-shot seed fixtures and cannot run twice against one database, which constrains the D-14 mechanism: a mobile Playwright project fits the four re-runnable journeys (with the CSV import suffix made project-specific), and the two one-shot journeys need in-spec width checkpoints or self-seeding. The IDOR matrix has every building block in `apps/strapi/tests/helpers/strapi-http-harness.ts` (six identities, `omitApiToken`, persistence getters), and one gap worth closing first: `tests/authorization.policy.test.js`, which holds the birthright unit proofs, never runs (07-VALIDATION recorded the glob mismatch). The follow-ups have concrete root causes: the Risk Register statement column cannot wrap because `TableCell` sets `whitespace-nowrap` (`apps/web/src/components/ui/table.tsx:86`); the analyst questionnaire review renders the governance editor's question list and the read-only renderer on the same page (`apps/web/src/features/questionnaires/questionnaire-review.tsx:69`); the governance log stores the acting analyst's documentId and the projection deliberately leaves `displayName` null (`apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts:280-289`), so D-31 is a server-side lookup, not a datamodel gap.

**Primary recommendation:** Land the production-build E2E and clean-tree work first (it is the vehicle for the headers, CSP, journeys, performance and clean-status proofs), then the contract inventory and IDOR matrix (both Strapi, dev servers stopped), then the UI follow-ups, then the browser proofs; serialise every plan that edits `playwright.config.ts`, `accessibility.spec.ts`, `assessment-release-workflow.spec.ts`, `risk-register.tsx` or `data-table.tsx`.

## Project Constraints (from AGENTS.md)

Directives extracted from `AGENTS.md` and `apps/web/AGENTS.md`; the planner verifies compliance against each.

| # | Directive | Where it bites in Phase 8 |
|---|-----------|---------------------------|
| C1 | Next.js App Router, strict TypeScript; read `apps/web/node_modules/next/dist/docs/` before writing Next code (Next 16.3 differs from training data). | D-10/D-12 (`typescript.tsconfigPath`, `next typegen`), D-19 (`proxy.ts`, not `middleware.ts`), error boundaries (`retry` prop). |
| C2 | Prefer Server Components; Client Components only when required. | New `global-error.tsx`/`not-found.tsx` are client boundaries by convention; the DataTable overflow observer stays in the existing client component. |
| C3 | shadcn/ui before custom primitives; semantic theme tokens only; never hard-code BProton brand colours in feature components. | D-27 tone mapping must use `Badge` variants / semantic classes (`apps/web/src/components/ui/badge.tsx:21-25`); D-29/D-33 values go into the direction document first. |
| C4 | All pages work at mobile and desktop widths. | D-14, D-25, D-28, D-29. |
| C5 | Business/domain logic must not live in JSX. | Status-to-tone mapping is a module-level table, not inline classes (today several files inline it; §F9). |
| C6 | Never call APIs directly from arbitrary UI components; use the typed API layer. No frontend API facade or raw fetch in page components. Strapi is the production API boundary. | D-04 guard must fail on any `fetch(` outside the transport and on any non-literal client path. |
| C7 | Validate external input with shared schemas. | D-05/D-21 closed Zod parsers; boundary mode for the parity guard. |
| C8 | Authorization enforced server-side; navigation visibility is not authorization; Requestors must not access another Requestor's restricted records. | D-16..D-18 matrix and browser IDOR. |
| C9 | AI output is advisory and cannot automatically release an assessment. | D-07 re-verification, D-08 copy. |
| C10 | Use JDL terminology; document contract/model gaps rather than inventing entities. | D-02/D-31 contract-gap record only if a fact is missing (it is not, §F9). |
| C11 | Add automated tests with every material workflow. | Validation Architecture below. |
| C12 | Do not introduce a dependency without a concrete reason. | D-23/D-24: no new packages; only version bumps and `pnpm-workspace.yaml` overrides. |
| C13 | Never commit secrets; never move `node_modules`; never merge the nested Strapi Git history. | `.env` files exist on this VM (`apps/web/.env.local`, `apps/strapi/.env`); never read or print them. |
| C14 | Keycloak stays disabled (task rule; D-01). | No Keycloak code, config, packages or placeholders. |
| C15 | Content-type schemas frozen (task rule; D-02). | D-31 resolves names by lookup; IAM route hardening changes routers, not schemas. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contract inventory guard (D-04) | Repository tests (Strapi `node:test` unit + web vitest) | Docs (`docs/references/*.json`) | Each workspace enumerates the side it owns; the checked-in inventory is the shared truth. |
| Development session under a production build (D-11) | Frontend Server (SSR: session adapter, sign-in page, transport) | API (Strapi identity middleware stays `NODE_ENV=development`-gated) | Trust is decided per request on the Next server; Strapi remains the authority that can refuse the identity. |
| Clean working tree after a run (D-12) | Build tooling (`next.config.ts`, tsconfig files, `.gitignore`, `package.json` scripts) | — | The rewrite happens inside Next's TypeScript setup; it is stopped by configuration, not by a post-run restore. |
| Security headers and CSP (D-19) | Frontend Server (`proxy.ts` for the per-request nonce; `next.config.ts` `headers()` for static headers) | Browser (violations observed by Playwright) | Headers are a response concern of the Next server; the browser is where CSP is enforced and observed. |
| Strapi security middleware and error envelope (D-20) | API (`apps/strapi/config/middlewares.ts`, `strapi::errors`) | Tests (mounted harness) | Koa middleware owns headers and the envelope. |
| IDOR matrix (D-16..D-18) | API tests (mounted HTTP harness) | Browser (Playwright, two-Requestor fixture) | Strapi is the authority; the browser proof shows the web never leaks what Strapi refuses. |
| Journeys at two widths (D-14) | Browser (Playwright projects/specs) | Frontend Server (`next start`) | Responsive behaviour is rendered in the browser. |
| Accessibility (D-13, D-25, D-26) | Browser (axe, keyboard, geometry) | Frontend (markup fixes) | axe runs in the page; conformance record is documentation. |
| Performance (D-24) | Browser (Playwright network accounting and navigation timing) | Build output (`next experimental-analyze --output`) | First-load JS is what the browser downloads; timings are measured in the browser. |
| Dependency hygiene (D-23) | Repository package manifests (`pnpm-workspace.yaml` overrides, `package.json`) | — | Version pins live in manifests. |
| Status tone mapping, DataTable region, filter layout, print (D-27..D-30, D-33) | Frontend components (`components/csrm`, `components/ui`, `globals.css`) | Docs (design direction extensions) | Presentation; values recorded in the direction document. |
| Timeline actor names (D-31) | API (`questionnaire-scope.ts` projection) | Frontend (fallback copy) | The documentId is stored server-side; the lookup belongs beside the projection. |
| Risk Type ordering rule (D-09) | API (`assessment-draft-provider.ts`) | — | The parser owns the rule both providers must satisfy. |

## Standard Stack

No new library is required for any decision. Every version below is the installed one (`apps/web/package.json`, `apps/strapi/package.json`, root `package.json`) unless marked as a proposed bump.

### Core

| Library | Version (installed) | Purpose in Phase 8 | Why standard |
|---------|---------|---------|--------------|
| next | 16.3.3 | Production build/start, `proxy.ts`, `headers()`, `typescript.tsconfigPath`, `next typegen`, `next experimental-analyze` | Already the app framework; all mechanisms are first-party [CITED: `apps/web/node_modules/next/dist/docs/`] |
| @playwright/test | 1.58.2 | webServer build+start, projects, headers/CSP/perf proofs | Already the E2E runner; `webServer.command` runs through a shell (`playwright/lib/plugins/webServerPlugin.js:86-95`) |
| @axe-core/playwright | 4.11.0 | WCAG 2.2 AA scans | Already used in `accessibility.spec.ts` |
| vitest | 4.0.18 → **4.1.x proposed** | Web unit guards; the critical advisory GHSA-5xrq-8626-4rwp is fixed at ≥4.1.0 | See §F7 |
| zod | ^4.4.3 | Closed parsers; parity guard | Existing |
| openapi-fetch / openapi-typescript | 0.17.0 / 7.13.0 | Typed client, `api:generate`/`api:check` | Existing |
| @strapi/strapi (+core, admin, utils) | 5.51.0 | Routers, policies, `strapi::security` (koa-helmet → helmet 6.2.0), `strapi::errors` | Existing |
| node:test | Node 24.19.0 | Strapi unit and mounted integration tests | Existing (`apps/strapi/package.json` `test`) |

### Supporting

| Tool | Version | Purpose | When to use |
|------|---------|---------|-------------|
| pnpm | 11.24.0 | `pnpm audit --json`, `pnpm-workspace.yaml` `overrides` | D-23 (an `overrides:` block already exists for `@types/react*`) |
| turbo | 2.8.16 → 2.9.14+ proposed | Root task runner; two moderate advisories | D-23 |
| git | — | `git status --porcelain` proof | D-12 |

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| `proxy.ts` nonce CSP | Static CSP in `next.config.ts` `headers()` with `'unsafe-inline'` scripts, or experimental `sri` hash CSP | Static needs `'unsafe-inline'` for Next's inline flight scripts (violates D-19's nonce/hash requirement); SRI is experimental, App-Router-only and "cannot handle dynamically generated scripts" [CITED: content-security-policy.md "Limitations of SRI"], and this app is fully dynamic anyway, so nonces cost nothing extra. |
| `next experimental-analyze --output` for first-load JS | Playwright network accounting on the production build | The analyze command is documented but its data files are not; browser accounting measures exactly what is downloaded and needs no extra run. Recommend accounting as primary, analyze as corroboration (§F7). |
| Untracking `next-env.d.ts` | Keeping it tracked and restoring after runs | Its content embeds the dist directory (`writeAppTypeDeclarations.js:52-56`), so even a plain `next build` flips it from `.next/dev/types` to `.next/types`; the Next docs say to gitignore it [CITED: 02-typescript.md "`next-env.d.ts`"]. Restoring after the fact contradicts D-12 ("stopped at the source"). |
| Playwright mobile project for all six journeys | In-spec width checkpoints | Two journeys are one-shot against seed fixtures (§F5); a second pass in a mobile project would fail unless they become self-seeding. |

**Installation:** none. Version bumps: `pnpm --filter @csrm/web add -D vitest@^4.1.11 @vitest/mocker@^4.1.11` (verify `@vitejs/plugin-react` 5.1.1 compatibility), root `pnpm add -D turbo@^2.9.14`, and `pnpm-workspace.yaml` overrides for `tar`, `js-yaml`, `nodemailer`, `sharp` (§F7).

## Package Legitimacy Audit

No new package is recommended. The version bumps below are for packages already in the lockfile; their registry versions were confirmed with `npm view <pkg> version` on 2026-09-25 [VERIFIED: npm registry]. slopcheck was not run (nothing new is installed); the planner gates each bump behind the full suites rather than a `checkpoint:human-verify`.

| Package | Registry | Installed | Latest (2026-09-25) | Proposed | Disposition |
|---------|----------|-----------|-----------|----------|-------------|
| vitest | npm | 4.0.18 (web dev) | 5.0.1 | ^4.1.11 (stay in major 4) | Approved: fixes critical GHSA-5xrq-8626-4rwp (≥4.1.0) and moderate GHSA-82fw-gwwq-j7x9 (≥4.1.11) |
| @vitest/mocker | npm | 4.0.18 | 5.0.1 | follows vitest | Approved |
| turbo | npm | 2.8.16 (root dev) | 2.11.4 | ^2.9.14 | Approved: two moderate advisories |
| tar | npm | 7.5.20 (transitive, Strapi) | 7.5.22 | override 7.5.22 | Approved: high GHSA-r292-9mhp-454m (≥7.5.21) |
| js-yaml | npm | 4.3.1 (transitive, openapi-typescript, dev) | 5.4.2 | override 4.3.2 (already in lockfile at line 5722) | Approved: high GHSA-2883-xcg3-v3hh (≥4.3.2); do not jump majors |
| nodemailer | npm | 9.0.1 (transitive, @strapi/provider-email-sendmail) | 10.0.10 | override ^9.1.1 | Approved: high GHSA-2x7j-588g-ccc2 (≥9.1.0) + moderates (≥9.1.1); stay in major 9 |
| sharp | npm | 0.34.5 (transitive, @strapi/upload) | 0.35.4 | override 0.35.4 (already resolved for another dependent, lockfile line 7425) | Approved with a boot check: native module; `pnpm-workspace.yaml` already `allowBuilds: sharp: true` |
| vite | npm | 5.4.21 (transitive, @strapi/strapi admin build) | 8.3.1 | none | **Residual**: patched ≥6.4.3 is a major behind Strapi 5.51's pin; the advisory concerns the Vite dev server (`server.fs.deny` on Windows), not production runtime |

**Packages removed due to slopcheck [SLOP] verdict:** none (nothing new).
**Packages flagged as suspicious [SUS]:** none.

## Findings by area

Every `path:line` below was read in this session at the working tree of `ec75b98` (the three uncommitted files are named where they matter).

### F1. INT-01 inventory (D-04, D-05, D-06)

#### F1.1 How the web invokes the generated client

- One transport: `createStrapiClient()` in `apps/web/src/lib/api/transport/server-client.ts:78-85` builds an `openapi-fetch` client typed by `paths` from `src/lib/api/generated/schema.d.ts`; it is `server-only` (line 1). Ten modules import it (nine services plus the transport itself); no `fetch(` exists anywhere in `apps/web/src` or `apps/web/app` outside `node_modules` (grep, 2026-09-25).
- Call sites are string literals except one: `report-service.ts:94-95` calls `client.GET(REPORT_PATH, …)` with a module-level constant. A regex over `client\.(GET|POST|PUT|PATCH|DELETE)\('…'` therefore under-counts by one; the guard must either require literals or resolve module-level `as const` path constants.
- Distinct operations per module (76 in total):

| Module | Distinct operations | Lines |
|--------|--------------------:|-------|
| `features/administration/administration-service.ts` | 24 (`/v1/{risk_types,controls,information_systems,information_assets}` list/get/create/update, `…/import/preview`, `…/import`) | 100-227 |
| `features/assessments/assessment-service.ts` | 24 (queue, draft job get/retry, questionnaire generation start/get/retry, `/v1/risk_assessments` list/status_summary/get(×2 parsers)/update/risks list+create/release, `/v1/risks/{riskId}` update, control implementations list/create/update/delete, `/v1/risk_types`, `/v1/controls`, `/v1/users`, `/v1/my_risk_assessments` (+rating_summary)) | 332-494 |
| `features/questionnaires/questionnaire-service.ts` | 15 (my list/status_summary, review list/summary, get, questions, answers, submit, revert, release, return_to_review, add/edit/delete question) | 224-345 |
| `features/requests/request-service.ts` | 10 (`GET/POST /csrm-assessment-requests`, `GET/PUT /csrm-assessment-requests/{id}`, `/v1/my_requests/status_summary`, `/v1/information_{systems,assets}` GET and `/selected` POST, revert) | 59-281 |
| `features/risks/risk-service.ts` | 8 (`/v1/risks`, `/v1/risks/{riskId}`, `/v1/risk_assessments`, `/v1/risk_types`, `/v1/controls`, `/v1/users`, `/v1/information_{systems,assets}`) | 62-135 |
| `features/alerts/alert-service.ts` | 2 | 61, 78 |
| `features/reports/report-service.ts` | 2 (`/v1/reports`, `REPORT_PATH` = `/v1/reports/{reportKey}`) | 77, 94-95 |
| `features/analyst-dashboard/analyst-dashboard-service.ts` | 1 | 57 |
| `features/shell/shell-service.ts` | 1 (`GET /applications`) | 61 |

Note `assessment-service.ts:389` and `:395` call the same `GET /v1/risk_assessments/{assessmentId}` with the analyst and the Requestor-released parser respectively (the shared GET path decision of Phase 4).

#### F1.2 How Strapi mounts `/api/v1` and the core routes

- Custom content-api routers (explicit `method`/`path`/`handler`/`config.policies`): `csrm-administration/routes/csrm-administration.ts:20-107` (24 routes, `content-api-token` strategy, `requireAnalystAdministrationScope` or picker policies), `csrm-analyst-insight/routes/{alerts,dashboard,reports}.ts` (5 routes, `requireAnalystInsightScope`), `csrm-assessment/routes/csrm-assessment.ts:13-78` (11 routes), `csrm-control-implementation/routes/csrm-control-implementation.ts:13-30` (3), `csrm-questionnaire/routes/csrm-questionnaire.ts:43-150` (18; four of them carry no `auth.strategies` override: `addQuestion`/`editQuestion`/`deleteQuestion` lines 43-60 and `statusSummary`/`listMine`/`reviewSummary`/`listAll`/`answers`/`submit`/`listQuestions`/`findOne` lines 103-150 — same for `generate*` 61-78 — only `generateAssessment` at 97-102 names `content-api-token`), `csrm-risk/routes/csrm-risk.ts:30-71` (7), `csrm-information-{asset,system}/routes/selected.ts:13-27` (2).
- Core routers: `csrm-assessment-request/routes/csrm-assessment-request.ts:5-65` (the five default CRUD routes, each with `csrm-authorization` policies) plus `reviewQueueRoute` (67-83) and `revertToDraftRoute` (85-101) spliced in front (103-113); `my-request-status-summary.ts:13-27` in its own router (the comment at 5-9 explains why). `csrm-information-{asset,system}/routes/*.ts` mount `only: ['find']` with a policy (`GET /csrm-information-assets`, `GET /csrm-information-systems` — **absent from the OpenAPI spec**, present in the catalogue as `function.risk_assessment_requests.reference_data_api`). `csrm-control`, `csrm-risk-type`, `csrm-question` mount `only: []` (no route).
- **Un-policied core routers:** `application/routes/application.ts:3`, `function/routes/function.ts:3`, `function-api/routes/function-api.ts:3`, `idambox-user/routes/idambox-user.ts:3`, `role/routes/role.ts:3` each mount the five default CRUD routes with no CSRM policy (25 routes). Their only gate is Strapi's content-api auth. The web's token is `type: "full-access"` (`apps/strapi/src/bootstrap/seed-development-api-token.ts:26`; harness `strapi-http-harness.ts:303-308`), and the content-api-token strategy returns from `verify` before any scope check for a full-access token (`node_modules/.pnpm/@strapi+admin@5.51.0*/node_modules/@strapi/admin/dist/server/server/src/strategies/content-api-token.js:73-76`). The only existing proof is token-less: `contract-catalogue.integration.test.ts:777-778` asserts 403 for `GET /api/idambox-users` with `omitApiToken: true`. Consequence: whoever holds the web server's token can read and write IdamBox users, roles, functions and function-APIs over HTTP. **Recommendation:** mount `function`, `function-api`, `idambox-user`, `role` with `only: []` (the identity middleware and policies use `strapi.documents(...)` internally: `csrm-development-identity.ts:35-41`, `csrm-authorization.ts:158-173`; the seeds are bootstrap code), and either remove the dead `listShellApplications` (`shell-service.ts:58`, no caller outside its own module and `boundaries/alignment.test.ts:42`) with `application` at `only: []`, or keep `only: ['find']` behind `global::csrm-app-enabled`. This is a router change (allowed by D-02) and it makes the D-16 completeness guard tractable (25 fewer rows). Flag for the planner as a security decision, not a silent tidy-up.

#### F1.3 How the catalogue maps FunctionAPIs to operations

- `docs/references/idambox-csrm-role-function-api-catalogue.json` (byte-identical to `apps/strapi/src/bootstrap/…`, `cmp` clean): 3 roles, 45 functions (22 API-only, i.e. no `menuPath`), 121 `functionApis` whose `url` is `METHOD:/api/<path>`; some carry a query (`GET:/api/v1/users?search={query}`, `GET:/api/v1/risk_types?picker=assessment`, `GET:/api/v1/information_systems?q={q}&page={page}&pageSize={pageSize}`, `GET:/api/v1/risks/export?format={format}`). Seven URLs appear under two Functions (Requestor and analyst variants of `GET /v1/questionnaires/{id}`, `…/questions`, `GET /v1/risk_assessments/{id}`, `…/risks`, `GET /v1/risks/{riskId}/control_implementations`, `GET /v1/users?search`, and `POST /v1/assessment_requests/{requestId}/submit` twice within the Requestor's own Functions). The policy matches by exact `url` string (`csrm-authorization.ts:142-146`), and query-qualified URLs are chosen by `isSelectorQuery` / `administrationListOperation` (`:250-253`).
- Design notes 7 and 8 already record why Phase 3 and Phase 7 entries stay unserved; there is no note for the remaining reserved entries.

#### F1.4 The four-way inventory (computed 2026-09-25)

Method: a node script enumerated (a) 154 spec operations, (b) 110 distinct catalogue method+path pairs, (c) 103 mounted routes (custom routers by `method`/`path` pairs, core routers by `createCoreRouter` `only` lists and `pluralName`), (d) 76 web-invoked operations. Results:

- **Web → spec → mounted → catalogue:** all 76 web operations are in the spec and mounted exactly once; 75 are catalogued. The exception is `GET /applications` (uncatalogued core route; see F1.2). No route is mounted twice.
- **Catalogued but not mounted (32; D-04 wants each with a reason):** Phase 7 D-06 — `GET /v1/alerts/{alertId}`, `PATCH /v1/alerts/{alertId}/acknowledge`, `GET /v1/dashboard/alerts`, `GET /v1/dashboard/reports`, `POST /v1/reports/{reportKey}/export` (note 8). Phase 3/4 review intents — `PATCH /v1/questionnaires/{id}/review_comments`, `POST /v1/questionnaires/{id}/complete_review` (note 7), `POST /v1/risk_assessments/{id}/approve`, `…/submit_for_approval`, `…/regenerate_draft`, `GET /v1/risk_assessments/due_for_review` (Phase 4 served the release triple and draft jobs instead). Request `/v1` aliases served through the core `/csrm-assessment-requests` routes — `GET /v1/my_requests`, `POST /v1/assessment_requests`, `GET|PATCH /v1/assessment_requests/{requestId}`, `POST …/submit` (×2 entries), `GET /v1/assessment_requests/form_metadata`, `…/overdue`, `…/status_summary`, `GET|POST …/{requestId}/information_{assets,systems}`. Control-implementation collection intents — `GET|POST /v1/control_implementations`, `GET …/{implementationId}`, `…/overdue`, `…/status_summary` (Phase 4 serves them under their Risk). Risk intents — `GET /v1/risks/export`, `…/overdue`, `…/status_summary`, `POST /v1/risks/{riskId}/close` (export/close deferred; overdue and status summaries superseded by Phase 7 alerts/dashboard).
- **Mounted but not in the spec (2):** `GET /csrm-information-systems`, `GET /csrm-information-assets` (catalogued, no web caller since Phase 06.3 moved selectors to `/v1/information_*?q=`). Recommendation: `only: []` after the matrix confirms no caller, or publish; either way the inventory must list them.
- **Mounted but not catalogued (25):** the IAM/application core routes (F1.2).
- **Spec operations no application router mounts (51):** 25 generic `/csrm-{assessments,control-implementations,questions,questionnaires,risks}` CRUD operations (documented but deliberately unmounted since Phases 3–4), and 26 plugin operations (`/auth/*`, `/users*`, `/roles/{role}`, `/permissions`, `/connect/(.*)`, `/files*`, `POST /` upload, `/content-types*`, `/components*`, `/locales`) that Strapi plugins mount at runtime outside `apps/strapi/src/api`. Their live status is untested; see Open Questions (users-permissions `register`/`local` and the `/api/roles` collision between the `role` content type and the users-permissions plugin).

#### F1.5 Existing guards and the remaining gap

| Guard | What it proves | Gap for D-04 |
|-------|----------------|--------------|
| `apps/strapi/tests/contract-catalogue.integration.test.ts` (1,786 lines; per-phase served-route lists e.g. 76-146, 148-170, 172-176; asserts spec `operationId`, generated `schema.d.ts` path+operation, catalogue effective grants, byte-identical copies) | Per-phase enumerations, each hand-maintained | No single enumeration of everything served; nothing enumerates web call sites; unserved entries are listed only for Phase 7 (`analyst-insight-routes.unit.test.ts:81`) |
| `apps/strapi/tests/analyst-insight-routes.unit.test.ts:102-149` | Static route-source inventory for the five insight routes, mounted once, token-only, correct policy | Pattern to generalise (imports router modules, reads route sources) |
| `apps/strapi/tests/authorization.integration.test.ts:200-256` (one canonical FunctionAPI per served request operation), `:278` (Administration inventory token-only, exact-grant, duplicate-free) | Per-family | Same |
| `apps/web/src/features/contract-response-parity.test.ts:208-310` | Zod parsers vs spec components (minimal/maximal/nullable instances), `narrowedPaths`, module inventory (213-230) | Sees response shapes only; blind to `min`/`max`/`trim` (line 114-125 synthesises short non-empty strings) |
| `apps/web/src/lib/boundaries/alignment.test.ts:42` | `/applications` payload parsing | — |

**Guard design (recommended):**

1. `apps/strapi/tests/served-operations.unit.test.ts` (node:test, no database): import every `src/api/*/routes/*.ts` module (as `analyst-insight-routes.unit.test.ts:6-9` does), expand core routers from `only` and the content-type `pluralName`, and produce the served inventory `{method, path, catalogueUrl, routerFile, handler, authStrategies, policyOperation, functionApiIds, roleIds}`. Assert: each catalogue-URL mounted exactly once; each served operation exists in `docs/references/specification.json` (path + method + `operationId`); each has ≥1 FunctionAPI or is in an explicit `uncatalogued` allowlist with a reason; each FunctionAPI URL that is not served appears in an `unserved` list with a reason; the two catalogue copies are byte-identical. Write the result to `docs/references/served-operations.json` and fail if the checked-in file differs (`SERVED_OPERATIONS_DRIFT: run pnpm --filter @csrm/strapi served-operations:write`).
2. `apps/web/src/features/contract-operation-chain.test.ts` (vitest): scan `src/features/**/*-service.ts` and `src/lib/api/transport/*.ts` sources; every `client.<METHOD>(` first argument must be a string literal or a module-level `const X = '<path>' as const`; the guard fails otherwise (`NON_LITERAL_CLIENT_PATH`). Each `(method, path)` must exist in the spec, in `docs/references/served-operations.json` as served, and be catalogued (or listed as an allowed uncatalogued read). Also assert no `fetch(` outside `src/lib/api/transport` in `src`/`app` (a stronger form of the Phase 7 verification grep).
3. Catalogue design note 9 records the reasons for every unserved entry (mirroring notes 7 and 8), so the JSON and the catalogue agree.

D-06 is then a row filter: the eight import operations (`POST /v1/{collection}/import/preview` and `/import`) appear as web-called, spec'd, mounted once (`csrm-administration.ts:32-39, 52-59, 76-83, 100-107`) and granted to `role.security_analyst` only (`authorization.integration.test.ts:258-278` already asserts the 24-operation set).

#### F1.6 IN-03: parser bounds the contract does not declare

| Parser | File:line | Bound | Contract today | Server guarantee (so the contract can declare it) |
|--------|-----------|-------|----------------|---------------------------------------------------|
| `exposedSystemSchema.documentId`, `.name` | `apps/web/src/features/reports/report-schema.ts:93-94` | `.trim().min(1).max(255)` | `ExposedSystem` strings unbounded | Strapi documentId (generated); `name` is a `string` attribute (Strapi default max 255) |
| `documentIdSchema` | `analyst-dashboard-schema.ts:55` (used at 67, 83) | `.trim().min(1).max(255)` | `DashboardRiskRow.documentId`, `ActivityItem.documentId`: `{type: string}` | Strapi documentId |
| `dashboardRiskRowSchema.riskNumber` | `analyst-dashboard-schema.ts:68` | `.trim().min(1).max(255)` | `{type: string}` | Domain number (`assessment-workflow.unit.test.ts:332` "UTC year, fixed prefixes, Crockford alphabet") |
| `activityItemSchema.identifier` | `analyst-dashboard-schema.ts:84` | `.trim().min(1).max(255).nullable()` | `{type: [string, null]}` | Request/questionnaire/assessment numbers or null |
| `documentIdSchema` | `alerts/alert-schema.ts:58` (used at 64, 72) | `.trim().min(1).max(255)` | `AlertSource.documentId`, `AlertLink.documentId`: `{type: string}` | Strapi documentId |
| `alertSourceSchema.identifier` | `alert-schema.ts:65` | `.trim().min(1).max(255)` | `{type: string}` | Record number |
| `alertItemSchema.id` | `alert-schema.ts:76` | `.trim().min(1).max(512)` | `{type: string}` | Deterministic `kind:source:documentId` (`alert-rules.ts`) |

The header comments (`report-schema.ts:17-18`, `analyst-dashboard-schema.ts:17-19`) claim no narrowing. The spec already uses bounds elsewhere (`AdministrationImportResultRow.documentId`: `minLength 1, maxLength 200, pattern ^[A-Za-z0-9_-]+$`), so declaring `minLength: 1`/`maxLength: 255` (512 for `AlertItem.id`) follows precedent. `.trim()` is a transform, not a bound, but it makes a whitespace-only value fail `min(1)` where `minLength: 1` would accept it; for machine identifiers drop `.trim()` so parser and contract coincide. The parity guard honours `minLength`/`maxLength` when synthesising strings (`contract-response-parity.test.ts:123-124`).

**Making narrowing visible (D-05 "nothing stays invisible"):** add a fourth mode `boundary` to `instanceOf` that emits `''` for strings without `minLength` and a string longer than any client cap (say 70,000 characters; the clients' largest cap is `max(65_535)`) for strings without `maxLength`; a parser that rejects must then either have the bound declared in the spec or the path in `narrowedPaths`. Expect a wide first run: feature schemas contain roughly 140 `.min(1)` and 216 `.max(` calls (grep counts: administration 15/24, csv-import 11/35, assessment 29/38, questionnaire 15/20, requests 14/9, risks 18/27, alerts 9/9, dashboard 4/8, reports 5/6; services add 20/40). The planner should budget a sweep or scope the boundary mode to the components the three Phase 7 files parse and grow it per phase; either way the mode must exist so IN-03's class cannot recur.

### F2. Production-build E2E (D-10, D-11, D-12)

#### F2.1 What Next 16.3.3 writes, and when (read from `apps/web/node_modules/next/dist`)

- `lib/verify-typescript-setup.js:193` calls `writeConfigurationDefaults(typescriptVersion, resolvedTsConfigPath, intent.firstTimeSetup, hasAppDir, distDir, hasPagesDir, strictRouteTypes)` and `:196-204` calls `writeAppTypeDeclarations({ baseDir: dir, distDir, … })`. The comment at 239-244 states this runs "in-process (next dev / next test / next typegen, and the CLI type-check during build)". `resolvedTsConfigPath` is `path.join(dir, tsconfigPath || 'tsconfig.json')` (line 106-107).
- `lib/typescript/writeConfigurationDefaults.js:238-240`: **"Bail automatic setup when the user has extended or referenced another config"** — `if ('extends' in userTsConfig || 'references' in userTsConfig) return;` before any write. Lines 286-318: `nextTypes = getTypeDefinitionGlobPatterns(distDir)`; when `include` exists and `hasAppDir && !strictRouteTypes`, every missing pattern is pushed and the file rewritten at 375. `lib/typescript/type-paths.js:29-40`: patterns are `${distDir}/types/**/*.ts` plus `${distDir}/dev/types/**/*.ts` (build) or `${distDir minus /dev}/types/**/*.ts` (dev), "to avoid tsconfig churn when switching between dev/build modes". That is exactly why each isolated `CSRM_NEXT_DIST_DIR=.tmp/playwright-next-<uuid>` run appends two include entries.
- `lib/typescript/writeAppTypeDeclarations.js:52-56`: `next-env.d.ts` contains `import "./<distDir>/types/routes.d.ts";` and `import "./<distDir>/types/root-params.d.ts";` (plus `types/cache-life.d.ts`/`validator.ts` only with `strictRouteTypes`); 71-74: written only when the content differs. Therefore any dist directory other than the last one rewrites it — including a plain `next build` at `.next` after `next dev` (HEAD's copy imports `./.next/dev/types/…`).
- Defaults: `server/config-shared.js:96` `typedRoutes: false`, `:256` `experimental.strictRouteTypes: false`, `:257` `experimental.useTypeScriptCli: true` (so `next build` runs the project-local `tsc` over the whole project selected by the configured tsconfig [CITED: useTypeScriptCli.md "Behavior"]), `:114` `poweredByHeader: true`, `:128` `productionBrowserSourceMaps: false`.
- Docs: `typescript.tsconfigPath` "is used in `next dev`, `next build`, and `next typegen`" [CITED: 02-typescript.md "Custom `tsconfig` path"]; "`next-env.d.ts` is managed by Next.js … Add it to `.gitignore`. If your project already tracks the file, remove it from Git" and "The file must be in your `tsconfig.json` `include` array" [CITED: 02-typescript.md "`next-env.d.ts`"]; `next typegen` "generates a `next-env.d.ts` file. We recommend adding `next-env.d.ts` to your `.gitignore`… `next typegen && tsc --noEmit`" [CITED: next.md "`next typegen` options"]; "Development builds output to `.next/dev` instead of `.next`. This allows you to run `next dev` and `next build` concurrently without conflicts" [CITED: next.md "`next dev` options"].

#### F2.2 Current stale state and the clean files

- `apps/web/tsconfig.json` at HEAD carries 44 `.tmp/playwright-next-*` / `.tmp/ordinary-next-*` include lines (22 pairs) after the five real entries; the working tree has four more (`.tmp/playwright-next-5273ea2d…`, `.tmp/ordinary-next-3521`) — the orchestrator's current run. `git log` shows the file last changed in `da3768c`, `667f339`, `a14a44e`.
- Clean `include`: `["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"]` (Next's own default also adds `**/*.mts`; harmless either way). `compilerOptions` are unchanged.
- `next-env.d.ts` at HEAD: two triple-slash references plus `./.next/dev/types/routes.d.ts` and `root-params.d.ts` imports (working tree points at `.tmp/ordinary-next-3521`).

#### F2.3 D-12 mechanism (confirmed against source and docs)

1. Add tracked `apps/web/tsconfig.e2e.json` = `{ "extends": "./tsconfig.json" }` (it must exist: a missing file is "first-time setup" and Next writes `{}` then fills it, `writeConfigurationDefaults.js:232-234`).
2. `apps/web/next.config.ts`: `typescript: { tsconfigPath: process.env.CSRM_NEXT_DIST_DIR ? 'tsconfig.e2e.json' : 'tsconfig.json' }` beside the existing `distDir` spread (line 10). The `extends` key stops the include mutation at its source for every isolated-dist process, including the conformance spec's spawned "ordinary" `next dev` (`apps/web/e2e/design-system-conformance.spec.ts:161-163`, which sets `CSRM_NEXT_DIST_DIR: .tmp/ordinary-next-<pid>`). Type coverage is unchanged: the base `include` is inherited, and route types reach the compiler through `next-env.d.ts`'s `import "./<distDir>/types/routes.d.ts"`. (TypeScript's `**/*.ts` wildcard does not descend into dot-directories — consistent with Next adding explicit `.next/…` entries — `[ASSUMED: TypeScript wildcard semantics]`.)
3. Untrack `apps/web/next-env.d.ts` (`git rm --cached`, add `apps/web/next-env.d.ts` to `.gitignore`), and change `apps/web/package.json` `typecheck`/`lint` to `next typegen && tsc --noEmit` so a fresh clone still typechecks (typegen loads `next.config.ts` in the production phase, so with `CSRM_NEXT_DIST_DIR` unset it uses `.next`, whose patterns are already in `include` — no rewrite). Note the `apps/web/AGENTS.md` block is re-added by `next dev` only (`server/lib/generate-agent-files.js:2-3`) and is committed, so it never dirties the tree.
4. Files a full E2E run may touch, for the `git status --porcelain` proof: `apps/web/tsconfig.json` (fixed by 1-2), `apps/web/next-env.d.ts` (fixed by 3), `apps/web/.tmp/**` (ignored), `test-results/`, `playwright-report/`, `*.tsbuildinfo` (ignored), `apps/strapi/.tmp/`, `apps/strapi/dist/` (ignored), `apps/strapi/types/generated/{components,contentTypes}.d.ts` (**tracked**; Strapi regenerates them at boot from frozen schemas, so they should be byte-stable — watch them in the proof).

#### F2.4 webServer design for build-then-start

- Playwright runs `webServer.command` through a shell (`node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/lib/plugins/webServerPlugin.js:86-95` passes `shell: true` to `launchProcess`; `playwright-core/lib/server/utils/processLauncher.js:114`). One entry can therefore be `` `${runPnpm('exec next build')} && ${runPnpm(`exec next start --hostname 127.0.0.1 --port ${webPort}`)}` `` with one `env`. Multiple `webServer` entries become one plugin each (`webServerPlugin.js:206`) and plugins are set up in order (`playwright/lib/runner/tasks.js:139-147`), so Strapi (health URL) is ready before the web build starts, as today.
- Readiness: `url` counts as available only when the status is `>= 200 && < 404` (`playwright-core/lib/server/utils/network.js:189-195`). Today `/sign-in` returns 404 under a production build (`apps/web/app/sign-in/page.tsx:15-17` calls `notFound()` when `parseSessionRuntimeMode(NODE_ENV) !== 'development'`), so **without D-11 the webServer silently waits the full `timeout` (600 s) and then fails with a launch-timeout message**, not with a clear cause. Keep `/sign-in` as the readiness URL (it proves the gate) and add a first test that asserts `GET /sign-in` is 200 with a message naming the gate.
- Env for the web entry: `NODE_ENV: 'production'` (D-11; Next also defaults to production for `build`/`start` [CITED: environment-variables.md "Good to know"]), `CSRM_ENVIRONMENT: 'development'`, `CSRM_DEV_IDENTITY: 'true'`, `CSRM_API_BASE_URL`, `CSRM_API_TOKEN`, `CSRM_NEXT_DIST_DIR`, `CSRM_E2E_UI_STATE_HARNESS: '1'`, `CSRM_E2E_RUNTIME_ROOT/ATTESTATION_PATH/NONCE` (all present at `playwright.config.ts:109-120`). `.env.local` exists in `apps/web` on this VM (existence only); Next loads it in production too, but explicit `process.env` wins [CITED: environment-variables.md "Environment Variable Load Order"], so the webServer env is authoritative.
- Timeouts: raise the web entry `timeout` (600 s today, `playwright.config.ts:123`) to cover build + start; the `expect.timeout: 15_000` comment (74-77) describes on-demand compilation and becomes stale — keep the value until measured. **Build time could not be measured** (no production build artefact exists on this VM; `apps/web/.next` is absent and `.tmp` holds only `ordinary-next-3521`); on 4 vCPU/15 GB expect a Turbopack build of ~30 routes to take 1.5–4 minutes `[ASSUMED]`. Current reference points: full Playwright 49 tests in 7.2 min on `next dev`, Strapi suite 8.7 min (`07-09-SUMMARY.md:82-86,193,197`). Production pages need no on-demand compile, so per-test time should fall.
- Expose the dist directory and the attestation nonce to specs the way the origins are exposed (`playwright.config.ts:63-64`, `process.env.X ??=`) so the D-22 scan can read `<distDir>/static` and assert the nonce/token values are absent.

#### F2.5 Every code path D-11 must change (and reuse)

| Path | Today | Change |
|------|-------|--------|
| `apps/web/src/lib/auth/session-adapter.ts:38-40` `parseSessionRuntimeMode(nodeEnv)` | `'development'` only when `NODE_ENV === 'development'` | Replace with a `resolveSessionRuntimeMode(env)` that also returns `'development'` when `NODE_ENV === 'production'` **and** `CSRM_ENVIRONMENT === 'development'` **and** `CSRM_DEV_IDENTITY === 'true'` **and** the attestation is valid; anything else `'unavailable'`. |
| `apps/web/src/lib/auth/development-session-adapter.ts:38-46, 105-109` | `isDevelopmentRuntime()`/`getSessionAdapter()` call the parser with `process.env.NODE_ENV` | Call the new resolver; keep `UnavailableSessionAdapter` as the fail-closed branch; keep the cookie `secure: false` (line 67) — the attested runtime is `http://127.0.0.1`. |
| `apps/web/app/sign-in/page.tsx:15-17` | `notFound()` outside development | Same resolver. |
| `apps/web/src/lib/api/transport/server-client.ts:50-65` `developmentIdentityHeader` / `developmentIdentityBridgeEnabled` | `NODE_ENV === 'development' && CSRM_DEV_IDENTITY === 'true'` | Same resolver (the API token stays required whenever the bridge is enabled, line 80). Leave `:95` (parser-mismatch detail is a development-only diagnostic). |
| `apps/web/src/lib/testing/e2e-ui-state.ts:33-55` `isAttestedE2eRuntime` | Requires `CSRM_E2E_UI_STATE_HARNESS === '1'` (line 34) plus root/path/nonce/age checks | Extract the root/path/nonce/age check into `src/lib/testing/e2e-runtime-attestation.ts` (server-only) and compose it here with the harness flag. The session gate must **not** depend on the harness flag: the conformance spec's ordinary server deletes that flag (`design-system-conformance.spec.ts:162`) and still signs in (`:167`). |
| Strapi | `apps/strapi/src/utils/development-identity-enabled.ts:1-7` requires `NODE_ENV === 'development'`; `csrm-development-identity.ts:30` ignores the header otherwise | Unchanged (D-11: Strapi stays authoritative; E2E Strapi stays `strapi develop`). |

Tests that pin the old behaviour and must change deliberately: `apps/web/src/lib/boundaries/alignment.test.ts:15-20` (`production → 'unavailable'`), `apps/web/src/lib/api/transport/server-client.test.ts:68, 140`. New unit tests: one per gate (each missing/invalid input alone leaves the session unavailable), plus attestation cases mirrored from `e2e-ui-state.test.ts:40-91`. Browser/integration proof for "production build without attestation refuses sign-in": a Playwright test that spawns `next start` (or a vitest that renders the sign-in page with a production env) without the attestation env and asserts `/sign-in` → 404 and `/app` → no session (`ProtectedLayout` would throw `Session authentication is not configured.` — see F3.4 on the missing `global-error.tsx`).

#### F2.6 What assumes `next dev`, and what changes under `next start`

- Assumes dev: `playwright.config.ts:74-77` (comment and 15 s expect timeout), the conformance spec's ordinary server (`design-system-conformance.spec.ts:160-176`, spawns `next dev`; keep it — it proves the fixture query is ignored without the harness flag, and it stays on `NODE_ENV=development`), STATE's HMR notes (dev-only artefacts). No spec references HMR or compile timing.
- Same under `next start`: server actions and `revalidatePath('/app', 'layout')` (`apps/web/app/actions/session.ts:11`); cookies (`sameSite: 'lax'`, `httpOnly`); `force-dynamic` on every app route (`apps/web/app/(app)/layout.tsx:6`) so nothing is prerendered at build; `experimental.serverActions.bodySizeLimit: '6mb'` (CSV upload).
- Different under production: server-side errors reach `error.tsx` with a generic message and `digest` [CITED: error.md "`error.message`"] — the app's boundaries never print `error` anyway (grep of `apps/web/app/**/error.tsx`); `reactStrictMode` double-invocation disappears; source maps are off (`productionBrowserSourceMaps: false`).

### F3. Security (D-19, D-20, D-21, D-22)

#### F3.1 Next 16.3: headers, CSP and the proxy rename

- **Proxy, not middleware.** "The `middleware` file convention is deprecated and has been renamed to `proxy`" [CITED: 03-file-conventions/proxy.md, version table `v16.0.0`]; `proxy.ts` sits at the project root or in `src`, exports `proxy` (named or default) and an optional `config.matcher`; it runs on the Node.js runtime [CITED: proxy.md "Runtime"]. Execution order: `headers` from `next.config.js` first, then `redirects`, then Proxy [CITED: proxy.md "Execution order"], so static headers in `next.config.ts` and a per-request CSP from `proxy.ts` coexist.
- **Static headers** via `headers()` in `next.config.ts` with `source: '/(.*)'` (also covers `_next/static` assets) [CITED: 05-config/01-next-config-js/headers.md]. `poweredByHeader: false` removes `X-Powered-By` [CITED: poweredByHeader.md]; today `next.config.ts` sets neither headers nor `poweredByHeader` (lines 1-11).
- **Nonce CSP** [CITED: 02-guides/content-security-policy.md]: generate a nonce per request in `proxy.ts`, set it in both the request header `x-nonce` and the response `Content-Security-Policy`; "you **must use dynamic rendering** to add nonces"; Next "extracts the nonce" from the CSP header (`server/app-render/get-script-nonce-from-header.js:11-12`) and attaches it to framework scripts, page bundles, "inline styles and scripts generated by Next.js" and `<Script nonce>`; `'unsafe-eval'` is needed only in development; the recommended matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico` and prefetch requests (`missing: next-router-prefetch` / `purpose: prefetch`). Every route here is dynamic (`force-dynamic` at `apps/web/app/(app)/layout.tsx:6`; `/sign-in` reads `searchParams`; `/` is a redirect), so nonces add no rendering cost. PPR/static caching are not in use (`cacheComponents: false`, `config-shared.js:147`).
- **Inline emitters present in this app:** Next's own inline flight/runtime scripts (nonce applied automatically); `next/font/google` self-hosted fonts (`apps/web/app/layout.tsx:3-9`; CSS classes, no inline script); **`sonner` injects a `<style>` element at module evaluation** (`node_modules/.pnpm/sonner@2.0.8*/node_modules/sonner/dist/index.mjs:5-8`, `document.createElement('style')`), mounted on every page through `Toaster` (`apps/web/app/layout.tsx:17`); Radix Dialog/Popover render inline `style` attributes during SSR. Neither carries a nonce. Conclusion: `script-src` can be strict; `style-src` needs `'unsafe-inline'` (a nonce in `style-src` would disable `'unsafe-inline'` in CSP3 browsers and block sonner). D-19 constrains scripts only; record the style residual with this reason. No `next/script`, `<script>`, `<style>` or `dangerouslySetInnerHTML` exists in `apps/web/src` or `apps/web/app` (grep).

**Concrete header set (D-19):**

| Header | Value | Where |
|--------|-------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'` (+ `'unsafe-eval'` only when `NODE_ENV === 'development'`)`; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` | `proxy.ts` (per request; also set on the request headers so Next reads the nonce) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` when `NODE_ENV === 'production'` (browsers ignore HSTS received over plain HTTP, so the E2E on `http://127.0.0.1` can assert its presence harmlessly) | `next.config.ts` `headers()` or `proxy.ts` |
| `X-Content-Type-Options` | `nosniff` | `headers()` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `headers()` |
| `X-Frame-Options` | `DENY` (belt-and-braces with `frame-ancestors 'none'`) | `headers()` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` (Next doc example; extend as the operator wishes) | `headers()` |
| `Cross-Origin-Opener-Policy` | `same-origin` | `headers()` |
| `X-Powered-By` | removed (`poweredByHeader: false`) | `next.config.ts` |

Do not add `upgrade-insecure-requests` (it would upgrade the E2E's `http://127.0.0.1` requests; Open Question 9). Prefetch requests excluded by the matcher still receive the static headers from `headers()`.

**Proof (production-build E2E):** a `production-hardening.spec.ts` that (a) requests `/sign-in`, `/app` (signed in) and one `/_next/static/...` asset via `page.request` and asserts every header above; (b) installs `page.addInitScript` registering a `securitypolicyviolation` listener that appends to `window.__cspViolations`, plus a `console` listener for "Refused to" messages, and asserts both stay empty across the six journeys (or a route sweep); (c) asserts the production CSP contains a `'nonce-'` token and no `'unsafe-eval'`.

#### F3.2 Strapi 5.51 `strapi::security` and the error envelope (D-20)

- Middleware order today: `apps/strapi/config/middlewares.ts` — `strapi::logger`, `strapi::errors`, `global::csrm-development-identity`, `strapi::security` (defaults), `strapi::cors`, `strapi::poweredBy`, `strapi::query`, `strapi::body` (6 mb form limit, 50 MB per file, 250 MB total), `strapi::session`, `strapi::favicon`, `strapi::public`.
- `strapi::security` defaults (`@strapi/core/dist/middlewares/security.js:11-31`): koa-helmet with `contentSecurityPolicy.useDefaults: true` plus `CSP_DEFAULTS` (`@strapi/utils/dist/security.js:5-21`: `connect-src 'self' https:`, `img-src 'self' data: blob: https://market-assets.strapi.io`, `media-src 'self' data: blob:`) and `upgradeInsecureRequests: null`; `crossOriginEmbedderPolicy`, `crossOriginOpenerPolicy`, `crossOriginResourcePolicy`, `originAgentCluster` all `false`; `xssFilter: false`; `hsts: { maxAge: 31536000, includeSubDomains: true }`; `frameguard: { action: 'sameorigin' }`. Development/test GETs under the admin path relax `script-src`/`connect-src` (lines 82-102). helmet 6.2.0 adds `Referrer-Policy: no-referrer` (`helmet/index.cjs:200`) and `X-Content-Type-Options: nosniff` (`:261`) by default.
- `strapi::poweredBy` sets `X-Powered-By: Strapi <strapi.io>` (`powered-by.js:4, 13`). Recommendation: remove the entry from `config/middlewares.ts:8` (configuration only), and document the rest. Consider `frameguard: { action: 'deny' }` and `crossOriginOpenerPolicy: true` only after confirming the admin panel still loads (Open Question 6) — the API surface itself is never framed.
- **Production error envelope** (`@strapi/core/dist/middlewares/errors.js:6-32` and `dist/services/errors.js:36-75`): `ApplicationError` → `{ data: null, error: { status, name, message, details } }` (400 or the mapped 401/403/404/413/429/501); `HttpError` → its own status/message/details; anything else → `strapi.log.error(error)` then `formatInternalError`, which wraps non-exposable errors as `createError(500)` → `{ status: 500, name: 'InternalServerError', message: 'Internal Server Error' }`. **No stack and no internal message in any `NODE_ENV`**; only `expose: true` HTTP errors and application errors carry their own messages (the project's safe 400/403/404/409 envelopes). A response with no explicit status becomes `ctx.notFound()`. Existing tests assert only the 500 status (`assessment-workflow.integration.test.ts:1387`, `questionnaire-workflow.integration.test.ts:370`); extend one of them to `assert.deepEqual(body, { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } })` and to assert the JSON contains no `stack`. A header assertion (`x-frame-options`, `strict-transport-security`, `x-content-type-options`, `referrer-policy`, `content-security-policy` present; `x-powered-by` absent) fits the same mounted harness.

#### F3.3 Unsafe HTML, error boundaries, safe copy (D-21)

- `dangerouslySetInnerHTML`, `eval(`, `new Function(`, `document.write`, `srcdoc`, `javascript:` — none in `apps/web/src` or `apps/web/app`; the only `innerHTML` is a test read (`questionnaire-workflow.test.tsx:359`).
- Error boundaries: every collection and detail segment under `app/(app)/app/*` has `error.tsx` (26 files listed in the app tree); segments without their own boundary are covered by a parent: `admin/[collection]/{page,new,import,[documentId]}` by `admin/error.tsx`, `requests/new` and `requests/[documentId]/edit` by `requests/error.tsx` / `requests/[documentId]/error.tsx`. No boundary prints `error.message` or `digest` (grep of all `error.tsx`). Gaps: **no `app/global-error.tsx`** (a throw in `(app)/layout.tsx` — e.g. `UnavailableSessionAdapter.current()` at `development-session-adapter.ts:85-87` — escapes `(app)/error.tsx`, which "does **not** wrap the `layout.js` … above it in the same segment" [CITED: error.md]) and **no `app/not-found.tsx`** (unmatched URLs get Next's default 404 without the shell or brand copy); both are named in the production checklist [CITED: production-checklist.md "UI and accessibility"]. `global-error` must render its own `<html>`/`<body>` and cannot export metadata [CITED: error.md "Global Error"]. `error.tsx` receives `retry` (stable since 16.3.0 [CITED: error.md version table]); the analyst dashboard boundary already uses it (`app/(app)/app/review/(analyst-dashboard)/error.tsx:8`), the others use `reset`.
- Loading UI: `admin/[collection]/*` pages have no `loading.tsx` beside them (parent `admin/loading.tsx` covers).

#### F3.4 Nothing server-only reaches the browser (D-22)

- Only `NEXT_PUBLIC_`-prefixed variables are inlined into client bundles [CITED: environment-variables.md "Bundling Environment Variables for the Browser"]; the repository has none (grep). Server env names in use: `CSRM_API_BASE_URL`, `CSRM_API_TOKEN`, `CSRM_DEV_IDENTITY`, `CSRM_E2E_UI_STATE_HARNESS`, `CSRM_E2E_RUNTIME_NONCE`, `CSRM_E2E_RUNTIME_ROOT`, `CSRM_E2E_RUNTIME_ATTESTATION_PATH`, `CSRM_NEXT_DIST_DIR`, `NODE_ENV`.
- `server-only` is imported first in `server-client.ts:1`, `session-adapter.ts:1`, `development-session-adapter.ts:1`, `e2e-ui-state.ts:1`, `development-capabilities.ts:1`, `server-guard.ts:1` and every `*-service.ts` (07-REVIEW "Every service is `server-only`").
- **Scan:** after the E2E build, read `<distDir>/static/**/*.{js,css}` and assert none contains the nine names above, the run's token value (`csrm-playwright-development-only`, `playwright.config.ts:39`), the attestation nonce, the header name `x-csrm-dev-identity`, or the fixture emails; implement as the last test of `production-hardening.spec.ts` using the dist directory exposed per F2.4. **Static guard:** a vitest that asserts the first statement of each module under `src/lib/api/transport`, `src/lib/auth`, `src/lib/capabilities/{development-capabilities,server-guard}.ts`, `src/lib/testing/e2e-ui-state.ts` (and the new attestation module) and every `src/features/**/*-service.ts` is `import 'server-only'`.

### F4. IDOR and record-level authorization matrix (D-16, D-17, D-18)

#### F4.1 Served operations and their existing proofs

Conventions from code: policy denial → `policyContext.forbidden(...)` → **403** (`csrm-authorization.ts:133-136`, messages at 255, 261, 268, 272, 291, 317, 329, 340, 363, 373, 376, 397, 409); unauthorised assessment read → **404** (STATE "Notes carried forward"; `assessment-workflow.integration.test.ts:1473`); missing Risk/partial release → no projection (`risk-register.integration.test.ts:528`); no identity → 403 (`authorization.integration.test.ts:424`); no token → the strategy answers 401/403 depending on the route family (`authorization.integration.test.ts:430`; `contract-catalogue.integration.test.ts:768-778` observes 403) — the matrix records the observed status per family rather than assuming one (Open Question 10).

| Family | Routes (file:lines) | Policy shape | Existing mounted proofs (file:line) |
|--------|--------------------|--------------|--------------------------------------|
| Assessment requests (core) | `csrm-assessment-request/routes/csrm-assessment-request.ts:7-63` (find/findOne/create/update/delete), review queue `:67-83`, revert `:85-101`; status summary `my-request-status-summary.ts:13-27` | `requireRequestCollectionScope`, `requireRequestOwnership`, `requireAnalystRequestCollectionScope` | `authorization.integration.test.ts:336, 372, 391, 410, 424, 430`; `request-workflow.integration.test.ts:54, 237, 315`; `assessment-workflow.integration.test.ts:127, 226, 309`; `request-status-summary.integration.test.ts:85, 112, 132, 148` |
| Questionnaires | `csrm-questionnaire/routes/csrm-questionnaire.ts:43-150` (18 routes) | `resource` (ownership + optional release gate), `collection` (owner-scoped for every actor), `review-collection` | `questionnaire-workflow.integration.test.ts:31, 139, 181, 274, 319, 356, 380`; `questionnaire-governance.integration.test.ts:80, 192, 262, 274, 400, 434, 463`; `questionnaire-generation.integration.test.ts:31, 79` |
| Assessments and draft jobs | `csrm-assessment/routes/csrm-assessment.ts:13-78` (11 routes) | exact grant; `requireAssessmentOwnerCollectionScope` for the two My routes | `assessment-workflow.integration.test.ts:58, 113, 345, 458, 539, 1207, 1234, 1253, 1272, 1368, 1473, 1554, 1581, 1700` |
| Risks / Risk Register / pickers / users | `csrm-risk/routes/csrm-risk.ts:30-71` (7 routes) | `requireAnalystRiskRegisterScope` (2), exact grant (3), picker/administration dual (2) | `risk-register.integration.test.ts:70, 96, 469, 499, 528`; `assessment-workflow.integration.test.ts:58, 631, 788`; `authorization.integration.test.ts:321` |
| Control implementations | `csrm-control-implementation/routes/…:13-30` (3) | exact grant | `assessment-workflow.integration.test.ts:928, 1025, 1139` |
| Administration (24) | `csrm-administration/routes/csrm-administration.ts:20-107` | `requireAnalystAdministrationScope`; picker/administration dual on the two list routes | `administration.integration.test.ts:21, 61, 80, 135, 197, 305, 439, 504, 545, 613, 661, 679, 729, 757, 783`; `authorization.integration.test.ts:151, 258, 278` |
| Information systems/assets | core `find` (`csrm-information-{system,asset}/routes/*.ts:4-17`), `selected.ts:13-27` | exact grant; `requireReferenceDataScope` | `authorization.integration.test.ts:447`; `contract-catalogue.integration.test.ts:768-781` |
| Analyst insights (5) | `csrm-analyst-insight/routes/{alerts,dashboard,reports}.ts` | `requireAnalystInsightScope` | six-identity matrices at `analyst-alerts.integration.test.ts:560`, `analyst-reports.integration.test.ts:618`, `analyst-dashboard.integration.test.ts:491` |
| IAM/application core (25) | F1.2 | **none** | token-less 403 only (`contract-catalogue.integration.test.ts:777`) |

Birthright/D-17 proofs today: `request-status-summary.integration.test.ts:85, 112` (owner-scoped for every actor, including the analyst), `assessment-workflow.integration.test.ts:1700` (owner list stays released-only), `questionnaire-workflow.integration.test.ts:31` (owner vs explicit analyst scope), `authorization.integration.test.ts:200-256` (agent never holds revert), `contract-catalogue.integration.test.ts:178-200` (agent never holds generation), `csrm-authorization.ts:34-42, 270-273` (human-analyst-only guard). **The dedicated policy unit proofs in `apps/strapi/tests/authorization.policy.test.js:23-288` (birthright scope for every My-route actor at 134, agent scoping at 166, inactive user at 115, forged relation at 258) never run**: `07-VALIDATION.md` records that `package.json` passes `dist/tests/authorization.policy.test.js`, which no build emits, and Node 24 treats the argument as a glob and skips it silently. Port that file to a compiled `authorization-policy.unit.test.ts` (pattern: `analyst-insight-authorization.unit.test.ts`) and drop the dead argument from the `test` script.

#### F4.2 Matrix design

- **Harness facts** (`apps/strapi/tests/helpers/strapi-http-harness.ts`): one Strapi instance and one SQLite file per test file (`:272-299`, `compileStrapi` + `createStrapi().load()`); identities `owner`, `other`, `analyst`, `agent` (analyst-shaped role name, no grants), `service-agent` (the seeded `Security Analyst Agent` role), `inactive` (`:373-400, 425`) selected by the `x-csrm-test-identity` header (`:92-104`); `request({ path, identity, init, omitApiToken })` (`:923-928`); `simultaneousRequests`; persistence getters `getRequest/getQuestionnaire/getQuestion/getAssessment/getRisk/getControlImplementation`, `countRisksForAssessment`, `countControlImplementationsForRisk`, `countAdministrationRecords`, `getAdministrationRecord` (`:205-261`); fixture builders for every family (`:134-263`). "Maya" is the harness's `other` identity; the browser fixture is `maya.requestor@idambox.com` (`development-session-adapter.ts:29-30`).
- **Layout:** `apps/strapi/tests/fixtures/authorization-matrix.ts` exports rows `{ operation: 'GET:/api/v1/…', request: (f) => ({ path, init }), expect: { owner, other, analyst, serviceAgent, noIdentity, noToken }, persistence?: (f) => Promise<unknown>, provenBy?: 'file.test.ts › test name' }` keyed by the catalogue URL; `apps/strapi/tests/authorization-matrix.integration.test.ts` boots one harness, seeds the workflow/questionnaire/administration fixtures once, and for each row without `provenBy` issues the six requests, asserts the statuses, and for every non-2xx mutation snapshots the target record(s) before and after and `assert.deepEqual`s them (the Phase 6 "denials prove collection persistence" pattern). Record-level rows reuse `requests.otherRequestor`, `questionnaires.otherDraft`, `releaseFacts.crossOwnerComplete` so Maya's attempts on Jane's request, questionnaire and assessment are asserted (403, 403, 404 respectively per today's conventions).
- **Completeness guard:** the test loads `docs/references/served-operations.json` (F1.5) and fails with `MATRIX_ROW_MISSING_<operation>` for any served operation without a row and `MATRIX_ROW_UNSERVED_<operation>` for a row naming nothing served; `provenBy` rows must name an existing test file (assert the file exists and contains the test title) so "referenced, not duplicated" stays checkable.
- **Runtime:** harness boot plus seeding is the fixed cost (tens of seconds); ~100 operations × 6 actors ≈ 600 HTTP calls at tens of milliseconds each; expect 2–4 minutes for the file `[ASSUMED]`, taking the Strapi suite from 8.7 to roughly 12 minutes. Mutations that the matrix must not leave behind (e.g. an owner `PUT`) should use fixtures the file owns.

#### F4.3 Browser-level IDOR (D-18)

- Existing: `apps/web/e2e/assessment-navigation-lifecycle.spec.ts:89-151` — the Secondary Requestor opens Jane's assessment URL in a fresh context and gets "This page could not be found." with no owner facts (lines 135-150), at the project's default viewport only. Extend the same test (or a sibling) to Jane's request (`/app/requests/{id}` → request findOne 403 → shared permission state) and questionnaire (`/app/questionnaires/{id}` → 403 → the questionnaire detail permission copy at `questionnaire-detail.tsx:33`) and run the three URLs at 375 and 1440, asserting no `RAR-`/`QST-`/`ASM-` identifier, title or documentId appears in `body`. Stable fixture titles/numbers come from the seeds (`RAR-DEV-QUES-DRAFT-001`, `ASM-E2E-NAV-OWNER-001`); document ids must be captured from Jane's own navigation as the existing test does (`:128-131`).

### F5. Critical journeys at both widths (D-14, D-15)

#### F5.1 Existing specs mapped to the six journeys

| Journey | Spec and lines | Populated-content assertions today | Widths today | Re-runnable in one database? |
|---------|----------------|------------------------------------|--------------|------------------------------|
| 1. Request create → submit | `requestor-request-workflow.spec.ts:123-313` | Title heading, `Draft` badge, description text (179-187); edit form values (191-197); "Request submitted." and `Submitted` in the actions region (207-211); dashboard lifecycle cards count (289-292); list search/filter/sort at 768 (276-284) | Starts 375 (130); reversal dialogs at 375 and 1440 (217-220, 232-235); list at 768 (276); dashboard at 375/1440 (287-293) | Yes — unique title per run (155) |
| 2. Questionnaire complete → submit | `questionnaire-workflow.spec.ts:158-325` | "0 of N answered" (215), dependent question visibility (216-226), "Draft saved." (230), resume after reload (232-237), validation summary (246-251), "Questionnaire submitted." and read-only answers (260-264), analyst review of the answer (284-285) | Starts 375 (166); 768 (239); reversal dialogs 375/1440 (267-270); 1440 (272) | **No** — mutates the seeded `Customer portal questionnaire draft` and ends re-submitted (314-317); a second pass fails at 215 |
| 3. Assessment draft → review → release | `assessment-release-workflow.spec.ts:99-271` | Queue heading (126), request link count (131), questionnaire answer (154-155), draft lifecycle Queued/Running/Completed (163-168), assessment heading and `Draft` (183-185), `In review` (192), readiness list (194-206), persisted Risk/Control values (213, 238-242), "Assessment released" and `Approved` (269-270) | Starts 375 (107); relationship links at 375 and 1440 (32-46); readiness at both (202-206); release at 1440 (260) | **No** — consumes the seeded submitted `Customer portal security assessment` and releases it |
| 4. Requestor read-only viewing | `assessment-release-workflow.spec.ts:273-307` (after the release) and `assessment-navigation-lifecycle.spec.ts:110-128` (seeded `ASM-E2E-NAV-OWNER-001`) | Released region text (276), identifier link (277-287), "Released risk assessment" heading, article, risk statement, control reference (297-300), no forms/textboxes/comboboxes/mutation buttons (302-305) | 375/1440 loop for the dashboard link (288-292); detail at 1440 | Yes when based on seeds (`ASM-E2E-NAV-OWNER-001`, `ASM-2026-33SAEN`) |
| 5. Risk Register filter → detail → mitigation edit | `risk-register-workflow.spec.ts:151-399` | Heading and lead (167-170), totals equal distinct rows (172-176), "1 result" filters (189-190, 256, 268), empty filtered state (273-274), sort order (282-289), released notice (300-305), persisted Risk comment and mitigation evidence after reload (325-340), Overdue marker (344-348) | Main flow at 1440 (164); geometry sweep at 375/390/430/768/1024/1440 (9, 358-361) incl. cards vs table and filter sheet/popover; 200% zoom at 720 (363-375) | Yes — edits toggle between A/B values (316-336) |
| 6. CSV import preview → commit | `administration-workflow.spec.ts:203-279` | Heading and lead (216-217), five-way counts (238-242), error CSV download name (243-245), "1 unchanged" (247), focused completion heading (250), result counts and two "View record" links (251-254), result CSV (255-257), zero-write ambiguous run (260-271) | Baseline at 375 (37); overflow sweep at 375/768/1280/1440 (219-222); the import itself runs at the last swept width (1440) | **Only with a per-project suffix** — record names use `dylan-test-${process.pid}` (6), which is identical across projects in one run, so a second pass turns "Create 1 / Update 1 / Unchanged 1" into different states |

Sign-in helpers: `requestor-request-workflow.spec.ts:53-63` (`signInAsSecurityAnalyst`) asserts URL and `main` only — violates D-15 and is the class of defect STATE recorded; `app-shell.spec.ts:12-17` likewise. The other helpers assert heading and banner (e.g. `questionnaire-workflow.spec.ts:141-156`, `risk-register-workflow.spec.ts:33-45`, `administration-workflow.spec.ts:24-32`, `accessibility.spec.ts:24-30`). Several helpers still assert `toHaveURL(/\/app$/)` before the shell — harmless once the shell is asserted, but drop it to match D-15's "never the URL".

#### F5.2 What 375px needs

- DataTable renders cards below `md` (768px): `apps/web/src/components/csrm/data-table.tsx:281` (`md:hidden` list) and `:299` (`hidden … md:block` table); the mobile card is `renderMobileCard` per surface. The sidebar becomes the sheet below 1024px (`apps/web/app/globals.css:747-770`; `app-shell.spec.ts:25` `isMobile = viewport.width < 1024`); the trigger is the "Menu" button (`capability-navigation.tsx:119-131`). Journey steps that click table cells or sort headers must switch to card-list locators at 375 (`getByRole('list', { name })` and `listitem`), and steps that use "More filters" must use the `Filters (n)` sheet (`risk-register-filters.tsx:186, 193`).
- Journeys already contain the mobile navigation flow (`requestor-request-workflow.spec.ts:140-151`, `questionnaire-workflow.spec.ts:172-183`, `assessment-release-workflow.spec.ts:113-124`).

#### F5.3 Mechanism and runtime recommendation

- **Recommended hybrid.** Add two Playwright projects in `playwright.config.ts`: `desktop` (`Desktop Chrome`, viewport 1440×900, all specs) and `mobile` (viewport 375×812, `hasTouch: true`, `testMatch` limited to the journey specs, `grep: /@mobile/` or an explicit list). Make the journey specs read their primary width from `test.info().project.use.viewport` and remove hard-coded `setViewportSize` of the primary width (keep deliberate sweeps such as the Risk Register geometry loop and the dialog checks). Run the four re-runnable journeys (1, 4, 5, 6) in both projects, with the CSV suffix changed to include `test.info().project.name`. For the two one-shot journeys (2, 3), assert populated content at 375 and 1440 at each stage inside the single pass (they already do this at 5–7 checkpoints; add the missing stages: questionnaire form at both widths before saving, analyst review at 375; assessment editor and released view at both widths). Record in the UI-SPEC/VERIFICATION that journeys 2 and 3 exercise both widths in one pass because their fixtures are one-shot. Alternative if the planner prefers a pure project split: make journeys 2 and 3 self-seeding through the UI (create a request → generate a questionnaire → release → answer → submit → draft → release), as `questionnaire-generation-workflow.spec.ts:76-110` already does for its first half; that is a larger rewrite with a longer runtime.
- `workers: 1` and `fullyParallel: false` stay (`playwright.config.ts:69, 72`): the journeys share one Strapi database and mutate it; projects run sequentially under one worker.
- **Runtime:** today 49 tests in 7.2 min on `next dev` (`07-09-SUMMARY.md:197`). Adding four mobile journeys (+~4–6 min) and the production build (+1.5–4 min, `[ASSUMED]`) while losing on-demand compilation lands around 12–17 minutes, inside the 30-minute ceiling with margin; measure in the first plan and adjust `test.setTimeout` budgets (some are 600 s: `risk-register-workflow.spec.ts:152`, `administration-workflow.spec.ts:114, 163`).

### F6. Accessibility (D-13, D-25, D-26)

#### F6.1 Coverage of `accessibility.spec.ts` today (213 lines)

- Helper `expectAccessibleAtBothWidths` (`:79-111`) scans at 1440 and 375 (`:94-95`) with `new AxeBuilder({ page }).analyze()` — the default rule set, **not** the D-25 tag list; other specs use `.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` but filter to `serious`/`critical` only (`questionnaire-workflow.spec.ts:39-45`, `assessment-release-workflow.spec.ts:17-23`, `risk-register-workflow.spec.ts:25-31`, `administration-workflow.spec.ts:17-22`, `design-system-conformance.spec.ts`, `design-contract.spec.ts`). D-25 wants the tag list and zero violations.
- Routes covered per actor: analyst — `/app` (test 1, default viewport, `:113-123`), `/app/review/questionnaires/{id}` ×2 (`:126-137`), `/app/review/requests` and `?queue=released` (`:153-161`), `/app/review/requests/{id}` (`:167-169`), `/app/review/assessments/{id}` (`:173-176`), `/app/review` (`:187-188`), `/app/alerts?kind=…` (`:190-191`), `/app/reports` and the four reports (`:193-198`), `/app/admin/risk-types/import` (`:210-212`); Requestor — `/app/questionnaires/{id}` (`:139-144`), `/app/requests/{id}` (`:146-148`), `/app` (`:149-150`), `/app/assessments/{id}` (`:178-181`), and the four Phase 7 refusals (`:201-206`).
- **Not covered** (at both widths with axe, either actor): `/sign-in`; Requestor `/app/requests`, `/app/requests/new`, `/app/requests/{id}/edit`, `/app/questionnaires`, `/app/assessments`; analyst `/app/review/assessments`, `/app/review/questionnaires` (lists), `/app/risks`, `/app/risks/{id}`, `/app/admin/{risk-types,controls,information-systems,information-assets}`, their `/new`, `/{documentId}` and the other three `/import` routes; Requestor refusals for `/app/risks`, `/app/admin/*`, `/app/review/*`; the Secondary Requestor entirely. The conformance and design-contract suites visit most list routes but with the serious/critical filter.
- axe cannot flag 2.5.3 unless `label-content-name-mismatch` is enabled (it is off by default, as 07-UI-REVIEW finding 4 notes); enable it in the sweep via `.options({ rules: { 'label-content-name-mismatch': { enabled: true } } })`.

#### F6.2 D-13: the mid-navigation scan

The helper now waits for the destination URL (`:93`) and then per width polls `document.title !== '' && document.querySelector('h1') !== null && document.querySelector('[data-slot="skeleton"]') === null` (`:96-101`). The remaining window: during a soft navigation the previous page's `<h1>` and title are still in the DOM before `loading.tsx` mounts, so the poll can pass on the page being left (STATE: "The helper's `page.title()` poll does not fully close that window"). The 06.8 test that failed once in a partial run is now `:125-170` (the `:47` in D-13 refers to the pre-rewrite line). Settle deterministically by passing the destination's expected title and level-1 heading name into the helper and asserting them (`toHaveTitle(expected)`, `getByRole('heading', { level: 1, name })` visible), then `toHaveCount(0)` on `[data-slot="skeleton"], [aria-busy="true"]`, after each `setViewportSize`. Every route sets a distinct metadata title (e.g. `Analyst Dashboard | IdamBox CSRM`). Prove with `--repeat-each 5` on that test in isolation plus the full run.

#### F6.3 D-26: the mobile trigger

`apps/web/src/components/shell/capability-navigation.tsx:119-131`: `<Button aria-expanded={open} aria-label="Open navigation" className="mobile-trigger" …><Menu aria-hidden="true" />Menu</Button>` inside `Dialog.Trigger asChild`. Fix: remove `aria-label` so the accessible name is the visible "Menu"; Radix's trigger already exposes `aria-expanded`/`aria-controls`/`aria-haspopup` (`[ASSUMED: Radix Dialog behaviour]` — keep the explicit `aria-expanded` if the unit test needs it). The close control (`:134`, `aria-label="Close navigation"` with visible "Close") passes 2.5.3 because the name contains the visible text. Tests addressing "Open navigation": `mobile-navigation.test.tsx:233, 308, 373, 401`; E2E `app-shell.spec.ts:24, 46`, `assessment-release-workflow.spec.ts:116`, `administration-workflow.spec.ts:41`, `requestor-request-workflow.spec.ts:144, 274`, `questionnaire-workflow.spec.ts:175`, `analyst-insights.spec.ts:250`, `questionnaire-generation-workflow.spec.ts:72` — twelve sites across eight files, which is why D-26 must own its own plan and be serialised with the journey plan.

#### F6.4 Criteria axe cannot decide (conformance record)

| Criterion | Where it applies here | Evidence today | Proof to add |
|-----------|----------------------|----------------|--------------|
| 2.4.11 Focus Not Obscured (Minimum) | Sticky top bar (`globals.css:581`, 56/64 px) and sticky DataTable header (`data-table.tsx:306`); `scroll-mt-10`/`scroll-pt-10` on rows (`:299, 318, 352`) | `mobile-navigation.test.tsx:332`; `risk-register-workflow.spec.ts:290-293`; 07-UI-REVIEW deep-link measurement | Generic E2E check: Tab through each journey page and assert the focused element's rect is below the header's bottom edge |
| 2.5.3 Label in Name | Mobile trigger (F6.3); sort buttons `Sort by {header}` (`data-table.tsx:332`) contain the visible header; `RiskRatingBadge` `aria-label="Severity: low (1 of 4)"` contains the visible "Low" (`risk-rating-badge.tsx:51`); filter chip remove buttons are icon-only | — | Enable `label-content-name-mismatch`; record the reviewed `aria-label` sites |
| 2.5.8 Target Size (Minimum) | Row controls `min-h-6 min-w-6` (`data-table.tsx:328, 352`), card identifier links `min-h-6`/`min-h-11`, `icon-xs` buttons | Phase 06.6 decision (24 px card targets) | axe `target-size` (wcag22aa) plus a recorded list of inline-text exemptions |
| 1.4.10 Reflow | 320 CSS px width | 375 px overflow checks everywhere; 200 % zoom at 720 px (`risk-register-workflow.spec.ts:363-372`) | A 320 px `scrollWidth <= innerWidth` sweep over the journey pages |
| 1.4.12 Text Spacing | All text | — | `page.addStyleTag` with the standard spacing overrides (line-height 1.5, paragraph 2 em, letter 0.12 em, word 0.16 em) then overflow/clipping checks |
| 2.4.7 Focus Visible | `:focus-visible` ring (direction §3.7; `globals.css:401`) | `expectFocusIsVisible` (`risk-register-workflow.spec.ts:47-62`), `expectKeyboardFocus` (`administration-workflow.spec.ts:48-55`) | Share one helper in `e2e/` and apply to each journey's first control |
| 3.2.6 Consistent Help | No help mechanism exists on any page | — | Record as not applicable (nothing to keep consistent) |
| 3.3.7 Redundant Entry | Edit form pre-fills persisted values (`requestor-request-workflow.spec.ts:191-197`); CSV commit re-uploads the same bytes by design (Phase 6 digest binding) | — | Record the re-upload as the security exception the criterion allows |
| 3.3.8 Accessible Authentication (Minimum) | Development sign-in has no cognitive test; real authentication is INT-02 | — | Record as satisfied for the development sign-in and deferred with INT-02 |
| Keyboard operability of dialogs and sheets | Navigation sheet (`app-shell.spec.ts:42-52`, `mobile-navigation.test.tsx:367-401`), confirm dialogs (`requestor-request-workflow.spec.ts:113-117`), filter sheet/popover (`risk-register-workflow.spec.ts:105-110, 119-122`) | Present | Cite; extend to the CSV import dialogs if any |

### F7. Performance (D-24) and dependency hygiene (D-23)

#### F7.1 First-load JavaScript and timings

- `next build` no longer prints bundle sizes: "v16.0.0 — The JS bundle size metrics have been removed from `next build`" [CITED: next.md version table]. The documented replacement is `next experimental-analyze --output`, which writes static files to `<distDir>/diagnostics/analyze` and "does not produce an application build" [CITED: next.md "`next experimental-analyze` options"]; the implementation writes `data/routes.json` there (`build/analyze/index.js:105-117`). The per-route size data format is not documented and was not inspected `[ASSUMED]`; treat it as corroboration, run it with the dev servers stopped and `CSRM_NEXT_DIST_DIR` set.
- Manifests the production build does emit (`shared/lib/constants.js`): `build-manifest.json`, `app-paths-manifest.json`, `app-path-routes-manifest.json`, `routes-manifest.json`, `prerender-manifest.json`, `client-build-manifest.json` (Turbopack), `next-font-manifest`, per-route `*client-reference-manifest*`. Summing chunk sizes from these is possible but Next-internal `[ASSUMED layout]`.
- **Recommended primary method (no new tooling):** a `performance.spec.ts` in the production-build E2E that, per key route (`/app`, `/app/requests`, `/app/requests/{id}`, `/app/questionnaires/{id}`, `/app/review`, `/app/review/assessments/{id}`, `/app/risks`, `/app/risks/{id}`, `/app/reports/risk-exposure`, `/app/admin/controls`), opens a fresh context, records `response` events for `/_next/static/**/*.js` and `.css` (sum `content-length` or body size → "first-load JS/CSS"), reads `performance.getEntriesByType('navigation')[0]` (`responseStart` as TTFB, `domContentLoadedEventEnd`, `loadEventEnd`) and LCP through a buffered `PerformanceObserver` registered in `addInitScript`, repeats five times and records the median into `docs/performance/phase-08-baseline.md` (and asserts only against generous recorded budgets so real regressions fail, e.g. first-load JS ≤ 300 kB gzip per route, TTFB ≤ 500 ms and LCP ≤ 2.5 s on the seeded local database `[ASSUMED budgets — record, then tune]`).

#### F7.2 Dependency audit (run 2026-09-25, `pnpm audit --json` at the workspace root; the lockfile is shared, so one run covers both workspaces)

Totals: 1,383 dependencies (123 dev, 180 optional); advisories: **critical 1, high 6, moderate 19, low 2**.

| Severity | Package (installed → patched) | Path / workspace | Fix |
|----------|-------------------------------|------------------|-----|
| critical | vitest 4.0.18 → ≥4.1.0 (GHSA-5xrq-8626-4rwp, Vitest UI arbitrary file read) | `apps/web` devDependency | Bump to ^4.1.11 (also clears moderate GHSA-82fw-gwwq-j7x9 for vitest and @vitest/mocker); verify `@vitejs/plugin-react` 5.1.1 and jsdom 27.4.0 |
| high | js-yaml 4.3.1 → ≥4.3.2 (GHSA-2883-xcg3-v3hh) | `apps/web` dev via openapi-typescript › @redocly/openapi-core | `pnpm-workspace.yaml` override `js-yaml: 4.3.2` (already resolved elsewhere in the lockfile) |
| high | tar 7.5.20 → ≥7.5.21 (GHSA-r292-9mhp-454m) | `apps/strapi` via @strapi/data-transfer (runtime) | override `tar: 7.5.22` |
| high | nodemailer 9.0.1 → ≥9.1.0 (GHSA-2x7j-588g-ccc2; moderates need ≥9.1.1) | `apps/strapi` via @strapi/provider-email-sendmail | override `nodemailer: ^9.1.1` |
| high ×2 | sharp 0.34.5 → ≥0.35.0 / ≥0.35.4 (GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c; libvips/libheif) | `apps/strapi` via @strapi/upload | override `sharp: 0.35.4` (already in the lockfile for another dependent; `allowBuilds: sharp: true` exists) — boot Strapi and run the suite after |
| high | vite 5.4.21 → ≥6.4.3 (GHSA-fx2h-pf6j-xcff, dev-server `server.fs.deny` on Windows) | `apps/strapi` via @strapi/strapi admin build | **Accepted residual**: pinned by Strapi 5.51; affects the Vite dev server, not the API runtime |
| moderate | esbuild 0.21.5, ajv 8.13.0, undici 6.27.0, qs 6.15.3, dompurify 3.4.11, react-router 6.30.6 (fix is a major), stream-json 1.9.1 (major), vite moderates, turbo 2.8.16 → ≥2.9.14 (root dev; also one low) | Strapi admin/runtime transitive; turbo root | Bump turbo; the rest are recorded residuals (Strapi-pinned) unless an override is a patch-level change |
| low | dompurify 3.4.11 → 3.4.12 | Strapi admin | Residual |

Record the residual table in `docs/security/dependency-audit-phase-08.md` with advisory ids and reasons; re-run `pnpm audit` in the phase gate. No new runtime dependency is introduced.

### F8. INT-03 re-verification (D-07, D-08, D-09)

#### F8.1 Hermetic suites to run and cite

| Property | Strapi suite (file:line) | Web / E2E (file:line) |
|----------|--------------------------|-----------------------|
| Provenance recorded (provider name/version, initiating analyst) | `ai-provider-questionnaire.unit.test.ts:68` (selection defaults safely, persistence records provenance); `ai-provider-assessment.unit.test.ts:70`; `questionnaire-generation.integration.test.ts:31` | `assessment-actions.test.ts:85` |
| Job states queued/running/completed/failed, single-flight, retry only via authorised event | `assessment-workflow.unit.test.ts:224, 253, 287, 306`; `ai-provider-guardrails.unit.test.ts:79, 95, 102`; `questionnaire-generation.unit.test.ts:29, 45, 83`; `assessment-workflow.integration.test.ts:345, 1272` | `assessment-review-workflow.test.tsx:266-331` (bounded job: no duplicate start, one poll, announcements, retry only when failed, 30-s budget); `questionnaire-generation-job.test.tsx:55-153`; E2E `assessment-release-workflow.spec.ts:160-168` |
| Human modification kept, review withdrawn on edit | `assessment-workflow.unit.test.ts:409`; `assessment-workflow.integration.test.ts:458, 1581` | `assessment-actions.test.ts:121, 147` |
| Failure and retry taxonomy (safe, typed, observable) | `ai-provider-failures.unit.test.ts:85-86`; `assessment-workflow.integration.test.ts:1207, 1234`; `ai-provider-boot.unit.test.ts:16-32` | `assessment-review-workflow.test.tsx:320, 331` |
| Prompt-injection posture, no release-shaped output | `ai-provider-guardrails.unit.test.ts:23, 37, 51, 61, 65`; `assessment-workflow.unit.test.ts:160, 179` | — |
| No automatic release; release is a human-analyst explicit act | `HUMAN_ANALYST_ONLY_OPERATIONS` (`csrm-authorization.ts:34-42, 270-273`); `assessment-workflow.integration.test.ts:1253` (zero-mapping draft persists unreleasable), `1368` (release readiness-gated, atomic), `1554` | `assessment-actions.test.ts:204`; E2E `assessment-release-workflow.spec.ts:185, 264-271` |
| Deterministic provider pinned in every automated run | harness `strapi-http-harness.ts:289`; `playwright.config.ts:98` | — |

`CSRM_AI_*` configuration surface: `apps/strapi/config/ai.ts:3-22` (read-only for this phase; D-07).

#### F8.2 D-08 copy sites

- `apps/web/src/features/assessments/assessment-draft-job.tsx:204` heading "Deterministic draft assistance"; `:211` button "Start deterministic draft assistance"; `:55` running copy "Deterministic draft assistance is preparing a reviewable proposal."; `:205` (already neutral: "Draft initiated by the signed-in analyst and always subject to analyst review."); the `statusCopy` at `:36-41` and the lifecycle list label `Draft assistance lifecycle` (`:64`) are already provider-neutral.
- Tests that assert the old copy: `assessment-review-workflow.test.tsx:278` (`getByRole('button', { name: 'Start deterministic draft assistance' })`), E2E `assessment-release-workflow.spec.ts:160`. The E2E assertion at `:276` ("Deterministic assessment assistance identified 3 reviewable risk proposals.") is the **persisted summary written by the deterministic provider** (`deterministic-assessment-draft-provider.ts:158`), i.e. recorded provenance naming its own source — it stays.
- The questionnaire generation card is already neutral ("Questionnaire generation", "Generate questionnaire", `questionnaire-generation-job.tsx:36-39, 169, 184-185`) and is the pattern to mirror; the UI-SPEC fixes the exact strings (suggested: heading "Draft assistance", button "Start draft assistance", running "Draft assistance is preparing a reviewable proposal.", plus the advisory sentence).

#### F8.3 D-09 ordering mismatch and fix

- Parser: `apps/strapi/src/api/csrm-assessment/services/assessment-draft-provider.ts:99-100` rejects when `risks[index - 1].riskTypeName > risk.riskTypeName` (UTF-16 code-unit order; uppercase sorts before lowercase); `:89` applies the same code-unit rule to `suggestedControlNumbers`.
- Deterministic provider: `deterministic-assessment-draft-provider.ts:144` sorts with `left.riskTypeName.localeCompare(right.riskTypeName)` (locale order: "alpha risk" before "Beta risk"), so a mixed-case Risk Type set would fail the parser it then calls at `:155`.
- OpenAI-compatible adapter: `openai-compatible-assessment-draft-provider.ts:41-58` sorts with a local `compareCodeUnits` (matches the parser); tested at `ai-provider-assessment.unit.test.ts:75-88` (expects `["Beta risk", "alpha risk"]`).
- **Fix design:** export `compareRiskTypeNames(left, right)` (code-unit) and `sortRiskProposals(risks)` from `assessment-draft-provider.ts`; use them in the parser's check (`:99-100`), in the deterministic provider (`:144`) and in the adapter (replace `:41-56`); add a unit test that runs the deterministic provider with `riskTypes` named e.g. `"alpha risk"`, `"Beta risk"`, `"Gamma"` and asserts the parser accepts its output and the order is code-unit; keep the adapter test. The control-number sorts (`deterministic…:55`, adapter `:55`) already use the default code-unit sort.

### F9. Follow-ups carried forward (D-27 to D-33)

#### F9.1 D-27 status badges

- Shared tinted recipe exists only for request statuses: `apps/web/src/components/csrm/status-badge.tsx:30-66` (`statusPresentations`, icon + tinted classes; `draft`/`closed` use the muted tint). `Badge` already has semantic variants `info`, `success`, `muted`, `danger`, `warning` (`components/ui/badge.tsx:21-25`).
- Neutral outline chips today: `features/assessments/assessment-list.tsx:38-48` (`AssessmentStatusBadge`, `<Badge variant="outline">`); `features/assessments/assessment-editor.tsx:167` (assessment status in the page header with the muted classes for every status); `features/risks/risk-register.tsx:61-65` (`TreatmentStatus` outline, `AlertTriangle` for Overdue — the High severity icon, contrary to direction §4 "never the High severity triangle"); `features/risks/risk-details.tsx:102` ("Released — read only" outline). Not statuses (may stay neutral tags): `released-assessment.tsx:55, 93` "Rating not recorded", `assessment-draft-job.tsx:207` / `questionnaire-generation-job.tsx:187` "Attempt n", `requestor-dashboard.tsx:214` "Not rated".
- Duplicated tinted mappings (brief §25 "avoid duplicate status mappings"): questionnaire state in `questionnaire-list.tsx:~25-31` and `requestor-dashboard.tsx:30-48`, review state in `questionnaire-review-list.tsx:~40-50`, inline badges in `questionnaire-detail.tsx:41`, `questionnaire-review.tsx:69, 79`, `released-assessment.tsx:186`; `assessment-domain.ts` `assessmentStatusPresentation` carries icon and label without tone.
- Design: one `status-badge.tsx` module exporting a generic `StatusBadge<Vocabulary>` (or `WorkflowStatusBadge`) fed by exhaustive `satisfies Record<…>` tables per vocabulary — request status (existing), assessment status (`draft` muted / `in-review` warning / `approved` success / `closed` muted), questionnaire state (`not-started` muted / `draft` info / `submitted` success), treatment status (`Not Started` muted / `In Progress` info / `Complete` success / `Overdue` danger with an icon that is neither a severity nor an urgency icon — UI-SPEC decides), each using `Badge` variants. Tests: exhaustive vocabulary → tone/icon unit test; `risk-register.test.tsx:108, 138, 194`, `assessment-list.test.tsx`, `design-contract.spec.ts` (cross-surface) keep passing.

#### F9.2 D-28 Risk Register layout

- Filter bar: `features/risks/risk-register-filters.tsx:173-181` — grid `md:grid-cols-2 lg:grid-cols-4`; the search `<form>` spans `md:col-span-2 lg:col-span-1` and holds the label+input (`flex-1`) **and** the "Search Risks" submit button side by side, so at 1024 px (`lg`) the form gets one quarter of the row minus the button, leaving the input roughly 45 px with a wrapped label. Fix inside existing breakpoints (no new value): at `lg` give the search form the full first row (`lg:col-span-4`, selects on the next row) and reserve the 4-up row for `xl`; or `lg:grid-cols-3` with the search spanning three. The UI-SPEC fixes the behaviour; the direction document already holds the breakpoints.
- Statement column: `features/risks/risk-register.tsx:125` wraps the statement in `RecordLink className="line-clamp-2"`, but `TableCell` sets `whitespace-nowrap` (`components/ui/table.tsx:86`; `TableHead` at `:73`), so the text never wraps, the clamp is inert and the column grows until six of eight columns overflow. Fix: a `wrap?: boolean` column option in `DataTableColumn` (`data-table.tsx:35-42`) that adds `whitespace-normal` (and a measure) to that column's cells (`:358-369`); record the statement measure as a CSRM extension if a fixed `max-w` is chosen (Open Question 14). Test: `risk-register.test.tsx:108` extended with the wrap class; E2E at 1440 asserting the register region's `scrollWidth <= clientWidth` with the seeded long statement (`RSK-DEV-MUTABLE-001`).

#### F9.3 D-29 DataTable scroll region and cue

- Today the region is opt-in: `data-table.tsx:289-301` sets `role="region"`, `aria-label="{ariaLabel}, scrolls horizontally"`, `tabIndex={0}` and the focus ring only when `stickyFirstColumn` (used by the Risk Register, `risk-register.tsx:137`); test `data-table.test.tsx:235`. Reports' cross-tab uses the `Table` primitive's own `overflow-x-auto` container (`ui/table.tsx:10-11`, `data-slot="table-container"`).
- Design: measure overflow in the client component (`ResizeObserver` in `useLayoutEffect` comparing `scrollWidth > clientWidth`) and, when overflowing, apply the region semantics and `tabIndex` unconditionally; toggle `data-overflow-start`/`data-overflow-end` on scroll for a CSS scroll-edge cue (an inset fade from `--color-bg-surface` to transparent at the hidden edge, no shadow, per the direction's "no shadows" rule — values to be recorded in §4 DataTable as a CSRM extension, D-29). Put the cue and region into a small shared `ScrollRegion` used by DataTable and by `report-table.tsx`, so 07-UI-REVIEW finding 2 (cross-tab at 375 px) is settled by the same primitive. Direction text today: "The scroll container is a labelled, keyboard-scrollable region" and "a 1px `--color-border-default` right hairline with no shadow" (§4 DataTable) — the cue needs the extension. Tests: unit with mocked `scrollWidth`/`clientWidth` (jsdom has no layout), E2E at 1024 px on the register (overflows) asserting focusability, `ArrowRight` scrolls, and the cue attribute; and a non-overflowing table has no region.

#### F9.4 D-30 search labels

- "Search collection" occurs twice: `features/assessments/assessment-list.tsx:254` (assessment request review list → "Search assessment requests") and `:309` (assessment review list → "Search risk assessments"); the `Controls` component takes `label`. Other surfaces already name records ("Search requests" `requestor-request-workflow.spec.ts:277`, "Search Risks" `risk-register-filters.tsx:176-177`, "Search Controls" `administration-workflow.spec.ts:123`). Tests: `assessment-list.test.tsx`, `assessment-status-filters.test.tsx`, `assessment-review-workflow.test.tsx`; no E2E spec references the old label.

#### F9.5 D-31 revision timeline actor

- The stored record **does** identify the actor: each governance event stores `by` = the acting analyst's documentId (`questionnaire-governance-log.ts:37-45, 116`; writers `questionnaire-governance-workflow.ts:317, 358, 437`). The projection deliberately emits `displayName: null` (`questionnaire-scope.ts:278-289`: "resolving the name needs a lookup this projection does not perform"), the contract already allows an actor object (`QuestionnaireRevisionTimelineEvent.by: QuestionnaireReleaseActor | null` in `specification.json`), `idambox-user` has `displayName`, and the web falls back to "An analyst" (`questionnaire-revision-timeline.tsx:25-27`). **No datamodel gap and no contract change**: in the controller/service that calls `projectGovernanceEvents` (`controllers/csrm-questionnaire.ts:346`), collect the distinct `by` ids, look them up once with `strapi.documents('api::idambox-user.idambox-user').findMany({ filters: { documentId: { $in } }, fields: ['documentId', 'displayName'] })`, and pass a resolver into the projection; unknown or inactive ids stay `null` so the fallback copy remains. Requestor projections keep omitting `by` (analyst-only detail). Tests: extend `questionnaire-governance.integration.test.ts:434` and `questionnaire-revision-timeline.test.tsx:19`.

#### F9.6 D-32 questions rendered twice

- Root cause: `features/questionnaires/questionnaire-review.tsx:69` (the `analyst-review` branch) renders `<QuestionnaireGovernance definition={…}>` — whose "Question editor" lists every question with Edit/Delete (`questionnaire-governance.tsx:71-72`) — **and** `<QuestionnaireRenderer … mode="read-only">`, which renders every question again as `ReadOnlyQuestion` (`questionnaire-renderer.tsx:337, 219`). The `submitted` branch (`:92-95`) has no duplication because the governance panel shows only the return control after release (`questionnaire-governance.tsx:75`). Fix: in the analyst-review state render the questions once — the governance editor owns the list (no answers exist to show) and the renderer is not mounted; the UI-SPEC records the choice. Tests: `questionnaire-governance.test.tsx:13`, a new assertion in `questionnaire-workflow.test.tsx` ("Security Analyst questionnaire review", `:267+`) that each question text appears exactly once, and the 06.8 accessibility route.

#### F9.7 D-33 print

- No `@media print` exists (`grep` over `apps/web/app/globals.css` and `apps/web/src`). Shell selectors to hide or reflow: `.skip-link` (`globals.css:474`), `.shell` (`:488`, grid), `.shell-content` (`:493`), `.sidebar` (`:496`), `.shell-footer` (`:504`), `.header` (`:581`, sticky), `.page` (`:610`), `.mobile-trigger` (`:696`), plus `[data-sonner-toaster]` and Radix portals. Print rules: hide sidebar/header/mobile trigger/skip link/toaster; make `.shell` block and `.page` unpadded; drop sticky positioning; let overflow regions expand (`overflow: visible`) and clamps release (`-webkit-line-clamp: unset`); `break-inside: avoid` on cards and table rows; keep light tokens. Page margins are a value the direction document lacks (record as a CSRM extension, D-33). Proof: Playwright `page.emulateMedia({ media: 'print' })` on a report and a detail route asserting `.sidebar`/`.header` hidden and main content visible; optionally a `page.pdf()` smoke.

## Architecture Patterns

### System Architecture Diagram

```
                    Playwright 1.58.2 (workers: 1; projects desktop 1440 / mobile 375)
                    ├─ webServer[0]: strapi develop  (NODE_ENV=development, isolated SQLite,
                    │                  CSRM_DEV_IDENTITY=true, CSRM_AI_PROVIDER=deterministic)
                    └─ webServer[1]: next build && next start  (NODE_ENV=production,
                                       CSRM_NEXT_DIST_DIR=.tmp/…, tsconfig.e2e.json,
                                       CSRM_E2E_RUNTIME_* attestation, harness flag)
                                                      │
   browser request ──► proxy.ts ── nonce ──► CSP + x-nonce ──► App Router (all routes dynamic)
                        │                                        │
                        │  static headers from next.config       ├─ (app)/layout: session? ─► attested runtime gate
                        │  (nosniff, XFO, Referrer, COOP, HSTS)   │        │ yes: development cookie session
                        │                                        │        │ no : UnavailableSessionAdapter (fail closed)
                        │                                        ├─ page → *-service.ts (server-only)
                        │                                        │        └─ openapi-fetch client (typed paths)
                        │                                        │             ├─ Authorization: Bearer <full-access token>
                        │                                        │             └─ x-csrm-dev-identity (only when the gate holds)
                        │                                        ▼
                        │                              Strapi /api (koa): errors → dev-identity → security → cors → …
                        │                                        ├─ content-api-token strategy (full-access ⇒ no scope check)
                        │                                        ├─ global::csrm-app-enabled
                        │                                        ├─ global::csrm-authorization (Role→Function→FunctionAPI,
                        │                                        │      record scope, human-analyst guard)
                        │                                        └─ controller/service → SQLite/Postgres
                        ▼
   proofs: headers + zero CSP violations · journeys × 2 widths · axe (5 tags) · perf accounting
           · client-chunk scan (no server env) · git status --porcelain empty
   static guards: served-operations.json ⇄ routers ⇄ spec ⇄ catalogue ⇄ web call sites
                  authorization matrix (6 actors × every served operation, persistence unchanged)
```

### Recommended Project Structure (additions only)

```
apps/web/
├── proxy.ts                                   # nonce CSP per request (Next 16 proxy convention)
├── tsconfig.e2e.json                          # { "extends": "./tsconfig.json" } — stops Next's include rewrite
├── next.config.ts                             # headers(), poweredByHeader:false, typescript.tsconfigPath switch
├── app/global-error.tsx, app/not-found.tsx    # root boundaries with safe copy
├── src/lib/testing/e2e-runtime-attestation.ts # extracted attestation check (no harness flag)
├── src/lib/auth/development-runtime.ts        # resolveSessionRuntimeMode(env) used by session, sign-in, transport
├── src/features/contract-operation-chain.test.ts
├── src/lib/security/server-only-boundary.test.ts
├── src/components/csrm/status-badge.tsx       # one status-to-tone mapping for every vocabulary
├── src/components/csrm/scroll-region.tsx      # labelled, focusable overflow region + edge cue (DataTable + report tables)
└── e2e/production-hardening.spec.ts, e2e/performance.spec.ts, e2e/helpers/{settle,focus}.ts
apps/strapi/
├── tests/served-operations.unit.test.ts       # routers → docs/references/served-operations.json (drift-checked)
├── tests/authorization-matrix.integration.test.ts + tests/fixtures/authorization-matrix.ts
├── tests/authorization-policy.unit.test.ts    # port of the never-running authorization.policy.test.js
└── src/api/{function,function-api,idambox-user,role}/routes/*.ts → only: []   (security decision)
docs/
├── references/served-operations.json
├── security/dependency-audit-phase-08.md, security/web-headers.md
├── accessibility/wcag-2.2-aa-conformance-phase-08.md
└── performance/phase-08-baseline.md
```

### Pattern 1: Attested development runtime under a production build (D-11)

**What:** one server-only predicate decides whether the development session and identity bridge exist; `next dev` behaviour is unchanged; a production build gets them only inside the attested E2E runtime.
**When to use:** the session adapter, the sign-in page and the transport — nowhere else.

```ts
// apps/web/src/lib/auth/development-runtime.ts  (server-only)
import 'server-only';
import { isAttestedE2eRuntime } from '@/lib/testing/e2e-runtime-attestation';

export type SessionRuntimeMode = 'development' | 'unavailable';

export function resolveSessionRuntimeMode(env: NodeJS.ProcessEnv): SessionRuntimeMode {
  if (env.NODE_ENV === 'development') return 'development';          // unchanged path
  if (env.NODE_ENV !== 'production') return 'unavailable';
  if (env.CSRM_ENVIRONMENT !== 'development') return 'unavailable';  // each gate alone fails closed
  if (env.CSRM_DEV_IDENTITY !== 'true') return 'unavailable';
  return isAttestedE2eRuntime(env) ? 'development' : 'unavailable';
}
```

`isAttestedE2eRuntime` is the body of `e2e-ui-state.ts:36-54` (root under `os.tmpdir()/csrm-playwright-e2e`, attestation file inside the root, nonce match, age under one hour) without the `CSRM_E2E_UI_STATE_HARNESS` check, which stays in `e2e-ui-state.ts` for the fixture-state boundary only.

### Pattern 2: Nonce CSP in `proxy.ts` plus static headers in `next.config.ts` (D-19)

```ts
// apps/web/proxy.ts  — Source: apps/web/node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",      // sonner injects a <style> element; recorded residual
    "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);   // Next reads the nonce from here
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [{
    source: '/((?!_next/static|_next/image|icon.png).*)',
    missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }],
  }],
};
```

```ts
// apps/web/next.config.ts additions — Source: …/05-config/01-next-config-js/headers.md, poweredByHeader.md, typescript.md
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  typescript: { tsconfigPath: process.env.CSRM_NEXT_DIST_DIR ? 'tsconfig.e2e.json' : 'tsconfig.json' },
  ...(process.env.CSRM_NEXT_DIST_DIR ? { distDir: process.env.CSRM_NEXT_DIST_DIR } : {}),
  async headers() { return [{ source: '/(.*)', headers: securityHeaders }]; },
};
```

### Pattern 3: Build-then-start webServer (D-10)

```ts
// apps/web/playwright.config.ts (web entry) — Playwright runs the command in a shell (webServerPlugin.js:95)
{
  command: `${runPnpm('exec next build')} && ${runPnpm(`exec next start --hostname 127.0.0.1 --port ${webPort}`)}`,
  env: {
    NODE_ENV: 'production', CSRM_ENVIRONMENT: 'development', CSRM_DEV_IDENTITY: 'true',
    CSRM_API_BASE_URL: strapiApiBaseUrl, CSRM_API_TOKEN: developmentApiToken,
    CSRM_NEXT_DIST_DIR: isolatedNextDistDir, CSRM_E2E_UI_STATE_HARNESS: '1',
    CSRM_E2E_RUNTIME_ROOT: e2eRuntimeRoot, CSRM_E2E_RUNTIME_ATTESTATION_PATH: e2eRuntimeAttestationPath,
    CSRM_E2E_RUNTIME_NONCE: e2eRuntimeNonce,
  },
  url: `${webOrigin}/sign-in`,          // 200 only when the attested gate holds (404 otherwise → launch timeout)
  reuseExistingServer: false,
  timeout: 900_000,                      // build + start; measure and tighten
  gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
}
// expose for specs: process.env.CSRM_E2E_NEXT_DIST_DIR ??= isolatedNextDistDir;
```

### Pattern 4: Static chain guard (D-04)

```ts
// apps/web/src/features/contract-operation-chain.test.ts (sketch)
const CALL = /client\.(GET|POST|PUT|PATCH|DELETE)\(\s*([^,)]+)/g;
for (const file of serviceFiles) {
  const source = readFileSync(file, 'utf8');
  const constants = new Map([...source.matchAll(/const (\w+) = '(\/[^']+)' as const/g)].map((m) => [m[1], m[2]]));
  for (const [, method, argument] of source.matchAll(CALL)) {
    const path = argument.startsWith("'") ? argument.slice(1, -1) : constants.get(argument.trim());
    expect(path, `NON_LITERAL_CLIENT_PATH ${file}: ${argument}`).toBeDefined();
    const key = `${method} ${path}`;
    expect(specOperations.has(key), `NOT_IN_SPEC ${key}`).toBe(true);
    expect(served.byKey.has(key), `NOT_SERVED ${key}`).toBe(true);
    expect(served.byKey.get(key)!.functionApiIds.length > 0 || allowedUncatalogued.has(key), `NOT_CATALOGUED ${key}`).toBe(true);
  }
}
```

### Pattern 5: Authorization matrix row (D-16)

```ts
// apps/strapi/tests/fixtures/authorization-matrix.ts (sketch)
export const rows: MatrixRow[] = [
  {
    operation: 'PATCH:/api/v1/questionnaires/{questionnaireId}/answers',
    request: (f) => ({ path: `/api/v1/questionnaires/${f.questionnaires.otherDraft}/answers`,
      init: { method: 'PATCH', headers: json, body: JSON.stringify({ data: { answers: [] } }) } }),
    expect: { owner: 403, other: 200, analyst: 403, serviceAgent: 403, noIdentity: 403, noToken: 403 },
    persistence: (f) => harness.getQuestionnaire(f.questionnaires.otherDraft),   // deep-equal before/after every denial
  },
  { operation: 'GET:/api/v1/alerts', provenBy: 'analyst-alerts.integration.test.ts › both alert operations refuse every identity other than the human analyst' },
];
```

### Anti-Patterns to Avoid

- **Restoring `tsconfig.json`/`next-env.d.ts` after a run** (the current documented workaround, `playwright.config.ts:22-26`): D-12 requires stopping the rewrite; a restore step hides regressions.
- **A URL assertion as a sign-in assertion** (`requestor-request-workflow.spec.ts:61`, `app-shell.spec.ts:15`): `/sign-in?returnTo=/app` matches `/\/app$/`.
- **Enabling the development session on a production build by `NODE_ENV` alone or by the harness flag alone**: every gate must fail closed independently (D-11), and the session gate must not depend on `CSRM_E2E_UI_STATE_HARNESS` (F2.5).
- **A nonce in `style-src` together with `'unsafe-inline'`**: CSP3 browsers ignore `'unsafe-inline'` when a nonce is present, which would block sonner's injected stylesheet.
- **`upgrade-insecure-requests` or HSTS `preload`** in the E2E CSP/headers: the suite runs on `http://127.0.0.1`.
- **Per-file status mappings in JSX** (`assessment-list.tsx:38-48`, `risk-register.tsx:61-65`): D-27 wants one table; brief §25 forbids duplicate status mappings.
- **A mobile Playwright project over the one-shot journeys** without making them re-runnable (F5.1).
- **Process-pid-only fixture suffixes** (`administration-workflow.spec.ts:6`) when a spec runs in more than one project.
- **Reading `error.message` in boundaries or reflecting Strapi error bodies into the UI**: production digests are generic by design; keep the shared safe copy.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Per-request CSP nonce plumbing | Manual `<script nonce>` on every element or a custom document | `proxy.ts` + `x-nonce` header; Next applies the nonce to its inline scripts | Documented behaviour [CITED: content-security-policy.md "How nonces work"] |
| Stopping the tsconfig rewrite | A post-run `git checkout` or a patched `include` list | `typescript.tsconfigPath` → tsconfig with `extends` | Next bails on `extends` before writing (`writeConfigurationDefaults.js:238-240`) |
| Route type generation before `tsc` | Committing `next-env.d.ts` | `next typegen && tsc --noEmit` | Documented recommendation [CITED: next.md] |
| Waiting for a settled route before axe | `waitForTimeout` | `toHaveURL` + `toHaveTitle` + level-1 heading + no skeleton/busy | Web-first assertions retry deterministically |
| Sequential multi-server startup | Custom `globalSetup` spawning servers | `webServer: [...]` (plugins set up in order) | `tasks.js:139-147` |
| Fixture identities for the matrix | New seed users | Harness identities `owner/other/analyst/agent/service-agent/inactive` | `strapi-http-harness.ts:373-425` |
| Vulnerability lookup | Manual CVE lists | `pnpm audit --json` + `pnpm-workspace.yaml` overrides | Registry advisories; override precedent exists |
| Accessibility rule coverage | Hand-written contrast/label checks | axe with the five WCAG tags, `label-content-name-mismatch` enabled | axe decides what it can; the record covers the rest |
| Bundle-size table | Parsing Next-internal manifests first | Playwright network accounting, `next experimental-analyze --output` as corroboration | Sizes measured as delivered; the CLI is documented |

**Key insight:** every mechanism this phase needs is either a Next/Playwright configuration switch or a generalisation of a test pattern already in the repository; the risk is in ordering and file ownership, not invention.

## Runtime State Inventory

Not a rename or migration phase; the only runtime state that matters is what a test run writes. Answered explicitly:

| Category | Items found | Action |
|----------|-------------|--------|
| Stored data | Isolated SQLite per Playwright run (`.tmp/playwright-e2e-<uuid>.db`, `playwright.config.ts:37`) and per Strapi test file (`apps/strapi/.tmp/authorization-http/*.sqlite`) | None (ignored paths) |
| Live service config | None — verified: no external service is configured for tests | None |
| OS-registered state | None — verified: no scheduled tasks or services; Strapi cron is destroyed in the harness (`strapi-http-harness.ts:315`) | None |
| Secrets/env vars | `apps/web/.env.local`, `apps/strapi/.env` exist on this VM (not read); E2E sets its own env | Never print; the D-22 scan uses names and the run's own values only |
| Build artefacts | `apps/web/.tmp/*` dist dirs (ignored), `apps/strapi/dist` (ignored), tracked `apps/strapi/types/generated/*.d.ts` regenerated at boot | Watch the tracked generated types in the `git status` proof |

## Common Pitfalls

### Pitfall 1: The production webServer "hangs" instead of failing
**What goes wrong:** with `NODE_ENV=production`, `/sign-in` returns 404 until D-11 lands; Playwright treats only 200–403 as ready (`network.js:195`) and waits the whole `timeout`.
**How to avoid:** implement the gate first; keep `/sign-in` as the readiness URL; add a first test that asserts `GET /sign-in` is 200 with a message naming the gate.
**Warning signs:** "Timed out waiting 600000ms from config.webServer".

### Pitfall 2: The rewrite returns through the "ordinary" server
**What goes wrong:** `design-system-conformance.spec.ts:161-163` spawns `next dev` with its own `CSRM_NEXT_DIST_DIR` and the working-tree diff already shows `.tmp/ordinary-next-3521` entries.
**How to avoid:** key `typescript.tsconfigPath` on `CSRM_NEXT_DIST_DIR` (any isolated dist dir ⇒ `tsconfig.e2e.json`), not on a Playwright-only flag.

### Pitfall 3: `tsc` fails on a fresh clone after untracking `next-env.d.ts`
**What goes wrong:** CSS/image module declarations come from `/// <reference types="next" />` in `next-env.d.ts`.
**How to avoid:** `typecheck`/`lint` run `next typegen && tsc --noEmit`; the orchestrator's `pnpm --filter @csrm/web typecheck` command keeps working.

### Pitfall 4: Journeys 2 and 3 cannot run twice
**What goes wrong:** a mobile project re-runs a spec that already submitted the seeded questionnaire or released the seeded request.
**How to avoid:** in-spec width checkpoints for those two, or self-seeding through the UI (F5.3).

### Pitfall 5: CSV import states drift across projects
**What goes wrong:** `dylan-test-${process.pid}` is identical in both projects; the second run sees existing records.
**How to avoid:** include `test.info().project.name` in the suffix.

### Pitfall 6: Sonner and `style-src`
**What goes wrong:** a nonce-only `style-src` blocks the `<style>` sonner injects at module load; every page logs a violation and D-19's "zero violations" fails.
**How to avoid:** `style-src 'self' 'unsafe-inline'` with the reason recorded; keep scripts strict.

### Pitfall 7: HSTS/upgrade directives on plain HTTP
**What goes wrong:** `upgrade-insecure-requests` upgrades E2E requests to `https://127.0.0.1` and everything fails to load.
**How to avoid:** omit it; HSTS itself is ignored over HTTP and can stay.

### Pitfall 8: The completeness guard explodes on the IAM routers
**What goes wrong:** 25 un-policied core routes need matrix rows and the token-holding actor gets 200 on all of them.
**How to avoid:** decide the router hardening (F1.2) in the inventory plan before the matrix plan.

### Pitfall 9: Twelve "Open navigation" locators
**What goes wrong:** D-26 flips the trigger name; any spec edited concurrently in another plan reintroduces the old name.
**How to avoid:** one plan owns the rename across the eight files and runs before the journey and accessibility plans.

### Pitfall 10: Playwright projects and shared state
**What goes wrong:** two projects with `workers: 1` still run sequentially, but `fullyParallel` or per-project workers would interleave mutations on one Strapi database.
**How to avoid:** keep `workers: 1`, `fullyParallel: false`; order projects desktop → mobile.

### Pitfall 11: The parity guard's boundary mode surfaces hundreds of narrowings
**What goes wrong:** ~350 `min`/`max` sites across feature schemas fail at once.
**How to avoid:** ship the mode first with the Phase 7 components in scope, then widen deliberately; decide contract bounds family by family.

### Pitfall 12: `authorization.policy.test.js` still never runs
**What goes wrong:** D-17 evidence cites a file that Node skips.
**How to avoid:** port it to a compiled `.unit.test.ts` and remove the dead argument from the `test` script.

## Code Examples

### Settle helper for axe scans (D-13)

```ts
// apps/web/e2e/helpers/settle.ts
export async function expectSettled(page: Page, expected: { url: RegExp; title: string | RegExp; heading: string }) {
  await expect(page).toHaveURL(expected.url);
  await expect(page).toHaveTitle(expected.title);
  await expect(page.getByRole('heading', { level: 1, name: expected.heading, exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"], [aria-busy="true"]')).toHaveCount(0);
}
```

### CSP violation collector and header assertions (D-19)

```ts
await page.addInitScript(() => {
  (window as unknown as { __cspViolations: string[] }).__cspViolations = [];
  document.addEventListener('securitypolicyviolation', (event) => {
    (window as unknown as { __cspViolations: string[] }).__cspViolations.push(`${event.violatedDirective}: ${event.blockedURI}`);
  });
});
// … journey steps …
expect(await page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations)).toEqual([]);

const response = await page.request.get('/sign-in');
const headers = response.headers();
expect(headers['x-powered-by']).toBeUndefined();
expect(headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=_-]+' 'strict-dynamic'/);
expect(headers['content-security-policy']).not.toContain("'unsafe-eval'");
expect(headers['x-frame-options']).toBe('DENY');
```

### Client-chunk scan (D-22)

```ts
const distDir = process.env.CSRM_E2E_NEXT_DIST_DIR!;
const forbidden = ['CSRM_API_TOKEN', 'CSRM_API_BASE_URL', 'CSRM_DEV_IDENTITY', 'CSRM_E2E_RUNTIME_NONCE',
  'CSRM_E2E_RUNTIME_ROOT', 'CSRM_E2E_RUNTIME_ATTESTATION_PATH', 'CSRM_E2E_UI_STATE_HARNESS', 'CSRM_NEXT_DIST_DIR',
  'x-csrm-dev-identity', 'csrm-playwright-development-only', process.env.CSRM_E2E_RUNTIME_NONCE!];
for (const file of walk(join(distDir, 'static'), /\.(js|css)$/)) {
  const text = readFileSync(file, 'utf8');
  for (const needle of forbidden) expect(text.includes(needle), `${file} contains ${needle}`).toBe(false);
}
```

### Navigation timing sample (D-24)

```ts
const timing = await page.evaluate(() => {
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  return { ttfb: nav.responseStart, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd };
});
```

## State of the Art

| Old approach | Current approach (Next 16.3.3) | When changed | Impact |
|--------------|-------------------|--------------|--------|
| `middleware.ts` / `middleware()` | `proxy.ts` / `proxy()` (Node.js runtime) | v16.0.0 [CITED: proxy.md] | D-19 file and export names |
| `next build` prints per-route first-load JS | Metrics removed; `next experimental-analyze` (v16.1.0) | v16.0.0 / v16.1.0 [CITED: next.md] | D-24 measurement method |
| TypeScript JS API type-check during build | Project-local `tsc` CLI by default (`experimental.useTypeScriptCli: true`) | 16.x [CITED: useTypeScriptCli.md] | Whole project checked, including e2e/tests |
| `error.tsx` `reset` | `retry` (stable in 16.3.0) | v16.2.0 unstable, v16.3.0 stable [CITED: error.md] | New boundaries should take `retry` |
| Committing `next-env.d.ts` | Gitignore it; `next typegen` generates it | 15.5+ (`next typegen`) [CITED: next.md] | D-12 |
| Dev and build sharing `.next` | Dev writes `.next/dev` | 16.x [CITED: next.md "`next dev` options"] | Why tsconfig carries both include patterns |

**Deprecated/outdated:** `middleware.ts` (renamed); `unstable_retry` (now `retry`); the `--turbopack` flag (Turbopack is the default for dev and build).

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | TypeScript's `**/*.ts` include glob does not descend into dot-directories, so `tsconfig.e2e.json` (extends) checks the same file set as today plus route types via `next-env.d.ts`. | F2.3 | Build type-check could miss the isolated dist types; mitigated because `next-env.d.ts` imports them explicitly. |
| A2 | A Turbopack production build of this app takes 1.5–4 minutes on 4 vCPU. | F2.4, F5.3 | webServer timeout too short; measure in the first plan. |
| A3 | Radix `Dialog.Trigger` exposes `aria-expanded`/`aria-controls` itself, so removing `aria-label` alone satisfies D-26. | F6.3 | Keep the explicit `aria-expanded` if the unit test shows otherwise. |
| A4 | SSR `style` attributes and sonner's injected stylesheet need `style-src 'unsafe-inline'`; scripts stay strict. | F3.1 | If violations still appear, the collector will name the directive. |
| A5 | The matrix file runs in 2–4 minutes; Strapi suite ≈ 12 minutes after it. | F4.2 | Longer gate; still under the ceiling. |
| A6 | Missing-token responses are 401 or 403 depending on route family. | F4.1 | The matrix records observed statuses per family. |
| A7 | `next experimental-analyze --output` data files contain per-route sizes. | F7.1 | Browser accounting is the primary method anyway. |
| A8 | Performance budgets (300 kB gzip first-load JS per route; TTFB 500 ms; LCP 2.5 s locally). | F7.1 | Budgets are recorded first and tuned to the measured baseline. |
| A9 | `sharp` 0.35.4 and `nodemailer` 9.1.x overrides are compatible with `@strapi/upload`/`provider-email-sendmail` 5.51.0. | F7.2 | Boot failure surfaces immediately in the Strapi suite; fall back to recording a residual. |
| A10 | `vitest` 4.1.x works with `@vitejs/plugin-react` 5.1.1 and jsdom 27.4.0. | F7.2 | Web suite fails fast; pin the newest compatible 4.1.x. |

## Open Questions (RESOLVED)

> Resolved on 2026-09-25 by the orchestrator's post-research decisions in `08-CONTEXT.md` D-36 to D-51: 1, 2 and 10 → D-51; 3 → D-37; 4 and 15 → D-38; 5 → D-36; 6 → D-39; 7 → D-40; 8 → D-41; 9 → D-42; 11 → D-43; 12 → D-44; 13 → D-45; 14 → D-46; 16 → D-47; 17 → D-48. The questions below stay as the record of what was open at research time; the plans cite the decisions.

1. **Production build time on this VM** — not measurable read-only; decides the webServer timeout and the D-14 mechanism margin. Measure in the first plan.
2. **`next experimental-analyze` output format** — `data/routes.json` is known; per-route sizes are not. Inspect once; keep browser accounting primary.
3. **users-permissions public routes** (`POST /api/auth/local`, `/auth/local/register`, `GET /api/users/me`, …) — mounted by the plugin, present in the spec, never probed. The matrix's no-identity actor should request them and the plan should decide between disabling registration/public auth permissions and recording them as accepted (no Users-Permissions user exists; the app authenticates through the API token).
4. **`/api/roles` collision** — the `role` content type's core router and the users-permissions plugin both expose `/roles` (`/roles/{id}` vs `/roles/{role}` in the spec). Which handler answers is unknown; the inventory plan should probe and the IAM-router decision (F1.2) may remove the collision.
5. **IAM router hardening** — `only: []` for `function`, `function-api`, `idambox-user`, `role` and the `application` decision (dead `listShellApplications`?) is a security change the orchestrator should approve explicitly; a custom-scoped API token is the alternative if any of these routes is needed over HTTP.
6. **Strapi `frameguard: 'deny'` / COOP** — safe for the API; unverified for the admin panel. Default to documenting the current defaults and removing `strapi::poweredBy`.
7. **Scope of the parity boundary mode** — Phase 7 components only, or a full sweep (~350 bound sites)? Recommend: mode first, Phase 7 scope, then a recorded backlog.
8. **Journeys 2 and 3 at both widths** — in-spec checkpoints (cheap) or self-seeding (pure project split, larger). Recommend checkpoints, recorded in the UI-SPEC/VERIFICATION.
9. **`upgrade-insecure-requests`** — excluded from the proposed CSP because of the HTTP E2E origin; the operator may want it in real deployments behind TLS (could be gated on `request.nextUrl.protocol === 'https:'`).
10. **Status for missing token per route family** — record observed values (A6).
11. **Playwright browsers on this VM** — `~/.cache/ms-playwright` listed empty at probe time; the orchestrator has run the suite here, so the install is elsewhere or ephemeral. Confirm before the first Playwright plan.
12. **`GET /csrm-information-{systems,assets}`** — mounted, catalogued, unspecified, uncalled; unmount (`only: []`) or publish.
13. **Design-direction extensions** — scroll-edge cue values (D-29), statement column measure (D-28), print page margins (D-33): the UI-SPEC proposes, the orchestrator records them in the direction document before executors hard-code anything.
14. **`expect.timeout` after production** — 15 s was for on-demand compilation; revisit after the first production-build run.
15. **Forcing an internal error for the D-20 proof** — Koa composes `app.middleware` when the server starts listening, so a throwing test middleware must be registered before `strapi.start()` (for example through a harness boot option that calls `strapi.server.use` after `load()`), or a controller method must be patched if handlers resolve lazily; the plan confirms which works in the harness. Strapi's envelope itself is environment-independent (`services/errors.js:66-75`).
16. **Session cookie `secure` under a production build** — `development-session-adapter.ts:66-68` hard-codes `secure: false`; keying it on the request protocol keeps the HTTP E2E working and hardens TLS deployments, but the session is development-only while INT-02 is deferred, so the planner may instead record it as a residual (T-08-R04).
17. **Server Action origin check** — Next rejects Server Action requests whose `Origin` does not match the host; the exact status and the `allowedOrigins` behaviour should be confirmed in the installed `next` source before `production-hardening.spec.ts` asserts it (T-08-R13).

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node (via `/opt/node24/bin`) | everything | ✓ | v24.19.0 | — |
| pnpm | installs, audit, scripts | ✓ | 11.24.0 | — |
| gsd-sdk | planning workflow | ✓ | 1.42.3 | — |
| Next | build/start | ✓ (installed) | 16.3.3 | — |
| Playwright + Chromium | E2E | package ✓ 1.58.2; browser install not visible at `~/.cache/ms-playwright` | — | `pnpm --filter @csrm/web exec playwright install chromium` (confirm with the orchestrator; Open Question 11) |
| Strapi | integration tests, E2E | ✓ | 5.51.0 | — |
| Dev servers (1337/3000) | orchestrator-owned | not listening at probe time | — | Plans that run Playwright or edit Strapi require them stopped anyway |
| CPU / memory | build + suites | 4 vCPU, 15 GB (6 GB free at probe) | — | Serial runs only |
| Registry access (`npm view`, `pnpm audit`) | D-23 | ✓ (through the proxy) | — | — |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** Playwright browser binaries (installable).

## Validation Architecture

> Source for `08-VALIDATION.md`. The infrastructure is the Phase 7 one (`07-VALIDATION.md` "Test Infrastructure"), with two changes this phase makes: the E2E webServer builds and starts a production Next server, and a test run must leave `git status --porcelain` empty (D-12), which retires the `git checkout -- apps/web/next-env.d.ts apps/web/tsconfig.json` step from the gate.

### Test Framework

| Property | Value |
|----------|-------|
| **Frameworks** | Strapi: `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one process and one SQLite database per test file (`strapi-http-harness.ts`). Web: vitest 4.0.18 (jsdom) — 4.1.x after D-23 (A10). E2E: Playwright 1.58.2 with `@axe-core/playwright` 4.11.0, Chromium only. [VERIFIED: `apps/*/package.json` scripts] |
| **Config files** | `apps/strapi/tests/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` (+ new `apps/web/tsconfig.e2e.json`) |
| **Node** | Every command on this VM is prefixed `export PATH="/opt/node24/bin:$PATH" &&` (Node 24.19.0, pnpm 11.24.0) |
| **Quick run: Strapi file** | `pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/strapi && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js` |
| **Quick run: web** | `pnpm --filter @csrm/web test -- <pattern>` |
| **Quick run: E2E** | `pnpm --filter @csrm/web test:e2e e2e/<spec>.spec.ts [--project desktop\|mobile]` — after D-10 every targeted run pays the production build first (A2: 1.5–4 min), so batch targeted specs per plan |
| **Full suite** | `pnpm --filter @csrm/strapi test`; `pnpm --filter @csrm/web test`; `pnpm --filter @csrm/web typecheck` (becomes `next typegen && tsc --noEmit`, F2.3); `pnpm --prefix apps/web api:check` |
| **Phase gate (D-35)** | The four commands above plus `pnpm --filter @csrm/web test:e2e` (full, production build, both projects) with 1337/3000 free, then `git status --porcelain` **empty** (no restore step) and `git diff --name-only <phase-base>..HEAD -- apps/strapi/src/api/*/content-types` empty |
| **Estimated runtime** | Strapi file 10–90 s (matrix file 2–4 min, A5); web file < 20 s; full Strapi ≈ 9–12 min (8.7 min at `07-09-SUMMARY.md:82-86` + matrix); full web ≈ 2–3 min; full Playwright ≈ 12–17 min (F5.3; 7.2 min today at `07-09-SUMMARY.md:197`, plus build and the mobile project); ceiling 30 min |

**Known infrastructure facts.** (1) `tests/authorization.policy.test.js` is passed to `node --test` as `dist/tests/authorization.policy.test.js`, which no build emits, so it never runs (`07-VALIDATION.md` "Known infrastructure fact"; F4.1). Phase 8 ports it to `tests/authorization-policy.unit.test.ts` and removes the dead argument from the `test` script. (2) Strapi's generic 500 envelope is environment-independent: `formatInternalError` (`@strapi/core/dist/services/errors.js:66-75`) wraps any non-`expose` error as `createError(500)`, so the harness (which runs with `NODE_ENV=development`, `strapi-http-harness.ts:323-325`) can prove D-20 without a production boot. (3) Every web mutation is a Server Action (`'use server'` in the five `*-actions.ts` feature modules, `app/actions/session.ts`, `app/sign-in/server-actions.ts`); there are no `route.ts` handlers and no `dangerouslySetInnerHTML` anywhere under `apps/web/app` or `apps/web/src` [VERIFIED: grep 2026-09-25].

### Phase Requirements → Test Map

Each row names the automated proof and whether its file exists. "❌ W0" files are created in the owning plan's first RED task (the project convention, `07-VALIDATION.md` "Wave 0 Requirements").

| Req / Decision | Behaviour to verify | Test type | Automated command / proof | File exists? |
|----------------|--------------------|-----------|---------------------------|--------------|
| INT-01 D-04 | Every web call site is a literal contract operation; every served operation is in the spec, mounted once and catalogued or allow-listed; unserved FunctionAPIs are listed with reasons | static (Strapi unit + web unit) | quick run `served-operations.unit.test.js` (writes/drift-checks `docs/references/served-operations.json`); `pnpm --filter @csrm/web test -- contract-operation-chain` | ❌ W0 `apps/strapi/tests/served-operations.unit.test.ts`, `apps/web/src/features/contract-operation-chain.test.ts` |
| INT-01 D-04 | Catalogue copies byte-identical; design note 9 (unserved list) present; IAM core routers per the F1.2 decision | integration + static | quick run `contract-catalogue.integration.test.js`; `cmp` of the two catalogue copies | ✅ extend |
| INT-01 D-05 | No client parser stricter than the contract unless registered in `narrowedPaths` with a reason (IN-03) | web unit | `pnpm --filter @csrm/web test -- contract-response-parity` (new `boundary` mode); `api:check` clean after spec bounds land | ✅ extend `contract-response-parity.test.ts` |
| INT-01 D-06 | CSV import preview/commit operations appear in `served-operations.json` as served, specified and catalogued; no `fetch(` outside the transport | static | the two D-04 guards (`NO_FETCH_OUTSIDE_TRANSPORT`, served rows for the import operations) | ❌ W0 (same files) |
| INT-03 D-07 | Provenance, job states, human modification, failure/retry taxonomy, no automatic release — hermetic | Strapi unit + integration, web unit | quick run `ai-provider-{questionnaire,assessment,failures,guardrails,boot}.unit.test.js`, `assessment-workflow.{unit,integration}.test.js`, `questionnaire-generation.{unit,integration}.test.js`; `pnpm --filter @csrm/web test -- assessment-review-workflow questionnaire-generation-job assessment-actions` (F8.1 rows cited by line in VERIFICATION) | ✅ |
| INT-03 D-08 | Provider-neutral drafting copy; persisted deterministic summary unchanged | web unit + E2E | `pnpm --filter @csrm/web test -- assessment-review-workflow` (`:278` changes deliberately); `assessment-release-workflow.spec.ts:160` updated, `:276` kept | ✅ extend |
| INT-03 D-09 | One shared Risk Type ordering rule; mixed-case names accepted by the parser | Strapi unit | quick run `ai-provider-assessment.unit.test.js` (new mixed-case deterministic-provider case; adapter case kept) | ✅ extend |
| INT-04 D-10 | Playwright runs against `next build` + `next start`; Strapi stays `strapi develop` | config + E2E | static read of `playwright.config.ts` webServer entries in the gate log; `production-hardening.spec.ts` corroboration: no dev overlay element (`nextjs-portal`) and no HMR request during a journey `[ASSUMED selectors — confirm on first run]` | ✅ extend config; ❌ W0 spec |
| INT-04 D-11 | Each gate alone leaves the session unavailable under `NODE_ENV=production`; attested production run signs in; unattested production build refuses sign-in; `next dev` unchanged | web unit + E2E | `pnpm --filter @csrm/web test -- development-runtime e2e-runtime-attestation alignment server-client e2e-ui-state`; `production-hardening.spec.ts` spawns an unattested `next start` of the same build on a spare port → `/sign-in` 404, `/app` no session (F2.5) | ❌ W0 `src/lib/auth/development-runtime.test.ts`, `src/lib/testing/e2e-runtime-attestation.test.ts`; ✅ change `alignment.test.ts:15-20`, `server-client.test.ts:68,140` |
| INT-04 D-12 | A test run modifies no tracked file | gate + static | `git status --porcelain` empty after the full E2E; `git ls-files apps/web/next-env.d.ts` empty; `apps/web/tsconfig.json` include has exactly the five real entries; `tsconfig.e2e.json` tracked | ❌ W0 `apps/web/tsconfig.e2e.json`; ✅ edit `next.config.ts`, `.gitignore`, `package.json` |
| INT-04 D-13 | The route sweep scans only settled destinations | E2E | `pnpm --filter @csrm/web test:e2e e2e/accessibility.spec.ts --repeat-each 5` green, then the full run | ❌ W0 `e2e/helpers/settle.ts`; ✅ extend `accessibility.spec.ts:47` |
| INT-04 D-14 | Six journeys populated at 1440 and 375 | E2E | `--project desktop` and `--project mobile` for journeys 1, 4, 5, 6 (CSV suffix includes the project name); in-spec width checkpoints for journeys 2 and 3 (F5.3) | ✅ extend the six specs and `playwright.config.ts` |
| INT-04 D-15 | Sign-in helpers assert the "Dashboard" heading and the banner role, never the URL | E2E + static | `grep -n "toHaveURL(/\\\\/app" apps/web/e2e/*.spec.ts` empty inside sign-in helpers (`requestor-request-workflow.spec.ts:53-63`, `app-shell.spec.ts:12-17` change) | ✅ extend |
| INT-04 D-16 | Every served operation has a matrix row for six actors; denial leaves persistence unchanged; 403/404 conventions | integration | quick run `authorization-matrix.integration.test.js` (completeness guard keyed to `served-operations.json`; `provenBy` rows checked against real test titles) | ❌ W0 `apps/strapi/tests/authorization-matrix.integration.test.ts`, `tests/fixtures/authorization-matrix.ts` |
| INT-04 D-17 | "My" operations owner-scoped for the analyst too; Requestor holds birthright operations only; agent never holds a human grant | integration + unit | matrix rows with Bob as owner; `authorization-policy.unit.test.ts` (ported); existing `analyst-insight-authorization.unit.test.ts:131`, `authorization.integration.test.ts` | ❌ W0 port; ✅ |
| INT-04 D-18 | Maya's direct URLs to Jane's request, questionnaire and assessment show not-found/permission states with no record data at both widths | E2E | `assessment-navigation-lifecycle.spec.ts` two-Requestor fixture extended to the three URLs, run in both projects | ✅ extend |
| INT-04 D-19 | Documented header set on every response; nonce CSP, no `unsafe-eval`; zero CSP violations across the journeys | web unit + E2E | `pnpm --filter @csrm/web test -- content-security-policy` (pure builder extracted from `proxy.ts`); `production-hardening.spec.ts` header asserts on `/sign-in`, `/app`, one static asset; CSP collector attached to the journey specs (F3.1 code example) | ❌ W0 `proxy.ts`, `src/lib/security/content-security-policy.ts`(+test), `e2e/production-hardening.spec.ts`, `e2e/helpers/csp.ts` |
| INT-04 D-20 | Strapi security middleware documented; generic 500 envelope; no `X-Powered-By` | integration + doc | quick run `http-hardening.integration.test.js` (forced internal error → `{ status: 500, name: 'InternalServerError', message: 'Internal Server Error' }`, helmet headers present, `x-powered-by` absent); review table in `08-SECURITY.md` | ❌ W0 `apps/strapi/tests/http-hardening.integration.test.ts` |
| INT-04 D-21 | Closed parsers at every boundary; no unsafe HTML; every segment has an error boundary; safe copy in production | static + web unit + E2E | grep `dangerouslySetInnerHTML` empty (verified today); boundary inventory test (every `app/**/page.tsx` segment has `error.tsx` or inherits one; `global-error.tsx`, `not-found.tsx` exist); component tests render `error.tsx`/`global-error.tsx` with an internal message and assert it is absent and `retry` present; `__e2eState=error` fixtures in the production run show designed copy | ❌ W0 boundary files + tests; ✅ `states.test.tsx` style |
| INT-04 D-22 | No server-only name/value in client chunks; transport and auth modules behind `server-only` | E2E + web unit | last test of `production-hardening.spec.ts` scans `<distDir>/static/**/*.{js,css}` (F3.5 list); `pnpm --filter @csrm/web test -- server-only-boundary` | ❌ W0 `src/lib/security/server-only-boundary.test.ts` |
| INT-04 D-23 | Zero high/critical advisories or recorded residuals; no new runtime dependency | audit + suites | `pnpm --filter @csrm/web audit --json`, `pnpm --filter @csrm/strapi audit --json` (recorded in `08-SECURITY.md`); overrides in `pnpm-workspace.yaml`; both suites green after bumps | ✅ (no file; recorded output) |
| INT-04 D-24 | Per-route first-load JS/CSS and navigation timings on the production build against recorded budgets | E2E | `pnpm --filter @csrm/web test:e2e e2e/performance.spec.ts`; corroboration `next experimental-analyze --output` (once); baseline in `docs/performance/phase-08-baseline.md` | ❌ W0 `e2e/performance.spec.ts` |
| INT-04 D-25 | axe (five tags) on every route for every actor at 375 and 1440; conformance record for the undecidable criteria | E2E + doc | `accessibility.spec.ts` extended to the F6.1 missing routes; keyboard proofs for dialogs/sheets in the same spec; record in `docs/accessibility/phase-08-wcag22-conformance.md` (planner may rename) | ✅ extend; ❌ W0 record |
| INT-04 D-26 | Menu trigger's accessible name is "Menu"; expanded state and controlled sheet exposed | web unit + E2E | `pnpm --filter @csrm/web test -- mobile-navigation`; the 12 E2E sites (F6.3) address "Menu" | ✅ extend |
| D-27 | Every status family uses the tinted recipe with icon + text from one mapping; no neutral outline chip | web unit + static | `pnpm --filter @csrm/web test -- status-badge request-table questionnaire-list assessment-list risk-register` (every enum value maps; snapshot of tone per status); grep for outline status usages empty | ❌ W0 `src/components/csrm/status-badge.test.tsx` |
| D-28 | 1024px: search input usable width, label on one line; 1440px: statement wraps/clamps, no forced horizontal scroll | E2E (geometry) | `risk-register-workflow.spec.ts` sweep gains a 1024 assertion (label `boundingBox().height` ≤ one line) and a 1440 assertion (table width ≤ region width with a long statement fixture) | ✅ extend |
| D-29 | Every overflowing DataTable region is focusable and labelled; scroll-edge cue visible when columns are hidden | web unit + E2E | `pnpm --filter @csrm/web test -- scroll-region data-table`; `administration-workflow.spec.ts:219-222` and `risk-register-workflow.spec.ts:358-361` sweeps assert `region` focus and the cue attribute | ❌ W0 `src/components/csrm/scroll-region.test.tsx`; ✅ extend `data-table.test.tsx` |
| D-30 | Search inputs are named after their records; "Search collection" gone | web unit + static | list tests assert the accessible name; `grep -rn "Search collection" apps/web/src` empty | ✅ extend |
| D-31 | Timeline names the acting analyst (server-resolved display name) where the record identifies them | Strapi integration + web unit | quick run `questionnaire-governance.integration.test.js` (display name present for analysts, never for a Requestor); `pnpm --filter @csrm/web test -- questionnaire-revision-timeline` | ✅ extend |
| D-32 | Each question rendered exactly once | web unit | `pnpm --filter @csrm/web test -- questionnaire-governance` (count by question id) | ✅ extend |
| D-33 | Print media hides the shell and keeps content legible | E2E | `page.emulateMedia({ media: 'print' })` in `design-system-conformance.spec.ts` (or the hardening spec): sidebar, header and mobile nav hidden, `main` visible, no clipped table | ✅ extend |
| D-01 | No Keycloak code, configuration or package | static | `git diff --name-only <phase-base>..HEAD -- apps` piped to `xargs grep -il keycloak` is empty; no new auth package in either `package.json` | — (gate check) |
| D-02 | Content-type schemas untouched | static | `git diff --name-only <phase-base>..HEAD -- apps/strapi/src/api/*/content-types` empty at every plan gate | — (gate check) |
| D-03 | New/changed endpoints follow the pattern | integration + static | `contract-catalogue.integration.test.js`, `cmp`, `api:check`, parity guard registration | ✅ |
| D-34 | UI-SPEC defers values to the direction document | review | UI-SPEC check (orchestrator) | — |
| D-35 | Fine-grained, serialised plans; full gate | process | the decomposition below; gate as in the framework table | — |

### Sampling Rate

- **After every task commit:** quick-run the touched Strapi test files and the matching web patterns (< 90 s per Strapi file, < 20 s per web pattern).
- **After every plan:** full Strapi suite, full web suite, `typecheck`, `api:check`, and `git status --porcelain` (must be empty from plan P02 onward). UI plans additionally run their targeted Playwright specs **once** at the end of the plan, with the dev servers stopped, because each targeted run pays the production build.
- **Before `$gsd-verify-work`:** the final plan runs the full five-command gate with the production-build E2E in both projects, records the run (test counts, duration, flaky count, webServer log excerpt showing `next start`) and the empty `git status`.
- **Max feedback latency:** 90 s at task level; the production-build E2E only at plan level.

### Wave 0 Requirements

Created in the owning plan's first RED task (no separate scaffolding wave):

- [ ] `apps/web/tsconfig.e2e.json`; `apps/web/src/lib/auth/development-runtime.ts` + `.test.ts`; `apps/web/src/lib/testing/e2e-runtime-attestation.ts` + `.test.ts`; `apps/web/e2e/helpers/settle.ts`, `apps/web/e2e/helpers/csp.ts` (P02)
- [ ] `apps/strapi/tests/served-operations.unit.test.ts` → `docs/references/served-operations.json`; `apps/web/src/features/contract-operation-chain.test.ts` (P03)
- [ ] `apps/strapi/tests/authorization-policy.unit.test.ts` (port), `apps/strapi/tests/fixtures/authorization-matrix.ts`, `apps/strapi/tests/authorization-matrix.integration.test.ts`, `apps/strapi/tests/http-hardening.integration.test.ts` (P05)
- [ ] `apps/web/src/components/csrm/status-badge.test.tsx` (P07); `apps/web/src/components/csrm/scroll-region.tsx` + `.test.tsx` (P08); `apps/web/app/global-error.tsx`, `apps/web/app/not-found.tsx` + component tests (P09)
- [ ] `apps/web/proxy.ts`, `apps/web/src/lib/security/content-security-policy.ts` + `.test.ts`, `apps/web/src/lib/security/server-only-boundary.test.ts`, `apps/web/e2e/production-hardening.spec.ts` (P10)
- [ ] `apps/web/e2e/performance.spec.ts`, `docs/performance/phase-08-baseline.md` (P13); `docs/accessibility/phase-08-wcag22-conformance.md` (P12)

Harness additions the matrix needs (P05): a `noToken` request helper is already `omitApiToken` (`strapi-http-harness.ts`); add `snapshotDocuments(uids, filters)` for before/after persistence equality, and a `withTestMiddleware` boot option (or a documented equivalent) so `http-hardening` can force an internal error above `strapi::errors` — Koa composes `app.middleware` when `listen` is called, so the throwing middleware must be registered before `strapi.start()` (Open Question 15).

## Security Domain

### ASVS key (4.0.3; L1 unless marked)

| Requirement | Meaning used here |
|-------------|-------------------|
| V2.2.1 | Anti-automation controls on authentication endpoints |
| V3.4.1 / V3.4.2 / V3.4.3 | Cookie `Secure` / `HttpOnly` / `SameSite` attributes |
| V4.1.1 | Access control enforced on a trusted service layer |
| V4.1.3 | Least privilege |
| V4.1.5 | Access control fails securely |
| V4.2.1 | Protection against reading or modifying other principals' records (IDOR) |
| V4.2.2 | Anti-CSRF for authenticated functionality |
| V5.1.3 / V5.1.4 | Allow-list validation; structured data validated against a schema |
| V5.3.3 | Context-aware output escaping (XSS) |
| V7.1.1 / V7.1.2 | No credentials or sensitive data in logs |
| V7.4.1 | Generic message for unexpected or security-sensitive errors |
| V8.2.2 / V8.3.4 | No sensitive data in browser storage; sensitive data identified and handled by policy |
| V12.1.1 | Upload size limits |
| V13.1.4 (L2) | Authorisation at the URI and at the resource level — cited as in `07-SECURITY.md` |
| V13.2.1 / V13.2.2 | Only valid HTTP methods enabled; JSON schema validation |
| V14.2.1 / V14.2.2 | Components up to date; unneeded features, documentation and sample code removed |
| V14.3.2 / V14.3.3 | Debug/development modes disabled in production; no version information in headers |
| V14.4.3 / V14.4.4 / V14.4.5 / V14.4.6 / V14.4.7 | CSP; `X-Content-Type-Options: nosniff`; HSTS; `Referrer-Policy`; `frame-ancestors` / `X-Frame-Options` |
| V14.5.1 / V14.5.3 | HTTP method allow-list; CORS allow-list |

### Trust boundaries this phase adds or changes

| Boundary | Change | Data crossing |
|----------|--------|---------------|
| Playwright → production web server | The web runs `NODE_ENV=production`; sign-in is available only through the attested E2E runtime (D-11). | Attestation file path, nonce, run root; development identity header |
| Browser → `proxy.ts` → routes | Every response gains the header set and a per-request nonce; the nonce reaches Next through the `x-nonce` request header (D-19). | Nonce; CSP report-only is **not** used (assert violations in the browser instead) |
| Web full-access API token → Strapi | Unchanged by design, but the inventory shows it reaches un-policied IAM core routers (F1.2). | Any request the token holder chooses |
| Strapi harness → test-only middleware | The D-20 proof injects a throwing middleware in tests only. | Sentinel header |
| Build output → browser | Client chunks are scanned for server-only names/values (D-22). | Static assets |

### Security threat model inputs

Threat IDs here are research inputs (`T-08-R*`); plans re-key them as `T-08-<plan>-<n>` in their `<threat_model>` blocks. STRIDE letters: S spoofing, T tampering, R repudiation, I information disclosure, D denial of service, E elevation of privilege.

| ID | Area | Threat (STRIDE) | Attack path and evidence | Control (decision) | ASVS | Proof |
|----|------|-----------------|--------------------------|------|------|-------|
| T-08-R01 | INT-01 / IDOR | E — API-token holder writes IAM records | `function`, `function-api`, `idambox-user`, `role`, `application` core routers mount all CRUD routes with no CSRM policy (F1.2); a full-access token bypasses scope checks (`@strapi/admin …/strategies/content-api-token.js:73-76`). The web token is such a token. | `only: []` (or a scoped token) per the orchestrator's decision (Open Question 5); matrix rows for every remaining core route | V4.1.3, V4.1.1, V13.2.1 | `served-operations.unit.test.ts` (routes gone or allow-listed); matrix `analyst`/`noIdentity` rows on `/api/functions` etc. |
| T-08-R02 | Production build (D-11) | S — development identity honoured by a production deployment | A deployment that sets `CSRM_ENVIRONMENT=development` and `CSRM_DEV_IDENTITY=true` on a production build. | Four independent gates including a fresh attestation; fail closed; Strapi's middleware still requires `NODE_ENV=development` (`csrm-development-identity.ts`), so the web alone cannot mint an identity | V14.3.2, V4.1.1, V4.1.5 | `development-runtime.test.ts` (each gate alone), unattested `next start` proof, existing Strapi middleware tests |
| T-08-R03 | Production build (D-11) | S — attestation forgery or replay | Attestation file readable/writable by another local process; stale file reused. | Root-relative path check, nonce match, max age, `server-only` module; the file lives under the run's `.tmp` root | V4.1.5 | attestation unit cases mirrored from `e2e-ui-state.test.ts:40-91` |
| T-08-R04 | Session cookie | I/S — cookie without `Secure` over TLS | `development-session-adapter.ts:66-68` sets `httpOnly: true, secure: false, sameSite: 'lax'`; the E2E origin is HTTP, but the same code path serves a production build. | `secure` keyed on the request protocol (or explicit env), `httpOnly` and `sameSite` kept; development-only session, INT-02 deferred | V3.4.1–V3.4.3 | `development-session-adapter` unit case; hardening spec reads `Set-Cookie` on sign-in |
| T-08-R05 | Security headers (D-19) | T/I — injected script executes (XSS), inline handlers | App Router inline scripts need a nonce; `poweredByHeader: true` default; no CSP today. | `proxy.ts` nonce + `'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, no `unsafe-eval`; residual `style-src 'unsafe-inline'` because `sonner` injects a `<style>` at module load (`sonner/dist/index.mjs:5-8`) and SSR emits `style` attributes — record as accepted | V14.4.3, V5.3.3 | header asserts; zero `securitypolicyviolation` events across journeys; unit test of the policy builder |
| T-08-R06 | Security headers (D-19) | T — clickjacking / cross-origin window reference | No `frame-ancestors`, `X-Frame-Options` or COOP today on the web. | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, restrictive `Permissions-Policy` | V14.4.7 | header asserts |
| T-08-R07 | Security headers (D-19) | I — HSTS ineffective over HTTP; `preload` misuse | Browsers ignore HSTS on plain HTTP, so the E2E can assert presence only; `preload` is irreversible for the operator. | Send `max-age=63072000; includeSubDomains` without `preload`; note the TLS assumption in the security doc; `upgrade-insecure-requests` gated on HTTPS (Open Question 9) | V14.4.5 | header assert; documented residual |
| T-08-R08 | Fingerprinting (D-19, D-20) | I — version disclosure | Next `X-Powered-By: Next.js` (default `poweredByHeader: true`); Strapi `strapi::poweredBy` sends `X-Powered-By: Strapi <strapi.io>`. | `poweredByHeader: false`; remove `strapi::poweredBy` from `config/middlewares.ts` | V14.3.3 | web header assert; `http-hardening.integration.test.ts` |
| T-08-R09 | Error handling (D-20, D-21) | I — stack trace or internal message reaches a client | Strapi: `formatInternalError` already generic (env-independent); Next: production error boundaries show digest only, but `global-error.tsx` and root `not-found.tsx` are missing (F3.4), so a root-layout failure falls to Next's default page and `ProtectedLayout`'s `Session authentication is not configured.` would surface unbranded. | Add `global-error.tsx` (`retry`), `not-found.tsx`; assert no internal message in boundary copy | V7.4.1 | `http-hardening` forced-500 case; boundary component tests; `__e2eState=error` in production |
| T-08-R10 | Logging | I — sensitive data in server logs | `strapi.log.error(error)` logs the full internal error server-side (`errors.js:26`) — acceptable, but request bodies with CSV rows or emails must not be echoed by CSRM code. | Sweep CSRM `strapi.log` calls for bodies/tokens; keep messages constant | V7.1.1, V7.1.2 | grep review recorded in `08-SECURITY.md` |
| T-08-R11 | Bundle hygiene (D-22) | I — server-only value inlined into client chunks | Only `NEXT_PUBLIC_*` is inlined by Next, but a client component importing a transport/auth module would pull constants and error strings into a chunk. | `server-only` first statement in every transport/auth/capability/testing module; production chunk scan for the nine names, the token value, the nonce, the identity header and fixture emails | V8.3.4, V14.2.2 | `server-only-boundary.test.ts`; chunk scan test |
| T-08-R12 | IDOR (D-16–D-18) | I/T/E — another Requestor's record read or changed | Direct URL and direct API access to Jane's request, questionnaire, assessment; "My" operations widening for an analyst. | Existing policy + record scoping; matrix asserts 403/404 conventions and unchanged persistence; browser proof at both widths | V4.2.1, V4.1.3, V13.1.4 | `authorization-matrix.integration.test.ts`; `assessment-navigation-lifecycle.spec.ts` |
| T-08-R13 | Mutations | T — cross-site request forgery against Server Actions | All mutations are Server Actions behind the `httpOnly` `SameSite=Lax` development cookie; Next rejects Server Action POSTs whose `Origin` does not match the host. | Keep Server Actions (no route handlers); if a reverse proxy changes the host, set `experimental.serverActions.allowedOrigins` deliberately | V4.2.2 | documented; hardening spec sends a cross-origin `Origin` to a Server Action and expects rejection `[ASSUMED: Next origin check behaviour — confirm in `next` source before asserting]` |
| T-08-R14 | Users & Permissions plugin | S/E/D — public `auth/local/register`, `auth/local`, `users/me` routes | Mounted by the plugin and present in the spec but never probed (Open Question 3); default public permissions may allow registration of Users-Permissions accounts that hold no CSRM grant but pollute the database. | Decide: disable registration/public auth permissions at bootstrap or record acceptance; matrix `noIdentity` rows request them | V2.2.1, V14.2.2 | matrix rows with the decided expected status |
| T-08-R15 | Route collision | I/E — `/api/roles` served by an unexpected handler | IAM `role` core router and users-permissions both expose `/roles` (Open Question 4). | Probe in the inventory plan; the T-08-R01 decision may remove the collision | V4.1.1 | `served-operations.json` records the winner; matrix row |
| T-08-R16 | Dependencies (D-23) | E/D — known advisories in transitive packages | `pnpm audit` findings and proposed overrides (F7.2). | Bump or override where compatible; record residuals with reasons | V14.2.1 | audit output zero high/critical or residual rows; suites green |
| T-08-R17 | CSV imports (D-06, IN-03) | D — oversized upload or row bomb | Server bounds (F1.6 table) exist; the client is sometimes stricter than the contract. | Contract declares the bounds the server guarantees; parity `boundary` mode; body-size limits documented | V12.1.1, V13.2.2, V5.1.4 | parity guard; existing administration integration tests; spec bounds |
| T-08-R18 | Input validation (D-21) | T — unvalidated search params or path keys | Phase 7 pattern: closed parsers for every URL value; new routes/params in this phase (none planned) must follow it. | Closed Zod at every boundary; `contract-operation-chain` guard rejects non-literal client paths | V5.1.3, V5.1.4 | existing schema tests; the chain guard |
| T-08-R19 | Test infrastructure | T — a test run mutates tracked files or leaves a production server listening | Next rewrites `tsconfig.json`/`next-env.d.ts`; the unattested `next start` spawned by the hardening spec must be killed on failure. | D-12 mechanism; `test.afterAll` kill with `SIGTERM` and a port check | — (hygiene) | `git status --porcelain`; `ss -ltn` shows nothing on the spare port after the run |
| T-08-R20 | Accessibility (D-25) | — (assurance, not STRIDE) | Criteria axe cannot decide are otherwise unrecorded. | Conformance record with per-criterion evidence and keyboard proofs | — | record + `accessibility.spec.ts` keyboard tests |

**Accepted residuals to record (candidates):** `style-src 'unsafe-inline'` (sonner); HSTS unverifiable over HTTP; development session `secure: false` on the HTTP E2E origin; Strapi admin panel headers left at defaults (Open Question 6); any advisory without a compatible fix (D-23).

## Recommended Plan Decomposition (D-35)

**Shape.** Fifteen fine-grained plans in five waves, executed as one serial chain. `.planning/config.json` sets `parallelization: true`, but nothing in this phase is safely parallel: every plan either runs Playwright (ports 3000/1337, one production build, one shared E2E database), runs the Strapi suite (all Strapi plans compile into the shared `apps/strapi/.tmp/tests-dist` and `dist/` directories, so two concurrent runs corrupt each other), or edits cross-cutting UI files (D-27 and D-30 touch every list surface). The planner should mark every wave sequential and let the waves express only *ordering*, not concurrency.

**Ordering rationale.** Dependencies first (P01) so every later suite runs on the patched tree; the production-build E2E foundation second (P02) so every later Playwright run is already the production run and D-12 holds from then on; Strapi work next, with the served-operations inventory (P03) before anything that keys on `served-operations.json` (P05) or edits the spec (P04, P07); UI follow-ups before the browser proofs so the journeys, accessibility sweep and performance baseline measure the final UI; the security proxy (P11) before the journeys (P12) so a CSP regression surfaces on the route sweep before the journeys carry the collector; the gate last.

| Plan | Wave | Decisions | Owns (files) | Edits Strapi? | Runs Playwright? | Est. |
|------|------|-----------|--------------|---------------|------------------|------|
| **P01** Dependency hygiene | 0 | D-23 (T-08-R16) | `pnpm-workspace.yaml` (overrides), `apps/web/package.json`, `apps/strapi/package.json` (versions only), `pnpm-lock.yaml`; audit record for `08-SECURITY.md` | manifest only | no (both unit suites + typecheck + `api:check`) | 1–2 h |
| **P02** Production-build E2E foundation | 0 | D-10, D-11, D-12, D-13 (T-08-R02, R03, R04, R19) | `apps/web/playwright.config.ts` (webServer build→start, `desktop` project; `mobile` project declared with an empty `testMatch` list for P12), `apps/web/tsconfig.e2e.json`, `apps/web/tsconfig.json` (include cleanup), `apps/web/next.config.ts` (`typescript.tsconfigPath` only), `.gitignore`, `apps/web/package.json` (`typecheck`), `git rm --cached apps/web/next-env.d.ts`, `src/lib/auth/{development-runtime.ts,session-adapter.ts,development-session-adapter.ts}`, `src/lib/testing/{e2e-runtime-attestation.ts,e2e-ui-state.ts}`, `src/lib/api/transport/server-client.ts`, `app/sign-in/page.tsx`, their tests (`alignment.test.ts`, `server-client.test.ts`, new unit files), `e2e/helpers/{settle.ts,csp.ts}`, `accessibility.spec.ts` (line 47 region only), `e2e/production-hardening.spec.ts` (D-11 unattested-server proof only) | no | **yes** — one full run to prove the build, D-12 (`git status --porcelain` empty), measure build time (Open Question 1) and set timeouts | 4–6 h |
| **P03** Served-operations inventory and IAM router decision | 1 | D-04, D-06 (T-08-R01, R14, R15; Open Questions 3, 4, 5, 12) | `apps/strapi/tests/served-operations.unit.test.ts`, `docs/references/served-operations.json`, `apps/strapi/package.json` (`served-operations:write` script), `apps/strapi/src/api/{function,function-api,idambox-user,role,application,csrm-information-system,csrm-information-asset}/routes/*.ts` (per the recorded decision), `docs/references/specification.json` (drop any operation that becomes unserved), both catalogue JSON copies (design note 9), `apps/strapi/tests/contract-catalogue.integration.test.ts`, `apps/web/src/features/contract-operation-chain.test.ts`, the dead `listShellApplications` call site if removed | **yes** | no | 4–6 h |
| **P04** IN-03 parser bounds and parity boundary mode | 1 | D-05 (T-08-R17, R18; Open Question 7) | `docs/references/specification.json` (declared bounds), `apps/web/src/lib/api/generated/schema.d.ts` (regenerated), `apps/web/src/features/contract-response-parity.test.ts` (`boundary` mode, `narrowedPaths` reasons), the `*-schema.ts` files that narrow, Strapi validators only where a bound must become explicit server-side (F1.6) | possibly (validators) | no | 3–4 h |
| **P05** Authorization matrix, policy-test port, Strapi HTTP hardening | 1 | D-16, D-17, D-20 (T-08-R08, R09, R10, R12; Open Questions 6, 10, 15) | `apps/strapi/tests/fixtures/authorization-matrix.ts`, `apps/strapi/tests/authorization-matrix.integration.test.ts`, `apps/strapi/tests/authorization-policy.unit.test.ts` (port of `authorization.policy.test.js`, then delete it and fix the `test` script), `apps/strapi/tests/helpers/strapi-http-harness.ts` (snapshot + test-middleware helpers), `apps/strapi/tests/http-hardening.integration.test.ts`, `apps/strapi/config/middlewares.ts` (`strapi::poweredBy` removal, documented `strapi::security` settings), Strapi security review text for `08-SECURITY.md` | **yes** | no | 5–7 h |
| **P06** Shared Risk Type ordering rule | 1 | D-09 | `apps/strapi/src/csrm/ai/assessment-draft-provider.ts`, `deterministic-assessment-draft-provider.ts`, `openai-compatible-assessment-draft-provider.ts` (paths per F8.3), `apps/strapi/tests/ai-provider-assessment.unit.test.ts` | **yes** | no | 1–2 h |
| **P07** Revision timeline names the acting analyst | 1 | D-31 (D-02, D-03) | Strapi questionnaire-governance service/controller (display-name lookup by `documentId`, analyst-only), `docs/references/specification.json` (+ regenerated `schema.d.ts`), `apps/web/src/features/questionnaires/{questionnaire-schema.ts,questionnaire-revision-timeline.tsx}` + tests, `apps/strapi/tests/questionnaire-governance.integration.test.ts`, parity registration | **yes** | no | 2–3 h |
| **P08** Status recipe, single-render review, provider-neutral copy | 2 | D-27, D-32, D-08 | `apps/web/src/components/csrm/status-badge.tsx` (+ new test), every status call site (`request-table.tsx`, `questionnaire-list.tsx`, `assessment-list.tsx`, `assessment-status-filters.tsx`, `risk-register.tsx` treatment status, dashboards), `questionnaire-governance.tsx` (+test), the analyst review drafting copy component and `assessment-review-workflow.test.tsx:278`, `e2e/assessment-release-workflow.spec.ts:160` (copy string only) | no | targeted (`assessment-release-workflow.spec.ts`, `analyst-insights.spec.ts`) | 3–4 h |
| **P09** Scroll regions, named search inputs, Risk Register layout | 2 | D-29, D-30, D-28 (Open Question 13 — orchestrator records the cue and measure extensions first) | `apps/web/src/components/csrm/scroll-region.tsx` (+test), `data-table.tsx` (+test), report tables that overflow, every list surface's search label prop, `risk-register.tsx`, `risk-register-filters.tsx` (+tests), `apps/web/app/globals.css` (cue tokens), `e2e/risk-register-workflow.spec.ts` (1024/1440 geometry asserts), `e2e/administration-workflow.spec.ts` (sweep focus assert) | no | targeted (`risk-register-workflow.spec.ts`, `administration-workflow.spec.ts`) | 4–6 h |
| **P10** Menu label, error boundaries, print | 2 | D-26, D-21 (boundaries), D-33 (Open Question 13 — print margins) | `capability-navigation.tsx`, `mobile-navigation.test.tsx`, the 12 E2E "Open navigation" sites (F6.3; text edits only), `apps/web/app/global-error.tsx`, `apps/web/app/not-found.tsx`, any segment lacking `error.tsx`, boundary component tests, `globals.css` (`@media print`), `e2e/design-system-conformance.spec.ts` (print emulation check) | no | targeted (`design-system-conformance.spec.ts`, `app-shell.spec.ts`) | 3–4 h |
| **P11** Web security headers, CSP, bundle hygiene | 3 | D-19, D-21 (validation record), D-22 (T-08-R05, R06, R07, R08, R11, R13; Open Question 9) | `apps/web/proxy.ts`, `src/lib/security/content-security-policy.ts` (+test), `apps/web/next.config.ts` (`poweredByHeader: false`), `src/lib/security/server-only-boundary.test.ts`, `e2e/production-hardening.spec.ts` (headers, route-sweep CSP collector for both actors, chunk scan, Server Action origin check), security documentation text | no | **yes** (`production-hardening.spec.ts` + one full run to catch CSP breakage in every spec) | 4–6 h |
| **P12** Six journeys at both widths and browser IDOR | 3 | D-14, D-15, D-18 (T-08-R12) | the six journey specs, `assessment-navigation-lifecycle.spec.ts`, `app-shell.spec.ts` (sign-in helper), `requestor-request-workflow.spec.ts:53-63` helper, `playwright.config.ts` (mobile `testMatch` list), CSV suffix per project; journeys import the `csp.ts` collector | no | **yes** (both projects, full journey set) | 6–8 h |
| **P13** Accessibility sweep and conformance record | 3 | D-25, D-13 (repeat proof), D-26 (sites already renamed) | `e2e/accessibility.spec.ts` (missing routes, both actors, both widths, keyboard proofs for dialogs/sheets), `docs/accessibility/phase-08-wcag22-conformance.md`, any small fix the sweep finds (each recorded) | no | **yes** (`accessibility.spec.ts --repeat-each 5`, then full) | 4–6 h |
| **P14** Performance baseline | 3 | D-24 (Open Question 2) | `e2e/performance.spec.ts`, `docs/performance/phase-08-baseline.md`, one `next experimental-analyze --output` corroboration under `apps/web/.tmp/`, only real fixes (each recorded) | no | **yes** (`performance.spec.ts`) | 3–4 h |
| **P15** Phase gate and records | 4 | D-01, D-02, D-07 (citations), D-35; INT-02 deferral wording | `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `08-SECURITY.md` residuals, `docs/contract-gaps/phase-08-*.md` (if any), evidence for VERIFICATION | no | **yes** (full five-command gate, both projects, `git status --porcelain` empty, schema-freeze diff empty) | 2–3 h |

**Serialisation table (files with more than one owner, in execution order).**

| File | Owners in order | Why serial |
|------|-----------------|-----------|
| `apps/web/playwright.config.ts` | P02 → P12 | webServer/projects first; mobile `testMatch` list when the journeys are ready |
| `apps/web/next.config.ts` | P02 → P11 | `tsconfigPath` first; `poweredByHeader` with the header work |
| `apps/web/package.json`, `apps/strapi/package.json`, `pnpm-lock.yaml` | P01 → P02 → P03 → P05 | versions; `typecheck` script; `served-operations:write`; `test` script fix |
| `docs/references/specification.json` + `apps/web/src/lib/api/generated/schema.d.ts` | P03 → P04 → P07 | unserved removals; bounds; timeline DTO — `api:check` after each |
| `apps/web/src/features/contract-response-parity.test.ts` | P03 → P04 → P07 | the dead shell parser's registration removed with `listShellApplications` (D-36); boundary mode; new parser registration |
| `apps/strapi/tests/helpers/strapi-http-harness.ts` | P03 → P05 (P07 reads only) | `listMountedContentApiRoutes()` and `readUsersPermissionsAdvancedSettings()` for the inventory; then the snapshot/test-middleware helpers |
| `apps/web/e2e/accessibility.spec.ts` | P02 (line 47) → P10 (Menu sites) → P13 | settle fix; label rename; sweep extension |
| `apps/web/e2e/assessment-release-workflow.spec.ts` and the other journey specs | P08 (`:160` copy) → P10 (Menu sites) → P12 | text edits precede the width restructuring |
| `apps/web/e2e/design-system-conformance.spec.ts` | P10 → (P13 reads) | print check |
| `apps/web/src/components/csrm/data-table.tsx` | P09 → P10 | structural region edits, then the `data-print="hidden"` markers on the toolbar and footer controls; P08 must not touch it (status cells are rendered by callers) |
| `apps/web/src/features/risks/{risk-register,risk-register-filters}.tsx` | P08 → P09 | status recipe first, then layout |
| `apps/web/app/globals.css` | P09 → P10 | cue tokens; print rules |
| `apps/web/e2e/production-hardening.spec.ts` | P02 → P11 | unattested-server proof; headers/CSP/chunk scan |
| Catalogue JSON copies (both) | P03 only | design note 9; P05 must not change grants (D-03 — if a matrix row needs a grant change, stop and record) |
| `apps/web/e2e/risk-register-workflow.spec.ts` | P08 (`:8` title) → P09 → P12 → P13 | the Risk detail Alert retitle's one-line constant edit precedes the geometry proofs, the projects and the focus-helper move |
| `apps/web/src/features/administration/administration-workflow.test.tsx` | P09 → P13 | the CSV import region and template-label cases; then the denial-heading case |

*Hand-offs recorded at the plan check (2026-09-25; plan numbers: P03 = 08-03, P04 = 08-04, P05 = 08-05, P07 = 08-06, P08 = 08-07, P09 = 08-08, P10 = 08-09, P12 = 08-11, P13 = 08-12): 08-03 edits `contract-response-parity.test.ts` and `strapi-http-harness.ts` ahead of the owners listed at research time; 08-09 adds the print markers to `data-table.tsx` after 08-08; 08-07 edits `risk-register-workflow.spec.ts:8` ahead of 08-08; 08-08 extends `administration-workflow.test.tsx` ahead of 08-12. All are serial-safe under the one-owner-per-wave rule (D-49); the rows above carry the updated order.*

**Rules every plan carries (from the constraints).** Dev servers stopped for P03–P07 (Strapi edits) and for every plan that runs Playwright (P02, P08–P15); `export PATH="/opt/node24/bin:$PATH" &&` on every command; never stage the tool-state directories the orchestrator's git rules exclude, `.env*`, or `apps/web/.tmp/`; from P02 onward `apps/web/next-env.d.ts` is untracked and `apps/web/tsconfig.json` must not change during a run — a non-empty `git status --porcelain` after a Playwright run is a plan failure, not something to restore; no `CSRM_AI_*` change; deterministic provider only; content-type schemas frozen; no Keycloak anything.

**Plan-level threat model.** Each plan's `<threat_model>` should take the `T-08-R*` rows above that name it, re-keyed per plan, and every plan that touches Strapi routes or grants (P03, P05, P07) must include a "no grant widening" row proven by `contract-catalogue.integration.test.ts` and the unchanged `HUMAN_ANALYST_ONLY_OPERATIONS` list.

## Sources

### Primary (read from the installed packages and this repository, 2026-09-25)

- Next 16.3.3 bundled docs (`node_modules/.pnpm/next@16.3.3*/node_modules/next/dist/docs/01-app/`): `03-api-reference/05-config/01-next-config-js/{typescript,distDir,poweredByHeader,headers,useTypeScriptCli}.md`, `03-api-reference/03-file-conventions/{proxy,error}.md`, `03-api-reference/04-functions/headers.md`, `03-api-reference/06-cli/next.md`, `02-guides/content-security-policy.md`, plus the production checklist, environment-variables and building guides under `02-guides/`.
- Next 16.3.3 source: `dist/lib/typescript/writeConfigurationDefaults.js`, `dist/lib/typescript/writeAppTypeDeclarations.js`, `dist/lib/verify-typescript-setup.js`, `dist/lib/typescript/type-paths.js` (as cited in F2), `dist/server/config-shared.js`, `dist/build/analyze/index.js`.
- Strapi 5.51.0 source (`node_modules/.pnpm/@strapi+core@5.51.0*/…/@strapi/core/dist`): `middlewares/security.js`, `middlewares/errors.js`, `middlewares/powered-by.js`, `services/errors.js`; `@strapi/admin …/server/src/strategies/content-api-token.js` (compiled `dist`), `@strapi/utils` CSP defaults; helmet 6.2.0 `index.cjs`.
- Playwright 1.58.2 source (`node_modules/.pnpm/playwright@1.58.2*/…/lib/plugins/webServerPlugin.js`, `…/runner/tasks.js`, `playwright-core/lib/server/utils/network.js`, `…/utils/processLauncher.js`).
- `sonner` `dist/index.mjs` (runtime `<style>` injection).
- Repository: `apps/web/{playwright.config.ts,next.config.ts,tsconfig.json,next-env.d.ts,package.json}`, `apps/web/app/**`, `apps/web/src/lib/{auth,api/transport,testing,capabilities}/**`, `apps/web/src/components/csrm/**`, `apps/web/src/features/**`, `apps/web/e2e/*.spec.ts`, `apps/strapi/src/api/*/routes/*.ts`, `apps/strapi/src/policies/csrm-authorization.ts`, `apps/strapi/src/middlewares/csrm-development-identity.ts`, `apps/strapi/config/middlewares.ts`, `apps/strapi/tests/**`, `docs/references/{specification.json,idambox-csrm-role-function-api-catalogue.json}`, `docs/design/csrm-design-direction.md`, `docs/CSRM-PROJECT-BRIEF.md`, `.planning/phases/07-*/07-{RESEARCH,VALIDATION,SECURITY,UI-SPEC,UI-REVIEW,REVIEW,VERIFICATION,09-SUMMARY}.md`, `.planning/{REQUIREMENTS,STATE,ROADMAP}.md`, `AGENTS.md`, `apps/web/AGENTS.md`, `.agents/skills/`.
- Commands run (read-only): `gsd-sdk query init.phase-op 8`, `pnpm audit --json` per workspace (output in the session scratchpad `audit.json`), `npm view <pkg> version` for the proposed bumps, a Node script that tabulated web call sites × spec × routes × catalogue, `git status`/`git diff`/`git log` on the two rewritten files, `ss -ltn`.

### Secondary

- npm registry metadata for the D-23 version proposals (`npm view`, through the proxy).
- WCAG 2.2 criteria list and axe-core 4.11 rule set knowledge for F6.4 (the rule names were checked against the installed `axe-core` package; the criteria text is from the standard as recalled — mark the conformance record's criterion wording for a documentation check).

### Tertiary

- None. No community posts or blog sources were used; every mechanism claim traces to a bundled doc or source file above.

## Metadata

**Confidence breakdown:**

| Area | Confidence | Basis |
|------|------------|-------|
| D-12 mechanism (tsconfig `extends` bail-out, untracked `next-env.d.ts`, `next typegen`) | HIGH | Read from Next 16.3.3 source and docs |
| D-11 gate design and Playwright readiness pitfall | HIGH | Source-cited code paths; behaviour of the current tree verified |
| INT-01 inventory results (76 web operations; IAM routers; `GET /applications`) | HIGH | Script over the actual files; recorded sets |
| CSP mechanism and the sonner residual | HIGH for mechanism, MEDIUM for the exact final policy string | First production run decides residual directives |
| IDOR matrix layout and harness reuse | HIGH | Harness read in full; conventions cited from existing tests |
| Journey mechanism and runtime | MEDIUM | Build time and mobile-project duration unmeasured (A2) |
| Accessibility gaps and D-13/D-26 fixes | HIGH | Specs and components read |
| Performance method | MEDIUM | `experimental-analyze` output shape unverified (A7) |
| Dependency dispositions | MEDIUM | Audit data is current; compatibility of bumps assumed (A9, A10) |
| Follow-up root causes (D-27 to D-33) | HIGH | Each traced to a file and line |
| Plan decomposition | HIGH for ordering constraints, MEDIUM for durations | Constraints are mechanical (shared dirs, ports, files); durations are estimates |

**Research date:** 2026-09-25. **Valid until:** about 30 days, or until any of Next, Strapi or Playwright is bumped (the D-12, D-19 and readiness findings are version-specific) — re-check F2 and F3 first after an upgrade.
