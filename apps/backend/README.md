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

`CSRM_AI_REQUEST_TIMEOUT_MS` defaults to 60 seconds. The output caps default to 8,000 tokens for assessment drafts and 16,000 for questionnaires; requests use `max_completion_tokens` when the endpoint hostname is `api.openai.com`, and `max_tokens` for other compatible endpoints. If another endpoint requires a different field name, place a translating gateway in front of it.

Context-window sizing is an operator responsibility. The application never trims, samples, or clips questionnaire answers, Risk Types, or Control reference data to fit a smaller window. Configure a model that can hold the complete context; otherwise the job fails loudly rather than silently dropping risk-relevant data. Automated test runs force the deterministic provider regardless of `.env` contents.

## Keycloak user provisioning

When enabled, every `IdamBox User` create, and every update that changes `email`, `username`, `firstName`, `lastName`, `displayName`, `accountStatus` or `password`, is mirrored into Keycloak through the Admin API (`src/keycloak/`). Strapi stores the Keycloak user id in `externalSubject` and clears the `password` input. The password is only a write-once provisioning input and is never kept, not even as a hash. `accountStatus: inactive` disables the Keycloak account. Design and trade-offs: [ADR 0002](../../docs/adr/0002-keycloak-provisioning-blocks-the-user-write.md).

It is **off by default** (`IDAMBOX_KEYCLOAK_PROVISIONING=false`). When it is off, Strapi reads no other `KEYCLOAK_*` value, creates no admin client, registers no hook and makes no Keycloak call, so local development and the test suite need no Keycloak. Automated test runs force it off regardless of `.env` contents.

A Keycloak failure **blocks the Strapi user save**. The Strapi write and the Keycloak call share one database transaction, so an unreachable, slow or rejecting Keycloak rolls the save back and the request fails. Retry once Keycloak is available. Provisioning is idempotent: it looks up the account by `externalSubject`, then by email, and adopts an existing account instead of duplicating it.

### Enabling it in production

1. **Create a dedicated client** in the realm that holds IdamBox users. Do not use the `master` realm or the bootstrap admin account. Make it a confidential OpenID Connect client with *Client authentication* and *Service accounts roles* on, and *Standard flow*, *Direct access grants* and *Implicit flow* off. The local seed's `idambox-strapi-admin` client in `docker/keycloak/import/idambox-realm.json` is the reference shape.
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

   The committed `idambox-strapi-admin-local-secret` is a local-only value for `docker/docker-compose.yaml`. It must never be used outside local development. A missing or malformed value stops Strapi at startup with an error that names the variable but never its value.
5. **Use PostgreSQL or MySQL.** The user write holds a database transaction open during the Keycloak calls, each bounded by `KEYCLOAK_REQUEST_TIMEOUT_MS`. SQLite would lock all writes for that time.
6. **Verify.** On boot Strapi logs `Keycloak user provisioning is enabled for realm "…" at …`. Create a test IdamBox User and confirm that the Keycloak account exists and that `externalSubject` holds its id. A failure is logged as `Keycloak provisioning failed for IdamBox user <documentId>; the <action> is rolled back. …` with the HTTP status and Keycloak's error code only.

Operational notes:

- **Existing users** are linked the next time they are updated. Any update of a user without `externalSubject` provisions it.
- **Deletes are not propagated.** Set `accountStatus` to `inactive`, which disables the Keycloak account, before deleting an IdamBox User.
- **Usernames** are immutable in Keycloak by default, so a changed Strapi `username` is not propagated. Change it in both places deliberately.
- **Rotating the client secret** needs a Strapi restart. The admin token is cached in memory until shortly before it expires, and a rejected token is refreshed once automatically.

To exercise it locally against the seeded Keycloak, start `docker/` with `docker compose up -d` (see `docker/README.md`), copy the `KEYCLOAK_*` block from `.env.example` into `.env`, set `IDAMBOX_KEYCLOAK_PROVISIONING=true`, and restart Strapi.

## Keycloak access-token verification

When the web signs people in through Keycloak (`CSRM_AUTH_OIDC_ENABLED=true` in `apps/csrm`), it forwards the caller's own access token in `x-csrm-identity-token`. With `IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true`, `global::csrm-keycloak-identity` verifies it against the realm JWKS (RS256, issuer, expiry, the CSRM client as audience and authorized party, `typ: Bearer`) and resolves the **active** IdamBox User whose `externalSubject` equals its `sub`. The CSRM authorization policy then enforces Role -> Function -> FunctionApi for that person exactly as for any other identity. Any unusable token is the ordinary 403, with the reason logged by error name only. Design: [ADR 0004](../../docs/adr/0004-strapi-verifies-keycloak-access-tokens.md).

