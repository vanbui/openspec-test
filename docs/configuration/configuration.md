<!-- generated-by: gsd-doc-writer -->
# CSRM configuration

Paths are relative to the repository root. Copy `apps/backend/.env.example` to the ignored backend .env and `apps/csrm/.env.local.example` to the ignored web .env.local. Never commit actual credentials. Restart the relevant server after environment changes.

## Configuration files

| File | Purpose |
|---|---|
| `apps/backend/config/server.ts` | Bind address, port and application keys |
| `apps/backend/config/admin.ts` | Admin secrets and token salts |
| `apps/backend/config/database.ts` | Database connection, SSL and pool |
| `apps/backend/config/ai.ts` | AI operation settings |
| `apps/backend/config/plugins.ts` | Upload provider and plugin security |
| `apps/backend/config/middlewares.ts` | HTTP hardening and CORS |
| `apps/csrm/next.config.ts` | Security headers, upload limits and build directory |
| `turbo.json` | Task dependencies and outputs |
| `pnpm-workspace.yaml` | Workspace, overrides and allowed dependency builds |

## Web environment

| Variable | Required | Default | Description |
|---|---|---|---|
| `CSRM_API_BASE_URL` | API use | No transport default | Absolute HTTP(S) REST base ending in /api; no credentials, query or fragment |
| `CSRM_API_TOKEN` | Authenticated transport | None | Full access Strapi token, kept server-side |
| `CSRM_DEV_IDENTITY` | Fixture header | Example: true | Development identity handoff within runtime gates |
| `CSRM_AUTH_OIDC_ENABLED` | No | false/unset | OIDC replaces fixture sign-in |
| `AUTH_URL` | OIDC | None | Exact registered browser origin; HTTPS in production |
| `AUTH_SECRET` | OIDC | None | At least 32 characters |
| `AUTH_KEYCLOAK_ID`, `AUTH_KEYCLOAK_SECRET` | OIDC | None | Confidential client credentials |
| `AUTH_KEYCLOAK_ISSUER` | OIDC | None | Realm issuer; HTTPS in production |
| `CSRM_NEXT_DIST_DIR` | No | Normal Next build directory | Isolated output; selects tsconfig.e2e.json |

OIDC accepts only unset/empty/false or true flag values. Other values and incomplete OIDC settings fail startup. Fixture sign-in works under next dev; a production build permits it only in the attested E2E harness. Do not use test attestation settings in a deployment.

## Backend environment

| Variable | Required | Default | Description |
|---|---|---|---|
| `HOST`, `PORT` | No | 0.0.0.0, 1337 | Server bind |
| `APP_KEYS` | Yes | Example placeholders | Application keys |
| `ADMIN_JWT_SECRET`, `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY` | Supply secrets | Example placeholders | Admin/token/plugin/encryption configuration |
| `csrmAppIsEnabled` | CSRM routes | Enabled only by exact true | Case-sensitive route gate |
| `IDAMBOX_SEED_CORE`, `IDAMBOX_SEED_CSRM` | No | Example: true | Local core and CSRM seed data |
| `CSRM_DEV_IDENTITY`, `CSRM_ENVIRONMENT` | Fixture identity | Example: true, development | Backend also requires NODE_ENV=development |
| `CSRM_DEV_API_TOKEN` | Test-only | Empty | Leave unset in ordinary development |
| `CSRM_CORS_ALLOWED_ORIGINS` | No | Empty | Exact trusted origins; CSRM server calls need none |
| `STRAPI_ADMIN_AUTO_OPEN` | No | true | Open admin browser at startup |

### Database

`DATABASE_CLIENT` defaults to sqlite and `DATABASE_FILENAME` to .tmp/data.db under the backend. Configuration also has postgres and mysql branches, but their drivers are not declared in the backend package.

Those branches use `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USERNAME` and `DATABASE_PASSWORD`. Defaults are localhost, the engine's usual port, and strapi for name/user/password. PostgreSQL additionally supports `DATABASE_URL` and `DATABASE_SCHEMA` (public). Replace credential defaults before deployment. SSL uses `DATABASE_SSL` and the DATABASE_SSL_* settings in the config. Pool defaults are min 2/max 10 and connection timeout is 60000 ms.

### Keycloak

