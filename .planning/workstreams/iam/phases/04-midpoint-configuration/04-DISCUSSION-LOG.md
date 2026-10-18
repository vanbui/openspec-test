# Phase 4: midPoint configuration - Discussion Log

**Date:** 2026-10-16
**Workstream:** iam
**Mode:** Unattended, explicitly delegated decision resolution.
**Status:** Discussion only; no plan, execution, live acceptance or commit.

This is an audit trail of alternatives. The authoritative downstream decisions are in `04-CONTEXT.md`. There were no interactive questions or operator answers in this session. Selections below were resolved from the supplied brief, roadmap, state, ADRs, Phase 3 records and repository inspection, under the instruction to fail closed.

## 1. Token delivery and configuration application

| Alternative | Resolution | Reason |
| --- | --- | --- |
| Runtime env substitution during seed/reload | Selected | Reuses D15's ignored token handoff and existing application paths. |
| Separate midPoint secret-provider integration | Deferred | No existing integration or demonstrated need in this milestone. |
| Real token in tracked XML, build arguments or command arguments | Rejected | Credential disclosure and persistence outside the approved boundary. |

**Decisions:** P4-01–P4-04. Delivered read-only mounts and REST reload supersede the original D23 wording. The current scripts copy/send XML verbatim; environment injection/rendering is a required change, not existing behavior. Prevalidate before writes, restrict substitution, protect and clean any initial spool, verify encrypted persistence, and keep dependent tasks suspended on failure. Both shell variants need equivalent acceptance. The separate spike remains discovery-only.

## 2. HR layout, Identity and activation

| Alternative | Resolution | Reason |
| --- | --- | --- |
| Read-only directory mount with isolated gate snapshots | Selected | Supports atomic replacement while protecting committed fixtures. |
| Writable tracked CSV or single-file bind mount | Rejected | Gate mutation and replacement visibility hazards. |
| Status plus UTC start/end boundaries, default denied on invalid input | Selected | Implements D19 while preventing accidental activation. |
| Status only or malformed/missing values treated active | Rejected | Ignores agreed dates and fails open. |

**Decisions:** P4-05–P4-08. Exact D19 header, employeeNumber key/name, synthetic fixtures and no backend date fields. Start is inclusive, end exclusive, terminated overrides dates. Date transitions require evaluation without CSV changes. Invalid complete-file reads do not mean workforce disappearance; a valid snapshot's keyed disappearance disables an existing managed identity.

## 3. Template and actual outbound mapping

| Alternative | Resolution | Reason |
| --- | --- | --- |
| D19 mapping with observed connector adaptations | Selected | Preserves the fixed public contract and Phase 3 amendments. |
| Assume externalId XML mapping makes the adapter send it | Rejected | Live probe proves the adapter omits it. |
| Accept stale Enterprise/optional values because PUT omitted them | Rejected | Does not meet mover or drift-repair criteria. |
| Patch connector, add an alternate API or change content types | Rejected | Outside authorized scope and established boundaries. |

**Decisions:** P4-09–P4-11. Preserve preferredName as displayName, JSON-string email attribute, Enterprise employeeNumber as write key, asserted PUT and observed email PATCH. All D19 mover fields and clears need actual state proof. Connector incompatibility blocks the affected criterion instead of silently dropping a field. Roles/passwords/Keycloak subjects are never outbound authority.

## 4. Correlation and operator confirmation

| Alternative | Resolution | Reason |
| --- | --- | --- |
| Native 4.8 smart-correlation case for every first manual claim | Selected | D13 and the Phase 4 criterion require operator confirmation for email and employee-number matches. |
| Auto-link a unique/high-confidence employee or email match | Rejected | Backend trusts explicit PUT and cannot enforce upstream confirmation itself. |
| Separate equality searches, candidate union and ambiguity hold | Selected | Fits supported SCIM filter grammar without unsupported OR. |
| Default username matching or privileged fallback search | Rejected | Can bypass confirmation or disclose protected/foreign users. |

**Decisions:** P4-12–P4-15. Before confirmation: no writes to the manual target. After confirmation: keyed PUT to its existing id, no duplicate. Rejection/failure remains visible and unresolved. Established source/key links survive email changes. The exact native focus/shadow/case representation remains a pinned-version research obligation; matching a focus alone is not proof of a manual IdamBox claim. Missing native support must stop provisioning, not remove the confirmation requirement.

## 5. Leavers and cadence

| Alternative | Resolution | Reason |
| --- | --- | --- |
| Disable projections and retain Identity/link/history | Selected | D12 and the no-DELETE Phase 4 criterion. |
| Delete/tombstone normal leavers | Rejected | Destroys ordinary linkage and uses the exceptional SCIM DELETE path. |
| Five-minute live sync with date evaluation, two nightly tasks | Selected | D18; explicit resource schedules and healthy-stack timing proof. |
| Poll interval alone as five-minute acceptance | Rejected | Does not account for task runtime or end-to-end completion. |

