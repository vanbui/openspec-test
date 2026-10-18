# Phase 5: Sign-in and end-to-end journey — Pattern Map

**Mapped:** 2026-10-17  
**Scope:** P5-01–P5-25; SIGN-01 and SIGN-02. Proposed names below are planning assignments, not existing implementations.

## File Classification

| New/modified file | Role | Data flow | Closest tracked analog | Quality |
|---|---|---|---|---|
| `apps/backend/src/keycloak/admin-client.ts` | service | request-response | same file, bounded revocation/token transport | exact |
| `apps/backend/src/iam/password-setup/service.ts` | service | event-driven/request-response | `apps/backend/src/iam/identity/identity-service.ts`; `apps/backend/src/keycloak/admin-client.ts` | role-match |
| `apps/backend/src/iam/password-setup/dispatcher.ts` | utility | event-driven | `apps/backend/src/index.ts` lifecycle integration | partial; detached commit semantics are new |
| `apps/backend/src/iam/identity/identity-service.ts` | service | CRUD/event-driven | same file, `createFromSource` | exact |
| `apps/backend/src/iam/password-setup/resend-cli.ts` | utility | batch/request-response | `apps/backend/src/iam/scim/token-cli.ts` | role-match |
| `apps/backend/src/index.ts`; `apps/backend/package.json` | config | lifecycle/batch | existing administration boot and worker destroy integration | exact |
| `apps/backend/tests/iam-password-setup.unit.test.ts` | test | request-response/event-driven | `apps/backend/tests/keycloak-provisioning.integration.test.ts` assertions; inject scheduler/admin/log ports | partial |
| `apps/backend/tests/iam-password-setup.integration.test.ts` | test | CRUD/event-driven | `apps/backend/tests/keycloak-provisioning.integration.test.ts` | exact |
| `docker/keycloak/import/idambox-realm.json` | config | transform | same file, realm/client seed | exact |
| `docker/midpoint/e2e/journey.mjs` | utility | batch/request-response/file-I/O | `docker/midpoint/e2e/refusal-scim.mjs`; `docker/midpoint/e2e/capture-lifecycle.mjs` | role-match |
| `docker/midpoint/e2e/journey.test.mjs` | test | batch/transform | exported injectable stage runner and proof validator in `docker/midpoint/e2e/refusal-scim.mjs` | role-match |
| `apps/csrm/e2e/iam-journey.spec.ts` | test | request-response | `apps/csrm/e2e/iam-scim-refusal.spec.ts` | exact for isolation/refusal; new for action-link flow |
| `apps/csrm/playwright.iam-journey.config.ts` | config | batch | private config emitted by `docker/midpoint/e2e/refusal-scim.mjs:157–165` | role-match |
| `docker/midpoint/e2e/README.md`; `docker/README.md` | documentation | file-I/O | existing files; `docker/midpoint/e2e/capture-lifecycle.mjs` operating contract | exact |
| Phase 5 evidence manifest/outcomes and operating record | documentation | transform/file-I/O | `docker/midpoint/e2e/refusal-scim.mjs:169–199`; `docker/midpoint/e2e/capture-lifecycle.mjs:67–77` | role-match |
| `docker/midpoint/e2e/journey-runtime.mjs` (06,08) | utility | batch/request-response/file-I/O | `refusal-scim.mjs` private children/cleanup; `capture-lifecycle.mjs` task polling; `token-cli.ts` supported private stdout delivery | role-match |
| `docker/midpoint/e2e/journey-evidence.mjs` (05) | utility | transform/file-I/O | `refusal-scim.mjs` publication; `capture-lifecycle.mjs` evidenceBundle | role-match |
| `docker/midpoint/e2e/journey-mail.mjs` (07) | service | request-response/transform | no exact tracked analog; `05-RESEARCH.md` P5-15 matching/origin prescription | new |
| `docker/midpoint/e2e/journey-contract.mjs`; `journey-contract.test.mjs` (09) | service/test | request-response/batch | no exact endpoint analog; `05-RESEARCH.md` A1–A4 probe matrix, `refusal-scim.mjs` injected deadline/cleanup | partial |
| `docker/midpoint/e2e/journey-conflict.mjs`; `journey-conflict.test.mjs` (09) | utility/test | event-driven/request-response | `capture-lifecycle.mjs` taskFinished and Phase4 A5; new P5-23 state assertions | partial |
| `docker/midpoint/e2e/journey-seed.test.mjs` (04) | test | transform | existing realm/compose files parsed structurally | exact |
| `apps/csrm/e2e/iam-journey-reporter.ts` (07) | utility | event-driven/transform | no exact tracked analog; P5-21 closed output and `05-RESEARCH.md` private evidence contract | new |
| `05-OPERATIONS.md`; `05-OFFLINE-GATE.md` (10) | documentation | file-I/O | existing e2e README and Phase4 operating/evidence records | role-match |
| `05-KEYCLOAK-CONTRACT.md`; `05-LIVE-EVIDENCE.md` and safe manifests (11–12) | documentation | transform/file-I/O | `capture-lifecycle.mjs` safe run/correlation manifest; actual observations mandatory | role-match |

