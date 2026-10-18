# Phase 4: midPoint configuration — Pattern Map

**Mapped:** 2026-10-16
**Scope:** ENG-01–ENG-04, PROV-06, LIFE-04; P4-01–P4-30.

The paths below are proposed implementation responsibilities unless explicitly identified as existing. The planner may refine new filenames while preserving their boundaries. Existing analogs were checked with `git ls-files -- <path>`; every named source analog is tracked. No runtime behavior is established by this map.

## File Classification

| New/modified file or bounded family | Role | Data flow | Closest existing analog | Match |
| --- | --- | --- | --- | --- |
| `docker/midpoint/hr/reference.csv`, fixture README and before/after snapshots | config/test | file-I/O, batch | No HR fixture analog | none |
| `docker/midpoint/hr-snapshot.mjs` and `docker/midpoint/tests/hr-snapshot.test.mjs` | utility/test | transform, atomic file-I/O | `docker/midpoint/e2e/capture-scim.mjs` publication boundary; capture tests | partial: publication/testing only |
| `docker/midpoint/objects/100-resource-hr-csv.xml` | config | batch, event-driven | `docker/midpoint/objects/110-resource-scim-spike.xml` | role only; different connector |
| `docker/midpoint/objects/110-resource-idambox-scim.xml` | config | request-response | `docker/midpoint/e2e/capture-scim.mjs`, `resourceXml` | strong connector configuration match |
| `docker/midpoint/objects/200-object-template-user.xml`, scoped supporting archetype/schema objects | config | transform | No existing focus/template analog | none |
| `docker/midpoint/objects/300-task-*.xml`: live sync, date reevaluation, HR reconciliation, managed-focus repair, pending refresh | config | batch, event-driven | No existing task analog | none |
| `docker/midpoint/objects/manifest.json`, `docker/midpoint/validate-config.mjs`, associated negative tests | config/utility/test | file-I/O, validation | `docker/midpoint/e2e/scim-evidence.mjs` closed shape validation | partial; no XML/XSD validator exists |
| Shared credential renderer/application module and `docker/midpoint/tests/config-render.test.mjs` | utility/test | transform, stdin/file-I/O | `docker/midpoint/e2e/capture-scim.mjs`, `command` and `xml` | partial; shared application state machine is new |
| `docker/midpoint/init.sh` | config | file-I/O, batch | same tracked file | exact modification |
| `docker/midpoint/reload.sh`, `docker/midpoint/reload.ps1` | utility | request-response | same tracked files | exact modification |
| `docker/docker-compose.yaml`, `docker/midpoint/Dockerfile` if runtime packaging needs it | config | process startup, file-I/O | same tracked files | exact modification |
| Phase 4 compatibility/lifecycle/correlation/completeness/recovery/throughput harness modules under `docker/midpoint/e2e/` | utility | request-response, batch | `docker/midpoint/e2e/capture-scim.mjs` | strong orchestration match; scenarios new |
| Phase 4 evidence module under `docker/midpoint/e2e/` | utility | transform, validation | `docker/midpoint/e2e/scim-evidence.mjs` | strong boundary match; assertions new |
| Standalone Phase 4 script/evidence tests under `docker/midpoint/tests/` | test | request-response, transform | `apps/backend/tests/iam-scim-capture-tooling.unit.test.ts` | role/data-flow match; use standalone ESM imports |
| `docker/midpoint/e2e/capture-scim.mjs`, `scim-evidence.mjs`, README as needed for phase-local recapture | utility/config | request-response, file-I/O | same tracked files | exact modification; retain historical capture support |
| `apps/backend/tests/fixtures/iam-scim/connector-lifecycle.json`, `PROVENANCE.md` | test/config | file-I/O | same tracked files | exact recapture responsibility |
| `apps/backend/tests/iam-scim-replay.integration.test.ts` and relevant capture tests | test | request-response, persistence | same tracked replay and capture tests | exact modification |
| Phase-local `04-*-PROBE.md`, `04-*-EVIDENCE.md`, sanitized ledgers/manifests | config | file-I/O | `apps/backend/tests/fixtures/iam-scim/PROVENANCE.md` for digest and origin format | partial; results must come from live checks |

