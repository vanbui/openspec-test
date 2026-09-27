# Phase 10: Existing-flow gap closure - Pattern Map

**Mapped:** 2026-09-27
**Files analyzed:** 118 (27 new source or test files, 86 modified files, 5 generated or inventory files)
**Analogs found:** 108 / 113 non-generated files (every modified file is its own analog; 22 of the 27 new files have a role-matched analog)

**Scope.** The file list comes from `10-CONTEXT.md` (D-01 to D-40, Planner's Discretion, Code Context) and `10-RESEARCH.md` (the findings sections, "Contract changes", "Recommended project structure", "E2E specs that change deliberately" and "Validation Architecture"). The UI-SPEC's component inventory (`10-UI-SPEC.md`, "CSRM shared primitives") confirms the new modules. Deferred ideas (asset owner, licensed titles, help text, column choice, job reads by id) are excluded.

**Tracked-source check.** Every analog below was confirmed with `git ls-files -- <path>` on 2026-09-27; none is a gitignored mirror. Line numbers are from the tree at `fd5866c`.

**Environment for every excerpt's commands.** Prefix Node commands with `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" &&` in Git Bash.

---

## File Classification

Paths are repository-relative. "self" means the file is modified and its own current code is the pattern; the excerpt reference points at the lines that change.

### Cross-cutting: time, guard, save status, conflict reasons, copy guard

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/lib/time/format-instant.ts` (new) | utility (zod-free) | transform | `apps/web/src/features/requests/request-domain.ts:144-155` (`formatRequestDate`) | role-match |
| `apps/web/src/lib/time/format-instant.test.ts` (new) | test | transform | `apps/web/src/features/requests/request-workflow.test.tsx` (pure-function cases) | role-match |
| `apps/web/src/lib/time/viewer-time-zone.ts` (new, server-only) | utility | request-response (cookie read) | `apps/web/src/lib/auth/development-session-adapter.ts:51-72` | exact (cookie read) |
| `apps/web/src/lib/time/time-zone-actions.ts` (new, `'use server'`) | controller (Server Action) | request-response (cookie write) | `apps/web/src/lib/auth/development-session-adapter.ts:76-88` (`setDevelopmentRole`) | exact (cookie write) |
| `apps/web/src/components/csrm/local-time.tsx` (new, client) | provider + component | event-driven (mount sync) | `apps/web/src/features/reports/report-period-control.tsx:26-33` (context provider) | role-match |
| `apps/web/src/components/csrm/navigation-guard.tsx` (new, client) | provider + hook | event-driven | `apps/web/src/features/reports/report-period-control.tsx:26-40`; `apps/web/src/components/shell/capability-navigation.tsx:38-53` (Link) | role-match |
| `apps/web/src/components/csrm/save-status.tsx` (new) | component | event-driven | `apps/web/src/features/risks/risk-details.tsx:110` (polite region) | partial |
| `apps/web/src/lib/api/conflict-reasons.ts` (new, zod-free, not server-only) | model (closed vocabulary) | transform | `apps/web/src/features/requests/request-domain.ts:1-11` (`as const` vocabularies) | role-match |
| `apps/strapi/src/csrm/conflict-reasons.ts` (new) | model | transform | `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts:26-35` (frozen `as const` kinds) | role-match |
| `apps/web/src/lib/performance/interface-copy-guard.test.ts` (new) | test (source scan) | batch | `apps/web/src/lib/performance/zod-client-boundary.test.ts` | role-match |
| `apps/web/src/components/shell/app-shell.tsx` | component (server) | request-response | self, lines 14-37 | exact |
| `apps/web/app/(app)/layout.tsx` | route layout | request-response | self, lines 8-33 | exact |
| `apps/web/app/sign-in/page.tsx` | route page | request-response | self | exact |
| `apps/web/src/components/shell/capability-navigation.tsx` | component (client) | event-driven | self, lines 38-53, 95-148 | exact |
| `apps/web/src/components/shell/wordmark.tsx` | component | event-driven | self, line 25-27 | exact |
| `apps/web/src/components/csrm/revert-audit-summary.tsx` | component (shared) | transform | self, lines 14-32 | exact |
| `apps/web/src/lib/api/transport/server-client.ts` | service (transport, server-only) | request-response | self, lines 11-16, 94-96 | exact |
| `apps/web/src/lib/api/transport/server-client.test.ts` | test | request-response | self | exact |
| `docs/design/csrm-design-direction.md` | config (design authority) | - | self, §2 Voice and §4 Forms (`**Name (CSRM extension, date).**` form) | exact |

### Analyst route gate and permission copy

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/app/(app)/app/review/requests/[documentId]/page.tsx` | route page | request-response | `apps/web/app/(app)/app/review/(analyst-dashboard)/page.tsx:25-29` | exact |
| `apps/web/app/(app)/app/review/questionnaires/[documentId]/page.tsx` | route page | request-response | same | exact |
| `apps/web/app/(app)/app/review/assessments/[documentId]/page.tsx` | route page | request-response | same | exact |
| `apps/web/src/features/assessments/analyst-route-gate.test.tsx` (new) | test | request-response | `apps/web/src/features/analyst-dashboard/analyst-dashboard.test.tsx:13-36, 509-532` | exact |
| `apps/web/src/lib/metadata/record-route-titles.test.ts` | test | request-response | self, lines 11-80 | exact |
| `apps/web/src/components/states/states.tsx` (+ `states.test.tsx`) | component | - | self, lines 119-136 | exact |
| `apps/web/src/features/questionnaires/questionnaire-review.tsx` | component (client) | request-response | self, lines 32-44 | exact |
| `apps/web/src/features/assessments/assessment-detail.tsx` | component (client) | request-response | self, lines 38-52 | exact |
| `apps/web/src/features/assessments/assessment-editor.tsx` | component (client) | CRUD | self, line 99 | exact |
| `apps/web/src/features/questionnaires/questionnaire-detail.tsx` | component (client) | request-response | self, line 33 | exact |
| `apps/web/src/features/assessments/released-assessment.tsx` | component (client) | request-response | self, line 109 | exact |
| `apps/web/src/features/risks/risk-details.tsx` | component (client) | CRUD | self, line 157 | exact |
| `apps/web/src/features/administration/administration-workspace.tsx` | component (client) | request-response | self, line 100 | exact |

### Request pages (REQ-07)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/features/requests/request-context-details.tsx` (new, zod-free) | component | transform | `apps/web/app/(app)/app/requests/[documentId]/page.tsx:36-38, 68-80` | exact |
| `apps/web/src/features/requests/request-context-details.test.tsx` (new) | test | transform | `apps/web/src/features/requests/request-hub.test.tsx` | role-match |
| `apps/web/app/(app)/app/requests/[documentId]/page.tsx` | route page | request-response | self | exact |
| `apps/web/src/features/requests/request-workflow-actions.tsx` | component (client) | CRUD | self, lines 23-62 | exact |
| `apps/web/src/features/requests/request-domain.ts` | model (zod-free) | transform | self, lines 1-20, 82-90, 144-155 | exact |
| `apps/web/src/features/requests/request-hub.tsx` | component (shared) | transform | self, lines 73-91 | exact |
| `apps/web/src/features/requests/request-form.tsx` | component (client) | CRUD | self, lines 200, 232, 241, 264-299 | exact |

### Questionnaire: Requestor side (QUES-09)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/features/questionnaires/questionnaire-workflow-rules.ts` (new, zod-free) | model (predicates) | transform | `apps/web/src/features/requests/request-domain.ts` (`canRequestorEdit`) | role-match |
| `apps/web/src/features/questionnaires/use-answer-autosave.ts` (new) | hook | event-driven | `apps/web/src/features/assessments/owner-combobox.tsx:60-83` (debounce + sequence ref) | partial |
| `apps/web/src/features/questionnaires/questionnaire-renderer.tsx` | component (client) | CRUD | self, lines 288-306, 336, 343, 366-374, 387 | exact |
| `apps/web/src/features/questionnaires/questionnaire-detail.tsx` | component (client) | request-response | self, lines 32-53, 74-78 | exact |
| `apps/web/src/features/questionnaires/questionnaire-revision-timeline.tsx` | component (shared) | transform | self, lines 9-72 | exact |
| `apps/web/src/features/questionnaires/questionnaire-actions.ts` | controller (Server Actions) | request-response | self, lines 82-122, 162-182 | exact |
| `apps/web/src/components/ui/radio-group.tsx` (+ new `radio-group.test.tsx`) | component (shadcn wrapper) | event-driven | self, lines 22-43; test analog `apps/web/src/components/csrm/segmented-control.test.tsx:15-91` | exact |
| `apps/web/src/components/csrm/segmented-control.tsx` | component | event-driven | self, lines 44-66 | exact |

### Questionnaire: governance (QUES-08)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/features/questionnaires/questionnaire-placement.ts` (new, zod-free) | utility | transform | `apps/web/src/features/questionnaires/questionnaire-domain.ts` (`orderQuestionnaire`); rules in `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-definition.ts:174-207` | role-match |
| `apps/web/src/features/questionnaires/questionnaire-governance.tsx` | component (client) | CRUD | self, lines 35-108 | exact |
| `apps/web/src/features/questionnaires/questionnaire-service.ts` | service (server-only) | request-response | self, lines 88-113, 379-394 | exact |
| `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-governance-log.ts` | service | event-driven (append-only log) | self, lines 26-60, 128-159 | exact |
| `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-governance-workflow.ts` | service | CRUD | self, lines 208-243, 278-335, 394-441 | exact |
| `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-scope.ts` | service (projection) | transform | self, lines 260-346, 386-429 | exact |
| `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-generation-workflow.ts` | service | batch (job) | self, lines 15, 27-37, 67-70 | exact |
| `apps/web/src/features/assessments/questionnaire-generation-job.tsx` | component (client) | event-driven (polling) | self, lines 47-110, 170-204 | exact |
| `docs/contract-gaps/phase-06.8-questionnaire-governance-facts.md` | config (contract record) | - | self (sections Gap … Limitation) | exact |

### Generation status (UX-06 criterion 2)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts` | route | request-response | self, lines 35-38, 61-78 | exact |
| `apps/strapi/src/api/csrm-questionnaire/operations.ts` | config | - | self, lines 15-17 | exact |
| `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts` | controller | request-response | self, lines 103-114, 340-356 | exact |
| `apps/strapi/src/api/csrm-questionnaire/services/questionnaire-generation-registry.ts` | service (process-local store) | event-driven | self, lines 13-34 | exact |
| `apps/strapi/src/api/csrm-assessment/services/assessment-draft-registry.ts` | service (process-local store) | event-driven | self, lines 107-115, 204-233 | exact |
| `apps/strapi/src/policies/csrm-authorization.ts` | middleware (policy) | request-response | self, lines 41-49 | exact |
| `docs/references/idambox-csrm-role-function-api-catalogue.json` and `apps/strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json` | config (grants) | - | `function.questionnaire_generation.job_read_api` at lines 59, 133-148, 2222-2232 | exact |
| `apps/strapi/tests/fixtures/authorization-matrix.ts` | test fixture | request-response | self, lines 176-178, 881-902 | exact |
| `apps/strapi/tests/contract-catalogue.integration.test.ts` | test | - | self, lines 172-176 | exact |
| `apps/strapi/tests/helpers/strapi-http-harness.ts` | test helper | - | self, lines 507-552, 578-588 | exact |
| `apps/strapi/tests/questionnaire-generation.integration.test.ts` | test | request-response | self | exact |
| `docs/references/served-operations.json` | generated inventory | - | regenerated by `served-operations:write` | generated |

### Assessment editing (ASSESS-06), released view (ASSESS-07)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/components/csrm/relation-picker.tsx` (new, client, zod-free) | component | request-response (debounced search) | `apps/web/src/features/assessments/owner-combobox.tsx:119-256` | exact |
| `apps/web/src/components/csrm/relation-picker.test.tsx` (new) | test | event-driven | owner-combobox cases in `apps/web/src/features/assessments/assessment-editor.test.tsx` | role-match |
| `apps/web/src/features/assessments/control-label.ts` (new, zod-free) | utility | transform | `apps/web/src/features/assessments/assessment-domain.ts` | role-match |
| `apps/web/src/features/assessments/release-readiness-summary.ts` (new, zod-free) | utility | transform | `apps/web/src/features/assessments/assessment-domain.ts` (`releaseReadinessPresentation`) | exact |
| `apps/web/src/features/assessments/released-risk-details.tsx` (new, zod-free) | component | transform | `apps/web/src/features/assessments/released-assessment.tsx:125-165` (`ReleasedRisk`) | exact |
| `apps/web/src/features/assessments/risk-editor.tsx` | component (client) | CRUD | self, lines 155-198 | exact |
| `apps/web/src/features/assessments/control-implementation-editor.tsx` | component (client) | CRUD | self, lines 119-145 | exact |
| `apps/web/src/features/assessments/assessment-editor.tsx` | component (client) | CRUD | self, lines 160, 175-341 | exact |
| `apps/web/src/features/assessments/assessment-schema.ts` | model (zod, server) | transform | self, lines 251, 279-285, 369-373, 406-416 | exact |
| `apps/web/src/features/assessments/assessment-service.ts` | service (server-only) | request-response | self, lines 114-164, 217-246 | exact |
| `apps/web/src/features/assessments/assessment-actions.ts` | controller (Server Actions) | request-response | self, lines 41-48, 121-135, 199-231 | exact |
| `apps/web/src/features/risks/risk-detail-editor.tsx`, `mitigation-control-list.tsx` | component (client) | CRUD | self, lines 186-216 and 66-213 | exact |
| `apps/web/app/(app)/app/risks/[documentId]/page.tsx` | route page | request-response | self | exact |
| `apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts` | service (projection) | transform | self, lines 310-358; precedent `apps/strapi/src/api/csrm-risk/services/risk-register.ts:165-183` | exact |
| `apps/strapi/src/api/csrm-assessment/controllers/csrm-assessment.ts` | controller | request-response | self, lines 254-295 | exact |
| `apps/strapi/src/api/csrm-control-implementation/services/control-implementation-workflow.ts` | service | CRUD | self, lines 136-155 | exact |
| `apps/strapi/src/api/csrm-risk/controllers/csrm-risk.ts` | controller | request-response | self, lines 188-207 | exact |

### Reference data (ADMIN-05) and CSV copy

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/strapi/src/api/csrm-administration/services/administration-query.ts` | service (projection) | transform | self, lines 250-266 | exact |
| `apps/web/src/features/administration/administration-schema.ts`, `administration-form.tsx`, `administration-workspace.tsx`, `administration-actions.ts` | model / component / Server Action | CRUD | self (schema line 201; form 87, 189-256; workspace 85-86, 197-204, 251; actions 96-106) | exact |
| `apps/strapi/src/bootstrap/controls/privacy-act-app-ndb-2026-06-04.json` | config (seed data) | batch | self, APP entries (APP-11 at lines 92-97) | exact |
| `apps/strapi/src/bootstrap/seed-assessment-workflow.ts` | config (seed) | batch | self, lines 14-27, 67-79 | exact |
| `apps/web/src/features/administration/csv-import-flow.tsx`, `csv-client-parser.ts`; `apps/strapi/src/api/csrm-administration/services/csv-import.ts` | component / utility / service | file-I/O | self (flow 108-196; parser 27, 164-165; Strapi 95, 229, 232) | exact |

### Contract and generated files

| File | Role | Data Flow | Pattern |
|---|---|---|---|
| `docs/references/specification.json` | config (contract) | - | components edited in place; `api:generate` then `api:check` |
| `apps/web/src/lib/api/generated/schema.d.ts` | generated | - | `pnpm --prefix apps/web api:generate`, never hand-edited |
| `apps/web/src/features/contract-response-parity.test.ts` | test (guard) | batch | self, lines 56-151 (grandfather list, count at line 683) |
| `apps/web/src/features/contract-operation-chain.test.ts` | test (guard) | batch | self, lines 47, 179-208 |

### E2E specs

| File | Changes | Analog for new steps |
|---|---|---|
| `apps/web/e2e/questionnaire-workflow.spec.ts` | UI-SPEC E1-E5 and new autosave, guard and arrow-key steps | self, lines 181-330 |
| `apps/web/e2e/questionnaire-governance-workflow.spec.ts` | E8, E9, in-viewport form, Brisbane local time | self, lines 24-31 (`expectAtBothWidths`), 108-180 |
| `apps/web/e2e/questionnaire-generation-workflow.spec.ts` | E7, add after deterministic generation, return mid-job | self, lines 58-156 (creates its own request) |
| `apps/web/e2e/requestor-request-workflow.spec.ts` | E6, in-page submit then revert, analyst request context | self, lines 196-275 |
| `apps/web/e2e/request-relationship-states.spec.ts` | E15 | self, lines 24, 114-120 |
| `apps/web/e2e/assessment-release-workflow.spec.ts` | E10-E14 and new gate, picker, save-status steps | self, lines 170-330 |
| `apps/web/e2e/risk-register-workflow.spec.ts` | E16 | self, lines 597-603 |
| `apps/web/e2e/performance.spec.ts` | E5 | self, lines 110-118 |
| `apps/web/e2e/administration-workflow.spec.ts` | owner name, columns, "5.1" once | self |

---

## Pattern Assignments

### `apps/web/app/(app)/app/review/{requests,questionnaires,assessments}/[documentId]/page.tsx` (route page, gate before read)

**Analog:** `apps/web/app/(app)/app/review/(analyst-dashboard)/page.tsx`

**Imports** (lines 3, 8-9):
```typescript
import { PermissionDeniedState } from '@/components/states/states';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
```

**Gate before any read** (lines 25-29):
```typescript
export async function AnalystDashboardContent({ searchParams }: AnalystDashboardPageProps) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  if (!can('assessment:review', granted)) return <PermissionDeniedState area={analystDashboardCopy.area} />;
```

**Current shape to change** (`review/requests/[documentId]/page.tsx:17-35`): `generateMetadata` calls `recordRouteMetadata(readRequest(...), title)`, and the content reads first, then resolves capabilities only for the links. The gate moves above `readRequest(documentId)`; the metadata returns `{ title }` without the read when the gate fails. The same capability resolution already exists in `review/questionnaires/[documentId]/page.tsx:22-35` (`analystRequestHref`), so the gate can share one small helper per page.

**Permission rendering to reuse** (the route's own states, not the shared one): `AssessmentDetail state="permission"` (`assessment-detail.tsx:38-52`), `QuestionnaireReview state="permission"` (`questionnaire-review.tsx:34-36`), `AssessmentEditor state="permission"` (`assessment-editor.tsx:99`).

**Test pattern** (`apps/web/src/features/analyst-dashboard/analyst-dashboard.test.tsx:13-36` and `509-523`): hoisted `mocks` with `current` and `granted`, `vi.mock('@/lib/auth/development-session-adapter', () => ({ getSessionAdapter: () => ({ current: mocks.current, capabilitiesFor: () => ({ granted: mocks.granted }) }) }))`, then assert the service mock `not.toHaveBeenCalled()` and the alert text. `record-route-titles.test.ts:11-40` mocks the three services but no session adapter; once the routes gate, that file needs the same session mock (granted with `assessment:review` for its existing cases).

---

### `apps/web/src/lib/time/*` and `apps/web/src/components/csrm/local-time.tsx` (viewer time zone, D-19)

**Cookie read analog** (`apps/web/src/lib/auth/development-session-adapter.ts:51-54, 67-68`):
```typescript
async function requestUsesHttps(): Promise<boolean> {
  const forwardedProtocol = (await headers()).get('x-forwarded-proto');
  return forwardedProtocol?.split(',')[0]?.trim() === 'https';
}
…
    const value = (await cookies()).get(cookieName)?.value;
```

**Cookie write analog** (lines 76-88):
```typescript
  async setDevelopmentRole(role: DevelopmentRole): Promise<void> {
    assertDevelopmentRuntime();
    const secure = await requestUsesHttps();
    (await cookies()).set(cookieName, role, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
  }
```
Copy the `secure` rule exactly (the E2E origin is plain HTTP on 127.0.0.1, so an unconditional `secure: true` cookie would never be sent back). Next 16.3: `cookies()` is async; `.set` works only in a Server Function or Route Handler (`apps/web/node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`).

**Formatter analog to replace** (`apps/web/src/features/requests/request-domain.ts:144-155`):
```typescript
export function formatRequestDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}
```
The same UTC pattern with a time of day is in `questionnaire-revision-timeline.tsx:18-22` and `revert-audit-summary.tsx:14-21`; `released-assessment.tsx:35` uses `dateStyle: 'long'`. `formatRequestDate` also formats calendar dates (`dueDate`) and the Requestor dashboard labels, which stay UTC (D-19 "calendar dates stay zone-free"; dashboards are Phase 11).

**Context provider analog** (`apps/web/src/features/reports/report-period-control.tsx:26-33`, React 19 `<Context value>` form):
```typescript
const ReportTransitionContext = createContext<ReportTransition | null>(null);

/** Shares one navigation transition between the header's period control and the report body. */
export function ReportTransitionProvider({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  const transition = useMemo(() => ({ pending, startTransition }), [pending, startTransition]);
  return <ReportTransitionContext value={transition}>{children}</ReportTransitionContext>;
}
```

**Where the provider mounts** (`apps/web/src/components/shell/app-shell.tsx:14-37` is a Server Component; `apps/web/app/(app)/layout.tsx:8-33` is `force-dynamic` and renders `AppShell` in both branches). The layout reads the cookie and passes the zone to `AppShell`, which wraps its content in the client provider. `RevertAuditSummary` and `RequestHub` are also rendered by the Server Component page `app/(app)/app/requests/[documentId]/page.tsx:61, 79`, so they render a client `LocalInstant` rather than calling a hook.

---

### `apps/web/src/components/csrm/navigation-guard.tsx` (D-12)

**Link pattern to guard** (`apps/web/src/components/shell/capability-navigation.tsx:38-53`):
```typescript
  const renderLink = (item: NavigationItem) => {
    const Icon = item.icon;
    return (
      <Link aria-current={item.href === activeHref ? 'page' : undefined} className="nav-link" href={item.href} key={item.href} onClick={onNavigate}>
```
The component's own `onNavigate` prop (line 22) is an `onClick` that closes the mobile sheet (`MobileNavigation`, lines 95-148); Next's `Link` `onNavigate` is a different prop. Other in-app links the questionnaire page shows: `Wordmark` (`wordmark.tsx:25-27`) and the `RecordLink` "Assessment request {number}" in `questionnaire-detail.tsx:55-72` (`record-link.tsx:9-11` wraps `Link`).

**Framework pattern:** `apps/web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`, "Blocking navigation": `onNavigate={(e) => { if (isBlocked && !confirm(...)) e.preventDefault() }}` with a React context. CSRM replaces `window.confirm` with `ConfirmDialog` in controlled mode and calls `router.push(href)` on confirm (`apps/web/src/components/csrm/confirm-dialog.tsx`).

---

### `apps/web/src/components/csrm/relation-picker.tsx` (D-28, X-2)

**Analog:** `apps/web/src/features/assessments/owner-combobox.tsx`

**Imports and debounce** (lines 1-6, 24):
```typescript
'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import type { ActiveUser } from './assessment-schema';
…
const debounceMs = 300;
```
The schema import is type-only, so the client bundle carries no zod (`zod-client-boundary.test.ts:74-82` treats `import type` as erased). The new picker must follow the same rule: it is rendered on `/app/review/assessments/{documentId}` and `/app/risks/{documentId}`, both in the zod-free route list (`zod-client-boundary.test.ts:113-125`).

**Stale-response guard** (lines 137-151):
```typescript
  const search = useCallback(async (searchTerm: string) => {
    const request = ++sequence.current;
    setIsLoading(true); setError(null); setActiveIndex(-1);
    const result = await searchOwners({ search: searchTerm });
    if (request !== sequence.current) return;
```

**Keyboard contract** (lines 199-225): ArrowDown/ArrowUp move the active option; Enter chooses the active option or the first result and never submits the form; Tab closes; Escape clears. **Listbox** (lines 228-250) with `role="listbox"`, `role="option"`, `aria-selected`, `onMouseDown={(event) => event.preventDefault()}`. **Selected line** (line 253): `Selected owner: {value.displayName}` with a `Clear` button named `Clear {label}`.

The multi-select sibling (`RelationMultiSelect`, lines 36-117) shows the relation result type the request selector actions already return: `{ ok: true; data: readonly { documentId: string; name: string }[] } | { ok: false; formError: string }` (`request-actions.ts:55-75`).

**Search sources the picker calls:**
- systems and assets: `searchInformationSystemsAction`, `searchInformationAssetsAction` (`apps/web/src/features/requests/request-actions.ts:69-75`), a 25-row selector page (`request-service.ts:121`), labels for selected ids through `hydrate…Selections` (`request-service.ts`, POST `…/selected`, at most 100 ids);
- controls: `listAdministrationControls(query)` (`apps/web/src/features/administration/administration-service.ts:186-192`), where `q` matches number, name and framework server-side (`apps/strapi/src/api/csrm-administration/services/administration-config.ts` `searchColumns`), page sizes 10, 25, 50 or 100 (`administration-schema.ts:227`).

---

### `apps/web/src/components/ui/radio-group.tsx` and `segmented-control.tsx` (D-14)

**Wrapper to change** (`radio-group.tsx:22-43`): `RadioGroupItem` spreads `...props` onto `RadioGroupPrimitive.Item`; the fix adds an `onKeyDown` that calls the caller's handler first, then handles unmodified arrow keys with `preventDefault()`, `focus()` and `click()` on the next enabled `[role="radio"]` in the closest `[role="radiogroup"]`, wrapping. `segmented-control.tsx:54-64` renders `RadioGroupPrimitive.Item` directly and needs the same handler.

**Test analog** (`apps/web/src/components/csrm/segmented-control.test.tsx:55-76`): today it holds the key (`'{ArrowRight>}'` … `'{/ArrowRight}'`) to work around the race; the new wrapper test uses `user.keyboard('{ArrowDown}')` without holding, which fails before the fix. The harness at lines 15-33 (a controlled component between two buttons) and the single-tab-stop case at lines 78-91 are the patterns to copy.

---

### `apps/web/src/features/requests/request-context-details.tsx` (D-20)

**Analog:** `apps/web/app/(app)/app/requests/[documentId]/page.tsx`

```typescript
function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="grid gap-1"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="text-sm text-foreground">{value || 'Not provided'}</dd></div>;
}
…
        <DetailSection description="The business context submitted with this request." title="Request context">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DetailItem label="Description" value={request.description} />
            …
            <DetailItem label="Third-party involvement" value={request.thirdPartyInvolvement ? 'Yes' : 'No'} />
            <DetailItem label="Third-party details" value={request.thirdPartyDetails} />
            <DetailItem label="Regulatory requirements" value={request.regulatoryRequirements} />
            <DetailItem label="Updated" value={formatRequestDate(request.updatedAt)} />
          </dl>
          <RevertAuditSummary className="mt-6" facts={request} />
        </DetailSection>
```
(lines 36-38, 68-80). The analyst hub's narrower copy is `assessment-detail.tsx:80-83`. The group order follows the request form (`request-form.tsx:203-233`). The component takes `CsrmAssessmentRequest` (`request-domain.ts`, zod-free) and must stay zod-free: both routes are in the zod-free list.

---

### `apps/web/src/features/requests/request-domain.ts`, `apps/web/src/features/questionnaires/questionnaire-workflow-rules.ts` (D-22 predicates)

**Analog:** zod-free vocabulary and predicates in `request-domain.ts:1-20` and `assessment-domain.ts:1-40` (the only schema import is `import type`, line 1 of `assessment-domain.ts`).

**Served facts to read** (never the legacy nullable fields): `RequestRelationUnavailable = { availability: 'unavailable' }`, `RequestRelationAbsent = { availability: 'absent' }` (`request-domain.ts:82-90`); the questionnaire summary's `assessmentRequest` relationship carries `requestStatus` (`questionnaire-domain.ts:156-167`). The bug to remove: `request-workflow-actions.tsx:37` (`status === 'submitted' && !request.questionnaire && !request.assessment`) and `assessment-detail.tsx:78` (`request.relationships?.assessment.availability !== 'available'`). `questionnaire-domain.ts` imports zod (line 156), so new questionnaire predicates go in a new zod-free module.

---

### `apps/web/src/features/questionnaires/questionnaire-placement.ts` (D-05)

**Rules to mirror** (Strapi `questionnaire-definition.ts:174-207`, as quoted in research): one section key per section order, identical metadata per key, a unique `${section.key}:${order}`, across removed questions too. **Web input today:** the question list parser drops removed questions before validating (`questionnaire-service.ts:88-109`, filter on `options.deleted`). **Server output:** `projectQuestions` (`questionnaire-scope.ts:408-429`) serves every question, removed ones with their stored `options` (`schemaVersion: 2` and `deleted: { deletedAt, deletedBy }`, written at `questionnaire-governance-workflow.ts:463`) and a top-level `deleted`. Neither `deleted` nor `schemaVersion: 2` is declared in `QuestionnaireQuestion`/`QuestionnaireQuestionOptions` (`schemaVersion` is `const: 1`), so a placement parser must accept them as optional and never require them. The draft to replace: `blankQuestion` (`questionnaire-governance.tsx:36`) with `sectionKey: 'general'` and `sectionOrder: 0`.

---

### `apps/web/src/features/questionnaires/use-answer-autosave.ts` (D-11)

**Partial analog:** the debounce-with-sequence pattern in `owner-combobox.tsx:153-168`:
```typescript
  useEffect(() => {
    const trimmed = query.trim();
    ++sequence.current;
    …
    const timer = window.setTimeout(() => { void search(trimmed); }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [query, search]);
```
**Save path to reuse:** `saveQuestionnaireDraftAction` (`questionnaire-actions.ts:162-171`), which revalidates the current questionnaire page at line 169 through `revalidateQuestionnairePages(…, false)` (lines 98-104). The autosave variant omits the current-page revalidation (Next 16.3 `revalidatePath.md`: "Updates the UI immediately (if viewing the affected path)"). No existing hook combines a debounce, a single in-flight save, one queued follow-up and a failure state; see "No Analog Found".

---

### `apps/web/src/lib/api/conflict-reasons.ts`, `apps/strapi/src/csrm/conflict-reasons.ts` and the transport (D-22 reasons)

**Strapi helpers that gain `details`:**
- `apps/strapi/src/api/csrm-assessment-request/controllers/csrm-assessment-request.ts:49-53`:
```typescript
function denyConflict(ctx: ErrorContext, message: string): unknown {
  if (ctx.conflict) return ctx.conflict(message);
  ctx.status = 409;
  return { data: null, error: { status: 409, name: "ConflictError", message } };
}
```
- `apps/strapi/src/api/csrm-questionnaire/controllers/csrm-questionnaire.ts:103-114`:
```typescript
function safeError(ctx: RecordValue, status: 400 | 403 | 404 | 409, message: string): unknown {
  const responder = status === 400 ? ctx.badRequest : status === 403 ? ctx.forbidden : status === 404 ? ctx.notFound : ctx.conflict;
  if (typeof responder === "function") return responder.call(ctx, message);
  ctx.status = status;
  return { data: null, error: { status, message } };
}
```
Strapi 5.51 keeps the second argument as `details` (`@strapi/core/dist/services/server/koa.js:19-25`, `errors.js:52-64`, verified in research).

**Throw sites** (research "Conflict reason vocabulary"): `request-workflow.ts:104-105` (split into two); `questionnaire-workflow.ts:102, 107, 122, 131, 251, 278-279, 348-349`; `questionnaire-governance-workflow.ts:210, 218, 223, 227, 241, 272, 289, 292, 299, 322, 369, 397, 445, 455, 458, 461, 544, 551`; `questionnaire-generation-workflow.ts:67`.

**Frozen vocabulary analog** (`questionnaire-governance-log.ts:26-35`):
```typescript
export const GOVERNANCE_EVENT_KINDS = Object.freeze([
  "released",
  …
] as const);
export type GovernanceEventKind = (typeof GOVERNANCE_EVENT_KINDS)[number];
```

**Transport today** (`apps/web/src/lib/api/transport/server-client.ts:11-16, 94-96`):
```typescript
export type TransportError = { message: string; status?: number; kind?: 'response-contract-mismatch'; operation?: string };
…
export function normalizeTransportError(error: unknown, status?: number): TransportResult<never> {
  return { data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', ...(status ? { status } : {}) } };
}
```
Every service already hands the openapi-fetch `error` body to it (`assessment-service.ts:226`, `questionnaire-service.ts:172-174`, `request-service.ts:52-54` for non-403 statuses), so parsing `error.error.details.reason` here covers every service. The transport directory must stay server-only (`server-only-boundary.test.ts:29-37`), so the shared vocabulary lives at `src/lib/api/conflict-reasons.ts`, outside it.

**Action copy mapping analogs:** `request-actions.ts:23-37` (`serviceFailure(status)`), `questionnaire-actions.ts:82-96` (`serviceFailure(values, status)`) and `116-122` (`governanceFailure(status, release)`), `assessment-actions.ts:121-135`.

---

### Contract parsers and the parity guard (every API change)

**Registration analog** (`apps/web/src/features/assessments/assessment-service.ts:114-164`):
```typescript
export const contractResponseParsers: readonly ContractResponseParser[] = [
  { label: 'listAssessmentRequests', component: 'AssessmentRequestQueueResponse', parser: requestQueueResponseSchema },
  { label: 'getAssessmentDraftJob', component: 'AssessmentDraftJobResponse', parser: jobResponseSchema },
  { label: 'getQuestionnaireGenerationJob', component: 'QuestionnaireGenerationJobResponse', parser: questionnaireGenerationJobResponseSchema,
    narrowedPaths: ['data.startedAt', 'data.completedAt', 'data.failureCode', 'data.failureMessage', 'data.questionnaire'] },
  …
  { label: 'listAssessmentRisks', component: 'RiskListResponse', parser: riskListResponseSchema },
  { label: 'listControlImplementations', component: 'ControlImplementationListResponse', parser: controlImplementationListResponseSchema },
  { label: 'listRiskTypes', component: 'RiskTypeListResponse', parser: riskTypeListResponseSchema },
  { label: 'listControls', component: 'ControlListResponse', parser: controlListResponseSchema },
```
**Guard rules** (`contract-response-parity.test.ts:56-151, 683`): 43 grandfathered labels, keyed by label; a Phase 7 or later parser is never grandfathered; the count assertion is `expect(Object.keys(boundaryGrandfathered).length).toBe(43)`. Labels grandfathered today that Phase 10 touches: `getQuestionnaireGenerationJob`, `getAssessmentDraftJob`, `listAssessmentRisks`, `listControlImplementations`, `listRiskTypes`, `listControls` and the `administration.*` labels. A wholly new parser (new label) passes all five modes by declaring bounds in the spec or registering `narrowedPaths` with a reason.

**Questionnaire registry** (`questionnaire-service.ts:379-394`) and its closed enums at lines 29 (timeline kinds), 49 (revision) and 110-113 (`governanceEventSchema`).

**Chain guard** (`contract-operation-chain.test.ts:47, 179-208`): every `.GET(`/`.POST(` call site must equal the inventory's `webCallers`, which `served-operations:write` computes from the web tree (`apps/strapi/tests/served-operations.integration.test.ts:260, 404-487`). The web call must exist before the inventory is regenerated.

---

### New route `GET /v1/assessment_requests/{requestId}/generation_jobs` (D-25)

**Route analog** (`apps/strapi/src/api/csrm-questionnaire/routes/csrm-questionnaire.ts:35-38, 61-72`):
```typescript
const generationPolicies = (operation: string, requestScope = false) => [
  "global::csrm-app-enabled",
  { name: "global::csrm-authorization", config: { operation, ...(requestScope ? { requireRequestOwnership: true } : {}) } },
];
…
    { method: "POST", path: "/v1/assessment_requests/:requestId/generate_questionnaire",
      handler: "api::csrm-questionnaire.csrm-questionnaire.generateQuestionnaire",
      config: { policies: generationPolicies(CSRM_QUESTIONNAIRE_OPERATIONS.generate, true) } },
```
`requireRequestOwnership` passes an explicit analyst operation without an owner check (`csrm-authorization.ts:398-419`, `if (explicitAnalystOperation) return true;`) and refuses everyone else.

**Operation constant** (`operations.ts:15-17`): `generate: "POST:/api/v1/assessment_requests/{requestId}/generate_questionnaire"`.

**Human-analyst guard** (`csrm-authorization.ts:41-49`): add the literal to `HUMAN_ANALYST_ONLY_OPERATIONS`, as the governance URLs are listed.

**Handler analog** (`csrm-questionnaire.ts:351-352`, `getGenerationJob`): `routeId(ctx, "jobId")`, the `ctx.state.idamboxUser` identity check returning 403, then the workflow call, with `QuestionnaireGenerationWorkflowError`/`QuestionnaireGenerationRegistryError` mapped through `safeError`.

**Registry analogs:** `questionnaire-generation-registry.ts:16` (`activeByRequest`), `:23` (`get` with `cleanup()` and `authorize`), `:30-33` (`hasActiveJob`, `activeRequestIds`, the returned object); `assessment-draft-registry.ts:107-108` (`jobsByQuestionnaire`), `:204-211` (`get`), `:233` (return). Retention: `terminalTtlMs` 3,600,000 and `maxTerminal` 500 (`questionnaire-generation-registry.ts:15`). The workflow's actor is `{ documentId, canReadAllQuestionnaireGenerationJobs: false }` (`questionnaire-generation-workflow.ts:15`).

**Catalogue analog** (both copies, byte-identical; `docs/references/idambox-csrm-role-function-api-catalogue.json:133-148, 2222-2232`):
```json
{ "id": "function.questionnaire_generation.job_read_api", "name": "Questionnaire Generation Job Read API",
  "description": "Human analyst-only job status grant. This API-only Function intentionally has no menuPath.",
  "roleIds": ["role.security_analyst"], "functionApiIds": ["function.questionnaire_generation.job_read_api.api.01"],
  "sourceEntities": ["CsrmAssessmentRequest", "CsrmQuestionnaire"] }
{ "id": "function.questionnaire_generation.job_read_api.api.01", "name": "Get Questionnaire Generation Job",
  "description": "Returns an initiating analyst's retained questionnaire generation job.",
  "url": "GET:/api/v1/questionnaire_generation_jobs/{jobId}", "functionId": "function.questionnaire_generation.job_read_api", … }
```
The role's function list (line 59) names each Function id.

**Matrix analog** (`apps/strapi/tests/fixtures/authorization-matrix.ts:176-178, 891-896`):
```typescript
function humanAnalystOnly(status: number): MatrixExpectation {
  return { owner: 403, other: 403, analyst: status, serviceAgent: 403, noIdentity: 403 };
}
…
  { operation: "GET:/api/v1/questionnaire_generation_jobs/{jobId}", family: "questionnaires",
    request: () => ({ path: "/api/v1/questionnaire_generation_jobs/matrix-unknown-job" }),
    // The analyst alone reaches the job read, which answers an unknown job with 404 and no enumeration.
    expect: humanAnalystOnly(404) },
```

**Catalogue test analog** (`contract-catalogue.integration.test.ts:172-176`): the `questionnaireGenerationRoutes` array of `{ method, path, operationId, functionId }` checked for byte-identical copies and human-only effective grants.

**Harness:** identities at `strapi-http-harness.ts:507-552` (`testIdentities.set(…)`) and the returned `identities`/`users` at `578-588`. There is one human analyst (Bob); a second human analyst for the `canRetry: false` proof is created the way `inactiveAnalyst` is (line 535), with an active status. `withHeldQuestionnaireGeneration(requestDocumentId, action)` (declared at lines 360-365) holds a job active while an assertion runs.

---

### Released view projections (D-34) and the applicable-control summary (D-31)

**Precedent for a control summary** (`apps/strapi/src/api/csrm-risk/services/risk-register.ts:165-183`):
```typescript
function projectControlImplementation(document: RecordValue): RecordValue {
  if (typeof document.documentId !== "string" || !isRecord(document.control)
    || typeof document.control.documentId !== "string" || typeof document.control.controlNumber !== "string"
    || typeof document.control.name !== "string") detailUnavailable();
  return { documentId: document.documentId,
    control: { documentId: document.control.documentId, controlNumber: document.control.controlNumber, name: document.control.name },
    controlOwner: projectDetailUser(document.controlOwner), …
```
**Projections to change** (`apps/strapi/src/api/csrm-assessment/services/assessment-scope.ts`): `projectRiskSummary` (310-318, five fields, also the mutation response: leave it), `projectRiskTypeSummary` (320-326), `projectControlSummary` (328-338, no `framework`), `projectControlImplementationSummary` (344-358, `control` is the id). The create and update responses use their own `projectControlImplementationSummary` in `control-implementation-workflow.ts:136-155`, so both must populate `control`. The Requestor list read is `listAssessmentRisks` in `csrm-assessment.ts:254-271` (released-for-owner or 404).

---

### Administration owner name (D-37)

**Projection to extend** (`apps/strapi/src/api/csrm-administration/services/administration-query.ts:250-266`):
```typescript
  if (kind === "information-systems") {
    const owner = isRecord(input.owner) ? input.owner.documentId : input.owner;
    if (owner !== null && owner !== undefined && typeof owner !== "string") throw new AdministrationValidationError("CSRM Administration record is invalid.");
    …
    return { ...result, systemType: …, owner: typeof owner === "string" ? owner : null, …
```
The repository already populates `owner`. Web seeding to fix: `administration-form.tsx:87` (`{ documentId: initialValues.owner, displayName: initialValues.owner }`).

---

### Seed content (D-36 content)

**Risk Type descriptions** (`apps/strapi/src/bootstrap/seed-assessment-workflow.ts:14-27`):
```typescript
export const ASSESSMENT_RISK_TYPE_SEEDS: Readonly<Record<DeterministicAssessmentRiskTypeName, RiskTypeSeed>> = {
  "Internet Exposure": {
    description: "Reusable deterministic draft mapping for internet-reachable and externally hosted services.",
    controlNumbers: ["E8-PATCH_APPLICATIONS-003", "V3.1.1"],
  },
```
Reconciled on every seeded start (lines 67-79, `riskTypeService.update({ documentId, data })`). `assessment-seed.integration.test.ts:145` reads the export.

**APP titles** (`privacy-act-app-ndb-2026-06-04.json`, APP-11 at lines 92-97): `"title": "security of personal"` with `"legalText": "information 11.1 If an APP entity …"`. The seeded control name is `${control.id} — ${label}` (`apps/strapi/src/bootstrap/seed-csrm-data.ts:225-236`), which the D-36 display rule strips.

---

### E2E journeys that create their own records

**Analog:** `apps/web/e2e/questionnaire-generation-workflow.spec.ts:58-100` (signs in as the Requestor at 375, creates and submits a uniquely titled request, signs in as the Security Analyst, generates with the deterministic provider). **Sign-in helper** (`apps/web/e2e/helpers/navigation.ts:12-19`) asserts the level-one `Dashboard` heading and the role in the banner, never the URL. **Width helper** (`questionnaire-governance-workflow.spec.ts:24-31`, `expectAtBothWidths`).

---

## Shared Patterns

### Authorization stays in Strapi; the web gates presentation only
**Source:** `apps/web/app/(app)/app/review/(analyst-dashboard)/page.tsx:21-29` (comment and gate); `apps/strapi/src/policies/csrm-authorization.ts:271-282` (exact grant, then the human-analyst set).
**Apply to:** the three analyst detail routes, the jobs read, every new search action (they call existing authorised operations; the web never widens a grant).

### Closed parsers, bounded contract, one plan per server and client change
**Source:** `contract-response-parity.test.ts:56-151` and `assessment-service.ts:114-164`.
**Apply to:** the seven API changes. The spec edit, `pnpm --prefix apps/web api:generate`, the parser and its registration, and the Strapi projection change in the same plan (D-02, the 06.9 lesson). `api:check` is `pnpm api:generate && git diff --exit-code -- src/lib/api/generated/schema.d.ts` (`apps/web/package.json`), so the regenerated file is committed with the spec.

### Zod stays out of client modules on zod-free routes
**Source:** `apps/web/src/lib/performance/zod-client-boundary.test.ts:113-125` (routes) and `74-82` (type-only imports are erased).
**Apply to:** every new client module: `local-time.tsx`, `navigation-guard.tsx`, `save-status.tsx`, `relation-picker.tsx`, `request-context-details.tsx`, `released-risk-details.tsx`, `control-label.ts`, `release-readiness-summary.ts`, `questionnaire-workflow-rules.ts`, `questionnaire-placement.ts`, `use-answer-autosave.ts`, `src/lib/api/conflict-reasons.ts`, `src/lib/time/format-instant.ts`.

### Server-only modules
**Source:** `apps/web/src/lib/security/server-only-boundary.test.ts:29-37` (transport, auth, gates and every `*-service.ts` start with `import 'server-only'`).
**Apply to:** `src/lib/time/viewer-time-zone.ts` (reads the cookie; add `import 'server-only'` although the guard does not enumerate `lib/time`), and any new service function (it lives in an existing `*-service.ts`).

### Server Action results
**Source:** `apps/web/src/features/assessments/assessment-actions.ts:41-48`:
```typescript
export type AssessmentServerActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; values?: Record<string, unknown>; fieldErrors?: Record<string, string[]>; formError: string };
```
**Apply to:** the new search, jobs-read, autosave and time-zone actions. Validate input with a strict schema in the action (`assessment-actions.ts:50-86`), never trust the client.

### Strapi 409 envelope
**Source:** `csrm-assessment-request.ts:49-53`, `csrm-questionnaire.ts:103-114` (and `csrm-assessment.ts` `safeError`, which no Phase 10 conflict uses).
**Apply to:** every conflict that gains a reason: pass `{ reason }` as `details`, keep the message, and keep the fallback body shape `{ data: null, error: { status, name, message, details } }`.

### Tests that mock the session
**Source:** `apps/web/src/features/analyst-dashboard/analyst-dashboard.test.tsx:13-36`.
**Apply to:** the gate tests and `record-route-titles.test.ts`.

### Strapi mounted proofs
**Source:** `apps/strapi/tests/questionnaire-generation.integration.test.ts` and `strapi-http-harness.ts`. Quick run of one file (dev servers stopped): `export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm --filter @csrm/strapi exec tsc -p tests/tsconfig.json --pretty false && cd apps/strapi && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js`.

### Web quick run
`export PATH="/c/ProgramData/nvm/v24.19.0:$PATH" && pnpm --filter @csrm/web exec vitest run <path> [<path> …]` with paths relative to `apps/web`. A pattern after `--` is ignored by vitest and runs the whole suite (`08-VALIDATION.md`). On Windows, rerun a file alone after `EPERM: rename` before treating it as a failure.

---

## No Analog Found

Files with no close match in the codebase; the planner uses RESEARCH.md patterns and the Next 16.3 bundled docs instead.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/features/questionnaires/use-answer-autosave.ts` | hook | event-driven | No existing hook combines a debounce, a single in-flight save, one queued follow-up, a blur flush and a failure state. The combobox debounce is the nearest idiom (partial) |
| `apps/web/src/components/csrm/navigation-guard.tsx` | provider | event-driven | The product has never blocked navigation. The pattern is Next 16.3 `link.md` "Blocking navigation" plus the existing `ConfirmDialog` |
| `apps/web/src/lib/performance/interface-copy-guard.test.ts` | test | batch | The zod boundary guard walks imports; this guard reads string literals and JSX text with the TypeScript compiler API (`typescript` 5.9.3 is a web devDependency), which no current test does |
| `apps/web/src/lib/api/conflict-reasons.ts` and `apps/strapi/src/csrm/conflict-reasons.ts` | model | transform | No shared error vocabulary exists; the frozen `as const` event kinds are the style analog only |
| `apps/web/src/lib/time/viewer-time-zone.ts` with `local-time.tsx` | utility + provider | request-response | No viewer preference is stored today; the session cookie code is the mechanical analog (cookie read and write), and `preventing-flash-before-hydration.md` "When to use other approaches" is the framework source |

## Metadata

**Analog search scope:** `apps/web/app`, `apps/web/src/{components,features,lib}`, `apps/web/e2e`, `apps/strapi/src/{api,bootstrap,csrm,policies}`, `apps/strapi/tests`, `docs/references`, `docs/contract-gaps`, `docs/design`.
**Files scanned:** about 160 (every file named in CONTEXT and RESEARCH, their tests, and the analogs above).
**Pattern extraction date:** 2026-09-27
