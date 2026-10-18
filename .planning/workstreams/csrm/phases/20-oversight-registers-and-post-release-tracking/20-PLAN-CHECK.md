# Phase 20 Plan Check

## Iteration 1

**Result:** VERIFICATION PASSED (0 blockers, 0 warnings, 0 info)
**Plans checked:** 23 (20-01 to 20-23), waves 1 to 22, an acyclic linear chain after wave 1 (20-01 and 20-02 run in parallel and are disjoint: records and pure modules).

### Deterministic probes
- verify-command-paths: 70 commands, 0 blockers, 0 warnings.
- verify-failure-directions: every runnable command has a stated failing direction (status ok).

### Requirement coverage
| Requirement | Plans |
|---|---|
| RISK-03 | 01, 10, 11, 12, 19, 20, 21, 23 |
| RISK-04 | 01-06, 08, 10, 13, 16, 17, 22, 23 |
| RISK-05 | 01, 02, 05-09, 13, 16-19, 22, 23 |
| RISK-06 | 01-04, 06, 07, 09, 14, 16-18, 23 |
| ADMIN-06 | 01, 10, 12, 21, 23 |
| NOTIFY-02 | 01-03, 13-15, 23 |

### Phase-specific checks
- Records before approval: 20-01 writes phase-20-treatment-tracking.md and phase-20-reminders-and-email.md, then a blocking-human checkpoint:decision (G-6) and a checkpoint:human-verify for the nodemailer provider; 20-03 has a precondition on both dated approval lines. PASS.
- Close Risk description corrected in the record (20-01) and in both catalogue copies (20-08); the 20-23 gate runs `cmp` over the two copies. PASS.
- G-16: 20-04 switches Phase 11's one rule in `treatment-due-state.ts` (function and SQL predicate together) to COALESCE(treatmentResolveDate, targetDate), with a server-written status-derived row, an SQL/function oracle, and every consumer moved onto it. PASS.
- Completing without evidence is refused (TREATMENT_EVIDENCE_REQUIRED, 20-06/20-17/20-23); date, plan and owner changes need reasons (20-06 Task 3). PASS.
- Overdue escalation goes to the assigned analyst and the risk owner (`treatment-overdue-escalated`, 20-02/20-13/20-14). PASS.
- The released record stays immutable through the release-baseline row, overlaid by every released read (20-01 D-05/D-06, 20-05). PASS.
- 19.1's notify service is extended with a system actor, explicit recipients and returned ids (20-13). PASS.
- Email: in-repo capture provider in development and tests, fails boot elsewhere, nothing leaves the machine; production settings in `.example`; the dependency is pinned and gated (20-15, 20-23). PASS.
- Daily run, start-up run and per-act run (20-14). PASS.
- Journey: 20-23 appends `sliceTrackTreatment(ctx)` after 17.1's `releaseAndClose(ctx)`, consistent with 17.2-CONTEXT inserting its contest slice after "Submit final assessment"; whole spec passes end to end at both widths; Maya (unrelated Requestor) refused (404 / not-found) at every step; Bob cannot accept (403 DECISION_NOT_PERMITTED). PASS.
- Unrelated user gets 404 (the missing-record refusal) on another person's treatment (20-02 refusal order, 20-23). PASS.
- Treatment owner refused every change act (403 TREATMENT_FIELD_NOT_PERMITTED) with no grant to the risk update (20-06). PASS.
- Playwright leaves the tree clean: every plan's gate ends with a filtered `git status --short`. PASS.

### Rules (stage2-rules section 3)
- No pre-rename app paths appear in any phase file. PASS.
- Keycloak flags and files untouched (20-23 static checks). PASS.
- Plans state they are written ahead and name the plans they rely on. PASS.
- UI extensions X-62 to X-67 are recorded in the direction by 20-01 before any implementing task. PASS.

### Scope
Plans 20-04, 20-12, 20-16, 20-17, 20-18, 20-20 and 20-21 list 16 to 18 files and each carries a scope note; every plan has 2 to 4 tasks. The count of 23 is accepted as cohesive (D-30 names the RISK-03/ADMIN-06 seam if a split is ever needed).

### Scope-reduction scan
The only matches are "v1 exception", a domain term for pre-existing exemptions, not a scope reduction.

### Structured Issues
```yaml
issues: []
```

---

## Orchestrator disposition (2026-10-02)

**Verdict: PASSED, iteration 1, with no findings.** The phase stays whole at 23 plans, above its size-L guide, by the pilot's decision of 2026-10-02 (no Phase 20.1). The planner named a seam in case execution shows a split is needed: RISK-03 and ADMIN-06, that is plans 20-10 to 20-12 and 20-19 to 20-21 (registers by type, exposure by type and a system's page). Stage 3 may split there if execution shows it is needed.