It is **off by default**. While it is on, the development `x-csrm-dev-identity` header is ignored, whatever `CSRM_DEV_IDENTITY` says; development seeding still runs. Automated test runs force it off unless a test turns it on deliberately.

```env
IDAMBOX_KEYCLOAK_TOKEN_VERIFICATION=true
KEYCLOAK_ISSUER=https://sso.example.com/realms/idambox   # exactly the token's iss; https in production
KEYCLOAK_TOKEN_CLIENT_ID=idambox-csrm                     # the web's OIDC client
# KEYCLOAK_REQUEST_TIMEOUT_MS=5000                        # optional, JWKS fetch timeout
```

The realm must give the client the `basic` default scope (so the access token carries `sub`) and an audience mapper adding the client id to the access token; `docker/keycloak/import/idambox-realm.json` has both. Every person who signs in needs `externalSubject` set, which Keycloak user provisioning (above) writes. Locally, the development seed links the fixture people Jane and Bob to the fixed ids the local realm gives them, as long as provisioning is off.

`GET /api/v1/me/access` returns the caller's own display name, menu Functions and granted FunctionApi operations. Every Role holds it, and the web derives its navigation from it.

## Request attachments (Phase 14)

Requestors and Security Analysts add files to a request (COLLAB-02). Strapi screens every file (type by content, size, name, malware scan), stores it privately byte for byte, and serves it only through `GET /api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content` to a person who may read the request. No storage URL ever leaves Strapi. The design and its decisions are in `docs/contract-gaps/phase-14-request-attachments.md` and `.planning/workstreams/csrm/phases/14-request-attachments/14-CONTEXT.md` (D-06 to D-25).

### Settings

One module reads these ten settings once, at boot (`src/csrm/files/attachment-config.ts`). `apps/backend/.env.example` lists them, commented, with their development defaults and the production blocks.

| Setting | Development default | Meaning |
|---|---|---|
| `CSRM_ATTACHMENT_STORAGE` | `local` | `local` (private files on this host) or `s3` (production). |
| `CSRM_ATTACHMENT_LOCAL_DIR` | `.tmp/attachments` | The private directory for `local` storage, resolved from the app root. It may not be inside `public/`. |
| `CSRM_ATTACHMENT_SCANNER` | `development` | `development` (the deterministic test double) or `clamav` (production). |
| `CSRM_ATTACHMENT_S3_BUCKET` | none | The bucket, for `s3`. Required with `s3`. |
| `CSRM_ATTACHMENT_S3_REGION` | `ap-southeast-2` | The bucket's region, for `s3`. |
| `CSRM_ATTACHMENT_S3_KMS_KEY_ID` | none | The KMS key that encrypts every object (SSE-KMS), for `s3`. Required with `s3`. |
| `CSRM_ATTACHMENT_S3_ENDPOINT` | none | Only for an S3-compatible store (path-style addressing). Leave it unset for AWS S3. It must be an `https://` URL: outside development an `http:` endpoint stops the boot, because it would carry every file's bytes and every presigned read in cleartext. |
| `CSRM_CLAMAV_HOST` | none | The `clamd` host, for `clamav`. Required with `clamav`. |
| `CSRM_CLAMAV_PORT` | none | The `clamd` TCP port, for `clamav`. Required with `clamav`. |
| `CSRM_CLAMAV_TIMEOUT_MS` | `60000` | The whole scan's timeout, from 1,000 to 600,000 ms. |

The rules:

- **Development** (`NODE_ENV` and `CSRM_ENVIRONMENT` both `development`) needs nothing set. Files go to private local storage under `.tmp/attachments` (git-ignored), and the development scanner checks them.
- **Everywhere else, an unset storage or scanner turns attachments off.** Every upload is refused with `ATTACHMENTS_NOT_CONFIGURED`, the request read says so, and the web offers no upload. The rest of CSRM runs, because failing the boot would take the whole product down for one feature.
- **A mistake stops the boot** with a message that names the setting and never its value: an unknown value, an incomplete S3 or ClamAV block, an S3 endpoint that is not `https://` outside development, a local directory inside the folder Strapi serves (`public/`), a `baseUrl` on the upload provider, or the development scanner outside development. A test double never guards production.
- **S3 credentials are never a setting.** They come from the environment's standard AWS provider chain (an instance or task role, preferably).
- **Both test harnesses pin their own temporary directory and the development scanner**, so a developer's `.env` never changes a test, and a run leaves the tree clean.

