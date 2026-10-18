<!-- generated-by: gsd-doc-writer -->
# Backend services

## Overview

Strapi routes attach application and authorisation policies, controllers parse the transport shape, and services enforce workflow rules against authorised records. Shared modules under src/csrm provide infrastructure without a competing frontend API or domain model. Paths below are relative to the repository root.

## Module listing

| Location | Responsibility |
|---|---|
| `apps/backend/src/policies/csrm-authorization.ts` | Effective grants, birthright Requestor and explicit analyst scope |
| `apps/backend/src/api/csrm-assessment-request/services/request-workflow.ts` | Assessment Request state transitions |
| `apps/backend/src/api/csrm-assessment-request/services/request-assignment.ts` | Eligible analyst assignment and projections |
| `apps/backend/src/api/csrm-assessment-request/services/request-lock.ts` | Per-request serialisation and database transaction |
| `apps/backend/src/api/csrm-request-note/services/` | Notes, read state and analyst AI-input marks |
| `apps/backend/src/api/csrm-request-attachment/services/request-attachments.ts` | File readers, upload, removal, inclusion and quarantine rescans |
| `apps/backend/src/api/csrm-questionnaire/services/` | Definitions, answers, governance and advisory generation |
| `apps/backend/src/api/csrm-assessment/services/assessment-workflow.ts` | Mutable aggregates, AI drafts, readiness and atomic release |
| `apps/backend/src/api/csrm-ai-run/services/ai-run-record.ts` | Bounded run history and human decisions |
| `apps/backend/src/csrm/ai/` | Authoritative context, classification policy and untrusted prompt sections |
| `apps/backend/src/csrm/files/` | Storage, content checks, scanner, extraction and queues |
| `apps/backend/src/keycloak/` | User provisioning and caller token verification |
| `apps/backend/src/bootstrap/` | Local seeds and startup reconciliation |

## Key interfaces

`withRequestLock()` in the request-lock module accepts a Strapi database port, request document id and asynchronous work callback. It serialises the request in-process and locks the request row first inside a transaction. Raw Knex work must use the callback's transaction; never nest this lock for the same request.

`TransportResult` belongs to the web transport, not to a backend workflow. Controllers translate backend errors to the documented HTTP contract. The OpenAPI specification, operation constants and closed refusal vocabulary must agree.

`readAttachmentConfig()` in `apps/backend/src/csrm/files/attachment-config.ts` accepts an environment map and appRoot/publicDirectory options. It returns validated storage/scanner choices and availability or throws for an invalid selected configuration.

`projectReleaseReadiness()` and `releaseAssessment()` in the assessment workflow distinguish guidance from authority: readiness is a server projection and release revalidates the aggregate within its mutation workflow.

## Usage patterns

For a request mutation, resolve grants before exposing record data, validate the closed input, then enter the existing request-lock seam. Read every deciding fact after the lock, and make all writes within the same transaction. Reuse the existing service rather than duplicating lock maps or authorisation logic.

For AI assistance, reload authoritative context, enforce the classification ceiling, delimit untrusted text, validate the provider's proposal, and persist only allowed workflow fields. The provider never chooses release, owner authorisation or server timestamps.

For files, use the private storage/scanner ports. A pending scan cannot release bytes for download or AI. Keep filename/content out of operational security event logs.

## Validation and operational limits

SQLite tests serialise transactions; they do not prove PostgreSQL row-lock behaviour. In-process job registries, extraction and rescans also require an explicit multi-process design before scaling. The [Residual risks](../security/phase-08-residual-risks.md) record those limits.

[Testing](../guides/testing.md) describes mounted HTTP, denial and atomicity proofs. [Configuration](../configuration/configuration.md) describes runtime gates and deployment-only checks.
