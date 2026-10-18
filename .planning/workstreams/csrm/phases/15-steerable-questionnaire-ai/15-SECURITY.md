---
phase: "15"
slug: "steerable-questionnaire-ai"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-10-13"
---

# Phase 15 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Analyst and Requestor → Strapi | Authenticated application requests cross the API boundary; Strapi grants and record rules authorize every operation. | Request, questionnaire, proposal, answer, and governance data |
| CSRM → AI provider | Only data allowed by the configured classification ceiling may leave CSRM; policy is checked when queued and before provider invocation. | Bounded request, submitted answers, marked notes, and opted-in attachment text |
| Stored envelopes → later readers | Persisted run and governance envelopes are parsed as closed schemas before they influence decisions or projections. | Versioned run, item-decision, and governance records |
| Browser session → Requestor recovery | Unsaved answers are scoped to the owner and questionnaire and restored only when the server returns them as empty and unchanged. | Kept unsaved answer values in session storage |

## Threat Register

The complete STRIDE register is authored in the `<threat_model>` blocks of all 14 phase plans. It contains 52 unique threats (T-15-01 through T-15-52). Every planned mitigation has corresponding implementation and verification evidence in its task SUMMARY. Phase 15's final regression suite and the adversarial validation additions passed; no high or critical mitigation remains open.

| Threat IDs | Categories | Severity | Disposition | Mitigation evidence | Status |
|------------|------------|----------|-------------|---------------------|--------|
| T-15-01–T-15-52 | STRIDE categories as recorded in the 14 plan registers | high, medium, or low per plan | mitigate | Per-task implementation and verification evidence in 15-01-SUMMARY.md through 15-14-SUMMARY.md; full suites, authorization matrix, mounted API cases, and Phase 15 browser flows. | closed |
| T-15-SC (repeated plan entry) | Tampering | low | accept | No dependency was added; the lockfile and application package manifests are unchanged. | closed — below high threshold |

*Status: open · closed · open — below high threshold (non-blocking)*

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-15-01 | T-15-SC | No dependency was introduced; the repeated low-severity install threat is not applicable to this phase's changes. | Phase plan disposition | 2026-10-13 |

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-13 | 52 | 52 | 0 | GSD secure-phase L1 plan-time register check |

The plans contain parseable threat models, all summary threat flags are `None`, and the configured ASVS level is 1. Under the secure-phase short-circuit rule, no separate auditor run is required when the plan-time register has no open threats at this level. The complete register remains in the source plans.

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-13
