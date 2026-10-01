# Phase 20: Oversight registers and post-release tracking - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** 46 (grouped where they share one analog)
**Analogs found:** 43 / 46
**Economy (stage2-rules §3a):** areas an earlier phase already mapped are cited to its PATTERNS, not re-surveyed. `B/` = `apps/backend/`, `W/` = `apps/csrm/`. "First changed by" names the earlier plan (or phase) that changes the file before Phase 20; Phase 20 plans build on that planned state and Stage 3 re-checks it.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match | First changed by |
|---|---|---|---|---|---|
| `docs/contract-gaps/phase-20-treatment-tracking.md`, `phase-20-reminders-and-email.md` (+ dated amendments to the 07, 14, 16, 17, 17.1, 18, 19, 19.1 records) | doc | — | `docs/contract-gaps/phase-06.1-revert-audit-facts.md` | exact | records 14..19.1 written by those phases |
| `B/src/csrm/insights/treatment-due-state.ts` (switch) | utility (rule + SQL mirror) | transform | itself, after 11-15 / 11-17 | exact | **11-15, 11-17** |
| `B/src/csrm/treatment/risk-people.ts` (parts predicate) | utility (pure + SQL) | request-response | `assessment-participation.ts` (17-PATTERNS §`assessment-participation.ts`) | exact | Phase 17 |
| `B/src/csrm/treatment/treatment-status.ts`, `decision-review.ts` | utility | transform | `treatment-due-state.ts` | exact | 11-15 |
| `B/src/csrm/treatment/release-baseline.ts` (`withReleasedRiskMutation`, `ensureReleaseBaseline`, `overlayReleaseBaseline`) | service | CRUD (transaction) | 16-PATTERNS §`assessment-workflow.ts` guard and wrappers (16-04) | role-match | Phase 16 |
| `B/src/csrm/treatment/treatment-acts.ts` (progress, note, complete, reopen, change) | service | CRUD | 16-PATTERNS §`risk-curation.ts` (16-05) | exact | Phase 16 |
| `B/src/csrm/treatment/analyst-acts.ts` (residual review, close/reopen, control delivery) | service | CRUD | 16-PATTERNS §`risk-curation.ts`; 18-PATTERNS §`parseWritableRiskFields` | role-match | Phase 16, 18 |
| `B/src/api/csrm-risk/schema.json` (+ D-01 item 1 columns) | model | — | itself | exact | Phases 16, 17, 17.1 |
| `B/src/api/csrm-treatment-evidence/**` (schema, routes, controller, service, operations) | model + route + controller | file-I/O | `csrm-request-attachment/**` (14-PATTERNS §routes/controller/service/operations) | exact | **Phase 14** (creates the analog) |
| `B/src/api/csrm-reminder-delivery/content-types/.../schema.json` (core router `[]`) | model | batch | 19.1's `csrm-notification` schema (19.1-PATTERNS) | role-match | Phase 19.1 |
| `B/src/api/csrm-risk/routes/*.ts`, `controllers/*.ts`, `operations.ts` (owner reads, acts, close, review) | route/controller | request-response | `B/src/api/csrm-risk/routes/csrm-risk.ts` (lines 15, 32-68); 19.1-PATTERNS §`routes/notifications.ts` | exact | Phases 16, 17, 17.1, 18 |
| `B/src/api/csrm-risk/services/risk-register.ts`, `risk-register-query.ts` (type/division/BU, control, Risk Type, progress, review-state filters) | service | CRUD (read) | itself: `applyDisclosableParent` l.137, `projectRiskRegisterItem` l.262-278, filter l.342 | exact | 11-14, 11-15, Phase 18 |
| `B/src/api/csrm-assessment/services/assessment-scope.ts` (baseline overlay) | service | read | itself, `RISK_DETAIL_FIELDS` l.255 | exact | Phases 17, 17.1, 19 |
| `B/src/api/csrm-analyst-insight/services/{alert-repository,report-repository,report-definitions,dashboard-summary}.ts`, `B/src/csrm/insights/alert-rules.ts` | service | read/aggregate | themselves (consumers of the rule) | exact | **11-17** |
| `B/src/api/csrm-administration/**` (Used in, counts, suggestions) | service/controller | read | 19-PATTERNS §`administration-workflow.ts` | exact | Phase 19 |
| `B/src/api/csrm-assessment-request` review-queue and assessment lists (filters) | service | read | `review-queue-repository.ts` (19.1-PATTERNS §notification-repository cites it) | exact | Phases 11, 13 |
| `B/src/csrm/reminders/{policy,reminder-schedule,rules,keys,run,sender}.ts` | service | batch / event-driven | `B/src/bootstrap/seed-analyst-insights.ts` (clock injection) + 14-PATTERNS §`rescan-scheduler.ts` | role-match | Phase 14 |
| `B/src/csrm/email/{email-config,plugin-config,capture-provider,email-content}.ts` | config/utility | file-I/O | 14-PATTERNS §`attachment-config.ts` (14-03) and §`register-attachment-storage.ts` | role-match | **14-03** |
| `B/config/plugins.ts` (email entry) | config | — | itself (no email today) + 14-PATTERNS §`config/plugins.ts`; `config/middlewares.ts:3` import precedent | exact | **Phase 14** |
| `B/src/index.ts` (capture swap, SC5 seed, start-up run, `strapi.cron.add`, `destroy`) | config | event-driven | itself (bootstrap l.28-43) + 14-PATTERNS §`src/index.ts` | exact | Phases 14, 17, 19.1 |
| `B/src/bootstrap/seed-treatment-reminders.ts` (SC5 fixtures) | seed | batch | `B/src/bootstrap/seed-analyst-insights.ts` | exact | — |
| `B/src/csrm/history/*` (kinds, sources, null actor, `parseReleaseBaseline`) | service | append-only | 16-PATTERNS (16-02, 16-03 writer/parser) | exact | **16-02, 16-03** |
| `B/src/csrm/notifications/notification-kinds.ts` + service (system actor, explicit recipients, ids) | service | event-driven | 19.1-PATTERNS §`notification-kinds.ts`, §`notification-service.ts` | exact | **19.1-02, 19.1-03** |
| `B/src/policies/csrm-authorization.ts` | middleware | request-response | 19.1-PATTERNS §csrm-authorization; 19-PATTERNS §csrm-authorization (l.41, 278 today) | exact | Phases 14, 19, 19.1 |
| `docs/references/specification.json`, both catalogue copies, `served-operations.json` | config | — | prior phases' contract tasks (17.1/18 D-02 chain) | exact | every earlier phase |
| `B/.env.example` | config | — | 14-PATTERNS §attachment-config settings block | exact | Phase 14 |
| `B/tests/*.integration.test.ts`, `tests/fixtures/authorization-matrix.ts`, `tests/helpers/strapi-http-harness.ts` (env pins before `load()`, l.483 cron) | test | — | 14-04 harness pins (14-PATTERNS); 19.1-PATTERNS tests | exact | 14-04, Phase 19.1 |
| `W/src/features/my-risks/**` (list, cards, service, actions) | component/service | request-response | `W/src/features/risks/{risk-register.tsx,risk-service.ts,risk-actions.ts}`; 11-PATTERNS §`assessment-list.tsx` | exact | Phase 11 |
| `W/app/(app)/app/my-risks/page.tsx`, `[documentId]/page.tsx`, `loading.tsx`, `error.tsx` | route | request-response | `W/app/(app)/app/risks/{page,loading,error}.tsx`, `[documentId]` | exact | Phases 11, 18 |
| `W/src/features/treatment/**` (tracking panel, forms, change sheets, review form, history) | component | request-response | `W/src/features/risks/risk-detail-editor.tsx`, `risk-details.tsx`; 17.1/17.2 sheet patterns (17.1-PATTERNS) | role-match | Phases 17, 17.1, 18 |
| `W/src/features/treatment/evidence-*` | component/service | file-I/O | 14-PATTERNS §`attachments-service.ts`, §`attachments-actions.ts`, §`save-file.ts` | exact | **Phase 14** |
| `W/src/features/risks/*` (register columns, filters, views, post-release panel) | component | request-response | itself + 18-PATTERNS (grid, views) | exact | 11-15, Phase 18 |
| `W/src/components/csrm/status-badge.tsx`, `refusal-copy.ts` | utility | transform | 11-PATTERNS §`status-badge.tsx`; 14-PATTERNS §status-badge | exact | Phases 11, 14, 17.1 |
| `W/src/lib/navigation*` and Homes (`features/home/*`, `dashboard/requestor-dashboard.tsx`, analyst dashboard) | config/component | read | 11-PATTERNS §`navigation.ts`, §Home, §`navigation-counts.ts` | exact | Phases 11, 17.1, 19.1 |
| `W/src/features/reports/**`, `features/analyst-dashboard/**` | component | read | themselves | exact | Phase 11 |
| `W/src/features/administration/**`, `W/app/(app)/app/admin/[collection]/[documentId]` (Used in) | component | read | themselves; 19-PATTERNS administration | exact | Phase 19 |
| `W/src/features/requests/request-form.tsx` (suggestions) | component | request-response | itself (`TextField` l.56, l.207-208) | exact | Phase 14 |
| `W/next.config.ts` / `proxy.ts` (body limit gains evidence pages) | config | — | 14-PATTERNS §`next.config.ts and proxy.ts` | exact | **Phase 14** |
| `W/e2e/risk-owner-journey.spec.ts` (+ `sliceTrackTreatment`), `e2e/helpers/{journey-guards,strapi-api}.ts` | test | — | 17-RESEARCH §L / 17-PATTERNS | exact | **Phase 17** (creates), 17.1, 17.2 |
| `W/e2e/<phase-20 spec>.spec.ts`, `e2e/helpers/mail-capture.ts` | test | file-I/O | `W/e2e/analyst-insights.spec.ts` (time-relative fixtures) | role-match | — |
| `W/playwright.config.ts` (`CSRM_REMINDER_SCHEDULE: 'off'`, capture dir, `??=`) | config | — | itself l.89-101, 216 | exact | 14-04 |
| `docs/design/csrm-design-direction.md` (X-59..X-67 records), root `CONTEXT.md` glossary | doc | — | prior X-n recording tasks | exact | every earlier phase |