This covers the file families implied by context and research; supporting object filenames/OIDs must be selected in the manifest, never invented independently in different plans. The credential renderer's implementation language and packaging remain a runtime-availability decision: the image currently installs PostgreSQL client only and does not establish Node availability.

## Pattern Assignments

### Configuration lifecycle: init, reload and Compose

**Analogs:** `docker/midpoint/init.sh`, `reload.sh`, `reload.ps1`, `docker/docker-compose.yaml`, `docker/midpoint/Dockerfile`.

`init.sh:16–26` establishes strict Bash and closed failure output:

```bash
set -eu
MP=/opt/midpoint
HOME_DIR="${MP}/var"
SEEDED_MARKER="${HOME_DIR}/.idambox-objects-seeded"
```

`init.sh:88–95` is the existing one-time seed boundary:

```bash
if [ ! -e "${SEEDED_MARKER}" ]; then
  echo "[idambox-init] seeding numbered objects as post-initial objects"
  mkdir -p "${HOME_DIR}/post-initial-objects"
  for f in /opt/midpoint/objects-src/[0-9][0-9][0-9]-*.xml; do
    [ -e "${f}" ] || continue
    cp "${f}" "${HOME_DIR}/post-initial-objects/"
  done
  touch "${SEEDED_MARKER}"
fi
```

Preserve first-seed versus explicit-reload semantics, but replace verbatim credential-bearing copies with validated private rendering and cleanup. The current marker is set before actual server import; the new application contract must distinguish prepared/imported success and handle old homes without silently accepting stale credentials. Existing plaintext `.done` retention is unsuitable for rendered token material.

`reload.sh:28–42` and `reload.ps1:30–35` map object roots to REST collections. Reuse the collection concept with a configuration-only manifest allowlist; their general `user` support does not authorize overwriting workforce focuses. `reload.ps1:18–19,52–54` provides strict mode and XML root inspection:

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[xml] $doc = Get-Content -LiteralPath $src -Raw
$root = $doc.DocumentElement.LocalName
$oid = $doc.DocumentElement.GetAttribute('oid')
```

The new full parser must explicitly prohibit external entity/network resolution. Bash's current regex header parsing (`reload.sh:51–54`) is an existing limitation to replace, not a validation pattern. Both loops currently validate and mutate one object at a time; change them to validate the entire selected set and credential before mutation. Preserve container-local cache-aware REST PUT, while replacing raw error-body extraction at `reload.sh:72` / `reload.ps1:74` with closed outcomes. Add task suspension, prerequisite checks and state-preserving task updates; neither script already implements these guarantees.

`docker/docker-compose.yaml:87–89,119–121` provides the mount pattern:

```yaml
volumes:
  - midpoint_home:/opt/midpoint/var
  - ./midpoint/objects:/opt/midpoint/objects-src:ro
