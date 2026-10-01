# Resume prompt: build every remaining post-demo phase

Paste everything below the line into a new Claude Code session opened at `C:\Users\dylan\Developer\idambox`. It is safe to paste again in every later session: each run resumes from `.planning/STATE.md` and carries on until the milestone is built or the weekly usage ceiling is near.

---

# CSRM post-demo: build every remaining phase

You are the **pilot** for the CSRM post-demo programme in `C:\Users\dylan\Developer\idambox`, on branch `post-demo`. Planning is complete: Stages 0–2 are done, and the planning gate passed on 2026-10-02. Your job is Stage 3: build every remaining phase autonomously, in execution order, to the end of milestone v2.0, then report.

Supervise, and run a worker subagent for the heavy GSD execution, one launch per phase. Don't ask me questions. When something is ambiguous, decide as a mature second-line cyber-governance function would (Three Lines; ISO/IEC 27005), at the G-4 premium UX bar. Record the decision and keep going. Stop only under "Stop only if".

## 1. Orient (every session)

1. Read `.planning/POST-DEMO-BRIEF.md` in full.
   - Section 6 is my original prompt, and it stays binding: Stage 3, "Piloting the worker", "Rules", "Stop only if" and "Final report".
   - Sections 1–5 hold the overrides, the dev-mode rules, the baseline, the host notes and the gate commands.
   - Section 7 holds my later updates, including pushing.
2. Read:
   - `.planning/STATE.md`: its Session Continuity names the exact next step;
   - `.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`;
   - `.planning/NEXT-WAVE-DECISIONS.md`: decisions 1–18, G-1 to G-10, and the post-demo G-11 to G-20;
   - `AGENTS.md`, `CONTEXT.md` and `.planning/config.json`.
3. Check the repository:
   - make sure `post-demo` is checked out, and run `git switch post-demo` if it isn't;
   - run `git status`, `git log --oneline -5` and `git fetch origin`, then compare `post-demo` with `origin/post-demo`. If `origin` is ahead, fast-forward with `git merge --ff-only origin/post-demo`; never create a merge commit;
   - expect a clean tree apart from the three operator items in brief §2;
   - if an interrupted session left work in the tree, finish or set it aside as STATE.md's notes say, and never stage the operator items.
4. Check usage with `mcp__ccd_session_mgmt__get_usage` (load it through ToolSearch).
   - At 93% or more of the weekly limit, start nothing new.
   - Make sure the tree is clean, STATE.md names the next step, and everything is committed and pushed.
   - Then report.
5. Set up Node 24.19 for this session as brief §4 shows. The machine default is Node 22.19, and you must never run `nvm use`.
6. Before any Playwright run, make sure no Strapi or Next dev server is running.

## 2. The build loop

**Execution order:** 10, 11, 12, 13, 14, 15, 16, 19, 19.1, 17, 17.1, 17.2, 18, 20, 21, 22.

Start with the first phase that is not complete. STATE.md says which. A phase is complete when:
- every plan has its SUMMARY.md;
- its VERIFICATION.md passes;
- its gate is green.

Before the next phase, do any quick task STATE.md's Session Continuity names. After G-10, that is the typography follow-up from quick task 261002-2y8. Run each as a GSD quick task (`/gsd-quick`), with the full gate afterwards.

For each phase:

1. **Fresh plan check, before any code.** Run `gsd-plan-checker` against today's code. The plans were written ahead, against earlier phases' planned outputs. Fix blockers through a planner revision, then commit.
2. **Execute.** The worker runs `/gsd-execute-phase <n>`: plans in wave order, with atomic commits. A resumed phase skips plans that already have a SUMMARY.md.
3. **Contract-gap checkpoints (G-6).** Every content-type change starts with its `docs/contract-gaps/` record and stops at an approval checkpoint.
   - The worker stops and reports the record to you.
   - Review it against the JDL, `specification.json`, the role-function catalogue, AGENTS.md and the phase's CONTEXT.md, then send it back or approve it.
   - Record the approval in the record: approved by the pilot, the date, and what you checked.
   - Resume the worker with `SendMessage`.
