# SCIM connector capture gate

Plan 03-12 supplies tooling and authored unit tests only. No lifecycle evidence or
replay fixtures are supplied. Plan 03-13 owns live execution and acceptance. A
successful offline check does not satisfy that checkpoint.

From the repository root:

```sh
node docker/midpoint/e2e/capture-scim.mjs --check
node docker/midpoint/e2e/capture-scim.mjs --run
node docker/midpoint/e2e/capture-scim.mjs --verify-evidence
```

`--check` validates both scripts and the tracked Dockerfile/spike pins, offline.
It does not read secret files, contact Docker, open listeners or write evidence.
`--run` requires the following orchestrator preparation. Missing prerequisites or
operations fail with a closed error; nothing is replaced with authored traffic.
`--verify-evidence` validates an existing capture and manifest; absence is failure.
By default it reads the published gate output below; `--verify-evidence <capture.json>
<manifest.json>` validates a checked-in copy instead (the backend replay tests pass
`apps/backend/tests/fixtures/iam-scim/connector-lifecycle{,.manifest}.json`, so they
never read `.planning`). Otherwise only the single mode argument is accepted.
Credentials are never CLI arguments.

## Orchestrator preparation (03-13 only)

1. Preserve the running developer services. Arrange exclusive use of the existing
   gate listener on port 1337 during the checkpoint, without pointing this runner
   at developer data. This runner never starts, stops or replaces a Strapi process
   or Docker service. If a developer listener occupies that port, preparation is
   pending until the orchestrator can provide the isolated listener safely.
2. Allocate `IAM_SCIM_CAPTURE_RUN_ID=iam-scim-gate-<random UUID>`. The isolated
   Strapi process must use SQLite at
   `apps/backend/.tmp/<IAM_SCIM_CAPTURE_RUN_ID>.sqlite`, with the usual IAM seeds
   and the real SCIM routes, source grants, policies and identity service. The
   in-process hook checks the effective Strapi database configuration and port;
   a different database, client, run identifier or port is refused. Start from a
   new database, retaining only gate-owned fictitious data. The database filename
   uses `DATABASE_FILENAME=.tmp/<IAM_SCIM_CAPTURE_RUN_ID>.sqlite` with the existing
   backend database configuration. Provisioning overrides belong to this isolated
   process environment only. Committed activation defaults remain false. Set
   `IDAMBOX_KEYCLOAK_PROVISIONING=false` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=false`
   on the gate process and the token command: Keycloak keeps users from earlier runs
   with the fixed gate email addresses and would refuse later updates. The first
   token for a new database is `issue`, not `rotate`.
3. Load `capture-scim.mjs` with Node's `--import` in that Strapi process, setting
   `IAM_SCIM_CAPTURE_PRELOAD=1`. Do not set it on a parent package manager or a
   watch-mode launcher: multiple children would compete for the same socket.
   An example direct process launch, after compiling the current backend, is:

   ```sh
   capture_root=$(git rev-parse --show-toplevel)
   cd "$capture_root/apps/backend"
   IAM_SCIM_CAPTURE_PRELOAD=1 node --import "$capture_root/docker/midpoint/e2e/capture-scim.mjs" \
     -e 'require("@strapi/strapi").createStrapi({ appDir: process.cwd(), distDir: "dist" }).start();'
   ```

   Supply the run identifier, database filename and gate-only environment to this
   process. This example is for the isolated checkpoint, not a second listener
   beside an occupied 1337. The hook uses the existing HTTP request event and
   original body/response streams. It creates no alternate SCIM server or writer.
   Its control socket is `apps/backend/.tmp/scim-capture.sock`, mode 0600, and is
   never remotely exposed. A stale socket is refused; remove it only after
   confirming that its owning gate process has exited.
4. Use the implemented `scim:token` administration command against that same
   isolated database. Deliver its one-token stdout in memory to the dedicated
   ignored handoff file `apps/backend/.tmp/.env.scim-capture`, mode 0600. The exact
   file format is one line: `MIDPOINT_SCIM_TOKEN=<issued token>`. Do not paste a
   credential into a terminal command, shell trace or tracked resource XML. For
   example, with the same gate database/environment selected and shell tracing
   disabled, from the repository root:

   ```sh
   pnpm --silent --dir apps/backend scim:token 'midPoint (dev)' rotate | \
     node --input-type=module -e 'import { writeFileSync } from "node:fs"; let text=""; for await (const chunk of process.stdin) text+=chunk; if (!/^idb_scim_v1\.[a-z0-9]{24}\.[A-Za-z0-9_-]{43}\n?$/.test(text)) process.exit(1); writeFileSync("apps/backend/.tmp/.env.scim-capture", "MIDPOINT_SCIM_TOKEN="+text.trim()+"\n", {mode:0o600,flag:"wx"});'
   ```

   Remove an old handoff only after confirming ownership. The runner refuses a
   tracked, nonignored, linked, overly permissive or malformed handoff. It never
   opens `docker/.env`. The dedicated handoff avoids reading unrelated credentials.
   Plan 03-13 separately proves `--write-dev-env` delivery, rotation, next-request
   old-token refusal and revocation; this runner does not claim those results.
5. Keep the pinned `midpoint` container available. Runtime preflight checks the
   image `idambox/midpoint:4.8.14-scim2-1.2.9`, Ninja's installed runtime version,
   exactly one matching connector object and the built connector source record
   `05c404bbecf9c28938e2183411c7b04b4f8f4226`. Container-local REST authentication
   follows `spike-test.sh`/`reload.sh`: the administrator password stays in the
   container. No environment file is read by these commands. Keep connector HTTP
   trace logging disabled: this hook is the sole wire collector, and raw logging
   would bypass its sanitation boundary.
6. From the root, with the same run identifier exported, invoke exactly:

   ```sh
   node docker/midpoint/e2e/capture-scim.mjs --run
   ```

The runner has a 180-second budget per stage, a 20-minute overall execution
budget and an independent 30-second cleanup budget. Individual REST calls also
have a 150-second curl bound; cleanup calls have separate five-second bounds.
No availability toggle is needed: existing services stay running on failure.
The orchestrator removes the owned handoff, isolated database and gate-started
process after reviewing results; the runner removes only its own midPoint objects.

## Operations and provenance

A random, marked temporary resource points directly to
`http://host.docker.internal:1337/scim/v2`. Expanded resource configuration travels
only through stdin to midPoint; no expanded XML is written in the checkout.
A temporary fictitious person and its explicit test shadow use allocated UUIDs,
recorded before mutation so cleanup also covers response loss after commit.
The resource declares its `Scim2User` object class and nonlegacy schema explicitly.