```

Extend this with the read-only HR directory mount and explicit token environment delivery to the necessary entrypoints. Keep connector state/private accepted snapshots in the writable home. Keep endpoint/flags and image pins intact. `Dockerfile:32–42` is the runtime packaging seam; no credential belongs in a build argument or image layer.

### Connector configuration, object manifest and schema validation

**Analogs:** `docker/midpoint/objects/110-resource-scim-spike.xml`; `docker/midpoint/e2e/capture-scim.mjs:181–196`.

The tracked spike supplies fixed OID and connector-reference conventions, but its unauthenticated stub URL and Enterprise-disabled configuration are unsuitable for workforce provisioning. Preserve its filename and OID as separate discovery configuration. The capture factory is the closer actual connector shape:

```xml
<connectorConfiguration><icfc:legacySchema>false</icfc:legacySchema><icfc:configurationProperties>
```

The factory enables standard and Enterprise schemas, disables unrelated schemas/deep import, and sets account class `ri:Scim2User`. Use its actual connector namespace, `usersEndpointUrl`, `groupsEndpointUrl` and protected-string token shape after full schema validation. Its temporary random OIDs are an isolation pattern, not production OIDs. Its generic account declaration is not a template, native correlation configuration or a task implementation.

Use `04-RESEARCH.md`'s XSD-backed vocabulary for new objects and task work definitions. There is no existing complete object manifest/XSD validator. Borrow only the closed-key validation idea from `scim-evidence.mjs:20–23`:

```javascript
function keys(value, allowed) {
  if (!object(value) || Object.keys(value).some((key) => !allowed.includes(key))
    || allowed.some((key) => !Object.hasOwn(value, key))) fail();
}
```

The XML validator needs namespace-aware parsing plus full local XSD/import resolution with networking/entities disabled; missing catalogs must fail. Add manifest tests for duplicate OIDs, unsupported roots, unresolved references/placeholders, source User objects and forbidden credential material. Dynamic connector properties additionally require actual discovery. No analogy in this section proves P4-11, P4-15 or P4-22/23 feasibility.

### HR fixtures, validation and atomic publication

**Partial analog:** `capture-scim.mjs:343–354`, whose writer validates before creating output and publishes atomically:

```javascript
verifyEvidence(bundle.capture, bundle.manifest);
const staging = `${destination}.${randomUUID()}.tmp`;
await mkdir(path.dirname(destination), { recursive: true });
await mkdir(staging, { mode: 0o700 });
try {
  await writeFile(path.join(staging, 'capture.json'), JSON.stringify(bundle.capture, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(bundle.manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(staging, destination);
} finally { await rm(staging, { recursive: true, force: true }); }
```

Adapt validation-before-write, private temporary storage, atomic rename and guaranteed cleanup for accepted CSV bytes. The existing directory publication refuses overwriting evidence; accepted snapshot replacement has a different lifecycle and needs its own tests. Parse the exact ordered header and proper quoted UTF-8 CSV, preserve immutable string keys, reject whole malformed/duplicate-key snapshots, and distinguish keyed invalid activation from structural rejection. Inject the UTC clock. Consume validated bytes instead of reopening mutable input. Never interpret read/parse failure as an empty workforce.

No existing HR parser, activation evaluator or supported scheduled publication integration was found. `apps/backend/package.json` already declares `csv-parse`, but that does not make it available in the midPoint image or authorize relying on backend package resolution from an arbitrary standalone directory. Select and test the actual supported runtime/parser path without assuming a new installation.

### Shared rendering and bounded subprocess transport

**Analog:** `capture-scim.mjs:21–38`, with signature `command(program, args, { input = '', signal } = {})`:

```javascript
const child = spawn(program, args, { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], signal });
child.stderr.on('data', () => {});
child.stdin.end(input);
```

The function bounds collected stdout and converts failures into a closed error. Its `xml(value)` escapes `<`, `>`, `&`, quotes and apostrophes. Reuse these behaviors for the single named token slot; whole XML parsing and credential/placeholder validation are additional requirements. Never apply general interpolation. `createRuntime` accepts injected `runCommand`, `control` and `transport` at line 200, enabling offline order/transport assertions without service calls.

`capture-scim.mjs:208–216` shows the reusable container-local stdin call:

```javascript
const result = await runCommand('docker', ['exec', '-i', 'midpoint', 'sh', '-c',
  'curl --silent --max-time 150 --request "$0" --user "administrator:${MP_SET_midpoint_administrator_initialPassword}" --header "Content-Type: $2" --header "Accept: application/json" --data-binary @- --write-out "\\n%{http_code}" "http://localhost:8080/midpoint/ws/rest$1"',
  method, endpoint, media], { input: body ?? '', signal });
```

Rendered token XML enters stdin, never arguments. Tighten allowed endpoints for each operation. Seed, Bash and PowerShell must call the same tested contract, including complete-set validation, stale-credential failure, suspension ordering, cleanup and redaction. Existing capture token reading deliberately refuses `docker/.env`; use that narrow handoff boundary for live captures, while implementing P4-02's explicitly separate dev seed/reload environment contract.

### Isolated compatibility and acceptance harnesses

**Analogs:** `capture-scim.mjs`, `scim-evidence.mjs`, capture unit tests.

`capture-scim.mjs:86–93` checks exact run identity, loopback backend port, SQLite type and run-specific disposable database path. `prepare:237–248` checks image, runtime and connector source pin before mutations. Extend isolation to the HR writable copy, midPoint repository/home and Keycloak controls; the existing backend-only check does not prove those are isolated.

`scim-evidence.mjs:207–233` separates bounded operations from independent cleanup:

```javascript
try {
  await bounded((signal) => runtime.prepare(signal), stageMs, overall);
  for (const scenario of SCENARIOS) {
    stage = scenario; await bounded((signal) => runtime.stage(scenario, signal), stageMs, overall);
  }
} catch { failure = new Error(`SCIM_CAPTURE_STAGE_FAILED:${stage}`); }
finally {
  try { await bounded((signal) => runtime.cleanup(signal), cleanupMs); }
  catch { failure = new Error('SCIM_CAPTURE_CLEANUP_FAILED'); }
}
```

Allocate cleanup identifiers before creation (`capture-scim.mjs:201–203`), clean independent resources independently (`302–315`), and refuse evidence publication until cleanup and validation succeed (`317–338`). Recovery harnesses additionally need guaranteed service restoration; `apps/backend/tests/iam-scim-refusal-tooling.unit.test.ts:22–37` already tests attempted-stop restoration and independent deadlines. Keep real-hour retry timing distinct from accelerated test clocks.

The existing capture's scenarios modify shadows directly; Phase 4 lifecycle proof must originate from atomic HR CSV publication and native tasks. Direct compatibility probes, gate setup/drift writes and conformance requests must retain their separate origins. Use isolated fixture setup only for required controls; it must never become an alternate production writer.

### Evidence validation and negative tests

**Analogs:** `scim-evidence.mjs:14–62,147–203`; `apps/backend/tests/iam-scim-capture-tooling.unit.test.ts`.

Reuse safe header allowlisting (`accept`, `content-type`, `retry-after`), closed metadata, credential rejection, contiguous sequences, declared one-to-one substitutions, exact target linkage and validation before persistence. The old validator rejects all status >=400 and assumes a single created user; Phase 4 requires a separate evidence contract for expected outages, holds, multiple users and operator decisions. Do not weaken the historical validator to treat any failure as success.

`iam-scim-capture-tooling.unit.test.ts:110–130` tests omitted scenarios and tampered metadata; its central negative loop is:

```typescript
for (const scenario of SCENARIOS) {
  const bundle = await authoredBundle();
  bundle.capture = bundle.capture.filter((entry: { scenario: string }) => entry.scenario !== scenario)
    .map((entry: object, index: number) => ({ ...entry, sequence: index + 1 }));
  assert.throws(() => verifyEvidence(bundle.capture, bundle.manifest), scenario);
}
```

Copy the mutation-test approach, using native ESM `node:test` for standalone scripts. Additional mandatory mutations: orphan audit/request/case edges; mismatched confirmed target; any predecision write; rejected-case duplicate creation; incomplete lookup; missing retained link; duplicate/missing identities in 125-user counts; early retry relative to the actual previous failure/header; missing increasing/capped cadence/ten-failure state; false cleanup; D19 stale values; evidence containing credentials; malformed dates and inconsistent timing. Synthetic bundles remain test data and cannot become published live evidence.

`iam-scim-capture-tooling.unit.test.ts:168–190,266–340` supplies fake runtime ports, injected subprocess results, abort tests, pre-mutation version rejection and invalid-evidence-before-write checks. No listener/service is needed for these units.

### Backend replay fixture and provenance

**Analogs:** `apps/backend/tests/iam-scim-replay.integration.test.ts`, `apps/backend/tests/fixtures/iam-scim/PROVENANCE.md`, `connector-lifecycle.json`.

Replay imports use `node:assert/strict`, `node:test`, filesystem/crypto primitives and the existing mounted HTTP harness (`iam-scim-replay.integration.test.ts:1–18`). Lines 10–13 compare published capture and fixture bytes. Lines 67–84 verify SHA-256 digests, validator acceptance, exact scenario coverage and marker declarations. Lines 114–138 replay every captured request in sequence and compare exact status, safe headers and JSON:

```typescript
for (const entry of capture) {
  const request = substitute(entry.request, ids);
  const response = await h.wire(request);
  const label = `${entry.sequence} ${entry.scenario} ${request.method} ${request.path}`;
  assert.equal(response.status, entry.response.status, label);
```

Lines 139–187 assert actual stored ownership, key, roles, status and CSRM references; line 178 compares the complete observed request sequence. Keep these persistence assertions when adapting to D19/claim/clear traffic. Fixture setup and negative checks remain outside the captured sequence.

Use the existing provenance format for phase-local source path, command, versions, hashes, observed-origin table and permitted substitutions. Preserve Phase 3 evidence and replay support; change hardcoded `47`, phase paths and historical page assumptions only where the new genuine capture requires an explicitly separate fixture/manifest selection. Never synthesize missing exchanges or normalize email strings, partial PUT shape, ordering or clearing semantics to fit expected behavior.

## Shared Patterns

- **Input first, mutation second:** validate full selected configuration, credentials, snapshots and evidence before side effects. Error means preserve last accepted source state and keep dependent tasks suspended.
- **Closed diagnostics:** reuse symbolic failures and sanitized ledgers; avoid forwarding stderr, raw connector errors, rendered XML or token-bearing responses.
- **Explicit boundaries:** resource/template/task configuration is distinct from runtime focuses, linkRefs, sync tokens, cases and task progress. Configuration reload must preserve that state.
- **Authority:** HR supplies identity attributes and status. Preserve explicit backend roles, source/key ownership and server authorization. Configuration presence does not prove native case confirmation or required remote writes.
- **Proof before expansion:** CSV, connector-write/filter, native-correlation and retry probes resolve the research assumptions before dependent production behavior. Failed probes produce blocking evidence and suspend affected paths.
- **Publication:** sanitized validated evidence publishes atomically into a new phase-local destination; existing history remains intact. Actual outcomes alone populate success fields.

## No Analog Found

| Seam | Why a new design is required |
| --- | --- |
| Whole HR snapshot validation, strict UTC activation and accepted-snapshot scheduling | No HR ingestion or date evaluator exists in tracked midPoint configuration |
| Full XML/XSD catalog validation and configuration-only OID manifest | Existing reloads inspect roots/OIDs but do not implement schema/set validation |
| Scoped HR template/archetype and date reevaluation tasks | Only discovery resource XML currently exists |
| Native manual-target correlation case with no predecision write | Existing shadow operations prove connector traffic, not focus/remote candidate confirmation |
| Complete retained-focus/link reconciliation above 100 | Historical unpaged list is explicitly incomplete as a population authority |
| Header-compliant increasing/capped durable pending retry | Existing harness timeouts are cancellation budgets, not provisioning retry policy |
| Cold throughput and connected native audit/case/request state | Existing envelope capture lacks native lifecycle decision evidence and HR-origin timing |

For these seams use schema/source-grounded research and explicitly blocked early live probes. No existing analog establishes their feasibility.

## Verification Commands and Boundaries

Proposed offline commands, once the files exist:

```text
node --test docker/midpoint/tests/hr-snapshot.test.mjs
node --test docker/midpoint/tests/config-render.test.mjs
node docker/midpoint/validate-config.mjs --check
```

Add standalone ESM evidence/runner tests under the same test directory and specify their exact filenames in plans. Supply the matching extracted schema root/catalog through a documented environment/input contract; full schema checks must fail if it is absent. These checks must not launch Docker, contact services or write success evidence.

Existing standalone baseline: `node docker/midpoint/e2e/capture-scim.mjs --check`. This checks syntax and pins only. Existing `--run` and `--verify-evidence` refer to the Phase 3 capture contract; phase-local equivalents must be explicit.

Backend integration gate: `pnpm --dir apps/backend test`, which performs maintenance-switch refusal, source TypeScript compilation, test compilation and serial Node tests. Client contract regression: `pnpm --dir apps/csrm api:check`. Record unfiltered failures; historical exclusions do not establish a passing Phase 4 gate.

Every check requiring Docker, midPoint, Keycloak or running Strapi belongs in an explicitly designated orchestrator-run live plan with its phase-local evidence filename. The research's CSV, connector, correlation and retry probes precede configuration, lifecycle, authority, completeness, recovery, throughput, recapture and final acceptance gates. No live checks were run for this map.

## Metadata

**Search scope:** tracked `docker/midpoint/`, `docker/docker-compose.yaml`, backend test fixtures/tests and package scripts.

**Primary analog families:** configuration lifecycle; connector resource/capture transport; evidence boundary/publication; negative script tests; mounted HTTP replay/provenance.

**Coverage:** all proposed file families above classified; new native configuration/HR/retry seams explicitly identified. No source file was changed.