**Decisions:** P4-16–P4-18. HR reconciliation at 01:00 UTC, IdamBox managed-user repair at 02:00 UTC, no overlapping projection writers. Drift is repaired from HR and never imports role authority. Gate-only deliberate drift must not weaken ordinary sourced-field write protection.

## 6. P3-36 and populations above 100

| Alternative | Resolution | Reason |
| --- | --- | --- |
| Filtered correlation and focus/known-projection-driven target repair | Selected, mandatory live proof | Avoids relying on the observed truncated remote list. |
| Native pagedSearch metadata or shadow offset alone | Rejected as evidence | Phase 3 tried these and still observed no paging parameters. |
| Raise the backend default or support only 100 silently | Rejected | A finite default moves the problem; a silent limit fails the carried criterion. |
| A separately proven supported paging path | Contingency requiring a new decision | Not established by current repository evidence. |

**Decisions:** P4-19–P4-21. At least 125 owned users plus scope controls; independently known counts, tail drift/leaver/correlation and lost-link/source-key recovery. Include retained identities missing from today's HR file. Every filtered result must be complete. This proves managed-user repair, not complete orphan inventory. Any remaining enumeration dependency blocks acceptance. No backend default change is authorized.

## 7. Pending operations and IN-03

| Alternative | Resolution | Reason |
| --- | --- | --- |
| Resource-scoped refresh with controlled eligibility/backoff and one worker | Selected | Respects 503/429 delays and limits recovery traffic. |
| Assume connector honors Retry-After automatically | Rejected as evidence | Header handling has not been demonstrated through midPoint. |
| Preserve remote conflict as 503 with rollback | Selected | P3-19, IN-03 and ADR 0002 are locked. |
| Reclassify all remote conflicts or retry rapidly forever | Rejected | Changes the contract or creates an uncontrolled persistent retry loop. |

**Decisions:** P4-22–P4-25. Refresh every 60 seconds, per-operation server-delay floor, increasing delay capped at one hour, visible attention after ten consecutive failures. 401/403 suspend writes for correction. Do not pretend a closed 503 distinguishes a collision from an outage. Orchestrator proves actual retry timestamps, durable pending work and automatic recovery, plus leaver outbox independence. Unique synthetic emails avoid stale Keycloak collisions. Unsupported retry control is a blocker.

## 8. Throughput, audit, capture and verification ownership

| Alternative | Resolution | Reason |
| --- | --- | --- |
| Measure first full reference reconciliation with provisioning enabled | Selected | Includes real transactional Keycloak cost before throughput promises. |
| Infer capacity from a tiny/warm/flag-off capture | Rejected | Does not measure the deployed lifecycle path. |
| Recapture changed/new Phase 4 exchanges and retain historical Phase 3 proof | Selected | Native cases, persistent mappings and per-user repair add previously unproven scenarios. |
| Replay authored envelopes as if collected or treat offline validation as live proof | Rejected | Breaks provenance and acceptance boundaries. |

**Decisions:** P4-26–P4-30. Record timings, counts, failures/holds/retries and request totals. Audit must connect causes, native decisions/cases, SCIM outcomes and persisted state without credentials. Orchestrator owns all live stack work and final acceptance; committed flags stay false. Backend full-suite failure and any precisely scoped historical workaround must be reported separately. No schema, grants or other-workstream changes are implied.

## Delegated discretion and remaining proof obligations

All listed gray areas were selected by the session instruction; no selection was inferred from silence. Remaining freedom covers internal file splits, expressions and supported configuration syntax. It does not include weakening any locked behavior. The uncertain points are native 4.8 correlation wiring, complete per-focus repair, CSV date/change behavior, required Enterprise/clear serialization and effective retry-delay enforcement. Their required outcomes are decided; their runtime support is unproven here.

## Deferred scope

Separate secret-provider integration, connector/version changes, arbitrary orphan inventory, remote-conflict status redesign, additional HR fields/schema changes, DatabaseTable/SIMS sources, role/group governance, source administration and product change-log integration. Phase 5 retains password-email and full browser sign-in acceptance.

## Session boundary

Inspected the brief D1–D26, Phase 4 roadmap and Phase 3 carry-forward note, current state, ADRs 0002–0006, root domain context, previous phase contexts, the four specifically requested Phase 3 evidence/review records, existing midPoint image/seed/reload/object/evidence files and backend SCIM scope/filter/mapping/claim/retry code. No Docker/network operation, secret-file read, implementation, plan, state mutation, Git mutation or live acceptance was performed. The session stops after writing these discussion records; the orchestrator commits them.