4. **Verify.** Run the GSD verifier to produce `VERIFICATION.md`, and close every gap it finds.
5. **Gate, in dev mode** (brief §5):
   - `api:check`, typecheck, lint, web unit, Strapi, and Playwright in both projects, all green;
   - Playwright covers the phase's flows. From Phase 17 that includes the slices of `apps/csrm/e2e/risk-owner-journey.spec.ts`;
   - `git status` is clean afterwards;
   - a failure the phase did not cause is still yours to fix before moving on;
   - if the same gate fails after three genuine fix attempts, stop (brief "Stop only if").
6. **Record and commit.** Update:
   - the ROADMAP plan checkboxes;
   - STATE.md's Current Position;
   - STATE.md's Performance Metrics, with the gate counts;
   - STATE.md's Session Continuity, naming the next step.

   Commit by explicit path.
7. **Push** `post-demo` to `origin` (section 3).
8. **Check usage.** Pause under section 4 if needed; otherwise go on to the next phase.

**Evidence.** Accept the worker's "done" only with evidence: test output with counts, `VERIFICATION.md` and commit SHAs. Send work back when it falls short.

**Your context.** Spend your own context on review, not on doing the work. When a worker's context is spent, relaunch a fresh one from this prompt and STATE.md.

**Worker launch.** Use the `general-purpose` agent type with `model: "opus"`; `.claude/agents/csrm-worker.md` does not exist here. Give it:
- the phase number and its ROADMAP entry;
- brief sections 2, 4 and 5;
- the git rules in section 3 below;
- the rule to stop and report at every contract-gap checkpoint, and at any Stop-only-if condition;
- the evidence it must return.

**Seams to watch:**
- Phase 13's assignee is what 17.1's assigned-analyst-only submit, recall, and release and close rely on.
- Phase 17 adds the development personas for a risk owner and an unrelated Requestor. Keep ADR 0004's fixture subjects and the realm import consistent, and never start Keycloak.
- Phase 20 stays whole at 23 plans. If execution shows a split is needed, its PLAN-CHECK names the seam.
- Phase 22 withdraws the service agent's explicit grants (its D-09) and owns G-20's manual start.

## 3. Git and pushing

- **Committing:**
  - commit only on `post-demo`, staging by explicit path;
  - never `git add -A` or `git add .`;
  - never stage `apps/backend/types/generated/*.d.ts` or `example-risk-assessment-questions/`;
  - never commit secrets or `.env` files, and never read `.env` files;
  - new settings go in the `.example` files with safe defaults.
- **Pushing:**
  - push `post-demo` to `origin` (`https://github.com/vanbui/idambox.git`) after each phase lands and at every pause, fast-forward only;
  - never force-push or push another branch;
  - never merge, rebase or open a pull request. The one exception is fast-forwarding `post-demo` to `origin/post-demo` with `--ff-only`, which creates no merge commit.
- **The other branch:** `origin/csrm-20260928` gained `326eb3a` (my housekeeping) after `post-demo` branched from `ece1a25`. Do not merge it: integration is mine.

## 4. Pausing

Pause at a clean boundary before about 95% of the weekly limit. Check usage at every gate and before every phase. To pause:

1. Finish or cleanly stop the unit in hand, and leave the tree clean.
2. Update STATE.md's Session Continuity with the exact next step: the phase, the plan, and any checkpoint waiting for approval.
3. Commit, push, and give me a short report.

The next session resumes from this same prompt.

## 5. Stop only if

- an ask can't be met without breaking an AGENTS.md non-negotiable;
- the work needs Keycloak enabled, real credentials, an external account, or a destructive git operation (pushing `post-demo` as in section 3 is allowed);
- the same gate fails after three genuine fix attempts;
- the usage ceiling is reached (section 4).

## 6. When Phase 22 lands

1. Run the complete gate one last time, including the whole post-demo journey and its negative cases (brief §6, Stage 3 item 4).
2. Push.
3. Report as brief §6's "Final report" asks:
   - the branch and commit range;
   - the baseline gates against the final gates;
   - each ask (PD-1 to PD-5) mapped to requirement, phase and status;
   - the decisions, one line each, with reversals flagged;
   - the phases planned and built;
   - open questions for me, most important first. Include G-20's manual start, the three W019 health dispositions, and anything new.
