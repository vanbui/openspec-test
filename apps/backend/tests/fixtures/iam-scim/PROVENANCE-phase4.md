# Phase 4 persistent connector lifecycle provenance

Completed from the orchestrator-observed live execution. No authored envelopes.

- Capture date: 2026-10-16T12:03:04.000Z (stages ran from 12:02:30 UTC)
- Capture run: `iam-scim-gate-6c1b4e26-1a3a-4042-b6cb-60dee3601fc1`
- Capture command: `node docker/midpoint/e2e/capture-lifecycle.mjs --run`
- Repository source commit: `f900418d` (objects and scripts), capture tooling as committed with this fixture
- capture.json SHA-256: `3caec67e56e616811478624d9c189d73f8f8105e6041814a536bb4063de8acd1`
- manifest.json SHA-256: `5f41c527b85cbb056c51285bfccc7cd24d2809fe5d3aa148079a26f0da0ba5ba`
- Live execution and cleanup observations: third disposable gate of the session (fresh SQLite, IAM seeds on, Keycloak provisioning and token verification off, capture hook preloaded; midPoint volumes reset and seeded from the committed objects with the gate token). All nine stages ran. The runner then refused its own evidence: the verifier allowed no write in `live-sync-baseline`, but the live sync re-asserted one person's displayName (`PUT` with core attributes only), the connector read-back defect recorded in ADR 0006. The verifier now admits exactly that core-attribute `PUT` in the baseline. The evidence was published from this same run's drained entries (sanitized by the hook as they were recorded) with the corrected verifier, and `--verify-evidence` passes. The two earlier gates refused in preflight and claim-case on runner bugs (REST object unwrapping, empty search results, the `@id` of work items and the `WorkItemId` package), fixed before this run; their gates were discarded. Cleanup: the session was drained and closed; the gate process, database, socket and token handoff were deleted afterwards.

Source: `.planning/workstreams/iam/phases/04-midpoint-configuration/evidence/connector-capture/{capture,manifest}.json`.
Fixture: `connector-lifecycle-phase4.json`, copied byte for byte from capture.json, and
`connector-lifecycle-phase4.manifest.json`, copied byte for byte from manifest.json.
The replay reads only these copies, so the phase records may be archived.
Pinned runtime: midPoint 4.8.14, SCIM2 1.2.9, source commit
`05c404bbecf9c28938e2183411c7b04b4f8f4226`.
Backend: mounted Strapi routes, isolated SQLite, provisioning disabled.

Stages: connection, initial-import, live-sync-baseline, mover, leaver,
claim-conflict, claim-case, claim-confirm, reconciliation. All envelopes originate
from the connector, including ResourceTypes and Groups background requests.
Only declared User ids are substituted; request spelling, payloads, query strings
and operation order are retained. The baseline stage may contain no envelopes.

Manual candidate: the fictitious `maya.requestor` / `maya.requestor@idambox.com`
from `src/bootstrap/seed-assessment-navigation-lifecycle.ts`. That seeded address
is retained exactly to produce a real email conflict; new lifecycle addresses
use idambox.test. The runner verifies visibility and lack of a source key before
beginning capture. Replay prepares all captured unowned manual candidates in a
fresh database and keeps unrelated harness people under a different source.

The runner creates no midPoint objects and restores no developer data. Its
cleanup closes its own capture session; cases, HR snapshots and Users remain in
the disposable gate. The orchestrator owns gate disposal after review.
