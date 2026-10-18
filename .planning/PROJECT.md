# BProton / IdamBox Application Platform

## What This Is

BProton is a software company whose IdamBox platform underpins solutions for identity, compliance, automation, cyber security and cryptography. BProton describes customer choice through well-supported open technologies and standards as a guiding principle. [Source: BProton](https://www.bproton.com/).

This repository is a monorepo for IdamBox applications. It currently contains a shared Strapi backend in `apps/backend` and the Next.js IdamBox Cyber Risk Manager (CSRM) application in `apps/csrm`. Additional applications from the IdamBox suite will be added under `apps/`. They will share the same Strapi backend in `apps/backend` and each will be developed in its own GSD workstream, in parallel with the `csrm` workstream. IdamBox IAM is part of the wider product family described on BProton's site, but there is no `apps/iam` application in this repository at present.

## Core Value

CSRM guides a cyber risk assessment from a Requestor's initial request through contextual questions, assessment, review and release. AI assists with questions and draft risks; a Security Analyst reviews, edits and releases each assessment. This reflects BProton's published description of Cyber Risk Manager as analyst-controlled assistance on the IdamBox platform. [Source: BProton](https://www.bproton.com/).

## Requirements

- Give Requestors a secure way to create requests, answer questionnaires and view assessments released to them. Give Security Analysts the tools to review requests, curate assessments, manage risks and controls, and oversee work awaiting action.
- Keep AI output advisory and reviewable. Only an authorised human workflow can release an assessment.
- Use Keycloak for authentication and Strapi as the production API and authorisation boundary. Enforce IdamBox Role → Function → FunctionAPI and record-level access on the server.
- Preserve the CSRM domain terminology in the JDL and the API contract in `docs/references/specification.json`.
- Use the BProton design system through the semantic tokens and responsive, accessible patterns defined in `docs/design/csrm-design-direction.md`.

The [CSRM project brief](../docs/CSRM-PROJECT-BRIEF.md) defines the application workflow and users. `AGENTS.md` records the engineering rules; the references above govern contract, domain and UI details.

## GSD Workstreams

Planning uses GSD workstreams (from 2026-10-04). Each application under `apps/` is planned and built in its own workstream, and every workstream shares the one Strapi backend in `apps/backend`.

| Workstream | Application | Planning directory |
|---|---|---|
| `csrm` | `apps/csrm` (IdamBox Cyber Risk Manager) | `.planning/workstreams/csrm/` |
| `iam` | none: platform workstream (midPoint identity engine in `docker/midpoint/`, Strapi SCIM in `apps/backend`) | `.planning/workstreams/iam/` |

A new application gets its own folder under `apps/` and its own workstream (`/gsd-workstreams create <app>`), named after the folder. `apps/backend` never gets a workstream of its own: each backend change is planned in the workstream of the application that needs it. The one exception is `iam`, a platform workstream with no application folder: it plans the identity engine (`docker/midpoint/`) and the backend SCIM provisioning it needs.

**What lives where:**
- `.planning/workstreams/<name>/` holds that workstream's `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `phases/`, `milestones/`, `quick/`, `debug/`, `research/`, `uat/`, briefs and prompts. Each workstream numbers its phases and milestones independently.
- The root of `.planning/` holds only what all workstreams share: this file, `config.json` (the GSD settings every workstream inherits), `WINDOWS.md` (the cross-phase defect ledger) and GSD's own `state.json`.
- Within a workstream's documents, a path such as `.planning/workstreams/csrm/STATE.md` is written in full from the repository root. Records written before the move keep the `.planning/...` paths that were true at the time; read them as relative to their workstream directory.

**Selecting a workstream.** Run `/gsd-workstreams switch <name>` at the start of a session, or pass `--ws <name>` to each GSD command. GSD keeps the selection per session where the runtime exposes a session id, and otherwise in `.planning/active-workstream`. That file is git-ignored, so one developer's selection never reaches another's checkout. Check it with `/gsd-workstreams status <name>` before planning or executing.

**The shared backend.** Every workstream builds on `apps/backend`, so a backend change reaches every application:
- A content-type change (schema, field or relation) still starts with its `docs/contract-gaps/` record and an approval checkpoint. The record names every workstream whose application reads the content type.
- Changes to shared backend code (policies, middlewares, bootstrap, the role-function catalogue, the OpenAPI contract in `docs/references/specification.json`) keep existing endpoints and grants backward compatible unless every affected workstream's plan includes the change.
- Before executing a phase that touches `apps/backend`, pull in the latest backend changes from the other workstreams and re-run the plan check against them. The backend test suite (`pnpm --dir apps/backend test`) is part of every workstream's gate.
- Each application's typed API client is regenerated from the shared contract by its own workstream (for CSRM, `pnpm --dir apps/csrm api:check`).

**Portable briefs and prompts.** Briefs, prompts and planning documents must work for any developer, wherever they cloned the repository and whatever branch they work on:
- Never write an absolute checkout path. Write paths relative to the repository root, and when a command needs the root, find it with `git rev-parse --show-toplevel`. Run gate commands from the repository root.
- Never name the working branch. Work happens on the branch checked out when the session starts; find it with `git branch --show-current`, and its remote counterpart with `git rev-parse --abbrev-ref --symbolic-full-name @{u}`. Don't create, switch or rename branches unless the developer asks.
- Machine-specific facts (a Node install directory, a shell shim) are host notes. Write them as variables a developer sets for their own machine, with the original host's value as an example only.
