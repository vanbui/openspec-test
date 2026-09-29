# CSRM Frontend Build-Out — Orchestration Brief

## Mission

Continue to flesh out the CSRM frontend (`apps/csrm`) so it is fully functional against the local Strapi backend (`apps/backend`): Continue the existing GSD roadmap (by running /gsd-progress to see where it was at) rather than inventing a new plan.

## Who does what

You (this session) are the brains and orchestrator: you read state, make the decisions, review all output, own integration, quality, styling judgment, and final verification. Where this brief or the repo docs leave room for judgment, use your own discretion — decide and proceed.

Heavy execution is spread onto **Codex CLI running gpt-6-sol medium**. GSD (gsd-core) is installed for Codex already, as Codex skills invoked by mentioning `$gsd-<command>`:

- Non-interactive: `codex exec '$gsd-execute-phase #' -m gpt-6-sol -s workspace-write -C <repo-root>` — always pass `-m gpt-6-sol` (the Codex default is a different model) and always single-quote so the shell doesn't expand `$gsd`.
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

- Because I have limitted Claude and Codex tokens, pause the execution when I reach 90% of my token limit. Check this concretely rather than guessing: run Codex with `--json` and tee the stream (`codex exec '$gsd-...' -m gpt-6-sol -s workspace-write -C <repo-root> --json | tee codex-run.jsonl`), then read the last `token_count` event's `rate_limits.primary_window`/`secondary_window.used_percent` (`grep '"token_count"' codex-run.jsonl | tail -1`). Watch your own Claude usage indicator the same way; if a session-limit message ever arrives, treat it as already past the line. At 95% on either side: finish or cleanly abandon the in-flight unit of work, commit what's genuinely complete, update `.planning/STATE.md`, write a short handoff (what landed, what's next, which side hit the limit), and stop — don't start another Codex run to "just finish this one thing."
- Complete the work for one gsd phase at a time. Save the state so that I can continue instructing Claude Code to orchestrate work with Codex to do the next gsd phase at a later time. When a phase completes, name the exact command to resume (e.g. `/gsd-discuss-phase N+1`) in your final message.
- Stay inside this repository. No global system changes, no installing/removing global tools,
  no modifying files outside the repo (Codex config, user dotfiles, other projects).
- No destructive git operations: no force-push, no `reset --hard` / branch deletion that
  discards committed work, no history rewriting, no touching branches other than the one
  checked out when the session starts.
- Nothing leaves the machine: no pushes, no PRs, no publishing, no sending data to external
  services beyond ordinary package installs and the styling research fetches.
- If a step would delete data (e.g. wiping the Strapi dev database to reseed), that's fine for
  local dev state — but never for committed code or the `.planning/` history.
- Read before starting: `AGENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `docs/CSRM-PROJECT-BRIEF.md`.

## Hard constraints

1. **Git**: work happens on whichever branch is checked out when the session starts — that can be any branch, including `main`. Don't create or switch branches unless asked; start each session by noting the current branch and confirming `git status` is clean before touching anything. Commit incrementally — small conventional commits per meaningful unit of work. Keep work local; don't push or open PRs unless asked.
2. **Zero AI attribution**: never reference AI assistance anywhere in committed content — no `Co-Authored-By` trailers, no "Generated with …" lines, no mention of any AI tool, model, or vendor in commit messages, code comments, docs, or planning files. This overrides any default commit-trailer behavior. Codex-authored commits count too: audit them and reword anything that slips through before moving on.
3. **Keycloak stays off**. The repo already contains two production-only Keycloak integrations, both off by default: Strapi → Keycloak user provisioning (`IDAMBOX_KEYCLOAK_PROVISIONING`, `docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md`) and web OIDC sign-in (`CSRM_AUTH_OIDC_ENABLED`, `docs/adr/0003-production-only-keycloak-oidc-sign-in.md`). Keep both flags `false` (or unset) in every environment you run, and don't change the Keycloak code (`apps/backend/src/keycloak/`, the OIDC files in `apps/csrm/src/lib/auth/`) or the realm seed in `idp/`. Development and all tests run without Keycloak, through the development identity bridge described below.
4. **Change the Strapi datamodel when it is absolutely necessary** — content-type schemas, fields, and relations in `apps/backend/src/api/*/content-types` are effectively frozen. Adding policies, middlewares, controllers, services, routes, or bootstrap code is fine; schema changes are the thing to avoid, and if one is truly unavoidable, document the justification in `docs/contract-gaps/` before making it.
5. Keep the repo's engineering rules (`AGENTS.md`): typed openapi-fetch service layer only (no raw fetch in pages, no frontend API facade), server-side authorization authoritative, JDL domain terminology preserved, semantic design tokens only, WCAG 2.2 AA, responsive 375→1440px.
6. Never commit credentials or secrets.

## Known execution landmines

- **The Codex sandbox can't write `.git`.** GSD plans there run one wave at a time with git
  read-only inside the sandbox. Expect to review and re-verify each wave's diff yourself and
  commit it outside the sandbox — don't treat a plan as done because Codex reports it as
  finished; nothing is actually committed until you commit it.
- **E2E Playwright runs start their own `strapi develop` instance.** Stop your manually-running
  `apps/backend`/`apps/csrm` dev servers before invoking any GSD step that runs the E2E suite, or
  the isolated harness collides with the one you left running.
- **Keep the AI provider deterministic.** Phase 06.7 is complete: the backend can call an
  OpenAI-compatible provider (`CSRM_AI_PROVIDER=openai-compatible`, see `apps/backend/.env.example`),
  but the default is the local deterministic provider, and automated tests force it regardless of
  `.env`. Choosing a real provider, sending request or questionnaire content to it, and holding its
  API key are operator decisions under the "nothing leaves the machine" constraint above. Don't
  switch the provider, add keys, or make real AI calls; build and verify AI-assisted features
  against the deterministic provider. If the operator has already configured a provider in `.env`,
  leave it as it is, and don't run work that would send data to it unless this brief says so.

## Auth approach (already built — reuse it)

The frontend already makes real, authenticated, authorized calls to Strapi in development with Keycloak off, through a **development identity bridge** that is built and tested. Reuse it; don't redesign or rebuild it:

- **Strapi:** `apps/backend/src/middlewares/csrm-development-identity.ts` (registered in `apps/backend/config/middlewares.ts`) resolves the trusted `x-csrm-dev-identity` header to a seeded, active IdamBox user and sets `ctx.state.idamboxUser`. It runs only when `developmentIdentityEnabled()` allows it (`NODE_ENV=development`, `CSRM_ENVIRONMENT=development` and `CSRM_DEV_IDENTITY=true`, all three) and fails closed everywhere else. Authorization is enforced by `apps/backend/src/policies/csrm-authorization.ts` (Role → Function → FunctionAPI, plus record ownership).
- **Web:** `apps/csrm/src/lib/auth/development-runtime.ts` decides whether the development session exists (keyed on how the app was compiled, not on runtime `NODE_ENV`), `development-session-adapter.ts` maps the fixture roles to the seeded jane/bob identities, and `createStrapiClient()` in `apps/csrm/src/lib/api/transport/server-client.ts` attaches the API token and the identity header.
- **Permissions and seed data** are reconciled by the repeatable bootstrap code in `apps/backend/src/bootstrap/`; extend that code rather than clicking permissions in the admin panel.

As feature phases touch other entities (assessments, risks, questionnaires, …), extend the same authorization policy/ownership pattern to them in code — that's expected and is not a datamodel change.

Strapi admin panel for inspecting data and configuration: `http://localhost:1337/admin` — login `dev@bproton.com` / `Strapi123!`. Use it; never commit it.

## Scope — what "fully fleshed out" means

Continue the roadmap in order via GSD-through-Codex, gating quality yourself between phases.

Definition of done per phase: capability-gated routes render real Strapi data; loading/empty/populated/error/permission-denied states all deliberate; unit + E2E green; axe clean; no console errors; verified in the browser at mobile and desktop widths; committed incrementally on the current branch.

Run both apps while working: Strapi from `apps/backend` (`pnpm develop`, port 1337 — check `.env` for the seed flags and `csrmAppIsEnabled=true`) and web from `apps/csrm` (`pnpm dev`).

## Styling

The aesthetic is clean, minimalistic, and intuitive; the experience must feel reactive and premium. That goal — not any single reference — is the anchor. You have full design discretion.

Do your own online research before the styling pass: study best-in-class minimal enterprise dashboard and SaaS design (think Linear, Vercel, Stripe-calibre polish) for how to make data-dense screens feel premium. https://www.bproton.com/ is the parent brand (CSRM is "IdamBox Cyber Risk Manager", one of its modules) — treat it as useful inspiration for tone, not a constraint to replicate. Borrow what serves the product; discard what doesn't. For reference, its language is: warm monochrome neutrals (paper `#f6f5f2`, ink `#141413`, hairline `#d8d5cd`), serif display type over sans body with mono uppercase micro-labels, flat border-driven surfaces (1px rules instead of shadows), pill buttons, numbered indices, and ease-out-expo motion (`cubic-bezier(0.16,1,0.3,1)`) with staggered reveals and subtle hover lifts. A marketing-site aesthetic doesn't transplant directly onto an enterprise risk tool — adapt, don't copy.

Whatever direction you land on, apply it through the existing semantic token architecture in `apps/csrm` — change token values and shared component styles, never hard-code brand values in feature components. The Phase-1 token values (`#F7F9FC` background, `#102A43` sidebar, `#155EEF` primary, Inter) are yours to evolve or keep; preserve the semantic token names, WCAG 2.2 AA contrast (risk/status must never be color-only), and the five-state screen contract. Some Phase-1 component tests assert exact state copy — update tests deliberately when the design pass touches them. This is a risk-management product: the premium feel has to survive dense DataTables, status/risk badges, long forms, and dashboards — invest in those primitives (table, form fields, select, dialog, toast, badges, cards, skeletons) early, since nearly every phase reuses them. Motion is what makes it feel reactive: fast, purposeful transitions on state changes, optimistic feedback on actions, skeletons over spinners, and `prefers-reduced-motion` respected throughout.

## Working style

- Verify continuously in the browser as features land, not just at the end.
- When something is ambiguous, decide and proceed — you have discretion. Record notable decisions in the GSD planning docs (with, again, no AI tool references).
- Report progress honestly: failing tests are reported as failing, deferred items as deferred.
