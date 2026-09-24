# CSRM Frontend Build-Out — Orchestration Brief

## Mission

Continue to flesh out the CSRM frontend (`apps/web`) so it is fully functional against the local Strapi backend (`apps/strapi`): Continue the existing GSD roadmap (by running /gsd-progress to see where it was at) rather than inventing a new plan.

## Who does what

You (this session) are the brains and orchestrator: you read state, make the decisions, review all output, own integration, quality, styling judgment, and final verification. Where this brief or the repo docs leave room for judgment, use your own discretion — decide and proceed.

Heavy execution is spread onto **Codex CLI running gpt-5.6-terra medium**. GSD (gsd-core) is installed for Codex already, as Codex skills invoked by mentioning `$gsd-<command>`:

- Non-interactive: `codex exec '$gsd-execute-phase #' -m gpt-5.6-terra -s workspace-write -C <repo-root>` — always pass `-m gpt-5.6-terra` (the Codex default is a different model) and always single-quote so the shell doesn't expand `$gsd`.
- Useful: `codex exec resume --last` to continue the previous Codex run; `-o <file>` to capture the final message; `--json` for an event stream.
- Core loop per phase: `$gsd-discuss-phase N` → `$gsd-plan-phase N` → `$gsd-execute-phase N`; `$gsd-progress` for status/routing; `$gsd-quick` for small cross-cutting chores; `$gsd-code-review <N>` after substantial phases. Project GSD config is yolo mode with auto-advance, so non-interactive runs mostly flow; if a run stalls waiting for input, resume it and answer, or make the call yourself and re-issue with explicit instructions.
- `.planning/` is plain markdown/JSON — read it directly, and update state docs yourself when acting as orchestrator.

Division of labor: delegate GSD planning/execution and bulk implementation to Codex; you review every diff, fix integration issues, run tests, drive the browser to verify UI, and personally own the styling/quality passes. Nothing ships on Codex's word alone.

## Autonomy

This session runs unattended with bypass permissions. There is no user to ask — never stop to
ask a question, confirm a choice, or wait for approval. Every roadblock, ambiguity, failure, or
trade-off is yours to resolve: pick the most reasonable option consistent with this brief and
the repo docs, record the decision (in the GSD planning docs or the commit message), and keep
working. If a chosen approach dead-ends, back out cleanly and take a different one. Only genuine
hard blockers (e.g. a required external service that cannot be run locally at all) justify
stopping, and then leave a clear written summary of state and what's needed.

Unattended guardrails (non-negotiable, because nothing will prompt for confirmation):

