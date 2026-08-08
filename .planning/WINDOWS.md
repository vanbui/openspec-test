---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-08-08T14:51:39.303Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | deviation | .planning/STATE.md |  | Historical Phase 02 state advancement could not parse the Phase 06-positioned STATE.md | open |  | 2026-08-08T14:39:01.019Z |  |
| 2 | 02 | deviation | apps/backend/README.md |  | Corrected the backend README core-collection count from four to five. | open |  | 2026-08-08T14:50:41.194Z |  |
| 3 | 02 | deviation | .planning/ROADMAP.md |  | Repaired duplicated Phase 2 plan metadata and preserved the active Phase 6 progress values after automated updates. | open |  | 2026-08-08T14:51:39.303Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "02",
    "file": ".planning/STATE.md",
    "line": null,
    "description": "Historical Phase 02 state advancement could not parse the Phase 06-positioned STATE.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T14:39:01.019Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "02",
    "file": "apps/backend/README.md",
    "line": null,
    "description": "Corrected the backend README core-collection count from four to five.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T14:50:41.194Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "02",
    "file": ".planning/ROADMAP.md",
    "line": null,
    "description": "Repaired duplicated Phase 2 plan metadata and preserved the active Phase 6 progress values after automated updates.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-08T14:51:39.303Z",
    "resolved_at": null
  }
]
````
