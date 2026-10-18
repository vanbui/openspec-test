# Phase 1: Monorepo Foundation and Secure Application Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents. Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 1-Monorepo Foundation and Secure Application Shell
**Areas discussed:** Strapi migration, Foundation sign-in experience, Initial CSRM visual direction, Contract-first development

---

## Strapi Migration

| Decision | Selected |
|---|---|
| Preserve sibling Git history as subtree/import / fresh source copy / retain nested Git | Fresh source copy; retain sibling repository as backup |
| Preserve former Strapi planning artifacts | No; root planning is authoritative |
| Root package manager | pnpm with one root lockfile |
| Migration contents | All except `node_modules`; `.env` is local-only and ignored |

## Foundation Sign-in Experience

| Decision | Selected |
|---|---|
| Phase 1 entry path | Centralized role-switching development session behind auth/capability adapter |
| Production browser session | HTTP-only secure cookie |
| Development role source | Simple role flag, isolated in the adapter |
| Post-sign-in destination | Return to originally requested protected page |

## Initial CSRM Visual Direction

| Decision | Selected |
|---|---|
| Brand source | BProton-led semantic CSRM token system |
| Desktop density | Balanced enterprise density |
| Colour mode | Light-first only |
| Interim mark | Replaceable `IdamBox CSRM` text wordmark |

## Contract-first Development

| Decision | Selected |
|---|---|
| OpenAPI types | Repeatable generated, committed output |
| Feature access to API | Domain-specific typed services wrap generated transport code |
| Missing API operation | Document backend gap; temporary fixture/test double only behind service seam |
| Drift detection | CI regeneration plus clean typecheck fails on drift |

## the agent's Discretion

- Choose current supported pnpm/Turbo/OpenAPI tooling during research.
- Derive initial semantic BProton token values without leaking raw values into components.

## Deferred Ideas

None.