Assignments below use the final filenames in the twelve plans. Every new helper's owning plan is recorded; no change to content-type schemas, generated declarations, JDL or default Playwright configuration is included.

## Pattern Assignments

### Identity service and invitation eligibility

**Analog:** `apps/backend/src/iam/identity/identity-service.ts:1–7,40–53,160–173`.

Imports remain feature-relative and Strapi is type-only:

```typescript
import type { Core } from "@strapi/strapi";
import { withIdentityUserLock } from "./user-lock";
import { runSourceMutation } from "./write-context";
```

Existing trusted create sequence, lines 164–171:

```typescript
return await withIdentityUserLock(strapi, undefined, async () => {
  const data = {
    ...(parsed.value as Record<string, unknown>), username: parsed.value.username, email: parsed.value.email,
    displayName: parsed.value.displayName, accountStatus: parsed.value.accountStatus,
    identitySource: principal.sourceDocumentId, lastSyncedAt: new Date().toISOString(), protected: false, roles: [],
  };
  const user = await runSourceMutation(strapi, principal, "create", undefined, () => strapi.documents(USER).create({ data }));
  return { ok: true as const, value: project({ ...user, identitySource: { documentId: principal.sourceDocumentId } } as User) };
});
```

Register invitation work only for this actual create path, inside its existing transaction. Do not copy registration into patch/replace, manual provisioning or generic Document Service middleware. The installed outer-transaction hook mechanics are documented in `05-RESEARCH.md`; returning from this inner operation is not proof of outer commit. Keep all IdamBoxUser mutations in the identity service through Document Service.

The invitation service copies the Document Service read pattern at lines 40–42:

```typescript
return strapi.documents(USER).findOne({ documentId, populate: { identitySource: { fields: ["documentId"] } } });
```

Read fresh committed eligibility, stored subject and source binding before dispatch. Explicitly reject inactive/protected/service/tombstoned/manual/subjectless users; no remote lookup by email and no user mutation. Closed outcomes follow the identity service's `ok` discriminant, rather than leaking exception text.

### Bounded action-email transport

**Analog:** `apps/backend/src/keycloak/admin-client.ts:46–62,184–239`.

Reuse the existing bounded token/transport machinery, including shared pending token handling. Existing fetch boundary at lines 225–229:

```typescript
private async fetchWithTimeout(operation: string, url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, { ...init, redirect: "error", signal: AbortSignal.any([
      AbortSignal.timeout(this.config.requestTimeoutMs), ...(signal ? [signal] : []),
    ]) });
```

Extend this client with a narrow action-email operation accepting the stored subject, exact `["UPDATE_PASSWORD"]` action array and a bounded deadline/signal. Never reuse `resetPassword`, emit remote request URLs, or serialize an error/cause. The generic formatter at lines 247–265 accepts remote `errorMessage` text; it is deliberately **not** the invitation diagnostic pattern. Invitation errors use a closed allowlist of codes, and accepted dispatch is distinct from mailbox receipt. Version-specific endpoint facts remain subject to the research contract probe.

### Administration command and lifecycle

**Analog:** `apps/backend/src/iam/scim/token-cli.ts:131–146`.

```typescript
try { parseTokenCliArgs(process.argv.slice(2)); }
catch (error) { process.stderr.write(tokenCliFailureMessage(error)); process.exitCode = 1; return; }
markAdministrationBoot();
```

Copy early argument validation, administration-only Strapi boot, injected dependencies, bounded cleanup and closed exit result. Adapt the parser for one non-secret IdamBox User documentId. Do not copy token stdout delivery: resend outputs only a safe outcome. Require provisioning/configuration before loading the invitation client. Integrate ordinary scheduler teardown alongside `apps/backend/src/index.ts:87–92`:

