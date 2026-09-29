# 🚀 Build and run instructions
```
cp .env.example .env
yarn install
yarn dev
```

# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

## AI provider configuration

The default provider is deterministic. Set `CSRM_AI_PROVIDER=openai-compatible` to use a compatible endpoint. Assessment drafting and questionnaire generation have independent `BASE_URL`, `API_KEY`, and `MODEL` triples, so each operation can use a different endpoint and model without a code change. Any compatible backend is reached by changing its base URL and model; a backend with a different wire format can be reached through an operator-managed translating gateway.

An API key is optional: leave it blank for a keyless self-hosted server. Trust for a private certificate authority is an operating-system deployment concern; configure it with `NODE_EXTRA_CA_CERTS`, not an application setting.

Structured output is enabled by default. Disable `CSRM_AI_STRUCTURED_OUTPUT` only for a backend that rejects or silently ignores the structured-output request field. Responses are still checked against the closed shape, so compatibility layers that return unconstrained text fail safely as invalid output.

`CSRM_AI_REQUEST_TIMEOUT_MS` defaults to 60 seconds. The output caps default to 8,000 tokens for assessment drafts and 16,000 for questionnaires; requests use the classic chat-completions output-cap field. If a reasoning endpoint requires a newer field name, place a translating gateway in front of it.

Context-window sizing is an operator responsibility. The application never trims, samples, or clips questionnaire answers, Risk Types, or Control reference data to fit a smaller window. Configure a model that can hold the complete context; otherwise the job fails loudly rather than silently dropping risk-relevant data. Automated test runs force the deterministic provider regardless of `.env` contents.

## Keycloak user provisioning

When enabled, every `IdamBox User` create, and every update that changes `email`, `username`, `firstName`, `lastName`, `displayName`, `accountStatus` or `password`, is mirrored into Keycloak through the Admin API (`src/keycloak/`). Strapi stores the Keycloak user id in `externalSubject` and clears the `password` input. The password is only a write-once provisioning input and is never kept, not even as a hash. `accountStatus: inactive` disables the Keycloak account. Design and trade-offs: [ADR 0002](../../docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md).

It is **off by default** (`IDAMBOX_KEYCLOAK_PROVISIONING=false`). When it is off, Strapi reads no other `KEYCLOAK_*` value, creates no admin client, registers no hook and makes no Keycloak call, so local development and the test suite need no Keycloak. Automated test runs force it off regardless of `.env` contents.

A Keycloak failure **blocks the Strapi user save**. The Strapi write and the Keycloak call share one database transaction, so an unreachable, slow or rejecting Keycloak rolls the save back and the request fails. Retry once Keycloak is available. Provisioning is idempotent: it looks up the account by `externalSubject`, then by email, and adopts an existing account instead of duplicating it.

### Enabling it in production

1. **Create a dedicated client** in the realm that holds IdamBox users. Do not use the `master` realm or the bootstrap admin account. Make it a confidential OpenID Connect client with *Client authentication* and *Service accounts roles* on, and *Standard flow*, *Direct access grants* and *Implicit flow* off. The local seed's `idambox-strapi-admin` client in `idp/keycloak/import/idambox-realm.json` is the reference shape.
2. **Grant least privilege.** Give the client's service account the `realm-management` client role `manage-users` and nothing else. `manage-users` already includes viewing and querying users, so `view-users` and `query-users`, which the local seed also grants, are redundant. Never grant `realm-admin`, `manage-realm` or `manage-clients`. `manage-users` can still reset any password in that realm, so keep Keycloak's own administrators out of the IdamBox realm.
3. **Declare the `displayName` attribute** in the realm's *User profile* (Realm settings → User profile), or enable unmanaged attributes. Keycloak 24+ otherwise drops attributes it does not know.
4. **Set the environment** from your secret store, never from a committed file:

   ```env
   IDAMBOX_KEYCLOAK_PROVISIONING=true
   KEYCLOAK_BASE_URL=https://sso.example.com        # no trailing /realms, no credentials
   KEYCLOAK_REALM=idambox
   KEYCLOAK_ADMIN_CLIENT_ID=<client id from step 1>
   KEYCLOAK_ADMIN_CLIENT_SECRET=<client secret from step 1>
   # KEYCLOAK_REQUEST_TIMEOUT_MS=5000                # optional, per request
   ```

   The committed `idambox-strapi-admin-local-secret` is a local-only value for `idp/docker-compose.yml`. It must never be used outside local development. A missing or malformed value stops Strapi at startup with an error that names the variable but never its value.
