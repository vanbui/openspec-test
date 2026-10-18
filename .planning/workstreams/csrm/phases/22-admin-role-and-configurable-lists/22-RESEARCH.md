# Phase 22: Admin role and configurable lists - Research

**Researched:** 2026-10-01
**Domain:** Strapi 5.51 document middlewares and request context, Content Manager visibility and RBAC, the acceptance round's criteria snapshot, and G-20's manual start
**Confidence:** HIGH for the Strapi mechanics (read in the installed 5.51.0 sources this session). MEDIUM for the round readers and the manual start, because they rest on the planned outputs of 12, 17, 17.1, 20 and 21, and most of those plans are not yet written.

**Scope (stage2-rules §3a; spawn prompt).** This research answers only what `22-CONTEXT.md` leaves open on four points:
1. how the change-log middleware learns the admin-panel user, and how it sees writes made from the role side;
2. hiding the new types from the Content Manager;
3. who reads the open round's criteria snapshot;
4. the lifecycle facts of G-20's manual start.

It also confirms the Admin fixture against the realm import and the OIDC tests, and adds the Validation Architecture. The other "Open for research" items in the CONTEXT are left to the planner, with pointers (§7). Earlier phases' research is reused, not re-surveyed:
- 17.1-RESEARCH: "The Configuration Points", "Content-Type Shapes" and "The Risk Decision";
- 12-RESEARCH and the 12-02, 12-04, 12-05, 12-06 and 12-07 plans;
- 20-RESEARCH R7;
- 21-CONTEXT D-06 and D-07;
- the 17-02 plan for the fixture pattern.

<user_constraints>
## User Constraints (from 22-CONTEXT.md)

The CONTEXT binds the plans in full. Following stage2-rules §3a it is cited, not restated.

### Locked Decisions
D-01 to D-28 in `22-CONTEXT.md` `<decisions>`, with `<contract_gaps>` (four records and one `checkpoint:decision`), `<authorisation>` (the negative-case table) and `<seams>`. The decisions this research serves:
- **D-08:** role changes are recorded by a document middleware, written in the same transaction, from either side of the user-role relation and by any path, with the origin and the operator.
- **D-10 and D-11:** a store with getters, applied forward only; acceptance rounds keep their snapshot.
- **D-12:** the change log is append-only. The settings and log types are hidden from the Content Manager where Strapi allows it, and otherwise the residual is recorded.
- **D-22 and D-23:** the manual start: who, when, how and what it records.
- **D-26:** the Admin persona with `5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e05`.

The 22-UI-SPEC's orchestrator amendments also bind: the division retire cascade and its reinstatement, the settled items under UI-D6, and `CircleAlert`.

### Claude's Discretion
"Planner's Discretion" in the CONTEXT: module placement, names within the families, and how plans split under D-28's serialisation.

### Deferred Ideas (OUT OF SCOPE)
The CONTEXT's `<deferred>` list. Most relevant here:
- starting without AI by choice;
- role assignment in CSRM;
- dual control for configuration changes;
- a disposal job;
- renaming scale labels.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-07 | An Admin role owns reference data and product configuration, and Security Analysts keep read access | §2: the settings and log types are kept out of admin-panel writes. §3: the round snapshot keeps changes forward-only. §4: the manual start that lets work proceed when the AI policy refuses. §6: the admin persona. Validation Architecture: SC1, SC2 and SC4. |
| ADMIN-08 | The Admin sees who holds which CSRM role, and any role change is audited | §1: the role-change middleware (the admin-panel operator, both relation sides, every write action, one transaction). Validation Architecture: SC3. |
</phase_requirements>

## Summary

**The admin-panel operator is reachable from a document middleware.**
- Strapi 5.51 runs every HTTP request inside an `AsyncLocalStorage` request context, and `strapi.requestContext.get()` returns the Koa `ctx`.
- On admin routes the `admin` strategy, or the newer `admin-token` strategy, sets `ctx.state.user` to the `admin::user` row (`firstname`, `lastname`, `username`, `email`), and `ctx.state.auth.strategy.name` names the strategy.
- With no request context (bootstrap seeds), the origin is `system`.

**The role side reaches the middleware as an ordinary document write.**
- The Content Manager writes through `strapi.documents(uid).create/update/clone/delete`, and bulk delete loops over `delete` inside one transaction. So a write to `api::role.role` that changes `idamboxUsers` reaches the middleware as `uid: "api::role.role"`.
- The robust design reads the relation from the database before and after `next()`, rather than parsing `connect`, `disconnect` or `set` payloads, and writes one row per affected user whose roles or status actually changed.
- `strapi.db.transaction` joins an outer transaction, so the rows commit or roll back with the write.

**Hiding works, and it is stronger than cosmetic.**
- `pluginOptions["content-manager"].visible: false` makes a type `isDisplayed: false`.
- The Content Manager then registers only `explorer.read` for it, not `explorer.create`, `update`, `delete` or `publish`. The super admin's permissions are generated from that registry, so even a super admin cannot write the settings or the log from the panel. Reading remains, a small recorded residual.

**The round snapshot.** It is read only by the round's own governance:
- the decision acts and their sequencing;
- the derived decision state and validity;
- the completing act's review date;
- release-and-close readiness;
- the participant and analyst projections while the round is open.

Submission readiness, Phase 20's decision review, the AI's Accept rule and everything between rounds use the current store.

**The manual start.** Each start writes exactly what its generation writes, minus the AI facts:
- the questionnaire start leaves the request `submitted`;
- the draft start moves the request to `risk-assessment-drafted`.

Two gaps need the orchestrator (Open Questions 1 and 2): `CONTEXT_TOO_LARGE` creates no run, and the questionnaire's `title` is required.

**Primary recommendation:**
- Build D-08's middleware as a before-and-after database diff over `strapi.db.query`, keyed on `uid` and `action`, attributing the origin from `strapi.requestContext.get()?.state`.
- Hide the four new types with `visible: false`, and prove it by asserting the Content Manager's action registry.
- Pass one parsed `RoundCriteria` object explicitly to every round-scoped function, and never call the zero-argument getters inside them.

## Project Constraints (from AGENTS.md and stage2-rules)

- **Strapi stays the API boundary** and enforces Role → Function → FunctionAPI against `ctx.state.idamboxUser`, never branching on the auth mode.
- **Keycloak** is never started and no flag changes; the OIDC tests stay green.
- **AI output is advisory.** The manual start makes no AI claim, and a Requestor's view never says "AI assisted" for such a record.
- **JDL terms;** a contract-gap record and checkpoint before any schema change.
- **No new dependency.** Everything below uses Node's built-ins and Strapi 5.51 APIs already installed.
- **Tests with every material workflow:** Strapi node:test, Vitest and Playwright. A Playwright run leaves the tree clean.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Role-change recording (D-08) | API / Backend (document middleware) | Database (same transaction) | Every write path, including the admin panel and seeds, passes the document service; no route exists |
| Hiding the settings and log types from the panel | API / Backend (schema `pluginOptions`) | — | Strapi's Content Manager reads the flag server-side and registers permissions from it |
| Round criteria snapshot | API / Backend (submission and round services) | Database (JSON on the round) | Server projects every derived fact (17.1 D-58); the web never computes |
| Manual start | API / Backend (generation workflows' siblings) | Browser (the job card's control, X-80) | The gate, lock and records are server facts; the web shows the served `aiPolicy` block |
| Admin fixture | API / Backend (seed and fixture subjects) | Keycloak realm file (static) | ADR 0004: ids change together; nothing runs Keycloak |

