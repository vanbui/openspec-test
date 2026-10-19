---
status: complete
phase: 03-strapi-scim-2-0-service
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-05-SUMMARY.md, 03-06-SUMMARY.md, 03-07-SUMMARY.md, 03-08-SUMMARY.md, 03-09-SUMMARY.md, 03-10-SUMMARY.md, 03-11-SUMMARY.md, 03-12-SUMMARY.md, 03-13-SUMMARY.md, 03-14-SUMMARY.md, 03-15-SUMMARY.md, 03-16-SUMMARY.md]
started: 2026-10-19T06:44:54Z
updated: 2026-10-19T07:51:18Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop any running backend. Start Strapi from scratch (`pnpm --dir apps/backend develop`, committed defaults). It boots without errors, the SCIM routes mount once, and `GET /scim/v2/ServiceProviderConfig` with the dev source's bearer token answers 200 with `application/scim+json`. The same request without a token answers 401.
result: pass

### 2. Issue, rotate and revoke a source token
expected: `pnpm --dir apps/backend scim:token <source> issue` (or `rotate` / `revoke`) prints a token exactly once and stores only its hash. After `rotate`, the old token gets 401 and the new one 200; after `revoke`, the token gets 401. With `--write-dev-env` the dev source's new token lands in the git-ignored `docker/.env` and `git status` shows nothing tracked changed.
result: pass

### 3. midPoint connection test and discovery
expected: In midPoint (127.0.0.1:8081), the SCIM2 resource holding the dev source's token passes "Test connection" against Strapi. `/ResourceTypes` lists User and Group, `/Schemas` and `/ServiceProviderConfig` answer, `GET /scim/v2/Groups` returns an empty ListResponse, and `POST /scim/v2/Groups` answers 501.
result: pass

### 4. Create, search and update a user through SCIM
expected: `POST /scim/v2/Users` creates a sourced user who holds only the birthright Requestor role. `eq`/`and` filters on userName, externalId, emails.value and Enterprise employeeNumber return only the source's own users plus unowned, unprotected manual users, paged by startIndex/count. PUT and PATCH (lowercase or mixed-case op names) change identity attributes but leave IdamBox Roles untouched. A duplicate create answers 409 with scimType `uniqueness`.
result: pass

### 5. Keycloak outage returns 503 and rolls back
expected: With Keycloak provisioning on and Keycloak stopped, a SCIM create or attribute update answers 503 with `Retry-After: 30` and nothing changes in Strapi. Setting `active=false` while Keycloak is down still commits the deactivation (pending outbox work, no remote call). Existing CSRM behaviour and backend boot are unaffected.
result: pass

### 6. Deactivated user is refused in the API and CSRM
expected: A signed-in sourced user who is set to `active=false` through SCIM gets 403 on their next Strapi API request, and on reload or direct-detail navigation in CSRM sees the existing refusal state (heading, copy, focused CTA, no protected content) at 1440 px and 375 px with no horizontal overflow. The four screenshots in `evidence/browser-refusal/` show this.
result: pass

### 7. SCIM DELETE retains the record and references
expected: `DELETE /scim/v2/Users/{id}` answers 204, the user becomes inactive with `sourceDeletedAt` set, later `GET` answers 404, and the IdamBox User record plus every request, risk and owner reference to them remain visible in Strapi admin / CSRM.
result: pass

### 8. Backend and client suites stay green
expected: The backend suite (excluding only the two csrm red-phase files from WINDOWS.md entry 11) passes with the replayed connector capture included; `pnpm --dir apps/csrm test`, `typecheck` and `api:check` pass; existing csrm endpoints and grants behave as before. The unfiltered `pnpm --dir apps/backend test` stops only on those two csrm files.
result: pass

### 9. Capture and refusal evidence verify
expected: `node docker/midpoint/e2e/capture-scim.mjs --check`, `capture-scim.mjs --verify-evidence` and `refusal-scim.mjs --verify-evidence` all pass, and the published evidence under `evidence/` contains no token, cookie or password.
result: pass

