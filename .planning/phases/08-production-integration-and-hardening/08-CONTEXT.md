# Phase 8: Production Integration and Hardening - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning
**Mode:** discuss-phase auto. The orchestrator answered every gray area from the operator's build-out steer, the ROADMAP, the STATE follow-up ledger and the repository's locked decisions. There is no SPEC.md for this phase.

<domain>
## Phase Boundary

Harden every delivered slice for production and prove it: the web calls only documented, served Strapi operations (INT-01); AI integration keeps provenance, review state, safe failure and analyst-only release, re-verified hermetically (INT-03); and critical journeys, responsive behaviour, WCAG 2.2 AA, security controls, performance, dependency hygiene and IDOR protection are verified and documented (INT-04). The Playwright suite moves from `next dev` to a production Next build, as deferred since Phase 1. The phase also closes the follow-ups the STATE ledger and the Phase 7 UI review carry forward.

**Deferred by operator decision (2026-09-25): INT-02, Keycloak.** Keycloak stays disabled: no wiring, configuration, dependency or environment variable for it. Phase 8 therefore closes as "complete except INT-02". ROADMAP success criterion 2 is split: its record-level authorization and IDOR half is delivered here; its Keycloak authorization-code and token-validation half is deferred with INT-02.

Out of scope: Keycloak or any real OIDC flow; any Strapi content-type schema change; live AI generation or provider configuration; report export, alert acknowledgement and notifications; Phase 06.10 (deferred) and Phase 9 (not started).
</domain>

<decisions>
## Implementation Decisions

### Scope guards

- **D-01:** INT-02 is deferred by operator decision. REQUIREMENTS keeps INT-02 unchecked with the deferral reason; the phase summary, VERIFICATION and STATE say "complete except INT-02". Nothing in this phase may add Keycloak code, configuration, packages or placeholders.
- **D-02:** No content-type schema change (`apps/strapi/src/api/*/content-types` is frozen). Policies, middlewares, controllers, services, routes and bootstrap code may change. If a follow-up needs a fact the datamodel does not hold, first use an existing relation or stored reference; otherwise stop and record the gap in `docs/contract-gaps/phase-08-*.md` instead of changing a schema.
- **D-03:** Every new or changed endpoint follows the established pattern: exact IdamBox Role → Function → FunctionAPI grants in both catalogue copies (byte-identical), record-level checks in Strapi, the operation published in `docs/references/specification.json`, the client regenerated with `api:check` clean, closed Zod parsers registered in the contract parity guard. Requestor is birthright, Security Analyst explicit, and the analyst service agent never inherits human-analyst grants.

### INT-01 — contract fidelity

- **D-04:** A static, test-enforced inventory proves the whole chain for every operation the web service layer invokes: the call goes through the generated openapi-fetch client, the operation exists in `specification.json`, Strapi mounts it exactly once, and the catalogue grants it. The inventory also lists every catalogued-but-unserved operation with its reason (for example the five operations Phase 7 D-06 left unserved). The guard fails when a new call bypasses the contract or targets an unserved operation.
- **D-05:** Phase 7 finding IN-03 is resolved here. Where a client parser is stricter than the contract (trim, `min(1)`, `max(n)` not declared in the spec), either the contract declares the bound the server already guarantees (preferred), or the path is registered in the parity guard's `narrowedPaths` with its reason. Nothing stays invisible to the parity guard.
- **D-06:** The CSV import operations (criterion 1 names "including imports") are shown to be documented, served Strapi operations with no frontend facade; the inventory in D-04 covers them.

### INT-03 — AI integration, re-verified hermetically

- **D-07:** INT-03 stays complete; Phase 8 re-verifies it without a live provider. The existing deterministic-provider and provider-adapter suites (provenance, job states, human modification, failure and retry taxonomy, no automatic release) are run and cited in VERIFICATION. No `CSRM_AI_*` setting is added or changed.
- **D-08:** The analyst request review's drafting copy becomes provider-neutral. "Deterministic draft assistance" and "Start deterministic draft assistance" misstate the source whenever a real provider is configured. The new copy describes the action and states that the output is advisory and reviewable; the source is named only where recorded provenance already names it. Exact strings are fixed in the UI-SPEC; tests that assert the old copy change deliberately.
- **D-09:** One shared Risk Type ordering rule is used by `parseAssessmentDraftProposal`, the deterministic provider and the OpenAI-compatible adapter, so a mixed-case Risk Type name can no longer fail the parser's order check. A unit test with mixed-case names proves it.