| Variable | Required | Default | Description |
|---|---|---|---|
| `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION` | OIDC actor resolution | false | Verify caller token; ignore fixture header |
| `KEYCLOAK_ISSUER`, `KEYCLOAK_TOKEN_CLIENT_ID` | Verification | None | Issuer, expected audience and authorised party |
| `IDAMBOX_KEYCLOAK_PROVISIONING` | No | false | Mirror IdamBox User writes |
| `KEYCLOAK_BASE_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET` | Provisioning | None in validator | Admin service-account connection |
| `KEYCLOAK_REQUEST_TIMEOUT_MS` | No | 5000 | Per-request timeout |

Token verification is required for the web OIDC mode to resolve its actor in Strapi. Provisioning is optional; a failure blocks the user save. Production issuers require HTTPS. The example client secrets are local-only.

## AI settings

| Variable | Required | Default | Description |
|---|---|---|---|
| `CSRM_AI_PROVIDER` | No | deterministic | deterministic or openai-compatible |
| `CSRM_AI_PROVIDER_LABEL` | No | openai-compatible | Provider label |
| `CSRM_AI_STRUCTURED_OUTPUT` | No | true | Structured-output request; responses are always validated |
| `CSRM_AI_REQUEST_TIMEOUT_MS` | No | 60000 | Request bound |
| `CSRM_AI_REASONING_EFFORT` | No | Empty | Optional compatible-provider setting |
| `CSRM_AI_ASSESSMENT_BASE_URL`, `CSRM_AI_ASSESSMENT_MODEL` | Compatible provider | None | Assessment endpoint and model |
| `CSRM_AI_QUESTIONNAIRE_BASE_URL`, `CSRM_AI_QUESTIONNAIRE_MODEL` | Compatible provider | None | Questionnaire endpoint and model |
| `CSRM_AI_ASSESSMENT_API_KEY`, `CSRM_AI_QUESTIONNAIRE_API_KEY` | If endpoint needs keys | Empty | Operation-specific credentials |
| `CSRM_AI_ASSESSMENT_MAX_OUTPUT_TOKENS` | No | 8000 | Assessment output cap |
| `CSRM_AI_QUESTIONNAIRE_MAX_OUTPUT_TOKENS` | No | 16000 | Questionnaire output cap |
| `CSRM_AI_DATA_CLASSIFICATION_CEILING` | Outside development | Empty | Public, Internal, Restricted or Critical Infrastructure Sensitive |
| `CSRM_AI_COMPLETION_TRANSCRIPT_DIAGNOSTICS` | No | false | Development-only diagnostics |

Both NODE_ENV and CSRM_ENVIRONMENT must be development to allow an empty ceiling. Elsewhere generation is refused until it is set. Use the commented compatible-provider block in the backend example as a local reference. AI remains advisory and cannot release an assessment.

<!-- VERIFY: Confirm the deployed endpoint, available model, complete-context capacity and approved classification ceiling with the operator. -->

## Request attachments

| Variable | Required | Default | Description |
|---|---|---|---|
| `CSRM_ATTACHMENT_STORAGE` | Outside development to enable files | local in development | local or s3 |
| `CSRM_ATTACHMENT_LOCAL_DIR` | No for local | .tmp/attachments | Private directory outside public |
| `CSRM_ATTACHMENT_S3_BUCKET`, `CSRM_ATTACHMENT_S3_KMS_KEY_ID` | s3 | None | Bucket and SSE-KMS key |
| `CSRM_ATTACHMENT_S3_REGION` | No | ap-southeast-2 | Storage region |
| `CSRM_ATTACHMENT_S3_ENDPOINT` | No | AWS provider default | Compatible endpoint; HTTPS outside development |
| `CSRM_ATTACHMENT_SCANNER` | Outside development to enable files | development in development | development or clamav |
| `CSRM_CLAMAV_HOST`, `CSRM_CLAMAV_PORT` | clamav | None | Private TCP endpoint |
| `CSRM_CLAMAV_TIMEOUT_MS` | No | 60000 | Allowed range 1000–600000 ms |

Unset storage or scanner outside development disables attachments while the rest of CSRM runs. Invalid or incomplete selected settings stop startup. The development scanner is refused outside development. S3 credentials use the standard AWS provider chain.

[Backend README](../../apps/backend/README.md) records bucket, backup, IAM, scanner and proxy requirements.

<!-- VERIFY: Confirm the deployed private bucket, SSE-KMS policy, backups, ClamAV signatures and reverse-proxy limits; source configuration cannot prove deployed infrastructure. -->

## Minimal local configuration

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/csrm/.env.local.example apps/csrm/.env.local
pnpm dev
```

Create the Strapi token and replace the web placeholder as described in [Getting started](../guides/getting-started.md).
