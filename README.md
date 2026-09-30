# IdamBox Cyber Risk Manager (CSRM)

This Turborepo contains the Next.js client in `apps/csrm` and the Strapi API in `apps/backend`.

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
   cp apps/backend/.env.example apps/backend/.env
   ```

### AI generation with Ollama (optional)

CSRM defaults to deterministic AI assistance. To generate questionnaires and
assessment drafts with a locally hosted model, install Ollama using the
[official Ollama installation instructions](https://ollama.com/download), then
download the supported model:

```sh
ollama pull qwen3.5:9b
```

Copy the commented `Local Ollama (OpenAI-compatible) configuration` block from
`apps/backend/.env.example` into the gitignored `apps/backend/.env` file and
remove the leading `# ` from each assignment. Restart Strapi after saving the
file. The configuration applies `qwen3.5:9b` to questionnaire generation and
assessment-draft generation. Generated content remains advisory and reviewable;
it cannot release an assessment.

### SaaS OpenAI-compatible AI providers (optional)

To use an approved SaaS OpenAI-compatible provider instead, edit only your
local `apps/backend/.env` file. Set `CSRM_AI_PROVIDER=openai-compatible`, replace
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
   cp apps/csrm/.env.local.example apps/csrm/.env.local
   ```

4. Start both development servers through Turborepo.

   ```sh
   pnpm dev
   ```

5. Create a Strapi admin user - important for doing agent coding:

   ```sh
   cd apps/backend

   pnpm run strapi admin:create-user --firstname=John --lastname=Doe --email=dev@bproton.com --password='Strapi123!'
   ```

   If you are using a Windows Command Prompt then use double quotes like so:

   ```dos
   cd apps\backend

   pnpm run strapi admin:create-user --firstname=John --lastname=Doe --email=dev@bproton.com --password="Strapi123!"
   ```

6. Update the apps/csrm/.env.local file with the Strapi Full Access API token from http://localhost:1337/admin

   ```sh
   vi apps/csrm/.env.local
   [set CSRM_API_TOKEN]
   ```

Now you can logon to the CSRM app at http://localhost:3000.

Note that the secrets in `apps/backend/.env.example` are local-development placeholders only. Use real secrets in your local environment and never commit them.

## Run the backend and CSRM with Keycloak sign-in

By default the CSRM web signs in through the development identity bridge and needs no Keycloak. These steps switch both applications to real Keycloak OIDC sign-in instead: the web (`apps/csrm`) signs people in against the local Keycloak in `idp/`, and Strapi (`apps/backend`) verifies each caller's Keycloak access token and applies their IdamBox Role -> Function -> FunctionApi grants. The design is recorded in `docs/adr/0003-production-only-keycloak-oidc-sign-in.md` and `docs/adr/0004-strapi-verifies-keycloak-access-tokens.md`.

Every value below is a local-development value from `idp/README.md`. Never reuse them outside local development.

1. Re-initialise Keycloak so it imports the current realm (`idp/keycloak/import/idambox-realm.json`). Keycloak skips the import when a realm already exists in its Docker volume, so an older container still carries the previous realm and Strapi will refuse its tokens. `down -v` deletes that volume, including any changes made in the Keycloak admin console.

   ```sh
   cd idp
   docker compose down -v
   docker compose up -d
   cd ..
   ```

   Wait until `http://localhost:8080/realms/idambox/.well-known/openid-configuration` responds. Keycloak must be running before Strapi starts, because Strapi provisions the seeded users into it at boot.

