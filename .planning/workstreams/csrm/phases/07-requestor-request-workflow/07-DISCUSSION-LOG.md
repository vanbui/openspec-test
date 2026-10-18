# Phase 7: Requestor Request Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-22
**Phase:** 07-requestor-request-workflow
**Areas discussed:** Persistence and authorization boundary; Request lifecycle and ownership actions; Persisted request-form scope; Dashboard and My Requests behaviour

---

## Persistence and authorization boundary

| Option | Selected |
|---|---|
| Deterministic MSW-backed request store; defer authenticated production integration | |
| Direct Strapi integration now, expanding Phase 7 into backend ownership/authorization | ✓ |
| Both adapters now | |

**User's choice:** Direct Strapi integration now.

---

## Request lifecycle and ownership actions

| Decision | Selected outcome |
|---|---|
| Submitted request handling | Requestor can withdraw to draft. |
| Withdrawal availability | Until an analyst starts processing it. |
| Analyst draft access | Analysts can view and edit unsubmitted drafts. |
| After analyst edits | Requestor reviews and explicitly submits; record remains draft. |

---

## Persisted request-form scope

| Decision | Selected outcome |
|---|---|
| Form presentation | One progressive, sectioned page. |
| Draft/submission requirements | Title to save draft; essential persisted fields to submit. |
| Systems/assets | Search optional existing catalogue records. |
| Third-party details | Conditional on involvement; required on submission. |

---

## Dashboard and My Requests behaviour

| Decision | Selected outcome |
|---|---|
| Dashboard emphasis | Action-first. |
| Responsive collection | Desktop table and mobile cards. |
| Default ordering | Most recently updated first. |
| Initial filters | Keyword search and status only. |

---

## the agent's Discretion

- Determine exact essential submission fields and direct-Strapi authorization implementation without weakening the ownership boundary.

## Deferred Ideas

None.