```typescript
async destroy({ strapi }: { strapi: Core.Strapi }) {
  await stopKeycloakSyncWorker(strapi);
  await deferredAiRunReconciliations.get(strapi)?.stop();
```

Email work needs its own bounded, best-effort lifecycle; never reuse the durable disable/session outbox. Administration boot must still suppress ordinary seeds/workers. Flag-off boot must instantiate no invitation client/timer.

### Real Strapi transaction tests

**Analog:** `apps/backend/tests/keycloak-provisioning.integration.test.ts:1–13,32–49,52–98,191–214`.

```typescript
import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { after, before, test } from "node:test";
import type { Core } from "@strapi/strapi";
```

Real application boot at lines 79–88:

```typescript
const compiled = await strapiPackage.compileStrapi({ appDir });
compiledDir = compiled.distDir;
strapi = await strapiPackage.createStrapi(compiled).load();
(strapi as unknown as { cron?: { destroy?: () => void } }).cron?.destroy?.();
(strapi as unknown as Core.Strapi).documents.use(async (context, next) => {
  if (context.uid === IDAMBOX_USER_UID && ["create", "update"].includes(context.action)) {
    const data = { ...(context.params as { data: Record<string, unknown> }).data };
    writes.push({ action: context.action, data });
    if (failLinkage && data.password === null && typeof data.externalSubject === "string") {
      throw new Error("TEST_LINKAGE_FAILURE");
```

Copy isolated SQLite filename/environment restoration, real Document Service middleware and controlled linkage failure. Lines 196–203 load identity-service/source-principal modules from `compiledDir`; preserve this application-instance identity instead of mixing compiled and test-import authority contexts. For new tests, inject the email client/scheduler; loopback HTTP or remote identity services are unnecessary for email dispatch assertions.

Add behavioral outer-transaction coverage: pending outer commit has zero sends, successful real commit dispatches once, rollback/linkage/commit failure sends none, and callback/scheduler/client/log failures preserve committed SCIM success. A fake transaction callback alone cannot establish nested hook semantics. Keep unit exclusion/redaction tests distinct from real SQLite coverage.

### Gate, task polling, evidence and browser isolation

**Primary analog:** `docker/midpoint/e2e/refusal-scim.mjs:14–80,83–165,169–229`.

Copy exported stage orchestration with injected runtime methods and per-stage/overall deadlines; preserve the original failed stage separately from cleanup failures. Do not copy the older runner's generic failure replacement where it would lose P5-13 diagnostics. Existing private browser config, lines 159–165:

```javascript
await writeFile(config, `export default ${JSON.stringify({
  testDir: path.join(ROOT, 'apps/csrm/e2e'), testMatch: 'iam-scim-refusal.spec.ts', timeout: 180000,
  workers: 1, retries: 0, reporter: 'line', outputDir: path.join(runDir, 'results'),
  use: { baseURL: publicOrigin, trace: 'off', screenshot: 'off', video: 'off' },
})};\n`);
```

The journey needs a dedicated checked-in config, explicit opt-in environment and secret-safe reporting; default discovery and `--list` must stay inert. Reuse isolated Next dist/output ownership and cleanup, but select realm-registered `http://localhost:3000`, refusing an occupied listener. Never copy the refusal runner's fixture password setup as journey proof.

Supporting tracked browser precedent, `apps/csrm/e2e/iam-scim-refusal.spec.ts:6,18–43,47–52`:

```typescript
const live = process.env.IAM_SCIM_REFUSAL_LIVE === 'true';
test.describe('same OIDC session after SCIM deactivation', () => {
  test.skip(!live, 'Opt-in isolated live gate only; run refusal-scim.mjs --run.');
```

Reuse bearer-authenticated loopback control, per-width contexts, accessible role locators, keyboard focus checks, no-overflow checks and absence-of-protected-content assertions. Extend with actual Mailpit action-link setup, a fresh independent CSRM sign-in, same-context mover/leaver and separate synthetic people for each width.

Supporting tracked task precedent, `docker/midpoint/e2e/capture-lifecycle.mjs:36–39`:

```javascript
export function taskFinished(task, triggerTime) {
  task = object(task);
  return task?.executionState !== 'running' && Date.parse(task?.lastRunFinishTimestamp) > triggerTime;
}
```

Use native task completion after each published CSV snapshot, with competing schedules suspended. Existing `docker/midpoint/hr-publish.sh`, `render.sh` and `reload.sh` remain the operation boundaries; do not substitute direct SCIM writes. Preserve retryLater cadence and explicit IN-03 recovery observation.