### Production storage: a private S3 bucket

`CSRM_ATTACHMENT_STORAGE=s3` uses the official `@strapi/provider-upload-aws-s3`, pinned to the Strapi version. CSRM configures it to send no ACL header, to encrypt with SSE-KMS and the configured key, to store objects under `csrm/attachments/`, and to read only through 60-second presigned `GetObject` URLs that Strapi fetches server-side and never returns. The bucket itself is deployment configuration:

1. **Block Public Access on**, all four settings, on the bucket (and on the account).
2. **Object Ownership "Bucket owner enforced"**, so ACLs are disabled. CSRM sends none, and an upload that carried a public ACL would be refused.
3. **Default encryption SSE-KMS** with the same customer-managed key as `CSRM_ATTACHMENT_S3_KMS_KEY_ID`, with an S3 Bucket Key if the request volume warrants it.
4. **Versioning on**, so an accidental or malicious delete or overwrite can be recovered within the noncurrent-version window of step 5.
5. **Lifecycle rules on the `csrm/attachments/` prefix** (since the Phase 14 code review, 2026-10-11). Files are kept at least 7 years after their request's closure (D-22), but S3 lifecycle rules count from an object's creation, not from a request's closure, and they can only expire or move objects, never enforce a minimum retention. So the rules:
   - **never expire current objects;**
   - **expire noncurrent versions 30 days after they become noncurrent** (`NoncurrentVersionExpiration` with `NoncurrentDays: 30`). The provider's delete is a plain `DeleteObject`, which under versioning only adds a delete marker and keeps the deleted bytes as a noncurrent version. CSRM never deletes a retained attachment's bytes, so a noncurrent version exists only for bytes that must not be kept or that an administrator deleted. The window bounds how long a blocked file's malware survives as a noncurrent version, and keeps versioning as a 30-day undo of an administrator's deletion (R-08-46);
   - **abort incomplete multipart uploads after 1 day** (`AbortIncompleteMultipartUpload` with `DaysAfterInitiation: 1`). The provider sends a file over 5 MiB in parts, and the parts of an upload that failed part-way are otherwise kept, invisible to listings and to the other rules;
   - **move objects, if at all, only to a storage class that answers `GetObject` at once:** S3 Standard-IA, S3 Glacier Instant Retrieval, or S3 Intelligent-Tiering without its opt-in Archive Access and Deep Archive Access tiers. Never move current objects to S3 Glacier Flexible Retrieval or S3 Glacier Deep Archive: S3 refuses to read an archived object until it is restored (403 `InvalidObjectState`), so its download and its text extraction for the AI would fail with a 500.

   **Long-term protection is a backup in a separate AWS account**, not the lifecycle rules: AWS Backup into a vault in that account, or replication to a bucket there, kept for at least the retention period and out of reach of Strapi's role. With replication, also replicate delete markers, so a blocked file's deletion reaches the replica. A backup taken while a file was waiting for its malware check holds its bytes for the backup's own retention, so restores from it are an operator's action (R-08-46). Object Lock is not used, because blocked files must be deletable.

   **When CSRM deletes stored bytes.** Never on removal: removal is soft and keeps the bytes. CSRM deletes them only for content that must not be kept:
   - a **blocked** file, when a re-scan finds malware in a file stored while it waited for its malware check;
   - a **late refusal**: an upload whose bytes were stored before the request lock refused it (another upload reached the 20-file limit first, the request was released or returned to draft, the note stopped being valid, or the uploader could no longer read the request; D-10) or failed to record it;
   - the storage's own **rollback**, when the plugin's file record cannot be created after the bytes were stored.

   An administrator can also delete a file in the Media Library. Disposal after the retention period is deferred, and the period is the constant `ATTACHMENT_RETENTION_YEARS_AFTER_CLOSURE` (`src/csrm/files/attachment-policy.ts`), which Phase 22's Admin setting takes over.
