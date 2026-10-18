import {
  ATTACHMENT_DEFAULT_S3_REGION,
  AttachmentConfigurationError,
  attachmentConfigOf,
  type AttachmentEnvironment,
} from "./attachment-config";
import { createPrivateLocalProvider } from "./private-local-provider";
import { attachmentLocalDirectoryOf, uploadProviderName } from "./storage-port";

/*
 * Wires attachment storage into the upload plugin (14-04; D-06). Called from the application's register(), directly
 * after assertAttachmentConfiguration: Strapi runs every plugin's register() first (Strapi.js), so the plugin's
 * provider exists here and its routes are not yet mounted.
 *
 * - local: the stock provider's methods are replaced, through the provider's own `extend`, by the CSRM private local
 *   provider writing to the configured directory (or `.tmp/attachments` when attachments are off). The plugin has one
 *   provider, so the admin Media Library becomes private too. The provider is never configured as a module path,
 *   which the plugin lower-cases and breaks on a case-sensitive filesystem.
 * - aws-s3: a configured `baseUrl` makes the provider hand out unsigned URLs, so it stops the boot.
 * - Both: the plugin's content-API router is emptied (D-08), unmounting POST /api/upload and GET, GET page, GET one
 *   and DELETE /api/upload/files, which would let the full-access token holder list private files' metadata, upload
 *   unscanned files or delete them. The router is a factory whose `routes` setter Strapi reads when it mounts routes
 *   in bootstrap (@strapi/utils content-api-router.js). The admin panel's own upload routes are a separate router.
 */

type RegistrationStrapi = {
  readonly config: { get: (key: string) => unknown };
  readonly dirs: { readonly app: { readonly root: string } };
  plugin(name: string): unknown;
};

type ExtensibleProvider = { provider: { extend(methods: object): void } };
type UploadPluginRouters = { routes?: Record<string, unknown> };

export function registerAttachmentStorage(strapi: RegistrationStrapi): void {
  const uploadConfig = (strapi.config.get("plugin::upload") ?? {}) as { providerOptions?: { baseUrl?: unknown } };
  const provider = uploadProviderName(strapi).toLowerCase();
  const storage = attachmentConfigOf(strapi).storage;
  if (provider === "local") {
    if (storage?.kind === "s3") throw new AttachmentConfigurationError("CSRM attachments are configured for S3, but the upload plugin's provider is local.");
    (strapi.plugin("upload") as ExtensibleProvider).provider.extend(createPrivateLocalProvider(attachmentLocalDirectoryOf(strapi)));
  } else if (provider === "aws-s3") {
    if (uploadConfig.providerOptions?.baseUrl !== undefined && uploadConfig.providerOptions.baseUrl !== null && uploadConfig.providerOptions.baseUrl !== "") {
      throw new AttachmentConfigurationError("CSRM attachments refuse an upload baseUrl");
    }
    if (storage?.kind === "local") throw new AttachmentConfigurationError("CSRM attachments are configured for local storage, but the upload plugin's provider is aws-s3.");
  } else {
    throw new AttachmentConfigurationError("CSRM attachments support only the local and aws-s3 upload providers.");
  }
  const contentApi = (strapi.plugin("upload") as UploadPluginRouters).routes?.["content-api"] as { routes?: unknown } | undefined;
  // Fail closed: a plugin whose router cannot be emptied would keep its public routes.
  if (!contentApi || !("routes" in contentApi)) throw new AttachmentConfigurationError("CSRM attachments could not unmount the upload plugin's content-API routes.");
  contentApi.routes = [];
}

/** Where attachment objects live in the bucket, ahead of the generated key. */
export const ATTACHMENT_S3_ROOT_PATH = "csrm/attachments";
/** Seconds a presigned read stays valid; the port uses it at once, server-side. */
export const ATTACHMENT_S3_SIGNED_URL_SECONDS = 60;

function setting(env: AttachmentEnvironment, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

/*
 * The upload plugin's configuration for attachment storage (D-06, G-7; 14-RESEARCH Code Example 3), spread into
 * `upload.config` in config/plugins.ts. Empty unless CSRM_ATTACHMENT_STORAGE is s3, so the plugin keeps its local
 * provider (which register() makes private). For S3, the official provider is configured private:
 *
 * - `ACL` is present and undefined: the provider then applies no default public-read ACL and sends no ACL header,
 *   which a bucket with ACLs disabled (the AWS default) would refuse. Never `private`, which those buckets refuse too.
 * - SSE-KMS with the configured key; the Sydney region by default; an endpoint (an S3-compatible store) goes
 *   path-style.
 * - No `baseUrl`: with one the provider returns unsigned URLs (registerAttachmentStorage refuses it at boot).
 * - Credentials come from the SDK's default provider chain, never from here.
 *
 * Missing or invalid S3 settings are left to assertAttachmentConfiguration, which stops the boot naming them.
 */
export function attachmentUploadPluginConfig(env: AttachmentEnvironment): Record<string, unknown> {
  if (setting(env, "CSRM_ATTACHMENT_STORAGE") !== "s3") return {};
  const endpoint = setting(env, "CSRM_ATTACHMENT_S3_ENDPOINT");
  return {
    provider: "aws-s3",
    providerOptions: {
      rootPath: ATTACHMENT_S3_ROOT_PATH,
      s3Options: {
        region: setting(env, "CSRM_ATTACHMENT_S3_REGION") ?? ATTACHMENT_DEFAULT_S3_REGION,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
        params: {
          Bucket: setting(env, "CSRM_ATTACHMENT_S3_BUCKET"),
          ACL: undefined,
          signedUrlExpires: ATTACHMENT_S3_SIGNED_URL_SECONDS,
        },
      },
      providerConfig: {
        encryption: { type: "aws:kms", kmsKeyId: setting(env, "CSRM_ATTACHMENT_S3_KMS_KEY_ID") },
      },
    },
  };
}
