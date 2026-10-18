import path from "node:path";

import { isDevelopmentRuntime } from "../ai/data-policy";

/*
 * The attachment settings (14-03; D-15; Phase 12 D-27's pattern). One module reads them, once, at boot.
 *
 * - Development (the development key: NODE_ENV and CSRM_ENVIRONMENT both `development`, the first two terms of
 *   development-identity-enabled.ts) defaults to local private storage at `.tmp/attachments` and the development
 *   scanner.
 * - Everywhere else, an unset storage or scanner makes attachments unavailable (`ATTACHMENTS_NOT_CONFIGURED`); the
 *   rest of the application runs, because failing boot would take the whole product down for one feature.
 * - An invalid value, an incomplete S3 or ClamAV block, an S3 endpoint that is not https outside the development key
 *   (WR-705, IN-209: plain http would carry the bytes and the presigned reads in cleartext), a local directory inside
 *   the folder Strapi serves (`strapi.dirs.static.public`, IN-209) or the development scanner outside the development
 *   key fails boot with AttachmentConfigurationError, naming the setting and never echoing its value.
 *
 * The settings are documented, commented, in apps/backend/.env.example. Credentials for S3 come from the
 * environment's standard provider chain and are never read here. Reversibility: costly (an operator contract).
 */

export type AttachmentStorageConfig =
  | { readonly kind: "local"; readonly directory: string }
  | { readonly kind: "s3"; readonly bucket: string; readonly region: string; readonly kmsKeyId: string; readonly endpoint: string | null };

export type AttachmentScannerConfig =
  | { readonly kind: "development" }
  | { readonly kind: "clamav"; readonly host: string; readonly port: number; readonly timeoutMs: number };

export interface AttachmentConfig {
  readonly storage: AttachmentStorageConfig | null;
  readonly scanner: AttachmentScannerConfig | null;
  readonly available: boolean;
  readonly unavailableReason: "ATTACHMENTS_NOT_CONFIGURED" | null;
}

export type AttachmentEnvironment = Readonly<Record<string, string | undefined>>;

export class AttachmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentConfigurationError";
  }
}

export const ATTACHMENT_DEFAULT_LOCAL_DIR = ".tmp/attachments";
export const ATTACHMENT_DEFAULT_S3_REGION = "ap-southeast-2";
export const CLAMAV_DEFAULT_TIMEOUT_MS = 60_000;
export const CLAMAV_TIMEOUT_RANGE_MS = Object.freeze({ min: 1_000, max: 600_000 });

/** The key `strapi.config` holds the validated configuration under. */
export const ATTACHMENT_CONFIG_KEY = "csrm.attachments";

const NOT_CONFIGURED: AttachmentConfig = Object.freeze({ storage: null, scanner: null, available: false, unavailableReason: "ATTACHMENTS_NOT_CONFIGURED" });

function setting(env: AttachmentEnvironment, name: string): string | null {
  const value = env[name];
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function required(env: AttachmentEnvironment, name: string, block: string): string {
  const value = setting(env, name);
  if (value === null) throw new AttachmentConfigurationError(`${block} requires ${name}.`);
  return value;
}

function integerIn(value: string, name: string, min: number, max: number): number {
  const parsed = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new AttachmentConfigurationError(`${name} must be a whole number from ${min} to ${max}.`);
  }
  return parsed;
}

/**
 * Whether `candidate` is `parent` or inside it, as `platform`'s file system sees paths (IN-209): Windows and macOS
 * (darwin) are case-insensitive by default, so both are compared case-folded; every other platform exactly. Windows
 * paths are compared with Windows path rules, every other platform's with POSIX rules.
 */
