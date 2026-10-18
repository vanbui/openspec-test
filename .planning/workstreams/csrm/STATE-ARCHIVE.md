# STATE Archive

Pruned entries from STATE.md. Recoverable but no longer loaded into agent context.

## Pruned 2026-08-29 (phases 1-2, kept recent 1)

### Decisions

- [Phase 01]: Canonical DELETE is granted through a separate API-only Function assigned only to Security Analyst and Security Analyst Agent.
- [Phase 02]: Use a dedicated Playwright SQLite database and disable existing-server reuse for deterministic acceptance runs. — Prevents incompatible local identity, seed, or database configuration from contaminating the browser contract.
- [Phase 02]: Require Strapi health and the Requestor shell baseline before emitting the Phase 2 RED sentinel. — Keeps the deliberate failure attributable only to the missing My Requests affordance.
- [Phase 02]: Development identity state contains only the persisted user documentId; authorization reloads status and grants server-side.
- [Phase 02]: Development Content API permission reconciliation is additive and preserves unrelated operator-managed public-role permissions.
- [Phase 02]: Fixture identity is derived inside the server-only Strapi client factory and cannot be supplied by callers.
- [Phase 02]: Development identity headers require the exact development runtime and CSRM_DEV_IDENTITY=true gates plus a mapped session role.
- [Phase 02]: Use TanStack Table v9 explicit feature registration with controlled server state while keeping URL navigation caller-owned.
- [Phase 02]: Persist table density under a per-user browser key and load it after mount to preserve hydration safety.
- [Phase 02]: Keep the AppShell PageHeader export as a direct compatibility re-export so every caller resolves to one implementation. — Preserves existing imports while guaranteeing a single implementation.
- [Phase 02]: Use explicit or generated heading IDs for section associations. — Keeps accessible labelling reusable and domain-free.
- [Phase 02]: Mirror the persisted request-status enumeration in a closed TypeScript presentation map so missing status feedback fails at compile time.
- [Phase 02]: Keep normalized mutation failure feedback caller-owned while ConfirmDialog retains focus and remains open for retry.
- [Phase 02]: Checkpoint outcome — specified-format: requestNumber = "RAR-" + UTC four-digit year at creation + "-" + 6 random characters from the Crockford base32 alphabet (digits 0-9 and uppercase A-Z excluding I, L, O, U), generated from a cryptographically secure source. Example: RAR-2026-X7K4Q2. Fixed total length 15. No sequential or gapless guarantee. Uniqueness is backed by the existing database unique constraint with a bounded retry (maximum 5 attempts) only on recognized unique-conflict errors; never count rows. — Operator-approved server-owned request number contract.
- [Phase 02]: Model request submission on PUT as the sole `requestStatus` value `submitted`; omission remains draft-save intent.
- [Phase 02]: Grant assessment-request inventory reads through a dedicated menu-less API-only Function with exactly two FunctionAPIs.
- [Phase 02]: Restrict request service populate unions to informationSystems, informationAssets, questionnaire, and assessment.
- [Phase 02]: Preserve only the explicit view parameter across My Requests query changes; discard ownership and unknown URL keys.
- [Phase 02]: Strip relations outside each request service projection after parsing, even when upstream responses are over-populated.
- [Phase 02]: Require only title at the shared draft and submit boundary until an authoritative completeness rule exists.
- [Phase 02]: Keep sponsor lookup absent until a least-privilege sponsor-directory contract is defined.
- [Phase 02]: Return authoritative submitted request data from submit actions; create and draft update navigate after successful revalidation.
- [Phase 02]: Map request edit defaults from the authoritative hydrated projection, including persisted relation document IDs.
- [Phase 02]: Keep failed submission feedback inside the open confirmation dialog so retry guidance remains accessible.
- [Phase 02]: Keep recently released assessments contract-unavailable until Strapi persists an authoritative release fact; approval alone is never release. — The upstream contract has no release lifecycle fact, so deriving release from approval would violate the advisory-only boundary.
- [Phase 02]: Normalize only generated allowlisted sort and questionnaire/assessment populate shapes at the owner-scoped collection boundary. — This preserves generated-client compatibility without weakening ownership scoping or exposing arbitrary query expansion.
- [Phase 02]: Run final browser acceptance against a dedicated seeded SQLite database and real mounted Strapi services. — A dedicated database makes the full acceptance journey deterministic while preserving the developer database.

### Performance Metrics

| Phase 01 P10 | 5min | 2 tasks | 3 files |
| Phase 02 P01 | 11min | 2 tasks | 2 files |
| Phase 02 P02 | 27min | 3 tasks | 9 files |
| Phase 02 P03 | 4min | 2 tasks | 5 files |
| Phase 02 P04 | 5min | 3 tasks | 4 files |
| Phase 02 P10 | 4min | 2 tasks | 5 files |
| Phase 02 P11 | 4 min | 2 tasks | 4 files |
| Phase 02 P05 | 11 min | 3 tasks | 7 files |
| Phase 02 P06 | 10 min | 2 tasks | 10 files |
| Phase 02 P07 | 11 min | 3 tasks | 10 files |
| Phase 02 P12 | 6 min | 2 tasks | 5 files |
| Phase 02 P08 | 9 min | 2 tasks | 11 files |
| Phase 02 P09 | 31 min | 3 tasks | 19 files |

