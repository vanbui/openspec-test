# Phase 1: midPoint platform and connector spike - Discussion Log

> Audit trail only. Research and planning consume 01-CONTEXT.md.

**Date:** 2026-10-13
**Mode:** Non-interactive, explicitly authorized by the invocation.
**Areas:** Pinned platform/source build; stub and compatibility gate; credentials and configuration lifecycle; ADRs and evidence.

All four areas were selected. Choices below were resolved from the authoritative brief, roadmap, repository and supplied constraints; they are not new human responses.

## Pinned platform and source build

| Option | Reason | Selected |
|---|---|---|
| 4.8.14-alpine and JDK 11 wrapper build | Exact tag verified; respects fixed runtime and connector | Yes |
| Another verified 4.8.14 OS variant | Available but no established need | |
| Upgrade runtime or connector | Violates locked versions | |

Selected the pinned Alpine runtime and V1.2.9 fat-JAR source build. Docker Hub's API confirmed the exact tag. Upstream build files confirmed Gradle 7.2, project version 1.2.9, packaging tasks and external dependency repositories. Dynamic dependencies and build-number behavior remain explicit research concerns.

## Stub and compatibility gate

| Option | Reason | Selected |
|---|---|---|
| Static container in opt-in scim-spike profile | Reproducible on the compose network; no host runtime requirement | Yes |
| Host script | Adds host runtime/networking differences | |
| Temporary backend routes | Outside Phase 1 scope | |

Selected a ResourceTypes ListResponse listing User and Group, no host port, and a separate spike resource. Go requires discovery plus the actual connector connection test. No live test was performed.

## Credentials and configuration lifecycle

| Option | Reason | Selected |
|---|---|---|
| Ignored env/runtime material; explicit ordered Ninja overwrite reload | Matches credential/configuration rules and handles startup renames | Yes |
| Restart-only reload | Startup-renamed files are not reapplied | |
| Copy upstream examples unchanged | Old connector references, service-specific settings and credentials | |

Selected both reload scripts, stable object OIDs, .xml/.xml.done handling and filename restoration on reset. The source samples were inspected selectively: AWS configuration references connector 1.2.7 and a fixed OID, so requires adaptation. Existing realm credential fixtures and volume masking must be addressed by the plan.

## ADRs and evidence

| Option | Reason | Selected |
|---|---|---|
| Separate ADR 0005 architecture and 0006 compatibility/risk | Existing repository numbering ends at 0004 | Yes |
| Reuse brief-local ADR numbers literally | Conflicts with existing ADRs | |
| One combined ADR | Obscures the separate architecture and compatibility decisions | |

The predecessor brief is already marked superseded. Keep its notice. ADR 0002 amendment remains Phase 2. Execution must record actual go/no-go, reload/reset checks and the backend test gate. Discussion does not establish phase completion.

## Implementation Discretion

Research/planning resolves auxiliary image releases, readiness checks, secure secret materialization, fixed build number, dependency recording, volume installation and exact Ninja flags from pinned sources.

## Deferred Ideas

Backend SCIM/model/outbox, HR lifecycle configuration and sign-in stay in Phases 2-5. Fallback implementation waits for recorded no-go and an operator choice.

## Handoff

The user explicitly assigns builds, compose runs and live testing to the orchestrator after planning. This invocation stops after discussion artifacts and session state; automatic plan/execute chaining is not enabled.