### 10. Exact token parsing, whole-token SHA-256 and fixed-buffer comparison including absent hashes
expected: Exact token parsing, whole-token SHA-256 and fixed-buffer comparison including absent hashes
result: pass
source: automated
coverage_id: token-cryptography

### 11. Serialized issuance, rotation and idempotent revocation with rollback and independent timestamps
expected: Serialized issuance, rotation and idempotent revocation with rollback and independent timestamps
result: pass
source: automated
coverage_id: token-lifecycle

### 12. Exact source/action interface, one-time output, no listener and finally cleanup
expected: Exact source/action interface, one-time output, no listener and finally cleanup
result: pass
source: automated
coverage_id: token-cli

### 13. Exact registered source eligibility and safe atomic ignored-env replacement
expected: Exact registered source eligibility and safe atomic ignored-env replacement
result: pass
source: automated
coverage_id: development-export

### 14. Serialized revocation of only the undelivered credential
expected: Serialized revocation of only the undelivered credential
result: pass
source: automated
coverage_id: failed-delivery-compensation

### 15. Existing token lifecycle and tokenless seed/restart contracts remain intact
expected: Existing token lifecycle and tokenless seed/restart contracts remain intact
result: pass
source: automated
coverage_id: seed-and-lifecycle-preservation

### 16. Complete mapped create and replace inputs, defaults, nulls, schema checks and mutability
expected: Complete mapped create and replace inputs, defaults, nulls, schema checks and mutability
result: pass
source: automated
coverage_id: wire-validation

### 17. Core and Enterprise outbound projection with documentId locations and no private data
expected: Core and Enterprise outbound projection with documentId locations and no private data
result: pass
source: automated
coverage_id: public-mapping

### 18. Closed SCIM errors, exact statuses and retry headers, direct resources and bodyless 204
expected: Closed SCIM errors, exact statuses and retry headers, direct resources and bodyless 204
result: pass
source: automated
coverage_id: safe-errors-and-media

### 19. Restricted paths and eq/and syntax with JSON escaping and inclusive input bounds
expected: Restricted paths and eq/and syntax with JSON escaping and inclusive input bounds
result: pass
source: automated
coverage_id: bounded-filter-grammar

### 20. Raw duplicate rejection, safe normalized pagination, zero-count envelopes and public field projection
expected: Raw duplicate rejection, safe normalized pagination, zero-count envelopes and public field projection
result: pass
source: automated
coverage_id: query-paging-projection

### 21. Real persistence proves ownership visibility, exact source keys, literal-safe comparisons and counts before pages
expected: Real persistence proves ownership visibility, exact source keys, literal-safe comparisons and counts before pages
result: pass
source: automated
coverage_id: scoped-database-comparisons

### 22. Case-insensitive ordered operations, supported paths, selectors, exact values and bounded validation
expected: Case-insensitive ordered operations, supported paths, selectors, exact values and bounded validation
result: pass
source: automated
coverage_id: ordered-patch-protocol

### 23. One mutation, fresh concurrent projections, scope isolation, retained Roles and DTO compatibility
expected: One mutation, fresh concurrent projections, scope isolation, retained Roles and DTO compatibility
result: pass
source: automated
coverage_id: locked-source-mutation

### 24. Failed operations and remote updates leave state unchanged; uniqueness follows rollback and deactivation commits pending outbox work
expected: Failed operations and remote updates leave state unchanged; uniqueness follows rollback and deactivation commits pending outbox work
result: pass
source: automated
coverage_id: atomic-failure-and-leaver-path

### 25. Exact bearer credentials, private source context, current binding and exact operation grants
expected: Exact bearer credentials, private source context, current binding and exact operation grants
result: pass
source: automated
coverage_id: fresh-source-request-authority

### 26. Persisted activity before grant denial and later rollback, unchanged user timestamps, closed storage failure
expected: Persisted activity before grant denial and later rollback, unchanged user timestamps, closed storage failure
result: pass
source: automated
coverage_id: independent-source-activity

