---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-08T14:39:01.019Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | deviation | .planning/STATE.md |  | Historical Phase 02 state advancement could not parse the Phase 06-positioned STATE.md | open |  | 2026-08-08T14:39:01.019Z |  |

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
  }
]
````
