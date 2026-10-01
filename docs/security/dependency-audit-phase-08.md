# Phase 8 dependency audit

- **Date:** 2026-09-25
- **Command:** `pnpm audit --json` at the repository root (the lockfile is shared by both workspaces); a registry advisory lookup only, per Phase 8 decision D-23.
- **Scope:** high and critical advisories are fixed where a patched version exists in the same major; every remaining advisory is recorded below with its reason and a re-check trigger. The same major is not always a semver-compatible range: for the 0.x package `sharp` the fix crosses a minor, which semver treats as breaking, and it overrides the exact version `@strapi/upload` declares (see "The `sharp` override" below, corrected after the phase code review). No package was added or removed: every change is a version of a package already in `pnpm-lock.yaml`, applied as a direct in-major bump or a `pnpm-workspace.yaml` override (commit `46e7563`).
- **Baseline and result files:** the before and after outputs were kept outside the tree during the run; their totals and advisory ids are reproduced here.

## Before

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 6 |
| Moderate | 19 |
| Low | 2 |
| Info | 0 |

## After

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 |
| Moderate | 13 |
| Low | 1 |
| Info | 0 |

## Fixed

| Advisory | Package | Severity | Installed | Patched | How | Workspace and path |
|----------|---------|----------|-----------|---------|-----|--------------------|
| GHSA-5xrq-8626-4rwp | vitest | critical | 4.0.18 | ≥ 4.1.0 (resolved 4.1.11) | direct bump, `^4.1.11` at the audit and pinned exactly to `4.1.11` after the phase code review | apps/csrm (devDependency) |
| GHSA-82fw-gwwq-j7x9 | vitest, @vitest/mocker | moderate | 4.0.18 | ≥ 4.1.11 (resolved 4.1.11) | same bump; `@vitest/mocker` follows `vitest` transitively | apps/csrm |
| GHSA-hcf7-66rw-9f5r | turbo | moderate | 2.8.16 | ≥ 2.9.14 (resolved 2.11.3) | direct bump, `^2.9.14` at the audit and pinned exactly to `2.11.3` after the phase code review | root (devDependency) |
| GHSA-3qcw-2rhx-2726 | turbo | low | 2.8.16 | ≥ 2.9.14 (resolved 2.11.3) | same bump | root |
| GHSA-f88m-g3jw-g9cj | sharp | high | 0.34.5 | ≥ 0.35.0 (resolved 0.35.4) | override `sharp: 0.35.4`, which replaces the exact `0.34.5` `@strapi/upload` declares (see below) | apps/backend via @strapi/strapi > @strapi/upload |
| GHSA-rgj7-g3m4-5g8c | sharp | high | 0.34.5 | ≥ 0.35.4 (resolved 0.35.4) | same override | apps/backend via @strapi/upload |
| GHSA-r292-9mhp-454m | tar | high | 7.5.20 | ≥ 7.5.21 (resolved 7.5.22) | override `tar: 7.5.22` | apps/backend via @strapi/admin > @strapi/data-transfer |
| GHSA-2883-xcg3-v3hh | js-yaml | high | 4.3.1 | ≥ 4.3.2 (resolved 4.3.2) | override `js-yaml: 4.3.2` | apps/csrm via openapi-typescript > @redocly/openapi-core |
| GHSA-2x7j-588g-ccc2 | nodemailer | high | 9.0.1 | ≥ 9.1.0 (resolved 9.1.1) | override `nodemailer: 9.1.1`, pinned exactly after the phase security audit (O-3; first `^9.1.1`) | apps/backend via @strapi/email > @strapi/provider-email-sendmail |
| GHSA-8m3c-c648-2xjj | nodemailer | moderate | 9.0.1 | ≥ 9.1.1 (resolved 9.1.1) | same override | apps/backend |
| GHSA-wmmp-3585-3rmp | nodemailer | moderate | 9.0.1 | ≥ 9.1.0 (resolved 9.1.1) | same override | apps/backend |
| GHSA-cc9r-2j5m-2m83 | nodemailer | moderate | 9.0.1 | ≥ 9.1.0 (resolved 9.1.1) | same override | apps/backend |

Every critical and every high advisory with an in-major fix is gone.

As first written, this record said the `sharp` and `nodemailer` overrides were exercised by the Strapi suite. That holds for loading only (corrected after the phase code review, SR-06). The suite boots a real Strapi for every integration file, so both overridden versions load. It never uses either for its work:

