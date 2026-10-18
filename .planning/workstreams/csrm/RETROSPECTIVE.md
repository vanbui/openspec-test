# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Controlled Cyber Risk Assessment Workflow

**Shipped:** 2026-09-26 (closed 2026-09-28)
**Phases:** 19 | **Plans:** 170 | **Sessions:** several orchestrated runs, 2026-08-27 to 2026-09-26

### What Was Built
- The Turborepo with Strapi 5 and a Next.js 16 App Router client, a typed OpenAPI service layer, and IdamBox Role → Function → FunctionAPI authorization with record-level checks.
- The Requestor-to-Security-Analyst workflow: request, generated questionnaire, AI-assisted assessment draft, analyst review, explicit release and read-only Requestor view, with revert-to-draft and questionnaire governance.
- The Risk Register, Administration with CSV import for four reference lists, and the analyst dashboard, reports and alerts.
- Production hardening: a served-operations inventory, a six-actor authorization matrix, nonce CSP and security headers, WCAG 2.2 AA sweeps, performance budgets and journeys on the production build.

### What Worked
- The per-phase loop of context, UI contract, research, plans, check, execution, review, verification, security and UI audits. The security audit found an ownership bug that code review had missed.
- Contract discipline: the specification, the generated client, closed parsers and the parity guard made drift visible early.
- Contract-gap records before any schema change kept the datamodel stable across 19 phases.
- Browser verification at 375px and 1440px for every actor caught defects that typechecks and unit tests could not.

### What Was Inefficient
- **Partial gates:** they let breakages through. Phase 06.6 ran only its own suites, and four journeys failed unnoticed.
- **Stale bookkeeping:** missing summaries for 06.9 would have routed the tooling to re-execute a finished phase.
- **Exact-copy test assertions:** they turned every wording change into test churn.
- **Build dependence on live Google Fonts:** it made builds and the E2E suite non-hermetic.
- **Harness attestation expiry:** an attestation that expired after ten minutes was misread as load sensitivity.

### Patterns Established
- Every new endpoint follows one chain: an exact grant in both catalogue copies, record-level checks, the specification, the regenerated client with `api:check`, a closed parser in the parity guard, an authorization-matrix row and the served-operations inventory.
- Related records have three states: absent, unavailable and available. Only an available record is linked.
- Shared presentation owners: `statusPresentation`, `recordRouteMetadata`, the permission state and the DataTable scroll region.

### Key Lessons
1. Run the full E2E suite at every gate, not only the suites a phase adds.
2. Prove a list's populated content in browser checks; an axe pass cannot tell a populated list from its error state.
3. Test against the intended product, not only the specification. The product gap UAT found 65 gaps in a v1 that met its own requirements. Run it earlier in the next milestone, after each wave.
4. Record operator decisions where every later phase can find them. Several v2.0 phases reverse locked v1 decisions, and each reversal is traced.

### Cost Observations
- Not tracked in this repository.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | several | 19 | Per-phase GSD loop with independent review, verification, security and UI audits, and full gates |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | Playwright 84, Strapi 526, web 1,892 (final gate) | not measured | not tracked |

### Top Lessons (Verified Across Milestones)

1. Full gates and browser verification at both widths catch what unit suites miss.
