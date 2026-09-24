---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 2
total_count: 3
last_updated: 2026-09-10T09:22:21.231Z
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
    "description": "Isolated Playwright conformance run did not return after Strapi startup in this host. Run afterwards: 3 of 3 pass with app-shell 7/7 as control; eight spec defects and one product defect fixed.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-10T09:22:21.231Z",
    "resolved_at": null
  }
]
````