- No test runs an image through the upload plugin. The matrix's `POST /api/upload` sends no file and answers 400.
- No test sends a mail. The matrix's `POST /api/email` fails before the provider creates a transport.

## The `sharp` override

- **What it does to the pin.** `@strapi/upload` 5.51.0 declares `"sharp": "0.34.5"`, an exact version. The override `sharp: 0.35.4` in `pnpm-workspace.yaml` replaces it for every consumer, so the upload plugin runs on a release it was not published against. For a 0.x package a minor bump is semver's breaking boundary, so 0.35.4 is outside any range compatible with 0.34.5.
- **The web's copy crosses no pin.** The only other consumer is `next` 16.3.6, whose optional dependency declares `sharp: ^0.35.4`. The override resolves it to the version that range already allows.
- **What the suites exercise.**
  - Every Strapi boot requires sharp 0.35.4 and calls `sharp.cache()` and `sharp.concurrency()` while the upload plugin registers (`@strapi/upload/dist/server/register.js`). That covers every Strapi integration file and the browser suite's Strapi.
  - Nothing exercises the plugin's image processing (`services/image-manipulation.js`: dimensions, thumbnails, responsive formats and optimisation).
- **Exposure.** CSRM stores no uploads, so the only surface is the admin media library. A break in image processing would go unseen until someone uploads an image there.
- **Decision.** The override stays, because it removes two high advisories (GHSA-f88m-g3jw-g9cj and GHSA-rgj7-g3m4-5g8c). The residual is R-08-39 in `docs/security/phase-08-residual-risks.md`. It is revisited at the next `@strapi/*` upgrade, or sooner if a harness smoke test runs one small image through the upload plugin.
- **The `nodemailer` override, for comparison.** It also replaces an exact version: `@strapi/provider-email-sendmail` 5.51.0 declares `9.0.1`, and the override resolves `9.1.1`. That is a minor bump of a 1.x-or-later package, a semver-compatible range. The provider requires it when it loads, and no test reaches its transport. After the phase security audit (O-3) the override is pinned exactly, `9.1.1`, as the other overrides are; the lockfile already resolved 9.1.1, so nothing installed changed.

## Accepted residuals

| Advisory | Package | Severity | Installed | Patched | Path | Reason | Re-check trigger |
|----------|---------|----------|-----------|---------|------|--------|------------------|
| GHSA-fx2h-pf6j-xcff | vite | **high** | 5.4.21 | ≥ 6.4.3 | apps/backend via @strapi/strapi > @vitejs/plugin-react-swc > vite | The fix is a major behind the Vite 5 line that `@strapi/strapi` 5.51.0 pins for its admin-panel build. The advisory concerns the Vite development server (`server.fs.deny` bypass on Windows), which never runs in the API runtime or in production. | Next `@strapi/*` upgrade |
| GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3 | vite | moderate | 5.4.21 | ≥ 6.4.2 / ≥ 6.4.3 | same path | Same pin and same development-server scope as above. | Next `@strapi/*` upgrade |
| GHSA-67mh-4wv8-2f99 | esbuild | moderate | 0.21.5 | ≥ 0.25.0 | apps/backend via vite > esbuild | Pinned by the same Vite 5 admin-build toolchain; development-server advisory (any website can send requests to the dev server). | Next `@strapi/*` upgrade |
| GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg | react-router | moderate | 6.30.6 | ≥ 7.18.0 | apps/backend via @strapi/admin > react-router-dom | The fix is a major behind the React Router 6 line `@strapi/admin` pins; the admin panel is not part of the CSRM API surface. | Next `@strapi/*` upgrade |
| GHSA-528h-pc64-c93x | stream-json | moderate | 1.9.1 | ≥ 3.5.0 | apps/backend via @strapi/data-transfer | Two majors behind the version `@strapi/data-transfer` pins; used only by Strapi's transfer tooling, which CSRM does not run. | Next `@strapi/*` upgrade |
| GHSA-8xcm-r25x-g524, GHSA-m8rv-5g2x-5cg5, GHSA-v3r7-h72x-cjcm | undici | moderate | 6.27.0 | ≥ 6.28.0 | apps/backend via @strapi/core | Moderate, so outside D-23's fix scope for this plan; an in-major patch exists and `@strapi/core` pins the 6.x line. | Next dependency pass: candidate for an `undici` override once the Strapi suite is re-run against it |
| GHSA-2g4f-4pwh-qvx6 | ajv | moderate | 8.13.0 | ≥ 8.18.0 | apps/backend via @strapi/database > umzug > @rushstack/node-core-library | Moderate, outside D-23's fix scope for this plan; an in-major patch exists. | Next dependency pass: candidate for an `ajv` override |
| GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g | qs | moderate | 6.15.3 | ≥ 6.16.0 | apps/backend via @strapi/types > @modelcontextprotocol/sdk > express > body-parser | Moderate, outside D-23's fix scope for this plan; reached only through a type-package dependency that the runtime never loads. | Next dependency pass: candidate for a `qs` override |
| GHSA-55q2-fjhq-7xh7, GHSA-c2j3-45gr-mqc4 | dompurify | moderate, low | 3.4.11 | ≥ 3.4.13 / ≥ 3.4.12 | apps/backend via @strapi/content-manager | Moderate and low, outside D-23's fix scope for this plan; admin-panel sanitiser, not on the API path. | Next dependency pass: candidate for a `dompurify` override |

