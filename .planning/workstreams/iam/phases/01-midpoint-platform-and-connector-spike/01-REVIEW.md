---
phase: 01-midpoint-platform-and-connector-spike
workstream: iam
reviewed: 2026-10-13T13:34:35Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - .gitattributes
  - docker/.env.example
  - docker/.gitignore
  - docker/README.md
  - docker/docker-compose.yaml
  - docker/midpoint/Dockerfile
  - docker/midpoint/init.sh
  - docker/midpoint/new-env.sh
  - docker/midpoint/objects/110-resource-scim-spike.xml
  - docker/midpoint/reload.ps1
  - docker/midpoint/reload.sh
  - docker/midpoint/scim-stub/ResourceTypes.json
  - docker/midpoint/scim-stub/nginx.conf
  - docker/midpoint/spike-test.sh
  - docs/adr/0005-midpoint-identity-engine-and-strapi-scim.md
  - docs/adr/0006-midpoint-lts-and-community-scim2-connector.md
  - scripts/verify-keycloak-idp.mjs
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
commits_reviewed: [aa2bb310, 5e1e23db]
---

# Phase 1: Code Review Report

## Summary

Reviewed the delivered implementation in commits `aa2bb310` and `5e1e23db` against ROADMAP Phase 1 success criteria and D5/D9/D10/D23. The scoped files are unchanged between those commits and the reviewed checkout. `01-SUMMARY.md` and the context overrides define the accepted deviations: REST reload, read-only object mounts, a non-secret stub token, and preservation of existing local Keycloak fixtures. Superseded plan mechanics are not findings.

Two blockers concern incomplete initialization and predictable credentials on a Windows checkout. Two warnings concern legacy PowerShell argument handling and a false-positive connector-version gate. No fixes were applied. No Docker commands were issued to the real stack; no containers, volumes, credentials or application configuration were changed.

## Narrative Findings

### CR-01: Init accepts a repository without a completed audit schema

**Classification:** BLOCKER
**File:** `docker/midpoint/init.sh:24-38`
**Related:** `docker/README.md:74-79`; ROADMAP criterion 1, D5.

**Issue:** Both the existence probe and the final guard use `ninja info` plus absence of the word `ERROR`. This does not establish that the repository and audit schemas were both prepared. The pinned Ninja action calls only `RepositoryService.repositorySelfTest` and repository diagnostics. The native repository self-test executes `select 1`; it does not test audit tables. Audit initialization is a separate SQL operation.

A concrete failure sequence is REPOSITORY creation succeeding at line 28, then AUDIT creation failing or being interrupted at line 29. The first init exits nonzero, but the next invocation can see a working repository, skip both SQL operations, and pass the same repository-only final guard. Compose then accepts `service_completed_successfully` and starts the server against an incomplete database. The retry also leaves `fresh=false`, skipping object seeding that the interrupted first attempt never reached. A successful fresh-stack run does not exercise this path.

