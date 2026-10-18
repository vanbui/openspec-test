<!-- generated-by: gsd-doc-writer -->
# IdamBox Cyber Risk Manager (CSRM)

CSRM helps Requestors raise Assessment Requests and answer Questionnaires, and helps Security Analysts review and release Risk Assessments. AI supplies advisory proposals; an authorised human releases the assessment.

This private pnpm/Turborepo workspace contains the Next.js App Router client in `apps/csrm` and the shared Strapi API in `apps/backend`. Keycloak authenticates; Strapi enforces IdamBox Role → Function → FunctionAPI grants and record-level access.

## Installation

Use Node.js `>=24.19.0 <25` and pnpm `11.24.0`. Run from the repository root:

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env
cp apps/csrm/.env.local.example apps/csrm/.env.local
```

The examples contain development placeholders. Keep real credentials in ignored environment files or a deployment secret store.

## Quick start

1. Start both applications with `pnpm dev`.
2. Open http://localhost:1337/admin, create the initial administrator, and create a **Full access API token** in **Settings → API Tokens**.
3. Replace `CSRM_API_TOKEN` in `apps/csrm/.env.local` with that token and restart the servers.
4. Open http://localhost:3000 and use a development fixture identity.

The development identity bridge needs no Keycloak. A normal production build requires OIDC sign-in. See [Getting started](docs/guides/getting-started.md) for local and Keycloak walkthroughs.

## Local Docker services

Run `docker compose -f docker/docker-compose.yaml up -d` to start local Keycloak and ClamAV. ClamAV listens only on `127.0.0.1:3310` and persists its signatures in `clamav-db`. See [Local Docker services](docker/README.md).

## Usage

- Requestors save and submit requests, answer released Questionnaires, and read their released Risk Assessments.
- Security Analysts pick up requests, curate Questionnaires and AI drafts, review release readiness, and release assessments.
- Request notes and attachments provide supporting context; an analyst explicitly chooses which note and file text the AI may read.

AI defaults to the deterministic provider. Configure a compatible provider through the backend environment; see [Configuration](docs/configuration/configuration.md).

## Development commands

| Root command | Purpose |
|---|---|
| `pnpm dev` | Start workspace development servers |
| `pnpm build` | Build workspace applications |
| `pnpm lint` | Run defined workspace lint tasks |
| `pnpm typecheck` | Check types and dependent generated contract |
| `pnpm test` | Run workspace tests through Turbo |
| `pnpm test:e2e` | Run browser tests after dependent build and test tasks |

See [Development](docs/guides/development.md) and [Testing](docs/guides/testing.md) for package commands and test isolation.

## Documentation

- [Architecture](docs/architecture/overview.md)
- [Configuration](docs/configuration/configuration.md)
- [Frontend components](docs/frontend/components.md)
- [Backend services](docs/services/backend-services.md)
- [Project brief](docs/CSRM-PROJECT-BRIEF.md)
- [Domain glossary](CONTEXT.md)
- [Design direction](docs/design/csrm-design-direction.md)

The API contract is `docs/references/specification.json`; domain terminology comes from `docs/references/idambox-datamodel.jdl`. Contract extensions and limitations are recorded under `docs/contract-gaps/`.

## License

The workspace is private. No root LICENSE file or root package license declaration is present; this README does not grant redistribution rights.
