# Phase 5: Sign-in and end-to-end journey - Discussion Log

**Date:** 2026-10-17
**Workstream:** iam
**Mode:** Non-interactive; all gray areas explicitly delegated. No interactive answers were solicited or invented.

This is an audit trail of alternatives. `05-CONTEXT.md` is the authoritative decision record. Discussion ends after these two artifacts are committed; planning, execution and automatic advancement are excluded.

## Areas selected

All remaining Phase 5 areas were selected: email eligibility and commit timing, delivery failure/resend, Mailpit wiring, fresh-stack gate orchestration, real OIDC browser isolation, least privilege, mover/leaver continuity, evidence secrecy, IN-03 and regression acceptance. The workstream lookup found Phase 5 with no context/plans/spec/checkpoint and no matching pending todos; the pre-discussion hook list was empty.

## Choices and reasons

| Area | Alternatives considered | Selected and reason | Decisions |
| --- | --- | --- | --- |
| Email trigger | Any passwordless write; any source update; actual new sourced create | Actual committed sourced create with eligibility checks; avoids recurring invitations and excludes claims/manual/service/protected users | P5-01, P5-02 |
| Timing | Inside create transaction; after inner middleware return; outer-commit dispatch | Outer-commit best effort with caught errors; email cannot undo committed identity correctness | P5-03 |
| Recovery | Extend revocation outbox; add mail entity; unbounded retries; operator resend | One automatic attempt plus guarded administration resend; frozen persistence and explicit crash/uncertain-delivery limit | P5-04, P5-05, P5-07 |
| Diagnostics | Raw remote errors/mail URLs; closed structured event | IDs, trigger, outcome and closed code only; actionable without credential leakage | P5-06 |
| Local mail | Leave realm unchanged; add another catcher; existing Mailpit SMTP | Narrow realm SMTP addition justified by actual SIGN-01 mail delivery | P5-08 |
| Activation/auth | Change defaults; fixture bridge; process-only real OIDC | Defaults false, isolated activation and existing Strapi identity/capability boundary | P5-09, P5-10 |
| Gate environment | Reuse Phase 4 developer data; reset only midPoint; fresh complete gate | Reset idp volumes and isolated backend data, own listeners/processes; removes stale subject/email effects | P5-11 |
| Lifecycle driving | Direct authored SCIM writes; temporary shadows; persistent CSV/tasks | Existing publisher/render/reload/task path; proves the delivered identity engine configuration | P5-12, P5-13, P5-14 |
| Password proof | Admin reset; direct token grant; Mailpit link in browser | Actual current recipient link, Keycloak form, then independent CSRM login; proves self-service setup | P5-15 |
| Mover and access | Grant analyst for test; navigation-only checks; stable Requestor plus server denials | Stable identity and Requestor operation set, changed HR values, no repeated mail and denied restricted operations/records | P5-16, P5-17 |
| Leaver proof | Wait for expiry/logout; inspect hidden menus; same-session next-request refusal | Valid pre-leaver token and existing browser, API 403 and safe UI, then remote disable/logout completion | P5-18 |
| Browser harness | Import default Playwright config; independent opt-in config/spec | Separate next dev OIDC harness; ordinary suites pin false and own their backend | P5-19 |
| Viewports | Resize one consumed-link journey; independent synthetic person per width | Full separate lifecycle at 1440 and 375 in isolated contexts; usable keyboard/mobile UI | P5-20 |
| Evidence | Raw traces/mail dumps; manual redaction later; allowlisted publication | No trace/video/raw secret diagnostics; sanitize before writing, retain explicit provenance and failed-step summaries | P5-21, P5-22 |
| IN-03 | Defer again; reclassify status; exercise separately | Named live remote-email collision, 503/rollback/retry visibility and corrected recovery; preserve existing classification | P5-23 |
| Regression | Require live Keycloak in CI; trust mock callback alone; offline integration plus separate live gate | Fake admin client with real transaction boundary tests; unfiltered backend and CSRM checks, honest inherited-failure reporting | P5-24, P5-25 |

## Prior decisions retained

Phase 4 amendments A1–A10 govern the delivered runtime: container token rendering, validated atomic snapshots, single-valued HR fields, connector-side paging, task-level retryLater recovery, strong displayName cost, boolean-primary email representation, native confirmed claims, dependency-ordered objects and genuine capture/replay. Historical records explicitly leave remote email conflict unobserved; this discussion requires a separate Phase 5 probe. No prior live result is relabelled as Phase 5 acceptance.

## Remaining discretion and deferred work

Internal helpers, command/file naming and bounded timeout values remain open within the numbered decisions. Research must establish the actual outer transaction commit seam. Durable mail queues/model extensions, public resend UI/API, conflict reclassification, broader CSRM screens, roles from HR and corporate brokering remain deferred. No new implementation, evidence, state transition or completed requirement is claimed.
