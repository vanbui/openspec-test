---
schema_version: 1
open_count: 7
waived_count: 0
fixed_count: 3
total_count: 10
last_updated: 2026-10-13T13:28:50.254Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 06.3 | unrun-verify | apps/strapi/tests/questionnaire-workflow.integration.test.ts |  | Mounted Strapi integration suite did not complete. Cause was not the Node version: better-sqlite3's native binary was still built for Node 22, and once rebuilt the suite deadlocked because Node 24 runs `node --test` files more concurrently than Node 22 did. Resolved by rebuilding the addon and running the suite one file at a time; 144/144 on Node 24. | fixed |  | 2026-09-08T00:16:39.918Z | 2026-09-08T06:48:41.912Z |
| 2 | 06.4 | unrun-verify | apps/web/e2e/requestor-request-workflow.spec.ts; apps/web/e2e/questionnaire-workflow.spec.ts |  | Playwright workflow verification was not run because that execution excluded browser-suite execution. Run afterwards: 23 of 23 pass, after fixing a detail-URL capture that matched the create route, a list-row locator that required an explicit role attribute, an overflow assertion measured through a transient toast, and a genuine layout defect where a 500-character reversal reason scrolled the page sideways. | fixed |  | 2026-09-08T00:00:00.000Z | 2026-09-09T00:53:40.446Z |
| 3 | 06.5 | unrun-verify | apps/web/e2e/design-system-conformance.spec.ts |  | Isolated Playwright conformance run did not return after Strapi startup in this host. Run afterwards: 3 of 3 pass, with app-shell 7/7 as the environment control. The stall was not environmental. Eight defects in the spec itself were fixed: normalize() called inside page.evaluate but defined in Node scope, a sign-in helper asserting only the URL and racing the session cookie, the same race in the Requestor helper which silently ran the denial proof as an analyst, a token parser dropping the document's inline weight exceptions and its section 4 nav-item size, a tracking assertion widened beyond what the application implements, a widget locator walking up one parent too few, recovery assertions expecting links where routes render buttons, and desktop-table assertions run at 375px where DataTable renders cards. One genuine product defect was found and fixed: the My Requests empty fixture zeroed pagination but passed the real rows, so RequestTable derived populated and the empty state never rendered. | fixed |  | 2026-09-10T09:22:21.231Z | 2026-09-10T21:30:00.000Z |
| 4 | 11 | unrun-verify | .planning/workstreams/csrm/phases/11-navigation-landing-and-list-clarity/11-UAT.md |  | NVDA announcements remain pending human verification | open |  | 2026-10-04T11:38:55.583Z |  |
| 5 | 11 | unrun-verify | .planning/workstreams/csrm/phases/11-navigation-landing-and-list-clarity/11-UAT.md |  | macOS Safari and Firefox quick-find shortcut remains pending human verification | open |  | 2026-10-04T11:38:55.911Z |  |
| 6 | 11 | unrun-verify | .planning/workstreams/csrm/phases/11-navigation-landing-and-list-clarity/11-UAT.md |  | Original operator UAT-A/B/C baselines remain pending human verification | open |  | 2026-10-04T11:38:56.235Z |  |
| 7 | 14 | deviation | apps/csrm/src/components/ui/button.tsx | 16 | The shared Button lifts 1px on hover (hover:-translate-y-px on the default, destructive and outline variants), which moves its hit area: a pointer resting on a button's bottom edge lifts it off the pointer and drops it back without end, so it never holds still. Found by Phase 14 stage B's Playwright regression (the development sign-in button was never stable for a click after a dialog click left the pointer on its edge); the e2e sign-in helper now parks the pointer first. A shared-UI pass should lift a visual layer, not the box, so the hit area stays still. | open |  | 2026-10-11T02:41:53.212Z |  |
| 8 | 14 | deviation | apps/csrm/src/components/ui/sheet.tsx | 77 | The shared SheetContent opens in 500 ms and closes in 300 ms with ease-in-out (sheet.tsx:77), where the direction's drawer motion is 260 ms expo with a fade and a short slide (direction §3.11, §5), and its animate-in, fade-in-0 and slide-in-from-* classes (and its overlay's) come from an animation plugin this app does not ship, so in the browser the shared sheets compute no animation at all (Phase 14 stage B measured none 0s ease on the phone actions sheet before its fix); Phase 14's sheets override it with the animate-drawer-* theme tokens in globals.css, and a shared-UI pass should correct the primitive, its overlay and the other sheets and dialogs that use the same inert classes (14-UI-REVIEW UI-02). | open |  | 2026-10-11T03:24:47.336Z |  |
| 9 | iam-01 | unmet-truth | scripts/verify-keycloak-idp.mjs |  | The root-level Keycloak static verifiers (scripts/verify-keycloak-idp.mjs, scripts/verify-keycloak-provisioning.mjs, wired as yarn verify:keycloak-idp / verify:keycloak-provisioning in docker/README.md) already failed before iam Phase 1: they assert text in the root README.md that it no longer carries ('Keycloak docs must include local-only', 'Provisioning docs must include IDAMBOX_KEYCLOAK_PROVISIONING'), and the repository uses pnpm, not yarn. iam Phase 1 only updated the compose bootstrap-admin assertions to the env-backed form; the stale root-README assertions and the yarn invocation need a decision (update or retire the scripts) by whichever workstream owns them. | open |  | 2026-10-13T12:21:08.460Z |  |
| 10 | iam-01 | unmet-truth | apps/backend/tests/questionnaire-ai-proposals.integration.test.ts | 458 | Pre-existing csrm backend test failure seen at the iam Phase 1 gate (no apps/ changes in that phase): 'with two 20,000-character files included, the job fails CONTEXT_TOO_LARGE...' fails with fetch failed / read ECONNRESET during the full suite and when its file runs alone (19/20), but passes when run by itself with --test-name-pattern. Order-dependent state from an earlier test in the same file breaks the attachment upload. Full gate: 1581 pass, 1 fail, 1 skipped, the same on a baseline run before any iam change. Owner: csrm (Phase 14/15 tests). | fixed | Cause: synchronous SQLite fixture work blocked the event loop past the harness server's 5 s keep-alive timeout, so the next POST reused a socket the server closed (fetch does not retry POST). Fixed in the shared test harness by raising keepAliveTimeout (fc183567); full suite green on 2026-10-15. | 2026-10-13T13:28:50.254Z | 2026-10-15 |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "06.3",
    "file": "apps/strapi/tests/questionnaire-workflow.integration.test.ts",
    "line": null,
    "description": "Mounted Strapi integration suite did not complete. Cause was not the Node version: better-sqlite3's native binary was still built for Node 22, and once rebuilt the suite deadlocked because Node 24 runs `node --test` files more concurrently than Node 22 did. Resolved by rebuilding the addon and running the suite one file at a time; 144/144 on Node 24.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-08T00:16:39.918Z",
    "resolved_at": "2026-09-08T06:48:41.912Z"
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "06.4",
    "file": "apps/web/e2e/requestor-request-workflow.spec.ts; apps/web/e2e/questionnaire-workflow.spec.ts",
    "line": null,
    "description": "Playwright workflow verification was not run because that execution excluded browser-suite execution. Run afterwards: 23 of 23 pass, after fixing a detail-URL capture that matched the create route, a list-row locator that required an explicit role attribute, an overflow assertion measured through a transient toast, and a genuine layout defect where a 500-character reversal reason scrolled the page sideways.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-08T00:00:00.000Z",
    "resolved_at": "2026-09-09T00:53:40.446Z"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "06.5",
    "file": "apps/web/e2e/design-system-conformance.spec.ts",
    "line": null,
    "description": "Isolated Playwright conformance run did not return after Strapi startup in this host. Run afterwards: 3 of 3 pass, with app-shell 7/7 as the environment control. The stall was not environmental. Eight defects in the spec itself were fixed: normalize() called inside page.evaluate but defined in Node scope, a sign-in helper asserting only the URL and racing the session cookie, the same race in the Requestor helper which silently ran the denial proof as an analyst, a token parser dropping the document's inline weight exceptions and its section 4 nav-item size, a tracking assertion widened beyond what the application implements, a widget locator walking up one parent too few, recovery assertions expecting links where routes render buttons, and desktop-table assertions run at 375px where DataTable renders cards. One genuine product defect was found and fixed: the My Requests empty fixture zeroed pagination but passed the real rows, so RequestTable derived populated and the empty state never rendered.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-10T09:22:21.231Z",
    "resolved_at": "2026-09-10T21:30:00.000Z"
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "11",
    "file": ".planning/workstreams/csrm/phases/11-navigation-landing-and-list-clarity/11-UAT.md",
    "line": null,
    "description": "NVDA announcements remain pending human verification",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-04T11:38:55.583Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "11",
    "file": ".planning/workstreams/csrm/phases/11-navigation-landing-and-list-clarity/11-UAT.md",
    "line": null,
    "description": "macOS Safari and Firefox quick-find shortcut remains pending human verification",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-04T11:38:55.911Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "11",
    "file": ".planning/workstreams/csrm/phases/11-navigation-landing-and-list-clarity/11-UAT.md",
    "line": null,
    "description": "Original operator UAT-A/B/C baselines remain pending human verification",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-04T11:38:56.235Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "14",
    "file": "apps/csrm/src/components/ui/button.tsx",
    "line": 16,
    "description": "The shared Button lifts 1px on hover (hover:-translate-y-px on the default, destructive and outline variants), which moves its hit area: a pointer resting on a button's bottom edge lifts it off the pointer and drops it back without end, so it never holds still. Found by Phase 14 stage B's Playwright regression (the development sign-in button was never stable for a click after a dialog click left the pointer on its edge); the e2e sign-in helper now parks the pointer first. A shared-UI pass should lift a visual layer, not the box, so the hit area stays still.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-11T02:41:53.212Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "14",
    "file": "apps/csrm/src/components/ui/sheet.tsx",
    "line": 77,
    "description": "The shared SheetContent opens in 500 ms and closes in 300 ms with ease-in-out (sheet.tsx:77), where the direction's drawer motion is 260 ms expo with a fade and a short slide (direction §3.11, §5), and its animate-in, fade-in-0 and slide-in-from-* classes (and its overlay's) come from an animation plugin this app does not ship, so in the browser the shared sheets compute no animation at all (Phase 14 stage B measured none 0s ease on the phone actions sheet before its fix); Phase 14's sheets override it with the animate-drawer-* theme tokens in globals.css, and a shared-UI pass should correct the primitive, its overlay and the other sheets and dialogs that use the same inert classes (14-UI-REVIEW UI-02).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-11T03:24:47.336Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 9,
    "kind": "unmet-truth",
    "phase": "iam-01",
    "file": "scripts/verify-keycloak-idp.mjs",
    "line": null,
    "description": "The root-level Keycloak static verifiers (scripts/verify-keycloak-idp.mjs, scripts/verify-keycloak-provisioning.mjs, wired as yarn verify:keycloak-idp / verify:keycloak-provisioning in docker/README.md) already failed before iam Phase 1: they assert text in the root README.md that it no longer carries ('Keycloak docs must include local-only', 'Provisioning docs must include IDAMBOX_KEYCLOAK_PROVISIONING'), and the repository uses pnpm, not yarn. iam Phase 1 only updated the compose bootstrap-admin assertions to the env-backed form; the stale root-README assertions and the yarn invocation need a decision (update or retire the scripts) by whichever workstream owns them.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-13T12:21:08.460Z",
    "resolved_at": null,
    "milestone": null
  },
  {
    "id": 10,
    "kind": "unmet-truth",
    "phase": "iam-01",
    "file": "apps/backend/tests/questionnaire-ai-proposals.integration.test.ts",
    "line": 458,
    "description": "Pre-existing csrm backend test failure seen at the iam Phase 1 gate (no apps/ changes in that phase): 'with two 20,000-character files included, the job fails CONTEXT_TOO_LARGE...' fails with fetch failed / read ECONNRESET during the full suite and when its file runs alone (19/20), but passes when run by itself with --test-name-pattern. Order-dependent state from an earlier test in the same file breaks the attachment upload. Full gate: 1581 pass, 1 fail, 1 skipped, the same on a baseline run before any iam change. Owner: csrm (Phase 14/15 tests).",
    "status": "fixed",
    "reason": "Keep-alive race: synchronous SQLite fixture work outlasted the harness server's 5 s keepAliveTimeout, so the next POST reused a closed socket. Fixed by raising the harness keepAliveTimeout (fc183567); full suite green 2026-10-15.",
    "recorded_at": "2026-10-13T13:28:50.254Z",
    "resolved_at": "2026-10-15",
    "milestone": null
  },
  {
    "id": 11,
    "kind": "unmet-truth",
    "phase": "iam-03",
    "file": "apps/backend/tests/risk-curation-rules.unit.test.ts",
    "line": null,
    "description": "csrm Phase 16 (16-02, paused mid-plan) committed red-phase unit tests apps/backend/tests/risk-curation-rules.unit.test.ts and risk-history-changes.unit.test.ts (aa14dc26) before their modules exist; the merge into main and then this branch (899fd212) carries them, so `pnpm --dir apps/backend test` stops at tests/tsconfig compilation on every branch. iam does not implement csrm modules or edit csrm tests. Until csrm 16-02 lands the modules, iam gates run the full suite with only these two files excluded from compilation and the run (1817 pass, 0 fail at 03-01). Owner: csrm. Update 2026-10-16: origin/csrm (729ef6e0) now contains apps/backend/src/csrm/risk-curation-rules.ts and risk-history-changes.ts; the gap closes on this branch when csrm merges into main and main is merged here.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-10-15T12:00:00.000Z",
    "resolved_at": null,
    "milestone": null
  }
]
````