The supported midPoint REST model/shadow seam drives these ordered stages:

| Stage | Invocation | Required observed SCIM behavior |
| --- | --- | --- |
| connection | POST resource/test | GET ResourceTypes, 200 |
| lookup | POST shadows/search, name equality | GET Users with filter, empty result |
| create | POST shadows | POST Users, 201 and returned id |
| read | GET shadow with forceRefresh | GET Users/id, 200 |
| list | POST shadows/search | GET Users, actual ListResponse |
| filter | POST shadows/search, name equality | GET Users with filter, matching result |
| page | POST shadows/search, offset/maxSize | GET Users nonempty ListResponse; startIndex/count only if the connector pages (P3-36) |
| mover | PATCH shadow title delta | actual connector PUT, changed title, active retained |
| multi-value | PATCH shadow email delete/add deltas | actual connector PATCH with remove then add, new primary persisted |
| leaver | PATCH shadow activation delta | PUT/PATCH active=false, response inactive |
| delete | DELETE shadow | actual connector DELETE, 204 |
| schemas | independent authenticated GET Schemas | three schemas |
| config | independent authenticated GET ServiceProviderConfig | PATCH and filter advertised |
| groups | independent authenticated GET Groups | empty list |

Explicit shadow deltas trigger the installed connector's operations even when
ordinary outbound mappings would omit PATCH or DELETE. No direct User request
can supply a missing connector scenario. Shadow searches must actually emit the
requested wire operation; a cache hit or unsupported connector operation fails
capture validation. The supplemental invocation is retained per envelope. The
person is temporary bookkeeping; the shadow seam deliberately avoids Phase 4
persistent mappings, correlation or schedules.

midPoint 4.8.14 does not pass shadow-search paging to the pinned connector, even with a native
`pagedSearch` capability, an offset or ordering: it returns every shadow and the connector lists
unpaged (P3-36). The page scenario therefore records the real unpaged list; server paging stays
covered by the backend query and lifecycle tests, never by an authored request.

