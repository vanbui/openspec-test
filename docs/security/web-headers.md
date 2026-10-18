# Web security headers and Content-Security-Policy (Phase 8)

- **Date:** 2026-09-26
- **Scope:** every HTTP response of the Next.js web application (`apps/csrm`, Next 16.3.6): documents, Server Action posts, client-side navigation requests and static assets, on a production build (`next build`, then `next start`) and under `next dev`. The Strapi API's headers are recorded in `docs/security/strapi-http-hardening.md`. With that record, this document is an input to the phase security record.
- **Decisions:** D-19 (the header set, the Content-Security-Policy, zero violations), D-21 (validation record: output safety), D-22 (no server-only value in the browser), D-42 (TLS directives), D-47 (the session cookie's `Secure` flag) and D-48 (the Server Action origin check).
- **Threats:** T-08-10-01 to T-08-10-07 (T-08-R05, R06, R07, R08, R11, R13 and R18).
- **Evidence:** every production value below was observed on the production build by `apps/csrm/e2e/production-hardening.spec.ts` (2026-09-26) and is pinned by the unit tests in `apps/csrm/src/lib/security/`. The development policy was observed on an isolated `next dev`. Each section names its proofs.

## Header set

| Header | Value | Set by | Applies to | Decision | ASVS 4.0.3 |
|---|---|---|---|---|---|
| `Content-Security-Policy` | the policy below, with a fresh nonce for each request | `apps/csrm/proxy.ts`, through `buildContentSecurityPolicy` in `src/lib/security/content-security-policy.ts` | every request the matcher admits: documents, Server Action posts and client-side navigation requests | D-19, D-42 | V14.4.3 |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | `apps/csrm/next.config.ts`, `headers()`, only when `NODE_ENV` is `production` as the configuration loads | every path, static assets included | D-19, D-42 | V14.4.5 |
| `X-Content-Type-Options` | `nosniff` | `next.config.ts` | every path | D-19 | V14.4.4 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `next.config.ts` | every path | D-19 | V14.4.6 |
| `X-Frame-Options` | `DENY` | `next.config.ts` | every path | D-19 | V14.4.7 |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | `next.config.ts` | every path | D-19 | none (defence in depth) |
| `Cross-Origin-Opener-Policy` | `same-origin` | `next.config.ts` | every path | D-19 (T-08-R06) | none (defence in depth) |
| `X-Powered-By` | absent | `next.config.ts`, `poweredByHeader: false` | every path | D-19 | V14.3.3 |

Each value was observed on `/sign-in`, on the signed-in `/app`, on the 404 document and on a `/_next/static/` script. The static script carries no `Content-Security-Policy`, because the matcher leaves static files to the static headers. The nonce never reaches the browser as a header of its own: `x-nonce` is set on the request only. Next removes the request headers it forwards (`x-middleware-request-*`, `x-middleware-override-headers`) from the response. Chromium 145, the browser the suite runs, logs nothing for `browsing-topics` in the permissions policy.

## The Content-Security-Policy

The production policy, observed on the signed-in `/app` (nonce elided):

```
default-src 'self'; script-src 'self' 'nonce-<nonce>' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

| Directive | Value | Reason |
|---|---|---|
| `default-src` | `'self'` | The fallback for every fetch directive not listed (media, frames, workers, manifests): the web origin only. |
| `script-src` | `'self' 'nonce-<nonce>' 'strict-dynamic'` | A script runs only if it carries this request's nonce, and `'strict-dynamic'` extends that trust to the chunks Next's nonce-bearing scripts load. An injected inline script, event-handler attribute or `javascript:` URL has no nonce and is blocked, and so is `eval`. CSP Level 3 browsers ignore `'self'` alongside `'strict-dynamic'`; it is kept as the fallback for older ones. |
| `style-src` | `'self' 'unsafe-inline'` | Inline styles are allowed; see residual 1. |
| `img-src` | `'self' data: blob:` | The logo and icons are same-origin, CSS and components use `data:` images, and `blob:` covers object URLs. No image loads from another origin, so CSS cannot send data to a foreign host through an image request. |
| `font-src` | `'self'` | The three families are self-hosted from `apps/csrm/app/fonts/` through `next/font/local` (G-10) and served from `/_next/static/media`, so neither the build nor the browser contacts a font host. |
| `connect-src` | `'self'` | The browser talks only to the web origin (client-side navigations and Server Actions). It never calls Strapi, whose API token stays on the server. |
| `object-src` | `'none'` | No plugins. |
| `base-uri` | `'self'` | An injected `<base>` cannot re-point relative URLs. |
| `form-action` | `'self'` | Forms, the sign-in form and every Server Action form among them, post only to the web origin. |
| `frame-ancestors` | `'none'` | No page may be framed (clickjacking). This is the same rule as `X-Frame-Options: DENY`, for CSP-aware browsers. |
| `upgrade-insecure-requests` | sent only when the request arrived over HTTPS | D-42. Over plain HTTP (the development and test origins) it would upgrade the page's own requests to an HTTPS port nothing listens on. Next reports HTTPS when the socket is TLS or `x-forwarded-proto` says `https`. |

### How the nonce reaches every script

- `proxy.ts` generates a nonce for each request with `Buffer.from(crypto.randomUUID()).toString('base64')`: a version 4 UUID, with 122 random bits. It sets the nonce in the request's `Content-Security-Policy` and `x-nonce` headers and sets the policy on the response.
- Next reads the nonce from the request header while it renders (`getScriptNonceFromHeader` in `next/dist/server/app-render`). It puts the nonce on its framework and page scripts, its inline flight data and the asset scripts of `loading`, `error` and `template` boundaries. `CSP_NONCE_PATTERN` in the builder is the pattern Next uses to read the nonce back, so a nonce Next would ignore is refused where it is made.
- The first sweep of the production build found three further causes of violations, each fixed at its source:
  1. **Next 16.3.3 to 16.3.6.** 16.3.3 rendered the asset scripts of `loading`, `error` and `template` boundaries without the nonce (`create-component-styles-and-scripts`), so the policy blocked them. Under `next dev` this produced 94 blocked loads of three boundary chunks across the signed-in routes. In the production build it blocked the `(app)/app/loading` chunk on `/app/requests/new`. Next 16.3.5 added the nonce (vercel/next.js#98403). 16.3.6 also fixes GHSA-vcvr-r3jv-pc5j, in `next/og`, which CSRM does not use.
  2. **Every page renders per request** (`export const dynamic = 'force-dynamic'` in `app/layout.tsx`). A nonce exists only while a request renders. The build had prerendered the unmatched-URL page (`/_not-found`), so its eleven script files and its two inline scripts carried no nonce, and every one was blocked.
  3. **Zod parses without code generation in the browser** (`apps/csrm/instrumentation-client.ts`). Zod 4 tries `new Function` once, when the first object schema is built, to decide whether it can compile its parsers. The browser reported that caught attempt as a `script-src` `eval` violation on the request form and the Risk Register. The instrumentation file runs before the application's modules and switches zod to jitless parsing, which skips the attempt; parsing and rejection are unchanged. The server never runs the file and keeps compiled parsers. The file imports `config` from `zod/v4/core` rather than the `z` namespace, because it loads on every page. Measured on the root chunks, it adds 329 bytes gzipped; the namespace would have added 64,677.
- Proof in the served HTML: every `<script>` tag of the `/sign-in`, signed-in `/app` and 404 documents carries that document's nonce, and consecutive documents get different nonces.

### The matcher

`proxy.ts` runs for `'/((?!_next/static/|_next/image$|icon\\.png$).*)'`, the matcher the Next CSP guide recommends with each exclusion anchored. A request that carries `next-router-prefetch` or `purpose: prefetch` is skipped only while it declares no body; one that declares a body (`Content-Length` or `Transfer-Encoding`) runs the proxy like any other (Phase 14 stage B, CR-402).

- **Excluded:** static files (`/_next/static/`, every script and stylesheet the pages load), optimised images (exactly `/_next/image`; the matcher tests the path without its query) and the favicon (exactly `/icon.png`). None of these is a document, so a policy on them would govern nothing.
- **Anchored (SR-05):** each exclusion names one real path. Until the phase code review the lookahead was unanchored and its dot unescaped, so `/iconXpng`, `/icon.png-x`, `/_next/staticfoo` and `/_next/imagery` skipped the proxy and rendered the not-found document with no policy and no nonce. A URL that only resembles an exclusion now renders under the policy; `proxy.test.ts` and `production-hardening.spec.ts` prove it.
- **Also excluded, while bodiless:** a prefetch, which fetches data for a later navigation and renders no document, so it gets no policy work and no session refresh. Until the Phase 14 code review the exclusion held whatever the request carried, so a POST with either prefetch header skipped the Server Action body gate too (CR-402). It now holds only for a request that declares no body (under HTTP/1.1, which Next's server speaks, a request with neither `Content-Length` nor `Transfer-Encoding` has none), so the body gate sees every request with a body. The exclusion has to be in the matcher: Next strips the router's `next-router-prefetch` header from the request before `proxy()` reads it, so inside the function a router prefetch looks like any other GET.
- **The body gate runs first:** before any policy work, `proxy()` answers 413 to a POST over 6 MiB, or one with no decimal `Content-Length`, unless it is a `multipart/form-data` post on one of the four pages that add files (Phase 14 D-25; `src/lib/security/action-body-limit.ts`; R-08-04 in `phase-08-residual-risks.md`).
- **Static headers still apply:** Next applies `headers()` from `next.config.ts` to every path before the proxy runs, so excluded requests keep the static headers. This was observed on a `/_next/static` script.
- **Server Actions pass the proxy:** a Server Action is a POST to its page's path. The proxy only adds headers, after the body gate above has admitted the post. Authorization stays in each action and in Strapi.
- The application has no `/api` routes.

## The development policy (`next dev`)

- **The difference:** `script-src` gains `'unsafe-eval'`, giving `script-src 'self' 'nonce-<nonce>' 'strict-dynamic' 'unsafe-eval'`. There are two reasons:
  - React's development build evaluates code to rebuild server error stacks in the browser; without `eval` it logs `eval() is not supported in this environment` as a console error.
  - The Turbopack development runtime applies hot updates with `eval` (its `_eval`).
  Neither happens in a production build, which never allows `eval`.
- **Unchanged:** the nonce and `'strict-dynamic'`, `style-src`, `img-src`, `font-src`, and `connect-src 'self'`. The hot-reload socket, `ws://<host>:<port>/_next/hmr`, is same-origin, and CSP Level 3 `'self'` matches it. The object, base, form and frame rules are also unchanged.
- **Not sent under `next dev`:** `Strict-Transport-Security`. `next.config.ts` adds it to the header list only when `NODE_ENV` is `production` as the configuration loads.
- **Selection:** the proxy chooses the development policy when `process.env.NODE_ENV === 'development'`, which only `next dev` sets. `next start`, the E2E run included, is production, and a unit-test run is neither.
- **Unit proof:**
  - `content-security-policy.test.ts` › "the development policy (next dev)" pins the exact development string. It asserts that `'unsafe-eval'` is the only difference from production and that `'unsafe-inline'` stays out of `script-src`.
  - `proxy.test.ts` › "allows 'unsafe-eval' only under next dev" covers `development`, `production` and `test`.
  - `security-headers.test.ts` › "leave HSTS out of next dev and change nothing else".
- **Live proof (2026-09-26, Next 16.3.6):** an isolated `next dev` with its own Strapi and database.
  - The sweep covered the Security Analyst, the Requestor, the Secondary Requestor and a signed-out visitor: 62 routes, each at 1440px and 375px, 124 page loads. It found no CSP violation and no console error or warning. The one exception is the browser's own `Failed to load resource: the server responded with a status of 404` on the deliberate 404 document.
  - A Controls record and the in-shell not-found were visited separately at both widths, with the same result.
  - Every response carried the development policy.
  - The hot-reload socket connected. An edit to a client component produced the server's update frames (`building`, `serverComponentChanges`, `built`) with no violation and no console message. In that isolated setup the client-side update did not apply, and it behaved identically with `proxy.ts` removed, so the policy is not the cause.

## Residuals (accepted, with reasons)

1. **`style-src 'unsafe-inline'`.**
   - **Why it is needed:** `sonner` injects a `<style>` element when its module loads (`sonner/dist/index.mjs`, mounted through the root layout's `Toaster`). Radix renders `style` attributes during server rendering. Neither can carry the nonce, and a nonce in `style-src` would make CSP Level 3 browsers ignore `'unsafe-inline'` and block both.
   - **What limits it:** scripts stay strict, so injected CSS cannot run code. `img-src` and `font-src` admit no foreign origin, so CSS cannot send data out through an image or font request.
   - **To close it:** nonce every style emitter, or replace them.
2. **HSTS is unverifiable over the plain-HTTP E2E origin, and it is sent without `preload`.**
   - Browsers ignore the header over HTTP, so the suite proves only that it is sent.
   - The two-year `max-age` with `includeSubDomains` binds every subdomain of the deployment's host to HTTPS once a browser has seen it over TLS, and the operator must be ready for that.
   - `preload` is left out because leaving the browsers' preload lists is slow and not under the operator's control (D-42, the same line as Strapi's HSTS).
3. **`upgrade-insecure-requests` is sent only over HTTPS.** Behind a TLS-terminating proxy, the proxy must forward `x-forwarded-proto: https`, or the directive is never sent. A client that forges `x-forwarded-proto: https` on plain HTTP changes only its own response.
4. **The development session cookie's `Secure` flag follows `x-forwarded-proto`** (D-47, `development-session-adapter.ts`). The cookie stays `httpOnly` and `SameSite=Lax`, and it is not `Secure` on the plain-HTTP E2E origin. The development session exists only while INT-02 is deferred, and then only in a `next dev` compilation or, in a production build, inside the attested E2E runtime. `resolveSessionRuntimeMode` keys it on the `NODE_ENV` the build was compiled with, so a production build started with `NODE_ENV=development` has no session (SR-01; until the phase code review it read the runtime value and did).
5. **A TLS-terminating reverse proxy is assumed in production.**
   - It must set `x-forwarded-proto`, which drives the upgrade directive and the cookie's `Secure` flag.
   - It must keep the public host in `Host` or `x-forwarded-host`, because the Server Action origin check compares the request's `Origin` with them.
   - If the proxy rewrites the host to an internal name, set `experimental.serverActions.allowedOrigins` in `next.config.ts` deliberately, to the public origin only and never to a wildcard (T-08-R13). Otherwise every Server Action is refused as cross-origin.
6. **The build still prerenders `/_global-error`, and copies it to `pages/500.html`.**
   - By the installed source, an error inside the application's rendering, a failing root layout included, is rendered per request with the request's nonce. The suite cannot reach that path without breaking the root layout.
   - The static copy is served only when Next fails outside the application's rendering. There its scripts carry no nonce, so the page shows its static "Something went wrong" copy and "Try again" does nothing.
7. **Nothing reports violations** (`report-to`). A violation in production goes unobserved, because a reporting endpoint would be a new route. The sweep proves there are none on the delivered routes.
8. **A nonce needs per-request rendering.** A page that opts back into static rendering (`force-static`, fully static params, Partial Prerendering or Cache Components) would ship its scripts without the nonce. Re-run the hardening sweep before adopting any of them.

## Client chunks (D-22)

- **Static guard:** `src/lib/security/server-only-boundary.test.ts` requires `import 'server-only'` as the first statement of the 17 modules that hold the transport, the session, the capability grants, the E2E runtime gates and the feature services. It enumerates them from the tree, so a new `*-service.ts` is covered automatically. It also requires the policy builder to stay a pure module. Next inlines only `NEXT_PUBLIC_` variables, and the repository has none.
- **Build scan:** `production-hardening.spec.ts` › "the production client chunks carry no server-only name or value" reads the 76 `*.js` and `*.css` files under the build's `static/` directory. It looks for sixteen needles and found none:
  - the nine server environment names (`CSRM_API_BASE_URL`, `CSRM_API_TOKEN`, `CSRM_DEV_IDENTITY`, `CSRM_E2E_UI_STATE_HARNESS`, `CSRM_E2E_RUNTIME_NONCE`, `CSRM_E2E_RUNTIME_ROOT`, `CSRM_E2E_RUNTIME_ATTESTATION_PATH`, `CSRM_NEXT_DIST_DIR`, `CSRM_ENVIRONMENT`);
  - the identity header `x-csrm-dev-identity`;
  - the run's API token, attestation nonce and Strapi API base URL;
  - the three fixture emails.
  `playwright.config.ts` exposes the run's attestation nonce to the specs as `CSRM_E2E_ATTESTATION_NONCE_VALUE`; the unattested server's environment drops it. A failure names what was found, never the value.

## Server Action origin check (D-48, T-08-R13)

- **Source, Next 16.3.6** (`next/dist/server/app-render/action-handler.js`, lines 427 to 467):
  - A Server Action request's `Origin` host is compared with `x-forwarded-host`, or `Host` when that is absent, before the action is looked up.
  - A mismatch not listed in `serverActions.allowedOrigins` is refused with `Invalid Server Actions request.`: a fetch action gets status 500, and a form post throws before its body is decoded.
  - A request with no `Origin` is let through with a warning. A browser always sends `Origin` on a cross-origin POST.
- **Observed on the production build** (`production-hardening.spec.ts` › "a cross-origin Server Action request is refused before any action runs"):

  | Request | `Origin` | Status | Session cookie set |
  |---|---|---|---|
  | fetch action, unknown id | `https://evil.example` | 500 | no |
  | fetch action, unknown id | the web origin | 404 (the origin check passed; no such action) | no |
  | the sign-in form action | `https://evil.example` | 500 | no |
  | the sign-in form action | the web origin | 303 to `/app` | yes, once |

  The last row is the control: the same post from the web origin runs the action. So the refusal comes from the origin check, not from a malformed request.
- **The session cookie:** it is `SameSite=Lax`, so a cross-site POST carries no session in the first place. The origin check is what stops a forged post to the sign-in action, which needs no session.

## Output safety (D-21 validation record)

- `src/lib/security/output-safety.test.ts` scans the 230 shipped modules: everything under `app/` and `src/` except tests, the test setup and declaration files, plus `proxy.ts` and `instrumentation-client.ts` beside them. The scan looks for:
  - the six sinks D-21 names: `dangerouslySetInnerHTML`, `eval(`, `new Function(`, `document.write`, `srcdoc=` and `javascript:`;
  - `innerHTML`, `outerHTML` and `insertAdjacentHTML` writes;
  - a `<script>` element or `next/script` of the application's own, which would need the nonce threaded through.
  It found none. A self-check proves each pattern matches its sink and not a word that merely contains it.
- Closed Zod parsers at every trust boundary are held to the contract by plan 08-04's contract parity guard. As first recorded this overstated its reach: nine parsers (the eight administration parsers and the Risk Register) sat behind a wrapper that reported every rejection at the root, and four questionnaire registrations stopped short of the question list they carry, so no guard mode saw a field-level narrowing in them. Since the G1 gap closure every registered parser must report a mistyped field at that field, a deliberate narrowing is registered at its path with its reason, and the boundary-only bounds of 43 pre-Phase-8 parsers are grandfathered with one reason each (residuals R-08-17 and R-08-18).
- Error boundaries and safe copy are proven by plan 08-09 (`route-boundaries.test.ts`, `root-fallbacks.test.tsx`).
- **Server-side log noise, not a client error:** the production server logs `⨯ Error: The destination stream closed early.` with a digest whenever a navigation abandons a page that is still streaming. Plan 08-10's final full browser run logged it 8 times; the Phase 8 review-fix runs logged it 44 to 52 times, and the UI review resolution's two full runs (84 tests each, 2026-09-26) 53 and 52 (residual R-08-14). Nothing reaches the browser: the log line names no record, the console stays clean, and no boundary renders.

## Proofs

| Proof | What it shows |
|---|---|
| `apps/csrm/src/lib/security/content-security-policy.test.ts` | The exact production and development policies. The development branch differs by `'unsafe-eval'` alone. The HTTPS upgrade is sent only over HTTPS. The nonce is validated, never echoed, and read back by Next's own extractor. |
| `apps/csrm/src/lib/security/proxy.test.ts` | One nonce is set on the request (as `x-nonce` and inside the policy) and the same policy on the response. Every request gets a fresh nonce. The policy follows the protocol and `NODE_ENV`. The matcher skips static files, images, the favicon and a prefetch that declares no body, and runs for any URL that only resembles one of them and for any prefetch-headed request that declares a body. Next strips the router's prefetch header before `proxy()` reads the request (pinned through Next's own proxy wrapper). The root layout renders every page per request. |
| `apps/csrm/src/lib/security/security-headers.test.ts` | The static header rule for every path. HSTS is sent only by production builds and never with `preload`. No static CSP is set. `poweredByHeader` is off. |
| `apps/csrm/src/lib/security/instrumentation-client.test.ts` | Zod is jitless in the browser, and parsing is unchanged. |
| `apps/csrm/src/lib/security/server-only-boundary.test.ts`, `output-safety.test.ts` | D-22 and D-21 as above. |
| `apps/csrm/e2e/production-hardening.spec.ts` | On the production build: the development sign-in refused without the attestation, and again when the build is started with `NODE_ENV=development`, the build's real sign-in action minting no cookie in either; the header set; the nonce on every served script; zero violations on 64 routes for four visitors at 1440px and 375px; a client-side navigation with no development runtime; the client-chunk scan; the Server Action origin check. |
| `apps/csrm/e2e/helpers/csp.ts` | The collector: every `securitypolicyviolation` event, reported to the test process even from a page it has left, and every policy console message. Chromium words these "Refused to …" in older releases and "… violates the following Content Security Policy directive …" since, so both wordings are matched. |

## Keeping this true

- **A new script, style, image, font or connection source:** add it to `content-security-policy.ts` with its reason here. Never widen `script-src` with `'unsafe-inline'`, `'unsafe-eval'` or a host list.
- **A Next upgrade:** run the hardening spec. It fails if any served script loses the nonce, or if any route raises a violation.
- **A new route:** it renders per request through the root layout. Add it to the sweep in `production-hardening.spec.ts`.