## Pattern Assignments (only what earlier PATTERNS do not already map)

### `B/src/csrm/insights/treatment-due-state.ts` (switch)
Today (l.14-20, 23-27, 52-68): closed `as const` vocabulary, a facts type where "every key is required", `isUtcDate(today)` guard, first-match order. Phase 20 keeps that discipline: add `not-tracked` to `TREATMENT_DUE_STATES`, add `released`, `treatmentAction`, `withdrawnAt`, `treatmentProgress`, `treatmentResolveDate` to `TreatmentFacts`, and change `deriveTreatmentDueState` and 11-15's `applyTreatmentDueStatePredicate` / `TREATMENT_DUE_DATE_COLUMN` together (RESEARCH §R5 SQL). Replace the header comment ("Nothing on the server sets it") with D-08's rule.
```ts
if (!isUtcDate(today)) throw new RangeError("today must be a YYYY-MM-DD UTC calendar date.");
if (!isTreatmentOpen(facts)) return "complete-or-closed";
if (!isPresent(targetDate)) return "no-target-date";
if (targetDate < today) return "overdue";
if (targetDate <= addUtcDays(today, windowDays)) return "due-soon";
return "later";
```
Consumers: `risk-register.ts` l.277-278 passes `{ targetDate, treatmentStatus, closureDate }` (must pass the new facts); l.342 `query.where("r.treatment_status", …)` moves to `applyTreatmentStatusPredicate` (§R6). `treatment-status.ts` and `decision-review.ts` copy this file's shape (pure function + exported SQL applier + oracle test).