- Because I have limitted Claude and Codex tokens, pause the execution when I reach 90% of my token limit. Check this concretely rather than guessing: run Codex with `--json` and tee the stream (`codex exec '$gsd-...' -m gpt-5.6-terra -s workspace-write -C <repo-root> --json | tee codex-run.jsonl`), then read the last `token_count` event's `rate_limits.primary_window`/`secondary_window.used_percent` (`grep '"token_count"' codex-run.jsonl | tail -1`). Watch your own Claude usage indicator the same way; if a session-limit message ever arrives, treat it as already past the line. At 95% on either side: finish or cleanly abandon the in-flight unit of work, commit what's genuinely complete, update `.planning/STATE.md`, write a short handoff (what landed, what's next, which side hit the limit), and stop — don't start another Codex run to "just finish this one thing."
- Complete the work for one gsd phase at a time. Save the state so that I can continue instructing Claude Code to orchestrate work with Codex to do the next gsd phase at a later time. When a phase completes, name the exact command to resume (e.g. `/gsd-discuss-phase N+1`) in your final message.
- Stay inside this repository. No global system changes, no installing/removing global tools,
  no modifying files outside the repo (Codex config, user dotfiles, other projects).
- No destructive git operations: no force-push, no `reset --hard` / branch deletion that
  discards committed work, no history rewriting, no touching branches other than `dev`.
- Nothing leaves the machine: no pushes, no PRs, no publishing, no sending data to external
  services beyond ordinary package installs and the styling research fetches.
- If a step would delete data (e.g. wiping the Strapi dev database to reseed), that's fine for
  local dev state — but never for committed code or the `.planning/` history.
- Read before starting: `AGENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `docs/CSRM-PROJECT-BRIEF.md`.

## Hard constraints

1. **Git**: all work happens on branch `dev` (already created and tracking `origin/dev`; start each session by confirming `git status` is clean before touching anything). Commit incrementally — small conventional commits per meaningful unit of work. Keep work local; don't push or open PRs unless asked.
2. **Zero AI attribution**: never reference AI assistance anywhere in committed content — no `Co-Authored-By` trailers, no "Generated with …" lines, no mention of any AI tool, model, or vendor in commit messages, code comments, docs, or planning files. This overrides any default commit-trailer behavior. Codex-authored commits count too: audit them and reword anything that slips through before moving on.
3. **Keycloak stays disabled**. Do not enable, wire, or configure Keycloak in any form. Real OIDC is explicitly out of scope for this effort.
4. **Change the Strapi datamodel when it is absolutely necessary** — content-type schemas, fields, and relations in `apps/strapi/src/api/*/content-types` are effectively frozen. Adding policies, middlewares, controllers, services, routes, or bootstrap code is fine; schema changes are the thing to avoid, and if one is truly unavoidable, document the justification in `docs/contract-gaps/` before making it.
5. Keep the repo's engineering rules (`AGENTS.md`): typed openapi-fetch service layer only (no raw fetch in pages, no frontend API facade), server-side authorization authoritative, JDL domain terminology preserved, semantic design tokens only, WCAG 2.2 AA, responsive 375→1440px.
6. Never commit credentials or secrets.

## Known execution landmines

- **The Codex sandbox can't write `.git`.** GSD plans there run one wave at a time with git
  read-only inside the sandbox. Expect to review and re-verify each wave's diff yourself and
  commit it outside the sandbox — don't treat a plan as done because Codex reports it as
  finished; nothing is actually committed until you commit it.
- **E2E Playwright runs start their own `strapi develop` instance.** Stop your manually-running
  `apps/strapi`/`apps/web` dev servers before invoking any GSD step that runs the E2E suite, or
  the isolated harness collides with the one you left running.
- **Phase 06.7 conflicts with the "nothing leaves the machine" constraint above.** Per
  `.planning/STATE.md`, the current phase (real AI provider integration for questionnaire and
  assessment generation) requires sending request/questionnaire content to an external AI
  provider and holding an API key outside the repo — an operator decision the state file
  explicitly reserves for the user, not something to decide-and-proceed on. Don't attempt it,
  guess a provider, or wire in a real API call. Treat it as a standing hard-blocker exception and
  route around it: Phase 7 (Analyst Dashboard, Reports, and Alerts) is fully local, has no such
  conflict, and is already flagged in `.planning/STATE.md` as the phase to run instead until the
  operator unblocks 06.7.

## Auth approach (the pivotal integration decision)

The frontend must make real, authenticated, authorized calls to Strapi in development — with Keycloak off. Design the bridge at your discretion; a sound shape that mirrors the existing test harness: a **development-only Strapi identity middleware** that resolves a trusted header/cookie to a seeded idambox-user and sets `ctx.state.idamboxUser` (registered only in development, fail-closed everywhere else), plus extending the web dev session adapter so its fixture roles map to the seeded jane/bob identities and `createStrapiClient()` attaches the credential. You'll also need users-permissions content-api permissions enabled for the CSRM routes in the dev DB — prefer a repeatable bootstrap/script over manual clicks. As feature phases touch other entities (assessments, risks, questionnaires, …), extend the same authorization policy/ownership pattern to them in code — that's expected and is not a datamodel change.

Strapi admin panel for inspecting data and configuration: `http://localhost:1337/admin` — login `dev@bproton.com` / `Strapi123!`. Use it; never commit it.

## Scope — what "fully fleshed out" means

Continue the roadmap in order via GSD-through-Codex, gating quality yourself between phases.

Definition of done per phase: capability-gated routes render real Strapi data; loading/empty/populated/error/permission-denied states all deliberate; unit + E2E green; axe clean; no console errors; verified in the browser at mobile and desktop widths; committed incrementally on `dev`.

Run both apps while working: Strapi from `apps/strapi` (`npm run develop`, port 1337 — check `.env` for the seed flags and `csrmAppIsEnabled=true`) and web from `apps/web` (`pnpm dev`).

## Styling

The aesthetic is clean, minimalistic, and intuitive; the experience must feel reactive and premium. That goal — not any single reference — is the anchor. You have full design discretion.

Do your own online research before the styling pass: study best-in-class minimal enterprise dashboard and SaaS design (think Linear, Vercel, Stripe-calibre polish) for how to make data-dense screens feel premium. https://www.bproton.com/ is the parent brand (CSRM is "IdamBox Cyber Risk Manager", one of its modules) — treat it as useful inspiration for tone, not a constraint to replicate. Borrow what serves the product; discard what doesn't. For reference, its language is: warm monochrome neutrals (paper `#f6f5f2`, ink `#141413`, hairline `#d8d5cd`), serif display type over sans body with mono uppercase micro-labels, flat border-driven surfaces (1px rules instead of shadows), pill buttons, numbered indices, and ease-out-expo motion (`cubic-bezier(0.16,1,0.3,1)`) with staggered reveals and subtle hover lifts. A marketing-site aesthetic doesn't transplant directly onto an enterprise risk tool — adapt, don't copy.

Whatever direction you land on, apply it through the existing semantic token architecture in `apps/web` — change token values and shared component styles, never hard-code brand values in feature components. The Phase-1 token values (`#F7F9FC` background, `#102A43` sidebar, `#155EEF` primary, Inter) are yours to evolve or keep; preserve the semantic token names, WCAG 2.2 AA contrast (risk/status must never be color-only), and the five-state screen contract. Some Phase-1 component tests assert exact state copy — update tests deliberately when the design pass touches them. This is a risk-management product: the premium feel has to survive dense DataTables, status/risk badges, long forms, and dashboards — invest in those primitives (table, form fields, select, dialog, toast, badges, cards, skeletons) early, since nearly every phase reuses them. Motion is what makes it feel reactive: fast, purposeful transitions on state changes, optimistic feedback on actions, skeletons over spinners, and `prefers-reduced-motion` respected throughout.

## Working style

- Verify continuously in the browser as features land, not just at the end.
- When something is ambiguous, decide and proceed — you have discretion. Record notable decisions in the GSD planning docs (with, again, no AI tool references).
- Report progress honestly: failing tests are reported as failing, deferred items as deferred.
