# Phase 20: Oversight registers and post-release tracking - Research

**Researched:** 2026-10-01
**Domain:** Strapi 5.51.0 scheduling, the email plugin and its providers, portable SQL for the switched due rule and the released baseline, and the journey's final slice
**Confidence:** HIGH for the scheduler, the email plugin, the unique index, `ON CONFLICT` and the commit hook (each read in the installed source this session). MEDIUM for SQL that rests on the planned shapes of Phases 11, 16, 17.1 and 19.1 (cited from their plans and research, not yet code). LOW where marked `[ASSUMED]`.

**Scope (stage2-rules §3a).** This file answers only the CONTEXT's "Open for research" items and the extra questions the spawn prompt names: the scheduler and the start-up run under both harnesses; the email plugin with a capture provider and the official nodemailer provider; the SQL for the switched due rule and the released baseline; the history actor for system rows; and how the final slice completes `apps/csrm/e2e/risk-owner-journey.spec.ts`. It adds the Validation Architecture. Everything else is cited from earlier research and plans, not re-surveyed:
- **Phase 11:** plans 11-14, 11-15 and 11-17 (the released branch, the due-state rule and its consumers).
- **Phase 14:** `14-RESEARCH.md` and plans 14-03 and 14-04 (the configuration reader, the boot guard and the harness pins).
- **Phase 16:** `16-RESEARCH.md` and plans 16-02 and 16-03 (the history entity and writer).
- **Phases 17 to 19.1:** `17-RESEARCH.md` §L (the journey's structure); `17.1-RESEARCH.md` (decision rows, review dates, release and close); `18-RESEARCH.md` (unique indexes, saved views); 19.1's plans 19.1-02 and 19.1-03 with `19.1-RESEARCH.md` (the notification service).

## Summary

Strapi's scheduler is node-schedule behind `strapi.cron`, and three facts decide how Phase 20 uses it:
- **Config tasks are off by default.** `server.cron.enabled` defaults to `false`, so tasks declared in `config/server.ts` are ignored unless it is turned on.
- **Bootstrap tasks always schedule.** The cron provider calls `cron.start()` whatever that setting says, and the provider bootstrap runs *before* the application's `bootstrap()`. A task added with `strapi.cron.add` in `bootstrap()` is therefore scheduled immediately, regardless of `server.cron.enabled`.
- **The Strapi harness already removes every job.** It calls `strapi.cron.destroy()` right after `load()`.

So the daily run belongs in `bootstrap()`. It is added last, after every seed and after the start-up run, with `{ rule, tz: 'Etc/UTC' }` and a CSRM setting that can turn it off. Playwright turns the timer off and relies on the start-up run, which `bootstrap()` awaits before Strapi listens.

The email plugin creates its provider in its own `bootstrap()`, after the application's `register()`. That is why Phase 14's `register()`-time provider override cannot be copied:
- **Provider resolution.** The plugin resolves `@strapi/provider-email-<name>` and otherwise `require`s the lower-cased name as a module path, the same fragility 14-RESEARCH found for uploads.
- **The configured provider.** `config/plugins.ts` must therefore always name the official `nodemailer` provider. Production uses SMTP options. Development, tests and "not configured" use nodemailer's inert `jsonTransport`, so `sendmail` is never even loaded.
- **The capture provider.** In development and tests the application's `bootstrap()` then swaps in the in-repo capture provider. Sending stays on the plugin's `send` service.
- **Plain text.** The official provider sends `html: options.html ?? options.text`, which turns plain text into an HTML part. CSRM passes `html: ''` to keep the message plain text.
- **Sending after commit.** Mail goes out through Strapi's transaction `onCommit` hook, which runs once after the outermost commit.

**Idempotency without aborting transactions.** A `"unique": true` attribute creates no database index in Strapi 5.51 (18-RESEARCH). A real one needs `"column": { "unique": true }`. The delivery claim is then `INSERT … ON CONFLICT (reminder_key) DO NOTHING` (knex `onConflict().ignore()`), which never raises. It can therefore run inside a treatment act's transaction on PostgreSQL without aborting it. Nested `strapi.db.transaction` calls share the outer transaction with no savepoint, which is why a raising insert is not an option.

**The SQL.** The switched rule, progress, status and decision-review dates are portable SQL over `date` columns compared as `YYYY-MM-DD` strings, with one instant-bound branch for v1 exceptions. Every function has an oracle test.

**Primary recommendation:** plan the reminder run as one module, `apps/backend/src/csrm/reminders/run.ts`, with three callers: the start-up run (awaited in `bootstrap()` after the seeds), the daily task (`strapi.cron.add` with `tz: 'Etc/UTC'`), and the per-risk evaluation inside every act. It runs one transaction per subject: request lock, then risk lock, then status, then claim by `ON CONFLICT DO NOTHING`, then notify. Email goes out through the plugin after commit, under a compare-and-set claim.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Daily and start-up reminder run, stored status | API / Backend (Strapi bootstrap and `strapi.cron`) | Database (unique index, row locks) | D-26; no public operation |
| Delivery idempotency | Database (unique index, `ON CONFLICT DO NOTHING`) | API / Backend | D-27; works across processes |
| Email composition and sending | API / Backend (email plugin, capture or nodemailer provider) | — | D-28; the server words content at send time |
| Due rule, progress, status, review dates | API / Backend (`treatment-due-state.ts` and its SQL mirror) | Database | D-08, D-09, D-17: one rule, two forms, one oracle |
| Released baseline overlay | API / Backend (released readers) | Database (history rows) | D-06 |
| Journey slice | Browser (Playwright) | API (direct refusal probes through `strapi-api.ts`) | D-30; 17-RESEARCH §L |

<user_constraints>
## User Constraints (from 20-CONTEXT.md)

### Locked Decisions
D-01 to D-30 in `20-CONTEXT.md` are locked, with `<operator_decisions>`, `<contract_gaps>`, `<authorisation>` and `<seams>`. They are cited here by number and not restated (stage2-rules §3a). The decisions this research serves directly are D-06 (baseline), D-07 to D-09 (tracking, progress, the one rule), D-17 (review date), D-19 (history sources and actor), D-25 to D-28 (kinds, run, delivery, email) and D-30 (tests, journey).

### Open for research (verbatim from the CONTEXT)
- Strapi 5.51.0's scheduler: `config/server.ts` `cron` with a time zone, or `strapi.cron.add` in bootstrap. How the start-up run is ordered after the seeds. That two processes running it write nothing twice: the unique key inside a transaction, on SQLite and PostgreSQL.
- Wiring an in-repo email provider (as Phase 14 wires its local upload provider), the nodemailer provider's version pin, proving `sendmail` is never selected, and sending after commit.
- The SQL for "tracked treatment", on Phase 11's released branch of `applyDisclosableParent`, and for the decision review date with its fallback to the completing act, each against an oracle.
- The baseline overlay in one query per assessment, for the released reads, Phase 18's read-only table, and Phase 19's export and report.
- Whether Phase 16's history schema needs its actor made optional for the system source.

### Claude's Discretion (the CONTEXT's "Planner's Discretion", verbatim)
- Operation paths, Function names, reason codes, kinds, parts, history kinds and sources, setting names and envelope versions, within the families above.
- Module placement, for example:
  - Strapi: `apps/backend/src/csrm/treatment/` (the predicate and acts), `apps/backend/src/csrm/reminders/` (policy, rules, run), `apps/backend/src/csrm/email/` (content builder and capture provider), and new API folders for `csrm-treatment-evidence` and `csrm-reminder-delivery`;
  - web: `apps/csrm/src/features/my-risks/` and `features/treatment/`.
- Bounds (note, reason, rationale and statement lengths as proposed above), page and batch sizes, the retry bound, and the capture file's format.
- Whether the owner history is part of the owner risk read or a sibling read; whether reopen uses the close operation with a flag or its own path.
- How plans split, provided D-30's serialisation and order hold.

### Deferred Ideas (OUT OF SCOPE, verbatim)
- A decision after release (changing Accept to Treat or the reverse), and a re-assessment that supersedes a released assessment and records an assessment's re-review.
- Changing the risk owner or the executive approver after release, which joiner-mover-leaver cases will need. Until then, reminders to an inactive person are not sent, and the derived alerts show the work.
- The executive approver's approval of date or plan changes on High and Critical risks; granting an exception after a residual review raises a risk to Critical.
- Control owners recording delivery themselves; adding or removing control implementations after release.
- Escalation and alerts for overdue decision reviews; reminders for response rounds and unanswered contest points (not in G-18's list).
- Digests, notification preferences and further channels (NOTIFY-03); email for event kinds; a delivery report.
- Breakdowns by division and business unit, which wait for Phase 22's Admin lists.
- Persisted run history, which belongs with Phase 21's job history.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RISK-03 | Type, division and business unit as register columns, filters, saved views and report dimensions | Not an open research item. D-22 and D-23 rest on 18-RESEARCH (saved views) and Phase 11's register plans. The filters run after `applyDisclosableParent`, so they only narrow (11-15's threat T-11-36). |
| RISK-04 | Released risks track treatment to closure without reopening the assessment | §R5 to §R7 (rule, progress, status), §R9 (baseline overlay, released record unchanged), §R10 (history actor), Pitfall 2 (the run must write the baseline too) |
| RISK-05 | Owners see what they own | §R11 (the system actor and explicit recipients in 19.1's service); refusal order (Pitfall 7); the journey's Maya negatives (§R13) |
| RISK-06 | A recorded lifecycle to completion on evidence, Overdue by date | §R5 and §R6 (the switched rule and its oracle; Overdue in the run and in every act); §R1 and §R2 (the daily run and the start-up run) |
| ADMIN-06 | "Used in" panels and usage counts | Not an open research item. Phase 11 D-36's filter pattern; equal totals through the same register predicates (X-10). |
| NOTIFY-02 | Reminders in the app and by email | §R1 to §R4 and §R11 to §R12 (scheduler, idempotency, email plugin, keys, retries, the capture mailbox) |
</phase_requirements>

## Project Constraints (from AGENTS.md and the Stage 2 rules)

- Strapi stays the API boundary. The web calls Strapi only through `apps/csrm/src/lib/api` from server code and Server Actions; there is no frontend facade and no raw `fetch` in pages.
- Keycloak authenticates. Strapi enforces Role → Function → FunctionAPI and the record rule against the resolved IdamBox User in `ctx.state`, never branching on the auth mode. Navigation visibility is not security.
- Never flip `CSRM_AUTH_OIDC_ENABLED`, `CSRM_DEV_IDENTITY`, `IDAMBOX_KEYCLOAK_PROVISIONING` or `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION`. New settings go in `.example` files with safe defaults.
- AI never closes, decides or releases; no AI runs after release here.
- Every content-type change starts with its `docs/contract-gaps/phase-20-*.md` record and a stopping approval checkpoint (G-6). Contract changes update the specification, both catalogue copies and `served-operations.json`, then `api:generate` and `api:check`.
- No new dependency without a concrete reason, justified in the plan that adds it. This phase adds exactly one (§Standard Stack).
- Strapi integration tests for every grant and refusal; Vitest for logic and components; Playwright for the flows, leaving the tree clean.
- Never write the pre-rename app paths in any phase file.
- Do not touch `apps/backend/types/generated/*.d.ts` or `example-risk-assessment-questions/`.

## Standard Stack

### Core (installed; read this session)
| Library | Version | Purpose | Fact relied on |
|---------|---------|---------|----------------|
| `@strapi/core` (through `@strapi/strapi`) | 5.51.0 | `strapi.cron`, lifecycle order, `strapi.db.transaction` with `onCommit` | [VERIFIED: `@strapi/core/dist/providers/cron.js:10-16`, `services/cron.js:18-55`, `Strapi.js:334-402`] |
| `node-schedule` | 2.1.1 (Strapi's) | Cron rule with `tz` | [VERIFIED: `node-schedule/lib/Job.js:178-274`] |
| `@strapi/email` | 5.51.0 (an internal plugin, always loaded) | `strapi.plugin('email').service('email').send` | [VERIFIED: `@strapi/core/dist/loaders/plugins/get-enabled-plugins.js:19-23`; `@strapi/email/dist/server/bootstrap.js:3-34`] |
| `@strapi/database` | 5.51.0 | Unique index only from `attribute.column.unique`; nested transactions share one transaction | [VERIFIED: `schema/schema.js:19-31, 94-104`; `index.js:60-97`] |
| `knex` | 3.0.1 (Strapi's) | `onConflict(col).ignore()` emits `on conflict (col) do nothing` on SQLite and PostgreSQL | [VERIFIED: `knex/lib/dialects/sqlite3/query/sqlite-querycompiler.js:94-95,169-173`; `postgres/query/pg-querycompiler.js:34,149-153`] |

### Added (one dependency, the reason G-7)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@strapi/provider-email-nodemailer` | **5.51.0** (exact, the Strapi version) | SMTP in production; the inert `jsonTransport` everywhere else | G-7 names it. The installed `@strapi/email` 5.51.0 itself recommends it over `sendmail` [VERIFIED: `@strapi/email/dist/server/bootstrap.js:32`]. Its only dependency is `nodemailer: 9.0.1` (exact) [VERIFIED: npm registry, `npm view @strapi/provider-email-nodemailer@5.51.0 dependencies`]. |

**Installation (Strapi only):** `pnpm --dir apps/backend add @strapi/provider-email-nodemailer@5.51.0 --save-exact`. It resolves for the plugin through pnpm's hoisted `node_modules/.pnpm/node_modules/@strapi/`, as 14-RESEARCH found for `@strapi/provider-upload-aws-s3` [CITED: 14-RESEARCH.md line 482].

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `strapi.cron.add` in `bootstrap()` | `config/server.ts` `cron: { enabled: true, tasks }` | The config route schedules in the provider bootstrap, *before* the seeds and the start-up run. It also needs `server.cron.enabled` flipped globally, and its tasks would have to import application code into config. It is documented [CITED: docs.strapi.io/cms/configurations/cron], but the ordering is worse. |
| The capture provider swapped in at `bootstrap()` | A provider configured by module path | Lower-cased path resolution breaks on case-sensitive filesystems (14-RESEARCH line 481). Rejected. |
| A capture provider built on nodemailer's `streamTransport` writing `.eml` | A JSON capture file | `.eml` bodies are quoted-printable (`’` in the copy), so tests would need a decoder. Use JSON for the capture mailbox, and prove the production MIME once in a unit test through the official provider's `streamTransport` (§R4). |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@strapi/provider-email-nodemailer` | npm | Package created 2021-07-30; pinned 5.51.0 published 2026-07-23 (the same day as `@strapi/strapi` 5.51.0) | 40,400 a week | github.com/strapi/strapi (`packages/providers/email-nodemailer`) | **SUS** (seam reason `too-new`: the *latest* tag, 5.56.0, was published on 2026-09-30) | Flagged. The planner adds a `checkpoint:human-verify` before the install. Evidence for approval: the official Strapi monorepo, the pin is two months old, no `postinstall` script [VERIFIED: `npm view … scripts.postinstall` empty], and G-7 names it. |
| `nodemailer` (transitive, 9.0.1 exact) | npm | Created 2011; 9.0.1 published 2026-06-17 | — | github.com/nodemailer/nodemailer | not separately checked by the seam | Transitive only. MIT-0, no `postinstall` [VERIFIED: npm registry]. CSRM code never imports it directly (§R4). |

**Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** `@strapi/provider-email-nodemailer` (the latest-tag age only).

## Settled Research Items

### R1. The scheduler (D-26)

**Facts [VERIFIED: installed source]:**
- Default `server.cron = { enabled: false }` (`@strapi/core/dist/configuration/index.js:29-31`).
- The cron provider's bootstrap: `if (strapi.config.get('server.cron.enabled', true)) { …add(config tasks) }` then **`strapi.get('cron').start()` unconditionally** (`providers/cron.js:10-16`).
- `Strapi.bootstrap()` runs the plugins' bootstrap, then the providers' bootstrap, then the application's `bootstrap()` (`Strapi.js:400-404`).
- `cron.add` schedules at once when `running` is true (`services/cron.js:50-52`). So `strapi.cron.add` in the application's `bootstrap()` schedules immediately, whatever `server.cron.enabled` says.
- The task receives `{ strapi }` (`services/cron.js:37-39`). Its errors go to `strapi.log.error` through the job's `error` event.
- Options `{ rule, tz }` are passed to node-schedule's `Job.schedule`, which honours `tz` (`node-schedule/lib/Job.js:187-194`). Without `tz`, the host's local time applies.
- **An invalid rule is not refused.** `Job.schedule` falls back to `new Date(spec)` (a valid date string becomes a *one-time* job) and otherwise returns `false`, which Strapi ignores (`Job.js:216-232`; `services/cron.js:51`).
- The Strapi harness destroys every job right after `load()` (`apps/backend/tests/helpers/strapi-http-harness.ts:479-483`, comment: "a job firing then crashes the whole test process").

**Recommendation:**
- **The setting:** `CSRM_REMINDER_SCHEDULE`, a five-field cron expression, default `5 0 * * *` (D-26), or `off`. It is read by `readReminderSchedule(env)` in `apps/backend/src/csrm/reminders/reminder-schedule.ts`, validated against a closed pattern (five fields of digits, `*`, `,`, `-` and `/`). An invalid value fails boot with the variable's name (Phase 14 D-15's posture). The time zone is fixed in code to `Etc/UTC`, because the rule's "today" is the UTC date (`utc-date.ts`).
- **Registration:** in `bootstrap()`, after the start-up run, `strapi.cron.add({ csrmReminderRun: { task: ({ strapi }) => runReminders(strapi, { now: new Date(), trigger: 'daily' }), options: { rule, tz: 'Etc/UTC' } } })`. The object format is used so the job has a name and can be removed [CITED: docs.strapi.io/cms/configurations/cron]. Then it asserts that the job's `nextInvocation()` is not null (`Job.js:159`), failing boot otherwise.
- **The other settings:** the reminder *policy* (lead, repeat interval, waiting threshold) stays in code with no environment variable (D-26). The schedule is the "configured time" D-26 names.
- **Harnesses:**
  - **Strapi harness:** the existing `cron.destroy()` already removes the job. Pin `CSRM_REMINDER_SCHEDULE=off` before `load()` anyway, for clarity, and add it to the restored-variable list. Tests call `runReminders(strapi, { now })`, loaded from `dist`, as the harness already loads other modules (14-04's `attachmentStorage()` pattern).
  - **Playwright:** `CSRM_REMINDER_SCHEDULE: 'off'` in the Strapi `webServer.env`. A run spanning 00:05 UTC (10:05 or 11:05 in Sydney) would otherwise fire a second evaluation under a new "today" mid-suite. The start-up run covers SC5 (D-26).

### R2. The start-up run and its ordering

- **Where:** call `runReminders(strapi, { now: new Date(), trigger: 'startup' })` as the **last awaited statement** of `bootstrap()` in `apps/backend/src/index.ts`, after `seedDevelopmentApiToken` [VERIFIED: index.ts:28-43 shows the seed order]. The SC5 fixtures (§Validation) are reconciled by a seed earlier in the same `bootstrap()`, so the run sees them.
- **Why awaited:** `Strapi.start()` runs `load()` (which includes `bootstrap()`) before `listen()` (`Strapi.js:200-206, 316-320`). Playwright waits for `/_health` (`playwright.config.ts:216`), so every start-up reminder exists before the first test.
- **Bounded:** the evaluation (statuses, deliveries, notifications) is awaited. The SMTP sends are not: they are queued after commit (§R4), so a slow relay never delays boot. Catch and log any run failure as one structured line, and never stop the boot because of it.
- **In the Strapi harness** the start-up run runs during `load()` with `IDAMBOX_SEED_CSRM=false` [VERIFIED: harness:445], over an empty database, and does nothing.

### R3. Two processes write nothing twice (D-27)

- **A real unique index.** `"unique": true` on an attribute is validator-only: a `SELECT` before insert, with no index (18-RESEARCH lines 53, 187-188). Declare `reminderKey` with **`"column": { "unique": true }`**, which `createColumn` copies onto the column and `createTable` turns into a unique index named by `getUniqueIndexName` [VERIFIED: `@strapi/database/dist/schema/schema.js:19-31, 94-104`; content-type attributes pass through unchanged, `@strapi/core/dist/utils/transform-content-types-to-models.js:189-193`]. Keep `"unique": true` off this attribute, so no validator `SELECT` races the index.
- **The claim never raises.** Nested `strapi.db.transaction` reuses the outer transaction with **no savepoint** [VERIFIED: `@strapi/database/dist/index.js:60-62`]. A unique violation inside a treatment act's transaction would therefore abort the whole act on PostgreSQL (18-RESEARCH line 194 explains why SQLite would hide this). So claim with `INSERT … ON CONFLICT (reminder_key) DO NOTHING RETURNING id`:
  - **The statement:** `strapi.db.connection('csrm_reminder_deliveries').insert(row).onConflict('reminder_key').ignore().returning('id').transacting(trx)`. knex emits `on conflict ("reminder_key") do nothing` on both dialects [VERIFIED: knex 3.0.1 compilers above].
  - **Empty result:** the key exists, so write nothing more.
  - **One row back:** write the notification through 19.1's service, then link it with `strapi.db.query(DELIVERY_UID).update({ where: { id }, data: { notification: … } })`, so the query engine owns the link table.
- **The raw insert's columns.** It bypasses the Document Service, so it sets:
  - `document_id` (any unique string, for example `randomUUID()`);
  - `created_at`, `updated_at` and `published_at` as `Date` objects (19.1-RESEARCH Pitfall 3: SQLite stores datetimes as epoch milliseconds);
  - `reminder_key`, `kind` and the status fields.

  It must call `.transacting(trx)`: SQLite's pool of one hangs about 60 s otherwise (19.1-RESEARCH Pitfall 1). A unit test asserts that the column names exist in `strapi.db.metadata` (17-RESEARCH Pitfall 5).
- **The order of locks inside one subject's transaction:**
  1. Request row lock (`forUpdate`, 13's shape).
  2. Risk row lock.
  3. Re-read and derive.
  4. Baseline if needed (§R9).
  5. Status and history.
  6. Claims and notifications.
  7. `onCommit` sends.

  The request lock comes first, always, as every acceptance and assignment path does (17-RESEARCH Pitfall 8), because 19.1's `notify` takes the request lock itself for assigned-analyst recipients (19.1-03-PLAN line 102).
- **On PostgreSQL** two runs serialise per risk on the locks, and the index makes the claim exactly-once. **On SQLite** one writer at a time gives the same result. PostgreSQL is not exercised by any suite (R-08-37), so the plan adds the `ON CONFLICT` and `RETURNING` constructs to R-08-37's checklist.

### R4. The email plugin, the capture provider and sending after commit (D-28)

**Facts [VERIFIED: installed `@strapi/email` 5.51.0]:**
- The default configuration is `provider: 'sendmail'`, `defaultFrom: 'Strapi <no-reply@strapi.io>'` (`dist/server/config.js:3-10`).
- **Provider creation:** the plugin's `bootstrap()` calls `createProvider(emailConfig)`. It `require.resolve`s `@strapi/provider-email-${name.toLowerCase()}` and, when that is missing, `require`s the lower-cased name itself. It then calls `provider.init(providerOptions, settings)` and assigns `strapi.plugin('email').provider` (`dist/server/bootstrap.js:3-34`). Only the named provider is ever loaded.
- `service('email').send(options)` is `strapi.plugin('email').provider.send(options)` (`services/email.js:28`).
- `sendmail` delivers by **direct SMTP to the recipient's MX** (`@strapi/provider-email-sendmail/dist/index.js:24`, `sendDirectSmtp`). That is why it must never be loaded.

**Facts [VERIFIED: the packed `@strapi/provider-email-nodemailer@5.51.0` `dist/index.js`]:**
- `init(providerOptions, settings)` calls `nodemailer.createTransport(providerOptions)`. `send` maps `from ?? settings.defaultFrom`, then **`text: options.text ?? options.html, html: options.html ?? options.text`**, and returns `transporter.sendMail(message)`.
- Nodemailer's mail composer adds an HTML part only `if (this.mail.html)` (`nodemailer@9.1.1/lib/mail-composer/index.js:318`, the installed sibling of the pinned 9.0.1). So **`html: ''` yields a single `text/plain` message**. Leaving `html` out would put the plain text into an HTML part.
- SMTP defaults are a 2-minute connection timeout, a 30 s greeting timeout and a 10-minute socket timeout (`nodemailer@9.1.1/lib/smtp-connection/index.js:14-16`). Bound them.

**Recommendation:**
1. **`apps/backend/src/csrm/email/email-config.ts`**, a pure reader copied from 14-03's `attachment-config.ts`. `readEmailConfig(env, { appRoot }) → { mode: 'capture' | 'smtp' | 'none', captureDir, from, smtp, webOrigin, available, unavailableReason }`.
   - **Under Phase 14 D-12's double key** (`NODE_ENV` and `CSRM_ENVIRONMENT` both `development`): an unset `CSRM_EMAIL_PROVIDER` means `capture` at `.tmp/mail`.
   - **Elsewhere, unset:** `none`, `available: false`, reason `not-configured`.
   - **Elsewhere, `capture`:** fails boot.
   - **Invalid values fail boot,** naming the variable: a provider other than `capture` or `smtp`; `smtp` without a host or sender; a port outside 1 to 65,535; a capture directory inside `public/`; a web origin that is not an origin, or not `https:` outside development.
2. **`config/plugins.ts`** imports a pure `emailPluginConfig(readEmailConfig(env))`. Precedent: `config/middlewares.ts` already imports from `../src/utils/cors-allowed-origins` [VERIFIED: config/middlewares.ts:3]. It **always returns `provider: 'nodemailer'`**:
   - **`smtp`:** `{ host, port, secure, requireTLS: !secure, auth (when a user is set), connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000 }` with `settings: { defaultFrom: from }`.
   - **`capture` and `none`:** `{ jsonTransport: true }`, nodemailer's inert transport, so nothing can leave the machine even before the swap.
3. **`apps/backend/src/csrm/email/capture-provider.ts`:** `createCaptureProvider(dir)` returns `{ send(options), csrmCapture: true }`. It writes one JSON file per message (`{ schemaVersion: 1, capturedAt, to, from, subject, text, html }`) with an exclusive create (`flag: 'wx'`) and a name from the time and a random id. In `bootstrap()`, before the start-up run and only when the mode is `capture`, assign `strapi.plugin('email').provider = createCaptureProvider(dir)`. This runs after the plugin's own bootstrap, so the assignment sticks.
4. **The proofs that `sendmail` is never used:**
   - a unit test of `emailPluginConfig` over every mode and every invalid environment, asserting `provider === 'nodemailer'` and never `'sendmail'`;
   - an integration test after boot asserting `strapi.config.get('plugin::email').provider === 'nodemailer'` and `strapi.plugin('email').provider.csrmCapture === true`;
   - a static check that no file under `apps/backend/config` or `src` contains `'sendmail'` except that test.
5. **The production composition, proven once:** a unit test calls the official provider's `init({ streamTransport: true, buffer: true, newline: 'unix' }, { defaultFrom })` and sends the content builder's output with `html: ''`. It asserts that `info.message` has `Content-Type: text/plain; charset=utf-8` and no `text/html` part. The installed `stream-transport` buffers the message into `info.message` (`nodemailer@9.1.1/lib/stream-transport/index.js:89-120`).
6. **Sending after commit:** inside the subject's `strapi.db.transaction(async ({ trx, onCommit }) => …)`, register `onCommit(() => void sender.flush(deliveryIds).catch(logSendFailure))`. Strapi runs commit callbacks once, after the outermost commit, and runs none on rollback [VERIFIED: `@strapi/database/dist/transaction-context.js:16-60`]. The callback is called synchronously and not awaited, so it must catch its own errors.
   - **Track in-flight sends:** keep in-flight sends in a set. An application `destroy()` lifecycle awaits them, which Strapi runs on shutdown (`Strapi.js:420-428`). Integration tests await `sender.drain()` before reading the capture directory.
7. **The send claim (no double send across processes).** A compare-and-set `UPDATE csrm_reminder_deliveries SET attempts = attempts + 1, last_attempt_at = :now WHERE id = :id AND email_status IN ('pending','failed') AND attempts < :max AND (last_attempt_at IS NULL OR last_attempt_at < :leaseStart)`. One affected row means this process sends. Then it writes `sent` with the send time, or `failed` with a sanitised code (the nodemailer error `code` such as `ECONNECTION` or `EAUTH`, never the message).
   - **Bounds (recommended):** at most 3 attempts and a 15-minute lease. Retries run in any later run: the per-act evaluation's flush, the daily run and the start-up run.
   - **Before each send,** re-check readability and that the reminder still applies (D-25: readability at send time). Otherwise record `skipped` with a closed reason:
     - `no-address`, `not-configured` (D-27);
     - `not-readable`, `superseded` (both recommended).
8. **Settings in `apps/backend/.env.example`** (names proposed; commented, safe defaults; nothing set uncommented):
   ```
   # Reminder email (Phase 20, D-28). In development the default is a capture
   # mailbox under .tmp/mail: nothing leaves the machine. Outside development,
   # leave CSRM_EMAIL_PROVIDER unset to run without email (in-app reminders
   # still arrive), or set smtp with the block below.
   # CSRM_EMAIL_PROVIDER=capture
   # CSRM_EMAIL_CAPTURE_DIR=.tmp/mail
   # CSRM_EMAIL_FROM=CSRM <no-reply@csrm.localhost>
   # CSRM_WEB_PUBLIC_ORIGIN=http://localhost:3000
   # CSRM_REMINDER_SCHEDULE=5 0 * * *
   #
   # Production (deployment configuration; organisation relay or Amazon SES in
   # ap-southeast-2, sender domain aligned with SPF, DKIM and DMARC):
   # CSRM_EMAIL_PROVIDER=smtp
   # CSRM_EMAIL_FROM=CSRM <csrm-noreply@example.org>
   # CSRM_EMAIL_SMTP_HOST=email-smtp.ap-southeast-2.amazonaws.com
   # CSRM_EMAIL_SMTP_PORT=587
   # CSRM_EMAIL_SMTP_SECURE=false
   # CSRM_EMAIL_SMTP_USER=
   # CSRM_EMAIL_SMTP_PASSWORD=
   # CSRM_WEB_PUBLIC_ORIGIN=https://csrm.example.org
   ```
   The SES SMTP endpoint name is `[ASSUMED]` (the operator confirms it). The password comes from a secret store and is never committed.
9. **The harness pins** (the 14-04 pattern):
   - **The Strapi harness** sets `CSRM_EMAIL_PROVIDER=capture`, a per-process `CSRM_EMAIL_CAPTURE_DIR` under `.tmp/authorization-http/mail-{pid}` (removed on close), `CSRM_EMAIL_FROM`, `CSRM_WEB_PUBLIC_ORIGIN=http://127.0.0.1:3000` and `CSRM_REMINDER_SCHEDULE=off`, all **before `load()`**, and adds them to the restored list.
   - **Playwright** sets `CSRM_EMAIL_CAPTURE_DIR: join(e2eRuntimeRoot, 'mail')` in the Strapi `webServer.env`, outside the repository, so the tree stays clean. It exports `process.env.CSRM_E2E_MAIL_CAPTURE_DIR ??= …`, the `??=` pattern that keeps the runner's value in workers [VERIFIED: playwright.config.ts:89-101].

### R5. The switched due rule (D-07, D-09) and its SQL

The plan follows the planned shape of 11-15 (`TREATMENT_DUE_DATE_COLUMN = "r.target_date"`, `applyTreatmentDueStatePredicate(query, state, { today, windowDays })`, outer alias `r`) [CITED: 11-15-PLAN.md line 95] and today's function [VERIFIED: treatment-due-state.ts:14-69, quoted below].

Today's vocabulary, verbatim: `"overdue", "due-soon", "later", "no-target-date", "complete-or-closed"` (treatment-due-state.ts:14-20). Phase 20 adds `not-tracked` (D-09; name settled here).

Stored values relied on, verbatim [VERIFIED: csrm-risk schema.json:114-161]:
- `targetDate`, `closureDate` and `treatmentResolveDate` are `"type": "date"`;
- `exemptionReviewDate` is `"type": "datetime"`;
- `treatmentAction` is `"enum": ["Accept", "Treat"]`;
- `treatmentStatus` is `"enum": ["Not Started", "In Progress", "Overdue", "Complete"]`.

**One reading the planner must apply (Open Question 1):** D-07 defines a *tracked* treatment as open, while D-09's order puts `complete-or-closed` (which includes "the risk closed") after `not-tracked`. Read literally, a closed treated risk would be `not-tracked` and never `complete-or-closed`. Recommendation: the rule's **applicability** is released ∧ `Treat` ∧ not withdrawn, open *or* closed; closure then yields `complete-or-closed`. "Tracked" (open) stays the act and reminder gate. This keeps Phase 11's `complete-or-closed` counts meaningful and changes no figure for open risks.

**Facts the function takes** (every key required, the module's existing discipline):
`{ released: boolean; treatmentAction; withdrawnAt; closureDate; treatmentProgress; treatmentStatus; treatmentResolveDate; targetDate }`. `released` comes from 11-14's `stage === 'released'` projection.

**Order (D-09):**
1. `not-tracked`: not released, or not `Treat`, or withdrawn.
2. `complete-or-closed`: closed, or effective progress `Complete`.
3. `no-target-date`: no governing date.
4. `overdue`: the governing date is before today.
5. `due-soon`: the governing date is on or before today plus the window (14 days, Phase 11 D-38).
6. `later`.

**The SQL mirror** (portable; `date` columns compared with `YYYY-MM-DD` bound strings, as today):
```sql
-- applicability (the released branch is 11-14's applyReleasedParent, one whereExists)
EXISTS (released parent)  AND r.treatment_action = 'Treat' AND r.withdrawn_at IS NULL
-- effective progress (D-07's default for earlier releases)
COALESCE(r.treatment_progress,
  CASE WHEN r.treatment_status IN ('Not Started','In Progress','Complete')
       THEN r.treatment_status ELSE 'Not Started' END)
-- governing date (G-16)
COALESCE(r.treatment_resolve_date, r.target_date)
```
- **`TREATMENT_DUE_DATE_COLUMN`** becomes the expression `COALESCE(r.treatment_resolve_date, r.target_date)`, used through `whereRaw` with bound `today` and the window end. Alerts that select it as a governing date (11-17) take it through `connection.raw`.
- **`not-tracked`** is `NOT (applicability)`. Every other state starts from the applicability conjunct.
- **Withdrawal:** `r.withdrawn_at` is Phase 16's column [CITED: 16-03-PLAN.md line 105]. Released risks are never withdrawn (16 D-22), so the conjunct is defensive and costs nothing.
- **Who calls it:** the register filter, the analyst Home, alerts, the treatment-performance report, the owner list, reminders and exports. The register's existing `treatmentStatus` filter (risk-register.ts:342 today reads the column) moves to the derived status (§R6).

**The oracle (D-09's parity test).** Fixtures span:
- the stage: released, under assessment, and a partly released assessment;
- the action: `Treat`, `Accept`, null;
- closure: open, closed;
- progress: null with each stored status, `Not Started`, `In Progress`, `Complete`;
- the resolve date: null, yesterday, today, today+7, today+14, today+15;
- the target date: null, past, with the resolve date null.

For each `dueState` value, the filtered ids must equal exactly the fixtures whose `deriveTreatmentDueState(facts, today)` gives that state, with equal totals. This extends 11-15's integration test [CITED: 11-15-PLAN.md line 140].

### R6. Progress and the derived status (D-07, D-08)

- **The function:** `deriveTreatmentStatus(facts, today)` returns the derived value for an applicable risk:
  - `Complete` when effective progress is `Complete`;
  - `Overdue` when it is open, not complete, and the governing date is before today;
  - effective progress otherwise.

  For a non-applicable risk the stored value reads as is: the pre-release recommendation, or null on an accepted risk.
- **The SQL mirror** is one `CASE` over the §R5 fragments, exported beside the due predicate as `applyTreatmentStatusPredicate(query, status, { today })` for the register's `treatmentStatus` filter and the owner list's status filter.
- **Phase 7's untreated rule** (`critical-residual-risk-untreated`) reads effective progress (`'Not Started'`), never the stored `Overdue` (D-08).
- **The run's write set:** applicable, open risks where the stored status differs from the derived one. That is `r.treatment_status IS DISTINCT FROM <derived>`, written portably as `(r.treatment_status IS NULL OR r.treatment_status <> <derived>)`. Batches of 200 ids are selected outside any transaction, then each risk runs in its own transaction, which re-derives under the locks before writing.

### R7. The decision review date and state (D-17)

- **Inputs** (17.1-RESEARCH "Content-Type Shapes" [CITED]): `CsrmRiskDecision` with `reviewDate` (`date`, "only on the act that completes the authority"), `recordedAt` (datetime), and the unidirectional `risk` relation. Rows are never updated; a revision or a void adds a row.
- **The function `decisionReviewDate(facts)`:**
  - `decisionReviewDate` if set;
  - otherwise the latest completing act's `reviewDate` for the risk (the row with a non-null `reviewDate`, latest `recordedAt` then `id`);
  - otherwise, for a v1 exception only (`isExempted` with `exemptionReviewDate` and no decision rows), the UTC date of `exemptionReviewDate`.

  The latest completing act is the standing one after release, because a round completes only with every risk `decided` and later acts append rows [ASSUMED from 17.1's record semantics; the oracle pins it]. For exceptions under 17.1, the completing act's `reviewDate` already equals the exemption's UTC date (17.1 D-43; `utcDateToInstant`), so no datetime branch is needed for them.
- **The SQL mirror, portable:**
  ```sql
  COALESCE(r.decision_review_date,
    (SELECT d.review_date FROM csrm_risk_decisions d
       JOIN <risk link table> dl ON dl.<decision fk> = d.id
      WHERE dl.<risk fk> = r.id AND d.review_date IS NOT NULL
      ORDER BY d.recorded_at DESC, d.id DESC LIMIT 1))
  ```
  - **Link-table names** are resolved from `strapi.db.metadata.get(DECISION_UID).attributes.risk.joinTable`, never hand-written (17-RESEARCH Pitfall 5).
  - **The v1-exception branch** never converts a datetime to a date in SQL, because SQLite stores datetimes as epoch milliseconds (19.1-RESEARCH Pitfall 3). It compares instants instead: "due on or before day D" is `r.exemption_review_date < :instant(D + 1)`, with `utcDateToInstant(addUtcDays(D, 1))` bound as a `Date`.
- **Applicability:** released ∧ open ∧ (`treatment_action = 'Accept'` ∨ `is_exempted`) ∧ a review date exists.
- **The state vocabulary** (proposed, closed): `not-applicable`, `not-confirmed` (`decisionReviewOutcome = 'not-confirmed'`), `overdue` (date < today), `due` (date = today), `due-soon` (within the 7-day lead), `later`. D-23's filter values are `due-soon`, `overdue` and `not-confirmed`.
- **The window:** a review opens 7 days before its date (`REVIEW_NOT_DUE` earlier). The 7 days are read from the reminder-policy point, not inlined.
- **On "Confirm":** write `decisionReviewDate = addUtcMonths(utcToday(now), reviewIntervalMonths(rating))` (17.1's `risk-scale.ts` functions). For an exception, also `exemptionReviewDate = utcDateToInstant(that date)`, so the two stay equal.
- **The oracle:** fixtures with each source (column set, an act with a date, two acts where the later supersedes, a void row, a v1 exception, none) at each state; the SQL membership must equal the function.

### R8. "Decision waiting" (D-25)

- **Grouping:** the UI-SPEC's email is per assessment ("`CSRM: decision waiting - {assessment number}`", "A decision in CSRM has waited for you for {d} days" [VERIFIED: 20-UI-SPEC.md §14]). The reminder therefore groups per **open acceptance round × recipient**, not per risk.
- **Since when:** a risk's act became pending at the later of the round's `openedAt` and the latest decision row for that risk in that round (for example, the owner's proposal that now awaits the executive). The group's "waited since" is the earliest pending time among the recipient's risks in that round [ASSUMED on 17.1's `acceptanceState` (`awaiting-owner`, `awaiting-executive`) and the round's `openedAt` and `closedAt`, which 17.1-RESEARCH lines 546-548 and 17's rounds define].
- **The recipient:** `awaiting-owner` goes to the risk owner, and `awaiting-executive` to the executive approver.
- **The period:** first at more than 7 days, then every 7 days: `n = floor((days − 8) / 7)` for `days ≥ 8`. Datetimes compare with bound `Date` instants.

### R9. The released baseline and its overlay (D-06)

- **Writing it.** A `withReleasedRiskMutation({ strapi, riskDocumentId, actor, source, mutate })` wrapper: `strapi.db.transaction`, then the request lock, the risk lock, a load, `ensureReleaseBaseline` and `mutate`. `ensureReleaseBaseline` writes a `release-baseline` history row only when none exists for the risk. That check is safe because the risk lock serialises writers, and SQLite has one writer.
  - **One field list:** the payload holds every D-05 changeable field, from one exported constant `RELEASE_TRACKED_RISK_FIELDS`, and each control implementation's delivery facts (`controlStatus`, `implementedDate`, `effectivenessRating`, `evidence`, `reviewDate` [VERIFIED: csrm-control-implementation schema.json attributes]).
  - **The same list is every post-release writer's allowlist,** so a unit test proves that writers ⊆ baseline: the baseline is complete by construction.
  - **The daily run uses the wrapper too** (Pitfall 2).
- **Its envelope.** Phase 16's `changes` parser is closed to `{ schemaVersion: 1, fields: [...] }` [CITED: 16-02-PLAN.md line 123]. The amendment adds a kind-specific envelope for `release-baseline`, `{ schemaVersion: 1, baseline: { risk: {…}, controlImplementations: [{ documentId, … }] } }`, parsed by `parseReleaseBaseline` (null on any deviation, the 06.8 posture). Relation values are stored as `{ documentId, label }` captured at release, as 16 records relations.
- **Reading it, one query per assessment.**
  - **The read:** `strapi.db.query(HISTORY_UID).findMany({ where: { kind: 'release-baseline', assessment: { documentId } }, select: ['changes'], populate: { risk: { select: ['documentId'] } } })`. The history row carries the `assessment` relation (16-RESEARCH line 401), so the cost is O(1) queries per assessment, never per risk.
  - **The overlay:** a map from the risk's `documentId` to its baseline, applied by a pure `overlayReleaseBaseline(liveRisk, baseline)` in each released projection: the participant and analyst released views (`assessment-scope.ts`, including `RISK_DETAIL_FIELDS` [VERIFIED: assessment-scope.ts:255-262]), Phase 18's read-only table, and Phase 19's export and A4 report. Control implementations overlay by `documentId`.
  - **Malformed or missing baseline:** the live value, logged once (fail safe to "unchanged since release", which is true when no post-release write happened).
- **Fields the overlay must also hide.** Phase 20's new columns (`treatmentProgress`, completion, closure, review facts) are null at release. The released projections must not add them at all, so the overlay never has to null them.
- **Proof (D-30):** the released read, export and report deep-equal before and after every post-release act and after a daily run.

### R10. The history actor for system rows (D-19)

- **The schema needs no change.** 16-03 declares `actor` a unidirectional manyToOne without `required` [CITED: 16-03-PLAN.md line 106]. A relation's absence is simply no link row. The read already projects `actor` as `{ documentId, displayName }` *or null* [CITED: 16-03-PLAN.md line 108].
- **The writer and its type do change,** by the dated amendment to `phase-16-risk-withdrawal-and-history.md`. `RiskHistoryEntry.actorDocumentId` becomes `string | null`, and `recordRiskHistory` enforces both directions:
  - null **only** when `source === 'scheduled-run'`;
  - a person always otherwise, and never a person for `scheduled-run`.

  Unit tests cover both refusals. The owner and analyst history reads label a null actor with `sourceKind: 'scheduled-run'` as "CSRM" through the source label map: the server projects and the web labels.
- **Status changes inside a person's act** (a date change clearing Overdue) are `status-derived` rows with source `post-release` and that person as the actor. Only the daily and start-up runs write `scheduled-run` rows.
- **Sizes:** `scheduled-run` (13 characters) and `post-release` fit 16's `sourceKind` maxLength 32 [CITED: 16-03-PLAN.md line 106].

### R11. What Phase 20 needs from 19.1's service (an amendment to its record)

19.1's planned service takes `actorDocumentId: string` and drops the actor from recipients. Its facts envelope is `{ schemaVersion: 1, actorDocumentId }` for every kind, and `buildNotificationFacts` **throws on a missing actor**. Its recipient rules are `new-assignee`, `requestor`, `assigned-analyst` and `note-other-part`, and `notify` returns a count [CITED: 19.1-02-PLAN.md lines 109-111, 203; 19.1-03-PLAN.md line 102]. Reminders need four amendments, recorded in the dated amendment to `phase-19.1-notifications.md` (D-01 already plans that amendment):
1. **A system actor:** a kind spec flag `actor: 'system'`. For those kinds `actorDocumentId` is null in the event and the facts, the parser accepts null only for them, and "names the actor" is false (the sentence reads without a person).
2. **An explicit recipient rule:** `recipients: 'explicit'`, where the event carries `[{ userDocumentId, part }]`, because D-25's one-per-person collapse and part choice happen in the reminder rules.
3. **A return value:** `notify` returns the created notifications' ids per recipient, so the delivery row can link its notification.
4. **The subject relation:** risk-scoped kinds set the optional `risk` relation 19.1 provides (19.1-CONTEXT line 111); `decision-waiting` and `assessment-review-due` use the assessment subject.

Without (1), every reminder write throws. That makes it a blocker the planner must schedule in the schema or registry wave.

### R12. Reminder keys and periods (D-25 to D-27)

| Kind | `reminderKey` (ids are `documentId`s; dates `YYYY-MM-DD`) | Period |
|---|---|---|
| `treatment-due-soon` | `tds:{risk}:{recipient}:{governingDate}` | once per resolve date |
| `treatment-overdue` | `tod:{risk}:{recipient}:{governingDate}:{n}`, `n = floor((daysOverdue − 1) / 7)` | days 1, 8, 15, … |
| `treatment-overdue-escalated` | `toe:{risk}:{recipient}:{governingDate}` | once per overdue episode. A date change always exits Overdue (a new date is after today, D-12), so the date names the episode. |
| `decision-waiting` | `dw:{round}:{recipient}:{n}` | §R8 |
| `decision-review-due` | `drd:{risk}:{recipient}:{reviewDate}:{lead\|due\|o{n}}` | the lead, the date, then every 7 days |
| `assessment-review-due` | `ard:{assessment}:{recipient}:{nextReviewDate}:{lead\|due}` | the lead and the date only |
| `treatment-assigned`, `decision-review-not-confirmed` | `ta:{risk}:{recipient}:{eventId}`, `drn:{risk}:{recipient}:{eventId}` | events (the history row's `documentId`); in the app only, so the delivery records `skipped` with `in-app-only`. Alternatively, write no delivery row for event kinds: the planner's call, recorded in record 2. |

- **The column:** `reminderKey` is a string of at most 255 characters with the real unique index (§R3).
- **A known edge, recorded in record 2:** a reopened treatment whose date has passed escalates again only if the date changes.

### R13. The journey's final slice (D-30; 17-RESEARCH §L)

- **The structure is Phase 17's** [CITED: 17-RESEARCH.md §L, Code Example 4]: one `@journey` test per project; slices are exported functions over the `actors` contexts and the `records` object, with negatives in `e2e/helpers/journey-guards.ts` and direct Strapi probes in `e2e/helpers/strapi-api.ts`; the budget is `JOURNEY_SLICE_BUDGETS_MS`.
- **The plan's edits:** Phase 20 appends `await sliceTrackTreatment(actors, records, request);` after 17.1's `sliceReleaseAndClose`, adds its budget entry (300,000 ms [ASSUMED]), and adds its helpers to the two helper files. The mobile project's `testMatch` already lists the spec (Phase 17 adds it).
- **Preconditions from earlier slices:**
  - 17.1's Treat decision names **Jane** as treatment owner (17.1-CONTEXT line 594, the orchestrator's confirmation), resolving at the end of next quarter, so no reminder fires in the journey.
  - `records.risks.ownerTreat` and `ownerAccept` carry `documentId` and `riskNumber` (17 §L).
  - **The request's type must be Project** for Bob to find the risk in the register's "Project" view (Open Question 3).
- **Steps** (the CONTEXT's `<specifics>`). Before step 1, capture `before` for Jane's and the persona's released reads through `strapi-api.ts`.
  1. Jane opens "My risks and treatments" (`/app/my-risks`, the route the orchestrator accepted in the UI-SPEC's amendment 3). She sets In progress with the note, and attaches the fixture file from `../backend/tests/fixtures/attachments/` on Phase 14's pipeline (the development scanner).
  2. Jane sees no date control. Her API date change gets 403 `TREATMENT_FIELD_NOT_PERMITTED`, and "Mark complete" without a statement gets 400 `TREATMENT_EVIDENCE_REQUIRED`. She then completes with the statement, and the page shows her name and the time.
  3. The persona sees `Complete` in their own list.
  4. Bob opens the register's `View: Project`, records a residual review and closes the risk with a reason, confirming.
  5. The released reads for Jane and the persona deep-equal `before`. The owner page's history lists the baseline, In progress, the note, the evidence, Complete, the review and the closure, each with who and when.
  6. **Negatives at each step:**
     - Maya gets the not-found page, and 404 for the owner page, every act, the evidence download and the history. Nothing appears in her lists, Home, notifications or quick find (17's `expectNotFoundForMaya`, extended).
     - Bob sees no "Review acceptance" on `ownerAccept`, and his API call gets 403 `DECISION_NOT_PERMITTED` (the analyst cannot accept).
- **The refusal order** must put authority before state, so Bob's 403 does not depend on whether the review is due yet (Pitfall 7).

## Architecture Patterns

### System Architecture Diagram

```
            ┌──────────── triggers ─────────────┐
 boot ──> bootstrap(): seeds ─> startup run ─┐  │  strapi.cron (Etc/UTC, CSRM_REMINDER_SCHEDULE)
                                             │  │     └─> daily run
 treatment act / decision review (HTTP) ─────┼──┼─> per-risk evaluation (same transaction)
                                             v  v
                         runReminders(strapi, { now, trigger, subject? })
                                             │ batches of ids (outside transactions)
                                             v
             ┌──────── one transaction per subject ────────────────────────┐
             │ request lock ─> risk lock ─> re-read facts                  │
             │   ─> ensureReleaseBaseline (first post-release write only)  │
             │   ─> derive status (one rule) ─> write + history row        │
             │   ─> rules ─> candidates ─> collapse one per person         │
             │   ─> readability check ─> INSERT delivery ON CONFLICT       │
             │        DO NOTHING ─(row)─> notify() ─> link notification    │
             │   ─> onCommit(flush ids)                                    │
             └─────────────────────────────────────────────────────────────┘
                                             │ after commit (not awaited)
                                             v
     sender: CAS claim (attempts, lease) ─> re-check readable and still due
        ─> content builder (number + link only) ─> email plugin send()
              ├─ development and tests: capture provider ─> JSON file in the capture dir
              ├─ production: nodemailer SMTP (relay or SES)
              └─ not configured: no send; delivery skipped (not-configured)
        ─> delivery sent / failed (code) / skipped (reason)
```

### Recommended module placement (within the CONTEXT's Planner's Discretion)
```
apps/backend/src/csrm/
├── insights/treatment-due-state.ts   # the one rule + SQL mirrors (switched)
├── treatment/                         # people predicate, acts, baseline, review date
├── reminders/                         # policy, schedule, rules, keys, run, sender
└── email/                             # email-config, plugin config, capture provider, content builder
apps/backend/src/api/csrm-reminder-delivery/   # content type (core router only: [])
apps/backend/src/api/csrm-treatment-evidence/  # Phase 14's family shape
```

### Anti-Patterns to Avoid
- **Catching a unique violation inside a shared transaction:** on PostgreSQL the transaction is already aborted. Claim with `ON CONFLICT DO NOTHING` instead.
- **`server.cron.enabled: true` with config tasks:** they schedule before the seeds and the start-up run, and they need application imports in config.
- **Sending email inside the transaction:** a slow relay holds row locks, and a rollback after a send emails about something that never happened.
- **Reading `treatment_status` for a due figure:** use the rule (D-08).
- **Comparing `exemption_review_date` with a date string:** bind instants (19.1-RESEARCH Pitfall 3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron timing and time zones | A `setInterval` clock | `strapi.cron.add` with `{ rule, tz: 'Etc/UTC' }` | DST-safe, named, removable, destroyed by the harness |
| SMTP | A socket client | The official nodemailer provider | TLS, auth, timeouts, MIME |
| MIME composition (proof) | A hand-written `.eml` | nodemailer `streamTransport` in a unit test | The same composer as production |
| Exactly-once claims | A `SELECT` then `INSERT` with catch | Unique index + `ON CONFLICT DO NOTHING` | Cross-process; no transaction abort |
| Calendar arithmetic | New date helpers | `utc-date.ts` (`utcToday`, `addUtcDays`, `addUtcMonths`, `daysBetween`, `utcDateToInstant`) | Already the repository's one convention (17.1-RESEARCH line 354) |
| After-commit hooks | A queue | `strapi.db.transaction`'s `onCommit` | Runs once after the outermost commit, never on rollback |

## Common Pitfalls

### Pitfall 1: A cron rule that silently never runs, or runs once
**What goes wrong:** node-schedule treats an unparsable rule as a date, scheduling a one-time job or nothing, and Strapi ignores the `false` return (§R1). **How to avoid:** a closed five-field pattern, then assert `nextInvocation()` after `add`, failing boot. **Warning sign:** no reminders after midnight UTC while the start-up run works.

### Pitfall 2: The daily run breaks "the released record stays as released"
**What goes wrong:** the run writes `Overdue` on a released risk nobody has touched. Without a baseline, the released reads (which use the live values when no baseline exists) now show `Overdue`. **How to avoid:** the run writes through `withReleasedRiskMutation`, so the baseline precedes the first status write. The D-30 deep-equal test includes "after a daily run".

### Pitfall 3: `sendmail` loaded by a default
**What goes wrong:** with no `email` entry in `config/plugins.ts` (today there is none [VERIFIED: config/plugins.ts]), the plugin loads `sendmail`, which delivers by direct SMTP to the recipient's MX. **How to avoid:** always name `nodemailer` (§R4), with the three proofs.

### Pitfall 4: The HTML part from plain text
**What goes wrong:** the official provider copies `text` into `html` when `html` is absent. **How to avoid:** pass `html: ''`, and assert a single `text/plain` part in the composition unit test.

### Pitfall 5: The harness boot guard and the double key
**What goes wrong:** the Strapi harness sets `NODE_ENV`, `CSRM_ENVIRONMENT` and `CSRM_DEV_IDENTITY` to development **after** `load()` [VERIFIED: strapi-http-harness.ts:488-493]. During `load()`, `CSRM_ENVIRONMENT` comes from whatever `.env` dotenv found. On a machine without `apps/backend/.env`, `CSRM_EMAIL_PROVIDER=capture` would fail boot. **How to avoid:** the harness pins `CSRM_ENVIRONMENT=development` (and `NODE_ENV`) before `load()`, unless 14-04 has already moved them, which Stage 3 re-checks. Phase 14's development scanner needs the same.

### Pitfall 6: Lock order inversion with release and close and with reassignment
**What goes wrong:** a treatment act locking the risk and then letting `notify` lock the request deadlocks against 17.1's release and close (request, then risk) on PostgreSQL. **How to avoid:** request lock first in every Phase 20 act and in the run (§R3); `notify` re-locking the held request row is harmless in the same transaction.

### Pitfall 7: Refusal order that leaks state
**What goes wrong:** checking "review due" (409 `REVIEW_NOT_DUE`) before authority (403 `DECISION_NOT_PERMITTED`) tells Bob the review timing, and makes the journey's 403 depend on the date. **How to avoid:** 404 (cannot read) → 403 (grant, part, authority, G-1 and G-11 analyst refusals) → 400 (body) → 409 (state). One unit test fixes the order per act.

### Pitfall 8: Un-awaited sends after the harness destroys Strapi
**What goes wrong:** an `onCommit` send still running when a test file calls `strapi.destroy()` touches a destroyed database (the harness's comment at line 479). **How to avoid:** the sender takes `strapi` explicitly, tracks in-flight promises, and an application `destroy()` awaits them; tests `await sender.drain()`.

### Pitfall 9: The catalogue's description of Close Risk contradicts D-15
**What goes wrong:** D-02 keeps the FunctionAPI's name, URL and description, but the description reads "Closes a completed risk and records its closure date subject to validation of treatment state" [VERIFIED: catalogue lines 1776-1783]. D-15 closes without a completed treatment. **How to avoid:** Open Question 2.

## Code Examples

### The daily task and the start-up run (`apps/backend/src/index.ts`, end of `bootstrap`)
```ts
// Source: @strapi/core 5.51.0 services/cron.js (object format, { strapi } argument); node-schedule Job.js (tz)
const schedule = readReminderSchedule(process.env);            // throws on an invalid value (fails boot)
await runStartupReminders(strapi, new Date());                 // awaited: before listen(); logs and never throws
if (schedule.enabled) {
  strapi.cron.add({
    csrmReminderRun: {
      task: ({ strapi }: { strapi: Core.Strapi }) => runReminders(strapi, { now: new Date(), trigger: "daily" }),
      options: { rule: schedule.rule, tz: "Etc/UTC" },
    },
  });
  assertReminderJobScheduled(strapi, "csrmReminderRun");      // nextInvocation() !== null, else throw
}
```

### The claim without aborting the act's transaction
```ts
// Source: knex 3.0.1 onConflict().ignore(); @strapi/database transaction-context onCommit
await strapi.db.transaction(async ({ trx, onCommit }) => {
  const now = new Date();
  const inserted = await strapi.db.connection("csrm_reminder_deliveries")
    .insert({ document_id: randomUUID(), reminder_key: key, kind, email_status: "pending", attempts: 0,
              created_at: now, updated_at: now, published_at: now })
    .onConflict("reminder_key").ignore()
    .returning("id")
    .transacting(trx);
  if (inserted.length === 0) return;                           // already delivered by any process
  const [notificationId] = await notify(strapi, { kind, actorDocumentId: null, recipients: [{ userDocumentId, part }], … });
  await strapi.db.query(DELIVERY_UID).update({ where: { id: inserted[0].id }, data: { notification: notificationId } });
  onCommit(() => { void sender.flush([inserted[0].id]).catch(logSendFailure); });
});
```
Column names are illustrative; the schema's snake-case names are asserted against `strapi.db.metadata` in a unit test.

### The email plugin's configuration (`config/plugins.ts`)
```ts
// Source: @strapi/email 5.51.0 bootstrap.js; @strapi/provider-email-nodemailer 5.51.0 index.js
import { emailPluginConfig, readEmailConfig } from "../src/csrm/email/email-config";
// …inside the config factory:
email: { config: emailPluginConfig(readEmailConfig(process.env, { appRoot: process.cwd() })) },
// emailPluginConfig always returns { provider: "nodemailer", providerOptions, settings: { defaultFrom } };
// providerOptions = smtp ? { host, port, secure, requireTLS: !secure, auth, connectionTimeout: 10_000,
//   greetingTimeout: 10_000, socketTimeout: 30_000 } : { jsonTransport: true }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sendmail` as the plugin's default | Strapi recommends `@strapi/provider-email-nodemailer` for SMTP relays | `@strapi/email` 5.x development-mode warning [VERIFIED: bootstrap.js:32] | Name the provider explicitly |
| Due state from `targetDate` | `COALESCE(treatmentResolveDate, targetDate)`, tracked treatments only | This phase (G-16) | One switch in `treatment-due-state.ts` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The latest completing act (non-null `reviewDate`, latest `recordedAt`) is the standing one after release | §R7 | A wrong review date for a risk whose final round holds a superseded completing act; the oracle catches it once 17.1's code exists |
| A2 | 17.1's `acceptanceState` plus the round's `openedAt` and the latest decision row identify "pending since" | §R8 | Wrong waiting days; Stage 3 re-checks against 17.1's code |
| A3 | The SES SMTP host name `email-smtp.ap-southeast-2.amazonaws.com` | §R4 item 8 | A commented example only; the operator supplies the real host |
| A4 | Journey slice budget of 300,000 ms | §R13 | Timeout tuning only |
| A5 | 14-04 may not move the harness's double key before `load()` | Pitfall 5 | None if Phase 20 pins it itself |
| A6 | Retry bound 3 attempts and a 15-minute lease | §R4 item 7 | Planner's discretion bounds |
| A7 | The behaviour of nodemailer 9.1.1 (installed through the web's `@auth/core`) matches the provider's pinned 9.0.1 for `html: ''`, `streamTransport` and the timeouts | §R4 | The composition unit test runs against the pinned 9.0.1 once installed and would catch a difference |

## Open Questions (for the orchestrator)

1. **Is a closed treated risk `not-tracked` or `complete-or-closed`?** D-07 calls tracked treatments open, while D-09's order lists "the risk closed" under `complete-or-closed`. **Recommendation:** applicability = released ∧ Treat ∧ not withdrawn; closure gives `complete-or-closed` (§R5).
2. **The Close Risk FunctionAPI description.** It says "subject to validation of treatment state", which contradicts D-15. **Recommendation:** amend the description in both catalogue copies when moving it into the human-only Function, keeping its name and URL, and record the change in record 1. This edits D-02's "description kept".
3. **The journey request's assessment type.** Bob uses `View: Project` in step 4, which needs Phase 17's first slice to raise a Project request. **Recommendation:** Phase 17's slice sets type Project; otherwise the final slice uses the default register view, and SC1's views stay in the phase spec.
4. **19.1's service amendments (§R11).** A system actor, explicit recipients and returned ids: Phase 20's record amends 19.1's, as D-01 plans. The schedule matters, because reminder writes throw without the first amendment.
5. **Delivery rows for in-app-only event kinds.** Record `skipped` (`in-app-only`), or write no delivery row for `treatment-assigned` and `decision-review-not-confirmed`. **Recommendation:** no row, because their idempotency is the event itself. Record 2 states the choice.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 (gate runs) | Every suite | ✓ (POST-DEMO-BRIEF §4 preamble) | 24.19.0 | — |
| `@strapi/email` and `node-schedule` | D-26, D-28 | ✓ (installed with Strapi) | 5.51.0, 2.1.1 | — |
| `@strapi/provider-email-nodemailer` | D-28 | ✗ (to add) | 5.51.0 on the registry | None; it is the named provider. Install after the human-verify checkpoint. |
| SMTP relay or SES | Production email | ✗ (deployment) | — | Email unavailable: deliveries `skipped (not-configured)`, in-app reminders still arrive |
| PostgreSQL | R-08-37 | ✗ | — | Portable SQL by construction; recorded in R-08-37 |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **Web:** vitest 4.1.11 (jsdom) with @testing-library/react. **Strapi:** `node:test` compiled by `tsc -p tests/tsconfig.json` to `.tmp/tests-dist`, one SQLite database per file. **E2E:** Playwright 1.58.2 with @axe-core/playwright, production build. Each is as recorded in `19.1-VALIDATION.md` [CITED]. |
| Config file | `apps/csrm/vitest.config.ts`; `apps/backend/tests/tsconfig.json`; `apps/csrm/playwright.config.ts` |
| Quick run command | Web: `pnpm --dir apps/csrm exec vitest run <path>`. Strapi file: `pnpm --dir apps/backend exec tsc -p tests/tsconfig.json --pretty false && (cd apps/backend && node --test --test-concurrency=1 --test-timeout=600000 .tmp/tests-dist/tests/<file>.test.js)`. E2E: `pnpm --dir apps/csrm test:e2e e2e/<spec>.spec.ts` |
| Full suite command | `pnpm --dir apps/csrm api:check && pnpm --dir apps/csrm typecheck && pnpm --dir apps/csrm lint && pnpm --dir apps/csrm test && pnpm --dir apps/backend test`, then `pnpm --dir apps/csrm test:e2e` and `git status --short` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RISK-06 / D-09 | The rule's applicability, governing date and order; SQL parity over every state | Strapi unit + integration | `…/treatment-due-state.unit.test.js`, `…/treatment-due-state-parity.integration.test.js` | ❌ W0 (extends 11-15's parity cases) |
| RISK-06 / D-08 | Progress and status derivation; earlier-release defaults; the run writes Overdue in and out with history; an act re-derives | Strapi unit + integration | `…/treatment-status.unit.test.js`, `…/reminder-run.integration.test.js` | ❌ W0 |
| RISK-04 / D-06 | Released read, export and report deep-equal after every act and after a daily run; one baseline only | Strapi integration | `…/release-baseline.integration.test.js` | ❌ W0 |
| RISK-04 / D-19 | System-source rows have a null actor; person rows refuse null | Strapi unit | `…/risk-history-actor.unit.test.js` | ❌ W0 |
| RISK-05 / RISK-06 (5) | Every refusal in `<authorisation>`; refusal order; the matrix rows for seven callers | Strapi integration + matrix | `…/treatment-acts.integration.test.js`, `…/authorization-matrix.integration.test.js` | ❌ W0 / ✅ |
| NOTIFY-02 / D-26 | The schedule parser; an invalid rule fails boot; the job is registered with `Etc/UTC`; `off` registers none | Strapi unit | `…/reminder-schedule.unit.test.js` | ❌ W0 |
| NOTIFY-02 / D-25, D-27 | Each kind, period and recipient; one per person; readability at write and at send; a repeated run and two concurrent runs (`Promise.all`) write nothing twice; retries up to the bound; `skipped` reasons | Strapi unit + integration (injected clock) | `…/reminder-rules.unit.test.js`, `…/reminder-run.integration.test.js` | ❌ W0 |
| NOTIFY-02 / D-28 | The provider is always `nodemailer`; capture under the double key only; a capture file per email; the content builder holds no title, name or rating; a `text/plain`-only MIME | Strapi unit + integration | `…/email-config.unit.test.js`, `…/email-content.unit.test.js`, `…/email-delivery.integration.test.js` | ❌ W0 |
| D-17 | The review date's sources and SQL parity; authority by rating; `REVIEW_NOT_DUE`; `REVIEW_AUTHORITY_MISSING` | Strapi unit + integration | `…/decision-review.unit.test.js`, `…/decision-review.integration.test.js` | ❌ W0 |
| RISK-03, ADMIN-06 | Type filters and views; "Used in" figures equal their lists | Strapi integration + web + E2E | `…/risk-register.integration.test.js`, `…/reference-usage.integration.test.js`; the phase spec | ✅ / ❌ W0 |
| SC7 | The journey's final slice at 1440px and 375px with negatives | E2E | `pnpm --dir apps/csrm test:e2e e2e/risk-owner-journey.spec.ts` | Phase 17 creates it |
| SC5 | Fixtures processed by the start-up run: in-app reminder and a capture file; Overdue in register, Home, alerts and export; escalation; a dated change clears it; decision waiting at eight days | E2E | `pnpm --dir apps/csrm test:e2e e2e/<phase spec>.spec.ts` | ❌ W0 |

### Sampling Rate
- **Per task commit:** the touched web files by path; the touched Strapi file (dev servers stopped); `typecheck` after type changes; `api:check` after any specification change.
- **Per wave merge:** the full Strapi suite and the full web suite.
- **Phase gate:** the full suite, then Playwright (both projects), then a clean `git status --short`.

### Wave 0 Gaps
- [ ] Harness pins before `load()`: `CSRM_EMAIL_PROVIDER`, `CSRM_EMAIL_CAPTURE_DIR`, `CSRM_EMAIL_FROM`, `CSRM_WEB_PUBLIC_ORIGIN`, `CSRM_REMINDER_SCHEDULE=off` and the double key (Pitfall 5); helpers `runReminders(strapi, { now })`, `emailSender().drain()` and `captureDirectory()`.
- [ ] Playwright `webServer.env`: `CSRM_REMINDER_SCHEDULE: 'off'`, `CSRM_EMAIL_CAPTURE_DIR`; `process.env.CSRM_E2E_MAIL_CAPTURE_DIR ??= …`; an `e2e/helpers/mail-capture.ts` that polls the directory (`expect.poll`) and parses JSON.
- [ ] SC5 fixtures reconciled at each start behind `IDAMBOX_SEED_CSRM` and the development identity (the pattern of `seed-analyst-insights.ts`), ordered before the start-up run.
- [ ] The test files marked ❌ W0 above.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Keycloak and the development bridge (unchanged) |
| V4 Access Control | yes | Role → Function → FunctionAPI, the risk's-people predicate, 404 for unreadable records, refusal order (Pitfall 7), the service identity refused |
| V5 Input Validation | yes | Closed parsers for every body and query; environment settings validated at boot |
| V7 Error Handling and Logging | yes | One structured line per run with counts only (R-08-13); email addresses and nodemailer messages never logged; sanitised error codes |
| V12 Files | yes | Evidence on Phase 14's pipeline; capture files written outside `public/` with exclusive create |
| V14 Configuration | yes | Capture only under the double key (boot fails otherwise); `https` web origin outside development; SMTP secret from a secret store |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Email leaving the access boundary with risk content | Information disclosure | The content builder takes number, date, link and kind only, never the record (D-28); a unit test feeds a record with a title and a name and asserts neither appears |
| Mail sent to an arbitrary MX by `sendmail` | Information disclosure | The provider is always named `nodemailer` (§R4) |
| Duplicate or replayed reminders | Repudiation and noise | Unique index + `ON CONFLICT DO NOTHING`; CAS send claim |
| Reminders about records the person can no longer read | Information disclosure | Readability at write and at send (`skipped not-readable`) |
| Header injection in subject or recipient | Tampering | The subject is built from closed formats and record numbers; the recipient is the stored IdamBox User email (nodemailer encodes headers) |

## Sources

### Primary (HIGH; read this session)
- `@strapi/core` 5.51.0: `dist/configuration/index.js:24-31`, `dist/providers/cron.js`, `dist/services/cron.js`, `dist/Strapi.js:200-206, 316-430`, `dist/loaders/plugins/get-enabled-plugins.js:19-23`, `dist/utils/transform-content-types-to-models.js:189-193, 333-345`.
- `@strapi/database` 5.51.0: `dist/schema/schema.js:19-31, 94-104`; `dist/index.js:60-97`; `dist/transaction-context.js`.
- `@strapi/email` 5.51.0: `dist/server/bootstrap.js`, `config.js`, `services/email.js`. `@strapi/provider-email-sendmail` 5.51.0: `dist/index.js`.
- `@strapi/provider-email-nodemailer@5.51.0`, packed from the registry into the scratchpad: `dist/index.js`, `package.json`.
- `node-schedule` 2.1.1 `lib/Job.js`; `knex` 3.0.1 sqlite3 and pg query compilers; `nodemailer` 9.1.1 `lib/smtp-connection`, `lib/stream-transport`, `lib/mail-composer`.
- Repository: `apps/backend/src/index.ts`, `config/server.ts`, `config/plugins.ts`, `config/middlewares.ts`, `.env.example`, `src/csrm/insights/treatment-due-state.ts`, `utc-date.ts`, `src/api/csrm-risk/services/risk-register.ts:123-164, 334-347`, the risk, control-implementation and IdamBox User schemas, `assessment-scope.ts:255-262`, `tests/helpers/strapi-http-harness.ts:426-493`, `apps/csrm/playwright.config.ts`, the catalogue and `served-operations.json`.
- npm registry: `npm view` for the provider, nodemailer and `@strapi/strapi`; the package-legitimacy seam.
- docs.strapi.io/cms/configurations/cron (the object format, `tz`, `strapi.cron.add` and `remove`).

### Secondary (MEDIUM; earlier phases' planned outputs, cited)
- 11-14, 11-15, 11-17 plans; 14-RESEARCH and plans 14-03, 14-04; 16-RESEARCH and plans 16-02, 16-03; 17-RESEARCH §L and Pitfalls 5 and 8; 17.1-RESEARCH (content-type shapes, review dates); 18-RESEARCH (unique index); 19.1-RESEARCH Pitfalls 1 and 3, plans 19.1-02 and 19.1-03; 19.1-VALIDATION (infrastructure facts).

### Tertiary (LOW)
- The assumptions A1 to A7.

## Metadata

**Confidence breakdown:**
- Scheduler, email plugin, unique index, `ON CONFLICT`, `onCommit`: HIGH (installed source).
- SQL for the rule and review date: MEDIUM (rests on the planned columns of 11, 16 and 17.1; each has an oracle test).
- Journey slice: MEDIUM (rests on 17 §L and 17.1's confirmation; the plans that create the spec are not yet written).

**Research date:** 2026-10-01
**Valid until:** 2026-10-31 (Strapi 5.51.0 is pinned, so the source facts hold while the pin holds; re-check if the Strapi version changes)