The one remaining high advisory (`vite` 5.4.21) is the residual the Phase 8 research classified in advance. No residual is reachable from the web application's production bundle: `apps/csrm` carries no remaining advisory.

## Verification on the patched tree

Run on 2026-09-25 after commit `46e7563`, dev servers stopped:

| Check | Command | Result |
|-------|---------|--------|
| Lockfile integrity | `pnpm install --frozen-lockfile` | Already up to date |
| Strapi typecheck and suite | `pnpm --filter @csrm/strapi test` | 350 passed / 0 failed (10.7 minutes) |
| Web unit suite (vitest 4.1.11) | `pnpm --filter @csrm/web test` | 69 files, 834 passed / 0 failed (55.9 seconds) |
| Web typecheck | `pnpm --filter @csrm/web typecheck` | clean |
| Contract drift | `pnpm --prefix apps/csrm api:check` | clean (regenerated `schema.d.ts` identical) |

## No new runtime dependency

`git diff ec75b98..46e7563 -- package.json apps/csrm/package.json apps/backend/package.json pnpm-workspace.yaml` changes two version strings (`vitest`, `turbo`) and adds four override entries; no dependency key is added or removed in any manifest, and `apps/backend/package.json` is untouched. The overrides only move packages already in the lockfile.

The two bumps left `vitest` and `turbo` on caret ranges, where every other devDependency of `apps/csrm` and the root manifest is an exact pin, as both were before the audit (`4.0.18`, `2.8.16`). A lockfile refresh could then move them without a manifest change. After the phase code review (SR-06) both are pinned exactly to the versions the lockfile already resolved, `4.1.11` and `2.11.3`, so no resolved version changed.

## Phase gate re-run (2026-09-26, plan 08-14)

- **Why:** after this record was written, plan 08-10 moved `next` from 16.3.3 to 16.3.6 (`ced9bf3`), so that the asset scripts of `loading`, `error` and `template` boundaries carry the CSP nonce (vercel/next.js#98403). 16.3.6 also fixes GHSA-vcvr-r3jv-pc5j in `next/og`, which CSRM does not use. That lockfile change covered only `next`, `@next/env` and the `@next/swc-*` binaries, and a `pnpm audit` run before the bump flagged nothing against `next`. No manifest or lockfile has changed since.
- **Command:** `pnpm audit --json` at the repository root on the gate commit `0290f4f`, a registry advisory lookup only. The lockfile is shared, so one run covers both workspaces.
- **Result:** critical 0, high 1, moderate 13, low 1, info 0. These are the same totals and the same fifteen advisory ids as "After" above: no advisory is new, and none has cleared. All 546 finding paths start at `apps/backend`; `apps/csrm` has none, `next` included. Nothing needed a fix.
- **The one high advisory** is still `vite` GHSA-fx2h-pf6j-xcff, an accepted residual above. The phase residual register (`docs/security/phase-08-residual-risks.md`) carries every remaining advisory as rows R-08-21 to R-08-23.
- **No new runtime dependency across the phase.** `git diff a9394cf..0290f4f` over the three manifests and `pnpm-workspace.yaml` adds or removes no dependency key. It changes three versions (`next`, `vitest`, `turbo`), adds the four overrides above, and changes scripts.
