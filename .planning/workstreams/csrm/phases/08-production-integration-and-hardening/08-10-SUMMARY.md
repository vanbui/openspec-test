---
phase: 08-production-integration-and-hardening
plan: 10
subsystem: security
tags: [csp, nonce, strict-dynamic, next-16-3, proxy, security-headers, hsts, permissions-policy, coop, x-powered-by, server-only, output-safety, server-actions, csrf, zod-jitless, instrumentation-client, playwright, vitest]

requires:
  - phase: 08-production-integration-and-hardening
    provides: the production-build browser harness that leaves the tree clean (08-02); the root and in-shell fallbacks and the boundary inventory (08-09)
provides:
  - apps/web/proxy.ts, a fresh nonce per request, with the policy set on the request (where Next reads it, plus x-nonce) and on the response; the matcher skips static files, optimised images, the favicon and prefetches
  - src/lib/security/content-security-policy.ts, buildContentSecurityPolicy({ nonce, development, https }) and CSP_NONCE_PATTERN (Next's own extraction pattern)
  - next.config.ts, nosniff, strict-origin-when-cross-origin, X-Frame-Options DENY, the Permissions-Policy and COOP same-origin on every path, HSTS in production builds only, and poweredByHeader false
  - app/layout.tsx force-dynamic, so every page renders per request and carries the nonce
  - apps/web/instrumentation-client.ts, which makes zod jitless in the browser (no eval probe) through `config` from zod/v4/core
  - next 16.3.6 (the boundary-script nonce fix, vercel/next.js#98403)
  - e2e/helpers/csp.ts, with attachCspCollector, readCspViolations and expectNoCspViolations
  - production-hardening.spec.ts, proving the header set, the nonce on every served script, a 64-route sweep for four visitors at two widths, the D-10 corroboration, the client-chunk scan and the Server Action origin check
  - docs/security/web-headers.md, the header set, the directive reasons, the development policy and the residuals
affects: [08-11 (put the collector on every journey; the request edit route), 08-12 (the Administration refusal still lacks a heading), 08-13 (first-load JS measured with next 16.3.6 and the client instrumentation), 08-14 (residual register — style-src, HSTS, report-to, the static global error, allowedOrigins, the next bump in the dependency record)]

tech-stack:
  added: []
  patterns:
    - "A nonce policy needs per-request rendering: the root layout is force-dynamic, and a page that opts back into static rendering would ship its scripts without the nonce."
    - "Code that must run in the browser before any application module lives in instrumentation-client.ts and imports narrowly, because it loads on every page."
    - "A browser proof attaches the CSP collector before its first navigation and asserts no violation after each settled destination; the collector matches both Chromium console wordings and counts securitypolicyviolation events across documents."

key-files:
  created:
    - apps/web/proxy.ts
    - apps/web/instrumentation-client.ts
    - apps/web/src/lib/security/content-security-policy.ts
    - apps/web/src/lib/security/content-security-policy.test.ts
    - apps/web/src/lib/security/proxy.test.ts
    - apps/web/src/lib/security/security-headers.test.ts
    - apps/web/src/lib/security/server-only-boundary.test.ts
    - apps/web/src/lib/security/output-safety.test.ts
    - apps/web/src/lib/security/instrumentation-client.test.ts
    - apps/web/e2e/helpers/csp.ts
    - docs/security/web-headers.md
  modified:
    - apps/web/next.config.ts
    - apps/web/app/layout.tsx
    - apps/web/e2e/production-hardening.spec.ts
    - apps/web/playwright.config.ts
    - apps/web/package.json
    - pnpm-lock.yaml
    - docs/security/strapi-http-hardening.md

key-decisions:
  - "next 16.3.3 → 16.3.6. 16.3.3 rendered the asset scripts of loading, error and template boundaries without the request nonce (create-component-styles-and-scripts), so a nonce policy blocked them: 94 blocked loads under next dev and the (app)/app/loading chunk in the production build. 16.3.5 added the nonce (vercel/next.js#98403); 16.3.6 also carries GHSA-vcvr-r3jv-pc5j. A patch release of an existing dependency; only next, @next/env and the @next/swc binaries change in the lockfile."
  - "The root layout declares force-dynamic. A nonce exists only while a request renders, and the build had prerendered /_not-found, whose eleven scripts and two inline scripts were all blocked. One declaration covers every current and future page."
  - "Zod is jitless in the browser, set in instrumentation-client.ts. Zod 4's one-off new Function probe, although caught, is reported as a script-src eval violation; jitless skips it and parses identically. The import is `config` from zod/v4/core: the z namespace put zod's whole API into every page's root chunks (+64,677 bytes gzip), while the core import adds +329."
  - "The development policy differs from production by 'unsafe-eval' in script-src and nothing else, and HSTS is not sent under next dev. React's development build needs eval to rebuild server stacks (it logs a console error without it) and the Turbopack development runtime applies hot updates with eval. Proven by unit tests of the development branch and by a live next dev sweep."
  - "The collector matches both Chromium wordings ('Refused to …' and '… violates the following Content Security Policy directive …'): Chromium 145 uses the second, so a filter on 'Refused to' alone would pass vacuously. It also reports every securitypolicyviolation event to the test process, so a violation on a document the test has left still counts."
  - "The run's attestation nonce is exposed to the specs (CSRM_E2E_ATTESTATION_NONCE_VALUE) so the chunk scan covers it, as the must-have requires; the unattested server's environment drops it."
  - "The Server Action proof adds a positive control: the real sign-in form action posted from https://evil.example is refused (500, no cookie), and the same post from the web origin runs (303, one role cookie)."

patterns-established:
  - "Every served <script> tag carries the document's nonce: asserted on /sign-in, the signed-in /app and the 404."
  - "Security headers are pinned twice: exactly in unit tests for each NODE_ENV, and as observed on the production build."

requirements-completed: [INT-04]

duration: 1h 40m
completed: 2026-09-26
---

# Phase 08 Plan 10: Nonce Content-Security-Policy, security headers and the hardening proofs Summary

**Every web response now carries the documented security header set, and every page carries a per-request nonce Content-Security-Policy with `'strict-dynamic'` and no `unsafe-eval` in production. The proxy issues the nonce, and Next applies it to every script it renders. Making that true needed three fixes the first production sweep exposed: Next 16.3.3 left the boundary scripts without the nonce (fixed by upgrading to 16.3.6), the 404 page was prerendered without one (the root layout now renders every page per request), and zod probed `eval` in the browser (now jitless). On the production build, 64 routes for the analyst, both Requestors and a signed-out visitor, at 1440 and 375px, raise no violation. No server-only name or value appears in the 76 client chunks, and a cross-origin Server Action is refused before it runs. Under `next dev` the policy differs by `'unsafe-eval'` alone, and the development sweep of 62 routes for all three actors at both widths shows no violation and no console error. The full browser suite passes 61 of 61.**

## Performance

- **Duration:** 1h 40m
- **Started:** 2026-09-25T21:36:21Z
- **Completed:** 2026-09-25T23:15Z UTC (2026-09-26 on the host's local clock)
- **Tasks:** 3 of 3, plus three source fixes the sweep required and a first-load size fix
- **Files:** 18 (11 created, 7 modified), plus this summary, STATE, ROADMAP and deferred-items

## Accomplishments

- **Policy builder and proxy (D-19, D-42).**
  - `buildContentSecurityPolicy` is pure: no `server-only`, no environment.
  - It refuses any nonce Next would not read back (base64 or base64url, padding only at the end) and never echoes a refused value.
  - `proxy.ts` sets the policy and `x-nonce` on the request and the policy on the response. It passes `development` from `NODE_ENV === 'development'` and `https` from `request.nextUrl.protocol`.
- **Static headers.** `next.config.ts` sends one rule for `/(.*)` with nosniff, `strict-origin-when-cross-origin`, `DENY`, the Permissions-Policy and COOP `same-origin`. HSTS (`max-age=63072000; includeSubDomains`, no preload) is added only when the configuration loads under `NODE_ENV=production`. `poweredByHeader: false`.
- **Guards (D-21, D-22).**
  - `server-only-boundary.test.ts` requires `import 'server-only'` as the first statement of 17 modules, enumerated from the tree, and keeps the builder pure.
  - `output-safety.test.ts` scans 230 shipped modules (`app/`, `src/`, `proxy.ts`, `instrumentation-client.ts`). It covers the six D-21 sinks plus `innerHTML`, `outerHTML` and `insertAdjacentHTML` writes, and a script or `next/script` of the application's own.
- **Proofs on the production build (Task 2).** The existing D-11 tests are unchanged, and seven tests are added:
  - the headers and the per-document nonce;
  - three sweep tests;
  - the D-10 corroboration;
  - the client-chunk scan;
  - the Server Action origin check.
- **The fixes the first sweep required:** the `next` upgrade, the root `force-dynamic`, and zod jitless with the lean import. Each is described under Deviations.
- **Record.** `docs/security/web-headers.md` covers the header set with where each is set, its decision and its ASVS item, every directive with its reason, the nonce path, the matcher, the development policy, eight residuals, the chunk scan, the origin-check table and output safety. `strapi-http-hardening.md` gained the unmounted-path note owed to 08-10 by 08-03's deferred item.

## Observed values (production build, final tree)

- **CSP on the signed-in `/app`:** `default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. The test asserts it as exactly the production string for the extracted nonce. Two consecutive `/sign-in` documents get different nonces, and `/app` gets a third. `upgrade-insecure-requests` is absent, because the E2E origin is HTTP.
- **Static headers** on `/sign-in`, `/app`, the 404 and a `/_next/static/` script:
  - `strict-transport-security: max-age=63072000; includeSubDomains`
  - `x-content-type-options: nosniff`
  - `referrer-policy: strict-origin-when-cross-origin`
  - `x-frame-options: DENY`
  - `permissions-policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`
  - `cross-origin-opener-policy: same-origin`
  - no `x-powered-by`
  The static script carries no CSP (the matcher skips it). No page sends `x-nonce` or any `x-middleware-*` header.
- **Nonce in the HTML:** every `<script>` tag of the served `/sign-in`, `/app` and 404 documents carries that document's nonce.
- **Sweep:** zero `securitypolicyviolation` events and zero policy console messages. Every route rendered its heading and content with no error state, or its permission state or not-found card.
  - Security Analyst, 38 routes: 37 planned plus the in-shell not-found `/app/admin/not-a-collection`. The 37 include the first admin record of each collection, which the plan's list did not name.
  - Requestor, 13 routes, including 5 refusals.
  - Secondary Requestor, 10 routes (empty lists and the refusals).
  - Signed out, 3: `/`, `/sign-in`, and `/app/this-route-does-not-exist` (404).
  - Each route at 1440 and 375px: 128 document loads, plus the list loads that find each first record.
- **Directives added because the sweep demanded them:** none. Every violation was fixed at its source, and the policy is exactly as planned.
- **Client chunks:** 76 files scanned on the final tree (77 in the earlier runs) for 16 needles:
  - the nine environment names;
  - `x-csrm-dev-identity`;
  - the run's token, attestation nonce and Strapi API base URL;
  - three fixture emails.
  None was found.
- **Server Action statuses:**
  - fetch action (`Next-Action` of forty zeros, `text/plain`, body `[]`): foreign `https://evil.example` 500, same-origin 404 (the origin check passed; no such action);
  - the real sign-in form action (multipart): foreign 500 with no cookie, same-origin 303 to `/app` with one `csrm-development-role` cookie.
  The source reading of `action-handler.js` lines 427–467 (16.3.6) holds, so D-48 is asserted, not recorded as a finding.
- **D-10:** after a client-side navigation to the Risk Register, the document is kept, `nextjs-portal` has count 0, and there is no `webpack-hmr` or `turbopack-hmr` request and no websocket.

## The development policy (`next dev`), the orchestrator's addition

- **Differences from production:**
  - `script-src 'self' 'nonce-<n>' 'strict-dynamic' 'unsafe-eval'`: `'unsafe-eval'` is the only difference in the policy.
  - `Strict-Transport-Security` is not sent.
  - Everything else is identical, including `connect-src 'self'`, which covers the same-origin hot-reload socket `ws://<host>:<port>/_next/hmr`.
- **Why:**
  - React's development Flight client evaluates code to rebuild server stacks. Its bundle says: "React requires eval() in development mode…" and it logs `eval() is not supported in this environment` as a console error without it.
  - Turbopack's development runtime applies hot updates with `eval(code)` (`_eval`).
- **Unit proof:**
  - `content-security-policy.test.ts` › "the development policy (next dev)", four cases: the exact string, `'unsafe-eval'` as the only difference, the directive count, and no `'unsafe-inline'` in `script-src`.
  - `proxy.test.ts` › "allows 'unsafe-eval' only under next dev" (development, production, test).
  - `security-headers.test.ts` › "leave HSTS out of next dev and change nothing else".
- **Live proof on an isolated `next dev`** (Next 16.3.6, its own Strapi on port 29337 and a throwaway database; ports 1337 and 3000 untouched):
  - Security Analyst, Requestor, Secondary Requestor and signed out: 62 routes, each at 1440 and 375px, 124 page loads.
  - Zero violations and zero console errors or warnings. The only messages were the browser's own `Failed to load resource: … 404` on the deliberate `/app/this-route-does-not-exist`, at both widths.
  - Every response carried the development policy.
  - A Controls record and the in-shell not-found (200 under `next dev` as in production) were visited separately, also clean.
  - The hot-reload socket connected under the policy with no violation. An edit to a client component produced `building`, `serverComponentChanges` and `built` frames with no violation or console message.
- **Before the fixes** (16.3.3), the same development sweep showed 94 blocked loads of three boundary chunks on 84 of 126 visits.

## Task Commits

1. **Task 1: policy builder, proxy, static headers, guards**
   - `e8ddb6b` test(08-10): pin the content security policy and the server-only and output-safety boundaries (RED)
   - `abf137e` feat(08-10): issue a per-request nonce CSP and the documented security headers on every web response (GREEN)
2. **The fixes the production sweep required**
   - `ced9bf3` fix(08-10): upgrade next to 16.3.6 so loading, error and template boundary scripts carry the CSP nonce
   - `5f63a6e` test(08-10): expect every page rendered per request and zod kept off eval in the browser (RED)
   - `dde7a30` fix(08-10): render every page per request and keep zod off eval so no page breaks the nonce policy (GREEN)
3. **Task 2: the production proofs**
   - `cb97f74` test(08-10): prove the security headers, zero CSP violations, clean client chunks and the Server Action origin check on the production build
   - `747179a` test(08-10): scan the proxy and the client instrumentation for unsafe sinks too
4. **Task 3: the record, the full run and the gate**
   - `8e700ab` docs(08-10): record the web security headers, the content security policy and its residuals
   - `4a30110` fix(08-10): load only zod's config in the client instrumentation so no page's first load grows
   - `7e34e90` docs(08-10): record why the client instrumentation imports only zod's config

**Plan metadata:** the `docs(08-10): complete …` commit carrying this summary, STATE, ROADMAP, deferred-items and the two record touch-ups (the final chunk count and the two notes owed to 08-10).

## TDD Gate Compliance

- **Task 1 (`e8ddb6b` → `abf137e`).**
  - RED: `content-security-policy.test.ts` and `proxy.test.ts` failed to load (modules missing), and `security-headers.test.ts` failed 5 of 5.
  - `server-only-boundary.test.ts` passed 19 and failed 1, the pure-module check, whose module did not exist yet. `output-safety.test.ts` passed 457 of 457 as a guard.
  - GREEN: 7 files, 622 tests.
- **Fixes (`5f63a6e` → `dde7a30`).**
  - RED: `instrumentation-client.test.ts` could not resolve its module, and `proxy.test.ts` › "per-request rendering" failed (18 other cases passed).
  - GREEN: 84 files, 1593 tests.
  - The Next upgrade (`ced9bf3`) had its RED in the browser: isolated run 1 on 16.3.3 failed 5 of 9, and the first development sweep showed 94 blocked loads.
- **The lean import (`4a30110`)** has a static check that fails against the previous import and passes on the new one (run both ways before the commit).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, framework] Next 16.3.3 omitted the nonce on the asset scripts of `loading`, `error` and `template` boundaries**
- **Found during:** the development sweep after Task 1 (94 blocked loads) and isolated run 1 (`019_1xdtvdu7k.js`, the `(app)/app/loading` chunk, on `/app/requests/new`).
- **Issue:** `create-component-styles-and-scripts` built `<script src async>` without `nonce: ctx.nonce`, while the layer assets beside it passed the nonce. The minified runtime bundles had the same omission, so `'strict-dynamic'` blocked them.
- **Fix:** bump `next` to 16.3.6. 16.3.5 added the nonce (vercel/next.js#98403, release notes "Add CSP nonce to script tags of loading and template files"); 16.3.6 adds the fix for GHSA-vcvr-r3jv-pc5j (`next/og`, unused). A local patch was rejected: each fix is on a 50–90 KB minified line, so the patch file would have been megabytes.
- **Checks:**
  - The lockfile diff covers only `next`, `@next/env` and the ten `@next/swc-*` entries.
  - `pnpm peers check` shows only the pre-existing `codemirror` warning (Strapi admin).
  - `pnpm audit`, run before the bump, flagged nothing against `next`.
- **Files:** `apps/web/package.json`, `pnpm-lock.yaml`. **Commit:** `ced9bf3`.

**2. [Rule 1 - Bug] The build prerendered the unmatched-URL page without a nonce**
- **Found during:** isolated run 1. `/app/this-route-does-not-exist` raised 14 violations: 11 script files, one of them twice, and 2 inline scripts.
- **Issue:** `/_not-found` (with `/` and `/_global-error`) was static in the prerender manifest. A static page cannot carry a per-request nonce.
- **Fix:** `export const dynamic = 'force-dynamic'` in the root layout, with its reason. The 404 is now rendered per request, and every script tag on it carries the nonce (asserted).
- **Files:** `apps/web/app/layout.tsx`. **Commits:** `5f63a6e`, `dde7a30`.

**3. [Rule 1 - Bug] Zod's `new Function` probe raised an `eval` violation in the browser**
- **Found during:** isolated run 1 (`script-src: eval` on `/app/requests/new` and after navigating to `/app/risks`). The dev sweep could not see it, because development allows eval.
- **Issue:** zod 4.4.3 tries `new Function("")` once, when it builds the first object schema, to choose compiled parsers. The caught failure is still reported as a violation. Zod's source notes this and skips the probe under `jitless`.
- **Fix:** `apps/web/instrumentation-client.ts` sets `jitless` before any application module runs. The config is shared through `globalThis.__zod_globalConfig`. The server keeps compiled parsers.
- **Files:** `apps/web/instrumentation-client.ts`, `src/lib/security/instrumentation-client.test.ts`. **Commits:** `5f63a6e`, `dde7a30`.

**4. [Rule 1 - Bug, performance] The first version of the instrumentation put zod's whole API into every page's first load**
- **Found during:** Task 3, inspecting the final build's root chunks.
- **Issue:** `import { z } from 'zod'` added a 283 KB chunk (`ZodObject`, `ZodPipe`, `toJSONSchema` …) to `rootMainFiles`, which every page loads, `/sign-in` included.
- **Measured** (root main files):

  | Variant | Raw bytes | Gzip bytes |
  |---|---|---|
  | No instrumentation | 438,930 | 130,293 |
  | `z` namespace | 722,544 | 194,970 |
  | `config` from `zod/v4/core` | 440,282 | 130,622 |

- **Fix:** import `config` from `zod/v4/core`. A static check pins it and fails against the old import.
- **The baseline build:** its type check failed only because the test imports the removed file; compilation had succeeded, so its manifest is valid.
- **Commit:** `4a30110`. The final full run (61/61) ran after this commit.

**5. [Rule 1 - Bug in the plan's collector] Chromium 145 no longer words a CSP block "Refused to …"**
- **Found during:** a probe of the installed Chromium before writing the collector.
- **Issue:** the plan's console filter matched only `Refused to`, which would have passed while violations occurred.
- **Fix:** the collector matches `Refused to` or `Content Security Policy`, and also counts every `securitypolicyviolation` event through a binding that survives navigations. The acceptance string `Refused to` stays.
- **Files:** `e2e/helpers/csp.ts`.

**6. [Rule 2 - Missing for the proof] The attestation nonce was not visible to specs**
- **Issue:** the must-have requires the chunk scan to cover the run's attestation nonce. Each Playwright worker re-evaluates the config with a fresh nonce, so a spec could not know the server's. The plan's interface said to expose it only if the config already did.
- **Fix:** `process.env.CSRM_E2E_ATTESTATION_NONCE_VALUE ??= e2eRuntimeNonce` in `playwright.config.ts`, beside the other exposed run values. The unattested server's environment deletes it, and a failure names needles, never values.
- **Files:** `apps/web/playwright.config.ts`, `e2e/production-hardening.spec.ts`. **Commit:** `cb97f74`.

### Plan-text deviations and additions

7. **Additional unit tests beyond the plan's three files:**
   - `proxy.test.ts` covers the request and response headers through Next's own forwarding, the fresh nonce, protocol and `NODE_ENV`, and the exact matcher through `unstable_doesMiddlewareMatch`. The 16.3 docs name it `unstable_doesProxyMatch`, but the installed package exports only the older name.
   - `security-headers.test.ts` covers the static headers per `NODE_ENV` by loading `next.config.ts`.
   - `instrumentation-client.test.ts`.
   - The nonce check round-trips through Next's `getScriptNonceFromHeader`.
8. **The nonce pattern is stricter than the plan's character class:** padding is allowed only at the end, as in Next's extraction regex. A nonce Next would silently ignore is refused where it is made.
9. **The output-safety scan is wider:** eight sinks where the plan named six, plus a script or `next/script` of the application's own, plus the two root modules (230 modules).
10. **The sweep is wider than the planned list:**
    - both widths;
    - the Secondary Requestor (empty states);
    - the first record of each admin collection;
    - `/` signed out;
    - the in-shell not-found.
    Two changes to the plan's expectations:
    - The Requestor's `/app/admin/controls` refusal asserts the permission state and title without a heading, because that page renders none (the known gap 08-12 owns).
    - `/app/admin/not-a-collection` answers 200 in production and under `next dev`, because its `notFound()` is raised while the shell streams. It is asserted as observed.
11. **Not swept:** the request edit route. No seeded draft exists and a sweep should not create one. The Requestor journey reaches it under the enforced policy, and 08-11 adds the collector there.
12. **The Server Action proof adds the genuine same-origin form post as a control.** Playwright omits a multipart field whose value is empty, so the action field carries a placeholder; Next reads only the field name. Found by replaying the request against the built app, where the same post with curl answered 303.
13. **The HTML nonce check** (every served script tag carries the nonce) catches a nonce regression even where no script would visibly break.
14. **Windows host translations** follow the preamble:
    - Node 24 from `/c/ProgramData/nvm/v24.19.0`, with no `PLAYWRIGHT_BROWSERS_PATH`;
    - ports checked with `Get-NetTCPConnection`;
    - logs in `apps/web/.tmp/logs/csrm-phase-08/`.
    `pnpm --filter @csrm/web test -- <patterns>` runs the whole suite (vitest ignores patterns after `--`), so targeted runs used `pnpm exec vitest run <paths>`.

**Total deviations:** 6 auto-fixed (4 Rule 1 in code or the dependency, 1 Rule 1 in the plan's collector, 1 Rule 2 in the harness) and 8 recorded.

**Impact:** no Strapi source, content-type schema, contract, grant, `CSRM_AI_*` or Keycloak change. There is no new dependency, only a patch-release bump of `next` with its reason. The policy is exactly the planned one.

## Issues Encountered

- **Isolated run 1 (16.3.3) failed 5 of 9, which proved the collector against real violations.**
  - The analyst sweep caught the boundary chunk and `eval` on `/app/requests/new`.
  - The Requestor sweep caught the same.
  - The signed-out sweep caught 14 on the 404.
  - The client-side navigation caught `eval` on `/app/risks`.
  - The Server Action control failed on Playwright's empty multipart field.
  Runs 2 and 3 on the fixed tree each passed 9 of 9 in 86 s wall.
- **Development check 1** (16.3.3): 126 visits, 94 blocked loads on 84 visits, all `script-src-elem` for three boundary chunks. The only other findings were the 404's own resource message and the Administration refusal having no heading. After the fixes, check 2 found none.
- **Hot updates in the isolated `next dev`:** an edit to a client component did not apply in the open page, and it behaved identically with `proxy.ts` removed (no policy at all). The policy raised nothing throughout. This is recorded for the orchestrator's usual `next dev` (browser backstop 3).
- **Logs:** the production server logged `The destination stream closed early.` 8 times in the final run. This is recorded in the web record, closing 08-02's deferred item.

## Verification

| Command | Result |
|---|---|
| `pnpm --filter @csrm/web exec vitest run src/lib/security` (after Task 1 GREEN) | 7 files, 622 passed |
| `pnpm --filter @csrm/web test` (final code tree) | **84 files, 1598 tests passed** (1055 before the plan plus 543: 33 policy, 19 proxy, 5 static headers, 20 boundary, 463 output safety, 3 instrumentation) |
| `pnpm --filter @csrm/web typecheck` (final tree) | exit 0 |
| `pnpm --prefix apps/web api:check` | exit 0, no drift |
| `production-hardening.spec.ts` isolated, run 1 (16.3.3) | 4 passed, 5 failed (the RED above), 50 s |
| same, run 2 (fixed tree) | **9 passed** (1.4 min, 86 s wall) |
| same, run 3 (with the in-shell not-found step) | **9 passed** (1.4 min, 86 s wall) |
| Full Playwright suite, run 1 (before the lean import) | **61 passed / 0 failed / 0 flaky** (7.8 min, 468 s wall) |
| **Full Playwright suite, final tree** (started 22:52:18Z) | **61 passed / 0 failed / 0 flaky**, no retries (7.8 min, 470 s wall); 54 before the plan, minus the 2 existing hardening tests counted again, plus 9 |
| `git status --porcelain` before and after each full run | empty and empty |
| `pnpm --filter @csrm/strapi test` | **504 passed / 0 failed / 0 skipped** (507.9 s, 512 s wall); unchanged count, no Strapi file changed |
| Development sweep on an isolated `next dev` (16.3.6) | 124 visits, 62 routes, 3 actors and signed out, at 1440 and 375: 0 violations; the only console errors were the 404 document's own resource message (2) |
| Frozen-path diff since `2f6e4a6` (`apps/strapi`, `docs/references`, `.env*`); added lines with `CSRM_AI_` or Keycloak | empty; 0 |
| Tool attribution in this plan's commit messages and added lines | 0 and 0 |
| Acceptance criteria re-run on the final tree (Task 1: 24 checks; Task 2: 15; Task 3: 12) | 51 of 51 passed |

## Known Stubs

None.

## Threat Flags

None. The plan adds no endpoint, grant or data path. `proxy.ts` only sets headers; authorization stays in each Server Action and in Strapi. `instrumentation-client.ts` sets a parser switch. Each mitigation in the register holds:

- **T-08-10-01:** the nonce with `'strict-dynamic'`, no `unsafe-eval` in production, and the zero-violation sweep. The style residual is recorded.
- **T-08-10-02:** `frame-ancestors 'none'`, DENY, COOP and the Permissions-Policy.
- **T-08-10-03:** HSTS without preload in production builds, the upgrade only over HTTPS, and the TLS assumption recorded.
- **T-08-10-04:** no `X-Powered-By`.
- **T-08-10-05:** 17 guarded modules and a scan of 76 chunks.
- **T-08-10-06:** the origin check asserted with a positive control, and `allowedOrigins` documented.
- **T-08-10-07:** output safety over 230 modules.

## Open issues for the orchestrator (also in `deferred-items.md`)

1. **Restart `next dev`.** A dev server started before this plan still runs Next 16.3.3 in memory, without the proxy and the instrumentation. `node_modules` in this checkout already holds 16.3.6 after `pnpm install`.
2. **The dependency audit record predates the `next` bump.** 08-14 should re-run `pnpm audit` on the bumped lockfile and cite the bump.
3. **For 08-14's residual register:**
   - `style-src 'unsafe-inline'` (sonner and Radix);
   - HSTS unverifiable over HTTP and sent without preload;
   - the static `/_global-error` copy (`pages/500.html`), whose scripts carry no nonce;
   - no `report-to`;
   - `allowedOrigins` if a proxy rewrites the host.
4. **For 08-11:** put the collector (`attachCspCollector` / `expectNoCspViolations`) on every journey, including the request create, edit and submit journey that reaches the edit route. The helper's two wordings matter on Chromium 145.
5. **For 08-12:** the Requestor's Administration refusal still has no level-one heading.
6. **For 08-13:** measure first-load JS on 16.3.6. The instrumentation adds 329 bytes gzip to the root chunks.

## Browser backstops for the orchestrator

Against `next dev` on port 3000, after restarting it. For each item, check the Network panel's response headers and the Console, and watch for `securitypolicyviolation`.

1. **Every route, for all three actors, at 1440 and 375.** The routes are in the sweep lists in `e2e/production-hardening.spec.ts`:
   - analyst: the personal routes, `/app/review/**`, `/app/risks` and a Risk, `/app/alerts`, `/app/reports` and the four reports, and all 16 `/app/admin/**` routes;
   - Requestor and Secondary Requestor: the personal routes and the five refusals;
   - signed out: `/sign-in` and `/app/this-route-does-not-exist`.
   Expect zero CSP violations and zero console errors. The one expected message is `Failed to load resource: … 404` on the deliberate 404.
2. **Response headers on a page** (for example `/app`) under `next dev`:
   - `content-security-policy` = `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
   - `x-content-type-options: nosniff`;
   - `referrer-policy: strict-origin-when-cross-origin`;
   - `x-frame-options: DENY`;
   - `permissions-policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`;
   - `cross-origin-opener-policy: same-origin`;
   - no `strict-transport-security` (development), no `x-powered-by`, no `x-nonce`.
   A `/_next/static/…` script has the same static headers and no CSP.
3. **Hot updates.** Edit a client component's visible text, for example `More filters` in `src/features/risks/risk-register-filters.tsx`, while `/app/risks` is open, and confirm it applies without a reload. In my isolated setup it did not apply, with or without the proxy. The policy raised nothing, but this was not checked on your usual `next dev` (default `.next` dist directory).
4. **Sign-in and a Server Action** (for example saving a Risk mitigation) work under the policy at both widths, as the full suite shows on the production build.
5. **The 404** (`/app/this-route-does-not-exist`) renders the `Page not found` card with working styles and no violation. It is now rendered per request.

## Next Phase Readiness

- `REQUIREMENTS.md` is unchanged, as in 08-01 to 08-09. INT-04 closes at the phase gate (08-14).
- **08-11 can start.** It takes the collector helper, the three sweep lists as a model, and the 64-route baseline. Its D-18 text still needs `Page not found` (08-09's open issue 4).

## Self-Check: PASSED

- Created files exist:
  - `apps/web/proxy.ts`
  - `apps/web/instrumentation-client.ts`
  - `apps/web/src/lib/security/content-security-policy.ts`, with its test, `proxy.test.ts`, `security-headers.test.ts`, `server-only-boundary.test.ts`, `output-safety.test.ts` and `instrumentation-client.test.ts`
  - `apps/web/e2e/helpers/csp.ts`
  - `docs/security/web-headers.md`
- The ten plan commits are on `dev`: `e8ddb6b`, `abf137e`, `ced9bf3`, `5f63a6e`, `dde7a30`, `cb97f74`, `747179a`, `8e700ab`, `4a30110` and `7e34e90`.
- The acceptance criteria of all three tasks were re-run on the final tree: 51 of 51.
- Neither this plan's commits nor this summary carry tool attribution or a trailer.

---
*Phase: 08-production-integration-and-hardening*
*Completed: 2026-09-26*