### 27. Strict startup settings, exact default budgets, fixed windows and bounded live buckets
expected: Strict startup settings, exact default budgets, fixed windows and bounded live buckets
result: pass
source: automated
coverage_id: bounded-scim-budgets

### 28. Authentication/activity ordering, media negotiation, body bounds and closed errors
expected: Authentication/activity ordering, media negotiation, body bounds and closed errors
result: pass
source: automated
coverage_id: namespace-parser-error-boundary

### 29. One safe request event including refusals with validated source, operation and target
expected: One safe request event including refusals with validated source, operation and target
result: pass
source: automated
coverage_id: canonical-safe-request-events

### 30. Supported patch/filter, filter limit 500, unsupported bulk/password/sort/etag and bearer scheme
expected: Supported patch/filter, filter limit 500, unsupported bulk/password/sort/etag and bearer scheme
result: pass
source: automated
coverage_id: truthful-capabilities

### 31. Exact Core/Enterprise/Group descriptors, User/Group endpoints, optional extension and safe exact lookups
expected: Exact Core/Enterprise/Group descriptors, User/Group endpoints, optional extension and safe exact lookups
result: pass
source: automated
coverage_id: public-schema-and-resource-discovery

### 32. Standard empty ListResponse and safe fixed 404/501 helpers with no persistence authority
expected: Standard empty ListResponse and safe fixed 404/501 helpers with no persistence authority
result: pass
source: automated
coverage_id: fixed-group-responses

### 33. Exactly 21 root operations mount once, reject content-api aliases and require current source credentials and exact operation grants
expected: Exactly 21 root operations mount once, reject content-api aliases and require current source credentials and exact operation grants
result: pass
source: automated
coverage_id: root-operations-and-grants

### 34. Public scoped reads, replacement and manual claim, atomic PATCH, role preservation and idempotent tombstones retain request, risk and system-owner references
expected: Public scoped reads, replacement and manual claim, atomic PATCH, role preservation and idempotent tombstones retain request, risk and system-owner references
result: pass
source: automated
coverage_id: scoped-lifecycle-and-retained-references

### 35. Mapping, birthright, source visibility, claims, ordered and concurrent PATCH, bounded queries, conflicts, rollback and retained references
expected: Mapping, birthright, source visibility, claims, ordered and concurrent PATCH, bounded queries, conflicts, rollback and retained references
result: pass
source: automated
coverage_id: persisted-http-lifecycle

### 36. Fresh binding/grants/tokens, safe errors and exactly-one request log, independent activity, sync/token timestamps and both throttle budgets
expected: Fresh binding/grants/tokens, safe errors and exactly-one request log, independent activity, sync/token timestamps and both throttle budgets
result: pass
source: automated
coverage_id: security-boundary-ordering

### 37. Observed root configuration, exact layer counts, source policy, absent aliases and unchanged existing inventory classifications
expected: Observed root configuration, exact layer counts, source policy, absent aliases and unchanged existing inventory classifications
result: pass
source: automated
coverage_id: actual-mounted-inventory

### 38. Authored sanitation, closed metadata, stable substitutions, ordered scenarios and missing-operation rejection
expected: Authored sanitation, closed metadata, stable substitutions, ordered scenarios and missing-operation rejection
result: pass
source: automated
coverage_id: capture-boundary

### 39. Exact published capture bytes, SHA-256 digests, declared substitutions and complete operation coverage
expected: Exact published capture bytes, SHA-256 digests, declared substitutions and complete operation coverage
result: pass
source: automated
coverage_id: fixture-provenance

### 40. Exact HTTP order and shapes, persisted mapping, roles, retained references, tombstones and two-source isolation
expected: Exact HTTP order and shapes, persisted mapping, roles, retained references, tombstones and two-source isolation
result: pass
source: automated
coverage_id: mounted-replay

## Summary

total: 40
passed: 40
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
