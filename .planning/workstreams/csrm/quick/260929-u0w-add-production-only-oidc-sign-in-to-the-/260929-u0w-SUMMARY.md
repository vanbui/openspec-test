---
phase: quick-260929-u0w
plan: 01
subsystem: auth
tags: [next-auth, auth.js, keycloak, oidc, nextjs, session-adapter]

requires: []
provides:
  - "Flag-gated Keycloak OIDC sign-in for apps/csrm, behind CSRM_AUTH_OIDC_ENABLED (default false)"
  - "OidcSessionAdapter behind the existing SessionAdapter seam, mutually exclusive with the development identity bridge"
  - "Auth.js v5 Keycloak provider route, RP-initiated logout, startup fail-fast, and production fail-closed refusal"
  - "ADR 0003 and a draft Strapi-side follow-up issue (not filed)"
affects: [csrm-web-auth, strapi-authorization]

actuals:
  tokens: 22815
  tasks: 3
  commits: 3
  plan_head_before: f9adc7443dd0d02df1fd118c15e7d082f70d3c25
  plan_head_after: adc9bdb

tech-stack:
  added: ["next-auth@5.0.0-beta.32 (exact pin)"]
  patterns:
    - "resolveSessionRuntimeMode as the single 'development' | 'oidc' | 'unavailable' predicate; every existing '=== development' gate turns off automatically in OIDC mode"
    - "Auth.js loaded only through a dynamic import('./oidc-auth'), so the flag-off path never reads next-auth or any AUTH_* variable"
    - "Session.developmentRole made optional (assumption-delta promote decision): Session is the general representation, developmentRole an optional detail of the development-bridge variant only"

key-files:
  created:
    - apps/csrm/src/lib/auth/oidc-configuration.ts
    - apps/csrm/src/lib/auth/oidc-auth-options.ts
    - apps/csrm/src/lib/auth/oidc-auth.ts
    - apps/csrm/src/lib/auth/oidc-session-adapter.ts
    - apps/csrm/instrumentation.ts
    - "apps/csrm/app/api/auth/[...nextauth]/route.ts"
    - apps/csrm/src/components/shell/sign-out-form.tsx
    - docs/adr/0003-production-only-keycloak-oidc-sign-in.md
    - .planning/quick/260929-u0w-add-production-only-oidc-sign-in-to-the-/260929-u0w-FOLLOWUP-ISSUE.md
  modified:
    - apps/csrm/src/lib/auth/session-adapter.ts
    - apps/csrm/src/lib/auth/development-runtime.ts
    - apps/csrm/src/lib/auth/development-session-adapter.ts
    - apps/csrm/app/sign-in/page.tsx
    - apps/csrm/app/sign-in/server-actions.ts
    - apps/csrm/app/actions/session.ts
    - apps/csrm/app/(app)/layout.tsx
    - apps/csrm/src/components/shell/app-shell.tsx
    - apps/csrm/src/lib/api/transport/server-client.ts
    - apps/csrm/vitest.config.ts
    - apps/csrm/playwright.config.ts
    - apps/csrm/.env.local.example
    - apps/csrm/README.md

key-decisions:
  - "Session promoted to the general representation; developmentRole becomes optional and only the development-bridge session carries it (assumption-delta, Task 1)"
  - "next-auth pinned to 5.0.0-beta.32 exactly (D-04); no fallback to openid-client was needed"
  - "OidcSessionAdapter.capabilitiesFor always resolves an empty grant (fail-closed optimistic UX) until the Strapi follow-up lands"
  - "The follow-up (Strapi-side Keycloak token verification) is drafted, not filed, per D-03"

patterns-established:
  - "Two mutually-exclusive session runtime modes behind one predicate, so a new auth mode can never accidentally run beside an existing one"

requirements-completed: [OIDC-01, OIDC-02, OIDC-03, OIDC-04, OIDC-05, OIDC-06, OIDC-07, OIDC-08, OIDC-09]

duration: ~30min
completed: 2026-09-29
status: complete
---

