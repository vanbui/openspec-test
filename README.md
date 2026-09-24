# IdamBox Cyber Risk Manager (CSRM)

This Turborepo contains the Next.js client in `apps/web` and the Strapi API in `apps/strapi`.

## Prerequisites

- Node.js `>=24.19.0 <25`
- pnpm `11.24.0`

## Build and run locally

Run these steps from the repository root.

1. Install the workspace dependencies.

   ```sh
   pnpm install
   ```

2. Create the local Strapi configuration.

   ```sh
   cp apps/strapi/.env.example apps/strapi/.env
   ```

### AI generation with Ollama

CSRM defaults to deterministic AI assistance. To generate questionnaires and
assessment drafts with a locally hosted model, install Ollama using the
[official Ollama installation instructions](https://ollama.com/download), then
download the supported model:

```sh
ollama pull qwen3.5:9b
```

Copy the commented `Local Ollama (OpenAI-compatible) configuration` block from
`apps/strapi/.env.example` into the gitignored `apps/strapi/.env` file and
remove the leading `# ` from each assignment. Restart Strapi after saving the
file. The configuration applies `qwen3.5:9b` to questionnaire generation and
assessment-draft generation. Generated content remains advisory and reviewable;
it cannot release an assessment.

### SaaS OpenAI-compatible AI providers

To use an approved SaaS OpenAI-compatible provider instead, edit only your
local `apps/strapi/.env` file. Set `CSRM_AI_PROVIDER=openai-compatible`, replace
both `CSRM_AI_ASSESSMENT_BASE_URL` and `CSRM_AI_QUESTIONNAIRE_BASE_URL` with the
service endpoints, and set the corresponding `*_MODEL` values to the service's
model names. Put service-issued API keys only in `CSRM_AI_ASSESSMENT_API_KEY`
and `CSRM_AI_QUESTIONNAIRE_API_KEY`; never add credentials to `.env.example` or
commit `.env`. When required by the provider, tune structured output, request
timeout, reasoning effort, and each operation's maximum output tokens. Restart
Strapi after changing these settings. AI output remains advisory and cannot
release an assessment.

3. Create the local CSRM web configuration.

   ```sh
   cp apps/web/.env.local.example apps/web/.env.local
   ```

4. Update the apps/strapi/.env and apps/web/.env.local file with the Strapi Full Access token

   ```sh
   vi apps/strapi/.env
   [set CSRM_DEV_API_TOKEN]

   vi apps/web/.env.local
   [set CSRM_API_TOKEN]
   ```

5. Start both development servers through Turborepo.

   ```sh
   pnpm dev
   ```

6. Create a Strapi admin user:

   ```sh
   cd apps/strapi

   pnpm run strapi admin:create-user \
  --firstname=John \
  --lastname=Doe \
  --email=dev@bproton.com \
  --password='Strapi123!'
   ```

Open the web client at http://localhost:3000 and Strapi admin at http://localhost:1337/admin.

The secrets in `apps/strapi/.env.example` are local-development placeholders only. Use real secrets in your local environment and never commit them.