6. **Least-privilege access for Strapi's role:** `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` and `s3:AbortMultipartUpload` on `arn:aws:s3:::<bucket>/csrm/attachments/*` only, and `kms:GenerateDataKey` and `kms:Decrypt` on the key only, with the key's policy admitting that role. `s3:AbortMultipartUpload` lets the provider abort a multipart upload that failed part-way. Strapi needs no bucket-level, listing or ACL permission, and must not hold `s3:GetObjectVersion` or `s3:DeleteObjectVersion`: without them its role can neither read a noncurrent version nor destroy one. Add an `s3:ResourceAccount` condition naming your own account (`"StringEquals": { "s3:ResourceAccount": "<your-account-id>" }`) to the S3 statement, so the role can never write to a bucket in another account, even one named by mistake.
7. **No `baseUrl`** (CDN) on the upload provider. With one the provider hands out unsigned URLs, so Strapi refuses to start.
8. **A bucket policy that refuses plain HTTP** (since the Phase 14 code review, 2026-10-11): deny every S3 action on the bucket and its objects, to every principal, when `aws:SecureTransport` is `false`.

   ```json
   {
     "Sid": "DenyInsecureTransport",
     "Effect": "Deny",
     "Principal": "*",
     "Action": "s3:*",
     "Resource": ["arn:aws:s3:::<bucket>", "arn:aws:s3:::<bucket>/*"],
     "Condition": { "Bool": { "aws:SecureTransport": "false" } }
   }
   ```

A blocked file's bytes are deleted, which under versioning leaves a noncurrent version until step 5's rule expires it, 30 days later. Until then it is private and encrypted, and CSRM cannot read it: it reads only current objects, and its role holds no `s3:GetObjectVersion` (R-08-46).

### Production scanning: `clamd` with `freshclam`

`CSRM_ATTACHMENT_SCANNER=clamav` streams each file to `clamd` with its `INSTREAM` command over TCP (Node's own `net`, no dependency). Run `clamd` and `freshclam` on the deployment's network, never on the build host, and let only Strapi reach its port. `clamd.conf` must set, whatever the installed release's defaults (some still default to 25M):

| Option | Value | Why |
|---|---|---|
| `StreamMaxLength` | `30M` or more | A 25 MiB file plus headroom. Below it, `clamd` refuses the stream. |
| `MaxFileSize` | `30M` or more | The same, for the file the engine scans. |
| `MaxScanSize` | `256M` or more | Office files and archives expand when scanned. |
| `AlertExceedsMax` | `yes` | A file over a limit is reported (`Heuristics.Limits.Exceeded…`) instead of silently passing as clean. |

- **`freshclam`** keeps the signatures current. Each verdict records the engine and signature version that gave it.
- **Fail closed.** If `clamd` is down, times out or reports a limit, the file is stored in quarantine (`pending`). It cannot be downloaded, read for the AI or included until a scan passes. Strapi re-scans it after 1, 5, 15 and 60 minutes, then hourly, up to 24 attempts, and at every start. A limit reply logs an error naming the setting to raise.
- **Infected files** are refused and never stored. A re-scan that finds malware in a quarantined file blocks it and deletes its bytes. Both log a warning-level `csrm.security_event` line, which the log platform should alert on.
- **Loopback or a private network only (since the Phase 14 code review, 2026-10-11).** The adapter speaks `clamd`'s plain, unauthenticated TCP protocol, so anything that can answer on `CSRM_CLAMAV_HOST:CSRM_CLAMAV_PORT` decides the verdict: a spoofed `stream: OK` would release a file. Run `clamd` on the same host (loopback) or on a private network segment that only Strapi and `clamd` share, never across the internet or a shared network, and do not expose its port anywhere else.
- **One deadline.** `CSRM_CLAMAV_TIMEOUT_MS` bounds the whole scan: the file is streamed first, and the engine's name is asked for afterwards within what is left of the same deadline. When `clamd` cannot name itself, the verdict records the adapter's name (`clamav`) and the name is not asked for again for a minute, so an outage costs one connection per scan. A Strapi shutdown aborts a re-scan in flight rather than waiting out the timeout; the file stays quarantined and is re-scanned at the next start.
- **Busy.** Strapi checks files one at a time, in one queue it shares with reading a file's text for the AI, and holds at most four more waiting. Beyond that, and for a person's second upload while their first is still being checked, it answers 503 `ATTACHMENT_BUSY` at once, and the web offers to try again. Each such refusal is an `attachment.refused` security event line. Rate-limiting a person's refused uploads is the reverse proxy's or the WAF's job (R-08-04).

### Request body limits at the reverse proxy

The web's Server Action body limit is 26 MB so that a file can be added, and the limit is global, so the web's proxy holds every POST itself: anywhere, a POST over 6 MiB, or one that does not declare its length, is answered 413 before Next reads it, and only a `multipart/form-data` POST on the four pages that add files may be larger (since the Phase 14 code review, 2026-10-11; before it, the check looked only at posts carrying `Next-Action` and skipped prefetch-headed requests). The deployment's reverse proxy in front of the web should enforce the same split, so an oversized body is refused before it reaches Node (R-08-04):

| Path | Body limit |
|---|---|
| `/app/requests/new`, `/app/requests/{id}`, `/app/requests/{id}/edit`, `/app/review/requests/{id}` | 27 MiB |
| Everything else | 6 MiB |

Strapi is never reached by browsers. If a proxy sits between the web and Strapi, it must allow 27 MiB on `POST /api/v1/assessment_requests/{id}/attachments`; Strapi refuses any file over 26,214,400 bytes itself.

### Strapi administrators and the Media Library

The upload plugin has one provider, so attachment files also appear in the admin Media Library, without previews. Administrators there can see and delete a file, but not download it (corrected after the Phase 14 code review, 2026-10-11): under S3 the provider signs a URL only for a `private` ACL, which CSRM never sends, so the admin panel gets the object's unsigned URL, which Block Public Access answers with 403; under local storage it gets a `/csrm-private/` URL that nothing serves. A file an administrator uploads in the Media Library is never content-checked or malware-scanned by CSRM (only the plugin's own type allow-list applies), and it is stored under the same `csrm/attachments/` prefix and IAM scope as the attachments (locally, in the same private directory). That is privileged operator access outside CSRM's role model, as every record in the Content Manager is. Keep Media Library rights with super admins only. A file deleted there shows `File unavailable` in CSRM and is refused at download; its record and history stay, and under versioning its bytes stay as a noncurrent version for step 5's 30 days.