Evidence publication copies `refusal-scim.mjs:190–199` staging/rename after successful cleanup and `capture-lifecycle.mjs:67–77` version/run/correlation manifest. Extend the schema to require all named stages, both widths, reset, token-validity timing, IN-03 and cleanup before passing. Generate evidence only from live observations; `--check` and tests publish none.

### Realm seed and documentation

`docker/keycloak/import/idambox-realm.json:59–108` preserves the localhost callback/logout registration, PKCE and audience/basic scopes. Add only local SMTP settings to the realm object. Existing `docker/docker-compose.yaml:8` pins Keycloak 26.6.1 and its Mailpit HTTP binding at lines 135–136 stays loopback. Use the existing internal Mailpit SMTP service/1025; no new catcher or SMTP public binding.

Operating docs must describe exact commands, private environment/handoff contracts, exclusive disposable ownership and stage evidence. Mark Docker/reset, Keycloak/Mailpit, midPoint task runs, live Playwright and IN-03 as orchestrator live checkpoints. Ordinary code/test/config/runner work and `journey.mjs --check` remain offline. Preserve committed false defaults.

## Shared Patterns

Plan06 additionally owns apps/backend/src/bootstrap/seed-csrm-data.ts (service, transform/CRUD; closest exact analog is its existing approved application/function/API/role block) and apps/backend/tests/iam-journey-bootstrap.integration.test.ts (integration test, CRUD/event-driven; analog keycloak-provisioning.integration.test.ts real compiled application/SQLite). Extract catalogue-only initialization without changing its exact grants or normal fixture behavior. Core seed signature is seedCoreData(strapi), guarded by IDAMBOX_SEED_CORE; catalogue prerequisite initialization precedes trusted registration in administration mode, with provisioning off and no human fixture writes.

Final private token pattern: `token-cli.ts` supports issuing to stdout without the optional development-file export. Gate06 privately pipes that stdout, validates the token, waits for CLI application destruction/exit, then populates only its owner-only `IAM_JOURNEY_COMPOSE_ENV_FILE`. The existing `dev-token-export.ts` hardwires `docker/.env` and is not the gate handoff. Every compose call explicitly selects the private env file with actual `KC_BOOTSTRAP_ADMIN_USERNAME/PASSWORD` names; parent process allowlisting prevents ambient overrides. Tests cover unchanged developer configuration, unsafe-path/race refusal, secret-safe output, all compose interpolation keys and compile/admin/destroy-before-listener ordering. No analogous exporter lease is required because no developer file is modified.

- **Authorization:** existing Auth.js → typed Strapi client → identity token verification → `/api/v1/me/access` boundary. Navigation assertions accompany direct server refusal and cross-Requestor-record checks.
- **Identity authority:** source principal validation, existing identity upsert/Document Service boundary, stored immutable source/subject linkage. No raw writes, additional entity or schema change.
- **Error handling:** closed result codes and non-throwing allowlisted invitation events; no error message/cause, mail, address, token, action URL or raw response.
- **Offline isolation:** injected runtime/client/clock/scheduler, real local SQLite transaction proof, inert imports/check/list and opt-in browser activation.
- **Secret storage:** private ignored run directories and process environment/stdin; never CLI credential arguments, traces, storage state or automatic screenshots.

## No Exact Analog Found

| Responsibility | Reason and required source |
|---|---|
| Detached post-outer-commit invitation scheduler | Existing identity transactions and worker lifecycle are partial analogs only. Use installed Strapi hook findings in `05-RESEARCH.md`, detached authority boundary and real nested tests. |
| Keycloak execute-actions-email contract | Admin transport exists; installed application contains no endpoint implementation. Use bounded client seam and the research's version-specific probe gate. |
| Mailpit message selection and self-service action-link journey | Existing refusal spec uses a fixture password. Implement recipient/run/time matching and local-origin validation; actual link remains private. |
| Fresh whole-stack journey and IN-03 retry recovery | Existing capture/refusal stages cover parts only. Explicit reset/ownership, task-driving and full evidence schema must be added and live-checked. |

## Metadata

Analog search scope: tracked backend IAM/Keycloak source and tests, CSRM refusal spec, Docker realm/compose and midPoint e2e tooling. Five primary analogs were selected; the named supporting configuration/browser/task paths were also checked with read-only `git ls-files`. Installed dependency implementation is research evidence only, not a tracked source analog. No source implementation, runtime proof or commit is supplied by this map.