**Evidence:** The pinned [InfoRepositoryAction](https://github.com/Evolveum/midpoint/blob/v4.8.14/tools/ninja/src/main/java/com/evolveum/midpoint/ninja/action/InfoRepositoryAction.java) checks repository health only; [SqaleRepositoryService.repositorySelfTest](https://github.com/Evolveum/midpoint/blob/v4.8.14/repo/repo-sqale/src/main/java/com/evolveum/midpoint/repo/sqale/SqaleRepositoryService.java) uses a connectivity query. The separate [audit SQL](https://github.com/Evolveum/midpoint/blob/v4.8.14/config/sql/native/postgres-audit.sql) creates audit-specific tables and metadata. These sources were inspected; no live failure was injected.

**Fix:** Probe repository and audit state independently with authenticated, error-stopping SQL, checking required tables and expected schema metadata. Distinguish an absent schema from connection failures or partial initialization. Refuse partial state with a clear recovery instruction, or implement explicit safe recovery; do not mark init successful until both schemas validate. Track completed object seeding separately so a retry cannot silently skip it. Require an explicit successful Ninja result in addition to schema probes. Verify the repository-created/audit-failed retry in a disposable environment.

### CR-02: CRLF example silently leaves predictable passwords in the generated environment

**Classification:** BLOCKER
**File:** `docker/midpoint/new-env.sh:27-32`
**Related:** `.gitattributes:23-28`, `docker/.env.example:18-22`, `docker/README.md:23-29`; ROADMAP criterion 1, D5.

**Issue:** `read -r` removes the newline but preserves a trailing carriage return. On a CRLF checkout, `*=change-me` does not match `=change-me\r`, so neither midPoint password is randomized. The script nevertheless prints that it created fresh local secrets and exits successfully. Compose accepts the nonempty placeholder values. A developer can therefore start the stack with the known administrator password `change-me` while believing it was generated randomly.

The new attributes force LF on the shell scripts and stub files, but omit `docker/.env.example`. This repository's `core.autocrlf=true` allows a fresh Windows checkout to make that example CRLF. The current working copy happens to be LF; that does not protect a new checkout.

**Evidence:** Ran the unchanged generator in a temporary directory with a CRLF copy of the committed example. It exited successfully, printed its normal success message, and the resulting file contained two unreplaced `=change-me` assignments. Only the count was printed; no generated secret or existing `.env` was read or exposed.

**Fix:** Force `docker/.env.example` to `text eol=lf` and strip a terminal carriage return when reading each line. Validate that no placeholder remains before publishing the generated file; write to a private temporary file and replace the destination only after successful generation. Add an isolated CRLF-input regression check.

### WR-01: Reload command loses its quoting under legacy Windows PowerShell

**Classification:** WARNING
**File:** `docker/midpoint/reload.ps1:37-41,62`
**Related:** `docker/README.md:94-99`; ROADMAP criterion 3, D23.

**Issue:** `$curl` contains embedded double quotes and is passed as one native argument to `docker exec ... sh -c`. Windows PowerShell 5.1 and PowerShell's legacy native-argument mode do not preserve this argument as written. In particular, the quoted `Content-Type: application/xml` and `Accept: application/json` values cause the command to split into multiple native arguments. The container shell consequently receives an incomplete curl command; the later positional filename, collection and OID arguments also shift. Valid object reloads fail before the intended REST request is made.

The README presents a generic PowerShell invocation without requiring a version or argument-passing mode. Successful execution in modern PowerShell does not establish support for the legacy Windows host.

**Evidence:** Passed the exact non-secret `$curl` string to a native argument-inspection process. Under `$PSNativeCommandArgumentPassing='Legacy'` it arrived as three arguments, with the first ending at `-H Content-Type:`. Under `Standard` it arrived intact as one argument. A harmless `bash -c` quoting check likewise failed in Legacy and succeeded in Standard. No real `docker exec` was used.

**Fix:** Send the container script through standard input and invoke `sh -s --` with only the simple positional arguments, preserving and checking Docker's exit status; alternatively use correctly tested legacy argument escaping. If legacy support is intentionally excluded, require and validate PowerShell 7.3+ with a compatible native argument mode, and document that requirement. Check both the success and failure paths on the supported Windows host.

### WR-02: Spike can report GO without connector version 1.2.9

**Classification:** WARNING
**File:** `docker/midpoint/spike-test.sh:32-34,49`
**Related:** `docker/README.md:112`; ROADMAP criterion 2, D10.

**Issue:** `count` counts connector type matches without checking their version. The separate version grep is only displayed and is followed by `|| true`; its result is never included in the GO condition. A response containing exactly one matching type at another version, plus a successful resource test and stub request, produces `RESULT: GO`. Even requiring any occurrence of `1.2.9` in the response would not associate it with the matching connector object.

**Evidence:** Ran the unchanged script with an exported mock `docker` function returning a connector of the expected type with version `9.9.9`, a successful test result, and a matching stub log. It printed `matching connectors: 1`, no version match, and `RESULT: GO`, with exit code zero. Every Docker call in this check was intercepted by the mock. This does not invalidate the recorded fresh-stack evidence, which separately records version `1.2.9`; it shows the reusable gate does not enforce its advertised predicate.

**Fix:** Parse the connector JSON structurally and require exactly one connector with the expected type and version on the same object, explicitly rejecting absent/malformed responses. Include that predicate in the final gate. Verify that missing, wrong and duplicate versions all return NO-GO.

## Criteria and decision assessment

| Reference | Assessment |
| --- | --- |
| Criterion 1 / D5 | Services, loopback bindings, internal PostgreSQL, host bridge and credential interpolation are delivered. Init completeness and Windows-generated credentials require CR-01/CR-02 resolution. |
| Criterion 2 / D9 / D10 | Runtime and source tag/commit pins are present; no connector binary is tracked. Recorded evidence establishes the actual fresh-stack GO. The gate itself needs WR-02. Dynamic dependencies and their provenance limits are explicitly documented. |
| Criterion 3 / D23 | Numbered fixed-OID objects, read-only source mount, `.done` ignore and explicit REST reload satisfy the accepted overrides. Modern PowerShell and Bash paths have recorded live evidence; legacy Windows portability needs WR-01. Reset instructions identify the affected volumes. Reset was not repeated during this review. |
| Criterion 4 | ADRs 0005/0006 record the architecture, versions, licensing/support facts, community risk and unselected fallbacks. The predecessor brief links ADR 0005; that changed notice was also checked as supporting context. |

## Validation and limits

- Read all 17 scoped files and the phase summary, context, roadmap, brief decisions, research, recorded fresh-stack evidence, project instructions and domain glossary. The review ran inline under the skill's no-automatic-spawn fallback.
- Bash syntax checks passed for all four shell scripts. PowerShell parsing passed for `reload.ps1`; Node syntax checking passed for `verify-keycloak-idp.mjs`.
- Confirmed executable Git modes for shell scripts and ignore coverage for `docker/.env` and `*.done`. No tracked runtime `.env` or connector JAR was found under `docker/`. The existing Keycloak fixtures and spike placeholder are explicitly permitted local/non-secret values, not new secret findings.
- Ran isolated CRLF, native-argument and mocked wrong-version checks described above. Temporary fixtures were outside the repository. No source file was edited.
- `node scripts/verify-keycloak-idp.mjs` still fails on the root README's missing literal `local-only`, as already documented in the phase summary. The modified env-backed bootstrap assertions pass before that failure. The verifier retains other stale README assertions; its pre-existing failure is not attributed to these commits.
- The REST reload approach is supported by the pinned [4.8 REST operations](https://docs.evolveum.com/midpoint/reference/support-4.8/interfaces/rest/operations/). The published [4.8 release page](https://docs.evolveum.com/midpoint/release/4.8/) confirms the recorded LTS end date.
- No fresh-stack, reset, reload, resource test or backend suite was run against the live installation during this review. Existing live evidence establishes the happy path; init recovery remains source-based analysis and requires isolated verification when fixed. Error paths that print raw Ninja diagnostics or REST message text have no explicit redaction layer; this review does not certify those paths as incapable of reflecting future secret-bearing input. No real secret was printed or committed by this review.

## Resolution (2026-10-14)

All four findings were fixed and re-verified against the live stack.

| Finding | Fix | Verification |
| --- | --- | --- |
| CR-01 | `init.sh` probes the repository (`m_global_metadata`, `m_object`, `m_user`, `m_resource`, `m_task`) and audit (`ma_audit_event`, `ma_audit_delta`, `ma_audit_ref`) tables independently with `psql -v ON_ERROR_STOP=1` (so a connection failure stops it rather than reading as "absent"); creates whichever schema is absent; refuses partial schemas and audit-without-repository with a reset instruction; requires both table sets, a positive audit query and a clean `ninja info` before success. Seeding is tracked by a `.idambox-objects-seeded` marker in the home volume, so a retry after an interrupted first run still seeds. The image gains `postgresql16-client`; compose passes `PGHOST`/`PGDATABASE`/`PGUSER`/`PGPASSWORD` to `midpoint_init`. | On a scratch database and home volume: repository-only state (simulated interrupted first run) → init created the audit schema and seeded objects; one audit table dropped → init exited 1 with "the audit schema is incomplete (2 of 3 required tables)". Existing volume: both schemas detected, marker adopted from the existing `.done` objects, no re-seed. Fresh reset: both schemas created, `RESULT: GO` (`evidence/fresh-stack-go.txt`). |
| CR-02 | `new-env.sh` strips a trailing CR from each line, writes to a private temp file, refuses to publish if any `=change-me` remains, then moves it into place. `.gitattributes` pins `docker/.env.example` to LF. New `docker/midpoint/tests/new-env.test.sh`. | `new-env.test.sh`: LF and CRLF examples both leave no placeholder or CR and keep every key; an unreplaceable placeholder is refused and leaves no file (ALL PASS). |
| WR-01 | The container script in `reload.ps1` (and, for consistency, `reload.sh`) uses only single quotes, with `set -f; IFS=` so the unquoted password and path expansions neither split nor glob. | Reload succeeded under Bash, PowerShell 7 with `$PSNativeCommandArgumentPassing` `Standard` and `Legacy`, and Windows PowerShell 5.1.26100; a bad object failed with HTTP 400 and exit 1 under PowerShell 5.1 and Bash. |
| WR-02 | `spike-test.sh` searches connectors through REST with `connectorType = … and connectorVersion = '1.2.9'`, so only an object carrying both values counts; an unexpected response counts 0. | The same search with version `9.9.9` returns an empty object list (count 0, NO-GO); with `1.2.9` the gate reports one match and `RESULT: GO`. |
