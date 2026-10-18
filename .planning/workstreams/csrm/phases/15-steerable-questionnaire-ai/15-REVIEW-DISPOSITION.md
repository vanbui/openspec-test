---
phase: 15
review: 15-REVIEW.md
recorded: 2026-10-13
open: 0
total: 31
---

# Phase 15 code review disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| BE-01 | critical | fixed | `d3ed88d7`, `14c41561`: admission reservations share the release lock; completion rechecks capacity; legacy histories paginate. |
| BE-02 | critical | fixed | `78c9b4c9`: follow-up context uses visible submitted answers while drafts stay withheld. |
| BE-03 | critical | fixed | `bd78013c`: Requestor save/read projections suppress undone additions while analyst history retains them. |
| BE-04 | critical | fixed | `78c9b4c9`: manual choice snapshots preserve duplicate labels with distinct values; Undo is deep-equal. |
| BE-05 | critical | fixed | `d3ed88d7`, `14c41561`: start/retry admission and release serialize; provider launch follows committed admission. |
| BE-06 | warning | fixed | `9c524a25`: optional bounded identifier-only source map resolves current question labels; legacy and removed-question fallbacks remain. |
| BE-07 | warning | fixed | `f3d19400`: requesting analysts cannot retry their own instructed jobs; hub and direct facts agree. |
| BE-08 | warning | fixed | `1ee7bb7c`: decision capacity returns atomic `HISTORY_UNAVAILABLE`; an already full history requires audit-preserving administrator repair. |
| FE-01 | critical | fixed | `bd9c10ab`: recovered answers persist through failed saves until the current save is acknowledged. |
| FE-02 | critical | fixed | `bd9c10ab`: soft refresh and re-release restore eligible durable answers. |
| FE-03 | critical | fixed | `12c0719b`: typed analyst question data preserves `answered`; Requestor DTOs strip it. |
| FE-04 | critical | fixed | `60494729`: refused/rejected status reads recover within a bound and expose Check again afterward. |
| FE-05 | critical | fixed | `3ba0995e`: acknowledged Replace clears its instruction and uses the pinned guidance. |
| FE-06 | critical | fixed | `4a216cb9`: removal proposals no longer offer unsupported editing. |
| FE-07 | critical | fixed | `b76918f4`: active per-question rewrites participate in the draft-generation gate. |
| FE-08 | critical | fixed | `12c0719b`: own-request release refusals clear after server refresh when colleagues resolve proposals. |
| FE-12 | critical | fixed | `b76918f4`, `37b0a1a7`: submitted hubs retain proposal counts/jobs and reload the latest questionnaire-wide outcome. |
| FE-13 | critical | fixed | `bd78013c`: owner take-back answer writes return `QUESTIONNAIRE_NOT_ANSWERABLE`; unrelated owners remain refused without disclosure. |
| FE-14 | critical | fixed | `e85c65d6`: stable job holder and successful return focus survive committed UI transitions. |
| FE-15 | critical | fixed | `e85c65d6`: confirmation focus lands after the committed render and enabled controls. |
| FE-16 | critical | fixed | `e85c65d6`: edited-add confirmation names the selected section, including long new titles. |
| FE-17 | critical | fixed | `53189ec7`: delayed signal jobs hand off to the later-mounted panel and focus only after status text exists. |
| FE-09 | warning | fixed | `53189ec7`: no-change runs explain answered targets and invalid/left-out items. |
| FE-10 | warning | fixed | `e8068e66`: reject reasons persist per actor/run/item and clear after acknowledged rejection or intentional Keep. |
| FE-11 | warning | fixed | `e8068e66`: changed unsent proposal drafts use the existing sign-out-aware unload warning. |
| FE-18 | warning | fixed | `53189ec7`: answered and left-out figure toggles meet the 24px minimum target. |
| FE-19 | warning | fixed | `35ff93c7`, `e85c65d6`, `53189ec7`: comparison rows have field-only names and the preparing holder remains live and mounted. |
| FE-20 | warning | fixed | `3ba0995e`: Replace repeats the approved Generate guidance. |
| FE-21 | warning | fixed | `3ba0995e`: requesting analysts see the own-request caption on Replace and in its confirmation. |
| CT-01 | critical | fixed | d0f98885: every required installer PID is waited separately; all-pass and each single-child failure verified with actual wait block; bash -n clean. |
| CT-02 | critical | fixed | d0f98885: export retains docker realm and its linked guide; fixture-subject assertions preserved; bash -n clean. |

## Pilot walk, 2026-10-12

The answer to 15-14 Task 4 is **issues found**. D1–D9 and the two NVDA implementation risks are recorded in the frontend lane, FE-12–FE-21; D6 includes the backend ownership/state-conflict ruling. Fixes require the browser regressions and final gate specified in `15-PILOT-RULINGS.md`. Speech remains the operator’s manual check.