### Manual checks before the first production use

These cannot run on the build host (14-VALIDATION.md, "Manual-Only Verifications"):

1. **Scanning:** point `CSRM_CLAMAV_HOST` and `CSRM_CLAMAV_PORT` at the deployment's `clamd`, upload the industry antivirus test file from a machine whose antivirus allows it, and confirm the refusal and the warning event. Then upload a 25 MB PDF and confirm it is added clean.
2. **Storage,** in a non-production environment: upload, download and remove a file through the UI. `aws s3api head-object` on the object shows `ServerSideEncryption: aws:kms`, and an anonymous request for the object's URL answers 403.
3. **Transfer:** at 1440 in Chrome, upload a 24 MB PDF and download it again, recording both times and the tab's memory.
4. **Database:** after the first start on this release, the database has the `csrm_request_attachments` table, and the first upload creates the storage directory or the first object.
5. **The reverse proxy:** a 7 MB Server Action post, and a 7 MB multipart post with no `Next-Action` header, to a page outside the four are each refused with 413; a 7 MB text Server Action post to a request page is refused with 413 too; and a 25 MB file uploads on a request page.

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

## Package scope

`@csrm/strapi` is the private shared Strapi backend, part of the [IdamBox CSRM workspace](../../README.md). Install dependencies from the repository root with pnpm. Strapi owns IdamBox grants, record-level authorisation, persistence and workflow transitions.

## Usage

The current workspace package manager is pnpm. From the repository root:

```bash
pnpm --filter @csrm/strapi dev
pnpm --filter @csrm/strapi build
pnpm --filter @csrm/strapi start
```

The backend has no published library API. Its application operations are defined by the Strapi routes and reference specification. See [Backend services](../../docs/services/backend-services.md) and [Configuration](../../docs/configuration/configuration.md).

## Testing

From the repository root:

```bash
pnpm --filter @csrm/strapi test
pnpm --filter @csrm/strapi served-operations:write
pnpm --filter @csrm/strapi authorization-matrix:observe
```

The test script checks maintenance switches, compiles backend and test TypeScript, then runs Node tests serially. Use the HTTP harness's isolated runtime rather than a developer database. See [Testing](../../docs/guides/testing.md).

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
