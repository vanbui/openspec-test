# CSRM Project Guide

## Project

IdamBox Cyber Risk Manager (CSRM) is a Turborepo application with Strapi at `apps/strapi` and a Next.js App Router client at `apps/web`.

## Authoritative References

1. `docs/CSRM-PROJECT-BRIEF.md`
2. `docs/references/specification.json` for API operations and schemas
3. `docs/references/idambox-datamodel.jdl` for domain terminology
4. `docs/references/idambox-csrm-role-function-api-catalogue.json` for capability traceability
5. `docs/design/csrm-design-direction.md` for every UI value (BProton design system, adopted in `docs/adr/0001-adopt-bproton-design-system.md`)

# CSRM (web) Engineering Rules

- Use Next.js App Router and TypeScript.
- TypeScript strict mode is mandatory.
- Prefer Server Components; use Client Components only when required.
- Use shadcn/ui before creating custom primitives.
- All styling must use semantic theme tokens.
- Never hard-code BProton brand colours in feature components.
- All pages must work at mobile and desktop widths.
- Business/domain logic must not live in JSX.
- Never call APIs directly from arbitrary UI components; use the typed API layer.
- Validate external input with shared schemas.
- Authorization must be enforced server-side.
- Navigation visibility is not authorization.
- Requestors must not access another requestor's restricted records.
- AI output is advisory and cannot automatically release an assessment.
- Use the supplied JDL terminology as the domain source of truth.
- Add automated tests with every material workflow.
- Do not introduce a dependency without a concrete reason.
- Prefer maintainability and clarity over clever abstractions.

## Non-Negotiables

- Keep Strapi as the production API boundary. Do not add a frontend API facade or raw fetch calls in page components.
- Keycloak authenticates; Strapi enforces IdamBox Role → Function → FunctionAPI and record-level authorisation. Navigation visibility is not security.
- Requestor is an implicit birthright role; Security Analyst is explicit.
- AI output is reviewable assistance only. It cannot release an assessment.
- Preserve CSRM JDL terminology. Document contract/model gaps rather than inventing competing entities.
- Use semantic design tokens, responsive accessible patterns, strict TypeScript, and reusable feature-oriented modules.
- Never commit secrets, move `node_modules`, or silently merge the Strapi nested Git history during the workspace migration.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `bproton-dev/csrm`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), unchanged. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