2. Configure Strapi in `apps/backend/.env` (copy it from `apps/backend/.env.example` if it does not exist yet):

   ```env
   # Local development seeding: creates the Role -> Function -> FunctionApi catalogue
   # and the IdamBox Users jane.doe@idambox.com (Requestor) and bob.doe@idambox.com
   # (Security Analyst).
   IDAMBOX_SEED_CORE=true
   IDAMBOX_SEED_CSRM=true
   CSRM_DEV_IDENTITY=true
   CSRM_ENVIRONMENT=development

   # Strapi -> Keycloak user provisioning (docs/adr/0002). Saves IdamBox User
   # changes, including passwords, to Keycloak and writes the Keycloak user id
   # back to the user's externalSubject.
   IDAMBOX_KEYCLOAK_PROVISIONING=true
   KEYCLOAK_BASE_URL=http://localhost:8080
   KEYCLOAK_REALM=idambox
   KEYCLOAK_ADMIN_CLIENT_ID=idambox-strapi-admin
   KEYCLOAK_ADMIN_CLIENT_SECRET=idambox-strapi-admin-local-secret

   # Keycloak access-token verification (docs/adr/0004). Strapi verifies the token
   # the web forwards in x-csrm-identity-token and resolves the IdamBox User whose
   # externalSubject equals the token's sub. While this is true, the development
   # x-csrm-dev-identity header is ignored.
   IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true
   KEYCLOAK_ISSUER=http://localhost:8080/realms/idambox
   KEYCLOAK_TOKEN_CLIENT_ID=idambox-csrm
   ```

   `CSRM_DEV_IDENTITY=true` and `CSRM_ENVIRONMENT=development` are kept only so the development seed still runs. With token verification on, Strapi ignores the development identity header.

3. Configure the web in `apps/csrm/.env.local` (copy it from `apps/csrm/.env.local.example` if it does not exist yet):

   ```env
   CSRM_API_BASE_URL=http://localhost:1337/api
   # Full-access Strapi API token (Strapi admin > Settings > API Tokens). Required in
   # OIDC mode: every CSRM route sits behind it.
   CSRM_API_TOKEN=<full-access token from Strapi admin>

   # Keycloak OIDC sign-in. Turns the development identity bridge off, so
   # CSRM_DEV_IDENTITY is ignored.
   CSRM_AUTH_OIDC_ENABLED=true
   # The exact browser origin Keycloak has registered: use localhost, not 127.0.0.1.
   AUTH_URL=http://localhost:3000
   # At least 32 characters. Generate it with: openssl rand -base64 32
   AUTH_SECRET=<generated secret>
   AUTH_KEYCLOAK_ID=idambox-csrm
   AUTH_KEYCLOAK_SECRET=idambox-csrm-local-secret
   AUTH_KEYCLOAK_ISSUER=http://localhost:8080/realms/idambox
   ```

   The web stops at startup, naming the variable but never its value, if any `AUTH_*` value is missing or malformed.

4. Start both applications from the repository root.

   ```sh
   pnpm dev
   ```

   Strapi logs `Keycloak user provisioning is enabled for realm "idambox"` and `Keycloak access-token verification is enabled for issuer http://localhost:8080/realms/idambox`. If you have not created a Strapi admin user and a full-access API token yet, do that now (see "Build and run locally" above), put the token in `CSRM_API_TOKEN`, and restart `pnpm dev`.

5. Log on to the Strapi admin at `http://localhost:1337/admin` and set the passwords for `jane.doe` and `bob.doe`:

   1. Open **Content Manager > IdamBox User**.
   2. Open `jane.doe@idambox.com`, enter a password (at least 6 characters) in **password**, and click **Save**.
   3. Repeat for `bob.doe@idambox.com`.

   Provisioning sets each password in Keycloak and stores the Keycloak user id in the user's `externalSubject`. Strapi never keeps the password, not even as a hash. If Keycloak is not reachable, the save fails and nothing is written, so check step 1 and save again.

6. Open `http://localhost:3000`, choose **Continue to IdamBox sign-in**, and sign in to Keycloak:

   - `jane.doe` sees the Requestor screens.
   - `bob.doe` sees the Security Analyst screens.

   Strapi decides what each person can reach, from the grants returned by `GET /api/v1/me/access`. **Sign out** ends the Keycloak session as well.

Troubleshooting: if you are signed in but see "You don't have access to this area" with no menu, Strapi did not resolve your identity. Check that `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true` is set and Strapi was restarted, that step 1 re-imported the realm, and that the user's `externalSubject` is filled in the Strapi admin. Strapi logs `CSRM Keycloak identity failed closed (<error name>)` for each refused token.

To return to the development identity bridge, set `CSRM_AUTH_OIDC_ENABLED=false` in `apps/csrm/.env.local` and `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=false` in `apps/backend/.env`, then restart.
