---
status: complete
workstream: iam
verification-status: passed-offline
completed: 2026-10-18
commits: 0
---

# Journey default bindings

Closed the default-binding gap identified in Phase 5 plan 08. This is offline implementation verification; live journey acceptance and phase requirements remain open.

## Changes

- Default invitation observations use the existing bounded, loopback-only Mailpit helper. Only matched synthetic recipients are inspected, action invitations are distinguished from ordinary messages, and counts retain no bodies, recipient addresses, action links or receipt caches. Truncated listings, wrong status, malformed matches and transport failures refuse safely.
- Default remote observations reuse the private client-credentials exchange and cached admin token. They verify the pinned server version, read the stored subject and active sessions, and correlate lifecycle changes with source-authenticated SCIM receipts and native audit records. The existing remote payload mirrors email; employee number, department and job title are verified on the local identity rather than requiring nonexistent remote attributes.
- The listener now observes successful connector creates by their returned document ID. IN-03 retains its validated conflict/recovery receipts through a private callback. No production request or write authority changed.
- Runtime records task invocations and assembles the closed 05-05 evidence format from identity linkage, validated browser/access observations, refusal timings, conflict results, regression results and successful cleanup. Four allowlisted viewport screenshots are published atomically with mode 0600 inside owner-only directories. The verifier also rejects public screenshot permissions.
- Evidence reflects the actual native retry scanner task and invocation for IN-03 recovery. The five-minute retry interval is measured from failed processing start, matching the existing conflict contract. Native timestamps are normalized before publication.
- Cleanup runs before regression compilation, under the existing cleanup budget, preserving listener/compiler isolation. Full backend tests, CSRM typecheck/tests, journey contract tests and the static default check are required by the live runner; frozen reference, catalogue, schema, generated-type and example-default hashes must remain unchanged. These commands were tested through injected process seams here, not executed against services.
- runJourney supplies the defaults through runtime construction and publishes only after successful execution and cleanup. Observer, browser, transport, regression and persistence injection remain available. Imports, --list and --check stay inert.

## Offline coverage

Added 34 tests, bringing the journey suite from 184 to 218. Coverage includes matched invitations and unrelated messages; local endpoints; remote subject, enabled state and session count; pinned version; admin and HTTP status failures; timeout/abort refusal; native audit and SCIM correlation; joiner receipt capture; sanitized assembly; partial/failed evidence; retained-session linkage; complete two-width publication; full-regression failure; cleanup failure; inert factories; and refusal to publish after timeout or incomplete execution.

The complete evidence fixture uses injected transports/processes, synthetic task/audit records and synthetic image headers. It passes the actual --verify-evidence dispatch and removes its temporary bundle afterward. It establishes neither real screenshots nor live acceptance.

## Exact final verification

Command:

```sh
node --test docker/midpoint/e2e/journey*.test.mjs && node docker/midpoint/e2e/journey.mjs --check
```

Exit: **0**. Test result: **218 tests, 218 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo; 0 suites; duration_ms 2193.870311**.

Static check output:

```text
Journey command passed; offline checks do not establish live acceptance.
```

No network requests, Docker commands or live services were used for this task. No commits, STATE.md or ROADMAP.md changes, backend source changes, content-type/catalogue changes, committed example changes, flag changes or dependency changes were made. The quick workflow ran inline under these explicit task constraints.

## Changed files

- docker/midpoint/e2e/journey.mjs
- docker/midpoint/e2e/journey-runtime.mjs
- docker/midpoint/e2e/journey-bindings.mjs
- docker/midpoint/e2e/journey-defaults.mjs
- docker/midpoint/e2e/journey-defaults.test.mjs
- docker/midpoint/e2e/journey-observations.mjs
- docker/midpoint/e2e/journey-conflict.mjs
- docker/midpoint/e2e/journey-evidence.mjs
- docker/midpoint/e2e/journey.test.mjs
- .planning/workstreams/iam/quick/20261018-journey-default-bindings/PLAN.md
- .planning/workstreams/iam/quick/20261018-journey-default-bindings/SUMMARY.md