# Quick Task 260929-u0w: Production-only Keycloak OIDC sign-in Summary

**Flag-gated Auth.js v5 Keycloak OIDC sign-in for apps/csrm (`CSRM_AUTH_OIDC_ENABLED`), behind the existing SessionAdapter seam, with RP-initiated logout, startup fail-fast, and a hard production-build refusal until Strapi verifies Keycloak identity.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3/3 completed
- **Files modified/created:** 30 (25 code/config/docs files staged across 3 commits; the FOLLOWUP-ISSUE.md draft is left uncommitted for the orchestrator's docs commit)

## Accomplishments

- `CSRM_AUTH_OIDC_ENABLED` (default `false`) gates a Keycloak OIDC sign-in path that is fully separate from, and mutually exclusive with, the development identity bridge — enforced by a single `resolveSessionRuntimeMode` predicate that every existing `=== 'development'` gate already keyed off.
- `OidcSessionAdapter` implements the existing `SessionAdapter` interface; `getSessionAdapter()` (kept at its existing import path) now returns it in OIDC mode. Auth.js is loaded only through `import('./oidc-auth')` inside functions that already checked the runtime mode, so the flag-off path never reads `next-auth` or any `AUTH_*` variable.
- `/sign-in` offers one "Continue to IdamBox sign-in" button in OIDC mode; `/api/auth/*` (new Auth.js catch-all route) answers 404 outside OIDC mode.
- Sign-out is RP-initiated: the `id_token` is read back server-side via `next-auth/jwt`'s `getToken`, the Auth.js cookie is cleared, then the browser is redirected to Keycloak's `end_session_endpoint` with `id_token_hint`, `client_id` and `post_logout_redirect_uri`.
- Startup fails fast (`instrumentation.ts` → `assertSessionRuntimeConfiguration`) on an invalid flag or incomplete/malformed `AUTH_*` value, and a production build refuses to start at all with the flag true, naming that Strapi does not yet verify Keycloak identity (`OIDC_PRODUCTION_REFUSAL`). `resolveSessionRuntimeMode` independently fails closed at request time as a second guard.
- The Strapi transport (`server-client.ts`) provably never sends `x-csrm-dev-identity` and never reads the session in OIDC mode (`server-client-oidc.test.ts`).
- The shell shows "Signed in as `<name>`" and a "Sign out" control in OIDC mode (`AppShell`'s new optional `account` prop, byte-identical markup when absent); the capability grant is always empty until the Strapi follow-up, so the layout's existing `PermissionDeniedState` renders for every OIDC session today.
- `next-auth` installed pinned exactly to `5.0.0-beta.32` (`--save-exact`); install succeeded on the first attempt, no retry needed.
- `vitest.config.ts` and `playwright.config.ts` both pin `CSRM_AUTH_OIDC_ENABLED=false`, so a developer's local override cannot switch either automated suite into OIDC mode.
- ADR 0003 records the design, the beta pin and its justification, and the production refusal. `.env.local.example` and `README.md` document the flag and the three sign-in modes (development bridge, local Keycloak OIDC, production setup).
- The Strapi-side follow-up (token verification, `externalSubject` resolution, lifting the production refusal) is drafted at `260929-u0w-FOLLOWUP-ISSUE.md`; `gh issue create` was never run.

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): flag -> runtime mode -> OIDC adapter -> Auth.js Keycloak route -> sign-in button** - `e94ef12` (feat)
2. **Task 2: RP-initiated sign-out, shell account control, startup fail-fast and the bridge-off proof** - `51e203b` (feat)
3. **Task 3: Harness pins, docs, ADR 0003, follow-up issue, full verification and production-build smoke** - `adc9bdb` (docs)

_No plan-metadata commit is included here — the orchestrator makes the final docs commit (SUMMARY.md, STATE.md, ROADMAP.md) separately._

## Files Created/Modified

- `apps/csrm/src/lib/auth/oidc-configuration.ts` - flag parsing, strict `AUTH_*` reading, startup assertion, `OIDC_PRODUCTION_REFUSAL`, `keycloakLogoutUrl`
- `apps/csrm/src/lib/auth/oidc-auth-options.ts` - Auth.js v5 `NextAuthConfig` (Keycloak provider, JWT session, name-only logger, stripped `session` callback)
- `apps/csrm/src/lib/auth/oidc-auth.ts` - the lazily configured `NextAuth()` instance
- `apps/csrm/src/lib/auth/oidc-session-adapter.ts` - `OidcSessionAdapter`, `startOidcSignIn`, `handleOidcAuthRequest`, RP-initiated `signOut`
- `apps/csrm/src/lib/auth/session-adapter.ts` - `SessionRuntimeMode` gains `'oidc'`; `Session.developmentRole` optional; `SessionAdapter.signOut` added
- `apps/csrm/src/lib/auth/development-runtime.ts` - `resolveSessionRuntimeMode` checks the OIDC flag first
- `apps/csrm/src/lib/auth/development-session-adapter.ts` - `getSessionAdapter()` returns the OIDC singleton in OIDC mode; both adapters gain `signOut()` rejecting with the unavailable message
- `apps/csrm/instrumentation.ts` - startup `register()` fail-fast on the nodejs runtime
- `apps/csrm/app/api/auth/[...nextauth]/route.ts` - Auth.js GET/POST route
- `apps/csrm/app/sign-in/page.tsx`, `server-actions.ts` - OIDC sign-in card and `beginOidcSignIn` action
- `apps/csrm/app/actions/session.ts` - `signOutOfSession` server action
- `apps/csrm/app/(app)/layout.tsx` - computes `account` in OIDC mode, passes it to `AppShell`
- `apps/csrm/src/components/shell/app-shell.tsx`, `sign-out-form.tsx` - the OIDC-mode shell footer
- `apps/csrm/src/lib/api/transport/server-client.ts` - guarded `session?.developmentRole` (Rule 1 fix, see below)
- `apps/csrm/vitest.config.ts`, `playwright.config.ts`, `proxy.ts` - harness pins and a comment-only note
- `apps/csrm/.env.local.example`, `README.md` - flag documentation and the "Sign-in modes" section
- `docs/adr/0003-production-only-keycloak-oidc-sign-in.md` - the ADR
- `.planning/quick/260929-u0w-.../260929-u0w-FOLLOWUP-ISSUE.md` - draft only, not filed, not committed by this executor

Plus one new unit test file per source module (`oidc-configuration.test.ts`, `oidc-auth-options.test.ts`, `oidc-session-adapter.test.ts`, `sign-in-page-oidc.test.tsx`, `app-shell-account.test.tsx`, `server-client-oidc.test.ts`).

## Decisions Made

- Followed the plan's D-01 through D-05 exactly: web-only, fail-closed in production, the follow-up drafted (never filed), `next-auth@5.0.0-beta.32` pinned exactly, and ADR 0003 written in the 0001/0002 format.
- Assumption-delta promote decision (plan-authored, executed in Task 1): `Session` became the general representation; `developmentRole` is now optional and only a development-bridge session ever carries it.
- No architectural deviations (Rule 4) were needed — the plan's design mapped directly onto the existing `SessionAdapter` seam.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `server-client.ts` guarded `session?.developmentRole` before calling `developmentFixtureIdentityForRole`**
- **Found during:** Task 1, `pnpm typecheck`
- **Issue:** Making `Session.developmentRole` optional (the plan's own assumption-delta decision) broke `developmentFixtureIdentityForRole(session.developmentRole)`, since that helper's parameter type is non-optional `DevelopmentRole`. `session.developmentRole` could now type as `undefined`.
- **Fix:** Changed `session ? developmentFixtureIdentityForRole(session.developmentRole) : null` to `session?.developmentRole ? developmentFixtureIdentityForRole(session.developmentRole) : null`. Behaviourally identical for every existing caller, since a development-mode session always carries a role; only adds a type-safe guard for the (currently unreachable in this code path) case where it doesn't.
- **Files modified:** `apps/csrm/src/lib/api/transport/server-client.ts`
- **Verification:** `pnpm --filter @csrm/web typecheck` passes; `server-client.test.ts` and the new `server-client-oidc.test.ts` both pass unmodified/as-written.
- **Committed in:** `e94ef12` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, directly caused by this plan's own type change)
**Impact on plan:** Necessary for correctness; no scope creep.

## Issues Encountered

- **`next-auth` install:** `pnpm --filter @csrm/web add next-auth@5.0.0-beta.32 --save-exact` succeeded on the first attempt (~59s); no retry was needed, and no package-legitimacy checkpoint was triggered.
- **Two pre-existing, out-of-scope test failures** (present on `HEAD~3`, confirmed via `git stash` before this plan's first commit, unaffected by every file this plan touches):
  - `src/features/administration/administration-service.test.ts` > "keeps exact human-only grants byte-identical…" — `ENOENT` reading `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`.
  - `src/components/csrm/feedback-composites.test.tsx` > "communicates status and confirmation feedback accessibly" — `ENOENT` reading `apps/strapi/src/api/csrm-assessment-request/content-types/csrm-assessment-request/schema.json`.
  - Both reference a `apps/strapi` directory that does not exist in this checkout (only `apps/backend` does); this is a pre-existing repo-layout drift, not something this plan's files touch or caused. Per the SCOPE BOUNDARY rule, these were left unfixed and are reported here rather than fixed. `pnpm --filter @csrm/web test` therefore exits non-zero overall even though every OIDC-related test and every other pre-existing test passes (1981/1983 total; the plan's own Task 3 `<verify>` block chains `test` with `&&`, so it is reported as a known, pre-existing gap rather than a pass/fail on this plan's own scope).
- **Production-build smoke, `next start` with the flag true:** the process did not self-exit; it logged `Failed to prepare server Error: … Strapi does not yet verify Keycloak identity …` (the `register()` refusal) as an `unhandledRejection` and kept listening until the harness's 90s `timeout` killed it (`exit=124`, matching the plan's documented alternate outcome: "Next logged the error and kept serving; request-time fail-closed is then the guard, so report it"). `resolveSessionRuntimeMode` still independently fails closed at request time in that state (`/api/auth/*` → 404, `/sign-in` → the unavailable card), so the fail-closed guarantee holds either way. No secret name (`AUTH_SECRET`, `AUTH_KEYCLOAK_SECRET`, or the local secret value) was found in the flag-false build's client chunks (`static/`).
- Nothing else deviated from the plan.

## Verification Evidence (exact tallies)

- **Task 1 scope** (`vitest run oidc development-runtime development-session-adapter sign-in-page server-only-boundary alignment`): 9 test files, **125/125 tests passed**. `pnpm --filter @csrm/web typecheck`: clean. `grep -c '"next-auth": "5.0.0-beta.32"' apps/csrm/package.json` → `1`.
- **Task 2 scope** (`vitest run oidc server-client app-shell-account role-switcher mobile-navigation development-session-adapter server-only-boundary`): 11 test files, **171/171 tests passed**. Typecheck: clean.
- **Task 3, full suite** (`pnpm --filter @csrm/web test`, i.e. `vitest run` over the whole workspace): **1981/1983 tests passed**, 103/105 files passed. The 2 failing tests are the pre-existing, out-of-scope failures documented above.
- **Lint** (`pnpm --filter @csrm/web lint`, which is `next typegen && tsc --noEmit` in this project — there is no separate ESLint step configured): clean.
- **Typecheck** (final run): clean.
- **`git diff --quiet -- apps/csrm/e2e`**: exit 0 — no E2E spec was changed. The Playwright suite itself was **not run** (it needs the full Strapi+web stack); `playwright.config.ts` now pins `CSRM_AUTH_OIDC_ENABLED=false` for whenever it next runs.
- **Production build, flag false** (`CSRM_AUTH_OIDC_ENABLED=false CSRM_NEXT_DIST_DIR=.next/oidc-check pnpm --filter @csrm/web build`): succeeded (Turbopack compile 26.1s, TypeScript 14.0s), `/api/auth/[...nextauth]` listed as a dynamic route. `grep -rlE "AUTH_KEYCLOAK_SECRET|AUTH_SECRET|idambox-csrm-local-secret" apps/csrm/.next/oidc-check/static` → no matches.
- **Production start, flag true** (`CSRM_AUTH_OIDC_ENABLED=true … next start … timeout 90`): `exit=124` (see Issues Encountered above for the full explanation). `grep -c "Strapi does not yet verify Keycloak identity" apps/csrm/.next/oidc-check-start.log` → `2`. Port 3999 confirmed free afterward; `.next/oidc-check` and the log were deleted.
- **Post-smoke tree check** (`git status --short`): clean of incidental changes (no regenerated `tsconfig.json` or `apps/csrm/AGENTS.md` block); `next-env.d.ts` (regenerated, untracked, gitignored-equivalent) was deleted rather than committed.
- **Final verify-block checks:** `test -f docs/adr/0003-production-only-keycloak-oidc-sign-in.md` → exists; `grep -c "5.0.0-beta.32" docs/adr/0003-...md` → `1`; `grep -c "^CSRM_AUTH_OIDC_ENABLED=false" apps/csrm/.env.local.example` → `1`; `grep -c "externalSubject" 260929-u0w-FOLLOWUP-ISSUE.md` → `4`.

## User Setup Required

None for local development or CI — the flag defaults to `false` and nothing changes for the development identity bridge.

**For anyone who wants to exercise OIDC sign-in locally:**
1. `docker compose up -d` in `idp/` (a Keycloak container may already be running as `idp-keycloak-1`; this plan's automated verification never depended on it).
2. Copy the `AUTH_*` lines from `apps/csrm/.env.local.example` into `apps/csrm/.env.local`, set `CSRM_AUTH_OIDC_ENABLED=true`, and generate `AUTH_SECRET` with `openssl rand -base64 32`.
3. `pnpm --filter @csrm/web dev`, open `http://localhost:3000`.
4. Expect a redirect to `/sign-in` with "Continue to IdamBox sign-in"; sign in as `jane.doe` / `jane`; expect the shell to show "Signed in as Jane Doe" and the permission-denied state (expected until the Strapi follow-up).
5. Click "Sign out"; expect Keycloak's logout screen, then a return to `http://localhost:3000` and on to `/sign-in`. Visiting `http://localhost:8080/realms/idambox/account` afterward should ask for credentials again.
6. Set the flag back to `false` (or unset it) and confirm the development sign-in works exactly as before.

## Next Phase Readiness

- The web-side OIDC path is complete and fully fail-closed in production; nothing further is needed here until the Strapi follow-up exists.
- The draft follow-up issue (`260929-u0w-FOLLOWUP-ISSUE.md`) is ready for the user to review and, if approved, file with `gh issue create` — this executor never ran that command, per D-03.
- The two pre-existing `apps/strapi`-path test failures are unrelated to this plan and are flagged here for visibility; they are not introduced or worsened by this work.

---
*Plan: quick-260929-u0w*
*Completed: 2026-09-29*

## Self-Check: PASSED

All key created files verified present on disk; all three task commit hashes (`e94ef12`, `51e203b`, `adc9bdb`) verified present in `git log`.

## Orchestrator follow-up (after execution)

- **Startup fail-fast fixed (`0f27661`).** The executor's smoke showed `next start` kept serving after `register()` threw (Next logs the rejection as `unhandledRejection` and continues). `instrumentation.ts` now logs the message and calls `process.exit(1)`. Re-verified: production build with `CSRM_AUTH_OIDC_ENABLED=true` → `next start` exits 1 with the refusal; flag false → serves normally. The `register()` tests now assert the log and the exit, plus a new case for incomplete `AUTH_*` config.
- **Re-verified:** web lint and typecheck clean; auth-scope tests 112/112; full web suite 1982/1984 (the same 2 pre-existing `apps/strapi` ENOENT failures).