The mover follows P3-34 asserted-attribute PUT semantics. Emails are ConnId JSON
strings with boolean `primary` on input; the actual connector's string `primary`
on PATCH, Slack schema URN, empty groups and Enterprise employeeNumber fallback
are retained verbatim. No externalId or omitted attributes are invented. The
validator requires both email remove and add in the observed PATCH; if this
connector/configuration does not emit them, the checkpoint stays pending and
requires a real supported invocation, never a replacement direct request.

REST seam references: [midPoint 4.8 REST operations](https://docs.evolveum.com/midpoint/reference/support-4.8/interfaces/rest/operations/)
and [resource test](https://docs.evolveum.com/midpoint/reference/support-4.8/interfaces/rest/operations/resource-op-rest/).
Attribute/object-class spellings follow the pinned connector's
[Scim2UserAdapter](https://github.com/ExclamationLabs/connector-scim2/blob/05c404bbecf9c28938e2183411c7b04b4f8f4226/src/main/java/com/exclamationlabs/connid/base/scim2/adapter/Scim2UserAdapter.java).

## Evidence boundary

Only requests carrying the in-memory gate credential are captured. The hook
observes request bytes without consuming the parser's stream, retains the
original response writer, and parses actual JSON on response completion. Raw
traffic exists in memory only. A malformed/oversized envelope poisons the run.

Before any filesystem write, the sanitizer removes authorization, cookies,
credential/password/token fields and all headers except `accept`, `content-type`
and `retry-after`. Known credential values, Bearer strings, source tokens and
JWT-like strings in remaining values fail closed, including decoded query values.
Unknown metadata and query keys are refused. Body property spelling, order,
arrays, operation case and string/boolean shapes are preserved.

Stable declared substitutions use `{{USER_ID_1}}`/`{{TIMESTAMP_2}}`-style markers.
Each declaration names a user id, resource id or timestamp, replaces an actual
literal consistently and must be used. The manifest records each marker's kind;
original dynamic values stay in memory. No email, username, attribute spelling,
operation name or payload shape is substituted. Unknown/duplicate/unused markers
and reordered or missing scenarios fail verification. Version/date/run/command,
origin labels, per-envelope invocation, successful outcomes and cleanup are
mandatory closed metadata. Verification validates that evidence contract; it
cannot independently attest that an arbitrary edited file came from a live run.
Only orchestrator-observed execution establishes genuine provenance.

After successful cleanup, validation runs before a private staging directory is
created, then publishes both files together under:

- `.planning/workstreams/iam/phases/03-strapi-scim-2-0-service/evidence/connector-capture/capture.json`
- `.planning/workstreams/iam/phases/03-strapi-scim-2-0-service/evidence/connector-capture/manifest.json`

Existing evidence is not overwritten. Failure never publishes a partial capture.
Cleanup attempts shadow, person and resource independently, then clears only the
capture session belonging to this run. A cleanup failure blocks evidence output.
The orchestrator records actual command results and remaining manual cleanup in
`03-CONNECTOR-CAPTURE-EVIDENCE.md`; this tool never writes a checkpoint verdict.

The replay fixtures are byte-for-byte copies of both files:
`apps/backend/tests/fixtures/iam-scim/connector-lifecycle.json` (capture) and
`connector-lifecycle.manifest.json` (manifest). The replay test checks their digests
against `PROVENANCE.md` and validates them with `--verify-evidence <capture> <manifest>`,
so archiving the phase directory does not break it. Re-copy both after a re-capture.

## Offline tests

`apps/backend/tests/iam-scim-capture-tooling.unit.test.ts` uses authored in-memory
envelopes and simulated container/control seams, with no Docker, HTTP listener or
browser. Tests assert sanitation, unchanged streams, closed metadata, exact
operation requirements, substitution integrity, isolation, token handoff,
timeouts and cleanup after partial failure. These are tooling tests and provide
no captured connector fixture or live checkpoint claim.

## Phase 4 persistent configuration capture (P4-28)

`capture-lifecycle.mjs` drives the committed HR mappings and tasks, with no
transient resource or shadow deltas. Offline validation is tooling validation;
the orchestrator must execute the live checkpoint and publish its provenance.
Phase 3 capture and replay remain separate.

Prepare the isolated gate using steps 1–4 above, with a **new**
`IAM_SCIM_CAPTURE_RUN_ID`, fresh SQLite database, normal fictitious CSRM/IAM
seeds, provisioning and token verification disabled, and the single preload
`capture-scim.mjs`. For a new database use token **issue**, not rotate, in the
handoff pipeline. The same preload now accepts `begin` with `profile: "phase4"`;
it still owns the only control socket and observes the mounted Strapi listener.
Do not preload `capture-lifecycle.mjs` or start another listener.

Provide a freshly reset, isolated midPoint with the pinned image/runtime and
connector source record from step 5. Seed the committed `100`, `110`, `140`,
`150`, `300`, `310`, `320`, `330`, `340` objects and schema extension, with the
**gate** token rendered into resource `...000110`. Keep the developer stack out
of this checkpoint. Resetting and seeding are orchestrator preparation; the
runner does neither. Ensure no scheduled task races the manually invoked stages
(including the initial reference.csv import); no HR Identities or open cases
may exist at the start. The runner refuses active tasks during preflight and
before each manual trigger. An interrupted run needs a new disposable gate,
not a rerun against partially provisioned users.

The gate must contain the seeded unowned manual user `maya.requestor`, email
`maya.requestor@idambox.com`, from
`apps/backend/src/bootstrap/seed-assessment-navigation-lifecycle.ts`. This is a
fictitious development person. The claim CSV retains that seeded email exactly;
all new lifecycle addresses use `idambox.test`. Preflight makes a token-authenticated
read before starting capture to verify this candidate is visible, active and
has no source key. This read is not connector evidence. Preflight also checks
all nine persistent objects, resource 110's endpoint and connector paging, the
image/runtime/source pin and unique installed connector. The marked connection
stage requires resource 110's test to succeed against the gate.

From the repository root, with the gate's run identifier already exported:

```sh
node docker/midpoint/e2e/capture-scim.mjs --check
node docker/midpoint/e2e/capture-lifecycle.mjs --check
node docker/midpoint/e2e/capture-lifecycle.mjs --run
node docker/midpoint/e2e/capture-lifecycle.mjs --verify-evidence
```

| Stage | Invocation and required observation |
| --- | --- |
| connection | Test resource 110; connector GET ResourceTypes. |
| initial-import | Publish `fixtures/phase4/hr-1-initial.csv` through `hr-publish.sh`; run task 310; POST Users 201. |
| live-sync-baseline | Run task 300 once; no writes expected (zero envelopes is valid). |
| mover | Publish hr-2-mover.csv; run 300; PUT title and Enterprise department, PATCH email remove then add. |
| leaver | Publish hr-3-leaver.csv; run 300; PUT active=false for the same person. |
| claim-conflict | Publish hr-4-claim.csv; run 300; POST Users 409 for the seeded candidate's email. |
| claim-case | Run 320; locate the unique open correlation case and its target shadow's HR Identity owner option. |
| claim-confirm | POST `/rpc/executeScript`: search CaseType by inOid, then execute-script calling completeWorkItem with the actual work-item id and existing-owner option; keyed PUT claims the manual User. |
| reconciliation | Run 320 again; GET Users with count=100 and startIndex, plus individual reads. |

Each hook stage marker precedes CSV publication or REST invocation. Tasks use
`POST /tasks/{oid}/run`, then polling until `lastRunFinishTimestamp` is strictly
newer than the trigger time and `executionState` is not running. No work-item
REST endpoint is used. The final reconciliation may emit additional PUTs because
of the connector's displayName read behaviour (ADR 0006); these are retained.
ResourceTypes and Groups requests remain connector background envelopes in their
actual stage and order. No direct request fills missing connector coverage.

The same 180-second stage, 20-minute overall and 30-second cleanup budgets apply.
The runner creates no midPoint objects. Cleanup drains and closes only its own
capture session; it leaves HR snapshots, cases and Users in the disposable gate.
It restores nothing on the developer stack. The orchestrator disposes of its
gate process/database/handoff and isolated midPoint after reviewing results.

Publication requires all listed operations, successful cleanup and the shared
sanitation/provenance contract. Only User-id substitutions are allowed. The
intentional POST 409 is retained; unexpected failed traffic blocks publication.
Existing evidence is never overwritten. Successful output is:

```text
.planning/workstreams/iam/phases/04-midpoint-configuration/evidence/connector-capture/capture.json
.planning/workstreams/iam/phases/04-midpoint-configuration/evidence/connector-capture/manifest.json
```

After live verification, copy the published bytes and calculate the digests:

```sh
cp .planning/workstreams/iam/phases/04-midpoint-configuration/evidence/connector-capture/capture.json apps/backend/tests/fixtures/iam-scim/connector-lifecycle-phase4.json
cp .planning/workstreams/iam/phases/04-midpoint-configuration/evidence/connector-capture/manifest.json apps/backend/tests/fixtures/iam-scim/connector-lifecycle-phase4.manifest.json
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = '.planning/workstreams/iam/phases/04-midpoint-configuration/evidence/connector-capture/';
const manifest = JSON.parse(readFileSync(dir + 'manifest.json', 'utf8'));
console.log('Capture date: ' + manifest.date);
console.log('Capture run: ' + manifest.runId);
for (const file of ['capture.json', 'manifest.json']) console.log(file + ' SHA-256: ' + createHash('sha256').update(readFileSync(dir + file)).digest('hex'));
NODE
```

Complete **every** marked field in
`apps/backend/tests/fixtures/iam-scim/PROVENANCE-phase4.md`, remove the template
instruction containing the marker word, and record observed execution/cleanup.
The replay fails if the fixture is missing, any TODO remains, dates/run/digests
mismatch, bytes differ, or operation verification fails. Nothing is skipped.

Offline tooling tests use authored in-memory envelopes and simulated command,
control and preflight seams. To compile tests and run the capture tests and the
Phase 4 replay (the temporary config excludes exactly the two known unrelated
CSRM compilation failures):

```sh
node --input-type=module <<'NODE'
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('apps/backend/.tmp', { recursive: true });
writeFileSync('apps/backend/.tmp/phase4-tooling-tsconfig.json', JSON.stringify({
  extends: '../tests/tsconfig.json',
  compilerOptions: { incremental: false },
  exclude: ['../node_modules', '../dist', '../.tmp', '../tests/risk-curation-rules.unit.test.ts', '../tests/risk-history-changes.unit.test.ts']
}));
NODE
pnpm --dir apps/backend exec tsc -p .tmp/phase4-tooling-tsconfig.json --pretty false
pnpm --dir apps/backend exec node --test --test-concurrency=1 .tmp/tests-dist/tests/iam-scim-capture-tooling.unit.test.js .tmp/tests-dist/tests/iam-scim-lifecycle-capture-tooling.unit.test.js
pnpm --dir apps/backend exec node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/iam-scim-replay-phase4.integration.test.js
node --input-type=module -e 'import { rmSync } from "node:fs"; rmSync("apps/backend/.tmp/phase4-tooling-tsconfig.json");'
```

Run the replay after publishing the real fixture and completing provenance; before
that its explicit missing-evidence failure is expected. The existing mounted
HTTP harness uses fresh isolated SQLite, manual baseline candidates from captured
responses, and declared id bindings only; it checks exact requests, responses,
headers, order, conflict non-mutation, claimed ownership and inactive leaver state.


## Phase 5 disposable sign-in journey

The delivered journey has default mailbox, remote-state, browser/access, contract,
IN-03 and evidence bindings. Its operating reference is
[05-OPERATIONS.md](../../../.planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/05-OPERATIONS.md);
measured offline checks and blockers are in
[05-OFFLINE-GATE.md](../../../.planning/workstreams/iam/phases/05-sign-in-and-end-to-end-journey/05-OFFLINE-GATE.md).
The earlier Phase 3/4 instructions above retain their historical scope.

From the repository root, offline:

```sh
node --test docker/midpoint/e2e/journey*.test.mjs
node docker/midpoint/e2e/journey.mjs --check
node docker/midpoint/e2e/journey.mjs --list
pnpm --dir apps/csrm exec playwright test --config playwright.iam-journey.config.ts --list
```

The orchestrator alone supplies the owner-only disposable environment and runs
`journey.mjs --probe-keycloak`, `journey.mjs --run`, then
`journey.mjs --verify-evidence`. Every run requires a fresh database, private
run directory and reset of the exclusively owned `idp` stack. All compose calls
use `IAM_JOURNEY_COMPOSE_ENV_FILE`; developer `docker/.env` is untouched.
Compile/register/destroy and protected token rotation/destroy precede listener
startup. Invitation acceptance is not delivery; uncertain mail requires explicit
`pnpm --dir apps/backend iam:password-setup <local-documentId>` recovery.

The evidence stage cleans up before running **unfiltered** backend and CSRM
regressions, journey tests and the static check. Failed cleanup or regression
blocks publication. Diagnostic exclusions never satisfy that gate. Only complete
closed observations and four allowlisted private viewport images may publish.
Offline tests and browser discovery establish no live pass; A1–A4, IN-03 and the
full two-width journey await the live checkpoints.
