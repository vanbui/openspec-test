# Phase 11: Navigation, landing and list clarity - Pattern Map

**Mapped:** 2026-10-01
**Files analyzed:** ~95 (about 20 new source or test files, about 70 modified, 5 generated or inventory files)
**Analogs found:** every modified file is its own analog; 18 of the 20 new files have a role-matched analog; 2 have none (quick find dialog, quick find trigger: use RESEARCH Pattern 6 and UI-SPEC §3, §4)

**Scope.** The file list comes from `11-CONTEXT.md` (D-01 to D-58, Code Context), `11-RESEARCH.md` ("Contract changes" C1 to C6, "Where Phase 10 touches the same files", "Recommended Project Structure", "E2E and copy assertions that change", "Proposed plan grouping") and `11-UI-SPEC.md` (component inventory, §1 to §11). Deferred ideas are excluded.

**Written ahead of Phase 10.** Phase 10 (23 plans, not yet built) changes many of the same files. The **P10** column names the Phase 10 plan(s) whose `files_modified` frontmatter lists the file. A Phase 11 plan touching a P10-marked file builds on the Phase 10 plan's planned state (and reads its SUMMARY once executed), never today's lines. Line numbers below are today's tree (`1398aaa`) and will drift where P10 is set.

**Tracked-source check.** Every analog named was confirmed with `git ls-files` on 2026-10-01; none is a gitignored mirror.

---

## Phase 10 overlap (build on the planned state)