## Standard Stack

No package is added. Everything is in the installed `@strapi/strapi` 5.51.0 [VERIFIED: apps/backend/package.json:21-24 lists `"@strapi/database": "5.51.0"`, `"@strapi/strapi": "5.51.0"`] and Node's `async_hooks`, which Strapi itself uses for the request context.

| API | Where | Use here |
|-----|-------|----------|
| `strapi.documents.use(middleware)` | `@strapi/core` document service | D-08's middleware, registered in `register()` beside `registerIdamboxUserProvisioning` [VERIFIED: apps/backend/src/index.ts:17-20] |
| `strapi.requestContext.get()` | `@strapi/core/dist/services/request-context.js` | The request's Koa `ctx`, or `undefined` outside a request |
| `strapi.db.transaction(cb)` | `@strapi/database` | Joins an existing transaction; offers `onCommit` |
| `pluginOptions["content-manager"].visible` | Content Manager `data-mapper.js` | Hides a type and withholds its write permissions |

## Package Legitimacy Audit

No external package is installed by this phase. The audit is not applicable.

**Packages removed due to [SLOP] verdict:** none. **Packages flagged as suspicious [SUS]:** none.

## 1. The Change-Log Middleware: the Operator, and Writes from the Role Side (D-08)

### What Strapi 5.51 provides (read this session)

**The request context is a Koa `ctx` held in `AsyncLocalStorage`.**
- The server wraps every request: `app.use((ctx, next)=>requestContext.run(ctx, ()=>next()));` [VERIFIED: @strapi/core/dist/services/server/index.js:26].
- The store: `const storage = new async_hooks.AsyncLocalStorage(); ... get () { return storage.getStore(); }` [VERIFIED: @strapi/core/dist/services/request-context.js:5-12].
- It is exposed as `get requestContext() { return this.get('requestContext'); }` [VERIFIED: @strapi/core/dist/Strapi.js:84-85].
- Strapi uses this inside the document service itself: `const getRequestState = ()=>strapi.requestContext?.get?.()?.state;` [VERIFIED: @strapi/core/dist/services/document-service/transform/data.js:8].
- Strapi's own metrics read the admin user this way: `const ctx = strapi?.requestContext?.get(); if (!ctx?.state?.user?.email) {` [VERIFIED: @strapi/core/dist/services/metrics/admin-user-hash.js:12-13].

**The admin strategies set the operator.**
- `admin`: after validating the session it runs `strapi.db.query('admin::user').findOne({ where: { id: userId }, populate: [ 'roles' ] })`, then `ctx.state.user = user;`, and its name is `const name = 'admin';` [VERIFIED: @strapi/admin/dist/server/server/src/strategies/admin.js:47-77].
- `admin-token` also sets `ctx.state.user = authResult.user;` under `name: 'admin-token'` [VERIFIED: strategies/admin-token.js:23-24, 43].
- The auth service records the strategy: `ctx.state.auth = { strategy, credentials, ability };` [VERIFIED: @strapi/core/dist/services/auth/index.js:59-63].
- The admin user's attributes include `firstname`, `lastname`, `username` and `email` [VERIFIED: @strapi/admin/dist/server/server/src/content-types/User.js:21-41].

**CSRM's own identity never uses `ctx.state.user`.** Both identity middlewares write `context.state.idamboxUser = { documentId: identity.documentId };` [VERIFIED: apps/backend/src/middlewares/csrm-development-identity.ts:50; csrm-keycloak-identity.ts:56]. So `state.auth.strategy.name` ∈ {`admin`, `admin-token`} with `state.user` set identifies an admin-panel operator unambiguously.

**Every Content Manager write is a document-service write.**
- `create` → `strapi.documents(uid).create(params)`, `update` → `.update(...)`, `clone` → `.clone(...)` and `delete` → `.delete(...)`.
- `deleteMany` runs `strapi.db.transaction(async ()=>{ return Promise.all(documentIds.map(async (id)=>this.delete(id, uid, opts))); })`.
- [VERIFIED: @strapi/content-manager/dist/server/services/document-manager.js:70-140.]
- Neither `idambox-user` nor `role` uses draft and publish (`"draftAndPublish": false` in both schemas, read this session), so `publish`, `unpublish` and `discardDraft` never occur for them.

**The relation is many-to-many, owned on the user side.**
- `IdamBoxUser.roles`: `"relation": "manyToMany", "target": "api::role.role", "inversedBy": "idamboxUsers"`.
- `Role.idamboxUsers`: `"relation": "manyToMany", "target": "api::idambox-user.idambox-user", "mappedBy": "roles"`.
- `accountStatus` is `"enum": ["active", "inactive"]`.
- [VERIFIED: apps/backend/src/api/idambox-user/content-types/idambox-user/schema.json; apps/backend/src/api/role/content-types/role/schema.json.]
- Editing a role's users in the panel is a `documents("api::role.role").update` whose `data.idamboxUsers` carries `connect`, `disconnect` or `set`. Strapi writes the same join table either way.

**Transactions nest.**
- `const notNestedTransaction = !transactionContext.transactionCtx.get(); const trx = notNestedTransaction ? await this.connection.transaction() : transactionContext.transactionCtx.get();`. Only the outermost call commits, and `onCommit` is passed to the callback [VERIFIED: @strapi/database/dist/index.js:60-95].
- The provisioning middleware already relies on this: `return strapi.db.transaction(async () => { const result = await next(); ...` [VERIFIED: apps/backend/src/keycloak/register-idambox-user-provisioning.ts:62-63].

**Every CSRM path that writes users or roles goes through the document service.**
- The seed uses `strapi.documents("api::role.role")` and `strapi.documents("api::idambox-user.idambox-user")` [VERIFIED: apps/backend/src/bootstrap/seed-csrm-data.ts:404-405].
- The Strapi harness uses `userService.update({ documentId: owner.documentId, data: { roles: [requestorRole.documentId] } })` and `createDocument(... roles: [analystAgentRole.documentId])` [VERIFIED: apps/backend/tests/helpers/strapi-http-harness.ts:514-551].
- The only raw query write on users is provisioning's `strapi.db.query(IDAMBOX_USER_UID).update({ ... data: { externalSubject, password: null } })` [VERIFIED: register-idambox-user-provisioning.ts:83-86]. It touches neither roles nor status.

### Recommended design

**Registration.** `registerRoleChangeRecording(strapi)` is called unconditionally in `register()`, because D-08 says always on. If Keycloak provisioning is on, it registers after the provisioning middleware. Both open or join one transaction, so the order affects nothing.

**Filter (cheap, in front).** Pass through unless one of these holds:
- `uid === "api::idambox-user.idambox-user"` and `action` ∈ {`create`, `clone`, `delete`}, or `update` with `"roles" in data || "accountStatus" in data`;
- `uid === "api::role.role"` and `action === "delete"`, or `create`, `clone` or `update` with `"idamboxUsers" in data`.

