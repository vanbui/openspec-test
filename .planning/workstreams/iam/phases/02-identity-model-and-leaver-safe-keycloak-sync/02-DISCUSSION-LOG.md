# Phase 2: Identity model and leaver-safe Keycloak sync - Discussion Log

> Audit trail only. Planning and implementation consume 02-CONTEXT.md.

**Date:** 2026-10-14
**Workstream:** iam
**Mode:** Non-interactive; user delegated gray-area choices consistent with locked D1-D26, roadmap reconciliation, ADRs and domain references. No questions asked and no operator approval inferred.

## Schema and scoped uniqueness

| Option | Selected | Reason |
| --- | --- | --- |
| JDL names, additive nullable fields, database-unique derived source key | Yes | Rejects concurrent duplicate tuples. |
| Preflight lookup only | No | Inconsistent with the required guarantee. |

**Selection:** Non-interactive delegated decision; exact contract in 02-CONTEXT.md.

## Service identity and grants

| Option | Selected | Reason |
| --- | --- | --- |
| Protected IdamBoxUser with one Identity Provisioning Role/Function | Yes | Preserves the locked authorization chain. |
| Separate principal entity | No | Inconsistent with the required guarantee. |

**Selection:** Non-interactive delegated decision; exact contract in 02-CONTEXT.md.

## Upsert and claims

| Option | Selected | Reason |
| --- | --- | --- |
| Explicit first PUT claim under a database lock | Yes | Correlation confirmation remains upstream. |
| Silent email linking | No | Inconsistent with the required guarantee. |

**Selection:** Non-interactive delegated decision; exact contract in 02-CONTEXT.md.

## HR edit refusal

| Option | Selected | Reason |
| --- | --- | --- |
| Always-on Document Service middleware | Yes | Also covers content manager and internal calls. |
| Controller-only validation | No | Inconsistent with the required guarantee. |

**Selection:** Non-interactive delegated decision; exact contract in 02-CONTEXT.md.

## Leaver safety

| Option | Selected | Reason |
| --- | --- | --- |
| Inactive write and durable enqueue in one transaction | Yes | No remote rollback of an authorized leaver. |
| Catch and ignore remote failure | No | Inconsistent with the required guarantee. |

**Selection:** Non-interactive delegated decision; exact contract in 02-CONTEXT.md.

## Outbox leases

| Option | Selected | Reason |
| --- | --- | --- |
| Atomic lease plus owner/generation fence and user serialization | Yes | Coordinates independent instances and reactivation. |
| In-process polling flag | No | Inconsistent with the required guarantee. |

**Selection:** Non-interactive delegated decision; exact contract in 02-CONTEXT.md.

## Document Service discipline

| Option | Selected | Reason |
| --- | --- | --- |
| AST guard and runtime integration proofs | Yes | Covers aliases, seeds and linkage write-back. |
| Literal grep alone | No | Inconsistent with the required guarantee. |

**Selection:** Non-interactive delegated decision; exact contract in 02-CONTEXT.md.

## Approval gate

| Option | Selected | Reason |
| --- | --- | --- |
| Pending operator checkpoint before schemas | Yes | Delegated choices do not approve the schema extension. |
| Automatic approval | No | Inconsistent with the required guarantee. |

**Selection:** Non-interactive delegated decision; exact contract in 02-CONTEXT.md.

## Handoff

Carry forward the prior phase's discussion-only preference. SCIM/token tooling remains Phase 3, correlation confirmation Phase 4, and password email/sign-in Phase 5. Operator approval remains pending. No schema or backend implementation was performed. Git was not mutated.

Workspace writes failed with EPERM and the shell runner failed during setup. Deliverables were saved in the permitted recovery directory; canonical workspace documents and STATE.md remain unchanged.