| File | Phase 10 plan(s) that change it | What Phase 10 adds that Phase 11 relies on |
|---|---|---|
| `apps/csrm/src/components/shell/app-shell.tsx` | 10-01, 10-08 | `TimeZoneProvider`/`ViewerTimeZoneSync`; `NavigationGuardProvider` wrapping content |
| `apps/csrm/app/(app)/layout.tsx` | 10-01 | `readViewerTimeZone` cookie read |
| `apps/csrm/src/components/shell/capability-navigation.tsx` | 10-08 | `Link onNavigate` -> `guard.guardLink(...)`; internal `onNavigated` prop; sheet closes only when not blocking |
| `apps/csrm/src/components/shell/wordmark.tsx` | 10-08 | `GuardedLink` |
| `apps/csrm/src/components/csrm/navigation-guard.tsx` (new in P10) | 10-08 | `NavigationGuardProvider`, `useNavigationGuard` (`{ blocking, guardLink(event, { href, trigger, onLeave }) }`), `useLeaveGuard`, `GuardedLink`. Phase 11 adds a programmatic `navigate(href, { trigger, onLeave })` (D-51) |
| `apps/csrm/src/components/csrm/local-time.tsx`, `apps/csrm/src/lib/time/format-instant.ts` (new in P10) | 10-01 | `LocalInstant`, `formatInstant` (D-55 surfaces) |
| `apps/csrm/src/components/csrm/confirm-dialog.tsx` | 10-08 | controlled `open`/`onOpenChange` (leave warning over quick find) |
| `docs/design/csrm-design-direction.md` | 10-01 | X-1 to X-5 recorded; Phase 11 appends X-6 to X-10 (plan 11-01) |
| `apps/csrm/src/components/states/states.tsx` (+ `states.test.tsx`) | 10-02 | permission description copy that §2.4 rewrites |
| `apps/csrm/src/features/risks/risk-details.tsx` | 10-02, 10-20, 10-21 | permission state; §2.2/§2.4 copy |
| `apps/csrm/src/features/assessments/assessment-detail.tsx` | 10-02, 10-04, 10-12, 10-14 | analyst gate; hub copy; `nextActionOverride` (feed the compact stepper, D-28) |
| `apps/csrm/src/features/assessments/released-assessment.tsx` | 10-02, 10-15 | detail instants via `LocalInstant`; list column still UTC (Phase 11 moves it) |
| `apps/csrm/src/features/requests/request-hub.tsx` (+ test) | 10-04, 10-14 | copy and dates; `nextActionOverride` |
| `apps/csrm/src/features/requests/request-domain.ts` | 10-04, 10-12 | predicates; Phase 11 changes `approved` label and lifecycle types |
| `apps/csrm/app/(app)/app/requests/[documentId]/page.tsx` | 10-04 | page order stepper -> hub |
| `apps/csrm/app/(app)/app/review/requests/[documentId]/page.tsx` | 10-02, 10-12, 10-14 | gate; generation job override |
| `apps/csrm/src/features/assessments/assessment-schema.ts` | 10-13, 10-15, 10-18, 10-20 | schemas C1/C2 extend |
| `apps/csrm/src/features/assessments/assessment-service.ts` | 10-13, 10-15 | C1/C2 params |
| `apps/csrm/src/features/assessments/assessment-service.test.ts` | 10-18 | |
| `apps/csrm/src/features/risks/risk-schema.ts` | 10-18 | C3 and picker labels |
| `apps/csrm/src/features/questionnaires/questionnaire-service.ts` | 10-09, 10-10, 10-11 | quick find calls its list function |
| `apps/csrm/src/features/contract-response-parity.test.ts` | 10-09, 10-15 | new parsers registered |
| `apps/csrm/src/lib/performance/interface-copy-guard.test.ts` (new in P10) | 10-02 creates; 10-04, 10-05, 10-07, 10-08, 10-09, 10-14, 10-15, 10-17, 10-18, 10-19, 10-21 extend | Phase 11 adds dashboard, report, Risk register, navigation files and drops Phase 11 exclusions (D-54) |
| `docs/references/specification.json`, `apps/csrm/src/lib/api/generated/schema.d.ts` | 10-06, 10-10, 10-11, 10-13, 10-15, 10-16, 10-18 | C1 to C6 append |
| `docs/references/idambox-csrm-role-function-api-catalogue.json`, `apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | 10-13 | design note 9 (C6) |
| `docs/references/served-operations.json` | 10-13 | C6 moves `GET:/api/v1/my_requests` to served |
| `apps/backend/tests/fixtures/authorization-matrix.ts`, `apps/backend/tests/contract-catalogue.integration.test.ts` | 10-13 | new matrix row (C6) |
| `apps/backend/src/policies/csrm-authorization.ts` | 10-13 | Phase 11 only reads `requireRequestCollectionScope` (no change expected) |
| `apps/backend/src/api/csrm-assessment/services/assessment-scope.ts` | 10-15, 10-18 | C2 keys, predicates, projection |
| `apps/backend/src/api/csrm-assessment/controllers/csrm-assessment.ts` | 10-15 | C2 grouped aggregate |
| `apps/backend/tests/assessment-workflow.integration.test.ts` | 10-15, 10-18 | C2 proofs |
| `apps/backend/tests/request-workflow.integration.test.ts` | 10-06 | C5 assertion `:327-328` |
| `apps/backend/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts` | 10-06 | only if C5 touches the controller |
| `apps/csrm/src/features/questionnaires/questionnaire-detail.tsx` | 10-02, 10-05, 10-08 | §2.3 copy only |
| `apps/csrm/src/features/questionnaires/questionnaire-review.tsx` | 10-02, 10-05, 10-09 | §2.3 gate copy |
| `apps/csrm/src/features/assessments/assessment-editor.tsx` | 10-02, 10-15, 10-18 to 10-21 | §2.3 gate copy |
| `apps/csrm/src/features/administration/administration-workspace.tsx` | 10-02, 10-16, 10-17 | recovery copy only |
| E2E: `questionnaire-workflow.spec.ts` | 10-02, 10-03, 10-05, 10-08, 10-09 | nav labels/headings (11-03) |
| E2E: `assessment-release-workflow.spec.ts` | 10-02, 10-05, 10-15, 10-18, 10-20, 10-21, 10-22 | nav labels, headings, tiles |
| E2E: `requestor-request-workflow.spec.ts`, `request-relationship-states.spec.ts` | 10-04 | labels; `/^Next action:/` at 375px (11-06/11-07) |
| E2E: `questionnaire-governance-workflow.spec.ts` | 10-01, 10-09, 10-10 | stepper heading, Next action |
| E2E: `questionnaire-generation-workflow.spec.ts` | 10-09, 10-12, 10-14 | labels |
| E2E: `administration-workflow.spec.ts` | 10-16, 10-17, 10-22 | "Administration" group -> "Reference data" |
| E2E: `risk-register-workflow.spec.ts` | 10-19 | heading, description (D-54) |
| E2E: `performance.spec.ts` | 10-05 | route lists, `/app/review`, prefetch record |

**Phase-11-only files** (no Phase 10 plan lists them): `navigation.ts`, `request-lifecycle-stepper.tsx`, `status-badge.tsx`, `request-table.tsx`, `request-service.ts`, `request-schema.ts`, `features/dashboard/*`, `features/analyst-dashboard/*`, `features/reports/*`, `risk-register*.tsx`, `risk-service.ts`, `risk-actions.ts`, `risk-domain.ts`, `next.config.ts`, `app/(app)/app/page.tsx` and its loading/error, the `(analyst-dashboard)` group, all Strapi files of C1, C3 to C6 except those listed above, `e2e/helpers/navigation.ts`, `accessibility`, `analyst-insights`, `production-hardening`, `design-contract`, `design-system-conformance`, `app-shell` specs, root `CONTEXT.md`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match | P10 | Plan |
|---|---|---|---|---|---|---|
| `apps/csrm/src/config/navigation/navigation.ts` | config | transform | self `:23-72` | exact | - | 11-03 |
| `apps/csrm/src/config/navigation/page-headings.ts` (new) | config | transform | `navigation.ts:54-72` (const data) | role | - | 11-03 |
| `apps/csrm/src/components/shell/capability-navigation.tsx` | component (client) | event-driven | self `:29-66`, `:95-148` | exact | 10-08 | 11-03, 11-10 |
| `apps/csrm/src/components/shell/navigation-counts.ts` (new, server-only) | service composer | request-response (fan-out) | `analyst-dashboard-service.ts:153-193` (`settled` + `Promise.all`) | role | - | 11-10 |
| `apps/csrm/src/components/shell/app-shell.tsx` | component (server) | request-response | self `:17-41` | exact | 10-01, 10-08 | 11-03, 11-10, 11-14 |
| `apps/csrm/app/(app)/layout.tsx` | route layout | request-response | self `:9-37` | exact | 10-01 | 11-10 |
| `apps/csrm/next.config.ts` | config | request-response | self `:42-44` (`headers()`) | exact | - | 11-02 |
| `apps/csrm/app/(app)/app/page.tsx` | route page | request-response | `app/(app)/app/review/(analyst-dashboard)/page.tsx:26-61` | exact | - | 11-02, 11-09 |
| `apps/csrm/app/(app)/app/loading.tsx`, `error.tsx` | route boundary | - | `(analyst-dashboard)/loading.tsx`, `error.tsx` | exact | - | 11-02 |
| `apps/csrm/app/(app)/app/review/(analyst-dashboard)/*` (deleted) | - | - | - | - | - | 11-02 |
| `apps/csrm/src/features/home/analyst-home.tsx` (new) | component | request-response | `(analyst-dashboard)/page.tsx:26-50` (`AnalystDashboardContent`) | exact (move) | - | 11-02 |
| `apps/csrm/src/features/home/requestor-home.tsx` (new) | component | request-response | `features/dashboard/requestor-dashboard.tsx` | role | - | 11-09 |
| `apps/csrm/src/features/home/home-page-header.tsx` (new) | component | - | `features/analyst-dashboard/analyst-dashboard-page-header.tsx` | exact | - | 11-02 |
| `apps/csrm/src/features/home/own-requests-panel.tsx` (new) | component | request-response | analyst dashboard widget frame (`analyst-dashboard.tsx` `DashboardWidget`) | role | - | 11-09 |
| `apps/csrm/src/features/dashboard/requestor-dashboard-service.ts` | service | request-response | self `:154-171` | exact | - | 11-09 |
| `apps/csrm/src/features/analyst-dashboard/*` (presentation, schema, component, tests) | presentation/model | transform | self | exact | - | 11-02, 11-12, 11-13 |
| `apps/csrm/src/lib/testing/e2e-ui-state.ts` | utility | - | self `:31-43` | exact | - | 11-09 |
| `apps/csrm/src/lib/testing/e2e-ui-state-route-authorization.test.tsx` | test | - | self `:52,100,126,172` | exact | - | 11-02 |
| `apps/csrm/src/lib/testing/e2e-sign-in-assertions.test.ts`, `apps/csrm/e2e/helpers/navigation.ts` | test | - | self (`:17`) | exact | - | 11-02 |
| `apps/csrm/src/features/requests/request-lifecycle-stepper.tsx` | component | transform | self `:32-64` | exact | - | 11-07 |
| `apps/csrm/src/features/requests/request-hub.tsx` | component | transform | self (P10 state) | exact | 10-04, 10-14 | 11-06, 11-07 |
| `apps/csrm/src/features/requests/request-domain.ts` | model (zod-free) | transform | self `:20-31` | exact | 10-04, 10-12 | 11-01, 11-06, 11-08 |
| `apps/csrm/src/components/csrm/status-badge.tsx` | component | transform | self `:66-74` (assessment family already says Released `:77-80`) | exact | - | 11-01 |
| `apps/csrm/src/features/requests/request-service.ts` | service | request-response | self `:108-119` (`getMyRequestStatusSummary`) | exact | - | 11-08 |
| `apps/csrm/src/features/requests/request-schema.ts` | model (zod) | transform | self (`myRequestStatusSummaryResponseSchema`) | exact | - | 11-06, 11-08 |
| `apps/csrm/src/features/requests/request-table.tsx`, `app/(app)/app/requests/page.tsx` | component, page | CRUD (list) | `assessment-list.tsx:102-129` (DataTable columns) | role | - | 11-08 |
| `apps/csrm/src/features/assessments/assessment-list.tsx` | component | CRUD (list) | self `:28-35`, `:102-155` | exact | - | 11-04, 11-05 |
| `apps/csrm/src/features/assessments/assessment-schema.ts`, `assessment-service.ts` | model, service | request-response | self | exact | 10-13, 10-15, 10-18, 10-20 | 11-04, 11-05 |
| `apps/csrm/src/features/assessments/released-assessment.tsx` | component | CRUD (list) | self `:35-57` | exact | 10-02, 10-15 | 11-05 |
| `apps/csrm/src/features/risks/risk-actions.ts`, `risk-service.ts`, `risk-schema.ts` | Server Action, service, model | request-response | `risk-actions.ts:61-83` | exact | 10-18 (`risk-schema.ts`) | 11-05, 11-11 |
| `apps/csrm/src/features/risks/risk-domain.ts`, `risk-register-filters.tsx`, `risk-register.tsx`, `app/(app)/app/risks/page.tsx` | model, component | CRUD (list) | self | exact | - | 11-11 |
| `apps/csrm/src/features/reports/report-presentation.ts`, `report-table.tsx`, `report-schema.ts`, `report-copy.json`, `*-report.tsx` | presentation | transform | `report-presentation.ts:25,112-125` | exact | - | 11-12, 11-13 |
| `apps/csrm/src/components/csrm/bar-chart.tsx` | component | transform | self | exact | - | 11-12 |
| `apps/csrm/src/components/states/states.tsx`, `app/(app)/not-found.tsx`, `app/not-found.tsx`, `review/requests/error.tsx` | component | - | self (`states.tsx:53-54,108,132`) | exact | 10-02 (`states.tsx`) | 11-02 |
| `apps/csrm/src/features/quick-find/quick-find-actions.ts` (new, `'use server'`) | Server Action | request-response (fan-out) | `risk-actions.ts:61-83` + `analyst-dashboard-service.ts:153-160` | role | - | 11-14 |
| `apps/csrm/src/features/quick-find/quick-find-domain.ts` (new, zod-free) | model | transform | `request-domain.ts:20-31` | role | - | 11-14 |
| `apps/csrm/src/features/quick-find/quick-find-dialog.tsx` (new, client) | component | event-driven | none in use; `components/ui/command.tsx` (wrapper, unused) + `capability-navigation.tsx:78-93` (Radix dialog) | partial | - | 11-14 |
| `apps/csrm/src/components/shell/quick-find-trigger.tsx` (new, client) | component | event-driven | `capability-navigation.tsx:95-148` (`MobileNavigation` trigger, focus restore) | partial | - | 11-14 |
| `apps/csrm/src/components/csrm/navigation-guard.tsx` | provider | event-driven | P10 10-08 contract | exact | 10-08 | 11-14 |
| `apps/backend/src/api/csrm-assessment-request/routes/my-requests.ts` (new) | route | request-response | `routes/my-request-status-summary.ts:1-31` | exact | - | 11-08 |
| `apps/backend/src/api/csrm-assessment-request/controllers/my-requests.ts` (new) | controller | request-response | `controllers/my-request-status-summary.ts:1-45` | exact | - | 11-08 |
| `apps/backend/src/api/csrm-assessment-request/services/my-requests.ts` (new) | service (SQL) | CRUD (list) | `services/request-status-summary.ts:68-80` + `review-queue-repository.ts:72-160` | exact | - | 11-08 |
| `apps/backend/src/api/csrm-assessment-request/services/request-status-summary.ts` | service | aggregate | self | exact | - | 11-08 |
| `apps/backend/src/api/csrm-assessment-request/services/review-queue-repository.ts` | repository | CRUD (list) | self `:72-160` | exact | - | 11-04, 11-08 |
| `apps/backend/src/api/csrm-assessment-request/services/collection-scope.ts` | service | transform | self `:45-71,228,336-344` | exact | - | 11-04 |
| `apps/backend/src/api/csrm-assessment-request/services/request-lifecycle.ts` | service | transform | self `:41-77` | exact | - | 11-06 |
| `apps/backend/src/api/csrm-assessment-request/operations.ts` | config | - | self (`myRequestStatusSummary`) | exact | - | 11-08 |
| `apps/backend/src/api/csrm-risk/services/risk-register.ts`, `risk-register-query.ts` | repository, parser | CRUD (list) | `risk-register.ts:130-164` | exact | - | 11-11 |
| `apps/backend/src/api/csrm-analyst-insight/services/dashboard-summary.ts`, `report-repository.ts`, `report-definitions.ts`; `apps/backend/src/csrm/insights/insight-constants.ts` | service | aggregate | self | exact | - | 11-12 |
| `apps/backend/src/bootstrap/seed-analyst-insights.ts` | seed | batch | self `:184-297` | exact | - | 11-12 |
| `apps/backend/tests/my-requests.integration.test.ts` (new) | test | - | `tests/request-status-summary.integration.test.ts`, `review-queue-buckets.integration.test.ts` | exact | - | 11-08 |
| root `CONTEXT.md` | doc | - | self `:7-11` | exact | - | 11-01 (shared file: orchestrator) |

---

## Pattern Assignments

### `navigation.ts` (config) and `capability-navigation.tsx` (client)

**Analog:** self. Today: one flat list with `group?: NavigationGroup` (`navigation.ts:27-30,54-72`); keep `activeNavigationHref` unchanged (`:40-52`) and feed it every profile item including collapsed ones (RESEARCH Pattern 1).

Render loop to replace with sections (`capability-navigation.tsx:29-65`):
```tsx
const visible = items.filter((item) => can(item.capability, granted));
const activeHref = activeNavigationHref(pathname, visible);
...
<div aria-label={group} className="mt-4 space-y-1 border-t border-sidebar-border pt-3" key={group} role="group">
  <p className="micro-label px-3 text-sidebar-muted">{group}</p>
  {groupItems.map(renderLink)}
</div>
```
Keep the section markup (role group, `micro-label`, `border-sidebar-border`) and the 10-08 guarded `renderLink` (`onClick` records trigger, `onNavigate` -> `guard.guardLink`, `onNavigated` closes sheet only when not blocking). `MobileNavigation` (`:95-148`) renders the same component; keep `Close navigation` first. Badge: `use(countsPromise)` under `<Suspense fallback={null}>` (RESEARCH Pattern 2); name via visible text + `sr-only`, never `aria-label` (UI-SPEC §1.3).

### `app/(app)/app/page.tsx` (Home) and `features/home/analyst-home.tsx`

**Analog:** `app/(app)/app/review/(analyst-dashboard)/page.tsx`. Capability check before any read, fixtures only after real reads (`:26-50`):
```tsx
const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
if (!can('assessment:review', granted)) return <PermissionDeniedState area={analystDashboardCopy.area} />;
const state = await getAnalystDashboard();
if (state.kind !== 'ready') return <AnalystDashboard state={state} />;
const params = await searchParams;
const fixtureState = resolveE2eUiState(params);
```
Page shape (`:52-61`): header outside, `<Suspense fallback={<AnalystDashboardSkeleton />}>` around content. Home decides the variant **before** the Suspense so each skeleton matches (RESEARCH Pattern 3). Today's `/app/page.tsx:20-49` (Requestor fixture ladder, `resolveE2eDashboardPartial`) is the Requestor variant's fixture analog; replace `'draft-requests-error'` (`e2e-ui-state.ts:31-33`) with a new Requestor partial selector.

### `next.config.ts` (redirect)

**Analog:** self `:42-44`:
```ts
async headers() { return [{ source: '/(.*)', headers: securityHeaders }]; },
```
Add sibling `async redirects() { return [{ source: '/app/review', destination: '/app', permanent: false }]; }` (307, literal source only).

### `navigation-counts.ts` (server-only) and `quick-find-actions.ts` (Server Action)

**Analog for fan-out:** `analyst-dashboard-service.ts:153-160`:
```ts
const [summary, alertSummary, treatments, dueSoon, topAlerts] = await Promise.all([
  getDashboardSummary(),
  settled(() => getAlertSummary()),
  settled(() => listAlerts({ kinds: [...treatmentAlertKinds], page: 1, pageSize: DASHBOARD_ALERT_PAGE_SIZE })),
```
Each read settles independently; a failure or 403 maps to "no badge" / a failed group. Call **existing** service functions only (`getMyRequestStatusSummary`, questionnaire summary, alert summary, a new one-row `listAssessmentRequests` in `assessment-service.ts`) so `served-operations.json` `webCallers` stay put.

**Analog for action input:** `risk-actions.ts:61-75`:
```ts
const relationSearchSchema = z.object({ kind: z.enum([...]), search: z.string().trim().min(1).max(100) }).strict();
export async function searchRiskRegisterRelationsAction(input: unknown): Promise<RiskRelationSearchResult> {
  const parsed = relationSearchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, formError: '...' };
```
Quick find: `min(2).max(100)`; return display fields and hrefs only. The same file's lines `76-83` (client-side `includes` over first 25) are the bug D-32 removes: pass `q` to `listRiskRegisterAssessments` instead.

### `quick-find-dialog.tsx` and `quick-find-trigger.tsx` (no in-use analog)

Use `components/ui/command.tsx` primitives (`Command`, `CommandInput :63-80`, `CommandList`, `CommandGroup`, `CommandItem`) but **not** `CommandDialog` (`:32-61`: title renders outside `DialogContent`, defaults "Command Palette", client filtering on). Compose `Dialog`/`DialogContent showCloseButton={false}`/`DialogTitle` inside content; `shouldFilter={false}`, `vimBindings={false}`. Trigger focus-restore pattern: `MobileNavigation` `triggerRef` + `window.setTimeout(() => triggerRef.current?.focus(), 0)` (`capability-navigation.tsx:96-114`). Lazy load with `next/dynamic`. Follow RESEARCH Pattern 6 and Pitfalls 15 to 19.

### `request-lifecycle-stepper.tsx` (compact variant)

**Analog:** self `:32-64`. Keep heading `Current lifecycle state: {label}` (`:36-38`) and the `ol` (`:39`); below 768px render `Step {n} of {m}`, the next action (holder-aware, P10 override fed through from `assessment-detail.tsx`), and a `button aria-expanded aria-controls` revealing the `ol`. Comment `:26-31` records why next action was moved to the hub; UI-SPEC §6 supersedes for phone only.

### `status-badge.tsx` and `request-domain.ts` (Released label)

`status-badge.tsx:72` `approved: { icon: CircleCheckIcon, label: 'Approved', tone: 'success' }` -> `'Released'`; `request-domain.ts:29` `approved: { label: 'Approved', order: 5 }` -> `'Released'`. Precedent in the same file: the assessment family already labels `approved` as `Released` (`status-badge.tsx:77-80`). Both maps change in one plan (Pitfall 13). Keep each a `satisfies Record<RequestStatus, ...>` map so 17.1's "Closed" extends it (G-13).

### `request-domain.ts` lifecycle type (C5)

`:20` `RequestLifecycleNextAction = { actor: 'requestor' | 'analyst' | 'none'; summary: string; href?: string }` gains `holder`. Server side `request-lifecycle.ts:41-62`: replace `waiting = "The work is waiting with the other party."` with holder-naming strings per UI-SPEC §6.1, return `{ actor, holder, summary, href? }` (`:62`). Holder per step: RESEARCH "Home" findings (requestor: draft, questionnaire-released; none: released/closed; else analyst).

### `assessment-list.tsx` (C1, C2 columns)

**Analog:** self `:102-129`:
```tsx
const requestColumns: DataTableColumn<AssessmentRequestQueueItem>[] = [
  { accessorKey: 'requestNumber', header: 'Request', numeric: 'identity',
    cell: (_value, request) => (<RecordLink href={requestHref(request.documentId)}>{request.requestNumber}</RecordLink>) },
  ...
  { accessorKey: 'submittedDate', header: 'Submitted', cell: (_value, request) => formatDate(request.submittedDate) },
];
```
Replace `formatDate` (`:31-35`, `timeZone: 'UTC'`) with `<LocalInstant style="date" value={...} fallback="Not recorded" />` (P10 10-01). Add Requestor, Assessment type, Business criticality (not `RiskRatingBadge`), Due date, Age from server `daysSinceSubmission`. Search sends `filters[q]` (today `filters[title]`, `assessment-service.ts:333`).

### `request-service.ts` `listMyRequests` (C6 web)

**Analog:** self `:108-119`:
```ts
export async function getMyRequestStatusSummary(): Promise<TransportResult<readonly RequestStatusCount[]>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await client.GET('/v1/my_requests/status_summary');
    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parseMyRequestStatusSummaryPayload(data), error: null };
  } catch (error) { return normalizeFailure(error); }
}
```
Register the new parser in the parity list as `:268` does: `{ label: 'request.getMyRequestStatusSummary', component: 'MyRequestStatusSummaryResponse', parser: ... }`.

### Strapi `routes/my-requests.ts` and `controllers/my-requests.ts` (C6)

**Route analog:** `routes/my-request-status-summary.ts:10-29` (own router, same policy):
```ts
{ method: "GET", path: "/v1/my_requests/status_summary",
  handler: "api::csrm-assessment-request.my-request-status-summary.statusSummary",
  config: { auth: { strategies: ["content-api-token"] },
    policies: ["global::csrm-app-enabled",
      { name: "global::csrm-authorization", config: { operation: myRequestStatusSummary, requireRequestCollectionScope: true } }] } }
```
**Controller analog:** `controllers/my-request-status-summary.ts:20-44`: `safeError`, `ownRequestorId(ctx.state)` (403 when not `"own"`), query refusal. My requests replaces "any key refused" with a closed key set (`q`, `status`, `holder`, `sort`, `page`, `pageSize`), as `assessment-scope.ts:101-120` `assertCollectionKeys` + `collectionInteger` do.

### Strapi `services/my-requests.ts` (holder SQL)

Owner join (`request-status-summary.ts:68-78`):
```ts
connection.queryBuilder()
  .from("csrm_assessment_requests as r")
  .join("csrm_assessment_requests_requestor_lnk as o", "o.csrm_assessment_request_id", "r.id")
  .where("o.idambox_user_id", requestorId)
```
Holder facts: **export, do not copy** `questionnaireReleased`, `questionnaireSubmitted`, `assessmentExists`, `assessmentReleased` from `review-queue-repository.ts:72-118`; requestor branch = `awaiting-requestor` (`:145-150`) plus drafts. Hydrate/project with `projectRequestLifecycle` (`request-lifecycle.ts:65-77`). `byHolder` in `request-status-summary.ts` reuses the same predicate (fold like `projectMyRequestStatusSummary`, `:86-103`).

### Strapi `review-queue-repository.ts` / `collection-scope.ts` (C1)

`applyBucket` (`:125-160`): add `case "all": return;` like `"released"`, with the status set = reviewable + released (`collection-scope.ts:45-52`). `q` = `(number LIKE OR title LIKE)` replacing the ANDed pair (`:174-186`); add `"q"` to `safeReviewFilters` (`collection-scope.ts:228`) and projection fields (`:336-344`, `REVIEW_QUEUE_ITEM_FIELDS :39`).

### Strapi `risk-register.ts` (C3, C4 stage split)

**Analog:** `applyDisclosableParent` `:136-164`, with the two branches `mutable` (`:143-150`) and `released` (`:151-158`). Extract them as `applyUnderAssessmentParent` and `applyReleasedParent`; keep `applyDisclosableParent` as the union so alerts (`alert-repository.ts:235,248`) are untouched. Exposure: `openReleased.where('r.treatment_action','Accept')` for accepted (RESEARCH Pattern 5). `dueState` mirrors `deriveTreatmentDueState` (`treatment-due-state.ts:54-69`) in one shared place so Phase 20 switches `targetDate` -> `treatmentResolveDate` once (G-16).

### Strapi `assessment-scope.ts` (C2; P10 10-15, 10-18)

`:115-118` predicate list:
```ts
...(q ? [{ $or: [{ assessmentNumber: { $containsi: q } }, { summary: { $containsi: q } }] }] : []),
```
Add `{ assessmentRequest: { title: { $containsi: q } } }`, `overallRating`, `approvedFrom/To`. Risk count and highest residual: one grouped knex aggregate in the controller over the page's ids (Pitfall 9).

### Reports / analyst dashboard figure links

**Analog:** `report-presentation.ts:115-125`:
```ts
{ key: 'critical-residual', caption: 'Critical residual', value: report.byResidualRating.Critical, href: '/app/risks?residualRating=Critical&state=open' },
...
// No list has the report's due window, so these tiles are plain.
{ key: 'due-within-window', caption: dueWithinWindowLabel(report.dueWindowDays), value: report.dueState.dueWithinWindow },
```
Every figure gets an `href` built here, never in JSX; `ReportTableRow` (`:25`) gains optional cell hrefs (UI-SPEC X-10). Remove "contextual" captions (D-54).

---

## Shared Patterns

### Capability gate before any read
**Source:** `(analyst-dashboard)/page.tsx:27-30`. **Apply to:** Home, quick find action, navigation counts (capability decides which reads to ask; Strapi authorises).

### Typed service + closed parser + parity registration
**Source:** `request-service.ts:108-119,268`. **Apply to:** every C1 to C6 web change. Never `createStrapiClient` from new modules (quick find, counts).

### Fail-soft parallel reads
**Source:** `analyst-dashboard-service.ts:153-193` (`settled`, 403 -> permission). **Apply to:** counts (no badge), quick find groups, Home sections.

### Guarded E2E fixtures after real reads
**Source:** `(analyst-dashboard)/page.tsx:32-49`; `e2e-ui-state.ts:22-42`. **Apply to:** both Home variants.

### Owner scope from policy
**Source:** `controllers/my-request-status-summary.ts:28-33` + route policy `requireRequestCollectionScope`. **Apply to:** `GET /v1/my_requests`; integration tests per actor (analyst's own list reads Requestor side).

### Local time
**Source:** P10 10-01 `LocalInstant`. **Apply to:** queue Submitted, My requests Updated, Requestor Home, Recent activity (`analyst-dashboard-presentation.ts:36`), released list (`released-assessment.tsx:35-57`), `formatRequestDate` (`request-domain.ts:144-155`).

### Guarded navigation
**Source:** P10 10-08 `guardLink` / `GuardedLink`. **Apply to:** every sidebar item, Requestor primary action, wordmark, quick find results (new programmatic entry).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `features/quick-find/quick-find-dialog.tsx` | component | event-driven | `Command` wrapper is unused; no combobox-in-dialog exists. Use RESEARCH Pattern 6, Pitfalls 15-19, UI-SPEC §4 |
| `components/shell/quick-find-trigger.tsx` | component | event-driven | No global keyboard shortcut exists. Use UI-SPEC §3 and Pitfalls 18-19 |

## Shared-file notes for the planner
- Root `CONTEXT.md` (`:11` "request-status label `Approved` ... unchanged") and `docs/design/csrm-design-direction.md` (X-6 to X-10) are shared files under stage-2 rules: plan tasks for executors, flagged to the orchestrator.

## Metadata
**Analog search scope:** `apps/csrm/{app,src}`, `apps/backend/src/api/{csrm-assessment-request,csrm-assessment,csrm-risk,csrm-analyst-insight}`, Phase 10 plan frontmatter (23 plans).
**Pattern extraction date:** 2026-10-01