### INT-04 — production build under test, and test-run hygiene

- **D-10:** The Playwright suite runs against a production Next build (`next build`, then `next start`) instead of `next dev`. The E2E Strapi stays `strapi develop` behind the development identity bridge, which is the only authentication available while INT-02 is deferred.
- **D-11:** A production build runs with `NODE_ENV=production`, where the web development session is unavailable today. It is enabled under a production build **only** inside the attested E2E runtime: `CSRM_ENVIRONMENT=development`, `CSRM_DEV_IDENTITY=true`, and a valid run attestation using the existing `CSRM_E2E_RUNTIME_ROOT` / `CSRM_E2E_RUNTIME_ATTESTATION_PATH` / `CSRM_E2E_RUNTIME_NONCE` pattern. Any missing or invalid gate leaves the session unavailable (fail closed). Unit tests prove each gate independently. A browser or integration proof shows a production build without the attestation refuses development sign-in. The `next dev` behaviour is unchanged. Strapi stays authoritative: its identity middleware still requires `NODE_ENV=development`, so a misconfigured web deployment still gets no identity from Strapi.
- **D-12:** A test run modifies no tracked file. Next rewrites `apps/web/tsconfig.json` and `apps/web/next-env.d.ts` for whatever dist directory it builds into; that is stopped at the source (for example by pointing the E2E build at an untracked tsconfig through Next's TypeScript configuration, or another mechanism the research confirms in the Next 16.3 docs), and the stale `.tmp/` include entries are then removed from `apps/web/tsconfig.json`. Proof: `git status --porcelain` is empty after a full E2E run, recorded in the phase gate.
- **D-13:** The `accessibility.spec.ts:47` scan that could start mid-navigation waits for a settled destination (destination URL, document title, a visible level-1 heading, and no visible loading state) before axe runs. It is proven by several consecutive isolated passes plus the full-suite run.

### INT-04 — critical journeys at both widths

- **D-14:** Six critical journeys run at 1440px and at 375px: request create → submit; questionnaire complete → submit; assessment draft → review → release; Requestor read-only viewing of the released assessment; Risk Register filter → detail → mitigation edit; CSV import preview → commit. The mechanism (a mobile Playwright project scoped to the journey specs, or parametrised specs) is the planner's choice. Each journey asserts populated content at each width, not only an axe pass, and the full suite stays well inside the 30-minute harness ceiling.
- **D-15:** Journeys assert the shell after sign-in (the level-1 "Dashboard" heading and the role in the banner), never the URL.

### INT-04 — IDOR and record-level authorization

- **D-16:** A spec-driven authorization matrix at the Strapi mounted-HTTP level states, for every served operation, the expected outcome for each actor: the owning Requestor (Jane), the Secondary Requestor (Maya), the human Security Analyst (Bob), the analyst service agent, and a request with no identity. Record-level rows cover another Requestor's request, questionnaire and assessment. The established conventions hold: an unauthorised assessment read answers 404; denial proves persistence is unchanged. A completeness guard fails when a served operation has no matrix row. Existing proofs are referenced or reused, not duplicated.
- **D-17:** Requestor-birthright behaviour is proven: the "My" operations are owner-scoped for every actor, including a Security Analyst; a Requestor holds birthright operations only; the service agent never holds a human-analyst grant.
- **D-18:** Browser-level IDOR: the Secondary Requestor's direct URLs to Jane's request, questionnaire and assessment render the not-found or permission state with no record data, at both widths (extends the Phase 06.9 two-Requestor fixture pattern).

### INT-04 — security validation

- **D-19:** Every web response carries a documented security header set: a Content-Security-Policy compatible with Next 16 App Router (nonce- or hash-based scripts, no `unsafe-eval` in production, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`), `Strict-Transport-Security` in production, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, a restrictive `Permissions-Policy`, and `Cross-Origin-Opener-Policy: same-origin`; `X-Powered-By` is removed. The production-build E2E asserts the headers and that the journeys raise zero CSP violations.
- **D-20:** Strapi's security middleware configuration is reviewed and documented, and production-mode error responses carry the safe error envelope with no stack trace or internal message (integration proof or documented evidence).
- **D-21:** Input, output and error handling is validated and documented: closed Zod parsers at every trust boundary; no unsafe HTML rendering (each `dangerouslySetInnerHTML`, if any, justified or removed); every route segment has an error boundary; production builds show safe copy with no stack trace or internal message.
- **D-22:** No server-only value reaches the browser: a scan of the production build's client chunks finds no server environment names or values (for example `CSRM_API_TOKEN`), and the transport modules stay behind `server-only`.
- **D-23:** Dependency hygiene: `pnpm audit` (a registry advisory lookup only) for both workspaces; high and critical advisories are fixed where a compatible patched version exists; any accepted residual risk is recorded with its reason; no new runtime dependency is introduced without a concrete need.

### INT-04 — performance

- **D-24:** Performance is measured on the production build and documented: per-route first-load JavaScript from the build output, and navigation timings for the key routes measured by Playwright against the seeded E2E database. Budgets are recorded and only real problems are fixed. No new performance tooling dependency.

### INT-04 — accessibility

- **D-25:** WCAG 2.2 AA receives documented validation: axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) on every route for every actor at 375px and 1440px, extending `accessibility.spec.ts` to any route it does not yet cover, plus a conformance record for the criteria axe cannot decide: 2.4.11 Focus Not Obscured (sticky header), 2.5.3 Label in Name, 2.5.8 Target Size, 1.4.10 Reflow, 1.4.12 Text Spacing, 2.4.7 Focus Visible, 3.2.6 Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication, and keyboard operability of dialogs and sheets.
- **D-26:** The mobile navigation trigger meets 2.5.3 Label in Name: its accessible name is its visible label, "Menu", with its expanded state and controlled sheet still exposed. Tests that address it as "Open navigation" change deliberately (Phase 7 UI review finding 4).

### Follow-ups carried forward (UI and correctness)

- **D-27:** Every status badge (request, questionnaire, assessment status, Risk treatment status and any other workflow status) uses the design direction §4 tinted status recipe with icon and text from one shared status-to-tone mapping. No status renders as a neutral outline chip.
- **D-28:** The Risk Register filter bar has a deliberate layout between the mobile sheet and the 1440px row: at 1024px the search input keeps a usable width and its label stays on one line. At 1440px the statement column wraps or clamps, so long statements no longer push most columns into horizontal scroll.
- **D-29:** Whenever a DataTable overflows its container, its scroll region is keyboard-focusable and labelled with the table's name, on every DataTable at every width, generalising the Risk Register's region. A visible scroll-edge cue marks hidden columns; its values are decided as a recorded CSRM extension in `docs/design/csrm-design-direction.md` (this also settles Phase 7 UI review finding 2, the risk-exposure cross-tab at 375px).
- **D-30:** Search inputs name the records they search (for example "Search assessment requests"); "Search collection" disappears.
- **D-31:** The analyst revision timeline names the acting analyst wherever the stored record already identifies them, resolved to a display name server-side; if the datamodel does not identify them, a contract-gap record says so and the wording stays neutral (D-02).
- **D-32:** The analyst questionnaire review renders each question exactly once.
- **D-33:** Printing an application page prints the content without the shell (sidebar, header, mobile navigation) and stays legible (Phase 7 UI review finding 3). Any value the direction document lacks is recorded there as a CSRM extension.

### Process

- **D-34:** The UI-SPEC defers every value to `docs/design/csrm-design-direction.md`, as the 06.x and 07 specs do. It fixes copy, states and layout behaviour for D-08, D-26 to D-30, D-32 and D-33.
- **D-35:** Plans are fine-grained and serialised when they touch the same files or run Playwright. Dev servers are stopped for any plan that edits Strapi or runs Playwright. The phase gate is the full five-command gate with the production-build E2E, followed by a clean `git status`.

### Post-research decisions (orchestrator, 2026-09-25, resolving 08-RESEARCH.md "Open Questions" and the flagged security decisions)

- **D-36 (T-08-R01, Open Question 5 — IAM core routers):** approved. The generic CRUD routes of the IAM core content types `function`, `function-api`, `idambox-user`, `role` and `application` are unmounted (`only: []`), except any exact operation the served-operations inventory shows the web calling, which stays mounted exactly as called. The dead `listShellApplications` call site is removed rather than kept alive by a route. `docs/references/specification.json` is not edited for this: operations already in it that become unserved are recorded as intentionally unserved (IAM records are administered by IdamBox, not through this API surface) in the catalogue design notes and in `served-operations.json`; nothing is added to the spec for IAM. Every remaining core route gets matrix rows.
- **D-37 (T-08-R14, Open Question 3 — Users & Permissions public routes):** registration is disabled at bootstrap (`allow_register: false`) unconditionally, because CSRM holds no Users & Permissions accounts. `POST /api/auth/local` and `GET /api/users/me` stay mounted by the plugin; the matrix's no-identity actor probes them and records the observed statuses, and the surface is recorded as an accepted residual until INT-02 replaces it.
- **D-38 (T-08-R15, Open Questions 4 and 15 — `/api/roles` collision):** the inventory plan probes which handler answers before and after D-36 and records the winner in `served-operations.json`; D-36 is expected to remove the collision. The harness gains the test-only throwing middleware registered before `strapi.start()`, as the research describes, and nothing test-only ships in production code paths.
- **D-39 (Open Question 6 — Strapi headers):** `strapi::poweredBy` is removed; `strapi::security` keeps its defaults, documented in `08-SECURITY.md` with the reason (admin-panel compatibility of `frameguard` and COOP is unverified and out of scope); the generic 500 envelope is proven in the harness.
- **D-40 (Open Question 7 — parity boundary mode scope):** the parity guard gains the boundary mode. It must fail on any unregistered narrowing in the Phase 7 parsers (IN-03, resolved by declaring in the spec the bounds the server guarantees) and in every parser this phase adds or changes. Older parsers are grandfathered through one explicit allow-list entry each with a reason, and the count is recorded in VERIFICATION as a backlog; no parser stays invisible to the guard.
- **D-41 (Open Question 8 — journeys 2 and 3):** in-spec width checkpoints for the questionnaire and release journeys; Playwright projects for the other four.
- **D-42 (Open Question 9, T-08-R07 — TLS directives):** `upgrade-insecure-requests` is emitted only when the request protocol is HTTPS; HSTS is sent without `preload`; the TLS assumption is recorded in `08-SECURITY.md`.
- **D-43 (Open Question 11 — browsers):** Playwright's Chromium is installed at `/opt/ms-playwright` and selected by `PLAYWRIGHT_BROWSERS_PATH`; no plan reinstalls browsers.
- **D-44 (Open Question 12 — generic `GET /csrm-information-{systems,assets}`):** unmounted; the served `/v1` selectors are the only read surface; the catalogue design notes say so.
- **D-45 (Open Question 13 — design-direction extensions):** X-1 to X-5 from the UI-SPEC are recorded in `docs/design/csrm-design-direction.md` as the first task of the plan that first implements each (before any component change); executors never hard-code a value the document does not carry.
- **D-46 (Open Question 14 — `expect.timeout`):** stays at 15 s until the first production-build run measures; that plan may lower it with the measurement recorded.
- **D-47 (Open Question 16, T-08-R04 — session cookie):** `secure` is keyed on the request protocol (HTTPS → `Secure`), with `httpOnly` and `SameSite=Lax` unchanged; the HTTP E2E origin is a recorded residual.
- **D-48 (Open Question 17, T-08-R13 — Server Action origin check):** asserted in the hardening spec only after the executor confirms the rejection behaviour in the installed Next source; otherwise documented as a review finding, never assumed.
- **D-49 (plan shape):** the research's fifteen-plan, five-wave decomposition is accepted as a serial chain; the planner may merge the Risk Type ordering plan into the timeline plan if both stay small, and must keep one owner per file per wave. Dev servers are stopped for every plan that edits Strapi or runs Playwright.
- **D-50 (UI-SPEC UI-D3 glossary):** the plan that relabels assessment `approved` as "Released" creates the root `CONTEXT.md` (per `docs/agents/domain.md`, created lazily when a term is resolved) with a short glossary entry mapping the JDL value to the product label, and nothing more.
- **D-51 (Open Questions 1, 2 and 10):** measured in their owning plans and recorded (build time and timeouts in the production-build plan; the analyze output shape in the performance plan; the observed missing-token status per route family in the matrix).

### Planner's Discretion

Left to research and planning, within the decisions above: the mechanism for D-12 (confirmed against the Next 16.3 docs), the D-14 structure (project or parametrisation), the CSP mechanism for D-19 (proxy-issued nonce or static policy, whichever Next 16.3 supports without breaking streaming), the matrix layout for D-16, and the measurement method for D-24.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project rules and scope
- `AGENTS.md` and `apps/web/AGENTS.md` — binding engineering rules; Next.js 16.3 differs from training data.
- `docs/CSRM-PROJECT-BRIEF.md` §18 Authentication and Authorization, §21 Accessibility, §22 Security Requirements, §23 Loading, Empty and Error States, §24 Testing, §26 Performance.
- `.planning/REQUIREMENTS.md` — INT-01, INT-02 (deferred), INT-03, INT-04.
- `.planning/ROADMAP.md` Phase 8 — goal and five success criteria.
- `.planning/STATE.md` — "Risks and Open Decisions" follow-ups and "Notes carried forward".

### Contract and authorization
- `docs/references/specification.json` — the authoritative OpenAPI contract.
- `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` — byte-identical grant catalogue copies.
- `docs/references/idambox-datamodel.jdl` — domain terminology.
- `docs/contract-gaps/` — every earlier gap record; `phase-07-derived-insights.md` for Phase 7 divergences.
- `apps/strapi/src/policies/csrm-authorization.ts` — the Role → Function → FunctionAPI enforcement and human-analyst guard.
- `apps/web/src/features/contract-response-parity.test.ts` — the contract-to-client parity guard and its `narrowedPaths`.

### Design
- `docs/design/csrm-design-direction.md` — the only source of UI values (§4 status badges, DataTable, record links; §3.14 data visualisation).
- `docs/adr/0001-adopt-bproton-design-system.md` — the adopted system and its gap decisions.

### Phase 7 carry-over
- `.planning/phases/07-analyst-dashboard-reports-and-alerts/07-UI-REVIEW.md` — remaining findings 2 to 4.
- `.planning/phases/07-analyst-dashboard-reports-and-alerts/07-REVIEW.md` and `07-VERIFICATION.md` — IN-03 (parser narrowing) deferred here.

### Harness
- `apps/web/playwright.config.ts` — isolated E2E servers, attestation, and the documented `tsconfig.json`/`next-env.d.ts` rewrite.
- `apps/web/src/lib/testing/e2e-ui-state.ts` — the existing attested E2E runtime gate.
- `apps/web/src/lib/auth/development-session-adapter.ts`, `apps/web/src/lib/auth/session-adapter.ts`, `apps/web/src/lib/api/transport/server-client.ts` — the development session and transport gates D-11 changes.
- `apps/web/node_modules/next/dist/docs/` — Next 16.3 documentation (build output, `next start`, TypeScript configuration, headers, CSP and proxy).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/lib/testing/e2e-ui-state.ts`: an attestation check (file, nonce, runtime root) that D-11 can reuse rather than inventing a second trust mechanism.
- The Phase 06.9 two-Requestor fixture and the Phase 7 six-identity denial matrices (`analyst-alerts`, `analyst-reports`, `analyst-dashboard` integration tests): the building blocks for D-16 to D-18.
- `accessibility.spec.ts`, `design-system-conformance.spec.ts` and `design-contract.spec.ts`: the regression harness for every UI change in this phase.
- The shared state primitives, `DataTable`, `RecordLink`, `StatusBadge` and `RiskRatingBadge`: the only places the polish follow-ups should land.

### Established Patterns
- The web development session is gated on `NODE_ENV === 'development'` (`parseSessionRuntimeMode`), and the transport attaches the identity header only when `NODE_ENV=development` and `CSRM_DEV_IDENTITY=true`. D-11 extends these gates for the attested production-build E2E only.
- `next.config.ts` sets no headers today, and Strapi uses the default `strapi::security` middleware.
- Strapi answers an unauthorised assessment read with 404 by design; the matrix must expect 404 there.

### Integration Points
- `apps/web/playwright.config.ts` webServer commands (production build and start), `apps/web/next.config.ts` (headers, `poweredByHeader`), `apps/strapi/config/middlewares.ts` (security middleware), and `apps/web/tsconfig.json` (stale includes).
</code_context>

<specifics>
## Specific Ideas

- The production-build E2E is the vehicle for three proofs at once: journeys on the real build, the security headers with zero CSP violations, and the clean working tree after a run.
- Browser proofs must assert populated content; an axe pass alone cannot tell a populated list from its error state (lesson from the 2026-09-24 baseline).
</specifics>

<deferred>
## Deferred Ideas

- **INT-02 Keycloak** authorization-code authentication and Strapi token validation: deferred by operator decision; revisit when the operator provides a Keycloak environment.
- Report export, alert acknowledgement and notifications (Phase 7 D-06; NOTIFY-01 is v2).
- A closed bucket in the assessment status summary: nothing closes an assessment yet.
- Post-release treatment tracking (Phase 7 D-27 contract gap).
</deferred>

---

*Phase: 08-production-integration-and-hardening*
*Context gathered: 2026-09-25*
