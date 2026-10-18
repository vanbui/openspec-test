---
phase: 1
phase_name: Strapi Backend Foundation
plan: 3
title: Backend Verification, Seeds, And Documentation
type: implementation
wave: 3
depends_on:
  - 02-PLAN.md
files_modified:
  - apps/backend/.env.example
  - apps/backend/README.md
  - README.md
  - apps/backend/src/index.ts
  - apps/backend/src/bootstrap/seed-core-data.ts
autonomous: true
requirements_addressed:
  - MONO-02
  - BACK-01
  - BACK-02
  - BACK-03
  - DATA-02
  - DATA-03
  - DATA-04
  - DATA-05
  - DATA-06
  - DATA-07
---

<objective>
Make the backend foundation usable and verifiable by adding environment examples, developer documentation, optional seed data for the core IdamBox model, and final checks.
</objective>

<context>
Plans 1 and 2 create the repository and schema foundation. This plan should prove the model can be administered and explain how future app phases will build on it without implementing Auth0 or frontend apps now.
</context>

<must_haves>
<truths>
- Documentation must state that Strapi admin authentication is for Phase 1 administration only.
- Documentation must state that Auth0 app authentication is deferred.
- Verification must cover the complete access derivation path.
- Seed/sample data must not become required production behavior.
</truths>
</must_haves>

<threat_model>
**Assets:** sample identity data, admin setup instructions, environment secrets.
**Threats:**
- HIGH: committing real user data or secrets in seed/example files.
- MEDIUM: sample bootstrap logic running unexpectedly in production.
- MEDIUM: documentation implying Auth0 is already implemented.
**Mitigations:**
- Use obviously fake sample data only.
- Gate bootstrap seed behavior behind an explicit environment variable.
- Keep `.env.example` placeholder-only.
- Document the Phase 1/future authentication boundary clearly.
**Residual Risk:** Local administrators still need to configure Strapi admin credentials on first run.
</threat_model>

<tasks>
<task id="1" type="implementation">
<title>Add backend environment example</title>
<files>
- `apps/backend/.env.example`
</files>
<action>
Create a placeholder environment file for Strapi local development, including app keys, API token salt, admin JWT secret, transfer token salt, encryption key, host/port, and database client settings. Use placeholders only.
</action>
<verify>
No real secrets are present. Variables match config files from Plan 1.
</verify>
<acceptance_criteria>
- A developer can see which environment variables are required before first run.
</acceptance_criteria>
</task>

<task id="2" type="implementation">
<title>Add optional core seed helper</title>
<files>
- `apps/backend/src/bootstrap/seed-core-data.ts`
- `apps/backend/src/index.ts`
</files>
<action>
Add an optional bootstrap helper that seeds example applications and application roles only when an explicit environment variable such as `IDAMBOX_SEED_CORE=true` is set. Seed example applications for IAM, Compliance, Automation, Crypto Manager, LMS, and Cyber Risk Manager, plus sample LMS `STUDENT` and `TUTOR` application roles.
</action>
<verify>
Seed helper is idempotent and guarded by the environment variable. It uses fake/sample data only and does not create admin users.
</verify>
<acceptance_criteria>
- Developer can populate representative core records for manual admin verification.
- Production startup does not seed by default.
</acceptance_criteria>
</task>

<task id="3" type="documentation">
<title>Document backend development workflow</title>
<files>
- `README.md`
- `apps/backend/README.md`
</files>
<action>
Write concise setup and development instructions. Include package manager, install command, backend dev command, Strapi admin URL, environment setup, data model overview, and explicit out-of-scope notes for Auth0 and frontend modules.
</action>
<verify>
Docs match the actual scripts and file locations. Docs explain the relationship path `IdamBoxUser -> Role -> ApplicationRole -> Application`.
</verify>
<acceptance_criteria>
- New developer can run the backend and understand the Phase 1 model.
- Future app work can see where Auth0 integration will belong later.
</acceptance_criteria>
</task>

<task id="4" type="verification">
<title>Run final phase verification</title>
<files>
- no source files expected unless fixing verification failures
</files>
<action>
Run the strongest available local checks: dependency install if needed, type check, Strapi build, and schema inspection. If network/dependency installation is blocked, document the exact blocked command and complete static verification of generated files.
</action>
<verify>
Verification results are recorded in the execution summary for this plan.
</verify>
<acceptance_criteria>
- All Phase 1 success criteria are either verified or have a clearly documented external blocker.
</acceptance_criteria>
</task>
</tasks>

<verification>
Run these checks after implementation:
- `yarn install`
- `yarn check-types`
- `yarn build`
- Static inspection that all requirements in `.planning/REQUIREMENTS.md` are satisfied by source files and docs.
</verification>

<success_criteria>
- Environment and README documentation are present.
- Optional seed helper is guarded and sample-only.
- Phase 1 can be verified locally as far as sandbox/network access allows.
- No Auth0 or frontend app implementation is introduced.
</success_criteria>