This lets the seed's per-boot `roleService.update({ documentId, data: { description, ... } })` reconciliation through. The Content Manager always sends the full form, so its writes pass the filter, and the diff below writes nothing when nothing changed.

**Diff (no payload parsing).**
1. Inside `strapi.db.transaction`, read the affected users' state before `next()` through `strapi.db.query` (not `strapi.documents`, which would re-enter the middleware chain): roles as `{ documentId, name }` and `accountStatus`.
   - On the user side, read the one user (none on create).
   - On the role side, read the role's `idamboxUsers` with their roles and status.
2. Call `next()`.
3. Read again.
   - For the role side, the affected users are the before set ∪ the after set of that role.
   - For a role delete, read before `next()` only; every former holder loses the role.
   - For a user delete, record roles before → none and status before → `deleted`.
4. Write one `role-assignment` change row per user whose sorted role set or status differs (D-12's shape).
   - The subject is stored as reference plus label (`documentId`, `displayName`), not as a live relation, so a deleted user's row survives.
   - Roles are stored as `{ documentId, name }`, so "since when" (D-07) can match a role by `documentId` even after a rename. Role has no key attribute, and the catalogue's `role.security_analyst` maps to `name: "Security Analyst"` [VERIFIED: catalogue roles `{"id":"role.security_analyst","name":"Security Analyst"}`, `{"id":"role.security_analyst_agent","name":"Security Analyst Agent"}`, `{"id":"role.requestor","name":"Requestor"}`, read this session].

**Origin.**
- `const state = strapi.requestContext.get()?.state`.
- When `state?.auth?.strategy?.name` is `admin` or `admin-token` and `state.user` is set: origin `identity-platform`, operator `{ id, name: trimmed "firstname lastname" || username || email, email }`.
- Otherwise: origin `system` with a source from a small `AsyncLocalStorage` scope that the seed sets (`runWithChangeSource("seed", ...)`), defaulting to `unattributed`.
- A CSRM content-API request never writes users or roles: no route exists, per 08 D-36.

**Same transaction.** The rows are written through the change-log writer inside the joined transaction, so a rolled-back panel write, including one Keycloak provisioning refuses, leaves no row.

**Proof without logging in to the panel.** An integration test wraps a write in `strapi.requestContext.run({ state: { auth: { strategy: { name: "admin" } }, user: { id: 1, firstname: "Ida", lastname: "Ops", email: "ida@example.test" } } } as never, () => strapi.documents("api::role.role").update({ documentId, data: { idamboxUsers: { connect: [userDocumentId] } } }))`. It then asserts one row with origin `identity-platform` and operator "Ida Ops". It needs equal tests for:
- a user-side `roles` set;
- a disconnect;
- a status change;
- a no-op full-form update (no row);
- a role delete;
- a user delete;
- a rolled-back write (no row);
- a write with no request context (`system`).

`run` returns the callback's value through `storage.run(store, cb)` [VERIFIED: request-context.js:7-9]. That the Content Manager's real HTTP path sets `state` exactly as the strategy code shows is [VERIFIED: strategy source]. No existing test drives the admin HTTP API [VERIFIED: grep of apps/backend/tests for `/content-manager/` and `admin::user` found none], so an end-to-end panel test would be new infrastructure, and is not recommended.

### Residuals to record (record 1)
- A write made with raw `strapi.db.query` on the user-role join table, or a database console, bypasses the middleware. No CSRM code does this (above). The record names it, and a static test greps `apps/backend/src` for `db.query("api::idambox-user` and `db.query("api::role` writes other than provisioning's `externalSubject` update.
- Strapi's data-transfer and import tooling writes through the query layer. That is operator tooling outside CSRM's role model, as for 14 D-08's Media Library residual.

## 2. Hiding the Settings and Log Types from the Content Manager (D-12)

**Mechanism, verified in 5.51.0:**
- `const isVisible = (model)=>fp.getOr(true, 'pluginOptions.content-manager.visible', model) === true;` feeds `isDisplayed: isVisible(contentType)` [VERIFIED: @strapi/content-manager/dist/server/services/data-mapper.js:23, 66].
- Permission registration: `const contentTypesUids = allContentTypes.filter(({ isDisplayed })=>isDisplayed).map(fp.prop('uid'));`. Then `explorer.create`, `explorer.update`, `explorer.delete` and `explorer.publish` take `subjects: contentTypesUids`, while `explorer.read` takes `subjects: allContentTypesUids` [VERIFIED: @strapi/content-manager/dist/server/services/permission.js:13-15 and the action list after it].
- The super admin's permissions are generated from the registered actions and their subjects: `const allActions = permissionService.actionProvider.values(); ... const { actionId, subjects } = action; if (fp.isArray(subjects)) { acc.push(...subjects.map(...` [VERIFIED: @strapi/admin/dist/server/server/src/services/role.js:365-374].
- The update controller refuses without the permission: `if (permissionChecker.cannot.update()) {` [VERIFIED: content-manager/dist/server/controllers/collection-types.js:239].

**Consequence.** A hidden type leaves the sidebar, and no admin role, the super admin included, can create, update, delete or publish its rows from the panel. A privileged operator can still read rows by a direct Content Manager URL (`explorer.read` covers all types).

**Recommendation:**
- Set the following on the four new schemas: `CsrmConfigurationSetting`, `CsrmConfigurationChange`, `CsrmDivision` and `CsrmBusinessUnit`.
  ```json
  "pluginOptions": { "content-manager": { "visible": false }, "content-type-builder": { "visible": false } }
  ```
  - The lists are included: an edit made in the panel would skip the change log and the cascade in the orchestrator's amendment 1.
  - The Content-Type Builder flag only hides the builder entry. The builder edits schemas in development alone. [ASSUMED for the builder's behaviour; it does not affect CSRM's guarantees.]
- No repository schema uses `pluginOptions` today [VERIFIED: grep of `apps/backend/src/api/*/content-types/*/schema.json` for `"content-manager"` found none]. The record should say this is the first use.
- **Proof** (an integration test, no login needed): after boot, `strapi.service("admin::permission").actionProvider.get("plugin::content-manager.explorer.update").subjects` excludes the four UIDs, and `...explorer.read` includes them. The same holds for `create` and `delete`. The action ids appear in the Content Manager's admin routes as `'plugin::content-manager.explorer.update'` [VERIFIED: content-manager/dist/server/routes/admin.js:146]. The `admin::permission` service accessor name is [ASSUMED]; the executor confirms it on the first run.
- **Residual (record 2; R-08 register row):** "Strapi administrators can read configuration values and the change log in the admin panel by direct URL. They cannot write them. Existing reference types (Risk Types, Controls, Systems, Assets) and IdamBox Users stay editable in the panel by design; a panel edit of reference data bypasses the change log, which is privileged operator access outside CSRM's role model, as 14 D-08 records for the Media Library. Role and status edits are recorded by D-08's middleware." The reference types are not hidden in this phase: hiding them would remove the operator's repair path, which is a scope change the CONTEXT does not make.

**Why no extra write-guard middleware.** CSRM's own writers use `strapi.documents(...)` from services. Once the panel cannot write, no route writes these types, and D-12's "no route writes it" is enforced by the absent routes and the matrix's unmounted-path rows. A guard would add an `AsyncLocalStorage` token for no further guarantee.

## 3. The Open Round's Criteria Snapshot: Shape and Readers (D-01 item 6; D-11)

**The functions already take the configuration explicitly.** 17.1-RESEARCH fixed the seam [CITED: 17.1-RESEARCH.md "The Configuration Points"]:
- `risk-scale.ts` gains `riskAppetite()` and functions "that take the appetite as an optional last argument (`acceptanceAuthority`, `reviewIntervalMonths`, `isException`, `executiveApproverRequired`, `reviewDateFor`)";
- `review-policy.ts` has `reviewPolicy()` and `peerApprovalRequirement(activeRiskRatings, policy?)`.

**Recommended shape** (closed parser; the record fixes the names):
```ts
type RoundCriteriaV1 = {
  schemaVersion: 1;
  takenAt: string;                                   // the submission's server instant
  scale: { version: number; bands: { lowMax: number; moderateMax: number; highMax: number } };
  appetite: { version: number; bands: Record<RiskRating, {
    authority: "risk-owner" | "risk-owner-with-executive-approval" | "executive-exception";
    treatmentExpected: boolean; reviewIntervalMonths: number }> };
  reviewPolicy: { version: number; peerApproval: "critical" | "high" | "all" | "off" };
};
```
- `version: 0` means the code default (no setting row; D-10).
- The scale's descriptions are omitted. They do not change any evaluation, and they keep the JSON small.
- The AI data policy and the retention setting are not round criteria.
- The authority values are 17.1 D-32's three: `risk-owner`, `risk-owner-with-executive-approval` and `executive-exception` [CITED: 17.1-CONTEXT D-32]. The value set for the rating is `RISK_RATINGS` from 12-02 [CITED: 12-02-PLAN.md exports].

**One resolver.** `criteriaFor({ round })` does the following:
- for an open or closed **acceptance** round, it returns `parseRoundCriteria(round.criteria)`;
- for a round whose `criteria` is null (opened before Phase 22 deployed), it returns `DEFAULT_ROUND_CRITERIA`, the code defaults, which were the only configuration then in force (decision 8, decision 17);
- for a malformed snapshot, it throws, failing closed on a governance act and logged once. Write discipline makes this unreachable: only "Submit final assessment" writes it, through the parser.
- `currentCriteria()` reads the store.
- Response rounds (Phase 17's other kind) carry no criteria.

**Capture once.** "Submit final assessment" reads `currentCriteria()` once at the start of its transaction. It uses that object both to re-check submission readiness and to record the snapshot, so a change committed between the readiness check and the write cannot split them.

**Readers that must use the snapshot** (an open acceptance round, and the round's own close). Every one passes the parsed object explicitly:

| Reader (owner) | What it evaluates | Source |
|---|---|---|
| Submit's own tail: initial `acceptanceState` and the first notifications (17.1) | Authority per rating: who acts first, and whether `executive-approval-requested` follows | 17.1-RESEARCH "Acceptance Rounds" |
| The decision operation (17.1 D-26 to D-31) | Act sequencing per rating (`decide`, `propose`, `approve`), `DECISION_NOT_AVAILABLE`, the recorded `authority` column, and, with D-14, whether the Accept rationale must say why treatment is impracticable | 17.1-RESEARCH "The Risk Decision" |
| The decision-state derivation (17.1 D-33) | The required sequence per authority, behind the cached `acceptanceState` | 17.1 D-33 |
| Validity (17.1-RESEARCH: "single definition, used by state, readiness and release") | The required acts per authority | 17.1-RESEARCH |
| The completing act's review date (17.1 D-36) | `reviewIntervalMonths(rating, criteria.appetite)`; `isException` for the Critical exemption | 17.1 D-36, D-43 |
| Release-and-close readiness and release (17.1 D-41 to D-43) | Every active risk `decided` with valid acts | 17.1 D-41 |
| The participant projection and the analyst detail while the round is open | Each risk's authority, whether treatment is expected, and the interval the confirmation shows | 17.1-RESEARCH "The server projects"; D-14 |
| The X-46 panel's criteria line (22-UI-SPEC "Notes carried") | The versions the round opened under | 22-UI-SPEC |

**Release reads stored facts, not the snapshot, where they exist.** Release writes `isExempted` and the review dates from the completing decision row's stored `authority` and `reviewDate`, which are the snapshot's outputs at the time of the act [CITED: 17.1-RESEARCH "Content-Type Shapes": `authority`, `reviewDate` on `CsrmRiskDecision`]. This keeps release independent of the parser.

**Readers that must use the current store, never the snapshot:**
- Submission readiness before a round: bands, whether an executive approver is needed, and whether peer approval is needed (D-11's readiness items).
- Naming an executive approver (17.1 D-17). The lock refuses it during a round anyway.
- The rating-driven clearing on a residual change.
- The risk editor, the table and the import's derivations (18 D-22).
- The AI's Accept rule (D-14). The AI never runs on locked content.
- Phase 20's decision review renewal, which renews under the appetite current at the review [CITED: 20-RESEARCH R7: "write `decisionReviewDate = addUtcMonths(utcToday(now), reviewIntervalMonths(rating))`"]. That call passes `currentCriteria().appetite` explicitly.
- 17.2's contest, send-back and rework. Send-back closes the round `returned`, and the resubmission takes a fresh snapshot [CITED: 17.2-CONTEXT line 18].

**Peer approval inside a round.** 17.1 D-41's release-and-close readiness does not re-check peer approval, so the snapshot's `reviewPolicy` is an audit fact within the round. It records what applied at submission, for the X-46 line and the third line. [CITED: 17.1-CONTEXT D-41.]

**The readiness caveat.** D-11's "a stored rating outside the new bands" item belongs to **submission** readiness only. Inside an open round, release-and-close readiness runs under the snapshot, so a band change never makes an open round's release outstanding.

**A static guard (recommended).** A unit test greps the round-scoped modules: the decision service, the state derivation, validity, release, and the projections' round branch. It fails on any zero-argument call to `riskAppetite()`, `reviewPolicy()`, `acceptanceAuthority(r)`, `reviewIntervalMonths(r)` or `peerApprovalRequirement(x)` there. This mirrors 17.1's lock-inventory static test.

## 4. The Manual Start: Lifecycle Facts (G-20; D-22, D-23)

### What generation writes today (and after Phase 12), minus the AI facts

| | Questionnaire generation | Assessment draft generation |
|---|---|---|
| **Gate** | `request.requestStatus !== "submitted"` → `REQUEST_NOT_ELIGIBLE`. Inside the locked transaction it re-checks status and the existing questionnaire, and refuses an answered one [VERIFIED: questionnaire-generation-workflow.ts:31, 34] | `loadDraftTarget`: an existing assessment → 409 unless still `risk-assessment-drafted`; otherwise `request.requestStatus !== "questionnaire-in-progress"` → 409; then `submittedAnswers(questionnaire)` [VERIFIED: assessment-workflow.ts:699-713]. Re-checked under `lockAssessmentRequest` (`forUpdate`) [VERIFIED: :716-723, :744-751] |
| **Record** | `questionnaires.create({ data: { questionnaireNumber, title: proposal.title, ...description, assessmentRequest: requestId, generatedDate, generatedBy: analystId, providerName, providerVersion } })` [VERIFIED: :35] | `csrm-assessment.create({ data: { assessmentNumber, assessmentStatus: "draft", generatedDate, generatedBy, providerName, providerVersion, summary, overallRating, recommendationsSummary, overallRiskRationale, assessmentRequest } })` [VERIFIED: :753-765] |
| **Children** | One `questions.create` per proposed question [VERIFIED: :36] | One `csrm-risk.create` per proposed risk [VERIFIED: :767-791] |
| **Request** | Not changed: the code writes no request update [VERIFIED: :34-36] | `data: { requestStatus: "risk-assessment-drafted" }` [VERIFIED: :795-798] |
| **Phase 12 adds** | A `CsrmAiRun` per provider call; `completeAiRun` in the same transaction; question origin derived from `generatedDate` [CITED: 12-CONTEXT D-20, D-22; 12-05-PLAN.md:110] | The run; `aiProvenance` on the assessment and risks [CITED: 12-06-PLAN.md:169, :199] |
| **Phase 21 adds** | The stage recorder where the stage can change [CITED: 21-CONTEXT D-07] | The same |

**Required attributes.** Questionnaire: `title` only. Assessment: `assessmentNumber` and `assessmentStatus` only. [VERIFIED: the schemas' `required` attributes, read this session.]

### What each manual start writes (one transaction, under the same request lock)

**Questionnaire start:**
- **Precondition:** the request is `submitted`, has no questionnaire, the caller is the assignee (13 D-10), and the availability condition below holds.
- **Record:** `questionnaires.create` with `questionnaireNumber` (the same `createWithQuestionnaireNumber`), `title` (Open Question 2) and `assessmentRequest`.
- **AI facts:** none. `generatedDate`, `generatedBy`, `providerName` and `providerVersion` stay null, so 12 D-22's derived question origin is absent and `aiAssisted` is false.
- **Governance log:** one entry of a new kind (proposed `started-without-ai`) with `at`, `by` and `reason` = the served reason code. The parser is closed: `GOVERNANCE_EVENT_KINDS = Object.freeze(["released", "returned-to-review", "question-added", "question-edited", "question-deleted", "answer-cleared"] as const)`, and `MAX_REASON_LENGTH = 500` [VERIFIED: questionnaire-governance-log.ts:26-33, 58]. Record 4 amends 06.8 with the new kind, and the same plan extends the parser, or the entry is rejected.
- **Request:** unchanged (`submitted`).
- **Stage recorder:** called. The stage stays `intake` ("submitted, its questionnaire not released") [CITED: 21-CONTEXT D-06], so it appends nothing.
- **No `CsrmAiRun`.**

**Draft start:**
- **Precondition:** exactly `loadDraftTarget`'s, with no assessment, plus the assignee and availability checks.
- **Record:** `csrm-assessment.create` with `assessmentNumber`, `assessmentStatus: "draft"` and `assessmentRequest`. Everything else is null: no summary, no rating, no risks.
- **AI facts:** none. No `generatedDate`, `generatedBy` or provider fields.
- **Provenance:** the manual origin in Phase 12's assessment provenance envelope, as a new closed member (proposed `start: { origin: "manual", by, at, reason }`) under a new `schemaVersion`. With no field `proposed`, 12's "AI proposals reviewed" readiness stays satisfied.
  - 12's parser is closed and fails safe to null [CITED: 12-RESEARCH "Write discipline": "a malformed envelope projects as null provenance"].
  - The plan that writes the member therefore extends the parser in the same task. Otherwise the header silently disappears (Pitfall 4).
- **Request:** `requestStatus: "risk-assessment-drafted"`, as generation does.
- **Stage recorder:** called. The stage is already `drafting` after answers were submitted [CITED: 21-CONTEXT D-06, D-07: "answers submitted" is a recorded act], so normally no row.
- **No run and no `aiProvenance` fields.**

**"Submitted answers with review complete."** Today's code has no stored "answer review complete" fact: draft generation gates only on `questionnaire-in-progress` with submitted answers [VERIFIED: assessment-workflow.ts:710-713]. The manual start must call the same eligibility function generation calls. If an earlier phase adds a review gate there, the manual start inherits it. It must never restate the gate.

### The availability condition (D-22)

The start is available when **(a)** or **(b)** holds, and **(c)** holds.

**(a) The policy refuses now.** Call 12-02's `evaluateAiDataPolicy` on the request's classification. It refuses with `AI_CLASSIFICATION_ABOVE_CEILING` or `AI_POLICY_NOT_CONFIGURED` [CITED: 12-02-PLAN.md exports `evaluateAiDataPolicy`, `readAiDataPolicyConfiguration`; 12-07-PLAN.md:160]. Evaluating live also covers a queued job the policy refused at run time, which creates no run.

**(b) The latest run failed or was interrupted.**
- Take the latest `CsrmAiRun` for the request with the matching `operation` (`questionnaire-generation` or `assessment-draft` [CITED: 12-01-PLAN.md:113]), ordered by `startedAt` desc, then `id` desc. Its status is `failed` or `interrupted`.
- Runs left `running` at a restart become `interrupted` at bootstrap [CITED: 12-CONTEXT D-20].
- 12's `listAiRunsForRequest` is a **test-harness helper** [CITED: 12-05-PLAN.md:111], so the plan adds a production read beside `ai-run-record.ts` (proposed `latestAiRunFor(strapi, requestId, operation)`).

**(c) Nothing is in flight, and the record is absent.**
- The questionnaire registry exposes `hasActiveJob` and `activeRequestIds` [VERIFIED: questionnaire-generation-registry.ts:32-33].
- The draft registry keys jobs by questionnaire (`const jobsByQuestionnaire = new Map<string, string>();`) and exports no active-job query [VERIFIED: assessment-draft-registry.ts:107-108]. The plan adds one.
- Also refuse while the latest run is `running`, the persistent signal.
- Re-check (c) and the record's absence inside the locked transaction.

**The gap: `CONTEXT_TOO_LARGE` creates no run.** 12 builds the context before creating the run, and "a `AssessmentContextTooLargeError` becomes `...JobFailure("CONTEXT_TOO_LARGE", safeMessage)`, no run" [CITED: 12-05-PLAN.md:110; 12-06-PLAN.md:199; 12-CONTEXT: "Anything over a hard bound fails the job before any provider call"]. Under D-22's literal wording, a request over the context bound can neither generate nor start manually. **Open Question 1.**

**Recorded reason.** The reason is a closed code that the web maps to the UI-SPEC §11.2 copy: `AI_CLASSIFICATION_ABOVE_CEILING`, `AI_POLICY_NOT_CONFIGURED`, `GENERATION_FAILED` or `GENERATION_INTERRUPTED`, plus `CONTEXT_TOO_LARGE` if Open Question 1 admits it.

**Refusal order:**
1. 404 when the record is not readable.
2. 403 for the service identity (`HUMAN_ANALYST_ONLY_OPERATIONS`).
3. `OWN_REQUEST` 403, then `REQUEST_UNASSIGNED` 409, then `NOT_ASSIGNED_ANALYST` 403 (13's order).
4. 409 `MANUAL_START_NOT_AVAILABLE` with `{ reason: "generation-allowed" | "job-running" | "record-exists" }`.

Persistence stays deep-equal on every refusal (the 12-07 pattern).

**The jobs read.** 12's `aiPolicy` block [CITED: 12-RESEARCH contract change 8] gains `manualStart: { available: boolean, reason: string | null, assignee: ActiveUserSummary | null }`. The card's three states in 22-UI-SPEC §11.1 then need no client logic.

## 5. Readiness, Store and Change-Log Mechanics Worth Knowing

- **Swap the store after commit.** `strapi.db.transaction`'s callback receives `onCommit` [VERIFIED: @strapi/database/dist/index.js:86]. A configuration write registers the in-memory store's replacement with `onCommit`, so a rolled-back write never changes the store. This is the mechanism for D-10's "replaced after each committed change".
- **Configuration and change-log writes in one transaction** use the same nesting. The stale-version check (`CONFIGURATION_CHANGED`) re-reads the row's version inside the transaction, under a row lock as 17.1's serialised acts do [CITED: 17.1-RESEARCH Pitfall 10 for PostgreSQL concurrency].
- **Query-layer `documentId`.** If any writer uses `strapi.db.query(uid).create`, Strapi's model gives `documentId` a default: `documentId: { type: 'string', default: createDocumentId }` [VERIFIED: @strapi/core/dist/utils/transform-content-types-to-models.js:311-315]. The middleware's reads use the query layer, and its writes use the document service like every CSRM writer.

## 6. The Admin Development Fixture (D-26): Consistency Confirmed

**Today:**
- `DEVELOPMENT_FIXTURE_SUBJECTS` holds `"jane.doe@idambox.com": "5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e01"` and `"bob.doe@idambox.com": "5d0f1c3a-6b1e-4c2a-9f0e-1a2b3c4d5e02"`, typed `keyof typeof DEVELOPMENT_FIXTURE_SUBJECTS` [VERIFIED: apps/backend/src/keycloak/development-fixture-subjects.ts:14-21].
- The realm has the same two users plus the service account `service-account-idambox-strapi-admin`, and no realm roles or groups.
- Each person user has `id`, `username`, `email`, `emailVerified: true`, `enabled: true`, `firstName`, `lastName`, `requiredActions: []` and one `credentials` entry `{ "type": "password", "value": "bob", "temporary": false }` [VERIFIED: idp/keycloak/import/idambox-realm.json, Bob's entry read this session].

**The proof test** iterates every map entry: `for (const [email, id] of Object.entries(DEVELOPMENT_FIXTURE_SUBJECTS)) { assert.equal(realm.users.find((user) => user.email === email)?.id, id, email); }` [VERIFIED: apps/backend/tests/keycloak-identity.unit.test.ts:278-288]. Adding the Admin to both files keeps it green. Adding it to only one fails it, by design.

**Phase sequence.** Phase 17's plan adds Riley Chen at `…5e03` [VERIFIED: 17-02-PLAN.md:35, :102]. 17.1 takes `…5e04` [CITED: 17.1-PATTERNS.md:68; 17.1 has no plans yet]. Phase 22's `…5e05` is the next free id. If 17.1's plans choose differently, the fresh plan check before execution realigns it.

**Static Keycloak checks.**
- `scripts/verify-keycloak-idp.mjs` asserts Jane and Bob individually, and that `realmRoles.some((role) => /csrm|security analyst|entitlement/i.test(role?.name ?? ''))` is false [VERIFIED: :67-79, :112-114].
- So the Admin persona's realm user must carry **no** realm role or group. The Admin role lives only in IdamBox (ADR 0004).
- Neither script counts users. They are not in any `pnpm` test script [VERIFIED: `apps/backend/package.json` `test` runs only `node --test .tmp/tests-dist/tests/*.test.js`].
- `idp/README.md`'s fixture table (lines 46-75) lists the people and their ids. The plan adds the Admin's rows there, as 17-02 does for Riley [CITED: 17-02-PLAN.md:126 "README rows"].

**Web OIDC tests.**
- `apps/csrm/src` contains no Keycloak id [VERIFIED: grep for `5d0f1c3a` in `apps/csrm/src` and `apps/csrm/e2e` found none].
- `oidc-session-adapter.test.ts` mocks `strapiGrantedCapabilities` and asserts pass-through only [VERIFIED: :274-284], so the OIDC adapter needs no change.
- What changes deliberately with D-24's capability split:
  - `capabilities` in `capability-adapter.ts:1` (`['assessment-request:create','assessment-request:read','assessment:review','risk:manage','administration:manage']`);
  - its test's list (`capability-adapter.test.ts:26`);
  - `capabilityAnchors['administration:manage']` (the four `GET:/api/v1/...` list reads) in `strapi-capabilities.ts:18-23`;
  - `strapi-capabilities.test.ts:39`;
  - the development mapping `'Security Analyst': [... 'administration:manage']` in `development-capabilities.ts:8`.
  - [VERIFIED: all read this session.]

**Development roles.**
- `developmentRoles = ['Requestor', 'Secondary Requestor', 'Security Analyst'] as const` [VERIFIED: apps/csrm/src/lib/auth/session-adapter.ts:5].
- `developmentFixtureIdentityForRole` maps them to `jane.doe@idambox.com`, `maya.requestor@idambox.com` and `bob.doe@idambox.com` [VERIFIED: development-session-adapter.ts:20-35].
- The Admin persona joins both, after 17's and 17.1's personas.
- Strapi's development identity resolves any active seeded email (`identity?.accountStatus === "active"`) [VERIFIED: csrm-development-identity.ts:41-51], so it needs no change.

**The Strapi harness** finds roles by name: `filters: { name: { $in: ["Requestor", "Security Analyst", "Security Analyst Agent"] } }` [VERIFIED: strapi-http-harness.ts:515-517]. It gains `"Admin"` and the `admin` identity. Every identity it creates now also writes a `role-assignment` row with origin `system` (§1), so change-log assertions filter by subject.

## 7. CONTEXT Open Items Not Researched Here (Planner's Pointers)

| Item | Where the planner finds what it needs |
|---|---|
| Readiness items a change can raise | 17.1-RESEARCH "Readiness requirement keys"; 18-RESEARCH (the derived-rating check); §3 above (submission readiness only) |
| Risk Type retirement as a field or its own act; whether a queued draft keeps its library | 12-CONTEXT D-09; 12-06-PLAN.md:199 (the context's `allowed.riskTypes` is built per job, so a queued job reads the library when it runs) |
| Form metadata with the lists; the request form and 20 D-22's filters | 20-RESEARCH (the suggestions read); 10's form metadata plans |
| Tests and matrix rows proving the agent's grants | 12-RESEARCH "R-08-42" (the `authorization-matrix.ts` rows); `contract-catalogue.integration.test.ts` |
| Usage reads for the Admin | 20-RESEARCH (D-24's usage reads) |
| Bounds | The CONTEXT's proposals (1 to 24 months; 1 to 99 years; reasons 1 to 500, the 06.8 and 16 parsers) stand unless the planner finds a conflict |

## Common Pitfalls

### Pitfall 1: Recursion in the middleware
**What goes wrong:** Reading the "before" state with `strapi.documents(...).findOne` re-enters the document middleware chain, and on some actions loops or doubles work.
**How to avoid:** Read through `strapi.db.query(uid)`. Only the change row's write uses the document service.

### Pitfall 2: Parsing the relation payload
**What goes wrong:** `connect`, `disconnect`, `set`, arrays of ids, `{ documentId, position }` objects: the Content Manager and the seeds use different shapes, and a parser misses one.
**How to avoid:** Diff the database before and after. A full-form panel update with nothing changed writes no row (a test proves it).

### Pitfall 3: A snapshot read through the zero-argument getter
**What goes wrong:** A round-scoped function calls `riskAppetite()` and silently follows today's store, breaking D-11 ("an appetite change during a round leaves that round under its snapshot").
**How to avoid:** One `criteriaFor` resolver, explicit arguments, and §3's static guard. The integration test changes the appetite mid-round and asserts the decision's `authority` and `reviewDate`.

### Pitfall 4: A closed parser dropping the new member
**What goes wrong:** The manual start's governance-log kind or provenance member is written, but 06.8's or 12's closed parser rejects it. Reads fail safe to an empty log or null provenance, and the "Started without AI" header disappears with no error.
**How to avoid:** Extend the parser in the same task that writes the member. Assert the analyst projection's header fields in the integration test.

### Pitfall 5: The store swapped before commit
**What goes wrong:** Replacing the in-memory value inside the transaction serves an uncommitted value, which survives a rollback.
**How to avoid:** Register the swap with `onCommit`. A test makes the change-row write fail and asserts the getter is unchanged.

### Pitfall 6: Visible on a first boot
**What goes wrong:** If a schema ships without `visible: false` and boots once, admin roles might hold write permissions until Strapi cleans them.
**How to avoid:** The flag is in the first schema version, and the registry assertion (§2) runs in the phase's integration suite. [ASSUMED: Strapi's boot-time permission cleanup would remove them anyway; not relied on.]

### Pitfall 7: Change-log noise from the harness
**What goes wrong:** Every harness identity now writes `role-assignment` rows, so a test counting "the" row finds several.
**How to avoid:** Filter by subject and area, or count the rows a write adds.

## Code Examples

### D-08's middleware skeleton (shape only; names are the planner's)
```ts
// Source: pattern of apps/backend/src/keycloak/register-idambox-user-provisioning.ts:49-89;
// request context per @strapi/core/dist/services/request-context.js
const USER_UID = "api::idambox-user.idambox-user";
const ROLE_UID = "api::role.role";

export function createRoleChangeMiddleware(strapi: Core.Strapi): DocumentMiddleware {
  return async (context, next) => {
    if (!touchesAssignments(context)) return next();           // §1 filter
    return strapi.db.transaction(async () => {
      const before = await readAssignments(strapi, context);    // strapi.db.query only
      const result = await next();
      const after = await readAssignments(strapi, context, result);
      const origin = changeOrigin(strapi.requestContext.get()?.state);
      for (const change of diffAssignments(before, after)) {    // pure, unit-tested
        await writeChange(strapi, { area: "role-assignment", ...change, ...origin });
      }
      return result;
    });
  };
}

function changeOrigin(state: Record<string, any> | undefined) {
  const strategy = state?.auth?.strategy?.name;
  if ((strategy === "admin" || strategy === "admin-token") && state?.user) {
    const u = state.user;
    const name = [u.firstname, u.lastname].filter(Boolean).join(" ").trim() || u.username || u.email;
    return { origin: "identity-platform", operator: { id: String(u.id), name, email: u.email ?? null } };
  }
  return { origin: "system", source: currentChangeSource() ?? "unattributed" };
}
```

### Hidden schema options
```json
"options": { "draftAndPublish": false },
"pluginOptions": { "content-manager": { "visible": false }, "content-type-builder": { "visible": false } }
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `strapi.service("admin::permission").actionProvider` is the accessor for the registry assertion | §2 | The test needs another accessor; the mechanism stands |
| A2 | 17.1's executive approver persona takes `…5e04` | §6 | The Admin's id shifts to the next free one; the fixture test fails until aligned |
| A3 | The Content-Type Builder's `visible: false` only hides the builder entry | §2 | None for CSRM's guarantees |
| A4 | Strapi cleans stale write permissions at boot | Pitfall 6 | Not relied on |
| A5 | The proposed names (`RoundCriteriaV1`, `criteriaFor`, `started-without-ai`, the `start` member, `latestAiRunFor`, `manualStart`) | §3, §4 | Names only; the records fix them |

## Open Questions (for the orchestrator)

1. **`CONTEXT_TOO_LARGE` and the manual start.**
   - What we know: an over-bound context fails the job with no run (12-05, 12-06), so D-22's "latest run failed or interrupted" never holds, and the policy may still allow generation.
   - What's unclear: whether "unavailable" covers it.
   - **Recommendation:** admit it. The gate builds the context as the enqueue does (no provider call) and treats `AssessmentContextTooLargeError` as available, with reason `CONTEXT_TOO_LARGE`. Otherwise the request is stuck. This is a reading of G-20, not a new choice.
2. **The questionnaire's required `title`.**
   - What we know: `title` is required, and 22-UI-SPEC §11.2's confirmation has no title field.
   - **Recommendation:** a server default from the request (for example "{request title} questionnaire"), editable afterwards through the existing questionnaire edit, with the UI-SPEC's copy unchanged. The planner fixes the exact default.
3. **"Review complete" in D-22.**
   - What we know: no stored answer-review fact exists today; draft generation gates on `questionnaire-in-progress` plus submitted answers.
   - **Recommendation:** read it as "the same eligibility generation uses", which §4 makes binding by reuse.

## Environment Availability

Step 2.6: SKIPPED. The phase adds no external tool, service or runtime. It runs on the existing Node 24, pnpm, SQLite test databases and Playwright set out in POST-DEMO-BRIEF §4, and Keycloak is never started.

## Validation Architecture

`workflow.nyquist_validation` is `true` [VERIFIED: .planning/config.json].

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Web: Vitest (jsdom, Testing Library). Strapi: `node:test`, compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one SQLite database per file. E2E: Playwright with @axe-core/playwright, `desktop` 1440 and `mobile` 375, `workers: 1` (as 17.1-VALIDATION records) |
| Config file | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` |
| Quick run command | Web: `pnpm --dir apps/csrm exec vitest run <path>`. Strapi file (dev servers stopped): `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)` |
| Full suite command | `pnpm --dir apps/csrm api:check`; `typecheck`; `lint`; `pnpm --dir apps/csrm test`; `pnpm --dir apps/backend test`; then `pnpm --dir apps/csrm test:e2e` and `git status --short` |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-07 SC1 | The Admin creates, edits, imports and retires reference data; Bob reads and exports, and every write is 403 | Strapi integration + matrix | `node --test .tmp/tests-dist/tests/administration-admin-role.integration.test.js`; `authorization-matrix.integration.test.js` (`admin` caller) | ❌ W0 (new file); matrix exists |
| ADMIN-07 SC2 | Setting writes: version, reason, parser, one transaction, swap after commit; forward-only (a band change makes a rating outstanding in submission readiness only; a mid-round appetite change leaves the round on its snapshot) | Strapi unit + integration | `configuration-settings.unit.test.js`; `configuration-store.integration.test.js`; `round-criteria.integration.test.js` | ❌ W0 |
| ADMIN-07 SC2 | Lists and the request field rule; retired Risk Type refusals | Strapi integration | `configuration-lists.integration.test.js` | ❌ W0 |
| ADMIN-07 SC2 | AI policy precedence (env bootstrap, then the Admin's value); a queued job refused after the ceiling drops | Strapi integration | `ai-data-policy-setting.integration.test.js` | ❌ W0 |
| ADMIN-07 criterion 4 | Every configuration change has who, when, old and new; the panel cannot write the settings or log (registry assertion) | Strapi integration | `configuration-change-log.integration.test.js` | ❌ W0 |
| ADMIN-07 SC4 | The permission state at every Admin URL for Bob, Jane and Maya; the Admin at analyst URLs | Vitest + Playwright | `vitest run src/features/configuration`; `test:e2e e2e/admin-configuration.spec.ts` | ❌ W0 |
| ADMIN-08 SC3 | Role holders: read, filters, review notes, export; Admin only | Strapi integration + Vitest | `role-holders.integration.test.js`; `vitest run src/features/access-review` | ❌ W0 |
| ADMIN-08 | The role-change middleware: user side, role side, disconnect, status, no-op, deletes, rollback, admin and `system` origins | Strapi unit (diff) + integration (`requestContext.run`) | `role-change-diff.unit.test.js`; `role-change-recording.integration.test.js` | ❌ W0 |
| G-20 | Manual start gates (policy, failed and interrupted runs, `CONTEXT_TOO_LARGE` if admitted, job running, record exists, the assignee rules) and records (no run, request status, governance kind or provenance member, stage recorder) | Strapi integration | `manual-start.integration.test.js` | ❌ W0 |
| D-09 | The agent is refused on every route its grants reached | Matrix | `authorization-matrix.integration.test.js` | ✅ (rows change) |
| D-26 | Fixture ids match the realm import | Strapi unit | `keycloak-identity.unit.test.js` | ✅ |
| Phase spec | SC1 to SC4 and G-20 at 1440 and 375 with axe; settings restored in teardown; clean tree | Playwright | `pnpm --dir apps/csrm test:e2e e2e/admin-configuration.spec.ts` | ❌ W0 |

### Sampling Rate
- **Per task commit:** the touched Vitest files by path; the touched Strapi files by path (dev servers stopped); `typecheck` when types change; `api:check` after any specification change.
- **Per wave merge:** the full web suite and the full Strapi suite.
- **Phase gate:** the full suite, then Playwright, then `git status --short` clean apart from the brief's operator items. Also:
  - the content-type freeze check lists exactly the approved schema files;
  - `cmp` of the two catalogue copies is silent;
  - the Keycloak diff touches only the fixture subjects, the realm import and `idp/README.md`.

### Wave 0 Gaps
Each new test file's RED task, owned by its plan:
- `apps/backend/tests/configuration-settings.unit.test.ts`
- `role-change-diff.unit.test.ts`
- `configuration-store.integration.test.ts`
- `round-criteria.integration.test.ts`
- `configuration-lists.integration.test.ts`
- `ai-data-policy-setting.integration.test.ts`
- `configuration-change-log.integration.test.ts`
- `role-holders.integration.test.ts`
- `role-change-recording.integration.test.ts`
- `manual-start.integration.test.ts`
- `administration-admin-role.integration.test.ts`
- `apps/csrm/e2e/admin-configuration.spec.ts`
- Vitest files beside each new web module

No framework install is needed.

## Security Domain

Security enforcement is enabled (the config key is absent).

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Keycloak or the development bridge; ADR 0004 |
| V4 Access Control | yes | Role → Function → FunctionAPI in Strapi; Admin-only grants; `HUMAN_ANALYST_ONLY_OPERATIONS` for the manual start; the panel's write permissions withheld for the hidden types (§2) |
| V5 Input Validation | yes | Closed versioned parsers per setting key; the reason parser; the list rules |
| V7 Logging and Audit | yes | The append-only change log written in the transaction (§1); no route writes it; the panel cannot write it |

| Threat | STRIDE | Mitigation |
|---|---|---|
| A role change made in the panel goes unrecorded | Repudiation | §1's middleware, with operator attribution and no-op suppression |
| Tampering with the log or settings through the panel | Tampering | `visible: false`, so no write permission is registered (§2) |
| A configuration change rewrites an open round's rules | Tampering | The round snapshot and explicit arguments (§3) |
| The manual start used to bypass AI governance or separation of duties | Elevation of privilege | Assignee only; human analyst only; available only when generation is refused or failed (§4) |

## Sources

### Primary (HIGH confidence, read this session)
- `@strapi/core` 5.51.0:
  - `services/request-context.js`;
  - `services/server/index.js:26`;
  - `services/auth/index.js:59-63`;
  - `services/document-service/transform/data.js:8`;
  - `services/metrics/admin-user-hash.js`;
  - `Strapi.js:84-85`;
  - `utils/transform-content-types-to-models.js:311-315`.
- `@strapi/admin` 5.51.0: `strategies/admin.js`, `strategies/admin-token.js`, `content-types/User.js` and `services/role.js:365-374`.
- `@strapi/content-manager` 5.51.0:
  - `services/data-mapper.js:23, 66`;
  - `services/permission.js:13-15`;
  - `services/document-manager.js:70-140`;
  - `services/content-types.js:17-31`;
  - `controllers/collection-types.js:239`;
  - `routes/admin.js:146`.
- `@strapi/database` 5.51.0: `dist/index.js:60-95`.
- Repository:
  - the `idambox-user`, `role`, `csrm-assessment` and `csrm-questionnaire` schemas;
  - `register-idambox-user-provisioning.ts`, `development-fixture-subjects.ts` and `keycloak-identity.unit.test.ts`;
  - `idambox-realm.json`, `verify-keycloak-idp.mjs`, the identity middlewares and `seed-csrm-data.ts`;
  - `strapi-http-harness.ts`;
  - `questionnaire-generation-workflow.ts`, `questionnaire-governance-log.ts`, `assessment-workflow.ts` and both registries;
  - the web capability, session and OIDC test files.

### Secondary (cited planning artifacts)
- 17.1-RESEARCH ("The Configuration Points", "Content-Type Shapes", "The Risk Decision", "Acceptance Rounds"); 17.1-CONTEXT D-17, D-26 to D-36, D-41 to D-43; 17.1-PATTERNS.
- 12-CONTEXT D-20 and D-22; 12-RESEARCH; the 12-01, 12-02, 12-05, 12-06 and 12-07 plans.
- 20-RESEARCH R7; 21-CONTEXT D-06 and D-07; 17.2-CONTEXT; 17-02-PLAN; 22-UI-SPEC §11 and its orchestrator amendments.

## Metadata

**Confidence breakdown:**
- Strapi mechanics (§1, §2, §5): HIGH. Read in the installed 5.51.0 code.
- Round readers (§3): MEDIUM. They are derived from 17.1's research and CONTEXT; 17.1's plans are not written.
- Manual start (§4): HIGH for today's facts; MEDIUM for 12's planned run record.
- Fixtures (§6): HIGH.

**Research date:** 2026-10-01
**Valid until:** the next `@strapi/*` upgrade, or the execution of Phases 12, 17.1 and 21, whichever comes first. A fresh plan check runs before execution.
