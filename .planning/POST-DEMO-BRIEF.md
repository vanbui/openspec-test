# Post-demo brief: reconcile, plan and build the risk-owner acceptance flow

**Status:** the active brief for the post-demo work, from 2026-10-01. It is the Resume File STATE.md names. It replaces "the operator's local v2.0 orchestration brief (git-excluded)", which does not exist in this repository.
**Branch:** `post-demo`, created from `csrm-20260928` at `ece1a25`. Commit only here. Push only `post-demo` to `origin`, fast-forward, as section 7 records; never open a PR or merge.
**Roles:** the pilot (the operator's main session) owns the result and every gate. A worker subagent runs the GSD planning and execution units, and the pilot accepts its work only with evidence.
**Sections:** 1 overrides, 2 dev-mode rules, 3 baseline, 4 host notes, 5 gate commands, 6 the operator's prompt (verbatim), 7 the operator's later updates.
**Resume prompt for later sessions:** `.planning/prompts/post-demo-build.md`.

## 1. Overrides to stale planning facts

These win over anything older in `.planning/`.

| Stale fact | Where | Override |
|---|---|---|
| Work happens on branch `v2.0`, resuming from the operator's local v2.0 orchestration brief | STATE.md | Neither exists here: `v2.0` and `uat-trial` are upstream branch names. Work happens on `post-demo`, and this file is the brief. |
| The apps are `apps/strapi` and `apps/web` | Phase 10–12 artifacts (about 2,064 occurrences), PROJECT.md, STATE.md | They are `apps/backend` (Strapi) and `apps/csrm` (Next.js), renamed in `d161fce`. Fixed in Stage 0: every Phase 10–12 artifact, PROJECT.md and STATE.md. Historical records (v1 phase folders, `milestones/`, `quick/`, `debug/`, `uat/`, `research/`, `STATE-ARCHIVE.md`) keep the paths that were true when they were written. |
| INT-02 (Keycloak) is deferred | REQUIREMENTS.md, STATE.md, ROADMAP.md, NEXT-WAVE-DECISIONS.md | Implemented, flag-gated and off in development. OIDC sign-in is ADR 0003 (quick tasks 260929-u0w and 260930-iei), and Strapi access-token verification is ADR 0004 (`b6000d0`). Updated in Stage 0. |
| `model_profile: balanced`, `workflow.auto_advance: true` | `.planning/config.json` | `inherit` (GSD agents use the session model) and `false` (the pilot drives every transition, and planning never rolls into execution). Set in Stage 0. |

## 2. Dev-mode rules

- The web keeps `CSRM_AUTH_OIDC_ENABLED=false` and `CSRM_DEV_IDENTITY=true`. Strapi keeps `IDAMBOX_KEYCLOAK_PROVISIONING=false` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=false`. Nobody starts Keycloak or flips these flags.
- The unit and Playwright harnesses pin `CSRM_AUTH_OIDC_ENABLED=false` themselves (ADR 0003, Harness pins). Playwright starts its own Strapi with `CSRM_DEV_IDENTITY=true`.
- Every new authorisation rule is enforced in Strapi against the resolved IdamBox User (`ctx.state` after the identity middlewares). The development identity bridge and a Keycloak-verified user then behave identically. Authorisation never branches on the auth mode, and the existing OIDC tests stay green.
- Never read or print `.env` files: a secret-read guard blocks it. Read the `.example` templates for variable names, and put new settings in them with safe defaults.
- Working tree: `apps/backend/types/generated/components.d.ts` and `contentTypes.d.ts` show as modified with an empty `git diff` (line endings), and `example-risk-assessment-questions/` is the operator's untracked reference material. Leave all three alone and never stage them. Stage by explicit path only: never `git add -A` or `git add .`.

## 3. Baseline gates (2026-10-01, `ece1a25`, dev mode)

Recorded before any change on `post-demo`. A failure here is baseline, not a regression of this work.

| Gate | Command (section 5) | Result | v1.0 final gate (2026-09-26) |
|---|---|---|---|
| `api:check` | `pnpm --dir apps/csrm api:check` | clean | clean |
| Typecheck | `pnpm --dir apps/csrm typecheck` | clean | clean |
| Lint | `pnpm --dir apps/csrm lint` (the web's lint is `next typegen && tsc --noEmit`; there is no ESLint) | clean | — |
| Web unit (Vitest) | `pnpm --dir apps/csrm test` | **2,046 / 2,048**: 2 baseline failures, below | 1,892 / 1,892 |
| Strapi (node:test) | `pnpm --dir apps/backend test` | **578 / 578** (10 min 45 s) | 526 / 526 |
| Playwright (desktop and mobile, production build) | `pnpm --dir apps/csrm test:e2e` | **84 / 84** (11.1 min); the tree was clean afterwards | 84 / 84 |

Baseline failures:

1. `apps/csrm/src/components/csrm/feedback-composites.test.tsx` ("communicates status and confirmation feedback accessibly") reads `../strapi/src/api/csrm-assessment-request/...`.
2. `apps/csrm/src/features/administration/administration-service.test.ts` ("keeps exact human-only grants byte-identical...") reads `../strapi/src/bootstrap/idambox-csrm-role-function-api-catalogue.json`.

Both are leftovers of the `d161fce` rename: the files exist under `../backend/`. They are fixed in their own commit straight after Stage 0, so every later gate can be green.

## 4. Host notes (the operator's Windows 11 build host)

- **Node.** The default `node` on PATH is 22.19.0, but the workspace needs `>=24.19.0 <25`. Node 24.19.0 is installed at `C:\ProgramData\nvm\v24.19.0`. Do not run `nvm use`, which changes the machine-wide default. Put that directory first on PATH for the gate commands only. Its pnpm is Corepack's `pnpm.js`, so a shim is needed, because the global `pnpm` shim pins Node 22:
  ```bash
  # Git Bash: once per shell
  export PATH="/c/ProgramData/nvm/v24.19.0:$PATH"
  pnpm() { /c/ProgramData/nvm/v24.19.0/node /c/ProgramData/nvm/v24.19.0/node_modules/corepack/dist/pnpm.js "$@"; }
  ```
  Child processes that resolve `pnpm` from PATH need a `pnpm` and a `pnpm.cmd` file shim on PATH. That covers Turbo, and package scripts that call `pnpm` themselves, such as `api:check`. Playwright does not need one: it runs its servers with `process.execPath` and the `pnpm.js` beside it, so it inherits Node 24 when started under Node 24.

  The full recipe, once per session, with `S` set to that session's scratchpad directory:
  ```bash
  S="<this session's scratchpad directory>"
  mkdir -p "$S/bin"
  printf '#!/bin/sh\nexec /c/ProgramData/nvm/v24.19.0/node /c/ProgramData/nvm/v24.19.0/node_modules/corepack/dist/pnpm.js "$@"\n' > "$S/bin/pnpm"
  chmod +x "$S/bin/pnpm"
  printf '%s\r\n' '@"C:\ProgramData\nvm\v24.19.0\node.exe" "C:\ProgramData\nvm\v24.19.0\node_modules\corepack\dist\pnpm.js" %*' > "$S/bin/pnpm.cmd"
  printf 'export PATH="%s/bin:/c/ProgramData/nvm/v24.19.0:$PATH"\n' "$S" > "$S/node24.sh"
  ```
  The lines carry no heredocs, so they work when copied with this list's indentation. Then start every Bash command that runs node or pnpm with `source "$S/node24.sh"`, and check it with `node --version` (v24.19.0) and `cmd //c "pnpm.cmd --version"` (11.24.0). Tested on this host on 2026-10-02.
- **`api:check` and line endings.** `core.autocrlf` is `true`. `api:check` rewrites `apps/csrm/src/lib/api/generated/schema.d.ts` with LF, so `git status` may list it as modified with an empty diff. Run `git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts` afterwards. It is non-destructive and only refreshes the stat cache. Never stage the file unless the contract really changed.
- **Playwright.** Stop any Strapi dev server first: `strapi develop` shares `apps/backend/dist` with the harness (see the header of `apps/csrm/playwright.config.ts`). The run uses its own ports, SQLite file and Next build directory, and must leave the tree clean (Phase 8 D-12; G-6).
- **Agents.** `.claude/agents/csrm-worker.md` does not exist in this repository, so the worker runs as a `general-purpose` agent with `model: "opus"`.

## 5. Gate commands (dev mode, from the repository root, with section 4's PATH)

```bash
pnpm --dir apps/csrm api:check && git update-index --refresh -- apps/csrm/src/lib/api/generated/schema.d.ts
pnpm --dir apps/csrm typecheck
pnpm --dir apps/csrm lint
pnpm --dir apps/csrm test
pnpm --dir apps/backend test
pnpm --dir apps/csrm test:e2e
git status --short   # only the three operator items in section 2 may show
```

A phase gate is green when every command passes and the Playwright run covers the phase's flows.

## 6. The operator's prompt (verbatim, 2026-10-01)

# CSRM post-demo: reconcile, plan and build the risk-owner acceptance flow

You are the **pilot**. Do the baseline yourself, then run a worker subagent for the heavy GSD planning and execution. Supervise it at every gate, and own the result. Work autonomously from start to finish. Don't ask me questions: when something is ambiguous, decide, record the decision, and keep going. Stop only under "Stop only if".

## Ground truth (checked 2026-10-01; verify, don't assume)

- **Binding rules:** `AGENTS.md`, the root `CONTEXT.md` glossary, and the references AGENTS.md lists (brief, `specification.json`, `idambox-datamodel.jdl`, role-function catalogue, design direction).
- **GSD state:**
  - Milestone v2.0 "Assessment Lifecycle and Oversight" covers Phases 10–22 and 17.1, in plan-all-first mode.
  - Execution order: 10, 11, 12, 13, 14, 15, 16, 19, 17, 17.1, 18, 20, 21, 22.
  - Phase 10 is planned (23 plans). Phase 11 has its UI-SPEC. Phase 12 is discussed and researched. Phases 13–22 and 17.1 are unplanned.
  - Read `.planning/STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `NEXT-WAVE-DECISIONS.md` and `config.json`.
- **Stale planning facts. These overrides win:**
  - STATE.md says to work on branch `v2.0` and to resume from "the operator's local v2.0 orchestration brief (git-excluded)". Neither exists in this repo; `v2.0` and `uat-trial` are upstream branch names. This prompt is the brief.
  - The apps are now `apps/backend` (Strapi) and `apps/csrm` (Next.js), renamed in d161fce. The Phase 10–12 artifacts still say `apps/strapi` and `apps/web` about 2,000 times. Fix them before any executor uses them.
  - INT-02 says Keycloak is deferred. Since then, OIDC sign-in and Strapi access-token verification have shipped behind flags (ADRs 0003 and 0004, quick tasks 260929-u0w and 260930-iei). Update INT-02 and STATE.md's risk entry: implemented, flag-gated, and off in development.
- **Dev mode only:**
  - Keep the web's `CSRM_AUTH_OIDC_ENABLED=false` and `CSRM_DEV_IDENTITY=true`.
  - Keep Strapi's `IDAMBOX_KEYCLOAK_PROVISIONING=false` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=false`.
  - Never start Keycloak or flip those flags.
  - Enforce every new authorisation rule in Strapi against the resolved IdamBox user, so the dev identity bridge and Keycloak-verified users behave identically. Never branch authorisation on the auth mode, and keep the existing OIDC tests green.
- **Working tree:** the generated Strapi types show as modified with an empty `git diff` (line endings), and `example-risk-assessment-questions/` is my untracked reference material. Leave both alone, and never stage them.

## The asks (from the product demo; my words, lightly edited)

> The nominated risk owner and the requestor need to be able to view the risk assessment. After the analyst submits the final assessment, it requires risk acceptance from the risk owner to formally close the ticket. In this stage, the risk owner can contest anything written down, and the analyst should be able to edit everything again.
> Risk acceptance or Treatment Plan.
> Treatment plans need to be tracked, etc.

## Stage 0: baseline and setup (you)

1. Read the files above, ADRs 0002–0004, and decision notes 3, 8, 9 and 17, G-1, G-2 and G-6.
2. `git switch -c post-demo` from `csrm-20260928` (HEAD `ece1a25`).
3. Run every gate in dev mode (typecheck, lint, web unit, Strapi, `api:check`, Playwright) and record the counts. The v1.0 final gate was Playwright 84/84, Strapi 526/526 and web 1,892/1,892. Anything already failing is baseline, not your regression.
4. In `.planning/config.json`:
   - set `model_profile` to `inherit`, so GSD agents use the session model;
   - set `workflow.auto_advance` to `false`. You drive every transition, and planning must never roll into execution.
5. Write `.planning/POST-DEMO-BRIEF.md`: this prompt, the baseline and the overrides. Point STATE.md's Resume File at it, and commit.
6. Launch the worker for Stage 1 (see "Piloting the worker").

## Stage 1: reconcile the asks (worker drafts, you approve)

Most of this is already planned. Amend it; don't build a parallel flow.

| Ask | Already planned | Gap to settle |
|---|---|---|
| The Requestor and the nominated risk owner view the assessment | 17: "Released for response" (the Requestor and named risk owners read the initial risks). 20: owner-scoped risk reads. 19: Requestor exports | A risk owner who isn't the Requestor reading the *whole* assessment, at which stages. How an owner is nominated: the JDL has per-risk `CsrmRisk.riskOwner`, and the request has only `requestor` and `sponsor` |
| Owner acceptance after the final assessment closes the request | 17.1, G-2 and decision 8: the owner approves the treatment plan and accepts residual risk before release; High and Critical add an executive approver; release is blocked until then | Map "submit final assessment" to 17.1's request for acceptance, and "formally close" to release plus request status `CLOSED`. Settle exactly when the request closes |
| The owner contests anything, and the analyst can edit everything again | G-2: a per-risk decline returns that risk to the analyst. "Mark reviewed" is withdrawn by any later edit | Assessment-level contest points on any content, each with a reason and a reply thread. The whole assessment reopens in numbered rounds. Decide what happens to acceptances already given when their risk changes. Full history throughout |
| Acceptance *or* a treatment plan | JDL `CsrmTreatmentAction` {`ACCEPT`, `TREAT`}, `treatmentPlan`, `treatmentOwner`, `treatmentResolveDate`. Decision 8 says when treatment is mandatory | An explicit per-risk choice in the owner's acceptance UI and API |
| Treatment plans are tracked | 20: post-release updates, the owner view, reminders and closure. 18: bulk edits. Decision 9 | Confirm that 20 covers a "my treatments" view, `CsrmTreatmentStatus` including `OVERDUE`, evidence and escalation, and fill any gap there |

Rules:
- **Default design:** acceptance stays *before* release (G-2; ISO/IEC 27001:2022, 6.1.3 f). Contest and rework then happen while the assessment is still editable, and decision 9's immutable released record holds. If you depart from this, record why.
- **Placement:** fold the changes into 17, 17.1 and 20. Insert a decimal phase with `/gsd-phase` only for work that doesn't fit. The likely candidate is the contest-and-rework loop, as 17.2, if it would push 17.1 past size L.
- **Access:**
  - Risk owners are first-line users holding the Requestor birthright role. Add no new IdamBox Role unless it's unavoidable.
  - Record-level grants are enforced in Strapi.
  - An unrelated Requestor sees nothing at any stage.
  - An analyst never accepts on the owner's behalf.
  - AI never accepts, closes or releases.
- **Data:**
  - Use JDL names; "ticket" means `CsrmAssessmentRequest`.
  - Every content-type change starts with a `docs/contract-gaps/` record, then the approval checkpoint. Under G-6 you approve it after review, and the approval is recorded in the record.
- **Traceability:** continue the requirement IDs (ASSESS-21+, RISK-06+, NOTIFY-04+, COLLAB-04+). Each new requirement gets a phase, success criteria (at least one of them a negative authorisation case) and a ROADMAP coverage entry.
- **Decisions:** add a "Post-demo decisions" section to `NEXT-WAVE-DECISIONS.md`, numbered from G-11. Each entry records:
  - the ask;
  - the options;
  - the choice, with its real-world basis;
  - the phases it affects;
  - any earlier decision it reverses, named explicitly.

  Give each a one-line entry in STATE.md's Decisions.

## Stage 2: finish planning (worker)

Plan every remaining phase, including any you insert, in execution order. Use STATE.md's "Next wave planning method": auto-mode discussion, then a UI-SPEC for UI phases, then research, plans and the plan check.
- UI-SPEC values come only from `docs/design/csrm-design-direction.md`. Extensions continue the X-n sequence, and every UI-SPEC meets the G-4 bar.
- Read-only units can run in parallel once their dependencies have a CONTEXT.md.

**Planning gate (you), before any code:**
- every phase has plans and a passing check;
- every ask traces to a requirement, a phase and a success criterion;
- nothing references `apps/strapi` or `apps/web`;
- `/gsd-health` is clean.

Then commit.

## Stage 3: build (worker, one phase at a time)

1. First, the G-10 self-hosted fonts quick task.
2. Then each phase in execution order:
   1. a fresh plan check;
   2. `/gsd-execute-phase`;
   3. the GSD verifier;
   4. every gate green in dev mode, with Playwright covering the phase's flows;
   5. atomic commits, and STATE.md updated.
3. Don't pull the risk-owner work ahead of its dependencies.
4. Once it lands, Playwright must cover this whole path:
   - a Requestor raises a request;
   - the analyst assesses it and releases it for response;
   - the Requestor and a *different* nominated risk owner view it and respond;
   - the analyst submits the final assessment;
   - the owner contests two points, and the analyst edits and resubmits;
   - the owner accepts one risk and sends another to treatment (plan, treatment owner, due date);
   - the request closes;
   - the treatment is tracked to `COMPLETE`.

   Negative cases: an unrelated Requestor is refused at every step, in the UI and the API, and the analyst cannot accept.

## Piloting the worker

- Spawn it as `csrm-worker` (`.claude/agents/csrm-worker.md`: `model: opus`, `effort: max`). If that type isn't available, use `general-purpose` with `model: "opus"`.
- First have it confirm that it can spawn GSD's own agents. If it can't, run the GSD skills yourself and hand it single units.
- Use one launch per stage, or per phase in Stage 3. Continue with SendMessage, or relaunch from the brief when its context is spent. Spend your own context on review, not on doing the work.
- Accept "done" only with evidence: test output, VERIFICATION.md and commit SHAs. Send work back when it falls short.

## Rules

- **Discretion:** choose what a mature cyber-governance function would do (Three Lines; ISO/IEC 27005), at the G-4 premium UX bar. Record the choice and continue.
- **Git:**
  - commit only on `post-demo`, staging by explicit path, never `git add -A` or `git add .`;
  - never push, open a PR or merge;
  - never commit secrets or `.env` files; new settings go in the `.example` files with safe defaults.
- **Tests:** add tests with every material workflow. A Playwright run leaves the tree clean (Phase 8 D-12).
- **Usage:** check usage at each gate if a tool exposes it. Pause at a clean boundary before about 95% of the weekly limit, with a clean tree and STATE.md's Session Continuity naming the exact next step.

## Stop only if

- an ask can't be met without breaking an AGENTS.md non-negotiable;
- the work needs Keycloak enabled, real credentials, an external account, a push or merge, or a destructive git operation;
- the same gate fails after three genuine fix attempts;
- the usage ceiling is reached.

## Final report

- the branch and commit range;
- the baseline gates against the final gates;
- each ask mapped to requirement, phase and status;
- the decisions, one line each, with reversals flagged;
- the phases planned and built;
- open questions for me, most important first.

---

## 7. The operator's later updates

These come after the verbatim prompt in section 6 and amend it where they say so.

**2026-10-02: push the branch, and a resume prompt for later sessions.** The operator: "Once all the planning is done, push and commit. Make sure that the branch is on git. Then, create the prompt for future Claude Code sessions to autonomously build out through all the phases."

- **Pushing.** `post-demo` is pushed to `origin` (`https://github.com/vanbui/idambox.git`), first at `25bfc73` once the planning gate passed. From now on it is pushed after each phase lands and at every pause, fast-forward only. This replaces section 6's "never push" for `post-demo` alone. Never force-push or push another branch, and never merge, rebase or open a pull request.
- **Resume prompt.** `.planning/prompts/post-demo-build.md` holds the prompt the operator pastes into each later session. It resumes from STATE.md and builds the remaining phases in execution order until the milestone is built or the usage ceiling is near.
- **The base branch moved.** After `post-demo` branched from `ece1a25`, `origin/csrm-20260928` gained `326eb3a` ("Move the example questions to docs/references", the operator's housekeeping: `csrm-questions.seed.json` moved into `docs/references`, the overlay script changed, and `yarn.lock` removed). `post-demo` does not include it, and the files do not overlap. Integrating the two branches is the operator's call.