### `B/src/index.ts` (bootstrap order)
Today l.28-43: seeds awaited in order, `seedDevelopmentApiToken` last. Phase 20 appends, in this order: capture-provider swap (mode `capture` only), `seedTreatmentReminders(strapi)`, `await runReminders(strapi, { now: new Date(), trigger: 'startup' })` (catch + one log line), then `strapi.cron.add({ csrmReminderRun: { task, options: { rule, tz: 'Etc/UTC' } } })` unless `off`, and a `destroy()` that awaits `sender.drain()`. Register-time readers follow l.17-25 (`readKeycloakTokenVerificationConfig` posture: invalid config stops boot).

### `B/src/bootstrap/seed-treatment-reminders.ts`
Copy `seed-analyst-insights.ts`: exported fixture constant (l.28) and day offsets (l.63), options with `now?` (l.93, l.121 `utcToday(options.now?.() ?? new Date())`), and the gate at l.326-327:
```ts
if (process.env.IDAMBOX_SEED_CSRM !== "true" || !developmentIdentityEnabled()) {
```

### `B/config/plugins.ts`
Today holds only `users-permissions` and `upload` (Phase 14 adds its upload provider). Add `email: { config: emailPluginConfig(readEmailConfig(env)) }`, always `provider: 'nodemailer'` (§R4 item 2), importing from `../src/csrm/email/plugin-config` as `config/middlewares.ts:3` imports `../src/utils/cors-allowed-origins`.