export function isWithinDirectory(parent: string, candidate: string, platform: NodeJS.Platform = process.platform): boolean {
  const paths = platform === "win32" ? path.win32 : path.posix;
  const fold = platform === "win32" || platform === "darwin" ? (location: string) => location.toLowerCase() : (location: string) => location;
  const relative = paths.relative(fold(parent), fold(candidate));
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${paths.sep}`) && !paths.isAbsolute(relative));
}

function readStorage(env: AttachmentEnvironment, appRoot: string, publicDirectory: string, development: boolean): AttachmentStorageConfig | null {
  const kind = setting(env, "CSRM_ATTACHMENT_STORAGE") ?? (development ? "local" : null);
  if (kind === null) return null;
  if (kind === "local") {
    const directory = path.resolve(appRoot, setting(env, "CSRM_ATTACHMENT_LOCAL_DIR") ?? ATTACHMENT_DEFAULT_LOCAL_DIR);
    if (isWithinDirectory(path.resolve(appRoot, publicDirectory), directory)) {
      throw new AttachmentConfigurationError("CSRM_ATTACHMENT_LOCAL_DIR must not be inside Strapi's public folder (strapi.dirs.static.public), which Strapi serves to anyone.");
    }
    return { kind: "local", directory };
  }
  if (kind === "s3") {
    const block = "CSRM_ATTACHMENT_STORAGE=s3";
    const bucket = required(env, "CSRM_ATTACHMENT_S3_BUCKET", block);
    const kmsKeyId = required(env, "CSRM_ATTACHMENT_S3_KMS_KEY_ID", block);
    const region = setting(env, "CSRM_ATTACHMENT_S3_REGION") ?? ATTACHMENT_DEFAULT_S3_REGION;
    const endpoint = setting(env, "CSRM_ATTACHMENT_S3_ENDPOINT");
    if (endpoint !== null) {
      let protocol: string;
      try {
        protocol = new URL(endpoint).protocol;
      } catch {
        protocol = "";
      }
      if (protocol !== "https:" && protocol !== "http:") throw new AttachmentConfigurationError("CSRM_ATTACHMENT_S3_ENDPOINT must be an https URL.");
      if (protocol === "http:" && !development) {
        throw new AttachmentConfigurationError("CSRM_ATTACHMENT_S3_ENDPOINT must be an https URL: http is allowed only when NODE_ENV and CSRM_ENVIRONMENT are both development.");
      }
    }
    return { kind: "s3", bucket, region, kmsKeyId, endpoint };
  }
  throw new AttachmentConfigurationError("CSRM_ATTACHMENT_STORAGE must be local or s3.");
}

function readScanner(env: AttachmentEnvironment, development: boolean): AttachmentScannerConfig | null {
  const kind = setting(env, "CSRM_ATTACHMENT_SCANNER") ?? (development ? "development" : null);
  if (kind === null) return null;
  if (kind === "development") {
    if (!development) {
      throw new AttachmentConfigurationError("CSRM_ATTACHMENT_SCANNER=development is allowed only when NODE_ENV and CSRM_ENVIRONMENT are both development: a test double must never guard a deployment.");
    }
    return { kind: "development" };
  }
  if (kind === "clamav") {
    const block = "CSRM_ATTACHMENT_SCANNER=clamav";
    const host = required(env, "CSRM_CLAMAV_HOST", block);
    const port = integerIn(required(env, "CSRM_CLAMAV_PORT", block), "CSRM_CLAMAV_PORT", 1, 65_535);
    const timeout = setting(env, "CSRM_CLAMAV_TIMEOUT_MS");
    const timeoutMs = timeout === null ? CLAMAV_DEFAULT_TIMEOUT_MS : integerIn(timeout, "CSRM_CLAMAV_TIMEOUT_MS", CLAMAV_TIMEOUT_RANGE_MS.min, CLAMAV_TIMEOUT_RANGE_MS.max);
    return { kind: "clamav", host, port, timeoutMs };
  }
  throw new AttachmentConfigurationError("CSRM_ATTACHMENT_SCANNER must be development or clamav.");
}

/**
 * Reads and validates the attachment settings. Throws AttachmentConfigurationError for a value that must stop boot.
 * `publicDirectory` is the folder Strapi serves, `strapi.dirs.static.public`.
 */
export function readAttachmentConfig(env: AttachmentEnvironment, options: { readonly appRoot: string; readonly publicDirectory: string }): AttachmentConfig {
  const development = isDevelopmentRuntime({ NODE_ENV: env.NODE_ENV, CSRM_ENVIRONMENT: env.CSRM_ENVIRONMENT });
  const storage = readStorage(env, options.appRoot, options.publicDirectory, development);
  const scanner = readScanner(env, development);
  if (storage === null || scanner === null) return { storage, scanner, available: false, unavailableReason: "ATTACHMENTS_NOT_CONFIGURED" };
  return { storage, scanner, available: true, unavailableReason: null };
}

type StrapiWithConfig = {
  readonly config: { get: (key: string) => unknown; set: (key: string, value: unknown) => void };
  /** `static.public` is the folder Strapi serves; Strapi always sets it, and a double without it gets Strapi's default. */
  readonly dirs: { readonly app: { readonly root: string }; readonly static?: { readonly public?: string } };
  readonly log: { info: (message: string) => void };
};

/**
 * Boot validation, called from `register()` after the AI configuration: stores the configuration under
 * `csrm.attachments` and logs one line naming the storage and scanner kinds, never a bucket, key, directory or host.
 */
export function assertAttachmentConfiguration(strapi: StrapiWithConfig, env: AttachmentEnvironment = process.env): void {
  const appRoot = strapi.dirs.app.root;
  const config = readAttachmentConfig(env, { appRoot, publicDirectory: strapi.dirs.static?.public ?? path.resolve(appRoot, "public") });
  strapi.config.set(ATTACHMENT_CONFIG_KEY, config);
  if (config.available && config.storage && config.scanner) {
    strapi.log.info(`CSRM attachments: ${config.storage.kind} storage, ${config.scanner.kind} malware scanning.`);
  } else {
    strapi.log.info("CSRM attachments are unavailable (ATTACHMENTS_NOT_CONFIGURED): set CSRM_ATTACHMENT_STORAGE and CSRM_ATTACHMENT_SCANNER to enable them.");
  }
}

/** The configuration `assertAttachmentConfiguration` stored; unavailable when boot never stored one. */
export function attachmentConfigOf(strapi: { readonly config: { get: (key: string) => unknown } }): AttachmentConfig {
  const config = strapi.config.get(ATTACHMENT_CONFIG_KEY) as AttachmentConfig | undefined;
  return config ?? NOT_CONFIGURED;
}