5. **Use PostgreSQL or MySQL.** The user write holds a database transaction open during the Keycloak calls, each bounded by `KEYCLOAK_REQUEST_TIMEOUT_MS`. SQLite would lock all writes for that time.
6. **Verify.** On boot Strapi logs `Keycloak user provisioning is enabled for realm "…" at …`. Create a test IdamBox User and confirm that the Keycloak account exists and that `externalSubject` holds its id. A failure is logged as `Keycloak provisioning failed for IdamBox user <documentId>; the <action> is rolled back. …` with the HTTP status and Keycloak's error code only.

Operational notes:

- **Existing users** are linked the next time they are updated. Any update of a user without `externalSubject` provisions it.
- **Deletes are not propagated.** Set `accountStatus` to `inactive`, which disables the Keycloak account, before deleting an IdamBox User.
- **Usernames** are immutable in Keycloak by default, so a changed Strapi `username` is not propagated. Change it in both places deliberately.
- **Rotating the client secret** needs a Strapi restart. The admin token is cached in memory until shortly before it expires, and a rejected token is refreshed once automatically.

To exercise it locally against the seeded Keycloak, start `idp/` with `docker compose up -d` (see `idp/README.md`), copy the `KEYCLOAK_*` block from `.env.example` into `.env`, set `IDAMBOX_KEYCLOAK_PROVISIONING=true`, and restart Strapi.

## Keycloak access-token verification

When the web signs people in through Keycloak (`CSRM_AUTH_OIDC_ENABLED=true` in `apps/csrm`), it forwards the caller's own access token in `x-csrm-identity-token`. With `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true`, `global::csrm-keycloak-identity` verifies it against the realm JWKS (RS256, issuer, expiry, the CSRM client as audience and authorized party, `typ: Bearer`) and resolves the **active** IdamBox User whose `externalSubject` equals its `sub`. The CSRM authorization policy then enforces Role -> Function -> FunctionApi for that person exactly as for any other identity. Any unusable token is the ordinary 403, with the reason logged by error name only. Design: [ADR 0004](../../docs/adr/0004-strapi-verifies-keycloak-access-tokens.md).

It is **off by default**. While it is on, the development `x-csrm-dev-identity` header is ignored, whatever `CSRM_DEV_IDENTITY` says; development seeding still runs. Automated test runs force it off unless a test turns it on deliberately.

```env
IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true
KEYCLOAK_ISSUER=https://sso.example.com/realms/idambox   # exactly the token's iss; https in production
KEYCLOAK_TOKEN_CLIENT_ID=idambox-csrm                     # the web's OIDC client
# KEYCLOAK_REQUEST_TIMEOUT_MS=5000                        # optional, JWKS fetch timeout
```

The realm must give the client the `basic` default scope (so the access token carries `sub`) and an audience mapper adding the client id to the access token; `idp/keycloak/import/idambox-realm.json` has both. Every person who signs in needs `externalSubject` set, which Keycloak user provisioning (above) writes. Locally, the development seed links the fixture people Jane and Bob to the fixed ids the local realm gives them, as long as provisioning is off.

`GET /api/v1/me/access` returns the caller's own display name, menu Functions and granted FunctionApi operations. Every Role holds it, and the web derives its navigation from it.

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