### `B/src/csrm/reminders/run.ts` and `sender.ts`
No existing scheduled writer. Clock injection from `seed-analyst-insights.ts`; scheduler shape from 14-PATTERNS §`rescan-scheduler.ts`; claim/lock/onCommit sequence from RESEARCH §R3 and §R4 item 6-7 (no codebase analog for `onConflict().ignore()`: RESEARCH is the pattern).

### Web register, treatment and my-risks
Server Component page + `risk-service.ts` (server-only typed API) + `risk-actions.ts` (Server Actions) + `*.test.ts(x)` beside each, as in `W/src/features/risks/`. Loading/error routes copy `W/app/(app)/app/risks/{loading,error}.tsx`. Forms, sheets, Undo and optimistic rollback: 17.1-PATTERNS and 18-PATTERNS (cited, not repeated).

## Shared Patterns (cited)
- **Authorisation:** API-only Functions + `HUMAN_ANALYST_ONLY_OPERATIONS` (`csrm-authorization.ts` l.41, l.278) + `SERVICE_IDENTITY_REFUSED_OPERATIONS`; 19.1-PATTERNS §csrm-authorization; matrix row per route for seven callers (17 D-75).
- **404 vs 403/409 refusal:** 17-PATTERNS (`assessment-participation.ts`), 19-PATTERNS.
- **Transactions and locks:** 16-PATTERNS (16-04 wrappers), 17.1-PATTERNS (request lock first).
- **History rows:** 16-PATTERNS (16-02/16-03).
- **Notifications:** 19.1-PATTERNS (`notify`, kind registry, eligible person).
- **Files:** 14-PATTERNS whole (storage port, scanner, event log, file transfer, body limit).
- **Saved views and grid:** 18-PATTERNS.
- **Config readers failing boot:** 14-PATTERNS §`attachment-config.ts`.
- **Status labels (G-13 one mapping):** 11-PATTERNS §`status-badge.tsx`.

## No Analog Found
| File | Role | Data Flow | Reason |
|---|---|---|---|
| `B/src/csrm/email/capture-provider.ts` | utility | file-I/O | no email provider exists; follow RESEARCH §R4 item 3 |
| `B/src/csrm/reminders/sender.ts` (CAS claim, onCommit, drain) | service | event-driven | no after-commit sender exists; RESEARCH §R4 items 6-7 |
| `W/e2e/helpers/mail-capture.ts` | test | file-I/O | no capture mailbox yet; RESEARCH Validation W0 |

## Metadata
**Analog search scope:** `apps/backend/src/{csrm,api,bootstrap,policies,index.ts}`, `apps/backend/config`, `apps/csrm/src/features`, `apps/csrm/app/(app)/app`, `apps/csrm/e2e`; PATTERNS of Phases 11, 14, 16, 17, 17.1, 18, 19, 19.1.
**Files scanned:** 14 source files, 8 earlier PATTERNS. All named analogs are git-tracked source.
